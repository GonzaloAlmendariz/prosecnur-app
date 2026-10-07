# Recetario v2, sección 07: escenarios de acreditación (M10). Se carga tras recetario_m3e.R.
# Sale de reconstruir informes reales de 10 proyectos 2024-2026 (catálogo de escenarios del
# checklist, H45 a H70). Decisión de Gonzalo: FORMA REAL (escalas, actores, n y bases de cada
# proyecto) con PORCENTAJES FICTICIOS; ningún resultado de cliente queda en el repo.
# Lo cualitativo queda fuera: el motor sólo ve lo cuantitativo.

# f sintético: porcentajes ficticios con su n coherente
sf <- function(pct, valid) { n <- round(pct * valid / 100); list(pct = pct, n = n, valid = valid) }
fila_s <- function(actor, pct, valid) list(actor = actor, f = sf(pct, valid))
ACT6 <- c("Estudiantes", "Egresados", "Docentes", "Autoridades", "Administrativos", "Empleadores")
COL_ACT6 <- c("#0B4F8C", "#2A9D8F", "#E9C46A", "#8E9DBD", "#081F5C", "#9DC3E6")

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "IV.1", "Actores y bases", "Hasta seis actores, bases filtradas, cohortes y bases chicas", icono = "library")

xr <- ML + col2 + GAP

# --- C1 un ítem, seis actores, con Top Two Box (Geografía 2024: 48 láminas así)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce, 6 actores). Robustez: la escala se reconoce por significado («Totalmente…», «Completamente…», «… 4», mayúsculas) y SIN INF va siempre al final (H57, H58, H64, H65)"
p6 <- list(texto = "La carrera cuenta con un cuerpo académico suficiente en número, dedicación y calificaciones",
  filas = list(fila_s("Estudiantes", c(3, 23, 46, 28, 0), 39), fila_s("Egresados", c(0, 22, 61, 15, 2), 67), fila_s("Docentes", c(0, 33, 56, 11, 0), 18),
               fila_s("Autoridades", c(0, 8, 50, 42, 0), 12), fila_s("Administrativos", c(0, 0, 18, 29, 53), 17), fila_s("Empleadores", c(4, 12, 46, 31, 7), 26)))
doc <- laminas_likert(doc, "Cuerpo académico según seis actores", "Seis actores", list(p6),
  "Base: 39 estudiantes, 67 egresados, 18 docentes, 12 autoridades, 17 administrativos y 26 empleadores")

# --- C20 partición con muchos actores: 6 actores y 4 ítems no caben en una lámina
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce, 6 actores). Partición «(cont.)» sin encoger la letra"
set.seed(11)
it <- c("La carrera tiene un plan de estudios actualizado", "Los sílabos se cumplen durante el ciclo", "La evaluación del aprendizaje es coherente con las competencias", "Las prácticas preprofesionales están bien articuladas")
ns <- c(39, 67, 18, 12, 17, 26)
mk <- function() { a <- sample(0:5, 1); b <- sample(5:25, 1); s <- sample(0:6, 1); c_ <- sample(30:60, 1); d <- 100 - a - b - s - c_; c(a, b, c_, d, s) }
part6 <- lapply(it, function(t) list(texto = t, filas = lapply(seq_along(ACT6), function(i) fila_s(ACT6[i], mk(), ns[i]))))
doc <- laminas_likert(doc, "Plan de estudios según seis actores", "Partición con seis actores", part6,
  "Base: 39 estudiantes, 67 egresados, 18 docentes, 12 autoridades, 17 administrativos y 26 empleadores")

# --- C16 competencias: lo que dicen los egresados frente a lo que ven los empleadores (Derecho, AMDT)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_1_grafico: p_barras_multiapiladas (var_cruce, 2 actores por competencia) con Top Two Box" else "p_slide_1_grafico: p_dumbbell (Top Two Box de egresados frente a empleadores) + tabla"
comp <- data.frame(c = c("Aprendizaje autónomo y adaptabilidad", "Ética, ciudadanía y conciencia ambiental", "Comunicación eficaz", "Pensamiento crítico y creativo", "Investigación, creación e innovación", "Habilidades colaborativas"),
                   eg = c(93, 95, 88, 91, 74, 90), em = c(100, 87, 93, 100, 100, 93))
if (ESTILO == "moderna") {
  doc <- nueva(doc); titulo(doc, "Competencias genéricas: egresados y empleadores", ante = "Dos actores, dos miradas")
  comp <- comp[order(-(comp$em - comp$eg)), ]; wl <- 3.7; xb <- ML + wl + 0.3; wb <- 5.6; y0 <- YT + 0.55; lo <- 70
  for (t in seq(70, 100, 10)) { xx <- xb + wb * (t - lo) / 30; caja(doc, xx, y0 - 0.05, 0.006, nrow(comp) * 0.62, TK$rule); txt(doc, paste0(t, "%"), xx - 0.3, y0 - 0.35, 0.6, 0.24, 10, TK$faint, align = "center") }
  txt(doc, "Diferencia", xb + wb + 0.45, y0 - 0.38, 1.6, 0.26, 10, TK$soft, bold = TRUE, align = "center")
  for (k in seq_len(nrow(comp))) { yc <- y0 + (k - 1) * 0.62 + 0.18; a <- comp$eg[k]; b <- comp$em[k]
    txt(doc, comp$c[k], ML, yc - 0.17, wl, 0.34, 12.5, TK$navy, bold = TRUE, align = "right")
    caja(doc, xb + wb * (min(a, b) - lo) / 30, yc - 0.01, wb * abs(b - a) / 30, 0.02, TK$faint)
    caja(doc, xb + wb * (a - lo) / 30 - 0.1, yc - 0.1, 0.2, 0.2, TK$actores[["Egresados"]], geom = "ellipse")
    caja(doc, xb + wb * (b - lo) / 30 - 0.1, yc - 0.1, 0.2, 0.2, TK$navy, geom = "ellipse")
    d <- b - a; txt(doc, sprintf("%+d pts", d), xb + wb + 0.45, yc - 0.17, 1.6, 0.34, 12, if (d < 0) TK$coral else TK$verde_txt, bold = TRUE, align = "center") }
  leyenda(doc, 0, Y_LEY - 0.05, c("Egresados (autopercepción)", "Empleadores (evaluación)"), c(TK$actores[["Egresados"]], TK$navy), centrar_en = xb + wb / 2)
  zona("dumbbell, eje 70 a 100 %", xb, y0, wb, nrow(comp) * 0.62)
  pie(doc, "Top Two Box por competencia. Base: 314 egresados y 15 empleadores")
} else {
  mkp <- function(t) { a <- 1; b <- 100 - t - a; c(a, b, round(t * .5), t - round(t * .5), 0) }
  pr <- lapply(seq_len(nrow(comp)), function(k) list(texto = comp$c[k], filas = list(fila_s("Egresados", mkp(comp$eg[k]), 314), fila_s("Empleadores", c(0, 100 - comp$em[k], round(comp$em[k] * .45), comp$em[k] - round(comp$em[k] * .45), 0), 15))))
  doc <- laminas_likert(doc, "Competencias genéricas: egresados y empleadores", "Dos actores, dos miradas", pr, "Base: 314 egresados y 15 empleadores")
}

# --- C7 opción múltiple comparada entre actores (Derecho «canales de difusión»; no hay constructor: H68)
MOTOR_ACT <- if (ESTILO == "fiel") "PROPUESTA (H68): barras agrupadas por actor para una opción múltiple multibase" else "PROPUESTA (H68): puntos por actor en cada opción (dot plot), ordenado por el promedio"
doc <- nueva(doc); titulo(doc, "Canales por los que conocen la misión y la visión", ante = "Opción múltiple entre actores")
can <- c("Página web de la Facultad", "Redes sociales", "Reuniones con autoridades", "Correo institucional", "Inducción", "Sesiones de clase", "Otro")
cv <- rbind(Docentes = c(68, 16, 51, 26, 22, 0, 6), Estudiantes = c(53, 36, 6, 22, 0, 27, 3), Administrativos = c(73, 9, 26, 18, 11, 0, 4))
ord <- c(order(-colMeans(cv[, -7])), 7); can <- can[ord]; cv <- cv[, ord]; ca <- TK$actores[c("Docentes", "Estudiantes")]; ca <- c(ca, Administrativos = "#E9C46A")
wl <- 3.0; xb <- ML + wl + 0.25; wb <- if (ESTILO == "moderna") 7.4 else 7.8; y0 <- YT + 0.45
if (ESTILO == "moderna") {
  for (t in c(0, 25, 50, 75)) { xx <- xb + wb * t / 100; caja(doc, xx, y0 - 0.05, 0.006, 7 * 0.6, TK$rule); txt(doc, paste0(t, "%"), xx - 0.3, y0 - 0.35, 0.6, 0.24, 10, TK$faint, align = "center") }
  for (k in seq_along(can)) { yc <- y0 + (k - 1) * 0.6 + 0.2
    txt(doc, can[k], ML, yc - 0.17, wl, 0.34, 12.5, TK$navy, bold = can[k] != "Otro", align = "right")
    caja(doc, xb + wb * min(cv[, k]) / 100, yc - 0.01, wb * (max(cv[, k]) - min(cv[, k])) / 100, 0.02, TK$faint)
    for (a in rownames(cv)) caja(doc, xb + wb * cv[a, k] / 100 - 0.09, yc - 0.09, 0.18, 0.18, ca[[a]], geom = "ellipse") }
  zona("puntos por actor, eje 0 a 75 %", xb, y0, wb, 7 * 0.6)
} else {
  for (k in seq_along(can)) { yc <- y0 + (k - 1) * 0.62
    txt(doc, can[k], ML, yc + 0.08, wl, 0.34, 12, TK$navy, bold = TRUE, align = "right")
    for (j in 1:3) { v <- cv[j, k]; yy <- yc + (j - 1) * 0.17; caja(doc, xb, yy, max(0.02, wb * v / 100), 0.15, ca[[j]])
      txt(doc, paste0(v, "%"), xb + wb * v / 100 + 0.06, yy - 0.06, 0.6, 0.26, 10, TK$navy, bold = TRUE) } }
  zona("barras agrupadas por actor", xb, y0, wb, 7 * 0.62) }
leyenda(doc, 0, Y_LEY - 0.05, names(ca), unname(ca), centrar_en = xb + wb / 2)
pie(doc, "Opción múltiple: los porcentajes se calculan sobre el total de cada actor y pueden sumar más de 100. Base: 148 docentes, 1,234 estudiantes y 43 administrativos")

# --- C5 pregunta filtro y subpregunta con su propia base (Psicología movilidad, Ingeniería IA)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_2_graficos: p_pie (filtro) + p_barras_apiladas (subpregunta, base propia declarada: H50)" else "PROPUESTA (desglose conectado, abajo): p_slide_2_graficos_vertical con dicotómica + subpregunta y cuña que une el segmento «Sí» con su desglose (H50)"
doc <- nueva(doc); titulo(doc, "Movilidad estudiantil y su valoración", ante = "Pregunta filtro y subpregunta")
xr <- ML + col2 + GAP
if (ESTILO == "fiel") {
  panel_titulo(doc, ML, YT, col2, "¿Ha participado en programas de intercambio?", "201 estudiantes")
  torta(doc, ML + (col2 - 2.6) / 2, YT + 0.9, 2.6, c("Sí", "No"), c(10, 90))
  separador_v(doc, ML + col2 + GAP / 2, YT, YF)
  panel_titulo(doc, xr, YT, col2, "Los programas de intercambio fortalecen mis competencias", "Base propia: 20 estudiantes que participaron")
  likert_panel(doc, xr, YT + 1.3, col2, list(list(lab = "Participaron", f = sf(c(10, 0, 55, 35, 0), 20))), g = 0.7, fila = 1.1, wlab = 1.3)
} else {
  panel_titulo(doc, ML, YT, ANCHO, "¿Ha participado en programas de intercambio?", "201 estudiantes")
  yb_fin <- dicotomia(doc, ML, YT + 0.5, ANCHO, c("Sí", "No"), c(10, 90), n = c(20, 181), size = 26, g = 0.42)
  y2 <- yb_fin + 0.85; wl2 <- 1.6; g2 <- 0.62; fila2 <- 0.95; ylp <- y2 + 0.45
  ybar <- ylp + 0.3 + (fila2 - g2) / 2 + 0.05; xb2 <- ML + wl2 + 0.12; wb2 <- ANCHO - wl2 - 0.12 - 0.75
  zoom_conector(doc, c(ML, yb_fin, ML + ANCHO * 0.10, yb_fin), c(xb2, ybar, xb2 + wb2, ybar))
  txt(doc, "Los programas de intercambio fortalecen mis competencias", ML + ANCHO * 0.10 + 0.6, y2, 8, 0.3, 13, TK$navy, bold = TRUE)
  txt(doc, "Sólo los 20 estudiantes que respondieron «Sí»", ML + ANCHO * 0.10 + 0.6, y2 + 0.27, 8, 0.26, 10.5, TK$faint)
  likert_panel(doc, ML, ylp, ANCHO, list(list(lab = "Participaron (20)", f = sf(c(10, 0, 55, 35, 0), 20))), g = g2, fila = fila2, wlab = wl2)
  zona("desglose conectado: el segmento «Sí» se abre en su subpregunta", ML, YT + 0.5, ANCHO, ybar + g2 - YT - 0.5)
}
leyenda(doc, 0, Y_LEY - 0.1, LIKERT_ROT[1:4], TK$likert[1:4], centrar_en = W / 2)
pie(doc, "Base: 201 estudiantes. La subpregunta, 20 estudiantes que participaron")

# --- B4 perfil laboral: rangos ORDINALES en su orden natural (Ingeniería; H51)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_2_graficos: p_pie (dicotómica) + p_barras_agrupadas con orden del instrumento (orden_barras = «instrumento» u orden manual que manda: H51)" else "PROPUESTA (desglose conectado, al costado): dicotómica + p_barras_agrupadas ordinal y cuña desde el segmento «Sí» (H50, H51)"
doc <- nueva(doc); titulo(doc, "Condición laboral e ingresos del egresado", ante = "Filtro al costado")
panel_titulo(doc, ML, YT, col2, "¿Trabaja de manera dependiente?", "205 egresados")
ing <- c("De S/ 1,501 a S/ 2,500", "De S/ 2,501 a S/ 3,500", "De S/ 3,501 a S/ 4,500", "De S/ 4,501 a S/ 5,500", "S/ 5,501 a más", "Prefiero no responder")
if (ESTILO == "fiel") {
  torta(doc, ML + (col2 - 2.6) / 2, YT + 0.9, 2.6, c("Sí", "No"), c(87, 13), n = c(179, 26))
  separador_v(doc, ML + col2 + GAP / 2, YT, YF)
  panel_titulo(doc, xr, YT, col2, "¿Cuál es su ingreso mensual aproximado? (en soles)", "Base propia: 179 egresados dependientes")
} else {
  wd <- 4.9; yb_fin <- dicotomia(doc, ML, YT + 1.75, wd, c("No", "Sí"), c(13, 87), n = c(26, 179), size = 30, g = 0.5, cols = rev(TK$dico))   # «Sí» pegado al desglose
  zoom_conector(doc, c(ML + wd, yb_fin - 0.5, ML + wd, yb_fin), c(xr - 0.25, YT + 0.75, xr - 0.25, YT + 0.75 + 6 * 0.7))
  panel_titulo(doc, xr, YT, col2, "¿Cuál es su ingreso mensual aproximado? (en soles)", "Sólo los 179 que trabajan de manera dependiente")
}
barras_h(doc, xr, YT + 0.85, col2, ing, c(8, 16, 22, 20, 31, 3), wlab = 2.4, g = grosor_cat(6), fila = 0.7, size = 13)
pie(doc, "Base: 205 egresados. El ingreso, 179 que trabajan de manera dependiente. Los rangos van en su orden, no por frecuencia")

# --- C14 bases por cohorte (Geografía: egresados 2019 a 2023 frente a antes de 2019)
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var con filtros por cohorte. Una fila por base declarada)"
coh <- list(list(texto = "La formación recibida responde a las demandas del mercado laboral",
                 filas = list(fila_s("2019 a 2023", c(2, 14, 55, 27, 2), 67), fila_s("Antes de 2019", c(5, 22, 51, 18, 4), 115))),
            list(texto = "Recomendaría la carrera a otras personas",
                 filas = list(fila_s("2019 a 2023", c(1, 6, 38, 54, 1), 67), fila_s("Antes de 2019", c(3, 9, 44, 41, 3), 115))))
doc <- laminas_likert(doc, "Valoración de la carrera por cohorte de egreso", "Bases por cohorte", coh, "Base: 67 egresados de 2019 a 2023 y 115 egresados antes de 2019")
# --- B2 perfil de un actor con base chica (autoridades, n = 12): frecuencias, no porcentajes
MOTOR_ACT <- "p_slide_4_graficos_poblacion: p_barras_agrupadas x4 con formato_valor = «n» cuando la base es menor de 30 (PROPUESTA de regla)"
doc <- nueva(doc); titulo(doc, "Perfil de las autoridades", ante = "Base chica")
h2 <- (YF - YT - 0.35) / 2; cel <- list(list(x = ML, y = YT), list(x = xr, y = YT), list(x = ML, y = YT + h2 + 0.35), list(x = xr, y = YT + h2 + 0.35))
separador_v(doc, ML + col2 + GAP / 2, YT, YF); separador_h(doc, ML, W - MR, YT + h2 + 0.15)
pan <- list(list("Cargo", c("Decano(a) o director(a)", "Coordinador(a)", "Jefe(a) de departamento", "Secretario(a) académico(a)"), c(2, 5, 3, 2)),
            list("Años en el cargo", c("Menos de 2 años", "De 2 a 4 años", "Más de 4 años"), c(4, 6, 2)),
            list("Sexo", c("Mujer", "Hombre"), c(7, 5)),
            list("Máximo grado alcanzado", c("Magíster", "Doctor(a)"), c(5, 7)))
for (k in 1:4) { c_ <- cel[[k]]; p_ <- pan[[k]]
  panel_titulo(doc, c_$x, c_$y, col2, p_[[1]], "12 autoridades")
  if (length(p_[[2]]) == 2 && ESTILO == "moderna") dicotomia(doc, c_$x, c_$y + 0.7, min(col2, 5.2), p_[[2]], round(100 * p_[[3]] / 12), n = p_[[3]], size = 22, g = 0.34) else {
    wl <- 2.4; xb <- c_$x + wl + 0.2; wb <- col2 - wl - 1.2
    for (j in seq_along(p_[[2]])) { yc <- c_$y + 0.62 + (j - 1) * 0.42; v <- p_[[3]][j]
      txt(doc, p_[[2]][j], c_$x, yc, wl, 0.3, 12, TK$navy, align = "right")
      caja(doc, xb, yc + 0.04, wb * v / max(p_[[3]]), 0.24, if (ESTILO == "moderna" && v == max(p_[[3]])) TK$navy else if (ESTILO == "moderna") TK$tenue else TK$navy)
      txt(doc, if (ESTILO == "moderna") sprintf("%d de 12", v) else sprintf("%d%% (%d)", round(100 * v / 12), v), xb + wb * v / max(p_[[3]]) + 0.08, yc, 1.1, 0.3, 12, TK$navy, bold = TRUE) } } }
pie(doc, "Base: 12 autoridades. Con menos de 30 casos, la moderna rotula frecuencias («5 de 12») y no porcentajes")

# --- B5 perfil de los empleadores con base chica (AMDT, Contabilidad, Derecho): cuatro paneles
MOTOR_ACT <- "p_slide_4_graficos_poblacion: p_pie (sector) + p_barras_agrupadas x3, con formato_valor = «n» cuando la base es menor de 30 (PROPUESTA de regla)"
doc <- nueva(doc); titulo(doc, "Perfil de los empleadores", ante = "Base chica en cuatro paneles")
separador_v(doc, ML + col2 + GAP / 2, YT, YF); separador_h(doc, ML, W - MR, YT + h2 + 0.15)
pe <- list(list("Sector de la organización", c("Privado", "Público", "ONG u organismo internacional"), c(14, 9, 3)),
           list("Tamaño de la organización", c("Grande (más de 250 trabajadores)", "Mediana (50 a 250)", "Pequeña (menos de 50)"), c(12, 8, 6)),
           list("Cargo de quien responde", c("Gerente o director(a)", "Jefe(a) de área", "Coordinador(a) o supervisor(a)", "Recursos humanos"), c(8, 9, 5, 4)),
           list("Años de vínculo con egresados de la carrera", c("Menos de 3 años", "De 3 a 5 años", "Más de 5 años"), c(6, 9, 11)))
for (k in 1:4) { c_ <- cel[[k]]; p_ <- pe[[k]]; tot <- sum(p_[[3]])
  panel_titulo(doc, c_$x, c_$y, col2, p_[[1]], sprintf("%d empleadores", tot))
  wl <- 2.9; xb <- c_$x + wl + 0.2; wb <- col2 - wl - 1.3
  for (j in seq_along(p_[[2]])) { yc <- c_$y + 0.62 + (j - 1) * 0.42; v <- p_[[3]][j]
    txt(doc, p_[[2]][j], c_$x, yc, wl, 0.3, 12, TK$navy, align = "right")
    caja(doc, xb, yc + 0.04, wb * v / max(p_[[3]]), 0.24, if (ESTILO == "moderna" && v == max(p_[[3]])) TK$navy else if (ESTILO == "moderna") TK$tenue else TK$navy)
    txt(doc, if (ESTILO == "moderna") sprintf("%d de %d", v, tot) else sprintf("%d%% (%d)", round(100 * v / tot), v), xb + wb * v / max(p_[[3]]) + 0.08, yc, 1.2, 0.3, 12, TK$navy, bold = TRUE) } }
pie(doc, "Base: 26 empleadores que contratan o supervisan egresados de la carrera")

# --- B3 perfil de empleadores y comité consultivo como tabla (AMDT, Contabilidad, Derecho)
MOTOR_ACT <- "p_slide_1_grafico: p_tabla (conteos por tipo de institución y sector)"
doc <- nueva(doc); titulo(doc, "Perfil de los empleadores participantes", ante = "Perfil en tabla")
emp <- data.frame(Sector = c("Privado", "Privado", "Público", "Público", "ONG u organismo internacional", "Educativo e investigación"),
  `Tipo de institución` = c("Empresa grande", "Empresa mediana o pequeña", "Ministerio u organismo nacional", "Gobierno regional o local", "Organismo internacional", "Universidad o centro de investigación"),
  Empleadores = c(9, 5, 4, 3, 2, 3), check.names = FALSE)
emp$`%` <- paste0(round(100 * emp$Empleadores / sum(emp$Empleadores)), "%")
emp <- rbind(emp, data.frame(Sector = "Total", `Tipo de institución` = "Todas", Empleadores = sum(emp$Empleadores), `%` = "100%", check.names = FALSE))
ft <- flextable(emp) |> font(fontname = TK$font, part = "all") |> fontsize(size = 13, part = "all") |> color(color = TK$navy, part = "all") |>
  bold(part = "header") |> bold(i = nrow(emp)) |> width(j = 1, width = 3.4) |> width(j = 2, width = 4.6) |> width(j = 3:4, width = 1.7) |>
  align(j = 3:4, align = "center", part = "all") |> border_remove() |> padding(padding.top = 9, padding.bottom = 9, part = "all") |>
  merge_v(j = 1) |> valign(j = 1, valign = "center")
ft <- if (ESTILO == "fiel") ft |> bg(part = "header", bg = TK$coral) |> color(part = "header", color = "#FFFFFF") |> border_inner_h(border = fp_border(color = "#757070", width = 0.5)) |> border_outer(border = fp_border(color = "#757070", width = 0.75)) else
  ft |> hline_top(border = fp_border(color = TK$navy, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = TK$navy, width = 0.75), part = "header") |>
    hline(i = 1:(nrow(emp) - 1), border = fp_border(color = TK$rule, width = 0.5)) |> bg(i = nrow(emp), bg = TK$zebra) |> color(part = "header", color = TK$soft)
invisible(ph_with(doc, ft, location = ph_location(left = ML + 0.75, top = YT + 0.2, width = 11.4, height = 4)))
zona("tabla de conteos", ML + 0.75, YT + 0.2, 11.4, 4)
pie(doc, "Base: 26 empleadores")

