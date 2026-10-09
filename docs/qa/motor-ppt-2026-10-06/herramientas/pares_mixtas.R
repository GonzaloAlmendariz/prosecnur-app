# Pares de láminas mixtas (ADR 0093, N3): las disposiciones de tres y cuatro gráficos de recetario_m2b.R
# rehechas con .lam_laminas_mixta sobre el proyecto de referencia del catálogo.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/mixtas.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_mixtas.R
#   printf "recetario,motor,nombre\n147,1,x147\n152,2,x152\n160,3,x160\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R /ruta/mixtas.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
OUT <- Sys.getenv("OUT", file.path(tempdir(), "mixtas.pptx"))
SP <- normalizePath("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt")
r <- suppressMessages(load_pulso(file.path(SP, "acrconta_mazo.pulso"))); src <- suppressMessages(.graficos_processing_sources(r$session_id))
lc <- function(df) grep("^label", names(df))[1]
freq <- function(base, v) {
  ins <- src$inst_sources[[base]]; sv <- ins$survey; ch <- ins$choices
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]
  cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(src$data_sources[[base]][[v]]); d <- d[!is.na(d) & d != ""]
  n <- as.integer(table(factor(d, levels = cc$name)))
  list(labels = cc[[lc(ch)]], n = n, pct = n / length(d), valid = length(d), pregunta = row[[lc(sv)]])
}
cat_e <- function(f, ranking = FALSE) {
  e <- preparar_categorica(f$labels, f$pct, .pulso_fmt_pct_unidades(.pulso_pct_unidades(f$pct, 0, "estandar"), 0), f$n)
  e
}
fila <- function(base, v, actor, cols) {
  f <- freq(base, v); out <- data.frame(item = paste0(base, "_", v), actor = actor, N = f$valid)
  for (k in seq_along(cols)) out[[cols[k]]] <- f$n[k] / f$valid
  out
}
dn <- c(s1 = "Sí", s2 = "No"); c2 <- c("s1", "s2")
esc_dico <- function(filas) preparar_escala(do.call(rbind, filas), "item", "N", c2, dn, var_etiqueta_categoria = "actor",
                                            colores_grupos = as.list(setNames(.std_paleta("dicotomica"), dn)))
niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
c5 <- paste0("t", 1:5)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")

# 147: dos apilados y uno alto (titulación, año, sueldo de egresados).
t1 <- freq("egresados", "p8"); a <- freq("egresados", "p9"); s <- freq("egresados", "p13")
o <- .lam_laminas_mixta(doc, list(esc_dico(list(fila("egresados", "p8", "Egresados", c2))), cat_e(a), cat_e(s)), "graficos_3_2mas1",
                        preguntas = list("¿Cuenta con título universitario?", "¿En qué año obtuvo su título universitario?", "Sueldo mensual bruto"),
                        publicos = list(paste(t1$valid, "respuestas"), paste(a$valid, "egresados titulados"), paste(s$valid, "respuestas")),
                        titulo = "Titulación e ingresos del egresado", ante = "Tres gráficos: dos apilados y uno alto",
                        base = sprintf("Base: %d egresados. Año de titulación, %d que tienen título. Sueldo, %d que respondieron", t1$valid, a$valid, s$valid),
                        folio = 147)
# 152: uno ancho arriba (tutoría, likert con Top Two Box) y dos dicotómicas por tres públicos.
tut <- preparar_escala(rbind(fila("docentes", "p24_6", "Docentes", c5), fila("estudiantes", "p17_5", "Estudiantes", c5)), "item", "N", c5, niv,
                       var_etiqueta_categoria = "actor", colores_grupos = as.list(setNames(.std_paleta("likert"), niv)),
                       barra_extra_preset = "top2box", top2box_labels = niv[3:4])
m1 <- esc_dico(list(fila("docentes", "p9", "Docentes", c2), fila("estudiantes", "p7", "Estudiantes", c2), fila("egresados", "p14", "Egresados", c2)))
m2 <- esc_dico(list(fila("docentes", "p10", "Docentes", c2), fila("estudiantes", "p8", "Estudiantes", c2), fila("egresados", "p15", "Egresados", c2)))
o <- .lam_laminas_mixta(o$doc, list(tut, m1, m2), "graficos_3_1arriba",
                        preguntas = list("La Unidad cuenta con servicios de tutoría académica.", "¿Conoce la misión y los propósitos de la PUCP?",
                                         "¿Sabe dónde consultar la misión y los propósitos de la PUCP?"),
                        titulo = "Tutoría y misión institucional", ante = "Tres gráficos: uno ancho arriba",
                        base = "Base: 52 docentes, 172 estudiantes y 178 egresados", folio = 152)
# 160: cuadrícula de 2 x 2 (perfil del docente); la cuarta es la dicotomía partida.
gr <- freq("docentes", "p6"); dep <- freq("docentes", "p7"); ed <- freq("docentes", "p4_recod"); mi <- freq("docentes", "p9")
o <- .lam_laminas_mixta(o$doc, list(cat_e(gr), cat_e(dep), cat_e(ed), cat_e(mi)), "paneles_4",
                        preguntas = list("Máximo grado alcanzado", "Departamento académico", "Rango de edades", "¿Conoce la misión y los propósitos de la PUCP?"),
                        publicos = list(paste(gr$valid, "respuestas"), paste(dep$valid, "respuestas"), paste(ed$valid, "respuestas"), paste(mi$valid, "respuestas")),
                        titulo = "Perfil del docente: formación y trayectoria", ante = "Cuatro gráficos", base = "Base: 52 docentes", folio = 160)
print(o$doc, target = OUT); cat("OK\n")
