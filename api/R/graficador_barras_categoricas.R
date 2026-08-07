.barras_categoricas_as_name <- function(x, arg) {
  if (!is.character(x) || length(x) != 1L || !nzchar(trimws(x))) {
    stop("`", arg, "` debe ser character(1) no vacio.", call. = FALSE)
  }
  trimws(x)
}

.barras_categoricas_sentence_case <- function(x) {
  unname(vapply(
    as.character(x),
    function(s) {
      if (is.na(s)) return(NA_character_)
      s <- trimws(gsub("\\s+", " ", s, perl = TRUE))
      if (!nzchar(s)) return(s)
      chars <- strsplit(tolower(s), "", fixed = FALSE, useBytes = FALSE)[[1]]
      idx <- which(grepl("[[:alpha:]]", chars))[1]
      if (length(idx) && is.finite(idx) && !is.na(idx)) {
        chars[[idx]] <- toupper(chars[[idx]])
      }
      paste0(chars, collapse = "")
    },
    character(1)
  ))
}

.barras_categoricas_normalizar <- function(x, modo = "ninguna") {
  modo <- as.character(modo %||% "ninguna")[1]
  modo <- tolower(trimws(gsub("[ -]+", "_", modo)))
  if (modo %in% c("capital_inicial", "sentence_case", "oracion", "oración")) {
    modo <- "mayuscula_inicial"
  }
  if (!modo %in% c("ninguna", "mayuscula_inicial")) modo <- "ninguna"
  if (identical(modo, "mayuscula_inicial")) .barras_categoricas_sentence_case(x) else x
}

.barras_categoricas_format_num <- function(x, decimales = 0) {
  x <- suppressWarnings(as.numeric(x))
  if (!length(x)) return(character(0))
  decimales <- suppressWarnings(as.integer(decimales)[1])
  if (!is.finite(decimales) || decimales < 0) decimales <- 0L
  out <- format(
    round(x, decimales),
    nsmall = decimales,
    big.mark = ",",
    scientific = FALSE,
    trim = TRUE
  )
  if (decimales == 0L) out <- sub("\\.0+$", "", out)
  out
}

.barras_categoricas_format_pct <- function(x, decimales = 0) {
  paste0(.barras_categoricas_format_num(100 * suppressWarnings(as.numeric(x)), decimales), "%")
}

.barras_categoricas_palette <- function(n) {
  pal <- c(
    "#CA5651", "#EFD25E", "#85BB85", "#70AD47", "#7594CC",
    "#9688D3", "#E4A34C", "#BFBFBF", "#081F5C", "#D8D8D8"
  )
  rep(pal, length.out = max(0L, n))
}

.barras_categoricas_resolve_colors <- function(categorias, colores_categorias = NULL, paleta_colores = NULL) {
  categorias <- as.character(categorias)
  n <- length(categorias)
  if (!is.null(colores_categorias) && length(colores_categorias)) {
    cols <- unlist(colores_categorias, use.names = TRUE)
    if (length(names(cols)) && any(nzchar(names(cols)))) {
      out <- unname(cols[categorias])
      missing <- is.na(out) | !nzchar(out)
      out[missing] <- unname(cols[seq_len(min(sum(missing), length(cols)))])
      if (any(is.na(out) | !nzchar(out))) {
        out[is.na(out) | !nzchar(out)] <- .barras_categoricas_palette(sum(is.na(out) | !nzchar(out)))
      }
      return(out)
    }
    return(rep(unname(cols), length.out = n))
  }
  if (!is.null(paleta_colores) && length(paleta_colores)) {
    return(rep(unname(unlist(paleta_colores, use.names = FALSE)), length.out = n))
  }
  .barras_categoricas_palette(n)
}

.barras_categoricas_make_labels <- function(df, formato_valor, decimales, mostrar_frecuencia) {
  formato_valor <- match.arg(
    as.character(formato_valor %||% "valor")[1],
    c("valor", "n", "porcentaje", "porcentaje_n", "valor_n")
  )
  pct <- df$pct %||% rep(NA_real_, nrow(df))
  n <- df$n %||% rep(NA_real_, nrow(df))
  val <- df$valor %||% rep(NA_real_, nrow(df))
  switch(
    formato_valor,
    valor = .barras_categoricas_format_num(val, decimales),
    n = .barras_categoricas_format_num(n, 0),
    porcentaje = .barras_categoricas_format_pct(pct, decimales),
    porcentaje_n = paste0(.barras_categoricas_format_pct(pct, decimales), " (", .barras_categoricas_format_num(n, 0), ")"),
    valor_n = {
      if (isTRUE(mostrar_frecuencia)) {
        paste0(.barras_categoricas_format_num(val, decimales), " (", .barras_categoricas_format_num(n, 0), ")")
      } else {
        .barras_categoricas_format_num(val, decimales)
      }
    }
  )
}

#' Graficar barras categoricas
#'
#' Motor para graficos con pocas categorias (hasta 10 por defecto), una barra
#' vertical por categoria y un color propio por categoria. Sirve tanto para
#' distribuciones simples como para valores ya agregados, por ejemplo puntajes
#' por nivel de coherencia en objetivos educacionales.
#'
#' @param data `data.frame` con las categorias y, opcionalmente, valores o
#'   frecuencias ya calculadas.
#' @param var_categoria Columna de categorias.
#' @param var_valor Columna numerica a graficar. Si es `NULL`, se usa `var_n`.
#' @param var_n Columna de frecuencia absoluta opcional.
#' @param var_pct Columna de porcentaje/proporcion opcional.
#' @param modo_valor Si no se entrega `var_valor`, define si la altura es
#'   `"conteo"` o `"porcentaje"`.
#' @param max_categorias Maximo de categorias visibles; por defecto 10.
#' @param mostrar_promedio Si `TRUE`, agrega promedio en la nota al pie.
#' @param promedio Valor promedio opcional. Si no se entrega y las categorias
#'   son numericas, se calcula ponderando por `var_n`.
#' @param colores_categorias Vector/lista de colores por categoria. Si tiene
#'   nombres, se matchea por etiqueta visible; si no, se aplica en orden.
#' @param paleta_colores Paleta alternativa para rellenar categorias sin color.
#' @param formato_valor Formato de etiqueta: `valor`, `n`, `porcentaje`,
#'   `porcentaje_n` o `valor_n`.
#' @param exportar `"rplot"` devuelve el grafico; `"png"` lo guarda en disco.
#' @return Objeto `ggplot`.
#' @family graficador
#' @export
graficar_barras_categoricas <- function(
    data,
    var_categoria,
    var_valor                 = NULL,
    var_n                     = NULL,
    var_pct                   = NULL,
    modo_valor                = c("conteo", "porcentaje", "valor"),
    max_categorias            = 10,
    agrupar_resto_en_otros    = FALSE,
    etiqueta_otros            = "Otros",
    orden_barras              = c("instrumento", "mayor_menor", "menor_mayor"),
    normalizar_etiquetas      = c("ninguna", "mayuscula_inicial"),
    colores_categorias        = NULL,
    paleta_colores            = NULL,
    mostrar_valores           = TRUE,
    formato_valor             = c("valor", "n", "porcentaje", "porcentaje_n", "valor_n"),
    mostrar_frecuencia        = FALSE,
    decimales                 = 0,
    eje_y_porcentaje          = NULL,
    titulo                    = NULL,
    subtitulo                 = NULL,
    nota_pie                  = NULL,
    mostrar_promedio          = FALSE,
    promedio                  = NULL,
    promedio_label            = "Promedio",
    promedio_decimales        = 1,
    promedio_maximo           = NULL,
    color_titulo              = "#CA5651",
    color_subtitulo           = "#081F5C",
    color_nota_pie            = "#081F5C",
    color_ejes                = "#081F5C",
    color_texto_barras        = "#081F5C",
    size_titulo               = 16,
    size_subtitulo            = 12,
    size_nota_pie             = 12,
    size_ejes                 = 16,
    size_texto_barras         = 5.6,
    font_family               = "Arial",
    textos_negrita            = c("titulo", "valores", "ejes"),
    grosor_barras             = 0.76,
    limite_y                  = NULL,
    expand_y                  = 0.14,
    mostrar_eje_y             = FALSE,
    mostrar_linea_eje_x       = FALSE,
    mostrar_linea_eje_y       = FALSE,
    mostrar_grid_y            = FALSE,
    ancho_max_eje_x           = 18,
    color_fondo               = NA,
    exportar                  = c("rplot", "png"),
    path_salida               = NULL,
    ancho                     = 10,
    alto                      = 6,
    dpi                       = 300
) {
  if (!is.data.frame(data)) stop("`data` debe ser data.frame.", call. = FALSE)
  var_categoria <- .barras_categoricas_as_name(var_categoria, "var_categoria")
  if (!var_categoria %in% names(data)) stop("No existe `var_categoria` en `data`.", call. = FALSE)
  if (!is.null(var_valor)) var_valor <- .barras_categoricas_as_name(var_valor, "var_valor")
  if (!is.null(var_n)) var_n <- .barras_categoricas_as_name(var_n, "var_n")
  if (!is.null(var_pct)) var_pct <- .barras_categoricas_as_name(var_pct, "var_pct")
  if (!is.null(var_valor) && !var_valor %in% names(data)) stop("No existe `var_valor` en `data`.", call. = FALSE)
  if (!is.null(var_n) && !var_n %in% names(data)) stop("No existe `var_n` en `data`.", call. = FALSE)
  if (!is.null(var_pct) && !var_pct %in% names(data)) stop("No existe `var_pct` en `data`.", call. = FALSE)

  modo_valor <- match.arg(modo_valor)
  orden_barras <- match.arg(orden_barras)
  normalizar_etiquetas <- match.arg(normalizar_etiquetas)
  formato_valor <- match.arg(formato_valor)
  exportar <- match.arg(exportar)

  max_categorias <- suppressWarnings(as.integer(max_categorias)[1])
  if (!is.finite(max_categorias) || max_categorias <= 0) max_categorias <- 10L
  max_categorias <- min(max_categorias, 10L)

  df <- data.frame(
    categoria_raw = as.character(data[[var_categoria]]),
    stringsAsFactors = FALSE
  )
  df$categoria <- .barras_categoricas_normalizar(df$categoria_raw, normalizar_etiquetas)
  df$valor <- if (!is.null(var_valor)) suppressWarnings(as.numeric(data[[var_valor]])) else NA_real_
  df$n <- if (!is.null(var_n)) suppressWarnings(as.numeric(data[[var_n]])) else NA_real_
  df$pct <- if (!is.null(var_pct)) suppressWarnings(as.numeric(data[[var_pct]])) else NA_real_

  df <- df[!is.na(df$categoria) & nzchar(trimws(df$categoria)), , drop = FALSE]
  if (!nrow(df)) stop("No hay categorias validas para graficar.", call. = FALSE)

  if (is.null(var_valor)) {
    if (is.null(var_n)) {
      df <- stats::aggregate(list(n = rep(1, nrow(df))), list(categoria = df$categoria), sum)
      df$categoria_raw <- df$categoria
      df$pct <- df$n / sum(df$n, na.rm = TRUE)
    } else {
      df$n[!is.finite(df$n)] <- 0
      df <- stats::aggregate(list(n = df$n), list(categoria = df$categoria), sum)
      df$categoria_raw <- df$categoria
      df$pct <- df$n / sum(df$n, na.rm = TRUE)
    }
    df$valor <- if (identical(modo_valor, "porcentaje")) df$pct else df$n
  } else {
    keep_cols <- c("categoria", "categoria_raw", "valor", "n", "pct")
    df <- df[, keep_cols, drop = FALSE]
    df$valor <- suppressWarnings(as.numeric(df$valor))
    if (all(is.na(df$n)) && is.finite(sum(df$valor, na.rm = TRUE)) && sum(df$valor, na.rm = TRUE) > 0) {
      df$pct <- df$valor / sum(df$valor, na.rm = TRUE)
    } else if (all(is.na(df$pct)) && any(is.finite(df$n)) && sum(df$n, na.rm = TRUE) > 0) {
      df$pct <- df$n / sum(df$n, na.rm = TRUE)
    }
  }
  df <- df[is.finite(df$valor), , drop = FALSE]
  if (!nrow(df)) stop("No hay valores numericos validos para graficar.", call. = FALSE)

  if (identical(orden_barras, "mayor_menor")) {
    df <- df[order(df$valor, decreasing = TRUE), , drop = FALSE]
  } else if (identical(orden_barras, "menor_mayor")) {
    df <- df[order(df$valor, decreasing = FALSE), , drop = FALSE]
  }

  if (nrow(df) > max_categorias) {
    if (!isTRUE(agrupar_resto_en_otros)) {
      stop(
        "`barras_categoricas` admite hasta ", max_categorias,
        " categorias. Usa `agrupar_resto_en_otros = TRUE` o un grafico de barras agrupadas.",
        call. = FALSE
      )
    }
    keep <- seq_len(max_categorias - 1L)
    rest <- df[-keep, , drop = FALSE]
    df <- df[keep, , drop = FALSE]
    df <- rbind(
      df,
      data.frame(
        categoria = etiqueta_otros,
        categoria_raw = etiqueta_otros,
        valor = sum(rest$valor, na.rm = TRUE),
        n = sum(rest$n, na.rm = TRUE),
        pct = sum(rest$pct, na.rm = TRUE),
        stringsAsFactors = FALSE
      )
    )
  }

  if (all(!is.finite(df$pct)) && sum(df$valor, na.rm = TRUE) > 0) {
    df$pct <- df$valor / sum(df$valor, na.rm = TRUE)
  }

  if (isTRUE(mostrar_promedio) && is.null(promedio)) {
    raw_num <- suppressWarnings(as.numeric(df$categoria_raw))
    if (all(is.finite(raw_num)) && any(is.finite(df$n)) && sum(df$n, na.rm = TRUE) > 0) {
      promedio <- stats::weighted.mean(raw_num, df$n, na.rm = TRUE)
    }
  }

  label_note <- nota_pie
  if (isTRUE(mostrar_promedio) && !is.null(promedio)) {
    promedio <- suppressWarnings(as.numeric(promedio)[1])
    if (is.finite(promedio)) {
      prom_txt <- paste0(promedio_label, ": ", .barras_categoricas_format_num(promedio, promedio_decimales))
      if (!is.null(promedio_maximo)) {
        max_txt <- suppressWarnings(as.numeric(promedio_maximo)[1])
        if (is.finite(max_txt)) prom_txt <- paste0(prom_txt, " / ", .barras_categoricas_format_num(max_txt, promedio_decimales))
      }
      label_note <- paste(stats::na.omit(c(label_note, prom_txt)), collapse = " | ")
    }
  }

  df$label <- .barras_categoricas_make_labels(df, formato_valor, decimales, mostrar_frecuencia)
  # Los overrides de color del usuario (colores_categorias / paleta_colores)
  # pueden llegar cortos, sin nombres o como el deparse de un vector; se sanean
  # y rellenan con el helper compartido a un palette limpio keyed por categoria,
  # para que scale_fill_manual nunca reciba basura ("Unknown colour name").
  if (!is.null(colores_categorias) && length(colores_categorias)) {
    colores_categorias <- .graficos_mk_palette(unique(df$categoria), pal_user = colores_categorias)
  } else if (!is.null(paleta_colores) && length(paleta_colores)) {
    paleta_colores <- .graficos_mk_palette(unique(df$categoria), pal_user = paleta_colores)
  }
  df$fill <- .barras_categoricas_resolve_colors(df$categoria, colores_categorias, paleta_colores)
  df$x <- factor(df$categoria, levels = df$categoria)
  if (!is.null(ancho_max_eje_x) && is.finite(suppressWarnings(as.numeric(ancho_max_eje_x)))) {
    df$x_label <- stringr::str_wrap(df$categoria, width = as.numeric(ancho_max_eje_x)[1])
  } else {
    df$x_label <- df$categoria
  }

  ymax <- if (!is.null(limite_y)) suppressWarnings(as.numeric(limite_y)[1]) else NA_real_
  if (!is.finite(ymax)) {
    ymax <- max(df$valor, na.rm = TRUE)
    ymax <- if (identical(modo_valor, "porcentaje") || identical(formato_valor, "porcentaje") || identical(formato_valor, "porcentaje_n")) {
      max(1, ymax * (1 + expand_y))
    } else {
      ymax * (1 + expand_y)
    }
  }

  face_titulo <- if ("titulo" %in% textos_negrita) "bold" else "plain"
  face_subtitulo <- if ("subtitulo" %in% textos_negrita) "bold" else "plain"
  face_ejes <- if (any(c("ejes", "eje_x", "eje_y") %in% textos_negrita)) "bold" else "plain"
  face_valores <- if ("valores" %in% textos_negrita) "bold" else "plain"
  face_nota <- if ("nota_pie" %in% textos_negrita) "bold" else "plain"

  # H35 — cuando lo graficado es una proporcion, el eje Y tiene que leerse en
  # porcentajes. El motor alimenta `var_valor = "pct"` con `modo_valor =
  # "valor"`, asi que el eje visible mostraba 0.00–1.00 mientras las etiquetas
  # de barra decian «45%»: dos escalas para el mismo dato en la misma lamina.
  # Solo muerde con el eje encendido (el preset lo apaga de fabrica).
  eje_y_es_pct <- if (!is.null(eje_y_porcentaje)) {
    isTRUE(eje_y_porcentaje)
  } else {
    identical(modo_valor, "porcentaje") ||
      (!is.null(var_valor) && !is.null(var_pct) && identical(var_valor, var_pct))
  }

  escala_y <- if (eje_y_es_pct) {
    ggplot2::scale_y_continuous(
      labels = function(z) .barras_categoricas_format_pct(z, decimales)
    )
  } else {
    ggplot2::scale_y_continuous(
      labels = function(z) .barras_categoricas_format_num(z, decimales)
    )
  }

  p <- ggplot2::ggplot(df, ggplot2::aes(x = .data$x, y = .data$valor, fill = .data$categoria)) +
    ggplot2::geom_col(width = grosor_barras, color = NA) +
    ggplot2::scale_fill_manual(values = stats::setNames(df$fill, df$categoria), guide = "none") +
    ggplot2::scale_x_discrete(labels = stats::setNames(df$x_label, df$categoria)) +
    escala_y +
    ggplot2::coord_cartesian(ylim = c(0, ymax), clip = "off") +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = label_note, x = NULL, y = NULL) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      plot.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      panel.background = ggplot2::element_rect(fill = color_fondo, color = NA),
      plot.title = ggplot2::element_text(
        color = color_titulo, size = size_titulo, face = face_titulo,
        hjust = 0.5, margin = ggplot2::margin(b = 8)
      ),
      plot.subtitle = ggplot2::element_text(
        color = color_subtitulo, size = size_subtitulo, face = face_subtitulo,
        hjust = 0.5, margin = ggplot2::margin(b = 10)
      ),
      plot.caption = ggplot2::element_text(
        color = color_nota_pie, size = size_nota_pie, face = face_nota,
        hjust = 1, margin = ggplot2::margin(t = 8)
      ),
      axis.text.x = ggplot2::element_text(color = color_ejes, size = size_ejes, face = face_ejes),
      axis.text.y = ggplot2::element_text(color = color_ejes, size = size_ejes),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.y = if (isTRUE(mostrar_grid_y)) ggplot2::element_line(color = "#D8D8D8", linewidth = 0.25) else ggplot2::element_blank(),
      axis.line.x = if (isTRUE(mostrar_linea_eje_x)) ggplot2::element_line(color = "#808080", linewidth = 0.30) else ggplot2::element_blank(),
      axis.line.y = if (isTRUE(mostrar_eje_y) && isTRUE(mostrar_linea_eje_y)) ggplot2::element_line(color = "#808080", linewidth = 0.30) else ggplot2::element_blank(),
      axis.ticks = ggplot2::element_blank(),
      plot.margin = ggplot2::margin(12, 24, 12, 24)
    )

  if (!isTRUE(mostrar_eje_y)) {
    p <- p + ggplot2::theme(axis.text.y = ggplot2::element_blank(), panel.grid.major.y = ggplot2::element_blank())
  }

  if (isTRUE(mostrar_valores)) {
    p <- p + ggplot2::geom_text(
      ggplot2::aes(label = .data$label),
      vjust = -0.30,
      color = color_texto_barras,
      size = size_texto_barras,
      fontface = face_valores,
      family = font_family
    )
  }

  attr(p, "pulso_barras_categoricas_data") <- df
  attr(p, "pulso_barras_categoricas_promedio") <- promedio
  attr(p, "pulso_barras_categoricas_max_categorias") <- max_categorias

  if (identical(exportar, "png")) {
    if (is.null(path_salida) || !nzchar(path_salida)) {
      stop("`path_salida` es obligatorio cuando `exportar = 'png'`.", call. = FALSE)
    }
    ggplot2::ggsave(path_salida, p, width = ancho, height = alto, dpi = dpi, bg = color_fondo)
  }

  p
}
