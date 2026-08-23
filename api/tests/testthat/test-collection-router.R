test_that("router de Recopiladores declara exactamente las catorce rutas V1", {
  source_path <- test_path("..", "..", "R", "router_recopiladores.R")
  text <- paste(readLines(source_path, warn = FALSE), collapse = "\n")
  routes <- regmatches(
    text,
    gregexpr("/api/recopiladores[[:alnum:]_/-]*", text, perl = TRUE)
  )[[1]]
  expect_setequal(unique(routes), c(
    "/api/recopiladores/state",
    "/api/recopiladores/seed",
    # Rehacer el plan con el sorteo vigente. Se anadio al reparar el plan de
    # recoleccion desfasado y esta lista cerrada no se actualizo con el: el rojo
    # vivio varios commits porque los gates iban filtrados por area y este
    # archivo no entraba en ninguno de los filtros que se usaron.
    "/api/recopiladores/reseed",
    "/api/recopiladores/plan",
    "/api/recopiladores/deployment",
    "/api/recopiladores/deployment/prepare",
    "/api/recopiladores/reconcile",
    "/api/recopiladores/handoff",
    "/api/recopiladores/material-template",
    "/api/recopiladores/materials/instances",
    "/api/recopiladores/materials/render",
    "/api/recopiladores/provider-preflight",
    "/api/recopiladores/deployment/preview"
  ))
  expect_false(grepl("httr|curl|POST.*https|PATCH.*https|DELETE.*https", text, ignore.case = TRUE))
  expect_match(text, 'pr_get\\("/api/recopiladores/material-template"')
  expect_match(text, 'pr_handle\\("PUT", "/api/recopiladores/material-template"')
  expect_match(text, 'pr_post\\("/api/recopiladores/provider-preflight"')
  expect_match(text, 'pr_post\\("/api/recopiladores/deployment/preview"')
  expect_match(text, 'pr_post\\("/api/recopiladores/reseed"')
})

test_that("router parsea JSON y exige body explícito en PUT", {
  req <- list(bodyRaw = charToRaw('{"expected_revision":1,"plan":{"schema":"collection_plan/v1"}}'))
  parsed <- .collection_parse_body(req)
  expect_identical(parsed$expected_revision, 1L)
  expect_identical(parsed$plan$schema, "collection_plan/v1")

  bad <- tryCatch(
    .collection_parse_body(list(bodyRaw = charToRaw("{"))),
    error = function(e) e
  )
  expect_s3_class(bad, "api_error")
  expect_identical(bad$code, "E_COLLECTION_BAD_JSON")
})

test_that("plumber_app monta Recopiladores solo en runtime privado", {
  source_path <- test_path("..", "..", "R", "plumber_app.R")
  lines <- readLines(source_path, warn = FALSE)
  mount_line <- grep("mount_recopiladores", lines)
  public_branch <- grep("if (is_public_mode())", lines, fixed = TRUE)
  private_else <- grep("} else {", lines, fixed = TRUE)
  expect_length(mount_line, 1L)
  expect_true(mount_line > private_else[[1]])
  expect_true(mount_line > min(public_branch))
})

test_that("preflight y preview de provider usan solo el registry puro", {
  adapter <- .collection_adapter_or_stop("kobo_existing_v1")
  inspected <- adapter$inspect_target(
    connection_ref = list(connection_profile_id = "profile-1"),
    target_ref = list(
      provider = "kobo", asset_uid = "asset-1", asset_type = "survey",
      deployment_active = TRUE, base_access_url = "https://kf.kobotoolbox.org/x/form",
      prefill_field = "collectorID"
    )
  )
  preflight <- adapter$capability_preflight(
    operation = "local_generation",
    target = list(target = inspected$target)
  )
  expect_identical(inspected$mode, "read_only")
  expect_true(is.list(preflight))

  plan <- list(
    schema = "collection_plan/v1", plan_id = "plan-preview",
    adapter = list(id = "kobo_existing_v1", version = 1L),
    units = list(list(unit_id = "unit-1", label = "Unidad 1", link_key = "U1"))
  )
  preview <- adapter$preview_deployment(plan, inspected$target)
  expect_identical(preview$target$provider, "kobo")
  expect_false(isTRUE(preview$capabilities$remote_write$observed))

  unknown <- tryCatch(.collection_adapter_or_stop("desconocido"), error = function(e) e)
  expect_s3_class(unknown, "api_error")
  expect_identical(unknown$code, "E_COLLECTION_ADAPTER_UNKNOWN")
})
