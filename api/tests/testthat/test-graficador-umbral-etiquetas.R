source("setup-load-all.R")

# El motor ocultaba por su cuenta toda etiqueta de valor <= 15 % en dos casos
# —baterías de tres o más variables y gráficos de menos de 7,25 in— inyectando
# `umbral_ocultar_etiqueta = 0.15`. Nadie lo pedía y nada lo decía: en la lámina
# de seis enunciados del mazo de acreditación desaparecían los porcentajes del
# 1 % al 15 %. Medido con `trace()`: de 51 llamadas, unas recibían 0.15 y el
# resto 0.

# La primera versión exigía además un bool `ocultar_etiquetas_pequenas`, y
# entonces declarar 15 % no hacía nada hasta encender un segundo control. Lo
# delató un test que pasaba el umbral explícito y veía salir las seis etiquetas.
# Ahora el umbral ES el interruptor.

test_that("sin umbral se muestran todos los porcentajes", {
  expect_equal(.barras_umbral_ocultar_efectivo(umbral = 0), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(), 0)
})

test_that("un umbral declarado se respeta sin pedir permiso a nadie más", {
  expect_equal(.barras_umbral_ocultar_efectivo(umbral = 0.15), 0.15)
  expect_equal(.barras_umbral_ocultar_efectivo(umbral = 0.02), 0.02)
  # El bool heredado ya no puede anular un umbral escrito: si alguien puso
  # 15 %, quiso 15 %. Este es el aserto que fija el bug.
  expect_equal(.barras_umbral_ocultar_efectivo(FALSE, 0.15), 0.15)
  # Y su control: sin umbral, el bool tampoco enciende nada por su cuenta.
  expect_equal(.barras_umbral_ocultar_efectivo(TRUE, 0), 0)
})

test_that("un umbral inválido no esconde nada", {
  expect_equal(.barras_umbral_ocultar_efectivo(umbral = NA), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(umbral = -1), 0)
  expect_equal(.barras_umbral_ocultar_efectivo(umbral = NULL), 0)
})

test_that("el umbral es formal del graficador y nace en cero", {
  f <- formals(graficar_barras_apiladas)
  expect_true("umbral_ocultar_etiqueta" %in% names(f))
  expect_equal(eval(f$umbral_ocultar_etiqueta), 0)
})

test_that("el registro ofrece el umbral y ya no el bool que sobraba", {
  nombres <- function(args) vapply(args, function(a) as.character(a$name %||% ""), character(1))
  vistos <- unlist(lapply(.PRESETS_META, function(p) nombres(p$args %||% list())))
  expect_true("umbral_ocultar_etiqueta" %in% vistos)
  expect_false("ocultar_etiquetas_pequenas" %in% vistos)
})

test_that("las reglas automáticas ya no inyectan el umbral", {
  # Es lo que convertía una decisión editorial en un efecto secundario del
  # ancho del slot o del número de variables.
  src <- readLines("../../R/reporte_plan_helpers.R", warn = FALSE)
  expect_length(grep("umbral_ocultar_etiqueta <- 0.15", src, fixed = TRUE), 0L)
})
