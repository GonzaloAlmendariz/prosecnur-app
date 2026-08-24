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
#' **La enumeración no se sostuvo.** La lista literal nombraba `tipo_curso` y
#' `tipo_de_curso`, y después se sumaron a `session_type` tres candidatos más
#' —`desctipocurso`, `desc_tipo_curso`, `descripcion_tipo_curso`—: los tres
#' contienen «curso», ninguno estaba en la lista, y `desctipocurso` volvió a
#' enganchar la columna `curso`. Ampliar los candidatos y la guarda son dos
#' actos separados, y el segundo se olvida. Por eso la prohibición se DERIVA
#' (ver `.cm_aulas_par_prohibido()`) en vez de enumerarse.
#'
#' Este vector queda para parejas que la regla no cubra; hoy está vacío.
#'
#' @keywords internal
.cm_aulas_pares_prohibidos <- character(0)

#' ¿Esta pareja columna–candidato está prohibida por subcadena inversa?
#'
#' Regla: la columna `curso` —el CÓDIGO del curso— nunca resuelve por subcadena
#' inversa un candidato que denote el TIPO de curso. Un candidato es «de tipo»
#' cuando su clave contiene a la vez `curso` y `tipo`, que es lo que comparten
#' las cinco variantes de `session_type` sin excepción.
#'
#' Deja intacto lo que el tercer nivel sí debe hacer: `curso` → `curso_id`
#' (`course_id`) no menciona `tipo`, así que sigue resolviendo.
#'
#' @keywords internal
.cm_aulas_par_prohibido <- function(col_key, cand_key) {
  col_key <- as.character(col_key)[1]
  cand_key <- as.character(cand_key)[1]
  if (is.na(col_key) || is.na(cand_key)) return(FALSE)
  if (identical(col_key, "curso") &&
      grepl("curso", cand_key, fixed = TRUE) &&
      grepl("tipo", cand_key, fixed = TRUE)) {
    return(TRUE)
  }
  paste0(col_key, "|", cand_key) %in% .cm_aulas_pares_prohibidos
}
