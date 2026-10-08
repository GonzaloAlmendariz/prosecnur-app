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

# --- C34, segunda parte (Gonzalo, 2026-10-07: «no has agregado casos de mapa de palabras por pares o tríos»): la misma nube
# con frases de dos y de tres palabras. Sólo frases que repiten al menos dos personas: con una sola, la nube es ruido.
tx <- readRDS(file.path(SP, "texto_ing.rds"))
MOTOR_ACT <- "p_slide_2_graficos: p_nube_palabras con frases de dos y de tres palabras (ilustrativa)"
doc <- nueva(doc); titulo(doc, "Las frases que más se repiten", ante = "Nube de frases")
nube_frases <- function(f, x, w, titulo_, rango) {
  f <- f[f >= 2]; d <- data.frame(w = names(f), n = as.integer(f))
  d$col <- grDevices::colorRampPalette(c("#8EA3C6", TK$navy))(4)[pmin(4, as.integer(cut(d$n, breaks = unique(c(1, 2, 3, 5, Inf)), labels = FALSE)))]
  panel_titulo(doc, x, YT, w, titulo_, sprintf("%d frases repetidas por dos personas o más", nrow(d)))
  set.seed(11)
  g <- ggplot(d, aes(label = w, size = n, colour = col)) + geom_text_wordcloud(family = "Arial", fontface = "bold", rm_outside = TRUE, eccentricity = 0.8, grid_margin = 0.8) +
    scale_size(range = rango / .pt) + scale_colour_identity() + theme_void()
  invisible(ph_with(doc, dml(ggobj = g, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = x, top = YT + 0.7, width = w, height = YF - YT - 0.8)))
  zona("nube de frases", x, YT + 0.7, w, YF - YT - 0.8) }
wn <- (AC - 0.6) / 2
nube_frases(tx$pares, XC, wn, "Frases de dos palabras", c(12, 38))
separador_v(doc, XC + wn + 0.3, YT, YF - 0.1)
nube_frases(tx$trios, XC + wn + 0.6, wn, "Frases de tres palabras", c(14, 40))
pie(doc, sprintf("Base: %d egresados que respondieron la pregunta abierta. El tamaño crece con el número de personas que usan la frase", tx$n_resp))

# --- C34 (Gonzalo, 2026-10-07: palabras, pares o tríos más comunes sin palabras de relleno, y al lado la categorización de
# las respuestas abiertas como una pregunta de opción múltiple). Datos: preparar-datos/prep_m3e_texto.R
tx <- readRDS(file.path(SP, "texto_ing.rds"))
MOTOR_ACT <- "PROPUESTA: frases frecuentes (palabras, pares y tríos) + p_barras_agrupadas de la abierta categorizada"
doc <- nueva(doc); titulo(doc, "Qué cambiarían los egresados en la carrera", ante = "Pregunta abierta: frases y temas")
wizq <- 7.3; gapc <- 0.35; wcol_ <- (wizq - 2 * gapc) / 3
panel_titulo(doc, XC, YT, wizq, "Lo que más se repite", "personas que lo mencionan")
bloques_f <- list(list("Palabras sueltas", head(tx$palabras, 7)), list("Frases de dos palabras", head(tx$pares, 7)), list("Frases de tres palabras", head(tx$trios[tx$trios >= 2], 7)))
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

# --- C35 (Gonzalo, 2026-10-07). Los mapas muestran resultados del operativo, no avance: qué distritos entran al estudio, qué
# zonas (UMP) se intervinieron y qué manzanas se aplicaron. La zona es un conjunto de manzanas; por simplicidad el mapa de
# distrito pinta la zona y el detalle por manzana va en su propia lámina. Cartografía real del motor (IMP PlanMet 2040 para
# distritos, INEI 2017 para zonas y manzanas, api/inst/hojas_ruta/cartografia) y una selección ficticia, con semilla fija.
suppressMessages(library(sf)); sf::sf_use_s2(FALSE)
CART <- "api/inst/hojas_ruta/cartografia"
LIMA <- suppressMessages(sf::st_read(file.path(CART, "lima_district_coverage.json"), quiet = TRUE))
leer_capa <- function(capa, ubigeo) suppressMessages(sf::st_make_valid(sf::st_read(paste0("/vsigzip/", normalizePath(file.path(CART, capa, paste0(ubigeo, ".geojson.gz")))), quiet = TRUE)))
nombre_mapa <- function(d) { s <- gsub("\\b(De|Del|La|El|Los|Las)\\b", "\\L\\1", tools::toTitleCase(tolower(d)), perl = TRUE)
  s <- paste0(toupper(substr(s, 1, 1)), substring(s, 2))
  tildes <- c(Peru = "Perú", Rimac = "Rímac", Lurin = "Lurín", Maria = "María", Martin = "Martín", Jesus = "Jesús", Ancon = "Ancón")
  for (k in names(tildes)) s <- gsub(paste0("\\b", k, "\\b"), tildes[[k]], s); sub("Villa el Salvador", "Villa El Salvador", s, fixed = TRUE) }
LIMA$nom <- nombre_mapa(LIMA$distrito)
partir_nombre <- function(s) ifelse(nchar(s) > 13 & grepl(" de ", s), sub(" de ", " de\n", s), s)
GRIS_FUERA <- "#E2E6EC"; AZUL_SI <- "#2F4B7C"; AZUL_MEDIO <- "#9FB1D1"
caja_de <- function(x, m = 0.04) { bb <- sf::st_bbox(x); dx <- unname(bb[3] - bb[1]) * m; dy <- unname(bb[4] - bb[2]) * m
  sf::st_bbox(c(xmin = unname(bb[1]) - dx, ymin = unname(bb[2]) - dy, xmax = unname(bb[3]) + dx, ymax = unname(bb[4]) + dy), crs = sf::st_crs(x)) }
recortar <- function(x, bb) suppressWarnings(suppressMessages(sf::st_crop(sf::st_make_valid(x), bb)))
tema_mapa <- function(g) g + coord_sf(expand = FALSE, datum = NA) + theme_void() + theme(plot.background = element_blank(), panel.background = element_blank())
poner_mapa <- function(g, x, y, w, h) invisible(ph_with(doc, dml(ggobj = g, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = x, top = y, width = w, height = h)))
rotulos <- function(g, d, min_km2 = 20) { d <- d[d$area_km2 >= min_km2, ]; d$tc <- vapply(d$fill, texto_sobre, "")
  g + geom_text(data = d, aes(label_lon, label_lat, label = partir_nombre(nom), colour = tc), size = 10 / .pt, fontface = "bold", family = "Arial", lineheight = 0.85) + scale_colour_identity() }

# Selección ficticia, siempre la misma
grupo <- c(`SAN JUAN DE LURIGANCHO` = "Intervención", ATE = "Intervención", `EL AGUSTINO` = "Intervención", `SANTA ANITA` = "Intervención",
           `VILLA EL SALVADOR` = "Comparación", `VILLA MARIA DEL TRIUNFO` = "Comparación", `SAN JUAN DE MIRAFLORES` = "Comparación", CHORRILLOS = "Comparación")
pal_grupo <- c(`Intervención` = AZUL_SI, `Comparación` = AZUL_MEDIO)
zonas_sjl <- leer_capa("zonas_inei2017_lima_callao", "150132"); zonas_sjl <- zonas_sjl[!sf::st_is_empty(zonas_sjl), ]
set.seed(2026); semilla <- sample(seq_len(nrow(zonas_sjl)), 1)
vec <- sf::st_touches(zonas_sjl)                                          # zonas aplicadas: racimos de vecinas, como sale un sorteo por conglomerados
aplic <- unique(c(semilla, vec[[semilla]])); while (length(aplic) < 26) { s_ <- sample(setdiff(seq_len(nrow(zonas_sjl)), aplic), 1); aplic <- unique(c(aplic, s_, head(vec[[s_]], 2))) }
zonas_sjl$aplicada <- seq_len(nrow(zonas_sjl)) %in% aplic

# 1. Distritos del estudio: dos grupos en un solo mapa de Lima y Callao
MOTOR_ACT <- "PROPUESTA (p_mapa_cobertura_territorial, scope = overview): distritos del estudio por grupo"
doc <- nueva(doc); titulo(doc, "Distritos del estudio", ante = "Mapa territorial: distritos")
LIMA$fill <- ifelse(LIMA$distrito %in% names(grupo), pal_grupo[grupo[LIMA$distrito]], GRIS_FUERA)
# Encuadre en los distritos del estudio con Lima de contexto, y la lista con las encuestas de cada distrito (Gonzalo, 2026-10-08: «se ve bien vacío»)
bb1 <- caja_de(LIMA[LIMA$distrito %in% names(grupo), ], 0.1)
g1 <- ggplot() + geom_sf(data = recortar(LIMA, bb1), aes(fill = fill), colour = "#FFFFFF", linewidth = 0.4) + scale_fill_identity()
hm1 <- YF - YT - 0.45; wm1 <- 6.2
poner_mapa(tema_mapa(g1), XC, YT, wm1, hm1)
leyenda(doc, 0, YT + hm1 + 0.08, c(names(pal_grupo), "Fuera del estudio"), c(unname(pal_grupo), GRIS_FUERA), centrar_en = XC + wm1 / 2)
zona("los distritos del estudio con su contexto", XC, YT, wm1, hm1)
xr1 <- XC + wm1 + 0.8; wr1 <- W - MR - xr1; separador_v(doc, xr1 - 0.4, YT, YF - 0.1)
enc1 <- c(`SAN JUAN DE LURIGANCHO` = 124, ATE = 96, `EL AGUSTINO` = 58, `SANTA ANITA` = 52, `VILLA EL SALVADOR` = 101, `VILLA MARIA DEL TRIUNFO` = 88, `SAN JUAN DE MIRAFLORES` = 79, CHORRILLOS = 62)
for (gk in names(pal_grupo)) { k <- match(gk, names(pal_grupo)); yk <- YT + (k - 1) * 2.45; ds <- names(grupo)[grupo == gk]
  caja(doc, xr1, yk + 0.08, 0.2, 0.2, pal_grupo[[gk]]); txt(doc, paste("Distritos de", tolower(gk)), xr1 + 0.3, yk, wr1 - 1.3, 0.34, 14, TK$navy, bold = TRUE)
  txt(doc, "Encuestas", W - MR - 1.1, yk + 0.04, 1.1, 0.28, 10, TK$soft, bold = TRUE, align = "right")
  lista_ <- nombre_mapa(ds); for (j in seq_along(lista_)) { yj <- yk + 0.45 + (j - 1) * 0.38
    txt(doc, lista_[j], xr1 + 0.3, yj, wr1 - 1.4, 0.3, 12.5, TK$navy); txt(doc, enc1[[ds[j]]], W - MR - 1.1, yj, 1.1, 0.3, PT$cifra, TK$navy, bold = TRUE, align = "right") }
  separador_h(doc, xr1 + 0.3, W - MR, yk + 0.45 + length(ds) * 0.38 + 0.02)
  txt(doc, "Total", xr1 + 0.3, yk + 0.5 + length(ds) * 0.38, 1.5, 0.3, 12.5, TK$navy, bold = TRUE)
  txt(doc, sum(enc1[ds]), W - MR - 1.1, yk + 0.5 + length(ds) * 0.38, 1.1, 0.3, PT$cifra, TK$navy, bold = TRUE, align = "right") }
pie(doc, "Selección y cifras ficticias sobre la cartografía de Lima Metropolitana y Callao (IMP PlanMet 2040)")

# 2. Zonas aplicadas en un distrito (la zona representa a sus manzanas)
MOTOR_ACT <- "PROPUESTA (p_mapa_cobertura_territorial, scope = district): zonas aplicadas en el distrito"
doc <- nueva(doc); titulo(doc, "Zonas aplicadas en San Juan de Lurigancho", ante = "Mapa territorial: zonas")
zonas_sjl$fill <- ifelse(zonas_sjl$aplicada, AZUL_SI, "#FFFFFF")
g2 <- ggplot() + geom_sf(data = zonas_sjl, aes(fill = fill), colour = "#B8C2D3", linewidth = 0.15) + scale_fill_identity() +
  geom_sf(data = LIMA[LIMA$ubigeo == "150132", ], fill = NA, colour = TK$navy, linewidth = 0.6)
hm2 <- YF - YT - 0.45; wm2 <- 6.4
poner_mapa(tema_mapa(g2), XC, YT, wm2, hm2)
leyenda(doc, 0, YT + hm2 + 0.08, c("Zona aplicada", "Zona fuera de la muestra"), c(AZUL_SI, "#FFFFFF"), centrar_en = XC + wm2 / 2)
zona("distrito con sus zonas", XC, YT, wm2, hm2)
xr2 <- XC + wm2 + 0.8; wr2 <- W - MR - xr2; separador_v(doc, xr2 - 0.4, YT, YF - 0.1)
cifra(doc, xr2, YT, wr2, sprintf("%d", sum(zonas_sjl$aplicada)), "zonas aplicadas", sprintf("de %d zonas censales del distrito", nrow(zonas_sjl)))
separador_h(doc, xr2, W - MR, YT + 1.35)
notas2 <- c("Cada zona es un conjunto de manzanas. El mapa pinta la zona completa aunque se haya aplicado sólo en algunas de sus manzanas.",
            "Las zonas salen en racimos porque la muestra se sortea por conglomerados.", "El detalle por manzana va en una lámina propia o en el anexo.")
yn <- YT + 1.6; for (t_ in notas2) { h_ <- alto_txt(t_, wr2, 13); txt(doc, t_, xr2 - 0.1, yn, wr2 + 0.1, h_, 13, TK$navy); yn <- yn + h_ + 0.2 }
pie(doc, "Selección ficticia sobre las zonas censales INEI 2017 de San Juan de Lurigancho")

# 3. Manzanas aplicadas dentro de sus zonas (acercamiento a un racimo)
MOTOR_ACT <- "PROPUESTA (p_mapa_cobertura_territorial, study_blocks): manzanas aplicadas dentro de sus zonas"
doc <- nueva(doc); titulo(doc, "Manzanas aplicadas en un racimo de zonas", ante = "Mapa territorial: manzanas")
racimo <- zonas_sjl[unique(c(semilla, vec[[semilla]])), ]; bb3 <- caja_de(racimo, 0.12)
mz <- leer_capa("manzanas_inei2017_lima_callao", "150132"); mz <- recortar(mz, bb3)
mz$zona_id <- paste0("150132", mz$CODZONA, mz$SUFZONA)
en_racimo <- mz$zona_id %in% racimo$IDZONA
set.seed(7); mz$aplicada <- en_racimo & stats::runif(nrow(mz)) < 0.32
mz$fill <- ifelse(mz$aplicada, AZUL_SI, ifelse(en_racimo, AZUL_MEDIO, GRIS_FUERA))
g3 <- ggplot() + geom_sf(data = mz, aes(fill = fill), colour = "#FFFFFF", linewidth = 0.15) + scale_fill_identity() +
  geom_sf(data = recortar(zonas_sjl, bb3), fill = NA, colour = "#8E9DBD", linewidth = 0.25) +
  geom_sf(data = racimo, fill = NA, colour = TK$navy, linewidth = 0.7)
hm3 <- YF - YT - 0.45; wm3 <- 7.4
poner_mapa(tema_mapa(g3), XC, YT, wm3, hm3)
leyenda(doc, 0, YT + hm3 + 0.08, c("Manzana aplicada", "Otra manzana de la zona", "Fuera de la muestra"), c(AZUL_SI, AZUL_MEDIO, GRIS_FUERA), centrar_en = XC + wm3 / 2)
zona("manzanas del racimo", XC, YT, wm3, hm3)
xr3 <- XC + wm3 + 0.8; wr3 <- W - MR - xr3; separador_v(doc, xr3 - 0.4, YT, YF - 0.1)
cifra(doc, xr3, YT, wr3, sprintf("%d", sum(mz$aplicada)), "manzanas aplicadas", sprintf("en %d zonas, de %d manzanas", nrow(racimo), sum(en_racimo)))
separador_h(doc, xr3, W - MR, YT + 1.35)
txt(doc, "El borde oscuro marca las zonas aplicadas y el claro, las vecinas. Dentro de cada zona sólo se pintan las manzanas que se visitaron.",
    xr3 - 0.1, YT + 1.55, wr3 + 0.1, 1.6, 13, TK$navy)
pie(doc, "Selección ficticia sobre las manzanas INEI 2017. La lámina se usa para el informe metodológico o el anexo de campo")

# 4. Dos grupos comparados: zonas aplicadas en un distrito de intervención y uno de comparación
MOTOR_ACT <- "PROPUESTA (p_mapa_cobertura_territorial, comparison_mode = paired_district): zonas aplicadas por grupo"
doc <- nueva(doc); titulo(doc, "Zonas aplicadas en intervención y comparación", ante = "Mapa territorial: dos grupos")
zonas_ves <- leer_capa("zonas_inei2017_lima_callao", "150142"); zonas_ves <- zonas_ves[!sf::st_is_empty(zonas_ves), ]
set.seed(42); vv <- sf::st_touches(zonas_ves); s0 <- sample(seq_len(nrow(zonas_ves)), 1); ap2 <- unique(c(s0, vv[[s0]]))
while (length(ap2) < 18) { s_ <- sample(setdiff(seq_len(nrow(zonas_ves)), ap2), 1); ap2 <- unique(c(ap2, s_, head(vv[[s_]], 2))) }
zonas_ves$fill <- ifelse(seq_len(nrow(zonas_ves)) %in% ap2, AZUL_MEDIO, "#FFFFFF")
wm4 <- (AC - 0.6) / 2; hm4 <- YF - YT - 1.1
panel_titulo(doc, XC, YT, wm4, "Intervención: San Juan de Lurigancho", sprintf("%d de %d zonas", sum(zonas_sjl$aplicada), nrow(zonas_sjl)))
poner_mapa(tema_mapa(ggplot() + geom_sf(data = zonas_sjl, aes(fill = fill), colour = "#B8C2D3", linewidth = 0.15) + scale_fill_identity()), XC, YT + 0.6, wm4, hm4)
separador_v(doc, XC + wm4 + 0.3, YT, YT + hm4 + 0.6)
panel_titulo(doc, XC + wm4 + 0.6, YT, wm4, "Comparación: Villa El Salvador", sprintf("%d de %d zonas", length(ap2), nrow(zonas_ves)))
poner_mapa(tema_mapa(ggplot() + geom_sf(data = zonas_ves, aes(fill = fill), colour = "#B8C2D3", linewidth = 0.15) + scale_fill_identity()), XC + wm4 + 0.6, YT + 0.6, wm4, hm4)
leyenda(doc, 0, YT + hm4 + 0.7, c("Zona aplicada, intervención", "Zona aplicada, comparación", "Fuera de la muestra"), c(AZUL_SI, AZUL_MEDIO, "#FFFFFF"), centrar_en = XC + AC / 2)
zona("dos distritos, un color por grupo", XC, YT + 0.6, AC, hm4)
pie(doc, "Selección ficticia sobre las zonas censales INEI 2017. Cada grupo conserva su color en todas las láminas")

if (NUEVA) {   # sólo en la propuesta de diseño; la fiel conserva sus láminas
# --- Más mapas para 2.7 (Gonzalo, 2026-10-08: «faltan más ejemplos de mapas: uno de Lima, otro distrital con leyenda, otro con un solo
# distrito, otro con distrito con zonas y manzanas»). Claves m3e:8 a m3e:10; cifras ficticias.
# 8. Lima completa: un resultado por distrito, en clases, con el valor de cada distrito al lado
MOTOR_ACT <- "PROPUESTA (p_mapa_resultado_distrital): un indicador por distrito en clases, con el ranking al costado"
doc <- nueva(doc); titulo(doc, "Satisfacción con el servicio por distrito", ante = "Mapa de Lima: resultado por distrito")
res8 <- c(`SAN JUAN DE LURIGANCHO` = 58, ATE = 64, `EL AGUSTINO` = 51, `SANTA ANITA` = 69, `VILLA EL SALVADOR` = 73, `VILLA MARIA DEL TRIUNFO` = 61,
          `SAN JUAN DE MIRAFLORES` = 66, CHORRILLOS = 77, COMAS = 55, `LOS OLIVOS` = 71, `SAN MARTIN DE PORRES` = 68, CALLAO = 49)
cortes8 <- c(0, 55, 65, 75, 100); clases8 <- c("Menos de 55 %", "55 a 64 %", "65 a 74 %", "75 % a más"); pal8 <- c("#C9D5EA", "#8EA3C6", "#4F6B9E", TK$navy)
LIMA$fill8 <- ifelse(LIMA$distrito %in% names(res8), pal8[cut(res8[LIMA$distrito], cortes8, right = FALSE, labels = FALSE)], GRIS_FUERA)
hm8 <- YF - YT - 0.45; wm8 <- 4.6
poner_mapa(tema_mapa(ggplot() + geom_sf(data = LIMA, aes(fill = fill8), colour = "#FFFFFF", linewidth = 0.3) + scale_fill_identity()), XC, YT, wm8, hm8)
leyenda(doc, 0, YT + hm8 + 0.08, c(clases8, "Sin encuestas"), c(pal8, GRIS_FUERA), centrar_en = XC + AC / 2)
zona("Lima Metropolitana y Callao completos", XC, YT, wm8, hm8)
xr8 <- XC + wm8 + 0.7; separador_v(doc, xr8 - 0.35, YT, YF - 0.45)
o8 <- order(-res8); panel_titulo(doc, xr8, YT, W - MR - xr8, "Satisfechos o muy satisfechos", "Por distrito, de mayor a menor")
for (k in seq_along(o8)) { d_ <- names(res8)[o8[k]]; v_ <- res8[[d_]]; yk <- YT + 0.62 + (k - 1) * 0.33; wb8 <- (W - MR - xr8 - 2.9) * v_ / 100
  txt(doc, nombre_mapa(d_), xr8, yk, 2.35, 0.28, 11, TK$navy, align = "right")
  caja(doc, xr8 + 2.45, yk + 0.05, wb8, 0.2, pal8[cut(v_, cortes8, right = FALSE, labels = FALSE)])
  txt(doc, paste0(v_, "%"), xr8 + 2.5 + wb8, yk - 0.01, 0.6, 0.28, 11, TK$navy, bold = TRUE) }
pie(doc, "Cifras ficticias. Doce distritos con encuestas sobre la cartografía de Lima Metropolitana y Callao (IMP PlanMet 2040)")

# 9. Un solo distrito: ubicación en Lima y sus zonas según las encuestas logradas
MOTOR_ACT <- "PROPUESTA (p_mapa_cobertura_territorial, scope = district): un distrito, con su ubicación y las encuestas por zona"
doc <- nueva(doc); titulo(doc, "Encuestas logradas en Comas", ante = "Mapa territorial: un distrito")
zonas_ate <- leer_capa("zonas_inei2017_lima_callao", "150110"); zonas_ate <- zonas_ate[!sf::st_is_empty(zonas_ate), ]
set.seed(103); n9 <- nrow(zonas_ate); v9 <- rep(0, n9); vt <- sf::st_touches(zonas_ate); s9 <- sample(seq_len(n9), 4)
for (s_ in s9) { r_ <- unique(c(s_, head(vt[[s_]], 5))); v9[r_] <- sample(c(2:12), length(r_), replace = TRUE) }
cl9 <- c("Sin encuestas", "1 a 4", "5 a 8", "9 a 12"); pal9 <- c("#FFFFFF", "#C9D5EA", "#6F88B5", TK$navy)
zonas_ate$fill <- pal9[1 + (v9 > 0) + (v9 >= 5) + (v9 >= 9)]
wl9 <- 2.6; hl9 <- 3.0
poner_mapa(tema_mapa(ggplot() + geom_sf(data = LIMA, fill = GRIS_FUERA, colour = "#FFFFFF", linewidth = 0.2) +
  geom_sf(data = LIMA[LIMA$ubigeo == "150110", ], fill = TK$navy, colour = TK$navy, linewidth = 0.3)), XC, YT + 0.4, wl9, hl9)
txt(doc, "Ubicación en Lima", XC, YT, wl9, 0.3, 11, TK$soft, bold = TRUE, align = "center")
xm9 <- XC + wl9 + 0.3; wm9 <- 6.3; hm9 <- YF - YT - 0.45
poner_mapa(tema_mapa(ggplot() + geom_sf(data = zonas_ate, aes(fill = fill), colour = "#B8C2D3", linewidth = 0.15) + scale_fill_identity()), xm9, YT, wm9, hm9)
leyenda(doc, 0, YT + hm9 + 0.08, cl9, pal9, centrar_en = xm9 + wm9 / 2)
zona("el distrito con sus zonas", xm9, YT, wm9, hm9)
xr9 <- xm9 + wm9 + 0.6; wr9 <- W - MR - xr9; separador_v(doc, xr9 - 0.3, YT, YF - 0.1)
cifra(doc, xr9, YT, wr9, format(sum(v9), big.mark = ","), "encuestas logradas", sprintf("en %d de %d zonas", sum(v9 > 0), n9), size = 36)
separador_h(doc, xr9, W - MR, YT + 1.45)
txt(doc, "El recuadro ubica el distrito en Lima. El mapa grande pinta cada zona según cuántas encuestas se lograron en ella.", xr9 - 0.1, YT + 1.65, wr9 + 0.1, 1.6, 12.5, TK$navy)
pie(doc, "Cifras ficticias sobre las zonas censales INEI 2017 de Comas")

# 10. Un distrito con sus zonas y manzanas en el mismo mapa
MOTOR_ACT <- "PROPUESTA (p_mapa_cobertura_territorial, study_blocks, scope = district): zonas y manzanas aplicadas en todo el distrito"
doc <- nueva(doc); titulo(doc, "Zonas y manzanas aplicadas en Villa El Salvador", ante = "Mapa territorial: zonas y manzanas")
zonas_ag <- leer_capa("zonas_inei2017_lima_callao", "150142"); zonas_ag <- zonas_ag[!sf::st_is_empty(zonas_ag), ]
set.seed(111); va <- sf::st_touches(zonas_ag); s10 <- sample(seq_len(nrow(zonas_ag)), 1); ap10 <- unique(c(s10, va[[s10]]))
while (length(ap10) < 20) { s_ <- sample(setdiff(seq_len(nrow(zonas_ag)), ap10), 1); ap10 <- unique(c(ap10, s_, head(va[[s_]], 2))) }
zonas_ag$aplicada <- seq_len(nrow(zonas_ag)) %in% ap10
mz10 <- leer_capa("manzanas_inei2017_lima_callao", "150142"); mz10$zona_id <- paste0("150142", mz10$CODZONA, mz10$SUFZONA)
en10 <- mz10$zona_id %in% zonas_ag$IDZONA[zonas_ag$aplicada]; set.seed(12); mz10$aplicada <- en10 & stats::runif(nrow(mz10)) < 0.3
mz10$fill <- ifelse(mz10$aplicada, TK$navy, ifelse(en10, AZUL_MEDIO, "#FFFFFF"))
hm10 <- YF - YT - 0.45; wm10 <- 7.6
poner_mapa(tema_mapa(ggplot() + geom_sf(data = mz10, aes(fill = fill), colour = "#D5DBE5", linewidth = 0.08) + scale_fill_identity() +
  geom_sf(data = zonas_ag, fill = NA, colour = "#8E9DBD", linewidth = 0.2) + geom_sf(data = zonas_ag[zonas_ag$aplicada, ], fill = NA, colour = TK$navy, linewidth = 0.55)), XC, YT, wm10, hm10)
leyenda(doc, 0, YT + hm10 + 0.08, c("Manzana aplicada", "Otra manzana de una zona aplicada", "Fuera de la muestra"), c(TK$navy, AZUL_MEDIO, "#FFFFFF"), centrar_en = XC + wm10 / 2)
zona("todo el distrito, con zonas y manzanas", XC, YT, wm10, hm10)
xr10 <- XC + wm10 + 0.7; wr10 <- W - MR - xr10; separador_v(doc, xr10 - 0.35, YT, YF - 0.1)
cifra(doc, xr10, YT, wr10, sprintf("%d", sum(zonas_ag$aplicada)), "zonas aplicadas", sprintf("de %d zonas del distrito", nrow(zonas_ag)), size = 36)
separador_h(doc, xr10, W - MR, YT + 1.45)
cifra(doc, xr10, YT + 1.65, wr10, sprintf("%d", sum(mz10$aplicada)), "manzanas aplicadas", sprintf("de %d manzanas en esas zonas", sum(en10)), size = 36)
separador_h(doc, xr10, W - MR, YT + 3.1)
txt(doc, "El borde oscuro marca cada zona aplicada. Dentro de ella, la manzana visitada va en azul oscuro.", xr10 - 0.1, YT + 3.3, wr10 + 0.1, 1.2, 12.5, TK$navy)
pie(doc, "Selección ficticia sobre las zonas y manzanas censales INEI 2017 de Villa El Salvador")
}
