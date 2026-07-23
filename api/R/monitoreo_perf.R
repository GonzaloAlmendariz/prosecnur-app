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
