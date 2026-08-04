# Harness de render del GOAL loop del motor PPT (docs/qa/goal-loop-motor-ppt-2026-08-03.md).
# Renderiza un plan de control por las dos plantillas de produccion y deja
# los PPTX en L1_OUT para rasterizar con:
#   soffice --headless --convert-to pdf --outdir $OUT $OUT/<f>.pptx
#   pdftoppm -png -r 90 $OUT/<f>.pdf $OUT/<f>_s
# Uso: L1_OUT=/ruta/salida Rscript api/scripts/qa_motor_ppt_render.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
outdir <- Sys.getenv("L1_OUT")

df <- data.frame(
  p1 = sample(c("Alto", "Medio", "Bajo"), 60, replace = TRUE),
  region = sample(c("Docentes", "Estudiantes"), 60, replace = TRUE),
  stringsAsFactors = FALSE
)
attr(df$p1, "label") <- "Nivel de satisfacción general"
attr(df$region, "label") <- "Región"
inst <- list(
  survey = data.frame(
    name = c("p1", "region"),
    type = c("select_one lst_likert", "select_one lst_region"),
    list_name = c("lst_likert", "lst_region"),
    stringsAsFactors = FALSE
  ),
  choices = data.frame(
    list_name = c(rep("lst_likert", 3), rep("lst_region", 2)),
    name = c("Bajo", "Medio", "Alto", "Docentes", "Estudiantes"),
    label = c("Bajo", "Medio", "Alto", "Docentes", "Estudiantes"),
    stringsAsFactors = FALSE
  ),
  orders_list = NULL
)

g <- function() p_barras_agrupadas(var = "p1")

plan <- list(
  d01 = p_slide_portada(
    titulo = "Auditoría L1 del motor PPT",
    subtitulo = "Subtítulo de control",
    fecha = "Agosto 2026",
    subtexto = "SUBTEXTO-MARCADOR ▓▓▓ no debe pisar el logo"
  ),
  d02 = p_slide_1_grafico(g(), titulo = "Slide 1 gráfico",
    base = "Base: 60 casos", pie = "PIE-MARCADOR-DERECHA ▓▓▓"),
  d03 = p_slide_1_grafico_narrativo(g(), texto = "Texto narrativo de control",
    titulo = "Narrativo", base = "Base: 60", pie = "FOOTER-NARR ▓▓▓"),
  d04 = p_slide_grafico_texto_derecha(g(), texto = "Texto principal del panel derecho",
    titulo = "Gráfico + texto derecha", base = "Base: 60", pie = "FOOTER-TXR ▓▓▓"),
  d05 = p_slide_2_graficos_poblacion(g(), g(), titulo = "Población 2",
    texto = "Texto población", base = "BASE-POB2 ▓▓▓"),
  d06 = p_slide_5_graficos_poblacion(g(), g(), g(), g(), g(),
    titulo = "Población 5", pie = "PIE-POB5 ▓▓▓")
)

for (tpl in c("plantilla_16_9", "plantilla_acnur_16_9")) {
  out_ppt <- file.path(outdir, paste0("L1_", tpl, ".pptx"))
  set.seed(42)
  reporte_ppt_plan(
    data = df, instrumento = inst, plan = plan, presets = p_presets(),
    path_ppt = out_ppt,
    template_pptx = file.path("api/inst/plantillas", paste0(tpl, ".pptx")),
    mensajes_progreso = FALSE
  )
  cat("OK", out_ppt, "\n")
}
