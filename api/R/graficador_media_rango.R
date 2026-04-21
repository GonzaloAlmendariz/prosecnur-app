#' Graficar medias con rango por categoria
#'
#' Construye un grafico resumido para variables numericas u ordinales
#' segmentadas por categoria, mostrando una media y un rango tipico por grupo.
#'
#' @param data `data.frame` o `tibble` con columnas de categoria y valor.
#' @param var_categoria Nombre (string) de la columna categorica.
#' @param var_valor Nombre (string) de la columna numerica.
#' @param orientacion `"vertical"` o `"horizontal"`.
#' @param colores_categorias Vector de colores por categoria (opcional).
#' @param modo `"score"`, `"score_ref"` o `"delta"`.
#' @param ref_score Referencia para `score_ref`/`delta`. Puede ser `"total_definicion"`,
#'   `"meta_100"` o un numerico escalar.
#' @param mostrar_ref_line Si `TRUE`, dibuja linea de referencia.
#' @param ref_label Etiqueta visible de la referencia.
#' @param mostrar_ref_label Si `TRUE`, muestra la etiqueta superior del box de
#'   referencia. Si `FALSE`, conserva el box con solo el valor numerico.
#' @param tipo_rango Tipo de rango a mostrar: `"iqr"`, `"p10_p90"`, `"minmax"` o `"custom"`.
#' @param probs_rango Probabilidades cuando `tipo_rango = "custom"`.
#' @param mostrar_media Si `TRUE`, dibuja un punto de media.
#' @param size_punto_media,shape_punto_media,stroke_punto_media Estilo del punto medio.
#' @param ancho_rango,linewidth_rango,alpha_rango Estilo del rango vertical.
#' @param marker_style Estilo del marcador principal: `"burbuja"`, `"rectangulo"`,
#'   `"punto_texto"` o `"punto"`.
#' @param escala_burbuja Multiplicador del radio visual cuando `marker_style = "burbuja"`.
#' @param altura_bloque_ref_rel Altura relativa del bloque de referencia cuando
#'   `modo = "score_ref"` y `mostrar_ref_line = TRUE`.
#' @param umbral_brecha Etiqueta la diferencia solo cuando su valor absoluto es
#'   mayor o igual a este umbral.
#' @param pos_delta Posicion del texto de diferencia frente a la linea punteada:
#'   `"centro"`, `"derecha"` o `"izquierda"`.
#' @param offset_delta Separacion lateral del texto de diferencia respecto a la linea.
#' @param mostrar_rango Si `TRUE`, dibuja el rango.
#' @param mostrar_chip Si `TRUE`, agrega chip con la media por categoria.
#' @param color_media,size_media Compatibilidad visual para el chip.
#' @param cortes_chip,chip_colores,chip_texto_color,chip_decimales,chip_sufijo Estilo del chip.
#' @param modo_semaforo Modo del semaforo para los chips: `"grupos"`,
#'   `"degradado_automatico"` o `"degradado_manual"`. `"degradado"` se mantiene
#'   como alias de compatibilidad hacia `"degradado_automatico"`.
#' @param semaforo_gradiente_colores,semaforo_gradiente_valores,semaforo_gradiente_limites
#'   Parametros del gradiente manual para los chips.
#' @param semaforo_gradiente_segmentos Numero de segmentos internos del
#'   gradiente automatico.
#' @param mostrar_n_por_categoria Si `TRUE`, imprime base por categoria.
#' @param prefijo_n,size_n,color_n Estilo de texto de base.
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param pos_titulo,pos_nota_pie Alineacion horizontal de titulo y pie.
#' @param color_titulo,size_titulo,color_subtitulo,size_subtitulo Estilo de encabezado.
#' @param color_nota_pie,size_nota_pie Estilo de pie.
#' @param color_ejes,size_ejes Estilo de ejes.
#' @param limites_y Vector numerico de largo 2 para fijar limites del eje de valores.
#' @param cortes_y Vector numerico opcional con cortes del eje de valores.
#' @param color_fondo Color de fondo.
#' @param mostrar_leyenda Si `TRUE`, muestra leyenda por categoria.
#' @param invertir_barras Si `TRUE`, invierte orden de categorias.
#' @param ancho_max_eje_cat Ancho de wrap para etiquetas de categoria.
#' @param usar_canvas Si `TRUE`, compone titulo/panel/leyenda/pie con `cowplot`.
#' @param canvas_h_title,canvas_h_legend,canvas_h_caption,canvas_pad_top Proporciones relativas del canvas.
#' @param debug_ph_bordes Si `TRUE`, dibuja borde de depuracion.
#' @param debug_ph_col,debug_ph_lwd Color y grosor del borde de depuracion.
#' @param exportar Tipo de salida: `"rplot"`, `"png"`, `"ppt"` o `"word"`.
#' @param path_salida Ruta de salida cuando `exportar != "rplot"`.
#' @param ancho,alto,dpi Dimensiones y resolucion de exportacion.
#' @param ppt_append Si `TRUE` y `path_salida` existe, agrega slide al PPT.
#' @param ppt_layout,ppt_master Layout/master al exportar a PPT.
#'
#' @return Si `exportar = "rplot"`, devuelve el objeto grafico. En otros casos,
#'   exporta y retorna invisiblemente el grafico.
#'
#' @family graficador
#' @export
graficar_media_rango <- function(
    data,
    var_categoria,
    var_valor,
    orientacion       = c("vertical", "horizontal"),
    colores_categorias = NULL,
    modo              = c("score", "score_ref", "delta"),
    ref_score         = "total_definicion",
    mostrar_ref_line  = FALSE,
    ref_label         = "Promedio general",
    mostrar_ref_label = TRUE,
    tipo_rango        = c("iqr", "p10_p90", "minmax", "custom"),
    probs_rango       = NULL,
    mostrar_media     = TRUE,
    size_punto_media  = 2.4,
    shape_punto_media = 16,
    stroke_punto_media = 0.2,
    ancho_rango       = 0.16,
    linewidth_rango   = 0.90,
    alpha_rango       = 0.95,
    marker_style      = c("burbuja", "rectangulo", "punto_texto", "punto"),
    escala_burbuja    = 1,
    altura_bloque_ref_rel = 0.13,
    size_chip_ref_max_pt  = NULL,
    umbral_brecha     = 0,
    pos_delta         = c("centro", "derecha", "izquierda"),
    offset_delta      = 0.12,
    mostrar_rango     = TRUE,
    mostrar_chip      = TRUE,
    color_media       = "#173B63",
    size_media        = 2.3,
    cortes_chip       = NULL,
    modo_semaforo     = c("grupos", "degradado_automatico", "degradado_manual", "degradado"),
    semaforo_gradiente_colores = NULL,
    semaforo_gradiente_valores = NULL,
    semaforo_gradiente_limites = NULL,
    semaforo_gradiente_segmentos = 20L,
    chip_colores      = c(rojo = "#C62828", ambar = "#EF6C00", verde = "#2E7D32"),
    chip_texto_color  = "#000000",
    chip_decimales    = 1,
    chip_sufijo       = "",
    mostrar_n_por_categoria = FALSE,
    prefijo_n         = "N=",
    size_n            = 2.8,
    color_n           = "#000000",
    titulo            = NULL,
    subtitulo         = NULL,
    nota_pie          = NULL,
    pos_titulo        = c("izquierda", "centro", "derecha"),
    pos_nota_pie      = c("derecha", "izquierda", "centro"),
    color_titulo      = "#000000",
    size_titulo       = 11,
    color_subtitulo   = "#000000",
    size_subtitulo    = 9,
    color_nota_pie    = "#000000",
    size_nota_pie     = 8,
    color_ejes        = "#000000",
    size_ejes         = 9,
    limites_y         = NULL,
    cortes_y          = NULL,
    color_fondo       = NA,
    mostrar_leyenda   = FALSE,
    invertir_barras   = FALSE,
    ancho_max_eje_cat = NULL,
    usar_canvas       = TRUE,
    canvas_h_title    = 0.14,
    canvas_h_legend   = 0.08,
    canvas_h_caption  = 0.06,
    canvas_pad_top    = 0.01,
    debug_ph_bordes   = FALSE,
    debug_ph_col      = "#FF00FF",
    debug_ph_lwd      = 0.8,
    exportar          = c("rplot", "png", "ppt", "word"),
    path_salida       = NULL,
    ancho             = 10,
    alto              = 6,
    dpi               = 300,
    ppt_append        = TRUE,
    ppt_layout        = "Blank",
    ppt_master        = "Office Theme"
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y

  .hjust_from_pos <- function(x) switch(x, izquierda = 0, centro = 0.5, derecha = 1, 0.5)

  .mk_text_panel <- function(top = NULL, bottom = NULL, pos = "izquierda",
                             col_top = "#000000", col_bottom = "#000000",
                             size_top = 11, size_bottom = 9) {
    if (!requireNamespace("cowplot", quietly = TRUE)) {
      stop("Para `usar_canvas=TRUE` se requiere 'cowplot'.", call. = FALSE)
    }
    h <- .hjust_from_pos(pos)
    x <- h
    p <- cowplot::ggdraw()
    if (!is.null(top) && nzchar(trimws(as.character(top)[1]))) {
      p <- p + cowplot::draw_label(
        label = as.character(top)[1],
        x = x, y = 0.68, hjust = h, vjust = 0.5,
        fontface = "bold", colour = col_top, size = size_top
      )
    }
    if (!is.null(bottom) && nzchar(trimws(as.character(bottom)[1]))) {
      p <- p + cowplot::draw_label(
        label = as.character(bottom)[1],
        x = x, y = 0.26, hjust = h, vjust = 0.5,
        fontface = "plain", colour = col_bottom, size = size_bottom
      )
    }
    p
  }

  .mk_palette <- function(levels_cat, pal_user = NULL) {
    levels_cat <- as.character(levels_cat)
    levels_cat <- levels_cat[!is.na(levels_cat) & nzchar(trimws(levels_cat))]
    if (!length(levels_cat)) return(character(0))

    base_pal <- c(
      "#0B4F8C", "#2A9D8F", "#E9C46A", "#F4A261",
      "#E76F51", "#7A9E9F", "#6D597A", "#5B8DEF"
    )

    if (is.null(pal_user) || !length(pal_user)) {
      if (length(levels_cat) <= length(base_pal)) {
        vals <- base_pal[seq_along(levels_cat)]
      } else {
        vals <- scales::hue_pal(h = c(200, 360), c = 70, l = 55)(length(levels_cat))
      }
      return(stats::setNames(vals, levels_cat))
    }

    pal_user <- as.character(pal_user)
    if (!is.null(names(pal_user))) {
      names(pal_user) <- trimws(as.character(names(pal_user)))
      vals <- pal_user[levels_cat]
      miss <- is.na(vals) | !nzchar(vals)
      if (any(miss)) {
        fallback <- setdiff(base_pal, vals[!miss])
        if (!length(fallback)) {
          fallback <- scales::hue_pal(h = c(200, 360), c = 70, l = 55)(sum(miss))
        } else if (length(fallback) < sum(miss)) {
          fallback <- c(
            fallback,
            scales::hue_pal(h = c(200, 360), c = 70, l = 55)(sum(miss) - length(fallback))
          )
        }
        vals[miss] <- fallback[seq_len(sum(miss))]
      }
      return(stats::setNames(vals, levels_cat))
    }

    if (length(pal_user) < length(levels_cat)) {
      extra <- scales::hue_pal(h = c(200, 360), c = 70, l = 55)(length(levels_cat) - length(pal_user))
      pal_user <- c(pal_user, extra)
    }
    stats::setNames(pal_user[seq_along(levels_cat)], levels_cat)
  }

  orientacion <- match.arg(orientacion)
  modo <- match.arg(modo)
  modo_semaforo <- .dim_normalize_semaforo_modo(modo_semaforo)
  semaforo_gradiente_segmentos <- .dim_normalize_gradiente_segmentos(
    semaforo_gradiente_segmentos,
    default = 20L
  )
  marker_style <- match.arg(marker_style)
  pos_delta <- match.arg(pos_delta)
  tipo_rango <- match.arg(tipo_rango)
  pos_titulo <- match.arg(pos_titulo)
  pos_nota_pie <- match.arg(pos_nota_pie)
  exportar <- match.arg(exportar)
  mostrar_ref_line <- isTRUE(mostrar_ref_line) || identical(modo, "score_ref")
  mostrar_ref_label <- isTRUE(mostrar_ref_label)
  mostrar_rango <- isTRUE(mostrar_rango)

  if (!requireNamespace("ggplot2", quietly = TRUE) ||
      !requireNamespace("dplyr", quietly = TRUE) ||
      !requireNamespace("scales", quietly = TRUE)) {
    stop("Se requieren 'ggplot2', 'dplyr' y 'scales'.", call. = FALSE)
  }
  if (isTRUE(usar_canvas) && !requireNamespace("cowplot", quietly = TRUE)) {
    stop("Para `usar_canvas=TRUE` se requiere 'cowplot'.", call. = FALSE)
  }

  if (!is.data.frame(data)) stop("`data` debe ser data.frame/tibble.", call. = FALSE)
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (!var_valor %in% names(data)) stop("`var_valor` no existe en `data`.", call. = FALSE)
  ref_label <- as.character(ref_label %||% "Promedio general")[1]
  if (is.na(ref_label)) ref_label <- "Promedio general"
  ref_label <- trimws(ref_label)
  if (!nzchar(ref_label)) {
    ref_label <- "Promedio general"
    mostrar_ref_label <- FALSE
  }

  if (!is.null(limites_y)) {
    if (!is.numeric(limites_y) || length(limites_y) != 2L) {
      stop("`limites_y` debe ser numeric(2) o NULL.", call. = FALSE)
    }
    limites_y <- sort(as.numeric(limites_y))
  }

  if (!is.null(cortes_y)) {
    if (!is.numeric(cortes_y)) stop("`cortes_y` debe ser numeric o NULL.", call. = FALSE)
    cortes_y <- unique(as.numeric(cortes_y))
    cortes_y <- cortes_y[is.finite(cortes_y)]
  }

  if (!is.null(cortes_chip)) {
    if (!is.numeric(cortes_chip)) stop("`cortes_chip` debe ser numeric o NULL.", call. = FALSE)
    cortes_chip <- sort(unique(as.numeric(cortes_chip)))
    cortes_chip <- cortes_chip[is.finite(cortes_chip)]
    if (length(cortes_chip) < 2L) {
      stop("`cortes_chip` debe contener al menos 2 valores finitos.", call. = FALSE)
    }
    cortes_chip <- cortes_chip[1:2]
  }

  escala_burbuja <- suppressWarnings(as.numeric(escala_burbuja)[1])
  if (!is.finite(escala_burbuja) || is.na(escala_burbuja) || escala_burbuja <= 0) {
    escala_burbuja <- 1
  }

  altura_bloque_ref_rel <- suppressWarnings(as.numeric(altura_bloque_ref_rel)[1])
  if (!is.finite(altura_bloque_ref_rel) || is.na(altura_bloque_ref_rel) ||
      altura_bloque_ref_rel <= 0) {
    altura_bloque_ref_rel <- 0.13
  }

  umbral_brecha <- suppressWarnings(as.numeric(umbral_brecha)[1])
  if (!is.finite(umbral_brecha) || is.na(umbral_brecha) || umbral_brecha < 0) {
    umbral_brecha <- 0
  }

  offset_delta <- suppressWarnings(as.numeric(offset_delta)[1])
  if (!is.finite(offset_delta) || is.na(offset_delta) || offset_delta < 0) {
    offset_delta <- 0.12
  }
  cortes_chip_eje <- cortes_chip

  chip_decimales <- suppressWarnings(as.integer(chip_decimales)[1])
  if (!is.finite(chip_decimales) || is.na(chip_decimales) || chip_decimales < 0L) {
    chip_decimales <- 1L
  }
  chip_sufijo <- as.character(chip_sufijo %||% "")[1]
  if (is.na(chip_sufijo)) chip_sufijo <- ""

  .resolve_chip_colores <- function(x) {
    out <- c(rojo = "#C62828", ambar = "#EF6C00", verde = "#2E7D32")
    if (is.null(x) || !length(x)) return(out)
    x <- as.character(x)
    if (!is.null(names(x)) && any(nzchar(names(x)))) {
      nms <- tolower(trimws(as.character(names(x))))
      map <- stats::setNames(x, nms)
      for (k in c("rojo", "ambar", "verde")) {
        if (!is.null(map[[k]]) && nzchar(map[[k]])) out[[k]] <- map[[k]]
      }
      return(out)
    }
    if (length(x) >= 3L) out[] <- x[1:3]
    out
  }

  probs_use <- switch(
    tipo_rango,
    iqr = c(0.25, 0.75),
    p10_p90 = c(0.10, 0.90),
    minmax = c(0, 1),
    custom = probs_rango %||% c(0.25, 0.75)
  )
  probs_use <- as.numeric(probs_use)
  probs_use <- probs_use[is.finite(probs_use)]
  if (length(probs_use) != 2L) {
    stop("`probs_rango` debe contener exactamente 2 valores finitos.", call. = FALSE)
  }
  probs_use <- sort(pmax(0, pmin(1, probs_use)))
  if (probs_use[1] > probs_use[2]) probs_use <- rev(probs_use)

  cat_is_factor <- is.factor(data[[var_categoria]])
  cat_levels_in <- if (cat_is_factor) levels(data[[var_categoria]]) else NULL

  df <- data |>
    dplyr::select(
      categoria = dplyr::all_of(var_categoria),
      valor = dplyr::all_of(var_valor)
    ) |>
    dplyr::mutate(
      categoria = as.character(.data$categoria),
      valor = suppressWarnings(as.numeric(.data$valor))
    ) |>
    dplyr::filter(
      !is.na(.data$categoria),
      nzchar(trimws(.data$categoria)),
      is.finite(.data$valor)
    )

  if (!nrow(df)) stop("No hay datos numericos validos para media-rango.", call. = FALSE)

  if (cat_is_factor && length(cat_levels_in)) {
    lvls <- cat_levels_in[cat_levels_in %in% df$categoria]
    if (!length(lvls)) lvls <- unique(df$categoria)
  } else {
    lvls <- unique(df$categoria)
  }
  if (isTRUE(invertir_barras)) lvls <- rev(lvls)
  df$categoria <- factor(df$categoria, levels = lvls)

  if (!is.null(ancho_max_eje_cat) &&
      is.finite(ancho_max_eje_cat) &&
      ancho_max_eje_cat > 1 &&
      requireNamespace("stringr", quietly = TRUE)) {
    lvls_lab <- as.character(levels(df$categoria))
    levels(df$categoria) <- stringr::str_wrap(lvls_lab, width = as.integer(ancho_max_eje_cat))
  }

  pal <- .mk_palette(levels(df$categoria), pal_user = colores_categorias)

  .resolve_ref_value <- function(ref, values) {
    if (is.numeric(ref) && length(ref) == 1L && is.finite(ref)) {
      return(as.numeric(ref))
    }
    ref_chr <- as.character(ref %||% "total_definicion")[1]
    if (!nzchar(trimws(ref_chr))) ref_chr <- "total_definicion"
    ref_chr <- trimws(ref_chr)
    switch(
      ref_chr,
      total_definicion = mean(values, na.rm = TRUE),
      meta_100 = 100,
      suppressWarnings(as.numeric(ref_chr))
    )
  }

  ref_value <- .resolve_ref_value(ref_score, df$valor)
  if (!is.finite(ref_value)) {
    stop("No se pudo resolver una referencia valida en `ref_score`.", call. = FALSE)
  }

  sum_df <- df |>
    dplyr::group_by(.data$categoria) |>
    dplyr::summarise(
      media_raw = mean(.data$valor, na.rm = TRUE),
      rango_inf_raw = if (identical(tipo_rango, "minmax")) min(.data$valor, na.rm = TRUE) else stats::quantile(.data$valor, probs = probs_use[1], na.rm = TRUE, names = FALSE, type = 7),
      rango_sup_raw = if (identical(tipo_rango, "minmax")) max(.data$valor, na.rm = TRUE) else stats::quantile(.data$valor, probs = probs_use[2], na.rm = TRUE, names = FALSE, type = 7),
      n = dplyr::n(),
      .groups = "drop"
    )

  if (identical(modo, "delta")) {
    sum_df <- sum_df |>
      dplyr::mutate(
        media = .data$media_raw - ref_value,
        rango_inf = .data$rango_inf_raw - ref_value,
        rango_sup = .data$rango_sup_raw - ref_value
      )
  } else {
    sum_df <- sum_df |>
      dplyr::mutate(
        media = .data$media_raw,
        rango_inf = .data$rango_inf_raw,
        rango_sup = .data$rango_sup_raw
      )
  }

  .fmt_num <- function(x) {
    format(round(x, chip_decimales), nsmall = chip_decimales, trim = TRUE)
  }
  .fmt_delta <- function(x) {
    x_round <- round(x, chip_decimales)
    x_abs <- format(abs(x_round), nsmall = chip_decimales, trim = TRUE)
    ifelse(
      abs(x_round) < 10^(-chip_decimales) / 2,
      paste0("0", chip_sufijo),
      paste0(ifelse(x_round > 0, "+", "-"), x_abs, chip_sufijo)
    )
  }

  sum_df <- sum_df |>
    dplyr::mutate(
      delta_ref = .data$media_raw - ref_value,
      marker_label = dplyr::case_when(
        identical(modo, "score_ref") ~ .fmt_num(.data$media_raw),
        identical(modo, "delta") ~ .fmt_delta(.data$media),
        TRUE ~ paste0(.fmt_num(.data$media_raw), chip_sufijo)
      ),
      marker_fill = if (identical(modo, "score")) NA_character_ else unname(pal[as.character(.data$categoria)]),
      marker_colour = unname(pal[as.character(.data$categoria)])
    )

  chip_cols <- .resolve_chip_colores(chip_colores)
  chip_cuts <- cortes_chip
  if (is.null(chip_cuts)) {
    q <- suppressWarnings(stats::quantile(sum_df$media_raw, probs = c(1/3, 2/3), na.rm = TRUE, names = FALSE))
    q <- as.numeric(q)
    if (length(q) >= 2L && all(is.finite(q)) && q[1] < q[2]) {
      chip_cuts <- q
    } else {
      rgv <- range(df$valor, na.rm = TRUE)
      span <- rgv[2] - rgv[1]
      if (!is.finite(span) || span <= 0) span <- 1
      chip_cuts <- c(rgv[1] + span/3, rgv[1] + 2 * span/3)
    }
  }

  sum_df$chip_fill <- .dim_semaforo_color(
    x = sum_df$media_raw,
    cortes = chip_cuts,
    colores = list(
      rojo = chip_cols[["rojo"]],
      ambar = chip_cols[["ambar"]],
      verde = chip_cols[["verde"]]
    ),
    digits = 0,
    na_color = NA_character_,
    modo = modo_semaforo,
    gradiente_colores = semaforo_gradiente_colores,
    gradiente_valores = semaforo_gradiente_valores,
    gradiente_limites = semaforo_gradiente_limites,
    gradiente_segmentos = semaforo_gradiente_segmentos
  )
  delta_abs_round <- abs(round(sum_df$delta_ref, chip_decimales))
  sum_df$delta_label_min <- ifelse(
    delta_abs_round < max(10^(-chip_decimales) / 2, umbral_brecha),
    NA_character_,
    .fmt_delta(sum_df$delta_ref)
  )
  use_ref_slot <- identical(modo, "score_ref") &&
    isTRUE(mostrar_ref_line) &&
    identical(orientacion, "vertical")
  ref_slot <- "..promedio_general_slot.."
  x_levels_plot <- levels(sum_df$categoria)
  if (isTRUE(use_ref_slot)) {
    x_levels_plot <- c(ref_slot, x_levels_plot)
  }

  p_core <- ggplot2::ggplot(
    sum_df,
    ggplot2::aes(x = .data$categoria, y = .data$media, colour = .data$categoria)
  )

  if (isTRUE(mostrar_rango)) {
    p_core <- p_core +
      ggplot2::geom_errorbar(
        ggplot2::aes(ymin = .data$rango_inf, ymax = .data$rango_sup),
        width = ancho_rango,
        linewidth = linewidth_rango,
        alpha = alpha_rango,
        show.legend = isTRUE(mostrar_leyenda)
      )
  }

  ref_value_plot <- if (identical(modo, "delta")) 0 else ref_value
  ylim_use <- limites_y %||% range(c(sum_df$media, ref_value_plot), na.rm = TRUE)
  span_use <- diff(range(ylim_use, na.rm = TRUE))
  if (!is.finite(span_use) || span_use <= 0) span_use <- 10

  .fit_fontsize_pt <- function(label, width_in, height_in,
                               max_pt = 18, min_pt = 7,
                               fontface = "plain",
                               fontfamily = "",
                               lineheight = 0.95) {
    if (!is.finite(width_in) || width_in <= 0 || !is.finite(height_in) || height_in <= 0) {
      return(min_pt)
    }
    sizes_try <- seq(max_pt, min_pt, by = -0.25)
    for (pt in sizes_try) {
      tg <- grid::textGrob(
        label,
        gp = grid::gpar(
          fontsize = pt,
          fontface = fontface,
          fontfamily = fontfamily,
          lineheight = lineheight
        )
      )
      tw <- suppressWarnings(grid::convertWidth(grid::grobWidth(tg), "in", valueOnly = TRUE))
      th <- suppressWarnings(grid::convertHeight(grid::grobHeight(tg), "in", valueOnly = TRUE))
      if (is.finite(tw) && is.finite(th) && tw <= width_in && th <= height_in) {
        return(pt)
      }
    }
    min_pt
  }

  .adaptive_marker_text_size <- function(labels, marker_sizes,
                                         style = c("burbuja", "rectangulo"),
                                         base_size = 2.3,
                                         min_size = 2.6,
                                         max_size = 5.5) {
    style <- match.arg(style)
    labels <- as.character(labels %||% "")
    marker_sizes <- as.numeric(marker_sizes %||% 0)
    marker_sizes[!is.finite(marker_sizes)] <- 0

    n_chars <- pmax(1, nchar(gsub("\\s+", "", labels)))
    if (identical(style, "burbuja")) {
      raw <- marker_sizes * 0.30 - pmax(0, n_chars - 2) * 0.28
      raw <- raw + base_size * 0.10
    } else {
      raw <- base_size * 1.22 - pmax(0, n_chars - 2) * 0.16
    }
    pmax(min_size, pmin(max_size, raw))
  }

  .build_ref_slot_grob <- function(box_w_in, box_h_in,
                                   top_label, chip_label,
                                   box_fill, box_border,
                                   top_colour, chip_fill,
                                   chip_text_colour,
                                   chip_max_pt_override = NULL) {
    if (!is.finite(box_w_in) || box_w_in <= 0) box_w_in <- 1
    if (!is.finite(box_h_in) || box_h_in <= 0) box_h_in <- 1

    has_top_label <- nzchar(trimws(as.character(top_label %||% "")[1]))
    label_w_in <- if (has_top_label) box_w_in * 0.80 else 0
    label_h_in <- if (has_top_label) box_h_in * 0.34 else 0
    chip_max_w_in <- if (has_top_label) box_w_in * 0.54 else box_w_in * 0.70
    chip_h_in <- if (has_top_label) box_h_in * 0.26 else box_h_in * 0.36

    top_pt <- if (has_top_label) .fit_fontsize_pt(
      top_label,
      width_in = label_w_in * 0.94,
      height_in = label_h_in * 0.92,
      max_pt = max(11, size_ejes * 2.0),
      min_pt = max(6, size_ejes * 0.75),
      fontface = "bold",
      fontfamily = "",
      lineheight = 0.88
    ) else 0

    chip_pt_max_calc <- max(10, size_media * if (has_top_label) 3.7 else 4.2)
    if (!is.null(chip_max_pt_override) && is.finite(chip_max_pt_override)) {
      chip_pt_max_calc <- min(chip_pt_max_calc, chip_max_pt_override)
    }
    chip_pt <- .fit_fontsize_pt(
      chip_label,
      width_in = chip_max_w_in * if (has_top_label) 0.52 else 0.66,
      height_in = chip_h_in * if (has_top_label) 0.48 else 0.62,
      max_pt = chip_pt_max_calc,
      min_pt = max(6, size_media * 2.0),
      fontface = "bold",
      fontfamily = "",
      lineheight = 0.95
    )

    chip_tg <- grid::textGrob(
      chip_label,
      gp = grid::gpar(fontsize = chip_pt, fontface = "bold", col = chip_text_colour)
    )
    chip_text_w_in <- suppressWarnings(grid::convertWidth(grid::grobWidth(chip_tg), "in", valueOnly = TRUE))
    chip_text_h_in <- suppressWarnings(grid::convertHeight(grid::grobHeight(chip_tg), "in", valueOnly = TRUE))
    if (!is.finite(chip_text_w_in) || chip_text_w_in <= 0) chip_text_w_in <- chip_max_w_in * 0.42
    if (!is.finite(chip_text_h_in) || chip_text_h_in <= 0) chip_text_h_in <- chip_h_in * 0.55

    chip_w_in <- min(chip_max_w_in, max(box_w_in * if (has_top_label) 0.30 else 0.36, chip_text_w_in + box_w_in * 0.08))
    chip_h_in <- min(box_h_in * if (has_top_label) 0.30 else 0.42, max(box_h_in * if (has_top_label) 0.20 else 0.26, chip_text_h_in + box_h_in * 0.06))

    chip_w_npc <- max(0.24, min(if (has_top_label) 0.62 else 0.78, chip_w_in / box_w_in))
    chip_h_npc <- max(0.18, min(if (has_top_label) 0.34 else 0.48, chip_h_in / box_h_in))
    chip_y <- if (has_top_label) 0.26 else 0.50

    grid::grobTree(
      grid::roundrectGrob(
        x = 0.5, y = 0.5,
        width = 1, height = 1,
        r = grid::unit(0.12, "snpc"),
        gp = grid::gpar(col = box_border, fill = box_fill, lwd = 2.1)
      ),
      if (has_top_label) grid::textGrob(
        top_label,
        x = 0.5, y = 0.73,
        just = c("center", "center"),
        gp = grid::gpar(
          col = top_colour,
          fontsize = top_pt,
          fontface = "bold",
          fontfamily = "",
          lineheight = 0.88
        )
      ),
      grid::roundrectGrob(
        x = 0.5, y = chip_y,
        width = chip_w_npc, height = chip_h_npc,
        r = grid::unit(0.22, "snpc"),
        gp = grid::gpar(col = box_border, fill = chip_fill, lwd = 1.4)
      ),
      grid::textGrob(
        chip_label,
        x = 0.5, y = chip_y,
        just = c("center", "center"),
        gp = grid::gpar(
          col = chip_text_colour,
          fontsize = chip_pt,
          fontface = "bold",
          fontfamily = ""
        )
      )
    )
  }

  if (isTRUE(mostrar_ref_line)) {
    ref_line_colour <- "#9AA6B8"
    ref_box_fill <- if (is.na(color_fondo)) "#F2F4F7" else color_fondo
    ref_text_colour <- "#637082"
    ref_chip_fill <- .dim_semaforo_color(
      x = ref_value,
      cortes = chip_cuts,
      colores = list(
        rojo = chip_cols[["rojo"]],
        ambar = chip_cols[["ambar"]],
        verde = chip_cols[["verde"]]
      ),
      digits = 0,
      na_color = NA_character_,
      modo = modo_semaforo,
      gradiente_colores = semaforo_gradiente_colores,
      gradiente_valores = semaforo_gradiente_valores,
      gradiente_limites = semaforo_gradiente_limites,
      gradiente_segmentos = semaforo_gradiente_segmentos
    )[1]

    if (isTRUE(use_ref_slot)) {
      ref_box_label <- if (isTRUE(mostrar_ref_label)) {
        if (requireNamespace("stringr", quietly = TRUE)) {
          stringr::str_wrap(ref_label, width = 13)
        } else {
          gsub("\\s+", "\n", ref_label)
        }
      } else {
        ""
      }
      ref_box_half_h <- span_use * altura_bloque_ref_rel / 2
      ref_box_xmin <- 0.68
      ref_box_xmax <- 1.32
      ref_box_ymin <- ref_value_plot - ref_box_half_h
      ref_box_ymax <- ref_value_plot + ref_box_half_h
      ref_line_left_df <- data.frame(
        x = 0.5,
        xend = ref_box_xmin,
        y = ref_value_plot,
        yend = ref_value_plot
      )
      ref_line_right_df <- data.frame(
        x = ref_box_xmax,
        xend = length(x_levels_plot) + 0.5,
        y = ref_value_plot,
        yend = ref_value_plot
      )
      .has_title <- (!is.null(titulo) && nzchar(trimws(as.character(titulo)[1]))) ||
        (!is.null(subtitulo) && nzchar(trimws(as.character(subtitulo)[1])))
      .has_caption <- !is.null(nota_pie) && nzchar(trimws(as.character(nota_pie)[1]))
      .has_legend <- isTRUE(mostrar_leyenda)
      panel_h_rel <- if (isTRUE(usar_canvas)) {
        h_title <- if (.has_title) canvas_h_title else 0
        h_caption <- if (.has_caption) canvas_h_caption else 0
        h_legend <- if (.has_legend) canvas_h_legend else 0
        h_pad <- max(0, canvas_pad_top)
        max(0.20, 1 - (h_title + h_legend + h_caption + h_pad))
      } else {
        1
      }
      panel_w_in <- ancho * 0.84
      panel_h_in <- alto * panel_h_rel * 0.74
      ref_box_w_in <- panel_w_in * ((ref_box_xmax - ref_box_xmin) / max(1, length(x_levels_plot)))
      ref_box_h_in <- panel_h_in * ((ref_box_ymax - ref_box_ymin) / max(diff(ylim_use), 1e-6))
      ref_slot_grob <- .build_ref_slot_grob(
        box_w_in = ref_box_w_in,
        box_h_in = ref_box_h_in,
        top_label = ref_box_label,
        chip_label = .fmt_num(ref_value),
        box_fill = ref_box_fill,
        box_border = ref_line_colour,
        top_colour = ref_text_colour,
        chip_fill = ref_chip_fill,
        chip_text_colour = chip_texto_color,
        chip_max_pt_override = size_chip_ref_max_pt
      )

      p_core <- p_core +
        ggplot2::geom_segment(
          data = ref_line_left_df,
          ggplot2::aes(
            x = .data$x,
            xend = .data$xend,
            y = .data$y,
            yend = .data$yend
          ),
          inherit.aes = FALSE,
          colour = ref_line_colour,
          linewidth = 0.95,
          linetype = "solid"
        ) +
        ggplot2::geom_segment(
          data = ref_line_right_df,
          ggplot2::aes(
            x = .data$x,
            xend = .data$xend,
            y = .data$y,
            yend = .data$yend
          ),
          inherit.aes = FALSE,
          colour = ref_line_colour,
          linewidth = 0.75,
          linetype = "solid"
        ) +
        ggplot2::annotation_custom(
          grob = ref_slot_grob,
          xmin = ref_box_xmin,
          xmax = ref_box_xmax,
          ymin = ref_box_ymin,
          ymax = ref_box_ymax
        )
    } else {
      p_core <- p_core +
        ggplot2::geom_hline(
          yintercept = ref_value_plot,
          colour = ref_line_colour,
          linewidth = 0.95,
          linetype = "solid"
        )
    }
  }

  if (isTRUE(mostrar_media) && identical(marker_style, "punto")) {
    p_core <- p_core +
      ggplot2::geom_point(
        size = size_punto_media,
        shape = shape_punto_media,
        stroke = stroke_punto_media,
        show.legend = FALSE
      )
  }

  if (isTRUE(mostrar_chip) && identical(modo, "score")) {
    sum_df$chip_label <- paste0(
      format(round(sum_df$media, chip_decimales), nsmall = chip_decimales, trim = TRUE),
      chip_sufijo
    )

    p_core <- p_core +
      ggplot2::geom_label(
        data = sum_df,
        ggplot2::aes(label = .data$chip_label),
        inherit.aes = TRUE,
        fill = sum_df$chip_fill,
        text.colour = chip_texto_color,
        border.colour = color_media,
        fontface = "bold",
        size = size_media,
        linewidth = 0.30,
        label.r = grid::unit(0.18, "lines"),
        label.padding = grid::unit(0.20, "lines"),
        alpha = 0.97,
        show.legend = FALSE
      )
  }

  if (isTRUE(mostrar_media) && identical(modo, "score_ref")) {
    sum_df$delta_mid <- ref_value_plot + (sum_df$media - ref_value_plot) * 0.38
    delta_offset_y <- max(0.9, span_use * 0.022)
    delta_small <- delta_abs_round > 0 & delta_abs_round <= 1
    sum_df$delta_y_plot <- ifelse(
      delta_small & sum_df$delta_ref > 0,
      sum_df$media + delta_offset_y * 0.80,
      ifelse(
        delta_small & sum_df$delta_ref < 0,
        sum_df$media - delta_offset_y * 0.80,
        ifelse(
          sum_df$delta_ref > 0 | sum_df$delta_ref < 0,
          sum_df$delta_mid,
          NA_real_
        )
      )
    )
    delta_nudge_x <- switch(
      pos_delta,
      derecha = offset_delta,
      izquierda = -offset_delta,
      0
    )
    delta_hjust <- switch(
      pos_delta,
      derecha = 0,
      izquierda = 1,
      0.5
    )
    bubble_point_size <- max(9, size_punto_media * 3.6 * escala_burbuja)
    bubble_text_size <- .adaptive_marker_text_size(
      labels = sum_df$marker_label,
      marker_sizes = rep(bubble_point_size, nrow(sum_df)),
      style = "burbuja",
      base_size = size_media,
      min_size = 3.2,
      max_size = max(5.2, size_media * 1.55)
    )
    delta_text_size <- max(3.5, size_media * 0.95)

    p_core <- p_core +
      ggplot2::geom_segment(
        data = sum_df,
        ggplot2::aes(
          x = .data$categoria,
          xend = .data$categoria,
          y = .data$media,
          yend = ref_value_plot
        ),
        inherit.aes = FALSE,
        linetype = "dashed",
        linewidth = 0.70,
        alpha = 0.85,
        show.legend = FALSE
      ) +
      ggplot2::geom_text(
        data = sum_df,
        ggplot2::aes(
          y = .data$delta_y_plot,
          label = .data$delta_label_min
        ),
        inherit.aes = TRUE,
        nudge_x = delta_nudge_x,
        hjust = delta_hjust,
        colour = "#000000",
        fontface = "bold",
        size = max(3.2, delta_text_size * 0.98),
        na.rm = TRUE,
        show.legend = FALSE
      )

    if (identical(marker_style, "burbuja")) {
      sum_df$marker_text_size <- bubble_text_size
      p_core <- p_core +
        ggplot2::geom_point(
          data = sum_df,
          shape = 21,
          size = bubble_point_size,
          stroke = 0.65,
          fill = sum_df$chip_fill,
          colour = "#000000",
          show.legend = FALSE
        ) +
        ggplot2::geom_text(
          data = sum_df,
          ggplot2::aes(label = .data$marker_label, size = .data$marker_text_size),
          colour = chip_texto_color,
          fontface = "bold",
          vjust = 0.60,
          show.legend = FALSE
        ) +
        ggplot2::scale_size_identity()
    }

    if (identical(marker_style, "rectangulo")) {
      rect_text_size <- .adaptive_marker_text_size(
        labels = sum_df$marker_label,
        marker_sizes = rep(size_media, nrow(sum_df)),
        style = "rectangulo",
        base_size = size_media,
        min_size = 2.8,
        max_size = max(3.2, size_media * 1.20)
      )
      sum_df$marker_text_size <- rect_text_size
      p_core <- p_core +
        ggplot2::geom_label(
          data = sum_df,
          ggplot2::aes(label = .data$marker_label, size = .data$marker_text_size),
          inherit.aes = TRUE,
          fill = sum_df$chip_fill,
          text.colour = chip_texto_color,
          border.colour = "#000000",
          fontface = "bold",
          linewidth = 0.30,
          label.r = grid::unit(0.02, "lines"),
          label.padding = grid::unit(0.20, "lines"),
          alpha = 0.97,
          show.legend = FALSE
        ) +
        ggplot2::scale_size_identity()
    }

    if (identical(marker_style, "punto_texto")) {
      p_core <- p_core +
        ggplot2::geom_point(
          data = sum_df,
          size = max(4.5, size_punto_media * 1.8),
          shape = 21,
          stroke = 0.45,
          fill = "#FFFFFF",
          colour = chip_texto_color,
          show.legend = FALSE
        ) +
        ggplot2::geom_text(
          data = sum_df,
          ggplot2::aes(label = .data$marker_label),
          nudge_y = 1.4,
          colour = "#000000",
          fontface = "bold",
          size = max(3.4, size_media),
          show.legend = FALSE
        )
    }
  }

  if (isTRUE(mostrar_media) && identical(modo, "delta")) {
    if (identical(marker_style, "punto_texto")) {
      p_core <- p_core +
        ggplot2::geom_point(
          size = size_punto_media,
          shape = shape_punto_media,
          stroke = stroke_punto_media,
          show.legend = FALSE
        ) +
        ggplot2::geom_text(
          ggplot2::aes(label = .data$marker_label),
          nudge_y = 1.2,
          colour = "#000000",
          fontface = "bold",
          size = max(2.7, size_media),
          lineheight = 0.90,
          show.legend = FALSE
        )
    }

    if (identical(marker_style, "burbuja") || identical(marker_style, "rectangulo")) {
      delta_marker_size <- .adaptive_marker_text_size(
        labels = sum_df$marker_label,
        marker_sizes = rep(size_media, nrow(sum_df)),
        style = if (identical(marker_style, "burbuja")) "burbuja" else "rectangulo",
        base_size = size_media,
        min_size = 2.6,
        max_size = max(2.6, size_media)
      )
      sum_df$marker_text_size <- delta_marker_size
      p_core <- p_core +
        ggplot2::geom_label(
          ggplot2::aes(label = .data$marker_label, fill = .data$categoria, size = .data$marker_text_size),
          inherit.aes = TRUE,
          text.colour = chip_texto_color,
          border.colour = color_media,
          fontface = "bold",
          linewidth = 0.30,
          label.r = grid::unit(if (identical(marker_style, "burbuja")) 0.35 else 0.01, "lines"),
          label.padding = grid::unit(if (identical(marker_style, "burbuja")) 0.24 else 0.18, "lines"),
          alpha = 0.97,
          lineheight = 0.90,
          show.legend = FALSE
        ) +
        ggplot2::scale_size_identity()
    }
  }

  if (isTRUE(mostrar_n_por_categoria)) {
    rg <- range(df$valor, na.rm = TRUE)
    span <- rg[2] - rg[1]
    if (!is.finite(span) || span <= 0) span <- max(abs(rg[2]), 1)
    n_df <- sum_df |>
      dplyr::mutate(
        y_n = pmax(.data$rango_sup, .data$media, na.rm = TRUE) + (span * 0.06),
        label_n = paste0(prefijo_n, .data$n)
      )

    p_core <- p_core +
      ggplot2::geom_text(
        data = n_df,
        ggplot2::aes(y = .data$y_n, label = .data$label_n),
        inherit.aes = TRUE,
        colour = color_n,
        size = size_n,
        show.legend = FALSE
      )
  }

  if (!is.null(cortes_chip_eje) && length(cortes_chip_eje) && identical(modo, "score")) {
    p_core <- p_core +
      ggplot2::geom_hline(
        data = data.frame(yint = as.numeric(cortes_chip_eje)),
        ggplot2::aes(yintercept = .data$yint),
        inherit.aes = FALSE,
        colour = "#C7CDD6",
        linetype = "dashed",
        linewidth = 0.36
      )
  }

  p_core <- p_core +
    ggplot2::scale_fill_manual(values = pal, drop = FALSE) +
    ggplot2::scale_colour_manual(values = pal, drop = FALSE) +
    ggplot2::scale_x_discrete(
      limits = x_levels_plot,
      labels = function(x) ifelse(x %in% ref_slot, "", x),
      drop = FALSE
    ) +
    ggplot2::theme_minimal(base_size = 10) +
    ggplot2::theme(
      axis.title = ggplot2::element_blank(),
      axis.text.x = ggplot2::element_text(colour = color_ejes, size = size_ejes),
      axis.text.y = ggplot2::element_text(colour = color_ejes, size = size_ejes),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_line(colour = "#D9E2EC", linewidth = 0.35),
      legend.title = ggplot2::element_blank(),
      legend.position = if (isTRUE(mostrar_leyenda)) "bottom" else "none",
      legend.text = ggplot2::element_text(colour = color_ejes, size = max(7, size_ejes - 1)),
      plot.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
      plot.margin = ggplot2::margin(8, 28, 6, 8)
    )

  axis_breaks <- NULL
  if (!is.null(cortes_y)) axis_breaks <- as.numeric(cortes_y)
  if (!is.null(cortes_chip_eje) && length(cortes_chip_eje) && identical(modo, "score")) {
    axis_breaks <- sort(unique(c(axis_breaks, as.numeric(cortes_chip_eje))))
  }
  if (!is.null(axis_breaks) && length(axis_breaks)) {
    p_core <- p_core + ggplot2::scale_y_continuous(breaks = axis_breaks)
  }

  if (identical(orientacion, "horizontal")) {
    if (!is.null(limites_y)) {
      p_core <- p_core + ggplot2::coord_flip(xlim = limites_y)
    } else {
      p_core <- p_core + ggplot2::coord_flip()
    }
  } else if (!is.null(limites_y)) {
    p_core <- p_core + ggplot2::coord_cartesian(ylim = limites_y, clip = "off")
  } else {
    p_core <- p_core + ggplot2::coord_cartesian(clip = "off")
  }

  p_out <- p_core

  if (isTRUE(usar_canvas)) {
    .has_title <- (!is.null(titulo) && nzchar(trimws(as.character(titulo)[1]))) ||
      (!is.null(subtitulo) && nzchar(trimws(as.character(subtitulo)[1])))
    .has_caption <- !is.null(nota_pie) && nzchar(trimws(as.character(nota_pie)[1]))
    .has_legend <- isTRUE(mostrar_leyenda)

    h_title <- if (.has_title) canvas_h_title else 0
    h_caption <- if (.has_caption) canvas_h_caption else 0
    h_legend <- if (.has_legend) canvas_h_legend else 0
    h_pad <- max(0, canvas_pad_top)
    h_panel <- max(0.20, 1 - (h_title + h_legend + h_caption + h_pad))

    pieces <- list()
    relh <- numeric(0)

    if (h_pad > 0) {
      pieces[[length(pieces) + 1]] <- cowplot::ggdraw()
      relh <- c(relh, h_pad)
    }

    if (.has_title) {
      pieces[[length(pieces) + 1]] <- .mk_text_panel(
        top = titulo, bottom = subtitulo, pos = pos_titulo,
        col_top = color_titulo, col_bottom = color_subtitulo,
        size_top = size_titulo, size_bottom = size_subtitulo
      )
      relh <- c(relh, h_title)
    }

    if (.has_legend) {
      leg <- cowplot::get_legend(
        p_core +
          ggplot2::theme(
            legend.position = "bottom",
            legend.margin = ggplot2::margin(0, 0, 0, 0),
            legend.box.margin = ggplot2::margin(0, 0, 0, 0)
          )
      )
      p_panel <- p_core + ggplot2::theme(legend.position = "none")
      pieces[[length(pieces) + 1]] <- p_panel
      relh <- c(relh, h_panel)
      pieces[[length(pieces) + 1]] <- cowplot::ggdraw(leg)
      relh <- c(relh, h_legend)
    } else {
      pieces[[length(pieces) + 1]] <- p_core
      relh <- c(relh, h_panel)
    }

    if (.has_caption) {
      pieces[[length(pieces) + 1]] <- .mk_text_panel(
        top = nota_pie, bottom = NULL, pos = pos_nota_pie,
        col_top = color_nota_pie, col_bottom = color_nota_pie,
        size_top = size_nota_pie, size_bottom = size_nota_pie
      )
      relh <- c(relh, h_caption)
    }

    p_out <- cowplot::plot_grid(plotlist = pieces, ncol = 1, rel_heights = relh, align = "v")
  }

  if (isTRUE(debug_ph_bordes)) {
    p_out <- p_out +
      ggplot2::theme(
        plot.background = ggplot2::element_rect(
          fill = NA, colour = debug_ph_col, linewidth = debug_ph_lwd
        )
      )
  }

  if (identical(exportar, "rplot")) return(p_out)

  if (is.null(path_salida) || !nzchar(path_salida)) {
    path_salida <- switch(
      exportar,
      png = "media_rango.png",
      ppt = "media_rango.pptx",
      word = "media_rango.docx",
      "media_rango_output"
    )
  }

  if (identical(exportar, "png")) {
    ggplot2::ggsave(
      filename = path_salida,
      plot = p_out,
      width = ancho,
      height = alto,
      dpi = dpi,
      bg = if (is.na(color_fondo)) "white" else color_fondo
    )
    return(invisible(p_out))
  }

  if (!requireNamespace("officer", quietly = TRUE)) {
    stop("Para exportar a PPT/Word se requiere 'officer'.", call. = FALSE)
  }

  if (identical(exportar, "ppt")) {
    if (!requireNamespace("rvg", quietly = TRUE)) {
      stop("Para exportar a PPT se requiere 'rvg'.", call. = FALSE)
    }
    doc <- if (isTRUE(ppt_append) && file.exists(path_salida)) {
      officer::read_pptx(path_salida)
    } else {
      officer::read_pptx()
    }
    doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
    doc <- officer::ph_with(
      doc,
      value = rvg::dml(ggobj = p_out, bg = "transparent"),
      location = officer::ph_location_fullsize()
    )
    print(doc, target = path_salida)
    return(invisible(p_out))
  }

  doc <- if (file.exists(path_salida)) officer::read_docx(path = path_salida) else officer::read_docx()
  doc <- officer::body_add_gg(doc, value = p_out, width = ancho, height = alto, style = "Normal")
  print(doc, target = path_salida)
  invisible(p_out)
}
