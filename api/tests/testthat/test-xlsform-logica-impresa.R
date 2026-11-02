# L36 · D-L36-20 — la lógica tal como sale en papel (xlsform_logica_impresa.R): instrucciones del mismo modelo que
# dibujan Word y PDF, sin código crudo, y con los avisos del motor.

.logica_demo <- function() {
  f <- test_path("..", "..", "inst", "samples", "demo_instrumento.xlsx")
  skip_if_not(file.exists(f))
  list(survey = as.data.frame(readxl::read_excel(f, sheet = "survey")),
       choices = as.data.frame(readxl::read_excel(f, sheet = "choices")))
}

test_that("los saltos salen junto a su opción, sin código crudo ni casillas de especifique", {
  d <- .logica_demo()
  model <- formulario_pdf_build_model(d$survey, d$choices, list(form_title = "Demo"))
  l <- .cuestionario_logica_impresa(model)
  expect_gt(length(l), 5L)
  tipos <- vapply(l, `[[`, "", "tipo")
  expect_true(all(tipos %in% c("condicion", "salto", "salida")))
  primero <- Filter(function(x) x$nombre == "consent", l)[[1]]
  expect_identical(primero$tipo, "salto")
  expect_identical(primero$opcion, "No (2)")
  textos <- vapply(l, `[[`, "", "texto")
  expect_false(any(grepl("\\$\\{|selected\\(|!=", textos)))
  expect_false(any(grepl("^Especifique", textos)))
})

test_that("con «condiciones» la lógica sale como apertura antes de la pregunta", {
  d <- .logica_demo()
  model <- formulario_pdf_build_model(d$survey, d$choices, list(form_title = "Demo"),
                                      options = list(logic_language = "condiciones"))
  l <- .cuestionario_logica_impresa(model)
  expect_true(any(vapply(l, `[[`, "", "tipo") == "condicion"))
  expect_false(any(vapply(l, `[[`, "", "tipo") == "salida"))
})

test_that("el endpoint arma la lista desde el workbook del editor y avisa si no puede", {
  d <- .logica_demo()
  a_payload <- function(df) list(columns = as.list(names(df)),
                                 rows = lapply(seq_len(nrow(df)), function(i) as.list(vapply(df[i, ], function(v) if (is.na(v)) "" else as.character(v), ""))))
  wb <- list(survey = a_payload(d$survey), choices = a_payload(d$choices),
             settings = list(columns = list("form_title"), rows = list(list("Demo"))))
  r <- xlsform_logica_impresa(wb, list(logic_language = "saltos"))
  expect_true(r$ok)
  expect_identical(r$lenguaje, "saltos")
  expect_gt(length(r$instrucciones), 5L)
  expect_type(unclass(r$avisos), "character")
})
