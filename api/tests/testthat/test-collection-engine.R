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
    # **Codigos, no «Aula Calculo».** El fixture llamaba «Aula Calculo» al
    # label, asi que el aserto de mas abajo —«el aula es "Aula Calculo"»—
    # parecia correcto cuando lo que comprobaba era que `venue` CAE al label por
    # falta de columna de aula. Con el codigo real que trae el estudio,
    # `1mat101_0801`, el mismo aserto se lee como lo que era: la ficha
    # imprimiendo el curso-horario bajo el rotulo «Aula».
    label = c("1mat101_0801", "1der101_1001"),
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
  # Sin columna de aula el aula queda VACIA, y la ficha imprime «Por
  # confirmar». Es la verdad: el aula no se sabe hasta el dia de la aplicacion
  # y el aplicador la anota a mano en el registro.
  expect_identical(seeded$plan$units[[1]]$dimensions$venue, "")
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

test_that("V4 el plan/deployment de Recopiladores no asume un origen de aulas", {
  # ADR 0046 nombra acreditacion multiactor, establecimientos y listados como
  # perfiles futuros -aulas_v1 fue deliberadamente el primero, "paridad
  # funcional y QA visual del adapter aulas_v1 antes de anadir otros
  # perfiles" (Cumplimiento del ADR)-, asi que el contrato de plan/deployment
  # tiene que aceptar un origen que NO sea calc-muestra-aulas ni monitoreo
  # HOY, aunque el auto-seed de .collection_seed_source() siga siendo
  # aulas-only por ahora. Reproduce lo que se verifico a mano contra el
  # router real esta sesion (curl directo a /api/recopiladores/plan): un
  # plan con unit_type="establishment" y source_ref.module="acreditacion".
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fp <- paste0("sha256:", strrep("b", 64L))
  plan <- list(
    schema = "collection_plan/v1", plan_id = "plan-v4-no-aulas",
    adapter = list(id = "kobo_existing_v1", version = 1L),
    source_ref = list(module = "acreditacion", run_id = "run-v4", fingerprint = fp),
    instrument_ref = list(revision_id = "instrumento-v4", sha256 = strrep("c", 64L)),
    unit_type = "establishment",
    units = list(
      list(unit_id = "est-1", label = "Sede 1", link_key = "SEDE-1"),
      list(unit_id = "est-2", label = "Sede 2", link_key = "SEDE-2")
    ),
    revision = 1L, input_fingerprint = fp
  )
  put <- collection_plan_put(sid, plan, expected_revision = 0L)
  expect_identical(put$plan$unit_type, "establishment")
  expect_identical(put$plan$source_ref$module, "acreditacion")

  target <- list(
    provider = "kobo", asset_uid = "aV4Sedes", asset_type = "survey",
    deployment_active = TRUE, base_access_url = "https://ee.kobotoolbox.org/x/sedesV4"
  )
  adapter <- collection_adapter_get("kobo_existing_v1")
  preview <- adapter$preview_deployment(plan = put$plan, target = adapter$inspect_target(list(), target))
  preview$capability_preflight <- NULL
  dep_put <- collection_deployment_put(sid, preview, expected_revision = put$state_revision)
  prep <- collection_deployment_prepare(sid, expected_revision = dep_put$state_revision)
  expect_identical(prep$deployment$status, "prepared")
  expect_identical(prep$deployment$coverage$units_with_access, 2L)

  # El default de ruta XPath (motor QR, E1/E2) tampoco es especial para
  # aulas: sale igual para un origen de acreditacion.
  url <- .collection_access_url(prep$deployment$bindings[[1]], "operational", "kobo")
  expect_match(url, "d%5B/aV4Sedes/collectorID%5D=", fixed = TRUE)
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

test_that("V5 el deployment es todo o nada: una unidad sin enlace bloquea el prepare completo", {
  # Hallazgo real, no supuesto: `collection_deployment_prepare()` exige
  # cobertura TOTAL (collection_engine.R ~linea 532,
  # `units_missing_access > 0` => E_COLLECTION_DEPLOYMENT_NOT_READY, 422). No
  # existe un handoff parcial donde 2 de 3 unidades avanzan y la tercera
  # queda "pendiente": el estudio entero se queda en `draft` hasta que TODAS
  # las unidades resuelven acceso. Con una muestra de 200+ aulas, una sola
  # unidad con un valor de personalizacion vacio bloquea el prepare de las
  # otras 199 -no es un bug de este cambio, es el contrato ya existente-.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fp <- paste0("sha256:", strrep("d", 64L))
  plan <- list(
    schema = "collection_plan/v1", plan_id = "plan-v5-mixto",
    adapter = list(id = "kobo_existing_v1", version = 1L),
    source_ref = list(module = "calc-muestra", run_id = "run-v5", fingerprint = fp),
    instrument_ref = list(revision_id = "instrumento-v5", sha256 = strrep("e", 64L)),
    unit_type = "classroom_course_schedule",
    units = list(
      list(unit_id = "u-1", label = "Aula 1", link_key = "AULA-1"),
      # Sin link_key -> .ca_unit_value() da "" -> access_ref queda NULL ->
      # .collection_access_url() no tiene nada que componer.
      list(unit_id = "u-2", label = "Aula 2", link_key = ""),
      list(unit_id = "u-3", label = "Aula 3", link_key = "AULA-3")
    ),
    revision = 1L, input_fingerprint = fp
  )
  put <- collection_plan_put(sid, plan, expected_revision = 0L)

  target <- list(
    provider = "kobo", asset_uid = "aV5Mixto", asset_type = "survey",
    deployment_active = TRUE, base_access_url = "https://ee.kobotoolbox.org/x/mixtoV5"
  )
  adapter <- collection_adapter_get("kobo_existing_v1")
  preview <- adapter$preview_deployment(plan = put$plan, target = adapter$inspect_target(list(), target))
  preview$capability_preflight <- NULL
  dep_put <- collection_deployment_put(sid, preview, expected_revision = put$state_revision)
  # El PREVIEW si distingue cobertura parcial (2/3) sin bloquear -es el
  # punto donde el analista ve el hueco antes de intentar preparar-.
  expect_identical(dep_put$deployment$coverage$units_with_access, 2L)
  expect_identical(dep_put$deployment$coverage$units_missing_access, 1L)
  expect_identical(dep_put$deployment$status, "draft")

  err <- tryCatch(
    collection_deployment_prepare(sid, expected_revision = dep_put$state_revision),
    error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_COLLECTION_DEPLOYMENT_NOT_READY")

  # Con las 3 unidades resueltas SI prepara y SI hace handoff completo, sin
  # unidades faltantes ni link vacio.
  plan$units[[2]]$link_key <- "AULA-2"
  put2 <- collection_plan_put(sid, plan, expected_revision = dep_put$state_revision)
  preview2 <- adapter$preview_deployment(plan = put2$plan, target = adapter$inspect_target(list(), target))
  preview2$capability_preflight <- NULL
  dep_put2 <- collection_deployment_put(sid, preview2, expected_revision = put2$state_revision)
  prep <- collection_deployment_prepare(sid, expected_revision = dep_put2$state_revision)
  expect_identical(prep$deployment$status, "prepared")
  expect_identical(prep$deployment$coverage$units_missing_access, 0L)

  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)
  ho <- collection_handoff(sid, expected_revision = prep$state_revision)
  rows <- ho$monitoring_rows
  expect_length(rows, 3L)
  expect_true(all(vapply(rows, function(r) nzchar(as.character(r$link %||% "")), logical(1))))
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

test_that("sin prefill_field, la costura produce el enlace real que Gonzalo confirmo en produccion", {
  # Reproduce byte a byte el enlace que Gonzalo dio por bueno:
  # https://ee-eu.kobotoolbox.org/single/ccIcHAqm?d%5B/aNNuP72AedZ886EoAUeV5o/collectorID%5D=EEGGLL
  # La ruta XPath completa (`/<asset_uid>/collectorID`) tiene que salir del
  # motor por defecto -sin que nadie configure `prefill_field`- y la barra NO
  # se escapa a `%2F`, que es justo lo que rompia el enlace real.
  adapter <- collection_adapter_get("kobo_existing_v1")
  target <- list(
    asset_uid = "aNNuP72AedZ886EoAUeV5o", asset_type = "survey", deployment_active = TRUE,
    base_access_url = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm"
  )
  plan <- list(
    schema = "collection_plan/v1", plan_id = "plan-costura-xpath",
    units = list(list(unit_id = "unit-1", link_key = "EEGGLL"))
  )
  deployment <- adapter$preview_deployment(plan, adapter$inspect_target(list(), target))
  url <- .collection_access_url(deployment$bindings[[1]], "operational", "kobo")

  expect_identical(
    url,
    "https://ee-eu.kobotoolbox.org/single/ccIcHAqm?d%5B/aNNuP72AedZ886EoAUeV5o/collectorID%5D=EEGGLL"
  )
})

test_that("returnUrl se cuelga al final, una sola vez y para todo el estudio", {
  # Mismo enlace real, ahora completo con `returnUrl`. El valor SI va con la
  # barra escapada -va del lado del valor, no del nombre del parametro- porque
  # ahi la codificacion estandar es correcta y es lo que el enlace real trae.
  binding <- list(
    access_ref = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm",
    access_kind = "parameterized_link",
    prefill = list(`/aNNuP72AedZ886EoAUeV5o/collectorID` = "EEGGLL")
  )
  url <- .collection_access_url(
    binding, "operational", "kobo",
    return_url = "https://pulso.pucp.edu.pe/noticias/enlace"
  )

  expect_identical(
    url,
    paste0(
      "https://ee-eu.kobotoolbox.org/single/ccIcHAqm?",
      "d%5B/aNNuP72AedZ886EoAUeV5o/collectorID%5D=EEGGLL&",
      "returnUrl=https%3A%2F%2Fpulso.pucp.edu.pe%2Fnoticias%2Fenlace"
    )
  )
})

test_that("sin returnUrl configurado, el enlace sale igual que antes", {
  binding <- list(
    access_ref = "https://ee.example.test/x/form",
    access_kind = "parameterized_link",
    prefill = list(collectorID = "CH-1")
  )
  expect_identical(
    .collection_access_url(binding, "operational", "kobo"),
    .collection_access_url(binding, "operational", "kobo", return_url = "")
  )
  expect_false(grepl("returnUrl", .collection_access_url(binding, "operational", "kobo"), fixed = TRUE))
})

test_that("returnUrl tambien viaja en un acceso sin personalizacion", {
  # returnUrl no depende de que la unidad tenga collectorID: es del estudio
  # entero, asi que un manual_handoff o un recipient_link tambien lo llevan.
  binding <- list(access_ref = "https://ee.example.test/x/form", access_kind = "manual_handoff")
  url <- .collection_access_url(binding, "operational", "kobo", return_url = "https://pulso.pucp.edu.pe/x")
  expect_identical(url, "https://ee.example.test/x/form?returnUrl=https%3A%2F%2Fpulso.pucp.edu.pe%2Fx")
})

test_that("V2 durabilidad: .collection_access_url no depende de sesion, sid ni cache", {
  # Un QR impreso tiene que seguir resolviendo igual dentro de un mes, con la
  # sesion que lo genero hace tiempo cerrada. La funcion no recibe `sid` en su
  # firma -es deliberado-, y sus dos unicos insumos (`binding` y
  # `deployment$target`) son parte de `collection_state`, que SI viaja dentro
  # del `.pulso` (`.pulso_strip_caches()` en project_pulso.R no lo toca; solo
  # poda caches derivables como `dashboard_rp_inst` o `graficos_preview_cache`,
  # nunca `collection_state`). Esto arma binding+target "en frio", sin pasar
  # por session_create()/session_set(), para que quede blindado: si alguna vez
  # la funcion empieza a leer algo de una sesion viva, esto se rompe.
  binding_frio <- list(
    access_ref = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm",
    access_kind = "parameterized_link",
    prefill = list(`/aFRIO123/collectorID` = "CH 9")
  )
  url_1 <- .collection_access_url(binding_frio, "operational", "kobo", "https://pulso.pucp.edu.pe/x")
  url_2 <- .collection_access_url(binding_frio, "operational", "kobo", "https://pulso.pucp.edu.pe/x")
  expect_identical(url_1, url_2)
  expect_identical(
    url_1,
    "https://ee-eu.kobotoolbox.org/single/ccIcHAqm?d%5B/aFRIO123/collectorID%5D=CH%209&returnUrl=https%3A%2F%2Fpulso.pucp.edu.pe%2Fx"
  )
  expect_false("sid" %in% names(formals(.collection_access_url)))
})

test_that("un valor de personalizacion vacio o NA no produce enlace", {
  # Un QR con `d[collectorID]=` escanea bien, abre el formulario bien y llega
  # SIN identificador: la respuesta entra anonima y no se descubre hasta el
  # analisis. El NA es peor: `d[collectorID]=NA` si lleva identificador —la
  # cadena «NA»— y acumula todas las unidades sin codigo en un colector
  # inventado que parece legitimo.
  url <- get(".collection_access_url", envir = asNamespace("prosecnurapp"))
  base <- list(
    access_ref = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm",
    access_kind = "parameterized_link"
  )
  for (malo in list("", NA, NA_character_, "   ")) {
    binding <- base
    binding$prefill <- list(collectorID = malo)
    expect_identical(url(binding, "public", "kobo"), "")
  }
  # El caso bueno sigue saliendo entero, con el valor escapado.
  binding <- base
  binding$prefill <- list(collectorID = "CH 31")
  expect_identical(
    url(binding, "public", "kobo"),
    "https://ee-eu.kobotoolbox.org/single/ccIcHAqm?d%5BcollectorID%5D=CH%2031"
  )
})
