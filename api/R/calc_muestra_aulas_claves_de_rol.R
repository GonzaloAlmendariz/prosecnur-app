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

#' Claves de columna que la subcadena DIRECTA no presta a otro rol
#'
#' Se derivan de los alias por defecto —no se enumeran— por la misma razón que
#' `.cm_aulas_par_prohibido()`: sumar un alias y olvidar la guarda son dos actos
#' separados, y el segundo se olvida.
#'
#' - `condicion_curso`: las claves que nombran la condición DEL CURSO.
#' - `conteo`: los candidatos que sí piden un conteo (`enrolled_total`); son los
#'   únicos a los que una columna con prefijo de conteo puede responder.
#'
#' @keywords internal
.cm_aulas_claves_protegidas <- function() {
  defaults <- .cm_aulas_config_mapping(list())
  list(
    condicion_curso = unique(.cm_aulas_text_key(defaults$condicion_curso)),
    conteo = unique(.cm_aulas_text_key(defaults$enrolled_total))
  )
}

#' ¿Esta columna no puede resolver por subcadena DIRECTA estos candidatos?
#'
#' `.cm_aulas_par_prohibido()` sólo cuida el sentido INVERSO (columna contenida
#' en el candidato). El directo —candidato contenido en la columna— tenía el
#' mismo agujero, medido el 2026-09-24 con la base de UNSA: sin columna
#' `condicion` del estudiante y con `condicion_curso`, el candidato «condicion»
#' de `condition` casaba dentro de `condicion_curso`, el filtro de condición
#' regular leía OBLIGATORIO/ELECTIVO y las 142.375 filas quedaban fuera con
#' motivo `condition`: `population_n = 0`.
#'
#' Dos reglas, ambas sobre el JUEGO de candidatos (el rol), no sobre uno suelto:
#'
#' 1. Una columna cuya clave es exactamente un alias de `condicion_curso`
#'    pertenece a ese rol: sólo la toma un juego que incluya alguno de esos
#'    alias (el propio `condicion_curso`, o las señales del catálogo que lo
#'    llevan dentro).
#' 2. Una columna que CUENTA algo (`n_`, `cant_`, `cantidad_`) no es ese algo:
#'    `n_docentes` no es el docente, y `teacher` lo tomaba por ser la primera
#'    columna que contiene «docente». Sólo la toma un juego que pida un conteo (`enrolled_total`: `n_matriculados` sigue siendo
#'    la matrícula del aula). `nro_`, `num_` y `numero_` quedan fuera a
#'    propósito: en español nombran un identificador (`nro_seccion`, `nro_aula`),
#'    no un conteo.
#'
#' @keywords internal
.cm_aulas_par_prohibido_directo <- function(col_key, cand_keys, protegidas = .cm_aulas_claves_protegidas()) {
  col_key <- as.character(col_key)[1]
  if (is.na(col_key) || !nzchar(col_key)) return(FALSE)
  if (col_key %in% protegidas$condicion_curso &&
      !any(cand_keys %in% protegidas$condicion_curso)) {
    return(TRUE)
  }
  grepl("^(n|cant|cantidad)_", col_key) &&
    !any(cand_keys %in% protegidas$conteo)
}

#' Tercer nivel de `.cm_aulas_col()`: subcadena en los dos sentidos
#'
#' Recorre los candidatos en orden y devuelve la primera columna cuyo nombre
#' contiene al candidato (directo) o está contenido en él (inverso), saltando
#' las parejas que cada sentido prohíbe. `""` si ninguna casa.
#'
#' @keywords internal
.cm_aulas_col_por_subcadena <- function(nms, nms_key, cand_key) {
  cand_key <- cand_key[nzchar(cand_key)]
  if (!length(cand_key)) return("")
  protegidas <- .cm_aulas_claves_protegidas()
  directo_ok <- !vapply(nms_key, .cm_aulas_par_prohibido_directo, logical(1),
                        cand_keys = cand_key, protegidas = protegidas)
  for (cand in cand_key) {
    hit <- vapply(seq_along(nms_key), function(i) {
      nm <- nms_key[[i]]
      nzchar(nm) && (
        (directo_ok[[i]] && grepl(cand, nm, fixed = TRUE)) ||
          (!.cm_aulas_par_prohibido(nm, cand) && grepl(nm, cand, fixed = TRUE))
      )
    }, logical(1))
    if (any(hit)) return(nms[[which(hit)[[1]]]])
  }
  ""
}
