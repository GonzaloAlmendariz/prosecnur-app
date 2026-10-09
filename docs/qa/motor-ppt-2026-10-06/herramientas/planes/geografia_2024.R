# Prueba final (M9d): reconstruye con el motor láminas del informe de Psicología 2024
# (entregado a mano, gráficos nativos) desde sus bases limpias, por la ruta de la app:
# .sav limpio -> surveymonkey_leer() + surveymonkey_xlsform() (editor de formularios)
# -> normalize_data_for_xlsform() (importador .sav de Procesamiento) -> reporte_data().
# Presets, paleta y plantilla: los del proyecto de referencia acrconta_mazo (estilo de
# acreditación vigente). Sólo nombra variables; los datos de cliente quedan fuera del repo.
# Uso: SP=<carpeta con acrconta_mazo.pulso> W=<carpeta con canon/bases.rds> Rscript planes/geografia_2024.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
SP <- Sys.getenv("SP"); W <- Sys.getenv("W")
r <- load_pulso(file.path(SP, "acrconta_mazo.pulso")); sid <- r$session_id; s <- session_get(sid)
cfg0 <- s$graficos_config; cfg0$debug_ph <- FALSE; cfg <- .graficos_effective_config(sid, cfg0)
presets <- .enriquecer_presets(cfg0$presets, FALSE)
bases <- readRDS(file.path(W, "canon", "bases.rds"))
dp <- file.path(W, "canon", "data.rds"); ip <- file.path(W, "canon", "inst.rds")

G <- function(graficador, ...) list(graficador = graficador, args = list(...))
.id <- 0L
SL <- function(tipo, ...) { .id <<- .id + 1L; list(id = sprintf("geo-%03d", .id), tipo = tipo, payload = list(...)) }
slides <- list(
  # Entregado lámina 42: un ítem, cinco actores en barras apiladas 100 % (Likert 4 + SIN INF dentro de la base)
  SL("p_slide_1_grafico", titulo = "CUERPO ACADÉMICO",
     grafico = G("p_barras_multiapiladas", modo = "var_cruce", vars = list(
       "La carrera cuenta con un cuerpo académico suficiente" =
         list("administrativos$p9_1", "autoridades$p10_1", "docentes$p10_1", "egresados$p15_1", "estudiantes$p10_1"))),
     base = "Base: 39 estudiantes, 67 egresados, 18 docentes, 12 autoridades y 17 administrativos"),
  # Mismo ítem sólo con los actores cuya escala se redacta igual (sin el número final)
  SL("p_slide_1_grafico", titulo = "CUERPO ACADÉMICO (actores con la misma redacción de escala)",
     grafico = G("p_barras_multiapiladas", modo = "var_cruce", vars = list(
       "La carrera cuenta con un cuerpo académico suficiente" =
         list("administrativos$p9_1", "autoridades$p10_1", "docentes$p10_1", "estudiantes$p10_1"))),
     base = "Base: 39 estudiantes, 18 docentes, 12 autoridades y 17 administrativos"),
  # Respaldo: una apilada por actor (para leer las cifras aunque la comparación falle)
  SL("p_slide_4_graficos", titulo = "CUERPO ACADÉMICO POR ACTOR",
     superior_izquierda = G("p_barras_apiladas", var = "estudiantes$p10_1"), superior_derecha = G("p_barras_apiladas", var = "egresados$p15_1"),
     inferior_izquierda = G("p_barras_apiladas", var = "docentes$p10_1"), inferior_derecha = G("p_barras_apiladas", var = "administrativos$p9_1"))
)
plan <- .normalize_plan(list(slides = slides))
v <- .validar_plan_json(plan); if (!isTRUE(v$ok)) stop("plan inválido: ", paste(v$errors, collapse = "; "))
slide_reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
out <- file.path(W, "canon", "geografia_motor.pptx")
avisos <- character()
withCallingHandlers(
  graficos_job_worker_ppt(rp_data_path = dp, rp_inst_path = ip, plan = plan, presets = presets,
    paletas = cfg$paletas %||% list(), slide_registry = slide_reg, graficador_registry = .graf_names(),
    icon_registry = .graficos_icon_registry(sid, cfg), active_base = "estudiantes",
    template_pptx = normalizePath("api/inst/plantillas/plantilla_16_9.pptx"), template_id = NULL,
    auto_otros_slides = FALSE, result_path = out),
  warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
cat("OK", out, "\n"); if (length(avisos)) cat("avisos:\n", paste(" ", unique(avisos), collapse = "\n"), "\n")
