library(testthat)

# Regresión: en estudios multibase (v0.2+) la validación se persiste por
# base en s$estudio$bases[[b]]$validacion, dejando la raíz (s$evaluacion /
# s$plan_result) NULL. El gauge del Home (fase "Validación") consume
# auditoria_run/plan_built del endpoint /api/session/state, que ahora se
# computa con validacion_key_present_any() para no reportar "pendiente" en
# falso. Estos tests fijan ese contrato y confirman que single-base no cambia.

test_that("validacion_key_present_any respeta el scope legacy single-base", {
  # Sin estudio, campos planos en la raíz (comportamiento pre-v0.2).
  s_vacia <- list()
  expect_false(validacion_key_present_any(s_vacia, "evaluacion"))
  expect_false(validacion_key_present_any(s_vacia, "plan_result"))

  s_evaluada <- list(evaluacion = list(resumen = "ok"))
  expect_true(validacion_key_present_any(s_evaluada, "evaluacion"))
  expect_false(validacion_key_present_any(s_evaluada, "plan_result"))

  s_plan <- list(plan_result = data.frame(regla = "r1"))
  expect_true(validacion_key_present_any(s_plan, "plan_result"))
})

test_that("validacion_key_present_any detecta validacion guardada por base (multibase)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  dummy_data <- data.frame(codigo_pulso = c("a", "b"), q1 = c(1, 2))
  dummy_inst <- list(survey = list())
  estudio_add_base(sid, "base_a", "xls_a", "dat_a", "xlsx", dummy_data, dummy_inst)
  estudio_add_base(sid, "base_b", "xls_b", "dat_b", "xlsx", dummy_data, dummy_inst)

  # Antes de validar cualquier base: pendiente en ambos flags.
  s0 <- session_get(sid)
  expect_true(is.null(s0$evaluacion))            # raíz permanece NULL
  expect_false(validacion_key_present_any(s0, "evaluacion"))
  expect_false(validacion_key_present_any(s0, "plan_result"))

  # El usuario valida SOLO una base. En multibase esto escribe en
  # s$estudio$bases[["base_b"]]$validacion, no en la raíz.
  validacion_scope_set(sid, "base_b", "plan_result", data.frame(regla = "r1"))
  validacion_scope_set(sid, "base_b", "evaluacion", list(resumen = "consistente"))

  s1 <- session_get(sid)
  # La raíz global sigue NULL — el bug original reportaba "pendiente" aquí.
  expect_true(is.null(s1$evaluacion))
  expect_true(is.null(s1$plan_result))
  # El helper sí ve la validación por base.
  expect_true(validacion_key_present_any(s1, "evaluacion"))
  expect_true(validacion_key_present_any(s1, "plan_result"))
})

test_that("validacion_key_present_any tolera bases sin scope de validacion", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  dummy_data <- data.frame(x = 1)
  estudio_add_base(sid, "base_a", "xls_a", "dat_a", "xlsx", dummy_data, list())
  s <- session_get(sid)
  # Base recién agregada, sin $validacion: no debe romper ni marcar hecho.
  expect_false(validacion_key_present_any(s, "evaluacion"))
  expect_false(validacion_key_present_any(s, "plan_result"))
})
