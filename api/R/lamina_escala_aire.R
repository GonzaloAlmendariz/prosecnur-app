# M1 con piso (Gonzalo, 2026-10-22): «mientras menos (cont) haya mejor» y «seis barras caben en una lámina».
#
# Con un piso de grosor (`grosor_piso_cm`, N1) la barra no adelgaza; lo único que puede ceder para no partir una lámina
# en «(cont.)» es el AIRE: la separación entre premisas y el aire de la fila. Aquí vive el mínimo de ese aire. Solo
# geometría: no toca cifras, denominadores ni orden.

#' Aire mínimo de un juego de premisas con piso: lo único que se comprime para no partir en «(cont.)»
#'
#' La barra NO baja del piso (`g`); se comprimen la separación entre premisas (`gap`, >= `gap_min`) y el aire de la fila.
#' Si alguna cifra queda fuera de su segmento (`chica`), sube 0,28 in sobre su barra y su caja (0,22 in) debe quedar
#' >= `holgura` (0,075 in, N9) bajo la barra de arriba: de barra a barra hay al menos `g + 0,28 + holgura` in.
#' El `gap_min` de 0,08 in es el de la escala de un solo público (`.lam_escala_geo`); la caja de cada enunciado ya lleva
#' 0,1 in de margen, así que entre dos textos quedan >= 0,18 in.
#' @param alturas Alto del texto de cada premisa.
#' @param filas Barras de cada premisa.
#' @param g Grosor de barra (con el piso aplicado), en pulgadas.
#' @param chica Por premisa (o uno solo para todas): `TRUE` si alguna cifra de sus barras queda fuera del segmento. La
#'   separación que pide la cifra chica solo hace falta antes de una premisa que la tiene.
#' @param gap_min,holgura Separación mínima entre premisas y holgura de la cifra chica con la barra de arriba (in).
#' @return `list(fila, gap, gaps, altos, alto)`: paso mínimo de fila, gap mínimo, gap necesario antes de cada premisa
#'   (vector, `gap` o más), alto de cada premisa y alto total.
#' @keywords internal
.lam_aire_minimo <- function(alturas, filas, g, chica = TRUE, gap_min = 0.08, holgura = .lam_holgura_chica()) {
  n <- length(alturas); chica <- rep_len(as.logical(chica), n)
  paso_chica <- g + 0.28 + holgura
  # Con premisas de varias barras y cifras chicas el paso de fila entero va dentro de la caja; con una barra por premisa
  # la separación entre premisas (`gap`) completa el paso y la caja sólo necesita la barra y `gap_min`.
  fila <- if (any(chica & filas > 1L)) paso_chica else g + gap_min
  altos <- pmax(alturas, filas * fila)
  gaps <- rep(gap_min, max(0L, n - 1L))
  if (n > 1L) {
    pide <- chica[-1L]   # la cifra chica de la primera barra de la premisa que sigue no debe tocar la última de la de arriba
    gaps[pide] <- pmax(gap_min, paso_chica - (altos[-n] + altos[-1L]) / 2)[pide]
  }
  list(fila = fila, gap = gap_min, gaps = gaps, altos = altos, alto = sum(altos) + sum(gaps))
}

#' Aire mínimo de un bloque de premisas de escala
#' @param nb Filas de la lámina entera para el grosor (multilista); `NULL`: las del bloque.
#' @param chica Ver `.lam_aire_minimo`; por defecto, el caso exigente (hay cifras chicas).
#' @keywords internal
.lam_escala_aire_minimo <- function(premisas, nb = NULL, chica = TRUE, ...) {
  wp <- .lam_escala_ancho_prem(premisas)
  nb <- nb %||% sum(vapply(premisas, function(p) length(p$filas), 0))
  g <- .std_grosor(nb, "escala_apilada")
  .lam_aire_minimo(vapply(premisas, function(p) .lam_premisa_alto(p, wp), 0),
                   vapply(premisas, function(p) length(p$filas), 0), g, chica, ...)
}

#' ¿Qué premisas tienen alguna cifra fuera de su segmento? Mismo ancho de barra que `.lam_bloque_escala`
#' @return Un lógico por premisa.
#' @keywords internal
.lam_escala_chica_por_premisa <- function(espec, premisas) {
  g_ <- .std_geom; L <- g_("likert"); ex <- .std_enunciado_extra_in()
  L$x_barra <- L$x_barra + ex; L$ancho_barra <- L$ancho_barra - ex
  cb <- .lam_escala_columnas_box(espec, ex)
  WB <- if (!is.null(espec$box$unidades)) cb$ancho_barra else g_("ancho") - g_("margen_der") - L$x_barra - 0.3
  vapply(premisas, function(p) any(vapply(p$filas, function(fl) .lam_tiene_peq(.lam_escala_seg(espec, fl$i), WB), TRUE)), TRUE)
}
.lam_escala_hay_chica <- function(espec, premisas) any(.lam_escala_chica_por_premisa(espec, premisas))

#' Alto de un bloque de premisas con el aire cedido al factor `f` y nunca por debajo de su mínimo (M1)
#'
#' Es lo que dibuja `.lam_bloque_escala` cuando quien compone varios bloques (multilista) le pasa `estirar = f < 1`.
#' @keywords internal
.lam_escala_alto_con_f <- function(premisas, f, nb, chica = TRUE) {
  wp <- .lam_escala_ancho_prem(premisas); geo <- .lam_escala_geo(premisas, wp, nb)
  tx <- vapply(premisas, function(p) .lam_premisa_alto(p, wp), 0); nf <- vapply(premisas, function(p) length(p$filas), 0)
  mn <- .lam_aire_minimo(tx, nf, geo$g, chica)
  fila <- max(mn$fila, geo$fila * f); gap <- max(mn$gap, geo$gap * f)
  sum(pmax(tx, nf * fila)) + gap * (length(premisas) - 1L) + sum(pmax(0, mn$gaps - gap))
}

#' Alto de un juego de bloques de la multilista con el aire al factor `f` (M1); `f = 0` es el mínimo
#' @keywords internal
.lam_multilista_alto_f <- function(items, compartida, f) {
  nb <- .lam_multilista_filas(items)
  sum(vapply(items, function(it) .lam_multilista_cromo(it, compartida) +
               .lam_escala_alto_con_f(it$premisas, f, nb, .lam_escala_chica_por_premisa(it$espec, it$premisas)), 0)) +
    .LAM_MULTILISTA_GAP * (length(items) - 1L)
}

#' Factor de aire (0 a 1) con el que los bloques de la multilista caben en `disp`; 1 si ya caben, 0 si ni así
#' @keywords internal
.lam_multilista_factor_compresion <- function(items, compartida, disp) {
  if (.lam_multilista_alto(items, compartida) <= disp) return(1)
  if (.lam_multilista_alto_f(items, compartida, 0) > disp) return(0)
  lo <- 0; hi <- 1
  for (i in 1:30) { mid <- (lo + hi) / 2; if (.lam_multilista_alto_f(items, compartida, mid) <= disp) lo <- mid else hi <- mid }
  lo
}

#' ¿La leyenda de esta lámina es una sola? (M1 con piso: menos «(cont.)»)
#'
#' `compartida` se decide sobre TODOS los bloques de la multilista. Pero si, tras repartir, una lámina queda con un solo
#' bloque (o con bloques de la misma escala), su leyenda es una sola: se dibuja centrada bajo la última barra y no
#' reserva el 0,5 in de la leyenda propia de cada bloque. Ese medio pulgada es lo que salva el «(cont.)» de un bloque de
#' 5 barras con cifras chicas que ya no comparte lámina con otra escala. Sin piso (`.std_evitar_cont()` falso) nada cambia.
#' @param x Bloques (o trozos) de una lámina.
#' @param compartida El valor de la multilista entera.
#' @keywords internal
.lam_multilista_compartida_parte <- function(x, compartida) {
  if (isTRUE(compartida) || !.std_evitar_cont() || !length(x)) return(isTRUE(compartida))
  .lam_multilista_leyenda_compartida(lapply(x, `[[`, "espec"))
}

# ---- M1 «apretado»: seis barras con cifras chicas en UNA lámina (Gonzalo, 2026-10-23: «¿no entra en una?») ----------
#
# Solo cuando `.std_evitar_cont()` y la alternativa es partir la lámina (la multilista ya no cabe ni con el aire en su
# mínimo). Combina tres palancas de AIRE, nunca la barra (piso de 1,12 cm intacto) ni la leyenda (centrada a la lámina):
#  - holgura de la cifra chica con la barra de arriba 0,075 -> 0,03 in (la caja de la cifra mide 0,22 y su texto, menos);
#  - aire del Top Two Box 0,35 -> 0,25 in (el rótulo conserva su posición absoluta: sube con la franja);
#  - la franja de datos se extiende 0,30 in hacia el pie y la leyenda se pega a la última barra (queda >= 0,1 in sobre el «Base:»).
# Una lámina que ya cabía no pasa por aquí: su geometría no cambia.
.LAM_APRETADO_HOLGURA <- 0.03
.LAM_APRETADO_AIRE_TTB <- 0.25
.LAM_APRETADO_EXTRA_FRANJA <- 0.30

.lam_apretado <- function() isTRUE(getOption("prosecnur.lam_apretado", FALSE))
.lam_holgura_chica <- function() if (.lam_apretado()) .LAM_APRETADO_HOLGURA else 0.075
.lam_multilista_aire_ttb <- function() if (.lam_apretado()) .LAM_APRETADO_AIRE_TTB else .LAM_MULTILISTA_AIRE_TTB

#' Alto mínimo de la multilista en modo apretado (o `Inf` si no aplica: leyenda propia por bloque o más de seis barras)
#' @keywords internal
.lam_multilista_alto_apretado <- function(items, compartida) {
  if (!isTRUE(compartida) || !.std_evitar_cont() || .lam_escala_n_barras(items) > .MULTIAPILADAS_MAX_BARRAS) return(Inf)
  op <- options(prosecnur.lam_apretado = TRUE); on.exit(options(op))
  .lam_multilista_alto_f(items, compartida, 0)
}

#' Alto mínimo que compara contra `.lam_multilista_disponible()`: el del aire mínimo o, si es menor, el apretado menos la
#' franja extendida. Con `.std_evitar_cont()` falso es el de siempre.
#' @keywords internal
.lam_multilista_alto_min <- function(items, compartida) {
  base <- .lam_multilista_alto_f(items, compartida, 0)
  if (!.std_evitar_cont()) return(base)
  min(base, .lam_multilista_alto_apretado(items, compartida) - .LAM_APRETADO_EXTRA_FRANJA)
}

#' ¿Esta parte de la multilista se dibuja apretada? Solo si no cabe con el aire en su mínimo y sí apretada
#' @keywords internal
.lam_multilista_apretar <- function(items, compartida) {
  if (!.std_evitar_cont() || !isTRUE(compartida)) return(FALSE)
  disp <- .lam_multilista_disponible(compartida)
  .lam_multilista_alto(items, compartida) > disp &&   # lo que cabe al natural conserva su geometría
    .lam_multilista_alto_f(items, compartida, 0) > disp &&
    .lam_multilista_alto_apretado(items, compartida) <= disp + .LAM_APRETADO_EXTRA_FRANJA
}
