# =============================================================================
# A14 — El plan que llego por el handoff deja el gate del frontend ciego
# =============================================================================
#
# Sonda real (corrida_a6_ui.pulso, 2026-08-31): un .pulso restaurado cuyo plan
# de aulas llego por el handoff de Recopiladores tiene `s$monitoreo_aulas_plan`
# con 1.512 filas y `cfg$aulas_universitarias` VACIA — el handoff escribe la
# sesion (collection_engine.R:149) pero JAMAS `cfg$aulas_universitarias`, asi
# que la config normalizada trae el default: sin plan, enabled FALSE.
#
# El payload de estado (router_monitoreo.R:1222-1228, dentro de
# `.monitoreo_state_payload`) computa `au$plan_rows <- length(au$plan)` = 0
# mirando SOLO la config, y el frontend (`aulasHayPlan`,
# AulasOperationsPanel.tsx:37-44: `enabled && filas > 0`) esconde
# «Publicar/Generar libro» con el plan entero en la sesion. El endpoint de
# publicar funciona perfecto con esa misma sesion: el dato esta, el conteo
# miente. El propio comentario del router (1215-1217) ya declara que el tablero
# se reconstruye desde `s$monitoreo_aulas_plan», «esta siempre».
#
# Contrato congelado por el lead:
#   1. El bloque se extrae a `monitoreo_aulas_estado_payload()` en archivo
#      nuevo `api/R/monitoreo_aulas_estado_payload.R`; el router lo llama con
#      swap neto cero o negativo (esta congelado a crecimiento).
#      Firma pineada aqui: `monitoreo_aulas_estado_payload(au, plan_sesion)`
#      con `au` = `cfg$aulas_universitarias` (puede venir NULL) y
#      `plan_sesion` = `s$monitoreo_aulas_plan` (lista de filas o NULL).
#   2. `plan_rows` cuenta desde la fuente veraz: `length(s$monitoreo_aulas_plan)`
#      con fallback a `length(au$plan)`.
#   3. `enabled` del payload se DERIVA: un plan operable en sesion enciende el
#      modulo aunque la config nunca lo declarara. La config almacenada NO se
#      muta: es derivacion de payload, no escritura de estado.
#   4. `plan` sigue sin viajar en la config (333 KB medidos sobre 196 aulas).
#
# Las lecturas van con `[[`: `au$plan` con `plan` ausente y `plan_rows`
# presente parcial-matchea el entero — la trampa ya mordida en
# test-monitoreo-aulas-config-exacto.R.

# Filas con la forma minima que el motor de aulas acepta (misma familia de
# fixture que test-monitoreo-aulas-avance-cuota.R). `length()` de esta lista es
# el conteo de unidades, que es lo unico que A14 necesita del plan.
.a14_plan <- function(n = 3L) {
  lapply(seq_len(n), function(i) {
    list(
      classroom_id = sprintf("A-%03d", i),
      operational_code = sprintf("CH %d", i),
      label = sprintf("Aula %03d", i),
      faculty = "Ingenieria", stratum = "Ingenieria",
      sample_role = "titular", wave = "M1", orden = i,
      eligible_n = 30, expected_valid = 12,
      sample_status = "agendada"
    )
  })
}

# La forma exacta del restaurado-por-handoff: la config declara la familia y
# NADA de aulas (normaliza al default: enabled FALSE, plan vacio) y el plan
# vive solo en la sesion, que es lo que escribe collection_engine.R:149.
.a14_sesion_handoff <- function(plan) {
  sid <- session_create()
  cfg <- monitoreo_normalize_config(
    list(monitoreo_profile = list(family = "aulas_universitarias")),
    data.frame()
  )
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_aulas_plan", plan)
  sid
}

# --- El helper nuevo: rojo hoy porque la funcion no existe -------------------

test_that("A14: con la config vacia del handoff, el helper cuenta desde la sesion", {
  au_handoff <- monitoreo_aulas_normalize_config(list())
  plan <- .a14_plan(3L)

  out <- monitoreo_aulas_estado_payload(au_handoff, plan)

  expect_identical(out[["plan_rows"]], 3L)
  expect_true(isTRUE(out[["enabled"]]))
  # El plan NO viaja en la config: 333 KB medidos. Ausente, no NULL-presente.
  expect_false("plan" %in% names(out))
})

test_that("A14: con la config poblada (import-from-calc) nada cambia", {
  plan <- .a14_plan(3L)
  au <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = plan
  ))

  out <- monitoreo_aulas_estado_payload(au, plan)

  expect_identical(out[["plan_rows"]], 3L)
  expect_true(isTRUE(out[["enabled"]]))
  expect_false("plan" %in% names(out))
})

test_that("A14: sin plan de sesion el conteo cae al plan de la config (fallback)", {
  plan <- .a14_plan(2L)
  au <- monitoreo_aulas_normalize_config(list(enabled = TRUE, plan = plan))

  out <- monitoreo_aulas_estado_payload(au, NULL)

  expect_identical(out[["plan_rows"]], 2L)
  expect_true(isTRUE(out[["enabled"]]))
})

test_that("A14: sin plan en ningun lado el gate sigue cerrado", {
  # ULT2 recien abierto: su CTA correcto es «importar del calculo», no
  # publicar. Derivar `enabled` no puede encender un modulo sin unidades.
  au <- monitoreo_aulas_normalize_config(list())

  out <- monitoreo_aulas_estado_payload(au, NULL)

  expect_identical(out[["plan_rows"]], 0L)
  expect_false(isTRUE(out[["enabled"]]))
})

test_that("A14: una config NO-lista no revienta y la sesion sigue mandando", {
  plan <- .a14_plan(2L)

  out <- monitoreo_aulas_estado_payload(NULL, plan)

  expect_identical(out[["plan_rows"]], 2L)
  expect_true(isTRUE(out[["enabled"]]))
})

# --- Y el contrato se pinea DONDE VIVE: el estado que emite el router --------
#
# El frontend lee `state.config.aulas_universitarias` (AulasMonitoreoPage.tsx:
# 1007) y decide el gate con `plan_rows` y `enabled` (aulasHayPlan). Cubrir el
# helper sin cubrir a quien lo llama dejaria vivo el mutante de siempre: el
# router puede seguir contando `au$plan` de la config y estos tests de arriba
# no lo verian (leccion literal de test-monitoreo-aulas-rescate-sesion.R).

test_that("A14 (rojo del defecto): el estado de un handoff restaurado publica el conteo real", {
  plan <- .a14_plan(3L)
  sid <- .a14_sesion_handoff(plan)
  on.exit(session_delete(sid), add = TRUE)

  state <- .monitoreo_state_payload(sid)
  au <- state$config[["aulas_universitarias"]]

  expect_true(is.list(au))
  # HOY: `plan_rows` sale 0 (cuenta el plan vacio de la config) y `enabled`
  # FALSE — el gate esconde «Publicar/Generar libro» con 1.512 filas en sesion.
  expect_identical(au[["plan_rows"]], 3L)
  expect_true(isTRUE(au[["enabled"]]))
  # Lo que ya estaba bien y debe seguir: el plan no viaja en la config.
  expect_false("plan" %in% names(au))
})

test_that("A14 (verde de hoy que debe seguir): plan importado del calculo cuenta igual", {
  plan <- .a14_plan(3L)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  cfg <- monitoreo_normalize_config(list(
    monitoreo_profile = list(family = "aulas_universitarias"),
    aulas_universitarias = list(
      enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
      plan = plan
    )
  ), data.frame())
  session_set(sid, "monitoreo_config", cfg)
  # El import escribe TAMBIEN la sesion (router_monitoreo.R:5202/5236).
  session_set(sid, "monitoreo_aulas_plan", plan)

  state <- .monitoreo_state_payload(sid)
  au <- state$config[["aulas_universitarias"]]

  expect_identical(au[["plan_rows"]], 3L)
  expect_true(isTRUE(au[["enabled"]]))
  expect_false("plan" %in% names(au))
})

test_that("A14 (gate cerrado que debe seguir): sesion sin plan no enciende nada", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  cfg <- monitoreo_normalize_config(
    list(monitoreo_profile = list(family = "aulas_universitarias")),
    data.frame()
  )
  session_set(sid, "monitoreo_config", cfg)

  state <- .monitoreo_state_payload(sid)
  au <- state$config[["aulas_universitarias"]]

  expect_identical(au[["plan_rows"]], 0L)
  expect_false(isTRUE(au[["enabled"]]))
})
