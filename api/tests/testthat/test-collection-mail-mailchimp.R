# «Actualizar quién respondió»: respuestas de SurveyMonkey → etiqueta en
# Mailchimp. Sin red: SurveyMonkey, Mailchimp y los tokens se reemplazan.

.mc_fx_csv <- function() {
  paste(
    "Apellidos y nombres,Correo,Enlace",
    "\"QUISPE MAMANI, ANA\",ana@ejemplo.org,https://es.surveymonkey.com/r/ABC?t=tokana01",
    "\"ROJAS VEGA, CARLOS\",carlos@ejemplo.org,https://es.surveymonkey.com/r/ABC?t=tokcar02",
    "\"TORRES, LUZ\",luz@ejemplo.org,https://es.surveymonkey.com/r/ABC?t=tokluz03",
    "\"PAREDES, MARIA\",maria@ejemplo.org,https://es.surveymonkey.com/r/ABC?t=tokmar04",
    sep = "\n"
  )
}

.mc_fx_responses <- function() {
  r <- function(status, t) list(response_status = status, custom_variables = if (is.null(t)) list() else list(t = t))
  list(data = list(
    r("completed", "tokana01"),
    r("completed", "tokcar02"),
    r("partial", "tokluz03"),
    r("completed", "otrotok9"),   # de otra campaña o de una prueba
    r("completed", NULL)          # entró sin token (vista previa)
  ))
}

KEY <- paste0(strrep("a", 32), "-us21")

.mc_fx_tokens <- function(provider, sid = NULL, ...) if (identical(provider, "mailchimp")) KEY else "sm-token"

test_that("cruza tokens de respuestas completas con la campaña y etiqueta solo a esos correos", {
  sid <- .cmail_fx_session(logos = FALSE)
  .cmail_fx_import(sid, csv = .mc_fx_csv())
  calls <- list()
  local_mocked_bindings(
    .connections_token_require = .mc_fx_tokens,
    sm_api_fetch_all_responses_bulk = function(survey_id, token, ...) .mc_fx_responses(),
    .mc_http = function(method, url, key, body = NULL) {
      calls[[length(calls) + 1L]] <<- list(method = method, url = url, body = body)
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list(list(id = 77L, name = "Respondió")))))
      if (grepl("/segments/77$", url)) return(list(status = 200L, body = list(total_added = length(body$members_to_add), errors = list())))
      stop("llamada inesperada: ", url)
    }
  )
  out <- collection_mail_mailchimp_sync(sid, survey_id = "528810615", list_id = "abc123")
  expect_equal(out$recipients_with_token, 4L)
  expect_equal(out$responses, 5L)
  expect_equal(out$completed, 4L)
  expect_equal(out$partial, 1L)
  expect_equal(out$without_token, 1L)
  expect_equal(out$from_other_campaign, 1L)
  expect_equal(out$respondents, 2L)
  expect_equal(out$pending, 2L)
  expect_equal(out$tagged, 2L)
  # Mailchimp recibe exactamente los dos correos que completaron, y nada más.
  post <- Filter(function(x) identical(x$method, "POST"), calls)
  expect_length(post, 1L)
  expect_setequal(unlist(post[[1]]$body$members_to_add), c("ana@ejemplo.org", "carlos@ejemplo.org"))
  expect_match(post[[1]]$url, "^https://us21\\.api\\.mailchimp\\.com/3\\.0/lists/abc123/segments/77$")
  # La respuesta a la UI no trae correos.
  expect_false(any(grepl("@", unlist(out))))
})

test_that("crea la etiqueta si la audiencia no la tiene", {
  sid <- .cmail_fx_session(logos = FALSE)
  .cmail_fx_import(sid, csv = .mc_fx_csv())
  creada <- NULL
  local_mocked_bindings(
    .connections_token_require = .mc_fx_tokens,
    sm_api_fetch_all_responses_bulk = function(...) .mc_fx_responses(),
    .mc_http = function(method, url, key, body = NULL) {
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list())))
      if (identical(method, "POST") && grepl("/segments$", url)) { creada <<- body$name; return(list(status = 200L, body = list(id = 5L))) }
      list(status = 200L, body = list(total_added = 2L, errors = list()))
    }
  )
  out <- collection_mail_mailchimp_sync(sid, survey_id = "1", list_id = "abc", tag = "Respondió acreditación")
  expect_identical(creada, "Respondió acreditación")
  expect_equal(out$tagged, 2L)
})

test_that("cuenta a quien no está en la audiencia y reparte en lotes de 500", {
  n <- 1203L
  csv <- paste(c("Apellidos y nombres,Correo,Enlace",
                 sprintf("\"P, N%d\",p%d@ejemplo.org,https://x.org/r/A?t=tok%05d", seq_len(n), seq_len(n), seq_len(n))), collapse = "\n")
  sid <- .cmail_fx_session(logos = FALSE)
  .cmail_fx_import(sid, csv = csv)
  lotes <- integer()
  local_mocked_bindings(
    .connections_token_require = .mc_fx_tokens,
    sm_api_fetch_all_responses_bulk = function(...) list(data = lapply(seq_len(n), function(i)
      list(response_status = "completed", custom_variables = list(t = sprintf("tok%05d", i))))),
    .mc_http = function(method, url, key, body = NULL) {
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list(list(id = 1L, name = "Respondió")))))
      lotes[[length(lotes) + 1L]] <<- length(body$members_to_add)
      list(status = 200L, body = list(total_added = length(body$members_to_add) - 1L,
                                      errors = list(list(email_address = "x", error = "no está en la audiencia"))))
    }
  )
  out <- collection_mail_mailchimp_sync(sid, survey_id = "1", list_id = "abc")
  expect_equal(lotes, c(500L, 500L, 203L))
  expect_equal(out$tagged, n - 3L)
  expect_equal(out$not_in_audience, 3L)
})

test_that("dry_run cuenta sin tocar Mailchimp ni pedir su clave", {
  sid <- .cmail_fx_session(logos = FALSE)
  .cmail_fx_import(sid, csv = .mc_fx_csv())
  local_mocked_bindings(
    .connections_token_require = function(provider, ...) {
      if (identical(provider, "mailchimp")) stop("no debía pedir la clave de Mailchimp")
      "sm-token"
    },
    sm_api_fetch_all_responses_bulk = function(...) .mc_fx_responses(),
    .mc_http = function(...) stop("no debía llamar a Mailchimp")
  )
  out <- collection_mail_mailchimp_sync(sid, survey_id = "1", list_id = "", dry_run = TRUE)
  expect_true(out$dry_run)
  expect_equal(out$respondents, 2L)
  expect_equal(out$tagged, 0L)
})

test_that("sin destinatarios o sin tokens dice qué falta", {
  sid <- .cmail_fx_session(logos = FALSE)
  local_mocked_bindings(.connections_token_require = .mc_fx_tokens)
  expect_error(collection_mail_mailchimp_sync(sid, survey_id = "1", list_id = "a"), class = "api_error")
  e <- tryCatch(collection_mail_mailchimp_sync(sid, survey_id = "1", list_id = "a"), error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_SYNC_NO_RECIPIENTS")

  .cmail_fx_import(sid, csv = paste("Apellidos y nombres,Correo,Enlace", "\"A, B\",a@ejemplo.org,https://x.org/sin-token", sep = "\n"))
  e <- tryCatch(collection_mail_mailchimp_sync(sid, survey_id = "1", list_id = "a"), error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_SYNC_NO_TOKENS")

  e <- tryCatch(collection_mail_mailchimp_sync(sid, survey_id = "", list_id = "a"), error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_SYNC_INPUT")
})

test_that("la clave de Mailchimp se valida por forma y un 401 se dice como clave rechazada", {
  e <- tryCatch(.mc_dc("sin-forma"), error = function(e) e)
  expect_identical(e$code, "E_MAILCHIMP_TOKEN")
  expect_identical(.mc_dc(KEY), "us21")
  local_mocked_bindings(.mc_http = function(...) list(status = 401L, body = list(detail = "API Key Invalid")))
  e <- tryCatch(mailchimp_api_ping(KEY), error = function(e) e)
  expect_identical(e$code, "E_MAILCHIMP_TOKEN")
})

test_that("Mailchimp es un proveedor de conexión con su propio secreto", {
  expect_identical(.connections_normalize_provider("mailchimp"), "mailchimp")
  expect_identical(.connections_secret_name("mailchimp"), "mailchimp_key")
  expect_identical(.connections_provider_label("mailchimp"), "Mailchimp")
})

test_that(".mc_token_of saca la variable t de un enlace y de nada más", {
  expect_identical(.mc_token_of("https://es.surveymonkey.com/r/GWB65HY?t=b6wgmx5946"), "b6wgmx5946")
  expect_identical(.mc_token_of("https://x.org/r/A?lang=es&t=abc_12-Z"), "abc_12-Z")
  expect_true(is.na(.mc_token_of("https://x.org/r/A?type=1")))
  expect_true(is.na(.mc_token_of("")))
})
