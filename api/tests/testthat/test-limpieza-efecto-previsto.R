# Efecto previsto de una decisión, sin guardarla (M4;
# limpieza_efecto_previsto.R, POST /api/validacion/v2/limpieza/decision/efecto).
#
# Base de las cifras: la tabla principal de la última auditoría (casos
# evaluados). El efecto previsto tiene que ser el que la decisión tiene al
# aplicarse.

.ef_sesion <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  sid
}

.ef_post <- function(sid, cuerpo) {
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision/efecto", body = cuerpo)
}

test_that("el efecto de excluir la regla entera se mide sin guardar nada", {
  dir <- withr::local_tempdir()
  sid <- .ef_sesion(dir)
  withr::defer(session_delete(sid))
  s <- session_get(sid); s$project_dirty <- FALSE; .session_env[[sid]] <- s
  antes <- validacion_scope_get(sid, "Personas")
  r <- .ef_post(sid, '{"source_id":"RC_001","action_type":"exclude_cases","status":"draft","base_nombre":"Personas"}')
  expect_identical(r$status, 200L)
  b <- r$body
  expect_identical(b$base_nombre, "Personas")
  expect_identical(b$accion, "exclude_cases")
  # u01, u04 y u08 salen: 10 casos evaluados, quedan 7.
  expect_identical(b$n_filas, 3L)
  expect_identical(b$n_celdas, 0L)
  expect_identical(b$n_casos_cuentan_antes, 10L)
  expect_identical(b$n_casos_cuentan_despues, 7L)
  expect_true(b$aplicable)
  expect_null(b$motivo_no_aplicable)
  expect_identical(b$alcance, "caso")
  expect_identical(b$seguimiento, "congelada")
  expect_identical(b$n_casos_aplicados, 3L)
  # Solo lee.
  expect_identical(validacion_scope_get(sid, "Personas"), antes)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("el efecto previsto es el que la decisión tiene al guardarse y aplicarse", {
  dir <- withr::local_tempdir()
  sid <- .ef_sesion(dir)
  withr::defer(session_delete(sid))
  # Otra decisión lista excluye a u01: la que se mide se cruza con ella.
  otra <- '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","target_case_ids":["u01"],"base_nombre":"Personas"}'
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision", body = otra)
  cuerpos <- list(
    excluir = '{"source_id":"RC_001","action_type":"exclude_cases","status":"draft","base_nombre":"Personas"}',
    fijar = '{"source_id":"RC_001","action_type":"set_value","target_variable":"edad","action_params":{"value":20},"base_nombre":"Personas"}',
    vaciar = '{"source_id":"RC_001","action_type":"nullify_fields","target_variable":"edad","action_params":{"target_variables":["p21"]},"base_nombre":"Personas"}',
    ignorar = '{"source_id":"RC_001","action_type":"ignore_rule","base_nombre":"Personas"}'
  )
  esperado <- list(excluir = c(n_filas = 2L, n_celdas = 0L, antes = 9L, despues = 7L),
                   fijar = c(n_filas = 2L, n_celdas = 2L, antes = 9L, despues = 9L),
                   vaciar = c(n_filas = 2L, n_celdas = 4L, antes = 9L, despues = 9L),
                   ignorar = c(n_filas = 0L, n_celdas = 0L, antes = 9L, despues = 9L))
  for (k in names(cuerpos)) {
    ef <- .ef_post(sid, cuerpos[[k]])$body
    expect_identical(c(n_filas = ef$n_filas, n_celdas = ef$n_celdas,
                       antes = ef$n_casos_cuentan_antes, despues = ef$n_casos_cuentan_despues),
                     esperado[[k]], label = k)
    # Se guarda lista y se aplica sobre la misma tabla: mismo efecto.
    scope <- validacion_scope_get(sid, "Personas")
    aud <- .limpieza_tabla_auditada(scope, "principal")
    base_otras <- .limpieza_apply_decisions_to_data(aud, scope, scope$limpieza_draft)
    payload <- jsonlite::fromJSON(cuerpos[[k]], simplifyVector = FALSE)
    payload$status <- "ready"; payload$rationale <- "x"
    up <- .limpieza_upsert_decision(scope$limpieza_draft, payload, scope = scope)
    aplicado <- .limpieza_apply_decisions_to_data(aud, scope, up$decisions)
    expect_identical(nrow(base_otras$data) - nrow(aplicado$data),
                     ef$n_casos_cuentan_antes - ef$n_casos_cuentan_despues, label = k)
    celdas <- aplicado$impact$cells_changed - base_otras$impact$cells_changed
    expect_identical(as.integer(celdas), ef$n_celdas, label = k)
  }
})

test_that("una decisión que no llega a nadie lo dice en el efecto", {
  dir <- withr::local_tempdir()
  sid <- .ef_sesion(dir)
  withr::defer(session_delete(sid))
  # Con el rango de 0 a 99 la regla RC_001 no marca a nadie.
  regla <- .m1_regla_edad(); regla$params$min <- 0; regla$params$max <- 99
  validacion_scope_set(sid, "Personas", "reglas_custom", list(regla))
  .m2_auditar(sid, "Personas")
  b <- .ef_post(sid, '{"source_id":"RC_001","action_type":"set_value","target_variable":"edad","action_params":{"value":20},"base_nombre":"Personas"}')$body
  expect_false(b$aplicable)
  expect_identical(b$motivo_no_aplicable, "sin_casos_al_decidir")
  expect_identical(b$n_celdas, 0L)
  expect_identical(b$n_casos_cuentan_antes, b$n_casos_cuentan_despues)
})

test_that("el efecto responde con los códigos de error de guardar", {
  dir <- withr::local_tempdir()
  sid <- .ef_sesion(dir)
  withr::defer(session_delete(sid))
  r <- .ef_post(sid, '{"source_id":"RC_001","action_type":"exclude_cases","target_case_ids":["u99"],"base_nombre":"Personas"}')
  expect_identical(r$status, 422L)
  expect_identical(r$body$error$code, "E_LIMPIEZA_CASOS_INVALIDOS")
  r <- .ef_post(sid, '{"base_nombre":"Personas"}')
  expect_identical(r$status, 400L)
  expect_identical(r$body$error$code, "E_LIMPIEZA_SOURCE_ID")
  r <- .ef_post(sid, '{"source_id":"RC_001","action_type":"exclude_cases","base_nombre":"Hogares"}')
  expect_identical(r$status, 409L)
  expect_identical(r$body$error$code, "E_NO_AUDITORIA")
  r <- .ef_post(sid, '{"source_id":"RC_001","action_type":"exclude_cases","base_nombre":"NoExiste"}')
  expect_identical(r$status, 404L)
})
