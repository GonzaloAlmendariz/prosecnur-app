# Uso del área de datos: barras horizontales con pocas categorías (CCSS, 2026-10-24)
espec_n <- function(n) list(largos = seq(0.5, 0.1, length.out = n), rotulos = paste("Opción", seq_len(n)))

test_that("con pocas categorías la fila crece hasta el tope y la barra no pasa de 0.55 in", {
  g4 <- .lam_barras_geo(espec_n(4)); g6 <- .lam_barras_geo(espec_n(6))
  expect_gt(g4$fila, 0.62); expect_lte(g4$fila, 0.88 + 1e-9)
  expect_lte(g4$g, 0.55 + 1e-9); expect_gt(g4$g, 0.42)
  expect_gt(g6$fila, 0.62)
})

test_that("con 8 o más categorías la geometría no cambia", {
  disp <- .std_geom("contenido_y1") - .std_geom("zona_datos_y0") - 0.45
  for (n in c(8, 10, 12)) {
    g <- .lam_barras_geo(espec_n(n))
    expect_equal(g$fila, min(0.62, disp / n)); expect_equal(g$g, min(0.42, g$fila * 0.62))
  }
})

test_that("el bloque se centra y queda entre zona_datos_y0 y contenido_y1 para 4, 5, 6, 8 y 12 categorías", {
  yt <- .std_geom("zona_datos_y0"); yf <- .std_geom("contenido_y1")
  sup <- numeric(); inf <- numeric()
  for (n in c(4, 5, 6, 8, 12)) {
    g <- .lam_barras_geo(espec_n(n)); y0 <- yt + .lam_uso_area_arranque(n, g$fila)
    expect_gte(y0, yt + 0.2 - 1e-9)
    expect_lte(y0 + n * g$fila, yf - 0.2 + 1e-9)
    sup <- c(sup, y0 - yt); inf <- c(inf, yf - (y0 + n * g$fila))
  }
  # con 4 categorías el aire de arriba y de abajo es parecido (centrado), no pegado arriba
  expect_lt(abs((sup[1] - 0.2) - (inf[1] - 0.25)), 0.3)
  expect_gt(sup[1], 0.3)
})
