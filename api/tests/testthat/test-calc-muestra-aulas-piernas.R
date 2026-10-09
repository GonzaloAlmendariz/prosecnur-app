# Las tres piernas del rendimiento del aula: asistencia x respuesta x validez.
#
# Medidas sobre las 194 aulas aplicadas de 2025 (razon de sumas). El invariante
# que las gobierna es que su producto reproduce la `tasa` sellada del tramo: si
# alguien toca una pierna sin tocar la tasa, o al reves, el motor pasaria a
# publicar una descomposicion que no corresponde a lo que dimensiona.

# Las piernas van a CUATRO decimales, no a tres, y no es cosmetico: con tres, el
# tramo 26-35 daba 0,56546 contra una tasa sellada de 0,566 —un desvio de
# 0,00054, por encima del propio redondeo de la tasa—. La descomposicion tiene
# que caber dentro de la cifra que describe; si no cabe, no la describe.
.piernas_tramos <- function() list(
  list(hasta = 15, tasa = 0.809, asistencia = 1.1262, respuesta = 0.7960, validez = 0.9025),
  list(hasta = 25, tasa = 0.642, asistencia = 0.8460, respuesta = 0.8298, validez = 0.9148),
  list(hasta = 35, tasa = 0.566, asistencia = 0.9043, respuesta = 0.7103, validez = 0.8808),
  list(hasta = 50, tasa = 0.500, asistencia = 0.7676, respuesta = 0.7282, validez = 0.8954),
  list(hasta = NA, tasa = 0.409, asistencia = 0.6354, respuesta = 0.7357, validez = 0.8757)
)

test_that("el producto de las tres piernas reproduce la tasa sellada del tramo", {
  # Es el invariante: la descomposicion tiene que describir lo que dimensiona.
  #
  # La tolerancia es ABSOLUTA y de media milesima, que es exactamente el
  # redondeo de la `tasa` sellada: el producto real del tramo 16-25 es 0,64249 y
  # la tasa dice 0,642, asi que exigir mas seria exigir que la tasa llevara mas
  # decimales de los que lleva. `expect_equal` usa tolerancia RELATIVA, que en
  # estas magnitudes es mas estricta de lo que el dato permite.
  for (tr in .piernas_tramos()) {
    expect_lt(abs(tr$asistencia * tr$respuesta * tr$validez - tr$tasa), 5e-4)
  }
})

test_that("cada aula recibe las piernas de SU tramo", {
  tramos <- .piernas_tramos()
  p <- .cm_efectividad_piernas(c(10, 20, 30, 45, 80), tramos)
  expect_equal(p$asistencia, c(1.1262, 0.8460, 0.9043, 0.7676, 0.6354))
  expect_equal(p$respuesta, c(0.7960, 0.8298, 0.7103, 0.7282, 0.7357))
  expect_equal(p$validez, c(0.9025, 0.9148, 0.8808, 0.8954, 0.8757))
  # Y el producto, aula por aula, es el rendimiento que ya se usaba.
  r <- .cm_efectividad_rendimiento(c(10, 20, 30, 45, 80), tramos)
  expect_true(all(abs(p$asistencia * p$respuesta * p$validez - r) < 5e-4))
})

test_that("el borde de cada tramo cae del lado declarado", {
  tramos <- .piernas_tramos()
  # 15 es el ultimo del primer tramo y 16 el primero del segundo: sin esto, un
  # `<` por un `<=` movería una banda entera sin que nada mas cambie.
  p <- .cm_efectividad_piernas(c(15, 16, 50, 51), tramos)
  expect_equal(p$asistencia, c(1.1262, 0.8460, 0.7676, 0.6354))
})

test_that("SIN sello no hay piernas: NA, nunca un numero inventado", {
  # La calibracion embebida es de otra ola y su producto no sale de esta
  # descomposicion. Publicar una pierna ahi seria una lectura que nadie midio.
  p <- .cm_efectividad_piernas(c(10, 40), tramos = NULL)
  expect_true(all(is.na(p$asistencia)))
  expect_true(all(is.na(p$respuesta)))
  expect_true(all(is.na(p$validez)))
  # Y el rendimiento SI existe sin sello: es la tasa la que dimensiona.
  expect_false(any(is.na(.cm_efectividad_rendimiento(c(10, 40), tramos = NULL))))
})

test_that("un tramo que declara la tasa pero no las piernas sigue siendo valido", {
  # La `tasa` es lo que dimensiona; las piernas son lectura. Un sello parcial no
  # puede tumbar el dimensionamiento.
  tramos <- list(list(hasta = 15, tasa = 0.809),
                 list(hasta = NA, tasa = 0.409, asistencia = 0.6354,
                      respuesta = 0.7357, validez = 0.8757))
  p <- .cm_efectividad_piernas(c(10, 80), tramos)
  expect_true(is.na(p$asistencia[1]))
  expect_equal(p$asistencia[2], 0.6354)
  expect_equal(.cm_efectividad_rendimiento(c(10, 80), tramos), c(0.809, 0.409))
})

test_that("la asistencia puede pasar de 1 y no se topa: toparla rompe el producto", {
  # `asistentes` cuenta gente en el salon, no necesariamente elegible, asi que
  # el tramo chico da 1,126. Topar esa pierna a 1 dejaria el producto en 0,719
  # contra la tasa sellada de 0,809: la descomposicion dejaria de describir lo
  # que dimensiona. Se declara, no se corrige.
  tr <- .piernas_tramos()[[1]]
  expect_gt(tr$asistencia, 1)
  expect_lt(1 * tr$respuesta * tr$validez, tr$tasa)
})
