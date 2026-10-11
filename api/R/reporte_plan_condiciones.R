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

#' Sello estructurado de una degradación a canvas «Sin datos»
#'
#' Además del `warning()` (log) y del `.pulso_aviso()` (texto para el analista), cada degradación señala una condición
#' `pulso_lamina_degradada` con su `motivo`. Quien necesite contarlas (la vista previa y las miniaturas,
#' graficos_miniaturas.R) la escucha con `withCallingHandlers()` en vez de leer el texto del aviso, que es para personas y
#' puede cambiar. Sin nadie escuchando, `signalCondition()` no hace nada.
#' @param motivo «error_render» (el renderer abortó con `pulso_slide_render_error`), «render_nulo» (devolvió NULL) o
#'   «elemento_invalido» (el slot no era un `ppt_element`).
#' @keywords internal
.pulso_senal_degradado <- function(motivo, mensaje = "") {
  signalCondition(structure(
    class = c("pulso_lamina_degradada", "condition"),
    list(message = as.character(mensaje)[1], motivo = as.character(motivo)[1], call = NULL)
  ))
  invisible(NULL)
}

#' Sello de un gráfico que el motor dibuja como «Sin datos para mostrar» (embudo `.blank_canvas` de reporte_plan_ppt.R)
#'
#' Cubre lo que no es una degradación por error: la tabla quedó vacía porque no hay respuestas válidas (variable toda NA,
#' filtro con casos pero NA en la variable, `excluir_opciones` que cubre todo, pesos en cero) o porque los filtros dejaron
#' 0 filas (`.tab_freq` devuelve NULL sólo en ese caso; los errores de `freq_table_spss` se propagan y degradan por
#' `pulso_slide_render_error`). Señala `pulso_grafico_sin_datos`, que hereda de `pulso_lamina_degradada` con
#' `motivo = "sin_respuestas_validas"`, y devuelve `x` intacto (la llamada envuelve una expresión existente para no crecer
#' reporte_plan_ppt.R, congelado). Sin nadie escuchando no hace nada.
#'
#' La señal se emite dentro de un restart `pulso_silenciar_sin_datos`: `.plan_render_element_degradable` la silencia
#' cuando viene de un BLOQUE (multilista llama a `.blank_canvas` por bloque) y re-señala una sola vez por gráfico, sólo si
#' el gráfico entero quedó vacío.
#' @keywords internal
.pulso_senal_sin_datos <- function(x, mensaje = "Sin datos para mostrar") {
  withRestarts(
    signalCondition(structure(
      class = c("pulso_grafico_sin_datos", "pulso_lamina_degradada", "condition"),
      list(message = as.character(mensaje %||% "")[1], motivo = "sin_respuestas_validas", call = NULL)
    )),
    pulso_silenciar_sin_datos = function() NULL
  )
  x
}

#' Dibuja un elemento de primer nivel deduplicando sus señales `pulso_grafico_sin_datos`
#'
#' Un gráfico es una unidad: sus bloques (multilista: `el$bloques`) pueden caer cada uno al canvas vacío. Las señales de
#' adentro se silencian y, si cubren todas las partes que el gráfico DIBUJÓ, se emite UNA sola al salir. Un gráfico con
#' algún bloque con datos no cuenta como vacío.
#'
#' Las partes dibujadas son los bloques que quedaron en la grilla de la multilista (`attr(out, "pulso_multilista")$bloques`,
#' de `.lam_multilista_adjuntar`): un bloque para el que `.render_barras_multiapiladas` devolvió NULL se salta y no cuenta.
#' Si el resultado no es una grilla de multilista (gráfico simple, o el canvas vacío final cuando no quedó ningún bloque)
#' es una sola parte.
#' @keywords internal
.plan_con_sin_datos_por_grafico <- function(el, expr) {
  senales <- 0L
  out <- withCallingHandlers(expr, pulso_grafico_sin_datos = function(cnd) {
    senales <<- senales + 1L
    invokeRestart("pulso_silenciar_sin_datos")
  })
  if (senales > 0L && senales >= .plan_partes_dibujadas(out)) .pulso_senal_sin_datos(NULL)
  out
}

#' Partes que dibujó un elemento: bloques en la grilla de una multilista, o 1
#' @keywords internal
.plan_partes_dibujadas <- function(out) {
  bloques <- (attr(out, "pulso_multilista", exact = TRUE) %||% list())$bloques
  max(1L, length(bloques))
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
    .plan_con_sin_datos_por_grafico(el, .plan_con_etiquetas_cortas(el, impl(el))),  # K12a: etiqueta corta mientras se dibuja
    pulso_slide_render_error = function(cnd) {
      msg <- .aviso_en_lamina(paste0("no se pudo dibujar y sale con «Sin datos».", .aviso_motivo(conditionMessage(cnd))))
      # El `warning()` es el rastro del log; el `.pulso_aviso()` es lo que llega
      # al analista. Sin el segundo, el mazo sale con una lamina en blanco y la
      # razon se queda en el stderr del subproceso: el renderer se traga los
      # `warning()` (ver jobs.R). Vara V4. El mensaje técnico, aunque el aviso lo calle, queda en el stderr del
      # proceso —el `.err` del job— por `.aviso_detalle` (graficos_avisos_texto.R).
      warning(paste0(msg, " Detalle: ", conditionMessage(cnd)), call. = FALSE)
      .aviso_detalle("render degradado a «Sin datos»: ", conditionMessage(cnd))
      .pulso_aviso(msg)
      .pulso_senal_degradado("error_render", msg)
      .plan_canvas_sin_datos()
    }
  )
}

#' Degradacion cuando un renderer devolvio NULL sin error: warning + canvas.
#' Reemplaza 1:1 a los `stop("No se pudo renderizar ...")` historicos.
#' @keywords internal
.plan_canvas_render_nulo <- function(...) {
  # El detalle de quien llama va al aviso sólo si se lee (`.aviso_motivo`); «No se pudo renderizar `icono` en `p_slide_…()`»
  # se queda en el log.
  warning(paste0(paste0(...), " La lámina sale con «Sin datos»."), call. = FALSE)
  .aviso_detalle("render nulo: ", ...)   # al `.err` del job: el `warning()` se lo traga el renderer
  msg <- .aviso_en_lamina(paste0("un gráfico no se pudo dibujar y su espacio sale con «Sin datos».", .aviso_motivo(paste0(...))))
  .pulso_aviso(msg)
  .pulso_senal_degradado("render_nulo", msg)
  .plan_canvas_sin_datos()
}

#' Reemplazo declarativo para un slot que debia ser `ppt_element` y no lo es
#' (plan mangleado, p. ej. rectangularizacion JSON). Devuelve un elemento del
#' tipo `canvas_degradado`, cuyo renderer es el canvas "Sin datos": la lamina
#' sale degradada con warning en vez de matar el deck completo.
#' @keywords internal
.plan_elemento_degradado <- function(...) {
  warning(paste0(paste0(...), " La lámina sale con «Sin datos»."), call. = FALSE)
  .aviso_detalle("elemento inválido: ", ...)   # el detalle técnico, al `.err` del job
  msg <- .aviso_en_lamina(paste0("un gráfico quedó incompleto en el plan y su espacio sale con «Sin datos».", .aviso_motivo(paste0(...)),
                                 " Vuelve a elegir su tipo de gráfico en el editor."))
  .pulso_aviso(msg)
  .pulso_senal_degradado("elemento_invalido", msg)
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
      .aviso_detalle("base del elemento: ", conditionMessage(cnd))
      .pulso_aviso(.aviso_en_lamina(paste0(
        "no se pudo calcular la base de un gráfico y sale sin rótulo de base.", .aviso_motivo(conditionMessage(cnd))
      )))
      warning(
        paste0(
          "No se pudo calcular la base del elemento; la lámina sale sin rótulo de base: ",
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
