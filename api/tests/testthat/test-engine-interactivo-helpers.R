test_that(".interactivo_limit_levels conserva todos los niveles y limita la vista", {
  df_levels <- data.frame(
    value = c("a", "b", "c"),
    label = c("A", "B", "C"),
    base = c(30, 20, 10),
    stringsAsFactors = FALSE
  )

  lim_df <- prosecnur:::.interactivo_limit_levels(df_levels, max_levels = 2)
  expect_equal(nrow(lim_df$all), 3L)
  expect_equal(nrow(lim_df$visible), 2L)
  expect_equal(lim_df$hidden_count, 1L)

  list_levels <- list(
    list(key = "a", base_n = 30),
    list(key = "b", base_n = 20),
    list(key = "c", base_n = 10)
  )

  lim_list <- prosecnur:::.interactivo_limit_levels(list_levels, max_levels = 2)
  expect_length(lim_list$all, 3L)
  expect_length(lim_list$visible, 2L)
  expect_equal(lim_list$hidden_count, 1L)
})

test_that(".interactivo_resumen_build_rows usa el esquema de la sección aunque la base filtrada quede vacía", {
  instrumento <- list(
    survey = data.frame(
      name = c("q1", "q2"),
      type = c("select_one lista", "select_multiple lista"),
      label = c("Pregunta 1", "Pregunta 2"),
      stringsAsFactors = FALSE
    )
  )
  secciones <- list("Sección A" = c("q1", "q2"))
  df_full <- data.frame(
    q1 = c("1", "2"),
    q2.1 = c(1, 0),
    q2.2 = c(0, 1),
    stringsAsFactors = FALSE
  )
  df_empty <- df_full[0, , drop = FALSE]

  resolver_sm <- function(var_madre) {
    if (!identical(var_madre, "q2")) {
      return(list(cols = character(0), map_code_to_label = list()))
    }

    list(
      cols = c("q2.1", "q2.2"),
      map_code_to_label = list("1" = "Opción 1", "2" = "Opción 2")
    )
  }

  rows_full <- prosecnur:::.interactivo_resumen_build_rows(
    sec = "Sección A",
    secciones_limpias = secciones,
    instrumento = instrumento,
    data = df_full,
    sm_madres = "q2",
    label_var = function(var) paste("Label", var),
    resolver_var_spec_fn = resolver_sm
  )
  rows_empty <- prosecnur:::.interactivo_resumen_build_rows(
    sec = "Sección A",
    secciones_limpias = secciones,
    instrumento = instrumento,
    data = df_empty,
    sm_madres = "q2",
    label_var = function(var) paste("Label", var),
    resolver_var_spec_fn = resolver_sm
  )

  expect_length(rows_full$rows, 2L)
  expect_identical(rows_full$rows, rows_empty$rows)
  expect_identical(rows_full$rows[[1]]$slot_id, "sum_plot_1")
  expect_identical(rows_full$rows[[2]]$type, "sm")
  expect_length(rows_full$rows[[2]]$options, 2L)
  expect_identical(rows_full$rows[[2]]$options[[1]]$slot_id, "sum_plot_2_1")
})

test_that(".interactivo_resolve_filter_selection restaura la última selección válida", {
  expect_equal(
    prosecnur:::.interactivo_resolve_filter_selection(
      selected = character(0),
      valid_values = c("a", "b", "c"),
      last_valid = c("b", "c"),
      fallback = "all"
    ),
    c("b", "c")
  )

  expect_equal(
    prosecnur:::.interactivo_resolve_filter_selection(
      selected = c("c"),
      valid_values = c("a", "b", "c"),
      last_valid = c("a", "b"),
      fallback = "all"
    ),
    "c"
  )
})

test_that(".interactivo_resolve_filter_selection resuelve bien el caso de una sola categoría", {
  expect_equal(
    prosecnur:::.interactivo_resolve_filter_selection(
      selected = character(0),
      valid_values = "solo",
      last_valid = character(0),
      fallback = "all"
    ),
    "solo"
  )
})

test_that("helpers de casos detectan gráficos vacíos y generan placeholder plotly", {
  skip_if_not_installed("plotly")

  df_so_ok <- data.frame(so = c(NA, "", "1"), stringsAsFactors = FALSE)
  df_so_empty <- data.frame(so = c(NA, "", "NA"), stringsAsFactors = FALSE)
  df_sm_ok <- data.frame(dummy = c(NA, 0, 1), stringsAsFactors = FALSE)
  df_sm_empty <- data.frame(dummy = c(NA, 2, 3), stringsAsFactors = FALSE)

  expect_true(prosecnur:::.interactivo_has_cases_so(df_so_ok, "so"))
  expect_false(prosecnur:::.interactivo_has_cases_so(df_so_empty, "so"))
  expect_true(prosecnur:::.interactivo_has_cases_dummy(df_sm_ok, "dummy"))
  expect_false(prosecnur:::.interactivo_has_cases_dummy(df_sm_empty, "dummy"))

  empty_plot <- expect_no_warning(
    prosecnur:::.interactivo_empty_plotly(
      title = "Sin casos por mostrar",
      subtitle = "Ajusta los filtros para ver información."
    )
  )
  expect_s3_class(empty_plot, "plotly")
})

test_that(".interactivo_write_simple_xlsx genera un archivo Excel legible", {
  skip_if_not_installed("openxlsx")

  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)

  df <- data.frame(
    pregunta = c("A", "B"),
    valor = c(10, 20),
    stringsAsFactors = FALSE
  )

  prosecnur:::.interactivo_write_simple_xlsx(path = path, data = df, sheet_name = "Export")

  expect_true(file.exists(path))
  expect_true("Export" %in% openxlsx::getSheetNames(path))

  df_read <- openxlsx::read.xlsx(path)
  expect_equal(df_read, df)
})
