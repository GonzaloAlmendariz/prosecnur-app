# Switch de exportacion del editor XLSForm: por defecto el .xlsx sale limpio
# (sin la capa `paper_*` de la plataforma); con el flag activo se conserva.

test_that(".xlsform_editor_app_only_cols detecta el namespace paper_*", {
  cols <- c("type", "name", "label", "relevant", "paper_number",
            "paper_label", "paper_skip", "choice_filter", "Paper_Group")
  flag <- .xlsform_editor_app_only_cols(cols)
  expect_equal(cols[flag],
               c("paper_number", "paper_label", "paper_skip", "Paper_Group"))
  # columnas estandar XLSForm NUNCA se marcan
  expect_false(any(flag[cols %in% c("type", "name", "label", "relevant", "choice_filter")]))
})

test_that(".xlsform_editor_strip_app_columns quita solo las columnas de plataforma", {
  survey <- data.frame(
    type = "select_one si_no", name = "p1", label = "Consentimiento",
    relevant = "", constraint = "", paper_number = "1",
    paper_label = "Etiqueta papel", paper_skip = "pase a 8",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  clean <- .xlsform_editor_strip_app_columns(survey)
  expect_equal(names(clean), c("type", "name", "label", "relevant", "constraint"))
  expect_equal(nrow(clean), 1L)
  expect_equal(clean$name, "p1")

  # choices: solo paper_skip es de plataforma; filter_* (choice_filter ODK) se conserva
  choices <- data.frame(
    list_name = "actores", name = "88", label = "Otro",
    filter_p14 = "1", paper_skip = "pase",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  clean_ch <- .xlsform_editor_strip_app_columns(choices)
  expect_true("filter_p14" %in% names(clean_ch))
  expect_false("paper_skip" %in% names(clean_ch))
})

test_that(".xlsform_editor_strip_app_columns es idempotente y tolera df sin columnas paper", {
  df <- data.frame(type = "note", name = "n1", label = "hola",
                   stringsAsFactors = FALSE, check.names = FALSE)
  expect_identical(.xlsform_editor_strip_app_columns(df), df)
  expect_null(.xlsform_editor_strip_app_columns(NULL))
})
