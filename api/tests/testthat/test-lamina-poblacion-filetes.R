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

test_that("CCSS-30: población de seis lleva filete vertical entre los paneles de AMBAS filas", {
  # El filete de abajo cae en la misma x que el de arriba y la deduplicación por `tipo + x` lo descartaba: la fila de
  # abajo quedaba sin separadores. Se unen en uno continuo por columna, como en la grilla de cuatro.
  geo <- .lam_poblacion_geo("p_slide_6_graficos_poblacion")
  v <- Filter(function(f) identical(f$tipo, "v"), geo$filetes)
  ys <- sort(unique(round(vapply(geo$paneles, function(p) p$y, 0), 2)))
  expect_length(ys, 2L)
  abajo <- Filter(function(p) round(p$y, 2) == ys[2], geo$paneles)
  arriba <- Filter(function(p) round(p$y, 2) == ys[1], geo$paneles)
  for (fila in list(arriba, abajo)) {
    y0 <- fila[[1]]$y; y1 <- fila[[1]]$y + fila[[1]]$h
    cubre <- vapply(v, function(f) f$y0 <= y0 + 0.01 && f$y1 >= y1 - 0.01, logical(1))
    expect_gte(sum(cubre), length(fila) - 1L)
  }
})
