# Compatibilidad de valores viejos que el catálogo del radar llegó a ofrecer.
#
# Hasta 2026-10 el preset `radar_tabla` ofrecía en «Escala de valores» el valor
# `porcentaje_100`, que `graficar_radar()` nunca aceptó: su `match.arg` solo
# conoce `proporcion_1` (0 a 1) y `proporcion_100` (0 a 100). Elegirlo en la UI
# reventaba con «'arg' should be one of …». Lo mismo pasaba con la posición de
# leyenda `arriba`, que el radar no sabe dibujar.
#
# El catálogo ya ofrece solo lo que el motor acepta; esto existe para que un
# plan o un `.pulso` guardado con el valor viejo siga renderizando en vez de
# romperse. Se normaliza en la entrada del motor y no en la UI porque todos los
# caminos (PPT, Word, preview, dashboard) terminan en `graficar_radar()`.

# `porcentaje_100` significaba lo mismo que `proporcion_100`: valores de 0 a
# 100 (su hint decía «Los valores van de 0 a 100»).
.radar_escala_valor_compat <- function(escala_valor) {
  if (is.character(escala_valor) && length(escala_valor) == 1L &&
      identical(escala_valor, "porcentaje_100")) {
    return("proporcion_100")
  }
  escala_valor
}

# El radar coloca la leyenda abajo o a la derecha. `arriba` se ofrecía sin que
# el motor lo dibujara; el lugar más cercano que sí dibuja es abajo.
.radar_leyenda_posicion_compat <- function(leyenda_posicion) {
  if (is.character(leyenda_posicion) && length(leyenda_posicion) == 1L &&
      identical(leyenda_posicion, "arriba")) {
    return("abajo")
  }
  leyenda_posicion
}
