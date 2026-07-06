#' Graficar barras con valores numericos por categoria
#'
#' Construye un grafico de **barras** para comparar una o mas series de valores
#' numericos dentro de cada categoria (por ejemplo, promedios por distrito,
#' montos por servicio o indicadores por grupo).
#'
#' La funcion recibe una tabla en formato ancho: una columna con la categoria y
#' una o varias columnas con los valores a graficar. Internamente, los datos se
#' pasan a formato largo para dibujar barras agrupadas (una barra por serie dentro
#' de cada categoria). De forma opcional, se puede incluir una columna con la base
#' (`N`) para mostrarla encima de las barras.
#'
#' Para mejorar el control del diseno, se puede activar `usar_canvas = TRUE`, que
#' separa el resultado en cuatro bloques: encabezado (titulo/subtitulo), panel del
#' grafico, leyenda y nota al pie. Tambien existe un modo de depuracion con bordes
#' (`debug_ph_bordes`) para revisar visualmente la distribucion de estos bloques.
#'
#' @param data `data.frame` o `tibble` con las columnas indicadas en `var_categoria`
#'   y `vars_valor`. Si se desea mostrar la base sobre las barras, debe incluir la
#'   columna indicada en `var_n`.
#' @param var_categoria Nombre (string) de la columna que define las categorias.
#' @param var_n Nombre (string) de una columna con la base por categoria (por ejemplo, `N`).
#'   Es opcional y solo se utiliza si `mostrar_n_sobre_barras = TRUE`.
#' @param vars_valor Vector de strings con los nombres de las columnas numericas a graficar
#'   (una por serie).
#' @param etiquetas_series Vector **nombrado** para renombrar series en la leyenda.
#'   Los `names(etiquetas_series)` deben coincidir con `vars_valor` y los valores son
#'   las etiquetas que se mostraran.
#'
#' @param orientacion Orientacion del grafico: `"vertical"` o `"horizontal"`.
#'
#' @param formato_valor Formato de las etiquetas de valor: `"numero"` o `"moneda"`.
#' @param decimales Numero de decimales a mostrar.
#' @param simbolo_moneda Simbolo de moneda cuando `formato_valor = "moneda"`.
#' @param separador_miles Separador de miles para el formateo numerico.
#' @param separador_decimales Separador decimal para el formateo numerico.
#' @param colores_series Vector nombrado de colores por serie (opcional). Los nombres deben
#'   corresponder a las etiquetas finales (las de `etiquetas_series`).
#' @param colores_categorias Vector nombrado de colores por categoria (opcional).
#'   En distribuciones numericas con una sola serie, los nombres deben coincidir
#'   con las etiquetas de `var_categoria`.
#'
#' @param mostrar_valores Si `TRUE`, agrega etiquetas con el valor de cada barra.
#' @param umbral_etiqueta Umbral minimo para etiquetar (en la misma escala de `vars_valor`).
#'   Valores menores se omiten.
#' @param umbral_interno Umbral para decidir la ubicacion de la etiqueta: valores por encima
#'   se colocan dentro de la barra; por debajo se colocan afuera.
#'
#' @param mostrar_n_sobre_barras Si `TRUE`, dibuja la base (`var_n`) encima de cada barra.
#'   Requiere `var_n`.
#' @param prefijo_n_sobre_barras Prefijo para el texto de la base (por ejemplo `"N = "`).
#' @param size_n_sobre_barras Tamano del texto de la base.
#' @param color_n_sobre_barras Color del texto de la base.
#'
#' @param titulo Titulo del grafico (opcional).
#' @param subtitulo Subtitulo del grafico (opcional).
#' @param nota_pie Texto para el pie de pagina (opcional).
#' @param pos_titulo Alineacion del titulo y subtitulo: `"centro"`, `"izquierda"` o `"derecha"`.
#' @param pos_nota_pie Alineacion de la nota al pie: `"derecha"`, `"izquierda"` o `"centro"`.
#'
#' @param color_titulo,color_subtitulo,color_nota_pie,color_leyenda Colores de textos.
#' @param size_titulo,size_subtitulo,size_nota_pie,size_leyenda Tamanos de textos.
#' @param color_texto_barras,size_texto_barras Color y tamano de las etiquetas de valor.
#' @param color_ejes,size_ejes Color y tamano de las etiquetas de ejes.
#' @param color_fondo Color de fondo del grafico. Por defecto transparente (`NA`).
#'
#' @param extra_derecha_rel Espacio adicional relativo para acomodar etiquetas fuera de las barras.
#' @param ancho_max_eje_cat Si se define, aplica "wrap" a las etiquetas de categorias usando
#'   ese ancho (requiere `stringr`).
#' @param mostrar_leyenda Si `FALSE`, oculta la leyenda.
#' @param invertir_leyenda Si `TRUE`, invierte el orden de la leyenda.
#' @param invertir_barras Si `TRUE`, invierte el orden de las categorias.
#' @param textos_negrita Vector de palabras clave para aplicar negrita a elementos del grafico.
#'   Se reconoce, por ejemplo: `"titulo"`, `"valores"`, `"leyenda"`.
#'
#' @param usar_canvas Si `TRUE`, arma el resultado en cuatro bloques (encabezado, panel,
#'   leyenda y pie) usando `cowplot`.
#' @param canvas_h_title Altura relativa del bloque de titulo/subtitulo (0-1).
#' @param canvas_h_legend Altura relativa del bloque de leyenda (0-1).
#' @param canvas_h_caption Altura relativa del bloque de nota al pie (0-1).
#' @param canvas_pad_top Separacion superior adicional (0-1) antes del primer bloque.
#' @param mostrar_eje_y Si `FALSE` y `orientacion = "vertical"`, oculta el eje Y (texto y marcas).
#'
#' @param debug_ph_bordes Si `TRUE`, dibuja bordes de referencia en los bloques del canvas.
#' @param debug_color_borde Color de esos bordes.
#' @param debug_lwd Grosor de esos bordes.
#'
#' @param exportar Tipo de salida: `"rplot"` devuelve el objeto grafico; `"png"` guarda un PNG;
#'   `"ppt"` agrega una diapositiva a un PPTX; `"word"` agrega el grafico a un DOCX.
#' @param path_salida Ruta del archivo de salida cuando `exportar` no es `"rplot"`.
#' @param ancho,alto Tamano del grafico (en pulgadas) al exportar.
#' @param alto_por_categoria Altura sugerida por categoria (en pulgadas) para estimar el alto.
#' @param dpi Resolucion (DPI) al exportar PNG.
#'
#' @return Si `exportar = "rplot"`, devuelve un objeto grafico (`ggplot` o un objeto armado con
#'   `cowplot` cuando `usar_canvas = TRUE`). En otros casos, exporta a archivo y devuelve el grafico
#'   de forma invisible.
#'
#' @examples
#' library(tibble)
#' df <- tibble(
#'   categoria = c("A", "B", "C"),
#'   N = c(120, 95, 80),
#'   v1 = c(10.5, 12.3, 9.8),
#'   v2 = c(8.2,  11.1, 10.0)
#' )
#'
#' graficar_barras_numericas(
#'   data = df,
#'   var_categoria = "categoria",
#'   var_n = "N",
#'   vars_valor = c("v1", "v2"),
#'   etiquetas_series = c(v1 = "Serie 1", v2 = "Serie 2"),
#'   titulo = "Ejemplo",
#'   subtitulo = "Barras numericas",
#'   mostrar_n_sobre_barras = TRUE
#' )
#'
#' @family graficador
#' @export
graficar_barras_numericas <- function(
    data,
    var_categoria,
    var_n                = NULL,
    vars_valor,
    etiquetas_series,

    orientacion          = c("vertical", "horizontal"),
    orden_categorias     = c("original", "nivel", "mayor_menor", "menor_mayor"),

    formato_valor        = c("numero", "moneda"),
    decimales            = 1,
    simbolo_moneda       = "S/",
    separador_miles      = ".",
    separador_decimales  = ",",
    colores_series       = NULL,
    colores_categorias   = NULL,

    # Etiquetas de VALOR (dentro/arriba)
    mostrar_valores      = TRUE,
    umbral_etiqueta      = 0.03,
    umbral_interno       = 0.15,

    # ==========================
    # N encima de cada BARRA (opcional)
    # ==========================
    mostrar_n_sobre_barras = FALSE,
    prefijo_n_sobre_barras = "N = ",
    size_n_sobre_barras    = 2.8,
    color_n_sobre_barras   = "#4D4D4D",

    # Textos
    titulo               = NULL,
    subtitulo            = NULL,
    nota_pie             = NULL,
    pos_titulo           = c("centro", "izquierda", "derecha"),
    pos_nota_pie         = c("derecha", "izquierda", "centro"),

    # Estilo texto
    color_titulo         = "#000000",
    size_titulo          = 11,
    color_subtitulo      = "#000000",
    size_subtitulo       = 9,
    color_nota_pie       = "#000000",
    size_nota_pie        = 8,
    color_leyenda        = "#000000",
    size_leyenda         = 8,
    color_texto_barras   = "#000000",
    color_texto_barras_interno = NULL,
    color_texto_barras_externo = NULL,
    size_texto_barras    = 3,
    color_ejes           = "#000000",
    size_ejes            = 9,
    color_fondo          = NA,

    # Geometria de barras
    ancho_barras         = 0.6,
    grosor_barras        = NULL,   # alias de ancho_barras (compatibilidad barras_agrupadas)
    separacion_grupos    = 0.20,   # fraccion de espacio vacio entre grupos de categoria (0-0.6)

    # Layout
    extra_derecha_rel    = 0.10,
    ancho_max_eje_cat    = NULL,
    mostrar_leyenda      = TRUE,
    leyenda_posicion     = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),
    invertir_leyenda     = FALSE,
    invertir_barras      = FALSE,
    invertir_series      = FALSE,
    textos_negrita       = NULL,

    # Leyenda
    legend_n_por_fila    = NULL,
    legend_key_cm        = 0.40,
    legend_espaciado     = 15,
    legend_text_gap      = 3,    # margen izq. del texto de leyenda (espacio chip→texto, en pt)

    # Alias nombre barras_agrupadas → barras_numericas
    color_texto_barras_fuera = NULL,  # alias de color_texto_barras_externo
    canvas_h_header_in       = NULL,  # alias de canvas_h_title (via dim_alias_radar_extra_args)

    # ==========================
    # CANVAS
    # ==========================
    usar_canvas          = TRUE,

    # alturas relativas
    canvas_h_title       = 0.13,
    canvas_h_legend      = 0.12,
    canvas_h_caption     = 0.06,
    canvas_pad_top       = 0.01,

    # eje Y visible/invisible (para vertical)
    mostrar_eje_y        = TRUE,

    # DEBUG
    debug_ph_bordes      = FALSE,
    debug_color_borde    = "#8A2BE2",
    debug_lwd            = 2,

    exportar             = c("rplot", "png", "ppt", "word"),
    path_salida          = NULL,
    ancho                = 10,
    alto                 = 6,
    alto_por_categoria   = NULL,
    dpi                  = 300,
    ...
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y

  # Aliases de compatibilidad con barras_agrupadas / radarbar
  if (!is.null(grosor_barras))            ancho_barras  <- grosor_barras
  if (!is.null(color_texto_barras_fuera)) color_texto_barras_externo <- color_texto_barras_fuera
  if (!is.null(canvas_h_header_in))       canvas_h_title <- canvas_h_header_in

  orientacion   <- match.arg(orientacion)
  orden_categorias <- match.arg(orden_categorias)
  formato_valor <- match.arg(formato_valor)
  exportar      <- match.arg(exportar)
  pos_titulo    <- match.arg(pos_titulo)
  pos_nota_pie  <- match.arg(pos_nota_pie)
  leyenda_posicion <- match.arg(leyenda_posicion)
  if (identical(leyenda_posicion, "ninguna")) mostrar_leyenda <- FALSE
  legend_pos_gg <- switch(
    leyenda_posicion,
    abajo = "bottom",
    arriba = "top",
    derecha = "right",
    izquierda = "left",
    ninguna = "none",
    "bottom"
  )
  legend_is_top  <- identical(leyenda_posicion, "arriba")
  legend_is_side <- leyenda_posicion %in% c("derecha", "izquierda")
  if (is.null(color_texto_barras_interno)) color_texto_barras_interno <- color_texto_barras
  if (is.null(color_texto_barras_externo)) color_texto_barras_externo <- color_texto_barras

  if (!requireNamespace("ggplot2", quietly = TRUE) ||
      !requireNamespace("dplyr", quietly = TRUE) ||
      !requireNamespace("tidyr", quietly = TRUE)) {
    stop("Se requieren 'ggplot2', 'dplyr' y 'tidyr'.", call. = FALSE)
  }

  # ---------------------------------------------------------------------------
  # 0) Validaciones
  # ---------------------------------------------------------------------------
  if (!var_categoria %in% names(data)) stop("`var_categoria` no existe en `data`.", call. = FALSE)
  if (!is.null(var_n) && !var_n %in% names(data)) stop("`var_n` no existe en `data`.", call. = FALSE)

  if (!all(vars_valor %in% names(data))) {
    faltan <- vars_valor[!vars_valor %in% names(data)]
    stop("Estas columnas de `vars_valor` no existen en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }
  if (!all(names(etiquetas_series) %in% vars_valor)) {
    stop("Los nombres de `etiquetas_series` deben coincidir con columnas de `vars_valor`.", call. = FALSE)
  }

  textos_negrita <- textos_negrita %||% character(0)

  # ---------------------------------------------------------------------------
  # 1) Largo
  # ---------------------------------------------------------------------------
  cols_sel <- c(var_categoria, vars_valor)
  if (!is.null(var_n)) cols_sel <- c(cols_sel, var_n)

  df_long <- data |>
    dplyr::select(dplyr::all_of(cols_sel)) |>
    tidyr::pivot_longer(
      cols      = dplyr::all_of(vars_valor),
      names_to  = ".col_val",
      values_to = ".valor"
    )

  if (!is.numeric(df_long$.valor)) stop("Las columnas de `vars_valor` deben ser numericas.", call. = FALSE)

  df_long$.serie <- dplyr::recode(df_long$.col_val, !!!etiquetas_series)
  serie_lvls <- unname(etiquetas_series)
  if (invertir_series) serie_lvls <- rev(serie_lvls)
  df_long$.serie <- factor(df_long$.serie, levels = serie_lvls)

  # orden categorias
  cat_vec  <- df_long[[var_categoria]]
  cat_lvls <- unique(cat_vec)
  if (!identical(orden_categorias, "original")) {
    cat_rank <- df_long |>
      dplyr::group_by(.data[[var_categoria]]) |>
      dplyr::summarise(.nivel = mean(.data$.valor, na.rm = TRUE), .groups = "drop")
    cat_rank[[var_categoria]] <- as.character(cat_rank[[var_categoria]])
    if (identical(orden_categorias, "menor_mayor")) {
      cat_rank <- dplyr::arrange(cat_rank, .data$.nivel, .data[[var_categoria]])
    } else {
      cat_rank <- dplyr::arrange(cat_rank, dplyr::desc(.data$.nivel), .data[[var_categoria]])
    }
    cat_lvls <- cat_rank[[var_categoria]]
  }
  if (invertir_barras) cat_lvls <- rev(cat_lvls)
  df_long[[var_categoria]] <- factor(cat_vec, levels = cat_lvls)
  usar_color_categorias <- !is.null(colores_categorias) &&
    length(vars_valor) == 1L &&
    is.null(colores_series)
  if (isTRUE(usar_color_categorias)) {
    df_long$.fill_key <- factor(as.character(df_long[[var_categoria]]), levels = as.character(cat_lvls))
  } else {
    df_long$.fill_key <- df_long$.serie
  }

  max_valor <- max(df_long$.valor, na.rm = TRUE)
  if (!is.finite(max_valor) || max_valor <= 0) max_valor <- 1

  # espacio extra arriba (para etiquetas fuera + N)
  extra_top_mult <- 0.10
  if (isTRUE(mostrar_valores)) extra_top_mult <- max(extra_top_mult, 0.12)
  if (isTRUE(mostrar_n_sobre_barras)) extra_top_mult <- max(extra_top_mult, 0.18)

  y_max <- max_valor * (1 + extra_top_mult)

  # ---------------------------------------------------------------------------
  # 2) Plot base (panel)
  # ---------------------------------------------------------------------------
  # Ancho de grupo y de barra: el grupo ocupa (1 - separacion_grupos) del espacio de
  # cada categoria; cada barra se ajusta para caber sin solaparse dentro del grupo.
  sep_grupos   <- .dim_clamp(suppressWarnings(as.numeric(separacion_grupos)[1]), 0, 0.60)
  if (!is.finite(sep_grupos)) sep_grupos <- 0.20
  grupo_ancho  <- 1.0 - sep_grupos
  bar_w_eff    <- ancho_barras   # grosor de cada barra; dodge controla el espaciado entre grupos

  p <- ggplot2::ggplot(
    df_long,
    ggplot2::aes(x = .data[[var_categoria]], y = .data$.valor, fill = .data$.fill_key)
  ) +
    ggplot2::geom_col(
      position = ggplot2::position_dodge(width = grupo_ancho),
      width    = bar_w_eff
    ) +
    ggplot2::scale_y_continuous(
      limits = c(0, y_max),
      expand = ggplot2::expansion(mult = c(0, 0.02))
    )

  # ---------------------------------------------------------------------------
  # 3) Etiquetas de VALOR (dentro/afuera)
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_valores)) {

    if (!requireNamespace("scales", quietly = TRUE)) {
      stop("Para etiquetas numericas se requiere 'scales'.", call. = FALSE)
    }

    df_lab <- df_long

    if (formato_valor == "numero") {
      df_lab$lab <- scales::number(
        df_lab$.valor,
        accuracy     = 10^(-decimales),
        big.mark     = separador_miles,
        decimal.mark = separador_decimales
      )
    } else {
      df_lab$lab <- paste0(
        simbolo_moneda, " ",
        scales::number(
          df_lab$.valor,
          accuracy     = 10^(-decimales),
          big.mark     = separador_miles,
          decimal.mark = separador_decimales
        )
      )
    }

    df_lab$mostrar <- df_lab$.valor >= umbral_etiqueta
    df_in  <- df_lab[df_lab$mostrar & df_lab$.valor >= umbral_interno, , drop = FALSE]
    df_out <- df_lab[df_lab$mostrar & df_lab$.valor <  umbral_interno, , drop = FALSE]

    if (orientacion == "vertical") {

      if (nrow(df_in) > 0) {
        p <- p +
          ggplot2::geom_text(
            data        = df_in,
            mapping     = ggplot2::aes(
              x     = .data[[var_categoria]],
              y     = .data$.valor / 2,
              label = .data$lab,
              group = .data$.serie
            ),
            inherit.aes = FALSE,
            position    = ggplot2::position_dodge(width = grupo_ancho),
            vjust       = 0.5,
            hjust       = 0.5,
            color       = color_texto_barras_interno,
            size        = size_texto_barras,
            fontface    = if ("valores" %in% textos_negrita) "bold" else "plain",
            show.legend = FALSE
          )
      }

      if (nrow(df_out) > 0) {
        offset <- max_valor * 0.03
        df_out$valor_label <- df_out$.valor + offset

        p <- p +
          ggplot2::geom_text(
            data        = df_out,
            mapping     = ggplot2::aes(
              x     = .data[[var_categoria]],
              y     = .data$valor_label,
              label = .data$lab,
              group = .data$.serie
            ),
            inherit.aes = FALSE,
            position    = ggplot2::position_dodge(width = grupo_ancho),
            vjust       = 0,
            hjust       = 0.5,
            color       = color_texto_barras_externo,
            size        = size_texto_barras,
            fontface    = if ("valores" %in% textos_negrita) "bold" else "plain",
            show.legend = FALSE
          )
      }

    } else {
      # horizontal
      p <- p + ggplot2::coord_flip()

      if (nrow(df_in) > 0) {
        p <- p +
          ggplot2::geom_text(
            data        = df_in,
            mapping     = ggplot2::aes(
              x     = .data[[var_categoria]],
              y     = .data$.valor / 2,
              label = .data$lab,
              group = .data$.serie
            ),
            inherit.aes = FALSE,
            position    = ggplot2::position_dodge(width = grupo_ancho),
            hjust       = 0.5,
            vjust       = 0.5,
            color       = color_texto_barras_interno,
            size        = size_texto_barras,
            fontface    = if ("valores" %in% textos_negrita) "bold" else "plain",
            show.legend = FALSE
          )
      }

      if (nrow(df_out) > 0) {
        offset <- max_valor * 0.03
        df_out$valor_label <- df_out$.valor + offset

        p <- p +
          ggplot2::geom_text(
            data        = df_out,
            mapping     = ggplot2::aes(
              x     = .data[[var_categoria]],
              y     = .data$valor_label,
              label = .data$lab,
              group = .data$.serie
            ),
            inherit.aes = FALSE,
            position    = ggplot2::position_dodge(width = grupo_ancho),
            hjust       = 0,
            vjust       = 0.5,
            color       = color_texto_barras_externo,
            size        = size_texto_barras,
            fontface    = if ("valores" %in% textos_negrita) "bold" else "plain",
            show.legend = FALSE
          )
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 4) N encima de cada barra (opcional)  -  por serie y categoria
  # ---------------------------------------------------------------------------
  if (isTRUE(mostrar_n_sobre_barras) && !is.null(var_n) && nzchar(var_n) && var_n %in% names(data)) {

    # df base por categoria
    df_n <- data |>
      dplyr::select(dplyr::all_of(c(var_categoria, var_n))) |>
      dplyr::distinct()

    # asegurar niveles iguales al panel
    df_n[[var_categoria]] <- factor(df_n[[var_categoria]], levels = levels(df_long[[var_categoria]]))

    # valor maximo por (categoria, serie) para ubicar N encima de cada barra
    df_top <- df_long |>
      dplyr::group_by(.data[[var_categoria]], .data$.serie) |>
      dplyr::summarise(.valor_max = max(.data$.valor, na.rm = TRUE), .groups = "drop")

    df_top <- df_top |>
      dplyr::left_join(df_n, by = var_categoria) |>
      dplyr::mutate(
        lab_n = paste0(prefijo_n_sobre_barras, format(.data[[var_n]], big.mark = ",", scientific = FALSE)),
        y_n   = .valor_max + (max_valor * 0.06)
      )

    p <- p +
      ggplot2::geom_text(
        data        = df_top,
        mapping     = ggplot2::aes(
          x     = .data[[var_categoria]],
          y     = .data$y_n,
          label = .data$lab_n,
          group = .data$.serie
        ),
        inherit.aes = FALSE,
        position    = ggplot2::position_dodge(width = ancho_barras + 0.1),
        vjust       = 0,
        hjust       = 0.5,
        size        = size_n_sobre_barras,
        color       = color_n_sobre_barras,
        show.legend = FALSE
      )
  }

  # Colores
  if (isTRUE(usar_color_categorias)) {
    p <- p + ggplot2::scale_fill_manual(values = colores_categorias)
  } else if (!is.null(colores_series)) {
    p <- p + ggplot2::scale_fill_manual(values = colores_series)
  }

  # Wrap categorias
  if (!is.null(ancho_max_eje_cat)) {
    if (!requireNamespace("stringr", quietly = TRUE)) {
      stop("Para usar `ancho_max_eje_cat` se requiere 'stringr'.", call. = FALSE)
    }
    if (orientacion == "vertical") {
      p <- p + ggplot2::scale_x_discrete(labels = function(x) stringr::str_wrap(x, width = ancho_max_eje_cat))
    } else {
      # en horizontal, tras coord_flip, el eje de categorias es y
      p <- p + ggplot2::scale_x_discrete(labels = function(x) stringr::str_wrap(x, width = ancho_max_eje_cat))
    }
  }

  # Tema base
  base_theme <- ggplot2::theme_minimal(base_size = 9) +
    ggplot2::theme(
      panel.grid.minor   = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      axis.title.x       = ggplot2::element_blank(),
      axis.title.y       = ggplot2::element_blank(),
      legend.title       = ggplot2::element_blank(),
      legend.position    = if (mostrar_leyenda) legend_pos_gg else "none",
      legend.text        = ggplot2::element_text(
        color = color_leyenda,
        size  = size_leyenda,
        face  = if ("leyenda" %in% textos_negrita) "bold" else "plain"
      ),
      plot.background    = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background   = ggplot2::element_rect(fill = color_fondo, color = NA)
    )

  # Ejes
  if (orientacion == "vertical") {

    eje_y_theme <- ggplot2::theme(
      axis.text.y  = ggplot2::element_text(color = "#7F7F7F", size = size_ejes),
      axis.ticks.y = ggplot2::element_line(color = "#7F7F7F", linewidth = 0.3),
      axis.line.y  = ggplot2::element_line(color = "#7F7F7F", linewidth = 0.4)
    )

    if (!isTRUE(mostrar_eje_y)) {
      eje_y_theme <- ggplot2::theme(
        axis.text.y  = ggplot2::element_blank(),
        axis.ticks.y = ggplot2::element_blank(),
        axis.line.y  = ggplot2::element_blank(),
        axis.title.y = ggplot2::element_blank()
      )
    }

    p <- p +
      base_theme +
      eje_y_theme +
      ggplot2::theme(
        panel.grid.major.y = ggplot2::element_blank(),
        axis.text.x        = ggplot2::element_text(color = color_ejes, size = size_ejes, hjust = 0.5, vjust = 0.5),
        axis.line.x        = ggplot2::element_blank()
      )

  } else {

    # horizontal
    p <- p +
      base_theme +
      ggplot2::theme(
        panel.grid.major.y = ggplot2::element_blank(),
        axis.text.y        = ggplot2::element_text(color = color_ejes, size = size_ejes, hjust = 1, vjust = 0.5),
        axis.line.y        = ggplot2::element_blank(),
        axis.text.x        = ggplot2::element_text(color = "#7F7F7F", size = size_ejes),
        axis.ticks.x       = ggplot2::element_line(color = "#7F7F7F", linewidth = 0.3),
        axis.line.x        = ggplot2::element_line(color = "#7F7F7F", linewidth = 0.4)
      )
  }

  # Leyenda: filas
  n_items_leyenda <- length(levels(df_long$.fill_key))
  n_por_fila_use  <- suppressWarnings(as.integer(legend_n_por_fila)[1])
  n_por_fila_use  <- if (!is.na(n_por_fila_use) && n_por_fila_use >= 1L) n_por_fila_use else 5L
  n_filas_leyenda <- max(1L, ceiling(n_items_leyenda / n_por_fila_use))
  if (mostrar_leyenda) {
    p <- p +
      ggplot2::guides(
        fill = ggplot2::guide_legend(
          nrow      = if (legend_is_side) n_items_leyenda else n_filas_leyenda,
          reverse   = invertir_leyenda,
          keywidth  = grid::unit(legend_key_cm, "cm"),
          keyheight = grid::unit(legend_key_cm, "cm")
        )
      )
  }

  # ---------------------------------------------------------------------------
  # 5) CANVAS (4 placeholders)
  # ---------------------------------------------------------------------------
  p_final <- p

  if (isTRUE(usar_canvas)) {

    if (!requireNamespace("cowplot", quietly = TRUE)) {
      stop("Para `usar_canvas = TRUE` se requiere 'cowplot'.", call. = FALSE)
    }

    # DEBUG overlay con grid::rectGrob (SIEMPRE visible)
    .rect_grob <- function(color = debug_color_borde, lwd = debug_lwd) {
      grid::rectGrob(
        x = 0.5, y = 0.5, width = 1, height = 1,
        gp = grid::gpar(col = color, fill = NA, lwd = lwd)
      )
    }

    .wrap_debug <- function(g) {
      if (!isTRUE(debug_ph_bordes)) return(g)
      cowplot::ggdraw() +
        cowplot::draw_plot(g, 0, 0, 1, 1) +
        cowplot::draw_grob(.rect_grob(), 0, 0, 1, 1)
    }

    # Leyenda aparte
    leg <- NULL
    if (mostrar_leyenda && n_items_leyenda > 0) {
      leg <- cowplot::get_legend(
        p + ggplot2::theme(
          legend.position  = if (legend_is_side) "right" else "bottom",
          legend.direction = if (legend_is_side) "vertical" else "horizontal",
          legend.text      = ggplot2::element_text(
            color  = color_leyenda,
            size   = size_leyenda,
            margin = ggplot2::margin(l = legend_text_gap, r = legend_espaciado, unit = "pt")
          ),
          plot.margin = ggplot2::margin(0, 0, 0, 0)
        )
      )
    }

    # Panel sin leyenda
    p_panel <- p + ggplot2::theme(
      legend.position = "none",
      plot.margin     = ggplot2::margin(6, 6, 6, 6)
    )

    # --- Bloque titulo/subtitulo (CENTRADOS dentro del placeholder, sin solaparse) ---
    x_t <- switch(pos_titulo, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 0.5)
    h_t <- switch(pos_titulo, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 0.5)

    # Centro vertical del placeholder
    y_mid <- 0.50

    # Separacion vertical (relativa al placeholder). 0.16-0.20 suele ir bien.
    title_gap <- 0.18

    # Si no hay subtitulo, el titulo va al centro exacto
    tiene_sub <- !is.null(subtitulo) && nzchar(subtitulo)

    y_title <- if (tiene_sub) y_mid + title_gap/2 else y_mid
    y_sub   <- if (tiene_sub) y_mid - title_gap/2 else y_mid

    title_block <- cowplot::ggdraw() +
      cowplot::theme_nothing() +
      cowplot::draw_label(
        label    = titulo %||% "",
        x        = x_t, y = y_title,
        hjust    = h_t, vjust = 0.5,
        fontface = if ("titulo" %in% textos_negrita) "bold" else "plain",
        size     = size_titulo,
        colour   = color_titulo
      ) +
      cowplot::draw_label(
        label  = subtitulo %||% "",
        x      = x_t, y = y_sub,
        hjust  = h_t, vjust = 0.5,
        size   = size_subtitulo,
        colour = color_subtitulo
      )

    # Caption
    x_c <- switch(pos_nota_pie, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 1)
    h_c <- switch(pos_nota_pie, "izquierda" = 0, "centro" = 0.5, "derecha" = 1, 1)

    caption_block <- cowplot::ggdraw() +
      cowplot::theme_nothing() +
      cowplot::draw_label(
        label  = nota_pie %||% "",
        x      = x_c, y = 0.5,
        hjust  = h_c, vjust = 0.5,
        size   = size_nota_pie,
        colour = color_nota_pie
      )

    legend_block <- if (!is.null(leg)) cowplot::ggdraw(leg) else cowplot::ggdraw() + cowplot::theme_nothing()
    panel_block <- if (!is.null(leg) && legend_is_side) {
      if (identical(leyenda_posicion, "izquierda")) {
        cowplot::plot_grid(.wrap_debug(legend_block), .wrap_debug(p_panel), ncol = 2, rel_widths = c(0.22, 0.78))
      } else {
        cowplot::plot_grid(.wrap_debug(p_panel), .wrap_debug(legend_block), ncol = 2, rel_widths = c(0.78, 0.22))
      }
    } else {
      .wrap_debug(p_panel)
    }

    # Alturas (panel absorbe el resto)
    h_title   <- canvas_h_title
    h_legend  <- if (!is.null(leg) && !legend_is_side) canvas_h_legend else 0.01
    h_caption <- if (!is.null(nota_pie) && nzchar(nota_pie)) canvas_h_caption else 0.01
    h_panel   <- max(0.01, 1 - (h_title + h_legend + h_caption) - canvas_pad_top)

    if (!is.null(leg) && legend_is_top && !legend_is_side) {
      p_final <- cowplot::plot_grid(
        .wrap_debug(title_block),
        .wrap_debug(legend_block),
        panel_block,
        .wrap_debug(caption_block),
        ncol = 1,
        rel_heights = c(h_title, h_legend, h_panel, h_caption)
      )
    } else {
      p_final <- cowplot::plot_grid(
        .wrap_debug(title_block),
        panel_block,
        if (!legend_is_side) .wrap_debug(legend_block) else cowplot::ggdraw() + cowplot::theme_nothing(),
        .wrap_debug(caption_block),
        ncol = 1,
        rel_heights = c(h_title, h_panel, h_legend, h_caption)
      )
    }
  }

  # ---------------------------------------------------------------------------
  # 6) Exportacion (con p_final)
  # ---------------------------------------------------------------------------
  if (exportar == "rplot") return(p_final)

  if (is.null(path_salida) || !nzchar(path_salida)) {
    stop("Debe especificar `path_salida` cuando `exportar` no es 'rplot'.", call. = FALSE)
  }

  n_categorias <- length(unique(df_long[[var_categoria]]))
  alto_por_cat_eff <- alto_por_categoria %||% 0.35
  alto_panel_sug <- max(n_categorias, 1L) * alto_por_cat_eff
  alto_total_sugerido <- max(2.8, min(9.0, alto_panel_sug + 1.0))
  height_plot <- if (!missing(alto) && !is.null(alto)) alto else alto_total_sugerido

  if (exportar == "word") {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para Word se requiere 'officer'.", call. = FALSE)
    doc <- officer::read_docx()
    doc <- officer::body_add_gg(doc, value = p_final, width = ancho, height = height_plot, style = "centered")
    print(doc, target = path_salida)
    return(invisible(p_final))
  }

  if (exportar == "png") {
    ggplot2::ggsave(
      filename = path_salida,
      plot     = p_final,
      width    = ancho,
      height   = height_plot,
      dpi      = dpi,
      bg       = if (is.na(color_fondo)) "transparent" else color_fondo
    )
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
      rvg::dml(ggobj = p_final, bg = "transparent"),
      location = officer::ph_location_fullsize()
    )
    print(doc, target = path_salida)
    return(invisible(p_final))
  }

  p_final
}

#' Graficar histograma, opcionalmente apilado por grupo
#'
#' El modo `porcentaje_bin` hace que cada intervalo sume 100% y muestra la
#' composicion interna del grupo (por ejemplo, hombres/mujeres dentro de cada
#' rango de edad). El modo `porcentaje_total` conserva la distribucion total y
#' reparte cada barra por grupo.
#'
#' @param data Data frame con los datos crudos.
#' @param var Nombre de la variable numerica.
#' @param grupo Variable categorica opcional para apilar dentro de cada bin.
#' @param modo `porcentaje_total`, `porcentaje_bin` o `conteo`.
#' @export
graficar_histograma <- function(
    data,
    var,
    grupo = NULL,
    bins = NULL,
    ancho_bin = NULL,
    limite_inferior = NULL,
    limite_superior = NULL,
    mostrar_bins_vacios = TRUE,
    modo = c("porcentaje_total", "porcentaje_bin", "conteo"),
    cerrar_intervalos = c("izquierda", "derecha"),
    incluir_na_grupo = FALSE,
    etiqueta_sin_grupo = "Sin dato",
    excluir_grupos = NULL,
    orden_grupos = NULL,

    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    mostrar_resumen_grupos_subtitulo = FALSE,
    prefijo_resumen_grupos_subtitulo = NULL,
    separador_resumen_grupos_subtitulo = " · ",

    mostrar_valores = TRUE,
    mostrar_frecuencia = TRUE,
    posicion_etiquetas = c("segmento", "cima", "ninguna"),
    etiqueta_cima_modo = c("conteos_grupo", "conteo_total", "porcentaje_conteos_grupo", "porcentaje_grupo_conteos_grupo"),
    etiqueta_cima_formato = c("lineal", "dos_lineas"),
    etiqueta_cima_orden_grupo = c("frecuencia_porcentaje", "porcentaje_frecuencia"),
    abreviaturas_grupos = NULL,
    separador_etiquetas_cima = "  ",
    color_etiqueta_cima = "#06245C",
    size_etiqueta_cima = 4.2,
    lineheight_etiqueta_cima = 0.88,
    alternar_etiquetas_cima = FALSE,
    desfase_etiquetas_cima = 0.035,
    repeler_etiquetas_cima_x = FALSE,
    desfase_horizontal_etiquetas_cima = 0.18,
    umbral_altura_repel_etiquetas_cima = 0.025,
    decimales = 0,
    umbral_etiqueta = 0.04,
    color_texto_barras = "white",
    size_texto_barras = 4.8,
    textos_negrita = c("valores", "leyenda"),

    colores_grupos = NULL,
    colores_series = NULL,
    mostrar_leyenda = TRUE,
    leyenda_posicion = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),
    legend_n_por_fila = 4,
    legend_key_cm = 0.32,
    legend_espaciado = 0.6,
    legend_text_gap = 0.12,
    size_leyenda = 10,
    color_leyenda = "#06245C",

    ancho_barras = 0.78,
    expand_x = 0.55,
    mostrar_eje_y = TRUE,
    mostrar_eje_x = TRUE,
    wrap_eje_x = 14,
    size_ejes = 9,
    color_ejes = "#06245C",
    expand_y = 0.06,

    font_family = "Arial",
    color_fondo = "transparent",
    color_titulo = "#CA5651",
    color_subtitulo = "#06245C",
    color_nota_pie = "#06245C",
    size_titulo = 12,
    size_subtitulo = 10,
    size_nota_pie = 8,
    pos_y_subtitulo = 0.25,
    pos_titulo = "center",
    pos_nota_pie = "left",

    usar_canvas = TRUE,
    canvas_h_title = 0.12,
    canvas_h_legend = 0.12,
    canvas_h_caption = 0.04,
    canvas_pad_top = 0.01,

    exportar = c("rplot", "png", "ppt", "word"),
    path_salida = NULL,
    ancho = 10,
    alto = NULL,
    dpi = 300
) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  modo <- match.arg(modo)
  cerrar_intervalos <- match.arg(cerrar_intervalos)
  leyenda_posicion <- match.arg(leyenda_posicion)
  exportar <- match.arg(exportar)
  posicion_etiquetas <- match.arg(posicion_etiquetas)
  etiqueta_cima_modo <- match.arg(etiqueta_cima_modo)
  etiqueta_cima_formato <- match.arg(etiqueta_cima_formato)
  etiqueta_cima_orden_grupo <- match.arg(etiqueta_cima_orden_grupo)

  if (!is.data.frame(data)) stop("`data` debe ser un data.frame.", call. = FALSE)
  if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) {
    stop("`var` debe ser character(1) no vacio.", call. = FALSE)
  }
  var <- trimws(var)
  if (!var %in% names(data)) stop("La variable `var` no existe en `data`.", call. = FALSE)

  if (!is.null(grupo)) {
    if (!is.character(grupo) || length(grupo) != 1L || !nzchar(trimws(grupo))) {
      stop("`grupo` debe ser NULL o character(1) no vacio.", call. = FALSE)
    }
    grupo <- trimws(grupo)
    if (!grupo %in% names(data)) stop("La variable `grupo` no existe en `data`.", call. = FALSE)
  }

  x <- suppressWarnings(as.numeric(data[[var]]))
  keep <- is.finite(x)
  if (!any(keep)) stop("`var` no tiene valores numericos finitos.", call. = FALSE)

  d <- data.frame(.x = x[keep], stringsAsFactors = FALSE)
  if (is.null(grupo)) {
    d$.grupo <- "Total"
    niveles_grupo <- "Total"
    mostrar_leyenda <- FALSE
  } else {
    g_raw <- data[[grupo]][keep]
    if (is.factor(g_raw)) {
      niveles_grupo <- levels(g_raw)
      g <- as.character(g_raw)
    } else {
      g <- as.character(g_raw)
      niveles_grupo <- unique(g[!is.na(g) & nzchar(trimws(g))])
    }
    if (isTRUE(incluir_na_grupo)) {
      g[is.na(g) | !nzchar(trimws(g))] <- etiqueta_sin_grupo
      niveles_grupo <- unique(c(niveles_grupo, etiqueta_sin_grupo))
    } else {
      ok_g <- !is.na(g) & nzchar(trimws(g))
      d <- d[ok_g, , drop = FALSE]
      g <- g[ok_g]
      niveles_grupo <- unique(g)
    }
    if (!nrow(d)) stop("No hay casos validos despues de filtrar `grupo`.", call. = FALSE)
    niveles_grupo <- niveles_grupo[!is.na(niveles_grupo) & nzchar(trimws(niveles_grupo))]
    d$.grupo <- g
  }

  if (!is.null(excluir_grupos) && length(excluir_grupos)) {
    .norm_group <- function(z) {
      z <- iconv(as.character(z), from = "", to = "ASCII//TRANSLIT")
      z <- tolower(z)
      z <- gsub("[^a-z0-9]+", " ", z)
      trimws(gsub("\\s+", " ", z))
    }
    excl_norm <- .norm_group(excluir_grupos)
    keep_group <- !(.norm_group(d$.grupo) %in% excl_norm)
    d <- d[keep_group, , drop = FALSE]
    niveles_grupo <- niveles_grupo[!(.norm_group(niveles_grupo) %in% excl_norm)]
    if (!nrow(d)) stop("No hay casos validos despues de excluir grupos.", call. = FALSE)
  }
  if (!is.null(orden_grupos) && length(orden_grupos)) {
    orden_grupos <- as.character(unlist(orden_grupos, use.names = FALSE))
    orden_grupos <- orden_grupos[!is.na(orden_grupos) & nzchar(trimws(orden_grupos))]
    if (length(orden_grupos)) {
      niveles_grupo <- unique(c(orden_grupos[orden_grupos %in% niveles_grupo], setdiff(niveles_grupo, orden_grupos)))
    }
  }

  lo <- as.numeric(limite_inferior %||% floor(min(d$.x, na.rm = TRUE)))
  hi <- as.numeric(limite_superior %||% ceiling(max(d$.x, na.rm = TRUE)))
  if (!is.finite(lo) || !is.finite(hi)) stop("Limites no finitos para el histograma.", call. = FALSE)
  if (hi <= lo) hi <- lo + 1

  if (!is.null(ancho_bin)) {
    ancho_bin <- as.numeric(ancho_bin)
    if (!is.finite(ancho_bin) || ancho_bin <= 0) {
      stop("`ancho_bin` debe ser numerico positivo.", call. = FALSE)
    }
    breaks <- seq(lo, hi, by = ancho_bin)
    if (tail(breaks, 1) <= max(d$.x, na.rm = TRUE)) {
      breaks <- c(breaks, tail(breaks, 1) + ancho_bin)
    }
  } else {
    bins <- as.integer(bins %||% 8L)
    if (!is.finite(bins) || bins < 1L) bins <- 8L
    breaks <- seq(lo, hi, length.out = bins + 1L)
  }
  breaks <- unique(breaks)
  if (length(breaks) < 2L) stop("No se pudieron construir intervalos para el histograma.", call. = FALSE)

  .fmt_num <- function(z) {
    z <- as.numeric(z)
    ifelse(abs(z - round(z)) < 1e-8, as.character(round(z)), format(round(z, 2), trim = TRUE))
  }
  right <- identical(cerrar_intervalos, "derecha")
  lefts <- breaks[-length(breaks)]
  rights <- breaks[-1]
  step_med <- stats::median(diff(breaks), na.rm = TRUE)
  entero <- all(abs(c(lefts, rights, step_med) - round(c(lefts, rights, step_med))) < 1e-8)
  if (!right && entero && step_med >= 1) {
    labels <- ifelse(round(rights - 1) <= round(lefts),
                     .fmt_num(lefts),
                     paste0(.fmt_num(lefts), "-", .fmt_num(rights - 1)))
  } else {
    labels <- paste0(.fmt_num(lefts), "-", .fmt_num(rights))
  }

  breaks_cut <- breaks
  if (!right) {
    breaks_cut[length(breaks_cut)] <- breaks_cut[length(breaks_cut)] + max(1e-9, abs(tail(breaks, 1)) * 1e-9)
  }
  d$.bin <- cut(
    d$.x,
    breaks = breaks_cut,
    labels = labels,
    right = right,
    include.lowest = TRUE,
    ordered_result = TRUE
  )
  d <- d[!is.na(d$.bin), , drop = FALSE]
  if (!nrow(d)) stop("No hay casos dentro de los intervalos del histograma.", call. = FALSE)

  niveles_grupo <- niveles_grupo %||% unique(d$.grupo)
  niveles_grupo <- unique(niveles_grupo[!is.na(niveles_grupo) & nzchar(trimws(niveles_grupo))])
  if (!length(niveles_grupo)) niveles_grupo <- unique(as.character(d$.grupo))

  tab <- as.data.frame(
    table(
      .bin = factor(as.character(d$.bin), levels = labels),
      .grupo = factor(as.character(d$.grupo), levels = niveles_grupo),
      useNA = "no"
    ),
    stringsAsFactors = FALSE
  )
  names(tab)[names(tab) == "Freq"] <- "n"
  tab$n <- as.integer(tab$n)
  tab$.bin <- factor(tab$.bin, levels = labels, ordered = TRUE)
  tab$.grupo <- factor(tab$.grupo, levels = niveles_grupo)

  tab$n_bin <- ave(tab$n, tab$.bin, FUN = sum)
  if (!isTRUE(mostrar_bins_vacios)) {
    bins_con_datos <- unique(as.character(tab$.bin[tab$n_bin > 0]))
    labels <- labels[labels %in% bins_con_datos]
    tab <- tab[as.character(tab$.bin) %in% labels, , drop = FALSE]
    tab$.bin <- factor(as.character(tab$.bin), levels = labels, ordered = TRUE)
    if (!nrow(tab)) stop("No hay intervalos con datos para mostrar.", call. = FALSE)
  }
  n_total <- sum(tab$n, na.rm = TRUE)
  tab$pct_total <- if (n_total > 0) tab$n / n_total else 0
  tab$pct_bin <- ifelse(tab$n_bin > 0, tab$n / tab$n_bin, 0)
  tab$.valor <- switch(
    modo,
    porcentaje_total = tab$pct_total,
    porcentaje_bin   = tab$pct_bin,
    conteo           = tab$n
  )
  tab$.bin_label <- as.character(tab$.bin)
  tab$.grupo_label <- as.character(tab$.grupo)

  if (!is.null(colores_series) && is.null(colores_grupos)) colores_grupos <- colores_series
  if (is.null(colores_grupos) || !length(colores_grupos)) {
    colores_grupos <- c("#06245C", "#9EC3E6", "#CA5651", "#70AD47", "#FFD966", "#7B5EA7")
  }
  colores_grupos <- unlist(colores_grupos, use.names = TRUE)
  if (is.null(names(colores_grupos)) || any(!nzchar(names(colores_grupos)))) {
    colores_grupos <- stats::setNames(rep(colores_grupos, length.out = length(niveles_grupo)), niveles_grupo)
  } else {
    faltantes <- setdiff(niveles_grupo, names(colores_grupos))
    if (length(faltantes)) {
      extra <- rep(unname(colores_grupos), length.out = length(faltantes))
      colores_grupos <- c(colores_grupos, stats::setNames(extra, faltantes))
    }
    colores_grupos <- colores_grupos[niveles_grupo]
  }
  legend_text_gap_pt <- max(0, as.numeric(legend_text_gap %||% 0.12)) * 28.35
  legend_item_gap_pt <- max(0, as.numeric(legend_espaciado %||% 0.6)) * 28.35

  accuracy <- if (decimales <= 0) 1 else 10^-decimales
  resumen_grupos_subtitulo <- NULL
  if (isTRUE(mostrar_resumen_grupos_subtitulo) && !is.null(grupo)) {
    n_grupo <- stats::aggregate(n ~ .grupo_label, tab, sum, na.rm = TRUE)
    n_grupo <- n_grupo[n_grupo$n > 0, , drop = FALSE]
    if (nrow(n_grupo)) {
      n_grupo$.orden <- match(as.character(n_grupo$.grupo_label), niveles_grupo)
      n_grupo <- n_grupo[order(n_grupo$.orden, na.last = TRUE), , drop = FALSE]
      total_grupo <- sum(n_grupo$n, na.rm = TRUE)
      if (is.finite(total_grupo) && total_grupo > 0) {
        partes <- paste0(
          as.character(n_grupo$.grupo_label),
          " ",
          scales::percent(n_grupo$n / total_grupo, accuracy = accuracy)
        )
        sep_resumen <- as.character(separador_resumen_grupos_subtitulo %||% " · ")
        if (!length(sep_resumen) || is.na(sep_resumen)) sep_resumen <- " · "
        pref_resumen <- as.character(prefijo_resumen_grupos_subtitulo %||% "")
        if (!length(pref_resumen) || is.na(pref_resumen)) pref_resumen <- ""
        resumen_grupos_subtitulo <- paste0(pref_resumen, paste(partes, collapse = sep_resumen))
      }
    }
  }
  subtitulo_efectivo <- subtitulo
  if (!is.null(resumen_grupos_subtitulo) && nzchar(trimws(resumen_grupos_subtitulo))) {
    subtitulo_efectivo <- if (!is.null(subtitulo) && nzchar(trimws(subtitulo))) {
      paste(subtitulo, resumen_grupos_subtitulo, sep = "\n")
    } else {
      resumen_grupos_subtitulo
    }
  }

  pct_label <- scales::percent(if (identical(modo, "conteo")) tab$pct_total else tab$.valor, accuracy = accuracy)
  tab$.label <- if (identical(modo, "conteo")) {
    as.character(tab$n)
  } else if (isTRUE(mostrar_frecuencia)) {
    paste0(pct_label, " (", tab$n, ")")
  } else {
    pct_label
  }
  lab_data <- tab[tab$n > 0 & tab$.valor >= as.numeric(umbral_etiqueta %||% 0), , drop = FALSE]

  .grupo_abbr <- function(niveles, abbr = NULL) {
    niveles <- as.character(niveles)
    if (!is.null(abbr) && length(abbr)) {
      abbr <- unlist(abbr, use.names = TRUE)
      if (!is.null(names(abbr)) && any(nzchar(names(abbr)))) {
        out <- unname(abbr[niveles])
        miss <- is.na(out) | !nzchar(out)
        if (any(miss)) out[miss] <- niveles[miss]
      } else {
        out <- rep(as.character(abbr), length.out = length(niveles))
      }
    } else {
      out <- toupper(substr(trimws(niveles), 1L, 1L))
      out[!nzchar(out)] <- "G"
    }
    out
  }

  top_data <- NULL
  if (isTRUE(mostrar_valores) && identical(posicion_etiquetas, "cima")) {
    agg_val <- stats::aggregate(.valor ~ .bin + .bin_label, tab, sum, na.rm = TRUE)
    agg_n <- stats::aggregate(n ~ .bin + .bin_label, tab, sum, na.rm = TRUE)
    names(agg_n)[names(agg_n) == "n"] <- "n_bin_total"
    top_data <- merge(agg_val, agg_n, by = c(".bin", ".bin_label"), all.x = TRUE, sort = FALSE)
    top_data <- top_data[top_data$n_bin_total > 0, , drop = FALSE]
    top_data <- top_data[top_data$.valor >= as.numeric(umbral_etiqueta %||% 0), , drop = FALSE]
    if (nrow(top_data)) {
      if (identical(etiqueta_cima_modo, "conteo_total") || is.null(grupo)) {
        top_data$.label_top <- as.character(top_data$n_bin_total)
      } else {
        abbr <- stats::setNames(.grupo_abbr(niveles_grupo, abreviaturas_grupos), niveles_grupo)
        .rows_for_bin <- function(bin_i) {
          rows <- tab[as.character(tab$.bin) == bin_i & tab$n > 0, , drop = FALSE]
          rows <- rows[match(intersect(niveles_grupo, as.character(rows$.grupo)), as.character(rows$.grupo)), , drop = FALSE]
          rows
        }
        .counts_for_bin <- function(bin_i) {
          rows <- .rows_for_bin(bin_i)
          if (!nrow(rows)) return("")
          paste0(unname(abbr[as.character(rows$.grupo)]), " ", rows$n, collapse = separador_etiquetas_cima)
        }
        .group_pct_counts_for_bin <- function(bin_i) {
          rows <- .rows_for_bin(bin_i)
          if (!nrow(rows)) return("")
          n_bin <- sum(rows$n, na.rm = TRUE)
          if (!is.finite(n_bin) || n_bin <= 0) return("")
          pct_rows <- scales::percent(rows$n / n_bin, accuracy = accuracy)
          partes <- if (identical(etiqueta_cima_orden_grupo, "porcentaje_frecuencia")) {
            paste0(
              unname(abbr[as.character(rows$.grupo)]),
              " ",
              pct_rows,
              "(",
              rows$n,
              ")"
            )
          } else {
            paste0(
              unname(abbr[as.character(rows$.grupo)]),
              " ",
              rows$n,
              "(",
              pct_rows,
              ")"
            )
          }
          paste(partes, collapse = if (identical(etiqueta_cima_formato, "dos_lineas")) "\n" else separador_etiquetas_cima)
        }
        conteos_grupo <- vapply(as.character(top_data$.bin), .counts_for_bin, character(1))
        if (identical(etiqueta_cima_modo, "porcentaje_grupo_conteos_grupo")) {
          top_data$.label_top <- vapply(as.character(top_data$.bin), .group_pct_counts_for_bin, character(1))
        } else if (identical(etiqueta_cima_modo, "porcentaje_conteos_grupo")) {
          pct_top <- if (identical(modo, "conteo")) {
            if (n_total > 0) top_data$n_bin_total / n_total else 0
          } else {
            top_data$.valor
          }
          pct_n_label <- paste0(
            scales::percent(pct_top, accuracy = accuracy),
            " (", top_data$n_bin_total, ")"
          )
          top_data$.label_top <- if (identical(etiqueta_cima_formato, "dos_lineas")) {
            paste0(pct_n_label, "\n", conteos_grupo)
          } else {
            paste0(pct_n_label, " · ", conteos_grupo)
          }
        } else {
          top_data$.label_top <- conteos_grupo
        }
      }
      top_data <- top_data[nzchar(top_data$.label_top), , drop = FALSE]
    }
  }

  y_lab <- switch(
    modo,
    porcentaje_total = "Porcentaje del total",
    porcentaje_bin = "Proporcion dentro del intervalo",
    conteo = "Frecuencia"
  )
  y_max <- if (identical(modo, "porcentaje_bin")) 1 else max(stats::aggregate(.valor ~ .bin, tab, sum)$.valor, na.rm = TRUE)
  if (!is.finite(y_max) || y_max <= 0) y_max <- 1

  if (!is.null(top_data) && nrow(top_data)) {
    top_data$.label_y <- top_data$.valor
    top_data$.label_x_nudge <- 0
    if (isTRUE(alternar_etiquetas_cima)) {
      desfase_etiquetas_cima <- suppressWarnings(as.numeric(desfase_etiquetas_cima %||% 0.035))
      if (!is.finite(desfase_etiquetas_cima) || desfase_etiquetas_cima < 0) {
        desfase_etiquetas_cima <- 0.035
      }
      bin_idx <- match(as.character(top_data$.bin), levels(tab$.bin))
      top_data$.label_y <- top_data$.label_y + (bin_idx %% 2L) * y_max * desfase_etiquetas_cima
    }
    if (isTRUE(repeler_etiquetas_cima_x)) {
      dx <- suppressWarnings(as.numeric(desfase_horizontal_etiquetas_cima %||% 0.18))
      if (!is.finite(dx) || dx < 0) dx <- 0.18
      dy_threshold <- suppressWarnings(as.numeric(umbral_altura_repel_etiquetas_cima %||% 0.025))
      if (!is.finite(dy_threshold) || dy_threshold < 0) dy_threshold <- 0.025
      bin_idx <- match(as.character(top_data$.bin), levels(tab$.bin))
      ord <- order(bin_idx)
      for (ii in seq_len(max(0L, length(ord) - 1L))) {
        i <- ord[[ii]]
        j <- ord[[ii + 1L]]
        if (!is.finite(bin_idx[[i]]) || !is.finite(bin_idx[[j]])) next
        adjacent <- abs(bin_idx[[j]] - bin_idx[[i]]) <= 1
        same_height <- abs(top_data$.label_y[[j]] - top_data$.label_y[[i]]) <= y_max * dy_threshold
        if (!adjacent || !same_height) next
        if (abs(top_data$.label_x_nudge[[i]]) < 1e-8) top_data$.label_x_nudge[[i]] <- -dx
        if (abs(top_data$.label_x_nudge[[j]]) < 1e-8) top_data$.label_x_nudge[[j]] <- dx
      }
    }
  }

  expand_y_eff <- as.numeric(expand_y %||% 0.06)
  if (!is.finite(expand_y_eff) || expand_y_eff < 0) expand_y_eff <- 0.06
  if (identical(posicion_etiquetas, "cima") && !is.null(top_data) && nrow(top_data)) {
    expand_y_eff <- max(expand_y_eff, 0.18)
  }

  p <- ggplot2::ggplot(tab, ggplot2::aes(x = .data$.bin, y = .data$.valor, fill = .data$.grupo)) +
    ggplot2::geom_col(width = ancho_barras, color = NA) +
    ggplot2::scale_fill_manual(values = colores_grupos, drop = FALSE) +
    ggplot2::labs(x = NULL, y = y_lab, fill = NULL) +
    ggplot2::coord_cartesian(ylim = c(0, y_max * (1 + expand_y_eff)), clip = "off") +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.minor = ggplot2::element_blank(),
      axis.title.y = if (isTRUE(mostrar_eje_y)) ggplot2::element_text(color = color_ejes, size = size_ejes) else ggplot2::element_blank(),
      axis.text.y = if (isTRUE(mostrar_eje_y)) ggplot2::element_text(color = color_ejes, size = size_ejes) else ggplot2::element_blank(),
      axis.text.x = if (isTRUE(mostrar_eje_x)) ggplot2::element_text(color = color_ejes, size = size_ejes, face = if ("eje_x" %in% textos_negrita || "ejes" %in% textos_negrita) "bold" else "plain") else ggplot2::element_blank(),
      axis.ticks = ggplot2::element_blank(),
      legend.position = if (isTRUE(mostrar_leyenda) && !identical(leyenda_posicion, "ninguna")) leyenda_posicion else "none",
      legend.text = ggplot2::element_text(
        color = color_leyenda,
        size = size_leyenda,
        face = if ("leyenda" %in% textos_negrita) "bold" else "plain",
        margin = ggplot2::margin(l = legend_text_gap_pt, r = legend_item_gap_pt, unit = "pt")
      ),
      legend.key.size = grid::unit(legend_key_cm, "cm"),
      plot.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.margin = ggplot2::margin(2, 8, 2, 8)
    ) +
    ggplot2::guides(fill = ggplot2::guide_legend(
      nrow = if (leyenda_posicion %in% c("abajo", "arriba")) ceiling(length(niveles_grupo) / max(1, legend_n_por_fila)) else NULL,
      byrow = TRUE,
      override.aes = list(size = legend_key_cm * 7)
    ))

  if (identical(modo, "conteo")) {
    p <- p + ggplot2::scale_y_continuous(labels = scales::comma)
  } else {
    p <- p + ggplot2::scale_y_continuous(labels = scales::percent_format(accuracy = accuracy))
  }
  expand_x <- suppressWarnings(as.numeric(expand_x %||% 0.55))
  if (!is.finite(expand_x) || expand_x < 0) expand_x <- 0.55
  if (wrap_eje_x > 0) {
    p <- p + ggplot2::scale_x_discrete(
      labels = function(z) stringr::str_wrap(z, width = wrap_eje_x),
      expand = ggplot2::expansion(add = expand_x)
    )
  } else {
    p <- p + ggplot2::scale_x_discrete(expand = ggplot2::expansion(add = expand_x))
  }
  if (isTRUE(mostrar_valores) && identical(posicion_etiquetas, "segmento") && nrow(lab_data)) {
    p <- p + ggplot2::geom_text(
      data = lab_data,
      ggplot2::aes(label = .data$.label),
      position = ggplot2::position_stack(vjust = 0.5),
      color = color_texto_barras,
      size = size_texto_barras,
      family = font_family,
      fontface = if ("valores" %in% textos_negrita) "bold" else "plain",
      show.legend = FALSE
    )
  }
  if (isTRUE(mostrar_valores) && identical(posicion_etiquetas, "cima") && !is.null(top_data) && nrow(top_data)) {
    pos_top <- if (any(abs(top_data$.label_x_nudge %||% 0) > 1e-8)) {
      ggplot2::position_nudge(x = top_data$.label_x_nudge)
    } else {
      "identity"
    }
    p <- p + ggplot2::geom_text(
      data = top_data,
      ggplot2::aes(x = .data$.bin, y = .data$.label_y, label = .data$.label_top),
      inherit.aes = FALSE,
      position = pos_top,
      vjust = -0.35,
      color = color_etiqueta_cima,
      size = size_etiqueta_cima,
      lineheight = lineheight_etiqueta_cima,
      family = font_family,
      fontface = if ("valores" %in% textos_negrita) "bold" else "plain",
      show.legend = FALSE
    )
  }

  p_final <- p
  if (isTRUE(usar_canvas)) {
    align <- switch(pos_titulo, left = 0, right = 1, center = 0.5, 0.5)
    pos_y_subtitulo <- suppressWarnings(as.numeric(pos_y_subtitulo %||% 0.25))
    if (!is.finite(pos_y_subtitulo)) pos_y_subtitulo <- 0.25
    pos_y_subtitulo <- max(0.05, min(0.55, pos_y_subtitulo))
    title_block <- cowplot::ggdraw() +
      cowplot::draw_label(titulo %||% "", x = align, hjust = align, y = 0.70,
                          color = color_titulo, fontfamily = font_family,
                          fontface = if ("titulo" %in% textos_negrita) "bold" else "bold",
                          size = size_titulo) +
      cowplot::draw_label(subtitulo_efectivo %||% "", x = align, hjust = align, y = pos_y_subtitulo,
                          color = color_subtitulo, fontfamily = font_family,
                          fontface = if ("subtitulo" %in% textos_negrita) "bold" else "plain",
                          size = size_subtitulo)
    panel_block <- p + ggplot2::theme(legend.position = "none")
    legend_block <- NULL
    if (isTRUE(mostrar_leyenda) && !identical(leyenda_posicion, "ninguna") && !is.null(grupo)) {
      legend_block <- cowplot::get_legend(
        p + ggplot2::theme(
          legend.position = if (leyenda_posicion %in% c("arriba", "abajo")) "bottom" else "right",
          legend.box.spacing = grid::unit(legend_text_gap, "cm"),
          legend.spacing.x = grid::unit(legend_text_gap, "cm")
        )
      )
    }
    caption_align <- switch(pos_nota_pie, right = 1, center = 0.5, left = 0, 0)
    caption_block <- cowplot::ggdraw() +
      cowplot::draw_label(nota_pie %||% "", x = caption_align, hjust = caption_align, y = 0.5,
                          color = color_nota_pie, fontfamily = font_family,
                          fontface = if ("nota_pie" %in% textos_negrita) "bold" else "plain",
                          size = size_nota_pie)

    h_title <- canvas_h_title
    h_legend <- if (!is.null(legend_block) && leyenda_posicion %in% c("arriba", "abajo")) canvas_h_legend else 0.01
    h_caption <- if (!is.null(nota_pie) && nzchar(nota_pie)) canvas_h_caption else 0.01
    h_panel <- max(0.01, 1 - (h_title + h_legend + h_caption) - canvas_pad_top)
    if (!is.null(legend_block) && identical(leyenda_posicion, "arriba")) {
      p_final <- cowplot::plot_grid(title_block, legend_block, panel_block, caption_block, ncol = 1,
                                    rel_heights = c(h_title, h_legend, h_panel, h_caption))
    } else {
      p_final <- cowplot::plot_grid(title_block, panel_block, legend_block %||% cowplot::ggdraw(), caption_block, ncol = 1,
                                    rel_heights = c(h_title, h_panel, h_legend, h_caption))
    }
  }

  attr(p_final, "pulso_histograma_data") <- tab
  attr(p_final, "pulso_histograma_top_labels") <- if (!is.null(top_data) && nrow(top_data)) {
    as.character(top_data$.label_top)
  } else {
    character()
  }
  attr(p_final, "pulso_histograma_subtitulo") <- subtitulo_efectivo %||% ""
  attr(p_final, "pulso_histograma_resumen_grupos") <- resumen_grupos_subtitulo %||% ""

  if (exportar == "rplot") return(p_final)
  if (is.null(path_salida) || !nzchar(path_salida)) {
    stop("Debe especificar `path_salida` cuando `exportar` no es 'rplot'.", call. = FALSE)
  }
  height_plot <- as.numeric(alto %||% 4.8)
  if (!is.finite(height_plot) || height_plot <= 0) height_plot <- 4.8
  if (exportar == "word") {
    if (!requireNamespace("officer", quietly = TRUE)) stop("Para Word se requiere 'officer'.", call. = FALSE)
    doc <- officer::read_docx()
    doc <- officer::body_add_gg(doc, value = p_final, width = ancho, height = height_plot, style = "centered")
    print(doc, target = path_salida)
    return(invisible(p_final))
  }
  if (exportar == "png") {
    ggplot2::ggsave(path_salida, plot = p_final, width = ancho, height = height_plot, dpi = dpi,
                    bg = if (is.na(color_fondo)) "transparent" else color_fondo)
    return(invisible(p_final))
  }
  if (exportar == "ppt") {
    if (!requireNamespace("officer", quietly = TRUE) || !requireNamespace("rvg", quietly = TRUE)) {
      stop("Para PPT se requieren 'officer' y 'rvg'.", call. = FALSE)
    }
    doc <- officer::read_pptx()
    doc <- officer::add_slide(doc, layout = "Blank", master = "Office Theme")
    doc <- officer::ph_with(doc, rvg::dml(ggobj = p_final, bg = "transparent"), location = officer::ph_location_fullsize())
    print(doc, target = path_salida)
    return(invisible(p_final))
  }

  p_final
}
