# Pares de categóricas (ADR 0093, N3): lámina 68 del recetario (nivel curricular en columnas) rehecha con
# preparar_categorica + .lam_laminas_categorica sobre el proyecto de referencia del catálogo.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/categoricas.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_categoricas.R
#   printf "recetario,motor,nombre\n68,1,c068\n73,2,c073\n74,3,d074\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R /ruta/categoricas.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
OUT <- Sys.getenv("OUT", file.path(tempdir(), "categoricas.pptx"))
SP <- normalizePath("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt")
r <- suppressMessages(load_pulso(file.path(SP, "acrconta_mazo.pulso"))); src <- suppressMessages(.graficos_processing_sources(r$session_id))
lc <- function(df) grep("^label", names(df))[1]
freq <- function(base, v) {
  ins <- src$inst_sources[[base]]; sv <- ins$survey; ch <- ins$choices
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]
  cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(src$data_sources[[base]][[v]]); d <- d[!is.na(d) & d != ""]
  n <- as.integer(table(factor(d, levels = cc$name)))
  list(labels = cc[[lc(ch)]], n = n, pct = n / length(d), valid = length(d))
}
f <- freq("estudiantes", "p6")
e <- preparar_categorica(f$labels, f$pct, .pulso_fmt_pct_unidades(.pulso_pct_unidades(f$pct, 0, "estandar"), 0), f$n)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
o <- .lam_laminas_categorica(doc, e, "Nivel curricular del estudiante", ante = "Barras categóricas", base = "Base: 172 estudiantes",
                             folio = 68, forma = "columnas", unidad_n = "estudiantes")
# 73: ranking en barras de una selección múltiple de OTRO estudio (ingeniería mecánica); los números son los
# impresos en el recetario (recetario_m3a.R:98-101).
lab73 <- c("Integración de herramientas digitales para diseño, simulación, software especializado, análisis de datos e inteligencia artificial",
           "Actualización del plan de estudios, modernización de cursos y ampliación de electivos según demandas profesionales",
           "Mayor práctica industrial en campo, talleres, laboratorios, fabricación y resolución de casos reales",
           "Profundización en rubros mecánicos de alta demanda: minería, energía, mantenimiento, plantas, maquinaria, diseño e hidráulica",
           "Mayor vinculación docente con la industria, actualización profesional y mejora de metodologías de enseñanza",
           "Orientación sobre perfiles profesionales, campos laborales, rubros de especialización y condiciones del mercado peruano",
           "Desarrollo de comunicación, liderazgo, trabajo interdisciplinario y habilidades blandas para contextos profesionales",
           "Fortalecimiento de gestión de proyectos, negocio, costos, finanzas y perfil gerencial del ingeniero mecánico",
           "Apoyo a la inserción laboral mediante prácticas, horarios compatibles, pasantías, convenios y asesoría profesional",
           "No sabe / Ninguna sugerencia")
pc73 <- c(29, 27, 26, 21, 15, 15, 15, 13, 9, 4)
e73 <- preparar_categorica(lab73, pc73 / 100, paste0(pc73, "%"))
o <- .lam_laminas_categorica(o$doc, e73, "Qué podría mejorar la carrera", ante = "Ranking en barras",
                             base = "Base: 131 egresados. La opción más marcada va en azul oscuro. «Otros» y «No sabe» van al final",
                             folio = 73, forma = "barras", encabezado = "% de encuestados que marcó cada opción")
# 74: dicotomía partida a todo el ancho (recetario_graficos2.R:20-25), egresados p11.
f74 <- freq("egresados", "p11")
e74 <- preparar_categorica(f74$labels, f74$pct, .pulso_fmt_pct_unidades(.pulso_pct_unidades(f74$pct, 0, "estandar"), 0), f74$n)
o <- .lam_laminas_dicotomia(o$doc, e74, "Situación laboral del egresado", ante = "Dicotómica", pregunta = "¿Está trabajando actualmente?",
                            publico = paste(f74$valid, "egresados"), base = paste("Base:", f74$valid, "egresados"), folio = 74)
print(o$doc, target = OUT); cat("OK\n")
