.collection_test_legacy <- function() {
  list(
    list(
      selection_run_id = "sel-1", classroom_id = "A-01", operational_code = "OP-01",
      label = "Aula 1", wave = "M1", faculty = "Ingeniería",
      link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=OP-01"
    ),
    list(
      selection_run_id = "sel-1", classroom_id = "A-02", operational_code = "OP-02",
      label = "Aula 2", wave = "M1", faculty = "Derecho",
      link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=OP-02"
    )
  )
}

test_that("seed aulas_v1 es aditivo, determinista y no pisa Monitoreo", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  legacy <- .collection_test_legacy()
  session_set(sid, "monitoreo_aulas_plan", legacy)

  first <- collection_state_seed(sid)
  expect_true(first$seeded)
  expect_false(first$noop)
  expect_false(first$seed_available)
  expect_identical(session_get(sid)$monitoreo_aulas_plan, legacy)
  expect_identical(first$schema, "collection_state/v1")
  expect_identical(first$state_revision, 1L)
  expect_identical(first$plan$adapter$id, "aulas_v1")
  expect_match(first$plan$input_fingerprint, "^sha256:[0-9a-f]{64}$")

  second <- collection_state_seed(sid)
  expect_true(second$noop)
  expect_identical(second$state, first$state)

  fresh <- session_get(sid)
  fresh$collection_state <- NULL
  .session_env[[sid]] <- fresh
  third <- collection_state_seed(sid)
  expect_identical(third$state, first$state)
})

test_that("seed sin plan legacy es no-op y no ensucia el proyecto", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)

  initial <- collection_state_get(sid)
  expect_false(initial$seed_available)
  seeded <- collection_state_seed(sid)
  expect_true(seeded$noop)
  expect_false(seeded$seeded)
  expect_false(seeded$seed_available)
  expect_identical(seeded$state_revision, 0L)
  expect_null(seeded$plan)
  expect_null(session_get(sid)$collection_state)
  expect_false(isTRUE(session_get(sid)$project_dirty))

  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  session_set(sid, "project_dirty", FALSE)
  expect_true(collection_state_get(sid)$seed_available)
})

test_that("seed aulas_v1 acepta la selección decidida de Cálculo de muestra", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  selection <- data.frame(
    selection_run_id = c("sel-calc-1", "sel-calc-1"),
    operational_code = c("AULA 1", "AULA 2"),
    selection_slot_id = c("slot-001", "slot-002"),
    sample_role = c("titular", "reserva"),
    wave = c("M1", "R1"),
    classroom_id = c("class-1", "class-2"),
    label = c("Aula Cálculo", "Aula Derecho"),
    course_id = c("MAT101", "DER101"),
    course_name = c("Cálculo I", "Derecho I"),
    schedule = c("08:00", "10:00"),
    teacher = c("Docente Uno", "Docente Dos"),
    faculty = c("Ingeniería", "Derecho"),
    eligible_n = c(30L, 25L),
    stringsAsFactors = FALSE
  )
  source <- list(selection = selection, selection_run_id = "sel-calc-1")
  session_set(sid, "calc_muestra_aulas_selection", source)
  session_set(sid, "project_dirty", FALSE)

  expect_true(collection_state_get(sid)$seed_available)
  seeded <- collection_state_seed(sid)
  expect_true(seeded$seeded)
  expect_false(seeded$noop)
  expect_identical(seeded$plan$source_ref$module, "calc-muestra")
  expect_identical(seeded$plan$source_ref$run_id, "sel-calc-1")
  expect_identical(seeded$plan$adapter$id, "aulas_v1")
  expect_length(seeded$plan$units, 2L)
  expect_identical(seeded$plan$units[[1]]$dimensions$course_name, "Cálculo I")
  expect_identical(seeded$plan$units[[1]]$dimensions$teacher, "Docente Uno")
  expect_identical(seeded$plan$units[[1]]$dimensions$sample_label, "M1")
  expect_identical(seeded$plan$units[[1]]$dimensions$venue, "Aula Cálculo")
  expect_identical(seeded$plan$units[[1]]$dimensions$eligible_n, 30)
  rendered <- .crf_unit_context(seeded$plan$units[[1]])
  expect_identical(rendered$course_name, "Cálculo I")
  expect_identical(rendered$teacher, "Docente Uno")
  expect_identical(rendered$eligible_n, "30")
  expect_null(seeded$deployment)
  expect_identical(seeded$migration$source, "calc_muestra_aulas_selection")
  expect_identical(session_get(sid)$calc_muestra_aulas_selection, source)
  expect_null(session_get(sid)$monitoreo_aulas_plan)
})

test_that("cambiar selección o revisión de instrumento vuelve stale el deployment", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  seeded <- collection_state_seed(sid)

  changed <- seeded$plan
  changed$units[[1]]$label <- "Aula renombrada"
  updated <- collection_plan_put(sid, changed, seeded$state_revision)
  expect_identical(updated$deployment$status, "stale")
  expect_true("plan_fingerprint_changed" %in% unlist(updated$deployment$stale$reasons))

  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)
  before <- session_get(sid)
  err <- tryCatch(
    collection_handoff(sid, updated$state_revision),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_HANDOFF_STALE")
  after <- session_get(sid)
  expect_identical(after$collection_state, before$collection_state)
  expect_identical(after$monitoreo_aulas_plan, before$monitoreo_aulas_plan)
  expect_false(isTRUE(after$project_dirty))
})

test_that("reconcile observa instrumento y target sin escribir si no cambiaron", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  seeded <- collection_state_seed(sid)

  same <- collection_reconcile(
    sid, seeded$state_revision,
    observed = list(
      instrument_sha256 = seeded$plan$instrument_ref$sha256,
      target_fingerprint = collection_fingerprint(seeded$deployment$target)
    )
  )
  expect_true(same$noop)
  expect_identical(same$state_revision, seeded$state_revision)

  stale <- collection_reconcile(
    sid, seeded$state_revision,
    observed = list(instrument_sha256 = paste(rep("f", 64L), collapse = ""))
  )
  expect_identical(stale$deployment$status, "stale")
  expect_true("instrument_revision_changed" %in% unlist(stale$deployment$stale$reasons))
})

test_that("handoff repetido es no-op y conserva revisión, timestamp y dirty", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  seeded <- collection_state_seed(sid)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)

  first <- collection_handoff(sid, seeded$state_revision)
  first_time <- first$deployment$handoff$handed_off_at
  first_revision <- first$state_revision
  first_rows <- session_get(sid)$monitoreo_aulas_plan
  expect_identical(
    first_rows[[1]]$access_id,
    seeded$deployment$bindings[[1]]$access_id
  )
  expect_identical(
    first_rows[[1]]$collection_deployment_fingerprint,
    seeded$deployment$deployment_fingerprint
  )
  expect_true(isTRUE(session_get(sid)$project_dirty))

  session_set(sid, "project_dirty", FALSE)
  repeated <- collection_handoff(sid, seeded$state_revision)
  expect_true(repeated$noop)
  expect_identical(repeated$state_revision, first_revision)
  expect_identical(repeated$deployment$handoff$handed_off_at, first_time)
  expect_identical(session_get(sid)$monitoreo_aulas_plan, first_rows)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("handoff restricted proyecta solo referencia opaca, nunca row$link", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  seeded <- collection_state_seed(sid)
  state <- session_get(sid)$collection_state
  state$deployment$sensitivity$access_urls <- "restricted"
  for (i in seq_along(state$deployment$bindings)) {
    state$deployment$bindings[[i]]$access_ref <- paste0("external-ref:", i)
  }
  state$deployment$deployment_fingerprint <- .collection_deployment_fingerprint(state$deployment)
  session <- session_get(sid)
  session$collection_state <- state
  .session_env[[sid]] <- session

  handoff <- collection_handoff(sid, seeded$state_revision)
  rows <- session_get(sid)$monitoreo_aulas_plan
  expect_false(handoff$noop)
  expect_true(all(vapply(rows, function(row) identical(row$link, ""), logical(1))))
  expect_true(all(vapply(rows, function(row) {
    grepl("^sha256:[0-9a-f]{64}$", row$access_ref_hash)
  }, logical(1))))
})

test_that("toda mutación posterior al seed exige expected_revision", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  seeded <- collection_state_seed(sid)
  err <- tryCatch(collection_plan_put(sid, seeded$plan, NULL), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_EXPECTED_REVISION")
})

test_that("deployment con remote_write TRUE no atraviesa el engine ni muta estado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", .collection_test_legacy())
  seeded <- collection_state_seed(sid)
  invalid <- seeded$deployment
  invalid$capabilities$remote_write$observed <- TRUE
  before <- session_get(sid)

  err <- tryCatch(
    collection_deployment_put(sid, invalid, seeded$state_revision),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_DEPLOYMENT_INVALID")
  expect_identical(session_get(sid), before)
})

# --- Composicion de la URL de acceso ------------------------------------------
# El QR y el enlace del handoff nacen en `.collection_access_url()`. Dos capas
# escribian el parametro de personalizacion (el adapter dentro de `access_ref` y
# el resolvedor desde `prefill`), asi que salia duplicado: el doble de payload y
# un QR mas denso de lo necesario justo donde se escanea peor.

.collection_binding_fixture <- function(access_ref = "https://ee.example.test/x/form",
                                        prefill = list(collectorID = "CH-1")) {
  # Sin modifyList: recursa dentro de `prefill` y fusionaria las claves del
  # default con las del caso, emitiendo dos parametros donde el test pide uno.
  list(
    access_id = "access-1",
    logical_collector_id = "logical-1",
    unit_id = "unit-1",
    access_kind = "parameterized_link",
    access_ref = access_ref,
    prefill = prefill,
    status = "ready"
  )
}

test_that("el parametro de personalizacion se cuelga una sola vez", {
  url <- .collection_access_url(.collection_binding_fixture(), "operational", "kobo")

  expect_equal(url, "https://ee.example.test/x/form?d%5BcollectorID%5D=CH-1")
  # El control: con la duplicacion vieja esto valia 2.
  expect_equal(lengths(regmatches(url, gregexpr("collectorID", url, fixed = TRUE)))[[1]], 1L)
})

test_that("SurveyMonkey recibe su Custom Variable, no la sintaxis d[] de Kobo", {
  url <- .collection_access_url(
    .collection_binding_fixture(prefill = list(unit_key = "CH-1")),
    "operational", "surveymonkey"
  )

  expect_equal(url, "https://ee.example.test/x/form?unit_key=CH-1")
  expect_false(grepl("d%5B", url, fixed = TRUE))
})

test_that("una base que ya trae query conserva su parametro y suma el suyo", {
  url <- .collection_access_url(
    .collection_binding_fixture(access_ref = "https://ee.example.test/x/form?return=none"),
    "operational", "kobo"
  )

  expect_equal(url, "https://ee.example.test/x/form?return=none&d%5BcollectorID%5D=CH-1")
})

test_that("un acceso restringido no filtra su URL al material", {
  expect_equal(.collection_access_url(.collection_binding_fixture(), "restricted", "kobo"), "")
})

test_that("la costura adapter -> resolvedor no duplica el parametro", {
  # El aserto de arriba no basta: con un binding limpio la version vieja de
  # `.collection_access_url()` tambien colgaba un solo parametro. La duplicacion
  # nacia de que el adapter YA traia el parametro dentro de `access_ref`. Este
  # test recorre las dos capas de verdad, que es donde el defecto vivia.
  adapter <- collection_adapter_get("kobo_existing_v1")
  target <- list(
    asset_uid = "aSurvey", asset_type = "survey", deployment_active = TRUE,
    base_access_url = "https://ee.example.test/x/form", prefill_field = "collectorID"
  )
  plan <- list(
    schema = "collection_plan/v1", plan_id = "plan-costura",
    units = list(list(unit_id = "unit-1", link_key = "CH-1"))
  )
  deployment <- adapter$preview_deployment(plan, adapter$inspect_target(list(), target))
  url <- .collection_access_url(deployment$bindings[[1]], "operational", "kobo")

  expect_equal(url, "https://ee.example.test/x/form?d%5BcollectorID%5D=CH-1")
  expect_equal(lengths(regmatches(url, gregexpr("collectorID", url, fixed = TRUE)))[[1]], 1L)
})
