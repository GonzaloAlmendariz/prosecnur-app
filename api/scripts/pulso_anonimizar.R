#!/usr/bin/env Rscript
# =============================================================================
# Anonimiza un .pulso real y lo deja listo para versionar como fixture
# =============================================================================
#
#   Rscript api/scripts/pulso_anonimizar.R \
#     --origen "/ruta/ACNUR_PDM.pulso" \
#     --destino "api/inst/reference_projects/acnur_pdm/acnur_pdm.pulso" \
#     --slug acnur_pdm
#
# La sal sale de PROSECNUR_ANON_SALT. NO se versiona y no viaja en el fixture:
# es lo único que impide que alguien con una lista de nombres candidatos
# confirme, por fuerza bruta contra el fixture publicado, quién participó en el
# estudio real. Sin ella el seudónimo sería recomputable por cualquiera.
#
# Con --verificar solo corre el detector sobre un .pulso ya escrito.

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/pulso_anonimizar.R"
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
  cat("uso: pulso_anonimizar.R --origen <in.pulso> --destino <out.pulso> [--slug <slug>]\n")
  cat("     pulso_anonimizar.R --verificar <fixture.pulso>\n")
  quit(status = 0)
}

# --- modo verificación --------------------------------------------------------
verificar <- arg_valor("verificar")
if (!is.null(verificar)) {
  hallazgos <- pulso_detectar_pii(verificar)
  if (!nrow(hallazgos)) {
    cat(sprintf("[anonimizar] OK: sin PII detectable en %s\n", basename(verificar)))
    quit(status = 0)
  }
  cat(sprintf("[anonimizar] FALLA: %d hallazgos en %s\n", nrow(hallazgos), basename(verificar)))
  print(hallazgos)
  quit(status = 1)
}

# --- modo anonimización -------------------------------------------------------
origen <- arg_valor("origen")
destino <- arg_valor("destino")
if (is.null(origen) || is.null(destino)) {
  stop("Faltan --origen y/o --destino.", call. = FALSE)
}
slug <- arg_valor("slug", tools::file_path_sans_ext(basename(destino)))

sal <- Sys.getenv("PROSECNUR_ANON_SALT", "")
if (!nzchar(sal)) {
  sal <- paste0("efimera-", paste(sample(c(letters, 0:9), 24, replace = TRUE), collapse = ""))
  cat("[anonimizar] AVISO: PROSECNUR_ANON_SALT no esta definida.\n")
  cat("[anonimizar] Se usa una sal efimera: el fixture sera valido pero NO reproducible.\n")
  cat("[anonimizar] Para regenerarlo identico, exporta una sal estable y guardala fuera del repo.\n")
}

cat(sprintf("[anonimizar] origen : %s\n", origen))
cat(sprintf("[anonimizar] destino: %s\n", destino))

reporte <- pulso_anonimizar_archivo(origen, destino, sal = sal, slug = slug)

cat(sprintf("[anonimizar] tablas tocadas       : %d\n", reporte$n_tablas_tocadas))
cat(sprintf("[anonimizar] nombres seudonimizados: %d\n", reporte$n_nombres_seudonimizados))
for (t in reporte$tablas) {
  cat(sprintf("  - %s (%d filas)\n", t$ruta, t$filas))
  if (length(t$columnas_pii)) {
    cat(sprintf("      columnas PII : %s\n", paste(t$columnas_pii, collapse = ", ")))
  }
  if (t$reemplazos_abiertas > 0) {
    cat(sprintf("      abiertas     : %d reemplazos en %s\n",
                t$reemplazos_abiertas, paste(t$columnas_abiertas, collapse = ", ")))
  }
}

# El gate corre siempre: un fixture no se da por bueno sin verificarlo.
hallazgos <- pulso_detectar_pii(destino)
if (nrow(hallazgos)) {
  cat(sprintf("\n[anonimizar] FALLA: quedaron %d hallazgos de PII.\n", nrow(hallazgos)))
  print(hallazgos)
  unlink(destino, force = TRUE)
  cat("[anonimizar] El destino fue borrado para que no se publique por accidente.\n")
  quit(status = 1)
}

tam <- file.info(destino)$size
cat(sprintf("\n[anonimizar] OK: %s (%.1f MB), sin PII detectable.\n", destino, tam / 1024^2))
