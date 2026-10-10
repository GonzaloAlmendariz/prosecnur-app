# =============================================================================
# graficos_migrar_poblacion.R — los planes con población antigua pasan al tipo vigente (decisiones F6, 2026-10-10)
# =============================================================================
#
# «Sí, bórralos, porque en el recetario tampoco están ya»: `p_slide_2/3/4_graficos_poblacion` (el ícono del público
# en medio de los gráficos) salen del selector y los planes que los usan se migran al tipo vigente equivalente. Es el
# único punto de la migración: lo llama `.graficos_normalize_config()`, la costura por la que pasan el GET de la
# config, el import, el share y la config efectiva del export. Idempotente: una lámina ya migrada no tiene tipo viejo.
#
# Cada gráfico pasa a la ranura nueva de la MISMA posición (el orden de `.slide_slots()` de cada tipo, sin el ícono);
# título, base, pie, etiqueta, meta y cualquier otra clave del payload se conservan, y la meta gana `base_por_grafico`
# (la población llevaba la base de cada gráfico en el gráfico; el tipo vigente la juntaba al pie). Lo único que sale es el ícono del
# centro: el tipo vigente no tiene ranura de ícono (el recetario moderno pone el público en la cabecera). El código del
# motor de la población antigua sigue registrado y renderizable; se borra después, con ADR (regla de borrados).

.GRAFICOS_POBLACION_ANTIGUA <- c(
  p_slide_2_graficos_poblacion = "p_slide_2_graficos",
  p_slide_3_graficos_poblacion = "p_slide_3_graficos_fila",
  p_slide_4_graficos_poblacion = "p_slide_4_graficos"
)

#' Tipo vigente de una lámina de población antigua
#'
#' Dos gráficos con un texto declarado van a la de narrativa: `p_slide_2_graficos` no tiene dónde ponerlo.
#' @keywords internal
.graficos_poblacion_destino <- function(tipo, payload) {
  destino <- unname(.GRAFICOS_POBLACION_ANTIGUA[tipo])
  texto <- payload$texto
  if (identical(destino, "p_slide_2_graficos") && is.character(texto) && length(texto) && !is.na(texto[1]) && nzchar(trimws(texto[1]))) {
    destino <- "p_slide_2_graficos_narrativo"
  }
  destino
}

#' Migra una lámina de población antigua; cualquier otra vuelve intacta
#'
#' @return `list(slide, migrada, aviso)`.
#' @keywords internal
.graficos_migrar_slide_poblacion <- function(s) {
  tipo <- if (is.list(s)) s$tipo else NULL
  if (!is.character(tipo) || length(tipo) != 1L || !tipo %in% names(.GRAFICOS_POBLACION_ANTIGUA)) {
    return(list(slide = s, migrada = FALSE, aviso = NULL))
  }
  payload <- if (is.list(s$payload)) s$payload else list()
  destino <- .graficos_poblacion_destino(tipo, payload)
  viejas <- setdiff(.slide_slots(tipo), "icono")
  nuevas <- setdiff(.slide_slots(destino), "icono")
  nuevo <- payload[setdiff(names(payload), c(viejas, "icono"))]
  graficos <- 0L
  for (k in seq_along(viejas)) {
    g <- payload[[viejas[k]]]
    if (is.null(g)) next
    nuevo[[nuevas[k]]] <- g
    graficos <- graficos + 1L
  }
  # La base de cada gráfico sigue siendo suya (reporte_plan_base_por_grafico.R, `.base_por_grafico_migrada`).
  nuevo$meta <- utils::modifyList(if (is.list(payload$meta)) payload$meta else list(), list(base_por_grafico = TRUE))
  s$tipo <- destino
  s$payload <- nuevo
  titulo <- payload$titulo
  rotulo <- if (is.character(titulo) && length(titulo) && !is.na(titulo[1]) && nzchar(trimws(titulo[1]))) sprintf("«%s»", trimws(titulo[1])) else "sin título"
  aviso <- sprintf(paste("Lámina %s (%s): «%s» ya no está en el recetario y pasa a «%s» con sus %d gráfico(s), título y base;",
                         "el ícono del centro sale."),
                   rotulo, as.character(s$id %||% "?")[1], .SLIDES_META[[tipo]]$titulo_humano, .SLIDES_META[[destino]]$titulo_humano, graficos)
  list(slide = s, migrada = TRUE, aviso = aviso)
}

#' Migra las láminas de población antigua de un plan al tipo vigente
#'
#' @param plan Plan de la config (`list(slides = ...)`).
#' @param avisar Si `TRUE`, un `[PULSO-AVISO]` por lámina migrada.
#' @return El plan, con las láminas viejas migradas y el resto intacto.
#' @keywords internal
.graficos_migrar_poblacion_antigua <- function(plan, avisar = TRUE) {
  if (!is.list(plan) || !is.list(plan$slides) || !length(plan$slides)) return(plan)
  for (i in seq_along(plan$slides)) {
    r <- .graficos_migrar_slide_poblacion(plan$slides[[i]])
    if (!isTRUE(r$migrada)) next
    plan$slides[[i]] <- r$slide
    if (isTRUE(avisar)) .pulso_aviso(r$aviso)
  }
  plan
}
