make_sm_mb_details <- function(company_labels = c("Empresa A", "Empresa B"),
                               seal_heading = "Conoce el sello?",
                               survey_title = "Sello Mujer Chile") {
  list(
    title = survey_title,
    pages = list(
      list(position = 1L, questions = list(
        list(
          id = "q1",
          family = "single_choice",
          subtype = "vertical",
          headings = list(list(heading = "Sexo")),
          answers = list(choices = list(
            list(id = "yes", position = 1L, text = "Si"),
            list(id = "no", position = 2L, text = "No")
          ))
        ),
        list(
          id = "q2",
          family = "single_choice",
          subtype = "menu",
          headings = list(list(heading = "Empresa")),
          answers = list(choices = Map(
            function(label, pos) list(id = paste0("comp", pos), position = pos, text = label),
            company_labels,
            seq_along(company_labels)
          ))
        ),
        list(
          id = "q3",
          family = "matrix",
          subtype = "rating",
          headings = list(list(heading = seal_heading)),
          answers = list(
            rows = list(
              list(id = "r1", position = 1L, text = "Calidad"),
              list(id = "r2", position = 2L, text = "Seguridad")
            ),
            choices = list(
              list(id = "sc1", position = 1L, text = "Bajo"),
              list(id = "sc2", position = 2L, text = "Alto")
            )
          )
        ),
        list(
          id = "q4",
          family = "multiple_choice",
          subtype = "vertical",
          headings = list(list(heading = "Areas de uso")),
          answers = list(choices = list(
            list(id = "m1", position = 1L, text = "Docencia"),
            list(id = "m2", position = 2L, text = "IA")
          ))
        )
      ))
    )
  )
}

make_sm_mb_inst <- function() {
  list(
    survey = tibble::tibble(
      type = c(
        "select_one yesno",
        "select_one empresas",
        "select_one scale",
        "select_one scale",
        "select_multiple areas"
      ),
      name = c("p1", "p2", "p3_1", "p3_2", "p4"),
      label = c("Sexo", "Empresa", "Calidad", "Seguridad", "Areas de uso"),
      relevant = c("", "", "", "", ""),
      constraint = c("", "", "", "", "")
    ),
    choices = tibble::tibble(
      list_name = c("yesno", "yesno", "empresas", "empresas", "scale", "scale", "areas", "areas"),
      name = c("1", "2", "1", "2", "low", "high", "doc", "ia"),
      label = c("Si", "No", "Empresa A", "Empresa B", "Bajo", "Alto", "Docencia", "IA")
    )
  )
}

test_that("comparador multibase trata empresa distinta como variante de categorias", {
  ref_tbl <- .sm_mb_question_table(make_sm_mb_details(company_labels = c("Empresa A", "Empresa B")))
  cur_tbl <- .sm_mb_question_table(make_sm_mb_details(
    company_labels = c("Empresa C", "Empresa D", "Empresa E"),
    seal_heading = "Conoce la certificacion local?"
  ))

  company_positions <- .sm_mb_detect_company_positions(list(ref_tbl, cur_tbl))
  diffs <- .sm_mb_compare_to_ref(ref_tbl, cur_tbl, company_positions = company_positions)

  expect_equal(company_positions, 2L)
  expect_true(any(vapply(diffs, function(x) identical(x$kind, "options_variant"), logical(1))))
  expect_true(any(vapply(diffs, function(x) identical(x$kind, "wording"), logical(1))))
  expect_false(any(vapply(diffs, function(x) identical(x$severity, "blocking"), logical(1))))
})

test_that("categorias distintas en SurveyMonkey se vuelven variante resoluble", {
  ref_tbl <- .sm_mb_question_table(make_sm_mb_details())
  cur <- make_sm_mb_details()
  cur$pages[[1]]$questions[[4]]$answers$choices[[3]] <- list(
    id = "m3",
    position = 3L,
    text = "RRHH"
  )
  cur_tbl <- .sm_mb_question_table(cur)

  diffs <- .sm_mb_compare_to_ref(ref_tbl, cur_tbl, company_positions = 2L)
  option_diff <- Filter(function(x) identical(x$kind, "options_variant"), diffs)

  expect_length(option_diff, 1L)
  expect_equal(option_diff[[1]]$pos, 4L)
  expect_equal(option_diff[[1]]$severity, "review")
})

test_that("fraseo SurveyMonkey se expande a nombres reales del XLSForm", {
  inst <- make_sm_mb_inst()
  inst$survey <- rbind(
    tibble::tibble(
      type = "note",
      name = "nota_p3",
      label = "Conoce el sello?",
      relevant = "",
      constraint = ""
    ),
    inst$survey
  )
  cur <- make_sm_mb_details(seal_heading = "Conoce la certificacion local?")
  cur$pages[[1]]$questions[[3]]$answers$rows[[1]]$text <- "Calidad de la certificacion"
  raw <- list(
    pos = 3L,
    variable = "p3",
    kind = "wording",
    severity = "review",
    ref = "Conoce el sello?",
    current = "Conoce la certificacion local?",
    survey_id = "cur"
  )

  expanded <- .sm_mb_expand_wording_diff(
    raw,
    ref_details = make_sm_mb_details(),
    cur_details = cur,
    canonical_inst = inst
  )
  vars <- vapply(expanded, `[[`, character(1), "variable")

  expect_true("nota_p3" %in% vars)
  expect_true("p3_1" %in% vars)
  expect_false("p3_2" %in% vars)
})

test_that("empresa usada en logica bloquea conversion automatica a texto", {
  inst <- make_sm_mb_inst()
  inst$survey$relevant[4] <- "${p2} = '1'"

  expect_true(.sm_mb_expr_references_var(inst, "p2"))
  expect_false(.sm_mb_expr_references_var(inst, "p1"))
  logic <- .sm_mb_company_logic(inst, "p2")
  expect_equal(logic$blocked, "p2")
})

test_that("empresa solo activa campo otro y no bloquea integracion", {
  inst <- make_sm_mb_inst()
  inst$survey <- rbind(
    inst$survey,
    tibble::tibble(
      type = "text",
      name = "p2_other",
      label = "Otro (especifique):",
      relevant = "${p2} = '2'",
      constraint = ""
    )
  )

  logic <- .sm_mb_company_logic(inst, "p2")
  expect_length(logic$blocked, 0)
  expect_equal(names(logic$soft), "p2")
  expect_equal(logic$soft$p2$name, "p2_other")
})

test_that("conversor API produce columnas canonicas, metadata y empresa especial", {
  details <- make_sm_mb_details()
  responses <- list(
    list(
      id = "1001",
      collector_id = "collector-a",
      response_status = "completed",
      collection_mode = "default",
      date_created = "2026-05-27T10:00:00+00:00",
      date_modified = "2026-05-27T10:05:00+00:00",
      pages = list(list(questions = list(
        list(id = "q1", answers = list(list(choice_id = "yes"))),
        list(id = "q2", answers = list(list(choice_id = "comp1"))),
        list(id = "q3", answers = list(
          list(row_id = "r1", choice_id = "sc2"),
          list(row_id = "r2", choice_id = "sc1")
        )),
        list(id = "q4", answers = list(
          list(choice_id = "m1"),
          list(choice_id = "m2")
        ))
      )))
    )
  )

  out <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = responses,
    inst = make_sm_mb_inst(),
    survey_id = "survey-a",
    pais = "Chile",
    source_title = "Sello Mujer Chile",
    company_vars = "p2"
  )

  expect_equal(nrow(out), 1L)
  expect_equal(out$respondent_id, "1001")
  expect_equal(out$response_id, "1001")
  expect_equal(out$case_uid, "survey-a:1001")
  expect_equal(out$pais, "Chile")
  expect_equal(out$p1, "1")
  expect_equal(out$p2, "Empresa A")
  expect_equal(out$empresa_source_code, "1")
  expect_equal(out$empresa_source_label, "Empresa A")
  expect_equal(out$empresa_uid, "Chile:empresa_a")
  expect_equal(out$p3_1, "high")
  expect_equal(out$p3_2, "low")
  expect_equal(out$p4, "doc ia")
})

test_that("conversor API excluye respuestas parciales de SurveyMonkey", {
  details <- make_sm_mb_details()
  responses <- list(
    list(
      id = "1001",
      response_status = "completed",
      pages = list(list(questions = list(
        list(id = "q1", answers = list(list(choice_id = "yes")))
      )))
    ),
    list(
      id = "1002",
      response_status = "partial",
      pages = list(list(questions = list(
        list(id = "q1", answers = list(list(choice_id = "no")))
      )))
    )
  )

  out <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = responses,
    inst = make_sm_mb_inst(),
    survey_id = "survey-a",
    pais = "Chile",
    source_title = "Sello Mujer Chile"
  )

  filter <- attr(out, "sm_response_filter", exact = TRUE)
  expect_equal(nrow(out), 1L)
  expect_equal(out$response_id, "1001")
  expect_equal(out$p1, "1")
  expect_equal(filter$original_rows, 2L)
  expect_equal(filter$kept_rows, 1L)
  expect_equal(filter$excluded_rows, 1L)
})

test_that("conversor API escribe categorias variantes en la columna con sufijo", {
  details <- make_sm_mb_details()
  details$pages[[1]]$questions[[4]]$answers$choices[[3]] <- list(
    id = "m3",
    position = 3L,
    text = "RRHH"
  )
  inst <- make_sm_mb_inst()
  inst$survey <- rbind(
    inst$survey,
    tibble::tibble(
      type = "select_multiple areas_peru",
      name = "p4_peru",
      label = "Areas de uso - Peru",
      relevant = "",
      constraint = ""
    )
  )
  inst$choices <- rbind(
    inst$choices,
    tibble::tibble(
      list_name = c("areas_peru", "areas_peru", "areas_peru"),
      name = c("doc", "ia", "rrhh"),
      label = c("Docencia", "IA", "RRHH")
    )
  )
  responses <- list(
    list(
      id = "1003",
      response_status = "completed",
      pages = list(list(questions = list(
        list(id = "q4", answers = list(
          list(choice_id = "m2"),
          list(choice_id = "m3")
        ))
      )))
    )
  )

  out <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = responses,
    inst = inst,
    survey_id = "survey-b",
    pais = "Peru",
    source_title = "Sello Mujer Peru",
    variant_map = list(list(from = "p4", to = "p4_peru", pos = 4L))
  )

  expect_true("p4_peru" %in% names(out))
  expect_true(is.na(out$p4))
  expect_equal(out$p4_peru, "ia rrhh")
})

test_that("conversor API marca opcion sintetica Other cuando SurveyMonkey envia solo texto", {
  details <- make_sm_mb_details()
  details$pages[[1]]$questions[[4]]$answers$other <- list(
    is_answer_choice = TRUE,
    text = "Other (especificar)"
  )
  inst <- make_sm_mb_inst()
  inst$survey <- rbind(
    inst$survey,
    tibble::tibble(
      type = "text",
      name = "p4_other",
      label = "Other (especificar)",
      relevant = "selected(${p4}, 'other')",
      constraint = ""
    )
  )
  inst$choices <- rbind(
    inst$choices,
    tibble::tibble(
      list_name = "areas",
      name = "other",
      label = "Other (especificar)"
    )
  )
  responses <- list(
    list(
      id = "1004",
      response_status = "completed",
      pages = list(list(questions = list(
        list(id = "q4", answers = list(
          list(text = "Claude")
        ))
      )))
    )
  )

  out <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = responses,
    inst = inst,
    survey_id = "survey-b",
    pais = "Peru",
    source_title = "Sello Mujer Peru"
  )

  expect_equal(out$p4, "other")
  expect_equal(out$p4_other, "Claude")
})

test_that("conversor API marca Other numerico en select_one cuando SurveyMonkey envia texto", {
  details <- make_sm_mb_details()
  details$pages[[1]]$questions[[1]]$answers$other <- list(
    is_answer_choice = TRUE,
    text = "Otros"
  )
  inst <- make_sm_mb_inst()
  inst$survey <- rbind(
    inst$survey,
    tibble::tibble(
      type = "text",
      name = "p1_other",
      label = "Otros",
      relevant = "selected(${p1}, '8')",
      constraint = ""
    )
  )
  inst$choices <- rbind(
    inst$choices,
    tibble::tibble(
      list_name = "yesno",
      name = "8",
      label = "Otros"
    )
  )
  responses <- list(
    list(
      id = "1005",
      response_status = "completed",
      pages = list(list(questions = list(
        list(id = "q1", answers = list(
          list(text = "Prefiere no decir")
        ))
      )))
    )
  )

  out <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = responses,
    inst = inst,
    survey_id = "survey-b",
    pais = "Peru",
    source_title = "Sello Mujer Peru"
  )

  expect_equal(out$p1, "8")
  expect_equal(out$p1_other, "Prefiere no decir")
})

test_that("metadata de recojo WhatsApp infiere perfil y variables administrativas", {
  specs <- .sm_mb_normalize_survey_specs(list(list(
    survey_id = "422505144",
    collection_strategy = "WhatsApp"
  )))
  source <- specs[[1]]$sources[[1]]
  expect_equal(source$collection_strategy, "whatsapp_link")
  expect_equal(source$validation_exclusion_profile, "admin_autoadministrado")

  inst <- list(
    survey = tibble::tibble(
      type = c("text", "select_one carrera", "text", "select_one enum", "text"),
      name = c("p36", "p37", "p38", "p39", "p40"),
      label = c("Código Pulso", "Carrera del egresado:", "Celular del egresado", "Enumerador", "Opinion")
    ),
    choices = tibble::tibble()
  )
  expect_equal(
    .sm_mb_excluded_validation_vars(source, source$validation_exclusion_profile, inst),
    c("p36", "p37", "p38", "p39")
  )
})

test_that("armado de instrumento copia variante SurveyMonkey con sus categorias", {
  details <- make_sm_mb_details()
  details$pages[[1]]$questions[[4]]$answers$choices[[3]] <- list(
    id = "m3",
    position = 3L,
    text = "RRHH"
  )
  xls <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  model <- .mi_xlsform_model_from_frames(xls$survey, xls$choices, xls$settings)
  copied <- .mi_copy_variant_rows(
    model,
    list(variable = "p4"),
    new_name = "p4_peru",
    new_label = "Areas de uso - Peru"
  )

  expect_equal(copied$survey$name, "p4_peru")
  expect_true(grepl("^select_multiple\\s+p4_peru_list$", copied$survey$type))
  expect_true(all(c("1", "2", "3") %in% as.character(copied$choices$name)))
  expect_true("RRHH" %in% as.character(copied$choices[["label::es"]]))
})

test_that("armado de instrumento copia campo otro de variantes SurveyMonkey", {
  details <- make_sm_mb_details()
  details$pages[[1]]$questions[[4]]$answers$other <- list(
    is_answer_choice = TRUE,
    text = "Otro"
  )
  xls <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  model <- .mi_xlsform_model_from_frames(xls$survey, xls$choices, xls$settings)
  copied <- .mi_copy_variant_rows(
    model,
    list(variable = "p4"),
    new_name = "p4_peru",
    new_label = "Areas de uso - Peru"
  )

  expect_true(all(c("p4_peru", "p4_peru_other") %in% as.character(copied$survey$name)))
  other <- copied$survey[as.character(copied$survey$name) == "p4_peru_other", , drop = FALSE]
  expect_true(grepl("\\$\\{p4_peru\\}", as.character(other$relevant), fixed = FALSE))
})

test_that("conversor API tolera preguntas abiertas sin filas ni opciones", {
  details <- make_sm_mb_details()
  details$pages[[1]]$questions[[5]] <- list(
    id = "q5",
    family = "open_ended",
    subtype = "single",
    headings = list(list(heading = "Comentario")),
    answers = list()
  )
  inst <- make_sm_mb_inst()
  inst$survey <- rbind(
    inst$survey,
    tibble::tibble(
      type = "text",
      name = "p5",
      label = "Comentario",
      relevant = "",
      constraint = ""
    )
  )
  responses <- list(
    list(
      id = "1002",
      pages = list(list(questions = list(
        list(id = "q5", answers = list(list(text = "Respuesta abierta")))
      )))
    )
  )

  expect_identical(.sm_mb_norm(character(0)), character(0))
  out <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = responses,
    inst = inst,
    survey_id = "survey-a",
    pais = "Chile",
    source_title = "Sello Mujer Chile"
  )

  expect_equal(nrow(out), 1L)
  expect_equal(out$p5, "Respuesta abierta")
})
