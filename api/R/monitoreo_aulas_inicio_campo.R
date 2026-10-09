# monitoreo_aulas_inicio_campo.R — lo anterior al campo no es el campo.
#
# Un operativo se ensaya antes de arrancar: capacitación con el formulario
# abierto, pruebas del enlace, el piloto del coordinador. Esos envíos son
# encuestas correctas —pasan cualquier filtro de validez— y no son recolección.
#
# `descartes` ya saca los que traen un QR reconocible («CAPACITACION»,
# «PRUEBA»), pero **no puede alcanzar a los que no traen ninguno**: casa valores
# de una columna, y una respuesta abierta por el enlace del formulario no tiene
# valor que casar. Quedan dentro, y contaminan justo lo que se mira para decidir
# si el campo va bien.
#
# Medido el 2026-09-22, primer día de campo de CCSS Perfil 2026-II: once envíos
# del 15 de setiembre —una semana antes, sin recopilador, de la capacitación—
# seguían en el ritmo. El panel publicaba «83 respuestas en 2 días de
# recolección · 42 al día · faltan 338 · 9 días más al ritmo de estos 2». El
# campo llevaba UN día con 72, y a ese ritmo faltaban cinco, no nueve. La media
# salía de promediar un día de campo con uno de ensayo.
#
# **Por qué una fecha y no otra regla de valores.** La propiedad que separa el
# ensayo del campo es CUÁNDO, no qué trae. Declararla es una línea y se lee
# sola; perseguirla por colectores obliga a enumerar lo que no existe.
#
# **Y una respuesta sin fecha legible NUNCA se descarta.** No se puede afirmar
# que sea anterior al campo, y descartar por no poder comprobarlo es el defecto
# que este archivo existe para no cometer.

#' Qué respuestas son anteriores al arranque del campo.
#'
#' @param data `data.frame` de respuestas.
#' @param cfg config de aulas universitarias (o la config completa).
#' @return vector lógico, una entrada por fila. Todo `FALSE` si el estudio no
#'   declara `inicio_campo`, si la fecha no es legible o si la base no trae
#'   ninguna columna de fecha.
#' @export
monitoreo_aulas_antes_del_campo <- function(data, cfg = list()) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  if (!n) return(logical(0))
  if (!is.list(cfg)) cfg <- list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else cfg
  inicio <- .maic_dia(.monitoreo_scalar(aulas[["inicio_campo"]] %||% "", ""))
  if (!nzchar(inicio)) return(rep(FALSE, n))
  # **La MISMA columna y la MISMA lectura que el ritmo.** Si esto resolviera la
  # fecha por su cuenta, una respuesta podría ser anterior al campo para el
  # criterio y del día 22 para la serie, y las dos pantallas dirían cosas
  # distintas de la misma fila.
  col <- .monitoreo_aulas_col(data, MONITOREO_AULAS_COLUMNAS_FECHA)
  if (!nzchar(col)) return(rep(FALSE, n))
  dia <- .mar_dia(data[[col]])
  nzchar(dia) & dia < inicio
}

# Un día ISO, o "" si no lo es. Mismo corte que `.mar_dia`, para que la fecha
# declarada y la de las respuestas se comparen en el mismo formato.
.maic_dia <- function(x) {
  d <- .mar_dia(x)
  if (length(d) != 1L) return("")
  d
}
