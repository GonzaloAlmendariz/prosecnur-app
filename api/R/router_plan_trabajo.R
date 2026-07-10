# =============================================================================
# Endpoints HTTP de Plan de Trabajo
# =============================================================================
#
# El modulo guarda un plan operativo normalizado a partir de cronogramas Excel.
# Es la verdad planificada del proyecto: actividades, fases, responsables,
# productos, ventanas, hitos y destinos de sincronizacion. Los modulos
# operativos devuelven evidencia real por contrato; no se mutan desde aqui.

.plan_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.plan_parse_body <- function(req) {
  body_raw <- req$postBody %||% "{}"
  if (!nzchar(trimws(body_raw))) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_PLAN_JSON", "Body JSON invalido.")
  )
}

.plan_scalar <- function(value, default = "") {
  if (is.null(value) || length(value) == 0L) return(default)
  out <- suppressWarnings(as.character(value[[1]]))
  if (is.na(out) || !nzchar(trimws(out))) default else trimws(out)
}

.plan_text <- function(value, max_chars = 600L) {
  out <- .plan_scalar(value, "")
  out <- gsub("[\001-\010\013\014\016-\037\177]", "", out, perl = TRUE)
  out <- gsub("[\r\n]+", " / ", out)
  out <- gsub("\\s+", " ", out)
  out <- trimws(out)
  if (nchar(out, type = "chars") > max_chars) out <- paste0(substr(out, 1L, max_chars), "...")
  out
}

.plan_numish <- function(value) {
  value <- .plan_scalar(value, "")
  grepl("^\\d+(?:\\.0+)?$", value)
}

.plan_num <- function(value, default = NA_real_) {
  if (!.plan_numish(value)) return(default)
  out <- suppressWarnings(as.numeric(.plan_scalar(value)))
  if (is.finite(out)) out else default
}

.plan_norm_key <- function(value) {
  value <- tolower(.plan_text(value, 300L))
  value <- iconv(value, from = "", to = "ASCII//TRANSLIT")
  value <- gsub("[^a-z0-9]+", "_", value)
  value <- gsub("^_+|_+$", "", value)
  value
}

.plan_month_number <- function(value) {
  key <- .plan_norm_key(value)
  months <- c(
    enero = 1L, ene = 1L,
    febrero = 2L, feb = 2L,
    marzo = 3L, mar = 3L,
    abril = 4L, abr = 4L,
    mayo = 5L, may = 5L,
    junio = 6L, jun = 6L,
    julio = 7L, jul = 7L,
    agosto = 8L, ago = 8L,
    septiembre = 9L, setiembre = 9L, sep = 9L, set = 9L,
    octubre = 10L, oct = 10L,
    noviembre = 11L, nov = 11L,
    diciembre = 12L, dic = 12L
  )
  out <- if (nzchar(key) && key %in% names(months)) months[[key]] else NA_integer_
  as.integer(out)
}

.plan_chr_list <- function(values, max_items = 8L) {
  if (is.null(values)) return(list())
  if (is.list(values)) values <- unlist(values, recursive = FALSE, use.names = FALSE)
  values <- stats::na.omit(as.character(values))
  values <- trimws(values)
  values <- values[nzchar(values)]
  as.list(utils::head(unique(values), max_items))
}

.plan_find_updated_date <- function(mat) {
  nr <- min(nrow(mat), 8L)
  if (nr <= 0L) return(NULL)
  text <- paste(as.vector(mat[seq_len(nr), , drop = FALSE]), collapse = " ")
  hit <- regexpr("([0-3]?\\d)[/-]([01]?\\d)[/-](20\\d{2})", text, perl = TRUE)
  if (hit[[1]] < 0L) return(NULL)
  raw <- regmatches(text, hit)
  parts <- as.integer(strsplit(raw, "[/-]")[[1]])
  out <- tryCatch(as.Date(sprintf("%04d-%02d-%02d", parts[[3]], parts[[2]], parts[[1]])), error = function(e) NA)
  if (is.na(out)) NULL else out
}

.plan_find_rows <- function(mat) {
  nr <- nrow(mat)
  nc <- ncol(mat)
  scan_rows <- seq_len(min(nr, 12L))
  date_counts <- vapply(scan_rows, function(r) sum(vapply(mat[r, ], .plan_numish, logical(1))), integer(1))
  date_row <- if (length(date_counts) && max(date_counts) >= 5L) scan_rows[[which.max(date_counts)]] else NA_integer_

  header_scores <- vapply(scan_rows, function(r) {
    row <- tolower(paste(mat[r, ], collapse = " "))
    score <- 0L
    if (grepl("actividades|subactividad|fases y sub", row)) score <- score + 2L
    if (grepl("responsable", row)) score <- score + 3L
    if (grepl("producto|resultado", row)) score <- score + 2L
    score
  }, integer(1))
  header_candidates <- scan_rows[header_scores > 0L]
  header_row <- if (length(header_candidates)) {
    header_candidates[[which.max(header_scores[header_candidates])]]
  } else if (!is.na(date_row)) {
    date_row
  } else {
    1L
  }

  header <- tolower(mat[header_row, ])
  activity_col <- which(grepl("actividades|subactividad|fases y sub", header))[1] %||% 1L
  responsible_col <- which(grepl("responsable", header))[1] %||% 2L
  product_col <- which(grepl("producto|resultado", header))[1] %||% NA_integer_

  if (is.na(date_row)) {
    date_row <- header_row
  }
  day_cols <- which(vapply(mat[date_row, ], .plan_numish, logical(1)))
  min_day_col <- max(1L, min(c(activity_col, responsible_col, product_col), na.rm = TRUE) + 1L)
  day_cols <- day_cols[day_cols >= min_day_col]
  if (!length(day_cols)) {
    fallback_row <- max(1L, header_row - 1L)
    day_cols <- which(vapply(mat[fallback_row, ], .plan_numish, logical(1)))
    day_cols <- day_cols[day_cols >= min_day_col]
    if (length(day_cols)) date_row <- fallback_row
  }

  list(
    header_row = as.integer(header_row),
    date_row = as.integer(date_row),
    activity_col = as.integer(activity_col),
    responsible_col = as.integer(responsible_col),
    product_col = as.integer(product_col),
    day_cols = as.integer(day_cols)
  )
}

.plan_month_labels <- function(mat, date_row, day_cols, fallback_month = NA_integer_) {
  if (!length(day_cols)) return(integer(0))
  month_marks <- list()
  if (date_row > 1L) {
    for (r in seq_len(date_row - 1L)) {
      for (c in day_cols) {
        m <- .plan_month_number(mat[r, c])
        if (is.finite(m)) month_marks[[as.character(c)]] <- as.integer(m)
      }
    }
  }
  out <- rep(as.integer(fallback_month), length(day_cols))
  names(out) <- as.character(day_cols)
  current <- as.integer(fallback_month)
  for (i in seq_along(day_cols)) {
    c <- day_cols[[i]]
    marked <- month_marks[[as.character(c)]] %||% NA_integer_
    if (is.finite(marked)) current <- as.integer(marked)
    out[[i]] <- current
  }
  out
}

.plan_date_map <- function(mat, rows) {
  day_cols <- rows$day_cols
  if (!length(day_cols)) return(list())
  day_values <- vapply(day_cols, function(c) .plan_num(mat[rows$date_row, c]), numeric(1))
  names(day_values) <- as.character(day_cols)
  if (!length(day_values) || any(day_values > 31, na.rm = TRUE)) return(list())

  updated <- .plan_find_updated_date(mat)
  year <- if (!is.null(updated)) as.integer(format(updated, "%Y")) else as.integer(format(Sys.Date(), "%Y"))
  fallback_month <- if (!is.null(updated)) as.integer(format(updated, "%m")) else NA_integer_
  month_by_col <- .plan_month_labels(mat, rows$date_row, day_cols, fallback_month)
  current_month <- month_by_col[[1]] %||% fallback_month
  previous_day <- NA_real_
  out <- list()
  for (i in seq_along(day_cols)) {
    c <- day_cols[[i]]
    day <- day_values[[i]]
    explicit_month <- month_by_col[[i]]
    if (is.finite(explicit_month)) current_month <- as.integer(explicit_month)
    if (is.finite(previous_day) && is.finite(day) && day < previous_day && !is.finite(explicit_month)) {
      current_month <- current_month + 1L
      if (current_month > 12L) {
        current_month <- 1L
        year <- year + 1L
      }
    }
    dt <- tryCatch(as.Date(sprintf("%04d-%02d-%02d", year, current_month, as.integer(day))), error = function(e) NA)
    if (!is.na(dt)) out[[as.character(c)]] <- format(dt, "%Y-%m-%d")
    previous_day <- day
  }
  out
}

.plan_phase_row <- function(activity) {
  key <- .plan_norm_key(activity)
  if (!nzchar(key)) return(FALSE)
  grepl("^(i|ii|iii|iv|v|vi|vii|viii|ix|x)_", key) ||
    grepl("^fase_", key) ||
    (toupper(activity) == activity && nchar(activity) > 6L)
}

.plan_task_targets <- function(activity, product = "") {
  text <- paste(.plan_norm_key(activity), .plan_norm_key(product))
  out <- character(0)
  if (grepl("campo|encuesta|supervision|monitoreo|levantamiento|aplicacion|aplicacio", text)) {
    out <- c(out, "monitoreo")
  }
  if (grepl("informe|reporte|entrega|presentacion|sistematizacion|resultados", text)) {
    out <- c(out, "reportes")
  }
  if (grepl("base_de_datos|datos|data|bd", text)) {
    out <- c(out, "carga")
  }
  if (grepl("muestra|muestral|seleccion", text)) {
    out <- c(out, "calc-muestra")
  }
  if (grepl("instrumento|cuestionario|protocolo|manual", text)) {
    out <- c(out, "editor-xlsform")
  }
  if (grepl("validacion|validaci|calidad|limpieza", text)) {
    out <- c(out, "validacion")
  }
  if (!length(out)) out <- "plan-trabajo"
  unique(out)
}

.plan_task_kind <- function(activity, duration_days, targets) {
  key <- .plan_norm_key(activity)
  if (duration_days <= 2L && grepl("entrega|aprobacion|reunion|informe|hito|envio", key)) return("milestone")
  if ("monitoreo" %in% targets) return("fieldwork_window")
  if ("reportes" %in% targets) return("deliverable")
  "activity"
}

.plan_parse_sheet <- function(path, sheet) {
  raw <- tryCatch(
    readxl::read_excel(path, sheet = sheet, col_names = FALSE, col_types = "text", .name_repair = "minimal"),
    error = function(e) NULL
  )
  if (is.null(raw) || !nrow(raw)) return(list(tasks = list(), phases = list(), warnings = list(sprintf("Hoja '%s' vacia o no legible.", sheet))))
  mat <- as.matrix(as.data.frame(raw, stringsAsFactors = FALSE, check.names = FALSE))
  mat[is.na(mat)] <- ""
  mat <- apply(mat, c(1, 2), .plan_text, max_chars = 1000L)
  rows <- .plan_find_rows(mat)
  if (!length(rows$day_cols)) {
    return(list(tasks = list(), phases = list(), warnings = list(sprintf("Hoja '%s' no tiene grilla temporal reconocible.", sheet))))
  }
  date_map <- .plan_date_map(mat, rows)
  current_phase <- ""
  tasks <- list()
  phases <- character(0)
  for (r in seq.int(max(rows$header_row, rows$date_row) + 1L, nrow(mat))) {
    activity <- .plan_text(mat[r, rows$activity_col], 900L)
    if (!nzchar(activity)) next
    marks <- rows$day_cols[toupper(trimws(mat[r, rows$day_cols])) %in% c("X", "×", "*", "●")]
    if (!length(marks)) {
      if (.plan_phase_row(activity)) {
        current_phase <- activity
        phases <- unique(c(phases, current_phase))
      }
      next
    }
    responsible <- .plan_text(mat[r, rows$responsible_col], 300L)
    product <- if (is.finite(rows$product_col)) .plan_text(mat[r, rows$product_col], 500L) else ""
    start_col <- min(marks)
    end_col <- max(marks)
    start_day <- as.integer(.plan_num(mat[rows$date_row, start_col], NA_real_))
    end_day <- as.integer(.plan_num(mat[rows$date_row, end_col], NA_real_))
    targets <- .plan_task_targets(activity, product)
    duration <- length(unique(marks))
    task <- list(
      id = sprintf("task_%03d", length(tasks) + 1L),
      sheet = sheet,
      row = as.integer(r),
      phase = current_phase,
      activity = activity,
      responsible = responsible,
      product = product,
      status = "planned",
      kind = .plan_task_kind(activity, duration, targets),
      start_date = .plan_scalar(date_map[[as.character(start_col)]] %||% "", ""),
      end_date = .plan_scalar(date_map[[as.character(end_col)]] %||% "", ""),
      start_time = "",
      end_time = "",
      start_day_index = start_day,
      end_day_index = end_day,
      duration_days = as.integer(duration),
      grid_start_col = as.integer(start_col),
      grid_end_col = as.integer(end_col),
      sync_targets = as.list(targets),
      notes = ""
    )
    tasks[[length(tasks) + 1L]] <- task
  }
  list(tasks = tasks, phases = as.list(phases), warnings = list())
}

.plan_extract_title <- function(path, sheet) {
  raw <- tryCatch(
    readxl::read_excel(path, sheet = sheet, col_names = FALSE, col_types = "text", n_max = 3, .name_repair = "minimal"),
    error = function(e) NULL
  )
  if (is.null(raw) || !nrow(raw)) return("")
  vals <- as.vector(as.matrix(raw))
  vals <- vapply(vals, .plan_text, character(1), max_chars = 180L)
  vals <- vals[nzchar(vals)]
  vals[[1]] %||% ""
}

.plan_windows <- function(tasks) {
  targets <- unique(unlist(lapply(tasks, function(t) unlist(t$sync_targets %||% list(), use.names = FALSE)), use.names = FALSE))
  lapply(targets, function(target) {
    hits <- Filter(function(t) target %in% unlist(t$sync_targets %||% list(), use.names = FALSE), tasks)
    starts <- vapply(hits, function(t) .plan_scalar(t$start_date, ""), character(1))
    ends <- vapply(hits, function(t) .plan_scalar(t$end_date, ""), character(1))
    starts <- starts[nzchar(starts)]
    ends <- ends[nzchar(ends)]
    list(
      module_id = target,
      task_count = length(hits),
      start_date = if (length(starts)) min(starts) else "",
      end_date = if (length(ends)) max(ends) else "",
      activities = .plan_chr_list(vapply(hits, function(t) t$activity, character(1)), 5L)
    )
  })
}

.plan_sync_preview <- function(s, tasks) {
  windows <- .plan_windows(tasks)
  lapply(windows, function(window) {
    module_id <- window$module_id
    has_evidence <- switch(module_id,
      monitoreo = !is.null(s$monitoreo_snapshot) || length(s$monitoreo_sources %||% list()) > 0L,
      reportes = isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok) || !is.null(s$monitoreo_publication),
      carga = !is.null(s$rp_data) || length(s$rp_data_sources %||% list()) > 0L,
      `calc-muestra` = !is.null(s$calc_muestra_estudio) || !is.null(s$calc_muestra_aulas_selection),
      `editor-xlsform` = !is.null(s$rp_inst) || length(s$rp_inst_sources %||% list()) > 0L,
      validacion = !is.null(s$evaluacion) || !is.null(s$plan_result),
      FALSE
    )
    c(window, list(
      evidence_state = if (isTRUE(has_evidence)) "evidence_available" else "planned_only",
      direction = "sync"
    ))
  })
}

.plan_normalize_import <- function(path, meta = list()) {
  sheets <- readxl::excel_sheets(path)
  parsed <- lapply(sheets, function(sheet) .plan_parse_sheet(path, sheet))
  tasks <- unlist(lapply(parsed, `[[`, "tasks"), recursive = FALSE, use.names = FALSE)
  phases <- unique(unlist(lapply(parsed, `[[`, "phases"), recursive = FALSE, use.names = FALSE))
  warnings <- unlist(lapply(parsed, `[[`, "warnings"), recursive = FALSE, use.names = FALSE)
  title <- .plan_extract_title(path, sheets[[1]] %||% 1L)
  if (!nzchar(title)) title <- tools::file_path_sans_ext(basename(.plan_scalar(meta$original_name, "Plan de trabajo")))
  milestones <- Filter(function(t) identical(t$kind, "milestone") || identical(t$kind, "deliverable"), tasks)
  list(
    ok = TRUE,
    schema = "plan_trabajo_v1",
    title = title,
    source = list(
      file_id = .plan_scalar(meta$file_id, ""),
      original_name = .plan_scalar(meta$original_name, basename(path)),
      uploaded_at = .plan_scalar(meta$uploaded_at, ""),
      sheets = as.list(sheets)
    ),
    updated_at = .plan_now_iso(),
    tasks = tasks,
    phases = as.list(phases),
    milestones = milestones,
    windows = .plan_windows(tasks),
    warnings = as.list(warnings)
  )
}

.plan_empty_state <- function(sid) {
  list(
    ok = TRUE,
    schema = "plan_trabajo_state_v1",
    generated_at = .plan_now_iso(),
    plan = list(
      ok = TRUE,
      schema = "plan_trabajo_v1",
      title = "",
      source = NULL,
      updated_at = "",
      tasks = list(),
      phases = list(),
      milestones = list(),
      windows = list(),
      warnings = list()
    ),
    readiness = list(score = 0L, task_count = 0L, milestone_count = 0L, window_count = 0L),
    sync = list()
  )
}

.plan_state_payload <- function(sid) {
  s <- session_get(sid)
  plan <- s$plan_trabajo %||% NULL
  if (is.null(plan) || !is.list(plan)) return(.plan_empty_state(sid))
  tasks <- plan$tasks %||% list()
  milestones <- plan$milestones %||% list()
  sync <- .plan_sync_preview(s, tasks)
  score <- 30L
  if (length(tasks) > 0L) score <- score + 35L
  if (length(milestones) > 0L) score <- score + 15L
  if (length(sync) > 0L) score <- score + 20L
  list(
    ok = TRUE,
    schema = "plan_trabajo_state_v1",
    generated_at = .plan_now_iso(),
    plan = plan,
    readiness = list(
      score = min(100L, as.integer(score)),
      task_count = length(tasks),
      milestone_count = length(milestones),
      window_count = length(plan$windows %||% list())
    ),
    sync = sync
  )
}

.plan_rebuild_derived <- function(plan) {
  tasks <- plan$tasks %||% list()
  plan$milestones <- Filter(function(t) identical(t$kind, "milestone") || identical(t$kind, "deliverable"), tasks)
  plan$windows <- .plan_windows(tasks)
  plan$updated_at <- .plan_now_iso()
  plan
}

.plan_update_task <- function(plan, id, patch) {
  tasks <- plan$tasks %||% list()
  idx <- which(vapply(tasks, function(t) identical(.plan_scalar(t$id, ""), id), logical(1)))
  if (!length(idx)) stop_api(404, "E_PLAN_TASK_NOT_FOUND", sprintf("Actividad '%s' no existe.", id))
  task <- tasks[[idx[[1L]]]]
  for (field in c("activity", "responsible", "product", "phase", "start_date", "end_date", "status", "notes")) {
    if (!is.null(patch[[field]])) task[[field]] <- .plan_text(patch[[field]], if (identical(field, "notes")) 900L else 500L)
  }
  for (field in c("start_time", "end_time")) {
    if (!is.null(patch[[field]])) task[[field]] <- .plan_time(patch[[field]])
  }
  if (!task$status %in% c("planned", "active", "done", "blocked", "risk")) task$status <- "planned"
  task$sync_targets <- as.list(.plan_task_targets(task$activity, task$product))
  task$duration_days <- .plan_date_span_days(
    .plan_scalar(task$start_date, ""), .plan_scalar(task$end_date, "")
  )
  task$kind <- .plan_task_kind(task$activity, as.integer(task$duration_days %||% 1L), unlist(task$sync_targets, use.names = FALSE))
  tasks[[idx[[1L]]]] <- task
  plan$tasks <- tasks
  .plan_rebuild_derived(plan)
}

.plan_kind_values <- c("activity", "milestone", "deliverable", "fieldwork_window")

# Plan interno vacio (schema plan_trabajo_v1) para poder crear actividades a
# mano sin haber importado un Excel.
.plan_empty_plan <- function() {
  list(
    ok = TRUE,
    schema = "plan_trabajo_v1",
    title = "",
    source = NULL,
    updated_at = .plan_now_iso(),
    tasks = list(),
    phases = list(),
    milestones = list(),
    windows = list(),
    warnings = list()
  )
}

.plan_date_span_days <- function(start_date, end_date) {
  if (!nzchar(start_date) || !nzchar(end_date)) return(1L)
  d0 <- suppressWarnings(as.Date(start_date))
  d1 <- suppressWarnings(as.Date(end_date))
  if (is.na(d0) || is.na(d1)) return(1L)
  span <- as.integer(d1 - d0) + 1L
  if (!is.finite(span) || span < 1L) 1L else span
}

# Normaliza una hora "HH:MM" (24h). "" cuando es invalida o vacia (all-day).
.plan_time <- function(value) {
  v <- trimws(.plan_text(value, 8L))
  if (!nzchar(v)) return("")
  m <- regmatches(v, regexec("^([0-9]{1,2}):([0-9]{2})$", v))[[1]]
  if (length(m) != 3L) return("")
  h <- suppressWarnings(as.integer(m[2]))
  mi <- suppressWarnings(as.integer(m[3]))
  if (is.na(h) || is.na(mi) || h > 23L || mi > 59L) return("")
  sprintf("%02d:%02d", h, mi)
}

# Crea una actividad/hito/entregable manual desde el calendario o la lista.
# Usa un id con prefijo UUID para no colisionar con los task_%03d importados.
.plan_create_task <- function(plan, patch) {
  if (is.null(patch) || !is.list(patch)) patch <- list()
  activity <- .plan_text(patch$activity, 900L)
  if (!nzchar(activity)) stop_api(400, "E_PLAN_TASK_ACTIVITY", "La actividad requiere un nombre.")
  responsible <- .plan_text(patch$responsible, 300L)
  product <- .plan_text(patch$product, 500L)
  phase <- .plan_text(patch$phase, 300L)
  start_date <- .plan_text(patch$start_date, 40L)
  end_date <- .plan_text(patch$end_date, 40L)
  if (!nzchar(end_date)) end_date <- start_date
  start_time <- .plan_time(patch$start_time)
  end_time <- .plan_time(patch$end_time)
  notes <- .plan_text(patch$notes, 900L)
  status <- .plan_scalar(patch$status, "planned")
  if (!status %in% c("planned", "active", "done", "blocked", "risk")) status <- "planned"
  targets <- .plan_task_targets(activity, product)
  duration <- .plan_date_span_days(start_date, end_date)
  kind <- .plan_scalar(patch$kind, "")
  if (!(kind %in% .plan_kind_values)) kind <- .plan_task_kind(activity, duration, targets)
  task <- list(
    id = paste0("task_m_", uuid::UUIDgenerate()),
    sheet = "",
    row = NA_integer_,
    phase = phase,
    activity = activity,
    responsible = responsible,
    product = product,
    status = status,
    kind = kind,
    start_date = start_date,
    end_date = end_date,
    start_time = start_time,
    end_time = end_time,
    start_day_index = NA_integer_,
    end_day_index = NA_integer_,
    duration_days = as.integer(duration),
    grid_start_col = NA_integer_,
    grid_end_col = NA_integer_,
    sync_targets = as.list(targets),
    notes = notes
  )
  tasks <- plan$tasks %||% list()
  tasks[[length(tasks) + 1L]] <- task
  plan$tasks <- tasks
  .plan_rebuild_derived(plan)
}

.plan_delete_task <- function(plan, id) {
  id <- .plan_scalar(id, "")
  tasks <- plan$tasks %||% list()
  next_tasks <- Filter(function(t) !identical(.plan_scalar(t$id, ""), id), tasks)
  plan$tasks <- next_tasks
  .plan_rebuild_derived(plan)
}

.plan_tasks_df <- function(tasks) {
  if (!length(tasks)) {
    return(data.frame(Mensaje = "Sin actividades importadas.", check.names = FALSE))
  }
  data.frame(
    ID = vapply(tasks, function(t) .plan_scalar(t$id, ""), character(1)),
    Fase = vapply(tasks, function(t) .plan_scalar(t$phase, ""), character(1)),
    Actividad = vapply(tasks, function(t) .plan_scalar(t$activity, ""), character(1)),
    Responsable = vapply(tasks, function(t) .plan_scalar(t$responsible, ""), character(1)),
    `Producto / resultado` = vapply(tasks, function(t) .plan_scalar(t$product, ""), character(1)),
    Inicio = vapply(tasks, function(t) .plan_scalar(t$start_date, ""), character(1)),
    Fin = vapply(tasks, function(t) .plan_scalar(t$end_date, ""), character(1)),
    Dias = vapply(tasks, function(t) as.integer(t$duration_days %||% 0L), integer(1)),
    Estado = vapply(tasks, function(t) .plan_scalar(t$status, "planned"), character(1)),
    Tipo = vapply(tasks, function(t) .plan_scalar(t$kind, "activity"), character(1)),
    Sincroniza = vapply(tasks, function(t) paste(unlist(t$sync_targets %||% list(), use.names = FALSE), collapse = ", "), character(1)),
    Notas = vapply(tasks, function(t) .plan_scalar(t$notes, ""), character(1)),
    check.names = FALSE
  )
}

.plan_windows_df <- function(windows) {
  if (!length(windows)) {
    return(data.frame(Mensaje = "Sin ventanas sincronizables.", check.names = FALSE))
  }
  data.frame(
    Modulo = vapply(windows, function(w) .plan_scalar(w$module_id, ""), character(1)),
    Actividades = vapply(windows, function(w) as.integer(w$task_count %||% 0L), integer(1)),
    Inicio = vapply(windows, function(w) .plan_scalar(w$start_date, ""), character(1)),
    Fin = vapply(windows, function(w) .plan_scalar(w$end_date, ""), character(1)),
    `Actividades clave` = vapply(windows, function(w) paste(unlist(w$activities %||% list(), use.names = FALSE), collapse = " | "), character(1)),
    check.names = FALSE
  )
}

.plan_export_xlsx <- function(sid, plan) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Resumen")
  openxlsx::addWorksheet(wb, "Actividades")
  openxlsx::addWorksheet(wb, "Ventanas")

  title_style <- openxlsx::createStyle(
    fontSize = 16, textDecoration = "bold", fontColour = "#17212F",
    fgFill = "#F8FAFC", border = "Bottom", borderColour = "#CBD5E4"
  )
  header_style <- openxlsx::createStyle(
    textDecoration = "bold", fontColour = "#FFFFFF", fgFill = "#0F766E",
    halign = "center", valign = "center", border = "Bottom", borderColour = "#0B5F58"
  )
  soft_style <- openxlsx::createStyle(fgFill = "#F1F5F9", border = "Bottom", borderColour = "#E2E8F0")

  summary <- data.frame(
    Campo = c("Plan", "Archivo fuente", "Actividades", "Hitos", "Ventanas", "Actualizado"),
    Valor = c(
      .plan_scalar(plan$title, "Plan de trabajo"),
      .plan_scalar((plan$source %||% list())$original_name, ""),
      length(plan$tasks %||% list()),
      length(plan$milestones %||% list()),
      length(plan$windows %||% list()),
      .plan_scalar(plan$updated_at, "")
    ),
    check.names = FALSE
  )
  openxlsx::writeData(wb, "Resumen", "Plan de trabajo", startRow = 1, startCol = 1)
  openxlsx::mergeCells(wb, "Resumen", cols = 1:2, rows = 1)
  openxlsx::addStyle(wb, "Resumen", title_style, rows = 1, cols = 1:2, gridExpand = TRUE)
  openxlsx::writeData(wb, "Resumen", summary, startRow = 3, startCol = 1)
  openxlsx::addStyle(wb, "Resumen", header_style, rows = 3, cols = 1:2, gridExpand = TRUE)
  openxlsx::addStyle(wb, "Resumen", soft_style, rows = 4:(3 + nrow(summary)), cols = 1:2, gridExpand = TRUE, stack = TRUE)
  openxlsx::setColWidths(wb, "Resumen", cols = 1:2, widths = c(22, 70))

  tasks_df <- .plan_tasks_df(plan$tasks %||% list())
  openxlsx::writeData(wb, "Actividades", tasks_df, withFilter = ncol(tasks_df) > 1L)
  openxlsx::addStyle(wb, "Actividades", header_style, rows = 1, cols = seq_len(ncol(tasks_df)), gridExpand = TRUE)
  openxlsx::freezePane(wb, "Actividades", firstActiveRow = 2)
  openxlsx::setColWidths(wb, "Actividades", cols = seq_len(ncol(tasks_df)), widths = "auto")

  windows_df <- .plan_windows_df(plan$windows %||% list())
  openxlsx::writeData(wb, "Ventanas", windows_df, withFilter = ncol(windows_df) > 1L)
  openxlsx::addStyle(wb, "Ventanas", header_style, rows = 1, cols = seq_len(ncol(windows_df)), gridExpand = TRUE)
  openxlsx::freezePane(wb, "Ventanas", firstActiveRow = 2)
  openxlsx::setColWidths(wb, "Ventanas", cols = seq_len(ncol(windows_df)), widths = "auto")

  out <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, out, overwrite = TRUE)
  out_name <- if (exists(".export_filename", mode = "function")) {
    .export_filename(sid, "plan_trabajo", "xlsx")
  } else {
    sprintf("plan_trabajo_%s.xlsx", format(Sys.Date(), "%Y%m%d"))
  }
  .register_output_file(sid, "plan_trabajo_xlsx", out, original_name = out_name)
}

mount_plan_trabajo <- function(pr) {
  pr |>
    plumber::pr_get("/api/plan-trabajo/state",
                    wrap_endpoint(function(req, res) {
      .plan_state_payload(session_header(req))
    })) |>
    plumber::pr_post("/api/plan-trabajo/import",
                     wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      body <- .plan_parse_body(req)
      file_id <- .plan_scalar(body$file_id %||% body$fileId, "")
      if (!nzchar(file_id)) stop_api(400, "E_PLAN_FILE_ID", "Falta file_id del cronograma.")
      meta <- get_file(sid, file_id)
      ext <- tolower(.plan_scalar(meta$ext %||% tools::file_ext(meta$path), ""))
      if (!(ext %in% c("xlsx", "xls"))) {
        stop_api(400, "E_PLAN_FILE_EXT", "Plan de trabajo requiere un archivo .xlsx o .xls.")
      }
      plan <- .plan_normalize_import(meta$path, meta)
      session_set(sid, "plan_trabajo", plan)
      .plan_state_payload(sid)
    })) |>
    plumber::pr_post("/api/plan-trabajo/tasks",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      plan <- s$plan_trabajo %||% NULL
      if (is.null(plan) || !is.list(plan)) plan <- .plan_empty_plan()
      body <- .plan_parse_body(req)
      patch <- body$task %||% body
      plan <- .plan_create_task(plan, patch)
      session_set(sid, "plan_trabajo", plan)
      .plan_state_payload(sid)
    })) |>
    plumber::pr_post("/api/plan-trabajo/tasks/<id>",
                     wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      plan <- s$plan_trabajo %||% NULL
      if (is.null(plan) || !is.list(plan)) stop_api(404, "E_PLAN_EMPTY", "No hay plan de trabajo importado.")
      body <- .plan_parse_body(req)
      patch <- body$task %||% body
      plan <- .plan_update_task(plan, id, patch)
      session_set(sid, "plan_trabajo", plan)
      .plan_state_payload(sid)
    })) |>
    plumber::pr_delete("/api/plan-trabajo/tasks/<id>",
                       wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      plan <- s$plan_trabajo %||% NULL
      if (is.null(plan) || !is.list(plan)) stop_api(404, "E_PLAN_EMPTY", "No hay plan de trabajo importado.")
      plan <- .plan_delete_task(plan, id)
      session_set(sid, "plan_trabajo", plan)
      .plan_state_payload(sid)
    })) |>
    plumber::pr_post("/api/plan-trabajo/export",
                     wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      plan <- s$plan_trabajo %||% NULL
      if (is.null(plan) || !is.list(plan)) stop_api(404, "E_PLAN_EMPTY", "No hay plan de trabajo importado.")
      meta <- .plan_export_xlsx(sid, plan)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        size = meta$size,
        ext = meta$ext
      )
    })) |>
    plumber::pr_delete("/api/plan-trabajo",
                       wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      session_set(sid, "plan_trabajo", NULL)
      .plan_state_payload(sid)
    }))
}
