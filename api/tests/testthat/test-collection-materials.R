.cmt_legacy_rows <- function() {
  list(
    list(
      selection_run_id = "selection-materials", classroom_id = "A-01",
      operational_code = "OP-01", label = "Aula 1", wave = "M1",
      faculty = "Ingenieria", course_id = "Calculo 1", schedule = "08:00",
      venue = "Pabellon A - 201", teacher = "Docente 1", eligible_n = 32,
      link = "https://kf.kobotoolbox.org/x/asset?d%5BcollectorID%5D=OP-01"
    ),
    list(
      selection_run_id = "selection-materials", classroom_id = "A-02",
      operational_code = "OP-02", label = "Aula 2", wave = "M1",
      faculty = "Derecho", course_id = "Derecho 1", schedule = "10:00",
      venue = "Pabellon B - 101", teacher = "Docente 2", eligible_n = 28,
      link = "https://kf.kobotoolbox.org/x/asset?d%5BcollectorID%5D=OP-02"
    )
  )
}

.cmt_seed <- function() {
  sid <- session_create()
  session_set(sid, "monitoreo_aulas_plan", .cmt_legacy_rows())
  seeded <- collection_state_seed(sid)
  list(sid = sid, seeded = seeded)
}

.cmt_error <- function(expr) tryCatch(expr, error = function(e) e)

test_that("el built-in congela los tres contratos V1 y reproduce el registro cerrado", {
  template <- collection_material_builtin_template()
  expect_true(collection_material_template_validate(template)$ok)
  expect_identical(template$schema, "collection_material_template/v1")
  expect_identical(template$preset_id, "ficha_aplicacion_a4_v1")
  expect_match(template$template_sha256, "^sha256:[0-9a-f]{64}$")
  expect_identical(template, collection_material_builtin_template())

  # "Congela" se prueba fijando la lista literal, no comparando contra un
  # registro: el vocabulario global es la union de los presets y el del preset
  # incluye bloques opcionales (careta, etiqueta de estado) que esta ficha no
  # usa. Comparar contra cualquiera de los dos hace fallar el test cada vez que
  # se agrega una opcion, sin que el built-in haya cambiado.
  types <- vapply(template$pages[[1]]$blocks, `[[`, character(1), "type")
  expect_identical(types, c(
    "brand_header", "heading", "body", "access_qr", "field_grid",
    "divider", "instructions", "application_log", "footer"
  ))
  expect_true(all(types %in% COLLECTION_MATERIAL_PRESETS$ficha_aplicacion_a4_v1$blocks))
  expect_true(all(vapply(
    template$pages[[1]]$blocks,
    function(block) isTRUE(block$type != "access_qr") || identical(block$binding, "access.qr_payload"),
    logical(1)
  )))
})

test_that("templates rechazan HTML JS CSS expresiones URLs y bindings fuera de allowlist", {
  cases <- list(
    function(x) { x$pages[[1]]$blocks[[2]]$text <- "<b>inyectado</b>"; x },
    function(x) { x$pages[[1]]$blocks[[2]]$text <- "javascript:alert(1)"; x },
    function(x) { x$pages[[1]]$blocks[[2]]$text <- "${project.secret}"; x },
    function(x) { x$pages[[1]]$blocks[[2]]$text <- "https://fuente-remota.test"; x },
    function(x) { x$pages[[1]]$blocks[[2]]$binding <- "project.secret"; x },
    function(x) { x$pages[[1]]$blocks[[2]]$css <- "position:fixed"; x },
    function(x) { x$pages[[1]]$blocks[[4]]$binding <- "unit.label"; x }
  )
  for (mutate in cases) {
    bad <- .cm_template_normalize(mutate(collection_material_builtin_template()))
    result <- collection_material_template_validate(bad)
    expect_false(result$ok)
    expect_gt(length(result$problems), 0L)
  }
})

test_that("PUT de template usa expected_revision y marca instancias stale", {
  fx <- .cmt_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  created <- collection_material_instance_create(fx$sid, fx$seeded$state_revision)
  expect_identical(created$instance$status, "ready")
  expect_true(collection_material_instance_validate(created$instance)$ok)

  edited <- collection_material_builtin_template()
  edited$pages[[1]]$blocks[[7]]$text <- "Escanea y sigue las indicaciones del equipo de campo."
  updated <- collection_material_template_put(fx$sid, edited, created$state_revision)
  expect_false(updated$noop)
  # Relativo a la built-in, no literal: lo que se prueba es que un PUT avanza la
  # revision, no en cual arranca la plantilla de la casa.
  expect_identical(updated$template$revision, collection_material_builtin_template()$revision + 1L)
  expect_false(identical(updated$template$template_sha256, created$instance$template_ref$sha256))

  state <- session_get(fx$sid)$collection_state
  expect_identical(state$material_instances[[1]]$status, "stale")
  expect_true("template_changed" %in% vapply(
    state$material_instances[[1]]$warnings, `[[`, character(1), "code"
  ))

  stale <- .cmt_error(collection_material_render_snapshot(
    fx$sid, created$instance$instance_id
  ))
  expect_s3_class(stale, "api_error")
  expect_identical(stale$code, "E_COLLECTION_MATERIAL_INSTANCE_STALE")
})

test_that("instancia fingerprints template deployment y access", {
  fx <- .cmt_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  created <- collection_material_instance_create(fx$sid, fx$seeded$state_revision)
  instance <- created$instance
  expect_match(instance$deployment_fingerprint, "^sha256:[0-9a-f]{64}$")
  expect_match(instance$access_fingerprint, "^sha256:[0-9a-f]{64}$")
  expect_match(instance$instance_fingerprint, "^sha256:[0-9a-f]{64}$")

  session <- session_get(fx$sid)
  session$collection_state$deployment$bindings[[1]]$access_ref <- "https://kf.kobotoolbox.org/x/changed"
  session$collection_state$deployment$deployment_fingerprint <-
    .collection_deployment_fingerprint(session$collection_state$deployment)
  .session_env[[fx$sid]] <- session

  stale <- .cmt_error(collection_material_render_snapshot(fx$sid, instance$instance_id))
  expect_s3_class(stale, "api_error")
  expect_identical(stale$code, "E_COLLECTION_MATERIAL_INSTANCE_STALE")
  expect_true(any(c("deployment_changed", "access_changed") %in% unlist(stale$details$reasons)))
})

test_that("resolved_access restricted es transitorio y nunca entra a collection_state", {
  fx <- .cmt_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  session <- session_get(fx$sid)
  session$collection_state$deployment$sensitivity$access_urls <- "restricted"
  for (i in seq_along(session$collection_state$deployment$bindings)) {
    session$collection_state$deployment$bindings[[i]]$access_ref <- paste0("external-ref:", i)
  }
  session$collection_state$deployment$deployment_fingerprint <-
    .collection_deployment_fingerprint(session$collection_state$deployment)
  .session_env[[fx$sid]] <- session

  created <- collection_material_instance_create(fx$sid, fx$seeded$state_revision)
  access_id <- created$instance$access_refs[[1]]
  secret_url <- "https://private.example.test/respond?bearer=abc123"
  snapshot <- collection_material_render_snapshot(
    fx$sid, created$instance$instance_id,
    resolved_access = setNames(list(secret_url), access_id)
  )
  expect_identical(snapshot$resolved_access[[access_id]], secret_url)

  persisted <- paste(capture.output(str(session_get(fx$sid)$collection_state)), collapse = "\n")
  expect_false(grepl("private.example.test|bearer=abc123", persisted, fixed = FALSE))
  expect_false(grepl("data:(image|application)/", persisted, ignore.case = TRUE))
  expect_true(collection_state_validate(session_get(fx$sid)$collection_state)$ok)
})

test_that("una unidad sin acceso queda advertida pero sigue siendo compilable", {
  fx <- .cmt_seed()
  on.exit(session_delete(fx$sid), add = TRUE)
  session <- session_get(fx$sid)
  session$collection_state$deployment$bindings <- session$collection_state$deployment$bindings[1]
  session$collection_state$deployment$coverage$units_with_access <- 1L
  session$collection_state$deployment$coverage$units_missing_access <- 1L
  session$collection_state$deployment$status <- "draft"
  session$collection_state$deployment$deployment_fingerprint <-
    .collection_deployment_fingerprint(session$collection_state$deployment)
  .session_env[[fx$sid]] <- session

  created <- collection_material_instance_create(fx$sid, fx$seeded$state_revision)
  expect_true(any(vapply(created$instance$warnings, function(x) identical(x$code, "access_missing"), logical(1))))
  snapshot <- collection_material_render_snapshot(fx$sid, created$instance$instance_id)
  compiled <- do.call(collection_material_compile, snapshot[c(
    "template", "instance", "project", "plan", "deployment", "resolved_access"
  )])
  expect_identical(compiled$page_count, 2L)
  expect_true(any(vapply(compiled$warnings, function(x) identical(x$code, "access_missing"), logical(1))))
  expect_true(all(!vapply(compiled$pages, function(page) isTRUE(page$overflow), logical(1))))
})

test_that("recibo es el unico manifest y no admite payload sensible", {
  template <- collection_material_builtin_template()
  receipt <- list(
    schema = "collection_artifact_receipt/v1",
    receipt_id = "receipt-1", artifact_id = "artifact-1", instance_id = "material-1",
    deployment_id = "deployment-1", plan_fingerprint = paste0("sha256:", strrep("1", 64)),
    deployment_fingerprint = paste0("sha256:", strrep("2", 64)),
    template_ref = list(template_id = template$template_id, revision = 1L, sha256 = template$template_sha256),
    layout_fingerprint = paste0("sha256:", strrep("3", 64)),
    file_id = "file-1", media_type = "application/pdf", filename = "fichas.pdf",
    sha256 = paste0("sha256:", strrep("4", 64)), size_bytes = 123L, page_count = 1L,
    page_map = list(list(page = 1L, unit_id = "unit-1", access_id = "access-1")),
    generator = list(
      id = "collection-material-renderer", version = 1L,
      fingerprint = paste0("sha256:", strrep("5", 64))
    ),
    audience = "field_team", sensitivity = "operational"
  )
  expect_true(collection_artifact_receipt_validate(receipt)$ok)
  expect_false("manifest" %in% names(receipt))

  unsafe <- receipt
  unsafe$access_token <- "secret"
  expect_false(collection_artifact_receipt_validate(unsafe)$ok)
})
