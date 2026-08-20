# ¿La base de respuestas arrastra identificadores personales?
#
# Este control existía como `student_id_required` con el estado escrito a mano:
# `"ok"` siempre, y el detalle «No se exige identificador personal de
# estudiante». Eso no es un control, es una **declaración de diseño del
# estudio**: no puede fallar, no mira nada, y sin embargo contaba entre las
# reglas evaluadas y entre los correctos de la pantalla.
#
# Lo que sí hace falta comprobar es lo contrario y es serio: un estudio de aulas
# se aplica bajo promesa de anonimato —el QR se escanea en clase, delante del
# docente— y si la base trae correo, celular, DNI o nombre, esa promesa está
# rota en los datos aunque nadie lo haya pedido.
#
# **No se reimplanta la detección**: `pulso_pii_inventario()` ya clasifica
# columnas por su nombre y su clasificador ya aprendió sus propias trampas
# —enunciados de pregunta largos, «nombre del curso» que no es una persona—.
# Escribir una segunda lista de patrones aquí sería tener dos definiciones de
# «identificador personal» que se separan a la primera corrección.

#' Identificadores personales en la base de respuestas de un estudio de aulas.
#'
#' @param responses base de respuestas.
#' @param anonimo `TRUE` si el estudio se declara de respuestas anónimas.
#' @return lista con `status`, `detail` y `columnas`.
#' @export
monitoreo_aulas_identificadores <- function(responses = data.frame(), anonimo = TRUE) {
  if (!is.data.frame(responses) || !ncol(responses) || !nrow(responses)) {
    # El cuarto estado: sin base no se puede comprobar, y decir «ok» aquí sería
    # el verde por ausencia que ya se corrigió en el control de duplicados.
    return(list(
      status = "sin_datos",
      detail = "Todavia no hay base de respuestas con que comprobarlo.",
      columnas = list()
    ))
  }
  inventario <- pulso_pii_inventario(responses)
  # Con datos dentro: una columna PII vacia en las 3 700 filas es una columna
  # que el formulario declara y nadie llena, y acusar al estudio por una
  # cabecera vacia gasta la atencion que este control necesita conservar.
  con_datos <- if (nrow(inventario)) inventario[inventario$n_no_vacios > 0L, , drop = FALSE] else inventario
  # El GPS no es identificador personal en este perfil: un estudio de aulas
  # aplica dentro de un aula cuya ubicacion ya esta en el plan, asi que la
  # coordenada no señala a una persona.
  con_datos <- con_datos[con_datos$tipo != "gps", , drop = FALSE]
  if (!nrow(con_datos)) {
    return(list(
      status = "ok",
      detail = "La base no trae columnas de identificacion personal con datos.",
      columnas = list()
    ))
  }
  cols <- as.character(con_datos$columna)
  detalle <- sprintf(
    "%d columna%s de identificacion personal con datos: %s.%s",
    length(cols), if (length(cols) == 1L) "" else "s",
    paste(utils::head(cols, 5L), collapse = ", "),
    if (length(cols) > 5L) sprintf(" y %d mas.", length(cols) - 5L) else ""
  )
  list(
    # Que el estudio NO se declare anonimo no vuelve inocuo el hallazgo: sigue
    # siendo dato personal en una base que viaja. Baja de «revisar» a
    # «advertencia» porque ahi es una decision tomada, no una sorpresa.
    status = if (isTRUE(anonimo)) "review" else "warning",
    detail = if (isTRUE(anonimo)) {
      paste("El estudio se declara de respuestas anonimas y", detalle)
    } else {
      paste0(toupper(substring(detalle, 1, 1)), substring(detalle, 2))
    },
    columnas = as.list(cols)
  )
}
