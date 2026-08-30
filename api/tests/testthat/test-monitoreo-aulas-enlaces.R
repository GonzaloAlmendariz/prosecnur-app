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

# --- la severidad: esto no se revisa, se arregla -----------------------------

test_that("un enlace compartido sale como «warning», no como «review»", {
  # Regla del operativo (Gonzalo, 2026-08-30): «cada curso-horario debe tener un
  # enlace al forms». Dos aulas con el mismo no producen una duda que mirar sino
  # respuestas que ya no se pueden separar.
  expect_equal(
    monitoreo_aulas_estado_control(TRUE, TRUE, "warning"),
    "warning"
  )
  # Y sin nada que comprobar sigue siendo `sin_datos`: no se pudo mirar.
  expect_equal(monitoreo_aulas_estado_control(FALSE, FALSE, "warning"), "sin_datos")
  # Con enlaces y sin repetidos, correcto.
  expect_equal(monitoreo_aulas_estado_control(TRUE, FALSE, "warning"), "ok")
})

# --- la CAUSA, cuando se puede probar ----------------------------------------

test_that("detecta que el enlace es el identificador truncado, y a cuántos caracteres", {
  # Medido sobre HSVG2026 «como 2025»: las 1.424 filas tienen la cola del enlace
  # igual a los 8 primeros caracteres de su `classroom_id`, sin una excepción.
  # No es un error aislado: quien generó los enlaces cortó el identificador a
  # ocho, y con ids de once eso colisiona en cuanto dos comparten ese prefijo.
  f <- data.frame(
    operational_code = c("CH 11", "CH 35", "CH 99"),
    classroom_id = c("1ind53_0833", "1ind53_0832", "9uni77_1104"),
    link = c("https://ee.kobotoolbox.org/x/1ind53_0",
             "https://ee.kobotoolbox.org/x/1ind53_0",
             "https://ee.kobotoolbox.org/x/9uni77_1"),
    stringsAsFactors = FALSE
  )
  expect_equal(monitoreo_aulas_enlaces_compartidos(f)$truncado, 8L)
})

test_that("no inventa la causa cuando la relación no es sistemática", {
  # Con enlaces que no derivan del identificador, decir «está truncado» sería
  # atribuir un mecanismo que no se ha visto.
  f <- data.frame(
    operational_code = c("CH 1", "CH 2"),
    classroom_id = c("aula_uno", "aula_dos"),
    link = c("https://kobo/x/formularioA", "https://kobo/x/formularioA"),
    stringsAsFactors = FALSE
  )
  expect_true(is.na(monitoreo_aulas_enlaces_compartidos(f)$truncado))
})

test_that("sin columna de identificador tampoco se afirma nada", {
  f <- data.frame(operational_code = c("CH 1", "CH 2"),
                  link = c("u1", "u1"), stringsAsFactors = FALSE)
  r <- monitoreo_aulas_enlaces_compartidos(f)
  expect_equal(r$enlaces, 1L)
  expect_true(is.na(r$truncado))
})
