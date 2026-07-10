# =============================================================================
# Endpoint HTTP de resumen de proyecto (mission control del Home)
# =============================================================================
#
# Expone GET /api/project/overview: un resumen read-only del estado del
# proyecto para el Home adaptativo. Reutiliza el agregador de estado por modulo
# (.diseno_protocol_summary / .diseno_module_statuses) que vive en
# router_diseno_estudio.R; como prosecnurapp carga todos los R/ en un mismo
# namespace, no se duplica logica. El payload es deliberadamente compacto: no
# serializa datos crudos, mapas pesados, secretos ni entregables.

# Slugs de los modulos primarios que un proyecto puede "agregar". Deben coincidir
# con lib/modules.ts (PROSECNUR_MODULES). "diseno-estudio" es el modulo Bitacora.
.PROJECT_PRIMARY_SLUGS <- c(
  "diseno-estudio", "procesamiento", "dashboard", "hojas-ruta",
  "calc-muestra", "recopiladores", "monitoreo", "editor-xlsform"
)

.project_normalize_modules <- function(value) {
  if (is.null(value)) return(NULL)
  slugs <- as.character(unlist(value, use.names = FALSE))
  slugs <- slugs[slugs %in% .PROJECT_PRIMARY_SLUGS]
  as.list(unique(slugs))
}

# Lista curada de modulos agregados al proyecto, o NULL si nunca se definio
# (el frontend deriva un default a partir del avance real).
.project_added_modules <- function(s) {
  raw <- s$project_modules %||% NULL
  if (is.null(raw)) return(NULL)
  .project_normalize_modules(raw)
}

.overview_maturity <- function(statuses, score) {
  worked <- Filter(function(item) !identical(item$id, "proyecto"), statuses)
  has_any_work <- any(vapply(worked, function(item) {
    item$state %in% c("ready", "active")
  }, logical(1)))
  ready_count <- sum(vapply(statuses, function(item) identical(item$state, "ready"), logical(1)))
  active_count <- sum(vapply(statuses, function(item) identical(item$state, "active"), logical(1)))
  warning_count <- sum(vapply(statuses, function(item) identical(item$state, "warning"), logical(1)))
  pending_count <- sum(vapply(statuses, function(item) identical(item$state, "pending"), logical(1)))
  list(
    level = if (isTRUE(has_any_work)) "in_progress" else "new",
    has_any_work = isTRUE(has_any_work),
    readiness_score = as.integer(score),
    ready_count = as.integer(ready_count),
    active_count = as.integer(active_count),
    warning_count = as.integer(warning_count),
    pending_count = as.integer(pending_count),
    total_count = length(statuses)
  )
}

.overview_metrics <- function(s, protocol) {
  snapshot <- s$monitoreo_snapshot %||% NULL
  last_cut <- .diseno_scalar(
    (snapshot %||% list())$synced_at %||% (snapshot %||% list())$generated_at, ""
  )
  list(
    bases_count = as.integer(protocol$bases_count),
    records_count = as.integer(protocol$records_count),
    variables_count = as.integer(protocol$variables_count),
    sample_target_n = as.integer(protocol$sample_target_n),
    classroom_units_count = as.integer(protocol$classroom_units_count),
    monitoring_sources_count = as.integer(protocol$monitoring_sources_count),
    monitoring_family = .diseno_scalar(protocol$monitoring_family, ""),
    monitoreo_last_cut = last_cut
  )
}

# -----------------------------------------------------------------------------
# Helpers de extraccion defensiva para los facts por modulo. Todos toleran la
# ambiguedad de forma que introduce el round-trip del .pulso: un data.frame en
# sesion puede volver como data.frame (RDS) o como lista fila-a-fila (JSON), y
# un escalar como length-1 o NULL. Nada aqui debe poder lanzar: si el dato no
# esta, el fact degrada a 0/"" y la tarjeta lo oculta.
# -----------------------------------------------------------------------------

# Porcentaje conocido o -1 cuando no hay meta/dato (el frontend pinta "—").
.overview_pct <- function(v) {
  if (is.null(v) || length(v) == 0L) return(-1)
  n <- suppressWarnings(as.numeric(v[[1L]]))
  if (!is.finite(n) || n < 0) -1 else round(n, 1)
}

# Lee un escalar de un "summary" metric/value que puede venir orientado por
# columna (data.frame: $metric/$value vectores) o por fila (lista de {metric,value}).
.overview_summary_metric <- function(summary, key, default = 0L) {
  if (is.null(summary)) return(as.integer(default))
  metrics <- summary$metric
  values <- summary$value
  if (!is.null(metrics) && !is.null(values)) {
    metrics <- as.character(unlist(metrics, use.names = FALSE))
    values <- as.character(unlist(values, use.names = FALSE))
    idx <- match(key, metrics)
    if (!is.na(idx) && idx <= length(values)) {
      out <- suppressWarnings(as.numeric(values[[idx]]))
      return(if (is.finite(out)) as.integer(out) else as.integer(default))
    }
    return(as.integer(default))
  }
  if (is.list(summary)) {
    for (row in summary) {
      if (identical(.diseno_scalar(row$metric, ""), key)) {
        out <- suppressWarnings(as.numeric(.diseno_scalar(row$value, "")))
        return(if (is.finite(out)) as.integer(out) else as.integer(default))
      }
    }
  }
  as.integer(default)
}

# Valores de una columna de un tabular orientado por columna (df/lista de
# columnas) o por fila (lista de registros).
.overview_col_values <- function(tabular, colname) {
  if (is.null(tabular)) return(character(0))
  col <- tabular[[colname]]
  if (!is.null(col)) return(as.character(unlist(col, use.names = FALSE)))
  if (is.list(tabular)) {
    return(vapply(tabular, function(r) .diseno_scalar(r[[colname]], ""), character(1)))
  }
  character(0)
}

# Normaliza un plan/tabla a lista de registros (una entrada por fila).
.overview_rows <- function(tabular) {
  if (is.null(tabular)) return(list())
  if (is.data.frame(tabular)) {
    if (!nrow(tabular)) return(list())
    return(lapply(seq_len(nrow(tabular)), function(i) as.list(tabular[i, , drop = FALSE])))
  }
  if (is.list(tabular)) return(tabular)
  list()
}

# Monitoreo: KPIs conscientes de la familia (territorial/telefonico/aulas/
# acreditacion). El avance_pct y los conteos viven en rutas distintas del
# snapshot$dashboard segun la familia, por eso el dispatch.
.overview_monitoreo_facts <- function(s, family) {
  snap <- s$monitoreo_snapshot %||% list()
  dash <- snap$dashboard %||% list()
  fam <- .diseno_scalar(family, "")
  collected <- 0L; valid <- 0L; target <- 0L; avance <- -1; alerts <- 0L
  if (identical(fam, "territorial")) {
    k <- (dash$territorial_reports %||% list())$kpis %||% list()
    collected <- as.integer(.diseno_num(k$total_respuestas, 0))
    valid <- as.integer(.diseno_num(k$validas, 0))
    target <- as.integer(.diseno_num(k$meta, 0))
    avance <- .overview_pct(k$avance_pct)
    alerts <- as.integer(.diseno_num(k$revision, 0) + .diseno_num(k$geo_no_defendible, 0))
  } else if (identical(fam, "aulas_universitarias")) {
    k <- (dash$aulas_universitarias_reports %||% list())$kpis %||% list()
    collected <- as.integer(.diseno_num(k$respuestas_total, 0))
    valid <- as.integer(.diseno_num(k$respuestas_validas, 0))
    avance <- .overview_pct(k$avance_pct)
    alerts <- as.integer(.diseno_num(k$quota_cells_pending, 0) + .diseno_num(k$brechas, 0))
  } else {
    k <- dash$kpis %||% list()
    collected <- as.integer(.diseno_num(k$total, 0))
    valid <- as.integer(.diseno_num(k$valid, 0))
    target <- as.integer(.diseno_num(k$target, 0))
    avance <- .overview_pct(k$avance_pct)
    alerts <- as.integer(.diseno_num(k$inconsistencies, 0))
  }
  list(
    family = fam,
    has_snapshot = .diseno_has_content(snap),
    collected = collected,
    valid = valid,
    target = target,
    avance_pct = avance,
    alerts = alerts
  )
}

# Calculo de muestra: modo (aulas/territorial/general) + cifras del modo.
.overview_calc_facts <- function(s) {
  calc <- s$calc_muestra_estudio %||% list()
  macro <- .diseno_scalar(calc$macro_familia, "")
  aulas_sel <- s$calc_muestra_aulas_selection %||% NULL
  summary <- if (is.list(aulas_sel)) aulas_sel$summary else NULL
  titulares <- .overview_summary_metric(summary, "n_aulas_m1", 0L)
  students <- .overview_summary_metric(summary, "unique_students_covered", 0L)
  fac_vals <- .overview_col_values(if (is.list(aulas_sel)) aulas_sel$selection else NULL, "faculty")
  faculties <- length(unique(fac_vals[nzchar(fac_vals)]))
  comps <- calc$componentes %||% list()
  tech_vals <- vapply(comps, function(c) .diseno_scalar(c$tecnica, ""), character(1))
  actor_vals <- vapply(comps, function(c) .diseno_scalar(c$actor_categoria, ""), character(1))
  territories <- 0L
  for (comp in comps) {
    r <- comp$resultado %||% list()
    dt <- r$distribucion_territorios %||% r$distribucion_estratos %||% NULL
    if (!is.null(dt) && length(dt) > territories) territories <- length(dt)
  }
  has_aulas <- titulares > 0L || (!is.null(aulas_sel) && .diseno_has_content(aulas_sel))
  mode <- if (has_aulas) "aulas" else if (identical(macro, "territorial") || territories > 0L) "territorial" else "general"
  list(
    macro_familia = macro,
    mode = mode,
    aulas_titulares = as.integer(titulares),
    students_covered = as.integer(students),
    faculties_count = as.integer(faculties),
    territories_count = as.integer(territories),
    techniques_count = length(unique(tech_vals[nzchar(tech_vals)])),
    actors_count = length(unique(actor_vals[nzchar(actor_vals)]))
  )
}

# Hojas de ruta: fase + salidas territoriales reales (distritos, manzanas,
# entrevistas, cuotas). Sustituye al enganoso "bloques de salida".
.overview_hojas_facts <- function(s) {
  cfg <- s$hojas_ruta_config %||% list()
  outputs <- s$hojas_ruta_workspace_outputs %||% list()
  sample <- outputs$sample %||% list()
  quota <- outputs$quota %||% list()
  runs <- s$hojas_ruta_runs %||% list()
  list(
    phase = .diseno_scalar(s$hojas_ruta_active_phase, ""),
    districts_count = length(cfg$territorios %||% list()),
    n_objetivo = as.integer(.diseno_num(cfg$n_objetivo, 0)),
    blocks_count = as.integer(.diseno_num(sample$n_blocks, 0)),
    replacement_blocks_count = as.integer(.diseno_num(sample$n_replacement_blocks, 0)),
    interviews_count = as.integer(.diseno_num(sample$total_entrevistas, 0)),
    quota_assigned = as.integer(.diseno_num(quota$total_asignado, 0)),
    from_pilot = .diseno_has_content(runs$pilot) && .diseno_has_content(runs$field)
  )
}

# Fichas QR (recopiladores): del plan de aulas real, no de la seleccion de
# calculo de muestra. Titulares, fichas con enlace, facultades, elegibles.
.overview_fichas_facts <- function(s) {
  rows <- .overview_rows(s$monitoreo_aulas_plan %||% list())
  titulares <- 0L; titulares_with_link <- 0L; eligible <- 0
  facs <- character(0)
  for (r in rows) {
    wave <- .diseno_scalar(r$wave, "")
    role <- .diseno_scalar(r$sample_role, "")
    is_titular <- identical(wave, "M1") || identical(role, "titular")
    has_link <- nzchar(.diseno_scalar(r$link, ""))
    if (is_titular) {
      titulares <- titulares + 1L
      if (has_link) titulares_with_link <- titulares_with_link + 1L
    }
    fac <- .diseno_scalar(r$faculty, "")
    if (nzchar(fac)) facs <- c(facs, fac)
    eligible <- eligible + .diseno_num(r$eligible_n, 0)
  }
  list(
    total = length(rows),
    titulares = as.integer(titulares),
    # Fichas de titulares con enlace vs las que faltan por generar (las
    # reservas son respaldo; el operativo real se mide sobre titulares).
    with_link = as.integer(titulares_with_link),
    without_link = as.integer(max(0L, titulares - titulares_with_link)),
    faculties_count = length(unique(facs)),
    eligible_total = as.integer(eligible)
  )
}

# Editor XLSForm: cuestionario propio (preguntas/secciones/catalogos/origen),
# no la data del estudio.
.overview_form_facts <- function(s) {
  st <- s$xlsform_state %||% list()
  wb <- st$workbook %||% list()
  source_kind <- .diseno_scalar((st$source %||% list())$kind, "")
  survey <- wb$survey %||% list()
  cols <- as.character(unlist(survey$columns %||% list(), use.names = FALSE))
  rows <- survey$rows %||% list()
  questions <- 0L; sections <- 0L
  if (length(cols) && length(rows)) {
    ti <- match("type", cols)
    ni <- match("name", cols)
    group_markers <- c("begin_group", "begin group", "begin_repeat", "begin repeat")
    skip_markers <- c("end_group", "end group", "end_repeat", "end repeat", "")
    for (row in rows) {
      cells <- as.character(unlist(row, use.names = FALSE))
      t <- if (!is.na(ti) && ti <= length(cells)) cells[[ti]] else ""
      nm <- if (!is.na(ni) && ni <= length(cells)) cells[[ni]] else ""
      base <- tolower(trimws(sub("\\s.*$", "", t)))
      if (base %in% group_markers) { sections <- sections + 1L; next }
      if (base %in% skip_markers) next
      if (nzchar(nm)) questions <- questions + 1L
    }
  }
  choices <- wb$choices %||% list()
  ccols <- as.character(unlist(choices$columns %||% list(), use.names = FALSE))
  crows <- choices$rows %||% list()
  catalogs <- 0L
  li <- match("list_name", ccols)
  if (!is.na(li) && length(crows)) {
    lists <- vapply(crows, function(row) {
      cells <- as.character(unlist(row, use.names = FALSE))
      if (li <= length(cells)) cells[[li]] else ""
    }, character(1))
    catalogs <- length(unique(lists[nzchar(lists)]))
  }
  list(
    source_kind = source_kind,
    questions_count = as.integer(questions),
    sections_count = as.integer(sections),
    catalogs_count = as.integer(catalogs)
  )
}

# Dashboard: curacion (secciones, confirmada) + registros propios + publicacion.
.overview_dashboard_facts <- function(s) {
  cur <- tryCatch(.dashboard_curacion_saved(s), error = function(e) {
    list(confirmed = FALSE, exclude_vars = list(), exclude_sections = list())
  })
  n_secs <- tryCatch(as.integer(.diseno_num(.dashboard_manifest(s)$estado$n_secciones, 0)),
                     error = function(e) 0L)
  src <- s$dashboard_source %||% list()
  cfg <- s$dashboard_config %||% list()
  deploy <- cfg$last_deploy %||% NULL
  list(
    sections_count = n_secs,
    excluded_vars_count = length(cur$exclude_vars %||% list()),
    confirmed = isTRUE(cur$confirmed),
    published = !is.null(deploy) && .diseno_has_content(deploy),
    published_at = .diseno_scalar((deploy %||% list())$published_at, ""),
    rows_count = as.integer(.diseno_num(src$n_filas, 0))
  )
}

# Datos de dominio por módulo que las tarjetas del Home resaltan. La bitácora
# separa lo que el usuario REGISTRA (log de entradas) de lo PLANIFICADO
# (cronograma). El resto de módulos exponen sus cifras características, cada uno
# consciente del modo/ruta que el proyecto está usando. Cada extracción degrada
# a valores neutros ante datos ausentes; el envoltorio tryCatch evita que un
# proyecto atípico tumbe todo el overview.
.overview_facts <- function(s, protocol = list()) {
  plan <- s$plan_trabajo %||% list()
  tasks <- plan$tasks %||% list()
  today <- format(Sys.Date(), "%Y-%m-%d")

  dated <- Filter(function(t) {
    kind <- .diseno_scalar(t$kind, "")
    (kind %in% c("milestone", "deliverable")) && nzchar(.diseno_scalar(t$start_date, ""))
  }, tasks)
  next_title <- ""
  next_date <- ""
  if (length(dated) > 0L) {
    dates <- vapply(dated, function(t) .diseno_scalar(t$start_date, ""), character(1))
    ord <- order(dates)
    dated <- dated[ord]
    dates <- dates[ord]
    upcoming <- which(dates >= today)
    pick <- if (length(upcoming) > 0L) upcoming[[1L]] else length(dated)
    next_title <- .diseno_scalar(dated[[pick]]$activity, "")
    next_date <- dates[[pick]]
  }
  pending <- length(Filter(function(t) {
    !(.diseno_scalar(t$status, "planned") %in% c("done"))
  }, tasks))

  # Log de bitácora (lo que el usuario escribe), distinto del cronograma.
  entries <- tryCatch(.diseno_bitacora_entries(s), error = function(e) list())
  entries_count <- length(entries)
  last_entry_at <- if (entries_count > 0L) .diseno_scalar(entries[[1L]]$occurred_at, "") else ""
  last_entry_title <- if (entries_count > 0L) .diseno_scalar(entries[[1L]]$title, "") else ""
  tone_count <- function(tone) {
    if (entries_count == 0L) return(0L)
    sum(vapply(entries, function(e) identical(.diseno_scalar(e$tone, ""), tone), logical(1)))
  }

  safe <- function(expr, default) tryCatch(expr, error = function(e) default)

  list(
    bitacora = list(
      next_title = next_title,
      next_date = next_date,
      pending = as.integer(pending),
      total_tasks = length(tasks),
      entries_count = as.integer(entries_count),
      last_entry_at = last_entry_at,
      last_entry_title = last_entry_title,
      decisions_count = as.integer(tone_count("decision")),
      risks_count = as.integer(tone_count("riesgo")),
      blocks_count = as.integer(tone_count("bloqueo"))
    ),
    monitoreo = safe(.overview_monitoreo_facts(s, protocol$monitoring_family),
                     list(family = "", has_snapshot = FALSE, collected = 0L, valid = 0L,
                          target = 0L, avance_pct = -1, alerts = 0L)),
    calc = safe(.overview_calc_facts(s),
                list(macro_familia = "", mode = "general", aulas_titulares = 0L,
                     students_covered = 0L, faculties_count = 0L, territories_count = 0L,
                     techniques_count = 0L, actors_count = 0L)),
    hojas = safe(.overview_hojas_facts(s),
                 list(phase = "", districts_count = 0L, n_objetivo = 0L, blocks_count = 0L,
                      replacement_blocks_count = 0L, interviews_count = 0L,
                      quota_assigned = 0L, from_pilot = FALSE)),
    recopiladores = safe(.overview_fichas_facts(s),
                         list(total = 0L, titulares = 0L, with_link = 0L, without_link = 0L,
                              faculties_count = 0L, eligible_total = 0L)),
    editor = safe(.overview_form_facts(s),
                  list(source_kind = "", questions_count = 0L, sections_count = 0L,
                       catalogs_count = 0L)),
    dashboard = safe(.overview_dashboard_facts(s),
                     list(sections_count = 0L, excluded_vars_count = 0L, confirmed = FALSE,
                          published = FALSE, published_at = "", rows_count = 0L))
  )
}

.project_overview_payload <- function(sid) {
  s <- session_get(sid)
  protocol <- .diseno_protocol_summary(s)
  statuses <- .diseno_module_statuses(s, protocol)
  weights <- vapply(statuses, function(item) .diseno_state_weight(item$state), numeric(1))
  score <- as.integer(round(100 * sum(weights) / max(length(statuses), 1L)))
  risks <- .diseno_risks(statuses, protocol)
  maturity <- .overview_maturity(statuses, score)
  has_project <- nzchar(.diseno_scalar(s$project_path, ""))

  payload <- list(
    ok = TRUE,
    schema = "project_overview_v1",
    generated_at = .diseno_now_iso(),
    project = list(
      name = .diseno_scalar(protocol$title, "Proyecto sin titulo"),
      client = .diseno_scalar(protocol$client, ""),
      project_file = .diseno_scalar(protocol$project_file, ""),
      has_project = isTRUE(has_project),
      processing_mode = .diseno_scalar(protocol$processing_mode, "multibase"),
      saved_at = .diseno_scalar(s$project_last_saved_at, "")
    ),
    maturity = maturity,
    metrics = .overview_metrics(s, protocol),
    protocol = protocol,
    facts = .overview_facts(s, protocol),
    modules = statuses,
    next_actions = .diseno_next_actions(statuses),
    risks = risks
  )
  # added_modules solo se incluye cuando el proyecto YA curó su lista (lista,
  # incluida la vacía []). Si nunca se curó (NULL), se OMITE la clave para que
  # el frontend derive el default — jsonlite serializaría NULL como {} y
  # rompería al frontend, por eso no lo mandamos como null.
  added <- .project_added_modules(s)
  if (!is.null(added)) payload$added_modules <- added
  payload
}

mount_project_overview <- function(pr) {
  pr |>
    plumber::pr_get("/api/project/overview",
                    wrap_endpoint(function(req, res) {
      .project_overview_payload(session_header(req))
    })) |>
    plumber::pr_post("/api/project/modules",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(trimws(body_raw))) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) list())
      } else {
        list()
      }
      modules <- .project_normalize_modules(body$modules %||% list())
      session_set(sid, "project_modules", modules %||% list())
      list(ok = TRUE, modules = modules %||% list())
    }))
}
