# Contrato del puente Monitoreo -> Procesamiento del lado Carga.
# El STATUS debe ser barato (sin stagear archivos ni tocar red) y contar por
# universo desde los KPIs territoriales cacheados (territorial_overview_facts),
# NO desde snapshot$data (el estado de validacion no vive por fila alli).

.handoff_snapshot_fixture <- function(validada = 0L, revision = 0L,
                                      no_defendible = 0L, total = NULL) {
  n <- total %||% (validada + revision + no_defendible)
  data <- data.frame(
    `_uuid` = paste0("resp-", seq_len(max(n, 1L))),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  list(
    data = data,
    synced_at = "2026-07-10T00:00:00Z",
    territorial_overview_facts = list(
      total_respuestas = as.integer(n),
      validas = as.integer(validada),
      revision = as.integer(revision),
      geo_no_defendible = as.integer(no_defendible),
      meta = 1200L,
      avance_pct = 0
    )
  )
}

test_that("status sin snapshot devuelve detected=FALSE y counts en cero", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$ok)
  expect_false(out$detected)
  expect_equal(out$universe, "processable")
  expect_equal(out$counts$processable, 0L)
  expect_equal(out$counts$validada, 0L)
  expect_equal(out$counts$revision, 0L)
  expect_equal(out$counts$no_defendible, 0L)
  expect_equal(out$counts$total, 0L)
  expect_equal(out$source$instrument_source, "none")
  expect_false(out$source$instrument_available)
  expect_false(out$already_promoted)
  expect_false(out$existing_base$present)
  expect_equal(out$base_nombre_sugerido, "Monitoreo territorial")
})

test_that("status cuenta por universo desde territorial_overview_facts", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(
    validada = 1028L, revision = 255L, no_defendible = 90L, total = 1351L
  )
  .session_env[[sid]] <- s

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$detected)
  expect_equal(out$counts$total, 1351L)
  expect_equal(out$counts$validada, 1028L)
  expect_equal(out$counts$revision, 255L)
  expect_equal(out$counts$no_defendible, 90L)
  # processable = validada + revision, excluye no_defendible
  expect_equal(out$counts$processable, 1283L)
})

test_that("status sin filas procesables reporta detected=FALSE aunque haya snapshot", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(no_defendible = 2L)
  .session_env[[sid]] <- s

  out <- .carga_monitoreo_handoff_status(sid)

  expect_false(out$detected)
  expect_equal(out$counts$processable, 0L)
  expect_equal(out$counts$no_defendible, 2L)
})

test_that("una base cruda previa no cuenta como promovida y se expone para reemplazo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(validada = 1028L, revision = 255L, total = 1351L)
  s$estudio <- list(
    active_source = "default",
    bases = list(default = list(nombre = "default", source_kind = "kobo", n_filas = 1697L))
  )
  s$codif_source_active <- "default"
  .session_env[[sid]] <- s

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$detected)
  # Base cruda (source_kind kobo) NO es el handoff: sigue ofreciendo traer.
  expect_false(out$already_promoted)
  expect_true(out$existing_base$present)
  expect_equal(out$existing_base$nombre, "default")
  expect_equal(out$existing_base$source_kind, "kobo")
  expect_false(out$existing_base$is_territorial)
  expect_equal(out$existing_base$n_filas, 1697L)
})

test_that("una base territorial ya promovida marca already_promoted=TRUE", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(validada = 1028L, revision = 255L, total = 1351L)
  s$estudio <- list(
    active_source = "Monitoreo territorial",
    bases = list(`Monitoreo territorial` = list(nombre = "Monitoreo territorial",
                                                source_kind = "monitoreo_territorial", n_filas = 1283L))
  )
  s$codif_source_active <- "Monitoreo territorial"
  .session_env[[sid]] <- s

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$already_promoted)
  expect_true(out$existing_base$is_territorial)
})

test_that("status es barato: no stagea archivos ni deja downloads en el proyecto", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(validada = 1L, revision = 1L)
  .session_env[[sid]] <- s

  downloads_before <- list.files(file.path(s$dir, "downloads"), recursive = TRUE)
  files_before <- length(session_get(sid)$files %||% list())

  out <- .carga_monitoreo_handoff_status(sid)

  downloads_after <- list.files(file.path(s$dir, "downloads"), recursive = TRUE)
  files_after <- length(session_get(sid)$files %||% list())

  expect_true(out$detected)
  # El status no debe escribir stage dirs ni registrar uploads.
  expect_equal(length(downloads_after), length(downloads_before))
  expect_equal(files_after, files_before)
})

test_that("status detecta asset Kobo heredado de Monitoreo territorial en la fuente", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(validada = 1L, revision = 1L)
  s$monitoreo_config <- list(
    territorial = list(
      active_route_phase = "field",
      phase_sources = list(
        field = list(
          asset_uid = "aT5qpJ937NmUro9AzgBXaA",
          base_url = "https://kobo.unhcr.org",
          connection_profile_id = "unhcr-main"
        )
      )
    )
  )
  s$monitoreo_kobo_schemas <- list(
    field = list(name = "Encuesta territorial VF", version_id = "v7")
  )
  .session_env[[sid]] <- s

  out <- .carga_monitoreo_handoff_status(sid)

  expect_equal(out$source$kobo_asset_uid, "aT5qpJ937NmUro9AzgBXaA")
  expect_equal(out$source$phase, "field")
  expect_equal(out$source$label, "Encuesta territorial VF")
  # Sin token guardado en el store local, no puede prometer la API de Kobo.
  expect_true(out$source$instrument_source %in% c("kobo_api", "local", "none"))
})

test_that("promote sin snapshot falla con api_error (E_NO_MONITOREO_DATA), sin stop crudo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  err <- tryCatch(.carga_monitoreo_handoff_promote(sid, list()),
                  error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_NO_MONITOREO_DATA")
})
