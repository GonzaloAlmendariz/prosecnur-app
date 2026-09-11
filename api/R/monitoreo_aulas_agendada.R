# Un curso-horario AGENDADO: la definicion, en un solo sitio.
#
# Gonzalo, 2026-09-11: «que el motor proyecte tambien solo sobre lo agendado
# (que finalmente es lo que mas importa siempre, porque es lo que tenemos)».
#
# El predicado ya existia escrito dos veces —en el tramo de `application_state`
# de `monitoreo_aulas_universitarias.R` y a mano en el frontend— y la proyeccion
# nueva necesitaba una tercera. Una definicion por pregunta: aqui vive, y los
# tres la llaman.
#
# **Las DOS vias, y por que hacen falta las dos.** El estado de muestra
# (`agendada`/`reagendada`) lo teclea quien coordina en cuanto el docente acepta;
# el operativo (`agendada`/`contactada`) lo llena el registro de campo y llega
# tarde. Mirar solo el operativo dejo 22 aulas con fecha rotuladas «Sin
# agendar» sobre el estudio de 196.
MONITOREO_AULAS_MUESTRA_AGENDADA <- c("agendada", "reagendada")
MONITOREO_AULAS_OPERATIVO_AGENDADA <- c("agendada", "contactada")

#' Si cada fila esta agendada, mirando sus dos ejes de estado.
#'
#' @param sample_status estado de muestra, tal cual viene del frame.
#' @param operational_status estado operativo, tal cual viene del frame.
#' @return vector logico del largo de la entrada.
#' @keywords internal
.maau_agendada <- function(sample_status, operational_status) {
  norm <- function(v) {
    # **`%||%` NO sirve aqui.** El del paquete trata NA como nulo, asi que una
    # columna de estados toda NA volvia `character(0)` y la funcion devolvia un
    # logico de largo cero en vez de un FALSE por fila: el resultado dejaba de
    # alinearse con el frame y el filtro de mas arriba se torcia en silencio.
    if (is.null(v)) return(character(0))
    v <- as.character(v)
    v[is.na(v)] <- ""
    tolower(trimws(v))
  }
  muestra <- norm(sample_status)
  operativo <- norm(operational_status)
  n <- max(length(muestra), length(operativo))
  if (!n) return(logical(0))
  length(muestra) <- n
  length(operativo) <- n
  muestra[is.na(muestra)] <- ""
  operativo[is.na(operativo)] <- ""
  muestra %in% MONITOREO_AULAS_MUESTRA_AGENDADA |
    operativo %in% MONITOREO_AULAS_OPERATIVO_AGENDADA
}


# --- y la otra pregunta: ¿hay FECHA? -----------------------------------------
#
# `.maau_agendada()` contesta «¿esto ya está en marcha?» —y por eso cuenta
# `contactada`, que es lo que evita rotular «Sin agendar» a un aula que alguien
# ya está gestionando—. Para PROYECTAR aforo esa no es la pregunta.
#
# Medido en HSVG26ULT2 el 2026-09-11: Derecho tenia 6 cursos-horario con fecha y
# otros 6 en `en_contacto`. Contando los doce, su proyeccion sobre «lo agendado»
# pasaba de 234 elegibles a 488 y la facultad salia holgada; con los seis reales
# no. Gonzalo lo habia dicho la misma manana: «un CH puede estar en titulares
# (planificado) pero hasta que no este agendado no sabemos realmente si vamos a
# poder aplicar alli o no». Estar llamando al docente no es tener fecha.
#
# Una definicion por pregunta: dos predicados, dos nombres, y ningun sitio
# eligiendo el que mas le convenga.

#' Si cada fila tiene FECHA comprometida: es lo unico que se puede aplicar.
#'
#' @param sample_status estado de muestra.
#' @param scheduled_date fecha agendada, tal cual viene del frame.
#' @param operational_status estado operativo.
#' @return vector logico del largo de la entrada.
#' @keywords internal
.maau_con_fecha <- function(sample_status, scheduled_date, operational_status = NULL) {
  norm <- function(v) {
    if (is.null(v)) return(character(0))
    v <- as.character(v)
    v[is.na(v)] <- ""
    tolower(trimws(v))
  }
  muestra <- norm(sample_status)
  fecha <- norm(scheduled_date)
  operativo <- norm(operational_status)
  n <- max(length(muestra), length(fecha), length(operativo))
  if (!n) return(logical(0))
  for (nm in c("muestra", "fecha", "operativo")) {
    v <- get(nm)
    length(v) <- n
    v[is.na(v)] <- ""
    assign(nm, v)
  }
  # `contactada` NO entra: contactar no es agendar. El estado OPERATIVO
  # `agendada` si, porque ahi el registro de campo ya confirmo la cita.
  muestra %in% MONITOREO_AULAS_MUESTRA_AGENDADA |
    operativo %in% "agendada" |
    nzchar(fecha)
}
