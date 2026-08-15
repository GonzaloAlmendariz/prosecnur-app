# Regresión: un criterio de revisión con un solo límite de rango debe compilar.
#
# `.validar_regla_custom()` acepta `rango_num` y `rango_fecha` con solo `min` o
# solo `max` —lo dice su propio mensaje de error: "requiere al menos 'min' o
# 'max'"—, pero el compilador hacía `as.numeric(params$max)` sobre un NULL, que
# devuelve `numeric(0)`, y el `if (!is.na(...))` siguiente abortaba con
# "argument is of length zero".
#
# El efecto era que la regla se creaba y se ejecutaba sin problemas, pero
# Limpieza fallaba con E_INTERNAL al simular o finalizar: la decisión quedaba
# tomada y no había forma de aplicarla. Medido en ACNUR V3 al declarar
# "la duración del trámite no puede ser negativa" (`min = 0`, sin tope).

test_that("rango_num compila con solo min, solo max y con ambos", {
  f <- prosecnurapp:::.regla_expr_rango_num
  solo_min <- f("MesesReva", list(min = 0))
  expect_type(solo_min, "character")
  expect_true(grepl("<", solo_min, fixed = TRUE))
  expect_false(grepl("NA", solo_min, fixed = TRUE))

  solo_max <- f("edad", list(max = 120))
  expect_true(grepl(">", solo_max, fixed = TRUE))
  expect_false(grepl("NA", solo_max, fixed = TRUE))

  ambos <- f("edad", list(min = 18, max = 65))
  expect_true(grepl("|", ambos, fixed = TRUE))

  # Y la expresión resultante evalúa sobre datos reales.
  MesesReva <- c(-6, 0, 3, NA)
  expect_equal(eval(parse(text = solo_min)), c(TRUE, FALSE, FALSE, FALSE))
})

test_that("rango_fecha compila con solo max y detecta la fecha posterior", {
  f <- prosecnurapp:::.regla_expr_rango_fecha
  solo_max <- f("date_reva_sit", list(max = "2026-08-05"))
  expect_type(solo_max, "character")
  expect_false(grepl("NA", solo_max, fixed = TRUE))

  date_reva_sit <- c("2026-03-02", "2026-08-17", NA)
  expect_equal(eval(parse(text = solo_max)), c(FALSE, TRUE, FALSE))

  solo_min <- f("fecha", list(min = "2026-01-01"))
  expect_false(grepl("NA", solo_min, fixed = TRUE))
})

test_that("una regla con un solo límite llega hasta el plan compilado", {
  reglas <- list(list(
    id = "RC_001", tipo = "rango_num", variables = list("MesesReva"),
    params = list(min = 0), nombre = "Duración negativa",
    mensaje = "La duración no puede ser negativa.", severidad = "error", activa = TRUE
  ))
  plan <- prosecnurapp:::compile_reglas_custom(reglas)
  expect_true(length(plan) >= 1L || nrow(as.data.frame(plan)) >= 1L)
})
