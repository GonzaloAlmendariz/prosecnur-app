# Barras divergentes (Likert centrado en el neutro)
# =================================================
#
# PROBLEMA. Las apiladas al 100% dicen la composicion pero esconden el saldo.
# Con "35% de acuerdo" a la izquierda de la barra y "30% en desacuerdo" a la
# derecha, el lector tiene que restar de memoria para saber si el balance es
# positivo. El top-two-box resuelve el saldo pero pierde la forma: no distingue
# un publico polarizado —mucho muy de acuerdo y mucho muy en desacuerdo— de uno
# tibio, y son cosas distintas para un estudio.
#
# DISEÑO. El eje cruza en cero: lo negativo crece hacia la izquierda y lo
# positivo hacia la derecha. La forma queda a la vista y el saldo se lee de un
# golpe, porque es cuanto sobresale la barra de un lado.
#
# ES UN GRAFICADOR PROPIO Y NO UN MODO DE APILADAS, a diferencia de lo que
# proponia el roadmap. Dos razones. Para el analista NO es el mismo grafico: el
# eje ya no va de 0 a 100 sino de -100 a +100, y hay que declarar que categorias
# caen de cada lado, que es una decision que las apiladas no tienen. Y
# `graficador_barras_apiladas.R` son 3.275 lineas con 122 formals; meterle un
# modo lo haria crecer justo donde la casa esta tratando de contener.
#
# La ENTRADA si es la misma que la de apiladas —data ancha, una columna de
# porcentaje por categoria— para que cambiar de una a otra no obligue a
# redeclarar nada.
#
# EL NEUTRO SE PARTE, NO SE ESCONDE. Ocultarlo infla visualmente los dos lados y
# hace parecer que todos opinaron. Se dibuja mitad a cada lado del cero, que es
# la convencion que no miente sobre la base.

# Reparto de las categorias a cada lado del cero.
#
# `n_negativas` cuenta desde el PRIMER nivel: en una escala Likert declarada de
# peor a mejor, las dos primeras son el desacuerdo. Se cuenta y no se nombra
# para que la misma configuracion sirva a una bateria entera de preguntas que
# comparten escala, que es el caso de uso real.
.divergentes_reparto <- function(cols, n_negativas, incluir_neutro = TRUE) {
  n <- length(cols)
  k <- suppressWarnings(as.integer(n_negativas)[1])
  if (!is.finite(k) || k < 0) k <- 0L
  k <- min(k, n)

  neg <- if (k > 0) cols[seq_len(k)] else character(0)
  resto <- setdiff(cols, neg)

  # Con un numero impar de niveles y neutro incluido, el nivel del medio es el
  # neutro; con numero par no hay neutro y el resto es todo positivo.
  neu <- character(0)
  pos <- resto
  if (isTRUE(incluir_neutro) && length(resto) > 1L && (n %% 2L) == 1L && k == (n - 1L) %/% 2L) {
    neu <- resto[1]
    pos <- resto[-1]
  }
  list(negativas = neg, neutro = neu, positivas = pos)
}

#' Barras divergentes para escalas Likert
#'
#' @param data Data frame ancho: una fila por item, una columna de porcentaje
#'   por categoria de respuesta. Mismo formato que `graficar_barras_apiladas()`.
#' @param var_categoria Columna con el nombre del item (una barra por fila).
#' @param cols_porcentaje Columnas de porcentaje, EN EL ORDEN DE LA ESCALA (de
#'   peor a mejor). El orden es la declaracion: de el sale que cae a cada lado.
#' @param etiquetas_grupos Etiquetas visibles de cada categoria.
#' @param n_negativas Cuantos niveles, contando desde el primero, van a la
#'   izquierda del cero.
#' @param incluir_neutro Si `TRUE` y la escala tiene un nivel central, se dibuja
#'   partido a ambos lados en vez de ocultarse.
#' @param escala_valor `proporcion_1` (0-1) o `proporcion_100` (0-100).
#'
#' @family graficador
#' @export
graficar_barras_divergentes <- function(
    data,
    var_categoria,
    cols_porcentaje,
    etiquetas_grupos = NULL,
    var_n = NULL,
    n_negativas = 2L,
    incluir_neutro = TRUE,
    escala_valor = c("proporcion_100", "proporcion_1"),

    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,

    mostrar_valores = TRUE,
    valores_decimales = 0L,
    umbral_etiqueta = 3,
    mostrar_saldo = TRUE,
    etiqueta_saldo = "Saldo",

    colores_grupos = NULL,
    mostrar_leyenda = TRUE,
    leyenda_posicion = c("abajo", "arriba", "derecha", "izquierda", "ninguna"),

    grosor_barras = 0.68,
    color_ejes = "#081F5C",
    size_ejes = 9,
    size_valores = 3.0,
    color_texto_barras = "#FFFFFF",
    limite_x = NULL,

    color_titulo = .PULSO_COLOR_TEXTO,
    size_titulo = 11,
    color_subtitulo = .PULSO_COLOR_TEXTO,
    size_subtitulo = 9,
    color_nota_pie = .PULSO_COLOR_TEXTO,
    size_nota_pie = 8,
    textos_negrita = NULL,
    font_family = "Arial"
) {
  escala_valor <- match.arg(escala_valor)
  leyenda_posicion <- match.arg(leyenda_posicion)
  face <- .graficos_face_de(textos_negrita)

  if (!is.data.frame(data) || !nrow(data)) {
    stop("`data` debe ser un data frame con al menos una fila.", call. = FALSE)
  }
  cols_porcentaje <- as.character(cols_porcentaje)
  faltan <- setdiff(c(var_categoria, cols_porcentaje), names(data))
  if (length(faltan)) {
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), call. = FALSE)
  }
  if (length(cols_porcentaje) < 2L) {
    stop("Una escala divergente necesita al menos dos categorias.", call. = FALSE)
  }

  etiquetas <- etiquetas_grupos %||% stats::setNames(cols_porcentaje, cols_porcentaje)
  if (is.null(names(etiquetas))) names(etiquetas) <- cols_porcentaje

  reparto <- .divergentes_reparto(cols_porcentaje, n_negativas, incluir_neutro)
  if (!length(reparto$negativas) || !length(reparto$positivas)) {
    stop("El reparto deja un lado vacio: revisa `n_negativas`.", call. = FALSE)
  }

  items <- as.character(data[[var_categoria]])
  filas <- list()
  for (i in seq_along(items)) {
    for (col in cols_porcentaje) {
      v <- suppressWarnings(as.numeric(data[[col]][i]))
      if (!is.finite(v)) v <- 0
      if (identical(escala_valor, "proporcion_1")) v <- v * 100

      lado <- if (col %in% reparto$negativas) "neg" else if (col %in% reparto$neutro) "neu" else "pos"
      # El neutro se parte por la mitad a cada lado. Ocultarlo inflaria los dos
      # extremos y haria parecer que todos opinaron.
      if (identical(lado, "neu")) {
        filas[[length(filas) + 1L]] <- data.frame(
          .item = items[i], .cat = col, .valor = v, .signo = -v / 2, .lado = "neu",
          stringsAsFactors = FALSE
        )
        filas[[length(filas) + 1L]] <- data.frame(
          .item = items[i], .cat = col, .valor = v, .signo = v / 2, .lado = "neu2",
          stringsAsFactors = FALSE
        )
      } else {
        filas[[length(filas) + 1L]] <- data.frame(
          .item = items[i], .cat = col, .valor = v,
          .signo = if (identical(lado, "neg")) -v else v,
          .lado = lado, stringsAsFactors = FALSE
        )
      }
    }
  }
  df <- do.call(rbind, filas)

  df$.item <- factor(df$.item, levels = rev(items))
  # La escala tiene que leerse del cero hacia afuera en los dos sentidos: lo mas
  # extremo, mas lejos del eje. `geom_col` apila cada lado en sentido contrario
  # al otro, asi que el orden se resuelve por LADO y no con un unico factor:
  # dentro de cada lado se ordena por distancia al cero.
  #
  # El primer intento uso un solo orden para los dos lados y dejo "Muy
  # insatisfecho" en el medio del lado negativo y "Muy satisfecho" pegado al
  # cero — es decir, la escala al reves justo donde importa.
  df$.cat <- factor(df$.cat, levels = cols_porcentaje)
  df$.orden <- match(as.character(df$.cat), cols_porcentaje)
  # Negativas: el nivel mas bajo (el peor) va mas lejos del cero.
  # Positivas: el nivel mas alto (el mejor) va mas lejos del cero.
  df$.orden_apilado <- ifelse(df$.signo < 0, df$.orden, -df$.orden)
  df <- df[order(df$.item, df$.orden_apilado), , drop = FALSE]
  df$.cat_stack <- factor(
    as.character(df$.cat),
    levels = unique(as.character(df$.cat[order(df$.orden_apilado)]))
  )

  colores <- .graficos_mk_palette(cols_porcentaje, pal_user = colores_grupos)
  names(colores) <- cols_porcentaje

  tope <- suppressWarnings(as.numeric(limite_x)[1])
  if (!is.finite(tope)) {
    por_lado <- stats::aggregate(
      abs(df$.signo),
      by = list(item = df$.item, lado = ifelse(df$.signo < 0, "izq", "der")),
      FUN = sum
    )
    tope <- max(por_lado$x, na.rm = TRUE) * 1.08
  }
  if (!is.finite(tope) || tope <= 0) tope <- 100

  p <- ggplot2::ggplot(
    df,
    ggplot2::aes(x = .data$.signo, y = .data$.item, fill = .data$.cat,
                 group = .data$.orden_apilado)
  ) +
    ggplot2::geom_col(width = grosor_barras, orientation = "y") +
    ggplot2::geom_vline(xintercept = 0, colour = color_ejes, linewidth = 0.5)

  if (isTRUE(mostrar_valores)) {
    dec <- suppressWarnings(as.integer(valores_decimales)[1])
    if (!is.finite(dec) || dec < 0) dec <- 0L
    lab <- df
    # El neutro partido se etiquetaria dos veces con la mitad del valor cada
    # una, que es un numero que no existe en los datos: se rotula una sola vez.
    lab <- lab[lab$.lado != "neu2", , drop = FALSE]
    lab$.lab <- paste0(formatC(round(lab$.valor, dec), format = "f", digits = dec), "%")
    lab$.lab[lab$.valor < umbral_etiqueta] <- ""
    p <- p + ggplot2::geom_text(
      data = lab,
      ggplot2::aes(x = .data$.signo, label = .data$.lab,
                   group = .data$.orden_apilado),
      position = ggplot2::position_stack(vjust = 0.5),
      size = size_valores, colour = color_texto_barras,
      family = font_family, fontface = face("valores"), na.rm = TRUE
    )
  }

  if (isTRUE(mostrar_saldo)) {
    # El saldo es lo que la lamina viene a decir: positivas menos negativas. Se
    # escribe al margen porque dentro de la barra competiria con los segmentos.
    saldo <- stats::aggregate(
      df$.signo[df$.lado %in% c("neg", "pos")],
      by = list(item = df$.item[df$.lado %in% c("neg", "pos")]),
      FUN = sum
    )
    names(saldo) <- c(".item", ".saldo")
    saldo$.lab <- paste0(
      ifelse(saldo$.saldo > 0, "+", ""),
      formatC(round(saldo$.saldo, 0), format = "f", digits = 0), " pp"
    )
    saldo$.x <- tope * 1.02
    p <- p + ggplot2::geom_text(
      data = saldo,
      ggplot2::aes(x = .data$.x, y = .data$.item, label = .data$.lab),
      inherit.aes = FALSE, hjust = 0, size = size_valores,
      colour = color_ejes, family = font_family, fontface = "bold"
    )
    tope <- tope * 1.18
  }

  p +
    ggplot2::scale_fill_manual(
      values = colores, breaks = cols_porcentaje,
      labels = function(x) unname(etiquetas[x])
    ) +
    ggplot2::scale_x_continuous(
      limits = c(-tope, tope),
      labels = function(x) paste0(abs(round(x)), "%")
    ) +
    ggplot2::labs(
      title = titulo, subtitle = subtitulo, caption = nota_pie,
      x = NULL, y = NULL, fill = NULL
    ) +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      legend.position = if (identical(leyenda_posicion, "ninguna") || !isTRUE(mostrar_leyenda)) {
        "none"
      } else if (identical(leyenda_posicion, "abajo")) "bottom"
      else if (identical(leyenda_posicion, "arriba")) "top"
      else leyenda_posicion,
      legend.title = ggplot2::element_blank(),
      legend.text = ggplot2::element_text(colour = color_ejes, size = size_ejes,
                                          family = font_family, face = face("leyenda")),
      plot.title = ggplot2::element_text(colour = color_titulo, size = size_titulo,
                                         family = font_family, face = face("titulo"), hjust = 0.5),
      plot.subtitle = ggplot2::element_text(colour = color_subtitulo, size = size_subtitulo,
                                            family = font_family, face = face("subtitulo"), hjust = 0.5),
      plot.caption = ggplot2::element_text(colour = color_nota_pie, size = size_nota_pie,
                                           family = font_family, face = face("nota_pie"), hjust = 1),
      axis.text = ggplot2::element_text(colour = color_ejes, size = size_ejes,
                                        family = font_family, face = face("ejes")),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.major.x = ggplot2::element_line(colour = "#E3E8EF", linewidth = 0.3),
      plot.margin = ggplot2::margin(10, 16, 8, 12)
    )
}
