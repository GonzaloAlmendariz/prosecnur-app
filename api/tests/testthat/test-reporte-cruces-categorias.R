test_that("cruces usa choices para mostrar labels y categorias no observadas", {
  data <- data.frame(
    p6 = c("1", "2", "1", "2"),
    p1 = c("a", "a", "b", "b"),
    stringsAsFactors = FALSE
  )

  instrumento <- list(
    survey = data.frame(
      name = c("p6", "p1"),
      type = c("select_one modalidad", "select_one si_no"),
      list_name = c("modalidad", "si_no"),
      label = c("Modalidad", "Pregunta 1"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("modalidad", "modalidad", "modalidad", "si_no", "si_no"),
      name = c("1", "2", "3", "a", "b"),
      label = c("Presencial", "Telefónica", "Sin modalidad", "Sí", "No"),
      stringsAsFactors = FALSE
    )
  )

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  expect_no_error(
    reporte_cruces(
      data = data,
      instrumento = instrumento,
      SECCIONES = list(General = "p1"),
      cruces = "p6",
      path_xlsx = out,
      show_sig = FALSE
    )
  )

  raw <- readxl::read_excel(out, col_names = FALSE, n_max = 12)
  vals <- as.character(unlist(raw, use.names = FALSE))
  header_vals <- as.character(unlist(raw[6:8, , drop = FALSE], use.names = FALSE))

  expect_true("Presencial" %in% vals)
  expect_true("Telefónica" %in% vals)
  expect_true("Sin modalidad" %in% vals)
  expect_false(any(header_vals %in% c("1", "2", "3"), na.rm = TRUE))
})

test_that("get_categorias interpreta attr labels tipo haven label -> code", {
  x <- c("1", "2", "3")
  attr(x, "labels") <- c("Presencial" = 1, "Telefónica" = 2, "Sin modalidad" = 3)
  data <- data.frame(p6 = I(x), stringsAsFactors = FALSE)

  cats <- prosecnurapp:::get_categorias("p6", data = data)

  expect_equal(cats$codes, c("1", "2", "3"))
  expect_equal(cats$labels, c("Presencial", "Telefónica", "Sin modalidad"))
})
