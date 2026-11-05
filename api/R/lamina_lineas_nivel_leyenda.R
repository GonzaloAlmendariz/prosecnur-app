# =============================================================================
# lamina_lineas_nivel_leyenda.R — la leyenda de la línea por nivel: series a la derecha y símbolos al pie
# =============================================================================
#
# Revisión del PPT v7.23 de CCSS, lámina 42 (ítem 10). Gonzalo: «la leyenda como ya quedamos en mil ocasiones va a la
# derecha del gráfico, no al lado del último eje de la línea». Deshace el etiquetado directo de la v7.11 (lámina 45):
#
#   - a la derecha del área de las líneas, en el panel lateral, una entrada por serie: su muestra (tramo de línea con su
#     punto, en el color de la serie), el rótulo en ese color, su parte del total en gris («35% en el total», el mismo
#     número de la franja de arriba: es lo que ata la serie de abajo con su parte de la franja) y, si la hay, el chip de
#     la tendencia;
#   - el chip dice que la tendencia es significativa («Crece significativamente con el nivel»): sale sólo si
#     `.sig_tendencia` la prueba con la regla del estudio (graficos_lineas_nivel.R);
#   - al pie del gráfico, la leyenda de los símbolos: ▲▼ mayor o menor que el resto de niveles, 99% y 95% de confianza y
#     el chip de la tendencia. Sólo lo que la lámina usa.

#' Ítems del panel lateral: una entrada por serie, de la que termina más arriba a la que termina más abajo
#' @param tope_y Borde superior del panel (todas las entradas se apilan desde ahí, en el orden devuelto).
#' @keywords internal
.lam_ln_leyenda_items <- function(espec, tope_y) {
  S <- espec$series; K <- nrow(espec$niveles)
  if (!length(S)) return(list())
  ult <- vapply(S, function(s) s$puntos$p[K], numeric(1))
  lapply(S[order(-ult)], function(s) {
    list(rotulo = s$rotulo, color = s$color, y = tope_y, chip = s$tendencia, muestra = s$color,
         nota = if (is.finite(s$total %||% NA_real_)) paste(.tarjetas_pct(s$total), "en el total") else NULL)
  })
}

#' Alto de una entrada de la leyenda de series
#' @keywords internal
.lam_ln_leyenda_alto <- function(it, w) {
  n <- length(.lam_tyc_envolver(it$rotulo, w - .LAM_LN_LEY_SANGRIA, 12, TRUE))
  n * 12 * 1.2 / 72 + (if (is.null(it$nota)) 0 else 0.19) + (if (is.null(it$chip)) 0 else 0.33)
}

.LAM_LN_LEY_SANGRIA <- 0.42   # la muestra de la serie ocupa este ancho a la izquierda del rótulo (in)

#' Dibuja una entrada de la leyenda de series desde `y` (borde superior)
#' @keywords internal
.lam_ln_leyenda_entrada <- function(lz, it, x, y, w) {
  s <- .LAM_LN_LEY_SANGRIA; lh <- 12 * 1.2 / 72
  lin <- .lam_tyc_envolver(it$rotulo, w - s, 12, TRUE)
  ym <- y + lh / 2
  .lam_ln_linea(lz, x, ym, x + 0.3, ym, it$muestra, pt = 2.6, nombre = "leyenda:serie:muestra")
  .lam_ln_circulo(lz, x + 0.15, ym, 0.06, it$muestra, borde = .std_color("tarjeta_fondo"), pt = 1.2, nombre = "leyenda:serie:muestra")
  for (l in lin) { .lam_tyc_txt(lz, l, x + s, y + lh / 2, w - s, 12, it$color, bold = TRUE, nombre = "panel:serie"); y <- y + lh }
  if (!is.null(it$nota)) {
    .lam_tyc_txt(lz, it$nota, x + s, y + 0.08, w - s, 9.5, .std_color("texto_suave"), nombre = "panel:serie:total")
    y <- y + 0.19
  }
  if (!is.null(it$chip)) .lam_ln_chip(lz, x + s, y + 0.06 + 0.115, it$chip)
  invisible(y)
}

#' Leyenda de los símbolos al pie del gráfico, en una línea desde `x`; sólo los que la lámina usa
#' @return Ancho usado (in); 0 si no hay nada que explicar.
#' @keywords internal
.lam_ln_leyenda_simbolos <- function(lz, espec, x, yc, regla = NULL, pt = 9) {
  S <- espec$series %||% list()
  dirs <- unlist(lapply(S, function(s) s$puntos$dir)); fr <- unlist(lapply(S, function(s) s$puntos$fragil[!is.na(s$puntos$dir)]))
  chips <- Filter(Negate(is.null), lapply(S, `[[`, "tendencia"))
  marcas <- any(!is.na(dirs))
  if (!marcas && !length(chips)) return(0)
  suave <- .std_color("texto_suave"); a <- 0.1 * 1.15; x0 <- x
  item <- function(w_icono, texto) {
    .lam_tyc_txt(lz, texto, x + w_icono + 0.07, yc, .lam_ancho_tinta(texto, pt) + 0.04, pt, suave, nombre = "leyenda:texto")
    x <<- x + w_icono + 0.07 + .lam_ancho_tinta(texto, pt) + 0.4
  }
  if (marcas) {
    .lam_tarjeta_triangulo(lz, x, yc, "up", FALSE, alto = 0.1); item(a, "Mayor que el resto de niveles")
    .lam_tarjeta_triangulo(lz, x, yc, "down", FALSE, alto = 0.1); item(a, "Menor que el resto de niveles")
  }
  if (marcas || length(chips)) {
    conf_99 <- any(!fr) || any(!vapply(chips, function(t) isTRUE(t$fragil), logical(1)))
    conf_95 <- any(fr) || any(vapply(chips, function(t) isTRUE(t$fragil), logical(1)))
    if (conf_99) {
      .lam_tarjeta_triangulo(lz, x, yc, "up", FALSE, alto = 0.1); .lam_tarjeta_triangulo(lz, x + a + 0.03, yc, "down", FALSE, alto = 0.1)
      item(2 * a + 0.03, "99% de confianza")
    }
    if (conf_95) {
      .lam_tarjeta_triangulo(lz, x, yc, "up", TRUE, alto = 0.1); .lam_tarjeta_triangulo(lz, x + a + 0.03, yc, "down", TRUE, alto = 0.1)
      item(2 * a + 0.03, paste(if (is.null(regla)) "95%" else .tarjetas_confianza(regla), "de confianza"))
    }
  }
  if (length(chips)) {
    # Una muestra del chip, sin texto: el recuadro con su triángulo.
    w <- 0.32; h <- 0.2
    .lam_forma_borde(lz, x, yc - h / 2, w, h, fill = .std_color("tarjeta_fondo"), borde = .std_color("tarjeta_borde"), borde_pt = 0.75,
                     geom = "roundRect", radio = 0.06, nombre = "leyenda:chip")
    .lam_tarjeta_triangulo(lz, x + 0.11, yc, "up", FALSE, alto = 0.075)
    item(w, sprintf("Tendencia significativa con el %s", espec$nombre_nivel %||% "nivel"))
  }
  x - x0
}

#' Alto que la leyenda de símbolos reserva al pie del gráfico (0 si no hay símbolos)
#' @keywords internal
.lam_ln_leyenda_simbolos_alto <- function(espec) {
  S <- espec$series %||% list()
  usa <- any(!is.na(unlist(lapply(S, function(s) s$puntos$dir)))) || any(!vapply(S, function(s) is.null(s$tendencia), logical(1)))
  if (usa) 0.3 else 0
}
