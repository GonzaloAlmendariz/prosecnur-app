# =============================================================================
# graficos_calculos_gobernados.R — cómo se redondea NO se decide por lámina
# =============================================================================
#
# El redondeo de porcentajes y la cantidad de decimales son decisiones de
# informe, no de gráfico: en un mazo de sesenta láminas no tiene sentido que la
# 12 redondee distinto que la 13. Hasta ahora vivían donde vive cualquier ajuste
# estético —el preset del tipo, con el override del slide pisándolo—, y esa
# cascada permitía justo lo que no debe pasar: un override guardado hace meses
# en una lámina suelta cambiándole las cifras a esa sola sin que nadie lo vea.
#
# Aquí viven las dos cosas que hacen falta para cerrar eso:
#
#   1. La CLASIFICACIÓN de qué familia admite qué. La sirve el endpoint de
#      metadata para que la pestaña «Cálculos» no tenga que duplicarla en el
#      frontend: si la verdad vive en dos sitios, en algún momento discrepan.
#   2. El SANEO de los overrides, que quita estos campos del nivel del slide
#      para que gane la configuración general.
#
# Ver `docs/qa/checklist-redondeo-decimales-2026-08-14.md` (ítems 6, 9-12).

#' Campos que gobierna la configuración general y nadie pisa por lámina.
#' @keywords internal
.CALCULOS_CAMPOS <- c(
  "metodo_redondeo",
  "decimales", "decimales_pct", "valores_decimales"
)

#' Qué familias entran en la pestaña «Cálculos» y cuáles eligen método.
#'
#' `cierra_100` es la pregunta que decide si el reparto significa algo: sin un
#' total que cerrar no hay resto que repartir, y ofrecer el método sería un
#' mando incapaz de hacer nada. Una batería de respuesta múltiple, una brecha
#' entre bases o una serie temporal caen de ese lado.
#'
#' Lo que NO está en esta lista queda fuera de la pestaña: box plot, media y
#' rango, histograma de conteos, indicador numérico, nube de palabras, mapa de
#' cobertura y las familias de dimensiones no rotulan porcentajes de una
#' distribución, aunque algunas tengan `decimales` por otros motivos.
#' @keywords internal
.PRESETS_CALCULOS <- list(
  barras_apiladas     = list(cierra_100 = TRUE),
  multi_apiladas      = list(cierra_100 = TRUE),
  barras_categoricas  = list(cierra_100 = TRUE),
  pie                 = list(cierra_100 = TRUE),
  donut               = list(cierra_100 = TRUE),
  barras_agrupadas    = list(cierra_100 = FALSE),
  barras_divergentes  = list(cierra_100 = FALSE),
  puntos_comparativos = list(cierra_100 = FALSE),
  dumbbell            = list(cierra_100 = FALSE),
  lollipop            = list(cierra_100 = FALSE),
  serie_temporal      = list(cierra_100 = FALSE)
)

#' Bloque `calculos` que acompaña a cada preset en `/presets-metadata`.
#'
#' Devuelve `NULL` para las familias que no rotulan porcentajes, y el frontend
#' las omite de la matriz. `campo_decimales` se resuelve contra los args reales
#' del preset porque el nombre cambia según la familia (`decimales`,
#' `decimales_pct`, `valores_decimales`) y esa diferencia no debería obligar al
#' frontend a conocer las tres.
#' @keywords internal
.calculos_meta_de_preset <- function(nombre, args = list()) {
  spec <- .PRESETS_CALCULOS[[nombre]]
  if (is.null(spec)) return(NULL)

  nombres_arg <- vapply(
    args,
    function(a) as.character(a$name %||% "")[1],
    character(1)
  )
  campo_dec <- intersect(
    c("decimales", "decimales_pct", "valores_decimales"),
    nombres_arg
  )

  list(
    familia_porcentaje = TRUE,
    cierra_100         = isTRUE(spec$cierra_100),
    admite_metodo      = isTRUE(spec$cierra_100) && "metodo_redondeo" %in% nombres_arg,
    campo_decimales    = if (length(campo_dec)) campo_dec[[1]] else ""
  )
}

#' Quita del override de una lámina lo que gobierna la configuración general.
#'
#' La cascada del motor es `base` → `preset del tipo` → `override del slide`, y
#' el último gana. Para estos campos esa precedencia se invierte, y la forma más
#' barata de invertirla es que no lleguen: un override que no existe no puede
#' ganar. Se hace aquí y no en cada `.render_*` porque los puntos de merge son
#' muchos y basta olvidar uno para que una familia quede fuera del gobierno.
#'
#' Los valores viejos NO se borran del plan guardado: se ignoran al renderizar.
#' Si mañana se decide volver a permitirlos, siguen ahí.
#'
#' @param overrides Lista de overrides de un elemento.
#' @return La misma lista sin los campos gobernados.
#' @keywords internal
.calculos_sanear_overrides <- function(overrides) {
  if (is.null(overrides) || !length(overrides)) return(overrides)
  if (is.null(names(overrides))) return(overrides)
  overrides[!(names(overrides) %in% .CALCULOS_CAMPOS)]
}
