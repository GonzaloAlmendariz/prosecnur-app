# =============================================================================
# reporte_plan_top2box_grafico.R — la columna Top Two Box que pide el gráfico
# =============================================================================
#
# O7c (docs/qa/checklist-revamp-informe-graficos-2026-10-14.md). La tarjeta de
# Láminas declara la columna Top Two Box en el slot (`top2box`,
# `top2box_labels`). El render de multiapiladas la traducía a args del
# graficador DENTRO de `base_args` (`.apply_top2box_alias`, en
# reporte_plan_ppt.R), y la cascada es `base -> preset -> overrides`: el preset
# del tipo pisaba lo que el gráfico había pedido. Un `mostrar_barra_extra =
# FALSE` o unas `top2box_labels` del preset del proyecto apagaban o cambiaban la
# columna de una lámina que la declaraba.
#
# Lo que el gráfico DECLARA va aquí, en el nivel que le toca —encima del preset
# y debajo de sus overrides—. El rótulo y el color de la columna siguen siendo
# defectos de `base_args`: no son decisiones del gráfico y el preset los puede
# cambiar como siempre. El render vive en un archivo congelado a crecimiento, por
# eso la pieza está aparte.

#' Args de la columna Top Two Box que declara el gráfico, para mezclar sobre el preset.
#'
#' @param el Elemento `barras_multiapiladas` (o uno de sus bloques).
#'   `el$top2box` ya es la derivación de su `barra_extra` (graficos_barra_extra.R, `.barra_extra_top2box_de`): con la
#'   barra extra declarada manda ella; la bandera sólo vale para quien construye el elemento a mano.
#' @return Lista vacía si el gráfico no pide la columna; si la pide,
#'   `mostrar_barra_extra`, `barra_extra_preset` y, si las declara, `top2box_labels`. Lo demás de la barra extra
#'   (conteos, bottom, apagado) lo baja `.merge_args()` desde los overrides, encima de esta capa.
#' @keywords internal
.top2box_del_grafico <- function(el) {
  if (!is.list(el) || !isTRUE(el[["top2box"]])) return(list())
  out <- list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box")
  etiquetas <- el[["top2box_labels"]]
  if (!is.null(etiquetas) && length(etiquetas)) out$top2box_labels <- etiquetas
  out
}
