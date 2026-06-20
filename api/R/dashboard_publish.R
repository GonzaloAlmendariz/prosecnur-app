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
    "(^|/)inst/audit_reference(/|$)", # fixtures/test data — no runtime público
    "(^|/)inst/hojas_ruta(/|$)",      # cartografia/binarios — endpoints bloqueados en modo público
    "(^|/)inst/manuales_qmd(/|$)",    # documentacion fuente, no requerida por el Space
    "(^|/)inst/www(/|$)",             # bundle local viejo; Docker lo recompila
    "(^|/)inst/samples(/|$)",     # binarios .sav/.xlsx — HF rechaza sin LFS
    "(^|/)inst/plantillas(/|$)",   # .pptx — solo se usan en exports PPT (bloqueados en modo público)
    "(^|/)inst/extdata(/|$)",      # otros binarios potenciales
    "(^|/)tests(/|$)",
    "(^|/)dist(/|$)",
    "(^|/)coverage(/|$)",
    "(^|/)\\.Rproj\\.user(/|$)",
    "\\.(pptx|xlsx|xls|sav|rds|RData|rda|pulso|gz|zip|pdf)$"  # cualquier binario residual
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

.dashboard_publish_copy_public_runtime <- function(root, stage, artifact = NULL) {
  runtime_root <- file.path(root, "deploy", "public-runtime")
  if (!dir.exists(runtime_root)) {
    stop_api(500, "E_PUBLIC_RUNTIME", "No encontre deploy/public-runtime para armar el Space publico.")
  }
  dockerfile <- file.path(runtime_root, "Dockerfile")
  if (!file.exists(dockerfile)) {
    stop_api(500, "E_PUBLIC_RUNTIME", "Falta deploy/public-runtime/Dockerfile.")
  }
  file.copy(dockerfile, file.path(stage, "Dockerfile"), overwrite = TRUE)
  .dashboard_publish_copy_dir(file.path(runtime_root, "api"), file.path(stage, "api"))
  .dashboard_publish_copy_dir(file.path(runtime_root, "launcher"), file.path(stage, "launcher"))
  www <- file.path(stage, "api", "inst", "www")
  dir.create(www, recursive = TRUE, showWarnings = FALSE)
  index <- file.path(root, "deploy", "monitoreo-public-index.html")
  if (!file.exists(index)) {
    stop_api(500, "E_PUBLIC_RUNTIME", "Falta deploy/monitoreo-public-index.html.")
  }
  file.copy(index, file.path(www, "index.html"), overwrite = TRUE)
  invisible(TRUE)
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

.public_artifact_scalar <- function(x, default = "") {
  value <- as.character(x %||% default)[1]
  if (is.na(value) || !nzchar(value)) default else value
}

.public_artifact_normalize <- function(artifact = NULL, fallback_title = "") {
  artifact <- artifact %||% list()
  kind <- .public_artifact_scalar(artifact$kind, "dashboard")
  if (!kind %in% c("dashboard", "monitoreo")) kind <- "dashboard"
  audience <- .public_artifact_scalar(artifact$audience, if (identical(kind, "monitoreo")) "client" else "")
  if (identical(kind, "monitoreo") && !audience %in% c("client", "internal")) audience <- "client"
  public_scope <- .public_artifact_scalar(
    artifact$public_scope,
    if (identical(kind, "monitoreo")) "aggregate" else "dashboard"
  )
  title <- .public_artifact_scalar(artifact$title, fallback_title %||% "")
  list(
    kind = kind,
    title = title,
    module = .public_artifact_scalar(artifact$module, if (identical(kind, "monitoreo")) "monitoreo" else "dashboard"),
    public_scope = public_scope,
    audience = audience,
    profile_family = .public_artifact_scalar(artifact$profile_family, ""),
    publication_family = .public_artifact_scalar(artifact$publication_family, artifact$monitoring_family %||% ""),
    monitoring_family = .public_artifact_scalar(artifact$monitoring_family, artifact$publication_family %||% artifact$profile_family %||% ""),
    destination = .public_artifact_scalar(artifact$destination, if (identical(kind, "monitoreo")) "google_sheets" else ""),
    source = .public_artifact_scalar(artifact$source, if (identical(kind, "monitoreo")) "publication_model" else ""),
    namespace = .public_artifact_scalar(artifact$namespace, ""),
    space_name = .public_artifact_scalar(artifact$space_name, ""),
    repo_id = .public_artifact_scalar(artifact$repo_id, ""),
    app_url = .public_artifact_scalar(artifact$app_url, ""),
    space_url = .public_artifact_scalar(
      artifact$space_url,
      artifact$url %||% if (nzchar(.public_artifact_scalar(artifact$repo_id, ""))) {
        sprintf("https://huggingface.co/spaces/%s", .public_artifact_scalar(artifact$repo_id, ""))
      } else {
        artifact$app_url %||% ""
      }
    ),
    sheet_url = .public_artifact_scalar(artifact$sheet_url, ""),
    last_used_at = .public_artifact_scalar(artifact$last_used_at, artifact$published_at %||% ""),
    publication_sections = artifact$publication_sections %||% list(),
    report_scope = .public_artifact_scalar(artifact$report_scope, ""),
    published_at = .public_artifact_scalar(artifact$published_at, "")
  )
}

.public_artifact_sections_from_model <- function(model = NULL) {
  if (is.null(model) || !is.list(model)) return(list())
  section_names <- names(model)[vapply(model, function(value) {
    is.list(value) && nzchar(.public_artifact_scalar(value$id, ""))
  }, logical(1))]
  lapply(section_names, function(id) {
    section <- model[[id]]
    list(
      id = .public_artifact_scalar(section$id, id),
      title = .public_artifact_scalar(section$title, id),
      n_rows = as.integer(section$n_rows %||% length(section$rows %||% list()))
    )
  })
}

.dashboard_publish_artifact_sdk <- function(artifact = NULL) {
  artifact <- .public_artifact_normalize(artifact)
  "docker"
}

.dashboard_publish_render_readme <- function(root, repo_id, space_name, project_name, artifact = NULL) {
  artifact <- .public_artifact_normalize(artifact, project_name %||% space_name)
  sdk <- .dashboard_publish_artifact_sdk(artifact)
  tpl <- .dashboard_publish_read_template(root, "hf-space-README.md.template")
  if (!nzchar(tpl)) {
    tpl <- paste(
      "---",
      "title: {{SPACE_NAME}}",
      "sdk: {{SDK}}",
      "{{APP_PORT_LINE}}",
      "emoji: chart_with_upwards_trend",
      "pinned: false",
      "---",
      "",
      "# {{PROJECT_NAME}}",
      "",
      "{{ARTIFACT_LABEL}} publico generado desde Prosecnur.",
      sep = "\n"
    )
  }
  runtime_note <- if (identical(sdk, "static")) {
    paste(
      "> Este Space sirve un artefacto estático generado desde Prosecnur.",
      "> No ejecuta backend, no sincroniza fuentes y no consume cuota de hardware del Space.",
      "> La edición, sincronización y republicación se hacen desde la app local de Prosecnur.",
      sep = "\n"
    )
  } else {
    paste(
      "> Este Space corre la API REST en R (Plumber) detrás del frontend React.",
      "> Solo expone endpoints read-only del artefacto publicado. La edición,",
      "> sincronización y republicación se hacen desde la app local de Prosecnur.",
      sep = "\n"
    )
  }
  now <- format(Sys.time(), "%Y-%m-%d %H:%M:%S %Z")
  app_version <- tryCatch(
    as.character(utils::packageVersion("prosecnurapp")),
    error = function(e) "dev"
  )
  artifact_label <- if (identical(artifact$kind, "monitoreo")) {
    family <- .public_artifact_scalar(artifact$publication_family, artifact$monitoring_family %||% artifact$profile_family %||% "")
    if (identical(artifact$audience, "internal")) {
      "Monitoreo operativo interno"
    } else if (identical(family, "territorial_fieldwork") || identical(artifact$profile_family, "territorial")) {
      "Reporte de avance territorial"
    } else {
      "Reporte de avance para cliente"
    }
  } else {
    "Dashboard"
  }
  replacements <- list(
    TITLE = space_name,
    SDK = sdk,
    APP_PORT_LINE = if (identical(sdk, "docker")) "app_port: 7860" else "",
    SPACE_NAME = space_name,
    REPO_ID = repo_id,
    PROJECT_NAME = project_name %||% space_name,
    ARTIFACT_KIND = artifact$kind,
    ARTIFACT_LABEL = artifact_label,
    PUBLIC_SCOPE = artifact$public_scope,
    REPORT_SCOPE = artifact$report_scope,
    PROFILE_FAMILY = artifact$profile_family,
    SHORT_DESCRIPTION = if (identical(artifact$kind, "monitoreo")) {
      "Reporte publico de avance generado con Prosecnur"
    } else {
      "Dashboard interactivo generado con Prosecnur"
    },
    UPDATED_AT = now,
    UPDATED_DATE = format(Sys.Date(), "%Y-%m-%d"),
    PUBLISHED_AT = now,
    APP_VERSION = app_version,
    RUNTIME_NOTE = runtime_note
  )
  out <- tpl
  for (key in names(replacements)) {
    out <- gsub(paste0("\\{\\{", key, "\\}\\}"), as.character(replacements[[key]]), out)
  }
  out
}

.dashboard_publish_snapshot <- function(sid, project_name, public_artifact = NULL, public_payload = NULL) {
  s <- session_get(sid)
  original_session <- s
  restore_project <- function() {
    cur <- session_get(sid, required = FALSE)
    if (is.null(cur)) return(invisible(NULL))
    .session_env[[sid]] <- original_session
    invisible(NULL)
  }
  on.exit(restore_project(), add = TRUE)
  if (!is.null(public_artifact)) {
    artifact <- .public_artifact_normalize(public_artifact, project_name %||% "")
    if (identical(artifact$kind, "monitoreo") && !is.null(public_payload)) {
      s <- list(
        id = s$id,
        created_at = s$created_at %||% Sys.time(),
        dir = s$dir,
        files = list(),
        estudio = list(nombre = project_name %||% artifact$title %||% "Reporte de avance", bases = list()),
        project_path = s$project_path,
        project_dirty = s$project_dirty,
        project_last_saved_at = s$project_last_saved_at,
        public_artifact = artifact,
        public_artifact_payload = public_payload
      )
    } else {
      s$public_artifact <- artifact
      if (!is.null(public_payload)) s$public_artifact_payload <- public_payload
    }
    .session_env[[sid]] <- s
  }
  tmp <- tempfile("proyecto_", fileext = ".pulso")
  result <- build_pulso(sid, tmp, project_name = project_name)
  list(path = tmp, size = result$size)
}

.dashboard_publish_prepare_space <- function(sid, repo_id, space_name, artifact = NULL, public_payload = NULL) {
  s <- session_get(sid)
  cfg <- .dashboard_config_with_defaults(s$dashboard_config)
  project_name <- cfg$titulo %||% s$estudio$nombre %||% space_name
  artifact <- .public_artifact_normalize(artifact, project_name)
  if (identical(artifact$kind, "monitoreo")) {
    stop_api(
      410,
      "E_MONITOREO_HF_DISABLED",
      "Monitoreo ya no publica en Hugging Face. Publica las tablas cliente e internas en Google Sheets."
    )
  }
  root <- .dashboard_publish_root()
  sdk <- .dashboard_publish_artifact_sdk(artifact)
  snap <- NULL
  if (!identical(sdk, "static")) {
    snap <- .dashboard_publish_snapshot(sid, project_name, public_artifact = artifact, public_payload = public_payload)
    manifest <- .dashboard_publish_read_manifest(snap$path)
    if (!is.null(manifest$project_name) && nzchar(as.character(manifest$project_name))) {
      project_name <- as.character(manifest$project_name)
      artifact$title <- .public_artifact_scalar(artifact$title, project_name)
    }
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
  if (!is.null(snap)) file.copy(snap$path, file.path(stage, "data", "proyecto.pulso"), overwrite = TRUE)
  writeLines(
    .dashboard_publish_render_readme(root, repo_id, space_name, project_name, artifact = artifact),
    file.path(stage, "README.md"),
    useBytes = TRUE
  )

  files <- list.files(stage, recursive = TRUE, full.names = TRUE, all.files = TRUE, no.. = TRUE)
  files <- files[file.exists(files) & !dir.exists(files)]
  rel <- substring(files, nchar(stage) + 2L)
  list(
    stage = stage,
    files = files,
    rel = rel,
    project_size = if (is.null(snap)) 0L else snap$size,
    artifact = artifact,
    artifact_kind = artifact$kind,
    sdk = sdk,
    requires_lfs = !identical(sdk, "static")
  )
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

.hf_create_space <- function(repo_id, token, private = FALSE, sdk = "docker") {
  .dashboard_publish_require_curl()
  parts <- strsplit(repo_id, "/", fixed = TRUE)[[1]]
  namespace <- parts[1]
  name <- parts[2]
  sdk <- .public_artifact_scalar(sdk, "docker")
  if (!sdk %in% c("docker", "static")) sdk <- "docker"
  h <- curl::new_handle()
  do.call(curl::handle_setheaders, c(list(handle = h), as.list(.hf_headers(token, "application/json"))))
  body <- jsonlite::toJSON(
    list(
      name = name,
      organization = namespace,
      type = "space",
      sdk = sdk,
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

.hf_lfs_track_patterns <- function() {
  c(
    "data/*.pulso",
    "*.pptx",
    "*.xlsx",
    "*.sav"
  )
}

.hf_token_username <- function(token) {
  .dashboard_publish_require_curl()
  h <- curl::new_handle()
  do.call(curl::handle_setheaders, c(list(handle = h), as.list(.hf_headers(token))))
  res <- curl::curl_fetch_memory("https://huggingface.co/api/whoami-v2", handle = h)
  if (res$status_code < 200L || res$status_code >= 300L) return("hf_user")
  parsed <- tryCatch(jsonlite::fromJSON(rawToChar(res$content %||% raw())), error = function(e) NULL)
  name <- as.character(parsed$name %||% "")[1]
  if (nzchar(name)) name else "hf_user"
}

.hf_git_askpass <- function() {
  path <- tempfile("hf_askpass_")
  writeLines(c(
    "#!/bin/sh",
    "case \"$1\" in",
    "  *Username*) printf '%s\\n' \"${HF_GIT_USERNAME:-hf_user}\" ;;",
    "  *Password*) printf '%s\\n' \"$HF_TOKEN\" ;;",
    "  *) printf '%s\\n' \"$HF_TOKEN\" ;;",
    "esac"
  ), path, useBytes = TRUE)
  Sys.chmod(path, mode = "0700")
  path
}

.hf_push_space_git <- function(prepared, repo_id, token) {
  requires_lfs <- isTRUE(prepared$requires_lfs %||% TRUE)
  if (requires_lfs) .hf_check_lfs()
  remote <- sprintf("https://huggingface.co/spaces/%s", repo_id)
  askpass <- .hf_git_askpass()
  on.exit(unlink(askpass, force = TRUE), add = TRUE)
  auth_env <- c(
    sprintf("GIT_ASKPASS=%s", askpass),
    "GIT_TERMINAL_PROMPT=0",
    sprintf("HF_GIT_USERNAME=%s", .hf_token_username(token)),
    sprintf("HF_TOKEN=%s", token)
  )
  .git_run(c("init", "-b", "main"), prepared$stage)
  .git_run(c("config", "--local", "credential.helper", ""), prepared$stage)
  if (requires_lfs) {
    # LFS: trackeamos los binarios que sí necesitamos subir (data/*.pulso)
    # el JSON del modelo publico si crece sobre 10 MiB, y por las dudas otros
    # binarios que pudieran colarse (pptx/xlsx/sav).
    # `git lfs install --local` instala los hooks en este repo solo.
    .git_run(c("lfs", "install", "--local"), prepared$stage)
    for (pattern in .hf_lfs_track_patterns()) {
      .git_run(c("lfs", "track", pattern), prepared$stage)
    }
    .git_run(c("add", ".gitattributes"), prepared$stage)
  }
  .git_run(c("add", "-A"), prepared$stage)
  commit_label <- if (identical(prepared$artifact_kind %||% "", "monitoreo")) "Deploy monitoreo" else "Deploy dashboard"
  .git_run(c("-c", "user.name=Prosecnur", "-c", "user.email=deploy@prosecnur.local",
             "commit", "-m", commit_label), prepared$stage)
  .git_run(c("remote", "add", "origin", remote), prepared$stage)
  .git_run(c("push", "--force", "origin", "main"), prepared$stage,
           env = auth_env, code = "E_HF_PUSH_FAILED")
  invisible(TRUE)
}

.publish_space_common <- function(sid, hf_username, hf_token, space_name, private = FALSE, artifact = NULL, public_payload = NULL) {
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
  prepared <- .dashboard_publish_prepare_space(sid, repo_id, space_name, artifact = artifact, public_payload = public_payload)
  on.exit(unlink(prepared$stage, recursive = TRUE, force = TRUE), add = TRUE)

  .hf_create_space(repo_id, hf_token, private = private, sdk = prepared$sdk %||% "docker")

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
  artifact <- prepared$artifact %||% .public_artifact_normalize(artifact, space_name)
  artifact$published_at <- published_at
  artifact$namespace <- hf_username
  artifact$space_name <- space_name
  artifact$repo_id <- repo_id
  artifact$app_url <- app_url
  artifact$space_url <- url
  artifact$last_used_at <- published_at
  artifact$source <- artifact$source %||% if (identical(artifact$kind, "monitoreo")) "publication_model" else "dashboard"

  list(
    ok = TRUE,
    repo_id = repo_id,
    space_name = space_name,
    url = url,
    app_url = app_url,
    published_at = published_at,
    private = isTRUE(private),
    sdk = prepared$sdk %||% "docker",
    artifact_kind = artifact$kind,
    public_scope = artifact$public_scope,
    audience = artifact$audience %||% "",
    profile_family = artifact$profile_family,
    publication_family = artifact$publication_family %||% "",
    monitoring_family = artifact$monitoring_family %||% artifact$publication_family %||% artifact$profile_family %||% "",
    destination = artifact$destination %||% "",
    source = artifact$source %||% "",
    namespace = artifact$namespace %||% "",
    space_url = artifact$space_url %||% "",
    publication_sections = artifact$publication_sections %||% list(),
    report_scope = artifact$report_scope,
    files_uploaded = length(uploaded),
    total_bytes = total,
    project_size = prepared$project_size,
    uploaded = uploaded,
    artifact = artifact
  )
}

.publish_last_deploy_payload <- function(out, hf_username, private = FALSE) {
  list(
    repo_id = out$repo_id,
    space_name = out$space_name,
    hf_username = hf_username,
    url = out$url,
    app_url = out$app_url,
    published_at = out$published_at,
    private = isTRUE(private),
    sdk = out$sdk %||% "",
    artifact_kind = out$artifact_kind %||% "",
    public_scope = out$public_scope %||% "",
    audience = out$audience %||% "",
    profile_family = out$profile_family %||% "",
    publication_family = out$publication_family %||% "",
    monitoring_family = out$monitoring_family %||% out$publication_family %||% out$profile_family %||% "",
    report_scope = out$report_scope %||% "",
    namespace = hf_username,
    last_used_at = out$published_at,
    source = "hugging_face",
    destination = out$destination %||% "hugging_face_space"
  )
}

dashboard_publish_space <- function(sid, hf_username, hf_token, space_name, private = FALSE) {
  s <- session_get(sid)
  cfg <- .dashboard_config_with_defaults(s$dashboard_config)
  title <- cfg$titulo %||% s$estudio$nombre %||% space_name
  artifact <- list(
    kind = "dashboard",
    module = "dashboard",
    title = title,
    public_scope = "dashboard"
  )
  out <- .publish_space_common(
    sid = sid,
    hf_username = hf_username,
    hf_token = hf_token,
    space_name = space_name,
    private = private,
    artifact = artifact
  )

  # Persistir el último deploy en la sesión → llega al frontend en el
  # próximo /api/dashboard/config y permite mostrar "Última publicación"
  # en el botón Deploy + pre-llenar el modal con el space_name actual.
  s <- session_get(sid)
  s$dashboard_config$last_deploy <- .publish_last_deploy_payload(out, hf_username, private)
  s$project_dirty <- TRUE
  .session_env[[sid]] <- s

  out
}

monitoreo_publish_space <- function(sid, hf_username, hf_token, space_name, private = FALSE, audience = "client") {
  stop_api(
    410,
    "E_MONITOREO_HF_DISABLED",
    "Monitoreo ya no publica en Hugging Face. Publica las tablas cliente e internas en Google Sheets."
  )
}
