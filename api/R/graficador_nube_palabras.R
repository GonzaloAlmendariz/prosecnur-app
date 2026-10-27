#' Graficar nube de palabras para respuestas abiertas
#'
#' @param data Data frame con textos abiertos.
#' @param var_texto Columna de texto.
#' @param var_n Columna opcional de frecuencia/peso por fila.
#' @param titulo Titulo opcional.
#' @param subtitulo Subtitulo opcional.
#' @param nota_pie Nota al pie opcional.
#' @param max_palabras Numero maximo de palabras visibles.
#' @param min_chars Largo minimo de token.
#' @param seed Semilla para el orden deterministico del layout.
#' @param colores_palabras Paleta de colores para palabras.
#' @param font_family Familia tipografica.
#' @param filtrar_no_respuestas Si `TRUE`, quita los comentarios que no responden nada («-», «no», «ninguno»…) y el
#'   ranking dice cuántos tienen contenido de cuántos escribieron algo. Apagado por defecto.
#' @param lematizar Si `TRUE`, quita palabras vacías funcionales y de opinión, agrupa flexiones (plural y formas
#'   verbales; no sinónimos), une las frases que usan tres personas o más y muestra la forma más frecuente.
#' @param contar `"menciones"` (por defecto, apariciones) o `"personas"`: cada persona cuenta una vez por término,
#'   sin ponderar.
#' @param min_personas Con `contar = "personas"`, mínimo de personas para que un término entre a la nube.
#' @param equivalencias Sinónimos que unió el usuario: grupos `list(list(mostrar, formas))` del diccionario de la
#'   pregunta (TXT-6/7) o el vector con nombre raíz → raíz de antes. Por defecto, ninguno: no hay sinónimos de fábrica.
#' @param excluir_terminos Términos que no informan (del diccionario de la pregunta): salen de la nube y del ranking.
#'   Uno de varias palabras se lleva sus palabras donde aparece («ciencias sociales» no deja «sociales» suelto).
#' @param frases_fijas Frases que se unen aunque no las usen tres personas, y que entran aunque no lleguen a
#'   `min_personas`.
#' @return Objeto `ggplot`.
#' @family graficadores
#' @export
graficar_nube_palabras <- function(
    data,
    var_texto = "texto",
    var_n = NULL,
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    max_palabras = 40,
    min_chars = 3,
    seed = 123,
    colores_palabras = NULL,
    font_family = "Arial",
    size_titulo = 16,
    size_subtitulo = 12,
    size_nota_pie = 10,
    color_titulo = .std_color("coral"),
    color_subtitulo = .std_color("azul"),
    color_nota_pie = .std_color("azul"),
    mostrar_ranking = TRUE,
    filtrar_no_respuestas = FALSE,
    lematizar = FALSE,
    contar = c("menciones", "personas"),
    min_personas = 3,
    equivalencias = NULL,
    excluir_terminos = NULL,
    frases_fijas = NULL,
    ...
) {
  if (!is.data.frame(data)) stop("`data` debe ser data.frame.", call. = FALSE)
  if (!is.character(var_texto) || length(var_texto) != 1L || !nzchar(trimws(var_texto))) {
    stop("`var_texto` debe ser character(1) no vacio.", call. = FALSE)
  }
  if (!var_texto %in% names(data)) {
    stop("`var_texto` no existe en `data`: ", var_texto, call. = FALSE)
  }

  max_palabras <- suppressWarnings(as.integer(max_palabras[1]))
  if (!is.finite(max_palabras) || is.na(max_palabras) || max_palabras < 1L) max_palabras <- 40L
  min_chars <- suppressWarnings(as.integer(min_chars[1]))
  if (!is.finite(min_chars) || is.na(min_chars) || min_chars < 1L) min_chars <- 3L
  seed <- suppressWarnings(as.integer(seed[1]))
  if (!is.finite(seed) || is.na(seed)) seed <- 123L

  # TXT-1 (plan-texto-abierto-ccss-2026-10-24): filtro de no respuestas, raíz y conteo por persona. Todo opcional y
  # apagado: sin ellos la nube cuenta como siempre y las láminas ya hechas no cambian sus cifras.
  filtrar_no_respuestas <- .txt_flag(filtrar_no_respuestas)
  lematizar <- .txt_flag(lematizar)
  contar <- if (identical(tolower(trimws(as.character(contar %||% "menciones")[1])), "personas")) "personas" else "menciones"
  # TXT-6/7: con diccionario de la pregunta también se cuenta por el camino limpio (sin él, nada cambia).
  dic <- length(equivalencias) > 0L || length(excluir_terminos) > 0L || length(frases_fijas) > 0L
  limpia <- lematizar || identical(contar, "personas") || dic

  textos_crudos <- data[[var_texto]]
  textos <- .txt_normalizar(textos_crudos)
  keep_text <- nzchar(textos)
  if (filtrar_no_respuestas) keep_text <- keep_text & !.txt_no_respuesta(textos_crudos)
  escribieron <- sum(nzchar(trimws(ifelse(is.na(textos_crudos), "", as.character(textos_crudos)))))
  stopwords_es <- .txt_palabras_vacias("base")
  textos <- textos[keep_text]
  weights <- rep(1, length(textos))
  if (!is.null(var_n) && is.character(var_n) && length(var_n) == 1L && var_n %in% names(data)) {
    weights_all <- suppressWarnings(as.numeric(data[[var_n]]))
    weights_all[!is.finite(weights_all) | is.na(weights_all) | weights_all <= 0] <- 1
    weights <- weights_all[keep_text]
  }

  if (limpia) {
    words <- .txt_conteo_terminos(textos, pesos = weights, contar = contar, lematizar = lematizar, min_chars = min_chars,
                                  min_personas = min_personas, equivalencias = equivalencias, excluir = excluir_terminos,
                                  frases_fijas = frases_fijas)
  } else {
    tokens <- strsplit(textos, "\\s+", perl = TRUE)
    token_df <- do.call(rbind, lapply(seq_along(tokens), function(i) {
      tok <- tokens[[i]]
      tok <- tok[nzchar(tok)]
      tok <- tok[nchar(tok, type = "chars") >= min_chars]
      tok <- tok[!chartr("áéíóúüñ", "aeiouun", tok) %in% stopwords_es]   # las palabras vacías se escriben sin tilde
      if (!length(tok)) return(NULL)
      data.frame(palabra = tok, n = rep(weights[i], length(tok)), stringsAsFactors = FALSE)
    }))

    if (is.null(token_df) || !nrow(token_df)) {
      token_df <- data.frame(palabra = textos, n = weights, stringsAsFactors = FALSE)
    }

    words <- stats::aggregate(n ~ palabra, data = token_df, FUN = sum, na.rm = TRUE)
    words <- words[order(-words$n, words$palabra), , drop = FALSE]
  }
  words <- utils::head(words, max_palabras)
  words <- words[nzchar(words$palabra), , drop = FALSE]

  if (!nrow(words)) {
    words <- data.frame(palabra = "Sin datos", n = 1, stringsAsFactors = FALSE)
  }

  set.seed(seed)
  n_words <- nrow(words)
  idx <- seq_len(n_words)
  angle <- (idx - 1) * pi * (3 - sqrt(5))
  radius <- sqrt(pmax(0, idx - 1) / max(1, n_words - 1)) * 0.44
  x <- 0.5 + cos(angle) * radius
  y <- 0.5 + sin(angle) * radius * 0.78
  if (n_words >= 1L) {
    x[1] <- 0.5
    y[1] <- 0.5
  }

  rng <- range(words$n, na.rm = TRUE)
  if (!all(is.finite(rng)) || diff(rng) <= 0) {
    size <- rep(8.5, n_words)
  } else {
    size <- 4.8 + (words$n - rng[1]) / diff(rng) * 8.2
  }

  # Color: el que declare el analista; si no, el degradado del recetario (recetario_graficos2.R:29): cinco azules
  # del claro al marino por cuartil de menciones, así la palabra más dicha es también la más oscura.
  colores_palabras <- as.character(colores_palabras %||% character(0))
  colores_palabras <- colores_palabras[!is.na(colores_palabras) & nzchar(trimws(colores_palabras))]
  # La paleta cíclica de fábrica (azul, rojo, verde, amarillo, azul secundario, morado) viaja en los proyectos
  # guardados: si llega tal cual, no es una decisión del analista y rige el degradado.
  fabrica <- toupper(unname(unlist(.PULSO_PPT_COLORS[c("azul", "rojo", "verde", "amarillo", "azul_secundario", "morado")])))
  if (length(colores_palabras) == 6L && identical(toupper(colores_palabras), fabrica)) colores_palabras <- character(0)
  color_palabra <- if (length(colores_palabras)) rep_len(colores_palabras, n_words) else {
    cortes <- unique(stats::quantile(words$n, seq(0, 1, 0.25), names = FALSE))
    tramo <- if (length(cortes) > 1L) cut(words$n, breaks = cortes, include.lowest = TRUE, labels = FALSE) else rep(5L, n_words)
    grDevices::colorRampPalette(c(.std_paleta("mapa")[2], .std_color("azul")))(5)[pmin(5L, pmax(1L, tramo))]
  }

  plot_df <- data.frame(
    x = x,
    y = y,
    palabra = words$palabra,
    size = size,
    color = color_palabra,
    stringsAsFactors = FALSE
  )

  # Con ggwordcloud, la nube del recetario: cada palabra donde cabe sin pisar a otra, de 11 a 46 pt según sus
  # menciones (recetario_graficos2.R:27-33). Sin el paquete, la espiral de siempre.
  capa <- if (requireNamespace("ggwordcloud", quietly = TRUE)) {
    plot_df$n <- words$n
    list(ggwordcloud::geom_text_wordcloud(ggplot2::aes(label = .data$palabra, size = .data$n, color = .data$color), family = font_family,
                                          fontface = "bold", rm_outside = TRUE, eccentricity = 0.55, grid_margin = 2.4, seed = 7),   # 2.4 y no 0.7: con 0.7 y 1.6 se pegaban o chocaban palabras; con 2.4, 2.1 pt o más en seis semillas y 40 de 40
         ggplot2::scale_size(range = c(11, 46) / ggplot2::.pt, guide = "none"))
  } else {
    list(ggplot2::geom_text(ggplot2::aes(x = .data$x, y = .data$y, label = .data$palabra, size = .data$size, color = .data$color),
                            family = font_family, fontface = "bold", show.legend = FALSE),
         ggplot2::scale_size_identity(), ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE))
  }
  p_out <- ggplot2::ggplot(plot_df) + capa +
    ggplot2::scale_color_identity() +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie) +
    ggplot2::theme_void(base_family = font_family) +
    ggplot2::theme(
      plot.title = ggplot2::element_text(color = color_titulo, size = size_titulo, face = "bold", hjust = 0),
      plot.subtitle = ggplot2::element_text(color = color_subtitulo, size = size_subtitulo, hjust = 0),
      plot.caption = ggplot2::element_text(color = color_nota_pie, size = size_nota_pie, hjust = 0),
      plot.margin = ggplot2::margin(4, 4, 4, 4)
    )
  # ADR 0093 (N6): la nube va en la lámina del recetario (antetítulo, título y pie nativos), a todo el ancho.
  lectura <- if (identical(contar, "personas")) c("El tamaño crece con las personas que usan cada palabra", "Sin ponderar") else "El tamaño crece con las menciones"
  espec <- .espec_ggplot_marco("nube", nota = nota_pie, lectura = lectura)
  # G11 (lámina 101 del diseño): las diez palabras más dichas, con su conteo, junto a la nube y en piezas editables.
  if (!isFALSE(mostrar_ranking) && !identical(words$palabra, "Sin datos")) {
    top <- utils::head(words, 10L)
    espec$ranking <- list(palabras = as.character(top$palabra), n = as.numeric(top$n),
                          respuestas = if (is.null(var_n) || identical(contar, "personas")) length(textos) else NA_integer_)
    if (identical(contar, "personas")) espec$ranking$unidad <- "personas"
    if (filtrar_no_respuestas) { espec$ranking$escribieron <- as.integer(escribieron); espec$ranking$con_contenido <- length(textos) }
  }
  attr(p_out, "pulso_espec") <- espec
  p_out
}
