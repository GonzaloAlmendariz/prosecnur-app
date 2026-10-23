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
#' @param titulos_grupo Sólo en modo `publicos`: títulos de los temas,
#'   `clave -> título` (ver `p_radar_publicos`).
#' @param margen_etiquetas Holgura del panel para las etiquetas de los ejes, entre 1 y 2. `NULL` = automática.
#' @param fallback_pocos Sólo en modo `publicos`: qué se dibuja con menos de 5 criterios, `"puntos"` (líneas y puntos
#'   comparativos, defecto) o `"barras"`.
#' @param eje_pocos,eje_pocos_min,eje_pocos_max Sólo en modo `publicos`, con líneas y puntos (menos de 5 criterios o `forma = "puntos"`): eje de las líneas y
#'   puntos, `"auto"` (acercado a los datos, defecto), `"0-100"` o `"personalizado"` con mínimo y máximo.
#' @param forma Sólo en modo `publicos`: `"auto"` (defecto: radar con 5 a 8 criterios, `fallback_pocos` con menos),
#'   `"puntos"` (líneas y puntos siempre, con el eje de `eje_pocos`), `"radar"` (radar aunque haya 3 o 4 criterios; con
#'   menos de 3 aborta) o `"barras"`.
#' @param limites Rango del eje radial, `c(min, max)` en escala 0-1 (O7c). Va a
#'   `overrides` en los tres modos; `NULL` hereda el preset.
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
                    filtros = list(),
                    titulos_grupo = NULL,
                    limites = NULL,
                    margen_etiquetas = NULL,
                    fallback_pocos = NULL,
                    eje_pocos = NULL,
                    eje_pocos_min = NULL,
                    eje_pocos_max = NULL,
                    forma = NULL) {
  overrides <- .radar_slot_limites(overrides %||% list(), limites)
  # Holgura del panel (1 a 2): va a `overrides`, que es lo que `graficar_radar()` lee en los tres modos.
  overrides <- .radar_slot_margen(overrides, margen_etiquetas)
  # El modo se resuelve ANTES del `match.arg` de `p_radar_tabla`, que no conoce
  # `publicos` y abortaría.
  if (identical(as.character(modo)[1], "publicos")) {
    # `mostrar_valores` y `valores_decimales` son los MISMOS args que los otros
    # dos modos ya exponen: el analista no tiene por que aprender un nombre
    # distinto segun lo que el radar compare.
    #
    # O7c: sin valor llegan como `NULL` —el elemento no opina— para que el preset
    # del tipo decida debajo del grafico; los defectos (FALSE, 0, 0) los pone el
    # render cuando ni el grafico ni el preset dicen nada.
    return(p_radar_publicos(
      vars = vars, corte = corte, estilo = estilo %||% "comparativo",
      corte_etiqueta = corte_etiqueta, mostrar_tabla = isTRUE(mostrar_tabla),
      mostrar_valores = mostrar_valores,
      decimales = valores_decimales, eje_min = eje_min,
      tabla_titulo = tabla_titulo, tabla_encabezados = tabla_encabezados,
      tabla_ancho_tema = tabla_ancho_tema, tabla_proporcion = tabla_proporcion,
      titulo = titulo, overrides = overrides, base = base, filtros = filtros,
      titulos_grupo = titulos_grupo, fallback_pocos = fallback_pocos,
      eje_pocos = eje_pocos, eje_pocos_min = eje_pocos_min, eje_pocos_max = eje_pocos_max,
      forma = forma
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

# `margen_etiquetas` (1 a 2): escalar con rango, que `.ppt_slot_override()` no expresa. Un override explícito manda.
.radar_slot_margen <- function(overrides, margen_etiquetas) {
  if (is.null(margen_etiquetas) || !is.null(overrides$margen_etiquetas)) return(overrides)
  m <- suppressWarnings(as.numeric(margen_etiquetas))
  if (length(m) != 1L || !is.finite(m) || m < 1 || m > 2) {
    .plan_spec_abort("`margen_etiquetas` debe ser NULL o un numero entre 1 y 2.")
  }
  overrides$margen_etiquetas <- m
  overrides
}

# O7c: `limites` es un par, así que no cabe en `.ppt_slot_override()` (escalares). Un override explícito manda.
.radar_slot_limites <- function(overrides, limites) {
  if (is.null(limites) || !is.null(overrides$limites)) return(overrides)
  lim <- suppressWarnings(as.numeric(unlist(limites)))
  if (length(lim) != 2L || any(!is.finite(lim)) || lim[1] >= lim[2]) {
    .plan_spec_abort("`limites` debe ser NULL o un par c(min, max) de numeros finitos con min < max.")
  }
  overrides$limites <- lim
  overrides
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
