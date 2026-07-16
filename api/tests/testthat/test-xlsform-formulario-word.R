test_that("reporte_formulario_word genera un .docx valido con portada, secciones, matrices y logica", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")

  survey <- data.frame(
    type = c(
      "begin_group",
      "select_one esc_sino", "select_one esc_sino", "select_one esc_sino",
      "select_one esc_ac", "select_one esc_ac", "select_one esc_ac",
      "text",
      "select_one nivel",
      "end_group"
    ),
    name = c("g1", "p_si1", "p_si2", "p_si3", "p_ac1", "p_ac2", "p_ac3",
             "p_abierta", "p_nivel", "g1e"),
    label = c(
      "Misión y propósitos",
      "Conoce la misión y los propósitos de la PUCP. [entiéndase los propósitos como: lineamientos que orientan el quehacer de la universidad y guían su desarrollo]",
      "Sé dónde consultar la misión y los propósitos de la PUCP.",
      "Conoce los propósitos de la Unidad (Facultad de Arte y Diseño).",
      "Los propósitos de la Unidad están definidos con claridad.",
      "El estatuto PUCP permite que la Unidad se organice adecuadamente.",
      "La normativa interna es suficiente para la gestión.",
      "¿Qué recomendaría mejorar? (respuesta abierta)",
      "¿Cuál es su nivel de satisfacción general?",
      ""
    ),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("esc_sino", "esc_sino",
                  "esc_ac", "esc_ac", "esc_ac", "esc_ac", "esc_ac",
                  "nivel", "nivel", "nivel"),
    name  = c("1", "2", "1", "2", "3", "4", "9", "1", "2", "3"),
    label = c("Sí", "No",
              "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
              "Bajo", "Medio", "Alto"),
    stringsAsFactors = FALSE
  )
  settings <- list(form_title = "Cuestionario de prueba Word")
  # Agrupa explicitamente las dos matrices (Sí/No y acuerdo con especial).
  mg <- list(
    list(members = c("p_si1", "p_si2", "p_si3"), tenor = "", special = "auto"),
    list(members = c("p_ac1", "p_ac2", "p_ac3"), tenor = "", special = "auto")
  )
  out <- tempfile(fileext = ".docx")
  res <- reporte_formulario_word(
    survey = survey, choices = choices, settings = settings, output_file = out,
    options = list(columns = 1, logic_language = "conditions", matrix_groups = mg,
                   show_header_title = FALSE, show_questionnaire_number = FALSE)
  )

  expect_true(file.exists(out))
  expect_gt(file.info(out)$size, 0)
  expect_identical(res$path, out)

  doc <- officer::read_docx(out)
  txt <- paste(officer::docx_summary(doc)$text, collapse = "\n")

  # Portada + sección
  expect_true(grepl("Cuestionario de prueba Word", txt, fixed = TRUE))
  expect_true(grepl("MISIÓN Y PROPÓSITOS", toupper(txt), fixed = TRUE))
  # Etiquetas de items de matriz (filas)
  expect_true(grepl("Sé dónde consultar la misión", txt, fixed = TRUE))
  # Códigos de escala presentes (matriz)
  expect_true(grepl("Sí", txt, fixed = TRUE) && grepl("No", txt, fixed = TRUE))
  expect_true(grepl("SIN INF", txt, fixed = TRUE))
  # Pregunta abierta y select_one suelta
  expect_true(grepl("recomendaría mejorar", txt, fixed = TRUE))
  expect_true(grepl("nivel de satisfacción", txt, fixed = TRUE))
})

test_that("matriz en modo extremos reparte las anclas en celdas separadas (split mitad/mitad con alineacion por polo)", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  skip_if_not_installed("xml2")

  # Escala de 5 puntos SIN columna especial: el split debe dar 3 columnas al
  # polo izquierdo (ceiling(5/2)) y 2 al derecho.
  survey <- data.frame(
    type = rep("select_one esc5", 3),
    name = c("m1", "m2", "m3"),
    label = c("Item uno", "Item dos", "Item tres"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("esc5", 5),
    name = as.character(1:5),
    label = c("Totalmente en desacuerdo", "En desacuerdo", "Indiferente",
              "De acuerdo", "Totalmente de acuerdo"),
    stringsAsFactors = FALSE
  )
  mg <- list(list(members = c("m1", "m2", "m3"), tenor = "", special = "auto",
                  header = "extremos"))
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(
    survey = survey, choices = choices,
    settings = list(form_title = "Matriz extremos"), output_file = out,
    options = list(columns = 1, logic_language = "conditions", matrix_groups = mg,
                   show_header_title = FALSE, show_questionnaire_number = FALSE)
  )
  expect_true(file.exists(out) && file.info(out)$size > 0)

  # El .docx es un zip: extraemos word/document.xml y leemos la fila de
  # cabecera de la matriz (primera w:tr de la tabla).
  xml_dir <- tempfile("docx_xml_")
  utils::unzip(out, files = "word/document.xml", exdir = xml_dir)
  doc_xml <- xml2::read_xml(file.path(xml_dir, "word", "document.xml"))
  ns <- xml2::xml_ns(doc_xml)
  header_cells <- xml2::xml_find_all(doc_xml, "(//w:tbl)[1]/w:tr[1]/w:tc", ns)
  cell_text <- vapply(header_cells, function(tc) {
    paste(xml2::xml_text(xml2::xml_find_all(tc, ".//w:t", ns)), collapse = "")
  }, character(1))

  i_left  <- which(cell_text == "Totalmente en desacuerdo")
  i_right <- which(cell_text == "Totalmente de acuerdo")
  # Cada polo en su PROPIA celda (no un unico run "A — B" que abarca todo).
  expect_length(i_left, 1L)
  expect_length(i_right, 1L)
  expect_true(i_left != i_right)
  expect_false(any(grepl("—", cell_text, fixed = TRUE)))

  grid_span <- function(tc) {
    xml2::xml_attr(xml2::xml_find_first(tc, "./w:tcPr/w:gridSpan", ns), "val")
  }
  jc_val <- function(tc) {
    xml2::xml_attr(xml2::xml_find_first(tc, ".//w:pPr/w:jc", ns), "val")
  }
  # Split mitad/mitad: la impar va al polo izquierdo (ceiling), 3 + 2 = 5.
  expect_identical(grid_span(header_cells[[i_left]]), "3")
  expect_identical(grid_span(header_cells[[i_right]]), "2")
  # Cada ancla pegada a su extremo.
  expect_identical(jc_val(header_cells[[i_left]]), "left")
  expect_identical(jc_val(header_cells[[i_right]]), "right")
})

test_that("reporte_formulario_word respeta el lenguaje de saltos", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")

  survey <- data.frame(
    type = c("select_one sino", "select_one nivel"),
    name = c("consiente", "p2"),
    label = c("¿Acepta participar?", "Pregunta siguiente"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sino", "sino", "nivel", "nivel"),
    name = c("1", "2", "1", "2"),
    label = c("Sí", "No", "A", "B"),
    stringsAsFactors = FALSE
  )
  out <- tempfile(fileext = ".docx")
  expect_no_error(
    reporte_formulario_word(
      survey = survey, choices = choices, settings = list(form_title = "Saltos"),
      output_file = out, options = list(logic_language = "saltos")
    )
  )
  expect_true(file.exists(out) && file.info(out)$size > 0)
})

test_that("reporte_formulario_word rinde end-to-end desde la Matriz PULSO IAC-CINDA", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  xlsx <- testthat::test_path("..", "..", "inst", "samples", "acreditacion", "matriz_pulso_iac_cinda.xlsx")
  skip_if_not(file.exists(xlsx), "sample matriz_pulso_iac_cinda.xlsx no disponible")

  wb <- matriz_pulso_to_workbook(xlsx, "Docentes")
  out <- tempfile(fileext = ".docx")
  res <- reporte_formulario_word(
    survey = wb$survey, choices = wb$choices, settings = wb$settings, output_file = out,
    options = list(columns = 1, logic_language = "conditions",
                   show_header_title = FALSE, show_questionnaire_number = FALSE)
  )
  expect_true(file.exists(out) && file.info(out)$size > 0)
  expect_gt(res$summary$n_questions, 0)
  doc <- officer::read_docx(out)
  txt <- paste(officer::docx_summary(doc)$text, collapse = "\n")
  expect_true(grepl("Docentes", txt, fixed = TRUE))
})
