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
.ANALITICA_LECTURA_CACHE_MAX <- 12L

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

.analitica_lectura_cache_clear <- function() {
  keys <- ls(.analitica_lectura_cache, all.names = TRUE)
  if (length(keys)) rm(list = keys, envir = .analitica_lectura_cache)
  invisible(length(keys))
}

# Lectura memoizada. `reader` es el parser real (inyectable en tests).
.analitica_read_pair_memo <- function(pair, base_meta = NULL, reader) {
  signature <- tryCatch(
    .analitica_lectura_signature(pair, base_meta),
    # Sin firma se lee sin cache: la firma es una optimización, nunca un error.
    error = function(e) NULL
  )
  hit <- .analitica_lectura_cache_get(signature)
  if (!is.null(hit)) return(hit)
  value <- reader(pair, base_meta)
  .analitica_lectura_cache_put(signature, value)
}
