# Fortalezas y alertas: las preguntas más altas y más bajas de un público (ADR 0135, punto 6)
# =====================================================================
#
# PROBLEMA. El resumen ejecutivo necesita decir, para un público, qué valora más y qué menos sin recorrer sus 60
# preguntas. Un ranking entero no cabe y esconde los extremos en el medio.
#
# DISEÑO. Dos columnas lado a lado: «Más altas» y «Más bajas». Cada fila es el rótulo de la pregunta y una barra
# horizontal con su indicador (Top Two Box); la cifra va dentro de la barra y, si no cabe, fuera. Las dos columnas
# comparten la escala de 0 a 100 para que una barra de la izquierda y una de la derecha se comparen a la vista. El tono
# de cada columna es el del estándar (los extremos de la paleta Likert: el verde del acuerdo y el naranja del
# desacuerdo; nunca rojo). No se rotula ningún «tramo crítico»: la lámina describe, no califica.
#
# Qué pregunta va a qué columna lo decide su cifra: las `n` más altas de las elegidas van a la izquierda, de mayor a
# menor; las demás, a la derecha, de menor a mayor. Con la regla por defecto (`extremos`) es exactamente el reparto de
# la regla; con un ajuste a mano, la pregunta agregada cae en la columna que le toca por su cifra.

.FORTALEZAS_COLUMNAS <- c(altas = "Más altas", bajas = "Más bajas")

#' Colores de las dos columnas: los extremos de la paleta Likert del estándar
#' @keywords internal
.fortalezas_colores <- function() {
  lk <- unname(.std_paleta("likert"))
  c(altas = .std_color("verde_top_two_box") %||% lk[4], bajas = lk[1])
}

#' Especificación de fortalezas y alertas (`fortalezas/1`)
#'
#' @param data Una fila por pregunta elegida: rótulo, valor (0–100) y, para el desempate, el orden del instrumento.
#' @param n Cuántas van en «Más altas»; el resto va en «Más bajas».
#' @param nota_base Texto de la base del público para el pie («Base: Docentes 115 (93%)»).
#' @return Lista `fortalezas/1` con `columnas` (una por lado: `clave`, `titulo`, `color`, `rotulos`, `valores`,
#'   `cifras`), `publico`, `indicador`, `nota_base` y `decimales`.
#' @keywords internal
.espec_fortalezas <- function(data, var_rotulo = "rotulo", var_valor = "valor", var_orden = NULL, n = 5L, publico = NULL,
                              indicador = "Top Two Box", nota_base = NULL, decimales = 0L, colores = NULL) {
  rot <- as.character(data[[var_rotulo]]); val <- suppressWarnings(as.numeric(data[[var_valor]]))
  ok <- is.finite(val) & !is.na(rot) & nzchar(trimws(rot))
  if (!any(ok)) stop("Fortalezas y alertas no tiene preguntas con valor.", call. = FALSE)
  orden <- if (!is.null(var_orden) && var_orden %in% names(data)) suppressWarnings(as.numeric(data[[var_orden]])) else seq_along(val)
  rot <- rot[ok]; val <- val[ok]; orden <- orden[ok]
  dec <- suppressWarnings(as.integer(decimales)[1]); if (!is.finite(dec) || dec < 0L) dec <- 0L
  k <- suppressWarnings(as.integer(n)[1]); if (!is.finite(k) || k < 1L) k <- 5L
  # Se ordena por la cifra que se lee (como la regla): dos preguntas que se leen igual desempatan por el instrumento.
  leido <- .pulso_round_half_up(val, dec)
  desc <- order(-leido, orden)
  altas <- utils::head(desc, k)
  resto <- setdiff(desc, altas)
  bajas <- resto[order(leido[resto], orden[resto])]
  col <- .fortalezas_colores()
  if (length(colores) >= 2L) {
    col <- if (!is.null(names(colores)) && all(c("altas", "bajas") %in% names(colores))) unlist(colores)[c("altas", "bajas")] else unlist(colores)[1:2]
    names(col) <- c("altas", "bajas")
  }
  columna <- function(clave, ix) list(clave = clave, titulo = unname(.FORTALEZAS_COLUMNAS[[clave]]), color = unname(col[[clave]]),
                                      rotulos = rot[ix], valores = val[ix], cifras = paste0(.pulso_fmt_half_up(val[ix], dec), "%"))
  list(version = "fortalezas/1", tipo = "fortalezas",
       publico = as.character(publico %||% "")[1],
       columnas = list(columna("altas", altas), columna("bajas", bajas)),
       indicador = indicador, nota_base = nota_base, decimales = dec, eje = c(lo = 0, hi = 100))
}

#' Fortalezas y alertas de un público
#'
#' Dibujo de respaldo (ggplot) de la lámina nativa `lamina_fortalezas.R`, con la misma especificación.
#'
#' @param data Data frame con una fila por pregunta elegida.
#' @param var_rotulo Columna del rótulo de la pregunta.
#' @param var_valor Columna del indicador (0–100).
#' @param var_orden Columna del orden del instrumento (desempate); opcional.
#' @param n Cuántas preguntas van en «Más altas».
#' @param indicador Qué mide cada barra, para el pie.
#' @param nota_base Base del público para el pie.
#' @family graficador
#' @export
graficar_fortalezas <- function(
    data,
    var_rotulo = "rotulo",
    var_valor = "valor",
    var_orden = NULL,
    n = 5L,
    publico = NULL,
    indicador = "Top Two Box",
    nota_base = NULL,
    valores_decimales = 0L,
    colores_grupos = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    font_family = "Arial"
) {
  if (!is.data.frame(data) || !nrow(data)) stop("`data` debe ser un data frame con al menos una fila.", call. = FALSE)
  for (col in c(var_rotulo, var_valor)) if (!col %in% names(data)) stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
  espec <- .espec_fortalezas(data, var_rotulo, var_valor, var_orden, n, publico, indicador, nota_base, valores_decimales, colores_grupos)
  filas <- do.call(rbind, lapply(espec$columnas, function(cl) {
    if (!length(cl$rotulos)) return(NULL)
    data.frame(columna = cl$titulo, rotulo = cl$rotulos, valor = cl$valores, cifra = cl$cifras, color = cl$color,
               y = rev(seq_along(cl$rotulos)), stringsAsFactors = FALSE)
  }))
  filas$columna <- factor(filas$columna, levels = unname(.FORTALEZAS_COLUMNAS))
  # El rótulo va a la izquierda del cero, partido en 2.3 in y hasta tres líneas con «…»: entero, un enunciado de 200
  # caracteres se salía por la izquierda del panel y se montaba sobre las barras y las cifras (Arte, 2026-11-07).
  filas$rotulo <- .gg_rotulos_resumen(filas$rotulo, 2.3, 9, .gg_rotulos_max_lineas(max(filas$y), alto = 4.6, size = 9))
  colores <- stats::setNames(vapply(espec$columnas, `[[`, "", "color"), unname(.FORTALEZAS_COLUMNAS))
  p <- ggplot2::ggplot(filas, ggplot2::aes(y = .data$y)) +
    ggplot2::geom_col(ggplot2::aes(x = .data$valor, fill = .data$columna), orientation = "y", width = 0.62, show.legend = FALSE) +
    ggplot2::geom_text(ggplot2::aes(x = .data$valor, label = .data$cifra), hjust = -0.15, size = 3.2, colour = .std_color("azul"), family = font_family) +
    ggplot2::geom_text(ggplot2::aes(x = -2, label = .data$rotulo), hjust = 1, size = 9 / ggplot2::.pt, lineheight = 0.95,
                       colour = .std_color("azul"), family = font_family) +
    ggplot2::facet_wrap(~columna, nrow = 1) +
    ggplot2::scale_fill_manual(values = colores) +
    ggplot2::scale_x_continuous(limits = c(-75, 112), breaks = NULL, expand = c(0, 0)) +
    ggplot2::scale_y_continuous(breaks = NULL) +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = NULL, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(panel.grid = ggplot2::element_blank(),
                   strip.text = ggplot2::element_text(face = "bold", colour = .std_color("azul"), size = 12, hjust = 0.5),
                   plot.background = ggplot2::element_rect(fill = NA, colour = NA))
  attr(p, "pulso_espec") <- espec
  # La base del público va al pie de la lámina, abajo a la izquierda (`note_outside`), no dentro del dibujo.
  nota <- .lam_unir_base(espec$nota_base, nota_pie)
  if (nzchar(nota)) attr(p, "note_outside") <- nota
  p
}
