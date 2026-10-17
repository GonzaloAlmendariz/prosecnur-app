# Seguimiento del contrato H21/H23 (guardian-contratos, 2026-10-16).
#
# H21 empezo a guardar `adapter_id` y la configuracion no secreta del target en
# el deployment. Lo que fija este archivo:
#   1. La huella del despliegue NO cambia por guardar esos campos: un .pulso
#      viejo reabierto no deja material marcado `deployment_changed`.
#   3. `connection_profile_id` solo pasa con forma de id; un token pegado no
#      llega al estado ni al .pulso.
#   4. Al LEER, un deployment viejo deriva `adapter_id` (y `deployment_active`
#      cuando hay evidencia), sin persistirlo.
#   5. `custom_variable` (SurveyMonkey Web Link) se rehidrata; `recipients` no.
#   6. Rehacer el plan devuelve el mismo payload de lectura que el resto.

.hl_aula <- function(i) {
  list(
    operational_code = sprintf("AULA-%02d", i),
    classroom_id = sprintf("AULA-%02d", i),
    label = sprintf("Aula %02d", i),
    sample_role = "titular",
    wave = "M1",
    replacement_for = "",
    facultad = "Ingenieria",
    nombre_del_curso = sprintf("Curso %02d", i),
    horario = sprintf("%02d:00-%02d:00", 7 + i, 9 + i),
    pabellon_aula = sprintf("Pabellon %s - %d0%d", LETTERS[i], i, i),
    nombre_de_docente = sprintf("Docente %02d", i),
    matriculados_poblacion = 28 + i
  )
}

.hl_sesion <- function() {
  sid <- session_create()
  session_set(sid, "project_name", "Huella y lectura")
  session_set(sid, "calc_muestra_aulas_selection", list(selection = lapply(1:3, .hl_aula)))
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))
  session_set(sid, "project_dirty", FALSE)
  list(sid = sid, seeded = collection_state_seed(sid))
}

# Siembra legacy con enlaces: el plan de Monitoreo trae `link`, y de ahi sale
# un deployment `remote_ref.source = "legacy_local"` (la seleccion sola no
# trae enlaces y no siembra deployment).
.hl_sesion_legacy <- function() {
  sid <- session_create()
  session_set(sid, "project_name", "Huella legacy")
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "legacy-1", operational_code = "MAT-01", label = "Aula 1",
      wave = "M1", faculty = "Ingenieria", course_id = "Calculo", sample_role = "titular",
      schedule = "08:00", venue = "A-201", teacher = "Docente 1", eligible_n = 30,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=MAT-01"
    )
  ))
  list(sid = sid, seeded = collection_state_seed(sid))
}

.hl_kobo_target <- function(...) {
  utils::modifyList(list(
    provider = "kobo",
    base_access_url = "https://kobo.example.org/single/aB3xY9kQ",
    prefill_field = "collectorID",
    asset_type = "survey",
    deployment_active = TRUE,
    asset_uid = "aHuella01"
  ), list(...))
}

# Kobo preparado por el flujo de la app: vista previa -> prepare.
.hl_preparar_kobo <- function(fx, target = .hl_kobo_target()) {
  adapter <- collection_adapter_get("kobo_existing_v1")
  preview <- adapter$preview_deployment(plan = fx$seeded$plan, target = target)
  collection_deployment_prepare(fx$sid, fx$seeded$state_revision, deployment = preview)
}

# Lo que un deployment guardado ANTES de H21 no traia.
.hl_campos_h21 <- c(
  "base_access_url", "asset_type", "deployment_active", "prefill_field",
  "connection_profile_id", "custom_variable"
)

.hl_a_forma_vieja <- function(dep) {
  dep$adapter_id <- NULL
  dep$target <- dep$target[setdiff(names(dep$target), .hl_campos_h21)]
  dep
}

# Simula un .pulso guardado antes de H21: el deployment persistido sin los
# campos nuevos. Escribe directo en la sesion, como lo dejaria `load_pulso`.
.hl_persistir_forma_vieja <- function(sid) {
  s <- session_get(sid)
  s$collection_state$deployment <- .hl_a_forma_vieja(s$collection_state$deployment)
  .session_env[[sid]] <- s
  invisible(s$collection_state$deployment)
}

# --- 1. Huella ---------------------------------------------------------------

test_that("la huella de un deployment viejo no cambia al sumarle adapter_id y la config del target", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  adapter <- collection_adapter_get("kobo_existing_v1")
  nuevo <- adapter$preview_deployment(fx$seeded$plan, .hl_kobo_target())
  viejo <- .hl_a_forma_vieja(nuevo)
  # Precondicion: de verdad son distintos.
  expect_null(viejo$adapter_id)
  expect_null(viejo$target$base_access_url)

  completo <- viejo
  completo$adapter_id <- "kobo_existing_v1"
  completo$target$base_access_url <- "https://kobo.example.org/single/aB3xY9kQ"
  completo$target$asset_type <- "survey"
  completo$target$deployment_active <- TRUE
  completo$target$prefill_field <- "collectorID"
  completo$target$connection_profile_id <- "perfil_kobo-eu"
  completo$target$custom_variable <- "collectorID"

  expect_identical(
    .collection_deployment_fingerprint(viejo),
    .collection_deployment_fingerprint(completo)
  )
  expect_identical(
    .collection_deployment_fingerprint(viejo),
    .collection_deployment_fingerprint(nuevo)
  )
  # Y lo que si es identidad sigue entrando: otro asset cambia la huella.
  otro <- completo
  otro$target$remote_ref$asset_uid <- "aOtroAsset"
  expect_false(identical(
    .collection_deployment_fingerprint(viejo),
    .collection_deployment_fingerprint(otro)
  ))
})

test_that("material creado sobre un deployment viejo no queda deployment_changed al reabrir ni al re-preparar", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  prep <- .hl_preparar_kobo(fx)
  .hl_persistir_forma_vieja(fx$sid)
  created <- collection_material_instance_create(fx$sid, prep$state_revision)

  # El front prepara con el deployment que LEYO, que trae los derivados.
  leido <- collection_state_get(fx$sid)
  expect_identical(leido$state$deployment$adapter_id, "kobo_existing_v1")
  collection_deployment_prepare(fx$sid, leido$state_revision, deployment = leido$state$deployment)

  estado <- session_get(fx$sid)$collection_state
  expect_identical(estado$deployment$adapter_id, "kobo_existing_v1")
  razones <- .cm_instance_freshness(created$instance, estado)
  expect_false("deployment_changed" %in% razones)
})

test_that("hsvg2026: cargar el proyecto de referencia no deja material deployment_changed", {
  fixture <- reference_project_path("hsvg2026")
  skip_if_not(file.exists(fixture), "fixture hsvg2026 no instalado")
  sembrador <- normalizePath(
    file.path(testthat::test_path(), "..", "..", "..", "scripts", "qa", "material_campo_sembrar_plan.R"),
    mustWork = FALSE
  )
  skip_if_not(file.exists(sembrador), "scripts/qa no está en este árbol")

  # Tal como viene, hsvg2026 no trae collection_state: se construye una
  # instancia con el motor (sembrador de QA) y se recarga.
  original <- load_pulso(fixture)
  on.exit(session_delete(original$session_id), add = TRUE)
  expect_null(session_get(original$session_id)$collection_state)

  env <- new.env(parent = asNamespace("prosecnurapp"))
  sys.source(sembrador, envir = env)
  destino <- file.path(withr::local_tempdir(), "hsvg2026_con_material.pulso")
  env$material_campo_qa_sembrar(fixture, destino, render = "none")

  recargado <- load_pulso(destino)
  on.exit(session_delete(recargado$session_id), add = TRUE)
  estado <- session_get(recargado$session_id)$collection_state
  instancias <- estado$material_instances %||% list()
  expect_gte(length(instancias), 1L)
  for (inst in instancias) {
    expect_false("deployment_changed" %in% .cm_instance_freshness(inst, estado))
  }

  # Y la forma pre-H21 del mismo deployment tampoco lo marca.
  viejo <- estado
  viejo$deployment <- .hl_a_forma_vieja(estado$deployment)
  for (inst in instancias) {
    expect_false("deployment_changed" %in% .cm_instance_freshness(inst, viejo))
  }
})

# --- 3. connection_profile_id ---------------------------------------------------

test_that("connection_profile_id con forma de id se conserva", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  prep <- .hl_preparar_kobo(fx, .hl_kobo_target(connection_profile_id = "kobo_eu-01"))
  expect_identical(prep$deployment$target$connection_profile_id, "kobo_eu-01")
  expect_identical(
    session_get(fx$sid)$collection_state$deployment$target$connection_profile_id,
    "kobo_eu-01"
  )
})

test_that("un token pegado en connection_profile_id se rechaza con 422 y no llega al estado", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  token <- "Token 3f9a2b7c.d41d8cd98f00b204e9800998ecf8427e/secret=abc"
  adapter <- collection_adapter_get("kobo_existing_v1")

  # En la vista previa.
  err <- tryCatch(
    adapter$preview_deployment(fx$seeded$plan, .hl_kobo_target(connection_profile_id = token)),
    error = identity
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$status, 422)
  expect_identical(err$code, "E_COLLECTION_DEPLOYMENT_INVALID")
  expect_identical(err$details$field, "target.connection_profile_id")
  # El error no repite el valor.
  expect_false(grepl("3f9a2b7c", paste(c(conditionMessage(err), unlist(err$details)), collapse = " "), fixed = TRUE))

  # En el PUT directo (un cliente que salta la vista previa).
  preview <- adapter$preview_deployment(fx$seeded$plan, .hl_kobo_target())
  preview$target$connection_profile_id <- token
  err_put <- tryCatch(
    collection_deployment_put(fx$sid, preview, fx$seeded$state_revision),
    error = identity
  )
  expect_identical(err_put$code, "E_COLLECTION_DEPLOYMENT_INVALID")
  err_prep <- tryCatch(
    collection_deployment_prepare(fx$sid, fx$seeded$state_revision, deployment = preview),
    error = identity
  )
  expect_identical(err_prep$code, "E_COLLECTION_DEPLOYMENT_INVALID")

  # Ni rastro en el estado.
  texto <- paste(capture.output(str(session_get(fx$sid)$collection_state)), collapse = "\n")
  expect_false(grepl("3f9a2b7c", texto, fixed = TRUE))

  # Tambien un id demasiado largo o con espacios.
  for (malo in c(strrep("a", 65L), "perfil kobo", "kobo.eu")) {
    e <- tryCatch(
      adapter$preview_deployment(fx$seeded$plan, .hl_kobo_target(connection_profile_id = malo)),
      error = identity
    )
    expect_identical(e$code, "E_COLLECTION_DEPLOYMENT_INVALID", info = malo)
  }
})

# --- 4. Derivados de lectura ----------------------------------------------------

test_that("un deployment Kobo viejo deriva adapter_id y deployment_active al leer, sin persistirlos", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  .hl_preparar_kobo(fx)
  .hl_persistir_forma_vieja(fx$sid)

  for (payload in list(get = collection_state_get(fx$sid), seed = collection_state_seed(fx$sid))) {
    dep <- payload$state$deployment
    expect_identical(dep$adapter_id, "kobo_existing_v1")
    expect_identical(dep$target$deployment_active, TRUE)
    expect_identical(payload$deployment$adapter_id, "kobo_existing_v1")
    expect_identical(
      unlist(payload$deployment_derived_fields),
      c("adapter_id", "target.deployment_active")
    )
  }
  stored <- session_get(fx$sid)$collection_state$deployment
  expect_null(stored$adapter_id)
  expect_null(stored$target$deployment_active)
})

test_that("un deployment con adapter_id persistido no se reescribe ni se marca derivado", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  .hl_preparar_kobo(fx)
  payload <- collection_state_get(fx$sid)
  expect_identical(payload$state$deployment$adapter_id, "kobo_existing_v1")
  expect_length(payload$deployment_derived_fields, 0L)
})

test_that("la siembra legacy deriva el adapter del plan y no inventa deployment_active", {
  fx <- .hl_sesion_legacy()
  on.exit(session_delete(fx$sid), add = TRUE)
  payload <- collection_state_get(fx$sid)
  expect_identical(payload$state$deployment$target$remote_ref$source, "legacy_local")
  expect_identical(payload$state$deployment$adapter_id, "aulas_v1")
  expect_null(payload$state$deployment$target$deployment_active)
  expect_identical(unlist(payload$deployment_derived_fields), "adapter_id")
})

test_that("prepared sin el preflight Kobo guardado no basta para derivar deployment_active", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  .hl_preparar_kobo(fx)
  s <- session_get(fx$sid)
  dep <- .hl_a_forma_vieja(s$collection_state$deployment)
  dep$capability_preflight <- NULL
  s$collection_state$deployment <- dep
  .session_env[[fx$sid]] <- s

  payload <- collection_state_get(fx$sid)
  # El proveedor alcanza para el adapter, no para afirmar que el form esta activo.
  expect_identical(payload$state$deployment$adapter_id, "kobo_existing_v1")
  expect_null(payload$state$deployment$target$deployment_active)
  expect_identical(unlist(payload$deployment_derived_fields), "adapter_id")
})

test_that("el preflight guardado distingue aulas_v1 con target Kobo de kobo_existing_v1", {
  dep <- list(
    status = "prepared",
    target = list(provider = "kobo", remote_ref = list(asset_uid = "aX")),
    capability_preflight = list(adapter_id = "aulas_v1", blocking = list()),
    bindings = list()
  )
  out <- .collection_deployment_con_derivados(dep, list(adapter = list(id = "aulas_v1")))
  expect_identical(out$deployment$adapter_id, "aulas_v1")
  expect_null(out$deployment$target$deployment_active)
})

test_that("surveymonkey deriva recipient o weblink segun los bindings", {
  base <- list(status = "draft", target = list(provider = "surveymonkey", remote_ref = list()))
  web <- base
  web$bindings <- list(list(access_kind = "parameterized_link"))
  rec <- base
  rec$bindings <- list(list(access_kind = "parameterized_link"), list(access_kind = "recipient_link"))
  expect_identical(
    .collection_deployment_con_derivados(web, NULL)$deployment$adapter_id,
    "surveymonkey_weblink_existing_v1"
  )
  expect_identical(
    .collection_deployment_con_derivados(rec, NULL)$deployment$adapter_id,
    "surveymonkey_recipient_existing_v1"
  )
  manual <- list(status = "draft", target = list(provider = "manual"), bindings = list())
  out <- .collection_deployment_con_derivados(manual, NULL)
  expect_null(out$deployment$adapter_id)
  expect_length(out$derived, 0L)
})

# --- 5. SurveyMonkey Web Link ----------------------------------------------------

test_that("SurveyMonkey weblink rehidrata custom_variable y no guarda recipients", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  adapter <- collection_adapter_get("surveymonkey_weblink_existing_v1")
  target <- list(
    provider = "surveymonkey",
    type = "weblink",
    collector_id = "col-123",
    base_access_url = "https://www.surveymonkey.com/r/HUELLA01",
    custom_variable = "aula",
    connection_profile_id = "sm_pucp",
    recipients = list(list(unit_id = "u1", email = "persona@example.org"))
  )
  preview <- adapter$preview_deployment(fx$seeded$plan, target)
  expect_identical(preview$status, "prepared")
  put <- collection_deployment_put(fx$sid, preview, fx$seeded$state_revision)
  prep <- collection_deployment_prepare(fx$sid, put$state_revision)
  expect_identical(prep$deployment$status, "prepared")

  reread <- collection_state_get(fx$sid)$state$deployment
  for (dep in list(prepare = prep$deployment, persistido = reread)) {
    expect_identical(dep$adapter_id, "surveymonkey_weblink_existing_v1")
    expect_identical(dep$target$provider, "surveymonkey")
    expect_identical(dep$target$base_access_url, "https://www.surveymonkey.com/r/HUELLA01")
    expect_identical(dep$target$custom_variable, "aula")
    expect_identical(dep$target$connection_profile_id, "sm_pucp")
    expect_identical(dep$target$remote_ref$collector_id, "col-123")
    expect_null(dep$target$recipients)
  }
  texto <- paste(capture.output(str(session_get(fx$sid)$collection_state)), collapse = "\n")
  expect_false(grepl("persona@example.org", texto, fixed = TRUE))

  # custom_variable es configuracion, no identidad: fuera de la huella.
  sin <- reread
  sin$target$custom_variable <- NULL
  expect_identical(
    .collection_deployment_fingerprint(sin),
    .collection_deployment_fingerprint(reread)
  )
})

# --- 6. Rehacer el plan -----------------------------------------------------------

test_that("rehacer el plan devuelve el mismo payload de lectura que GET", {
  fx <- .hl_sesion_legacy()
  on.exit(session_delete(fx$sid), add = TRUE)
  re <- collection_state_reseed(fx$sid, fx$seeded$state_revision)
  get <- collection_state_get(fx$sid)
  expect_true(isTRUE(re$reseeded))
  # Paso por el pipeline de lectura: trae el derivado de la siembra legacy.
  expect_identical(re$state$deployment$adapter_id, "aulas_v1")
  expect_identical(re$deployment$adapter_id, "aulas_v1")
  expect_identical(re$deployment_derived_fields, get$deployment_derived_fields)
  expect_identical(re$state, get$state)
})

test_that("rehacer pasa su payload por la disponibilidad de recibos", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  # La siembra no arrastra recibos del plan anterior, asi que se fija la
  # costura: el payload de rehacer pasa por `.collection_receipts_con_disponibilidad`.
  llamadas <- 0L
  real <- .collection_receipts_con_disponibilidad
  testthat::local_mocked_bindings(.collection_receipts_con_disponibilidad = function(payload, session) {
    llamadas <<- llamadas + 1L
    real(payload, session)
  })
  re <- collection_state_reseed(fx$sid, fx$seeded$state_revision)
  expect_true(isTRUE(re$reseeded))
  expect_identical(llamadas, 1L)
})

# --- handoff sin recibo en el JSON ------------------------------------------------
#
# `handoff = NULL` dentro de una lista sale como `{}` por el serializador real
# de la API. Sin recibo no hay objeto: la clave se omite.

.hl_cuerpo <- function(val) {
  res <- local({
    self <- new.env(parent = emptyenv())
    self$setHeader <- function(...) invisible(NULL)
    self$toResponse <- function() list(body = self$body)
    self
  })
  out <- prosecnurapp:::.api_serializer()(val, list(), res, function(req, res, err) stop(err))
  if (is.raw(out$body)) rawToChar(out$body) else as.character(out$body)
}

test_that("el payload y la vista previa no serializan un handoff vacio como {}", {
  fx <- .hl_sesion_legacy()
  on.exit(session_delete(fx$sid), add = TRUE)
  # Precondicion: el estado persistido guarda la entrada NULL.
  persistido <- session_get(fx$sid)$collection_state$deployment
  expect_true("handoff" %in% names(persistido))
  expect_null(persistido$handoff)
  # Y ese NULL, serializado tal cual, es el `{}` que se corrige.
  expect_true(grepl('"handoff":\\{\\}', .hl_cuerpo(persistido)))

  cuerpo <- .hl_cuerpo(collection_state_get(fx$sid))
  expect_false(grepl('"handoff":\\{\\}', cuerpo))
  parsed <- jsonlite::fromJSON(cuerpo, simplifyVector = FALSE)
  expect_null(parsed$state$deployment$handoff)
  expect_null(parsed$deployment$handoff)
  expect_identical(parsed$state$deployment$deployment_id, persistido$deployment_id)

  plan <- collection_state_get(fx$sid)$state$plan
  preview <- collection_adapter_get("kobo_existing_v1")$preview_deployment(plan, .hl_kobo_target())
  expect_false("handoff" %in% names(preview))
  expect_false(grepl('"handoff":\\{\\}', .hl_cuerpo(list(deployment = preview))))
})

test_that("un handoff {} devuelto por el cliente se guarda como NULL y no mueve la huella", {
  fx <- .hl_sesion()
  on.exit(session_delete(fx$sid), add = TRUE)
  preview <- collection_adapter_get("kobo_existing_v1")$preview_deployment(fx$seeded$plan, .hl_kobo_target())
  huella <- .collection_deployment_fingerprint(preview)
  # Lo que llega por HTTP cuando el cliente reenvia `"handoff": {}`.
  preview$handoff <- jsonlite::fromJSON("{}", simplifyVector = FALSE)
  expect_true(is.list(preview$handoff) && !length(preview$handoff))
  put <- collection_deployment_put(fx$sid, preview, fx$seeded$state_revision)
  guardado <- session_get(fx$sid)$collection_state$deployment
  expect_null(guardado$handoff)
  expect_identical(guardado$deployment_fingerprint, huella)
  expect_true(isTRUE(collection_state_validate(session_get(fx$sid)$collection_state)$ok))

  # El handoff real sigue escribiendo y serializando su recibo.
  prep <- collection_deployment_prepare(fx$sid, put$state_revision)
  hand <- collection_handoff(fx$sid, prep$state_revision)
  expect_identical(hand$state$deployment$status, "handed_off")
  expect_identical(hand$state$deployment$handoff$schema, "collection_handoff/v1")
  expect_true(grepl('"handoff":{"schema"', .hl_cuerpo(hand$state$deployment), fixed = TRUE))
})
