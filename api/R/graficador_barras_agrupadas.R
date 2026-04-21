#' Graficar barras agrupadas para porcentajes por categoria
#'
#' Construye un grafico de **barras agrupadas** para comparar una o mas series de
#' porcentajes dentro de cada categoria (por ejemplo, indicadores por distrito,
#' resultados por servicio o distribuciones por grupo).
#'
#' La funcion espera un `data.frame` en formato ancho: una columna con la categoria,
#' una columna con el tamano de base (`N`) y varias columnas con porcentajes (una por
#' serie). Internamente, los porcentajes se transforman a una escala comun (0-1) y se
#' dibujan las barras con `ggplot2`.
#'
#' Ademas del modo estandar, se puede activar un modo de armado por "bloques" (`usar_canvas`)
#' para controlar con mayor precision la ubicacion relativa del encabezado (titulo y
#' subtitulo), el panel del grafico, la leyenda y el pie de pagina. Este modo tambien
#' permite dibujar bordes de referencia (`debug_ph_bordes`) para revisar la estructura
#' del layout.
#'
#' @param data `data.frame` o `tibble` con las columnas indicadas en `var_categoria`,
#'   `var_n` y `cols_porcentaje`.
#' @param var_categoria Nombre (string) de la columna que define las categorias.
#' @param var_n Nombre (string) de la columna con la base por categoria (tipicamente `N`).
#' @param cols_porcentaje Vector de strings con los nombres de las columnas que contienen
#'   los porcentajes a graficar (una columna por serie).
#' @param etiquetas_series Vector **nombrado** que asigna etiquetas legibles a las series.
#'   Los `names(etiquetas_series)` deben coincidir con `cols_porcentaje` y los valores
#'   son los textos que se mostraran en la leyenda.
#'
#' @param escala_valor Indica la escala en que vienen los porcentajes:
#'   `"proporcion_1"` si vienen como proporcion (0-1) o `"proporcion_100"` si vienen
#'   en porcentaje (0-100).
#' @param orientacion Orientacion del grafico: `"horizontal"` (por defecto) o `"vertical"`.
#'   Si `usar_canvas = TRUE`, solo se admite `"horizontal"`.
#' @param colores_series Vector nombrado de colores por serie (opcional). Los nombres
#'   deben coincidir con las etiquetas finales de la serie (las de `etiquetas_series`).
#'
#' @param mostrar_valores Si `TRUE`, agrega etiquetas de porcentaje sobre las barras.
#' @param decimales Numero de decimales para etiquetas no enteras.
#' @param umbral_etiqueta Umbral minimo (en escala 0-1) para mostrar una etiqueta.
#'   Valores menores se ocultan.
#' @param umbral_posicion Umbral (en escala 0-1) para decidir si la etiqueta se coloca
#'   dentro de la barra (mitad de la altura) o fuera (por encima).
#' @param sufijo_etiqueta Texto adicional al final de cada etiqueta (por ejemplo, `" pp"`).
#'
#' @param mostrar_barra_extra Si `TRUE`, muestra un texto adicional por categoria basado
#'   en `var_n` (por ejemplo `N = ...`). En modo estandar se dibuja dentro del mismo ggplot;
#'   en modo canvas se ubica en el bloque derecho.
#' @param prefijo_barra_extra Prefijo del texto adicional (por ejemplo `"N = "`).
#' @param titulo_barra_extra Texto opcional para rotular el bloque de la barra extra
#'   (principalmente cuando `usar_canvas = TRUE`).
#'
#' @param titulo Titulo del grafico (opcional).
#' @param subtitulo Subtitulo del grafico (opcional).
#' @param nota_pie Texto del pie (opcional).
#' @param nota_pie_derecha Texto adicional para combinar en el pie (opcional). Si se
#'   proporciona junto con `nota_pie`, se concatenan en una sola linea.
#' @param pos_titulo Alineacion del titulo y subtitulo: `"centro"`, `"izquierda"` o `"derecha"`.
#' @param pos_nota_pie Alineacion del pie: `"derecha"`, `"izquierda"` o `"centro"`.
#'
#' @param color_titulo,color_subtitulo,color_nota_pie,color_leyenda Colores para textos
#'   de encabezado, pie y leyenda.
#' @param size_titulo,size_subtitulo,size_nota_pie,size_leyenda Tamanos de texto para
#'   encabezado, pie y leyenda.
#' @param color_texto_barras,color_texto_barras_fuera Colores de etiquetas de porcentaje
#'   dentro y fuera de la barra.
#' @param size_texto_barras Tamano base de las etiquetas de porcentaje (se ajusta segun
#'   el numero de series).
#' @param color_barra_extra,size_barra_extra Color y tamano del texto adicional por categoria.
#' @param color_ejes,size_ejes Color y tamano de las etiquetas de categorias.
#' @param usar_eje_libre Si `FALSE`, fija el maximo en 100% (1.0) para facilitar comparacion
#'   entre graficos. Si `TRUE`, ajusta el maximo al valor observado.
#' @param color_fondo Color de fondo del grafico. Por defecto es transparente (`NA`).
#'
#' @param grosor_barras Grosor de las barras (ancho en `geom_col()`).
#' @param extra_derecha_rel Espacio adicional relativo al maximo para acomodar textos fuera
#'   de las barras (modo estandar).
#' @param espacio_izquierda_rel Expansion inferior/izquierda de la escala (modo estandar).
#' @param ancho_max_eje_y Si se define, aplica "wrap" a las etiquetas de categorias usando
#'   ese ancho (requiere `stringr`).
#'
#' @param mostrar_leyenda Si `FALSE`, oculta la leyenda.
#' @param invertir_leyenda Si `TRUE`, invierte el orden de la leyenda.
#' @param invertir_barras Si `TRUE`, invierte el orden de las categorias.
#' @param invertir_series Si `TRUE`, invierte el orden de las series.
#' @param textos_negrita Vector de palabras clave para forzar negrita en elementos del
#'   grafico. Se reconocen, por ejemplo: `"titulo"`, `"porcentajes"`, `"leyenda"`,
#'   `"barra_extra"`, `"eje_y"`.
#'
#' @param usar_canvas Si `TRUE`, arma el grafico mediante `cowplot` separando encabezado,
#'   panel, leyenda y pie en bloques.
#' @param canvas_w_etiquetas,canvas_w_buf_etq_bars,canvas_w_bars,canvas_w_buf_bars_extra,canvas_w_extra
#'   Anchos relativos de los bloques horizontales del panel (etiquetas, buffers, barras y
#'   bloque de texto extra).
#' @param canvas_h_header_in,canvas_h_legend_in,canvas_h_caption_in Alturas (en pulgadas)
#'   sugeridas para encabezado, leyenda y pie cuando existen.
#' @param canvas_h_panel_in Altura (en pulgadas) del panel. Si es `NULL`, se calcula a partir
#'   del numero de categorias y `alto_por_categoria`.
#' @param canvas_h_toprow_in Altura (en pulgadas) de una fila superior opcional dentro del panel
#'   para ubicar `titulo_barra_extra`.
#' @param legend_key_cm Tamano (cm) de la llave de la leyenda.
#' @param legend_espaciado Espaciado horizontal adicional en el texto de leyenda (en puntos).
#' @param legend_n_por_fila Numero de items por fila en la leyenda (canvas).
#' @param encabezado_desplazamiento_in Desplazamiento vertical (en pulgadas) del encabezado.
#' @param encabezado_separacion_in Separacion vertical (en pulgadas) entre titulo y subtitulo.
#' @param leyenda_desplazamiento_in Desplazamiento vertical (en pulgadas) de la leyenda.
#' @param centro_cowplot Centro horizontal (0-1) para ubicar la leyenda dentro del canvas.
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de referencia alrededor de los bloques del canvas.
#' @param debug_ph_col Color de los bordes de debug.
#' @param debug_ph_lwd Grosor de los bordes de debug.
#'
#' @param exportar Tipo de salida: `"rplot"` devuelve el objeto grafico; `"png"` guarda un PNG;
#'   `"ppt"` agrega una diapositiva a un PPTX; `"word"` agrega el grafico a un DOCX.
#' @param path_salida Ruta del archivo de salida cuando `exportar` no es `"rplot"`.
#' @param ancho,alto Tamano del grafico (en pulgadas) para exportacion.
#' @param alto_por_categoria Altura sugerida por categoria (en pulgadas) para estimar alturas
#'   en exportacion y en el calculo automatico de `canvas_h_panel_in`.
#' @param dpi Resolucion (DPI) al exportar PNG.
#' @param ppt_append Si `TRUE` y `path_salida` existe, se abre y se anade una nueva diapositiva.
#'   Si `FALSE`, se crea un archivo nuevo.
#' @param ppt_layout Layout de la diapositiva a usar al exportar a PPT.
#' @param ppt_master Master a usar al exportar a PPT.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto grafico (`ggplot` en modo estandar o
#'   `cowplot::ggdraw()` en modo canvas). En caso contrario, exporta a archivo y devuelve
#'   el grafico de forma invisible.
#'
#' @examples
#' library(tibble)
#' df <- tibble(
#'   categoria = c("A", "B", "C"),
#'   N = c(120, 95, 80),
#'   pct_1 = c(0.30, 0.45, 0.25),
#'   pct_2 = c(0.50, 0.35, 0.60)
#' )
#' graficar_barras_agrupadas(
#'   data = df,
#'   var_categoria = "categoria",
#'   var_n = "N",
#'   cols_porcentaje = c("pct_1", "pct_2"),
#'   etiquetas_series = c(pct_1 = "Serie 1", pct_2 = "Serie 2"),
#'   titulo = "Ejemplo",
#'   subtitulo = "Barras agrupadas"
#' )
#'
#' @family graficador
#' @export
graficar_barras_agrupadas <- function(
    data,
    var_categoria,
    var_n,
    cols_porcentaje,
    etiquetas_series,
    escala_valor              = c("proporcion_1", "proporcion_100"),
    orientacion               = c("horizontal", "vertical"),
    colores_series            = NULL,
    mostrar_valores           = TRUE,
    decimales                 = 1,
    umbral_etiqueta           = 0.03,
    umbral_barra              = 0.01,   # proporcion minima para dibujar una barra
    umbral_posicion           = 0.15,
    sufijo_etiqueta           = "",
    mostrar_barra_extra       = TRUE,
    prefijo_barra_extra       = NULL,
    titulo_barra_extra        = NULL,
    titulo                    = NULL,
    subtitulo                 = NULL,
    nota_pie                  = NULL,
    nota_pie_derecha          = NULL,
    pos_titulo                = c("centro", "izquierda", "derecha"),
    pos_nota_pie              = c("derecha", "izquierda", "centro"),

    # Estilo
    color_titulo              = "#004B8D",
    size_titulo               = 11,
    color_subtitulo           = "#004B8D",
    size_subtitulo            = 9,
    face_subtitulo            = "italic",
    color_nota_pie            = "#004B8D",
    size_nota_pie             = 8,
    color_leyenda             = "#004B8D",
    size_leyenda              = 8,
    color_texto_barras        = "white",
    color_texto_barras_fuera  = "#004B8D",
    size_texto_barras         = 3,
    color_barra_extra         = "#004B8D",
    size_barra_extra          = 3,
    color_ejes                = "#004B8D",
    size_ejes                 = 9,
    usar_eje_libre            = FALSE,
    color_fondo               = NA,

    grosor_barras             = 0.6,
    extra_derecha_rel         = 0.25,
    espacio_izquierda_rel     = 0.05,
    ancho_max_eje_y           = NULL,

    mostrar_leyenda           = TRUE,
    invertir_leyenda          = FALSE,
    invertir_barras           = FALSE,
    invertir_series           = FALSE,
    textos_negrita            = NULL,

    # ==========================
    # CANVAS CONTROLADO
    # ==========================
    usar_canvas               = FALSE,

    canvas_w_etiquetas        = 0.38,
    canvas_w_buf_etq_bars     = 0.00,
    canvas_w_buf_bars_extra   = 0.00,
    canvas_w_bars             = 0.52,
    canvas_w_extra            = 0.10,

    canvas_h_header_in        = 0.75,
    canvas_h_legend_in        = 0.75,
    canvas_h_caption_in       = 0.40,
    canvas_h_panel_in         = NULL,
    canvas_h_toprow_in        = 0.18,

    legend_key_cm             = 0.30,
    legend_espaciado          = 0.20,
    legend_n_por_fila         = 6L,

    encabezado_desplazamiento_in = 0,
    encabezado_separacion_in     = 0.14,
    leyenda_desplazamiento_in    = 0,

    centro_cowplot            = NA_real_,

    debug_ph_bordes           = FALSE,
    debug_ph_col              = "#FF00FF",
    debug_ph_lwd              = 0.6,

    # ==========================
    # EXPORTAR
    # ==========================
    exportar                  = c("rplot", "png", "ppt", "word"),
    path_salida               = NULL,
    ancho                     = 10,
    alto                      = 6,
    alto_por_categoria        = NULL,
    dpi                       = 300,

    ppt_append                = TRUE,
    ppt_layout                = "Blank",
    ppt_master                = "Office Theme"
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y
  hjust_from_pos <- function(x) switch(x, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 0.5)

  # deps minimas
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Requiere ggplot2.", call. = FALSE)
  if (!requireNamespace("dplyr", quietly = TRUE))  stop("Requiere dplyr.",  call. = FALSE)
  if (!requireNamespace("tidyr", quietly = TRUE))  stop("Requiere tidyr.",  call. = FALSE)
  if (!requireNamespace("grid", quietly = TRUE))   stop("Requiere grid.",   call. = FALSE)
  if (!requireNamespace("scales", quietly = TRUE)) stop("Requiere scales.", call. = FALSE)

  escala_valor <- match.arg(escala_valor)
  orientacion  <- match.arg(orientacion)
  exportar     <- match.arg(exportar)
  pos_titulo   <- match.arg(pos_titulo)
  pos_nota_pie <- match.arg(pos_nota_pie)

  textos_negrita <- textos_negrita %||% character(0)
  hjust_titulo    <- hjust_from_pos(pos_titulo)
  hjust_caption   <- hjust_from_pos(pos_nota_pie)

  # canvas: solo horizontal (por diseno de placeholders por filas)
  if (isTRUE(usar_canvas) && orientacion != "horizontal") {
    stop("`usar_canvas = TRUE` solo esta soportado para `orientacion = \"horizontal\"`.", call. = FALSE)
  }

  # validaciones
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (!var_n %in% names(data))         stop("`var_n` no existe en `data`.", call. = FALSE)
  if (!all(cols_porcentaje %in% names(data))) {
    faltan <- cols_porcentaje[!cols_porcentaje %in% names(data)]
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }
  if (!all(names(etiquetas_series) %in% cols_porcentaje)) {
    stop("Los names de `etiquetas_series` deben coincidir con `cols_porcentaje`.", call. = FALSE)
  }

  df <- data

  # ---------------------------------------------------------------------------
  # 1) Ancho -> largo
  # ---------------------------------------------------------------------------
  df_long <- df |>
    dplyr::select(dplyr::all_of(c(var_categoria, var_n, cols_porcentaje))) |>
    tidyr::pivot_longer(
      cols      = dplyr::all_of(cols_porcentaje),
      names_to  = ".col_pct",
      values_to = ".valor"
    ) |>
    dplyr::mutate(.serie = dplyr::recode(.data$.col_pct, !!!etiquetas_series))

  if (!is.numeric(df_long$.valor)) stop("Las columnas de porcentaje deben ser numericas.", call. = FALSE)

  df_long$.valor_plot <- if (escala_valor == "proporcion_100") df_long$.valor / 100 else df_long$.valor
  df_long$.valor_plot[is.na(df_long$.valor_plot) | !is.finite(df_long$.valor_plot)] <- 0
  df_long$.valor_plot <- pmax(0, df_long$.valor_plot)

  # Suprimir barras por debajo de umbral_barra (se ponen a NA → geom_col no las dibuja)
  if (!is.null(umbral_barra) && is.numeric(umbral_barra) && is.finite(umbral_barra) && umbral_barra > 0) {
    mask_baja <- !is.na(df_long$.valor_plot) & df_long$.valor_plot < umbral_barra
    df_long$.valor_plot[mask_baja] <- NA_real_

    cats_keep <- df_long |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::summarise(.keep = any(!is.na(.data$.valor_plot)), .groups = "drop") |>
      dplyr::filter(.data$.keep)

    if (nrow(cats_keep)) {
      df_long <- dplyr::semi_join(df_long, cats_keep, by = var_categoria)
      df <- dplyr::semi_join(df, cats_keep, by = var_categoria)
    }
  }

  # orden series
  niveles_series <- unname(etiquetas_series)
  if (invertir_series) niveles_series <- rev(niveles_series)
  df_long$.serie <- factor(df_long$.serie, levels = niveles_series)

  # orden categorias (FIJO)
  cat_chr  <- as.character(df_long[[var_categoria]])
  cat_lvls <- unique(cat_chr)
  if (invertir_barras) cat_lvls <- rev(cat_lvls)
  df_long[[var_categoria]] <- factor(cat_chr, levels = cat_lvls)
  n_categorias <- length(cat_lvls)

  # tamanos texto %
  n_series <- length(levels(df_long$.serie))
  size_texto_barras_eff <- dplyr::case_when(
    n_series <= 2 ~ size_texto_barras * 1.00,
    n_series == 3 ~ size_texto_barras * 0.85,
    n_series == 4 ~ size_texto_barras * 0.70,
    TRUE          ~ size_texto_barras * 0.55
  )

  max_valor <- suppressWarnings(max(df_long$.valor_plot, na.rm = TRUE))
  if (!is.finite(max_valor)) max_valor <- 0

  # ==========================
  # Regla: ancho 100% salvo eje libre
  # ==========================
  base_max <- if (isTRUE(usar_eje_libre)) max_valor else 1
  if (!is.finite(base_max) || base_max <= 0) base_max <- 1

  # ---------------------------------------------------------------------------
  # 2) Plot base agrupado
  # ---------------------------------------------------------------------------
  width_dodge <- 0.70

  p <- ggplot2::ggplot(
    df_long,
    ggplot2::aes(
      x    = .data[[var_categoria]],
      y    = .data$.valor_plot,
      fill = .data$.serie
    )
  ) +
    ggplot2::geom_col(
      position = ggplot2::position_dodge(width = width_dodge),
      width    = grosor_barras
    )

  # ---------------------------------------------------------------------------
  # 3) Etiquetas %
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_valores)) {

    df_lab <- df_long

    dec <- suppressWarnings(as.numeric(decimales))
    if (!is.finite(dec) || dec < 0) dec <- 1

    pct_num <- df_lab$.valor_plot * 100
    tol <- 10^(-(dec + 1))
    es_entero <- is.finite(pct_num) & (abs(pct_num - round(pct_num)) < tol)

    lab_base <- character(nrow(df_lab))
    fmt_no_entero <- paste0("%.", dec, "f%%")

    lab_base[es_entero]  <- sprintf("%d%%", round(pct_num[es_entero]))
    lab_base[!es_entero] <- sprintf(fmt_no_entero, pct_num[!es_entero])

    lab_base[!is.na(df_lab$.valor_plot) & df_lab$.valor_plot <= 0]             <- NA_character_
    lab_base[!is.na(df_lab$.valor_plot) & df_lab$.valor_plot < umbral_etiqueta] <- NA_character_
    lab_base[is.na(df_lab$.valor_plot)]                                         <- NA_character_

    df_lab$lab <- ifelse(!is.na(lab_base), paste0(lab_base, sufijo_etiqueta), "")

    umbral_posicion_eff <- umbral_posicion
    if (!is.finite(umbral_posicion_eff) || umbral_posicion_eff <= 0) umbral_posicion_eff <- 0.15

    offset_lab <- if (orientacion == "vertical") base_max * 0.03 else base_max * 0.015

    df_lab$inside <- !is.na(df_lab$.valor_plot) & df_lab$.valor_plot >= umbral_posicion_eff & df_lab$lab != ""

    df_lab$valor_label <- df_lab$.valor_plot
    df_lab$valor_label[df_lab$inside & !is.na(df_lab$inside)] <-
      df_lab$.valor_plot[df_lab$inside & !is.na(df_lab$inside)] / 2
    mask_outside <- !is.na(df_lab$.valor_plot) & !is.na(df_lab$inside) & !df_lab$inside & df_lab$.valor_plot > 0
    df_lab$valor_label[mask_outside] <- df_lab$.valor_plot[mask_outside] + offset_lab

    df_lab$hjust_label <- ifelse(df_lab$inside, 0.5, 0)
    if (orientacion == "vertical") df_lab$hjust_label <- 0.5

    df_lab$col_label <- ifelse(df_lab$inside, color_texto_barras, color_texto_barras_fuera)

    p <- p +
      ggplot2::geom_text(
        data        = df_lab[df_lab$lab != "", , drop = FALSE],
        mapping     = ggplot2::aes(
          x      = .data[[var_categoria]],
          y      = .data$valor_label,
          label  = .data$lab,
          group  = .data$.serie,
          colour = .data$col_label,
          hjust  = .data$hjust_label
        ),
        inherit.aes = FALSE,
        position    = ggplot2::position_dodge(width = width_dodge),
        vjust       = 0.5,
        size        = size_texto_barras_eff,
        fontface    = if ("porcentajes" %in% textos_negrita) "bold" else "plain",
        show.legend = FALSE
      ) +
      ggplot2::scale_colour_identity(guide = "none")
  }

  # ---------------------------------------------------------------------------
  # 4) Colores + wrap
  # ---------------------------------------------------------------------------
  if (!is.null(colores_series)) p <- p + ggplot2::scale_fill_manual(values = colores_series)

  if (!is.null(ancho_max_eje_y)) {
    if (!requireNamespace("stringr", quietly = TRUE)) stop("Para `ancho_max_eje_y` se requiere stringr.", call. = FALSE)
    p <- p + ggplot2::scale_x_discrete(labels = function(x) stringr::str_wrap(x, width = ancho_max_eje_y))
  }

  # caption
  caption_text <- NULL
  if (!is.null(nota_pie) && nzchar(nota_pie) && !is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- paste0(nota_pie, "   ", nota_pie_derecha)
  } else if (!is.null(nota_pie) && nzchar(nota_pie)) {
    caption_text <- nota_pie
  } else if (!is.null(nota_pie_derecha) && nzchar(nota_pie_derecha)) {
    caption_text <- nota_pie_derecha
  }

  # ---------------------------------------------------------------------------
  # 5) Escala %
  # ---------------------------------------------------------------------------
  if (escala_valor %in% c("proporcion_1", "proporcion_100")) {

    if (!isTRUE(usar_canvas)) {
      y_lim <- if (isTRUE(mostrar_barra_extra)) base_max * (1 + extra_derecha_rel) else base_max

      breaks_y <- scales::pretty_breaks(n = 4)(c(0, base_max))
      breaks_y <- breaks_y[breaks_y >= 0 & breaks_y <= base_max]

      p <- p +
        ggplot2::scale_y_continuous(
          limits = c(0, y_lim),
          breaks = breaks_y,
          labels = scales::percent_format(accuracy = 1),
          expand = ggplot2::expansion(mult = c(0, 0.02))
        )
    } else {

      breaks_y <- scales::pretty_breaks(n = 4)(c(0, base_max))
      breaks_y <- breaks_y[breaks_y >= 0 & breaks_y <= base_max]

      p <- p +
        ggplot2::scale_y_continuous(
          limits = c(0, base_max),
          breaks = breaks_y,
          labels = scales::percent_format(accuracy = 1),
          expand = ggplot2::expansion(mult = c(0, 0))
        )
    }

  } else {

    y_lim <- if (!isTRUE(usar_canvas) && isTRUE(mostrar_barra_extra)) max_valor * (1 + extra_derecha_rel) else max_valor
    if (!is.finite(y_lim) || y_lim <= 0) y_lim <- 1

    p <- p +
      ggplot2::scale_y_continuous(
        limits = c(0, y_lim),
        expand = ggplot2::expansion(mult = c(espacio_izquierda_rel, 0.05))
      )
  }

  # ---------------------------------------------------------------------------
  # 6) Barra extra N= (solo NO canvas)
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_barra_extra) && !isTRUE(usar_canvas)) {

    y_extra <- if (escala_valor %in% c("proporcion_1", "proporcion_100")) {
      base_max * (1 + extra_derecha_rel * 0.50)
    } else {
      max_valor * (1 + extra_derecha_rel * 0.95)
    }
    if (!is.finite(y_extra)) y_extra <- base_max

    df_extra <- df |>
      dplyr::select(dplyr::all_of(c(var_categoria, var_n))) |>
      dplyr::distinct() |>
      dplyr::mutate(
        ypos      = y_extra,
        lab_extra = paste0(prefijo_barra_extra, .data[[var_n]])
      )

    p <- p +
      ggplot2::geom_text(
        data        = df_extra,
        mapping     = ggplot2::aes(
          x     = .data[[var_categoria]],
          y     = .data$ypos,
          label = .data$lab_extra
        ),
        inherit.aes = FALSE,
        hjust       = 0,
        vjust       = 0.5,
        size        = size_barra_extra,
        color       = color_barra_extra,
        fontface    = if ("barra_extra" %in% textos_negrita) "bold" else "plain"
      )

    if (!is.null(titulo_barra_extra) && nzchar(titulo_barra_extra)) {
      lvls <- levels(df_long[[var_categoria]])
      cat_superior <- if (invertir_barras) tail(lvls, 1) else head(lvls, 1)
      df_header <- df_extra[df_extra[[var_categoria]] == cat_superior, , drop = FALSE]

      if (nrow(df_header) == 1L) {
        p <- p +
          ggplot2::geom_text(
            data        = df_header,
            mapping     = ggplot2::aes(x = .data[[var_categoria]], y = .data$ypos),
            label       = titulo_barra_extra,
            inherit.aes = FALSE,
            hjust       = 0,
            vjust       = -1.2,
            size        = size_barra_extra,
            color       = color_barra_extra,
            fontface    = "bold"
          )
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 7) Tema + orientacion + leyenda
  # ---------------------------------------------------------------------------
  n_items_ley <- length(levels(df_long$.serie))
  n_filas_ley <- max(1L, ceiling(n_items_ley / 5))

  if (isTRUE(mostrar_leyenda)) {
    p <- p + ggplot2::guides(
      fill = ggplot2::guide_legend(
        nrow    = n_filas_ley,
        reverse = invertir_leyenda
      )
    )
  } else {
    p <- p + ggplot2::theme(legend.position = "none")
  }

  base_theme <- ggplot2::theme_minimal(base_size = 9) +
    ggplot2::theme(
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.minor   = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      axis.title.x       = ggplot2::element_blank(),
      axis.title.y       = ggplot2::element_blank(),
      legend.title       = ggplot2::element_blank(),
      legend.position    = if (isTRUE(mostrar_leyenda)) "bottom" else "none",
      legend.text        = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain"
      ),
      plot.title         = ggplot2::element_text(
        hjust = hjust_titulo,
        color = color_titulo,
        size  = size_titulo,
        face  = if ("titulo" %in% textos_negrita) "bold" else "plain"
      ),
      plot.subtitle      = ggplot2::element_text(
        hjust = hjust_titulo,
        color = color_subtitulo,
        size  = size_subtitulo,
        face  = face_subtitulo %||% "italic"
      ),
      plot.caption       = ggplot2::element_text(
        hjust = hjust_caption,
        color = color_nota_pie,
        size  = size_nota_pie
      ),
      plot.background    = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background   = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.margin        = ggplot2::margin(t = 10, r = if (isTRUE(mostrar_barra_extra) && !isTRUE(usar_canvas)) 60 else 10, b = 10, l = 5)
    )

  if (orientacion == "horizontal") p <- p + ggplot2::coord_flip()
  p <- p + base_theme + ggplot2::labs(title = titulo, subtitle = subtitulo, caption = caption_text)

  # ---------------------------------------------------------------------------
  # 8) NO CANVAS: export directo
  # ---------------------------------------------------------------------------
  if (!isTRUE(usar_canvas)) {

    if (exportar == "rplot") {
      attr(p, "alto_word_sugerido") <- (alto_por_categoria %||% 0.35) * max(1L, n_categorias)
      return(p)
    }

    if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

    if (exportar == "png") {
      ggplot2::ggsave(
        filename = path_salida, plot = p,
        width = ancho, height = alto, units = "in",
        dpi = dpi,
        bg = if (is.na(color_fondo)) "transparent" else color_fondo
      )
      return(invisible(p))
    }

    if (exportar %in% c("ppt", "word")) {
      if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
      if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

      if (exportar == "ppt") {
        doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
        doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
        doc <- officer::ph_with(doc, value = rvg::dml(ggobj = p), location = officer::ph_location_fullsize())
        print(doc, target = path_salida)
        return(invisible(p))
      }

      if (exportar == "word") {
        doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
        doc <- officer::body_add_par(doc, value = "", style = "Normal")
        doc <- officer::body_add_dml(doc, value = rvg::dml(ggobj = p), width = ancho, height = alto)
        print(doc, target = path_salida)
        return(invisible(p))
      }
    }

    stop("Tipo de exportacion no soportado.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # 9) CANVAS
  # ---------------------------------------------------------------------------
  if (!requireNamespace("cowplot", quietly = TRUE)) stop("Para `usar_canvas=TRUE` se requiere cowplot.", call. = FALSE)

  p <- p + ggplot2::labs(title = NULL, subtitle = NULL, caption = NULL)

  p_panel <- p +
    ggplot2::theme_void() +
    ggplot2::theme(
      legend.position  = "none",
      plot.margin      = ggplot2::margin(0,0,0,0),
      plot.background  = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA)
    )

  # leyenda grob (con separacion real)
  n_por_fila <- as.integer(legend_n_por_fila)
  if (!is.finite(n_por_fila) || n_por_fila < 1L) n_por_fila <- 6L

  p_for_legend <- p +
    ggplot2::theme(
      legend.position = "bottom",
      legend.title    = ggplot2::element_blank(),
      legend.text     = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain",
        margin = ggplot2::margin(r = legend_espaciado, unit = "pt")
      ),
      legend.key.width  = grid::unit(legend_key_cm, "cm"),
      legend.key.height = grid::unit(legend_key_cm, "cm"),
      legend.key.spacing.x = grid::unit(0.10, "cm"),
      plot.margin = ggplot2::margin(0, 0, 0, 0)
    ) +
    ggplot2::guides(
      fill = ggplot2::guide_legend(
        byrow     = TRUE,
        ncol      = n_por_fila,
        reverse   = invertir_leyenda,
        keywidth  = grid::unit(legend_key_cm, "cm"),
        keyheight = grid::unit(legend_key_cm, "cm")
      )
    )

  has_legend <- isTRUE(mostrar_leyenda) && n_series > 0
  leg_grob <- NULL
  if (has_legend) {
    leg_grob <- cowplot::get_legend(
      p_for_legend + ggplot2::theme(
        legend.position  = "bottom",
        legend.direction = "horizontal",
        legend.box       = "horizontal"
      )
    )
  }

  # etiquetas y extra (texto)
  etiquetas_vec <- cat_lvls
  if (!is.null(ancho_max_eje_y)) {
    if (!requireNamespace("stringr", quietly = TRUE)) stop("Para `ancho_max_eje_y` se requiere stringr.", call. = FALSE)
    etiquetas_vec <- stringr::str_wrap(etiquetas_vec, width = ancho_max_eje_y)
  }

  extra_labels <- rep("", length(cat_lvls))
  if (isTRUE(mostrar_barra_extra)) {
    extra_map <- df |>
      dplyr::select(dplyr::all_of(c(var_categoria, var_n))) |>
      dplyr::mutate(.cat_chr = as.character(.data[[var_categoria]])) |>
      dplyr::select(.cat_chr, .data[[var_n]])

    extra_vals <- vapply(cat_lvls, function(cc) {
      vv <- extra_map[[var_n]][match(cc, extra_map$.cat_chr)]
      if (length(vv) == 0 || is.na(vv)) vv <- NA
      vv
    }, numeric(1))

    extra_labels <- paste0(prefijo_barra_extra, format(extra_vals, big.mark = ",", scientific = FALSE, trim = TRUE))
    extra_labels[!is.finite(extra_vals)] <- ""
  }

  # alturas en pulgadas
  alto_por_cat_eff <- alto_por_categoria %||% 0.42
  h_panel_in <- if (!is.null(canvas_h_panel_in) && is.finite(canvas_h_panel_in) && canvas_h_panel_in > 0) {
    canvas_h_panel_in
  } else {
    max(1L, n_categorias) * alto_por_cat_eff
  }

  has_header  <- (!is.null(titulo) && nzchar(titulo)) || (!is.null(subtitulo) && nzchar(subtitulo))
  has_caption <- !is.null(caption_text) && nzchar(caption_text)

  h_header_in  <- if (has_header)  canvas_h_header_in  else 0
  h_legend_in  <- if (has_legend)  canvas_h_legend_in  else 0
  h_caption_in <- if (has_caption) canvas_h_caption_in else 0

  h_total_in <- h_header_in + h_panel_in + h_legend_in + h_caption_in
  if (h_total_in <= 0) h_total_in <- 1

  header_h  <- h_header_in  / h_total_in
  panel_h   <- h_panel_in   / h_total_in
  legend_h  <- h_legend_in  / h_total_in
  caption_h <- h_caption_in / h_total_in

  y_header0  <- 1 - header_h
  y_panel0   <- y_header0 - panel_h
  y_legend0  <- y_panel0  - legend_h
  y_caption0 <- y_legend0 - caption_h

  # widths
  w_etq   <- canvas_w_etiquetas
  w_buf1  <- canvas_w_buf_etq_bars
  w_bars  <- canvas_w_bars
  w_buf2  <- canvas_w_buf_bars_extra
  w_extra <- canvas_w_extra

  w_sum <- w_etq + w_buf1 + w_bars + w_buf2 + w_extra
  if (!is.finite(w_sum) || w_sum <= 0) w_sum <- 1

  w_etq   <- w_etq   / w_sum
  w_buf1  <- w_buf1  / w_sum
  w_bars  <- w_bars  / w_sum
  w_buf2  <- w_buf2  / w_sum
  w_extra <- w_extra / w_sum

  x_etq0   <- 0
  x_buf10  <- x_etq0 + w_etq
  x_bars0  <- x_buf10 + w_buf1
  x_buf20  <- x_bars0 + w_bars
  x_extra0 <- x_buf20 + w_buf2

  # top row (titulo extra)
  top_in <- canvas_h_toprow_in %||% 0
  if (!is.finite(top_in) || is.na(top_in) || top_in < 0) top_in <- 0
  top_in <- min(top_in, h_panel_in * 0.45)
  top_h  <- if (top_in > 0) top_in / h_total_in else 0

  main_h  <- panel_h - top_h
  y_top0  <- y_panel0 + main_h
  y_main0 <- y_panel0

  .ph_border <- function(x, y, w, h) {
    cowplot::draw_grob(
      grid::rectGrob(
        x = 0, y = 0, width = 1, height = 1,
        just = c("left", "bottom"),
        gp = grid::gpar(col = debug_ph_col, fill = NA, lwd = debug_ph_lwd)
      ),
      x = x, y = y, width = w, height = h,
      hjust = 0, vjust = 0
    )
  }

  canvas <- cowplot::ggdraw()

  # HEADER
  if (has_header) {
    y_header_center <- y_header0 + (header_h * 0.5)
    dy_head <- encabezado_desplazamiento_in / h_total_in
    sep     <- encabezado_separacion_in     / h_total_in

    has_t <- (!is.null(titulo) && nzchar(titulo))
    has_s <- (!is.null(subtitulo) && nzchar(subtitulo))

    if (has_t && has_s) {
      y_title <- y_header_center + (sep * 0.5) + dy_head
      y_sub   <- y_header_center - (sep * 0.5) + dy_head
    } else if (has_t) {
      y_title <- y_header_center + dy_head
      y_sub   <- NA_real_
    } else {
      y_title <- NA_real_
      y_sub   <- y_header_center + dy_head
    }

    if (has_t) {
      canvas <- canvas + cowplot::draw_text(
        text  = titulo,
        x     = hjust_titulo,
        y     = y_title,
        hjust = hjust_titulo,
        vjust = 0.5,
        size  = size_titulo,
        colour= color_titulo,
        fontface = if ("titulo" %in% textos_negrita) "bold" else "plain"
      )
    }
    if (has_s) {
      canvas <- canvas + cowplot::draw_text(
        text     = subtitulo,
        x        = hjust_titulo,
        y        = y_sub,
        hjust    = hjust_titulo,
        vjust    = 0.5,
        size     = size_subtitulo,
        colour   = color_subtitulo,
        fontface = face_subtitulo %||% "italic"
      )
    }

    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_header0, 1, header_h)
  }

  # TOP ROW: titulo extra
  if (top_h > 0) {

    if (debug_ph_bordes) {
      canvas <- canvas +
        .ph_border(x_etq0,   y_top0, w_etq,   top_h) +
        .ph_border(x_bars0,  y_top0, w_bars,  top_h) +
        .ph_border(x_extra0, y_top0, w_extra, top_h)
    }

    if (isTRUE(mostrar_barra_extra) && !is.null(titulo_barra_extra) && nzchar(titulo_barra_extra)) {
      canvas <- canvas + cowplot::draw_text(
        text     = titulo_barra_extra,
        x        = x_extra0 + (w_extra * 0.5),
        y        = y_top0 + (top_h * 0.2),
        hjust    = 0.5,
        vjust    = 0,
        size     = size_barra_extra,
        colour   = color_barra_extra,
        fontface = "bold"
      )
    }
  }

  # MAIN: panel barras
  canvas <- canvas +
    cowplot::draw_plot(p_panel, x = x_bars0, y = y_main0, width = w_bars, height = main_h)

  # coords Y por fila
  y_npc <- (seq_len(n_categorias) - 0.5) / n_categorias
  y_abs <- y_main0 + y_npc * main_h

  # etiquetas izquierda
  pad_x <- 0.012
  x_lab <- x_etq0 + w_etq * (1 - pad_x)
  fontface_etq <- if ("eje_y" %in% textos_negrita) "bold" else "plain"

  for (i in seq_len(n_categorias)) {
    canvas <- canvas + cowplot::draw_text(
      text     = etiquetas_vec[i],
      x        = x_lab,
      y        = y_abs[i],
      hjust    = 1,
      vjust    = 0.5,
      size     = size_ejes,
      colour   = color_ejes,
      fontface = fontface_etq
    )
  }

  # extra derecha
  x_extra_txt <- x_extra0 + (w_extra * 0.5)
  fontface_extra <- if ("barra_extra" %in% textos_negrita) "bold" else "plain"
  for (i in seq_len(n_categorias)) {
    if (nzchar(extra_labels[i])) {
      canvas <- canvas + cowplot::draw_text(
        text     = extra_labels[i],
        x        = x_extra_txt,
        y        = y_abs[i],
        hjust    = 0.5,
        vjust    = 0.5,
        size     = size_barra_extra,
        colour   = color_barra_extra,
        fontface = fontface_extra
      )
    }
  }

  if (debug_ph_bordes) {
    canvas <- canvas +
      .ph_border(x_etq0,   y_main0, w_etq,   main_h) +
      .ph_border(x_buf10,  y_main0, w_buf1,  main_h) +
      .ph_border(x_bars0,  y_main0, w_bars,  main_h) +
      .ph_border(x_buf20,  y_main0, w_buf2,  main_h) +
      .ph_border(x_extra0, y_main0, w_extra, main_h)
  }

  # LEYENDA
  if (has_legend && !is.null(leg_grob)) {

    pos_leyenda_x <- 0.5
    if (!is.na(centro_cowplot) && is.finite(centro_cowplot)) pos_leyenda_x <- centro_cowplot

    y_legend_center <- y_legend0 + (legend_h * 0.5)
    dy_leg <- leyenda_desplazamiento_in / h_total_in

    leg_w_npc <- grid::convertWidth(sum(leg_grob$widths), "npc", valueOnly = TRUE)
    if (!is.finite(leg_w_npc) || leg_w_npc <= 0) leg_w_npc <- 1

    canvas <- canvas + cowplot::draw_grob(
      leg_grob,
      x = pos_leyenda_x,
      y = y_legend_center + dy_leg,
      width  = leg_w_npc,
      height = legend_h,
      hjust  = 0.5,
      vjust  = 0.5
    )

    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_legend0, 1, legend_h)
  }

  # CAPTION
  if (has_caption) {
    canvas <- canvas + cowplot::draw_text(
      text  = caption_text,
      x     = hjust_caption,
      y     = y_caption0 + (caption_h * 0.35),
      hjust = hjust_caption,
      vjust = 0.5,
      size  = size_nota_pie,
      colour= color_nota_pie
    )
    if (debug_ph_bordes) canvas <- canvas + .ph_border(0, y_caption0, 1, caption_h)
  }

  # ---------------------------------------------------------------------------
  # 10) EXPORT CANVAS
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") {
    attr(canvas, "alto_word_sugerido") <- h_total_in
    return(canvas)
  }

  if (is.null(path_salida) || !nzchar(path_salida)) stop("`path_salida` es requerido para exportar.", call. = FALSE)

  if (exportar == "png") {
    ggplot2::ggsave(filename = path_salida, plot = canvas, width = ancho, height = alto, units = "in", dpi = dpi, bg = "transparent")
    return(invisible(canvas))
  }

  if (exportar %in% c("ppt", "word")) {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para exportar a PPT/Word se requiere officer.", call. = FALSE)
    if (!requireNamespace("rvg", quietly = TRUE))     stop("Para exportar a PPT/Word se requiere rvg.", call. = FALSE)

    if (exportar == "ppt") {
      doc <- if (ppt_append && file.exists(path_salida)) officer::read_pptx(path_salida) else officer::read_pptx()
      doc <- officer::add_slide(doc, layout = ppt_layout, master = ppt_master)
      doc <- officer::ph_with(doc, value = rvg::dml(ggobj = canvas), location = officer::ph_location_fullsize())
      print(doc, target = path_salida)
      return(invisible(canvas))
    }

    if (exportar == "word") {
      doc <- if (file.exists(path_salida)) officer::read_docx(path_salida) else officer::read_docx()
      doc <- officer::body_add_par(doc, value = "", style = "Normal")
      doc <- officer::body_add_dml(doc, value = rvg::dml(ggobj = canvas), width = ancho, height = alto)
      print(doc, target = path_salida)
      return(invisible(canvas))
    }
  }

  stop("Tipo de exportacion no soportado.", call. = FALSE)
}
