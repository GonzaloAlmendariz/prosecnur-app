# Avance › UMP · exploración (docs/qa/revamp-monitoreo/territorial.md §3.16b):
# los casos de una UMP con GPS y hora, INCLUIDOS los anulados. Ningún payload
# previo los traía: `response_audit` excluye los anulados y
# `production_annulments$rows` los trae sin coordenadas. Fixture sintética:
# códigos y aplicadores ficticios, sin nombres ni DNI.

.casos_ump_fixture <- function() {
  fila <- function(id, ump, fecha, hora, pulso, consent = TRUE, valido = TRUE,
                   observacion = "sin_observacion", validacion = "validada",
                   lat = -12.05, lon = -77.03, manzana = "0170") {
    data.frame(
      response_id = id,
      submitted_by = paste("enc", pulso),
      pulso_code = pulso,
      enumerator_assigned = paste("Aplicador", pulso),
      responsible_display = paste(pulso, "·", paste("Aplicador", pulso)),
      submission_date_iso = fecha,
      submission_hour = hora,
      submission_time = paste0(fecha, "T", hora),
      duration_seconds = 720,
      lat = lat,
      lon = lon,
      gps_effective_lat = lat,
      gps_effective_lon = lon,
      gps_effective_estado = "geo_ok",
      gps_effective_distance_m = 35,
      geo_estado = "geo_ok",
      distance_m = 35,
      advance_block_id = paste0("150133022", manzana),
      advance_block_ump = paste("UMP", ump),
      advance_block_manzana = manzana,
      advance_block_type = if (manzana == "0170") "titular" else "reemplazo",
      declared_ump_normalized = ump,
      sex = "Mujer",
      age = 61,
      source_effective = consent,
      advance_valid = valido,
      observation_status = observacion,
      observation_reasons = "",
      validation_status = validacion,
      stringsAsFactors = FALSE
    )
  }
  rbind(
    # Aplicador P900: dos formularios en la titular el 17/06; uno sin consentimiento.
    fila("a2", "107", "2026-06-17", "10:40:00", "P900"),
    fila("a1", "107", "2026-06-17", "09:15:00", "P900", consent = FALSE, valido = FALSE, validacion = "no_defendible"),
    # Aplicador P901: en la de reemplazo el 28/06, uno en observación y uno sin GPS.
    fila("b1", "107", "2026-06-28", "11:00:00", "P901", manzana = "0180", observacion = "en_observacion", validacion = "revision"),
    fila("b2", "107", "2026-06-28", "11:30:00", "P901", manzana = "0180", lat = NA, lon = NA),
    # De otra UMP: no entra.
    fila("z1", "101", "2026-06-20", "08:00:00", "P902")
  )
}

.casos_ump_tcfg <- function(entries = list()) {
  list(active_route_phase = "field", production_annulments = list(pilot = list(), field = entries))
}

test_that("trae sólo los casos de la UMP, en orden de llegada y con su GPS y hora", {
  out <- monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(), "field", "UMP 0107")
  expect_true(out$ok)
  expect_equal(out$ump, "107")
  ids <- vapply(out$casos, function(caso) caso$id, character(1))
  expect_equal(ids, c("a1", "a2", "b1", "b2"))
  expect_equal(vapply(out$casos, function(caso) caso$orden, numeric(1)), c(1, 2, 3, 4))
  primero <- out$casos[[1]]
  expect_equal(primero$hora, "09:15:00")
  expect_equal(primero$lat, -12.05)
  expect_equal(primero$distancia_m, 35)
  expect_equal(primero$duracion_segundos, 720)
  expect_null(out$casos[[4]]$lat)
  expect_equal(out$resumen$con_gps, 3L)
})

test_that("cada caso lleva su estado: cuenta, observación o no cuenta", {
  out <- monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(), "field", "107")
  estados <- vapply(out$casos, function(caso) caso$estado, character(1))
  expect_equal(estados, c("no_cuenta", "cuenta", "observacion", "cuenta"))
  expect_equal(out$resumen$anulados, 0L)
})

test_that("una anulación de producción marca los casos del aplicador, con y sin consentimiento", {
  entrada <- list(id = "anul-1", phase = "field", status = "active", scope = "all_production",
                  responsible_key = "P900", responsible_label = "P900", created_at = "2026-06-26T15:00:00Z")
  out <- monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(list(entrada)), "field", "107")
  estados <- vapply(out$casos, function(caso) caso$estado, character(1))
  expect_equal(estados, c("anulado_sin_consentimiento", "anulado_efectiva", "observacion", "cuenta"))
  expect_equal(vapply(out$casos, function(caso) caso$anulado, logical(1)), c(TRUE, TRUE, FALSE, FALSE))
  # El anulado conserva su GPS: es lo que el mapa de la exploración necesita.
  expect_equal(out$casos[[2]]$lat, -12.05)
  expect_equal(out$resumen$anulados, 2L)
})

test_that("una anulación revertida no marca nada y una de un caso marca sólo ese", {
  revertida <- list(id = "anul-2", phase = "field", status = "reverted", scope = "all_production", responsible_key = "P900")
  out <- monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(list(revertida)), "field", "107")
  expect_equal(out$resumen$anulados, 0L)
  de_un_caso <- list(id = "anul-3", phase = "field", status = "active", scope = "response", response_id = "b2")
  out <- monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(list(de_un_caso)), "field", "107")
  anulados <- vapply(out$casos, function(caso) caso$anulado, logical(1))
  expect_equal(vapply(out$casos, function(caso) caso$id, character(1))[anulados], "b2")
})

test_that("acepta la auditoría como registros, que es como la publica el motor", {
  registros <- monitoreo_perf_df_records(.casos_ump_fixture())
  out <- monitoreo_territorial_casos_ump_desde_auditoria(registros, .casos_ump_tcfg(), "field", "107")
  expect_equal(out$resumen$total, 4L)
})

test_that("sin UMP o sin auditoría no inventa casos", {
  expect_equal(monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(), "field", "")$casos, list())
  expect_equal(monitoreo_territorial_casos_ump_desde_auditoria(data.frame(), .casos_ump_tcfg(), "field", "107")$resumen$total, 0L)
  expect_equal(monitoreo_territorial_casos_ump_desde_auditoria(.casos_ump_fixture(), .casos_ump_tcfg(), "field", "999")$resumen$total, 0L)
})

test_that("la copia de la config para la auditoría completa no trae anulaciones y no toca la original", {
  cfg <- list(territorial = .casos_ump_tcfg(list(list(id = "x", status = "active", responsible_key = "P900"))))
  sin <- .casos_ump_config_sin_anulaciones(cfg)
  expect_equal(sin$territorial$production_annulments, list(pilot = list(), field = list()))
  expect_length(cfg$territorial$production_annulments$field, 1L)
})

test_that("pedir casos sin UMP es un error de la API con su código", {
  err <- tryCatch(.monitoreo_territorial_casos_ump_from_session("sid-inexistente", ""), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$status, 400)
  expect_equal(err$code, "E_MONITOREO_TERRITORIAL_UMP_REQUERIDA")
})

test_that("el sexo con código del formulario sale con su rótulo, como en la cuota", {
  df <- .casos_ump_fixture()
  df$sex <- c("2", "1", "", "Mujer", "2")
  out <- monitoreo_territorial_casos_ump_desde_auditoria(df, .casos_ump_tcfg(), "field", "107")
  por_id <- stats::setNames(vapply(out$casos, function(caso) caso$sexo, character(1)), vapply(out$casos, function(caso) caso$id, character(1)))
  expect_identical(unname(por_id[c("a2", "a1", "b1", "b2")]), c("Mujer", "Hombre", "", "Mujer"))
})
