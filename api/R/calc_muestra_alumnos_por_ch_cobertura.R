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

# Las facultades viajan indexadas por clave («consorcio_de_universidades») y ese
# es el nombre que acababa en pantalla: en el aviso se leia como un
# identificador de base de datos, no como una facultad. Un nombre que ya viene
# legible —con espacios— no se toca.
.cm_alumnos_ch_nombre_legible <- function(key) {
  if (grepl(" ", key, fixed = TRUE)) return(key)
  texto <- gsub("_", " ", key, fixed = TRUE)
  texto <- trimws(texto)
  if (!nzchar(texto)) return(key)
  paste0(toupper(substr(texto, 1, 1)), substr(texto, 2, nchar(texto)))
}

.cm_alumnos_ch_lista_legible <- function(keys) {
  keys <- as.character(unlist(keys, use.names = FALSE))
  keys <- keys[!is.na(keys) & nzchar(keys)]
  keys <- vapply(keys, .cm_alumnos_ch_nombre_legible, character(1), USE.NAMES = FALSE)
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
    # OJO con la salida que se ofrece aqui. Se probo mandar a «Facultades
    # excluidas (Marco > Cursos-horario)» y NO desbloquea: medido en el
    # recorrido, excluirla del marco la deja igualmente declarada en los
    # estratos del componente —que es lo que esta comparacion mira
    # (`seen` del componente contra las claves del contrato del marco, en
    # calc_muestra_alumnos_por_ch.R ~498)— y el fallo se repite. La unica
    # salida veraz que se puede afirmar hoy es la que devuelve aulas elegibles
    # a esa facultad; regenerar el reparto sin ella es una decision de diseño
    # pendiente, y prometerla seria mandar a girar la perilla equivocada.
    partes <- c(partes, paste0(
      "El estudio declara ", sobran,
      " y el marco vigente no tiene ningún curso-horario elegible ahí: ",
      "esa facultad no puede recibir cuota. Revisa en Marco › Cursos-horario ",
      "qué criterio dejó sus aulas fuera: mientras el estudio pida cuota ahí y ",
      "el marco no tenga aulas, el cálculo no puede repartir."
    ))
  }
  if (!length(partes)) {
    # Sin ninguna de las dos listas no hay nada concreto que decir, y prometer
    # una causa que no se midio seria peor que el mensaje generico.
    return("Cada componente P1/P2 debe cubrir exactamente las facultades del marco vigente.")
  }
  paste(partes, collapse = " ")
}
