if (!exists(".sm_mb_campaign_suggestions", mode = "function")) {
  setup_path <- "setup-load-all.R"
  if (!file.exists(setup_path)) {
    setup_path <- file.path("api", "tests", "testthat", "setup-load-all.R")
  }
  source(setup_path)
}

test_that("refresh suggestions use generic name proximity and fuzzy tokens", {
  base <- list(
    source_kind = "surveymonkey_api",
    survey_id = "111",
    source_alias = "Ingeniería Civil",
    source_title = "Acreditación Ingeniería Civil - Encuesta Egresados"
  )
  spec <- .sm_mb_spec_from_base("ingenieria_civil", base)$spec
  catalog <- list(
    list(
      id = "222",
      title = "Acreditación Ingeniería Civil - Encuesta a Egresados",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 18L
    ),
    list(
      id = "333",
      title = "Acreditacion Ingenieria Civil - Encuesta Agresados",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 5L
    ),
    list(
      id = "444",
      title = "Acreditación Derecho - Encuesta a Egresados",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 25L
    ),
    list(
      id = "555",
      title = "Acreditación Ingeniería Ambiental - Encuesta a Egresados",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 25L
    )
  )

  suggestions <- .sm_mb_campaign_suggestions("ingenieria_civil", base, spec, catalog, used_ids = "111")

  expect_equal(vapply(suggestions, `[[`, character(1), "survey_id"), c("222", "333"))
  expect_true(isTRUE(suggestions[[1]]$preselected))
  expect_match(suggestions[[1]]$reason, "Proximidad de nombre")
  expect_match(suggestions[[2]]$reason, "egresados~agresados")
})

test_that("confirmed refresh campaigns persist as sources for future refreshes", {
  base <- list(
    source_kind = "surveymonkey_api",
    survey_id = "111",
    source_alias = "Ingeniería Civil",
    source_title = "Acreditación Ingeniería Civil - Encuesta Egresados"
  )
  spec <- .sm_mb_spec_from_base("ingenieria_civil", base)$spec
  campaign <- list(
    survey_id = "222",
    label = "Ingeniería Civil correo",
    source_alias = "Ingeniería Civil correo",
    source_title = "Acreditación Ingeniería Civil - Encuesta a Egresados",
    response_statuses = list("completed"),
    keep_missing_status = FALSE,
    channel = "Correo"
  )

  merged <- .sm_mb_spec_with_campaigns(spec, list(campaign))
  merged_again <- .sm_mb_spec_with_campaigns(merged, list(campaign))

  expect_equal(.sm_mb_source_ids(merged), c("111", "222"))
  expect_equal(.sm_mb_source_ids(merged_again), c("111", "222"))
  expect_equal(merged$sources[[2]]$source_channel, "Correo")

  catalog <- list(
    list(
      id = "222",
      title = "Acreditación Ingeniería Civil - Encuesta a Egresados",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 18L
    )
  )
  suggestions <- .sm_mb_campaign_suggestions("ingenieria_civil", base, merged, catalog, used_ids = .sm_mb_source_ids(merged))

  expect_length(suggestions, 0)
})

test_that("refresh structure blocks only when there is new data or confirmed campaigns", {
  blocked_structure <- list(ok = FALSE, n_blocking = 4L)
  clean_structure <- list(ok = TRUE, n_blocking = 0L)

  expect_equal(
    .sm_mb_refresh_action(list(new_rows = 0L), blocked_structure, accepted = list()),
    "noop_structure_warning"
  )
  expect_true(.sm_mb_refresh_action_updateable("noop_structure_warning"))

  expect_equal(
    .sm_mb_refresh_action(list(new_rows = 2L), blocked_structure, accepted = list()),
    "blocked"
  )
  expect_false(.sm_mb_refresh_action_updateable("blocked"))

  expect_equal(
    .sm_mb_refresh_action(list(new_rows = 0L), blocked_structure, accepted = list(list(survey_id = "222"))),
    "blocked"
  )

  expect_equal(
    .sm_mb_refresh_action(list(new_rows = 0L), clean_structure, accepted = list()),
    "noop"
  )
  expect_equal(
    .sm_mb_refresh_action(list(new_rows = 1L), clean_structure, accepted = list()),
    "update"
  )
})

test_that("admin metadata missing in an additional source is not structural blocking", {
  make_tbl <- function(headings) {
    data.frame(
      pos = seq_along(headings),
      family = rep("open_ended", length(headings)),
      subtype = rep("single", length(headings)),
      required = rep(FALSE, length(headings)),
      validation = rep("", length(headings)),
      n_rows = rep(0L, length(headings)),
      n_cols = rep(0L, length(headings)),
      n_choices = rep(0L, length(headings)),
      choice_signature = rep("", length(headings)),
      row_signature = rep("", length(headings)),
      heading = headings,
      heading_norm = .sm_mb_norm(headings),
      stringsAsFactors = FALSE
    )
  }
  substantive <- paste("Pregunta", seq_len(35))
  admin <- c("Código Pulso", "Carrera del egresado:", "Celular del egresado", "Enumerador")
  ref <- make_tbl(c(substantive, admin))
  cur <- make_tbl(substantive)

  blocked <- .sm_mb_compare_to_ref(ref, cur)
  expect_equal(vapply(blocked, `[[`, character(1), "severity"), rep("blocking", 4))

  source_spec <- list()
  excluded_positions <- .sm_mb_excluded_positions_from_source(source_spec, ref)
  diffs <- .sm_mb_compare_to_ref(ref, cur, ignorable_missing_positions = excluded_positions)

  expect_equal(excluded_positions, 36:39)
  expect_equal(vapply(diffs, `[[`, character(1), "severity"), rep("review", 4))
  expect_equal(vapply(diffs, `[[`, character(1), "kind"), rep("metadata_optional", 4))
  expect_equal(vapply(diffs, `[[`, character(1), "variable"), paste0("p", 36:39))
  expect_equal(.sm_mb_refresh_action(list(new_rows = 2L), list(ok = TRUE, n_blocking = 0L, n_review = 4L), accepted = list()), "update")
})

test_that("effective SurveyMonkey rows require completed status and affirmative consent", {
  inst <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p1", "text"),
      name = c("p1", "p2"),
      label = c("Hecha esta aclaración, ¿desea continuar con la encuesta?", "Correo")
    ),
    choices = tibble::tibble(
      list_name = c("lst_p1", "lst_p1"),
      name = c("1", "2"),
      label = c("Sí.", "No.")
    )
  )
  df <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    response_status = c("completed", "completed"),
    p1 = c("1", "2"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(df, "sm_response_filter") <- list(original_rows = 2L, kept_rows = 2L, excluded_rows = 0L)

  filtered <- .sm_mb_filter_effective_consent_df(df, inst, attr(df, "sm_response_filter", exact = TRUE))
  filter_info <- attr(filtered, "sm_response_filter", exact = TRUE)

  expect_equal(.sm_mb_consent_var(inst), "p1")
  expect_equal(filtered$case_uid, "111:r1")
  expect_equal(filter_info$consent_var, "p1")
  expect_equal(filter_info$consent_excluded_rows, 1L)
  expect_equal(filter_info$kept_rows, 1L)
})

test_that("configured consent variable overrides automatic consent detection", {
  inst <- list(
    survey = tibble::tibble(
      type = c("select_one yesno", "text", "select_one yesno"),
      name = c("p1", "p2", "p5"),
      label = c("Hecha esta aclaración, ¿desea continuar con la encuesta?", "Correo", "Confirmación operativa")
    ),
    choices = tibble::tibble(
      list_name = c("yesno", "yesno"),
      name = c("1", "2"),
      label = c("Sí.", "No.")
    )
  )
  df <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    response_status = c("completed", "completed"),
    p1 = c("2", "2"),
    p5 = c("1", "2"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  filtered <- .sm_mb_filter_effective_consent_df(df, inst, list(original_rows = 2L), consent_var = "p5")
  filter_info <- attr(filtered, "sm_response_filter", exact = TRUE)

  expect_equal(.sm_mb_consent_var(inst, configured = "p5"), "p5")
  expect_equal(filtered$case_uid, "111:r1")
  expect_equal(filter_info$consent_var, "p5")
})

test_that("consent candidates do not treat generic participation as consent", {
  variables <- list(
    list(name = "p1", label = "Hecha esta aclaración, ¿desea continuar con la encuesta?", type = "select_one"),
    list(name = "p34", label = "¿En qué actividades de vinculación le gustaría participar con la carrera?", type = "select_multiple")
  )

  expect_equal(.estudio_consent_candidates(variables), "p1")
})

test_that("incremental response refs also exclude completed rows without consent", {
  inst <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p1", "text"),
      name = c("p1", "p2"),
      label = c("Hecha esta aclaración, ¿desea continuar con la encuesta?", "Correo")
    ),
    choices = tibble::tibble(
      list_name = c("lst_p1", "lst_p1"),
      name = c("1", "2"),
      label = c("Sí.", "No.")
    )
  )
  details <- list(
    pages = list(list(
      questions = list(list(
        id = "q1",
        family = "single_choice",
        subtype = "vertical",
        headings = list(list(heading = "Hecha esta aclaración, ¿desea continuar con la encuesta?")),
        answers = list(
          choices = list(
            list(id = "c1", text = "Sí.", position = 1L),
            list(id = "c2", text = "No.", position = 2L)
          )
        )
      ))
    ))
  )
  response <- function(id, choice_id) {
    list(
      id = id,
      response_status = "completed",
      pages = list(list(questions = list(list(
        id = "q1",
        answers = list(list(choice_id = choice_id))
      ))))
    )
  }

  filtered <- .sm_mb_filter_raw_responses_by_consent(
    list(response("r1", "c1"), response("r2", "c2")),
    details,
    inst
  )

  expect_equal(vapply(filtered$responses, `[[`, character(1), "id"), "r1")
  expect_equal(filtered$filter$consent_excluded_rows, 1L)
  expect_equal(filtered$filter$kept_consent_counts[["1"]], 1L)
})

test_that("refresh suggestions are not tied to a specific actor label", {
  base <- list(
    source_kind = "surveymonkey_api",
    survey_id = "111",
    source_alias = "Administración Docentes",
    source_title = "Acreditación Administración - Encuesta Docentes"
  )
  spec <- .sm_mb_spec_from_base("administracion_docentes", base)$spec
  catalog <- list(
    list(
      id = "222",
      title = "Acreditación Administración - Encuesta Docentes segunda ola",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 18L
    ),
    list(
      id = "333",
      title = "Acreditación Economía - Encuesta Docentes segunda ola",
      nickname = "",
      date_modified = "2026-06-09T00:00:00Z",
      response_count = 5L
    )
  )

  suggestions <- .sm_mb_campaign_suggestions("administracion_docentes", base, spec, catalog, used_ids = "111")

  expect_equal(vapply(suggestions, `[[`, character(1), "survey_id"), "222")
  expect_true(isTRUE(suggestions[[1]]$preselected))
})

test_that("legacy SurveyMonkey response_filter reconstructs multi-source specs", {
  base <- list(
    source_kind = "surveymonkey_api_multi_source",
    survey_id = "111",
    source_alias = "Ingeniería Geológica",
    source_title = "Acreditación Ingeniería Geológica - Encuesta Egresados",
    response_filter = list(
      kind = "surveymonkey_multi_source_response_filter",
      sources = list(
        list(
          kind = "surveymonkey_response_filter",
          survey_id = "111",
          source_title = "Ingeniería Geológica",
          kept_status_counts = list(completed = 24L),
          collection_strategy = "campo",
          source_channel = "Telefónico"
        ),
        list(
          kind = "surveymonkey_response_filter",
          survey_id = "222",
          source_title = "Ingeniería Geológica campaña 2",
          kept_status_counts = list(completed = 3L, partial = 1L),
          collection_strategy = "whatsapp_link",
          canal = "WhatsApp"
        )
      )
    )
  )

  info <- .sm_mb_spec_from_base("ingenieria_geologica", base)

  expect_true(info$ok)
  expect_equal(.sm_mb_source_ids(info$spec), c("111", "222"))
  expect_equal(info$spec$sources[[2]]$response_statuses, c("completed", "partial"))
  expect_equal(info$spec$sources[[2]]$collection_strategy, "whatsapp_link")
  expect_equal(info$spec$sources[[1]]$source_channel, "Telefónico")
  expect_equal(info$spec$sources[[2]]$source_channel, "WhatsApp")
})

test_that("legacy SurveyMonkey response_filter reconstructs consent variable", {
  base <- list(
    source_kind = "surveymonkey_api",
    survey_id = "111",
    source_alias = "Ingeniería Civil",
    source_title = "Acreditación Ingeniería Civil - Encuesta Egresados",
    response_filter = list(
      kind = "surveymonkey_response_filter",
      survey_id = "111",
      consent_var = "p1",
      kept_status_counts = list(completed = 24L)
    )
  )

  info <- .sm_mb_spec_from_base("ingenieria_civil", base)

  expect_true(info$ok)
  expect_equal(info$spec$consent_var, "p1")
  expect_equal(info$spec$sources[[1]]$consent_var, "p1")
})

test_that("incremental merge appends new case_uid and leaves existing rows untouched", {
  inst <- list(
    survey = tibble::tibble(type = "text", name = "p1", label = "Pregunta"),
    choices = tibble::tibble()
  )
  local <- data.frame(
    case_uid = "111:r1",
    survey_id = "111",
    response_id = "r1",
    date_modified = "2026-06-08T00:00:00Z",
    p1 = "valor local",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  remote <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    survey_id = c("111", "111"),
    response_id = c("r1", "r2"),
    date_modified = c("2026-06-09T00:00:00Z", "2026-06-09T00:00:00Z"),
    p1 = c("valor editado remoto", "valor nuevo"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  merged <- .sm_mb_merge_new_rows(local, remote, inst)

  expect_equal(merged$n_new, 1L)
  expect_equal(nrow(merged$data), 2L)
  expect_equal(merged$data$p1[merged$data$case_uid == "111:r1"], "valor local")
  expect_equal(merged$data$p1[merged$data$case_uid == "111:r2"], "valor nuevo")
})
