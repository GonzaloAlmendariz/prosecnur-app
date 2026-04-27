# ============================================================
# Curaduría inicial del Dashboard.
#
# El Tablero sigue siendo un renderizador: no permite reordenar ni diseñar
# contenido. Esta fase previa define qué secciones/variables entran al
# dashboard público. Por defecto quedan incluidas solo las variables
# canónicas del legacy para Resumen/Relaciones: select_one y
# select_multiple. Integer/decimal quedan fuera del tablero.
# ============================================================

.dashboard_curacion_saved <- function(s) {
  cur <- s$dashboard_curacion
  if (!is.list(cur)) {
    return(list(
      confirmed = FALSE,
      exclude_sections = list(),
      exclude_vars = list()
    ))
  }
  list(
    confirmed = isTRUE(cur$confirmed),
    exclude_sections = as.list(unique(as.character(unlist(cur$exclude_sections %||% list())))),
    exclude_vars = as.list(unique(as.character(unlist(cur$exclude_vars %||% list()))))
  )
}

.dashboard_survey_row <- function(var, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || !"name" %in% names(sv)) return(NULL)
  idx <- which(!is.na(sv$name) & as.character(sv$name) == var)[1]
  if (is.na(idx)) return(NULL)
  sv[idx, , drop = FALSE]
}

.dashboard_var_raw_type <- function(var, rp_inst) {
  row <- .dashboard_survey_row(var, rp_inst)
  if (is.null(row) || !"type" %in% names(row)) return("")
  tolower(trimws(as.character(row$type[[1]] %||% "")))
}

.dashboard_var_n_unique <- function(var, df) {
  if (!(var %in% names(df))) return(NA_integer_)
  x <- as.character(df[[var]])
  x <- x[!is.na(x) & nzchar(trimws(x)) & x != "NA"]
  length(unique(x))
}

.dashboard_var_default_include <- function(var, rp_inst) {
  raw_type <- .dashboard_var_raw_type(var, rp_inst)
  grepl("^select_one(\\s|$)", raw_type) ||
    grepl("^select_multiple(\\s|$)", raw_type)
}

.dashboard_var_curacion_reason <- function(var, rp_inst, df) {
  raw_type <- .dashboard_var_raw_type(var, rp_inst)
  nm <- tolower(var)
  label <- tolower(.obtener_label_var(var, rp_inst, df) %||% "")

  if (grepl("^(status|start|end|deviceid|subscriberid|simid|simserial|phonenumber|uuid|instanceid|pulso_code)$", nm) ||
      grepl("(^|_)id$|^id_|_id$|^control_|^meta_|enumerator|encuestador", nm)) {
    return("Metadato técnico o de control operativo.")
  }
  if (grepl("^(note|calculate|acknowledge)", raw_type)) {
    return("Campo auxiliar del instrumento.")
  }
  if (grepl("^(integer|decimal)($|\\s)", raw_type)) {
    return("Variable numérica; no se incluye en el tablero canónico.")
  }
  if (grepl("^(date|datetime|time|start|end|today)($|\\s)", raw_type) ||
      grepl("(^|[^[:alpha:]])(fecha|date|horas?|time)([^[:alpha:]]|$)", nm) ||
      grepl("(^|[^[:alpha:]])(fecha|date|horas?)([^[:alpha:]]|$)", label)) {
    return("Fecha u hora: no se representa bien como distribución categórica.")
  }
  if (grepl("^(text|geopoint|geotrace|geoshape|image|audio|video|file|barcode)($|\\s)", raw_type)) {
    return("Respuesta abierta, archivo, ubicación o evidencia; no es una variable de resumen.")
  }
  if (!.dashboard_var_default_include(var, rp_inst)) return("Tipo no incluido por defecto.")
  NULL
}

.dashboard_curacion_payload <- function(s) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    return(list(
      confirmed = FALSE,
      exclude_sections = list(),
      exclude_vars = list(),
      secciones = list()
    ))
  }

  saved <- .dashboard_curacion_saved(s)
  secs <- .dashboard_build_secciones(s$rp_inst, s$rp_data)
  excluded_sections <- as.character(unlist(saved$exclude_sections %||% list()))
  excluded_vars <- as.character(unlist(saved$exclude_vars %||% list()))

  secciones <- lapply(seq_along(secs), function(i) {
    nombre <- names(secs)[i]
    vars <- secs[[i]]
    vars_payload <- lapply(vars, function(v) {
      reason <- .dashboard_var_curacion_reason(v, s$rp_inst, s$rp_data)
      default_include <- .dashboard_var_default_include(v, s$rp_inst)
      list(
        name = v,
        label = .obtener_label_var(v, s$rp_inst, s$rp_data),
        raw_type = .dashboard_var_raw_type(v, s$rp_inst),
        tipo = .dashboard_tipo_pregunta(v, s$rp_inst, s$rp_data),
        n_unique = .dashboard_var_n_unique(v, s$rp_data),
        default_include = default_include,
        suggested_exclude = !default_include,
        reason = reason %||% NA_character_,
        excluded = v %in% excluded_vars
      )
    })
    list(
      nombre = nombre,
      n_vars = length(vars),
      suggested_exclude = length(vars) > 0L && all(vapply(vars_payload, function(v) {
        isTRUE(v$suggested_exclude)
      }, logical(1))),
      reason = NA_character_,
      excluded = nombre %in% excluded_sections,
      vars = vars_payload
    )
  })

  list(
    confirmed = isTRUE(saved$confirmed),
    exclude_sections = as.list(excluded_sections),
    exclude_vars = as.list(excluded_vars),
    secciones = secciones
  )
}

.dashboard_curated_secciones <- function(s) {
  s <- .dashboard_ctx(s)
  secs <- .dashboard_build_secciones(s$rp_inst, s$rp_data)
  if (!length(secs)) return(secs)

  saved <- .dashboard_curacion_saved(s)
  exclude_sections <- as.character(unlist(saved$exclude_sections %||% list()))
  exclude_vars <- as.character(unlist(saved$exclude_vars %||% list()))

  secs <- secs[!(names(secs) %in% exclude_sections)]
  secs <- lapply(secs, function(vars) {
    vars <- setdiff(vars, exclude_vars)
    vars[vapply(vars, function(v) {
      .dashboard_var_default_include(v, s$rp_inst)
    }, logical(1))]
  })
  secs[vapply(secs, length, integer(1)) > 0L]
}

.dashboard_curacion_save <- function(sid, body) {
  s <- .dashboard_ctx(session_get(sid))
  payload <- .dashboard_curacion_payload(s)
  valid_sections <- vapply(payload$secciones, function(x) x$nombre, character(1))
  valid_vars <- unique(unlist(lapply(payload$secciones, function(sec) {
    vapply(sec$vars, function(x) x$name, character(1))
  })))

  exclude_sections <- unique(as.character(unlist(body$exclude_sections %||% list())))
  exclude_vars <- unique(as.character(unlist(body$exclude_vars %||% list())))
  exclude_sections <- intersect(exclude_sections, valid_sections)
  exclude_vars <- intersect(exclude_vars, valid_vars)

  cur <- list(
    confirmed = TRUE,
    exclude_sections = as.list(exclude_sections),
    exclude_vars = as.list(exclude_vars),
    saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  session_set(sid, "dashboard_curacion", cur)
  cur
}
