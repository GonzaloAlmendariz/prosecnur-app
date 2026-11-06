# =============================================================================
# lamina_tamanos_declarados.R — la lámina nativa obedece los tamaños que declara el gráfico (CCSS Perfil 2026)
# =============================================================================
#
# Las láminas nativas (ADR 0093) dibujan desde la especificación y no desde el graficador ggplot, así que los
# `overrides` de tamaño del gráfico no les llegaban: en el mazo del Perfil del Estudiante 2026 `size_ejes`,
# `size_texto_barras` y `canvas_w_etiquetas` no cambiaban nada (láminas 51 y 64). Aquí se leen del gráfico y viajan en
# `espec$tamanos`, con las mismas unidades que tienen en el graficador:
#   - `size_ejes` en puntos: el cuerpo de los rótulos de categoría;
#   - `size_texto_barras` en milímetros (unidad de `geom_text`): el cuerpo de las cifras;
#   - `canvas_w_etiquetas` en fracción del ancho: la columna de rótulos, aquí del ancho útil de la lámina.
# Sólo cuentan los del gráfico (lo que el analista eligió para esa lámina), no los del preset: el preset trae tamaños
# para todos los gráficos ggplot y la lámina nativa tiene los suyos del estándar (`.std_pt`).

#' Tamaños que el gráfico declara para su lámina nativa
#' @param overrides `overrides` del elemento del plan.
#' @return `list(rotulo_pt, cifra_pt, w_etiquetas)`; cada uno `NULL` si no se declaró o no es un número positivo.
#' @keywords internal
.lam_tamanos_declarados <- function(overrides) {
  ov <- if (is.list(overrides)) overrides else list()
  num <- function(nm, tope = Inf) {
    v <- suppressWarnings(as.numeric(unlist(ov[[nm]]))[1])
    if (length(v) && is.finite(v) && v > 0 && v <= tope) v else NULL
  }
  cifra_mm <- num("size_texto_barras")
  list(rotulo_pt = num("size_ejes"),
       cifra_pt = if (!is.null(cifra_mm)) cifra_mm * 72 / 25.4,
       w_etiquetas = num("canvas_w_etiquetas", tope = 0.9))
}

#' La especificación con los tamaños declarados por su gráfico (`espec$tamanos`)
#' @keywords internal
.lam_espec_con_tamanos <- function(espec, el_plot) {
  if (!is.list(espec)) return(espec)
  t <- .lam_tamanos_declarados((el_plot %||% list())$overrides)
  t <- t[!vapply(t, is.null, logical(1))]
  if (length(t)) espec$tamanos <- t
  # En un cruce las premisas de la escala son los grupos («Nivel 6»): su columna se ajusta a la tinta. Una batería de
  # afirmaciones conserva las columnas del recetario (barra en 5.2 in, lámina 221).
  el <- el_plot %||% list()
  cruce <- as.character(unlist(el$cruces %||% character(0)))
  espec$premisas_son_grupos <- (length(cruce) && any(nzchar(trimws(cruce)))) || isTRUE(as.character(el$modo %||% "")[1] %in% c("cruce", "var_cruce"))
  espec
}

#' Columna de premisas de la escala: la declarada, o la tinta de sus rótulos cuando todos caben en una línea
#'
#' La columna medía siempre lo mismo (de `x_premisa` a `x_barra`), y con rótulos cortos («Nivel 6», los grupos de un
#' cruce) quedaban lejos de sus barras (CCSS 2026, lámina 51). En un cruce la columna mide ahora la tinta del rótulo más
#' ancho más su aire, y las barras arrancan ahí; con rótulos que no caben en una línea la columna sigue como estaba. Si el gráfico
#' declara `canvas_w_etiquetas`, manda esa fracción del ancho útil.
#' @param premisas Premisas del bloque (`.lam_escala_premisas`). @param wp Columna de siempre (in).
#' @param espec Especificación (lee `espec$tamanos$w_etiquetas` y `espec$premisas_son_grupos`: sin declaración, sólo las
#'   premisas de un cruce se ajustan a la tinta). @param auto ¿Se ajusta a la tinta sin declaración?
#' @return Ancho de la columna (in), nunca mayor que `wp` salvo declaración.
#' @keywords internal
.lam_escala_columna_premisa <- function(premisas, wp, espec = NULL, auto = TRUE) {
  frac <- (espec$tamanos %||% list())$w_etiquetas
  if (!is.null(frac)) {
    g_ <- .std_geom
    return(max(0.8, frac * (g_("ancho") - g_("margen_izq") - g_("margen_der"))))
  }
  if (isTRUE(auto) && !isTRUE(espec$premisas_son_grupos) && length(premisas) && .std_reserva_derecha() > 0) {
    return(.lam_escala_columna_con_tarjetas(premisas, wp))
  }
  if (!isTRUE(auto) || !isTRUE(espec$premisas_son_grupos) || !length(premisas)) return(wp)
  textos <- vapply(premisas, function(p) as.character(p$texto %||% "")[1], "")
  notas <- unlist(lapply(premisas, function(p) p$nota), use.names = FALSE)
  tinta <- max(c(0, .lam_ancho_tinta(textos, .std_pt("pregunta"), TRUE),
                 if (length(notas)) .lam_ancho_tinta(as.character(notas), .std_pt("n"))), na.rm = TRUE)
  if (!is.finite(tinta) || tinta <= 0) return(wp)
  propia <- max(1.0, tinta + 0.3)
  if (propia >= wp) wp else propia
}

#' Columna de premisas de una batería con tarjetas al lado: lo justo para que ninguna premisa gane una línea
#'
#' Con el panel de tarjetas la lámina pierde ancho y la columna fija dejaba aire a la izquierda de rótulos cortos
#' («ChatGPT», «Claude»). Todas las barras arrancan en el mismo punto (Gonzalo: «en multiapiladas todos deben empezar y
#' finalizar a la misma altura»), así que lo fija la premisa más larga: la columna se angosta mientras ninguna premisa
#' pase a más líneas que en la columna de siempre; nunca por debajo de 1 in ni por encima de `wp`. El alto de las filas
#' no cambia.
#' @keywords internal
.lam_escala_columna_con_tarjetas <- function(premisas, wp) {
  textos <- vapply(premisas, function(p) as.character(p$texto %||% "")[1], "")
  textos <- textos[nzchar(textos)]
  if (!length(textos)) return(wp)
  pt <- .std_pt("pregunta")
  lineas <- function(w) vapply(textos, function(x) .lam_lineas_tinta(x, w - 0.3, pt, TRUE), 0)
  tope <- lineas(wp)
  cabe <- function(w) all(lineas(w) <= tope)
  lo <- 1.0; hi <- wp
  if (cabe(lo)) return(lo)
  for (i in 1:20) { mid <- (lo + hi) / 2; if (cabe(mid)) hi <- mid else lo <- mid }
  hi
}

#' En la agrupada ggplot, un cuerpo declarado en el gráfico no se escala ni se topa por densidad
#'
#' El graficador baja `size_ejes` a 12.2 o 13.2 pt cuando los rótulos son largos y `size_texto_barras` según el número de
#' series, salvo con `preservar_tamanos_texto`; como el preset también trae esos tamaños, el graficador no distingue el
#' que eligió el analista. El constructor sí: si el gráfico los declara, enciende `preservar_tamanos_texto` (que no
#' quita el ajuste por alto: un rótulo que no cabe en su fila sigue bajando). Una declaración explícita de
#' `preservar_tamanos_texto` se respeta.
#' @keywords internal
.agrupadas_tamanos_declarados_mandan <- function(overrides) {
  if (!is.list(overrides) || !is.null(overrides$preservar_tamanos_texto)) return(overrides)
  t <- .lam_tamanos_declarados(overrides)
  if (!is.null(t$rotulo_pt) || !is.null(t$cifra_pt)) overrides$preservar_tamanos_texto <- TRUE
  overrides
}
