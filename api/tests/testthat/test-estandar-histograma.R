# ADR 0092 (F2.7c) — el histograma del recetario: una barra por valor, su cifra
# encima, la mediana como triángulo coral y su cifra arriba a la derecha.

test_that("una serie de enteros sale con una barra por valor y la mediana marcada", {
  edad <- c(rep(18, 3), rep(19, 5), rep(20, 8), rep(21, 4), rep(23, 2))
  p <- suppressWarnings(graficar_histograma(data.frame(edad = edad), var = "edad", exportar = "rplot"))
  info <- attr(p, "pulso_histograma_recetario")
  expect_false(is.null(info))
  expect_equal(info$niveles, 18:23)
  expect_equal(info$conteos, c(3, 5, 8, 4, 0, 2))
  expect_equal(info$mediana, 20)
  textos <- unlist(lapply(ggplot2::ggplot_build(p)$data, function(d) as.character(d$label)))
  expect_true("Mediana: 20 años" %in% textos)
  expect_true("36%" %in% textos)   # 8 de 22
})

test_that("el límite superior junta lo que lo supera en una barra «N+»", {
  edad <- c(18, 19, 20, 31, 35, 40)
  p <- suppressWarnings(graficar_histograma(data.frame(edad = edad), var = "edad", limite_superior = 30, exportar = "rplot"))
  textos <- unlist(lapply(ggplot2::ggplot_build(p)$data, function(d) as.character(d$label)))
  expect_true("30+" %in% textos)
})

test_that("con grupo, intervalos declarados o valores continuos sigue el estilo clásico", {
  d <- data.frame(edad = c(18, 19, 20, 21), sexo = c("H", "M", "H", "M"))
  expect_null(attr(suppressWarnings(graficar_histograma(d, var = "edad", grupo = "sexo", exportar = "rplot")), "pulso_histograma_recetario"))
  expect_null(attr(suppressWarnings(graficar_histograma(d, var = "edad", ancho_bin = 2, exportar = "rplot")), "pulso_histograma_recetario"))
  expect_null(attr(suppressWarnings(graficar_histograma(data.frame(x = c(1.5, 2.25, 3.1)), var = "x", exportar = "rplot")), "pulso_histograma_recetario"))
})
