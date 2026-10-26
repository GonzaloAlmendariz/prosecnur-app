# Arranque común de las barras en las figuras de barras del Word: apiladas, multiapiladas, agrupadas y el Sí/No.
#
# Gonzalo (2026-10-26): las figuras con el mismo tipo de rótulo de fila —los públicos de un perfil, «Docentes · Estudiantes
# · Administrativos»— deben arrancar las barras en el mismo punto de la página. Cada escala medía su propia columna de
# rótulos (`.word_xmin()`), así que la de un solo público, sin rótulo, arrancaba en el borde izquierdo y la de tres públicos
# más a la derecha. El documento mide una vez la columna de sus figuras de barras y las de rótulo corto toman la más ancha
# de ellas; las de rótulo largo (las premisas) conservan la suya, porque igualarlas comería la barra. Una figura SIN rótulo
# de fila no reserva columna y va a todo el ancho (Gonzalo: «si no tiene etiqueta, no tiene por qué reservar espacio»).
# Las agrupadas y el Sí/No de una fila entran igual («también lo deberían estar», Gonzalo, 2026-10-26). La columna es por
# capítulo: las categorías del perfil no empujan a los públicos de los resultados, ni al revés.

#' Hasta qué ancho (pulgadas) un rótulo de fila es «corto»: un público con sus casos, «Administrativos (14)», cabe holgado
#' @keywords internal
.WORD_ROTULO_CORTO_IN <- 1.6

#' Los rótulos de fila de una escala como los dibuja el Word: en su orden, con «(N)» si «Casos junto al porcentaje» lo
#' pide, y partidos en líneas
#' @keywords internal
.word_escala_rotulos_fila <- function(espec, envolver = .WORD_ESCALA_ENVOLTURA) {
  orden <- espec$orden$aplicado %||% seq_len(nrow(espec$filas))
  F <- espec$filas[orden, , drop = FALSE]
  rot <- ifelse(is.na(F$rotulo) | !nzchar(F$rotulo), "", F$rotulo)
  # «Casos junto al porcentaje»: el Word no lleva «N respuestas» por fila como la lámina; si el ajuste lo pide, el grupo
  # dice sus casos en el rótulo («Administrativos (14)»).
  casos <- suppressWarnings(as.numeric(.espec_casos(F)))
  if (.casos_junto_muestra(.espec_casos(espec$filas), espec$casos_junto) && any(is.finite(casos))) {
    con <- nzchar(rot) & is.finite(casos)
    rot[con] <- sprintf("%s (%d)", rot[con], as.integer(round(casos[con])))
  }
  .word_escala_rotulos_envueltos(rot, envolver)
}

#' Ancho de columna de rótulos (pulgadas) de una escala del Word, como lo reserva `.word_xmin()`
#' @keywords internal
.word_escala_rotulo_in <- function(espec) {
  .word_rotulo_in(.word_escala_rotulos_fila(espec), .WORD_ESCALA_PT$rotulo_fila + .word_desplazo("rotulo"))
}

#' Rótulos de las barras categóricas del Word, partidos como los dibuja `.word_g_barras()`
#' @keywords internal
.word_barras_rotulos <- function(espec) .word_envolver_holgado(espec$rotulos, 40)

#' Punto de los rótulos de las barras categóricas del Word
#' @keywords internal
.word_barras_pt <- function() 9 + .word_desplazo("rotulo")

#' Columna de rótulos (pulgadas) de una figura de barras del Word, o `NA` si no tiene (o no es de barras)
#'
#' Escalas y barras categóricas; la dicotomía de una fila y el lollipop no reservan columna propia y no la definen.
#' @keywords internal
.word_columna_de <- function(espec) {
  if (!is.list(espec)) return(NA_real_)
  tipo <- as.character(espec$tipo %||% "")[1]
  tryCatch({
    if (identical(tipo, "escala") && NROW(espec$filas) > 0L) {
      if (!.word_tiene_rotulos(.word_escala_rotulos_fila(espec))) NA_real_ else .word_escala_rotulo_in(espec)
    }
    else if (identical(tipo, "categorica") && !isTRUE(.lam_es_dicotomia(espec)) &&
             !(identical(espec[["graficador"]], "lollipop") && identical(espec[["forma"]], "lollipop"))) {
      .word_rotulo_in(.word_barras_rotulos(espec), .word_barras_pt())
    } else NA_real_
  }, error = function(err) NA_real_)
}

#' Columna común de rótulos de las figuras de barras cortas, o `NULL` si no hay ninguna
#' @param especs Especs de las figuras (de un capítulo); las que no son de barras se ignoran.
#' @return Pulgadas: la columna más ancha entre las de rótulo corto o sin rótulo.
#' @keywords internal
.word_rotulo_comun <- function(especs) {
  L <- vapply(especs, .word_columna_de, 0)
  L <- L[is.finite(L) & L <= .WORD_ROTULO_CORTO_IN]
  if (!length(L)) NULL else max(L)
}

#' La columna común de cada entrada del documento según su capítulo (los separadores de nivel 1 abren capítulo)
#' @param render_meta Entradas del documento, en orden.
#' @return Lista del largo de `render_meta`: la columna común del capítulo de cada entrada, o `NULL`.
#' @keywords internal
.word_rotulo_comun_por_capitulo <- function(render_meta) {
  cap <- cumsum(vapply(render_meta, function(e) identical(e$kind %||% "", "section") && .word_nivel_seccion(e$meta) <= 1L, logical(1)))
  especs <- lapply(render_meta, function(e) if (identical(e$kind %||% "chart", "chart")) attr(e$plot_word, "pulso_espec"))
  comunes <- lapply(split(especs, cap), .word_rotulo_comun)
  unname(comunes[as.character(cap)])
}

#' Los rótulos partidos para entrar en la columna común, o `NULL` si ni así caben
#'
#' Un rótulo mediano («Tiempo parcial por asignaturas (TPA)», Arte_v1-7) pasaba del umbral en una línea y quedaba con
#' columna propia, desalineado del resto del capítulo. Se parte, hasta `max_lineas`, al ancho de la columna común (la
#' relación inversa de `.word_rotulo_in()`); una premisa, que necesitaría más líneas, conserva su columna.
#' @param rotulos Rótulos sin partir. @param pt Su tamaño de letra.
#' @keywords internal
.word_rotulos_a_columna <- function(rotulos, pt, comun = getOption("prosecnur.word_rotulo_comun"), max_lineas = 2L) {
  comun <- suppressWarnings(as.numeric(comun %||% NA_real_)[1])
  if (!is.finite(comun) || !.word_tiene_rotulos(rotulos)) return(NULL)
  ancho <- floor((comun - 0.15) * 72 / (max(7.5, pt * 0.95) * 0.5))
  if (ancho < 8L) return(NULL)
  partes <- lapply(as.character(rotulos), function(r) strwrap(r, width = ancho))
  if (any(lengths(partes) > max_lineas)) return(NULL)
  out <- vapply(partes, paste, "", collapse = "\n")
  if (.word_rotulo_in(out, pt) > comun + 1e-9) return(NULL)   # una palabra más larga que la columna no entra
  out
}

#' ¿La figura tiene algún rótulo de fila? Sin ninguno no reserva columna ni define la común
#' @keywords internal
.word_tiene_rotulos <- function(rotulos) any(nzchar(trimws(gsub("\n", " ", as.character(rotulos)))), na.rm = TRUE)

#' La columna con que dibuja una figura de barras: la común del capítulo si la suya es corta y tiene rótulo, o la suya
#' @param rotulos Rótulos de fila de la figura: sin ninguno, la figura no reserva columna (`NULL`: la suya, mínima).
#' @keywords internal
.word_escala_columna <- function(propia, rotulos = "x", comun = getOption("prosecnur.word_rotulo_comun")) {
  if (!.word_tiene_rotulos(rotulos)) return(propia)
  comun <- suppressWarnings(as.numeric(comun %||% NA_real_)[1])
  if (is.finite(comun) && propia <= .WORD_ROTULO_CORTO_IN) max(propia, comun) else propia
}
