# Aviso de una base que no calza con el formulario (carga_aviso_no_calza.R).
#
# Ítem 25 del checklist de validación del practicante: "faltan 187 de 187
# variable(s) esperada(s)" no decía qué columnas trae la base, qué espera el
# formulario ni qué hacer.

.acnc_instrumento <- function() {
  list(survey = data.frame(
    type = c("integer", "text", "integer", "select_one sn"),
    name = c("nro", "distrito", "edad", "trabaja"),
    label = c("Número de encuesta", "Distrito de residencia", "Edad cumplida", "¿Trabaja actualmente?"),
    stringsAsFactors = FALSE
  ), choices = data.frame(list_name = "sn", name = c("1", "2"), label = c("Sí", "No")))
}

test_that("una base con los textos de las preguntas como encabezado pide renombrarlos", {
  inst <- .acnc_instrumento()
  df <- data.frame(`P0 Número de encuesta` = 1:3, `P1 Distrito de residencia` = "Lima",
                   `P2 Edad cumplida` = 30, `P3 ¿Trabaja actualmente?` = 1, check.names = FALSE)
  compat <- validate_data_xlsform_compatibility(df, inst)
  aviso <- .carga_aviso_no_calza(compat, inst)
  expect_match(aviso$message, "de 4 preguntas, 4 no aparecen", fixed = TRUE)
  # Lo que espera el formulario y lo que trae la base, con ejemplos.
  expect_match(aviso$message, "\"nro\", \"distrito\", \"edad\" y \"trabaja\"", fixed = TRUE)
  expect_match(aviso$message, "La base trae 4 columnas, como \"P0 Número de encuesta\"", fixed = TRUE)
  # Qué hacer, con su causa.
  expect_match(aviso$message, "4 de 4 encabezados de la base coinciden con el texto de una pregunta", fixed = TRUE)
  expect_match(aviso$message, "empareja la base por el texto de las preguntas o renombra sus encabezados", fixed = TRUE)
  expect_identical(aviso$details$n_por_rotulo, 4L)
})

test_that("una base de otro formulario dice que el formulario no es de esta base", {
  inst <- .acnc_instrumento()
  df <- data.frame(id = 1:3, ciudad = "Lima", ingreso = 1200)
  aviso <- .carga_aviso_no_calza(validate_data_xlsform_compatibility(df, inst), inst)
  expect_match(aviso$message, "La base trae 3 columnas, como \"id\", \"ciudad\" y \"ingreso\".", fixed = TRUE)
  expect_match(aviso$message, "si no, el formulario no es de esta base.", fixed = TRUE)
  expect_identical(aviso$details$n_por_rotulo, 0L)
})

test_that("muchas faltantes se dicen con ejemplos, no con la lista entera", {
  nombres <- sprintf("p%d", 1:40)
  inst <- list(survey = data.frame(type = "integer", name = nombres, label = sprintf("Pregunta numero %d", 1:40)))
  df <- data.frame(a = 1, b = 2)
  aviso <- .carga_aviso_no_calza(validate_data_xlsform_compatibility(df, inst), inst)
  expect_match(aviso$message, "de 40 preguntas, 40 no aparecen", fixed = TRUE)
  expect_match(aviso$message, "como \"p1\", \"p2\" y \"p3\".", fixed = TRUE)
  expect_false(grepl("p40", aviso$message, fixed = TRUE))
})

test_that("el libro con varias hojas dice cuál se leyó y que deje primero la de respuestas", {
  inst <- .acnc_instrumento()
  df <- data.frame(`1` = 1:3, `Nro. De Encuesta` = "Sí", check.names = FALSE)
  aviso <- .carga_aviso_no_calza(validate_data_xlsform_compatibility(df, inst), inst,
                                 hojas = c("Codigo", "Base"))
  expect_match(aviso$message, "Se leyó la hoja \"Codigo\", la primera del libro; el libro trae también \"Base\".",
               fixed = TRUE)
  expect_match(aviso$message, "Deja primero en el libro la hoja de las respuestas", fixed = TRUE)
})

test_that("el chequeo estricto usa el mismo aviso", {
  inst <- .acnc_instrumento()
  df <- data.frame(nro = 1:3, distrito = "Lima", edad = 30)
  e <- tryCatch(.carga_assert_data_xlsform_compatible(df, inst), error = identity)
  expect_identical(e$code, "E_DATA_XLSFORM_INCOMPATIBLE")
  expect_match(conditionMessage(e), "de 4 preguntas, 1 no aparece como columna de la base (\"trabaja\").",
               fixed = TRUE)
  expect_match(conditionMessage(e), "La base trae 3 columnas, todas del formulario.", fixed = TRUE)
})
