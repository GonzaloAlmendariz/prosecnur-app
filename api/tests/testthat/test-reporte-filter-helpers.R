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

# =============================================================================
# Politica canonica 5.6 — estos tests FIJAN la tabla declarada en la cabecera
# de reporte_filter_helpers.R (op × NA × coercion × multivalor + modos).
# =============================================================================

test_that("politica 5.6: NA nunca satisface neq ni notin (sin dato != distinto de)", {
  # Antes neq/notin RETENIAN los NA (divergencia accidental respecto de eq).
  df <- data.frame(
    sexo = c("Mujer", "Hombre", NA_character_, "Mujer"),
    stringsAsFactors = FALSE
  )

  out_neq <- .apply_named_filters(
    df,
    list(list(variable = "sexo", op = "neq", value = "Mujer"))
  )
  expect_equal(nrow(out_neq), 1L)
  expect_equal(out_neq$sexo, "Hombre")

  out_notin <- .apply_named_filters(
    df,
    list(list(variable = "sexo", op = "notin", value = "Mujer,Otro"))
  )
  expect_equal(nrow(out_notin), 1L)
  expect_equal(out_notin$sexo, "Hombre")

  # eq ya excluia NA; sigue igual.
  out_eq <- .apply_named_filters(
    df,
    list(list(variable = "sexo", op = "eq", value = "Mujer"))
  )
  expect_equal(nrow(out_eq), 2L)
  expect_true(all(out_eq$sexo == "Mujer"))
})

test_that("politica 5.6: contains multivaluado es OR sobre TODOS los valores", {
  # Antes contains usaba solo vals[1] sin avisar.
  df <- data.frame(
    texto = c("Lima centro", "Cusco urbano", "Arequipa", NA_character_),
    stringsAsFactors = FALSE
  )
  out <- .apply_named_filters(
    df,
    list(list(variable = "texto", op = "contains", value = "lima, cusco"))
  )
  expect_equal(nrow(out), 2L)
  expect_setequal(out$texto, c("Lima centro", "Cusco urbano"))
})

test_that("politica 5.6: puente numerico — '1.0' del filtro alcanza al 1 de una columna numeric", {
  df <- data.frame(
    codigo = c(1, 2, 3, NA_real_),
    stringsAsFactors = FALSE
  )

  out <- .apply_named_filters(
    df,
    list(list(variable = "codigo", op = "eq", value = "1.0"))
  )
  expect_equal(out$codigo, 1)

  # El puente tambien aplica a la negacion: neq "1.0" excluye los 1 y los NA.
  out_neq <- .apply_named_filters(
    df,
    list(list(variable = "codigo", op = "neq", value = "1.0"))
  )
  expect_equal(out_neq$codigo, c(2, 3))

  # Y al formato legacy de lista nombrada (path de reportes).
  out_named <- .apply_named_filters(df, list(codigo = "1.00"))
  expect_equal(out_named$codigo, 1)
})

test_that("politica 5.6: SIN puente numerico en columnas character ('01' != '1')", {
  # Los codigos string del catalogo se comparan literales: puentear fusionaria
  # codigos distintos como "01" y "1".
  df <- data.frame(distrito = c("01", "1", "10"), stringsAsFactors = FALSE)

  out <- .apply_named_filters(
    df,
    list(list(variable = "distrito", op = "eq", value = "1"))
  )
  expect_equal(out$distrito, "1")
})

test_that("politica 5.6: gt/lt con umbral no numerico avisa y deja 0 filas (fallo visible)", {
  df <- data.frame(edad = c(25, 40), stringsAsFactors = FALSE)
  expect_warning(
    out <- .apply_named_filters(
      df,
      list(list(variable = "edad", op = "gt", value = "abc"))
    ),
    "umbral no numerico"
  )
  expect_equal(nrow(out), 0L)
})

test_that("politica 5.6: mode lenient ignora columnas ausentes y no-ops en silencio", {
  df <- data.frame(sexo = c("Mujer", "Hombre"), stringsAsFactors = FALSE)

  # Columna ausente: en strict aborta con condicion clasificada; en lenient next.
  expect_warning(
    out <- .apply_named_filters(df, list(no_existe = "X"), mode = "lenient"),
    NA
  )
  expect_identical(out, df)

  # Filtro NA'd: en strict warning de no-op; en lenient silencio.
  expect_warning(
    out2 <- .apply_named_filters(df, list(sexo = NA_character_), mode = "lenient"),
    NA
  )
  expect_identical(out2, df)

  # Y el filtro con valor real sobre columna presente SI filtra en lenient.
  out3 <- .apply_named_filters(df, list(sexo = "Mujer"), mode = "lenient")
  expect_equal(out3$sexo, "Mujer")
})

test_that("politica 5.6: el formato dashboard activa lenient automaticamente y comparte la politica", {
  df <- data.frame(
    sexo = c("Mujer", "Hombre", NA_character_),
    edad = c(25, 40, 30),
    stringsAsFactors = FALSE
  )

  # Var ausente ignorada + filtro real aplicado, en una sola pasada.
  out <- .apply_named_filters(
    df,
    list(
      list(var = "no_existe", valores = list("X")),
      list(var = "sexo", valores = list("Mujer"))
    )
  )
  expect_equal(nrow(out), 1L)
  expect_equal(out$sexo, "Mujer")

  # El puente numerico tambien rige para el formato dashboard.
  out2 <- .apply_named_filters(
    df,
    list(list(var = "edad", valores = list("25.0")))
  )
  expect_equal(out2$edad, 25)
})

test_that("politica 5.6: apply_named_filters_safe respeta el modo lenient", {
  df <- data.frame(sexo = c("Mujer", "Hombre"), stringsAsFactors = FALSE)
  # En lenient la columna ausente NO degrada a 0 filas: se ignora.
  expect_warning(
    out <- .apply_named_filters_safe(df, list(no_existe = "X"), mode = "lenient"),
    NA
  )
  expect_identical(out, df)
})

