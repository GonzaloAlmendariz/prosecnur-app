source("setup-load-all.R")

.wo_textos <- function(g) { b <- suppressWarnings(ggplot2::ggplot_build(g)); unlist(lapply(b$data, function(l) if ("label" %in% names(l)) as.character(l$label))) }

test_that("la dona del Word pone la cifra mayor al centro y las demás en sus porciones; la dicotomía va en torta (página 25)", {
  d <- data.frame(cat = c("Dependiente", "Independiente", "No trabaja", "Estudia"), pct = c(.62, .21, .11, .06), n = c(110, 37, 20, 11))
  e <- attr(suppressWarnings(graficar_pie(d, "cat", "pct", "n", tipo_pie = "donut")), "pulso_espec")
  tx <- .wo_textos(.word_g_pie(e))
  expect_true(all(c("62%", "21%", "11%", "6%") %in% tx))
  expect_equal(sum(tx == "62%"), 1L)                                       # la mayor sólo al centro
  d2 <- data.frame(cat = c("Sí", "No"), pct = c(.31, .69), n = c(56, 122))
  e2 <- attr(suppressWarnings(graficar_pie(d2, "cat", "pct", "n", tipo_pie = "donut")), "pulso_espec")
  g2 <- .word_g_pie(e2)
  expect_true(all(c("31%", "69%") %in% .wo_textos(g2)))                  # dos porciones: torta con las dos cifras dentro
  expect_equal(attr(g2, "alto"), 2.6 - 0.22)
})

test_that("el mapa de calor del Word colorea por el valor crudo dentro del rango, la cifra oscura en blanco y crece con sus filas", {
  M <- rbind(c(95, 80, 100), c(97, 89, 100)); Mc <- M; Mc[1, 2] <- 80.4
  e <- list(filas = c("Competencias técnicas", "Visión empresarial"), columnas = data.frame(rotulo = c("Total", "Quinto", "Sexto")),
            valores = M, valores_crudos = Mc, rango = c(80, 100))
  g <- .word_g_heat(e)
  b <- suppressWarnings(ggplot2::ggplot_build(g)); t <- b$data[[1]]
  rampa <- grDevices::colorRampPalette(c("#EEF2F8", "#2F4B7C"))(41)
  expect_identical(t$fill[t$x == 2 & t$y == 2], rampa[2])                  # se lee 80 %, pero el crudo 80.4 cae en el 2.º tramo
  expect_identical(t$fill[t$x == 2 & t$y == 1], rampa[19])                 # 89 % → tramo 19 de 41
  expect_identical(t$fill[t$x == 3 & t$y == 2], "#2F4B7C")                # 100 % = el más oscuro
  txt <- b$data[[2]]
  expect_identical(txt$colour[txt$label == "100%"][1], "#FFFFFF")
  expect_true(all(c("95%", "80%", "Total", "Competencias técnicas") %in% .wo_textos(g)))
  e$filas <- c(e$filas, "Tercera"); e$valores <- rbind(M, c(90, 90, 90)); e$valores_crudos <- e$valores
  expect_gt(attr(.word_g_heat(e), "alto"), attr(g, "alto"))
})

test_that("el comparativo de dimensiones del Word escribe la diferencia CON signo, primera menos segunda (página 32)", {
  V <- cbind(Masculino = c(94, 98, 96), Femenino = c(97, 96, 98))
  e <- list(filas = c("Técnicas", "Visión", "Transversales"), grupos = colnames(V), valores = V,
            textos_diferencia = c("3 pts", "2 pts", "2 pts"))                      # la espec del PPT, sin signo
  tx <- .wo_textos(.word_g_comparativo_dim(e))
  expect_true(all(c("-3 pts", "+2 pts", "-2 pts", "94%", "97%", "Diferencia") %in% tx))
  expect_false("3 pts" %in% tx)
})

test_that("los puntos por competencia ordenan los ejes por su promedio con el mayor arriba y crecen con los ejes", {
  M <- cbind(D = c(99, 92, 95), E = c(96, 93, 96), G = c(98, 93, 97))
  e <- list(ejes = c("Alta", "Baja", "Media"), grupos = colnames(M), valores = M)
  g <- .word_g_competencias(e)
  expect_identical(levels(g$layers[[2]]$data$c), c("Baja", "Media", "Alta"))      # ggplot: el último nivel va arriba
  expect_equal(attr(g, "alto"), 0.58 + 0.3 * 3)
})

test_that("radar y puntos por competencia leen radar/1 en su escala de 0 a 1 y la dibujan en por ciento", {
  M <- cbind(D = c(.99, .92, .95), E = c(.96, .93, .96)); rownames(M) <- c("A", "B", "C")
  e <- list(ejes = c("A", "B", "C"), grupos = c("D", "E"), valores = M, lo = 80)
  g <- .word_g_radar(e)
  expect_true(all(c("85%", "90%", "95%", "100%", "A") %in% .wo_textos(g)))
  ser <- g$layers[[3]]$data
  expect_equal(ser$y[ser$a == "D"][1], (99 - 80) / 20)                       # 0.99 → 99 % → radio (99-80)/20 sobre el primer eje
  expect_equal(attr(g, "alto"), 3.4 - 0.22)
  gc <- .word_g_competencias(e)
  expect_true(all(gc$layers[[2]]$data$v > 1))                               # en por ciento, no 0.99
})
