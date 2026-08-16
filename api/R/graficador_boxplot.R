#' Graficar boxplots profesionales por categoria
#'
#' Construye un grafico de distribucion tipo boxplot para una variable numerica
#' segmentada por categoria.
#'
#' Incluye soporte para:
#' - puntos jitter opcionales,
#' - chip semaforico para la media por categoria,
#' - etiquetas de base por categoria,
#' - composicion en canvas (titulo/panel/leyenda/pie),
#' - exportacion a PNG/PPT/Word.
#'
#' @param data `data.frame` o `tibble` con las columnas de categoria y valor.
#' @param var_categoria Nombre (string) de la columna categorica.
#' @param var_valor Nombre (string) de la columna numerica.
#' @param orientacion `"vertical"` o `"horizontal"`.
#' @param colores_categorias Vector de colores por categoria (opcional).
#' @param mostrar_puntos Si `TRUE`, superpone puntos jitter.
#' @param alpha_puntos,size_puntos,jitter_width,jitter_height Estilo de puntos.
#' @param mostrar_media Si `TRUE`, dibuja la media como chip.
#' @param color_media,size_media Compatibilidad legacy: color de borde y tamaño
#'   del texto del chip de media.
#' @param cortes_chip Cortes del semaforo para clasificar la media en tres
#'   estados (`rojo`, `ambar`, `verde`). Debe contener al menos 2 valores.
#'   Si es `NULL` y `modo_semaforo = "grupos"` (default), el chip queda
#'   NEUTRAL (blanco con texto navy): el semaforo solo actua cuando el
#'   analista declara cortes o pide un modo degradado.
#'   Cuando se define explicitamente, se agregan lineas punteadas en esos cortes
#'   y se fuerzan como marcas del eje numerico.
#' @param modo_semaforo Modo del semaforo para el chip: `"grupos"` mantiene la
#'   clasificacion discreta actual y `"degradado"` interpola colores alrededor
#'   de los cortes de referencia.
#' @param chip_colores Colores del semaforo para el chip de media. Puede ser un
#'   vector nombrado con `rojo`, `ambar`, `verde`, o un vector de largo 3 en ese orden.
#' @param chip_texto_color Color del texto dentro del chip.
#' @param chip_decimales Decimales del valor mostrado en el chip.
#' @param chip_sufijo Sufijo opcional del valor mostrado en el chip.
#' @param mostrar_n_por_categoria Si `TRUE`, imprime base por categoria.
#' @param prefijo_n,size_n,color_n Estilo de texto de base.
#' @param titulo,subtitulo,nota_pie Textos del grafico.
#' @param pos_titulo,pos_nota_pie Alineacion horizontal de titulo y pie.
#' @param color_titulo,size_titulo,color_subtitulo,size_subtitulo
#'   Estilo de encabezado.
#' @param color_nota_pie,size_nota_pie Estilo de pie.
#' @param color_ejes,size_ejes Estilo de ejes.
#' @param limites_y Vector numérico de largo 2 para fijar límites del eje de valores.
#' @param cortes_y Vector numérico opcional con cortes del eje de valores.
#' @param color_fondo Color de fondo.
#' @param ancho_caja,tamano_linea_caja Estilo de cajas.
#' @param mostrar_leyenda Si `TRUE`, muestra leyenda por categoria.
#' @param invertir_barras Si `TRUE`, invierte orden de categorias.
#' @param ancho_max_eje_cat Ancho de wrap para etiquetas de categoria.
#'
#' @param usar_canvas Si `TRUE`, compone titulo/panel/leyenda/pie con `cowplot`.
#' @param canvas_h_title,canvas_h_legend,canvas_h_caption,canvas_pad_top
#'   Proporciones relativas del canvas.
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja borde de depuracion.
#' @param debug_ph_col,debug_ph_lwd Color y grosor del borde de depuracion.
#'
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
graficar_boxplot <- function(
    data,
    var_categoria,
    var_valor,
    orientacion       = c("vertical", "horizontal"),
    colores_categorias = NULL,
    mostrar_puntos    = TRUE,
    mostrar_outliers  = FALSE,
    textos_negrita    = NULL,
    alpha_puntos      = 0.45,
    size_puntos       = 1.35,
    jitter_width      = 0.15,
    jitter_height     = 0,
    mostrar_media     = TRUE,
    color_media       = "#173B63",
    size_media        = 3.2,
    cortes_chip       = NULL,
    modo_semaforo     = c("grupos", "degradado"),
    chip_colores      = c(rojo = "#C62828", ambar = "#EF6C00", verde = "#2E7D32"),
    chip_texto_color  = "#081F5C",
    chip_decimales    = 1,
    chip_sufijo       = "",
    mostrar_n_por_categoria = FALSE,
    prefijo_n         = "N=",
    size_n            = 2.8,
    color_n           = "#081F5C",
    titulo            = NULL,
    subtitulo         = NULL,
    nota_pie          = NULL,
    pos_titulo        = c("izquierda", "centro", "derecha"),
    pos_nota_pie      = c("derecha", "izquierda", "centro"),
    color_titulo      = "#081F5C",
    size_titulo       = 11,
    color_subtitulo   = "#081F5C",
    size_subtitulo    = 9,
    color_nota_pie    = "#081F5C",
    size_nota_pie     = 8,
    color_ejes        = "#081F5C",
    size_ejes         = 9,
    limites_y         = NULL,
    cortes_y          = NULL,
    color_fondo       = NA,
    ancho_caja        = 0.62,
    tamano_linea_caja = 0.45,
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

  # `face_top`/`face_bottom`: el título salía en negrita FIJA y el subtítulo en
  # plana fija, mientras la UI ofrecía los dos interruptores. Cada parte
  # responde a la suya o el multiflag miente sobre lo que hace.
  .mk_text_panel <- function(top = NULL, bottom = NULL, pos = "izquierda",
                             col_top = "#000000", col_bottom = "#000000",
                             size_top = 11, size_bottom = 9,
                             face_top = "bold", face_bottom = "plain") {
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
        fontface = face_top, colour = col_top, size = size_top
      )
    }
    if (!is.null(bottom) && nzchar(trimws(as.character(bottom)[1]))) {
      p <- p + cowplot::draw_label(
        label = as.character(bottom)[1],
        x = x, y = 0.26, hjust = h, vjust = 0.5,
        fontface = face_bottom, colour = col_bottom, size = size_bottom
      )
    }
    p
  }

  # Saneo/relleno del override de colores centralizado en el helper compartido
  # `.graficos_mk_palette` (api/R/graficador_paleta.R). Alias local para
  # preservar los call-sites de este graficador.
  .mk_palette <- .graficos_mk_palette

  orientacion <- match.arg(orientacion)
  modo_semaforo <- .dim_normalize_semaforo_modo(modo_semaforo)
  # Este graficador no expone args de gradiente manual: ese modo no puede
  # clasificar nada y antes mataba la lamina. Se degrada con aviso.
  if (identical(modo_semaforo, "degradado_manual")) {
    # El analista eligio un modo y le sale otro: si no se lo decimos, lee el
    # resultado como si fuera lo que pidio. Vara V4.
    msg <- "Semaforo 'degradado_manual' no esta soportado en boxplot: se usa 'degradado_automatico'."
    warning(msg, call. = FALSE)
    .pulso_aviso(msg)
    modo_semaforo <- "degradado_automatico"
  }
  pos_titulo  <- match.arg(pos_titulo)
  pos_nota_pie <- match.arg(pos_nota_pie)
  exportar <- match.arg(exportar)

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
  if (!is.null(limites_y)) {
    if (!is.numeric(limites_y) || length(limites_y) != 2L) {
      stop("`limites_y` debe ser numeric(2) o NULL.", call. = FALSE)
    }
    limites_y <- as.numeric(limites_y)
    if (!all(is.finite(limites_y))) {
      stop("`limites_y` debe contener dos valores finitos.", call. = FALSE)
    }
    limites_y <- sort(limites_y)
    if (limites_y[1] >= limites_y[2]) {
      stop("`limites_y` debe tener mínimo < máximo.", call. = FALSE)
    }
  }
  if (!is.null(cortes_y)) {
    if (!is.numeric(cortes_y)) stop("`cortes_y` debe ser numeric o NULL.", call. = FALSE)
    cortes_y <- as.numeric(cortes_y)
    cortes_y <- cortes_y[is.finite(cortes_y)]
    if (!length(cortes_y)) stop("`cortes_y` no contiene valores numericos validos.", call. = FALSE)
    cortes_y <- unique(cortes_y)
  }
  if (!is.null(cortes_chip)) {
    if (!is.numeric(cortes_chip)) stop("`cortes_chip` debe ser numeric o NULL.", call. = FALSE)
    cortes_chip <- as.numeric(cortes_chip)
    cortes_chip <- cortes_chip[is.finite(cortes_chip)]
    if (length(cortes_chip) < 2L) {
      stop("`cortes_chip` debe contener al menos 2 valores finitos.", call. = FALSE)
    }
    cortes_chip <- sort(unique(cortes_chip))[1:2]
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
    if (length(x) >= 3L) {
      out[] <- x[1:3]
    }
    out
  }

  # Mismo patron que media_rango: un factor entrante trae el orden del
  # instrumento (el glue del plan lo arma desde las choices) y se respeta;
  # unique() solo como fallback para datos sin orden declarado.
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

  if (!nrow(df)) stop("No hay datos numericos validos para boxplot.", call. = FALSE)

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

  p_core <- ggplot2::ggplot(
    df,
    ggplot2::aes(x = .data$categoria, y = .data$valor, fill = .data$categoria)
  ) +
    ggplot2::geom_boxplot(
      # El outlier es el rasgo distintivo del box plot y la UI ofrecia el knob
      # desde siempre, pero aqui estaba clavado en NA: la opcion no hacia nada.
      # Sigue apagado por defecto —con `mostrar_puntos` encendido, que es el
      # default, cada punto ya se dibuja y el outlier saldria DOS veces— y ahora
      # se puede encender.
      outlier.shape = if (isTRUE(mostrar_outliers)) 19 else NA,
      outlier.size = size_puntos,
      outlier.colour = "#1A3552",
      width = ancho_caja,
      alpha = 0.88,
      colour = "#1A3552",
      linewidth = tamano_linea_caja,
      show.legend = isTRUE(mostrar_leyenda)
    )

  if (isTRUE(mostrar_puntos)) {
    p_core <- p_core +
      ggplot2::geom_jitter(
        ggplot2::aes(colour = .data$categoria),
        width = jitter_width,
        height = jitter_height,
        alpha = alpha_puntos,
        size = size_puntos,
        stroke = 0,
        show.legend = FALSE
      )
  }

  if (isTRUE(mostrar_media)) {
    chip_cols <- .resolve_chip_colores(chip_colores)
    mean_df <- df |>
      dplyr::group_by(.data$categoria) |>
      dplyr::summarise(media = mean(.data$valor, na.rm = TRUE), .groups = "drop")

    # El semaforo solo actua cuando el analista lo pide (cortes declarados o
    # modo degradado). Sin eso, los terciles automaticos de las medias pintaban
    # SIEMPRE un grupo en rojo aunque todos promediaran alto: color relativo
    # con semantica absoluta. El default honesto es un chip neutral.
    semaforo_activo <- !is.null(cortes_chip) || !identical(modo_semaforo, "grupos")

    chip_cuts <- cortes_chip
    if (is.null(chip_cuts)) {
      q <- suppressWarnings(stats::quantile(mean_df$media, probs = c(1/3, 2/3), na.rm = TRUE, names = FALSE))
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

    mean_df$chip_fill <- if (isTRUE(semaforo_activo)) {
      .dim_semaforo_color(
        x = mean_df$media,
        cortes = chip_cuts,
        colores = list(
          rojo = chip_cols[["rojo"]],
          ambar = chip_cols[["ambar"]],
          verde = chip_cols[["verde"]]
        ),
        digits = 0,
        na_color = NA_character_,
        modo = modo_semaforo
      )
    } else {
      "#FFFFFF"
    }
    chip_texto_eff <- if (isTRUE(semaforo_activo)) chip_texto_color else color_media
    # Redondeo de la casa: el 0,5 sube (`helpers_calc_comunes.R`).
    mean_df$chip_label <- paste0(
      .pulso_fmt_half_up(mean_df$media, chip_decimales),
      chip_sufijo
    )

    p_core <- p_core +
      ggplot2::geom_label(
        data = mean_df,
        ggplot2::aes(x = .data$categoria, y = .data$media, label = .data$chip_label),
        inherit.aes = FALSE,
        fill = mean_df$chip_fill,
        text.colour = chip_texto_eff,
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

  if (isTRUE(mostrar_n_por_categoria)) {
    rg <- range(df$valor, na.rm = TRUE)
    span <- rg[2] - rg[1]
    if (!is.finite(span) || span <= 0) span <- max(abs(rg[2]), 1)
    n_df <- df |>
      dplyr::group_by(.data$categoria) |>
      dplyr::summarise(
        n = dplyr::n(),
        y_n = max(.data$valor, na.rm = TRUE) + (span * 0.06),
        .groups = "drop"
      ) |>
      dplyr::mutate(label_n = paste0(prefijo_n, .data$n))

    p_core <- p_core +
      ggplot2::geom_text(
        data = n_df,
        ggplot2::aes(x = .data$categoria, y = .data$y_n, label = .data$label_n),
        inherit.aes = FALSE,
        colour = color_n,
        size = size_n
      )
  }

  if (!is.null(cortes_chip_eje) && length(cortes_chip_eje)) {
    p_core <- p_core +
      ggplot2::geom_hline(
        data = data.frame(yint = as.numeric(cortes_chip_eje)),
        ggplot2::aes(yintercept = .data$yint),
        inherit.aes = FALSE,
        colour = "#8A97A8",
        linetype = "dashed",
        linewidth = 0.5
      )
  }

  # La UI ofrecia `textos_negrita` para este graficador desde siempre y el motor
  # lo descartaba: el knob no hacia nada.
  face <- .graficos_face_de(textos_negrita)

  p_core <- p_core +
    ggplot2::scale_fill_manual(values = pal, drop = FALSE) +
    ggplot2::theme_minimal(base_size = 10) +
    ggplot2::theme(
      axis.title = ggplot2::element_blank(),
      axis.text.x = ggplot2::element_text(colour = color_ejes, size = size_ejes,
                                          face = face("ejes", "eje_x")),
      axis.text.y = ggplot2::element_text(colour = color_ejes, size = size_ejes,
                                          face = face("ejes", "eje_y")),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_line(colour = "#D9E2EC", linewidth = 0.35),
      legend.title = ggplot2::element_blank(),
      legend.position = if (isTRUE(mostrar_leyenda)) "bottom" else "none",
      legend.text = ggplot2::element_text(colour = color_ejes, size = max(7, size_ejes - 1),
                                          face = face("leyenda")),
      plot.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, colour = NA),
      plot.margin = ggplot2::margin(2, 6, 2, 4)
    )

  if (isTRUE(mostrar_puntos)) {
    # Los puntos con el MISMO color de su caja desaparecen sobre ella y se
    # lavan fuera: una version oscurecida los mantiene visibles sin gritar.
    pal_puntos <- vapply(pal, function(col) {
      m <- tryCatch(grDevices::col2rgb(col) * 0.55, error = function(e) NULL)
      if (is.null(m)) return(as.character(col))
      grDevices::rgb(m[1], m[2], m[3], maxColorValue = 255)
    }, character(1))
    names(pal_puntos) <- names(pal)
    p_core <- p_core + ggplot2::scale_colour_manual(values = pal_puntos, drop = FALSE)
  }

  axis_breaks <- NULL
  if (!is.null(cortes_y)) axis_breaks <- as.numeric(cortes_y)
  if (!is.null(cortes_chip_eje) && length(cortes_chip_eje)) {
    axis_breaks <- sort(unique(c(axis_breaks, as.numeric(cortes_chip_eje))))
  }
  if (!is.null(axis_breaks) && length(axis_breaks)) {
    p_core <- p_core + ggplot2::scale_y_continuous(breaks = axis_breaks)
  }

  if (identical(orientacion, "horizontal")) {
    if (!is.null(limites_y)) {
      # Con coord_flip, el eje numerico original (y) pasa a ser x.
      p_core <- p_core + ggplot2::coord_flip(xlim = limites_y)
    } else {
      p_core <- p_core + ggplot2::coord_flip()
    }
  } else if (!is.null(limites_y)) {
    # Zoom del eje sin recortar datos para el calculo estadistico del boxplot.
    p_core <- p_core + ggplot2::coord_cartesian(ylim = limites_y)
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
        size_top = size_titulo, size_bottom = size_subtitulo,
        face_top = .graficos_face_legado(textos_negrita, "titulo"),
        face_bottom = .graficos_face_legado(textos_negrita, "subtitulo", "plain")
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
        size_top = size_nota_pie, size_bottom = size_nota_pie,
        face_top = .graficos_face_legado(textos_negrita, "nota_pie", "plain")
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
      png = "boxplot.png",
      ppt = "boxplot.pptx",
      word = "boxplot.docx",
      "boxplot_output"
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
