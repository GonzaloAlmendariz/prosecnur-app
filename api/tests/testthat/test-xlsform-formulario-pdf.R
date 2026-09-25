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

  expect_match(no_choice$paper_skip, "pase a la pregunta")
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

test_that("contextual special detection across scale shapes (2/5/8/9/12 pts)", {
  P <- function(codes, labels) {
    opts <- Map(function(cc, ll) list(code = cc, label = ll), codes, labels)
    .form_pdf_matrix_partition_options(unname(opts))
  }
  ncol <- function(p) length(p$scale) + (if (!is.null(p$special)) 1L else 0L)

  # (a) 4 + especial 9 (gap) -> 5 columnas, especial 9
  p <- P(c("1","2","3","4","9"), c("Muy bajo","Bajo","Alto","Muy alto","SIN INF"))
  expect_equal(length(p$scale), 4L); expect_identical(p$special$code, "9"); expect_equal(ncol(p), 5L)
  # (b) 4 + especial 99 (etiqueta NS)
  p <- P(c("1","2","3","4","99"), c("A","B","C","D","No sabe"))
  expect_equal(length(p$scale), 4L); expect_identical(p$special$code, "99")
  # (c) 5 puntos con intermedia, SIN especial
  p <- P(c("1","2","3","4","5"),
         c("Totalmente en desacuerdo","En desacuerdo","Ni de acuerdo ni en desacuerdo",
           "De acuerdo","Totalmente de acuerdo"))
  expect_equal(length(p$scale), 5L); expect_null(p$special)
  # (d) escala 1-9 CONTIGUA: el 9 NO debe separarse
  p <- P(as.character(1:9), paste("Punto", 1:9))
  expect_equal(length(p$scale), 9L); expect_null(p$special)
  # (e) 8 puntos contiguos
  p <- P(as.character(1:8), paste("P", 1:8))
  expect_equal(length(p$scale), 8L); expect_null(p$special)
  # (f) 12 puntos contiguos
  p <- P(as.character(1:12), paste("P", 1:12))
  expect_equal(length(p$scale), 12L); expect_null(p$special)
  # (g) 2 puntos Si/No
  p <- P(c("1","2"), c("Si","No"))
  expect_equal(length(p$scale), 2L); expect_null(p$special)
  # extra: 1-4 + 88 centinela alto -> especial 88
  p <- P(c("1","2","3","4","88"), c("A","B","C","D","No hay informacion"))
  expect_equal(length(p$scale), 4L); expect_identical(p$special$code, "88")
  # extra: 5 puntos + 9 con gap -> escala 5, especial 9
  p <- P(c("1","2","3","4","5","9"), c("A","B","C","D","E","SIN INF"))
  expect_equal(length(p$scale), 5L); expect_identical(p$special$code, "9")
  # extra: codigo 77 con etiqueta "No aplica" -> especial por etiqueta
  p <- P(c("1","2","3","77"), c("A","B","C","No aplica"))
  expect_identical(p$special$code, "77")
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

test_that("special_override fixes the special column explicitly", {
  P <- function(codes, labels) {
    Map(function(cc, ll) list(code = cc, label = ll), codes, labels)
  }
  ncol <- function(p) length(p$scale) + (if (!is.null(p$special)) 1L else 0L)

  # (a) "none" sobre escala con 9 al final: TODO es escala, sin especial. La
  # heuristica separaria el 9 (gap), pero el override lo impide.
  opts_a <- unname(P(c("1","2","3","4","9"),
                     c("Muy bajo","Bajo","Alto","Muy alto","SIN INF")))
  p_none <- .form_pdf_matrix_partition_options(opts_a, "none")
  expect_null(p_none$special)
  expect_equal(length(p_none$scale), 5L)
  expect_equal(ncol(p_none), 5L)
  # confirmacion: sin override, la heuristica si separa el 9.
  p_auto <- .form_pdf_matrix_partition_options(opts_a, "auto")
  expect_identical(p_auto$special$code, "9")
  expect_equal(length(p_auto$scale), 4L)

  # (b) "9" sobre escala CONTIGUA 1..9: la heuristica NO separaria el 9 (contiguo),
  # pero el override lo fuerza como especial -> 8 de escala + 1 especial.
  opts_b <- unname(P(as.character(1:9), paste("Punto", 1:9)))
  p_force <- .form_pdf_matrix_partition_options(opts_b, "9")
  expect_identical(p_force$special$code, "9")
  expect_equal(length(p_force$scale), 8L)
  expect_equal(ncol(p_force), 9L)
  # confirmacion: sin override, 1..9 contiguo es todo escala.
  p_b_auto <- .form_pdf_matrix_partition_options(opts_b, "auto")
  expect_null(p_b_auto$special)
  expect_equal(length(p_b_auto$scale), 9L)

  # (c) ausente / "auto" / NULL: heuristica intacta (mismos asserts que ya existen).
  opts_c <- unname(P(c("1","2","3","4","9"),
                     c("Totalmente en Desacuerdo","En Desacuerdo","De Acuerdo",
                       "Totalmente de Acuerdo","SIN INF")))
  for (ov in list(NULL, "auto", "")) {
    p <- .form_pdf_matrix_partition_options(opts_c, ov)
    expect_equal(length(p$scale), 4L)
    expect_identical(p$special$code, "9")
    expect_identical(p$scale[[1]]$label, "Totalmente en Desacuerdo")
    expect_identical(p$scale[[4]]$label, "Totalmente de Acuerdo")
  }

  # (d) defensivo: codigo forzado inexistente -> warning + caida a heuristica.
  expect_warning(
    p_miss <- .form_pdf_matrix_partition_options(opts_a, "77"),
    "inexistente")
  expect_identical(p_miss$special$code, "9")  # heuristica de respaldo
})

test_that("matrix_groups special is parsed and attached to the matrix block", {
  survey <- data.frame(
    type = rep("select_one esc", 3),
    name = c("q1_a", "q1_b", "q1_c"),
    label = c("Afirma A", "Afirma B", "Afirma C"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("esc", 5),
    name = c("1", "2", "3", "4", "9"),
    label = c("Nada", "Poco", "Algo", "Mucho", "SIN INF"),
    stringsAsFactors = FALSE
  )
  settings <- data.frame(form_title = "T")

  # keys_from_groups devuelve `specials` alineado a la key del grupo.
  mg <- .form_pdf_matrix_keys_from_groups(survey, list(
    list(members = c("q1_a", "q1_b", "q1_c"), special = "none")))
  gkey <- mg$keys[mg$keys != ""][1]
  expect_identical(mg$specials[[gkey]], "none")

  # special = "none" adjunta special_override="none" al bloque -> matriz sin especial.
  m_none <- formulario_pdf_build_model(survey, choices, settings, options = list(
    matrix_groups = list(list(members = c("q1_a", "q1_b", "q1_c"), special = "none"))))
  mat_none <- Filter(function(b) identical(b$kind, "matrix"), m_none$blocks)[[1]]
  expect_identical(mat_none$special_override, "none")
  part_none <- .form_pdf_matrix_partition_options(mat_none$options, mat_none$special_override)
  expect_null(part_none$special)
  expect_equal(length(part_none$scale), 5L)

  # special ausente -> override "auto" (heuristica separa el 9).
  m_auto <- formulario_pdf_build_model(survey, choices, settings, options = list(
    matrix_groups = list(list(members = c("q1_a", "q1_b", "q1_c")))))
  mat_auto <- Filter(function(b) identical(b$kind, "matrix"), m_auto$blocks)[[1]]
  expect_identical(mat_auto$special_override, "auto")
  part_auto <- .form_pdf_matrix_partition_options(mat_auto$options, mat_auto$special_override)
  expect_identical(part_auto$special$code, "9")
})

test_that("un grupo de matriz de UNA sola pregunta rinde una matriz de 1 fila", {
  survey <- data.frame(
    type = c("select_one esc", "text"),
    name = c("q1", "q2"),
    label = c("¿Qué tan satisfecho está?", "Comentario"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("esc", 5),
    name = c("1", "2", "3", "4", "9"),
    label = c("Nada", "Poco", "Algo", "Mucho", "SIN INF"),
    stringsAsFactors = FALSE
  )
  # keys_from_groups ya no rechaza grupos de 1 miembro (matriz de 1 fila, opt-in).
  mg <- .form_pdf_matrix_keys_from_groups(survey, list(list(members = c("q1"))))
  expect_false(any(grepl("al menos", mg$warnings)))
  expect_true(any(nzchar(mg$keys)))

  m <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                  options = list(matrix_groups = list(list(members = c("q1")))))
  mats <- Filter(function(b) identical(b$kind, "matrix"), m$blocks)
  expect_length(mats, 1L)
  expect_length(mats[[1]]$items, 1L)
  expect_identical(mats[[1]]$items[[1]]$name, "q1")
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
    # En categorias la etiqueta de escala se envuelve; pdftotext puede partir la
    # frase, pero la palabra distintiva del label::es debe estar (no la de en).
    expect_true(grepl("Desacuerdo", txt))
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

test_that("logic_language saltos uses 'pase a la pregunta' wording", {
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
  expect_true(grepl("pase a la pregunta", txt))
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
  expect_match(q2$opening_condition, "en la pregunta 1", fixed = TRUE)
  expect_identical(q3$opening_condition, "")

  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp, options = list(logic_language = "condiciones"))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  expect_true(grepl("En caso de", txt))
  expect_false(grepl("pase a la pregunta", txt))
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

test_that("group-level relevant skips the WHOLE group to the first question after it", {
  # `relevant` en el begin_group: el bloque condicionado es todo el grupo; el
  # destino es la primera pregunta DESPUES del end_group (no la primera hija).
  survey <- data.frame(
    type = c("select_one yesno", "begin_group", "text", "text", "end_group", "text"),
    name = c("filtro", "grp", "hijo1", "hijo2", "", "despues"),
    label = c("¿Continúa?", "Datos", "N1", "N2", "", "Cierre"),
    relevant = c("", "${filtro} = '1'", "", "", "", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Si", "No"), stringsAsFactors = FALSE)
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"))
  filtro <- Filter(function(b) identical(b$name, "filtro"), model$blocks)[[1]]
  despues <- Filter(function(b) identical(b$name, "despues"), model$blocks)[[1]]
  hijo1 <- Filter(function(b) identical(b$name, "hijo1"), model$blocks)[[1]]
  no_choice <- Filter(function(c) identical(c$code, "2"), filtro$options)[[1]]
  # El salto apunta a la pregunta post-grupo (`despues`), NO a la primera hija.
  expect_identical(no_choice$paper_skip, sprintf("pase a la pregunta %s", despues$number))
  expect_false(identical(no_choice$paper_skip, sprintf("pase a la pregunta %s", hijo1$number)))
})

test_that("skip that lands at questionnaire end says 'Fin de la encuesta'", {
  survey <- data.frame(
    type = c("select_one yesno", "begin_group", "text", "text", "end_group"),
    name = c("filtro", "grp", "h1", "h2", ""),
    label = c("¿Sigue?", "Datos", "A", "B", ""),
    relevant = c("", "${filtro} = '1'", "", "", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Si", "No"), stringsAsFactors = FALSE)
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"))
  filtro <- Filter(function(b) identical(b$name, "filtro"), model$blocks)[[1]]
  no_choice <- Filter(function(c) identical(c$code, "2"), filtro$options)[[1]]
  expect_identical(no_choice$paper_skip, "Fin de la encuesta")
})

test_that("no-op skip (nothing numbered is skipped) is suppressed", {
  # El relevant solo gatea una nota (no numerada) entre dos preguntas: el destino
  # coincide con la pregunta inmediatamente siguiente al origen -> no se emite salto.
  survey <- data.frame(
    type = c("select_one yesno", "note", "text"),
    name = c("filtro", "nota", "final"),
    label = c("¿Ver nota?", "Texto informativo", "Comentario"),
    relevant = c("", "${filtro} = '1'", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Si", "No"), stringsAsFactors = FALSE)
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"))
  filtro <- Filter(function(b) identical(b$name, "filtro"), model$blocks)[[1]]
  no_choice <- Filter(function(c) identical(c$code, "2"), filtro$options)[[1]]
  expect_false(nzchar(no_choice$paper_skip %||% ""))
})

test_that("condiciones wording uses 'en la pregunta N' (full word)", {
  survey <- data.frame(
    type = c("select_one yesno", "text"),
    name = c("p1", "p2"),
    label = c("¿Trabaja?", "Ocupación"),
    relevant = c("", "${p1} = '1'"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Sí", "No"), stringsAsFactors = FALSE)
  model <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
                                      options = list(logic_language = "condiciones"))
  q2 <- Filter(function(b) identical(b$name, "p2"), model$blocks)[[1]]
  expect_match(q2$opening_condition, "en la pregunta 1", fixed = TRUE)
  expect_false(grepl("P.1", q2$opening_condition, fixed = TRUE))
})

test_that("consent_var: omits consent opening (condiciones) and terminates (saltos)", {
  survey <- data.frame(
    type = c("select_one yesno", "begin_group", "text", "end_group",
             "select_one yesno", "begin_group", "text", "end_group", "text"),
    name = c("consent", "g1", "q1", "", "otra", "g2", "q2", "", "cierre"),
    label = c("¿Consiente?", "Bloque 1", "Dato 1", "",
              "¿Otra cosa?", "Bloque 2", "Dato 2", "", "Final"),
    relevant = c("", "${consent} = '1'", "", "",
                 "", "${otra} = '1'", "", "", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("yesno", "yesno"), name = c("1", "2"),
                        label = c("Sí", "No"), stringsAsFactors = FALSE)

  # CONDICIONES: la apertura del consentimiento se omite; la de OTRA variable no.
  m_cond <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
    options = list(logic_language = "condiciones", consent_var = "consent"))
  sec_g1 <- Filter(function(b) identical(b$kind, "section") && grepl("Bloque 1", b$title), m_cond$blocks)[[1]]
  sec_g2 <- Filter(function(b) identical(b$kind, "section") && grepl("Bloque 2", b$title), m_cond$blocks)[[1]]
  expect_identical(sec_g1$opening_condition, "")                       # consentimiento omitido
  expect_match(sec_g2$opening_condition, "En caso de haber respondido") # otra condicion sí

  # SALTOS: la negativa del consentimiento termina la encuesta.
  m_skip <- formulario_pdf_build_model(survey, choices, data.frame(form_title = "T"),
    options = list(logic_language = "saltos", consent_var = "consent"))
  consent <- Filter(function(b) identical(b$name, "consent"), m_skip$blocks)[[1]]
  no_consent <- Filter(function(c) identical(c$code, "2"), consent$options)[[1]]
  expect_identical(no_consent$paper_skip, "Fin de la encuesta")
})

test_that("OPS consent no longer emits the false 'pase a la pregunta 4'", {
  path <- test_path("../../inst/samples/ops_salud/instrumento.xlsx")
  skip_if_not(file.exists(path))
  survey <- readxl::read_excel(path, sheet = "survey", col_types = "text")
  choices <- readxl::read_excel(path, sheet = "choices", col_types = "text")
  st <- data.frame(form_title = "OPS")

  m <- suppressWarnings(formulario_pdf_build_model(survey, choices, st,
                                                   options = list(logic_language = "saltos")))
  consent <- Filter(function(b) identical(b$name, "consetimiento"), m$blocks)[[1]]
  skips <- vapply(consent$options, function(o) o$paper_skip %||% "", character(1))
  # El destino real es post-grupo (no la pregunta inmediatamente siguiente Q4).
  expect_false(any(skips == "pase a la pregunta 4"))
  expect_true(any(nzchar(skips)))  # sí hay un salto real (a la seccion tras el grupo)

  # Con consent_var, la negativa termina la encuesta.
  m2 <- suppressWarnings(formulario_pdf_build_model(survey, choices, st,
    options = list(logic_language = "saltos", consent_var = "consetimiento")))
  consent2 <- Filter(function(b) identical(b$name, "consetimiento"), m2$blocks)[[1]]
  skips2 <- vapply(consent2$options, function(o) o$paper_skip %||% "", character(1))
  expect_true(any(skips2 == "Fin de la encuesta"))
  expect_false(any(skips2 == "pase a la pregunta 4"))
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

test_that("matrix without tenor does not draw a duplicated heading", {
  # Matriz autodetectada SIN tenor: la etiqueta del 1er item NO debe salir como
  # encabezado ademas de como fila 1 (antes se duplicaba).
  survey <- data.frame(
    type = rep("select_one esc", 3),
    name = c("q1_a", "q1_b", "q1_c"),
    label = c("Conoce la vision institucional", "Afirma B", "Afirma C"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = rep("esc", 4), name = c("1", "2", "3", "9"),
                        label = c("Nada", "Poco", "Mucho", "SIN INF"), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp,
                         options = list(matrix_groups = list(c("q1_a", "q1_b", "q1_c"))))
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  # El token distintivo del 1er item aparece UNA sola vez (solo como fila).
  n_hits <- length(gregexpr("Conoce", txt, fixed = TRUE)[[1]])
  expect_equal(n_hits, 1L)
  # La tabla sigue renderizando (escala + filas B/C).
  expect_true(grepl("Afirma B", txt))
  expect_true(grepl("SIN INF", txt))
})

test_that("matrix with tenor keeps its numbered heading and X.j rows", {
  survey <- data.frame(
    type = rep("select_one esc", 3),
    name = c("q1_a", "q1_b", "q1_c"),
    label = c("Afirma A", "Afirma B", "Afirma C"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = rep("esc", 4), name = c("1", "2", "3", "9"),
                        label = c("Nada", "Poco", "Mucho", "SIN INF"), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp,
                         options = list(matrix_groups = list(list(
                           members = c("q1_a", "q1_b", "q1_c"),
                           tenor = "Indique su grado de acuerdo con las siguientes afirmaciones"))))
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  # El tenor sigue como encabezado numerado y las filas conservan la subnumeracion.
  expect_true(grepl("Indique su grado de acuerdo", txt))
  expect_true(grepl("1.1", txt, fixed = TRUE))
  expect_true(grepl("1.3", txt, fixed = TRUE))
})

test_that("section band renders the title without a 'SECCIÓN N' kicker", {
  survey <- data.frame(
    type = c("begin_group", "text", "end_group", "begin_group", "text", "end_group"),
    name = c("s1", "q1", "", "s2", "q2", ""),
    label = c("1.1 Caracteristicas del programa", "Nombre", "",
              "Datos generales del informante", "Edad", ""),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = character(0), name = character(0),
                        label = character(0), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp)
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  # Sin kicker "SECCIÓN N": la banda (centrada) muestra solo el titulo.
  expect_false(grepl("SECCIÓN 1", txt))
  expect_false(grepl("SECCIÓN 2", txt))
  # Los titulos de ambas secciones siguen presentes.
  expect_true(grepl("Caracteristicas del programa", txt, ignore.case = TRUE))
  expect_true(grepl("Datos generales del informante", txt, ignore.case = TRUE))
})

test_that("default instructions use the accented word 'códigos'", {
  survey <- data.frame(type = "text", name = "p1", label = "Nombre", stringsAsFactors = FALSE)
  choices <- data.frame(list_name = character(0), name = character(0),
                        label = character(0), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"),
                         output_file = tmp)
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  expect_true(grepl("códigos", txt))
  expect_false(grepl("Registre codigos", txt))
})

test_that("matrix_layout column flows matrices inside one column (2-col render)", {
  survey <- data.frame(
    type = rep("select_one info", 4),
    name = c("q_a", "q_b", "q_c", "q_d"),
    label = c("Delincuencia", "Desempleo", "Salud", "Corrupción"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("info", 5), name = c("1", "2", "3", "4", "0"),
    label = c("Nada informado", "Poco informado", "Algo informado", "Muy informado", "NS/NR"),
    stringsAsFactors = FALSE
  )
  settings <- data.frame(form_title = "T")
  grp <- list(matrix_groups = list(list(members = c("q_a", "q_b", "q_c", "q_d"), tenor = "Grado")))

  # default matrix_layout = "full" -> matriz full_width.
  m_full <- formulario_pdf_build_model(survey, choices, settings, options = c(grp, list(columns = 2)))
  expect_identical(m_full$matrix_layout, "full")
  mat_full <- Filter(function(b) identical(b$kind, "matrix"), m_full$blocks)[[1]]
  expect_true(isTRUE(mat_full$full_width))

  # matrix_layout = "column" en 2 columnas -> matriz NO full_width (fluye en col_w).
  m_col <- formulario_pdf_build_model(survey, choices, settings,
                                      options = c(grp, list(columns = 2, matrix_layout = "column")))
  expect_identical(m_col$matrix_layout, "column")
  mat_col <- Filter(function(b) identical(b$kind, "matrix"), m_col$blocks)[[1]]
  expect_false(isTRUE(mat_col$full_width))

  # Fallback de gracia: escala 1..10 (>6 columnas) se queda full_width aun en "column".
  ch10 <- data.frame(list_name = rep("esc10", 11), name = c(as.character(1:10), "0"),
                     label = c(as.character(1:10), "NS/NR"), stringsAsFactors = FALSE)
  s10 <- data.frame(type = rep("select_one esc10", 3), name = c("a", "b", "c"),
                    label = c("A", "B", "C"), stringsAsFactors = FALSE)
  m10 <- formulario_pdf_build_model(s10, ch10, settings, options = list(
    columns = 2, matrix_layout = "column",
    matrix_groups = list(list(members = c("a", "b", "c"), tenor = "Escala 1-10"))))
  mat10 <- Filter(function(b) identical(b$kind, "matrix"), m10$blocks)[[1]]
  expect_true(isTRUE(mat10$full_width))
})

test_that("matrix header mode auto: short labels categorias, numeric 1-10 extremos", {
  short_scale <- lapply(c("Nada", "Poco", "Algo", "Mucho"), function(l) list(code = "x", label = l))
  expect_identical(.form_pdf_matrix_header_mode(short_scale, "auto"), "categorias")
  num_scale <- lapply(1:10, function(i) list(code = as.character(i), label = as.character(i)))
  expect_identical(.form_pdf_matrix_header_mode(num_scale, "auto"), "extremos")
  # Etiquetas largas pero presentes -> categorias con wrap horizontal (referencia).
  long_scale <- lapply(c("Totalmente en desacuerdo", "En desacuerdo"), function(l) list(code = "x", label = l))
  expect_identical(.form_pdf_matrix_header_mode(long_scale, "auto"), "categorias")
  # Sin etiqueta en alguna opcion -> extremos.
  gap_scale <- lapply(c("Totalmente en desacuerdo", "", "Totalmente de acuerdo"), function(l) list(code = "x", label = l))
  expect_identical(.form_pdf_matrix_header_mode(gap_scale, "auto"), "extremos")
  # override explicito respeta la eleccion del usuario.
  expect_identical(.form_pdf_matrix_header_mode(num_scale, "categorias"), "categorias")
  expect_identical(.form_pdf_matrix_header_mode(short_scale, "extremos"), "extremos")
})

test_that("matrix_groups header override is parsed and attached to the block", {
  survey <- data.frame(type = rep("select_one esc", 3), name = c("q1_a", "q1_b", "q1_c"),
                       label = c("A", "B", "C"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = rep("esc", 5), name = c("1", "2", "3", "4", "0"),
                        label = c("Nada", "Poco", "Algo", "Mucho", "NS/NR"), stringsAsFactors = FALSE)
  settings <- data.frame(form_title = "T")
  for (hv in c("extremos", "categorias", "auto")) {
    m <- formulario_pdf_build_model(survey, choices, settings, options = list(
      matrix_groups = list(list(members = c("q1_a", "q1_b", "q1_c"), header = hv))))
    mat <- Filter(function(b) identical(b$kind, "matrix"), m$blocks)[[1]]
    expect_identical(mat$header_mode, hv)
  }
})

test_that("special code 0 (NS/NR) is detected as the special column", {
  # 0 con etiqueta NS/NR (escala 1..4 + 0).
  p <- .form_pdf_matrix_partition_options(list(
    list(code = "1", label = "Nada"), list(code = "2", label = "Poco"),
    list(code = "3", label = "Algo"), list(code = "4", label = "Mucho"),
    list(code = "0", label = "NS/NR")))
  expect_identical(p$special$code, "0")
  expect_equal(length(p$scale), 4L)
  # 0 como sentinel bajo discontinuo (gap) sin etiqueta NS/NR.
  pg <- .form_pdf_matrix_partition_options(list(
    list(code = "2", label = "B"), list(code = "3", label = "C"),
    list(code = "4", label = "D"), list(code = "5", label = "E"),
    list(code = "0", label = "Cero")))
  expect_identical(pg$special$code, "0")
  # 0 contiguo legitimo (0..4) SIN etiqueta NS/NR -> NO especial (conservador).
  pc <- .form_pdf_matrix_partition_options(list(
    list(code = "0", label = "Cero"), list(code = "1", label = "Uno"),
    list(code = "2", label = "Dos"), list(code = "3", label = "Tres"),
    list(code = "4", label = "Cuatro")))
  expect_null(pc$special)
})

test_that("categorias header prints every scale label (rotated) in pdftotext", {
  survey <- data.frame(type = rep("select_one info", 3), name = c("q_a", "q_b", "q_c"),
                       label = c("Delincuencia", "Desempleo", "Salud"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = rep("info", 5), name = c("1", "2", "3", "4", "0"),
                        label = c("Nada informado", "Poco informado", "Algo informado",
                                  "Muy informado", "NS/NR"), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = data.frame(form_title = "T"), output_file = tmp,
                         options = list(matrix_groups = list(list(
                           members = c("q_a", "q_b", "q_c"), tenor = "Grado", header = "categorias"))))
  expect_true(file.exists(tmp))
  pdftotext <- Sys.which("pdftotext")
  skip_if_not(nzchar(pdftotext))
  txt <- paste(system2(pdftotext, c(tmp, "-"), stdout = TRUE), collapse = " ")
  for (lbl in c("Nada informado", "Poco informado", "Algo informado", "Muy informado", "NS/NR")) {
    expect_true(grepl(lbl, txt, fixed = TRUE))
  }
  # El codigo especial 0 se imprime en cada fila (3 items) -> >= 3 veces.
  expect_gte(length(gregexpr("0", txt, fixed = TRUE)[[1]]), 3L)
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

# =============================================================================
# Cambios de comportamiento deliberados de 4ab248a4 (checklist
# `docs/qa/checklist-motor-formulario-papel-2026-09-24.md`). Cada uno se fija
# con la entrada LITERAL que lo motivo.
# =============================================================================

test_that("item 11 (gate): las categorias de respuesta sobreviven literales y toda diferencia se declara", {
  # REGLA QUE NO SE NEGOCIA del checklist: "las categorias de respuesta
  # existentes no se tocan". `.form_pdf_clean_text()` aplicaba `gsub("[`*]", "")`
  # a TODO texto, y las etiquetas de categoria pasaban por ahi: `De 5* a 10*` se
  # imprimia `De 5 a 10`, sin warning y sin rastro en el artefacto. Un cambio de
  # etiqueta no consultado rompe la comparabilidad del cuestionario y nadie lo
  # detecta hasta el analisis; por eso esto es un gate, no un detalle.
  choices <- data.frame(
    list_name = rep("frec", 3),
    name = c("1", "2", "3"),
    label = c("De 5* a 10*", "Nota al pie (*)", "3 * a la semana"),
    stringsAsFactors = FALSE
  )
  survey <- data.frame(type = "select_one frec", name = "q1",
                       label = "Frecuencia semanal", stringsAsFactors = FALSE)

  model <- formulario_pdf_build_model(survey, choices, settings = list(form_title = "T"))
  bloque <- Filter(function(b) identical(b$name, "q1"), model$blocks)[[1]]
  etiquetas <- vapply(bloque$options, function(o) o$label, character(1))

  expect_identical(etiquetas, c("De 5* a 10*", "Nota al pie (*)", "3 * a la semana"))

  # Y la diferencia se DECLARA: silencio y normalizacion son la misma falta.
  for (cat_lbl in etiquetas) {
    expect_true(
      any(grepl(cat_lbl, model$warnings, fixed = TRUE)),
      info = sprintf("sin warning declarado para la categoria conservada: %s", cat_lbl)
    )
  }
  expect_true(any(grepl("De 5 a 10", model$warnings, fixed = TRUE)))
})

test_that("item 6: el despojador de prefijos no se come texto legitimo del enunciado", {
  # Tabla literal del checklist. A la izquierda lo que el XLSForm trae, a la
  # derecha lo que debe quedar tras quitar la numeracion que el motor va a
  # imponer el mismo. Las tres primeras filas son PERDIDA DE CONTENIDO: el
  # despojador anterior se comia el "3", el "1990" y rompia el ordinal.
  conserva <- list(
    list(label = "3 de cada 5 jóvenes trabajan", number = "3",
         esperado = "3 de cada 5 jóvenes trabajan",
         porque = "sin separador, el digito es parte del enunciado"),
    list(label = "1990. Año de nacimiento", number = "12",
         esperado = "1990. Año de nacimiento",
         porque = "mas de tres digitos no es numero de pregunta"),
    list(label = "2. ° piso del edificio", number = "2",
         esperado = "2. ° piso del edificio",
         porque = "tras el separador viene un ordinal, no un enunciado")
  )
  for (caso in conserva) {
    expect_identical(
      .form_pdf_strip_leading_number(caso$label, caso$number), caso$esperado,
      info = sprintf("%s (%s)", caso$label, caso$porque)
    )
  }

  # Y los prefijos que SI son numeracion y deben irse (el motor pone el suyo).
  destino <- "¿Cuántos hermanos tienes?"
  quita <- list(
    list(label = paste0("6.- ", destino), number = "6"),
    list(label = paste0("6.", destino), number = "6"),
    list(label = paste0("(6) ", destino), number = "6"),
    list(label = paste0("P6. ", destino), number = "6"),
    list(label = paste0("P.6 ", destino), number = "6"),
    list(label = paste0("Pregunta 6. ", destino), number = "6"),
    list(label = "C. SOLEDAD", number = "C", esperado = "SOLEDAD"),
    list(label = "A) Datos del hogar", number = "A", esperado = "Datos del hogar"),
    list(label = "IV. Ciudadanía", number = "IV", esperado = "Ciudadanía")
  )
  for (caso in quita) {
    expect_identical(
      .form_pdf_strip_leading_number(caso$label, caso$number),
      caso$esperado %||% destino,
      info = caso$label
    )
  }
})

test_that("item 7: la pregunta es la matriz, no la instruccion que la precede", {
  # Criterio textual del usuario: "estas considerando los enunciados como
  # preguntas tipo P, cuando solo la matriz deberia ser pregunta". La nota trae
  # `paper_number = "6"` a proposito: antes se lo quedaba y la matriz se
  # numeraba 7, que es el numero que el cliente ve impreso en el papel.
  survey <- data.frame(
    type = c("select_one sino", "note",
             "select_one esc4", "select_one esc4", "select_one esc4"),
    name = c("q5", "instr", "b1", "b2", "b3"),
    label = c(
      "¿Trabajas?",
      "Por favor señala cuán de acuerdo estás con cada frase.",
      "Me siento seguro", "Confío en la policía", "Participo en la comunidad"
    ),
    paper_number = c("5", "6", "", "", ""),
    paper_group = c("", "bat", "bat", "bat", "bat"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sino", "sino", rep("esc4", 4)),
    name = c("1", "2", as.character(1:4)),
    label = c("Sí", "No", "Nada", "Poco", "Bastante", "Mucho"),
    stringsAsFactors = FALSE
  )

  model <- formulario_pdf_build_model(survey, choices, settings = list(form_title = "T"))
  nota <- Filter(function(b) identical(b$name, "instr"), model$blocks)[[1]]
  matriz <- Filter(function(b) identical(b$kind, "matrix"), model$blocks)[[1]]

  # 1) La nota sale SIN numero aunque lo pidiera explicitamente.
  expect_identical(nota$number %||% "", "")
  # 2) La matriz se queda con el numero que la nota intentaba llevarse.
  expect_identical(matriz$number, "6")
  # 3) La instruccion NO es fila de la matriz (si lo fuera, se dibujaria con
  #    celdas de escala, como si se pudiera responder).
  expect_identical(
    vapply(matriz$items, function(it) it$name, character(1)),
    c("b1", "b2", "b3")
  )
  # 4) Y la exclusion se declara.
  expect_true(any(grepl("instr", model$warnings, fixed = TRUE)))
  expect_true(any(grepl("no son preguntas", model$warnings, fixed = TRUE)))
})

# =============================================================================
# Gate del §4 del checklist — medido sobre el PDF que el motor produce DIRECTO
# =============================================================================
#
# El §4 esta REPLANTEADO CON MEDICION y no es el que parece: el umbral de 40 pt
# de holgura al pie **reprobaria al documento objetivo** (nueve de sus once
# paginas estan por debajo, la minima en 1.6 pt). En un documento a dos columnas
# el texto fluye hasta llenar la pagina: holgura cercana a cero es el estado
# NORMAL, no una senal de peligro. Ese umbral no se implementa.
#
# Lo que si discrimina —lo que de verdad rompe un instrumento en papel— es que
# se parta lo que debe ir junto, y que haya texto fuera de la caja. Se mide con
# `pdftotext -bbox` sobre el PDF del motor, NUNCA sobre un `.docx` convertido:
# convertir exige LibreOffice, que no esta en el CI.

# Instrumento del gate: seis preguntas sueltas que empujan la bateria hacia el
# final de la primera pagina, y una matriz de ocho items —el caso en el que una
# matriz se parte si nadie lo impide—.
# OJO al tamano del fixture: el gate del §4 exige que el PDF ocupe DOS paginas,
# porque con una sola no discrimina (una palabra fuera del marco en la pagina 2
# es justo lo que se quiere cazar). Cuando el motor se hizo mas denso —L6 del
# GOAL, que metio el instrumento de ejemplo en una pagina— este fixture cupo en
# una y el gate se cayo. Se agranda el fixture, NUNCA se relaja la asercion: un
# gate que pasa por haberse quedado sin material no es un gate.
.form_gate_fixture <- function() {
  n_q <- 14L
  survey <- data.frame(
    type = c(rep("select_one sino", n_q), rep("select_one esc5", 8)),
    name = c(paste0("q", seq_len(n_q)), paste0("m", 1:8)),
    label = c(
      "\u00bfTrabajas actualmente en algo remunerado?", "\u00bfEstudias?",
      "\u00bfVives solo?", "\u00bfTienes hijos?",
      "\u00bfUsas transporte p\u00fablico?", "\u00bfTienes seguro de salud?",
      "\u00bfHas cambiado de domicilio en el \u00faltimo a\u00f1o?",
      "\u00bfPerteneces a alguna organizaci\u00f3n vecinal?",
      "\u00bfHas necesitado atenci\u00f3n m\u00e9dica este a\u00f1o?",
      "\u00bfCuentas con conexi\u00f3n a internet en casa?",
      "\u00bfHas participado en alguna votaci\u00f3n?",
      "\u00bfRecibes alg\u00fan apoyo del Estado?",
      "\u00bfTrabajas y estudias a la vez?",
      "\u00bfTienes alguna discapacidad reconocida?",
      "Me siento seguro en mi barrio durante el d\u00eda",
      "Conf\u00edo en las autoridades de mi distrito",
      "La escuela escucha a los estudiantes",
      "Participo en actividades de mi comunidad",
      "Puedo expresar mi opini\u00f3n libremente",
      "Conozco mis derechos como ciudadano",
      "Las decisiones del municipio me afectan",
      "Me interesa la pol\u00edtica local"
    ),
    paper_group = c(rep("", n_q), rep("bat", 8)),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sino", "sino", rep("esc5", 5)),
    name = c("1", "2", as.character(1:5)),
    label = c("S\u00ed", "No", "Totalmente en desacuerdo", "En desacuerdo",
              "Indiferente", "De acuerdo", "Totalmente de acuerdo"),
    stringsAsFactors = FALSE
  )
  list(survey = survey, choices = choices,
       matrix_groups = list(list(members = paste0("m", 1:8),
                                 tenor = "Grado de acuerdo", special = "auto")))
}

# `pdftotext`, con la trampa de este item cerrada: **poppler-utils SI esta en el
# CI** desde `918aded84` (`.github/workflows/quality.yml:175`). Si el binario
# falta EN CI no es que "no se pueda medir": es que alguien lo quito del
# workflow, y saltarse el test ahi apagaria el gate en silencio — verde por
# ausencia. En CI falla; en local, donde puede faltar de verdad, se salta.
.form_gate_pdftotext <- function() {
  bin <- Sys.which("pdftotext")
  if (nzchar(bin)) return(bin)
  if (nzchar(Sys.getenv("CI"))) {
    testthat::fail(paste(
      "pdftotext no esta en el PATH del CI. poppler-utils es dependencia",
      "declarada del workflow (quality.yml): si desaparecio, el gate del §4",
      "se habria apagado en silencio. No se salta."
    ))
  }
  testthat::skip("pdftotext no esta disponible (entorno local sin poppler-utils)")
}

# Palabras del PDF con su caja, en coordenadas NPC de la pagina (0-1, origen
# abajo-izquierda, como las que usa el propio renderer). `pdftotext -bbox`
# devuelve XHTML con `<page width height>` y `<word xMin yMin xMax yMax>`; sus
# `y` crecen hacia ABAJO, asi que se voltean aqui una sola vez.
.form_gate_palabras <- function(path) {
  bin <- .form_gate_pdftotext()
  xhtml <- system2(bin, c("-bbox", shQuote(path), "-"), stdout = TRUE)
  doc <- xml2::read_xml(paste(xhtml, collapse = "\n"))
  ns <- xml2::xml_ns(doc)
  paginas <- xml2::xml_find_all(doc, "//d1:page", ns)
  filas <- lapply(seq_along(paginas), function(i) {
    p <- paginas[[i]]
    W <- as.numeric(xml2::xml_attr(p, "width"))
    H <- as.numeric(xml2::xml_attr(p, "height"))
    w <- xml2::xml_find_all(p, ".//d1:word", ns)
    if (!length(w)) return(NULL)
    data.frame(
      page = i, texto = xml2::xml_text(w),
      x0 = as.numeric(xml2::xml_attr(w, "xMin")) / W,
      x1 = as.numeric(xml2::xml_attr(w, "xMax")) / W,
      y0 = 1 - as.numeric(xml2::xml_attr(w, "yMax")) / H,
      y1 = 1 - as.numeric(xml2::xml_attr(w, "yMin")) / H,
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, filas)
}

# Marco de pagina, en NPC. Sale del mobiliario que dibuja el propio renderer
# (`formulario_pdf_render` y `.form_pdf_header`/`.form_pdf_footer`): la regla
# del encabezado va de x 0.052 a 0.930, las casillas del n.º de cuestionario
# llegan a y 0.982 y el texto del pie se centra en y 0.034. El marco es ese
# mobiliario con holgura; lo que se salga de aqui **no esta en la pagina
# impresa**, que es el accidente que este gate busca.
#
# Mide el MARCO, no la columna: el mobiliario (cabecera y pie) vive fuera de la
# caja de texto del cuerpo a proposito, asi que exigir la caja del cuerpo a
# todas las palabras seria un falso positivo garantizado.
.FORM_GATE_MARCO <- list(x0 = 0.045, x1 = 0.940, y0 = 0.025, y1 = 0.990)

.form_gate_fuera_del_marco <- function(pal, marco = .FORM_GATE_MARCO) {
  fuera <- pal$x0 < marco$x0 | pal$x1 > marco$x1 |
    pal$y0 < marco$y0 | pal$y1 > marco$y1
  pal[fuera, , drop = FALSE]
}

# Palabra mas larga de una etiqueta (>= 5 caracteres): sirve de ancla para
# localizar esa etiqueta en el PDF. **No se busca la etiqueta entera como
# cadena**: dentro de la cabecera de una matriz cada celda se envuelve en varias
# lineas y `pdftotext` las devuelve intercaladas con las celdas vecinas
# ("Totalmente En Indiferente De Totalmente / en desacuerdo ..."), asi que una
# busqueda por frase contigua no encuentra NADA y daria verde por ausencia.
.form_gate_ancla <- function(texto) {
  ws <- strsplit(gsub("[^[:alnum:]À-ÿ ]", " ", texto), "\\s+")[[1]]
  ws <- ws[nchar(ws) >= 5L]
  if (!length(ws)) return(NA_character_)
  ws[which.max(nchar(ws))]
}

.form_gate_paginas_con <- function(pal, palabra) {
  if (is.na(palabra)) return(integer(0))
  sort(unique(pal$page[startsWith(pal$texto, palabra)]))
}

# Paginas que comparten TODOS los items de la matriz y sus dos anclas de escala.
# Si la matriz esta entera, la interseccion tiene al menos una pagina; si la
# cabecera quedo en una pagina y los items en la siguiente, queda vacia.
.form_gate_paginas_comunes <- function(pal, textos) {
  comun <- NULL
  for (t in textos) {
    pg <- .form_gate_paginas_con(pal, .form_gate_ancla(t))
    comun <- if (is.null(comun)) pg else intersect(comun, pg)
  }
  if (is.null(comun)) integer(0) else comun
}

test_that("item 11: las categorias con asteriscos llegan literales al PDF", {
  # Nacio en rojo, por el mismo defecto que en Word: el modelo conservaba la
  # etiqueta y el renderer PDF la volvia a limpiar al dibujarla. Rojo literal:
  #   Failure: categoria que no llego literal al PDF: De 5* a 10*
  #   Failure: categoria que no llego literal al PDF: Nota al pie (*)
  #   Failure: categoria que no llego literal al PDF: 3 * a la semana
  # Reparado en `f28f84f02`. Se mide sobre el ARTEFACTO: es el unico sitio donde
  # la regla innegociable («las categorias existentes no se tocan») se cumple o
  # no, y el gate anterior nunca llegaba hasta ahi.
  #
  # LAS DOS MITADES DEL INVARIANTE VIVEN JUNTAS, y por eso el enunciado con
  # markdown esta en el MISMO test: «la categoria se conserva **y** el enunciado
  # se limpia». Comprobar solo la primera mitad deja la suite verde si alguien
  # "arregla" esto volviendo inocua la limpieza para todo, que es romper la
  # separacion por el otro lado.
  survey <- data.frame(
    type = "select_one frec", name = "q1",
    label = "¿Cuántas veces **comes** fruta? Usa `código` exacto",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("frec", 3), name = c("1", "2", "3"),
    label = c("De 5* a 10*", "Nota al pie (*)", "3 * a la semana"),
    stringsAsFactors = FALSE
  )
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = list(form_title = "Categorias"),
                         output_file = tmp, options = list(columns = 1))
  pdftotext <- .form_gate_pdftotext()
  txt <- paste(system2(pdftotext, c(shQuote(tmp), "-"), stdout = TRUE), collapse = "\n")

  # Mitad 1: la CATEGORIA se conserva tal cual.
  for (lbl in choices$label) {
    expect_true(grepl(lbl, txt, fixed = TRUE),
                info = sprintf("categoria que no llego literal al PDF: %s", lbl))
  }
  # Mitad 2 (control inverso): el ENUNCIADO se desmarca.
  expect_true(grepl("comes", txt, fixed = TRUE))
  expect_true(grepl("código", txt, fixed = TRUE))
  expect_false(grepl("**comes**", txt, fixed = TRUE),
               label = "el enunciado conserva el markdown `**`")
  expect_false(grepl("`código`", txt, fixed = TRUE),
               label = "el enunciado conserva los backticks")
})

test_that("gate §4: ninguna palabra del PDF cae fuera del marco de pagina", {
  fx <- .form_gate_fixture()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(
    fx$survey, fx$choices, settings = list(form_title = "Gate de caja"),
    output_file = tmp, options = list(columns = 1, matrix_groups = fx$matrix_groups)
  )
  pal <- .form_gate_palabras(tmp)
  expect_gt(nrow(pal), 50L)          # sin palabras no hay nada que medir
  expect_gte(max(pal$page), 2L)      # y con una sola pagina el gate no discrimina

  fuera <- .form_gate_fuera_del_marco(pal)
  expect_identical(
    nrow(fuera), 0L,
    info = if (nrow(fuera)) paste(
      sprintf("pag %d «%s» x[%.3f, %.3f] y[%.3f, %.3f]",
              fuera$page, fuera$texto, fuera$x0, fuera$x1, fuera$y0, fuera$y1),
      collapse = "\n") else ""
  )
})

test_that("gate §4 (auto-verificacion): el detector de marco ve una palabra fuera de caja", {
  # Un gate que nunca ha visto un rojo no es un gate. Aqui se le fabrica el rojo
  # con un PDF de verdad —dos palabras dibujadas a proposito fuera del marco— en
  # vez de suponer que discriminaria.
  fab <- tempfile(fileext = ".pdf")
  grDevices::pdf(fab, paper = "a4", width = 8.27, height = 11.69, onefile = TRUE)
  grid::grid.newpage()
  grid::grid.text("DENTRO", x = grid::unit(0.5, "npc"), y = grid::unit(0.5, "npc"))
  grid::grid.text("DERRAMADA", x = grid::unit(0.965, "npc"), y = grid::unit(0.5, "npc"),
                  just = c("left", "center"))
  grid::grid.text("HUNDIDA", x = grid::unit(0.5, "npc"), y = grid::unit(0.008, "npc"))
  grDevices::dev.off()

  pal <- .form_gate_palabras(fab)
  fuera <- .form_gate_fuera_del_marco(pal)
  # «DERRAMADA» llega recortada («DERRA»): el borde de la pagina se come los
  # glifos que no caben, y eso es precisamente lo que el gate existe para ver —
  # la palabra no esta "un poco fuera", esta perdida a medias en el papel.
  expect_length(fuera$texto, 2L)
  expect_true(any(startsWith(fuera$texto, "DERRA")))
  expect_true("HUNDIDA" %in% fuera$texto)
  expect_false("DENTRO" %in% fuera$texto)
})

test_that("gate §4: ninguna matriz reparte cabecera e items entre dos paginas", {
  # Lo que rompe un instrumento en papel no es que el texto llegue al pie: es
  # que la cabecera de la escala quede en una pagina y los items en la
  # siguiente, porque el encuestador pierde los rotulos y la bateria es
  # inservible (item 3 del checklist, medido aqui sobre el artefacto).
  fx <- .form_gate_fixture()
  opciones <- list(columns = 1, matrix_groups = fx$matrix_groups)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, settings = list(form_title = "Gate de caja"),
                         output_file = tmp, options = opciones)
  model <- formulario_pdf_build_model(fx$survey, fx$choices,
                                      settings = list(form_title = "Gate de caja"),
                                      options = opciones)
  pal <- .form_gate_palabras(tmp)

  matrices <- Filter(function(b) identical(b$kind, "matrix"), model$blocks)
  expect_gt(length(matrices), 0L)
  for (b in matrices) {
    part <- .form_pdf_matrix_partition_options(b$options, b$special_override %||% "auto")
    # Las dos anclas de escala se imprimen en los dos modos de cabecera
    # ("categorias" y "extremos"); las intermedias, solo en uno.
    anclas <- c(part$scale[[1]]$label, part$scale[[length(part$scale)]]$label)
    items <- vapply(b$items, function(it) it$label %||% "", character(1))
    comun <- .form_gate_paginas_comunes(pal, c(anclas, items))
    expect_gte(
      length(comun), 1L,
      label = sprintf("la matriz «%s» reparte cabecera e items entre paginas distintas",
                      b$title %||% b$tenor %||% "")
    )
  }
})

test_that("gate §4 (auto-verificacion): el detector ve una matriz repartida en dos paginas", {
  # Rojo fabricado sobre el predicado: la cabecera en la pagina 1 y los items en
  # la 2 es exactamente el accidente que el gate promete detectar.
  partida <- data.frame(
    page = c(1L, 1L, 2L, 2L),
    texto = c("Totalmente", "desacuerdo", "autoridades", "estudiantes"),
    x0 = 0.1, x1 = 0.2, y0 = 0.5, y1 = 0.52, stringsAsFactors = FALSE
  )
  entera <- transform(partida, page = c(2L, 2L, 2L, 2L))
  textos <- c("Totalmente en desacuerdo", "Confío en las autoridades",
              "La escuela escucha a los estudiantes")

  expect_length(.form_gate_paginas_comunes(partida, textos), 0L)
  expect_identical(.form_gate_paginas_comunes(entera, textos), 2L)
})

# --- Regresion del renderer PDF (GOAL replica Ser Adolescente) ----------------
#
# Todo el trabajo visual del PDF —monocromo, rejilla, pie «N de M», columna del
# numero, fila horizontal— no tenia NI UN test propio: la suite cubria el modelo
# y el gate del §4, y un motor sin regresion vuelve atras solo.
#
# Se mide el ARTEFACTO, nunca el modelo. Esa leccion costo un falso verde de 216
# aserciones: el modelo conservaba `De 5* a 10*` y el papel imprimia `De 5 a 10`.

# Rasteriza una pagina del PDF y devuelve la matriz RGB. `pdftoppm` viene con
# poppler, que el CI instala desde 918aded84.
.form_pdf_raster <- function(path, pagina = 1L, dpi = 110) {
  bin <- Sys.which("pdftoppm")
  if (!nzchar(bin)) {
    if (nzchar(Sys.getenv("CI"))) testthat::fail("pdftoppm no esta disponible en el CI")
    testthat::skip("pdftoppm no esta disponible (entorno local sin poppler-utils)")
  }
  pre <- tempfile()
  system2(bin, c("-r", dpi, "-png", "-f", pagina, "-l", pagina, shQuote(path), shQuote(pre)))
  f <- list.files(dirname(pre), pattern = paste0("^", basename(pre)), full.names = TRUE)
  if (!length(f)) testthat::fail("pdftoppm no genero ninguna imagen")
  png::readPNG(f[[1]])
}

.form_pdf_fixture_demo <- function() {
  survey <- data.frame(
    type = c("begin_group", "integer", "select_one sexo", "select_one nivel", "end_group"),
    name = c("g", "edad", "sexo", "nivel", "ge"),
    label = c("A. DATOS", "¿Cuántos años cumplidos tienes?", "Sexo",
              "¿Cuál es el último nivel educativo que aprobaste?", ""),
    stringsAsFactors = FALSE
  )
  choices <- rbind(
    data.frame(list_name = "sexo", name = c("1", "2"), label = c("Mujer", "Hombre"),
               stringsAsFactors = FALSE),
    data.frame(list_name = "nivel", name = as.character(1:5),
               label = c("Sin nivel", "Primaria", "Secundaria", "Superior técnica",
                         "Superior universitaria"), stringsAsFactors = FALSE)
  )
  list(survey = survey, choices = choices)
}

test_that("PDF: el instrumento es monocromo salvo el logo", {
  fx <- .form_pdf_fixture_demo()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, settings = list(form_title = "Monocromo"),
                         output_file = tmp, options = list(columns = "auto"))
  img <- .form_pdf_raster(tmp)
  h <- dim(img)[1]; w <- dim(img)[2]
  sat <- abs(img[, , 1] - img[, , 2]) + abs(img[, , 2] - img[, , 3])
  coloreados <- which(sat > 0.05, arr.ind = TRUE)
  # El logo SI lleva color, y es correcto: la referencia tambien. Vive en la
  # esquina superior izquierda; fuera de ahi no puede haber un solo pixel de color.
  fuera_del_logo <- coloreados[
    coloreados[, 1] > h * 0.11 | coloreados[, 2] > w * 0.22, , drop = FALSE]
  expect_identical(nrow(fuera_del_logo), 0L,
                   label = "pixeles con color fuera del area del logo")
})

test_that("PDF: las filas de opciones se separan por LINEA, no por relleno", {
  # Etiquetas LARGAS a proposito: con opciones cortas el motor las pone en una
  # sola fila horizontal (L8) y entonces no hay filas que separar. El fixture
  # tiene que forzar la lista vertical, que es donde vive la rejilla.
  survey <- data.frame(
    type = "select_one largo", name = "q", label = "Pregunta de lista larga",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = "largo", name = as.character(1:4),
    label = c("Primera alternativa de la lista con texto largo",
              "Segunda alternativa de la lista con texto largo",
              "Tercera alternativa de la lista con texto largo",
              "Cuarta alternativa de la lista con texto largo"),
    stringsAsFactors = FALSE
  )
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = list(form_title = "Rejilla"),
                         output_file = tmp, options = list(columns = 1))
  pal <- .form_gate_palabras(tmp)
  a <- pal[pal$texto == "Segunda", , drop = FALSE]
  b <- pal[pal$texto == "Tercera", , drop = FALSE]
  expect_identical(nrow(a), 1L); expect_identical(nrow(b), 1L)

  # OJO AL EJE. `.form_gate_palabras()` normaliza con `1 - yMax/H`, es decir mide
  # DESDE ABAJO: una palabra mas baja en la pagina tiene `y` MENOR. La imagen de
  # `pdftoppm`, en cambio, se indexa desde arriba. Confundirlos deja la banda
  # invertida y el test rojo sobre un motor que dibuja la linea perfectamente.
  expect_lt(b$y1, a$y0)   # "Tercera" va DEBAJO: son dos filas, no una horizontal

  img <- .form_pdf_raster(tmp)
  gris <- (img[, , 1] + img[, , 2] + img[, , 3]) / 3
  h <- nrow(gris); w <- ncol(gris)
  # Banda estrictamente ENTRE las dos etiquetas, ya en filas de pixel (desde
  # arriba): del pie de la de arriba a la cabeza de la de abajo.
  y0 <- round((1 - a$y0) * h) + 2L
  y1 <- round((1 - b$y1) * h) - 2L
  expect_gt(y1, y0)
  franja <- gris[seq(y0, y1), seq(round(w * 0.10), round(w * 0.50)), drop = FALSE]
  # Binarizado a 1 BIT con umbral 200: es lo que sobrevive a una fotocopia, que
  # es el motivo entero de la rejilla — el relleno F2F2F2 desaparece ahi.
  oscuro <- franja < (200 / 255)
  corrida <- apply(oscuro, 1, function(fila) {
    r <- rle(fila); if (!any(r$values)) 0L else max(r$lengths[r$values])
  })
  expect_gt(max(corrida), ncol(oscuro) * 0.9)
})

test_that("PDF: el pie dice «N de M» y M es el total real de paginas", {
  fx <- .form_gate_fixture()
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, settings = list(form_title = "Folio"),
                         output_file = tmp,
                         options = list(columns = 1, matrix_groups = fx$matrix_groups))
  pal <- .form_gate_palabras(tmp)
  total <- max(pal$page)
  # En un PDF de `grid` el total NO es un campo que resuelva el lector: lo cuenta
  # el motor en una primera pasada. Si esa pasada se rompe, aqui se ve.
  for (p in seq_len(total)) {
    txt <- paste(pal$texto[pal$page == p], collapse = " ")
    expect_true(grepl(sprintf("%d de %d", p, total), txt, fixed = TRUE),
                label = sprintf("pie de la pagina %d", p))
  }
})

test_that("PDF: el numero del item vive en su columna, no pegado a la etiqueta", {
  # Fixture SIN tenor: los items se numeran 6..15, con una y dos cifras. Con
  # tenor se subnumeran 1.1/1.2 y todos los numeros miden lo mismo, con lo que
  # el defecto no se puede ver.
  n <- 10L
  survey <- data.frame(
    type = rep("select_one sino", n),
    name = paste0("m", seq_len(n)),
    label = sprintf("Afirmacion numero %d del bloque", seq_len(n)),
    paper_group = rep("bat", n),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = "sino", name = c("1", "2"),
                        label = c("S\u00ed", "No"), stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = list(form_title = "Numeros"),
                         output_file = tmp,
                         options = list(columns = 1,
                                        matrix_groups = list(list(members = paste0("m", seq_len(n)),
                                                                  tenor = "", special = "auto"))))
  pal <- .form_gate_palabras(tmp)

  # La discriminacion: con columna propia, la etiqueta arranca SIEMPRE en la
  # misma x, tenga el numero una cifra o dos. Pegado a la etiqueta, la x se
  # desplazaba con el ancho del numero — por eso los enunciados no alineaban.
  etiq <- pal[pal$texto == "Afirmacion", , drop = FALSE]
  expect_gte(nrow(etiq), 9L)
  expect_lt(max(etiq$x0) - min(etiq$x0), 0.002,
            label = "desviacion de la x donde arranca la etiqueta entre filas")

  # Y el numero va a su izquierda, no dentro.
  for (i in seq_len(nrow(etiq))) {
    izq <- pal[pal$page == etiq$page[i] &
                 abs(pal$y0 - etiq$y0[i]) < 0.004 &
                 pal$x1 <= etiq$x0[i], , drop = FALSE]
    expect_gt(nrow(izq), 0L)
    expect_true(grepl("^[0-9]{1,2}$", izq$texto[which.max(izq$x1)]),
                label = sprintf("lo que precede a la etiqueta en la fila %d", i))
  }
})

test_that("B4: la rejilla del PDF sobrevive al umbral DURO de la copiadora", {
  # Hermano del test de Word. El test de rejilla de mas arriba binariza a 200 y
  # por eso NO discrimina: el gris A6A6A6 de la referencia (luma 166) tambien lo
  # pasa. Una copiadora tipica corta mas abajo, y medido sobre el instrumento de
  # ejemplo la rejilla gris desaparecia entera por debajo de 166. Aqui el umbral
  # es 128: solo pasa una linea realmente negra.
  survey <- data.frame(
    type = "select_one largo", name = "q", label = "Pregunta de lista larga",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = "largo", name = as.character(1:4),
    label = c("Primera alternativa de la lista con texto largo",
              "Segunda alternativa de la lista con texto largo",
              "Tercera alternativa de la lista con texto largo",
              "Cuarta alternativa de la lista con texto largo"),
    stringsAsFactors = FALSE
  )
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = list(form_title = "Rejilla dura"),
                         output_file = tmp, options = list(columns = 1))
  pal <- .form_gate_palabras(tmp)
  a <- pal[pal$texto == "Segunda", , drop = FALSE]
  b <- pal[pal$texto == "Tercera", , drop = FALSE]
  expect_identical(nrow(a), 1L); expect_identical(nrow(b), 1L)

  img <- .form_pdf_raster(tmp)
  gris <- (img[, , 1] + img[, , 2] + img[, , 3]) / 3
  h <- nrow(gris); w <- ncol(gris)
  # `.form_gate_palabras()` mide DESDE ABAJO y `pdftoppm` indexa DESDE ARRIBA.
  y0 <- round((1 - a$y0) * h) + 2L
  y1 <- round((1 - b$y1) * h) - 2L
  expect_gt(y1, y0)
  franja <- gris[seq(y0, y1), seq(round(w * 0.10), round(w * 0.50)), drop = FALSE]
  oscuro <- franja < (128 / 255)
  corrida <- apply(oscuro, 1, function(fila) {
    r <- rle(fila); if (!any(r$values)) 0L else max(r$lengths[r$values])
  })
  expect_gt(max(corrida), ncol(oscuro) * 0.9)
})

.form_pdf_fixture_tenor <- function(tenor) {
  list(
    survey = data.frame(
      type = rep("select_one ac", 4L), name = paste0("a", 1:4),
      label = c("Me siento satisfecho conmigo mismo.",
                "Creo que tengo buenas cualidades.",
                "Soy capaz de hacer las cosas tan bien como los demas.",
                "A veces pienso que no sirvo para nada."),
      stringsAsFactors = FALSE),
    choices = data.frame(
      list_name = "ac", name = as.character(1:4),
      label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
      stringsAsFactors = FALSE),
    settings = list(form_title = "L16"),
    options = list(columns = 1, matrix_groups = list(list(
      members = paste0("a", 1:4), tenor = tenor)))
  )
}

test_that("L16: el enunciado comparte banda con la escala, no vive encima de ella", {
  tenor <- "Por favor senala que tan de acuerdo estas con las siguientes afirmaciones:"
  fx <- .form_pdf_fixture_tenor(tenor)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                         options = fx$options)
  pal <- .form_gate_palabras(tmp)
  favor <- pal[pal$texto == "favor", , drop = FALSE]
  tot <- pal[pal$texto == "Totalmente", , drop = FALSE]
  expect_identical(nrow(favor), 1L)
  expect_gte(nrow(tot), 1L)

  # La prueba de que esta DENTRO de la cabecera y no encima: su banda vertical se
  # solapa con la de las etiquetas de escala. Antes el enunciado iba en un
  # parrafo por encima y las dos bandas eran disjuntas. `.form_gate_palabras()`
  # mide DESDE ABAJO (y mayor = mas arriba).
  esc_top <- max(tot$y1); esc_bot <- min(tot$y0)
  expect_lt(favor$y0, esc_top)
  expect_gt(favor$y1, esc_bot)

  # Y la otra mitad, que es la que un test perezoso se salta: CABER NO ES NO
  # PISARSE. El enunciado se queda a la izquierda de la primera columna de
  # escala; si invadiera, se leeria montado sobre las etiquetas.
  expect_lt(favor$x1, min(tot$x0))
})

test_that("L16: el paginado no reserva DOS VECES el enunciado de la matriz", {
  # GUARD, no regresion de L16: el motor anterior tampoco reservaba de mas —
  # reservaba `title_h` porque DIBUJABA el titulo encima. Verificado contra un
  # mutante deliberado (title_h restaurado SOBRE la cabecera ya crecida), que es
  # el error real al que se expone este cambio: dejar la reserva vieja abriria un
  # hueco del alto del enunciado al pie de cada matriz. Contra el motor anterior
  # este test pasa, y decirlo aqui evita que alguien lo lea como cobertura de L16.
  tenor <- paste("Por favor senala que tan de acuerdo estas con cada una de las",
                 "siguientes afirmaciones sobre tu vida cotidiana, marcando un numero",
                 "en la escala segun tu experiencia personal")
  fx <- .form_pdf_fixture_tenor(tenor)
  m <- formulario_pdf_build_model(fx$survey, fx$choices, fx$settings, options = fx$options)
  blk <- Filter(function(b) identical(b$kind, "matrix"), m$blocks)[[1]]
  alto <- .form_pdf_block_height(blk, width = 0.90)

  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(fx$survey, fx$choices, fx$settings, output_file = tmp,
                         options = fx$options)
  pal <- .form_gate_palabras(tmp)
  arriba <- pal[pal$texto == "favor", , drop = FALSE]
  abajo <- pal[pal$texto == "sirvo", , drop = FALSE]   # ultimo item
  expect_identical(nrow(arriba), 1L); expect_identical(nrow(abajo), 1L)
  pintado <- arriba$y1 - abajo$y0

  # La reserva incluye padding y el chip de condicion, asi que no es igual al
  # dibujo; lo que NO puede es doblarlo. Con la reserva duplicada el cociente se
  # iba por encima de 1.6.
  expect_gt(alto, pintado)
  expect_lt(alto / pintado, 1.45)
})

test_that("L17: la subseccion sale de la matriz y pasa a banda propia encima", {
  survey <- data.frame(
    type = c("begin_group", rep("select_one ac", 3L), "end_group"),
    name = c("g", "a1", "a2", "a3", "ge"),
    label = c("B. BIENESTAR", "Me siento satisfecho conmigo mismo.",
              "Creo que tengo buenas cualidades.", "A veces pienso que no sirvo para nada.", ""),
    paper_subgroup = c("", rep("Como te sientes", 3L), ""),
    stringsAsFactors = FALSE)
  choices <- data.frame(
    list_name = "ac", name = as.character(1:4),
    label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
    stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(survey, choices, settings = list(form_title = "L17"),
                         output_file = tmp, options = list(columns = 1))
  pal <- .form_gate_palabras(tmp)
  sub <- pal[toupper(pal$texto) == "SIENTES", , drop = FALSE]
  esc <- pal[pal$texto == "Totalmente", , drop = FALSE]
  expect_identical(nrow(sub), 1L)
  expect_gte(nrow(esc), 1L)

  # La prueba de que SALIO de la matriz: hasta aqui el sub-grupo se pintaba en la
  # esquina de la cabecera, o sea COMPARTIENDO banda vertical con las etiquetas
  # de escala. Como banda propia las dos franjas son disjuntas y la subseccion
  # queda ENCIMA. Es el mismo criterio que L16 pero al reves, y por eso no se
  # puede comprobar con "aparece el texto": aparecia antes tambien.
  # `.form_gate_palabras()` mide DESDE ABAJO: y mayor = mas arriba.
  expect_gt(sub$y0, max(esc$y1))

  # Y esta dentro de una caja mas clara que la de seccion, no sobre papel blanco.
  img <- .form_pdf_raster(tmp)
  gris <- (img[, , 1] + img[, , 2] + img[, , 3]) / 3
  h <- nrow(gris); w <- ncol(gris)
  fondo <- function(fila) {
    y <- round((1 - fila) * h)
    franja <- gris[max(1L, y - 1L):min(h, y + 1L), round(w * 0.72):round(w * 0.92), drop = FALSE]
    stats::median(franja)   # lejos del texto: mide el RELLENO, no las letras
  }
  bienestar <- pal[pal$texto == "BIENESTAR", , drop = FALSE]
  expect_identical(nrow(bienestar), 1L)
  g_sub <- fondo((sub$y0 + sub$y1) / 2)
  g_sec <- fondo((bienestar$y0 + bienestar$y1) / 2)
  expect_lt(g_sub, 0.99)          # tiene relleno: no es papel blanco
  expect_gt(g_sub, g_sec + 0.01)  # y es MAS CLARO que el de seccion
})
