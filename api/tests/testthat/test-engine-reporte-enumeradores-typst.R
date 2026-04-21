test_that("helpers Typst generan bloques no vacios", {
  df <- tibble::tibble(
    enumerador = c("Ana", "TOTAL"),
    F = c(2, 2),
    M = c(1, 1),
    TOTAL = c(3, 3)
  )

  tab <- prosecnur:::typst_tabla_enumeradores(df)
  head <- prosecnur:::typst_section_header_enumeradores("Presencial")
  kpi <- prosecnur:::typst_kpi_box_enumeradores(
    valores = c(10, 3, 2),
    etiquetas = c("Total encuestas", "Total enumeradores", "Modalidades con datos")
  )

  expect_true(is.character(tab) && nzchar(tab))
  expect_true(is.character(head) && nzchar(head))
  expect_true(is.character(kpi) && nzchar(kpi))
  expect_match(tab, "#table\\(", perl = TRUE)
  expect_match(head, "#block\\(", perl = TRUE)
})

