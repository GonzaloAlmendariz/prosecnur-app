# session_schema.R — Censo del esquema de claves de sesión del .pulso.
#
# CONTRATO: clave de sesión nueva (top-level de `.session_env[[sid]]`) ⇒ fila
# nueva en `session_schema()`, en el MISMO commit. Si la clave es `persistible`
# implica además pensar migración/back-compat en `load_pulso` (los .pulso ya
# guardados no la traen; los nuevos la llevarán para siempre). El gate vive en
# tests/testthat/test-session-schema.R.
#
# ¿Por qué existe? `build_pulso` serializa a state.rds TODO lo que esté en la
# sesión salvo strips explícitos (`.pulso_strip_caches`). El esquema del .pulso
# era implícito: cualquier módulo podía agregar una clave y quedaba persistida
# sin que nadie lo decidiera. Este censo lo vuelve explícito, al estilo del
# registro hermano de errores (errors_registry.R): tabla LITERAL revisable en
# el diff + escáner AST + gate. NO cambia el comportamiento de persistencia.
#
# Alcance del censo (reglas explícitas):
# - El escáner AST (`.session_schema_escanear_claves`) cubre los setters de
#   claves top-level con clave literal: `session_set()`, `.analitica_status_set()`
#   y `.graficos_status_set()` (los dos últimos delegan en session_set con la
#   clave que reciben, así que el literal vive en el call site del wrapper).
# - Claves con nombre construido (paste0/paste) se modelan por PATRÓN
#   (tipo = "patron", regex explícita). No se persiguen instancias.
# - Escrituras directas (`s$clave <- ...; .session_env[[sid]] <- s`) no son
#   censables por el escáner sin falsos positivos masivos; se registran con
#   origen = "directa" como documentación. El gate NO se pone rojo por una
#   escritura directa nueva, pero sí por lo que el save toca: toda clave que
#   `.pulso_strip_caches` asigna debe estar censada (segundo test del gate).
# - El scope de validación por base (`estudio$bases[[b]]$validacion$*`) y el
#   estado de codificación (`codif_por_base[[b]]$*`) son sub-esquemas anidados:
#   acá se censan sus claves top-level (`estudio`, `codif_por_base`) con nota.
#
# Categorías:
# - persistible    — viaja en state.rds y sobrevive el round-trip save/load.
# - cache_stripped — el save la resetea (NULL/list()/FALSE), total o
#                    condicionalmente (ver nota); se re-deriva al load.
# - interna        — infraestructura del ciclo de vida sesión/proyecto: exenta
#                    de project_dirty en session_set y/o reescrita por
#                    build_pulso/load_pulso (id, dir, project_path, ...).
#
# Columnas: clave (literal o regex) | tipo (literal|patron) | categoria |
# modulo (archivo dueño en api/R) | origen (session_set|directa|bootstrap) |
# nota (vacía si no hay nada que advertir).

# Setters censables de claves top-level de sesión.
.session_schema_setters <- c("session_set", ".analitica_status_set", ".graficos_status_set")

# Escáner AST: devuelve data.frame(clave, archivo) con una fila por llamada a
# un setter censable cuya clave es un string literal. Se camina el AST parseado
# (no regex sobre texto) para no confundir comentarios ni llamadas multilínea;
# mismo enfoque que .errores_escanear_codigos en errors_registry.R.
.session_schema_escanear_claves <- function(dir_r) {
  archivos <- list.files(dir_r, pattern = "\\.R$", full.names = TRUE)
  # El propio censo y el registro de errores contienen literales que no son
  # escrituras reales: fuera del alcance.
  archivos <- archivos[!basename(archivos) %in% c("session_schema.R", "errors_registry.R")]
  acumulado <- list()
  caminar <- function(e, archivo) {
    if (is.call(e)) {
      fn <- e[[1]]
      if (is.name(fn) && as.character(fn) %in% .session_schema_setters && length(e) >= 3L) {
        lst_e <- as.list(e)
        nm <- names(lst_e)
        clave_arg <- if (!is.null(nm) && "key" %in% nm) lst_e[["key"]] else e[[3]]
        if (is.character(clave_arg) && length(clave_arg) == 1L) {
          acumulado[[length(acumulado) + 1L]] <<- data.frame(
            clave = clave_arg, archivo = archivo, stringsAsFactors = FALSE
          )
        }
        # Clave no literal: familia dinámica, cubierta por filas tipo "patron".
      }
    }
    if (is.call(e) || is.pairlist(e)) {
      lst <- as.list(e)
      for (i in seq_along(lst)) {
        # El símbolo vacío (argumento faltante, ej. x[, 1]) revienta al
        # evaluarse; single-bracket + unname lo detecta aun si viene nombrado.
        if (identical(unname(lst[i]), list(quote(expr = )))) next
        if (!is.null(lst[[i]])) caminar(lst[[i]], archivo)
      }
    }
    invisible()
  }
  for (path in archivos) {
    # Un archivo que no parsea rompe load_all() mucho antes que este censo.
    exprs <- tryCatch(parse(path, keep.source = FALSE), error = function(e) NULL)
    if (is.null(exprs)) next
    for (ex in exprs) caminar(ex, basename(path))
  }
  if (!length(acumulado)) {
    return(data.frame(clave = character(0), archivo = character(0), stringsAsFactors = FALSE))
  }
  do.call(rbind, acumulado)
}

# Censo de lo que el save toca: extrae del cuerpo de `.pulso_strip_caches` (y
# de `.pulso_sanitize_graficos_consolidado_state`, que aquella invoca) toda
# asignación cuyo objetivo cuelga de `s`. Devuelve data.frame(clave, reset):
# reset = TRUE cuando el objetivo es top-level (`s$clave <- ...`) y el RHS es
# un reset literal (NULL, list() vacío o FALSE) — esas claves NO sobreviven el
# round-trip y deben censarse como cache_stripped. Las asignaciones anidadas o
# con RHS calculado son saneos parciales (la clave persiste, sanitizada).
.session_schema_claves_strip <- function() {
  cuerpos <- list(
    body(.pulso_strip_caches),
    body(.pulso_sanitize_graficos_consolidado_state)
  )
  acumulado <- list()
  # Raíz de una cadena de accesos `$`/`[[`: el símbolo más a la izquierda.
  raiz <- function(e) {
    while (is.call(e) && length(e) >= 2L &&
           as.character(e[[1]])[1] %in% c("$", "[[", "[")) {
      e <- e[[2]]
    }
    e
  }
  es_reset <- function(rhs) {
    if (is.null(rhs)) return(TRUE)
    if (identical(rhs, FALSE)) return(TRUE)
    if (is.call(rhs) && identical(as.character(rhs[[1]])[1], "list") && length(rhs) == 1L) return(TRUE)
    FALSE
  }
  # `s <- .session_state_clear(s, c("a", "b"))` es un reset top-level de cada
  # clave literal del vector, igual que `s$a <- NULL`. Es la forma canónica del
  # reset: `s$a <- NULL` borraría el nombre y dejaría que un `$` posterior caiga
  # por partial matching en un hermano con el mismo prefijo (ver
  # .session_state_clear en session_store.R). El censo tiene que verla o las
  # filas cache_stripped quedarían huérfanas.
  claves_state_clear <- function(e) {
    if (!is.call(e) || length(e) < 3L) return(character(0))
    if (!identical(as.character(e[[1]])[1], ".session_state_clear")) return(character(0))
    if (!identical(e[[2]], quote(s))) return(character(0))
    keys <- e[[3]]
    lits <- if (is.character(keys)) {
      keys
    } else if (is.call(keys) && identical(as.character(keys[[1]])[1], "c")) {
      as.list(keys)[-1]
    } else {
      list()
    }
    lits <- unlist(lits, use.names = FALSE)
    lits <- lits[vapply(lits, is.character, logical(1))]
    as.character(lits)
  }
  caminar <- function(e) {
    if (is.call(e)) {
      op <- as.character(e[[1]])[1]
      for (clave_chr in claves_state_clear(e)) {
        acumulado[[length(acumulado) + 1L]] <<- data.frame(
          clave = clave_chr, reset = TRUE, stringsAsFactors = FALSE
        )
      }
      if (op %in% c("<-", "=", "<<-") && length(e) == 3L) {
        lhs <- e[[2]]
        if (is.call(lhs) && identical(raiz(lhs), quote(s))) {
          # Clave top-level: subir por la cadena hasta el acceso directo a `s`.
          nodo <- lhs
          while (is.call(nodo) && !identical(nodo[[2]], quote(s))) nodo <- nodo[[2]]
          clave <- nodo[[3]]
          # En `s$clave` el nombre ES la clave; en `s[[x]]` solo cuenta un
          # string literal — un símbolo (`s[[k]]` dentro de un for) es una
          # variable, no una clave censable.
          op_acceso <- as.character(nodo[[1]])[1]
          clave_chr <- if (is.character(clave)) {
            clave
          } else if (is.name(clave) && identical(op_acceso, "$")) {
            as.character(clave)
          } else {
            NA_character_
          }
          if (!is.na(clave_chr)) {
            top_level <- identical(lhs, nodo)
            acumulado[[length(acumulado) + 1L]] <<- data.frame(
              clave = clave_chr,
              reset = isTRUE(top_level) && es_reset(e[[3]]),
              stringsAsFactors = FALSE
            )
          }
        }
      }
    }
    if (is.call(e) || is.pairlist(e)) {
      lst <- as.list(e)
      for (i in seq_along(lst)) {
        if (identical(unname(lst[i]), list(quote(expr = )))) next
        if (!is.null(lst[[i]])) caminar(lst[[i]])
      }
    }
    invisible()
  }
  for (cuerpo in cuerpos) caminar(cuerpo)
  if (!length(acumulado)) {
    return(data.frame(clave = character(0), reset = logical(0), stringsAsFactors = FALSE))
  }
  out <- do.call(rbind, acumulado)
  # Una clave con al menos un reset top-level cuenta como reseteada.
  resumen <- stats::aggregate(reset ~ clave, out, any)
  resumen[order(resumen$clave), , drop = FALSE]
}

# Resuelve la(s) categoría(s) de una clave contra el esquema. Regla: una fila
# literal PRECEDE a los patrones (permite excepciones puntuales dentro de una
# familia, ej. `monitoreo_dashboard_cache_token` exacto es cache_stripped
# aunque la familia scoped `monitoreo_dashboard_cache(_token)__<scope>` persista).
.session_schema_categorias <- function(clave, schema = session_schema()) {
  lit <- schema[schema$tipo == "literal" & schema$clave == clave, , drop = FALSE]
  if (nrow(lit)) return(unique(lit$categoria))
  pat <- schema[schema$tipo == "patron", , drop = FALSE]
  hit <- vapply(pat$clave, function(rx) {
    isTRUE(tryCatch(grepl(rx, clave), error = function(e) FALSE))
  }, logical(1))
  unique(pat$categoria[hit])
}

# Esquema censado: clave | tipo | categoria | modulo | origen | nota.
session_schema <- function() {
  tabla <- c(
    # --- Infraestructura de sesión/proyecto (bootstrap de session_create) ---
    "id",                          "literal", "interna",        "session_store.R",   "bootstrap",   "viaja en state.rds pero load_pulso lo reescribe con el sid nuevo",
    "created_at",                  "literal", "interna",        "session_store.R",   "bootstrap",   "metadato de sesión; alimenta manifest.created_at",
    "dir",                         "literal", "interna",        "session_store.R",   "bootstrap",   "tempdir; build_pulso lo excluye y load_pulso lo reescribe",
    "project_path",                "literal", "interna",        "session_store.R",   "bootstrap",   "exenta de dirty; build la excluye, load la setea",
    "project_dirty",               "literal", "interna",        "session_store.R",   "session_set", "exenta de dirty; build la excluye",
    "project_last_saved_at",       "literal", "interna",        "session_store.R",   "bootstrap",   "exenta de dirty; build la excluye",
    "data_raw",                    "literal", "persistible",    "session_store.R",   "bootstrap",   "campo legacy pre-estudio; suele quedar NULL",
    "files",                       "literal", "persistible",    "io.R",              "session_set", "build recorta la copia persistida al subset de inputs referenciados",
    "instrumento",                 "literal", "persistible",    "router_carga.R",    "session_set", "campo legacy single-base",

    # --- Estudio y fuentes runtime (session_store.R) ---
    "estudio",                     "literal", "persistible",    "session_store.R",   "session_set", "sanitizada en save: bases[[b]]$validacion$explorador_cache se strippea",
    "codif_source_active",         "literal", "persistible",    "session_store.R",   "directa",     "",
    "codif_por_base",              "literal", "persistible",    "session_store.R",   "session_set", "sanitizada en save: $inst/$data (caches por base) se strippean",
    "rp_data",                     "literal", "cache_stripped", "session_store.R",   "session_set", "strip condicional: solo estudios con bases; en legacy single-base persiste",
    "rp_inst",                     "literal", "cache_stripped", "session_store.R",   "session_set", "strip condicional: solo estudios con bases; en legacy single-base persiste",
    "rp_data_sources",             "literal", "cache_stripped", "session_store.R",   "session_set", "strip condicional; load la re-deriva de los file_id de cada base",
    "rp_inst_sources",             "literal", "cache_stripped", "session_store.R",   "session_set", "strip condicional; load la re-deriva de los file_id de cada base",
    "data_xlsform_compatibility",  "literal", "cache_stripped", "router_carga.R",    "directa",     "strip condicional multibase",

    # --- Validación (scope legacy en raíz de la sesión, pre-v0.2) ---
    "plan_result",                 "literal", "persistible",    "session_store.R",   "session_set", "scope legacy single-base; en multibase vive en estudio$bases[[b]]$validacion",
    "evaluacion",                  "literal", "persistible",    "session_store.R",   "session_set", "scope legacy single-base",
    "reglas_custom",               "literal", "persistible",    "session_store.R",   "directa",     "scope legacy single-base (validacion_scope_set)",
    "validacion_operational_config", "literal", "persistible",  "session_store.R",   "directa",     "scope legacy single-base",
    "validacion_variables_excluidas", "literal", "persistible", "session_store.R",   "directa",     "scope legacy single-base",
    "explorador_cache",            "literal", "cache_stripped", "session_store.R",   "directa",     "cache legacy en raíz; strippeado en save desde 2026-07-23 (unidad 3.7)",
    "limpieza_draft",              "literal", "persistible",    "session_store.R",   "directa",     "scope legacy single-base",
    "limpieza_preview",            "literal", "persistible",    "session_store.R",   "directa",     "scope legacy single-base",
    "limpieza_artifacts",          "literal", "persistible",    "session_store.R",   "directa",     "scope legacy single-base",

    # --- Carga / estructura ---
    "data_raw_meta",               "literal", "persistible",    "router_carga.R",    "session_set", "load reapunta $path al files store reescrito",
    "choice_code_maps_pending",    "literal", "persistible",    "router_carga.R",    "session_set", "",
    "choice_code_maps_confirmed",  "literal", "persistible",    "router_carga.R",    "session_set", "",
    "inst_estructura_por_base",    "literal", "persistible",    "carga_estructura_base.R", "session_set", "",
    "inst_limpieza",               "literal", "persistible",    "carga_estructura_base.R", "session_set", "",
    "multi_integrated_draft",      "literal", "persistible",    "multi_integrated.R", "session_set", "",
    "surveymonkey_survey_catalog", "literal", "cache_stripped", "surveymonkey_multibase.R", "directa", "catálogo externo regenerable desde la integración",

    # --- Codificación ---
    "codif_aplicado",              "literal", "persistible",    "router_codificacion.R", "session_set", "",
    "codif_data_adaptada_fid",     "literal", "persistible",    "router_codificacion.R", "session_set", "",
    "codif_inst_adaptado_fid",     "literal", "persistible",    "router_codificacion.R", "session_set", "",

    # --- Analítica ---
    "analitica_fuente",            "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_config",            "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_config_por_base",   "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_status_por_base",   "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_prep_ok",           "literal", "cache_stripped", "router_analitica.R", "session_set", "strip condicional multibase; el estado por base persiste en analitica_status_por_base",
    "analitica_multibase_available", "literal", "cache_stripped", "router_analitica.R", "session_set", "strip condicional multibase",
    "analitica_rp_data",           "literal", "cache_stripped", "router_analitica.R", "session_set", "strip condicional multibase",
    "analitica_rp_inst",           "literal", "cache_stripped", "router_analitica.R", "session_set", "strip condicional multibase",
    "analitica_rp_data_sources",   "literal", "cache_stripped", "router_analitica.R", "session_set", "strip condicional multibase",
    "analitica_rp_inst_sources",   "literal", "cache_stripped", "router_analitica.R", "session_set", "strip condicional multibase",
    "analitica_codebook_ok",       "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_frecuencias_ok",    "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_cruces_ok",         "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_spss_ok",           "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_enumeradores_ok",   "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_dim_ok",            "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_multibase_ok",      "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_panel_ok",          "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_panel_preview",     "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_ficha_tecnica_ok",  "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_bases_data_ok",     "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_bases_instrumento_ok", "literal", "persistible", "router_analitica.R", "session_set", "",
    "analitica_bases_sav_ok",      "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_bases_csv_ok",      "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_bases_xlsx_ok",     "literal", "persistible",    "router_analitica.R", "session_set", "",
    "analitica_bases_script_r_ok", "literal", "persistible",    "router_analitica.R", "session_set", "",
    "rp_dim",                      "literal", "persistible",    "router_analitica.R", "session_set", "",
    "rp_dim_config",               "literal", "persistible",    "router_analitica.R", "session_set", "",

    # --- Gráficos ---
    "graficos_config",             "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_config_por_base",    "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_status_por_base",    "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_ppt_ok",             "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_word_ok",            "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_presets_defaults",   "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_overrides_defaults", "literal", "persistible",    "router_graficos.R", "session_set", "",
    "graficos_preview_cache",      "literal", "cache_stripped", "router_graficos.R", "session_set", "cache runtime pese al nombre; strippeado en save desde 2026-07-23 (unidad 3.7)",
    "graficos_share_snapshot",     "literal", "persistible",    "graficos_share.R",  "session_set", "",
    "graficos_consolidado",        "literal", "persistible",    "graficos_consolidado.R", "directa", "sanitizada en save: file refs convertidas a forma portable",
    "graficos_consolidado_draft",  "literal", "persistible",    "graficos_consolidado.R", "directa", "sanitizada en save: file refs convertidas a forma portable",

    # --- Dashboard ---
    "dashboard_source",            "literal", "persistible",    "dashboard_source.R", "session_set", "",
    "dashboard_config",            "literal", "persistible",    "router_dashboard.R", "session_set", "",
    "dashboard_curacion",          "literal", "persistible",    "dashboard_curacion.R", "session_set", "",
    "dashboard_rp_inst",           "literal", "cache_stripped", "dashboard_source.R", "session_set", "re-derivada al load vía .dashboard_rebuild_after_load",
    "dashboard_rp_data",           "literal", "cache_stripped", "dashboard_source.R", "session_set", "re-derivada al load vía .dashboard_rebuild_after_load",
    "dashboard_dim_ctx",           "literal", "cache_stripped", "dashboard_dimensiones.R", "session_set", "contiene closures que no sobreviven deserialización en otro proceso",
    "public_artifact",             "literal", "persistible",    "dashboard_publish.R", "directa",    "",
    "public_artifact_payload",     "literal", "persistible",    "dashboard_publish.R", "directa",    "",

    # --- Monitoreo ---
    "monitoreo_config",            "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_sources",           "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_snapshot",          "literal", "persistible",    "router_monitoreo.R", "session_set", "incluye territorial_report_cache: cache que viaja deliberadamente",
    "monitoreo_kobo_schema",       "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_kobo_schemas",      "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_aulas_plan",        "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_aulas_snapshot",    "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_aulas_publication", "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_client_report_pdf", "literal", "persistible",    "router_monitoreo.R", "session_set", "",
    "monitoreo_production_report_pdf", "literal", "persistible", "router_monitoreo.R", "session_set", "",
    "monitoreo_telefonico_report_pdf", "literal", "persistible", "router_monitoreo_telefonico.R", "session_set", "meta del PDF de avance telefonico; analoga a client/production_report_pdf",
    "monitoreo_client_report_sheet_events", "literal", "persistible", "router_monitoreo.R", "directa",     "escrita via event_key dinamico (.monitoreo_sheets_publish_event_append, 3.8b); el literal vive en router_monitoreo.R:5944",
    "monitoreo_sheet_publish_events", "literal", "persistible", "router_monitoreo.R", "directa",     "escrita via event_key dinamico (.monitoreo_sheets_publish_event_append, 3.8b); el literal vive en router_monitoreo.R:5928",
    "monitoreo_territorial_map_cache", "literal", "persistible", "router_monitoreo.R", "session_set", "cache que viaja deliberadamente (geometría de ruta costosa de recomputar)",
    "monitoreo_territorial_update_history", "literal", "persistible", "router_monitoreo.R", "session_set", "",
    "monitoreo_territorial_occurrences_snapshot", "literal", "persistible", "router_monitoreo.R", "session_set", "",
    "monitoreo_territorial_occurrences_history", "literal", "persistible", "router_monitoreo.R", "session_set", "",
    "monitoreo_territorial_operational_package_review_events", "literal", "persistible", "router_monitoreo.R", "session_set", "",
    "monitoreo_dashboard_cache",   "literal", "cache_stripped", "router_monitoreo.R", "directa",     "clave sin scope (legacy)",
    "monitoreo_dashboard_cache_token", "literal", "cache_stripped", "router_monitoreo.R", "directa", "clave sin scope (legacy)",
    "monitoreo_dashboard_light_cache", "literal", "cache_stripped", "router_monitoreo.R", "directa", "",
    "monitoreo_dashboard_light_cache_token", "literal", "cache_stripped", "router_monitoreo.R", "directa", "",

    # --- Hojas de ruta ---
    "hojas_ruta_config",           "literal", "persistible",    "router_hojas_ruta.R", "session_set", "",
    "hojas_ruta_runs",             "literal", "persistible",    "router_hojas_ruta.R", "session_set", "",
    "hojas_ruta_active_phase",     "literal", "persistible",    "router_hojas_ruta.R", "session_set", "",
    "hojas_ruta_ui_state",         "literal", "persistible",    "router_hojas_ruta.R", "session_set", "",
    "hojas_ruta_workspace_outputs", "literal", "persistible",   "router_hojas_ruta.R", "session_set", "",
    "hojas_ruta_reporte_decisional", "literal", "persistible",  "router_hojas_ruta.R", "session_set", "",
    "hojas_ruta_ok",               "literal", "cache_stripped", "router_hojas_ruta.R", "session_set", "los PDFs/ZIP se regeneran desde hojas_ruta_config + marco INEI local",

    # --- Cálculo de muestra ---
    "calc_muestra_estudio",        "literal", "persistible",    "router_calc_muestra.R", "session_set", "",
    "calc_muestra_reporte",        "literal", "persistible",    "router_calc_muestra.R", "session_set", "",
    "calc_muestra_aulas_config",   "literal", "persistible",    "router_calc_muestra.R", "session_set", "",
    "calc_muestra_aulas_frame",    "literal", "persistible",    "router_calc_muestra.R", "session_set", "sanitizada en save: PII (unique_student_ids) y population/exclusions fuera",
    "calc_muestra_aulas_selection", "literal", "persistible",   "router_calc_muestra.R", "session_set", "sanitizada en save: PII (unique_student_ids) fuera",
    "calc_muestra_aulas_export",   "literal", "persistible",    "router_calc_muestra.R", "session_set", "",
    "calc_muestra_aulas_method_comparison", "literal", "persistible", "router_calc_muestra.R", "session_set", "",
    "calc_muestra_aulas_replacement_simulation", "literal", "persistible", "router_calc_muestra.R", "session_set", "",
    "calc_muestra_aulas_stale_job_result", "literal", "persistible", "router_calc_muestra.R", "session_set", "",

    # --- Otros módulos ---
    "plan_trabajo",                "literal", "persistible",    "router_plan_trabajo.R", "session_set", "esquema propio plan_trabajo_v<N>; load_pulso migra por saltos en .bitacora_migrar_estado (ADR 0047)",
    "diseno_estudio_bitacora",     "literal", "persistible",    "router_diseno_estudio.R", "session_set", "lista pelada sin campo de version; load_pulso la re-normaliza incondicionalmente (idempotente) en .bitacora_migrar_estado",
    "bitacora_preferencias",       "literal", "persistible",    "bitacora_preferencias.R", "session_set", "filtros y vista de las cuatro secciones; viajan con el proyecto y no con la maquina (ADR 0047)",
    "bitacora_avisos",             "literal", "persistible",    "bitacora_avisos.R",       "session_set", "libro de disparos: garantiza que un recordatorio no suene dos veces entre sesiones; libro aparte de la tarea para que editar sus recordatorios no reviva avisos ya mostrados (ADR 0047)",
    "bitacora_canvas",             "literal", "persistible",    "bitacora_canvas.R",       "session_set", "lienzos del modulo: nodos, aristas y viewport. Los grupos son nodos con caja (pertenencia geometrica) y el color guarda el NOMBRE del token, nunca un hex (ADR 0047)",
    "project_modules",             "literal", "persistible",    "project_overview.R", "session_set", "",
    "xlsform_state",               "literal", "persistible",    "router_xlsform_editor.R", "session_set", "legacy mono-formulario; load lo migra a xlsform_forms",
    "xlsform_forms",               "literal", "persistible",    "xlsform_forms.R",   "directa",     "colección multi-formulario del editor",
    "label_overrides",             "literal", "persistible",    "label_overrides.R", "session_set", "",
    "audit_project",               "literal", "persistible",    "audit_projects.R",  "session_set", "",
    "audit_project_sheets",        "literal", "persistible",    "audit_projects.R",  "session_set", "",
    "audit_reference",             "literal", "persistible",    "audit_reference.R", "session_set", "",

    # --- Familias dinámicas (tipo = patron; regex explícita) ---
    "^monitoreo_publication_preflight_events_[a-z0-9_]+$",     "patron", "persistible", "router_monitoreo.R", "session_set", "clave por audiencia (client/internal)",
    "^monitoreo_publication_evidence_pack_events_[a-z0-9_]+$", "patron", "persistible", "router_monitoreo.R", "session_set", "clave por audiencia (client/internal)",
    "^monitoreo_publication_sheet_events_[a-z0-9_]+$",         "patron", "persistible", "router_monitoreo.R", "session_set", "clave por audiencia (client/internal)",
    "^monitoreo_dashboard_cache(_token)?_[a-z0-9_]+$",         "patron", "persistible", "router_monitoreo.R", "session_set", "cache scoped por report_scope; PERSISTE por decision del dueño (warm start intencional 2026-07-23: el .pulso puede pesar mas a cambio de abrir caliente)"
  )
  stopifnot(length(tabla) %% 6L == 0L)
  m <- matrix(tabla, ncol = 6L, byrow = TRUE)
  data.frame(
    clave     = m[, 1],
    tipo      = m[, 2],
    categoria = m[, 3],
    modulo    = m[, 4],
    origen    = m[, 5],
    nota      = m[, 6],
    stringsAsFactors = FALSE
  )
}
