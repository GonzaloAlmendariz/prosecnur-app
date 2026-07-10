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
  # El encabezado (dimension / niveles / n-%) ocupa las filas 4-6:
  # fila 1 seccion "GENERAL", fila 3 titulo de la pregunta, filas 4-6 encabezado.
  # (Ya no se escribe el banner de hoja "CRUCES".)
  header_vals <- as.character(unlist(raw[4:6, , drop = FALSE], use.names = FALSE))

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

test_that("cruces no colapsan choices con label vacio", {
  skip_if_not_installed("readxl")

  data <- data.frame(
    p26 = as.character(c(1:10, 5)),
    sexo = rep(c("h", "m"), length.out = 11),
    stringsAsFactors = FALSE
  )
  instrumento <- list(
    survey = data.frame(
      name = c("p26", "sexo"),
      type = c("select_one escala", "select_one sexo"),
      label = c("Escala 1 a 10", "Sexo"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("escala", 10), "sexo", "sexo"),
      name = c(as.character(1:10), "h", "m"),
      label = c(
        "Extremo izquierdo", rep(NA_character_, 8), "Extremo derecho",
        "Hombre", "Mujer"
      ),
      stringsAsFactors = FALSE
    )
  )

  orders <- prosecnurapp:::.augment_orders_list_from_choices(
    orders_list = NULL,
    survey = instrumento$survey,
    choices = instrumento$choices
  )
  cats <- prosecnurapp:::get_categorias(
    "p26",
    data = data,
    survey = instrumento$survey,
    orders_list = orders
  )

  expect_equal(cats$labels, as.character(1:10))

  out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(out), add = TRUE)

  expect_no_error(
    reporte_cruces(
      data = data,
      instrumento = instrumento,
      SECCIONES = list(General = "p26"),
      cruces = "sexo",
      path_xlsx = out,
      show_sig = FALSE
    )
  )

  raw <- readxl::read_excel(out, col_names = FALSE)
  first_col <- as.character(raw[[1]])
  first_col <- first_col[!is.na(first_col)]
  expect_true(all(as.character(1:10) %in% first_col))
  expect_false(any(!nzchar(trimws(first_col[first_col %in% as.character(1:10)]))))
})

test_that("cruces conservan labels en listas categoricas cortas", {
  data <- data.frame(sexo = c("1", "2"), stringsAsFactors = FALSE)
  survey <- data.frame(
    name = "sexo",
    type = "select_one sexo",
    label = "Sexo",
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = "sexo",
    name = c("1", "2"),
    label = c("Hombre", "Mujer"),
    stringsAsFactors = FALSE
  )

  orders <- prosecnurapp:::.augment_orders_list_from_choices(
    orders_list = NULL,
    survey = survey,
    choices = choices
  )
  cats <- prosecnurapp:::get_categorias(
    "sexo",
    data = data,
    survey = survey,
    orders_list = orders
  )

  expect_equal(cats$labels, c("Hombre", "Mujer"))
})
