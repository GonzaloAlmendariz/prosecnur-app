# Estado y transiciones de Recopiladores (ADR 0046, unidades 5-7).
#
# Este engine no conoce HTTP ni proveedores. Todas sus mutaciones son locales y
# atómicas sobre una sola sesión; ninguna función realiza llamadas de red.

.collection_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.collection_empty_state <- function(revision = 0L) {
  list(
    schema = COLLECTION_STATE_SCHEMA,
    state_revision = as.integer(revision),
    plan = NULL,
    deployment = NULL,
    migration = NULL
  )
}

#' El plan congelado contra el sorteo vigente.
#'
#' El plan se siembra UNA vez y re-sortear no lo regenera, asi que un proyecto
#' puede tener materiales de una corrida y una seleccion de otra. Medido en
#' HSVG2026 el 2026-08-22: plan del 1 de agosto con 2.468 unidades y codigos
#' «AULA n», seleccion del 21 con 2.616 filas y codigos «CH n». La pantalla solo
#' mostraba `source_ref$module` —«calc-muestra»— que nunca cambia.
#'
#' Devuelve NULL cuando no hay con que comparar; nunca inventa un veredicto.
.collection_source_vigente <- function(s, state) {
  plan_run <- .cm_aulas_scalar(state$plan$source_ref$run_id %||% "", "")
  sel <- s$calc_muestra_aulas_selection
  filas <- if (is.list(sel) && !is.null(sel$selection)) sel$selection else NULL
  run_actual <- ""
  if (!is.null(filas)) {
    col <- if (is.data.frame(filas)) filas[["selection_run_id"]] else NULL
    if (!is.null(col) && length(col)) run_actual <- .cm_aulas_scalar(col[[1]], "")
  }
  if (!nzchar(plan_run) && !nzchar(run_actual)) return(NULL)
  list(
    plan_run_id = plan_run,
    selection_run_id = run_actual,
    desfasado = nzchar(plan_run) && nzchar(run_actual) && !identical(plan_run, run_actual)
  )
}

#' Anade el veredicto de vigencia a un payload ya armado.
#'
#' `source_vigente` se calculaba solo en `collection_state_get`, asi que las otras
#' quince respuestas del modulo —seed, plan, deployment, prepare, reconcile,
#' handoff— salian sin el y el aviso de plan desfasado desaparecia en cuanto el
#' front hacia cualquier cosa. Es el mismo defecto que este loop lleva corrigiendo
#' todo el dia: se anadio el dato donde se miro, no en todas las salidas.
.collection_con_vigencia <- function(payload, sid) {
  payload$source_vigente <- .collection_source_vigente(session_get(sid), payload$state)
  payload
}

.collection_payload <- function(state, noop = FALSE, seeded = FALSE,
                                seed_available = FALSE, source_vigente = NULL) {
  list(
    ok = TRUE,
    noop = isTRUE(noop),
    seeded = isTRUE(seeded),
    seed_available = isTRUE(seed_available),
    schema = state$schema,
    state_revision = state$state_revision,
    plan = state$plan,
    deployment = state$deployment,
    migration = state$migration,
    source_vigente = source_vigente,
    state = state
  )
}

.collection_expected_revision <- function(value) {
  if (is.null(value) || !length(value)) {
    stop_api(400, "E_COLLECTION_EXPECTED_REVISION", "expected_revision es obligatorio.")
  }
  parsed <- suppressWarnings(as.integer(value[[1]]))
  numeric <- suppressWarnings(as.numeric(value[[1]]))
  if (is.na(parsed) || is.na(numeric) || parsed < 0L || numeric != parsed) {
    stop_api(
      400, "E_COLLECTION_EXPECTED_REVISION",
      "expected_revision debe ser un entero no negativo."
    )
  }
  parsed
}

.collection_current <- function(s) {
  state <- s$collection_state
  if (is.null(state)) return(.collection_empty_state())
  valid <- collection_state_validate(state)
  if (!isTRUE(valid$ok)) {
    stop_api(
      500, "E_COLLECTION_STATE_INVALID",
      "El estado persistido de Recopiladores no cumple collection_state/v1.",
      details = list(problems = collection_contract_problem_lines(valid))
    )
  }
  state$state_revision <- as.integer(state$state_revision)
  state
}

.collection_assert_revision <- function(state, expected_revision) {
  expected <- .collection_expected_revision(expected_revision)
  if (!identical(as.integer(state$state_revision), expected)) {
    stop_api(
      409, "E_COLLECTION_STATE_STALE",
      "El estado de Recopiladores cambió desde que se abrió la pantalla.",
      details = list(
        expected_revision = expected,
        current_revision = as.integer(state$state_revision)
      )
    )
  }
  expected
}

.collection_assert_valid <- function(result, code, message) {
  if (isTRUE(result$ok)) return(invisible(TRUE))
  stop_api(
    422, code, message,
    details = list(problems = collection_contract_problem_lines(result))
  )
}

.collection_store <- function(sid, state, monitoring_plan = NULL) {
  valid <- collection_state_validate(state)
  .collection_assert_valid(
    valid, "E_COLLECTION_STATE_MUTATION_INVALID",
    "La mutación produciría un collection_state/v1 inválido."
  )
  fresh <- session_get(sid)
  fresh_state <- .collection_current(fresh)
  previous_revision <- as.integer(state$state_revision) - 1L
  if (!identical(as.integer(fresh_state$state_revision), previous_revision)) {
    stop_api(
      409, "E_COLLECTION_STATE_STALE",
      "El estado de Recopiladores cambió durante el guardado.",
      details = list(
        expected_revision = previous_revision,
        current_revision = as.integer(fresh_state$state_revision)
      )
    )
  }
  fresh$collection_state <- state
  if (is.function(monitoring_plan)) monitoring_plan <- monitoring_plan(fresh)
  if (!is.null(monitoring_plan)) fresh$monitoreo_aulas_plan <- monitoring_plan
  fresh <- .mark_project_dirty(fresh)
  .session_env[[sid]] <- fresh
  invisible(state)
}

.collection_rows <- function(value) {
  if (is.data.frame(value)) {
    return(lapply(seq_len(nrow(value)), function(i) as.list(value[i, , drop = FALSE])))
  }
  if (!is.list(value)) return(list())
  if (is.list(value$plan)) return(.collection_rows(value$plan))
  if (is.data.frame(value$plan)) return(.collection_rows(value$plan))
  if (!length(value)) return(list())
  if (!is.null(names(value)) && any(names(value) %in% c("classroom_id", "operational_code", "course_id"))) {
    return(list(value))
  }
  Filter(is.list, unname(value))
}

.collection_seed_source <- function(s) {
  monitoring_rows <- .collection_rows(s$monitoreo_aulas_plan)
  if (length(monitoring_rows)) {
    return(list(
      rows = monitoring_rows,
      source = "monitoreo_aulas_plan",
      module = "monitoreo"
    ))
  }
  selection <- s$calc_muestra_aulas_selection
  selection_rows <- if (is.list(selection) && !is.null(selection$selection)) {
    .collection_rows(selection$selection)
  } else {
    .collection_rows(selection)
  }
  if (length(selection_rows)) {
    return(list(
      rows = selection_rows,
      source = "calc_muestra_aulas_selection",
      module = "calc-muestra"
    ))
  }
  list(rows = list(), source = NULL, module = NULL)
}

.collection_first_string <- function(x, fields, default = "") {
  for (field in fields) {
    value <- x[[field]]
    if (is.factor(value)) value <- as.character(value)
    if (is.character(value) && length(value) && !is.na(value[[1]]) && nzchar(trimws(value[[1]]))) {
      return(trimws(value[[1]]))
    }
    if (is.numeric(value) && length(value) && !is.na(value[[1]])) return(as.character(value[[1]]))
  }
  default
}

.collection_first_number <- function(x, fields) {
  for (field in fields) {
    value <- x[[field]]
    if (!length(value) || is.na(value[[1]])) next
    candidate <- suppressWarnings(as.numeric(as.character(value[[1]])))
    if (length(candidate) && is.finite(candidate[[1]])) return(candidate[[1]])
  }
  NULL
}

.collection_stable_id <- function(prefix, value) {
  value <- tolower(iconv(as.character(value), from = "", to = "ASCII//TRANSLIT", sub = ""))
  slug <- gsub("[^a-z0-9]+", "-", value)
  slug <- gsub("^-+|-+$", "", slug)
  hash <- substr(sub("^sha256:", "", collection_fingerprint(value)), 1L, 10L)
  if (!nzchar(slug)) slug <- "item"
  paste0(prefix, "-", substr(slug, 1L, 32L), "-", hash)
}

.collection_instrument_ref <- function(s, provider) {
  xlsform_state <- if (is.list(s$xlsform_state)) s$xlsform_state else list()
  instrumento <- if (is.list(s$instrumento)) s$instrumento else list()
  candidates <- list(
    xlsform_state$active_revision,
    xlsform_state$revision,
    xlsform_state$source,
    instrumento$revision
  )
  candidates <- Filter(is.list, candidates)
  current <- if (length(candidates)) candidates[[1]] else list()
  revision_id <- .collection_first_string(
    current, c("revision_id", "id", "content_sha256"), "legacy-instrument-unpinned"
  )
  sha <- .collection_first_string(current, c("content_sha256", "sha256", "file_sha256"))
  sha <- sub("^sha256:", "", tolower(sha))
  if (!grepl("^[0-9a-f]{64}$", sha)) {
    sha <- sub("^sha256:", "", collection_fingerprint(list(
      revision_id = revision_id,
      provider = provider,
      source_kind = .collection_first_string(current, c("kind", "provider"), "legacy")
    )))
  }
  list(revision_id = revision_id, sha256 = sha, provider = provider)
}

.collection_plan_input_fingerprint <- function(plan) {
  input <- plan
  input$input_fingerprint <- NULL
  input$revision <- NULL
  collection_fingerprint(input)
}

.collection_deployment_fingerprint <- function(deployment) {
  material <- deployment
  material$deployment_fingerprint <- NULL
  material$status <- NULL
  material$handoff <- NULL
  material$stale <- NULL
  collection_fingerprint(material)
}

.collection_legacy_unit <- function(row, index) {
  source_key <- .collection_first_string(row, c(
    "operational_code", "classroom_id", "curso_horario", "course_schedule_id",
    "selection_slot_id", "id_match", "id"
  ), sprintf("row-%d", index))
  unit_id <- .collection_stable_id("unit-aulas", source_key)
  label <- .collection_first_string(
    row, c("label", "classroom_label", "sesiones_y_aula", "aula", "section"), source_key
  )
  list(
    unit_id = unit_id,
    label = label,
    role = .collection_first_string(row, c("sample_role", "rol_muestra"), "titular"),
    group = .collection_first_string(row, c("wave", "muestra", "sample_wave"), "M1"),
    dimensions = list(
      legacy_ref = source_key,
      faculty = .collection_first_string(row, c("faculty", "facultad", "stratum")),
      course_id = .collection_first_string(row, c("course_id", "curso_id", "curso")),
      course_name = .collection_first_string(row, c(
        "course_name", "nombre_del_curso", "nombre_curso", "curso_nombre", "asignatura"
      )),
      schedule = .collection_first_string(row, c("schedule", "horario")),
      venue = .collection_first_string(row, c(
        "pabellon_aula", "pabellon", "venue", "aula", "salon", "room",
        "building_room", "label"
      )),
      teacher = .collection_first_string(row, c(
        "teacher", "docente", "nombre_de_docente", "nombre_del_docente", "profesor", "profesora"
      )),
      sample_label = .collection_first_string(row, c(
        "sample_label", "historical_sample_label", "wave", "muestra", "sample_wave"
      ), "M1"),
      # A quien reemplaza esta unidad. Sin esto la ficha de un reemplazo no
      # puede decir de quien lo es, que es justo lo que necesita saber quien la
      # lleva al aula.
      replacement_for = .collection_first_string(row, c(
        "replacement_for", "reemplazo_de", "titular_operational_code", "codigo_aula_titular"
      )),
      # Y en que LUGAR de la cadena entra. Con cadenas de uno o dos no hacia
      # falta; desde que el candado por facultad las deja llegar a once, seis
      # fichas de la misma cadena decian todas «Reemplazo de AULA-01» y quien
      # las tiene en la mano no sabia cual va primero.
      replacement_order = .collection_first_number(row, c(
        "replacement_order", "orden_reemplazo", "orden_de_reemplazo"
      )),
      eligible_n = .collection_first_number(row, c(
        "eligible_n", "matriculados_poblacion", "students_n"
      )),
      # Composicion del aula. La produce Calculo de muestra y es de donde
      # Monitoreo deriva los objetivos de cuota sexo x facultad; sin ella esa
      # seccion del tablero sale vacia para todo plan creado por el handoff.
      stratum = .collection_first_string(row, c("stratum", "estrato")),
      sex_top_1 = .collection_first_string(row, c("sex_top_1", "sexo_principal")),
      sex_top_1_n = .collection_first_number(row, c("sex_top_1_n", "n_sexo_principal")),
      sex_top_2 = .collection_first_string(row, c("sex_top_2", "sexo_secundario")),
      sex_top_2_n = .collection_first_number(row, c("sex_top_2_n", "n_sexo_secundario"))
    ),
    scheduling = list(
      wave = .collection_first_string(row, c("wave", "muestra", "sample_wave"), "M1"),
      sequence = as.integer(index)
    )
  )
}

.collection_link_base <- function(link) {
  if (!.cc_is_scalar_string(link)) return("")
  if (grepl("^data:", link, ignore.case = TRUE)) return("")
  trimws(sub("[?#].*$", "", link))
}

.collection_provider_from_rows <- function(rows) {
  links <- vapply(rows, .collection_first_string, character(1),
                  fields = c("link", "url", "acortador", "enlace", "survey_link"))
  joined <- tolower(paste(links, collapse = " "))
  if (grepl("kobo|kobocollect|kf\\.", joined)) return("kobo")
  if (grepl("surveymonkey", joined)) return("surveymonkey")
  "manual"
}

.collection_seed_deployment <- function(rows, plan, provider) {
  links <- vapply(rows, .collection_first_string, character(1),
                  fields = c("link", "url", "acortador", "enlace", "survey_link"))
  if (!any(nzchar(links))) return(NULL)
  bindings <- list()
  for (i in seq_along(plan$units)) {
    if (!nzchar(links[[i]])) next
    unit_id <- plan$units[[i]]$unit_id
    kind <- if (identical(provider, "kobo")) "parameterized_link" else "manual_handoff"
    binding <- list(
      access_id = .collection_stable_id("access", paste(unit_id, links[[i]], sep = "|")),
      logical_collector_id = .collection_stable_id("logical", unit_id),
      unit_id = unit_id,
      provider_collector_id = NULL,
      recipient_id = NULL,
      operator_id = NULL,
      access_kind = kind,
      access_ref = .collection_link_base(links[[i]]),
      prefill = if (identical(kind, "parameterized_link")) list(collectorID = unit_id) else list(),
      status = "ready"
    )
    bindings[[length(bindings) + 1L]] <- binding
  }
  total <- length(plan$units)
  with_access <- length(unique(vapply(bindings, function(x) x$unit_id, character(1))))
  deployment <- list(
    schema = COLLECTION_DEPLOYMENT_SCHEMA,
    deployment_id = .collection_stable_id("deployment", plan$plan_id),
    plan_id = plan$plan_id,
    plan_fingerprint = plan$input_fingerprint,
    target = list(provider = provider, remote_ref = list(source = "legacy_local")),
    capabilities = list(remote_write = list(observed = FALSE, source = "disabled_v1")),
    bindings = bindings,
    coverage = list(
      units_total = as.integer(total),
      units_with_access = as.integer(with_access),
      units_missing_access = as.integer(total - with_access)
    ),
    sensitivity = list(access_urls = "operational"),
    status = if (total > 0L && with_access == total) "prepared" else "draft",
    handoff = NULL
  )
  deployment$deployment_fingerprint <- .collection_deployment_fingerprint(deployment)
  deployment
}

.collection_seed_from_legacy_state <- function(s) {
  if (!is.null(s$collection_state)) return(list(state = s$collection_state, seeded = FALSE))
  seed_source <- .collection_seed_source(s)
  rows <- seed_source$rows
  if (!length(rows)) return(list(state = .collection_empty_state(1L), seeded = TRUE))
  provider <- .collection_provider_from_rows(rows)
  units <- lapply(seq_along(rows), function(i) .collection_legacy_unit(rows[[i]], i))
  source_fp <- collection_fingerprint(units)
  run_id <- .collection_first_string(rows[[1]], c("selection_run_id", "run_id"), "legacy-monitoreo-aulas")
  plan <- list(
    schema = COLLECTION_PLAN_SCHEMA,
    plan_id = .collection_stable_id("plan-aulas", source_fp),
    adapter = list(id = "aulas_v1", version = 1L),
    source_ref = list(module = seed_source$module, run_id = run_id, fingerprint = source_fp),
    instrument_ref = .collection_instrument_ref(s, provider),
    unit_type = "classroom_course_schedule",
    units = units,
    revision = 1L,
    input_fingerprint = paste0("sha256:", strrep("0", 64L))
  )
  plan$input_fingerprint <- .collection_plan_input_fingerprint(plan)
  deployment <- .collection_seed_deployment(rows, plan, provider)
  state <- list(
    schema = COLLECTION_STATE_SCHEMA,
    state_revision = 1L,
    plan = plan,
    deployment = deployment,
    migration = list(
      source = seed_source$source,
      adapter_id = "aulas_v1",
      source_fingerprint = source_fp
    )
  )
  .collection_assert_valid(
    collection_state_validate(state),
    "E_COLLECTION_LEGACY_INVALID",
    "El plan legacy de aulas no pudo convertirse a collection_state/v1."
  )
  list(state = state, seeded = TRUE)
}

# Semilla pura usada por load_pulso: no toca dirty ni pisa el estado propio.
collection_state_migrate_legacy <- function(s) {
  if (is.null(s$collection_state) && !length(.collection_seed_source(s)$rows)) return(s)
  seeded <- .collection_seed_from_legacy_state(s)
  if (isTRUE(seeded$seeded)) s$collection_state <- seeded$state
  s
}

collection_state_get <- function(sid) {
  s <- session_get(sid)
  estado <- .collection_current(s)
  .collection_payload(
    estado,
    noop = TRUE,
    seed_available = is.null(s$collection_state) &&
      length(.collection_seed_source(s)$rows) > 0L,
    source_vigente = .collection_source_vigente(s, estado)
  )
}

collection_state_seed <- function(sid) {
  s <- session_get(sid)
  if (!is.null(s$collection_state)) {
    return(.collection_con_vigencia(.collection_payload(.collection_current(s), noop = TRUE, seeded = FALSE), sid))
  }
  if (!length(.collection_seed_source(s)$rows)) {
    return(.collection_con_vigencia(.collection_payload(
      .collection_empty_state(), noop = TRUE, seeded = FALSE, seed_available = FALSE
    ), sid))
  }
  seeded <- .collection_seed_from_legacy_state(s)
  .collection_store(sid, seeded$state)
  .collection_con_vigencia(.collection_payload(seeded$state, seeded = TRUE, seed_available = FALSE), sid)
}

#' Rehacer el plan desde el sorteo vigente.
#'
#' `collection_state_seed` siembra UNA vez y no hace nada si el plan ya existe, y
#' entre los endpoints no habia ninguno de vuelta. Consecuencia medida en
#' HSVG2026 el 2026-08-22: un plan del 1 de agosto —175 titulares, doce olas,
#' codigos «AULA n», sin cadena de reemplazos— conviviendo con una seleccion del
#' 21 de 190 titulares y cinco olas, y ninguna forma de rehacerlo desde la app.
#'
#' Regenerar NO es gratis y por eso es explicito: el plan esta congelado a
#' proposito —es lo que fue a imprenta— y rehacerlo descarta el despliegue y su
#' handoff. La funcion devuelve que se descarto para que la UI pueda decirlo
#' ANTES, no despues.
collection_state_reseed <- function(sid, expected_revision) {
  s <- session_get(sid)
  current <- .collection_current(s)
  .collection_assert_revision(current, expected_revision)
  origen <- .collection_seed_source(s)
  if (!length(origen$rows)) {
    stop_api(
      409, "E_COLLECTION_SIN_ORIGEN",
      "No hay seleccion de aulas vigente de la que rehacer el plan."
    )
  }
  descartado <- list(
    plan_run_id = .cm_aulas_scalar(current$plan$source_ref$run_id %||% "", ""),
    unidades = length(current$plan$units %||% list()),
    tenia_despliegue = is.list(current$deployment) && length(current$deployment) > 0L,
    entregado = identical(.cm_aulas_scalar(current$deployment$status %||% "", ""), "handed_off")
  )
  seeded <- .collection_seed_from_legacy_state(s)
  nuevo <- seeded$state
  # La revision sigue creciendo: rehacer no reinicia el contador, porque los
  # clientes lo usan para detectar escrituras concurrentes.
  nuevo$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, nuevo)
  payload <- .collection_payload(
    nuevo, seeded = TRUE, source_vigente = .collection_source_vigente(session_get(sid), nuevo)
  )
  payload$reseeded <- TRUE
  payload$descartado <- descartado
  payload
}

collection_plan_put <- function(sid, plan, expected_revision) {
  s <- session_get(sid)
  current <- .collection_current(s)
  .collection_assert_revision(current, expected_revision)
  if (!is.list(plan)) {
    stop_api(422, "E_COLLECTION_PLAN_INVALID", "plan debe ser un objeto collection_plan/v1.")
  }
  candidate <- plan
  candidate$input_fingerprint <- .collection_plan_input_fingerprint(candidate)
  .collection_assert_valid(
    collection_plan_validate(candidate), "E_COLLECTION_PLAN_INVALID",
    "El plan no cumple collection_plan/v1."
  )
  next_state <- current
  next_state$plan <- candidate
  if (is.list(next_state$deployment) &&
      !identical(next_state$deployment$plan_fingerprint, candidate$input_fingerprint)) {
    next_state$deployment$status <- "stale"
    next_state$deployment$stale <- list(reasons = list("plan_fingerprint_changed"))
  }
  if (identical(next_state[c("plan", "deployment")], current[c("plan", "deployment")])) {
    return(.collection_con_vigencia(.collection_payload(current, noop = TRUE), sid))
  }
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  .collection_con_vigencia(.collection_payload(next_state), sid)
}

.collection_deployment_normalize <- function(deployment, plan) {
  candidate <- deployment
  if (!is.list(candidate)) return(candidate)
  candidate$deployment_fingerprint <- NULL
  candidate$deployment_fingerprint <- .collection_deployment_fingerprint(candidate)
  if (!identical(candidate$plan_fingerprint, plan$input_fingerprint)) {
    candidate$status <- "stale"
    candidate$stale <- list(reasons = list("plan_fingerprint_changed"))
  }
  candidate
}

collection_deployment_put <- function(sid, deployment, expected_revision) {
  s <- session_get(sid)
  current <- .collection_current(s)
  .collection_assert_revision(current, expected_revision)
  if (is.null(current$plan)) {
    stop_api(409, "E_COLLECTION_PLAN_REQUIRED", "Se necesita un plan antes de guardar el deployment.")
  }
  candidate <- .collection_deployment_normalize(deployment, current$plan)
  .collection_assert_valid(
    collection_deployment_validate(candidate, current$plan),
    "E_COLLECTION_DEPLOYMENT_INVALID",
    "El deployment no cumple collection_deployment/v1."
  )
  if (identical(candidate, current$deployment)) {
    return(.collection_con_vigencia(.collection_payload(current, noop = TRUE), sid))
  }
  next_state <- current
  next_state$deployment <- candidate
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  .collection_con_vigencia(.collection_payload(next_state), sid)
}

.collection_coverage <- function(plan, deployment) {
  unit_ids <- vapply(plan$units %||% list(), function(x) x$unit_id, character(1))
  ready <- unique(vapply(
    Filter(function(x) is.list(x) && identical(x$status, "ready") && x$unit_id %in% unit_ids,
           deployment$bindings %||% list()),
    function(x) x$unit_id, character(1)
  ))
  list(
    units_total = as.integer(length(unit_ids)),
    units_with_access = as.integer(length(ready)),
    units_missing_access = as.integer(length(setdiff(unit_ids, ready)))
  )
}

collection_deployment_prepare <- function(sid, expected_revision, deployment = NULL) {
  s <- session_get(sid)
  current <- .collection_current(s)
  .collection_assert_revision(current, expected_revision)
  if (is.null(current$plan)) {
    stop_api(409, "E_COLLECTION_PLAN_REQUIRED", "Se necesita un plan antes de preparar el deployment.")
  }
  candidate <- deployment %||% current$deployment
  if (!is.list(candidate)) {
    stop_api(409, "E_COLLECTION_DEPLOYMENT_REQUIRED", "No hay deployment para preparar.")
  }
  candidate$plan_id <- current$plan$plan_id
  candidate$plan_fingerprint <- current$plan$input_fingerprint
  candidate["handoff"] <- list(NULL)
  candidate$stale <- NULL
  candidate$status <- "prepared"
  .collection_assert_valid(
    collection_deployment_validate(candidate, current$plan),
    "E_COLLECTION_DEPLOYMENT_INVALID",
    "El deployment no cumple collection_deployment/v1."
  )
  candidate$coverage <- .collection_coverage(current$plan, candidate)
  candidate <- .collection_deployment_normalize(candidate, current$plan)
  .collection_assert_valid(
    collection_deployment_validate(candidate, current$plan),
    "E_COLLECTION_DEPLOYMENT_INVALID",
    "El deployment no cumple collection_deployment/v1."
  )
  if (candidate$coverage$units_total < 1L || candidate$coverage$units_missing_access > 0L) {
    stop_api(
      422, "E_COLLECTION_DEPLOYMENT_NOT_READY",
      "El deployment no cubre todas las unidades del plan.",
      details = list(coverage = candidate$coverage)
    )
  }
  if (identical(candidate, current$deployment)) {
    return(.collection_con_vigencia(.collection_payload(current, noop = TRUE), sid))
  }
  next_state <- current
  next_state$deployment <- candidate
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  .collection_con_vigencia(.collection_payload(next_state), sid)
}

.collection_stale_reasons <- function(state, observed = list()) {
  plan <- state$plan
  deployment <- state$deployment
  reasons <- character(0)
  if (!is.list(plan) || !is.list(deployment)) return("missing_plan_or_deployment")
  if (!identical(deployment$plan_id, plan$plan_id) ||
      !identical(deployment$plan_fingerprint, plan$input_fingerprint)) {
    reasons <- c(reasons, "plan_fingerprint_changed")
  }
  observed_plan <- observed$plan_fingerprint %||% observed$input_fingerprint
  if (.cc_is_scalar_string(observed_plan) && !identical(observed_plan, plan$input_fingerprint)) {
    reasons <- c(reasons, "selection_changed")
  }
  observed_instrument <- sub(
    "^sha256:", "", tolower(.collection_first_string(observed, "instrument_sha256"))
  )
  if (nzchar(observed_instrument) &&
      !identical(observed_instrument, tolower(plan$instrument_ref$sha256))) {
    reasons <- c(reasons, "instrument_revision_changed")
  }
  observed_target <- observed$target_fingerprint
  if (is.list(observed$target)) observed_target <- collection_fingerprint(observed$target)
  if (is.list(observed$remote_ref)) observed_target <- collection_fingerprint(list(
    provider = deployment$target$provider,
    remote_ref = observed$remote_ref
  ))
  expected_target <- collection_fingerprint(deployment$target)
  if (.cc_is_scalar_string(observed_target) && !identical(observed_target, expected_target)) {
    reasons <- c(reasons, "target_remote_changed")
  }
  unique(reasons)
}

collection_reconcile <- function(sid, expected_revision, observed = list()) {
  s <- session_get(sid)
  current <- .collection_current(s)
  .collection_assert_revision(current, expected_revision)
  if (!is.list(observed)) {
    stop_api(422, "E_COLLECTION_RECONCILE_INVALID", "observed debe ser un objeto.")
  }
  reasons <- .collection_stale_reasons(current, observed)
  if (!length(reasons)) return(.collection_con_vigencia(.collection_payload(current, noop = TRUE), sid))
  if (is.list(current$deployment) && identical(current$deployment$status, "stale") &&
      identical(unlist(current$deployment$stale$reasons), reasons)) {
    return(.collection_con_vigencia(.collection_payload(current, noop = TRUE), sid))
  }
  next_state <- current
  if (is.list(next_state$deployment)) {
    next_state$deployment$status <- "stale"
    next_state$deployment$stale <- list(
      reasons = as.list(reasons),
      observed_fingerprint = collection_fingerprint(observed)
    )
  }
  next_state$state_revision <- as.integer(current$state_revision) + 1L
  .collection_store(sid, next_state)
  .collection_con_vigencia(.collection_payload(next_state), sid)
}

# Cada proveedor nombra distinto el parametro de personalizacion: Kobo lo lee
# como `d[campo]` (prefill de Enketo) y SurveyMonkey como `campo` a secas
# (Custom Variable). Escribir `d[]` para todos le colgaba a SurveyMonkey un
# parametro que su formulario ignora, asi que el proveedor entra por argumento
# en vez de asumirse.
.collection_prefill_param <- function(key, provider) {
  if (identical(tolower(as.character(provider %||% "")[1]), "surveymonkey")) {
    return(as.character(key))
  }
  sprintf("d[%s]", as.character(key))
}

# Los corchetes que exige Enketo van escapados; la barra de la ruta XPath
# completa (`/<asset_uid>/campo`) se deja literal. `URLencode(reserved = TRUE)`
# escapa TODO reservado -incluida la barra, a `%2F`- porque trata la cadena
# como un segmento de path; el enlace real que Gonzalo confirmo en produccion
# la deja sin escapar dentro del query, que es donde vive.
.collection_encode_param_name <- function(name) {
  name <- gsub("[", "%5B", as.character(name), fixed = TRUE)
  gsub("]", "%5D", name, fixed = TRUE)
}

# Deliberadamente sin `sid`: un QR impreso tiene que resolver igual dentro de
# un mes, con la sesion que lo genero hace tiempo cerrada. `binding` y
# `deployment$target` (unicos insumos, vienen del llamador) son parte de
# `collection_state`, que persiste dentro del `.pulso` -no es un cache
# derivable que `.pulso_strip_caches()` pode al guardar-.
.collection_access_url <- function(binding, sensitivity, provider = "kobo", return_url = "") {
  ref <- as.character(binding$access_ref %||% "")
  if (length(ref) != 1L || !nzchar(ref) || !grepl("^https?://", ref, ignore.case = TRUE) ||
      !tolower(sensitivity) %in% c("public", "operational")) return("")
  url <- ref
  prefill <- binding$prefill %||% list()
  if (identical(binding$access_kind, "parameterized_link") && length(prefill)) {
    # Un valor de personalizacion vacio o NA NO produce enlace.
    #
    # Sin este corte, una unidad sin codigo daba `d[collectorID]=` —un QR que
    # escanea bien, abre el formulario bien y llega SIN identificador, asi que la
    # respuesta entra anonima y nadie se entera hasta el analisis—. Y el NA era
    # peor que el vacio: `d[collectorID]=NA` si lleva identificador, y es la
    # cadena «NA», con lo que TODAS las unidades sin codigo se acumulan en un
    # mismo colector inventado que parece legitimo.
    #
    # Devolver "" y no colgar el parametro a secas: un enlace sin el parametro se
    # ve sano y falla igual de callado. Vacio es el valor que el resto del motor
    # ya entiende como «esta unidad no tiene acceso todavia» y que la vista sabe
    # enseñar.
    valores <- vapply(prefill, function(v) {
      v <- suppressWarnings(as.character(v)[1])
      if (is.na(v)) "" else trimws(v)
    }, character(1))
    if (any(!nzchar(valores))) return("")
    query <- paste(vapply(names(prefill), function(key) {
      paste0(
        .collection_encode_param_name(.collection_prefill_param(key, provider)), "=",
        utils::URLencode(as.character(prefill[[key]]), reserved = TRUE)
      )
    }, character(1)), collapse = "&")
    url <- paste0(url, if (grepl("?", url, fixed = TRUE)) "&" else "?", query)
  }
  return_url <- suppressWarnings(as.character(return_url %||% "")[1])
  return_url <- if (is.na(return_url)) "" else trimws(return_url)
  if (nzchar(return_url)) {
    url <- paste0(
      url, if (grepl("?", url, fixed = TRUE)) "&" else "?",
      "returnUrl=", utils::URLencode(return_url, reserved = TRUE)
    )
  }
  url
}

.collection_monitoring_handoff <- function(existing, plan, deployment, receipt) {
  rows <- .collection_rows(existing)
  sensitivity <- deployment$sensitivity$access_urls %||% "restricted"
  row_ids <- function(row) unique(vapply(
    c("collection_unit_id", "operational_code", "classroom_id", "curso_horario", "id"),
    function(field) .collection_first_string(row, field), character(1)
  ))
  for (binding in deployment$bindings %||% list()) {
    unit <- Filter(function(x) identical(x$unit_id, binding$unit_id), plan$units %||% list())
    if (!length(unit)) next
    unit <- unit[[1]]
    legacy_ref <- .collection_first_string(unit$dimensions %||% list(), "legacy_ref", unit$unit_id)
    hits <- which(vapply(rows, function(row) {
      any(c(unit$unit_id, legacy_ref) %in% row_ids(row))
    }, logical(1)))
    index <- if (length(hits)) hits[[1]] else length(rows) + 1L
    row <- if (length(hits)) rows[[index]] else list(
      classroom_id = legacy_ref,
      operational_code = legacy_ref,
      label = unit$label,
      sample_role = unit$role,
      wave = unit$group,
      # Sin esto la cadena de reemplazos es invisible en Monitoreo: la seccion
      # de reemplazos filtra por `replacement_for`, y salia vacia aunque el
      # sorteo hubiera encadenado reservas.
      replacement_for = .collection_first_string(unit$dimensions %||% list(), "replacement_for"),
      replacement_order = .collection_first_number(unit$dimensions %||% list(), "replacement_order"),
      faculty = .collection_first_string(unit$dimensions %||% list(), "faculty"),
      course_name = .collection_first_string(unit$dimensions %||% list(), "course_name"),
      schedule = .collection_first_string(unit$dimensions %||% list(), "schedule"),
      teacher = .collection_first_string(unit$dimensions %||% list(), "teacher"),
      # Sin el tamano del aula, Monitoreo no tiene meta contra la que medir: la
      # brecha sale 0 y ninguna aula llega nunca a "cerrando". El dato ya viaja
      # en la unidad del plan, solo faltaba copiarlo a la fila.
      eligible_n = .collection_first_number(unit$dimensions %||% list(), "eligible_n") %||% 0,
      stratum = .collection_first_string(unit$dimensions %||% list(), "stratum"),
      sex_top_1 = .collection_first_string(unit$dimensions %||% list(), "sex_top_1"),
      sex_top_1_n = .collection_first_number(unit$dimensions %||% list(), "sex_top_1_n") %||% 0,
      sex_top_2 = .collection_first_string(unit$dimensions %||% list(), "sex_top_2"),
      sex_top_2_n = .collection_first_number(unit$dimensions %||% list(), "sex_top_2_n") %||% 0,
      # `planificada` es la palabra del vocabulario de Monitoreo
      # (`monitoreo_aulas_estados()`). Aqui decia "pendiente", que no esta en
      # esa lista: el plan salia del handoff con un estado que su consumidor no
      # reconocia.
      operational_status = "planificada"
    )
    row$collection_unit_id <- unit$unit_id
    row$collection_deployment_id <- deployment$deployment_id
    row$collection_deployment_fingerprint <- receipt$deployment_fingerprint
    row$access_id <- binding$access_id
    row$logical_collector_id <- binding$logical_collector_id
    row$provider_collector_id <- binding$provider_collector_id
    row$recipient_id <- binding$recipient_id
    row$operator_id <- binding$operator_id
    row$access_kind <- binding$access_kind
    row$link <- .collection_access_url(binding, sensitivity, deployment$target$provider, deployment$target$return_url)
    row$access_ref_hash <- collection_fingerprint(binding$access_ref %||% "")
    row["qr"] <- list(NULL)
    rows[[index]] <- row
  }
  lapply(rows, function(row) {
    qr <- .collection_first_string(row, "qr")
    if (grepl("^data:", qr, ignore.case = TRUE)) row["qr"] <- list(NULL)
    row
  })
}

collection_handoff <- function(sid, expected_revision, deployment_fingerprint = NULL) {
  s <- session_get(sid)
  current <- .collection_current(s)
  .collection_expected_revision(expected_revision)
  deployment <- current$deployment
  reasons <- .collection_stale_reasons(current)
  if (!is.list(deployment) || length(reasons) || identical(deployment$status, "stale")) {
    stop_api(
      409, "E_COLLECTION_HANDOFF_STALE",
      "El deployment está stale o ya no coincide con el plan; no se escribió el handoff.",
      details = list(reasons = as.list(reasons))
    )
  }
  fingerprint <- .collection_deployment_fingerprint(deployment)
  if (.cc_is_scalar_string(deployment_fingerprint) &&
      !identical(deployment_fingerprint, fingerprint)) {
    stop_api(
      409, "E_COLLECTION_HANDOFF_STALE",
      "El deployment cambió desde que se preparó el handoff."
    )
  }
  receipt <- deployment$handoff
  if (identical(deployment$status, "handed_off") && is.list(receipt) &&
      identical(receipt$deployment_fingerprint, fingerprint)) {
    return(.collection_con_vigencia(.collection_payload(current, noop = TRUE), sid))
  }
  .collection_assert_revision(current, expected_revision)
  if (!identical(deployment$status, "prepared")) {
    stop_api(409, "E_COLLECTION_HANDOFF_NOT_READY", "El deployment debe estar prepared antes del handoff.")
  }
  next_state <- current
  next_revision <- as.integer(current$state_revision) + 1L
  receipt <- list(
    schema = "collection_handoff/v1",
    deployment_id = deployment$deployment_id,
    deployment_fingerprint = fingerprint,
    plan_fingerprint = current$plan$input_fingerprint,
    handed_off_at = .collection_now_iso(),
    state_revision = next_revision
  )
  next_state$deployment$status <- "handed_off"
  next_state$deployment$deployment_fingerprint <- fingerprint
  next_state$deployment$handoff <- receipt
  next_state$state_revision <- next_revision
  monitoring_projection <- function(fresh) {
    .collection_monitoring_handoff(
      fresh$monitoreo_aulas_plan, current$plan, next_state$deployment, receipt
    )
  }
  .collection_store(sid, next_state, monitoring_plan = monitoring_projection)
  monitoring <- session_get(sid)$monitoreo_aulas_plan
  payload <- .collection_con_vigencia(.collection_payload(next_state), sid)
  payload$handoff <- receipt
  payload$monitoring_rows <- monitoring
  payload
}
