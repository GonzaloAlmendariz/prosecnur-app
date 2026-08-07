# p_radar_split.R — wrappers que separan el gráfico combinado
# `p_radar_tabla` en dos graficadores independientes: `p_radar` (solo
# el radar) y `p_tabla` (solo la tabla, sin el radar).
#
# Motivación: en muchos reportes el analista quiere el radar en un
# placeholder y la tabla en otro (no necesariamente pegados). Con el
# combinado original, el canvas siempre reserva espacio para ambos.
#
# Implementación: ambos wrappers construyen un `ppt_element` reusando
# los defaults de `p_radar_tabla` pero sobrescriben via `overrides` los
# flags que ocultan uno u otro lado. El motor en
# `.render_radar_tabla()` respeta `mostrar_tabla_derecha = FALSE` para
# ocultar la tabla y `radar_scale = 0` + overrides de ancho para
# esconder el radar.

#' Radar solo (sin tabla)
#'
#' Alias de `p_radar_tabla` que fuerza `mostrar_tabla_derecha = FALSE`.
#' Útil para slides donde el radar ocupa todo el placeholder.
#'
#' El modo `publicos` es el mismo dibujo con otra procedencia de las series:
#' en `sm` y `box` cada serie sale de un cruce DENTRO de una base, y en
#' `publicos` cada serie es una fuente del estudio (ADR 0064). Es un modo y no
#' un graficador aparte porque para el analista sigue siendo «un radar»; lo
#' único que cambia es qué compara.
#' @param corte Sólo en modo `publicos`: códigos que suman el indicador.
#' @param corte_etiqueta Sólo en modo `publicos`: nombre del indicador.
#' @param estilo Sólo en modo `publicos`: clave de `.RADAR_MB_ESTILOS`.
#' @param mostrar_tabla Sólo en modo `publicos`: compone el radar con su tabla.
#' @param eje_min Sólo en modo `publicos`: piso del eje radial en puntos
#'   porcentuales.
#' @param tabla_titulo,tabla_encabezados,tabla_ancho_tema,tabla_proporcion Sólo
#'   en modo `publicos`: encabezados y anchos de la tabla al costado.
#' @export
p_radar <- function(modo = c("sm", "box", "publicos"),
                    var  = NULL,
                    vars = NULL,
                    cruce = NULL,
                    box_labels = NULL,
                    colores_series = NULL,
                    titulo = NULL,
                    top_n = NULL,
                    sm_omit_codes  = NULL,
                    sm_omit_labels = NULL,
                    sm_omit_na     = TRUE,
                    mostrar_valores = NULL,
                    valores_decimales = NULL,
                    valores_umbral_pct = NULL,
                    corte = NULL,
                    corte_etiqueta = NULL,
                    estilo = NULL,
                    mostrar_tabla = TRUE,
                    eje_min = NULL,
                    tabla_titulo = NULL,
                    tabla_encabezados = NULL,
                    tabla_ancho_tema = NULL,
                    tabla_proporcion = NULL,
                    overrides = list(),
                    base = list(),
                    filtros = list()) {
  # El modo se resuelve ANTES del `match.arg` de `p_radar_tabla`, que no conoce
  # `publicos` y abortaría.
  if (identical(as.character(modo)[1], "publicos")) {
    # `mostrar_valores` y `valores_decimales` son los MISMOS args que los otros
    # dos modos ya exponen: el analista no tiene por que aprender un nombre
    # distinto segun lo que el radar compare.
    return(p_radar_publicos(
      vars = vars, corte = corte, estilo = estilo %||% "comparativo",
      corte_etiqueta = corte_etiqueta, mostrar_tabla = isTRUE(mostrar_tabla),
      mostrar_valores = isTRUE(mostrar_valores),
      decimales = valores_decimales %||% 0L, eje_min = eje_min %||% 0,
      tabla_titulo = tabla_titulo, tabla_encabezados = tabla_encabezados,
      tabla_ancho_tema = tabla_ancho_tema, tabla_proporcion = tabla_proporcion,
      titulo = titulo, overrides = overrides, base = base, filtros = filtros
    ))
  }
  overrides <- c(list(mostrar_tabla_derecha = FALSE), overrides %||% list())
  if (!is.null(mostrar_valores) && is.null(overrides$mostrar_valores)) {
    overrides$mostrar_valores <- isTRUE(mostrar_valores)
  }
  if (!is.null(valores_decimales) && is.null(overrides$valores_decimales)) {
    overrides$valores_decimales <- valores_decimales
  }
  if (!is.null(valores_umbral_pct) && is.null(overrides$valores_umbral_pct)) {
    overrides$valores_umbral_pct <- suppressWarnings(as.numeric(valores_umbral_pct)[1])
  }
  p_radar_tabla(
    modo = modo, var = var, vars = vars, cruce = cruce,
    box_labels = box_labels, colores_series = colores_series,
    titulo = titulo, top_n = top_n,
    sm_omit_codes = sm_omit_codes, sm_omit_labels = sm_omit_labels,
    sm_omit_na = sm_omit_na,
    overrides = overrides, base = base, filtros = filtros
  )
}

#' Tabla sola (sin radar)
#'
#' Alias de `p_radar_tabla` que colapsa el radar a 0 para que solo
#' quede la tabla ocupando el placeholder. Respeta el resto de args
#' (título, Top-Two-Box, etc.).
#' @export
p_tabla <- function(modo = c("sm", "box"),
                    var  = NULL,
                    vars = NULL,
                    cruce = NULL,
                    box_labels = NULL,
                    titulo_tabla = NULL,
                    colores_series = NULL,
                    titulo = NULL,
                    top_n = NULL,
                    sm_omit_codes  = NULL,
                    sm_omit_labels = NULL,
                    sm_omit_na     = TRUE,
                    umbral_rojo_pct = NULL,
                    overrides = list(),
                    base = list(),
                    filtros = list()) {
  if (!is.null(umbral_rojo_pct) && is.null(overrides$umbral_rojo_pct)) {
    overrides$umbral_rojo_pct <- suppressWarnings(as.numeric(umbral_rojo_pct)[1])
  }
  overrides <- c(list(
    mostrar_tabla_derecha = TRUE,
    # Ocultar la parte del radar: el motor respeta estos flags para
    # colapsar el área.
    radar_scale = 0,
    mostrar_leyenda = FALSE,
    tabla_firstcol_frac = 0.55,
    tabla_ph_ancho = 1.0
  ), overrides %||% list())
  p_radar_tabla(
    modo = modo, var = var, vars = vars, cruce = cruce,
    box_labels = box_labels, titulo_tabla = titulo_tabla,
    colores_series = colores_series,
    titulo = titulo, top_n = top_n,
    sm_omit_codes = sm_omit_codes, sm_omit_labels = sm_omit_labels,
    sm_omit_na = sm_omit_na,
    overrides = overrides, base = base, filtros = filtros
  )
}
