# =============================================================================
# graficos_migrar_args_overrides.R — los mandos de presentación puestos en `args` también llegan desde `overrides`
# =============================================================================
#
# El plan de un gráfico tiene dos lugares para sus opciones: `args` (lo estructural: var, cruces, modo) y `overrides`
# (lo de presentación). Algunos caminos del render leen ciertos mandos SOLO de `overrides`: en `p_barras_multiapiladas`
# por cruce, `mostrar_significancia` se busca en `overrides` y en los presets (reporte_plan_ppt.R, bloque de la
# significancia transpuesta), y `orden_barras` se aplica sólo si viene en `overrides`. Un plan que los pone en `args`
# —como los arma a mano un script o una versión vieja de la UI— queda mudo sin aviso: el mazo de CCSS del 2026-11-03
# perdió así las marcas de 11 láminas y el orden de 42 gráficos.
#
# La migración copia esos mandos de `args` a `overrides` cuando `overrides` no los trae. No borra nada de `args` y no
# pisa lo que `overrides` ya declara, así que es idempotente y no cambia un plan que ya estaba bien.
#
# Los mandos `via_overrides` que la tarjeta del gráfico ofrece (U6 del checklist de mandos del mazo, 2026-11-05) van
# además en espejo: la tarjeta los escribe en `args` y en `overrides` a la vez (laminas/mandosPorOverrides.ts), y aquí
# un plan que sólo los trae en uno de los dos lados se completa con el otro. Si los dos difieren manda `overrides`, que
# es lo que el motor dibuja, y `args` se alinea con él para que la tarjeta muestre lo mismo que la lámina.

.GRAFICOS_ARGS_SOLO_OVERRIDES <- c("mostrar_significancia", "significancia_alpha", "orden_barras")
.GRAFICOS_ARGS_ESPEJO_OVERRIDES <- c("pista_barras", "colorear_por_opcion", "marca_mediana")

#' Copia a `overrides` los mandos de presentación que vienen sueltos en `args`
#' @keywords internal
.graficos_args_a_overrides_grafico <- function(g) {
  if (!is.list(g) || !is.list(g$args)) return(g)
  args <- g$args
  ov <- if (is.list(args$overrides)) args$overrides else list()
  cambio <- FALSE
  for (k in .GRAFICOS_ARGS_SOLO_OVERRIDES) {
    v <- args[[k]]
    if (is.null(v) || !length(v) || !is.null(ov[[k]])) next
    ov[[k]] <- v
    cambio <- TRUE
  }
  for (k in .GRAFICOS_ARGS_ESPEJO_OVERRIDES) {
    v <- if (!is.null(ov[[k]]) && length(ov[[k]])) ov[[k]] else args[[k]]
    if (is.null(v) || !length(v)) next
    if (!identical(ov[[k]], v)) { ov[[k]] <- v; cambio <- TRUE }
    if (!identical(args[[k]], v)) { g$args[[k]] <- v }
  }
  if (cambio) g$args$overrides <- ov
  g
}

#' Recorre las láminas del plan y migra cada gráfico (ranura única o varias ranuras)
#' @keywords internal
.graficos_migrar_args_a_overrides <- function(plan) {
  if (!is.list(plan) || !is.list(plan$slides)) return(plan)
  plan$slides <- lapply(plan$slides, function(s) {
    if (!is.list(s) || !is.list(s$payload)) return(s)
    for (nm in names(s$payload)) {
      el <- s$payload[[nm]]
      if (is.list(el) && !is.null(el$graficador)) s$payload[[nm]] <- .graficos_args_a_overrides_grafico(el)
    }
    s
  })
  plan
}
