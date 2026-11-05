# =============================================================================
# graficos_memo_evaluacion.R — memoria de un pedido para las evaluaciones de diferencias
# =============================================================================
#
# La propuesta del motor para los resúmenes (graficos_propuesta_resumen.R) recorre todas las preguntas del informe y
# prueba cada fila candidata contra cada cruce. Medido sobre CCSS (2026-11-05): de ~5,2 s, 1,1 s se iban en rearmar la
# matriz de indicadores de la MISMA pregunta (una vez por fila candidata y por cruce) y 0,7 s en rearmar los grupos del
# MISMO cruce. Aquí se recuerdan dentro de un pedido: `.gmemo_con(expr)` abre una memoria que vive mientras se evalúa
# `expr` y se suelta al salir. Fuera de ella, las funciones memorizadas calculan como siempre.
#
# No cambia ninguna cifra: se memorizan funciones deterministas (`.sig_indicadores`, `.sig_grupos_cruce`,
# `.tarjetas_evaluar_cruce`) por sus argumentos completos. Los objetos grandes (datos, instrumento, regla, familia) se
# comparan con `identical()`, que es inmediato cuando es el mismo objeto; los argumentos chicos van en la llave.

.gmemo <- new.env(parent = emptyenv())

#' ¿Hay una memoria de pedido abierta?
#' @keywords internal
.gmemo_activa <- function() !is.null(.gmemo$activo)

#' Evalúa `expr` con una memoria de pedido (si ya hay una abierta, usa ésa)
#' @keywords internal
.gmemo_con <- function(expr) {
  if (.gmemo_activa()) return(expr)
  .gmemo$activo <- new.env(parent = emptyenv())
  .gmemo$activo$slots <- list()
  on.exit(.gmemo$activo <- NULL, add = TRUE)
  expr
}

#' Llave de los argumentos chicos: distingue NULL de vacío y no confunde separadores
#' @keywords internal
.gmemo_llave <- function(...) {
  partes <- lapply(list(...), function(x) if (is.null(x)) "\u0002" else paste0("\u0003", paste(as.character(unlist(x)), collapse = "\u001e")))
  paste(unlist(partes), collapse = "\u001f")
}

#' Valor memorizado de `calcular()` para (tipo, objetos grandes, llave); sin memoria abierta, calcula
#' @param objetos Lista de los argumentos grandes; se compara con `identical()`.
#' @keywords internal
.gmemo_obtener <- function(tipo, objetos, llave, calcular) {
  m <- .gmemo$activo
  if (is.null(m)) return(calcular())
  k <- 0L
  for (i in seq_along(m$slots)) {
    s <- m$slots[[i]]
    if (identical(s$tipo, tipo) && identical(s$objetos, objetos)) { k <- i; break }
  }
  if (!k) {
    k <- length(m$slots) + 1L
    m$slots[[k]] <- list(tipo = tipo, objetos = objetos, valores = new.env(parent = emptyenv()))
  }
  valores <- m$slots[[k]]$valores
  if (exists(llave, envir = valores, inherits = FALSE)) return(get(llave, envir = valores, inherits = FALSE))
  r <- calcular()
  assign(llave, r, envir = valores)
  r
}
