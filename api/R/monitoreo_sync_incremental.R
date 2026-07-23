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

# --- Unidad 3.10b: dedup de la frontera inclusiva del cursor SM --------------
#
# `start_modified_at` es INCLUSIVO en /responses/bulk: cada Avance re-entrega
# las respuestas cuyo `date_modified` == cursor (1-3 filas en la práctica), así
# que `fetched_count` nunca llegaba a 0 y el no-op de 3.10 jamás aplicaba en
# proyectos SurveyMonkey. El cursor guarda ahora, además de `sm_modified_at`,
# la lista `sm_boundary` de respuestas observadas EN ese timestamp de frontera
# como "response_id|fingerprint"; tras el fetch se descuentan las ya conocidas
# y `count` pasa a ser el DELTA EFECTIVO. El campo vive dentro de
# `monitoreo_sources[[i]]$sync_cursor` (clave ya censada como persistible en
# session_schema.R; no se crean claves de sesión nuevas). Perderlo ⇒ la
# frontera re-cuenta como delta una vez y se re-siembra sola (benigno).

# Campos SM del cursor normalizado. El normalizador canónico
# (`.monitoreo_normalize_sync_cursor`, engine congelado a crecimiento) delega
# acá: los campos nuevos del cursor SM se censan en esta función.
.monitoreo_sync_cursor_sm_fields <- function(out, value) {
  sm_modified_at <- .monitoreo_scalar(value$sm_modified_at %||% value$smModifiedAt, "")
  if (nzchar(sm_modified_at)) out$sm_modified_at <- sm_modified_at
  boundary <- .monitoreo_sm_boundary_normalize(value$sm_boundary %||% value$smBoundary)
  if (length(boundary)) out$sm_boundary <- as.list(boundary)
  out
}

# Tope defensivo del set de frontera (respuestas con el MISMO date_modified;
# en la práctica 1-3). Si se excede se conservan las últimas: una entrada
# evictada solo re-cuenta como delta en el próximo Avance (sin no-op; benigno).
.monitoreo_sm_boundary_cap <- 200L

.monitoreo_sm_boundary_normalize <- function(value) {
  entries <- as.character(unlist(value %||% list(), use.names = FALSE))
  entries <- entries[!is.na(entries) & nzchar(entries)]
  entries <- unique(entries)
  if (length(entries) > .monitoreo_sm_boundary_cap) {
    entries <- entries[(length(entries) - .monitoreo_sm_boundary_cap + 1L):length(entries)]
  }
  entries
}

.monitoreo_sm_source_boundary <- function(source) {
  cursor <- .monitoreo_normalize_sync_cursor(source$sync_cursor %||% source$syncCursor)
  .monitoreo_sm_boundary_normalize(cursor$sm_boundary)
}

# Fingerprint de contenido de una respuesta cruda del bulk. Excluye campos de
# navegación (href/analyze_url/edit_url) que no son contenido del caso. Sin el
# paquete `digest` devuelve "" y la fila NUNCA se trata como conocida —
# SUPUESTO documentado (stopping rule 3.10b): una respuesta de frontera con el
# mismo id y el mismo date_modified pero payload editado (caso patológico)
# solo se considera sin-cambios si su fingerprint coincide con el persistido;
# sin fingerprint verificable se cuenta como delta y sigue el flujo normal.
.monitoreo_sm_response_fingerprint <- function(r) {
  if (!is.list(r)) return("")
  if (!requireNamespace("digest", quietly = TRUE)) return("")
  drop <- intersect(names(r) %||% character(0), c("href", "analyze_url", "edit_url"))
  if (length(drop)) r <- r[setdiff(names(r), drop)]
  digest::digest(r, algo = "sha256")
}

.monitoreo_sm_boundary_entry <- function(r) {
  id <- .monitoreo_scalar(r$id %||% r$response_id, "")
  if (!nzchar(id)) return("")
  fp <- .monitoreo_sm_response_fingerprint(r)
  if (!nzchar(fp)) return("")
  paste(id, fp, sep = "|")
}

# Entradas de frontera del fetch actual: respuestas cuyo date_modified es el
# máximo observado (el timestamp que será el próximo cursor).
.monitoreo_sm_boundary_entries <- function(rows, max_modified_at) {
  max_ts <- .sm_api_parse_time(max_modified_at)
  if (is.na(max_ts)) return(character(0))
  entries <- character(0)
  for (r in rows %||% list()) {
    ts <- .sm_api_parse_time(r$date_modified %||% r$date_created %||% NA_character_)
    if (is.na(ts) || ts != max_ts) next
    entry <- .monitoreo_sm_boundary_entry(r)
    if (nzchar(entry)) entries <- c(entries, entry)
  }
  .monitoreo_sm_boundary_normalize(entries)
}

# Fetch SM del engine con dedup de frontera. Llama al bulk canónico (fallback
# detectable y kill-switch PROSECNUR_SM_CURSOR intactos ahí) y descuenta las
# filas de frontera cuyo (response_id + fingerprint) ya son conocidos del
# cursor: `count` queda como delta efectivo, que es lo que viaja a
# `fetched_count` y lee `.monitoreo_sync_summary_delta_cero` (no-op 3.10).
# Cursor previo SIN frontera sembrada (proyectos de versiones anteriores):
# la frontera re-cuenta como delta una vez y este mismo fetch la siembra.
.monitoreo_sm_fetch_incremental <- function(source,
                                            advance_mode,
                                            token,
                                            since = NULL,
                                            progress = NULL,
                                            base_url = "https://api.surveymonkey.com/v3") {
  cursor <- .monitoreo_sm_cursor_for_fetch(source, advance_mode)
  payload <- sm_api_fetch_all_responses_bulk(
    survey_id = source$survey_id,
    token = token,
    since = since,
    start_modified_at = cursor,
    progress = progress,
    base_url = base_url
  )
  known <- if (is.null(cursor)) character(0) else .monitoreo_sm_source_boundary(source)
  if (length(known)) {
    cursor_ts <- .sm_api_parse_time(cursor)
    if (!is.na(cursor_ts)) {
      keep <- vapply(payload$data %||% list(), function(r) {
        ts <- .sm_api_parse_time(r$date_modified %||% r$date_created %||% NA_character_)
        # Solo se descuenta la frontera exacta; un date_modified distinto
        # (edición real posterior al corte) SIEMPRE cuenta como delta.
        if (is.na(ts) || ts != cursor_ts) return(TRUE)
        entry <- .monitoreo_sm_boundary_entry(r)
        !nzchar(entry) || !(entry %in% known)
      }, logical(1))
      if (!all(keep)) {
        payload$data <- (payload$data %||% list())[keep]
        payload$count <- length(payload$data)
      }
    }
  }
  payload$boundary <- .monitoreo_sm_boundary_entries(payload$data, payload$max_modified_at)
  payload
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
# previo. `payload` es el subset de campos que el engine adjunta como attr
# (incluye `boundary`, las entradas de frontera del fetch — unidad 3.10b).
.monitoreo_sm_sync_cursor_attr <- function(source, payload, mode, n_rows) {
  payload <- payload %||% list()
  previous <- .monitoreo_sm_source_cursor(source)
  prev_boundary <- .monitoreo_sm_source_boundary(source)
  seen_boundary <- .monitoreo_sm_boundary_normalize(payload$boundary)
  max_seen <- .monitoreo_scalar(payload$max_modified_at, "")
  value <- previous
  boundary <- prev_boundary
  if (nzchar(max_seen)) {
    prev_ts <- .sm_api_parse_time(previous)
    seen_ts <- .sm_api_parse_time(max_seen)
    if (is.na(prev_ts) || (!is.na(seen_ts) && seen_ts >= prev_ts)) {
      value <- max_seen
      # La frontera acompaña al cursor: si el timestamp AVANZÓ la reemplazan
      # las respuestas del nuevo máximo; si es el MISMO se acumulan las nuevas
      # (otra respuesta puede caer en el mismo segundo de frontera después).
      same_ts <- !is.na(prev_ts) && !is.na(seen_ts) && seen_ts == prev_ts
      boundary <- if (same_ts) {
        .monitoreo_sm_boundary_normalize(c(prev_boundary, seen_boundary))
      } else {
        seen_boundary
      }
    }
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
  if (nzchar(value %||% "") && length(boundary)) out$sm_boundary <- as.list(boundary)
  .monitoreo_normalize_sync_cursor(out)
}

# --- Unidad 3.10c: el pull SM con delta 0 no paga details ni enrichment ------
#
# Intento completo de sync SurveyMonkey para UN candidato de token. El bloque
# SM del engine congelado (monitoreo_sync_source) delega acá. Reordenado en
# 3.10c: cuando hay cursor operativo (modo avance + cursor persistido + flag
# ON — único caso donde el skip puede pagar) el bulk incremental corre
# PRIMERO y, si el delta efectivo es 0 (dedup de frontera 3.10b), se hace
# SKIP TOTAL de survey details, flatten y enrichment. Sin cursor operativo
# (full o primer Avance) el orden HISTÓRICO se conserva — details antes del
# bulk — para no cambiar en qué request tropieza un token inválido (el
# fallback de perfiles alternativos está fijado por test en
# test-monitoreo-engine.R). Con delta > 0 los details siguen pidiéndose ANTES
# del flatten (alimentan columnas/labels) y el enrichment corre después,
# idéntico al flujo previo.
#
# El df del skip es un data.frame() de 0 filas SIN columnas del snapshot:
# verificado contra .monitoreo_merge_sync_result_data (router_monitoreo.R) —
# .monitoreo_bind_rows filtra los dfs sin filas y el upsert no ve claves
# nuevas, así que el merge con delta 0 es no-op garantizado sin exigir shape.
.monitoreo_sm_sync_attempt <- function(source,
                                       advance_mode,
                                       token,
                                       since = NULL,
                                       progress = NULL,
                                       base_url = "https://api.surveymonkey.com/v3") {
  payload <- NULL
  sm_payload <- NULL
  fetch_bulk <- function() {
    payload <<- .monitoreo_sm_fetch_incremental(
      source = source,
      advance_mode = advance_mode,
      token = token,
      since = since,
      progress = progress,
      base_url = base_url
    )
    sm_payload <<- payload[c("count", "total", "cursor_enabled", "cursor_applied", "max_modified_at", "boundary")]
    invisible(NULL)
  }
  if (!is.null(.monitoreo_sm_cursor_for_fetch(source, advance_mode))) {
    fetch_bulk()
    if (isTRUE(payload$cursor_enabled) && !length(payload$data %||% list())) {
      # Delta efectivo 0 con cursor operativo: cero requests adicionales.
      df <- data.frame()
      attr(df, "sm_sync_payload") <- sm_payload
      attr(df, "survey_title") <- .monitoreo_scalar(source$survey_title, "")
      return(df)
    }
  }
  details <- sm_api_fetch_survey_details(source$survey_id, token, base_url = base_url)
  survey_title <- .monitoreo_scalar(details$title, source$survey_title %||% "")
  collector_sync_error <- ""
  collectors_meta <- list()
  if (!isTRUE(advance_mode)) {
    collectors_meta <- tryCatch(
      .monitoreo_sm_collectors_meta(source$survey_id, token, base_url),
      error = function(e) {
        collector_sync_error <<- conditionMessage(e)
        list()
      }
    )
  }
  if (is.null(payload)) fetch_bulk()
  df <- sm_api_flatten_responses(details, payload$data)
  attr(df, "sm_sync_payload") <- sm_payload
  df <- sm_api_enrich_response_recipients(
    df,
    token = token,
    base_url = base_url,
    include_details = !isTRUE(advance_mode)
  )
  if (!isTRUE(advance_mode)) {
    attr(df, "monitoreo_source_collectors") <- collectors_meta
    if (nzchar(collector_sync_error)) attr(df, "monitoreo_source_collectors_error") <- collector_sync_error
  }
  attr(df, "survey_title") <- survey_title
  df
}

# Metadata de colectores (solo sync completo; el modo avance nunca la pide).
# Movida SIN cambios funcionales desde el bloque SM del engine congelado
# (unidad 3.10c); el orden relativo details→collectors se conserva.
.monitoreo_sm_collectors_meta <- function(survey_id, token, base_url) {
  collectors <- sm_api_fetch_collectors(survey_id, token, base_url = base_url)
  out <- list()
  for (collector in collectors$data %||% list()) {
    collector_id <- .monitoreo_scalar(collector$id %||% collector$collector_id, "")
    if (!nzchar(collector_id)) next
    detail <- tryCatch(
      sm_api_fetch_collector_detail(collector_id, token, base_url = base_url),
      error = function(e) collector
    )
    out[[collector_id]] <- list(
      id = collector_id,
      collector_id = collector_id,
      name = .monitoreo_scalar(
        detail$name %||% detail$title %||% detail$collector_name %||% detail$collectorName %||%
          detail$display_name %||% detail$displayName %||% detail$nickname %||%
          (detail$metadata %||% list())$name %||% (detail$metadata %||% list())$title %||%
          (detail$collector %||% list())$name %||% (detail$collector %||% list())$title %||%
          collector$name %||% collector$title %||% collector$collector_name %||% collector$collectorName %||%
          collector$display_name %||% collector$displayName %||% collector$nickname,
        ""
      ),
      type = .monitoreo_scalar(detail$type %||% detail$collector_type %||% detail$collectorType %||% collector$type, ""),
      url = .monitoreo_scalar(detail$url %||% collector$url %||% detail$href %||% collector$href, ""),
      response_count = as.integer(.monitoreo_num(detail$response_count %||% collector$response_count, 0)),
      synced_at = .monitoreo_now_iso()
    )
  }
  unname(out)
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

# --- Unidad 3.11: Avance con delta real = merge + guardar; dashboards lazy ---
#
# El on_complete de /api/monitoreo/sync corre en el MAIN THREAD de plumber:
# mientras dura, ninguna respuesta HTTP sale. Hasta 3.11 ese on_complete
# construía el dashboard completo (include_reports=TRUE) + los artefactos del
# snapshot (source_metadata + report bundle + 2 modelos de publicación para
# chart_models), y en CONTA real eso costaba minutos con el pull ya resuelto
# en segundos. Ahora el on_complete solo hace lo NO diferible:
#   - merge incremental (necesita prev_data de la sesión in-memory; los
#     workers callr no la ven — invariante de la unidad),
#   - normalización de config + metadata de fuentes (cursores/last_sync_at),
#   - source_metadata ligero (la UI lo lee del state apenas refresca:
#     clasificación de colectores y filtros telefónicos; se mide aparte en la
#     fase `artifacts` del log),
#   - escritura del snapshot y marca de dirty.
# Los dashboards se construyen LAZY: el primer GET de cada scope tras el sync
# (.monitoreo_state_payload) detecta el token nuevo, construye SOLO ese scope
# y lo escribe como caché en sesión/snapshot — progresivo, un request por
# scope, sin bloquear el resto del event loop entre medio.
#
# Diferidos deliberados (censo de consumidores 2026-07-23):
#   - dashboard por scope → lazy en state (mecánica ya existente).
#   - snapshot$reports y snapshot$chart_models → NADIE los lee hoy: el
#     frontend los tiene tipados pero sin consumo, y el public-report arma su
#     propio modelo fresco. Se dejan de generar en el sync; si un consumidor
#     real aparece, se construyen en ese consumidor.
#   - snapshot$variables → derivable; el state lo sirve vía
#     monitoreo_variables_cached (fingerprint barato) en cada GET.
#
# Persistencia / warm start — DECISIÓN (a): save inmediato sin dashboards
# frescos + re-save por el ciclo normal. El on_complete deja project_dirty
# activo; el .pulso que el dueño guarde justo después del sync viaja sin
# dashboards (frío para los scopes no vistos, benigno: el primer GET los
# reconstruye). En el ciclo NORMAL la página refresca su scope apenas el job
# termina: ese GET escribe el dashboard construido dentro del snapshot en
# sesión (report_scope full y el caché territorial por scope, que además
# re-marca dirty), así que el guardado que cierra la sesión persiste un
# .pulso caliente para lo que el dueño realmente usó.
#
# Instrumentación (cubre el residual 3.10e): cada fase emite
# `[monitoreo] oncomplete fase=<x> ms=<n>` vía message() para diagnosticar
# bloqueos del event loop en producción sin Rprof.

.monitoreo_sync_oncomplete_log <- function(fase, started_at, extra = list()) {
  .monitoreo_log_timing("oncomplete", c(
    list(fase = fase, ms = .monitoreo_timing_ms(started_at)),
    extra
  ))
}

# Artefactos ligeros del snapshot: SOLO source_metadata (+ status). Reemplaza
# a monitoreo_snapshot_artifacts en el on_complete del sync; los campos
# reports/chart_models quedan diferidos (ver censo arriba). `config` llega ya
# normalizado por el caller (no se re-normaliza: era un costo repetido).
monitoreo_sync_snapshot_artifacts_light <- function(data,
                                                    config = list(),
                                                    sources = list(),
                                                    errors = list(),
                                                    sync_summary = list(),
                                                    generated_at = .monitoreo_now_iso()) {
  if (is.null(data) || !is.data.frame(data)) data <- data.frame()
  source_metadata <- tryCatch(
    .monitoreo_snapshot_source_metadata(data, config, sources, generated_at = generated_at, sync_summary = sync_summary),
    error = function(e) list(schema = "monitoreo_source_metadata_v1", generated_at = generated_at, error = conditionMessage(e))
  )
  has_errors <- length(errors %||% list()) > 0L ||
    nzchar(.monitoreo_scalar(source_metadata$error %||% "", ""))
  list(
    generated_at = generated_at,
    generation_version = "monitoreo_snapshot_v2",
    generation_status = if (isTRUE(has_errors)) "partial" else "complete",
    source_metadata = source_metadata,
    sync_errors = errors %||% list()
  )
}

# on_complete de /api/monitoreo/sync (el router lo llama con una línea).
# Réplica del flujo histórico HASTA el no-op check inclusive; de ahí en
# adelante difiere dashboard/artefactos pesados según el censo de arriba.
monitoreo_sync_apply_deferred <- function(sid, result, sync_mode = "full", report = NULL) {
  complete_report <- if (is.function(report)) report else function(...) invisible(NULL)
  t_total <- Sys.time()
  sync_mode <- .monitoreo_sync_mode(sync_mode)
  family <- result$config$monitoreo_profile$family %||% ""

  # -- merge: upsert incremental sobre la data previa de la sesión ------------
  complete_report("merge", percent = 82, message = "Uniendo respuestas nuevas...")
  t_fase <- Sys.time()
  synced_source_ids <- .monitoreo_sync_successful_source_ids(result$sync_summary %||% list(), result$data)
  s_prev <- session_get(sid)
  prev_snapshot <- s_prev$monitoreo_snapshot %||% NULL
  prev_data <- if (!is.null(prev_snapshot) && is.data.frame(prev_snapshot$data)) prev_snapshot$data else data.frame()
  incremental_source_ids <- .monitoreo_sync_incremental_source_ids(result$sync_summary %||% list())
  combined_data <- .monitoreo_merge_sync_result_data(
    prev_data,
    result$data,
    synced_source_ids = synced_source_ids,
    incremental_source_ids = incremental_source_ids
  )
  .monitoreo_sync_oncomplete_log("merge", t_fase, list(rows = nrow(combined_data)))

  # -- normalize: config del resultado sobre la config vigente ----------------
  t_fase <- Sys.time()
  s_current <- session_get(sid)
  current_cfg <- .monitoreo_request_config(NULL, s_current$monitoreo_config %||% list(), combined_data)
  result$config <- monitoreo_normalize_config(result$config, combined_data, previous_config = current_cfg)
  current_family <- current_cfg$monitoreo_profile$family %||% ""
  family <- result$config$monitoreo_profile$family %||% family
  if (identical(family, "territorial") && identical(current_family, "territorial")) {
    current_phase <- .monitoreo_territorial_phase(current_cfg$territorial$active_route_phase, "pilot")
    result$config$territorial$active_route_phase <- current_phase
    result$config$territorial$phase_sources <- current_cfg$territorial$phase_sources
    result$config$territorial <- monitoreo_territorial_normalize_config(
      result$config$territorial,
      combined_data,
      previous = current_cfg$territorial
    )
  }
  report_scope <- if (.monitoreo_sync_mode_is_advance(sync_mode)) "advance_summary" else "full"
  session_set(sid, "monitoreo_config", result$config)
  .monitoreo_sync_oncomplete_log("normalize", t_fase)

  # -- sources: cursores, last_sync_at e hidratación de colectores ------------
  t_fase <- Sys.time()
  s_now <- session_get(sid)
  synced_sources <- monitoreo_normalize_sources(result$sources %||% list())
  sources_now <- monitoreo_normalize_sources(s_now$monitoreo_sources %||% list())
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
    if (src$id %in% ids) src$last_sync_at <- result$synced_at
    src
  })
  sources_now <- .monitoreo_hydrate_missing_surveymonkey_collectors(
    sid,
    sources_now,
    synced_source_ids = ids,
    sync_summary = result$sync_summary %||% list()
  )
  session_set(sid, "monitoreo_sources", sources_now)
  dashboard_data <- .monitoreo_apply_source_metadata_to_data(combined_data, sources_now)
  .monitoreo_sync_oncomplete_log("sources", t_fase)

  # -- no-op de delta 0 (unidad 3.10): INTACTO ---------------------------------
  noop_payload <- monitoreo_sync_noop_result(sid, prev_snapshot, dashboard_data, result, sync_mode, complete_report)
  if (!is.null(noop_payload)) {
    .monitoreo_sync_oncomplete_log("total", t_total, list(noop = "1"))
    return(noop_payload)
  }

  # -- artifacts: solo el source_metadata ligero -------------------------------
  complete_report("metadata", percent = 90, message = "Actualizando metadata de fuentes...")
  t_fase <- Sys.time()
  artifacts <- monitoreo_sync_snapshot_artifacts_light(
    dashboard_data,
    result$config,
    sources = sources_now,
    errors = result$errors,
    sync_summary = result$sync_summary %||% list()
  )
  .monitoreo_sync_oncomplete_log("artifacts", t_fase)

  # -- save: snapshot sin dashboard (lazy) + dirty -----------------------------
  complete_report("save", percent = 96, message = "Guardando cambios del proyecto...")
  t_fase <- Sys.time()
  snapshot <- c(list(
    synced_at = result$synced_at,
    data = combined_data,
    config = result$config,
    errors = result$errors
  ), artifacts)
  # El fact territorial del home se conserva del corte previo (stale pero
  # informativo) hasta que el primer GET territorial lo re-espeje con el
  # tablero fresco (ver monitoreo_overview_facts.R). Antes se recalculaba
  # aquí desde el dashboard recién construido; sin build no hay fuente nueva.
  if (identical(family, "territorial") && is.list(prev_snapshot) &&
      !is.null(prev_snapshot$territorial_overview_facts)) {
    snapshot$territorial_overview_facts <- prev_snapshot$territorial_overview_facts
  }
  # Sin dashboard ni dashboard_cache_token: .monitoreo_snapshot_dashboard_valid
  # devuelve FALSE de entrada (snapshot$dashboard no es lista), así que el
  # PRIMER GET de cada scope construye con la data nueva sin poder rescatar el
  # tablero previo por el fallback de config (semántica de frescura intacta).
  # La invalidación explícita suelta además los caches por-scope de la sesión
  # (los tokens ya no matchearían, pero liberar la memoria y las tabs de
  # publicación cacheadas es barato y sin ambigüedad).
  .monitoreo_invalidate_dashboard_caches(sid)
  session_set(sid, "monitoreo_snapshot", snapshot)
  tryCatch(.monitoreo_mark_project_dirty_if_open(sid), error = function(e) NULL)
  .monitoreo_sync_oncomplete_log("save", t_fase)

  if (identical(family, "territorial")) {
    synced_kobo <- Filter(function(src) {
      identical(src$kind, "kobo") &&
        !identical(.monitoreo_scalar(src$role, ""), "ocurrencias_campo") &&
        (!length(ids) || src$id %in% ids)
    }, sources_now)
    if (length(synced_kobo)) {
      for (src in synced_kobo) {
        phase <- .monitoreo_source_territorial_phase(src)
        if (!phase %in% c("pilot", "field")) phase <- .monitoreo_territorial_phase(result$config$territorial$active_route_phase, "pilot")
        phase_src <- .monitoreo_territorial_phase_source(result$config$territorial, phase)
        .monitoreo_territorial_history_add(sid, list(
          type = "sync",
          asset_uid = .monitoreo_scalar(src$asset_uid %||% phase_src$asset_uid, ""),
          asset_name = .monitoreo_scalar(src$label %||% phase_src$kobo_asset_name, ""),
          version_id = .monitoreo_scalar(phase_src$kobo_version_id, ""),
          source_id = .monitoreo_scalar(src$id, ""),
          response_count = .monitoreo_snapshot_count(combined_data, .monitoreo_scalar(src$id, "")),
          status = if (length(result$errors %||% list())) "warning" else "ok",
          message = if (length(result$errors %||% list())) "Sincronización Kobo completada con alertas." else "Respuestas Kobo sincronizadas."
        ))
      }
    }
  }
  .monitoreo_sync_oncomplete_log("total", t_total)
  list(
    ok = TRUE,
    synced_at = result$synced_at,
    n_rows = as.integer(if (identical(family, "territorial")) {
      nrow(.monitoreo_territorial_filter_data_for_phase(dashboard_data, result$config))
    } else {
      nrow(dashboard_data)
    }),
    n_sources = as.integer(result$n_sources),
    # El dashboard ya no viaja en el resultado del job: ningún consumidor lo
    # leía (las 4 páginas refrescan su scope vía GET al terminar el job) y
    # construirlo aquí era justamente el costo diferido. El marcador permite
    # distinguir el contrato nuevo en logs/QA.
    dashboard = NULL,
    dashboard_deferred = TRUE,
    sync_mode = sync_mode,
    report_scope = report_scope,
    errors = result$errors,
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
