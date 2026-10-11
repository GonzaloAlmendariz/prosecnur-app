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

test_that("barras por categoría: «43% (12)» cuando el grupo es chico; nada con base grande; el ajuste manda", {
  chica <- preparar_categorica(c("De 1 a 10", "De 11 a 20", "De 21 a más"), c(.27, .53, .2), c("27%", "53%", "20%"),
                               n = c(4, 8, 3), n_base_casos = 15)
  expect_identical(chica$cifras, c("27% (4)", "53% (8)", "20% (3)"))
  grande <- preparar_categorica(c("A", "B"), c(.6, .4), c("60%", "40%"), n = c(60, 40), n_base_casos = 100)
  expect_identical(grande$cifras, c("60%", "40%"))
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))
  expect_identical(preparar_categorica(c("A", "B"), c(.6, .4), c("60%", "40%"), n = c(60, 40), n_base_casos = 100)$cifras,
                   c("60% (60)", "40% (40)"))
  # Una cifra que ya trae su «(n)» no se duplica.
  expect_identical(preparar_categorica(c("A", "B"), c(.6, .4), c("60% (60)", "40% (40)"), n = c(60, 40))$cifras,
                   c("60% (60)", "40% (40)"))
})

test_that("dicotomía: el «(n)» del rótulo obedece el ajuste (antes iba siempre)", {
  e <- preparar_categorica(c("Sí", "No"), c(.31, .69), c("31%", "69%"), n = c(56, 122), n_base_casos = 178)
  expect_null(.lam_dicotomia_datos(e)$n)
  withr::local_options(prosecnur.casos_junto = list(cuando = "siempre"))
  expect_equal(.lam_dicotomia_datos(e)$n, c(56, 122))
})
