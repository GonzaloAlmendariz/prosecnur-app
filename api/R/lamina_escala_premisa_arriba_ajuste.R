# lamina_escala_premisa_arriba_ajuste.R — barra más gruesa, menos aire y leyenda en el ancho libre (premisa encima)
#
# Revisión del PPT v7.25 de CCSS, lámina 31 (IA generativa, ítem 4). Gonzalo: «las barras son demasiado delgadas y tiene
# un poco de separación exagerada, y la leyenda podría ocupar dos líneas si se estirara algo más».
#
#   - El alto que sobra va primero al grosor de la barra (hasta `.LAM_ARRIBA$grosor_max`) y sólo después al aire entre
#     bloques, que no pasa de `.LAM_ARRIBA_GAP_PREF` mientras la barra pueda engrosar.
#   - La leyenda, centrada bajo las barras, puede correr hacia la derecha hasta el panel de tarjetas (sin entrar en él):
#     con ese ancho seis respuestas largas caben en dos filas en vez de tres, y la fila que se ahorra va a las barras.
#
# Y el mando `premisa_posicion` de la multiapilada (auto, arriba, izquierda): «auto» es lo de siempre (encima cuando la
# batería lleva tarjetas), «arriba» la pone encima también sin tarjetas y «izquierda» conserva la columna de premisas.

.LAM_ARRIBA_GAP_PREF <- 0.16   # aire entre bloques mientras la barra aún pueda engrosar (in)
.LAM_ARRIBA_LEYENDA_AIRE <- 0.2  # de la leyenda al panel de tarjetas (in)

#' Grosor y aire de la batería con la premisa encima: el alto libre engrosa la barra antes de separar los bloques
#' @param fijo Función del grosor que da el alto sin el aire entre bloques.
#' @return `list(g, gap)`.
#' @keywords internal
.lam_escala_arriba_grosor <- function(g, gap, n, disp, fijo) {
  if (n < 2L || gap <= .LAM_ARRIBA_GAP_PREF) return(list(g = g, gap = gap))
  libre <- disp - fijo(g) - .LAM_ARRIBA_GAP_PREF * (n - 1)
  if (libre <= 0) return(list(g = g, gap = gap))
  g2 <- min(.LAM_ARRIBA$grosor_max, g + libre / n)
  gap2 <- min(.LAM_ARRIBA$gap_max, max(.LAM_ARRIBA$gap_min, (disp - fijo(g2)) / (n - 1)))
  list(g = g2, gap = gap2)
}

#' Plan de la leyenda bajo las barras: centrada en ellas o, si así pide más filas, en el ancho hasta el panel
#' @return `list(plan, x0, x1)`.
#' @keywords internal
.lam_escala_arriba_leyenda <- function(labels, centro) {
  ml <- .std_geom("margen_izq"); fin <- .lam_leyenda_fin()
  plan <- .lam_leyenda_plan_lamina(labels, centro)
  x1 <- fin - .LAM_ARRIBA_LEYENDA_AIRE
  if (length(plan$filas) > 1L && x1 > ml) {
    ancho <- .lam_leyenda_plan(labels, x1 - ml)
    if (length(ancho$filas) < length(plan$filas)) return(list(plan = ancho, x0 = ml, x1 = x1))
  }
  list(plan = plan, x0 = ml, x1 = fin)
}

#' Dibuja la leyenda de la batería con la premisa encima (como `.lam_leyenda`, con el plan de `.lam_escala_arriba_leyenda`)
#' @keywords internal
.lam_escala_arriba_leyenda_dibujar <- function(lz, y, labels, cols, centro) {
  ly <- .lam_escala_arriba_leyenda(labels, centro)
  .leyenda_avisar(ly$plan)
  k <- length(ly$plan$filas)
  if (k > 1L) y <- min(y, .std_geom("base_y") - getOption("prosecnur.lam_reserva_pie", 0) - 0.02 - 0.3 * k)
  .lam_leyenda_dibujar(lz, ly$plan, y, labels, cols, centro, ly$x0, ly$x1)
  invisible(lz)
}

#' Posición de la premisa pedida en la espec: «auto», «arriba» o «izquierda»
#' @keywords internal
.lam_premisa_posicion <- function(espec) {
  v <- as.character(unlist((espec %||% list())$premisa_posicion %||% "auto"))[1]
  if (is.na(v) || !v %in% c("auto", "arriba", "izquierda")) "auto" else v
}
