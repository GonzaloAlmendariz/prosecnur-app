.session_env <- new.env(parent = emptyenv())

session_root_dir <- function() {
  root <- file.path(tempdir(), "prosecnur")
  if (!dir.exists(root)) dir.create(root, recursive = TRUE)
  root
}

session_create <- function() {
  sid <- uuid::UUIDgenerate()
  sdir <- file.path(session_root_dir(), sid)
  for (sub in c("uploads", "state", "jobs", "downloads")) {
    dir.create(file.path(sdir, sub), recursive = TRUE, showWarnings = FALSE)
  }
  .session_env[[sid]] <- list(
    id = sid,
    created_at = Sys.time(),
    dir = sdir,
    files = list(),
    instrumento = NULL,
    data_raw = NULL,
    # Campos del archivo de proyecto .pulso. Si project_path es NULL la
    # sesión está en modo efímero (los cambios no se persisten). Cuando
    # hay un .pulso abierto, cada mutación de estado marca project_dirty.
    # El archivo se escribe solo por guardado explicito del usuario.
    project_path = NULL,
    project_dirty = FALSE,
    project_last_saved_at = NULL
  )
  sid
}

# Helper privado: marca la sesión como "dirty" si tiene un .pulso abierto.
# Se llama desde todos los puntos que mutan estado relevante. NO marca si
# project_path es NULL (modo efímero — no hay proyecto al que escribir).
.mark_project_dirty <- function(s) {
  if (!is.null(s$project_path) && nzchar(s$project_path)) {
    s$project_dirty <- TRUE
  }
  s
}

session_get <- function(sid, required = TRUE) {
  if (is.null(sid) || !nzchar(sid)) {
    if (required) stop_api(404, "E_NO_SESSION", "Missing X-Pulso-Session header.")
    return(NULL)
  }
  s <- .session_env[[sid]]
  if (is.null(s) && required) {
    stop_api(404, "E_NO_SESSION", sprintf("Session %s not found.", sid))
  }
  s
}

session_set <- function(sid, key, value) {
  s <- session_get(sid)
  s[[key]] <- value
  # Marcar dirty EXCEPTO para keys internas del propio sistema de proyecto
  # (sino se entraría en bucle: setear project_dirty vuelve a marcar dirty).
  if (!(key %in% c("project_path", "project_dirty", "project_last_saved_at"))) {
    s <- .mark_project_dirty(s)
  }
  .session_env[[sid]] <- s
  invisible(value)
}

session_delete <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(FALSE)
  if (exists("prosecnur_session_secrets_clear_all", mode = "function")) {
    prosecnur_session_secrets_clear_all(sid)
  }
  unlink(s$dir, recursive = TRUE, force = TRUE)
  rm(list = sid, envir = .session_env)
  TRUE
}

session_header <- function(req) {
  h <- req$HTTP_X_PULSO_SESSION
  if (is.null(h) || !nzchar(h)) NULL else h
}

# ===========================================================================
# MODELO DE ESTUDIO — multi-base (v0.2+)
# ===========================================================================
#
# Cada sesión mantiene un "estudio" con 1 a N bases.
# Cada base es un par (instrumento, data) con un nombre identificador
# dentro del estudio.
#
# Estructura (campos nuevos bajo la misma `session_env[[sid]]`):
#
#   s$estudio = list(
#     nombre = "Acreditación PUCP" | NULL,
#     bases = list(
#       docentes = list(
#         nombre          = "docentes",
#         xlsform_file_id = "abc-...",   # del file store (save_upload)
#         data_file_id    = "xyz-...",
#         data_ext        = "sav",
#         n_filas         = 150,
#         n_columnas      = 42,
#         added_at        = Sys.time()
#       ),
#       ...
#     )
#   )
#
#   s$rp_data_sources = list(docentes = <df>, estudiantes = <df>, ...)
#   s$rp_inst_sources = list(docentes = <rp_inst>, estudiantes = <rp_inst>, ...)
#
# Back-compat:
#   s$rp_data / s$rp_inst se mantienen apuntando a la PRIMERA base para
#   que los routers que aún no migraron sigan funcionando single-base.
#   Cuando un router migra a multi-base, deja de leer esos campos y pasa
#   a usar s$rp_data_sources / s$rp_inst_sources.
#
#   Legacy también: s$analitica_fuente = "<fuente>:<nombre>" sigue siendo
#   string único; representa la fuente de la PRIMERA base del estudio.

# Tope pragmático de bases por estudio. Ingeniería egresados tiene 9
# hermanos; dejamos margen sin abrir el proyecto a cargas masivas.
.ESTUDIO_MAX_BASES <- 16L
.ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES <- 10L
.ESTUDIO_PROCESSING_MODES <- c("multibase", "independent_siblings")
.ESTUDIO_ANALITICA_STATUS_KEYS <- c(
  "analitica_prep_ok", "analitica_codebook_ok", "analitica_frecuencias_ok",
  "analitica_cruces_ok", "analitica_spss_ok", "analitica_enumeradores_ok",
  "analitica_dim_ok", "analitica_multibase_ok", "analitica_panel_ok", "analitica_ficha_tecnica_ok", "analitica_bases_data_ok",
  "analitica_bases_instrumento_ok", "analitica_bases_sav_ok",
  "analitica_bases_csv_ok", "analitica_bases_xlsx_ok"
)
.ESTUDIO_GRAFICOS_STATUS_KEYS <- c("graficos_ppt_ok", "graficos_word_ok")

.estudio_mode_normalize <- function(mode) {
  mode <- if (is.null(mode) || !nzchar(as.character(mode))) "multibase" else as.character(mode)
  if (!(mode %in% .ESTUDIO_PROCESSING_MODES)) {
    stop_api(400, "E_ESTUDIO_PROCESSING_MODE",
             sprintf("Modo de procesamiento no soportado: '%s'.", mode))
  }
  mode
}

.estudio_active_base_name <- function(s, fallback_first = TRUE) {
  bases <- names(s$estudio$bases %||% list())
  if (length(bases) == 0L) return(NULL)
  active <- s$estudio$active_base %||% NULL
  if (!is.null(active) && nzchar(as.character(active)) && active %in% bases) return(active)
  legacy_active <- s$codif_source_active %||% NULL
  if (!is.null(legacy_active) && nzchar(as.character(legacy_active)) && legacy_active %in% bases) {
    return(legacy_active)
  }
  if (fallback_first) bases[1] else NULL
}

.estudio_capture_stage_flags <- function(s, base_nombre) {
  base_nombre <- as.character(base_nombre %||% "")
  if (!nzchar(base_nombre)) return(s)
  if (is.null(s$analitica_status_por_base) || !is.list(s$analitica_status_por_base)) {
    s$analitica_status_por_base <- list()
  }
  if (is.null(s$graficos_status_por_base) || !is.list(s$graficos_status_por_base)) {
    s$graficos_status_por_base <- list()
  }
  ast <- s$analitica_status_por_base[[base_nombre]]
  gst <- s$graficos_status_por_base[[base_nombre]]
  if (is.null(ast) || !is.list(ast)) ast <- list()
  if (is.null(gst) || !is.list(gst)) gst <- list()
  for (key in .ESTUDIO_ANALITICA_STATUS_KEYS) {
    if (is.null(ast[[key]]) && !is.null(s[[key]])) ast[[key]] <- isTRUE(s[[key]])
  }
  for (key in .ESTUDIO_GRAFICOS_STATUS_KEYS) {
    if (is.null(gst[[key]]) && !is.null(s[[key]])) gst[[key]] <- isTRUE(s[[key]])
  }
  s$analitica_status_por_base[[base_nombre]] <- ast
  s$graficos_status_por_base[[base_nombre]] <- gst
  s
}

.estudio_apply_stage_flags <- function(s, base_nombre) {
  base_nombre <- as.character(base_nombre %||% "")
  ast <- if (nzchar(base_nombre) && is.list(s$analitica_status_por_base)) {
    s$analitica_status_por_base[[base_nombre]] %||% list()
  } else {
    list()
  }
  gst <- if (nzchar(base_nombre) && is.list(s$graficos_status_por_base)) {
    s$graficos_status_por_base[[base_nombre]] %||% list()
  } else {
    list()
  }
  for (key in .ESTUDIO_ANALITICA_STATUS_KEYS) s[[key]] <- isTRUE(ast[[key]])
  for (key in .ESTUDIO_GRAFICOS_STATUS_KEYS) s[[key]] <- isTRUE(gst[[key]])
  s
}

# Init del estudio si no existe. Llama internamente a session_set para
# persistir.
estudio_ensure <- function(sid) {
  s <- session_get(sid)
  if (is.null(s$estudio)) {
    s$estudio <- list(
      nombre = NULL,
      bases = list(),
      processing_mode = "multibase",
      active_base = NULL
    )
    s$rp_data_sources <- list()
    s$rp_inst_sources <- list()
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
  } else {
    changed <- FALSE
    if (is.null(s$estudio$bases)) {
      s$estudio$bases <- list()
      changed <- TRUE
    }
    if (is.null(s$estudio$processing_mode) || !(as.character(s$estudio$processing_mode) %in% .ESTUDIO_PROCESSING_MODES)) {
      s$estudio$processing_mode <- "multibase"
      changed <- TRUE
    }
    if (!("active_base" %in% names(s$estudio))) {
      s$estudio$active_base <- NULL
      changed <- TRUE
    }
    if (is.null(s$rp_data_sources)) {
      s$rp_data_sources <- list()
      changed <- TRUE
    }
    if (is.null(s$rp_inst_sources)) {
      s$rp_inst_sources <- list()
      changed <- TRUE
    }
    if (changed) {
      s <- .mark_project_dirty(s)
      .session_env[[sid]] <- s
    }
  }
  invisible(s$estudio)
}

estudio_processing_mode <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio)) return("multibase")
  mode <- s$estudio$processing_mode %||% "multibase"
  if (!(as.character(mode) %in% .ESTUDIO_PROCESSING_MODES)) "multibase" else as.character(mode)
}

estudio_set_processing_mode <- function(sid, mode = "multibase") {
  estudio_ensure(sid)
  s <- session_get(sid)
  mode <- .estudio_mode_normalize(mode)
  s$estudio$processing_mode <- mode
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(mode)
}

estudio_promote_independent_siblings <- function(sid,
                                                 active_base = NULL,
                                                 nombre_nuevo = NULL,
                                                 source_alias = NULL,
                                                 source_title = NULL,
                                                 survey_id = NULL,
                                                 source_kind = "existing_project",
                                                 sibling_family_id = NULL) {
  estudio_ensure(sid)
  s <- session_get(sid)
  bases <- names(s$estudio$bases %||% list())
  if (!length(bases)) {
    stop_api(409, "E_NO_ESTUDIO", "Aún no hay bases en el estudio para convertir.")
  }
  if (length(bases) > .ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES) {
    stop_api(400, "E_BASE_LIMITE",
             sprintf("El modo de bases hermanas independientes admite máximo %d bases.",
                     .ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES))
  }

  active <- as.character(active_base %||% .estudio_active_base_name(s, fallback_first = TRUE) %||% "")
  if (!nzchar(active) || !(active %in% bases)) {
    stop_api(404, "E_BASE_NOT_FOUND",
             sprintf("Base '%s' no existe en el estudio. Disponibles: %s",
                     active, paste(bases, collapse = ", ")))
  }

  nuevo <- as.character(nombre_nuevo %||% "")
  if (nzchar(nuevo) && !identical(nuevo, active)) {
    estudio_rename_base(sid, active, nuevo)
    active <- nuevo
    s <- session_get(sid)
    bases <- names(s$estudio$bases %||% list())
  }

  family_id <- as.character(sibling_family_id %||% s$estudio$sibling_family_id %||% "")
  if (!nzchar(family_id)) family_id <- uuid::UUIDgenerate()
  promoted_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  source_kind <- as.character(source_kind %||% "existing_project")
  if (!nzchar(source_kind)) source_kind <- "existing_project"
  source_alias <- as.character(source_alias %||% source_title %||% "")
  source_title <- as.character(source_title %||% "")
  survey_id <- as.character(survey_id %||% "")

  for (b in bases) {
    meta <- s$estudio$bases[[b]] %||% list(nombre = b)
    meta$processing_mode <- "independent_siblings"
    if (is.null(meta$source_kind) || !nzchar(as.character(meta$source_kind))) {
      meta$source_kind <- source_kind
    }
    if (identical(b, active) && nzchar(source_alias)) meta$source_alias <- source_alias
    if (is.null(meta$source_alias) || !nzchar(as.character(meta$source_alias))) {
      meta$source_alias <- meta$source_title %||% b
    }
    if (identical(b, active) && nzchar(source_title)) meta$source_title <- source_title
    if (is.null(meta$source_title) || !nzchar(as.character(meta$source_title))) {
      meta$source_title <- b
    }
    if (identical(b, active) && nzchar(survey_id)) meta$survey_id <- survey_id
    if (is.null(meta$sibling_family_id) || !nzchar(as.character(meta$sibling_family_id))) {
      meta$sibling_family_id <- family_id
    }
    if (is.null(meta$imported_at) || !nzchar(as.character(meta$imported_at))) {
      meta$imported_at <- promoted_at
    }
    if (is.null(meta$response_filter)) {
      meta$response_filter <- list(kind = "existing_project")
    }
    s$estudio$bases[[b]] <- meta
  }

  s$estudio$processing_mode <- "independent_siblings"
  s$estudio$active_base <- active
  s$estudio$sibling_family_id <- family_id
  s$estudio$independent_siblings <- list(
    version = 1L,
    sibling_family_id = family_id,
    template_base = active,
    logic_policy = "shared_template",
    shared_logic = TRUE,
    status = "promoted_existing_project",
    updated_at = promoted_at
  )
  s$codif_source_active <- active
  s <- .estudio_capture_stage_flags(s, active)
  s <- .estudio_apply_stage_flags(s, active)
  fuente <- as.character(s$analitica_fuente %||% "")
  if (nzchar(fuente) && !grepl(":", fuente, fixed = TRUE)) {
    s$analitica_fuente <- paste(fuente, active, sep = ":")
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s$estudio)
}

estudio_independent_family_id <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio)) return(NULL)
  id <- as.character(
    s$estudio$sibling_family_id %||%
      (s$estudio$independent_siblings %||% list())$sibling_family_id %||%
      ""
  )
  if (is.na(id) || !nzchar(id)) NULL else id
}

estudio_mark_independent_shared_logic <- function(sid,
                                                  template_base = NULL,
                                                  audit = NULL,
                                                  status = "ready") {
  estudio_ensure(sid)
  s <- session_get(sid)
  bases <- names(s$estudio$bases %||% list())
  if (!length(bases)) return(invisible(NULL))
  template_base <- as.character(template_base %||% s$estudio$active_base %||% bases[1])
  if (!nzchar(template_base) || !(template_base %in% bases)) template_base <- bases[1]
  family_id <- estudio_independent_family_id(sid) %||% uuid::UUIDgenerate()
  now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  s$estudio$processing_mode <- "independent_siblings"
  s$estudio$sibling_family_id <- family_id
  s$estudio$independent_siblings <- list(
    version = 1L,
    sibling_family_id = family_id,
    template_base = template_base,
    logic_policy = "shared_template",
    shared_logic = TRUE,
    status = as.character(status %||% "ready"),
    audit = audit,
    updated_at = now
  )
  for (b in bases) {
    meta <- s$estudio$bases[[b]] %||% list(nombre = b)
    meta$processing_mode <- "independent_siblings"
    if (is.null(meta$sibling_family_id) || !nzchar(as.character(meta$sibling_family_id))) {
      meta$sibling_family_id <- family_id
    }
    s$estudio$bases[[b]] <- meta
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s$estudio$independent_siblings)
}

estudio_propagate_shared_codif_logic <- function(sid,
                                                 template_base = NULL,
                                                 targets = NULL,
                                                 overwrite = FALSE) {
  s <- session_get(sid)
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (!length(bases)) return(character(0))
  template_base <- as.character(template_base %||% (s$estudio$independent_siblings %||% list())$template_base %||% s$estudio$active_base %||% bases[1])
  if (!nzchar(template_base) || !(template_base %in% bases)) template_base <- bases[1]
  source_state <- (s$codif_por_base %||% list())[[template_base]]
  if (is.null(source_state) || !is.list(source_state)) return(character(0))
  targets <- as.character(targets %||% setdiff(bases, template_base))
  targets <- targets[nzchar(targets) & targets %in% bases]
  if (!length(targets)) return(character(0))
  if (is.null(s$codif_por_base) || !is.list(s$codif_por_base)) s$codif_por_base <- list()
  copied <- character(0)
  for (target in targets) {
    if (!isTRUE(overwrite) && !is.null(s$codif_por_base[[target]]) && length(s$codif_por_base[[target]])) {
      next
    }
    cloned <- source_state
    cloned$inst <- NULL
    cloned$data <- NULL
    cloned$familias_split <- NULL
    cloned$familias_xlsx_path <- NULL
    cloned$shared_logic_from <- template_base
    cloned$shared_logic_copied_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    s$codif_por_base[[target]] <- cloned
    copied <- c(copied, target)
  }
  if (length(copied)) {
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
  }
  copied
}

estudio_is_independent_siblings <- function(sid) {
  identical(estudio_processing_mode(sid), "independent_siblings")
}

estudio_active_base <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio)) return(NULL)
  .estudio_active_base_name(s, fallback_first = TRUE)
}

estudio_active_base_set <- function(sid, base_nombre) {
  estudio_ensure(sid)
  s <- session_get(sid)
  bases <- names(s$estudio$bases %||% list())
  if (length(bases) == 0L) {
    stop_api(409, "E_NO_ESTUDIO", "Aún no hay bases en el estudio (carga una en Fase 1).")
  }
  base_nombre <- if (is.null(base_nombre)) "" else as.character(base_nombre)
  if (!nzchar(base_nombre) || !(base_nombre %in% bases)) {
    stop_api(404, "E_BASE_NOT_FOUND",
             sprintf("Base '%s' no existe en el estudio. Disponibles: %s",
                     base_nombre, paste(bases, collapse = ", ")))
  }
  old_active <- .estudio_active_base_name(s, fallback_first = FALSE)
  if (identical(as.character(s$estudio$processing_mode %||% ""), "independent_siblings") &&
      !is.null(old_active) && nzchar(as.character(old_active))) {
    s <- .estudio_capture_stage_flags(s, old_active)
  }
  s$estudio$active_base <- base_nombre
  s$codif_source_active <- base_nombre
  if (identical(as.character(s$estudio$processing_mode %||% ""), "independent_siblings")) {
    s <- .estudio_apply_stage_flags(s, base_nombre)
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(base_nombre)
}

# Devuelve la lista plana de bases del estudio.
estudio_list_bases <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || is.null(s$estudio)) return(list())
  s$estudio$bases
}

# Agrega una base al estudio. Parámetros:
#   - nombre: string único dentro del estudio (ej. "docentes").
#   - xlsform_file_id / data_file_id: identificadores del file store.
#   - data_ext: extensión del data ("xlsx" / "sav" / "csv") para que los
#     lectores sepan cómo abrirlo más adelante.
#   - rp_data / rp_inst: objetos R ya parseados (se guardan en los
#     maps paralelos _sources).
#   - n_filas / n_columnas: metadata de preview.
#
# Valida tope de bases y nombres únicos.
estudio_add_base <- function(sid, nombre, xlsform_file_id, data_file_id,
                              data_ext, rp_data, rp_inst,
                              n_filas = NA_integer_, n_columnas = NA_integer_,
                              extra_meta = list()) {
  estudio_ensure(sid)
  s <- session_get(sid)
  if (!is.character(nombre) || !nzchar(nombre)) {
    stop_api(400, "E_BASE_NOMBRE", "La base necesita un nombre identificador.")
  }
  if (grepl("\\$", nombre)) {
    # El `$` se usa como separador `fuente$variable` en los planes de
    # slides. Prohibirlo en nombres de base evita ambigüedad.
    stop_api(400, "E_BASE_NOMBRE_INVALIDO",
             sprintf("El nombre '%s' no puede contener '$'.", nombre))
  }
  if (nombre %in% names(s$estudio$bases)) {
    stop_api(409, "E_BASE_DUP", sprintf("Ya existe una base con nombre '%s' en este estudio.", nombre))
  }
  base_limit <- .ESTUDIO_MAX_BASES
  if (identical(as.character(s$estudio$processing_mode %||% ""), "independent_siblings")) {
    base_limit <- .ESTUDIO_INDEPENDENT_SIBLINGS_MAX_BASES
  }
  if (length(s$estudio$bases) >= base_limit) {
    stop_api(400, "E_BASE_LIMITE",
             sprintf("El estudio llegó al límite de %d bases.", base_limit))
  }
  if (!is.null(extra_meta) && !is.list(extra_meta)) {
    stop_api(400, "E_BASE_META_INVALIDA", "La metadata adicional de la base debe ser una lista.")
  }

  base_meta <- list(
    nombre          = nombre,
    xlsform_file_id = xlsform_file_id,
    data_file_id    = data_file_id,
    data_ext        = data_ext,
    n_filas         = n_filas,
    n_columnas      = n_columnas,
    added_at        = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  reserved <- c("nombre", "xlsform_file_id", "data_file_id", "data_ext",
                "n_filas", "n_columnas", "added_at")
  for (k in names(extra_meta %||% list())) {
    if (!(k %in% reserved)) base_meta[[k]] <- extra_meta[[k]]
  }
  s$estudio$bases[[nombre]] <- base_meta
  s$rp_data_sources[[nombre]] <- rp_data
  s$rp_inst_sources[[nombre]] <- rp_inst

  # Back-compat: si esta es la primera base, espejar a rp_data/rp_inst.
  if (length(s$estudio$bases) == 1L) {
    s$rp_data <- rp_data
    s$rp_inst <- rp_inst
    s$estudio$active_base <- nombre
    s$codif_source_active <- nombre
  } else if (is.null(.estudio_active_base_name(s, fallback_first = FALSE))) {
    s$estudio$active_base <- nombre
    s$codif_source_active <- nombre
  }

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s$estudio$bases[[nombre]])
}

# Elimina una base del estudio. Si se elimina la "primera" (la que
# espejaba a rp_data/rp_inst), se re-espeja a la siguiente que quede.
estudio_remove_base <- function(sid, nombre) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe en el estudio.", nombre))
  }
  s$estudio$bases[[nombre]] <- NULL
  s$rp_data_sources[[nombre]] <- NULL
  s$rp_inst_sources[[nombre]] <- NULL
  if (!is.null(s$analitica_config_por_base)) s$analitica_config_por_base[[nombre]] <- NULL
  if (!is.null(s$analitica_status_por_base)) s$analitica_status_por_base[[nombre]] <- NULL
  if (!is.null(s$graficos_config_por_base)) s$graficos_config_por_base[[nombre]] <- NULL
  if (!is.null(s$graficos_status_por_base)) s$graficos_status_por_base[[nombre]] <- NULL

  # Re-espejar si quedan bases; sino, limpiar los campos legacy.
  remaining <- names(s$estudio$bases)
  if (length(remaining) > 0L) {
    first <- remaining[1]
    s$rp_data <- s$rp_data_sources[[first]]
    s$rp_inst <- s$rp_inst_sources[[first]]
    if (identical(s$estudio$active_base %||% NULL, nombre) ||
        identical(s$codif_source_active %||% NULL, nombre)) {
      s$estudio$active_base <- first
      s$codif_source_active <- first
    }
  } else {
    s$rp_data <- NULL
    s$rp_inst <- NULL
    s$estudio$active_base <- NULL
    s$codif_source_active <- NULL
  }

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

# Renombra una base. No toca rp_data / rp_inst (son objetos R agnósticos
# al nombre dentro del estudio).
estudio_rename_base <- function(sid, nombre_actual, nombre_nuevo) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre_actual]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre_actual))
  }
  if (!is.character(nombre_nuevo) || !nzchar(nombre_nuevo) || grepl("\\$", nombre_nuevo)) {
    stop_api(400, "E_BASE_NOMBRE_INVALIDO",
             sprintf("Nombre nuevo inválido: '%s'.", nombre_nuevo))
  }
  if (nombre_nuevo %in% names(s$estudio$bases) && nombre_nuevo != nombre_actual) {
    stop_api(409, "E_BASE_DUP", sprintf("Ya hay una base con nombre '%s'.", nombre_nuevo))
  }
  if (nombre_nuevo == nombre_actual) return(invisible(FALSE))

  # Rename preservando orden: reconstruimos cada map en el mismo orden
  # pero cambiando la key.
  rename_key <- function(lst, old, new) {
    new_lst <- list()
    for (k in names(lst)) {
      new_k <- if (identical(k, old)) new else k
      new_lst[[new_k]] <- lst[[k]]
    }
    new_lst
  }
  s$estudio$bases <- rename_key(s$estudio$bases, nombre_actual, nombre_nuevo)
  s$estudio$bases[[nombre_nuevo]]$nombre <- nombre_nuevo
  s$rp_data_sources <- rename_key(s$rp_data_sources, nombre_actual, nombre_nuevo)
  s$rp_inst_sources <- rename_key(s$rp_inst_sources, nombre_actual, nombre_nuevo)
  if (!is.null(s$analitica_rp_data_sources)) {
    s$analitica_rp_data_sources <- rename_key(s$analitica_rp_data_sources, nombre_actual, nombre_nuevo)
  }
  if (!is.null(s$analitica_rp_inst_sources)) {
    s$analitica_rp_inst_sources <- rename_key(s$analitica_rp_inst_sources, nombre_actual, nombre_nuevo)
  }
  if (identical(s$estudio$active_base %||% NULL, nombre_actual)) {
    s$estudio$active_base <- nombre_nuevo
  }
  if (identical(s$codif_source_active %||% NULL, nombre_actual)) {
    s$codif_source_active <- nombre_nuevo
  }
  if (!is.null(s$codif_por_base)) {
    s$codif_por_base <- rename_key(s$codif_por_base, nombre_actual, nombre_nuevo)
  }
  if (!is.null(s$analitica_config_por_base)) {
    s$analitica_config_por_base <- rename_key(s$analitica_config_por_base, nombre_actual, nombre_nuevo)
  }
  if (!is.null(s$analitica_status_por_base)) {
    s$analitica_status_por_base <- rename_key(s$analitica_status_por_base, nombre_actual, nombre_nuevo)
  }
  if (!is.null(s$graficos_config_por_base)) {
    s$graficos_config_por_base <- rename_key(s$graficos_config_por_base, nombre_actual, nombre_nuevo)
  }
  if (!is.null(s$graficos_status_por_base)) {
    s$graficos_status_por_base <- rename_key(s$graficos_status_por_base, nombre_actual, nombre_nuevo)
  }

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

estudio_update_base_metadata <- function(sid, nombre, patch = list()) {
  estudio_ensure(sid)
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre))
  }
  if (!is.list(patch)) {
    stop_api(400, "E_BASE_META_INVALIDA", "La metadata de base debe ser un objeto.")
  }
  allowed <- c(
    "source_alias", "source_title", "source_channel", "source_kind", "survey_id",
    "response_filter", "surveymonkey_source_spec", "consent_var",
    "surveymonkey_decision_policy", "surveymonkey_decision_audit",
    "surveymonkey_raw_snapshot_file_id", "surveymonkey_effective_data_file_id",
    "surveymonkey_workbook_file_id", "surveymonkey_workbook_snapshot_file_id",
    "surveymonkey_workbook_import",
    "surveymonkey_sav_bundle_file_id", "surveymonkey_sav_bundle_snapshot_file_id",
    "surveymonkey_sav_bundle_import"
  )
  meta <- s$estudio$bases[[nombre]]
  for (key in intersect(names(patch), allowed)) {
    if (key %in% c("response_filter", "surveymonkey_source_spec",
                   "surveymonkey_decision_policy", "surveymonkey_decision_audit",
                   "surveymonkey_workbook_import", "surveymonkey_sav_bundle_import")) {
      meta[[key]] <- patch[[key]]
      next
    }
    value <- trimws(as.character(patch[[key]] %||% "")[1])
    if (is.na(value)) value <- ""
    if (identical(key, "source_alias") && !nzchar(value)) {
      stop_api(400, "E_SOURCE_ALIAS_EMPTY", "El alias visible no puede quedar vacío.")
    }
    meta[[key]] <- value
  }
  meta$metadata_updated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  s$estudio$bases[[nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(meta)
}

# Genera el próximo nombre automático libre dentro del estudio. Se usa
# cuando el usuario no especifica nombre al agregar base (flujo sin
# fricción de la Fase 1): `base_1`, `base_2`, …, saltando los que ya
# están tomados. Siempre retorna un nombre disponible dentro del tope.
# -----------------------------------------------------------------------------
# Validación v2 — scope por base dentro del estudio
# -----------------------------------------------------------------------------
# Cada base tiene su propio "workspace" de validación: plan, evaluación,
# reglas custom y caches. Se almacena en:
#   s$estudio$bases[[nombre]]$validacion = list(
#     plan_result,        # tibble del plan de reglas (instrumento + custom compiladas)
#     evaluacion,         # resultado de evaluar_consistencia()
#     reglas_custom,      # list de ReglaCustom (ver router_reglas_custom.R)
#     explorador_cache,   # hash -> view descriptors (lazy)
#     limpieza_draft,     # decisiones de cierre
#     limpieza_preview,   # preview before/after del borrador
#     limpieza_artifacts  # artefactos generados al finalizar
#   )
#
# Fallback legacy: si la sesión aún no tiene estudio pero sí rp_data, el
# scope apunta a la sesión entera (compatibilidad con flujo single-base
# antes de v0.2). Retorna list() si no hay nada aún.
validacion_scope_get <- function(sid, base_nombre = NULL, key = NULL) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(NULL)
  base_nombre <- .resolve_base_nombre(s, base_nombre)
  if (is.null(base_nombre)) {
    # Legacy single-base: usamos campos planos de la sesión.
    scope <- list(
      plan_result      = s$plan_result,
      evaluacion       = s$evaluacion,
      reglas_custom    = s$reglas_custom %||% list(),
      operational_config = s$validacion_operational_config %||% .validation_operational_default_config(),
      variables_excluidas = s$validacion_variables_excluidas %||% character(0),
      explorador_cache = s$explorador_cache %||% list(),
      limpieza_draft   = s$limpieza_draft %||% list(),
      limpieza_preview = s$limpieza_preview %||% NULL,
      limpieza_artifacts = s$limpieza_artifacts %||% list()
    )
  } else {
    scope <- s$estudio$bases[[base_nombre]]$validacion %||% list(
      plan_result      = NULL,
      evaluacion       = NULL,
      reglas_custom    = list(),
      operational_config = .validation_operational_default_config(),
      variables_excluidas = character(0),
      explorador_cache = list(),
      limpieza_draft   = list(),
      limpieza_preview = NULL,
      limpieza_artifacts = list()
    )
  }
  if (is.null(key)) scope else scope[[key]]
}

validacion_scope_set <- function(sid, base_nombre = NULL, key, value) {
  s <- session_get(sid)
  base_nombre <- .resolve_base_nombre(s, base_nombre)
  if (is.null(base_nombre)) {
    # Fallback legacy: guardamos en la raíz de la sesión.
    if (identical(key, "variables_excluidas")) {
      s$validacion_variables_excluidas <- value
    } else if (identical(key, "operational_config")) {
      s$validacion_operational_config <- value
    } else {
      s[[key]] <- value
    }
  } else {
    if (is.null(s$estudio$bases[[base_nombre]]$validacion)) {
      s$estudio$bases[[base_nombre]]$validacion <- list(
        plan_result      = NULL,
        evaluacion       = NULL,
        reglas_custom    = list(),
        operational_config = .validation_operational_default_config(),
        variables_excluidas = character(0),
        explorador_cache = list(),
        limpieza_draft   = list(),
        limpieza_preview = NULL,
        limpieza_artifacts = list()
      )
    }
    s$estudio$bases[[base_nombre]]$validacion[[key]] <- value
  }
  # Marcar dirty excepto para el cache (que se regenera al vuelo).
  if (!identical(key, "explorador_cache")) {
    s <- .mark_project_dirty(s)
  }
  .session_env[[sid]] <- s
  invisible(value)
}

.validacion_empty_scope <- function(operational_config = NULL) {
  list(
    plan_result      = NULL,
    evaluacion       = NULL,
    reglas_custom    = list(),
    operational_config = operational_config %||% .validation_operational_default_config(),
    variables_excluidas = character(0),
    explorador_cache = list(),
    limpieza_draft   = list(),
    limpieza_preview = NULL,
    limpieza_artifacts = list()
  )
}

# Devuelve TRUE si `key` (p.ej. "evaluacion" o "plan_result") ya está
# guardado en la validación de la sesión — ya sea en el scope legacy
# (raíz de la sesión, single-base pre-v0.2) o en CUALQUIER base del
# estudio multi-base (v0.2+). En multibase la validación se persiste por
# base en s$estudio$bases[[b]]$validacion, dejando la raíz (s$evaluacion /
# s$plan_result) NULL; el gauge del Home solo necesita saber "¿se validó /
# se armó el plan en algún lado?", no en qué base concreta, así que un
# match en cualquier base cuenta como hecho.
validacion_key_present_any <- function(s, key) {
  if (is.null(s)) return(FALSE)
  if (!is.null(s[[key]])) return(TRUE)
  bases <- s$estudio$bases %||% list()
  if (length(bases) == 0L) return(FALSE)
  any(vapply(bases, function(base) {
    if (!is.list(base)) return(FALSE)
    !is.null((base$validacion %||% list())[[key]])
  }, logical(1)))
}

.invalidate_processing_state <- function(s, base_nombre = NULL) {
  # Todo lo que depende del par XLSForm + data debe recomputarse cuando
  # alguno de los dos cambia. Si no, Fase 2 puede mostrar plan/auditoría/
  # limpieza del instrumento anterior aunque la carga ya sea nueva.
  s$plan_result <- NULL
  s$evaluacion <- NULL
  s$reglas_custom <- list()
  s$explorador_cache <- list()
  s$limpieza_draft <- list()
  s$limpieza_preview <- NULL
  s$limpieza_artifacts <- list()
  s$analitica_prep_ok <- FALSE
  s$analitica_codebook_ok <- FALSE
  s$analitica_frecuencias_ok <- FALSE
  s$analitica_cruces_ok <- FALSE
  s$analitica_spss_ok <- FALSE
  s$analitica_enumeradores_ok <- FALSE
  s$analitica_dim_ok <- FALSE
  s$analitica_multibase_ok <- FALSE
  s$analitica_panel_ok <- FALSE
  s$analitica_ficha_tecnica_ok <- FALSE
  s$analitica_multibase_available <- FALSE
  s$graficos_ppt_ok <- FALSE
  s$graficos_word_ok <- FALSE

  invalidate_all <- is.null(base_nombre) || !nzchar(base_nombre)
  targets <- if (!invalidate_all) {
    as.character(base_nombre)
  } else {
    unique(c(
      names((s$estudio %||% list())$bases %||% list()),
      names(s$codif_por_base %||% list()),
      names(s$analitica_rp_data_sources %||% list()),
      names(s$analitica_rp_inst_sources %||% list()),
      names(s$analitica_status_por_base %||% list())
    ))
  }

  # El caché singular representa una sola base. Su clave moderna termina en
  # `:<base>`; para proyectos legacy sin ese sufijo, la base activa es la mejor
  # evidencia disponible. Una invalidación de una hermana no debe descartarlo.
  known_bases <- unique(c(
    names((s$estudio %||% list())$bases %||% list()),
    names(s$analitica_rp_data_sources %||% list()),
    names(s$analitica_rp_inst_sources %||% list()),
    targets
  ))
  cache_source <- as.character(s$analitica_fuente %||% "")[1]
  if (is.na(cache_source)) cache_source <- ""
  source_matches <- known_bases[vapply(known_bases, function(bn) {
    identical(cache_source, bn) || endsWith(cache_source, paste0(":", bn))
  }, logical(1))]
  cache_base <- if (length(source_matches)) {
    source_matches[which.max(nchar(source_matches))]
  } else {
    .estudio_active_base_name(s, fallback_first = TRUE)
  }
  clear_singular_cache <- invalidate_all ||
    (!is.null(cache_base) && cache_base %in% targets)
  if (isTRUE(clear_singular_cache)) {
    # Retener los nombres con valor NULL evita el partial matching de `$`
    # contra `analitica_rp_*_sources` cuando se consulta el estado después.
    s[c("analitica_rp_data", "analitica_rp_inst", "analitica_fuente")] <-
      list(NULL, NULL, NULL)
  }

  # Codificación y Analítica dependen de la pareja invalidada. Limpiar
  # solo sus entradas evita perder el avance independiente de bases hermanas.
  for (bn in targets) {
    if (is.list(s$codif_por_base)) s$codif_por_base[[bn]] <- NULL
    if (is.list(s$analitica_rp_data_sources)) s$analitica_rp_data_sources[[bn]] <- NULL
    if (is.list(s$analitica_rp_inst_sources)) s$analitica_rp_inst_sources[[bn]] <- NULL
    if (is.list(s$analitica_status_por_base)) s$analitica_status_por_base[[bn]] <- NULL
  }

  if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
    validation_targets <- intersect(targets, names(s$estudio$bases))
    for (bn in validation_targets) {
      previous <- s$estudio$bases[[bn]]$validacion %||% list()
      s$estudio$bases[[bn]]$validacion <- .validacion_empty_scope(
        operational_config = previous$operational_config %||% NULL
      )
    }
  }
  s
}

# Resuelve el nombre efectivo de la base. Reglas:
# - Si viene base_nombre y existe en el estudio, usar ese.
# - Si viene pero no existe, error.
# - Si no viene y hay estudio con ≥1 base, usar la base activa.
# - Si no hay estudio pero hay rp_data legacy, retornar NULL (modo legacy).
# - Si no hay nada, retornar NULL y el caller decide.
.resolve_base_nombre <- function(s, base_nombre) {
  if (!is.null(base_nombre) && nzchar(base_nombre)) {
    if (is.null(s$estudio) || is.null(s$estudio$bases[[base_nombre]])) {
      stop_api(404, "E_BASE_NOT_FOUND",
               sprintf("Base '%s' no existe en el estudio.", base_nombre))
    }
    return(base_nombre)
  }
  if (!is.null(s$estudio) && length(s$estudio$bases) > 0L) {
    return(.estudio_active_base_name(s, fallback_first = TRUE))
  }
  NULL  # legacy single-base
}

estudio_next_auto_name <- function(sid) {
  s <- session_get(sid, required = FALSE)
  existing <- if (is.null(s) || is.null(s$estudio)) character()
              else names(s$estudio$bases)
  i <- 1L
  repeat {
    candidate <- sprintf("base_%d", i)
    if (!(candidate %in% existing)) return(candidate)
    i <- i + 1L
    if (i > 999L) stop_api(500, "E_AUTO_NAME_EXHAUSTED",
                           "No se pudo generar nombre automático.")
  }
}

# Reemplaza los archivos (xlsform y/o data) de una base existente.
# Re-parsea y actualiza los maps _sources. Si se toca la primera base,
# también refresca los mirrors rp_data/rp_inst.
estudio_replace_base_files <- function(sid, nombre,
                                        xlsform_file_id = NULL,
                                        data_file_id    = NULL,
                                        data_ext        = NULL,
                                        rp_data         = NULL,
                                        rp_inst         = NULL,
                                        n_filas         = NA_integer_,
                                        n_columnas      = NA_integer_) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre))
  }
  meta <- s$estudio$bases[[nombre]]
  if (!is.null(xlsform_file_id) && nzchar(xlsform_file_id)) {
    meta$xlsform_file_id <- xlsform_file_id
    if (!is.null(rp_inst)) s$rp_inst_sources[[nombre]] <- rp_inst
  }
  if (!is.null(data_file_id) && nzchar(data_file_id)) {
    meta$data_file_id <- data_file_id
    if (!is.null(data_ext) && nzchar(data_ext)) meta$data_ext <- data_ext
    if (!is.null(rp_data)) s$rp_data_sources[[nombre]] <- rp_data
    if (!is.na(n_filas))    meta$n_filas    <- n_filas
    if (!is.na(n_columnas)) meta$n_columnas <- n_columnas
  }
  s$estudio$bases[[nombre]] <- meta

  if ((!is.null(xlsform_file_id) && nzchar(xlsform_file_id)) ||
      (!is.null(data_file_id) && nzchar(data_file_id))) {
    s <- .invalidate_processing_state(s, nombre)
  }

  # Refrescar mirror si es la primera base.
  first <- names(s$estudio$bases)[1]
  if (identical(first, nombre)) {
    s$rp_data <- s$rp_data_sources[[nombre]]
    s$rp_inst <- s$rp_inst_sources[[nombre]]
  }

  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s$estudio$bases[[nombre]])
}

estudio_preserve_original_base_files <- function(sid, nombre) {
  s <- session_get(sid)
  if (is.null(s$estudio) || is.null(s$estudio$bases[[nombre]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre))
  }
  meta <- s$estudio$bases[[nombre]]
  if (is.null(meta$original_xlsform_file_id) || !nzchar(as.character(meta$original_xlsform_file_id))) {
    meta$original_xlsform_file_id <- meta$xlsform_file_id
  }
  if (is.null(meta$original_data_file_id) || !nzchar(as.character(meta$original_data_file_id))) {
    meta$original_data_file_id <- meta$data_file_id
  }
  if (is.null(meta$original_data_ext) || !nzchar(as.character(meta$original_data_ext))) {
    meta$original_data_ext <- meta$data_ext
  }
  s$estudio$bases[[nombre]] <- meta
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(meta)
}

# Setea/limpia el nombre del estudio (opcional — solo metadata).
estudio_set_nombre <- function(sid, nombre) {
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$nombre <- if (is.null(nombre) || !nzchar(nombre)) NULL else as.character(nombre)
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(s$estudio$nombre)
}

# Devuelve el map plano rp_data_sources. Si el estudio aún no se inicializó
# pero existe un legacy s$rp_data, lo envuelve en list(default = ...) para
# que los consumidores multi-base funcionen sin rupturas.
estudio_data_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  if (!is.null(s$rp_data_sources) && length(s$rp_data_sources) > 0L) {
    return(s$rp_data_sources)
  }
  if (!is.null(s$rp_data)) return(list(default = s$rp_data))
  list()
}

estudio_inst_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(list())
  if (!is.null(s$rp_inst_sources) && length(s$rp_inst_sources) > 0L) {
    return(s$rp_inst_sources)
  }
  if (!is.null(s$rp_inst)) return(list(default = s$rp_inst))
  list()
}

estudio_processing_filter_sources <- function(sid, data_sources = NULL, inst_sources = NULL) {
  ds <- data_sources %||% estudio_data_sources(sid)
  is_ <- inst_sources %||% estudio_inst_sources(sid)
  if (!estudio_is_independent_siblings(sid)) {
    return(list(data_sources = ds, inst_sources = is_))
  }
  active <- estudio_active_base(sid)
  if (is.null(active) || !nzchar(active)) {
    return(list(data_sources = list(), inst_sources = list()))
  }
  list(
    data_sources = if (!is.null(ds[[active]])) stats::setNames(list(ds[[active]]), active) else list(),
    inst_sources = if (!is.null(is_[[active]])) stats::setNames(list(is_[[active]]), active) else list()
  )
}

estudio_processing_data_sources <- function(sid) {
  estudio_processing_filter_sources(sid)$data_sources
}

estudio_processing_inst_sources <- function(sid) {
  estudio_processing_filter_sources(sid)$inst_sources
}

# ===========================================================================
# CODIFICACIÓN — state scoped por base (v0.2+)
# ===========================================================================
#
# Cada base del estudio tiene su propio progreso de codificación (familias
# generadas, grupos recodificados, respuestas por pregunta, plantilla de
# códigos, etc). Esto permite al analista codificar docentes, luego
# estudiantes, luego administrativos sin que se pise el trabajo.
#
# Modelo:
#   s$codif_por_base = list(
#     docentes    = list(familias_draft, familias_generated, marcadas,
#                        grupos_recod, respuestas_recod, plantilla_template,
#                        plantilla_codigos_file_id, codigos_sheets_meta,
#                        familias_file_id, familias_split, familias_xlsx_path,
#                        aplicado),
#     estudiantes = list(...),
#     administrativos = list(...)
#   )
#   s$codif_source_active = "docentes"  # base en la que el analista trabaja
#
# La fuente "activa" se usa por default cuando un endpoint no especifica
# source. Si el estudio cambia (reset, nuevo demo), se limpia.
#
# Los dataframes adaptados al XLSForm (`codif_data`) y el instrumento (`codif_inst`) NO se
# guardan bajo codif_por_base — se leen on-demand de estudio_data_sources()
# y estudio_inst_sources(). Así evitamos duplicar memoria y siempre leemos
# los datos frescos de la base activa.

# Devuelve el nombre de la base activa para codificación. Si no está
# seteado, usa la primera base del estudio. Fallback: "default".
codif_source_active <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return("default")
  active <- .estudio_active_base_name(s, fallback_first = TRUE)
  if (!is.null(active) && nzchar(active)) return(active)
  "default"
}

# Setea la base activa. Valida que exista en el estudio.
codif_source_set <- function(sid, source) {
  estudio_active_base_set(sid, source)
}

# Lee un campo del state de codificación para la base activa (o la
# especificada explícitamente con `source`).
codif_get <- function(sid, key, default = NULL, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  val <- s$codif_por_base[[src]][[key]]
  if (is.null(val)) default else val
}

# Escribe un campo del state de codificación para la base activa.
codif_set <- function(sid, key, value, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  if (is.null(s$codif_por_base)) s$codif_por_base <- list()
  if (is.null(s$codif_por_base[[src]])) s$codif_por_base[[src]] <- list()
  s$codif_por_base[[src]][[key]] <- value
  # "inst" y "data" son caches del XLSForm parseado y del dataframe adaptado
  # — se rederivan al abrir un .pulso desde el file_id, así que no son
  # cambios "user-visibles" que ameriten marcar dirty.
  if (!(key %in% c("inst", "data"))) {
    s <- .mark_project_dirty(s)
  }
  .session_env[[sid]] <- s
  invisible(value)
}

# IMPORTANTE: codificación NO usa `rp_data` / `rp_inst` (que son el
# output de reporte_data / reporte_instrumento, pensados para graficadores
# y reportes estadísticos). Usa la data de respuestas adaptada al XLSForm
# y el XLSForm parseado con leer_instrumento_xlsform(). Los siguientes
# helpers exponen esos datos por base, cacheando on-demand en
# `codif_por_base[[src]]$inst` / $data`.

codif_xlsform_path <- function(sid, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  b <- s$estudio$bases[[src]]
  if (is.null(b)) return(NULL)
  meta <- s$files[[b$xlsform_file_id]]
  if (is.null(meta)) return(NULL)
  meta$path
}

codif_data_meta <- function(sid, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  b <- s$estudio$bases[[src]]
  if (is.null(b)) return(NULL)
  s$files[[b$data_file_id]]
}

# Devuelve el instrumento XLSForm (leer_instrumento_xlsform) de la base
# activa. Cachea en `codif_por_base[[src]]$inst` la primera vez.
codif_inst_cached <- function(sid, source = NULL) {
  src <- if (is.null(source)) codif_source_active(sid) else source
  cached <- codif_get(sid, "inst", source = src)
  if (!is.null(cached)) return(cached)
  path <- codif_xlsform_path(sid, src)
  if (is.null(path)) {
    stop_api(409, "E_NO_XLSFORM",
             sprintf("La base '%s' no tiene XLSForm cargado.", src))
  }
  inst <- leer_instrumento_xlsform(path)
  codif_set(sid, "inst", inst, source = src)
  inst
}

# Dataframe de la base activa, adaptado al contrato del XLSForm.
codif_data_cached <- function(sid, source = NULL) {
  src <- if (is.null(source)) codif_source_active(sid) else source
  cached <- codif_get(sid, "data", source = src)
  if (!is.null(cached)) return(cached)

  s <- session_get(sid)
  scope_source <- if (identical(src, "default") && is.null(s$estudio)) NULL else src
  final_scope <- tryCatch(validacion_scope_get(sid, scope_source), error = function(e) NULL)
  finalized_at <- final_scope$limpieza_artifacts$finalized_at %||% NULL
  final_data <- final_scope$limpieza_preview$data_final %||% NULL
  if (!is.null(finalized_at) && nzchar(as.character(finalized_at)) && is.data.frame(final_data)) {
    codif_set(sid, "data", final_data, source = src)
    return(final_data)
  }

  meta <- codif_data_meta(sid, src)
  if (is.null(meta)) {
    stop_api(409, "E_NO_DATA",
             sprintf("La base '%s' no tiene data cargada.", src))
  }
  df <- .read_data_any(meta)
  inst <- codif_inst_cached(sid, src)
  df <- normalize_data_for_xlsform(df, inst)
  codif_set(sid, "data", df, source = src)
  df
}

# Devuelve un snapshot del state de codificación de una base. Útil para
# el frontend al cambiar entre bases y también para export/import.
codif_snapshot <- function(sid, source = NULL) {
  s <- session_get(sid)
  src <- if (is.null(source)) codif_source_active(sid) else source
  s$codif_por_base[[src]] %||% list()
}
