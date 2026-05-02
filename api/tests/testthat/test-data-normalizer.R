test_that("normalize_data_for_xlsform reconstruye select_multiple SurveyMonkey por label", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_act", "select_one lst_grid", "text"),
      name = c("q0027", "q0013_1", "q0027_other"),
      list_name = c("lst_act", "lst_grid", NA),
      label = c("Actividades", "Item 1", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_act", 3), rep("lst_grid", 2)),
      name = c("1", "2", "other", "1", "2"),
      label = c("Emprendimiento", "Voluntariado", "Otros:", "Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  raw <- data.frame(
    q0027_0001 = haven::labelled(c(NA, 1, NA), c("Otros:" = 1)),
    q0027_0002 = haven::labelled(c(1, NA, NA), c("Emprendimiento" = 1)),
    q0027_0003 = haven::labelled(c(1, NA, NA), c("Voluntariado" = 1)),
    q0013_0001 = c(2, 1, NA),
    q0027_other = c("", "Detalle", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(as.character(out$q0027), c("1 2", "other", NA))
  expect_equal(out$q0013_1, raw$q0013_0001)
  expect_true("q0027_other" %in% names(out))
  expect_false(any(c("q0027_0001", "q0027_0002", "q0027_0003", "q0013_0001") %in% names(out)))
})

test_that("normalize_data_for_xlsform no toca data ya canonica", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_need",
      name = "need",
      list_name = "lst_need",
      label = "Necesidades",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_need",
      name = "a",
      label = "A",
      stringsAsFactors = FALSE
    )
  )
  raw <- data.frame(need = c("a", NA), stringsAsFactors = FALSE)
  out <- normalize_data_for_xlsform(raw, inst)
  expect_identical(out$need, raw$need)
})
