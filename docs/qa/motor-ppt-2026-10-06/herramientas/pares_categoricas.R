# Pares de categóricas (ADR 0093, N3): lámina 68 del recetario (nivel curricular en columnas) rehecha con
# preparar_categorica + .lam_laminas_categorica sobre el proyecto de referencia del catálogo.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/categoricas.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_categoricas.R
#   printf "recetario,motor,nombre\n68,1,c068\n" > mapa.csv
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
  list(labels = cc[[lc(ch)]], n = n, pct = n / length(d))
}
f <- freq("estudiantes", "p6")
e <- preparar_categorica(f$labels, f$pct, .pulso_fmt_pct_unidades(.pulso_pct_unidades(f$pct, 0, "estandar"), 0), f$n)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
o <- .lam_laminas_categorica(doc, e, "Nivel curricular del estudiante", ante = "Barras categóricas", base = "Base: 172 estudiantes",
                             folio = 68, forma = "columnas", unidad_n = "estudiantes")
print(o$doc, target = OUT); cat("OK\n")
