# =============================================================================
# graficos_rotulo_completo.R — el criterio completo en las líneas y puntos del radar, Word y PPT (R3, Arte 2026-10-27)
# =============================================================================
#
# Renzo Segura (informe de Arte, Gráfico 73 «Competencias genéricas»): «Comunicación eficaz: oral, escrita y no…» —«¿se
# puede hacer algo para que salga completa la competencia?»—. Causa: `.radar_mb_puntos` recortaba el nombre de cada
# criterio a `.RADAR_MB_MAX_ETIQUETA` (42) caracteres antes de dibujar, una regla pensada para los vértices del radar
# poligonal que también cortaba la columna de rótulos del dumbbell en el Word y en el PPT.
#
# Regla (Word y PPT por igual): el rótulo del criterio va COMPLETO, envuelto hasta en 3 líneas; la columna de rótulos
# crece hasta un tope (~40 % del ancho del gráfico; en la lámina, el rango del recetario 2.2–3.8 in) y el gráfico cede ese
# ancho. Sólo si con 3 líneas y el tope no cabe se recorta con «…», y se avisa (`.pulso_aviso`) qué rótulo y dónde. El
# radar poligonal (5+ criterios) conserva su recorte: sus rótulos van en los vértices, no en una columna.

#' Líneas máximas del rótulo de un criterio
#' @keywords internal
.ROTULO_COMPLETO_LINEAS <- 3L

#' Tope de la columna de rótulos, como fracción del ancho del gráfico
#' @keywords internal
.ROTULO_COMPLETO_TOPE <- 0.40

#' Nombres de los criterios para dibujar: completos; sólo los homónimos exactos se numeran (el eje es un factor)
#' @keywords internal
.radar_mb_eje_completo <- function(x) {
  x <- as.character(x)
  if (anyDuplicated(x)) {
    dup <- x %in% x[duplicated(x)]
    x[dup] <- paste0(x[dup], " (", ave_seq(x[dup]), ")")
  }
  x
}

#' Recorta un rótulo por palabras, con «…», hasta que `cabe()` lo acepte
#' @param cabe Función texto -> lógico.
#' @keywords internal
.rotulo_recortar_hasta <- function(x, cabe) {
  if (is.na(x) || cabe(x)) return(x)
  pal <- strsplit(trimws(x), "\\s+")[[1]]
  for (k in rev(seq_len(max(1L, length(pal) - 1L)))) {
    t <- paste0(sub("[,;:.]$", "", paste(pal[seq_len(k)], collapse = " ")), "…")
    if (cabe(t)) return(t)
  }
  paste0(substr(pal[1], 1L, 12L), "…")
}

#' Avisa cada rótulo recortado: cuál y dónde (la lámina en curso o la figura del Word)
#' @param donde Texto que sigue a «no cabe completo» («en la columna de rótulos de la lámina»…).
#' @keywords internal
.rotulo_avisar_recortes <- function(originales, finales, donde) {
  fig <- getOption("prosecnur.word_figura_en_curso")
  for (i in which(originales != finales)) {
    texto <- sprintf("el criterio «%s» no cabe completo en %d líneas %s: se recortó a «%s».", originales[i], .ROTULO_COMPLETO_LINEAS, donde,
                     gsub("\n", " ", finales[i]))
    .pulso_aviso(if (is.character(fig) && length(fig) == 1L && nzchar(fig)) paste0(fig, ": ", texto) else .aviso_en_lamina(texto))
  }
  invisible(NULL)
}

#' Rótulos del dumbbell del Word: envueltos hasta en 3 líneas con la columna hasta el 40 % del ancho; si no, recorte y aviso
#' @param pt Puntos del rótulo.
#' @param desde Caracteres por línea con que se empieza a envolver.
#' @return Rótulos envueltos (con «\n»).
#' @keywords internal
.word_rotulos_completos <- function(x, pt, desde = 34L) {
  x <- as.character(x)
  tope_in <- .ROTULO_COMPLETO_TOPE * (.std_word("pagina", "ancho_util") - 0.3)
  por_car <- max(7.5, pt * 0.95) * 0.5 / 72                 # la métrica de `.word_rotulo_in`
  hasta <- max(8L, floor((tope_in - 0.15) / por_car))
  desde <- min(desde, hasta)
  cabe <- function(t) max(lengths(strsplit(.word_envolver(t, hasta), "\n"))) <= .ROTULO_COMPLETO_LINEAS
  finales <- vapply(x, .rotulo_recortar_hasta, "", cabe = cabe, USE.NAMES = FALSE)
  .rotulo_avisar_recortes(x, finales, "en la columna de rótulos del Word")
  .word_envolver_holgado(finales, desde, hasta = hasta, lineas = .ROTULO_COMPLETO_LINEAS)
}

#' Ancho máximo de la columna de rótulos de las pesas nativas (el rango del recetario)
#' @keywords internal
.lam_pesas_ancho_max <- function(con_dif) (if (isTRUE(con_dif)) 2.8 else 2.2) + 1.6

#' ¿Caben los rótulos de las pesas en `w` pulgadas con hasta `lineas` líneas a 13 pt?
#' @keywords internal
.lam_pesas_caben <- function(rotulos, w, lineas = .ROTULO_COMPLETO_LINEAS) {
  all(vapply(rotulos, function(x) .lam_lineas(x, w, 13, TRUE) <= lineas, TRUE))
}

#' Rótulos de las pesas nativas que entran en la columna: completos o, si ni en 3 líneas al tope caben, recortados
#' @param avisar Si avisa de cada recorte (la lámina sí; la comprobación de si la lámina es nativa, no).
#' @keywords internal
.lam_pesas_rotulos <- function(rotulos, con_dif, avisar = FALSE) {
  x <- as.character(rotulos)
  w <- .lam_pesas_ancho_max(con_dif)
  finales <- vapply(x, .rotulo_recortar_hasta, "", cabe = function(t) .lam_pesas_caben(t, w), USE.NAMES = FALSE)
  if (isTRUE(avisar)) .rotulo_avisar_recortes(x, finales, "en la columna de rótulos de la lámina")
  finales
}
