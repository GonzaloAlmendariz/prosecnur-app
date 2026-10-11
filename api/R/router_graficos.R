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

.graficos_delivery_options <- function(config = NULL, profile_id = NULL, template_id = NULL,
                                        auto_otros_slides = NULL) {
  cfg <- .as_json_list(config) %||% list()
  global <- .as_json_list((cfg$scope_rules %||% list())$global) %||% list()
  profile <- as.character(profile_id %||% global$profile_id %||% global$profileId %||%
                            cfg$profile_id %||% cfg$profileId %||% "")[1]
  template <- as.character(template_id %||% global$template_id %||% global$templateId %||%
                             cfg$template_id %||% cfg$templateId %||% "")[1]
  if (!nzchar(template) && identical(profile, "acnur_kobo_cruncher_plus")) template <- "acnur_16_9"
  if (!nzchar(template)) template <- "generic_16_9"
  auto_others <- auto_otros_slides %||% global$auto_otros_slides %||% global$autoOtrosSlides %||%
    cfg$auto_otros_slides %||% cfg$autoOtrosSlides
  # B42/G-18: opt-in universal. El default por-template (TRUE salvo ACNUR)
  # era la compuerta que seguia inyectando la lamina "Otros" aunque el
  # motor ya defaulteara FALSE — el usuario la pidio como opcion, no como
  # sorpresa.
  if (is.null(auto_others)) auto_others <- FALSE
  list(
    profile_id = profile,
    template_id = template,
    auto_otros_slides = isTRUE(auto_others)
  )
}

.graficos_resolve_template_pptx <- function(config = NULL, profile_id = NULL,
                                             template_id = NULL, template_pptx = NULL) {
  explicit <- as.character(template_pptx %||% "")[1]
  if (nzchar(explicit) && file.exists(explicit)) return(explicit)
  delivery <- .graficos_delivery_options(config, profile_id = profile_id, template_id = template_id)
  filename <- if (identical(delivery$template_id, "acnur_16_9")) {
    "plantilla_acnur_16_9.pptx"
  } else {
    "plantilla_16_9.pptx"
  }
  configured <- getOption("prosecnur.template_pptx", NA_character_)
  if (!is.null(configured) && !is.na(configured) && nzchar(configured) && file.exists(configured)) {
    return(configured)
  }
  candidate <- tryCatch(system.file(file.path("plantillas", filename), package = "prosecnurapp"), error = function(e) "")
  if (!nzchar(candidate) || !file.exists(candidate)) {
    candidate <- tryCatch(system.file(file.path("plantillas", filename), package = "prosecnur"), error = function(e) "")
  }
  if (!nzchar(candidate) || !file.exists(candidate)) {
    repo_root <- Sys.getenv("PULSO_REPO_ROOT", "")
    if (nzchar(repo_root)) {
      alt <- file.path(repo_root, "api", "inst", "plantillas", filename)
      if (file.exists(alt)) candidate <- alt
    }
  }
  if (!nzchar(candidate) || !file.exists(candidate)) {
    api_dir <- tryCatch(.app_api_dir(), error = function(e) "")
    candidates <- c(
      if (nzchar(api_dir)) file.path(api_dir, "inst", "plantillas", filename) else "",
      file.path(getwd(), "api", "inst", "plantillas", filename),
      file.path(getwd(), "inst", "plantillas", filename)
    )
    cursor <- normalizePath(getwd(), winslash = "/", mustWork = FALSE)
    for (i in seq_len(8L)) {
      candidates <- c(
        candidates,
        file.path(cursor, "api", "inst", "plantillas", filename),
        file.path(cursor, "inst", "plantillas", filename)
      )
      parent <- dirname(cursor)
      if (identical(parent, cursor)) break
      cursor <- parent
    }
    hit <- candidates[file.exists(candidates)]
    if (length(hit)) candidate <- hit[[1]]
  }
  if (nzchar(candidate) && file.exists(candidate)) candidate else NA_character_
}

.graficos_resolve_graficador_name <- function(name, graficador_registry = .GRAFICADOR_REGISTRY) {
  raw <- as.character(name %||% "")
  raw <- if (length(raw)) raw[[1]] else ""
  if (is.na(raw) || !nzchar(raw)) return("")
  candidate <- unname(.GRAFICADOR_LEGACY_ALIASES[raw]) %||% raw
  if (candidate %in% graficador_registry) candidate else raw
}


# B43/G-22: plumber parsea el body con simplifyVector=TRUE y un plan que
# mezcla tipos de slide (poblacion_4 + 1_grafico) se RECTANGULARIZA: los
# payloads se vuelven data.frames anidados y los `vars` de multiapiladas
# llegan mangleados — la lamina salia en blanco solo en el export (el
# preview parsea el body crudo sin simplificar y por eso vivia). Este
# helper re-parsea el body crudo con simplifyVector=FALSE y devuelve las
# claves pedidas; si el body no es legible, cae a los args de plumber.
.graficos_body_sin_simplificar <- function(req, claves) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
  if (!nzchar(body_raw)) return(NULL)
  Encoding(body_raw) <- "UTF-8"
  parsed <- tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) NULL
  )
  if (!is.list(parsed)) return(NULL)
  parsed[intersect(claves, names(parsed))]
}

.normalize_plan <- function(plan, avisar = FALSE) {   # avisar: el plan lleva los avisos de su migración (graficos_migrar_poblacion.R)
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
  .graficos_migrar_poblacion_antigua(plan, avisar = avisar)   # la población antigua sale del plan en todo camino que normaliza
}

.as_json_list <- function(x) {
  if (is.null(x)) return(NULL)
  if (is.data.frame(x)) return(as.list(x))
  if (is.list(x)) return(x)
  as.list(x)
}

.graficos_normalize_rebuild_aliases <- function(args, fn) {
  args <- as.list(args %||% list())
  fmls <- names(formals(fn))
  aliases <- c(
    umbral_etiqueta = "umbral_etiqueta_pct",
    umbral_brecha = "umbral_brecha_pct"
  )
  for (legacy in names(aliases)) {
    canonical <- unname(aliases[[legacy]])
    # Sólo cambia el alias cuando el constructor declara el formal nuevo. Las
    # familias históricas conservan su `umbral_etiqueta` en escala 0-1.
    if (!(canonical %in% fmls) || !(legacy %in% names(args))) next
    if (!(canonical %in% names(args)) || .graficos_is_blank_json_value(args[[canonical]])) {
      args[[canonical]] <- args[[legacy]]
    }
    args[[legacy]] <- NULL
  }
  args
}

.clean_rebuild_args <- function(args, fn) {
  args <- .graficos_normalize_rebuild_aliases(args, fn)
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
    # Un PNG que falta NO puede costar el mazo entero.
    #
    # Hasta 2026-08-14 esto era un `stop()`, y una lámina de 67 dejaba al
    # usuario sin export: el proyecto de ACRD CONTA no podía regenerar su
    # propio informe porque el ícono se había subido en una sesión cuyo
    # tempdir ya no existía. El PNG vive en `s$dir/icons`, así que basta con
    # que la app se cierre entre la subida y el guardado para perderlo, y a
    # partir de ahí el `.pulso` arrastra una referencia rota para siempre.
    #
    # Reponerlo es imposible —el binario no está en ninguna parte— pero
    # renderizar el resto sí. La lámina sale sin ícono y el aviso dice cuál
    # falta, que es exactamente lo que el analista necesita para reponerlo.
    # Por su nombre del catálogo si se conoce; la referencia, nunca: es un id o una ruta temporal (graficos_avisos_texto.R).
    nombre <- .aviso_nombre_icono(ref, icon_registry)
    .pulso_aviso(.aviso_en_lamina(
      sprintf("su ícono%s ya no está en el catálogo de íconos y sale sin él. Vuelve a subirlo en Configuración global > Íconos si lo necesitas.", nombre),
      sin_contexto = sprintf("Un ícono%s elegido para una lámina ya no está en el catálogo de íconos y esa lámina sale sin él. Vuelve a subirlo en Configuración global > Íconos si lo necesitas.", nombre)
    ))
    return(NULL)
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
    # El constructor exige el argumento, así que hay que darle algo; lo que no
    # puede es costar el export. Se cae al ícono integrado, que no depende de
    # ningún archivo, y el aviso explica por qué esa lámina no lleva el suyo.
    #
    # El aviso de la UI decía «deja el campo en (ninguno) para exportar sin
    # ícono» mientras el motor abortaba justo en ese caso: los dos no podían
    # tener razón. Ahora la UI la tiene.
    .pulso_aviso(.aviso_en_lamina(
      "necesita un ícono y no había ninguno disponible: se usó el integrado. Elige un PNG en Configuración global > Íconos.",
      sin_contexto = sprintf("Una lámina «%s» necesita un ícono y no había ninguno disponible: se usó el integrado. Elige un PNG en Configuración global > Íconos.", .aviso_tipo_lamina(tipo))
    ))
    payload$icono <- tryCatch(
      p_ggplot_raw(.graficos_builtin_icon_plot("builtin:users")),
      error = function(e) NULL
    )
    if (is.null(payload$icono)) {
      stop(
        sprintf(
          "La lámina «%s» requiere un ícono. Elige un PNG en Configuración global > Íconos.",
          .aviso_tipo_lamina(tipo)
        ),
        call. = FALSE
      )
    }
  }

  payload
}

.graficos_icon_registry <- function(sid, cfg = NULL) {
  cfg <- cfg %||% .graficos_config_get(sid) %||% list()
  iconos <- cfg$iconos %||% list()
  out <- list()
  if (!is.list(iconos) || length(iconos) == 0L) return(out)

  nombres <- character(0)   # id -> nombre del catálogo, también de los que perdieron su PNG: el aviso los nombra así
  for (ico in iconos) {
    ico <- as.list(ico)
    id <- .graficos_icon_ref(ico$id %||% "")
    file_id <- .graficos_icon_ref(ico$file_id %||% "")
    nombre <- as.character(ico$nombre %||% "")[1]
    if (!is.na(nombre) && nzchar(nombre)) nombres[setdiff(c(id, file_id), "")] <- nombre
    path <- ""
    if (nzchar(file_id)) {
      meta <- tryCatch(get_file(sid, file_id), error = function(e) NULL)
      path <- .graficos_icon_ref(meta$path %||% "")
    }
    if (!nzchar(path)) path <- .graficos_icon_ref(ico$path %||% "")
    if (!nzchar(path) || !file.exists(path)) next
    if (nzchar(id)) out[[id]] <- path
    if (nzchar(file_id)) out[[file_id]] <- path
  }
  if (length(nombres)) attr(out, "nombres") <- nombres
  out
}

.graficos_rebuild_graf_json <- function(g, graficador_registry = .GRAFICADOR_REGISTRY) {
  g <- .as_json_list(g)
  if (is.null(g)) return(NULL)
  # NA = lamina borrador rectangularizada por jsonlite (nzchar(NA) es TRUE).
  graf_ref <- as.character(g$graficador %||% NA_character_)[1]
  if (is.na(graf_ref) || !nzchar(trimws(graf_ref))) return(NULL)
  graficador_name <- .graficos_resolve_graficador_name(g$graficador, graficador_registry)
  if (!(graficador_name %in% graficador_registry)) {
    stop(sprintf("Graficador no registrado: %s", g$graficador), call. = FALSE)
  }
  fn <- getExportedValue("prosecnurapp", graficador_name)
  args <- .graficos_unwrap_scalar_refs(g$args %||% list())
  args <- .graficos_drop_blank_optional_refs(args)
  if (.graficos_args_missing_required_ref(args, graficador_name)) {
    return(.graficos_blank_graph_element())
  }
  args <- .clean_rebuild_args(args, fn)
  if (.graficos_args_faltan_requeridos(fn, args)) return(.graficos_blank_graph_element())
  do.call(fn, args)
}

# B36/G-12: una lamina borrador (slot de grafico REQUERIDO sin graficador)
# exporta como canvas en blanco conservando su titulo, en vez de matar el
# deck entero con "argument grafico is missing". Solo rellena formals sin
# default: un slot opcional que quedo NULL conserva el default de la funcion.
.graficos_fill_blank_graf_slots <- function(payload, fn, grafs) {
  fmls <- formals(fn)
  for (slot_name in grafs) {
    if (!is.null(payload[[slot_name]])) next
    if (!(slot_name %in% names(fmls))) next
    # El formal sin default es el simbolo vacio: no se puede asignar ni tocar
    # sin disparar "argument missing"; se compara con quote(expr = ).
    requerido <- identical(fmls[[slot_name]], quote(expr = ))
    if (requerido) payload[[slot_name]] <- .graficos_blank_graph_element()
  }
  payload
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
  payload <- .graficos_payload_con_meta(payload)

  allowed_args <- names(formals(fn))
  payload <- payload[names(payload) %in% allowed_args]
  # Un payload serializado por el frontend puede traer claves con valor NULL
  # explicito (p.ej. "meta": null) para slots que nunca se tocaron. Pasarlas
  # tal cual a do.call() pisa el default del parametro (p.ej. meta = list())
  # y revienta las validaciones internas (.ppt_chk_meta). Se descartan aqui
  # para que el default de la funcion aplique, igual que ya se hace con los
  # args de graficos en .clean_rebuild_args().
  payload <- payload[!vapply(payload, function(v) {
    is.null(v) ||
      length(v) == 0L ||
      (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
      (length(v) == 1L && is.atomic(v) && is.na(v))
  }, logical(1))]
  payload <- .graficos_fill_blank_graf_slots(payload, fn, slide_registry[[tipo]]$grafs)
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

# Re-aplica el orden de categorías definido en Analítica sobre cada fuente de
# instrumento, por base. El config vive en `analitica_config_por_base[[base]]`
# (o en el `analitica_config` global para proyectos de base única); las keys de
# `inst_sources` son los mismos nombres de base. tryCatch defensivo aguas
# arriba: un mismatch de keys degrada a "sin reorden", nunca rompe el export.
.graficos_apply_orden_categorias_sources <- function(sid, src) {
  inst_sources <- src$inst_sources
  if (!is.list(inst_sources) || !length(inst_sources)) return(src)
  if (!exists(".orden_categorias_from_cfg", mode = "function")) return(src)
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(src)
  for (nm in names(inst_sources)) {
    # ADR 0061: la config de una base se resuelve con el mismo criterio que en
    # Analítica. Antes se caía a la global cuando la base no tenía entrada
    # propia, que es la misma fuga que el ADR corrige del lado de las etiquetas.
    cfg <- .analitica_cfg_para_base(sid, nm, s = s)
    # D8: las listas que Analítica declara ordinales deciden el orden «recetario» de cada gráfico (graficos_orden_categorias.R).
    inst_sources[[nm]]$listas_ordinales <- tryCatch(.orden_categorias_ordinal_set(inst_sources[[nm]], cfg), error = function(e) NULL)
    inst_sources[[nm]]$listas_nominales <- tryCatch({ o <- .orden_categorias_ordinales_from_cfg(cfg); names(o)[!o] }, error = function(e) NULL)
    orden_cfg <- .orden_categorias_from_cfg(cfg)
    if (!length(orden_cfg)) next
    inst <- .apply_orden_categorias(inst_sources[[nm]], orden_cfg)
    inst_sources[[nm]] <- inst

    # `reporte_data()` adjunta el instrumento ORIGINAL en
    # `attr(data, "instrumento_reporte")`, y ese attr manda sobre `inst` en los
    # consumidores que lo leen como fallback (`.analitica_order_sm_dummy_cols`,
    # los graficadores de dimensiones). Sin sincronizarlo, el override del
    # analista viviría solo en `inst_sources` y el orden volvería a divergir.
    # Mismo patrón que el review de Analítica (router_analitica.R).
    # Se sincroniza POR VARIABLE, no reemplazando el `orders_list` entero: si el
    # inst_source trae menos variables que el attr (o ninguna), un reemplazo
    # total borraría órdenes que el attr sí tenía.
    d <- src$data_sources[[nm]]
    if (is.data.frame(d) && length(inst$orders_list)) {
      ir <- attr(d, "instrumento_reporte", exact = TRUE)
      if (is.list(ir)) {
        ol <- ir$orders_list %||% list()
        for (var in names(inst$orders_list)) ol[[var]] <- inst$orders_list[[var]]
        ir$orders_list <- ol
        attr(d, "instrumento_reporte") <- ir
        src$data_sources[[nm]] <- d
      }
    }
  }
  src$inst_sources <- inst_sources
  src
}

# Etiquetas curadas por el analista en Analítica → Datos, aplicadas también aquí
# (ADR 0061). El PPT no pasa por `.analitica_apply_data_review`, así que sin este
# pase el selector de variables y los títulos de lámina mostraban el texto del
# XLSForm mientras las tablas de Analítica mostraban el editado — dos verdades
# para la misma variable en el mismo estudio.
#
# El caso que lo motiva: el importador de SurveyMonkey deja las tres baterías de
# una matriz con el MISMO label («Servicio de salud» en ¿Conoce?, ¿Ha utilizado?
# y satisfacción), así que sin la etiqueta curada el selector es ambiguo por
# construcción y elegir mal no da ninguna señal.
#
# Reusa `.analitica_apply_label_overrides()`: un solo cuerpo para los dos
# consumidores es lo que impide que vuelvan a divergir.
.graficos_apply_data_review_labels_sources <- function(sid, src) {
  inst_sources <- src$inst_sources
  if (!is.list(inst_sources) || !length(inst_sources)) return(src)
  if (!exists(".analitica_apply_label_overrides", mode = "function")) return(src)
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(src)

  for (nm in names(inst_sources)) {
    cfg <- .analitica_cfg_para_base(sid, nm, s = s)
    datos <- .analitica_datos_config(cfg)
    if (!length(datos$variable_labels) && !length(datos$value_labels)) next

    data <- src$data_sources[[nm]]
    if (!is.data.frame(data)) next

    aplicado <- tryCatch(
      .analitica_apply_label_overrides(data, inst_sources[[nm]], datos),
      error = function(e) NULL
    )
    if (is.null(aplicado)) next

    inst_sources[[nm]] <- aplicado$inst
    data <- aplicado$data

    # `reporte_data()` adjunta el instrumento ORIGINAL en
    # `attr(data, "instrumento_reporte")` y varios graficadores lo leen antes que
    # `inst`. Sin sincronizar `var_labels`, la etiqueta curada viviría sólo en
    # `inst_sources` y el título de la lámina volvería al texto del XLSForm.
    # Mismo motivo y mismo patrón que el pase de orden de categorías de arriba.
    ir <- attr(data, "instrumento_reporte", exact = TRUE)
    if (is.list(ir) && length(datos$variable_labels)) {
      vl <- ir$var_labels %||% character(0)
      for (var in names(datos$variable_labels)) {
        vl[var] <- as.character(datos$variable_labels[[var]])
      }
      ir$var_labels <- vl
      attr(data, "instrumento_reporte") <- ir
    }
    src$data_sources[[nm]] <- data
  }

  src$inst_sources <- inst_sources
  src
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

# Enriquece las fuentes compartidas por Gráficos/PPT/Word con el contrato repeat
# de Analítica. En una hija agrega caracterización de la madre, propaga pesos
# calculados a grano persona y deja el diseño de clustering en el data.frame.
# Para estudios sin repeat es un no-op salvo la ponderación analítica habitual.
.graficos_repeat_enrich_sources <- function(sid, src) {
  if (!is.list(src) || !is.list(src$data_sources) || !is.list(src$inst_sources)) {
    return(src)
  }

  enriched <- if (exists(".analitica_enrich_repeat_child_with_parent", mode = "function")) {
    tryCatch(
      .analitica_enrich_repeat_child_with_parent(
        sid, src$data_sources, src$inst_sources
      ),
      error = function(e) NULL
    )
  } else {
    NULL
  }
  if (is.list(enriched)) {
    src$data_sources <- enriched$data_sources %||% src$data_sources
    src$inst_sources <- enriched$inst_sources %||% src$inst_sources
  }

  if (!exists(".analitica_ponderacion_apply_sources", mode = "function")) return(src)
  s <- session_get(sid, required = FALSE)
  cfg <- if (exists(".analitica_config_get", mode = "function")) {
    tryCatch(.analitica_config_get(sid, s), error = function(e) NULL)
  } else {
    (s %||% list())$analitica_config
  }
  weighted <- tryCatch(
    .analitica_ponderacion_apply_sources(
      sid, src$data_sources, src$inst_sources, cfg %||% list()
    ),
    error = function(e) NULL
  )
  if (!is.list(weighted)) return(src)

  src$data_sources <- weighted$data_sources %||% src$data_sources
  src$inst_sources <- weighted$inst_sources %||% src$inst_sources
  designs <- weighted$repeat_design_by_base %||% list()
  for (nm in intersect(names(designs), names(src$data_sources))) {
    if (is.list(designs[[nm]]) && is.data.frame(src$data_sources[[nm]])) {
      attr(src$data_sources[[nm]], "repeat_design") <- designs[[nm]]
    }
  }
  src
}

# Un reporte de Gráficos es del ESTUDIO completo: para estudios multibase que NO
# son hermanos independientes (p. ej. madre + hijo repeat), TODAS las bases del
# estudio deben estar presentes. Analítica scopea `rp_data_sources` a la base de
# análisis (`.analitica_repair_project_context` deja solo la base hija repeat),
# así que las fuentes cacheadas pueden venir incompletas. Cuando falta una base
# del estudio, forzamos la reconstrucción (`.pulso_rebuild_estudio_runtime_sources`
# repuebla todas las bases desde sus archivos, conservando `current_code`).
.graficos_sources_cover_study_bases <- function(sid, data_sources) {
  s <- session_get(sid, required = FALSE)
  bases <- names((s$estudio %||% list())$bases %||% list())
  if (length(bases) <= 1L) return(TRUE)
  if (exists("estudio_is_independent_siblings", mode = "function") &&
      isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))) {
    return(TRUE)
  }
  all(bases %in% names(data_sources %||% list()))
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
    src <- .graficos_repeat_enrich_sources(sid, src)
    src <- normalize_sources(src)
    src <- .graficos_align_recoded_dummy_sources(src)
    if (exists(".graficos_add_virtual_koica_group_sources", mode = "function")) {
      src <- tryCatch(.graficos_add_virtual_koica_group_sources(sid, src), error = function(e) src)
    }
    # Etiquetas curadas en Analítica → Datos (ADR 0061). Va ANTES del orden de
    # categorías porque ese pase reescribe `orders_list$labels`: aplicar las
    # etiquetas después dejaría el orden con los textos viejos.
    src <- tryCatch(.graficos_apply_data_review_labels_sources(sid, src), error = function(e) src)
    # Orden de categorías definido en Analítica (por list_name): el PPT NO pasa
    # por .analitica_apply_data_review, así que se re-aplica aquí, por base, para
    # que tablas y PPT respeten la misma secuencia. Va después de normalize
    # (que re-fija los `names` al orden del instrumento).
    src <- tryCatch(.graficos_apply_orden_categorias_sources(sid, src), error = function(e) src)
    # Los dummies de select_multiple llegan de `reporte_data()` en el orden
    # arbitrario en que los generó la codificación. Se reordenan con el MISMO
    # helper que usa Analítica para que la variable se lea igual en la base
    # final, el libro de códigos, las frecuencias y el PPT del cliente. Va
    # después del override de orden de categorías, que es el que manda.
    src <- tryCatch(.graficos_order_sm_dummy_sources(src), error = function(e) src)
    # Última etapa: re-anclar current_code/current_label en bases hija repeat que
    # la fuente analítica/adaptada haya stripeado, para que la apertura por
    # servicio (filtros = list(current_code = ...)) no reviente el render.
    src <- tryCatch(.graficos_reanchor_repeat_service_cols(sid, src), error = function(e) src)
    src
  }

  sources <- .graficos_raw_processing_sources(sid)
  valid <- .graficos_filter_valid_sources(sources$data_sources, sources$inst_sources)
  if (.graficos_sources_usable(valid$data_sources, valid$inst_sources) &&
      .graficos_sources_cover_study_bases(sid, valid$data_sources)) {
    return(finalize_sources(valid))
  }

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
  # B48/G-23: la base activa tambien importa en modo `multibase` (no solo
  # independent_siblings): las refs peladas del plan guardado significan
  # "de la base activa" — la misma semantica que la UI usa en vivo. Sin
  # esto, el worker no podia calificarlas y el export moria con el
  # criptico "requiere prefijo fuente$".
  if (!exists("estudio_active_base", mode = "function")) return("")
  multibase <- length(tryCatch(estudio_data_sources(sid), error = function(e) list())) > 1L
  siblings <- exists("estudio_is_independent_siblings", mode = "function") &&
    estudio_is_independent_siblings(sid)
  if (siblings || multibase) {
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
  # Una ref "vacia" puede llegar con varias formas segun quien serializo:
  # "" o "   " (string), character(0), [] / {} de la UI (list()), NA de la
  # rectangularizacion de jsonlite, o una lista cuyos elementos son todos
  # vacios. Sin reconocerlas todas, el export muere criptico dentro de callr
  # con "`var` debe ser character(1) no vacio" (B36/G-15, informe conjunto
  # con un tema a medio armar).
  if (is.null(x)) return(FALSE)
  if (!length(x)) return(TRUE)
  if (is.list(x)) {
    return(all(vapply(x, function(v) {
      is.null(v) || .graficos_blank_ref_value(v) || (is.atomic(v) && all(is.na(v)))
    }, logical(1))))
  }
  # nzchar(NA_character_) es TRUE: sin el is.na() explicito, un NA de la
  # rectangularizacion pasaria como ref "con contenido".
  if (is.character(x)) return(all(is.na(x) | !nzchar(trimws(x))))
  if (is.atomic(x) && all(is.na(x))) return(TRUE)
  FALSE
}

.graficos_args_missing_required_ref <- function(args, graficador_name = NULL) {
  if (!is.list(args)) return(FALSE)
  # G2-L1: `cruces` sigue siendo opcional para los graficadores historicos,
  # pero puntos comparativos necesita las tres decisiones juntas. Un borrador
  # rectangularizado incompleto degrada a elemento vacio antes del constructor.
  if (identical(as.character(graficador_name %||% "")[[1]],
                "p_puntos_comparativos")) {
    for (arg_name in c("var", "cruces", "corte")) {
      if (is.null(args[[arg_name]]) ||
          .graficos_blank_ref_value(args[[arg_name]])) return(TRUE)
    }
  }
  # B49: la UI serializa `var: {}` vacio JUNTO a `vars`/`bloques` poblados
  # (multiapiladas por temas). Ese var vacio es ruido de serializacion, no
  # una ref requerida faltante — sin esta excepcion la lamina de comparar
  # publicos se degradaba a canvas en blanco.
  tiene_contenido <- function(x) {
    (is.list(x) && length(x) > 0L) ||
      (is.character(x) && any(nzchar(trimws(x))))
  }
  for (arg_name in c("var", "objetivo")) {
    if (!is.null(args[[arg_name]]) && .graficos_blank_ref_value(args[[arg_name]])) {
      if (identical(arg_name, "var") &&
          (tiene_contenido(args$vars) || tiene_contenido(args$bloques))) next
      return(TRUE)
    }
  }
  vars <- args$vars
  if (is.character(vars) && (!length(vars) || all(!nzchar(trimws(vars))))) return(TRUE)
  # `vars` presente pero vacio ([] de la UI) tambien es una ref faltante.
  if (is.list(vars) && !length(vars)) return(TRUE)
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

# B36/G-15: cuando un plan mezcla laminas borrador (var=[]) con laminas
# validas, la rectangularizacion de jsonlite convierte `var` en columna de
# lista y la lamina VALIDA llega como list("fuente$var") — que los spec
# constructors rechazan con "`var` debe ser character(1) no vacio". Se
# desenvuelven aqui las refs escalares conocidas; las listas legitimas
# (overrides, box_labels, ...) no se tocan.
.GRAFICOS_SCALAR_REF_ARGS <- c(
  "var", "cruce", "cruces", "iter_var", "objetivo", "var_texto", "grupo", "fila"
)

.graficos_unwrap_scalar_refs <- function(args) {
  if (!is.list(args)) return(args)
  for (arg_name in intersect(.GRAFICOS_SCALAR_REF_ARGS, names(args))) {
    v <- args[[arg_name]]
    if (is.list(v) && length(v) == 1L && is.atomic(v[[1]]) && length(v[[1]]) == 1L) {
      args[[arg_name]] <- v[[1]]
    }
  }
  args
}

# B36/G-15: si tras limpiar los args queda SIN VALOR un formal requerido del
# graficador (var de apiladas/agrupadas, tipicamente porque el slide del
# informe conjunto esta a medio armar), degradamos a canvas en blanco en vez
# de dejar que callr muera con "argument var is missing". `...` se excluye.
.graficos_args_faltan_requeridos <- function(fn, args) {
  fmls <- formals(fn)
  fmls <- fmls[setdiff(names(fmls), "...")]
  requeridos <- names(fmls)[vapply(fmls, function(f) identical(f, quote(expr = )), logical(1))]
  length(setdiff(requeridos, names(args))) > 0L
}

.graficos_blank_graph_element <- function() {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("Se requiere el paquete 'ggplot2' para crear placeholders de graficos vacios.", call. = FALSE)
  }
  p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void())
}

.rebuild_graf <- function(g) {
  if (is.null(g)) return(NULL)
  # NA cuenta como "sin graficador": una lamina borrador (grafico vacio) que
  # jsonlite rectangulariza llega como graficador = NA, y nzchar(NA) es TRUE
  # — sin este guard el export moria con "Graficador no registrado: NA"
  # (B36/G-12 con el plan real del usuario).
  graf_ref <- as.character(g$graficador %||% NA_character_)[1]
  if (is.na(graf_ref) || !nzchar(trimws(graf_ref))) return(NULL)
  graficador_name <- .graficos_resolve_graficador_name(g$graficador)
  if (!(graficador_name %in% .GRAFICADOR_REGISTRY)) {
    stop_api(400, "E_UNKNOWN_GRAF", sprintf("Graficador no registrado: %s", g$graficador))
  }
  fn <- getExportedValue("prosecnurapp", graficador_name)
  args <- .graficos_unwrap_scalar_refs(g$args %||% list())
  args <- .graficos_drop_blank_optional_refs(args)
  if (.graficos_args_missing_required_ref(args, graficador_name)) {
    return(.graficos_blank_graph_element())
  }
  args <- .clean_rebuild_args(args, fn)
  if (.graficos_args_faltan_requeridos(fn, args)) return(.graficos_blank_graph_element())
  do.call(fn, args)
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
  payload <- .graficos_payload_con_meta(payload)
  allowed_args <- names(formals(fn))
  payload <- payload[names(payload) %in% allowed_args]
  payload <- payload[!vapply(payload, function(v) {
    is.null(v) ||
      length(v) == 0L ||
      (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
      (length(v) == 1L && is.atomic(v) && is.na(v))
  }, logical(1))]
  do.call(fn, payload)
}

.build_presets <- function(presets_json) {
  if (is.null(presets_json) || length(presets_json) == 0) return(NULL)
  # ADR 0074. Aqui, y no en el getter: el bag guardado trae solo decisiones y
  # este es el embudo por el que TODOS los caminos convierten una config en
  # presets —el router, el job de export y el arnes de render, que lee la sesion
  # directamente sin pasar por `.graficos_config_get()`. Poner el reverso solo
  # en el getter dejaba fuera justo el camino que dibuja el mazo: medido, los
  # titulos de bloque de la lamina 66 salian planos.
  presets_json <- .graficos_presets_con_defaults(presets_json)
  args <- lapply(presets_json, as.list)
  supported <- setdiff(names(formals(p_presets)), "...")
  extension_keys <- intersect(
    setdiff(names(args), supported),
    c("barras_divergentes", "puntos_comparativos", "dumbbell", "lollipop", "serie_temporal")
  )
  unknown <- setdiff(names(args), c(supported, extension_keys))
  if (length(unknown)) {
    warning(
      "Se ignoraron presets no soportados: ",
      paste(unknown, collapse = ", "),
      call. = FALSE
    )
  }

  out <- do.call(p_presets, args[intersect(names(args), supported)])
  for (key in extension_keys) {
    block <- args[[key]]
    if (!is.list(block)) .plan_input_abort("Cada preset debe ser una lista.")
    if (!is.null(block$args)) {
      if (!is.list(block$args)) .plan_input_abort("`args` debe ser una lista.")
      out[[key]] <- block
    } else {
      out[[key]] <- list(args = block)
    }
  }
  out
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
  if (length(slides) == 0) errs <- c(errs, "El plan no tiene láminas.")
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    tipo <- as.character(s$tipo %||% "")
    tag <- .aviso_lamina(i, .aviso_titulo_payload(s))   # «Lámina 3 · “Título”», sin ids ni tipos internos
    if (!nzchar(tipo)) { errs <- c(errs, sprintf("%s: no tiene tipo de lámina; elige uno en el editor", tag)); next }
    if (!(tipo %in% names(.SLIDE_REGISTRY))) {
      errs <- c(errs, sprintf("%s: es de %s; elige otro tipo en el editor", tag, .aviso_tipo_lamina(tipo))); next
    }
    payload <- .as_json_list(s$payload) %||% list()
    graf_slots <- .SLIDE_REGISTRY[[tipo]]$grafs

    # Coherencia entre los paneles de una misma lamina: variable repetida, base
    # ajena o panel sin rotulo. Ver `graficos_plan_avisos_lamina.R`.
    slots_lamina <- stats::setNames(
      lapply(graf_slots, function(nm) .as_json_list(payload[[nm]])),
      graf_slots
    )
    warns <- c(warns, .plan_avisos_lamina(slots_lamina, tag, tipo))

    for (slot_name in graf_slots) {
      slot <- .as_json_list(payload[[slot_name]])
      espacio <- .aviso_espacio(tipo, slot_name)
      warns <- c(warns, .graficos_orden_cat_avisos_slot(slot, sprintf("%s (%s)", tag, espacio)))   # D8
      graf_name <- as.character(slot$graficador %||% "")
      if (!nzchar(graf_name)) {
        warns <- c(warns, sprintf("%s: el espacio «%s» está sin gráfico", tag, espacio))
      } else if (!(graf_name %in% .GRAFICADOR_REGISTRY)) {
        resolved_graf_name <- .graficos_resolve_graficador_name(graf_name)
        if (!(resolved_graf_name %in% .GRAFICADOR_REGISTRY)) {
          errs <- c(errs, sprintf("%s: el espacio «%s» usa %s; elige otro en el editor", tag, espacio, .aviso_tipo_grafico(graf_name)))
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
    debug_ph = list(activo = FALSE, color = .GUIA_COL, lwd = .GUIA_LWD),
    view_mode = "timeline",
    inspector_tab = "content",
    density = "comfortable",
    canvas_viewport = list(x = 0, y = 0, zoom = 1),
    profile_id = "",
    template_id = "",
    # B42/G-18: opt-in universal. Va en los defaults para que el GET de config
    # SIEMPRE traiga la clave — si no, el front no puede distinguir "apagada"
    # de "el backend no sabe de esto" y el interruptor arranca indefinido.
    auto_otros_slides = FALSE,
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

.graficos_config_has_slides <- function(cfg) {
  is.list(cfg) &&
    is.list(cfg$plan) &&
    is.list(cfg$plan$slides) &&
    length(cfg$plan$slides) > 0L
}

.graficos_independent_template_base <- function(s) {
  base <- (((s$estudio %||% list())$independent_siblings %||% list())$template_base %||% "")
  base <- as.character(base %||% "")[1]
  if (!length(base) || is.na(base)) "" else base
}

.graficos_config_inherit_candidate <- function(s, active = "") {
  configs <- s$graficos_config_por_base
  if (is.null(configs) || !is.list(configs) || !length(configs)) return(NULL)

  active <- as.character(active %||% "")[1]
  template_base <- .graficos_independent_template_base(s)
  if (nzchar(template_base) &&
      !identical(template_base, active) &&
      .graficos_config_has_slides(configs[[template_base]])) {
    return(configs[[template_base]])
  }

  candidates <- names(configs)[vapply(configs, .graficos_config_has_slides, logical(1))]
  candidates <- setdiff(candidates, active)
  if (length(candidates) != 1L) return(NULL)
  configs[[candidates[[1]]]]
}

.graficos_config_get <- function(sid, s = NULL) {
  # Tambien al LEER, y no solo al guardar: un `.pulso` anterior al ADR 0074 trae
  # su bag entero —253 valores medidos, 218 de ellos el default congelado— y
  # merece el mismo trato sin obligar a una migracion. El primer guardado ya lo
  # deja limpio en disco.
  # ADR 0074. En DISCO el bag guarda solo decisiones; en MEMORIA hacen falta los
  # valores completos, porque `.graficos_default_config()` copia el default
  # dentro del proyecto y el motor lee los presets de ahi, sin ningun merge mas
  # abajo. Se normaliza en dos pasos —quitar lo que coincide, reponer el
  # default— para que un `.pulso` anterior a esto reciba el mismo trato sin
  # migracion y para que el resultado no dependa de con que version se guardo.
  limpio <- function(cfg) {
    if (is.list(cfg) && !is.null(cfg$presets)) {
      cfg$presets <- .graficos_presets_solo_decisiones(cfg$presets)
    }
    cfg
  }
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(.graficos_default_config(sid))
  active <- .graficos_scoped_base(sid)
  if (nzchar(active)) {
    configs <- s$graficos_config_por_base
    if (is.list(configs) && !is.null(configs[[active]])) {
      return(limpio(configs[[active]]))
    }
    # Migracion conservadora: una config global legacy se asigna solo a
    # la base activa inicial. Las demas bases independientes arrancan con
    # default para no heredar portadas o planes ajenos.
    if ((is.null(configs) || length(configs) == 0L) && !is.null(s$graficos_config)) {
      configs <- list()
      configs[[active]] <- s$graficos_config
      session_set(sid, "graficos_config_por_base", configs)
      return(limpio(s$graficos_config))
    }
    inherited <- .graficos_config_inherit_candidate(s, active)
    if (!is.null(inherited)) return(limpio(inherited))
    return(.graficos_default_config(sid))
  }
  limpio(s$graficos_config %||% .graficos_default_config(sid))
}

.graficos_config_get_for_base <- function(sid, base_name, s = NULL) {
  s <- s %||% session_get(sid, required = FALSE)
  if (is.null(s)) return(.graficos_default_config(sid))
  active <- as.character(base_name %||% "")[1]
  if (is.na(active) || !nzchar(active)) return(s$graficos_config %||% .graficos_default_config(sid))
  configs <- s$graficos_config_por_base
  if (is.list(configs) && !is.null(configs[[active]])) {
    return(configs[[active]])
  }
  if ((is.null(configs) || length(configs) == 0L) && !is.null(s$graficos_config)) {
    return(s$graficos_config)
  }
  inherited <- .graficos_config_inherit_candidate(s, active)
  if (!is.null(inherited)) return(inherited)
  .graficos_default_config(sid)
}

.graficos_effective_config_for_base <- function(sid, base_name, s = NULL) {
  cfg <- .graficos_config_get_for_base(sid, base_name, s = s)
  .graficos_normalize_config(cfg, sid = sid)
}

.graficos_config_set <- function(sid, cfg) {
  # ADR 0074: el proyecto guarda decisiones, no defaults. Lo que coincide con el
  # default de fabrica no se guarda, y asi «presencia = decision» se sostiene.
  if (is.list(cfg) && !is.null(cfg$presets)) {
    cfg$presets <- .graficos_presets_solo_decisiones(cfg$presets)
  }
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
  # ADR 0093: el coral de fábrica del extremo negativo migra al salmón del recetario.
  .std_migrar_paletas(out)$paletas
}

.graficos_unknown_fields <- function(x) {
  known <- c(
    "ok", "version", "exported_at", "exportedAt", "imported_at", "importedAt",
    "config", "plan", "presets", "w_presets", "wPresets",
    "selected_slide_id", "selectedSlideId", "paletas", "iconos",
    "overrides_reusables", "overridesReusables", "debug_ph", "debugPh",
    "view_mode", "viewMode", "inspector_tab", "inspectorTab", "density",
    "canvas_viewport", "canvasViewport", "scope_rules", "scopeRules",
    "profile_id", "profileId", "template_id", "templateId",
    "auto_otros_slides", "autoOtrosSlides",
    "documento_word", "documentoWord",
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

# B38/G-16: la UI de Base PPT guarda TODOS los args del preset (46 en un
# proyecto real), asi que un default viejo queda FOSILIZADO en la config y
# pisa cualquier mejora del motor — el usuario "no ve" los fixes. Esta tabla
# migra solo valores que coinciden EXACTO con el default viejo (nadie eligio
# 22 a mano: era el valor que la UI copiaba sola); un valor distinto es
# decision del analista y se respeta. Se aplica en el normalizador, la unica
# costura por la que pasan el GET de config y el config efectivo del export.
.GRAFICOS_MIGRACIONES_DEFAULTS <- list(
  list(tipo = "barras_apiladas", arg = "ancho_max_eje_y", de = 22, a = 34)
  # B45 (la cifra chica arriba como opt-in) se retiro con el ADR 0092 (F2.3):
  # el recetario sube las cifras chicas con guia y `estandar_presets.R` lo
  # impone; migrar TRUE a FALSE aqui lo desharia en cada normalizacion.
)

.graficos_migrar_defaults_fosiles <- function(presets) {
  if (!.graficos_is_obj(presets)) return(presets)
  for (mig in .GRAFICOS_MIGRACIONES_DEFAULTS) {
    entry <- presets[[mig$tipo]]
    if (!.graficos_is_obj(entry)) next
    holder <- if (.graficos_is_obj(entry$args)) entry$args else entry
    valor <- holder[[mig$arg]]
    coincide <- if (is.logical(mig$de)) {
      isTRUE(valor) == isTRUE(mig$de) && is.logical(valor %||% NA)
    } else {
      actual <- suppressWarnings(as.numeric(valor %||% NA_real_)[1])
      is.finite(actual) && identical(actual, as.numeric(mig$de))
    }
    if (coincide) {
      holder[[mig$arg]] <- mig$a
      if (.graficos_is_obj(entry$args)) {
        entry$args <- holder
      } else {
        entry <- holder
      }
      presets[[mig$tipo]] <- entry
    }
  }
  # ADR 0092: las claves que fija el estándar se imponen sobre lo guardado.
  .std_imponer_base(presets)
}

.graficos_normalize_config <- function(input, sid = NULL, include_legacy_aliases = FALSE) {
  defaults <- .graficos_default_config(sid)
  envelope <- if (.graficos_is_obj(input)) input else list()
  src <- if (.graficos_is_obj(envelope$config)) envelope$config else envelope

  cfg <- defaults
  cfg$version <- "graficos/4"

  plan <- .graficos_pick_alias(src, "plan")
  cfg$plan <- if (.graficos_is_obj(plan) && is.list(plan$slides)) .graficos_migrar_poblacion_antigua(plan, avisar = FALSE) else defaults$plan

  presets <- .graficos_pick_alias(src, "presets")
  cfg$presets <- if (.graficos_is_obj(presets)) {
    .graficos_migrar_defaults_fosiles(presets)
  } else {
    defaults$presets
  }

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

  profile_id <- .graficos_pick_alias(src, "profile_id", "profileId")
  cfg$profile_id <- if (is.character(profile_id) && length(profile_id) == 1L) profile_id else defaults$profile_id
  template_id <- .graficos_pick_alias(src, "template_id", "templateId")
  cfg$template_id <- if (is.character(template_id) && length(template_id) == 1L) template_id else defaults$template_id
  auto_otros_slides <- .graficos_pick_alias(src, "auto_otros_slides", "autoOtrosSlides")
  cfg$auto_otros_slides <- if (is.logical(auto_otros_slides) && length(auto_otros_slides) == 1L && !is.na(auto_otros_slides)) {
    auto_otros_slides
  } else {
    defaults$auto_otros_slides
  }

  # Opciones del documento Word del recetario (F6.0b.4): se validan al exportar (.graficos_opciones_documento).
  documento_word <- .graficos_pick_alias(src, "documento_word", "documentoWord")
  if (.graficos_is_obj(documento_word)) cfg$documento_word <- documento_word

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

  fuente_nombres <- names(inst_sources)
  if (is.null(fuente_nombres)) fuente_nombres <- rep("", length(inst_sources))

  for (inst_idx in seq_along(inst_sources)) {
    inst <- inst_sources[[inst_idx]]
    fuente_nm <- trimws(as.character(fuente_nombres[inst_idx] %||% ""))
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

      codigos <- trimws(as.character(rows$name %||% ""))
      etiquetas <- if (!is.na(label_col) && label_col %in% names(rows)) {
        trimws(as.character(rows[[label_col]]))
      } else {
        codigos
      }
      etiquetas[is.na(etiquetas) | !nzchar(etiquetas)] <- codigos[is.na(etiquetas) | !nzchar(etiquetas)]

      # Un `list_name` NO identifica una escala en un proyecto multibase: cada
      # instrumento numera sus propias preguntas, asi que `lst_p6` es Si/No en
      # docentes y la lista de grados en egresados. Agrupar por nombre fusionaba
      # las dos en una entrada de 17 opciones que no existe en ninguna base
      # —medido en «Conta 09-08»: 22 de 43 listas colisionan— y el editor pedia
      # colorear una escala inventada.
      #
      # La identidad aqui es (nombre, ETIQUETAS normalizadas), no la firma
      # completa de `.escala_firma()`: una paleta mapea etiqueta -> color, asi
      # que dos listas con las mismas etiquetas y distinto codigo se colorean
      # igual y separarlas solo duplicaria tarjetas identicas. El codigo si
      # importa para comparar mediciones —por eso la firma de equivalencias lo
      # conserva— pero no para elegir un color.
      slot <- paste(ln, paste(.escala_etiqueta_normalizada(etiquetas), collapse = "|"), sep = "\r")

      if (is.null(out[[slot]])) {
        # `escala_id` desambigua para la UI (clave de React y seleccion activa);
        # `list_name` sigue siendo la clave de guardado, y como las escalas que
        # colisionan tienen etiquetas disjuntas conviven en el mismo mapa
        # etiqueta -> color sin pisarse. Asi no hay migracion de `.pulso`.
        homonimas <- sum(vapply(out, function(x) identical(x$list_name, ln), logical(1)))
        out[[slot]] <- list(
          list_name = ln,
          escala_id = if (homonimas) paste0(ln, "#", homonimas + 1L) else ln,
          choices = list(), .seen = character(0), fuentes = character(0)
        )
        order <- c(order, slot)
      }
      # B38/G-6: en un proyecto multibase la UI necesita saber en que bases
      # vive cada lista para hablar en terminos del informe (no solo de la
      # base activa).
      if (nzchar(fuente_nm) && !(fuente_nm %in% out[[slot]]$fuentes)) {
        out[[slot]]$fuentes <- c(out[[slot]]$fuentes, fuente_nm)
      }
      for (i in seq_along(codigos)) {
        key <- paste(codigos[i], etiquetas[i], sep = "\r")
        if (key %in% out[[slot]]$.seen) next
        out[[slot]]$choices[[length(out[[slot]]$choices) + 1L]] <-
          list(name = codigos[i], label = etiquetas[i])
        out[[slot]]$.seen <- c(out[[slot]]$.seen, key)
      }
    }
  }

  lapply(order, function(slot) {
    x <- out[[slot]]
    x$.seen <- NULL
    # I() evita que jsonlite des-encaje un vector de 1 fuente a escalar:
    # el contrato con la UI es "array siempre".
    x$fuentes <- I(as.character(x$fuentes %||% character(0)))
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

  # G-16: los presets del body llegan directo de la UI (sin pasar por el
  # normalizador de config), asi que la migracion de defaults fosiles
  # tambien tiene que correr aqui — es la costura comun de ppt/word/ppt-all.
  # El aviso sale aquí, en la costura del render, y no en el GET de la config.
  presets_json <- .graficos_migrar_defaults_fosiles(.std_imponer_base(presets_json, avisar = TRUE))

  # 0) Suelo editorial: cada tipo hereda `.PRESETS_DEFAULT_PULSO` y el proyecto
  # escribe encima.
  #
  # Antes esos defaults sólo se aplicaban al CREAR la config, así que a la hora
  # de renderizar una clave ausente caía al default de la firma del graficador
  # —y la casa opina distinto del motor en 56 de 136 claves comparables, siete
  # de ellas interruptores visibles (leyenda de agrupadas, frecuencia de
  # categóricas, eje Y de numéricas…)—. El resultado era que quién ganaba
  # dependía de un accidente: un preset parcial, o el botón «Valor por defecto»
  # —que borra el preset entero— devolvían el criterio del motor, no el de
  # Pulso. Con el suelo aquí la precedencia es una sola y siempre la misma:
  # motor → Pulso → proyecto → slide.
  # `base` queda fuera a propósito: no es un graficador con su propia firma
  # —lo heredan todos— y sus tamaños se derivan entre sí (`size_titulo_seccion`
  # sale de `size_titulo_slide`). Ahí "no configurado" es un estado con
  # significado y el motor tiene que poder distinguirlo.
  #
  # Y el suelo se descuenta de lo que el proyecto declaró en `base`: el motor
  # hereda `base$args` hacia cada tipo, así que rellenar el tipo con las ~40
  # claves de fábrica dejaría sin efecto el estilo común del analista en las
  # que se solapan (`size_leyenda`, `size_subtitulo`, `size_titulo`,
  # `size_texto_barras`). La jerarquía tiene que quedar en este orden:
  # motor → Pulso → base del proyecto → tipo del proyecto → override del slide.
  claves_base_proyecto <- names(presets_json$base %||% list())
  for (tipo in setdiff(names(.PRESETS_DEFAULT_PULSO), "base")) {
    suelo <- .PRESETS_DEFAULT_PULSO[[tipo]]
    if (!is.list(suelo)) next
    suelo <- suelo[setdiff(names(suelo), claves_base_proyecto)]
    guardado <- presets_json[[tipo]]
    presets_json[[tipo]] <- if (is.list(guardado) && length(guardado)) {
      utils::modifyList(suelo, guardado)
    } else {
      suelo
    }
  }

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
  #
  # Va a `base` Y a `base$args`. El motor hereda hacia los graficadores desde
  # `base$args`, así que escribirlo sólo en `base` —como se hacía— dejaba la
  # bandera en un sitio que nadie lee: encender la guía desde la config del
  # proyecto no dibujaba ni una cota. `base` se conserva porque es donde la
  # busca la UI.
  if (is.null(presets_json$base)) presets_json$base <- list()
  if (!is.list(presets_json$base$args)) presets_json$base$args <- list()
  .debug_ph_set <- function(presets_json, clave, valor) {
    presets_json$base[[clave]] <- valor
    presets_json$base$args[[clave]] <- valor
    presets_json
  }
  if (is.list(debug_ph) && isTRUE(debug_ph$activo)) {
    presets_json <- .debug_ph_set(presets_json, "debug_ph_bordes", TRUE)
    if (!is.null(debug_ph$color) && nzchar(as.character(debug_ph$color))) {
      presets_json <- .debug_ph_set(presets_json, "debug_ph_col", as.character(debug_ph$color))
    }
    if (!is.null(debug_ph$lwd) && is.finite(suppressWarnings(as.numeric(debug_ph$lwd)))) {
      presets_json <- .debug_ph_set(presets_json, "debug_ph_lwd", as.numeric(debug_ph$lwd))
    }
  } else {
    # Si no está activo, forzar FALSE por si el analista había dejado
    # debug_ph_bordes=TRUE en algún preset legacy.
    presets_json <- .debug_ph_set(presets_json, "debug_ph_bordes", FALSE)
  }

  # 3) Titulo de seccion: los divisores por seccion se leen mejor con un titulo
  # mas grande y en negrita que el titulo de slide. Rellenamos solo los estilos
  # de seccion ausentes (un valor explicito del perfil o del analista siempre
  # manda) para que los divisores luzcan intencionales aun cuando la config
  # guardada del proyecto predate los estilos de seccion del perfil.
  # La regla vive en .ppt_section_title_size() (reporte_plan_helpers.R), que es
  # la misma que aplica el motor: si se duplicara aqui, un export por router y
  # otro directo (preview, Word) volverian a dar tamanos distintos.
  if (is.null(presets_json$base$size_titulo_seccion)) {
    derived <- .ppt_section_title_size(size_slide = presets_json$base$size_titulo_slide)
    if (is.finite(derived)) presets_json$base$size_titulo_seccion <- derived
  }
  if (is.null(presets_json$base$bold_titulo_seccion)) {
    presets_json$base$bold_titulo_seccion <- TRUE
  }
  # Color del titulo de seccion: si el perfil/analista no lo fijo, usamos el
  # color de subtitulo (secundario de marca, ej. azul/navy institucional) para
  # que el divisor tenga un acento cromatico coherente con la identidad en vez
  # de repetir el color del cuerpo. Si tampoco hay subtitulo, cae al color de
  # titulo por el fallback del estilizador.
  # `color_titulo_slide` manda sobre esta herencia. Existe justamente para
  # gobernar lámina, separadores y portada; si el analista lo declaró, heredar
  # del subtítulo le pintaba los separadores de otro color que el resto de los
  # títulos y no había forma de alinearlos.
  if (is.null(presets_json$base$color_titulo_seccion) &&
      is.null(presets_json$base$color_titulo_slide) &&
      !is.null(presets_json$base$color_subtitulo) &&
      nzchar(trimws(as.character(presets_json$base$color_subtitulo)[1]))) {
    presets_json$base$color_titulo_seccion <- as.character(presets_json$base$color_subtitulo)[1]
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

.graficos_preview_bool_option <- function(parsed, name, default) {
  value <- parsed[[name]] %||% default
  if (!is.logical(value) || length(value) != 1L) {
    stop(sprintf("%s debe ser booleano.", name), call. = FALSE)
  }
  value
}

# Body de /preview-slide (y de /preview-slide-job), sin simplificar: jsonlite no rectangulariza la lámina.
.graficos_preview_leer_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
  if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
  Encoding(body_raw) <- "UTF-8"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
  )
}

# Lámina y opciones de la vista previa, validadas (mismos códigos E_* de siempre).
.graficos_preview_opciones <- function(parsed) {
  slide <- parsed$slide
  if (is.null(slide)) stop_api(400, "E_NO_SLIDE", "Body debe incluir 'slide'.")
  preview_quality <- tolower(as.character(parsed$preview_quality %||% "quick"))
  if (!preview_quality %in% c("quick", "normal")) {
    stop_api(400, "E_BAD_PREVIEW_QUALITY", "preview_quality debe ser 'quick' o 'normal'.")
  }
  opcion <- function(nombre, default, codigo) {
    tryCatch(.graficos_preview_bool_option(parsed, nombre, default), error = function(e) stop_api(400, codigo, conditionMessage(e)))
  }
  opts <- list(
    preview_quality = preview_quality,
    include_images = opcion("include_images", TRUE, "E_BAD_INCLUDE_IMAGES"),
    render_slide_preview = opcion("render_slide_preview", FALSE, "E_BAD_RENDER_SLIDE_PREVIEW"),
    # Todas las partes «(cont.)» sólo si el cliente las pide: con el renderer de artefactos cada parte cuesta ~10 s.
    preview_partes = opcion("preview_partes", FALSE, "E_BAD_PREVIEW_PARTES"),
    # K11: las formas de cada parte y las ranuras del estándar, para las guías del visor (graficos_preview_formas.R).
    preview_formas = opcion("preview_formas", FALSE, "E_BAD_PREVIEW_FORMAS")
  )
  tipo <- as.character(slide$tipo %||% "")
  if (!nzchar(tipo) || !(tipo %in% .slide_names())) {
    stop_api(400, "E_BAD_SLIDE", sprintf("Tipo de slide inválido: '%s'", tipo))
  }
  opts
}

.graficos_slide_layout_scope <- function(value = NULL) {
  value <- as.character(value %||% "")[1]
  if (is.na(value) || !nzchar(trimws(value))) return("active")
  value <- trimws(value)
  if (!value %in% c("active", "consolidated")) {
    stop_api(
      400,
      "E_BAD_SLIDE_LAYOUT_SCOPE",
      "scope debe ser 'active' o 'consolidated'."
    )
  }
  value
}

.graficos_slide_layout_query_id <- function(query, snake_case, camel_case) {
  for (key in c(snake_case, camel_case)) {
    value <- as.character(query[[key]] %||% "")[1]
    if (!is.na(value) && nzchar(trimws(value))) return(trimws(value))
  }
  ""
}

.graficos_slide_layout_effective_context <- function(req, scope = NULL) {
  scope <- .graficos_slide_layout_scope(scope)
  sid <- session_header(req)
  if (is.null(sid) || !nzchar(as.character(sid)[1])) {
    return(list(scope = scope, config = NULL, presets = p_presets()))
  }
  cfg <- if (identical(scope, "consolidated")) {
    graficos_consolidado_draft_get(sid)$config
  } else {
    .graficos_effective_config(sid)
  }
  if (is.null(cfg) || !is.list(cfg)) {
    return(list(scope = scope, config = NULL, presets = p_presets()))
  }
  enriched <- .enriquecer_presets(cfg$presets %||% list(), cfg$debug_ph %||% NULL)
  list(
    scope = scope,
    config = cfg,
    presets = .build_presets(enriched) %||% p_presets()
  )
}

.graficos_slide_layout_preview <- function(tipo, config = NULL, profile_id = NULL,
                                            template_id = NULL, presets = NULL,
                                            master = NULL) {
  .graficos_slide_layout_preview_v1(
    tipo = tipo,
    config = config,
    profile_id = profile_id,
    template_id = template_id,
    presets = presets,
    master = master
  )
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

.preview_renderer_roots <- function() {
  app_root <- Sys.getenv("PULSO_APP_ROOT", unset = "")
  explicit_root <- Sys.getenv("PROSECNUR_PREVIEW_RENDERER_DIR", unset = "")
  cwd <- tryCatch(getwd(), error = function(e) "")
  parent_cwd <- if (nzchar(cwd)) dirname(cwd) else ""

  unique(c(
    explicit_root,
    if (nzchar(app_root)) file.path(app_root, "preview-renderer") else "",
    if (nzchar(app_root)) file.path(dirname(app_root), "runtime", "preview-renderer") else "",
    if (nzchar(cwd)) file.path(cwd, "preview-renderer") else "",
    if (nzchar(parent_cwd)) file.path(parent_cwd, "runtime", "preview-renderer") else "",
    if (nzchar(parent_cwd)) file.path(parent_cwd, "preview-renderer") else ""
  ))
}

.bundled_soffice_candidates <- function() {
  roots <- .preview_renderer_roots()
  roots <- roots[nzchar(roots)]
  if (!length(roots)) return(character())

  common <- c(
    file.path(roots, "soffice"),
    file.path(roots, "program", "soffice")
  )
  platform <- switch(
    Sys.info()[["sysname"]] %||% "",
    "Darwin" = c(
      file.path(roots, "LibreOffice.app", "Contents", "MacOS", "soffice"),
      file.path(roots, "LibreOffice", "LibreOffice.app", "Contents", "MacOS", "soffice")
    ),
    "Windows" = c(
      file.path(roots, "soffice.exe"),
      file.path(roots, "program", "soffice.exe"),
      file.path(roots, "LibreOffice", "program", "soffice.exe"),
      file.path(roots, "libreoffice", "program", "soffice.exe")
    ),
    c(
      file.path(roots, "libreoffice", "program", "soffice"),
      file.path(roots, "libreoffice", "soffice")
    )
  )
  unique(c(common, platform))
}

.soffice_cmd <- function() {
  env_candidates <- unname(Sys.getenv(
    c("PROSECNUR_BUNDLED_SOFFICE", "PROSECNUR_SOFFICE", "SOFFICE_PATH", "LIBREOFFICE_PATH"),
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

  .first_available_executable(c(env_candidates, .bundled_soffice_candidates(), "soffice", "libreoffice", platform_candidates))
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
  # soffice sólo convierte a PDF: sin quien pase el PDF a PNG la vista previa sale vacía (plan de empaquetado, P3).
  rasterizer <- .preview_rasterizer_status()
  soffice_usable <- soffice_available && isTRUE(rasterizer$available)

  renderer <- if (artifact_available && .preview_usar_artifact()) {
    "artifact-tool"
  } else if (soffice_usable) {
    "soffice"
  } else if (artifact_available) {
    "artifact-tool"
  } else {
    NA_character_
  }

  list(
    available = isTRUE(artifact_available || soffice_usable),
    rasterizer = rasterizer$id,
    renderer = renderer,
    platform = Sys.info()[["sysname"]] %||% NA_character_,
    desktop_automation = FALSE,
    message = if (artifact_available || soffice_usable) {
      "Renderer headless disponible para preview inline."
    } else if (soffice_available) {
      "Se encontró LibreOffice, pero falta el rasterizador de PDF (pdftools o pdftoppm): la vista previa saldría vacía."
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

  # pdftools (poppler estático en sus binarios de CRAN) rasteriza dentro del proceso y viaja en el instalador;
  # pdftoppm queda como respaldo de desarrollo (plan de empaquetado, P2; graficos_preview_lamina.R).
  png_pdftools <- .pdf_page_to_png_pdftools(pdf_path, out_dir, page = page, dpi = dpi)
  if (!is.null(png_pdftools)) return(.png_preview_payload(png_pdftools, paste0(renderer, "+pdftools")))

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
          .preview_arg(pdf_path),
          .preview_arg(prefix)
        ),
        stdout = TRUE,
        stderr = TRUE,
        timeout = timeout
      )
      file.exists(png_path)
    }, error = function(e) FALSE)
    if (isTRUE(ok)) return(.png_preview_payload(png_path, paste0(renderer, "+pdftoppm")))
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
    .preview_arg(script),
    "--pptx", .preview_arg(pptx_path),
    "--output", .preview_arg(png_path),
    "--slide-index", as.character(slide_index),
    "--scale", as.character(scale)
  )
  args <- c(args, "--module", .preview_arg(module))

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
  perfil <- .preview_perfil_tomar(out_dir)   # perfil de LibreOffice reutilizado: ~1 s menos por vista previa
  on.exit(perfil$liberar(), add = TRUE)
  convertir <- function() {
    profile_uri <- .preview_profile_uri(perfil$dir)
    t0 <- Sys.time()
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
          .preview_arg(paste0("-env:UserInstallation=", profile_uri)),
          "--convert-to",
          "pdf",
          "--outdir",
          .preview_arg(out_dir),
          .preview_arg(pptx_path)
        ),
        stdout = TRUE,
        stderr = TRUE,
        timeout = timeout
      )
      TRUE
    }, error = function(e) FALSE)
    pdfs <- if (isTRUE(ok)) list.files(out_dir, pattern = "\\.pdf$", full.names = TRUE, ignore.case = TRUE) else character()
    list(pdf = if (length(pdfs)) pdfs[[1]] else NULL, segundos = as.numeric(difftime(Sys.time(), t0, units = "secs")))
  }
  r <- convertir()
  # Un perfil compartido dañado haría fallar todas las vistas previas de la sesión (verificadores de 9bce4f10e y
  # ebe1c1699): si la conversión falla, el perfil se borra siempre —también tras un timeout, que es como se manifiesta un
  # perfil que cuelga a soffice— para que la siguiente arranque con uno nuevo; sólo se reintenta aquí si falló rápido.
  if (is.null(r$pdf) && isTRUE(perfil$compartido)) {
    unlink(perfil$dir, recursive = TRUE, force = TRUE)
    if (r$segundos < timeout) {
      dir.create(perfil$dir, recursive = TRUE, showWarnings = FALSE)
      r <- convertir()
    }
  }
  r$pdf
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
  if (.preview_usar_artifact()) {
    out <- .render_pptx_slide_png_artifact(pptx_path, out_dir, slide_index = slide_index, timeout = timeout, scale = max(1, dpi / 96))
    if (!is.null(out)) return(out)
  }
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
      avisos <- .graficos_config_migrar_sesion(sid)   # persiste la migración de la población antigua y la avisa una vez
      cfg <- .graficos_normalize_config(.graficos_config_get(sid), sid = sid, include_legacy_aliases = TRUE)
      list(ok = TRUE, config = cfg, avisos = I(avisos))
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
      cfg <- .graficos_conservar_campos_backend(cfg, .graficos_config_get(sid))
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
      avisos <- .graficos_config_importar(sid, parsed)   # normaliza, guarda y devuelve el aviso de la migración (el GET ya no lo verá)
      list(ok = TRUE, imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"), avisos = I(avisos))
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
    plumber::pr_get("/api/graficos/slide-layout-matrix", wrap_endpoint(function(req, res, ...) {
      query <- req$argsQuery %||% list()
      profile_id <- .graficos_slide_layout_query_id(query, "profile_id", "profileId")
      template_id <- .graficos_slide_layout_query_id(query, "template_id", "templateId")
      context <- .graficos_slide_layout_effective_context(req, query$scope %||% NULL)
      tryCatch(
        .graficos_slide_layout_matrix(
          profile_id = profile_id,
          template_id = template_id,
          presets = context$presets,
          config = context$config
        ),
        error = function(e) {
          stop_api(
            400,
            "E_PREVIEW_FAILED",
            "No se pudo resolver la matriz de layouts solicitada."
          )
        }
      )
    })) |>
    plumber::pr_get("/api/graficos/slide-layout-preview", wrap_endpoint(function(req, res, ...) {
      query <- req$argsQuery %||% list()
      tipo <- as.character((query$tipo %||% "")[1])
      profile_id <- .graficos_slide_layout_query_id(query, "profile_id", "profileId")
      template_id <- .graficos_slide_layout_query_id(query, "template_id", "templateId")
      context <- .graficos_slide_layout_effective_context(req, "active")
      .graficos_slide_layout_preview(
        tipo,
        config = context$config,
        profile_id = profile_id,
        template_id = template_id,
        presets = context$presets
      )
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
    plumber::pr_get("/api/graficos/variables", wrap_endpoint(function(req, res, scope = "") {
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
      scope <- tolower(trimws(as.character(scope %||% "")[1]))
      .graficos_variables_sources_payload(sid, scoped = !identical(scope, "consolidado"))
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
        config = parsed$config %||% NULL,
        scoped = !identical(
          tolower(trimws(as.character(parsed$scope %||% "")[1])),
          "consolidado"
        )
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
      # ADR 0063: la fuente decide el generador (perfiles o declaracion de
      # equivalencias); la eleccion vive en graficos_plan_equivalencias.R.
      .graficos_plan_sugerido_por_fuente(sid, config = parsed$config %||% NULL)
    })) |>
    plumber::pr_get("/api/graficos/paletas-sugeridas", wrap_endpoint(function(req, res) {
      # Devuelve todas las listas de choices del instrumento con sus
      # value-labels, para que la UI del editor de paletas sepa qué
      # rellenar. Formato:
      #   [{list_name, escala_id, fuentes, variables, choices: [{name, label}]}]
      # `variables` es el puente hacia el `var` de un gráfico: sin él la UI que
      # reordena categorías tiene que ofrecer las 23 escalas del estudio en vez
      # de la de la pregunta que se está editando.
      # Si ya hay una paleta guardada para un list_name en el config, el
      # frontend la mergea por encima. Si no, muestra los labels sin
      # color asignado (placeholder gris).
      sid <- session_header(req)
      s <- session_get(sid)
      inst_sources <- .graficos_processing_sources(sid)$inst_sources
      if (!length(inst_sources) && !is.null(s$rp_inst)) inst_sources <- list(default = s$rp_inst)
      list(listas = .graficos_escalas_con_variables(
        .graficos_collect_palette_lists(inst_sources), inst_sources
      ))
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
      # Mini-PPTX de UNA lámina con el mismo motor del export, para ver la lámina sin correr el informe. Síncrono, con
      # caché por huella (graficos_miniaturas.R): con la misma lámina, datos, estilo y plantilla no vuelve a renderizar.
      # La variante que no bloquea plumber es POST /api/graficos/preview-slide-job (router_graficos_miniaturas.R).
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      fuentes <- .graficos_preview_fuentes(sid, parsed)
      opts <- .graficos_preview_opciones(parsed)
      .graficos_preview_sincrona(sid, parsed, fuentes, opts)
    })) |>
    plumber::pr_post("/api/graficos/ppt", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL, config = NULL) {
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      crudo <- .graficos_body_sin_simplificar(req, c("plan", "presets", "w_presets", "config"))
      if (is.list(crudo)) {
        plan <- crudo$plan %||% plan
        presets <- crudo$presets %||% presets
        w_presets <- crudo$w_presets %||% w_presets
        config <- crudo$config %||% config
      }
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan, avisar = TRUE)   # su aviso de migración va al resultado del job (on_complete)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      # Enriquecer presets con canvas-always + debug_ph global antes de
      # pasarlos al worker (invariantes Pulso).
      cfg <- .graficos_effective_config(sid, config)
      delivery <- .graficos_delivery_options(
        cfg,
        template_id = plan$template_id %||% NULL,
        auto_otros_slides = plan$auto_otros_slides %||% NULL
      )
      template_pptx_arg <- .graficos_resolve_template_pptx(
        config = cfg,
        profile_id = delivery$profile_id,
        template_id = delivery$template_id
      )
      auto_otros_slides_arg <- delivery$auto_otros_slides
      presets <- .enriquecer_presets(presets, NULL)  # D17: las guías de depuración nunca llegan al entregable
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

      # El worker vive en graficos_jobs.R como función top-level del
      # paquete: el bootstrap de job_submit() carga el paquete en el
      # subproceso callr y re-obtiene la función fresca del namespace
      # (marca prosecnur_job_function_name), sin load_all manual ni
      # resolución .pkg_fn por closure.
      job_id <- job_submit(
        sid = sid,
        kind = "graficos.ppt",
        func = graficos_job_worker_ppt,
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          plan = structure(plan, avisos_migracion = NULL),
          presets = presets,
          paletas = paletas_arg,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg,
          icon_registry = icon_registry_arg,
          active_base = active_base_arg,
          template_pptx = template_pptx_arg,
          template_id = delivery$template_id,
          auto_otros_slides = auto_otros_slides_arg
        ),
        result_filename = .graficos_export_filename(sid, "reporte_ppt", "pptx"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_ppt", j$result_path)
          .graficos_status_set(j$sid, "graficos_ppt_ok", TRUE)
          # Los arreglos automáticos del motor viajan al analista: sin esto,
          # quien declaró 14 pt y vio 9,5 cree que se equivocó.
          list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name,
               size = meta$size, n_slides = j$result_data$n_slides,
               avisos = I(.graficos_avisos_job(j$sid, j$id, plan)))
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.ppt")
    })) |>
    plumber::pr_post("/api/graficos/ppt-all", wrap_endpoint(function(req, res) {
      # Exporta el PPT de TODAS las bases de un estudio multi-base
      # independiente en un solo ZIP. A diferencia de /api/graficos/ppt
      # (que usa el `plan` recibido en el body y la fuente escopeada a
      # la base activa), esta ruta usa la config YA GUARDADA por base
      # (`graficos_config_por_base[[base]]`) — cada base se exporta con
      # su propio plan/presets/paletas, tal como quedaron al navegar el
      # selector de bases en el editor. Es opcional: solo aplica a
      # proyectos multi-base independientes con >= 2 bases con datos.
      sid <- session_header(req)
      s <- .graficos_sesion_con_migracion(sid)   # migra y guarda la config de cada base; su aviso va al resultado del job
      if (!isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))) {
        stop_api(409, "E_NOT_MULTIBASE",
                 "Este proyecto no es multi-base independiente. Usa 'Exportar' normal.")
      }
      data_sources <- estudio_data_sources(sid)
      inst_sources <- estudio_inst_sources(sid)
      bases <- names(data_sources)
      if (length(bases) < 2L) {
        stop_api(409, "E_NOT_ENOUGH_BASES",
                 "Se necesitan al menos 2 bases con datos para exportar un ZIP.")
      }

      # Validar TODAS las bases antes de arrancar el job — si una falla,
      # no se genera nada parcial (misma convencion que run_report_multibase()).
      per_base <- list()
      errors <- character(0)
      for (base in bases) {
        cfg <- .graficos_effective_config_for_base(sid, base, s = s)
        if (!.graficos_config_has_slides(cfg)) {
          errors <- c(errors, sprintf("Base '%s': no tiene un plan de graficos guardado.", base))
          next
        }
        plan_b <- .normalize_plan(cfg$plan)
        validation <- .validar_plan_json(plan_b)
        if (!validation$ok) {
          errors <- c(errors, sprintf("Base '%s': %s", base, paste(validation$errors, collapse = "; ")))
          next
        }
        delivery_b <- .graficos_delivery_options(
          cfg,
          template_id = plan_b$template_id %||% NULL,
          auto_otros_slides = plan_b$auto_otros_slides %||% NULL
        )
        per_base[[base]] <- list(
          plan = plan_b,
          presets = .enriquecer_presets(cfg$presets, NULL),  # D17: las guías de depuración nunca llegan al entregable
          paletas = cfg$paletas %||% list(),
          icon_registry = .graficos_icon_registry(sid, cfg),
          template_pptx = .graficos_resolve_template_pptx(
            config = cfg,
            profile_id = delivery_b$profile_id,
            template_id = delivery_b$template_id
          ),
          template_id = delivery_b$template_id,
          auto_otros_slides = delivery_b$auto_otros_slides,
          filename = .export_filename(sid, "reporte_ppt", "pptx", base = base)
        )
      }
      if (length(errors) > 0L) {
        stop_api(400, "E_INVALID_PLAN_MULTI", paste(errors, collapse = " | "))
      }

      rp_data_path <- job_save_rds(sid, "rp_data_sources_all", data_sources)
      rp_inst_path <- job_save_rds(sid, "rp_inst_sources_all", inst_sources)
      per_base_path <- job_save_rds(sid, "graficos_ppt_all_per_base", per_base)

      slide_registry_arg <- setNames(
        lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))),
        .slide_names()
      )
      graficador_registry_arg <- .graf_names()
      zip_name <- .export_filename(sid, "reporte_ppt_todas_bases", "zip")

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.ppt_all",
        # Worker top-level en graficos_jobs.R (ver comentario en /ppt).
        func = graficos_job_worker_ppt_all,
        args = list(
          rp_data_path = rp_data_path,
          rp_inst_path = rp_inst_path,
          per_base_path = per_base_path,
          bases = bases,
          slide_registry = slide_registry_arg,
          graficador_registry = graficador_registry_arg
        ),
        result_filename = zip_name,
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "graficos_ppt_zip", j$result_path)
          .graficos_status_set(j$sid, "graficos_ppt_ok", TRUE)
          list(
            ok = TRUE,
            file_id = meta$file_id,
            filename = meta$original_name,
            size = meta$size,
            n_bases = length(j$result_data$bases %||% list()),
            bases = j$result_data$bases,
            # Vara V4: `graficos.ppt` y `graficos.word` ya cosechaban los avisos
            # del job y éste no, que es justo donde una lámina degradada se
            # esconde mejor —el mazo de todas las bases—. Sin esto, el aviso de
            # «lámina degradada a canvas Sin datos» moría en el stderr.
            avisos = I(.graficos_avisos_job(j$sid, j$id, s))
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.ppt_all")
    })) |>
    plumber::pr_get("/api/graficos/iconos-recetario", wrap_endpoint(function(req, res, color = "navy", nombres = NULL) {
      # Biblioteca de íconos del recetario (F6.0b.5, lamina_iconos.R): nombres por color y las imágenes pedidas.
      sel <- if (is.null(nombres) || !nzchar(nombres)) NULL else strsplit(nombres, ",", fixed = TRUE)[[1]]
      cat <- .lam_iconos_catalogo()
      list(ok = TRUE, colores = lapply(cat$colores, I), iconos = .lam_iconos_data_uri(as.character(color)[1], sel))
    })) |>
    plumber::pr_post("/api/graficos/iconos-recetario/elegir", wrap_endpoint(function(req, res, contexto = NULL, textos = NULL) {
      # Qué ícono elige el motor para cada texto y por qué (capítulos del índice, actores del objetivo, filas de la ficha).
      crudo <- .graficos_body_sin_simplificar(req, c("contexto", "textos")) %||% list()
      contexto <- as.character(unlist(crudo$contexto) %||% "capitulo")[1]
      if (!contexto %in% names(.LAM_ICONOS_REGLAS)) stop_api(400, "E_BAD_ICONO_CONTEXTO", "«contexto» debe ser capitulo, actor o ficha.")
      textos <- as.character(unlist(crudo$textos) %||% character(0))
      list(ok = TRUE, contexto = contexto, elecciones = lapply(textos, function(t) c(list(texto = t), .lam_icono_elegir(t, contexto))))
    })) |>
    plumber::pr_post("/api/graficos/word/visor", wrap_endpoint(function(req, res, file_id = NULL) {
      # Páginas y mapa de capítulos del último Word exportado (F6.0b.4, reporte_word_visor.R). Por job: ~15 s.
      sid <- session_header(req)
      s <- session_get(sid)
      word <- .graficos_word_para_visor(sid, file_id)
      out_dir <- file.path(s$dir, "downloads", paste0("word_visor_", word$file_id))
      job_id <- job_submit(
        sid = sid,
        kind = "graficos.word_visor",
        func = graficos_job_worker_word_visor,
        args = list(docx_path = word$path, out_dir = out_dir),
        result_filename = paste0("word_visor_", word$file_id, ".rds"),
        on_complete = function(j) .graficos_word_visor_respuesta(j$result_data, word)
      )
      list(ok = TRUE, job_id = job_id)
    })) |>
    plumber::pr_post("/api/graficos/word", wrap_endpoint(function(req, res, plan = NULL, presets = NULL, w_presets = NULL, config = NULL, opciones_documento = NULL) {
      crudo <- .graficos_body_sin_simplificar(req, c("plan", "presets", "w_presets", "config", "opciones_documento"))
      if (is.list(crudo)) {
        plan <- crudo$plan %||% plan
        presets <- crudo$presets %||% presets
        w_presets <- crudo$w_presets %||% w_presets
        config <- crudo$config %||% config
      }
      sid <- session_header(req)
      s <- .require_rp_data(sid)
      if (is.null(plan)) stop_api(400, "E_NO_PLAN", "Falta 'plan' en el body")
      plan <- .normalize_plan(plan, avisar = TRUE)   # su aviso de migración va al resultado del job (on_complete)
      validation <- .validar_plan_json(plan)
      if (!validation$ok) stop_api(400, "E_INVALID_PLAN", paste(validation$errors, collapse = "; "))
      # Mismas invariantes que en /ppt.
      cfg <- .graficos_effective_config(sid, config)
      presets <- .enriquecer_presets(presets, NULL)  # D17: las guías de depuración nunca llegan al entregable
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
      # Portada, apertura, «Cómo leer», contacto y datos de portada del recetario (F6.0b.4, graficos_documento_word.R).
      opciones_documento <- .graficos_opciones_documento(
        if (is.list(crudo)) crudo$opciones_documento %||% cfg$documento_word else cfg$documento_word
      )
      args_word <- list(
        rp_data_path = rp_data_path,
        rp_inst_path = rp_inst_path,
        plan = structure(plan, avisos_migracion = NULL),
        presets = presets,
        w_presets = w_presets,
        paletas = paletas_arg,
        slide_registry = slide_registry_arg,
        graficador_registry = graficador_registry_arg,
        icon_registry = icon_registry_arg,
        active_base = active_base_arg
      )
      # Sólo viaja si hay opciones: un worker instalado sin este argumento sigue funcionando mientras no se usen.
      if (length(opciones_documento)) args_word$opciones_documento <- opciones_documento

      job_id <- job_submit(
        sid = sid,
        kind = "graficos.word",
        # Worker top-level en graficos_jobs.R (ver comentario en /ppt).
        func = graficos_job_worker_word,
        args = args_word,
        result_filename = .graficos_export_filename(sid, "reporte_word", "docx"),
        on_complete = function(j) {
          meta <- .register_output_file(j$sid, "reporte_word", j$result_path)
          .graficos_status_set(j$sid, "graficos_word_ok", TRUE)
          # Word renderiza con los mismos graficadores que el PPT y toma las
          # mismas decisiones automaticas, pero solo el PPT las contaba. El
          # `onExportDone` del front ya es generico: con esto las pinta igual.
          list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size, n_slides = j$result_data$n_slides,
               avisos = I(.graficos_avisos_job(j$sid, j$id, plan)))
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "graficos.word")
    }))
}
