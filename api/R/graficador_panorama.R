# Panorama: todas las preguntas de cada público de un vistazo (ADR 0134)
# =====================================================================
#
# PROBLEMA. El resumen ejecutivo abre con una pregunta que ningún gráfico por tema contesta: ¿qué público valora más
# y cuál concentra las preguntas bajas? Con 60 preguntas de estudiantes y 73 de docentes no hay barras que quepan.
#
# DISEÑO. Una fila por público y un punto por pregunta en su Top Two Box, desplazados en vertical para que no se
# encimen (el desplazamiento es determinista: la misma base da la misma lámina). La mediana del público es una
# línea; la referencia (60% por defecto) es una vertical punteada SIN rótulo de «tramo crítico» —la lámina describe,
# no califica—. A la derecha, fuera del área del gráfico, la tabla «Mediana» y «Bajo 60%» en `k de N`.

#' Desplazamiento vertical de los puntos de una fila, en fracción de su alto (−0.5 a 0.5)
#'
#' Secuencia de baja discrepancia (razón áurea) sobre el orden de los valores: los vecinos en el eje caen a alturas
#' distintas sin azar, así que la lámina se reproduce idéntica.
#' @keywords internal
.panorama_desplazamientos <- function(valores) {
  n <- length(valores)
  if (!n) return(numeric(0))
  r <- rank(valores, ties.method = "first")
  ((r * 0.6180339887) %% 1) - 0.5
}

#' Opción encendida salvo `FALSE` explícito (un espec viejo sin el campo dibuja como siempre)
#' @keywords internal
.panorama_bool <- function(x) !identical(as.logical(x)[1], FALSE)

#' Especificación del panorama (`panorama/1`)
#' @keywords internal
.espec_panorama <- function(data, var_publico = "publico", var_valor = "valor", referencia = 60, decimales = 0L,
                            colores = NULL, indicador = "Top Two Box", limite_x = NULL, var_item = NULL) {
  pub <- as.character(data[[var_publico]]); val <- suppressWarnings(as.numeric(data[[var_valor]]))
  publicos <- if (is.factor(data[[var_publico]])) intersect(levels(data[[var_publico]]), unique(pub)) else unique(pub)
  publicos <- publicos[!is.na(publicos) & nzchar(publicos)]
  if (!length(publicos)) stop("El panorama no tiene públicos que dibujar.", call. = FALSE)
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  ref <- suppressWarnings(as.numeric(referencia)[1])
  valores <- lapply(publicos, function(p) { v <- val[pub == p]; v[is.finite(v)] })
  # La pregunta de cada punto, en el orden de `valores`: con ella las tarjetas entre públicos concilian la prueba con lo
  # que dibuja la lámina (ADR 0138, graficos_tarjetas_publicos_radar_panorama.R).
  item <- if (!is.null(var_item) && var_item %in% names(data)) as.character(data[[var_item]]) else NULL
  items <- if (is.null(item)) NULL else lapply(publicos, function(p) { k <- pub == p; item[k][is.finite(val[k])] })
  if (!any(lengths(valores))) stop("El panorama no tiene preguntas con valor.", call. = FALSE)
  # Mediana y conteo sobre las cifras que se leen, como la diferencia del dumbbell.
  leidos <- lapply(valores, .pulso_round_half_up, digits = dec)
  medianas <- vapply(leidos, function(v) if (length(v)) stats::median(v) else NA_real_, 0)
  bajo <- vapply(leidos, function(v) if (is.finite(ref)) sum(v < ref) else NA_real_, 0)
  colores_p <- .contraste_colores(publicos, colores)
  eje <- .contraste_eje(c(unlist(valores), ref), limite_x)
  list(
    version = "panorama/1", tipo = "panorama",
    publicos = publicos, valores = valores, items = items, desplazamientos = lapply(valores, .panorama_desplazamientos),
    colores = colores_p, formas = .contraste_formas(length(publicos)),
    medianas = medianas, textos_mediana = ifelse(is.finite(medianas), paste0(.pulso_fmt_half_up(medianas, dec), "%"), "—"),
    bajo = bajo, total = lengths(valores),
    textos_bajo = if (is.finite(ref)) sprintf("%s de %s", bajo, lengths(valores)) else rep("—", length(publicos)),
    encabezado_bajo = if (is.finite(ref)) sprintf("Bajo %s%%", format(ref, trim = TRUE)) else "Preguntas",
    referencia = ref, indicador = indicador, eje = eje, decimales = dec
  )
}

#' Panorama de las preguntas de cada público
#'
#' @param data Data frame con una fila por (público, pregunta).
#' @param var_publico Columna del público (una fila de la lámina).
#' @param var_item Columna de la pregunta (sólo identifica; no se rotula).
#' @param var_valor Columna con el porcentaje (0–100).
#' @param referencia Porcentaje de la línea de referencia; `NA` la apaga.
#' @param indicador Qué mide cada punto, para la nota del pie.
#' @param mostrar_leyenda `FALSE` quita la leyenda «Mediana del público / Referencia 60%» de la lámina nativa; el
#'   gráfico ocupa su franja.
#' @param mostrar_bajo_umbral `FALSE` quita la columna «Bajo 60%» («2 de 60») de la tabla; el gráfico ocupa su ancho.
#'   La columna «Mediana» queda.
#' @family graficador
#' @export
graficar_panorama <- function(
    data,
    var_publico = "publico",
    var_item = "item",
    var_valor = "valor",
    referencia = 60,
    indicador = "Top Two Box",
    valores_decimales = 0L,
    colores_grupos = NULL,
    limite_x = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    font_family = "Arial",
    mostrar_leyenda = TRUE,
    mostrar_bajo_umbral = TRUE
) {
  if (!is.data.frame(data) || !nrow(data)) stop("`data` debe ser un data frame con al menos una fila.", call. = FALSE)
  for (col in c(var_publico, var_valor)) if (!col %in% names(data)) stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
  espec <- .espec_panorama(data, var_publico, var_valor, referencia, valores_decimales, colores_grupos, indicador, limite_x,
                           var_item = var_item)
  # Gonzalo, 2026-11-09 (su mazo estirado, lámina 2): la leyenda y la columna «Bajo» son opciones del analista. Sólo
  # cambian lo que se dibuja; la mediana y el conteo se siguen calculando (las tarjetas y las cifras clave los leen).
  espec$mostrar_leyenda <- .panorama_bool(mostrar_leyenda)
  espec$mostrar_bajo_umbral <- .panorama_bool(mostrar_bajo_umbral)
  k <- length(espec$publicos)
  puntos <- do.call(rbind, lapply(seq_len(k), function(i) {
    if (!length(espec$valores[[i]])) return(NULL)
    data.frame(publico = espec$publicos[i], x = espec$valores[[i]], y = (k - i + 1) + espec$desplazamientos[[i]] * 0.62,
               stringsAsFactors = FALSE)
  }))
  puntos$publico <- factor(puntos$publico, levels = espec$publicos)
  med <- data.frame(publico = espec$publicos, x = espec$medianas, y = k - seq_len(k) + 1, stringsAsFactors = FALSE)
  med <- med[is.finite(med$x), , drop = FALSE]
  formas_gg <- c(ellipse = 16, rect = 15, triangle = 17, diamond = 18)[espec$formas]
  eje <- espec$eje
  p <- ggplot2::ggplot(puntos, ggplot2::aes(x = .data$x, y = .data$y))   # P10: sin bandas alternas
  if (is.finite(espec$referencia)) {
    p <- p + ggplot2::geom_vline(xintercept = espec$referencia, linetype = "dashed", colour = .std_color("texto_tenue"), linewidth = 0.4)
  }
  p <- p +
    ggplot2::geom_point(ggplot2::aes(colour = .data$publico, shape = .data$publico), size = 2.4, show.legend = FALSE) +
    ggplot2::geom_segment(data = med, ggplot2::aes(x = .data$x, xend = .data$x, y = .data$y - 0.38, yend = .data$y + 0.38),
                          colour = .std_color("azul"), linewidth = 1.1) +
    ggplot2::scale_colour_manual(values = stats::setNames(espec$colores, espec$publicos)) +
    ggplot2::scale_shape_manual(values = stats::setNames(unname(formas_gg), espec$publicos)) +
    ggplot2::scale_x_continuous(limits = c(eje[["lo"]], eje[["hi"]]), breaks = seq(eje[["lo"]], eje[["hi"]], by = eje[["paso"]]),
                                labels = function(x) paste0(x, "%"), expand = c(0.01, 0)) +
    ggplot2::scale_y_continuous(breaks = rev(seq_len(k)), labels = espec$publicos, limits = c(0.5, k + 0.5), expand = c(0, 0)) +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(panel.grid.minor = ggplot2::element_blank(), panel.grid.major.y = ggplot2::element_blank(),
                   panel.grid.major.x = ggplot2::element_line(colour = .PULSO_COLOR_GRID, linewidth = 0.3),
                   axis.text.y = ggplot2::element_text(face = "bold", colour = .std_color("azul"), size = 11),
                   axis.text.x = ggplot2::element_text(colour = .std_color("texto_tenue"), size = 9),
                   plot.background = ggplot2::element_rect(fill = NA, colour = NA))
  attr(p, "pulso_espec") <- espec
  p
}
