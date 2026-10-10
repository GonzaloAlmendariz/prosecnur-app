# =============================================================================
# Contrato HTTP real — endpoints de F6.0b (íconos del recetario y opciones del documento Word).
# =============================================================================
#
# El verificador encontró por el wire lo que los tests in-process no veían: `wrap_endpoint` pasa los campos del body
# como argumentos con nombre, y dos handlers sin esos parámetros respondían 500 en su camino principal.

test_that("POST /iconos-recetario/elegir responde la elección con su motivo y rechaza un contexto desconocido", {
  srv <- http_contract_server()
  r <- http_post_json(srv, "/api/graficos/iconos-recetario/elegir",
                      body = list(contexto = "capitulo", textos = list("Perfil del encuestado", "Cuerpo académico")))
  expect_identical(r$status, 200L)
  expect_identical(r$json$elecciones[[1]]$icono, "users")
  expect_identical(r$json$elecciones[[2]]$icono, "presentation")
  expect_match(r$json$elecciones[[1]]$motivo, "«perfil»", fixed = TRUE)
  malo <- http_post_json(srv, "/api/graficos/iconos-recetario/elegir", body = list(contexto = "lamina", textos = list("x")))
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_ICONO_CONTEXTO")
})

test_that("GET /iconos-recetario entrega cada color como lista aunque tenga un solo ícono", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/iconos-recetario?color=verde")
  expect_identical(r$status, 200L)
  expect_match(rawToChar(r$raw), '"verde":["', fixed = TRUE)
})

test_that("POST /word acepta opciones_documento en el body y rechaza una portada inválida con 400", {
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  plan <- list(slides = list(list(tipo = "p_slide_1_grafico",
                                  payload = list(titulo = "Región", grafico = list(graficador = "p_barras_agrupadas", args = list(var = "region"))))))
  malo <- http_post_json(srv, "/api/graficos/word", body = list(plan = plan, opciones_documento = list(portada = "D")), sid = base$sid)
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code %||% malo$json$code, "E_BAD_DOCUMENTO_WORD")
  bien <- http_post_json(srv, "/api/graficos/word", body = list(plan = plan, opciones_documento = list(portada = "C", titulo_corto = "Prueba")),
                         sid = base$sid)
  expect_identical(bien$status, 200L)
  expect_true(is.character(bien$json$job_id) && nzchar(bien$json$job_id))
})
