library(testthat)

.sav_lineage_write_xlsx <- function(data, sheet) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, sheet)
  openxlsx::writeData(wb, sheet, data)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.sav_lineage_certify_base <- function(sid, base_name, inst_meta) {
  revision_hash <- .xlsform_revision_hash(
    .processing_intake_physical_workbook(inst_meta$path)
  )
  revision_id <- paste0("revision-", base_name, "-", inst_meta$file_id)
  revision <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = base_name,
    revision_no = 1L,
    content_sha256 = revision_hash,
    xlsform_file_id = inst_meta$file_id,
    published_at = "2026-07-22T00:00:00Z",
    choice_code_maps = list(),
    choice_code_maps_sha256 = .xlsform_editor_sm_hash(list())
  )
  state <- session_get(sid)
  state$instrument_revisions <- state$instrument_revisions %||% list()
  state$instrument_revisions[[revision_id]] <- revision
  base <- state$estudio$bases[[base_name]]
  base$original_xlsform_file_id <- inst_meta$file_id
  base$instrument_revision_id <- revision_id
  base$instrument_revision_hash <- revision_hash
  state$estudio$bases[[base_name]] <- base
  .session_env[[sid]] <- state
  revision
}

.sav_lineage_fixture <- function() {
  sid <- session_create()
  initial <- data.frame(
    testreal = c("real", "test"),
    value = 1:2,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey <- data.frame(
    type = c("text", "integer"),
    name = c("testreal", "value"),
    label = c("Tipo de entrevista", "Valor"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = character(),
    name = character(),
    label = character(),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inst_path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::addWorksheet(wb, "settings")
  openxlsx::writeData(wb, "settings", data.frame(
    form_title = "Actor",
    form_id = "actor",
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, inst_path, overwrite = TRUE)
  data_path <- .sav_lineage_write_xlsx(initial, "datos")
  inst_meta <- save_upload(
    sid,
    "xlsform",
    "actor_form.xlsx",
    readBin(inst_path, "raw", n = file.info(inst_path)$size)
  )
  data_meta <- save_upload(
    sid,
    "data",
    "actor_inicial.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  rp_inst <- reporte_instrumento(inst_meta$path)
  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    "actor",
    inst_meta$file_id,
    data_meta$file_id,
    "xlsx",
    reporte_data(initial, instrumento = rp_inst),
    rp_inst,
    nrow(initial),
    ncol(initial),
    extra_meta = list(
      processing_mode = "independent_siblings",
      source_alias = "Actor",
      survey_id = "actor"
    )
  )
  revision <- .sav_lineage_certify_base(sid, "actor", inst_meta)
  list(
    sid = sid,
    inst_meta = inst_meta,
    initial_data_meta = data_meta,
    rp_inst = rp_inst,
    revision = revision
  )
}

.sav_lineage_prepare_multibase_bundle <- function(sid, data_by_base) {
  zip_path <- tempfile(fileext = ".zip")
  work_dir <- tempfile("sav_lineage_zip_")
  dir.create(work_dir, recursive = TRUE)
  old_dir <- setwd(work_dir)
  on.exit({
    setwd(old_dir)
    unlink(work_dir, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  sav_files <- paste0(names(data_by_base), ".sav")
  for (idx in seq_along(data_by_base)) {
    haven::write_sav(data_by_base[[idx]], sav_files[[idx]])
  }
  zip::zip(
    zipfile = zip_path,
    files = sav_files,
    include_directories = FALSE,
    mode = "mirror"
  )
  zip_meta <- save_upload(
    sid,
    "sav_bundle",
    "actores.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )
  file_base_map <- stats::setNames(as.list(names(data_by_base)), sav_files)
  inspection <- sm_multibase_sav_bundle_inspect(
    sid,
    zip_meta$file_id,
    file_base_map = file_base_map
  )
  expect_true(inspection$ok)
  list(
    zip_meta = zip_meta,
    file_base_map = file_base_map,
    inspection = inspection
  )
}

.sav_lineage_prepare_bundle <- function(sid, data) {
  .sav_lineage_prepare_multibase_bundle(sid, list(actor = data))
}

.sav_lineage_import <- function(sid, data) {
  bundle <- .sav_lineage_prepare_bundle(sid, data)
  imported <- sm_multibase_sav_bundle_import(
    sid,
    bundle$zip_meta$file_id,
    file_base_map = bundle$file_base_map,
    expected_inspection_fingerprint = bundle$inspection$inspection_fingerprint
  )
  list(
    result = imported,
    raw_data_file_id = imported$results[[1]]$data_file_id
  )
}

.sav_lineage_manifest <- function(root) {
  paths <- sort(list.files(
    root,
    all.files = TRUE,
    recursive = TRUE,
    full.names = TRUE
  ))
  files <- paths[file.info(paths)$isdir %in% FALSE]
  stats::setNames(lapply(files, function(path) {
    list(
      size = as.numeric(file.info(path)$size),
      sha256 = tolower(digest::digest(file = path, algo = "sha256"))
    )
  }), substring(files, nchar(root) + 2L))
}

.sav_lineage_downloads <- function(root) {
  downloads <- file.path(root, "downloads")
  if (!dir.exists(downloads)) return(character(0))
  paths <- list.files(
    downloads,
    all.files = TRUE,
    recursive = TRUE,
    full.names = TRUE
  )
  paths <- paths[file.info(paths)$isdir %in% FALSE]
  sort(substring(paths, nchar(downloads) + 2L))
}

.sav_lineage_previous_data_id <- function(base) {
  audit <- base$surveymonkey_sav_bundle_import %||% list()
  lineage <- audit$lineage %||% list()
  as.character(
    audit$previous_data_file_id %||%
      audit$prior_data_file_id %||%
      lineage$previous_data_file_id %||%
      lineage$prior_data_file_id %||%
      ""
  )
}

.sav_lineage_filter_config <- function() {
  list(
    version = 1L,
    enabled = TRUE,
    variable = "testreal",
    real_values = list("real"),
    test_values = list("test"),
    missing_policy = "exclude",
    unassigned_policy = "unclassified"
  )
}

test_that("Codificacion posterior conserva el SAV importado como original de Analitica", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("haven")
  skip_if_not_installed("zip")
  fixture <- .sav_lineage_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  previous_id <- fixture$initial_data_meta$file_id
  imported <- .sav_lineage_import(
    fixture$sid,
    data.frame(
      testreal = c("real", "real", "test"),
      value = 10:12,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  sav_id <- imported$raw_data_file_id
  after_import <- session_get(fixture$sid)$estudio$bases$actor

  expect_identical(after_import$original_data_file_id, sav_id)
  expect_identical(.sav_lineage_previous_data_id(after_import), previous_id)

  adapted_path <- .sav_lineage_write_xlsx(
    data.frame(testreal = "real", value = 99L),
    "datos"
  )
  adapted_meta <- save_upload(
    fixture$sid,
    "data",
    "actor_adaptada.xlsx",
    readBin(adapted_path, "raw", n = file.info(adapted_path)$size)
  )
  state <- session_get(fixture$sid)
  state$files[[adapted_meta$file_id]]$kind <- "data_adaptada"
  state$estudio$bases$actor$data_file_id <- adapted_meta$file_id
  .session_env[[fixture$sid]] <- state

  resolved <- .analitica_pair_for_base(
    state,
    state$estudio$bases$actor,
    fuente = "originales",
    base_name = "actor"
  )

  expect_identical(resolved$data$file_id, sav_id)
})

test_that("importar SAV invalida el snapshot remoto anterior para la base unificada", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("haven")
  skip_if_not_installed("zip")
  fixture <- .sav_lineage_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)

  before <- session_get(fixture$sid)
  before$estudio$bases$actor$surveymonkey_raw_snapshot_file_id <- "snapshot-remoto-anterior"
  before$estudio$bases$actor$surveymonkey_decision_audit <- list(origin = "snapshot-remoto-anterior")
  .session_env[[fixture$sid]] <- before

  imported <- .sav_lineage_import(
    fixture$sid,
    data.frame(
      testreal = c("real", "test"),
      value = 40:41,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  state <- session_get(fixture$sid)
  base <- state$estudio$bases$actor
  pair <- .analitica_pair_for_base(state, base, fuente = "originales", base_name = "actor")

  effective <- testthat::with_mocked_bindings(
    .analitica_unified_effective_context(fixture$sid, "actor", base, pair),
    .sm_mb_build_effective_from_snapshot = function(...) {
      list(
        inst = fixture$rp_inst,
        data = data.frame(marker = "OLD_SNAPSHOT"),
        audit = list(origin = "snapshot-remoto-anterior")
      )
    },
    .analitica_read_pair = function(...) {
      list(
        inst = fixture$rp_inst,
        data = data.frame(marker = "SAV_NUEVO"),
        audit = list(origin = "sav")
      )
    },
    .package = "prosecnurapp"
  )

  expect_false(nzchar(as.character(base$surveymonkey_raw_snapshot_file_id %||% "")))
  expect_identical(base$surveymonkey_decision_audit$kind, "surveymonkey_sav_bundle_response_filter")
  expect_false(effective$rebuilt_from_snapshot)
  expect_identical(as.character(effective$data$marker), c("SAV_NUEVO"))
  expect_identical(imported$raw_data_file_id, base$original_data_file_id)
})

test_that("importar SAV reaplica universe_filter sobre la fuente nueva", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("haven")
  skip_if_not_installed("zip")
  fixture <- .sav_lineage_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  carga_universe_filter_apply(
    fixture$sid,
    "actor",
    .sav_lineage_filter_config()
  )
  before <- session_get(fixture$sid)$estudio$bases$actor
  previous_source_id <- before$universe_filter$source_data_file_id
  previous_effective_id <- before$universe_filter$effective_data_file_id

  imported <- .sav_lineage_import(
    fixture$sid,
    data.frame(
      testreal = c("real", "real", "test", "test"),
      value = 20:23,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  sav_id <- imported$raw_data_file_id
  state <- session_get(fixture$sid)
  base <- state$estudio$bases$actor
  filter <- base$universe_filter

  expect_identical(base$original_data_file_id, sav_id)
  expect_identical(filter$source_data_file_id, sav_id)
  expect_false(identical(filter$source_data_file_id, previous_source_id))
  expect_false(identical(filter$effective_data_file_id, previous_effective_id))
  expect_identical(base$data_file_id, filter$effective_data_file_id)
  expect_false(identical(base$data_file_id, sav_id))
  expect_equal(nrow(.cuf_file_df(state, filter$effective_data_file_id)$data), 2L)
  expect_identical(.sav_lineage_previous_data_id(base), previous_effective_id)
})

test_that("fallo al reaplicar universe_filter revierte sesion y artefactos SAV", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("haven")
  skip_if_not_installed("zip")
  fixture <- .sav_lineage_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)
  carga_universe_filter_apply(
    fixture$sid,
    "actor",
    .sav_lineage_filter_config()
  )
  bundle <- .sav_lineage_prepare_bundle(
    fixture$sid,
    data.frame(
      testreal = c("real", "test"),
      value = 30:31,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  before <- session_get(fixture$sid)
  before_base <- before$estudio$bases$actor
  before_files <- before$files
  before_manifest <- .sav_lineage_manifest(before$dir)

  testthat::local_mocked_bindings(
    carga_universe_filter_reapply = function(...) {
      stop_api(
        500,
        "E_TEST_UNIVERSE_REAPPLY",
        "Fallo simulado al reaplicar universe_filter."
      )
    },
    .package = "prosecnurapp"
  )
  err <- tryCatch(
    sm_multibase_sav_bundle_import(
      fixture$sid,
      bundle$zip_meta$file_id,
      file_base_map = bundle$file_base_map,
      expected_inspection_fingerprint = bundle$inspection$inspection_fingerprint
    ),
    error = function(e) e
  )
  after <- session_get(fixture$sid)

  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_TEST_UNIVERSE_REAPPLY")
  expect_identical(after, before)
  expect_identical(after$estudio$bases$actor, before_base)
  expect_identical(after$files, before_files)
  expect_identical(.sav_lineage_manifest(after$dir), before_manifest)
})

test_that("fallo en segunda base revierte el efectivo creado para la primera", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("haven")
  skip_if_not_installed("zip")
  fixture <- .sav_lineage_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)

  second_data <- data.frame(
    testreal = c("real", "test"),
    value = 101:102,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  second_path <- .sav_lineage_write_xlsx(second_data, "datos")
  second_meta <- save_upload(
    fixture$sid,
    "data",
    "actor_b_inicial.xlsx",
    readBin(second_path, "raw", n = file.info(second_path)$size)
  )
  estudio_add_base(
    fixture$sid,
    "actor_b",
    fixture$inst_meta$file_id,
    second_meta$file_id,
    "xlsx",
    reporte_data(second_data, instrumento = fixture$rp_inst),
    fixture$rp_inst,
    nrow(second_data),
    ncol(second_data),
    extra_meta = list(
      processing_mode = "independent_siblings",
      source_alias = "Actor B",
      survey_id = "actor_b"
    )
  )
  .sav_lineage_certify_base(fixture$sid, "actor_b", fixture$inst_meta)
  carga_universe_filter_apply(
    fixture$sid,
    "actor",
    .sav_lineage_filter_config()
  )
  carga_universe_filter_apply(
    fixture$sid,
    "actor_b",
    .sav_lineage_filter_config()
  )
  bundle <- .sav_lineage_prepare_multibase_bundle(
    fixture$sid,
    list(
      actor = data.frame(
        testreal = c("real", "test"),
        value = 201:202,
        stringsAsFactors = FALSE,
        check.names = FALSE
      ),
      actor_b = data.frame(
        testreal = c("real", "test"),
        value = 301:302,
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    )
  )
  before <- session_get(fixture$sid)
  before_bases <- before$estudio$bases
  before_files <- before$files
  before_manifest <- .sav_lineage_manifest(before$dir)
  before_downloads <- .sav_lineage_downloads(before$dir)
  real_reapply <- get(
    "carga_universe_filter_reapply",
    envir = asNamespace("prosecnurapp")
  )
  calls <- new.env(parent = emptyenv())
  calls$n <- 0L

  testthat::local_mocked_bindings(
    carga_universe_filter_reapply = function(...) {
      calls$n <- calls$n + 1L
      if (identical(calls$n, 1L)) return(real_reapply(...))
      stop_api(
        500,
        "E_TEST_SECOND_UNIVERSE_REAPPLY",
        "Fallo simulado al reaplicar la segunda base."
      )
    },
    .package = "prosecnurapp"
  )
  err <- tryCatch(
    sm_multibase_sav_bundle_import(
      fixture$sid,
      bundle$zip_meta$file_id,
      file_base_map = bundle$file_base_map,
      expected_inspection_fingerprint = bundle$inspection$inspection_fingerprint
    ),
    error = function(e) e
  )
  after <- session_get(fixture$sid)

  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_TEST_SECOND_UNIVERSE_REAPPLY")
  expect_identical(calls$n, 2L)
  expect_identical(after, before)
  expect_identical(after$estudio$bases, before_bases)
  expect_identical(after$files, before_files)
  expect_identical(.sav_lineage_manifest(after$dir), before_manifest)
  expect_identical(.sav_lineage_downloads(after$dir), before_downloads)
})

test_that("dos importaciones SAV conservan historial compacto y round-trip", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("haven")
  skip_if_not_installed("zip")
  fixture <- .sav_lineage_fixture()
  on.exit(session_delete(fixture$sid), add = TRUE)

  first <- .sav_lineage_import(
    fixture$sid,
    data.frame(testreal = c("real", "test"), value = 501:502)
  )
  first_base <- session_get(fixture$sid)$estudio$bases$actor
  second <- .sav_lineage_import(
    fixture$sid,
    data.frame(testreal = c("real", "real"), value = 601:602)
  )
  second_base <- session_get(fixture$sid)$estudio$bases$actor
  history <- second_base$surveymonkey_sav_bundle_history

  expect_length(history, 1L)
  expect_identical(history[[1]]$bundle_file_id, first$result$file_id)
  expect_identical(
    history[[1]]$snapshot_file_id,
    first$result$results[[1]]$snapshot_file_id
  )
  expect_identical(history[[1]]$data_file_id, first$raw_data_file_id)
  expect_true(nzchar(history[[1]]$imported_at))
  expect_true(nzchar(history[[1]]$file_name))
  expect_true(nzchar(history[[1]]$instrument_revision_id))
  expect_false(identical(second$raw_data_file_id, first$raw_data_file_id))

  project_path <- tempfile(fileext = ".pulso")
  on.exit(unlink(project_path, force = TRUE), add = TRUE)
  build_pulso(fixture$sid, project_path, project_name = "SAV lineage round-trip")
  loaded <- load_pulso(project_path)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)$estudio$bases$actor

  expect_identical(restored$surveymonkey_sav_bundle_history, history)
  expect_identical(restored$data_file_id, second$raw_data_file_id)
})
