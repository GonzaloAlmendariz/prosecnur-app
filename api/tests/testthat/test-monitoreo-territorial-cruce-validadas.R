# 2h (Gonzalo, 2026-11-01): el cruce con coordinación cuenta efectivas validadas
# (`advance_valid`, la base del avance), no casos con consentimiento. El motor
# publica `observed_valid_cross` por manzana con todos los rangos de la meta,
# también los de meta 0, para que ningún caso validado caiga fuera de su celda.

.tcv_payload <- function(audit) {
  local_mocked_bindings(.hojas_ruta_reference_quota_marginals = function(block, config) NULL, .env = parent.frame())
  context <- list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001007", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES",
                       zona = "001", manzana = "007", hoja_num = 7, entrevistas = 4, territorio_muestral = "150133-001")),
    quota = list(cells = list(
      list(id_manzana = "150133001007", ubigeo = "150133", territorio = "150133-001", rango_edad = "18-29", sexo = "Hombre", cuota = 2),
      list(id_manzana = "150133001007", ubigeo = "150133", territorio = "150133-001", rango_edad = "30-44", sexo = "Mujer", cuota = 2),
      list(id_manzana = "150133001007", ubigeo = "150133", territorio = "150133-001", rango_edad = "45-59", sexo = "Mujer", cuota = 0)
    ))
  )
  operational_blocks <- .monitoreo_territorial_block_goal_df(context, include_replacements = TRUE)
  .monitoreo_territorial_quota_progress_payload(context, operational_blocks, audit, list(age_var = "Core/E1_age", sex_var = "sexo"))
}

.tcv_totales <- function(items) {
  stats::setNames(vapply(items, function(x) as.integer(x$total %||% 0L), integer(1)),
                  vapply(items, function(x) as.character(x$label %||% ""), character(1)))
}

test_that("el cruce validado cuenta advance_valid, no el consentimiento", {
  audit <- data.frame(
    advance_block_id = "", declared_ump_raw = "7", declared_ump_normalized = "", advance_block_ump = "",
    ubigeo = "150133", advance_block_ubigeo = "150133",
    # La tercera tiene consentimiento pero no es válida (p. ej. menor o duplicada).
    advance_valid = c(TRUE, TRUE, FALSE, TRUE),
    consent = c("1", "1", "1", "1"),
    sex = c("Hombre", "Mujer", "Hombre", "Mujer"),
    age = c(25, 40, 25, 50),
    stringsAsFactors = FALSE
  )
  block <- .tcv_payload(audit)$blocks[[1]]
  validas <- block$observed_valid_cross
  expect_identical(validas$source, "kobo_validadas")
  expect_identical(.tcv_totales(validas$rows)[["Hombre"]], 1L)
  expect_identical(sum(.tcv_totales(validas$rows)), block$observed_validas)
  # El de consentimiento sigue igual: cuenta las cuatro.
  expect_identical(sum(.tcv_totales(block$observed_cross$rows)), 4L)
})

test_that("un caso validado en un rango con meta 0 queda en su celda, no en «Sin dato»", {
  audit <- data.frame(
    advance_block_id = "", declared_ump_raw = "7", declared_ump_normalized = "", advance_block_ump = "",
    ubigeo = "150133", advance_block_ubigeo = "150133",
    advance_valid = TRUE, consent = "1",
    sex = c("Mujer", "Mujer"), age = c(50, NA),
    stringsAsFactors = FALSE
  )
  columnas <- .tcv_totales(.tcv_payload(audit)$blocks[[1]]$observed_valid_cross$columns)
  expect_identical(columnas[["45-59"]], 1L)
  expect_identical(columnas[["Sin dato"]], 1L)
})

test_that("sexo fuera de H/M va a «Sin dato» y una manzana sin válidas no rompe", {
  base <- function(sex, valid) data.frame(
    advance_block_id = "", declared_ump_raw = "7", declared_ump_normalized = "", advance_block_ump = "",
    ubigeo = "150133", advance_block_ubigeo = "150133", advance_valid = valid, consent = "1",
    sex = sex, age = 25, stringsAsFactors = FALSE)
  filas <- .tcv_totales(.tcv_payload(base(c("Otro", "Hombre"), TRUE))$blocks[[1]]$observed_valid_cross$rows)
  expect_identical(filas[["Sin dato"]], 1L)
  vacia <- .tcv_payload(base("Hombre", FALSE))$blocks[[1]]$observed_valid_cross
  expect_identical(sum(.tcv_totales(vacia$rows)), 0L)
})

test_that("sin la variable de edad en la base, la edad no es evaluable", {
  audit <- data.frame(
    advance_block_id = "", declared_ump_raw = "7", declared_ump_normalized = "", advance_block_ump = "",
    ubigeo = "150133", advance_block_ubigeo = "150133", advance_valid = TRUE, consent = "1",
    sex = "Hombre", stringsAsFactors = FALSE)
  cruce <- .tcv_payload(audit)$blocks[[1]]$observed_valid_cross
  expect_false(cruce$age_evaluable)
  expect_true(cruce$sex_evaluable)
})
