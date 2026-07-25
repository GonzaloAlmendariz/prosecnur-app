#!/usr/bin/env Rscript
# =============================================================================
# Gate de los fixtures de referencia
# =============================================================================
#
# Por cada fixture instalado comprueba tres cosas, y falla si alguna cede:
#
#   - Sin PII detectable en las columnas que el anonimizador no garantiza.
#   - El sha256 coincide con el declarado: el fixture no fue tocado a mano.
#   - Los módulos declarados como cubiertos siguen poblados de verdad. Un
#     fixture que dice cubrir analítica y ya no la trae miente sobre el alcance
#     del testeo, que es peor que no tenerlo.
#
# Un fixture ausente NO es falla: construirlo necesita los .pulso originales del
# analista, que no viven en el repo. Se reporta como omitido.
#
#   Rscript api/scripts/reference_project_verify.R [--project <slug>] [--estricto]

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/reference_project_verify.R"
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
estricto <- "--estricto" %in% args

slugs <- arg_valor("project")
if (is.null(slugs)) slugs <- reference_project_catalog()$slug

fallidos <- character()
omitidos <- character()
verificados <- character()

for (slug in slugs) {
  path <- reference_project_path(slug)
  if (!file.exists(path)) {
    omitidos <- c(omitidos, slug)
    cat(sprintf("  %-12s OMITIDO (no instalado)\n", slug))
    next
  }
  res <- reference_project_verify(slug)
  if (isTRUE(res$ok)) {
    cob <- reference_project_cobertura(.reference_project_leer_state(path))
    cat(sprintf("  %-12s OK  (%.1f MB, %d modulos)\n",
                slug, file.info(path)$size / 1024^2, sum(cob)))
    verificados <- c(verificados, slug)
  } else {
    cat(sprintf("  %-12s FALLA\n", slug))
    for (p in res$problemas) cat(sprintf("      - %s\n", p))
    if (nrow(res$hallazgos_pii %||% data.frame())) print(res$hallazgos_pii)
    fallidos <- c(fallidos, slug)
  }
}

cat(sprintf("\n[referencia] %d verificados, %d omitidos, %d fallidos\n",
            length(verificados), length(omitidos), length(fallidos)))

if (length(fallidos)) quit(status = 1)
if (estricto && length(omitidos)) {
  cat("[referencia] --estricto: hay fixtures sin instalar.\n")
  quit(status = 1)
}
