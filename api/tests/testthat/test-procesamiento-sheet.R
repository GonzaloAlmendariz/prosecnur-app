library(testthat)

if (!exists("%||%")) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
}

if (!exists(".procesamiento_sheet_column_meta", mode = "function")) {
  helpers_path <- file.path("api", "R", "procesamiento_sheet.R")
  if (file.exists(helpers_path)) {
    source(helpers_path)
  } else if (file.exists(file.path("R", "procesamiento_sheet.R"))) {
    source(file.path("R", "procesamiento_sheet.R"))
  }
}

test_that("processing sheet marks only recoded columns as coded", {
  data <- data.frame(
    record_id = c("a", "b"),
    p2 = c("1", "2"),
    p2_recod = c("10", "20"),
    p3_recodificar = c("no", "si"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data[["p19/1_recod"]] <- c(1, 0)

  inst <- list(
    survey = data.frame(
      name = c("record_id", "p2", "p2_recod", "p3_recodificar", "p19"),
      type = c("text", "select_one p2_list", "select_one p2_recod_list", "text", "select_multiple p19_list"),
      label = c("Registro", "Edad", "Edad recodificada", "Texto recodificar", "Necesidades"),
      stringsAsFactors = FALSE
    )
  )

  cols <- .procesamiento_sheet_column_meta(data, inst, coded = TRUE)
  by_key <- stats::setNames(cols, vapply(cols, function(x) x$key, character(1)))

  expect_false(isTRUE(by_key$record_id$coded))
  expect_false(isTRUE(by_key$p2$coded))
  expect_false(isTRUE(by_key$p3_recodificar$coded))

  expect_true(isTRUE(by_key$p2_recod$coded))
  expect_true(isTRUE(by_key$p2_recod$is_recoded))
  expect_equal(by_key$p2_recod$raw_parent, "p2")

  expect_true(isTRUE(by_key[["p19/1_recod"]]$coded))
  expect_equal(by_key[["p19/1_recod"]]$raw_parent, "p19/1")
})
