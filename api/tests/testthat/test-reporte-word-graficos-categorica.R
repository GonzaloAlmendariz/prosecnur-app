source("setup-load-all.R")

.wc_textos <- function(g) { b <- suppressWarnings(ggplot2::ggplot_build(g)); unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label))) }

test_that("las barras Word leen la espec: residual al final en gris, la mayor en azul y agrupadas de 0 a 100 %", {
  e <- preparar_categorica(c("Redes sociales", "Un amigo", "Otro"), c(.45, .30, .25), c("45%", "30%", "25%"))
  g <- .word_g_barras(e)
  expect_true(all(c("45%", "30%", "25%", "Redes sociales") %in% .wc_textos(g)))
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  rect <- b$data[[1]]
  expect_identical(rect$fill[rect$xmax == max(rect$xmax)], .WORD_TINTA$navy)
  expect_equal(b$layout$panel_params[[1]]$x.range[2], 45 * 1.18)               # sin marca: al máximo con aire
  e$escala_completa <- TRUE
  b2 <- suppressWarnings(ggplot2::ggplot_build(.word_g_barras(e)))
  expect_equal(b2$layout$panel_params[[1]]$x.range[2], 112)                     # agrupadas: 0-100 %, con aire para la cifra
  expect_equal(attr(g, "alto"), .word_alto_figura("barras", 3))
})

test_that("la dicotomía escribe las dos cifras grandes y sus rótulos con la base", {
  e <- preparar_categorica(c("Sí", "No"), c(.31, .69), c("31%", "69%"), n = c(56, 122))
  tx <- .wc_textos(.word_g_sino(e))
  expect_true(all(c("31%", "69%", "Sí (56)", "No (122)") %in% tx))
})

test_that("el lollipop ordena de menor a mayor y rotula cada punto", {
  e <- preparar_categorica(c("A", "B", "C"), c(.2, .5, .3), c("20%", "50%", "30%"))
  g <- .word_g_lollipop(e)
  expect_identical(levels(g$data$l), c("A", "C", "B"))
  expect_true(all(c("20%", "30%", "50%") %in% .wc_textos(g)))
})

test_that("las divergentes ponen el desacuerdo a la izquierda, el acuerdo a la derecha y los totales a cada lado", {
  d <- data.frame(item = c("Me siento seguro", "Recomendaría el servicio"), a = c(5, 10), b = c(15, 20), c = c(50, 40), e = c(30, 30))
  et <- c(a = "Totalmente en desacuerdo", b = "En desacuerdo", c = "De acuerdo", e = "Totalmente de acuerdo")
  esp <- .espec_divergentes(d, "item", c("a", "b", "c", "e"), et, particion = list(negativas = c("a", "b"), neutro = character(0), positivas = c("c", "e")))
  g <- .word_g_divergente(esp)
  tx <- .wc_textos(g)
  expect_true(all(c(esp$cifras_neg, esp$cifras_pos) %in% tx))
  b <- suppressWarnings(ggplot2::ggplot_build(g)); r <- b$data[[1]]
  expect_true(all(r$xmax[r$fill %in% esp$categorias$color[esp$categorias$lado == "neg"]] <= 0))
  expect_true(all(r$xmin[r$fill %in% esp$categorias$color[esp$categorias$lado == "pos"]] >= 0))
})

test_that("un rótulo largo nunca se corta: la columna se ensancha hasta tres líneas y, si no basta, la fila crece (Gonzalo, 2026-10-09)", {
  largo <- "Integración de herramientas digitales para diseño, simulación, software especializado, análisis de datos e inteligencia artificial"
  e <- preparar_categorica(c(largo, "Corta"), c(.29, .15), c("29%", "15%"))
  tx <- .wc_textos(.word_g_barras(e))
  rot <- tx[grepl("^Integración", tx)]
  expect_length(rot, 1L)
  expect_identical(gsub("\n", " ", rot), largo)                          # el texto entero, sin «...»
  expect_lte(length(strsplit(rot, "\n")[[1]]), 3L)
  expect_false(any(grepl("\\.\\.\\.", tx)))
  expect_identical(.word_envolver_holgado("Corta", 40), "Corta")          # lo corto no se toca
  enorme <- strrep("palabra ", 40)                                         # ni al ancho máximo cabe en tres: crece en líneas, no se corta
  expect_identical(gsub("\n", " ", .word_envolver_holgado(enorme, 40)), trimws(enorme))
})

test_that("en la ruta real las barras agrupadas llegan al Word de 0 a 100 % y con eje libre al máximo (Gonzalo, 2026-10-09)", {
  d <- data.frame(categoria = c("Redes sociales", "Un amigo", "Otro"), N = c(45, 30, 25), pct = c(.45, .30, .25), stringsAsFactors = FALSE)
  rango <- function(...) {
    e <- attr(suppressWarnings(graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct",
                                                         etiquetas_series = c(pct = "Total"), ...)), "pulso_espec")
    suppressWarnings(ggplot2::ggplot_build(.word_g_barras(e)))$layout$panel_params[[1]]$x.range[2]
  }
  expect_equal(rango(), 112)                                  # 100 % con aire para la cifra
  expect_lt(rango(usar_eje_libre = TRUE), 100)                # eje libre: al máximo (45 %) con aire
})
