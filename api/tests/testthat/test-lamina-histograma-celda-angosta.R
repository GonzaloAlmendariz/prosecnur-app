# CCSS-23 (CCSS Perfil 2026, `p_slide_6_graficos_poblacion`): el histograma de edad en una celda de 3.9 in encimaba sus
# porcentajes («21%26%18%»), pisaba los números del eje y la línea base tachaba el «18». En una celda angosta el
# histograma rotula sólo las cifras que caben (primero la moda y la de la mediana), los valores del eje que caben sin
# tocarse (siempre el de la mediana) y los pone como texto del eje, que no cruza la base. A lámina completa no cambia.

.hc_x <- function() c(rep(18, 1), rep(19, 28), rep(20, 83), rep(21, 103), rep(22, 71), rep(23, 56), rep(24, 28), rep(25, 8),
                      rep(26, 8), rep(27, 4), rep(28, 1), rep(29, 4), rep(31, 3))

test_that("a lámina completa rotula todas las barras, como siempre", {
  p <- .histograma_recetario(.hc_x(), limite_superior = 30, ancho = 12.5)
  h <- attr(p, "pulso_histograma_recetario")
  expect_true(all(h$cifra_visible[nzchar(attr(p, "pulso_espec")$cifras)]))
  expect_true(all(h$rotulo_visible))
})

test_that("en una celda de 3.9 in ninguna cifra ni valor del eje se encima con su vecino", {
  p <- .histograma_recetario(.hc_x(), limite_superior = 30, ancho = 3.9)
  h <- attr(p, "pulso_histograma_recetario"); e <- attr(p, "pulso_espec")
  sc <- which(h$cifra_visible); sr <- which(h$rotulo_visible)
  w_c <- .lam_ancho_tinta(e$cifras[sc], h$size_cifra, TRUE); w_r <- .lam_ancho_tinta(e$rotulos[sr], h$size_eje)
  expect_gte(length(sc), 2L)
  expect_true(all(diff(sc) * h$wcol >= (head(w_c, -1) + tail(w_c, -1)) / 2 + 0.03 - 1e-9))
  expect_true(all(diff(sr) * h$wcol >= (head(w_r, -1) + tail(w_r, -1)) / 2 + 0.03 - 1e-9))
  moda <- which.max(e$valores); med <- e$x_mediana + 1
  expect_true(h$cifra_visible[moda])
  expect_true(h$rotulo_visible[med])
  expect_true(h$en_eje)                                          # los valores van como texto del eje: no cruzan la base
  expect_lt(sum(h$cifra_visible), sum(nzchar(e$cifras)))
})

test_that("graficar_histograma pasa el ancho de su cajón al histograma", {
  d <- data.frame(edad = .hc_x())
  p <- suppressWarnings(graficar_histograma(d, var = "edad", limite_superior = 30, ancho = 3.9))
  expect_true(isTRUE(attr(p, "pulso_histograma_recetario")$en_eje))
})
