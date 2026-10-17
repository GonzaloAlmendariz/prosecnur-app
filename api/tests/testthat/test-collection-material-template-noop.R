# PUT /api/recopiladores/material-template es noop cuando la receta vuelve tal
# como salió del GET. Lo que viaja por JSON cambia de tipo sin cambiar de
# contenido (double entero -> integer, NULL -> {}, vector -> lista) y antes eso
# bastaba para subir la revisión y dejar stale todas las fichas del operativo.

.cmtn_rows <- function() {
  list(
    list(
      selection_run_id = "selection-noop", classroom_id = "A-01",
      operational_code = "OP-01", label = "Aula 1", wave = "M1",
      faculty = "Ingenieria", course_id = "Calculo 1", schedule = "08:00",
      venue = "Pabellon A - 201", teacher = "Docente 1", eligible_n = 32,
      link = "https://kf.kobotoolbox.org/x/asset?d%5BcollectorID%5D=OP-01"
    )
  )
}

.cmtn_presets <- function() {
  list(
    ficha_aplicacion_a4_v1 = function() collection_material_builtin_template(),
    ficha_campo_qr_a4_v1 = function() collection_material_field_sheet_template(),
    afiche_qr_a4_v1 = function() collection_material_poster_template(assets = "pulso")
  )
}

# Sesión sembrada con la receta pedida como receta vigente y una instancia ready.
.cmtn_sid <- function(template = NULL) {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", .cmtn_rows())
  seeded <- collection_state_seed(sid)
  if (!is.null(template)) {
    session <- session_get(sid)
    session$collection_state$material_template <- template
    .session_env[[sid]] <- session
  }
  created <- collection_material_instance_create(sid, seeded$state_revision)
  testthat::expect_identical(created$instance$status, "ready")
  sid
}

.cmtn_call <- function(sid, method, body = "") {
  testthat::skip_if_not_installed("plumber")
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  raw_body <- charToRaw(body)
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  req <- as.environment(list(
    REQUEST_METHOD = method, PATH_INFO = "/api/recopiladores/material-template",
    QUERY_STRING = "", CONTENT_TYPE = "application/json",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid), rook.input = input
  ))
  r <- pr$call(req)
  list(status = as.integer(r$status), raw = as.character(r$body),
       body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
}

# El viaje que hace el editor: GET, JSON del lado cliente y de vuelta.
.cmtn_roundtrip <- function(template) {
  jsonlite::fromJSON(jsonlite::toJSON(template, auto_unbox = TRUE), simplifyVector = FALSE)
}

.cmtn_put <- function(sid, template, expected_revision) {
  body <- jsonlite::toJSON(
    list(template = template, expected_revision = expected_revision),
    auto_unbox = TRUE, null = "null", digits = NA
  )
  .cmtn_call(sid, "PUT", as.character(body))
}

.cmtn_statuses <- function(sid) {
  vapply(.cm_instances(session_get(sid)$collection_state), `[[`, character(1), "status")
}

.cmtn_expect_noop <- function(sid, label) {
  before <- session_get(sid)$collection_state
  got <- .cmtn_call(sid, "GET")
  expect_identical(got$status, 200L, info = label)
  put <- .cmtn_put(sid, .cmtn_roundtrip(got$body$template), got$body$state_revision)
  expect_identical(put$status, 200L, info = paste(label, substr(put$raw, 1, 300)))
  expect_true(isTRUE(put$body$noop), info = label)
  expect_identical(as.integer(put$body$state_revision), as.integer(before$state_revision), info = label)
  after <- session_get(sid)$collection_state
  expect_identical(after$state_revision, before$state_revision, info = label)
  expect_identical(after$material_template, before$material_template, info = label)
  expect_identical(.cm_material_template(after)$template_sha256, .cm_material_template(before)$template_sha256, info = label)
  expect_true(all(.cmtn_statuses(sid) == "ready"), info = label)
}

test_that("la receta de fábrica sin personalizar vuelve por el PUT como noop", {
  sid <- .cmtn_sid()
  on.exit(session_delete(sid), add = TRUE)
  expect_true(isTRUE(.cmtn_call(sid, "GET")$body$builtin))
  .cmtn_expect_noop(sid, "builtin")
})

test_that("cada preset de fábrica vuelve por el PUT como noop", {
  presets <- .cmtn_presets()
  for (preset_id in names(presets)) {
    sid <- .cmtn_sid(presets[[preset_id]]())
    .cmtn_expect_noop(sid, preset_id)
    session_delete(sid)
  }
})

test_that("una receta guardada vuelve por el PUT como noop", {
  sid <- .cmtn_sid()
  on.exit(session_delete(sid), add = TRUE)
  got <- .cmtn_call(sid, "GET")
  edited <- .cmtn_roundtrip(got$body$template)
  edited$pages[[1]]$blocks[[7]]$text <- "Escanea y sigue las indicaciones del equipo de campo."
  saved <- .cmtn_put(sid, edited, got$body$state_revision)
  expect_identical(saved$status, 200L, info = substr(saved$raw, 1, 300))
  expect_false(saved$body$noop)
  # La edición real deja stale la ficha vieja; se rehace para partir de ready.
  expect_true(all(.cmtn_statuses(sid) == "stale"))
  session <- session_get(sid)
  session$collection_state$material_instances <- list()
  .session_env[[sid]] <- session
  collection_material_instance_create(sid, session$collection_state$state_revision)
  .cmtn_expect_noop(sid, "guardada")
})

test_that("un cambio real de un valor numérico no es noop y deja stale las fichas", {
  sid <- .cmtn_sid(collection_material_field_sheet_template())
  on.exit(session_delete(sid), add = TRUE)
  got <- .cmtn_call(sid, "GET")
  template <- .cmtn_roundtrip(got$body$template)
  # Un mm de más en el primer bloque con min_size_mm: mismo tipo que llega por JSON.
  hit <- NULL
  for (p in seq_along(template$pages)) for (b in seq_along(template$pages[[p]]$blocks)) {
    if (is.null(hit) && !is.null(template$pages[[p]]$blocks[[b]]$min_size_mm)) hit <- c(p, b)
  }
  expect_false(is.null(hit))
  template$pages[[hit[1]]]$blocks[[hit[2]]]$min_size_mm <-
    template$pages[[hit[1]]]$blocks[[hit[2]]]$min_size_mm + 1L
  # Directo al motor: la comparación es la que decide, antes de cualquier validación.
  expect_false(identical(
    .cm_template_comparable(template),
    .cm_template_comparable(.cm_material_template(session_get(sid)$collection_state))
  ))
  # El mismo cambio en double tampoco se confunde con la receta vigente.
  template$pages[[hit[1]]]$blocks[[hit[2]]]$min_size_mm <-
    as.double(template$pages[[hit[1]]]$blocks[[hit[2]]]$min_size_mm) + 0.5
  expect_false(identical(
    .cm_template_comparable(template),
    .cm_template_comparable(.cm_material_template(session_get(sid)$collection_state))
  ))
})

test_that("un cambio real por HTTP sube la revisión y deja stale las fichas", {
  sid <- .cmtn_sid()
  on.exit(session_delete(sid), add = TRUE)
  before <- session_get(sid)$collection_state
  got <- .cmtn_call(sid, "GET")
  template <- .cmtn_roundtrip(got$body$template)
  hit <- which(vapply(template$pages[[1]]$blocks, function(b) !is.null(b$min_size_mm), logical(1)))[1]
  expect_false(is.na(hit))
  template$pages[[1]]$blocks[[hit]]$min_size_mm <- template$pages[[1]]$blocks[[hit]]$min_size_mm + 1L
  put <- .cmtn_put(sid, template, got$body$state_revision)
  expect_identical(put$status, 200L, info = substr(put$raw, 1, 300))
  expect_false(put$body$noop)
  after <- session_get(sid)$collection_state
  expect_identical(after$state_revision, before$state_revision + 1L)
  expect_identical(after$material_template$revision, .cm_material_template(before)$revision + 1L)
  expect_true(all(.cmtn_statuses(sid) == "stale"))
})
