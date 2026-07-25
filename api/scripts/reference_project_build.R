#!/usr/bin/env Rscript
# =============================================================================
# Construye los fixtures de proyectos de referencia
# =============================================================================
#
#   Rscript api/scripts/reference_project_build.R --project acnur_pdm
#   Rscript api/scripts/reference_project_build.R --all
#   Rscript api/scripts/reference_project_build.R --project acnur_acg --origen /ruta/x.pulso
#
# Cadena por proyecto: abrir el .pulso real -> regrabarlo con la app actual
# (migra el formato) -> anonimizar -> correr el gate de PII -> instalar en
# api/inst/reference_projects/<slug>/ como read-only.
#
# El regrabado no es opcional para los proyectos viejos: ACNUR ACG se guardó con
# la 0.5.5 y HSVG con la 0.5.15. Pasarlos por `load_pulso` + `build_pulso` los
# lleva al formato de la versión actual, que es lo que se quiere ejercitar. El
# .pulso original se conserva aparte como fixture de migración.
#
# Requiere PROSECNUR_ANON_SALT. Las fuentes se resuelven contra
# PROSECNUR_REFERENCE_SOURCES (por defecto ~/Documents/Pulso).

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/reference_project_build.R"
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
tiene_flag <- function(nombre) paste0("--", nombre) %in% args

if (tiene_flag("help") || !length(args)) {
  cat("uso: reference_project_build.R (--project <slug> | --all) [--origen <x.pulso>] [--sin-regrabar]\n")
  cat("slugs:", paste(reference_project_catalog()$slug, collapse = ", "), "\n")
  quit(status = 0)
}

if (!nzchar(Sys.getenv("PROSECNUR_ANON_SALT", ""))) {
  cat("[referencia] FALTA PROSECNUR_ANON_SALT.\n")
  cat("[referencia] Sin una sal estable el fixture no es reproducible entre corridas.\n")
  cat("[referencia] Exporta una sal y guardala FUERA del repo.\n")
  quit(status = 1)
}

# -----------------------------------------------------------------------------
# Regrabado: abre el .pulso con la app actual y lo vuelve a escribir.
# -----------------------------------------------------------------------------
regrabar <- function(origen, slug) {
  destino <- tempfile(paste0("regrab-", slug, "-"), fileext = ".pulso")
  cargado <- load_pulso(origen)
  sid <- cargado$session_id %||% cargado$sid
  if (is.null(sid)) stop("load_pulso no devolvio session_id.", call. = FALSE)
  on.exit(try(project_close(sid), silent = TRUE), add = TRUE)
  build_pulso(sid, destino, project_name = slug, allow_empty_overwrite = TRUE)
  destino
}

version_de <- function(path) {
  stage <- tempfile("ver-"); dir.create(stage)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  ok <- tryCatch({ zip::unzip(path, files = "manifest.json", exdir = stage); TRUE },
                 error = function(e) FALSE)
  if (!ok) return(NA_character_)
  m <- jsonlite::fromJSON(file.path(stage, "manifest.json"), simplifyVector = TRUE)
  as.character(m$app_version %||% NA_character_)
}

construir_uno <- function(slug, origen = NULL, regrabado = TRUE) {
  cat(sprintf("\n=== %s ===\n", slug))
  origen <- origen %||% reference_project_source_path(slug)
  if (!file.exists(origen)) {
    cat(sprintf("[referencia] SALTADO: no encuentro el origen %s\n", origen))
    return(NULL)
  }
  v_origen <- version_de(origen)
  cat(sprintf("[referencia] origen: %s (app_version %s)\n", basename(origen), v_origen))

  fuente <- origen
  if (regrabado) {
    fuente <- tryCatch({
      f <- regrabar(origen, slug)
      cat(sprintf("[referencia] regrabado a %s\n", version_de(f)))
      f
    }, error = function(e) {
      # Un proyecto viejo puede fallar al reabrirse. Eso es informacion, no un
      # accidente: se anonimiza el original y se deja constancia.
      cat(sprintf("[referencia] AVISO: no pude regrabar (%s)\n", conditionMessage(e)))
      cat("[referencia] Sigo con el .pulso original, sin migrar de formato.\n")
      origen
    })
  }

  res <- tryCatch(
    # `fuente` puede ser un temporal (regrabado); la procedencia que se registra
    # es siempre la del .pulso real.
    reference_project_build(slug, origen = fuente, origen_declarado = origen),
    error = function(e) { cat(sprintf("[referencia] FALLA: %s\n", conditionMessage(e))); NULL }
  )
  if (is.null(res)) return(NULL)

  tam <- file.info(res$project_path)$size / 1024^2
  cubiertos <- names(res$cobertura)[res$cobertura]
  cat(sprintf("[referencia] OK  %s (%.1f MB)\n", basename(res$project_path), tam))
  cat(sprintf("[referencia] modulos: %s\n", paste(cubiertos, collapse = ", ")))
  res
}

slugs <- if (tiene_flag("all")) reference_project_catalog()$slug else arg_valor("project")
if (is.null(slugs)) stop("Falta --project <slug> o --all.", call. = FALSE)

resultados <- list()
for (slug in slugs) {
  resultados[[slug]] <- construir_uno(
    slug,
    origen = arg_valor("origen"),
    regrabado = !tiene_flag("sin-regrabar")
  )
}

cat("\n================ resumen ================\n")
ok <- Filter(Negate(is.null), resultados)
for (slug in names(ok)) {
  cat(sprintf("  %-12s %s\n", slug, basename(ok[[slug]]$project_path)))
}
fallidos <- setdiff(slugs, names(ok))
if (length(fallidos)) {
  cat(sprintf("  sin construir: %s\n", paste(fallidos, collapse = ", ")))
  quit(status = 1)
}
