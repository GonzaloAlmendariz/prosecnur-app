# El aviso de cobertura de facultades dice CUAL falta y POR QUE puede faltar.
#
# El mensaje anterior era "Cada componente P1/P2 debe cubrir exactamente las
# facultades del marco vigente", con las facultades sólo en `details`. Sobre el
# estudio real de 2026 eso deja al usuario bloqueado sin nada que hacer: el
# calculo devuelve 409 y la pantalla repite la frase, que describe el hecho y no
# la causa.
#
# La causa medida es que la facultad del CURSO y la facultad del ESTUDIANTE son
# cosas distintas. El marco enumera cursos-horario por la facultad del curso; el
# estudio declara estratos por la facultad del estudiante. Un curso de Civil
# catalogado bajo Escuela de Posgrado entra en el primero y no en el segundo, y
# el contrato pide entonces una facultad que el estudio no puede declarar.
#
# En el proyecto real eran exactamente dos cursos-horario —`1civ15_0001` y
# `1civ26_0001`, 33 matriculas elegibles entre los dos— y ninguno de sus alumnos
# pertenecia a Escuela de Posgrado.

# Cuantas facultades se nombran antes de resumir. Con mas, el mensaje deja de
# leerse y el detalle estructurado sigue estando completo en `details`.
.cm_alumnos_ch_cobertura_max_nombres <- 4L

.cm_alumnos_ch_lista_legible <- function(keys) {
  keys <- as.character(unlist(keys, use.names = FALSE))
  keys <- keys[!is.na(keys) & nzchar(keys)]
  if (!length(keys)) return("")
  if (length(keys) <= .cm_alumnos_ch_cobertura_max_nombres) {
    return(paste(keys, collapse = ", "))
  }
  paste0(
    paste(keys[seq_len(.cm_alumnos_ch_cobertura_max_nombres)], collapse = ", "),
    sprintf(" y %d más", length(keys) - .cm_alumnos_ch_cobertura_max_nombres)
  )
}

#' Mensaje del fallo de cobertura de facultades.
#'
#' `faltantes` son facultades que el marco pide y el estudio no declara;
#' `sobrantes`, al reves. Las dos situaciones tienen causas y salidas
#' distintas, asi que el mensaje las separa en vez de decir "no coinciden".
.cm_alumnos_ch_mensaje_cobertura <- function(faltantes, sobrantes) {
  faltan <- .cm_alumnos_ch_lista_legible(faltantes)
  sobran <- .cm_alumnos_ch_lista_legible(sobrantes)
  partes <- character(0)
  if (nzchar(faltan)) {
    partes <- c(partes, paste0(
      "El marco tiene cursos-horario de ", faltan,
      " y el estudio no la declara como facultad. Suele pasar cuando un curso ",
      "está catalogado bajo una facultad a la que no pertenece ninguno de sus ",
      "alumnos elegibles: revisa el criterio de coherencia de facultad en ",
      "Marco › Cursos-horario, o incluye esa facultad en el estudio."
    ))
  }
  if (nzchar(sobran)) {
    partes <- c(partes, paste0(
      "El estudio declara ", sobran,
      " y el marco vigente no tiene ningún curso-horario elegible ahí: ",
      "esa facultad no puede recibir cuota."
    ))
  }
  if (!length(partes)) {
    # Sin ninguna de las dos listas no hay nada concreto que decir, y prometer
    # una causa que no se midio seria peor que el mensaje generico.
    return("Cada componente P1/P2 debe cubrir exactamente las facultades del marco vigente.")
  }
  paste(partes, collapse = " ")
}
