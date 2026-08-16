# La guia de canvas, dibujada como un plano y no como un subrayador.
#
# La guia servia para ver DONDE cae cada hueco. El problema es que no decia
# CUANTO mide ninguno, asi que para responder «este canal tiene 1.4 in o 1.9?»
# habia que exportar, abrir el XML y medir en EMU. Y encendida tapaba lo que se
# queria ver: 978 bordes magenta de 0.6 de grosor sobre 48 laminas escondieron el
# hallazgo de los tamanos de letra durante una comparacion de color entera.
#
# Un plano arquitectonico resuelve las dos cosas a la vez, y por eso se copia su
# convencion:
#
# - **Linea fina y fria.** 0.25 de grosor en cian apagado. Se ve contra el
#   blanco del canvas y contra el azul institucional, y no compite con el dato:
#   la guia es el papel milimetrado, no el dibujo.
# - **Cada caja lleva su cota.** El ancho y el alto en pulgadas, escritos en la
#   propia caja. Medir deja de exigir herramientas.
# - **Sin relleno.** Un relleno, por transparente que sea, altera el color de lo
#   que hay debajo, y el color es justo una de las cosas que se auditan.
#
# La cota va DENTRO de la caja y no fuera con lineas de extension: fuera se
# solaparia con la caja vecina —los huecos de una lamina son contiguos— y el
# plano se volveria ilegible justo donde mas junto esta.

# Cian apagado: visible sobre blanco y sobre el azul institucional, sin ser el
# magenta que se comia la lamina.
.GUIA_COL <- "#0FA3B1"

# Fino de verdad. El grosor anterior (0.6) pintaba una banda, no una linea.
.GUIA_LWD <- 0.25

# La cota tiene que leerse al hacer zoom, no a tamano completo: es una anotacion
# de trabajo, no un rotulo de la lamina.
.GUIA_SIZE_COTA <- 4.6

# Caja minima que puede llevar cota escrita, en pulgadas. Por debajo se dibuja
# solo el marco: la cota de una caja de dos decimas se monta sobre la del hueco
# de al lado y las dos dejan de leerse.
.GUIA_MIN_W_COTA <- 0.90
.GUIA_MIN_H_COTA <- 0.16


#' Formatea una cota en pulgadas
#'
#' Dos decimales: con uno, dos huecos que difieren en 0.04 in se leen iguales, y
#' esa diferencia es la que suele explicar por que un texto no cabe.
#'
#' @keywords internal
.guia_cota <- function(w_in, h_in) {
  if (!is.finite(w_in) || !is.finite(h_in)) return("")
  sprintf("%.2f × %.2f", w_in, h_in)
}


#' Grobs de una caja del plano: su marco y su cota
#'
#' @param x,y,w,h Geometria de la caja en npc.
#' @param ancho_in,alto_in Tamano del canvas en pulgadas, para convertir.
#' @param etiqueta Nombre del hueco; se antepone a la cota cuando se da.
#' @param col,lwd Color y grosor de la linea.
#' @param size_cota Cuerpo de la cota.
#'
#' @return Lista de grobs lista para `cowplot::draw_grob()`.
#' @keywords internal
.guia_ph_grobs <- function(x, y, w, h, ancho_in = NA_real_, alto_in = NA_real_,
                           etiqueta = NULL, col = .GUIA_COL, lwd = .GUIA_LWD,
                           size_cota = .GUIA_SIZE_COTA) {
  marco <- grid::rectGrob(
    x = 0, y = 0, width = 1, height = 1,
    just = c("left", "bottom"),
    gp = grid::gpar(col = col, fill = NA, lwd = lwd)
  )

  w_in <- w * ancho_in
  h_in <- h * alto_in
  cota <- .guia_cota(w_in, h_in)
  if (!nzchar(cota)) return(list(marco))

  # Una caja que no puede contener su cota se queda sin ella. Los huecos de una
  # lamina son contiguos y varios miden decimas de pulgada: escribirles la cota
  # igual la superpone con la del vecino y el resultado —«02006×0028»— no se
  # lee ni dice nada. El marco solo ya ubica la caja; la medida se saca de la
  # caja grande que la contiene.
  if (!is.finite(w_in) || !is.finite(h_in) ||
      w_in < .GUIA_MIN_W_COTA || h_in < .GUIA_MIN_H_COTA) {
    return(list(marco))
  }

  texto <- if (!is.null(etiqueta) && nzchar(etiqueta)) {
    paste0(etiqueta, "  ", cota)
  } else {
    cota
  }

  # Arriba a la izquierda y pegada al marco: es la esquina que menos ocupan los
  # datos —las barras arrancan mas abajo y las etiquetas de eje van al otro
  # lado— y deja la caja libre para lo que se esta auditando.
  rotulo <- grid::textGrob(
    label = texto,
    x = grid::unit(0.012, "npc"), y = grid::unit(0.985, "npc"),
    just = c("left", "top"),
    gp = grid::gpar(col = col, fontsize = size_cota, fontface = "plain")
  )

  list(marco, rotulo)
}
