# La etapa operativa (piloto o campo) la declara el Planner; Hojas de ruta la lee y su
# propia etapa queda como respaldo mientras el Planner no la declare (hojas_ruta_etapa.R).

test_that("sin etapa declarada en el Planner, manda la de Hojas de ruta", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "pilot")
  on.exit(session_delete(sid), add = TRUE)
  e <- .hojas_ruta_etapa(session_get(sid))
  expect_identical(e, list(fase = "pilot", origen = "hojas_ruta"))
  expect_identical(.hojas_ruta_envio_fase_arg(NULL, sid), "pilot")
})

test_that("declarada en el Planner, Hojas aterriza en ella y el envío y la campaña la usan", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501010020"), active = "field")
  on.exit(session_delete(sid), add = TRUE)
  .planner_declarar(sid, "etapa", list(valor = "piloto"), 0L)
  s <- session_get(sid)
  expect_identical(.hojas_ruta_etapa(s), list(fase = "pilot", origen = "planner"))
  expect_identical(.hojas_ruta_envio_fase_arg(NULL, sid), "pilot")
  expect_identical(.mcamp_territorial_fase_arg(s, NULL), "pilot")
  # Una fase pedida explícitamente sigue mandando.
  expect_identical(.hojas_ruta_envio_fase_arg("field", sid), "field")
  st <- .hojas_ruta_state_payload(sid)
  expect_identical(st$active_phase, "pilot")
  expect_identical(st$etapa$origen, "planner")
  # Leer no escribe: la pestaña que se mira sigue siendo de Hojas.
  expect_identical(session_get(sid)$hojas_ruta_active_phase, "field")
})

test_that("una etapa declarada sin corrida de piloto cae en campo", {
  sid <- .hre_session(active = "field")
  on.exit(session_delete(sid), add = TRUE)
  .planner_declarar(sid, "etapa", list(valor = "piloto"), 0L)
  expect_identical(.hojas_ruta_state_payload(sid)$active_phase, "field")
})
