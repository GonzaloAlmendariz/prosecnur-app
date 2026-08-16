# =============================================================================
# Condiciones clasificadas del motor de reportes por plan (PPT/Word).
# =============================================================================
#
# Origen (Plan de mejoras, fase 5, unidad 5.1). reporte_plan_slides.R y
# reporte_plan_ppt.R concentraban ~320 `stop()` crudos en rutas alcanzables por
# la API. Es la clase exacta del bug `current_code` (0.5.17): un `stop()` crudo
# dentro del render de UNA lamina mataba las 85 del deck. Este archivo fija la
# taxonomia de condiciones que ambos archivos (congelados a crecimiento) llaman:
#
#   1) `.plan_spec_abort()` — spec invalida en los constructores `p_*()`
#      (reporte_plan_slides.R). Condicion dual `pulso_plan_spec_error` +
#      `api_error`: en main-thread plumber la traduce a HTTP 400 con codigo
#      E_REPORTE_PLAN_SPEC; dentro de un worker de jobs, el job la captura como
#      error con el MISMO mensaje que el `stop()` historico.
#   2) `.plan_input_abort()` — input/estructura invalida a nivel de deck en
#      `reporte_ppt_plan()` (data/instrumento/plantilla/plan). Deliberadamente
#      fatal para el deck: un plan estructuralmente roto o una plantilla sin
#      layouts produce un entregable inservible; mejor fallar claro y temprano.
#      Codigo E_REPORTE_PLAN_INPUT, clase `pulso_plan_input_error`.
#   3) `.slide_abort_render()` — fallo de render POR ELEMENTO. Condicion
#      recuperable `pulso_slide_render_error` que el dispatcher del motor
#      captura para degradar ESA lamina a un canvas "Sin datos" (con `warning()`
#      para trazabilidad en el log del job) sin matar el resto del deck. Es la
#      generalizacion del patron `pulso_filter_missing_column` de
#      reporte_filter_guards.R.
#
# La linea metodologica: errores DEPENDIENTES DE DATOS durante la ejecucion de
# un renderer degradan la lamina; errores ESTRUCTURALES del plan o del entorno
# abortan el deck con condicion clasificada. Ningun caso usa `stop()` crudo ni
# `try()` silencioso: la degradacion siempre deja rastro via `warning()`.

#' Condicion clasificada de spec invalida en constructores `p_*()`.
#' Mantiene el mensaje historico (los tests asertan por regexp sobre el).
#' @keywords internal
.plan_spec_abort <- function(...) {
  cond <- structure(
    class = c("pulso_plan_spec_error", "api_error", "error", "condition"),
    list(
      status = 400L,
      code = "E_REPORTE_PLAN_SPEC",
      message = paste0(...),
      details = NULL,
      call = NULL
    )
  )
  stop(cond)
}

#' Condicion clasificada de input/estructura invalida a nivel deck en el motor
#' PPT (data, instrumento, plantilla, plan). Fatal para el deck, a proposito.
#' @keywords internal
.plan_input_abort <- function(...) {
  cond <- structure(
    class = c("pulso_plan_input_error", "api_error", "error", "condition"),
    list(
      status = 400L,
      code = "E_REPORTE_PLAN_INPUT",
      message = paste0(...),
      details = NULL,
      call = NULL
    )
  )
  stop(cond)
}

#' Condicion recuperable de fallo de render por elemento. El dispatcher
#' (`.render_element` en reporte_plan_ppt.R) la captura y degrada la lamina.
#' @keywords internal
.slide_abort_render <- function(...) {
  cond <- structure(
    class = c("pulso_slide_render_error", "error", "condition"),
    list(message = paste0(...), call = NULL)
  )
  stop(cond)
}

#' Canvas minimo "Sin datos" para laminas degradadas. Mismo rol que la rama
#' "Sin datos" natural de los graficadores: la lamina existe, el deck no muere.
#' @keywords internal
.plan_canvas_sin_datos <- function(mensaje = "Sin datos") {
  mensaje <- as.character(mensaje %||% "Sin datos")[1]
  if (is.na(mensaje) || !nzchar(trimws(mensaje))) mensaje <- "Sin datos"
  ggplot2::ggplot() +
    ggplot2::annotate(
      "text",
      x = 0, y = 0,
      label = mensaje,
      size = 4.2,
      colour = "#20324d"
    ) +
    ggplot2::theme_void()
}

#' Envuelve el dispatcher de elementos con la degradacion por lamina: si el
#' render aborta con `pulso_slide_render_error`, emite `warning()` (rastro en el
#' log del job) y devuelve el canvas "Sin datos" para ESA lamina.
#' @keywords internal
.plan_render_element_degradable <- function(impl, el) {
  tryCatch(
    impl(el),
    pulso_slide_render_error = function(cnd) {
      msg <- paste0("Lamina degradada a canvas 'Sin datos': ", conditionMessage(cnd))
      # El `warning()` es el rastro del log; el `.pulso_aviso()` es lo que llega
      # al analista. Sin el segundo, el mazo sale con una lamina en blanco y la
      # razon se queda en el stderr del subproceso: el renderer se traga los
      # `warning()` (ver jobs.R). Vara V4.
      warning(msg, call. = FALSE)
      .pulso_aviso(msg)
      .plan_canvas_sin_datos()
    }
  )
}

#' Degradacion cuando un renderer devolvio NULL sin error: warning + canvas.
#' Reemplaza 1:1 a los `stop("No se pudo renderizar ...")` historicos.
#' @keywords internal
.plan_canvas_render_nulo <- function(...) {
  msg <- paste0(paste0(...), " La lamina se degrada a canvas 'Sin datos'.")
  warning(msg, call. = FALSE)
  .pulso_aviso(msg)
  .plan_canvas_sin_datos()
}

#' Reemplazo declarativo para un slot que debia ser `ppt_element` y no lo es
#' (plan mangleado, p. ej. rectangularizacion JSON). Devuelve un elemento del
#' tipo `canvas_degradado`, cuyo renderer es el canvas "Sin datos": la lamina
#' sale degradada con warning en vez de matar el deck completo.
#' @keywords internal
.plan_elemento_degradado <- function(...) {
  msg <- paste0(paste0(...), " La lamina se degrada a canvas 'Sin datos'.")
  warning(msg, call. = FALSE)
  .pulso_aviso(msg)
  el <- list(
    .element_type = "canvas_degradado",
    mensaje_degradacion = msg,
    var = NULL,
    overrides = list(),
    base = list(),
    filtros = list()
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Caption "Base: N" degradable: el caption es informativo, nunca vale un deck.
#' Si su calculo revienta por datos (p. ej. la variable no existe en la fuente
#' resuelta), la lamina sale sin caption y queda `warning()` como rastro.
#' @keywords internal
.plan_base_caption_segura <- function(impl, el, sufijo_auto = NULL, formato = "Base: %s") {
  tryCatch(
    impl(el, sufijo_auto = sufijo_auto, formato = formato),
    error = function(cnd) {
      .pulso_aviso(
        "No se pudo calcular la base del elemento; la lamina sale sin caption: ",
        conditionMessage(cnd)
      )
      warning(
        paste0(
          "No se pudo calcular la base del elemento; la lamina sale sin caption: ",
          conditionMessage(cnd)
        ),
        call. = FALSE
      )
      NULL
    }
  )
}

#' Renderer del elemento degradado. Vive a nivel de paquete para que el
#' dispatcher (`get(paste0(".render_", etype), inherits = TRUE)`) lo resuelva
#' desde el closure de `reporte_ppt_plan()`.
#' @keywords internal
.render_canvas_degradado <- function(el, preset_args = list()) {
  .plan_canvas_sin_datos()
}
