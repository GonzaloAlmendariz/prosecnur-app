# lamina_indice_filas.R — filas del índice del recetario cuando un capítulo no cabe en una línea.
#
# El índice nativo (lamina_identidad.R, `.lam_laminas_indice`) dibujaba cada capítulo en una sola línea y, si alguno no
# cabía, toda la lámina caía al índice antiguo de la plantilla (bombillas). Los títulos reales de un informe de
# acreditación son largos y en mayúsculas («ESTRUCTURA ORGANIZACIONAL, ADMINISTRATIVA Y FINANCIERA»), así que ningún
# índice real entraba. Aquí cada capítulo puede ocupar dos líneas: se prueba el tamaño de letra del recetario y, si la
# columna no alcanza, dos escalones menores; las filas de dos líneas son más altas que las de una.

#' Tamaño y alto de cada fila del índice sin subcapítulos, o `NULL` si ni a 10.5 pt cabe
#' @param caps Títulos de los capítulos.
#' @param G Geometría de `.lam_indice_geo()` (sin subcapítulos).
#' @return `list(fs, lineas, alto)`: tamaño en pt, líneas por capítulo y alto de cada fila en pulgadas.
#' @keywords internal
.lam_indice_filas <- function(caps, G) {
  W <- .std_geom("ancho"); mr <- .std_geom("margen_der"); xl <- 6.75
  ancho <- W - mr - (xl + G$dx + G$di + 0.25) + 0.1   # el ancho del cuadro de texto del capítulo
  alto_total <- 6.95 - 1.75
  for (fs in unique(c(G$fs, 11.5, 10.5))) {
    # La tinta (no el ancho promedio) decide: es la misma vara con la que el índice decidía si cabía en una línea.
    lineas <- pmax(1, ceiling(.lam_ancho_tinta(caps, fs, G$negrita) / (ancho - 0.2)))
    if (any(lineas > 2)) next
    linea <- fs * 1.2 / 72
    # Una fila de una línea conserva el aire del recetario (hasta su `rh`); la de dos suma una línea.
    h1 <- min(G$rh, max(linea + 0.16, alto_total / length(caps)))
    alto <- ifelse(lineas > 1, h1 + linea, h1)
    if (sum(alto) <= alto_total + 1e-6) return(list(fs = fs, lineas = lineas, alto = alto))
  }
  NULL
}
