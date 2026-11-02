# Una sola cuenta de efectivas en territorial (Gonzalo, 2026-11-02: «Ambos deben
# contar las efectivas de Kobo, las observadas están en observación pero no
# quitan la cuenta»). Home lee `kpis$validas` y Avance `advance$validas`: con
# casos en observación los dos dan la misma cifra, y la observación queda como
# marca aparte con su conteo.

test_that("Home y Avance cuentan las mismas efectivas, las en observación incluidas", {
  n <- 6L
  end_time <- as.POSIXct("2026-06-13 15:00:00", tz = "UTC") + seq_len(n) * 60
  data <- data.frame(
    `Core/M5_district` = rep("sjm", n),
    `_geolocation` = rep("-12.1 -77.0", n),
    consent = rep("1", n),
    # La sexta es menor de edad: no es efectiva.
    `Core/E1_age` = c(25, 30, 41, 52, 63, 15),
    `_status` = rep("submitted_via_web", n),
    `_uuid` = sprintf("caso-%02d", seq_len(n)),
    `_submitted_by` = rep("enc1", n),
    start = format(end_time - 600, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    end = format(end_time, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(monitoreo_profile = list(family = "territorial", status = "active")), data)
  context <- list(
    phase = "pilot",
    blocks = list(list(id_manzana = "150133001001", ubigeo = "150133", distrito = "SAN JUAN DE MIRAFLORES", zona = "001", manzana = "001", entrevistas = 4)),
    geo_results = data.frame(
      lat = rep(-12.1, n),
      lon = rep(-77, n),
      gps_parseable = rep(TRUE, n),
      # Dos efectivas con el GPS en revisión: quedan en observación.
      geo_estado = c("geo_ok", "geo_ok", "geo_ok", "geo_revision", "geo_revision", "geo_ok"),
      distance_m = rep(0, n),
      nearest_block_id = rep("150133001001", n),
      nearest_block_type = rep("titular", n),
      geometry_match = rep("inside_selected_block", n),
      stringsAsFactors = FALSE
    )
  )

  report <- monitoreo_territorial_reportes(data, cfg, context, report_scope = "full")

  expect_identical(report$advance$validas, 5L)
  expect_identical(report$kpis$validas, report$advance$validas)
  expect_identical(report$kpis$revision, 2L)
  expect_identical(report$kpis$revision, report$advance$observacion)
  expect_equal(report$kpis$avance_pct, report$advance$avance_pct)
  expect_identical(report$kpis$efectivas, report$kpis$validas)
  # Efectivas y no defendibles particionan el total; la observación es un
  # subconjunto de las efectivas, nunca se suma.
  expect_identical(report$kpis$validas + report$kpis$no_defendibles, report$kpis$total_respuestas)

  # Por día, por responsable y por manzana se cuentan las mismas efectivas.
  suma <- function(xs, campo) sum(vapply(xs %||% list(), function(x) as.integer(x[[campo]] %||% 0L), integer(1)))
  expect_identical(suma(report$daily, "validas"), report$kpis$validas)
  expect_identical(suma(report$daily, "revision"), report$kpis$revision)
  expect_identical(suma(report$team, "validas"), report$kpis$validas)

  # Lo que pinta la tarjeta del Home sale de esos kpis: la misma cifra, rotulada
  # «efectivas», con las en observación como alerta.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", list(monitoreo_profile = list(family = "territorial")))
  session_set(sid, "monitoreo_snapshot", list(dashboard = list(territorial_reports = report)))
  mon <- .project_overview_payload(sid)$facts$monitoreo
  expect_identical(mon$valid, report$advance$validas)
  expect_identical(mon$valid_label, "efectivas")
  expect_identical(mon$alerts, 2L)
})

test_that("la cuenta compartida no resta las en observación", {
  audit <- data.frame(
    advance_valid = c(TRUE, TRUE, TRUE, FALSE, NA),
    observation_status = c("sin_observacion", "en_observacion", "en_observacion", "no_valida", "sin_observacion"),
    stringsAsFactors = FALSE
  )
  cuenta <- .monitoreo_territorial_efectivas(audit)
  expect_identical(cuenta$efectivas, 3L)
  expect_identical(cuenta$en_observacion, 2L)
  expect_identical(cuenta$no_validas, 2L)
})

test_that("un corte anterior a la cuenta única se lee como validadas más en observación", {
  expect_identical(monitoreo_territorial_efectivas_de_kpis(list(validas = 1028L, revision = 255L)), 1283L)
  expect_identical(monitoreo_territorial_efectivas_de_kpis(list(validas = 1283L, efectivas = 1283L, revision = 255L)), 1283L)
  expect_identical(monitoreo_territorial_efectivas_de_kpis(NULL), 0L)
})

test_that("sin advance_valid la cuenta cae a validation_status: validada + revision", {
  audit <- data.frame(validation_status = c("validada", "revision", "no_defendible", "validada"), stringsAsFactors = FALSE)
  cuenta <- .monitoreo_territorial_efectivas(audit)
  expect_identical(cuenta$efectivas, 3L)
  expect_identical(cuenta$en_observacion, 1L)
  expect_identical(cuenta$no_validas, 1L)
})

test_that("el avance por manzana cuenta efectivas, las en observación incluidas", {
  blocks <- data.frame(id_manzana = c("M1", "M2"), ubigeo = "150133", distrito = "SJM", zona = "001",
                       manzana = c("001", "002"), entrevistas = c(2L, 2L), stringsAsFactors = FALSE)
  audit <- data.frame(
    advance_block_id = c("M1", "M1", "M2", "M2"),
    validation_status = c("validada", "revision", "revision", "no_defendible"),
    advance_valid = c(TRUE, TRUE, TRUE, FALSE),
    observation_status = c("sin_observacion", "en_observacion", "en_observacion", "no_valida"),
    responsible_display = "P1", enumerator_assigned = "", submitted_by = "a",
    stringsAsFactors = FALSE
  )
  bp <- .monitoreo_territorial_block_progress(blocks, audit, block_key_col = "advance_block_id")
  expect_identical(bp[[1]]$validas, 2L)
  expect_identical(bp[[1]]$revision, 1L)
  expect_identical(bp[[2]]$validas, 1L)
  expect_identical(bp[[2]]$no_defendibles, 1L)
  expect_equal(bp[[1]]$avance_pct, 100)
})
