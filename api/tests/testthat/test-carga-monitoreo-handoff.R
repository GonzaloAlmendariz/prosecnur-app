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

# XLSForm local minimo (sin repeats) para probar el candidato LOCAL del instrumento
# y el contrato instrument_source="local".
.handoff_write_simple_xlsform <- function() {
  survey <- data.frame(
    type  = c("text", "select_one si_no"),
    name  = c("nombre", "acepta"),
    label = c("Nombre", "Acepta"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("si_no", "si_no"),
    name  = c("1", "0"),
    label = c("Si", "No"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  settings <- data.frame(form_title = "Simple", form_id = "simple", version = "1",
                         stringsAsFactors = FALSE, check.names = FALSE)
  path <- tempfile("simple_xlsform_", fileext = ".xlsx")
  .carga_write_xlsform_model(list(survey = survey, choices = choices, settings = settings), path)
  path
}

# Sesion territorial con un XLSForm local ligado a la base activa del estudio.
.handoff_setup_territorial_local_xlsform <- function() {
  sid <- session_create()
  xls <- .handoff_write_simple_xlsform()
  meta <- save_upload(sid, "xlsform", "simple.xlsx",
                      readBin(xls, "raw", n = file.info(xls)$size))
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(validada = 1L, revision = 1L)
  s$estudio <- list(
    active_source = "default",
    bases = list(default = list(nombre = "default", xlsform_file_id = meta$file_id))
  )
  .session_env[[sid]] <- s
  list(sid = sid, xlsform_id = meta$file_id)
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
  expect_false(out$source$instrument_needs_upload)
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
  # Contrato vigente: el instrumento NUNCA sale de la API de Kobo, aunque haya
  # asset detectado. Sin XLSForm local, la UI debe pedir subirlo.
  expect_false(identical(out$source$instrument_source, "kobo_api"))
  expect_equal(out$source$instrument_source, "needs_upload")
  expect_false(out$source$instrument_available)
  expect_true(out$source$instrument_needs_upload)
})

test_that("status territorial con XLSForm local reporta instrument_source=local", {
  setup <- .handoff_setup_territorial_local_xlsform()
  on.exit(session_delete(setup$sid), add = TRUE)

  out <- .carga_monitoreo_handoff_status(setup$sid)

  expect_equal(out$source$instrument_source, "local")
  expect_true(out$source$instrument_available)
  expect_false(out$source$instrument_needs_upload)
})

test_that("extractor congelado NO candidatea la API de Kobo: elige el XLSForm local y cruza compatibilidad", {
  setup <- .handoff_setup_territorial_local_xlsform()
  on.exit(session_delete(setup$sid), add = TRUE)
  sid <- setup$sid

  # Guarda dura: si el extractor intentara consultar la API de Kobo, el test
  # falla. Bajo el contrato vigente ese path ni se invoca.
  testthat::local_mocked_bindings(
    .monitoreo_processing_handoff_kobo_detail = function(...) {
      stop("el handoff de procesamiento no debe consultar la API de Kobo")
    },
    .package = "prosecnurapp"
  )

  data <- data.frame(nombre = c("a", "b"), acepta = c("1", "0"),
                     stringsAsFactors = FALSE, check.names = FALSE)
  out_path <- tempfile("handoff_out_", fileext = ".xlsx")

  res <- .monitoreo_processing_handoff_xlsform(
    sid, session_get(sid), out_path, data = data
  )

  # Elige el candidato LOCAL de la base del estudio, no la API.
  expect_equal(res$source, "estudio")
  expect_true(file.exists(res$path))
  # El cruce de compatibilidad form<->data sigue corriendo y aprueba.
  expect_true(res$compatibility$ok)
  expect_gte(as.integer(res$compatibility$matched %||% 0L), 2L)
})

test_that("promote sin snapshot falla con api_error (E_NO_MONITOREO_DATA), sin stop crudo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  err <- tryCatch(.carga_monitoreo_handoff_promote(sid, list()),
                  error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_NO_MONITOREO_DATA")
})

# ---------------------------------------------------------------------------
# Camino GENERAL (estudios NO territoriales): snapshot multi-fuente con filas de
# barrido (Google Sheets) + filas Kobo con blob de repeat, sin validation_status.
# ---------------------------------------------------------------------------

# blob del repeat rep_servicios (1 celda JSON = 1..N instancias), llaves ODK/Kobo.
.handoff_svc <- function(code, claridad) {
  list(`Assistance/rep_servicios/current_code` = code,
       `Assistance/rep_servicios/srv_claridad` = claridad)
}
.handoff_blob <- function(...) {
  as.character(jsonlite::toJSON(list(...), auto_unbox = TRUE))
}

# Snapshot multi-fuente sintetico: 3 filas de barrido (google_sheets) + 4 filas
# Kobo (con blob rep_servicios y `_id`). `kobo_status` controla la columna Status
# de las filas Kobo (vector de largo 4); NA => sin status resoluble.
.handoff_general_snapshot <- function(kobo_status) {
  phone <- data.frame(
    `.source_id`   = rep("gs_barrido", 3L),
    `.source_kind` = rep("google_sheets", 3L),
    `.source_label` = rep("Barrido telefonico", 3L),
    `_id`          = rep(NA_character_, 3L),
    `Intro/edad`   = rep(NA_character_, 3L),
    `Status`       = c("No contesta", "Efectivo", "Apagado"),
    `Assistance/rep_servicios`       = rep(NA_character_, 3L),
    `Assistance/rep_servicios_count` = rep(NA_character_, 3L),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  kobo <- data.frame(
    `.source_id`   = rep("kobo_pdm", 4L),
    `.source_kind` = rep("kobo", 4L),
    `.source_label` = rep("PDM Kobo", 4L),
    `_id`          = c("k1", "k2", "k3", "k4"),
    `Intro/edad`   = c("30", "40", "25", "50"),
    `Status`       = kobo_status,
    `Assistance/rep_servicios` = c(
      .handoff_blob(.handoff_svc("legal", "4"), .handoff_svc("snm", "5")),
      .handoff_blob(.handoff_svc("legal", "3")),
      .handoff_blob(.handoff_svc("snm", "2")),
      .handoff_blob(.handoff_svc("legal", "5"))
    ),
    `Assistance/rep_servicios_count` = c("2", "1", "1", "1"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  list(synced_at = "2026-07-10T00:00:00Z", data = rbind(phone, kobo))
}

# XLSForm fidedigno del PDM: pregunta top-level + repeat rep_servicios con un
# select_one (choices con datos, como un asset Kobo real).
.handoff_write_pdm_xlsform <- function() {
  survey <- data.frame(
    type  = c("text", "begin_repeat", "text", "select_one claridad", "end_repeat"),
    name  = c("edad", "rep_servicios", "current_code", "srv_claridad", "rep_servicios"),
    label = c("Edad", "Servicios", "Codigo servicio", "Claridad", "Servicios"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = rep("claridad", 4L),
    name  = c("2", "3", "4", "5"),
    label = c("Dos", "Tres", "Cuatro", "Cinco"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  settings <- data.frame(form_title = "PDM", form_id = "pdm", version = "20260710",
                         stringsAsFactors = FALSE, check.names = FALSE)
  path <- tempfile("pdm_xlsform_", fileext = ".xlsx")
  .carga_write_xlsform_model(list(survey = survey, choices = choices, settings = settings), path)
  path
}

# Sesion general: snapshot multi-fuente + config telefonica + fuente Kobo. Con
# `with_local_xlsform` deja un XLSForm en el file store para que el extractor
# congelado lo elija (sin token Kobo en el store del test).
.handoff_setup_general <- function(kobo_status, with_local_xlsform = FALSE) {
  sid <- session_create()
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_general_snapshot(kobo_status)
  s$monitoreo_config <- list(
    status_var = "",
    valid_statuses = list("Completa"),
    monitoreo_profile = list(family = "telefonico")
  )
  s$monitoreo_sources <- list(list(
    id = "kobo_pdm", kind = "kobo", label = "PDM Kobo", enabled = TRUE,
    asset_uid = "ASSET123", base_url = "", connection_profile_id = ""
  ))
  .session_env[[sid]] <- s
  if (with_local_xlsform) {
    xls <- .handoff_write_pdm_xlsform()
    save_upload(sid, "xlsform", "pdm_xlsform.xlsx", readBin(xls, "raw", n = file.info(xls)$size))
  }
  sid
}

test_that("status general detecta la fuente Kobo y cuenta por Status/valid_statuses", {
  sid <- .handoff_setup_general(c("Completa", "Completa", "Parcial", "Completa"))
  on.exit(session_delete(sid), add = TRUE)

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$detected)
  expect_equal(out$universe, "source")
  expect_equal(out$source$kind, "kobo")
  expect_equal(out$source$source_id, "kobo_pdm")
  expect_equal(out$source$kobo_asset_uid, "ASSET123")
  expect_equal(out$source$validity, "status_candidate")
  expect_equal(out$source$status_column, "Status")
  # Sin XLSForm local subido, el instrumento no puede salir de la API: needs_upload.
  expect_equal(out$source$instrument_source, "needs_upload")
  expect_true(out$source$instrument_needs_upload)
  # 3 de 4 filas Kobo con Status == "Completa"; las 3 de barrido no cuentan.
  expect_equal(out$counts$processable, 3L)
  expect_equal(out$counts$total, 4L)
  expect_length(out$sources, 1L)
  expect_equal(out$sources[[1]]$counts$processable, 3L)
})

test_that("status general cuenta all_rows cuando la fuente no tiene status resoluble", {
  # La columna Status existe en el frame pero es NA para todas las filas Kobo
  # (es status de barrido telefonico); cae a all_rows con transparencia.
  sid <- .handoff_setup_general(rep(NA_character_, 4L))
  on.exit(session_delete(sid), add = TRUE)

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$detected)
  expect_equal(out$source$validity, "all_rows")
  expect_equal(out$counts$processable, 4L)
  expect_equal(out$counts$total, 4L)
})

test_that("status territorial sigue detectando por validation_status con family=territorial", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$monitoreo_snapshot <- .handoff_snapshot_fixture(validada = 1028L, revision = 255L,
                                                    no_defendible = 90L, total = 1351L)
  s$monitoreo_config <- list(monitoreo_profile = list(family = "territorial"))
  .session_env[[sid]] <- s

  out <- .carga_monitoreo_handoff_status(sid)

  expect_true(out$detected)
  expect_equal(out$universe, "processable")
  expect_equal(out$counts$processable, 1283L)
  expect_equal(out$source$validity, "validation_status")
  expect_length(out$sources, 0L)
})

test_that("promote general crea base madre + hija repeat y filtra filas validas", {
  sid <- .handoff_setup_general(c("Completa", "Completa", "Parcial", "Completa"),
                                with_local_xlsform = TRUE)
  on.exit(session_delete(sid), add = TRUE)

  res <- .carga_monitoreo_handoff_promote(sid, list())

  expect_true(res$ok)
  expect_equal(res$schema, "carga_monitoreo_handoff_general_v1")
  expect_equal(res$validity, "status_candidate")
  # 3 filas validas (Completa); la Parcial queda fuera.
  expect_equal(res$data$n_filas, 3L)
  expect_equal(res$counts$total, 4L)

  bases <- session_get(sid)$estudio$bases
  madre <- bases[[res$base_nombre]]
  expect_equal(madre$source_kind, "monitoreo_kobo")
  expect_equal(madre$kobo_asset_uid, "ASSET123")
  expect_equal(as.integer(madre$n_filas), 3L)

  # Base hija del repeat: instancias de las 3 filas validas (2 + 1 + 1 = 4).
  expect_length(res$child_bases, 1L)
  child <- res$child_bases[[1]]
  expect_equal(child$repeat_group, "rep_servicios")
  expect_equal(child$parent_base, res$base_nombre)
  expect_equal(as.integer(child$n_filas), 4L)
  expect_equal(child$link_key, "_parent_index")
})

test_that("already_promoted general es TRUE solo tras promover ESA fuente Kobo", {
  sid <- .handoff_setup_general(rep(NA_character_, 4L), with_local_xlsform = TRUE)
  on.exit(session_delete(sid), add = TRUE)

  before <- .carga_monitoreo_handoff_status(sid)
  expect_false(before$already_promoted)
  # Con XLSForm local subido, el instrumento sale de local (nunca de la API).
  expect_equal(before$source$instrument_source, "local")
  expect_true(before$source$instrument_available)
  expect_false(before$source$instrument_needs_upload)

  .carga_monitoreo_handoff_promote(sid, list())

  after <- .carga_monitoreo_handoff_status(sid)
  expect_true(after$already_promoted)
})
