source("setup-load-all.R")

# El motor ocultaba por su cuenta toda etiqueta de valor <= 15 % en dos casos
# —baterías de tres o más variables y gráficos de menos de 7,25 in— inyectando
# `umbral_ocultar_etiqueta = 0.15`. Nadie lo pedía y nada lo decía: en la lámina
# de seis enunciados del mazo de acreditación desaparecían los porcentajes del
# 1 % al 15 %. Medido con `trace()`: de 51 llamadas, unas recibían 0.15 y el
# resto 0.

test_that("apagado se muestran todos los porcentajes", {
  expect_equal(.barras_umbral_ocultar_efectivo(FALSE, 0.15), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(NULL, 0.15), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(NA, 0.15), 0)
})

test_that("encendido se respeta el umbral declarado", {
  # El control: si el interruptor no cambiara nada, la medición no distinguiría
  # el caso bueno del malo.
  expect_equal(.barras_umbral_ocultar_efectivo(TRUE, 0.15), 0.15)
  expect_equal(.barras_umbral_ocultar_efectivo(TRUE, 0.02), 0.02)
})

test_that("un umbral inválido no esconde nada", {
  expect_equal(.barras_umbral_ocultar_efectivo(TRUE, NA), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(TRUE, -1), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(TRUE, NULL), 0)
})

test_that("el interruptor es formal del graficador y nace apagado", {
  f <- formals(graficar_barras_apiladas)
  expect_true("ocultar_etiquetas_pequenas" %in% names(f))
  expect_false(isTRUE(eval(f$ocultar_etiquetas_pequenas)))
})

test_that("las reglas automáticas ya no inyectan el umbral", {
  # Es lo que convertía una decisión editorial en un efecto secundario del
  # ancho del slot o del número de variables.
  src <- readLines("../../R/reporte_plan_helpers.R", warn = FALSE)
  expect_length(grep("umbral_ocultar_etiqueta <- 0.15", src, fixed = TRUE), 0L)
})
