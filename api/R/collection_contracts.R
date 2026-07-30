# collection_contracts.R — Contratos de dominio de Recopiladores (ADR 0046).
#
# Dos schemas y un binding:
#   collection_plan/v1        qué unidades entran a recolección y de dónde salen
#   collection_deployment/v1  contra qué target, con qué accesos y con qué cobertura
#   binding de acceso         la costura unidad ↔ acceso
#
# Los validadores son PUROS: devuelven la lista de problemas y no lanzan. No usan
# `stop_api` a propósito, porque en esta unidad todavía no hay router que los
# exponga y registrar códigos `E_*` para un endpoint que no existe es inventar
# vocabulario de API por adelantado. Cuando el router entre (unidad 5 del plan),
# él traduce estos problemas a `stop_api`.
#
# La regla que estos validadores existen para defender es la primera del ADR
# 0046: `provider_collector_id`, `logical_collector_id`, `recipient_id`,
# `unit_id`, `operator_id` y `access_id` son identidades SEPARADAS. El bug que se
# está previniendo es real y ya ocurrió: `collector_id` significaba por momentos
# un canal remoto y por momentos una unidad curso-horario, y nada lo detectaba.

COLLECTION_PLAN_SCHEMA <- "collection_plan/v1"
COLLECTION_DEPLOYMENT_SCHEMA <- "collection_deployment/v1"

# `stale` no es un cuarto paso: es a dónde cae cualquiera de los tres cuando
# cambia el plan, la selección, la revisión del instrumento o el target remoto.
COLLECTION_DEPLOYMENT_STATUSES <- c("draft", "prepared", "handed_off", "stale")

COLLECTION_ACCESS_KINDS <- c(
  "parameterized_link",   # Kobo: un web form, N enlaces con d[campo]
  "provider_collector",   # SurveyMonkey: collector remoto de verdad
  "recipient_link",       # link por destinatario, provisto por el proveedor
  "manual_handoff"        # entró pegado a mano; nunca se fabrica localmente
)

# Las seis identidades del ADR, con el slot en que cada una es legítima. Se usa
# para probar que ninguna aparezca donde no le toca.
COLLECTION_IDENTITY_FIELDS <- c(
  "access_id",
  "logical_collector_id",
  "unit_id",
  "provider_collector_id",
  "recipient_id",
  "operator_id"
)

# -----------------------------------------------------------------------------
# Helpers locales. Nombres con prefijo `.cc_` para no chocar con los helpers
# compartidos ni tentar a nadie a reusarlos fuera de este contrato.
# -----------------------------------------------------------------------------

.cc_is_scalar_string <- function(x) {
  is.character(x) && length(x) == 1L && !is.na(x) && nzchar(trimws(x))
}

.cc_is_fingerprint <- function(x) {
  .cc_is_scalar_string(x) && grepl("^sha256:[0-9a-f]{64}$", x)
}

.cc_problem <- function(path, code, detail) {
  list(path = path, code = code, detail = detail)
}

.cc_require_string <- function(obj, field, path, problems) {
  if (!.cc_is_scalar_string(obj[[field]])) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      paste0(path, ".", field), "missing_string",
      sprintf("`%s` debe ser un string no vacío.", field)
    )
  }
  problems
}

.cc_require_fingerprint <- function(obj, field, path, problems) {
  if (!.cc_is_fingerprint(obj[[field]])) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      paste0(path, ".", field), "bad_fingerprint",
      sprintf("`%s` debe ser 'sha256:' + 64 hex. Un fingerprint con otra forma no es comparable.", field)
    )
  }
  problems
}

# -----------------------------------------------------------------------------
# collection_plan/v1
# -----------------------------------------------------------------------------

#' Valida un `collection_plan/v1`.
#'
#' @param plan lista (normalmente de `jsonlite::fromJSON(simplifyVector = FALSE)`).
#' @return lista con `ok` y `problems`.
#' @export
collection_plan_validate <- function(plan) {
  problems <- list()

  if (!is.list(plan)) {
    return(list(ok = FALSE, problems = list(.cc_problem(
      "plan", "not_object", "El plan debe ser un objeto."
    ))))
  }

  if (!identical(plan$schema, COLLECTION_PLAN_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "plan.schema", "bad_schema",
      sprintf("Se esperaba '%s'.", COLLECTION_PLAN_SCHEMA)
    )
  }

  for (field in c("plan_id", "unit_type")) {
    problems <- .cc_require_string(plan, field, "plan", problems)
  }
  problems <- .cc_require_fingerprint(plan, "input_fingerprint", "plan", problems)

  if (!is.numeric(plan$revision) || length(plan$revision) != 1L || plan$revision < 1) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "plan.revision", "bad_revision", "`revision` debe ser un entero >= 1."
    )
  }

  adapter <- plan$adapter
  if (!is.list(adapter)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "plan.adapter", "missing_adapter", "Falta `adapter`; sin él no se sabe quién sabe leer este plan."
    )
  } else {
    problems <- .cc_require_string(adapter, "id", "plan.adapter", problems)
  }

  src <- plan$source_ref
  if (!is.list(src)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "plan.source_ref", "missing_source_ref",
      "Falta `source_ref`: un plan sin origen trazable no se puede invalidar cuando el origen cambia."
    )
  } else {
    problems <- .cc_require_string(src, "module", "plan.source_ref", problems)
    problems <- .cc_require_fingerprint(src, "fingerprint", "plan.source_ref", problems)
  }

  # El instrumento es siempre una revisión LOCAL (ADR 0032). Referenciar una
  # versión remota como si fuera el instrumento es el error que se previene.
  inst <- plan$instrument_ref
  if (!is.list(inst)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "plan.instrument_ref", "missing_instrument_ref", "Falta `instrument_ref`."
    )
  } else {
    problems <- .cc_require_string(inst, "revision_id", "plan.instrument_ref", problems)
    if (!.cc_is_scalar_string(inst$sha256) || !grepl("^[0-9a-f]{64}$", inst$sha256)) {
      problems[[length(problems) + 1L]] <- .cc_problem(
        "plan.instrument_ref.sha256", "bad_sha256",
        "`sha256` del instrumento debe ser 64 hex, sin prefijo."
      )
    }
  }

  units <- plan$units
  if (!is.list(units)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "plan.units", "missing_units", "`units` debe ser una lista (puede estar vacía)."
    )
  } else {
    seen <- character(0)
    for (i in seq_along(units)) {
      path <- sprintf("plan.units[%d]", i)
      unit <- units[[i]]
      if (!is.list(unit)) {
        problems[[length(problems) + 1L]] <- .cc_problem(path, "not_object", "Cada unidad debe ser un objeto.")
        next
      }
      problems <- .cc_require_string(unit, "unit_id", path, problems)
      problems <- .cc_require_string(unit, "label", path, problems)
      uid <- unit$unit_id
      if (.cc_is_scalar_string(uid)) {
        if (uid %in% seen) {
          problems[[length(problems) + 1L]] <- .cc_problem(
            paste0(path, ".unit_id"), "duplicate_unit_id",
            sprintf("`unit_id` duplicado: '%s'. Dos unidades con el mismo id colapsan sus accesos.", uid)
          )
        }
        seen <- c(seen, uid)
      }
    }
  }

  list(ok = length(problems) == 0L, problems = problems)
}

# -----------------------------------------------------------------------------
# Binding de acceso
# -----------------------------------------------------------------------------

#' Valida un binding de acceso dentro de un deployment.
#'
#' @param binding lista.
#' @param path prefijo para los problemas.
#' @param unit_ids ids de unidad conocidos del plan; si se pasan, se exige que
#'   `unit_id` sea uno de ellos.
#' @return lista de problemas.
#' @export
collection_binding_problems <- function(binding, path = "binding", unit_ids = NULL) {
  problems <- list()

  if (!is.list(binding)) {
    return(list(.cc_problem(path, "not_object", "Cada binding debe ser un objeto.")))
  }

  for (field in c("access_id", "logical_collector_id", "unit_id", "access_kind", "status")) {
    problems <- .cc_require_string(binding, field, path, problems)
  }

  kind <- binding$access_kind
  if (.cc_is_scalar_string(kind) && !(kind %in% COLLECTION_ACCESS_KINDS)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      paste0(path, ".access_kind"), "bad_access_kind",
      sprintf("`access_kind` desconocido: '%s'. Permitidos: %s.", kind, paste(COLLECTION_ACCESS_KINDS, collapse = ", "))
    )
  }

  if (!is.null(unit_ids) && .cc_is_scalar_string(binding$unit_id) && !(binding$unit_id %in% unit_ids)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      paste0(path, ".unit_id"), "unknown_unit",
      sprintf("`unit_id` '%s' no existe en el plan.", binding$unit_id)
    )
  }

  # ADR 0046 regla 1: las identidades no se reciclan entre slots. Un
  # `provider_collector_id` que repite el `unit_id` es exactamente la ambigüedad
  # que el ADR vino a matar, y es indetectable a ojo en un JSON grande.
  presentes <- Filter(
    function(f) .cc_is_scalar_string(binding[[f]]),
    COLLECTION_IDENTITY_FIELDS
  )
  valores <- vapply(presentes, function(f) binding[[f]], character(1))
  dups <- unique(valores[duplicated(valores)])
  for (dup in dups) {
    campos <- presentes[valores == dup]
    problems[[length(problems) + 1L]] <- .cc_problem(
      path, "identity_reused",
      sprintf(
        "El valor '%s' aparece en %s. Son identidades separadas por decisión (ADR 0046 regla 1) y compartir el valor vuelve a mezclar canal, unidad y destinatario.",
        dup, paste(campos, collapse = " y ")
      )
    )
  }

  # `parameterized_link` sin prefill no personaliza nada: el QR abriría la
  # encuesta sin identificar su unidad y la respuesta llegaría huérfana.
  if (identical(kind, "parameterized_link")) {
    prefill <- binding$prefill
    if (!is.list(prefill) || length(prefill) == 0L) {
      problems[[length(problems) + 1L]] <- .cc_problem(
        paste0(path, ".prefill"), "missing_prefill",
        "Un `parameterized_link` sin `prefill` no identifica su unidad."
      )
    }
  }

  # Un recipient link nunca se fabrica localmente (ADR 0046 regla 4).
  if (identical(kind, "recipient_link") && !.cc_is_scalar_string(binding$recipient_id)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      paste0(path, ".recipient_id"), "missing_recipient",
      "Un `recipient_link` exige `recipient_id`: si no vino del proveedor, no es un recipient link."
    )
  }

  problems
}

# -----------------------------------------------------------------------------
# collection_deployment/v1
# -----------------------------------------------------------------------------

#' Valida un `collection_deployment/v1`.
#'
#' @param deployment lista.
#' @param plan opcional; si se pasa, se comprueba la integridad referencial
#'   contra él (`plan_id` y `unit_id` de cada binding).
#' @return lista con `ok` y `problems`.
#' @export
collection_deployment_validate <- function(deployment, plan = NULL) {
  problems <- list()

  if (!is.list(deployment)) {
    return(list(ok = FALSE, problems = list(.cc_problem(
      "deployment", "not_object", "El deployment debe ser un objeto."
    ))))
  }

  if (!identical(deployment$schema, COLLECTION_DEPLOYMENT_SCHEMA)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "deployment.schema", "bad_schema",
      sprintf("Se esperaba '%s'.", COLLECTION_DEPLOYMENT_SCHEMA)
    )
  }

  for (field in c("deployment_id", "plan_id", "status")) {
    problems <- .cc_require_string(deployment, field, "deployment", problems)
  }
  problems <- .cc_require_fingerprint(deployment, "plan_fingerprint", "deployment", problems)

  status <- deployment$status
  if (.cc_is_scalar_string(status) && !(status %in% COLLECTION_DEPLOYMENT_STATUSES)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "deployment.status", "bad_status",
      sprintf("`status` desconocido: '%s'. Permitidos: %s.", status, paste(COLLECTION_DEPLOYMENT_STATUSES, collapse = ", "))
    )
  }

  target <- deployment$target
  if (!is.list(target)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "deployment.target", "missing_target", "Falta `target`."
    )
  } else {
    problems <- .cc_require_string(target, "provider", "deployment.target", problems)
    # `connection_profile_id` es una REFERENCIA al perfil, no la credencial. Un
    # token acá violaría el ADR 0005 y viajaría dentro del `.pulso`.
    for (prohibido in c("token", "access_token", "api_key", "password", "secret")) {
      if (!is.null(target[[prohibido]])) {
        problems[[length(problems) + 1L]] <- .cc_problem(
          paste0("deployment.target.", prohibido), "secret_in_state",
          sprintf("`%s` no puede vivir en el deployment: los secretos van fuera del .pulso (ADR 0005).", prohibido)
        )
      }
    }
  }

  sens <- deployment$sensitivity
  if (!is.list(sens) || !.cc_is_scalar_string(sens$access_urls)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "deployment.sensitivity.access_urls", "missing_sensitivity",
      "Falta declarar la sensibilidad de las URLs de acceso: de eso depende si se persisten completas o como referencia."
    )
  }

  unit_ids <- NULL
  if (is.list(plan)) {
    if (.cc_is_scalar_string(plan$plan_id) && .cc_is_scalar_string(deployment$plan_id) &&
        !identical(plan$plan_id, deployment$plan_id)) {
      problems[[length(problems) + 1L]] <- .cc_problem(
        "deployment.plan_id", "plan_mismatch",
        sprintf("El deployment apunta a '%s' pero el plan es '%s'.", deployment$plan_id, plan$plan_id)
      )
    }
    if (is.list(plan$units)) {
      unit_ids <- vapply(
        Filter(function(u) is.list(u) && .cc_is_scalar_string(u$unit_id), plan$units),
        function(u) u$unit_id, character(1)
      )
    }
  }

  bindings <- deployment$bindings
  if (!is.list(bindings)) {
    problems[[length(problems) + 1L]] <- .cc_problem(
      "deployment.bindings", "missing_bindings", "`bindings` debe ser una lista (puede estar vacía)."
    )
  } else {
    seen_access <- character(0)
    for (i in seq_along(bindings)) {
      path <- sprintf("deployment.bindings[%d]", i)
      problems <- c(problems, collection_binding_problems(bindings[[i]], path, unit_ids))
      aid <- bindings[[i]]$access_id
      if (.cc_is_scalar_string(aid)) {
        if (aid %in% seen_access) {
          problems[[length(problems) + 1L]] <- .cc_problem(
            paste0(path, ".access_id"), "duplicate_access_id",
            sprintf("`access_id` duplicado: '%s'.", aid)
          )
        }
        seen_access <- c(seen_access, aid)
      }
    }
  }

  # Un deployment `handed_off` sin recibo no es auditable: nadie puede decir
  # cuándo ni qué recibió Monitoreo, y repetir el handoff deja de ser no-op.
  if (identical(status, "handed_off")) {
    handoff <- deployment$handoff
    if (!is.list(handoff) || !.cc_is_scalar_string(handoff$handed_off_at)) {
      problems[[length(problems) + 1L]] <- .cc_problem(
        "deployment.handoff", "missing_handoff_receipt",
        "Un deployment `handed_off` exige recibo con `handed_off_at`."
      )
    }
  }

  list(ok = length(problems) == 0L, problems = problems)
}

#' Resumen legible de los problemas de una validación.
#'
#' @param result salida de `collection_plan_validate` o `collection_deployment_validate`.
#' @return character vector.
#' @export
collection_contract_problem_lines <- function(result) {
  if (isTRUE(result$ok)) return(character(0))
  vapply(
    result$problems,
    function(p) sprintf("%s [%s]: %s", p$path, p$code, p$detail),
    character(1)
  )
}

#' Ruta a los fixtures de contrato instalados con el paquete.
#'
#' @param profile "aulas", "acreditacion" o "establecimientos".
#' @param kind "plan" o "deployment".
#' @return ruta al JSON.
#' @export
collection_fixture_path <- function(profile, kind = c("plan", "deployment")) {
  kind <- match.arg(kind)
  system.file(
    "collection_fixtures", profile, paste0(kind, ".json"),
    package = "prosecnurapp"
  )
}
