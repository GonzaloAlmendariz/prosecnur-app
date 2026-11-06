# El tablero de aulas no se reconstruye al cambiar de report_scope
#
# Medido el 2026-11-01 sobre HSVG 2026 (3.051 respuestas): cada
# `/api/monitoreo/state` tardaba 11-12 s aun con `derived` y el dashboard
# general en cache, y abrir el perfil pide cinco o seis scopes seguidos
# (light, source, advance_summary, validation_summary, queries_summary): unos
# 70 s con Plumber bloqueado, que Hojas y Material veian como «Leyendo la
# muestra enviada...».
#
# La causa: `monitoreo_aulas_cache_token()` ya excluye el scope (su payload es
# el mismo byte a byte), pero el router le pasaba como `base` el token general,
# que SI lo lleva. Con una sola entrada por sesion, cada scope nuevo expulsaba
# al anterior y el tablero se reconstruia en cada pedido. Los tests de
# test-monitoreo-aulas-cache.R no lo veian porque pasan la misma base literal a
# todos los scopes: el fixture tenia una sola fuente.

.acs_plan <- function(n = 3L) {
  lapply(seq_len(n), function(i) {
    list(
      classroom_id = sprintf("A-%03d", i),
      operational_code = sprintf("CH %d", i),
      label = sprintf("Aula %03d", i),
      faculty = "Ingenieria", stratum = "Ingenieria",
      sample_role = "titular", wave = "M1", orden = i,
      eligible_n = 30, expected_valid = 12,
      sample_status = "agendada"
    )
  })
}

test_that("pedir otro report_scope reusa el tablero de aulas de la sesion", {
  sid <- session_create()
  on.exit(monitoreo_aulas_cache_invalidate(sid), add = TRUE)
  cfg <- monitoreo_normalize_config(
    list(monitoreo_profile = list(family = "aulas_universitarias")),
    data.frame()
  )
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_aulas_plan", .acs_plan())

  construidos <- 0L
  original <- monitoreo_aulas_dashboard
  local_mocked_bindings(monitoreo_aulas_dashboard = function(...) {
    construidos <<- construidos + 1L
    original(...)
  })

  for (scope in c("source", "advance_summary", "validation_summary", "queries_summary", "source")) {
    .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = scope)
  }
  .monitoreo_state_payload(sid, include_reports = FALSE)

  expect_identical(construidos, 1L)
})

# 2k (2026-11-01): con la caché de aulas arreglada, la primera apertura seguía en
# 32 s porque el dashboard GENERAL se construía una vez por scope (~3,5 s cada
# uno en HSVG 2026). Para aulas no depende del scope —`monitoreo_build_dashboard`
# sólo lo pasa a los reportes de acreditación y territorial—, así que los cinco
# scopes comparten una construcción.
test_that("el dashboard general de aulas se construye una vez para todos los scopes", {
  sid <- session_create()
  on.exit(monitoreo_aulas_cache_invalidate(sid), add = TRUE)
  datos <- data.frame(id = 1:3, consent = "si", stringsAsFactors = FALSE)
  cfg <- monitoreo_normalize_config(
    list(monitoreo_profile = list(family = "aulas_universitarias")),
    datos
  )
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_snapshot", list(data = datos, config = cfg, synced_at = "2026-11-01T10:00:00"))
  session_set(sid, "monitoreo_aulas_plan", .acs_plan())

  construidos <- 0L
  original <- .monitoreo_dashboard_for_session
  local_mocked_bindings(.monitoreo_dashboard_for_session = function(...) {
    construidos <<- construidos + 1L
    original(...)
  })

  for (scope in c("source", "advance_summary", "validation_summary", "queries_summary", "source")) {
    .monitoreo_state_payload(sid, include_reports = TRUE, report_scope = scope)
  }

  expect_identical(construidos, 1L)
})
