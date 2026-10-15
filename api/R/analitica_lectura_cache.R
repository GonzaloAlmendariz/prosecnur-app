# Cache de lectura de pares XLSForm/Data para Analítica.
#
# `.analitica_prepare_context()` vuelve a leer y parsear TODAS las bases del
# estudio cada vez que la clave del cache singular cambia, y esa clave incluye la
# base activa (`.analitica_source_cache_key`). Medido el 2026-10-15 en HSyVbG
# (2026 xlsx 3.318×137, 2024 .sav 2.267×409, 2025 .sav 2.471×278): cambiar de
# base activa costaba ~9–11 s de re-lectura de las tres, aunque ningún archivo
# hubiera cambiado.
#
# El parseo de un par depende sólo de: los dos archivos (ruta + mtime + tamaño),
# la metadata de la base (`caso_valido`, clave integrada, `source_kind`) y el
# override de etiquetas ambiente. Esa es la firma. Si cualquiera cambia, la firma
# cambia y se relee; nada se invalida "a mano". El cache vive en un env de
# módulo (no en la sesión), así que no viaja al `.pulso` ni al `state.rds`.
# Tope de entradas para no retener data de sesiones cerradas.

.analitica_lectura_cache <- new.env(parent = emptyenv())
# Cada base ocupa dos entradas (lectura cruda + normalizada): 16 cubre un
# estudio de tres bases con margen para versiones previas de sus archivos.
.ANALITICA_LECTURA_CACHE_MAX <- 16L

.analitica_lectura_file_stamp <- function(meta) {
  path <- as.character((meta %||% list())$path %||% "")
  if (!length(path) || is.na(path[[1]]) || !nzchar(path[[1]]) || !file.exists(path[[1]])) {
    return(NULL)
  }
  info <- file.info(path[[1]])
  list(
    path = normalizePath(path[[1]], mustWork = FALSE),
    ext = as.character((meta %||% list())$ext %||% ""),
    mtime = format(as.numeric(info$mtime), digits = 15),
    size = as.character(info$size)
  )
}

# Firma del par, o NULL si no se puede firmar (archivo ausente): sin firma no se
# cachea y la lectura falla o resuelve como siempre.
.analitica_lectura_signature <- function(pair, base_meta = NULL) {
  xls <- .analitica_lectura_file_stamp(pair$xls)
  dat <- .analitica_lectura_file_stamp(pair$data)
  if (is.null(xls) || is.null(dat)) return(NULL)
  overrides <- if (exists(".label_overrides_ambient", mode = "function")) {
    .label_overrides_ambient()
  } else NULL
  digest::digest(
    list(xls = xls, data = dat, base_meta = base_meta, label_overrides = overrides),
    algo = "xxhash64"
  )
}

.analitica_lectura_cache_get <- function(signature) {
  if (is.null(signature)) return(NULL)
  hit <- get0(signature, envir = .analitica_lectura_cache, inherits = FALSE)
  if (is.null(hit)) return(NULL)
  hit$used_at <- Sys.time()
  assign(signature, hit, envir = .analitica_lectura_cache)
  hit$value
}

.analitica_lectura_cache_put <- function(signature, value) {
  if (is.null(signature)) return(invisible(value))
  assign(signature, list(value = value, used_at = Sys.time()), envir = .analitica_lectura_cache)
  keys <- ls(.analitica_lectura_cache, all.names = TRUE)
  if (length(keys) > .ANALITICA_LECTURA_CACHE_MAX) {
    used <- vapply(keys, function(k) {
      as.numeric(get(k, envir = .analitica_lectura_cache)$used_at)
    }, numeric(1))
    drop <- keys[order(used)][seq_len(length(keys) - .ANALITICA_LECTURA_CACHE_MAX)]
    rm(list = drop, envir = .analitica_lectura_cache)
  }
  invisible(value)
}

# Ante un fallo, cosecha la lectura en segundo plano si ya terminó
# (analitica_warmup.R) y vuelve a mirar. Nunca espera a un job vivo.
.analitica_lectura_cache_get_or_harvest <- function(signature) {
  if (is.null(signature)) return(NULL)
  hit <- .analitica_lectura_cache_get(signature)
  if (!is.null(hit)) return(hit)
  harvested <- tryCatch(.analitica_lectura_bg_harvest(), error = function(e) 0L)
  if (harvested > 0L) .analitica_lectura_cache_get(signature) else NULL
}

.analitica_lectura_cache_clear <- function() {
  keys <- ls(.analitica_lectura_cache, all.names = TRUE)
  if (length(keys)) rm(list = keys, envir = .analitica_lectura_cache)
  invisible(length(keys))
}

# La lectura devuelta lleva su firma como atributo: así quien la normaliza
# después (`.analitica_prepare_and_cache`) puede memoizar también ese paso sin
# volver a firmar los archivos.
.analitica_lectura_tag <- function(value, signature) {
  if (is.null(signature) || !is.list(value)) return(value)
  attr(value, "analitica_lectura_signature") <- signature
  value
}

# Lectura memoizada. `reader` es el parser real (inyectable en tests).
.analitica_read_pair_memo <- function(pair, base_meta = NULL, reader) {
  signature <- tryCatch(
    .analitica_lectura_signature(pair, base_meta),
    # Sin firma se lee sin cache: la firma es una optimización, nunca un error.
    error = function(e) NULL
  )
  hit <- .analitica_lectura_cache_get_or_harvest(signature)
  if (!is.null(hit)) return(.analitica_lectura_tag(hit, signature))
  value <- reader(pair, base_meta)
  .analitica_lectura_cache_put(signature, value)
  .analitica_lectura_tag(value, signature)
}

# Normalización de reporte (`.bases_normalize_report_context`) de una lectura
# ya firmada. Es función pura de la lectura y del override ambiente, y ambos ya
# están en la firma: cuesta ~0,3–0,9 s por base y se pagaba en cada cambio de
# base activa. Sin firma se normaliza sin cache.
.analitica_lectura_norm_key <- function(signature) {
  if (is.null(signature) || !is.character(signature) || length(signature) != 1L ||
      is.na(signature) || !nzchar(signature)) {
    return(NULL)
  }
  paste0(signature, "::norm")
}

.analitica_lectura_normalized <- function(signature, data, inst, normalize = .bases_normalize_report_context) {
  key <- .analitica_lectura_norm_key(signature)
  hit <- .analitica_lectura_cache_get_or_harvest(key)
  if (!is.null(hit)) return(hit)
  value <- normalize(data, inst)
  .analitica_lectura_cache_put(key, value)
}

# Equivalente memoizado de `.bases_normalize_source_contexts` para el contexto
# de Analítica: `signatures` es la firma de lectura de cada base (por nombre).
.analitica_lectura_normalize_sources <- function(data_sources, inst_sources, signatures = list()) {
  if (!is.list(data_sources) || is.data.frame(data_sources) ||
      !is.list(inst_sources) || is.data.frame(inst_sources)) {
    return(list(data_sources = data_sources, inst_sources = inst_sources))
  }
  for (nm in intersect(names(data_sources), names(inst_sources))) {
    ctx <- .analitica_lectura_normalized(
      (signatures %||% list())[[nm]],
      data_sources[[nm]],
      inst_sources[[nm]]
    )
    data_sources[[nm]] <- ctx$data
    inst_sources[[nm]] <- ctx$inst
  }
  list(data_sources = data_sources, inst_sources = inst_sources)
}
