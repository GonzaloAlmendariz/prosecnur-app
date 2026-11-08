# Ola 4, A3: el preset de apiladas declaraba `size_titulos_grupo = 14` y el rótulo de grupo se dibujaba a 12 (el
# `rotulo_categoria` del estándar). Cuando el estándar y un preset se contradicen manda el estándar: el preset dice 12.

test_that("los presets de apiladas y multiapiladas declaran el rótulo de grupo del estándar", {
  pt <- as.numeric(.std_pt("rotulo_categoria"))
  expect_identical(as.numeric(.PRESETS_DEFAULT_PULSO$barras_apiladas$size_titulos_grupo), pt)
  expect_identical(as.numeric(.PRESETS_DEFAULT_PULSO$multi_apiladas$size_titulos_grupo), pt)
  pre <- .build_presets(.enriquecer_presets(list(), NULL))
  expect_identical(as.numeric(pre$barras_apiladas$args$size_titulos_grupo), pt)
  expect_identical(as.numeric(pre$multi_apiladas$args$size_titulos_grupo), pt)
})
