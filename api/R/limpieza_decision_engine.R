# =============================================================================
# Limpieza y normalización — decision maker y cierre de la base
# =============================================================================

.limpieza_now_utc <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

# Estado APLICADO/cache de una base codificada. Al re-limpiar la base este
# estado queda stale y debe invalidarse (forzar re-aplicar). Las DEFINICIONES
# de codificación (grupos_recod, familias_*, marcadas, respuestas_recod,
# plantillas…) NO son estado stale: son el trabajo del usuario y se preservan.
# Histórico: una re-finalización de limpieza borraba `codif_por_base[[base]]`
# entero, destruyendo silenciosamente todo el catálogo de codificación de esa
# base (el usuario quedaba "descodificado" aunque su data adaptada seguía viva).
.codif_applied_cache_keys <- c("aplicado", "inst", "data")

.codif_strip_applied_state <- function(entry) {
  if (!is.list(entry) || !length(entry)) return(entry)
  entry[setdiff(names(entry), .codif_applied_cache_keys)]
}

.limpieza_invalidate_downstream <- function(sid, base_nombre = NULL) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(invisible(FALSE))

  resolved <- tryCatch(.resolve_base_nombre(s, base_nombre), error = function(e) NULL)
  if (!is.null(resolved) && nzchar(resolved)) {
    if (!is.null(s$codif_por_base) && !is.null(s$codif_por_base[[resolved]])) {
      s$codif_por_base[[resolved]] <- .codif_strip_applied_state(s$codif_por_base[[resolved]])
    }
  } else if (is.list(s$codif_por_base) && length(s$codif_por_base)) {
    s$codif_por_base <- lapply(s$codif_por_base, .codif_strip_applied_state)
  }

  s$codif_aplicado <- FALSE
  s$codif_data_adaptada_fid <- NULL
  s$codif_inst_adaptado_fid <- NULL
  s$analitica_prep_ok <- FALSE
  s$analitica_codebook_ok <- FALSE
  s$analitica_frecuencias_ok <- FALSE
  s$analitica_cruces_ok <- FALSE
  s$analitica_spss_ok <- FALSE
  s$analitica_enumeradores_ok <- FALSE
  s$analitica_dim_ok <- FALSE
  s$analitica_multibase_ok <- FALSE
  s$analitica_ficha_tecnica_ok <- FALSE
  s$analitica_multibase_available <- FALSE
  s$graficos_ppt_ok <- FALSE
  s$graficos_word_ok <- FALSE

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

.limpieza_register_download <- function(sid, kind, original_name, path, ext = NULL) {
  s <- session_get(sid)
  file_id <- uuid::UUIDgenerate()
  meta <- list(
    file_id = file_id,
    kind = kind,
    original_name = original_name,
    path = path,
    size = as.integer(file.info(path)$size %||% 0L),
    ext = ext %||% tolower(tools::file_ext(original_name %||% path)),
    uploaded_at = .limpieza_now_utc()
  )
  files <- s$files
  files[[file_id]] <- meta
  session_set(sid, "files", files)
  meta
}

.limpieza_uuid_candidates <- function() {
  c("_uuid", "uuid", "respondent_id", "response_id", "_id", "_submission_id", "_submission_uuid", "id_caso", "fila_id")
}

# ADR 0076 — promoción de la base depurada
# ---------------------------------------------------------------------------
# Lo que se promueve tiene que tener forma de base del estudio, no de tabla de
# trabajo de Validación. `.limpieza_simulate()` opera sobre
# `read_validation_data_ast()$principal`, que arrastra las derivadas del plan;
# en ACNUR V3 eso son 306 columnas contra las 215 de la base de origen. Se
# devuelven las columnas del origen, en su orden, con los valores ya corregidos
# por las decisiones. Una columna del origen que la limpieza haya eliminado no
# se reinventa: si no está, no está.
.limpieza_forma_de_origen <- function(data_final, origen_path, origen_ext) {
  if (!is.data.frame(data_final) || !ncol(data_final)) return(data_final)
  origen <- tryCatch(.read_data_for_validation(origen_path, origen_ext),
                     error = function(e) NULL)
  cols_origen <- if (is.data.frame(origen)) names(origen) else character(0)
  if (!length(cols_origen)) return(data_final)
  keep <- intersect(cols_origen, names(data_final))
  if (!length(keep)) return(data_final)
  data_final[, keep, drop = FALSE]
}

# Una madre con hijas repeat no se promueve: excluir un caso de la madre exige
# podar sus filas hijas, y ese reparto por el árbol es el trabajo que
# `.cuf_prepare_tree()` hace para el filtro de universo. Hasta tenerlo, se
# declara el límite en vez de promover una base incoherente con sus hijas.
.limpieza_promocion_bloqueada_por_repeats <- function(sid, base_nombre) {
  if (!exists(".validacion_resolve_repeat_children", mode = "function")) return(FALSE)
  hijas <- tryCatch(.validacion_resolve_repeat_children(sid, base_nombre),
                    error = function(e) list())
  length(hijas %||% list()) > 0L
}

# Promueve la base depurada a data vigente de su base y declara el linaje, con
# la misma forma que `carga_universe_filter_apply()`: `source_data_file_id`
# guarda de dónde salió y `effective_data_file_id` cuál rige. `original_*` no se
# toca: sigue apuntando a lo que se cargó.
.limpieza_promover_base <- function(sid, base_nombre, clean_meta, source_fid,
                                    n_antes, n_despues, n_columnas, motivo_bloqueo = "") {
  s <- session_get(sid)
  nombre <- tryCatch(.resolve_base_nombre(s, base_nombre), error = function(e) NULL)
  if (is.null(nombre) || !nzchar(nombre) || is.null(s$estudio$bases[[nombre]])) {
    return(invisible(NULL))
  }
  meta <- s$estudio$bases[[nombre]]
  # El linaje describe "de lo recibido a lo que rige", y sólo hay UN registro.
  # `limpieza_finalize()` pasa como origen la data vigente, que en un segundo
  # cierre ya es la promovida: sin este anclaje el linaje se reescribiría a
  # 101 -> 99 y un estudio que recibió 103 declararía haber recibido 101. Se
  # conservan el N y el archivo del primer salto para que la ficha del informe
  # diga 103 -> 99 y revertir vuelva a esas 103.
  previo <- meta$limpieza %||% list()
  encadena <- isTRUE(previo$enabled)
  n_antes_origen <- if (encadena) {
    suppressWarnings(as.integer(previo$n_casos_antes %||% NA_integer_))[1L]
  } else NA_integer_
  fid_origen <- if (encadena) as.character(previo$source_data_file_id %||% "") else ""
  linaje <- list(
    enabled = !nzchar(motivo_bloqueo),
    source_data_file_id = if (nzchar(fid_origen)) fid_origen else as.character(source_fid %||% ""),
    effective_data_file_id = as.character(clean_meta$file_id %||% ""),
    applied_at = .limpieza_now_utc(),
    n_casos_antes = if (!is.na(n_antes_origen)) n_antes_origen else as.integer(n_antes %||% NA_integer_),
    n_casos_despues = as.integer(n_despues %||% NA_integer_)
  )
  # `bloqueo` se agrega solo si lo hay: el serializer unboxed convierte un NULL
  # en `{}`, y el cliente tiene que poder preguntar si es un texto.
  if (nzchar(motivo_bloqueo)) linaje$bloqueo <- motivo_bloqueo
  if (nzchar(motivo_bloqueo)) {
    meta$limpieza <- linaje
    s$estudio$bases[[nombre]] <- meta
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
    return(invisible(linaje))
  }
  meta$data_file_id <- as.character(clean_meta$file_id)
  meta$data_ext <- as.character(clean_meta$ext %||% "xlsx")
  meta$n_filas <- as.integer(n_despues %||% NA_integer_)
  meta$n_columnas <- as.integer(n_columnas %||% NA_integer_)
  meta$limpieza <- linaje
  s$estudio$bases[[nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(linaje)
}

# Vuelve a la base anterior a la promoción sin tocar las decisiones tomadas.
.limpieza_revertir_promocion <- function(sid, base_nombre) {
  s <- session_get(sid)
  nombre <- tryCatch(.resolve_base_nombre(s, base_nombre), error = function(e) NULL)
  if (is.null(nombre) || is.null(s$estudio$bases[[nombre]])) return(invisible(FALSE))
  meta <- s$estudio$bases[[nombre]]
  linaje <- meta$limpieza %||% list()
  src <- as.character(linaje$source_data_file_id %||% "")
  if (!isTRUE(linaje$enabled) || !nzchar(src) || is.null(s$files[[src]])) {
    return(invisible(FALSE))
  }
  meta$data_file_id <- src
  meta$data_ext <- as.character(s$files[[src]]$ext %||% meta$data_ext)
  meta$limpieza <- utils::modifyList(linaje, list(enabled = FALSE, reverted_at = .limpieza_now_utc()))
  s$estudio$bases[[nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

# El linaje que rige ahora mismo, leído de la base y no del artefacto congelado
# del último cierre: revertir cambia la base sin volver a finalizar, y el
# cliente tiene que ver el estado actual, no el del momento en que se cerró.
# Las acciones que escriben sobre una variable. `.limpieza_apply_decisions_to_data()`
# las reconoce por esta lista y les exige `target_variable`; la rehidratación usa
# la misma para saber cuáles dependen del instrumento. Una sola fuente: si se
# agrega una acción y sólo se anota en el aplicador, la cuarentena la dejaría
# volver sin comprobar que su variable siga existiendo.
.LIMPIEZA_ACCIONES_SOBRE_VARIABLE <- c(
  "replace_value", "normalize_value", "impute_value",
  "complete_select_multiple_hierarchy", "set_value", "recode_map",
  "nullify_fields", "adjust_select_multiple"
)

# Qué decisión puede sobrevivir a un instrumento nuevo. Se conserva lo que
# tiene un ancla identificable, y la comprobación de si ese ancla sigue en pie
# se pospone a la rehidratación, que es el único momento en que existen a la vez
# el instrumento nuevo y el catálogo de reglas de la auditoría.
.limpieza_decisiones_conservables <- function(decisions) {
  decisions <- decisions %||% list()
  if (!length(decisions)) return(list())
  conservables <- Filter(function(d) {
    if (!is.list(d)) return(FALSE)
    tipo <- as.character(d$action_type %||% "")[1L]
    if (identical(tipo, "exclude_cases")) {
      casos <- as.character(unlist(d$target_case_ids %||% list(), use.names = FALSE))
      return(length(casos[!is.na(casos) & nzchar(casos)]) > 0L)
    }
    if (tipo %in% .LIMPIEZA_ACCIONES_SOBRE_VARIABLE) {
      return(nzchar(as.character(d$target_variable %||% "")[1L]))
    }
    if (identical(tipo, "ignore_rule")) {
      return(nzchar(as.character(d$source_id %||% "")[1L]))
    }
    FALSE
  }, decisions)
  # Un mismo `id` puede venir del borrador y de la cuarentena anterior; se
  # conserva una sola vez y gana la última, que es la que el analista editó.
  if (length(conservables) < 2L) return(unname(conservables))
  ids <- vapply(conservables, function(d) as.character(d$id %||% ""), character(1))
  unname(conservables[!duplicated(ids, fromLast = TRUE)])
}

# Los nombres de variable del instrumento vigente. Devuelve NULL —y no un
# vector vacío— cuando no se pudo leer: son cosas distintas y confundirlas
# haría que un XLSForm ilegible se leyera como "ninguna variable existe".
.limpieza_variables_del_instrumento <- function(sid, base_nombre = NULL) {
  files <- tryCatch(.resolve_base_files(sid, base_nombre), error = function(e) NULL)
  if (is.null(files) || is.null(files$xlsform$path)) return(NULL)
  inst <- tryCatch(leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE),
                   error = function(e) NULL)
  if (is.null(inst) || is.null(inst$survey) || is.null(inst$survey$name)) return(NULL)
  nombres <- as.character(inst$survey$name)
  nombres[!is.na(nombres) & nzchar(nombres)]
}

# Por qué una decisión conservada NO puede volver al borrador todavía. Cadena
# vacía = puede volver. Las dos puertas son independientes y ambas fallan
# cerradas: en la duda la decisión se queda en cuarentena, porque aplicarla sin
# poder mostrarla es el defecto que este camino existe para evitar.
.limpieza_motivo_no_rehidratable <- function(d, reglas, variables) {
  if (!(as.character(d$source_id %||% "")[1L] %in% reglas)) return("regla")
  var <- as.character(d$target_variable %||% "")[1L]
  # Una exclusión no nombra ninguna variable: le basta con su regla.
  if (!nzchar(var)) return("")
  if (is.null(variables)) return("instrumento")
  if (!(var %in% variables)) return("variable")
  ""
}

# Devuelve al borrador las decisiones en cuarentena cuya regla volvió a existir
# en el plan reconstruido y cuya variable sigue en el instrumento. Las que no
# pasan NO se aplican: siguen en cuarentena, con el motivo anotado, porque una
# decisión que ya no se puede mostrar tampoco se puede justificar.
.limpieza_rehidratar_preservadas <- function(sid, base_nombre = NULL) {
  scope <- tryCatch(validacion_scope_get(sid, base_nombre), error = function(e) NULL)
  if (is.null(scope)) return(invisible(NULL))
  preservadas <- scope$limpieza_preservadas %||% list()
  if (!length(preservadas) || is.null(scope$evaluacion)) return(invisible(NULL))

  catalogo <- tryCatch(.limpieza_rule_catalog(scope), error = function(e) NULL)
  reglas <- if (is.data.frame(catalogo) && nrow(catalogo)) {
    as.character(catalogo$id_regla)
  } else character(0)
  # Se lee una sola vez: la rehidratación corre al terminar una auditoría.
  variables <- if (any(vapply(preservadas, function(d) {
    nzchar(as.character(d$target_variable %||% "")[1L])
  }, logical(1)))) .limpieza_variables_del_instrumento(sid, base_nombre) else character(0)

  motivos <- vapply(preservadas, .limpieza_motivo_no_rehidratable,
                    character(1), reglas = reglas, variables = variables)
  if (!any(!nzchar(motivos))) {
    validacion_scope_set(sid, base_nombre, "limpieza_preservadas",
                         unname(.limpieza_anotar_motivos(preservadas, motivos)))
    return(invisible(0L))
  }

  draft <- scope$limpieza_draft %||% list()
  ids_draft <- vapply(draft, function(d) as.character(d$id %||% ""), character(1))
  candidatas <- preservadas[!nzchar(motivos)]
  vuelven <- Filter(function(d) !(as.character(d$id %||% "") %in% ids_draft), candidatas)
  # `preservada_motivo` es de la cuarentena; lo que vuelve al borrador no lo lleva.
  vuelven <- lapply(vuelven, function(d) { d$preservada_motivo <- NULL; d })

  validacion_scope_set(sid, base_nombre, "limpieza_draft", c(draft, unname(vuelven)))
  validacion_scope_set(sid, base_nombre, "limpieza_preservadas",
                       unname(.limpieza_anotar_motivos(preservadas[nzchar(motivos)],
                                                       motivos[nzchar(motivos)])))
  invisible(length(vuelven))
}

.limpieza_anotar_motivos <- function(decisions, motivos) {
  if (!length(decisions)) return(list())
  Map(function(d, motivo) { d$preservada_motivo <- motivo; d }, decisions, motivos)
}

.limpieza_linaje_vigente <- function(sid, base_nombre = NULL) {
  s <- tryCatch(session_get(sid, required = FALSE), error = function(e) NULL)
  if (is.null(s)) return(NULL)
  nombre <- tryCatch(.resolve_base_nombre(s, base_nombre), error = function(e) NULL)
  if (is.null(nombre) || !nzchar(nombre)) return(NULL)
  linaje <- s$estudio$bases[[nombre]]$limpieza
  if (!is.list(linaje) || !length(linaje)) return(NULL)
  linaje
}

# Volver atrás es una operación de la misma cadena que promover: restituye la
# base anterior e invalida aguas abajo, porque el insumo volvió a cambiar.
limpieza_revertir_promocion <- function(sid, base_nombre = NULL) {
  if (!isTRUE(.limpieza_revertir_promocion(sid, base_nombre))) {
    stop_api(409, "E_LIMPIEZA_SIN_PROMOCION",
             "Esta base no tiene una promocion de limpieza vigente que revertir.")
  }
  .limpieza_invalidate_downstream(sid, base_nombre)
  .limpieza_linaje_vigente(sid, base_nombre)
}

.limpieza_make_case_ids <- function(df, table_key = "principal") {
  if (!is.data.frame(df) || !nrow(df)) return(character(0))

  for (cand in .limpieza_uuid_candidates()) {
    if (cand %in% names(df)) {
      ids <- as.character(df[[cand]])
      ok <- !is.na(ids) & nzchar(ids)
      if (any(ok)) {
        fallback <- sprintf("%s::row::%d", table_key, seq_len(nrow(df)))
        ids[!ok] <- fallback[!ok]
        return(ids)
      }
    }
  }

  if ("_index" %in% names(df)) {
    idx <- suppressWarnings(as.integer(df[["_index"]]))
    idx[is.na(idx)] <- seq_len(nrow(df))[is.na(idx)]
    return(sprintf("%s::idx::%d", table_key, idx))
  }

  sprintf("%s::row::%d", table_key, seq_len(nrow(df)))
}

.limpieza_cast_like <- function(value, col) {
  if (is.null(value) || (length(value) == 1L && is.na(value))) return(NA)
  if (inherits(col, "Date")) return(suppressWarnings(as.Date(value)))
  if (inherits(col, c("POSIXct", "POSIXlt", "POSIXt"))) {
    return(suppressWarnings(as.POSIXct(value, tz = "UTC")))
  }
  if (inherits(col, c("haven_labelled", "haven_labelled_spss")) || is.numeric(col)) {
    return(suppressWarnings(as.numeric(value)))
  }
  if (is.integer(col)) return(suppressWarnings(as.integer(value)))
  if (is.logical(col)) return(as.logical(value))
  as.character(value)
}

.limpieza_mode_value <- function(x) {
  vals <- x[!is.na(x) & nzchar(trimws(as.character(x)))]
  if (!length(vals)) return(NA)
  tb <- sort(table(as.character(vals)), decreasing = TRUE)
  names(tb)[1]
}

.limpieza_flatten_decisions <- function(decisions) {
  if (!length(decisions)) {
    return(tibble::tibble(
      id = character(),
      source_type = character(),
      source_id = character(),
      scope = character(),
      target_case_ids = character(),
      target_variable = character(),
      action_type = character(),
      action_label = character(),
      action_params = character(),
      rationale = character(),
      status = character(),
      created_at = character(),
      updated_at = character()
    ))
  }

  tibble::tibble(
    id = vapply(decisions, function(d) as.character(d$id %||% ""), character(1)),
    source_type = vapply(decisions, function(d) as.character(d$source_type %||% ""), character(1)),
    source_id = vapply(decisions, function(d) as.character(d$source_id %||% ""), character(1)),
    scope = vapply(decisions, function(d) as.character(d$scope %||% ""), character(1)),
    target_case_ids = vapply(decisions, function(d) paste(unlist(d$target_case_ids %||% list()), collapse = ", "), character(1)),
    target_variable = vapply(decisions, function(d) as.character(d$target_variable %||% ""), character(1)),
    action_type = vapply(decisions, function(d) as.character(d$action_type %||% ""), character(1)),
    action_label = vapply(decisions, .limpieza_summarize_decision, character(1)),
    action_params = vapply(decisions, function(d) jsonlite::toJSON(d$action_params %||% list(), auto_unbox = TRUE, null = "null"), character(1)),
    rationale = vapply(decisions, function(d) as.character(d$rationale %||% ""), character(1)),
    status = vapply(decisions, function(d) as.character(d$status %||% ""), character(1)),
    created_at = vapply(decisions, function(d) as.character(d$created_at %||% ""), character(1)),
    updated_at = vapply(decisions, function(d) as.character(d$updated_at %||% ""), character(1))
  )
}

.limpieza_infer_source_type <- function(source_id) {
  id <- as.character(source_id %||% "")
  if (grepl("^RC_", id)) "custom_rule" else "instrument_rule"
}

.limpieza_validate_decision <- function(payload) {
  allowed_source <- c("instrument_rule", "custom_rule")
  allowed_scope <- c("rule", "case_subset", "variable", "cell_subset")
  allowed_action <- c(
    "ignore_rule", "exclude_cases", "replace_value", "normalize_value",
    "impute_value", "complete_select_multiple_hierarchy",
    "set_value", "recode_map", "nullify_fields", "adjust_select_multiple"
  )
  allowed_status <- c("draft", "ready")

  source_id <- as.character(payload$source_id %||% "")
  if (!nzchar(source_id)) {
    stop_api(400, "E_LIMPIEZA_SOURCE_ID", "La decisión debe incluir source_id.")
  }
  source_type <- as.character(payload$source_type %||% .limpieza_infer_source_type(source_id))
  if (!(source_type %in% allowed_source)) {
    stop_api(400, "E_LIMPIEZA_SOURCE_TYPE", "source_type inválido.")
  }
  action_type <- as.character(payload$action_type %||% "")
  if (!(action_type %in% allowed_action)) {
    stop_api(400, "E_LIMPIEZA_ACTION", "action_type inválido.")
  }
  scope <- as.character(payload$scope %||% if (identical(action_type, "ignore_rule")) "rule" else "case_subset")
  if (!(scope %in% allowed_scope)) {
    stop_api(400, "E_LIMPIEZA_SCOPE", "scope inválido.")
  }
  status <- as.character(payload$status %||% "draft")
  if (!(status %in% allowed_status)) {
    stop_api(400, "E_LIMPIEZA_STATUS", "status inválido.")
  }

  target_case_ids <- unique(as.character(unlist(payload$target_case_ids %||% list())))
  target_case_ids <- target_case_ids[!is.na(target_case_ids) & nzchar(target_case_ids)]
  target_variable <- as.character(payload$target_variable %||% NA_character_)
  if (!nzchar(target_variable)) target_variable <- NA_character_

  action_params <- payload$action_params %||% list()
  rationale <- trimws(as.character(payload$rationale %||% ""))
  if (identical(status, "ready") && !nzchar(rationale)) {
    stop_api(400, "E_LIMPIEZA_RATIONALE", "Las decisiones listas requieren justificación.")
  }
  if (action_type %in% c("replace_value", "normalize_value", "impute_value",
                         "complete_select_multiple_hierarchy", "set_value",
                         "recode_map", "nullify_fields", "adjust_select_multiple") &&
      (is.na(target_variable) || !nzchar(target_variable))) {
    stop_api(400, "E_LIMPIEZA_TARGET_VAR", "Esta acción requiere target_variable.")
  }
  if (identical(action_type, "complete_select_multiple_hierarchy") &&
      identical(status, "ready")) {
    map <- action_params$hierarchy_map %||% action_params$map %||% NULL
    if (is.null(map) || !length(.transform_normalize_hierarchy_map(map))) {
      stop_api(
        400,
        "E_LIMPIEZA_HIERARCHY_MAP",
        "La transformación select_multiple requiere un mapa manual no vacío."
      )
    }
  }
  if (identical(action_type, "recode_map") && identical(status, "ready")) {
    map <- action_params$recode_map %||% action_params$map %||% NULL
    if (is.null(map) || !length(map)) {
      stop_api(400, "E_LIMPIEZA_RECODE_MAP", "La recodificación requiere un mapa no vacío.")
    }
  }
  if (identical(action_type, "adjust_select_multiple") && identical(status, "ready")) {
    add <- unlist(action_params$add_codes %||% list())
    rem <- unlist(action_params$remove_codes %||% list())
    if (!length(add) && !length(rem)) {
      stop_api(400, "E_LIMPIEZA_SM_ADJUST", "El ajuste select_multiple requiere códigos para agregar o quitar.")
    }
  }

  list(
    id = as.character(payload$id %||% ""),
    source_type = source_type,
    source_id = source_id,
    scope = scope,
    target_case_ids = as.list(target_case_ids),
    target_variable = target_variable,
    action_type = action_type,
    action_params = action_params,
    rationale = rationale,
    status = status
  )
}

.limpieza_upsert_decision <- function(existing, payload) {
  now <- .limpieza_now_utc()
  normalized <- .limpieza_validate_decision(payload)
  decisions <- existing %||% list()

  idx <- integer(0)
  if (nzchar(normalized$id)) {
    idx <- which(vapply(decisions, function(d) identical(as.character(d$id %||% ""), normalized$id), logical(1)))
  }

  if (length(idx)) {
    current <- decisions[[idx[1]]]
    normalized$created_at <- current$created_at %||% now
    normalized$updated_at <- now
    decisions[[idx[1]]] <- normalized
    return(list(decisions = decisions, decision = normalized))
  }

  normalized$id <- if (nzchar(normalized$id)) normalized$id else sprintf("PD_%03d", length(decisions) + 1L)
  normalized$created_at <- now
  normalized$updated_at <- now
  decisions[[length(decisions) + 1L]] <- normalized
  list(decisions = decisions, decision = normalized)
}

.limpieza_delete_decision <- function(existing, id) {
  id <- as.character(id %||% "")
  kept <- Filter(function(d) !identical(as.character(d$id %||% ""), id), existing %||% list())
  if (length(kept) == length(existing %||% list())) {
    stop_api(404, "E_LIMPIEZA_DECISION_NOT_FOUND", sprintf("No existe la decisión '%s'.", id))
  }
  kept
}

.limpieza_rule_case_map <- function(evaluacion, source_id) {
  res <- evaluacion$resumen %||% NULL
  if (is.null(res) || !nrow(res)) {
    return(list(table = "principal", flag = NA_character_, row_idx = integer(0), case_ids = character(0)))
  }
  idx <- which(as.character(res$id_regla) == as.character(source_id))[1]
  if (is.na(idx)) {
    return(list(table = "principal", flag = NA_character_, row_idx = integer(0), case_ids = character(0)))
  }
  tabla <- as.character(res$tabla[idx] %||% "principal")
  flag <- as.character(res$flag[idx] %||% NA_character_)
  df <- evaluacion$datos_tablas[[tabla]] %||% evaluacion$datos
  if (!is.data.frame(df) || !nzchar(flag) || !(flag %in% names(df))) {
    return(list(table = tabla, flag = flag, row_idx = integer(0), case_ids = character(0)))
  }
  mask <- df[[flag]]
  mask[is.na(mask)] <- FALSE
  idx_rows <- which(mask)
  list(
    table = tabla,
    flag = flag,
    row_idx = idx_rows,
    case_ids = .limpieza_make_case_ids(df, tabla)[idx_rows]
  )
}

.limpieza_rule_catalog <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen) || !nrow(ev$resumen)) return(tibble::tibble())

  res <- ev$resumen
  meta <- ev$reglas_meta %||% tibble::tibble(id_regla = character())
  if (!"tabla" %in% names(res)) res$tabla <- "principal"
  if (!"tabla" %in% names(meta)) meta$tabla <- "principal"
  if (!"nombre_regla" %in% names(meta)) meta$nombre_regla <- NA_character_
  catalog <- dplyr::left_join(res, meta, by = c("id_regla", "nombre_regla", "tabla"))

  # Garantizar que las columnas que el resto de la función usa con
  # `catalog$col` existan, aunque el evaluación haya producido un
  # resumen sin ellas (ej. cuando no hay reglas que las pueblen).
  # Evita los warnings "Unknown or uninitialised column" ruidosos que
  # contaminaban el log al arrancar.
  .expected_cols <- c(
    "variable_1", "variable_2", "variable_3",
    "variable_1_etiqueta", "variable_2_etiqueta", "variable_3_etiqueta",
    "categoria", "tipo_observacion", "seccion", "tipo_variable",
    "objetivo", "nombre_tecnico", "procesamiento"
  )
  for (.c in .expected_cols) {
    if (!(.c %in% names(catalog))) catalog[[.c]] <- NA_character_
  }
  if (!"porcentaje" %in% names(catalog)) catalog$porcentaje <- NA_real_

  catalog$source_type <- vapply(catalog$id_regla, .limpieza_infer_source_type, character(1))
  catalog$origen <- ifelse(catalog$source_type == "custom_rule", "Personalizada", "Automática")

  custom_ids <- vapply(scope$reglas_custom %||% list(), function(r) as.character(r$id %||% ""), character(1))
  sev_map <- setNames(
    vapply(scope$reglas_custom %||% list(), function(r) as.character(r$severidad %||% "info"), character(1)),
    custom_ids
  )
  kind_map <- setNames(
    vapply(scope$reglas_custom %||% list(), function(r) as.character(r$hallazgo_kind %||% "caso_validar"), character(1)),
    custom_ids
  )
  action_map <- setNames(
    vapply(scope$reglas_custom %||% list(), function(r) {
      if (exists(".regla_tratamiento", mode = "function")) {
        as.character(.regla_tratamiento(r))
      } else {
        as.character(r$planned_action_type %||% r$params$planned_action_type %||% "")
      }
    }, character(1)),
    custom_ids
  )
  scope_map <- setNames(
    vapply(scope$reglas_custom %||% list(), function(r) {
      if (exists(".regla_alcance_tratamiento", mode = "function")) {
        as.character(.regla_alcance_tratamiento(r))
      } else {
        as.character(r$recommended_scope %||% r$params$recommended_scope %||% "")
      }
    }, character(1)),
    custom_ids
  )
  params_map <- setNames(
    lapply(scope$reglas_custom %||% list(), function(r) r$params %||% list()),
    custom_ids
  )
  catalog$hallazgo_kind <- vapply(catalog$id_regla, function(rid) {
    rid <- as.character(rid %||% "")
    if (rid %in% names(kind_map)) unname(kind_map[[rid]]) else "inconsistencia_xlsform"
  }, character(1))
  catalog$planned_action_type <- vapply(catalog$id_regla, function(rid) {
    rid <- as.character(rid %||% "")
    if (rid %in% names(action_map)) unname(action_map[[rid]]) else ""
  }, character(1))
  catalog$recommended_scope <- vapply(catalog$id_regla, function(rid) {
    rid <- as.character(rid %||% "")
    if (rid %in% names(scope_map)) unname(scope_map[[rid]]) else ""
  }, character(1))
  catalog$planned_action_params <- lapply(catalog$id_regla, function(rid) {
    rid <- as.character(rid %||% "")
    if (rid %in% names(params_map)) params_map[[rid]] else list()
  })
  catalog$origen_detalle <- ifelse(
    catalog$source_type == "custom_rule",
    ifelse(catalog$hallazgo_kind == "caso_validar",
           "Personalizada: caso a validar",
           "Personalizada: inconsistencia definida"),
    "XLSForm"
  )

  catalog$severidad <- vapply(seq_len(nrow(catalog)), function(i) {
    rid <- as.character(catalog$id_regla[i])
    if (rid %in% names(sev_map)) return(unname(sev_map[[rid]]))
    pct <- suppressWarnings(as.numeric(catalog$porcentaje[i] %||% 0))
    if (is.finite(pct) && pct >= 0.20) return("error")
    if (is.finite(pct) && pct > 0) return("advertencia")
    "info"
  }, character(1))

  catalog$variables <- lapply(seq_len(nrow(catalog)), function(i) {
    vars <- c(
      as.character(catalog$variable_1[i] %||% NA),
      as.character(catalog$variable_2[i] %||% NA),
      as.character(catalog$variable_3[i] %||% NA)
    )
    as.list(vars[!is.na(vars) & nzchar(vars)])
  })

  # --- Taxonomía tipada (contrato nuevo) --------------------------------
  # Agregamos tipo_regla (técnico, enum cerrado), categoria_ux (etiqueta
  # legible), fuente (instrumento|custom), tipo_variable (renombra el
  # ambiguo tipo_observacion). Los campos legacy (categoria, origen,
  # tipo_observacion) se mantienen para compatibilidad con código existente.
  catalog$fuente <- if ("fuente" %in% names(catalog)) {
    as.character(catalog$fuente %||% ifelse(catalog$source_type == "custom_rule", "custom", "instrumento"))
  } else {
    ifelse(catalog$source_type == "custom_rule", "custom", "instrumento")
  }
  catalog$tipo_variable <- if ("tipo_variable" %in% names(catalog)) {
    as.character(catalog$tipo_variable %||% catalog$tipo_observacion %||% NA_character_)
  } else {
    as.character(catalog$tipo_observacion %||% NA_character_)
  }
  catalog$tipo_regla <- if ("tipo_regla" %in% names(catalog)) {
    out <- as.character(catalog$tipo_regla %||% NA_character_)
    miss <- is.na(out) | !nzchar(out)
    if (any(miss)) {
      out[miss] <- vapply(which(miss),
                          function(i) .limpieza_infer_tipo_regla(catalog, i),
                          character(1))
    }
    out
  } else {
    vapply(seq_len(nrow(catalog)),
           function(i) .limpieza_infer_tipo_regla(catalog, i),
           character(1))
  }
  catalog$categoria_ux <- if ("categoria_ux" %in% names(catalog)) {
    out <- as.character(catalog$categoria_ux %||% NA_character_)
    miss <- is.na(out) | !nzchar(out)
    if (any(miss)) out[miss] <- vapply(catalog$tipo_regla[miss], .limpieza_categoria_ux_label, character(1))
    out
  } else {
    vapply(catalog$tipo_regla, .limpieza_categoria_ux_label, character(1))
  }

  catalog
}

# Mapea taxonomía legacy → tipo_regla tipado.
.limpieza_infer_tipo_regla <- function(catalog, i) {
  rid <- as.character(catalog$id_regla[i] %||% "")
  nombre <- as.character(catalog$nombre_regla[i] %||% "")
  cat_legacy <- as.character(catalog$categoria[i] %||% "")
  # 1. Prefijos del rule_factory heredado:
  if (startsWith(nombre, "req_")) return("required")
  if (startsWith(nombre, "salto_")) return("skip")
  if (startsWith(nombre, "calc_")) return("calculate_check")
  if (startsWith(nombre, "cons_") && grepl("_cf_", nombre, fixed = TRUE)) return("constraint")
  if (startsWith(nombre, "cons_") && grepl("_ventana_fecha", nombre, fixed = TRUE)) return("range")
  if (startsWith(nombre, "cons_") && grepl("_repeat", nombre, fixed = TRUE)) return("repeat_length")
  if (startsWith(nombre, "cons_")) return("constraint")
  # 2. Reglas custom (RC_*): deriva del campo Tipo del plan si es "custom:*".
  if (startsWith(rid, "RC_") || startsWith(nombre, "rc_")) {
    # El compilador custom pone Tipo = "custom:<subtipo>"; tipo_observacion
    # puede traer ese string.
    tv <- as.character(catalog$tipo_observacion[i] %||% "")
    if (startsWith(tv, "custom:")) {
      sub <- sub("^custom:", "", tv)
      return(switch(sub,
        "no_nulo"        = "required",
        "rango_num"      = "range",
        "rango_fecha"    = "range",
        "outliers_iqr"   = "outlier",
        "outliers_z"     = "outlier",
        "duplicados"     = "duplicate",
        "fuera_catalogo" = "catalog",
        "coherencia_2v"  = "coherence",
        "select_multiple_hierarchy" = "select_multiple_cardinality",
        "coherence"
      ))
    }
    return("coherence")
  }
  # 3. Fallback por categoria legacy
  switch(cat_legacy,
    "Preguntas de control"  = "required",
    "Saltos de preguntas"   = "skip",
    "Consistencia"          = "constraint",
    "Filtro de opciones"    = "constraint",
    "Valores calculados"    = "calculate_check",
    "Valores atípicos"      = "outlier",
    "Registros repetidos"   = "repeat_length",
    "constraint"
  )
}

# Etiqueta legible (sin tecnicismos) — lo que la UI muestra al usuario.
.limpieza_categoria_ux_label <- function(tipo_regla) {
  switch(as.character(tipo_regla),
    "required"         = "Completitud",
    "skip"             = "Saltos del formulario",
    "constraint"       = "Consistencia lógica",
    "range"            = "Rangos",
    "catalog"          = "Valores de catálogo",
    "outlier"          = "Outliers",
    "duplicate"        = "Duplicados",
    "coherence"        = "Coherencia entre variables",
    "select_multiple_cardinality" = "Cardinalidad",
    "pattern"          = "Patrones sospechosos",
    "calculate_check"  = "Cálculos",
    "repeat_length"    = "Estructura de repeats",
    "odk_raw"          = "Expresión experta",
    "Otras"
  )
}

.limpieza_summarize_decision <- function(decision) {
  if (is.null(decision)) return(NA_character_)
  map <- c(
    ignore_rule = "Registrar sin cambios",
    exclude_cases = "Excluir registros",
    replace_value = "Corregir valor",
    normalize_value = "Corregir valor",
    impute_value = "Corregir valor",
    set_value = "Asignar valor fijo",
    recode_map = "Recodificar equivalencias",
    nullify_fields = "Anular campos",
    complete_select_multiple_hierarchy = "Completar selección múltiple",
    adjust_select_multiple = "Agregar o quitar opciones"
  )
  label <- unname(map[decision$action_type %||% ""])
  if (is.na(label) || !nzchar(label)) label <- "Decisión"
  if (!is.null(decision$target_variable) && !is.na(decision$target_variable) && nzchar(decision$target_variable)) {
    paste(label, "·", as.character(decision$target_variable))
  } else {
    label
  }
}

.limpieza_decision_coverage <- function(scope, source_id, ready_hits, n_casos) {
  total <- as.integer(n_casos %||% 0L)
  if (!length(ready_hits) || total <= 0L) {
    return(list(covered = 0L, pending = max(0L, total), covers_all = FALSE))
  }

  has_global <- any(vapply(ready_hits, function(d) {
    ids <- unlist(d$target_case_ids %||% list())
    !length(ids)
  }, logical(1)))
  if (isTRUE(has_global)) {
    return(list(covered = total, pending = 0L, covers_all = TRUE))
  }

  explicit_ids <- unique(as.character(unlist(lapply(
    ready_hits,
    function(d) d$target_case_ids %||% list()
  ))))
  explicit_ids <- explicit_ids[!is.na(explicit_ids) & nzchar(explicit_ids)]

  case_ids <- .limpieza_rule_case_map(scope$evaluacion, source_id)$case_ids
  case_ids <- unique(as.character(case_ids %||% character(0)))
  case_ids <- case_ids[!is.na(case_ids) & nzchar(case_ids)]

  covered <- if (length(case_ids)) {
    sum(case_ids %in% explicit_ids)
  } else {
    min(total, length(explicit_ids))
  }
  covered <- as.integer(max(0L, min(total, covered)))
  list(
    covered = covered,
    pending = as.integer(max(0L, total - covered)),
    covers_all = covered >= total
  )
}

.limpieza_build_decision_queue <- function(scope, decisions = NULL) {
  catalog <- .limpieza_rule_catalog(scope)
  if (!nrow(catalog)) return(list())

  # Solo reglas con ≥1 caso observado: la cola es para resolver
  # inconsistencias reales, no reglas "correctas" o sin evaluación.
  mask <- as.integer(catalog$n_inconsistencias %||% 0) > 0L
  mask[is.na(mask)] <- FALSE
  catalog <- catalog[mask, , drop = FALSE]
  if (!nrow(catalog)) return(list())

  decisions <- decisions %||% list()
  queue <- lapply(seq_len(nrow(catalog)), function(i) {
    rid <- as.character(catalog$id_regla[i])
    hits <- Filter(function(d) identical(as.character(d$source_id %||% ""), rid), decisions)
    ready_hits <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), hits)
    current <- if (length(ready_hits)) ready_hits[[length(ready_hits)]] else NULL
    n_casos <- as.integer(catalog$n_inconsistencias[i] %||% 0L)
    coverage <- .limpieza_decision_coverage(scope, rid, ready_hits, n_casos)
    vars <- unlist(catalog$variables[[i]] %||% list())
    list(
      # --- Legacy (compatibilidad) ---
      source_type = as.character(catalog$source_type[i] %||% "instrument_rule"),
      source_id = rid,
      origen = as.character(catalog$origen[i] %||% "Automática"),
      nombre_regla = as.character(catalog$nombre_regla[i] %||% rid),
      seccion = as.character(catalog$seccion[i] %||% NA_character_),
      categoria = as.character(catalog$categoria[i] %||% NA_character_),
      tipo_observacion = as.character(catalog$tipo_observacion[i] %||% NA_character_),
      # --- Taxonomía tipada nueva (contrato v3) ---
      tipo_regla = as.character(catalog$tipo_regla[i] %||% "constraint"),
      categoria_ux = as.character(catalog$categoria_ux[i] %||% "Consistencia lógica"),
      fuente = as.character(catalog$fuente[i] %||% "instrumento"),
      tipo_variable = as.character(catalog$tipo_variable[i] %||% NA_character_),
      hallazgo_kind = as.character(catalog$hallazgo_kind[i] %||% "inconsistencia_xlsform"),
      origen_detalle = as.character(catalog$origen_detalle[i] %||% catalog$origen[i] %||% "XLSForm"),
      # --- Resto ---
      severidad = as.character(catalog$severidad[i] %||% "info"),
      variables = as.list(vars),
      n_casos = n_casos,
      n_casos_cubiertos = as.integer(coverage$covered %||% 0L),
      n_casos_pendientes = as.integer(coverage$pending %||% n_casos),
      porcentaje = as.numeric(catalog$porcentaje[i] %||% NA_real_),
      decision_count = length(hits),
      current_action = if (is.null(current)) NA_character_ else .limpieza_summarize_decision(current),
      pending = !isTRUE(coverage$covers_all),
      impact_expected = if (length(ready_hits) == 0L) {
        "Pendiente de decisión final"
      } else if (!isTRUE(coverage$covers_all)) {
        sprintf("%d de %d caso(s) con decisión lista", coverage$covered, n_casos)
      } else {
        sprintf("%d decisión(es) lista(s) para aplicar", length(ready_hits))
      },
      planned_action_type = as.character(catalog$planned_action_type[i] %||% ""),
      recommended_scope = as.character(catalog$recommended_scope[i] %||% ""),
      planned_action_params = catalog$planned_action_params[[i]] %||% list()
    )
  })

  ord_pending <- vapply(queue, function(x) isTRUE(x$pending), logical(1))
  ord_cases <- vapply(queue, function(x) as.integer(x$n_casos %||% 0L), integer(1))
  queue[order(!ord_pending, -ord_cases)]
}

.limpieza_effective_plan <- function(scope, inst = NULL, decisions = NULL) {
  plan_inst <- scope$plan_result$plan %||% NULL
  desactivadas <- scope$reglas_desactivadas %||% character(0)
  if (!is.null(plan_inst) && length(desactivadas)) {
    id_col <- if ("ID" %in% names(plan_inst)) "ID" else if ("id_regla" %in% names(plan_inst)) "id_regla" else NULL
    if (!is.null(id_col)) {
      plan_inst <- plan_inst[!(as.character(plan_inst[[id_col]]) %in% desactivadas), , drop = FALSE]
    }
  }

  activas <- Filter(function(r) isTRUE(r$activa), scope$reglas_custom %||% list())
  plan_custom <- if (length(activas)) compile_reglas_custom(activas, instrumento = inst) else NULL

  plan_final <- if (!is.null(plan_inst) && nrow(plan_inst) > 0L && !is.null(plan_custom) && nrow(plan_custom) > 0L) {
    dplyr::bind_rows(plan_inst, plan_custom)
  } else if (!is.null(plan_inst) && nrow(plan_inst) > 0L) {
    plan_inst
  } else {
    plan_custom
  }

  decisions <- decisions %||% list()
  ignored_rules <- unique(vapply(Filter(function(d) identical(d$status %||% "", "ready") && identical(d$action_type %||% "", "ignore_rule"), decisions), function(d) as.character(d$source_id %||% ""), character(1)))
  if (length(ignored_rules) && !is.null(plan_final) && nrow(plan_final)) {
    id_col <- if ("ID" %in% names(plan_final)) "ID" else if ("id_regla" %in% names(plan_final)) "id_regla" else NULL
    if (!is.null(id_col)) {
      plan_final <- plan_final[!(as.character(plan_final[[id_col]]) %in% ignored_rules), , drop = FALSE]
    }
  }

  plan_final
}

.limpieza_target_case_ids <- function(decision, scope) {
  explicit_ids <- unique(as.character(unlist(decision$target_case_ids %||% list())))
  explicit_ids <- explicit_ids[!is.na(explicit_ids) & nzchar(explicit_ids)]
  if (length(explicit_ids)) return(explicit_ids)
  .limpieza_rule_case_map(scope$evaluacion, decision$source_id)$case_ids
}

.limpieza_apply_decisions_to_data <- function(df, scope, decisions, inst = NULL) {
  if (!is.data.frame(df)) {
    return(list(
      data = df,
      excluded_cases = tibble::tibble(),
      replacements = tibble::tibble(),
      imputations = tibble::tibble(),
      transformations = tibble::tibble(),
      warnings = character(0),
      trace = tibble::tibble(),
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L, transformations = 0L)
    ))
  }

  table_key <- "principal"
  data_out <- tibble::as_tibble(df)
  data_out$`.__case_id__` <- .limpieza_make_case_ids(data_out, table_key)

  ready <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), decisions %||% list())
  if (!length(ready)) {
    return(list(
      data = dplyr::select(data_out, -dplyr::all_of(".__case_id__")),
      excluded_cases = tibble::tibble(),
      replacements = tibble::tibble(),
      imputations = tibble::tibble(),
      transformations = tibble::tibble(),
      warnings = character(0),
      trace = tibble::tibble(),
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L, transformations = 0L)
    ))
  }

  exclude_decisions <- Filter(function(d) identical(d$action_type %||% "", "exclude_cases"), ready)
  excluded_case_ids <- unique(unlist(lapply(exclude_decisions, .limpieza_target_case_ids, scope = scope)))
  excluded_case_ids <- excluded_case_ids[!is.na(excluded_case_ids) & nzchar(excluded_case_ids)]

  excluded_cases_df <- if (length(exclude_decisions)) {
    dplyr::bind_rows(lapply(exclude_decisions, function(d) {
      ids <- .limpieza_target_case_ids(d, scope)
      tibble::tibble(
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        case_id = ids,
        rationale = as.character(d$rationale %||% "")
      )
    }))
  } else tibble::tibble()

  if (length(excluded_case_ids)) {
    data_out <- data_out[!(data_out$`.__case_id__` %in% excluded_case_ids), , drop = FALSE]
  }

  replacements_log <- list()
  imputations_log <- list()
  transformations_log <- list()
  trace_rows <- list()
  warning_rows <- character(0)
  changed_replacements <- 0L
  changed_normalizations <- 0L
  changed_imputations <- 0L
  changed_transformations <- 0L

  mutate_decisions <- Filter(function(d) {
    d$action_type %in% .LIMPIEZA_ACCIONES_SOBRE_VARIABLE
  }, ready)
  for (d in mutate_decisions) {
    var <- as.character(d$target_variable %||% "")
    if (!nzchar(var)) next

    target_ids <- .limpieza_target_case_ids(d, scope)
    row_mask <- if (length(target_ids)) data_out$`.__case_id__` %in% target_ids else rep(TRUE, nrow(data_out))
    if (!any(row_mask)) next

    if (identical(d$action_type, "complete_select_multiple_hierarchy")) {
      hierarchy_map <- d$action_params$hierarchy_map %||% d$action_params$map %||% list()
      transformed <- complete_select_multiple_hierarchy(
        data = data_out,
        target_variable = var,
        hierarchy_map = hierarchy_map,
        rows = row_mask,
        instrumento = inst,
        case_ids = data_out$`.__case_id__`,
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        rationale = as.character(d$rationale %||% "")
      )
      data_out <- transformed$data
      trace <- transformed$trace %||% tibble::tibble()
      if (nrow(trace)) {
        transformations_log[[length(transformations_log) + 1L]] <- trace
        trace_rows[[length(trace_rows) + 1L]] <- trace
      }
      warning_rows <- c(warning_rows, transformed$warnings %||% character(0))
      changed_transformations <- changed_transformations + as.integer(transformed$impact$cells_changed %||% 0L)
      next
    }

    if (identical(d$action_type, "adjust_select_multiple")) {
      transformed <- adjust_select_multiple_values(
        data = data_out,
        target_variable = var,
        add_codes = unlist(d$action_params$add_codes %||% list()),
        remove_codes = unlist(d$action_params$remove_codes %||% list()),
        rows = row_mask,
        instrumento = inst,
        case_ids = data_out$`.__case_id__`,
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        rationale = as.character(d$rationale %||% "")
      )
      data_out <- transformed$data
      trace <- transformed$trace %||% tibble::tibble()
      if (nrow(trace)) {
        transformations_log[[length(transformations_log) + 1L]] <- trace
        trace_rows[[length(trace_rows) + 1L]] <- trace
      }
      warning_rows <- c(warning_rows, transformed$warnings %||% character(0))
      changed_transformations <- changed_transformations + as.integer(transformed$impact$cells_changed %||% 0L)
      next
    }

    if (identical(d$action_type, "nullify_fields")) {
      vars_to_null <- unique(c(var, as.character(unlist(d$action_params$target_variables %||% list()))))
      vars_to_null <- vars_to_null[!is.na(vars_to_null) & nzchar(vars_to_null) & vars_to_null %in% names(data_out)]
      if (!length(vars_to_null)) next
      log_rows <- list()
      for (vnull in vars_to_null) {
        col0 <- data_out[[vnull]]
        edit_mask <- row_mask & !is.na(col0) & nzchar(as.character(col0))
        if (!any(edit_mask)) next
        data_out[[vnull]][edit_mask] <- .limpieza_cast_like(NA, col0)
        log_rows[[length(log_rows) + 1L]] <- tibble::tibble(
          decision_id = as.character(d$id %||% ""),
          source_id = as.character(d$source_id %||% ""),
          target_variable = vnull,
          action_type = "nullify_fields",
          from_value = "VARIOS",
          to_value = "",
          n_celdas = as.integer(sum(edit_mask)),
          rationale = as.character(d$rationale %||% "")
        )
        changed_transformations <- changed_transformations + as.integer(sum(edit_mask))
      }
      if (length(log_rows)) {
        rows <- dplyr::bind_rows(log_rows)
        transformations_log[[length(transformations_log) + 1L]] <- rows
        trace_rows[[length(trace_rows) + 1L]] <- rows
      }
      next
    }

    if (!(var %in% names(data_out))) next

    col <- data_out[[var]]
    current_chr <- as.character(col)

    if (identical(d$action_type, "set_value")) {
      new_value <- d$action_params$value %||% d$action_params$fixed_value %||% NA
      if (length(new_value) == 0L || (length(new_value) == 1L && is.na(new_value))) next
      edit_mask <- row_mask
      old_values <- current_chr[edit_mask]
      data_out[[var]][edit_mask] <- .limpieza_cast_like(new_value, col)
      n_changed <- sum(edit_mask)
      row <- tibble::tibble(
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        target_variable = var,
        action_type = "set_value",
        from_value = "VARIOS",
        to_value = as.character(new_value),
        n_celdas = as.integer(n_changed),
        rationale = as.character(d$rationale %||% "")
      )
      replacements_log[[length(replacements_log) + 1L]] <- row
      trace_rows[[length(trace_rows) + 1L]] <- row
      changed_replacements <- changed_replacements + as.integer(n_changed)
      next
    }

    if (identical(d$action_type, "recode_map")) {
      recode_map <- d$action_params$recode_map %||% d$action_params$map %||% list()
      if (!length(recode_map)) next
      map_names <- names(recode_map)
      if (is.null(map_names)) next
      edit_mask <- row_mask & current_chr %in% map_names
      if (!any(edit_mask)) next
      new_values <- vapply(current_chr[edit_mask], function(v) as.character(recode_map[[v]] %||% NA_character_), character(1))
      data_out[[var]][edit_mask] <- .limpieza_cast_like(new_values, col)
      n_changed <- sum(edit_mask)
      row <- tibble::tibble(
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        target_variable = var,
        action_type = "recode_map",
        from_value = paste(map_names, collapse = ", "),
        to_value = jsonlite::toJSON(recode_map, auto_unbox = TRUE),
        n_celdas = as.integer(n_changed),
        rationale = as.character(d$rationale %||% "")
      )
      replacements_log[[length(replacements_log) + 1L]] <- row
      trace_rows[[length(trace_rows) + 1L]] <- row
      changed_replacements <- changed_replacements + as.integer(n_changed)
      next
    }

    if (identical(d$action_type, "replace_value") || identical(d$action_type, "normalize_value")) {
      from_value <- as.character(d$action_params$from_value %||% "")
      to_value <- d$action_params$to_value %||% d$action_params$normalized_value %||% NA
      edit_mask <- row_mask
      if (nzchar(from_value)) edit_mask <- edit_mask & current_chr == from_value
      if (!any(edit_mask)) next

      old_values <- current_chr[edit_mask]
      data_out[[var]][edit_mask] <- .limpieza_cast_like(to_value, col)
      n_changed <- sum(edit_mask)
      row <- tibble::tibble(
        decision_id = as.character(d$id %||% ""),
        source_id = as.character(d$source_id %||% ""),
        target_variable = var,
        action_type = as.character(d$action_type %||% ""),
        from_value = from_value,
        to_value = as.character(to_value %||% ""),
        n_celdas = as.integer(n_changed),
        rationale = as.character(d$rationale %||% "")
      )
      replacements_log[[length(replacements_log) + 1L]] <- row
      trace_rows[[length(trace_rows) + 1L]] <- row
      if (identical(d$action_type, "replace_value")) {
        changed_replacements <- changed_replacements + as.integer(n_changed)
      } else {
        changed_normalizations <- changed_normalizations + as.integer(n_changed)
      }
      next
    }

    method <- as.character(d$action_params$method %||% "fixed")
    new_value <- if (identical(method, "median")) {
      suppressWarnings(stats::median(as.numeric(col), na.rm = TRUE))
    } else if (identical(method, "mode")) {
      .limpieza_mode_value(col)
    } else {
      d$action_params$fixed_value %||% d$action_params$value %||% NA
    }
    if (length(new_value) == 0L || (length(new_value) == 1L && is.na(new_value))) next

    data_out[[var]][row_mask] <- .limpieza_cast_like(new_value, col)
    n_changed <- sum(row_mask)
    row <- tibble::tibble(
      decision_id = as.character(d$id %||% ""),
      source_id = as.character(d$source_id %||% ""),
      target_variable = var,
      action_type = "impute_value",
      method = method,
      value = as.character(new_value),
      n_celdas = as.integer(n_changed),
      rationale = as.character(d$rationale %||% "")
    )
    imputations_log[[length(imputations_log) + 1L]] <- row
    trace_rows[[length(trace_rows) + 1L]] <- row
    changed_imputations <- changed_imputations + as.integer(n_changed)
  }

  list(
    data = dplyr::select(data_out, -dplyr::all_of(".__case_id__")),
    excluded_cases = if (length(excluded_cases_df)) excluded_cases_df else tibble::tibble(),
    replacements = if (length(replacements_log)) dplyr::bind_rows(replacements_log) else tibble::tibble(),
    imputations = if (length(imputations_log)) dplyr::bind_rows(imputations_log) else tibble::tibble(),
    transformations = if (length(transformations_log)) dplyr::bind_rows(transformations_log) else tibble::tibble(),
    warnings = unique(warning_rows),
    trace = if (length(trace_rows)) dplyr::bind_rows(trace_rows) else tibble::tibble(),
    impact = list(
      cases_excluded = as.integer(length(unique(excluded_case_ids))),
      cells_changed = as.integer(changed_replacements + changed_normalizations + changed_imputations + changed_transformations),
      replacements = as.integer(changed_replacements),
      normalizations = as.integer(changed_normalizations),
      imputations = as.integer(changed_imputations),
      transformations = as.integer(changed_transformations)
    )
  )
}

.limpieza_before_metrics <- function(scope) {
  ev <- scope$evaluacion
  if (is.null(ev) || is.null(ev$resumen)) {
    return(list(
      total_inconsistencias = 0L,
      reglas_con_casos = 0L,
      reglas_total = 0L,
      filas_base = 0L
    ))
  }
  res <- ev$resumen
  total_raw <- tryCatch(total_inconsistencias(ev), error = function(e) NULL)
  total <- if (is.numeric(total_raw) && length(total_raw) == 1L) {
    as.integer(total_raw)
  } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
    as.integer(total_raw$cabecera$Total_inconsistencias[1] %||% 0L)
  } else 0L
  list(
    total_inconsistencias = total,
    reglas_con_casos = as.integer(sum(as.integer(res$n_inconsistencias %||% 0L) > 0L, na.rm = TRUE)),
    reglas_total = as.integer(nrow(res)),
    filas_base = as.integer(nrow(ev$datos %||% tibble::tibble()))
  )
}

.limpieza_simulate <- function(sid, base_nombre, scope, decisions = NULL) {
  before <- .limpieza_before_metrics(scope)
  ready <- Filter(function(d) identical(as.character(d$status %||% ""), "ready"), decisions %||% list())
  if (is.null(scope$evaluacion)) {
    return(list(
      before = before,
      after = before,
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L, transformations = 0L, rules_resolved = 0L),
      residual_final = list(),
      decisions_ready = length(ready),
      data_final = NULL,
      evaluacion_final = NULL,
      logs = list(excluded_cases = tibble::tibble(), replacements = tibble::tibble(), imputations = tibble::tibble(), transformations = tibble::tibble(), trace = tibble::tibble(), warnings = character(0))
    ))
  }
  if (!length(ready)) {
    return(list(
      before = before,
      after = before,
      impact = list(cases_excluded = 0L, cells_changed = 0L, replacements = 0L, normalizations = 0L, imputations = 0L, transformations = 0L, rules_resolved = 0L),
      residual_final = if (!is.null(scope$evaluacion$resumen)) .plan_rows_preview(utils::head(scope$evaluacion$resumen, 500L), n = 500L) else list(),
      decisions_ready = 0L,
      data_final = NULL,
      evaluacion_final = scope$evaluacion,
      logs = list(excluded_cases = tibble::tibble(), replacements = tibble::tibble(), imputations = tibble::tibble(), transformations = tibble::tibble(), trace = tibble::tibble(), warnings = character(0))
    ))
  }

  files <- .resolve_base_files(sid, base_nombre)
  inst <- leer_xlsform_limpieza(files$xlsform$path, verbose = FALSE)
  data_raw <- read_validation_data_ast(
    path = files$data$path,
    ext = files$data_ext,
    instrumento = inst
  )$principal
  apply_out <- .limpieza_apply_decisions_to_data(data_raw, scope, ready, inst = inst)
  plan_final <- .limpieza_effective_plan(scope, inst = inst, decisions = ready)

  ev_after <- if (!is.null(plan_final) && nrow(plan_final) > 0L) {
    evaluar_consistencia(
      datos = apply_out$data,
      plan = plan_final,
      contar_na_como_inconsistencia = FALSE
    )
  } else NULL

  after <- if (is.null(ev_after)) {
    list(
      total_inconsistencias = 0L,
      reglas_con_casos = 0L,
      reglas_total = 0L,
      filas_base = as.integer(nrow(apply_out$data %||% tibble::tibble()))
    )
  } else {
    total_raw <- tryCatch(total_inconsistencias(ev_after), error = function(e) NULL)
    total <- if (is.numeric(total_raw) && length(total_raw) == 1L) {
      as.integer(total_raw)
    } else if (is.list(total_raw) && !is.null(total_raw$cabecera)) {
      as.integer(total_raw$cabecera$Total_inconsistencias[1] %||% 0L)
    } else 0L
    list(
      total_inconsistencias = total,
      reglas_con_casos = as.integer(sum(as.integer(ev_after$resumen$n_inconsistencias %||% 0L) > 0L, na.rm = TRUE)),
      reglas_total = as.integer(nrow(ev_after$resumen %||% tibble::tibble())),
      filas_base = as.integer(nrow(apply_out$data %||% tibble::tibble()))
    )
  }

  impact <- apply_out$impact
  impact$rules_resolved <- as.integer(max(0L, before$reglas_con_casos - after$reglas_con_casos))

  list(
    before = before,
    after = after,
    impact = impact,
    residual_final = if (!is.null(ev_after) && !is.null(ev_after$resumen)) .plan_rows_preview(utils::head(ev_after$resumen, 500L), n = 500L) else list(),
    decisions_ready = length(ready),
    data_final = apply_out$data,
    evaluacion_final = ev_after,
    logs = list(
      excluded_cases = apply_out$excluded_cases,
      replacements = apply_out$replacements,
      imputations = apply_out$imputations,
      transformations = apply_out$transformations,
      trace = apply_out$trace,
      warnings = apply_out$warnings
    )
  )
}

.limpieza_build_module_stats <- function(decisions, queue, preview = NULL) {
  decisions <- decisions %||% list()
  count_action <- function(actions) {
    sum(vapply(decisions, function(d) as.character(d$action_type %||% "") %in% actions && identical(as.character(d$status %||% ""), "ready"), logical(1)))
  }
  list(
    limpieza = list(
      decisiones = as.integer(count_action(c("ignore_rule", "exclude_cases"))),
      casos_excluidos = as.integer(preview$impact$cases_excluded %||% 0L)
    ),
    reemplazo = list(
      decisiones = as.integer(count_action(c("replace_value", "normalize_value", "set_value", "recode_map"))),
      celdas = as.integer((preview$impact$replacements %||% 0L) + (preview$impact$normalizations %||% 0L))
    ),
    imputacion = list(
      decisiones = as.integer(count_action("impute_value")),
      celdas = as.integer(preview$impact$imputations %||% 0L)
    ),
    transformacion = list(
      decisiones = as.integer(count_action(c("complete_select_multiple_hierarchy", "adjust_select_multiple", "nullify_fields"))),
      celdas = as.integer(preview$impact$transformations %||% 0L)
    ),
    decision_maker = list(
      pendientes = as.integer(sum(vapply(queue %||% list(), function(x) isTRUE(x$pending), logical(1)))),
      listas = as.integer(sum(vapply(decisions, function(d) identical(as.character(d$status %||% ""), "ready"), logical(1))))
    )
  )
}

.limpieza_build_summary <- function(scope, queue, decisions, preview = NULL) {
  queue <- queue %||% list()
  decisions <- decisions %||% list()
  catalog <- .limpieza_rule_catalog(scope)
  pending_count <- as.integer(sum(vapply(queue, function(x) isTRUE(x$pending), logical(1))))
  list(
    total_reglas_con_casos = as.integer(length(queue)),
    total_reglas_automaticas = as.integer(sum(vapply(queue, function(x) identical(x$source_type %||% "", "instrument_rule"), logical(1)))),
    total_reglas_custom = as.integer(sum(vapply(queue, function(x) identical(x$source_type %||% "", "custom_rule"), logical(1)))),
    total_casos_afectados = as.integer(preview$before$total_inconsistencias %||% 0L),
    total_decisiones = as.integer(length(decisions)),
    decisiones_listas = as.integer(sum(vapply(decisions, function(d) identical(as.character(d$status %||% ""), "ready"), logical(1)))),
    pendientes = pending_count,
    total_casos_excluidos = as.integer(preview$impact$cases_excluded %||% 0L),
    total_celdas_corregidas = as.integer(preview$impact$cells_changed %||% 0L),
    total_reemplazos = as.integer((preview$impact$replacements %||% 0L) + (preview$impact$normalizations %||% 0L)),
    total_imputaciones = as.integer(preview$impact$imputations %||% 0L),
    total_transformaciones = as.integer(preview$impact$transformations %||% 0L),
    ready_to_finalize = isTRUE(!is.null(scope$evaluacion) && pending_count == 0L)
  )
}

.limpieza_export_excel <- function(path, summary, decisions, preview) {
  wb <- openxlsx::createWorkbook(creator = "prosecnur")
  st_head <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")

  excel_safe_table <- function(df) {
    df <- tibble::as_tibble(df)
    list_cols <- vapply(df, is.list, logical(1))
    if (!any(list_cols)) return(df)
    df[list_cols] <- lapply(df[list_cols], function(column) {
      vapply(column, function(value) {
        as.character(jsonlite::toJSON(
          value,
          auto_unbox = TRUE,
          null = "null",
          na = "null"
        ))
      }, character(1))
    })
    df
  }

  write_sheet <- function(name, df) {
    df <- excel_safe_table(df)
    openxlsx::addWorksheet(wb, name)
    openxlsx::writeData(wb, name, df)
    if (nrow(df) >= 0L && ncol(df) > 0L) {
      openxlsx::addStyle(wb, name, st_head, rows = 1, cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      openxlsx::freezePane(wb, name, firstRow = TRUE)
      openxlsx::setColWidths(wb, name, cols = seq_len(ncol(df)), widths = "auto")
    }
  }

  write_sheet("Resumen", tibble::as_tibble(summary))
  write_sheet("Decisiones_reglas", .limpieza_flatten_decisions(decisions))
  write_sheet("Casos_excluidos", preview$logs$excluded_cases %||% tibble::tibble())
  write_sheet("Correcciones", preview$logs$trace %||% tibble::tibble())
  write_sheet("Transformaciones", preview$logs$transformations %||% tibble::tibble())
  write_sheet("Advertencias", tibble::tibble(warning = preview$logs$warnings %||% character(0)))
  write_sheet("Trazabilidad", preview$logs$trace %||% tibble::tibble())
  write_sheet("Residual_final", if (!is.null(preview$evaluacion_final) && !is.null(preview$evaluacion_final$resumen)) tibble::as_tibble(preview$evaluacion_final$resumen) else tibble::tibble())

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

limpieza_finalize <- function(sid, base_nombre, scope) {
  if (is.null(scope$evaluacion)) {
    stop_api(409, "E_NO_AUDITORIA", "La limpieza solo puede cerrarse después de correr la auditoría.")
  }
  decisions <- scope$limpieza_draft %||% list()
  queue <- .limpieza_build_decision_queue(scope, decisions)
  pending <- Filter(function(x) isTRUE(x$pending), queue)
  if (length(queue) > 0L && length(pending) > 0L) {
    stop_api(409, "E_LIMPIEZA_PENDING", "Todavía hay inconsistencias pendientes de decisión.")
  }

  preview <- .limpieza_simulate(sid, base_nombre, scope, decisions)
  summary <- .limpieza_build_summary(scope, queue, decisions, preview)

  s <- session_get(sid)
  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, showWarnings = FALSE, recursive = TRUE)

  base_slug <- if (!is.null(base_nombre) && nzchar(base_nombre)) base_nombre else "base"
  ts_slug <- format(Sys.time(), "%Y%m%d_%H%M%S")

  # ADR 0076: lo que se escribe es la base del estudio depurada, con las
  # columnas de su origen; no la tabla de trabajo de Validación.
  files_origen <- tryCatch(.resolve_base_files(sid, base_nombre), error = function(e) NULL)
  data_promovible <- if (!is.null(files_origen)) {
    .limpieza_forma_de_origen(preview$data_final, files_origen$data$path, files_origen$data_ext)
  } else preview$data_final

  clean_path <- file.path(downloads_dir, sprintf("base_limpia_%s_%s.xlsx", base_slug, ts_slug))
  .bases_write_xlsx(data_promovible, data_promovible, clean_path, valores = "codigos")
  clean_meta <- .limpieza_register_download(
    sid = sid,
    kind = "validacion_limpieza_base_limpia",
    original_name = sprintf("base_limpia_%s.xlsx", base_slug),
    path = clean_path,
    ext = "xlsx"
  )

  # ADR 0076: promover es responsabilidad de quien depura. Sin esto la decisión
  # se registra, se justifica y se exporta, y el entregable sigue saliendo con
  # los casos que el analista excluyó.
  bloqueo <- if (.limpieza_promocion_bloqueada_por_repeats(sid, base_nombre)) {
    "La base tiene grupos repetibles: excluir casos de la madre exige podar sus filas hijas."
  } else ""
  linaje_limpieza <- .limpieza_promover_base(
    sid = sid, base_nombre = base_nombre, clean_meta = clean_meta,
    source_fid = if (!is.null(files_origen)) files_origen$data$file_id else NULL,
    n_antes = nrow(preview$data_final) + (preview$impact$cases_excluded %||% 0L),
    n_despues = nrow(data_promovible),
    n_columnas = ncol(data_promovible),
    motivo_bloqueo = bloqueo
  )

  limpieza_payload <- build_limpieza(scope, sid = sid, base_nombre = base_nombre, preview_override = preview)
  estudio_nombre <- session_get(sid)$estudio$nombre %||% NA_character_
  html_path <- file.path(downloads_dir, sprintf("decision_maker_%s_%s.html", base_slug, ts_slug))
  html <- build_report_html(
    scope = scope,
    base_nombre = base_nombre,
    estudio_nombre = estudio_nombre,
    generated_at = Sys.time(),
    limpieza_payload = limpieza_payload
  )
  writeLines(html, html_path, useBytes = TRUE)
  html_meta <- .limpieza_register_download(
    sid = sid,
    kind = "validacion_limpieza_html",
    original_name = sprintf("decision_maker_%s.html", base_slug),
    path = html_path,
    ext = "html"
  )

  excel_path <- file.path(downloads_dir, sprintf("decisiones_limpieza_%s_%s.xlsx", base_slug, ts_slug))
  .limpieza_export_excel(excel_path, summary, decisions, preview)
  excel_meta <- .limpieza_register_download(
    sid = sid,
    kind = "validacion_limpieza_excel",
    original_name = sprintf("decisiones_limpieza_%s.xlsx", base_slug),
    path = excel_path,
    ext = "xlsx"
  )

  artifacts <- list(
    finalized_at = .limpieza_now_utc(),
    # ADR 0076, Cumplimiento: `recommended_file_id` se retiró el 2026-08-15. Era
    # una recomendación que ningún consumidor leía, y desde que la base se
    # promueve sola describía algo que ya no ocurre. Quien quiera el archivo lo
    # tiene en `files` con kind "base_limpia"; qué base rige lo dice `promocion`.
    promocion = linaje_limpieza,
    files = list(
      list(kind = "base_limpia", label = "Base final limpia", file_id = clean_meta$file_id, original_name = clean_meta$original_name, generated_at = clean_meta$uploaded_at),
      list(kind = "reporte_html", label = "Reporte HTML ejecutivo", file_id = html_meta$file_id, original_name = html_meta$original_name, generated_at = html_meta$uploaded_at),
      list(kind = "excel_detalle", label = "Excel detalle de decisiones", file_id = excel_meta$file_id, original_name = excel_meta$original_name, generated_at = excel_meta$uploaded_at)
    )
  )

  validacion_scope_set(sid, base_nombre, "limpieza_preview", preview)
  validacion_scope_set(sid, base_nombre, "limpieza_artifacts", artifacts)
  if ((preview$impact$cases_excluded %||% 0L) > 0L ||
      (preview$impact$cells_changed %||% 0L) > 0L) {
    .limpieza_invalidate_downstream(sid, base_nombre)
  }

  list(
    ok = TRUE,
    summary = summary,
    before_after_preview = preview,
    artifacts = artifacts
  )
}
