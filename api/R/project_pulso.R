# =============================================================================
# Archivos de proyecto .pulso — serialización y carga
# =============================================================================
# Un `.pulso` es un archivo zip con:
#   manifest.json   # metadata (version, timestamps, app_version, project_name)
#   state.rds       # saveRDS del env de sesión filtrado (sin caches)
#   files/          # copias crudas de s$files (<file_id>__<original_name>)
#
# El formato es zip porque R tiene `zip::zip/unzip` nativo, el contenido es
# inspeccionable con `unzip -l`, y si el state.rds se corrompe las fuentes
# crudas siguen en files/ para re-derivar. Los paths absolutos de
# `s$files[[*]]$path` se reescriben al tempdir de la sesión destino al cargar,
# así el .pulso viaja entre máquinas sin problema.
#
# Campos excluidos del state.rds (se excluyen del save, se regeneran al load):
#   - s$codif_por_base[[*]]$inst  — cache del XLSForm parseado
#   - s$codif_por_base[[*]]$data  — cache del dataframe crudo
#   - s$estudio$bases[[*]]$validacion$explorador_cache — hashes de views
# Esto evita serializar objetos gordos (tibbles con 50k filas) que son
# derivables de los file_id que sí están en el zip.

# -----------------------------------------------------------------------------
# Helpers de filtrado
# -----------------------------------------------------------------------------

# Devuelve una copia del session state sin los caches derivables. NO toca
# el env original — solo construye la versión "liviana" para saveRDS.
.pulso_strip_caches <- function(s) {
  if (!is.null(s$codif_por_base) && is.list(s$codif_por_base)) {
    for (src in names(s$codif_por_base)) {
      s$codif_por_base[[src]]$inst <- NULL
      s$codif_por_base[[src]]$data <- NULL
    }
  }
  if (!is.null(s$estudio) && is.list(s$estudio$bases)) {
    for (bname in names(s$estudio$bases)) {
      # La validación de base tiene un explorador_cache que se regenera.
      if (!is.null(s$estudio$bases[[bname]]$validacion)) {
        s$estudio$bases[[bname]]$validacion$explorador_cache <- NULL
      }
    }
  }
  s
}

# Reescribe s$files[[*]]$path para que apunten al nuevo tempdir de sesión
# tras un load_pulso. Los files físicos ya fueron copiados por el caller a
# `uploads_dir`.
.pulso_rewrite_paths <- function(s, uploads_dir) {
  if (is.null(s$files) || !length(s$files)) return(s)
  for (fid in names(s$files)) {
    meta <- s$files[[fid]]
    if (is.null(meta) || is.null(meta$ext)) next
    new_path <- file.path(uploads_dir, sprintf("%s.%s", fid, meta$ext))
    if (file.exists(new_path)) {
      s$files[[fid]]$path <- new_path
    }
    # Si no existe el archivo físico en el nuevo dir, dejamos el path NULL
    # para que los routers detecten el missing y muestren error claro.
  }
  # Algunos campos de sesión también guardan paths cacheados. Los dejamos
  # consistentes con el files store.
  if (!is.null(s$data_raw_meta) && !is.null(s$data_raw_meta$file_id)) {
    fid <- s$data_raw_meta$file_id
    if (!is.null(s$files[[fid]])) {
      s$data_raw_meta$path <- s$files[[fid]]$path
    }
  }
  s
}

# -----------------------------------------------------------------------------
# build_pulso — guarda la sesión actual a un .pulso
# -----------------------------------------------------------------------------
# Args:
#   sid         — session id activa
#   dest_path   — path absoluto del .pulso (se crea o reemplaza)
#   project_name — nombre humano para el manifest (opcional)
# Retorna list(ok=TRUE, size, saved_at).
build_pulso <- function(sid, dest_path, project_name = NULL) {
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está instalado.")
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop_api(500, "E_NO_JSONLITE", "El paquete R 'jsonlite' no está instalado.")
  }

  s <- session_get(sid)

  # Staging temp para armar el zip.
  stage_dir <- tempfile("pulso_stage_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)

  # 1) Copiar files físicos con nombre estable <file_id>__<original_name>
  files_dir <- file.path(stage_dir, "files")
  dir.create(files_dir, recursive = TRUE, showWarnings = FALSE)
  if (!is.null(s$files) && length(s$files) > 0L) {
    for (fid in names(s$files)) {
      meta <- s$files[[fid]]
      if (is.null(meta$path) || !file.exists(meta$path)) next
      # Usamos doble underscore como separador — es inusual en nombres de
      # archivo reales y se puede splittear en load sin ambigüedad.
      safe_name <- gsub("[/\\\\]", "_", as.character(meta$original_name %||% "file"))
      dst <- file.path(files_dir, sprintf("%s__%s", fid, safe_name))
      file.copy(meta$path, dst, overwrite = TRUE)
    }
  }

  # 2) Serializar estado (sin caches) a state.rds
  s_clean <- .pulso_strip_caches(s)
  # No persistimos estos campos transient:
  s_clean$dir <- NULL                # tempdir cambia entre sesiones
  s_clean$project_path <- NULL        # lo setea el load
  s_clean$project_dirty <- NULL
  s_clean$project_last_saved_at <- NULL
  saveRDS(s_clean, file = file.path(stage_dir, "state.rds"),
          version = 3, compress = "xz")

  # 3) Manifest JSON
  app_version <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) "dev"
  )
  n_bases <- length(s$estudio$bases %||% list())
  manifest <- list(
    format_version    = 1L,
    app_version       = app_version,
    project_name      = project_name %||% (s$estudio$nombre %||% NA_character_),
    n_bases           = n_bases,
    n_files           = length(s$files %||% list()),
    created_at        = format(s$created_at %||% Sys.time(),
                                "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    saved_at          = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  writeLines(
    jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE),
    con = file.path(stage_dir, "manifest.json"), useBytes = TRUE
  )

  # 4) Zip staging → dest_path (atomic: primero a .tmp, luego rename)
  dest_dir <- dirname(dest_path)
  if (!dir.exists(dest_dir)) dir.create(dest_dir, recursive = TRUE, showWarnings = FALSE)
  tmp_out <- paste0(dest_path, ".tmp")
  old_wd <- getwd()
  setwd(stage_dir)
  on.exit(setwd(old_wd), add = TRUE)
  tryCatch({
    entries <- list.files(".", recursive = TRUE, all.files = FALSE)
    zip::zip(tmp_out, files = entries)
  }, error = function(e) {
    unlink(tmp_out, force = TRUE)
    stop_api(500, "E_PULSO_ZIP_FAILED",
             sprintf("No se pudo crear el .pulso: %s", conditionMessage(e)))
  })
  setwd(old_wd)
  # Rename atómico
  file.rename(tmp_out, dest_path)

  # Actualizar estado en la sesión
  now_iso <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  s$project_path <- dest_path
  s$project_dirty <- FALSE
  s$project_last_saved_at <- now_iso
  .session_env[[sid]] <- s

  list(
    ok        = TRUE,
    path      = dest_path,
    size      = as.integer(file.info(dest_path)$size),
    saved_at  = now_iso
  )
}

# -----------------------------------------------------------------------------
# load_pulso — abre un .pulso y restaura la sesión
# -----------------------------------------------------------------------------
# Crea una sesión NUEVA (sid fresco + tempdir fresco), copia los files/ del
# zip al uploads/ de esa sesión, carga el state.rds con reescritura de paths,
# y setea project_path. Devuelve list(sid, project_path, manifest).
load_pulso <- function(src_path) {
  if (!file.exists(src_path)) {
    stop_api(404, "E_PULSO_NOT_FOUND",
             sprintf("No existe el archivo: %s", src_path))
  }
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop_api(500, "E_NO_ZIP", "El paquete R 'zip' no está instalado.")
  }
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop_api(500, "E_NO_JSONLITE", "El paquete R 'jsonlite' no está instalado.")
  }

  # 1) Descomprimir a staging
  stage_dir <- tempfile("pulso_load_")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage_dir, recursive = TRUE, force = TRUE), add = TRUE)

  zip::unzip(src_path, exdir = stage_dir)

  # 2) Leer manifest (tolerante — si no hay, asumimos format 1)
  manifest_path <- file.path(stage_dir, "manifest.json")
  manifest <- if (file.exists(manifest_path)) {
    tryCatch(jsonlite::fromJSON(manifest_path, simplifyVector = TRUE),
             error = function(e) list(format_version = 1L))
  } else list(format_version = 1L)

  # 3) Validar state.rds presente
  state_path <- file.path(stage_dir, "state.rds")
  if (!file.exists(state_path)) {
    stop_api(400, "E_PULSO_CORRUPT",
             "El .pulso no contiene state.rds. ¿Archivo corrupto?")
  }
  s_saved <- tryCatch(readRDS(state_path), error = function(e) {
    stop_api(400, "E_PULSO_READ_FAILED",
             sprintf("No se pudo leer state.rds: %s", conditionMessage(e)))
  })

  # 4) Crear sesión fresca (sid nuevo, tempdir propio)
  new_sid <- session_create()
  new_sess <- session_get(new_sid)
  uploads_dir <- file.path(new_sess$dir, "uploads")
  dir.create(uploads_dir, recursive = TRUE, showWarnings = FALSE)

  # 5) Copiar files/ del zip a uploads/ del nuevo sess, con path canónico
  #    <file_id>.<ext>  (para que la reescritura de paths matchee).
  zip_files_dir <- file.path(stage_dir, "files")
  if (dir.exists(zip_files_dir) && !is.null(s_saved$files)) {
    zip_entries <- list.files(zip_files_dir, full.names = TRUE)
    for (fid in names(s_saved$files)) {
      meta <- s_saved$files[[fid]]
      if (is.null(meta$ext)) next
      # Match por prefijo "<fid>__"
      matching <- zip_entries[startsWith(basename(zip_entries),
                                           paste0(fid, "__"))]
      if (length(matching) > 0L) {
        src <- matching[1]
        dst <- file.path(uploads_dir, sprintf("%s.%s", fid, meta$ext))
        file.copy(src, dst, overwrite = TRUE)
      }
    }
  }

  # 6) Reescribir paths en s_saved$files y fusionar con el sess fresco
  s_saved <- .pulso_rewrite_paths(s_saved, uploads_dir)
  s_saved$id  <- new_sid           # preservar sid nuevo
  s_saved$dir <- new_sess$dir      # preservar tempdir nuevo
  s_saved$project_path <- normalizePath(src_path, mustWork = FALSE)
  s_saved$project_dirty <- FALSE
  s_saved$project_last_saved_at <- as.character(
    manifest$saved_at %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  .session_env[[new_sid]] <- s_saved

  list(
    ok            = TRUE,
    session_id    = new_sid,
    project_path  = s_saved$project_path,
    manifest      = manifest
  )
}

# -----------------------------------------------------------------------------
# project_status — lectura ligera del estado del proyecto activo
# -----------------------------------------------------------------------------
project_status <- function(sid) {
  s <- session_get(sid, required = FALSE)
  if (is.null(s)) {
    return(list(
      has_project = FALSE,
      path = NA_character_,
      dirty = FALSE,
      last_saved_at = NA_character_
    ))
  }
  has <- !is.null(s$project_path) && nzchar(s$project_path)
  list(
    has_project   = has,
    path          = if (has) as.character(s$project_path) else NA_character_,
    name          = if (has) tools::file_path_sans_ext(basename(s$project_path))
                     else NA_character_,
    dirty         = isTRUE(s$project_dirty),
    last_saved_at = s$project_last_saved_at %||% NA_character_
  )
}

# -----------------------------------------------------------------------------
# project_close — limpia project_path sin cerrar la sesión
# -----------------------------------------------------------------------------
project_close <- function(sid) {
  s <- session_get(sid)
  s$project_path <- NULL
  s$project_dirty <- FALSE
  s$project_last_saved_at <- NULL
  .session_env[[sid]] <- s
  invisible(TRUE)
}
