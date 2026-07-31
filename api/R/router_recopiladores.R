# Router propio de Recopiladores (ADR 0046, unidades 5-7).
# Valida la forma HTTP y delega todas las transiciones al engine.

.collection_parse_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw)) {
    rawToChar(req$bodyRaw)
  } else {
    req$postBody %||% "{}"
  }
  Encoding(body_raw) <- "UTF-8"
  if (!nzchar(trimws(body_raw))) body_raw <- "{}"
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_COLLECTION_BAD_JSON", "El body no contiene JSON válido.")
  )
}

.collection_adapter_or_stop <- function(adapter_id) {
  adapter <- collection_adapter_get(adapter_id)
  if (is.null(adapter)) {
    stop_api(422, "E_COLLECTION_ADAPTER_UNKNOWN", "adapter_id no pertenece al registry V1 de Recopiladores.")
  }
  adapter
}

mount_recopiladores <- function(pr) {
  pr |>
    plumber::pr_get("/api/recopiladores/state", wrap_endpoint(function(req, res, ...) {
      collection_state_get(session_header(req))
    })) |>
    plumber::pr_post("/api/recopiladores/seed", wrap_endpoint(function(req, res, ...) {
      collection_state_seed(session_header(req))
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/plan", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_plan_put(
        session_header(req),
        plan = body$plan %||% body$collection_plan,
        expected_revision = body$expected_revision
      )
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/deployment", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_deployment_put(
        session_header(req),
        deployment = body$deployment %||% body$collection_deployment,
        expected_revision = body$expected_revision
      )
    })) |>
    plumber::pr_post("/api/recopiladores/deployment/prepare", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_deployment_prepare(
        session_header(req),
        expected_revision = body$expected_revision,
        deployment = body$deployment %||% body$collection_deployment
      )
    })) |>
    plumber::pr_post("/api/recopiladores/reconcile", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_reconcile(
        session_header(req),
        expected_revision = body$expected_revision,
        observed = body$observed %||% list(
          plan_fingerprint = body$plan_fingerprint,
          instrument_sha256 = body$instrument_sha256,
          target_fingerprint = body$target_fingerprint,
          target = body$target,
          remote_ref = body$remote_ref
        )
      )
    })) |>
    plumber::pr_post("/api/recopiladores/handoff", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_handoff(
        session_header(req),
        expected_revision = body$expected_revision,
        deployment_fingerprint = body$deployment_fingerprint
      )
    })) |>
    plumber::pr_get("/api/recopiladores/material-template", wrap_endpoint(function(req, res, ...) {
      collection_material_template_get(session_header(req))
    })) |>
    plumber::pr_handle("PUT", "/api/recopiladores/material-template", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_template_put(
        session_header(req),
        template = body$template,
        expected_revision = body$expected_revision
      )
    })) |>
    plumber::pr_post("/api/recopiladores/materials/instances", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_instance_create(
        session_header(req),
        expected_revision = body$expected_revision,
        unit_refs = body$unit_refs,
        access_refs = body$access_refs,
        locale = body$locale %||% "es-PE"
      )
    })) |>
    plumber::pr_post("/api/recopiladores/materials/render", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      collection_material_render_start(
        session_header(req),
        instance_id = body$instance_id,
        format = body$format,
        page = body$page %||% 1L,
        resolved_access = body$resolved_access,
        audience = body$audience %||% "field_team"
      )
    })) |>
    plumber::pr_post("/api/recopiladores/provider-preflight", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      adapter <- .collection_adapter_or_stop(body$adapter_id)
      inspected <- adapter$inspect_target(
        connection_ref = body$connection_ref %||% list(),
        target_ref = body$target_ref %||% list()
      )
      preflight <- adapter$capability_preflight(
        operation = body$operation,
        target = list(
          connection_ref = body$connection_ref %||% list(),
          target = body$target_ref %||% list()
        )
      )
      list(
        ok = isTRUE(inspected$ok) && isTRUE(preflight$ok),
        adapter_id = body$adapter_id,
        inspect_target = inspected,
        capability_preflight = preflight
      )
    })) |>
    plumber::pr_post("/api/recopiladores/deployment/preview", wrap_endpoint(function(req, res, ...) {
      body <- .collection_parse_body(req)
      sid <- session_header(req)
      adapter <- .collection_adapter_or_stop(body$adapter_id)
      plan <- body$plan %||% .collection_current(session_get(sid))$plan
      preview <- adapter$preview_deployment(plan = plan, target = body$target %||% list())
      list(ok = TRUE, adapter_id = body$adapter_id, deployment = preview)
    }))
}
