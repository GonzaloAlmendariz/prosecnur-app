# Un parámetro fuera de rango no se corrige en silencio.
#
# `.cm_normalize_parametros` reemplaza por su default cualquier valor fuera de
# rango: un error de 3 (quien quiso decir 3 %) pasaba a 0.05, un deff de 0.8
# a 1.5, y p = 0 daba n = 0 sin error (research H04, H20). El estudio se
# guarda entero desde la mesa, así que rechazar el valor bloquearía el
# guardado de todo lo demás; en cambio, cada corrección queda DECLARADA en el
# componente (`avisos_parametros`: qué se recibió y qué se usó) y viaja al
# resultado, donde se lee junto al n.
#
# Un aviso se conserva mientras el parámetro siga valiendo lo que se usó en
# su lugar: si el usuario lo cambia, el aviso cae solo.

.CM_PARAMETROS_ROTULO <- c(
  z = "nivel de confianza (z)", p = "proporción esperada (p)",
  e = "margen de error (e)", deff = "efecto de diseño (deff)",
  tasa_respuesta = "tasa de respuesta", oversample_pct = "sobremuestra",
  tasa_contacto = "tasa de contacto", tasa_elegibilidad = "tasa de elegibilidad",
  cobertura_objetivo = "cobertura objetivo",
  cv = "coeficiente de variación (CV)"
)

.cm_aviso_parametro_texto <- function(param, recibido, usado) {
  rotulo <- .CM_PARAMETROS_ROTULO[[param]] %||% param
  pista <- if (identical(param, "e") && is.numeric(recibido) && recibido >= 1 && recibido <= 50) {
    sprintf(" Si quisiste decir %s %%, escribe %s.", format(recibido), format(recibido / 100))
  } else if (identical(param, "p") && is.numeric(recibido) && recibido %in% c(0, 1)) {
    " Con p = 0 o p = 1 la varianza es cero y n sale 0; sin estimación previa, 0.5 es lo conservador."
  } else ""
  sprintf("Valor fuera de rango en %s: llegó %s y se usó %s.%s",
          rotulo, format(recibido), format(usado), pista)
}

# `crudo`: los parámetros tal como llegaron. `norm`: ya normalizados.
# `previos`: los avisos que el componente traía.
.cm_general_avisos_parametros <- function(crudo, norm, previos = list()) {
  if (!is.list(crudo)) crudo <- list()
  nuevos <- list()
  for (param in intersect(names(.CM_PARAMETROS_ROTULO), names(norm))) {
    r <- crudo[[param]]
    if (is.null(r) || length(r) != 1L) next
    r_num <- suppressWarnings(as.numeric(r))
    if (is.na(r_num)) next
    if (isTRUE(all.equal(r_num, as.numeric(norm[[param]])))) next
    nuevos[[param]] <- list(
      param = param, recibido = r_num, usado = as.numeric(norm[[param]]),
      texto = .cm_aviso_parametro_texto(param, r_num, as.numeric(norm[[param]]))
    )
  }
  for (a in previos %||% list()) {
    if (!is.list(a) || is.null(a$param) || !is.null(nuevos[[a$param]])) next
    actual <- norm[[a$param]]
    if (!is.null(actual) && isTRUE(all.equal(as.numeric(actual), as.numeric(a$usado)))) {
      nuevos[[a$param]] <- a
    }
  }
  unname(nuevos)
}
