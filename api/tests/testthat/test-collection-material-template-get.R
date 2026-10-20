# GET /api/recopiladores/material-template sirve la receta sin sus NULL. La
# ficha de campo declara `lines = NULL` / `note = NULL` en form_lines; con el
# serializador de la API salían como `{}`, el editor los devolvía como objetos y
# un PUT con una edición real caía en 422 (bad_form_lines_count, bad_text).

.cmtg_sid <- function(template) {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", list(list(
    selection_run_id = "selection-get", classroom_id = "A-01",
    operational_code = "OP-01", label = "Aula 1", wave = "M1",
    faculty = "Ingenieria", course_id = "Calculo 1", schedule = "08:00",
    venue = "Pabellon A - 201", teacher = "Docente 1", eligible_n = 32,
    link = "https://kf.kobotoolbox.org/x/asset?d%5BcollectorID%5D=OP-01"
  )))
  collection_state_seed(sid)
  session <- session_get(sid)
  session$collection_state$material_template <- template
  .session_env[[sid]] <- session
  sid
}

.cmtg_call <- function(sid, method, body = "") {
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

.cmtg_put <- function(sid, template, expected_revision) {
  body <- jsonlite::toJSON(
    list(template = template, expected_revision = expected_revision),
    auto_unbox = TRUE, null = "null", digits = NA
  )
  .cmtg_call(sid, "PUT", as.character(body))
}

.cmtg_form_lines <- function(template) {
  for (p in seq_along(template$pages)) for (b in seq_along(template$pages[[p]]$blocks)) {
    if (identical(template$pages[[p]]$blocks[[b]]$type, "form_lines")) return(c(p, b))
  }
  NULL
}

test_that("la receta de la ficha de campo sale por el GET sin `{}` en lugar de nulos", {
  template <- collection_material_field_sheet_template()
  # Precondición: la receta de fábrica sí trae NULL que el serializador vuelve `{}`.
  expect_match(as.character(jsonlite::toJSON(template, auto_unbox = TRUE)), "\"lines\":\\{\\}")
  sid <- .cmtg_sid(template)
  on.exit(session_delete(sid), add = TRUE)
  got <- .cmtg_call(sid, "GET")
  expect_identical(got$status, 200L)
  expect_false(grepl("{}", got$raw, fixed = TRUE), info = substr(got$raw, 1, 300))
  # Lo persistido y su sha no cambian por servirlo.
  stored <- session_get(sid)$collection_state$material_template
  expect_identical(stored, template)
  expect_identical(got$body$template$template_sha256, template$template_sha256)
})

test_that("editar un texto de la ficha de campo tras el GET guarda con 200 y no es noop", {
  sid <- .cmtg_sid(collection_material_field_sheet_template())
  on.exit(session_delete(sid), add = TRUE)
  got <- .cmtg_call(sid, "GET")
  edited <- got$body$template
  hit <- .cmtg_form_lines(edited)
  expect_false(is.null(hit))
  field <- edited$pages[[hit[1]]]$blocks[[hit[2]]]$rows[[1]]$fields[[1]]
  expect_identical(field$label, "Facultad")
  expect_null(field$lines)
  edited$pages[[hit[1]]]$blocks[[hit[2]]]$rows[[1]]$fields[[1]]$label <- "Facultad o escuela"
  put <- .cmtg_put(sid, edited, got$body$state_revision)
  expect_identical(put$status, 200L, info = substr(put$raw, 1, 400))
  expect_false(isTRUE(put$body$noop))
  after <- session_get(sid)$collection_state
  expect_identical(after$state_revision, as.integer(got$body$state_revision) + 1L)
  saved <- after$material_template$pages[[hit[1]]]$blocks[[hit[2]]]$rows[[1]]$fields[[1]]
  expect_identical(saved$label, "Facultad o escuela")
  expect_identical(after$material_template$template_sha256, .cm_template_sha256(after$material_template))
})

test_that("GET -> PUT sin cambios de la ficha de campo sigue siendo noop", {
  template <- collection_material_field_sheet_template()
  sid <- .cmtg_sid(template)
  on.exit(session_delete(sid), add = TRUE)
  before <- session_get(sid)$collection_state
  got <- .cmtg_call(sid, "GET")
  put <- .cmtg_put(sid, got$body$template, got$body$state_revision)
  expect_identical(put$status, 200L, info = substr(put$raw, 1, 400))
  expect_true(isTRUE(put$body$noop))
  after <- session_get(sid)$collection_state
  expect_identical(after$state_revision, before$state_revision)
  expect_identical(after$material_template, template)
})

test_that("la respuesta del PUT sale sin `{}` y se reusa tal cual en el siguiente PUT", {
  template <- collection_material_field_sheet_template()
  sid <- .cmtg_sid(template)
  on.exit(session_delete(sid), add = TRUE)
  got <- .cmtg_call(sid, "GET")
  noop <- .cmtg_put(sid, got$body$template, got$body$state_revision)
  expect_identical(noop$status, 200L, info = substr(noop$raw, 1, 400))
  expect_true(isTRUE(noop$body$noop))
  expect_false(grepl("{}", noop$raw, fixed = TRUE), info = substr(noop$raw, 1, 300))
  expect_identical(session_get(sid)$collection_state$material_template, template)
  # El editor toma la receta de la respuesta del PUT, la edita y vuelve a guardar.
  edited <- noop$body$template
  hit <- .cmtg_form_lines(edited)
  edited$pages[[hit[1]]]$blocks[[hit[2]]]$rows[[1]]$fields[[1]]$label <- "Facultad o escuela"
  saved <- .cmtg_put(sid, edited, noop$body$state_revision)
  expect_identical(saved$status, 200L, info = substr(saved$raw, 1, 400))
  expect_false(isTRUE(saved$body$noop))
  expect_false(grepl("{}", saved$raw, fixed = TRUE), info = substr(saved$raw, 1, 300))
  # Y la respuesta del guardado también se reusa: vuelve como noop.
  again <- .cmtg_put(sid, saved$body$template, saved$body$state_revision)
  expect_identical(again$status, 200L, info = substr(again$raw, 1, 400))
  expect_true(isTRUE(again$body$noop))
})
