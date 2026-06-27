# =============================================================================
# Router HTTP para archivos de proyecto .pulso
# =============================================================================
# Expone los endpoints que el frontend usa para:
#   - Guardar el estado actual a un .pulso (save / save-as).
#   - Abrir un .pulso existente (open).
#   - Consultar estado del proyecto activo (status).
#   - Cerrar el proyecto sin cerrar la sesión (close).
#   - Copiar entregables del file store al directorio del .pulso con un
#     nombre limpio elegido por el analista (save-to-project).
#
# Las APIs reciben paths absolutos del Electron (vía dialog.showSaveDialog/
# showOpenDialog desde preload). Si la app corre en navegador puro, los
# endpoints siguen funcionando si el cliente envía paths válidos.

mount_proyecto <- function(pr) {
  pr |>
    plumber::pr_post("/api/project/save", wrap_endpoint(function(req, res, path = NULL, project_name = NULL, allow_empty_overwrite = FALSE, ...) {
      sid <- session_header(req)
      # Plumber matchea keys del body JSON contra los args de la función,
      # pero también permite leer el body crudo. Aceptamos ambas formas
      # (la function args llega cuando el JSON es plano; el body crudo es
      # fallback si el cliente manda algo raro).
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = TRUE),
                 error = function(e) list())
      } else list()

      s <- session_get(sid)
      requested_path <- as.character(path %||% body$path %||% NA_character_)
      if (is.na(requested_path) || !nzchar(requested_path)) {
        # Sin path en el body: usar el project_path actual (save = save in place).
        if (is.null(s$project_path) || !nzchar(s$project_path)) {
          stop_api(400, "E_NO_PATH",
                   "Pasa 'path' en el body o abre un proyecto antes de guardar.")
        }
        requested_path <- s$project_path
      }

      # Forzamos extensión .pulso si vino sin extensión (típico cuando el
      # user escribe "MiProyecto" en el dialog y el filter de Electron no
      # la agregó automáticamente — depende del SO).
      if (!grepl("\\.pulso$", requested_path, ignore.case = TRUE)) {
        requested_path <- paste0(requested_path, ".pulso")
      }

      proj_name <- as.character(project_name %||% body$project_name %||% NA_character_)
      if (is.na(proj_name) || !nzchar(proj_name)) {
        proj_name <- tools::file_path_sans_ext(basename(requested_path))
      }

      allow_empty <- isTRUE(allow_empty_overwrite) || isTRUE(body$allow_empty_overwrite)
      build_pulso(sid, requested_path, project_name = proj_name, allow_empty_overwrite = allow_empty)
    })) |>
    plumber::pr_post("/api/project/duplicate", wrap_endpoint(function(req, res, source_path = NULL, target_path = NULL, project_name = NULL, open_copy = TRUE, overwrite = FALSE, ...) {
      current_sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = TRUE),
                 error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
      } else list()

      requested_target <- as.character(target_path %||% body$target_path %||% body$targetPath %||% body$path %||% NA_character_)
      if (is.na(requested_target) || !nzchar(requested_target)) {
        stop_api(400, "E_NO_TARGET_PATH", "Pasa 'target_path' en el body con la ruta de la copia .pulso.")
      }
      if (!grepl("\\.pulso$", requested_target, ignore.case = TRUE)) {
        requested_target <- paste0(requested_target, ".pulso")
      }

      requested_source <- as.character(source_path %||% body$source_path %||% body$sourcePath %||% NA_character_)
      if (is.na(requested_source) || !nzchar(requested_source)) requested_source <- NA_character_
      if (!is.na(requested_source) && !file.exists(requested_source)) {
        stop_api(404, "E_SOURCE_NOT_FOUND", sprintf("No existe el proyecto origen: %s", requested_source))
      }

      if (!is.na(requested_source) &&
          identical(normalizePath(requested_source, mustWork = FALSE), normalizePath(requested_target, mustWork = FALSE))) {
        stop_api(400, "E_DUPLICATE_SAME_PATH", "La copia debe guardarse en una ruta distinta al origen.")
      }

      should_overwrite <- isTRUE(overwrite) || isTRUE(body$overwrite)
      if (file.exists(requested_target) && !should_overwrite) {
        stop_api(409, "E_TARGET_EXISTS", sprintf("Ya existe '%s'. Pasa overwrite=true para reemplazarlo.", requested_target))
      }
      if (file.exists(requested_target) && should_overwrite) {
        unlink(requested_target, force = TRUE)
      }

      proj_name <- as.character(project_name %||% body$project_name %||% body$projectName %||% NA_character_)
      if (is.na(proj_name) || !nzchar(proj_name)) {
        proj_name <- tools::file_path_sans_ext(basename(requested_target))
      }

      open_target <- isTRUE(open_copy) && !isFALSE(body$open_copy) && !isFALSE(body$openCopy)
      sid_to_save <- current_sid
      source_for_response <- requested_source
      if (!is.na(requested_source)) {
        loaded <- load_pulso(requested_source)
        sid_to_save <- loaded$session_id
        source_for_response <- normalizePath(requested_source, mustWork = FALSE)
      } else {
        s_current <- session_get(current_sid)
        source_for_response <- as.character(s_current$project_path %||% "")
      }

      result <- build_pulso(
        sid_to_save,
        requested_target,
        project_name = proj_name,
        allow_empty_overwrite = TRUE
      )

      session_id_out <- sid_to_save
      if (isTRUE(open_target) && !is.null(current_sid) && nzchar(current_sid)) {
        if (!identical(sid_to_save, current_sid)) {
          loaded_copy <- session_get(sid_to_save, required = FALSE)
          if (!is.null(loaded_copy)) {
            loaded_copy$id <- current_sid
            .session_env[[current_sid]] <- loaded_copy
            if (exists(sid_to_save, envir = .session_env, inherits = FALSE)) {
              rm(list = sid_to_save, envir = .session_env)
            }
          }
        }
        session_id_out <- current_sid
        res$setHeader("X-Pulso-Session", current_sid)
      } else if (!is.null(session_id_out) && nzchar(session_id_out)) {
        res$setHeader("X-Pulso-Session", session_id_out)
      }

      c(result, list(
        duplicated = TRUE,
        source_path = source_for_response,
        target_path = result$path,
        project_name = proj_name,
        opened = isTRUE(open_target),
        session_id = session_id_out
      ))
    })) |>
    plumber::pr_post("/api/project/open", wrap_endpoint(function(req, res, path = NULL, ...) {
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = TRUE),
                 error = function(e) list())
      } else list()
      src_path <- as.character(path %||% body$path %||% NA_character_)
      if (is.na(src_path) || !nzchar(src_path)) {
        stop_api(400, "E_NO_PATH", "Pasa 'path' en el body con la ruta al .pulso a abrir.")
      }
      result <- load_pulso(src_path)
      in_place <- isTRUE(body$in_place) || isTRUE(body$replace_current) || isTRUE(body$into_current)
      current_sid <- session_header(req)
      if (isTRUE(in_place) && !is.null(current_sid) && nzchar(current_sid)) {
        loaded <- session_get(result$session_id, required = FALSE)
        if (!is.null(loaded)) {
          loaded$id <- current_sid
          .session_env[[current_sid]] <- loaded
          result$session_id <- current_sid
          result$project_path <- loaded$project_path
        }
      }
      # Como load_pulso crea una sesión NUEVA con sid distinto, devolvemos
      # el sid en el header X-Pulso-Session para que el frontend (client.ts
      # `handle()`) lo capture y actualice localStorage.
      res$setHeader("X-Pulso-Session", result$session_id)
      result
    })) |>
    plumber::pr_post("/api/project/warmup", wrap_endpoint(function(req, res, mode = NULL, budget_ms = NULL, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = TRUE),
                 error = function(e) list())
      } else list()
      .project_warmup_start(
        sid = sid,
        mode = mode %||% body$mode %||% "full",
        budget_ms = budget_ms %||% body$budget_ms %||% body$budgetMs %||% .project_warmup_default_budget_ms,
        modules = body$modules %||% body$module_ids %||% body$moduleIds %||% NULL
      )
    })) |>
    plumber::pr_get("/api/project/warmup-plan", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .project_warmup_plan(sid)
    })) |>
    plumber::pr_post("/api/project/close", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      project_close(sid)
      list(ok = TRUE)
    })) |>
    plumber::pr_get("/api/project/status", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      project_status(sid)
    })) |>
    plumber::pr_post("/api/fs/save-to-project", wrap_endpoint(function(req, res, file_id = NULL, filename = NULL, subdir = NULL, overwrite = FALSE, ...) {
      # Copia un archivo del file store (sess$dir/uploads o downloads) al
      # directorio del .pulso activo, con el nombre que el user eligió en
      # el FilenameInput. Si el user pasa filename con extensión, se usa
      # tal cual; si no, se infiere de meta$ext.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = TRUE),
                 error = function(e) list())
      } else list()

      file_id <- as.character(file_id %||% body$file_id %||% NA_character_)
      filename <- as.character(filename %||% body$filename %||% NA_character_)
      subdir <- as.character(subdir %||% body$subdir %||% NA_character_)
      overwrite <- isTRUE(overwrite %||% body$overwrite %||% FALSE)

      if (is.na(file_id) || !nzchar(file_id)) {
        stop_api(400, "E_NO_FILE_ID", "Falta 'file_id' en el body.")
      }
      if (is.na(filename) || !nzchar(filename)) {
        stop_api(400, "E_NO_FILENAME", "Falta 'filename' en el body.")
      }

      # Validación del nombre — espejo del FilenameInput del frontend.
      # Permitimos letras, dígitos, guion, underscore, punto (para extensión).
      # Rechazamos paths (slashes), espacios, y caracteres exóticos.
      if (!grepl("^[A-Za-z0-9_.\\-]{1,80}$", filename)) {
        stop_api(400, "E_INVALID_FILENAME",
                 "El nombre del archivo debe contener solo letras, dígitos, guion, underscore y punto. Sin espacios ni paths.")
      }

      s <- session_get(sid)
      if (is.null(s$project_path) || !nzchar(s$project_path)) {
        stop_api(409, "E_NO_PROJECT",
                 "No hay un proyecto .pulso abierto. Usa /api/project/open primero, o descarga el archivo en modo efímero.")
      }
      meta <- s$files[[file_id]]
      if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
        stop_api(404, "E_FILE_NOT_FOUND",
                 sprintf("El file_id %s no está disponible en disco.", file_id))
      }

      # Si filename no trae extensión, la inferimos del meta.
      has_ext <- grepl("\\.", filename, fixed = TRUE)
      final_name <- if (has_ext) filename else paste0(filename, ".", meta$ext)

      project_dir <- dirname(s$project_path)
      target_dir <- if (!is.na(subdir) && nzchar(subdir)) {
        # Validar subdir: solo nombre simple (sin paths anidados).
        if (!grepl("^[A-Za-z0-9_\\-]{1,40}$", subdir)) {
          stop_api(400, "E_INVALID_SUBDIR",
                   "Subdir solo puede contener letras, dígitos, guion y underscore.")
        }
        file.path(project_dir, subdir)
      } else {
        project_dir
      }
      if (!dir.exists(target_dir)) {
        dir.create(target_dir, recursive = TRUE, showWarnings = FALSE)
      }
      target_path <- file.path(target_dir, final_name)

      if (file.exists(target_path) && !overwrite) {
        stop_api(409, "E_FILE_EXISTS",
                 sprintf("Ya existe '%s' en el proyecto. Pasa overwrite=true para sobrescribir.",
                          final_name))
      }

      ok <- file.copy(meta$path, target_path, overwrite = overwrite)
      if (!isTRUE(ok)) {
        stop_api(500, "E_COPY_FAILED",
                 sprintf("No se pudo copiar a %s.", target_path))
      }
      size <- as.integer(file.info(target_path)$size)
      list(
        ok          = TRUE,
        path        = target_path,
        filename    = final_name,
        size        = size
      )
    })) |>
    plumber::pr_post("/api/fs/save-file-as", wrap_endpoint(function(req, res, file_id = NULL, path = NULL, overwrite = TRUE, ...) {
      # Copia un archivo del file store a un path absoluto elegido por el
      # dialog nativo de Electron. Es el flujo "Generar -> Guardar..." para
      # evitar que el usuario tenga que cazar un link de descarga inline.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      body <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = TRUE),
                 error = function(e) list())
      } else list()

      file_id <- as.character(file_id %||% body$file_id %||% NA_character_)
      target_path <- as.character(path %||% body$path %||% NA_character_)
      overwrite <- isTRUE(overwrite %||% body$overwrite %||% TRUE)

      if (is.na(file_id) || !nzchar(file_id)) {
        stop_api(400, "E_NO_FILE_ID", "Falta 'file_id' en el body.")
      }
      if (is.na(target_path) || !nzchar(target_path)) {
        stop_api(400, "E_NO_PATH", "Falta 'path' en el body.")
      }
      if (!grepl("^(/|[A-Za-z]:[\\\\/])", target_path)) {
        stop_api(400, "E_INVALID_PATH", "El path debe ser absoluto.")
      }

      s <- session_get(sid)
      meta <- s$files[[file_id]]
      if (is.null(meta) || is.null(meta$path) || !file.exists(meta$path)) {
        stop_api(404, "E_FILE_NOT_FOUND",
                 sprintf("El file_id %s no está disponible en disco.", file_id))
      }
      if (!nzchar(tools::file_ext(target_path)) && !is.null(meta$ext) && nzchar(meta$ext)) {
        target_path <- paste0(target_path, ".", meta$ext)
      }
      if (!dir.exists(dirname(target_path))) {
        dir.create(dirname(target_path), recursive = TRUE, showWarnings = FALSE)
      }
      if (file.exists(target_path) && !overwrite) {
        stop_api(409, "E_FILE_EXISTS",
                 sprintf("Ya existe '%s'.", basename(target_path)))
      }
      ok <- file.copy(meta$path, target_path, overwrite = overwrite)
      if (!isTRUE(ok)) {
        stop_api(500, "E_COPY_FAILED",
                 sprintf("No se pudo copiar a %s.", target_path))
      }
      list(
        ok = TRUE,
        path = target_path,
        filename = basename(target_path),
        size = as.integer(file.info(target_path)$size)
      )
    })) |>
    plumber::pr_get("/api/fs/list-project-dir", wrap_endpoint(function(req, res) {
      # Lista archivos en el directorio del .pulso activo (para que el
      # FilenameInput pueda detectar colisiones antes de permitir guardar).
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(s$project_path) || !nzchar(s$project_path)) {
        return(list(ok = TRUE, files = list()))
      }
      project_dir <- dirname(s$project_path)
      if (!dir.exists(project_dir)) return(list(ok = TRUE, files = list()))
      entries <- list.files(project_dir, full.names = FALSE,
                             include.dirs = FALSE, no.. = TRUE)
      # Filtra el .pulso mismo y archivos ocultos.
      entries <- entries[!startsWith(entries, ".")]
      entries <- entries[entries != basename(s$project_path)]
      list(ok = TRUE, project_dir = project_dir, files = as.list(entries))
    }))
}
