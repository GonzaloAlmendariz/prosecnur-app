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

test_that("decision policy can rescue a specific ignored case by case_uid", {
  inst <- list(
    survey = tibble::tibble(
      type = c("text", "text"),
      name = c("p1", "p2"),
      label = c("Respuesta 1", "Respuesta 2")
    ),
    choices = tibble::tibble()
  )
  df <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    survey_id = c("111", "111"),
    response_id = c("r1", "r2"),
    collector_id = c("campo", "campo"),
    response_status = c("completed", "partial"),
    p1 = c("ok", "parcial"),
    p2 = c("ok", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  policy <- .sm_mb_decision_policy_normalize(
    list(manual_include_case_uids = list("111:r2"), include_partials = FALSE),
    list(),
    inst
  )

  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  audit <- attr(decided, "sm_decision_audit", exact = TRUE)
  case_rows <- audit$cases
  rescued <- Filter(function(x) identical(x$case_uid, "111:r2"), case_rows)[[1]]

  expect_equal(decided$case_uid, c("111:r1", "111:r2"))
  expect_equal(decided$decision_class[decided$case_uid == "111:r2"], "manual_incluida")
  expect_equal(decided$decision_manual_include[decided$case_uid == "111:r2"], "1")
  expect_equal(audit$manual_included, 1L)
  expect_equal(rescued$response_id, "r2")
  expect_true(isTRUE(rescued$observed))
})

test_that("decision policy never includes test collectors from snapshot", {
  snapshot <- list(sources = list(list(
    source_title = "Ingeniería Civil",
    collectors = list(
      list(id = "campo", name = "Campo"),
      list(id = "prueba", name = "Prueba"),
      list(id = "correo", name = "Email Invitation 1")
    )
  )))

  policy <- .sm_mb_decision_policy_exclude_test_collectors(
    list(collector_ids = list("campo", "prueba", "correo")),
    snapshot
  )
  default_policy <- .sm_mb_decision_policy_exclude_test_collectors(list(), snapshot)

  expect_equal(.sm_mb_char_vector(policy$collector_ids), c("campo", "correo"))
  expect_equal(.sm_mb_char_vector(default_policy$collector_ids), c("campo", "correo"))
})

test_that("manual rescue cannot include a case from an excluded collector", {
  inst <- list(
    survey = tibble::tibble(type = "text", name = "p1", label = "Respuesta"),
    choices = tibble::tibble()
  )
  df <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    survey_id = c("111", "111"),
    response_id = c("r1", "r2"),
    collector_id = c("campo", "prueba"),
    response_status = c("completed", "partial"),
    p1 = c("ok", "parcial"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  policy <- .sm_mb_decision_policy_normalize(
    list(collector_ids = list("campo"), manual_include_case_uids = list("111:r2")),
    list(),
    inst
  )

  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  audit <- attr(decided, "sm_decision_audit", exact = TRUE)

  expect_equal(decided$case_uid, "111:r1")
  expect_equal(audit$manual_included, 0L)
})

test_that("decision audit completion counts only applicable required substantive questions", {
  inst <- list(
    survey = tibble::tibble(
      type = rep("text", 7),
      name = paste0("p", 1:7),
      label = c("Filtro", "Obligatoria", "Opcional", "Obligatoria 2", "Condicional", "Código Pulso", "Carrera del egresado:"),
      required = c("yes", "yes", "", "yes", "yes", "yes", "yes"),
      relevant = c("", "", "", "", "${p1} = 'yes'", "", "")
    ),
    choices = tibble::tibble()
  )
  df <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    survey_id = c("111", "111"),
    response_id = c("r1", "r2"),
    collector_id = c("campo", "campo"),
    response_status = c("completed", "completed"),
    p1 = c("yes", "no"),
    p2 = c("ok", "ok"),
    p3 = c("", ""),
    p4 = c("", "ok"),
    p5 = c("ok", ""),
    p6 = c("", ""),
    p7 = c("", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  policy <- .sm_mb_decision_policy_normalize(list(), list(), inst)

  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  audit <- attr(decided, "sm_decision_audit", exact = TRUE)
  rows <- stats::setNames(audit$cases, vapply(audit$cases, `[[`, character(1), "case_uid"))

  expect_equal(rows[["111:r1"]]$answer_completion_label, "3/4")
  expect_equal(rows[["111:r2"]]$answer_completion_label, "3/3")
  expect_equal(rows[["111:r1"]]$answerable_required_count, "4")
  expect_equal(rows[["111:r2"]]$answerable_required_count, "3")
})

test_that("refresh reapplies shared XLSForm logic and remaps choice codes by label", {
  write_xlsform <- function(path, model) {
    wb <- openxlsx::createWorkbook()
    for (sheet in c("survey", "choices", "settings")) {
      openxlsx::addWorksheet(wb, sheet)
      openxlsx::writeData(wb, sheet, model[[sheet]] %||% data.frame())
    }
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }

  template <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p8", "text"),
      name = c("p8", "p10"),
      label = c("Nacional o internacional", "Institucion extranjera"),
      required = c("yes", "yes"),
      relevant = c("", "${p8} != '1'")
    ),
    choices = tibble::tibble(
      list_name = c("lst_p8", "lst_p8"),
      name = c("1", "2"),
      label = c("Nacional", "Internacional")
    ),
    settings = tibble::tibble(form_title = "Plantilla")
  )
  refreshed <- list(
    survey = tibble::tibble(
      type = c("select_one lst_p8", "text"),
      name = c("p8", "p10"),
      label = c("Nacional o internacional", "Institucion extranjera"),
      required = c("yes", "yes"),
      relevant = c("", "")
    ),
    choices = tibble::tibble(
      list_name = c("lst_p8", "lst_p8"),
      name = c("nac", "int"),
      label = c("Nacional", "Internacional")
    ),
    settings = tibble::tibble(form_title = "Refrescada")
  )

  sid <- session_create()
  template_path <- tempfile(fileext = ".xlsx")
  refreshed_path <- tempfile(fileext = ".xlsx")
  write_xlsform(template_path, template)
  write_xlsform(refreshed_path, refreshed)
  template_meta <- save_upload(sid, "xlsform", "template.xlsx", readBin(template_path, "raw", n = file.info(template_path)$size))
  refreshed_meta <- save_upload(sid, "xlsform", "civil_raw.xlsx", readBin(refreshed_path, "raw", n = file.info(refreshed_path)$size))

  s <- session_get(sid)
  s$estudio <- list(
    processing_mode = "independent_siblings",
    active_base = "ingenieria_civil",
    independent_siblings = list(shared_logic = TRUE, template_base = "template"),
    bases = list(
      template = list(nombre = "template", xlsform_file_id = template_meta$file_id),
      ingenieria_civil = list(nombre = "ingenieria_civil", xlsform_file_id = refreshed_meta$file_id)
    )
  )
  .session_env[[sid]] <- s

  out <- .sm_mb_apply_shared_logic_to_model(sid, "ingenieria_civil", refreshed)
  relevant <- as.character(out$model$survey$relevant[out$model$survey$name == "p10"])

  expect_true(isTRUE(out$applied))
  expect_equal(out$template_base, "template")
  expect_equal(relevant, "${p8} != 'nac'")
})

test_that("decision audit flags near complete partials using required fraction", {
  inst <- list(
    survey = tibble::tibble(
      type = rep("text", 20),
      name = paste0("p", 1:20),
      label = paste("Pregunta", 1:20),
      required = rep("yes", 20)
    ),
    choices = tibble::tibble()
  )
  values <- as.list(stats::setNames(rep("ok", 20), paste0("p", 1:20)))
  values$p20 <- ""
  df <- as.data.frame(c(list(
    case_uid = "111:r1",
    survey_id = "111",
    response_id = "r1",
    collector_id = "campo",
    response_status = "partial"
  ), values), stringsAsFactors = FALSE, check.names = FALSE)
  policy <- .sm_mb_decision_policy_normalize(list(include_partials = FALSE), list(), inst)

  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  audit <- attr(decided, "sm_decision_audit", exact = TRUE)
  row <- audit$cases[[1]]

  expect_equal(nrow(decided), 0L)
  expect_equal(row$answer_completion_label, "19/20")
  expect_equal(row$near_complete, "1")
  expect_equal(audit$near_complete_cases, 1L)
})

test_that("duplicate audit evidence compares sensitive fields without exposing raw values", {
  inst <- list(
    survey = tibble::tibble(
      type = c("text", "text", "text"),
      name = c("p1", "p36", "p37"),
      label = c("Pregunta", "Código Pulso", "Carrera del egresado:"),
      required = c("yes", "yes", "yes")
    ),
    choices = tibble::tibble()
  )
  df <- data.frame(
    case_uid = c("111:r1", "111:r2"),
    survey_id = c("111", "111"),
    response_id = c("r1", "r2"),
    collector_id = c("campo", "campo"),
    response_status = c("completed", "completed"),
    cv_id = c("1001", "1001"),
    p1 = c("ok", "ok"),
    p36 = c("SECRETO_A", "SECRETO_B"),
    p37 = c("Civil", "Minas"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  policy <- .sm_mb_decision_policy_normalize(
    list(include_duplicates = FALSE, duplicate_key_vars = list("cv_id")),
    list(),
    inst
  )

  decided <- .sm_mb_decision_apply_df(df, inst, policy)
  audit <- attr(decided, "sm_decision_audit", exact = TRUE)
  rows <- stats::setNames(audit$cases, vapply(audit$cases, `[[`, character(1), "case_uid"))

  expect_equal(decided$case_uid, "111:r1")
  expect_equal(rows[["111:r2"]]$duplicate_code_match, "difiere")
  expect_equal(rows[["111:r2"]]$duplicate_career_match, "difiere")
  expect_match(rows[["111:r2"]]$duplicate_evidence, "Grupo de 2")
  expect_match(rows[["111:r2"]]$duplicate_evidence, "ID enlace")
  expect_false(grepl("cv_id", rows[["111:r2"]]$duplicate_evidence))
  expect_false(grepl("SECRETO_A|SECRETO_B|Civil|Minas", rows[["111:r2"]]$duplicate_evidence))
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

test_that("estudio payload summarizes SurveyMonkey sources and mixed channels", {
  meta <- list(
    nombre = "ingenieria_civil",
    source_kind = "surveymonkey_api_multi_source",
    survey_id = "111",
    source_alias = "Ingeniería Civil",
    source_title = "Acreditación Ingeniería Civil - Encuesta Egresados",
    source_channel = "Telefónico",
    n_filas = 179L,
    n_columnas = 76L,
    surveymonkey_source_spec = list(
      survey_id = "111",
      source_alias = "Ingeniería Civil",
      source_title = "Acreditación Ingeniería Civil - Encuesta Egresados",
      sources = list(
        list(
          survey_id = "111",
          source_title = "Encuesta Egresados",
          source_channel = "Telefónico",
          collector_ids = list("campo")
        ),
        list(
          survey_id = "222",
          source_title = "Encuesta a Egresados",
          collection_strategy = "email"
        )
      )
    ),
    response_filter = list(
      kind = "surveymonkey_multi_source_response_filter",
      sources = list(
        list(survey_id = "111", original_rows = 188L, kept_rows = 177L, excluded_rows = 11L),
        list(survey_id = "222", original_rows = 3L, kept_rows = 2L, excluded_rows = 1L)
      )
    ),
    surveymonkey_decision_audit = list(
      sources = list(
        list(survey_id = "111", raw_total = 188L, completed = 177L, completed_with_consent = 177L, included = 177L, excluded = 11L),
        list(survey_id = "222", raw_total = 3L, completed = 2L, completed_with_consent = 2L, included = 2L, excluded = 1L)
      )
    )
  )

  summary <- .estudio_sm_source_summary(meta)

  expect_equal(summary$source_count, 2L)
  expect_equal(summary$channel_label, "Mixto")
  expect_true(isTRUE(summary$has_phone))
  expect_true(isTRUE(summary$has_email))
  expect_true(isTRUE(summary$email_active))
  expect_equal(summary$total_raw_records, 191L)
  expect_equal(summary$total_effective_records, 179L)
  expect_equal(summary$total_included_records, 179L)
  expect_equal(summary$active_data_rows, 179L)
  expect_equal(summary$sources[[1]]$channel, "Telefónico")
  expect_equal(summary$sources[[2]]$channel, "Correo")
  expect_equal(summary$sources[[2]]$valid_records, 2L)
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
