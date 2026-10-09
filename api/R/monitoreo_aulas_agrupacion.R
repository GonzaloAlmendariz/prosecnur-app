# monitoreo_aulas_agrupacion.R — por qué se agrupa el resumen operativo.
#
# El primer bloque de Avance contesta «dónde está trabajando el equipo»:
# efectivas, aulas aplicadas y aulas planificadas, una fila por grupo. Estaba
# cableado a la FACULTAD, y para un estudio que vive dentro de una sola facultad
# eso es una tabla de una fila al 100 % — el caso degenerado que motivó el eje
# declarable, repetido aquí.
#
# Gonzalo, 2026-09-22, mirando esa fila única en el primer día de campo de CCSS
# Perfil 2026-II: «¿no sería por carrera en vez de por facultad para este
# caso?». Con carrera esa misma tabla dice algo: 25 titulares de Economía, 10 de
# Relaciones Internacionales, 8 de Finanzas, 5 de Ciencia Política y 2 de
# Antropología, y en cuál se aplicó hoy.
#
# **No es el eje de cuotas y no lo toca.** Son dos preguntas distintas y pueden
# tener respuestas distintas a la vez: la cuota de CCSS es por NIVEL y se
# resuelve por PERSONA contra el padrón; este resumen es por AULA, porque cuenta
# aulas planificadas y aplicadas. Meterlas en una sola declaración obligaría a
# que un estudio eligiera entre medir bien y resumir bien.
#
# **Y la atribución tiene que ser del aula**, por eso esta agrupación sólo
# admite dimensiones cuyo valor esté en la fila del plan. Una agrupación por
# nivel diría el nivel MODAL del aula —lo que el marco calculó para
# dimensionar—, no el de nadie en concreto, y «10 efectivas de nivel 7» sería
# falso para las de 6 y 8 que estaban en la misma aula. Se degrada a facultad y
# se declara el motivo; no se publica una cifra que no significa lo que su
# rótulo promete.

#' Por qué dimensión se agrupa el resumen operativo de Avance.
#'
#' @param cfg config de aulas universitarias (o la config completa).
#' @return la lista del eje que agrupa, con `motivo_degradacion` cuando la
#'   declaración no se pudo respetar. Sin declaración, `facultad`: lo que el
#'   código hacía ya.
#' @export
monitoreo_aulas_agrupacion <- function(cfg = list()) {
  if (!is.list(cfg)) cfg <- list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else cfg
  clave <- .monitoreo_text_key(.monitoreo_scalar(aulas[["agrupacion_operativa"]] %||% "", ""))
  motivo <- ""
  if (nzchar(clave) && is.null(.MONITOREO_AULAS_EJES[[clave]])) {
    motivo <- sprintf(
      "El estudio declara agrupar el resumen por «%s» y esa dimensión no existe; se agrupa por facultad.",
      clave)
    clave <- ""
  }
  if (nzchar(clave)) {
    candidato <- .MONITOREO_AULAS_EJES[[clave]]
    if (!identical(.monitoreo_scalar(candidato$atribucion, "aula"), "aula")) {
      motivo <- sprintf(
        paste0("El resumen cuenta AULAS, así que sólo puede agruparse por lo que dice la fila del ",
               "plan. «%s» se resuelve por persona, así que se agrupa por facultad."),
        .monitoreo_scalar(candidato$etiqueta, clave))
      clave <- ""
    }
  }
  if (!nzchar(clave)) clave <- "facultad"
  out <- .MONITOREO_AULAS_EJES[[clave]]
  out$motivo_degradacion <- motivo
  out
}

#' La declaración publicable de la agrupación.
#'
#' Viaja con el bloque porque quien publica una cifra dice de qué es: sin ella
#' el mismo payload significa dos cosas y el rótulo de la pantalla tendría que
#' adivinar cuál.
#'
#' @param agr salida de [monitoreo_aulas_agrupacion()].
#' @return lista con `clave`, `columna`, `etiqueta`, `etiqueta_plural`,
#'   `etiqueta_sin` y `motivo_degradacion`.
#' @export
monitoreo_aulas_agrupacion_declaracion <- function(agr = NULL) {
  if (!is.list(agr) || !length(agr)) agr <- monitoreo_aulas_agrupacion(list())
  list(
    clave = .monitoreo_scalar(agr$clave, "facultad"),
    columna = .monitoreo_scalar(agr$columna, "faculty"),
    etiqueta = .monitoreo_scalar(agr$etiqueta, "Facultad"),
    etiqueta_plural = .monitoreo_scalar(agr$etiqueta_plural, "Facultades"),
    etiqueta_sin = .monitoreo_scalar(agr$etiqueta_sin, "Sin facultad"),
    motivo_degradacion = .monitoreo_scalar(agr$motivo_degradacion, "")
  )
}
