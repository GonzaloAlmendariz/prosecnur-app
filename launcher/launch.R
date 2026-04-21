#!/usr/bin/env Rscript
# Launcher for prosecnur-app.
# Run from the repo root: `Rscript launcher/launch.R`
# or via the OS wrappers in launcher/ (.command, .sh, .bat).

# Locale UTF-8. Sin esto, R lee los .R del paquete prosecnur (que tienen
# comentarios y strings con tildes) en locale C y el launcher rompe con
# "invalid input found on input connection". También afecta la salida
# JSON: strings como "descripción" se escapan a "<U+00F3>" en vez de UTF-8
# real. Fallback a C.UTF-8 si en_US.UTF-8 no está disponible (Linux
# minimalista, containers Alpine, etc.).
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

cat(sprintf("[prosecnur-app] repo_root = %s\n", repo_root))

# 1) Cargar prosecnur. Si `PULSO_PROSECNUR_DEV` está seteado y apunta a un
#    directorio válido, cargamos esa versión local vía pkgload/devtools
#    (tiene precedencia sobre la instalada). Esto es lo que permite al
#    equipo iterar sobre el paquete sin tener que `devtools::install()`
#    después de cada cambio.
#
#    Sin esto, el runtime encuentra la versión instalada — que puede tener
#    nombres/firmas desactualizados (ej. `p_slide_portada` no existe si el
#    instalado es el viejo con nombres en inglés). Síntoma típico:
#    `E_PREVIEW_FAILED: 'p_slide_portada' is not an exported object from
#    'namespace:prosecnur'`.
#
#    Uso:  PULSO_PROSECNUR_DEV=/path/to/prosecnur Rscript launcher/launch.R
#
#    Los workers callr (ver router_graficos.R) leen la misma env var y
#    hacen load_all en cada subproceso; así los PPT/Word exports también
#    usan la versión dev.
.prosecnur_dev <- Sys.getenv("PULSO_PROSECNUR_DEV", "")
if (nzchar(.prosecnur_dev)) {
  .prosecnur_dev <- normalizePath(.prosecnur_dev, mustWork = FALSE)
  if (!dir.exists(.prosecnur_dev)) {
    stop(sprintf(
      "PULSO_PROSECNUR_DEV='%s' no es un directorio válido.", .prosecnur_dev
    ))
  }
  Sys.setenv(PULSO_PROSECNUR_DEV = .prosecnur_dev)
  cat(sprintf("[prosecnur-app] prosecnur DEV = %s\n", .prosecnur_dev))
  if (requireNamespace("pkgload", quietly = TRUE)) {
    pkgload::load_all(.prosecnur_dev, quiet = TRUE)
  } else if (requireNamespace("devtools", quietly = TRUE)) {
    devtools::load_all(.prosecnur_dev, quiet = TRUE)
  } else {
    stop("Need 'devtools' or 'pkgload' to load prosecnur from PULSO_PROSECNUR_DEV.")
  }
} else {
  if (!requireNamespace("prosecnur", quietly = TRUE)) {
    stop(
      "El paquete 'prosecnur' no está disponible. ",
      "Instala con `devtools::install('/path/to/prosecnur')` o exporta ",
      "`PULSO_PROSECNUR_DEV=/path/to/prosecnur` antes de correr el launcher."
    )
  }
  cat(sprintf("[prosecnur-app] prosecnur = %s (instalado)\n",
              utils::packageVersion("prosecnur")))
}

# 2) Cargar el paquete de la app (api/) en modo dev.
if (requireNamespace("devtools", quietly = TRUE)) {
  devtools::load_all(api_dir, quiet = TRUE)
} else if (requireNamespace("pkgload", quietly = TRUE)) {
  pkgload::load_all(api_dir, quiet = TRUE)
} else {
  stop("Need 'devtools' or 'pkgload' installed to run in dev mode. Install with: install.packages('pkgload')")
}

port <- as.integer(Sys.getenv("PULSO_PORT", "8787"))
host <- Sys.getenv("PULSO_HOST", "127.0.0.1")

run_app(host = host, port = port, static_dir = static_dir, open_browser = TRUE)
