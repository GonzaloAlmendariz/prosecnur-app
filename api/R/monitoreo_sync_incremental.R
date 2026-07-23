# monitoreo_sync_incremental.R — Sync rápido Kobo/SurveyMonkey + publicación
# Sheets efectiva (unidad 3.8 del plan de mejoras).
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
