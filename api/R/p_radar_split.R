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
#' @export
p_radar <- function(modo = c("sm", "box"),
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
                    overrides = list(),
                    base = list(),
                    filtros = list()) {
  overrides <- c(list(mostrar_tabla_derecha = FALSE), overrides %||% list())
  if (!is.null(mostrar_valores) && is.null(overrides$mostrar_valores)) {
    overrides$mostrar_valores <- isTRUE(mostrar_valores)
  }
  if (!is.null(valores_decimales) && is.null(overrides$valores_decimales)) {
    overrides$valores_decimales <- valores_decimales
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
