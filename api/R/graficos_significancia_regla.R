# La regla de diferencias del estudio (ADR 0128 §1, decisiones D1 y D5)
# =====================================================================
#
# Una sola regla por estudio, guardada en `graficos_config$significancia`, gobierna las láminas, el Word y las tablas
# de cruces. Antes cada lámina guardaba su `significancia_alpha` y las 33 láminas con cruce de CCSS podían quedar con
# varas distintas sin que nadie lo viera.
#
# Este archivo normaliza la regla (opciones cerradas: el nivel no se elige con un paso a paso, que invita a moverlo
# hasta que salga algo), propone el valor por defecto según el diseño de la base y migra el `significancia_alpha` viejo.

.SIG_OPCIONES <- list(
  prueba = c("rao_scott", "z"),
  correccion = c("bh_informe", "bonferroni_fila"),
  alfa = c(0.10, 0.05, 0.01),
  umbral_puntos = c(0, 5, 10, 15),
  base_minima = c(20, 30, 50),
  fragiles = c("contorno", "ocultar")
)

# Columnas que se reconocen como conglomerado sin que nadie lo declare. `aula` es la de los estudios por aulas
# (CCSS 2026-II: 62 aulas); `curso_horario` la del marco de Cálculo de muestra.
.SIG_CONGLOMERADOS_CONOCIDOS <- c("aula", "aula_id", "curso_horario", "conglomerado", "cluster", "psu")
.SIG_ESTRATOS_CONOCIDOS <- c("estrato_aula", "estrato", "strata")

#' Regla de fábrica, sin mirar los datos
#' @keywords internal
.sig_regla_fabrica <- function() {
  list(
    version = 1L, prueba = "z", correccion = "bonferroni_fila", alfa = 0.05, umbral_puntos = 10,
    base_minima = 30, conglomerados_minimos = 8L, fragiles = "contorno", conglomerado = NULL, estrato = NULL,
    tendencia = FALSE, incluir_ns = FALSE, max_letras = 6L
  )
}

#' Columna de conglomerado o estrato que la base trae con un nombre reconocible
#' @keywords internal
.sig_columna_conocida <- function(data, candidatas) {
  if (!is.data.frame(data)) return(NULL)
  nms <- names(data)
  hit <- nms[tolower(nms) %in% candidatas]
  if (!length(hit)) return(NULL)
  hit[order(match(tolower(hit), candidatas))][[1]]
}

#' Regla que propone el diseño: con conglomerado reconocible, Rao-Scott por esa columna y BH del informe
#'
#' Sin conglomerado se queda la prueba de siempre (z con Bonferroni por fila): proponer Rao-Scott sin aula sería
#' declarar un diseño que la base no muestra.
#' @keywords internal
.sig_regla_propuesta <- function(data = NULL) {
  r <- .sig_regla_fabrica()
  cl <- .sig_columna_conocida(data, .SIG_CONGLOMERADOS_CONOCIDOS)
  if (!is.null(cl)) {
    r$prueba <- "rao_scott"
    r$correccion <- "bh_informe"
    r$conglomerado <- cl
    r$estrato <- .sig_columna_conocida(data, .SIG_ESTRATOS_CONOCIDOS)
  }
  r
}

#' Valor cerrado: el más cercano de las opciones permitidas (numéricas) o el de defecto (texto)
#' @keywords internal
.sig_opcion <- function(x, opciones, defecto) {
  if (is.null(x) || !length(x)) return(defecto)
  if (is.numeric(opciones)) {
    v <- suppressWarnings(as.numeric(unlist(x))[1])
    if (!is.finite(v)) return(defecto)
    return(opciones[which.min(abs(opciones - v))])
  }
  v <- as.character(unlist(x))[1]
  if (is.na(v) || !v %in% opciones) defecto else v
}

#' Normaliza una regla venida de la UI, del `.pulso` o de un preset
#'
#' Tolera ausencias y valores fuera de catálogo (caen al valor de `base`). Una columna vacía se lee como NULL.
#' @keywords internal
.sig_regla_normalizar <- function(x, base = .sig_regla_fabrica()) {
  if (!is.list(x)) x <- list()
  col <- function(v) {
    v <- if (is.null(v) || !length(v)) NA_character_ else as.character(unlist(v))[1]
    if (is.na(v) || !nzchar(trimws(v))) NULL else trimws(v)
  }
  ent <- function(v, defecto, min = 1L) {
    v <- suppressWarnings(as.integer(unlist(v))[1])
    if (is.na(v) || v < min) defecto else v
  }
  bool <- function(v, defecto) if (is.logical(v) && length(v) == 1L && !is.na(v)) v else defecto
  list(
    version = 1L,
    prueba = .sig_opcion(x$prueba, .SIG_OPCIONES$prueba, base$prueba),
    correccion = .sig_opcion(x$correccion, .SIG_OPCIONES$correccion, base$correccion),
    alfa = .sig_opcion(x$alfa, .SIG_OPCIONES$alfa, base$alfa),
    umbral_puntos = .sig_opcion(x$umbral_puntos, .SIG_OPCIONES$umbral_puntos, base$umbral_puntos),
    base_minima = .sig_opcion(x$base_minima, .SIG_OPCIONES$base_minima, base$base_minima),
    conglomerados_minimos = ent(x$conglomerados_minimos, base$conglomerados_minimos %||% 8L, min = 2L),
    fragiles = .sig_opcion(x$fragiles, .SIG_OPCIONES$fragiles, base$fragiles),
    conglomerado = if ("conglomerado" %in% names(x)) col(x$conglomerado) else base$conglomerado,
    estrato = if ("estrato" %in% names(x)) col(x$estrato) else base$estrato,
    tendencia = bool(x$tendencia, isTRUE(base$tendencia)),
    incluir_ns = bool(x$incluir_ns, isTRUE(base$incluir_ns)),
    max_letras = ent(x$max_letras, base$max_letras %||% 6L, min = 2L)
  )
}

#' Regla del estudio: la guardada en `graficos_config$significancia` o, si no hay, la propuesta por el diseño
#'
#' Migración (ADR 0128 §1): si el estudio no tiene regla y alguna lámina trae `significancia_alpha`, ese nivel siembra
#' `alfa`. El campo por lámina se lee y nunca se escribe.
#' @return `list(regla, origen)` con origen `"estudio"` o `"propuesta"`.
#' @keywords internal
.sig_regla_del_estudio <- function(graficos_config = NULL, data = NULL) {
  guardada <- if (is.list(graficos_config)) graficos_config$significancia else NULL
  propuesta <- .sig_regla_propuesta(data)
  if (is.list(guardada) && length(guardada)) {
    return(list(regla = .sig_regla_normalizar(guardada, base = propuesta), origen = "estudio"))
  }
  alfa_viejo <- .sig_alfa_heredado(graficos_config$plan %||% NULL)
  if (!is.null(alfa_viejo)) propuesta$alfa <- .sig_opcion(alfa_viejo, .SIG_OPCIONES$alfa, propuesta$alfa)
  list(regla = propuesta, origen = "propuesta")
}

#' Primer `significancia_alpha` declarado en las láminas del plan (migración)
#' @keywords internal
.sig_alfa_heredado <- function(plan) {
  slides <- if (is.list(plan)) plan$slides %||% plan else NULL
  if (!is.list(slides)) return(NULL)
  for (s in slides) {
    for (g in Filter(function(z) is.list(z) && !is.null(z$args), s$payload %||% list())) {
      a <- g$args$significancia_alpha %||% g$args$overrides$significancia_alpha
      v <- suppressWarnings(as.numeric(unlist(a))[1])
      if (length(v) && is.finite(v)) return(v)
    }
  }
  NULL
}

#' ¿La regla puede correr sobre esta base? Rao-Scott exige que la columna de conglomerado exista
#' @keywords internal
.sig_regla_validar_base <- function(regla, data) {
  if (!identical(regla$prueba, "rao_scott")) return(invisible(TRUE))
  cl <- regla$conglomerado %||% ""
  if (!nzchar(cl) || !is.data.frame(data) || !cl %in% names(data)) {
    stop_api(422, "E_SIG_SIN_CONGLOMERADO",
             sprintf("La prueba de diseño necesita la columna de conglomerado «%s» y la base no la trae.",
                     if (nzchar(cl)) cl else "(sin declarar)"))
  }
  invisible(TRUE)
}

# --- La regla vigente durante un render -------------------------------------------------------------------------
#
# `reporte_plan_ppt.R` está congelado a crecimiento y no puede recibir argumentos nuevos. El worker del export (y la
# vista previa) fijan la regla y la familia de BH en una opción del proceso antes de renderizar, y la reponen al salir.

#' Fija el contexto de significancia del informe y devuelve las opciones previas para reponerlas
#' @keywords internal
.sig_informe_activar <- function(contexto) {
  options(prosecnur.sig_informe = contexto)
}

#' Contexto vigente: `list(regla, familia)` o NULL
#' @keywords internal
.sig_informe_vigente <- function() {
  ctx <- getOption("prosecnur.sig_informe", NULL)
  if (is.list(ctx) && is.list(ctx$regla)) ctx else NULL
}
