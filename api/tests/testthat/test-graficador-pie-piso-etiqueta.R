# ggplot mide `size` en milimetros de altura; a puntos, x 2.845.
GG_A_PT <- 2.845


test_that("el piso de la etiqueta de un pie son 8 pt", {
  # 2.6 —el piso anterior— son 7.39 pt, y asi salian las cifras de los
  # cuadrantes de perfil: «31% (56)» en blanco sobre el segmento. El entregable
  # aprobado no baja de 8 pt en ninguna lamina.
  piso <- 2.81
  expect_equal(piso * GG_A_PT, 8.0, tolerance = 0.02)
  expect_gt(piso * GG_A_PT, 2.6 * GG_A_PT)
})


test_that("el piso esta declarado en el graficador y no se ha bajado", {
  # Guarda contra una regresion silenciosa: si alguien vuelve a 2.6, el mazo
  # recupera las cifras a 7.4 pt sin que ninguna vara lo note —R3 mide una
  # PROPORCION y 8 textos sobre 2459 no la mueven—.
  f <- readLines(
    testthat::test_path("..", "..", "R", "graficador_pie_dicotomico.R"),
    warn = FALSE
  )
  linea <- grep("size_etiquetas_pct <- max\\(", f, value = TRUE)
  expect_length(linea, 1L)
  piso <- as.numeric(sub(".*max\\(([0-9.]+),.*", "\\1", linea))
  expect_gte(piso * GG_A_PT, 8.0 - 0.02)
})
