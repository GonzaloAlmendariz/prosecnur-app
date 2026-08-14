# Serie temporal (lineas)
# =======================
#
# PROBLEMA. El catalogo no tenia ninguna forma de mostrar evolucion. `geom_line`
# solo aparecia en el radar, para cerrar su poligono. Un estudio con olas —el
# caso de los PDM, que miden lo mismo cada trimestre— no tenia como decir "esto
# subio y esto bajo": habia que poner dos graficos al lado y dejar que el lector
# hiciera la resta.
#
# DISEÑO. Consume el MISMO data frame tidy `(eje, grupo, valor, n)` que ya
# produce el motor multibase (`graficos_radar_multibase.R`, ADR 0064) y que
# alimenta al radar comparativo. Solo se lee al reves:
#
#   radar   -> un vertice por `eje` (tema),   una serie por `grupo` (base)
#   serie   -> un punto  por `grupo` (base),  una linea  por `eje`   (tema)
#
# Es decir: los mismos numeros, girados. El analista puede mirar el mismo corte
# como radar —comparacion entre publicos en un momento— o como serie
# —evolucion de cada tema a lo largo de las olas— sin declarar nada nuevo y sin
# que el motor recalcule.
#
# EL EJE X ES CATEGORICO Y ORDENADO, NO UNA FECHA. Las olas de un estudio son
# etiquetas ("Linea de base", "Ola 2", "Ola 3"), no instantes: espaciarlas por
# su distancia real en el calendario sugiere una velocidad de cambio que el
# diseño muestral no midio. El orden por defecto es el de declaracion de las
# fuentes, que es como el analista las escribio.

# Paleta de la serie. Reusa el saneo compartido para que un override del
# round-trip de la UI no tumbe la escala.
.serie_temporal_colores <- function(niveles, colores_series = NULL) {
  .graficos_mk_palette(niveles, pal_user = colores_series)
}

# Lado de cada etiqueta dentro de un periodo.
#
# Dos series que se cruzan comparten casi el mismo valor en ese periodo y sus
# cifras se dibujan una encima de otra: el primer render con cuatro series ya
# mostraba "60%" y "58%" superpuestos, y con ocho era ilegible. Poner todas las
# cifras arriba desperdicia la mitad del espacio disponible.
#
# Se recorren los valores del periodo de menor a mayor y, cuando uno cae a menos
# de `separacion` del anterior, se manda al lado contrario. No es un repulsor
# iterativo —no hay `ggrepel` entre las dependencias declaradas y no se agrega
# una por esto— pero duplica el espacio util y resuelve el cruce, que es el caso
# real.
#
# Devuelve el `vjust` de cada fila: negativo dibuja arriba del punto, positivo
# abajo.
.serie_temporal_vjust <- function(periodos, valores, separacion) {
  n <- length(valores)
  vj <- rep(-0.9, n)
  if (!n) return(vj)
  sep <- suppressWarnings(as.numeric(separacion)[1])
  if (!is.finite(sep) || sep <= 0) return(vj)

  for (p in unique(as.character(periodos))) {
    idx <- which(as.character(periodos) == p & is.finite(valores))
    if (length(idx) < 2L) next
    idx <- idx[order(valores[idx])]
    arriba <- TRUE
    ultimo <- -Inf
    for (k in seq_along(idx)) {
      i <- idx[[k]]
      if (k > 1L && (valores[i] - ultimo) < sep) {
        arriba <- !arriba          # colisiona con el anterior: al otro lado
      } else {
        arriba <- TRUE             # hay aire: vuelve al lado natural
      }
      vj[i] <- if (arriba) -1.0 else 1.9
      ultimo <- valores[i]
    }
  }
  vj
}

# Etiqueta de un valor segun la escala declarada.
.serie_temporal_formato <- function(valores, escala_valor, decimales) {
  dec <- suppressWarnings(as.integer(decimales)[1])
  if (!is.finite(dec) || dec < 0) dec <- 0L
  pct <- if (identical(escala_valor, "proporcion_1")) valores * 100 else valores
  # Regla de la casa: el 0,5 sube. `round()` redondea al par y dejaba 12,5 % en
  # 12 % mientras 87,5 % subía a 88 % en la misma serie.
  .pulso_fmt_pct_half_up(pct, dec, escala = 1)
}

#' Serie temporal de uno o varios indicadores
#'
#' @param data Data frame tidy con una fila por (periodo, serie).
#' @param var_eje Columna con la SERIE (cada valor distinto es una linea).
#' @param var_grupo Columna con el PERIODO (cada valor distinto es un punto del
#'   eje X). Los nombres conservan la convencion del df multibase, donde `grupo`
#'   es la base y aqui la base es el momento.
#' @param var_valor Columna con el valor a graficar.
#' @param orden_periodos Orden explicito del eje X. Sin el, se respeta el orden
#'   de aparicion, que es el de declaracion de las fuentes.
#' @param escala_valor `proporcion_1` (0-1) o `proporcion_100` (0-100).
#' @param mostrar_valores Escribe la cifra sobre cada punto.
#' @param mostrar_puntos Dibuja el punto ademas de la linea.
#' @param destacar_ultimo Engrosa el marcador del ultimo periodo de cada serie,
#'   que es el dato que el lector busca primero.
#' @param limite_y Tope del eje Y. Vacio = automatico.
#'
#' @family graficador
#' @export
graficar_serie_temporal <- function(
    data,
    var_eje    = "eje",
    var_grupo  = "grupo",
    var_valor  = "valor",

    orden_periodos = NULL,
    orden_series   = NULL,
    escala_valor   = c("proporcion_100", "proporcion_1"),

    titulo     = NULL,
    subtitulo  = NULL,
    nota_pie   = NULL,

    mostrar_puntos   = TRUE,
    mostrar_valores  = TRUE,
    valores_decimales = 0L,
    destacar_ultimo  = TRUE,
    # Fraccion del rango de datos por debajo de la cual dos cifras del mismo
    # periodo se consideran superpuestas y una se manda al lado contrario.
    separacion_etiquetas = 0.08,
    # Limite visual del motor. Alternar arriba/abajo da DOS posiciones; con mas
    # series juntas las cifras se pisan igual y el resultado es un amasijo que
    # se lee peor que no tener cifras. Por encima de este numero se apagan y la
    # historia la cuentan la leyenda y el punto destacado. Mismo criterio que
    # `max_categorias` en barras categoricas: el motor declara su limite en vez
    # de dibujar algo ilegible.
    max_series_con_cifras = 5L,

    size_linea  = 0.9,
    size_punto  = 2.4,
    size_valores = 3.1,

    mostrar_leyenda  = TRUE,
    leyenda_posicion = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),
    colores_series   = NULL,

    mostrar_grid_y = TRUE,
    color_ejes  = "#081F5C",
    size_ejes   = 9,
    limite_y    = NULL,
    expand_y    = 0.12,

    color_titulo    = "#081F5C",
    size_titulo     = 11,
    color_subtitulo = "#081F5C",
    size_subtitulo  = 9,
    color_nota_pie  = "#081F5C",
    size_nota_pie   = 8,
    textos_negrita  = NULL,
    font_family     = "Arial"
) {
  escala_valor <- match.arg(escala_valor)
  leyenda_posicion <- match.arg(leyenda_posicion)
  textos_negrita <- textos_negrita %||% character(0)
  face_de <- function(token) if (token %in% textos_negrita) "bold" else "plain"

  if (!is.data.frame(data) || !nrow(data)) {
    stop("`data` debe ser un data frame con al menos una fila.", call. = FALSE)
  }
  for (col in c(var_eje, var_grupo, var_valor)) {
    if (!col %in% names(data)) {
      stop("La columna `", col, "` no existe en `data`.", call. = FALSE)
    }
  }

  df <- data.frame(
    .serie   = as.character(data[[var_eje]]),
    .periodo = as.character(data[[var_grupo]]),
    .valor   = suppressWarnings(as.numeric(data[[var_valor]])),
    stringsAsFactors = FALSE
  )
  df <- df[!is.na(df$.serie) & nzchar(trimws(df$.serie)), , drop = FALSE]
  df <- df[!is.na(df$.periodo) & nzchar(trimws(df$.periodo)), , drop = FALSE]
  if (!nrow(df)) stop("No quedan filas con serie y periodo utilizables.", call. = FALSE)

  # Orden del eje X: el declarado, o el de aparicion. Nunca alfabetico — "Ola
  # 10" iria antes que "Ola 2" y la evolucion se leeria al reves.
  niveles_periodo <- if (!is.null(orden_periodos) && length(orden_periodos)) {
    p <- as.character(orden_periodos)
    c(intersect(p, unique(df$.periodo)), setdiff(unique(df$.periodo), p))
  } else if (is.factor(data[[var_grupo]])) {
    intersect(levels(data[[var_grupo]]), unique(df$.periodo))
  } else {
    unique(df$.periodo)
  }
  niveles_serie <- if (!is.null(orden_series) && length(orden_series)) {
    s <- as.character(orden_series)
    c(intersect(s, unique(df$.serie)), setdiff(unique(df$.serie), s))
  } else if (is.factor(data[[var_eje]])) {
    intersect(levels(data[[var_eje]]), unique(df$.serie))
  } else {
    unique(df$.serie)
  }

  df$.periodo <- factor(df$.periodo, levels = niveles_periodo)
  df$.serie   <- factor(df$.serie,   levels = niveles_serie)

  # Un NA rompe la linea en vez de saltarlo: unir por encima de un periodo sin
  # dato dibuja una tendencia que nadie midio.
  df <- df[order(df$.serie, df$.periodo), , drop = FALSE]

  valores_plot <- if (identical(escala_valor, "proporcion_1")) df$.valor * 100 else df$.valor
  df$.y <- valores_plot

  colores <- .serie_temporal_colores(niveles_serie, colores_series)

  p <- ggplot2::ggplot(
    df,
    ggplot2::aes(x = .data$.periodo, y = .data$.y, group = .data$.serie, colour = .data$.serie)
  ) +
    ggplot2::geom_line(linewidth = size_linea, na.rm = TRUE)

  if (isTRUE(mostrar_puntos)) {
    p <- p + ggplot2::geom_point(size = size_punto, na.rm = TRUE)
    if (isTRUE(destacar_ultimo)) {
      ultimos <- do.call(rbind, lapply(split(df, df$.serie), function(d) {
        d <- d[!is.na(d$.y), , drop = FALSE]
        if (!nrow(d)) return(NULL)
        d[nrow(d), , drop = FALSE]
      }))
      if (!is.null(ultimos) && nrow(ultimos)) {
        p <- p + ggplot2::geom_point(
          data = ultimos, size = size_punto * 1.75, na.rm = TRUE, show.legend = FALSE
        )
      }
    }
  }

  tope_cifras <- suppressWarnings(as.integer(max_series_con_cifras)[1])
  if (!is.finite(tope_cifras) || tope_cifras < 1L) tope_cifras <- 5L
  cifras_caben <- length(niveles_serie) <= tope_cifras

  if (isTRUE(mostrar_valores) && cifras_caben) {
    df$.lab <- .serie_temporal_formato(df$.y, "proporcion_100", valores_decimales)
    # La separacion minima se mide contra el rango real de los datos, no contra
    # un absoluto: un grafico que va de 20% a 80% tolera cifras mas juntas que
    # uno que va de 40% a 45%.
    rango <- diff(range(df$.y, na.rm = TRUE))
    if (!is.finite(rango) || rango <= 0) rango <- max(df$.y, na.rm = TRUE)
    df$.vjust <- .serie_temporal_vjust(
      df$.periodo, df$.y,
      separacion = rango * separacion_etiquetas
    )
    p <- p + ggplot2::geom_text(
      data = df,
      ggplot2::aes(label = .data$.lab, vjust = .data$.vjust),
      size = size_valores, show.legend = FALSE,
      family = font_family, fontface = face_de("valores"), na.rm = TRUE
    )
  }

  tope <- suppressWarnings(as.numeric(limite_y)[1])
  if (!is.finite(tope)) tope <- max(df$.y, na.rm = TRUE) * (1 + expand_y)
  if (!is.finite(tope) || tope <= 0) tope <- 100

  p <- p +
    ggplot2::scale_colour_manual(values = colores, breaks = niveles_serie) +
    ggplot2::scale_y_continuous(
      limits = c(0, tope),
      labels = function(x) paste0(.pulso_fmt_half_up(x, 0), "%"),
      expand = ggplot2::expansion(mult = c(0, 0.02))
    ) +
    ggplot2::labs(
      title = titulo, subtitle = subtitulo, caption = nota_pie,
      x = NULL, y = NULL, colour = NULL
    ) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      legend.position = if (identical(leyenda_posicion, "ninguna") || !isTRUE(mostrar_leyenda)) {
        "none"
      } else if (identical(leyenda_posicion, "abajo")) {
        "bottom"
      } else if (identical(leyenda_posicion, "arriba")) {
        "top"
      } else {
        leyenda_posicion
      },
      legend.title = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(
        colour = color_ejes, size = size_ejes, family = font_family,
        face = face_de("leyenda")
      ),
      plot.title = ggplot2::element_text(
        colour = color_titulo, size = size_titulo, family = font_family,
        face = face_de("titulo"), hjust = 0.5
      ),
      plot.subtitle = ggplot2::element_text(
        colour = color_subtitulo, size = size_subtitulo, family = font_family,
        face = face_de("subtitulo"), hjust = 0.5
      ),
      plot.caption = ggplot2::element_text(
        colour = color_nota_pie, size = size_nota_pie, family = font_family,
        face = face_de("nota_pie"), hjust = 1
      ),
      axis.text.x = ggplot2::element_text(
        colour = color_ejes, size = size_ejes, family = font_family,
        face = face_de("eje_x")
      ),
      axis.text.y = ggplot2::element_text(
        colour = color_ejes, size = size_ejes, family = font_family,
        face = face_de("eje_y")
      ),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_blank(),
      panel.grid.major.y = if (isTRUE(mostrar_grid_y)) {
        ggplot2::element_line(colour = "#E3E8EF", linewidth = 0.3)
      } else {
        ggplot2::element_blank()
      },
      # El caption de ggplot respeta el margen del plot, asi que aqui no se
      # repite el defecto de anclaje que tenian los canvas de barras.
      plot.margin = ggplot2::margin(10, 16, 8, 12)
    )

  attr(p, "pulso_serie_periodos") <- niveles_periodo
  attr(p, "pulso_serie_series") <- niveles_serie
  # Se declara para que el motor pueda avisar por que no hay cifras: un grafico
  # sin numeros y sin explicacion parece un knob que no funciono.
  attr(p, "pulso_serie_cifras_omitidas") <-
    isTRUE(mostrar_valores) && !cifras_caben
  p
}
