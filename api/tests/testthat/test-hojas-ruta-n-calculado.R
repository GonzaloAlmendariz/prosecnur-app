# Con la lógica «Calculado», cuotas y sorteo usan el N del cálculo, no el `n_objetivo` guardado (10 nov 2026:
# el diseño nacional TCD decía 2,412 y sorteó 20 UMP con el 120 que traía la config).

test_that("con lógica Calculado el N es el del cálculo del tamaño, no el n_objetivo guardado", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = list("150103", "150132", "150142", "150101"),
    sample_size_mode = "calculator",
    n_objetivo = 120L,
    entrevistas_por_manzana = 6L
  ))
  skip_if(!nrow(hojas_ruta_inei_frame(cfg$frame_source)), "Sin marco empaquetado")
  esperado <- as.integer(hojas_ruta_sample_size_preview(cfg)$n_used)
  out <- hojas_ruta_n_calculado(cfg)
  expect_equal(out$n_objetivo, esperado)
  expect_false(identical(out$n_objetivo, 120L))
  # Las cuotas reparten ese N, no el guardado.
  cuotas <- hojas_ruta_quota_preview_integrado(out)
  expect_equal(as.integer(cuotas$n_objetivo), esperado)
})


test_that("con N total o por distrito el N lo escribe el usuario y no se toca", {
  cfg <- hojas_ruta_integrada_normalize_config(list(
    territorios = list("150103", "150132"),
    sample_size_mode = "external_total",
    n_objetivo = 120L,
    entrevistas_por_manzana = 6L
  ))
  expect_equal(hojas_ruta_n_calculado(cfg)$n_objetivo, 120L)
})

test_that("sin territorios no hay cálculo y la config queda igual", {
  cfg <- hojas_ruta_integrada_normalize_config(list(sample_size_mode = "calculator", n_objetivo = 120L))
  expect_equal(hojas_ruta_n_calculado(cfg)$n_objetivo, 120L)
})
