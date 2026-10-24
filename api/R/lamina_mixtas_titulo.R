# lamina_mixtas_titulo.R — CCSS-25: el título de la lámina mixta no se monta sobre los encabezados de sus paneles.
#
# CCSS Perfil 2026, lámina 12 (grilla de seis): un título de TRES líneas terminaba en ~1.67 in y los paneles empiezan en la zona de
# datos (1.60–1.65 in): la tercera línea se montaba sobre «Quiénes lo criaron». La geometría de las mixtas es fija; aquí, si el
# bloque de título (con su subtítulo) baja más que el primer panel, los paneles y sus filetes bajan y se comprimen en el alto que
# queda hasta el fin del contenido. Con títulos de una o dos líneas nada cambia. Si la compresión pasa del 15 %, se avisa.

#' Geometría de una lámina mixta bajo su bloque de título
#'
#' @param geo Resultado de `.lam_mixta_geo()`.
#' @param titulo,sub Título y subtítulo de la lámina.
#' @param aire Separación mínima entre el fin del bloque de título y el primer panel (in).
#' @return `geo` igual si cabe; si no, con `paneles` y `filetes` corridos y comprimidos en vertical.
#' @keywords internal
.lam_mixta_geo_bajo_titulo <- function(geo, titulo, sub = NULL, aire = NULL) {
  if (is.null(geo) || !length(geo$paneles)) return(geo)
  hay_sub <- !is.null(sub) && length(sub) && !is.na(sub[1]) && nzchar(trimws(sub[1]))
  aire <- aire %||% (if (hay_sub) 0 else 0.08)
  y0 <- min(vapply(geo$paneles, function(p) p$y, 0))
  y1 <- .std_geom("contenido_y1")
  necesita <- .lam_titulo_fin(titulo, sub) + aire
  if (necesita <= y0 + 1e-9 || y1 <= necesita) return(geo)
  k <- (y1 - necesita) / (y1 - y0)
  ty <- function(y) necesita + (y - y0) * k
  geo$paneles <- lapply(geo$paneles, function(p) { p$y <- ty(p$y); p$h <- p$h * k; p })
  geo$filetes <- lapply(geo$filetes, function(f) {
    if (identical(f$tipo, "v")) { f$y0 <- ty(f$y0); f$y1 <- ty(f$y1) } else f$y <- ty(f$y)
    f
  })
  if (k < 0.85) {
    .pulso_aviso("El título «", substr(trimws(as.character(titulo)[1]), 1, 60), "…» ocupa tanto alto que los paneles de su lámina ",
                 "se comprimen ", round(100 * (1 - k)), " %: conviene acortarlo a dos líneas.")
  }
  geo
}
