# =============================================================================
# graficos_cifras_lote.R — las cifras con clave de varias láminas de resumen en un solo pedido (ADR 0135, punto 6)
# =============================================================================
#
# «Elegir cifra» del cierre con hallazgos lista las cifras de todas las láminas de resumen del informe. Con un pedido
# por lámina, Plumber los atiende en serie y cada uno vuelve a preparar las fuentes y los presets. El lote los prepara
# una vez (el router) y aquí renderiza cada lámina con `.graficos_cifras_de_grafico()`, el mismo cálculo del pedido
# suelto, de modo que una cifra del lote y la del pedido suelto no pueden discrepar.
#
#   laminas: [{id, slide: {graficador, args}, caja?}]   (también vale {id, graficador, args, caja?})
#   -> list(ok, por_lamina = list(<id> = list(tipo, cifras, avisos) | list(tipo = "", cifras = [], avisos = [],
#                                                                         error = list(code, message))))
#
# Con `detalle = TRUE` cada entrada trae además `detalle` (graficos_cifras_detalle.R); un mismo lote puede llevar
# variantes de args (con y sin una exclusión) para el antes y el después en un solo viaje.
#
# `por_lamina` sale en el orden del pedido. Dos láminas con el mismo graficador, los mismos args y la misma caja se
# renderizan una vez. El error de una lámina va en su entrada con su código E_* (los de `.graficos_cifras_de_grafico`); un fallo no
# previsto sale como E_INTERNAL con su `error_id`, sin el mensaje técnico. Sólo tumban el lote los defectos del pedido
# entero (sin láminas, ids vacíos o repetidos, más láminas que el tope): E_CIFRAS_INVALIDO.

.CIFRAS_LOTE_TOPE <- 200L

#' Las láminas del lote, validadas: `list(list(id, graficador, args))`
#' @keywords internal
.cifras_lote_items <- function(laminas) {
  if (!is.list(laminas) || !length(laminas)) {
    stop_api(400, "E_CIFRAS_INVALIDO", "El lote debe traer `laminas`: una lista de {id, slide}.")
  }
  if (length(laminas) > .CIFRAS_LOTE_TOPE) {
    stop_api(400, "E_CIFRAS_INVALIDO", sprintf("El lote admite hasta %d láminas.", .CIFRAS_LOTE_TOPE))
  }
  items <- lapply(laminas, function(it) {
    it <- if (is.list(it)) it else list()
    id <- trimws(as.character(it$id %||% "")[1])
    slide <- if (is.list(it$slide)) it$slide else it
    list(id = if (is.na(id)) "" else id, graficador = slide$graficador, args = slide$args %||% list(),
         caja = it$caja %||% slide$caja)
  })
  ids <- vapply(items, `[[`, "", "id")
  if (any(!nzchar(ids))) stop_api(400, "E_CIFRAS_INVALIDO", "Cada lámina del lote necesita su `id`.")
  if (anyDuplicated(ids)) {
    stop_api(400, "E_CIFRAS_INVALIDO", sprintf("El id «%s» se repite en el lote.", ids[anyDuplicated(ids)]))
  }
  items
}

#' La entrada de una lámina que falló: su código y su mensaje, sin cifras
#' @keywords internal
.cifras_lote_error <- function(code, message, detalle = FALSE) {
  out <- list(tipo = "", cifras = list(), avisos = list(), error = list(code = code, message = message))
  if (isTRUE(detalle)) out$detalle <- NA
  out
}

#' Las cifras de una lámina, con su fallo atrapado (nunca aborta el lote)
#' @keywords internal
.cifras_lote_una <- function(graficador, args, fuentes, presets, detalle = FALSE, caja = NULL) {
  tryCatch({
    r <- if (isTRUE(detalle)) {
      .graficos_cifras_de_grafico(graficador, if (is.list(args)) args else list(), fuentes, presets, detalle = TRUE, caja = caja)
    } else {
      .graficos_cifras_de_grafico(graficador, if (is.list(args)) args else list(), fuentes, presets)
    }
    out <- list(tipo = r$tipo, cifras = r$cifras, avisos = r$avisos)
    if (isTRUE(detalle)) out$detalle <- r$detalle
    out
  }, api_error = function(e) {
    .cifras_lote_error(e$code, conditionMessage(e), detalle)
  }, error = function(e) {
    error_id <- .api_error_id()
    message(sprintf("[prosecnur-app] E_INTERNAL %s: %s", error_id, conditionMessage(e)))
    .cifras_lote_error("E_INTERNAL", sprintf("Error interno del servidor (ref. %s).", error_id), detalle)
  })
}

#' Las cifras con clave de varias láminas de resumen (lo que responde el endpoint de cifras con `laminas`)
#'
#' @param laminas Lista de `{id, slide: {graficador, args}}`, como la manda el editor.
#' @param fuentes,presets Fuentes del estudio y presets efectivos, preparados una vez para todo el lote.
#' @param detalle Si `TRUE`, cada entrada trae `detalle` (`.graficos_cifras_de_grafico(detalle = TRUE)`).
#' @return `list(ok = TRUE, por_lamina = list(<id> = list(tipo, cifras, avisos, detalle?, error?)))`, en el orden del pedido.
#' @keywords internal
.graficos_cifras_lote <- function(laminas, fuentes, presets = NULL, detalle = FALSE) {
  items <- .cifras_lote_items(laminas)
  memo <- list()
  por_lamina <- list()
  for (it in items) {
    llave <- paste0(as.character(it$graficador %||% "")[1], "|",
                    jsonlite::toJSON(it$args, auto_unbox = TRUE, null = "null", digits = NA), "|",
                    if (isTRUE(detalle)) jsonlite::toJSON(it$caja, null = "null") else "")
    if (is.null(memo[[llave]])) memo[[llave]] <- .cifras_lote_una(it$graficador, it$args, fuentes, presets, detalle, it$caja)
    por_lamina[[it$id]] <- memo[[llave]]
  }
  list(ok = TRUE, por_lamina = por_lamina)
}
