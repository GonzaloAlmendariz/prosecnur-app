# El POST de config de aulas por HTTP REAL — la clase de bug que no reproduce
# in-process (doctrina de helper-http-contract.R): plumber parsea el body con
# simplifyVector y {"CH 7": "..."} llega al normalizador como VECTOR nombrado,
# no como lista. El guard `!is.list` lo tiraba y el mapa de fijaciones (B36)
# se perdía en silencio — medido en vivo 2026-09-02: la UI mandaba
# {"reparto_fijado": {"CH 7": "Aquino..."}} y el estado devolvía `[]`.

test_that("B36 por HTTP: reparto_fijado sobrevive al body real de plumber", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  expect_true(is.character(sid) && nzchar(sid))

  resp <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(reparto_fijado = list(
      "CH 7" = "Aquino Dulanto, Alejandro Moises",
      "CH 12" = "Castillo Solorsano, Leidy Viviana"
    ))
  )
  expect_identical(resp$status, 200L)
  eco <- resp$json$aulas_universitarias$reparto_fijado
  expect_identical(
    as.character(eco[["CH 7"]]),
    "Aquino Dulanto, Alejandro Moises"
  )
  expect_identical(
    as.character(eco[["CH 12"]]),
    "Castillo Solorsano, Leidy Viviana"
  )

  # Soltar por HTTP: el valor vacío quita la cita y conserva la otra.
  resp2 <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(reparto_fijado = list("CH 7" = "Aquino Dulanto, Alejandro Moises"))
  )
  eco2 <- resp2$json$aulas_universitarias$reparto_fijado
  expect_identical(as.character(eco2[["CH 7"]]), "Aquino Dulanto, Alejandro Moises")
  expect_null(eco2[["CH 12"]])
})
