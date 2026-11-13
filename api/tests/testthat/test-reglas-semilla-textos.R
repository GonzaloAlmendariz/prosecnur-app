# Textos de las reglas sugeridas: la columna se nombra por la etiqueta corta de
# la pregunta (sin su número) y las fechas van en dd.mm.aaaa. Solo cambia el
# texto; los params y la semilla conservan el dato (ISO, código de columna).

.st_survey <- function() {
  data.frame(
    type = c("integer", "date", "text"),
    name = c("edad", "fecha_visita", "motivo"),
    label = c("P3. Edad",
              "P4) Fecha de la visita",
              "P5. ¿Cuál fue el motivo principal por el que la persona decidió no responder?"),
    stringsAsFactors = FALSE
  )
}

test_that("la etiqueta corta quita el número de la pregunta", {
  s <- .st_survey()
  expect_identical(.semilla_nombrar_var("edad", s), "Edad")
  expect_identical(.semilla_nombrar_var("fecha_visita", s), "Fecha de la visita")
})

test_that("sin etiqueta, o con un enunciado largo, se usa el código", {
  s <- .st_survey()
  expect_identical(.semilla_nombrar_var("motivo", s), "motivo")
  expect_identical(.semilla_nombrar_var("telefono", s), "telefono")
  expect_identical(.semilla_nombrar_var("edad", NULL), "edad")
})

test_that("el periodo nombra la columna por su etiqueta y escribe las fechas dd.mm.aaaa", {
  d <- data.frame(
    fecha_visita = c("2026-07-30", rep("2026-08-01", 50), rep("2026-08-02", 53)),
    stringsAsFactors = FALSE
  )
  p <- reglas_semilla_periodo(d, survey = .st_survey())[[1]]
  expect_identical(p$nombre, "Periodo de campo: Fecha de la visita fuera de 01.08.2026 a 02.08.2026")
  expect_match(p$mensaje, "01.08.2026 a 02.08.2026", fixed = TRUE)
  expect_match(p$semilla$porque, "del 01.08.2026 al 02.08.2026", fixed = TRUE)
  expect_false(any(grepl("\\d{4}-\\d{2}-\\d{2}", c(p$nombre, p$mensaje, p$semilla$porque))))
  # El dato no cambia.
  expect_identical(p$params$min, "2026-08-01")
  expect_identical(p$semilla$columna, "fecha_visita")
})

test_that("rango negativo y fecha posterior usan la etiqueta corta y la fecha dd.mm.aaaa", {
  s <- .st_survey()
  d <- data.frame(
    `_submission_time` = c("2026-08-03", "2026-08-04", rep("2026-08-05", 28)),
    edad = c(-1, rep(25, 29)),
    fecha_visita = c("2026-03-02", "2026-08-17", rep("2026-07-10", 28)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  neg <- reglas_semilla_rango_numerico(d, s)[[1]]
  expect_identical(neg$nombre, "Valor negativo: Edad")
  post <- reglas_semilla_fecha_declarada(d, s)[[1]]
  expect_identical(post$nombre, "Fecha posterior al campo: Fecha de la visita")
  expect_match(post$mensaje, "(05.08.2026)", fixed = TRUE)
  expect_identical(post$params$max, "2026-08-05")
})

test_that("las sugeridas del formulario usan la etiqueta corta sin el código", {
  s <- .st_survey()
  expect_identical(.semilla_form_nombrar("edad", s), "Edad")
  expect_identical(.semilla_form_nombrar("motivo", s), "motivo")
})
