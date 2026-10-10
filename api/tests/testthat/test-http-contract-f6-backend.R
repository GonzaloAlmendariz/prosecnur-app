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

test_that("GET /estandar entrega los 22 tipos de lámina con ranuras en pulgadas, colores y paletas (K1)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/estandar")
  expect_identical(r$status, 200L)
  expect_length(r$json$tipos_lamina, 22L)
  t1 <- r$json$tipos_lamina[[1]]
  expect_identical(t1$id, "p_slide_1_grafico")
  expect_identical(t1$nombre, "Un gráfico")
  expect_true(nzchar(t1$uso))
  expect_identical(t1$ranuras[[1]]$rol, "grafico")
  expect_equal(t1$ranuras[[1]]$w, 12.523)
  expect_identical(r$json$colores$coral, "#CA5651")
  expect_identical(r$json$unidad, "in")
  expect_match(rawToChar(r$raw), '"ranuras":[{"rol":"grafico"', fixed = TRUE)   # arreglo aunque haya una sola ranura
})

test_that("GET /registry dice el tipo del estándar de cada lámina y null en las de estructura (K1)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/registry")
  expect_identical(r$status, 200L)
  por <- setNames(r$json$slides, vapply(r$json$slides, `[[`, "", "name"))
  expect_identical(por$p_slide_3_graficos_poblacion_corona$estandar$nombre, .std_tipo_lamina("p_slide_3_graficos_poblacion_corona")$nombre)
  expect_null(por$p_slide_portada$estandar)
  expect_identical(lengths(regmatches(rawToChar(r$raw), gregexpr('"estandar":null', rawToChar(r$raw), fixed = TRUE))), 11L)
})

test_that("GET /registry publica familia del editor y salida de cada graficador, con las familias en orden (K4)", {
  srv <- http_contract_server()
  r <- http_get(srv, "/api/graficos/registry")
  expect_identical(r$status, 200L)
  expect_identical(vapply(r$json$familias_editor, `[[`, "", "id"),
                   c("categorias", "escalas", "numeros", "comparar", "dimensiones", "territorio", "texto"))
  g <- setNames(r$json$graficadores, vapply(r$json$graficadores, `[[`, "", "name"))
  expect_identical(g$p_nube_palabras$familia_editor, "texto")
  expect_false(g$p_nube_palabras$salida_nativa)
  expect_identical(g$p_nube_palabras$salida, "marco")
  expect_true(nzchar(g$p_nube_palabras$salida_motivo))
  expect_true(isTRUE(g$p_barras_apiladas$salida_nativa))
  expect_identical(g$p_barras_apiladas$salida_motivo, "")
})
