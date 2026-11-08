# reporte_plan_titulo_inferible.R — el motor no inventa el título de una lámina de resumen
#
# Ola 2, R8-6 (Gonzalo: «nada de títulos generados»): cuando una lámina no trae título, el motor lo inferia del
# enunciado de su primera variable (`.title_of_var(el$var)`, reporte_plan_ppt.R, «Resolver titulo del slide si no
# viene», y su espejo del Word). En una lámina de resumen —varias preguntas a la vez— ese enunciado es el de UNA de
# ellas y el título resultante afirma algo que la lámina no muestra. Para estos elementos el título queda vacío.

.PLAN_TIPOS_RESUMEN <- c("panorama", "fortalezas", "cobertura")

#' ¿Se puede inferir el título de la lámina desde la variable del elemento?
#'
#' No en los resúmenes: `overrides$estilo == "resumen"`, el dumbbell con cruce, el panorama, las fortalezas y la cobertura.
#' @keywords internal
.plan_titulo_inferible <- function(el) {
  if (is.null(el) || !is.list(el)) return(TRUE)
  tipo <- as.character(el$.element_type %||% "")[1]
  if (tipo %in% .PLAN_TIPOS_RESUMEN) return(FALSE)
  if (identical(as.character((el$overrides %||% list())$estilo %||% "")[1], "resumen")) return(FALSE)
  if (identical(tipo, "dumbbell")) {
    cr <- trimws(as.character(unlist(el$cruce %||% (el$overrides %||% list())$cruce %||% character(0))))
    if (any(!is.na(cr) & nzchar(cr))) return(FALSE)
  }
  TRUE
}
