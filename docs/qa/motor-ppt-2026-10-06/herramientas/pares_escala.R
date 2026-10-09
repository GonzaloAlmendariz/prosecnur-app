# Pares de escala (ADR 0093, N1): láminas 216, 221 y 222 del recetario rehechas con
# las funciones del paquete (preparar_escala + compositor) sobre el proyecto de
# referencia del catálogo.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/escala.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_escala.R
#   printf "recetario,motor,nombre\n216,1,e216\n221,2,e221\n222,3,e222\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R /ruta/escala.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
OUT <- Sys.getenv("OUT", file.path(tempdir(), "escala.pptx"))
SP <- normalizePath("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt")
r <- suppressMessages(load_pulso(file.path(SP, "acrconta_mazo.pulso"))); src <- suppressMessages(.graficos_processing_sources(r$session_id))
niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
fila <- function(base, v) {
  ins <- src$inst_sources[[base]]; sv <- ins$survey; ch <- ins$choices; lc <- function(df) grep("^label", names(df))[1]
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]
  cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(src$data_sources[[base]][[v]]); d <- d[!is.na(d) & d != ""]
  n <- as.integer(table(factor(d, levels = cc$name)))
  data.frame(item = v, rotulo = row[[lc(sv)]], N = length(d), t1 = n[1], t2 = n[2], t3 = n[3], t4 = n[4], t5 = n[5]) |>
    transform(t1 = t1 / N, t2 = t2 / N, t3 = t3 / N, t4 = t4 / N, t5 = t5 / N)
}
espec <- function(df, ...) preparar_escala(df, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "rotulo",
                                           colores_grupos = as.list(setNames(.std_paleta("likert"), niv)),
                                           barra_extra_preset = "top2box", top2box_labels = niv[3:4], ...)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
e216 <- espec(fila("estudiantes", "p16_6"))
# 216: un público con actor «Estudiantes»
e216$filas$grupo_id <- "Estudiantes"; e216$filas$grupo_titulo <- e216$filas$rotulo; e216$filas$rotulo <- "Estudiantes"
o <- .lam_laminas_escala(doc, e216, "Gestión y desarrollo del cuerpo académico", ante = "Cuerpo académico", base = "Base: 172 estudiantes", folio = 216)
e221 <- espec(do.call(rbind, lapply(sprintf("p30_%d", 1:11), function(v) fila("docentes", v))))
o <- .lam_laminas_escala(o$doc, e221, "Competencias del perfil de egreso", ante = "Características del perfil de egreso", base = "Base: 51 docentes", folio = 221)
print(o$doc, target = OUT); cat("OK partes 221:", o$partes, " láminas:", length(o$doc), "\n")
cat("TTB 221:", paste(e221$filas$rotulo[e221$orden$aplicado], e221$box$cifras[e221$orden$aplicado], collapse = " | "), "\n")
