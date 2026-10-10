# =============================================================================
# graficos_migrar_poblacion.R — los planes con población antigua pasan al tipo vigente (decisiones F6, 2026-10-10)
# =============================================================================
#
# «Sí, bórralos, porque en el recetario tampoco están ya»: `p_slide_2/3/4_graficos_poblacion` (el ícono del público
# en medio de los gráficos) salen del selector y los planes que los usan se migran al tipo vigente equivalente. Es el
# único punto de la migración: lo llaman `.normalize_plan()` (el plan del body de /ppt y /word, el preflight del
# consolidado) y `.graficos_normalize_config()` (el GET de la config, el import, el share y la config efectiva del
# export); el GET además la guarda en la sesión (graficos_migrar_poblacion_sesion.R). Idempotente: una lámina ya
# migrada no tiene tipo viejo.
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
#' @param posicion Número de la lámina en el plan (el aviso la nombra así: los ids son internos).
#' @return `list(slide, migrada, aviso)`.
#' @keywords internal
.graficos_migrar_slide_poblacion <- function(s, posicion = NA_integer_) {
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
  list(slide = s, migrada = TRUE, titulo = .graficos_poblacion_rotulo(payload$titulo),
       aviso = sprintf(paste("La lámina %s, %s, era «%s», que ya no está en el recetario: pasa a «%s» con %s, su título y la",
                             "base de cada gráfico. El ícono del centro se quita."),
                       if (is.na(posicion)) "?" else as.character(posicion), .graficos_poblacion_rotulo(payload$titulo),
                       .SLIDES_META[[tipo]]$titulo_humano, .SLIDES_META[[destino]]$titulo_humano,
                       if (graficos == 1L) "su gráfico" else sprintf("sus %d gráficos", graficos)))
}

#' El título de una lámina como lo lee el usuario: «Perfil del docente», o «sin título»
#' @keywords internal
.graficos_poblacion_rotulo <- function(titulo) {
  if (is.character(titulo) && length(titulo) && !is.na(titulo[1]) && nzchar(trimws(titulo[1]))) sprintf("«%s»", trimws(titulo[1])) else "sin título"
}

#' Migra las láminas de población antigua de un plan al tipo vigente
#'
#' No escribe al stderr: el aviso viaja con el plan (`.graficos_avisos_migracion()`) y quien tiene un canal hacia el
#' usuario lo entrega —el GET de la config (graficos_migrar_poblacion_sesion.R) y el resultado de los jobs /ppt y /word
#' (`.graficos_avisos_job()`)—. Antes iba al stderr del servidor, seis veces por normalización, y nadie lo leía.
#'
#' @param plan Plan de la config (`list(slides = ...)`).
#' @param avisar Si `TRUE`, el plan devuelto lleva sus avisos en `attr(, "avisos_migracion")`; si `FALSE`, sin ese
#'   atributo (el plan normalizado se hashea en el preflight del consolidado). Un plan ya vigente nunca lo lleva.
#' @return El plan, con las láminas viejas migradas y el resto intacto.
#' @keywords internal
.graficos_migrar_poblacion_antigua <- function(plan, avisar = TRUE) {
  if (!is.list(plan)) return(plan)
  attr(plan, "avisos_migracion") <- NULL
  if (!is.list(plan$slides) || !length(plan$slides)) return(plan)
  avisos <- character(); titulos <- character()
  for (i in seq_along(plan$slides)) {
    r <- .graficos_migrar_slide_poblacion(plan$slides[[i]], posicion = i)
    if (!isTRUE(r$migrada)) next
    plan$slides[[i]] <- r$slide
    avisos <- c(avisos, r$aviso); titulos <- c(titulos, r$titulo)
  }
  if (isTRUE(avisar) && length(avisos)) attr(plan, "avisos_migracion") <- .graficos_avisos_migracion_resumen(avisos, titulos)
  plan
}

#' Los avisos de migración: uno por lámina si son dos o menos; si son más, una sola línea con sus títulos
#'
#' Un mazo con seis poblaciones antiguas llenaba la lista de avisos del job (tope de ocho) y sacaba de ella a los
#' demás, que es lo que ya pasó con los de líneas de lámina (verificador de K12b).
#' @keywords internal
.graficos_avisos_migracion_resumen <- function(avisos, titulos) {
  if (length(avisos) <= 2L) return(avisos)
  sprintf(paste("%d láminas usaban un tipo de población que ya no está en el recetario y pasan a su tipo vigente con sus",
                "gráficos, su título y la base de cada gráfico; el ícono del centro se quita: %s."),
          length(avisos), paste(titulos, collapse = ", "))
}

#' Los avisos de migración que trae un plan (vacío si no migró nada)
#' @keywords internal
.graficos_avisos_migracion <- function(plan) {
  av <- if (is.list(plan)) attr(plan, "avisos_migracion", exact = TRUE) else NULL
  if (is.character(av)) av else character()
}

#' Los avisos de un job de Gráficos: primero los de la migración del plan que recibió, luego los del worker
#'
#' La migración ocurre en el proceso principal (el plan del body pasa por `.normalize_plan(avisar = TRUE)`), no en el
#' worker: su aviso no está en el `.err` del job y se suma aquí, con el mismo orden y tope que los demás.
#' @keywords internal
.graficos_avisos_job <- function(sid, job_id, plan = NULL) {
  .pulso_avisos_ordenar(unique(c(.graficos_avisos_migracion(plan), .pulso_avisos_de_job(sid, job_id, maximo = Inf))))
}
