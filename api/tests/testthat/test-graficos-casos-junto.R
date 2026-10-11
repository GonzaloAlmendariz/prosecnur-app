test_that("casos junto al porcentaje: el ajuste del informe decide cuándo se escriben", {
  espec_grande <- list(filas = data.frame(n = c(120, 98), n_casos = c(120, 98)))
  espec_chica <- list(filas = data.frame(n = c(120, 14), n_casos = c(120, 14)))
  # Defecto: sólo con base chica (< 30), como el estándar.
  expect_false(.lam_base_chica(espec_grande))
  expect_true(.lam_base_chica(espec_chica))
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))
  expect_true(.lam_base_chica(espec_grande))
  withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))
  expect_false(.lam_base_chica(espec_chica))
  withr::local_options(prosecnur.casos_junto = list(cuando = "menos", umbral = 150))
  expect_true(.lam_base_chica(espec_grande))
})

test_that("el ajuste se lee de los presets y lo raro vuelve al defecto", {
  expect_identical(.casos_junto_de_presets(list()), list(cuando = "menos", umbral = 30))
  expect_identical(.casos_junto_de_presets(list(base = list(args = list(casos_junto = list(cuando = "Siempre", umbral = "20"))))),
                   list(cuando = "siempre", umbral = 20))
  expect_identical(.casos_junto_normalizar(list(cuando = "a veces", umbral = -3)), list(cuando = "menos", umbral = 30))
  # Un gráfico puede pedir otra cosa que el informe.
  withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))
  expect_true(.casos_junto_muestra(c(50, 60), propio = "siempre"))
})
