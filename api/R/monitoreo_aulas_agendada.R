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
