# Vara V4 del GOAL de UI: lo que el motor no pudo hacer se dice, no se omite.
#
# El informe metodológico es lo que sustenta la entrega. Si el plan dejó
# preguntas fuera —porque una expresión no se pudo compilar, o porque la regla
# depende de un dataset externo— callarlo convierte al informe en una promesa
# que no cumple. Las dos listas viajaban en el modelo y sólo se contaban.

.nc <- function(unsupported = list(), descartadas = list()) {
  prosecnurapp:::.vmr_cobertura_no_cubierta(unsupported, descartadas)
}

test_that("sin nada que declarar, la nota no existe", {
  # C3 del Contrato de Superficie: la caja no aparece en vez de afirmar «todo
  # cubierto», que es una afirmación más fuerte de lo que este dato soporta.
  expect_equal(.nc(list(), list()), "")
  expect_equal(.nc(NULL, NULL), "")
})

test_that("las dos razones se dicen por separado y no se confunden", {
  # El control: si se mezclaran, el lector no podría distinguir un defecto
  # reparable de un límite conocido del motor, que se resuelven distinto.
  solo_desc <- .nc(list(), list(list(row_name = "edad")))
  solo_unsup <- .nc(list(list(row_name = "p12")), list())

  expect_true(grepl("pulldata", solo_desc, fixed = TRUE))
  expect_false(grepl("pulldata", solo_unsup, fixed = TRUE))
  expect_true(grepl("no se pudo traducir", solo_unsup, fixed = TRUE))
  expect_false(grepl("no se pudo traducir", solo_desc, fixed = TRUE))

  ambas <- .nc(list(list(row_name = "p12")), list(list(row_name = "edad")))
  expect_true(grepl("pulldata", ambas, fixed = TRUE))
  expect_true(grepl("no se pudo traducir", ambas, fixed = TRUE))
})

test_that("nombra las preguntas, que es lo que permite ir a buscarlas", {
  txt <- .nc(list(), list(list(row_name = "edad"), list(row_name = "nombre_padron")))
  expect_true(grepl("«edad»", txt, fixed = TRUE))
  expect_true(grepl("«nombre_padron»", txt, fixed = TRUE))
})

test_that("con muchas, muestra unas cuantas y dice cuántas faltan", {
  items <- lapply(sprintf("v%02d", 1:9), function(n) list(row_name = n))
  txt <- .nc(list(), items)
  expect_true(grepl("9 reglas", txt, fixed = TRUE))
  expect_true(grepl("«v01»", txt, fixed = TRUE))
  # No vomita las nueve: dice cuántas quedan sin nombrar.
  expect_true(grepl("y 5 más", txt, fixed = TRUE))
  expect_false(grepl("«v09»", txt, fixed = TRUE))
})

test_that("concuerda en número: una regla no se narra como varias", {
  una <- .nc(list(), list(list(row_name = "edad")))
  expect_true(grepl("Una regla del formulario se apoya", una, fixed = TRUE))
  expect_true(grepl("Debe revisarse", una, fixed = TRUE))
  expect_false(grepl("Deben", una, fixed = TRUE))

  una_u <- .nc(list(list(row_name = "p12")), list())
  expect_true(grepl("Quedó fuera del plan", una_u, fixed = TRUE))
  expect_true(grepl("conviene reportarla.", una_u, fixed = TRUE))

  dos_u <- .nc(list(list(row_name = "p12"), list(row_name = "p13")), list())
  expect_true(grepl("Quedaron fuera del plan", dos_u, fixed = TRUE))
  expect_true(grepl("conviene reportarlas.", dos_u, fixed = TRUE))
})

test_that("una entrada sin nombre no produce comillas vacías", {
  txt <- .nc(list(), list(list(row_name = ""), list(row_name = NULL)))
  expect_true(grepl("2 reglas", txt, fixed = TRUE))
  expect_false(grepl("«»", txt, fixed = TRUE))
})

test_that("el modelo del informe lleva la prosa y los dos conteos", {
  # Si el modelo dejara de calcularla, el PDF volvería a callarse sin que
  # ninguna prueba de la función pura se entere.
  src <- readLines("../../R/validacion_methodology_report.R", warn = FALSE)
  expect_true(any(grepl("cobertura_no_cubierta = .vmr_cobertura_no_cubierta(unsupported, descartadas)", src, fixed = TRUE)))
  expect_true(any(grepl("descartadas = length(descartadas)", src, fixed = TRUE)))
  # Y el PDF la dibuja con su rótulo.
  expect_true(any(grepl("LO QUE ESTE PLAN NO CUBRE", src, fixed = TRUE)))
})
