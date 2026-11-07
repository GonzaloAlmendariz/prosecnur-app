# NSE predominante por distrito (atlas de Territorio, revisión del 7 nov 2026).

test_that("el NSE del distrito usa la escala del lienzo (1 = Alto, 5 = Bajo), no el código de la fuente", {
  tabla <- hojas_ruta_nse_por_distrito()
  skip_if(!nrow(tabla), "Sin NSE empaquetado")
  nivel <- function(u) tabla$nse_predominante[match(u, tabla$ubigeo)]
  # En la fuente `nse_codigo` 1 es BAJO: leerlo tal cual ponía a Carabayllo como Alto.
  expect_equal(nivel("150122"), 1L)  # Miraflores
  expect_equal(nivel("150131"), 1L)  # San Isidro
  expect_equal(nivel("150106"), 5L)  # Carabayllo
  expect_true(all(tabla$nse_predominante %in% 1:5))
  # El predominante es el nivel con más hogares.
  fila <- tabla[tabla$ubigeo == "150140", ]
  expect_equal(fila$nse_predominante, unname(which.max(unlist(fila[paste0("nse_", 1:5)]))))
})

test_that("las columnas para los territorios traen el reparto de hogares y NA donde no hay NSE", {
  out <- hojas_ruta_nse_columnas(c("150122", "150106", "999999"))
  expect_named(out, c("nse_predominante", paste0("nse_pct_", 1:5)))
  expect_true(is.na(out$nse_predominante[[3]]))
  expect_true(all(is.na(unlist(out[3, paste0("nse_pct_", 1:5)]))))
  reparto <- unlist(out[2, paste0("nse_pct_", 1:5)])
  expect_equal(sum(reparto), 1, tolerance = 1e-3)
  # El predominante es el nivel con la mayor proporción.
  expect_equal(unname(which.max(reparto)), out$nse_predominante[[2]])
})
