# Recetario: láminas de población (con ícono) y de cifras (loop M2c).
# Se carga desde recetario.R después de recetario_m2b.R.

CEN <- ICONO_MODO == "centro"   # sólo en ese modo se reserva el hueco central
eg_sexo <- fr("egresados", "p5"); eg_trab <- fr("egresados", "p11"); eg_rel <- fr("egresados", "p12")
do_sexo <- fr("docentes", "p5"); do_gr <- fr("docentes", "p6"); do_ed <- fr("docentes", "p4_recod"); do_dep <- fr("docentes", "p7")
es_sexo <- D$genero; es_rango <- D$rango; es_ciclo <- D$ciclo; edad <- D$edad$x[!is.na(D$edad$x)]
t1 <- D$titulo

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "III.2", "Láminas de población y de cifras", "El perfil de cada público en una sola mirada", icono = ICONO_SECCION[4])

# --- p_slide_2_graficos_poblacion: dos gráficos con ícono al centro
MOTOR_ACT <- "p_slide_2_graficos_poblacion: p_barras_agrupadas x2 + ícono"
doc <- nueva(doc); ICONO_TIT <- "graduation-cap"; titulo(doc, "Perfil del estudiante", ante = "Población: dos gráficos")
gi <- if (CEN) 1.8 else 0.8; wp <- (ANCHO - gi) / 2; xr2 <- ML + wp + gi
if (!CEN) separador_v(doc, ML + wp + gi / 2, YT + 0.6, YF - 0.2)
panel_titulo(doc, ML, YT + 0.7, wp, "Sexo", "172 respuestas")
dicotomia(doc, ML, YT + 1.55, wp, es_sexo$labels[1:2], es_sexo$pct[1:2], es_sexo$n[1:2], size = 30, g = 0.5)
icono_poblacion(doc, "graduation-cap", W / 2, YT + 2.55, 1.35)
panel_titulo(doc, xr2, YT + 0.7, wp, "Rango de edades", "172 respuestas")
barras_h(doc, xr2, YT + 1.35, wp, es_rango$labels, es_rango$pct, wlab = 1.9, g = grosor_cat(4), fila = 0.82, size = 12)
pie(doc, "Base: 172 estudiantes")

# --- p_slide_3_graficos_poblacion_tira: ícono a la izquierda y tres franjas
MOTOR_ACT <- "p_slide_3_graficos_poblacion_tira: p_barras_multiapiladas (dicotómica) x3 + ícono"
doc <- nueva(doc); ICONO_TIT <- "user-check"; titulo(doc, "Perfil del egresado en tres franjas", ante = "Población: tira")
icono_poblacion(doc, "user-check", ML + 1.05, YT + 2.45, 1.5)
xt <- if (CEN) ML + 2.4 else ML; wt <- W - MR - xt
franjas <- list(list(t = "Sexo", f = eg_sexo), list(t = "¿Cuenta con título universitario?", f = t1), list(t = "¿Está trabajando actualmente?", f = eg_trab))
for (k in 1:3) { yk <- YT + (k - 1) * 1.68
  panel_titulo(doc, xt, yk, 3.9, franjas[[k]]$t, paste(franjas[[k]]$f$valid, "respuestas"))   # columna propia: no pisa las cifras
  dicotomia(doc, xt + 4.2, yk - 0.05, wt - 4.2, franjas[[k]]$f$labels[1:2], franjas[[k]]$f$pct[1:2], franjas[[k]]$f$n[1:2], size = 20, g = 0.32)
  if (k < 3) separador_h(doc, xt, W - MR, yk + 1.38) }
pie(doc, "Base: 178 egresados")

# --- p_slide_3_graficos_poblacion_corona: ícono al centro y tres gráficos alrededor
MOTOR_ACT <- "p_slide_3_graficos_poblacion_corona: p_barras_agrupadas x3 + ícono"
doc <- nueva(doc); ICONO_TIT <- "users"; titulo(doc, "Perfil del docente", ante = "Población: corona")
gi <- if (CEN) 2.0 else 0.8; wc <- (ANCHO - gi) / 2; xc2 <- ML + wc + gi
if (!CEN) separador_v(doc, ML + wc + gi / 2, YT, YT + 2.15)
panel_titulo(doc, ML, YT, wc, "Sexo", "52 respuestas")
dicotomia(doc, ML, YT + 0.65, wc, do_sexo$labels[1:2], do_sexo$pct[1:2], do_sexo$n[1:2], size = 24, g = 0.38)
panel_titulo(doc, xc2, YT, wc, "Máximo grado alcanzado", "52 respuestas")
barras_h(doc, xc2, YT + 0.55, wc, do_gr$labels, do_gr$pct, wlab = 1.4, g = grosor_cat(3), fila = 0.42)
icono_poblacion(doc, "users", W / 2, YT + 1.15, 1.15)
separador_h(doc, ML, W - MR, YT + 2.35)
panel_titulo(doc, ML, YT + 2.55, ANCHO, "Rango de edades", "52 respuestas")
barras_h(doc, ML + 2.5, YT + 3.1, ANCHO - 5, do_ed$labels, do_ed$pct, wlab = 1.9, g = grosor_cat(4), fila = 0.42)
pie(doc, "Base: 52 docentes")

# --- C24 (Gonzalo, 2026-10-07: «hay que definirlos, explicarlos: dónde pueden ir, si ocupan un gráfico, medio gráfico o un
# solo recuadro, qué proporción»): la cifra destacada como elemento (anatomía) y sus cuatro ubicaciones con su proporción.
MOTOR_ACT <- "Reglas: la cifra destacada (cifra) como elemento de lámina"
doc <- nueva(doc); titulo(doc, "La cifra destacada", ante = "Población y cifras")
xa <- XC; ya <- YT + 0.35; wa <- 4.4
caja(doc, xa, ya, wa, 2.3, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75))
cifra(doc, xa + 0.45, ya + 0.45, wa - 0.9, "172", "estudiantes encuestados", "96 % de los matriculados")
xm_ <- xa + 0.45 + 0.22 + c(ancho_tinta("172", 34, TRUE), ancho_tinta("estudiantes encuestados", 12, TRUE), ancho_tinta("96 % de los matriculados", 10))
partes_c <- list(c(ya + 0.45 + 0.31, "1", "Valor", "34 pt en negrita. Lleva su unidad cuando no es un conteo: «22 años», «69 %»"),
                 c(ya + 0.45 + 0.77, "2", "Rótulo", "12 pt en negrita. Dice qué se contó, en dos a cinco palabras"),
                 c(ya + 0.45 + 1.03, "3", "Detalle", "10 pt en gris. El denominador o la referencia que vuelve legible el valor"))
xt_ <- xa + wa + 0.8
for (k in seq_along(partes_c)) { p_ <- partes_c[[k]]; yk <- as.numeric(p_[1]); yt_ <- YT + 0.35 + (k - 1) * 0.78
  marca(doc, p_[2], xm_[k], yk - 0.15, d = 0.28)
  marca(doc, p_[2], xt_ - 0.2, yt_ - 0.01)
  txt(doc, p_[3], xt_ + 0.25, yt_, 3, 0.3, 14, TK$navy, bold = TRUE)
  txt(doc, p_[4], xt_ + 0.25, yt_ + 0.3, W - MR - xt_ - 0.25, 0.32, 12, TK$soft) }
separador_h(doc, XC, W - MR, YT + 2.95)
txt(doc, "Cuándo se usa", XT, YT + 3.15, AC, 0.3, 12, TK$soft, bold = TRUE)
lista_marcada(doc, c("Para un dato que el lector debe retener: cuántos respondieron, una tasa, una mediana.",
                     "Se calcula desde la base, como cualquier gráfico.",
                     "Hasta cuatro por lámina. Si hacen falta más, van a una tabla."),
  XC, YT + 3.55, AC, paso = 0.42, size = 13)
zona("anatomía de la cifra", xa, ya, wa, 2.3)
pie(doc, "")

MOTOR_ACT <- "Reglas: dónde va la cifra destacada (p_slide_3_graficos_poblacion_cifras, p_slide_cifras_y_graficos)"
doc <- nueva(doc); titulo(doc, "Dónde va la cifra destacada", ante = "Población y cifras")
gapk <- 0.35; wk4 <- (AC - 3 * gapk) / 4; hk4 <- 1.9; yk4 <- YT - 0.05
mini_cifra <- function(x, y, w) { caja(doc, x, y, min(w, 0.55), 0.16, TK$navy); caja(doc, x, y + 0.23, min(w, 0.8), 0.05, TK$faint) }
cota <- function(x0, x1, y, t) { caja(doc, x0, y, x1 - x0, 0.008, TK$soft); caja(doc, x0, y - 0.04, 0.008, 0.088, TK$soft); caja(doc, x1 - 0.008, y - 0.04, 0.008, 0.088, TK$soft)
  wt_ <- max(x1 - x0, 1.4); txt(doc, t, (x0 + x1) / 2 - wt_ / 2, y + 0.03, wt_, 0.24, 10, TK$soft, align = "center") }
minik <- function(x, y, tipo) { caja(doc, x, y, wk4, hk4, "#FFFFFF", line = sp_line(color = TK$rule, lwd = 0.75)); pd <- 0.14; wi <- wk4 - 2 * pd; hi <- hk4 - 2 * pd
  if (tipo == "lateral") { wc_ <- wi * 0.3; for (j in 0:2) mini_cifra(x + pd, y + pd + 0.08 + j * hi / 3, wc_ - 0.1)
    caja(doc, x + pd + wc_ + 0.08, y + pd, 0.008, hi, TK$rule); caja(doc, x + pd + wc_ + 0.18, y + pd, wi - wc_ - 0.18, hi, TK$tenue)
    cota(x + pd, x + pd + wc_, y + hk4 + 0.1, "30 %"); cota(x + pd + wc_ + 0.18, x + wk4 - pd, y + hk4 + 0.1, "70 %") }
  if (tipo == "banda") { for (j in 0:2) mini_cifra(x + pd + j * wi / 3, y + pd + 0.04, wi / 3 - 0.1)
    caja(doc, x + pd, y + pd + 0.42, wi, 0.008, TK$rule)
    caja(doc, x + pd, y + pd + 0.52, wi / 2 - 0.06, hi - 0.52, TK$tenue); caja(doc, x + pd + wi / 2 + 0.06, y + pd + 0.52, wi / 2 - 0.06, hi - 0.52, TK$tenue)
    cota(x + pd, x + wk4 - pd, y + hk4 + 0.1, "todo el ancho, un cuarto del alto") }
  if (tipo == "recuadro") { wq <- (wi - 0.16) / 3; hq <- (hi - 0.1) / 2
    for (r in 0:1) for (cc in 0:2) { xq <- x + pd + cc * (wq + 0.08); yq <- y + pd + r * (hq + 0.1)
      if (r == 0 && cc == 2) { caja(doc, xq, yq, wq, hq, TK$fondo); mini_cifra(xq + 0.08, yq + hq / 2 - 0.14, wq - 0.16) } else caja(doc, xq, yq, wq, hq, TK$tenue) }
    cota(x + pd + 2 * (wq + 0.08), x + pd + 3 * wq + 0.16, y + hk4 + 0.1, "un recuadro") }
  if (tipo == "mitad") { caja(doc, x + pd, y + pd + hi / 2 - 0.3, 0.9, 0.32, TK$navy); caja(doc, x + pd, y + pd + hi / 2 + 0.1, 1.0, 0.06, TK$faint)
    caja(doc, x + pd + wi / 2 + 0.04, y + pd, 0.008, hi, TK$rule); caja(doc, x + pd + wi / 2 + 0.14, y + pd, wi / 2 - 0.14, hi, TK$tenue)
    cota(x + pd, x + pd + wi / 2, y + hk4 + 0.1, "50 %"); cota(x + pd + wi / 2 + 0.14, x + wk4 - pd, y + hk4 + 0.1, "50 %") } }
casosk <- list(c("lateral", "Columna lateral", "De una a tres cifras apiladas junto a los gráficos. Es la disposición del perfil de cada público"),
               c("banda", "Banda superior", "Tres o cuatro cifras a lo ancho, sobre dos gráficos. Abre un capítulo o resume el estudio"),
               c("recuadro", "En lugar de un gráfico", "Ocupa un recuadro de la grilla cuando un panel se resume en un solo número"),
               c("mitad", "Mitad y mitad", "Una cifra grande frente a un gráfico, cuando el número es el hallazgo de la lámina"))
for (k in seq_along(casosk)) { x <- XC + (k - 1) * (wk4 + gapk)
  minik(x, yk4, casosk[[k]][1])
  txt(doc, casosk[[k]][2], x - 0.1, yk4 + hk4 + 0.45, wk4 + 0.2, 0.3, 14, TK$navy, bold = TRUE)
  txt(doc, casosk[[k]][3], x - 0.1, yk4 + hk4 + 0.77, wk4 + 0.2, 0.8, 12, TK$soft) }
separador_h(doc, XC, W - MR, yk4 + hk4 + 1.75)
txt(doc, "La cifra no cambia de tamaño según el espacio: siempre 34 pt. Lo que cambia es cuántas caben, y si no caben, la lámina se parte.",
    XT, yk4 + hk4 + 1.9, AC, 0.6, 13, TK$navy, bold = TRUE)
zona("cuatro ubicaciones de la cifra", XC, yk4, AC, hk4 + 1.6)
pie(doc, "")
if (ESTILO == "moderna") { MOTOR_ACT <- "Reglas: la cifra destacada de una a cinco (p_slide_cifras_y_graficos)"; doc <- rr_cifras(doc) }   # integrado desde las propuestas

# --- p_slide_3_graficos_poblacion_cifras: tres gráficos, dos cifras e ícono
MOTOR_ACT <- "p_slide_3_graficos_poblacion_cifras: p_barras_agrupadas x3 + cifras + ícono"
doc <- nueva(doc); ICONO_TIT <- "graduation-cap"; titulo(doc, "Perfil del estudiante en cifras", ante = "Población: gráficos y cifras")
wk <- 3.0; xg <- ML + wk + 0.45; wg <- (W - MR - xg - 0.45) / 2
icono_poblacion(doc, "graduation-cap", ML + 0.6, YT + 0.6, 0.95)
if (CEN) cifra(doc, ML + 1.25, YT + 0.15, wk - 1.25, "172", "estudiantes", "96 % de los matriculados") else cifra(doc, ML, YT + 0.15, wk, "172", "estudiantes", "96 % de los matriculados")
separador_h(doc, ML, ML + wk, YT + 1.55)
cifra(doc, ML, YT + 1.85, wk, paste0(as.integer(median(edad)), " años"), "edad mediana", sprintf("media de %.1f años", mean(edad)))
separador_v(doc, ML + wk + 0.22, YT, YF)
panel_titulo(doc, xg, YT, wg, "Sexo", "172 respuestas")
barras_h(doc, xg, YT + 0.55, wg, es_sexo$labels, es_sexo$pct, wlab = 1.2, g = grosor_cat(2), fila = 0.46)
separador_h(doc, xg, xg + wg, YT + 1.95)
panel_titulo(doc, xg, YT + 2.1, wg, "Rango de edades", "172 respuestas")
barras_h(doc, xg, YT + 2.65, wg, es_rango$labels, es_rango$pct, wlab = 1.6, g = grosor_cat(4), fila = 0.44, size = 11)
xg2 <- xg + wg + 0.45; separador_v(doc, xg2 - 0.22, YT, YF)
panel_titulo(doc, xg2, YT, wg, "Nivel curricular", "172 respuestas")
barras_h(doc, xg2, YT + 0.6, wg, es_ciclo$labels, es_ciclo$pct, wlab = 1.4, g = grosor_cat(6), fila = 0.66)
pie(doc, "Base: 172 estudiantes")

# --- p_slide_5_graficos_poblacion: tres arriba, dos abajo e ícono
MOTOR_ACT <- "p_slide_5_graficos_poblacion: p_barras_multiapiladas (dicotómica) x4 + p_barras_agrupadas + ícono"
doc <- nueva(doc); ICONO_TIT <- "user-check"; titulo(doc, "Perfil del egresado", ante = "Población: cinco gráficos")
w3 <- (ANCHO - 2 * 0.4) / 3; xs3_ <- ML + (0:2) * (w3 + 0.4); hfila <- (YF - YT) / 2
arriba <- list(list(t = "Sexo", f = eg_sexo), list(t = "¿Cuenta con título universitario?", f = t1), list(t = "¿Está trabajando actualmente?", f = eg_trab))
for (k in 1:3) { panel_titulo(doc, xs3_[k], YT, w3, arriba[[k]]$t, paste(arriba[[k]]$f$valid, "respuestas"))
  dicotomia(doc, xs3_[k], YT + 0.6, w3, arriba[[k]]$f$labels[1:2], arriba[[k]]$f$pct[1:2], arriba[[k]]$f$n[1:2], size = 20, g = 0.3) }
separador_h(doc, ML, W - MR, YT + hfila - 0.05)
icono_poblacion(doc, "user-check", W / 2, YT + hfila + 1.2, 1.1)
gi <- if (CEN) 2.0 else 0.8; wb2 <- (ANCHO - gi) / 2
if (!CEN) separador_v(doc, ML + wb2 + gi / 2, YT + hfila + 0.15, YF)
panel_titulo(doc, ML, YT + hfila + 0.15, wb2, "¿Su trabajo se relaciona con la contabilidad?", paste(eg_rel$valid, "respuestas"))
dicotomia(doc, ML, YT + hfila + 0.75, wb2, eg_rel$labels[1:2], eg_rel$pct[1:2], eg_rel$n[1:2], size = 20, g = 0.3)
panel_titulo(doc, ML + wb2 + gi, YT + hfila + 0.15, wb2, "¿En qué año obtuvo su título?", paste(D$anio$valid, "egresados titulados"))
barras_h(doc, ML + wb2 + gi, YT + hfila + 0.65, wb2, D$anio$labels, D$anio$pct, wlab = 0.9, g = 0.22, fila = 0.33, size = 10.5)
pie(doc, "Base: 178 egresados")

# --- p_slide_6_graficos_poblacion: tres arriba, tres abajo e ícono
MOTOR_ACT <- "p_slide_6_graficos_poblacion: p_barras_agrupadas x4 + p_barras_multiapiladas (dicotómica) x2 + ícono"
doc <- nueva(doc); ICONO_TIT <- "users"; titulo(doc, "Perfil del docente", ante = "Población: seis gráficos")
seis <- list(
  function(x, y) { panel_titulo(doc, x, y, w3, "Sexo", "52 respuestas"); dicotomia(doc, x, y + 0.6, w3, do_sexo$labels[1:2], do_sexo$pct[1:2], do_sexo$n[1:2], size = 20, g = 0.3) },
  function(x, y) { panel_titulo(doc, x, y, w3, "Rango de edades", "52 respuestas"); barras_h(doc, x, y + 0.55, w3, do_ed$labels, do_ed$pct, wlab = 1.45, g = 0.22, fila = 0.36, size = 10.5) },
  function(x, y) { panel_titulo(doc, x, y, w3, "Máximo grado alcanzado", "52 respuestas"); barras_h(doc, x, y + 0.55, w3, do_gr$labels, do_gr$pct, wlab = 1.2, g = 0.24, fila = 0.42, size = 10.5) },
  function(x, y) { panel_titulo(doc, x, y, w3, "Departamento académico", "52 respuestas"); barras_h(doc, x, y + 0.55, w3, sub("Departamento de ", "", do_dep$labels), do_dep$pct, wlab = 1.6, g = 0.22, fila = 0.36, size = 10.5) },
  function(x, y) { panel_titulo(doc, x, y, w3, "¿Conoce la misión de la PUCP?", "52 respuestas"); dicotomia(doc, x, y + 0.6, w3, D$mision1[[1]]$labels, D$mision1[[1]]$pct, D$mision1[[1]]$n, size = 20, g = 0.3) },
  function(x, y) { panel_titulo(doc, x, y, w3, "¿Sabe dónde consultarla?", paste(D$mision2[[1]]$valid, "respuestas")); dicotomia(doc, x, y + 0.6, w3, D$mision2[[1]]$labels, D$mision2[[1]]$pct, D$mision2[[1]]$n, size = 20, g = 0.3) })
for (k in 1:6) seis[[k]](xs3_[(k - 1) %% 3 + 1], if (k <= 3) YT else YT + 2.85)
if (CEN) { separador_h(doc, ML, W / 2 - 0.5, YT + 2.4); separador_h(doc, W / 2 + 0.5, W - MR, YT + 2.4) } else separador_h(doc, ML, W - MR, YT + 2.4)
icono_poblacion(doc, "users", W / 2, YT + 2.4, 0.66)
pie(doc, "Base: 52 docentes")

# --- p_slide_cifras_y_graficos: banda de tres cifras y dos gráficos
MOTOR_ACT <- "p_slide_cifras_y_graficos: cifras x3 + p_barras_multiapiladas (dicotómica) + p_barras_agrupadas"
doc <- nueva(doc); titulo(doc, "El estudio en cifras", ante = "Banda de cifras y dos gráficos")
cf <- list(c("417", "personas encuestadas", "52 docentes, 172 estudiantes, 178 egresados y 15 administrativos"),
           c(paste0(as.integer(median(edad)), " años"), "edad mediana del estudiante", sprintf("media de %.1f años", mean(edad))),
           c(paste0(t1$pct[1], "%"), "de egresados titulados", sprintf("%d de %d", t1$n[1], t1$valid)))
for (k in 1:3) { x <- ML + (k - 1) * (w3 + 0.4); cifra(doc, x, YT - 0.05, w3, cf[[k]][1], cf[[k]][2], cf[[k]][3], size = 32)
  if (k < 3) separador_v(doc, x + w3 + 0.2, YT, YT + 1.15) }
separador_h(doc, ML, W - MR, YT + 1.4)
panel_titulo(doc, ML, YT + 1.6, col2, "¿Conoce la misión y los propósitos de la PUCP?")
yfm_ <- likert_panel(doc, ML, YT + 1.85, col2, lapply(1:4, function(i) list(lab = c("Docentes", "Estudiantes", "Egresados", "Administrativos")[i], f = D$mision1[[i]])), cols = TK$dico, ttb_col = FALSE, g = 0.3, fila = 0.55, wlab = 1.55, size_lab = 10.5)
leyenda(doc, 0, yfm_ + 0.05, c("Sí", "No"), TK$dico, centrar_en = ML + 1.67 + (col2 - 1.67) / 2)
panel_titulo(doc, xr, YT + 1.6, col2, "Sueldo mensual bruto del egresado", paste(D$sueldo$valid, "respuestas"))
barras_h(doc, xr, YT + 2.15, col2, D$sueldo$labels, D$sueldo$pct, wlab = 2.4, g = 0.24, fila = 0.42, size = 10.5)
pie(doc, "")
