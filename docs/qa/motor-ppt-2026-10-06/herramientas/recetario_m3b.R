# Recetario: gráficos numéricos (loop M3b). Edad CRUDA (p3/p4), nunca la recodificada (H38);
# grupos con su rótulo y en orden del instrumento (H42). Se carga tras recetario_m3a.R.
num_por_grupo <- function(b, vnum, vgrp) {
  d <- CONTA$data_sources[[b]]; sv <- CONTA$inst_sources[[b]]$survey; ch <- CONTA$inst_sources[[b]]$choices
  lc <- grep("^label", names(ch))[1]; ln <- sv$list_name[!is.na(sv$name) & sv$name == vgrp][1]; cc <- ch[!is.na(ch$list_name) & ch$list_name == ln, ]
  x <- suppressWarnings(as.numeric(d[[vnum]])); g <- factor(as.character(d[[vgrp]]), levels = cc$name, labels = cc[[lc]])
  ok <- !is.na(x) & !is.na(g); split(x[ok], droplevels(g[ok]))
}
fmt1 <- function(v) sprintf("%.1f", v)
por_ciclo <- num_por_grupo("estudiantes", "p3", "p6")

# --- p_numerico: una métrica por grupo, en columnas (en el motor no es una cifra suelta)
MOTOR_ACT <- "p_slide_1_grafico: p_numerico (media por grupo)"
doc <- nueva(doc); titulo(doc, "Edad promedio por ciclo", ante = "Indicador numérico")
med <- sapply(por_ciclo, mean); nn <- sapply(por_ciclo, length); k_ <- length(med)
x0 <- ML + 0.6; wv <- ANCHO - 1.2; paso <- wv / k_; wcol <- paso * 0.56; ybase <- 6.05; hmax <- 3.3; lo <- 0; hi <- ceiling(max(med) * 1.1)   # barras desde cero (guía 4.4)
caja(doc, x0 - 0.1, ybase, wv + 0.2, 0.012, TK$faint)
txt(doc, "Edad promedio, en años", x0 - 0.1, ybase - hmax - 0.75, 4, 0.26, 10, TK$soft, bold = TRUE)
for (i in seq_len(k_)) { hk <- hmax * (med[i] - lo) / (hi - lo); xk <- x0 + (i - 1) * paso + (paso - wcol) / 2
  caja(doc, xk, ybase - hk, wcol, hk, TK$navy)
  txt(doc, fmt1(med[i]), xk - 0.3, ybase - hk - 0.42, wcol + 0.6, 0.36, 16, TK$navy, bold = TRUE, align = "center")
  txt(doc, sprintf("%d estudiantes", nn[i]), xk - 0.4, ybase - hk - 0.68, wcol + 0.8, 0.26, 10, TK$faint, align = "center")
  txt(doc, names(med)[i], xk - 0.4, ybase + 0.1, wcol + 0.8, 0.3, 12, TK$navy, bold = TRUE, align = "center") }
zona("columnas de la media", x0, ybase - hmax, wv, hmax)
pie(doc, "Base: 172 estudiantes")

# --- p_boxplot: distribución de la edad por grupo
MOTOR_ACT <- "p_slide_1_grafico: p_boxplot"
doc <- nueva(doc); titulo(doc, "Distribución de la edad por ciclo", ante = "Box plot")
todas <- unlist(por_ciclo); lo <- floor(min(todas)); hi <- ceiling(max(todas))
xl <- ML + 1.9; wl <- W - MR - xl - 1.7; px <- function(v) xl + wl * (v - lo) / (hi - lo); fila <- (YF - YT - 0.9) / k_
for (v in seq(lo, hi, by = 2)) { caja(doc, px(v), YT + 0.35, 0.006, k_ * fila, TK$rule); txt(doc, v, px(v) - 0.3, YT + 0.05, 0.6, 0.24, 10, TK$faint, align = "center") }
txt(doc, "Edad, en años", xl, YT - 0.25, 3, 0.26, 10, TK$soft, bold = TRUE)
for (i in seq_len(k_)) { x <- por_ciclo[[i]]; q <- quantile(x, c(.25, .5, .75)); iqr <- q[3] - q[1]
  bi <- max(min(x), q[1] - 1.5 * iqr); bs <- min(max(x), q[3] + 1.5 * iqr); out <- x[x < bi | x > bs]
  yc <- YT + 0.35 + (i - 0.5) * fila; hb <- min(0.42, fila * 0.55)
  txt(doc, names(por_ciclo)[i], ML, yc - 0.15, 1.75, 0.3, 12, TK$navy, bold = TRUE, align = "right")
  caja(doc, px(bi), yc - 0.008, px(bs) - px(bi), 0.016, TK$soft)
  caja(doc, px(bi) - 0.006, yc - hb / 4, 0.012, hb / 2, TK$soft); caja(doc, px(bs) - 0.006, yc - hb / 4, 0.012, hb / 2, TK$soft)
  caja(doc, px(q[1]), yc - hb / 2, px(q[3]) - px(q[1]), hb, "#B9C5DC", line = sp_line(color = TK$navy, lwd = 0.75))
  caja(doc, px(q[2]) - 0.015, yc - hb / 2, 0.03, hb, TK$navy)
  for (o in unique(out)) caja(doc, px(o) - 0.045, yc - 0.045, 0.09, 0.09, TK$soft, geom = "ellipse")
  txt(doc, sprintf("Mediana %d", as.integer(q[2])), W - MR - 1.25, yc - 0.15, 1.25, 0.3, 11, TK$navy, bold = TRUE) }
zona("cajas: cuartiles, mediana y bigotes a 1,5 RIC", xl, YT + 0.35, wl, k_ * fila)
leyenda(doc, 0, YF - 0.25, c("50 % central de las edades", "Mediana"), c("#B9C5DC", TK$navy), size = 10.5, centrar_en = xl + wl / 2)
pie(doc, "Base: 172 estudiantes")

# --- p_media_rango: media con su rango por público
MOTOR_ACT <- "p_slide_1_grafico: p_media_rango"
doc <- nueva(doc); titulo(doc, "Edad por público", ante = "Media y rango")
pub <- list(Docentes = c("docentes", "p4"), Estudiantes = c("estudiantes", "p3"), Egresados = c("egresados", "p4"), Administrativos = c("administrativos", "p3"))
ed <- lapply(pub, function(z) { x <- suppressWarnings(as.numeric(CONTA$data_sources[[z[1]]][[z[2]]])); x[!is.na(x)] })
lo <- floor(min(unlist(ed)) / 5) * 5; hi <- ceiling(max(unlist(ed)) / 5) * 5
xl <- ML + 2.2; wl <- W - MR - xl - 1.8; px <- function(v) xl + wl * (v - lo) / (hi - lo); fila <- (YF - YT - 1.0) / length(ed)
for (v in seq(lo, hi, by = 5)) { caja(doc, px(v), YT + 0.35, 0.006, length(ed) * fila, TK$rule); txt(doc, v, px(v) - 0.3, YT + 0.05, 0.6, 0.24, 10, TK$faint, align = "center") }
txt(doc, "Edad, en años", xl, YT - 0.25, 3, 0.26, 10, TK$soft, bold = TRUE)
for (i in seq_along(ed)) { x <- ed[[i]]; yc <- YT + 0.35 + (i - 0.5) * fila; m <- mean(x)
  txt(doc, names(ed)[i], ML, yc - 0.27, 2.05, 0.3, 13, TK$navy, bold = TRUE, align = "right")
  txt(doc, sprintf("%d respuestas", length(x)), ML, yc + 0.02, 2.05, 0.26, 10, TK$faint, align = "right")
  caja(doc, px(min(x)), yc - 0.03, px(max(x)) - px(min(x)), 0.06, "#B9C5DC")
  txt(doc, min(x), px(min(x)) - 0.55, yc - 0.15, 0.5, 0.28, 10.5, TK$soft, align = "right"); txt(doc, max(x), px(max(x)) + 0.06, yc - 0.15, 0.5, 0.28, 10.5, TK$soft)
  caja(doc, px(m) - 0.13, yc - 0.13, 0.26, 0.26, TK$navy, geom = "ellipse")
  txt(doc, sprintf("Media %s", fmt1(m)), W - MR - 1.6, yc - 0.15, 1.6, 0.3, 12, TK$navy, bold = TRUE) }
zona("media (punto) y rango (barra)", xl, YT + 0.35, wl, length(ed) * fila)
leyenda(doc, 0, YF - 0.25, c("Media", "Rango de edades (mínimo a máximo)"), c(TK$navy, "#B9C5DC"), size = 10.5, centrar_en = xl + wl / 2)
pie(doc, "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos")
