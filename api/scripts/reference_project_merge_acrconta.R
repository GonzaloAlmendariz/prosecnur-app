#!/usr/bin/env Rscript
# =============================================================================
# Reconstruye el proyecto de referencia ACRCONTA a partir de sus dos mitades
# =============================================================================
#
# El estudio de Acreditación Contabilidad quedó partido en dos `.pulso` que
# cubren tramos distintos del mismo ciclo y ninguno cierra solo:
#
#   pruebas-monitoreo/ACRDCONTA.pulso  — monitoreo multiactor con 13 fuentes y
#     publicación a Sheets. Cero archivos embebidos: vive de fuentes externas.
#   ACRD CONTA/CONTA_REPORTE.pulso     — el lado de procesamiento, con la base
#     `.sav` de 172x99, los 59 mapas de códigos y el intake de hermanos
#     independientes.
#
# Este script los une en un solo proyecto que recorre el ciclo entero, que es
# como el estudio debió verse. El monitoreo manda como destino: es el más
# reciente (0.5.19 contra 0.5.18) y el que tiene el estado operativo. Del lado
# de procesamiento se traen SOLO las ramas que el destino no tiene, sin pisar
# nada — en particular el editor XLSForm se deja como está en monitoreo, que es
# donde viven los instrumentos de acreditación reales.
#
#   Rscript api/scripts/reference_project_merge_acrconta.R --salida /tmp/x.pulso

script_path <- local({
  a <- commandArgs(trailingOnly = FALSE)
  hit <- a[startsWith(a, "--file=")]
  if (length(hit)) sub("--file=", "", hit[[1]]) else "api/scripts/reference_project_merge_acrconta.R"
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

meta <- .reference_project_meta("acrconta")
origen_monitoreo <- arg_valor("monitoreo", reference_project_source_path("acrconta"))
origen_procesamiento <- arg_valor("procesamiento",
                                  reference_project_source_path("acrconta", secundario = TRUE))
salida <- arg_valor("salida", tempfile("acrconta-merge-", fileext = ".pulso"))

for (p in c(origen_monitoreo, origen_procesamiento)) {
  if (!file.exists(p)) stop(sprintf("No encuentro: %s", p), call. = FALSE)
}

cat(sprintf("[merge] monitoreo    : %s\n", basename(origen_monitoreo)))
cat(sprintf("[merge] procesamiento: %s\n", basename(origen_procesamiento)))

# Ramas que definen el lado de procesamiento. Se traen solo si el destino no
# las tiene ya pobladas.
RAMAS_PROCESAMIENTO <- c(
  "estudio",
  "analitica_config",
  "analitica_fuente",
  "analitica_config_por_base",
  "choice_code_maps_confirmed",
  "instrument_revisions",
  "processing_intake",
  "inst_estructura_por_base",
  "codif_source_active",
  "codif_por_base",
  "label_overrides"
)

cargado_dst <- load_pulso(origen_monitoreo)
sid_dst <- cargado_dst$session_id %||% cargado_dst$sid
cargado_src <- load_pulso(origen_procesamiento)
sid_src <- cargado_src$session_id %||% cargado_src$sid

s_dst <- session_get(sid_dst)
s_src <- session_get(sid_src)

lleno <- function(x) !is.null(x) && length(x) > 0

copiadas <- character()
omitidas <- character()
for (rama in RAMAS_PROCESAMIENTO) {
  valor_src <- s_src[[rama]]
  if (!lleno(valor_src)) next
  valor_dst <- s_dst[[rama]]
  # `estudio` en el destino existe pero con `bases` vacio: eso NO cuenta como
  # poblado, y es justamente lo que la mitad de procesamiento viene a llenar.
  ya_poblado <- if (identical(rama, "estudio")) {
    lleno((valor_dst %||% list())$bases)
  } else lleno(valor_dst)

  if (ya_poblado) { omitidas <- c(omitidas, rama); next }
  session_set(sid_dst, rama, valor_src)
  copiadas <- c(copiadas, rama)
}

# Los archivos referenciados por las ramas copiadas tienen que viajar: sin
# ellos el .pulso resultante abriria con bases que apuntan a la nada.
files_dst <- session_get(sid_dst)$files %||% list()
files_src <- s_src$files %||% list()
nuevos <- setdiff(names(files_src), names(files_dst))
if (length(nuevos)) {
  for (fid in nuevos) files_dst[[fid]] <- files_src[[fid]]
  session_set(sid_dst, "files", files_dst)
}

cat(sprintf("[merge] ramas copiadas : %s\n", paste(copiadas, collapse = ", ")))
if (length(omitidas)) {
  cat(sprintf("[merge] ramas omitidas : %s (el destino ya las tenia)\n",
              paste(omitidas, collapse = ", ")))
}
cat(sprintf("[merge] archivos sumados: %d\n", length(nuevos)))

build_pulso(sid_dst, salida, project_name = "ACRCONTA", allow_empty_overwrite = TRUE)
try(project_close(sid_dst), silent = TRUE)
try(project_close(sid_src), silent = TRUE)

cob <- reference_project_cobertura(.reference_project_leer_state(salida))
cat(sprintf("\n[merge] salida: %s (%.2f MB)\n", salida, file.info(salida)$size / 1024^2))
cat(sprintf("[merge] modulos: %s\n", paste(names(cob)[cob], collapse = ", ")))
faltan <- names(cob)[!cob]
if (length(faltan)) cat(sprintf("[merge] sin cubrir: %s\n", paste(faltan, collapse = ", ")))
