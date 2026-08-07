# Contrato HTTP del router de calc-muestra: errores accionables (no 500
# E_INTERNAL genericos), CRUD de componentes y los 409 de flujo que la UI
# consume. Todo por el wire real (helper-http-contract.R); fixtures sinteticos.

.http_cm_router_session <- function(srv) {
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id
  expect_true(is.character(sid) && nzchar(sid))
  sid
}

# Sube un archivo sintetico por el flujo real de upload y devuelve file_id.
.http_cm_router_upload <- function(srv, sid, path) {
  subida <- http_post_multipart(
    srv, "/api/files/upload?kind=data",
    fields = list(file = curl::form_file(path)), sid = sid
  )
  expect_identical(subida$status, 201L)
  subida$json$file_id
}

.http_cm_router_xlsx <- function() {
  testthat::skip_if_not_installed("openxlsx")
  path <- tempfile("cm-router-marco-", fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", data.frame(
    facultad = c("Ciencias", "Letras", "Ciencias"),
    curso = c("MAT-101", "LIT-201", "FIS-105"),
    matriculados = c(30L, 22L, 27L),
    stringsAsFactors = FALSE, check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# --- T1a: explorar-base traduce los stop() crudos de lectura -----------------

test_that("explorar-base con hoja inexistente responde 400 con las hojas disponibles", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)
  xlsx <- .http_cm_router_xlsx()
  withr::defer(unlink(xlsx, force = TRUE))
  file_id <- .http_cm_router_upload(srv, sid, xlsx)

  r <- http_post_json(
    srv, "/api/calc-muestra/marco/explorar-base",
    body = list(file_id = file_id, sheet = "NoExiste"),
    sid = sid
  )
  expect_identical(r$status, 400L)
  expect_true(is.list(r$json$error))
  expect_identical(r$json$error$code, "E_CALC_MUESTRA_EXPLORAR_HOJA")
  expect_match(as.character(r$json$error$message), "Hojas disponibles", fixed = TRUE)
  # El listado real de hojas viaja en el mensaje: el usuario corrige sin adivinar.
  expect_match(as.character(r$json$error$message), "datos", fixed = TRUE)
})

test_that("explorar-base con formato no soportado responde 400 de archivo, no 500", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)
  bin <- tempfile("cm-router-base-", fileext = ".bin")
  writeBin(as.raw(c(0x00, 0x01, 0x02)), bin)
  withr::defer(unlink(bin, force = TRUE))
  file_id <- .http_cm_router_upload(srv, sid, bin)

  r <- http_post_json(
    srv, "/api/calc-muestra/marco/explorar-base",
    body = list(file_id = file_id),
    sid = sid
  )
  expect_identical(r$status, 400L)
  expect_identical(r$json$error$code, "E_CALC_MUESTRA_EXPLORAR_ARCHIVO")
  expect_match(as.character(r$json$error$message), "no soportado", fixed = TRUE)
})

# --- T1b: construir traduce payloads malformados -----------------------------

test_that("construir con payload malformado responde 400 E_CALC_MUESTRA_AULAS_FRAME", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  r <- http_post_json(
    srv, "/api/calc-muestra/marco/construir",
    body = list(base_madre = "no-soy-una-tabla"),
    sid = sid
  )
  expect_identical(r$status, 400L)
  expect_identical(r$json$error$code, "E_CALC_MUESTRA_AULAS_FRAME")
  expect_match(as.character(r$json$error$message), "base_madre", fixed = TRUE)
})

# --- T5b: CRUD de componentes por el wire ------------------------------------

test_that("el CRUD de componentes crea, actualiza y elimina por id", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  alta <- http_post_json(
    srv, "/api/calc-muestra/componente",
    body = list(componente = list(actor = "Docentes sinteticos")),
    sid = sid
  )
  expect_identical(alta$status, 200L)
  expect_true(isTRUE(alta$json$ok))
  comp_id <- alta$json$componente$id
  expect_true(is.character(comp_id) && grepl("^cmp-", comp_id))
  expect_identical(length(alta$json$estudio$componentes), 1L)

  actualizada <- http_post_json(
    srv, "/api/calc-muestra/componente",
    body = list(
      op = "update",
      componente = list(id = comp_id, actor = "Docentes actualizados")
    ),
    sid = sid
  )
  expect_identical(actualizada$status, 200L)
  comps <- actualizada$json$estudio$componentes
  expect_identical(length(comps), 1L)
  expect_identical(comps[[1]]$id, comp_id)
  expect_identical(comps[[1]]$actor, "Docentes actualizados")

  borrada <- http_delete_json(
    srv, "/api/calc-muestra/componente",
    body = list(id = comp_id),
    sid = sid
  )
  expect_identical(borrada$status, 200L)
  expect_identical(length(borrada$json$estudio$componentes), 0L)

  estado <- http_get(srv, "/api/calc-muestra/state", sid = sid)
  expect_identical(estado$status, 200L)
  expect_identical(length(estado$json$estudio$componentes), 0L)
})

test_that("DELETE de componente sin id responde E_NO_ID", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  r <- http_delete_json(srv, "/api/calc-muestra/componente", body = list(), sid = sid)
  # El registro (errors_registry.R) declara E_NO_ID como 400 y el endpoint lo
  # emite asi desde siempre; el contrato congelado aqui es codigo + status
  # registrados, no el 409 de los demas errores de flujo.
  expect_identical(r$status, 400L)
  expect_identical(r$json$error$code, "E_NO_ID")
})

# --- T5c: los 409 de flujo que consume la UI ---------------------------------

test_that("calcular sin estudio responde 409 E_SIN_ESTUDIO", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  r <- http_post_json(srv, "/api/calc-muestra/calcular", sid = sid)
  expect_identical(r$status, 409L)
  expect_identical(r$json$error$code, "E_SIN_ESTUDIO")
})

test_that("calcular con estudio sin componentes responde 409 E_SIN_COMPONENTES", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  creado <- http_post_json(
    srv, "/api/calc-muestra/estudio",
    body = list(estudio = list(titulo = "Estudio vacio sintetico")),
    sid = sid
  )
  expect_identical(creado$status, 200L)

  r <- http_post_json(srv, "/api/calc-muestra/calcular", sid = sid)
  expect_identical(r$status, 409L)
  expect_identical(r$json$error$code, "E_SIN_COMPONENTES")
})

test_that("comparar-metodos sin marco responde 409 E_SIN_MARCO_AULAS", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  r <- http_post_json(srv, "/api/calc-muestra/aulas/comparar-metodos", sid = sid)
  expect_identical(r$status, 409L)
  expect_identical(r$json$error$code, "E_SIN_MARCO_AULAS")
})

test_that("simular-reemplazos sin seleccion responde 409 E_SIN_SELECCION_AULAS", {
  srv <- http_contract_server()
  sid <- .http_cm_router_session(srv)

  r <- http_post_json(srv, "/api/calc-muestra/aulas/simular-reemplazos", sid = sid)
  expect_identical(r$status, 409L)
  expect_identical(r$json$error$code, "E_SIN_SELECCION_AULAS")
})
