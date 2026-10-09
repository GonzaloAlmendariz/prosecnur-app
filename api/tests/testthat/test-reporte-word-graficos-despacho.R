source("setup-load-all.R")

test_that("el despacho elige el renderer del Word por la espec real del graficador", {
  d <- data.frame(categoria = c("Redes sociales", "Un amigo", "Otro"), N = c(45, 30, 25), pct = c(.45, .30, .25), stringsAsFactors = FALSE)
  p <- suppressWarnings(graficar_barras_agrupadas(data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total")))
  g <- .word_grafico(p)
  expect_identical(attr(g, "renderer"), "categorica")
  expect_gt(attr(g, "alto"), 0)
  sn <- data.frame(categoria = c("Sí", "No"), N = c(30, 10), pct = c(.75, .25), stringsAsFactors = FALSE)
  ps <- suppressWarnings(graficar_barras_agrupadas(data = sn, var_categoria = "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total")))
  expect_true(any(grepl("75%", unlist(lapply(suppressWarnings(ggplot2::ggplot_build(.word_grafico(ps)))$data, function(l) l$label)))))
  dd <- data.frame(eje = rep(c("A", "B"), 2), grupo = factor(rep(c("x", "y"), each = 2), levels = c("x", "y")), valor = c(60, 40, 50, 45))
  expect_identical(attr(.word_grafico(suppressWarnings(graficar_dumbbell(dd, mostrar_brecha = TRUE))), "renderer"), "pesas")
})

test_that("sin renderer propio el ggplot va en su marco: sin título, subtítulo ni pie y con fondo vacío", {
  p <- ggplot2::ggplot(data.frame(x = 1:3, y = 1:3), ggplot2::aes(.data$x, .data$y)) + ggplot2::geom_line() +
    ggplot2::labs(title = "T", subtitle = "S", caption = "C")
  g <- .word_grafico(p)
  expect_identical(attr(g, "renderer"), "marco")
  expect_null(g$labels$title); expect_null(g$labels$subtitle); expect_null(g$labels$caption)
  expect_equal(attr(g, "alto"), 2.6)
  attr(p, "pulso_espec") <- list(tipo = "pie", rotulos = "roto")          # una espec rota no tumba el Word: cae al marco
  expect_message(g2 <- .word_grafico(p), "renderer «pie» falló")
  expect_identical(attr(g2, "renderer"), "marco")
})
