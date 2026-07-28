# Transporte HTTP de la publicación del dashboard (api/R/dashboard_publish.R).
#
# Por qué existe este archivo: Plumber atiende en un solo hilo, así que un
# handle sin `timeout`/`connecttimeout` no cuelga solo la ruta de publicación —
# cuelga el backend entero (se observó /api/system/health respondiendo 500
# detrás de una llamada de red colgada). El mismo agujero apareció ya en los
# clientes de Kobo, SurveyMonkey y Google, por eso además del test de los
# límites hay un guard sobre el archivo completo.

test_that("hugging face: el transporte acota esperas y es configurable por env", {
  old_timeout <- Sys.getenv("PROSECNUR_HF_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_HF_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)

  Sys.unsetenv("PROSECNUR_HF_TIMEOUT_SECONDS")
  Sys.unsetenv("PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS")
  # Total holgado como margen para un HF lento; la subida de artefactos va por
  # `git push` y queda fuera de este límite.
  expect_equal(.hf_api_timeout_seconds(), 180)
  expect_equal(.hf_api_connect_timeout_seconds(180), 10)

  # Valores absurdos quedan dentro de la banda, nunca en "sin límite".
  Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = "1")
  expect_equal(.hf_api_timeout_seconds(), 10)
  Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = "99999")
  expect_equal(.hf_api_timeout_seconds(), 1800)
  Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = "no-es-numero")
  expect_equal(.hf_api_timeout_seconds(), 180)

  # El connect timeout nunca supera al total.
  Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = "30")
  Sys.setenv(PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS = "300")
  expect_equal(.hf_api_connect_timeout_seconds(), 30)
  Sys.setenv(PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS = "5")
  expect_equal(.hf_api_connect_timeout_seconds(), 5)
})

test_that("hugging face: el handle sale con timeout y connecttimeout aplicados", {
  opts <- list()
  testthat::local_mocked_bindings(
    handle_setopt = function(handle, ...) {
      opts <<- c(opts, list(list(...)))
      invisible(handle)
    },
    .package = "curl"
  )

  old_timeout <- Sys.getenv("PROSECNUR_HF_TIMEOUT_SECONDS", unset = NA_character_)
  old_connect <- Sys.getenv("PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS", unset = NA_character_)
  on.exit({
    if (is.na(old_timeout)) Sys.unsetenv("PROSECNUR_HF_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = old_timeout)
    if (is.na(old_connect)) Sys.unsetenv("PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS") else Sys.setenv(PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS = old_connect)
  }, add = TRUE)
  Sys.setenv(PROSECNUR_HF_TIMEOUT_SECONDS = "45")
  Sys.setenv(PROSECNUR_HF_CONNECT_TIMEOUT_SECONDS = "7")

  h <- .hf_new_handle("hf_token_fixture", "application/json")
  expect_s3_class(h, "curl_handle")

  aplicados <- Filter(function(x) "timeout" %in% names(x), opts)
  expect_length(aplicados, 1L)
  expect_equal(aplicados[[1]]$timeout, 45)
  expect_equal(aplicados[[1]]$connecttimeout, 7)
})

test_that("hugging face: ningún handle de dashboard_publish.R escapa al constructor", {
  ruta <- testthat::test_path("..", "..", "R", "dashboard_publish.R")
  fuente <- readLines(ruta, warn = FALSE, encoding = "UTF-8")
  # Las líneas de comentario no cuentan (esta regla se documenta en el propio
  # archivo), pero se preserva la numeración para ubicar la función dueña.
  codigo <- fuente
  codigo[grepl("^\\s*#", fuente)] <- ""

  crudos <- grep("curl::new_handle", codigo, fixed = TRUE)
  expect_length(crudos, 1L)

  # El único `curl::new_handle()` del archivo vive dentro de .hf_new_handle(),
  # que es quien aplica los límites. Cualquier otro camino de red sin pasar por
  # ahí vuelve a exponer el backend a un socket colgado.
  definiciones <- grep("^\\.?[A-Za-z0-9._]+ <- function", codigo)
  duena <- max(definiciones[definiciones < crudos[1]])
  expect_match(fuente[duena], "^\\.hf_new_handle <- function")
})
