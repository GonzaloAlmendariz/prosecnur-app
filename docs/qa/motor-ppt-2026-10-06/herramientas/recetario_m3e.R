# Recetario: texto y territorio (loop M3e). Se carga tras recetario_m3d.R.
# Requiere SP/nube_ing.rds y SP/mapa_cobertura.rds (preparar-datos/prep_m3e.R).
suppressMessages(library(ggwordcloud))
nb <- readRDS(file.path(SP, "nube_ing.rds"))

# --- p_nube_palabras: ilustrativa, junto al ranking que sí comunica proporción
MOTOR_ACT <- "p_slide_1_grafico_narrativo: p_nube_palabras (ilustrativa) + p_lollipop"
doc <- nueva(doc); titulo(doc, "Qué dicen los egresados sobre la carrera", ante = "Nube de palabras")
f <- head(nb$freq, 30); dfw <- data.frame(w = names(f), n = as.integer(f))   # 30 palabras: ninguna bajo 10 pt
tonos <- grDevices::colorRampPalette(c("#8EA3C6", TK$navy))(5)
dfw$col <- tonos[cut(dfw$n, breaks = unique(quantile(dfw$n, seq(0, 1, .25))), include.lowest = TRUE, labels = FALSE)]
set.seed(7)
gw <- ggplot(dfw, aes(label = w, size = n, colour = col)) + geom_text_wordcloud(family = "Arial", fontface = "bold", rm_outside = TRUE, eccentricity = 0.65, grid_margin = 0.6) +
  scale_size(range = c(10, 38) / .pt) + scale_colour_identity() + theme_void()
invisible(ph_with(doc, dml(ggobj = gw, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML, top = YT + 0.1, width = 7.4, height = 4.7)))
zona("nube, tamaño proporcional a la frecuencia", ML, YT + 0.1, 7.4, 4.7)
xr_ <- 8.2; wr_ <- W - MR - xr_; top <- head(dfw, 10)
panel_titulo(doc, xr_, YT, wr_, "Palabras más mencionadas", sprintf("%d respuestas abiertas", nb$n_resp))
for (k in seq_len(nrow(top))) { yc <- YT + 0.75 + (k - 1) * 0.42; xv <- xr_ + 1.7 + (wr_ - 2.5) * top$n[k] / max(top$n)
  txt(doc, top$w[k], xr_, yc - 0.14, 1.55, 0.28, 11.5, TK$navy, bold = TRUE, align = "right")
  caja(doc, xr_ + 1.7, yc - 0.01, xv - xr_ - 1.7, 0.02, TK$faint); caja(doc, xv - 0.08, yc - 0.08, 0.16, 0.16, TK$navy, geom = "ellipse")
  txt(doc, sprintf("%d", top$n[k]), xv + 0.12, yc - 0.14, 0.6, 0.28, 11, TK$navy, bold = TRUE) }
txt(doc, "menciones", xr_ + 1.7, YT + 0.42, 2, 0.24, 10, TK$soft, bold = TRUE)
pie(doc, sprintf("Base: %d egresados que respondieron la pregunta abierta", nb$n_resp))

# --- C34 (Gonzalo, 2026-10-07: palabras, pares o tríos más comunes sin palabras de relleno, y al lado la categorización de
# las respuestas abiertas como una pregunta de opción múltiple). Datos: preparar-datos/prep_m3e_texto.R
tx <- readRDS(file.path(SP, "texto_ing.rds"))
MOTOR_ACT <- "PROPUESTA: frases frecuentes (palabras, pares y tríos) + p_barras_agrupadas de la abierta categorizada"
doc <- nueva(doc); titulo(doc, "Qué cambiarían los egresados en la carrera", ante = "Pregunta abierta: frases y temas")
wizq <- 7.3; gapc <- 0.35; wcol_ <- (wizq - 2 * gapc) / 3
panel_titulo(doc, XC, YT, wizq, "Lo que más se repite", "personas que lo mencionan")
bloques_f <- list(list("Palabras", head(tx$palabras, 7)), list("Pares", head(tx$pares, 7)), list("Tríos", head(tx$trios[tx$trios >= 2], 7)))
for (b in seq_along(bloques_f)) { xb <- XC + (b - 1) * (wcol_ + gapc); f_ <- bloques_f[[b]][[2]]
  txt(doc, bloques_f[[b]][[1]], xb - 0.1, YT + 0.62, wcol_, 0.3, 12, TK$soft, bold = TRUE)
  if (b > 1) separador_v(doc, xb - gapc / 2, YT + 0.65, YT + 0.95 + 7 * 0.56)
  for (k in seq_along(f_)) { yk <- YT + 1.0 + (k - 1) * 0.56; wbar <- (wcol_ - 0.55) * f_[[k]] / max(f_)   # rótulo arriba, barra y cifra debajo
    txt(doc, names(f_)[k], xb - 0.1, yk, wcol_ + 0.1, 0.3, 11.5, TK$navy, bold = k == 1)
    caja(doc, xb, yk + 0.33, wbar, 0.07, if (k == 1) TK$navy else TK$tenue)
    txt(doc, f_[[k]], xb + wbar - 0.02, yk + 0.22, 0.6, 0.26, 10, TK$navy, bold = TRUE) } }
xd_ <- XC + wizq + 0.45; wd_ <- W - MR - xd_; separador_v(doc, xd_ - 0.22, YT, YF - 0.1)
panel_titulo(doc, xd_, YT, wd_, "Temas de las respuestas", "% de quienes respondieron")
pc_ <- round(100 * tx$cats / tx$n_resp); names(pc_) <- c(`Vínculo con la industria y el mercado` = "Vínculo con la industria", `Más práctica, talleres y casos reales` = "Más práctica y casos reales", `Software, herramientas e IA` = "Software, herramientas e IA", `Gestión de proyectos` = "Gestión de proyectos", `Habilidades blandas y liderazgo` = "Habilidades blandas", `Malla y cursos de especialidad` = "Malla y especialidad", `Docentes con experiencia en el campo` = "Docentes con experiencia", Otros = "Otros", `Sin sugerencia` = "Sin sugerencia")[names(pc_)]; res_ <- names(pc_) %in% c("Otros", "Sin sugerencia")
ord_ <- c(order(-pc_[!res_]), which(res_)[order(-pc_[res_])] - 0); lab_ <- c(names(pc_)[!res_][order(-pc_[!res_])], names(pc_)[res_])
pcs_ <- c(sort(pc_[!res_], decreasing = TRUE), pc_[res_])
barras_h(doc, xd_, YT + 0.65, wd_, lab_[seq_len(sum(!res_))], pcs_[seq_len(sum(!res_))], wlab = 2.55, g = 0.26, fila = 0.48, size = 12, escala = max(pcs_) * 1.1)
barras_h(doc, xd_, YT + 0.65 + sum(!res_) * 0.48, wd_, lab_[-seq_len(sum(!res_))], pcs_[-seq_len(sum(!res_))], wlab = 2.55, g = 0.26, fila = 0.48, size = 12, escala = max(pcs_) * 1.1, color = TK$faint)
zona("frases frecuentes y temas", XC, YT, AC, YF - YT)
pie(doc, sprintf("Base: %d egresados que respondieron la pregunta abierta. Cada persona cuenta una vez por frase y una respuesta puede caer en varios temas", tx$n_resp))

# --- p_mapa_cobertura_territorial: dibujado por el motor real (contexto sintético de los tests)
MOTOR_ACT <- "p_slide_1_grafico: p_mapa_cobertura_territorial (dibujo del motor, contexto de prueba)"
doc <- nueva(doc); titulo(doc, "Cobertura territorial del operativo", ante = "Mapa de cobertura")
# El motor dibuja la leyenda del mapa a 9,5 pt (H44), bajo el piso de 10: se sube en el
# árbol de grobs del objeto (no se toca el motor).
piso_grob <- function(x, piso = 10, a = 10.5) {
  if (!is.null(x$gp) && !is.null(x$gp$fontsize) && any(x$gp$fontsize < piso)) x$gp$fontsize <- pmax(x$gp$fontsize, a)
  if (!is.null(x$children)) for (k in seq_along(x$children)) x$children[[k]] <- piso_grob(x$children[[k]], piso, a)
  if (!is.null(x$grobs)) for (k in seq_along(x$grobs)) x$grobs[[k]] <- piso_grob(x$grobs[[k]], piso, a)
  x }
gm <- readRDS(file.path(SP, "mapa_cobertura.rds"))
for (i in seq_along(gm$layers)) if (!is.null(gm$layers[[i]]$geom_params$grob)) gm$layers[[i]]$geom_params$grob <- piso_grob(gm$layers[[i]]$geom_params$grob)
invisible(ph_with(doc, dml(ggobj = gm, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML, top = YT, width = 8.6, height = 4.95)))
zona("mapa", ML, YT, 8.6, 4.95)
narrativa(doc, 9.4, YT + 0.9, 3.6, 2.6, list(N_("El motor dibuja este mapa con los distritos, zonas y manzanas que registran "), B("Hojas de ruta"), N_(" y "), B("Monitoreo territorial"),
  N_(". El ejemplo usa datos de prueba.")), size = 14)
pie(doc, "Ejemplo con datos de prueba del motor (Lima)")
