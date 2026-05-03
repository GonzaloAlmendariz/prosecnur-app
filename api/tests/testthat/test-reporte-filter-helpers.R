test_that("apply_named_filters tolera filtros vacios de la UI", {
  df <- data.frame(
    sexo = c("Mujer", "Hombre"),
    edad = c(25, 40),
    stringsAsFactors = FALSE
  )

  expect_equal(.apply_named_filters(df, list()), df)
  expect_equal(.apply_named_filters(df, NULL), df)
  expect_equal(.apply_named_filters(df, list(list(variable = "", op = "eq", value = ""))), df)
})

test_that("apply_named_filters interpreta reglas visuales del editor", {
  df <- data.frame(
    sexo = c("Mujer", "Hombre", "Mujer"),
    edad = c(25, 40, 50),
    texto = c("Lima centro", "Cusco", "Lima norte"),
    stringsAsFactors = FALSE
  )

  out_eq <- .apply_named_filters(
    df,
    list(list(variable = "sexo", op = "eq", value = "Mujer"))
  )
  expect_equal(nrow(out_eq), 2L)
  expect_true(all(out_eq$sexo == "Mujer"))

  out_num <- .apply_named_filters(
    df,
    list(list(variable = "edad", op = "gt", value = "30"))
  )
  expect_equal(out_num$edad, c(40, 50))

  out_contains <- .apply_named_filters(
    df,
    data.frame(variable = "texto", op = "contains", value = "lima", stringsAsFactors = FALSE)
  )
  expect_equal(nrow(out_contains), 2L)
})

