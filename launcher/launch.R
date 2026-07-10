#!/usr/bin/env Rscript
# Launcher for prosecnur-app.
# Run from the repo root: `Rscript launcher/launch.R`
# o vía los wrappers OS en launcher/ (.command, .sh, .bat).
#
# NOTA (post-fork v0.2): el motor prosecnur ya vive dentro del paquete
# `prosecnurapp` (api/R/). Se acabó el `PULSO_PROSECNUR_DEV` que cargaba
# un paquete externo. Ahora es un solo load_all(api_dir) y listo.

# Locale UTF-8. Sin esto, R lee los .R que tienen comentarios y strings
# con tildes en locale C y el launcher rompe con "invalid input found on
# input connection". También afecta la salida JSON: strings como
# "descripción" se escapan a "<U+00F3>" en vez de UTF-8 real. Fallback
# a C.UTF-8 si en_US.UTF-8 no está disponible (Linux minimalista,
# containers Alpine, etc.).
local({
  tryCatch(Sys.setlocale("LC_ALL", "en_US.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  if (!isTRUE(l10n_info()[["UTF-8"]])) {
    tryCatch(Sys.setlocale("LC_ALL", "C.UTF-8"), error = function(e) NULL, warning = function(w) NULL)
  }
})
options(encoding = "UTF-8")

`%||%` <- function(a, b) if (is.null(a)) b else a

.script_path <- local({
  args <- commandArgs(trailingOnly = FALSE)
  fmatch <- "--file="
  hit <- args[startsWith(args, fmatch)]
  if (length(hit) > 0) sub(fmatch, "", hit[1]) else NA_character_
})
repo_root <- if (!is.na(.script_path)) {
  normalizePath(file.path(dirname(.script_path), ".."), mustWork = FALSE)
} else {
  normalizePath(".", mustWork = FALSE)
}
if (!dir.exists(repo_root)) repo_root <- normalizePath(".", mustWork = FALSE)

Sys.setenv(PULSO_REPO_ROOT = repo_root)

api_dir <- file.path(repo_root, "api")
static_dir <- file.path(repo_root, "api", "inst", "www")

port <- as.integer(Sys.getenv("PULSO_PORT", "8787"))
host <- trimws(Sys.getenv("PULSO_HOST", "127.0.0.1"))
open_browser <- !tolower(Sys.getenv("PULSO_OPEN_BROWSER", "true")) %in% c("0", "false", "no")

loopback_hosts <- c("127.0.0.1", "localhost", "::1")
if (!(tolower(host) %in% loopback_hosts)) {
  stop(sprintf(
    "[prosecnur-app] PULSO_HOST='%s' no es un host local permitido. ",
    host
  ), "La app principal solo escucha en 127.0.0.1, localhost o ::1. ",
  "Para publicar artefactos del dashboard usa launcher/launch_server.R.")
}

cat(sprintf("[prosecnur-app] repo_root = %s\n", repo_root))

# Deprecación amable de PULSO_PROSECNUR_DEV: si alguien todavía lo tiene
# seteado por costumbre, avisamos y seguimos. El prosecnur externo ya no
# se usa; ignorar la variable no rompe nada.
if (nzchar(Sys.getenv("PULSO_PROSECNUR_DEV", ""))) {
  message("[prosecnur-app] NOTE: PULSO_PROSECNUR_DEV está seteado pero ya no ",
          "se usa. El motor vive dentro de prosecnurapp (api/R/) desde v0.2. ",
          "Podés desexportarlo sin problema.")
}

# --- Guard: mantener el paquete INSTALADO fresco para los jobs callr ---------
# El backend principal carga la FUENTE con load_all (abajo), pero las
# operaciones pesadas corren en subprocesos callr (auditoría de validación,
# cruces, codebook, exports) que terminan cargando el prosecnurapp INSTALADO en
# la librería de R, no la fuente. Si la fuente es más nueva que lo instalado, un
# fix a código que corre en un job NO toma efecto por más que reinicies (el job
# sigue con la versión vieja). Reinstalamos automáticamente cuando la fuente
# cambió, para que ningún job corra código viejo. Solo reinstala si de verdad
# hay staleness (chequeo de mtime instantáneo); si falla, avisa pero no bloquea.
local({
  installed_dir <- tryCatch(find.package("prosecnurapp"), error = function(e) NA_character_)
  needs_reinstall <- is.na(installed_dir)
  if (!needs_reinstall) {
    src_files <- c(
      list.files(file.path(api_dir, "R"), pattern = "\\.R$", full.names = TRUE),
      file.path(api_dir, "DESCRIPTION"), file.path(api_dir, "NAMESPACE")
    )
    src_mtime  <- suppressWarnings(max(file.info(src_files)$mtime, na.rm = TRUE))
    inst_mtime <- file.info(file.path(installed_dir, "DESCRIPTION"))$mtime
    needs_reinstall <- isTRUE(is.finite(as.numeric(src_mtime)) &&
                                !is.na(inst_mtime) && src_mtime > inst_mtime)
  }
  if (isTRUE(needs_reinstall)) {
    cat("[prosecnur-app] Paquete instalado desactualizado vs fuente — ",
        "reinstalando para que los jobs callr corran código actual...\n", sep = "")
    ok <- tryCatch({
      utils::install.packages(
        api_dir, repos = NULL, type = "source", quiet = TRUE,
        INSTALL_opts = c("--no-multiarch", "--no-docs", "--no-byte-compile")
      )
      TRUE
    }, error = function(e) { message("[prosecnur-app] WARN: no se pudo reinstalar prosecnurapp: ", conditionMessage(e)); FALSE })
    if (isTRUE(ok)) cat("[prosecnur-app] prosecnurapp reinstalado desde fuente.\n")
  }
})

# Cargar el paquete de la app (ya incluye el motor).
if (requireNamespace("devtools", quietly = TRUE)) {
  devtools::load_all(api_dir, quiet = TRUE)
} else if (requireNamespace("pkgload", quietly = TRUE)) {
  pkgload::load_all(api_dir, quiet = TRUE)
} else {
  stop("Need 'devtools' or 'pkgload' installed to run in dev mode. Install with: install.packages('pkgload')")
}

local({
  status_fn <- tryCatch(
    get(".preview_renderer_status", envir = asNamespace("prosecnurapp"), inherits = FALSE),
    error = function(e) NULL
  )
  if (is.function(status_fn)) {
    st <- tryCatch(status_fn(), error = function(e) NULL)
    if (is.list(st)) {
      renderer <- as.character(st$renderer %||% "none")
      available <- isTRUE(st$available)
      cat(sprintf(
        "[prosecnur-app] pptx preview renderer = %s (available=%s, desktop_automation=false)\n",
        renderer,
        tolower(as.character(available))
      ))
    }
  }
})

# Bootstrap opcional: si PULSO_BOOTSTRAP_PROJECT apunta a un .pulso válido,
# crea una sesión cargando ese proyecto antes de levantar el servidor. Útil
# para que un agente externo (Claude Code, scripts CI) arranque el stack
# con datos pre-cargados sin pasar por la UI.
.bootstrap_path <- Sys.getenv("PULSO_BOOTSTRAP_PROJECT", "")
if (!nzchar(.bootstrap_path)) {
  .bootstrap_path <- Sys.getenv("PULSO_AUDIT_PROJECT", "")
}
if (nzchar(.bootstrap_path)) {
  if (!file.exists(.bootstrap_path)) {
    stop(sprintf("[bootstrap] PULSO_BOOTSTRAP_PROJECT apunta a un archivo que no existe: %s", .bootstrap_path))
  }
  cat(sprintf("[bootstrap] cargando %s ...\n", .bootstrap_path))
  .bs <- tryCatch(load_pulso(.bootstrap_path), error = function(e) {
    stop(sprintf("[bootstrap] error cargando .pulso: %s", conditionMessage(e)))
  })
  Sys.setenv(PULSO_BOOTSTRAP_SID = .bs$session_id)
  cat(sprintf("[bootstrap] sesión SID=%s cargada desde %s\n", .bs$session_id, .bootstrap_path))
  .audit_manifest <- Sys.getenv("PULSO_AUDIT_RUN_MANIFEST", "")
  .audit_writer <- if (exists("audit_reference_write_run_manifest", mode = "function")) {
    audit_reference_write_run_manifest
  } else {
    tryCatch(
      get("audit_reference_write_run_manifest", envir = asNamespace("prosecnurapp"), inherits = FALSE),
      error = function(e) NULL
    )
  }
  if (nzchar(.audit_manifest) && is.function(.audit_writer)) {
    tryCatch(
      .audit_writer(
        .audit_manifest,
        patch = list(
          status = "bootstrapped",
          sid = .bs$session_id,
          host = host,
          port = port,
          bootstrap_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
        ),
        project_path = .bootstrap_path
      ),
      error = function(e) {
        message("[bootstrap] no pude actualizar audit-run.json: ", conditionMessage(e))
      }
    )
  }
}

run_app(host = host, port = port, static_dir = static_dir, open_browser = open_browser)
