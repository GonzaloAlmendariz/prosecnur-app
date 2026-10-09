# ADR 0092 (F2.2) — las preguntas categóricas salen como las barras horizontales
# del recetario (`barras_h`): residuales al final, la mayor en azul y en negrita,
# el resto en el tono de apoyo, y el grosor de la tabla `categorias`.

.cat_h <- function(categoria, n, ...) {
  d <- data.frame(categoria = categoria, n = n, stringsAsFactors = FALSE)
  d$pct <- d$n / sum(d$n)
  suppressWarnings(graficar_barras_categoricas(
    data = d, var_categoria = "categoria", var_valor = "pct", var_n = "n", var_pct = "pct",
    modo_valor = "valor", formato_valor = "porcentaje", ancho = 12.5, alto = 4.6, ...
  ))
}

test_that("por defecto la pregunta categórica es horizontal y sin eje", {
  p <- .cat_h(c("A", "B", "C"), c(5, 3, 2))
  expect_false(is.null(attr(p, "pulso_barras_horizontales_layout")))
  b <- ggplot2::ggplot_build(p)$data[[1]]
  # horizontales: todas las barras arrancan en x = 0 y crecen a lo largo de x
  expect_true(all(b$xmin == 0))
  expect_equal(sort(round(b$xmax, 2)), c(0.2, 0.3, 0.5))
})

test_that("las residuales van al final aunque el instrumento las ponga antes", {
  p <- .cat_h(c("Alimentos", "Otros", "Salud", "No sabe", "Educación"), c(40, 6, 20, 3, 10))
  orden <- attr(p, "pulso_barras_horizontales_layout")$orden
  expect_identical(tail(orden, 2), c("Otros", "No sabe"))
})

test_that("con más de dos categorías y un máximo único, la mayor va en azul y el resto en tenue", {
  p <- .cat_h(c("A", "B", "C", "D"), c(10, 40, 20, 5))
  b <- ggplot2::ggplot_build(p)$data[[1]]
  cats <- .std_paleta("categorias")
  expect_equal(sum(b$fill == cats$mayor), 1L)
  expect_equal(sum(b$fill == cats$resto), 3L)
  expect_true(attr(p, "pulso_barras_horizontales_layout")$realce)
  # el rótulo de la mayor, en negrita
  rot <- ggplot2::ggplot_build(p)$data[[2]]
  expect_equal(rot$fontface[rot$label == "B"], "bold")
})

test_that("con un empate en el máximo no hay realce", {
  p <- .cat_h(c("A", "B", "C"), c(40, 40, 20))
  expect_false(attr(p, "pulso_barras_horizontales_layout")$realce)
})

test_that("una paleta que nombra las categorías del proyecto se respeta", {
  p <- .cat_h(c("A", "B", "C"), c(10, 40, 20), colores_categorias = list(A = "#111111", B = "#222222", C = "#333333"))
  b <- ggplot2::ggplot_build(p)$data[[1]]
  expect_setequal(b$fill, c("#111111", "#222222", "#333333"))
  expect_false(attr(p, "pulso_barras_horizontales_layout")$realce)
})

test_that("el grosor sale de la tabla de categorías por número de filas", {
  for (n in c(3, 5, 7, 9)) {  # con 2 va la dicotomía partida
    p <- .cat_h(paste("Categoría", seq_len(n)), seq_len(n) * 3)
    expect_lte(abs(attr(p, "pulso_barras_horizontales_layout")$grosor_in - .std_grosor(n, "categorias")), 0.01,
               label = paste(n, "filas"))
  }
})

test_that("orientacion = 'vertical' conserva las columnas previas", {
  p <- .cat_h(c("A", "B", "C"), c(5, 3, 2), orientacion = "vertical")
  expect_null(attr(p, "pulso_barras_horizontales_layout"))
})

test_that("dos categorías sin paleta propia salen como la dicotomía partida del recetario", {
  p <- .cat_h(c("Sí", "No"), c(126, 46))
  lay <- attr(p, "pulso_barras_horizontales_layout")
  expect_true(isTRUE(lay$dicotomia))
  expect_equal(lay$grosor_in, 0.34)
  textos <- unlist(lapply(ggplot2::ggplot_build(p)$data, function(d) d$label))
  expect_true(all(c("73%", "27%", "Sí", "No") %in% textos))
})

test_that("dos categorías con paleta propia siguen en barras", {
  p <- .cat_h(c("Sí", "No"), c(126, 46), colores_categorias = list("Sí" = "#111111", No = "#222222"))
  expect_false(isTRUE(attr(p, "pulso_barras_horizontales_layout")$dicotomia))
})

test_that("una categoría en 0 % se dibuja si llega (verificador de F2)", {
  p <- .cat_h(c("A", "B", "C", "D"), c(5, 3, 2, 0))
  expect_length(attr(p, "pulso_barras_horizontales_layout")$orden, 4L)
})

test_that("dos categorías que no suman 100 % no se dibujan como dicotomía partida", {
  d <- data.frame(categoria = c("Sí", "No"), n = c(60, 25), pct = c(0.6, 0.25))
  p <- suppressWarnings(graficar_barras_categoricas(
    data = d, var_categoria = "categoria", var_valor = "pct", var_n = "n", var_pct = "pct",
    modo_valor = "valor", formato_valor = "porcentaje", ancho = 12.5, alto = 4.6))
  expect_false(isTRUE(attr(p, "pulso_barras_horizontales_layout")$dicotomia))
})

test_that("el Word calibra la categórica a su lienzo y a su tamaño de rótulo", {
  el <- list(overrides = list())
  out <- .word_ajustar_el(el, "barras_categoricas", word_image = NULL)
  expect_true(is.numeric(out$overrides$ancho) && is.numeric(out$overrides$alto))
  expect_equal(out$overrides$size_rotulos_h, .std_word("tipografia", "grafico_rotulo"))
  # y el rótulo más largo cabe en el lienzo de Word
  p <- .cat_h(c("Redes sociales", "Familia", "Otros"), c(20, 40, 9),
              size_rotulos_h = out$overrides$size_rotulos_h)
  expect_lte(attr(p, "pulso_barras_horizontales_layout")$ancho_rotulo_in, 0.32 * 12.5)
})
