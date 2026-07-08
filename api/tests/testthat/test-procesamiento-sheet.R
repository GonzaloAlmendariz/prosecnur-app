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
    p19.1 = c(1, 0),
    p19_recod.1 = c(0, 1),
    p35 = c("texto libre", "otra respuesta"),
    p35_recod = c("20", "30"),
    p35_recod.1 = c(1, 0),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  data[["p19/1_recod"]] <- c(1, 0)

  inst <- list(
    survey = data.frame(
      name = c("record_id", "p2", "p2_recod", "p3_recodificar", "p19", "p35"),
      type = c("text", "select_one p2_list", "select_one p2_recod_list", "text", "select_multiple p19_list", "text"),
      label = c("Registro", "Edad", "Edad recodificada", "Texto recodificar", "Necesidades", "Texto abierto"),
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

  expect_equal(by_key[["p19.1"]]$type_kind, "sm")
  expect_equal(by_key[["p19.1"]]$dummy_parent, "p19")
  expect_false(isTRUE(by_key[["p19.1"]]$is_recoded))

  expect_equal(by_key[["p19_recod.1"]]$type_kind, "sm")
  expect_equal(by_key[["p19_recod.1"]]$dummy_parent, "p19")
  expect_equal(by_key[["p19_recod.1"]]$source_type_kind, "sm")
  expect_true(isTRUE(by_key[["p19_recod.1"]]$is_recoded))

  expect_equal(by_key$p35$type_kind, "text")
  expect_equal(by_key$p35_recod$type_kind, "text")
  expect_true(isTRUE(by_key$p35_recod$is_recoded))

  expect_equal(by_key[["p35_recod.1"]]$type_kind, "sm")
  expect_equal(by_key[["p35_recod.1"]]$dummy_parent, "p35")
  expect_equal(by_key[["p35_recod.1"]]$source_type_kind, "text")
  expect_true(isTRUE(by_key[["p35_recod.1"]]$is_recoded))
})

test_that("processing sheet exposes recoded columns even when the view is not globally coded", {
  data <- data.frame(
    p35 = c("texto"),
    p35_recod = c("20"),
    p35_recod.1 = c(1),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      name = "p35",
      type = "text",
      label = "Texto abierto",
      stringsAsFactors = FALSE
    )
  )

  cols <- .procesamiento_sheet_column_meta(data, inst, coded = FALSE)
  by_key <- stats::setNames(cols, vapply(cols, function(x) x$key, character(1)))

  expect_true(isTRUE(by_key$p35_recod$is_recoded))
  expect_equal(by_key$p35_recod$type_kind, "text")
  expect_true(isTRUE(by_key[["p35_recod.1"]]$is_recoded))
  expect_equal(by_key[["p35_recod.1"]]$type_kind, "sm")
  expect_equal(by_key[["p35_recod.1"]]$source_type_kind, "text")
})

test_that("payload expone categorias (so/sm) y min/max (integer) para filtros inteligentes", {
  sexo <- c("1", "2", "1", "2", "3", "1")
  attr(sexo, "labels") <- c(Hombre = "1", Mujer = "2", Otro = "3")
  data <- data.frame(
    sexo = I(sexo),
    edad = c("22", "35", "48", "19", "67", "41"),
    distrito = I(c("smp", "sjl", "smp", "ate", "sjl", "smp")),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      type = c("select_one sx", "integer", "select_one dd"),
      name = c("sexo", "edad", "distrito"),
      label = c("Sexo", "Edad", "Distrito"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(list_name = character(), name = character(), label = character())
  )
  pl <- .procesamiento_sheet_payload(data = data, inst = inst, source = "carga")
  cols <- stats::setNames(pl$columns, vapply(pl$columns, function(c) c$key, character(1)))

  cats <- cols$sexo$categories
  expect_equal(length(cats), 3L)
  by_code <- stats::setNames(cats, vapply(cats, function(c) c$code, character(1)))
  expect_equal(by_code[["1"]]$label, "Hombre")
  expect_equal(by_code[["1"]]$count, 3L)
  expect_null(cols$sexo$value_min)

  expect_equal(cols$edad$value_min, 19)
  expect_equal(cols$edad$value_max, 67)
  expect_null(cols$edad$categories)

  expect_equal(length(cols$distrito$categories), 3L)
})

test_that("filtro estructurado in/range/contains y substring retrocompatible", {
  data <- data.frame(
    sexo = c("1", "2", "1", "2", "3", "1"),
    edad = c("22", "35", "48", "19", "67", "41"),
    distrito = c("smp", "sjl", "smp", "ate", "sjl", "smp"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      type = c("select_one sx", "integer", "select_one dd"),
      name = c("sexo", "edad", "distrito"),
      label = c("Sexo", "Edad", "Distrito"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(list_name = character(), name = character(), label = character())
  )
  in_pl <- .procesamiento_sheet_payload(data = data, inst = inst, source = "carga",
                                        column_filters = list(sexo = list(op = "in", values = list("2", "3"))))
  expect_equal(in_pl$total, 3L)

  rng <- .procesamiento_sheet_payload(data = data, inst = inst, source = "carga",
                                      column_filters = list(edad = list(op = "range", min = 30, max = 50)))
  expect_equal(rng$total, 3L)

  cont <- .procesamiento_sheet_payload(data = data, inst = inst, source = "carga",
                                       column_filters = list(distrito = list(op = "contains", value = "sm")))
  expect_equal(cont$total, 3L)

  substr <- .procesamiento_sheet_payload(data = data, inst = inst, source = "carga",
                                         column_filters = list(distrito = "sjl"))
  expect_equal(substr$total, 2L)
})
