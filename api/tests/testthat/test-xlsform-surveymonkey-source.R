# Trazabilidad SurveyMonkey -> XLSForm.
# La previsualizacion fija una definicion remota y el import solo puede operar
# sobre esa misma huella/perfil; ningun test usa red ni credenciales.

sm_definition_fixture <- function(label = "Distrito") {
  list(
    title = "Encuesta docentes",
    language = "es",
    pages = list(list(
      position = 1L,
      title = "Datos generales",
      questions = list(list(
        id = "101",
        family = "single_choice",
        headings = list(list(heading = label)),
        answers = list(choices = list(
          list(id = "1", position = 1L, text = "Norte"),
          list(id = "2", position = 2L, text = "Sur")
        ))
      ))
    ))
  )
}

test_that("preview sella el XLSForm base y el perfil de traduccion", {
  profile <- "surveymonkey_api_xlsform/v1"
  definition <- .xlsform_editor_sm_definition(
    sm_definition_fixture(),
    survey_id = "sm-123",
    translation_profile = profile
  )

  expect_named(
    definition,
    c(
      "schema", "sha256", "fetched_at", "survey_id", "question_count",
      "hash_scope", "translation_profile"
    ),
    ignore.order = FALSE
  )
  expect_match(definition$schema, "^surveymonkey_definition/v[0-9]+$")
  expect_match(definition$sha256, "^[0-9a-f]{64}$")
  expect_match(definition$fetched_at, "^[0-9]{4}-[0-9]{2}-[0-9]{2}T")
  expect_equal(definition$survey_id, "sm-123")
  expect_equal(definition$question_count, 1L)
  expect_true(nzchar(definition$hash_scope))
  expect_equal(definition$translation_profile, profile)

  same <- .xlsform_editor_sm_definition(
    sm_definition_fixture(),
    survey_id = "sm-123",
    translation_profile = profile
  )
  changed_content <- .xlsform_editor_sm_definition(
    sm_definition_fixture("Provincia"),
    survey_id = "sm-123",
    translation_profile = profile
  )
  changed_profile <- .xlsform_editor_sm_definition(
    sm_definition_fixture(),
    survey_id = "sm-123",
    translation_profile = "surveymonkey_api_xlsform/v2"
  )

  expect_identical(same$sha256, definition$sha256)
  expect_false(identical(changed_content$sha256, definition$sha256))
  expect_false(identical(changed_profile$sha256, definition$sha256))
})

test_that("la huella ignora metadata remota que no modifica el XLSForm", {
  profile <- "surveymonkey_api_xlsform/v1"
  original <- sm_definition_fixture()
  with_volatile_metadata <- original
  with_volatile_metadata$href <- "https://api.surveymonkey.com/v3/surveys/sm-123"
  with_volatile_metadata$date_modified <- "2026-07-21T23:40:00Z"
  with_volatile_metadata$pages[[1]]$href <- "https://api.surveymonkey.com/v3/pages/1"
  with_volatile_metadata$pages[[1]]$questions[[1]]$href <-
    "https://api.surveymonkey.com/v3/questions/101"

  baseline <- .xlsform_editor_sm_definition(
    original,
    survey_id = "sm-123",
    translation_profile = profile
  )
  observed_later <- .xlsform_editor_sm_definition(
    with_volatile_metadata,
    survey_id = "sm-123",
    translation_profile = profile
  )

  expect_identical(observed_later$sha256, baseline$sha256)
})

test_that("import rechaza hash o perfil stale antes de traducir", {
  definition <- .xlsform_editor_sm_definition(
    sm_definition_fixture(),
    survey_id = "sm-123",
    translation_profile = "surveymonkey_api_xlsform/v1"
  )

  expect_silent(.xlsform_editor_sm_assert_definition(
    definition,
    expected_sha256 = definition$sha256,
    expected_profile = definition$translation_profile
  ))

  stale_hash <- tryCatch(
    .xlsform_editor_sm_assert_definition(
      definition,
      expected_sha256 = paste(rep("f", 64L), collapse = ""),
      expected_profile = definition$translation_profile
    ),
    api_error = function(e) e
  )
  expect_s3_class(stale_hash, "api_error")
  expect_equal(stale_hash$status, 409)
  expect_equal(stale_hash$code, "E_SM_DEFINITION_STALE")

  stale_profile <- tryCatch(
    .xlsform_editor_sm_assert_definition(
      definition,
      expected_sha256 = definition$sha256,
      expected_profile = "surveymonkey_api_xlsform/v0"
    ),
    api_error = function(e) e
  )
  expect_s3_class(stale_profile, "api_error")
  expect_equal(stale_profile$status, 409)
  expect_equal(stale_profile$code, "E_SM_TRANSLATION_PROFILE_STALE")
})

test_that("source SurveyMonkey conserva huellas y elimina secretos", {
  definition <- .xlsform_editor_sm_definition(
    sm_definition_fixture(),
    survey_id = "sm-123",
    translation_profile = "surveymonkey_api_xlsform/v1"
  )
  payload <- .xlsform_editor_workbook_payload(
    sheets = list(
      survey = data.frame(type = "text", name = "p1", label = "Distrito"),
      choices = data.frame(),
      settings = data.frame()
    ),
    source_kind = "surveymonkey",
    source_name = "Encuesta docentes",
    source_meta = list(
      schema = "survey_source/v1",
      survey_id = definition$survey_id,
      definition_sha256 = definition$sha256,
      definition_fetched_at = definition$fetched_at,
      definition_hash_scope = definition$hash_scope,
      translation_profile = definition$translation_profile,
      question_count = definition$question_count,
      remote_payload_sha256_observed = paste(rep("b", 64L), collapse = ""),
      provenance = list(provider = "surveymonkey_api", endpoint = "details", token = "no-persistir"),
      access_token = "no-persistir"
    )
  )

  expect_equal(payload$source$definition_sha256, definition$sha256)
  expect_equal(payload$source$definition_hash_scope, definition$hash_scope)
  expect_equal(payload$source$translation_profile, definition$translation_profile)
  expect_equal(payload$source$provenance$provider, "surveymonkey_api")
  expect_null(payload$source$provenance$token)
  expect_null(payload$source$access_token)
})

test_that("la lógica aplicada deja una huella reproducible sin guardar contenido sensible", {
  first <- .xlsform_editor_sm_logic_provenance(
    rules_text = "Q1 = C1 => Ocultar P2",
    paginas = list(`1` = c("Q1", "Q2")),
    paginas_labels = list(`1` = "Datos"),
    choice_order_overrides = list(`1` = c("Sí", "No")),
    choice_code_maps = list(list(variable = "p1", mappings = list(
      list(source_code = "C1", xls_code = "1")
    )))
  )
  same <- .xlsform_editor_sm_logic_provenance(
    rules_text = "Q1 = C1 => Ocultar P2",
    paginas = list(`1` = c("Q1", "Q2")),
    paginas_labels = list(`1` = "Datos"),
    choice_order_overrides = list(`1` = c("Sí", "No")),
    choice_code_maps = list(list(variable = "p1", mappings = list(
      list(source_code = "C1", xls_code = "1")
    )))
  )
  changed <- .xlsform_editor_sm_logic_provenance(
    rules_text = "Q1 = C2 => Ocultar P2",
    paginas = list(`1` = c("Q1", "Q2")),
    paginas_labels = list(`1` = "Datos"),
    choice_order_overrides = list(`1` = c("Sí", "No")),
    choice_code_maps = list()
  )

  expect_named(first, c(
    "schema", "method", "input_sha256", "rules_sha256", "maps_sha256",
    "rules_count", "applied_at"
  ))
  expect_match(first$input_sha256, "^[0-9a-f]{64}$")
  expect_identical(same$input_sha256, first$input_sha256)
  expect_false(identical(changed$input_sha256, first$input_sha256))
  expect_equal(first$rules_count, 1L)
  expect_false(any(grepl("Ocultar P2|C1", unlist(first), fixed = TRUE)))
})
