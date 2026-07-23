# monitoreo_perf.R — perf del tablero de Monitoreo (Plan de mejoras 2026-07, Fase 3).
#
# Este archivo existe porque router_monitoreo.R y monitoreo_engine.R están
# congelados a crecimiento: toda funcionalidad nueva de perf vive aquí y los
# archivos grandes la llaman con una línea.
#
# Piezas:
#   1. monitoreo_data_fingerprint(): token barato de frescura de la data del
#      snapshot, que reemplaza el sha256 del dataframe completo en los tokens
#      de caché del dashboard (antes se pagaba digest::digest(data) en CADA
#      request de state, la causa #1 de los congelamientos).
#   2. Contador de builds del dashboard: instrumentación mínima para poder
#      probar (y vigilar) que una mutación de config ya no dispara el build
#      completo dos veces en el mismo request.
#   3. Unidad 3.3: transpose vectorizado df→registros (reemplaza el patrón
#      lapply(seq_len(nrow(df)), function(i) df[i, , drop = FALSE]) en los dos
#      call sites del hot path de state) y caché de monitoreo_variables()
#      keyed por el fingerprint barato.
#   4. Unidad 3.5: cap de payload para response_audit y map$points en la
#      frontera pública del dashboard (aditivo: truncated + total_rows).
#   5. Unidad 3.4b: partición del config para el token de caché — los campos
#      puramente de metadata/publicación (timestamps de inspección, linkage
#      del form de ocurrencias, parámetros de supervisión bajo demanda) salen
#      del token para que editarlos no invalide los 7 scopes del dashboard.
#   6. Unidad 3.8b: caché del payload de tabs de publicación (el preflight y
#      el publish computaban el mismo bundle dos veces por ciclo).

# --- Fingerprint barato de la data -----------------------------------------

# Supuesto de frescura (documentado a propósito): la data del snapshot de
# Monitoreo solo muta por rutas que o bien actualizan synced_at (sync de
# fuentes, aulas/sync) o bien invalidan explícitamente los caches del
# dashboard vía .monitoreo_invalidate_dashboard_caches (mutaciones de fuentes
# que reescriben columnas .source_*). Las ediciones de config no tocan la
# data: viajan en cfg y ya forman parte del token vía cfg_json/config_hash.
# Por eso dims + nombres de columnas + synced_at bastan como señal de cambio,
# sin hashear el contenido completo (que en bases reales costaba cientos de
# ms por request). Los cambios de esquema (columnas nuevas/renombradas)
# cambian ncol o el hash de nombres; los re-sync cambian synced_at.
monitoreo_data_fingerprint <- function(data, synced_at = "") {
  if (is.null(data) || !is.data.frame(data)) return("")
  nombres <- names(data) %||% character(0)
  names_sig <- if (requireNamespace("digest", quietly = TRUE)) {
    # Hashear solo el vector de nombres es barato (bytes, no la data).
    digest::digest(nombres, algo = "xxhash64")
  } else {
    paste(length(nombres), sum(nchar(nombres)), sep = "-")
  }
  paste(
    "fpv1",
    nrow(data),
    ncol(data),
    names_sig,
    .monitoreo_scalar(synced_at, ""),
    sep = ":"
  )
}

# --- Unidad 3.4b: partición del config para el token de caché ----------------

# Devuelve la copia del config que entra al token de caché del dashboard.
# Regla conservadora: SOLO se excluyen campos que con certeza no cambian
# ningún número ni etiqueta del dashboard cacheado; ante la duda el campo se
# queda en el token. Hoy salen:
#   - supervision_n / supervision_seed: solo alimentan el endpoint bajo
#     demanda /supervision/sample (monitoreo_supervision_sample), nunca el
#     build del dashboard.
#   - territorial$inspected_at (y el de cada phase_source): timestamp de la
#     última inspección del asset Kobo; cambia en cada re-inspección sin
#     alterar cálculo alguno.
#   - territorial$field_occurrences$<linkage/timestamps/urls>: la metadata de
#     despliegue del form de ocurrencias (títulos, urls, ids de archivo,
#     generated_at/uploaded_at/last_sync_at) se reescribe en cada ciclo de
#     ocurrencias y era la causa #1 de invalidaciones nucleares. Los campos
#     que SÍ discriminan datos (enabled, route_phase, route_choices,
#     code_var/start_time_var/end_time_var, form_id, asset_uid, source_id,
#     version_id) permanecen en el token.
# client_report$channel_labels se queda a propósito: son etiquetas, no
# números, pero viajan horneadas dentro del dashboard cacheado (client_report
# embebido) y excluirlas serviría alias obsoletos. Pendiente documentado: el
# mapeo fino por scope individual.
monitoreo_perf_config_for_cache_token <- function(cfg) {
  if (is.null(cfg) || !is.list(cfg)) return(cfg)
  cfg$supervision_n <- NULL
  cfg$supervision_seed <- NULL
  territorial <- cfg$territorial
  if (is.list(territorial)) {
    territorial$inspected_at <- NULL
    if (is.list(territorial$phase_sources)) {
      territorial$phase_sources <- lapply(territorial$phase_sources, function(ps) {
        if (is.list(ps)) ps$inspected_at <- NULL
        ps
      })
    }
    if (is.list(territorial$field_occurrences)) {
      solo_metadata <- c(
        "form_title", "asset_name", "base_url", "survey_url", "asset_url",
        "connection_profile_id", "status", "generated_at", "uploaded_at",
        "last_sync_at", "xlsform_file_id", "xlsform_filename"
      )
      for (campo in solo_metadata) territorial$field_occurrences[[campo]] <- NULL
    }
    cfg$territorial <- territorial
  }
  cfg
}

# --- Contador de builds del dashboard --------------------------------------

# Env interno (no exportado) para instrumentar cuántas veces se construye el
# dashboard completo en un proceso. Los tests lo usan para demostrar que el
# doble-rebuild de store_config quedó eliminado; en producción solo suma un
# entero por build (costo despreciable).
.monitoreo_perf_state <- new.env(parent = emptyenv())

.monitoreo_perf_note_dashboard_build <- function() {
  actual <- get0("dashboard_builds", envir = .monitoreo_perf_state, ifnotfound = 0L)
  assign("dashboard_builds", actual + 1L, envir = .monitoreo_perf_state)
  invisible(NULL)
}

monitoreo_perf_dashboard_build_count <- function() {
  get0("dashboard_builds", envir = .monitoreo_perf_state, ifnotfound = 0L)
}

monitoreo_perf_reset_dashboard_build_count <- function() {
  assign("dashboard_builds", 0L, envir = .monitoreo_perf_state)
  invisible(NULL)
}

# --- Unidad 3.3b: transpose vectorizado df → lista de registros -------------

# Fallback fila-por-fila (la implementación histórica de router:119-130 y
# engine:7000-7010). Solo se usa cuando alguna columna tiene dim() (matrices
# embebidas), donde el transpose por columnas cambiaría la semántica de
# `df[i, , drop = FALSE]`. La data de Monitoreo viene de JSON/CSV y no trae
# matrices, así que en la práctica siempre corre el camino rápido.
.monitoreo_perf_records_por_fila <- function(df, factor_a_caracter = FALSE) {
  unname(lapply(seq_len(nrow(df)), function(i) {
    row <- as.list(df[i, , drop = FALSE])
    lapply(row, function(v) {
      if (length(v) == 0L) return(NA)
      v <- v[[1]]
      if (isTRUE(factor_a_caracter) && is.factor(v)) as.character(v) else v
    })
  }))
}

# Núcleo compartido: construye la lista de registros POR COLUMNA (.mapply
# transpone en C) en vez de materializar un data.frame de una fila por cada
# fila del df, que era cuadrático en overhead de atributos. El shape del
# output es idéntico al histórico (lista sin nombres de listas nombradas por
# fila; celdas de list-columns pasan tal cual, factores según la variante) —
# hay golden test en test-monitoreo-perf.R comparando contra el fallback.
.monitoreo_perf_transpose_records <- function(df, factor_a_caracter = FALSE) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(list())
  if (!ncol(df)) {
    # Réplica del shape histórico: un registro vacío (nombrado) por fila.
    return(rep(list(structure(list(), names = character(0))), nrow(df)))
  }
  tiene_dim <- vapply(df, function(col) !is.null(dim(col)), logical(1))
  if (any(tiene_dim)) return(.monitoreo_perf_records_por_fila(df, factor_a_caracter))
  cols <- lapply(df, function(col) {
    if (isTRUE(factor_a_caracter) && is.factor(col)) as.character(col) else col
  })
  .mapply(function(...) list(...), cols, NULL)
}

# Variante territorial (engine): factores → character, como el histórico
# .monitoreo_territorial_df_rows.
monitoreo_perf_df_rows <- function(df) {
  .monitoreo_perf_transpose_records(df, factor_a_caracter = TRUE)
}

# Variante del router (.monitoreo_df_records): coerciona no-df y preserva
# factores en las celdas (jsonlite los serializa como string igual que antes).
monitoreo_perf_df_records <- function(x) {
  if (is.null(x)) return(list())
  if (!is.data.frame(x)) x <- as.data.frame(x, stringsAsFactors = FALSE)
  .monitoreo_perf_transpose_records(x, factor_a_caracter = FALSE)
}

# --- Unidad 3.3a: caché de monitoreo_variables() por sesión -----------------

# Hogar elegido (documentado a propósito): env de PROCESO keyed por sid, no
# una clave de sesión. Razones: (a) el valor es 100% derivable de la data, no
# debe persistir en el .pulso ni censarse en session_schema.R; (b) una sola
# entrada por sid acota la memoria (se sobreescribe en cada cambio de key);
# (c) la invalidación viaja en la key (fingerprint barato + familia + fase),
# así que un sync o un cambio de esquema recomputan solos. Las mutaciones que
# reescriben contenido sin cambiar dims/synced_at (columnas .source_*) ya
# invalidan explícitamente vía .monitoreo_invalidate_dashboard_caches, que
# ahora también limpia esta caché.
.monitoreo_perf_variables_cache <- new.env(parent = emptyenv())

.monitoreo_perf_variables_cache_key <- function(data, synced_at = "", cfg = NULL) {
  familia <- .monitoreo_scalar((cfg$monitoreo_profile %||% list())$family, "")
  # La fase discrimina subsets territoriales que compartan dims por accidente.
  fase <- .monitoreo_scalar((cfg$territorial %||% list())$active_route_phase, "")
  paste(monitoreo_data_fingerprint(data, synced_at), familia, fase, sep = "|")
}

monitoreo_variables_cached <- function(sid, data, synced_at = "", cfg = NULL) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(list())
  sid_key <- .monitoreo_scalar(sid, "")
  if (!nzchar(sid_key)) return(monitoreo_variables(data))
  key <- .monitoreo_perf_variables_cache_key(data, synced_at, cfg)
  hit <- .monitoreo_perf_variables_cache[[sid_key]]
  if (is.list(hit) && identical(hit$key, key)) return(hit$value)
  value <- monitoreo_variables(data)
  assign(sid_key, list(key = key, value = value), envir = .monitoreo_perf_variables_cache)
  value
}

monitoreo_perf_variables_cache_invalidate <- function(sid = NULL) {
  if (is.null(sid)) {
    rm(list = ls(envir = .monitoreo_perf_variables_cache), envir = .monitoreo_perf_variables_cache)
  } else {
    sid_key <- .monitoreo_scalar(sid, "")
    if (nzchar(sid_key) && !is.null(.monitoreo_perf_variables_cache[[sid_key]])) {
      rm(list = sid_key, envir = .monitoreo_perf_variables_cache)
    }
  }
  # La invalidación nuclear del dashboard (única llamadora en producción)
  # también debe soltar las tabs de publicación cacheadas: derivan de la misma
  # data/config que acaba de declararse sucia.
  monitoreo_perf_publication_tabs_invalidate(sid)
  invisible(NULL)
}

# --- Unidad 3.8b: caché del payload de tabs de publicación -------------------

# El flujo real del frontend es preflight → publish sobre el MISMO corte: ambos
# endpoints llamaban .monitoreo_publication_preflight_bundle y pagaban dos
# veces monitoreo_publication_sheets_tabs (recorrido completo de la base). La
# caché vive en un env de proceso con UNA entrada por sid+audiencia (memoria
# acotada, nada persiste en el .pulso) y la frescura viaja en la key: token de
# dashboard (fingerprint de data + config particionado + scope) + audiencia +
# include_targets + spreadsheet destino + familia + firma del snapshot de
# ocurrencias (que alimenta las tabs internas territoriales y NO está cubierto
# por el token del dashboard).
.monitoreo_perf_publication_tabs_cache <- new.env(parent = emptyenv())

monitoreo_perf_publication_tabs_key <- function(sid,
                                                snapshot,
                                                cfg,
                                                audience = "client",
                                                include_targets = FALSE,
                                                report_scope = "full",
                                                spreadsheet_id = "",
                                                family = "") {
  occ <- tryCatch(
    session_get(sid, required = FALSE)$monitoreo_territorial_occurrences_snapshot,
    error = function(e) NULL
  )
  occ_sig <- if (is.list(occ)) {
    paste(
      .monitoreo_scalar(occ$synced_at %||% occ$generated_at, ""),
      if (is.data.frame(occ$data)) nrow(occ$data) else 0L,
      sep = ":"
    )
  } else {
    ""
  }
  paste(
    .monitoreo_dashboard_cache_token(
      list(synced_at = snapshot$synced_at %||% ""),
      snapshot$data,
      cfg,
      report_scope = report_scope
    ),
    .monitoreo_scalar(audience, "client"),
    isTRUE(include_targets),
    .monitoreo_scalar(spreadsheet_id, ""),
    .monitoreo_scalar(family, ""),
    occ_sig,
    sep = "|"
  )
}

monitoreo_perf_publication_tabs_cached <- function(sid, audience, key, build) {
  slot <- paste(.monitoreo_scalar(sid, ""), .monitoreo_scalar(audience, "client"), sep = "|")
  if (!nzchar(.monitoreo_scalar(sid, ""))) return(build())
  hit <- .monitoreo_perf_publication_tabs_cache[[slot]]
  if (is.list(hit) && identical(hit$key, key)) return(hit$value)
  value <- build()
  assign(slot, list(key = key, value = value), envir = .monitoreo_perf_publication_tabs_cache)
  value
}

monitoreo_perf_publication_tabs_invalidate <- function(sid = NULL) {
  slots <- ls(envir = .monitoreo_perf_publication_tabs_cache)
  if (!is.null(sid)) {
    sid_key <- .monitoreo_scalar(sid, "")
    slots <- slots[startsWith(slots, paste0(sid_key, "|"))]
  }
  if (length(slots)) rm(list = slots, envir = .monitoreo_perf_publication_tabs_cache)
  invisible(NULL)
}

# --- Unidad 3.5: cap de payload en la frontera pública -----------------------

# El cap se aplica en .monitoreo_public_dashboard (la serialización HTTP), NO
# dentro de monitoreo_territorial_reportes: el reporte completo almacenado en
# el snapshot alimenta entregables/publicación (workbooks, Sheets, PDFs) que
# necesitan TODAS las filas; capearlo en el engine truncaría entregables en
# silencio. Aquí solo se recorta lo que viaja por JSON en cada GET de state.
# Campos aditivos (truncated/total_rows) para que el frontend pueda avisar;
# el shape existente no cambia. Cap espejo del de queries_summary (5000).
.monitoreo_perf_payload_cap <- 5000L

monitoreo_perf_cap_territorial_reports <- function(reports, cap = .monitoreo_perf_payload_cap) {
  if (is.null(reports) || !is.list(reports)) return(reports)
  cap <- max(1L, as.integer(cap))
  medir <- function(x) {
    if (is.data.frame(x)) return(nrow(x))
    if (is.list(x)) return(length(x))
    0L
  }
  total_audit <- medir(reports$response_audit)
  if (total_audit > 0L) {
    if (total_audit > cap) reports$response_audit <- utils::head(reports$response_audit, cap)
    reports$response_audit_total_rows <- as.integer(total_audit)
    reports$response_audit_truncated <- total_audit > cap
  }
  total_points <- medir(reports$map$points)
  if (total_points > 0L) {
    if (total_points > cap) reports$map$points <- utils::head(reports$map$points, cap)
    reports$map$points_total_rows <- as.integer(total_points)
    reports$map$points_truncated <- total_points > cap
  }
  reports
}
