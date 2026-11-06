# reporte_plan_base_mayor.R — qué pregunta da la base automática de un público cuando la lámina trae varias
#
# Gonzalo (2026-10-29, opción A «como Conta»): una lámina que junta preguntas de un mismo público con distinta N (una
# multilista con un Sí/No de 279 estudiantes y una subpregunta de 176) dice en el pie la base MAYOR, y el bloque con
# menos casos lleva su «N = …» (lamina_multilista.R). El pie tomaba la PRIMERA pregunta del público: según el orden de
# los bloques decía 279 o 176. Vive aparte porque reporte_plan_ppt.R está congelado a crecimiento; allí sólo se cambió
# la línea que elige la pregunta.

#' La pregunta con más casos (fila «Total» de su frecuencia) entre las de un público; la primera si no se puede medir
#' @param refs Refs del público, en el orden de la lámina.
#' @param tab_de Función que devuelve la tabla de frecuencias de una ref (la `.tab_freq` del render).
#' @keywords internal
.base_ref_de_mayor_n <- function(refs, tab_de) {
  if (length(refs) < 2L) return(refs[1])
  n <- vapply(refs, function(r) {
    tb <- tryCatch(tab_de(r), error = function(e) NULL)
    if (is.null(tb) || !all(c("Opciones") %in% names(tb))) return(NA_real_)
    it <- which(tb$Opciones == "Total")
    if (!length(it)) return(NA_real_)
    suppressWarnings(as.numeric(.plan_col_o_n(tb)[it[1]]))
  }, 0)
  if (all(is.na(n))) return(refs[1])
  refs[which.max(n)]
}
