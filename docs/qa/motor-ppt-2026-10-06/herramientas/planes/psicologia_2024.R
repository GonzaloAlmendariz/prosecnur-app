# Prueba final (M9d): reconstruye con el motor láminas del informe de Psicología 2024
# (entregado a mano, gráficos nativos) desde sus bases limpias, por la ruta de la app:
# .sav limpio -> surveymonkey_leer() + surveymonkey_xlsform() (editor de formularios)
# -> normalize_data_for_xlsform() (importador .sav de Procesamiento) -> reporte_data().
# Presets, paleta y plantilla: los del proyecto de referencia acrconta_mazo (estilo de
# acreditación vigente). Sólo nombra variables; los datos de cliente quedan fuera del repo.
# Uso: SP=<carpeta con acrconta_mazo.pulso> W=<carpeta con canon/bases.rds> Rscript planes/psicologia_2024.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
SP <- Sys.getenv("SP"); W <- Sys.getenv("W")
r <- load_pulso(file.path(SP, "acrconta_mazo.pulso")); sid <- r$session_id; s <- session_get(sid)
cfg0 <- s$graficos_config; cfg0$debug_ph <- FALSE; cfg <- .graficos_effective_config(sid, cfg0)
presets <- .enriquecer_presets(cfg0$presets, FALSE)
bases <- readRDS(file.path(W, "canon", "bases.rds"))
dp <- file.path(W, "canon", "data.rds"); ip <- file.path(W, "canon", "inst.rds")
saveRDS(lapply(bases, `[[`, "data"), dp); saveRDS(lapply(bases, `[[`, "inst"), ip)

G <- function(graficador, ...) list(graficador = graficador, args = list(...))
.id <- 0L
SL <- function(tipo, ...) { .id <<- .id + 1L; list(id = sprintf("psi-%03d", .id), tipo = tipo, payload = list(...)) }
slides <- list(
  # Entregado lámina 16: dos tortas Sí/No de docentes (base 92)
  SL("p_slide_2_graficos", titulo = "ESTÁNDAR 1: ARTICULACIÓN DE OBJETIVOS DE LA CARRERA",
     izquierda = G("p_pie", var = "docentes$p1"), derecha = G("p_pie", var = "docentes$p2"),
     base = "Base: 92 docentes de la carrera de Psicología"),
  # Lámina 17: misión y visión, Likert de 4 con Top Two Box (base filtrada 84)
  SL("p_slide_1_grafico", titulo = "ESTÁNDAR 1: ARTICULACIÓN DE OBJETIVOS DE LA CARRERA",
     grafico = G("p_barras_multiapiladas", modo = "var", vars = list(docentes = list("docentes$p4", "docentes$p3"))),
     base = "Base: 84 docentes de la carrera de Psicología"),
  # Láminas 21-22: movilidad de estudiantes (torta Sí/No + apilada de quienes participaron)
  SL("p_slide_2_graficos", titulo = "ESTÁNDAR 13: MOVILIDAD",
     izquierda = G("p_pie", var = "estudiantes$p18"), derecha = G("p_barras_apiladas", var = "estudiantes$p19"),
     base = "Base: 201 estudiantes de la carrera de Psicología"),
  # Láminas 23-24: movilidad de docentes
  SL("p_slide_2_graficos", titulo = "ESTÁNDAR 13: MOVILIDAD",
     izquierda = G("p_pie", var = "docentes$p8"), derecha = G("p_barras_apiladas", var = "docentes$p9"),
     base = "Base: 92 docentes de la carrera de Psicología"),
  # Lámina 41: bienestar, un servicio por bloque y un actor por barra (5 categorías con «No he usado»)
  SL("p_slide_1_grafico", titulo = "ESTÁNDAR 27: BIENESTAR",
     grafico = G("p_barras_multiapiladas", modo = "var_cruce", vars = list(
       "Servicios de comedor y espacios para consumos de alimentos de la universidad" =
         list("estudiantes$p27", "docentes$p14", "administrativos$p1"),
       "Servicio médico de la universidad" = list("estudiantes$p28", "docentes$p15", "administrativos$p2"))),
     base = "Base: 201 estudiantes, 92 docentes y 25 administrativos")
)
plan <- .normalize_plan(list(slides = slides))
v <- .validar_plan_json(plan); if (!isTRUE(v$ok)) stop("plan inválido: ", paste(v$errors, collapse = "; "))
slide_reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
out <- file.path(W, "canon", "psicologia_motor.pptx")
avisos <- character()
withCallingHandlers(
  graficos_job_worker_ppt(rp_data_path = dp, rp_inst_path = ip, plan = plan, presets = presets,
    paletas = cfg$paletas %||% list(), slide_registry = slide_reg, graficador_registry = .graf_names(),
    icon_registry = .graficos_icon_registry(sid, cfg), active_base = "estudiantes",
    template_pptx = normalizePath("api/inst/plantillas/plantilla_16_9.pptx"), template_id = NULL,
    auto_otros_slides = FALSE, result_path = out),
  warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
cat("OK", out, "\n"); if (length(avisos)) cat("avisos:\n", paste(" ", unique(avisos), collapse = "\n"), "\n")
