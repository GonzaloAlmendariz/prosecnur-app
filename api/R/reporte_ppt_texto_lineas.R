#' Parrafo de varias lineas para una lamina de texto
#'
#' El cuerpo de `text_slide` se emitia como UN solo `ftext`. Dentro de un run,
#' un `\n` no es un salto de linea en OOXML: se pierde. Y el constructor si
#' separa —`.ppt_norm_text_lines()` une el texto y sus bullets con `\n`—, asi
#' que la lamina «NUMERO DE RESPUESTAS» salia con las dos frases pegadas:
#' `...gráfico correspondiente.• Los porcentajes están redondeados...`.
#'
#' Aqui cada linea es su propio run, separados por `run_linebreak()`, que es lo
#' que OOXML entiende por salto dentro de un parrafo.
#'
#' @name reporte_ppt_texto_lineas
NULL


#' @param texto Texto con `\n` entre lineas.
#' @param prop `fp_text` con las propiedades del cuerpo.
#' @param align Alineacion del parrafo.
#' @param line_spacing Interlineado.
#' @return Un `fpar` de officer.
#' @keywords internal
.ppt_fpar_multilinea <- function(texto, prop, align = "left", line_spacing = 1) {
  t <- as.character(texto %||% "")[1]
  if (is.na(t)) t <- ""
  lineas <- strsplit(t, "\n", fixed = TRUE)[[1]]
  if (!length(lineas)) lineas <- ""

  runs <- list()
  for (i in seq_along(lineas)) {
    # El salto va ANTES de la linea, no despues: asi no queda uno colgando al
    # final del parrafo, que en PowerPoint abre una linea vacia.
    if (i > 1L) runs[[length(runs) + 1L]] <- officer::run_linebreak()
    runs[[length(runs) + 1L]] <- officer::ftext(lineas[[i]], prop = prop)
  }

  do.call(
    officer::fpar,
    c(runs, list(fp_p = officer::fp_par(text.align = align, line_spacing = line_spacing)))
  )
}


#' Cuantas lineas tiene un texto, para verificar
#' @keywords internal
.ppt_contar_lineas <- function(texto) {
  t <- as.character(texto %||% "")[1]
  if (is.na(t) || !nzchar(t)) return(0L)
  length(strsplit(t, "\n", fixed = TRUE)[[1]])
}
