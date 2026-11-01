#!/usr/bin/env Rscript
# =============================================================================
# Prepara el .pulso que se sube a un Space público (deploy manual)
# =============================================================================
#
#   Rscript api/scripts/publicacion_preparar.R \
#     --project "/ruta/MiProyecto.pulso" \
#     --out "data/proyecto.pulso"
#
# Es la MISMA ruta que usa el botón Deploy (.dashboard_publish_snapshot): una
# lista permitida de lo que el dashboard lee y la base podada a las columnas
# que el motor usa (ADR 0122 §9). El .pulso del proyecto no se toca. El
# runtime público (launcher/launch_server.R) no arranca con un .pulso que no
# haya pasado por aquí.
#
# Al terminar corre el detector de datos personales sobre el resultado y sale
# con código 1 si encuentra algo.

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/publicacion_preparar.R"
})
repo_root <- normalizePath(file.path(dirname(script_path), "..", ".."), mustWork = FALSE)
api_dir <- file.path(repo_root, "api")
Sys.setenv(PULSO_REPO_ROOT = repo_root, PULSO_API_DIR = api_dir)
suppressMessages(pkgload::load_all(api_dir, quiet = TRUE))

args <- commandArgs(trailingOnly = TRUE)
arg_valor <- function(nombre, default = NULL) {
  eq <- paste0("--", nombre, "=")
  hit <- args[startsWith(args, eq)]
  if (length(hit)) return(sub(eq, "", hit[[1]], fixed = TRUE))
  idx <- match(paste0("--", nombre), args)
  if (!is.na(idx) && idx < length(args)) return(args[[idx + 1L]])
  default
}

proyecto <- arg_valor("project")
salida <- arg_valor("out")
if ("--help" %in% args || is.null(proyecto) || is.null(salida)) {
  cat("uso: publicacion_preparar.R --project <proyecto.pulso> --out <data/proyecto.pulso>\n")
  quit(status = if ("--help" %in% args) 0 else 1)
}
if (!file.exists(proyecto)) stop("No existe el proyecto: ", proyecto)

# Se trabaja sobre una copia: abrir el proyecto no debe tocar el original.
copia <- tempfile(fileext = ".pulso")
file.copy(proyecto, copia)
ld <- suppressMessages(load_pulso(copia))
nombre <- tools::file_path_sans_ext(basename(proyecto))
snap <- .dashboard_publish_snapshot(ld$session_id, nombre)
dir.create(dirname(normalizePath(salida, mustWork = FALSE)), recursive = TRUE, showWarnings = FALSE)
file.copy(snap$path, salida, overwrite = TRUE)

hallazgos <- pulso_detectar_pii(salida)
cat(sprintf("[publicacion] %s -> %s (%s KB)\n", basename(proyecto), salida, round(file.size(salida) / 1024)))
if (nrow(hallazgos)) {
  cat(sprintf("[publicacion] FALLA: %d hallazgos de datos personales en el .pulso preparado:\n", nrow(hallazgos)))
  print(hallazgos)
  quit(status = 1)
}
cat("[publicacion] OK: sin datos personales detectables.\n")
