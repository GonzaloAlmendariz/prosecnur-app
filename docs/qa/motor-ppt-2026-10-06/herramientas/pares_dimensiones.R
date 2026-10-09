# Pares de dimensiones (ADR 0093, N5): láminas 92 y 94 del recetario rehechas con preparar_heatmap_dim /
# preparar_comparativo_dim y los renderers de lamina_dimensiones.R. El payload se arma con el Top Two Box por ítem
# promediado por dimensión, como recetario_m3d.R (las dimensiones del motor hoy recodifican lineal 0-100).
#
# Uso (desde la raíz del repo):
#   S=<carpeta> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/pares_dimensiones.R   (escribe <carpeta>/n5/heat.pptx)
#   printf "recetario,motor,nombre\n92,1,c092\n94,2,c094\n" > mapa.csv
#   Rscript scripts/qa_pares_recetario.R <carpeta>/n5/heat.pptx mapa.csv /ruta/pares
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages(pkgload::load_all("api", quiet = TRUE))
r <- suppressMessages(load_pulso("tmp/motor-ppt-diag-2026-10-06/catalogo_ppt/acrconta_mazo.pulso")); src <- suppressMessages(.graficos_processing_sources(r$session_id))
de <- as.data.frame(src$data_sources$estudiantes); items <- sprintf("p22_%d", 1:11)
dims <- list(`Competencias técnicas` = 1:5, `Visión empresarial` = 6, `Competencias transversales` = 7:11)
ttb <- function(idx) sapply(items, function(v) { x <- as.character(de[[v]])[idx]; ok <- x %in% c("1","2","3","4"); round(100 * mean(x[ok] %in% c("3","4"))) })
grupos <- list(Total = rep(TRUE, nrow(de)), Masculino = de$p5 == "1", Femenino = de$p5 == "2")
cic <- c("Quinto ciclo", "Sexto ciclo", "Séptimo ciclo", "Octavo ciclo", "Noveno ciclo", "Décimo ciclo")
for (k in 1:6) grupos[[cic[k]]] <- de$p6 == as.character(k)
resp <- apply(sapply(items, function(v) as.character(de[[v]]) %in% c("1","2","3","4")), 1, any)
M <- sapply(grupos, ttb); Md <- t(sapply(dims, function(ix) colMeans(M[ix, , drop = FALSE])))
sc <- do.call(rbind, lapply(colnames(Md), function(g) data.frame(axis_label = rownames(Md), grupo = g, tipo = "apertura", score_raw = Md[, g], base = sum(grupos[[g]] & resp))))
pl <- list(score_heat = sc, axis_order_heat = rownames(Md), group_order_natural = colnames(Md))
e <- preparar_heatmap_dim(pl); e$bloques <- list(list(titulo = "Sexo", cols = 2:3), list(titulo = "Ciclo", cols = 4:9))
print(e$valores); print(e$rango)
doc <- officer::read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
o <- .lam_laminas_heatmap_dim(doc, e, "Competencias del perfil de egreso por grupo", ante = "Mapa de calor por dimensión", folio = 92,
  sub = "Varios grupos en pocas dimensiones, con la diferencia de cada grupo frente al total", rotulo_escala = "Top Two Box",
  base = "Base: 109 estudiantes que respondieron la batería de competencias. * Menos de 15 casos. Debajo de cada cifra, la diferencia con el total en puntos")
sc2 <- sc[sc$grupo %in% c("Total", "Masculino", "Femenino"), ]
e94 <- preparar_comparativo_dim(list(score_heat = sc2, axis_order_heat = rownames(Md), group_order_natural = c("Total", "Masculino", "Femenino")))
print(e94$textos_diferencia)
o <- .lam_laminas_comparativo_dim(o$doc, e94, "Índices por sexo", ante = "Comparativo de dimensiones", folio = 94,
                                  base = "Base: 109 estudiantes que respondieron la batería de competencias")
OUT <- file.path(Sys.getenv("S", tempdir()), "n5", "heat.pptx"); dir.create(dirname(OUT), showWarnings = FALSE, recursive = TRUE)
print(o$doc, target = OUT); cat("OK\n")
