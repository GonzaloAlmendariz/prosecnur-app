# Switch de exportacion del editor XLSForm: por defecto el .xlsx sale limpio
# (sin la capa `paper_*` de la plataforma); con el flag activo se conserva.

test_that(".xlsform_editor_app_only_cols detecta el namespace paper_*", {
  cols <- c("type", "name", "label", "relevant", "paper_number",
            "paper_label", "paper_skip", "choice_filter", "Paper_Group")
  flag <- .xlsform_editor_app_only_cols(cols)
  expect_equal(cols[flag],
               c("paper_number", "paper_label", "paper_skip", "Paper_Group"))
  # columnas estandar XLSForm NUNCA se marcan
  expect_false(any(flag[cols %in% c("type", "name", "label", "relevant", "choice_filter")]))
})

test_that(".xlsform_editor_strip_app_columns quita solo las columnas de plataforma", {
  survey <- data.frame(
    type = "select_one si_no", name = "p1", label = "Consentimiento",
    relevant = "", constraint = "", paper_number = "1",
    paper_label = "Etiqueta papel", paper_skip = "pase a 8",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  clean <- .xlsform_editor_strip_app_columns(survey)
  expect_equal(names(clean), c("type", "name", "label", "relevant", "constraint"))
  expect_equal(nrow(clean), 1L)
  expect_equal(clean$name, "p1")

  # choices: solo paper_skip es de plataforma; filter_* (choice_filter ODK) se conserva
  choices <- data.frame(
    list_name = "actores", name = "88", label = "Otro",
    filter_p14 = "1", paper_skip = "pase",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  clean_ch <- .xlsform_editor_strip_app_columns(choices)
  expect_true("filter_p14" %in% names(clean_ch))
  expect_false("paper_skip" %in% names(clean_ch))
})

test_that(".xlsform_editor_strip_app_columns es idempotente y tolera df sin columnas paper", {
  df <- data.frame(type = "note", name = "n1", label = "hola",
                   stringsAsFactors = FALSE, check.names = FALSE)
  expect_identical(.xlsform_editor_strip_app_columns(df), df)
  expect_null(.xlsform_editor_strip_app_columns(NULL))
})

test_that("reimport same-session conserva source saneado y resetea sellos", {
  definition_sha256 <- paste(rep("a", 64L), collapse = "")
  meta <- list(
    kind = "xlsform",
    original_name = "docentes_editado.xlsx",
    source = list(
      schema = "survey_source/v1",
      kind = "surveymonkey",
      original_name = "Docentes",
      survey_id = "sm-123",
      definition_sha256 = definition_sha256,
      definition_hash_scope = "xlsform_base+translation_profile",
      translation_profile = "surveymonkey_api_xlsform/v1",
      provenance = list(provider = "surveymonkey_api", token = "no-persistir"),
      logic_status = "confirmed",
      logic_confirmed_at = "2026-07-20T12:00:00Z",
      logic_confirmation_method = "editor_manual_review",
      logic_review = list(
        content_sha256 = paste(rep("c", 64L), collapse = ""),
        definition_sha256 = definition_sha256
      ),
      variants = list(list(
        survey_id = "sm-124",
        definition_sha256 = definition_sha256,
        review_status = "confirmed",
        logic_confirmed_at = "2026-07-20T12:00:00Z",
        logic_review = list(definition_sha256 = definition_sha256)
      )),
      access_token = "no-persistir"
    )
  )

  source <- .xlsform_editor_reimport_source(meta)

  expect_equal(source$kind, "surveymonkey")
  expect_equal(source$survey_id, "sm-123")
  expect_equal(source$definition_sha256, definition_sha256)
  expect_equal(source$translation_profile, "surveymonkey_api_xlsform/v1")
  expect_equal(source$provenance, list(provider = "surveymonkey_api"))
  expect_equal(source$logic_status, "pending_manual_confirmation")
  expect_null(source$logic_confirmed_at)
  expect_null(source$logic_confirmation_method)
  expect_null(source$logic_review)
  expect_equal(source$variants[[1]]$review_status, "pending_manual_confirmation")
  expect_null(source$variants[[1]]$logic_confirmed_at)
  expect_null(source$variants[[1]]$logic_review)
  expect_null(source$access_token)
})

test_that("upload XLSForm externo queda con source genérico", {
  source <- .xlsform_editor_reimport_source(list(
    kind = "xlsform",
    original_name = "instrumento_externo.xlsx"
  ))

  expect_equal(source, list(
    kind = "xlsform",
    original_name = "instrumento_externo.xlsx"
  ))
})
