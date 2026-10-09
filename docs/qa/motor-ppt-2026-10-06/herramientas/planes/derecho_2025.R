# Prueba final (M9d): reconstruye con el motor láminas del informe de Psicología 2024
# (entregado a mano, gráficos nativos) desde sus bases limpias, por la ruta de la app:
# .sav limpio -> surveymonkey_leer() + surveymonkey_xlsform() (editor de formularios)
# -> normalize_data_for_xlsform() (importador .sav de Procesamiento) -> reporte_data().
# Presets, paleta y plantilla: los del proyecto de referencia acrconta_mazo (estilo de
# acreditación vigente). Sólo nombra variables; los datos de cliente quedan fuera del repo.
# Uso: SP=<carpeta con acrconta_mazo.pulso> W=<carpeta con canon/bases.rds> Rscript planes/derecho_2025.R
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
SL <- function(tipo, ...) { .id <<- .id + 1L; list(id = sprintf("der-%03d", .id), tipo = tipo, payload = list(...)) }
slides <- list(
  # Entregado lámina 22: perfil de egreso, 3 ítems de egresados con Top Two Box (escala «Totalmente de Acuerdo»)
  SL("p_slide_1_grafico", titulo = "PERFIL DE EGRESO",
     grafico = G("p_barras_multiapiladas", modo = "var", vars = list(egresados = list("egresados$p11_1", "egresados$p11_2", "egresados$p11_3"))),
     base = "Base: 314 egresados"),
  # Entregado lámina 23: canales de difusión, opción múltiple comparada entre 3 actores (intento con var_cruce)
  SL("p_slide_1_grafico", titulo = "CANALES DE DIFUSIÓN",
     grafico = G("p_barras_multiapiladas", modo = "var_cruce", vars = list(
       "¿A través de qué medios se ha enterado de la misión, visión y valores de la carrera?" =
         list("docentes$p6", "estudiantes$p5", "administrativos$p7")))),
  # Lo mismo por actor (lo que el motor sí sabe hacer: una base por gráfico)
  SL("p_slide_3_graficos_fila", titulo = "CANALES DE DIFUSIÓN POR ACTOR",
     izquierda = G("p_barras_agrupadas", var = "docentes$p6"), centro = G("p_barras_agrupadas", var = "estudiantes$p5"),
     derecha = G("p_barras_agrupadas", var = "administrativos$p7"))
)
plan <- .normalize_plan(list(slides = slides))
v <- .validar_plan_json(plan); if (!isTRUE(v$ok)) stop("plan inválido: ", paste(v$errors, collapse = "; "))
slide_reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
out <- file.path(W, "canon", "derecho_motor.pptx")
avisos <- character()
withCallingHandlers(
  graficos_job_worker_ppt(rp_data_path = dp, rp_inst_path = ip, plan = plan, presets = presets,
    paletas = cfg$paletas %||% list(), slide_registry = slide_reg, graficador_registry = .graf_names(),
    icon_registry = .graficos_icon_registry(sid, cfg), active_base = "estudiantes",
    template_pptx = normalizePath("api/inst/plantillas/plantilla_16_9.pptx"), template_id = NULL,
    auto_otros_slides = FALSE, result_path = out),
  warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
cat("OK", out, "\n"); if (length(avisos)) cat("avisos:\n", paste(" ", unique(avisos), collapse = "\n"), "\n")
