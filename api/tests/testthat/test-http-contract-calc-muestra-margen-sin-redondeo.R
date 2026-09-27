# El margen viaja sin redondeo (L12 del loop de mejoras, 2026-09-27).
#
# /calcular y /state usaban el serializador global, que deja 4 decimales: el
# motor daba 0.03348 (±3.3, y así lo redacta su aviso) y llegaba 0.0335, que
# la tarjeta pintaba ±3.4 al lado del aviso. Mismo defecto que ya se corrigió
# en /general/seleccionar para las π.

test_that("L12: /calcular y /state publican el margen con todos sus decimales", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  comp <- list(id = "cmp-tope", actor = "Hogares", actor_id = "hogares",
               tecnica = "prob_aleatorio_simple", origen_tamano = "formula",
               marco = list(universo_bruto = 2000L, marco_validado = 2000L,
                            marco_contactable = 2000L, estado = "validado"),
               parametros = list(z = 1.96, p = .5, e = .03, tasa_respuesta = .3, oversample_pct = .1))
  expect_identical(http_post_json(srv, "/api/calc-muestra/componente",
                                  body = list(op = "add", componente = comp), sid = sid)$status, 200L)
  a_mano <- 1.96 * sqrt(.25 * (2000 - 600) / (600 * 1999))
  calc <- http_post_json(srv, "/api/calc-muestra/calcular", body = list(), sid = sid)
  expect_identical(calc$status, 200L)
  expect_equal(calc$json$estudio$componentes[[1]]$resultado$precision_alcanzada, a_mano, tolerance = 1e-9)
  st <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_equal(st$json$estudio$componentes[[1]]$resultado$precision_alcanzada, a_mano, tolerance = 1e-9)
})
