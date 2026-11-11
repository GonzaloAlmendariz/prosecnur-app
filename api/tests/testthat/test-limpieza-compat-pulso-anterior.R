# Compatibilidad de las decisiones guardadas antes de M2 (sin
# `identificacion_casos`, sin `target_case_ids_resueltos`): después de guardar
# y abrir el .pulso afectan a los mismos casos que antes.

.m2_decisiones_anteriores <- function() list(
  # Exclusión explícita por respondent_id, como la guardaba el código anterior.
  list(id = "PD_001", source_id = "RC_001", action_type = "exclude_cases",
       target_case_ids = list("u04"), status = "ready", rationale = "Edad 30",
       created_at = "2026-10-01T00:00:00Z", updated_at = "2026-10-01T00:00:00Z"),
  # Exclusión de toda la regla de P4 y P21 (u01, u04, u06, u09, u10).
  list(id = "PD_002", source_id = "RC_002", action_type = "exclude_cases",
       target_case_ids = list(), status = "ready", rationale = "Contradicción",
       created_at = "2026-10-01T00:00:00Z", updated_at = "2026-10-01T00:00:00Z")
)

.m2_reabrir <- function(sid, dir) {
  ruta <- file.path(dir, "anterior.pulso")
  build_pulso(sid, ruta)
  suppressMessages(load_pulso(ruta))$session_id
}

.m2_excluidos <- function(sid) {
  scope <- validacion_scope_get(sid, "Personas")
  out <- .limpieza_apply_decisions_to_data(.m1_datos(), scope, scope$limpieza_draft)
  sort(setdiff(.m1_datos()$respondent_id, out$data$respondent_id))
}

test_that("decisiones sin los campos de M2 afectan a los mismos casos tras guardar y abrir", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad(), .m1_regla_p4_p21()))
  .m2_auditar(sid, "Personas")
  validacion_scope_set(sid, "Personas", "limpieza_draft", .m2_decisiones_anteriores())
  # Lo que excluía el código anterior: u04 (explícita) más los de RC_002.
  esperados <- sort(c("u01", "u04", "u06", "u09", "u10"))
  expect_identical(.m2_excluidos(sid), esperados)

  sid2 <- .m2_reabrir(sid, dir)
  withr::defer(session_delete(sid2))
  expect_identical(.m2_excluidos(sid2), esperados)
  d <- validacion_scope_get(sid2, "Personas")$limpieza_draft
  expect_null(d[[1]]$identificacion_casos)
  b <- build_limpieza(validacion_scope_get(sid2, "Personas"))
  expect_true(all(vapply(b$decision_draft, function(x) isTRUE(x$aplicable), logical(1))))
})

test_that("proyecto previo con llave declarada y solo decisiones de la regla entera: ni ids ni casos cambian", {
  # La identidad declarada está apagada en M2: al abrirlo, sus ids siguen
  # siendo los de la columna candidata ("u01") y sus decisiones excluyen a los
  # mismos encuestados.
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir)
  withr::defer(session_delete(sid))
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad(), .m1_regla_p4_p21()))
  validacion_scope_set(sid, "Personas", "limpieza_draft", .m2_decisiones_anteriores()[2])
  .m2_auditar(sid, "Personas")
  antes <- .m2_excluidos(sid)
  ids_antes <- .m2_ids_marcados(sid, "Personas", "RC_002")

  .m2_declarar_llave(sid, "Personas", "caso")
  sid2 <- .m2_reabrir(sid, dir)
  withr::defer(session_delete(sid2))
  .m2_auditar(sid2, "Personas")
  expect_identical(.m2_excluidos(sid2), antes)
  expect_identical(ids_antes, c("u01", "u04", "u06", "u09", "u10"))
  expect_identical(.m2_ids_marcados(sid2, "Personas", "RC_002"), ids_antes)
})
