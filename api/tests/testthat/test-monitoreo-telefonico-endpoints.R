# Contrato de la identidad propia del monitoreo telefónico (unidad 4.2).
#
# Cubre tres frentes, in-process (sin levantar plumber):
#   1. El mount propio expone /api/monitoreo/telefonico/report/pdf (POST) y
#      /api/monitoreo/telefonico/report/pdf/download (GET).
#   2. Las fronteras del router (.monitoreo_telefonico_report_model_from_session
#      y .monitoreo_telefonico_pdf_meta_ready) con sus errores E_*.
#   3. La semántica extraída del engine a monitoreo_telefonico.R conserva su
#      contrato (masks de efectividad, bloques telefónicos) y el endpoint
#      genérico /api/monitoreo/client-report/pdf sigue produciendo el MISMO
#      modelo telefónico (back-compat: el frontend aún no migra).

source("setup-load-all.R")

.mtep_phone_data <- function() {
  data.frame(
    .source_role = c("barrido", "barrido", "barrido", "respuestas", "respuestas"),
    .source_id = c("b1", "b1", "b1", "k1", "k1"),
    .source_label = c("Barrido", "Barrido", "Barrido", "Kobo", "Kobo"),
    CodPulso = c("P001", "P002", "P003", "P001", "P002"),
    Status = c("Efectivo", "No contesta", "Efectivo", NA, NA),
    Responsable = c("Ana", "Luis", "Ana", NA, NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.mtep_phone_snapshot <- function() {
  list(data = .mtep_phone_data(), synced_at = "2026-07-23T12:00:00Z")
}

.mtep_phone_cfg <- function() list(monitoreo_profile = list(family = "telefonico"))

test_that("mount_monitoreo_telefonico expone las rutas propias del producto", {
  pr <- plumber::pr()
  pr <- mount_monitoreo_telefonico(pr)
  eps <- unlist(pr$endpoints, recursive = FALSE)
  paths <- vapply(eps, function(e) e$path, character(1))
  verbs <- lapply(eps, function(e) e$verbs)
  idx_post <- which(paths == "/api/monitoreo/telefonico/report/pdf")
  idx_get <- which(paths == "/api/monitoreo/telefonico/report/pdf/download")
  expect_length(idx_post, 1L)
  expect_length(idx_get, 1L)
  expect_true("POST" %in% verbs[[idx_post]])
  expect_true("GET" %in% verbs[[idx_get]])
})

test_that("modelo desde sesión: sin snapshot el contrato es E_NO_MONITOREO_DATA 409", {
  sid <- session_create()
  err <- tryCatch(
    .monitoreo_telefonico_report_model_from_session(sid),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_NO_MONITOREO_DATA")
  expect_identical(err$status, 409)
})

test_that("modelo desde sesión: familia no telefónica corta con E_PERFIL_NO_TELEFONICO", {
  sid <- session_create()
  session_set(sid, "monitoreo_snapshot", .mtep_phone_snapshot())
  err <- tryCatch(
    .monitoreo_telefonico_report_model_from_session(
      sid,
      config = list(monitoreo_profile = list(family = "acreditacion"))
    ),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_PERFIL_NO_TELEFONICO")
  expect_identical(err$status, 409)
})

test_that("modelo desde sesión con familia telefónica produce el modelo de avance", {
  sid <- session_create()
  session_set(sid, "monitoreo_snapshot", .mtep_phone_snapshot())
  session_set(sid, "monitoreo_config", .mtep_phone_cfg())
  model <- .monitoreo_telefonico_report_model_from_session(sid, include_targets = TRUE)
  expect_identical(model$schema, "monitoreo_telefonico_advance_report_v1")
  expect_identical(model$report_kind, "telefonico_advance_pdf")
  expect_identical(model$family, "telefonico")
  expect_true(isTRUE(model$include_targets))
  expect_true(all(c("total", "swept", "not_swept", "phone_effective", "kobo_effective") %in% names(model$metrics)))
})

test_that("back-compat: el camino genérico sigue produciendo el mismo modelo telefónico", {
  snapshot <- .mtep_phone_snapshot()
  cfg <- monitoreo_normalize_config(.mtep_phone_cfg(), snapshot$data)
  generic <- .monitoreo_client_report_model_for_snapshot(snapshot, cfg, include_targets = FALSE)
  propio <- build_monitoreo_telefonico_report_model(snapshot, cfg, include_targets = FALSE)
  expect_identical(generic$schema, propio$schema)
  expect_identical(generic$report_kind, "telefonico_advance_pdf")
  expect_identical(generic$family, "telefonico")
  # Mismos números: la extracción no cambió la semántica del modelo.
  expect_identical(generic$metrics, propio$metrics)
  expect_identical(generic$quotas, propio$quotas)
  expect_identical(generic$daily, propio$daily)
})

test_that("download: sin PDF generado el contrato es E_NO_REPORTE_TELEFONICO 404", {
  sid <- session_create()
  err <- tryCatch(.monitoreo_telefonico_pdf_meta_ready(sid), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_NO_REPORTE_TELEFONICO")
  expect_identical(err$status, 404)
})

test_that("download: con meta disponible y archivo real devuelve el meta", {
  sid <- session_create()
  pdf_path <- tempfile(fileext = ".pdf")
  writeBin(as.raw(c(0x25, 0x50, 0x44, 0x46)), pdf_path)
  session_set(sid, "monitoreo_telefonico_report_pdf", list(
    disponible = TRUE,
    path = pdf_path,
    generated_at = "2026-07-23T12:00:00Z",
    include_targets = FALSE,
    report_kind = "telefonico_advance_pdf"
  ))
  meta <- .monitoreo_telefonico_pdf_meta_ready(sid)
  expect_identical(meta$path, pdf_path)
  expect_true(isTRUE(meta$disponible))
})

test_that("masks extraídos: fuera de la familia telefónica son no-op", {
  df <- data.frame(testreal = c("real", "test", "real"), stringsAsFactors = FALSE)
  profile_acr <- list(family = "acreditacion")
  expect_identical(
    .monitoreo_report_platform_test_mask(df, profile_acr),
    rep(FALSE, 3L)
  )
  expect_identical(
    .monitoreo_report_effective_filter_mask(df, profile_acr),
    rep(TRUE, 3L)
  )
})

test_that("masks extraídos: en familia telefónica detectan registros de prueba", {
  df <- data.frame(
    `Intro/testreal` = c("real", "test", "real", "prueba"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  profile <- list(family = "telefonico")
  mask <- .monitoreo_report_platform_test_mask(df, profile)
  expect_identical(mask, c(FALSE, TRUE, FALSE, TRUE))
  effective <- .monitoreo_report_effective_filter_mask(df, profile)
  expect_identical(effective, c(TRUE, FALSE, TRUE, FALSE))
})

test_that("bloques telefónicos extraídos conservan su contrato de ids", {
  # Caso vacío: el contrato factual explícito de "sin hoja de barrido".
  empty_blocks <- .monitoreo_report_phone_blocks(data.frame(), list(family = "telefonico"), list())
  empty_ids <- vapply(empty_blocks, function(b) as.character(b$id %||% ""), character(1))
  expect_identical(empty_ids, c("resumen_telefonico", "estatus_telefonico", "cuotas_variable"))
  expect_match(empty_blocks[[1]]$note %||% "", "Sin hoja de barrido")

  # Caso con datos: los bloques núcleo de la hoja monitoreo_telefonico.
  # cfg normalizado como en los callers reales (el crudo no trae los campos
  # de duración/kobo que .monitoreo_duration_seconds espera).
  data <- .mtep_phone_data()
  cfg <- monitoreo_normalize_config(.mtep_phone_cfg(), data)
  blocks <- .monitoreo_report_phone_blocks(data, cfg$monitoreo_profile %||% list(family = "telefonico"), cfg)
  ids <- vapply(blocks, function(b) as.character(b$id %||% ""), character(1))
  for (core in c("resumen_telefonico", "estatus_telefonico", "produccion_dia", "operacion_responsable", "estatus_responsable")) {
    expect_true(core %in% ids, info = core)
  }
  # Los bloques serializan rows como records (lista de filas nombradas).
  resumen_rows <- blocks[[which(ids == "resumen_telefonico")[1]]]$rows
  total_row <- Filter(function(r) identical(as.character(r$Indicador %||% ""), "Total telefónico"), resumen_rows)
  expect_length(total_row, 1L)
  expect_identical(as.integer(total_row[[1]]$Casos), 3L)
})
