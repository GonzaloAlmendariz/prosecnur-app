test_that("preview de filas serializa columnas haven_labelled del .sav", {
  skip_if_not_installed("haven")

  if (!exists(".plan_rows_preview", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "router_validacion.R"), envir = globalenv())
  }

  df <- tibble::tibble(
    p32_1 = haven::labelled(c(NA_real_, 1), labels = c("Sí" = 1))
  )

  rows <- .plan_rows_preview(df, n = 2L)
  expect_true(is.na(rows[[1]]$p32_1))
  expect_equal(rows[[2]]$p32_1, 1)
  expect_error(jsonlite::toJSON(list(casos = rows), auto_unbox = TRUE, null = "null"), NA)
})
