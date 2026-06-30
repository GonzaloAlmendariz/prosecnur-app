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
    colores_palabras = c("#081F5C", "#CA5651", "#85BB85", "#EFD25E", "#7594CC", "#9688D3"),
    font_family = "Arial",
    size_titulo = 16,
    size_subtitulo = 12,
    size_nota_pie = 10,
    color_titulo = "#CA5651",
    color_subtitulo = "#081F5C",
    color_nota_pie = "#081F5C",
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

  clean_chr <- function(x) {
    x <- as.character(x)
    x[is.na(x)] <- ""
    trimws(x)
  }

  normalize_text <- function(x) {
    x <- clean_chr(x)
    x <- gsub("https?://\\S+|www\\.\\S+", " ", x, perl = TRUE, ignore.case = TRUE)
    x <- gsub("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", " ", x, perl = TRUE, ignore.case = TRUE)
    x <- gsub("\\+?\\d[\\d\\s().-]{6,}\\d", " ", x, perl = TRUE)
    x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
    x[is.na(x)] <- ""
    x <- tolower(x)
    x <- gsub("[^[:alpha:] ]+", " ", x, perl = TRUE)
    trimws(gsub("\\s+", " ", x, perl = TRUE))
  }

  stopwords_es <- c(
    "ademas", "ahi", "al", "algo", "algunas", "algunos", "ante", "antes", "aqui",
    "asi", "aun", "aunque", "cada", "casi", "como", "con", "contra", "cual",
    "cuando", "de", "del", "desde", "donde", "dos", "el", "ella", "ellas",
    "ellos", "en", "entre", "era", "eran", "eres", "es", "esa", "esas", "ese",
    "eso", "esos", "esta", "estaba", "estan", "estar", "este", "esto", "estos",
    "fue", "fueron", "ha", "han", "hasta", "hay", "la", "las", "le", "les",
    "lo", "los", "mas", "me", "mi", "mis", "muy", "no", "nos", "nosotros",
    "o", "otra", "otras", "otro", "otros", "para", "pero", "por", "porque",
    "que", "se", "sea", "ser", "si", "sin", "sobre", "son", "su", "sus",
    "tambien", "tan", "te", "tener", "tiene", "todo", "todos", "tu", "un",
    "una", "unas", "uno", "unos", "y", "ya"
  )

  textos <- normalize_text(data[[var_texto]])
  keep_text <- nzchar(textos)
  textos <- textos[keep_text]
  if (!length(textos)) {
    empty_df <- data.frame(x = 0.5, y = 0.5, label = "Sin respuestas abiertas para mostrar")
    return(
      ggplot2::ggplot(empty_df, ggplot2::aes(.data$x, .data$y, label = .data$label)) +
        ggplot2::geom_text(family = font_family, color = color_subtitulo, size = 5) +
        ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) +
        ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie) +
        ggplot2::theme_void(base_family = font_family) +
        ggplot2::theme(
          plot.title = ggplot2::element_text(color = color_titulo, size = size_titulo, face = "bold"),
          plot.subtitle = ggplot2::element_text(color = color_subtitulo, size = size_subtitulo),
          plot.caption = ggplot2::element_text(color = color_nota_pie, size = size_nota_pie, hjust = 0)
        )
    )
  }

  weights <- rep(1, length(textos))
  if (!is.null(var_n) && is.character(var_n) && length(var_n) == 1L && var_n %in% names(data)) {
    weights_all <- suppressWarnings(as.numeric(data[[var_n]]))
    weights_all[!is.finite(weights_all) | is.na(weights_all) | weights_all <= 0] <- 1
    weights <- weights_all[keep_text]
  }

  tokens <- strsplit(textos, "\\s+", perl = TRUE)
  token_df <- do.call(rbind, lapply(seq_along(tokens), function(i) {
    tok <- tokens[[i]]
    tok <- tok[nzchar(tok)]
    tok <- tok[nchar(tok, type = "chars") >= min_chars]
    tok <- tok[!tok %in% stopwords_es]
    if (!length(tok)) return(NULL)
    data.frame(palabra = tok, n = rep(weights[i], length(tok)), stringsAsFactors = FALSE)
  }))

  if (is.null(token_df) || !nrow(token_df)) {
    token_df <- data.frame(palabra = textos, n = weights, stringsAsFactors = FALSE)
  }

  words <- stats::aggregate(n ~ palabra, data = token_df, FUN = sum, na.rm = TRUE)
  words <- words[order(-words$n, words$palabra), , drop = FALSE]
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

  colores_palabras <- as.character(colores_palabras)
  colores_palabras <- colores_palabras[!is.na(colores_palabras) & nzchar(trimws(colores_palabras))]
  if (!length(colores_palabras)) colores_palabras <- "#081F5C"

  plot_df <- data.frame(
    x = x,
    y = y,
    palabra = words$palabra,
    size = size,
    color = rep_len(colores_palabras, n_words),
    stringsAsFactors = FALSE
  )

  ggplot2::ggplot(plot_df, ggplot2::aes(.data$x, .data$y)) +
    ggplot2::geom_text(
      ggplot2::aes(label = .data$palabra, size = .data$size, color = .data$color),
      family = font_family,
      fontface = "bold",
      show.legend = FALSE
    ) +
    ggplot2::scale_size_identity() +
    ggplot2::scale_color_identity() +
    ggplot2::coord_cartesian(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) +
    ggplot2::labs(title = titulo, subtitle = subtitulo, caption = nota_pie) +
    ggplot2::theme_void(base_family = font_family) +
    ggplot2::theme(
      plot.title = ggplot2::element_text(color = color_titulo, size = size_titulo, face = "bold", hjust = 0),
      plot.subtitle = ggplot2::element_text(color = color_subtitulo, size = size_subtitulo, hjust = 0),
      plot.caption = ggplot2::element_text(color = color_nota_pie, size = size_nota_pie, hjust = 0),
      plot.margin = ggplot2::margin(4, 4, 4, 4)
    )
}
