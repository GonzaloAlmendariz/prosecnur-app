# «Contexto distrital» de las hojas con mapa: el distrito de la UMP entre sus
# vecinos, con la zona resaltada. Lo usan la cara 2 de la ficha
# (`.hojas_ruta_draw_context_map_pdf`) y la hoja de zona; vivía dentro del motor
# y la hoja de zona, al rehacerse, lo perdió.
#
# `block` necesita `ubigeo`, `zona` y `distrito`. `fallback_rings` son los
# anillos que encuadran el recuadro si no hay contorno del distrito (fuera de
# Lima y Callao): sin ellos no se dibuja nada más que el marco.

.hojas_ruta_mapa_contexto_distrital <- function(block, x, y, w, h, fallback_rings = list(), render_ctx = NULL) {
  mini_x <- x
  mini_y <- y
  mini_w <- w
  mini_h <- h
  .hojas_ruta_mapa_rotulo("Contexto distrital", mini_x, mini_y + mini_h + 0.018, mini_w)
  grid::grid.rect(x = mini_x + mini_w / 2, y = mini_y + mini_h / 2, width = mini_w, height = mini_h,
                  gp = grid::gpar(fill = "white", col = "#c3ccdb", lwd = 0.5))
  if (length(fallback_rings)) {
    district_context_all <- tryCatch(
      .hojas_ruta_pdf_district_context_features(block$ubigeo),
      error = function(err) list()
    )
    active_district <- NULL
    if (length(district_context_all)) {
      active_idx <- which(vapply(district_context_all, function(feature) {
        identical(as.character(feature$ubigeo %||% ""), .pulso_ceros_izq(6L, as.character(block$ubigeo %||% "")))
      }, logical(1)))[1]
      if (!is.na(active_idx)) active_district <- district_context_all[[active_idx]]
    }
    district_outlines_mini <- list()
    if (is.null(active_district)) {
      district_outlines_mini <- tryCatch(
        .hojas_ruta_pdf_district_outline_features(block$ubigeo),
        error = function(err) list()
      )
    }
    district_rings <- if (!is.null(active_district)) {
      active_district$rings
    } else if (length(district_outlines_mini)) {
      unlist(lapply(district_outlines_mini, `[[`, "rings"), recursive = FALSE)
    } else {
      fallback_rings
    }
    inset <- 0.03  # NPC del viewport, en cada lado
    rect_w_in <- (1 - 2 * inset) * mini_w * 11.69
    rect_h_in <- (1 - 2 * inset) * mini_h * 8.27
    district_bbox <- .hojas_ruta_bbox_from_rings(district_rings)
    mini_bbox <- NULL
    district_context_mini <- list()
    # Mantener un zoom distrital, pero abrir lo justo para que aparezcan los
    # distritos vecinos como referencia politica cuando existen alrededor.
    for (pad_i in c(0.12, 0.20, 0.30)) {
      candidate_bbox <- .hojas_ruta_bbox_fit_aspect(
        .hojas_ruta_bbox_expand(district_bbox, pad = pad_i),
        width = rect_w_in,
        height = rect_h_in
      )
      candidate_districts <- if (length(district_context_all)) {
        .hojas_ruta_pdf_district_context_features(block$ubigeo, candidate_bbox)
      } else {
        list()
      }
      mini_bbox <- candidate_bbox
      district_context_mini <- candidate_districts
      if (length(candidate_districts) > 1L || identical(pad_i, 0.30)) break
    }
    if (!length(district_context_mini) && length(district_outlines_mini)) {
      district_context_mini <- lapply(district_outlines_mini, function(feature) {
        feature$distrito <- as.character(block$distrito %||% "")
        feature$bbox <- .hojas_ruta_bbox_from_rings(feature$rings)
        feature$label_lon <- mean(c(feature$bbox[["min_lon"]], feature$bbox[["max_lon"]]))
        feature$label_lat <- mean(c(feature$bbox[["min_lat"]], feature$bbox[["max_lat"]]))
        feature
      })
    }
    mini_ring <- .hojas_ruta_bbox_to_ring(mini_bbox)
    grid::pushViewport(grid::viewport(
      x = mini_x + mini_w / 2, y = mini_y + mini_h / 2,
      width = mini_w, height = mini_h, clip = "on"
    ))
    mini_project <- .hojas_ruta_mapa_adelgazar(.hojas_ruta_project_rings_paper(  # ~0,06 mm de grilla
      list(mini_ring), inset, inset, 1 - 2 * inset, 1 - 2 * inset,
      paper_w = mini_w * 11.69, paper_h = mini_h * 8.27, pad = 0
    ), tol = 0.0015)
    # Capa 1: municipios vecinos rellenos para que el contexto distrital no
    # quede flotando sobre blanco.
    if (length(district_context_mini)) {
      ordered_districts <- district_context_mini[order(vapply(district_context_mini, function(feature) {
        if (identical(as.character(feature$ubigeo %||% ""), .pulso_ceros_izq(6L, as.character(block$ubigeo %||% "")))) 1L else 0L
      }, integer(1)))]
      for (district in ordered_districts) {
        active <- identical(as.character(district$ubigeo %||% ""), .pulso_ceros_izq(6L, as.character(block$ubigeo %||% "")))
        for (ring in district$rings) {
          p <- mini_project(ring)
          grid::grid.polygon(
            x = p$x, y = p$y, default.units = "npc",
            gp = grid::gpar(
              fill = if (active) "#eef6ff" else "#f0f0f0",
              col = if (active) "#7e9abd" else "#c2c2c2",
              lwd = if (active) 0.45 else 0.28,
              linejoin = "round", lineend = "round"
            )
          )
        }
      }
    }
    # Sin manzanas ni calles: a ~4 cm sólo se leen distritos y zonas.
    # Capa 3: limites distritales solidos, como fronteras politicas.
    if (length(district_context_mini)) {
      ordered_districts <- district_context_mini[order(vapply(district_context_mini, function(feature) {
        if (identical(as.character(feature$ubigeo %||% ""), .pulso_ceros_izq(6L, as.character(block$ubigeo %||% "")))) 1L else 0L
      }, integer(1)))]
      for (district in ordered_districts) {
        active <- identical(as.character(district$ubigeo %||% ""), .pulso_ceros_izq(6L, as.character(block$ubigeo %||% "")))
        for (ring in district$rings) {
          smoothed <- .hojas_ruta_chaikin_smooth(ring, iters = 1L, closed = TRUE)
          p <- mini_project(smoothed)
          grid::grid.polygon(
            x = p$x, y = p$y, default.units = "npc",
            gp = grid::gpar(
              fill = NA,
              col = if (active) "#111111" else "#747474",
              lwd = if (active) 1.15 else 0.50,
              linejoin = "round", lineend = "round"
            )
          )
        }
      }
    } else {
      for (district in district_outlines_mini) {
        for (ring in district$rings) {
          smoothed <- .hojas_ruta_chaikin_smooth(ring, iters = 1L, closed = TRUE)
          p <- mini_project(smoothed)
          grid::grid.polygon(
            x = p$x, y = p$y, default.units = "npc",
            gp = grid::gpar(fill = NA, col = "#111111", lwd = 1.15,
                            linejoin = "round", lineend = "round")
          )
        }
      }
    }
    # Capa 4: nombres de distritos vecinos y del distrito activo.
    if (length(district_context_mini)) {
      accepted_labels <- list()
      label_count <- 0L
      for (district in district_context_mini) {
        active <- identical(as.character(district$ubigeo %||% ""), .pulso_ceros_izq(6L, as.character(block$ubigeo %||% "")))
        if (active || label_count >= 7L) next  # el activo ya está en la cabecera y tapaba la zona
        lon <- suppressWarnings(as.numeric(district$label_lon %||% NA_real_))
        lat <- suppressWarnings(as.numeric(district$label_lat %||% NA_real_))
        if (!is.finite(lon) || !is.finite(lat) ||
            lon < mini_bbox[["min_lon"]] || lon > mini_bbox[["max_lon"]] ||
            lat < mini_bbox[["min_lat"]] || lat > mini_bbox[["max_lat"]]) {
          lon <- mean(c(district$bbox[["min_lon"]], district$bbox[["max_lon"]]))
          lat <- mean(c(district$bbox[["min_lat"]], district$bbox[["max_lat"]]))
        }
        if (!is.finite(lon) || !is.finite(lat)) next
        pt <- mini_project(matrix(c(lon, lat), ncol = 2, byrow = TRUE))
        if (!nrow(pt) || pt$x[[1]] < 0.035 || pt$x[[1]] > 0.965 ||
            pt$y[[1]] < 0.035 || pt$y[[1]] > 0.965) next
        label <- .hojas_ruta_pdf_minimap_label(district$distrito %||% "")
        if (!nzchar(label)) next
        collides <- vapply(accepted_labels, function(other) {
          sqrt((pt$x[[1]] - other$x)^2 + (pt$y[[1]] - other$y)^2) < if (active || other$active) 0.085 else 0.105
        }, logical(1))
        if (length(collides) && any(collides)) next
        grid::grid.text(
          label,
          x = pt$x[[1]], y = pt$y[[1]],
          gp = grid::gpar(
            fontsize = if (active) 4.0 else 3.35,
            fontface = if (active) "bold" else "plain",
            col = if (active) "#111111" else "#555555",
            lineheight = 0.88
          )
        )
        accepted_labels[[length(accepted_labels) + 1L]] <- list(x = pt$x[[1]], y = pt$y[[1]], active = active)
        if (!active) label_count <- label_count + 1L
      }
    }
    # Capa 5: outlines de zonas (incluye zonas vecinas y limites con otras
    # municipalidades si los hubiera).
    zone_outlines_mini <- tryCatch(
      .hojas_ruta_pdf_zone_outline_features(block$ubigeo, mini_bbox,
                                            render_ctx = render_ctx),
      error = function(err) list()
    )
    for (zone in zone_outlines_mini) {
      current <- identical(as.character(zone$zona %||% ""), as.character(block$zona %||% ""))
      if (current) next
      for (ring in zone$rings) {
        smoothed <- .hojas_ruta_chaikin_smooth(ring, iters = 2L, closed = TRUE)
        p <- mini_project(smoothed)
        grid::grid.polygon(
          x = p$x, y = p$y, default.units = "npc",
          gp = grid::gpar(fill = NA, col = "#b9b9b9", lwd = 0.45,
                          linejoin = "round", lineend = "round")
        )
      }
    }
    # Capa 6: la zona de la UMP rellena en celeste (su contorno, no sus manzanas).
    zona_actual <- Filter(function(z) identical(as.character(z$zona %||% ""), as.character(block$zona %||% "")),
                          zone_outlines_mini)
    .hojas_ruta_mapa_poligonos(.hojas_ruta_mapa_anillos(zona_actual, mini_project)$p, fill = "#cfe8ff", col = NA)
    # Capa 7: limite poligonal de la zona seleccionada en azul intenso.
    for (zone in zone_outlines_mini) {
      if (!identical(as.character(zone$zona %||% ""), as.character(block$zona %||% ""))) next
      for (ring in zone$rings) {
        smoothed <- .hojas_ruta_chaikin_smooth(ring, iters = 2L, closed = TRUE)
        p <- mini_project(smoothed)
        grid::grid.polygon(
          x = p$x, y = p$y, default.units = "npc",
          gp = grid::gpar(fill = NA, col = "#003f88", lwd = 1.2,
                          linejoin = "round", lineend = "round")
        )
      }
    }
    grid::popViewport()
  }
  invisible(NULL)
}
