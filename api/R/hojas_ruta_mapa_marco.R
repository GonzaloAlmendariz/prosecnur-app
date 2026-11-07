# Marco de la cara 2 de la ficha (mapa de zona): cabecera, panel de ubicación,
# rótulos del panel lateral, leyenda y pie, con la misma capa Pulso que la cara 1
# (hojas_ruta_ficha_pdf.R). El mapa en sí lo sigue dibujando el motor
# (`.hojas_ruta_draw_context_map_pdf`); aquí sólo vive lo que lo rodea.
#
# Página A4 apaisada. El mapa ocupa x 0,035–0,82 e y 0,072–0,87; el panel
# lateral, x 0,84–0,97. Se imprime en blanco y negro: la cabecera va en
# contorno y nada se distingue sólo por color.
#
# La leyenda lista sólo lo que el mapa dibujó: antes anunciaba siempre
# «Parque / plaza / agua» aunque esa capa casi nunca tiene datos.

.hojas_ruta_mapa_aspecto <- 11.69 / 8.27

#' Cabecera de la cara 2: territorio, título, ubicación y la ruta en contorno.
#' @keywords internal
.hojas_ruta_mapa_cabecera <- function(block, tk = pulso_pdf_tokens()) {
  L <- 0.035
  R <- 0.97
  es_reemplazo <- identical(as.character(block$tipo_manzana %||% ""), "reemplazo")
  territorio <- toupper(paste(.hojas_ruta_ficha_nombre(block$departamento %||% ""),
                              .hojas_ruta_ficha_nombre(block$provincia %||% ""), sep = " · "))
  .hfp_text(territorio, L, 0.962, 7.4, tk$soft, "bold", spacing = 1.2)
  .hfp_text("Mapa de zona", L, 0.935, 17, tk$navy, "bold")
  .hfp_text(sprintf("%s  ·  Zona %s  ·  Manzana %s  ·  UBIGEO %s",
                    .hojas_ruta_ficha_nombre(block$distrito %||% ""), as.character(block$zona %||% ""),
                    as.character(block$manzana %||% ""), as.character(block$ubigeo %||% "")),
            L, 0.905, 9.5, tk$ink)
  chip_w <- R - 0.84
  chip_x <- 0.84
  .hfp_rect(chip_x, 0.975, chip_w, 0.078, fill = "#ffffff", col = tk$navy, lwd = 1.6, r = 0.08)
  .hfp_text(if (es_reemplazo) "REEMPLAZO" else "RUTA", chip_x + chip_w / 2, 0.958, 6.6,
            tk$soft, "bold", just = c("center", "center"), spacing = 1.2)
  .hfp_text(.hojas_ruta_operational_code(block), chip_x + chip_w / 2, 0.937, 15, tk$navy, "bold",
            just = c("center", "center"))
  .hfp_text(.hojas_ruta_mapa_encuestas(block), chip_x + chip_w / 2, 0.913, 7.6, tk$ink,
            just = c("center", "center"))
  .hfp_line(L, R, 0.886, col = tk$navy, lwd = pulso_pdf_pesos()$bloque)
  invisible(TRUE)
}

.hojas_ruta_mapa_encuestas <- function(block) {
  a <- suppressWarnings(as.integer(block$rango_inicio %||% NA))
  b <- suppressWarnings(as.integer(block$rango_fin %||% NA))
  if (length(a) && length(b) && !is.na(a) && !is.na(b)) sprintf("Encuestas %d a %d", a, b) else ""
}

#' Rótulo de un bloque del panel lateral: segmento navy y nombre.
#' @keywords internal
.hojas_ruta_mapa_rotulo <- function(titulo, x, y, w, tk = pulso_pdf_tokens()) {
  grid::grid.rect(x = x, y = y, width = 0.004, height = 0.02, just = c("left", "center"),
                  gp = grid::gpar(fill = tk$navy, col = NA))
  .hfp_text(titulo, x + 0.01, y, 9.5, tk$navy, "bold")
  invisible(y)
}

#' Panel «Ubicación de campo». Devuelve la `y` donde termina.
#' @keywords internal
.hojas_ruta_mapa_ubicacion <- function(block, x, w, top, tk = pulso_pdf_tokens()) {
  .hojas_ruta_mapa_rotulo("Ubicación de campo", x, top, w, tk)
  filas <- list(
    c("Distrito", .hojas_ruta_ficha_nombre(block$distrito %||% "")),
    c("Zona", as.character(block$zona %||% "")),
    c("Manzana", as.character(block$manzana %||% "")),
    c("Viviendas", format(as.integer(block$viviendas %||% 0L), big.mark = ",")),
    c("Entrevistas", format(as.integer(block$entrevistas %||% 0L), big.mark = ","))
  )
  if (identical(as.character(block$tipo_manzana %||% ""), "reemplazo")) {
    titular <- suppressWarnings(as.integer(block$titular_hoja_num %||% block$titular_orden_seleccion %||% NA))
    if (length(titular) && !is.na(titular)) filas <- c(filas, list(c("Reemplaza a", sprintf("UMP %d", titular))))
  }
  y <- top - 0.022
  fila_h <- 0.026
  for (i in seq_along(filas)) {
    # Un valor que no cabe junto a su rótulo («San Juan de Lurigancho») baja a
    # una segunda línea de la misma fila en vez de montarse sobre el rótulo.
    largo <- nchar(filas[[i]][[2]]) > 13L
    h <- if (largo) fila_h * 1.75 else fila_h
    if (i %% 2 == 1) .hfp_rect(x, y, w, h, fill = tk$tbl_zebra, col = NA)
    .hfp_text(filas[[i]][[1]], x + 0.006, y - fila_h / 2, 7.6, tk$soft)
    .hfp_text(filas[[i]][[2]], x + w - 0.006, y - if (largo) h - fila_h / 2 + 0.002 else fila_h / 2,
              8.4, tk$ink, "bold", just = c("right", "center"))
    y <- y - h
  }
  # El ID INEI completo no entra en una fila: va debajo, en su propia línea.
  id <- as.character(block$id_manzana %||% "")
  if (nzchar(id)) {
    .hfp_text("ID INEI", x + 0.006, y - 0.012, 6.4, tk$soft, "bold", spacing = 0.6)
    .hfp_text(id, x + w - 0.006, y - 0.012, 7.4, tk$ink, just = c("right", "center"))
    y <- y - 0.024
  }
  .hfp_line(x, x + w, y, col = tk$tbl_frame, lwd = pulso_pdf_pesos()$fila)
  invisible(y)
}

#' Leyenda con sólo las capas que el mapa dibujó.
#'
#' @param capas vector lógico con nombres `limite_distrital`, `otras_zonas`,
#'   `sin_poblacion`, `parque`; las que faltan se toman como FALSE. «Manzana
#'   asignada» y «Límite de zona» van siempre.
#' @param referencias tipos de referencia dibujados (hojas_ruta_mapa_referencias.R).
#' @keywords internal
.hojas_ruta_mapa_leyenda <- function(capas, x, w, top, referencias = character(0), tk = pulso_pdf_tokens()) {
  capa <- function(n) isTRUE(capas[n][[1]])
  .hojas_ruta_mapa_rotulo("Leyenda", x, top, w, tk)
  ix <- x + 0.006
  tx <- x + 0.03
  caja <- function(y, fill, col, lwd = 0.6, trama = NULL) {
    grid::grid.rect(x = ix, y = y, width = 0.016, height = 0.016 * .hojas_ruta_mapa_aspecto,
                    just = c("left", "center"), gp = grid::gpar(fill = fill, col = col, lwd = lwd))
    if (!is.null(trama)) {
      for (k in 0:3) {
        grid::grid.lines(x = c(ix + 0.001 + k * 0.004, ix + 0.005 + k * 0.004),
                         y = c(y - 0.009, y + 0.009), gp = grid::gpar(col = trama, lwd = 0.3))
      }
    }
  }
  linea <- function(y, col, lwd) grid::grid.lines(x = c(ix, ix + 0.016), y = c(y, y),
                                                 gp = grid::gpar(col = col, lwd = lwd, lineend = "round"))
  items <- list(
    list("Manzana asignada", function(y) caja(y, "#cfe8ff", "#003f88", 1.2)),
    list("Límite de zona", function(y) linea(y, "#083f88", 1.9))
  )
  if (capa("limite_distrital")) items <- c(items, list(list("Límite distrital", function(y) linea(y, "#111111", 0.95))))
  if (capa("otras_zonas")) items <- c(items, list(list("Otras zonas INEI", function(y) linea(y, "#d7191c", 0.75))))
  if (capa("sin_poblacion")) items <- c(items, list(list("Sin población", function(y) caja(y, "#f1f1f1", "#9a9a9a", 0.4, "#9a9a9a"))))
  if (capa("parque")) items <- c(items, list(list("Parque, plaza o agua", function(y) caja(y, "#edf7e9", "#7fae73", 0.4, "#62a65a"))))
  for (tipo in intersect(names(.hojas_ruta_mapa_referencia_tipos), referencias)) {
    items <- c(items, list(list(.hojas_ruta_mapa_referencia_rotulos[[tipo]],
                                local({ tt <- tipo; function(y) .hojas_ruta_mapa_icono(tt, ix + 0.008, y, r_pt = 4.6) }))))
  }
  y <- top - 0.032
  for (it in items) {
    it[[2]](y)
    .hfp_text(it[[1]], tx, y, 7.6, tk$ink)
    y <- y - 0.026
  }
  invisible(y)
}

#' Pie de la cara 2: el mismo de la cara 1 (logo · ruta · fecha).
#' @keywords internal
.hojas_ruta_mapa_pie <- function(block, tk = pulso_pdf_tokens()) {
  L <- 0.035
  R <- 0.97
  .hfp_line(L, R, 0.052, col = tk$line, lwd = 0.7)
  logo <- .hojas_ruta_ficha_png(.pulso_pdf_logo_path())
  if (!is.null(logo)) {
    # Alto acotado bajo la regla del pie (0,052), con aire: el logo de contorno
    # la cruzaba al ancho de siempre.
    med <- .pulso_pdf_logo_medidas(logo, 0.075, .hojas_ruta_mapa_aspecto, alto_max = 0.036)
    lw <- med$ancho; lh <- med$alto
    grid::grid.raster(logo, x = L, y = 0.027, width = lw, height = lh, just = c("left", "center"),
                      interpolate = TRUE)
  } else {
    .hfp_text("PULSO PUCP", L, 0.03, 8.5, tk$navy, "bold")
  }
  centro <- paste(Filter(nzchar, c(.hojas_ruta_operational_code(block), .hojas_ruta_mapa_encuestas(block))),
                  collapse = "  ·  ")
  .hfp_text(centro, 0.5, 0.03, 8, tk$soft, just = c("center", "center"))
  .hfp_text(format(Sys.Date(), "%d/%m/%Y"), R, 0.03, 8, tk$soft, just = c("right", "center"))
  invisible(TRUE)
}

# ---------- Textos sobre el mapa ----------

#' Textos con halo blanco, en una sola llamada por pasada.
#'
#' Los nombres de calle, los números de manzana y el de la zona se montaban
#' sobre líneas y rellenos y se leían a medias. El halo —el mismo texto en
#' blanco corrido ocho veces `halo_pt` alrededor— los despega de lo que hay
#' debajo. Vectorizado: nueve llamadas por capa, no nueve por etiqueta.
#' @keywords internal
.hojas_ruta_mapa_textos <- function(label, x, y, rot = 0, size = 6, face = "plain", col = "#111111",
                                    halo_pt = 0.8) {
  if (!length(label)) return(invisible(FALSE))
  n <- length(label)
  rep_n <- function(v) if (length(v) == 1L) rep(v, n) else v
  rot <- rep_n(rot); size <- rep_n(size); face <- rep_n(face); col <- rep_n(col)
  if (halo_pt > 0) {
    ang <- seq(0, 2 * pi, length.out = 9)[-9]
    for (a in ang) {
      grid::grid.text(label, x = grid::unit(x, "npc") + grid::unit(cos(a) * halo_pt, "pt"),
                      y = grid::unit(y, "npc") + grid::unit(sin(a) * halo_pt, "pt"), rot = rot,
                      gp = grid::gpar(fontsize = size, fontface = face, col = "#ffffff"))
    }
  }
  grid::grid.text(label, x = x, y = y, rot = rot, gp = grid::gpar(fontsize = size, fontface = face, col = col))
  invisible(TRUE)
}

#' Números de zona: el de la UMP en navy y grande, los vecinos en gris, todos
#' con halo y dibujados al final para que nada los tape. Si el número de la
#' zona cae sobre la manzana asignada, se corre al punto libre de la zona más
#' cercano a su centro.
#'
#' @param seleccion caja proyectada de la manzana asignada (`x0, x1, y0, y1`) o NULL.
#' @keywords internal
.hojas_ruta_mapa_rotulos_zona <- function(zone_outlines, zona_actual, project, seleccion = NULL,
                                          tk = pulso_pdf_tokens()) {
  for (zone in zone_outlines) {
    center <- .hojas_ruta_pdf_projected_center(zone$rings, project)
    if (is.null(center) || center[["x"]] < 0.04 || center[["x"]] > 0.96 ||
        center[["y"]] < 0.04 || center[["y"]] > 0.96) next
    actual <- identical(as.character(zone$zona %||% ""), as.character(zona_actual %||% ""))
    cx <- center[["x"]]
    cy <- center[["y"]]
    if (actual && !is.null(seleccion)) {
      libre <- .hojas_ruta_mapa_punto_libre(zone$rings, project, c(cx, cy), seleccion)
      if (!is.null(libre)) { cx <- libre[[1]]; cy <- libre[[2]] }
    }
    .hojas_ruta_mapa_textos(as.character(zone$zona %||% ""), cx, cy,
                            size = if (actual) 17 else 11, face = "bold",
                            col = if (actual) tk$navy else tk$faint, halo_pt = if (actual) 1.6 else 1.1)
  }
  invisible(TRUE)
}

# Punto dentro de la zona, fuera de la manzana asignada (con margen para el
# número) y lejos del borde del mapa, lo más cerca posible de `centro`. NULL si
# el centro ya está libre o no hay otro lugar.
.hojas_ruta_mapa_punto_libre <- function(rings, project, centro, seleccion, mx = 0.055, my = 0.03) {
  libre <- function(x, y) {
    !(x > seleccion[["x0"]] - mx & x < seleccion[["x1"]] + mx &
        y > seleccion[["y0"]] - my & y < seleccion[["y1"]] + my) &
      x > 0.06 & x < 0.94 & y > 0.05 & y < 0.95
  }
  if (libre(centro[[1]], centro[[2]])) return(NULL)
  proy <- lapply(rings, function(r) { p <- project(r); cbind(p$x, p$y) })
  todo <- do.call(rbind, proy)
  if (is.null(todo) || !nrow(todo)) return(NULL)
  gx <- seq(min(todo[, 1]), max(todo[, 1]), length.out = 24)
  gy <- seq(min(todo[, 2]), max(todo[, 2]), length.out = 24)
  cand <- expand.grid(x = gx, y = gy)
  ok <- .hojas_ruta_mapa_dentro(cand$x, cand$y, proy) & libre(cand$x, cand$y)
  if (!any(ok)) return(NULL)
  cand <- cand[ok, , drop = FALSE]
  i <- which.min((cand$x - centro[[1]])^2 + (cand$y - centro[[2]])^2)
  c(cand$x[[i]], cand$y[[i]])
}
