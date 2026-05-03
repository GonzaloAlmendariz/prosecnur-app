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
  pages <- sm_api_extract_pages(details, style = list(prefix = "q", pad = 4L))

  expect_equal(
    survey$type,
    c(
      "begin_group",
      "note",
      "select_one lst_p1",
      "select_one lst_p1",
      "end_group"
    )
  )
  expect_false(any(survey$name == "grp_q0001", na.rm = TRUE))
  expect_equal(survey$name[2:4], c("nota_p1", "p1_1", "p1_2"))
  expect_equal(survey$section[2:4], rep("Pag1", 3))
  expect_equal(survey$`label::es`[2], "¿Cuán útil considera los siguientes OE?")
  expect_equal(survey$`label::es`[3:4], c("Diseña y construye infraestructura", "Analiza el impacto ambiental"))
  expect_equal(length(pages[[1]]$question_details[[1]]$children), 2L)
  expect_equal(
    vapply(pages[[1]]$question_details[[1]]$children, `[[`, character(1), "name"),
    c("p1_1", "p1_2")
  )
  expect_true(all(grepl("^select_one lst_p1", vapply(pages[[1]]$question_details[[1]]$children, `[[`, character(1), "type"))))
})

test_that("sm_api_xlsform trata matriz de una sola fila sin texto como pregunta de escala", {
  details <- list(
    title = "Encuesta escala",
    pages = list(
      list(position = 6L, title = "Satisfacción", questions = list(
        list(
          family = "matrix",
          subtype = "rating",
          headings = list(list(heading = "¿Cuán satisfecho se encuentra con la formación recibida?")),
          answers = list(
            rows = list(list(text = "")),
            choices = list(
              list(position = 1L, text = "Totalmente insatisfecho"),
              list(position = 2L, text = "Insatisfecho"),
              list(position = 3L, text = "Satisfecho"),
              list(position = 4L, text = "Totalmente satisfecho")
            )
          )
        )
      ))
    )
  )

  out <- sm_api_xlsform(details, style = list(prefix = "q", pad = 4L), lang = "es")
  survey <- out$survey
  pages <- sm_api_extract_pages(details, style = list(prefix = "q", pad = 4L))

  expect_equal(survey$type, c("begin_group", "select_one lst_p1", "end_group"))
  expect_equal(survey$name[2], "p1")
  expect_equal(survey$`label::es`[2], "¿Cuán satisfecho se encuentra con la formación recibida?")
  expect_false(any(grepl("Ítem|Fila", survey$`label::es`, ignore.case = TRUE), na.rm = TRUE))
  expect_equal(length(pages[[1]]$question_details[[1]]$children), 1L)
  expect_equal(pages[[1]]$question_details[[1]]$children[[1]]$name, "p1")
})

test_that("sm_api_xlsform deja preguntas abiertas por fila como hermanas de la pagina", {
  details <- list(
    title = "Encuesta abierta",
    pages = list(
      list(position = 13L, title = "Experiencia", questions = list(
        list(
          family = "open_ended",
          subtype = "multi",
          headings = list(list(heading = "¿Cuál es su función principal?")),
          answers = list(rows = list(
            list(text = "Función 1:"),
            list(text = "Función 2:")
          ))
        )
      ))
    )
  )

  out <- sm_api_xlsform(details, style = list(prefix = "q", pad = 4L), lang = "es")
  survey <- out$survey

  expect_equal(
    survey$type,
    c("begin_group", "text", "text", "end_group")
  )
  expect_false(any(grepl("^grp_", survey$name %||% ""), na.rm = TRUE))
  expect_equal(survey$name[2:3], c("p1_1", "p1_2"))
  expect_equal(survey$section[2:3], rep("Pag1", 2))
  expect_equal(survey$`label::es`[2:3], c("Función 1:", "Función 2:"))
})

test_that("sm_api_xlsform crea campo other para select_one", {
  details <- list(
    title = "Encuesta other",
    pages = list(
      list(position = 1L, questions = list(
        list(
          family = "single_choice",
          subtype = "vertical",
          headings = list(list(heading = "¿En qué institución?")),
          answers = list(
            choices = list(
              list(position = 1L, text = "PUCP"),
              list(position = 2L, text = "UNI")
            ),
            other = list(is_answer_choice = TRUE, text = "Otra institución")
          )
        )
      ))
    )
  )

  out <- sm_api_xlsform(details, style = list(prefix = "q", pad = 4L), lang = "es")
  survey <- out$survey
  choices <- out$choices

  expect_true(all(c("p1", "p1_other") %in% survey$name))
  p1_idx <- which(survey$name == "p1")[1]
  other_idx <- which(survey$name == "p1_other")[1]
  expect_equal(survey$type[p1_idx], "select_one lst_p1")
  expect_equal(survey$type[other_idx], "text")
  expect_equal(unname(survey$relevant[other_idx]), "${p1} = '3'")
  expect_true(any(choices$list_name == "lst_p1" & choices$name == "3" & choices$`label::es` == "Otra institución"))
})

test_that("sm_api_xlsform aplica reglas con nombres p normalizados", {
  question <- function(n, choices = NULL) {
    q <- list(
      family = "single_choice",
      subtype = "vertical",
      headings = list(list(heading = paste0("Pregunta ", n)))
    )
    if (!is.null(choices)) q$answers <- list(choices = choices)
    q
  }
  choices7 <- lapply(seq_len(5), function(i) list(position = i, text = paste0("Opción ", i)))
  details <- list(
    title = "Encuesta lógica",
    pages = list(
      list(position = 1L, questions = c(
        lapply(seq_len(6), question),
        list(question(7, choices7), question(8))
      ))
    )
  )

  out <- sm_api_xlsform(details, style = list(prefix = "q", pad = 4L), lang = "es")
  out <- surveymonkey_aplicar_logica(
    out,
    "Q7 NOT IN [C4, C5] => Ocultar P8",
    out$sm_logic
  )

  expect_true(all(c("p7", "p8") %in% out$survey$name))
  rel_p8 <- out$survey$relevant[out$survey$name == "p8"][1]
  expect_match(rel_p8, "\\$\\{p7\\}")
  expect_false(any(grepl("\\$\\{q0007\\}|\\$\\{Q7\\}|\\$\\{P7\\}", rel_p8)))
  expect_false(any(grepl("\\$\\{[qQ]0*[0-9]+", out$survey$relevant %||% character(0), perl = TRUE)))
})

test_that("sm_api_fetch_survey_details valida los inputs antes de llamar HTTP", {
  expect_error(sm_api_fetch_survey_details("", "tok123"), regexp = "survey_id")
  expect_error(sm_api_fetch_survey_details("123", ""), regexp = "token")
})
