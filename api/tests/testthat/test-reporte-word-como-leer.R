source("setup-load-all.R")

.wl_xml <- function(doc) { f <- tempfile(fileext = ".docx"); print(doc, target = f); d <- tempfile(); utils::unzip(f, exdir = d)
  paste(readLines(file.path(d, "word", "document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "") }

test_that("«Cómo leer este informe» lleva Top y Bottom Two Box, las dos tablas del redondeo, las redacciones, las cifras pequeñas y el recuadro", {
  doc <- .word_como_leer(.word_documento_nuevo(), numero = 2, redondeo = "resto_mayor")
  x <- .wl_xml(doc)
  for (t in c("2.1. Top Two Box", "2.2. Bottom Two Box", "Redondeo del resto mayor", "Redacciones de la escala", "2.5. Cifras muy pequeñas",
              "método del resto mayor", "No he usado el servicio")) expect_match(x, t, fixed = TRUE)
  expect_equal(unname(attr(doc, "siguientes")), c(4L, 4L))                      # 3 figuras y 3 tablas: los siguientes son 4 y 4
  expect_match(x, 'w:fill="F3F5F8"', fixed = TRUE)                              # el recuadro
})

test_that("sin Bottom Two Box ni resto mayor, el capítulo no lo nombra y el recuadro dice el redondeo estándar", {
  doc <- .word_como_leer(.word_documento_nuevo(), con_bottom = FALSE)
  x <- .wl_xml(doc)
  expect_false(grepl("Bottom Two Box", x, fixed = TRUE))
  expect_match(x, "por separado (desde 0.5 sube)", fixed = TRUE)
  expect_equal(unname(attr(doc, "siguientes")), c(3L, 4L))
})

test_that("las cifras del ejemplo de redondeo son las del recetario: el estándar suma 101 y el resto mayor 100", {
  x <- .wl_xml(.word_como_leer(.word_documento_nuevo()))
  expect_match(x, "101%", fixed = TRUE); expect_match(x, "0.56%", fixed = TRUE)
  expect_match(x, "Faltan 3 puntos", fixed = TRUE)
})

test_that("una figura sin base no se pega a lo que sigue (encadenaba el capítulo a otra página)", {
  png <- .word_png(.word_g_box_explica(), 1.68)
  x <- .wl_xml(.word_figura(.word_documento_nuevo(), 1, "Ejemplo", png, alto = 1.68))
  img <- regmatches(x, regexpr("<w:p>(?:(?!</w:p>).)*<w:drawing>", x, perl = TRUE))
  expect_false(grepl("keepNext", img, fixed = TRUE))
})

test_that("el Word recetario declara el redondeo que usa el informe, no siempre el estándar (inventario F6, A4)", {
  pre <- function(...) { m <- list(...); lapply(m, function(x) list(args = list(metodo_redondeo = x))) }
  expect_identical(.word_redondeo_documento(list(), pre(barras_apiladas = "reparto")), "resto_mayor")
  expect_identical(.word_redondeo_documento(list(), pre(barras_apiladas = "reparto", pie = "estandar")), "ambos")
  expect_identical(.word_redondeo_documento(list(), list()), "estandar")
  expect_identical(.word_redondeo_documento(list(redondeo = "estandar"), pre(barras_apiladas = "reparto")), "estandar")   # lo pedido gana
  x <- .wl_xml(.word_como_leer(.word_documento_nuevo(), redondeo = "ambos"))
  expect_match(x, "Unos gráficos redondean cada cifra por separado", fixed = TRUE)
})
