# Transporte HTTP hacia Google (api/R/monitoreo_google_http.R).
#
# Por qué existe este archivo: Plumber atiende en un solo hilo, así que un
# handle sin `timeout`/`connecttimeout` no cuelga solo la ruta que lo usa —
# cuelga el backend entero (se observó /api/system/health y la apertura del
# módulo respondiendo 500 detrás de una llamada a Google colgada). El agujero
# estaba en los tres caminos a la vez (Sheets API, canje OAuth y refresh), por
# eso además de los tests de límites hay un guard sobre monitoreo_engine.R.

test_that("google: el transporte acota esperas y es configurable por env", {
  old_timeout <- Sys.getenv("PROSECNUR_GOOGLE_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_GOOGLE_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)

  Sys.unsetenv("PROSECNUR_GOOGLE_TIMEOUT_SECONDS")
  Sys.unsetenv("PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS")
  expect_equal(.monitoreo_google_timeout_seconds(), 60)
  expect_equal(.monitoreo_google_connect_timeout_seconds(60), 10)

  # Valores absurdos quedan dentro de la banda, nunca en "sin límite".
  Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = "1")
  expect_equal(.monitoreo_google_timeout_seconds(), 5)
  Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = "9999")
  expect_equal(.monitoreo_google_timeout_seconds(), 300)
  Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = "no-es-numero")
  expect_equal(.monitoreo_google_timeout_seconds(), 60)

  # El connect timeout nunca supera al total.
  Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = "20")
  Sys.setenv(PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS = "300")
  expect_equal(.monitoreo_google_connect_timeout_seconds(), 20)
  Sys.setenv(PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS = "4")
  expect_equal(.monitoreo_google_connect_timeout_seconds(), 4)
})

test_that("google: los dos constructores salen con timeout y connecttimeout aplicados", {
  opts <- list()
  testthat::local_mocked_bindings(
    handle_setopt = function(handle, ...) {
      opts <<- c(opts, list(list(...)))
      invisible(handle)
    },
    .package = "curl"
  )

  old_timeout <- Sys.getenv("PROSECNUR_GOOGLE_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_GOOGLE_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)
  Sys.setenv(PROSECNUR_GOOGLE_TIMEOUT_SECONDS = "35")
  Sys.setenv(PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS = "6")

  for (constructor in list(
    function() .monitoreo_google_handle("ya29.token_fixture", "GET"),
    function() .monitoreo_google_oauth_handle()
  )) {
    opts <- list()
    h <- constructor()
    expect_s3_class(h, "curl_handle")
    aplicados <- Filter(function(x) "timeout" %in% names(x), opts)
    expect_length(aplicados, 1L)
    expect_equal(aplicados[[1]]$timeout, 35)
    expect_equal(aplicados[[1]]$connecttimeout, 6)
  }
})

test_that("google: ningún camino de red del engine escapa a los constructores", {
  ruta <- testthat::test_path("..", "..", "R", "monitoreo_engine.R")
  fuente <- readLines(ruta, warn = FALSE, encoding = "UTF-8")
  # Guard sobre el archivo entero, no sobre los tres sitios conocidos: el
  # agujero apareció tres veces seguidas en el mismo engine.
  expect_false(any(grepl("curl::new_handle", fuente, fixed = TRUE)))
})
