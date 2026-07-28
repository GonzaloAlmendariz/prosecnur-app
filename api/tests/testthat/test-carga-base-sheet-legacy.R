library(testthat)

test_that("base sheet acepta una sesion legacy single-base", {
  sid <- "legacy-single-base"
  instrumento <- list(
    survey = data.frame(
      type = c("text", "integer"),
      name = c("id", "edad"),
      label = c("Identificador", "Edad"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = character(),
      name = character(),
      label = character(),
      stringsAsFactors = FALSE
    )
  )
  datos <- data.frame(
    id = c("A-01", "A-02"),
    edad = c(30L, 41L),
    stringsAsFactors = FALSE
  )
  legacy_session <- list(
    id = sid,
    files = list(
      xlsform = list(kind = "xlsform", path = "synthetic-form.xlsx", ext = "xlsx"),
      data = list(kind = "data", path = "synthetic-data.csv", ext = "csv")
    )
  )

  local_mocked_bindings(
    .carga_resolve_export_files = function(sid, base_nombre = NULL) {
      expect_identical(sid, "legacy-single-base")
      expect_null(base_nombre)
      list(
        base_nombre = NULL,
        xlsform = legacy_session$files$xlsform,
        data = legacy_session$files$data,
        data_ext = "csv"
      )
    },
    reporte_instrumento = function(path) instrumento,
    .read_data_any_path = function(path, ext) datos,
    normalize_data_for_xlsform = function(df, inst, choice_code_maps = list()) df,
    .carga_editor_choice_code_maps = function(sid) list(),
    session_get = function(sid, required = TRUE) legacy_session,
    sanitize_base_data = function(df, inst, monitoreo_handoff = NULL) df,
    .carga_reorder_data_columns = function(df, inst) df,
    .package = "prosecnurapp"
  )

  normalized <- .carga_normalized_data_for_export(sid, base_nombre = NULL)
  sheet <- .procesamiento_sheet_payload(
    data = normalized$data,
    inst = normalized$instrumento,
    source = "carga"
  )

  expect_null(normalized$base_nombre)
  expect_true(sheet$ok)
  expect_identical(sheet$source, "carga")
  expect_equal(sheet$total, 2L)
  expect_equal(vapply(sheet$columns, `[[`, character(1), "key"), c("id", "edad"))
})
