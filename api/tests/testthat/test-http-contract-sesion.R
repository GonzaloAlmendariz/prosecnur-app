# =============================================================================
# Contrato HTTP real — sesion y estado del estudio.
# =============================================================================
#
# Esta suite ejercita el backend Plumber REAL por el wire (subproceso callr,
# puerto efimero de 127.0.0.1 — ver helper-http-contract.R). Cubre el ciclo
# minimo que el frontend hace al arrancar: health, crear sesion, leer estado,
# cargar una base real (demo empaquetado) y el shape del contrato de error
# {error: {code, message}}.

test_that("GET /api/system/health responde el contrato minimo por el wire", {
  srv <- http_contract_server()

  r <- http_get(srv, "/api/system/health")
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok))
  expect_true(is.character(r$json$version) && nzchar(r$json$version))
  # Campo legacy que el frontend sigue leyendo (SessionContext).
  expect_identical(r$json$prosecnur_version, r$json$version)
})

test_that("POST /api/session crea sesion y GET /api/session/state refleja el vacio", {
  srv <- http_contract_server()

  r <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(r$status, 200L)
  sid <- r$json$session_id
  expect_true(is.character(sid) && nzchar(sid))
  expect_false(isTRUE(r$json$reused))

  st <- http_get(srv, "/api/session/state", sid = sid)
  expect_identical(st$status, 200L)
  expect_identical(st$json$session_id, sid)
  # Sesion fresca: sin archivos, sin instrumento, sin bases.
  expect_false(isTRUE(st$json$xlsform))
  expect_false(isTRUE(st$json$data))
  expect_false(isTRUE(st$json$instrumento_parsed))
  expect_equal(as.numeric(st$json$n_bases), 0)
  expect_true(is.list(st$json$bases_nombres))
  expect_length(st$json$bases_nombres, 0)
})

test_that("los errores de la API viajan como {error:{code,message}} con el status correcto", {
  srv <- http_contract_server()

  # Sin header X-Pulso-Session el estado no existe: 404 + E_NO_SESSION.
  st <- http_get(srv, "/api/session/state")
  expect_identical(st$status, 404L)
  expect_true(is.list(st$json$error))
  expect_identical(st$json$error$code, "E_NO_SESSION")
  expect_true(is.character(st$json$error$message) && nzchar(st$json$error$message))
})

test_that("subir una base minima por el flujo real de carga deja el estudio consistente", {
  srv <- http_contract_server()

  # Flujo completo de Fase 1 por el wire: multipart del XLSForm, parseo del
  # instrumento, multipart de la data y normalizacion + preview. El fixture
  # se genera al vuelo (compatible por construccion) — los demos empaquetados
  # estan desalineados hoy (E_DATA_XLSFORM_INCOMPATIBLE, hallazgo aparte).
  base <- http_contract_upload_base(srv)
  sid <- base$sid
  expect_true(is.character(sid) && nzchar(sid))
  expect_true(is.list(base$instrumento_resumen))
  expect_true(is.list(base$data_preview))

  st <- http_get(srv, "/api/session/state", sid = sid)
  expect_identical(st$status, 200L)
  expect_identical(st$json$session_id, sid)
  expect_true(isTRUE(st$json$xlsform))
  expect_true(isTRUE(st$json$data))
  expect_true(isTRUE(st$json$instrumento_parsed))
  expect_true(isTRUE(st$json$data_previewed))
  expect_true(isTRUE(st$json$has_estudio))
  expect_equal(as.numeric(st$json$n_bases), 1)
  expect_true("default" %in% unlist(st$json$bases_nombres))
})
