# El parte llega con las claves en español y salia vacio.
#
# Medido el 2026-08-29 sobre el simulacro de campo malo: de los 14 campos que
# publica `monitoreo_aulas_partes_publicados()`, **solo `operational_code`
# llegaba con valor; los otros 13 vacios en los 152 partes**. El estado guarda
# cada parte como `fecha · aplicador · asistentes · enviadas · validas`, todos
# llenos. El panel «Partes de campo» enseñaba 152 filas con solo un codigo.

.pa_estado <- function(...) list(operational_code = "CH 1", asistentes = 30,
                                 validas = 18, aplicador = "Ana", fecha = "2026-09-08", ...)

test_that("reconoce las claves en español del estado", {
  out <- monitoreo_aulas_partes_publicados(list(.pa_estado()))[[1]]
  expect_identical(out$operational_code, "CH 1")
  expect_equal(out$observed_students, 30)
  expect_equal(out$effective_surveys, 18)
  expect_identical(out$applied_by, "Ana")
  expect_identical(out$applied_at, "2026-09-08")
})

test_that("la clave en INGLES manda si viene: es la del libro real", {
  # El libro del equipo escribe `applied_date`/`observed_students`. Si un parte
  # trae las dos, la del libro es la declaracion buena y la española es el
  # respaldo, no al reves.
  out <- monitoreo_aulas_partes_publicados(list(
    .pa_estado(observed_students = 99, applied_by = "Beto")
  ))[[1]]
  expect_equal(out$observed_students, 99)
  expect_identical(out$applied_by, "Beto")
})

test_that("un campo vacio NO gana al que si trae valor", {
  # El defecto que esto evita: `p$applied_by %||% p$aplicador` devuelve la
  # cadena vacia cuando `applied_by` existe pero esta en blanco, y `%||%` solo
  # mira el NULL. Por eso se prueba valor a valor y no con `%||%`.
  out <- monitoreo_aulas_partes_publicados(list(
    .pa_estado(applied_by = "", applied_at = "   ")
  ))[[1]]
  expect_identical(out$applied_by, "Ana")
  expect_identical(out$applied_at, "2026-09-08")
})

test_that("lo que el parte no trae sigue vacio, no se inventa", {
  out <- monitoreo_aulas_partes_publicados(list(.pa_estado()))[[1]]
  # Un numero que el parte no declara se publica vacio: un cero pareceria un
  # dato del equipo.
  expect_true(is.na(out$refusals))
  expect_true(is.na(out$duplicates))
  expect_identical(out$field_note, "")
})

test_that("el cuadre se calcula aunque el parte venga solo en castellano", {
  # **Este aserto vivia invertido, y pasaba por el defecto.** Decia
  # `expect_true(is.na(out$esperado))` con el comentario «sin rechazos ni
  # duplicados no hay identidad que comprobar» — que contradice al contrato
  # vecino, `test-monitoreo-aulas-reconciliacion.R`: «rechazos y duplicados
  # ausentes SI valen cero». Pasaban los dos porque `.pa_estado()` escribe
  # `asistentes`/`validas` y `monitoreo_aulas_parte_descuadre()` leia solo
  # `observed_students`: devolvia NULL por no entender el castellano, no por la
  # regla que el comentario invocaba.
  #
  # Medido el 2026-08-30 sobre el estudio de 152 partes —0 con la clave
  # inglesa, 152 con la castellana— eso dejaba el cuadre sin comprobar en
  # TODOS, y el control de Validacion publicaba «Los numeros de cada parte de
  # campo cuadran» en verde.
  out <- monitoreo_aulas_partes_publicados(list(.pa_estado()))[[1]]
  expect_equal(out$esperado, 30)
  expect_equal(out$diferencia, -12)
  expect_false(out$cuadra)
})

test_that("fecha y hora sueltas siguen componiendose", {
  out <- monitoreo_aulas_partes_publicados(list(list(
    operational_code = "CH 2", applied_date = "2026-09-09", applied_time = "10:30"
  )))[[1]]
  expect_identical(out$applied_at, "2026-09-09 10:30")
})
