# Piezas compartidas del recetario: se cargan antes de cualquier lámina.
# (Antes vivían en recetario_m2.R, recetario_m2b.R y recetario_m2c.R.)
YT <- Y_DATOS; YF <- 6.72                      # alto útil del contenido
ANCHO <- W - ML - MR; GAP <- 0.5
col2 <- (ANCHO - GAP) / 2
separador_v <- function(doc, x, y0, y1) caja(doc, x, y0, 0.008, y1 - y0, TK$rule)
separador_h <- function(doc, x0, x1, y) caja(doc, x0, y, x1 - x0, 0.008, TK$rule)

# Likert compacto dentro de un panel: rótulo a la izquierda, barra y Top Two Box.
likert_panel <- function(doc, x, y, w, filas, g = 0.34, fila = 0.66, wlab = 1.45, ttb_col = TRUE, cols = TK$likert, size_lab = 11) {
  wttb <- if (ttb_col) 0.75 else 0; xb <- x + wlab + 0.12; wb <- w - wlab - 0.12 - wttb
  if (ttb_col) txt(doc, if (ESTILO == "fiel") "TOP TWO BOX" else "Top Two Box", x + w - wttb - 0.2, y - 0.05, wttb + 0.4, 0.24, 10, TK$verde_txt, bold = TRUE, align = "center")
  yy <- y + 0.3
  for (fl in filas) {
    yb <- yy + (fila - g) / 2 + 0.05
    txt(doc, fl$lab, x, yb + g / 2 - alto_txt(fl$lab, wlab, size_lab, TRUE) / 2, wlab, alto_txt(fl$lab, wlab, size_lab, TRUE), size_lab, TK$navy, bold = TRUE, align = "right")
    barra_apilada(doc, xb, yb, wb, fl$f$pct, cols, g)
    if (ttb_col) txt(doc, paste0(ttb(fl$f), "%"), x + w - wttb, yb + (g - 0.3) / 2, wttb, 0.3, 13, TK$verde_txt, bold = TRUE, align = "center")
    yy <- yy + fila
  }
  zona(sprintf("likert compacto, g = %s cm", cm(g)), xb, y + 0.3, wb, length(filas) * fila)
  invisible(yy)
}
# Panel de texto narrativo: filete coral y párrafo con tramos en negrita.
narrativa <- function(doc, x, y, w, h, runs, size = 15) {
  caja(doc, x, y + 0.05, 0.05, h - 0.1, TK$coral)
  txt_runs(doc, runs, x + 0.22, y, w - 0.22, h, size = size)
  zona("texto narrativo", x, y, w, h)
}
B <- function(t) list(t = t, b = TRUE); N_ <- function(t) list(t = t)

# Dicotomía en una barra partida: cifra grande en cada extremo y la barra debajo.
dicotomia <- function(doc, x, y, w, labels, pct, n = NULL, size = 22, g = 0.34) {
  et <- function(k) if (is.null(n)) labels[k] else sprintf("%s (%d)", labels[k], n[k])
  txt(doc, paste0(pct[1], "%"), x, y, 1.6, size * 1.3 / 72, size, TK$navy, bold = TRUE)
  txt(doc, paste0(pct[2], "%"), x + w - 1.6, y, 1.6, size * 1.3 / 72, size, "#4F7FAF", bold = TRUE, align = "right")
  yl <- y + size * 1.25 / 72; yb <- yl + 0.32      # rótulo y barra se corren según el tamaño de la cifra
  txt(doc, et(1), x, yl, w / 2, 0.26, 10.5, TK$navy); txt(doc, et(2), x + w / 2, yl, w / 2, 0.26, 10.5, TK$navy, align = "right")
  w1 <- w * pct[1] / sum(pct)
  caja(doc, x + w1, yb, w - w1, g, TK$dico[2]); caja(doc, x, yb, w1 + 0.004, g, TK$dico[1])
  zona("dicotomía", x, y, w, yb - y + g)
  invisible(yb + g)
}
# Cifra destacada: número grande, rótulo y precisión debajo.
cifra <- function(doc, x, y, w, valor, rotulo, detalle = NULL, size = 34, align = "left") {
  txt(doc, valor, x, y, w, 0.62, size, TK$navy, bold = TRUE, align = align)
  txt(doc, rotulo, x, y + 0.62, w, 0.3, 12, TK$navy, bold = TRUE, align = align)
  if (!is.null(detalle)) txt(doc, detalle, x, y + 0.9, w, 0.26, 10, TK$faint, align = align)
  zona("cifra", x, y, w, 1.15)
}
icono_poblacion <- function(doc, nombre, cx, cy, d = 1.1) if (ICONO_MODO == "centro") icono_en_circulo(doc, nombre, cx - d / 2, cy - d / 2, d, pad = 0.26)

