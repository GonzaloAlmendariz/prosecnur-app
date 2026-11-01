# La etapa operativa (piloto o campo) es la corrida que mira Hojas de ruta; lo que declara el
# Planner es una propuesta que se alinea con un clic (ADR 0123 §6; antes, ADR 0122: mandaba el
# Planner). Una sola fase en juego: la que se ve es la que usan los cálculos, el envío y la campaña.

test_that("sin etapa en el Planner, la etapa es la corrida de Hojas y no hay nada que alinear", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "pilot")
  on.exit(session_delete(sid), add = TRUE)
  e <- .hojas_ruta_etapa(session_get(sid))
  expect_identical(e$fase, "pilot")
  expect_true(is.na(e$planner))
  expect_true(e$alineada)
  expect_identical(.hojas_ruta_envio_fase_arg(NULL, sid), "pilot")
})

test_that("con otra etapa en el Planner, Hojas no aterriza en ella: avisa y el envío y la campaña siguen la que se ve", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "field")
  on.exit(session_delete(sid), add = TRUE)
  .planner_declarar(sid, "etapa", list(valor = "piloto"), 0L)
  s <- session_get(sid)
  e <- .hojas_ruta_etapa(s)
  expect_identical(e$fase, "field")
  expect_identical(e$planner, "pilot")
  expect_false(e$alineada)
  st <- .hojas_ruta_state_payload(sid)
  expect_identical(st$active_phase, "field")
  expect_identical(st$etapa$planner, "pilot")
  expect_identical(.hojas_ruta_envio_fase_arg(NULL, sid), "field")
  expect_identical(.mcamp_territorial_fase_arg(s, NULL), "field")
  # Una fase pedida explícitamente sigue mandando.
  expect_identical(.hojas_ruta_envio_fase_arg("pilot", sid), "pilot")
})

test_that("B1: los cálculos sin fase van a la corrida visible; Campo real nunca se sortea sin excluir el piloto", {
  piloto <- .hre_sample(prefijo = "1501010020")
  sid <- .hre_session(pilot = piloto, active = "field")
  on.exit(session_delete(sid), add = TRUE)
  .planner_declarar(sid, "etapa", list(valor = "piloto"), 0L)
  # El Planner propone piloto; se ve Campo real, y la config efectiva (la que usan las previas y el
  # sorteo sin `phase`) es la de campo, con las titulares del piloto excluidas.
  expect_identical(.hojas_ruta_state_payload(sid)$active_phase, "field")
  cfg <- .hojas_ruta_effective_config_for_phase(sid, list())
  ids_piloto <- vapply(piloto$blocks, `[[`, "", "id_manzana")
  expect_setequal(unlist(cfg$excluded_titular_ids), ids_piloto)
  # «Alinear» es pasar a la corrida propuesta: desde ahí la que se ve y la de los cálculos coinciden.
  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/phase", .hre_json(list(phase = "pilot")))
  expect_identical(r$status, 200L)
  expect_identical(r$body$active_phase, "pilot")
  expect_true(r$body$etapa$alineada)
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

test_that("N1: por HTTP, sin etapa en el Planner `planner` sale null y no {}", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "field")
  on.exit(session_delete(sid), add = TRUE)
  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  st <- .hre_call(pr, sid, "GET", "/api/hojas-ruta/state")
  expect_match(st$raw, '"planner":null', fixed = TRUE)
  expect_null(st$body$etapa$planner)
  expect_true(st$body$etapa$alineada)
  .planner_declarar(sid, "etapa", list(valor = "piloto"), 0L)
  st2 <- .hre_call(pr, sid, "GET", "/api/hojas-ruta/state")
  expect_identical(st2$body$etapa$planner, "pilot")
  expect_false(st2$body$etapa$alineada)
})
