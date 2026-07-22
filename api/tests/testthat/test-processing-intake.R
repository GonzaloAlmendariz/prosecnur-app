library(testthat)

.pi_add_revision <- function(sid, form_id, revision_no, revision_id,
                             variant = "a", form_name = NULL,
                             source_actor_key = NULL, source_schema = NULL) {
  s <- session_get(sid)
  file_id <- paste0("file-", revision_id)
  path <- file.path(s$dir, "uploads", paste0(file_id, ".xlsx"))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  workbook <- list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(list("text", "q1", paste("Pregunta", variant)))
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list()
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list(form_name %||% form_id, form_id, as.character(revision_no), "es"))
    )
  )
  writeBin(.xlsform_revision_materialize(workbook), path)
  s$files <- s$files %||% list()
  s$files[[file_id]] <- list(
    file_id = file_id,
    kind = "xlsform",
    original_name = paste0(revision_id, ".xlsx"),
    path = path,
    size = file.info(path)$size,
    ext = "xlsx"
  )
  s$instrument_revisions <- s$instrument_revisions %||% list()
  source <- list(kind = "surveymonkey", survey_id = paste0("survey-", form_id))
  if (!is.null(source_actor_key)) source$actor_key <- source_actor_key
  if (!is.null(source_schema)) source$schema <- source_schema
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = form_id,
    revision_no = as.integer(revision_no),
    content_sha256 = .xlsform_revision_hash(workbook),
    xlsform_file_id = file_id,
    source = source,
    published_at = sprintf("2026-07-%02dT12:00:00Z", as.integer(revision_no))
  )
  s$xlsform_forms <- s$xlsform_forms %||% list()
  if (is.null(s$xlsform_forms[[form_id]])) {
    s$xlsform_forms[[form_id]] <- list(
      id = form_id,
      name = form_name %||% form_id,
      workbook = list(),
      source = list(kind = "surveymonkey")
    )
  }
  .session_env[[sid]] <- s
  invisible(s$instrument_revisions[[revision_id]])
}

.pi_entry <- function(key, revision_id) {
  list(
    entry_id = paste0("entry-", key),
    base = key,
    base_label = tools::toTitleCase(key),
    actor_key = key,
    actor = tools::toTitleCase(key),
    instrument_revision_id = revision_id
  )
}

.pi_four_entries <- function() {
  keys <- c("docentes", "estudiantes", "egresados", "administrativos")
  unname(lapply(keys, function(key) .pi_entry(key, paste0("rev-", key, "-1"))))
}

.pi_seed_four_revisions <- function(sid) {
  keys <- c("docentes", "estudiantes", "egresados", "administrativos")
  for (i in seq_along(keys)) {
    key <- keys[[i]]
    .pi_add_revision(
      sid,
      form_id = paste0("form-", key),
      revision_no = 1L,
      revision_id = paste0("rev-", key, "-1"),
      variant = letters[[i]],
      form_name = tools::toTitleCase(key)
    )
  }
}

.pi_api_error <- function(expr) {
  tryCatch(expr, api_error = function(e) e)
}

test_that("proyecto legacy expone un intake vacío compatible", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  payload <- processing_intake_get(sid)

  expect_true(payload$ok)
  expect_equal(payload$intake$schema, "processing_intake/v1")
  expect_equal(payload$intake$processing_mode, "independent_siblings")
  expect_equal(payload$intake$revision, 0L)
  expect_null(payload$intake$family_id)
  expect_length(payload$intake$entries, 0L)
  expect_length(payload$revisions, 0L)
  expect_true(payload$validation$valid)
})

test_that("validar es read-only y guardar cuatro bindings no crea bases", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_seed_four_revisions(sid)
  entries <- .pi_four_entries()
  before <- session_get(sid)

  preview <- processing_intake_validate(sid, entries)

  expect_true(preview$validation$valid)
  expect_equal(vapply(preview$validation$entries, `[[`, character(1), "status"),
               rep("instrument_ready", 4L))
  expect_identical(session_get(sid), before)

  estudio_before <- session_get(sid)$estudio
  saved <- processing_intake_save(sid, 0L, entries)
  stored <- session_get(sid)

  expect_equal(saved$intake$revision, 1L)
  expect_match(saved$intake$family_id, "^[0-9a-f-]{36}$")
  expect_length(saved$intake$entries, 4L)
  expect_identical(stored$estudio, estudio_before)
  expect_null((stored$estudio %||% list())$bases)
  expect_equal(
    vapply(stored$processing_intake$entries, `[[`, character(1), "instrument_revision_id"),
    vapply(entries, `[[`, character(1), "instrument_revision_id")
  )
})

test_that("formulario activo no influye y una V2 vuelve stale sin sustituir", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_add_revision(sid, "form-docentes", 1L, "rev-docentes-1", "a", "Docentes")
  s <- session_get(sid)
  s$xlsform_active_form_id <- "otro-formulario"
  .session_env[[sid]] <- s
  processing_intake_save(sid, 0L, list(.pi_entry("docentes", "rev-docentes-1")))

  s <- session_get(sid)
  s$xlsform_active_form_id <- "form-docentes"
  .session_env[[sid]] <- s
  .pi_add_revision(sid, "form-docentes", 2L, "rev-docentes-2", "b", "Docentes")
  payload <- processing_intake_get(sid)
  entry <- payload$intake$entries[[1]]

  expect_equal(entry$status, "stale")
  expect_equal(entry$instrument_revision_id, "rev-docentes-1")
  expect_equal(entry$form_id, "form-docentes")
  expect_equal(entry$latest_revision_id, "rev-docentes-2")
  expect_equal(
    session_get(sid)$processing_intake$entries[[1]]$instrument_revision_id,
    "rev-docentes-1"
  )
  expect_true(payload$validation$valid)
  expect_equal(payload$validation$warnings[[1]]$code, "W_PROCESSING_INTAKE_STALE")
})

test_that("conflicto optimista y batch inválido no mutan el estado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_add_revision(sid, "form-docentes", 1L, "rev-docentes-1")
  entry <- .pi_entry("docentes", "rev-docentes-1")
  processing_intake_save(sid, 0L, list(entry))
  before <- session_get(sid)

  conflict <- .pi_api_error(processing_intake_save(sid, 0L, list(entry)))
  expect_s3_class(conflict, "api_error")
  expect_equal(conflict$code, "E_PROCESSING_INTAKE_STALE")
  expect_identical(session_get(sid), before)

  invalid <- list(entry, utils::modifyList(entry, list(
    entry_id = "entry-duplicada",
    instrument_revision_id = "revision-inexistente"
  )))
  invalid_error <- .pi_api_error(processing_intake_save(sid, 1L, invalid))
  expect_s3_class(invalid_error, "api_error")
  expect_equal(invalid_error$code, "E_PROCESSING_INTAKE_INVALID")
  expect_identical(session_get(sid), before)
})

test_that("actor_key duplicado y snapshot físico alterado bloquean el plan", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_add_revision(sid, "form-docentes", 1L, "rev-docentes-1", "a", "Docentes")
  .pi_add_revision(sid, "form-egresados", 1L, "rev-egresados-1", "b", "Egresados")
  docentes <- .pi_entry("docentes", "rev-docentes-1")
  egresados <- .pi_entry("egresados", "rev-egresados-1")
  egresados$actor_key <- "docentes"

  duplicated <- processing_intake_validate(sid, list(docentes, egresados))
  expect_false(duplicated$validation$valid)
  expect_true("E_PROCESSING_INTAKE_ACTOR_DUPLICATED" %in%
                vapply(duplicated$validation$blockers, `[[`, character(1), "code"))

  s <- session_get(sid)
  path <- s$files[["file-rev-docentes-1"]]$path
  wb <- openxlsx::loadWorkbook(path)
  openxlsx::writeData(wb, "survey", "Pregunta alterada", startCol = 3L, startRow = 2L,
                      colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  altered <- processing_intake_validate(sid, list(docentes))
  expect_false(altered$validation$valid)
  expect_equal(altered$validation$entries[[1]]$status, "blocked")
  expect_true("instrument_snapshot_hash_mismatch" %in%
                vapply(altered$validation$entries[[1]]$blocking_reasons,
                       `[[`, character(1), "code"))
  expect_null(session_get(sid)$processing_intake)
})

test_that("actor_key del intake acredita exactamente la revisión publicada", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  accreditation_schema <- "acreditacion_actor_instrument_draft/v1"
  .pi_add_revision(
    sid, "form-docentes", 1L, "rev-docentes-1", "a", "Docentes",
    source_actor_key = "docentes", source_schema = accreditation_schema
  )
  .pi_add_revision(
    sid, "form-egresados", 1L, "rev-egresados-1", "b", "Egresados",
    source_actor_key = "egresados"
  )
  .pi_add_revision(
    sid, "form-administrativos", 1L, "rev-administrativos-1", "c", "Administrativos",
    source_schema = NULL
  )
  state <- session_get(sid)
  state$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  .session_env[[sid]] <- state

  matched <- processing_intake_validate(
    sid, list(.pi_entry("docentes", "rev-docentes-1"))
  )
  expect_true(matched$validation$valid)
  expect_equal(matched$validation$entries[[1]]$status, "instrument_ready")
  docentes_revision <- Filter(
    function(revision) identical(revision$revision_id, "rev-docentes-1"),
    matched$revisions
  )[[1]]
  expect_equal(docentes_revision$source$actor_key, "docentes")

  mismatched <- processing_intake_validate(
    sid, list(.pi_entry("docentes", "rev-egresados-1"))
  )
  expect_false(mismatched$validation$valid)
  expect_equal(mismatched$validation$entries[[1]]$status, "blocked")
  expect_true("E_PROCESSING_INTAKE_INSTRUMENT_ACTOR_MISMATCH" %in%
                vapply(mismatched$validation$blockers, `[[`, character(1), "code"))
  expect_equal(mismatched$validation$blockers[[1]]$field, "actor_key")

  missing <- processing_intake_validate(
    sid, list(.pi_entry("administrativos", "rev-administrativos-1"))
  )
  expect_false(missing$validation$valid)
  expect_equal(missing$validation$entries[[1]]$status, "blocked")
  expect_true("E_PROCESSING_INTAKE_INSTRUMENT_ACTOR_REQUIRED" %in%
                vapply(missing$validation$blockers, `[[`, character(1), "code"))
  expect_equal(missing$validation$blockers[[1]]$field, "actor_key")
})

test_that("intake rechaza actor fuera del catálogo aunque revisión y entrada coincidan", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_add_revision(
    sid, "form-ajeno", 1L, "rev-ajeno-1", "a", "Actor ajeno",
    source_actor_key = "egresados",
    source_schema = "acreditacion_actor_instrument_draft/v1"
  )
  state <- session_get(sid)
  state$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  state$monitoreo_sources <- list(list(
    id = "sm-docentes",
    kind = "surveymonkey",
    enabled = TRUE,
    role = "respuestas",
    survey_id = "survey-docentes",
    label = "SurveyMonkey · Docentes",
    dimensions = list(actor = "Docentes")
  ))
  .session_env[[sid]] <- state

  result <- processing_intake_validate(
    sid, list(.pi_entry("egresados", "rev-ajeno-1"))
  )

  expect_false(result$validation$valid)
  expect_equal(result$validation$entries[[1]]$status, "blocked")
  expect_true("E_PROCESSING_INTAKE_INSTRUMENT_ACTOR_NOT_IN_CATALOG" %in%
                vapply(result$validation$blockers, `[[`, character(1), "code"))
  expect_true("actor_key" %in% vapply(
    result$validation$blockers,
    function(blocker) blocker$field %||% "",
    character(1)
  ))
})

test_that("materialized exige coincidencia triple de entrada, familia y revisión", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_add_revision(sid, "form-docentes", 1L, "rev-docentes-1", "a", "Docentes")
  saved <- processing_intake_save(
    sid, 0L, list(.pi_entry("docentes", "rev-docentes-1"))
  )
  family_id <- saved$intake$family_id
  s <- session_get(sid)
  s$estudio <- list(bases = list(docentes = list(
    processing_intake_entry_id = "entry-docentes",
    sibling_family_id = family_id,
    instrument_revision_id = "rev-docentes-1"
  )))
  .session_env[[sid]] <- s

  expect_equal(processing_intake_get(sid)$intake$entries[[1]]$status, "materialized")

  s <- session_get(sid)
  s$estudio$bases$docentes$sibling_family_id <- "otra-familia"
  .session_env[[sid]] <- s
  conflicted <- processing_intake_get(sid)
  expect_equal(conflicted$intake$entries[[1]]$status, "blocked")
  expect_equal(
    conflicted$intake$entries[[1]]$blocking_reasons[[1]]$code,
    "base_target_conflict"
  )
})

test_that("guardar un payload idéntico es no-op sin revisión ni dirty", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  .pi_add_revision(sid, "form-docentes", 1L, "rev-docentes-1", "a", "Docentes")
  entry <- .pi_entry("docentes", "rev-docentes-1")
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  first <- processing_intake_save(sid, 0L, list(entry))
  s <- session_get(sid)
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s

  same <- processing_intake_save(sid, 1L, list(entry))

  expect_equal(same$intake$revision, 1L)
  expect_equal(same$intake$family_id, first$intake$family_id)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_null(session_get(sid)$processing_intake$entries[[1]]$status)
})

test_that("round-trip .pulso conserva familia, revisión y cuatro bindings", {
  sid <- session_create()
  project <- tempfile(fileext = ".pulso")
  on.exit({
    unlink(project, force = TRUE)
    session_delete(sid)
  }, add = TRUE)
  .pi_seed_four_revisions(sid)
  saved <- processing_intake_save(sid, 0L, .pi_four_entries())

  built <- build_pulso(sid, project, project_name = "Acreditación")
  expect_true(built$ok)
  loaded <- load_pulso(project)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- processing_intake_get(loaded$session_id)

  expect_equal(restored$intake$family_id, saved$intake$family_id)
  expect_equal(restored$intake$revision, 1L)
  expect_length(restored$intake$entries, 4L)
  expect_equal(
    vapply(restored$intake$entries, `[[`, character(1), "instrument_revision_id"),
    vapply(.pi_four_entries(), `[[`, character(1), "instrument_revision_id")
  )
  expect_true(restored$validation$valid)
  expect_equal(vapply(restored$intake$entries, `[[`, character(1), "status"),
               rep("instrument_ready", 4L))
  expect_length((session_get(loaded$session_id)$estudio %||% list())$bases %||% list(), 0L)
})
