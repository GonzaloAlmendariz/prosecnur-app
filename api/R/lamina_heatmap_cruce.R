# =============================================================================
# lamina_heatmap_cruce.R — mapa de calor nativo de "Mapa de calor por cruce" (ADR 0093, N5; ADR 0137)
# =============================================================================
#
# Portado de recetario_m3d.R: una sola escala de azul en cinco tramos que se ajusta al rango de los datos (del múltiplo
# de 5 bajo el mínimo al de encima del máximo), el texto de cada celda en el color que contrasta con su tramo y, si hay
# columna Total, bajo cada cifra su diferencia con el total en puntos.
#
# Era el plano del heatmap de dimensiones (lamina_dimensiones.R). El ADR 0137 retiró los gráficos de dimensiones y el
# plano quedó para `p_heatmap_cruce`, cuya especificación `heatmap/1` sigue declarando `tipo = "heatmap_dim"`.

#' Tramo de color de un valor en la escala de cinco tramos (recetario_m3d.R:24)
#' @keywords internal
.lam_calor <- function(v, lo, hi) {
  tramos <- unlist(.std_paleta("calor")$tramos)
  tramos[pmin(5L, pmax(1L, floor((v - lo) / (hi - lo) * 5) + 1L))]
}

#' Celda del mapa de calor: tramo, cifra y, si hay referencia y alto, la diferencia debajo (recetario_m3d.R:25-30)
#' @keywords internal
.lam_celda_calor <- function(lz, x, y, w, h, v, lo, hi, ref = NULL, v_color = v, sufijo = "%") {
  if (!is.finite(v)) {
    .lam_caja(lz, x + 0.02, y + 0.02, w - 0.04, h - 0.04, .std_color("cebra"), nombre = "calor:celda")
    .lam_txt(lz, "—", x, y + (h - 0.3) / 2, w, 0.3, 12, .std_color("texto_tenue"), align = "center", nombre = "calor:cifra")
    return(invisible(lz))
  }
  col <- .lam_calor(v_color, lo, hi); tc <- .lam_texto_sobre(col)
  .lam_caja(lz, x + 0.02, y + 0.02, w - 0.04, h - 0.04, col, nombre = "calor:celda")
  if (is.null(ref) || !is.finite(ref) || h < 0.6) {
    .lam_txt(lz, paste0(v, sufijo), x, y + (h - 0.3) / 2, w, 0.3, 12, tc, bold = TRUE, align = "center", nombre = "calor:cifra")
  } else {
    dd <- v - ref
    .lam_txt(lz, paste0(v, sufijo), x, y + h / 2 - 0.3, w, 0.3, 13, tc, bold = TRUE, align = "center", nombre = "calor:cifra")
    .lam_txt(lz, if (dd == 0) "=" else sprintf("%+d", as.integer(dd)), x, y + h / 2, w, 0.26, 10, tc, align = "center", nombre = "calor:diferencia")
  }
  invisible(lz)
}

#' Escala de cinco tramos con sus cortes debajo, centrada (recetario_m3d.R:31-37)
#' @keywords internal
.lam_escala_calor <- function(lz, centro, y, lo, hi, w = 3.6, rotulo = "Top Two Box", sufijo = "%") {
  tramos <- unlist(.std_paleta("calor")$tramos); suave <- .std_color("texto_suave")
  wr <- .lam_ancho_tinta(rotulo, 11, TRUE) + 0.3; tot <- wr + w; x <- centro - tot / 2
  .lam_txt(lz, rotulo, x - 0.1, y - 0.04, wr + 0.2, 0.3, 11, suave, bold = TRUE, nombre = "calor:escala_rotulo"); x <- x + wr
  cortes <- round(seq(lo, hi, length.out = 6))
  for (i in 1:5) .lam_caja(lz, x + (i - 1) * w / 5, y, w / 5 - 0.03, 0.2, tramos[i], nombre = "calor:escala_tramo")
  for (i in 1:6) .lam_txt(lz, paste0(cortes[i], sufijo), x + (i - 1) * w / 5 - 0.35, y + 0.22, 0.7, 0.26, 10, suave, align = "center", nombre = "calor:escala_corte")
  invisible(lz)
}

#' Lámina de un mapa de calor (lámina 92, recetario_m3d.R:43-60)
#'
#' Columna Total y grupos del cruce con su encabezado de bloque; bajo cada nombre de columna sus casos (con
#' «*» si son menos de 15); filetes azules separan el Total y los bloques; la escala va centrada debajo.
#' @param rotulo_escala Rótulo de la escala («Top Two Box» o el índice que se muestre).
#' @keywords internal
.lam_laminas_heatmap_dim <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, sub = NULL, rotulo_escala = "Índice",
                                     layout = "Graficos2", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g_ <- .std_geom; ml <- g_("margen_izq"); W <- g_("ancho"); mr <- g_("margen_der")
  yt <- g_("zona_datos_y0"); yf <- g_("contenido_y1")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  V <- espec$valores; nf <- nrow(V); nc <- ncol(V); C <- espec$columnas
  wf <- espec$ancho_filas %||% 2.75; xl <- ml + wf + 0.15; y0 <- yt + 0.85   # L10-6: columna de filas a medida
  # L10-10: la columna Top Two Box tiene su ancho propio y las de calor se reparten el resto.
  wb <- .lam_calor_box_ancho(espec); wc <- (W - mr - xl - wb) / (nc - length(espec$col_box))
  hc <- min(0.95, (yf - y0 - 1.0) / nf)
  lo <- espec$rango[1]; hi <- espec$rango[2]
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante, sub = sub)
  lz <- .lam_lienzo()
  chica <- is.finite(C$n) & C$n < 15
  dos <- isTRUE(espec$encabezado_dos_lineas)   # L10-6: opciones de una escala («Totalmente en desacuerdo») en dos líneas
  calor <- setdiff(seq_len(nc), espec$col_box)   # L10-10: la columna Top Two Box va aparte (graficos_heatmap_top2box.R)
  for (j in calor) {
    .lam_txt(lz, sub(" ciclo$", "", C$rotulo[j]), xl + (j - 1) * wc, y0 - (if (dos) 0.62 else 0.58), wc, if (dos) 0.46 else 0.26, 11, azul, bold = TRUE, align = "center", nombre = "calor:columna")
    if (is.finite(C$n[j])) .lam_txt(lz, paste0(format(round(C$n[j]), big.mark = ",", trim = TRUE), if (chica[j]) "*" else ""), xl + (j - 1) * wc, y0 - 0.33, wc, 0.24, 10,
                                    tenue, align = "center", nombre = "calor:casos")
  }
  for (b in espec$bloques) {
    .lam_txt(lz, b$titulo, xl + (min(b$cols) - 1) * wc, y0 - 0.86, length(b$cols) * wc, 0.26, 10, suave, bold = TRUE, align = "center", nombre = "calor:bloque")
  }
  for (i in seq_len(nf)) {
    yi <- y0 + (i - 1) * hc
    hf <- .lam_alto_tinta(espec$filas[i], wf, 13, TRUE)
    .lam_txt(lz, espec$filas[i], ml, yi + (hc - hf) / 2, wf, hf, 13, azul, bold = TRUE, align = "right", nombre = "calor:fila")
    for (j in calor) {
      ref <- if (!is.na(espec$col_total) && j != espec$col_total) V[i, espec$col_total] else NULL
      .lam_celda_calor(lz, xl + (j - 1) * wc, yi, wc, hc, V[i, j], lo, hi, ref, v_color = (espec$valores_crudos %||% V)[i, j])
    }
  }
  # Filetes azules tras la columna Total y entre bloques de grupos.
  cortes <- c(if (!is.na(espec$col_total)) espec$col_total, vapply(espec$bloques, function(b) max(b$cols), 0))
  for (k in setdiff(unique(cortes), nc)) .lam_caja(lz, xl + k * wc - 0.01, y0 - 0.1, 0.02, nf * hc + 0.1, azul, nombre = "calor:filete")
  .lam_calor_box(lz, espec, xl + length(calor) * wc, wb, y0, hc, dos)
  .lam_escala_calor(lz, xl + length(calor) * wc / 2, y0 + nf * hc + 0.45, lo, hi, rotulo = espec$rotulo_escala %||% rotulo_escala)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:heatmap_dim")
  # El pie del recetario explica el asterisco y la cifra de abajo (recetario_m3d.R, pie de la lámina 92).
  notas <- c(if (any(chica)) "* Menos de 15 casos.",
             if (!is.na(espec$col_total) && nc > 1L && hc >= 0.6) "Debajo de cada cifra, la diferencia con el total en puntos")
  partes <- c(if (!is.null(base) && nzchar(trimws(base))) (if (length(notas)) sub("\\.?\\s*$", ".", trimws(base)) else trimws(base)), notas)
  base <- if (length(partes)) paste(partes, collapse = " ") else base
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}

#' ¿El mapa de calor cabe en su lámina nativa? Si no, ruta anterior
#'
#' Hasta 9 columnas y 8 filas, rótulos de fila en dos líneas a 13 pt dentro de su ancho, nombres de columna en su ancho.
#' @keywords internal
.lam_heatmap_cabe <- function(espec) {
  if (!identical(espec$tipo, "heatmap_dim")) return(FALSE)
  g_ <- .std_geom; W <- g_("ancho"); ml <- g_("margen_izq"); mr <- g_("margen_der")
  dos <- function(t, w, size) all(vapply(t, function(x) .lam_lineas(x, w, size, TRUE) <= 2L, TRUE))
  wf <- espec$ancho_filas %||% 2.75; nc <- ncol(espec$valores); nf <- nrow(espec$valores); wb <- .lam_calor_box_ancho(espec)
  wc <- (W - mr - ml - wf - 0.15 - wb) / max(1L, nc - length(espec$col_box))
  hc <- min(0.95, (g_("contenido_y1") - g_("zona_datos_y0") - 0.85 - 1.0) / max(1L, nf))
  nc >= 1L && nc <= 9L && nf %in% 1:8 && all(is.finite(espec$rango)) && espec$rango[2] > espec$rango[1] &&
    dos(espec$filas, wf, 13) && all(.lam_alto_tinta(espec$filas, wf, 13, TRUE) <= hc) &&
    (if (isTRUE(espec$encabezado_dos_lineas)) dos(espec$columnas$rotulo, wc - 0.05, 11) else
      all(.lam_ancho_txt(sub(" ciclo$", "", espec$columnas$rotulo), 11, TRUE) <= wc - 0.05))
}
