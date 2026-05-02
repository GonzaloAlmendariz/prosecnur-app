# Tests del cliente API de SurveyMonkey (Vía 3 del plan).
# Foco: parser del response /surveys/{id}/details — extracción de páginas y
# resumen. La función sm_api_fetch_survey_details() requiere token real y se
# prueba aparte cuando esté disponible.

test_that("sm_api_extract_paginas mapea páginas con pad correcto del .sav", {
  details <- list(
    pages = list(
      list(position = 1L, questions = list(
        list(family = "single_choice", id = "111"),
        list(family = "open_ended", id = "112")
      )),
      list(position = 2L, questions = list(
        list(family = "presentation", id = "113"),  # debe ignorarse
        list(family = "matrix", id = "114"),
        list(family = "multiple_choice", id = "115")
      )),
      list(position = 3L, questions = list(
        list(family = "demographic", id = "116")
      ))
    )
  )

  # Con pad=4 (estilo q-prefix de Ing. Civil)
  paginas <- sm_api_extract_paginas(details, style = list(prefix = "q", pad = 4L))
  expect_equal(names(paginas), c("1", "2", "3"))
  expect_equal(paginas[["1"]], c("Q0001", "Q0002"))
  expect_equal(paginas[["2"]], c("Q0003", "Q0004"))  # presentation se saltó
  expect_equal(paginas[["3"]], c("Q0005"))
})

test_that("sm_api_extract_paginas con pad=0 produce Q1, Q2 (estilo AMDT)", {
  details <- list(
    pages = list(
      list(position = 1L, questions = list(
        list(family = "single_choice"),
        list(family = "single_choice")
      )),
      list(position = 2L, questions = list(
        list(family = "matrix")
      ))
    )
  )
  paginas <- sm_api_extract_paginas(details, style = list(prefix = "p", pad = 0L))
  expect_equal(paginas[["1"]], c("Q1", "Q2"))
  expect_equal(paginas[["2"]], c("Q3"))
})

test_that("sm_api_extract_paginas tolera response vacío", {
  expect_equal(sm_api_extract_paginas(list(), style = NULL), list())
  expect_equal(sm_api_extract_paginas(list(pages = list()), style = NULL), list())
})

test_that("sm_api_summary cuenta preguntas excluyendo presentation y reporta required/validation", {
  details <- list(
    title = "Mi encuesta",
    language = "es",
    pages = list(
      list(questions = list(
        list(family = "single_choice", required = list(type = "all", text = "Required")),
        list(family = "open_ended"),
        list(family = "presentation")  # ignorar
      )),
      list(questions = list(
        list(
          family = "open_ended", subtype = "numerical",
          validation = list(type = "integer", min = 0L, max = 120L, text = "Edad inválida")
        )
      ))
    )
  )
  s <- sm_api_summary(details)
  expect_equal(s$title, "Mi encuesta")
  expect_equal(s$language, "es")
  expect_equal(s$n_paginas, 2L)
  expect_equal(s$n_preguntas, 3L)  # excluye 1 presentation
  expect_equal(s$n_required, 1L)
  expect_equal(s$n_validation, 1L)
})

test_that("sm_api_extract_choice_labels trae labels por posición de pregunta", {
  details <- list(
    pages = list(
      list(position = 1L, questions = list(
        list(
          family = "single_choice",
          answers = list(choices = list(
            list(position = 1L, text = "Universidad de Buenos Aires"),
            list(position = 2L, text = "Universidad Nacional de Córdoba")
          ))
        ),
        list(family = "presentation"),
        list(
          family = "multiple_choice",
          answers = list(choices = list(
            list(position = 1L, text = "Docencia"),
            list(position = 2L, text = "Investigación")
          ))
        )
      ))
    )
  )

  out <- sm_api_extract_choice_labels(details, style = list(prefix = "q", pad = 4L))
  expect_equal(out$q_ref, c("Q0001", "Q0001", "Q0002", "Q0002"))
  expect_equal(out$choice_label, c(
    "Universidad de Buenos Aires",
    "Universidad Nacional de Córdoba",
    "Docencia",
    "Investigación"
  ))
})

test_that("sm_api_enrich_xlsform_choices reemplaza labels sin tocar códigos", {
  details <- list(
    pages = list(
      list(position = 1L, questions = list(
        list(
          family = "single_choice",
          answers = list(choices = list(
            list(position = 1L, text = "Universidad de Buenos Aires"),
            list(position = 2L, text = "Universidad de Buenos Aires - sede 2")
          ))
        )
      ))
    )
  )
  sm <- list(
    vars_tbl = tibble::tibble(name_raw = "q0001")
  )
  xlsform <- list(
    choices = tibble::tibble(
      list_name = c("lst_uba", "lst_uba"),
      name = c("uba", "uba_2"),
      `label::es` = c("uba", "uba_2")
    ),
    diagnostico = tibble::tibble(
      group_guess = "q0001",
      list_name_final = "lst_uba"
    )
  )

  out <- sm_api_enrich_xlsform_choices(
    xlsform,
    details,
    sm,
    style = list(prefix = "q", pad = 4L)
  )
  expect_equal(out$choices$name, c("uba", "uba_2"))
  expect_equal(out$choices$`label::es`, c(
    "Universidad de Buenos Aires",
    "Universidad de Buenos Aires - sede 2"
  ))
  expect_equal(out$api_enrichment$choices_relabelled_lists, 1L)
})

test_that("sm_api_enrich_xlsform_choices salta listas con distinto largo", {
  details <- list(
    pages = list(
      list(questions = list(
        list(
          family = "single_choice",
          answers = list(choices = list(
            list(position = 1L, text = "A"),
            list(position = 2L, text = "B")
          ))
        )
      ))
    )
  )
  sm <- list(vars_tbl = tibble::tibble(name_raw = "p1"))
  xlsform <- list(
    choices = tibble::tibble(
      list_name = "lst_p1",
      name = "a",
      `label::es` = "a"
    ),
    diagnostico = tibble::tibble(
      group_guess = "p1",
      list_name_final = "lst_p1"
    )
  )

  out <- sm_api_enrich_xlsform_choices(xlsform, details, sm, style = list(prefix = "p", pad = 0L))
  expect_equal(out$choices$`label::es`, "a")
  expect_equal(out$api_enrichment$choices_relabelled_lists, 0L)
  expect_equal(out$api_enrichment$choices_skipped_mismatch, 1L)
})

test_that("sm_api_enrich_xlsform_structure usa API como fuente de verdad para preguntas abiertas", {
  details <- list(
    pages = list(
      list(questions = list(
        list(
          family = "open_ended",
          subtype = "single",
          headings = list(list(heading = "Edad:")),
          required = list(type = "all"),
          validation = list(type = "integer", min = "18", max = "100")
        ),
        list(
          family = "open_ended",
          subtype = "single",
          headings = list(list(heading = "Correo:")),
          required = list(type = "all"),
          validation = list(type = "email")
        )
      ))
    )
  )
  sm <- list(vars_tbl = tibble::tibble(name_raw = c("q0001", "q0002")))
  xlsform <- list(
    survey = tibble::tibble(
      type = c("select_one lst_q0001", "select_one lst_q0002"),
      name = c("q0001", "q0002"),
      `label::es` = c("18", "a@b.com"),
      required = c(NA_character_, NA_character_),
      relevant = c(NA_character_, NA_character_),
      constraint = c(NA_character_, NA_character_)
    ),
    choices = tibble::tibble(
      list_name = c("lst_q0001", "lst_q0002"),
      name = c("x18", "a_b_com"),
      `label::es` = c("18", "a@b.com")
    ),
    diagnostico = tibble::tibble()
  )

  out <- sm_api_enrich_xlsform_structure(
    xlsform,
    details,
    sm,
    style = list(prefix = "q", pad = 4L)
  )

  expect_equal(out$survey$type, c("integer", "text"))
  expect_equal(out$survey$`label::es`, c("Edad:", "Correo:"))
  expect_equal(out$survey$required, c("yes", "yes"))
  expect_match(out$survey$constraint[1], ">= 18")
  expect_match(out$survey$constraint[2], "regex")
  expect_equal(nrow(out$choices), 0L)
})

test_that("sm_api_xlsform deja matrices como select_one sueltos dentro de la página", {
  details <- list(
    title = "Encuesta matriz",
    pages = list(
      list(position = 8L, title = "Objetivos educacionales", questions = list(
        list(
          family = "matrix",
          subtype = "rating",
          headings = list(list(heading = "¿Cuán útil considera los siguientes OE?")),
          answers = list(
            rows = list(
              list(text = "Diseña y construye infraestructura"),
              list(text = "Analiza el impacto ambiental")
            ),
            choices = list(
              list(position = 1L, text = "Nada útil"),
              list(position = 2L, text = "Muy útil")
            )
          )
        )
      ))
    )
  )

  out <- sm_api_xlsform(details, style = list(prefix = "q", pad = 4L), lang = "es")
  survey <- out$survey

  expect_equal(
    survey$type,
    c(
      "begin_group",
      "note",
      "select_one lst_q0001",
      "select_one lst_q0001",
      "end_group"
    )
  )
  expect_false(any(survey$name == "grp_q0001", na.rm = TRUE))
  expect_equal(survey$name[2:4], c("nota_q0001", "q0001_1", "q0001_2"))
  expect_equal(survey$section[2:4], rep("section_pag_8", 3))
  expect_equal(survey$`label::es`[2], "¿Cuán útil considera los siguientes OE?")
  expect_equal(survey$`label::es`[3:4], c("Diseña y construye infraestructura", "Analiza el impacto ambiental"))
})

test_that("sm_api_fetch_survey_details valida los inputs antes de llamar HTTP", {
  expect_error(sm_api_fetch_survey_details("", "tok123"), regexp = "survey_id")
  expect_error(sm_api_fetch_survey_details("123", ""), regexp = "token")
})
