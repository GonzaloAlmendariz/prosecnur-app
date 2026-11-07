# Tabla markdown en una nota del cuestionario impreso (E8c editor-conjoint).
# Mata: la tabla de perfiles de un conjoint impresa con sus barras, una nota sin tabla tratada como
# tabla, celdas que se corren de columna y una tabla que el paginado del PDF no reserva.

encuesta_con_par <- function() {
  survey <- data.frame(
    type = c("note", "select_one ab", "note"),
    name = c("par", "eleccion", "suelta"),
    label = c(
      paste("Compare a estas dos personas.",
            "| | Persona A | Persona B |",
            "|---|---|---|",
            "| Edad | 42 | 62 |",
            "| Formación | Realizado en el Perú | Ninguno |",
            "",
            "_Ejemplo: los niveles se sortean en cada entrevista._", sep = "\n"),
      "¿A cuál prefiere?",
      "Una nota con | barras sueltas | sin separadora."
    ),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(list_name = c("ab", "ab"), name = c("1", "2"),
                        label = c("Persona A", "Persona B"), stringsAsFactors = FALSE)
  list(survey = survey, choices = choices, settings = list(form_title = "Conjoint de prueba"))
}

test_that("la tabla se separa del texto y conserva sus celdas", {
  t <- .form_md_tabla_partir(encuesta_con_par()$survey$label[[1]])
  expect_false(is.null(t))
  expect_identical(t$encabezado, c("", "Persona A", "Persona B"))
  expect_identical(t$filas[[2]], c("Formación", "Realizado en el Perú", "Ninguno"))
  expect_match(t$texto, "Compare a estas dos personas.", fixed = TRUE)
  expect_match(t$texto, "Ejemplo: los niveles", fixed = TRUE)
  expect_identical(t$antes, "Compare a estas dos personas.")
  expect_identical(t$despues, "Ejemplo: los niveles se sortean en cada entrevista.")
  expect_false(grepl("|", t$texto, fixed = TRUE))
  expect_null(.form_md_tabla_partir("Una nota con | barras sueltas | sin separadora."))
})

test_that("el modelo del impreso lleva la tabla en la nota y el paginado la reserva", {
  e <- encuesta_con_par()
  model <- formulario_pdf_build_model(e$survey, e$choices, e$settings)
  par <- Filter(function(b) identical(b$name %||% "", "par"), model$blocks)[[1]]
  expect_false(is.null(par$tabla_md))
  expect_false(grepl("|", par$label, fixed = TRUE))
  sin_tabla <- par
  sin_tabla$tabla_md <- NULL
  expect_gt(.form_pdf_block_height(par, 0.9), .form_pdf_block_height(sin_tabla, 0.9) + 0.03)
  suelta <- Filter(function(b) identical(b$name %||% "", "suelta"), model$blocks)[[1]]
  expect_null(suelta$tabla_md)
})

test_that("el Word imprime la tabla como tabla, sin barras", {
  skip_if_not_installed("officer")
  skip_if_not_installed("flextable")
  e <- encuesta_con_par()
  out <- tempfile(fileext = ".docx")
  reporte_formulario_word(e$survey, e$choices, e$settings, output_file = out)
  dir <- tempfile()
  utils::unzip(out, files = "word/document.xml", exdir = dir)
  xml <- paste(readLines(file.path(dir, "word/document.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  texto <- gsub("<[^>]+>", " ", xml)
  expect_true(grepl("Realizado en el Perú", texto, fixed = TRUE))
  expect_false(grepl("|---|", texto, fixed = TRUE))
  expect_false(grepl("| Edad |", texto, fixed = TRUE))
  # La celda «Realizado en el Perú» vive en una fila de tabla (<w:tr>) junto a «Ninguno».
  filas <- regmatches(xml, gregexpr("<w:tr[ >].*?</w:tr>", xml, perl = TRUE))[[1]]
  expect_true(any(grepl("Realizado en el Perú", filas, fixed = TRUE) & grepl("Ninguno", filas, fixed = TRUE)))
  # El rotulo de ejemplo va DEBAJO de la tabla.
  expect_gt(regexpr("Ejemplo: los niveles", texto, fixed = TRUE), regexpr("Ninguno", texto, fixed = TRUE))
  expect_lt(regexpr("Compare a estas dos personas", texto, fixed = TRUE), regexpr("Persona A", texto, fixed = TRUE))
})

test_that("el PDF se genera con la tabla", {
  e <- encuesta_con_par()
  out <- tempfile(fileext = ".pdf")
  reporte_formulario_pdf(e$survey, e$choices, e$settings, output_file = out)
  expect_true(file.exists(out))
  skip_if(!nzchar(Sys.which("pdftotext")), "sin pdftotext")
  txt <- paste(system2("pdftotext", c("-layout", out, "-"), stdout = TRUE), collapse = "\n")
  expect_match(txt, "Realizado en el Perú", fixed = TRUE)
  expect_false(grepl("|---|", txt, fixed = TRUE))
})
