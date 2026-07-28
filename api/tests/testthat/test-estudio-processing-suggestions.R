library(testthat)

test_that("processing suggestions group accreditation monitoring sources by actor", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      route_selected = TRUE
    )
  ))
  session_set(sid, "monitoreo_sources", list(
    list(
      id = "sm-conta-docentes-web",
      kind = "surveymonkey",
      label = "SurveyMonkey · Docentes · Web",
      enabled = TRUE,
      role = "respuestas",
      survey_id = "422402983",
      survey_title = "Acreditación Contabilidad PUCP - Docentes",
      dimensions = list(actor = "Docentes", canal = "Web"),
      collectors = list(list(collector_id = "111", active_response_count = 12))
    ),
    list(
      id = "sm-conta-docentes-personalizado",
      kind = "surveymonkey",
      label = "Acreditación Contabilidad PUCP - Docentes Personalizado",
      enabled = TRUE,
      role = "respuestas",
      survey_id = "422658144",
      survey_title = "Acreditación Contabilidad PUCP - Docentes Personalizado",
      dimensions = list(actor = "Docentes", canal = "Enlace personalizado (Whatsapp)"),
      collectors = list(list(collector_id = "222", active_response_count = 4))
    ),
    list(
      id = "sm-conta-egresados-web",
      kind = "surveymonkey",
      label = "SurveyMonkey · Egresados · Web",
      enabled = TRUE,
      role = "respuestas",
      survey_id = "422387259",
      survey_title = "Acreditación Contabilidad PUCP - Egresados",
      dimensions = list(actor = "Egresados", canal = "Web")
    ),
    list(
      id = "kobo-conta-estudiantes",
      kind = "kobo",
      label = "Kobo · Estudiantes",
      enabled = TRUE,
      role = "respuestas",
      asset_uid = "aAsset123",
      base_url = "https://kobo.unhcr.org",
      connection_profile_id = "kobo-acreditacion",
      dimensions = list(actor = "Estudiantes", canal = "Ficha QR")
    )
  ))

  payload <- .estudio_processing_suggestions_payload(sid)

  expect_true(payload$accreditation_declared)
  expect_true(payload$has_suggestions)
  expect_equal(payload$project_kind, "acreditacion")
  expect_equal(payload$profile_variant, "multi_actor")
  expect_equal(payload$summary$surveymonkey_groups, 2L)
  expect_equal(payload$summary$kobo_groups, 1L)

  docentes <- Filter(function(group) identical(group$actor_key, "docentes"), payload$groups)[[1]]
  expect_equal(docentes$platform, "surveymonkey")
  expect_true(docentes$importable)
  expect_equal(docentes$source_count, 2L)
  expect_equal(docentes$response_count, 16L)
  expect_equal(docentes$survey_input$label, "Docentes")
  expect_equal(length(docentes$survey_input$sources), 2L)
  expect_equal(
    vapply(docentes$survey_input$sources, `[[`, character(1), "survey_id"),
    c("422402983", "422658144")
  )
  expect_equal(docentes$survey_input$sources[[2]]$collection_strategy, "whatsapp_link")

  kobo <- Filter(function(group) identical(group$platform, "kobo"), payload$groups)[[1]]
  expect_true(kobo$importable)
  expect_equal(kobo$import_mode, "kobo_independent_sibling")
  expect_equal(kobo$kobo_input$asset_uid, "aAsset123")
  expect_equal(kobo$kobo_input$source_alias, "Estudiantes")
  expect_equal(kobo$kobo_input$base_url, "https://kobo.unhcr.org")
  expect_equal(kobo$kobo_input$connection_profile_id, "kobo-acreditacion")
})

test_that("processing suggestions stay empty outside accreditation monitoring", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(family = "territorial", variant = "campo")
  ))
  session_set(sid, "monitoreo_sources", list(
    list(
      id = "sm-territorio",
      kind = "surveymonkey",
      enabled = TRUE,
      role = "respuestas",
      survey_id = "999",
      label = "SurveyMonkey territorial"
    )
  ))

  payload <- .estudio_processing_suggestions_payload(sid)

  expect_false(payload$accreditation_declared)
  expect_false(payload$has_suggestions)
  expect_equal(length(payload$groups), 0L)
  expect_equal(payload$summary$survey_sources_count, 1L)
  expect_match(payload$warnings[[1]], "acreditación")
})

test_that("default accreditation family is not an explicit declaration", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(family = "acreditacion", variant = "multi_actor")
  ))

  payload <- .estudio_processing_suggestions_payload(sid)

  expect_false(payload$accreditation_declared)
  expect_true(is.na(payload$project_kind))
  expect_false(payload$has_suggestions)
  expect_equal(payload$groups, list())
})

test_that("accreditation source names do not bypass explicit route selection", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(family = "acreditacion", route_selected = FALSE)
  ))
  session_set(sid, "monitoreo_sources", list(
    list(
      id = "sm-acreditacion-docentes",
      kind = "surveymonkey",
      enabled = TRUE,
      role = "respuestas",
      survey_id = "123",
      label = "Acreditación · Docentes",
      survey_title = "Encuesta de acreditación para docentes",
      dimensions = list(actor = "Docentes")
    )
  ))

  payload <- .estudio_processing_suggestions_payload(sid)

  expect_false(payload$accreditation_declared)
  expect_true(is.na(payload$project_kind))
  expect_false(payload$has_suggestions)
  expect_equal(payload$groups, list())
  expect_match(payload$warnings[[1]], "seleccionada explícitamente")
})

test_that("declared accreditation without sources has no actionable suggestions", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "monitoreo_config", list(
    monitoreo_profile = list(
      family = "acreditacion",
      variant = "multi_actor",
      route_selected = TRUE
    )
  ))

  payload <- .estudio_processing_suggestions_payload(sid)

  expect_true(payload$accreditation_declared)
  expect_equal(payload$project_kind, "acreditacion")
  expect_false(payload$has_suggestions)
  expect_equal(payload$groups, list())
  expect_match(payload$message, "declarado como acreditación")
})
