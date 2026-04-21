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
    ggplot2::aes_string(x = var_categoria, y = ".valor", fill = ".serie")
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
            mapping     = ggplot2::aes_string(
              x     = var_categoria,
              y     = ".valor / 2",
              label = "lab",
              group = ".serie"
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
            mapping     = ggplot2::aes_string(
              x     = var_categoria,
              y     = "valor_label",
              label = "lab",
              group = ".serie"
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
            mapping     = ggplot2::aes_string(
              x     = var_categoria,
              y     = ".valor / 2",
              label = "lab",
              group = ".serie"
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
            mapping     = ggplot2::aes_string(
              x     = var_categoria,
              y     = "valor_label",
              label = "lab",
              group = ".serie"
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
        mapping     = ggplot2::aes_string(
          x     = var_categoria,
          y     = "y_n",
          label = "lab_n",
          group = ".serie"
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
  if (!is.null(colores_series)) {
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
      legend.position    = if (mostrar_leyenda) "bottom" else "none",
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
  n_items_leyenda <- length(levels(df_long$.serie))
  n_por_fila_use  <- suppressWarnings(as.integer(legend_n_por_fila)[1])
  n_por_fila_use  <- if (!is.na(n_por_fila_use) && n_por_fila_use >= 1L) n_por_fila_use else 5L
  n_filas_leyenda <- max(1L, ceiling(n_items_leyenda / n_por_fila_use))
  if (mostrar_leyenda) {
    p <- p +
      ggplot2::guides(
        fill = ggplot2::guide_legend(
          nrow      = n_filas_leyenda,
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
          legend.position  = "bottom",
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

    # Alturas (panel absorbe el resto)
    h_title   <- canvas_h_title
    h_legend  <- if (!is.null(leg)) canvas_h_legend else 0.01
    h_caption <- if (!is.null(nota_pie) && nzchar(nota_pie)) canvas_h_caption else 0.01
    h_panel   <- max(0.01, 1 - (h_title + h_legend + h_caption) - canvas_pad_top)

    p_final <- cowplot::plot_grid(
      .wrap_debug(title_block),
      .wrap_debug(p_panel),
      .wrap_debug(legend_block),
      .wrap_debug(caption_block),
      ncol = 1,
      rel_heights = c(h_title, h_panel, h_legend, h_caption)
    )
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
