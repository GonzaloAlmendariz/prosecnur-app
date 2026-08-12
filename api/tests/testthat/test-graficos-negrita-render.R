source("setup-load-all.R")

# V4 del GOAL: encender una parte cambia ESA parte y ninguna otra. Hasta aquí
# sólo estaba auditado de forma estática —que cada token declarado apareciera
# consultado en el motor—, que no distingue un token que gobierna el elemento
# EQUIVOCADO. Esto lo mide sobre el objeto renderizado.
#
# El fontface no está en `gp$fontface` sino en `gp$font` (1 plana, 2 negrita,
# 3 cursiva, 4 ambas): `p$layers` no lo expone y un aserto sobre él devuelve lo
# mismo con el interruptor encendido y apagado.

.caras_de <- function(p, marcas) {
  g <- suppressWarnings(ggplot2::ggplotGrob(p))
  out <- list()
  walk <- function(x) {
    lab <- tryCatch(x$label, error = function(e) NULL)
    if (!is.null(lab) && is.character(lab) && length(lab) && lab[1] %in% marcas) {
      f <- tryCatch(x$gp$font, error = function(e) NULL)
      out[[lab[1]]] <<- if (is.null(f)) NA_character_ else
        c("plain", "bold", "italic", "bolditalic")[as.integer(f)[1]]
    }
    for (nm in c("children", "grobs")) {
      ch <- tryCatch(x[[nm]], error = function(e) NULL)
      if (!is.null(ch)) for (k in seq_along(ch)) walk(ch[[k]])
    }
  }
  walk(g)
  out
}

MARCAS <- c("MITITULO", "MISUBTITULO", "MINOTA")

esperar_independencia <- function(dibujar, partes, etiqueta) {
  for (parte in partes) {
    r <- .caras_de(dibujar(parte), MARCAS)
    propia <- MARCAS[[match(parte, partes)]]
    expect_equal(r[[propia]], "bold",
                 info = sprintf("%s · %s no salió en negrita", etiqueta, parte))
    for (otra in setdiff(MARCAS, propia)) {
      expect_false(identical(r[[otra]], "bold"),
                   info = sprintf("%s · encender %s puso en negrita %s", etiqueta, parte, otra))
    }
  }
}

test_that("boxplot: cada parte gobierna la suya y ninguna otra", {
  d <- data.frame(categoria = rep(c("A", "B"), each = 20),
                  valor = c(seq(1, 20), seq(5, 24)), stringsAsFactors = FALSE)
  dibujar <- function(tn) graficar_boxplot(
    d, var_categoria = "categoria", var_valor = "valor", usar_canvas = TRUE,
    titulo = "MITITULO", subtitulo = "MISUBTITULO", nota_pie = "MINOTA",
    textos_negrita = tn)
  esperar_independencia(dibujar, c("titulo", "subtitulo", "nota_pie"), "boxplot")
})

test_that("pie: cada parte gobierna la suya y ninguna otra", {
  d <- data.frame(cat = c("Sí", "No"), pct = c(0.6, 0.4), n = c(60L, 40L),
                  stringsAsFactors = FALSE)
  dibujar <- function(tn) graficar_pie(
    d, var_categoria = "cat", var_pct = "pct", usar_canvas = TRUE,
    titulo = "MITITULO", subtitulo = "MISUBTITULO", nota_pie = "MINOTA",
    textos_negrita = tn)
  esperar_independencia(dibujar, c("titulo", "subtitulo", "nota_pie"), "pie")
})

test_that("apiladas: el título no arrastra al subtítulo", {
  df <- data.frame(categoria = c("A", "B"), N = c(50L, 50L),
                   pct_1 = c(0.4, 0.6), pct_2 = c(0.6, 0.4), stringsAsFactors = FALSE)
  dibujar <- function(tn) graficar_barras_apiladas(
    df, var_categoria = "categoria", var_n = "N",
    cols_porcentaje = c("pct_1", "pct_2"), etiquetas_grupos = c(pct_1 = "Sí", pct_2 = "No"),
    usar_canvas = TRUE, titulo = "MITITULO", subtitulo = "MISUBTITULO",
    nota_pie = "MINOTA", textos_negrita = tn)

  con_titulo <- .caras_de(dibujar("titulo"), MARCAS)
  expect_equal(con_titulo[["MITITULO"]], "bold")
  # El subtítulo conserva su cursiva de fábrica en vez de heredar la negrita.
  expect_equal(con_titulo[["MISUBTITULO"]], "italic")

  con_sub <- .caras_de(dibujar("subtitulo"), MARCAS)
  expect_equal(con_sub[["MITITULO"]], "plain")
  expect_equal(con_sub[["MISUBTITULO"]], "bold")
})

test_that("la sonda mide algo: sin marcas no encuentra nada", {
  # El control de la herramienta. Si `.caras_de()` devolviera siempre lo mismo,
  # los tres tests de arriba pasarían sin medir.
  p <- ggplot2::ggplot(data.frame(x = 1, y = 1), ggplot2::aes(x, y)) + ggplot2::geom_point()
  expect_length(.caras_de(p, MARCAS), 0L)
})

test_that("histograma y media de rango: cada parte gobierna la suya", {
  dh <- data.frame(x = c(1, 2, 2, 3, 3, 3, 4, 4, 5))
  esperar_independencia(function(tn) graficar_histograma(
    dh, var = "x", usar_canvas = TRUE, titulo = "MITITULO",
    subtitulo = "MISUBTITULO", nota_pie = "MINOTA", textos_negrita = tn),
    c("titulo", "subtitulo", "nota_pie"), "histograma")

  dm <- data.frame(categoria = c("A", "B"), valor = c(3, 7), stringsAsFactors = FALSE)
  esperar_independencia(function(tn) graficar_media_rango(
    dm, var_categoria = "categoria", var_valor = "valor", usar_canvas = TRUE,
    titulo = "MITITULO", subtitulo = "MISUBTITULO", nota_pie = "MINOTA",
    textos_negrita = tn), c("titulo", "subtitulo", "nota_pie"), "media_rango")
})

test_that("ninguna condición de negrita tiene sus dos ramas iguales", {
  # `if ("titulo" %in% textos_negrita) "bold" else "bold"` — la condición era
  # decorativa y el interruptor no hacía nada. Un grep lo habría visto; mirar el
  # código, no.
  for (f in list.files(file.path("..", "..", "R"), pattern = "^graficador_.*\\.R$", full.names = TRUE)) {
    src <- paste(readLines(f, warn = FALSE), collapse = "\n")
    expect_false(grepl('"bold" else "bold"', src, fixed = TRUE),
                 info = basename(f))
  }
})
