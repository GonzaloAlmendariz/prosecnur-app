sm_sav_test_xlsx <- function(sheets) {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  for (sheet_name in names(sheets)) {
    openxlsx::addWorksheet(wb, sheet_name)
    openxlsx::writeData(wb, sheet_name, sheets[[sheet_name]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

sm_sav_test_inst <- function() {
  list(
    survey = data.frame(
      type = c(
        "select_one yesno",
        "integer",
        "text",
        "select_multiple estudios",
        "select_one escala",
        "text"
      ),
      name = c("p1", "p2", "p3", "p7", "p13", "p24_1"),
      list_name = c("yesno", NA, NA, "estudios", "escala", NA),
      label = c(
        "Acepta participar?",
        "Edad:",
        "Correo",
        "Estudios realizados",
        "Evalúe la utilidad",
        "Función 1:"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno", "estudios", "estudios", "escala", "escala"),
      name = c("1", "2", "bach", "maest", "1", "2"),
      label = c("Sí", "No", "Bachiller", "Maestría", "Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
}

sm_sav_test_zip <- function(files) {
  zip_path <- tempfile(fileext = ".zip")
  tmp_dir <- tempfile("sm_sav_zip_")
  dir.create(tmp_dir, recursive = TRUE)
  old <- setwd(tmp_dir)
  on.exit({
    setwd(old)
    unlink(tmp_dir, recursive = TRUE, force = TRUE)
  }, add = TRUE)
  rel_files <- character(0)
  for (nm in names(files)) {
    rel <- file.path("Bases finales", nm)
    dir.create(dirname(rel), recursive = TRUE, showWarnings = FALSE)
    haven::write_sav(files[[nm]], rel)
    rel_files <- c(rel_files, rel)
  }
  zip::zip(
    zipfile = zip_path,
    files = rel_files,
    include_directories = FALSE,
    mode = "mirror"
  )
  zip_path
}

sm_sav_test_raw <- function() {
  data.frame(
    respondent_id = c("R-1", "R-2"),
    collector_id = c("COL-A", "COL-A"),
    response_status = c("completed", "completed"),
    q0001 = haven::labelled(c(1, 2), labels = c("Sí" = 1, "No" = 2)),
    q0002 = c(31, 32),
    q0007_0001 = haven::labelled(c(1, NA), labels = c("Bachiller" = 1)),
    q0007_0002 = haven::labelled(c(NA, 1), labels = c("Maestría" = 1)),
    q0013_0001 = haven::labelled(c(2, 1), labels = c("Bajo" = 1, "Alto" = 2)),
    q0024_0001 = c("Rol A", "Rol B"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

sm_sav_test_choice_maps <- function(xmeta, raw = sm_sav_test_raw()) {
  inst <- reporte_instrumento(path = xmeta$path)
  normalized <- normalize_data_for_xlsform(raw, inst)
  maps <- (attr(normalized, "xlsform_normalized", exact = TRUE) %||% list())$choice_code_maps %||% list()
  unname(.dn_choice_code_maps_named(maps))
}

sm_sav_test_certify_base <- function(sid, name, xmeta, choice_code_maps = NULL) {
  if (is.null(choice_code_maps)) {
    choice_code_maps <- sm_sav_test_choice_maps(xmeta)
  }
  revision_hash <- .xlsform_revision_hash(
    .processing_intake_physical_workbook(xmeta$path)
  )
  revision_id <- paste0("revision-", name, "-", xmeta$file_id)
  revision <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = name,
    revision_no = 1L,
    content_sha256 = revision_hash,
    xlsform_file_id = xmeta$file_id,
    published_at = "2026-07-22T00:00:00Z",
    choice_code_maps = choice_code_maps,
    choice_code_maps_sha256 = .xlsform_editor_sm_hash(choice_code_maps)
  )
  state <- session_get(sid)
  state$instrument_revisions <- state$instrument_revisions %||% list()
  state$instrument_revisions[[revision_id]] <- revision
  base <- state$estudio$bases[[name]]
  base$original_xlsform_file_id <- base$original_xlsform_file_id %||% xmeta$file_id
  base$instrument_revision_id <- revision_id
  base$instrument_revision_hash <- revision_hash
  state$estudio$bases[[name]] <- base
  .session_env[[sid]] <- state
  revision
}

sm_sav_test_add_base <- function(sid, name, label, inst = sm_sav_test_inst(), extra_meta = list()) {
  xls_path <- sm_sav_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices,
    settings = data.frame(form_title = label, form_id = name)
  ))
  old_data <- data.frame(p1 = "2", p2 = 99, p3 = "old", stringsAsFactors = FALSE)
  old_data_path <- sm_sav_test_xlsx(list(datos = old_data))
  xmeta <- save_upload(
    sid, "xlsform", paste0(name, "_xlsform.xlsx"),
    readBin(xls_path, "raw", n = file.info(xls_path)$size)
  )
  dmeta <- save_upload(
    sid, "data", paste0(name, "_data.xlsx"),
    readBin(old_data_path, "raw", n = file.info(old_data_path)$size)
  )
  rp_inst <- reporte_instrumento(path = xmeta$path)
  rp_data <- reporte_data(old_data, instrumento = rp_inst)
  estudio_add_base(
    sid,
    name,
    xmeta$file_id,
    dmeta$file_id,
    "xlsx",
    rp_data,
    rp_inst,
    n_filas = nrow(old_data),
    n_columnas = ncol(old_data),
    extra_meta = utils::modifyList(list(
      processing_mode = "independent_siblings",
      source_alias = label,
      survey_id = name
    ), extra_meta)
  )
  if (!nzchar(as.character(extra_meta$instrument_revision_id %||% ""))) {
    sm_sav_test_certify_base(sid, name, xmeta)
  }
  list(xmeta = xmeta, dmeta = dmeta, rp_inst = rp_inst, rp_data = rp_data)
}

sm_sav_test_setup_one <- function(raw = sm_sav_test_raw()) {
  sid <- session_create()
  estudio_set_processing_mode(sid, "independent_siblings")
  sm_sav_test_add_base(sid, "ingenieria_industrial", "Ingeniería Industrial")
  zip_path <- sm_sav_test_zip(list("Revisión Industrial.sav" = raw))
  zip_meta <- save_upload(
    sid, "sav_bundle", "Bases finales.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )
  list(sid = sid, zip_meta = zip_meta)
}

sm_sav_test_single_meta <- function(sid, raw = sm_sav_test_raw(), name = "Revisión Industrial.sav") {
  path <- tempfile(fileext = ".sav")
  haven::write_sav(raw, path)
  save_upload(
    sid, "sav", name,
    readBin(path, "raw", n = file.info(path)$size)
  )
}

sm_sav_test_api_error <- function(expr) {
  tryCatch(expr, api_error = function(e) e)
}

sm_sav_test_file_manifest <- function(root) {
  paths <- sort(list.files(root, all.files = TRUE, recursive = TRUE, full.names = TRUE))
  files <- paths[file.info(paths)$isdir %in% FALSE]
  stats::setNames(lapply(files, function(path) list(
    size = as.numeric(file.info(path)$size),
    sha256 = tolower(digest::digest(file = path, algo = "sha256"))
  )), substring(files, nchar(root) + 2L))
}

sm_sav_expect_stale_unchanged <- function(sid, expr) {
  before <- session_get(sid)
  files_before <- sm_sav_test_file_manifest(before$dir)
  err <- sm_sav_test_api_error(force(expr))
  expect_s3_class(err, "api_error")
  expect_equal(err$status, 409)
  expect_equal(err$code, "E_SM_SAV_STALE")
  expect_identical(session_get(sid), before)
  expect_identical(sm_sav_test_file_manifest(before$dir), files_before)
  invisible(err)
}

test_that("ZIP SAV matchea nombres acentuados/problematicos a bases existentes", {
  base_names <- c(
    "ingenieria_civil",
    "ingenieria_electronica",
    "ingenieria_geologica",
    "ingenieria_industrial",
    "ingenieria_informatica",
    "ingenieria_mecanica",
    "ingenieria_mecatronica",
    "ingenieria_de_minas",
    "ingenieria_de_las_telecomunicaciones"
  )
  labels <- c(
    "Ingeniería Civil",
    "Ingeniería Electrónica",
    "Ingeniería Geológica",
    "Ingeniería Industrial",
    "Ingeniería Informática",
    "Ingeniería Mecánica",
    "Ingeniería Mecatrónica",
    "Ingeniería de Minas",
    "Ingeniería de las Telecomunicaciones"
  )
  bases <- stats::setNames(
    lapply(seq_along(base_names), function(i) list(nombre = base_names[[i]], source_alias = labels[[i]])),
    base_names
  )
  files <- c(
    "Bases finales/Revisión Civil.sav",
    "Bases finales/Revisión Electrónica.sav",
    "Bases finales/Revisión Geológica.sav",
    "Bases finales/Revisión Industrial.sav",
    "Bases finales/Revisión Informativa.sav",
    "Bases finales/Revisión Mecánica.sav",
    "Bases finales/Revisión Mecatrónica.sav",
    "Bases finales/Revisión Minas.sav",
    "Bases finales/Revisión Telecomunicaciones.sav"
  )

  mapped <- vapply(files, .sm_sav_match_entry_to_base, character(1), bases = bases, explicit_map = list())

  expect_equal(unname(mapped), base_names)
})

test_that("SAV individual usa la misma inspección certificada que un ZIP", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  base_fixture <- sm_sav_test_add_base(sid, "ingenieria_industrial", "Ingeniería Industrial")
  raw <- sm_sav_test_raw()
  raw$q0003 <- c("correo1@example.org", "correo2@example.org")
  sav_meta <- sm_sav_test_single_meta(sid, raw = raw)

  inspection <- sm_multibase_sav_bundle_inspect(
    sid,
    sav_meta$file_id,
    file_base_map = list("Revisión Industrial.sav" = "ingenieria_industrial"),
    missing_policy = "strict"
  )

  expect_true(inspection$ok)
  expect_equal(inspection$n_files, 1L)
  expect_equal(inspection$n_matched, 1L)
  expect_equal(inspection$files[[1]]$entry_name, "Revisión Industrial.sav")
  expect_equal(inspection$files[[1]]$instrument_revision$status, "pinned_healthy")
  expect_match(inspection$inspection_fingerprint, "^[a-f0-9]{64}$")

  imported <- sm_multibase_sav_bundle_import(
    sid,
    sav_meta$file_id,
    file_base_map = list("Revisión Industrial.sav" = "ingenieria_industrial"),
    missing_policy = "strict",
    expected_inspection_fingerprint = inspection$inspection_fingerprint
  )

  expect_true(imported$ok)
  expect_equal(imported$imported_bases, 1L)
  base <- session_get(sid)$estudio$bases$ingenieria_industrial
  expect_equal(base$xlsform_file_id, base_fixture$xmeta$file_id)
  expect_equal(base$n_filas, 2L)
  expect_equal(base$source_channel, "sav_offline")
  imported_data <- suppressWarnings(readxl::read_excel(get_file(sid, base$data_file_id)$path))
  expect_true(all(imported_data$source_channel == "sav_offline"))
})

test_that("ZIP SAV resuelve basenames repetidos por entry_name relativo completo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  sm_sav_test_add_base(sid, "ingenieria_civil", "Ingeniería Civil")
  sm_sav_test_add_base(sid, "ingenieria_industrial", "Ingeniería Industrial")
  entries <- c(
    "Bases finales/civil/Export.sav",
    "Bases finales/industrial/Export.sav"
  )
  zip_path <- sm_sav_test_zip(list(
    "civil/Export.sav" = sm_sav_test_raw(),
    "industrial/Export.sav" = sm_sav_test_raw()
  ))
  zip_meta <- save_upload(
    sid, "sav_bundle", "Bases finales.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )
  file_base_map <- stats::setNames(
    list("ingenieria_civil", "ingenieria_industrial"),
    entries
  )

  inspection <- sm_multibase_sav_bundle_inspect(
    sid,
    zip_meta$file_id,
    file_base_map = file_base_map
  )

  expect_true(inspection$ok)
  expect_equal(names(inspection$resolved_file_base_map), entries)
  expect_equal(
    unname(unlist(inspection$resolved_file_base_map, use.names = FALSE)),
    c("ingenieria_civil", "ingenieria_industrial")
  )
  expect_match(inspection$inspection_fingerprint, "^[a-f0-9]{64}$")
  expect_match(inspection$bundle_pin$sha256, "^[a-f0-9]{64}$")
  expect_true(inspection$files[[1]]$pins$xlsform$healthy)
  expect_equal(
    sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id, file_base_map)$inspection_fingerprint,
    inspection$inspection_fingerprint
  )

  changed_map <- stats::setNames(rev(unname(file_base_map)), names(file_base_map))
  sm_sav_expect_stale_unchanged(
    sid,
    sm_multibase_sav_bundle_import(
      sid,
      zip_meta$file_id,
      file_base_map = changed_map,
      expected_inspection_fingerprint = inspection$inspection_fingerprint
    )
  )
})

test_that("ZIP SAV rechaza políticas missing desconocidas con error 400 específico", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  sm_sav_test_add_base(sid, "ingenieria_industrial", "Ingeniería Industrial")
  zip_path <- sm_sav_test_zip(list("Revisión Industrial.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(
    sid, "sav_bundle", "Bases finales.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )

  err <- sm_sav_test_api_error(sm_multibase_sav_bundle_inspect(
    sid,
    zip_meta$file_id,
    missing_policy = "rellenar_si_conviene"
  ))

  expect_equal(err$status, 400)
  expect_equal(err$code, "E_SM_SAV_MISSING_POLICY")
})

test_that("SAV SurveyMonkey normaliza metadata, select_multiple, matrices y faltantes", {
  inst <- sm_sav_test_inst()
  converted <- .sm_sav_convert_entry_data(
    sm_sav_test_raw(),
    inst,
    base_name = "ingenieria_industrial",
    base_meta = list(survey_id = "527", source_alias = "Ingeniería Industrial"),
    entry_name = "Bases finales/Revisión Industrial.sav"
  )
  out <- converted$data
  audit <- converted$audit

  expect_equal(nrow(out), 2L)
  expect_equal(out$response_id, c("R-1", "R-2"))
  expect_equal(out$collector_id, c("COL-A", "COL-A"))
  expect_equal(as.numeric(out$p1), c(1, 2))
  expect_equal(as.character(out$p7), c("bach", "maest"))
  expect_equal(as.character(out$p13), c("2", "1"))
  expect_equal(out$p24_1, c("Rol A", "Rol B"))
  expect_true("p3" %in% names(out))
  expect_true("p3" %in% unlist(audit$missing_variables, use.names = FALSE))
  expect_false("p3" %in% unlist(audit$all_empty_variables, use.names = FALSE))
  expect_equal(audit$matched_variables, 5L)
  expect_true(audit$compatibility$ok)
  expect_true(any(grepl("se completaron vacías", unlist(audit$warnings, use.names = FALSE), fixed = TRUE)))
})

test_that("SAV físico publica revisión variable privada y la sella en fingerprint v2", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- list(
    survey = data.frame(
      type = c(
        "select_one satisfaccion", "select_one consentimiento", "text",
        "select_multiple estudios", "integer", "text", "text"
      ),
      name = c("p1", "p2", "p2_other", "p7", "p17", "p24_1", "p_missing"),
      list_name = c("satisfaccion", "consentimiento", NA, "estudios", NA, NA, NA),
      label = c(
        "Satisfacción", "Consentimiento", "Especifique otro",
        "Estudios", "Edad", "Función", "Variable faltante"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(
        "satisfaccion", "satisfaccion", "consentimiento", "consentimiento",
        "estudios", "estudios"
      ),
      name = c("10", "20", "1", "9", "bach", "maest"),
      label = c("Bueno", "Malo", "Sí", "Otro", "Bachiller", "Maestría"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    respondent_id = c("RID-SECRET-1", "RID-SECRET-2"),
    ip_address = c("10.0.0.1", "10.0.0.2"),
    q0001 = haven::labelled(c(2, 3), labels = c("Bueno" = 2, "Malo" = 3)),
    q0002 = c(0, 1),
    q0002_other = c("detalle confidencial", NA),
    q0007_0001 = haven::labelled(c(1, NA), labels = c("Bachiller" = 1)),
    q0007_0002 = haven::labelled(c(NA, 1), labels = c("Maestría" = 1)),
    q0017_0001 = c(41, 42),
    q0024_0001 = c("Rol privado A", "Rol privado B"),
    extra_note = c("texto-muy-privado", "otro-texto-privado"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  base_fixture <- sm_sav_test_add_base(
    sid,
    "ingenieria_industrial",
    "Ingeniería Industrial",
    inst = inst
  )
  sealed_maps <- sm_sav_test_choice_maps(base_fixture$xmeta, raw = raw)
  sm_sav_test_certify_base(
    sid,
    "ingenieria_industrial",
    base_fixture$xmeta,
    choice_code_maps = sealed_maps
  )
  sav_meta <- sm_sav_test_single_meta(sid, raw = raw, name = "Contrato Visual.sav")
  file_map <- list("Contrato Visual.sav" = "ingenieria_industrial")

  inspection <- sm_multibase_sav_bundle_inspect(sid, sav_meta$file_id, file_map)
  repeated <- sm_multibase_sav_bundle_inspect(sid, sav_meta$file_id, file_map)
  review <- inspection$files[[1]]$normalization_review
  by_variable <- stats::setNames(
    review$variables,
    vapply(review$variables, function(item) item$variable, character(1))
  )

  expect_true(inspection$ok)
  expect_identical(inspection$fingerprint_schema, "surveymonkey_sav_bundle_inspection/v2")
  expect_identical(review$schema, "surveymonkey_sav_variable_review/v1")
  expect_identical(review$normalizer_contract, "normalize_data_for_xlsform/v1")
  expect_match(review$fingerprint, "^[a-f0-9]{64}$")
  expect_identical(repeated$files[[1]]$normalization_review$fingerprint, review$fingerprint)
  expect_identical(repeated$inspection_fingerprint, inspection$inspection_fingerprint)

  expect_equal(unlist(by_variable$p1$source_columns), "q0001")
  expect_true(all(c("rename_source", "recode_choice_map") %in% unlist(by_variable$p1$operations)))
  expect_equal(unlist(by_variable$p2$source_columns), "q0002")
  expect_true(all(c("rename_source", "recode_other_zero") %in% unlist(by_variable$p2$operations)))
  expect_equal(
    unlist(by_variable$p7$source_columns),
    c("q0007_0001", "q0007_0002")
  )
  expect_true(all(c(
    "rename_source", "recode_choice_map", "rebuild_select_multiple",
    "drop_source_dummies"
  ) %in% unlist(by_variable$p7$operations)))
  expect_equal(unlist(by_variable$p17$source_columns), "q0017_0001")
  expect_true(all(c("rename_source", "collapse_single_child") %in% unlist(by_variable$p17$operations)))
  expect_identical(by_variable$p_missing$status, "warning")
  expect_identical(unlist(by_variable$p_missing$operations), "fill_blank")
  expect_identical(by_variable$respondent_id$status, "source_only")
  expect_identical(unlist(by_variable$respondent_id$operations), "preserve_metadata")
  expect_identical(unlist(by_variable$ip_address$operations), "preserve_metadata")
  expect_identical(unlist(by_variable$extra_note$operations), "preserve_extra")

  expect_equal(
    vapply(by_variable$p1$catalog$choices, function(item) item$name, character(1)),
    c("10", "20")
  )
  expect_equal(
    vapply(by_variable$p1$catalog$mappings, function(item) item$source_code, character(1)),
    c("2", "3")
  )
  expect_equal(
    vapply(by_variable$p1$catalog$mappings, function(item) item$xls_code, character(1)),
    c("10", "20")
  )
  expect_false(review$privacy$response_values_included)
  expect_false(review$privacy$direct_identifier_values_included)
  expect_false(review$privacy$free_text_values_included)
  expect_true(all(c(
    "missing_expected_columns", "preserved_metadata_columns", "preserved_extra_columns"
  ) %in% vapply(review$alerts, function(item) item$code, character(1))))
  expect_equal(review$summary$expected_variables, 7L)
  expect_equal(review$summary$source_only_variables, 3L)

  review_json <- jsonlite::toJSON(review, auto_unbox = TRUE, null = "null")
  for (secret in c(
    "RID-SECRET-1", "10.0.0.1", "detalle confidencial", "Rol privado A",
    "texto-muy-privado"
  )) {
    expect_false(grepl(secret, review_json, fixed = TRUE))
  }

  sealed_change <- inspection
  sealed_change$files[[1]]$normalization_review$fingerprint <- paste(rep("0", 64L), collapse = "")
  expect_false(identical(
    .sm_sav_inspection_fingerprint(sealed_change),
    inspection$inspection_fingerprint
  ))

  changed_raw <- raw
  changed_raw$extra_schema_v2 <- c("valor secreto 1", "valor secreto 2")
  changed_meta <- sm_sav_test_single_meta(sid, raw = changed_raw, name = "Contrato Visual v2.sav")
  changed <- sm_multibase_sav_bundle_inspect(
    sid,
    changed_meta$file_id,
    list("Contrato Visual v2.sav" = "ingenieria_industrial")
  )
  expect_false(identical(
    changed$files[[1]]$normalization_review$fingerprint,
    review$fingerprint
  ))
  expect_false(identical(changed$inspection_fingerprint, inspection$inspection_fingerprint))

  expect_true(file.copy(changed_meta$path, sav_meta$path, overwrite = TRUE))
  sm_sav_expect_stale_unchanged(
    sid,
    sm_multibase_sav_bundle_import(
      sid,
      sav_meta$file_id,
      file_base_map = file_map,
      expected_inspection_fingerprint = inspection$inspection_fingerprint
    )
  )
})

test_that("SAV ofrece política estricta sin acreditar faltantes rellenados como match", {
  expect_error(
    .sm_sav_convert_entry_data(
      sm_sav_test_raw(),
      sm_sav_test_inst(),
      base_name = "ingenieria_industrial",
      base_meta = list(survey_id = "527"),
      entry_name = "Revisión Industrial.sav",
      missing_policy = "strict"
    ),
    class = "api_error"
  )
})

test_that("ZIP SAV inspecciona sin mutar e importa reemplazando data y preservando XLSForm", {
  sid <- session_create()
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- sm_sav_test_inst()
  xls_path <- sm_sav_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices,
    settings = data.frame(form_title = "Industrial", form_id = "industrial")
  ))
  old_data <- data.frame(p1 = "2", p2 = 99, p3 = "old", stringsAsFactors = FALSE)
  old_data_path <- sm_sav_test_xlsx(list(datos = old_data))
  xmeta <- save_upload(sid, "xlsform", "industrial_xlsform.xlsx", readBin(xls_path, "raw", n = file.info(xls_path)$size))
  dmeta <- save_upload(sid, "data", "industrial_data.xlsx", readBin(old_data_path, "raw", n = file.info(old_data_path)$size))
  rp_inst <- reporte_instrumento(path = xmeta$path)
  rp_data <- reporte_data(old_data, instrumento = rp_inst)
  estudio_add_base(
    sid,
    "ingenieria_industrial",
    xmeta$file_id,
    dmeta$file_id,
    "xlsx",
    rp_data,
    rp_inst,
    n_filas = nrow(old_data),
    n_columnas = ncol(old_data),
    extra_meta = list(
      processing_mode = "independent_siblings",
      source_alias = "Ingeniería Industrial",
      survey_id = "527"
    )
  )
  sm_sav_test_certify_base(sid, "ingenieria_industrial", xmeta)

  zip_path <- sm_sav_test_zip(list("Revisión Industrial.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(sid, "sav_bundle", "Bases finales.zip", readBin(zip_path, "raw", n = file.info(zip_path)$size))
  before <- session_get(sid)$estudio$bases$ingenieria_industrial
  inspection <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  after_inspection <- session_get(sid)$estudio$bases$ingenieria_industrial

  expect_true(inspection$ok)
  expect_equal(inspection$n_files, 1L)
  expect_equal(inspection$n_matched, 1L)
  expect_equal(inspection$files[[1]]$action, "replace_data")
  expect_equal(inspection$files[[1]]$change_plan$effects$xlsform, "preserved")
  expect_equal(inspection$files[[1]]$change_plan$effects$data, "replaced")
  expect_equal(inspection$files[[1]]$instrument_revision$status, "pinned_healthy")
  expect_true(inspection$files[[1]]$instrument_revision$certifiable)
  expect_equal(after_inspection$data_file_id, before$data_file_id)

  imported <- sm_multibase_sav_bundle_import(
    sid,
    zip_meta$file_id,
    expected_inspection_fingerprint = inspection$inspection_fingerprint
  )
  expect_true(imported$ok)
  expect_equal(imported$imported_bases, 1L)

  s <- session_get(sid)
  base <- s$estudio$bases$ingenieria_industrial
  expect_equal(base$source_kind, "surveymonkey_sav_bundle")
  expect_equal(base$xlsform_file_id, xmeta$file_id)
  expect_equal(base$surveymonkey_sav_bundle_file_id, zip_meta$file_id)
  expect_true(nzchar(base$surveymonkey_sav_bundle_snapshot_file_id))
  expect_true(nzchar(base$surveymonkey_effective_data_file_id))
  expect_false(identical(base$data_file_id, dmeta$file_id))
  expect_equal(base$n_filas, 2L)

  imported_df <- as.data.frame(.read_data_any_path(get_file(sid, base$data_file_id)$path, "xlsx"))
  expect_equal(as.character(imported_df$p7), c("bach", "maest"))
  expect_equal(as.character(imported_df$p24_1), c("Rol A", "Rol B"))

  tmp <- tempfile(fileext = ".pulso")
  build_pulso(sid, tmp, project_name = "SAV Bundle Offline")
  loaded <- load_pulso(tmp)
  loaded_base <- session_get(loaded$session_id)$estudio$bases$ingenieria_industrial
  expect_equal(loaded_base$source_kind, "surveymonkey_sav_bundle")
  expect_true(nzchar(loaded_base$surveymonkey_sav_bundle_snapshot_file_id))
  expect_equal(loaded_base$xlsform_file_id, xmeta$file_id)
})

test_that("ZIP SAV exige fingerprint y queda stale ante cambios de base, revisión, policy, ZIP o plan", {
  absent <- sm_sav_test_setup_one()
  on.exit(session_delete(absent$sid), add = TRUE)
  sm_sav_expect_stale_unchanged(
    absent$sid,
    sm_multibase_sav_bundle_import(absent$sid, absent$zip_meta$file_id)
  )

  plan <- sm_sav_test_setup_one()
  on.exit(session_delete(plan$sid), add = TRUE)
  plan_inspection <- sm_multibase_sav_bundle_inspect(plan$sid, plan$zip_meta$file_id)
  s_plan <- session_get(plan$sid)
  s_plan$estudio$bases$ingenieria_industrial$n_filas <- 99L
  .session_env[[plan$sid]] <- s_plan
  sm_sav_expect_stale_unchanged(
    plan$sid,
    sm_multibase_sav_bundle_import(
      plan$sid,
      plan$zip_meta$file_id,
      expected_inspection_fingerprint = plan_inspection$inspection_fingerprint
    )
  )

  base <- sm_sav_test_setup_one()
  on.exit(session_delete(base$sid), add = TRUE)
  base_inspection <- sm_multibase_sav_bundle_inspect(base$sid, base$zip_meta$file_id)
  s_base <- session_get(base$sid)
  s_base$estudio$bases$ingenieria_industrial$source_alias <- "Industrial renombrada"
  .session_env[[base$sid]] <- s_base
  sm_sav_expect_stale_unchanged(
    base$sid,
    sm_multibase_sav_bundle_import(
      base$sid,
      base$zip_meta$file_id,
      expected_inspection_fingerprint = base_inspection$inspection_fingerprint
    )
  )

  revision <- sm_sav_test_setup_one()
  on.exit(session_delete(revision$sid), add = TRUE)
  revision_inspection <- sm_multibase_sav_bundle_inspect(revision$sid, revision$zip_meta$file_id)
  s_revision <- session_get(revision$sid)
  s_revision$estudio$bases$ingenieria_industrial$instrument_revision_id <- "revision-cambiada"
  .session_env[[revision$sid]] <- s_revision
  sm_sav_expect_stale_unchanged(
    revision$sid,
    sm_multibase_sav_bundle_import(
      revision$sid,
      revision$zip_meta$file_id,
      expected_inspection_fingerprint = revision_inspection$inspection_fingerprint
    )
  )

  xlsform <- sm_sav_test_setup_one()
  on.exit(session_delete(xlsform$sid), add = TRUE)
  xlsform_inspection <- sm_multibase_sav_bundle_inspect(xlsform$sid, xlsform$zip_meta$file_id)
  xlsform_state <- session_get(xlsform$sid)
  xlsform_id <- xlsform_state$estudio$bases$ingenieria_industrial$xlsform_file_id
  changed_xlsform <- sm_sav_test_xlsx(list(
    survey = sm_sav_test_inst()$survey,
    choices = sm_sav_test_inst()$choices,
    settings = data.frame(form_title = "Industrial cambiada", form_id = "ingenieria_industrial")
  ))
  expect_true(file.copy(
    changed_xlsform,
    xlsform_state$files[[xlsform_id]]$path,
    overwrite = TRUE
  ))
  sm_sav_expect_stale_unchanged(
    xlsform$sid,
    sm_multibase_sav_bundle_import(
      xlsform$sid,
      xlsform$zip_meta$file_id,
      expected_inspection_fingerprint = xlsform_inspection$inspection_fingerprint
    )
  )

  complete_raw <- sm_sav_test_raw()
  complete_raw$q0003 <- c("uno@example.org", "dos@example.org")
  policy <- sm_sav_test_setup_one(complete_raw)
  on.exit(session_delete(policy$sid), add = TRUE)
  policy_inspection <- sm_multibase_sav_bundle_inspect(policy$sid, policy$zip_meta$file_id)
  sm_sav_expect_stale_unchanged(
    policy$sid,
    sm_multibase_sav_bundle_import(
      policy$sid,
      policy$zip_meta$file_id,
      missing_policy = "strict",
      expected_inspection_fingerprint = policy_inspection$inspection_fingerprint
    )
  )

  bundle <- sm_sav_test_setup_one()
  on.exit(session_delete(bundle$sid), add = TRUE)
  bundle_inspection <- sm_multibase_sav_bundle_inspect(bundle$sid, bundle$zip_meta$file_id)
  changed_raw <- sm_sav_test_raw()
  changed_raw$q0002 <- c(41, 42)
  changed_zip <- sm_sav_test_zip(list("Revisión Industrial.sav" = changed_raw))
  expect_true(file.copy(changed_zip, bundle$zip_meta$path, overwrite = TRUE))
  sm_sav_expect_stale_unchanged(
    bundle$sid,
    sm_multibase_sav_bundle_import(
      bundle$sid,
      bundle$zip_meta$file_id,
      expected_inspection_fingerprint = bundle_inspection$inspection_fingerprint
    )
  )
})

test_that("ZIP SAV bloquea archivos sin base durante inspeccion", {
  sid <- session_create()
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- sm_sav_test_inst()
  xls_path <- sm_sav_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices
  ))
  old_data <- data.frame(p1 = "1", stringsAsFactors = FALSE)
  old_data_path <- sm_sav_test_xlsx(list(datos = old_data))
  xmeta <- save_upload(sid, "xlsform", "civil_xlsform.xlsx", readBin(xls_path, "raw", n = file.info(xls_path)$size))
  dmeta <- save_upload(sid, "data", "civil_data.xlsx", readBin(old_data_path, "raw", n = file.info(old_data_path)$size))
  rp_inst <- reporte_instrumento(path = xmeta$path)
  rp_data <- reporte_data(old_data, instrumento = rp_inst)
  estudio_add_base(
    sid,
    "ingenieria_civil",
    xmeta$file_id,
    dmeta$file_id,
    "xlsx",
    rp_data,
    rp_inst,
    n_filas = nrow(old_data),
    n_columnas = ncol(old_data),
    extra_meta = list(processing_mode = "independent_siblings", source_alias = "Ingeniería Civil")
  )

  zip_path <- sm_sav_test_zip(list("Revisión Fantasma.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(sid, "sav_bundle", "Bases finales.zip", readBin(zip_path, "raw", n = file.info(zip_path)$size))
  inspection <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)

  expect_false(inspection$ok)
  expect_equal(inspection$n_blocking, 1L)
  expect_true(grepl("no coincide", unlist(inspection$warnings, use.names = FALSE)[1], fixed = TRUE))
})

test_that("ZIP SAV publica dos bases de forma atómica y limpia artefactos si falla la segunda", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  sm_sav_test_add_base(sid, "ingenieria_civil", "Ingeniería Civil")
  sm_sav_test_add_base(sid, "ingenieria_industrial", "Ingeniería Industrial")

  zip_path <- sm_sav_test_zip(list(
    "Revisión Civil.sav" = sm_sav_test_raw(),
    "Revisión Industrial.sav" = sm_sav_test_raw()
  ))
  zip_meta <- save_upload(
    sid, "sav_bundle", "Bases finales.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )
  inspection <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  before <- session_get(sid)
  files_before <- sort(list.files(before$dir, all.files = TRUE, recursive = TRUE, full.names = TRUE))
  moves <- 0L
  testthat::local_mocked_bindings(
    .sm_sav_commit_artifact = function(staged_path, final_path) {
      moves <<- moves + 1L
      if (moves == 3L) {
        stop_api(500, "E_SM_SAV_TEST_SECOND_FILE", "Fallo inducido antes del commit de sesión.")
      }
      if (!file.rename(staged_path, final_path)) stop("No se pudo mover fixture staged.")
      invisible(TRUE)
    },
    .package = "prosecnurapp"
  )

  expect_error(
    sm_multibase_sav_bundle_import(
      sid,
      zip_meta$file_id,
      expected_inspection_fingerprint = inspection$inspection_fingerprint
    ),
    class = "api_error"
  )
  expect_identical(session_get(sid), before)
  expect_identical(
    sort(list.files(before$dir, all.files = TRUE, recursive = TRUE, full.names = TRUE)),
    files_before
  )
})

test_that("ZIP SAV bloquea XLSForm o hash distintos de la revisión publicada", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  inst <- sm_sav_test_inst()
  published_path <- sm_sav_test_xlsx(list(
    survey = inst$survey,
    choices = inst$choices,
    settings = data.frame(form_title = "Industrial", form_id = "industrial")
  ))
  published_meta <- save_upload(
    sid, "xlsform", "industrial_publicado.xlsx",
    readBin(published_path, "raw", n = file.info(published_path)$size)
  )
  published_hash <- .xlsform_revision_hash(.processing_intake_physical_workbook(published_meta$path))
  revision_id <- "revision-industrial-publicada"
  revision <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = "industrial",
    revision_no = 1L,
    content_sha256 = published_hash,
    xlsform_file_id = published_meta$file_id,
    published_at = "2026-07-21T00:00:00Z"
  )
  revision$choice_code_maps <- sm_sav_test_choice_maps(published_meta)
  revision$choice_code_maps_sha256 <- .xlsform_editor_sm_hash(revision$choice_code_maps)
  session_set(sid, "instrument_revisions", stats::setNames(list(revision), revision_id))
  base_setup <- sm_sav_test_add_base(
    sid,
    "ingenieria_industrial",
    "Ingeniería Industrial",
    inst = inst,
    extra_meta = list(
      instrument_revision_id = revision_id,
      instrument_revision_hash = published_hash
    )
  )
  zip_path <- sm_sav_test_zip(list("Revisión Industrial.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(
    sid, "sav_bundle", "Bases finales.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )

  mismatch_file <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_false(mismatch_file$ok)
  expect_equal(mismatch_file$files[[1]]$instrument_revision$status, "blocked")
  expect_true(any(grepl("xlsform_file_id", unlist(mismatch_file$warnings), fixed = TRUE)))

  s <- session_get(sid)
  s$estudio$bases$ingenieria_industrial$xlsform_file_id <- published_meta$file_id
  s$estudio$bases$ingenieria_industrial$instrument_revision_hash <- paste(rep("0", 64L), collapse = "")
  s$rp_inst_sources$ingenieria_industrial <- reporte_instrumento(path = published_meta$path)
  .session_env[[sid]] <- s
  mismatch_hash <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_false(mismatch_hash$ok)
  expect_true(any(grepl("instrument_revision_hash", unlist(mismatch_hash$warnings), fixed = TRUE)))

  s <- session_get(sid)
  s$estudio$bases$ingenieria_industrial$instrument_revision_hash <- published_hash
  .session_env[[sid]] <- s
  healthy <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_true(healthy$ok)
  expect_equal(healthy$files[[1]]$instrument_revision$status, "pinned_healthy")
  expect_false(identical(base_setup$xmeta$file_id, published_meta$file_id))

  s <- session_get(sid)
  s$files[[published_meta$file_id]]$kind <- "data"
  .session_env[[sid]] <- s
  unhealthy <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_false(unhealthy$ok)
  expect_false(unhealthy$files[[1]]$instrument_revision$healthy)
  expect_true(any(grepl("no es un XLSForm", unlist(unhealthy$warnings), fixed = TRUE)))
})

test_that("ZIP SAV acredita el snapshot original cuando el XLSForm operativo es derivado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  published_inst <- sm_sav_test_inst()
  published_path <- sm_sav_test_xlsx(list(
    survey = published_inst$survey,
    choices = published_inst$choices,
    settings = data.frame(form_title = "Industrial publicada", form_id = "industrial")
  ))
  published_meta <- save_upload(
    sid, "xlsform", "industrial_publicada.xlsx",
    readBin(published_path, "raw", n = file.info(published_path)$size)
  )
  published_hash <- .xlsform_revision_hash(.processing_intake_physical_workbook(published_meta$path))
  revision_id <- "revision-industrial-materializada"
  revision <- list(
    schema = "instrument_revision/v1",
    revision_id = revision_id,
    form_id = "industrial",
    revision_no = 1L,
    content_sha256 = published_hash,
    xlsform_file_id = published_meta$file_id,
    published_at = "2026-07-21T00:00:00Z"
  )
  revision$choice_code_maps <- sm_sav_test_choice_maps(published_meta)
  revision$choice_code_maps_sha256 <- .xlsform_editor_sm_hash(revision$choice_code_maps)
  session_set(sid, "instrument_revisions", stats::setNames(list(revision), revision_id))
  derived_inst <- published_inst
  derived_inst$survey <- rbind(
    derived_inst$survey,
    data.frame(
      type = "text",
      name = "p_operativa",
      list_name = NA_character_,
      label = "Variable derivada",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  derived <- sm_sav_test_add_base(
    sid,
    "ingenieria_industrial",
    "Ingeniería Industrial",
    inst = derived_inst,
    extra_meta = list(
      original_xlsform_file_id = published_meta$file_id,
      instrument_revision_id = revision_id,
      instrument_revision_hash = published_hash
    )
  )
  zip_path <- sm_sav_test_zip(list("Revisión Industrial.sav" = sm_sav_test_raw()))
  zip_meta <- save_upload(
    sid, "sav_bundle", "Bases finales.zip",
    readBin(zip_path, "raw", n = file.info(zip_path)$size)
  )

  inspection <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)

  expect_true(inspection$ok)
  expect_equal(inspection$files[[1]]$expected_variables, nrow(published_inst$survey))
  expect_equal(
    inspection$files[[1]]$instrument_revision$base_current_xlsform_file_id,
    derived$xmeta$file_id
  )
  expect_equal(
    inspection$files[[1]]$instrument_revision$base_original_xlsform_file_id,
    published_meta$file_id
  )
  expect_equal(inspection$files[[1]]$pins$xlsform_current$file_id, derived$xmeta$file_id)
  expect_equal(inspection$files[[1]]$pins$xlsform_original$file_id, published_meta$file_id)

  changed_current_state <- session_get(sid)
  changed_current_state$estudio$bases$ingenieria_industrial$xlsform_file_id <- published_meta$file_id
  .session_env[[sid]] <- changed_current_state
  changed_current <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_true(changed_current$ok)
  expect_false(identical(changed_current$inspection_fingerprint, inspection$inspection_fingerprint))

  restored_state <- session_get(sid)
  restored_state$estudio$bases$ingenieria_industrial$xlsform_file_id <- derived$xmeta$file_id
  restored_state$estudio$bases$ingenieria_industrial$original_xlsform_file_id <- derived$xmeta$file_id
  .session_env[[sid]] <- restored_state
  changed_original <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_false(changed_original$ok)
  expect_false(identical(changed_original$inspection_fingerprint, inspection$inspection_fingerprint))

  restored_state$estudio$bases$ingenieria_industrial$original_xlsform_file_id <- published_meta$file_id
  .session_env[[sid]] <- restored_state
  restored <- sm_multibase_sav_bundle_inspect(sid, zip_meta$file_id)
  expect_equal(restored$inspection_fingerprint, inspection$inspection_fingerprint)

  imported <- sm_multibase_sav_bundle_import(
    sid,
    zip_meta$file_id,
    expected_inspection_fingerprint = inspection$inspection_fingerprint
  )
  expect_true(imported$ok)
  expect_equal(
    session_get(sid)$estudio$bases$ingenieria_industrial$xlsform_file_id,
    derived$xmeta$file_id
  )
})

test_that("ZIP SAV exige revisión publicada en hermanas y marca legacy no certificable", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_set_processing_mode(sid, "independent_siblings")
  sm_sav_test_add_base(sid, "ingenieria_industrial", "Ingeniería Industrial")
  state <- session_get(sid)
  state$estudio$bases$ingenieria_industrial$instrument_revision_id <- NULL
  state$estudio$bases$ingenieria_industrial$instrument_revision_hash <- NULL
  .session_env[[sid]] <- state

  sibling_context <- .sm_sav_instrument_context(session_get(sid), "ingenieria_industrial")
  expect_false(sibling_context$ok)
  expect_identical(sibling_context$audit$status, "blocked")
  expect_false(sibling_context$audit$certifiable)
  expect_true("instrument_revision_id_missing" %in% unlist(sibling_context$audit$reasons))

  estudio_set_processing_mode(sid, "multibase")
  legacy_context <- .sm_sav_instrument_context(session_get(sid), "ingenieria_industrial")
  expect_true(legacy_context$ok)
  expect_identical(legacy_context$audit$status, "legacy_unpinned")
  expect_false(legacy_context$audit$certifiable)
})
