source("setup-load-all.R")

.wn_textos <- function(g) { b <- suppressWarnings(ggplot2::ggplot_build(g)); unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label))) }
.wn_p29 <- function(grupos = c("Conoce la misión", "Sabe dónde consultarla")) {
  d <- data.frame(eje = rep(c("Docentes", "Estudiantes", "Egresados", "Administrativos"), 2),
                  grupo = factor(rep(grupos, each = 4), levels = grupos), valor = c(98, 77, 78, 93, 92, 80, 81, 100))
  attr(suppressWarnings(graficar_dumbbell(d, mostrar_brecha = TRUE, orden = "declarado")), "pulso_espec")
}

test_that("los puntos comparativos del Word escriben las cifras y la diferencia de la página 29 desde la espec de pesas", {
  g <- .word_g_pesas(.wn_p29())
  tx <- .wn_textos(g)
  expect_true(all(c("98%", "92%", "77%", "80%", "+6 pts", "-3 pts", "-7 pts", "Diferencia", "Docentes") %in% tx))
  expect_equal(attr(g, "alto"), 0.5 + 0.42 * 4)
})

test_that("entre años la diferencia sube en verde y baja en coral; entre públicos va en azul (recetario_word_graficos.R:140)", {
  colores_dif <- function(e) { b <- suppressWarnings(ggplot2::ggplot_build(.word_g_pesas(e)))
    l <- Filter(function(l) "label" %in% names(l) && any(grepl("pts$", l$label)), b$data)[[1]]; stats::setNames(l$colour, l$label) }
  anios <- colores_dif(.wn_p29(c("2026", "2021")))
  expect_identical(unname(anios["+6 pts"]), .WORD_TINTA$verde)
  expect_identical(unname(anios["-3 pts"]), .WORD_TINTA$coral)
  publicos <- colores_dif(.wn_p29())
  expect_true(all(publicos == .std_word("colores", "titulos")))
})

test_that("el histograma del Word pone el triángulo en la mediana real y su texto desde la espec", {
  x <- rep(19:30, c(9, 30, 35, 32, 25, 10, 13, 5, 5, 3, 1, 2))
  e <- attr(.histograma_recetario(x, modo = "conteo", unidad = "años"), "pulso_espec")
  g <- .word_g_hist(e)
  expect_true(all(c("Mediana: 22 años", "35", "19", "30") %in% .wn_textos(g)))
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  tri <- Filter(function(l) "shape" %in% names(l) && any(l$shape == 17), b$data)[[1]]
  expect_equal(tri$x, e$x_mediana + 1)
})

test_that("promedios, media y rango y caja leen sus especs y la mayor de los promedios va en azul oscuro", {
  e17 <- list(rotulos = c("Quinto", "Sexto", "Noveno"), valores = c(20.5, 22.5, 23.7), cifras = c("20.5 años", "22.5 años", "23.7 años"))
  b <- suppressWarnings(ggplot2::ggplot_build(.word_g_promedios(e17)))
  expect_identical(b$data[[1]]$fill[which.max(b$data[[1]]$y)], .WORD_TINTA$navy)
  e19 <- list(rotulos = c("Docentes", "Estudiantes"), media = c(46.9, 22.5), cifras = c("46.9", "22.5"), inf = c(27, 19), sup = c(71, 40))
  expect_true(all(c("46.9", "22.5", "27", "71", "19", "40", "Docentes") %in% .wn_textos(.word_g_rango(e19))))
  bx <- preparar_boxplot(rep(c("A", "B"), c(5, 5)), c(19, 20, 20, 21, 30, 20, 21, 22, 22, 23))
  gb <- .word_g_boxplot(bx)
  expect_true(all(c("20", "22") %in% .wn_textos(gb)))
  bb <- suppressWarnings(ggplot2::ggplot_build(gb))
  expect_true(any(vapply(bb$data, function(l) "y" %in% names(l) && any(l$y == 30), TRUE)))   # el atípico se dibuja
})
