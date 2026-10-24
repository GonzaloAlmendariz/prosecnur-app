# lamina_titulo_lienzo.R — el título que un gráfico de lienzo dibuja dentro de sí, frente al encabezado de su lámina o panel.
#
# Los graficadores de lienzo (`cowplot::ggdraw`, p. ej. `graficar_barras_agrupadas(usar_canvas = TRUE)`) dibujan su título y su
# subtítulo como capas de texto (`cowplot::draw_text`): `labs(title = NULL)` no los quita.
#  - G6/P4 (checklist-motor-ppt-ccss-2026-10-24): en un panel de lámina mixta por la ruta de respaldo el enunciado salía dos veces,
#    en el encabezado del panel y dentro del dibujo. El panel tiene un solo encabezado: el suyo.
#  - P2 (CCSS lámina 37): a lámina completa el título del lienzo va centrado en el borde superior del cajón (la mitad sobresale) y
#    con un título de lámina de dos líneas quedaba pegado a él. Con el marco estándar se suprime si repite el título o el subtítulo
#    de la lámina y, si dice otra cosa, el cajón baja lo que sobresale (`.lam_respaldo_cajon`).
# El graficador marca sus capas de encabezado con un nombre (`pulso_encabezado:titulo|subtitulo`); un lienzo sin marcas pierde
# sólo el texto que repite el encabezado. Cifras, orden y colores no se tocan.

#' Nombra la última capa del lienzo como capa de encabezado (`pulso_encabezado:<rol>`)
#' @keywords internal
.lienzo_marcar_ultima <- function(g, rol) {
  n <- length(g$layers)
  if (!n) return(g)
  nm <- names(g$layers) %||% rep("", n)
  nm[n] <- paste0("pulso_encabezado:", rol)
  names(g$layers) <- nm
  g
}

.lienzo_norm <- function(x) {
  x <- tolower(gsub("\\s+", " ", trimws(as.character(x %||% ""))))
  sub("[[:space:][:punct:]]+$", "", x)
}

.lienzo_es_lienzo <- function(g) {
  lim <- tryCatch(g$coordinates$limits$y, error = function(e) NULL)
  inherits(g, "ggplot") && length(g$layers) && isTRUE(all.equal(as.numeric(lim), c(0, 1)))
}

.lienzo_texto_capa <- function(l) {
  if (!inherits(l$geom, "GeomText") || !is.data.frame(l$data)) return(NA_character_)
  t <- l$data$text %||% l$data$label
  if (length(t) != 1L) NA_character_ else as.character(t)
}

#' El lienzo sin sus capas de encabezado
#'
#' @param roles Capas marcadas que se quitan.
#' @param textos Además, en un lienzo sin marcas, las capas de texto que repiten alguno de estos textos (normalizados).
#' @return El mismo gráfico con esas capas fuera; si no es un lienzo o no hay qué quitar, el original.
#' @keywords internal
.lienzo_sin_encabezado <- function(g, roles = c("titulo", "subtitulo"), textos = NULL) {
  if (!.lienzo_es_lienzo(g)) return(g)
  nm <- names(g$layers) %||% rep("", length(g$layers))
  fuera <- nm %in% paste0("pulso_encabezado:", roles)
  textos <- as.character(unlist(textos %||% character(0)))
  tx <- .lienzo_norm(textos[!is.na(textos) & nzchar(trimws(textos))])
  tx <- tx[!is.na(tx) & nzchar(tx)]
  if (length(tx)) fuera <- fuera | vapply(g$layers, function(l) { t <- .lienzo_texto_capa(l); !is.na(t) && .lienzo_norm(t) %in% tx }, TRUE)
  if (!any(fuera)) return(g)
  g$layers <- g$layers[!fuera]
  g
}

#' Lo que las capas de texto del lienzo sobresalen por arriba de su cajón (in)
#' @param h_in Alto del cajón donde se dibuja el lienzo.
#' @keywords internal
.lienzo_desborde_superior_in <- function(g, h_in) {
  h <- suppressWarnings(as.numeric(h_in)[1])
  if (!.lienzo_es_lienzo(g) || !is.finite(h) || h <= 0) return(0)
  tops <- vapply(g$layers, function(l) {
    if (is.na(.lienzo_texto_capa(l))) return(-Inf)
    y <- suppressWarnings(as.numeric(l$data$y)[1]); vj <- suppressWarnings(as.numeric(l$aes_params$vjust %||% 0.5)[1])
    pt <- suppressWarnings(as.numeric(l$aes_params$size %||% 3.88)[1]) * ggplot2::.pt
    if (!is.finite(y) || !is.finite(vj) || !is.finite(pt)) return(-Inf)
    y * h + (1 - vj) * pt / 72
  }, 0)
  max(0, max(tops, -Inf) - h)
}

#' P2: con el marco estándar, el título del lienzo que repite el título o el subtítulo de la lámina se suprime
#' @param m Marco de `.lam_respaldo_marco`.
#' @keywords internal
.lam_respaldo_grafico <- function(p, m) {
  if (!isTRUE(m$activo) || !.lienzo_es_lienzo(p)) return(p)
  nm <- names(p$layers) %||% rep("", length(p$layers))
  k <- which(nm == "pulso_encabezado:titulo")
  if (length(k) != 1L) return(p)
  t <- .lienzo_norm(.lienzo_texto_capa(p$layers[[k]]))
  if (t %in% .lienzo_norm(c(m$titulo, m$sub))) .lienzo_sin_encabezado(p, roles = "titulo") else p
}

#' G6/P4/A12: el panel de composición que no cabe en pieza nativa se vuelve a dibujar sin título, subtítulo ni nota (el panel
#' tiene su encabezado y la lámina su base) y con el alto real de su cajón
#' @param alto Alto del cajón (in) o `NULL`.
#' @keywords internal
.lam_respaldo_el_sin_encabezado <- function(el, alto = NULL) {
  el$overrides <- el$overrides %||% list()
  el$overrides$titulo <- ""; el$overrides$subtitulo <- ""; el$overrides$nota_pie <- ""
  a <- suppressWarnings(as.numeric(alto)[1])
  if (length(a) && is.finite(a) && a > 0 && is.null(el$overrides$alto)) el$overrides$alto <- a
  el
}

#' A12: ¿los rótulos de una agrupada de lienzo, como se dibujaron, se montan en la fila del cajón real?
#'
#' Se mide con lo que el graficador dejó en su `pulso_barras_agrupadas_layout` (cuerpo, envoltorio y proporción del panel) contra
#' la fila que tendrá en el cajón real. Un gráfico que no es agrupada de lienzo no se toca.
#' @keywords internal
.lam_respaldo_rotulos_solapan <- function(p, alto) {
  ly <- if (!is.null(p)) attr(p, "pulso_barras_agrupadas_layout", exact = TRUE)
  a <- suppressWarnings(as.numeric(alto)[1])
  rot <- (attr(p, "pulso_espec", exact = TRUE) %||% list())$rotulos
  if (is.null(ly) || !length(a) || !is.finite(a) || a <= 0 || !length(rot)) return(FALSE)
  n <- suppressWarnings(as.integer(ly$n_categorias)[1]); s <- suppressWarnings(as.numeric(ly$size_ejes_eff)[1])
  if (!is.finite(n) || is.na(n) || n <= 0 || !is.finite(s)) return(FALSE)
  lin <- .agrupadas_lineas_eje(rot, ly$ancho_max_eje_y_eff)
  # La fila real: el lienzo se escala al cajón y su panel (menos la fila superior) ocupa h_panel / h_total de él.
  ht <- suppressWarnings(as.numeric(ly$h_total_in)[1]); hp <- suppressWarnings(as.numeric(ly$h_panel_in)[1])
  hs <- suppressWarnings(as.numeric(ly$h_top_in %||% 0)[1])
  frac <- if (length(ht) && length(hp) && is.finite(ht) && is.finite(hp) && ht > 0 && hp > 0) (hp - (if (is.finite(hs)) hs else 0)) / ht else 0.62
  lin * s * 1.2 / 72 > a * frac / n + 1e-9
}
