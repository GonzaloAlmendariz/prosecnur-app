.mapa_chr1 <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else trimws(out)
}

.mapa_status_levels <- c("no_intervenido", "comparacion", "intervencion", "efectiva", "alerta")

.mapa_status_labels <- c(
  no_intervenido = "No intervenido",
  comparacion = "Comparacion",
  intervencion = "Intervencion",
  efectiva = "Cobertura efectiva",
  alerta = "Alerta"
)

.mapa_status_colors <- c(
  no_intervenido = "#E8EBEF",
  comparacion = "#C9D8EA",
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

.mapa_context_polygons <- function(contexto) {
  zones <- contexto$zones %||% list()
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
  titulo <- titulo %||% .mapa_chr1(contexto$titulo %||% contexto$title, "Mapa de cobertura territorial")
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

  ggplot2::ggplot(poly, ggplot2::aes(.data$x, .data$y, group = .data$group, fill = .data$status)) +
    ggplot2::geom_polygon(color = "#FFFFFF", linewidth = 0.12) +
    ggplot2::coord_equal(expand = FALSE) +
    ggplot2::scale_fill_manual(values = setNames(.mapa_status_colors, unname(.mapa_status_labels[.mapa_status_levels])), drop = TRUE) +
    ggplot2::labs(title = titulo, subtitle = subtitle, caption = caption, fill = NULL) +
    ggplot2::theme_void(base_family = "Arial") +
    ggplot2::theme(
      legend.position = "bottom",
      legend.direction = "horizontal",
      legend.text = ggplot2::element_text(color = "#1A1A1A", size = 8),
      plot.title = ggplot2::element_text(color = "#18375F", face = "bold", size = 13, hjust = 0),
      plot.subtitle = ggplot2::element_text(color = "#666666", size = 9, hjust = 0),
      plot.caption = ggplot2::element_text(color = "#666666", size = 7, hjust = 0),
      plot.margin = ggplot2::margin(8, 8, 8, 8),
      plot.background = ggplot2::element_rect(fill = "transparent", colour = NA),
      panel.background = ggplot2::element_rect(fill = "transparent", colour = NA)
    )
}
