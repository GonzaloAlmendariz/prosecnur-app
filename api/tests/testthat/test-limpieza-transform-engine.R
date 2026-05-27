test_that("complete_select_multiple_hierarchy completa tokens de variable madre", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_p7",
      type_base = "select_multiple",
      name = "p7",
      list_name = "lst_p7",
      label = "P7",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_p7", 5),
      name = as.character(1:5),
      label = paste("Opcion", 1:5),
      stringsAsFactors = FALSE
    )
  )
  df <- data.frame(p7 = c("2 5", "1 2", "5"), stringsAsFactors = FALSE)

  out <- complete_select_multiple_hierarchy(
    data = df,
    target_variable = "p7",
    hierarchy_map = list("5" = c("1", "2", "3")),
    rows = c(TRUE, TRUE, TRUE),
    instrumento = inst
  )

  expect_equal(as.character(out$data$p7), c("1 2 3 5", "1 2", "1 2 3 5"))
  expect_equal(nrow(out$trace), 2L)
  expect_equal(out$impact$cells_changed, 2L)
})

test_that("complete_select_multiple_hierarchy completa columnas dummy existentes", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_p7",
      type_base = "select_multiple",
      name = "p7",
      list_name = "lst_p7",
      label = "P7",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_p7", 5),
      name = as.character(1:5),
      label = paste("Opcion", 1:5),
      stringsAsFactors = FALSE
    )
  )
  df <- data.frame(
    p7.1 = c("No", "No"),
    p7.2 = c("Si", "No"),
    p7.3 = c("No", "No"),
    p7.4 = c("No", "No"),
    p7.5 = c("Si", "Si"),
    check.names = FALSE
  )

  out <- complete_select_multiple_hierarchy(
    data = df,
    target_variable = "p7",
    hierarchy_map = list("5" = c("1", "2", "3")),
    rows = c(TRUE, TRUE),
    instrumento = inst
  )

  expect_equal(as.character(out$data[["p7.1"]]), c("Si", "Si"))
  expect_equal(as.character(out$data[["p7.2"]]), c("Si", "Si"))
  expect_equal(as.character(out$data[["p7.3"]]), c("Si", "Si"))
  expect_equal(as.character(out$data[["p7.4"]]), c("No", "No"))
  expect_equal(as.character(out$data[["p7.5"]]), c("Si", "Si"))
  expect_equal(nrow(out$trace), 2L)
})

test_that("regla custom select_multiple_hierarchy detecta faltantes", {
  regla <- list(
    id = "RC_SM",
    tipo = "select_multiple_hierarchy",
    variables = list("p7"),
    params = list(hierarchy_map = list("5" = c("1", "2", "3"))),
    activa = TRUE,
    nombre = "P7 jerarquia"
  )
  plan <- compile_reglas_custom(list(regla))
  df <- data.frame(p7 = c("2 5", "1 2 3 5", "5", NA), stringsAsFactors = FALSE)
  env <- list2env(c(as.list(df), list(.__eval_data__ = df)), parent = globalenv())

  eval(parse(text = plan$Procesamiento[1]), envir = env)

  expect_equal(unname(env$rc_RC_SM), c(TRUE, FALSE, TRUE, FALSE))
})

test_that("adjust_select_multiple_values agrega y quita tokens preservando respuestas", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_p7",
      type_base = "select_multiple",
      name = "p7",
      list_name = "lst_p7",
      label = "P7",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_p7", 5),
      name = as.character(1:5),
      label = paste("Opcion", 1:5),
      stringsAsFactors = FALSE
    )
  )
  df <- data.frame(p7 = c("2 5", "1 4", ""), stringsAsFactors = FALSE)

  out <- adjust_select_multiple_values(
    data = df,
    target_variable = "p7",
    add_codes = c("1", "3"),
    remove_codes = "4",
    rows = c(TRUE, TRUE, FALSE),
    instrumento = inst
  )

  expect_equal(as.character(out$data$p7), c("1 2 3 5", "1 3", ""))
  expect_equal(nrow(out$trace), 2L)
  expect_equal(out$impact$cells_changed, 2L)
})

test_that("adjust_select_multiple_values advierte columnas dummy faltantes sin fallar", {
  df <- data.frame(
    p7.1 = c("No", "No"),
    p7.3 = c("No", "Si"),
    check.names = FALSE
  )

  out <- adjust_select_multiple_values(
    data = df,
    target_variable = "p7",
    add_codes = c("1", "2"),
    rows = c(TRUE, TRUE)
  )

  expect_equal(as.character(out$data[["p7.1"]]), c("Si", "Si"))
  expect_true(any(grepl("codigo(s) 2", out$warnings, fixed = TRUE)))
  expect_equal(out$impact$cells_changed, 2L)
})
