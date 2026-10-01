test_that("la nota de significancia de cruces sale con tildes y sin punto medio", {
  skip_if_not_installed("readxl")

  set.seed(1)
  data <- data.frame(
    p1 = c(rep("a", 80), rep("b", 20), rep("a", 30), rep("b", 70)),
    sexo = c(rep("m", 100), rep("h", 100)),
    stringsAsFactors = FALSE
  )
  instrumento <- list(
    survey = data.frame(
      name = c("p1", "sexo"),
      type = c("select_one si_no", "select_one sexo"),
      label = c("Pregunta 1", "Sexo"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("si_no", "si_no", "sexo", "sexo"),
      name = c("a", "b", "m", "h"),
      label = c("Sí", "No", "Mujer", "Hombre"),
      stringsAsFactors = FALSE
    )
  )

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  reporte_cruces(
    data = data,
    instrumento = instrumento,
    SECCIONES = list(General = "p1"),
    cruces = "sexo",
    path_xlsx = out,
    show_sig = TRUE
  )

  raw <- readxl::read_excel(out, col_names = FALSE)
  vals <- as.character(unlist(raw, use.names = FALSE))
  nota <- vals[!is.na(vals) & grepl("Las letras indican", vals, fixed = TRUE)]

  expect_length(nota, 1L)
  expect_match(nota, "cuya proporción es significativamente mayor", fixed = TRUE)
  expect_match(nota, "según pruebas z", fixed = TRUE)
  expect_match(nota, "corrección de Bonferroni", fixed = TRUE)
  expect_match(nota, "comparaciones múltiples", fixed = TRUE)
  expect_match(nota, "«.a» indica categoría excluida", fixed = TRUE)
  expect_match(nota, "Sexo: (A) Mujer, (B) Hombre", fixed = TRUE)
  expect_false(grepl("·", nota, fixed = TRUE))
  expect_false(grepl("\\b(segun|correccion|multiples|categoria|proporcion)\\b", nota, perl = TRUE))
})
