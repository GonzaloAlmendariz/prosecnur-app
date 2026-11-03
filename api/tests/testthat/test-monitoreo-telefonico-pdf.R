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

test_that("el día de cada encuesta válida es el de Lima, no el de UTC", {
  # RMS 2026: `kobo_fecha_iso` es el día UTC del envío. Una entrevista enviada
  # a las 22:30 de Lima (03:30Z del día siguiente) caía al día siguiente, y el
  # campo parecía seguir el 31/10 con 5 encuestas que eran del 30.
  data <- data.frame(
    .source_role = rep("respuestas", 3L),
    kobo_timestamp_iso = c("2026-10-30T15:00:00Z", "2026-10-31T03:30:33Z", "2026-10-31T04:10:00Z"),
    kobo_fecha_iso = c("2026-10-30", "2026-10-31", "2026-10-31"),
    stringsAsFactors = FALSE
  )
  model <- list(metrics = list(kobo_effective = 3L), quotas = data.frame())

  daily <- .mtpdf_reconcile_response_counts(model, data)$daily

  expect_equal(as.character(daily$Fecha), "2026-10-30")
  expect_equal(daily$`Efectivas Kobo`, 3L)
})

test_that("una dimensión que las respuestas no traen no borra las efectivas del motor", {
  # RMS 2026: el periodo de llegada vive en el barrido (`dim_actor`) y el motor
  # cruza cada respuesta con su hogar por la llave (109 / 101 / 101 / 100). Las
  # respuestas de Kobo traen la columna `dim_actor`, pero vacía: contarla
  # reescribía las cuatro cuotas con 0.
  data <- data.frame(
    .source_role = c(rep("barrido", 2L), rep("respuestas", 3L)),
    kobo_fecha_iso = c(NA, NA, rep("2026-10-30", 3L)),
    dim_actor = c("Pandemia", "Actualidad", NA, NA, NA),
    stringsAsFactors = FALSE
  )
  model <- list(
    metrics = list(kobo_effective = 3L),
    quotas = data.frame(
      Variable = c("dim_actor", "dim_actor"), Valor = c("Actualidad", "Pandemia"),
      Meta = c(2L, 2L), Efectivas = c(2L, 1L), `Avance meta` = c(100, 50),
      Brecha = c(0L, 1L), check.names = FALSE, stringsAsFactors = FALSE
    )
  )

  q <- .mtpdf_reconcile_response_counts(model, data)$quotas

  expect_equal(q$Efectivas, c(2L, 1L))
  expect_equal(q$`Avance meta`, c(100, 50))
  expect_equal(q$Brecha, c(0L, 1L))
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

# --- Render: entregable de cliente en la familia Pulso PDF ---------------------
# Checklist: docs/qa/checklist-pdf-avance-telefonico-2026-11-03.md

.mtpdf_test_model <- function(variable, values, actual, target = NULL, with_coverage = FALSE,
                              labels = NULL, extra_valid = 0L, daily_actor = FALSE) {
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
  total_valid <- sum(actual) + extra_valid
  dias <- as.Date(c("2026-07-01", "2026-07-02", "2026-07-03"))
  reparto <- function(n) c(floor(n / 4), floor(n / 3), n - floor(n / 4) - floor(n / 3))
  model <- list(
    schema = "monitoreo_telefonico_advance_report_v1",
    report_kind = "telefonico_advance_pdf",
    family = "telefonico",
    generated_at = "2026-07-14 12:00 -05",
    synced_at = "2026-07-04T15:00:00Z",
    metrics = list(
      total = total_valid * 4L,
      swept = total_valid * 2L,
      not_swept = total_valid * 2L,
      kobo_effective = total_valid
    ),
    daily = data.frame(Fecha = dias, `Efectivas Kobo` = reparto(total_valid), check.names = FALSE),
    quotas = quotas,
    quota_labels = labels %||% stats::setNames(list(variable), variable),
    universe_filter = list(applied = FALSE)
  )
  if (isTRUE(daily_actor)) {
    model$daily_actor <- do.call(rbind, lapply(seq_along(values), function(i) {
      data.frame(Actor = values[[i]], Fecha = dias, Efectivas = reparto(actual[[i]]), stringsAsFactors = FALSE)
    }))
  }
  model
}

.mtpdf_test_render <- function(model, include_targets = FALSE, portada = list()) {
  if (!nzchar(Sys.which("pdftotext"))) skip("pdftotext no está disponible")
  path <- tempfile(fileext = ".pdf")
  monitoreo_telefonico_advance_report_pdf(model, path, include_targets = include_targets, portada = portada)
  pagina <- function(n) {
    text_path <- tempfile(fileext = ".txt")
    status <- system2("pdftotext", c("-f", n, "-l", n, "-layout", path, text_path))
    expect_identical(status, 0L)
    paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  }
  info <- system2("pdfinfo", path, stdout = TRUE)
  n <- as.integer(sub("^Pages:\\s+", "", grep("^Pages:", info, value = TRUE)))
  paginas <- vapply(seq_len(n), pagina, character(1))
  # Las versalitas llevan aire entre letras: se compara sin espacios.
  list(path = path, paginas = paginas, texto = paste(paginas, collapse = "\n"),
       compacto = toupper(gsub("\\s+", "", paste(paginas, collapse = ""))))
}

.mtpdf_compacto <- function(x) toupper(gsub("\\s+", "", x))

test_that("el resumen publica previstas, válidas y faltan de cada grupo con su frecuencia", {
  model <- .mtpdf_test_model(
    variable = "Sexo", values = c("Mujer", "Hombre"),
    actual = c(52L, 41L), target = c(50L, 50L), with_coverage = TRUE
  )
  r <- .mtpdf_test_render(model, include_targets = TRUE)
  resumen <- .mtpdf_compacto(r$paginas[[2]])

  expect_match(resumen, "RESUMENDELAVANCE", fixed = TRUE)
  expect_match(resumen, "ENCUESTASVÁLIDASPORSEXO", fixed = TRUE)
  for (cifra in c("52DE50", "41DE50", "93DE100", "104.0%", "82.0%", "93.0%")) expect_match(resumen, cifra, fixed = TRUE)
  expect_match(resumen, "FALTAN", fixed = TRUE)
  # Los faltantes se suman por grupo: los 2 de más de Mujer no cubren a Hombre.
  tabla <- strsplit(r$paginas[[2]], "\n")[[1]]
  expect_match(grep("^\\s*Total", tabla, value = TRUE), "\\b9\\s*$", perl = TRUE)
  expect_false(grepl("\\bsedes?\\b|\\bterritorial(?:es)?\\b", r$texto, ignore.case = TRUE, perl = TRUE))
})

test_that("sin «Incluir metas» el documento no publica las previstas", {
  model <- .mtpdf_test_model(
    variable = "Sexo", values = c("Mujer", "Hombre"),
    actual = c(52L, 41L), target = c(50L, 50L), with_coverage = TRUE
  )
  r <- .mtpdf_test_render(model, include_targets = FALSE)

  expect_false(grepl("PREVIST", r$compacto, fixed = TRUE))
  expect_false(grepl("FALTAN", r$compacto, fixed = TRUE))
  expect_match(r$compacto, "PARTICIPACIÓNENELTOTAL", fixed = TRUE)
})

test_that("la dimensión se rotula con su columna, nunca con dim_actor", {
  model <- .mtpdf_test_model(
    variable = "dim_actor", values = c("Actualidad", "Pandemia"),
    actual = c(109L, 101L), target = c(100L, 100L), with_coverage = TRUE,
    labels = list(dim_actor = "Periodo de llegada"), daily_actor = TRUE
  )
  r <- .mtpdf_test_render(model, include_targets = TRUE)

  expect_false(grepl("dim_actor", r$texto, ignore.case = TRUE))
  expect_match(r$compacto, "ENCUESTASVÁLIDASPORPERIODODELLEGADA", fixed = TRUE)
  expect_match(r$compacto, "AVANCEDIARIOPORPERIODODELLEGADA", fixed = TRUE)
})

test_that("el rótulo interno se traduce a la columna del barrido que dice lo mismo", {
  data <- data.frame(
    .source_role = c("barrido", "barrido", "respuestas"),
    dim_actor = c("Pandemia", "Actualidad", NA),
    `Periodo de Llegada` = c("Pandemia", "Actualidad", NA),
    Origen = c("Muestra", "Muestra", NA),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  quotas <- data.frame(Variable = c("dim_actor", "Sexo"), Valor = c("Pandemia", "Mujer"))

  expect_identical(unname(.mtpdf_quota_labels(quotas, data)), c("Periodo de llegada", "Sexo"))
  expect_identical(unname(.mtpdf_quota_labels(quotas, data[, c(".source_role", "dim_actor")])), c("Grupo", "Sexo"))
})

test_that("las válidas sin grupo se suman al total con su asterisco", {
  model <- .mtpdf_test_model(
    variable = "dim_actor", values = c("Actualidad", "Pandemia"),
    actual = c(109L, 101L), target = c(100L, 100L), with_coverage = TRUE,
    labels = list(dim_actor = "Periodo de llegada"), extra_valid = 2L, daily_actor = TRUE
  )
  r <- .mtpdf_test_render(model, include_targets = TRUE)
  resumen <- .mtpdf_compacto(r$paginas[[2]])

  expect_match(resumen, "TOTAL*", fixed = TRUE)
  expect_match(resumen, "212DE200", fixed = TRUE)
  expect_match(resumen, "INCLUYE2ENCUESTASVÁLIDASSINPERIODODELLEGADAIDENTIFICADO", fixed = TRUE)
})

test_that("la tabla diaria por grupo cuadra con el total de cada día", {
  model <- .mtpdf_test_model(
    variable = "Sexo", values = c("Mujer", "Hombre"),
    actual = c(52L, 40L), target = c(50L, 50L), with_coverage = TRUE, daily_actor = TRUE
  )
  r <- .mtpdf_test_render(model, include_targets = TRUE)
  tabla <- r$paginas[[length(r$paginas)]]
  filas <- grep("^\\s*(mié|jue|vie) 0[123]/07", strsplit(tabla, "\n")[[1]], value = TRUE)
  expect_length(filas, 3L)
  for (fila in filas) {
    n <- as.numeric(regmatches(fila, gregexpr("\\b[0-9]+\\b(?!/)", sub("^.*?[0-9]{2}/07", "", fila), perl = TRUE))[[1]])
    expect_equal(n[[1]] + n[[2]], n[[3]])
  }
})

test_that("PDF sin cuotas informa válidas y ritmo sin tabla por grupo", {
  model <- .mtpdf_test_model(variable = "Sexo", values = "Todos", actual = 12L)
  model$quotas <- data.frame()
  model$quota_labels <- list()
  r <- .mtpdf_test_render(model)

  expect_match(r$compacto, "RITMODELCAMPO", fixed = TRUE)
  expect_false(grepl("ENCUESTASVÁLIDASPOR", gsub("ENCUESTASVÁLIDASPORDÍA", "", r$compacto, fixed = TRUE), fixed = TRUE))
  expect_false(grepl("RESULTADODELOSCONTACTADOS", r$compacto, fixed = TRUE))
})

test_that("la portada usa lo escrito en Salidas y el corte en hora de Lima", {
  model <- .mtpdf_test_model(variable = "Sexo", values = c("Mujer", "Hombre"), actual = c(5L, 4L))
  r <- .mtpdf_test_render(model, portada = list(subtitulo = "Results Monitoring Survey (RMS) 2026", cliente = "ACNUR Perú"))
  portada <- .mtpdf_compacto(r$paginas[[1]])

  expect_match(portada, .mtpdf_compacto("Results Monitoring Survey (RMS) 2026"), fixed = TRUE)
  expect_match(portada, .mtpdf_compacto("ACNUR Perú"), fixed = TRUE)
  expect_match(portada, .mtpdf_compacto("4 de julio de 2026, 10:00 (hora de Lima)"), fixed = TRUE)
  expect_match(portada, .mtpdf_compacto("Del 1 de julio de 2026 al 3 de julio de 2026"), fixed = TRUE)
})

test_that("runner telefónico genera PDF cliente de avance y cuotas", {
  model <- list(
    schema = "monitoreo_telefonico_advance_report_v1",
    report_kind = "telefonico_advance_pdf",
    family = "telefonico",
    generated_at = "2026-07-14 12:00 -05",
    synced_at = "2026-07-10T16:44:42Z",
    metrics = list(total = 1200L, swept = 60L, not_swept = 1140L, phone_effective = 25L, kobo_effective = 30L),
    daily = data.frame(Fecha = as.Date(c("2026-07-01", "2026-07-02")), Barridos = c(20, 40), `Efectivas telefónicas` = c(10, 15), `Efectivas Kobo` = c(12, 18), check.names = FALSE),
    daily_quality = list(invalid = 0L, outside = 0L),
    status = data.frame(Estatus = c("Efectivo", "No contesta", "No barrido"), Casos = c(25L, 35L, 1140L)),
    quotas = data.frame(
      Variable = rep("Sede", 5L),
      Valor = c("Centro", "Norte", "Sur", "Este", "Oeste"),
      Universo = c(240L, 240L, 240L, 240L, 240L),
      Pendientes = c(228L, 228L, 228L, 228L, 228L),
      Meta = c(6L, 6L, 6L, 6L, 6L),
      Efectivas = c(6L, 6L, 6L, 6L, 6L)
    ),
    quota_labels = list(Sede = "Sede"),
    sources = data.frame(Rol = c("barrido", "respuestas"), Fuente = c("Barrido", "Kobo"), Registros = c(1200L, 30L)),
    methodology = "Sin datos individuales.",
    universe_filter = list(applied = TRUE, excluded = 3L)
  )
  model_path <- tempfile(fileext = ".rds")
  result_path <- tempfile(fileext = ".pdf")
  saveRDS(model, model_path)
  out <- monitoreo_client_report_pdf_job_runner(model_path, include_targets = TRUE, result_path = result_path,
                                                portada = list(cliente = "ACNUR Perú"))
  expect_true(out$ok)
  expect_true(file.exists(result_path))
  expect_identical(readBin(result_path, "raw", 4), charToRaw("%PDF"))
  if (nzchar(Sys.which("pdfinfo"))) {
    info <- system2("pdfinfo", result_path, stdout = TRUE)
    # Portada, resumen, ritmo, cobertura y tabla diaria.
    expect_true(any(grepl("Pages:\\s+5", info)))
  }
  if (nzchar(Sys.which("pdftotext"))) {
    text_path <- tempfile(fileext = ".txt")
    system2("pdftotext", c("-layout", result_path, text_path))
    report_text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    compacto <- .mtpdf_compacto(report_text)
    expect_match(report_text, "ACNUR Perú", fixed = TRUE)
    for (frase in c("REGISTROSCONTACTADOS", "NOCONTACTADOS", "RESULTADODELOSCONTACTADOS",
                    "CONTACTOSEFECTIVOS", "CONTACTOSNOEFECTIVOS", "41.7%DECONTACTADOS")) {
      expect_match(compacto, frase, fixed = TRUE)
    }
    # Sin separador de miles: «1200», no «1,200».
    expect_match(report_text, "\\b1200\\b", perl = TRUE)
    expect_false(grepl("1,200", report_text, fixed = TRUE))
    expect_false(grepl("Variable de cuota|TOTAL AL CIERRE|DATOS CONSIDERADOS|pruebas retiradas", report_text, ignore.case = TRUE, perl = TRUE))
    expect_false(grepl("revisad|por revisar|por contactar", report_text, ignore.case = TRUE, perl = TRUE))
    forbidden <- paste(
      "trazabilidad", "lectura ejecutiva", "lectura del ritmo",
      "balance de la muestra", "meta cumplida", "cuotas cumplidas",
      "margen", "mejor día", "\\bpp\\b", "máxima desviación",
      "respuestas reales", "cumplimiento", "de la meta", "dim_actor",
      sep = "|"
    )
    expect_false(grepl(forbidden, report_text, ignore.case = TRUE, perl = TRUE))
  }
})
