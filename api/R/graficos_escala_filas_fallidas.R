# =============================================================================
# graficos_escala_filas_fallidas.R — una fila que no se puede dibujar no tumba la escala del resumen (ADR 0135)
# =============================================================================
#
# Revisión metodológica de 095e70b66, invariante 5: si una pregunta hace `stop` en la tabla de la escala (no se alinea
# con la leyenda, queda sin un lado tras las exclusiones, se vacía…), la lámina no cae entera. Esa fila sale con su
# causa como aviso y el conteo de la regla la descuenta. Fuera de la regla (preguntas declaradas a mano) la tabla sigue
# siendo estricta, como siempre.

#' Condición de una fila que falló, con su causa en plural para el aviso («quedan fuera: …»)
#' @keywords internal
.ola4_condicion_fila <- function(mensaje, motivo = NULL, ref = NULL, i = NULL) {
  structure(class = c("ola4_fila_fallida", "error", "condition"),
            list(message = mensaje, call = NULL, motivo = motivo, ref = ref, i = i))
}

#' Evalúa `expr` (en el marco de quien llama) y, si falla, relanza el error con la fila que lo causó
#' @keywords internal
.ola4_con_fila <- function(i, ref, expr) {
  tryCatch(expr, error = function(e) {
    if (inherits(e, "ola4_fila_fallida") && !is.null(e$ref)) stop(e)
    stop(.ola4_condicion_fila(conditionMessage(e), if (inherits(e, "ola4_fila_fallida")) e$motivo,
                              as.character(ref)[1], i))
  })
}

#' Causa de una fila que falló, para el aviso agregado de la regla
#' @keywords internal
.ola4_motivo_fila <- function(e) {
  if (!is.null(e$motivo)) return(e$motivo)
  msg <- conditionMessage(e)
  if (grepl("lado (negativo|positivo) vac", msg)) return("la escala queda sin un lado con sus exclusiones")
  if (grepl("vac[ií]a tras aplicar exclusiones", msg)) return("quedan vacías tras las exclusiones")
  if (grepl("frecuencias utilizables", msg)) return("no tienen respuestas")
  "no se pueden dibujar en la escala de la mayoría"
}

#' La tabla de la escala sin las filas que fallan: las saca una a una, con su causa
#'
#' @return La tabla de `.ola4_tabla_escala` más `omitidas` (lista `ref -> motivo`). Si todas fallan, `data = NULL` y
#'   `omitidas` con todas.
#' @keywords internal
.ola4_tabla_escala_tolerante <- function(refs, ...) {
  omitidas <- list()
  repeat {
    if (!length(refs)) return(list(data = NULL, omitidas = omitidas))
    r <- tryCatch(.ola4_tabla_escala(refs, ...), ola4_fila_fallida = function(e) e)
    if (!inherits(r, "ola4_fila_fallida")) break
    if (is.null(r$i)) stop(r)
    omitidas[[r$ref]] <- .ola4_motivo_fila(r)
    refs <- refs[-r$i]
  }
  if (is.null(r)) return(list(data = NULL, omitidas = omitidas))
  r$omitidas <- omitidas
  r
}

#' Aviso de las filas que la escala dejó fuera, con su causa
#' @keywords internal
.ola4_avisos_omitidas <- function(omitidas) {
  if (!length(omitidas)) return(character(0))
  .regla_preguntas_avisos(as.list(unname(unlist(omitidas))))
}
