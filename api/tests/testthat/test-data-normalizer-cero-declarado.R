# Regresión (RMS 2026, ACNUR): la regla que reescribe el 0 de SurveyMonkey como el
# código de «Otro» se aplicaba a toda select_one con columna `_other`, aunque el 0
# fuera una opción declarada del XLSForm. En el RMS, LIGHT03 = 0 es «No hay
# electricidad en el hogar» y un caso salía como 96 «Otro, especifique», sin texto
# en LIGHT03_other. Si el 0 está en la lista de opciones, es una respuesta, no el
# «Otro» de SurveyMonkey.

inst_cero_declarado <- function() {
  list(
    survey = data.frame(
      type = c("select_one light03", "text"),
      name = c("LIGHT03", "LIGHT03_other"),
      list_name = c("light03", NA),
      label = c("Fuente de electricidad", "Otro, especifique"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep("light03", 4),
      name = c("0", "1", "96", "98"),
      label = c("No hay electricidad en el hogar", "Conexión a la red nacional",
                "Otro, especifique", "No sé"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

test_that("un 0 declarado como opción del XLSForm no se reescribe como «Otro»", {
  raw <- data.frame(
    LIGHT03 = c("0", "1", "96", "98"),
    LIGHT03_other = c(NA, NA, "se paga la luz", NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst_cero_declarado())

  expect_equal(as.character(out$LIGHT03), c("0", "1", "96", "98"))
  recodes <- attr(out, "xlsform_normalized")$select_one_other_recodes
  expect_false("LIGHT03" %in% names(recodes))
})

test_that("si las etiquetas del SAV dicen que 0 es «Otro», se recodifica aunque el XLSForm declare 0", {
  raw <- data.frame(
    LIGHT03 = haven::labelled(c(0, 1, NA), labels = c("Otro, especifique" = 0, "Conexión a la red nacional" = 1)),
    LIGHT03_other = c("vela", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst_cero_declarado())

  expect_equal(as.character(out$LIGHT03), c("96", "1", NA))
})

test_that("el 0 declarado se conserva también cuando la columna llega numérica", {
  raw <- data.frame(
    LIGHT03 = c(0, 1, 96),
    LIGHT03_other = c("", "", "vela"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst_cero_declarado())

  expect_equal(as.character(out$LIGHT03), c("0", "1", "96"))
})
