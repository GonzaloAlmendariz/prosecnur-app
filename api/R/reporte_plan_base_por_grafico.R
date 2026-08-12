# =============================================================================
# reporte_plan_base_por_grafico.R — cada gráfico dice sobre cuántos habla
# =============================================================================
#
# Las láminas de población llevaban UNA base al pie —«Base: 178 egresados»— y
# los cuatro gráficos compartían ese denominador aunque no fuera el suyo. Se vio
# en la lámina 11 del mazo de acreditación, cuyo pie dice «52 docentes y 15
# administrativos» para cuatro gráficos de públicos distintos: ninguno de los
# cuatro tiene esa base, y el lector no tiene forma de saberlo.
#
# La base es del gráfico, no de la diapositiva. Va dentro, como nota al pie del
# propio gráfico, que es donde el lector la busca cuando compara dos paneles.

#' Pone la base del elemento como su nota al pie.
#'
#' @param el Elemento del plan.
#' @param base_txt Base ya compuesta para ESE elemento.
#' @return El elemento con `overrides$nota_pie`, o tal cual si ya traía una.
#' @keywords internal
.base_por_grafico_inyectar <- function(el, base_txt) {
  if (!inherits(el, "ppt_element")) return(el)
  base_txt <- trimws(as.character(base_txt %||% "")[1])
  if (is.na(base_txt) || !nzchar(base_txt)) return(el)

  el$overrides <- el$overrides %||% list()
  # Una nota escrita por el analista manda: la base automática no pisa un texto
  # que alguien redactó. Si quiere las dos cosas, la escribe él.
  ya <- trimws(as.character(el$overrides$nota_pie %||% "")[1])
  if (!is.na(ya) && nzchar(ya)) return(el)

  el$overrides$nota_pie <- base_txt
  el
}

#' ¿Queda algo que escribir en la base de la lámina?
#'
#' Con la base dentro de cada gráfico, repetirla abajo es decir dos veces lo
#' mismo cuando coinciden y contradecirse cuando no. Sólo se escribe si el
#' analista la declaró a mano.
#'
#' @param base_declarada Lo que venga en `slots$base`, o `NULL`.
#' @keywords internal
.base_de_lamina_texto <- function(base_declarada) {
  txt <- trimws(as.character(base_declarada %||% "")[1])
  if (is.na(txt) || !nzchar(txt)) return(" ")
  txt
}

#' La base de un elemento, compuesta y puesta como su nota al pie.
#'
#' Envoltorio de un solo paso para los renderers de lámina: cuatro disposiciones
#' de población necesitaban el mismo closure de cuatro líneas y repetirlo hacía
#' crecer un archivo congelado. Aquí cada sitio de llamada es una línea.
#'
#' @param el Elemento del plan.
#' @param presets Presets del reporte, de donde salen sufijo y formato.
#' @param componer Función que compone la base de un elemento; se inyecta porque
#'   vive como closure dentro de `reporte_ppt_plan()`.
#' @keywords internal
.base_por_grafico <- function(el, presets, componer) {
  base <- tryCatch(
    componer(el,
             sufijo_auto = (presets$base$args$sufijo_auto %||% NULL),
             formato = (presets$base$args$formato %||% "Base: %s")),
    error = function(e) NULL
  )
  .base_por_grafico_inyectar(el, base)
}
