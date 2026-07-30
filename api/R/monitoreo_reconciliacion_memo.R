# monitoreo_reconciliacion_memo.R — Ola 5 del plan de perf (unidades 5.1a/5.1b).
#
# Este archivo existe porque monitoreo_engine.R está congelado a crecimiento:
# la funcionalidad nueva vive aquí y el engine la llama por nombre. Ataca los
# dos costos medidos en 5.0 sobre acrconta (warmup frío de 299.7 s, ~261 s en
# la reconciliación de acreditación):
#
#   1. (5.1a) La reconciliación (.monitoreo_acreditacion_internal_queries) se
#      computaba TRES veces por warmup: advance_summary la dispara dos veces
#      (case_rollup del client_report_model + la detección de controles de
#      publicación, que recae en el rollup porque el modelo summary_only trae
#      controls vacío) y queries_summary una tercera. Aquí se memoiza por
#      contenido: digest EXACTO de la data + profile normalizado. No se usa el
#      fingerprint barato (dims + nombres) a propósito: dos cortes con las
#      mismas dimensiones servirían números viejos que parecen frescos, y eso
#      es peor que esperar. El digest xxhash64 de la data real de acrconta
#      (1.277×450) cuesta ~19 ms contra los ~87 s del build.
#
#   2. (5.1b) .monitoreo_text_key era el 62% del tiempo de la reconciliación:
#      los loops respuesta×base la invocan de a un valor por vez, y cada
#      llamada pagaba trimws/tolower/iconv/gsub sobre los MISMOS strings
#      (nombres de columna, actores, estados) cientos de miles de veces. La
#      transformación no cambia: se computa una sola vez por string distinto
#      y se sirve desde un memo de proceso. Hay test de paridad elemento a
#      elemento contra la implementación histórica.
#
# Seguridad del memo de reconciliación: la función es pura en (data, profile)
# —lo documenta monitoreo_acreditacion_queries_cache.R y no lee sesión, reloj
# ni entorno—, y las decisiones manuales de conciliación viajan DENTRO del
# profile (reconciliation_decisions), así que cualquier decisión nueva cambia
# la clave sola. En los workers callr el memo nace vacío con el namespace.

# --- 5.1b: llave de texto normalizada, memoizada por string ------------------

# Pipeline histórico (idéntico al que vivía en monitoreo_engine.R). Se asume
# input ya pasado por as.character(); opera vectorizado sobre el lote de
# strings aún no vistos.
.monitoreo_text_key_compute <- function(x) {
  x <- trimws(tolower(x))
  x[is.na(x)] <- ""
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[`'´’]", "", x)
  gsub("\\s+", " ", x)
}

.monitoreo_text_key_memo <- new.env(parent = emptyenv())
.monitoreo_text_key_memo_state <- new.env(parent = emptyenv())

# Techo de entradas: strings cortos (llaves, nombres de columna, actores), así
# que el techo cuesta pocos MB. Al superarlo se vacía entero: un LRU fino no
# paga su complejidad cuando recomputar una llave cuesta microsegundos.
.MONITOREO_TEXT_KEY_MEMO_MAX <- 200000L
# Strings enormes (celdas de texto libre) no se memoizan: un nombre de binding
# desmedido no aporta hits y sí memoria.
.MONITOREO_TEXT_KEY_MEMO_NCHAR_MAX <- 500L

.monitoreo_text_key <- function(x) {
  x <- as.character(x %||% "")
  n <- length(x)
  if (!n) return(x)
  nms <- names(x)
  ux <- if (n == 1L) x else unique(x)
  vals <- character(length(ux))
  es_na <- is.na(ux)
  # nzchar(NA) es TRUE con keepNA por defecto; el orden de estas máscaras
  # importa: primero se separa NA, después el vacío.
  trivial <- es_na | !nzchar(ux)
  memoizable <- !trivial & nchar(ux, type = "bytes") <= .MONITOREO_TEXT_KEY_MEMO_NCHAR_MAX
  memoizable[is.na(memoizable)] <- FALSE
  pendiente <- !trivial
  for (i in which(memoizable)) {
    hit <- get0(ux[[i]], envir = .monitoreo_text_key_memo, inherits = FALSE)
    if (!is.null(hit)) {
      vals[[i]] <- hit
      pendiente[[i]] <- FALSE
    }
  }
  # El pipeline histórico deja NA y "" en "": se resuelven sin computar.
  if (any(pendiente)) {
    computados <- .monitoreo_text_key_compute(ux[pendiente])
    vals[pendiente] <- computados
    guardar <- which(pendiente & memoizable)
    if (length(guardar)) {
      st <- .monitoreo_text_key_memo_state
      total <- st$n %||% 0L
      if (total + length(guardar) > .MONITOREO_TEXT_KEY_MEMO_MAX) {
        rm(
          list = ls(envir = .monitoreo_text_key_memo, all.names = TRUE),
          envir = .monitoreo_text_key_memo
        )
        total <- 0L
      }
      for (i in guardar) assign(ux[[i]], vals[[i]], envir = .monitoreo_text_key_memo)
      st$n <- total + length(guardar)
    }
  }
  out <- if (n == 1L) vals else vals[match(x, ux)]
  names(out) <- nms
  out
}

.monitoreo_text_key_memo_reset <- function() {
  rm(
    list = ls(envir = .monitoreo_text_key_memo, all.names = TRUE),
    envir = .monitoreo_text_key_memo
  )
  .monitoreo_text_key_memo_state$n <- 0L
  invisible(NULL)
}

# --- 5.1a: memo por contenido de la reconciliación de acreditación -----------

.monitoreo_reconciliacion_memo <- new.env(parent = emptyenv())
.monitoreo_reconciliacion_state <- new.env(parent = emptyenv())

# Dos entradas bastan: el warmup y los cuatro scopes trabajan sobre UN corte;
# la segunda tolera un toggle rápido entre dos cortes sin recomputar.
.MONITOREO_RECONCILIACION_MEMO_LIMIT <- 2L

# Clave exacta por contenido. Devuelve "" si digest no está disponible: sin
# clave confiable no hay memo (se recomputa, que es el comportamiento viejo).
.monitoreo_reconciliacion_memo_key <- function(data, profile_norm) {
  if (!requireNamespace("digest", quietly = TRUE)) return("")
  paste(
    digest::digest(data, algo = "xxhash64"),
    digest::digest(profile_norm, algo = "xxhash64"),
    sep = "|"
  )
}

.monitoreo_reconciliacion_memo_get <- function(key) {
  if (!nzchar(key)) return(NULL)
  entry <- .monitoreo_reconciliacion_memo[[key]]
  if (!is.list(entry) || !identical(entry$key, key)) return(NULL)
  entry$value
}

.monitoreo_reconciliacion_memo_set <- function(key, value) {
  if (!nzchar(key)) return(invisible(NULL))
  claves <- ls(envir = .monitoreo_reconciliacion_memo, all.names = TRUE)
  if (length(claves) >= .MONITOREO_RECONCILIACION_MEMO_LIMIT && !key %in% claves) {
    ordenes <- vapply(
      claves,
      function(k) .monitoreo_reconciliacion_memo[[k]]$orden %||% 0,
      numeric(1)
    )
    rm(list = claves[which.min(ordenes)], envir = .monitoreo_reconciliacion_memo)
  }
  orden <- (.monitoreo_reconciliacion_state$orden %||% 0) + 1
  .monitoreo_reconciliacion_state$orden <- orden
  assign(key, list(key = key, value = value, orden = orden), envir = .monitoreo_reconciliacion_memo)
  invisible(NULL)
}

# Contador de builds REALES (misses que ejecutan la reconciliación completa).
# Los tests lo usan para demostrar que un ciclo advance_summary+queries_summary
# ejecuta la reconciliación exactamente una vez (antes: tres).
.monitoreo_reconciliacion_nota_build <- function() {
  actual <- .monitoreo_reconciliacion_state$builds %||% 0L
  .monitoreo_reconciliacion_state$builds <- actual + 1L
  invisible(NULL)
}

monitoreo_reconciliacion_build_count <- function() {
  .monitoreo_reconciliacion_state$builds %||% 0L
}

monitoreo_reconciliacion_memo_reset <- function() {
  rm(
    list = ls(envir = .monitoreo_reconciliacion_memo, all.names = TRUE),
    envir = .monitoreo_reconciliacion_memo
  )
  .monitoreo_reconciliacion_state$builds <- 0L
  .monitoreo_reconciliacion_state$orden <- 0
  invisible(NULL)
}

# Fachada memoizada: el nombre público que consume todo el engine. El cuerpo
# histórico vive en .monitoreo_acreditacion_internal_queries_impl (engine).
.monitoreo_acreditacion_internal_queries <- function(data, profile = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) {
    return(.monitoreo_acreditacion_internal_queries_impl(data, profile))
  }
  # La clave usa el profile NORMALIZADO (dos formas crudas equivalentes deben
  # compartir entrada), pero al impl viaja el original: el impl normaliza por
  # su cuenta y así no dependemos de que la normalización sea idempotente.
  profile_norm <- monitoreo_normalize_profile(profile)
  key <- .monitoreo_reconciliacion_memo_key(data, profile_norm)
  # Sin clave confiable no hay memo: se recomputa siempre (comportamiento
  # previo a 5.1a). El guard va sobre la clave CRUDA: prefijarla primero la
  # volvería no-vacía y colapsaría todo a una entrada constante.
  if (!nzchar(key)) {
    .monitoreo_reconciliacion_nota_build()
    return(.monitoreo_acreditacion_internal_queries_impl(data, profile))
  }
  hit <- .monitoreo_reconciliacion_memo_get(paste0("iq|", key))
  if (!is.null(hit)) return(hit)
  .monitoreo_reconciliacion_nota_build()
  value <- .monitoreo_acreditacion_internal_queries_impl(data, profile)
  .monitoreo_reconciliacion_memo_set(paste0("iq|", key), value)
  value
}

# El rollup deduplicado también se memoiza (contrato 5.1a: "internal_queries y
# su case_rollup una vez"): la deduplicación cuesta ~1.2 s por consumidor en
# acrconta. Cuando el llamador ya trae internal_queries en mano se respeta el
# camino directo, sin memo: ese resultado puede venir de un cache persistido
# cuyo contenido no participa de la clave.
.monitoreo_acreditacion_case_rollup_df <- function(data, profile = list(), internal_queries = NULL) {
  if (!is.null(internal_queries)) {
    return(.monitoreo_acreditacion_case_rollup_df_impl(data, profile, internal_queries))
  }
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) {
    return(.monitoreo_acreditacion_case_rollup_df_impl(data, profile))
  }
  profile_norm <- monitoreo_normalize_profile(profile)
  key <- .monitoreo_reconciliacion_memo_key(data, profile_norm)
  if (!nzchar(key)) return(.monitoreo_acreditacion_case_rollup_df_impl(data, profile))
  hit <- .monitoreo_reconciliacion_memo_get(paste0("rollup|", key))
  if (!is.null(hit)) return(hit)
  value <- .monitoreo_acreditacion_case_rollup_df_impl(data, profile)
  .monitoreo_reconciliacion_memo_set(paste0("rollup|", key), value)
  value
}
