.collection_provider_env <- new.env(parent = baseenv())
assign("%||%", function(a, b) if (is.null(a) || (length(a) == 1L && is.na(a))) b else a, envir = .collection_provider_env)
sys.source(testthat::test_path("../../R/capture_url.R"), envir = .collection_provider_env)
sys.source(testthat::test_path("../../R/kobo_api.R"), envir = .collection_provider_env)
sys.source(testthat::test_path("../../R/surveymonkey_api.R"), envir = .collection_provider_env)

.collection_provider_fixture <- function(provider, filename) {
  jsonlite::fromJSON(
    testthat::test_path("fixtures", "collection_providers", provider, filename),
    simplifyVector = FALSE
  )
}

.collection_provider_mock <- function(name, replacement) {
  old <- get(name, envir = .collection_provider_env, inherits = FALSE)
  assign(name, replacement, envir = .collection_provider_env)
  withr::defer(assign(name, old, envir = .collection_provider_env), envir = parent.frame())
  invisible(NULL)
}

test_that("Kobo pagina assets survey y descarta tipos ajenos aun con respuesta parcial", {
  pages <- list(
    .collection_provider_fixture("kobo", "assets-page-1.json"),
    .collection_provider_fixture("kobo", "assets-page-2.json")
  )
  calls <- character(0)
  .collection_provider_mock(".kobo_api_fetch_json", function(url, token) {
    calls <<- c(calls, url)
    pages[[length(calls)]]
  })

  out <- .collection_provider_env$kobo_api_fetch_assets(
    "fixture-token",
    base_url = "https://kf.example.test",
    limit = 2L
  )

  expect_length(calls, 2L)
  expect_match(calls[[1]], "asset_type=survey", fixed = TRUE)
  expect_equal(vapply(out$assets, `[[`, character(1), "uid"), c("aSurveyOne", "aSurveyTwo"))
  expect_true(all(vapply(out$assets, `[[`, character(1), "asset_type") == "survey"))
  expect_equal(out$count, 2L)
  expect_equal(out$total, 3L)
})

test_that("Kobo v2 traduce la firma legacy page/page_size a start/limit", {
  url <- .collection_provider_env$kobo_api_asset_data_url(
    "asset fixture",
    base_url = "https://kf.example.test/",
    page = 3L,
    page_size = 250L,
    query = list(`_id` = list(`$gt` = 99L))
  )

  expect_match(url, "start=500", fixed = TRUE)
  expect_match(url, "limit=250", fixed = TRUE)
  expect_false(grepl("page_size=", url, fixed = TRUE))
  expect_false(grepl("&page=", url, fixed = TRUE))
  expect_match(utils::URLdecode(url), '"_id":{"$gt":99', fixed = TRUE)
})

test_that("Kobo valida import y deploy contra el contrato fixture v2", {
  accepted <- .collection_provider_fixture("kobo", "import-accepted.json")
  completed <- .collection_provider_fixture("kobo", "import-completed.json")
  deployed <- .collection_provider_fixture("kobo", "deploy-response.json")

  accepted_check <- .collection_provider_env$kobo_api_validate_import_response(accepted, "accepted")
  completed_check <- .collection_provider_env$kobo_api_validate_import_response(completed, "completed")
  deploy_check <- .collection_provider_env$kobo_api_validate_deploy_response(deployed, "aCreatedSurvey")

  expect_true(accepted_check$ok)
  expect_equal(accepted_check$asset_uid, "")
  expect_true(completed_check$ok)
  expect_equal(completed_check$asset_uid, "aCreatedSurvey")
  expect_true(deploy_check$ok)
  expect_true(deploy_check$active)

  expect_false(.collection_provider_env$kobo_api_validate_import_response(list(status = "complete"), "completed")$ok)
  expect_false(.collection_provider_env$kobo_api_validate_deploy_response(list(uid = "otro", active = TRUE), "aCreatedSurvey")$ok)
})

test_that("Kobo request shapes de import/deploy quedan observables sin red", {
  accepted <- .collection_provider_fixture("kobo", "import-accepted.json")
  deployed <- .collection_provider_fixture("kobo", "deploy-response.json")
  requests <- list()
  .collection_provider_mock(".kobo_api_request_json", function(url, token, method = "GET", form = NULL, json_body = NULL, fail = TRUE) {
    requests[[length(requests) + 1L]] <<- list(url = url, method = method, form = form, fail = fail)
    payload <- if (grepl("/deployment/", url, fixed = TRUE)) deployed else accepted
    list(ok = TRUE, status_code = 200L, body = "{}", parsed = payload, url = url)
  })
  path <- tempfile(fileext = ".xlsx")
  file.create(path)
  on.exit(unlink(path), add = TRUE)

  .collection_provider_env$kobo_api_import_xlsform(
    path,
    "fixture-token",
    base_url = "https://kf.example.test",
    destination = "aDestination",
    library = FALSE
  )
  .collection_provider_env$kobo_api_deploy_asset(
    "aCreatedSurvey",
    "fixture-token",
    base_url = "https://kf.example.test",
    version_id = "v1"
  )

  expect_equal(vapply(requests, `[[`, character(1), "method"), c("POST", "POST"))
  expect_equal(requests[[1]]$form$library, "false")
  expect_equal(requests[[1]]$form$destination, "aDestination")
  expect_equal(requests[[2]]$form, list(active = "true", version_id = "v1"))
})

test_that("SurveyMonkey pagina recipients sin el tope historico y pide campos usados", {
  pages <- list(
    .collection_provider_fixture("surveymonkey", "recipients-page-1.json"),
    .collection_provider_fixture("surveymonkey", "recipients-page-2.json")
  )
  calls <- list()
  .collection_provider_mock(".sm_api_fetch_json", function(path, token, base_url, query, allow_status = integer()) {
    calls[[length(calls) + 1L]] <<- list(path = path, query = query)
    list(ok = TRUE, status_code = 200L, data = pages[[length(calls)]], body = "{}")
  })

  out <- .collection_provider_env$sm_api_fetch_collector_recipients(
    "collector-sms",
    "fixture-token",
    per_page = 2L
  )

  expect_length(calls, 2L)
  expect_equal(out$total, 3L)
  expect_equal(out$scanned, 3L)
  expect_false(out$truncated)
  expect_match(calls[[1]]$query$fields, "survey_link", fixed = TRUE)
  expect_match(calls[[1]]$query$fields, "custom_fields", fixed = TRUE)
  expect_match(calls[[1]]$query$fields, "phone_number", fixed = TRUE)
})

test_that("SurveyMonkey no infiere personalized_link_count desde total", {
  page_one <- .collection_provider_fixture("surveymonkey", "recipients-page-1.json")
  page_two <- .collection_provider_fixture("surveymonkey", "recipients-page-2.json")
  complete <- page_one
  complete$per_page <- 100L
  complete$data <- c(page_one$data, page_two$data)
  .collection_provider_mock(".sm_api_fetch_json", function(path, token, base_url, query, allow_status = integer()) {
    list(ok = TRUE, status_code = 200L, data = complete, body = "{}")
  })

  summary <- .collection_provider_env$sm_api_collector_recipient_summary(
    "collector-sms",
    "fixture-token"
  )

  expect_equal(summary$total, 3L)
  expect_equal(summary$personalized_link_count, 1L)
  expect_equal(summary$personalized_link_count_evidence, "observed")
  expect_true(summary$personalized_link_count_complete)
})

test_that("SurveyMonkey normaliza custom_fields objeto y par key/value", {
  page <- .collection_provider_fixture("surveymonkey", "recipients-page-1.json")
  row_one <- .collection_provider_env$.sm_api_recipient_row(page$data[[1]])
  row_two <- .collection_provider_env$.sm_api_recipient_row(page$data[[2]])

  expect_equal(row_one$recipient_phone, "+51900000001")
  expect_equal(row_one$recipient_cv_actor, "docente")
  expect_equal(row_one$recipient_cv_codigo, "D-001")
  expect_equal(row_two$recipient_cv_unidad, "U-02")
  expect_null(row_two$recipient_cv_key)
})

test_that("SurveyMonkey prioriza tipo SMS y no convierte Web Link en presencial_qr", {
  sms <- .collection_provider_env$sm_api_normalize_collector(
    list(id = "sms-1", type = "sms", url = "https://es.surveymonkey.com/r/native"),
    recipient_summary = list(total = 300L)
  )
  web <- .collection_provider_env$sm_api_normalize_collector(
    list(id = "web-1", type = "weblink", url = "https://es.surveymonkey.com/r/shared"),
    recipient_summary = list(total = 0L)
  )
  unknown_with_recipients <- .collection_provider_env$sm_api_normalize_collector(
    list(id = "unknown-1"),
    recipient_summary = list(total = 20L)
  )

  expect_equal(sms$operational_use, "sms")
  expect_equal(web$operational_use, "enlace_abierto")
  expect_false(identical(web$operational_use, "presencial_qr"))
  expect_equal(unknown_with_recipients$operational_use, "sin_clasificar")
})

test_that("SurveyMonkey solicita status y url al listar collectors", {
  observed_query <- NULL
  .collection_provider_mock(".sm_api_fetch_json", function(path, token, base_url, query, allow_status = integer()) {
    observed_query <<- query
    list(ok = TRUE, status_code = 200L, data = list(total = 1L, data = list(list(id = "collector-1"))), body = "{}")
  })

  out <- .collection_provider_env$sm_api_fetch_collectors("survey-1", "fixture-token")

  expect_equal(out$total, 1L)
  expect_match(observed_query$fields, "status", fixed = TRUE)
  expect_match(observed_query$fields, "url", fixed = TRUE)
  expect_match(observed_query$fields, "response_count", fixed = TRUE)
})
