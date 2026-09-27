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

test_that("L21: declarar el marco de un componente no redondea el resultado de los otros", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  tope <- list(id = "cmp-tope", actor = "Hogares", actor_id = "hogares",
               tecnica = "prob_aleatorio_simple", origen_tamano = "formula",
               marco = list(universo_bruto = 2000L, marco_validado = 2000L,
                            marco_contactable = 2000L, estado = "validado"),
               parametros = list(z = 1.96, p = .5, e = .03, tasa_respuesta = .3, oversample_pct = .1))
  otro <- list(id = "cmp-otro", actor = "Docentes", actor_id = "docentes",
               tecnica = "prob_aleatorio_simple", origen_tamano = "formula",
               parametros = list(e = .05, tasa_respuesta = .8))
  for (comp in list(tope, otro)) {
    expect_identical(http_post_json(srv, "/api/calc-muestra/componente",
                                    body = list(op = "add", componente = comp), sid = sid)$status, 200L)
  }
  expect_identical(http_post_json(srv, "/api/calc-muestra/calcular", body = list(), sid = sid)$status, 200L)
  path <- tempfile(fileext = ".csv")
  withr::defer(unlink(path))
  utils::write.csv(data.frame(codigo = sprintf("D%04d", 1:300)), path, row.names = FALSE)
  subida <- http_post_multipart(srv, "/api/files/upload?kind=data",
                                fields = list(file = curl::form_file(path, type = "text/csv")), sid = sid)
  dec <- http_post_json(srv, "/api/calc-muestra/general/marco", sid = sid, body = list(
    componente_id = "cmp-otro", file_id = subida$json$file_id, columnas = list(id = "codigo")))
  expect_identical(dec$status, 200L)
  ids <- vapply(dec$json$estudio$componentes, function(c) c$id, "")
  a_mano <- 1.96 * sqrt(.25 * (2000 - 600) / (600 * 1999))
  expect_equal(dec$json$estudio$componentes[[match("cmp-tope", ids)]]$resultado$precision_alcanzada,
               a_mano, tolerance = 1e-9)
})

test_that("L21: borrar un componente y cambiar el modo de trabajo tampoco redondean a los demás", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id
  tope <- list(id = "cmp-tope", actor = "Hogares", actor_id = "hogares",
               tecnica = "prob_aleatorio_simple", origen_tamano = "formula",
               marco = list(universo_bruto = 2000L, marco_validado = 2000L,
                            marco_contactable = 2000L, estado = "validado"),
               parametros = list(z = 1.96, p = .5, e = .03, tasa_respuesta = .3, oversample_pct = .1))
  otro <- list(id = "cmp-otro", actor = "Docentes", actor_id = "docentes",
               tecnica = "prob_aleatorio_simple", origen_tamano = "formula",
               parametros = list(e = .05, tasa_respuesta = .8))
  for (comp in list(tope, otro)) {
    http_post_json(srv, "/api/calc-muestra/componente", body = list(op = "add", componente = comp), sid = sid)
  }
  http_post_json(srv, "/api/calc-muestra/calcular", body = list(), sid = sid)
  a_mano <- 1.96 * sqrt(.25 * (2000 - 600) / (600 * 1999))
  margen_de <- function(resp) {
    comps <- resp$json$estudio$componentes
    ids <- vapply(comps, function(c) c$id, "")
    comps[[match("cmp-tope", ids)]]$resultado$precision_alcanzada
  }
  modo <- http_post_json(srv, "/api/calc-muestra/modo-trabajo", body = list(modo = "diseno_validado"), sid = sid)
  expect_identical(modo$status, 200L)
  expect_equal(margen_de(modo), a_mano, tolerance = 1e-9)
  borrado <- http_delete_json(srv, "/api/calc-muestra/componente", body = list(id = "cmp-otro"), sid = sid)
  expect_identical(borrado$status, 200L)
  expect_equal(margen_de(borrado), a_mano, tolerance = 1e-9)
})
