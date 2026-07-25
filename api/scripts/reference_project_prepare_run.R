#!/usr/bin/env Rscript
# =============================================================================
# Prepara una corrida aislada sobre un fixture de referencia
# =============================================================================
#
# Los fixtures se instalan read-only a propósito: son puntos de comparación, y
# uno que se reescribe por accidente deja de serlo. Pero abrir un proyecto en la
# app lo modifica —autosave, caches calientes, estado de UI—, así que la corrida
# nunca toca el fixture: se copia a un directorio de run con permisos de
# escritura y se trabaja sobre la copia.
#
# Imprime en stdout la ruta del manifest de la corrida, para que el Makefile la
# capture igual que en `audit_project_prepare_run.R`.

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/reference_project_prepare_run.R"
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

slug <- arg_valor("project")
if (is.null(slug)) stop("Falta --project <slug>.", call. = FALSE)
root <- arg_valor("root", file.path(repo_root, "outputs", "reference-runs"))

fixture <- arg_valor("fixture", reference_project_path(slug))
if (!file.exists(fixture)) {
  stop(sprintf(
    "El fixture de '%s' no esta instalado: %s\nCorre: make reference-project-build PROJECT=%s",
    slug, fixture, slug
  ), call. = FALSE)
}

# El sello temporal viene del reloj del sistema y no de una semilla: cada
# corrida es un directorio propio para poder comparar dos ejecuciones.
sello <- format(Sys.time(), "%Y%m%d-%H%M%S")
run_dir <- file.path(root, sprintf("%s-%s", slug, sello))
dir.create(run_dir, recursive = TRUE, showWarnings = FALSE)

copia <- file.path(run_dir, basename(fixture))
# stdout es el canal por el que este script devuelve la ruta del manifiesto
# (`cat()` al final), así que nada más puede escribir ahí. `file.copy()` a nivel
# top-level autoprintea su TRUE y ensucia la salida: el consumidor recibe
# "[1] TRUE\n<ruta>" y `jq` revienta con "trailing garbage".
copiado <- file.copy(fixture, copia, overwrite = TRUE)
if (!isTRUE(copiado)) {
  stop(sprintf("No se pudo copiar el fixture a %s", copia), call. = FALSE)
}
Sys.chmod(copia, mode = "0644")

manifest <- list(
  schema = "prosecnur.reference_project_run.v1",
  slug = slug,
  fixture = fixture,
  project_path = normalizePath(copia, mustWork = FALSE),
  fixture_sha256 = digest::digest(file = fixture, algo = "sha256"),
  prepared_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
)
manifest_path <- file.path(run_dir, "reference-run.json")
writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE), manifest_path)

cat(manifest_path)
