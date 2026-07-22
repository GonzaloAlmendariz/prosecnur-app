library(testthat)

.acb_test_revision <- function(sid, key) {
  s <- session_get(sid)
  revision_id <- paste0("rev-", key, "-1")
  file_id <- paste0("file-", revision_id)
  path <- file.path(s$dir, "uploads", paste0(file_id, ".xlsx"))
  workbook <- list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(list("text", "q1", paste("Pregunta", key)))
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list()
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list(key, paste0("form-", key), "1", "es"))
    )
  )
  writeBin(.xlsform_revision_materialize(workbook), path)
  s$files[[file_id]] <- list(
    file_id = file_id,
    kind = "xlsform",
    original_name = paste0(revision_id, ".xlsx"),
    path = path,
    size = file.info(path)$size,
    ext = "xlsx"
  )
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = paste0("form-", key),
    revision_no = 1L,
    content_sha256 = .xlsform_revision_hash(workbook),
    xlsform_file_id = file_id,
    source = list(
      kind = "surveymonkey",
      survey_id = paste0("survey-", key),
      actor_key = key
    ),
    published_at = "2026-07-20T12:00:00Z"
  )
  .session_env[[sid]] <- s
  revision_id
}

.acb_test_entry <- function(key, actor, revision_id) {
  list(
    entry_id = paste0("entry-", key),
    base = key,
    base_label = actor,
    actor_key = key,
    actor = actor,
    instrument_revision_id = revision_id
  )
}

.acb_test_refresh_token <- function(sid) {
  s <- session_get(sid)
  sources <- monitoreo_normalize_sources(s$monitoreo_sources %||% list())
  data <- .monitoreo_apply_source_metadata_to_data(s$monitoreo_snapshot$data, sources)
  cfg <- monitoreo_normalize_config(s$monitoreo_config, data)
  s$monitoreo_dashboard_cache_token_queries_summary <- .monitoreo_dashboard_cache_token(
    s$monitoreo_snapshot, data, cfg, report_scope = "queries_summary"
  )
  .session_env[[sid]] <- s
  invisible(s$monitoreo_dashboard_cache_token_queries_summary)
}

.acb_test_setup <- function() {
  sid <- session_create()
  actors <- c(
    administrativos = "Administrativos",
    docentes = "Docentes",
    egresados = "Egresados",
    estudiantes = "Estudiantes"
  )
  effective <- c(
    administrativos = 15L,
    docentes = 52L,
    egresados = 178L,
    estudiantes = 165L
  )
  actor_values <- rep(unname(actors), effective)
  n <- length(actor_values)
  data <- data.frame(
    response_id = sprintf("response-%04d", seq_len(n)),
    actor = actor_values,
    q1 = paste0("respuesta-", seq_len(n)),
    extra_legacy = paste0("legado-", seq_len(n)),
    `.source_role` = rep("respuestas", n),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  selected <- lapply(seq_len(n), function(i) list(
    actor = actor_values[[i]],
    response_id = data$response_id[[i]],
    response_row = i,
    case_key = paste0("case-", i),
    counts_in_advance = TRUE,
    platform_state = "Completa",
    advancement = "effective"
  ))
  excluded_actors <- rep(unname(actors), length.out = 109L)
  excluded <- lapply(seq_len(109L), function(i) list(
    actor = excluded_actors[[i]],
    response_id = paste0("excluded-", i),
    response_row = NA_integer_,
    case_key = paste0("excluded-case-", i),
    counts_in_advance = FALSE,
    platform_state = "Parcial",
    advancement = "partial"
  ))

  s <- session_get(sid)
  s$instrument_revisions <- list()
  s$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  s$monitoreo_snapshot <- list(data = data, synced_at = "2026-07-20T10:00:00Z")
  s$monitoreo_dashboard_cache_queries_summary <- list(
    acreditacion_reports = list(internal_queries = list(
      schema = "monitoreo_acreditacion_internal_queries_v1",
      case_rollup = c(selected, excluded)
    ))
  )
  .session_env[[sid]] <- s

  entries <- lapply(names(actors), function(key) {
    .acb_test_entry(key, actors[[key]], .acb_test_revision(sid, key))
  })
  processing_intake_save(sid, 0L, entries)
  .acb_test_refresh_token(sid)
  list(sid = sid, actors = actors, effective = effective)
}

.acb_test_promote_args <- function(preview, confirm_replacement = FALSE) {
  list(
    expected_intake_revision = preview$pins$intake_revision,
    expected_family_id = preview$pins$family_id,
    expected_cache_token = preview$pins$cache_token,
    preview_fingerprint = preview$pins$preview_fingerprint,
    confirm_replacement = confirm_replacement
  )
}

.acb_test_api_error <- function(expr) {
  tryCatch(expr, api_error = function(e) e)
}

.acb_test_choice_map_setup <- function() {
  sid <- session_create()
  maps <- list(
    list(
      variable = "p1", type = "select_one", list_name = "yesno",
      mappings = list(
        list(source_code = "10", source_label = "Sí", xls_code = "1", xls_label = "Sí"),
        list(source_code = "0", source_label = "Otro", xls_code = "14", xls_label = "Otro")
      )
    ),
    list(
      variable = "p2", type = "select_multiple", list_name = "multi",
      mappings = list(
        list(source_code = "1", source_column = "q0002_0001", xls_code = "a", xls_label = "A"),
        list(source_code = "2", source_column = "q0002_0002", xls_code = "b", xls_label = "B")
      )
    )
  )
  workbook <- list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(
        list("select_one yesno", "p1", "Respuesta"),
        list("select_multiple multi", "p2", "Opciones"),
        list("integer", "p3", "Edad"),
        list("text", "p4", "Comentario")
      )
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list(
        list("yesno", "1", "Sí"),
        list("yesno", "14", "Otro"),
        list("multi", "a", "A"),
        list("multi", "b", "B")
      )
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list("Actor", "actor", "1", "es"))
    )
  )
  revision_id <- "rev-actor-maps"
  xls_path <- file.path(session_get(sid)$dir, "uploads", "actor-maps.xlsx")
  writeBin(.xlsform_revision_materialize(workbook), xls_path)
  revision_hash <- .xlsform_revision_hash(workbook)
  maps_hash <- .xlsform_editor_sm_hash(maps)

  sav_path <- tempfile(fileext = ".sav")
  haven::write_sav(data.frame(
    response_id = c("R-1", "R-2", "R-3"),
    respondent_id = c("R-1", "R-2", "R-3"),
    q0001 = haven::labelled(c(10, 0, 10), labels = c("Sí" = 10, "Otro" = 0)),
    q0002_0001 = c(1, 1, NA),
    q0002_0002 = c(1, NA, 1),
    q0003 = c(19, 26, NA),
    q0004 = c("uno", "dos", "tres"),
    extra_manual = c("editado-a", "editado-b", "editado-c"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  ), sav_path)
  data <- as.data.frame(haven::read_sav(sav_path), stringsAsFactors = FALSE, check.names = FALSE)
  data$actor <- "Actor"
  data$dim_actor <- "Actor"
  data$.source_id <- "src-actor"
  data$.source_role <- "respuestas"

  selected <- lapply(1:2, function(i) list(
    actor = "Actor", response_id = paste0("R-", i), response_row = i,
    case_key = paste0("case-", i), counts_in_advance = TRUE,
    platform_state = "Completa", advancement = "effective"
  ))
  excluded <- list(list(
    actor = "Actor", response_id = "R-3", response_row = 3L,
    case_key = "case-3", counts_in_advance = FALSE,
    platform_state = "Parcial", advancement = "partial"
  ))

  s <- session_get(sid)
  s$files[["file-rev-actor-maps"]] <- list(
    file_id = "file-rev-actor-maps", kind = "xlsform", original_name = "actor.xlsx",
    path = xls_path, size = file.info(xls_path)$size, ext = "xlsx"
  )
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1", revision_id = revision_id,
    form_id = "form-actor", revision_no = 1L, content_sha256 = revision_hash,
    xlsform_file_id = "file-rev-actor-maps", choice_code_maps = maps,
    choice_code_maps_sha256 = maps_hash,
    source = list(kind = "surveymonkey", survey_id = "survey-actor", actor_key = "actor"),
    published_at = "2026-07-22T00:00:00Z"
  )
  s$monitoreo_sources <- list(list(
    id = "src-actor", role = "respuestas", actor = "Actor", actor_key = "actor",
    survey_id = "survey-actor"
  ))
  s$monitoreo_config <- list(monitoreo_profile = list(family = "acreditacion"))
  s$monitoreo_snapshot <- list(data = data, synced_at = "2026-07-22T00:00:00Z")
  s$monitoreo_dashboard_cache_queries_summary <- list(
    acreditacion_reports = list(internal_queries = list(
      schema = "monitoreo_acreditacion_internal_queries_v1",
      case_rollup = c(selected, excluded)
    ))
  )
  .session_env[[sid]] <- s
  processing_intake_save(sid, 0L, list(.acb_test_entry("actor", "Actor", revision_id)))
  .acb_test_refresh_token(sid)
  list(sid = sid, maps_hash = maps_hash)
}

.acb_test_mock_binding <- function(name, value) {
  target <- environment(carga_acreditacion_batch_promote)
  previous <- get(name, envir = target, inherits = FALSE)
  locked <- bindingIsLocked(name, target)
  if (locked) unlockBinding(name, target)
  assign(name, value, envir = target)
  if (locked) lockBinding(name, target)
  function() {
    if (bindingIsLocked(name, target)) unlockBinding(name, target)
    assign(name, previous, envir = target)
    if (locked) lockBinding(name, target)
  }
}

test_that("preview fuera de acreditación es 200 lógico y no muta", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  before <- session_get(sid)

  empty <- carga_acreditacion_batch_preview(sid)
  expect_false(empty$detected)
  expect_false(empty$ready)
  expect_equal(empty$totals, list(selected = 0L, excluded = 0L, total_rollup = 0L))
  expect_identical(session_get(sid), before)

  s <- session_get(sid)
  s$monitoreo_config <- list(monitoreo_profile = list(family = "territorial"))
  s$monitoreo_snapshot <- list(data = data.frame(id = 1L))
  .session_env[[sid]] <- s
  expect_false(carga_acreditacion_batch_preview(sid)$detected)
})

test_that("batch usa mapas sellados de la revisión y persiste auditoría", {
  setup <- .acb_test_choice_map_setup()
  on.exit(session_delete(setup$sid), add = TRUE)

  preview <- carga_acreditacion_batch_preview(setup$sid)
  expect_true(preview$ready)
  expect_equal(preview$totals, list(selected = 2L, excluded = 1L, total_rollup = 3L))
  expect_true(preview$entries[[1]]$compatibility$ok)

  promoted <- carga_acreditacion_batch_promote(
    setup$sid,
    .acb_test_promote_args(preview)
  )
  expect_true(promoted$promoted)
  s <- session_get(setup$sid)
  base <- s$estudio$bases$actor
  out <- suppressWarnings(readxl::read_excel(get_file(setup$sid, base$data_file_id)$path))

  expect_equal(as.character(out$p1), c("1", "14"))
  expect_equal(as.character(out$p2), c("a b", "a"))
  expect_false(any(grepl("^q0002_", names(out))))
  expect_identical(base$normalization$choice_code_maps$origin, "published_revision")
  expect_identical(base$normalization$choice_code_maps$sealed_sha256, setup$maps_hash)
  expect_true(base$normalization$compatibility$ok)
})

test_that("batch bloquea mapas inferidos que no están sellados", {
  setup <- .acb_test_choice_map_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  s <- session_get(setup$sid)
  s$instrument_revisions[["rev-actor-maps"]]$choice_code_maps <- list()
  s$instrument_revisions[["rev-actor-maps"]]$choice_code_maps_sha256 <-
    .xlsform_editor_sm_hash(list())
  .session_env[[setup$sid]] <- s

  err <- .acb_test_api_error(carga_acreditacion_batch_preview(setup$sid))

  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_ACREDITACION_BATCH_UNSEALED_CHOICE_MAP")
  expect_gt(length(unlist(err$details$variables, use.names = FALSE)), 0L)
})

test_that("preview usa sólo case_rollup persistido y expone el wire batch exacto", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  before <- session_get(setup$sid)
  files_before <- list.files(file.path(before$dir, "uploads"), recursive = TRUE)

  preview <- carga_acreditacion_batch_preview(setup$sid)

  expect_true(preview$detected)
  expect_true(preview$ready)
  expect_false(preview$replacement_required)
  expect_false(preview$already_materialized)
  expect_length(preview$blockers, 0L)
  expect_equal(preview$schema, "accreditation_processing_batch/v1")
  expect_equal(preview$totals, list(selected = 410L, excluded = 109L, total_rollup = 519L))
  counts <- stats::setNames(
    vapply(preview$entries, `[[`, integer(1), "selected"),
    vapply(preview$entries, `[[`, character(1), "actor_key")
  )
  expect_equal(counts[names(setup$effective)], setup$effective)
  expect_true(all(vapply(preview$entries, function(entry) entry$compatibility$ok, logical(1))))
  expect_true(all(vapply(preview$entries, function(entry) identical(entry$status, "ready"), logical(1))))
  expect_true(all(vapply(preview$entries, function(entry) {
    "extra_legacy" %in% vapply(entry$extras, `[[`, character(1), "name")
  }, logical(1))))
  expect_identical(session_get(setup$sid), before)
  expect_identical(list.files(file.path(before$dir, "uploads"), recursive = TRUE), files_before)
})

test_that("promote materializa cuatro bases juntas, conserva extras y es idempotente sin red", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  preview <- carga_acreditacion_batch_preview(setup$sid)

  testthat::local_mocked_bindings(
    .connections_token_require = function(...) stop("network forbidden"),
    .package = "prosecnurapp"
  )
  promoted <- carga_acreditacion_batch_promote(
    setup$sid, .acb_test_promote_args(preview)
  )

  expect_true(promoted$promoted)
  expect_false(promoted$already_materialized)
  expect_equal(sort(unlist(promoted$base_names)), sort(names(setup$actors)))
  expect_true(is.list(promoted$estudio))
  s <- session_get(setup$sid)
  expect_equal(sort(names(s$estudio$bases)), sort(names(setup$actors)))
  expect_equal(s$estudio$processing_mode, "independent_siblings")
  expect_false(s$estudio$independent_siblings$shared_logic)
  for (key in names(setup$effective)) {
    base <- s$estudio$bases[[key]]
    expect_equal(base$n_filas, setup$effective[[key]])
    expect_equal(base$source_kind, "monitoreo_acreditacion_batch")
    expect_equal(base$processing_intake_entry_id, paste0("entry-", key))
    expect_equal(base$sibling_family_id, preview$pins$family_id)
    expect_equal(base$instrument_revision_id, paste0("rev-", key, "-1"))
    expect_equal(base$variables_extra_incluidas, list())
    expect_match(base$variables_extra_checksum, "^[0-9a-f]{64}$")
    expect_match(base$checksum$semantic, "^[0-9a-f]{64}$")
    persisted <- readxl::read_excel(s$files[[base$data_file_id]]$path)
    expect_true("extra_legacy" %in% names(persisted))
  }

  before_retry <- session_get(setup$sid)
  files_before_retry <- list.files(file.path(before_retry$dir, "uploads"), full.names = TRUE)
  retried <- carga_acreditacion_batch_promote(
    setup$sid, .acb_test_promote_args(preview)
  )
  expect_true(retried$already_materialized)
  expect_false(retried$promoted)
  expect_identical(session_get(setup$sid), before_retry)
  expect_identical(list.files(file.path(before_retry$dir, "uploads"), full.names = TRUE), files_before_retry)
})

test_that("traza inválida, token stale e intake stale no mutan sesión ni archivos", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)

  s <- session_get(setup$sid)
  s$monitoreo_dashboard_cache_queries_summary$acreditacion_reports$internal_queries$case_rollup[[1]]$response_id <- "otro-id"
  .session_env[[setup$sid]] <- s
  before_trace <- session_get(setup$sid)
  err <- .acb_test_api_error(carga_acreditacion_batch_preview(setup$sid))
  expect_equal(err$code, "E_ACREDITACION_BATCH_TRACE_MISMATCH")
  expect_identical(session_get(setup$sid), before_trace)

  setup2 <- .acb_test_setup()
  on.exit(session_delete(setup2$sid), add = TRUE)
  preview <- carga_acreditacion_batch_preview(setup2$sid)
  s2 <- session_get(setup2$sid)
  s2$monitoreo_dashboard_cache_token_queries_summary <- "stale"
  .session_env[[setup2$sid]] <- s2
  before_stale <- session_get(setup2$sid)
  files_stale <- list.files(file.path(before_stale$dir, "uploads"), full.names = TRUE)
  stale <- .acb_test_api_error(carga_acreditacion_batch_promote(
    setup2$sid, .acb_test_promote_args(preview)
  ))
  expect_equal(stale$code, "E_ACREDITACION_BATCH_CACHE_STALE")
  expect_identical(session_get(setup2$sid), before_stale)
  expect_identical(list.files(file.path(before_stale$dir, "uploads"), full.names = TRUE), files_stale)

  setup3 <- .acb_test_setup()
  on.exit(session_delete(setup3$sid), add = TRUE)
  preview3 <- carga_acreditacion_batch_preview(setup3$sid)
  s3 <- session_get(setup3$sid)
  s3$processing_intake$revision <- s3$processing_intake$revision + 1L
  .session_env[[setup3$sid]] <- s3
  before_intake <- session_get(setup3$sid)
  intake_stale <- .acb_test_api_error(carga_acreditacion_batch_promote(
    setup3$sid, .acb_test_promote_args(preview3)
  ))
  expect_equal(intake_stale$code, "E_ACREDITACION_BATCH_STALE")
  expect_identical(session_get(setup3$sid), before_intake)
})

test_that("actor y case_key duplicados bloquean la traza sin mutar", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  s <- session_get(setup$sid)
  rollup <- s$monitoreo_dashboard_cache_queries_summary$acreditacion_reports$internal_queries$case_rollup
  rollup[[2]]$case_key <- rollup[[1]]$case_key
  s$monitoreo_dashboard_cache_queries_summary$acreditacion_reports$internal_queries$case_rollup <- rollup
  .session_env[[setup$sid]] <- s
  before <- session_get(setup$sid)

  err <- .acb_test_api_error(carga_acreditacion_batch_preview(setup$sid))

  expect_equal(err$code, "E_ACREDITACION_BATCH_TRACE")
  expect_identical(session_get(setup$sid), before)
})

test_that("preview expone incompatibilidad por actor y promote la rechaza sin mutar", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  before <- session_get(setup$sid)
  files_before <- list.files(file.path(before$dir, "uploads"), full.names = TRUE)

  preview <- testthat::with_mocked_bindings(
    carga_acreditacion_batch_preview(setup$sid),
    .carga_reorder_data_columns = function(df, instrumento) {
      df[, setdiff(names(df), "q1"), drop = FALSE]
    },
    .package = "prosecnurapp"
  )

  expect_false(preview$ready)
  expect_true(all(vapply(preview$entries, function(entry) entry$status == "blocked", logical(1))))
  expect_true(all(vapply(preview$entries, function(entry) !entry$compatibility$ok, logical(1))))
  expect_true(all(vapply(preview$entries, function(entry) {
    "instrument_data_incompatible" %in% vapply(entry$blocking_reasons, `[[`, character(1), "code")
  }, logical(1))))
  expect_identical(session_get(setup$sid), before)
  expect_identical(list.files(file.path(before$dir, "uploads"), full.names = TRUE), files_before)

  incompatible <- testthat::with_mocked_bindings(
    .acb_test_api_error(carga_acreditacion_batch_promote(
      setup$sid, .acb_test_promote_args(preview)
    )),
    .carga_reorder_data_columns = function(df, instrumento) {
      df[, setdiff(names(df), "q1"), drop = FALSE]
    },
    .package = "prosecnurapp"
  )
  expect_equal(incompatible$code, "E_ACREDITACION_BATCH_INCOMPATIBLE")
  expect_identical(session_get(setup$sid), before)
  expect_identical(list.files(file.path(before$dir, "uploads"), full.names = TRUE), files_before)
})

test_that("incompatibilidad y fallo posterior al staging hacen rollback físico total", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  preview <- carga_acreditacion_batch_preview(setup$sid)
  before <- session_get(setup$sid)
  files_before <- list.files(file.path(before$dir, "uploads"), full.names = TRUE)

  incompatible <- testthat::with_mocked_bindings(
    .acb_test_api_error(carga_acreditacion_batch_promote(
      setup$sid, .acb_test_promote_args(preview)
    )),
    .carga_reorder_data_columns = function(df, instrumento) {
      df[, setdiff(names(df), "q1"), drop = FALSE]
    },
    .package = "prosecnurapp"
  )
  expect_equal(incompatible$code, "E_ACREDITACION_BATCH_INCOMPATIBLE")
  expect_identical(session_get(setup$sid), before)
  expect_identical(list.files(file.path(before$dir, "uploads"), full.names = TRUE), files_before)

  setup2 <- .acb_test_setup()
  on.exit(session_delete(setup2$sid), add = TRUE)
  preview2 <- carga_acreditacion_batch_preview(setup2$sid)
  before2 <- session_get(setup2$sid)
  files_before2 <- list.files(file.path(before2$dir, "uploads"), full.names = TRUE)
  restore <- .acb_test_mock_binding(
    ".acb_state_with_materialization",
    function(...) stop("fallo inyectado tras staging")
  )
  on.exit(restore(), add = TRUE)
  expect_error(
    carga_acreditacion_batch_promote(setup2$sid, .acb_test_promote_args(preview2)),
    "fallo inyectado"
  )
  expect_identical(session_get(setup2$sid), before2)
  expect_identical(list.files(file.path(before2$dir, "uploads"), full.names = TRUE), files_before2)
})

test_that("un fingerprint nuevo exige confirmación explícita para reemplazar", {
  setup <- .acb_test_setup()
  on.exit(session_delete(setup$sid), add = TRUE)
  first <- carga_acreditacion_batch_preview(setup$sid)
  carga_acreditacion_batch_promote(setup$sid, .acb_test_promote_args(first))

  s <- session_get(setup$sid)
  s$monitoreo_snapshot$data$q1[[1]] <- "respuesta corregida"
  .session_env[[setup$sid]] <- s
  .acb_test_refresh_token(setup$sid)
  replacement <- carga_acreditacion_batch_preview(setup$sid)
  expect_true(replacement$replacement_required)
  expect_false(replacement$already_materialized)
  before <- session_get(setup$sid)

  denied <- .acb_test_api_error(carga_acreditacion_batch_promote(
    setup$sid, .acb_test_promote_args(replacement)
  ))
  expect_equal(denied$code, "E_ACREDITACION_BATCH_CONFIRM_REPLACEMENT")
  expect_identical(session_get(setup$sid), before)

  accepted <- carga_acreditacion_batch_promote(
    setup$sid, .acb_test_promote_args(replacement, confirm_replacement = TRUE)
  )
  expect_false(accepted$already_materialized)
  expect_equal(session_get(setup$sid)$estudio$bases$administrativos$n_filas, 15L)
})
