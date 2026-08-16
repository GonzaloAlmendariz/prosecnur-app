# La facultad que el estudio declara tambien recorta el marco de aulas.
#
# El criterio `faculty` nace con `scope = "alumno"` en el registro, asi que su
# seleccion recorta la POBLACION y nunca llegaba a los cursos-horario. Sobre el
# estudio real de 2026 eso deja en el marco cursos catalogados bajo facultades
# que el estudio no cubre —dos de Civil bajo Escuela de Posgrado—, y `/calcular`
# falla con `facultades_incompletas`: el contrato de alumnos por CH pide una
# facultad que el estudio no puede declarar.
#
# No es una decision nueva. El estudio ya declara 15 de 18 facultades, las
# mismas que la tabla de cuotas del diseno, que deja fuera Escuela de Posgrado,
# Escuela de Estudios Especiales y Consorcio de Universidades. Lo que faltaba
# era honrarla del lado de las aulas: un aula cuya facultad no es un estrato del
# estudio no puede recibir cuota, asi que conservarla solo sirve para romper el
# contrato.
#
# Vive aparte del registro a proposito. Cambiar el `scope` de `faculty` a "aula"
# conectaria este lado pero desconectaria el de estudiantes: el scope es uno
# solo. Aqui la seleccion se reutiliza SIN moverla de sitio.

#' ¿La seleccion declara una restriccion de facultad utilizable?
#'
#' Sin criterio, sin categorias o con el criterio en otra forma, no hay nada que
#' aplicar y el marco queda como estaba.
.cm_criterios_facultad_curso_regla <- function(seleccion) {
  crit <- (seleccion$byVariable %||% list())$faculty
  if (!is.list(crit) || !identical(crit$kind, "flat")) return(NULL)
  cats <- as.character(unlist(crit$categories, use.names = FALSE))
  cats <- cats[!is.na(cats) & nzchar(cats)]
  if (!length(cats)) return(NULL)
  crit
}

#' Flag por aula: TRUE si su facultad esta entre las que el estudio declara.
#'
#' Semantica calcada de `.cm_criterios_eval_flat_vec`, que es la que rige para
#' el resto de criterios planos:
#'
#' - un aula SIN facultad pasa (sin senal no se restringe);
#' - `mode = "exclude"` invierte el set;
#' - el match es por `text_key`, nunca por substring.
#'
#' La unica diferencia deliberada: **no se aplican las excepciones por
#' facultad**. `exceptions` existe para decir «en Derecho acepta ademas estas
#' modalidades»; sobre el propio criterio de facultad seria una regla que se
#' habla a si misma, y leerla aqui haria que una excepcion pensada para los
#' estudiantes reabriera el marco de aulas sin que nadie lo pidiera.
.cm_criterios_facultad_curso_flag <- function(faculties, crit) {
  n <- length(faculties)
  if (!n) return(logical(0))
  if (is.null(crit)) return(rep(TRUE, n))
  vk <- .cm_aulas_text_key(faculties)
  cats <- as.character(unlist(crit$categories, use.names = FALSE))
  cats <- cats[!is.na(cats) & nzchar(cats)]
  inset <- vk %in% cats
  if (identical(crit$mode, "exclude")) inset <- !inset
  # Sin senal pasa, se pida incluir o excluir.
  inset[!nzchar(vk)] <- TRUE
  inset
}

#' Etiqueta del paso, para que el embudo diga QUE recorto y no solo cuanto.
.cm_criterios_facultad_curso_label <- function(crit) {
  cats <- as.character(unlist(crit$categories, use.names = FALSE))
  cats <- cats[!is.na(cats) & nzchar(cats)]
  verbo <- if (identical(crit$mode, "exclude")) "Facultad del curso: excluye" else "Facultad del curso: sólo"
  paste0(verbo, " ", length(cats), " facultad(es) del estudio")
}
