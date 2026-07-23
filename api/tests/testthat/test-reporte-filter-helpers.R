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

# --- Bug multibase madre+repeat: current_code fantasma (leak de simplifyDataFrame)

test_that("apply_named_filters: un filtro con valor NA es no-op, no un error (leak fantasma)", {
  # La base madre no tiene `current_code`. El parseo del plan JSON rectangulariza
  # el arreglo de slides y le inyecta un `current_code = NA` fantasma heredado de
  # las laminas por-servicio de la base hija. Debe ser NO-OP, jamas un stop().
  df <- data.frame(testreal = c("si", "no", "si"), stringsAsFactors = FALSE)

  # Forma named-list con valor NA. El no-op ademas deja rastro (warning) para
  # que un filtro genuino NA'd por otro bug no infle denominadores en silencio.
  expect_warning(
    out <- .apply_named_filters(df, list(current_code = NA_character_)),
    "se degrada a no-op"
  )
  expect_identical(out, df)
  # Forma data.frame de una sola columna NA (exactamente como llega tras el
  # `simplifyDataFrame` de plumber: structure(list(current_code = NA), class = "data.frame")).
  phantom <- structure(list(current_code = NA_character_),
                       row.names = 5L, class = "data.frame")
  expect_warning(out2 <- .apply_named_filters(df, phantom), "se degrada a no-op")
  expect_identical(out2, df)
  # Valor vacio "" tambien es no-op (con rastro).
  expect_warning(out3 <- .apply_named_filters(df, list(current_code = "")), "se degrada a no-op")
  expect_identical(out3, df)
})

test_that("apply_named_filters: el warning de no-op identifica el filtro degradado", {
  df <- data.frame(sexo = c("Mujer", "Hombre"), stringsAsFactors = FALSE)
  expect_warning(
    .apply_named_filters(df, list(current_code = NA_character_)),
    "current_code"
  )
})

test_that("apply_named_filters: filtro con valor REAL sobre columna ausente aborta con condicion clasificada", {
  df <- data.frame(testreal = c("si", "no"), stringsAsFactors = FALSE)
  cnd <- tryCatch(
    .apply_named_filters(df, list(current_code = "cepr")),
    pulso_filter_missing_column = function(c) c
  )
  expect_s3_class(cnd, "pulso_filter_missing_column")
  expect_identical(cnd$variable, "current_code")
  expect_match(conditionMessage(cnd), "current_code")
})

test_that("apply_named_filters_safe: valor real sobre columna ausente degrada a 0 filas con warning", {
  df <- data.frame(testreal = c("si", "no", "si"), stringsAsFactors = FALSE)
  expect_warning(
    out <- .apply_named_filters_safe(df, list(current_code = "cepr")),
    "ausente"
  )
  expect_equal(nrow(out), 0L)
  expect_identical(names(out), names(df))
})

test_that("apply_named_filters_safe: filtro con valor real sobre columna presente filtra normal", {
  # La hija repeat SI tiene current_code: el filtro por servicio se aplica.
  df <- data.frame(
    current_code = c("salud", "salud", "legal", "cepr"),
    srv_claridad = c("muy", "poco", "muy", "nada"),
    stringsAsFactors = FALSE
  )
  out <- .apply_named_filters_safe(df, list(current_code = "salud"))
  expect_equal(nrow(out), 2L)
  expect_true(all(out$current_code == "salud"))
})

