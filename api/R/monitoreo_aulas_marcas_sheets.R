# La EXCEPCION acotada: llevar «REFUERZO POR CONTACTAR» a la hoja del equipo.
#
# Gonzalo, 2026-09-11: «¿y se puede ver en el Sheets de agendacion para que el
# agendador sepa cual es?» — y al explicarle que «Aulas Agendadas» es del equipo
# y la app la declara `respetada`: «¿pero no se puede hacer una excepcion para
# esos casos?».
#
# Se puede, y la clave es que la regla de dueño protege LA HOJA: «SIN
# sobreescribir las dos primeras hojas, que las llenan desde el sheets, no desde
# la app» (2026-08-31). Lo que hace peligrosa una publicacion es reescribir el
# rectangulo entero encima de alguien que esta tecleando. Una escritura POR
# CELDA y CONDICIONADA no tiene ese problema, y es lo que este motor prepara.
#
# Las cuatro garantias, y ninguna es opcional:
#
#   1. **Una sola columna**: STATUS MUESTRA. Ninguna otra se toca jamas.
#   2. **Solo las filas que la app marco** como `refuerzo_por_contactar`.
#   3. **Solo si la celda remota esta libre**: vacia, «EN RESERVA» o «SIN
#      CONTACTAR». Si el equipo escribio cualquier otra cosa —incluso algo que
#      no reconocemos— se RESPETA y se reporta. La app nunca gana una carrera
#      contra quien agenda.
#   4. **Nunca borra**: sin fila que marcar no hay escritura, y una marca
#      retirada en la app no borra lo que el equipo haya puesto despues.
#
# Este archivo NO habla con la red: decide que celdas serian escribibles y por
# que las demas no. El transporte y el momento de publicar son de quien pulsa.

.mams_txt <- function(v) {
  v <- as.character(v %||% "")
  v[is.na(v)] <- ""
  trimws(v)
}

#' Estados remotos sobre los que la app PUEDE escribir su marca.
#'
#' Son los que significan «aqui todavia no hay nada decidido». Cualquier otro
#' —agendada, en contacto, rechazo, reemplazada, o un texto que no conozcamos—
#' es trabajo de alguien y se respeta.
#' @keywords internal
MONITOREO_AULAS_CELDA_LIBRE <- c("", "EN RESERVA", "SIN CONTACTAR")

#' Qué celdas de STATUS MUESTRA se pueden marcar, y cuáles se respetan.
#'
#' @param plan lista de filas del plan, con `sample_status` ya normalizado.
#' @param remoto data.frame de la hoja del equipo: una columna con el código y
#'   otra con el estado tecleado.
#' @param col_codigo,col_estado nombres de esas dos columnas en `remoto`.
#' @return lista con `escribibles` (código y fila remota, 1-based sobre
#'   `remoto`), `respetadas` (código y lo que había) y `sin_fila` (marcadas en la
#'   app que no aparecen en la hoja).
#' @export
monitoreo_aulas_marcas_por_publicar <- function(plan = list(), remoto = NULL,
                                                col_codigo = "CURSO-HORARIO",
                                                col_estado = "STATUS MUESTRA") {
  marcadas <- Filter(function(r) {
    identical(.mams_txt(r$sample_status), "refuerzo_por_contactar")
  }, plan %||% list())
  vacio <- list(escribibles = list(), respetadas = list(), sin_fila = character(0))
  if (!length(marcadas)) return(vacio)

  if (!is.data.frame(remoto) || !nrow(remoto) ||
      !all(c(col_codigo, col_estado) %in% names(remoto))) {
    # Sin hoja legible no se escribe nada: adivinar la fila es justo como se
    # pisa la celda de otro. La lista se arma entera y no con `c(vacio, ...)`:
    # eso dejaba DOS `sin_fila` y `$` devolvia el primero, que era el vacio.
    return(list(
      escribibles = list(), respetadas = list(),
      sin_fila = vapply(marcadas, function(r) .mams_txt(r$operational_code), character(1))
    ))
  }

  codigos <- toupper(.mams_txt(remoto[[col_codigo]]))
  estados <- toupper(.mams_txt(remoto[[col_estado]]))
  escribibles <- list()
  respetadas <- list()
  sin_fila <- character(0)

  for (r in marcadas) {
    cod <- .mams_txt(r$operational_code)
    if (!nzchar(cod)) next
    pos <- which(codigos == toupper(cod))
    if (!length(pos)) { sin_fila <- c(sin_fila, cod); next }
    pos <- pos[[1]]
    if (estados[[pos]] %in% MONITOREO_AULAS_CELDA_LIBRE) {
      escribibles[[length(escribibles) + 1L]] <- list(
        codigo = cod, fila = as.integer(pos), texto = "REFUERZO POR CONTACTAR")
    } else {
      # Se dice QUE habia, no solo que no se escribio: quien publica tiene que
      # poder ver si el equipo ya resolvio esa aula por su cuenta.
      respetadas[[length(respetadas) + 1L]] <- list(
        codigo = cod, fila = as.integer(pos), habia = estados[[pos]])
    }
  }
  list(escribibles = escribibles, respetadas = respetadas, sin_fila = sin_fila)
}

#' La frase que resume una publicación de marcas, con sus tres cifras.
#' @param out salida de `monitoreo_aulas_marcas_por_publicar()`.
#' @return texto.
#' @export
monitoreo_aulas_marcas_texto <- function(out) {
  n_esc <- length(out$escribibles %||% list())
  n_res <- length(out$respetadas %||% list())
  n_sin <- length(out$sin_fila %||% character(0))
  partes <- character(0)
  partes <- c(partes, sprintf("%d %s", n_esc,
    if (n_esc == 1) "celda por marcar" else "celdas por marcar"))
  if (n_res) partes <- c(partes, sprintf("%d que el equipo ya escribio y se respetan", n_res))
  if (n_sin) partes <- c(partes, sprintf("%d sin fila en la hoja", n_sin))
  paste(partes, collapse = " · ")
}
