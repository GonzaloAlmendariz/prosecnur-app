# "Revisar con la ficha física" (frontend/src/features/validacion/hallazgos/fichaFisica.ts):
# el analista no decide todavía; deja un borrador de `ignore_rule` limitado a
# sus casos (`scope = case_subset`) con `action_params.pendiente_ficha_fisica`.
# Ese borrador es una nota de trabajo: no cubre la regla, no saca los casos de lo
# pendiente y la base no queda lista para cerrar. Una decisión lista sobre los
# mismos casos, sin la marca, sí los cubre (contraste que hace discriminar al test).
#
# Personas: edad c(15, 18, 20, 30, 22, 16, 25, 26, NA, 19); la regla de 16 a 25
# marca u01, u04 y u08 (tres encuestas). Grano: encuesta.

.ff_sesion <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  sid
}

.ff_guardar <- function(sid, cuerpo) {
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision", body = cuerpo)
  expect_identical(r$status, 200L)
  r$body
}

.ff_cola <- function(sid) {
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/limpieza", query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  q <- Filter(function(x) identical(x$source_id, "RC_001"), r$body$decision_queue)[[1]]
  list(cola = q, resumen = r$body$summary, borrador = r$body$decision_draft)
}

test_that("un borrador pendiente de ficha física no cubre la regla ni saca los casos de lo pendiente", {
  dir <- withr::local_tempdir()
  sid <- .ff_sesion(dir)
  withr::defer(session_delete(sid))
  sin_decidir <- .ff_cola(sid)
  expect_identical(sin_decidir$cola$n_casos, 3L)
  expect_identical(sin_decidir$cola$n_casos_pendientes, 3L)

  .ff_guardar(sid, paste0('{"source_id":"RC_001","source_type":"custom_rule","scope":"case_subset",',
                          '"target_case_ids":["u01","u04"],"action_type":"ignore_rule",',
                          '"action_params":{"pendiente_ficha_fisica":true},"rationale":"La hoja se ve ilegible",',
                          '"status":"draft","base_nombre":"Personas"}'))
  d <- .ff_cola(sid)
  # El borrador existe y conserva la marca y sus casos.
  expect_length(d$borrador, 1L)
  expect_identical(d$borrador[[1]]$status, "draft")
  expect_true(isTRUE(d$borrador[[1]]$action_params$pendiente_ficha_fisica))
  expect_identical(unlist(d$borrador[[1]]$target_case_ids), c("u01", "u04"))
  # Pero no cubre nada: los tres casos siguen pendientes y la base no se puede cerrar.
  expect_identical(d$cola$n_casos, 3L)
  expect_identical(d$cola$n_casos_cubiertos, 0L)
  expect_identical(d$cola$n_casos_pendientes, 3L)
  expect_true(d$cola$pending)
  expect_false(d$resumen$ready_to_finalize)

  # La cobertura, con la decisión del borrador fuera de las listas, es la misma.
  scope <- validacion_scope_get(sid, "Personas")
  cob <- .limpieza_decision_coverage(scope, "RC_001", list(), 3L)
  expect_identical(cob$covered, 0L)
  expect_identical(cob$pending, 3L)
  expect_false(cob$covers_all)
})

test_that("la misma decisión lista, sin la marca, sí cubre sus casos", {
  dir <- withr::local_tempdir()
  sid <- .ff_sesion(dir)
  withr::defer(session_delete(sid))
  .ff_guardar(sid, paste0('{"source_id":"RC_001","source_type":"custom_rule","scope":"case_subset",',
                          '"target_case_ids":["u01","u04"],"action_type":"ignore_rule",',
                          '"rationale":"Revisado en la ficha","status":"ready","base_nombre":"Personas"}'))
  d <- .ff_cola(sid)
  expect_identical(d$cola$n_casos_cubiertos, 2L)
  expect_identical(d$cola$n_casos_pendientes, 1L)
  expect_true(d$cola$pending)
})
