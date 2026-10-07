# Maquetas ilustrativas (NO implementación): dos láminas del mazo de
# acrconta_mazo rehechas con piezas nativas de PowerPoint desde R/officer.
# Mismos datos que las láminas 26 y 51 del mazo generado por el motor.
# Vuelta 4: sin tarjetas blancas sobre gris (contraste de fondo bajo) y la base
# dicha en palabras junto a quien responde. La PALETA es la validada del mazo
# (hex leídos del XML de las láminas 26 y 51): no se toca.
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages({ library(officer); library(flextable) })
`%||%` <- function(a, b) if (is.null(a)) b else a

# ---- tokens únicos (propuesta del kit) ----
TK <- list(
  navy = "#081F5C", titulo = "#CA5651", ink = "#1F2933", soft = "#5F6B7A", faint = "#7D8796",
  rule = "#D5D9DF", zebra = "#EAECEF", aviso = "#8A5A12",
  font = "Arial",
  likert = c(TD = "#F4B183", ED = "#FFD965", DA = "#ADD493", TA = "#70AD47", SI = "#BFBFBF"),
  actores = c(Docentes = "#0B4F8C", Estudiantes = "#2A9D8F", Egresados = "#E9C46A")
)
SP <- list(margen = 0.6, gap = 0.22)
BASE_CHICA <- 30

lum <- function(hex) { v <- grDevices::col2rgb(hex)[, 1] / 255
  v <- ifelse(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055)^2.4); sum(c(.2126, .7152, .0722) * v) }
texto_sobre <- function(hex) if ((1.05) / (lum(hex) + .05) >= 4.5) "#FFFFFF" else TK$ink
base_txt <- function(n) paste(n, "respuestas")

txt <- function(doc, s, l, t, w, h, size = 12, color = TK$ink, bold = FALSE, align = "left") {
  p <- fpar(ftext(s, fp_text(font.size = size, color = color, bold = bold, font.family = TK$font)),
            fp_p = fp_par(text.align = align))
  invisible(ph_with(doc, block_list(p), location = ph_location(left = l, top = t, width = w, height = h)))
}
caja <- function(doc, l, t, w, h, fill, geom = "rect", line = NULL) {
  invisible(ph_with(doc, "", location = ph_location(left = l, top = t, width = w, height = h, bg = fill,
                    geom = geom, ln = line %||% sp_line(color = fill, lwd = 0.25))))
}

# --- pieza: titulo_lamina (antetítulo + título + subtítulo) ---
titulo_lamina <- function(doc, ante, titulo, sub = NULL) {   # sub sólo si el original lo trae
  caja(doc, SP$margen, 0.44, 0.05, if (is.null(sub)) 0.68 else 0.92, TK$navy)
  txt(doc, toupper(ante), SP$margen + 0.2, 0.36, 9, 0.3, 10, TK$soft, bold = TRUE)
  txt(doc, titulo, SP$margen + 0.2, 0.62, 9.8, 0.5, 24, TK$titulo, bold = TRUE)
  if (!is.null(sub)) txt(doc, sub, SP$margen + 0.2, 1.12, 10, 0.32, 12.5, TK$soft)
}
# --- pieza: pie_lamina (regla fina, base y folio en texto, sin plaqueta) ---
pie_lamina <- function(doc, base, n_pag) {
  caja(doc, SP$margen, 6.86, 13.333 - 2 * SP$margen, 0.008, TK$rule)
  txt(doc, base, SP$margen, 6.93, 11.2, 0.42, 10, TK$soft)
  txt(doc, as.character(n_pag), 12.13, 6.93, 0.6, 0.3, 10, TK$soft, bold = TRUE, align = "right")
}

doc <- read_pptx("api/inst/plantillas/plantilla_16_9.pptx")

# ================= Lámina A: barras apiladas por pregunta =================
doc <- add_slide(doc, layout = "Graficos", master = "Office Theme")
titulo_lamina(doc, "Estructura organizacional de gobierno", "Gestión y planificación")
pregs <- list(
  list(q = "El estatuto y las normas internas de la institución permiten que la Unidad se organice adecuadamente para el logro de sus propósitos.",
       f = list(Docentes = c(0, 2, 31, 58, 10), Egresados = c(1, 3, 37, 59, 1)), n = c(52, 178)),
  list(q = "Las normas internas de la Facultad y del Departamento de Ciencias Contables permiten que la Unidad se organice adecuadamente para el logro de sus propósitos.",
       f = list(Docentes = c(2, 0, 35, 58, 6), Egresados = c(1, 1, 40, 57, 2)), n = c(52, 178)),
  list(q = "Los recursos presupuestales asignados a la Unidad son suficientes para atender sus necesidades administrativas.",
       f = list(Administrativos = c(7, 7, 53, 27, 7)), n = c(15))
)
xQ <- SP$margen + 0.2; wQ <- 3.9; xA <- 4.75; wA <- 1.75; xB <- 6.65; wB <- 4.85; xT <- 11.75
fila <- 0.6; barh <- 0.38
# leyenda única, sobre la columna de las preguntas
y <- 1.66; xx <- xQ
nombres <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")
anchos <- c(1.95, 1.2, 0.95, 1.75, 1.3)
for (k in 1:5) { caja(doc, xx, y + 0.08, 0.13, 0.13, TK$likert[k]); txt(doc, nombres[k], xx + 0.19, y, anchos[k], 0.28, 10, TK$soft); xx <- xx + anchos[k] + 0.14 }
txt(doc, "Top Two Box", xT - 0.2, y, 1.4, 0.3, 10, TK$soft, bold = TRUE, align = "center")
y <- 2.08
for (ip in seq_along(pregs)) {
  p <- pregs[[ip]]; nf <- length(p$f)
  lineas <- ceiling(nchar(p$q) / 50)                     # 12 pt en 3,9 in ~ 50 car.
  alto_q <- lineas * 12 * 1.25 / 72
  alto <- max(alto_q, nf * fila) + 0.12                   # el bloque crece con el contenido
  caja(doc, SP$margen, y - SP$gap / 2, 13.333 - 2 * SP$margen, 0.008, TK$rule)   # regla, no tarjeta
  txt(doc, p$q, xQ, y + 0.04, wQ, alto_q + 0.05, 12, TK$ink)
  y0 <- y + (alto - nf * fila) / 2
  for (i in seq_len(nf)) {
    v <- p$f[[i]]; yy <- y0 + (i - 1) * fila + (fila - barh) / 2; nn <- p$n[i]
    txt(doc, names(p$f)[i], xA, yy - 0.07, wA, 0.26, 11, TK$navy, bold = TRUE, align = "right")
    txt(doc, base_txt(nn), xA - 0.4, yy + 0.18, wA + 0.4, 0.24, 10,
        TK$faint, align = "right")
    x <- xB
    for (k in 1:5) {
      w <- wB * v[k] / sum(v)
      if (w > 0.005) caja(doc, x, yy, w, barh, TK$likert[k])
      if (v[k] >= 6) { wl <- max(w, 0.62)   # la caja del rótulo es más ancha que el segmento: no se parte
        txt(doc, paste0(v[k], "%"), x + w / 2 - wl / 2, yy + 0.05, wl, 0.28, 10.5, texto_sobre(TK$likert[k]), bold = TRUE, align = "center") }
      x <- x + w
    }
    txt(doc, paste0(v[3] + v[4], "%"), xT, yy - 0.02, 1, 0.34, 16, TK$navy, bold = TRUE, align = "center")
  }
  y <- y + alto + SP$gap
}
pie_lamina(doc, "Base: 52 docentes, 178 egresados y 15 administrativos", 26)

# ================= Lámina B: tabla con tira de puntos =================
doc <- add_slide(doc, layout = "Graficos", master = "Office Theme")
titulo_lamina(doc, "Formulación del perfil de egreso", "Competencias del perfil de egreso",
              "Top Two Box (De acuerdo + Totalmente de acuerdo) por competencia y actor.")
d <- data.frame(
  Competencia = c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial"),
  Docentes = c(98, 96, 92, 96, 94, 92), Estudiantes = c(96, 91, 94, 95, 96, 94), Egresados = c(98, 98, 94, 93, 98, 95))
d <- d[order(-rowMeans(d[, 2:4])), ]
ns <- c(Docentes = 51, Estudiantes = 109, Egresados = 161)
rowh <- 0.52; hdrh <- 0.66; x0 <- SP$margen; y0 <- 1.75
ws <- c(3.3, 1.45, 1.45, 1.45)
tb <- d; for (j in 2:4) tb[[j]] <- paste0(tb[[j]], "%")
ft <- flextable(tb) |>
  font(fontname = TK$font, part = "all") |> fontsize(size = 14, part = "body") |>
  bold(part = "header") |> color(color = TK$navy, part = "header") |> color(color = TK$ink, part = "body") |>
  bold(j = 1, part = "body") |> color(j = 1, color = TK$navy, part = "body") |>
  align(j = 2:4, align = "center", part = "all") |> align(j = 1, align = "left", part = "all") |>
  valign(valign = "center", part = "all") |>
  bg(bg = "transparent", part = "all") |> bg(i = seq(2, nrow(tb), 2), bg = TK$zebra, part = "body") |>
  border_remove() |> hline_bottom(border = fp_border(color = TK$navy, width = 1.25), part = "header") |>
  hline_bottom(border = fp_border(color = TK$rule, width = 0.75), part = "body") |>
  padding(padding.left = 8, padding.right = 8, part = "all")
ft <- compose(ft, j = 1, part = "header", value = as_paragraph(as_chunk("Competencia", props = fp_text(font.size = 11, bold = TRUE, color = TK$navy, font.family = TK$font))))
for (a in names(ns)) ft <- compose(ft, j = a, part = "header", value = as_paragraph(
  as_chunk(a, props = fp_text(font.size = 11, bold = TRUE, color = TK$navy, font.family = TK$font)), "\n",
  as_chunk(paste(ns[[a]], "respuestas"), props = fp_text(font.size = 10, color = TK$faint, font.family = TK$font))))
ft <- ft |> width(width = ws) |> height(height = hdrh, part = "header") |> height(height = rowh, part = "body") |>
  hrule(rule = "exact", part = "all")
invisible(ph_with(doc, ft, location = ph_location(left = x0, top = y0, width = sum(ws), height = hdrh + nrow(tb) * rowh)))
# tira de puntos, eje 85 a 100 declarado
xs <- x0 + sum(ws) + 0.45; wsx <- 3.8; lo <- 85; hi <- 100
px <- function(v) xs + wsx * (v - lo) / (hi - lo)
for (k in seq_along(TK$actores)) {
  xx <- xs + (k - 1) * 1.3
  caja(doc, xx, y0 + 0.1, 0.14, 0.14, TK$actores[k], geom = "ellipse")
  txt(doc, names(TK$actores)[k], xx + 0.18, y0 + 0.03, 1.1, 0.28, 10, TK$soft)
}
for (v in c(85, 90, 95, 100)) {
  caja(doc, px(v), y0 + hdrh, 0.006, nrow(tb) * rowh, TK$rule)
  txt(doc, paste0(v, "%"), px(v) - 0.3, y0 + 0.38, 0.6, 0.24, 10, TK$faint, align = "center")
}
for (i in seq_len(nrow(d))) {
  yc <- y0 + hdrh + (i - 0.5) * rowh
  vals <- unlist(d[i, 2:4])
  caja(doc, px(min(vals)), yc - 0.008, px(max(vals)) - px(min(vals)), 0.016, TK$faint)
  dy <- c(0, 0, 0); for (k in 2:3) for (m in 1:(k - 1)) if (vals[k] == vals[m]) dy[k] <- dy[m] + 0.12  # empates: se separan, no se tapan
  for (k in 1:3) caja(doc, px(vals[k]) - 0.085, yc - 0.085 + dy[k] - 0.06 * (max(dy) > 0), 0.17, 0.17,
                      TK$actores[k], geom = "ellipse", line = sp_line(color = "#F2F2F2", lwd = 1))
}
pie_lamina(doc, "Base: 51 docentes, 109 estudiantes y 161 egresados", 51)

print(doc, target = Sys.getenv("SALIDA", "tmp/motor-ppt-diag-2026-10-06/maquetas.pptx"))
cat("OK\n")
