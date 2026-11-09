# =============================================================================
# graficos_escala_comodin.R — la escala del resumen sin regla: `base$*` y el recorte por la métrica (P5)
# =============================================================================
#
# Prueba con Arte (2026-11-09): `p_barras_divergentes(vars = "docentes$*", estilo = "resumen")` sin regla no llegaba a
# dibujarse («`*` no se encuentra en `data`») y, si hubiera llegado, el recorte por espacio no lo veía: buscaba la
# referencia literal `base$*`. `base$*` dice lo mismo con o sin regla: las preguntas de escala de esa base, alineadas con
# la escala más frecuente (las mismas que la regla «todas» evalúa, graficos_regla_indicadores.R).
#
# Si no caben, sin regla también se recorta por la métrica que la lámina dibuja (decisión del lead, 2026-11-09): el
# Top Two Box de cada fila, de la más baja a la más alta, con el desempate sin redondear de graficos_regla_desempate.R;
# nunca por el orden del instrumento. El pie: «Se muestran las 20 más bajas de 73 preguntas de escala; el resto en otra
# lámina.».

#' ¿Alguna referencia es `base$*`?
#' @keywords internal
.divergentes_hay_comodin <- function(vars) any(grepl("\\$\\*$", as.character(unlist(vars))))

#' La escala del resumen sin regla: expande `base$*` y, si no cabe, deja las más bajas por su Top Two Box
#'
#' @param el Elemento (sin regla). @param args Args efectivos (preset + overrides). @param preset Preset del tipo.
#' @return El elemento con `vars` medidas (y recortadas), `.firma_leyenda`, `.comodin_expandido = TRUE` y, si recortó,
#'   `.texto_tope`; intacto si no aplica.
#' @keywords internal
.divergentes_expandir_comodin <- function(el, args, preset = NULL) {
  v <- as.character(unlist(el$vars))
  if (!is.null(el$regla) || !identical(args$estilo, "resumen")) return(el)
  if (!.divergentes_hay_comodin(v) && length(v) <= .LAM_DIV_RESUMEN_MAX_FILAS && is.null(el$continuar_desde) && is.null(el$hasta)) return(el)
  sources <- .regla_preguntas_fuentes_render("barras divergentes")
  r <- .regla_preguntas_de_elemento(utils::modifyList(el, list(.sin_recorte = TRUE)), sources, regla = list(tipo = "todas"), preset = preset)
  for (av in r$avisos[!grepl("^La regla elige", r$avisos)]) .pulso_aviso(av)
  if (!length(r$vars)) stop("La escala no deja ninguna pregunta que se pueda dibujar.", call. = FALSE)
  vars <- .divergentes_por_metrica(r$vars, r$indicadores)
  n <- length(vars); tope <- .LAM_DIV_RESUMEN_MAX_FILAS
  el$.n_sin_recorte <- n
  desde <- .tope_espacio_desde(el$continuar_desde)   # P14
  if (desde > n) stop("`continuar_desde` (", desde, ") pasa de las ", n, " preguntas de la escala.", call. = FALSE)
  # O1: en una serie las posiciones cuentan en el orden en que la lámina dibuja (graficos_tope_orden_dibujo.R).
  sentido <- "de la más baja a la más alta"
  if (.tope_espacio_en_serie(el)) {
    orden <- as.character(args$orden %||% "top_two_box")[1]
    el_o <- el; el_o$overrides <- utils::modifyList(el$overrides %||% list(), list(orden = orden))
    vars <- vars[.tope_espacio_orden_dibujo(vars, r$indicadores, el_o, NULL, FALSE)]
    sentido <- switch(orden, top_two_box = "de la más alta a la más baja", declarado = sentido, NULL)
  }
  vars <- vars[desde:n]
  k <- min(tope, length(vars), if (!is.null(el$hasta)) el$hasta - desde + 1L)   # S6
  if (length(vars) > k || desde > 1L) {
    if (length(vars) > k) .pulso_aviso(.aviso_en_lamina(.tope_espacio_aviso(k, n, desde, consejo = FALSE)))
    vars <- vars[seq_len(k)]
    el$.texto_tope <- .tope_espacio_mas_bajas(k, n, desde, rango = !is.null(el$hasta), sentido = sentido)
  }
  el$.vars_declaradas <- el$.vars_declaradas %||% el$vars   # O4 (graficos_serie_plan.R)
  el$vars <- vars
  el$var <- if (length(vars) == 1L) vars else NULL
  el$.firma_leyenda <- r$firma_leyenda
  el$.comodin_expandido <- TRUE
  el
}

#' Las preguntas de la más baja a la más alta por el Top Two Box que dibuja la lámina (desempate sin redondear, luego
#' el orden del instrumento)
#' @keywords internal
.divergentes_por_metrica <- function(vars, ind) {
  i <- match(vars, as.character(ind$tema))
  val <- suppressWarnings(as.numeric(ind$valor[i])); fino <- suppressWarnings(as.numeric((ind$valor_fino %||% ind$valor)[i]))
  inf <- function(x) ifelse(is.finite(x), x, Inf)
  vars[order(inf(val), inf(round(fino, 6L)), seq_along(vars))]
}
