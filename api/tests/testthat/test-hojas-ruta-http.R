# Transporte HTTP de Hojas de ruta hacia la capa de manzanas (ArcGIS).
# Ver api/R/hojas_ruta_http.R. La regla estructural ("ninguna salida a red sin
# handle") la cubre el censo de test-api-http-transporte.R.

test_that("hojas de ruta: el transporte acota esperas y es configurable por env", {
  old_timeout <- Sys.getenv("PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)

  Sys.unsetenv("PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS")
  Sys.unsetenv("PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS")
  expect_equal(.hojas_ruta_http_timeout_seconds(), 60)
  expect_equal(.hojas_ruta_http_connect_timeout_seconds(60), 10)

  Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = "1")
  expect_equal(.hojas_ruta_http_timeout_seconds(), 5)
  Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = "9999")
  expect_equal(.hojas_ruta_http_timeout_seconds(), 300)
  Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = "no-es-numero")
  expect_equal(.hojas_ruta_http_timeout_seconds(), 60)

  Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = "25")
  Sys.setenv(PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS = "300")
  expect_equal(.hojas_ruta_http_connect_timeout_seconds(), 25)
  Sys.setenv(PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS = "3")
  expect_equal(.hojas_ruta_http_connect_timeout_seconds(), 3)
})

test_that("hojas de ruta: el handle sale con timeout y connecttimeout aplicados", {
  opts <- list()
  testthat::local_mocked_bindings(
    handle_setopt = function(handle, ...) {
      opts <<- c(opts, list(list(...)))
      invisible(handle)
    },
    .package = "curl"
  )

  old_timeout <- Sys.getenv("PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)
  Sys.setenv(PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS = "25")
  Sys.setenv(PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS = "3")

  h <- .hojas_ruta_http_handle()
  expect_s3_class(h, "curl_handle")

  aplicados <- Filter(function(x) "timeout" %in% names(x), opts)
  expect_length(aplicados, 1L)
  expect_equal(aplicados[[1]]$timeout, 25)
  expect_equal(aplicados[[1]]$connecttimeout, 3)
})

test_that("hojas de ruta: el fetch de manzanas viaja con el handle acotado", {
  visto <- NULL
  testthat::local_mocked_bindings(
    curl_fetch_memory = function(url, handle = NULL, ...) {
      visto <<- list(url = url, handle = handle)
      list(status_code = 200L, content = charToRaw('{"features":[]}'))
    },
    .package = "curl"
  )

  out <- .hojas_ruta_fetch_json("https://services5.arcgis.test/query", list(where = "1=1"))
  expect_equal(out$features, list())
  # El defecto original era exactamente esto: la llamada iba sin handle.
  expect_s3_class(visto$handle, "curl_handle")
})
