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

# Etiquetas para persona, no para programa.
#
# Gonzalo (2026-08-24): «que la informacion de los graficos e indicadores no sea
# muy criptica en la app sino que se entienda claramente sin caer en jerga».
# `deficit_no_subsanable` es una clave correcta y una etiqueta pesima: la clave
# viaja en el payload y la frase es lo que lee quien decide.
#
# Cada etiqueta dice lo que PASA y, cuando hace falta, cuanto: «faltan 3
# encuestas» manda a alguien a un aula; «deficit proyectado» no.
.mac_etiqueta_estado <- function(estado, brecha = NA_integer_) {
  b <- suppressWarnings(as.integer(brecha)[1])
  switch(as.character(estado)[1],
    sin_cuota = "Sin cuota trazada",
    asegurada = "Va a llegar, con margen",
    ajustada = "Va a llegar, sin margen: hay que vigilarla",
    deficit_proyectado = if (is.finite(b) && b > 0)
      sprintf("No va a llegar: %s", if (b == 1L) "falta 1 encuesta" else sprintf("faltan %d encuestas", b))
      else "No va a llegar",
    deficit_no_subsanable = if (is.finite(b) && b > 0)
      sprintf("No va a llegar y ya no quedan aulas: %s y habra que ponderar",
              if (b == 1L) "falta 1 encuesta" else sprintf("faltan %d encuestas", b))
      else "No va a llegar y ya no quedan aulas: habra que ponderar",
    "Sin estado"
  )
}

# La calibracion en una frase. El numero solo -0,85- no dice ni en que direccion
# ni de que; la frase dice las dos cosas y no usa la palabra «calibracion».
.mac_etiqueta_calibracion <- function(cal) {
  c1 <- suppressWarnings(as.numeric(cal)[1])
  if (!is.finite(c1)) return("Todavia sin aulas aplicadas con que comparar")
  pct <- round(abs(c1 - 1) * 100)
  if (pct < 1) return("El campo esta rindiendo lo previsto")
  sprintf("El campo esta rindiendo un %d %% %s de lo previsto", pct,
          if (c1 < 1) "menos" else "mas")
}

#' Avance por celda facultad x sexo, con las cuatro series.
#'
#' @param plan lista de filas del plan; cada una con `faculty`,
#'   `operational_status` y los esperados por sexo (`mujeres_esperadas`,
#'   `hombres_esperados`).
#' @param cuotas lista de celdas con `faculty`, `sex`, `target`, `observed`.
#' @param pool_restante lista opcional `facultad|sexo -> aulas disponibles`.
#' @return lista de celdas con logrado, previsto, proyeccion, calibracion,
#'   brecha, estado y sus etiquetas.
#' @export
monitoreo_aulas_avance_sexo_facultad <- function(plan = list(), cuotas = list(),
                                                 pool_restante = list()) {
  if (!length(cuotas)) return(list())
  # Los esperados por sexo se acumulan separando APLICADAS de PENDIENTES: el
  # previsto es el denominador de la calibracion y solo puede contar aulas que
  # ya ocurrieron. Meter las pendientes ahi pintaria de rojo el primer dia.
  acc <- new.env(parent = emptyenv())
  campo <- c(F = "mujeres_esperadas", M = "hombres_esperados")
  for (fila in plan) {
    if (!is.list(fila)) next
    fac <- .monitoreo_text_key(.monitoreo_scalar(fila$faculty %||% "", ""))
    if (!nzchar(fac)) next
    aplicada <- identical(.monitoreo_aulas_status(fila$operational_status %||% ""), "aplicada")
    for (sx in names(campo)) {
      v <- suppressWarnings(as.numeric(.monitoreo_scalar(fila[[campo[[sx]]]], NA))[1])
      if (!is.finite(v)) next
      k <- paste0(fac, "|", sx, "|", if (aplicada) "ap" else "pe")
      acc[[k]] <- (acc[[k]] %||% 0) + v
    }
  }
  lapply(cuotas, function(celda) {
    fac <- .monitoreo_text_key(.monitoreo_scalar(celda$faculty %||% "", ""))
    sx <- toupper(.monitoreo_scalar(celda$sex %||% "", ""))
    cuota <- suppressWarnings(as.numeric(.monitoreo_scalar(celda$target %||% 0, 0))[1])
    logrado <- suppressWarnings(as.numeric(.monitoreo_scalar(celda$observed %||% 0, 0))[1])
    previsto <- acc[[paste0(fac, "|", sx, "|ap")]] %||% NA_real_
    pendiente <- acc[[paste0(fac, "|", sx, "|pe")]] %||% 0
    proyeccion <- (if (is.finite(logrado)) logrado else 0) + pendiente
    pool <- suppressWarnings(as.numeric(pool_restante[[paste0(fac, "|", sx)]] %||% NA_real_)[1])
    estado <- .mac_estado_proyectado(cuota, proyeccion, pool)
    brecha <- .mac_brecha(cuota, proyeccion)
    cal <- .mac_calibracion(logrado, previsto)
    list(
      faculty = .monitoreo_scalar(celda$faculty %||% "", ""), sex = sx,
      cuota = cuota, logrado = logrado,
      previsto = if (is.finite(previsto)) round(previsto, 1) else NA_real_,
      aporte_pendiente = round(pendiente, 1),
      proyeccion = round(proyeccion, 1),
      brecha = brecha,
      calibracion = if (is.finite(cal)) round(cal, 3) else NA_real_,
      estado = estado,
      etiqueta = .mac_etiqueta_estado(estado, brecha),
      etiqueta_calibracion = .mac_etiqueta_calibracion(cal)
    )
  })
}
