# lamina_paneles_vertical_alto.R — la lámina de dos gráficos en vertical usa su alto y sus rótulos no se montan
#
# Ola 2, G1 y G2 (captura «H. 2 vertical multiapilada SIN INF», Gonzalo 2026-11-08: «cuando tenemos una lámina que todo
# tiene título y no tiene texto, los gráficos no aprovechan su alto de forma adecuada cuando podrían hacerlo»):
#
#   - G1: cada bloque reservaba 0.4 in para su pregunta aunque viniera vacía (la multiapilada por variables no la tiene:
#     sus filas son las preguntas), y la lámina dejaba ~1/5 de su alto en blanco entre el título y el primer gráfico
#     mientras el de abajo se apretaba.
#   - G2: la fila medía 0.72-0.76 in fijos y el rótulo de 1.6 in de ancho, envuelto a 11 pt, medía hasta 1.75 in: los
#     enunciados largos se montaban sobre el de la fila vecina.
#
# Regla:
#   1. El canal de rótulos crece (de 1.6 a 3 in, de 0.1 en 0.1) lo justo para que el bloque quepa; la letra no encoge.
#   2. Cada fila mide al menos su rótulo envuelto más 0.08 in: nunca dos rótulos superpuestos.
#   3. Lo que sobra engruesa la barra sólo hasta el grosor de Contabilidad para ese número de barras
#      (`.lam_grosor_holgado`, el máximo del recetario, igual que la lámina de escala que llena su alto); el resto va a
#      aire: entre filas (hasta 0.2 in más), entre bloques (hasta 0.4 in más) y, lo que quede, centra la composición.
# Sólo geometría: no toca cifras, orden ni colores.

#' Plan de la lámina de dos gráficos en vertical
#'
#' @param especs Especificaciones de escala, una por bloque. @param preguntas Pregunta de cada bloque ("" = sin pregunta).
#' @return `list(y0, wlab, g, fila, altos, gap, pregunta_alto)`: `altos` es una lista con el alto de cada fila por bloque.
#' @keywords internal
.lam_vertical_plan <- function(especs, preguntas) {
  g_ <- .std_geom
  geo <- .lam_vertical_geo(especs)
  g <- geo$g; fila <- geo$fila
  # Con cifras chicas la fila deja su aire sobre la barra (lo mismo que fuerza `.lam_likert_panel`).
  w_util <- g_("ancho") - g_("margen_izq") - g_("margen_der")
  wb <- w_util - 1.6 - 0.12 - (if (any(vapply(especs, function(e) !is.null(e$box$unidades), TRUE))) 1.1 else 0)
  chica <- any(vapply(especs, function(e) any(vapply(e$orden$aplicado, function(i) .lam_tiene_peq(.lam_escala_seg(e, i), wb), TRUE)), TRUE))
  if (chica) fila <- max(fila, g + g_("aire_cifra_chica"))
  size_lab <- 11
  y_ini <- g_("zona_datos_y0") - 0.05
  piso <- g_("base_y") - 0.1 - 0.32 - 0.02   # la leyenda (0.32) va 0.02 in tras el último bloque y termina antes de la base
  disp <- piso - y_ini
  hp <- vapply(preguntas, function(p) if (is.null(p) || !nzchar(trimws(p))) 0 else 0.4, 0)
  rotulos <- lapply(especs, function(e) as.character(e$filas$rotulo[e$orden$aplicado]))
  gap0 <- 0.2
  # Líneas por palabras sobre la tinta, como PowerPoint (`.lam_lineas_tinta`): la cuenta por cociente se quedaba corta.
  alto_rot <- function(x, w) max(.lam_lineas_tinta(x, w, size_lab, TRUE), .lam_lineas(x, w, size_lab, TRUE)) * size_lab * 1.2 / 72 + 0.1
  altos_con <- function(wlab, fila) lapply(rotulos, function(r) pmax(fila, vapply(r, function(x) alto_rot(x, wlab), 0) + 0.16))
  total_con <- function(altos) sum(hp) + 0.3 * length(especs) + sum(unlist(altos)) + gap0 * (length(especs) - 1L)
  lineas_max <- function(w) max(vapply(unlist(rotulos), function(x) .lam_lineas_tinta(x, w, size_lab, TRUE), 0))
  # El canal más angosto que deja cada rótulo en cuatro líneas o menos y que cabe; si ninguno cabe, el que menos alto pide.
  wlab <- 1.6; altos <- altos_con(wlab, fila)
  for (w in seq(1.6, 3.0, by = 0.1)) {
    a <- altos_con(w, fila)
    if (total_con(a) < total_con(altos) - 1e-9) { altos <- a; wlab <- w }
    if (total_con(a) <= disp && lineas_max(w) <= 4) { altos <- a; wlab <- w; break }
  }
  sobra <- disp - total_con(altos)
  gap <- gap0; desplazo <- 0
  if (sobra > 0) {
    nb <- length(unlist(altos))
    # La barra crece hasta el grosor de Contabilidad, sólo en las filas que mide la barra (no las que mide su rótulo).
    dg <- .lam_escala_engrosar(g, nb, sobra)
    if (dg > 0) {
      altos <- lapply(altos, function(a) { k <- a <= fila + 1e-9; a[k] <- a[k] + dg; a })
      g <- g + dg; fila <- fila + dg
      sobra <- disp - total_con(altos)
    }
    if (sobra > 0) {
      d_fila <- min(0.2, sobra / max(1L, nb))
      altos <- lapply(altos, function(a) a + d_fila)
      sobra <- disp - total_con(altos)
    }
    if (sobra > 0 && length(especs) > 1L) {
      d_gap <- min(0.4, sobra / (length(especs) - 1L))
      gap <- gap0 + d_gap; sobra <- sobra - d_gap * (length(especs) - 1L)
    }
    if (sobra > 0) desplazo <- sobra / 2
  }
  list(y0 = y_ini + desplazo, wlab = wlab, g = g, fila = fila, altos = altos, gap = gap, pregunta_alto = hp, size_lab = size_lab)
}
