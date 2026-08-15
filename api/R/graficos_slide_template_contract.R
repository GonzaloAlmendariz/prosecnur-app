# Contrato geométrico efectivo de las 22 láminas PPT.
#
# Esta es la única autoridad que combina metadata pública, plantilla abierta,
# presets efectivos y `.PPT_CONTRACT`. El renderer conserva el contrato interno
# como atributo del mismo objeto; el wire HTTP usa una whitelist explícita y no
# puede serializar ese atributo ni rutas locales.

.GRAFICOS_SLIDE_LAYOUT_SCHEMA <- "graficos.slide_layout_matrix/v2"
.GRAFICOS_SLIDE_LAYOUT_CONTRACT_VERSION <- 2L

.PPT_SLIDE_PAYLOAD_KEYS <- list(
  title_slide = c(title = "titulo", subtitle = "subtitulo", date = "fecha", subtexto = "subtexto"),
  indice = c(title = "titulo", content = "secciones"),
  top_two_box = c(title = "titulo", text = "texto", diagram = "diagrama"),
  section = c(title = "titulo"),
  objetivo_icono = c(title = "titulo", text = "texto", icon = "icono"),
  text_slide = c(title = "titulo", text = "texto"),
  technical_table = c(title = "titulo", table = "filas", footer = "pie"),
  slide_1 = c(title = "titulo", plot = "grafico", base = "base", right = "pie"),
  slide_1_narrativo = c(title = "titulo", text = "texto", plot = "grafico", base = "base", footer = "pie"),
  slide_2 = c(title = "titulo", left = "izquierda", right = "derecha", base = "base", right_text = "pie"),
  slide_2_narrativo = c(title = "titulo", text = "texto", left = "izquierda", right = "derecha", base = "base", footer = "pie"),
  text_r = c(title = "titulo", text = "texto", plot = "grafico", base = "base", footer = "pie"),
  text_l = c(title = "titulo", text = "texto", plot = "grafico", base = "base", footer = "pie"),
  text_r2 = c(title = "titulo", text = "texto", plot1 = "grafico_1", plot2 = "grafico_2", base = "base", footer = "pie"),
  text_l2 = c(title = "titulo", text = "texto", plot1 = "grafico_1", plot2 = "grafico_2", base = "base", footer = "pie"),
  paneles_4 = c(
    title = "titulo", up_left = "superior_izquierda", up_right = "superior_derecha",
    bottom_left = "inferior_izquierda", bottom_right = "inferior_derecha",
    base = "base", footer = "pie"
  ),
  poblacion_2 = c(title = "titulo", text = "texto", left = "izquierda", right = "derecha", icon = "icono", base = "base"),
  poblacion_3 = c(
    title = "titulo", up_left = "superior_izquierda", bottom_left = "inferior_izquierda",
    right = "derecha", icon = "icono", base = "base"
  ),
  poblacion_4 = c(
    title = "titulo", up_left = "superior_izquierda", up_right = "superior_derecha",
    bottom_left = "inferior_izquierda", bottom_right = "inferior_derecha",
    icon = "icono", base = "base"
  ),
  poblacion_5 = c(
    title = "titulo", pic1 = "grafico_superior_2", pic2 = "grafico_superior_1",
    pic3 = "grafico_superior_3", pic4 = "grafico_inferior_2",
    pic5 = "grafico_inferior_1", icon = "icono", footer = "pie"
  ),
  poblacion_6 = c(
    title = "titulo", pic1 = "grafico_superior_2", pic2 = "grafico_superior_1",
    pic3 = "grafico_superior_3", pic4 = "grafico_inferior_3",
    pic5 = "grafico_inferior_1", pic6 = "grafico_inferior_2",
    icon = "icono", footer = "pie"
  )
)

.ppt_slide_template_select_placeholder <- function(props, spec) {
  if (!is.data.frame(props) || !nrow(props) || !is.list(spec) || is.null(spec$type)) {
    return(NULL)
  }

  label <- as.character(spec$ph_label %||% "")[1]
  if (nzchar(label) && "ph_label" %in% names(props)) {
    labelled <- props[props$ph_label %in% label, , drop = FALSE]
    if (nrow(labelled)) return(labelled[1L, , drop = FALSE])
  }

  typed <- props[props$type %in% as.character(spec$type), , drop = FALSE]
  if (!nrow(typed)) return(NULL)

  type_idx <- spec$type_idx %||% NULL
  if (!is.null(type_idx) && "type_idx" %in% names(typed)) {
    type_idx <- suppressWarnings(as.integer(type_idx)[1])
    indexed <- typed[typed$type_idx == type_idx, , drop = FALSE]
    if (nrow(indexed)) return(indexed[1L, , drop = FALSE])
    return(typed[1L, , drop = FALSE])
  }

  typed[1L, , drop = FALSE]
}

.ppt_slide_template_loc <- function(left, top, width, height, payload_key,
                                    role, geometry_source = "renderer_absolute") {
  list(
    loc = list(left = left, top = top, width = width, height = height),
    payload_key = payload_key,
    role = role,
    geometry_source = geometry_source
  )
}

.ppt_slide_template_manual_contracts <- function(contract) {
  contract$indice$slots <- list(
    title = .ppt_slide_template_loc(6.58, 1.32, 5.10, 0.62, "titulo", "text"),
    content = .ppt_slide_template_loc(6.56, 2.14, 5.22, 4.76, "secciones", "text")
  )
  contract$top_two_box <- list(
    layout = "Title and Content",
    slots = list(
      title = .ppt_slide_template_loc(0.62, 0.58, 10.40, 0.48, "titulo", "text"),
      text = .ppt_slide_template_loc(0.62, 1.24, 12.00, 0.95, "texto", "text"),
      diagram = .ppt_slide_template_loc(
        6.475 - (4.62 * (1000 / 520)) / 2,
        2.34,
        4.62 * (1000 / 520),
        4.62,
        "diagrama",
        "diagram"
      )
    )
  )
  contract$technical_table$slots <- list(
    title = .ppt_slide_template_loc(0.62, 0.70, 11.90, 0.55, "titulo", "text"),
    table = .ppt_slide_template_loc(0.50, 1.45, 12.30, 5.55, "filas", "table"),
    footer = .ppt_slide_template_loc(0.50, 7.06, 12.25, 0.20, "pie", "note")
  )
  contract
}

.ppt_slide_template_objective_contract <- function(contract, doc, master) {
  entry <- contract$objetivo_icono
  if (is.null(entry) || is.null(doc) || is.na(entry$layout %||% NA_character_)) return(contract)
  props <- tryCatch(
    officer::layout_properties(doc, layout = entry$layout, master = master),
    error = function(e) data.frame()
  )
  bodies <- props[
    props$type == "body" & is.finite(props$offx) & is.finite(props$offy) &
      is.finite(props$cx) & is.finite(props$cy) & props$cx > 0 & props$cy > 0,
    , drop = FALSE
  ]
  if (!nrow(bodies)) return(contract)

  text_candidates <- bodies[bodies$cx >= 3 & bodies$cy >= 1, , drop = FALSE]
  if (nrow(text_candidates)) {
    text <- text_candidates[which.max(text_candidates$cx * text_candidates$cy), , drop = FALSE]
    contract$objetivo_icono$slots$text$type_idx <- as.integer(text$type_idx[[1]])
    contract$objetivo_icono$slots$text$loc <- list(
      left = as.numeric(text$offx[[1]]), top = as.numeric(text$offy[[1]]),
      width = as.numeric(text$cx[[1]]), height = as.numeric(text$cy[[1]])
    )
  }

  icon_candidates <- bodies[
    bodies$cx >= 1.4 & bodies$cx <= 3 & bodies$cy >= 1.4 & bodies$cy <= 3 &
      abs(bodies$cx - bodies$cy) <= 0.7,
    , drop = FALSE
  ]
  if (nrow(icon_candidates)) {
    icon <- icon_candidates[which.min(abs(icon_candidates$cx - icon_candidates$cy)), , drop = FALSE]
    contract$objetivo_icono$slots$icon$type_idx <- as.integer(icon$type_idx[[1]])
    contract$objetivo_icono$slots$icon$loc <- list(
      left = as.numeric(icon$offx[[1]]), top = as.numeric(icon$offy[[1]]),
      width = as.numeric(icon$cx[[1]]), height = as.numeric(icon$cy[[1]])
    )
  }
  contract
}

.ppt_slide_template_useful_body <- function(contract, contract_key, slot_name,
                                             doc, master) {
  entry <- contract[[contract_key]]
  if (is.null(entry) || is.null(doc) || is.na(entry$layout %||% NA_character_)) return(contract)
  props <- tryCatch(
    officer::layout_properties(doc, layout = entry$layout, master = master),
    error = function(e) data.frame()
  )
  bodies <- props[
    props$type == "body" & is.finite(props$offx) & is.finite(props$offy) &
      is.finite(props$cx) & is.finite(props$cy) & props$cx >= 2 & props$cy >= 0.5,
    , drop = FALSE
  ]
  if (!nrow(bodies)) return(contract)
  useful <- bodies[which.max(bodies$cx * bodies$cy), , drop = FALSE]
  contract[[contract_key]]$slots[[slot_name]]$type_idx <- as.integer(useful$type_idx[[1]])
  contract[[contract_key]]$slots[[slot_name]]$loc <- list(
    left = as.numeric(useful$offx[[1]]), top = as.numeric(useful$offy[[1]]),
    width = as.numeric(useful$cx[[1]]), height = as.numeric(useful$cy[[1]])
  )
  contract
}

.ppt_slide_template_hide_unusable_cover_slots <- function(contract, doc, master,
                                                           slide_dims) {
  if (is.null(doc)) return(contract)
  entry <- contract$title_slide
  props <- tryCatch(
    officer::layout_properties(doc, layout = entry$layout, master = master),
    error = function(e) data.frame()
  )
  for (slot_name in c("date", "subtexto")) {
    spec <- entry$slots[[slot_name]]
    hit <- .ppt_slide_template_select_placeholder(props, spec)
    usable <- !is.null(hit)
    if (usable) {
      values <- as.numeric(c(hit$offx[[1]], hit$offy[[1]], hit$cx[[1]], hit$cy[[1]]))
      usable <- all(is.finite(values)) && values[[3]] > 1e-4 && values[[4]] > 1e-4 &&
        values[[1]] >= 0 && values[[2]] >= 0 &&
        values[[1]] + values[[3]] <= slide_dims$width + 0.05 &&
        values[[2]] + values[[4]] <= slide_dims$height + 0.05
    }
    if (!usable) contract$title_slide$slots[[slot_name]]$suppress <- TRUE
  }
  contract
}

.ppt_slide_template_apply_effective_geometry <- function(contract, doc, master,
                                                          presets, layout_info,
                                                          slide_dims) {
  if (is.null(doc)) return(contract)
  base_args <- presets$base$args %||% list()
  layout_exists <- function(layout_name) {
    length(layout_name) == 1L && !is.na(layout_name) && layout_name %in% layout_info$layout
  }
  props_for <- function(contract_key) {
    layout <- contract[[contract_key]]$layout %||% NA_character_
    if (!layout_exists(layout)) return(data.frame())
    tryCatch(
      officer::layout_properties(doc, layout = layout, master = master),
      error = function(e) data.frame()
    )
  }

  contract$slide_1$slots$title <- .ppt_title_spec_with_height(
    props_for("slide_1"), contract$slide_1$slots$title,
    height = base_args$slide_title_height
  )
  contract$slide_2$slots$title <- .ppt_title_spec_with_height(
    props_for("slide_2"), contract$slide_2$slots$title,
    height = base_args$slide_title_height
  )
  contract$slide_1_narrativo$slots$title <- .ppt_title_spec_with_height(
    props_for("slide_1_narrativo"), contract$slide_1_narrativo$slots$title,
    height = base_args$slide_title_height
  )
  contract$section$slots$title <- .ppt_safe_section_title_spec(
    props_for("section"),
    slide_width = slide_dims$width,
    slide_height = slide_dims$height,
    spec = contract$section$slots$title
  )

  slide_1_height <- suppressWarnings(as.numeric(
    (base_args$slide_1_plot_height_cm %||% base_args$alto_placeholder_1_grafico_cm %||% NA_real_)[1]
  ))
  if (is.finite(slide_1_height) && slide_1_height > 0) {
    plot <- .ppt_slide_template_select_placeholder(props_for("slide_1"), contract$slide_1$slots$plot)
    if (!is.null(plot)) {
      contract$slide_1$slots$plot$loc <- list(
        left = as.numeric(plot$offx[[1]]), top = as.numeric(plot$offy[[1]]),
        width = as.numeric(plot$cx[[1]]), height = slide_1_height / 2.54
      )
    }
  }

  narrative_height <- suppressWarnings(as.numeric(
    (base_args$slide_1_narrativo_plot_height_cm %||%
       base_args$alto_placeholder_1_grafico_narrativo_cm %||% NA_real_)[1]
  ))
  narrative_top <- suppressWarnings(as.numeric(
    (base_args$slide_1_narrativo_plot_top_cm %||% NA_real_)[1]
  ))
  if ((is.finite(narrative_height) && narrative_height > 0) ||
      (is.finite(narrative_top) && narrative_top > 0)) {
    plot <- .ppt_slide_template_select_placeholder(
      props_for("slide_1_narrativo"), contract$slide_1_narrativo$slots$plot
    )
    if (!is.null(plot)) {
      contract$slide_1_narrativo$slots$plot$loc <- list(
        left = as.numeric(plot$offx[[1]]),
        top = if (is.finite(narrative_top) && narrative_top > 0) narrative_top / 2.54 else as.numeric(plot$offy[[1]]),
        width = as.numeric(plot$cx[[1]]),
        height = if (is.finite(narrative_height) && narrative_height > 0) narrative_height / 2.54 else as.numeric(plot$cy[[1]])
      )
    }
  }

  contract <- .ppt_calibrar_pies_iconos(
    contract, doc, master, slide_dims,
    layout_exists = layout_exists,
    base_args = base_args
  )
  contract <- .ppt_slide_template_objective_contract(contract, doc, master)
  contract <- .ppt_slide_template_useful_body(contract, "text_slide", "text", doc, master)
  .ppt_slide_template_hide_unusable_cover_slots(contract, doc, master, slide_dims)
}

.ppt_slide_template_payload_key <- function(render_key, slot_name, spec) {
  declared <- as.character(spec$payload_key %||% "")[1]
  if (nzchar(declared)) return(declared)
  aliases <- .PPT_SLIDE_PAYLOAD_KEYS[[render_key]] %||% character()
  value <- aliases[[slot_name]] %||% slot_name
  as.character(value)[1]
}

.ppt_slide_template_role <- function(meta, payload_key, slot_name, spec) {
  declared <- as.character(spec$role %||% "")[1]
  if (nzchar(declared)) return(declared)
  slot_spec <- (meta$slot_specs %||% list())[[payload_key]] %||% NULL
  if (is.list(slot_spec) && nzchar(as.character(slot_spec$role %||% "")[1])) {
    return(as.character(slot_spec$role)[1])
  }
  if (payload_key %in% c("titulo", "subtitulo", "fecha", "subtexto", "texto", "secciones")) return("text")
  if (payload_key %in% c("base", "pie")) return("note")
  if (payload_key == "icono") return("icon")
  if (payload_key == "filas") return("table")
  if (payload_key == "diagrama") return("diagram")
  if (as.character(spec$type %||% "")[1] == "pic" || grepl("^(plot|pic)", slot_name)) return("chart")
  "shape"
}

.ppt_slide_template_normalized_rect <- function(loc, slide_dims) {
  values <- suppressWarnings(as.numeric(c(loc$left, loc$top, loc$width, loc$height)))
  canvas <- suppressWarnings(as.numeric(c(slide_dims$width, slide_dims$height)))
  if (length(values) != 4L || length(canvas) != 2L || any(!is.finite(c(values, canvas))) ||
      any(canvas <= 0)) {
    return(list(x = 0, y = 0, width = 0, height = 0))
  }
  x1 <- max(0, min(1, values[[1]] / canvas[[1]]))
  y1 <- max(0, min(1, values[[2]] / canvas[[2]]))
  x2 <- max(0, min(1, (values[[1]] + max(0, values[[3]])) / canvas[[1]]))
  y2 <- max(0, min(1, (values[[2]] + max(0, values[[4]])) / canvas[[2]]))
  list(x = x1, y = y1, width = max(0, x2 - x1), height = max(0, y2 - y1))
}

.ppt_slide_template_region <- function(slot_name, spec, props, slide_dims,
                                       render_key, meta) {
  hit <- NULL
  source <- as.character(spec$geometry_source %||% "")[1]
  loc <- spec$loc %||% NULL
  reason <- ""
  if (isTRUE(spec$suppress)) {
    reason <- "suppressed"
  } else if (is.list(loc)) {
    if (!nzchar(source)) source <- "contract_loc"
  } else {
    hit <- .ppt_slide_template_select_placeholder(props, spec)
    if (!is.null(hit)) {
      loc <- list(
        left = as.numeric(hit$offx[[1]]), top = as.numeric(hit$offy[[1]]),
        width = as.numeric(hit$cx[[1]]), height = as.numeric(hit$cy[[1]])
      )
      source <- "template_placeholder"
    } else {
      reason <- "placeholder_missing"
      source <- "unresolved"
    }
  }

  rect <- .ppt_slide_template_normalized_rect(loc %||% list(), slide_dims)
  area <- rect$width * rect$height
  visible <- !nzchar(reason) && is.finite(area) && area > 1e-8
  if (!visible && !nzchar(reason)) reason <- "outside_or_zero_area"
  payload_key <- .ppt_slide_template_payload_key(render_key, slot_name, spec)
  list(
    region = list(
      key = as.character(slot_name),
      payload_key = payload_key,
      role = .ppt_slide_template_role(meta, payload_key, slot_name, spec),
      visible = isTRUE(visible),
      rect = rect,
      geometry_source = source
    ),
    diagnostic = if (nzchar(reason)) paste0(slot_name, ":", reason) else character()
  )
}

.ppt_slide_template_fingerprint <- function(doc, slide_dims, layout_info,
                                            template_fingerprint = NULL) {
  supplied <- tolower(trimws(as.character(template_fingerprint %||% "")[1]))
  if (grepl("^[0-9a-f]{64}$", supplied)) return(supplied)
  digest::digest(
    list(
      canvas = unname(as.numeric(c(slide_dims$width, slide_dims$height))),
      layouts = lapply(seq_len(nrow(layout_info)), function(i) {
        list(
          layout = as.character(layout_info$layout[[i]]),
          master = as.character(layout_info$master[[i]])
        )
      })
    ),
    algo = "sha256",
    serialize = TRUE
  )
}

.ppt_slide_template_master <- function(layout_info, preferred = NULL) {
  masters <- as.character(layout_info$master %||% character())
  masters <- masters[!is.na(masters) & nzchar(trimws(masters))]
  preferred <- trimws(as.character(preferred %||% "")[1])
  if (nzchar(preferred) && preferred %in% masters) return(preferred)
  if (!length(masters)) return("Office Theme")
  counts <- sort(table(masters), decreasing = TRUE)
  names(counts)[[1]]
}

.ppt_slide_template_presets_fingerprint <- function(presets) {
  base_args <- presets$base$args %||% list()
  geometry_keys <- c(
    "slide_title_height", "slide_1_plot_height_cm",
    "alto_placeholder_1_grafico_cm", "slide_1_narrativo_plot_height_cm",
    "alto_placeholder_1_grafico_narrativo_cm", "slide_1_narrativo_plot_top_cm",
    "source_footer_left", "source_footer_top", "source_footer_width",
    "source_footer_height", "source_footer_align"
  )
  present_keys <- geometry_keys[geometry_keys %in% names(base_args)]
  safe <- if (length(present_keys)) {
    stats::setNames(base_args[present_keys], present_keys)
  } else {
    list()
  }
  digest::digest(safe, algo = "sha256", serialize = TRUE)
}

.ppt_slide_template_file_fingerprint <- function(path) {
  path <- as.character(path %||% "")[1]
  if (!nzchar(path) || !file.exists(path)) return(NULL)
  tolower(as.character(digest::digest(file = path, algo = "sha256")))
}

.PPT_SLIDE_LAYOUT_COMPAT_CANDIDATES <- list(
  Graficos2 = c("Graficos2", "Graficos"),
  `Title and Content` = c("Title and Content", "General Objective")
)

.ppt_slide_template_layout_candidates <- function(preferred) {
  preferred <- as.character(preferred %||% "")[1]
  candidates <- .PPT_SLIDE_LAYOUT_COMPAT_CANDIDATES[[preferred]] %||% preferred
  unique(as.character(candidates))
}

.ppt_slide_template_select_layout <- function(preferred, layout_info, master) {
  candidates <- .ppt_slide_template_layout_candidates(preferred)
  if (!is.data.frame(layout_info) || !nrow(layout_info) ||
      !all(c("layout", "master") %in% names(layout_info))) {
    return(NA_character_)
  }
  master <- as.character(master %||% "")[1]
  same_master <- !is.na(layout_info$master) & as.character(layout_info$master) == master
  available <- as.character(layout_info$layout[same_master])
  hit <- candidates[candidates %in% available]
  if (length(hit)) hit[[1]] else NA_character_
}

.ppt_resolve_slide_template_contract <- function(
    doc = NULL,
    master = NULL,
    presets = list(),
    metadata = .SLIDES_META,
    template_id = NULL,
    identity_source = NULL,
    template_fingerprint = NULL
) {
  template_id <- trimws(as.character(template_id %||% "")[1])
  if (!template_id %in% c("acnur_16_9", "generic_16_9")) template_id <- "generic_16_9"
  identity_source <- trimws(as.character(identity_source %||% "")[1])
  if (!identity_source %in% c("template_id", "profile_id", "default")) {
    identity_source <- if (identical(template_id, "generic_16_9")) "default" else "template_id"
  }

  render_keys <- vapply(metadata, function(meta) as.character(meta$render_key %||% "")[1], character(1))
  # El número es una cuenta declarada, no un tope: sube cuando se añade una
  # lámina (la última, `poblacion_3`, en 2026-08-14). Lo que protege de verdad
  # es el `anyDuplicated`, que caza dos láminas compartiendo renderer.
  if (length(render_keys) != 22L || any(!nzchar(render_keys)) || anyDuplicated(render_keys)) {
    stop("El metadata de slides debe declarar 22 `render_key` únicos.", call. = FALSE)
  }

  contract <- .ppt_slide_template_manual_contracts(.PPT_CONTRACT)
  layout_info <- if (is.null(doc)) {
    synthetic_master <- as.character(master %||% "Office Theme")[1]
    data.frame(
      layout = unique(vapply(metadata, function(meta) as.character(meta$blueprint$ppt_layout)[1], character(1))),
      master = synthetic_master,
      stringsAsFactors = FALSE
    )
  } else {
    tryCatch(officer::layout_summary(doc), error = function(e) data.frame())
  }
  slide_dims <- if (is.null(doc)) {
    list(width = 13.33333, height = 7.5)
  } else {
    officer::slide_size(doc)
  }
  master <- .ppt_slide_template_master(layout_info, master)

  for (tipo in names(metadata)) {
    meta <- metadata[[tipo]]
    render_key <- as.character(meta$render_key)[1]
    blueprint_layout <- as.character(meta$blueprint$ppt_layout)[1]
    entry <- contract[[render_key]] %||% list(slots = list())
    entry$layout <- .ppt_slide_template_select_layout(
      blueprint_layout,
      layout_info = layout_info,
      master = master
    )
    contract[[render_key]] <- entry
  }
  contract <- .ppt_slide_template_apply_effective_geometry(
    contract, doc, master, presets, layout_info, slide_dims
  )

  slides <- lapply(names(metadata), function(tipo) {
    meta <- metadata[[tipo]]
    render_key <- as.character(meta$render_key)[1]
    entry <- contract[[render_key]] %||% list(slots = list())
    layout <- as.character(entry$layout %||% NA_character_)[1]
    diagnostics <- character()
    if (is.na(layout) || !nzchar(layout)) diagnostics <- c(diagnostics, "layout_missing")
    props <- if (!is.null(doc) && !is.na(layout) && nzchar(layout)) {
      tryCatch(
        officer::layout_properties(doc, layout = layout, master = master),
        error = function(e) data.frame()
      )
    } else {
      data.frame()
    }

    regions <- list()
    slots <- entry$slots %||% list()
    for (slot_name in names(slots)) {
      resolved <- .ppt_slide_template_region(
        slot_name, slots[[slot_name]], props, slide_dims, render_key, meta
      )
      regions[[length(regions) + 1L]] <- resolved$region
      diagnostics <- c(diagnostics, resolved$diagnostic)
    }
    list(
      tipo = tipo,
      render_key = render_key,
      layout = layout,
      regions = regions,
      diagnostics = unique(diagnostics[nzchar(diagnostics)])
    )
  })

  template_geometry_fingerprint <- .ppt_slide_template_fingerprint(
    doc, slide_dims, layout_info, template_fingerprint
  )
  presets_fingerprint <- .ppt_slide_template_presets_fingerprint(presets)
  result <- list(
    schema = .GRAFICOS_SLIDE_LAYOUT_SCHEMA,
    contract_version = .GRAFICOS_SLIDE_LAYOUT_CONTRACT_VERSION,
    template = list(
      id = template_id,
      fingerprint = digest::digest(
        list(template = template_geometry_fingerprint, presets = presets_fingerprint),
        algo = "sha256",
        serialize = TRUE
      ),
      identity_source = identity_source
    ),
    canvas = list(
      width = as.numeric(slide_dims$width),
      height = as.numeric(slide_dims$height),
      aspect_ratio = as.numeric(slide_dims$width / slide_dims$height)
    ),
    slides = slides
  )
  class(result) <- c("ppt_slide_template_contract_v2", "list")
  attr(result, "ppt_contract") <- contract
  attr(result, "layout_info") <- layout_info
  attr(result, "master") <- master
  attr(result, "presets_fingerprint") <- presets_fingerprint
  result
}

.ppt_slide_layout_matrix_payload <- function(contract) {
  if (!inherits(contract, "ppt_slide_template_contract_v2") ||
      !identical(contract$schema, .GRAFICOS_SLIDE_LAYOUT_SCHEMA) ||
      !identical(as.integer(contract$contract_version), .GRAFICOS_SLIDE_LAYOUT_CONTRACT_VERSION)) {
    stop("Contrato de matriz de slides inválido.", call. = FALSE)
  }
  list(
    schema = contract$schema,
    contract_version = contract$contract_version,
    template = contract$template,
    canvas = contract$canvas,
    slides = contract$slides
  )
}

.graficos_slide_layout_resolution_error <- function(reason, message) {
  error <- simpleError(message)
  error$reason <- as.character(reason)[1]
  stop(error)
}

.graficos_resolve_slide_layout_contract <- function(
    profile_id = NULL,
    template_id = NULL,
    presets = NULL,
    master = NULL,
    config = NULL
) {
  scalar_id <- function(value) {
    value <- as.character(value %||% "")[1]
    if (is.na(value)) "" else trimws(value)
  }
  requested_profile_id <- scalar_id(profile_id)
  requested_template_id <- scalar_id(template_id)
  config_list <- tryCatch(.as_json_list(config), error = function(e) NULL) %||% list()
  config_global <- tryCatch(
    .as_json_list((config_list$scope_rules %||% list())$global),
    error = function(e) NULL
  ) %||% list()
  first_config_id <- function(...) {
    values <- list(...)
    for (value in values) {
      value <- scalar_id(value)
      if (nzchar(value)) return(value)
    }
    ""
  }
  config_template_id <- first_config_id(
    config_global$template_id,
    config_global$templateId,
    config_list$template_id,
    config_list$templateId
  )
  config_profile_id <- first_config_id(
    config_global$profile_id,
    config_global$profileId,
    config_list$profile_id,
    config_list$profileId
  )
  query_has_identity <- nzchar(requested_template_id) || nzchar(requested_profile_id)
  delivery <- .graficos_delivery_options(
    if (query_has_identity) NULL else config,
    profile_id = if (nzchar(requested_profile_id)) requested_profile_id else NULL,
    template_id = if (nzchar(requested_template_id)) requested_template_id else NULL
  )
  resolved_profile_id <- scalar_id(delivery$profile_id)
  resolved_template_id <- scalar_id(delivery$template_id)
  if (!resolved_template_id %in% c("acnur_16_9", "generic_16_9")) {
    resolved_template_id <- "generic_16_9"
  }
  identity_source <- if (nzchar(requested_template_id)) {
    "template_id"
  } else if (nzchar(requested_profile_id)) {
    "profile_id"
  } else if (nzchar(config_template_id)) {
    "template_id"
  } else if (nzchar(config_profile_id)) {
    "profile_id"
  } else {
    "default"
  }
  template_path <- .graficos_resolve_template_pptx(
    config = config,
    profile_id = resolved_profile_id,
    template_id = resolved_template_id
  )
  if (is.na(template_path) || !nzchar(template_path) || !file.exists(template_path)) {
    .graficos_slide_layout_resolution_error(
      "missing_template",
      "No se encontró la plantilla PPT para resolver la matriz."
    )
  }
  doc <- tryCatch(
    officer::read_pptx(template_path),
    error = function(e) {
      .graficos_slide_layout_resolution_error(
        "template_unreadable",
        "No se pudo leer la plantilla PPT para resolver la matriz."
      )
    }
  )
  if (is.null(presets)) presets <- list(base = list(args = list()))
  .ppt_resolve_slide_template_contract(
    doc = doc,
    master = master,
    presets = presets,
    metadata = .SLIDES_META,
    template_id = resolved_template_id,
    identity_source = identity_source,
    template_fingerprint = .ppt_slide_template_file_fingerprint(template_path)
  )
}

.graficos_slide_layout_matrix <- function(profile_id = NULL, template_id = NULL,
                                           presets = NULL, master = NULL,
                                           config = NULL) {
  resolved <- .graficos_resolve_slide_layout_contract(
    profile_id = profile_id,
    template_id = template_id,
    presets = presets,
    master = master,
    config = config
  )
  .ppt_slide_layout_matrix_payload(resolved)
}

.graficos_slide_layout_preview_v1 <- function(tipo, config = NULL, profile_id = NULL,
                                               template_id = NULL, presets = NULL,
                                               master = NULL) {
  tipo <- as.character(tipo %||% "")[1]
  fallback <- function(render_key = "", reason = "missing_geometry") {
    list(
      ok = TRUE,
      tipo = tipo,
      contract = render_key,
      layout = NA,
      aspectRatio = 16 / 9,
      source = "reference_local",
      reason = reason,
      placeholders = list()
    )
  }
  if (!nzchar(tipo)) return(fallback(reason = "missing_tipo"))
  meta <- .SLIDES_META[[tipo]] %||% NULL
  if (is.null(meta)) return(fallback(reason = "unknown_tipo"))

  resolved <- tryCatch(
    .graficos_resolve_slide_layout_contract(
      profile_id = profile_id,
      template_id = template_id,
      presets = presets,
      master = master,
      config = config
    ),
    error = identity
  )
  if (inherits(resolved, "condition")) {
    reason <- as.character(resolved$reason %||% "template_unreadable")[1]
    return(fallback(meta$render_key, reason))
  }
  matrix <- .ppt_slide_layout_matrix_payload(resolved)
  tipos <- vapply(matrix$slides, `[[`, character(1), "tipo")
  slide_index <- match(tipo, tipos)
  if (is.na(slide_index)) return(fallback(meta$render_key, "missing_contract"))
  slide <- matrix$slides[[slide_index]]
  if (is.na(slide$layout) || !nzchar(slide$layout)) {
    return(fallback(slide$render_key, "missing_layout"))
  }
  internal <- attr(resolved, "ppt_contract")
  slots <- (internal[[slide$render_key]] %||% list())$slots %||% list()
  visible <- slide$regions[vapply(slide$regions, `[[`, logical(1), "visible")]
  placeholders <- lapply(visible, function(region) {
    spec <- slots[[region$key]] %||% list()
    type <- as.character(spec$type %||% "")[1]
    if (is.na(type)) type <- ""
    type_idx <- spec$type_idx %||% NA
    if (!length(type_idx)) type_idx <- NA
    list(
      key = region$key,
      payload_key = region$payload_key,
      label = region$payload_key,
      role = region$role,
      type = type,
      type_idx = type_idx,
      rect = region$rect,
      hidden = FALSE
    )
  })
  list(
    ok = TRUE,
    tipo = tipo,
    contract = slide$render_key,
    layout = slide$layout,
    aspectRatio = matrix$canvas$aspect_ratio,
    source = "template",
    template_id = matrix$template$id,
    placeholders = placeholders
  )
}
