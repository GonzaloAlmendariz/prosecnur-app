source("setup-load-all.R")

# Renzo/Arte (2026-10-22): en la lámina de población de cinco gráficos (3 arriba, 2 abajo) el filete horizontal entre filas
# cubría solo el ancho de la primera pareja de paneles y no pasaba por encima del panel de abajo a la derecha.

.pob_h <- function(tipo) Filter(function(f) identical(f$tipo, "h"), .lam_poblacion_geo(tipo)$filetes)

test_that("población de cinco: un solo filete horizontal entre filas, de borde a borde de los paneles", {
  geo <- .lam_poblacion_geo("p_slide_5_graficos_poblacion")
  h <- .pob_h("p_slide_5_graficos_poblacion")
  expect_length(h, 1L)
  x_min <- min(vapply(geo$paneles, function(p) p$x, 0))
  x_max <- max(vapply(geo$paneles, function(p) p$x + p$w, 0))
  expect_lte(h[[1]]$x0, x_min + 0.01)
  expect_gte(h[[1]]$x1, x_max - 0.01)
})

test_that("población de cinco: el filete horizontal pasa por encima del panel inferior derecho", {
  geo <- .lam_poblacion_geo("p_slide_5_graficos_poblacion")
  h <- .pob_h("p_slide_5_graficos_poblacion")[[1]]
  inf <- geo$paneles[[which.max(vapply(geo$paneles, function(p) p$y, 0) * 1000 + vapply(geo$paneles, function(p) p$x, 0))]]
  expect_lte(h$x0, inf$x + 0.01)
  expect_gte(h$x1, inf$x + inf$w - 0.01)
})
