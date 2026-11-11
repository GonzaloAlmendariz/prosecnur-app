# =============================================================================
# graficos_grafico_por_pregunta.R — el gráfico que el analista eligió para cada pregunta
# =============================================================================
#
# La pestaña Plantillas de Gráficos deja elegir, pregunta por pregunta, con qué gráfico sale en el informe, como los
# informes de Kobo (checklist-pestana-plantillas-2026-11-11, ítem 4). La elección vive en
# `scope_rules.grafico_por_pregunta` (referencia -> clave) y se aplica al plan sugerido después de armarlo, sobre las
# láminas de un gráfico. Una clave desconocida se ignora: la lámina conserva el gráfico de la plantilla.
#
# Claves:
#   barras             barras horizontales en el orden de la plantilla
#   barras_ordenadas   barras de mayor a menor (residuales al final)
#   barras_verticales  columnas (p_barras_categoricas: el render fuerza las agrupadas al lienzo, que sólo es horizontal)
#   torta              torta
#   barra_100          una barra al 100 % con todas las opciones (p_barras_apiladas)
#
# Comprobados en render por la ruta de la plantilla ACNUR (2026-11-11); el perfil ACNUR les da sus azules
# (presets `pie` y `barras_categoricas`). La barra al 100 % toma la paleta de la lista y, si la lista no tiene, la
# paleta por defecto de la plantilla de cliente (lamina_plantilla_cliente.R).

.GRAFICOS_POR_PREGUNTA <- c("barras", "barras_ordenadas", "barras_verticales", "torta", "barra_100")

#' Mapa referencia -> gráfico elegido, leído de la config
#' @keywords internal
.graficos_grafico_por_pregunta <- function(config = NULL) {
  rules <- ((config %||% list())$scope_rules %||% list())
  mapa <- rules$grafico_por_pregunta %||% rules$graficoPorPregunta %||% list()
  if (!is.list(mapa) || !length(mapa)) return(list())
  mapa <- mapa[nzchar(names(mapa))]
  mapa <- lapply(mapa, function(x) as.character(x %||% "")[1])
  mapa[vapply(mapa, function(x) !is.na(x) && x %in% .GRAFICOS_POR_PREGUNTA, logical(1))]
}

#' El gráfico de una lámina con la clave elegida, conservando la base y las notas del gráfico original
#' @keywords internal
.graficos_grafico_elegido <- function(graf, clave) {
  args <- graf$args %||% list()
  ov <- args$overrides %||% list()
  ref <- .graficos_scalar_chr(args$var, "")
  comunes <- ov[intersect(names(ov), c("nota_pie", "subtitulo", "excluir_opciones", "unidad_base", "color_fondo"))]
  agrupadas <- function(extra_ov = list()) {
    list(graficador = "p_barras_agrupadas",
         args = c(args[setdiff(names(args), "overrides")], list(overrides = utils::modifyList(ov, extra_ov))))
  }
  switch(clave,
    barras = agrupadas(),
    barras_ordenadas = agrupadas(list(orden_barras = "mayor_menor", otros_al_final = TRUE)),
    # Las columnas no salen de las barras agrupadas: el render las fuerza al lienzo, que sólo dibuja barras horizontales.
    barras_verticales = list(graficador = "p_barras_categoricas", args = list(var = ref, overrides = comunes)),
    torta = list(graficador = "p_pie", args = list(var = ref, overrides = c(comunes, list(tipo_pie = "pie")))),
    barra_100 = list(graficador = "p_barras_apiladas", args = list(var = ref, overrides = comunes)),
    graf
  )
}

#' Aplica el gráfico elegido a cada lámina de un gráfico cuya pregunta tiene elección
#' @keywords internal
.graficos_aplicar_grafico_por_pregunta <- function(slides, mapa) {
  if (!length(mapa) || !length(slides)) return(slides)
  lapply(slides, function(s) {
    graf <- (s$payload %||% list())$grafico
    ref <- .graficos_scalar_chr(((graf %||% list())$args %||% list())$var, "")
    clave <- if (nzchar(ref)) mapa[[ref]] else NULL
    if (is.null(clave) || !identical(graf$graficador, "p_barras_agrupadas") ||
        length((graf$args %||% list())$cruces %||% NULL)) {
      return(s)
    }
    s$payload$grafico <- .graficos_grafico_elegido(graf, clave)
    s
  })
}
