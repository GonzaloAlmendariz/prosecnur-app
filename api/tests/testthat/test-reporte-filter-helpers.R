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

test_that("apply_named_filters acepta el formato del dashboard {var, valores}", {
  df <- data.frame(
    sexo = c("Mujer", "Hombre", "Mujer"),
    edad = c(25, 40, 50),
    stringsAsFactors = FALSE
  )

  # Valores como lista (jsonlite con simplifyVector = FALSE).
  out <- .apply_named_filters(
    df,
    list(list(var = "sexo", valores = list("Mujer")))
  )
  expect_equal(nrow(out), 2L)
  expect_true(all(out$sexo == "Mujer"))

  # Valores como vector character (forma manual).
  out2 <- .apply_named_filters(
    df,
    list(list(var = "sexo", valores = c("Mujer")))
  )
  expect_equal(nrow(out2), 2L)
})

test_that("apply_named_filters con dashboard format: multiples filtros se intersectan", {
  df <- data.frame(
    sexo = c("Mujer", "Hombre", "Mujer", "Mujer"),
    edad = c("25", "40", "30", "25"),
    stringsAsFactors = FALSE
  )
  out <- .apply_named_filters(
    df,
    list(
      list(var = "sexo", valores = list("Mujer")),
      list(var = "edad", valores = list("25", "30"))
    )
  )
  expect_equal(nrow(out), 3L)
  expect_true(all(out$sexo == "Mujer"))
  expect_true(all(out$edad %in% c("25", "30")))
})

test_that("apply_named_filters con dashboard format: filtros incompletos se ignoran", {
  df <- data.frame(sexo = c("Mujer", "Hombre"), stringsAsFactors = FALSE)

  expect_equal(
    .apply_named_filters(df, list(list(var = "", valores = list("Mujer")))),
    df
  )
  expect_equal(
    .apply_named_filters(df, list(list(var = "sexo", valores = list()))),
    df
  )
  expect_equal(
    .apply_named_filters(df, list(list(var = "sexo", valores = list("", "  ", NA)))),
    df
  )
})

test_that("apply_named_filters con dashboard format: var inexistente se ignora silenciosamente", {
  # Diferencia con el formato legacy: el dashboard no debe romper cuando
  # un filtro apunta a una var que no esta en data (p.ej. tras curacion).
  df <- data.frame(sexo = c("Mujer", "Hombre"), stringsAsFactors = FALSE)

  expect_equal(
    .apply_named_filters(df, list(list(var = "no_existe", valores = list("X")))),
    df
  )

  out <- .apply_named_filters(
    df,
    list(
      list(var = "no_existe", valores = list("X")),
      list(var = "sexo", valores = list("Mujer"))
    )
  )
  expect_equal(nrow(out), 1L)
  expect_equal(out$sexo, "Mujer")
})

test_that("apply_named_filters: detector dashboard estricto no se confunde con rule list", {
  df <- data.frame(sexo = c("Mujer", "Hombre"), stringsAsFactors = FALSE)

  out <- .apply_named_filters(
    df,
    list(list(variable = "sexo", op = "eq", value = "Mujer"))
  )
  expect_equal(nrow(out), 1L)
  expect_equal(out$sexo, "Mujer")
})

