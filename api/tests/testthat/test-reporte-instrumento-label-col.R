# Regresión: detección de columna de label en `reporte_instrumento()`.
#
# `detectar_label_col()` escapaba `lang` con un patrón inline que el motor TRE
# por defecto de R rechaza ("Invalid contents of {}"): las llaves vacías `{}`
# quedaban fuera de la clase de caracteres y TRE las leía como cuantificador de
# intervalo inválido. El `gsub` explotaba cada vez que se alcanzaba esa rama
# (`nzchar(lang)` TRUE y ninguna columna de label previa con datos), p. ej. con
# una hoja `choices` con encabezados pero sin filas de select — el caso de un
# XLSForm/asset Kobo sin preguntas select, alcanzable desde el pipeline de
# importación Kobo y el handoff general. Ahora se usa el helper compartido
# `regex_escape()` (perl = TRUE).

.rlc_write_model <- function(model, path) {
  .carga_write_xlsform_model(model, path)
}

test_that("reporte_instrumento no aborta con choices sin filas (form sin selects)", {
  skip_if_not_installed("openxlsx")

  model <- list(
    survey = data.frame(
      type  = c("text", "integer"),
      name  = c("nombre", "edad"),
      label = c("Nombre completo", "Edad"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    # choices con encabezados estándar pero SIN filas (no hay preguntas select).
    choices = data.frame(
      list_name = character(),
      name      = character(),
      label     = character(),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    settings = data.frame(
      form_title = "Sin selects", form_id = "sin_selects",
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .rlc_write_model(model, path)

  inst <- expect_no_error(reporte_instrumento(path = path, lang = "es"))
  expect_s3_class(inst, "prosecnur_instrumento")
  expect_equal(inst$var_labels[["nombre"]], "Nombre completo")
  expect_equal(inst$var_labels[["edad"]], "Edad")
  # Sin filas de select el diccionario de choices queda vacío, no rompe.
  expect_equal(nrow(inst$choices), 0L)
})

test_that("reporte_instrumento resuelve label desde choices con select real", {
  skip_if_not_installed("openxlsx")

  model <- list(
    survey = data.frame(
      type  = c("select_one lst_sexo", "integer"),
      name  = c("sexo", "edad"),
      label = c("Sexo", "Edad"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_sexo", "lst_sexo"),
      name      = c("1", "2"),
      label     = c("Mujer", "Hombre"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    settings = data.frame(
      form_title = "Con selects", form_id = "con_selects",
      stringsAsFactors = FALSE, check.names = FALSE
    )
  )

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  .rlc_write_model(model, path)

  inst <- expect_no_error(reporte_instrumento(path = path, lang = "es"))
  expect_equal(inst$label_col_choices, "label")
  expect_equal(inst$dicc_code_to_label[["lst_sexo"]][["1"]], "Mujer")
  expect_equal(inst$dicc_code_to_label[["lst_sexo"]][["2"]], "Hombre")
})
