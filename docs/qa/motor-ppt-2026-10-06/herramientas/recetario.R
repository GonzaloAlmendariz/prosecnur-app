# Recetario remasterizado de láminas PULSO (MAQUETA, no implementación del motor).
# Dos estilos sobre los mismos datos y el mismo kit:
#   ESTILO=fiel     convención del informe entregado (VF CONTA 02-09): títulos en
#                   mayúscula coral, mismos tipos de gráfico, mejor ejecutados;
#   ESTILO=moderna  alternativa remasterizada (se completa con la guía de evidencia).
# GUIAS=1 dibuja márgenes, zonas y cotas en cm sobre cada lámina.
# Recetas medidas: docs/qa/cookbook-mazo-acreditacion-2026-08-14.md (título a
# 0.355 in, datos desde 1.65 in, cifra 14 pt, premisa 13, leyenda 12, base 10 negrita,
# grosor por gráficos y barras, «si no cabe, la lámina se parte y la letra no encoge»).
# Uso: SP=<datos> ESTILO=fiel GUIAS=0 SALIDA=<pptx> Rscript recetario.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages({ library(officer); library(flextable); library(rvg); library(ggplot2) })
`%||%` <- function(a, b) if (is.null(a)) b else a
SP <- Sys.getenv("SP"); ESTILO <- Sys.getenv("ESTILO", "fiel"); GUIAS <- Sys.getenv("GUIAS", "0") == "1"
D <- readRDS(file.path(SP, "datos_muestra.rds")); CONTA <- readRDS(file.path(SP, "src_conta.rds"))

# ================================================================ tokens ====
TK <- list(
  coral = "#CA5651", navy = "#081F5C", tenue = "#8E9DBD", ink = "#081F5C", soft = "#5A6480", faint = "#8A93A8",
  rule = "#D5D9DF", zebra = "#E9ECF1", fondo = "#F2F2F2", verde_txt = "#4E9438", font = "Arial",
  likert = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"),   # VF entregado
  dico = c("#081F5C", "#9DC3E6"),
  actores = c(Docentes = "#0B4F8C", Estudiantes = "#2A9D8F", Egresados = "#E9C46A"),
  guia = "#E0218A", guia2 = "#00A3E0"
)
PT <- list(titulo = 24, premisa = 13, cifra = 14, cifra_fuera = 12, leyenda = 12, actor = 12, base = 10, n = 10, cuerpo = 14)
W <- 13.333; H <- 7.5; ML <- 0.315; MR <- 0.315; Y_TIT <- 0.355; Y_DATOS <- 1.65; Y_LEY <- 6.42; Y_BASE <- 6.88
LIKERT_ROT <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF")
# Retícula (pedido de Gonzalo, 2026-10-07: «los campos de texto milimétricamente bien medidos»): el contenido empieza donde
# empieza el texto del título. XC = borde de formas y tablas; XT = x de un cuadro de texto para que su letra caiga en XC
# (officer deja 0.1 in de inserción); AC = ancho del contenido hasta el margen derecho.
# Un solo margen para todo cuadro (de texto o de forma): el del cuadro del título. En la moderna la barra navy queda en el
# borde de la hoja (ML0) y el contenido empieza tras ella (ML = ML0 + 0.18), igual que el título.
ML0 <- ML; if (ESTILO == "moderna") ML <- ML0 + 0.18
XC <- ML; XT <- ML; AC <- W - MR - ML
ancho_ft <- function(ft, ancho = AC) { w <- dim(ft)$widths; width(ft, j = seq_along(w), width = w * ancho / sum(w)) }

grosor_apilada <- function(n) if (n <= 2) 0.50 else if (n == 3) 0.48 else if (n <= 6) 0.44 else if (n <= 9) 0.38 else 0.32
grosor_cat <- function(n) if (n <= 3) 0.26 else if (n <= 6) 0.28 else if (n == 7) 0.30 else 0.32

lum <- function(hex) { v <- grDevices::col2rgb(hex)[, 1] / 255
  v <- ifelse(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055)^2.4); sum(c(.2126, .7152, .0722) * v) }
# Texto sobre un color: el que más contrasta de los dos, blanco o azul oscuro. La regla anterior (blanco sólo si llegaba a 4.5)
# dejaba texto oscuro sobre azules medios, donde se lee peor (Gonzalo, 2026-10-07: «a veces las letras negras no se ven bien con el color»).
texto_sobre <- function(hex) { l <- lum(hex); if (1.05 / (l + .05) >= (l + .05) / (lum(TK$navy) + .05)) "#FFFFFF" else TK$navy }
ancho_txt <- function(s, size, bold = FALSE) nchar(s) * size * (if (bold) 0.56 else 0.52) / 72
lineas <- function(s, w, size, bold = FALSE) max(1, ceiling(ancho_txt(s, size, bold) / (w - 0.2)))
alto_txt <- function(s, w, size, bold = FALSE) lineas(s, w, size, bold) * size * 1.2 / 72 + 0.1

# ================================================================ primitivas
txt <- function(doc, s, l, t, w, h, size = 12, color = TK$ink, bold = FALSE, align = "left", italic = FALSE, nombre = NULL) {
  p <- fpar(ftext(s, fp_text(font.size = size, color = color, bold = bold, italic = italic, font.family = TK$font)),
            fp_p = fp_par(text.align = align))
  loc <- if (is.null(nombre)) ph_location(left = l, top = t, width = w, height = h) else ph_location(left = l, top = t, width = w, height = h, newlabel = nombre)
  invisible(ph_with(doc, block_list(p), location = loc))
}
txt_runs <- function(doc, runs, l, t, w, h, size = 14, align = "left") {   # runs: list(list(t=, b=TRUE/FALSE))
  ch <- lapply(runs, function(r) ftext(r$t, fp_text(font.size = size, color = TK$ink, bold = isTRUE(r$b), font.family = TK$font)))
  invisible(ph_with(doc, block_list(do.call(fpar, c(ch, list(fp_p = fp_par(text.align = align, line_spacing = 1.15))))),
                    location = ph_location(left = l, top = t, width = w, height = h)))
}
caja <- function(doc, l, t, w, h, fill, geom = "rect", line = NULL) {
  invisible(ph_with(doc, "", location = ph_location(left = l, top = t, width = w, height = h, bg = fill,
                    geom = geom, ln = line %||% sp_line(color = fill, lwd = 0.25))))
}
contorno <- function(doc, l, t, w, h, color, lwd = 0.75, lty = "dash", geom = "rect") {
  invisible(ph_with(doc, "", location = ph_location(left = l, top = t, width = w, height = h, bg = NULL,
                    geom = geom, ln = sp_line(color = color, lwd = lwd, lty = lty))))
}

# Íconos de Lucide (la librería de la app), exportados a PNG transparente.
ICO <- Sys.getenv("ICO", "docs/qa/motor-ppt-2026-10-06/herramientas/iconos")
icono <- function(doc, nombre, color, x, y, d) invisible(ph_with(doc, external_img(file.path(ICO, color, paste0(nombre, ".png")), width = d, height = d),
  location = ph_location(left = x, top = y, width = d, height = d)))
icono_en_circulo <- function(doc, nombre, x, y, d, fondo = TK$navy, color = "blanco", pad = 0.24) {
  caja(doc, x, y, d, d, fondo, geom = "ellipse"); icono(doc, nombre, color, x + d * pad, y + d * pad, d * (1 - 2 * pad)) }
ICONO_SECCION <- c("users", "building-2", "scroll-text", "network", "graduation-cap", "user-check", "library", "award", "book-open", "handshake", "globe", "flask-conical", "scale")

# ================================================================ guías ======
GZ <- list()
zona <- function(nombre, l, t, w, h) GZ[[length(GZ) + 1]] <<- list(n = nombre, l = l, t = t, w = w, h = h)
cm <- function(x) sprintf("%.2f", x * 2.54)
MOTOR_ACT <- ""
dibujar_guias <- function(doc) {
  if (!GUIAS) { GZ <<- list(); return(invisible()) }
  if (nzchar(MOTOR_ACT)) txt(doc, paste("Motor:", MOTOR_ACT), W - 7.3, H - 0.3, 7.0, 0.26, 9, TK$guia, bold = TRUE, align = "right")
  for (x in c(ML, W - MR)) caja(doc, x - 0.004, 0, 0.008, H, TK$guia2)
  for (y in c(Y_TIT, Y_DATOS)) caja(doc, 0, y - 0.004, W, 0.008, TK$guia2)
  txt(doc, sprintf("margen %s cm", cm(ML)), ML + 0.03, H - 0.3, 2, 0.25, 8, TK$guia2)
  txt(doc, sprintf("título y = %s cm", cm(Y_TIT)), W - 2.6, Y_TIT - 0.24, 2.5, 0.24, 8, TK$guia2, align = "right")
  txt(doc, sprintf("datos y = %s cm", cm(Y_DATOS)), W - 2.6, Y_DATOS - 0.24, 2.5, 0.24, 8, TK$guia2, align = "right")
  for (z in GZ) {
    contorno(doc, z$l, z$t, z$w, z$h, TK$guia)
    txt(doc, sprintf("%s, %s x %s cm", z$n, cm(z$w), cm(z$h)), z$l, z$t - 0.2, max(z$w, 2.6), 0.2, 8, TK$guia)
  }
  GZ <<- list()
}

# ================================================================ piezas =====
FOLIO <- 0
nueva <- function(doc, layout = "Graficos") { FOLIO <<- FOLIO + 1; add_slide(doc, layout = layout, master = "Office Theme") }
# Ícono del público en láminas de población: «cabecera» (junto al antetítulo, posición fija),
# «ninguno», o «centro» (entre paneles, como el informe entregado). La fiel siempre «centro».
ICONO_MODO <- if (ESTILO == "fiel") "centro" else Sys.getenv("ICONO_MODO", "cabecera")
ICONO_TIT <- NULL
titulo <- function(doc, t, ante = NULL, sub = NULL) {
  if (ESTILO == "fiel") {
    txt(doc, toupper(t), ML, Y_TIT, 10.6, 0.5, 20, TK$coral, bold = TRUE, nombre = "Titulo lamina")
    if (!is.null(sub)) txt(doc, sub, ML, Y_TIT + 0.42, 10.6, 0.35, 14, TK$coral, bold = TRUE)
  } else {
    caja(doc, ML0, Y_TIT - 0.12, 0.05, if (is.null(sub)) 0.72 else 0.98, TK$navy)
    xa <- ML
    if (!is.null(ICONO_TIT) && ICONO_MODO == "cabecera") { icono_en_circulo(doc, ICONO_TIT, xa, Y_TIT - 0.19, 0.3, pad = 0.2); xa <- xa + 0.4 }
    ICONO_TIT <<- NULL
    if (!is.null(ante)) txt(doc, toupper(ante), xa, Y_TIT - 0.17, 9, 0.26, 10, TK$soft, bold = TRUE)
    txt(doc, t, ML, Y_TIT + 0.06, 10.4, 0.5, PT$titulo, TK$coral, bold = TRUE, nombre = "Titulo lamina")
    if (!is.null(sub)) txt(doc, sub, ML, Y_TIT + 0.55, 10.4, 0.32, 12.5, TK$soft)
  }
  zona("título", ML, Y_TIT, 10.6, 0.5)
}
pie <- function(doc, base) {
  xb <- ML   # la base empieza donde empieza el título
  if (nzchar(base)) txt(doc, base, xb, Y_BASE, 10.5, 0.4, PT$base, TK$navy, bold = TRUE)
  txt(doc, as.character(FOLIO), W - MR - 0.6, Y_BASE, 0.6, 0.3, PT$base, TK$soft, align = "right")
  zona("base", ML, Y_BASE, 10.5, 0.4)
  dibujar_guias(doc)
}
# Ancho real de la tinta (systemfonts, Arial), no la estimación por caracteres: con ella las leyendas se veían corridas
# (pedido de Gonzalo, 2026-10-07: «La leyenda no están centradas»). Un cuadro de texto de officer deja 0.1 in de margen interno.
ancho_tinta <- function(s, size, bold = FALSE) systemfonts::string_width(s, family = TK$font, size = size, res = 72, bold = bold) / 72
leyenda <- function(doc, x, y, labels, cols, size = PT$leyenda, centrar_en = NULL) {
  wk <- ancho_tinta(labels, size); ws <- 0.22 + wk; gap <- 0.3; tot <- sum(ws) + gap * (length(ws) - 1)   # cuadro, 0.07 de aire, texto
  if (!is.null(centrar_en)) { disp <- 2 * min(centrar_en - ML, W - MR - centrar_en)   # si no cabe centrada, se juntan los ítems antes de correrla
    if (tot > disp && length(ws) > 1) { gap <- max(0.15, (disp - sum(ws)) / (length(ws) - 1)); tot <- sum(ws) + gap * (length(ws) - 1) }
    x <- centrar_en - tot / 2 }
  x <- min(max(x, ML), W - MR - tot)   # nunca fuera del margen
  x0 <- x
  if (nzchar(Sys.getenv("LEY_LOG"))) cat(sprintf("%d\t%.3f\t%.3f\t%.3f\t%s\n", FOLIO, y, centrar_en %||% NA, x0, labels[length(labels)]), file = Sys.getenv("LEY_LOG"), append = TRUE)
  for (k in seq_along(labels)) { caja(doc, x, y + 0.07, 0.15, 0.15, cols[k]); txt(doc, labels[k], x + 0.12, y, wk[k] + 0.3, 0.3, size, TK$navy); x <- x + ws[k] + gap }
  zona("leyenda", x0, y, tot, 0.3)
}
# Barra apilada al 100 %. Cifra dentro si el segmento la contiene a 14 pt; si no,
# encima del segmento con una guía, y separadas entre sí para no taparse.
tiene_peq <- function(pct, w) { ws <- w * pct / sum(pct); any(pct > 0 & ws < ancho_txt(paste0(pct, "%"), PT$cifra, TRUE) + 0.12) }
barra_apilada <- function(doc, x, y, w, pct, cols, h) {
  apartar <- FALSE   # sin huecos entre segmentos ni antes de SIN INF (indicación de Gonzalo, 2026-10-07)
  wu <- w - (if (apartar) 0.08 else 0); tot <- sum(pct); xx <- x; peq <- list()
  for (k in seq_along(pct)) {
    if (apartar && k == 5) xx <- xx + 0.08
    ws <- wu * pct[k] / tot; et <- paste0(pct[k], "%")
    if (ws > 0.004) caja(doc, xx, y, ws + (if (k < length(pct)) 0.004 else 0), h, cols[k])   # leve solape: ninguna línea entre colores
    if (ws >= ancho_txt(et, PT$cifra, TRUE) + 0.12) {
      wl <- max(ws, 0.7); txt(doc, et, xx + ws / 2 - wl / 2, y + (h - 0.3) / 2, wl, 0.3, PT$cifra, texto_sobre(cols[k]), bold = TRUE, align = "center")
    } else if (pct[k] > 0) peq[[length(peq) + 1]] <- list(c = xx + ws / 2, v = et)
    xx <- xx + ws
  }
  if (length(peq)) {
    cs <- vapply(peq, `[[`, 0, "c"); pos <- cs
    for (k in seq_along(pos)[-1]) pos[k] <- max(pos[k], pos[k - 1] + 0.46)
    n_ <- length(pos); lim <- x + w - 0.12                      # chicas al final: el grupo se corre a la izquierda, no sale de la barra
    if (pos[n_] > lim) { pos[n_] <- lim; if (n_ > 1) for (k in (n_ - 1):1) pos[k] <- min(pos[k], pos[k + 1] - 0.46) }
    for (k in seq_along(peq)) {
      caja(doc, cs[k] - 0.006, y - 0.07, 0.012, 0.07, TK$faint)
      if (abs(pos[k] - cs[k]) > 0.01) caja(doc, min(cs[k], pos[k]), y - 0.08, abs(pos[k] - cs[k]), 0.012, TK$faint)
      txt(doc, peq[[k]]$v, pos[k] - 0.32, y - 0.32, 0.64, 0.26, PT$cifra_fuera, TK$navy, bold = TRUE, align = "center")
    }
  }
}
# Barras de una serie (perfil, selección múltiple): etiqueta, barra y cifra.
barras_h <- function(doc, x, y, w, labels, pct, wlab, g, fila, size = 12, escala = NULL, color = TK$navy, comp = NULL, sin_ceros = TRUE, realzar = TRUE) {
  if (sin_ceros) { k0 <- pct > 0 | (!is.null(comp) && FALSE); if (!is.null(comp)) k0 <- pct > 0 | comp > 0
    labels <- labels[k0]; pct <- pct[k0]; if (!is.null(comp)) comp <- comp[k0] }
  resid <- grepl("^(Otro|Otros|No sabe|Ninguna|Prefiero no)", labels, ignore.case = TRUE)   # residuales al final
  if (any(resid) && !all(resid)) { o <- c(which(!resid), which(resid)); labels <- labels[o]; pct <- pct[o]; if (!is.null(comp)) comp <- comp[o] }
  # Moderna: dos categorías sin comparativo se leen como dicotomía (cifras grandes y barra partida).
  if (ESTILO == "moderna" && is.null(comp) && length(pct) == 2 && identical(color, TK$navy) && exists("dicotomia")) {
    return(invisible(dicotomia(doc, x, y, w - 0.8, labels, pct, size = 22, g = 0.34))) }   # C23: el mismo ancho que las barras del panel vecino
  escala <- escala %||% (max(c(pct, comp)) * 1.12)
  wbar <- w - wlab - 0.8; yy <- y
  # Moderna: la categoría mayor en navy y las demás en un tono claro de la marca; su rótulo
  # en negrita. Sólo con una serie (sin comparativo) y si hay un máximo único.
  realce <- realzar && ESTILO == "moderna" && is.null(comp) && identical(color, TK$navy) && length(pct) > 2 && sum(pct == max(pct)) == 1
  for (k in seq_along(labels)) {
    es_max <- realce && pct[k] == max(pct)
    txt(doc, labels[k], x, yy + (fila - alto_txt(labels[k], wlab, size)) / 2, wlab, alto_txt(labels[k], wlab, size), size, TK$navy, bold = es_max, align = "right")
    yb <- yy + (fila - g) / 2
    if (!is.null(comp)) { gb <- g * 0.55; yb <- yy + fila / 2 - g / 2 - 0.02
      cw <- wbar * comp[k] / escala; caja(doc, x + wlab + 0.12, yb + g + 0.04, max(cw, 0.01), gb * 0.7, TK$dico[2])
      txt(doc, paste0(comp[k], "%"), x + wlab + 0.16 + cw, yb + g - 0.02, 0.8, 0.24, 10, TK$soft) }
    bw <- wbar * pct[k] / escala
    if (bw > 0.004) caja(doc, x + wlab + 0.12, yb, bw, g, if (realce && !es_max) TK$tenue else color)
    txt(doc, paste0(pct[k], "%"), x + wlab + 0.16 + bw, yb + (g - 0.3) / 2, 0.8, 0.3, size, TK$navy, bold = TRUE)
    yy <- yy + fila
  }
  zona(sprintf("barras, g = %s cm", cm(g)), x + wlab + 0.12, y, wbar, length(labels) * fila)
  invisible(yy)
}
fr <- function(b, v) {
  sv <- CONTA$inst_sources[[b]]$survey; ch <- CONTA$inst_sources[[b]]$choices; lc <- function(df) grep("^label", names(df))[1]
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]; cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(CONTA$data_sources[[b]][[v]]); d <- d[!is.na(d) & d != ""]; n <- as.integer(table(factor(d, levels = cc$name)))
  list(b = b, v = v, pregunta = row[[lc(sv)]], labels = cc[[lc(ch)]], n = n, valid = length(d), pct = round(100 * n / length(d)))
}
busca <- function(b, patron) { sv <- CONTA$inst_sources[[b]]$survey; l <- sv[[grep("^label", names(sv))[1]]]; sv$name[grep(patron, l, ignore.case = TRUE)] }
ttb <- function(f) f$pct[3] + f$pct[4]
cap1 <- function(s) paste0(toupper(substr(s, 1, 1)), substr(s, 2, nchar(s)))

# Bloque Likert: premisas con una o varias filas (actores), Top Two Box a la derecha.
# premisas = list(list(texto=, filas = list(list(actor=, f=, ttb21=NULL))))
X_PREM <- ML; W_PREM <- 3.3; X_ACT <- 3.6; W_ACT <- 1.5; X_BAR <- 5.2; W_BAR <- 6.0; X_TTB <- 11.4
sin_actor <- function(premisas) all(vapply(premisas, function(p) all(vapply(p$filas, function(f) !nzchar(f$actor), TRUE)), TRUE))
ancho_prem <- function(premisas) if (sin_actor(premisas)) X_BAR - X_PREM - 0.25 else W_PREM
# Geometría (receta 1): grosor por número de barras, aire para las cifras chicas
# encima de su segmento y separación entre premisas.
geo_likert <- function(premisas) {
  nb <- sum(vapply(premisas, function(p) length(p$filas), 0)); g <- grosor_apilada(nb); fila <- g + 0.24
  multi <- any(vapply(premisas, function(p) length(p$filas) > 1, TRUE))
  texto_manda <- any(vapply(premisas, function(p) alto_txt(p$texto, ancho_prem(premisas), PT$premisa, TRUE) > length(p$filas) * fila, TRUE))
  list(g = g, fila = fila, gap = if (multi || texto_manda) 0.26 else 0.08)
}
alto_bloque <- function(premisas) { geo <- geo_likert(premisas); wp <- ancho_prem(premisas)
  sum(vapply(premisas, function(p) max(alto_txt(p$texto, wp, PT$premisa, TRUE), length(p$filas) * geo$fila), 0)) + geo$gap * (length(premisas) - 1) }
ALTO_UTIL <- (Y_LEY - 0.15) - (Y_DATOS + 0.1)

etiqueta_ttb <- function(doc, x, yb, g, f, ttb21, comp21) {
  v <- ttb(f); col <- TK$verde_txt
  if (!comp21) {
    txt(doc, paste0(v, "%"), x, yb + (g - 0.32) / 2 - (if (ESTILO == "moderna" && f$valid < 30) 0.1 else 0), 1.5, 0.32, PT$cifra, col, bold = TRUE, align = "center")
    if (ESTILO == "moderna" && f$valid < 30) txt(doc, sprintf("%d de %d", f$n[3] + f$n[4], f$valid), x, yb + g / 2 + 0.06, 1.5, 0.24, PT$n, TK$faint, align = "center")
    return(invisible())
  }
  txt(doc, paste0(v, "%"), x, yb + (g - 0.32) / 2, 0.75, 0.32, PT$cifra, col, bold = TRUE, align = "center")
  if (is.null(ttb21)) return(invisible())
  txt(doc, paste0(ttb21, "%"), x + 0.75, yb + (g - 0.32) / 2, 0.75, 0.32, PT$cifra, TK$soft, bold = TRUE, align = "center")
  d <- v - ttb21; cd <- if (d < 0) TK$coral else TK$verde_txt
  if (ESTILO == "fiel") { if (abs(d) >= 1) invisible(ph_with(doc, "", location = ph_location(left = x + 0.7, top = yb + (g - 0.13) / 2, width = 0.13, height = 0.13,
      bg = cd, geom = "triangle", rotation = if (d < 0) 180 else 0, ln = sp_line(color = cd, lwd = 0.25)))) }
  else txt(doc, sprintf("%+d pts", d), x, yb + g / 2 + 0.08, 1.5, 0.24, 11, cd, bold = TRUE, align = "center")
}

bloque_likert <- function(doc, premisas, cols = TK$likert, rotulos = LIKERT_ROT, ttb_col = TRUE, comp21 = FALSE, solo = TRUE) {
  y0 <- Y_DATOS + 0.1; y1 <- Y_LEY - 0.15
  # una afirmación y un público: la afirmación encabeza y la barra ocupa el ancho
  if (solo && length(premisas) == 1 && length(premisas[[1]]$filas) == 1) {   # una «(cont.)» de un ítem sigue la forma de su serie
    p <- premisas[[1]]; fl <- p$filas[[1]]; g <- 0.72
    wt <- W - ML - MR - 0.4; ht <- alto_txt(p$texto, wt, 20, TRUE)
    alto_grupo <- ht + 1.15 + g + 1.0; yt <- Y_DATOS + max(0.3, (Y_BASE - 0.2 - Y_DATOS - alto_grupo) / 2); txt(doc, p$texto, X_PREM, yt, wt, ht, 20, TK$navy, bold = TRUE, align = if (ESTILO == "fiel") "center" else "left")
    yb <- yt + ht + 1.15; xb <- X_PREM + 1.75; wb <- X_TTB - xb - 0.25
    txt(doc, fl$actor, X_PREM, yb + g / 2 - 0.18, 1.6, 0.3, PT$actor, TK$navy, bold = TRUE)
    if (ESTILO == "moderna") txt(doc, paste(format(fl$f$valid, big.mark = ","), "respuestas"), X_PREM, yb + g / 2 + 0.08, 1.7, 0.26, PT$n, TK$faint)
    barra_apilada(doc, xb, yb, wb, fl$f$pct, cols, g)
    if (ttb_col) { txt(doc, if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", X_TTB - 0.1, yb - 0.45, 1.6, 0.26, 10, TK$verde_txt, bold = TRUE, align = "center")
      txt(doc, paste0(ttb(fl$f), "%"), X_TTB - 0.1, yb + g / 2 - 0.3, 1.6, 0.6, 28, TK$verde_txt, bold = TRUE, align = "center") }
    zona(sprintf("barra, g = %s cm", cm(g)), xb, yb, wb, g)
    leyenda(doc, 0, yb + g + 0.55, rotulos, cols, centrar_en = xb + wb / 2)
    return(invisible())
  }
  geo <- geo_likert(premisas); g <- geo$g; fila <- geo$fila; gap <- geo$gap; wp <- ancho_prem(premisas)
  WB <- if (ttb_col) W_BAR else W - MR - X_BAR - 0.3
  altos <- vapply(premisas, function(p) max(alto_txt(p$texto, wp, PT$premisa, TRUE), length(p$filas) * fila), 0)
  tot <- sum(altos) + gap * (length(premisas) - 1)
  disp <- y1 - y0 - 0.7                                   # alto útil menos leyenda
  if (tot < 0.88 * disp) { f_ <- min(2.0, 0.93 * disp / tot)   # pocas filas: se reparte el alto, el grosor no cambia
    fila <- fila * f_; gap <- gap * f_
    altos <- vapply(premisas, function(p) max(alto_txt(p$texto, wp, PT$premisa, TRUE), length(p$filas) * fila), 0)
    tot <- sum(altos) + gap * (length(premisas) - 1) }
  nb_ <- sum(vapply(premisas, function(p) length(p$filas), 0)); extra <- max(0, 0.34 - (fila - g))
  if (extra > 0 && tot + nb_ * extra <= disp + 0.3) {      # aire para las cifras chicas sobre la barra, sólo si cabe
    fila <- fila + extra
    altos <- vapply(premisas, function(p) max(alto_txt(p$texto, wp, PT$premisa, TRUE), length(p$filas) * fila), 0)
    tot <- sum(altos) + gap * (length(premisas) - 1) }
  # Cifras chicas encima de la barra: necesitan 0,36 in libres sobre ella. Si la fila no los
  # tiene, la barra adelgaza (la letra no encoge, el 1 % no se omite, la lámina no se parte más).
  if (any(vapply(premisas, function(p) any(vapply(p$filas, function(fl) tiene_peq(fl$f$pct, WB), TRUE)), TRUE)) && fila - g < 0.36) g <- max(0.24, fila - 0.36)
  y <- y0 + max(0, (y1 - y0 - tot - 0.5) / 2)
  if (ttb_col) {
    txt(doc, if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", X_TTB, y - 0.45, 1.5, 0.26, 10, TK$verde_txt, bold = TRUE, align = "center")
    if (comp21) { txt(doc, "2026", X_TTB, y - 0.22, 0.75, 0.24, 10, TK$navy, bold = TRUE, align = "center")
                  txt(doc, "2021", X_TTB + 0.75, y - 0.22, 0.75, 0.24, 10, TK$soft, bold = TRUE, align = "center") }
  }
  ytop <- y
  for (i in seq_along(premisas)) {
    p <- premisas[[i]]; a <- altos[i]; hp <- alto_txt(p$texto, wp, PT$premisa, TRUE)
    if (ESTILO == "moderna" && i > 1) caja(doc, ML, y - gap / 2, W - ML - MR, 0.008, TK$rule)
    txt(doc, p$texto, X_PREM, y + (a - hp) / 2, wp, hp, PT$premisa, TK$navy, bold = TRUE, align = if (ESTILO == "fiel") "center" else "left")
    yf <- y + (a - length(p$filas) * fila) / 2
    for (fl in p$filas) {
      yb <- yf + (fila - g) / 2 + 0.06
      if (nzchar(fl$actor)) {
        txt(doc, fl$actor, X_ACT, yb + g / 2 - (if (ESTILO == "moderna") 0.25 else 0.15), W_ACT, 0.3, PT$actor, TK$navy, bold = TRUE, align = "right")
        if (ESTILO == "moderna") txt(doc, paste(format(fl$f$valid, big.mark = ","), "respuestas"), X_ACT - 0.4, yb + g / 2, W_ACT + 0.4, 0.26, PT$n, TK$faint, align = "right") }
      barra_apilada(doc, X_BAR, yb, WB, fl$f$pct, cols, g)
      if (ttb_col) etiqueta_ttb(doc, X_TTB, yb, g, fl$f, fl$ttb21, comp21)
      yf <- yf + fila
    }
    y <- y + a + gap
  }
  zona(sprintf("bloque, g = %s cm", cm(g)), X_BAR, ytop, WB, tot)
  fin_bloque <- if (ttb_col) X_TTB + (if (comp21) 1.5 else 0.75) else X_BAR + WB
  leyenda(doc, 0, min(Y_LEY, ytop + tot + 0.3), rotulos, cols, centrar_en = (X_PREM + fin_bloque) / 2)   # centrada en todo el bloque, con la columna Top Two Box (C8, C18)
}
# Partición (receta 2): si no cabe al grosor declarado, la lámina se parte; la
# letra no encoge. Primero el mínimo de láminas; luego, el corte que equilibra
# los altos, para no dejar una lámina «(cont.)» con una sola premisa.
partir <- function(premisas, disponible = ALTO_UTIL) {
  n <- length(premisas); if (alto_bloque(premisas) <= disponible) return(list(premisas))
  cortes_ok <- function(ix) all(vapply(split(premisas, ix), alto_bloque, 0) <= disponible)
  for (k in 2:n) {
    mejor <- NULL; mejor_v <- Inf
    for (cs in utils::combn(n - 1, k - 1, simplify = FALSE)) {
      ix <- findInterval(seq_len(n), cs + 1) + 1
      if (!cortes_ok(ix)) next
      v <- max(vapply(split(premisas, ix), alto_bloque, 0)) - min(vapply(split(premisas, ix), alto_bloque, 0))
      if (v < mejor_v) { mejor_v <- v; mejor <- ix }
    }
    if (!is.null(mejor)) return(unname(split(premisas, mejor)))
  }
  lapply(premisas, list)
}
laminas_likert <- function(doc, t, ante, premisas, base, ...) {
  if (ESTILO == "moderna" && sin_actor(premisas)) premisas <- premisas[order(-vapply(premisas, function(p) ttb(p$filas[[1]]$f), 0))]
  partes <- partir(premisas)
  for (k in seq_along(partes)) { doc <- nueva(doc); titulo(doc, paste0(t, if (k > 1) " (cont.)" else ""), ante = ante)
    bloque_likert(doc, partes[[k]], solo = length(partes) == 1, ...); pie(doc, base) }
  doc
}

# Torta (receta 6): diámetro d exacto. Gajos de 12 % o más con la cifra dentro;
# los menores, afuera junto a su gajo (ángulo calculado como lo dibuja el polar).
torta <- function(doc, x, y, d, labels, pct, n = NULL) {
  df <- data.frame(k = factor(labels, levels = labels), v = pct, et = if (is.null(n)) paste0(pct, "%") else paste0(pct, "%\n(", n, ")"))
  df$col <- ifelse(df$v >= 12, ifelse(seq_along(labels) == 1, "#FFFFFF", TK$navy), NA)
  gp <- ggplot(df, aes(x = 1, y = v, fill = k)) + geom_col(width = 1, colour = TK$fondo, linewidth = 0.8) +
    geom_text(data = df[!is.na(df$col), ], aes(label = et), colour = df$col[!is.na(df$col)], position = position_stack(vjust = 0.5), size = PT$cifra / .pt, fontface = "bold", family = "Arial") +
    coord_polar(theta = "y", direction = -1) + scale_x_continuous(limits = c(0.5, 1.5), expand = c(0, 0)) + scale_y_continuous(expand = c(0, 0)) +
    scale_fill_manual(values = TK$dico) + theme_void() + theme(legend.position = "none", plot.margin = margin(0, 0, 0, 0))
  invisible(ph_with(doc, dml(ggobj = gp, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = x, top = y, width = d, height = d)))
  # el polar apila el primer nivel arriba: el último nivel ocupa y en [0, v_k]
  tope <- rev(cumsum(rev(pct))); medio <- tope - pct / 2
  for (k in which(pct > 0 & pct < 12)) { a <- 2 * pi * medio[k] / sum(pct); r <- d / 2 * 1.22
    cx <- x + d / 2 - r * sin(a); cy <- y + d / 2 - r * cos(a)
    txt(doc, paste0(pct[k], "%"), cx - 0.35, cy - 0.15, 0.7, 0.3, PT$cifra_fuera, TK$navy, bold = TRUE, align = "center") }
  zona(sprintf("círculo, d = %s cm", cm(d)), x, y, d, d)
}
panel_titulo <- function(doc, x, y, w, t, base = NULL) {
  if (ESTILO == "fiel") { txt(doc, t, x, y, w, 0.3, 13, TK$coral, bold = TRUE, align = "center") }
  else { nl <- lineas(t, w, 13, TRUE); txt(doc, t, x, y, w, 0.3 + 0.22 * (nl - 1), 13, TK$navy, bold = TRUE)   # la base baja si la pregunta ocupa dos líneas
    if (!is.null(base)) txt(doc, base, x, y + 0.26 + 0.22 * (nl - 1), w, 0.26, PT$n, TK$faint) }
}

source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_piezas.R", local = TRUE)

# ================================================================ datos derivados
NS <- c(docentes = 52, estudiantes = 172, egresados = 178, administrativos = 15)
pfila <- function(b, v, actor, ttb21 = NULL) list(actor = actor, f = fr(b, v), ttb21 = ttb21)
prem <- function(...) { fl <- list(...); list(texto = fl[[1]]$f$pregunta, filas = fl) }

doc <- read_pptx("api/inst/plantillas/plantilla_16_9.pptx")
if (Sys.getenv("SOLO") %in% c("indices", "objetivo")) {   # sólo las propuestas, para elegir (propuestas_indice.R, propuestas_objetivo.R)
  source(c(indices = "docs/qa/motor-ppt-2026-10-06/herramientas/propuestas_indice.R",
           objetivo = "docs/qa/motor-ppt-2026-10-06/herramientas/propuestas_objetivo.R")[[Sys.getenv("SOLO")]], local = TRUE)
  crudo <- tempfile(fileext = ".pptx"); print(doc, target = crudo)
  if (system2("python3", c(shQuote("docs/qa/motor-ppt-2026-10-06/herramientas/sanear_ph.py"), shQuote(crudo), shQuote(Sys.getenv("SALIDA"))), stdout = FALSE) != 0) stop("sanear_ph.py falló")
  cat("OK propuestas", Sys.getenv("SOLO"), ESTILO, "\n"); quit(save = "no")
}

# ===================================================================== 5 portadilla
portadilla <- function(doc, n, t, sub = NULL, icono = NULL) {
  doc <- nueva(doc, "Section Header")
  if (ESTILO == "fiel") { txt(doc, toupper(t), 2.6, 4.45, 9.8, 1.2, 28, TK$navy, bold = TRUE); zona("título", 2.6, 4.45, 9.8, 1.2) }
  else { rot <- if (is.character(n)) n else sprintf("%02d", n)   # partes del recetario: «I», «III.2»; secciones del informe: 01, 02
    icono_en_circulo(doc, icono %||% ICONO_SECCION[n], 2.6, 3.95, 0.62, fondo = TK$coral); txt(doc, rot, 3.35, 4.02, 2.4, 0.6, 26, TK$coral, bold = TRUE)
    txt(doc, t, 2.6, 4.65, 9.8, 0.7, 32, TK$navy, bold = TRUE); if (!is.null(sub)) txt(doc, sub, 2.6, 5.35, 9.8, 0.4, 15, TK$soft)
    zona("título", 2.6, 4.55, 9.8, 0.7) }
  dibujar_guias(doc); doc
}


# ===================================================================== 0 portada y mapa del recetario
MOTOR_ACT <- "Portada del recetario (no es una lámina del motor)"
doc <- nueva(doc, "Title Slide")
if (ESTILO == "fiel") {
  txt(doc, "RECETARIO DE IDENTIDAD VISUAL", 1.6, 2.65, 10.1, 0.6, 26, TK$navy, bold = TRUE, align = "center")
  txt(doc, "INFORMES CUANTITATIVOS DE PULSO PUCP", 1.6, 3.35, 10.1, 0.45, 18, TK$navy, align = "center")
  txt(doc, "Versión fiel: el estilo entregado, afinado", 1.6, 4.32, 10.1, 0.36, 14, TK$navy, align = "center")
  txt(doc, "Octubre, 2026", 9.2, 5.85, 3.2, 0.34, 13, TK$navy, align = "right")
} else {
  txt(doc, "RECETARIO", 1.6, 2.12, 10.1, 0.32, 13, TK$coral, bold = TRUE, align = "center")
  txt(doc, "Identidad visual de los informes cuantitativos", 1.3, 2.5, 10.7, 1.0, 34, TK$navy, bold = TRUE, align = "center")
  txt(doc, "Reglas, informe tipo, catálogo de láminas y escenarios, con el motor PPT de Prosecnur", 1.6, 3.75, 10.1, 0.4, 18, TK$navy, align = "center")
  txt(doc, "Versión moderna, octubre de 2026", 1.6, 4.25, 10.1, 0.4, 16, TK$soft, align = "center")
}
zona("título del recetario", 1.6, 2.35, 10.1, 1.35); dibujar_guias(doc)

MOTOR_ACT <- "Mapa del recetario (no es una lámina del motor)"
doc <- nueva(doc); titulo(doc, "Cómo recorrer este recetario", ante = "Recetario")
partes <- list(
  list("I", "Reglas de la identidad", "Tamaño, peso y color de cada elemento, retícula, paleta, texto junto a los gráficos, escalas que llegan y reglas de rotulado"),
  list("II", "El informe tipo", "A continuación, un ejemplo de un informe de acreditación"),
  list("III", "Catálogo de láminas y gráficos", "Disposiciones de dos a seis gráficos, láminas de población, la galería de los 24 gráficos y las dimensiones"),
  list("IV", "Escenarios de acreditación", "Lo que cambia entre carreras. IV.1 Actores y bases: seis actores, filtros, cohortes, bases chicas. IV.2 Escalas, etiquetas y formatos"),
  if (file.exists("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m6.R")) list("V", "Otros estudios de PULSO", "La misma identidad en estudios de opinión, monitoreo de campo y seguimiento de indicadores"),
  list("VI", "Banco de recursos", "120 íconos en 12 temáticas, cajas y tarjetas con sus medidas, formas y diagramas, con qué hacer y qué evitar"),
  list("VII", "Alternativas de índice y de cierre", "Cuatro composiciones geométricas para el índice, de 5 a 13 capítulos, con y sin subcapítulos, y su cierre"))
partes <- Filter(Negate(is.null), partes)
hp <- (YF - YT + 0.1) / length(partes)
for (k in seq_along(partes)) { yk <- YT - 0.1 + (k - 1) * hp; p_ <- partes[[k]]
  if (ESTILO == "fiel") { caja(doc, ML, yk + 0.12, 0.62, 0.44, TK$coral); txt(doc, p_[[1]], ML, yk + 0.14, 0.62, 0.4, 16, "#FFFFFF", bold = TRUE, align = "center") }
  else txt(doc, p_[[1]], ML, yk + 0.05, 0.9, 0.55, 28, TK$coral, bold = TRUE)
  txt(doc, p_[[2]], ML + 1.3, yk + 0.02, 5, 0.38, 17, TK$navy, bold = TRUE)
  txt(doc, p_[[3]], ML + 1.3, yk + 0.36, W - MR - ML - 1.5, 0.3, 12, TK$soft)
  if (ESTILO == "moderna" && k < length(partes)) separador_h(doc, ML + 1.3, W - MR, yk + hp - 0.04) }
zona("partes", ML, YT - 0.1, W - MR - ML, YF - YT); pie(doc, "")

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "I", "Reglas de la identidad", "Tamaños, márgenes, colores, texto y rotulado, medidos en los informes entregados", icono = "info")
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m0.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m0b.R", local = TRUE)

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, "II", "El informe tipo", "A continuación, un ejemplo de un informe de acreditación", icono = "scroll-text")

# ===================================================================== 1 portada
MOTOR_ACT <- "p_slide_portada"
doc <- nueva(doc, "Title Slide")
tit_portada <- "Estudio de opinión sobre el servicio educativo ofrecido por la carrera de Contabilidad, en el marco de la reacreditación"
if (ESTILO == "fiel") {
  txt(doc, toupper(tit_portada), 1.6, 2.65, 10.1, 1.35, 22, TK$navy, bold = TRUE, align = "center")
  txt(doc, "Informe consolidado", 1.6, 4.32, 10.1, 0.36, 14, TK$navy, align = "center")
  txt(doc, "Por encargo de la Facultad de Ciencias Contables PUCP", 1.6, 5.05, 10.1, 0.34, 13, TK$navy, align = "center")
  txt(doc, "Setiembre, 2026", 9.2, 5.85, 3.2, 0.34, 13, TK$navy, align = "right")
} else {
  txt(doc, "INFORME CONSOLIDADO", 1.6, 2.12, 10.1, 0.32, 13, TK$coral, bold = TRUE, align = "center")
  txt(doc, tit_portada, 1.3, 2.48, 10.7, 1.5, 30, TK$navy, bold = TRUE, align = "center")
  txt(doc, "Por encargo de la Facultad de Ciencias Contables PUCP", 1.6, 4.65, 10.1, 0.4, 18, TK$navy, align = "center")
  txt(doc, "Setiembre de 2026", 1.6, 5.12, 10.1, 0.4, 18, TK$soft, align = "center")
}
zona("título de portada", 1.6, 2.35, 10.1, 1.35); dibujar_guias(doc)

# ===================================================================== 2 objetivo (uno solo, con diana y flecha)
MOTOR_ACT <- "p_slide_objetivo_icono"
doc <- if (ESTILO == "fiel") nueva(doc, "General Objective") else nueva(doc)   # la moderna usa la plantilla general: sin la línea punteada y con logo
obj <- "Conocer la percepción sobre los propósitos de la carrera de Contabilidad, su perfil de egreso, su plan de estudios y otras dimensiones relevantes para la acreditación, a partir de la opinión de estudiantes, docentes, egresados(as), personal administrativo, Comité Consultivo y empleadores(as)."
if (ESTILO == "fiel") {
  icono(doc, "diana-flecha", "navy", 2.1, 2.55, 1.5)
  txt(doc, "OBJETIVO", 4.05, 2.0, 6, 0.4, 18, TK$coral, bold = TRUE)
  txt(doc, obj, 4.05, 2.45, 8.6, 2.0, 16, TK$navy)
} else {
  # C10 (elegida por Gonzalo entre tres, 2026-10-07: «A. Sobria»): el objetivo en una frase grande con sus temas en negrita y los seis actores debajo.
  icono_en_circulo(doc, "diana-flecha", XC, 1.25, 0.62, fondo = TK$coral)
  txt(doc, "Objetivo del estudio", XC + 0.8, 1.33, 6, 0.45, 20, TK$coral, bold = TRUE)
  txt_runs(doc, list(list(t = "Conocer la percepción sobre "), list(t = "los propósitos de la carrera", b = TRUE), list(t = " de Contabilidad, su "),
                     list(t = "perfil de egreso", b = TRUE), list(t = ", su "), list(t = "plan de estudios", b = TRUE), list(t = " y "),
                     list(t = "otras dimensiones relevantes para la acreditación", b = TRUE),
                     list(t = ", a partir de la opinión de seis actores de la comunidad universitaria y su entorno.")),
           XT, 2.3, AC, 2.0, size = 22)
  separador_h(doc, XC, W - MR, 4.7)
  txt(doc, "Actores consultados", XT, 4.85, AC, 0.32, 12, TK$soft, bold = TRUE)
  actores_obj <- list(c("graduation-cap", "Estudiantes"), c("presentation", "Docentes"), c("briefcase", "Egresados"),
                      c("building-2", "Personal administrativo"), c("users", "Comité Consultivo"), c("briefcase-business", "Empleadores"))
  wa <- AC / length(actores_obj)
  for (k in seq_along(actores_obj)) { xa <- XC + (k - 1) * wa
    icono_en_circulo(doc, actores_obj[[k]][1], xa + (wa - 0.62) / 2, 5.35, 0.62)
    txt(doc, actores_obj[[k]][2], xa, 6.05, wa, 0.5, 12, TK$navy, bold = TRUE, align = "center") }
}
zona("objetivo", XC, 1.25, AC, 5.3); dibujar_guias(doc)

# ===================================================================== 3 ficha técnica
MOTOR_ACT <- "p_slide_tabla_tecnica"
doc <- nueva(doc); titulo(doc, "Ficha técnica cuantitativa", ante = "Metodología")
ft_d <- data.frame(c = c("Tipo y técnica", "Universo", "Muestreo", "Muestra", "Trabajo de campo"),
  v = c("Metodología cuantitativa mediante encuestas telefónicas y por correo electrónico. Encuesta vía correo a docentes y administrativos, y aplicación presencial en aulas a estudiantes. Plataforma: Survey Monkey.",
        "Estudiantes, docentes, egresados(as) y personal administrativo de la carrera de Contabilidad de la PUCP.",
        "No probabilístico por conveniencia, con intención censal.",
        "172 estudiantes (96 %), 52 docentes (92 %), 178 egresados(as) (66 %) y 15 administrativos (94 %).",
        "Del 25 de mayo al 22 de julio de 2026."))
ft <- flextable(ft_d) |> delete_part("header") |> font(fontname = TK$font, part = "all") |> fontsize(size = 15) |>
  color(color = TK$navy) |> bold(j = 1) |> width(j = 1, width = 2.6) |> width(j = 2, width = 9.6) |>
  bg(j = 1, bg = if (ESTILO == "fiel") "#D8D8D8" else TK$zebra) |> valign(valign = "center") |>
  border_remove() |> hline(border = fp_border(color = if (ESTILO == "fiel") "#757070" else TK$rule, width = 0.75)) |>
  hline_top(border = fp_border(color = if (ESTILO == "fiel") "#757070" else TK$navy, width = if (ESTILO == "fiel") 0.75 else 1.25)) |>
  padding(padding.top = 21, padding.bottom = 21, padding.left = 10, padding.right = 10)
if (ESTILO == "fiel") ft <- ft |> vline(border = fp_border(color = "#757070", width = 0.75)) |> vline_left(border = fp_border(color = "#757070", width = 0.75)) |> vline_right(border = fp_border(color = "#757070", width = 0.75))
if (ESTILO == "fiel") {
  invisible(ph_with(doc, ft, location = ph_location(left = ML, top = Y_DATOS + 0.1, width = 12.2, height = 4)))
  zona("tabla", ML, Y_DATOS + 0.1, 12.2, 4.2)
} else {
  # Moderna: filas dibujadas con ícono, y la muestra por actor como cifras (número y tasa de respuesta)
  fil <- list(list("clipboard-list", "Tipo y técnica", ft_d$v[1], 0.95), list("users", "Universo", ft_d$v[2], 0.75), list("shuffle", "Muestreo", ft_d$v[3], 0.6),
              list("hash", "Muestra", NULL, 1.1), list("calendar-days", "Trabajo de campo", ft_d$v[5], 0.6))
  mu <- data.frame(n = c(172, 52, 178, 15), a = c("estudiantes", "docentes", "egresados(as)", "administrativos"), t = c(96, 92, 66, 94))
  y <- Y_DATOS - 0.15; xv <- ML + 3.3; wv <- W - MR - xv
  for (i in seq_along(fil)) { f_ <- fil[[i]]; h_ <- f_[[4]]
    icono_en_circulo(doc, f_[[1]], ML, y + (h_ - 0.48) / 2, 0.48, pad = 0.25)
    txt(doc, f_[[2]], ML + 0.9, y + (h_ - 0.32) / 2, 2.3, 0.32, 14, TK$navy, bold = TRUE)
    if (is.null(f_[[3]])) { for (j in seq_len(nrow(mu))) { xx <- xv + (j - 1) * wv / 4
        txt(doc, mu$n[j], xx, y + 0.02, 1.0, 0.5, 26, TK$navy, bold = TRUE)
        txt(doc, mu$a[j], xx + 0.95, y + 0.21, wv / 4 - 1.0, 0.3, 12, TK$navy)
        txt(doc, sprintf("%d%% de respuesta", mu$t[j]), xx, y + 0.6, wv / 4, 0.28, 11, TK$verde_txt, bold = TRUE) } }
    else txt(doc, f_[[3]], xv, y + (h_ - alto_txt(f_[[3]], wv, 13)) / 2, wv, alto_txt(f_[[3]], wv, 13), 13, TK$navy)
    y <- y + h_ + 0.12
    if (i < length(fil)) separador_h(doc, ML, W - MR, y - 0.06) }
  zona("ficha en filas con ícono", ML, Y_DATOS - 0.15, W - MR - ML, y - Y_DATOS + 0.15)
}
pie(doc, "")

# ===================================================================== 4 índice: retirado del informe tipo (C11; alternativas en la Parte VII)
secciones <- c("Perfil del encuestado", "Características institucionales", "Desarrollo de políticas institucionales",
  "Estructura organizacional, administrativa y financiera", "Cuerpo académico", "Estudiantes y graduados",
  "Infraestructura, instalaciones y recursos de apoyo", "Características del perfil de egreso", "Estructura curricular",
  "Vinculación con el medio y desarrollo sostenible", "Internacionalización integral", "Investigación, desarrollo e innovación (I+D+i)", "Integridad y transparencia")

# ===================================================================== 6 Top Two Box
MOTOR_ACT <- "p_slide_top_two_box"
if (ESTILO == "moderna") {
  doc <- nueva(doc); titulo(doc, "Top Two Box", ante = "Cómo leer este informe")
  txt(doc, paste("Es la suma de los dos valores superiores de la escala. Resume en una cifra el acuerdo de cada grupo",
                 "y permite compararlo entre actores y con mediciones de otros años."), ML, Y_DATOS + 0.05, ANCHO - 0.5, 0.9, 17, TK$navy)
  xb <- ML + 0.4; wb <- 8.9; yb <- 4.0; ej <- c(5, 5, 35, 55); g_ <- 0.8
  barra_apilada(doc, xb, yb, wb, ej, TK$likert[1:4], g_)
  x3 <- xb + wb * 0.10; x4 <- xb + wb
  caja(doc, x3, yb - 0.32, x4 - x3, 0.025, TK$verde_txt); caja(doc, x3, yb - 0.32, 0.025, 0.2, TK$verde_txt); caja(doc, x4 - 0.025, yb - 0.32, 0.025, 0.2, TK$verde_txt)
  caja(doc, (x3 + x4) / 2 - 0.0125, yb - 0.5, 0.025, 0.2, TK$verde_txt)
  txt(doc, "Los dos valores superiores", (x3 + x4) / 2 - 2, yb - 0.85, 4, 0.3, 12, TK$verde_txt, bold = TRUE, align = "center")
  xt <- xb + wb + 0.35; wt <- W - MR - xt
  txt(doc, "Top Two Box", xt, yb - 0.5, wt, 0.3, 13, TK$verde_txt, bold = TRUE, align = "center")
  txt(doc, "90%", xt, yb - 0.12, wt, 0.75, 44, TK$verde_txt, bold = TRUE, align = "center")
  txt(doc, "35% + 55%", xt, yb + 0.7, wt, 0.32, 14, TK$verde_txt, align = "center")
  leyenda(doc, 0, yb + g_ + 0.45, c("1  Totalmente en desacuerdo", "2  En desacuerdo", "3  De acuerdo", "4  Totalmente de acuerdo"), TK$likert[1:4], centrar_en = xb + wb / 2)
  zona("ejemplo: barra, llave y columna Top Two Box", xb, yb - 0.85, W - MR - xb, 2.2); pie(doc, "")
} else {
doc <- nueva(doc); titulo(doc, "Top Two Box", ante = "Cómo leer este informe")
txt(doc, paste("Para facilitar la lectura se suman los dos valores superiores de la escala, suma conocida como Top Two Box.",
               "Con ella se comparan los actores entre sí y con las mediciones de otros años."),
    ML, Y_DATOS, 12.2, 0.95, PT$cuerpo, TK$navy)
xb <- 3.0; wb <- 7.3; yb <- 3.35; ej <- c(5, 5, 35, 55)
barra_apilada(doc, xb, yb, wb, ej, TK$likert[1:4], 0.5)
x3 <- xb + wb * 0.10; x4 <- xb + wb
caja(doc, x3, yb + 0.68, x4 - x3, 0.02, TK$coral); caja(doc, x3, yb + 0.58, 0.02, 0.12, TK$coral); caja(doc, x4 - 0.02, yb + 0.58, 0.02, 0.12, TK$coral)
caja(doc, (x3 + x4) / 2 - 0.01, yb + 0.7, 0.02, 0.14, TK$coral)
txt(doc, if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", (x3 + x4) / 2 - 1.5, yb + 0.88, 3, 0.3, 12, TK$coral, bold = TRUE, align = "center")
txt(doc, "35% + 55% = 90%", (x3 + x4) / 2 - 1.5, yb + 1.16, 3, 0.4, 20, TK$coral, bold = TRUE, align = "center")
# escala 1 a 4 con sus extremos, como en la lámina del motor
ys <- 5.35; xs <- xb + 0.9; ws4 <- wb - 1.8
txt(doc, "Totalmente\nen desacuerdo", xb - 1.25, ys - 0.12, 1.9, 0.6, 12, TK$navy, align = "right")
txt(doc, "Totalmente\nde acuerdo", x4 - 0.6, ys - 0.12, 1.9, 0.6, 12, TK$navy)
caja(doc, xs, ys + 0.12, ws4, 0.02, TK$navy)
for (k in 1:4) { xk <- xs + (k - 0.5) * ws4 / 4; caja(doc, xk - 0.09, ys + 0.32, 0.18, 0.18, TK$likert[k]); txt(doc, k, xk - 0.2, ys + 0.52, 0.4, 0.28, 12, TK$navy, bold = TRUE, align = "center") }
zona("ejemplo", xb, yb - 0.35, wb, 2.2); pie(doc, "")

}
# ===================================================================== 6b redondeo (p_slide_redondeo)
# C13 de la tanda de comentarios: una lámina por método, las dos con el mismo ejemplo (1, 7, 60, 110 y 0 casos de 178).
n_r <- c(1, 7, 60, 110, 0); ex_r <- 100 * n_r / sum(n_r); std_r <- floor(ex_r + 0.5); ent_r <- floor(ex_r); rest_r <- ex_r - ent_r
faltan_r <- 100 - sum(ent_r); suben_r <- order(-rest_r)[seq_len(faltan_r)]; res_r <- ent_r; res_r[suben_r] <- res_r[suben_r] + 1
matriz_redondeo <- function(doc, filas, y0 = Y_DATOS + 1.35) {
  x0 <- ML + 3.1; wc <- 1.6; hr <- 0.66
  for (j in 1:5) { xx <- x0 + (j - 1) * wc
    caja(doc, xx + 0.05, y0, wc - 0.1, 0.1, TK$likert[j]); txt(doc, LIKERT_ROT[j], xx, y0 + 0.14, wc, 0.5, 11, TK$navy, bold = TRUE, align = "center") }
  txt(doc, "Suma", x0 + 5 * wc, y0 + 0.14, 1.3, 0.3, 11, TK$soft, bold = TRUE, align = "center")
  for (i in seq_along(filas)) { f_ <- filas[[i]]; yy <- y0 + 0.75 + (i - 1) * hr
    if (i > 1) separador_h(doc, ML, x0 + 5 * wc + 1.3, yy - 0.1)
    txt(doc, f_$t, ML, yy + 0.06, 3.0, 0.34, 14, TK$navy, bold = TRUE)
    for (j in 1:5) { marca_j <- !is.null(f_$marcar) && j %in% f_$marcar
      if (marca_j) contorno(doc, x0 + (j - 1) * wc + 0.25, yy - 0.03, wc - 0.5, 0.48, TK$coral, lwd = 1.25, lty = "solid")
      txt(doc, f_$d[j], x0 + (j - 1) * wc, yy + 0.05, wc, 0.36, 15, if (marca_j) TK$coral else TK$navy, bold = isTRUE(f_$negrita), align = "center") }
    if (!is.null(f_$s)) txt(doc, f_$s, x0 + 5 * wc, yy + 0.05, 1.3, 0.36, 15, if (f_$s != "100%") TK$coral else TK$navy, bold = TRUE, align = "center") }
  zona("matriz de redondeo", x0, y0, 5 * wc + 1.3, 0.75 + length(filas) * hr)
  y0 + 0.75 + length(filas) * hr
}
MOTOR_ACT <- "p_slide_redondeo (método estándar)"
doc <- nueva(doc); titulo(doc, "Redondeo estándar", ante = "Cómo leer este informe")
txt(doc, "Cada porcentaje se redondea por separado: desde 0.5 sube y por debajo baja. Cada cifra queda lo más cerca posible de su valor exacto, pero la suma puede dar 99% o 101%.",
    ML, Y_DATOS, AC, 0.75, PT$cuerpo, TK$navy)
yf <- matriz_redondeo(doc, list(list(t = "Valor exacto", d = sprintf("%.2f%%", ex_r), s = "100%"),
                                list(t = "Redondeo estándar", d = paste0(std_r, "%"), s = paste0(sum(std_r), "%"), negrita = TRUE)))
txt(doc, sprintf("En este ejemplo la suma queda en %d%%: cada cifra se redondeó por su cuenta.", sum(std_r)), ML, yf + 0.15, AC, 0.32, 13, TK$coral, bold = TRUE)
pie(doc, sprintf("Ejemplo con %s y %d casos de %d", paste(head(n_r, -1), collapse = ", "), tail(n_r, 1), sum(n_r)))

MOTOR_ACT <- "p_slide_redondeo (método del resto mayor)"
doc <- nueva(doc); titulo(doc, "Redondeo del resto mayor", ante = "Cómo leer este informe")
txt(doc, "Primero se toma la parte entera de cada porcentaje. Los puntos que faltan para llegar a 100 se dan, uno por uno, a las categorías con el resto decimal más grande. La suma siempre da 100%.",
    ML, Y_DATOS, AC, 0.75, PT$cuerpo, TK$navy)
yf <- matriz_redondeo(doc, list(list(t = "Valor exacto", d = sprintf("%.2f%%", ex_r), s = "100%"),
                                list(t = "Parte entera", d = paste0(ent_r, "%"), s = paste0(sum(ent_r), "%")),
                                list(t = "Resto decimal", d = sprintf("%.2f", rest_r), marcar = suben_r),
                                list(t = "Resultado", d = paste0(res_r, "%"), s = paste0(sum(res_r), "%"), negrita = TRUE, marcar = suben_r)), y0 = Y_DATOS + 1.05)
txt(doc, sprintf("Faltan %d puntos: van a los tres restos más grandes. El %.2f%% queda en %d%%.", faltan_r, ex_r[1], res_r[1]), ML, yf + 0.1, AC, 0.32, 13, TK$coral, bold = TRUE)
pie(doc, sprintf("Ejemplo con %s y %d casos de %d", paste(head(n_r, -1), collapse = ", "), tail(n_r, 1), sum(n_r)))

MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, 1, "Perfil del encuestado", "Docentes, estudiantes, egresados y administrativos")

# ===================================================================== 7 perfil estudiante (4 paneles)
MOTOR_ACT <- "p_slide_4_graficos_poblacion: p_barras_agrupadas x3 + p_histograma"
doc <- nueva(doc); titulo(doc, "Perfil del estudiante", ante = "Perfil del encuestado")
pw <- (W - ML - MR - 0.6) / 2; xL <- ML; xR <- ML + pw + 0.6; yT <- Y_DATOS; yB <- 4.15
g2 <- D$genero; r <- D$rango; cl <- D$ciclo; e <- D$edad$x; e <- e[!is.na(e)]
panel_titulo(doc, xL, yT, pw, "Sexo", "172 respuestas")
barras_h(doc, xL, yT + 0.6, pw, g2$labels, g2$pct, wlab = 1.8, g = grosor_cat(2), fila = 0.6)
panel_titulo(doc, xR, yT, pw, "Rango de edades", "172 respuestas")
barras_h(doc, xR, yT + 0.55, pw, r$labels, r$pct, wlab = 1.8, g = grosor_cat(4), fila = 0.45)
panel_titulo(doc, xL, yB, pw, "Nivel curricular", "172 respuestas")
barras_h(doc, xL, yB + 0.5, pw, cl$labels, cl$pct, wlab = 1.8, g = grosor_cat(6), fila = 0.36)
panel_titulo(doc, xR, yB, pw, "Edad declarada (años)", "172 respuestas")
tab <- table(factor(pmin(e, 30), levels = min(e):30)); hb <- 1.35; wcol <- (pw - 0.3) / length(tab); yh <- yB + 0.95
for (k in seq_along(tab)) { hk <- hb * tab[[k]] / max(tab); xk <- xR + 0.15 + (k - 1) * wcol
  if (hk > 0) { caja(doc, xk + 0.03, yh + hb - hk, wcol - 0.06, hk, if (ESTILO == "moderna" && tab[[k]] < max(tab)) TK$tenue else TK$navy); txt(doc, tab[[k]], xk - 0.1, yh + hb - hk - 0.27, wcol + 0.2, 0.26, 10, TK$navy, bold = TRUE, align = "center") }
  lab <- names(tab)[k]; if (lab == "30") lab <- "30+"; txt(doc, lab, xk - 0.1, yh + hb + 0.02, wcol + 0.2, 0.24, 10, TK$soft, align = "center") }
med <- median(e); xm <- xR + 0.15 + (min(med, 30) - min(e) + 0.5) * wcol
caja(doc, xm - 0.07, yh + hb + 0.28, 0.14, 0.11, TK$coral, geom = "triangle")
txt(doc, sprintf("Mediana: %d años. Media: %.1f años", as.integer(med), mean(e)), xR + pw - 3.2, yB + 0.5, 3.2, 0.26, 11, TK$coral, bold = TRUE, align = "right")
zona("histograma", xR + 0.15, yh, pw - 0.3, hb)
separador_v(doc, xL + pw + 0.3, yT, YF); separador_h(doc, xL, W - MR, yB - 0.2)   # C15: línea suave entre paneles
pie(doc, "Base: 172 estudiantes")

# ===================================================================== 8 perfil egresado (torta en el fiel)
MOTOR_ACT <- "p_slide_3_graficos_poblacion: p_pie + p_barras_agrupadas x2"
doc <- nueva(doc); titulo(doc, "Perfil del egresado", ante = "Perfil del encuestado")
pw3 <- (W - ML - MR - 0.8) / 3; xs3 <- ML + (0:2) * (pw3 + 0.4); t1 <- D$titulo; a <- D$anio; s <- D$sueldo
panel_titulo(doc, xs3[1], Y_DATOS, pw3, "¿Cuenta con título universitario?", "178 respuestas")
if (ESTILO == "fiel") {
  torta(doc, xs3[1] + (pw3 - 2.05) / 2, Y_DATOS + 0.8, 2.05, t1$labels, t1$pct, t1$n)
  leyenda(doc, 0, Y_DATOS + 3.25, t1$labels, TK$dico, centrar_en = xs3[1] + pw3 / 2)
} else {
  yb <- Y_DATOS + 2.55; wb <- pw3 - 0.2; xb <- xs3[1] + 0.1; w1 <- wb * t1$pct[1] / 100   # C16: más abajo, no se monta sobre la pregunta de dos líneas
  txt(doc, paste0(t1$pct[1], "%"), xb, yb - 0.8, 1.8, 0.5, 26, TK$navy, bold = TRUE)
  txt(doc, sprintf("%s (%d)", t1$labels[1], t1$n[1]), xb, yb - 0.32, 2, 0.28, 12, TK$navy)
  txt(doc, paste0(t1$pct[2], "%"), xb + wb - 1.8, yb - 0.8, 1.8, 0.5, 26, "#4F7FAF", bold = TRUE, align = "right")
  txt(doc, sprintf("%s (%d)", t1$labels[2], t1$n[2]), xb + wb - 2, yb - 0.32, 2, 0.28, 12, TK$navy, align = "right")
  caja(doc, xb + w1, yb, wb - w1, 0.7, TK$dico[2]); caja(doc, xb, yb, w1 + 0.004, 0.7, TK$dico[1])
  zona("barra partida", xb, yb, wb, 0.5)
}
panel_titulo(doc, xs3[2], Y_DATOS, pw3, "¿En qué año obtuvo su título universitario?", "56 egresados titulados")
barras_h(doc, xs3[2], Y_DATOS + 0.85, pw3, a$labels, a$pct, wlab = 0.9, g = grosor_cat(6), fila = 0.75)
panel_titulo(doc, xs3[3], Y_DATOS, pw3, "Sueldo mensual bruto", "167 respuestas")
barras_h(doc, xs3[3], Y_DATOS + 0.85, pw3, s$labels, s$pct, wlab = 1.85, g = grosor_cat(6), fila = 0.66, size = 11)
for (k in 1:2) separador_v(doc, xs3[k] + pw3 + 0.2, Y_DATOS, YF)   # C15
pie(doc, sprintf("Base: %d egresados. Año de titulación, %d que tienen título. Sueldo, %d que respondieron", t1$valid, a$valid, s$valid))

# ===================================================================== 9 perfil comparativo 2021 / 2026
MOTOR_ACT <- "p_slide_3_graficos_fila: p_barras_agrupadas con overrides$comparativo"
doc <- nueva(doc); titulo(doc, "Perfil del estudiante, 2026 frente a 2021", ante = "Perfil del encuestado")
c21 <- list(sexo = c(41, 59, 0), rango = c(47, 41, 7, 5), ciclo = c(17, 22, 13, 14, 13, 21))
pw3b <- (W - ML - MR - 0.8) / 3; xq <- ML + (0:2) * (pw3b + 0.4)
panel_titulo(doc, xq[1], Y_DATOS + 0.45, pw3b, "Sexo")
barras_h(doc, xq[1], Y_DATOS + 1.0, pw3b, g2$labels, g2$pct, wlab = 1.2, g = 0.26, fila = 0.75, comp = c21$sexo)
panel_titulo(doc, xq[2], Y_DATOS + 0.45, pw3b, "Rango de edades")
barras_h(doc, xq[2], Y_DATOS + 1.0, pw3b, r$labels, r$pct, wlab = 1.55, g = 0.26, fila = 0.75, comp = c21$rango)
panel_titulo(doc, xq[3], Y_DATOS + 0.45, pw3b, "Nivel curricular")
barras_h(doc, xq[3], Y_DATOS + 1.0, pw3b, cl$labels, cl$pct, wlab = 1.4, g = 0.26, fila = 0.72, comp = c21$ciclo)
for (k in 1:2) separador_v(doc, xq[k] + pw3b + 0.2, Y_DATOS + 0.45, YF - 0.45)   # C15
leyenda(doc, 0, YF - 0.25, c("2026", "2021"), TK$dico, centrar_en = XC + AC / 2)   # C17: una sola leyenda para los tres, centrada debajo
pie(doc, "Base: 172 estudiantes en 2026")

# ===================================================================== 10 portadilla 2
MOTOR_ACT <- "p_slide_seccion"; doc <- portadilla(doc, 2, "Características institucionales")

# ===================================================================== 11 Sí / No por actor
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce, dicotómica). Partición «(cont.)»"
act <- c("Docentes", "Estudiantes", "Egresados", "Administrativos")
p1 <- list(texto = D$mision1[[1]]$pregunta, filas = lapply(1:4, function(i) list(actor = act[i], f = D$mision1[[i]])))
p2 <- list(texto = D$mision2[[1]]$pregunta, filas = lapply(1:4, function(i) list(actor = act[i], f = D$mision2[[i]])))
doc <- laminas_likert(doc, "Misión y propósitos institucionales", "Características institucionales", list(p1, p2),
                      "Base: 52 docentes, 172 estudiantes, 178 egresados y 15 administrativos. Dónde consultarla: sólo quienes conocen la misión", cols = TK$dico, rotulos = c("Sí", "No"), ttb_col = FALSE)

# ===================================================================== 12 Likert, una afirmación
MOTOR_ACT <- "p_slide_1_grafico: p_barras_apiladas"
doc <- laminas_likert(doc, "Gestión y desarrollo del cuerpo académico", "Cuerpo académico", list(prem(pfila("estudiantes", "p16_6", "Estudiantes"))), "Base: 172 estudiantes")

# ===================================================================== 13 Likert por actor con Top Two Box
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (var_cruce, top2box)"
doc <- laminas_likert(doc, "Gestión y planificación", "Estructura organizacional de gobierno", list(prem(pfila("docentes", "p16_4", "Docentes"), pfila("egresados", "p21_3", "Egresados")),
                        prem(pfila("docentes", "p16_5", "Docentes"), pfila("egresados", "p21_4", "Egresados")),
                        prem(pfila("administrativos", "p13_5", "Administrativos"))), "Base: 52 docentes, 178 egresados y 15 administrativos")

# ===================================================================== 14 Top Two Box 2026 frente a 2021
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas + Top Two Box comparativo declarado"
doc <- laminas_likert(doc, "Orientación y acompañamiento académico", "Estudiantes y graduados", list(prem(pfila("docentes", "p24_6", "Docentes", 98), pfila("estudiantes", "p17_5", "Estudiantes", 84)),
                        prem(pfila("docentes", "p24_7", "Docentes"), pfila("estudiantes", "p17_6", "Estudiantes"))),
                      "Base: 52 docentes y 172 estudiantes. 2021: informe consolidado anterior", comp21 = TRUE)

# ===================================================================== 15 batería de un público
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo var). Partición «(cont.)»"
bat <- lapply(sprintf("p14_%d", 2:7), function(v) prem(pfila("administrativos", v, "Administrativos")))
for (i in seq_along(bat)) bat[[i]]$filas[[1]]$actor <- ""
doc <- laminas_likert(doc, "Gestores universitarios y personal de apoyo", "Estructura organizacional, administrativa y financiera", bat, "Base: 15 administrativos")

# ===================================================================== 16-17 partición «(cont.)»
MOTOR_ACT <- "p_slide_1_grafico: p_barras_multiapiladas (modo var). Partición «(cont.)»"
comp_items <- lapply(sprintf("p30_%d", 1:11), function(v) prem(pfila("docentes", v, "")))
doc <- laminas_likert(doc, "Competencias del perfil de egreso", "Características del perfil de egreso", comp_items, "Base: 51 docentes")

# ===================================================================== 18 radar (fiel) o tabla con puntos (moderna)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_1_grafico: p_radar con tabla nativa" else "propuesta: p_tabla + p_puntos_comparativos (hoy p_radar)"
rd <- D$radar; comp <- c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
dd <- data.frame(Competencia = comp, Docentes = sapply(rd$docentes, `[[`, "ttb"), Estudiantes = sapply(rd$estudiantes, `[[`, "ttb"), Egresados = sapply(rd$egresados, `[[`, "ttb"))
nsr <- c(rd$docentes[[1]]$valid, rd$estudiantes[[1]]$valid, rd$egresados[[1]]$valid)
doc <- nueva(doc); titulo(doc, "Formulación del perfil de egreso", ante = "Características del perfil de egreso", sub = if (ESTILO == "moderna") "Top Two Box (De acuerdo + Totalmente de acuerdo) por competencia y actor. Ordenadas de mayor a menor" else NULL)
tabla_ttb <- function(d, x, y, ws, rowh = 0.5) {
  tb <- d; for (j in 2:4) tb[[j]] <- paste0(tb[[j]], "%")
  ft <- flextable(tb) |> font(fontname = TK$font, part = "all") |> fontsize(size = 13, part = "body") |> fontsize(size = 11, part = "header") |>
    color(color = TK$navy, part = "all") |> bold(part = "header") |> bold(j = 1, part = "body") |>
    align(j = 2:4, align = "center", part = "all") |> valign(valign = "center", part = "all") |> border_remove() |>
    bg(bg = if (ESTILO == "fiel") TK$navy else "transparent", part = "header") |> color(color = if (ESTILO == "fiel") "#FFFFFF" else TK$navy, part = "header") |>
    bg(i = seq(2, nrow(tb), 2), bg = TK$zebra, part = "body") |> hline_bottom(border = fp_border(color = TK$navy, width = 1.25), part = "header") |>
    hline_bottom(border = fp_border(color = TK$rule, width = 0.75), part = "body") |> padding(padding = 6, part = "all") |>
    width(width = ws) |> height(height = rowh, part = "header") |> height(height = rowh, part = "body") |> hrule(rule = "exact", part = "header") |> hrule(rule = "exact", part = "body")
  invisible(ph_with(doc, ft, location = ph_location(left = x, top = y, width = sum(ws), height = rowh * (nrow(tb) + 1))))
  zona("tabla", x, y, sum(ws), rowh * (nrow(tb) + 1))
}
if (ESTILO == "fiel") {
  txt(doc, "% De acuerdo + Totalmente de acuerdo", ML, Y_DATOS - 0.1, 7, 0.32, 14, TK$navy, bold = TRUE)
  ang <- pi / 2 - 2 * pi * (0:5) / 6; lo <- 80; rr <- function(v) (v - lo) / (100 - lo)
  ring <- do.call(rbind, lapply(c(85, 90, 95, 100), function(v) data.frame(r = v, x = rr(v) * cos(c(ang, ang[1])), y = rr(v) * sin(c(ang, ang[1])))))
  ser <- do.call(rbind, lapply(names(TK$actores), function(a) data.frame(a = a, x = rr(dd[[a]]) * cos(ang), y = rr(dd[[a]]) * sin(ang))))
  ser$a <- factor(ser$a, levels = names(TK$actores))
  lab <- data.frame(t = comp, x = 1.2 * cos(ang), y = 1.12 * sin(ang), h = ifelse(abs(cos(ang)) < 0.1, 0.5, ifelse(cos(ang) > 0, 0, 1)))
  gr <- ggplot() + geom_path(data = ring, aes(x, y, group = r), colour = "#C9CED8", linewidth = 0.4) +
    geom_polygon(data = ser, aes(x, y, group = a, colour = a), fill = NA, linewidth = 1.1) + geom_point(data = ser, aes(x, y, colour = a), size = 2.4) +
    geom_text(data = lab, aes(x, y, label = t, hjust = h), size = 12 / .pt, colour = TK$navy, family = "Arial", fontface = "bold") +
    geom_label(data = data.frame(v = c(85, 90, 95, 100)), aes(x = rr(v) * cos((ang[1] + ang[2]) / 2) * cos((ang[1] - ang[2]) / 2) + 0.02,
      y = rr(v) * sin((ang[1] + ang[2]) / 2) * cos((ang[1] - ang[2]) / 2), label = paste0(v, "%")), hjust = 0, vjust = 0.5,   # entre los dos primeros ejes, con fondo y sobre las series
      size = 10 / .pt, colour = TK$soft, family = "Arial", fill = TK$fondo, label.size = 0, label.padding = unit(0.06, "lines")) +
    scale_colour_manual(values = TK$actores) + coord_equal(xlim = c(-1.75, 1.75), ylim = c(-1.25, 1.25), clip = "off") + theme_void() + theme(legend.position = "none")
  invisible(ph_with(doc, dml(ggobj = gr, bg = "transparent", fonts = list(sans = "Arial")), location = ph_location(left = ML, top = Y_DATOS + 0.35, width = 6.4, height = 4.4)))
  zona("radar", ML, Y_DATOS + 0.35, 6.4, 4.4)
  leyenda(doc, 0, Y_LEY, names(TK$actores), TK$actores, centrar_en = ML + 3.4)
  names(dd)[1] <- "Tema"; tabla_ttb(dd, 7.2, Y_DATOS + 0.7, c(2.4, 1.15, 1.2, 1.1), 0.46)
}
if (ESTILO == "moderna") {
  d2 <- dd[order(-rowMeans(dd[, 2:4])), ]; tb <- d2; for (jj in 2:4) tb[[jj]] <- paste0(tb[[jj]], "%")
  rowh <- 0.6; hdrh <- 0.7; x0 <- ML; y0 <- Y_DATOS + 0.35; ws <- c(2.6, 1.1, 1.2, 1.15)
  ft <- flextable(tb) |> font(fontname = TK$font, part = "all") |> fontsize(size = 14, part = "body") |> bold(j = 1, part = "body") |>
    color(color = TK$navy, part = "all") |> align(j = 2:4, align = "center", part = "all") |> valign(valign = "center", part = "all") |>
    border_remove() |> bg(bg = "transparent", part = "all") |> bg(i = seq(2, nrow(tb), 2), bg = TK$zebra, part = "body") |>
    hline_bottom(border = fp_border(color = TK$navy, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = TK$rule, width = 0.75), part = "body") |> padding(padding = 6, part = "all")
  ft <- compose(ft, j = 1, part = "header", value = as_paragraph(as_chunk("Competencia", props = fp_text(font.size = 12, bold = TRUE, color = TK$navy, font.family = TK$font))))
  for (k in 1:3) { a <- names(TK$actores)[k]; ft <- compose(ft, j = a, part = "header", value = as_paragraph(
    as_chunk(a, props = fp_text(font.size = 12, bold = TRUE, color = TK$navy, font.family = TK$font)), "\n",
    as_chunk(paste(nsr[k], "respuestas"), props = fp_text(font.size = 10, color = TK$faint, font.family = TK$font)))) }
  ft <- ft |> width(width = ws) |> height(height = hdrh, part = "header") |> height(height = rowh, part = "body") |> hrule(rule = "exact", part = "header") |> hrule(rule = "exact", part = "body")
  invisible(ph_with(doc, ft, location = ph_location(left = x0, top = y0, width = sum(ws), height = hdrh + nrow(tb) * rowh)))
  zona("tabla", x0, y0, sum(ws), hdrh + nrow(tb) * rowh)
  xs <- x0 + sum(ws) + 0.5; wsx <- W - MR - xs - 0.2; lo <- 80; hi <- 100; px <- function(v) xs + wsx * (v - lo) / (hi - lo)
  for (k in seq_along(TK$actores)) { xx <- xs + (k - 1) * 1.6
    caja(doc, xx, y0 + 0.06, 0.2, 0.2, TK$actores[k], geom = "ellipse"); txt(doc, names(TK$actores)[k], xx + 0.25, y0 - 0.01, 1.3, 0.3, 12, TK$navy) }
  for (v in c(80, 85, 90, 95, 100)) { caja(doc, px(v), y0 + hdrh, 0.006, nrow(tb) * rowh, TK$rule)
    txt(doc, paste0(v, "%"), px(v) - 0.3, y0 + 0.38, 0.6, 0.26, 10, TK$soft, align = "center") }
  for (i2 in seq_len(nrow(d2))) { yc <- y0 + hdrh + (i2 - 0.5) * rowh; vals <- unlist(d2[i2, 2:4])
    caja(doc, px(min(vals)), yc - 0.01, px(max(vals)) - px(min(vals)), 0.02, TK$faint)
    dy <- c(0, 0, 0); for (k in 2:3) for (m in 1:(k - 1)) if (vals[k] == vals[m]) dy[k] <- dy[m] + 0.15
    for (k in 1:3) caja(doc, px(vals[k]) - 0.12, yc - 0.12 + dy[k] - 0.07 * (max(dy) > 0), 0.24, 0.24, TK$actores[k], geom = "ellipse", line = sp_line(color = TK$fondo, lwd = 1.25)) }
  zona("tira de puntos, eje 80 a 100", xs, y0 + hdrh, wsx, nrow(tb) * rowh)
}
pie(doc, sprintf("Base: %d docentes, %d estudiantes y %d egresados", nsr[1], nsr[2], nsr[3]))

# ===================================================================== 20 dos gráficos lado a lado (dos círculos en el fiel)
MOTOR_ACT <- if (ESTILO == "fiel") "p_slide_2_graficos: p_pie x2" else "p_slide_1_grafico: p_barras_multiapiladas (dicotómica)"
if (ESTILO == "moderna") {
  doc <- nueva(doc); titulo(doc, "Situación laboral del egresado", ante = "Estudiantes y graduados")
  for (k in 1:2) { f <- fr("egresados", c("p11", "p12")[k]); yk <- Y_DATOS + 0.2 + (k - 1) * 2.45
    hq <- alto_txt(f$pregunta, 4.6, 14, TRUE); txt(doc, f$pregunta, ML, yk + 0.55 - hq / 2 + 0.25, 4.6, hq, 14, TK$navy, bold = TRUE)
    txt(doc, paste(f$valid, "respuestas"), ML, yk + 0.55 + hq / 2 + 0.25, 4.6, 0.26, 10, TK$faint)
    dicotomia(doc, 5.4, yk + 0.1, W - MR - 5.4, f$labels[1:2], f$pct[1:2], f$n[1:2], size = 32, g = 0.5)
    if (k == 1) separador_h(doc, ML, W - MR, yk + 2.2) }
  pie(doc, "Base: 178 egresados")
} else { doc <- nueva(doc); titulo(doc, "Situación laboral del egresado", ante = "Estudiantes y graduados") }
if (ESTILO == "fiel") for (k in 1:2) { v <- c("p11", "p12")[k]; f <- fr("egresados", v); xk <- ML + (k - 1) * 6.4
  panel_titulo(doc, xk, Y_DATOS, 6.1, f$pregunta, paste(f$valid, "respuestas"))
  if (ESTILO == "fiel") {
    torta(doc, xk + (6.1 - 1.62) / 2, Y_DATOS + 1.25, 1.62, f$labels, f$pct)
    leyenda(doc, 0, Y_DATOS + 3.35, f$labels, TK$dico, centrar_en = xk + 3.05)
  } }
if (ESTILO == "fiel") pie(doc, "Base: 178 egresados")

# ===================================================================== 21 gráfico con texto narrativo
MOTOR_ACT <- "p_slide_1_grafico_narrativo: p_barras_multiapiladas"
doc <- nueva(doc); titulo(doc, "Tutoría socioemocional", ante = "Estudiantes y graduados")
# C20: una sola pregunta de dos filas aprovecha la altura: pregunta como título del panel, barras gruesas centradas, leyenda debajo.
f1 <- fr("docentes", "p24_7"); f2 <- fr("estudiantes", "p17_6")
wpan <- 8.4; ypan <- Y_DATOS + 0.55
panel_titulo(doc, ML, ypan, wpan, f1$pregunta)
yfin <- likert_panel(doc, ML, ypan + 0.75, wpan, list(list(lab = "Docentes", f = f1), list(lab = "Estudiantes", f = f2)), wlab = 1.6, g = 0.62, fila = 1.25, size_lab = 13)
leyenda(doc, 0, yfin + 0.2, LIKERT_ROT, TK$likert, centrar_en = ML + wpan / 2)
narr <- list(list(t = "El "), list(t = paste0(ttb(f1), "% de los docentes"), b = TRUE), list(t = " y el "), list(t = paste0(ttb(f2), "% de los estudiantes"), b = TRUE),
             list(t = " está de acuerdo o totalmente de acuerdo con que la Unidad cuenta con servicios de tutoría socioemocional. "),
             list(t = paste0("Uno de cada ", round(100 / max(1, f2$pct[5])), " estudiantes no tiene información"), b = TRUE), list(t = " sobre el servicio."))
xn <- ML + wpan + 0.6; wn <- W - MR - xn
caja(doc, xn, ypan + 0.75, 0.05, 2.6, TK$coral)
txt_runs(doc, narr, xn + 0.22, ypan + 0.7, wn - 0.22, 2.8, size = 15)
zona("texto narrativo", xn + 0.22, ypan + 0.7, wn - 0.22, 2.8)
pie(doc, "Base: 52 docentes y 172 estudiantes")

source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m2.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m2b.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m2c.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m3a.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m3b.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m3c.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m3d.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m3e.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m4.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m5.R", local = TRUE)

if (file.exists("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m6.R")) source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m6.R", local = TRUE)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m7.R", local = TRUE)   # VI Banco de recursos (I55)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m8.R", local = TRUE)   # VII Alternativas de índice (I56)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m9.R", local = TRUE)   # VII Alternativas de cierre (E8)

# ===================================================================== contraportada (layout de la plantilla)
MOTOR_ACT <- "layout «Contraportada» de la plantilla (cierre de todos los informes entregados)"
doc <- nueva(doc, "Contraportada")
# Contacto con la posición y el tamaño medidos en la contraportada de los informes entregados (12 pt, navy)
txt(doc, "pulsopucp@pucp.edu.pe", 1.08, 6.7, 2.4, 0.4, 12, TK$navy); txt(doc, "Av. Universitaria 1801, San Miguel, Lima 32, Perú", 5.2, 6.69, 4.9, 0.4, 12, TK$navy)
txt(doc, "pulso.pucp.edu.pe", 11.17, 6.71, 1.8, 0.4, 12, TK$navy); dibujar_guias(doc)

# Saneo obligatorio: sin él PowerPoint muestra «Click to add text» en cada forma (H19). LibreOffice y el PDF no lo muestran,
# así que el render no lo delata; por eso va aquí y no como paso aparte que se puede olvidar (pasó el 2026-10-07).
crudo <- tempfile(fileext = ".pptx"); print(doc, target = crudo)
st <- system2("python3", c(shQuote("docs/qa/motor-ppt-2026-10-06/herramientas/sanear_ph.py"), shQuote(crudo), shQuote(Sys.getenv("SALIDA"))), stdout = FALSE)
if (st != 0) stop("sanear_ph.py falló: el PPT quedaría con marcadores vacíos")
cat("OK", FOLIO, "láminas", ESTILO, if (GUIAS) "con guías" else "", "\n")
