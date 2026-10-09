# ADR 0093 (N3) — la especificación de una categórica sigue las reglas del recetario.

test_that("las residuales van al final, los ceros no se dibujan y la cifra es la del motor", {
  e <- preparar_categorica(c("Otros", "Alimentos", "No sabe", "Salud", "Educación"),
                           c(0.06, 0.40, 0.03, 0.20, 0), c("6%", "40%", "3%", "20%", "0%"), c(6, 40, 3, 20, 0))
  expect_identical(e$rotulos, c("Alimentos", "Salud", "Otros", "No sabe"))
  expect_identical(e$cifras, c("40%", "20%", "6%", "3%"))
  expect_identical(e$version, "categorica/1")
  expect_true(e$realce)
})

test_that("con dos categorías o un empate en el máximo no hay realce", {
  expect_false(preparar_categorica(c("Sí", "No"), c(.6, .4), c("60%", "40%"))$realce)
  expect_false(preparar_categorica(c("A", "B", "C"), c(.4, .4, .2), c("40%", "40%", "20%"))$realce)
})

test_that("el graficador de categóricas adjunta su especificación en las dos orientaciones", {
  d <- data.frame(categoria = c("Quinto", "Sexto", "Otros"), n = c(22, 19, 3))
  d$pct <- d$n / sum(d$n)
  for (o in c("horizontal", "vertical")) {
    g <- suppressWarnings(graficar_barras_categoricas(
      data = d, var_categoria = "categoria", var_valor = "pct", var_n = "n", var_pct = "pct",
      modo_valor = "valor", formato_valor = "porcentaje_n", orientacion = o, ancho = 12.5, alto = 4.6))
    e <- attr(g, "pulso_espec")
    expect_identical(e$tipo, "categorica", info = o)
    expect_identical(e$rotulos, c("Quinto", "Sexto", "Otros"), info = o)
    expect_false(any(grepl("\\(", e$cifras)), info = o)   # la frecuencia va aparte
    expect_equal(e$n, c(22, 19, 3), info = o)
  }
})

test_that("el largo de cada barra es la cifra rotulada, como en el recetario", {
  e <- preparar_categorica(c("A", "B"), c(0.198, 0.802), c("20%", "80%"))
  expect_equal(e$largos, c(0.20, 0.80))
  sin_pct <- preparar_categorica(c("A", "B"), c(0.3, 0.7), c("3,0", "7,0"))
  expect_equal(sin_pct$largos, c(0.3, 0.7))
})
