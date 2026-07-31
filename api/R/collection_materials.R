# Contratos y estado de materiales de Recopiladores (ADR 0046, unidades 11-13).
#
# Esta capa conserva solo recetas, referencias y recibos. Los valores de acceso
# restringidos se resuelven al construir el snapshot efimero del job y nunca se
# escriben en collection_state/v1.

COLLECTION_MATERIAL_TEMPLATE_SCHEMA <- "collection_material_template/v1"
COLLECTION_MATERIAL_INSTANCE_SCHEMA <- "collection_material_instance/v1"
COLLECTION_ARTIFACT_RECEIPT_SCHEMA <- "collection_artifact_receipt/v1"

COLLECTION_MATERIAL_BLOCK_TYPES <- c(
  "brand_header", "heading", "body", "access_qr", "field_grid",
  "instructions", "application_log", "divider", "footer"
)

COLLECTION_MATERIAL_BINDINGS <- c(
  "project.name", "project.period",
  "deployment.deployment_id", "deployment.provider",
  "unit.unit_id", "unit.label", "unit.role", "unit.group",
  "unit.faculty", "unit.course_name", "unit.schedule", "unit.venue",
  "unit.teacher", "unit.sample_label", "unit.eligible_n",
  "access.access_id", "access.logical_collector_id", "access.qr_payload"
)

.cm_problem <- function(path, code, detail) {
  list(path = path, code = code, detail = detail)
}

.cm_template_material <- function(template) {
  material <- template
  material$template_sha256 <- NULL
  material
}

.cm_template_sha256 <- function(template) {
  collection_fingerprint(.cm_template_material(template))
}

.cm_plain_text_problem <- function(value, path) {
  if (is.null(value)) return(list())
  if (!is.character(value) || length(value) != 1L || is.na(value)) {
    return(list(.cm_problem(path, "bad_text", "El texto debe ser un string escalar.")))
  }
  forbidden <- grepl("<[^>]+>|javascript:|https?://|\\{\\{|\\$\\{|=>|window\\.|document\\.", value,
                     ignore.case = TRUE, perl = TRUE)
  if (forbidden) {
    return(list(.cm_problem(
      path, "unsafe_text",
      "El copy del material no admite HTML, CSS, JS, expresiones ni URLs arbitrarias."
    )))
  }
  list()
}

.cm_binding_problem <- function(binding, path) {
  if (!.cc_is_scalar_string(binding) || !(binding %in% COLLECTION_MATERIAL_BINDINGS)) {
    return(list(.cm_problem(
      path, "binding_not_allowed",
      sprintf("Binding no permitido. Use solo: %s.", paste(COLLECTION_MATERIAL_BINDINGS, collapse = ", "))
    )))
  }
  list()
}

.cm_allowed_block_fields <- function(type) {
  common <- c("block_id", "type", "required")
  specific <- switch(type,
    brand_header = c("text"),
    heading = c("binding", "text", "max_lines"),
    body = c("binding", "text", "max_lines"),
    access_qr = c("binding", "correction", "quiet_zone", "min_size_mm"),
    field_grid = c("fields"),
    instructions = c("binding", "text", "max_lines"),
    application_log = c("rows", "text"),
    divider = character(0),
    footer = c("binding", "text"),
    character(0)
  )
  c(common, specific)
}

.cm_block_problems <- function(block, path) {
  if (!is.list(block)) {
    return(list(.cm_problem(path, "not_object", "Cada bloque debe ser un objeto.")))
  }
  problems <- list()
  type <- block$type
  if (!.cc_is_scalar_string(block$block_id)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".block_id"), "missing_block_id", "block_id es obligatorio."
    )
  }
  if (!.cc_is_scalar_string(type) || !(type %in% COLLECTION_MATERIAL_BLOCK_TYPES)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".type"), "block_type_not_allowed",
      sprintf("Tipo de bloque no permitido. Registro V1: %s.", paste(COLLECTION_MATERIAL_BLOCK_TYPES, collapse = ", "))
    )
    return(problems)
  }
  unknown <- setdiff(names(block) %||% character(0), .cm_allowed_block_fields(type))
  for (field in unknown) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".", field), "block_field_not_allowed",
      sprintf("`%s` no pertenece al contrato cerrado del bloque `%s`.", field, type)
    )
  }
  if (!is.null(block$required) && !is.logical(block$required)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0(path, ".required"), "bad_required", "required debe ser booleano."
    )
  }
  if (!is.null(block$text)) {
    problems <- c(problems, .cm_plain_text_problem(block$text, paste0(path, ".text")))
  }
  if (!is.null(block$binding)) {
    problems <- c(problems, .cm_binding_problem(block$binding, paste0(path, ".binding")))
  }
  if (identical(type, "access_qr")) {
    if (!identical(block$binding, "access.qr_payload")) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".binding"), "qr_binding_protected",
        "access_qr solo puede resolver access.qr_payload por access_id."
      )
    }
    correction <- as.character(block$correction %||% "M")[[1]]
    if (!(correction %in% c("L", "M", "Q", "H"))) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".correction"), "bad_qr_correction", "Correccion QR permitida: L, M, Q o H."
      )
    }
    quiet <- suppressWarnings(as.integer(block$quiet_zone %||% 4L))
    size <- suppressWarnings(as.numeric(block$min_size_mm %||% 35))
    if (is.na(quiet) || quiet < 4L || quiet > 12L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".quiet_zone"), "bad_qr_quiet_zone", "quiet_zone debe estar entre 4 y 12 modulos."
      )
    }
    if (is.na(size) || size < 28 || size > 70) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".min_size_mm"), "bad_qr_size", "min_size_mm debe estar entre 28 y 70 mm."
      )
    }
  }
  if (identical(type, "field_grid")) {
    fields <- block$fields
    if (!is.list(fields) || !length(fields)) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".fields"), "missing_fields", "field_grid exige una lista de campos."
      )
    } else {
      for (i in seq_along(fields)) {
        field_path <- sprintf("%s.fields[%d]", path, i)
        field <- fields[[i]]
        binding <- if (is.character(field)) field else if (is.list(field)) field$binding else NULL
        problems <- c(problems, .cm_binding_problem(binding, paste0(field_path, ".binding")))
        if (is.list(field)) {
          unknown_field <- setdiff(names(field) %||% character(0), c("label", "binding"))
          for (nm in unknown_field) {
            problems[[length(problems) + 1L]] <- .cm_problem(
              paste0(field_path, ".", nm), "field_property_not_allowed",
              "Cada campo solo admite label y binding."
            )
          }
          problems <- c(problems, .cm_plain_text_problem(field$label %||% "", paste0(field_path, ".label")))
        }
      }
    }
  }
  if (!is.null(block$max_lines)) {
    lines <- suppressWarnings(as.integer(block$max_lines))
    if (is.na(lines) || lines < 1L || lines > 12L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".max_lines"), "bad_max_lines", "max_lines debe estar entre 1 y 12."
      )
    }
  }
  if (identical(type, "application_log")) {
    rows <- suppressWarnings(as.integer(block$rows %||% 3L))
    if (is.na(rows) || rows < 1L || rows > 6L) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0(path, ".rows"), "bad_log_rows", "application_log admite entre 1 y 6 filas."
      )
    }
  }
  problems
}

#' Plantilla built-in que reproduce la ficha A4 de aulas.
#'
#' @return `collection_material_template/v1` determinista.
#' @export
collection_material_builtin_template <- function() {
  template <- list(
    schema = COLLECTION_MATERIAL_TEMPLATE_SCHEMA,
    template_id = "template-ficha-aplicacion-a4-v1",
    revision = 1L,
    preset_id = "ficha_aplicacion_a4_v1",
    material_kind = "application_sheet",
    compatible_adapters = list("aulas_v1"),
    page = list(size = "A4", orientation = "portrait"),
    pages = list(list(
      page_id = "ficha",
      layout_preset = "single_sheet",
      blocks = list(
        list(block_id = "brand", type = "brand_header"),
        list(block_id = "unit", type = "heading", binding = "unit.label", max_lines = 2L),
        list(block_id = "course", type = "body", binding = "unit.course_name", max_lines = 3L),
        list(
          block_id = "qr", type = "access_qr", binding = "access.qr_payload",
          required = TRUE, correction = "M", quiet_zone = 4L, min_size_mm = 35
        ),
        list(block_id = "details", type = "field_grid", fields = list(
          list(label = "Horario", binding = "unit.schedule"),
          list(label = "Salon", binding = "unit.venue"),
          list(label = "Docente", binding = "unit.teacher"),
          list(label = "Muestra", binding = "unit.sample_label"),
          list(label = "Estudiantes", binding = "unit.eligible_n")
        )),
        list(block_id = "rule", type = "divider"),
        list(
          block_id = "instructions", type = "instructions",
          text = "Escanea el QR para responder. Si no abre, digita el enlace visible.", max_lines = 4L
        ),
        list(block_id = "log", type = "application_log", text = "Registro de aplicacion", rows = 3L),
        list(block_id = "footer", type = "footer", binding = "project.period")
      )
    )),
    brand_ref = "pulso-default",
    sensitivity_policy = "operational"
  )
  template$template_sha256 <- .cm_template_sha256(template)
  template
}

#' Valida una plantilla semantica de materiales V1.
#'
#' @param template lista de plantilla.
#' @return lista `ok` y `problems`.
#' @export
collection_material_template_validate <- function(template) {
  if (!is.list(template)) {
    return(list(ok = FALSE, problems = list(.cm_problem(
      "template", "not_object", "La plantilla debe ser un objeto."
    ))))
  }
  problems <- list()
  allowed_template_fields <- c(
    "schema", "template_id", "revision", "preset_id", "material_kind",
    "compatible_adapters", "page", "pages", "brand_ref",
    "sensitivity_policy", "template_sha256"
  )
  for (field in setdiff(names(template) %||% character(0), allowed_template_fields)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0("template.", field), "template_field_not_allowed",
      sprintf("`%s` no pertenece al schema cerrado de template V1.", field)
    )
  }
  if (!identical(template$schema, COLLECTION_MATERIAL_TEMPLATE_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_MATERIAL_TEMPLATE_SCHEMA)
    )
  }
  for (field in c("template_id", "preset_id", "material_kind", "brand_ref", "sensitivity_policy")) {
    if (!.cc_is_scalar_string(template[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0("template.", field), "missing_string", sprintf("%s es obligatorio.", field)
      )
    }
  }
  if (!identical(template$preset_id, "ficha_aplicacion_a4_v1")) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.preset_id", "preset_not_allowed",
      "V1 solo compila el preset curado ficha_aplicacion_a4_v1."
    )
  }
  if (!identical(template$material_kind, "application_sheet")) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.material_kind", "material_kind_not_allowed", "V1 solo admite application_sheet."
    )
  }
  if (.cc_is_scalar_string(template$sensitivity_policy) &&
      !(template$sensitivity_policy %in% c("public", "operational", "restricted", "sensitive"))) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.sensitivity_policy", "bad_sensitivity", "Politica de sensibilidad no reconocida."
    )
  }
  if (!.cc_is_integer_ge(template$revision, 1L)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.revision", "bad_revision", "revision debe ser entero >= 1."
    )
  }
  adapters <- unlist(template$compatible_adapters %||% list(), use.names = FALSE)
  if (!length(adapters) || any(!vapply(as.list(adapters), .cc_is_scalar_string, logical(1)))) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.compatible_adapters", "bad_adapters", "Debe declarar al menos un adapter compatible."
    )
  }
  page <- template$page
  if (!is.list(page) || !identical(page$size, "A4") ||
      !(as.character(page$orientation %||% "")[[1]] %in% c("portrait", "landscape"))) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.page", "bad_page", "V1 admite A4 portrait o landscape."
    )
  }
  if (is.list(page)) {
    for (field in setdiff(names(page) %||% character(0), c("size", "orientation"))) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0("template.page.", field), "page_field_not_allowed",
        "page solo admite size y orientation en V1."
      )
    }
  }
  pages <- template$pages
  if (!is.list(pages) || !length(pages)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.pages", "missing_pages", "La plantilla necesita al menos una pagina."
    )
  } else {
    ids <- character(0)
    for (i in seq_along(pages)) {
      path <- sprintf("template.pages[%d]", i)
      page_spec <- pages[[i]]
      if (!is.list(page_spec)) {
        problems[[length(problems) + 1L]] <- .cm_problem(path, "not_object", "Cada pagina debe ser un objeto.")
        next
      }
      for (field in setdiff(names(page_spec) %||% character(0), c("page_id", "layout_preset", "blocks"))) {
        problems[[length(problems) + 1L]] <- .cm_problem(
          paste0(path, ".", field), "page_spec_field_not_allowed",
          "Cada pagina solo admite page_id, layout_preset y blocks."
        )
      }
      if (!.cc_is_scalar_string(page_spec$page_id)) {
        problems[[length(problems) + 1L]] <- .cm_problem(paste0(path, ".page_id"), "missing_page_id", "page_id es obligatorio.")
      } else {
        if (page_spec$page_id %in% ids) {
          problems[[length(problems) + 1L]] <- .cm_problem(paste0(path, ".page_id"), "duplicate_page_id", "page_id debe ser unico.")
        }
        ids <- c(ids, page_spec$page_id)
      }
      if (!identical(page_spec$layout_preset, "single_sheet")) {
        problems[[length(problems) + 1L]] <- .cm_problem(
          paste0(path, ".layout_preset"), "layout_not_allowed", "V1 solo admite single_sheet."
        )
      }
      blocks <- page_spec$blocks
      if (!is.list(blocks) || !length(blocks)) {
        problems[[length(problems) + 1L]] <- .cm_problem(paste0(path, ".blocks"), "missing_blocks", "La pagina necesita bloques.")
      } else {
        block_ids <- character(0)
        for (j in seq_along(blocks)) {
          block_path <- sprintf("%s.blocks[%d]", path, j)
          problems <- c(problems, .cm_block_problems(blocks[[j]], block_path))
          bid <- if (is.list(blocks[[j]])) blocks[[j]]$block_id else NULL
          if (.cc_is_scalar_string(bid)) {
            if (bid %in% block_ids) {
              problems[[length(problems) + 1L]] <- .cm_problem(
                paste0(block_path, ".block_id"), "duplicate_block_id", "block_id debe ser unico por pagina."
              )
            }
            block_ids <- c(block_ids, bid)
          }
        }
      }
    }
  }
  expected_sha <- .cm_template_sha256(template)
  if (!identical(template$template_sha256, expected_sha)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "template.template_sha256", "bad_template_sha256",
      "template_sha256 no coincide con la receta canonica."
    )
  }
  problems <- c(problems, .cc_security_problems(template, "template"))
  list(ok = length(problems) == 0L, problems = problems)
}

.cm_template_normalize <- function(template, revision = NULL) {
  if (!is.list(template)) return(template)
  candidate <- template
  if (!is.null(revision)) candidate$revision <- as.integer(revision)
  candidate$template_sha256 <- NULL
  candidate$template_sha256 <- .cm_template_sha256(candidate)
  candidate
}

.cm_material_template <- function(state) {
  state$material_template %||% collection_material_builtin_template()
}

.cm_instances <- function(state) {
  instances <- state$material_instances
  if (!is.list(instances)) list() else unname(Filter(is.list, instances))
}

.cm_receipts <- function(state) {
  receipts <- state$artifact_receipts
  if (!is.list(receipts)) list() else unname(Filter(is.list, receipts))
}

.cm_instance_find <- function(state, instance_id) {
  hits <- Filter(function(x) identical(x$instance_id, instance_id), .cm_instances(state))
  if (length(hits)) hits[[1]] else NULL
}

.cm_access_subset <- function(deployment, access_refs) {
  refs <- as.character(unlist(access_refs %||% list(), use.names = FALSE))
  Filter(function(binding) is.list(binding) && binding$access_id %in% refs,
         deployment$bindings %||% list())
}

.cm_access_fingerprint <- function(deployment, access_refs) {
  collection_fingerprint(.cm_access_subset(deployment, access_refs))
}

.cm_instance_fingerprint <- function(template_sha, deployment_fingerprint,
                                     access_fingerprint, unit_refs, access_refs) {
  collection_fingerprint(list(
    template_sha256 = template_sha,
    deployment_fingerprint = deployment_fingerprint,
    access_fingerprint = access_fingerprint,
    unit_refs = as.list(unit_refs),
    access_refs = as.list(access_refs)
  ))
}

#' Valida una instancia de material V1.
#'
#' @param instance lista de instancia.
#' @return lista `ok` y `problems`.
#' @export
collection_material_instance_validate <- function(instance) {
  if (!is.list(instance)) {
    return(list(ok = FALSE, problems = list(.cm_problem(
      "instance", "not_object", "La instancia debe ser un objeto."
    ))))
  }
  problems <- list()
  allowed_instance_fields <- c(
    "schema", "instance_id", "template_ref", "deployment_id",
    "deployment_fingerprint", "access_fingerprint", "instance_fingerprint",
    "unit_refs", "access_refs", "locale", "status", "sensitivity", "warnings"
  )
  for (field in setdiff(names(instance) %||% character(0), allowed_instance_fields)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0("instance.", field), "instance_field_not_allowed",
      sprintf("`%s` no puede persistirse en una instancia V1.", field)
    )
  }
  if (!identical(instance$schema, COLLECTION_MATERIAL_INSTANCE_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_MATERIAL_INSTANCE_SCHEMA))
  }
  for (field in c("instance_id", "deployment_id", "locale", "status", "sensitivity")) {
    if (!.cc_is_scalar_string(instance[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("instance.", field), "missing_string", sprintf("%s es obligatorio.", field))
    }
  }
  if (.cc_is_scalar_string(instance$status) && !(instance$status %in% c("ready", "stale"))) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.status", "bad_status", "status debe ser ready o stale.")
  }
  if (.cc_is_scalar_string(instance$sensitivity) && !(instance$sensitivity %in% c("public", "operational", "restricted", "sensitive"))) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.sensitivity", "bad_sensitivity", "Sensibilidad no reconocida.")
  }
  for (field in c("deployment_fingerprint", "access_fingerprint", "instance_fingerprint")) {
    if (!.cc_is_fingerprint(instance[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("instance.", field), "bad_fingerprint", sprintf("%s debe ser sha256 prefijado.", field))
    }
  }
  tref <- instance$template_ref
  if (!is.list(tref) || !.cc_is_scalar_string(tref$template_id) ||
      !.cc_is_integer_ge(tref$revision, 1L) || !.cc_is_fingerprint(tref$sha256)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      "instance.template_ref", "bad_template_ref", "template_ref exige template_id, revision y sha256."
    )
  }
  for (field in c("unit_refs", "access_refs")) {
    refs <- as.character(unlist(instance[[field]] %||% list(), use.names = FALSE))
    missing_units <- identical(field, "unit_refs") && !length(refs)
    if (missing_units || any(!nzchar(refs)) || anyDuplicated(refs)) {
      problems[[length(problems) + 1L]] <- .cm_problem(
        paste0("instance.", field), "bad_refs", sprintf("%s debe ser una lista de ids unicos.", field)
      )
    }
  }
  if (!is.list(instance$warnings %||% list())) {
    problems[[length(problems) + 1L]] <- .cm_problem("instance.warnings", "bad_warnings", "warnings debe ser una lista.")
  }
  problems <- c(problems, .cc_security_problems(instance, "instance"))
  list(ok = length(problems) == 0L, problems = problems)
}

#' Valida el recibo-manifest unico de un artefacto.
#'
#' @param receipt lista de recibo.
#' @return lista `ok` y `problems`.
#' @export
collection_artifact_receipt_validate <- function(receipt) {
  if (!is.list(receipt)) {
    return(list(ok = FALSE, problems = list(.cm_problem("receipt", "not_object", "El recibo debe ser un objeto."))))
  }
  problems <- list()
  allowed_receipt_fields <- c(
    "schema", "receipt_id", "artifact_id", "instance_id", "deployment_id",
    "plan_fingerprint", "deployment_fingerprint", "template_ref",
    "layout_fingerprint", "file_id", "media_type", "filename", "sha256",
    "size_bytes", "page_count", "page_map", "generator", "audience",
    "sensitivity", "generated_at"
  )
  for (field in setdiff(names(receipt) %||% character(0), allowed_receipt_fields)) {
    problems[[length(problems) + 1L]] <- .cm_problem(
      paste0("receipt.", field), "receipt_field_not_allowed",
      sprintf("`%s` no pertenece al recibo-manifest canonico.", field)
    )
  }
  if (!identical(receipt$schema, COLLECTION_ARTIFACT_RECEIPT_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.schema", "bad_schema", sprintf("Se esperaba '%s'.", COLLECTION_ARTIFACT_RECEIPT_SCHEMA))
  }
  for (field in c("receipt_id", "artifact_id", "instance_id", "deployment_id", "file_id",
                  "media_type", "filename", "audience", "sensitivity")) {
    if (!.cc_is_scalar_string(receipt[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("receipt.", field), "missing_string", sprintf("%s es obligatorio.", field))
    }
  }
  for (field in c("plan_fingerprint", "deployment_fingerprint", "layout_fingerprint", "sha256")) {
    if (!.cc_is_fingerprint(receipt[[field]])) {
      problems[[length(problems) + 1L]] <- .cm_problem(paste0("receipt.", field), "bad_fingerprint", sprintf("%s debe ser sha256 prefijado.", field))
    }
  }
  if (!receipt$media_type %in% c("image/png", "application/pdf", "application/zip")) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.media_type", "bad_media_type", "MIME no permitido para materiales V1.")
  }
  if (!.cc_is_integer_ge(receipt$size_bytes, 1L) || !.cc_is_integer_ge(receipt$page_count, 1L)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt", "bad_size_or_pages", "size_bytes y page_count deben ser enteros positivos.")
  }
  if (!is.list(receipt$page_map) || length(receipt$page_map) != as.integer(receipt$page_count)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.page_map", "bad_page_map", "page_map debe tener una entrada por pagina.")
  }
  if (!is.list(receipt$template_ref) || !.cc_is_fingerprint(receipt$template_ref$sha256)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.template_ref", "bad_template_ref", "Falta la revision de plantilla usada.")
  }
  generator <- receipt$generator
  if (!is.list(generator) || !.cc_is_scalar_string(generator$id) ||
      !.cc_is_integer_ge(generator$version, 1L) || !.cc_is_fingerprint(generator$fingerprint)) {
    problems[[length(problems) + 1L]] <- .cm_problem("receipt.generator", "bad_generator", "generator exige id, version y fingerprint.")
  }
  problems <- c(problems, .cc_security_problems(receipt, "receipt"))
  list(ok = length(problems) == 0L, problems = problems)
}

collection_material_template_get <- function(sid) {
  state <- .collection_current(session_get(sid))
  list(
    ok = TRUE,
    state_revision = as.integer(state$state_revision),
    builtin = is.null(state$material_template),
    template = .cm_material_template(state)
  )
}

collection_material_template_put <- function(sid, template, expected_revision) {
  current <- .collection_current(session_get(sid))
  .collection_assert_revision(current, expected_revision)
  if (!is.list(template)) {
    stop_api(422, "E_COLLECTION_MATERIAL_TEMPLATE_INVALID", "template debe ser un objeto collection_material_template/v1.")
  }
  previous <- .cm_material_template(current)
  comparable <- template
  comparable$revision <- previous$revision
  comparable <- .cm_template_normalize(comparable)
  if (identical(.cm_template_material(comparable), .cm_template_material(previous))) {
    return(list(ok = TRUE, noop = TRUE, state_revision = current$state_revision, template = previous))
  }
  candidate <- .cm_template_normalize(template, revision = as.integer(previous$revision) + 1L)
  .collection_assert_valid(
    collection_material_template_validate(candidate),
    "E_COLLECTION_MATERIAL_TEMPLATE_INVALID", "La plantilla no cumple collection_material_template/v1."
  )
  next_state <- current
  next_state$material_template <- candidate
  instances <- .cm_instances(next_state)
  if (length(instances)) {
    instances <- lapply(instances, function(instance) {
      if (!identical(instance$template_ref$sha256, candidate$template_sha256)) {
        instance$status <- "stale"
        warning_codes <- vapply(instance$warnings %||% list(), function(x) as.character(x$code %||% ""), character(1))
        if (!("template_changed" %in% warning_codes)) {
          instance$warnings[[length(instance$warnings) + 1L]] <- list(code = "template_changed")
        }
      }
      instance
    })
  }
  next_state$material_instances <- instances
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  list(ok = TRUE, noop = FALSE, state_revision = next_state$state_revision, template = candidate)
}

.cm_instance_freshness <- function(instance, state) {
  template <- .cm_material_template(state)
  deployment <- state$deployment
  reasons <- character(0)
  if (!identical(instance$template_ref$sha256, template$template_sha256)) reasons <- c(reasons, "template_changed")
  if (!is.list(deployment) || !identical(instance$deployment_id, deployment$deployment_id)) {
    reasons <- c(reasons, "deployment_changed")
  } else {
    deployment_fp <- .collection_deployment_fingerprint(deployment)
    if (!identical(instance$deployment_fingerprint, deployment_fp)) reasons <- c(reasons, "deployment_changed")
    current_access_fp <- .cm_access_fingerprint(deployment, instance$access_refs)
    if (!identical(instance$access_fingerprint, current_access_fp)) reasons <- c(reasons, "access_changed")
    if (identical(deployment$status, "stale")) reasons <- c(reasons, "deployment_stale")
  }
  unique(reasons)
}

collection_material_instance_create <- function(sid, expected_revision, unit_refs = NULL,
                                                access_refs = NULL, locale = "es-PE") {
  current <- .collection_current(session_get(sid))
  .collection_assert_revision(current, expected_revision)
  if (!is.list(current$plan) || !is.list(current$deployment)) {
    stop_api(409, "E_COLLECTION_DEPLOYMENT_REQUIRED", "Se necesita plan y deployment para crear materiales.")
  }
  template <- .cm_material_template(current)
  adapter_id <- current$plan$adapter$id %||% ""
  compatible <- unlist(template$compatible_adapters %||% list(), use.names = FALSE)
  if (!(adapter_id %in% compatible)) {
    stop_api(422, "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "La plantilla no es compatible con el adapter del plan.")
  }
  known_units <- vapply(current$plan$units %||% list(), function(x) as.character(x$unit_id %||% ""), character(1))
  selected_units <- as.character(unlist(unit_refs %||% as.list(known_units), use.names = FALSE))
  if (!length(selected_units) || any(!selected_units %in% known_units) || anyDuplicated(selected_units)) {
    stop_api(422, "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "unit_refs contiene unidades desconocidas o repetidas.")
  }
  unit_bindings <- Filter(function(x) is.list(x) && x$unit_id %in% selected_units,
                          current$deployment$bindings %||% list())
  known_access <- vapply(unit_bindings, function(x) as.character(x$access_id %||% ""), character(1))
  selected_access <- if (is.null(access_refs)) unique(known_access[nzchar(known_access)]) else {
    as.character(unlist(access_refs, use.names = FALSE))
  }
  if (any(!selected_access %in% known_access) || anyDuplicated(selected_access)) {
    stop_api(422, "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "access_refs contiene accesos desconocidos o repetidos.")
  }
  missing_units <- setdiff(selected_units, vapply(
    Filter(function(x) identical(x$status, "ready") && x$access_id %in% selected_access, unit_bindings),
    function(x) x$unit_id, character(1)
  ))
  warnings <- lapply(missing_units, function(unit_id) list(code = "access_missing", unit_id = unit_id))
  deployment_fp <- .collection_deployment_fingerprint(current$deployment)
  access_fp <- .cm_access_fingerprint(current$deployment, selected_access)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = paste0("material-", uuid::UUIDgenerate()),
    template_ref = list(
      template_id = template$template_id,
      revision = as.integer(template$revision),
      sha256 = template$template_sha256
    ),
    deployment_id = current$deployment$deployment_id,
    deployment_fingerprint = deployment_fp,
    access_fingerprint = access_fp,
    unit_refs = as.list(selected_units),
    access_refs = as.list(selected_access),
    locale = as.character(locale %||% "es-PE")[[1]],
    status = if (identical(current$deployment$status, "stale")) "stale" else "ready",
    sensitivity = as.character(current$deployment$sensitivity$access_urls %||% "operational")[[1]],
    warnings = warnings
  )
  instance$instance_fingerprint <- .cm_instance_fingerprint(
    template$template_sha256, deployment_fp, access_fp, selected_units, selected_access
  )
  .collection_assert_valid(
    collection_material_instance_validate(instance),
    "E_COLLECTION_MATERIAL_INSTANCE_INVALID", "La instancia no cumple collection_material_instance/v1."
  )
  next_state <- current
  next_state$material_instances <- c(.cm_instances(current), list(instance))
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  list(ok = TRUE, state_revision = next_state$state_revision, instance = instance)
}

.cm_resolved_access_map <- function(resolved_access) {
  if (is.null(resolved_access)) return(list())
  if (!is.list(resolved_access)) {
    stop_api(422, "E_COLLECTION_MATERIAL_RENDER_INVALID", "resolved_access debe ser un objeto efimero.")
  }
  out <- list()
  if (!is.null(names(resolved_access)) && all(nzchar(names(resolved_access)))) {
    for (id in names(resolved_access)) {
      value <- resolved_access[[id]]
      payload <- if (is.list(value)) value$qr_payload %||% value$url else value
      out[[id]] <- as.character(payload %||% "")[[1]]
    }
  } else {
    for (row in resolved_access) {
      if (!is.list(row) || !.cc_is_scalar_string(row$access_id)) next
      out[[row$access_id]] <- as.character(row$qr_payload %||% row$url %||% "")[[1]]
    }
  }
  for (id in names(out)) {
    value <- out[[id]]
    if (!nzchar(value) || nchar(value, type = "bytes") > 4096L ||
        !grepl("^https?://", value, ignore.case = TRUE)) {
      stop_api(422, "E_COLLECTION_MATERIAL_RENDER_INVALID", "Cada acceso resuelto debe ser una URL http(s) no vacia de hasta 4096 bytes.")
    }
  }
  out
}

.cm_project_snapshot <- function(session) {
  study <- if (is.list(session$estudio)) session$estudio else list()
  list(
    name = as.character(session$project_name %||% study$nombre %||% "Proyecto Pulso")[[1]],
    period = as.character(study$periodo %||% session$periodo %||% "")[[1]]
  )
}

collection_material_render_snapshot <- function(sid, instance_id, resolved_access = NULL) {
  session <- session_get(sid)
  state <- .collection_current(session)
  instance <- .cm_instance_find(state, instance_id)
  if (is.null(instance)) {
    stop_api(404, "E_COLLECTION_MATERIAL_INSTANCE_NOT_FOUND", "No existe la instancia de material solicitada.")
  }
  reasons <- .cm_instance_freshness(instance, state)
  if (identical(instance$status, "stale") || length(reasons)) {
    stop_api(
      409, "E_COLLECTION_MATERIAL_INSTANCE_STALE",
      "La instancia cambio respecto de template, deployment o access.",
      details = list(reasons = as.list(unique(c(reasons, if (identical(instance$status, "stale")) "instance_stale"))))
    )
  }
  list(
    schema = "collection_material_render_snapshot/v1",
    template = .cm_material_template(state),
    instance = instance,
    project = .cm_project_snapshot(session),
    plan = state$plan,
    deployment = state$deployment,
    resolved_access = .cm_resolved_access_map(resolved_access)
  )
}
