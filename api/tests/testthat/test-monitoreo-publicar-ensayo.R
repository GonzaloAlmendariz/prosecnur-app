# Ensayo «Revisar» de las publicaciones de Salidas a Google Sheets (Meta B, L38).
#
# Sin red: la Sheets API va por `.sheets_api_mock()` (helper-sheets-mock.R) o
# por `.monitoreo_google_api_once` mockeado cuando lo que se prueba es la
# clasificación del status HTTP en el transporte.

.mpe_test_sin_escrituras <- function(mock) {
  metodos <- vapply(mock$env$calls, function(c) toupper(c$method %||% "GET"), character(1))
  expect_true(all(metodos == "GET"), info = "el ensayo no puede hacer POST")
  expect_false(any(grepl("batchUpdate", vapply(mock$env$calls, function(c) c$url, character(1)))))
}

.mpe_test_error_code <- function(expr) {
  err <- tryCatch({ force(expr); NULL }, api_error = function(e) e)
  expect_s3_class(err, "api_error")
  err
}

# ---------- comparación pura ----------

test_that("con clave única en la primera columna separa añadidas, cambiadas y borradas", {
  actual <- list(c("Código", "Estado"), c("A1", "pendiente"), c("A2", "ok"), c("A3", "ok"))
  nuevo <- list(c("Código", "Estado"), c("A1", "ok"), c("A2", "ok"), c("A4", "nuevo"))
  d <- monitoreo_publicar_ensayo_comparar(actual, nuevo)
  expect_false(d$sin_clave)
  expect_identical(d$clave, "Código")
  expect_identical(c(d$anadidas, d$cambiadas, d$borradas), c(1L, 1L, 1L))
  expect_identical(d$detalle$cambiadas[[1]]$clave, "A1")
  expect_identical(d$detalle$cambiadas[[1]]$celdas[[1]]$columna, "Estado")
  expect_identical(d$detalle$cambiadas[[1]]$celdas[[1]]$antes, "pendiente")
  expect_identical(d$detalle$borradas[[1]]$clave, "A3")
  expect_identical(d$detalle$anadidas[[1]]$clave, "A4")
  expect_true(d$destructiva)
  expect_false(d$encoge)
})

test_that("sin clave única compara filas completas como multiconjunto", {
  actual <- list(c("Nivel", "Detalle"), c("alta", "x"), c("alta", "x"), c("baja", "y"))
  nuevo <- list(c("Nivel", "Detalle"), c("alta", "x"), c("baja", "z"), c("baja", "y"))
  d <- monitoreo_publicar_ensayo_comparar(actual, nuevo)
  expect_true(d$sin_clave)
  expect_identical(d$clave, "")
  expect_identical(c(d$anadidas, d$cambiadas, d$borradas), c(1L, 0L, 1L))
  expect_identical(d$detalle$anadidas[[1]]$valores, list("baja", "z"))
  expect_identical(d$detalle$borradas[[1]]$valores, list("alta", "x"))
})

test_that("la cabecera se compara aparte como columnas cambiadas", {
  d <- monitoreo_publicar_ensayo_comparar(
    list(c("Código", "Estado"), c("A1", "ok")),
    list(c("Código", "Situación"), c("A1", "ok"))
  )
  expect_length(d$columnas_cambiadas, 1L)
  expect_identical(d$columnas_cambiadas[[1]]$antes, "Estado")
  expect_identical(d$columnas_cambiadas[[1]]$despues, "Situación")
  expect_identical(c(d$anadidas, d$cambiadas, d$borradas), c(0L, 0L, 0L))
  expect_false(d$sin_cambios)
  expect_false(d$destructiva)
})

test_that("una hoja que encoge se marca destructiva aunque no borre claves", {
  actual <- list(c("Indicador", "Valor"), c("a", "1"), c("b", "2"), c("c", "3"))
  nuevo <- list(c("Indicador", "Valor"), c("a", "1"))
  d <- monitoreo_publicar_ensayo_comparar(actual, nuevo)
  expect_true(d$encoge)
  expect_identical(c(d$filas_antes, d$filas_despues), c(4L, 2L))
  expect_true(d$destructiva)
})

test_that("pestaña inexistente: todo es añadido y no encoge", {
  d <- monitoreo_publicar_ensayo_comparar(list(), list(c("K", "V"), c("a", "1"), c("b", "2")))
  expect_identical(c(d$anadidas, d$cambiadas, d$borradas), c(2L, 0L, 0L))
  expect_false(d$encoge)
  expect_false(d$destructiva)
})

# ---------- ensayo completo contra el mock del libro ----------

.mpe_test_tabs <- function() {
  list(
    "Prosecnur - Resumen" = list(c("Indicador", "Valor"), c("efectivas", "12"), c("meta", "40")),
    "Prosecnur - Alertas" = list(c("Nivel", "Tipo", "Detalle"), c("alta", "cuota", "Falta Docentes"))
  )
}

test_that("el ensayo lee, compara, lista las ajenas intactas y no escribe nada", {
  mock <- .sheets_api_mock()
  mock$seed("Prosecnur - Resumen", list(list("Indicador", "Valor"), list("efectivas", "10"), list("meta", "40"), list("viejo", "1")))
  mock$seed("Hoja del equipo", list(list("Agenda"), list("lunes")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler, .package = "prosecnurapp")

  out <- monitoreo_publicar_ensayo("sheet_libro", .mpe_test_tabs())
  .mpe_test_sin_escrituras(mock)
  expect_identical(unlist(out$intactas), "Hoja del equipo")

  resumen <- out$pestanas[[1]]
  expect_identical(resumen$pestana, "Prosecnur - Resumen")
  expect_false(resumen$se_crea)
  expect_identical(c(resumen$anadidas, resumen$cambiadas, resumen$borradas), c(0L, 1L, 1L))
  expect_true(resumen$encoge)

  alertas <- out$pestanas[[2]]
  expect_true(alertas$se_crea)
  expect_identical(alertas$anadidas, 1L)
  expect_false(alertas$destructiva)

  expect_identical(out$resumen$pestanas_nuevas, 1L)
  expect_identical(out$resumen$pestanas_que_encogen, 1L)
  expect_true(out$resumen$destructivo)
  # La pestaña ajena sigue igual: el ensayo no la leyó ni la tocó.
  expect_identical(mock$env$sheets[["Hoja del equipo"]]$values, list(list("Agenda"), list("lunes")))
})

test_that("respuesta parcial: values más cortos y filas de largo desigual no inventan cambios", {
  mock <- .sheets_api_mock()
  # Sheets omite la cola vacía: la segunda fila llega corta y la última vacía no llega.
  tabs <- list("Prosecnur - Auditoria" = list(c("Campo", "Valor", "Nota"), c("rows", "12", ""), c("profile", "acr", "x")))
  mock$seed("Prosecnur - Auditoria", list(list("Campo", "Valor", "Nota"), list("rows", "12"), list("profile", "acr", "x")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler, .package = "prosecnurapp")
  out <- monitoreo_publicar_ensayo("sheet_libro", tabs)
  p <- out$pestanas[[1]]
  expect_true(p$sin_cambios)
  expect_false(out$resumen$destructivo)
})

test_that("una lectura que no trae una pestaña existente falla sin publicar", {
  mock <- .sheets_api_mock()
  mock$seed("Prosecnur - Resumen", list(list("Indicador", "Valor")))
  handler <- function(url, method = "GET", body = NULL) {
    if (grepl("values:batchGet", url)) return(list(valueRanges = list()))
    mock$handler(url, method, body)
  }
  testthat::local_mocked_bindings(.monitoreo_google_api = handler, .package = "prosecnurapp")
  err <- .mpe_test_error_code(monitoreo_publicar_ensayo("sheet_libro", .mpe_test_tabs()))
  expect_identical(err$code, "E_SHEETS_ENSAYO_INCOMPLETO")
  .mpe_test_sin_escrituras(mock)
})

# ---------- fallos del transporte, clasificados por status ----------

.mpe_test_status <- function(status) {
  testthat::local_mocked_bindings(
    .monitoreo_google_api_once = function(url, method = "GET", body = NULL, token = NULL) {
      list(status_code = status, parsed = list(error = list(message = sprintf("HTTP %s simulado", status))))
    },
    .monitoreo_sheets_refresh_access_token = function(...) stop("sin refresh en el test", call. = FALSE),
    .package = "prosecnurapp"
  )
  .mpe_test_error_code(monitoreo_publicar_ensayo("sheet_libro", .mpe_test_tabs()))
}

test_that("rate limit (429) devuelve E_SHEETS_RATE_LIMIT", {
  err <- .mpe_test_status(429L)
  expect_identical(err$code, "E_SHEETS_RATE_LIMIT")
  expect_identical(err$status, 429)
})

test_that("credencial inválida (401) y sin permiso (403) devuelven E_SHEETS_CREDENCIAL", {
  expect_identical(.mpe_test_status(401L)$code, "E_SHEETS_CREDENCIAL")
  expect_identical(.mpe_test_status(403L)$code, "E_SHEETS_CREDENCIAL")
})

test_that("otro status queda como E_GOOGLE_SHEETS con el mensaje de Google", {
  err <- .mpe_test_status(500L)
  expect_identical(err$code, "E_GOOGLE_SHEETS")
  expect_match(err$message, "HTTP 500 simulado")
})

test_that("timeout del transporte devuelve E_SHEETS_TIMEOUT", {
  testthat::local_mocked_bindings(
    .monitoreo_google_api_once = function(...) {
      stop(structure(
        class = c("curl_error_operation_timedout", "curl_error", "error", "condition"),
        list(message = "Timeout was reached [sheets.googleapis.com]", call = NULL)
      ))
    },
    .package = "prosecnurapp"
  )
  err <- .mpe_test_error_code(monitoreo_publicar_ensayo("sheet_libro", .mpe_test_tabs()))
  expect_identical(err$code, "E_SHEETS_TIMEOUT")
})

test_that("el error HTTP de Google conserva el mensaje de siempre para los llamadores viejos", {
  e <- .monitoreo_google_http_error("Quota exceeded", 429L)
  expect_s3_class(e, "error")
  expect_identical(conditionMessage(e), "Quota exceeded")
  expect_identical(.monitoreo_google_error_tipo(e), "rate_limit")
  expect_identical(.monitoreo_google_error_tipo(simpleError("otra cosa")), "otro")
})

# ---------- destino compartido con Aplicar ----------

test_that("el ensayo interno revisa exactamente las pestañas que publicaría Aplicar", {
  s <- list(
    monitoreo_snapshot = list(data = data.frame(id = 1:3), synced_at = "2026-10-25T10:00:00Z", dashboard = list(kpis = list(efectivas = 3))),
    monitoreo_config = list()
  )
  d <- monitoreo_publicar_destino_interno("sid-test", s, list(spreadsheet_id = "sheet_libro"))
  expect_identical(d$spreadsheet_id, "sheet_libro")
  expect_identical(names(d$tabs), c("Prosecnur - Resumen", "Prosecnur - Alertas", "Prosecnur - Auditoria", "Prosecnur - Reporte"))

  mock <- .sheets_api_mock()
  mock$seed("Notas del equipo", list(list("x")))
  testthat::local_mocked_bindings(.monitoreo_google_api = mock$handler, .package = "prosecnurapp")
  out <- monitoreo_publicar_ensayo(d$spreadsheet_id, d$tabs)
  expect_identical(vapply(out$pestanas, function(p) p$pestana, character(1)), names(d$tabs))
  expect_true(all(vapply(out$pestanas, function(p) isTRUE(p$se_crea), logical(1))))
  expect_identical(unlist(out$intactas), "Notas del equipo")
  .mpe_test_sin_escrituras(mock)

  # Y Aplicar, sobre el mismo libro, deja intacta la pestaña ajena.
  monitoreo_sheets_publish_tabs(d$spreadsheet_id, d$tabs)
  expect_identical(mock$env$sheets[["Notas del equipo"]]$values, list(list("x")))
  despues <- monitoreo_publicar_ensayo(d$spreadsheet_id, d$tabs)
  expect_true(all(vapply(despues$pestanas, function(p) isTRUE(p$sin_cambios), logical(1))))
})

test_that("sin datos sincronizados el destino interno responde E_NO_MONITOREO_DATA", {
  err <- .mpe_test_error_code(monitoreo_publicar_destino_interno("sid-test", list(), list(spreadsheet_id = "x")))
  expect_identical(err$code, "E_NO_MONITOREO_DATA")
})
