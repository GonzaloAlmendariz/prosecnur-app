test_that("corte cliente hereda filtro real/prueba de Carga sin mutar la fuente", {
  snapshot <- list(data = data.frame(
    .source_role = c("barrido", "barrido", "respuestas", "respuestas", "respuestas"),
    `Intro/testreal` = c(NA, NA, "real", "test", "real"),
    valor = 1:5,
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  session_state <- list(estudio = list(
    active_base = "principal",
    bases = list(principal = list(universe_filter = list(
      enabled = TRUE,
      variable = "testreal",
      real_values = list("real")
    )))
  ))
  filtered <- monitoreo_client_snapshot_with_carga_universe(snapshot, session_state)
  expect_equal(nrow(snapshot$data), 5L)
  expect_equal(nrow(filtered$data), 4L)
  expect_equal(sum(filtered$data$.source_role == "respuestas"), 2L)
  expect_equal(filtered$report_universe_filter$excluded, 1L)
  expect_identical(filtered$report_universe_filter$column, "Intro/testreal")
})

test_that("corte cliente aplica correcciones y exclusiones registradas en Carga", {
  snapshot <- list(data = data.frame(
    .source_role = c("barrido", rep("respuestas", 6L)),
    `Detalles/Codigo` = c(NA, "A", "B", "PRUEBA", "R1", "R2", "DUP"),
    `Intro/testreal` = c(NA, "test", "test", "test", "real", "real", "real"),
    `Intro/Consent` = c(NA, "Yes", "Yes", "Yes", "No", "No", "Yes"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  session_state <- list(estudio = list(
    active_base = "principal",
    bases = list(principal = list(universe_filter = list(
      enabled = TRUE,
      variable = "testreal",
      real_values = list("real"),
      test_values = list("test"),
      corrections = list(
        list(id = "A_real", key_variable = "Codigo", key_values = list("A"),
             variable = "testreal", from_values = list("test"), to_value = "real"),
        list(id = "B_real", key_variable = "Codigo", key_values = list("B"),
             variable = "testreal", from_values = list("test"), to_value = "real")
      ),
      exclusion_rules = list(
        list(id = "rechazo", variable = "Consent", values = list("No"))
      )
    )))
  ))

  filtered <- monitoreo_client_snapshot_with_carga_universe(snapshot, session_state)

  expect_equal(nrow(snapshot$data), 7L)
  expect_equal(sum(filtered$data$.source_role == "respuestas"), 3L)
  expect_equal(
    filtered$data$`Detalles/Codigo`[filtered$data$.source_role == "respuestas"],
    c("A", "B", "DUP")
  )
  expect_true(all(
    filtered$data$`Intro/testreal`[filtered$data$.source_role == "respuestas"] == "real"
  ))
  expect_equal(filtered$report_universe_filter$responses_before, 6L)
  expect_equal(filtered$report_universe_filter$responses_after, 3L)
  expect_equal(filtered$report_universe_filter$corrected, 2L)
  expect_equal(filtered$report_universe_filter$excluded_test, 1L)
  expect_equal(filtered$report_universe_filter$excluded_rules, 2L)
})

test_that("endpoint PDF filtra las pruebas antes de construir el modelo cliente", {
  source <- paste(deparse(body(mount_monitoreo), width.cutoff = 500L), collapse = "\n")
  route_start <- regexpr("/api/monitoreo/client-report/pdf", source, fixed = TRUE)[[1L]]
  route_tail <- substr(source, route_start, nchar(source))
  route_end <- regexpr("/api/monitoreo/client-report/pdf/download", route_tail, fixed = TRUE)[[1L]]
  route <- substr(route_tail, 1L, route_end - 1L)

  filter_pos <- regexpr(
    "snapshot <- monitoreo_client_snapshot_with_carga_universe(snapshot, s)",
    route,
    fixed = TRUE
  )[[1L]]
  config_pos <- regexpr("cfg <- monitoreo_normalize_config", route, fixed = TRUE)[[1L]]
  model_pos <- regexpr(
    "model <- .monitoreo_client_report_model_for_snapshot",
    route,
    fixed = TRUE
  )[[1L]]

  expect_gt(filter_pos, 0L)
  expect_lt(filter_pos, config_pos)
  expect_lt(filter_pos, model_pos)
})

test_that("fechas telefónicas equivalentes se normalizan y outliers se documentan", {
  daily <- data.frame(
    Fecha = c("01/07/2026", "1/07/2026", "2026-07-02", "30/06/2020", "Sin fecha"),
    Barridos = c(2, 3, 4, 9, 8),
    `Efectivas Kobo` = c(1, 1, 2, 4, 3),
    check.names = FALSE
  )
  normalized <- .mtpdf_normalize_daily(daily)
  expect_equal(nrow(normalized$data), 2L)
  expect_equal(normalized$data$Barridos, c(5, 4))
  expect_equal(normalized$outside, 1L)
  expect_equal(normalized$invalid, 1L)
})

test_that("series telefónicas completamente vacías no se convierten en cero", {
  expect_true(is.na(.mtpdf_sum_or_na(c(NA, NA))))
  expect_true(is.na(.mtpdf_sum_or_na(c("", NA))))
  expect_equal(.mtpdf_sum_or_na(c(2, NA, 3)), 5)
})

test_that("avance cuenta respuestas efectivas aunque compartan código de contacto", {
  data <- data.frame(
    .source_role = rep("respuestas", 3L),
    CodPulso = c("PDM1158", "PDM1158", "PDM1200"),
    kobo_fecha_iso = c("2026-07-02", "2026-07-02", "2026-07-03"),
    Sede = c("Centro", "Centro", "Sur"),
    stringsAsFactors = FALSE
  )
  model <- list(
    metrics = list(kobo_effective = 2L),
    daily = data.frame(
      Fecha = as.Date(c("2026-07-02", "2026-07-03")),
      `Efectivas Kobo` = c(1L, 1L),
      check.names = FALSE
    ),
    quotas = data.frame(
      Variable = c("Sede", "Sede"),
      Valor = c("Centro", "Sur"),
      Efectivas = c(1L, 1L),
      stringsAsFactors = FALSE
    )
  )

  reconciled <- .mtpdf_reconcile_response_counts(model, data)

  expect_equal(reconciled$metrics$kobo_effective, 3L)
  expect_equal(reconciled$daily$`Efectivas Kobo`, c(2L, 1L))
  expect_equal(reconciled$quotas$Efectivas, c(2L, 1L))
})

test_that("la reconciliación no cuenta respuestas sin consentimiento ni de prueba", {
  # Regresión: el modelo del PDF sobreescribía Efectivas con un table() crudo de
  # las filas de plataforma, sin aplicar el filtro de efectividad del perfil. La
  # fila quedaba contradiciéndose sola: Efectivas de la cuota no producía el
  # "Avance meta" ni la "Brecha" de esa misma fila, calculados por el motor.
  data <- data.frame(
    .source_role = rep("respuestas", 5L),
    CodPulso = c("MV0001", "MV0002", "MV0003", "MV0004", "MV0005"),
    kobo_fecha_iso = rep("2026-08-04", 5L),
    Actor = c("Homologación", "Homologación", "Homologación", "Homologación", "Vinculación"),
    `Intro/Consent` = c("Yes", "Yes", "No", "Yes", "Yes"),
    `Intro/testreal` = c("real", "real", "real", "test", "real"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  profile <- list(
    family = "telefonico",
    platform_effective_filter = list(enabled = TRUE, variable = "Intro/Consent", values = list("Yes")),
    platform_test_filter = list(enabled = TRUE, variable = "Intro/testreal",
                                values = list("test"), real_values = list("real"))
  )
  model <- list(
    metrics = list(kobo_effective = 0L),
    daily = data.frame(Fecha = as.Date("2026-08-04"), `Efectivas Kobo` = 0L, check.names = FALSE),
    quotas = data.frame(
      Variable = c("Actor", "Actor"),
      Valor = c("Homologación", "Vinculación"),
      Efectivas = c(2L, 1L),
      stringsAsFactors = FALSE
    )
  )

  reconciled <- .mtpdf_reconcile_response_counts(model, data, profile)

  # De las 4 respuestas de Homologación, una no consintió y otra es de prueba.
  expect_equal(reconciled$quotas$Efectivas, c(2L, 1L))
  expect_equal(reconciled$metrics$kobo_effective, 3L)
  expect_equal(reconciled$daily$`Efectivas Kobo`, 3L)
})

test_that("la cuota reconciliada no se contradice: avance y brecha salen de sus efectivas", {
  # Regresión: 86058c82 sobreescribía Efectivas y dejaba "Avance meta", "Brecha" y
  # "Estado cuota" con el cálculo del motor. La fila afirmaba dos cifras
  # incompatibles sobre la misma cuota.
  data <- data.frame(
    .source_role = rep("respuestas", 4L),
    kobo_fecha_iso = rep("2026-08-04", 4L),
    Actor = c(rep("Homologación", 3L), "Vinculación"),
    stringsAsFactors = FALSE
  )
  model <- list(
    quotas = data.frame(
      Variable = c("Actor", "Actor"),
      Valor = c("Homologación", "Vinculación"),
      Meta = c(4L, 1L),
      Efectivas = c(1L, 1L),
      `Avance meta` = c(25, 100),
      Brecha = c(3L, 0L),
      `Estado cuota` = c("Brecha", "Cumple"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )

  q <- .mtpdf_reconcile_response_counts(model, data)$quotas

  expect_equal(q$Efectivas, c(3L, 1L))
  expect_equal(q$`Avance meta`, c(75, 100))
  expect_equal(q$Brecha, c(1L, 0L))
  expect_equal(q$`Estado cuota`, c("Brecha", "Cumple"))

  # La invariante que no se puede volver a romper: el avance de cada fila es su
  # propio conteo sobre su propia meta.
  expect_equal(q$`Avance meta`, round(100 * q$Efectivas / q$Meta, 1))
  expect_equal(q$Brecha, pmax(0L, q$Meta - q$Efectivas))
})

test_that("la brecha reconciliada no baja de cero al superar la meta", {
  data <- data.frame(
    .source_role = rep("respuestas", 3L),
    kobo_fecha_iso = rep("2026-08-04", 3L),
    Actor = rep("Homologación", 3L),
    stringsAsFactors = FALSE
  )
  model <- list(quotas = data.frame(
    Variable = "Actor", Valor = "Homologación", Meta = 2L, Efectivas = 0L,
    `Avance meta` = 0, Brecha = 2L, `Estado cuota` = "Brecha",
    check.names = FALSE, stringsAsFactors = FALSE
  ))

  q <- .mtpdf_reconcile_response_counts(model, data)$quotas

  expect_equal(q$Efectivas, 3L)
  expect_equal(q$`Avance meta`, 150)
  expect_equal(q$Brecha, 0L)
  expect_equal(q$`Estado cuota`, "Cumple")
})

test_that("sin perfil telefónico la reconciliación conserva su conteo por filas", {
  # El filtro solo aplica a la familia telefónica: sin perfil, el comportamiento
  # de 86058c82 (contar respuestas, no códigos únicos) queda intacto.
  data <- data.frame(
    .source_role = rep("respuestas", 3L),
    kobo_fecha_iso = rep("2026-08-04", 3L),
    Sede = c("Centro", "Centro", "Sur"),
    `Intro/Consent` = c("Yes", "No", "Yes"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  model <- list(
    metrics = list(kobo_effective = 0L),
    quotas = data.frame(
      Variable = c("Sede", "Sede"), Valor = c("Centro", "Sur"),
      Efectivas = c(0L, 0L), stringsAsFactors = FALSE
    )
  )

  reconciled <- .mtpdf_reconcile_response_counts(model, data)

  expect_equal(reconciled$quotas$Efectivas, c(2L, 1L))
  expect_equal(reconciled$metrics$kobo_effective, 3L)
})

test_that("reporte cliente conserva las cifras de referencia y composición", {
  model <- list(
    metrics = list(total = 2296L, swept = 631L, not_swept = 1665L, phone_effective = 222L, kobo_effective = 423L),
    daily = data.frame(
      Fecha = as.Date(c("2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06")),
      `Efectivas Kobo` = c(14, 74, 109, 133, 75, 15, 3),
      check.names = FALSE
    ),
    quotas = data.frame(
      Variable = rep("Sede", 5),
      Valor = c("Cercado", "Chorrillos", "Pueblo Libre", "SJL", "SMP"),
      Universo = c(501, 246, 337, 614, 598),
      Meta = c(95, 58, 41, 107, 99),
      Efectivas = c(100, 59, 45, 109, 110),
      `No barridos` = c(360, 166, 243, 456, 440),
      check.names = FALSE
    ),
    universe_filter = list(applied = TRUE, responses_before = 430L, responses_after = 427L, excluded = 3L)
  )
  facts <- .mtpdf_report_facts(model)
  expect_equal(facts$quota_target, 400)
  expect_equal(facts$quota_actual, 423)
  expect_equal(facts$quota_pct, 105.75)
  expect_equal(facts$quota_margin, 23)
  expect_equal(facts$quotas_met, 5L)
  expect_equal(facts$quotas_total, 5L)
  expect_equal(facts$reached_date, as.Date("2026-07-04"))
  expect_equal(facts$best_value, 133)
  expect_equal(facts$best_date, as.Date("2026-07-03"))
  expect_equal(facts$daily_average, 423 / 7)
  expect_equal(facts$coverage_pct, 100 * 631 / 2296)
  expect_equal(facts$phone_effective, 222)
  expect_equal(facts$phone_non_effective, 409)
  expect_equal(facts$phone_effectiveness_pct, 100 * 222 / 631)
  expect_true(facts$has_phone_effectiveness)
  expect_equal(facts$real_responses, 427)
  expect_equal(facts$total_valid, 427)
  expect_equal(facts$test_excluded, 3)
})

test_that("facts usa respuestas válidas aunque el estudio no tenga cuotas", {
  model <- list(
    metrics = list(total = 40L, swept = 20L, not_swept = 20L, kobo_effective = 12L),
    daily = data.frame(
      Fecha = as.Date(c("2026-07-01", "2026-07-02")),
      `Efectivas Kobo` = c(5L, 7L),
      check.names = FALSE
    ),
    quotas = data.frame()
  )

  expect_error(facts <- .mtpdf_report_facts(model), NA)
  expect_equal(facts$total_valid, 12)
  expect_false(facts$has_phone_effectiveness)
  expect_length(facts$quota_dimensions, 0L)
  expect_equal(nrow(facts$quota_rows), 0L)
})

test_that("cuotas sin meta preservan la ausencia de referencia", {
  model <- list(
    metrics = list(kobo_effective = 30L),
    quotas = data.frame(
      Variable = rep("Sexo", 3L),
      Valor = c("Mujer", "Hombre", "Otro"),
      Efectivas = c(17L, 12L, 1L),
      stringsAsFactors = FALSE
    )
  )

  expect_error(facts <- .mtpdf_report_facts(model), NA)
  expect_length(facts$quota_dimensions, 1L)
  expect_identical(facts$quota_dimensions[[1L]]$label, "Sexo")
  expect_false(facts$quota_dimensions[[1L]]$has_targets)
  expect_true(all(is.na(facts$quota_dimensions[[1L]]$rows$target)))
  expect_equal(facts$total_valid, 30)
})

test_that("una columna categórica arbitraria define la dimensión sin hardcodeo", {
  model <- list(
    metrics = list(kobo_effective = 20L),
    quotas = data.frame(
      `Tipo de hogar` = c("Unipersonal", "Familiar"),
      Meta = c(8L, 12L),
      Efectivas = c(9L, 11L),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )

  facts <- .mtpdf_report_facts(model)
  expect_identical(facts$primary_quota_dimension, "Tipo de hogar")
  expect_equal(facts$quota_rows$segment, c("Unipersonal", "Familiar"))
  expect_equal(facts$total_valid, 20)
})

test_that("múltiples dimensiones permanecen separadas y no duplican el total", {
  model <- list(
    metrics = list(kobo_effective = 30L),
    quotas = data.frame(
      Variable = c(rep("Sexo", 2L), rep("Edad", 2L)),
      Valor = c("Mujer", "Hombre", "18 a 34", "35 o más"),
      Meta = c(18L, 12L, 16L, 14L),
      Efectivas = c(17L, 13L, 15L, 15L),
      stringsAsFactors = FALSE
    )
  )

  facts <- .mtpdf_report_facts(model)
  expect_equal(unname(vapply(facts$quota_dimensions, `[[`, character(1), "label")), c("Sexo", "Edad"))
  expect_equal(unname(vapply(facts$quota_dimensions, function(x) sum(x$rows$actual), numeric(1))), c(30, 30))
  expect_equal(facts$total_valid, 30)
  expect_identical(facts$primary_quota_dimension, "Sexo")
  expect_equal(facts$quota_actual, 30)
  expect_equal(facts$quota_target, 30)
})

test_that("pendientes desconocidos no fabrican cobertura por categoría", {
  model <- list(
    metrics = list(total = 100L, swept = 60L, not_swept = 40L, kobo_effective = 30L),
    quotas = data.frame(
      Variable = rep("Región", 2L),
      Valor = c("Norte", "Sur"),
      Universo = c(55L, 45L),
      Pendientes = c(NA_real_, NA_real_),
      Meta = c(17L, 13L),
      Efectivas = c(18L, 12L),
      stringsAsFactors = FALSE
    )
  )

  facts <- .mtpdf_report_facts(model)
  rows <- facts$quota_dimensions[[1L]]$rows
  expect_true(all(is.na(rows$pending)))
  expect_true(all(is.na(rows$swept)))
  expect_true(all(is.na(rows$coverage_pct)))
  expect_false(facts$has_category_coverage)
})

.mtpdf_test_model <- function(variable, values, actual, target = NULL, with_coverage = FALSE) {
  stopifnot(length(values) == length(actual))
  quotas <- data.frame(
    Variable = rep(variable, length(values)),
    Valor = values,
    Efectivas = actual,
    stringsAsFactors = FALSE
  )
  if (!is.null(target)) quotas$Meta <- target
  if (isTRUE(with_coverage)) {
    quotas$Universo <- actual * 4L
    quotas$Pendientes <- actual * 2L
  }
  total_valid <- sum(actual)
  list(
    schema = "monitoreo_telefonico_advance_report_v1",
    report_kind = "telefonico_advance_pdf",
    family = "telefonico",
    generated_at = "2026-07-14 12:00 -05",
    metrics = list(
      total = total_valid * 4L,
      swept = total_valid * 2L,
      not_swept = total_valid * 2L,
      kobo_effective = total_valid
    ),
    daily = data.frame(
      Fecha = as.Date(c("2026-07-01", "2026-07-02", "2026-07-03")),
      `Efectivas Kobo` = c(floor(total_valid / 4), floor(total_valid / 3), total_valid - floor(total_valid / 4) - floor(total_valid / 3)),
      check.names = FALSE
    ),
    quotas = quotas,
    universe_filter = list(
      applied = TRUE,
      responses_before = total_valid + 2L,
      responses_after = total_valid,
      excluded = 2L
    )
  )
}

.mtpdf_test_pdf_text <- function(model) {
  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  path <- tempfile(fileext = ".pdf")
  text_path <- tempfile(fileext = ".txt")
  monitoreo_telefonico_advance_report_pdf(model, path)
  status <- system2("pdftotext", c("-layout", path, text_path))
  expect_identical(status, 0L)
  list(
    path = path,
    text = paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  )
}

.mtpdf_test_pdf_page_text <- function(model, page = 1L) {
  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  path <- tempfile(fileext = ".pdf")
  text_path <- tempfile(fileext = ".txt")
  monitoreo_telefonico_advance_report_pdf(model, path)
  status <- system2(
    "pdftotext",
    c("-f", as.character(page), "-l", as.character(page), "-layout", path, text_path)
  )
  expect_identical(status, 0L)
  paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

test_that("portada presenta la dimensión y el detalle recogido y previsto", {
  model <- .mtpdf_test_model(
    variable = "Sede",
    values = c("Cercado", "Chorrillos", "Pueblo Libre", "SJL", "SMP"),
    actual = c(100L, 59L, 45L, 109L, 110L),
    target = c(95L, 58L, 41L, 107L, 99L)
  )
  page1 <- .mtpdf_test_pdf_page_text(model)

  expect_match(page1, "Sede", fixed = TRUE)
  for (label in c("Cercado", "Chorrillos", "Pueblo Libre", "SJL", "SMP")) {
    expect_match(page1, label, fixed = TRUE)
  }
  for (value in c(100L, 59L, 45L, 109L, 110L, 95L, 58L, 41L, 107L, 99L)) {
    expect_true(grepl(paste0("\\b", value, "\\b"), page1, perl = TRUE))
  }
  expect_true(grepl("\\brecogid[ao]s?\\b", page1, ignore.case = TRUE, perl = TRUE))
  expect_true(grepl("\\bprevist[ao]s?\\b", page1, ignore.case = TRUE, perl = TRUE))
  expect_false(grepl("VARIABLE DE CUOTA", page1, fixed = TRUE))
  expect_false(grepl("categorías con mayor volumen", tolower(page1), fixed = TRUE))
  expect_false(grepl("75[.,]4%", page1, perl = TRUE))
})

test_that("portada agrega categorías excedentes sin perder las primeras", {
  labels <- c("Norte", "Sur", "Centro", "Oriente", "Occidente", "Costa", "Sierra", "Selva")
  model <- .mtpdf_test_model(
    variable = "Región",
    values = labels,
    actual = c(18L, 17L, 16L, 15L, 14L, 13L, 12L, 11L),
    target = c(20L, 19L, 18L, 17L, 16L, 15L, 14L, 13L)
  )
  page1 <- .mtpdf_test_pdf_page_text(model)

  expect_match(page1, "Región", fixed = TRUE)
  for (label in labels[seq_len(4L)]) expect_match(page1, label, fixed = TRUE)
  for (label in labels[5:8]) expect_false(grepl(label, page1, fixed = TRUE))
  expect_true(grepl("otras 4 categorías", tolower(page1), fixed = TRUE))
})

test_that("portada sin metas muestra solo cantidades recogidas", {
  model <- .mtpdf_test_model(
    variable = "Sexo",
    values = c("Mujer", "Hombre", "Otro"),
    actual = c(17L, 12L, 1L)
  )
  page1 <- .mtpdf_test_pdf_page_text(model)

  expect_match(page1, "Sexo", fixed = TRUE)
  for (label in c("Mujer", "Hombre", "Otro")) expect_match(page1, label, fixed = TRUE)
  for (value in c(17L, 12L, 1L)) {
    expect_true(grepl(paste0("\\b", value, "\\b"), page1, perl = TRUE))
  }
  expect_true(grepl("\\brecogid[ao]s?\\b", page1, ignore.case = TRUE, perl = TRUE))
  expect_false(grepl("\\bprevist[ao]s?\\b", page1, ignore.case = TRUE, perl = TRUE))
})

test_that("composición y comparación hablan del total encuestado", {
  model <- .mtpdf_test_model(
    variable = "Sede",
    values = c("Centro", "Norte", "Sur", "Este", "Oeste"),
    actual = c(6L, 6L, 6L, 6L, 6L),
    target = c(6L, 6L, 6L, 6L, 6L)
  )
  composition <- .mtpdf_test_pdf_page_text(model, page = 2L)
  comparison <- .mtpdf_test_pdf_page_text(model, page = 4L)

  expect_match(composition, "Total encuestado", fixed = TRUE)
  expect_match(composition, "del total encuestado", fixed = TRUE)
  expect_match(composition, "TOTAL ENCUESTADO", fixed = TRUE)
  expect_false(grepl("Referencia prevista", composition, fixed = TRUE))
  expect_match(comparison, "PARTICIPACIÓN EN EL TOTAL ENCUESTADO", fixed = TRUE)
  expect_false(grepl("clasificad", tolower(paste(composition, comparison)), fixed = TRUE))
})

test_that("PDF de Sexo conserva categorías y no usa vocabulario territorial", {
  model <- .mtpdf_test_model(
    variable = "Sexo",
    values = c("Mujer", "Hombre", "Otro"),
    actual = c(17L, 12L, 1L)
  )
  report <- .mtpdf_test_pdf_text(model)

  expect_false(grepl("Variable de cuota", report$text, fixed = TRUE))
  expect_match(report$text, "Sexo", fixed = TRUE)
  expect_match(report$text, "ENCUESTAS VÁLIDAS POR SEXO", fixed = TRUE)
  for (label in c("Mujer", "Hombre", "Otro")) expect_match(report$text, label, fixed = TRUE)
  expect_false(grepl("\\bsedes?\\b|\\bterritorial(?:es)?\\b", report$text, ignore.case = TRUE, perl = TRUE))
})

test_that("PDF pagina una dimensión extensa sin omitir categorías", {
  labels <- c("Norte", "Sur", "Centro", "Oriente", "Occidente", "Costa", "Sierra", "Selva")
  model <- .mtpdf_test_model(
    variable = "Región",
    values = labels,
    actual = c(12L, 11L, 10L, 9L, 8L, 7L, 6L, 5L),
    target = rep(9L, length(labels)),
    with_coverage = TRUE
  )
  report <- .mtpdf_test_pdf_text(model)

  for (label in labels) expect_match(report$text, label, fixed = TRUE)
  if (nzchar(Sys.which("pdfinfo"))) {
    info <- system2("pdfinfo", report$path, stdout = TRUE)
    pages <- as.integer(sub("^Pages:\\s+", "", grep("^Pages:", info, value = TRUE)))
    expect_gt(pages, 5L)
  }
})

test_that("PDF de una sola categoría omite páginas de composición redundantes", {
  model <- .mtpdf_test_model(
    variable = "Tipo de atención",
    values = "Telefónica",
    actual = 30L,
    target = 30L,
    with_coverage = TRUE
  )
  report <- .mtpdf_test_pdf_text(model)

  expect_match(report$text, "Tipo de atención", fixed = TRUE)
  expect_match(report$text, "Telefónica", fixed = TRUE)
  expect_false(grepl("sin un desglose diferenciado de cuota", tolower(report$text), fixed = TRUE))
  expect_false(grepl("composición de las entrevistas|distribución prevista y recogida|composición prevista y recogida", report$text, ignore.case = TRUE, perl = TRUE))
  if (nzchar(Sys.which("pdfinfo"))) {
    info <- system2("pdfinfo", report$path, stdout = TRUE)
    pages <- as.integer(sub("^Pages:\\s+", "", grep("^Pages:", info, value = TRUE)))
    expect_equal(pages, 3L)
  }
})

test_that("PDF sin cuotas no anuncia variables de cuota", {
  model <- .mtpdf_test_model(
    variable = "Sin dimensión",
    values = character(0),
    actual = numeric(0)
  )
  model$metrics <- list(total = 40L, swept = 20L, not_swept = 20L, kobo_effective = 12L)
  model$daily <- data.frame(
    Fecha = as.Date(c("2026-07-01", "2026-07-02")),
    `Efectivas Kobo` = c(5L, 7L),
    check.names = FALSE
  )
  report <- .mtpdf_test_pdf_text(model)

  expect_match(report$text, "Encuestas válidas y periodo de campo", fixed = TRUE)
  expect_false(grepl("variables de cuota", tolower(report$text), fixed = TRUE))
  expect_false(grepl("RESULTADO DE LOS CONTACTADOS", report$text, fixed = TRUE))
})

test_that("encabezado del PDF identifica el periodo de campo", {
  source <- paste(deparse(body(monitoreo_telefonico_advance_report_pdf)), collapse = "\n")

  expect_match(source, 'txt\\(\"CAMPO\"', perl = TRUE)
  expect_false(grepl("PERIODO INFORMADO", source, fixed = TRUE))
})

test_that("leyenda diaria queda centrada y separada de las fechas", {
  layout <- .mtpdf_daily_legend_layout()

  expect_equal(layout$x + layout$width / 2, 0.050 + 0.640 / 2)
  expect_gt(layout$y - 0.135, 0.015)
  expect_gt(0.188 - layout$y, 0.025)
})

test_that("tipografía del PDF respeta el mínimo legible", {
  source <- paste(deparse(body(monitoreo_telefonico_advance_report_pdf)), collapse = "\n")
  if (exists(".mtpdf_safe_font_size", mode = "function", inherits = TRUE)) {
    expect_gte(.mtpdf_safe_font_size(1), 7)
    expect_gte(.mtpdf_safe_font_size(6.9), 7)
    expect_equal(.mtpdf_safe_font_size(9), 9)
    expect_match(source, ".mtpdf_safe_font_size", fixed = TRUE)
  } else {
    hits <- regmatches(source, gregexpr("size\\s*=\\s*[0-9]+(?:\\.[0-9]+)?", source, perl = TRUE))[[1L]]
    sizes <- as.numeric(sub(".*=\\s*", "", hits))
    expect_true(length(sizes) > 0L)
    expect_gte(min(sizes), 7)
  }
})

test_that("runner telefónico genera PDF cliente de avance y cuotas", {
  model <- list(
    schema = "monitoreo_telefonico_advance_report_v1",
    report_kind = "telefonico_advance_pdf",
    family = "telefonico",
    generated_at = "2026-07-14 12:00 -05",
    synced_at = "2026-07-10T16:44:42Z",
    metrics = list(total = 100L, swept = 60L, not_swept = 40L, phone_effective = 25L, kobo_effective = 30L),
    daily = data.frame(Fecha = as.Date(c("2026-07-01", "2026-07-02")), Barridos = c(20, 40), `Efectivas telefónicas` = c(10, 15), `Efectivas Kobo` = c(12, 18), check.names = FALSE),
    daily_quality = list(invalid = 0L, outside = 0L),
    quotas = data.frame(
      Variable = rep("Sede", 5L),
      Valor = c("Centro", "Norte", "Sur", "Este", "Oeste"),
      Universo = c(20L, 20L, 20L, 20L, 20L),
      Pendientes = c(8L, 8L, 8L, 8L, 8L),
      Meta = c(6L, 6L, 6L, 6L, 6L),
      Efectivas = c(6L, 6L, 6L, 6L, 6L)
    ),
    sources = data.frame(Rol = c("barrido", "respuestas"), Fuente = c("Barrido", "Kobo"), Registros = c(100L, 30L)),
    methodology = "Sin datos individuales.",
    universe_filter = list(applied = TRUE, excluded = 3L)
  )
  model_path <- tempfile(fileext = ".rds")
  result_path <- tempfile(fileext = ".pdf")
  saveRDS(model, model_path)
  out <- monitoreo_client_report_pdf_job_runner(model_path, result_path = result_path)
  expect_true(out$ok)
  expect_true(file.exists(result_path))
  expect_gt(file.info(result_path)$size, 5000)
  expect_identical(readBin(result_path, "raw", 4), charToRaw("%PDF"))
  if (nzchar(Sys.which("pdfinfo"))) {
    info <- system2("pdfinfo", result_path, stdout = TRUE)
    expect_true(any(grepl("Pages:\\s+5", info)))
  }
  if (nzchar(Sys.which("pdftotext"))) {
    text_path <- tempfile(fileext = ".txt")
    system2("pdftotext", c("-layout", result_path, text_path))
    report_text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    page1_path <- tempfile(fileext = ".txt")
    page1_status <- system2("pdftotext", c("-f", "1", "-l", "1", "-layout", result_path, page1_path))
    expect_identical(page1_status, 0L)
    page1_text <- paste(readLines(page1_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    expect_false(grepl("Variable de cuota", report_text, fixed = TRUE))
    expect_false(grepl("periodo informado", report_text, ignore.case = TRUE))
    expect_false(grepl("TOTAL AL CIERRE", report_text, fixed = TRUE))
    expect_false(grepl("Variable de referencia|POR CATEGORÍA|CATEGORÍAS INCLUIDAS", report_text, ignore.case = TRUE, perl = TRUE))
    expect_match(report_text, "Sede", fixed = TRUE)
    expect_match(report_text, "Distribución prevista y recogida", fixed = TRUE)
    expect_false(grepl("DATOS CONSIDERADOS", report_text, fixed = TRUE))
    expect_false(grepl("El avance y la composición consideran", report_text, fixed = TRUE))
    expect_false(grepl("pruebas retiradas", report_text, fixed = TRUE))
    expect_match(report_text, "registros contactados", ignore.case = TRUE)
    expect_match(report_text, "no contactados", ignore.case = TRUE)
    expect_match(report_text, "RESULTADO DE LOS CONTACTADOS", fixed = TRUE)
    expect_match(report_text, "CONTACTOS EFECTIVOS", fixed = TRUE)
    expect_match(report_text, "CONTACTOS NO EFECTIVOS", fixed = TRUE)
    expect_match(report_text, "41.7% de contactados", fixed = TRUE)
    expect_false(grepl("revisad|por revisar|por contactar", report_text, ignore.case = TRUE, perl = TRUE))
    expect_false(grepl("La composición se presenta para la variable", report_text, fixed = TRUE))
    forbidden <- paste(
      "trazabilidad", "lectura ejecutiva", "lectura del ritmo",
      "balance de la muestra", "meta cumplida", "cuotas cumplidas",
      "margen", "mejor día", "\\bpp\\b", "máxima desviación",
      "respuestas reales", "cumplimiento", "de la meta",
      sep = "|"
    )
    expect_false(grepl(forbidden, report_text, ignore.case = TRUE, perl = TRUE))
  }
})
