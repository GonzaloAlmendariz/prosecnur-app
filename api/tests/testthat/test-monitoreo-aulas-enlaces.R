# =============================================================================
# Enlaces de recopilador compartidos por cursos-horario distintos
# =============================================================================
#
# La atribución de una respuesta a su curso-horario va por el enlace: si dos
# aulas comparten uno, sus respuestas entran por la misma puerta y no se pueden
# separar después.
#
# Medido sobre HSVG2026 «como 2025»: de 192 filas en campo salen 158 enlaces
# distintos y 25 están compartidos por cadenas distintas, porque el enlace lleva
# el `classroom_id` truncado —«1ind53_0833» y «1ind53_0832» dan el mismo
# «.../1ind53_0»—. Ninguna de las once reglas de `validation` lo miraba.

.mae_filas <- function(...) {
  filas <- list(...)
  data.frame(
    operational_code = vapply(filas, `[[`, character(1), 1L),
    link = vapply(filas, `[[`, character(1), 2L),
    stringsAsFactors = FALSE
  )
}

test_that("dos cursos-horario con el mismo enlace se declaran, con cuáles son", {
  r <- monitoreo_aulas_enlaces_compartidos(.mae_filas(
    c("CH 11", "https://ee.kobotoolbox.org/x/1ind53_0"),
    c("CH 35", "https://ee.kobotoolbox.org/x/1ind53_0"),
    c("CH 99", "https://ee.kobotoolbox.org/x/9uni77_1")
  ))
  expect_equal(r$enlaces, 1L)
  expect_equal(r$aulas, 2L)
  # Sin los códigos, el aviso dice que hay un problema y no a dónde ir.
  expect_match(r$ejemplos[[1]], "CH 11")
  expect_match(r$ejemplos[[1]], "CH 35")
})

test_that("con cada enlace en su aula no hay nada que declarar, pero SÍ se comprobó", {
  r <- monitoreo_aulas_enlaces_compartidos(.mae_filas(
    c("CH 1", "u1"), c("CH 2", "u2"), c("CH 3", "u3")
  ))
  expect_equal(r$enlaces, 0L)
  # `comprobable` distingue «no hay repetidos» de «no se pudo mirar»: es la misma
  # regla que el resto de la lista de validación ya aprendió.
  expect_true(r$comprobable)
})

test_that("sin columna de enlace NO se puede comprobar, y eso no es «correcto»", {
  r <- monitoreo_aulas_enlaces_compartidos(
    data.frame(operational_code = c("CH 1", "CH 2"), stringsAsFactors = FALSE))
  expect_false(r$comprobable)
  expect_equal(r$enlaces, 0L)
})

test_that("los enlaces vacíos no cuentan como repetidos entre sí", {
  # Tres aulas sin enlace comparten la cadena vacía, y eso no es compartir
  # recopilador: es no tenerlo. Contarlas daría una alarma de 3 aulas.
  r <- monitoreo_aulas_enlaces_compartidos(.mae_filas(
    c("CH 1", ""), c("CH 2", ""), c("CH 3", "")
  ))
  expect_equal(r$enlaces, 0L)
  expect_false(r$comprobable)
})

test_that("un enlace repetido por TRES aulas cuenta las tres", {
  r <- monitoreo_aulas_enlaces_compartidos(.mae_filas(
    c("CH 1", "u1"), c("CH 2", "u1"), c("CH 3", "u1"), c("CH 4", "u2")
  ))
  expect_equal(r$enlaces, 1L)
  expect_equal(r$aulas, 3L)
})
