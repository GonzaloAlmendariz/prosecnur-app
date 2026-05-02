# Publicacion del dashboard a Hugging Face Spaces.
#
# Flujo:
#   1. Guardar un snapshot temporal del .pulso de la sesion actual.
#   2. Armar un staging minimo con Dockerfile, api/, frontend/, launcher/
#      y data/proyecto.pulso.
#   3. Crear el Space si no existe y subir archivos por REST.

.dashboard_publish_slug <- function(x) {
  x <- tolower(iconv(as.character(x %||% ""), to = "ASCII//TRANSLIT", sub = ""))
  x <- gsub("[^a-z0-9-]+", "-", x)
  x <- gsub("^-+|-+$", "", x)
  substr(x, 1L, 64L)
}

.dashboard_publish_require_curl <- function() {
  if (!requireNamespace("curl", quietly = TRUE)) {
    stop_api(500, "E_NO_CURL", "El paquete R 'curl' no esta instalado.")
  }
}

.dashboard_publish_root <- function() {
  candidates <- unique(c(
    Sys.getenv("PULSO_APP_ROOT", unset = NA_character_),
    Sys.getenv("PULSO_REPO_ROOT", unset = NA_character_),
    getwd(),
    normalizePath(file.path(getwd(), ".."), mustWork = FALSE)
  ))
  for (root in candidates) {
    if (is.na(root) || !nzchar(root)) next
    root <- normalizePath(root, mustWork = FALSE)
    if (
      file.exists(file.path(root, "Dockerfile")) &&
      dir.exists(file.path(root, "api")) &&
      dir.exists(file.path(root, "frontend")) &&
      dir.exists(file.path(root, "launcher"))
    ) {
      return(root)
    }
  }
  stop_api(
    500,
    "E_PUBLISH_ROOT",
    "No pude ubicar la raiz del repo para armar el Space. Define PULSO_APP_ROOT."
  )
}

.dashboard_publish_copy_dir <- function(src, dst) {
  dir.create(dst, recursive = TRUE, showWarnings = FALSE)
  entries <- list.files(src, all.files = TRUE, recursive = TRUE, full.names = TRUE, no.. = TRUE)
  skip_rx <- paste(c(
    "(^|/)\\.git(/|$)",
    "(^|/)node_modules(/|$)",
    "(^|/)\\.DS_Store$",
    "(^|/)\\.env(\\..*)?$",
    "(^|/)\\.Renviron$",
    "(^|/)inst/www(/|$)",
    "(^|/)inst/samples(/|$)",     # binarios .sav/.xlsx — HF rechaza sin LFS
    "(^|/)inst/plantillas(/|$)",   # .pptx — solo se usan en exports PPT (bloqueados en modo público)
    "(^|/)inst/extdata(/|$)",      # otros binarios potenciales
    "(^|/)dist(/|$)",
    "(^|/)coverage(/|$)",
    "(^|/)\\.Rproj\\.user(/|$)",
    "\\.(pptx|xlsx|xls|sav|rds|RData|rda)$"  # cualquier binario residual
  ), collapse = "|")
  entries <- entries[!grepl(skip_rx, entries)]
  for (from in entries) {
    rel <- substring(from, nchar(src) + 2L)
    to <- file.path(dst, rel)
    if (dir.exists(from)) {
      dir.create(to, recursive = TRUE, showWarnings = FALSE)
    } else {
      dir.create(dirname(to), recursive = TRUE, showWarnings = FALSE)
      file.copy(from, to, overwrite = TRUE, copy.mode = TRUE, copy.date = TRUE)
    }
  }
}

.dashboard_publish_read_manifest <- function(pulso_path) {
  stage <- tempfile("pulso_manifest_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  zip::unzip(pulso_path, files = "manifest.json", exdir = stage)
  manifest_path <- file.path(stage, "manifest.json")
  if (!file.exists(manifest_path)) return(list())
  tryCatch(
    jsonlite::fromJSON(manifest_path, simplifyVector = TRUE),
    error = function(e) list()
  )
}

.dashboard_publish_read_template <- function(root, template_name) {
  template_path <- file.path(root, "deploy", template_name)
  if (!file.exists(template_path)) return("")
  paste(readLines(template_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

.dashboard_publish_render_readme <- function(root, repo_id, space_name, project_name) {
  tpl <- .dashboard_publish_read_template(root, "hf-space-README.md.template")
  if (!nzchar(tpl)) {
    tpl <- paste(
      "---",
      "title: {{SPACE_NAME}}",
      "sdk: docker",
      "emoji: chart_with_upwards_trend",
      "pinned: false",
      "---",
      "",
      "# {{PROJECT_NAME}}",
      "",
      "Dashboard publico generado desde Prosecnur.",
      sep = "\n"
    )
  }
  now <- format(Sys.time(), "%Y-%m-%d %H:%M:%S %Z")
  app_version <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) "dev"
  )
  replacements <- list(
    TITLE = space_name,
    SPACE_NAME = space_name,
    REPO_ID = repo_id,
    PROJECT_NAME = project_name %||% space_name,
    UPDATED_AT = now,
    UPDATED_DATE = format(Sys.Date(), "%Y-%m-%d"),
    PUBLISHED_AT = now,
    APP_VERSION = app_version
  )
  out <- tpl
  for (key in names(replacements)) {
    out <- gsub(paste0("\\{\\{", key, "\\}\\}"), as.character(replacements[[key]]), out)
  }
  out
}

.dashboard_publish_snapshot <- function(sid, project_name) {
  s <- session_get(sid)
  old <- list(
    project_path = s$project_path,
    project_dirty = s$project_dirty,
    project_last_saved_at = s$project_last_saved_at
  )
  restore_project <- function() {
    cur <- session_get(sid, required = FALSE)
    if (is.null(cur)) return(invisible(NULL))
    cur$project_path <- old$project_path
    cur$project_dirty <- old$project_dirty
    cur$project_last_saved_at <- old$project_last_saved_at
    .session_env[[sid]] <- cur
    invisible(NULL)
  }
  on.exit(restore_project(), add = TRUE)
  tmp <- tempfile("proyecto_", fileext = ".pulso")
  result <- build_pulso(sid, tmp, project_name = project_name)
  list(path = tmp, size = result$size)
}

.dashboard_publish_prepare_space <- function(sid, repo_id, space_name) {
  root <- .dashboard_publish_root()
  s <- session_get(sid)
  cfg <- .dashboard_config_with_defaults(s$dashboard_config)
  project_name <- cfg$titulo %||% s$estudio$nombre %||% space_name
  snap <- .dashboard_publish_snapshot(sid, project_name)
  manifest <- .dashboard_publish_read_manifest(snap$path)
  if (!is.null(manifest$project_name) && nzchar(as.character(manifest$project_name))) {
    project_name <- as.character(manifest$project_name)
  }

  stage <- tempfile("hf_space_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  dir.create(file.path(stage, "data"), recursive = TRUE, showWarnings = FALSE)

  for (file in c("Dockerfile", ".dockerignore")) {
    src <- file.path(root, file)
    if (file.exists(src)) file.copy(src, file.path(stage, file), overwrite = TRUE)
  }
  .dashboard_publish_copy_dir(file.path(root, "api"), file.path(stage, "api"))
  .dashboard_publish_copy_dir(file.path(root, "frontend"), file.path(stage, "frontend"))
  .dashboard_publish_copy_dir(file.path(root, "launcher"), file.path(stage, "launcher"))
  # NOTA: tsconfig.json vive dentro de frontend/, ya viene en el copy
  # de arriba. No hay tsconfig en raíz.
  file.copy(snap$path, file.path(stage, "data", "proyecto.pulso"), overwrite = TRUE)
  writeLines(
    .dashboard_publish_render_readme(root, repo_id, space_name, project_name),
    file.path(stage, "README.md"),
    useBytes = TRUE
  )

  files <- list.files(stage, recursive = TRUE, full.names = TRUE, all.files = TRUE, no.. = TRUE)
  files <- files[file.exists(files) & !dir.exists(files)]
  rel <- substring(files, nchar(stage) + 2L)
  list(stage = stage, files = files, rel = rel, project_size = snap$size)
}

.hf_headers <- function(token, content_type = NULL) {
  headers <- c(Authorization = paste("Bearer", token))
  if (!is.null(content_type)) headers <- c(headers, "Content-Type" = content_type)
  headers
}

.hf_fail <- function(res, code, default_message) {
  body <- rawToChar(res$content %||% raw())
  msg <- default_message
  if (nzchar(body)) {
    parsed <- tryCatch(jsonlite::fromJSON(body), error = function(e) NULL)
    if (!is.null(parsed$error)) msg <- as.character(parsed$error)[1]
    else msg <- body
  }
  stop_api(res$status_code %||% 502L, code, msg)
}

.hf_create_space <- function(repo_id, token, private = FALSE) {
  .dashboard_publish_require_curl()
  parts <- strsplit(repo_id, "/", fixed = TRUE)[[1]]
  namespace <- parts[1]
  name <- parts[2]
  h <- curl::new_handle()
  do.call(curl::handle_setheaders, c(list(handle = h), as.list(.hf_headers(token, "application/json"))))
  body <- jsonlite::toJSON(
    list(
      name = name,
      organization = namespace,
      type = "space",
      sdk = "docker",
      private = isTRUE(private),
      existOk = TRUE
    ),
    auto_unbox = TRUE
  )
  curl::handle_setopt(h, post = TRUE, postfields = charToRaw(body))
  res <- curl::curl_fetch_memory("https://huggingface.co/api/repos/create", handle = h)
  if (res$status_code >= 200L && res$status_code < 300L) return(invisible(TRUE))
  if (res$status_code == 409L) return(invisible(TRUE))
  .hf_fail(res, "E_HF_CREATE_FAILED", "No se pudo crear el Space en Hugging Face.")
}

.git_bin <- function() {
  git <- Sys.which("git")
  if (!nzchar(git)) {
    stop_api(500, "E_NO_GIT", "No encontre git instalado. Hugging Face Spaces se publican con git push.")
  }
  git
}

.git_run <- function(args, cwd, env = character(), code = "E_GIT_FAILED") {
  git <- .git_bin()
  out <- tempfile("git_stdout_")
  err <- tempfile("git_stderr_")
  on.exit(unlink(c(out, err), force = TRUE), add = TRUE)
  # `system2()` no tiene parámetro `wd`/`cwd`; el cwd se cambia con setwd
  # y se restaura al salir.
  prev_wd <- getwd()
  setwd(cwd)
  on.exit(setwd(prev_wd), add = TRUE)
  # `system2()` une los args con espacios y los pasa al shell; sin
  # shQuote, args con espacios (mensaje del commit, etc.) se parten
  # incorrectamente. Escapamos cada arg por separado.
  status <- system2(
    git,
    args = vapply(args, shQuote, character(1)),
    stdout = out,
    stderr = err,
    env = env,
    wait = TRUE
  )
  if (!identical(status, 0L)) {
    msg <- paste(
      c(readLines(err, warn = FALSE), readLines(out, warn = FALSE)),
      collapse = "\n"
    )
    msg <- gsub("hf_[A-Za-z0-9_]+", "hf_***", msg)
    stop_api(502, code, if (nzchar(msg)) msg else "git fallo sin mensaje.")
  }
  invisible(TRUE)
}

.hf_write_askpass <- function(stage, token) {
  askpass <- file.path(stage, ".hf-askpass.sh")
  lines <- c(
    "#!/bin/sh",
    "case \"$1\" in",
    "  *Username*) printf '%s\\n' 'hf_user' ;;",
    sprintf("  *) printf '%%s\\n' '%s' ;;", gsub("'", "'\"'\"'", token, fixed = TRUE)),
    "esac"
  )
  writeLines(lines, askpass, useBytes = TRUE)
  Sys.chmod(askpass, mode = "0700")
  askpass
}

.hf_check_lfs <- function() {
  # HF Spaces rechaza CUALQUIER binario sin LFS/Xet, sin importar el
  # tamaño. `git lfs` debe estar instalado en el sistema.
  out <- tempfile("lfs_check_")
  on.exit(unlink(out, force = TRUE), add = TRUE)
  status <- suppressWarnings(system2(.git_bin(), c("lfs", "version"),
                                     stdout = out, stderr = out))
  if (!identical(status, 0L)) {
    stop_api(
      500,
      "E_NO_GIT_LFS",
      "Git LFS no está instalado. En macOS: 'brew install git-lfs'. ",
      "En Linux: paquete 'git-lfs' del distro."
    )
  }
  invisible(TRUE)
}

.hf_push_space_git <- function(prepared, repo_id, token) {
  .hf_check_lfs()
  askpass <- .hf_write_askpass(prepared$stage, token)
  on.exit(unlink(askpass, force = TRUE), add = TRUE)
  env <- c(
    sprintf("GIT_ASKPASS=%s", askpass),
    "GIT_TERMINAL_PROMPT=0"
  )
  remote <- sprintf("https://huggingface.co/spaces/%s", repo_id)
  .git_run(c("init", "-b", "main"), prepared$stage)
  writeLines(".hf-askpass.sh", file.path(prepared$stage, ".gitignore"), useBytes = TRUE)
  # LFS: trackeamos los binarios que sí necesitamos subir (data/*.pulso)
  # y por las dudas otros binarios que pudieran colarse (pptx/xlsx/sav).
  # `git lfs install --local` instala los hooks en este repo solo.
  .git_run(c("lfs", "install", "--local"), prepared$stage)
  .git_run(c("lfs", "track", "data/*.pulso"), prepared$stage)
  .git_run(c("lfs", "track", "*.pptx"), prepared$stage)
  .git_run(c("lfs", "track", "*.xlsx"), prepared$stage)
  .git_run(c("lfs", "track", "*.sav"), prepared$stage)
  .git_run(c("add", ".gitattributes"), prepared$stage)
  .git_run(c("add", "-A"), prepared$stage)
  .git_run(c("-c", "user.name=Prosecnur", "-c", "user.email=deploy@prosecnur.local",
             "commit", "-m", "Deploy dashboard"), prepared$stage)
  .git_run(c("remote", "add", "origin", remote), prepared$stage)
  .git_run(c("push", "--force", "origin", "main"), prepared$stage, env = env, code = "E_HF_PUSH_FAILED")
  invisible(TRUE)
}

dashboard_publish_space <- function(sid, hf_username, hf_token, space_name, private = FALSE) {
  if (is_public_mode()) {
    stop_api(403, "E_PUBLIC_MODE", "Publicar esta deshabilitado en modo publico.")
  }
  hf_username <- as.character(hf_username %||% "")[1]
  hf_token <- as.character(hf_token %||% "")[1]
  space_name <- .dashboard_publish_slug(space_name)

  if (!grepl("^[A-Za-z0-9][A-Za-z0-9_.-]{1,95}$", hf_username)) {
    stop_api(400, "E_BAD_HF_USERNAME", "Usuario u organizacion HF invalido.")
  }
  if (!grepl("^hf_[A-Za-z0-9_]+$", hf_token)) {
    stop_api(400, "E_BAD_HF_TOKEN", "Token HF invalido. Debe empezar con hf_.")
  }
  if (!grepl("^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$", space_name)) {
    stop_api(400, "E_BAD_SPACE_NAME", "Nombre de Space invalido.")
  }

  repo_id <- paste(hf_username, space_name, sep = "/")
  prepared <- .dashboard_publish_prepare_space(sid, repo_id, space_name)
  on.exit(unlink(prepared$stage, recursive = TRUE, force = TRUE), add = TRUE)

  .hf_create_space(repo_id, hf_token, private = private)

  uploaded <- list()
  total <- 0
  .hf_push_space_git(prepared, repo_id, hf_token)
  for (i in seq_along(prepared$rel)) {
    rel <- prepared$rel[[i]]
    path <- prepared$files[[i]]
    size <- as.integer(file.info(path)$size)
    total <- total + size
    uploaded[[length(uploaded) + 1L]] <- list(path = rel, size = size)
  }

  app_slug <- tolower(paste(gsub("[^A-Za-z0-9]+", "-", hf_username), space_name, sep = "-"))
  url <- sprintf("https://huggingface.co/spaces/%s", repo_id)
  app_url <- sprintf("https://%s.hf.space", app_slug)
  published_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

  # Persistir el último deploy en la sesión → llega al frontend en el
  # próximo /api/dashboard/config y permite mostrar "Última publicación"
  # en el botón Deploy + pre-llenar el modal con el space_name actual.
  s <- session_get(sid)
  s$dashboard_config$last_deploy <- list(
    repo_id = repo_id,
    space_name = space_name,
    hf_username = hf_username,
    url = url,
    app_url = app_url,
    published_at = published_at,
    private = isTRUE(private)
  )
  s$project_dirty <- TRUE
  .session_env[[sid]] <- s

  list(
    ok = TRUE,
    repo_id = repo_id,
    space_name = space_name,
    url = url,
    app_url = app_url,
    published_at = published_at,
    files_uploaded = length(uploaded),
    total_bytes = total,
    project_size = prepared$project_size,
    uploaded = uploaded
  )
}
