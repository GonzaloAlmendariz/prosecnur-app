library(testthat)

# Escotilla SAV de acreditación: materializa bases desde .sav relacionados a un
# XLSForm publicado del intake, sin pasar por Monitoreo. Fixture 100% local.

.acsav_test_workbook <- function() {
  list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(
        list("select_one sexo", "sexo", "Sexo"),
        list("integer", "edad", "Edad"),
        list("text", "comentario", "Comentario")
      )
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list(
        list("sexo", "1", "Hombre"),
        list("sexo", "2", "Mujer")
      )
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list("Publico 1", "form-publico1", "1", "es"))
    )
  )
}

.acsav_test_sav_frame <- function(sexo = c(1, 2, 1)) {
  data.frame(
    response_id = sprintf("R-%02d", seq_along(sexo)),
    sexo = as.numeric(sexo),
    edad = as.numeric(c(23, 41, 35)[seq_along(sexo)]),
    comentario = c("uno", "dos", "tres")[seq_along(sexo)],
    extra_manual = c("nota-a", "nota-b", "nota-c")[seq_along(sexo)],
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.acsav_test_register_sav <- function(sid, frame) {
  s <- session_get(sid)
  file_id <- paste0("sav-", uuid::UUIDgenerate())
  path <- file.path(s$dir, "uploads", paste0(file_id, ".sav"))
  haven::write_sav(frame, path)
  s$files[[file_id]] <- list(
    file_id = file_id, kind = "sav", original_name = "publico1.sav",
    path = path, size = file.info(path)$size, ext = "sav",
    uploaded_at = "2026-07-22T00:00:00Z"
  )
  .session_env[[sid]] <- s
  file_id
}

.acsav_test_setup <- function(frame = .acsav_test_sav_frame()) {
  sid <- session_create()
  workbook <- .acsav_test_workbook()
  revision_id <- "rev-publico1-1"
  file_id <- "file-rev-publico1"
  s <- session_get(sid)
  xls_path <- file.path(s$dir, "uploads", paste0(file_id, ".xlsx"))
  writeBin(.xlsform_revision_materialize(workbook), xls_path)
  s$files[[file_id]] <- list(
    file_id = file_id, kind = "xlsform", original_name = "publico1.xlsx",
    path = xls_path, size = file.info(xls_path)$size, ext = "xlsx"
  )
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1", revision_id = revision_id,
    form_id = "form-publico1", revision_no = 1L,
    content_sha256 = .xlsform_revision_hash(workbook),
    xlsform_file_id = file_id,
    source = list(kind = "surveymonkey", survey_id = "survey-publico1", actor_key = "publico1"),
    published_at = "2026-07-20T12:00:00Z"
  )
  .session_env[[sid]] <- s
  processing_intake_save(sid, 0L, list(list(
    entry_id = "entry-publico1", base = "publico1", base_label = "Público 1",
    actor_key = "publico1", actor = "Público 1", instrument_revision_id = revision_id
  )))
  sav_file_id <- .acsav_test_register_sav(sid, frame)
  list(sid = sid, base = "publico1", actor_key = "publico1", sav_file_id = sav_file_id)
}

.acsav_test_files <- function(setup) {
  list(list(base = setup$base, file_id = setup$sav_file_id))
}

.acsav_test_api_error <- function(expr) {
  tryCatch(expr, api_error = function(e) e)
}

test_that("preview normaliza el SAV, expone auditoría y variables extra sin mutar", {
  setup <- .acsav_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  before <- session_get(setup$sid)
  files_before <- list.files(file.path(before$dir, "uploads"), full.names = TRUE)

  preview <- acreditacion_sav_preview(setup$sid, .acsav_test_files(setup))

  expect_true(preview$ready)
  expect_equal(preview$schema, "accreditation_processing_sav/v1")
  expect_length(preview$entries, 1L)
  entry <- preview$entries[[1]]
  expect_equal(entry$base, "publico1")
  expect_equal(entry$actor_key, "publico1")
  expect_equal(entry$rows, 3L)
  expect_gt(entry$cols, 0L)
  expect_false(entry$blocked)
  expect_true(entry$compatibility$ok)
  expect_equal(entry$status, "ready")
  extra_names <- vapply(entry$extras, `[[`, character(1), "name")
  expect_true("extra_manual" %in% extra_names)
  expect_identical(entry$normalization$schema, "xlsform_normalization_audit/v1")
  expect_match(preview$preview_fingerprint, "^[0-9a-f]{64}$")
  # El preview no muta la sesión ni escribe archivos nuevos.
  expect_identical(session_get(setup$sid), before)
  expect_identical(list.files(file.path(before$dir, "uploads"), full.names = TRUE), files_before)
})

test_that("promote materializa la base con la identidad del intake y estado materialized", {
  setup <- .acsav_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  preview <- acreditacion_sav_preview(setup$sid, .acsav_test_files(setup))

  promoted <- acreditacion_sav_promote(
    setup$sid, .acsav_test_files(setup), preview$preview_fingerprint
  )
  expect_true(promoted$promoted)
  expect_false(promoted$already_materialized)
  expect_equal(unlist(promoted$base_names), "publico1")
  expect_true(is.list(promoted$estudio))

  s <- session_get(setup$sid)
  base <- s$estudio$bases$publico1
  expect_equal(base$n_filas, 3L)
  expect_equal(base$base_source, "sav_manual")
  expect_equal(base$source_kind, "sav_manual_acreditacion")
  expect_equal(base$processing_intake_entry_id, "entry-publico1")
  expect_equal(base$sibling_family_id, preview$pins$family_id)
  expect_equal(base$instrument_revision_id, "rev-publico1-1")
  expect_equal(base$preview_fingerprint, preview$preview_fingerprint)
  expect_equal(base$data_ext, "xlsx")
  expect_match(base$checksum$semantic, "^[0-9a-f]{64}$")
  persisted <- suppressWarnings(readxl::read_excel(s$files[[base$data_file_id]]$path))
  expect_true(all(c("sexo", "edad", "comentario") %in% names(persisted)))

  # El intake deriva "materialized" al leer, sin mutar sus entradas.
  intake <- processing_intake_get(setup$sid)
  status <- intake$validation$entries[[1]]$status
  expect_equal(status, "materialized")

  # Idempotente sin cambios: mismo fingerprint devuelve already_materialized.
  retried <- acreditacion_sav_promote(
    setup$sid, .acsav_test_files(setup), preview$preview_fingerprint
  )
  expect_true(retried$already_materialized)
  expect_false(retried$promoted)
})

test_that("SAV incompatible con el XLSForm es rechazado en promote", {
  setup <- .acsav_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  before <- session_get(setup$sid)

  preview <- testthat::with_mocked_bindings(
    acreditacion_sav_preview(setup$sid, .acsav_test_files(setup)),
    .carga_reorder_data_columns = function(df, instrumento) {
      df[, setdiff(names(df), "sexo"), drop = FALSE]
    },
    .package = "prosecnurapp"
  )
  expect_false(preview$ready)
  expect_true(preview$entries[[1]]$blocked)
  expect_false(preview$entries[[1]]$compatibility$ok)

  err <- testthat::with_mocked_bindings(
    .acsav_test_api_error(acreditacion_sav_promote(
      setup$sid, .acsav_test_files(setup), preview$preview_fingerprint
    )),
    .carga_reorder_data_columns = function(df, instrumento) {
      df[, setdiff(names(df), "sexo"), drop = FALSE]
    },
    .package = "prosecnurapp"
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_ACREDITACION_SAV_INCOMPATIBLE")
  expect_identical(session_get(setup$sid), before)
})

test_that("SAV con código fuera del catálogo sellado dispara E_ACREDITACION_SAV_UNKNOWN_CHOICE_CODES", {
  setup <- .acsav_test_setup(frame = .acsav_test_sav_frame(sexo = c(1, 9, 2)))
  on.exit(session_delete(setup$sid), add = TRUE)

  err <- .acsav_test_api_error(acreditacion_sav_preview(setup$sid, .acsav_test_files(setup)))

  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_ACREDITACION_SAV_UNKNOWN_CHOICE_CODES")
  expect_gt(length(err$details$variables), 0L)
})

test_that("errores de entrada: intake ausente, file_id inexistente y target desconocido", {
  # Intake ausente.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  err_intake <- .acsav_test_api_error(
    acreditacion_sav_preview(sid, list(list(base = "publico1", file_id = "x")))
  )
  expect_equal(err_intake$code, "E_ACREDITACION_SAV_INTAKE")

  setup <- .acsav_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)

  err_file <- .acsav_test_api_error(acreditacion_sav_preview(
    setup$sid, list(list(base = "publico1", file_id = "no-existe"))
  ))
  expect_equal(err_file$code, "E_ACREDITACION_SAV_FILE_NOT_FOUND")

  err_target <- .acsav_test_api_error(acreditacion_sav_preview(
    setup$sid, list(list(base = "publico-fantasma", file_id = setup$sav_file_id))
  ))
  expect_equal(err_target$code, "E_ACREDITACION_SAV_TARGET_UNKNOWN")

  err_empty <- .acsav_test_api_error(acreditacion_sav_preview(setup$sid, list()))
  expect_equal(err_empty$code, "E_ACREDITACION_SAV_FILES")
})

test_that("promote con fingerprint desactualizado no muta", {
  setup <- .acsav_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  before <- session_get(setup$sid)

  err <- .acsav_test_api_error(acreditacion_sav_promote(
    setup$sid, .acsav_test_files(setup), "deadbeef"
  ))
  expect_equal(err$code, "E_ACREDITACION_SAV_STALE")
  expect_identical(session_get(setup$sid), before)
})
