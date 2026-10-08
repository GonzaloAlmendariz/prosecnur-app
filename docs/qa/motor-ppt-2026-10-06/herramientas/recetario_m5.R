# Recetario v2, sección 07 (tanda 2): más escenarios de acreditación (M10). Se carga tras
# recetario_m4.R y usa sus helpers sf() y fila_s(). Forma real (escalas tal como vienen en las
# bases de Psicología, Geografía, Derecho e Ingeniería), porcentajes ficticios.

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "IV.2", "Escalas, etiquetas y formatos", "Escalas con otra redacción, «Otros», todos los números, ítems largos y cortos, láminas mixtas", icono = "lightbulb")


xr <- ML + col2 + GAP

# --- C15 utilidad de los objetivos educacionales (Ingeniería)
MOTOR_ACT <- "p_slide_1_grafico_narrativo: p_barras_multiapiladas (modo var), escala de utilidad con Top Two Box"
ROT_UTIL <- c("Nada útil", "Poco útil", "Útil", "Totalmente útil", "SIN INF")
oe <- list(list(texto = "OE1: Diseña soluciones de ingeniería sostenibles y seguras", filas = list(fila_s("", c(1, 2, 31, 66, 0), 131))),
           list(texto = "OE2: Gestiona proyectos en equipos multidisciplinarios", filas = list(fila_s("", c(1, 10, 31, 57, 1), 131))),
           list(texto = "OE3: Se actualiza de forma permanente en su campo profesional", filas = list(fila_s("", c(0, 4, 38, 58, 0), 131))),
           list(texto = "OE4: Actúa con ética y responsabilidad social", filas = list(fila_s("", c(0, 3, 29, 67, 1), 131))))
doc <- laminas_likert(doc, "Utilidad de los objetivos educacionales", "Escala de utilidad", oe, "Base: 131 egresados", rotulos = ROT_UTIL)

# --- C15b autopercepción de competencias (Ingeniería)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo var), escala de competencia con Top Two Box"
ROT_COMP <- c("Nada competente", "Poco competente", "Competente", "Totalmente competente", "SIN INF")
ap <- lapply(list(c("Diseña soluciones de ingeniería", 1, 7, 40, 52, 0), c("Gestiona proyectos", 2, 8, 47, 43, 0), c("Se comunica de forma efectiva", 1, 6, 45, 48, 0),
                  c("Trabaja en equipos multidisciplinarios", 0, 3, 35, 62, 0), c("Investiga e innova", 3, 15, 50, 31, 1)),
  function(r) list(texto = r[1], filas = list(fila_s("", as.numeric(r[2:6]), 131))))
doc <- laminas_likert(doc, "Autopercepción de competencias del egresado", "Escala de competencia", ap, "Base: 131 egresados", rotulos = ROT_COMP)

# --- C15c importancia (Derecho)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce), escala de importancia con Top Two Box"
ROT_IMP <- c("Nada importante", "Poco importante", "Importante", "Muy importante", "SIN INF")
imp <- list(list(texto = "Importancia de las prácticas preprofesionales en la formación",
                 filas = list(fila_s("Estudiantes", c(1, 4, 33, 60, 2), 1234), fila_s("Egresados", c(0, 3, 28, 68, 1), 314), fila_s("Docentes", c(0, 2, 38, 58, 2), 148))),
            list(texto = "Importancia de la investigación en la formación",
                 filas = list(fila_s("Estudiantes", c(3, 15, 46, 33, 3), 1234), fila_s("Egresados", c(2, 12, 45, 39, 2), 314), fila_s("Docentes", c(1, 6, 41, 50, 2), 148))))
doc <- laminas_likert(doc, "Importancia de las experiencias formativas", "Escala de importancia", imp, "Base: 1,234 estudiantes, 314 egresados y 148 docentes", rotulos = ROT_IMP)

# --- C3 satisfacción con servicios y «No he usado el servicio» dentro de la base (Psicología, Derecho, Educación)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce). Robustez: la opción «No he usado» sólo existe en estudiantes. Se iguala por significado y va al final en gris (H58)"
ROT_SAT <- c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No he usado el servicio")
sat <- list(list(texto = "Servicio de comedor y espacios para consumo de alimentos",
                 filas = list(fila_s("Estudiantes", c(9, 25, 49, 15, 2), 201), fila_s("Docentes", c(7, 21, 59, 14, 0), 92), fila_s("Administrativos", c(8, 20, 64, 8, 0), 25))),
            list(texto = "Servicio médico de la universidad",
                 filas = list(fila_s("Estudiantes", c(6, 20, 36, 19, 19), 201), fila_s("Docentes", c(1, 16, 61, 22, 0), 92), fila_s("Administrativos", c(12, 16, 64, 8, 0), 25))))
doc <- laminas_likert(doc, "Satisfacción con los servicios de bienestar", "Satisfacción con «No he usado»", sat,
  "Base: 201 estudiantes, 92 docentes y 25 administrativos. «No he usado el servicio» cuenta en la base", rotulos = ROT_SAT)

# --- C17 batería Sí/No por actor, con «No sabe» (Derecho «servicio de salud», Educación)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce, dicotómica con «No sabe» al final en gris)"
sino <- list(list(texto = "¿Conoce el servicio de salud de la universidad?",
                  filas = list(fila_s("Estudiantes", c(78, 15, 7), 1234), fila_s("Docentes", c(91, 6, 3), 148), fila_s("Administrativos", c(95, 5, 0), 43))),
             list(texto = "¿Conoce el servicio de bienestar psicológico?",
                  filas = list(fila_s("Estudiantes", c(84, 11, 5), 1234), fila_s("Docentes", c(72, 20, 8), 148), fila_s("Administrativos", c(60, 30, 10), 43))))
doc <- laminas_likert(doc, "Servicios de salud y bienestar", "Sí, No y No sabe", sino, "Base: 1,234 estudiantes, 148 docentes y 43 administrativos",
  cols = c(TK$dico, "#BFBFBF"), rotulos = c("Sí", "No", "No sabe"), ttb_col = FALSE)

# --- C18 perfil laboral extendido (Geografía, Derecho, Ingeniería)
MOTOR_ACT <- "p_slide_3_graficos_1mas2: p_barras_agrupadas (ordinal con residual al final) + p_barras_agrupadas + p_barras_apiladas"
doc <- nueva(doc); titulo(doc, "Inserción laboral del egresado", ante = "Escala ordinal con residual")
panel_titulo(doc, ML, YT, col2, "¿Cuánto tiempo le tomó conseguir su primer empleo?", "314 egresados")
barras_h(doc, ML, YT + 0.8, col2, c("Menos de 2 meses", "Entre 2 y 5 meses", "Entre 6 meses y un año", "Más de un año", "No he encontrado trabajo"),
         c(38, 31, 17, 9, 5), wlab = 2.3, g = grosor_cat(5), fila = 0.78, size = 13)
separador_v(doc, ML + col2 + GAP / 2, YT, YF)
panel_titulo(doc, xr, YT, col2, "Sector en el que trabaja", "Base propia: 298 egresados que trabajan")
barras_h(doc, xr, YT + 0.6, col2, c("Privado", "Público", "Estudio propio o independiente", "ONG u organismo internacional", "Educativo e investigación", "Otro"),
         c(46, 27, 14, 6, 5, 2), wlab = 2.5, g = grosor_cat(6), fila = 0.36, size = 11.5)
separador_h(doc, xr, xr + col2, YT + 3.0)
panel_titulo(doc, xr, YT + 3.15, col2, "Su trabajo se relaciona con la formación recibida", "298 egresados que trabajan")
likert_panel(doc, xr, YT + 3.55, col2, list(list(lab = "Egresados", f = sf(c(2, 9, 41, 47, 1), 298))), g = 0.42, fila = 0.7, wlab = 1.2)
pie(doc, "Base: 314 egresados. Sector y relación con la formación, 298 que trabajan. El tiempo va en su orden y «No he encontrado trabajo» al final")

# --- C11 «% (n)» en todas las barras (pedido de Ingeniería: «todos los números»)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_agrupadas con mostrar_frecuencia = TRUE (preset por proyecto: H49)"
doc <- nueva(doc); titulo(doc, "Herramientas de inteligencia artificial que usa", ante = "Todos los números")
ia_l <- c("IA generativa (ChatGPT, Copilot, etc.)", "Automatización inteligente (RPA + IA)", "Analítica avanzada", "Machine Learning", "Visión computacional", "No precisa")
ia_p <- c(99, 13, 11, 7, 1, 1); ia_n <- round(ia_p * 174 / 100)
panel_titulo(doc, ML, YT, ANCHO, "¿Qué herramientas de inteligencia artificial usa en sus funciones laborales?", "Opción múltiple: 174 egresados que usan IA. Los porcentajes pueden sumar más de 100")
yy <- YT + 0.95; wl <- 4.4; xb <- ML + wl + 0.25; wb <- W - MR - xb - 1.6   # deja 1.6 in al rótulo «99% (172)» dentro del margen
for (k in seq_along(ia_l)) { yc <- yy + (k - 1) * 0.74; resid <- ia_l[k] == "No precisa"
  txt(doc, ia_l[k], ML, yc, wl, 0.36, 14, TK$navy, bold = !resid, align = "right")
  colb <- if (resid) TK$faint else if (ESTILO == "moderna" && k > 1) TK$tenue else TK$navy
  wv <- max(0.03, wb * ia_p[k] / 100); caja(doc, xb, yc + 0.01, wv, 0.36, colb)
  txt(doc, sprintf("%d%% (%d)", ia_p[k], ia_n[k]), xb + wv + 0.1, yc, 1.6, 0.36, 14, TK$navy, bold = TRUE) }
zona("barras con «% (n)»", xb, yy, wb, 6 * 0.74)
pie(doc, "Base: 174 egresados que usan IA en sus funciones laborales")

# --- C6 «Otros» aparte: agrupado, contado y ordenado (Ingeniería Mecánica; el motor hoy vuelca crudo: H45, H46)
MOTOR_ACT <- "auto_otros_slides: PROPUESTA (agrupar por texto normalizado, contar, ordenar y repartir en 2 columnas. Sólo si hay 5 o más respuestas: H45, H46)"
doc <- nueva(doc); titulo(doc, "Respuestas «Otros»: ¿cuál es su puesto actual?", ante = "Otros aparte")
otros <- data.frame(t = c("Ingeniero de proyectos", "Ingeniero de diseño", "Ingeniero de aplicaciones", "Planificador de mantenimiento", "Ingeniero de diseño mecánico",
  "Ingeniero de tuberías", "Ingeniero mecánico", "Ingeniero mecánico intermedio", "Asesor técnico comercial", "Comprador corporativo", "Consultor técnico",
  "Ejecutivo comercial", "Ejecutivo de riesgos", "Gestor comercial", "Gestor de proyectos", "Ingeniera de manufactura", "Ingeniero de estrategias",
  "Ingeniero de mantenimiento mecánico", "Ingeniero de planeamiento", "Ingeniero de procesos de información", "Ingeniero de soporte de producto", "Ingeniero de ventas"),
  n = c(7, 6, 5, 5, 2, 2, 2, 2, rep(1, 14)))
half <- ceiling(nrow(otros) / 2); wc <- (ANCHO - GAP) / 2
for (cc in 1:2) { ix <- if (cc == 1) 1:half else (half + 1):nrow(otros); x <- ML + (cc - 1) * (wc + GAP)
  for (j in seq_along(ix)) { k <- ix[j]; yc <- YT + 0.1 + (j - 1) * 0.42
    if (ESTILO == "moderna") { caja(doc, x, yc + 0.08, 0.5 * otros$n[k] / max(otros$n) + 0.04, 0.2, if (otros$n[k] > 1) TK$navy else TK$tenue)
      txt(doc, otros$n[k], x + 0.62, yc, 0.4, 0.34, 12, TK$navy, bold = TRUE); txt(doc, otros$t[k], x + 1.0, yc, wc - 1.0, 0.34, 12, TK$navy) }
    else txt(doc, sprintf("•  %s (%d)", otros$t[k], otros$n[k]), x, yc, wc, 0.34, 12, TK$navy) } }
zona("dos columnas, orden por frecuencia", ML, YT + 0.1, ANCHO, half * 0.42)
pie(doc, "Base: 62 respuestas en «Otros» en la pregunta ¿Cuál es su puesto actual?")

# --- C19 opción múltiple de un actor con residuales al final (Ingeniería)
MOTOR_ACT <- "p_slide_1_grafico_narrativo: p_barras_agrupadas (select_multiple)"
sm <- D$ing_p35
doc <- nueva(doc); titulo(doc, "Qué podría mejorar la carrera", ante = "Opción múltiple de un actor")
o <- order(-sm$pct); lab <- sm$labels[o]; pc <- sm$pct[o]; ot <- grepl("^Otros$|^No sabe", lab)
lab <- c(lab[!ot], lab[ot]); pc <- c(pc[!ot], pc[ot]); lab <- lab[pc > 0]; pc <- pc[pc > 0]
preg_ <- sub(" de Ingeniería Mecánica", "", sm$pregunta, fixed = TRUE)   # sin la carrera del estudio de origen (C7)
txt(doc, preg_, ML, Y_DATOS - 0.15, 12.2, alto_txt(preg_, 12.2, 13), 13, TK$navy, bold = ESTILO == "fiel")
if (ESTILO == "moderna") txt(doc, "% de encuestados que marcó cada opción", ML + 6.72, Y_DATOS + 0.3, 5, 0.26, 10, TK$soft, bold = TRUE)
yy0 <- Y_DATOS + 0.6; resid <- grepl("^Otros$|^No sabe", lab)
barras_h(doc, ML, yy0, W - ML - MR, lab[!resid], pc[!resid], wlab = 6.6, g = grosor_cat(length(pc)), fila = 0.46, size = 12, escala = max(pc) * 1.08)
if (any(resid)) barras_h(doc, ML, yy0 + sum(!resid) * 0.46, W - ML - MR, lab[resid], pc[resid], wlab = 6.6, g = grosor_cat(length(pc)), fila = 0.46, size = 12, escala = max(pc) * 1.08,
                         color = if (ESTILO == "moderna") TK$faint else TK$navy)
pie(doc, "Base: 131 egresados")

# --- C9 conteos por año apilados (Psicología: entidades que reconocieron la labor docente)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_1_grafico: p_barras_apiladas en columnas con conteos (variable año × entidad)" else "PROPUESTA: matriz de conteos con total por año (heatmap), en vez de columnas de 9 colores"
doc <- nueva(doc); titulo(doc, "Entidades que reconocieron la labor docente por año", ante = "Conteos por año")
ent <- c("Dirección Académica del Profesorado", "Facultad", "Departamento académico", "Universidad", "Escuela de Posgrado", "Vicerrectorado Académico", "Otras entidades")
cnt <- rbind(c(0, 2, 3, 3, 5), c(3, 3, 3, 4, 2), c(1, 1, 1, 1, 2), c(1, 3, 2, 4, 2), c(0, 0, 1, 3, 1), c(1, 1, 2, 2, 0), c(0, 0, 1, 1, 2)); anos <- 2020:2024
if (ESTILO == "moderna") {
  wl <- 3.3; xc <- ML + wl + 0.25; wcol <- 0.9; y0 <- YT + 0.5; hr <- 0.5
  for (j in seq_along(anos)) txt(doc, anos[j], xc + (j - 1) * wcol, y0 - 0.4, wcol, 0.3, 12, TK$soft, bold = TRUE, align = "center")
  txt(doc, "Total", xc + 5 * wcol + 0.2, y0 - 0.4, 1, 0.3, 12, TK$soft, bold = TRUE, align = "center")
  for (i in seq_along(ent)) { yc <- y0 + (i - 1) * hr
    txt(doc, ent[i], ML, yc + 0.07, wl, 0.34, 12, TK$navy, bold = TRUE, align = "right")
    for (j in seq_along(anos)) { v <- cnt[i, j]; fill <- if (v == 0) TK$fondo else grDevices::colorRampPalette(c("#D6DEEE", TK$navy))(6)[min(6, v + 1)]
      caja(doc, xc + (j - 1) * wcol + 0.04, yc + 0.03, wcol - 0.08, hr - 0.06, fill)
      if (v > 0) txt(doc, v, xc + (j - 1) * wcol, yc + 0.07, wcol, 0.34, 13, texto_sobre(fill), bold = TRUE, align = "center") }
    txt(doc, sum(cnt[i, ]), xc + 5 * wcol + 0.2, yc + 0.07, 1, 0.34, 13, TK$navy, bold = TRUE, align = "center") }
  separador_h(doc, xc, xc + 5 * wcol + 1.2, y0 + length(ent) * hr + 0.05)
  txt(doc, "Total", ML, y0 + length(ent) * hr + 0.12, wl, 0.34, 12, TK$soft, bold = TRUE, align = "right")
  for (j in seq_along(anos)) txt(doc, sum(cnt[, j]), xc + (j - 1) * wcol, y0 + length(ent) * hr + 0.12, wcol, 0.34, 13, TK$navy, bold = TRUE, align = "center")
  zona("matriz de conteos, celda 0,9 x 0,5 in", xc, y0, 5 * wcol, length(ent) * hr)
  # C39 («No se entiende el caso de uso de este»): la lámina dice cuándo se usa y por qué una matriz, sin lectura atada al ejemplo.
  xp <- xc + 5 * wcol + 1.55; wp <- W - MR - xp; separador_v(doc, xp - 0.35, YT, YT + 4.6)
  bloques <- list(c("Cuándo se usa", "Cuando la pregunta registra hechos con fecha y cada persona puede marcar varios: quién intervino y en qué año."),
                  c("Por qué una matriz", "Son pocos casos y se cuentan, no se porcentúan. La matriz muestra dónde y cuándo se concentran."))
  yp <- YT
  for (b in bloques) { txt(doc, b[1], xp, yp, wp, 0.3, 12, TK$soft, bold = TRUE); h_ <- alto_txt(b[2], wp, 13)
    txt(doc, b[2], xp, yp + 0.32, wp, h_, 13, TK$navy); yp <- yp + 0.32 + h_ + 0.15 }
} else {
  dfc <- data.frame(ano = factor(rep(anos, each = length(ent))), ent = factor(rep(ent, times = 5), levels = rev(ent)), v = as.vector(cnt))
  pal <- c("#081F5C", "#0B4F8C", "#2A9D8F", "#9DC3E6", "#E9C46A", "#F4B183", "#BFBFBF")
  gc <- ggplot(dfc[dfc$v > 0, ], aes(ano, v, fill = ent)) + geom_col(width = 0.6) + geom_text(aes(label = v, colour = ent), position = position_stack(vjust = 0.5), size = 11 / .pt, fontface = "bold", family = "Arial", show.legend = FALSE) +
    scale_colour_manual(values = setNames(vapply(rev(pal), texto_sobre, ""), levels(dfc$ent)), guide = "none") +
    scale_fill_manual(values = setNames(rev(pal), levels(dfc$ent))) + labs(x = NULL, y = NULL, fill = NULL) + theme_minimal(base_family = "Arial") +
    theme(plot.background = element_blank(), panel.background = element_blank(), legend.position = "right", legend.text = element_text(size = 11, colour = TK$navy), axis.text = element_text(size = 12, colour = TK$navy, face = "bold"), panel.grid = element_blank(), axis.text.y = element_blank())
  invisible(ph_with(doc, dml(ggobj = gc, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML, top = YT, width = ANCHO - 0.6, height = YF - YT)))
  zona("columnas apiladas con conteos", ML, YT, ANCHO - 0.6, YF - YT) }
pie(doc, "Conteo de reconocimientos declarados por 26 docentes que respondieron «Sí». Un docente puede declarar varios")

# --- C21 largo de la etiqueta: ítems muy largos y muy cortos (pedido de Gonzalo)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo var). Ítems de más de 200 caracteres: la columna de texto se ensancha y la lámina se parte. La letra no baja de 13 pt"
largos <- list(
  list(texto = "Las autoridades de la Facultad informan oportunamente a la comunidad académica sobre las decisiones que afectan el desarrollo de la carrera, sus planes de mejora y los resultados de los procesos de evaluación y autoevaluación institucional", filas = list(fila_s("", c(4, 18, 52, 24, 2), 148))),
  list(texto = "La carrera cuenta con recursos humanos, técnicos y financieros suficientes para desarrollar actividades de investigación, desarrollo tecnológico e innovación, y difunde sus resultados en revistas indizadas y eventos académicos nacionales e internacionales", filas = list(fila_s("", c(6, 24, 47, 20, 3), 148))),
  list(texto = "Los mecanismos de admisión, permanencia y graduación están claramente definidos, se difunden a los estudiantes desde el primer ciclo y se aplican de manera transparente y consistente para todos los postulantes y estudiantes", filas = list(fila_s("", c(2, 11, 55, 31, 1), 148))))
doc <- laminas_likert(doc, "Gestión institucional: afirmaciones extensas", "Etiquetas largas", largos, "Base: 148 docentes. Ítems de 220 a 260 caracteres, tal como vienen en el cuestionario")
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo var). Ítems de 1 a 3 palabras: la columna de texto se angosta y la barra gana ancho"
cortos <- lapply(list(c("Biblioteca", 2, 8, 50, 39, 1), c("Laboratorios", 4, 16, 52, 26, 2), c("Aulas", 3, 12, 58, 26, 1), c("Wifi", 9, 27, 44, 18, 2), c("Áreas deportivas", 3, 10, 47, 33, 7), c("Estacionamiento", 11, 24, 38, 12, 15)),
  function(r) list(texto = r[1], filas = list(fila_s("", as.numeric(r[2:6]), 1234))))
doc <- laminas_likert(doc, "Satisfacción con la infraestructura", "Etiquetas cortas", cortos, "Base: 1,234 estudiantes", rotulos = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "SIN INF"))

# --- C22 lámina mixta: dos preguntas apiladas con escalas o actores distintos (pedido de Gonzalo)
# Cada bloque lleva su pregunta, sus actores, su leyenda y su Top Two Box sólo si su escala lo tiene.
bloque_mixto <- function(doc, bloques) {
  ytot <- YF - YT; y <- YT
  fijo <- 1.2; nfil <- sum(vapply(bloques, function(b) length(b$filas), 0)); sep <- 0.3 * (length(bloques) - 1)
  pedido <- sum(vapply(bloques, function(b) length(b$filas) * b$fila, 0))
  disp <- ytot - fijo * length(bloques) - sep
  if (pedido > disp) { k_ <- disp / pedido                      # no cabe: las filas ceden aire, la letra no
    for (i in seq_along(bloques)) { bloques[[i]]$fila <- bloques[[i]]$fila * k_; bloques[[i]]$g <- min(bloques[[i]]$g, bloques[[i]]$fila - 0.16) } }
  hs <- vapply(bloques, function(b) 0.45 + 0.3 + length(b$filas) * b$fila + 0.45, 0)
  esp <- (ytot - sum(hs)) / max(1, length(bloques) - 1)
  for (i in seq_along(bloques)) { b <- bloques[[i]]
    panel_titulo(doc, ML, y, ANCHO, b$pregunta, b$sub)
    likert_panel(doc, ML, y + 0.45, ANCHO, b$filas, g = b$g, fila = b$fila, wlab = 2.2, ttb_col = b$ttb, cols = b$cols, size_lab = 12)
    yl <- y + 0.45 + 0.3 + length(b$filas) * b$fila + 0.08
    leyenda(doc, 0, yl, b$rot, b$cols[seq_along(b$rot)], centrar_en = ML + 2.4 + (ANCHO - 2.4 - (if (b$ttb) 0.75 else 0)) / 2)
    y <- y + hs[i] + esp
    if (i < length(bloques)) separador_h(doc, ML, W - MR, y - esp / 2) }
}
lf <- function(lab, pct, n) list(lab = lab, f = sf(pct, n))
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo multilista: bloque 1 var_cruce de acuerdo con 2 actores. Bloque 2 var_cruce dicotómico con 3 actores)"
doc <- nueva(doc); titulo(doc, "Tutoría y reglamentos", ante = "Lámina mixta: otra pregunta, otros actores")
bloque_mixto(doc, list(
  list(pregunta = "La Unidad cuenta con servicios de tutoría académica", sub = "Escala de acuerdo", ttb = TRUE, cols = TK$likert, rot = LIKERT_ROT, g = 0.42, fila = 0.78,
       filas = list(lf("Docentes", c(2, 8, 54, 21, 15), 148), lf("Estudiantes", c(6, 18, 34, 19, 23), 1234))),
  list(pregunta = "¿Conoce el reglamento de prácticas preprofesionales?", sub = "Sí o No", ttb = FALSE, cols = TK$dico, rot = c("Sí", "No"), g = 0.36, fila = 0.52,
       filas = list(lf("Estudiantes", c(64, 36), 1234), lf("Egresados", c(71, 29), 314), lf("Administrativos", c(88, 12), 43)))))
pie(doc, "Base: 148 docentes y 1,234 estudiantes (tutoría). 1,234 estudiantes, 314 egresados y 43 administrativos (reglamento)")

MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo multilista: mismos actores, bloque de acuerdo y bloque de satisfacción, cada uno con su leyenda)"
doc <- nueva(doc); titulo(doc, "Orientación académica: valoración y satisfacción", ante = "Lámina mixta: mismos actores, otra escala")
bloque_mixto(doc, list(
  list(pregunta = "La carrera brinda orientación académica oportuna", sub = "Escala de acuerdo", ttb = TRUE, cols = TK$likert, rot = LIKERT_ROT, g = 0.42, fila = 0.78,
       filas = list(lf("Estudiantes", c(4, 17, 52, 25, 2), 1234), lf("Egresados", c(3, 14, 55, 26, 2), 314))),
  list(pregunta = "Satisfacción con el servicio de orientación académica", sub = "Escala de satisfacción", ttb = TRUE, cols = TK$likert,
       rot = c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No he usado el servicio"), g = 0.42, fila = 0.78,
       filas = list(lf("Estudiantes", c(5, 15, 44, 21, 15), 1234), lf("Egresados", c(3, 12, 49, 24, 12), 314)))))
pie(doc, "Base: 1,234 estudiantes y 314 egresados. «No he usado el servicio» cuenta en la base")

if (ESTILO == "moderna") { MOTOR_ACT <- "PROPUESTA: columna Bottom Two Box y fila Total separada (bloque_likert)"; doc <- rr_b2b(doc) }   # integrado desde las propuestas
