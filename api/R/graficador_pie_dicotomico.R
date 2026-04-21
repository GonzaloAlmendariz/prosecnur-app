# =============================================================================
# graficar_pie_canvas() — API ESTANDARIZADA + PANEL FULL (sin márgenes)
# -----------------------------------------------------------------------------
# - Pie / donut (proporciones 0–1; si viene 0–100, normaliza)
# - Etiquetas % (argumentos estandarizados)
# - DONUT: etiquetas % DENTRO del aro (en el segmento), NO en el hueco
# - Panel: usa el 100% del placeholder (sin márgenes / sin “anillo blanco” extra)
# - Leyenda: control REAL del espaciado vertical SIN deformar el key
#   * tamano_key_cm         -> key cuadrado (ancho = alto)
#   * espaciado_vertical_cm -> separación vertical (legend.key.spacing.y)
# =============================================================================

#' Graficar pie/donut con canvas y exportación
#'
#' Construye gráficos circulares tipo `pie` o `donut` a partir de una tabla con
#' categorías y proporciones. Si los valores vienen en escala 0-100, se
#' normalizan automáticamente a 0-1.
#'
#' El flujo incluye:
#' \itemize{
#'   \item ordenamiento y recorte opcional por `top_k` (con categoría `"Otros"`),
#'   \item etiquetas de porcentaje internas con umbral de visibilidad,
#'   \item leyenda configurable y composición opcional por canvas (`cowplot`),
#'   \item exportación directa a `png`, `ppt` o `word`.
#' }
#'
#' @param data `data.frame` o `tibble` con columnas de categoría y porcentaje.
#' @param var_categoria Nombre de columna con categorías.
#' @param var_pct Nombre de columna con proporciones/porcentajes.
#'
#' @param tipo_pie Tipo de gráfico: `"donut"` o `"pie"`.
#' @param donut_hole Tamaño del hueco del donut (0-1, clamp interno).
#' @param donut_radio_etiqueta_out,donut_label_nudge_out Parámetros legacy de
#'   compatibilidad para etiquetas externas en donut (se conservan por API).
#'
#' @param mostrar_etiquetas_pct Si `TRUE`, muestra etiquetas de porcentaje.
#' @param size_etiquetas_pct,color_etiquetas_pct Estilo de etiquetas de porcentaje.
#' @param etiquetas_negrita Si `TRUE`, aplica negrita a etiquetas de porcentaje.
#' @param decimales_pct Decimales para el texto porcentual.
#' @param umbral_etiqueta_pct Umbral mínimo (0-1) para mostrar etiqueta.
#' @param pie_radio_etiqueta Posición radial relativa de etiquetas internas.
#' @param nudge_radial_etiqueta Ajuste radial adicional (positivo hacia afuera).
#'
#' @param ordenar_categorias Orden del gráfico: `"desc"`, `"asc"` o `"ninguno"`.
#' @param top_k Número de categorías top a conservar antes de agrupar.
#' @param etiqueta_otros Etiqueta usada para agregación de categorías restantes.
#'
#' @param colores_categorias Vector de colores opcional por categoría.
#'
#' @param titulo,subtitulo,nota_pie Textos del gráfico.
#' @param pos_titulo,pos_subtitulo,pos_nota_pie Alineación horizontal de textos.
#' @param y_titulo,y_subtitulo Posición vertical relativa dentro del bloque de título.
#' @param textos_negrita Tokens para forzar negrita por componente.
#' @param color_titulo,size_titulo,color_subtitulo,size_subtitulo
#'   Estilos de título/subtítulo.
#' @param color_nota_pie,size_nota_pie Estilos de pie.
#'
#' @param color_leyenda,size_leyenda Estilos de texto de leyenda.
#' @param tamano_key_cm Tamaño de key de leyenda (cm).
#' @param espaciado_vertical_cm Espaciado vertical entre ítems de leyenda (cm).
#' @param mostrar_leyenda Si `TRUE`, muestra leyenda.
#' @param leyenda_posicion Posición de leyenda: `"derecha"` o `"abajo"`.
#' @param invertir_leyenda Si `TRUE`, invierte orden de la leyenda.
#' @param ncol_leyenda_bajo Número de columnas cuando leyenda está abajo.
#'
#' @param usar_canvas Si `TRUE`, compone título/panel/leyenda/pie con `cowplot`.
#' @param canvas_h_title,canvas_h_caption Alturas relativas de título y pie.
#' @param canvas_w_legend_right Ancho relativo de leyenda cuando está a la derecha.
#' @param canvas_h_legend_bottom Altura relativa de leyenda cuando está abajo.
#' @param canvas_pad_top Padding superior del canvas.
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de depuración.
#' @param debug_ph_col,debug_ph_lwd Color y grosor de bordes de depuración.
#'
#' @param exportar Tipo de salida: `"rplot"`, `"png"`, `"ppt"` o `"word"`.
#' @param path_salida Ruta de salida cuando `exportar != "rplot"`.
#' @param ancho,alto,dpi Dimensiones y resolución de exportación.
#' @param color_fondo Color de fondo.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto gráfico (`ggplot` o
#'   canvas `cowplot`). En otros modos, exporta a archivo y retorna
#'   invisiblemente.
#'
#' @examples
#' \dontrun{
#' graficar_pie(
#'   data = df_pie,
#'   var_categoria = "opcion",
#'   var_pct = "pct",
#'   tipo_pie = "donut",
#'   titulo = "Distribución",
#'   mostrar_etiquetas_pct = TRUE
#' )
#' }
#'
#' @family graficador
#' @export
graficar_pie <- function(
    data,
    var_categoria,
    var_pct,

    # Pie / donut
    tipo_pie                 = c("donut", "pie"),
    donut_hole               = 0.55,

    # (compatibilidad; NO se usan cuando etiquetas van dentro)
    donut_radio_etiqueta_out = 1.12,
    donut_label_nudge_out    = 0.03,

    # ==========================
    # ETIQUETAS (%)
    # ==========================
    mostrar_etiquetas_pct = TRUE,
    size_etiquetas_pct    = 3.2,
    color_etiquetas_pct   = "#FFFFFF",
    etiquetas_negrita     = FALSE,
    decimales_pct         = 0,
    umbral_etiqueta_pct   = 0.06,

    # Radio relativo del texto dentro del grosor disponible (0–1):
    # - PIE: entre centro y borde
    # - DONUT: entre r_in y r_out (dentro del aro)
    pie_radio_etiqueta    = 0.55,

    # (opcional) “empuje” adicional para acercar el texto al borde
    # (positivo: hacia afuera, negativo: hacia adentro)
    nudge_radial_etiqueta = 0,

    # Orden / top-k
    ordenar_categorias = c("desc", "asc", "ninguno"),
    top_k              = NULL,
    etiqueta_otros     = "Otros",

    # Colores
    colores_categorias = NULL,

    # Textos
    titulo    = NULL,
    subtitulo = NULL,
    nota_pie  = NULL,

    # Posición H
    pos_titulo    = c("izquierda", "centro", "derecha"),
    pos_subtitulo = c("izquierda", "centro", "derecha"),
    pos_nota_pie  = c("izquierda", "centro", "derecha"),

    # Posición Y dentro del placeholder de título
    y_titulo    = 0.62,
    y_subtitulo = 0.30,

    textos_negrita = NULL,

    # Estilo texto
    color_titulo    = "#000000",
    size_titulo     = 11,
    color_subtitulo = "#000000",
    size_subtitulo  = 9,
    color_nota_pie  = "#000000",
    size_nota_pie   = 8,

    # ==========================
    # LEYENDA (PARCHE MINIMAL)
    # ==========================
    color_leyenda         = "#000000",
    size_leyenda          = 8,
    tamano_key_cm         = 0.40,
    espaciado_vertical_cm = 0.16,

    # Leyenda
    mostrar_leyenda    = TRUE,
    leyenda_posicion   = c("derecha", "abajo"),
    invertir_leyenda   = FALSE,
    ncol_leyenda_bajo  = 2,

    # ==========================
    # CANVAS
    # ==========================
    usar_canvas            = TRUE,
    canvas_h_title         = 0.16,
    canvas_h_caption       = 0.06,
    canvas_w_legend_right  = 0.30,
    canvas_h_legend_bottom = 0.14,
    canvas_pad_top         = 0.01,

    # Debug
    debug_ph_bordes = FALSE,
    debug_ph_col     = "#8A2BE2",
    debug_ph_lwd        = 2.8,

    # Exportación
    exportar    = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho       = 10,
    alto        = 6,
    dpi         = 300,
    color_fondo = NA
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y

  tipo_pie           <- match.arg(tipo_pie)
  ordenar_categorias <- match.arg(ordenar_categorias)
  pos_titulo         <- match.arg(pos_titulo)
  pos_subtitulo      <- match.arg(pos_subtitulo)
  pos_nota_pie       <- match.arg(pos_nota_pie)
  leyenda_posicion   <- match.arg(leyenda_posicion)
  exportar           <- match.arg(exportar)

  textos_negrita <- textos_negrita %||% character(0)
  # Aliases para mantener compat con planes/QMDs que usen tokens
  # legacy. La UI (tipo_input = "multiflag") expone el token nuevo —
  # acá lo traducimos al que espera el código a lo largo de la función.
  #   nota_pie → caption (este graficador usa "caption" internamente)
  if ("nota_pie" %in% textos_negrita && !("caption" %in% textos_negrita)) {
    textos_negrita <- c(textos_negrita, "caption")
  }

  if (!requireNamespace("ggplot2", quietly = TRUE) ||
      !requireNamespace("dplyr", quietly = TRUE)) {
    stop("Se requieren 'ggplot2' y 'dplyr'.", call. = FALSE)
  }
  if (isTRUE(usar_canvas)) {
    if (!requireNamespace("cowplot", quietly = TRUE)) stop("Para `usar_canvas=TRUE` se requiere 'cowplot'.", call. = FALSE)
    if (!requireNamespace("grid", quietly = TRUE))   stop("Para debug se requiere 'grid'.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # 0) Preparar df
  # ---------------------------------------------------------------------------
  if (!is.data.frame(data)) stop("`data` debe ser un data.frame/tibble.", call. = FALSE)
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (!var_pct %in% names(data))       stop("`var_pct` no existe en `data`.", call. = FALSE)

  df <- data |>
    dplyr::select(
      categoria = dplyr::all_of(var_categoria),
      pct       = dplyr::all_of(var_pct)
    ) |>
    dplyr::mutate(
      categoria = as.character(.data$categoria),
      pct       = suppressWarnings(as.numeric(.data$pct))
    ) |>
    dplyr::filter(!is.na(.data$categoria), .data$categoria != "") |>
    dplyr::mutate(pct = dplyr::if_else(is.finite(.data$pct), .data$pct, 0))

  if (!nrow(df)) stop("No hay filas válidas para graficar.", call. = FALSE)

  # Normaliza 0–100 a 0–1 si aplica
  if (max(df$pct, na.rm = TRUE) > 1 + 1e-8) df$pct <- df$pct / 100
  df$pct[df$pct < 0] <- 0

  total <- sum(df$pct, na.rm = TRUE)
  if (!is.finite(total) || total <= 0) stop("La suma de `var_pct` no es positiva.", call. = FALSE)
  df$pct <- df$pct / sum(df$pct, na.rm = TRUE)

  # Top-k
  if (!is.null(top_k) && is.finite(top_k) && top_k > 0) {
    top_k <- as.integer(top_k)

    df <- df |>
      dplyr::arrange(dplyr::desc(.data$pct)) |>
      dplyr::mutate(.rank = dplyr::row_number())

    df_top <- df |> dplyr::filter(.data$.rank <= top_k) |> dplyr::select(-.rank)
    df_oth <- df |> dplyr::filter(.data$.rank >  top_k)

    if (nrow(df_oth) > 0) {
      df_top <- dplyr::bind_rows(
        df_top,
        dplyr::tibble(
          categoria = etiqueta_otros,
          pct       = sum(df_oth$pct, na.rm = TRUE)
        )
      )
    }
    df <- df_top
  }

  # Orden
  if (ordenar_categorias == "desc") df <- df |> dplyr::arrange(dplyr::desc(.data$pct))
  if (ordenar_categorias == "asc")  df <- df |> dplyr::arrange(.data$pct)

  df$categoria <- factor(df$categoria, levels = df$categoria)

  df <- df |>
    dplyr::mutate(
      ymax    = cumsum(.data$pct),
      ymin    = dplyr::lag(.data$ymax, default = 0),
      pct_txt = paste0(round(.data$pct * 100, decimales_pct), "%"),
      mostrar = .data$pct >= umbral_etiqueta_pct,
      y_mid   = (.data$ymin + .data$ymax) / 2
    )

  # ---------------------------------------------------------------------------
  # 1) Radios (FULL panel)
  # ---------------------------------------------------------------------------
  r_out <- 1.0

  pie_radio_etiqueta <- suppressWarnings(as.numeric(pie_radio_etiqueta))
  if (!is.finite(pie_radio_etiqueta)) pie_radio_etiqueta <- 0.55
  pie_radio_etiqueta <- max(0.10, min(0.95, pie_radio_etiqueta))

  nudge_radial_etiqueta <- suppressWarnings(as.numeric(nudge_radial_etiqueta))
  if (!is.finite(nudge_radial_etiqueta)) nudge_radial_etiqueta <- 0

  if (tipo_pie == "pie") {
    r_in  <- 0.0
    # ✅ NO reservar radio extra: panel usa 100%
    r_lab <- r_out

    # texto dentro del pie
    r_text <- r_in + (r_out - r_in) * pie_radio_etiqueta

  } else {
    donut_hole <- max(0.05, min(0.90, donut_hole))
    r_in  <- donut_hole * r_out

    # ✅ CLAVE: etiquetas dentro => NO reservar radio extra
    r_lab <- r_out

    # ✅ CLAVE: etiquetas dentro del aro (entre r_in y r_out)
    r_text <- r_in + (r_out - r_in) * pie_radio_etiqueta

    # compatibilidad (no se usa en modo “dentro”, pero se conserva el arg)
    donut_label_nudge_out <- max(0, donut_label_nudge_out)
  }

  # pequeño “clamp” para que el texto nunca se salga del aro visualmente
  r_text <- max(r_in + 0.01, min(r_out - 0.03, r_text + nudge_radial_etiqueta))

  # ---------------------------------------------------------------------------
  # 2) Panel base (sin márgenes; FULL)
  # ---------------------------------------------------------------------------
  p_panel <- ggplot2::ggplot(df) +
    ggplot2::geom_rect(
      ggplot2::aes(
        xmin = r_in,
        xmax = r_out,
        ymin = ymin,
        ymax = ymax,
        fill = categoria
      ),
      color = NA
    ) +
    ggplot2::coord_polar(theta = "y", clip = "off") +
    ggplot2::scale_x_continuous(
      limits = c(0, r_lab),
      expand = ggplot2::expansion(mult = c(0, 0))
    ) +
    ggplot2::theme_void() +
    ggplot2::theme(
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),

      # ✅ FULL: cero aire alrededor
      plot.margin      = ggplot2::margin(0, 0, 0, 0)
    )

  if (!is.null(colores_categorias)) {
    p_panel <- p_panel + ggplot2::scale_fill_manual(values = colores_categorias, drop = FALSE)
  }

  # Etiquetas %
  if (isTRUE(mostrar_etiquetas_pct)) {
    df_lab <- df |> dplyr::filter(.data$mostrar)

    if (nrow(df_lab) > 0) {
      ff <- if (isTRUE(etiquetas_negrita) || ("etiquetas" %in% textos_negrita)) "bold" else "plain"

      p_panel <- p_panel +
        ggplot2::geom_text(
          data = df_lab,
          ggplot2::aes(x = r_text, y = y_mid, label = pct_txt),
          color       = color_etiquetas_pct,
          size        = size_etiquetas_pct,
          fontface    = ff,
          hjust       = 0.5,
          vjust       = 0.5,
          show.legend = FALSE
        )
    }
  }

  # ---------------------------------------------------------------------------
  # 3) CANVAS
  # ---------------------------------------------------------------------------
  p_final <- p_panel

  if (isTRUE(usar_canvas)) {

    .wrap_debug <- function(g) {
      if (!isTRUE(debug_ph_bordes)) return(g)
      cowplot::ggdraw(g) +
        cowplot::draw_grob(
          grid::rectGrob(
            gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)
          ),
          x = 0, y = 0, width = 1, height = 1
        )
    }

    .x_hjust <- function(pos) {
      list(
        x = switch(pos, "izquierda" = 0.02, "centro" = 0.5, "derecha" = 0.98, 0.5),
        h = switch(pos, "izquierda" = 0,    "centro" = 0.5, "derecha" = 1,    0.5)
      )
    }

    th1 <- .x_hjust(pos_titulo)
    th2 <- .x_hjust(pos_subtitulo)
    ch  <- .x_hjust(pos_nota_pie)

    y_tit <- max(0, min(1, y_titulo))
    y_sub <- max(0, min(1, y_subtitulo))

    title_block <- cowplot::ggdraw() +
      cowplot::theme_nothing() +
      cowplot::draw_label(
        label    = titulo %||% "",
        x        = th1$x, y = y_tit,
        hjust    = th1$h, vjust = 0.5,
        fontface = if ("titulo" %in% textos_negrita) "bold" else "plain",
        size     = size_titulo,
        colour   = color_titulo
      ) +
      cowplot::draw_label(
        label    = subtitulo %||% "",
        x        = th2$x, y = y_sub,
        hjust    = th2$h, vjust = 0.5,
        fontface = if ("subtitulo" %in% textos_negrita) "bold" else "plain",
        size     = size_subtitulo,
        colour   = color_subtitulo
      )

    caption_block <- cowplot::ggdraw() +
      cowplot::theme_nothing() +
      cowplot::draw_label(
        label    = nota_pie %||% "",
        x        = ch$x, y = 0.5,
        hjust    = ch$h, vjust = 0.5,
        fontface = if ("caption" %in% textos_negrita) "bold" else "plain",
        size     = size_nota_pie,
        colour   = color_nota_pie
      )

    # ------------------------------------------------------------
    # LEYENDA — espaciado vertical real SIN deformar key
    # ------------------------------------------------------------
    leg <- NULL
    if (isTRUE(mostrar_leyenda)) {

      tamano_key_cm <- suppressWarnings(as.numeric(tamano_key_cm))
      if (!is.finite(tamano_key_cm) || tamano_key_cm <= 0) tamano_key_cm <- 0.40

      espaciado_vertical_cm <- suppressWarnings(as.numeric(espaciado_vertical_cm))
      if (!is.finite(espaciado_vertical_cm) || espaciado_vertical_cm < 0) espaciado_vertical_cm <- 0.16

      p_for_leg <- p_panel +
        ggplot2::theme(
          legend.title = ggplot2::element_blank(),
          legend.text  = ggplot2::element_text(
            color = color_leyenda,
            size  = size_leyenda,
            face  = if ("leyenda" %in% textos_negrita) "bold" else "plain"
          ),

          legend.key.width  = grid::unit(tamano_key_cm, "cm"),
          legend.key.height = grid::unit(tamano_key_cm, "cm"),
          legend.key.spacing.y = grid::unit(espaciado_vertical_cm, "cm"),

          plot.margin = ggplot2::margin(0, 0, 0, 0)
        )

      if (leyenda_posicion == "abajo") {
        p_for_leg <- p_for_leg +
          ggplot2::theme(legend.position = "bottom") +
          ggplot2::guides(
            fill = ggplot2::guide_legend(
              ncol      = ncol_leyenda_bajo,
              byrow     = TRUE,
              reverse   = invertir_leyenda,
              keywidth  = grid::unit(tamano_key_cm, "cm"),
              keyheight = grid::unit(tamano_key_cm, "cm")
            )
          )
      } else {
        p_for_leg <- p_for_leg +
          ggplot2::theme(legend.position = "right") +
          ggplot2::guides(
            fill = ggplot2::guide_legend(
              reverse   = invertir_leyenda,
              keywidth  = grid::unit(tamano_key_cm, "cm"),
              keyheight = grid::unit(tamano_key_cm, "cm")
            )
          )
      }

      leg <- cowplot::get_legend(p_for_leg)
    }

    panel_no_leg <- p_panel + ggplot2::theme(legend.position = "none")
    legend_block <- if (!is.null(leg)) cowplot::ggdraw(leg) else (cowplot::ggdraw() + cowplot::theme_nothing())

    if (leyenda_posicion == "derecha") {

      row_mid <- cowplot::plot_grid(
        .wrap_debug(panel_no_leg),
        .wrap_debug(legend_block),
        nrow = 1,
        rel_widths = c(1 - canvas_w_legend_right, canvas_w_legend_right)
      )

      p_final <- cowplot::plot_grid(
        .wrap_debug(title_block),
        .wrap_debug(row_mid),
        .wrap_debug(caption_block),
        ncol = 1,
        rel_heights = c(
          canvas_h_title,
          max(0.01, 1 - (canvas_h_title + canvas_h_caption) - canvas_pad_top),
          canvas_h_caption
        )
      )

    } else {

      h_leg <- if (isTRUE(mostrar_leyenda) && !is.null(leg)) canvas_h_legend_bottom else 0.01
      h_mid <- max(0.01, 1 - (canvas_h_title + h_leg + canvas_h_caption) - canvas_pad_top)

      p_final <- cowplot::plot_grid(
        .wrap_debug(title_block),
        .wrap_debug(panel_no_leg),
        .wrap_debug(legend_block),
        .wrap_debug(caption_block),
        ncol = 1,
        rel_heights = c(canvas_h_title, h_mid, h_leg, canvas_h_caption)
      )
    }
  }

  # ---------------------------------------------------------------------------
  # 4) Exportación
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") return(p_final)

  if (is.null(path_salida) || !nzchar(path_salida)) {
    stop("Debe especificar `path_salida` cuando `exportar` no es 'rplot'.", call. = FALSE)
  }

  if (exportar == "png") {
    ggplot2::ggsave(
      filename = path_salida,
      plot     = p_final,
      width    = ancho,
      height   = alto,
      dpi      = dpi,
      bg       = if (is.na(color_fondo)) "transparent" else color_fondo
    )
    return(invisible(p_final))
  }

  if (exportar == "word") {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para Word se requiere 'officer'.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE))     stop("Para Word se requiere 'rvg'.", call. = FALSE)
    doc <- officer::read_docx()
    doc <- officer::body_add_par(doc, value = "", style = "Normal")
    doc <- officer::body_add_dml(doc, value = rvg::dml(ggobj = p_final), width = ancho, height = alto)
    print(doc, target = path_salida)
    return(invisible(p_final))
  }

  if (exportar == "ppt") {
    if (!requireNamespace("officer", quietly = TRUE) || !requireNamespace("rvg", quietly = TRUE)) {
      stop("Para PPT se requieren 'officer' y 'rvg'.", call. = FALSE)
    }
    doc <- officer::read_pptx()
    doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
    doc <- officer::ph_with(
      doc,
      value    = rvg::dml(ggobj = p_final, bg = "transparent"),
      location = officer::ph_location_fullsize()
    )
    print(doc, target = path_salida)
    return(invisible(p_final))
  }

  p_final
}
