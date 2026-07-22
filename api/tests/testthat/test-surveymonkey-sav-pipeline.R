library(testthat)

.sav_pipeline_workbook <- function() {
  maps <- list(
    list(
      variable = "p1",
      type = "select_one",
      list_name = "decision",
      mappings = list(
        list(source_code = "10", xls_code = "1"),
        list(source_code = "0", xls_code = "14")
      )
    ),
    list(
      variable = "p2",
      type = "select_multiple",
      list_name = "temas",
      mappings = list(
        list(source_code = "1", xls_code = "a"),
        list(source_code = "2", xls_code = "b")
      )
    )
  )
  workbook <- list(
    survey = list(
      columns = list("type", "name", "label", "constraint", "constraint_message"),
      rows = list(
        list("select_one decision", "p1", "Decisión", "", ""),
        list("select_multiple temas", "p2", "Temas", "", ""),
        list("integer", "p3", "Edad", ". >= 18", "Debe ser mayor de edad")
      )
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list(
        list("decision", "1", "Sí"),
        list("decision", "14", "Otro"),
        list("temas", "a", "Tema A"),
        list("temas", "b", "Tema B")
      )
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list("Pipeline SAV", "pipeline_sav", "1", "es"))
    ),
    surveyMonkeyLogic = list(choice_code_maps = maps)
  )
  list(workbook = workbook, maps = maps)
}

.sav_pipeline_publish <- function(sid) {
  fixture <- .sav_pipeline_workbook()
  state <- list(
    workbook = fixture$workbook,
    source = list(
      schema = "survey_source/v1",
      kind = "surveymonkey",
      survey_id = "sm-pipeline-sav",
      logic_status = "pending_manual_confirmation",
      publication_guard = "Confirma los mapas del pipeline."
    ),
    hallazgos = list(),
    saved_at = "2026-07-22T00:00:00Z"
  )
  entry <- .xlsform_forms_as_entry(state, id = "pipeline-sav-form")
  session <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- session
  content_sha256 <- .xlsform_revision_hash(entry$workbook)
  xlsform_forms_confirm_logic(sid, entry$id, content_sha256)
  published <- xlsform_revision_publish(sid, entry$id, content_sha256)
  expect_true(published$created)
  expect_match(published$revision$choice_code_maps_sha256, "^[0-9a-f]{64}$")
  published$revision
}

.sav_pipeline_data_wrapper <- function(data) {
  raw <- as.data.frame(data, stringsAsFactors = FALSE, check.names = FALSE)
  clean <- janitor::make_clean_names(names(raw))
  list(
    raw = raw,
    clean = stats::setNames(raw, clean),
    name_map = tibble::tibble(clean = clean, original = names(raw))
  )
}

test_that("revisión publicada y SAV físico alimentan Validación, Analítica y Codificación", {
  skip_if_not_installed("haven")
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("zip")
  skip_if_not_installed("jsonlite")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  revision <- .sav_pipeline_publish(sid)
  revision_meta <- get_file(sid, revision$xlsform_file_id)
  inst <- reporte_instrumento(revision_meta$path)

  initial <- data.frame(p1 = "1", p2 = "a", p3 = 30L, stringsAsFactors = FALSE)
  initial_path <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(datos = initial), initial_path, overwrite = TRUE)
  initial_meta <- save_upload(
    sid,
    "data",
    "pipeline_inicial.xlsx",
    readBin(initial_path, "raw", n = file.info(initial_path)$size)
  )
  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    "actor",
    revision$xlsform_file_id,
    initial_meta$file_id,
    "xlsx",
    reporte_data(initial, instrumento = inst),
    inst,
    nrow(initial),
    ncol(initial),
    extra_meta = list(
      processing_mode = "independent_siblings",
      source_alias = "Actor",
      survey_id = "sm-pipeline-sav",
      original_xlsform_file_id = revision$xlsform_file_id,
      instrument_revision_id = revision$revision_id,
      instrument_revision_hash = revision$content_sha256
    )
  )

  raw <- data.frame(
    respondent_id = c("R-1", "R-2"),
    q0001 = haven::labelled(c(10, 0), labels = c("Sí" = 10, "Otro" = 0)),
    q0002_0001 = haven::labelled(c(1, 1), labels = c("Tema A" = 1)),
    q0002_0002 = haven::labelled(c(1, NA), labels = c("Tema B" = 1)),
    q0003 = c(17L, 25L),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  sav_dir <- tempfile("sav_pipeline_")
  dir.create(sav_dir, recursive = TRUE)
  on.exit(unlink(sav_dir, recursive = TRUE, force = TRUE), add = TRUE)
  sav_path <- file.path(sav_dir, "actor.sav")
  zip_path <- file.path(sav_dir, "actor.zip")
  haven::write_sav(raw, sav_path)
  old_dir <- setwd(sav_dir)
  on.exit(setwd(old_dir), add = TRUE)
  zip::zip(zipfile = zip_path, files = "actor.sav", include_directories = FALSE, mode = "mirror")
  setwd(old_dir)
  zip_meta <- save_upload(
    sid,
    "sav_bundle",
    "actor.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )
  inspection <- sm_multibase_sav_bundle_inspect(
    sid,
    zip_meta$file_id,
    file_base_map = list("actor.sav" = "actor")
  )

  expect_true(inspection$ok)
  expect_match(inspection$bundle_pin$sha256, "^[0-9a-f]{64}$")
  expect_identical(inspection$files[[1]]$instrument_revision$status, "pinned_healthy")
  imported <- sm_multibase_sav_bundle_import(
    sid,
    zip_meta$file_id,
    file_base_map = list("actor.sav" = "actor"),
    expected_inspection_fingerprint = inspection$inspection_fingerprint
  )
  imported_id <- imported$results[[1]]$data_file_id
  snapshot_id <- imported$results[[1]]$snapshot_file_id
  after <- session_get(sid)
  base <- after$estudio$bases$actor
  expect_identical(base$original_data_file_id, imported_id)
  expect_identical(base$instrument_revision_id, revision$revision_id)

  snapshot <- jsonlite::fromJSON(after$files[[snapshot_id]]$path, simplifyVector = FALSE)
  expect_identical(snapshot$audit$choice_code_maps$origin, "published_revision")
  expect_match(snapshot$audit$choice_code_maps$sha256, "^[0-9a-f]{64}$")
  expect_length(snapshot$audit$select_one_other_recodes, 1L)
  expect_identical(
    base$surveymonkey_sav_bundle_import$choice_code_maps$origin,
    "published_revision"
  )
  expect_identical(
    base$surveymonkey_sav_bundle_import$choice_code_maps$sha256,
    snapshot$audit$choice_code_maps$sha256
  )
  expect_identical(
    base$surveymonkey_sav_bundle_import$select_one_other_recodes,
    snapshot$audit$select_one_other_recodes
  )

  pair <- .analitica_pair_for_base(after, base, fuente = "originales", base_name = "actor")
  expect_identical(pair$data$file_id, imported_id)
  imported_frame <- readxl::read_excel(pair$data$path)
  expect_identical(as.character(imported_frame$p2), c("a b", "a"))
  parsed <- .analitica_read_pair(pair, base)
  expect_identical(as.character(parsed$data$p1), c("1", "14"))
  expect_true(any(grepl("^p2", tolower(names(parsed$data)))))

  validation_bundle <- build_validation_bundle(parsed$inst)
  validation <- evaluate_validation_bundle(validation_bundle, parsed$data, strict = FALSE)
  expect_equal(nrow(validation$datos), nrow(parsed$data))
  expect_true(any(validation$resumen$n_inconsistencias > 0L, na.rm = TRUE))

  codebook_path <- tempfile(fileext = ".xlsx")
  reporte_codebook(parsed$data, path_xlsx = codebook_path, ficha_tecnica = FALSE)
  expect_true(file.exists(codebook_path))
  codebook_text <- paste(
    as.character(unlist(openxlsx::read.xlsx(codebook_path), use.names = FALSE)),
    collapse = " "
  )
  expect_true(grepl("Decisión", codebook_text, fixed = TRUE))
  expect_true(grepl("Tema A", codebook_text, fixed = TRUE))

  codif_data <- .sav_pipeline_data_wrapper(parsed$data)
  families_path <- tempfile(fileext = ".xlsx")
  codif_path <- tempfile(fileext = ".xlsx")
  escribir_plantilla_familias(parsed$inst, codif_data, path = families_path)
  families <- leer_familias_clasificar(
    families_path,
    parsed$inst,
    codif_data,
    verbose = FALSE
  )
  plantilla <- construir_plantilla_desde_familias(parsed$inst, codif_data, families)
  exportar_plantilla_codificacion_xlsx(
    plantilla,
    path_xlsx = codif_path,
    inst = parsed$inst
  )
  expect_true(file.exists(codif_path))
  expect_gt(file.info(codif_path)$size, 0)
})
