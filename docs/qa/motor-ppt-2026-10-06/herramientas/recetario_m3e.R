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
pie(doc, sprintf("Base: %d egresados de Ingeniería Mecánica que respondieron la pregunta abierta", nb$n_resp))

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
