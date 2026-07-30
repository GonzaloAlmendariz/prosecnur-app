#!/usr/bin/env Rscript
# =============================================================================
# Deriva una corrida de hsvg2026 con la selección de cursos-horario ya corrida
# =============================================================================
#
#   Rscript api/scripts/reference_project_seed_aulas_selection.R --project hsvg2026
#
# Por qué existe: `hsvg2026` trae el marco de 5.263 cursos-horario pero
# `calc_muestra_aulas_selection` vacío, así que Recopiladores —que lee la agenda
# desde esa selección— no se puede observar ni QA'ear poblado. Sin esto, los
# gates del plan de Recopiladores (docs/plan-recopiladores-2026-07.md §11.1) se
# verificarían contra una pantalla vacía, que es cómo un gate da verde por
# ausencia en vez de por conformidad.
#
# Por qué NO se hornea dentro del fixture: el fixture es un producto de build
# (`reference_project_build.R`) que parte del `.pulso` real y exige
# PROSECNUR_ANON_SALT. Mutarlo en sitio lo desincroniza de su `project_sha256` y
# el siguiente build lo regeneraría sin la selección, perdiendo el fixture en
# silencio. Derivarla es reproducible, no necesita la sal y no mete 8 MB de
# binario nuevo al repo en cada cambio.
#
# La selección es determinista: el motor siembra con `selector$seed` (20260619
# por defecto en este proyecto), así que dos corridas eligen los mismos
# cursos-horario. Lo único que cambia entre corridas es `selection_run_id`, que
# lleva un sello de reloj por diseño.
#
# Imprime en stdout la ruta del manifiesto, igual que
# `reference_project_prepare_run.R`, para que un Makefile la capture con `jq`.

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/reference_project_seed_aulas_selection.R"
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

slug <- arg_valor("project", "hsvg2026")
root <- arg_valor("root", file.path(repo_root, "outputs", "reference-runs"))
semilla <- arg_valor("seed", NULL)

fixture <- arg_valor("fixture", reference_project_path(slug))
if (!file.exists(fixture)) {
  stop(sprintf(
    "El fixture de '%s' no esta instalado: %s\nCorre: make reference-project-build REFERENCE_PROJECT=%s",
    slug, fixture, slug
  ), call. = FALSE)
}

sello <- format(Sys.time(), "%Y%m%d-%H%M%S")
run_dir <- file.path(root, sprintf("%s-aulas-sel-%s", slug, sello))
dir.create(run_dir, recursive = TRUE, showWarnings = FALSE)

# El fixture se instala 0444 a propósito. Se abre desde su ruta original —abrir
# no escribe— y lo que se graba es el `.pulso` derivado, dentro del run dir.
handle <- load_pulso(fixture)
sid <- handle$session_id
s <- session_get(sid)

frame <- s$calc_muestra_aulas_frame
if (is.null(frame)) {
  stop(sprintf(
    "'%s' no tiene marco de aulas (`calc_muestra_aulas_frame`); no hay nada que seleccionar.",
    slug
  ), call. = FALSE)
}

config <- calc_muestra_aulas_normalize_config(
  frame$config %||% s$calc_muestra_aulas_config %||% list()
)
if (!is.null(semilla)) {
  config$selector$seed <- as.integer(semilla)
}

t0 <- Sys.time()
selection <- calc_muestra_aulas_seleccionar(frame, config)
segundos <- round(as.numeric(difftime(Sys.time(), t0, units = "secs")), 2)

filas <- if (is.data.frame(selection$selection)) nrow(selection$selection) else length(selection$selection)
if (!isTRUE(filas > 0L)) {
  stop("La selección salió vacía; el fixture derivado no serviría de nada.", call. = FALSE)
}

# Las mismas claves que limpia `POST /api/calc-muestra/aulas/seleccionar`: una
# selección nueva invalida simulación de reemplazos y export previos.
session_set(sid, "calc_muestra_aulas_config", config)
session_set(sid, "calc_muestra_aulas_selection", selection)
session_set(sid, "calc_muestra_aulas_replacement_simulation", NULL)
session_set(sid, "calc_muestra_aulas_export", NULL)

destino <- file.path(run_dir, sprintf("%s-aulas-sel.pulso", slug))
# `invisible()` no es cosmético: stdout es el canal por el que este script
# devuelve la ruta del manifiesto, y `build_pulso` en top-level autoprintea su
# lista de retorno. Sin esto el consumidor recibe la lista antes de la ruta y
# `jq` revienta con "trailing garbage" — la misma trampa que documenta
# `reference_project_prepare_run.R` para `file.copy()`.
invisible(build_pulso(sid, destino, project_name = sprintf("%s (selección de aulas)", slug)))
Sys.chmod(destino, mode = "0644")

manifest <- list(
  schema = "prosecnur.reference_project_run.v1",
  slug = slug,
  derivacion = "aulas_selection",
  fixture = fixture,
  project_path = normalizePath(destino, mustWork = FALSE),
  fixture_sha256 = digest::digest(file = fixture, algo = "sha256"),
  aulas_selection = list(
    selection_run_id = selection$selection_run_id %||% NA_character_,
    selector_engine = config$selector$selector_engine %||% NA_character_,
    seed = config$selector$seed %||% NA_integer_,
    n_aulas = config$selector$n_aulas %||% NA_integer_,
    filas = filas,
    segundos = segundos
  ),
  prepared_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
)
manifest_path <- file.path(run_dir, "reference-run.json")
writeLines(jsonlite::toJSON(manifest, auto_unbox = TRUE, pretty = TRUE), manifest_path)

cat(manifest_path)
