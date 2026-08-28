# El denominador con el que se dimensiona cuenta TODOS los elegibles de la
# seccion, sean de la facultad del aula o no.
#
# Medido sobre HSVG 2026: nuestras 193 titulares cargan 6.896 elegibles y 6.555
# son de su facultad (95,1 %). No muerde porque la atribucion es limpia, pero es
# el mismo metodo que deja una seleccion ajena en 4,8 % de propios en
# GASTRONOMIA -2 aulas con 119 elegibles que aportan 6 alumnos de la facultad-.
#
# `faculty_match_share` ya lo medía (criterio 8, parte 1). Lo que faltaba no era
# calcularlo: era publicarlo como CONTEO y ponerlo donde se ve.
#
# **Se publican los dos y no se cambia el que dimensiona**: cambiar el
# denominador mueve todos los esperados y todos los cupos de golpe, y eso es una
# decision del estudio, no un arreglo.

.dprop_cal <- function() .cm_efectividad_calibracion(list(efectividad = list(
  fuente = "historico", periodo = "2025", tau_base = 1,
  rendimiento_tramos = list(list(hasta = 50, tasa = 0.5), list(hasta = NA, tasa = 0.409))
)))

.dprop <- function(share) {
  f <- data.frame(
    faculty = "DERECHO", eligible_n = 40, teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
    faculty_match_share = share, stringsAsFactors = FALSE
  )
  .cm_aulas_efectividad_anotar(f, .dprop_cal())
}

test_that("un aula sin fuga tiene los dos denominadores iguales", {
  a <- .dprop(1)
  expect_identical(a$eligible_n_propios, 40L)
  expect_equal(a$efectivas_esperadas_propias, a$efectivas_esperadas)
})

test_that("un aula con fuga publica el conteo propio, mas bajo", {
  # 40 elegibles con 30 % de propios son 12 alumnos de la facultad.
  a <- .dprop(0.3)
  expect_identical(a$eligible_n_propios, 12L)
  expect_equal(a$efectivas_esperadas_propias, round(12 * 0.5, 1))
})

test_that("el esperado que DIMENSIONA no se mueve", {
  # Es la comprobacion de que publicar no se colo en cambiar: con o sin fuga,
  # `efectivas_esperadas` sigue saliendo de los elegibles del aula.
  expect_equal(.dprop(0.3)$efectivas_esperadas, .dprop(1)$efectivas_esperadas)
  expect_equal(.dprop(0.048)$efectivas_esperadas, round(40 * 0.5, 1))
})

test_that("el caso GASTRONOMIA queda visible en la brecha", {
  # 4,8 % de propios: el aula promete 20 efectivas y entrega 1.
  a <- .dprop(0.048)
  expect_identical(a$eligible_n_propios, 2L)
  expect_gt(a$efectivas_esperadas / a$efectivas_esperadas_propias, 15)
})

test_that("sin share medido no se inventa un conteo propio", {
  # NA es «no se pudo medir», y un 0 se leeria como «ningun alumno es de aqui»:
  # dos cosas distintas, y la segunda es una acusacion.
  a <- .dprop(NA_real_)
  expect_true(is.na(a$eligible_n_propios))
  expect_true(is.na(a$efectivas_esperadas_propias))
  expect_false(is.na(a$efectivas_esperadas))
})
