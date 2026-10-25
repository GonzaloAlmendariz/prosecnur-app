# TXT-6/7: contrato HTTP REAL del diccionario por pregunta (Plumber en subproceso, ver helper-http-contract.R).
# Existe porque el handler llamado directo no ve la trampa del wire: plumber pasa los campos del cuerpo JSON como
# argumentos, y un handler sin `...` moría con «unused argument» (E_INTERNAL) aunque el test in-process pasara.

.dic_http_put <- function(srv, path, body, sid) {
  h <- curl::new_handle(timeout = 120)
  payload <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  curl::handle_setopt(h, customrequest = "PUT", postfields = payload, postfieldsize = length(payload))
  curl::handle_setheaders(h, Accept = "application/json", "Content-Type" = "application/json; charset=utf-8",
                          "X-Pulso-Session" = sid)
  .http_contract_parse_response(curl::curl_fetch_memory(paste0(srv$url, path), handle = h))
}

test_that("PUT y GET /api/texto-abierto/diccionario por el wire: guarda, devuelve listas y tipa los errores", {
  .http_contract_skip_if_unavailable()
  srv <- http_contract_server()
  base <- http_contract_upload_base(srv)
  sid <- base$sid

  body <- list(equivalencias = list(list(mostrar = "norte", formas = list("norte", "sur"))),
               excluir = list("clara"), frases = list())
  r <- .dic_http_put(srv, "/api/texto-abierto/diccionario?variable=region", body, sid)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok))
  expect_identical(r$json$diccionario$excluir, list("clara"))

  g <- http_get(srv, "/api/texto-abierto/diccionario?variable=region", sid = sid)
  expect_identical(g$status, 200L)
  expect_identical(g$json$base, r$json$base)
  expect_identical(g$json$diccionario$equivalencias[[1]]$formas, list("norte", "sur"))
  fila <- Find(function(p) identical(p$raiz, "sur"), g$json$palabras)
  expect_identical(fila$grupo, "norte")
  expect_identical(g$json$grupos[[1]]$personas, 8L)

  # Forma repetida entre grupos: 422 tipado, y el diccionario guardado no cambia.
  mal <- list(equivalencias = list(list(mostrar = "norte", formas = list("norte", "sur")),
                                   list(mostrar = "sur", formas = list("sur", "este"))))
  e <- .dic_http_put(srv, "/api/texto-abierto/diccionario?variable=region", mal, sid)
  expect_identical(e$status, 422L)
  expect_identical(e$json$error$code, "E_TXT_FORMA_REPETIDA")
  expect_identical(http_get(srv, "/api/texto-abierto/diccionario?variable=region", sid = sid)$json$diccionario$excluir,
                   list("clara"))

  e <- http_get(srv, "/api/texto-abierto/diccionario?variable=no_existe", sid = sid)
  expect_identical(e$status, 404L)
  expect_identical(e$json$error$code, "E_TXT_VARIABLE_NO_EXISTE")
  e <- http_get(srv, "/api/texto-abierto/diccionario?variable=region&base=fantasma", sid = sid)
  expect_identical(e$json$error$code, "E_TXT_BASE_NO_EXISTE")
})
