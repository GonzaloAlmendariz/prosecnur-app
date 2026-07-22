library(testthat)

.sav_choice_maps_fixture <- function() {
  maps <- list(list(
    variable = "p1",
    type = "select_one",
    list_name = "yesno",
    mappings = list(
      list(source_code = "C1", xls_code = "2"),
      list(source_code = "C2", xls_code = "1")
    )
  ))
  workbook <- list(
    survey = list(
      columns = list("type", "name", "label"),
      rows = list(list("select_one yesno", "p1", "Acepta participar"))
    ),
    choices = list(
      columns = list("list_name", "name", "label"),
      rows = list(
        list("yesno", "1", "Sí"),
        list("yesno", "2", "No")
      )
    ),
    settings = list(
      columns = list("form_title", "form_id", "version", "default_language"),
      rows = list(list("Instrumento SAV", "instrumento_sav", "1", "es"))
    ),
    surveyMonkeyLogic = list(choice_code_maps = maps)
  )
  list(workbook = workbook, maps = maps)
}

.sav_choice_maps_entry <- function(fixture, form_id = "form-sav-maps") {
  state <- list(
    workbook = fixture$workbook,
    source = list(
      schema = "survey_source/v1",
      kind = "surveymonkey",
      survey_id = "sm-sav-maps",
      logic_status = "pending_manual_confirmation",
      publication_guard = "Revisa los mapas antes de publicar."
    ),
    hallazgos = list(),
    saved_at = "2026-07-22T00:00:00Z"
  )
  .xlsform_forms_as_entry(state, id = form_id)
}

.sav_choice_maps_from_revision <- function(revision) {
  revision$choice_code_maps %||%
    (revision$logic_audit %||% list())$choice_code_maps %||%
    (revision$source %||% list())$choice_code_maps %||%
    list()
}

.sav_choice_maps_hash <- function(value) {
  value$choice_code_maps_sha256 %||%
    value$maps_sha256 %||%
    (value$logic_review %||% list())$choice_code_maps_sha256 %||%
    (value$logic_review %||% list())$maps_sha256 %||%
    (value$logic_audit %||% list())$choice_code_maps_sha256 %||%
    (value$logic_audit %||% list())$maps_sha256 %||%
    ""
}

test_that("confirmar y publicar sella los choice_code_maps del Editor", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fixture <- .sav_choice_maps_fixture()
  entry <- .sav_choice_maps_entry(fixture)
  state <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- state

  content_sha256 <- .xlsform_revision_hash(entry$workbook)
  confirmed <- xlsform_forms_confirm_logic(sid, entry$id, content_sha256)
  published <- xlsform_revision_publish(sid, entry$id, content_sha256)
  confirmed_maps_hash <- .sav_choice_maps_hash(confirmed$source)
  revision_maps_hash <- .sav_choice_maps_hash(published$revision)

  expect_match(confirmed_maps_hash, "^[0-9a-f]{64}$")
  expect_identical(
    confirmed_maps_hash,
    .xlsform_editor_sm_hash(fixture$maps)
  )
  expect_identical(
    .sav_choice_maps_from_revision(published$revision),
    fixture$maps
  )
  expect_identical(revision_maps_hash, confirmed_maps_hash)
})

test_that("el bundle SAV aplica los choice_code_maps de la revision publicada", {
  fixture <- .sav_choice_maps_fixture()
  inst <- list(
    survey = data.frame(
      type = "select_one yesno",
      name = "p1",
      label = "Acepta participar",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno"),
      name = c("1", "2"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  converted <- .sm_sav_convert_entry_data(
    data.frame(q0001 = c("C1", "C2"), stringsAsFactors = FALSE),
    inst,
    base_name = "actor",
    base_meta = list(survey_id = "sm-sav-maps"),
    entry_name = "actor.sav",
    choice_code_maps = fixture$maps
  )

  expect_identical(as.character(converted$data$p1), c("2", "1"))
})

test_that("el bundle SAV bloquea codigos observados fuera del catalogo publicado", {
  fixture <- .sav_choice_maps_fixture()
  inst <- list(
    survey = data.frame(
      type = "select_one yesno",
      name = "p1",
      label = "Acepta participar",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno"),
      name = c("1", "2"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  err <- tryCatch(
    .sm_sav_convert_entry_data(
      data.frame(q0001 = c("C1", "C3"), stringsAsFactors = FALSE),
      inst,
      base_name = "actor",
      base_meta = list(survey_id = "sm-sav-maps"),
      entry_name = "actor.sav",
      choice_code_maps = fixture$maps
    ),
    api_error = function(e) e
  )

  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_SM_SAV_UNKNOWN_CHOICE_CODES")
  expect_identical(err$details$variables[[1]]$variable, "p1")
  expect_identical(unlist(err$details$variables[[1]]$values), "C3")
})

test_that("cambiar choice_code_maps invalida la confirmacion anterior", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fixture <- .sav_choice_maps_fixture()
  entry <- .sav_choice_maps_entry(fixture)
  state <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- state

  content_sha256 <- .xlsform_revision_hash(entry$workbook)
  xlsform_forms_confirm_logic(sid, entry$id, content_sha256)
  first <- xlsform_revision_publish(sid, entry$id, content_sha256)

  changed <- session_get(sid)
  changed_entry <- .xlsform_forms_get(changed, entry$id)
  changed_entry$workbook$surveyMonkeyLogic$choice_code_maps[[1]]$mappings <- list(
    list(source_code = "C1", xls_code = "1"),
    list(source_code = "C2", xls_code = "2")
  )
  changed <- .xlsform_forms_upsert(changed, changed_entry)
  .session_env[[sid]] <- changed

  publication <- .xlsform_revision_publication(
    changed,
    .xlsform_forms_get(changed, entry$id)
  )
  blocker_ids <- vapply(publication$blockers, `[[`, character(1), "id")

  expect_false(publication$can_publish)
  expect_true(any(grepl("stale", blocker_ids, fixed = TRUE)))
  expect_identical(
    .xlsform_revision_latest(changed, entry$id)$revision_id,
    first$revision$revision_id
  )
})

test_that("revisiones legacy sin choice_code_maps siguen toleradas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fixture <- .sav_choice_maps_fixture()
  fixture$workbook$surveyMonkeyLogic <- NULL
  entry <- .sav_choice_maps_entry(fixture, form_id = "form-sav-legacy")
  entry$source <- list(kind = "xlsform")
  state <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- state

  content_sha256 <- .xlsform_revision_hash(entry$workbook)
  published <- xlsform_revision_publish(sid, entry$id, content_sha256)

  expect_true(published$created)
  expect_length(.sav_choice_maps_from_revision(published$revision), 0L)
})

test_that("round-trip pulso conserva mapas y revision saludable para SAV", {
  skip_if_not_installed("openxlsx")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fixture <- .sav_choice_maps_fixture()
  entry <- .sav_choice_maps_entry(fixture, form_id = "form-sav-roundtrip")
  state <- .xlsform_forms_upsert(session_get(sid), entry)
  .session_env[[sid]] <- state

  content_sha256 <- .xlsform_revision_hash(entry$workbook)
  xlsform_forms_confirm_logic(sid, entry$id, content_sha256)
  revision <- xlsform_revision_publish(
    sid,
    entry$id,
    content_sha256
  )$revision
  revision_maps <- .sav_choice_maps_from_revision(revision)
  revision_maps_hash <- .sav_choice_maps_hash(revision)

  data_path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "datos")
  openxlsx::writeData(wb, "datos", data.frame(
    p1 = c("1", "2"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, data_path, overwrite = TRUE)
  data_meta <- save_upload(
    sid,
    "data",
    "actor_data.xlsx",
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  revision_meta <- get_file(sid, revision$xlsform_file_id)
  rp_inst <- reporte_instrumento(revision_meta$path)
  rp_data <- reporte_data(
    data.frame(p1 = c("1", "2"), stringsAsFactors = FALSE),
    instrumento = rp_inst
  )
  estudio_set_processing_mode(sid, "independent_siblings")
  estudio_add_base(
    sid,
    "actor",
    revision$xlsform_file_id,
    data_meta$file_id,
    "xlsx",
    rp_data,
    rp_inst,
    nrow(rp_data),
    ncol(rp_data),
    extra_meta = list(
      processing_mode = "independent_siblings",
      source_alias = "Actor",
      survey_id = "sm-sav-maps",
      original_xlsform_file_id = revision$xlsform_file_id,
      instrument_revision_id = revision$revision_id,
      instrument_revision_hash = revision$content_sha256
    )
  )

  project_path <- tempfile(fileext = ".pulso")
  on.exit(unlink(project_path, force = TRUE), add = TRUE)
  build_pulso(sid, project_path, project_name = "Choice maps round-trip")
  loaded <- load_pulso(project_path)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  restored <- session_get(loaded$session_id)
  restored_revision <- restored$instrument_revisions[[revision$revision_id]]
  context <- .sm_sav_instrument_context(restored, "actor")

  expect_identical(
    .sav_choice_maps_from_revision(restored_revision),
    revision_maps
  )
  expect_identical(.sav_choice_maps_hash(restored_revision), revision_maps_hash)
  expect_true(context$ok)
  expect_identical(context$audit$status, "pinned_healthy")
  expect_true(context$audit$healthy)
  expect_identical(context$revision$choice_code_maps, revision_maps)
  expect_identical(
    context$audit$choice_code_maps_sha256,
    revision_maps_hash
  )
})

test_that("flujo certificado bloquea mapas inferidos no sellados", {
  inst <- list(
    survey = data.frame(
      type = "select_one yesno",
      name = "p1",
      label = "Acepta participar",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno", "yesno"),
      name = c("1", "2"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    q0001 = haven::labelled(c(10, 20), labels = c("Sí" = 10, "No" = 20)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  err <- tryCatch(
    .sm_sav_convert_entry_data(
      raw,
      inst,
      base_name = "actor",
      base_meta = list(survey_id = "sm-sav-maps"),
      entry_name = "actor.sav",
      choice_code_maps = list(),
      choice_code_maps_certification = list(
        certified = TRUE,
        origin = "published_revision",
        sealed_sha256 = .xlsform_editor_sm_hash(list())
      )
    ),
    api_error = function(e) e
  )

  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_SM_SAV_UNSEALED_CHOICE_MAP")
  expect_identical(unlist(err$details$variables), "p1")
})

test_that("audit SAV registra mapas aplicados y recodes de Otro determinísticamente", {
  maps <- list(list(
    variable = "p1",
    type = "select_one",
    list_name = "yesno_other",
    mappings = list(
      list(source_code = "10", xls_code = "1"),
      list(source_code = "0", xls_code = "14")
    )
  ))
  inst <- list(
    survey = data.frame(
      type = "select_one yesno_other",
      name = "p1",
      label = "Respuesta",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("yesno_other", "yesno_other"),
      name = c("1", "14"),
      label = c("Sí", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  certification <- list(
    certified = TRUE,
    origin = "published_revision",
    sealed_sha256 = .xlsform_editor_sm_hash(maps)
  )

  first <- .sm_sav_convert_entry_data(
    data.frame(q0001 = c("10", "0"), stringsAsFactors = FALSE),
    inst,
    base_name = "actor",
    base_meta = list(survey_id = "sm-sav-maps"),
    entry_name = "actor.sav",
    choice_code_maps = maps,
    choice_code_maps_certification = certification
  )
  second <- .sm_sav_convert_entry_data(
    data.frame(q0001 = c("10", "0"), stringsAsFactors = FALSE),
    inst,
    base_name = "actor",
    base_meta = list(survey_id = "sm-sav-maps"),
    entry_name = "actor.sav",
    choice_code_maps = maps,
    choice_code_maps_certification = certification
  )

  expect_identical(first$audit$choice_code_maps$origin, "published_revision")
  expect_match(first$audit$choice_code_maps$sha256, "^[0-9a-f]{64}$")
  expect_length(first$audit$select_one_other_recodes, 1L)
  expect_identical(
    first$audit$select_one_other_recodes,
    second$audit$select_one_other_recodes
  )
})
