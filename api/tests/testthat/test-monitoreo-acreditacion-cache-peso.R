# Peso del cache de reportes de acreditación en el warm start.
#
# Medido el 2026-10-30 en un proyecto de acreditación de 45 mil casos: el
# session_patch del warm start pesaba 1,1 GB en memoria y 748 MB serializado.
# Dos causas, ninguna con valor para la interfaz:
#   - el cache guardaba el reporte de consultas DOS veces (388 MB cada uno): uno
#     con la configuración anterior y otro con la actual. `display_data` sólo
#     depende del estado de la sesión, así que por scope sólo hay una clave
#     vigente; la anterior no se vuelve a pedir salvo que la configuración
#     regrese exactamente atrás.
#   - el mismo dashboard viajaba otra vez en `monitoreo_dashboard_cache_<scope>`
#     de la sesión. En el worker es el MISMO objeto, pero al serializarse se
#     escribe dos veces y la sesión lo recibe como dos copias.

.peso_cfg <- function(extra = NULL) {
  list(monitoreo_profile = list(family = "acreditacion"), goals = list(), control_vars = extra %||% character(0))
}
.peso_data <- function(n = 3L) data.frame(CodPulso = paste0("C", seq_len(n)), Estado = "Completa", stringsAsFactors = FALSE)
.peso_dashboard <- function(marca) list(acreditacion_reports = list(marca = marca))

test_that("cambiar la configuración deja una sola entrada por scope", {
  snap <- list(synced_at = "2026-07-01")
  vieja <- .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg(), "queries_summary")
  snap <- .monitoreo_acr_cache_store(snap, vieja, .peso_dashboard("config-vieja"))
  Sys.sleep(1.1)  # stored_at tiene resolución de segundos
  nueva <- .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg("edad"), "queries_summary")
  snap <- .monitoreo_acr_cache_store(snap, nueva, .peso_dashboard("config-nueva"))

  scopes <- vapply(snap$acreditacion_report_cache$entries, `[[`, character(1), "report_scope")
  expect_equal(unname(scopes), "queries_summary")
  expect_equal(.monitoreo_acr_cache_lookup(snap, nueva)$dashboard$acreditacion_reports$marca, "config-nueva")
  expect_null(.monitoreo_acr_cache_lookup(snap, vieja))
})

test_that("en un empate de segundo gana la entrada guardada después", {
  snap <- list(synced_at = "2026-07-01")
  vieja <- .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg(), "queries_summary")
  nueva <- .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg("edad"), "queries_summary")
  local_mocked_bindings(.monitoreo_now_iso = function() "2026-10-30T14:18:56Z")
  snap <- .monitoreo_acr_cache_store(snap, vieja, .peso_dashboard("config-vieja"))
  snap <- .monitoreo_acr_cache_store(snap, nueva, .peso_dashboard("config-nueva"))

  expect_length(snap$acreditacion_report_cache$entries, 1L)
  expect_equal(.monitoreo_acr_cache_lookup(snap, nueva)$dashboard$acreditacion_reports$marca, "config-nueva")
})

test_that("los cuatro scopes de un mismo corte conviven", {
  snap <- list(synced_at = "2026-07-01")
  infos <- lapply(c("source", "advance_summary", "queries_summary", "phone_summary"), function(scope) {
    .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg(), scope)
  })
  for (info in infos) snap <- .monitoreo_acr_cache_store(snap, info, .peso_dashboard(info$report_scope))

  expect_length(snap$acreditacion_report_cache$entries, 4L)
  for (info in infos) {
    expect_equal(.monitoreo_acr_cache_lookup(snap, info)$dashboard$acreditacion_reports$marca, info$report_scope)
  }
})

test_that("un .pulso con entradas de configuraciones viejas se poda al fusionar", {
  base <- list(synced_at = "2026-07-01")
  entrante <- base
  vieja <- .monitoreo_acr_cache_key_info(base, .peso_data(), .peso_cfg(), "advance_summary")
  entrante <- .monitoreo_acr_cache_store(entrante, vieja, .peso_dashboard("vieja"))
  Sys.sleep(1.1)
  vigente <- .monitoreo_acr_cache_key_info(base, .peso_data(), .peso_cfg("edad"), "advance_summary")
  entrante <- .monitoreo_acr_cache_store(entrante, vigente, .peso_dashboard("vigente"))
  # Así venía un .pulso guardado antes de esta poda: las dos conviven.
  entrante$acreditacion_report_cache$entries[[vieja$key]] <- list(
    key = vieja$key, report_scope = vieja$report_scope, snapshot_hash = vieja$snapshot_hash,
    config_hash = vieja$config_hash, dashboard = .peso_dashboard("vieja"),
    build_ms = 1, stored_at = "2026-07-01T00:00:00Z"
  )
  expect_length(entrante$acreditacion_report_cache$entries, 2L)

  fusionado <- .monitoreo_acr_cache_merge(base, entrante$acreditacion_report_cache)

  expect_length(fusionado$acreditacion_report_cache$entries, 1L)
  expect_equal(.monitoreo_acr_cache_lookup(fusionado, vigente)$dashboard$acreditacion_reports$marca, "vigente")
})

test_that("el patch del warm start no repite el dashboard que ya viaja en el cache", {
  sid <- session_create()
  s <- session_get(sid)
  snap <- list(synced_at = "2026-07-01")
  compartido <- .peso_dashboard("compartido")
  info <- .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg(), "queries_summary")
  snap <- .monitoreo_acr_cache_store(snap, info, compartido)
  s$monitoreo_snapshot <- snap
  s$monitoreo_dashboard_cache_queries_summary <- compartido
  s$monitoreo_dashboard_cache_token_queries_summary <- "tok-q"
  s$monitoreo_dashboard_cache_source <- .peso_dashboard("solo-sesion")
  s$monitoreo_dashboard_cache_token_source <- "tok-s"
  s$monitoreo_dashboard_light_cache <- list(liviano = TRUE)
  s$monitoreo_dashboard_light_cache_token <- "tok-l"
  .session_env[[sid]] <- s

  patch <- .project_warmup_acr_session_patch(sid, c("source", "queries_summary"))

  # Lo que ya está en el cache no se repite, ni su token: un token sin su
  # dashboard validaría el dashboard viejo que la sesión tuviera en ese campo.
  expect_null(patch$monitoreo$monitoreo_dashboard_cache_queries_summary)
  expect_null(patch$monitoreo$monitoreo_dashboard_cache_token_queries_summary)
  # Lo que sólo vive en la sesión sí viaja.
  expect_equal(patch$monitoreo$monitoreo_dashboard_cache_source$acreditacion_reports$marca, "solo-sesion")
  expect_equal(patch$monitoreo$monitoreo_dashboard_cache_token_source, "tok-s")
  expect_true(isTRUE(patch$monitoreo$monitoreo_dashboard_light_cache$liviano))
  # Y el cache persistente viaja entero: es de donde la sesión lo recupera.
  expect_equal(
    .monitoreo_acr_cache_lookup(list(acreditacion_report_cache = patch$monitoreo_acreditacion$acreditacion_report_cache), info)$dashboard$acreditacion_reports$marca,
    "compartido"
  )
})

test_that("tras fusionar el patch, el scope omitido se sirve desde el cache sin reconstruir", {
  sid <- session_create()
  snap <- list(synced_at = "2026-07-01")
  compartido <- .peso_dashboard("compartido")
  info <- .monitoreo_acr_cache_key_info(snap, .peso_data(), .peso_cfg(), "queries_summary")
  origen <- session_create()
  so <- session_get(origen)
  so$monitoreo_snapshot <- .monitoreo_acr_cache_store(snap, info, compartido)
  so$monitoreo_dashboard_cache_queries_summary <- compartido
  so$monitoreo_dashboard_cache_token_queries_summary <- "tok-q"
  .session_env[[origen]] <- so
  patch <- .project_warmup_acr_session_patch(origen, "queries_summary")

  s <- session_get(sid)
  s$monitoreo_snapshot <- snap
  .session_env[[sid]] <- s
  expect_true(.project_warmup_merge_session_patch(sid, patch))

  fusionada <- session_get(sid)
  expect_equal(.monitoreo_acr_cache_lookup(fusionada$monitoreo_snapshot, info)$dashboard$acreditacion_reports$marca, "compartido")
  expect_null(fusionada$monitoreo_dashboard_cache_token_queries_summary)
})
