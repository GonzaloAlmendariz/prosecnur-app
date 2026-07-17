.mapa_chr1 <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else trimws(out)
}

.mapa_status_levels <- c("no_intervenido", "comparacion", "intervencion", "efectiva", "alerta")

.mapa_status_labels <- c(
  no_intervenido = "Fuera de la ruta",
  comparacion = "Comparación territorial",
  intervencion = "Intervención territorial",
  efectiva = "Cobertura efectiva",
  alerta = "Alerta"
)

.mapa_status_colors <- c(
  no_intervenido = "#E8EBEF",
  comparacion = "#00A98F",
  intervencion = "#0072BC",
  efectiva = "#00B398",
  alerta = "#EF4A60"
)

.mapa_ring_df <- function(ring, group, zona, status, ubigeo, distrito) {
  if (is.null(ring) || !length(ring)) return(data.frame())
  if (is.list(ring) && all(c("x", "y") %in% names(ring))) {
    x <- suppressWarnings(as.numeric(unlist(ring$x, use.names = FALSE)))
    y <- suppressWarnings(as.numeric(unlist(ring$y, use.names = FALSE)))
  } else {
    pts <- tryCatch(do.call(rbind, ring), error = function(e) NULL)
    if (is.null(pts) || !nrow(pts) || ncol(pts) < 2L) return(data.frame())
    x <- suppressWarnings(as.numeric(pts[, 1]))
    y <- suppressWarnings(as.numeric(pts[, 2]))
  }
  keep <- is.finite(x) & is.finite(y)
  if (sum(keep) < 3L) return(data.frame())
  data.frame(
    x = x[keep],
    y = y[keep],
    group = group,
    zona = zona,
    status = status,
    ubigeo = ubigeo,
    distrito = distrito,
    stringsAsFactors = FALSE
  )
}

.mapa_collection_polygons <- function(zones, contexto = list()) {
  if (!is.list(zones) || !length(zones)) return(data.frame())
  rows <- list()
  for (i in seq_along(zones)) {
    zone <- zones[[i]] %||% list()
    rings <- zone$rings %||% list()
    if (!length(rings)) next
    zona <- .mapa_chr1(zone$zona, "")
    status <- .mapa_chr1(zone$status, "no_intervenido")
    if (!status %in% .mapa_status_levels) status <- "no_intervenido"
    ubigeo <- .mapa_chr1(zone$ubigeo %||% contexto$ubigeo, "")
    distrito <- .mapa_chr1(zone$distrito %||% contexto$distrito, "")
    for (j in seq_along(rings)) {
      rows[[length(rows) + 1L]] <- .mapa_ring_df(
        rings[[j]],
        group = paste(ubigeo, zona, i, j, sep = "-"),
        zona = zona,
        status = status,
        ubigeo = ubigeo,
        distrito = distrito
      )
    }
  }
  rows <- rows[vapply(rows, nrow, integer(1)) > 0L]
  if (!length(rows)) return(data.frame())
  out <- do.call(rbind, rows)
  out$status <- factor(out$status, levels = .mapa_status_levels, labels = unname(.mapa_status_labels[.mapa_status_levels]))
  out
}

.mapa_context_polygons <- function(contexto) {
  .mapa_collection_polygons(contexto$zones %||% list(), contexto)
}

.mapa_context_labels <- function(contexto) {
  labels <- contexto$district_labels %||% list()
  if (!is.list(labels) || !length(labels)) return(data.frame())
  rows <- lapply(labels, function(item) {
    x <- suppressWarnings(as.numeric(item$x %||% NA_real_)[1])
    y <- suppressWarnings(as.numeric(item$y %||% NA_real_)[1])
    label <- .mapa_chr1(item$distrito, "")
    if (!is.finite(x) || !is.finite(y) || !nzchar(label)) return(NULL)
    label <- paste(strwrap(label, width = 18L), collapse = "\n")
    data.frame(
      x = x,
      y = y,
      label = label,
      ubigeo = .mapa_chr1(item$ubigeo, ""),
      pair_label = .mapa_chr1(item$pair_label, ""),
      status = .mapa_chr1(item$status, "no_intervenido"),
      stringsAsFactors = FALSE
    )
  })
  rows <- rows[!vapply(rows, is.null, logical(1))]
  if (!length(rows)) return(data.frame())
  do.call(rbind, rows)
}

.mapa_context_summary <- function(contexto) {
  rows <- contexto$summary %||% list()
  if (is.data.frame(rows)) return(rows)
  if (!is.list(rows) || !length(rows)) return(data.frame())
  cols <- unique(unlist(lapply(rows, names), use.names = FALSE))
  cols <- cols[nzchar(cols)]
  out <- as.data.frame(stats::setNames(rep(list(rep(NA_character_, length(rows))), length(cols)), cols),
                       stringsAsFactors = FALSE, check.names = FALSE)
  for (i in seq_along(rows)) {
    row <- rows[[i]]
    if (!is.list(row)) next
    for (nm in intersect(names(row), cols)) out[[nm]][[i]] <- .mapa_chr1(row[[nm]], "")
  }
  out
}

.mapa_blank_plot <- function(titulo = NULL, message = "Sin geometria territorial disponible") {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("Se requiere ggplot2 para renderizar mapas de cobertura.", call. = FALSE)
  }
  ggplot2::ggplot() +
    ggplot2::annotate("text", x = 0.5, y = 0.5, label = message, size = 4, color = "#666666") +
    ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) +
    ggplot2::labs(title = titulo %||% "Mapa de cobertura territorial") +
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(
      plot.title = ggplot2::element_text(color = "#18375F", face = "bold", size = 13, hjust = 0),
      plot.margin = ggplot2::margin(8, 8, 8, 8)
    )
}

.mapa_polygon_plot <- function(poly, study_blocks = data.frame(), lima_boundary = data.frame(),
                               district_boundaries = data.frame(), alpha_zones = 0.62) {
  plot <- ggplot2::ggplot()
  if (nrow(lima_boundary)) {
    plot <- plot + ggplot2::geom_polygon(
      data = lima_boundary,
      ggplot2::aes(.data$x, .data$y, group = .data$group),
      fill = "#F5F7FA",
      color = "#C7D0DC",
      linewidth = 0.18
    )
  }
  neutral_label <- unname(.mapa_status_labels[["no_intervenido"]])
  neutral_zones <- poly[as.character(poly$status) == neutral_label, , drop = FALSE]
  active_zones <- poly[as.character(poly$status) != neutral_label, , drop = FALSE]
  if (nrow(neutral_zones)) {
    plot <- plot + ggplot2::geom_polygon(
      data = neutral_zones,
      ggplot2::aes(.data$x, .data$y, group = .data$group),
      fill = .mapa_status_colors[["no_intervenido"]],
      color = "#FFFFFF",
      linewidth = 0.08,
      alpha = 0.46
    )
  }
  if (nrow(active_zones)) {
    plot <- plot + ggplot2::geom_polygon(
      data = active_zones,
      ggplot2::aes(.data$x, .data$y, group = .data$group, fill = .data$status),
      color = "#FFFFFF",
      linewidth = 0.10,
      alpha = alpha_zones
    )
  }
  if (nrow(study_blocks)) {
    neutral_blocks <- study_blocks[as.character(study_blocks$status) == neutral_label, , drop = FALSE]
    active_blocks <- study_blocks[as.character(study_blocks$status) != neutral_label, , drop = FALSE]
    if (nrow(neutral_blocks)) {
      plot <- plot + ggplot2::geom_polygon(
        data = neutral_blocks,
        ggplot2::aes(.data$x, .data$y, group = .data$group),
        fill = .mapa_status_colors[["no_intervenido"]],
        color = "#FFFFFF",
        linewidth = 0.04,
        alpha = 0.32
      )
    }
    if (nrow(active_blocks)) {
      plot <- plot + ggplot2::geom_polygon(
        data = active_blocks,
        ggplot2::aes(.data$x, .data$y, group = .data$group, fill = .data$status),
        color = "#FFFFFF",
        linewidth = 0.04,
        alpha = 0.98
      )
    }
  }
  if (nrow(district_boundaries)) {
    plot <- plot + ggplot2::geom_polygon(
      data = district_boundaries,
      ggplot2::aes(.data$x, .data$y, group = .data$group),
      fill = NA,
      color = "#171A1F",
      linewidth = 0.78,
      alpha = 1
    )
  }
  plot +
    ggplot2::scale_fill_manual(
      values = setNames(.mapa_status_colors, unname(.mapa_status_labels[.mapa_status_levels])),
      drop = TRUE,
      guide = "none"
    ) +
    ggplot2::scale_x_continuous(expand = ggplot2::expansion(mult = c(0.03, 0.03))) +
    ggplot2::scale_y_continuous(expand = ggplot2::expansion(mult = c(0.03, 0.03))) +
    ggplot2::coord_equal(expand = TRUE, clip = "off") +
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(
      plot.margin = ggplot2::margin(3, 3, 3, 3),
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      panel.background = ggplot2::element_rect(fill = "transparent", colour = NA)
    )
}

.mapa_pair_key_plot <- function(district_labels) {
  key <- district_labels[
    nzchar(district_labels$pair_label) &
      district_labels$status %in% c("intervencion", "comparacion"),
    ,
    drop = FALSE
  ]
  if (!nrow(key)) return(ggplot2::ggplot() + ggplot2::theme_void())
  key <- key[!duplicated(key[c("pair_label", "status", "label")]), , drop = FALSE]
  pair_levels <- unique(key$pair_label)
  status_order <- c("intervencion", "comparacion")
  key$.pair <- match(key$pair_label, pair_levels)
  key$.status <- match(key$status, status_order)
  key <- key[order(key$.pair, key$.status), , drop = FALSE]
  key$label <- gsub("\\n", " ", key$label, fixed = FALSE)
  pair_centers <- seq(0.78, 0.26, length.out = length(pair_levels))
  key$y <- pair_centers[key$.pair] - (key$.status - 1) * 0.08
  key$color <- unname(.mapa_status_colors[key$status])
  headers <- data.frame(
    pair_label = pair_levels,
    y = pair_centers + 0.10,
    stringsAsFactors = FALSE
  )
  ggplot2::ggplot() +
    ggplot2::geom_text(
      data = headers,
      ggplot2::aes(x = 0.02, y = .data$y, label = .data$pair_label),
      hjust = 0,
      vjust = 1,
      family = "Arial",
      fontface = "bold",
      size = 4.2,
      color = "#18375F"
    ) +
    ggplot2::geom_point(
      data = key,
      ggplot2::aes(x = 0.045, y = .data$y, color = .data$color),
      shape = 15,
      size = 4.6,
      show.legend = FALSE
    ) +
    ggplot2::geom_text(
      data = key,
      ggplot2::aes(x = 0.10, y = .data$y, label = .data$label),
      hjust = 0,
      vjust = 0.5,
      family = "Arial",
      size = 3.35,
      color = "#1A1A1A"
    ) +
    ggplot2::scale_color_identity() +
    ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE, clip = "off") +
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(
      plot.margin = ggplot2::margin(5, 6, 5, 3),
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA)
    )
}

.mapa_overview_koica_plot <- function(poly, study_blocks, district_boundaries, district_labels) {
  if (!requireNamespace("cowplot", quietly = TRUE)) {
    stop("Se requiere cowplot para componer el mapa territorial general.", call. = FALSE)
  }
  main <- .mapa_polygon_plot(
    poly,
    study_blocks = study_blocks,
    district_boundaries = district_boundaries,
    alpha_zones = 0.84
  )
  key <- .mapa_pair_key_plot(district_labels)
  out <- cowplot::plot_grid(main, key, nrow = 1, rel_widths = c(0.73, 0.27), align = "h", axis = "tb")
  attr(out, "pulso_mapa_layout") <- "overview_zoom_pair_key"
  attr(out, "pulso_mapa_has_inset") <- FALSE
  attr(out, "pulso_mapa_pair_count") <- length(unique(district_labels$pair_label[nzchar(district_labels$pair_label)]))
  attr(out, "pulso_mapa_district_count") <- length(unique(district_boundaries$ubigeo[nzchar(district_boundaries$ubigeo)]))
  out
}

#' Mapa de cobertura territorial para planes PPT
#'
#' @param scope `"district"` o `"overview_koica"`.
#' @param ubigeo UBIGEO del distrito cuando `scope = "district"`.
#' @param contexto Lista serializable con zonas, resumen y geometria.
#' @export
p_mapa_cobertura_territorial <- function(scope = c("district", "overview_koica"),
                                         ubigeo = NULL,
                                         titulo = NULL,
                                         unit = "zonas",
                                         coverage_mode = "efectivas",
                                         mostrar_manzanas = FALSE,
                                         contexto = list(),
                                         overrides = list()) {
  scope <- match.arg(scope)
  titulo <- .ppt_norm_text1(titulo, blank = NULL)
  if (!is.list(contexto)) contexto <- list()
  if (!is.list(overrides)) stop("`overrides` debe ser lista.", call. = FALSE)
  el <- list(
    .element_type = "mapa_cobertura_territorial",
    scope = scope,
    ubigeo = .mapa_chr1(ubigeo, ""),
    title_slide = titulo,
    unit = .mapa_chr1(unit, "zonas"),
    coverage_mode = .mapa_chr1(coverage_mode, "efectivas"),
    mostrar_manzanas = isTRUE(mostrar_manzanas),
    contexto = contexto,
    overrides = overrides
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Renderizar mapa de cobertura territorial
#' @export
graficar_mapa_cobertura_territorial <- function(contexto = list(),
                                                titulo = NULL,
                                                overrides = list()) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop("Se requiere ggplot2 para renderizar mapas de cobertura.", call. = FALSE)
  }
  poly <- .mapa_context_polygons(contexto)
  lima_boundary <- .mapa_collection_polygons(contexto$lima_boundary %||% list(), contexto)
  district_boundaries <- .mapa_collection_polygons(contexto$study_districts %||% list(), contexto)
  study_blocks <- .mapa_collection_polygons(contexto$study_blocks %||% list(), contexto)
  district_labels <- .mapa_context_labels(contexto)
  scope <- .mapa_chr1(contexto$scope, "")
  mostrar_titulo <- isTRUE(contexto$mostrar_titulo %||% TRUE)
  titulo <- if (mostrar_titulo) {
    titulo %||% .mapa_chr1(contexto$titulo %||% contexto$title, "Mapa de cobertura territorial")
  } else {
    ""
  }
  caption <- .mapa_chr1(contexto$caption, "")
  subtitle <- .mapa_chr1(contexto$subtitle, "")

  if (!nrow(poly)) {
    summary <- .mapa_context_summary(contexto)
    if (nrow(summary) && all(c("distrito", "zonas_efectivas") %in% names(summary))) {
      summary$zonas_efectivas <- suppressWarnings(as.numeric(summary$zonas_efectivas))
      summary$zonas_efectivas[!is.finite(summary$zonas_efectivas)] <- 0
      summary$distrito <- factor(summary$distrito, levels = rev(summary$distrito))
      return(
        ggplot2::ggplot(summary, ggplot2::aes(x = .data$zonas_efectivas, y = .data$distrito)) +
          ggplot2::geom_col(fill = "#00B398", width = 0.62) +
          ggplot2::geom_text(ggplot2::aes(label = .data$zonas_efectivas), hjust = -0.18, size = 3.3, color = "#18375F") +
          ggplot2::scale_x_continuous(expand = ggplot2::expansion(mult = c(0, 0.12))) +
          ggplot2::labs(title = titulo, subtitle = subtitle, caption = caption, x = NULL, y = NULL) +
          ggplot2::theme_minimal(base_family = "Arial") +
          ggplot2::theme(
            panel.grid.major.y = ggplot2::element_blank(),
            panel.grid.minor = ggplot2::element_blank(),
            plot.title = ggplot2::element_text(color = "#18375F", face = "bold", size = 13),
            plot.subtitle = ggplot2::element_text(color = "#666666", size = 9),
            axis.text = ggplot2::element_text(color = "#1A1A1A", size = 9),
            plot.caption = ggplot2::element_text(color = "#666666", size = 7, hjust = 0),
            plot.margin = ggplot2::margin(8, 8, 8, 8)
          )
      )
    }
    return(.mapa_blank_plot(titulo, .mapa_chr1(contexto$message, "Sin geometria territorial disponible")))
  }

  if (identical(scope, "overview_koica") && !nrow(district_boundaries) && nrow(lima_boundary) && nrow(district_labels)) {
    district_boundaries <- lima_boundary[
      lima_boundary$ubigeo %in% unique(district_labels$ubigeo[nzchar(district_labels$ubigeo)]),
      ,
      drop = FALSE
    ]
  }
  if (identical(scope, "overview_koica") && nrow(district_boundaries) && nrow(district_labels)) {
    return(.mapa_overview_koica_plot(poly, study_blocks, district_boundaries, district_labels))
  }

  plot <- ggplot2::ggplot()
  if (nrow(lima_boundary)) {
    plot <- plot + ggplot2::geom_polygon(
      data = lima_boundary,
      ggplot2::aes(.data$x, .data$y, group = .data$group),
      fill = "#F5F7FA",
      color = "#C7D0DC",
      linewidth = 0.18
    )
  }
  plot <- plot + ggplot2::geom_polygon(
    data = poly,
    ggplot2::aes(.data$x, .data$y, group = .data$group, fill = .data$status),
    color = "#FFFFFF",
    linewidth = 0.12,
    alpha = if (nrow(lima_boundary)) 0.55 else 1
  )
  if (nrow(study_blocks)) {
    plot <- plot + ggplot2::geom_polygon(
      data = study_blocks,
      ggplot2::aes(.data$x, .data$y, group = .data$group, fill = .data$status),
      color = "#FFFFFF",
      linewidth = 0.05,
      alpha = 0.98
    )
  }
  if (nrow(district_labels)) {
    plot <- plot + ggplot2::geom_label(
      data = district_labels,
      ggplot2::aes(.data$x, .data$y, label = .data$label),
      inherit.aes = FALSE,
      family = "Arial",
      fontface = "bold",
      size = 3.4,
      color = "#18375F",
      fill = scales::alpha("#FFFFFF", 0.88),
      label.size = 0,
      label.padding = grid::unit(0.10, "lines")
    )
  }
  plot +
    ggplot2::scale_x_continuous(expand = ggplot2::expansion(mult = c(0.08, 0.05))) +
    ggplot2::scale_y_continuous(expand = ggplot2::expansion(mult = c(0.04, 0.04))) +
    ggplot2::coord_equal(expand = TRUE, clip = "off") +
    ggplot2::scale_fill_manual(values = setNames(.mapa_status_colors, unname(.mapa_status_labels[.mapa_status_levels])), drop = TRUE) +
    ggplot2::labs(title = titulo, subtitle = subtitle, caption = caption, fill = NULL) +
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(
      legend.position = "bottom",
      legend.direction = "horizontal",
      legend.text = ggplot2::element_text(color = "#1A1A1A", size = 9.5),
      plot.title = ggplot2::element_text(color = "#18375F", face = "bold", size = 13, hjust = 0),
      plot.subtitle = ggplot2::element_text(color = "#666666", size = 10.5, hjust = 0),
      plot.caption = ggplot2::element_text(color = "#666666", size = 7, hjust = 0),
      plot.margin = ggplot2::margin(8, 8, 8, 8),
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      panel.background = ggplot2::element_rect(fill = "transparent", colour = NA)
    )
}
