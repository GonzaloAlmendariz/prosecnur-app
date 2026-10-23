# =============================================================================
# reporte_word_como_leer_auto.R — qué secciones de «Cómo leer este informe» entran solas
# =============================================================================
#
# Gonzalo, 2026-10-22: «No va por defecto, va solo si en ppt van 2.» Con `como_leer` ausente o «auto», cada explicación que
# depende de un recurso (Top Two Box, Bottom Two Box, una misma escala, cifras pequeñas) se escribe sólo si ese recurso
# aparece en al menos `.WORD_COMO_LEER_MIN_LAMINAS` láminas del PPT del mismo plan. «Lámina» se cuenta con la partición del
# PPT (`.word_particion_ppt`): un gráfico partido en 3 láminas cuenta 3. Redondeo y bases chicas acompañan al capítulo sólo si
# alguna de esas cuatro califica; si ninguna, `character(0)`: el capítulo no se escribe (ni se numera ni va al índice).
# Un `como_leer` explícito (TRUE/FALSE/vector) nunca pasa por aquí.

.WORD_COMO_LEER_MIN_LAMINAS <- 2L

# Espec(s) de escala de un plot: la suya, o la de cada bloque de una multilista.
.word_como_leer_especs <- function(plot) {
  ml <- attr(plot, "pulso_multilista")
  if (!is.null(ml)) {
    items <- tryCatch(.lam_multilista_items(ml), error = function(e) NULL)
    return(lapply(items %||% list(), `[[`, "espec"))
  }
  e <- attr(plot, "pulso_espec")
  if (is.list(e) && identical(as.character(e$tipo %||% "")[1], "escala")) list(e) else list()
}

# ¿Alguna cifra de la espec no cabe dentro de su color? Misma prueba que la lámina (`.lam_tiene_peq`) con una barra típica de 7 in.
.word_como_leer_tiene_chicas <- function(espec) {
  tryCatch(any(vapply(seq_len(NROW(espec$filas)), function(i) .lam_tiene_peq(.lam_escala_seg(espec, i), 7), TRUE)), error = function(e) FALSE)
}

#' Secciones de «Cómo leer» que el plan justifica (recurso en >= 2 láminas del PPT)
#' @param render_meta Elementos del plan que alimentan el Word.
#' @return Vector de claves de `.WORD_COMO_LEER_SECCIONES`; `character(0)` si el informe no tiene escalas.
#' @keywords internal
.word_como_leer_auto <- function(render_meta) {
  cuenta <- c(escala = 0L, top_two_box = 0L, bottom_two_box = 0L, cifras_pequenas = 0L)
  for (e in render_meta) {
    if (!identical(e$kind %||% "chart", "chart")) next
    especs <- .word_como_leer_especs(e$plot_word)
    if (!length(especs)) next
    part <- .word_particion_ppt(e$plot_word)
    laminas <- if (is.null(part)) 1L else max(1L, length(unique(part$parte)))
    tiene <- c(escala = TRUE,
               top_two_box = any(vapply(especs, function(s) identical(as.character(s$box$preset %||% "")[1], "top2box"), TRUE)),
               bottom_two_box = any(vapply(especs, function(s) !is.null(s$box2), TRUE)),
               cifras_pequenas = any(vapply(especs, .word_como_leer_tiene_chicas, TRUE)))
    cuenta <- cuenta + laminas * tiene
  }
  if (cuenta[["escala"]] < 1L) return(character(0))
  ok <- cuenta >= .WORD_COMO_LEER_MIN_LAMINAS
  rec <- c(top_two_box = ok[["top_two_box"]], bottom_two_box = ok[["bottom_two_box"]],
           misma_escala = ok[["escala"]], cifras_pequenas = ok[["cifras_pequenas"]])
  if (!any(rec)) return(character(0))   # ningún recurso llega a 2 láminas: el capítulo no se escribe
  c(names(rec)[rec][names(rec)[rec] %in% c("top_two_box", "bottom_two_box")], "redondeo",
    names(rec)[rec][names(rec)[rec] %in% c("misma_escala", "cifras_pequenas")], "bases_chicas")
}
