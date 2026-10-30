# La base sin respuesta del cruce se arma por columnas
# (monitoreo_casos_pendientes.R). El data.frame tiene que ser el mismo que
# armando un caso por persona, que es como se hacía antes.

.base_pendiente <- function(i, ...) {
  utils::modifyList(list(
    actor = if (i %% 2) "Profesores" else "Administrativos",
    key = sprintf("codigo:t%03d", i),
    row = sprintf("u%03d", i),
    person = if (i %% 3) sprintf("Persona %d", i) else "",
    identifier = sprintf("T%03d", i),
    source = "Universo",
    source_id = "universo-1",
    channel = "Correo",
    responsible = if (i %% 4) "Equipo A" else NULL,
    status = "Activo",
    all_keys = list(sprintf("codigo:t%03d", i))
  ), list(...))
}

.camino_fila_por_fila <- function(cases, pendientes_bases) {
  personas <- lapply(pendientes_bases, .monitoreo_internal_pending_person)
  .monitoreo_internal_records_to_df(c(cases, Map(.monitoreo_internal_pending_case_row, pendientes_bases, personas)))
}

test_that("sin respuestas, el bloque por columnas es idéntico al fila por fila", {
  bases <- lapply(1:12, .base_pendiente)
  pendientes <- .monitoreo_internal_pending_cases(bases, character(0), character(0))
  expect_equal(pendientes$n, 12L)
  expect_false(is.null(pendientes$columnas))
  expect_identical(.monitoreo_internal_cases_df(list(), pendientes), .camino_fila_por_fila(list(), bases))
})

test_that("con casos respondidos delante y personas ya respondidas fuera, también", {
  bases <- lapply(1:8, .base_pendiente)
  respondida <- .monitoreo_internal_pending_case_row(bases[[2]], "Persona 2")
  respondida$platform_state <- "Completa"
  respondida$counts_in_advance <- TRUE
  pendientes <- .monitoreo_internal_pending_cases(bases, answered_base_rows = "u002", answered_base_keys = "codigo:t005")
  # La base 5 trae fila: se descarta por fila, no por llave, así que sigue pendiente.
  expect_equal(pendientes$n, 7L)
  esperadas <- Filter(function(b) !b$row %in% "u002", bases)
  expect_identical(
    .monitoreo_internal_cases_df(list(respondida), pendientes),
    .camino_fila_por_fila(list(respondida), esperadas)
  )
})

test_that("una persona sin fila se descarta por llave", {
  bases <- list(.base_pendiente(1, row = ""), .base_pendiente(2, row = ""))
  pendientes <- .monitoreo_internal_pending_cases(bases, character(0), "codigo:t001")
  expect_equal(pendientes$n, 1L)
  expect_identical(pendientes$columnas$case_key[[1]], "codigo:t002")
})

test_that("si un campo no es escalar, el bloque vuelve al camino fila por fila", {
  bases <- list(.base_pendiente(1), .base_pendiente(2, actor = list("Profesores")))
  pendientes <- .monitoreo_internal_pending_cases(bases, character(0), character(0))
  expect_null(pendientes$columnas)
  expect_length(pendientes$filas, 2L)
  expect_identical(.monitoreo_internal_cases_df(list(), pendientes), .camino_fila_por_fila(list(), bases))
})

test_that("un campo de largo 2 falla igual que fallaba fila por fila", {
  bases <- list(.base_pendiente(1, date = c("2026-10-29", "2026-10-30")))
  expect_error(.monitoreo_internal_pending_cases(bases, character(0), character(0)), "differing number of rows")
})
