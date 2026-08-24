# =============================================================================
# Avance por celda facultad x sexo, con calibracion
# =============================================================================
#
# POR QUE EXISTE
#
# La celda de cuota sabia dos cosas: cuanto pide (`target`) y cuanto lleva
# (`observed`). Con eso se puede decir si YA llegaste, no si VAS a llegar, y
# cuando «ya no llegaste» es tarde.
#
# Faltaba ademas una tercera lectura que no es el avance: **si el campo se esta
# comportando como el modelo dice**. Son preguntas distintas y la segunda avisa
# antes:
#
#   logrado    lo obtenido de ese sexo, acumulado
#   previsto   lo que las aulas YA APLICADAS debian aportar de ese sexo
#   proyectado logrado + lo que aportaran las aulas PENDIENTES
#   calibracion  logrado / previsto  <- la pieza nueva
#
# La calibracion detecta un sesgo sistematico mientras todavia quedan aulas por
# delante. Y hay motivo para mirarla: en el campo 2025 la composicion lograda se
# desvio **+3,4 pp hacia mujeres** (meta 48,2 %, logrado 51,6 %), con **10 de 14
# facultades en la misma direccion** —GESTION +9,2, GASTRONOMIA +8,9, ARTES
# ESCENICAS +5,5, EE.GG. LETRAS +5,2—. Que EE.GG. LETRAS hombres fuera la unica
# celda incumplida de ese año no fue mala suerte: es la consecuencia previsible
# de ese sesgo en la facultad con el cuarto desvio mas grande.
#
# LO QUE ESTE MOTOR NO HACE
#
# **No corrige el modelo.** La decision de Gonzalo (2026-08-24) es reportar la
# calibracion y esperar a que 2026 confirme el sesgo con padron por sexo de cada
# aula antes de aplicar una tasa diferencial. Con los datos de 2025 no se puede
# separar «visitamos aulas con mas mujeres» de «las mujeres responden mas»,
# porque falta ese padron. Publicar el numero es lo que permite decidirlo
# despues; aplicarlo ahora seria calibrar contra una hipotesis.

MONITOREO_AULAS_CALIBRACION_SCHEMA <- "monitoreo_aulas_avance_sexo_facultad_v1"

# Umbral de margen para `ajustada`, en proporcion de la cuota. 5 % es la
# decision de Gonzalo (2026-08-24), declarada revisable.
.MAC_MARGEN_AJUSTADA <- 0.05

#' Estado de cobertura PROYECTADA de una celda.
#'
#' A diferencia de `.monitoreo_aulas_quota_estado`, que es retrospectivo, este
#' mira hacia adelante y por eso SI usa el vocabulario proyectivo. Los dos
#' conviven a proposito: uno dice donde estas y el otro si vas a llegar.
#'
#' `deficit_no_subsanable` es el unico que no se puede afirmar sin saber si
#' queda pool: con `pool_restante = NA` un deficit se queda en
#' `deficit_proyectado`, que pide una accion posible, en vez de declarar una
#' derrota que quiza no lo sea.
#'
#' @param cuota meta de la celda.
#' @param proyeccion logrado + aporte esperado de lo pendiente.
#' @param pool_restante aulas disponibles fuera del plan para esa celda; `NA` si
#'   no se sabe.
#' @return vector de estados.
#' @keywords internal
.mac_estado_proyectado <- function(cuota, proyeccion, pool_restante = NA_real_) {
  cuota <- suppressWarnings(as.numeric(cuota))
  proyeccion <- suppressWarnings(as.numeric(proyeccion))
  pool <- suppressWarnings(as.numeric(pool_restante))
  n <- max(length(cuota), length(proyeccion))
  cuota <- rep_len(cuota, n); proyeccion <- rep_len(proyeccion, n); pool <- rep_len(pool, n)
  cuota[!is.finite(cuota)] <- 0
  proyeccion[!is.finite(proyeccion)] <- 0
  ifelse(cuota <= 0, "sin_cuota",
  ifelse(proyeccion >= cuota * (1 + .MAC_MARGEN_AJUSTADA), "asegurada",
  ifelse(proyeccion >= cuota, "ajustada",
  ifelse(is.finite(pool) & pool <= 0, "deficit_no_subsanable", "deficit_proyectado"))))
}

#' Brecha de una celda, en personas.
#'
#' **Hacia ARRIBA y entera**: si faltan 0,1 encuestas falta una persona, y con
#' cero la celda sigue corta. Es el unico sitio del avance donde se redondea
#' hacia arriba, porque es lo unico que se PIDE.
#'
#' @param cuota meta de la celda.
#' @param proyeccion logrado + aporte esperado de lo pendiente.
#' @return entero >= 0.
#' @keywords internal
.mac_brecha <- function(cuota, proyeccion) {
  cuota <- suppressWarnings(as.numeric(cuota))
  proyeccion <- suppressWarnings(as.numeric(proyeccion))
  cuota[!is.finite(cuota)] <- 0
  proyeccion[!is.finite(proyeccion)] <- 0
  as.integer(pmax(0, ceiling(cuota - proyeccion)))
}

#' Calibracion de una celda: lo logrado contra lo que se preveia.
#'
#' `NA` sin previsto: una celda cuyas aulas aun no se aplican no esta
#' descalibrada, es que todavia no hay con que comparar. Devolver 0 la pintaria
#' de rojo el primer dia de campo.
#'
#' @param logrado efectivas obtenidas de ese sexo.
#' @param previsto lo que las aulas ya aplicadas debian aportar.
#' @return razon o `NA`.
#' @keywords internal
.mac_calibracion <- function(logrado, previsto) {
  logrado <- suppressWarnings(as.numeric(logrado))
  previsto <- suppressWarnings(as.numeric(previsto))
  ifelse(is.finite(previsto) & previsto > 0 & is.finite(logrado), logrado / previsto, NA_real_)
}
