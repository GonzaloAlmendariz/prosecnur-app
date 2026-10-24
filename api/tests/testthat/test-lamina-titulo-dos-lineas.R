source("setup-load-all.R")
source("test-lamina-bloque-titulo.R", local = TRUE)

# CCSS Perfil 2026 (lámina 34): un título de dos líneas se montaba sobre el subtítulo en la ruta anterior (el subtítulo iba bajo la caja
# de UNA línea). El bloque título + subtítulo mide su alto real y empuja el subtítulo y el inicio del gráfico.

.td_titulo2 <- "Quienes vienen de un colegio estatal se esfuerzan por igual en todos sus cursos con más frecuencia"

test_that("con título de dos líneas el subtítulo queda bajo la última línea y el gráfico bajo el subtítulo", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  expect_equal(.lam_lineas_tinta(.td_titulo2, 10.4, .std_pt("titulo"), TRUE)[1], 2)
  c <- .bt_cajas(.bt_render(.bt_agrupada(), titulo = .td_titulo2, subtitulo = "67 % de quienes estudiaron en un colegio estatal, frente al 49 %."))
  tit <- c[c$nombre == "Titulo lamina", ]; sub <- c[c$nombre == "Subtitulo lamina", ]
  fin_titulo <- tit$y + 0.06 + 2 * .std_pt("titulo") * 1.2 / 72
  expect_gte(sub$y, fin_titulo - 0.12)   # el subtítulo arranca bajo la segunda línea (la caja tiene su sangría superior)
  graf <- c[grepl("^tx[0-9]+$", c$nombre), ]
  expect_gt(nrow(graf), 0)
  expect_gte(min(graf$y), sub$y + sub$h - 0.05)   # nada del gráfico sube sobre el subtítulo
})

test_that("con título de una línea el bloque no se mueve", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  c <- .bt_cajas(.bt_render(.bt_agrupada(), titulo = "Título corto", subtitulo = "Subtítulo"))
  expect_equal(c$y[c$nombre == "Subtitulo lamina"], .std_geom("titulo_y") + 0.55, tolerance = 0.01)
})
