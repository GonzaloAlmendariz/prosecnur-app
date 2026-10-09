# Los cuatro estados de la celda facultad x sexo viven en UN solo sitio
# (`.monitoreo_aulas_quota_estado`) y son RETROSPECTIVOS: miden lo observado, no
# lo que se va a alcanzar.
#
# Los nombres anteriores mentian de dos formas distintas:
#   · `en_riesgo` no medía riesgo, medía «ya empezó»: una celda al 10 % y otra al
#     99 % caían las dos ahi;
#   · `pendiente` sonaba benigno y era el caso PEOR —cero observadas—, asi que la
#     lectura tranquilizaba justo donde habia que mirar.

test_that("los cuatro estados dicen lo que miden", {
  e <- .monitoreo_aulas_quota_estado
  expect_identical(e(0, 0), "sin_cuota")     # no hay meta que evaluar
  expect_identical(e(100, 100), "alcanzada") # el igual cuenta
  expect_identical(e(100, 120), "alcanzada") # pasarse tambien
  expect_identical(e(100, 1), "en_progreso") # empezo y no llego
  expect_identical(e(100, 0), "sin_avance")  # el peor caso, y se llama asi
})

test_that("es vectorizado, que es como lo usa el motor", {
  e <- .monitoreo_aulas_quota_estado
  expect_identical(
    e(c(0, 100, 100, 100), c(5, 100, 1, 0)),
    c("sin_cuota", "alcanzada", "en_progreso", "sin_avance")
  )
})

test_that("un dato ausente o roto no inventa un estado bueno", {
  e <- .monitoreo_aulas_quota_estado
  # Sin cuota legible no se puede juzgar: `sin_cuota`, nunca `alcanzada`.
  expect_identical(e(NA, 50), "sin_cuota")
  expect_identical(e("", 50), "sin_cuota")
  # Sin observadas legibles la celda esta en cero, que es lo que de verdad hay.
  expect_identical(e(100, NA), "sin_avance")
})

test_that("NO usa el vocabulario de la proyeccion, que mide otra cosa", {
  # `asegurada / ajustada / deficit_proyectado / deficit_no_subsanable` exigen
  # la proyeccion —observadas mas el aporte de las aulas pendientes— que aun no
  # existe. Que estos estados NO se llamen asi es parte del contrato: ponerles
  # ese nombre prometeria una lectura que el dato no da.
  e <- .monitoreo_aulas_quota_estado
  estados <- unique(e(c(0, 100, 100, 100), c(0, 100, 1, 0)))
  expect_false(any(estados %in% c("asegurada", "ajustada",
                                  "deficit_proyectado", "deficit_no_subsanable")))
  # Y tampoco reusa `pleno`, que es el tramo del AULA: dos granos, dos palabras.
  expect_false("pleno" %in% estados)
})
