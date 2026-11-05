# lamina_barras_ancho_tinta.R — la columna de rótulos de las barras mide su tinta, y obedece el ancho declarado
#
# Revisión del PPT v7.25 de CCSS, lámina 54 (perspectivas a cinco años, ítem 8). Gonzalo: «esta extensión del eje y es
# un poco larga, puede ser igual que la siguiente; no sé qué tan configurable eso sea de cara a la UI». Con un rótulo
# largo la columna se acotaba al tope (la mitad del ancho útil con el panel de tarjetas) y quedaba de ese ancho aunque
# sus líneas, ya partidas, midieran menos. Ahora:
#   - acotada, la columna mide la línea más ancha de los rótulos partidos más su aire (nunca más que el tope);
#   - el gráfico puede declarar su ancho (`canvas_w_etiquetas`, «Espacio para etiquetas», fracción del ancho útil): con
#     el mismo valor, dos láminas vecinas del mismo tipo tienen la misma columna. Si los rótulos no caben ahí en tres
#     líneas por fila, el motor avisa y vuelve al automático.

#' Ancho de la columna con los rótulos partidos a `w`: la línea más ancha más su aire (0.3 in, como la columna natural)
#' @keywords internal
.lam_barras_ancho_tinta_partida <- function(rotulos, w, size, nb = FALSE) {
  lineas <- unlist(lapply(rotulos, function(r) .lam_tyc_envolver(r, w - 0.22, size, nb)))
  min(w, max(1.4, max(.lam_ancho_tinta(lineas, size, nb)) + 0.3))
}

#' Los rótulos en una columna de ancho fijo `w`: el cuerpo (de `size` hasta el piso) con el que caben en su fila, o NULL
#' @return `list(wlab, size)` o NULL.
#' @keywords internal
.lam_barras_ancho_en <- function(rotulos, w, size, fila, nb = FALSE) {
  U <- .LAM_BARRAS_ANCHO
  piso <- min(size, max(U$piso_pt, .std_valor("ppt", "tipografia", "cifra_minimo") %||% 8))
  for (s in unique(c(seq(size, piso, by = -0.5), piso))) {
    if (s < piso) next
    lin <- .lam_lineas_tinta(rotulos, w, s, nb)
    if (all(lin <= U$lineas) && all(.lam_alto_tinta(rotulos, w, s, nb) <= fila + 0.02) &&
        all(vapply(rotulos, function(r) .lam_alto_txt(r, w, s) <= fila + 0.02, TRUE))) return(list(wlab = w, size = s))
  }
  NULL
}
