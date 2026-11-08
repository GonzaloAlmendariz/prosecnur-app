# =============================================================================
# graficos_tipos_usa.R — qué datos usa cada tipo de gráfico (selector por intención, ADR 0135)
# =============================================================================
#
# El selector dice, por cada tipo, qué datos usa y si el estudio los tiene (el inventario sale de
# GET /api/graficos/resumenes/inventario). La forma es:
#
#   usa = {pregunta: "escala" | "opcion_unica" | "multiple" | "numerica" | "abierta" | "cualquiera",
#          publicos: "uno" | "varios" | "uno_o_varios", padron: boolean, cruce: boolean}
#
# Qué sale de los args del registro y qué no:
#   - `cruce` SÍ sale: el graficador declara un arg `cruce`, `cruces` o `grupo` que pide una variable. Significa «puede
#     abrir la pregunta por los grupos de otra variable» (opcional u obligatorio).
#   - `pregunta`, `publicos` y `padron` NO salen: los args dicen «variable» sin decir de qué tipo, y un panorama compara
#     públicos sin declarar un arg `bases`. Van en la tabla de abajo, tecleada. El test (test-graficos-tipos-usa.R) la
#     contrasta con lo que los args sí permiten afirmar: todo graficador con `regla` usa escalas (el universo de la regla,
#     ADR 0135 §5), todo graficador con un arg `bases` admite varios públicos, y el padrón sólo lo pide la cobertura.
#   - «cualquiera» es «no pide un tipo de pregunta»: la cifra (porcentaje, n, media) y los que no leen preguntas (la
#     cobertura lee casos y padrón; el mapa de cobertura, las hojas de ruta).
#   - Un graficador que acepta dos tipos declara el principal: las barras agrupadas y el ranking también dibujan una
#     múltiple, y el radar y la tabla también abren las opciones de una múltiple (modo `sm`).

.GRAFICOS_TIPOS_USA <- list(
  p_barras_agrupadas          = list(pregunta = "opcion_unica", publicos = "uno"),
  p_dicotomica                = list(pregunta = "opcion_unica", publicos = "uno"),
  p_barras_categoricas        = list(pregunta = "opcion_unica", publicos = "uno"),
  p_barras_apiladas           = list(pregunta = "escala",       publicos = "uno"),
  p_barras_multiapiladas      = list(pregunta = "escala",       publicos = "uno"),
  p_nube_palabras             = list(pregunta = "abierta",      publicos = "uno"),
  p_citas                     = list(pregunta = "abierta",      publicos = "uno"),
  p_mapa_cobertura_territorial = list(pregunta = "cualquiera",  publicos = "uno"),
  p_pie                       = list(pregunta = "opcion_unica", publicos = "uno"),
  p_donut                     = list(pregunta = "opcion_unica", publicos = "uno"),
  p_numerico                  = list(pregunta = "numerica",     publicos = "uno"),
  p_histograma                = list(pregunta = "numerica",     publicos = "uno"),
  p_boxplot                   = list(pregunta = "numerica",     publicos = "uno"),
  p_media_rango               = list(pregunta = "numerica",     publicos = "uno"),
  p_barras_divergentes        = list(pregunta = "escala",       publicos = "uno_o_varios"),   # la escala del resumen
  p_puntos_comparativos       = list(pregunta = "opcion_unica", publicos = "uno"),
  p_mapa_distribucion         = list(pregunta = "opcion_unica", publicos = "uno"),
  p_mapa_resultado_distrital  = list(pregunta = "opcion_unica", publicos = "uno"),
  p_cifra                     = list(pregunta = "cualquiera",   publicos = "uno"),
  p_dumbbell                  = list(pregunta = "escala",       publicos = "uno_o_varios"),   # dos grupos o dos bases
  p_panorama                  = list(pregunta = "escala",       publicos = "uno_o_varios"),
  p_fortalezas                = list(pregunta = "escala",       publicos = "uno"),
  p_cobertura                 = list(pregunta = "cualquiera",   publicos = "uno_o_varios", padron = TRUE),
  p_filtro_subpregunta        = list(pregunta = "opcion_unica", publicos = "uno"),
  p_significancia_publicos    = list(pregunta = "opcion_unica", publicos = "varios"),         # Top Two Box o «Sí»
  p_matriz_cuadrantes         = list(pregunta = "escala",       publicos = "uno_o_varios"),
  p_lollipop                  = list(pregunta = "opcion_unica", publicos = "uno"),
  p_serie_temporal            = list(pregunta = "opcion_unica", publicos = "uno_o_varios"),   # una base por medición
  p_radar                     = list(pregunta = "escala",       publicos = "uno_o_varios"),   # modo `publicos`
  p_tabla                     = list(pregunta = "escala",       publicos = "uno"),
  p_dim_radar                 = list(pregunta = "escala",       publicos = "uno"),
  p_dim_heatmap               = list(pregunta = "escala",       publicos = "uno"),
  p_dim_comparativo_radarbar  = list(pregunta = "escala",       publicos = "uno"),
  p_dim_foda                  = list(pregunta = "escala",       publicos = "uno"),
  p_dim_heatmap_criterios     = list(pregunta = "escala",       publicos = "uno"),
  p_lineas_nivel              = list(pregunta = "opcion_unica", publicos = "uno")
)

.GRAFICOS_USA_PREGUNTAS <- c("escala", "opcion_unica", "multiple", "numerica", "abierta", "cualquiera")
.GRAFICOS_USA_PUBLICOS <- c("uno", "varios", "uno_o_varios")

#' ¿El graficador declara un arg que abre la pregunta por los grupos de otra variable?
#' @keywords internal
.graficos_usa_cruce_de_args <- function(args) {
  any(vapply(args %||% list(), function(a) {
    isTRUE(a$name %in% c("cruce", "cruces", "grupo")) && isTRUE(a$tipo_input %in% c("variable", "variable_opt"))
  }, logical(1)))
}

#' `usa` de un graficador: la tabla más lo que sale de sus args
#' @return `list(pregunta, publicos, padron, cruce)` o NULL si el graficador no está en la tabla.
#' @keywords internal
.graficos_tipos_usa <- function(nombre, meta = .GRAFICADORES_META[[nombre]]) {
  fila <- .GRAFICOS_TIPOS_USA[[nombre]]
  if (is.null(fila)) return(NULL)
  list(pregunta = fila$pregunta, publicos = fila$publicos, padron = isTRUE(fila$padron),
       cruce = .graficos_usa_cruce_de_args(meta$args))
}
