# La fuente de verdad de slides + graficadores vive en
# `graficos_metadata.R` (mismo directorio). Ese archivo define:
#   - .SLIDES_META / .GRAFICADORES_META: catálogo humano con copy, iconos,
#     tipos de input por arg, agrupación semántica.
#   - .slide_names() / .graf_names() / .slide_slots() / .slide_categoria()
#     como API pública para el router.
# Acá solo exponemos aliases cortos para mantener compatibilidad con el
# código preexistente (`.SLIDE_REGISTRY`, `.GRAFICADOR_REGISTRY`).

.SLIDE_REGISTRY <- setNames(
  lapply(.slide_names(), function(nm) list(
    cat   = .slide_categoria(nm),
    grafs = setdiff(.slide_slots(nm), "icono")  # el slot `icono` va por catálogo PNG, no por graficador
  )),
  .slide_names()
)

.GRAFICADOR_REGISTRY <- .graf_names()
.GRAFICADOR_LEGACY_ALIASES <- c(
  p_barras = "p_barras_agrupadas"
)

.graficos_resolve_graficador_name <- function(name, graficador_registry = .GRAFICADOR_REGISTRY) {
  raw <- as.character(name %||% "")
  raw <- if (length(raw)) raw[[1]] else ""
  if (is.na(raw) || !nzchar(raw)) return("")
  candidate <- .GRAFICADOR_LEGACY_ALIASES[[raw]] %||% raw
  if (candidate %in% graficador_registry) candidate else raw
}

.normalize_plan <- function(plan) {
  if (is.null(plan)) return(list(slides = list()))
  if (is.data.frame(plan)) plan <- as.list(plan)
  slides <- plan$slides %||% list()
  if (is.data.frame(slides)) {
    slides <- lapply(seq_len(nrow(slides)), function(i) {
      row <- as.list(slides[i, , drop = FALSE])
      row <- lapply(row, function(v) if (is.list(v) && length(v) == 1) v[[1]] else v)
      row
    })
  } else if (is.list(slides) && !is.null(names(slides))) {
    slides <- list(slides)
  }
  slides <- lapply(slides, function(s) {
    s <- as.list(s)
    if (!is.null(s$payload)) {
      s$payload <- if (is.data.frame(s$payload)) as.list(s$payload) else as.list(s$payload)
    }
    s
  })
  plan$slides <- slides
  plan
}

.as_json_list <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.data.frame(x)) return(as.list(x))
  if (is.list(x)) return(x)
  as.list(x)
}

.clean_rebuild_args <- function(args, fn) {
  args <- as.list(args %||% list())
  if ("titulo" %in% names(args) && "overrides" %in% names(formals(fn))) {
    title_value <- args$titulo
    has_title <- !(
      is.null(title_value) ||
        length(title_value) == 0L ||
        (length(title_value) == 1L && is.list(title_value) && is.null(title_value[[1]])) ||
        (length(title_value) == 1L && is.atomic(title_value) && is.na(title_value)) ||
        (length(title_value) == 1L && is.character(title_value) && !nzchar(trimws(title_value)))
    )
    if (isTRUE(has_title)) {
      overrides <- .as_json_list(args$overrides) %||% list()
      override_title <- overrides$titulo %||% NULL
      has_override_title <- !(
        is.null(override_title) ||
          length(override_title) == 0L ||
          (length(override_title) == 1L && is.list(override_title) && is.null(override_title[[1]])) ||
          (length(override_title) == 1L && is.atomic(override_title) && is.na(override_title)) ||
          (length(override_title) == 1L && is.character(override_title) && !nzchar(trimws(override_title)))
      )
      if (!isTRUE(has_override_title)) {
        overrides$titulo <- as.character(title_value)[1]
      }
      args$overrides <- overrides
      args$titulo <- NULL
    }
  }
  args <- args[names(args) %in% names(formals(fn))]
  args[!vapply(args, function(v) {
    is.null(v) ||
      length(v) == 0L ||
      (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
      (length(v) == 1L && is.atomic(v) && is.na(v))
  }, logical(1))]
}

.graficos_is_blank_json_value <- function(x) {
  is.null(x) ||
    length(x) == 0L ||
    (length(x) == 1L && is.list(x) && is.null(x[[1]])) ||
    (length(x) == 1L && is.atomic(x) && is.na(x)) ||
    (length(x) == 1L && is.character(x) && !nzchar(trimws(x)))
}

.graficos_icon_ref <- function(x) {
  if (.graficos_is_blank_json_value(x)) return("")
  if (is.list(x) && !inherits(x, "ppt_element")) {
    if (!is.null(x$id)) return(.graficos_icon_ref(x$id))
    if (!is.null(x$file_id)) return(.graficos_icon_ref(x$file_id))
    if (!is.null(x$path)) return(.graficos_icon_ref(x$path))
    if (length(x) == 1L && is.null(names(x))) return(.graficos_icon_ref(x[[1]]))
  }
  if (!is.atomic(x) || length(x) < 1L) return("")
  trimws(as.character(x[[1]]))
}

.graficos_icon_plot <- function(path) {
  if (!requireNamespace("png", quietly = TRUE)) {
    stop("Se requiere el paquete 'png' para renderizar iconos PNG.", call. = FALSE)
  }
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("Se requiere el paquete 'ggplot2' para renderizar iconos PNG.", call. = FALSE)
  }
  if (!requireNamespace("grid", quietly = TRUE)) {
    stop("Se requiere el paquete 'grid' para renderizar iconos PNG.", call. = FALSE)
  }
  if (!file.exists(path)) {
    stop(sprintf("Icono no encontrado en disco: %s", path), call. = FALSE)
  }
  img <- tryCatch(
    png::readPNG(path),
    error = function(e) stop(sprintf("No se pudo leer el PNG del icono: %s", conditionMessage(e)), call. = FALSE)
  )
  grob <- grid::rasterGrob(img, interpolate = TRUE)
  ggplot2::ggplot() +
    ggplot2::annotation_custom(grob, xmin = 0, xmax = 1, ymin = 0, ymax = 1) +
    ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) +
    ggplot2::theme_void() +
    ggplot2::theme(
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      panel.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      plot.margin = ggplot2::margin(0, 0, 0, 0)
    )
}

.graficos_builtin_icon_plot <- function(ref) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("Se requiere el paquete 'ggplot2' para renderizar iconos integrados.", call. = FALSE)
  }
  if (!requireNamespace("grid", quietly = TRUE)) {
    stop("Se requiere el paquete 'grid' para renderizar iconos integrados.", call. = FALSE)
  }

  ref <- tolower(trimws(as.character(ref %||% "")[1]))
  kind <- sub("^builtin:", "", ref)
  if (!kind %in% c("users", "personas", "poblacion")) {
    stop(sprintf("Icono integrado no reconocido: '%s'.", ref), call. = FALSE)
  }

  blue <- "#002060"
  light <- "#9DC3E6"
  grob <- grid::grobTree(
    grid::circleGrob(
      x = 0.50, y = 0.50, r = 0.48,
      gp = grid::gpar(fill = blue, col = NA)
    ),
    grid::circleGrob(
      x = 0.30, y = 0.57, r = 0.105,
      gp = grid::gpar(fill = light, col = NA, alpha = 0.95)
    ),
    grid::roundrectGrob(
      x = 0.30, y = 0.34, width = 0.28, height = 0.24,
      r = grid::unit(0.07, "npc"),
      gp = grid::gpar(fill = light, col = NA, alpha = 0.95)
    ),
    grid::circleGrob(
      x = 0.70, y = 0.57, r = 0.105,
      gp = grid::gpar(fill = light, col = NA, alpha = 0.95)
    ),
    grid::roundrectGrob(
      x = 0.70, y = 0.34, width = 0.28, height = 0.24,
      r = grid::unit(0.07, "npc"),
      gp = grid::gpar(fill = light, col = NA, alpha = 0.95)
    ),
    grid::circleGrob(
      x = 0.50, y = 0.64, r = 0.125,
      gp = grid::gpar(fill = "white", col = NA)
    ),
    grid::roundrectGrob(
      x = 0.50, y = 0.38, width = 0.38, height = 0.30,
      r = grid::unit(0.09, "npc"),
      gp = grid::gpar(fill = "white", col = NA)
    )
  )

  ggplot2::ggplot() +
    ggplot2::annotation_custom(grob, xmin = 0, xmax = 1, ymin = 0, ymax = 1) +
    ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) +
    ggplot2::theme_void() +
    ggplot2::theme(
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      panel.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      plot.margin = ggplot2::margin(0, 0, 0, 0)
    )
}

.graficos_rebuild_icon <- function(x, icon_registry = list()) {
  if (.graficos_is_blank_json_value(x)) return(NULL)
  if (inherits(x, "ppt_element")) return(x)

  ref <- .graficos_icon_ref(x)
  if (!nzchar(ref)) return(NULL)
  if (grepl("^builtin:", ref, ignore.case = TRUE)) {
    return(p_ggplot_raw(.graficos_builtin_icon_plot(ref)))
  }

  path <- icon_registry[[ref]] %||% ref
  if (!file.exists(path)) {
    stop(
      sprintf("Icono no encontrado: '%s'. Revisa que exista en Configuracion global > Iconos.", ref),
      call. = FALSE
    )
  }

  p_ggplot_raw(.graficos_icon_plot(path))
}

.graficos_fn_requires_icon <- function(fn) {
  fml <- formals(fn)
  "icono" %in% names(fml) && identical(fml$icono, quote(expr = ))
}

.graficos_normalize_payload_icon <- function(payload, fn, tipo, icon_registry = list()) {
  if (!("icono" %in% names(formals(fn)))) return(payload)

  if ("icono" %in% names(payload)) {
    payload$icono <- .graficos_rebuild_icon(payload$icono, icon_registry = icon_registry)
  }

  if (.graficos_fn_requires_icon(fn) && is.null(payload$icono)) {
    stop(
      sprintf(
        "La slide '%s' requiere un icono. Selecciona un PNG en Configuracion global > Iconos.",
        tipo
      ),
      call. = FALSE
    )
  }

  payload
}

.graficos_icon_registry <- function(sid, cfg = NULL) {
  cfg <- cfg %||% .graficos_config_get(sid) %||% list()
  iconos <- cfg$iconos %||% list()
  out <- list()
  if (!is.list(iconos) || length(iconos) == 0L) return(out)

  for (ico in iconos) {
    ico <- as.list(ico)
    id <- .graficos_icon_ref(ico$id %||% "")
    file_id <- .graficos_icon_ref(ico$file_id %||% "")
    path <- .graficos_icon_ref(ico$path %||% "")
    if (!nzchar(path) && nzchar(file_id)) {
      meta <- tryCatch(get_file(sid, file_id), error = function(e) NULL)
      path <- .graficos_icon_ref(meta$path %||% "")
    }
    if (!nzchar(path) || !file.exists(path)) next
    if (nzchar(id)) out[[id]] <- path
    if (nzchar(file_id)) out[[file_id]] <- path
  }

  out
}

.graficos_rebuild_graf_json <- function(g, graficador_registry = .GRAFICADOR_REGISTRY) {
  g <- .as_json_list(g)
  if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
  graficador_name <- .graficos_resolve_graficador_name(g$graficador, graficador_registry)
  if (!(graficador_name %in% graficador_registry)) {
    stop(sprintf("Graficador no registrado: %s", g$graficador), call. = FALSE)
  }
  fn <- getExportedValue("prosecnurapp", graficador_name)
  args <- .graficos_drop_blank_optional_refs(g$args %||% list())
  if (.graficos_args_missing_required_ref(args)) return(.graficos_blank_graph_element())
  do.call(fn, .clean_rebuild_args(args, fn))
}

.graficos_rebuild_slide_json <- function(s, slide_registry = .SLIDE_REGISTRY,
                                         graficador_registry = .GRAFICADOR_REGISTRY,
                                         icon_registry = list()) {
  s <- as.list(s)
  tipo <- as.character(s$tipo %||% "")
  if (!nzchar(tipo)) stop("Slide sin tipo", call. = FALSE)
  if (!(tipo %in% names(slide_registry))) {
    stop(sprintf("Tipo de slide no registrado: %s", tipo), call. = FALSE)
  }

  fn <- getExportedValue("prosecnurapp", tipo)
  payload <- .as_json_list(s$payload) %||% list()
  payload <- lapply(payload, function(v) {
    if (is.list(v) && length(v) == 1L && is.null(names(v))) v[[1]] else v
  })

  for (slot_name in slide_registry[[tipo]]$grafs) {
    if (!is.null(payload[[slot_name]])) {
      payload[[slot_name]] <- .graficos_rebuild_graf_json(
        payload[[slot_name]],
        graficador_registry = graficador_registry
      )
    }
  }

  payload <- .graficos_normalize_payload_icon(payload, fn, tipo, icon_registry = icon_registry)

  allowed_args <- names(formals(fn))
  payload <- payload[names(payload) %in% allowed_args]
  do.call(fn, payload)
}

.graficos_valid_data_cache <- function(x) {
  if (exists(".pulso_valid_data_cache", mode = "function")) {
    return(isTRUE(tryCatch(.pulso_valid_data_cache(x), error = function(e) FALSE)))
  }
  is.data.frame(x)
}

.graficos_valid_inst_cache <- function(x) {
  if (exists(".pulso_valid_inst_cache", mode = "function")) {
    return(isTRUE(tryCatch(.pulso_valid_inst_cache(x), error = function(e) FALSE)))
  }
  is.list(x) && !is.data.frame(x) && !is.null(x$survey) && is.data.frame(x$survey)
}

.graficos_named_source_list <- function(x) {
  if (!is.list(x) || is.data.frame(x) || length(x) == 0L) return(list())
  nms <- names(x)
  if (is.null(nms)) nms <- rep("", length(x))
  nms <- trimws(as.character(nms))
  if (length(x) == 1L && !nzchar(nms[1])) nms <- "default"
  keep <- nzchar(nms)
  x <- x[keep]
  names(x) <- nms[keep]
  x
}

.graficos_filter_valid_sources <- function(data_sources, inst_sources) {
  ds <- .graficos_named_source_list(data_sources)
  is_ <- .graficos_named_source_list(inst_sources)
  common <- intersect(names(ds), names(is_))
  if (!length(common)) return(list(data_sources = list(), inst_sources = list()))

  keep <- vapply(common, function(nm) {
    .graficos_valid_data_cache(ds[[nm]]) && .graficos_valid_inst_cache(is_[[nm]])
  }, logical(1))
  common <- common[keep]

  list(
    data_sources = ds[common],
    inst_sources = is_[common]
  )
}

.graficos_sources_usable <- function(data_sources, inst_sources) {
  valid <- .graficos_filter_valid_sources(data_sources, inst_sources)
  length(valid$data_sources) > 0L && length(valid$inst_sources) > 0L &&
    identical(names(valid$data_sources), names(valid$inst_sources))
}

.graficos_scope_processing_sources <- function(sid, data_sources, inst_sources) {
  ds <- data_sources
  is_ <- inst_sources
  if (exists("estudio_processing_filter_sources", mode = "function")) {
    scoped <- tryCatch(
      estudio_processing_filter_sources(sid, ds, is_),
      error = function(e) NULL
    )
    if (is.list(scoped)) {
      ds <- scoped$data_sources %||% list()
      is_ <- scoped$inst_sources %||% list()
    }
  }
  list(data_sources = ds, inst_sources = is_)
}

.graficos_raw_processing_sources <- function(sid) {
  .graficos_scope_processing_sources(
    sid,
    estudio_data_sources(sid),
    estudio_inst_sources(sid)
  )
}

.graficos_can_use_legacy_mirror <- function(sid, s) {
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) > 1L) return(FALSE)
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))) {
    return(FALSE)
  }
  TRUE
}

.graficos_legacy_mirror_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || !.graficos_can_use_legacy_mirror(sid, s)) {
    return(list(data_sources = list(), inst_sources = list()))
  }
  if (!.graficos_valid_data_cache(s$rp_data) || !.graficos_valid_inst_cache(s$rp_inst)) {
    return(list(data_sources = list(), inst_sources = list()))
  }

  bases <- (s$estudio %||% list())$bases %||% list()
  nm <- names(bases)[1] %||% "default"
  if (!nzchar(nm)) nm <- "default"
  .graficos_scope_processing_sources(
    sid,
    stats::setNames(list(s$rp_data), nm),
    stats::setNames(list(s$rp_inst), nm)
  )
}

.graficos_base_files_exist <- function(s, base_name) {
  base <- ((s$estudio %||% list())$bases %||% list())[[base_name]]
  if (is.null(base)) return(FALSE)
  files <- s$files %||% list()
  xls_fid <- as.character(base$xlsform_file_id %||% "")
  data_fid <- as.character(base$data_file_id %||% "")
  xls_meta <- if (nzchar(xls_fid)) files[[xls_fid]] else NULL
  data_meta <- if (nzchar(data_fid)) files[[data_fid]] else NULL
  !is.null(xls_meta$path) && file.exists(xls_meta$path) &&
    !is.null(data_meta$path) && file.exists(data_meta$path)
}

.graficos_can_rebuild_runtime_sources <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (length(bases) <= 1L) return(TRUE)
  all(vapply(names(bases), function(nm) {
    .graficos_base_files_exist(s, nm)
  }, logical(1)))
}

.graficos_rebuild_runtime_sources <- function(sid) {
  if (!exists(".pulso_rebuild_estudio_runtime_sources", mode = "function")) {
    return(FALSE)
  }
  if (!.graficos_can_rebuild_runtime_sources(sid)) return(FALSE)
  isTRUE(tryCatch(.pulso_rebuild_estudio_runtime_sources(sid), error = function(e) FALSE))
}

.require_rp_data <- function(sid) {
  s <- session_get(sid)
  sources <- .graficos_processing_sources(sid)
  if (!.graficos_sources_usable(sources$data_sources, sources$inst_sources)) {
    stop_api(
      409,
      "E_NO_VALID_RP_DATA",
      .graficos_base_error(
        sid,
        paste(
          "La fuente procesada para Gráficos no está disponible o quedó incompleta.",
          "Vuelve a aplicar la codificación o recarga la base desde Fase 1."
        )
      )
    )
  }
  s
}

.graficos_processing_sources <- function(sid) {
  normalize_sources <- function(src) {
    if (exists(".bases_normalize_source_contexts", mode = "function")) {
      .bases_normalize_source_contexts(src$data_sources, src$inst_sources)
    } else {
      src
    }
  }
  finalize_sources <- function(src) {
    src <- normalize_sources(src)
    if (exists(".graficos_add_virtual_koica_group_sources", mode = "function")) {
      src <- tryCatch(.graficos_add_virtual_koica_group_sources(sid, src), error = function(e) src)
    }
    src
  }

  sources <- .graficos_raw_processing_sources(sid)
  valid <- .graficos_filter_valid_sources(sources$data_sources, sources$inst_sources)
  if (.graficos_sources_usable(valid$data_sources, valid$inst_sources)) return(finalize_sources(valid))

  if (.graficos_rebuild_runtime_sources(sid)) {
    sources <- .graficos_raw_processing_sources(sid)
    valid <- .graficos_filter_valid_sources(sources$data_sources, sources$inst_sources)
    if (.graficos_sources_usable(valid$data_sources, valid$inst_sources)) return(finalize_sources(valid))
  }

  legacy <- .graficos_legacy_mirror_sources(sid)
  valid <- .graficos_filter_valid_sources(legacy$data_sources, legacy$inst_sources)
  if (.graficos_sources_usable(valid$data_sources, valid$inst_sources)) return(finalize_sources(valid))

  list(data_sources = list(), inst_sources = list())
}

.graficos_active_base_name <- function(sid) {
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid) &&
      exists("estudio_active_base", mode = "function")) {
    return(as.character(estudio_active_base(sid) %||% ""))
  }
  ""
}

.graficos_export_filename <- function(sid, label, ext) {
  active <- .graficos_active_base_name(sid)
  if (nzchar(active)) .export_filename(sid, label, ext, base = active) else .export_filename(sid, label, ext)
}

.graficos_base_error <- function(sid, message) {
  active <- .graficos_active_base_name(sid)
  if (nzchar(active)) sprintf("Base '%s': %s", active, message) else message
}

.graficos_blank_ref_value <- function(x) {
  is.character(x) && (!length(x) || all(!nzchar(trimws(x))))
}

.graficos_args_missing_required_ref <- function(args) {
  if (!is.list(args)) return(FALSE)
  for (arg_name in c("var", "objetivo")) {
    if (!is.null(args[[arg_name]]) && .graficos_blank_ref_value(args[[arg_name]])) {
      return(TRUE)
    }
  }
  vars <- args$vars
  if (is.character(vars) && (!length(vars) || all(!nzchar(trimws(vars))))) return(TRUE)
  if (is.list(vars) && length(vars)) {
    has_empty_block <- any(vapply(vars, function(value) {
      if (is.character(value)) return(!length(value) || all(!nzchar(trimws(value))))
      if (is.list(value)) return(.graficos_args_missing_required_ref(value))
      FALSE
    }, logical(1)))
    if (has_empty_block) return(TRUE)
  }
  if (is.list(args$bloques) && length(args$bloques)) {
    if (any(vapply(args$bloques, .graficos_args_missing_required_ref, logical(1)))) return(TRUE)
  }
  FALSE
}

.graficos_drop_blank_optional_refs <- function(args) {
  if (!is.list(args)) return(args)
  for (arg_name in c("cruces", "cruce", "iter_var")) {
    if (!is.null(args[[arg_name]]) && .graficos_blank_ref_value(args[[arg_name]])) {
      args[[arg_name]] <- NULL
    }
  }
  if (is.list(args$bloques) && length(args$bloques)) {
    args$bloques <- lapply(args$bloques, .graficos_drop_blank_optional_refs)
  }
  args
}

.graficos_blank_graph_element <- function() {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("Se requiere el paquete 'ggplot2' para crear placeholders de graficos vacios.", call. = FALSE)
  }
  p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void())
}

.rebuild_graf <- function(g) {
  if (is.null(g)) return(NULL)
  if (is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
  graficador_name <- .graficos_resolve_graficador_name(g$graficador)
  if (!(graficador_name %in% .GRAFICADOR_REGISTRY)) {
    stop_api(400, "E_UNKNOWN_GRAF", sprintf("Graficador no registrado: %s", g$graficador))
  }
  fn <- getExportedValue("prosecnurapp", graficador_name)
  args <- .graficos_drop_blank_optional_refs(g$args %||% list())
  if (.graficos_args_missing_required_ref(args)) return(.graficos_blank_graph_element())
  do.call(fn, .clean_rebuild_args(args, fn))
}

.rebuild_slide <- function(s) {
  s <- as.list(s)
  tipo <- as.character(s$tipo %||% "")
  if (!nzchar(tipo)) stop_api(400, "E_MISSING_TIPO", "Slide sin tipo")
  if (!(tipo %in% names(.SLIDE_REGISTRY))) {
    stop_api(400, "E_UNKNOWN_TIPO", sprintf("Tipo de slide no registrado: %s", tipo))
  }
  fn <- getExportedValue("prosecnurapp", tipo)
  payload <- .as_json_list(s$payload) %||% list()
  payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
  graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs
  for (slot_name in graf_slots) {
    if (!is.null(payload[[slot_name]])) {
      payload[[slot_name]] <- .rebuild_graf(.as_json_list(payload[[slot_name]]))
    }
  }
  payload <- .graficos_normalize_payload_icon(payload, fn, tipo)
  allowed_args <- names(formals(fn))
  payload <- payload[names(payload) %in% allowed_args]
  do.call(fn, payload)
}

.build_presets <- function(presets_json) {
  if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
  args <- lapply(presets_json, as.list)
  do.call(p_presets, args)
}

.build_w_presets <- function(w_json) {
  if (is.null(w_json) || length(w_json) == 0) return(NULL)
  args <- as.list(w_json)
  do.call(get("w_presets", mode = "function", inherits = TRUE), args)
}

.validar_plan_json <- function(plan_json) {
  errs <- character(0); warns <- character(0)
  plan_json <- .normalize_plan(plan_json)
  slides <- plan_json$slides
  if (length(slides) == 0) errs <- c(errs, "El plan no tiene slides.")
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    tipo <- as.character(s$tipo %||% "")
    tag <- sprintf("slide[%d]", i)
    if (!nzchar(tipo)) { errs <- c(errs, sprintf("%s: falta tipo", tag)); next }
    if (!(tipo %in% names(.SLIDE_REGISTRY))) {
      errs <- c(errs, sprintf("%s: tipo desconocido '%s'", tag, tipo)); next
    }
    payload <- .as_json_list(s$payload) %||% list()
    graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs
    for (slot_name in graf_slots) {
      slot <- .as_json_list(payload[[slot_name]])
      graf_name <- as.character(slot$graficador %||% "")
      if (!nzchar(graf_name)) {
        warns <- c(warns, sprintf("%s (%s): slot '%s' sin graficador", tag, tipo, slot_name))
      } else if (!(graf_name %in% .GRAFICADOR_REGISTRY)) {
        resolved_graf_name <- .graficos_resolve_graficador_name(graf_name)
        if (!(resolved_graf_name %in% .GRAFICADOR_REGISTRY)) {
          errs <- c(errs, sprintf("%s: graficador desconocido '%s'", tag, graf_name))
        }
      }
    }
  }
  list(ok = length(errs) == 0, errors = errs, warnings = warns, n_slides = length(slides))
}

# Config por defecto del plan de gráficos.
#
# Los `presets` vienen pre-poblados con los defaults de Pulso (por sesión
# el analista puede sobrescribirlos con "Guardar como default" — se
# guardan en s$graficos_presets_defaults y tienen prioridad sobre los
# de fábrica). Idem para `overrides_reusables`.
.graficos_default_config <- function(sid = NULL) {
  user_presets   <- if (!is.null(sid)) session_get(sid, required = FALSE)$graficos_presets_defaults else NULL
  user_overrides <- if (!is.null(sid)) session_get(sid, required = FALSE)$graficos_overrides_defaults else NULL
  list(
    version = "graficos/4",
    plan = list(slides = list()),
    presets = user_presets %||% .PRESETS_DEFAULT_PULSO,
    w_presets = .WORD_PRESETS_DEFAULT_PULSO,
    selected_slide_id = NULL,
    paletas = list(),
    iconos = list(),
    overrides_reusables = user_overrides %||% .OVERRIDES_DEFAULT_PULSO,
    debug_ph = list(activo = FALSE, color = "#FF00FF", lwd = 0.6),
    view_mode = "timeline",
    inspector_tab = "content",
    density = "comfortable",
    canvas_viewport = list(x = 0, y = 0, zoom = 1),
    scope_rules = list()
  )
}

.graficos_scoped_base <- function(sid) {
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      estudio_is_independent_siblings(sid) &&
      exists("estudio_active_base", mode = "function")) {
    active <- as.character(estudio_active_base(sid) %||% "")
    if (nzchar(active)) return(active)
  }
  ""
}

.graficos_config_get <- function(sid, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(.graficos_default_config(sid))
  active <- .graficos_scoped_base(sid)
  if (nzchar(active)) {
    configs <- s$graficos_config_por_base
    if (is.list(configs) && !is.null(configs[[active]])) {
      return(configs[[active]])
    }
    # Migracion conservadora: una config global legacy se asigna solo a
    # la base activa inicial. Las demas bases independientes arrancan con
    # default para no heredar portadas o planes ajenos.
    if ((is.null(configs) || length(configs) == 0L) && !is.null(s$graficos_config)) {
      configs <- list()
      configs[[active]] <- s$graficos_config
      session_set(sid, "graficos_config_por_base", configs)
      return(s$graficos_config)
    }
    return(.graficos_default_config(sid))
  }
  s$graficos_config %||% .graficos_default_config(sid)
}

.graficos_config_set <- function(sid, cfg) {
  active <- .graficos_scoped_base(sid)
  if (nzchar(active)) {
    s <- session_get(sid)
    configs <- s$graficos_config_por_base
    if (is.null(configs) || !is.list(configs)) configs <- list()
    configs[[active]] <- cfg
    session_set(sid, "graficos_config_por_base", configs)
    return(invisible(cfg))
  }
  session_set(sid, "graficos_config", cfg)
  invisible(cfg)
}

.graficos_status_set <- function(sid, key, value = TRUE) {
  session_set(sid, key, value)
  active <- .graficos_scoped_base(sid)
  if (!nzchar(active)) return(invisible(value))
  s <- session_get(sid)
  statuses <- s$graficos_status_por_base
  if (is.null(statuses) || !is.list(statuses)) statuses <- list()
  current <- statuses[[active]]
  if (is.null(current) || !is.list(current)) current <- list()
  current[[key]] <- value
  statuses[[active]] <- current
  session_set(sid, "graficos_status_por_base", statuses)
  invisible(value)
}

.graficos_pick_alias <- function(x, canonical, aliases = character()) {
  if (!is.null(x[[canonical]])) return(x[[canonical]])
  for (alias in aliases) {
    if (!is.null(x[[alias]])) return(x[[alias]])
  }
  NULL
}

.graficos_is_obj <- function(x) {
  is.list(x) && (length(x) == 0L || !is.null(names(x)))
}

.graficos_normalize_paleta_map <- function(palette) {
  if (is.null(palette)) return(NULL)
  if (is.atomic(palette)) {
    values <- as.character(palette)
    nms <- names(palette)
  } else if (is.list(palette) && !is.data.frame(palette)) {
    values <- vapply(palette, function(v) {
      x <- as.character(v %||% "")
      if (!length(x)) "" else x[1]
    }, character(1))
    nms <- names(palette)
  } else {
    return(NULL)
  }

  if (is.null(nms)) return(NULL)
  nms <- trimws(as.character(nms))
  values <- trimws(as.character(values))
  keep <- !is.na(nms) & nzchar(nms) & !is.na(values) & nzchar(values)
  if (!any(keep)) return(NULL)
  out <- as.list(values[keep])
  names(out) <- nms[keep]
  out[!duplicated(names(out))]
}

.graficos_normalize_paletas <- function(paletas) {
  if (!.graficos_is_obj(paletas)) return(list())
  out <- list()
  for (list_name in names(paletas)) {
    ln <- trimws(as.character(list_name %||% "")[1])
    if (!nzchar(ln)) next
    pal <- .graficos_normalize_paleta_map(paletas[[list_name]])
    if (is.null(pal) || !length(pal)) next
    out[[ln]] <- pal
  }
  out
}

.graficos_unknown_fields <- function(x) {
  known <- c(
    "ok", "version", "exported_at", "exportedAt", "imported_at", "importedAt",
    "config", "plan", "presets", "w_presets", "wPresets",
    "selected_slide_id", "selectedSlideId", "paletas", "iconos",
    "overrides_reusables", "overridesReusables", "debug_ph", "debugPh",
    "view_mode", "viewMode", "inspector_tab", "inspectorTab", "density",
    "canvas_viewport", "canvasViewport", "scope_rules", "scopeRules",
    "_unknown"
  )
  if (!.graficos_is_obj(x)) return(list())
  out <- x[setdiff(names(x), known)]
  if (is.null(out)) list() else out
}

.graficos_valid_view_mode <- function(x) is.character(x) && length(x) == 1L && x %in% c("timeline", "canvas")
.graficos_valid_inspector_tab <- function(x) is.character(x) && length(x) == 1L && x %in% c("content", "data", "style", "filters")
.graficos_valid_density <- function(x) is.character(x) && length(x) == 1L && x %in% c("comfortable", "compact")
.graficos_valid_viewport <- function(x) {
  .graficos_is_obj(x) && is.numeric(x$x) && is.numeric(x$y) && is.numeric(x$zoom)
}

.graficos_deep_merge <- function(base, override) {
  if (!.graficos_is_obj(base)) base <- list()
  if (!.graficos_is_obj(override)) return(base)
  for (nm in names(override)) {
    if (.graficos_is_obj(base[[nm]]) && .graficos_is_obj(override[[nm]])) {
      base[[nm]] <- .graficos_deep_merge(base[[nm]], override[[nm]])
    } else {
      base[[nm]] <- override[[nm]]
    }
  }
  base
}

.graficos_normalize_config <- function(input, sid = NULL, include_legacy_aliases = FALSE) {
  defaults <- .graficos_default_config(sid)
  envelope <- if (.graficos_is_obj(input)) input else list()
  src <- if (.graficos_is_obj(envelope$config)) envelope$config else envelope

  cfg <- defaults
  cfg$version <- "graficos/4"

  plan <- .graficos_pick_alias(src, "plan")
  cfg$plan <- if (.graficos_is_obj(plan) && is.list(plan$slides)) plan else defaults$plan

  presets <- .graficos_pick_alias(src, "presets")
  cfg$presets <- if (.graficos_is_obj(presets)) presets else defaults$presets

  w_presets <- .graficos_pick_alias(src, "w_presets", "wPresets")
  cfg$w_presets <- if (.graficos_is_obj(w_presets)) {
    .graficos_deep_merge(defaults$w_presets, w_presets)
  } else {
    defaults$w_presets
  }

  selected_slide_id <- .graficos_pick_alias(src, "selected_slide_id", "selectedSlideId")
  cfg$selected_slide_id <- if (is.character(selected_slide_id) && length(selected_slide_id) == 1L) selected_slide_id else NULL

  paletas <- .graficos_pick_alias(src, "paletas")
  cfg$paletas <- if (.graficos_is_obj(paletas)) {
    .graficos_normalize_paletas(paletas)
  } else {
    defaults$paletas
  }

  iconos <- .graficos_pick_alias(src, "iconos")
  cfg$iconos <- if (is.list(iconos) && is.null(names(iconos))) iconos else defaults$iconos

  overrides_reusables <- .graficos_pick_alias(src, "overrides_reusables", "overridesReusables")
  cfg$overrides_reusables <- if (is.list(overrides_reusables) && is.null(names(overrides_reusables))) overrides_reusables else defaults$overrides_reusables

  debug_ph <- .graficos_pick_alias(src, "debug_ph", "debugPh")
  cfg$debug_ph <- if (.graficos_is_obj(debug_ph)) .graficos_deep_merge(defaults$debug_ph, debug_ph) else defaults$debug_ph

  view_mode <- .graficos_pick_alias(src, "view_mode", "viewMode")
  cfg$view_mode <- if (.graficos_valid_view_mode(view_mode)) view_mode else defaults$view_mode

  inspector_tab <- .graficos_pick_alias(src, "inspector_tab", "inspectorTab")
  cfg$inspector_tab <- if (.graficos_valid_inspector_tab(inspector_tab)) inspector_tab else defaults$inspector_tab

  density <- .graficos_pick_alias(src, "density")
  cfg$density <- if (.graficos_valid_density(density)) density else defaults$density

  canvas_viewport <- .graficos_pick_alias(src, "canvas_viewport", "canvasViewport")
  cfg$canvas_viewport <- if (.graficos_valid_viewport(canvas_viewport)) canvas_viewport else defaults$canvas_viewport

  scope_rules <- .graficos_pick_alias(src, "scope_rules", "scopeRules")
  cfg$scope_rules <- if (.graficos_is_obj(scope_rules)) scope_rules else list(
    global = list(
      presets = cfg$presets,
      paletas = cfg$paletas,
      overrides_reusables = cfg$overrides_reusables,
      debug_ph = cfg$debug_ph
    )
  )

  unknown <- .graficos_deep_merge(
    if (.graficos_is_obj(src$`_unknown`)) src$`_unknown` else list(),
    .graficos_unknown_fields(src)
  )
  if (.graficos_is_obj(envelope$config)) {
    bundle_unknown <- .graficos_unknown_fields(envelope)
    if (length(bundle_unknown) > 0L) unknown$`__bundle` <- bundle_unknown
  }
  if (length(unknown) > 0L) cfg$`_unknown` <- unknown

  if (isTRUE(include_legacy_aliases)) {
    cfg$wPresets <- cfg$w_presets
    cfg$selectedSlideId <- cfg$selected_slide_id
    cfg$overridesReusables <- cfg$overrides_reusables
    cfg$canvasViewport <- cfg$canvas_viewport
    cfg$viewMode <- cfg$view_mode
    cfg$inspectorTab <- cfg$inspector_tab
    cfg$scopeRules <- cfg$scope_rules
  }

  cfg
}

.graficos_resolve_scope_rules <- function(cfg, slide = NULL, grafico = NULL) {
  cfg <- .graficos_normalize_config(cfg)
  rules <- cfg$scope_rules
  if (!.graficos_is_obj(rules)) return(cfg)

  merged <- list()
  add_rule <- function(rule) {
    if (.graficos_is_obj(rule)) merged <<- .graficos_deep_merge(merged, rule)
  }

  add_rule(rules$global)

  lista <- grafico$args$lista %||% grafico$args$list_name %||% grafico$args$variable_lista %||% NULL
  if (is.character(lista) && .graficos_is_obj(rules$by_list)) add_rule(rules$by_list[[lista]])

  tipo_grafico <- grafico$graficador %||% grafico$tipo %||% NULL
  if (is.character(tipo_grafico) && .graficos_is_obj(rules$by_chart_type)) add_rule(rules$by_chart_type[[tipo_grafico]])

  tipo_slide <- slide$tipo %||% NULL
  if (is.character(tipo_slide) && .graficos_is_obj(rules$by_slide_type)) add_rule(rules$by_slide_type[[tipo_slide]])

  slide_id <- slide$id %||% NULL
  if (is.character(slide_id) && .graficos_is_obj(rules$by_slide_id)) add_rule(rules$by_slide_id[[slide_id]])

  .graficos_deep_merge(cfg, merged)
}

.graficos_effective_config <- function(sid, override = NULL) {
  cfg <- .graficos_normalize_config(.graficos_config_get(sid), sid = sid)
  override <- .as_json_list(override)
  if (is.list(override) && length(override) > 0L) {
    override <- if (.graficos_is_obj(override$config)) override$config else override
    cfg <- .graficos_deep_merge(cfg, override)
  }
  .graficos_normalize_config(cfg, sid = sid)
}

.graficos_palette_vector <- function(palette) {
  if (is.null(palette)) return(NULL)
  if (is.atomic(palette)) {
    values <- as.character(palette)
    nms <- names(palette)
  } else if (is.list(palette)) {
    nms <- names(palette)
    values <- vapply(palette, function(v) {
      x <- as.character(v %||% "")
      if (!length(x)) "" else x[1]
    }, character(1))
  } else {
    return(NULL)
  }

  if (is.null(nms)) return(NULL)
  nms <- trimws(as.character(nms))
  values <- trimws(as.character(values))
  keep <- !is.na(nms) & nzchar(nms) & !is.na(values) & nzchar(values)
  if (!any(keep)) return(NULL)
  out <- values[keep]
  names(out) <- nms[keep]
  out[!duplicated(names(out))]
}

.graficos_palette_env <- function(paletas, parent = parent.frame()) {
  env <- new.env(parent = parent)
  if (!is.list(paletas) || !length(paletas)) return(env)

  for (list_name in names(paletas)) {
    ln <- trimws(as.character(list_name %||% "")[1])
    if (!nzchar(ln)) next
    pal <- .graficos_palette_vector(paletas[[list_name]])
    if (is.null(pal) || !length(pal)) next
    assign(paste0("paleta_", ln), pal, envir = env)
  }

  env
}

.graficos_collect_palette_lists <- function(inst_sources) {
  if (is.null(inst_sources)) return(list())
  if (!is.list(inst_sources) || is.data.frame(inst_sources)) return(list())
  if (!is.null(inst_sources$choices) && is.data.frame(inst_sources$choices)) {
    inst_sources <- list(inst_sources)
  }

  out <- list()
  order <- character(0)

  choice_label_col <- function(choices) {
    candidates <- c("label", "label::es")
    hit <- candidates[candidates %in% names(choices)][1]
    if (length(hit) && !is.na(hit)) return(hit)
    extras <- setdiff(names(choices), c("list_name", "name", "value"))
    hit <- extras[1]
    if (length(hit) && !is.na(hit)) hit else NA_character_
  }

  for (inst in inst_sources) {
    if (is.null(inst) || !is.list(inst)) next
    choices <- inst$choices
    if (is.null(choices) || !is.data.frame(choices) || nrow(choices) == 0L) next
    if (!("list_name" %in% names(choices)) || !("name" %in% names(choices))) next

    label_col <- choice_label_col(choices)
    list_names <- unique(trimws(as.character(choices$list_name %||% "")))
    list_names <- list_names[!is.na(list_names) & nzchar(list_names)]

    for (ln in list_names) {
      rows <- choices[trimws(as.character(choices$list_name)) == ln, , drop = FALSE]
      if (!nrow(rows)) next
      if (is.null(out[[ln]])) {
        out[[ln]] <- list(list_name = ln, choices = list(), .seen = character(0))
        order <- c(order, ln)
      }
      for (i in seq_len(nrow(rows))) {
        code <- trimws(as.character(rows$name[i] %||% ""))
        label <- if (!is.na(label_col) && label_col %in% names(rows)) {
          as.character(rows[[label_col]][i] %||% code)
        } else {
          code
        }
        label <- trimws(label)
        if (!nzchar(label)) label <- code
        key <- paste(code, label, sep = "\r")
        if (key %in% out[[ln]]$.seen) next
        out[[ln]]$choices[[length(out[[ln]]$choices) + 1L]] <- list(name = code, label = label)
        out[[ln]]$.seen <- c(out[[ln]]$.seen, key)
      }
    }
  }

  lapply(order, function(ln) {
    x <- out[[ln]]
    x$.seen <- NULL
    x
  })
}

# Enriquece la config de presets JSON antes de pasarla a prosecnur con:
# 1. `usar_canvas = TRUE` en todos los tipos (invariante de Prosecnur — todos
#    los reportes usan canvas/cowplot).
# 2. Flags `debug_ph_*` en el preset `base`, que prosecnur aplica a todos
#    los graficadores. Así el analista tiene UN solo toggle global en
#    vez de tener que pisar los tres args por cada slide.
#
# Ambos comportamientos son opinados y se hacen server-side para que la
# UI no tenga que recordarlo en cada export.
.enriquecer_presets <- function(presets_json, debug_ph = NULL) {
  if (is.null(presets_json)) presets_json <- list()
  if (!is.list(presets_json)) return(presets_json)

  # 1) Canvas siempre activo en cada tipo de preset (excepto `base`,
  # que no usa canvas).
  tipos_canvas <- c(
    "barras_apiladas", "barras_agrupadas", "multi_apiladas",
    "barras_numericas", "histograma", "pie", "donut", "radar_tabla",
    "numerico", "media_rango", "boxplot"
  )
  for (t in tipos_canvas) {
    if (is.null(presets_json[[t]])) presets_json[[t]] <- list()
    presets_json[[t]]$usar_canvas <- TRUE
  }

  # 2) Debug placeholder: inyectar al preset base.
  if (is.null(presets_json$base)) presets_json$base <- list()
  if (is.list(debug_ph) && isTRUE(debug_ph$activo)) {
    presets_json$base$debug_ph_bordes <- TRUE
    if (!is.null(debug_ph$color) && nzchar(as.character(debug_ph$color))) {
      presets_json$base$debug_ph_col <- as.character(debug_ph$color)
    }
    if (!is.null(debug_ph$lwd) && is.finite(suppressWarnings(as.numeric(debug_ph$lwd)))) {
      presets_json$base$debug_ph_lwd <- as.numeric(debug_ph$lwd)
    }
  } else {
    # Si no está activo, forzar FALSE por si el analista había dejado
    # debug_ph_bordes=TRUE en algún preset legacy.
    presets_json$base$debug_ph_bordes <- FALSE
  }

  presets_json
}

# Resuelve un Target relativo de un .rels a su path absoluto dentro del
# .pptx (el "zip"). Los Targets de rels son relativos al FILE que el
# .rels describe, no al .rels en sí. Ej.:
#   rel_file = "ppt/slides/_rels/slide1.xml.rels"
#   owner    = "ppt/slides/slide1.xml"     (strip `_rels/` y `.rels`)
#   target   = "../media/image1.png"
#   =>         "ppt/media/image1.png"      (tras resolver `..`)
.resolve_rel_target <- function(rel_file, target) {
  if (startsWith(target, "/")) return(sub("^/+", "", target))
  owner_file <- sub("_rels/([^/]+)\\.rels$", "\\1", rel_file)
  base_dir <- dirname(owner_file)
  combined <- if (nzchar(base_dir) && base_dir != ".") {
    paste0(base_dir, "/", target)
  } else {
    target
  }
  parts <- strsplit(combined, "/", fixed = TRUE)[[1]]
  out <- character(0)
  for (p in parts) {
    if (p == "" || p == ".") next
    if (p == "..") {
      if (length(out) > 0L) out <- out[-length(out)]
    } else {
      out <- c(out, p)
    }
  }
  paste(out, collapse = "/")
}

# Extrae las imágenes PNG que los slides de un .pptx realmente
# referencian (vía `ppt/slides/_rels/slideN.xml.rels`). Excluye
# intencionalmente las imágenes que aparecen SOLO en layouts, masters
# o themes — si no, los logos del template se colaban como si fueran
# gráficos generados por el graficador.
#
# Los graficadores de prosecnur con `usar_canvas=TRUE` renderizan cada
# slot como un PNG que officer inserta con una relación tipo image en
# el .rels del slide. Ese es exactamente el set que queremos mostrar
# en el preview.
#
# Fallback: si por algún motivo no se encuentra ninguna referencia en
# los rels (pptx con estructura atípica), devolvemos todas las
# imágenes como antes — mejor mostrar algo que nada.
#
# El orden se conserva por número natural (image1, image2, …) que
# corresponde al orden en que officer las fue añadiendo.
.extract_pptx_images <- function(pptx_path) {
  if (!file.exists(pptx_path)) return(list())
  if (!requireNamespace("zip", quietly = TRUE)) return(list())

  tmpdir <- tempfile("pptx_extract_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)

  entries <- tryCatch(zip::zip_list(pptx_path), error = function(e) NULL)
  if (is.null(entries) || !nrow(entries)) return(list())

  # PNGs candidatos en ppt/media/
  media_rows <- entries[grepl("^ppt/media/.*\\.png$", entries$filename, ignore.case = TRUE), , drop = FALSE]
  if (!nrow(media_rows)) return(list())

  # .rels de slides únicamente (NO layouts/masters/theme)
  slide_rels <- entries$filename[
    grepl("^ppt/slides/_rels/slide\\d+\\.xml\\.rels$", entries$filename, ignore.case = TRUE)
  ]

  # Extraer rels + media en una sola llamada
  to_extract <- unique(c(slide_rels, media_rows$filename))
  tryCatch(
    zip::unzip(pptx_path, files = to_extract, exdir = tmpdir),
    error = function(e) NULL
  )

  # Parsear cada .rels para coleccionar los Targets de relaciones Image.
  # Los Relationships XML usan namespace default:
  # http://schemas.openxmlformats.org/package/2006/relationships
  # Usamos local-name() en el XPath para evitar binding de namespaces.
  referenced <- character(0)
  for (rel_file in slide_rels) {
    full_rel <- file.path(tmpdir, rel_file)
    if (!file.exists(full_rel)) next
    doc <- tryCatch(xml2::read_xml(full_rel), error = function(e) NULL)
    if (is.null(doc)) next
    nodes <- tryCatch(
      xml2::xml_find_all(
        doc,
        ".//*[local-name()='Relationship' and contains(@Type, '/image')]"
      ),
      error = function(e) NULL
    )
    if (is.null(nodes) || length(nodes) == 0L) next
    for (n in nodes) {
      tgt <- xml2::xml_attr(n, "Target")
      if (is.null(tgt) || is.na(tgt) || !nzchar(tgt)) next
      referenced <- c(referenced, .resolve_rel_target(rel_file, tgt))
    }
  }
  referenced <- unique(referenced)

  # Filtrar a solo las referenciadas por los slides. Fallback conservador
  # si no se detectó ninguna (pptx atípico): devolver todas.
  if (length(referenced) > 0L) {
    media_rows <- media_rows[media_rows$filename %in% referenced, , drop = FALSE]
  }
  if (!nrow(media_rows)) return(list())

  # Ordenar por número natural (image1, image2, … image10). Usamos vapply
  # para garantizar que `nums` tenga la misma longitud que `media_rows`:
  # regmatches con regexpr devuelve vector VACÍO (no NA) cuando el
  # filename no tiene dígitos, lo que colapsaba `order()` y borraba todas
  # las filas. Sentinel 999L ⇒ los sin dígito van al final en orden estable.
  nums <- vapply(
    media_rows$filename,
    function(f) {
      m <- regmatches(f, regexpr("[0-9]+", f))
      if (length(m) == 0L) return(999L)
      suppressWarnings(as.integer(m[[1]]))
    },
    integer(1),
    USE.NAMES = FALSE
  )
  nums[is.na(nums)] <- 999L
  media_rows <- media_rows[order(nums), , drop = FALSE]

  lapply(seq_len(nrow(media_rows)), function(i) {
    fname <- media_rows$filename[i]
    full <- file.path(tmpdir, fname)
    if (!file.exists(full)) return(NULL)
    bytes <- tryCatch(readBin(full, "raw", file.info(full)$size), error = function(e) NULL)
    if (is.null(bytes)) return(NULL)
    b64 <- jsonlite::base64_enc(bytes)
    list(
      filename = basename(fname),
      png_base64 = paste0("data:image/png;base64,", b64),
      size = length(bytes)
    )
  }) |> Filter(f = Negate(is.null))
}

.first_available_cmd <- function(candidates) {
  hits <- Sys.which(candidates)
  hits <- unname(hits[nzchar(hits)])
  if (length(hits)) hits[[1]] else ""
}

.first_available_executable <- function(candidates) {
  candidates <- unique(candidates[nzchar(candidates)])
  for (candidate in candidates) {
    if (grepl("[/\\\\]", candidate)) {
      if (file.exists(candidate)) return(candidate)
    } else {
      hit <- Sys.which(candidate)
      if (nzchar(hit)) return(unname(hit))
    }
  }
  ""
}

.soffice_cmd <- function() {
  env_candidates <- unname(Sys.getenv(
    c("PROSECNUR_SOFFICE", "SOFFICE_PATH", "LIBREOFFICE_PATH"),
    unset = ""
  ))

  platform_candidates <- switch(
    Sys.info()[["sysname"]] %||% "",
    "Darwin" = c(
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      "/Applications/OpenOffice.app/Contents/MacOS/soffice"
    ),
    "Windows" = c(
      file.path(Sys.getenv("ProgramFiles", "C:/Program Files"), "LibreOffice/program/soffice.exe"),
      file.path(Sys.getenv("ProgramFiles(x86)", "C:/Program Files (x86)"), "LibreOffice/program/soffice.exe"),
      file.path(Sys.getenv("LOCALAPPDATA", ""), "Programs/LibreOffice/program/soffice.exe")
    ),
    character()
  )

  .first_available_executable(c(env_candidates, "soffice", "libreoffice", platform_candidates))
}

.artifact_renderer_script <- function() {
  installed <- tryCatch(
    system.file("scripts/render_pptx_slide_artifact.mjs", package = "prosecnurapp"),
    error = function(e) ""
  )
  candidates <- c(
    installed,
    file.path(getwd(), "api", "inst", "scripts", "render_pptx_slide_artifact.mjs"),
    file.path(getwd(), "inst", "scripts", "render_pptx_slide_artifact.mjs")
  )
  .first_available_executable(candidates)
}

.artifact_tool_module_path <- function() {
  env_module <- Sys.getenv("PROSECNUR_ARTIFACT_TOOL_MODULE", unset = "")
  module_rel <- file.path("@oai", "artifact-tool", "dist", "artifact_tool.mjs")
  node_path_dirs <- strsplit(Sys.getenv("NODE_PATH", unset = ""), .Platform$path.sep, fixed = TRUE)[[1]]
  node_path_dirs <- node_path_dirs[nzchar(node_path_dirs)]

  repo_root <- Sys.getenv("PULSO_REPO_ROOT", unset = "")
  cwd <- getwd()
  home <- path.expand("~")
  candidates <- c(
    env_module,
    file.path(cwd, "node_modules", module_rel),
    file.path(cwd, "desktop", "node_modules", module_rel),
    file.path(cwd, "frontend", "node_modules", module_rel),
    if (nzchar(repo_root)) file.path(repo_root, "node_modules", module_rel) else "",
    if (nzchar(repo_root)) file.path(repo_root, "desktop", "node_modules", module_rel) else "",
    if (nzchar(repo_root)) file.path(repo_root, "frontend", "node_modules", module_rel) else "",
    file.path(node_path_dirs, module_rel),
    file.path(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", module_rel)
  )
  .first_available_executable(candidates)
}

.artifact_renderer_configured <- function() {
  nzchar(.artifact_tool_module_path()) ||
    isTRUE(tolower(Sys.getenv("PROSECNUR_ENABLE_ARTIFACT_RENDERER", unset = "")) %in% c("1", "true", "yes"))
}

.artifact_node_cmd <- function() {
  home <- path.expand("~")
  .first_available_executable(c(
    Sys.getenv("PROSECNUR_NODE", unset = ""),
    Sys.getenv("NODE_BINARY", unset = ""),
    "node",
    file.path(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "bin", "node")
  ))
}

.artifact_node_env <- function(node) {
  run_as_node <- tolower(Sys.getenv("PROSECNUR_NODE_RUN_AS_NODE", unset = ""))
  if (run_as_node %in% c("1", "true", "yes")) {
    return("ELECTRON_RUN_AS_NODE=1")
  }
  character()
}

.preview_renderer_status <- function() {
  artifact_enabled <- .artifact_renderer_configured()
  artifact_node <- if (artifact_enabled) .artifact_node_cmd() else ""
  artifact_script <- if (artifact_enabled) .artifact_renderer_script() else ""
  artifact_module <- if (artifact_enabled) .artifact_tool_module_path() else ""
  artifact_available <- isTRUE(artifact_enabled) &&
    nzchar(artifact_node) &&
    nzchar(artifact_script) &&
    nzchar(artifact_module)

  soffice <- .soffice_cmd()
  soffice_available <- nzchar(soffice)

  renderer <- if (artifact_available) {
    "artifact-tool"
  } else if (soffice_available) {
    "soffice"
  } else {
    NA_character_
  }

  list(
    available = isTRUE(artifact_available || soffice_available),
    renderer = renderer,
    platform = Sys.info()[["sysname"]] %||% NA_character_,
    desktop_automation = FALSE,
    message = if (artifact_available || soffice_available) {
      "Renderer headless disponible para preview inline."
    } else {
      "No se encontro renderer headless. Configura LibreOffice/soffice o un renderer interno de desarrollo."
    },
    renderers = list(
      list(
        id = "artifact-tool",
        available = isTRUE(artifact_available),
        configured = isTRUE(artifact_enabled),
        command = if (nzchar(artifact_node)) artifact_node else NA_character_,
        script = if (nzchar(artifact_script)) artifact_script else NA_character_,
        module = if (nzchar(artifact_module)) artifact_module else NA_character_
      ),
      list(
        id = "soffice",
        available = isTRUE(soffice_available),
        configured = isTRUE(soffice_available),
        command = if (nzchar(soffice)) soffice else NA_character_
      )
    )
  )
}

.png_preview_payload <- function(path, renderer) {
  if (!file.exists(path)) return(NULL)
  bytes <- tryCatch(readBin(path, "raw", file.info(path)$size), error = function(e) NULL)
  if (is.null(bytes) || !length(bytes)) return(NULL)

  dims <- tryCatch(dim(png::readPNG(path)), error = function(e) NULL)
  if (is.null(dims) || length(dims) < 2L) {
    width <- NA_integer_
    height <- NA_integer_
  } else {
    height <- as.integer(dims[[1]])
    width <- as.integer(dims[[2]])
  }

  list(
    png_base64 = paste0("data:image/png;base64,", jsonlite::base64_enc(bytes)),
    width = width,
    height = height,
    renderer = renderer
  )
}

.pdf_page_to_png <- function(pdf_path, out_dir, renderer, page = 1L, dpi = 220, timeout = 20) {
  if (!file.exists(pdf_path)) return(NULL)
  page <- suppressWarnings(as.integer(page %||% 1L))
  if (is.na(page) || page < 1L) page <- 1L
  timeout <- suppressWarnings(as.integer(timeout %||% 20L))
  if (is.na(timeout) || timeout < 1L) timeout <- 20L

  pdftoppm <- .first_available_cmd(c("pdftoppm"))
  if (nzchar(pdftoppm)) {
    prefix <- file.path(out_dir, sprintf("slide_preview_%03d", page))
    png_path <- paste0(prefix, ".png")
    ok <- tryCatch({
      system2(
        pdftoppm,
        c(
          "-png",
          "-singlefile",
          "-f", as.character(page),
          "-l", as.character(page),
          "-r", as.character(dpi),
          pdf_path,
          prefix
        ),
        stdout = TRUE,
        stderr = TRUE,
        timeout = timeout
      )
      file.exists(png_path)
    }, error = function(e) FALSE)
    if (isTRUE(ok)) return(.png_preview_payload(png_path, paste0(renderer, "+pdftoppm")))
  }

  if (requireNamespace("magick", quietly = TRUE)) {
    png_path <- file.path(out_dir, sprintf("slide_preview_%03d.png", page))
    ok <- tryCatch({
      img <- magick::image_read_pdf(pdf_path, density = dpi)
      if (length(img) < page) return(FALSE)
      magick::image_write(img[page], path = png_path, format = "png")
      file.exists(png_path)
    }, error = function(e) FALSE)
    if (isTRUE(ok)) return(.png_preview_payload(png_path, paste0(renderer, "+magick")))
  }

  NULL
}

.render_pptx_slide_png_artifact <- function(pptx_path, out_dir, slide_index = 1L, timeout = 30, scale = 2) {
  if (!.artifact_renderer_configured()) return(NULL)
  node <- .artifact_node_cmd()
  script <- .artifact_renderer_script()
  module <- .artifact_tool_module_path()
  if (!nzchar(node) || !nzchar(script) || !nzchar(module)) return(NULL)

  slide_index <- suppressWarnings(as.integer(slide_index %||% 1L))
  if (is.na(slide_index) || slide_index < 1L) slide_index <- 1L
  pptx_path <- tryCatch(normalizePath(pptx_path, winslash = "/", mustWork = TRUE), error = function(e) pptx_path)
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  png_path <- file.path(out_dir, sprintf("slide_preview_%03d.png", slide_index))

  args <- c(
    script,
    "--pptx", pptx_path,
    "--output", png_path,
    "--slide-index", as.character(slide_index),
    "--scale", as.character(scale)
  )
  args <- c(args, "--module", module)

  ok <- tryCatch({
    system2(
      node,
      args,
      stdout = TRUE,
      stderr = TRUE,
      env = .artifact_node_env(node),
      timeout = timeout
    )
    file.exists(png_path)
  }, error = function(e) FALSE)
  if (!isTRUE(ok)) return(NULL)
  .png_preview_payload(png_path, "artifact-tool")
}

.pptx_to_pdf_soffice <- function(pptx_path, out_dir, timeout = 30) {
  cmd <- .soffice_cmd()
  if (!nzchar(cmd)) return(NULL)
  pptx_path <- tryCatch(normalizePath(pptx_path, winslash = "/", mustWork = TRUE), error = function(e) pptx_path)

  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  profile_dir <- file.path(out_dir, "lo-profile")
  dir.create(profile_dir, recursive = TRUE, showWarnings = FALSE)
  profile_uri <- paste0("file:///", normalizePath(profile_dir, winslash = "/", mustWork = FALSE))

  ok <- tryCatch({
    system2(
      cmd,
      c(
        "--headless",
        "--invisible",
        "--nodefault",
        "--nofirststartwizard",
        "--nolockcheck",
        "--norestore",
        paste0("-env:UserInstallation=", profile_uri),
        "--convert-to",
        "pdf",
        "--outdir",
        out_dir,
        pptx_path
      ),
      stdout = TRUE,
      stderr = TRUE,
      timeout = timeout
    )
    TRUE
  }, error = function(e) FALSE)
  if (!isTRUE(ok)) return(NULL)

  pdfs <- list.files(out_dir, pattern = "\\.pdf$", full.names = TRUE, ignore.case = TRUE)
  if (!length(pdfs)) return(NULL)
  pdfs[[1]]
}

.render_pptx_slide_png_soffice <- function(pptx_path, out_dir, slide_index = 1L, timeout = 30, dpi = 220) {
  pdf_path <- .pptx_to_pdf_soffice(pptx_path, out_dir, timeout = timeout)
  if (is.null(pdf_path)) return(NULL)
  .pdf_page_to_png(
    pdf_path,
    out_dir,
    "soffice",
    page = slide_index,
    dpi = dpi,
    timeout = timeout
  )
}

.render_pptx_slide_png <- function(pptx_path, out_dir, slide_index = 1L, timeout = 30, dpi = 220) {
  out <- .render_pptx_slide_png_artifact(
    pptx_path,
    out_dir,
    slide_index = slide_index,
    timeout = timeout,
    scale = max(1, dpi / 96)
  )
  if (!is.null(out)) return(out)
  .render_pptx_slide_png_soffice(pptx_path, out_dir, slide_index = slide_index, timeout = timeout, dpi = dpi)
}

.render_pptx_slide_preview_headless <- function(pptx_path, timeout = 30, dpi = 220) {
  tmpdir <- tempfile("pptx_slide_preview_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)
  .render_pptx_slide_png(
    pptx_path,
    tmpdir,
    slide_index = 1L,
    timeout = timeout,
    dpi = dpi
  )
}

.compare_png_files <- function(reference_png, candidate_png) {
  if (!file.exists(reference_png) || !file.exists(candidate_png)) return(NULL)

  if (requireNamespace("magick", quietly = TRUE)) {
    return(tryCatch({
      ref <- magick::image_background(magick::image_read(reference_png), "white", flatten = TRUE)
      cand <- magick::image_background(magick::image_read(candidate_png), "white", flatten = TRUE)
      ref_info <- magick::image_info(ref)
      cand_info <- magick::image_info(cand)
      dimensions_match <- identical(
        c(ref_info$width[[1]], ref_info$height[[1]]),
        c(cand_info$width[[1]], cand_info$height[[1]])
      )
      if (!isTRUE(dimensions_match)) {
        cand <- magick::image_resize(cand, sprintf("%dx%d!", ref_info$width[[1]], ref_info$height[[1]]))
      }

      ref_data <- as.integer(magick::image_data(ref, channels = "rgb"))
      cand_data <- as.integer(magick::image_data(cand, channels = "rgb"))
      diff <- abs(ref_data - cand_data) / 255
      mae <- mean(diff)
      rmse <- sqrt(mean(diff ^ 2))

      list(
        available = TRUE,
        dimensions_match = isTRUE(dimensions_match),
        resized_for_metric = !isTRUE(dimensions_match),
        reference = list(width = as.integer(ref_info$width[[1]]), height = as.integer(ref_info$height[[1]])),
        candidate = list(width = as.integer(cand_info$width[[1]]), height = as.integer(cand_info$height[[1]])),
        mean_abs_diff = round(mae, 6),
        rmse = round(rmse, 6),
        similarity = round(max(0, 1 - rmse), 6),
        verdict = if (rmse <= 0.01 && isTRUE(dimensions_match)) "match" else if (rmse <= 0.04) "near" else "different"
      )
    }, error = function(e) NULL))
  }

  ref <- tryCatch(png::readPNG(reference_png), error = function(e) NULL)
  cand <- tryCatch(png::readPNG(candidate_png), error = function(e) NULL)
  if (is.null(ref) || is.null(cand)) return(NULL)
  if (!identical(dim(ref), dim(cand))) {
    return(list(
      available = FALSE,
      reason = "dimension_mismatch_without_resizer",
      reference = list(width = as.integer(dim(ref)[2]), height = as.integer(dim(ref)[1])),
      candidate = list(width = as.integer(dim(cand)[2]), height = as.integer(dim(cand)[1]))
    ))
  }

  ref <- ref[, , seq_len(min(3L, dim(ref)[3])), drop = FALSE]
  cand <- cand[, , seq_len(min(3L, dim(cand)[3])), drop = FALSE]
  diff <- abs(ref - cand)
  mae <- mean(diff)
  rmse <- sqrt(mean(diff ^ 2))
  list(
    available = TRUE,
    dimensions_match = TRUE,
    resized_for_metric = FALSE,
    reference = list(width = as.integer(dim(ref)[2]), height = as.integer(dim(ref)[1])),
    candidate = list(width = as.integer(dim(cand)[2]), height = as.integer(dim(cand)[1])),
    mean_abs_diff = round(mae, 6),
    rmse = round(rmse, 6),
    similarity = round(max(0, 1 - rmse), 6),
    verdict = if (rmse <= 0.01) "match" else if (rmse <= 0.04) "near" else "different"
  )
}

.compare_pptx_slide_preview <- function(full_pptx_path, preview_pptx_path, slide_index = 1L, dpi = 220) {
  if (!.artifact_renderer_configured() && !nzchar(.soffice_cmd())) {
    return(list(available = FALSE, reason = "renderer_missing", renderer = NULL))
  }
  slide_index <- suppressWarnings(as.integer(slide_index %||% 1L))
  if (is.na(slide_index) || slide_index < 1L) slide_index <- 1L

  tmpdir <- tempfile("pptx_slide_compare_")
  dir.create(tmpdir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmpdir, recursive = TRUE, force = TRUE), add = TRUE)

  full_dir <- file.path(tmpdir, "full")
  preview_dir <- file.path(tmpdir, "preview")
  full_render <- .render_pptx_slide_png(full_pptx_path, full_dir, slide_index = slide_index, dpi = dpi)
  preview_render <- .render_pptx_slide_png(preview_pptx_path, preview_dir, slide_index = 1L, dpi = dpi)
  if (is.null(full_render) || is.null(preview_render)) {
    return(list(available = FALSE, reason = "render_failed", renderer = "headless"))
  }

  metrics <- .compare_png_files(
    file.path(full_dir, sprintf("slide_preview_%03d.png", slide_index)),
    file.path(preview_dir, "slide_preview_001.png")
  )
  if (is.null(metrics)) {
    return(list(available = FALSE, reason = "compare_failed", renderer = "headless"))
  }
  metrics$renderer <- full_render$renderer %||% "headless"
  metrics$candidate_renderer <- preview_render$renderer %||% "headless"
  metrics$slide_index <- slide_index
  metrics
}

.render_pptx_slide_preview <- function(pptx_path, preview_quality = "quick", dpi = NA_integer_) {
  # Keep Mac and Windows on the same rendering path. Desktop-app automation
  # is intentionally avoided because it is platform-specific, can show
  # blocking dialogs, and can require OS permissions. Headless renderers are
  # tried only when explicitly configured or discoverable, then degrade
  # safely to NULL.
  preview_quality <- tolower(as.character(preview_quality %||% "quick"))
  if (!preview_quality %in% c("quick", "normal")) preview_quality <- "quick"

  preview_dpi <- suppressWarnings(as.integer(dpi %||% NA_integer_))
  if (is.na(preview_dpi) || preview_dpi <= 0L) {
    preview_dpi <- if (preview_quality == "quick") 160L else 220L
  }
  timeout <- if (preview_quality == "quick") 12L else 30L

  .render_pptx_slide_preview_headless(
    pptx_path,
    timeout = timeout,
    dpi = preview_dpi
  )
}

mount_graficos <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/config", wrap_endpoint(function(req, res) {
      # Devuelve la config persistida (o defaults). El frontend la hidrata
      # en su store al montar GraficosPage y escribe cambios vía autosave
      # contra POST /config (debounce 2s).
      sid <- session_header(req)
      s <- session_get(sid)
      cfg <- .graficos_normalize_config(.graficos_config_get(sid, s), sid = sid, include_legacy_aliases = TRUE)
      list(ok = TRUE, config = cfg)
    })) |>
    plumber::pr_post("/api/graficos/config", wrap_endpoint(function(req, res, ...) {
      # Recibe el estado completo (plan + presets + wPresets + selected)
      # desde el autosave. No validamos schema acá: el frontend ya lo
      # garantiza; el backend es un kv-store por sid.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      cfg <- .graficos_normalize_config(parsed$config %||% parsed, sid = sid)
      .graficos_config_set(sid, cfg)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_get("/api/graficos/config/export", wrap_endpoint(function(req, res) {
      # Export del estado completo para que el analista lo guarde a disco
      # o lo comparta. Mismo patrón que Analítica.
      sid <- session_header(req)
      s <- session_get(sid)
      list(
        ok = TRUE,
        version = "graficos/4",
        exported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        config = .graficos_normalize_config(.graficos_config_get(sid, s), sid = sid, include_legacy_aliases = TRUE)
      )
    })) |>
    plumber::pr_post("/api/graficos/config/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      cfg <- .graficos_normalize_config(parsed, sid = sid)
      .graficos_config_set(sid, cfg)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_post("/api/graficos/share/export", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      .graficos_share_export(sid)
    })) |>
    plumber::pr_post("/api/graficos/share/inspect", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      .graficos_share_inspect(
        sid,
        file_id = parsed$file_id %||% NULL,
        filename = parsed$filename %||% parsed$nombre %||% NULL,
        data_base64 = parsed$data_base64 %||% NULL
      )
    })) |>
    plumber::pr_post("/api/graficos/share/import", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      file_id <- as.character(parsed$file_id %||% parsed$package_file_id %||% "")
      if (!nzchar(file_id)) {
        stop_api(400, "E_GRAFICOS_SHARE_NO_FILE_ID", "Falta package_file_id.")
      }
      .graficos_share_import(
        sid,
        file_id = file_id,
        selected_bases = parsed$selected_bases %||% parsed$bases %||% NULL
      )
    })) |>
    plumber::pr_get("/api/graficos/registry", wrap_endpoint(function(req, res) {
      # Devuelve el catálogo humano completo: cada slide y cada graficador
      # con titulo_humano, descripcion, icono_ui, categoria y args (cada
      # uno con label, tipo_input, grupo, descripcion, choices si aplica).
      # El frontend construye toda la UI de edición a partir de esto.
      sid <- session_header(req)
      capabilities <- list()
      if (!is.null(sid) && exists(".graficos_territorial_coverage_capabilities", mode = "function")) {
        capabilities$territorial_coverage <- tryCatch(
          .graficos_territorial_coverage_capabilities(sid),
          error = function(e) list(
            has_coverage_maps = FALSE,
            available = FALSE,
            disabled_reason = "Mapa de cobertura disponible cuando el proyecto tenga Hojas de Ruta y Monitoreo territorial."
          )
        )
      }
      .graficos_registry_payload(capabilities = capabilities)
    })) |>
    plumber::pr_get("/api/graficos/templates", wrap_endpoint(function(req, res) {
      # Catálogo de planes pre-armados (plan mínimo, reporte ejecutivo,
      # análisis poblacional, FODA dimensional). El frontend los muestra
      # en un modal cuando el analista quiere arrancar desde un template.
      # Los `plan.slides[*].id` son placeholder — el frontend los regenera
      # al aplicar el template para evitar colisiones con slides existentes.
      .templates_payload()
    })) |>
    plumber::pr_get("/api/graficos/ppt-style-profiles", wrap_endpoint(function(req, res) {
      # Catálogo de estilos visuales de presentación. A diferencia de
      # /templates, estos perfiles no crean slides: aplican presets PPT,
      # paletas y overrides al plan actual.
      .ppt_style_profiles_payload()
    })) |>
    plumber::pr_get("/api/graficos/preview-renderer", wrap_endpoint(function(req, res) {
      c(list(ok = TRUE), .preview_renderer_status())
    })) |>
    plumber::pr_post("/api/graficos/presets-defaults", wrap_endpoint(function(req, res, ...) {
      # "Guardar como default": toma los `presets` actuales del store de
      # la sesión (lo que el analista tiene configurado) y los guarda
      # como el nuevo default. Próximas sesiones o reset del plan van
      # a usar estos en vez de .PRESETS_DEFAULT_PULSO (de fábrica).
      #
      # Body opcional: { "presets": {...} }. Si viene, usa ese; si no,
      # usa los presets de la config activa actual.
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      presets_new <- NULL
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
        presets_new <- parsed$presets
      }
      if (is.null(presets_new)) {
        presets_new <- (.graficos_config_get(sid, s) %||% list())$presets
      }
      if (is.null(presets_new)) {
        stop_api(400, "E_NO_PRESETS", "No hay presets en la config actual para guardar como default.")
      }
      session_set(sid, "graficos_presets_defaults", presets_new)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_delete("/api/graficos/presets-defaults", wrap_endpoint(function(req, res) {
      # Resetea los "defaults del usuario" a los de fábrica (.PRESETS_DEFAULT_PULSO).
      # No toca el estado actual del store — solo el "factory default"
      # que usan los reset futuros.
      sid <- session_header(req)
      session_set(sid, "graficos_presets_defaults", NULL)
      list(ok = TRUE)
    })) |>
    plumber::pr_get("/api/graficos/presets-defaults", wrap_endpoint(function(req, res) {
      # Devuelve los presets default EFECTIVOS (los del usuario si los
      # hay, sino los de fábrica). El frontend los usa para el "Restaurar
      # default" — en vez de borrar el arg (que cae implícitamente al
      # default), el frontend puede pre-llenar con el default actual.
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      user <- if (!is.null(s)) s$graficos_presets_defaults else NULL
      list(
        ok = TRUE,
        presets = user %||% .PRESETS_DEFAULT_PULSO,
        es_custom = !is.null(user)
      )
    })) |>

    # ---- Overrides defaults ------------------------------------------
    # Mismo patrón que presets-defaults. Los "defaults" son la lista
    # de overrides reusables con la que arranca CUALQUIER estudio nuevo.
    # El modal "Defaults de overrides" edita esta lista → se persiste
    # en `s$graficos_overrides_defaults` (por-sesión-de-usuario, no
    # por-estudio). Si no hay custom, el fallback es `.OVERRIDES_DEFAULT_PULSO`.
    plumber::pr_get("/api/graficos/overrides-defaults", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid, required = FALSE)
      user <- if (!is.null(s)) s$graficos_overrides_defaults else NULL
      list(
        ok = TRUE,
        overrides = user %||% .OVERRIDES_DEFAULT_PULSO,
        es_custom = !is.null(user)
      )
    })) |>
    plumber::pr_post("/api/graficos/overrides-defaults", wrap_endpoint(function(req, res, ...) {
      # Body: { "overrides": [ {id, nombre, tipo_preset, args}, ... ] }.
      # Si no viene body, toma la lista actual del store del estudio
      # (`overrides_reusables` de la config activa) — equivalente al
      # "Guardar como default" de presets.
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      overrides_new <- NULL
      if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        parsed <- tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
        overrides_new <- parsed$overrides
      }
      if (is.null(overrides_new)) {
        overrides_new <- (.graficos_config_get(sid, s) %||% list())$overrides_reusables
      }
      if (is.null(overrides_new)) {
        stop_api(400, "E_NO_OVERRIDES",
                 "No hay overrides en la config actual para guardar como default.")
      }
      # Sanity check liviano: debe ser una lista (array) — no un dict.
      if (!is.list(overrides_new) || !is.null(names(overrides_new))) {
        stop_api(400, "E_BAD_OVERRIDES",
                 "Formato inválido: se esperaba un array de overrides.")
      }
      session_set(sid, "graficos_overrides_defaults", overrides_new)
      list(ok = TRUE, saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_delete("/api/graficos/overrides-defaults", wrap_endpoint(function(req, res) {
      # Resetea al set de fábrica (.OVERRIDES_DEFAULT_PULSO).
      sid <- session_header(req)
      session_set(sid, "graficos_overrides_defaults", NULL)
      list(ok = TRUE)
    })) |>
    plumber::pr_get("/api/graficos/presets-metadata", wrap_endpoint(function(req, res) {
      # Catálogo humano de los presets globales (p_presets): cada tipo
      # (base, barras_apiladas, pie, dim_radar, …) con titulo_humano,
      # descripción, y args curados para el editor (tipografía, tamaños,
      # canvas, leyendas). El PresetsEditor del frontend usa este
      # metadata + `ArgField` para construir la UI.
      #
      # Igual que /registry, el frontend pinta solo lo que está curado;
      # args técnicos raros quedan fuera del UI y se setean vía overrides
      # por-slot o JSON avanzado.
      .presets_metadata_payload()
    })) |>
    plumber::pr_get("/api/graficos/variables", wrap_endpoint(function(req, res) {
      # Devuelve las variables agrupadas por fuente (multi-base, v0.2+).
      # Respuesta:
      #   {
      #     sources: [
      #       { name: "docentes", variables: [{ name, label, tipo, seccion }, ...] },
      #       { name: "estudiantes", variables: [...] },
      #       ...
      #     ],
      #     multi: true|false   (si hay >1 fuente)
      #   }
      # El frontend usa `sources[0].variables` directamente si multi=false
      # (back-compat visual: sin dropdown de fuente), o el dropdown cuando
      # multi=true.
      sid <- session_header(req)
      .graficos_variables_sources_payload(sid, scoped = TRUE)
    })) |>
    plumber::pr_post("/api/graficos/plan/coverage", wrap_endpoint(function(req, res, ...) {
      # Diagnostico vivo de cobertura del plan de graficos. No bloquea
      # exportacion: informa cuantas variables graficables estan cubiertas,
      # cuales quedan sin usar y cuales fueron excluidas por tipo/recodificacion.
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      parsed <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
      } else {
        list()
      }
      .graficos_plan_coverage(
        sid,
        plan = parsed$plan %||% NULL,
        config = parsed$config %||% NULL
      )
    })) |>
    plumber::pr_post("/api/graficos/plan/sugerido", wrap_endpoint(function(req, res, ...) {
      # Genera una propuesta de plan sin persistirla. La UI muestra
      # previsualizacion y solo aplica si el usuario confirma.
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      parsed <- if (nzchar(body_raw)) {
        Encoding(body_raw) <- "UTF-8"
        tryCatch(
          jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
          error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
        )
      } else {
        list()
      }
      .graficos_suggested_plan(sid, config = parsed$config %||% NULL)
    })) |>
    plumber::pr_get("/api/graficos/paletas-sugeridas", wrap_endpoint(function(req, res) {
      # Devuelve todas las listas de choices del instrumento con sus
      # value-labels, para que la UI del editor de paletas sepa qué
      # rellenar. Formato:
      #   [{list_name, choices: [{name, label}]}]
      # Si ya hay una paleta guardada para un list_name en el config, el
      # frontend la mergea por encima. Si no, muestra los labels sin
      # color asignado (placeholder gris).
      sid <- session_header(req)
      s <- session_get(sid)
      inst_sources <- .graficos_processing_sources(sid)$inst_sources
      if (!length(inst_sources) && !is.null(s$rp_inst)) inst_sources <- list(default = s$rp_inst)
      list(listas = .graficos_collect_palette_lists(inst_sources))
    })) |>
    plumber::pr_post("/api/graficos/icons/upload", wrap_endpoint(function(req, res, ...) {
      # Recibe un PNG codificado en base64 (plus nombre humano) y lo
      # persiste en sesión como archivo descargable. Devuelve
      # {ok, id, file_id, nombre}. El store del frontend luego guarda
      # esta referencia en `iconos` y la envía al exportar slides de
      # población (el backend la resuelve a path al construir el slide).
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- as.character(parsed$nombre %||% "")
      data_b64 <- as.character(parsed$data_base64 %||% "")
      if (!nzchar(nombre))  stop_api(400, "E_NO_NOMBRE", "Falta 'nombre'.")
      if (!nzchar(data_b64)) stop_api(400, "E_NO_DATA",   "Falta 'data_base64'.")

      # Quitar prefijo "data:image/png;base64," si viene
      data_b64 <- sub("^data:[^;]*;base64,", "", data_b64)
      bytes <- tryCatch(
        jsonlite::base64_dec(data_b64),
        error = function(e) stop_api(400, "E_BAD_BASE64", conditionMessage(e))
      )
      # Validación mínima: chequear firma PNG (89 50 4E 47 0D 0A 1A 0A)
      png_sig <- as.raw(c(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
      if (length(bytes) < 8L || !identical(bytes[1:8], png_sig)) {
        stop_api(400, "E_BAD_PNG", "El archivo no parece ser un PNG válido.")
      }

      icons_dir <- file.path(s$dir, "icons")
      dir.create(icons_dir, showWarnings = FALSE, recursive = TRUE)
      file_id <- uuid::UUIDgenerate()
      path <- file.path(icons_dir, paste0(file_id, ".png"))
      writeBin(bytes, path)

      # Registrar en el file store para que /files/:id/download sirva.
      meta <- .register_output_file(sid, "graficos_icon", path)

      list(
        ok = TRUE,
        id = file_id,
        file_id = meta$file_id,
        nombre = nombre,
        uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
    })) |>
    plumber::pr_post("/api/graficos/validar", wrap_endpoint(function(req, res, plan = NULL) {
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      .validar_plan_json(plan)
    })) |>
    plumber::pr_post("/api/graficos/preview-slide", wrap_endpoint(function(req, res, ...) {
      # Genera un .pptx mini con UN solo slide, para que el analista vea
      # cómo queda su slide específico sin tener que correr el reporte
      # completo. Fiel al output final (usa el mismo pipeline de export)
      # pero rápido (2-3s típico para 1 slide).
      #
      # Sincrónico (no callr) porque el tamaño es chico. Si en el futuro
      # vemos timeouts con dimensiones/FODA, migramos a job_submit.
      sid <- session_header(req)
      s <- .require_rp_data(sid)

      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      slide <- parsed$slide
      if (is.null(slide)) stop_api(400, "E_NO_SLIDE", "Body debe incluir 'slide'.")
      preview_quality <- tolower(as.character(parsed$preview_quality %||% "quick"))
      if (!preview_quality %in% c("quick", "normal")) {
        stop_api(400, "E_BAD_PREVIEW_QUALITY", "preview_quality debe ser 'quick' o 'normal'.")
      }
      include_images <- parsed$include_images %||% TRUE
      if (!is.logical(include_images) || length(include_images) != 1L) {
        stop_api(400, "E_BAD_INCLUDE_IMAGES", "include_images debe ser booleano.")
      }

      # Validación mínima: tiene tipo y payload.
      tipo <- as.character(slide$tipo %||% "")
      if (!nzchar(tipo) || !(tipo %in% .slide_names())) {
        stop_api(400, "E_BAD_SLIDE", sprintf("Tipo de slide inválido: '%s'", tipo))
      }

      # Presets desde la config del store (si los hay), para que el preview
      # respete el estilo global ya configurado en Configuración Global.
      # Enriquecemos con usar_canvas=TRUE + debug_ph (invariantes globales
      # que el backend aplica antes de cada export).
      cfg <- .graficos_effective_config(sid, parsed$config %||% parsed$graficos_config)
      presets_json <- .enriquecer_presets(cfg$presets %||% list(), cfg$debug_ph)
      icon_registry <- .graficos_icon_registry(sid, cfg)
      palette_env <- .graficos_palette_env(cfg$paletas %||% list(), parent = parent.frame())
      preview_cache_key <- digest::digest(list(
        slide = slide,
        active_base = .graficos_active_base_name(sid),
        preset_hash = digest::digest(
          list(
            presets = cfg$presets %||% list(),
            debug_ph = cfg$debug_ph %||% list(),
            iconos = cfg$iconos %||% list(),
            paletas = cfg$paletas %||% list()
          ),
          algo = "xxhash64"
        ),
        preview_quality = preview_quality,
        include_images = include_images
      ), algo = "xxhash64")
      preview_cache <- s$graficos_preview_cache %||% list()
      if (!is.list(preview_cache)) preview_cache <- list()
      now <- as.numeric(Sys.time())
      if (length(preview_cache)) {
        preview_cache <- preview_cache[vapply(
          preview_cache,
          function(v) {
            is.list(v) &&
              is.numeric(v$cached_at) &&
              v$cached_at >= (now - 300)
          },
          logical(1)
        )]
      }
      cached <- preview_cache[[preview_cache_key]] %||% NULL
      if (is.list(cached) && is.numeric(cached$cached_at) && cached$cached_at >= now - 300) {
        cached_meta <- tryCatch(
          get_file(sid, cached$file_id),
          error = function(e) NULL
        )
        if (!is.null(cached_meta) && file.exists(cached_meta$path)) {
          session_set(sid, "graficos_preview_cache", preview_cache)
          return(list(
            ok = TRUE,
            file_id = cached$file_id,
            size = cached$size,
            type = "pptx",
            images = if (include_images) cached$images %||% list() else list(),
            slide_preview = cached$slide_preview %||% NA
          ))
        }
      }

      # Plan mini con un solo slide.
      mini_plan <- list(slides = list(slide))

      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      out_path <- file.path(s$dir, "downloads", sprintf("preview_%s.pptx", uuid::UUIDgenerate()))

      # Construir slide con las mismas funciones que usa el worker de /ppt.
      slide_registry <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry <- .graf_names()
      graficador_aliases <- .GRAFICADOR_LEGACY_ALIASES

      promote_graph_title <- function(args, fn) {
        args <- as.list(args %||% list())
        if (!("titulo" %in% names(args)) || !("overrides" %in% names(formals(fn)))) return(args)
        title_value <- args$titulo
        has_title <- !(
          is.null(title_value) ||
            length(title_value) == 0L ||
            (length(title_value) == 1L && is.list(title_value) && is.null(title_value[[1]])) ||
            (length(title_value) == 1L && is.atomic(title_value) && is.na(title_value)) ||
            (length(title_value) == 1L && is.character(title_value) && !nzchar(trimws(title_value)))
        )
        if (!isTRUE(has_title)) return(args)
        overrides <- as_list_shallow(args$overrides) %||% list()
        override_title <- overrides$titulo %||% NULL
        has_override_title <- !(
          is.null(override_title) ||
            length(override_title) == 0L ||
            (length(override_title) == 1L && is.list(override_title) && is.null(override_title[[1]])) ||
            (length(override_title) == 1L && is.atomic(override_title) && is.na(override_title)) ||
            (length(override_title) == 1L && is.character(override_title) && !nzchar(trimws(override_title)))
        )
        if (!isTRUE(has_override_title)) overrides$titulo <- as.character(title_value)[1]
        args$overrides <- overrides
        args$titulo <- NULL
        args
      }
      rebuild_graf <- function(g) {
        if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
        graficador_name <- graficador_aliases[[g$graficador]] %||% g$graficador
        if (!(graficador_name %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
        fn <- getExportedValue("prosecnurapp", graficador_name)
        args <- .graficos_drop_blank_optional_refs(g$args %||% list())
        if (.graficos_args_missing_required_ref(args)) return(.graficos_blank_graph_element())
        args <- promote_graph_title(args, fn)
        args <- args[names(args) %in% names(formals(fn))]
        args <- args[!vapply(args, function(v) {
          is.null(v) ||
            length(v) == 0L ||
            (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
            (length(v) == 1L && is.atomic(v) && is.na(v))
        }, logical(1))]
        do.call(fn, args)
      }
      as_list_shallow <- function(x) {
        if (is.null(x)) return(NULL)
        if (is.list(x)) return(x)
        as.list(x)
      }
      rebuild_slide <- function(s0) {
        s0 <- as.list(s0)
        tipo0 <- as.character(s0$tipo %||% "")
        if (!nzchar(tipo0) || !(tipo0 %in% names(slide_registry))) {
          stop(sprintf("Tipo de slide inválido: %s", tipo0))
        }
        payload <- as_list_shallow(s0$payload) %||% list()
        payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
        for (slot_name in slide_registry[[tipo0]]$grafs) {
          if (!is.null(payload[[slot_name]])) {
            payload[[slot_name]] <- rebuild_graf(as_list_shallow(payload[[slot_name]]))
          }
        }
        fn <- getExportedValue("prosecnurapp", tipo0)
        payload <- .graficos_normalize_payload_icon(payload, fn, tipo0, icon_registry = icon_registry)
        allowed_args <- names(formals(fn))
        payload <- payload[names(payload) %in% allowed_args]
        do.call(fn, payload)
      }

      build_presets <- function(pj) {
        if (is.null(pj) || length(pj) == 0) return(NULL)
        do.call(p_presets, lapply(pj, as.list))
      }

      # Ejecución del preview. Envuelvo en tryCatch para devolver un
      # error legible si algún arg falta o invalida.
      #
      # `data` e `instrumento` se pasan como listas nombradas (multi-base).
      # Cuando hay 1 sola base, el scoping devuelve
      # `list(<nombre> = df)` y el motor maneja ese caso como single-base.
      scoped_sources <- .graficos_processing_sources(sid)
      tryCatch({
        slide_r <- rebuild_slide(slide)
        reporte_ppt_plan(
          data = scoped_sources$data_sources,
          instrumento = scoped_sources$inst_sources,
          path_ppt = out_path,
          presets = build_presets(presets_json),
          plan = do.call(p_plan, list(slides = list(slide_r))),
          env_diapos = palette_env,
          mensajes_progreso = FALSE
        )
      }, error = function(e) {
        stop_api(400, "E_PREVIEW_FAILED",
                 sprintf("No se pudo generar el preview: %s", .graficos_base_error(sid, conditionMessage(e))))
      })

      # Si no hay renderer headless disponible, devolvemos el .pptx y
      # mantenemos slide_preview en NULL para que el front-end ofrezca
      # descarga de fallback sin romper flujo.
      renderer_status <- .preview_renderer_status()

      # Extraemos las imágenes PNG embebidas en el .pptx para devolverlas
      # inline al frontend. Los graficadores de prosecnur con
      # `usar_canvas=TRUE` (invariante global) renderizan cada slot como
      # un PNG dentro de `ppt/media/` del .pptx. Leerlos es más barato que
      # convertir el pptx a png con libreoffice/magick y no requiere
      # dependencias externas — solo descomprimir un ZIP (el pkg `zip`
      # ya es dep del launcher).
      #
      # Si hay 1 slot, `images` tiene 1 PNG (el del gráfico). Si hay N
      # slots, N PNGs. El frontend los puede mostrar lado a lado. Los
      # layouts puros (p_slide_portada, p_slide_indice) devuelven 0.
      images <- if (isTRUE(include_images)) .extract_pptx_images(out_path) else list()
      slide_preview <- if (isTRUE(renderer_status$available)) {
        .render_pptx_slide_preview(
          out_path,
          preview_quality = preview_quality
        )
      } else {
        NULL
      }
      meta <- .register_output_file(sid, "graficos_preview", out_path)
      preview_cache[[preview_cache_key]] <- list(
        file_id = meta$file_id,
        size = meta$size,
        images = images,
        slide_preview = slide_preview,
        cached_at = now
      )
      if (length(preview_cache) > 16L) {
        order_idx <- order(
          vapply(
            preview_cache,
            function(v) if (is.list(v) && is.numeric(v$cached_at)) v$cached_at else 0,
            numeric(1)
          ),
          decreasing = TRUE,
          na.last = TRUE
        )
        preview_cache <- preview_cache[order_idx][seq_len(min(length(order_idx), 16L))]
      }
      session_set(sid, "graficos_preview_cache", preview_cache)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        size = meta$size,
        type = "pptx",
        images = images,
        slide_preview = slide_preview %||% NA
      )
    })) |>
    plumber::pr_post("/api/graficos/ppt", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL, config = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      # Enriquecer presets con canvas-always + debug_ph global antes de
      # pasarlos al worker (invariantes Pulso).
      cfg <- .graficos_effective_config(sid, config)
      presets <- .enriquecer_presets(presets, cfg$debug_ph)
      # Serializamos las LISTAS NOMBRADAS (multi-base) a RDS para el
      # worker. Cuando hay 1 sola base, la lista tiene 1 sola entrada
      # y el motor la maneja como single-base automáticamente.
      scoped_sources <- .graficos_processing_sources(sid)
      rp_data_path <- job_save_rds(sid, "rp_data_sources", scoped_sources$data_sources)
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", scoped_sources$inst_sources)
      active_base_arg <- .graficos_active_base_name(sid)
      # El worker recibe el registry como argumento (serializado desde el
       # main process) — así una única fuente de verdad vive en
       # graficos_metadata.R, y el worker callr no necesita duplicarla.
      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()
      icon_registry_arg <- .graficos_icon_registry(sid, cfg)
      paletas_arg <- cfg$paletas %||% list()

      # El worker hereda nada del main process (callr::r_bg). Necesitamos
      # cargar el paquete prosecnurapp en el subproceso para que resuelva
      # los p_slide_*/p_barras_*/reporte_ppt_plan (ahora todos viven en
      # prosecnurapp, no en un paquete externo).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.ppt",
        func = function(rp_data_path, rp_inst_path, plan, presets, paletas,
                        slide_registry, graficador_registry,
                        icon_registry,
                        active_base,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          } else {
            stop("Worker requiere 'pkgload' o 'devtools' instalados.")
          }
          `%||%` <- function(a, b) if (is.null(a)) b else a
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          base_error <- function(msg) {
            if (!is.null(active_base) && nzchar(as.character(active_base))) {
              sprintf("Base '%s': %s", as.character(active_base), msg)
            } else {
              msg
            }
          }
          report("loading", percent = 2, message = "Cargando datos y plantilla...")
          as_json_list <- function(x) {
            if (is.null(x)) return(NULL)
            if (is.data.frame(x)) return(as.list(x))
            if (is.list(x)) return(x)
            as.list(x)
          }
          promote_graph_title <- function(args, fn) {
            args <- as.list(args %||% list())
            if (!("titulo" %in% names(args)) || !("overrides" %in% names(formals(fn)))) return(args)
            title_value <- args$titulo
            has_title <- !(
              is.null(title_value) ||
                length(title_value) == 0L ||
                (length(title_value) == 1L && is.list(title_value) && is.null(title_value[[1]])) ||
                (length(title_value) == 1L && is.atomic(title_value) && is.na(title_value)) ||
                (length(title_value) == 1L && is.character(title_value) && !nzchar(trimws(title_value)))
            )
            if (!isTRUE(has_title)) return(args)
            overrides <- as_json_list(args$overrides) %||% list()
            override_title <- overrides$titulo %||% NULL
            has_override_title <- !(
              is.null(override_title) ||
                length(override_title) == 0L ||
                (length(override_title) == 1L && is.list(override_title) && is.null(override_title[[1]])) ||
                (length(override_title) == 1L && is.atomic(override_title) && is.na(override_title)) ||
                (length(override_title) == 1L && is.character(override_title) && !nzchar(trimws(override_title)))
            )
            if (!isTRUE(has_override_title)) overrides$titulo <- as.character(title_value)[1]
            args$overrides <- overrides
            args$titulo <- NULL
            args
          }
          blank_ref_value <- function(x) {
            is.character(x) && (!length(x) || all(!nzchar(trimws(x))))
          }
          missing_required_ref <- function(args) {
            if (!is.list(args)) return(FALSE)
            for (arg_name in c("var", "objetivo")) {
              if (!is.null(args[[arg_name]]) && blank_ref_value(args[[arg_name]])) return(TRUE)
            }
            vars <- args$vars
            if (is.character(vars) && (!length(vars) || all(!nzchar(trimws(vars))))) return(TRUE)
            if (is.list(vars) && length(vars)) {
              if (any(vapply(vars, function(value) {
                if (is.character(value)) return(!length(value) || all(!nzchar(trimws(value))))
                if (is.list(value)) return(missing_required_ref(value))
                FALSE
              }, logical(1)))) return(TRUE)
            }
            if (is.list(args$bloques) && length(args$bloques)) {
              if (any(vapply(args$bloques, missing_required_ref, logical(1)))) return(TRUE)
            }
            FALSE
          }
          drop_blank_optional_refs <- function(args) {
            if (!is.list(args)) return(args)
            for (arg_name in c("cruces", "cruce", "iter_var")) {
              if (!is.null(args[[arg_name]]) && blank_ref_value(args[[arg_name]])) args[[arg_name]] <- NULL
            }
            if (is.list(args$bloques) && length(args$bloques)) {
              args$bloques <- lapply(args$bloques, drop_blank_optional_refs)
            }
            args
          }
          blank_graph_element <- function() {
            if (!requireNamespace("ggplot2", quietly = TRUE)) {
              stop("Se requiere el paquete 'ggplot2' para crear placeholders de graficos vacios.")
            }
            p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void())
          }
          graficador_aliases <- c(p_barras = "p_barras_agrupadas")
          rebuild_graf <- function(g) {
            if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
            graficador_name <- graficador_aliases[[g$graficador]] %||% g$graficador
            if (!(graficador_name %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
            fn <- getExportedValue("prosecnurapp", graficador_name)
            args <- drop_blank_optional_refs(g$args %||% list())
            if (missing_required_ref(args)) return(blank_graph_element())
            args <- promote_graph_title(args, fn)
            args <- args[names(args) %in% names(formals(fn))]
            args <- args[!vapply(args, function(v) {
              is.null(v) ||
                length(v) == 0L ||
                (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
                (length(v) == 1L && is.atomic(v) && is.na(v))
            }, logical(1))]
            do.call(fn, args)
          }
          rebuild_slide <- function(s) {
            s <- as.list(s)
            tipo <- as.character(s$tipo %||% "")
            if (!nzchar(tipo)) stop("Slide sin tipo")
            if (!(tipo %in% names(slide_registry))) stop(sprintf("Tipo de slide no registrado: %s", tipo))
            fn <- getExportedValue("prosecnurapp", tipo)
            payload <- as_json_list(s$payload) %||% list()
            payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
            for (slot_name in slide_registry[[tipo]]$grafs) {
              if (!is.null(payload[[slot_name]])) {
                payload[[slot_name]] <- rebuild_graf(as_json_list(payload[[slot_name]]))
              }
            }
            payload <- .graficos_normalize_payload_icon(payload, fn, tipo, icon_registry = icon_registry)
            allowed_args <- names(formals(fn))
            payload <- payload[names(payload) %in% allowed_args]
            do.call(fn, payload)
          }
          build_presets <- function(presets_json) {
            if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
            do.call(p_presets, lapply(presets_json, as.list))
          }
          palette_env <- .graficos_palette_env(paletas, parent = parent.frame())
          total_slides <- length(plan$slides)
          slides_r <- vector("list", total_slides)
          for (i in seq_len(total_slides)) {
            report(
              "rebuild",
              current = i,
              total = total_slides,
              percent = 5 + round(45 * (i - 1) / max(1, total_slides)),
              message = sprintf("Armando slide %s de %s...", i, total_slides)
            )
            slides_r[[i]] <- tryCatch(
              rebuild_slide(plan$slides[[i]]),
              error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
            )
          }
          report("render", percent = 60, message = "Renderizando presentación...")
          tryCatch(
            reporte_ppt_plan(
              data = readRDS(rp_data_path),
              instrumento = readRDS(rp_inst_path),
              path_ppt = result_path,
              presets = build_presets(presets),
              plan = do.call(p_plan, list(slides = slides_r)),
              env_diapos = palette_env,
              mensajes_progreso = FALSE
            ),
            error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
          )
          report("export", percent = 96, message = "Guardando PPTX...")
          list(path = result_path, n_slides = length(slides_r))
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          plan = plan,
          presets = presets,
          paletas = paletas_arg,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg,
          icon_registry = icon_registry_arg,
          active_base = active_base_arg,
          api_path = api_path
        ),
        result_filename = .graficos_export_filename(sid, "reporte_ppt", "pptx"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_ppt", j$result_path)
          .graficos_status_set(j$sid, "graficos_ppt_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size, n_slides = j$result_data$n_slides)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.ppt")
    })) |>
    plumber::pr_post("/api/graficos/word", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL, config = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      # Mismas invariantes que en /ppt.
      cfg <- .graficos_effective_config(sid, config)
      presets <- .enriquecer_presets(presets, cfg$debug_ph)
      # Serializamos las LISTAS NOMBRADAS (multi-base) a RDS para el
      # worker. Cuando hay 1 sola base, la lista tiene 1 sola entrada
      # y el motor la maneja como single-base automáticamente.
      scoped_sources <- .graficos_processing_sources(sid)
      rp_data_path <- job_save_rds(sid, "rp_data_sources", scoped_sources$data_sources)
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources", scoped_sources$inst_sources)
      active_base_arg <- .graficos_active_base_name(sid)
      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()
      icon_registry_arg <- .graficos_icon_registry(sid, cfg)
      paletas_arg <- cfg$paletas %||% list()

      # Ver comentario en /ppt: el worker necesita cargar prosecnurapp
      # (el motor ya vive dentro del paquete de la app).
      api_path <- .app_api_dir()

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.word",
        func = function(rp_data_path, rp_inst_path, plan, presets, w_presets, paletas,
                        slide_registry, graficador_registry,
                        icon_registry,
                        active_base,
                        api_path, result_path, progress_path = NULL) {
          if (requireNamespace("pkgload", quietly = TRUE)) {
            pkgload::load_all(api_path, quiet = TRUE)
          } else if (requireNamespace("devtools", quietly = TRUE)) {
            devtools::load_all(api_path, quiet = TRUE)
          } else {
            stop("Worker requiere 'pkgload' o 'devtools' instalados.")
          }
          `%||%` <- function(a, b) if (is.null(a)) b else a
          report <- if (exists("job_progress_writer", mode = "function")) {
            job_progress_writer(progress_path)
          } else {
            function(...) invisible(NULL)
          }
          base_error <- function(msg) {
            if (!is.null(active_base) && nzchar(as.character(active_base))) {
              sprintf("Base '%s': %s", as.character(active_base), msg)
            } else {
              msg
            }
          }
          report("loading", percent = 2, message = "Cargando datos y plantilla...")
          # slide_registry / graficador_registry vienen del main process
          # (fuente única de verdad en graficos_metadata.R).
          as_json_list <- function(x) {
            if (is.null(x)) return(NULL)
            if (is.data.frame(x)) return(as.list(x))
            if (is.list(x)) return(x)
            as.list(x)
          }
          promote_graph_title <- function(args, fn) {
            args <- as.list(args %||% list())
            if (!("titulo" %in% names(args)) || !("overrides" %in% names(formals(fn)))) return(args)
            title_value <- args$titulo
            has_title <- !(
              is.null(title_value) ||
                length(title_value) == 0L ||
                (length(title_value) == 1L && is.list(title_value) && is.null(title_value[[1]])) ||
                (length(title_value) == 1L && is.atomic(title_value) && is.na(title_value)) ||
                (length(title_value) == 1L && is.character(title_value) && !nzchar(trimws(title_value)))
            )
            if (!isTRUE(has_title)) return(args)
            overrides <- as_json_list(args$overrides) %||% list()
            override_title <- overrides$titulo %||% NULL
            has_override_title <- !(
              is.null(override_title) ||
                length(override_title) == 0L ||
                (length(override_title) == 1L && is.list(override_title) && is.null(override_title[[1]])) ||
                (length(override_title) == 1L && is.atomic(override_title) && is.na(override_title)) ||
                (length(override_title) == 1L && is.character(override_title) && !nzchar(trimws(override_title)))
            )
            if (!isTRUE(has_override_title)) overrides$titulo <- as.character(title_value)[1]
            args$overrides <- overrides
            args$titulo <- NULL
            args
          }
          blank_ref_value <- function(x) {
            is.character(x) && (!length(x) || all(!nzchar(trimws(x))))
          }
          missing_required_ref <- function(args) {
            if (!is.list(args)) return(FALSE)
            for (arg_name in c("var", "objetivo")) {
              if (!is.null(args[[arg_name]]) && blank_ref_value(args[[arg_name]])) return(TRUE)
            }
            vars <- args$vars
            if (is.character(vars) && (!length(vars) || all(!nzchar(trimws(vars))))) return(TRUE)
            if (is.list(vars) && length(vars)) {
              if (any(vapply(vars, function(value) {
                if (is.character(value)) return(!length(value) || all(!nzchar(trimws(value))))
                if (is.list(value)) return(missing_required_ref(value))
                FALSE
              }, logical(1)))) return(TRUE)
            }
            if (is.list(args$bloques) && length(args$bloques)) {
              if (any(vapply(args$bloques, missing_required_ref, logical(1)))) return(TRUE)
            }
            FALSE
          }
          drop_blank_optional_refs <- function(args) {
            if (!is.list(args)) return(args)
            for (arg_name in c("cruces", "cruce", "iter_var")) {
              if (!is.null(args[[arg_name]]) && blank_ref_value(args[[arg_name]])) args[[arg_name]] <- NULL
            }
            if (is.list(args$bloques) && length(args$bloques)) {
              args$bloques <- lapply(args$bloques, drop_blank_optional_refs)
            }
            args
          }
          blank_graph_element <- function() {
            if (!requireNamespace("ggplot2", quietly = TRUE)) {
              stop("Se requiere el paquete 'ggplot2' para crear placeholders de graficos vacios.")
            }
            p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void())
          }
          graficador_aliases <- c(p_barras = "p_barras_agrupadas")
          rebuild_graf <- function(g) {
            if (is.null(g) || is.null(g$graficador) || !nzchar(g$graficador)) return(NULL)
            graficador_name <- graficador_aliases[[g$graficador]] %||% g$graficador
            if (!(graficador_name %in% graficador_registry)) stop(sprintf("Graficador no registrado: %s", g$graficador))
            fn <- getExportedValue("prosecnurapp", graficador_name)
            args <- drop_blank_optional_refs(g$args %||% list())
            if (missing_required_ref(args)) return(blank_graph_element())
            args <- promote_graph_title(args, fn)
            args <- args[names(args) %in% names(formals(fn))]
            args <- args[!vapply(args, function(v) {
              is.null(v) ||
                length(v) == 0L ||
                (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
                (length(v) == 1L && is.atomic(v) && is.na(v))
            }, logical(1))]
            do.call(fn, args)
          }
          rebuild_slide <- function(s) {
            s <- as.list(s)
            tipo <- as.character(s$tipo %||% "")
            if (!nzchar(tipo)) stop("Slide sin tipo")
            if (!(tipo %in% names(slide_registry))) stop(sprintf("Tipo de slide no registrado: %s", tipo))
            fn <- getExportedValue("prosecnurapp", tipo)
            payload <- as_json_list(s$payload) %||% list()
            payload <- lapply(payload, function(v) if (is.list(v) && length(v) == 1 && is.null(names(v))) v[[1]] else v)
            for (slot_name in slide_registry[[tipo]]$grafs) {
              if (!is.null(payload[[slot_name]])) {
                payload[[slot_name]] <- rebuild_graf(as_json_list(payload[[slot_name]]))
              }
            }
            payload <- .graficos_normalize_payload_icon(payload, fn, tipo, icon_registry = icon_registry)
            allowed_args <- names(formals(fn))
            payload <- payload[names(payload) %in% allowed_args]
            do.call(fn, payload)
          }
          build_presets <- function(presets_json) {
            if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
            do.call(p_presets, lapply(presets_json, as.list))
          }
          build_w_presets <- function(w_json) {
            if (is.null(w_json) || length(w_json) == 0) return(NULL)
            do.call(getExportedValue("prosecnurapp", "w_presets"), as.list(w_json))
          }
          palette_env <- .graficos_palette_env(paletas, parent = parent.frame())
          total_slides <- length(plan$slides)
          slides_r <- vector("list", total_slides)
          for (i in seq_len(total_slides)) {
            report(
              "rebuild",
              current = i,
              total = total_slides,
              percent = 5 + round(45 * (i - 1) / max(1, total_slides)),
              message = sprintf("Armando seccion %s de %s...", i, total_slides)
            )
            slides_r[[i]] <- tryCatch(
              rebuild_slide(plan$slides[[i]]),
              error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
            )
          }
          report("render", percent = 60, message = "Renderizando documento...")
          tryCatch(
            reporte_word_plan(
              data = readRDS(rp_data_path),
              instrumento = readRDS(rp_inst_path),
              path_docx = result_path,
              presets_ppt = build_presets(presets),
              presets_word = build_w_presets(w_presets),
              plan = do.call(p_plan, list(slides = slides_r)),
              env_diapos = palette_env,
              mensajes_progreso = FALSE
            ),
            error = function(e) stop(base_error(conditionMessage(e)), call. = FALSE)
          )
          report("export", percent = 96, message = "Guardando DOCX...")
          list(path = result_path, n_slides = length(slides_r))
        },
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          plan = plan,
          presets = presets,
          w_presets = w_presets,
          paletas = paletas_arg,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg,
          icon_registry = icon_registry_arg,
          active_base = active_base_arg,
          api_path = api_path
        ),
        result_filename = .graficos_export_filename(sid, "reporte_word", "docx"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_word", j$result_path)
          .graficos_status_set(j$sid, "graficos_word_ok", TRUE)
          list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size, n_slides = j$result_data$n_slides)
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.word")
    }))
}
