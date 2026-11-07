# La etapa operativa (piloto o campo) es la corrida que mira Hojas de ruta. Una sola fase en juego:
# la que se ve es la que usan los cálculos, el envío y la campaña. Desde el ADR 0124 el Planner ya no
# propone etapa: la que haya guardado un `.pulso` viejo no se lee.

test_that("la etapa es la corrida de Hojas y el envío la sigue", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "pilot")
  on.exit(session_delete(sid), add = TRUE)
  e <- .hojas_ruta_etapa(session_get(sid))
  expect_identical(e$fase, "pilot")
  expect_identical(names(e), c("fase", "origen"))
  expect_identical(.hojas_ruta_envio_fase_arg(NULL, sid), "pilot")
})

test_that("una etapa guardada en el Planner de un .pulso viejo no cambia nada (ADR 0124 §5)", {
  piloto <- .hre_sample(prefijo = "1501010020")
  sid <- .hre_session(pilot = piloto, active = "field")
  on.exit(session_delete(sid), add = TRUE)
  .planner_declarar(sid, "etapa", list(valor = "piloto"), 0L)
  s <- session_get(sid)
  expect_identical(.hojas_ruta_etapa(s), list(fase = "field", origen = "hojas_ruta"))
  st <- .hojas_ruta_state_payload(sid)
  expect_identical(st$active_phase, "field")
  expect_null(st$etapa$planner)
  expect_identical(.hojas_ruta_envio_fase_arg(NULL, sid), "field")
  expect_identical(.mcamp_territorial_fase_arg(s, NULL), "field")
  # Una fase pedida explícitamente sigue mandando.
  expect_identical(.hojas_ruta_envio_fase_arg("pilot", sid), "pilot")
  # B1: los cálculos sin fase van a la corrida visible; Campo real nunca se sortea sin excluir el piloto.
  cfg <- .hojas_ruta_effective_config_for_phase(sid, list())
  expect_setequal(unlist(cfg$excluded_titular_ids), vapply(piloto$blocks, `[[`, "", "id_manzana"))
  # Pasar a la otra corrida es un clic sobre /phase, y desde ahí la que se ve y la de los cálculos coinciden.
  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/phase", .hre_json(list(phase = "pilot")))
  expect_identical(r$status, 200L)
  expect_identical(r$body$active_phase, "pilot")
  expect_identical(r$body$etapa$fase, "pilot")
  expect_identical(.hojas_ruta_active_run(sid)$phase, "pilot")
})

test_that("crear Campo real desde el piloto no pisa un campo con muestra o envío sin pedirlo", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "field")
  on.exit(session_delete(sid), add = TRUE)
  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/field/from-pilot", .hre_json(list(pilot_exclusion_mode = "exclude_titulars")))
  expect_identical(r$status, 409L)
  expect_identical(r$body$error$code %||% r$body$code, "E_HOJAS_RUTA_CAMPO_CON_MUESTRA")
  expect_true(.hojas_ruta_envio_tiene_bloques(session_get(sid)$hojas_ruta_runs$field$workspace_outputs$sample))
  # Pedido explícito: reemplaza.
  r2 <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/field/from-pilot", .hre_json(list(pilot_exclusion_mode = "exclude_titulars", reemplazar = TRUE)))
  expect_identical(r2$status, 200L)
  # Un campo vacío se crea sin pedir nada.
  vacio <- .hre_session(field = NULL, pilot = .hre_sample(prefijo = "1501010020"), active = "field")
  on.exit(session_delete(vacio), add = TRUE)
  expect_true(.hojas_ruta_campo_reemplazable(session_get(vacio)$hojas_ruta_runs$field)$ok)
  expect_identical(.hre_call(pr, vacio, "POST", "/api/hojas-ruta/field/from-pilot", "{}")$status, 200L)
})

test_that("una etapa de piloto sin corrida piloto mira campo", {
  sid <- .hre_session(active = "pilot")
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.hojas_ruta_etapa(session_get(sid))$fase, "field")
  expect_identical(.hojas_ruta_state_payload(sid)$active_phase, "field")
})
