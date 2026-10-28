# lamina_filtro_sub_n.R — la base del dependiente como «N = 77» encima de su barra (G16, revisión de Gabriela Palacios al
# informe de Arte, 2026-10-28: «ese n 77 ahí no se lee, es mejor que esté como estaba antes, encima de la barra»).
#
# La dicotomía partida con su escala dependiente debajo (lámina «¿Conoce el reglamento…?») decía la base del dependiente
# en gris chico bajo su premisa («Sólo los 77 que conocen el reglamento»). Contabilidad (motor antiguo, vf.pdf p. 9) la
# pone como «N = 75» en cursiva chica, sobre el extremo derecho de la barra. El pie sigue diciendo «Sólo los 77 que…».

#' «N = 77»: los casos del dependiente, o `NULL` si no se conocen
#' @keywords internal
.lam_filtro_sub_n_texto <- function(espec) {
  n <- suppressWarnings(as.numeric(espec$n_sub %||% NA)[1])
  if (!is.finite(n)) return(NULL)
  sprintf("N = %s", format(as.integer(round(n)), big.mark = ",", trim = TRUE))
}

#' Cuadro de texto de un párrafo en cursiva (el de `.lam_txt`, con `i="1"`)
#' @keywords internal
.lam_txt_cursiva <- function(lz, s, l, t, w, h, size = 12, color = .std_color("azul"), bold = FALSE,
                             align = c("left", "center", "right"), nombre = "texto") {
  .lam_txt(lz, s, l, t, w, h, size, color, bold = bold, align = align, nombre = nombre)
  k <- length(lz$formas)
  lz$formas[[k]] <- sub(' i="0" ', ' i="1" ', lz$formas[[k]], fixed = TRUE)
  invisible(lz)
}

#' «N = 77» en cursiva, alineado al extremo derecho de una barra y justo encima de ella
#'
#' Si lo dibujado desde `desde` (las cifras chicas que salen sobre la barra) ocupa ese lugar, sube por encima de ello.
#' @param x_der Extremo derecho de la barra (in); `yb` su borde superior.
#' @param desde Número de cajas del lienzo antes de dibujar la barra.
#' @keywords internal
.lam_n_encima_barra <- function(lz, texto, x_der, yb, desde = 0L, size = .std_pt("n"), color = .std_color("azul")) {
  h <- size * 1.2 / 72 + 0.1; w <- max(1, .lam_ancho_tinta(texto, size, FALSE) + 0.3)
  l <- x_der - w + 0.1; t <- yb - h + 0.02   # la caja lleva 0,1 in de margen interno: la tinta acaba en el borde de la barra
  cajas <- if (length(lz$cajas) > desde) lz$cajas[(desde + 1L):length(lz$cajas)] else list()
  pisa <- Filter(function(b) b[1] < l + w && b[3] > l && b[2] < t + h && b[4] > t && b[4] <= yb + 1e-6, cajas)
  if (length(pisa)) t <- min(vapply(pisa, `[[`, 0, 2)) - h
  .lam_txt_cursiva(lz, texto, l, t, w, h, size, color, align = "right", nombre = "filtro_sub:n")
}
