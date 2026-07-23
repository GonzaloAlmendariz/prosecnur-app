# monitoreo_sync_incremental.R — Sync rápido Kobo/SurveyMonkey + publicación
# Sheets efectiva (unidades 3.8/3.8b/3.10 del plan de mejoras).
#
# Este archivo aloja la lógica nueva del ciclo sync→sheets para no hacer crecer
# el engine congelado (`monitoreo_engine.R` llama hacia acá):
#
# 1) Cursor SM por fuente (espejo del cursor Kobo `_id > n`): en modo avance el
#    sync SurveyMonkey pasa el cursor persistido como `start_modified_at` al
#    endpoint /responses/bulk (delta server-side). El cursor vive junto al
#    estado de la fuente (`monitoreo_sources[[i]]$sync_cursor$sm_modified_at`),
#    clave de sesión ya censada como persistible en session_schema.R; viaja en
#    el .pulso. Perderlo ⇒ full sync (benigno). Feature flag PROSECNUR_SM_CURSOR
#    (default ON; ver riesgo documentado en `.sm_cursor_flag_enabled`).
#
# 2) Publicación Sheets batch + skip por hash: `monitoreo_sheets_publish_tabs`
#    delega acá. Las pestañas cuyo contenido no cambió respecto del hash
#    persistido se saltan por completo; las cambiadas se escriben con UN solo
#    values:batchUpdate; el formato solo se repone en pestañas nuevas o con
#    dimensiones cambiadas.
#
#    NOTA de persistencia (desvío documentado del contrato, para ratificación
#    del lead): el contrato pedía persistir los hashes en la sesión censados
#    como persistibles, pero `monitoreo_sheets_publish_tabs` conserva su firma
#    (spreadsheet_id, tabs) y su único caller vive en router_monitoreo.R
#    (EXCLUIDO de esta oleada), así que no hay `sid` alcanzable para escribir
#    en sesión. En su lugar el hash+dims de cada pestaña se persiste como
#    developerMetadata DE LA PROPIA HOJA remota (key `prosecnur.tab_state`),
#    que ya viene en la misma lectura de metadata que el publish hace hoy
#    (cero requests extra). Cumple el invariante de fondo: es estado remoto no
#    derivable, sobrevive reinicios y — a diferencia de la sesión — no queda
#    obsoleto si otra máquina publica sobre el mismo spreadsheet. Perderlo ⇒
#    una republicación completa (benigno). No se crean claves de sesión nuevas
#    (test-session-schema.R queda intacto).
#
# Secretos: acá no se toca ningún token; los tokens siguen fluyendo por
# secrets.R/connections y jamás se persisten en sesión, .pulso ni fixtures.

# --- Cursor SurveyMonkey por fuente -----------------------------------------

# Lee el cursor SM persistido en la fuente (espejo de
# `.monitoreo_kobo_source_cursor_id`).
.monitoreo_sm_source_cursor <- function(source) {
  cursor <- .monitoreo_normalize_sync_cursor(source$sync_cursor %||% source$syncCursor)
  .monitoreo_scalar(cursor$sm_modified_at, "")
}

# Cursor a enviar al endpoint bulk: solo en modo avance, con flag ON y con
# cursor previo. Sin cursor (primer sync) el modo avance baja todo y siembra
# el cursor para el siguiente ciclo — igual que Kobo.
.monitoreo_sm_cursor_for_fetch <- function(source, advance_mode) {
  if (!isTRUE(advance_mode)) return(NULL)
  if (!.sm_cursor_flag_enabled()) return(NULL)
  value <- .monitoreo_sm_source_cursor(source)
  if (nzchar(value)) value else NULL
}

# Construye el sync_cursor persistible tras un sync SM. Avanza sm_modified_at
# al máximo `date_modified` visto; si el delta vino vacío conserva el cursor
# previo. `payload` es el subset de campos que el engine adjunta como attr.
.monitoreo_sm_sync_cursor_attr <- function(source, payload, mode, n_rows) {
  payload <- payload %||% list()
  previous <- .monitoreo_sm_source_cursor(source)
  max_seen <- .monitoreo_scalar(payload$max_modified_at, "")
  value <- previous
  if (nzchar(max_seen)) {
    prev_ts <- .sm_api_parse_time(previous)
    seen_ts <- .sm_api_parse_time(max_seen)
    value <- if (is.na(prev_ts) || (!is.na(seen_ts) && seen_ts >= prev_ts)) max_seen else previous
  }
  n_rows <- suppressWarnings(as.integer(n_rows %||% 0L))
  if (!is.finite(n_rows)) n_rows <- 0L
  out <- list(
    updated_at = .monitoreo_now_iso(),
    mode = .monitoreo_scalar(mode, "full"),
    fetched_count = suppressWarnings(as.integer(payload$count %||% n_rows)),
    remote_total = suppressWarnings(as.integer(payload$total %||% payload$count %||% n_rows))
  )
  if (nzchar(value %||% "")) out$sm_modified_at <- value
  .monitoreo_normalize_sync_cursor(out)
}

# --- Publicación Google Sheets: batch + skip por hash -----------------------

.monitoreo_sync_sheets_tab_state_key <- function() "prosecnur.tab_state"

# Rectángulo uniforme: cada fila se rellena con "" hasta el ancho máximo para
# que el values:batchUpdate sobreescriba TODO el rectángulo publicado antes
# (sin celdas huérfanas cuando una fila se acorta). El hash se calcula sobre
# este rectángulo, que es exactamente lo que se escribe.
.monitoreo_sync_sheets_padded_rows <- function(rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list(list("")))
  width <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  lapply(rows, function(row) {
    cells <- as.character(unlist(row %||% character(0), use.names = FALSE))
    cells[is.na(cells)] <- ""
    if (length(cells) < width) cells <- c(cells, rep("", width - length(cells)))
    as.list(cells)
  })
}

# Hash del rectángulo publicado. Sin `digest` instalado devuelve "" y el skip
# se desactiva (se publica todo, comportamiento previo a 3.8).
.monitoreo_sync_sheets_tab_hash <- function(padded_rows) {
  if (!requireNamespace("digest", quietly = TRUE)) return("")
  digest::digest(padded_rows, algo = "sha256")
}

.monitoreo_sync_sheets_tab_state_value <- function(hash, n_rows, n_cols) {
  paste("v1", hash, as.integer(n_rows), as.integer(n_cols), sep = ":")
}

# Estado persistido de una pestaña (hash + dims) leído del developerMetadata
# que ya trae `.monitoreo_sheets_metadata`. NULL si no hay estado válido.
.monitoreo_sync_sheets_stored_tab_state <- function(tab) {
  for (item in tab$developer_metadata %||% list()) {
    if (!identical(.monitoreo_scalar(item$metadataKey, ""), .monitoreo_sync_sheets_tab_state_key())) next
    value <- .monitoreo_scalar(item$metadataValue, "")
    parts <- strsplit(value, ":", fixed = TRUE)[[1]]
    if (length(parts) != 4L || !identical(parts[[1]], "v1")) return(NULL)
    return(list(
      hash = parts[[2]],
      row_count = suppressWarnings(as.integer(parts[[3]])),
      column_count = suppressWarnings(as.integer(parts[[4]]))
    ))
  }
  NULL
}

.monitoreo_sync_sheets_has_tab_state <- function(tab) {
  any(vapply(tab$developer_metadata %||% list(), function(item) {
    identical(.monitoreo_scalar(item$metadataKey, ""), .monitoreo_sync_sheets_tab_state_key())
  }, logical(1)))
}

# Upsert del estado remoto de la pestaña (create si no existe, update si sí).
.monitoreo_sync_sheets_tab_state_requests <- function(sheet_id, has_state, value) {
  key <- .monitoreo_sync_sheets_tab_state_key()
  metadata <- list(
    metadataKey = key,
    metadataValue = value,
    visibility = "DOCUMENT",
    location = list(sheetId = sheet_id)
  )
  if (isTRUE(has_state)) {
    list(list(updateDeveloperMetadata = list(
      dataFilters = list(list(developerMetadataLookup = list(
        metadataKey = key,
        metadataLocation = list(sheetId = sheet_id)
      ))),
      developerMetadata = metadata,
      fields = "metadataValue"
    )))
  } else {
    list(list(createDeveloperMetadata = list(developerMetadata = metadata)))
  }
}

# Implementación de `monitoreo_sheets_publish_tabs` (el engine delega acá).
# Misma firma y mismo shape de retorno que la versión previa, más
# `skipped_tabs`. Requests: antes ~3 + 2×N (clear+PUT por pestaña) + formato;
# ahora: 1 GET de metadata, [addSheet si hay pestañas nuevas], 1 batch de
# ownership/reset, 1 values:batchUpdate con TODAS las pestañas cambiadas y
# 1 batch de formato/estado. Con todo sin cambios: 1 solo request.
.monitoreo_sync_sheets_publish_tabs <- function(spreadsheet_id, tabs) {
  spreadsheet_id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(spreadsheet_id)) stop("Falta spreadsheet_id para publicar.", call. = FALSE)
  tab_names <- names(tabs)
  .monitoreo_sheets_validate_controlled_tabs(tab_names)

  meta <- .monitoreo_sheets_metadata(spreadsheet_id)
  tab_map <- .monitoreo_sheets_tab_map(meta)
  new_tabs <- setdiff(tab_names, names(tab_map))
  if (length(new_tabs)) {
    .monitoreo_sheets_batch_update(
      spreadsheet_id,
      lapply(new_tabs, function(tab_name) {
        list(addSheet = list(properties = list(title = tab_name)))
      })
    )
    meta <- .monitoreo_sheets_metadata(spreadsheet_id)
    tab_map <- .monitoreo_sheets_tab_map(meta)
  }

  plan <- list()
  for (tab_name in tab_names) {
    tab <- tab_map[[tab_name]]
    if (is.null(tab) || is.na(tab$sheet_id)) {
      stop(sprintf("No se pudo preparar la pestana controlada %s.", tab_name), call. = FALSE)
    }
    padded <- .monitoreo_sync_sheets_padded_rows(.monitoreo_sheets_values_rows(tabs[[tab_name]]))
    hash <- .monitoreo_sync_sheets_tab_hash(padded)
    n_rows <- length(padded)
    n_cols <- length(padded[[1]] %||% list())
    stored <- .monitoreo_sync_sheets_stored_tab_state(tab)
    is_new <- tab_name %in% new_tabs
    unchanged <- !is_new && nzchar(hash) && is.list(stored) && identical(stored$hash, hash)
    dims_changed <- is_new || !is.list(stored) ||
      !identical(as.integer(stored$row_count), as.integer(n_rows)) ||
      !identical(as.integer(stored$column_count), as.integer(n_cols))
    plan[[tab_name]] <- list(
      tab = tab,
      padded = padded,
      hash = hash,
      n_rows = n_rows,
      n_cols = n_cols,
      is_new = is_new,
      unchanged = unchanged,
      dims_changed = dims_changed,
      has_state = .monitoreo_sync_sheets_has_tab_state(tab)
    )
  }

  changed <- Filter(function(p) !isTRUE(p$unchanged), plan)
  skipped_tabs <- setdiff(tab_names, names(changed))

  # Batch 1: metadata de ownership faltante + reset (solo pestañas que van a
  # recibir formato de nuevo: nuevas o con dims cambiadas). Una pestaña
  # cambiada con las mismas dims conserva su formato/reglas y solo recibe
  # valores (el rectángulo uniforme garantiza la sobreescritura completa).
  batch1 <- list()
  for (tab_name in names(changed)) {
    p <- changed[[tab_name]]
    if (!.monitoreo_sheets_has_owner_metadata(p$tab)) {
      batch1[[length(batch1) + 1L]] <- list(
        createDeveloperMetadata = list(
          developerMetadata = list(
            metadataKey = .monitoreo_sheets_owner_key(),
            metadataValue = .monitoreo_sheets_owner_value(),
            visibility = "DOCUMENT",
            location = list(sheetId = p$tab$sheet_id)
          )
        )
      )
    }
    if (isTRUE(p$dims_changed)) {
      batch1 <- c(batch1, .monitoreo_sheets_reset_tab_requests(p$tab$sheet_id, p$tab, tabs[[tab_name]]))
    }
  }
  .monitoreo_sheets_batch_update(spreadsheet_id, batch1)

  # Values: UN solo values:batchUpdate para todas las pestañas cambiadas.
  written_ranges <- list()
  if (length(changed)) {
    data_entries <- lapply(names(changed), function(tab_name) {
      list(
        range = .monitoreo_sheets_quote_sheet(tab_name),
        majorDimension = "ROWS",
        values = changed[[tab_name]]$padded
      )
    })
    .monitoreo_google_api(
      paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values:batchUpdate"),
      method = "POST",
      body = list(valueInputOption = "RAW", data = data_entries)
    )
    written_ranges <- lapply(names(changed), function(tab_name) {
      list(
        tab = tab_name,
        range = .monitoreo_sheets_quote_sheet(tab_name),
        rows = length(tabs[[tab_name]] %||% list())
      )
    })
  }

  # Batch 2: formato (solo nuevas o con dims cambiadas) + estado remoto
  # (hash + dims) de cada pestaña escrita.
  batch2 <- list()
  for (tab_name in names(changed)) {
    p <- changed[[tab_name]]
    if (isTRUE(p$dims_changed)) {
      batch2 <- c(batch2, .monitoreo_sheets_professional_format_requests(p$tab$sheet_id, tab_name, tabs[[tab_name]]))
    }
    if (nzchar(p$hash)) {
      batch2 <- c(batch2, .monitoreo_sync_sheets_tab_state_requests(
        p$tab$sheet_id,
        p$has_state,
        .monitoreo_sync_sheets_tab_state_value(p$hash, p$n_rows, p$n_cols)
      ))
    }
  }
  .monitoreo_sheets_batch_update(spreadsheet_id, batch2)

  list(
    ok = TRUE,
    spreadsheet_id = spreadsheet_id,
    spreadsheet_url = paste0("https://docs.google.com/spreadsheets/d/", spreadsheet_id, "/edit"),
    controlled_tabs = as.list(tab_names),
    written_ranges = written_ranges,
    skipped_tabs = as.list(skipped_tabs),
    updated_at = .monitoreo_now_iso(),
    mode = "controlled_write"
  )
}

# --- Unidad 3.10: Avance sin cambios = no-op rápido --------------------------

# TRUE solo si el sync trae al menos una fuente y TODAS reportan delta 0. La
# señal autoritativa es fetched_count del cursor (lo que el servidor entregó);
# si el cursor no la trae (fuentes sin cursor, p. ej. Sheets) cae a las filas
# del resultado. Una fuente en modo full con filas > 0 nunca es delta 0: la
# re-descarga completa no puede probar identidad de contenido barata (el
# fingerprint solo ve dims/nombres), así que sigue el flujo normal.
.monitoreo_sync_summary_delta_cero <- function(sync_summary = list()) {
  if (is.null(sync_summary) || !is.list(sync_summary) || !length(sync_summary)) return(FALSE)
  all(vapply(sync_summary, function(item) {
    if (!is.list(item)) return(FALSE)
    cursor <- item$cursor %||% list()
    fetched <- suppressWarnings(as.integer(cursor$fetched_count %||% NA_integer_))[1]
    if (!is.na(fetched) && is.finite(fetched)) return(fetched == 0L)
    rows <- suppressWarnings(as.integer(item$rows %||% NA_integer_))[1]
    !is.na(rows) && is.finite(rows) && rows == 0L
  }, logical(1)))
}

# Cortocircuito del on_complete de /api/monitoreo/sync: si TODAS las fuentes
# reportan delta 0 Y el snapshot vigente sigue siendo válido para la data
# mergeada + config recién normalizada (mismo token de caché — fingerprint de
# data, config particionado y scope), no hay nada que reconstruir. Se
# devuelven los metadatos frescos (last_sync_at y cursores ya quedaron
# escritos en monitoreo_sources por el caller) sobre el dashboard vigente:
# cero builds, cero snapshot_artifacts, y el save queda en el flag barato de
# project_dirty. El snapshot NO se toca (ni synced_at): tocarlo invalidaría el
# token y forzaría el rebuild que justamente se evita. Devuelve NULL cuando el
# sync trae cambios (o cualquier duda) y el flujo normal debe continuar.
monitoreo_sync_noop_result <- function(sid,
                                       prev_snapshot,
                                       dashboard_data,
                                       result,
                                       sync_mode = "full",
                                       report = NULL) {
  if (length(result$errors %||% list())) return(NULL)
  if (!.monitoreo_sync_summary_delta_cero(result$sync_summary %||% list())) return(NULL)
  if (!is.list(prev_snapshot) || !is.list(prev_snapshot$dashboard)) return(NULL)
  if (!nzchar(.monitoreo_scalar(prev_snapshot$dashboard_cache_token, ""))) return(NULL)
  prev_scope <- .monitoreo_report_scope(prev_snapshot$dashboard_report_scope %||% "full")
  family <- result$config$monitoreo_profile$family %||% ""
  display_data <- if (identical(family, "territorial")) {
    .monitoreo_territorial_filter_data_for_phase(dashboard_data, result$config)
  } else {
    dashboard_data
  }
  # El validador canónico decide: mismo token (con el synced_at y scope del
  # snapshot VIGENTE, no los del sync entrante) ⇒ el dashboard sigue válido.
  token <- .monitoreo_dashboard_cache_token(
    list(synced_at = prev_snapshot$synced_at %||% ""),
    display_data,
    result$config,
    report_scope = prev_scope
  )
  valido <- tryCatch(
    .monitoreo_snapshot_dashboard_valid(prev_snapshot, display_data, result$config, token, report_scope = prev_scope),
    error = function(e) FALSE
  )
  if (!isTRUE(valido)) return(NULL)
  if (is.function(report)) {
    report("save", percent = 96, message = "Sin respuestas nuevas: solo se actualizan metadatos de fuentes.")
  }
  tryCatch(.monitoreo_mark_project_dirty_if_open(sid), error = function(e) NULL)
  list(
    ok = TRUE,
    noop = TRUE,
    # synced_at conserva el del snapshot (es lo que verá /state); el momento
    # real de la verificación viaja aparte para la UI.
    synced_at = .monitoreo_scalar(prev_snapshot$synced_at, result$synced_at %||% ""),
    checked_at = .monitoreo_scalar(result$synced_at, .monitoreo_now_iso()),
    n_rows = as.integer(nrow(display_data)),
    n_sources = as.integer(result$n_sources %||% 0L),
    dashboard = .monitoreo_public_dashboard(prev_snapshot$dashboard),
    sync_mode = .monitoreo_sync_mode(sync_mode),
    report_scope = prev_scope,
    errors = result$errors %||% list(),
    sync_summary = result$sync_summary %||% list()
  )
}

# --- Unidad 3.8b: post-proceso del sync de fuentes Google Sheets -------------

# Lógica movida SIN cambios funcionales desde el endpoint síncrono
# /api/monitoreo/sheets/sync (router congelado a crecimiento) para poder
# reutilizarla como on_complete del job async. Único desvío deliberado: las
# fuentes base se leen FRESCAS de la sesión al aplicar el resultado (antes se
# capturaban antes del fetch), para no pisar ediciones hechas mientras el job
# corría — mismo criterio que el on_complete de /api/monitoreo/sync.
monitoreo_sheets_sync_apply_result <- function(sid, result, report = NULL) {
  if (is.function(report)) report("merge", percent = 84, message = "Uniendo datos de Sheets...")
  s_current <- session_get(sid)
  sources_before <- monitoreo_normalize_sources(s_current$monitoreo_sources %||% list())
  prev_snapshot <- s_current$monitoreo_snapshot %||% NULL
  prev_data <- if (!is.null(prev_snapshot) && is.data.frame(prev_snapshot$data)) prev_snapshot$data else data.frame()
  synced_source_ids <- .monitoreo_sync_successful_source_ids(
    result$sync_summary %||% list(),
    result$data
  )
  incremental_source_ids <- .monitoreo_sync_incremental_source_ids(result$sync_summary %||% list())
  combined_data <- .monitoreo_merge_sync_result_data(
    prev_data,
    result$data,
    synced_source_ids = synced_source_ids,
    incremental_source_ids = incremental_source_ids
  )
  current_cfg <- .monitoreo_request_config(NULL, s_current$monitoreo_config %||% list(), combined_data)
  result$config <- monitoreo_normalize_config(result$config, combined_data, previous_config = current_cfg)
  current_family <- current_cfg$monitoreo_profile$family %||% ""
  result_family <- result$config$monitoreo_profile$family %||% ""
  if (identical(result_family, "territorial") && identical(current_family, "territorial")) {
    current_phase <- .monitoreo_territorial_phase(current_cfg$territorial$active_route_phase, "pilot")
    result$config$territorial$active_route_phase <- current_phase
    result$config$territorial$phase_sources <- current_cfg$territorial$phase_sources
    result$config$territorial <- monitoreo_territorial_normalize_config(
      result$config$territorial,
      result$data,
      previous = current_cfg$territorial
    )
  }
  if (is.function(report)) report("dashboard", percent = 90, message = "Preparando tablero local...")
  result$dashboard <- .monitoreo_dashboard_for_session(sid, combined_data, result$config)
  synced_sources <- monitoreo_normalize_sources(result$sources %||% list())
  sources_now <- sources_before
  if (length(synced_sources)) {
    source_ids_now <- vapply(sources_now, function(src) .monitoreo_scalar(src$id, ""), character(1))
    for (src in synced_sources) {
      sid_src <- .monitoreo_scalar(src$id, "")
      if (!nzchar(sid_src)) next
      idx <- match(sid_src, source_ids_now)
      if (!is.na(idx) && is.finite(idx) && idx > 0L) {
        sources_now[[idx]] <- utils::modifyList(sources_now[[idx]], src)
      } else {
        sources_now[[length(sources_now) + 1L]] <- src
        source_ids_now <- c(source_ids_now, sid_src)
      }
    }
  }
  ids <- synced_source_ids
  if (!length(ids)) ids <- unique(as.character(result$data$.source_id %||% character(0)))
  sources_now <- lapply(sources_now, function(src) {
    sid_src <- .monitoreo_scalar(src$id, "")
    if (nzchar(sid_src) && sid_src %in% ids) src$last_sync_at <- result$synced_at
    src
  })
  artifacts <- monitoreo_snapshot_artifacts(
    combined_data,
    result$config,
    sources = sources_now,
    dashboard = result$dashboard,
    synced_at = result$synced_at,
    errors = result$errors,
    sync_summary = result$sync_summary %||% list()
  )
  snapshot <- c(list(
    synced_at = result$synced_at,
    data = combined_data,
    config = result$config,
    dashboard = result$dashboard,
    variables = if (nrow(combined_data)) monitoreo_variables(combined_data) else list(),
    errors = result$errors
  ), artifacts)
  session_set(sid, "monitoreo_sources", sources_now)
  session_set(sid, "monitoreo_config", result$config)
  session_set(sid, "monitoreo_snapshot", snapshot)
  if (is.function(report)) report("save", percent = 97, message = "Guardando cambios del proyecto...")
  tryCatch(.monitoreo_mark_project_dirty_if_open(sid), error = function(e) NULL)
  list(
    ok = TRUE,
    synced_at = result$synced_at,
    n_rows = as.integer(nrow(combined_data)),
    n_sources = as.integer(length(sources_now)),
    state = .monitoreo_state_payload(sid)
  )
}

# Variante async del sync de fuentes Sheets: el fetch (red) corre en un worker
# callr con el runner canónico de sync (monitoreo_sync_job_runner) y el
# on_complete aplica el resultado en el main thread con la misma función que
# el camino síncrono. RESTRICCIÓN de workers respetada: el worker no toca la
# sesión in-memory — fuentes y config viajan por RDS y la credencial de Google
# se resuelve dentro del worker desde el secret store en disco
# (~/.prosecnurapp/secrets), igual que ya ocurre cuando /api/monitoreo/sync
# corre fuentes google_sheets en modo full.
monitoreo_sheets_sync_submit_job <- function(sid, sources, cfg) {
  sources_path <- job_save_rds(sid, "monitoreo_sheets_sources", sources)
  cfg_path <- job_save_rds(sid, "monitoreo_sheets_config", cfg)
  runner <- monitoreo_sync_job_runner
  attr(runner, "prosecnur_job_function_name") <- "monitoreo_sync_job_runner"
  job_id <- job_submit(
    sid = sid,
    kind = "monitoreo.sheets_sync",
    func = runner,
    args = list(
      sources_path = sources_path,
      cfg_path = cfg_path,
      connection_tokens_path = NULL,
      since = NULL,
      sid = sid,
      sync_mode = "full"
    ),
    on_complete = function(j) {
      report <- if (!is.null(j$progress_path)) job_progress_writer(j$progress_path) else NULL
      monitoreo_sheets_sync_apply_result(j$sid, j$result_data, report = report)
    }
  )
  list(ok = TRUE, job_id = job_id, kind = "monitoreo.sheets_sync", async = TRUE)
}

# --- Unidad 3.8b: publicación Sheets con opt-in async ------------------------

# Runner del job de publicación. Función top-level del paquete (trampa de
# namespace de callr cubierta por la marca prosecnur_job_function_name que le
# pega el dispatch). El payload de tabs viaja por RDS (nunca dentro del
# closure) y la credencial Google se lee del secret store en disco dentro del
# worker; jamás se serializa un token en args.
monitoreo_sheets_publish_job_runner <- function(tabs_path, spreadsheet_id, progress_path = NULL) {
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else function(...) invisible(NULL)
  report("prepare", percent = 10, message = "Preparando pestañas controladas...")
  tabs <- readRDS(tabs_path)
  report("publish", percent = 45, message = "Publicando en Google Sheets...")
  out <- monitoreo_sheets_publish_tabs(spreadsheet_id, tabs)
  report("export", percent = 96, message = "Publicación en Sheets completada.")
  out
}

# Bitácora de publicación en sesión (compartida por los 3 endpoints de
# publish). En modo síncrono se escribe inline; en async la escribe el
# on_complete (main thread), nunca el worker.
.monitoreo_sheets_publish_event_append <- function(sid, event_key, published, extra = list()) {
  event_key <- .monitoreo_scalar(event_key, "")
  if (!nzchar(event_key)) return(invisible(NULL))
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) return(invisible(NULL))
  session_set(sid, event_key, c(
    s[[event_key]] %||% list(),
    list(c(published, extra))
  ))
  invisible(NULL)
}

# Fachada única de publicación para los endpoints de Sheets. Contrato:
#   - default (async ausente/false): comportamiento histórico — publica
#     síncrono, registra el evento y devuelve el resultado (el frontend
#     actual espera MonitoreoSheetsPublishResult inline).
#   - async=true (opt-in, adopción futura del frontend): devuelve
#     {ok, job_id, kind} al instante y la publicación (red) corre en un
#     worker; el evento se registra en on_complete solo si terminó bien.
monitoreo_sheets_publish_dispatch <- function(sid,
                                              spreadsheet_id,
                                              tabs,
                                              parsed = list(),
                                              event_key = "",
                                              event_extra = list()) {
  async <- .monitoreo_bool(parsed$async %||% parsed$run_async %||% parsed$runAsync, FALSE)
  if (!isTRUE(async)) {
    published <- tryCatch(monitoreo_sheets_publish_tabs(spreadsheet_id, tabs), error = .monitoreo_sheets_stop)
    .monitoreo_sheets_publish_event_append(sid, event_key, published, event_extra)
    return(published)
  }
  tabs_path <- job_save_rds(sid, "monitoreo_sheets_tabs", tabs)
  runner <- monitoreo_sheets_publish_job_runner
  attr(runner, "prosecnur_job_function_name") <- "monitoreo_sheets_publish_job_runner"
  job_id <- job_submit(
    sid = sid,
    kind = "monitoreo.sheets_publish",
    func = runner,
    args = list(tabs_path = tabs_path, spreadsheet_id = spreadsheet_id),
    on_complete = function(j) {
      tryCatch(unlink(tabs_path), error = function(e) NULL)
      published <- j$result_data
      if (identical(j$status, "done") && is.list(published)) {
        .monitoreo_sheets_publish_event_append(j$sid, event_key, published, event_extra)
      }
      published
    }
  )
  list(ok = TRUE, job_id = job_id, kind = "monitoreo.sheets_publish", async = TRUE)
}
