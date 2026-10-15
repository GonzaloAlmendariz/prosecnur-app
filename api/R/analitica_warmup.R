# Lectura de todas las bases para Analítica en segundo plano tras abrir.
#
# Medido el 2026-10-15 sobre HSyVbG (2026 xlsx 3.318×137, 2024 .sav 2.267×409,
# 2025 .sav 2.471×278): la primera `GET /api/analitica/variables` tras abrir el
# proyecto pagaba ~8–12 s leyendo y parseando las tres bases
# (`.analitica_read_pair`), normalizándolas y comprobando el reparador de
# recodificadas. El memo de lectura (analitica_lectura_cache.R) vive en la
# memoria del proceso plumber.
#
# Meterlo en el warm start bloqueante movía ~18 s a la apertura de CUALQUIER
# proyecto, aunque nadie fuera a Analítica. Por eso el reparto es:
#   1. Proceso plumber, al pedir el warmup (`.analitica_warmup_prerepair`): el
#      reparador convergente de recodificadas (~0,5 s). Puede reescribir
#      XLSForm y data y tocar la sesión viva, así que no va a un worker.
#   2. Al cosecharse el warmup (`.project_warmup_on_complete`) arranca un job
#      `callr` APARTE (`.analitica_lectura_bg_start`) que lee y normaliza cada
#      base y devuelve (firma, lectura, normalizada). Nadie lo espera.
#   3. La cosecha es oportunista (`.analitica_lectura_bg_harvest`): la dispara
#      cualquier fallo del memo de lectura. Si el job ya terminó, sus entradas
#      se instalan y la lectura acierta; si sigue corriendo, se lee como
#      siempre, sin esperar. La UI no tiene que mirar el job.
#
# Lo instalado nunca pisa lo que el backend ya tenga para esa firma, y la firma
# depende sólo de archivos + metadata + override de etiquetas: si algo cambió
# mientras el job corría, la firma del backend difiere y la entrada vieja
# simplemente no acierta. Una lectura producida por OTRO código (el worker carga
# el paquete instalado, que en dev puede ir por detrás del `load_all`) no se
# instala: el sello de código tiene que coincidir.

.ANALITICA_WARMUP_CODE_FNS <- c(
  ".analitica_read_pair_uncached",
  ".analitica_read_data_file",
  ".analitica_apply_integrated_key",
  ".analitica_apply_integrated_key_to_data",
  ".analitica_aplicar_caso_valido",
  ".bases_normalize_report_context",
  "reporte_instrumento",
  "reporte_data",
  "normalize_data_for_xlsform",
  "sanitize_base_data"
)

# Sello del código que produce una lectura: versión del paquete + texto de las
# funciones del camino de lectura. `deparse` sin `useSource` no depende de
# srcref, así que dos procesos con el mismo código dan el mismo sello.
.analitica_warmup_code_stamp <- function() {
  ns <- environment(.analitica_warmup_code_stamp)
  bodies <- lapply(.ANALITICA_WARMUP_CODE_FNS, function(nm) {
    fn <- get0(nm, envir = ns, mode = "function")
    if (is.null(fn)) "" else deparse(fn)
  })
  version <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) ""
  )
  digest::digest(list(version = version, bodies = bodies), algo = "xxhash64")
}

.analitica_warmup_prerepair <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || !length((s$estudio %||% list())$bases %||% list())) {
    return(invisible(FALSE))
  }
  # Un fallo del reparador no debe impedir el warm start: la primera lectura de
  # Analítica lo vuelve a intentar y ahí sí reporta.
  invisible(isTRUE(tryCatch(.analitica_repair_project_context(sid), error = function(e) FALSE)))
}

# Pares a leer: TODAS las bases del estudio, cada una con la fuente que tendría
# si la Analítica se abriera con ella activa (en `independent_siblings` el
# alcance es la base sola; en el resto, el estudio entero).
.analitica_warmup_pairs <- function(sid) {
  s <- session_get(sid)
  cfg <- .analitica_get_config(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (!length(bases)) {
    src <- tryCatch(.analitica_fuentes(sid, cfg), error = function(e) NULL)
    if (is.null(src)) return(list())
    return(list(default = list(
      nombre = "default",
      pair = list(xls = list(path = src$inst_path), data = src$data_meta),
      base_meta = NULL
    )))
  }
  independent <- isTRUE(tryCatch(estudio_is_independent_siblings(sid), error = function(e) FALSE))
  fuente_estudio <- .analitica_effective_source(s, cfg, bases)
  out <- list()
  for (nombre in names(bases)) {
    fuente <- if (independent) {
      .analitica_effective_source(s, cfg, stats::setNames(list(bases[[nombre]]), nombre))
    } else {
      fuente_estudio
    }
    out[[nombre]] <- list(
      nombre = nombre,
      pair = .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre),
      base_meta = bases[[nombre]]
    )
  }
  out
}

.analitica_warmup_read_one <- function(item) {
  if (is.null(item$pair)) {
    return(list(status = "error", error = "No se pudo resolver el par XLSForm/Data de la base."))
  }
  signature <- .analitica_lectura_signature(item$pair, item$base_meta)
  if (is.null(signature)) {
    return(list(status = "skipped", error = "Archivos de la base no disponibles."))
  }
  parsed <- .analitica_read_pair(item$pair, item$base_meta)
  normalized <- .analitica_lectura_normalized(signature, parsed$data, parsed$inst)
  attr(parsed, "analitica_lectura_signature") <- NULL
  list(
    status = "ready",
    entry = list(signature = signature, value = parsed, normalized = normalized)
  )
}

# Corre en el worker del job de lectura. `deadline` (POSIXct) corta ENTRE bases: lo que
# no alcanzó queda en `timeout` y se lee en la primera llamada, como antes.
.analitica_warmup_collect <- function(sid, deadline = NULL, progress = NULL) {
  started <- Sys.time()
  s <- session_get(sid)
  # El override de etiquetas entra en la firma: el worker arranca limpio y debe
  # publicar el mismo override que load_pulso dejó en el backend.
  if (exists(".label_overrides_activate", mode = "function")) {
    tryCatch(.label_overrides_activate(s$label_overrides), error = function(e) NULL)
  }
  report <- if (is.function(progress)) progress else function(...) invisible(NULL)
  pairs <- .analitica_warmup_pairs(sid)
  total <- length(pairs)
  entries <- list()
  bases <- list()
  for (idx in seq_along(pairs)) {
    item <- pairs[[idx]]
    nombre <- item$nombre
    base_started <- Sys.time()
    if (!is.null(deadline) && Sys.time() >= deadline) {
      bases[[length(bases) + 1L]] <- list(base = nombre, status = "timeout", elapsed_ms = 0L)
      next
    }
    report(
      phase = "running", current = idx - 1L, total = total,
      message = sprintf("Leyendo la base %s para Analítica (%d de %d)...", nombre, idx, total)
    )
    res <- tryCatch(
      .analitica_warmup_read_one(item),
      error = function(e) list(status = "error", error = conditionMessage(e))
    )
    if (identical(res$status, "ready")) entries[[nombre]] <- res$entry
    bases[[length(bases) + 1L]] <- list(
      base = nombre,
      status = res$status,
      elapsed_ms = .analitica_warmup_elapsed_ms(base_started),
      error = if (!is.null(res$error)) substr(as.character(res$error), 1L, 220L) else NULL
    )
  }
  report(phase = "running", current = total, total = total, message = "Bases de Analítica leídas.")
  statuses <- vapply(bases, function(b) as.character(b$status), character(1))
  list(
    n_bases = total,
    n_ready = sum(statuses == "ready"),
    statuses = statuses,
    bases = bases,
    elapsed_ms = .analitica_warmup_elapsed_ms(started),
    payload = if (length(entries)) {
      list(code_stamp = .analitica_warmup_code_stamp(), entries = entries)
    } else {
      NULL
    }
  )
}

.analitica_warmup_elapsed_ms <- function(started_at) {
  as.integer(max(0, round(as.numeric(difftime(Sys.time(), started_at, units = "secs")) * 1000)))
}

# Corre en el proceso plumber al cosechar el job de lectura. Devuelve cuántas bases
# quedaron instaladas en el memo de lectura.
.analitica_warmup_install <- function(payload) {
  if (!is.list(payload) || !is.list(payload$entries) || !length(payload$entries)) return(0L)
  if (!identical(as.character(payload$code_stamp %||% ""), .analitica_warmup_code_stamp())) {
    return(0L)
  }
  installed <- 0L
  for (entry in payload$entries) {
    signature <- entry$signature
    if (!is.character(signature) || length(signature) != 1L || is.na(signature) ||
        !nzchar(signature) || !is.list(entry$value)) {
      next
    }
    # Lo que el backend ya tenga para esa firma es igual de válido y puede estar
    # referenciado por la sesión viva: no se pisa.
    if (is.null(.analitica_lectura_cache_get(signature))) {
      .analitica_lectura_cache_put(signature, entry$value)
    }
    norm_key <- .analitica_lectura_norm_key(signature)
    if (is.list(entry$normalized) && is.null(.analitica_lectura_cache_get(norm_key))) {
      .analitica_lectura_cache_put(norm_key, entry$normalized)
    }
    installed <- installed + 1L
  }
  installed
}

# --- Job en segundo plano ----------------------------------------------------

# sid → list(job_id, project_path). Sólo jobs aún no cosechados.
.analitica_lectura_bg <- new.env(parent = emptyenv())

.analitica_lectura_job <- function(session_path, progress_path = NULL) {
  s <- readRDS(session_path)
  sid <- as.character(s$id %||% "")
  if (!nzchar(sid)) stop("Sesion invalida para la lectura de Analitica.", call. = FALSE)
  .session_env[[sid]] <- s
  report <- if (!is.null(progress_path)) job_progress_writer(progress_path) else NULL
  lectura <- .analitica_warmup_collect(sid, progress = report)
  # Las bases leídas viajan por archivo, no por `result_data`: así el registro
  # de jobs nunca retiene una copia de las bases, se coseche por donde se coseche.
  payload_path <- sub("\\.rds$", "_lectura.rds", session_path)
  saveRDS(lectura$payload, payload_path, compress = FALSE)
  lectura$payload <- NULL
  lectura$payload_path <- payload_path
  lectura$sid <- sid
  lectura$project_path <- as.character(s$project_path %||% "")
  lectura
}
attr(.analitica_lectura_job, "prosecnur_job_function_name") <- ".analitica_lectura_job"

# Hay algo que leer: al menos una base (o la fuente única) con su par resuelto.
.analitica_lectura_bg_applies <- function(sid) {
  pairs <- tryCatch(.analitica_warmup_pairs(sid), error = function(e) list())
  any(vapply(pairs, function(p) !is.null(p$pair), logical(1)))
}

.analitica_lectura_bg_start <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s) || !.analitica_lectura_bg_applies(sid)) return(NULL)
  prev <- get0(sid, envir = .analitica_lectura_bg, inherits = FALSE)
  # Sólo un job VIVO evita lanzar otro: uno ya terminado es de una apertura
  # anterior (quizá de otro proyecto en el mismo sid) y no precarga éste.
  prev_job <- if (!is.null(prev)) .jobs[[prev$job_id]] else NULL
  if (!is.null(prev_job) && identical(prev_job$status, "running") &&
      identical(prev$project_path, as.character(s$project_path %||% ""))) {
    return(prev$job_id)
  }
  session_path <- job_save_rds(sid, "analitica_lectura_session", s)
  job_id <- job_submit(
    sid = sid,
    kind = "analitica.lectura",
    func = .analitica_lectura_job,
    args = list(session_path = session_path),
    on_complete = .analitica_lectura_bg_on_complete,
    on_cleanup = function(j) job_unlink_inputs(session_path)
  )
  assign(sid, list(job_id = job_id, project_path = as.character(s$project_path %||% "")),
         envir = .analitica_lectura_bg)
  job_id
}

# Corre dentro de `job_poll` (proceso plumber). Sólo instala si la sesión sigue
# viva con el mismo proyecto: lo de un proyecto ya cerrado sería memoria muerta.
.analitica_lectura_bg_on_complete <- function(j) {
  result <- j$result_data
  installed <- 0L
  current <- session_get(j$sid, required = FALSE)
  same_project <- !is.null(current) && identical(
    as.character(current$project_path %||% ""),
    as.character((result %||% list())$project_path %||% "")
  )
  payload_path <- as.character((result %||% list())$payload_path %||% "")
  if (is.list(result) && isTRUE(same_project)) {
    payload <- if (nzchar(payload_path) && file.exists(payload_path)) {
      tryCatch(readRDS(payload_path), error = function(e) NULL)
    } else result[["payload"]]  # [[ ]]: `$payload` completaría a `payload_path`
    if (!is.null(payload)) installed <- .analitica_warmup_install(payload)
  }
  if (nzchar(payload_path)) unlink(payload_path)
  # Cosechado (por el tick o por un fallo del memo): ya no está pendiente.
  pending <- get0(j$sid, envir = .analitica_lectura_bg, inherits = FALSE)
  if (!is.null(pending) && identical(pending$job_id, j$id %||% pending$job_id)) {
    rm(list = j$sid, envir = .analitica_lectura_bg)
  }
  list(
    ok = TRUE,
    kind = "analitica.lectura",
    installed = installed,
    bases = (result %||% list())$bases %||% list(),
    elapsed_ms = (result %||% list())$elapsed_ms %||% NULL
  )
}

# Cosecha oportunista: no bloquea (sólo `is_alive` mientras el worker corre) y
# devuelve cuántas bases quedaron instaladas en esta pasada.
.analitica_lectura_bg_harvest <- function() {
  sids <- ls(.analitica_lectura_bg, all.names = TRUE)
  installed <- 0L
  for (sid in sids) {
    pending <- get0(sid, envir = .analitica_lectura_bg, inherits = FALSE)
    j <- if (!is.null(pending)) .jobs[[pending$job_id]] else NULL
    if (is.null(j)) {
      rm(list = sid, envir = .analitica_lectura_bg)
      next
    }
    if (identical(j$status, "running")) {
      alive <- tryCatch(isTRUE(j$rx$is_alive()), error = function(e) FALSE)
      if (alive) next
      j <- tryCatch(job_poll(pending$job_id), error = function(e) NULL)
    }
    if (is.null(j) || identical(j$status, "running")) next
    installed <- installed + as.integer((j$result_public %||% list())$installed %||% 0L)
    # El payload ya vive en el memo (o se descartó): el registro de jobs no
    # tiene por qué retener otra referencia a las bases.
    if (!is.null(.jobs[[pending$job_id]])) {
      jj <- .jobs[[pending$job_id]]
      jj$result_data <- NULL
      .jobs[[pending$job_id]] <- jj
    }
    rm(list = sid, envir = .analitica_lectura_bg)
  }
  installed
}
