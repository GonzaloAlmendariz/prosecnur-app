.analitica_fuentes <- function(sid) {
  s <- session_get(sid)
  tiene_adaptados <- isTRUE(s$codif_aplicado) &&
                     !is.null(s$codif_inst_adaptado_fid) &&
                     !is.null(s$codif_data_adaptada_fid)

  # El analista puede forzar la fuente desde el config del store
  # (PrepararPane → toggle "Fuente"). "auto" → adaptados si existen,
  # "originales" → fuerza crudos, "adaptados" → exige adaptados.
  pref <- as.character((s$analitica_config %||% list())$fuente_preferida %||% "auto")
  if (!pref %in% c("auto", "originales", "adaptados")) pref <- "auto"

  usar_adaptados <- switch(pref,
    "auto" = tiene_adaptados,
    "adaptados" = TRUE,
    "originales" = FALSE
  )

  if (usar_adaptados) {
    if (!tiene_adaptados) {
      stop_api(409, "E_NO_ADAPTADOS",
        "No hay data adaptada disponible. Corre la Fase 3 (Codificación) o cambia la fuente a 'Automática' o 'Data original'.")
    }
    list(
      inst_path = get_file(sid, s$codif_inst_adaptado_fid)$path,
      data_meta = get_file(sid, s$codif_data_adaptada_fid),
      fuente = "adaptados"
    )
  } else {
    list(
      inst_path = .require_xlsform_path(sid)$path,
      data_meta = .require_data_path(sid),
      fuente = "originales"
    )
  }
}

.secciones_desde_instrumento <- function(rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey) || !"name" %in% names(survey)) return(NULL)
  grupo <- survey$group_name %||% rep("general", nrow(survey))
  grupo[is.na(grupo) | !nzchar(grupo)] <- "general"
  ok <- !is.na(survey$name) & nzchar(survey$name)
  tapply(survey$name[ok], grupo[ok], function(v) unique(v), simplify = FALSE) |>
    as.list()
}

# Walk survey$type en orden y construye secciones desde begin_group /
# end_group con etiqueta en español preferida (misma lógica que
# `.section_map` de router_codificacion.R pero devolviendo secciones
# en el shape que la UI consume: [{id, nombre, variables, orden}]).
# Preserva orden, soporta nesting (usamos el group más interno por var).
.detect_secciones_analitica <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())

  # Label preference: survey_raw's label::Spanish si existe.
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  # Walk para asignar cada variable al group más interno (stack approach).
  stack_name <- character(0)
  stack_label <- character(0)
  seccion_orden <- list()   # id -> {nombre, variables, orden}
  orden_counter <- 0L

  for (i in seq_len(nrow(sv))) {
    t <- as.character(sv$type[i] %||% "")
    nm <- as.character(sv$name[i] %||% "")
    lb <- label_raw[i]
    if (t == "begin_group" || t == "begin_repeat") {
      stack_name <- c(stack_name, nm)
      stack_label <- c(stack_label, if (nzchar(lb)) lb else nm)
    } else if (t == "end_group" || t == "end_repeat") {
      if (length(stack_name) > 0L) {
        stack_name <- stack_name[-length(stack_name)]
        stack_label <- stack_label[-length(stack_label)]
      }
    } else if (nzchar(nm)) {
      # Variable data: asignarla al group más interno actual (o "general"
      # si estamos en top-level).
      seccion_id <- if (length(stack_name) > 0L) stack_name[length(stack_name)] else "general"
      seccion_lb <- if (length(stack_label) > 0L) stack_label[length(stack_label)] else "General"
      if (is.null(seccion_orden[[seccion_id]])) {
        orden_counter <- orden_counter + 1L
        seccion_orden[[seccion_id]] <- list(
          nombre = seccion_lb,
          variables = character(0),
          orden = orden_counter - 1L  # 0-indexed para frontend
        )
      }
      seccion_orden[[seccion_id]]$variables <- c(
        seccion_orden[[seccion_id]]$variables, nm
      )
    }
  }

  # Convertir a lista de secciones ordenadas por `orden`.
  if (length(seccion_orden) == 0L) return(list())
  ids <- names(seccion_orden)
  ordenes <- vapply(seccion_orden, function(x) as.integer(x$orden), integer(1))
  ids <- ids[order(ordenes)]
  lapply(ids, function(id) {
    s <- seccion_orden[[id]]
    list(
      id = id,
      nombre = s$nombre,
      variables = as.list(unique(s$variables)),
      oculto = FALSE,
      orden = as.integer(s$orden)
    )
  })
}

# Lista de variables del instrumento para alimentar dropdowns de la UI.
# Filtra filas que no son data (begin_group, end_group, note).
.variables_desde_instrumento <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L || !"name" %in% names(sv)) return(list())
  label_raw <- rep("", nrow(sv))
  if (!is.null(rp_inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(rp_inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(rp_inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(rp_inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  tipos <- as.character(sv$type %||% "")
  base_tipos <- sub("\\s.*$", "", tipos)
  list_names <- trimws(sub("^\\S+\\s*", "", tipos))

  keep <- !is.na(sv$name) & nzchar(sv$name) &
          !base_tipos %in% c("begin_group","end_group","begin_repeat","end_repeat","note","calculate","start","end","deviceid","today")
  idx <- which(keep)
  lapply(idx, function(i) {
    list(
      name = as.character(sv$name[i]),
      label = label_raw[i],
      tipo = base_tipos[i],
      list_name = list_names[i]
    )
  })
}

.load_rp_data <- function(sid) {
  s <- session_get(sid)
  if (!is.null(s$rp_data) && !is.null(s$rp_inst)) {
    return(list(rp_inst = s$rp_inst, rp_data = s$rp_data))
  }
  stop_api(409, "E_ANALITICA_NO_PREP", "Primero corre el Paso 1 (Preparar datos para reporte).")
}

.zip_files <- function(zip_path, files, names_in_zip = NULL) {
  names_in_zip <- names_in_zip %||% basename(files)
  old <- getwd()
  td <- tempfile()
  dir.create(td)
  on.exit({ setwd(old); unlink(td, recursive = TRUE) }, add = TRUE)
  for (i in seq_along(files)) file.copy(files[i], file.path(td, names_in_zip[i]))
  setwd(td)
  zip::zip(zip_path, files = names_in_zip)
  zip_path
}

# Lee la sub-configuración analitica_config de la sesión (store del
# frontend autosaveado). Devuelve un list vacío si aún no hay config.
.analitica_get_config <- function(sid) {
  s <- session_get(sid)
  cfg <- s$analitica_config
  if (is.null(cfg)) return(list())
  cfg
}

# Traduce las secciones del store (lista de {id, nombre, variables,
# oculto, orden}) a la forma que prosecnur::reporte_frecuencias/cruces
# espera: lista nombrada `list(Nombre1 = c("v1","v2"), ...)`.
# Respeta `oculto` y `secciones_activas` (si se pasa un filtro).
.secciones_from_config <- function(cfg, activas_filter = NULL) {
  secs <- cfg$secciones %||% list()
  if (length(secs) == 0L) return(NULL)
  out <- list()
  # Preservar orden según `orden` si está presente.
  ord <- vapply(secs, function(s) as.integer(s$orden %||% 0L), integer(1))
  secs <- secs[order(ord)]
  for (s in secs) {
    id <- as.character(s$id %||% "")
    if (!nzchar(id)) next
    if (isTRUE(s$oculto)) next
    if (!is.null(activas_filter) && length(activas_filter) > 0L &&
        !id %in% activas_filter) next
    nombre <- as.character(s$nombre %||% id)
    vars <- unlist(s$variables %||% list())
    vars <- as.character(vars)
    vars <- vars[!is.na(vars) & nzchar(vars)]
    if (length(vars) == 0L) next
    # En caso improbable de colisión de nombres, desambiguar con id.
    key <- nombre
    if (key %in% names(out)) key <- paste0(nombre, " (", id, ")")
    out[[key]] <- unique(vars)
  }
  if (length(out) == 0L) return(NULL)
  out
}

# Extrae un vector character de un list/vector JSON. Util para cruces_vars,
# cols_corte, codigos_solo_si_presentes, etc. — jsonlite devuelve list()
# para arrays vacíos y simplifyVector=FALSE mantiene list-of-string.
.as_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(character(0))
  out <- as.character(v)
  out[!is.na(out) & nzchar(out)]
}

.as_int_vec <- function(x) {
  if (is.null(x)) return(integer(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(integer(0))
  suppressWarnings(as.integer(v))
}

# Default de configuración (mirrors defaults del frontend store.ts).
# Se usa cuando el session store no tiene aún una config grabada.
.analitica_default_config <- function() {
  list(
    version = 1L,
    fuente_preferida = "auto",
    secciones = list(),
    numericas = list(),
    codebook = list(
      codigos_solo_si_presentes = as.list(c(96L, 97L, 98L, 99L))
    ),
    frecuencias = list(
      secciones_activas = list(),
      orden = "desc",
      mostrar_todo = FALSE
    ),
    cruces = list(
      cruces_vars = list(),
      modo = "estandar",
      show_sig = TRUE,
      alpha = 0.05,
      incluir_total = TRUE,
      brecha = list(filas = FALSE, cols = FALSE),
      semaforo = list(
        activo = FALSE,
        cortes = as.list(c(50L, 75L)),
        modo = "grupos",
        colores = list(rojo = "#F8D7DA", amarillo = "#FFF3CD", verde = "#D4EDDA")
      )
    ),
    enumeradores = list(
      col_enumerador = "Enumerator_name",
      cols_corte = list(),
      modalidades_esperadas = as.list(c("Presencial", "Telefónica")),
      mostrar_vacias = FALSE,
      titulo = "Producción de Enumeradores",
      min_encuestas = 0L,
      ordenar_por = "total",
      modalidad_reglas = list(),
      modalidad_default = "Presencial"
    )
  )
}

mount_analitica <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/config", wrap_endpoint(function(req, res) {
      # Devuelve la config persistida (o defaults). La UI la hidrata en su
      # store al montarse `AnaliticaPage` y escribe cambios vía autosave
      # contra POST /config.
      sid <- session_header(req)
      s <- session_get(sid)
      cfg <- s$analitica_config %||% .analitica_default_config()
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/analitica/config", wrap_endpoint(function(req, res, ...) {
      # Recibe la config completa desde el autosave del frontend. No
      # validamos schema aquí (el frontend ya lo garantiza); el backend
      # es un "kv store" para esta sub-clave.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "Body debe incluir 'config'.")
      session_set(sid, "analitica_config", cfg)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/analitica/config/export", wrap_endpoint(function(req, res) {
      # Export del estado completo (config + flags de generación) para que
      # el analista pueda guardarlo a disco / compartirlo. Mismo patrón que
      # Fase 3 /api/codificacion/export-json.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        version = "analitica/1.0",
        exported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        config = s$analitica_config %||% .analitica_default_config()
      )
    })) |>
    plumber::pr_post("/api/analitica/detect-secciones", wrap_endpoint(function(req, res) {
      # Devuelve las secciones detectadas desde begin_group/end_group del
      # XLSForm ya preparado. Respeta orden del instrumento. Requiere
      # haber corrido /preparar antes.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      secciones <- .detect_secciones_analitica(ctx$rp_inst)
      list(ok = TRUE, secciones = secciones)
    })) |>
    plumber::pr_get("/api/analitica/variables", wrap_endpoint(function(req, res) {
      # Lista las variables del instrumento para alimentar dropdowns /
      # multiselects del frontend. Cada entry trae name + label + tipo +
      # list_name, filtrando filas estructurales (begin_group, note,
      # calculate, etc.).
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      variables <- .variables_desde_instrumento(ctx$rp_inst)
      list(ok = TRUE, variables = variables)
    })) |>
    plumber::pr_post("/api/analitica/config/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      v <- as.character(parsed$version %||% "")
      if (!startsWith(v, "analitica/")) {
        stop_api(400, "E_BAD_VERSION",
          sprintf("JSON no es de analítica (version='%s'). Se espera 'analitica/1.x'.", v))
      }
      cfg <- parsed$config
      if (is.null(cfg)) stop_api(400, "E_NO_CONFIG", "El JSON no trae 'config'.")
      session_set(sid, "analitica_config", cfg)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_post("/api/analitica/preparar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      src <- .analitica_fuentes(sid)
      rp_inst <- prosecnur::reporte_instrumento(path = src$inst_path)
      dat_raw <- switch(src$data_meta$ext,
        xlsx = readxl::read_excel(src$data_meta$path),
        xls  = readxl::read_excel(src$data_meta$path),
        csv  = utils::read.csv(src$data_meta$path, stringsAsFactors = FALSE),
        sav  = haven::read_sav(src$data_meta$path),
        stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Ext no soportada: %s", src$data_meta$ext))
      )
      rp_data <- prosecnur::reporte_data(dat_raw, instrumento = rp_inst)
      session_set(sid, "rp_inst", rp_inst)
      session_set(sid, "rp_data", rp_data)
      session_set(sid, "analitica_prep_ok", TRUE)
      session_set(sid, "analitica_fuente", src$fuente)
      list(
        ok = TRUE,
        fuente = src$fuente,
        n_filas = nrow(rp_data),
        n_columnas = ncol(rp_data)
      )
    })) |>
    plumber::pr_post("/api/analitica/codebook", wrap_endpoint(function(req, res) {
      # Codebook lee `codigos_solo_si_presentes` del config del store.
      sid <- session_header(req)
      s <- session_get(sid)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      cb_cfg <- cfg$codebook %||% list()
      codes <- .as_int_vec(cb_cfg$codigos_solo_si_presentes)
      out_path <- file.path(s$dir, "downloads", sprintf("codebook_%s.xlsx", uuid::UUIDgenerate()))
      dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
      prosecnur::reporte_codebook(
        data = ctx$rp_data,
        path_xlsx = out_path,
        codigos_solo_si_presentes = if (length(codes) > 0L) codes else NULL
      )
      meta <- .register_output_file(sid, "codebook", out_path)
      session_set(sid, "analitica_codebook_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/frecuencias", wrap_endpoint(function(req, res) {
      # Frecuencias lee del config: secciones (filtradas por
      # `secciones_activas` si no está vacío, con oculto=false), orden,
      # mostrar_todo, numericas (override o global).
      sid <- session_header(req)
      s <- session_get(sid)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      fc <- cfg$frecuencias %||% list()
      activas <- .as_chr_vec(fc$secciones_activas)
      secs <- .secciones_from_config(cfg, activas_filter = if (length(activas) > 0L) activas else NULL)
      # Fallback: si la config no tiene secciones aún, usar detección auto.
      if (is.null(secs)) secs <- .secciones_desde_instrumento(ctx$rp_inst)

      orden <- as.character(fc$orden %||% "desc")
      if (!orden %in% c("desc","asc","original")) orden <- "desc"
      mostrar_todo <- isTRUE(fc$mostrar_todo)

      num_override <- .as_chr_vec(fc$numericas_override)
      num_global <- .as_chr_vec(cfg$numericas)
      numericas_arg <- if (length(num_override) > 0L) num_override else num_global

      codes_codebook <- .as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)

      out_path <- file.path(s$dir, "downloads", sprintf("frecuencias_%s.xlsx", uuid::UUIDgenerate()))
      dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
      prosecnur::reporte_frecuencias(
        data = ctx$rp_data, instrumento = ctx$rp_inst,
        secciones = secs,
        path_xlsx = out_path,
        orden = orden,
        mostrar_todo = mostrar_todo,
        codigos_solo_si_presentes = if (length(codes_codebook) > 0L) codes_codebook else NULL,
        numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL
      )
      meta <- .register_output_file(sid, "frecuencias", out_path)
      session_set(sid, "analitica_frecuencias_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/cruces", wrap_endpoint(function(req, res, cruces = NULL, modo = "estandar") {
      # Cruces lee del config del store: cruces_vars, modo, show_sig, alpha,
      # incluir_total, brecha, semaforo. Mantiene backcompat con el antiguo
      # `cruces=` query param para tests manuales; si viene en query, tiene
      # prioridad sobre el config.
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      cc <- cfg$cruces %||% list()

      # Resolver cruces_vars: query param > config.
      cruces_val <- if (!is.null(cruces) && nzchar(as.character(cruces[[1]] %||% ""))) {
        if (length(cruces) == 1) as.character(cruces[[1]]) else as.character(cruces)
      } else {
        .as_chr_vec(cc$cruces_vars)
      }
      if (length(cruces_val) == 0L) {
        stop_api(400, "E_NO_CRUCES",
          "Agrega al menos una variable en Diseñar → Cruces antes de generar.")
      }

      modo_val <- as.character(modo %||% cc$modo %||% "estandar")
      if (!modo_val %in% c("estandar","dimensiones")) modo_val <- "estandar"

      secs <- .secciones_from_config(cfg)

      show_sig <- isTRUE(cc$show_sig %||% TRUE)
      alpha <- suppressWarnings(as.numeric(cc$alpha %||% 0.05))
      if (!is.finite(alpha)) alpha <- 0.05
      incluir_total <- isTRUE(cc$incluir_total %||% TRUE)

      brecha <- cc$brecha %||% list()
      brecha_filas <- isTRUE(brecha$filas)
      brecha_cols <- isTRUE(brecha$cols)

      sem <- cc$semaforo %||% list()
      aplicar_sem <- isTRUE(sem$activo)
      sem_modo <- as.character(sem$modo %||% "grupos")
      if (!sem_modo %in% c("grupos","degradado_automatico","degradado_manual")) sem_modo <- "grupos"
      sem_cortes <- .as_int_vec(sem$cortes)
      if (length(sem_cortes) == 0L) sem_cortes <- c(50L, 75L)
      sem_colores <- sem$colores %||% list()

      rp_data_path <- job_save_rds(sid, "rp_data", ctx$rp_data)
      rp_inst_path <- job_save_rds(sid, "rp_inst", ctx$rp_inst)
      job_id <- job_submit(
        sid = sid,
        kind = "analitica.cruces",
        func = function(rp_data_path, rp_inst_path, cruces_val, modo, secs,
                        show_sig, alpha, incluir_total,
                        brecha_filas, brecha_cols,
                        aplicar_sem, sem_modo, sem_cortes, sem_colores,
                        result_path) {
          sem_colores_vec <- if (is.list(sem_colores) && length(sem_colores) > 0L) {
            unlist(lapply(c("rojo","amarillo","verde"), function(k) sem_colores[[k]]))
          } else NULL
          args <- list(
            data = readRDS(rp_data_path),
            instrumento = readRDS(rp_inst_path),
            SECCIONES = secs,
            cruces = cruces_val,
            modo = modo,
            path_xlsx = result_path,
            show_sig = show_sig,
            alpha = alpha,
            incluir_total = incluir_total,
            brecha_filas = brecha_filas,
            brecha_cols = brecha_cols,
            aplicar_semaforo = aplicar_sem,
            semaforo_modo = sem_modo,
            semaforo_cortes = sem_cortes
          )
          if (!is.null(sem_colores_vec) && length(sem_colores_vec) == 3L &&
              all(nchar(sem_colores_vec) > 0L)) {
            names(sem_colores_vec) <- c("rojo","amarillo","verde")
            args$semaforo_colores <- sem_colores_vec
          }
          do.call(prosecnur::reporte_cruces, args)
          list(path = result_path)
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          cruces_val = cruces_val,
          modo = modo_val,
          secs = secs,
          show_sig = show_sig,
          alpha = alpha,
          incluir_total = incluir_total,
          brecha_filas = brecha_filas,
          brecha_cols = brecha_cols,
          aplicar_sem = aplicar_sem,
          sem_modo = sem_modo,
          sem_cortes = sem_cortes,
          sem_colores = sem_colores
        ),
        result_filename = sprintf("cruces_%s.xlsx", uuid::UUIDgenerate()),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "cruces", j$result_path)
          session_set(j$sid, "analitica_cruces_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.cruces")
    })) |>
    plumber::pr_post("/api/analitica/spss", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      rp_data_path <- job_save_rds(sid, "rp_data", ctx$rp_data)
      job_id <- job_submit(
        sid = sid,
        kind = "analitica.spss",
        func = function(rp_data_path, result_path) {
          td <- tempfile()
          dir.create(td)
          old <- getwd()
          on.exit({ setwd(old); unlink(td, recursive = TRUE) }, add = TRUE)
          sav_path <- file.path(td, "datos.sav")
          sps_path <- file.path(td, "niveles_medida.sps")
          prosecnur::reporte_spss(readRDS(rp_data_path), path_sav = sav_path, path_sps = sps_path)
          setwd(td)
          zip::zip(result_path, files = c("datos.sav", "niveles_medida.sps"))
          list(path = result_path)
        },
        args = list(rp_data_path = rp_data_path),
        result_filename = sprintf("spss_%s.zip", uuid::UUIDgenerate()),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "spss_bundle", j$result_path)
          session_set(j$sid, "analitica_spss_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.spss")
    })) |>
    plumber::pr_post("/api/analitica/enumeradores", wrap_endpoint(function(req, res, col_enumerador = NULL) {
      # Enumeradores lee del config: col_enumerador, cols_corte,
      # col_modalidad, modalidades_esperadas, modalidad_reglas,
      # modalidad_default, titulo, min_encuestas, ordenar_por,
      # mostrar_vacias. Query param `col_enumerador` tiene prioridad
      # (backcompat).
      sid <- session_header(req)
      ctx <- .load_rp_data(sid)
      cfg <- .analitica_get_config(sid)
      ec <- cfg$enumeradores %||% list()

      col_en <- if (!is.null(col_enumerador) && nzchar(as.character(col_enumerador))) {
        as.character(col_enumerador)
      } else {
        as.character(ec$col_enumerador %||% "")
      }
      if (!nzchar(col_en)) {
        stop_api(400, "E_NO_COL_ENUM",
          "Configura la columna del enumerador en Diseñar → Enumeradores.")
      }

      cols_corte <- .as_chr_vec(ec$cols_corte)
      col_modalidad <- as.character(ec$col_modalidad %||% "")
      modalidades_esp <- .as_chr_vec(ec$modalidades_esperadas)
      mostrar_vacias <- isTRUE(ec$mostrar_vacias)
      titulo <- as.character(ec$titulo %||% "Producción de Enumeradores")
      min_enc <- suppressWarnings(as.integer(ec$min_encuestas %||% 0L))
      if (!is.finite(min_enc) || min_enc < 0) min_enc <- 0L
      ordenar_por <- as.character(ec$ordenar_por %||% "total")
      if (!ordenar_por %in% c("total","nombre")) ordenar_por <- "total"
      modalidad_default <- as.character(ec$modalidad_default %||% "Presencial")

      # modalidad_reglas: lista de {patron, modalidad} del store →
      # data.frame que prosecnur espera.
      reglas_list <- ec$modalidad_reglas %||% list()
      modalidad_reglas_df <- NULL
      if (length(reglas_list) > 0L) {
        patrones <- vapply(reglas_list, function(r) as.character(r$patron %||% ""), character(1))
        modas <- vapply(reglas_list, function(r) as.character(r$modalidad %||% ""), character(1))
        keep <- nzchar(patrones) & nzchar(modas)
        if (any(keep)) {
          modalidad_reglas_df <- data.frame(
            patron = patrones[keep], modalidad = modas[keep],
            stringsAsFactors = FALSE
          )
        }
      }

      rp_data_path <- job_save_rds(sid, "rp_data", ctx$rp_data)
      job_id <- job_submit(
        sid = sid,
        kind = "analitica.enumeradores",
        func = function(rp_data_path, col_en, cols_corte, col_modalidad,
                        modalidades_esp, mostrar_vacias, titulo, min_enc,
                        ordenar_por, modalidad_default, modalidad_reglas_df,
                        result_path) {
          args <- list(
            data = readRDS(rp_data_path),
            col_enumerador = col_en,
            output_file = result_path,
            titulo = titulo,
            min_encuestas = as.integer(min_enc),
            ordenar_por = ordenar_por,
            modalidad_default = modalidad_default,
            mostrar_modalidades_vacias = mostrar_vacias,
            quiet = TRUE
          )
          if (length(cols_corte) > 0L) args$cols_corte <- cols_corte
          if (nzchar(col_modalidad)) args$col_modalidad <- col_modalidad
          if (length(modalidades_esp) > 0L) args$modalidades_esperadas <- modalidades_esp
          if (!is.null(modalidad_reglas_df)) args$modalidad_reglas <- modalidad_reglas_df
          do.call(prosecnur::reporte_enumeradores, args)
          list(path = result_path)
        },
        args = list(
          rp_data_path = rp_data_path,
          col_en = col_en,
          cols_corte = cols_corte,
          col_modalidad = col_modalidad,
          modalidades_esp = modalidades_esp,
          mostrar_vacias = mostrar_vacias,
          titulo = titulo,
          min_enc = min_enc,
          ordenar_por = ordenar_por,
          modalidad_default = modalidad_default,
          modalidad_reglas_df = modalidad_reglas_df
        ),
        result_filename = sprintf("enumeradores_%s.pdf", uuid::UUIDgenerate()),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "enumeradores", j$result_path)
          session_set(j$sid, "analitica_enumeradores_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, size = meta$size)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "analitica.enumeradores")
    }))
}
