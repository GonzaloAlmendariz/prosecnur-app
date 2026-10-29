# El panel reserva para su pregunta las mismas líneas que dibuja: el gráfico arranca bajo la última línea.
# La reserva vieja dividía la tinta por el ancho y quedaba una línea corta (64 de 369 preguntas de las muestras a 4 in).

test_that("las barras de un panel arrancan bajo la pregunta que el panel dibuja", {
  cat3 <- list(tipo = "categorica", rotulos = c("Sí", "No", "No sabe"), largos = c(0.5, 0.3, 0.2),
               valores = c(0.5, 0.3, 0.2), cifras = c("50%", "30%", "20%"))
  q <- "Las funciones y atribuciones de las autoridades de la Unidad están claramente definidas"
  x <- 0.5; y <- 1.65; w <- 4
  lz <- .lam_lienzo()
  fin_pregunta <- .lam_panel_titulo(lz, x, y, w, q)
  corta <- .lam_panel_geo(cat3, x, y, w, 5, pregunta = "Sexo")
  larga <- .lam_panel_geo(cat3, x, y, w, 5, pregunta = q)
  expect_identical(larga$tipo, "barras")
  # Lo que la pregunta larga empuja el gráfico es lo que crece su caja dibujada.
  expect_equal(larga$y0 - corta$y0, fin_pregunta - .lam_panel_titulo(.lam_lienzo(), x, y, w, "Sexo"), tolerance = 1e-9)
  expect_equal(.lam_panel_lineas(q, w), .lam_lineas_tinta(q, w, .std_pt("pregunta"), TRUE))
  expect_gte(.lam_panel_lineas(q, w), 3)
})
