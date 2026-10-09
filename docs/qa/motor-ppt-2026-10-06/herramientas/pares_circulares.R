# Pares de torta y dona (ADR 0093, N6): láminas 69 y 70 del recetario rehechas con graficar_pie (su espec) y los
# renderers nativos de lamina_circulares.R sobre el proyecto de referencia.
#
# Uso (desde la raíz del repo):
#   S=<carpeta> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_circulares.R   (escribe <carpeta>/n6/pie.pptx)
#   printf "recetario,motor,nombre\n69,1,t069\n70,2,d070\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R <carpeta>/n6/pie.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
r <- suppressMessages(load_pulso("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt/acrconta_mazo.pulso")); src <- suppressMessages(.graficos_processing_sources(r$session_id))
fq <- function(b, v) { x <- as.character(src$data_sources[[b]][[v]]); x <- x[!is.na(x) & x != ""]; n <- as.integer(table(factor(x, levels = c("1", "2")))); list(n = n, pct = n / length(x), N = length(x)) }
t1 <- fq("egresados", "p8"); m <- fq("estudiantes", "p7")
e69 <- attr(graficar_pie(data.frame(c = c("Sí cuenta con título universitario", "No cuenta con título universitario"), p = t1$pct, n = t1$n), "c", "p", var_n = "n", tipo_pie = "pie"), "pulso_espec")
e70 <- attr(graficar_pie(data.frame(c = c("Sí", "No"), p = m$pct, n = m$n), "c", "p", var_n = "n", tipo_pie = "donut"), "pulso_espec")
print(e69$cifras); print(e70$cifras)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
o <- .lam_laminas_torta(doc, e69, "Titulación del egresado", ante = "Gráfico de torta con leyenda de cifras", folio = 69, unidad_n = "egresados",
                        base = "Base: 178 egresados. Cada parte lleva su cifra, su rótulo y su conteo junto al gráfico")
o <- .lam_laminas_dona(o$doc, e70, "Conocimiento de la misión entre estudiantes", ante = "Gráfico de dona", folio = 70, unidad_n = "estudiantes",
                       rotulo_centro = "conoce la misión", base = "Base: 172 estudiantes")
OUT <- file.path(Sys.getenv("S", tempdir()), "n6", "pie.pptx"); dir.create(dirname(OUT), showWarnings = FALSE, recursive = TRUE)
print(o$doc, target = OUT); cat("OK\n")
