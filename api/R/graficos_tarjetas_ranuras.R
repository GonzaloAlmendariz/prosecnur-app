# Tarjetas de diferencias por gráfico en una lámina de dos gráficos (`p_slide_2_graficos`), extensión del ADR 0129
# =================================================================================================================
#
# La lámina pide tarjetas con un mapa por ranura en su meta:
#
#   meta$tarjetas_diferencias = list(izquierda = list(publico = "estudiantes"), derecha = TRUE)
#
# Cada valor es la misma opción de una lámina de un gráfico (`.tarjetas_opcion`): `TRUE` o una lista. Una ranura que no
# aparece, o con `FALSE`, va sin tarjetas. Se eligió el mapa en la meta de la lámina, y no la meta de cada ranura, porque
# la meta es de la lámina en todo el plan (el inspector la edita así) y porque `payload.izquierda` es un graficador, no
# una lámina. Tope: 2 tarjetas por gráfico (van debajo de su gráfico, dentro de su mitad).
#
# El cálculo es el de siempre (`.tarjetas_de_lamina`) con una lámina de un gráfico armada para cada ranura. El motor
# (`reporte_plan_ppt.R`, congelado) no tiene gancho propio para la rama `slide_2`: el PPT las calcula en
# `.lam_slide_2_despacho` y el Word en `.word_publico_marcar`, los dos con el entorno del motor a mano.

.TARJETAS_RANURAS <- c("izquierda", "derecha")
.TARJETAS_MAX_RANURA <- 2L
# v7.25, ítem 7 (lámina 45: «podría ser torta con significancia»): en una ranura la torta también lleva tarjetas.
.TARJETAS_TIPOS_RANURA <- c("categorica", "escala", "pie")

#' ¿La opción de tarjetas es un mapa por ranura?
#' @keywords internal
.tarjetas_es_mapa <- function(x) is.list(x) && length(x) > 0L && !is.null(names(x)) && any(names(x) %in% .TARJETAS_RANURAS)

#' Opción de cada ranura: `list(izquierda = opt|NULL, derecha = opt|NULL)`, o NULL si la lámina no pide tarjetas por ranura
#' @keywords internal
.tarjetas_mapa <- function(meta) {
  x <- (meta %||% list())$tarjetas_diferencias
  if (!.tarjetas_es_mapa(x)) return(NULL)
  out <- lapply(.TARJETAS_RANURAS, function(r) {
    o <- .tarjetas_opcion(list(tarjetas_diferencias = x[[r]]))
    if (!is.null(o)) o$max <- min(o$max, .TARJETAS_MAX_RANURA)
    o
  })
  names(out) <- .TARJETAS_RANURAS
  if (all(vapply(out, is.null, TRUE))) NULL else out
}

#' Lámina de un gráfico equivalente a una ranura (lo que espera `.tarjetas_de_lamina`)
#' @keywords internal
.tarjetas_lamina_de_ranura <- function(el, opt, titulo = NULL) {
  t <- titulo %||% el$overrides$titulo %||% el$title_slide %||% ""
  if (inherits(t, "ppt_element_text")) t <- t$text
  list(meta = list(tarjetas_diferencias = opt[setdiff(names(opt), "activo")]), slots = list(plot = el),
       title = as.character(t %||% "")[1])
}

#' Calcula las tarjetas de cada ranura de una lámina de dos gráficos
#'
#' @param ps,els Gráficos y elementos en el orden de las ranuras (izquierda, derecha).
#' @param env Entorno del motor (para `.resolve_ref`).
#' @return NULL si la lámina no pide tarjetas por ranura; si no, una lista de dos con las tarjetas de cada gráfico (o
#'   `list(pedidas = TRUE, tarjetas = list())` si la ranura las pidió y no hay diferencias).
#' @keywords internal
.tarjetas_de_ranuras <- function(ps, els, slide, env) {
  mapa <- .tarjetas_mapa(slide$meta)
  if (is.null(mapa) || length(ps) != 2L) return(NULL)
  resolver <- if (is.environment(env)) get0(".resolve_ref", envir = env, inherits = TRUE) else NULL
  if (!is.function(resolver)) return(NULL)
  lapply(seq_along(.TARJETAS_RANURAS), function(k) {
    opt <- mapa[[.TARJETAS_RANURAS[k]]]
    if (is.null(opt)) return(NULL)
    t <- tryCatch(.tarjetas_de_lamina(ps[[k]], .tarjetas_lamina_de_ranura(els[[k]], opt), resolver, tipos = .TARJETAS_TIPOS_RANURA), error = function(e) {
      if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(sprintf("Tarjetas de diferencias: no se pudieron calcular en «%s» (%s).",
                                                                        slide$title %||% "", conditionMessage(e)))
      NULL
    })
    if (is.null(t)) t <- list(tarjetas = list(), total = 0L, opcion = opt)
    t$tarjetas <- utils::head(t$tarjetas, .TARJETAS_MAX_RANURA)
    t$pedidas <- TRUE
    t
  })
}

#' Referencia de un elemento (sus variables), para reconocer su ranura
#' @keywords internal
.tarjetas_ref_elemento <- function(el) paste(as.character(unlist(el$vars %||% el$var %||% "")), collapse = "|")

#' Tarjetas de la figura del Word de una ranura (gancho de `.word_publico_marcar`)
#'
#' @param env Marco de `.push_render_meta_for_element`: por su cadena de entornos llega a la lámina en curso, su tipo y
#'   `.resolve_ref`.
#' @keywords internal
.tarjetas_word_ranura <- function(p, el, env) {
  if (!inherits(p, "ggplot") || !is.environment(env) || !is.null(attr(p, "pulso_tarjetas"))) return(p)
  if (!identical(get0("stype", envir = env, inherits = TRUE), "slide_2")) return(p)
  slide <- get0("slide", envir = env, inherits = TRUE)
  mapa <- .tarjetas_mapa(slide$meta)
  if (is.null(mapa)) return(p)
  ref <- .tarjetas_ref_elemento(el)
  lados <- list(izquierda = slide$slots$left, derecha = slide$slots$right)
  k <- which(vapply(lados, function(x) identical(.tarjetas_ref_elemento(x), ref), TRUE))[1]
  if (is.na(k) || is.null(mapa[[k]])) return(p)
  resolver <- get0(".resolve_ref", envir = env, inherits = TRUE)
  if (!is.function(resolver)) return(p)
  t <- tryCatch(.tarjetas_de_lamina(p, .tarjetas_lamina_de_ranura(el, mapa[[k]]), resolver, tipos = .TARJETAS_TIPOS_RANURA), error = function(e) NULL)
  # Sin diferencias la figura también lleva sus tarjetas (vacías): el Word escribe la línea «Sin diferencias…» (v7.25, ítem 5).
  if (!is.null(t) && (length(t$tarjetas) || !is.null(.tarjetas_sin_diferencias_texto(t)))) {
    t$tarjetas <- utils::head(t$tarjetas, .TARJETAS_MAX_RANURA)
    attr(p, "pulso_tarjetas") <- t
  }
  p
}
