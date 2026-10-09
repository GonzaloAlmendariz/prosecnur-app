# Par de paneles (ADR 0093, N2): lámina 133 del recetario, dos gráficos Sí/No por cuatro públicos, rehecha con
# .lam_laminas_paneles sobre el proyecto de referencia del catálogo.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/paneles.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_paneles.R
#   printf "recetario,motor,nombre\n133,1,p133\n142,2,p142\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R /ruta/paneles.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
OUT <- Sys.getenv("OUT")
SP <- normalizePath("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt")
r <- suppressMessages(load_pulso(file.path(SP, "acrconta_mazo.pulso"))); src <- suppressMessages(.graficos_processing_sources(r$session_id))
lc <- function(df) grep("^label", names(df))[1]
fila <- function(base, v, actor, cols) {
  ins <- src$inst_sources[[base]]; sv <- ins$survey; ch <- ins$choices
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]
  cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(src$data_sources[[base]][[v]]); d <- d[!is.na(d) & d != ""]
  n <- as.integer(table(factor(d, levels = cc$name)))[seq_along(cols)]
  out <- data.frame(item = paste0(base, "_", v), actor = actor, pregunta = row[[lc(sv)]], N = length(d))
  for (k in seq_along(cols)) out[[cols[k]]] <- n[k] / length(d)
  out
}
dn <- c(s1 = "Sí", s2 = "No"); c2 <- c("s1", "s2")
act <- c("Docentes", "Estudiantes", "Egresados", "Administrativos"); bases <- c("docentes", "estudiantes", "egresados", "administrativos")
m1 <- c("p9", "p7", "p14", "p6"); m2 <- c("p10", "p8", "p15", "p7")
mk <- function(vars) {
  d <- do.call(rbind, lapply(1:4, function(i) fila(bases[i], vars[i], act[i], c2)))
  list(e = preparar_escala(d, "item", "N", c2, dn, var_etiqueta_categoria = "actor",
                           colores_grupos = as.list(setNames(.std_paleta("dicotomica"), dn))), q = d$pregunta[1])
}
a <- mk(m1); b <- mk(m2)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
doc <- .lam_laminas_paneles(doc, list(a$e, b$e), list(a$q, b$q), "p_slide_2_graficos", "Conocimiento de la misión", ante = "Dos gráficos",
                            base = "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos", folio = 133)
print(doc, target = OUT); cat("OK\n")

# 142: dos gráficos apilados a lo ancho, docentes y estudiantes en dos afirmaciones de tutoría.
niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
c5 <- paste0("t", 1:5)
mk5 <- function(v_doc, v_est) {
  d <- rbind(fila("docentes", v_doc, "Docentes", c5), fila("estudiantes", v_est, "Estudiantes", c5))
  preparar_escala(d, "item", "N", c5, niv, var_etiqueta_categoria = "actor",
                  colores_grupos = as.list(setNames(.std_paleta("likert"), niv)), barra_extra_preset = "top2box", top2box_labels = niv[3:4])
}
doc <- officer::read_pptx(OUT)
doc <- .lam_laminas_vertical(doc, list(mk5("p24_6", "p17_5"), mk5("p24_7", "p17_6")),
                             list("La Unidad cuenta con servicios de tutoría académica.",
                                  "La Unidad cuenta con servicios de tutoría socioemocional (bienestar estudiantil)."),
                             "Servicios de tutoría", ante = "Dos gráficos apilados", base = "Base: 52 docentes y 172 estudiantes", folio = 142)
print(doc, target = OUT); cat("OK 142\n")
