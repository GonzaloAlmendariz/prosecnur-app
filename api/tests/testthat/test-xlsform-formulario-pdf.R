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

  expect_match(no_choice$paper_skip, "Salto a la")
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

test_that("columns option toggles single vs two column layout", {
  survey <- data.frame(
    type = c("select_one yesno", "text", "integer"),
    name = c("p1", "p2", "p3"),
    label = c("Filtro", "Detalle", "Edad"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno"),
    name = c("1", "2"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE
  )

  # Default = 2 columnas (comportamiento historico); las preguntas cortas NO son full_width.
  m_default <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"))
  expect_equal(m_default$columns, 2L)
  q_default <- Filter(function(b) identical(b$name, "p2"), m_default$blocks)[[1]]
  expect_false(isTRUE(q_default$full_width))

  # columns = 1 => todos los bloques full_width (columna unica).
  m_one <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(columns = 1))
  expect_equal(m_one$columns, 1L)
  expect_true(all(vapply(m_one$blocks, function(b) isTRUE(b$full_width), logical(1))))

  # Sanitiza valores invalidos a 2.
  m_bad <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(columns = 5))
  expect_equal(m_bad$columns, 2L)
})

test_that("matrix option partition separates scale from special anchor", {
  # Escala tipo Likert con codigo especial 9 = SIN INF.
  opts <- list(
    list(code = "1", label = "Totalmente en Desacuerdo"),
    list(code = "2", label = "En Desacuerdo"),
    list(code = "3", label = "De Acuerdo"),
    list(code = "4", label = "Totalmente de Acuerdo"),
    list(code = "9", label = "SIN INF")
  )
  part <- .form_pdf_matrix_partition_options(opts)
  expect_equal(length(part$scale), 4L)
  expect_false(is.null(part$special))
  expect_identical(part$special$code, "9")
  expect_identical(part$scale[[1]]$label, "Totalmente en Desacuerdo")
  expect_identical(part$scale[[4]]$label, "Totalmente de Acuerdo")

  # Sin opcion especial => toda la lista es escala.
  plain <- .form_pdf_matrix_partition_options(list(
    list(code = "1", label = "Si"), list(code = "2", label = "No")
  ))
  expect_null(plain$special)
  expect_equal(length(plain$scale), 2L)

  # Deteccion por etiqueta (no solo por codigo).
  expect_true(.form_pdf_option_is_special(list(code = "3", label = "No sabe / No responde")))
  expect_true(.form_pdf_option_is_special(list(code = "88", label = "No aplica")))
  expect_false(.form_pdf_option_is_special(list(code = "2", label = "En desacuerdo")))
})

test_that("localized label::es columns resolve into label and hint", {
  survey <- data.frame(
    type = c("select_one acuerdo", "select_one acuerdo", "select_one acuerdo"),
    name = c("q10_a", "q10_b", "q10_c"),
    `label::es` = c(
      "La mision y vision de la carrera estan claramente definidas",
      "La mision orienta las decisiones de la Facultad",
      "Los canales de difusion de los propositos son adecuados"
    ),
    `hint::es` = c("Marque una opcion", "", ""),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("acuerdo", 5),
    name = c("1", "2", "3", "4", "9"),
    `label::es` = c("Totalmente en Desacuerdo", "En Desacuerdo", "De Acuerdo",
                    "Totalmente de Acuerdo", "SIN INF"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  settings <- data.frame(form_title = "Docentes AMDT", default_language = "es")

  # Coalesce a nivel modelo: label/hint materializados desde label::es/hint::es.
  model <- formulario_pdf_build_model(survey, choices, settings)
  matrix <- Filter(function(b) identical(b$kind, "matrix"), model$blocks)[[1]]
  expect_match(matrix$items[[1]]$label, "claramente definidas")
  scale <- .form_pdf_matrix_partition_options(matrix$options)
  expect_identical(scale$scale[[1]]$label, "Totalmente en Desacuerdo")
  expect_identical(scale$special$label, "SIN INF")

  # Render real: el texto localizado DEBE aparecer en el PDF (no vacio).
  tmp <- tempfile(fileext = ".pdf")
  suppressWarnings(reporte_formulario_pdf(survey, choices, settings = settings, output_file = tmp))
  expect_true(file.exists(tmp))
  expect_gt(file.info(tmp)$size, 1000)

  pdftotext <- Sys.which("pdftotext")
  if (nzchar(pdftotext)) {
    txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
    expect_true(grepl("claramente definidas", txt))
    expect_true(grepl("Totalmente en Desacuerdo", txt))
    expect_true(grepl("SIN INF", txt))
  }
})

test_that("xlsform_coalesce_label prefers spanish and falls back defensively", {
  df <- data.frame(
    `label::en` = c("English one", "English two"),
    `label::es` = c("Español uno", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  out <- xlsform_coalesce_label(df, lang = "es", kind = "label")
  expect_identical(out[1], "Español uno")   # español gana sobre inglés
  expect_identical(out[2], "English two")   # coalesce a la unica no vacia

  # Columna plana `label` tiene prioridad cuando existe y esta llena.
  df2 <- data.frame(label = c("Plano", ""), `label::es` = c("Loc A", "Loc B"),
                    check.names = FALSE, stringsAsFactors = FALSE)
  out2 <- xlsform_coalesce_label(df2, lang = "es", kind = "label")
  expect_identical(out2, c("Plano", "Loc B"))
})

test_that("logic_language saltos uses 'Salto a la' wording", {
  survey <- data.frame(
    type = c("select_one yesno", "text", "text"),
    name = c("p1", "p2", "p3"),
    label = c("Filtro", "Detalle", "Final"),
    relevant = c("", "${p1} = '1'", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Si", "No"), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp, options = list(logic_language = "saltos"))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  expect_true(grepl("Salto a la", txt))
  expect_false(grepl("En caso de", txt))
})

test_that("logic_language condiciones emits openings and suppresses skips", {
  survey <- data.frame(
    type = c("select_one yesno", "text", "text"),
    name = c("p1", "p2", "p3"),
    label = c("Trabaja actualmente?", "Cuente su ocupacion", "Ingreso mensual"),
    relevant = c("", "${p1} = '1'", "${p1} = '1'"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Si", "No"), stringsAsFactors = FALSE)

  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(logic_language = "condiciones"))
  expect_identical(model$logic_language, "condiciones")
  q2 <- Filter(function(b) identical(b$name, "p2"), model$blocks)[[1]]
  q3 <- Filter(function(b) identical(b$name, "p3"), model$blocks)[[1]]
  # p2 abre la condicion; p3 (misma relevant en corrida) NO la repite.
  expect_match(q2$opening_condition, "En caso de haber respondido")
  expect_match(q2$opening_condition, "Si")
  expect_match(q2$opening_condition, "P.1")
  expect_identical(q3$opening_condition, "")

  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp, options = list(logic_language = "condiciones"))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  expect_true(grepl("En caso de", txt))
  expect_false(grepl("Salto a la", txt))
})

test_that("condiciones dedups group-inherited relevant on questions", {
  survey <- data.frame(
    type = c("select_one yesno", "begin_group", "text", "text", "end_group"),
    name = c("filtro", "grp", "hijo1", "hijo2", ""),
    label = c("Tiene hijos?", "Datos de hijos", "Nombre", "Edad", ""),
    relevant = c("", "${filtro} = '1'", "${filtro} = '1'", "${filtro} = '1'", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Si", "No"), stringsAsFactors = FALSE)
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(logic_language = "condiciones"))
  sec <- Filter(function(b) identical(b$kind, "section"), model$blocks)[[1]]
  h1 <- Filter(function(b) identical(b$name, "hijo1"), model$blocks)[[1]]
  h2 <- Filter(function(b) identical(b$name, "hijo2"), model$blocks)[[1]]
  # La seccion enuncia la condicion UNA vez; las hijas que la heredan NO la repiten.
  expect_match(sec$opening_condition, "En caso de haber respondido")
  expect_identical(h1$opening_condition, "")
  expect_identical(h2$opening_condition, "")
})

test_that("matrix rows are numbered sequentially (not subnumbered N.j)", {
  # Dos preguntas simples, luego una matriz de 3 items, luego otra pregunta.
  survey <- data.frame(
    type = c("integer", "select_one acuerdo", "select_one acuerdo", "select_one acuerdo", "text"),
    name = c("q1", "q2_a", "q2_b", "q2_c", "q3"),
    label = c("Edad", "Afirma A", "Afirma B", "Afirma C", "Comentario"),
    paper_group = c("", "bloque", "bloque", "bloque", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("acuerdo", 4),
    name = c("1", "2", "3", "9"),
    label = c("Nada", "Poco", "Mucho", "SIN INF"),
    stringsAsFactors = FALSE
  )
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"))
  matrix <- Filter(function(b) identical(b$kind, "matrix"), model$blocks)[[1]]
  q3 <- Filter(function(b) identical(b$name, "q3"), model$blocks)[[1]]

  N <- as.integer(matrix$number)
  expect_equal(length(matrix$items), 3L)
  # Cada fila toma el siguiente entero correlativo: N, N+1, N+2 (sin subnumeros).
  expect_identical(matrix$items[[1]]$number, as.character(N))
  expect_identical(matrix$items[[2]]$number, as.character(N + 1L))
  expect_identical(matrix$items[[3]]$number, as.character(N + 2L))
  expect_false(grepl("\\.", matrix$items[[1]]$number))
  # La pregunta siguiente continua tras la ultima fila: N+3.
  expect_identical(q3$number, as.character(N + 3L))
})

test_that("explicit matrix_groups override autodetection", {
  survey <- data.frame(
    type = rep("select_one esc", 3),
    name = c("q1_a", "q1_b", "q1_c"),
    label = c("Afirma A", "Afirma B", "Afirma C"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("esc", 4),
    name = c("1", "2", "3", "9"),
    label = c("Nada", "Poco", "Mucho", "SIN INF"),
    stringsAsFactors = FALSE
  )
  settings <- data.frame(form_title = "T")

  # (c) Sin el option: autodeteccion agrupa las 3 en una matriz.
  m_auto <- formulario_pdf_build_model(survey, choices, settings)
  expect_equal(m_auto$summary$n_matrices, 1L)
  mat_auto <- Filter(function(b) identical(b$kind, "matrix"), m_auto$blocks)[[1]]
  expect_equal(length(mat_auto$items), 3L)

  # (a) matrix_groups agrupa solo 2 de 3: esas 2 forman matriz, la 3a individual.
  m_grp <- formulario_pdf_build_model(survey, choices, settings,
                                      options = list(matrix_groups = list(c("q1_a", "q1_b"))))
  expect_equal(m_grp$summary$n_matrices, 1L)
  mat_grp <- Filter(function(b) identical(b$kind, "matrix"), m_grp$blocks)[[1]]
  expect_equal(length(mat_grp$items), 2L)
  q_c <- Filter(function(b) identical(b$name, "q1_c"), m_grp$blocks)
  expect_equal(length(q_c), 1L)
  expect_identical(q_c[[1]]$kind, "question")

  # (b) matrix_groups = list() (presente pero vacio): ninguna matriz.
  m_none <- formulario_pdf_build_model(survey, choices, settings,
                                       options = list(matrix_groups = list()))
  expect_equal(m_none$summary$n_matrices, 0L)
  expect_equal(m_none$summary$n_questions, 3L)
})

test_that("invalid matrix_groups are ignored with a warning", {
  survey <- data.frame(
    type = rep("select_one esc", 3),
    name = c("q1_a", "q1_b", "q1_c"),
    label = c("A", "B", "C"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = rep("esc", 3), name = c("1", "2", "9"),
                        label = c("Nada", "Mucho", "SIN INF"), stringsAsFactors = FALSE)

  # miembro inexistente -> grupo ignorado con warning, sin romper el render.
  m <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                  options = list(matrix_groups = list(c("q1_a", "no_existe"))))
  expect_equal(m$summary$n_matrices, 0L)
  expect_match(paste(m$warnings, collapse = " "), "inexistentes")

  # grupo no contiguo -> ignorado.
  m2 <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                   options = list(matrix_groups = list(c("q1_a", "q1_c"))))
  expect_equal(m2$summary$n_matrices, 0L)
  expect_match(paste(m2$warnings, collapse = " "), "contiguas")
})

test_that("matrix tenor drives subnumbering X.1..X.k, next question X+1", {
  survey <- data.frame(
    type = c("select_one esc", "select_one esc", "select_one esc", "text"),
    name = c("q1_a", "q1_b", "q1_c", "q2"),
    label = c("Afirma A", "Afirma B", "Afirma C", "Comentario"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = rep("esc", 4), name = c("1", "2", "3", "9"),
                        label = c("Nada", "Poco", "Mucho", "SIN INF"), stringsAsFactors = FALSE)
  settings <- data.frame(form_title = "T")

  # (a) CON tenor: X. {tenor} + filas X.1..X.k + siguiente X+1.
  m_ten <- formulario_pdf_build_model(survey, choices, settings, options = list(
    matrix_groups = list(list(members = c("q1_a", "q1_b", "q1_c"), tenor = "Indique su grado de acuerdo"))
  ))
  mat <- Filter(function(b) identical(b$kind, "matrix"), m_ten$blocks)[[1]]
  q2 <- Filter(function(b) identical(b$name, "q2"), m_ten$blocks)[[1]]
  expect_identical(mat$number, "1")
  expect_identical(mat$title, "Indique su grado de acuerdo")
  expect_equal(length(mat$items), 3L)
  expect_identical(mat$items[[1]]$number, "1.1")
  expect_identical(mat$items[[3]]$number, "1.3")
  expect_identical(q2$number, "2")  # X+1

  # (b) SIN tenor (misma forma-objeto, tenor vacio): filas secuenciales X..X+k-1.
  m_seq <- formulario_pdf_build_model(survey, choices, settings, options = list(
    matrix_groups = list(list(members = c("q1_a", "q1_b", "q1_c"), tenor = ""))
  ))
  mat2 <- Filter(function(b) identical(b$kind, "matrix"), m_seq$blocks)[[1]]
  q2b <- Filter(function(b) identical(b$name, "q2"), m_seq$blocks)[[1]]
  expect_identical(mat2$items[[1]]$number, "1")
  expect_identical(mat2$items[[3]]$number, "3")
  expect_identical(q2b$number, "4")  # X+k

  # (c) forma vieja [[names]] (retrocompat): sin tenor, secuencial.
  m_old <- formulario_pdf_build_model(survey, choices, settings, options = list(
    matrix_groups = list(c("q1_a", "q1_b", "q1_c"))
  ))
  mat3 <- Filter(function(b) identical(b$kind, "matrix"), m_old$blocks)[[1]]
  expect_identical(mat3$items[[1]]$number, "1")
  expect_identical(mat3$items[[3]]$number, "3")
  expect_identical(mat3$tenor, "")
})

test_that("matrix header left cell has no 'respuesta por fila' text", {
  survey <- data.frame(
    type = rep("select_one esc", 3),
    name = c("q1_a", "q1_b", "q1_c"),
    label = c("Afirma A", "Afirma B", "Afirma C"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = rep("esc", 4), name = c("1", "2", "3", "9"),
                        label = c("Nada", "Poco", "Mucho", "SIN INF"), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"), output_file = tmp)
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  expect_false(grepl("respuesta por fila", txt, ignore.case = TRUE))
  # la escala si debe estar (matriz sigue renderizando)
  expect_true(grepl("SIN INF", txt))
})

test_that("matrix prints the scale code in every item row (reference style)", {
  survey <- data.frame(
    type = rep("select_one acuerdo", 4),
    name = c("q_a", "q_b", "q_c", "q_d"),
    label = c("Afirmacion uno", "Afirmacion dos", "Afirmacion tres", "Afirmacion cuatro"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("acuerdo", 5),
    name = c("1", "2", "3", "4", "99"),
    label = c("Totalmente en Desacuerdo", "En Desacuerdo", "De Acuerdo",
              "Totalmente de Acuerdo", "SIN INF"),
    stringsAsFactors = FALSE
  )
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "Escala"),
                         output_file = tmp)
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  # El codigo especial "99" se imprime en CADA fila-item (4 items), no solo en la
  # cabecera (que muestra "SIN INF"). Debe aparecer >= 4 veces.
  n99 <- length(gregexpr("99", txt, fixed = TRUE)[[1]])
  expect_gte(n99, 4L)
  expect_true(grepl("SIN INF", txt))
  expect_true(grepl("Totalmente en Desacuerdo", txt))
})

test_that("show_questionnaire_number flag toggles and never breaks render", {
  survey <- data.frame(type = "text", name = "p1", label = "Nombre", stringsAsFactors = FALSE)
  choices <- data.frame(list_name = character(0), name = character(0), label = character(0),
                        stringsAsFactors = FALSE)

  m_default <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"))
  expect_true(isTRUE(m_default$show_questionnaire_number))

  m_off <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(show_questionnaire_number = FALSE))
  expect_false(isTRUE(m_off$show_questionnaire_number))
  # acepta strings
  m_str <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(show_questionnaire_number = "false"))
  expect_false(isTRUE(m_str$show_questionnaire_number))

  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp, options = list(show_questionnaire_number = FALSE))
  expect_true(file.exists(tmp))
  expect_gte(qpdf::pdf_length(tmp), 1)
})

test_that("OPS sample renders in one and two columns with matrices", {
  path <- test_path("../../inst/samples/ops_salud/instrumento.xlsx")
  skip_if_not(file.exists(path))

  survey <- readxl::read_excel(path, sheet = "survey", col_types = "text")
  choices <- readxl::read_excel(path, sheet = "choices", col_types = "text")
  settings <- data.frame(form_title = "Encuesta OPS", form_id = "ops_salud")

  for (cols in c(1L, 2L)) {
    tmp <- tempfile(fileext = ".pdf")
    result <- suppressWarnings(reporte_formulario_pdf(
      survey, choices, settings = settings, output_file = tmp,
      options = list(columns = cols)
    ))
    expect_true(file.exists(tmp))
    expect_gt(file.info(tmp)$size, 5000)
    expect_gte(qpdf::pdf_length(tmp), 1)
    expect_gt(result$summary$n_matrices, 0)
  }
})
