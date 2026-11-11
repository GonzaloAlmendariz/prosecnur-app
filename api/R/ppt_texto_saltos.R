# =============================================================================
# ppt_texto_saltos.R — un texto con saltos de línea, escrito como un párrafo por línea
# =============================================================================
#
# `officer::ftext()` escribe el "\n" dentro del run y PowerPoint lo descarta: la portada ACNUR ("Informe de resultados"
# y la fecha en dos líneas) salía "Informe de resultados23 oct. – 31 oct. 2026" (checklist-informe-acnur-2026-11-11,
# D4). `run_linebreak()` sólo vale en Word, así que cada línea va en su propio párrafo, con el mismo formato.

#' Un párrafo por línea (un solo `fpar` si no hay saltos)
#' @keywords internal
.ppt_fpar_con_saltos <- function(text, prop, align = "center") {
  lineas <- strsplit(gsub("\r\n?", "\n", as.character(text %||% "")[1]), "\n", fixed = TRUE)[[1]]
  if (!length(lineas)) lineas <- ""
  pars <- lapply(lineas, function(l) officer::fpar(officer::ftext(l, prop = prop), fp_p = officer::fp_par(text.align = align)))
  if (length(pars) == 1L) pars[[1]] else do.call(officer::block_list, pars)
}
