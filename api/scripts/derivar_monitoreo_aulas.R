#!/usr/bin/env Rscript
# Deriva de un proyecto de calculo de muestra otro con MONITOREO DE AULAS ACTIVO.
#
# Por que existe: ningun proyecto de referencia cubre el perfil de aulas.
# Medido el 2026-08-29 sobre `api/inst/reference_projects/*/reference-project.json`:
# `acnur_acg` cubre territorial, `acnur_pdm` telefonico, `acrconta` acreditacion,
# y `hsvg2026` —el unico de cursos-horario— declara `monitoreo: false` porque su
# `state.rds` no lleva sorteo ejecutado. Sin plan no hay banco, sin banco no hay
# reserva dirigida, y NINGUNA superficie del perfil de aulas se puede ver.
#
# Este script ejecuta el sorteo sobre el marco que el proyecto ya trae y monta el
# plan de monitoreo, dejando el resultado en un `.pulso` NUEVO. **No toca el
# fixture versionado**: convertir hsvg2026 en un proyecto con monitoreo es una
# decision de cobertura del repo, no un efecto secundario de querer ver una
# pantalla.
#
#   Rscript api/scripts/derivar_monitoreo_aulas.R <origen.pulso> <destino.pulso>
#
# Las tres claves que el router lee de verdad, y que costaron una vuelta:
#   * `s$monitoreo_config$aulas_universitarias` — la config del perfil.
#   * `s$monitoreo_config$monitoreo_profile$route_selected` — sin ella el shell
#     se queda en la pantalla de eleccion de modo y no hay perfil que mirar.
#   * `s$monitoreo_aulas_plan` — el plan que el router prefiere sobre `cfg$plan`.

suppressMessages(pkgload::load_all("api", quiet = TRUE))

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2L) stop("uso: derivar_monitoreo_aulas.R <origen.pulso> <destino.pulso>")
origen <- normalizePath(args[[1]], mustWork = TRUE)
destino <- args[[2]]

trabajo <- file.path(tempdir(), paste0("derivar_aulas_", as.integer(Sys.time())))
dir.create(trabajo, recursive = TRUE, showWarnings = FALSE)
utils::unzip(origen, exdir = trabajo)

st <- readRDS(file.path(trabajo, "state.rds"))
if (is.null(st$calc_muestra_aulas_frame)) {
  stop("el proyecto no trae marco de aulas (`calc_muestra_aulas_frame`)")
}

# **La efectividad se sella y se anota ANTES de sortear.** Sin esto el plan sale
# con `expected_valid == eligible_n` en las 2.373 filas —o sea tasa 1, certeza
# absoluta— y toda superficie que dependa del rendimiento queda muerta: la
# probabilidad de cierre no se puede calcular, y las metas por aula son los
# elegibles enteros. El `.pulso` de referencia trae `efectividad = NULL`, asi
# que hay que darle una: se usa el sello de la calibracion embebida del ADR
# 0083, que es exactamente lo que corre el estudio real (0,80 · 0,69 · 0,56 ·
# 0,55 · 0,44) y deja la tasa implicita entre 0,439 y 0,80.
cfg_cm <- st$calc_muestra_aulas_config
if (is.null(cfg_cm$efectividad)) cfg_cm$efectividad <- list(fuente = "historico", tau_base = 1)
cfg_cm <- calc_muestra_aulas_sellar_rendimiento(cfg_cm)
frame_cm <- st$calc_muestra_aulas_frame
frame_cm$aula_frame <- .cm_aulas_efectividad_anotar(
  frame_cm$aula_frame, .cm_efectividad_calibracion(cfg_cm)
)
st$calc_muestra_aulas_config <- cfg_cm
st$calc_muestra_aulas_frame <- frame_cm

sel <- calc_muestra_aulas_seleccionar(frame_cm, cfg_cm)
mon <- monitoreo_aulas_from_calc(st$calc_muestra_estudio, sel, frame_cm, cfg_cm)

cfg <- st$monitoreo_config %||% list()
cfg$aulas_universitarias <- mon
cfg$monitoreo_profile <- list(family = "aulas_universitarias", variant = "multi_actor",
                              status = "active", route_selected = TRUE,
                              locked_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
st$monitoreo_config <- cfg
st$calc_muestra_seleccion <- sel
st$monitoreo_aulas_plan <- mon$plan
saveRDS(st, file.path(trabajo, "state.rds"))

dir.create(dirname(destino), recursive = TRUE, showWarnings = FALSE)
if (file.exists(destino)) unlink(destino)
# **La ruta se absolutiza ANTES del `setwd`.** Con un destino relativo, `zip`
# corre ya dentro de `trabajo` y lo resuelve contra ese directorio: falla con
# «Could not create output file» y el `cat` del final decia «escrito» igual.
destino <- file.path(normalizePath(dirname(destino), mustWork = TRUE), basename(destino))
antes <- setwd(trabajo)
codigo <- utils::zip(destino, list.files(".", recursive = TRUE, all.files = TRUE), flags = "-q -r")
setwd(antes)
if (!identical(as.integer(codigo), 0L) || !file.exists(destino)) {
  stop("no se pudo escribir el .pulso en ", destino, " (zip devolvio ", codigo, ")")
}

# El resumen es el gate: un plan sin banco o sin celdas en deficit produce un
# proyecto que abre pero no ensena nada, y eso hay que verlo aqui y no en la UI.
d <- monitoreo_aulas_dashboard(mon$plan, NULL, mon)
roles <- table(vapply(mon$plan, function(f) as.character(f$sample_role %||% ""), character(1)))
cat("plan:", length(mon$plan), "aulas\n")
for (nm in names(roles)) cat("  ", nm, ":", roles[[nm]], "\n")
pr <- vapply(d$avance_sexo_facultad %||% list(),
             function(c1) as.numeric(c1$prob_cierre %||% NA_real_), numeric(1))
cat("celdas de cuota:", length(d$quotas_sex_faculty),
    "· reserva dirigida:", length(d$reserva_dirigida),
    "· celdas con probabilidad de cierre:", sum(is.finite(pr)), "de", length(pr), "\n")
cat("escrito:", destino, "\n")
