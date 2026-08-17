#' Parejas columna–candidato que NO se aceptan por subcadena inversa
#'
#' `.cm_aulas_col()` resuelve una columna en tres niveles: nombre exacto, clave
#' normalizada y —si los dos fallan— subcadena en cualquiera de los dos
#' sentidos. El tercer nivel es útil en las dos direcciones: rescata una columna
#' «Tipo» cuando el candidato es `tipo_sesion`, y también deja que una columna
#' `curso` resuelva `course_id` a través del candidato `curso_id`.
#'
#' Pero al sumar `tipo_curso` a los candidatos de `session_type` —la base real
#' llama a esa columna **`Tipo Curso`**, sin «de»— aparece una pareja que no debe
#' cruzarse: una base con `curso` y sin ninguna columna de tipo pasaría a leer el
#' CÓDIGO DEL CURSO como si fuera el tipo de sesión. Medido antes de la guarda:
#' con una columna `curso` y sin tipo, `session_type` se llenaba con «C1».
#'
#' No es hipotético —`curso` está en casi todas las bases— y el daño es el mismo
#' que ya se ve en `teacher_type`, que en el proyecto real guarda NOMBRES de
#' docente en 4.979 de 5.263 aulas: un criterio que filtra por nombres propios
#' creyendo que filtra por categoría.
#'
#' La prohibición es **por pareja** y no por columna, porque prohibir la columna
#' `curso` entera rompe nueve casos de la suite grande: es justo así como se
#' resuelve `course_id`. Los dos niveles de arriba —nombre exacto y clave
#' normalizada— siguen intactos, que es como «Tipo Curso» se resuelve de verdad.
#'
#' @keywords internal
.cm_aulas_pares_prohibidos <- c("curso|tipo_curso", "curso|tipo_de_curso")

#' ¿Esta pareja columna–candidato está prohibida por subcadena inversa?
#'
#' @keywords internal
.cm_aulas_par_prohibido <- function(col_key, cand_key) {
  paste0(col_key, "|", cand_key) %in% .cm_aulas_pares_prohibidos
}
