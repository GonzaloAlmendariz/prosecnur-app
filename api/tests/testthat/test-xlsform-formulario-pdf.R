source("setup-load-all.R")

test_that("formulario_pdf_build_model creates paper skips and matrices", {
  survey <- data.frame(
    type = c(
      "select_one yesno",
      "text",
      "select_one yesno",
      "select_one yesno",
      "select_one yesno",
      "text"
    ),
    name = c("p1", "p2", "p3_a", "p3_b", "p3_c", "p4"),
    label = c(
      "Acepta participar?",
      "Motivo de no respuesta",
      "Vacunacion",
      "Emergencias",
      "Salud mental",
      "Nombre"
    ),
    relevant = c("", "${p1} = '1'", "", "", "", ""),
    paper_group = c("", "", "servicios", "servicios", "servicios", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno"),
    name = c("1", "2"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE
  )
  settings <- data.frame(form_title = "Encuesta de prueba", form_id = "test")

  model <- formulario_pdf_build_model(survey, choices, settings)
  question_p1 <- Filter(function(block) identical(block$name, "p1"), model$blocks)[[1]]
  no_choice <- Filter(function(choice) identical(choice$code, "2"), question_p1$options)[[1]]
  matrix <- Filter(function(block) identical(block$kind, "matrix"), model$blocks)[[1]]

  expect_match(no_choice$paper_skip, "IR A LA PREGUNTA")
  expect_equal(length(matrix$items), 3L)
  expect_equal(model$summary$n_matrices, 1L)
})

test_that("manual paper_skip has priority over inferred skip", {
  survey <- data.frame(
    type = c("select_one yesno", "text", "text"),
    name = c("p1", "p2", "p3"),
    label = c("Filtro", "Detalle", "Final"),
    relevant = c("", "${p1} = '1'", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno"),
    name = c("1", "2"),
    label = c("Si", "No"),
    paper_skip = c("", "TERMINAR CUESTIONARIO"),
    stringsAsFactors = FALSE
  )

  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "Test"))
  question_p1 <- Filter(function(block) identical(block$name, "p1"), model$blocks)[[1]]
  no_choice <- Filter(function(choice) identical(choice$code, "2"), question_p1$options)[[1]]

  expect_identical(no_choice$paper_skip, "TERMINAR CUESTIONARIO")
})

test_that("paper model skips metadata rows and collapses long catalogs", {
  survey <- data.frame(
    type = c("start", "end", "calculate", "select_one pais"),
    name = c("start", "end", "today_calc", "p1_pais"),
    label = c("", "", "", "1. Pais de nacimiento"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("pais", 25),
    name = sprintf("C%02d", 1:25),
    label = sprintf("Pais %02d", 1:25),
    stringsAsFactors = FALSE
  )

  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "Test"))
  question <- Filter(function(block) identical(block$name, "p1_pais"), model$blocks)[[1]]

  expect_identical(question$number, "1")
  expect_identical(question$label, "Pais de nacimiento")
  expect_true(isTRUE(question$coded_list))
  expect_length(question$options, 0L)
  expect_match(paste(model$warnings, collapse = " "), "campo codificado")
})

test_that("complex relevant generates a warning and PDF renders", {
  survey <- data.frame(
    type = c("select_one yesno", "text"),
    name = c("p1", "p2"),
    label = c("Filtro", "Detalle"),
    relevant = c("", "${p1} = '1' and ${otro} = '1'"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno"),
    name = c("1", "2"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE
  )
  tmp <- tempfile(fileext = ".pdf")

  result <- reporte_formulario_pdf(
    survey,
    choices,
    settings = data.frame(form_title = "Encuesta PDF"),
    output_file = tmp
  )

  expect_true(file.exists(tmp))
  expect_gt(file.info(tmp)$size, 1000)
  expect_gte(qpdf::pdf_length(tmp), 1)
  expect_match(paste(result$warnings, collapse = " "), "relevant complejo")

  pdftotext <- Sys.which("pdftotext")
  if (nzchar(pdftotext)) {
    txt <- system2(pdftotext, c(tmp, "-"), stdout = TRUE)
    expect_true(any(grepl("PULSO", txt)))
    expect_true(any(grepl("Encuesta PDF", txt, ignore.case = TRUE)))
  }
})

test_that("OPS sample XLSForm can render as a Pulso paper PDF", {
  path <- test_path("../../inst/samples/ops_salud/instrumento.xlsx")
  skip_if_not(file.exists(path))

  survey <- readxl::read_excel(path, sheet = "survey", col_types = "text")
  choices <- readxl::read_excel(path, sheet = "choices", col_types = "text")
  settings <- data.frame(
    form_title = "Elaboracion de diagnostico de barreras de acceso y factores facilitadores",
    form_id = "ops_salud"
  )
  paper <- data.frame(
    id = "intro",
    kind = "intro",
    position = "1",
    title = "INSTRUCCIONES PARA ENCUESTADORES",
    body = "Antes de iniciar, lea la presentacion y registre las respuestas siguiendo los saltos impresos.",
    layout = "intro",
    stringsAsFactors = FALSE
  )
  tmp <- tempfile(fileext = ".pdf")

  result <- suppressWarnings(reporte_formulario_pdf(
    survey,
    choices,
    settings = settings,
    paper = paper,
    output_file = tmp
  ))

  expect_true(file.exists(tmp))
  expect_gt(file.info(tmp)$size, 5000)
  expect_gte(qpdf::pdf_length(tmp), 1)
  expect_gt(result$summary$n_questions, 50)
})
