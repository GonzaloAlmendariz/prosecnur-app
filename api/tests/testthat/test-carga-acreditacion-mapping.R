library(testthat)

test_that("acreditacion aplica el mapping sellado por fuente sin promover el person-code", {
  data <- data.frame(
    `.source_id` = c("source-canonical", "source-custom"),
    q0003 = c("40", "PERSON-0001"),
    q0004 = c(NA_character_, "52"),
    q0010__servicio_salud = c("Si", NA_character_),
    q0011__servicio_salud = c(NA_character_, "No"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(data, "monitoreo_source_variable_labels") <- list(
    `source-canonical` = c(q0003 = "Edad"),
    `source-custom` = c(
      q0003 = "Codigo de persona",
      q0004 = "Edad"
    )
  )
  instrumento <- list(
    survey = data.frame(
      type = c("integer", "select_one si_no"),
      name = c("p3", "p10_1"),
      list_name = c(NA_character_, "si_no"),
      label = c("Edad", "Servicio de salud"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("si_no", "si_no"),
      name = c("Si", "No"),
      label = c("Si", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  content_sha256 <- paste(rep("a", 64L), collapse = "")
  definition_sha256 <- paste(rep("b", 64L), collapse = "")
  revision <- list(
    schema = "instrument_revision/v1",
    revision_id = "revision-egresados",
    content_sha256 = content_sha256,
    source = list(
      schema = "acreditacion_actor_instrument_draft/v1",
      kind = "surveymonkey",
      survey_id = "survey-canonical",
      logic_status = "confirmed",
      logic_confirmed_at = "2026-07-21T12:00:00Z",
      logic_confirmation_method = "editor_manual_review",
      logic_review = list(content_sha256 = content_sha256),
      variants = list(list(
        survey_id = "survey-custom",
        definition_sha256 = definition_sha256,
        review_status = "confirmed",
        variant_map_draft = list(
          list(from = "p4", to = "p3"),
          list(from = "p11", to = "p10")
        ),
        person_code_resolution = list(
          source_question_name = "p3",
          role = "monitoring_trace_only",
          analysis_included = FALSE
        ),
        logic_confirmed_at = "2026-07-21T12:00:00Z",
        logic_confirmation_method = "editor_manual_review",
        logic_review = list(
          content_sha256 = content_sha256,
          definition_sha256 = definition_sha256
        )
      ))
    )
  )
  monitoreo_sources <- list(
    list(id = "source-canonical", survey_id = "survey-canonical"),
    list(id = "source-custom", survey_id = "survey-custom")
  )

  result <- .acreditacion_mapping_apply(
    data = data,
    instrumento = instrumento,
    revision = revision,
    monitoreo_sources = monitoreo_sources
  )

  expect_equal(result$data$p3, c("40", "52"))
  expect_equal(result$data$p10_1, c("Si", "No"))
  expect_false("PERSON-0001" %in% result$data$p3)
  expect_true(validate_data_xlsform_compatibility(result$data, instrumento)$ok)
  expect_true(length(result$audit) > 0L)
  expect_match(result$fingerprint, "^[0-9a-f]{64}$")
})
