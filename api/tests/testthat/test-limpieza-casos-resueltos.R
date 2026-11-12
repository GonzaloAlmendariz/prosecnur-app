# Casos que resolvió una decisión al pasar a lista (limpieza_casos_resueltos.R).
#
# Una decisión "para todos los casos que marcó la regla" no guarda lista de
# casos y el motor los resuelve contra la última auditoría. Al pasar a lista,
# ahora registra cuáles eran en `target_case_ids_resueltos`. Desde M4 (D-F2),
# en las acciones que cambian datos esa lista es la que se aplica; "ignorar la
# regla" sigue saliendo de la auditoría (test-limpieza-alcance-decision.R).

.m2_sesion_auditada <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  sid
}

test_that("al pasar a lista sin casos explícitos registra los casos que resolvía", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_auditada(dir)
  withr::defer(session_delete(sid))
  pr <- .m1_router()
  cuerpo <- '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"Edad fuera del universo","base_nombre":"Personas"}'
  r <- .m1_http(pr, sid, "POST", "/api/validacion/v2/limpieza/decision", body = cuerpo)
  expect_identical(r$status, 200L)
  # Edad fuera de 16 a 25: u01 (15), u04 (30) y u08 (26).
  expect_identical(unlist(r$body$decision$target_case_ids_resueltos), c("u01", "u04", "u08"))
  expect_length(r$body$decision$target_case_ids, 0L)
  expect_true(nzchar(r$body$decision$casos_resueltos_en))

  guardada <- validacion_scope_get(sid, "Personas")$limpieza_draft[[1]]
  expect_identical(unlist(guardada$target_case_ids_resueltos), c("u01", "u04", "u08"))
})

# D-F2 (M4): desde M4 el registro SÍ es la lista que se aplica en las acciones
# que cambian datos; antes la decisión seguía a la última auditoría.
test_that("D-F2: una exclusión de la regla entera queda en los casos que tenía al pasar a lista", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_auditada(dir)
  withr::defer(session_delete(sid))
  scope <- validacion_scope_get(sid, "Personas")
  up <- .limpieza_upsert_decision(list(), list(
    source_id = "RC_001", action_type = "exclude_cases", status = "ready", rationale = "x"
  ), scope = scope)
  validacion_scope_set(sid, "Personas", "limpieza_draft", up$decisions)

  # La auditoría cambia: la regla ahora marca solo edades menores de 16.
  regla <- .m1_regla_edad(); regla$params$max <- 99
  validacion_scope_set(sid, "Personas", "reglas_custom", list(regla))
  .m2_auditar(sid, "Personas")
  scope <- validacion_scope_get(sid, "Personas")
  d <- scope$limpieza_draft[[1]]
  expect_identical(unlist(d$target_case_ids_resueltos), c("u01", "u04", "u08"))
  expect_identical(.limpieza_target_case_ids(d, scope), c("u01", "u04", "u08"))
  out <- .limpieza_apply_decisions_to_data(.m1_datos(), scope, list(d))
  expect_identical(nrow(out$data), 7L)
})

test_that("guardar otra vez una decisión lista conserva el registro de cuando pasó a lista", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_auditada(dir)
  withr::defer(session_delete(sid))
  scope <- validacion_scope_get(sid, "Personas")
  base <- list(source_id = "RC_001", action_type = "exclude_cases", status = "ready", rationale = "x")
  up1 <- .limpieza_upsert_decision(list(), base, scope = scope)
  primera <- up1$decision
  primera$target_case_ids_resueltos <- list("u01")  # el registro de entonces
  up1$decisions[[1]] <- primera
  up2 <- .limpieza_upsert_decision(up1$decisions, c(base, list(id = primera$id, rationale = "y")),
                                   scope = scope)
  expect_identical(unlist(up2$decision$target_case_ids_resueltos), "u01")
})

test_that("en borrador o con casos explícitos no hay registro de resueltos", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_auditada(dir)
  withr::defer(session_delete(sid))
  scope <- validacion_scope_get(sid, "Personas")
  borrador <- .limpieza_upsert_decision(list(), list(
    source_id = "RC_001", action_type = "exclude_cases", status = "draft"
  ), scope = scope)$decision
  expect_null(borrador$target_case_ids_resueltos)
  explicita <- .limpieza_upsert_decision(list(), list(
    source_id = "RC_001", action_type = "exclude_cases", status = "ready",
    target_case_ids = list("u04"), rationale = "x"
  ), scope = scope)$decision
  expect_null(explicita$target_case_ids_resueltos)
  expect_identical(explicita$identificacion_casos$metodo, "anterior")

  # De lista a borrador, el registro se va.
  lista <- .limpieza_upsert_decision(list(), list(
    source_id = "RC_001", action_type = "exclude_cases", status = "ready", rationale = "x"
  ), scope = scope)
  vuelta <- .limpieza_upsert_decision(lista$decisions, list(
    id = lista$decision$id, source_id = "RC_001", action_type = "exclude_cases", status = "draft"
  ), scope = scope)$decision
  expect_null(vuelta$target_case_ids_resueltos)
})

test_that("el registro sobrevive a guardar y abrir el proyecto", {
  dir <- withr::local_tempdir()
  sid <- .m2_sesion_auditada(dir)
  withr::defer(session_delete(sid))
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
                body = '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"x","base_nombre":"Personas"}')
  expect_identical(r$status, 200L)
  ruta <- file.path(dir, "proyecto.pulso")
  build_pulso(sid, ruta)
  sid2 <- suppressMessages(load_pulso(ruta))$session_id
  withr::defer(session_delete(sid2))
  d <- validacion_scope_get(sid2, "Personas")$limpieza_draft[[1]]
  expect_identical(unlist(d$target_case_ids_resueltos), c("u01", "u04", "u08"))
})
