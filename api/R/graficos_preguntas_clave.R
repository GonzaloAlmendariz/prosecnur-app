# =============================================================================
# graficos_preguntas_clave.R — las preguntas clave del estudio (`plan$preguntas_clave`)
# =============================================================================
#
# H14 del checklist de usabilidad del editor (2026-11-05). Gonzalo: «¿cuáles son los criterios para decir que esos son
# los principales hallazgos?». La selección automática del resumen ejecutivo elegía la cifra «más rotunda» (la más lejos
# del 50 %), que no mide importancia. Ahora el analista marca en el editor las preguntas clave del estudio y la selección
# automática las prefiere (graficos_hallazgos_resumen.R y graficos_resumen_diferencias.R).
#
# Contrato del plan: `preguntas_clave` es una lista de referencias de variable escritas como en los gráficos del plan
# (`var` sin base o `base$var`). Vacía o ausente, el estudio no tiene preguntas clave y la selección sigue la regla de
# siempre. La config la guarda como lista de textos únicos (siempre un arreglo en JSON) y la quita si queda vacía.
#
# Cómo llega al motor: el render no recibe el plan raíz, sólo las láminas. Viaja en el contexto del informe
# (`prosecnur.sig_informe`, el mismo que lleva la regla de diferencias): el worker del PPT y del Word la toma del plan del
# pedido (`.sig_informe_preparar`) y la vista previa, las miniaturas y la propuesta, de la config efectiva
# (`.graficos_preview_comun`). Ahí ya va resuelta para la base que se lee: una referencia `base$var` de otra base no
# cuenta, y queda el nombre de la variable sin la base.

#' Normaliza `plan$preguntas_clave` para guardarla: lista de textos únicos, o NULL si no queda ninguna
#' @keywords internal
.preguntas_clave_normalizar <- function(x) {
  v <- .dif_chr(x)
  if (!length(v)) return(NULL)
  as.list(unique(v))
}

#' Variables clave que cuentan para una base: sin la base delante y sin las de otra base
#' @param x Referencias del plan (`var` o `base$var`).
#' @param base Base que se lee; vacía, cuentan todas.
#' @return Vector de nombres de variable, únicos y en el orden del plan.
#' @keywords internal
.preguntas_clave_locales <- function(x, base = "") {
  v <- .dif_chr(x)
  if (!length(v)) return(character(0))
  base <- as.character(base %||% "")[1]
  con_base <- grepl("$", v, fixed = TRUE)
  prefijo <- ifelse(con_base, sub("\\$.*$", "", v), "")
  quedan <- !con_base | is.na(base) | !nzchar(base) | prefijo == base
  unique(sub("^.*\\$", "", v[quedan]))
}

#' Pone las preguntas clave en el contexto del informe (sólo si hay alguna, para no mover la huella de las miniaturas)
#' @param ctx Contexto liviano de `.sig_contexto_liviano`, o NULL.
#' @keywords internal
.preguntas_clave_en_contexto <- function(ctx, claves, base = "") {
  locales <- .preguntas_clave_locales(claves, base)
  if (!is.list(ctx)) return(ctx)
  ctx$preguntas_clave <- if (length(locales)) locales else NULL
  ctx
}

#' Las preguntas clave del contexto con que se dibuja (`sig` de `.sig_contexto_render` o el de un test)
#' @keywords internal
.preguntas_clave_de <- function(sig) .dif_chr((sig %||% list())$preguntas_clave)

#' Si una fila candidata es de una pregunta clave: por la variable del gráfico del plan o la que se resolvió
#' @keywords internal
.preguntas_clave_es <- function(vars, claves) length(claves) > 0L && any(.dif_chr(vars) %in% claves)

#' Toma de `pool`, en su orden, hasta `n` filas de preguntas que aún no están en `usadas`
#' @return `list(elegidas, usadas)`.
#' @keywords internal
.preguntas_clave_tomar <- function(pool, n, elegidas = list(), usadas = character(0)) {
  for (x in pool) {
    if (n <= 0L) break
    if (x$var %in% usadas) next
    elegidas[[length(elegidas) + 1L]] <- x
    usadas <- c(usadas, x$var)
    n <- n - 1L
  }
  list(elegidas = elegidas, usadas = usadas)
}

#' Orden de las filas con diferencia: las de preguntas clave primero, luego las del 99 % y luego el tamaño
#' @param filas Lista con `clave` (lógico) y `fuerza` (`c(firme, tam)` de `.dif_fuerza`).
#' @keywords internal
.preguntas_clave_orden_dif <- function(filas) {
  if (!length(filas)) return(integer(0))
  order(-vapply(filas, function(x) as.numeric(isTRUE(x$clave)), 0), -vapply(filas, function(x) x$fuerza[["firme"]], 0),
        -vapply(filas, function(x) x$fuerza[["tam"]], 0))
}

#' Opciones del motor de la vista previa, las miniaturas y la propuesta: la regla del estudio y las preguntas clave
#'
#' Las preguntas clave salen de la config efectiva del pedido (la sin guardar, si viene), resueltas para la base activa.
#' Entran a la huella de la miniatura con la regla: marcar una pregunta clave rehace el resumen ejecutivo.
#' @keywords internal
.graficos_preview_opciones_motor <- function(sid, claves, base = "") {
  o <- .sig_opciones_preview(sid, .mini_opciones_motor())
  o[["prosecnur.sig_informe"]] <- .preguntas_clave_en_contexto(o[["prosecnur.sig_informe"]], claves, base)
  o
}
