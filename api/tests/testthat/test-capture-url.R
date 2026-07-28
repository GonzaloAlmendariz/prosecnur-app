test_that("la landing administrativa de Kobo no es una URL de captura", {
  expect_equal(
    capture_url_issue("https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing"),
    "landing_kobo"
  )
  expect_false(capture_url_ok("https://kobo.unhcr.org/#/forms/asset_unhcr/landing"))
  expect_match(capture_url_message("landing_kobo"), "formulario web", fixed = TRUE)
})

test_that("cualquier fragmento invalida la URL de captura", {
  expect_equal(capture_url_issue("https://ee.kobotoolbox.org/x/abc123#seccion"), "fragmento")
  expect_match(capture_url_message("fragmento"), "'#'", fixed = TRUE)
})

test_that("acepta formularios web reales de Kobo y SurveyMonkey", {
  expect_true(capture_url_ok("https://ee.kobotoolbox.org/x/abc123"))
  expect_true(capture_url_ok("https://ee.kobotoolbox.org/single/abc123"))
  expect_true(capture_url_ok("https://kf.kobotoolbox.org/x/aXbYcZ?d[collectorID]=AULA-001"))
  expect_true(capture_url_ok("https://www.surveymonkey.com/r/ABCDEF?aula=AULA-001"))
})

test_that("rechaza vacío y esquemas no http", {
  expect_equal(capture_url_issue(""), "vacia")
  expect_equal(capture_url_issue(NULL), "vacia")
  expect_equal(capture_url_issue(NA), "vacia")
  expect_equal(capture_url_issue("kf.kobotoolbox.org/x/abc"), "no_http")
  expect_equal(capture_url_issue("javascript:alert(1)"), "no_http")
})

test_that("capture_url_require falla con E_CAPTURE_URL y deja pasar lo válido", {
  err <- tryCatch(
    capture_url_require("https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing", context = "AULA-001"),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_CAPTURE_URL")
  expect_equal(err$status, 400)
  expect_equal(err$details$issue, "landing_kobo")
  expect_match(conditionMessage(err), "^AULA-001: ")

  expect_true(capture_url_require("https://ee.kobotoolbox.org/x/abc123"))
})

test_that("kobo_api_survey_url no cae en la landing cuando no hay formulario", {
  expect_equal(
    kobo_api_survey_url("aXbYcZ", base_url = "https://kf.kobotoolbox.org"),
    ""
  )
  expect_equal(
    kobo_api_survey_url(
      "aXbYcZ",
      base_url = "https://kf.kobotoolbox.org",
      detail = list(url = "https://kf.kobotoolbox.org/api/v2/assets/aXbYcZ/")
    ),
    ""
  )
})

test_that("kobo_api_survey_url descarta candidatas con fragmento y elige el web form", {
  url <- kobo_api_survey_url(
    "aXbYcZ",
    base_url = "https://kf.kobotoolbox.org",
    detail = list(landing = "https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing"),
    deployment = list(enketo_url = "https://ee.kobotoolbox.org/x/abc123")
  )
  expect_equal(url, "https://ee.kobotoolbox.org/x/abc123")

  solo_landing <- kobo_api_survey_url(
    "aXbYcZ",
    base_url = "https://kf.kobotoolbox.org",
    detail = list(single_url = "https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing")
  )
  expect_equal(solo_landing, "")
})

test_that("guardar la agenda de aulas rechaza un enlace que no captura", {
  plan <- list(list(
    classroom_id = "AULA-001",
    course_name = "Metodos",
    operational_status = "agendada"
  ))

  err <- tryCatch(
    monitoreo_aulas_update_agenda(
      plan,
      list(list(classroom_id = "AULA-001", link = "https://kf.kobotoolbox.org/#/forms/aXbYcZ/landing"))
    ),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_CAPTURE_URL")
  expect_match(conditionMessage(err), "AULA-001", fixed = TRUE)
})

test_that("guardar la agenda de aulas acepta un web form y permite limpiar el enlace", {
  plan <- list(list(
    classroom_id = "AULA-001",
    course_name = "Metodos",
    operational_status = "agendada"
  ))

  ok <- monitoreo_aulas_update_agenda(
    plan,
    list(list(classroom_id = "AULA-001", link = "https://ee.kobotoolbox.org/x/abc123?d[collectorID]=AULA-001"))
  )
  saved <- if (is.data.frame(ok)) ok$link[[1]] else ok[[1]]$link
  expect_equal(saved, "https://ee.kobotoolbox.org/x/abc123?d[collectorID]=AULA-001")

  limpio <- monitoreo_aulas_update_agenda(
    ok,
    list(list(classroom_id = "AULA-001", link = ""))
  )
  vacio <- if (is.data.frame(limpio)) limpio$link[[1]] else limpio[[1]]$link
  expect_equal(vacio, "")
})
