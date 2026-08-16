#' Parrafo de varias lineas para una lamina de texto
#'
#' El cuerpo de `text_slide` se emitia como UN solo `ftext`. Dentro de un run,
#' un `\n` no es un salto de linea en OOXML: se pierde. Y el constructor si
#' separa —`.ppt_norm_text_lines()` une el texto y sus bullets con `\n`—, asi
#' que la lamina «NUMERO DE RESPUESTAS» salia con las dos frases pegadas:
#' `...gráfico correspondiente.• Los porcentajes están redondeados...`.
#'
#' Cada linea pasa a ser su propio PARRAFO, agrupados en un `block_list`.
#' `run_linebreak()` seria lo natural, pero officer no le da metodo `to_pml`:
#' sirve en Word y en PowerPoint aborta el placeholder entero.
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

  fp_p <- officer::fp_par(text.align = align, line_spacing = line_spacing)
  parrafos <- lapply(lineas, function(l) {
    officer::fpar(officer::ftext(l, prop = prop), fp_p = fp_p)
  })
  # Una sola linea se devuelve como `fpar` y no como lista de uno: es lo que
  # espera el resto del render y evita envolver de mas.
  if (length(parrafos) == 1L) return(parrafos[[1]])
  do.call(officer::block_list, parrafos)
}


#' Cuantas lineas tiene un texto, para verificar
#' @keywords internal
.ppt_contar_lineas <- function(texto) {
  t <- as.character(texto %||% "")[1]
  if (is.na(t) || !nzchar(t)) return(0L)
  length(strsplit(t, "\n", fixed = TRUE)[[1]])
}
