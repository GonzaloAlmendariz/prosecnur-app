# B38/G-16: la UI de Base PPT guarda TODOS los args del preset, fosilizando
# defaults viejos que pisan las mejoras del motor. La migracion actualiza
# SOLO valores identicos al default viejo; una eleccion distinta del
# analista se respeta.

test_that("ancho_max_eje_y 22 fosilizado migra a 34 (forma con args)", {
  presets <- list(barras_apiladas = list(args = list(ancho_max_eje_y = 22, otro = 1)))
  out <- .graficos_migrar_defaults_fosiles(presets)
  expect_equal(out$barras_apiladas$args$ancho_max_eje_y, 34)
  expect_equal(out$barras_apiladas$args$otro, 1)
})

test_that("ancho_max_eje_y 22 fosilizado migra a 34 (forma plana)", {
  presets <- list(barras_apiladas = list(ancho_max_eje_y = 22))
  out <- .graficos_migrar_defaults_fosiles(presets)
  expect_equal(out$barras_apiladas$ancho_max_eje_y, 34)
})

test_that("un valor elegido por el analista NO se toca", {
  presets <- list(barras_apiladas = list(args = list(ancho_max_eje_y = 28)))
  out <- .graficos_migrar_defaults_fosiles(presets)
  expect_equal(out$barras_apiladas$args$ancho_max_eje_y, 28)
})

test_that("presets sin la clave o sin el tipo pasan intactos", {
  expect_identical(.graficos_migrar_defaults_fosiles(list()), list())
  presets <- list(pie = list(args = list(top_k = 5)))
  expect_identical(.graficos_migrar_defaults_fosiles(presets), presets)
})

test_that("la migracion corre dentro de .enriquecer_presets (costura del export)", {
  presets <- list(barras_apiladas = list(args = list(ancho_max_eje_y = 22)))
  out <- .enriquecer_presets(presets)
  expect_equal(out$barras_apiladas$args$ancho_max_eje_y, 34)
})

test_that("delivery_options no enciende la lamina Otros por defecto (G-18)", {
  d <- .graficos_delivery_options(list(), template_id = NULL, auto_otros_slides = NULL)
  expect_false(d$auto_otros_slides)
  # Encenderla sigue siendo posible por cualquiera de las tres vias.
  expect_true(.graficos_delivery_options(list(), auto_otros_slides = TRUE)$auto_otros_slides)
  expect_true(.graficos_delivery_options(list(auto_otros_slides = TRUE))$auto_otros_slides)
})

test_that("etiquetas_arriba_si_no_caben TRUE fosilizado migra a FALSE (B45)", {
  presets <- list(barras_apiladas = list(args = list(etiquetas_arriba_si_no_caben = TRUE)))
  out <- .graficos_migrar_defaults_fosiles(presets)
  expect_false(out$barras_apiladas$args$etiquetas_arriba_si_no_caben)
  # FALSE explicito o ausente no se tocan.
  p2 <- list(barras_apiladas = list(args = list(etiquetas_arriba_si_no_caben = FALSE)))
  expect_false(.graficos_migrar_defaults_fosiles(p2)$barras_apiladas$args$etiquetas_arriba_si_no_caben)
  p3 <- list(barras_apiladas = list(args = list(otro = 1)))
  expect_null(.graficos_migrar_defaults_fosiles(p3)$barras_apiladas$args$etiquetas_arriba_si_no_caben)
})
