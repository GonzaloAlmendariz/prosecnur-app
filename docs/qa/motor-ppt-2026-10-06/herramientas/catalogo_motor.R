# Catalogo del motor PPT: las 32 laminas y los 24 graficadores, generados con
# el motor real (mismo camino que POST /api/graficos/ppt, en proceso).
#
# Uso (desde la raiz del repo):
#   MODE=single Rscript tmp/motor-ppt-diag-2026-10-06/catalogo_ppt/catalogo_motor.R  # cada lamina sola
#   MODE=deck   Rscript ...                                                           # mazo completo
#   MODE=compat Rscript ...                                                           # matriz graficador x disposicion
#
# Datos: copia de api/inst/reference_projects/acrconta_mazo/acrconta_mazo.pulso.
# Aumentos SOLO en memoria/tmp (nada vuelve al .pulso ni al repo):
#  - dimensiones (r100_/sub_/idx_) calculadas sobre estudiantes p22_1..p22_11
#    para la familia p_dim_* (equivale a lo que haria Analitica);
#  - contexto territorial para p_mapa_cobertura_territorial tomado del plan
#    sugerido ACNUR con la semilla territorial de los tests (fixture sintetico,
#    la geometria es la del paquete).
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))

SP <- normalizePath("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt")
MODE <- Sys.getenv("MODE", "single")
ONLY <- suppressWarnings(as.integer(strsplit(Sys.getenv("ONLY", ""), ",")[[1]]))
TPL <- normalizePath("api/inst/plantillas/plantilla_16_9.pptx")

r <- load_pulso(file.path(SP, "acrconta_mazo.pulso"))
sid <- r$session_id
s <- session_get(sid)
cfg0 <- s$graficos_config
cfg0$debug_ph <- FALSE
cfg <- .graficos_effective_config(sid, cfg0)
presets <- .enriquecer_presets(cfg0$presets, FALSE)
# ADR 0072: la tabla del radar sale como tabla nativa cuando el preset lo
# declara (el proyecto de referencia no lo trae). Se activa como lo haria el
# analista en Configuracion global > Estilo > Radar.
if (Sys.getenv("TABLA_NATIVA", "1") == "1") {
  if (is.list(presets$radar_tabla$args)) presets$radar_tabla$args$tabla_nativa <- TRUE else presets$radar_tabla$tabla_nativa <- TRUE
}
src <- .graficos_processing_sources(sid)
icon_reg <- .graficos_icon_registry(sid, cfg)
active <- .graficos_active_base_name(sid)
# ACTIVE=real usa la base activa como el job (califica `objetivo` con prefijo y
# rompe la familia p_dim_*); por defecto se pasa NULL porque todas las refs del
# catalogo ya van calificadas con `base$`.
ACTIVE <- if (identical(Sys.getenv("ACTIVE"), "real")) active else NULL
# El proyecto de referencia no trae PNG de iconos (el motor avisa y usa el
# integrado); se registra uno de la casa como si el analista lo hubiera subido.
icon_reg[["catalogo-ico"]] <- normalizePath("docs/qa/motor-ppt-2026-10-06/herramientas/iconos/navy/graduation-cap.png")
ICON <- "catalogo-ico"

# ---- Dimensiones sobre estudiantes (competencias p22_1..p22_11) -------------
est <- src$data_sources$estudiantes
inst_est <- src$inst_sources$estudiantes
vars_comp <- paste0("p22_", 1:11)
d1 <- reporte_dimensiones(
  data = est, instrumento = inst_est, vars = vars_comp,
  codigos_missing = "5", prefijo = "r100_", reemplazar = FALSE, verbose = FALSE
)
d2 <- reporte_dimensiones_indices(
  data = d1,
  subindices = list(
    subindice("tec", "Competencias técnicas", paste0("r100_p22_", 1:5)),
    subindice("neg", "Visión empresarial", "r100_p22_6"),
    subindice("tra", "Competencias transversales", paste0("r100_p22_", 7:11))
  ),
  indices = list(indice("comp", "Índice de competencias", c("tec", "neg", "tra")))
)
for (a in setdiff(names(attributes(est)), c("names", "row.names"))) {
  if (is.null(attr(d2, a, exact = TRUE))) attr(d2, a) <- attr(est, a, exact = TRUE)
}
src$data_sources$estudiantes <- d2

# ---- Edad numerica sin hermano _recod ---------------------------------------
# `.resolve_ref()` redirige SIEMPRE `x` -> `x_recod` cuando existe
# (`.reporte_plan_resolve_recod_var`), asi que p_numerico/p_boxplot/p_media_rango
# sobre p3/p4 promedian los CODIGOS del recode (1..4), no la edad. Todas las
# numericas del proyecto tienen hermano _recod. Para que el catalogo muestre
# el graficador con la edad real se agrega una copia `edad` (sin _recod).
for (b in c("estudiantes", "docentes", "egresados")) {
  vnum <- if (b == "estudiantes") "p3" else "p4"
  dd <- src$data_sources[[b]]
  dd$edad <- dd[[vnum]]
  attr(dd$edad, "label") <- "Edad (años)"
  src$data_sources[[b]] <- dd
  ii <- src$inst_sources[[b]]
  row <- ii$survey[ii$survey$name == vnum, , drop = FALSE]
  row$name <- "edad"; if ("label" %in% names(row)) row$label <- "Edad (años)"
  ii$survey <- rbind(ii$survey, row)
  src$inst_sources[[b]] <- ii
}

# ---- Contexto territorial (fixture de los tests ACNUR) ----------------------
mapa_contexto <- tryCatch({
  sid2 <- session_create(); estudio_ensure(sid2)
  survey <- data.frame(type = c("select_one district_list", "select_one yesno"),
                       name = c("Core/M5_district", "p1"), label = c("Distrito", "Acceso"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("district_list", 3), "yesno", "yesno"),
                        name = c("150132", "150103", "150117", "yes", "no"),
                        label = c("San Juan de Lurigancho", "Ate", "Los Olivos", "Si", "No"),
                        stringsAsFactors = FALSE)
  s2 <- session_get(sid2)
  s2$estudio$bases <- list(default = list(nombre = "default", source_kind = "kobo"))
  s2$rp_inst <- list(survey = survey, choices = choices)
  s2$rp_data <- data.frame(`Core/M5_district` = c("150132", "150103", "150117"),
                           p1 = c("yes", "no", "yes"), check.names = FALSE, stringsAsFactors = FALSE)
  s2$hojas_ruta_ok <- TRUE
  s2$hojas_ruta_workspace_outputs <- list(sample = list(blocks = list(list(ubigeo = "150132", zona = "Z01", manzanas = 12))))
  s2$monitoreo_snapshot <- list(territorial_reports = list(
    response_audit = list(list(ubigeo = "150132", zona = "Z01", advance_valid = TRUE)),
    route_blocks = list(list(ubigeo = "150132", zona = "Z01", total_manzanas = 12))))
  .session_env[[sid2]] <- s2
  sug <- .graficos_suggested_plan(sid2, config = list(profile_id = "acnur_kobo_cruncher_plus",
    acnur_mode = "territorial", include_coverage_maps = TRUE, comparison_mode = "paired_district"))
  m <- Filter(function(x) identical(((x$payload %||% list())$grafico %||% list())$graficador, "p_mapa_cobertura_territorial"), sug$plan$slides)
  session_delete(sid2)
  if (!length(m)) NULL else m[[1]]$payload$grafico$args
}, error = function(e) { message("mapa contexto: ", conditionMessage(e)); NULL })

# ---- Constructores del plan JSON -------------------------------------------
G <- function(graficador, ...) list(graficador = graficador, args = list(...))
.id <- 0L
SL <- function(tipo, ...) { .id <<- .id + 1L; list(id = sprintf("cat-%03d", .id), tipo = tipo, payload = list(...)) }

# Graficos simples y validos en paneles
g_sexo   <- function(t = "Género") G("p_barras_agrupadas", var = "estudiantes$p5", overrides = list(titulo = t))
g_ciclo  <- function(t = "Ciclo") G("p_barras_agrupadas", var = "estudiantes$p6", overrides = list(titulo = t))
g_edad   <- function(t = "Rango de edad") G("p_barras_agrupadas", var = "estudiantes$p3_recod", overrides = list(titulo = t))
g_eg_ti  <- function(t = "Título universitario") G("p_barras_agrupadas", var = "egresados$p8", overrides = list(titulo = t))
g_eg_sue <- function(t = "Sueldo mensual") G("p_barras_agrupadas", var = "egresados$p13", overrides = list(titulo = t))
g_doc_gr <- function(t = "Grado alcanzado") G("p_barras_agrupadas", var = "docentes$p6", overrides = list(titulo = t))
g_pie_sx <- function(t = "Género") G("p_pie", var = "estudiantes$p5", overrides = list(titulo = t))
g_don_mi <- function(t = "Conoce la misión") G("p_donut", var = "docentes$p9", overrides = list(titulo = t))
g_cifra  <- function(t = "Edad promedio") G("p_numerico", var = "estudiantes$edad", metrica = "mean", titulo = t)
g_cifra2 <- function(t = "Edad promedio docente") G("p_numerico", var = "docentes$edad", metrica = "mean", titulo = t)
g_cifra3 <- function(t = "Edad promedio egresado") G("p_numerico", var = "egresados$edad", metrica = "mean", titulo = t)
g_eg_tr  <- function(t = "Trabaja actualmente") G("p_donut", var = "egresados$p11", overrides = list(titulo = t))
g_cat_doc <- function(t = "Grado alcanzado (docentes)") G("p_barras_categoricas", var = "docentes$p6", overrides = list(titulo = t))
g_ap     <- function(v = "estudiantes$p16_6", t = NULL) G("p_barras_apiladas", var = v, overrides = list(titulo = t))
g_cat    <- function(t = "Ciclo") G("p_barras_categoricas", var = "estudiantes$p6", overrides = list(titulo = t))

TXT <- "Texto de ejemplo de la lámina: resume el hallazgo principal y orienta la lectura del gráfico."
BASE_EST <- "Base: estudiantes de Ciencias Contables PUCP."

# ---- Parte 1: los 32 tipos de lamina ---------------------------------------
parte1 <- list(
  SL("p_slide_seccion", titulo = "TIPOS DE LÁMINA", subtitulo = "Los 32 tipos del motor, en orden de registro"),
  SL("p_slide_portada", titulo = "CATÁLOGO DEL MOTOR PPT", subtitulo = "Láminas y gráficos (p_slide_portada)",
     fecha = "Octubre 2026", subtexto = "Datos: proyecto de referencia acrconta_mazo"),
  SL("p_slide_indice", titulo = "ÍNDICE (p_slide_indice)",
     secciones = "Perfil del encuestado\nMisión y propósitos\nDocentes\nPlan de estudios\nCompetencias del perfil de egreso"),
  SL("p_slide_top_two_box", titulo = "TOP TWO BOX (p_slide_top_two_box)"),
  SL("p_slide_redondeo", titulo = "CÓMO SE REDONDEAN LAS CIFRAS (p_slide_redondeo)"),
  SL("p_slide_seccion", titulo = "SECCIÓN (p_slide_seccion)", subtitulo = "Subtítulo de la sección"),
  SL("p_slide_objetivo_icono", titulo = "OBJETIVO",
     texto = "Lámina p_slide_objetivo_icono. Conocer la percepción de docentes, estudiantes, egresados y administrativos sobre el servicio educativo de la Facultad de Ciencias Contables.",
     icono = ICON),
  SL("p_slide_texto", titulo = "TEXTO (p_slide_texto)",
     bullets = c("Primer punto del texto corrido.", "Segundo punto con un hallazgo.", "Tercer punto con la recomendación.")),
  SL("p_slide_tabla_tecnica", titulo = "FICHA TÉCNICA (p_slide_tabla_tecnica)",
     filas = "Universo: Docentes, estudiantes, egresados y administrativos\nTécnica: Encuesta online autoadministrada\nMuestra: 52 docentes, 172 estudiantes, 178 egresados, 15 administrativos\nTrabajo de campo: 2026"),
  SL("p_slide_1_grafico", titulo = "1 GRÁFICO (p_slide_1_grafico)", grafico = g_ap(), base = BASE_EST),
  SL("p_slide_1_grafico_narrativo", titulo = "1 GRÁFICO NARRATIVO (p_slide_1_grafico_narrativo)", grafico = g_ap(), texto = TXT),
  SL("p_slide_grafico_texto_derecha", titulo = "GRÁFICO + TEXTO DERECHA (p_slide_grafico_texto_derecha)", grafico = g_ciclo(), texto = TXT),
  SL("p_slide_grafico_texto_izquierda", titulo = "GRÁFICO + TEXTO IZQUIERDA (p_slide_grafico_texto_izquierda)", grafico = g_ciclo(), texto = TXT),
  SL("p_slide_2_graficos", titulo = "2 GRÁFICOS (p_slide_2_graficos)", izquierda = g_sexo(), derecha = g_ciclo()),
  SL("p_slide_2_graficos_narrativo", titulo = "2 GRÁFICOS NARRATIVO (p_slide_2_graficos_narrativo)", izquierda = g_sexo(), derecha = g_ciclo(), texto = TXT),
  SL("p_slide_2_graficos_texto_izquierda", titulo = "2 GRÁFICOS + TEXTO IZQUIERDA (p_slide_2_graficos_texto_izquierda)", grafico_1 = g_sexo(), grafico_2 = g_edad(), texto = TXT),
  SL("p_slide_2_graficos_texto_derecha", titulo = "2 GRÁFICOS + TEXTO DERECHA (p_slide_2_graficos_texto_derecha)", grafico_1 = g_sexo(), grafico_2 = g_edad(), texto = TXT),
  SL("p_slide_4_graficos", titulo = "4 GRÁFICOS (p_slide_4_graficos)", superior_izquierda = g_sexo(), superior_derecha = g_ciclo(),
     inferior_izquierda = g_edad(), inferior_derecha = g_eg_ti()),
  SL("p_slide_2_graficos_poblacion", titulo = "2 GRÁFICOS POBLACIÓN (p_slide_2_graficos_poblacion)", izquierda = g_pie_sx(), derecha = g_edad(), icono = ICON),
  SL("p_slide_3_graficos_poblacion_tira", titulo = "3 GRÁFICOS POBLACIÓN TIRA (p_slide_3_graficos_poblacion_tira)",
     superior = g_sexo(), medio = g_edad(), inferior = g_ciclo(), icono = ICON),
  SL("p_slide_3_graficos_poblacion_corona", titulo = "3 GRÁFICOS POBLACIÓN CORONA (p_slide_3_graficos_poblacion_corona)",
     superior_izquierda = g_pie_sx(), superior_derecha = g_don_mi(), inferior = g_ciclo(), icono = ICON),
  SL("p_slide_3_graficos_poblacion_cifras", titulo = "3 GRÁFICOS POBLACIÓN CIFRAS (p_slide_3_graficos_poblacion_cifras)",
     superior_izquierda = g_sexo(), derecha = g_ciclo(), cifra_superior = g_cifra(), inferior_izquierda = g_edad(),
     cifra_inferior = g_cifra3(), icono = ICON),
  SL("p_slide_cifras_y_graficos", titulo = "CIFRAS Y GRÁFICOS (p_slide_cifras_y_graficos)",
     cifra_izquierda = g_cifra("Estudiantes"), cifra_centro = g_cifra2("Docentes"), cifra_derecha = g_cifra3("Egresados"),
     grafico_izquierda = g_sexo(), grafico_derecha = g_ciclo()),
  SL("p_slide_3_graficos_2mas1", titulo = "3 GRÁFICOS 2+1 (p_slide_3_graficos_2mas1)",
     superior_izquierda = g_sexo(), inferior_izquierda = g_edad(), derecha = g_ciclo()),
  SL("p_slide_3_graficos_1mas2", titulo = "3 GRÁFICOS 1+2 (p_slide_3_graficos_1mas2)",
     izquierda = g_ciclo(), superior_derecha = g_sexo(), inferior_derecha = g_edad()),
  SL("p_slide_3_graficos_fila", titulo = "3 GRÁFICOS EN FILA (p_slide_3_graficos_fila)",
     izquierda = g_pie_sx(), centro = g_don_mi(), derecha = G("p_donut", var = "egresados$p8", overrides = list(titulo = "Titulado"))),
  SL("p_slide_3_graficos_1arriba", titulo = "3 GRÁFICOS 1 ARRIBA (p_slide_3_graficos_1arriba)",
     superior = g_cat(), inferior_izquierda = g_sexo(), inferior_derecha = g_edad()),
  SL("p_slide_2_graficos_vertical", titulo = "2 GRÁFICOS VERTICAL (p_slide_2_graficos_vertical)",
     superior = g_cat(), inferior = g_cat_doc()),
  SL("p_slide_2_graficos_asimetrico", titulo = "2 GRÁFICOS ASIMÉTRICO (p_slide_2_graficos_asimetrico)",
     principal = g_ciclo(), apoyo = g_pie_sx()),
  SL("p_slide_3_graficos_poblacion", titulo = "3 GRÁFICOS POBLACIÓN (p_slide_3_graficos_poblacion)",
     superior_izquierda = g_sexo(), inferior_izquierda = g_edad(), derecha = g_ciclo(), icono = ICON),
  SL("p_slide_4_graficos_poblacion", titulo = "4 GRÁFICOS POBLACIÓN (p_slide_4_graficos_poblacion)",
     superior_izquierda = g_sexo(), superior_derecha = g_ciclo(), inferior_izquierda = g_edad(), inferior_derecha = g_eg_ti(), icono = ICON),
  SL("p_slide_5_graficos_poblacion", titulo = "5 GRÁFICOS POBLACIÓN (p_slide_5_graficos_poblacion)",
     grafico_superior_1 = g_sexo(), grafico_superior_2 = g_ciclo(), grafico_superior_3 = g_don_mi(),
     grafico_inferior_1 = g_eg_ti(), grafico_inferior_2 = g_eg_tr(), icono = ICON),
  SL("p_slide_6_graficos_poblacion", titulo = "6 GRÁFICOS POBLACIÓN (p_slide_6_graficos_poblacion)",
     grafico_superior_1 = g_sexo(), grafico_superior_2 = g_ciclo(), grafico_superior_3 = g_don_mi(),
     grafico_inferior_1 = g_eg_ti(), grafico_inferior_2 = g_eg_tr(), grafico_inferior_3 = g_doc_gr(), icono = ICON)
)

# ---- Parte 2: los 24 graficadores ------------------------------------------
comp <- function(i) c(sprintf("docentes$p30_%d", i), sprintf("estudiantes$p22_%d", i), sprintf("egresados$p28_%d", i))
comp_names <- c("Estados Financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
comp_names_all <- c(comp_names, "Aprendizaje autónomo", "Comunicación eficaz", "Trabajo en equipo", "Razonamiento matemático", "Ética y ciudadanía")
vars_pub <- setNames(lapply(1:6, comp), comp_names)

grafs <- list(
  p_barras_agrupadas = list(n = "Barras agrupadas", g = G("p_barras_agrupadas", var = "estudiantes$p6", cruces = "estudiantes$p5")),
  p_barras_categoricas = list(n = "Barras categóricas", g = G("p_barras_categoricas", var = "estudiantes$p6")),
  p_barras_apiladas = list(n = "Barras apiladas", g = G("p_barras_apiladas", var = "estudiantes$p16_6")),
  p_barras_multiapiladas = list(n = "Barras multiapiladas", g = G("p_barras_multiapiladas", modo = "var",
      vars = list(competencias = as.list(paste0("docentes$p30_", 1:11))))),
  p_nube_palabras = list(n = "Nube de palabras", g = G("p_nube_palabras", var = "docentes$p7_other", parent_var = "docentes$p7")),
  p_mapa_cobertura_territorial = list(n = "Mapa de cobertura territorial", g = if (!is.null(mapa_contexto))
      do.call(G, c(list("p_mapa_cobertura_territorial"), mapa_contexto)) else NULL),
  p_pie = list(n = "Pie", g = G("p_pie", var = "estudiantes$p6")),
  p_donut = list(n = "Donut", g = G("p_donut", var = "estudiantes$p3_recod")),
  p_numerico = list(n = "Numérico", g = G("p_numerico", var = "estudiantes$edad", metrica = "mean", cruce = "estudiantes$p6")),
  p_histograma = list(n = "Histograma", g = G("p_histograma", var = "estudiantes$edad")),
  p_boxplot = list(n = "Boxplot", g = G("p_boxplot", var = "estudiantes$edad", cruce = "estudiantes$p6")),
  p_media_rango = list(n = "Media y rango", g = G("p_media_rango", var = "estudiantes$edad", cruce = "estudiantes$p6")),
  p_barras_divergentes = list(n = "Barras divergentes", g = G("p_barras_divergentes",
      vars = as.list(paste0("estudiantes$p16_", 1:7)), n_negativas = 2, excluir_opciones = "SIN INF")),
  p_puntos_comparativos = list(n = "Puntos comparativos", g = G("p_puntos_comparativos",
      var = "estudiantes$p16_2", cruces = "estudiantes$p6", corte = "3,4")),
  p_dumbbell = list(n = "Dumbbell", g = G("p_dumbbell",
      vars = setNames(lapply(1:6, function(i) c(sprintf("docentes$p30_%d", i), sprintf("estudiantes$p22_%d", i))), comp_names),
      corte = "3,4")),
  p_lollipop = list(n = "Lollipop", g = G("p_lollipop", var = "estudiantes$p6")),
  p_serie_temporal = list(n = "Serie temporal", g = G("p_serie_temporal", vars = vars_pub, corte = "3,4")),
  p_radar = list(n = "Radar", g = G("p_radar", modo = "publicos", vars = vars_pub, corte = "3,4", mostrar_tabla = TRUE)),
  p_tabla = list(n = "Tabla", g = G("p_tabla", modo = "box", vars = setNames(as.list(paste0("estudiantes$p22_", 1:11)), comp_names_all),
      box_labels = c("De acuerdo", "En desacuerdo"))),
  p_dim_radar = list(n = "Radar de dimensiones", g = G("p_dim_radar", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$p5")),
  p_dim_heatmap = list(n = "Heatmap de dimensiones", g = G("p_dim_heatmap", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$p6")),
  p_dim_comparativo_radarbar = list(n = "Comparativo de dimensiones", g = G("p_dim_comparativo_radarbar", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$p5")),
  p_dim_foda = list(n = "FODA de dimensiones", g = G("p_dim_foda", nivel = "subindices", objetivo = "idx_comp", source = "estudiantes")),
  p_dim_heatmap_criterios = list(n = "Heatmap de criterios", g = G("p_dim_heatmap_criterios", config_criterios = list(
      list(id = "tec", titulo = "Técnicas", vars = as.list(paste0("r100_p22_", 1:5))),
      list(id = "neg", titulo = "Visión empresarial", vars = list("r100_p22_6")),
      list(id = "tra", titulo = "Transversales", vars = as.list(paste0("r100_p22_", 7:11)))), source = "estudiantes"))
)
stopifnot(setequal(names(grafs), .graf_names()))
graf_title <- function(k) sprintf("%s (%s)", grafs[[k]]$n, k)

REQ <- c(p_mapa_cobertura_territorial = "Requiere contexto territorial (zonas con anillos de coordenadas, límites distritales) que se arma desde Hojas de ruta y Monitoreo territorial.")
parte2_slide <- function(k) {
  g <- grafs[[k]]$g
  if (is.null(g)) return(SL("p_slide_texto", titulo = graf_title(k), texto = REQ[[k]] %||% "No disponible."))
  SL("p_slide_1_grafico", titulo = graf_title(k), grafico = g)
}

# ---- Render por el camino del job -------------------------------------------
slide_reg <- setNames(lapply(.slide_names(), function(nm) list(grafs = setdiff(.slide_slots(nm), "icono"))), .slide_names())
dp <- file.path(SP, "data.rds"); ip <- file.path(SP, "inst.rds")
saveRDS(src$data_sources, dp); saveRDS(src$inst_sources, ip)

render <- function(slides, out) {
  plan <- .normalize_plan(list(slides = slides))
  v <- .validar_plan_json(plan)
  if (!isTRUE(v$ok)) stop("plan invalido: ", paste(v$errors, collapse = "; "))
  graficos_job_worker_ppt(rp_data_path = dp, rp_inst_path = ip, plan = plan, presets = presets,
    paletas = cfg$paletas %||% list(), slide_registry = slide_reg, graficador_registry = .graf_names(),
    icon_registry = icon_reg, active_base = ACTIVE, template_pptx = TPL, template_id = NULL,
    auto_otros_slides = FALSE, result_path = out)
}
try_render <- function(slides, out) {
  warns <- character(); msgs <- character()
  res <- withCallingHandlers(
    tryCatch({ render(slides, out); "OK" }, error = function(e) paste("ERROR:", conditionMessage(e))),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") },
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(status = res, warnings = unique(warns), messages = unique(msgs))
}

parte2 <- c(list(SL("p_slide_seccion", titulo = "TIPOS DE GRÁFICO", subtitulo = "Los 24 graficadores del motor")),
            lapply(names(grafs), parte2_slide))
deck <- c(parte1, parte2)

if (MODE == "single") {
  dir.create(file.path(SP, "single"), showWarnings = FALSE)
  for (i in if (length(ONLY)) ONLY else seq_along(deck)) {
    sl <- deck[[i]]
    lab <- sl$payload$titulo
    rr <- try_render(list(sl), file.path(SP, "single", sprintf("%03d.pptx", i)))
    cat(sprintf("[%03d] %s | %s | %s\n", i, sl$tipo, lab, rr$status))
    if (length(rr$warnings)) cat("   W:", substr(paste(rr$warnings, collapse = " || "), 1, 400), "\n")
    pm <- grep("PULSO|aviso|degrad|Sin datos", rr$messages, value = TRUE, ignore.case = TRUE)
    if (length(pm)) cat("   M:", substr(paste(pm, collapse = " || "), 1, 400), "\n")
  }
}

if (MODE == "deck") {
  rr <- try_render(deck, file.path(SP, "catalogo-motor-raw.pptx"))
  cat("DECK:", rr$status, " slides:", length(deck), "\n")
  if (length(rr$warnings)) cat("W:", paste(rr$warnings, collapse = "\n"), "\n")
}

if (MODE == "compat") {
  dir.create(file.path(SP, "compat"), showWarnings = FALSE)
  fam <- list(
    p_slide_1_grafico = function(g) SL("p_slide_1_grafico", titulo = "t", grafico = g),
    p_slide_1_grafico_narrativo = function(g) SL("p_slide_1_grafico_narrativo", titulo = "t", grafico = g, texto = TXT),
    p_slide_2_graficos = function(g) SL("p_slide_2_graficos", titulo = "t", izquierda = g, derecha = g_sexo()),
    p_slide_3_graficos_fila = function(g) SL("p_slide_3_graficos_fila", titulo = "t", izquierda = g, centro = g_sexo(), derecha = g_edad()),
    p_slide_4_graficos = function(g) SL("p_slide_4_graficos", titulo = "t", superior_izquierda = g, superior_derecha = g_sexo(),
                                        inferior_izquierda = g_edad(), inferior_derecha = g_ciclo()),
    p_slide_4_graficos_poblacion = function(g) SL("p_slide_4_graficos_poblacion", titulo = "t", superior_izquierda = g,
                                                  superior_derecha = g_sexo(), inferior_izquierda = g_edad(), inferior_derecha = g_ciclo(), icono = ICON)
  )
  # Linea base: la lamina con los 3 relleno simples, para restar sus avisos.
  base_w <- lapply(names(fam), function(f) try_render(list(fam[[f]](g_ciclo())), file.path(SP, "compat", paste0("base_", f, ".pptx")))$warnings)
  names(base_w) <- names(fam)
  rows <- list(); detail <- list()
  for (k in names(grafs)) {
    g <- grafs[[k]]$g
    row <- c(graficador = k)
    for (f in names(fam)) {
      if (is.null(g)) { row[[f]] <- "no_renderizable"; next }
      out <- file.path(SP, "compat", sprintf("%s__%s.pptx", k, f))
      rr <- try_render(list(fam[[f]](g)), out)
      w <- setdiff(rr$warnings, base_w[[f]])
      pm <- grep("PULSO-AVISO|degrad|Sin datos|no cabe|recort|tabla", rr$messages, value = TRUE, ignore.case = TRUE)
      n_tbl <- if (file.exists(out)) {
        xml <- paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
        lengths(regmatches(xml, gregexpr("<a:tbl>", xml, fixed = TRUE)))
      } else NA_integer_
      if (k %in% c("p_radar", "p_tabla") && !startsWith(rr$status, "ERROR") && identical(n_tbl, 0L)) {
        pm <- c(pm, "tabla NO nativa (dibujada dentro del canvas)")
      }
      st <- if (startsWith(rr$status, "ERROR")) rr$status else if (length(w) || length(pm)) {
        msgs_all <- c(pm, w)
        tag <- vapply(msgs_all, function(m) {
          if (grepl("NO nativa", m)) "tabla del radar NO nativa (sale dibujada en el canvas)"
          else if (grepl("top2box", m)) "aviso top2box sin categorias declaradas (preset; igual en toda lamina)"
          else if (grepl("proporcion", m)) "aviso escala del radar 0-1 leida como % (igual en toda lamina)"
          else if (grepl("PostScript font", m)) "fuente Arial ausente en PostScript (entorno local)"
          else gsub("\\s+", " ", substr(m, 1, 160))
        }, character(1))
        paste("DEGRADADO:", paste(unique(tag), collapse = " ; "))
      } else "OK"
      row[[f]] <- gsub("[\r\n]+", " ", st)
      cat(k, f, "->", substr(row[[f]], 1, 200), "\n")
    }
    rows[[k]] <- row
  }
  df <- as.data.frame(do.call(rbind, rows), stringsAsFactors = FALSE)
  utils::write.csv(df, file.path(SP, "compatibilidad.csv"), row.names = FALSE, fileEncoding = "UTF-8")
}
