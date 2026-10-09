# Pares de escala (ADR 0093, N1): láminas 216, 221 y 222 del recetario rehechas con
# las funciones del paquete (preparar_escala + compositor) sobre el proyecto de
# referencia del catálogo.
#
# Uso (desde la raíz del repo):
#   OUT=/ruta/escala.pptx Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_escala.R
#   printf "recetario,motor,nombre\n216,1,e216\n221,2,e221\n222,3,e222\n217,4,e217\n77,5,e077\n" > mapa.csv
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
e221 <- espec(do.call(rbind, lapply(sprintf("p30_%d", 1:11), function(v) fila("docentes", v))), orden = "auto")   # batería: por Top Two Box
o <- .lam_laminas_escala(o$doc, e221, "Competencias del perfil de egreso", ante = "Características del perfil de egreso", base = "Base: 51 docentes", folio = 221)
partes_221 <- o$partes
# 217: tres premisas, dos con docentes y egresados (actores) y una de administrativos (base chica: «x de y»).
fila_actor <- function(base, v, actor, grupo) { f <- fila(base, v); f$item <- paste0(base, "_", v); f$actor <- actor; f$grupo <- grupo; f }
d217 <- rbind(fila_actor("docentes", "p16_4", "Docentes", "g1"), fila_actor("egresados", "p21_3", "Egresados", "g1"),
              fila_actor("docentes", "p16_5", "Docentes", "g2"), fila_actor("egresados", "p21_4", "Egresados", "g2"),
              fila_actor("administrativos", "p13_5", "Administrativos", "g3"))
d217$titulo <- ave(d217$rotulo, d217$grupo, FUN = function(x) x[1])
e217 <- preparar_escala(d217, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "actor", var_grupo_id = "grupo",
                        var_grupo_titulo = "titulo", colores_grupos = as.list(setNames(.std_paleta("likert"), niv)),
                        barra_extra_preset = "top2box", top2box_labels = niv[3:4])
o <- .lam_laminas_escala(o$doc, e217, "Gestión y planificación", ante = "Estructura organizacional de gobierno",
                         base = "Base: 52 docentes, 178 egresados y 15 administrativos", folio = 217)
# 77: fila Total ponderada, actores y columnas Top Two Box y Bottom Two Box. Los datos son los del
# recetario (propuestas_rescatables.R:167, rr_b2b): porcentajes de docentes (52) y estudiantes (172).
d77 <- data.frame(item = c("doc", "est"), actor = c("Docentes", "Estudiantes"), N = c(52, 172),
                  t1 = c(0, 6), t2 = c(2, 18), t3 = c(29, 34), t4 = c(54, 19), t5 = c(15, 23))
d77[paste0("t", 1:5)] <- d77[paste0("t", 1:5)] / 100
e077 <- preparar_escala(d77, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "actor",
                        colores_grupos = as.list(setNames(.std_paleta("likert"), niv)), barra_extra_preset = "top2box",
                        top2box_labels = niv[3:4], columna_bottom2box = TRUE, bottom2box_labels = niv[1:2], fila_total = TRUE)
e077$pregunta <- "La Unidad cuenta con servicios de tutoría académica"
o <- .lam_laminas_escala(o$doc, e077, "Servicios de tutoría", ante = "Escalas: Bottom Two Box y fila Total",
                         base = "Top Two Box: «De acuerdo» más «Totalmente de acuerdo». Bottom Two Box: las dos respuestas en desacuerdo. Base: 52 docentes y 172 estudiantes",
                         folio = 77)
print(o$doc, target = OUT); cat("OK partes 221:", partes_221, " láminas:", length(o$doc), "\n")
cat("TTB 221:", paste(e221$filas$rotulo[e221$orden$aplicado], e221$box$cifras[e221$orden$aplicado], collapse = " | "), "\n")
