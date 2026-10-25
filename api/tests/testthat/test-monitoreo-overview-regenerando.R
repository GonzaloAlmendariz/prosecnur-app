# =============================================================================
# Home no publica la cifra de un corte viejo como si fuera del corte nuevo
# (Meta B, L20 · M6)
# =============================================================================
#
# Al terminar un sync, `monitoreo_sync_apply_deferred` arma un snapshot nuevo
# sin `dashboard` y le copia los `*_overview_facts` del corte ANTERIOR, para que
# Home no se quede en cero mientras nadie abre Monitoreo. Hasta que el primer
# GET de la familia re-espeja (`monitoreo_snapshot_refresh_overview_facts`), la
# tarjeta del homepage mostraba «423 de 400 efectivas» al lado del
# `monitoreo_last_cut` nuevo: la cifra se leía como del corte nuevo (C5).
#
# El contrato que fijan estos tests: el espejo heredado viaja MARCADO con el
# corte del que viene, el overview lo publica como `regenerando = TRUE` (más
# `regenerando_desde`), y el refresco de la familia borra la marca.

.mor_facts <- function(efectivas, meta = 400L, universo = 2296L) {
  list(efectivas = efectivas, universo = universo, meta = meta,
       avance_pct = round(100 * efectivas / meta, 1),
       avance_universo_pct = round(100 * efectivas / universo, 1),
       inconsistencias = 0L, actores = 1L, actores_cumplidos = 1L,
       rezagado = "", rezagado_pct = -1)
}

.mor_live_dashboard <- function(efectivas) {
  list(
    kpis = list(total = 2726L, valid = 2726L, target = 400L, inconsistencies = 0L),
    acreditacion_reports = list(client_report = list(actors = list(
      list(Actor = "Hogares", Universo = 2296L, Efectivas = efectivas, Parciales = 0L,
           `Sin respuesta` = 2296L - efectivas, Meta = NA_integer_)
    )))
  )
}

.mor_session <- function() {
  sid <- session_create()
  data <- data.frame(
    response_id = c("r1", "r2"),
    enumerador = c("Ana", "Luis"),
    estado = rep("completed", 2L),
    fecha = rep("2026-07-01T10:00:00Z", 2L),
    duracion = rep(600, 2L),
    .source_id = rep("surveymonkey_900100", 2L),
    .source_kind = rep("surveymonkey", 2L),
    .source_label = rep("SM", 2L),
    stringsAsFactors = FALSE
  )
  cfg <- monitoreo_normalize_config(list(
    id_var = "response_id", enumerator_var = "enumerador", date_var = "fecha",
    duration_var = "duracion", status_var = "estado", valid_statuses = c("completed"),
    monitoreo_profile = list(family = "telefonico")
  ), data)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "monitoreo_config", cfg)
  session_set(sid, "monitoreo_sources", list(list(
    id = "surveymonkey_900100", kind = "surveymonkey", label = "SM",
    enabled = TRUE, survey_id = "900100", collectors = list()
  )))
  session_set(sid, "monitoreo_snapshot", list(
    data = data, config = cfg, synced_at = "2026-07-20T00:00:00Z",
    efectividad_overview_facts = .mor_facts(423L)
  ))
  sid
}

.mor_sync_result <- function(sid) {
  s <- session_get(sid)
  data <- s$monitoreo_snapshot$data
  list(
    ok = TRUE, synced_at = "2026-07-21T00:00:00Z", n_rows = nrow(data), n_sources = 1L,
    errors = list(), data = data,
    sources = list(list(id = "surveymonkey_900100", kind = "surveymonkey", label = "SM",
                        enabled = TRUE, survey_id = "900100", collectors = list())),
    sync_summary = list(surveymonkey_900100 = list(
      source_id = "surveymonkey_900100", kind = "surveymonkey", mode = "full",
      rows = nrow(data), cursor = list()
    )),
    config = s$monitoreo_config
  )
}

.mor_home <- function(sid) .project_overview_payload(sid)$facts$monitoreo

test_that("antes de cualquier sync, el espejo vigente no se publica como regenerando", {
  sid <- .mor_session()
  on.exit(session_delete(sid), add = TRUE)
  mon <- .mor_home(sid)
  expect_identical(mon$valid, 423L)
  expect_false(isTRUE(mon$regenerando))
})

test_that("tras el sync, Home publica regenerando con el corte del que viene la cifra", {
  sid <- .mor_session()
  on.exit(session_delete(sid), add = TRUE)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = function(url, handle) stop("red prohibida en el on_complete")
  )
  suppressWarnings(monitoreo_sync_apply_deferred(sid, .mor_sync_result(sid), sync_mode = "full"))

  overview <- .project_overview_payload(sid)
  mon <- overview$facts$monitoreo
  # El corte ya es el nuevo...
  expect_identical(overview$metrics$monitoreo_last_cut, "2026-07-21T00:00:00Z")
  # ...pero la cifra sigue siendo la del anterior, y así se dice.
  expect_identical(mon$valid, 423L)
  expect_true(isTRUE(mon$regenerando))
  expect_identical(mon$regenerando_desde, "2026-07-20T00:00:00Z")
  # La marca vive en el snapshot, por campo.
  snap <- session_get(sid)$monitoreo_snapshot
  expect_identical(snap$overview_facts_heredado$efectividad_overview_facts, "2026-07-20T00:00:00Z")
})

test_that("el refresco de la familia borra la marca y Home trae la cifra del corte nuevo", {
  sid <- .mor_session()
  on.exit(session_delete(sid), add = TRUE)
  testthat::local_mocked_bindings(
    .sm_api_http_fetch = function(url, handle) stop("red prohibida en el on_complete")
  )
  suppressWarnings(monitoreo_sync_apply_deferred(sid, .mor_sync_result(sid), sync_mode = "full"))

  s <- session_get(sid)
  stored <- monitoreo_snapshot_store_overview_facts(
    sid, s$monitoreo_snapshot, .mor_live_dashboard(450L), "telefonico"
  )
  expect_null(stored$overview_facts_heredado$efectividad_overview_facts)

  mon <- .mor_home(sid)
  expect_false(isTRUE(mon$regenerando))
  expect_identical(mon$regenerando_desde, "")
  expect_identical(mon$valid, 450L)
})

test_that("si el corte nuevo da la misma cifra, el refresco igual borra la marca", {
  # Sin esto, `identical(facts)` cortaba antes de limpiar y Home se quedaba en
  # «Actualizando» para siempre sobre una cifra que ya estaba al día.
  snap <- list(
    synced_at = "2026-07-21T00:00:00Z",
    efectividad_overview_facts = monitoreo_efectividad_overview_facts(.mor_live_dashboard(423L)),
    overview_facts_heredado = list(efectividad_overview_facts = "2026-07-20T00:00:00Z")
  )
  out <- monitoreo_snapshot_refresh_overview_facts(snap, .mor_live_dashboard(423L), "telefonico")
  expect_true(out$changed)
  expect_null(out$snapshot$overview_facts_heredado$efectividad_overview_facts)
})

test_that("un tablero que no trae facts de la familia no borra la marca", {
  snap <- list(
    efectividad_overview_facts = .mor_facts(423L),
    overview_facts_heredado = list(efectividad_overview_facts = "2026-07-20T00:00:00Z")
  )
  out <- monitoreo_snapshot_refresh_overview_facts(snap, list(kpis = list(total = 1L)), "telefonico")
  expect_false(out$changed)
  expect_identical(out$snapshot$overview_facts_heredado$efectividad_overview_facts,
                   "2026-07-20T00:00:00Z")
})

test_that("refrescar una familia no limpia la marca de otra", {
  snap <- list(
    overview_facts_heredado = list(
      efectividad_overview_facts = "2026-07-20T00:00:00Z",
      territorial_overview_facts = "2026-07-20T00:00:00Z"
    )
  )
  out <- monitoreo_snapshot_refresh_overview_facts(snap, .mor_live_dashboard(450L), "telefonico")
  expect_null(out$snapshot$overview_facts_heredado$efectividad_overview_facts)
  expect_identical(out$snapshot$overview_facts_heredado$territorial_overview_facts,
                   "2026-07-20T00:00:00Z")
})

test_that("un sync sin espejo previo no marca nada que no exista", {
  out <- monitoreo_snapshot_inherit_overview_facts(
    list(synced_at = "2026-07-21T00:00:00Z"),
    list(synced_at = "2026-07-20T00:00:00Z")
  )
  expect_null(out$overview_facts_heredado)
  expect_null(out$efectividad_overview_facts)
})

test_that("heredar dos veces conserva el corte de ORIGEN de la cifra, no el intermedio", {
  # Dos syncs seguidos sin abrir Monitoreo: la cifra sigue siendo la del primer
  # corte, no la del segundo, que tampoco la calculó.
  prev <- list(
    synced_at = "2026-07-21T00:00:00Z",
    efectividad_overview_facts = .mor_facts(423L),
    overview_facts_heredado = list(efectividad_overview_facts = "2026-07-20T00:00:00Z")
  )
  out <- monitoreo_snapshot_inherit_overview_facts(list(synced_at = "2026-07-22T00:00:00Z"), prev)
  expect_identical(out$overview_facts_heredado$efectividad_overview_facts, "2026-07-20T00:00:00Z")
})
