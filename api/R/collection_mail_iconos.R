# collection_mail_iconos.R — los 12 íconos cerrados del bloque `icon_text`
# (E1o «Piezas gráficas», collection_mail_piezas.R).
#
# Cada ícono es un PNG CUADRADO de 48 × 48 generado aquí (sin SVG: los clientes
# de correo no lo pintan), en un solo color sobre fondo transparente, con
# antialias por supermuestreo 4 × 4. Se dibujan con primitivas geométricas
# sobre una cuadrícula de 48 unidades (trazo de 4 unidades, como un ícono de
# 24 px con trazo de 2 px a 2x). El render los muestra a 24 o 32 px, siempre
# cuadrados: nunca otra proporción.
#
# Determinista por (ícono, color): se guarda en una caché temporal del proceso.

.CMAIL_ICONS <- c("calendario", "reloj", "candado", "sobre", "persona", "grupo",
                  "mapa", "check", "info", "alerta", "regalo", "enlace")
.CMAIL_ICON_PX <- 48L
.CMAIL_ICON_SS <- 4L
.CMAIL_ICON_W <- 4

# ---- primitivas (máscaras lógicas sobre la cuadrícula supermuestreada) -------

.cmail_icon_grid <- function() {
  n <- .CMAIL_ICON_PX * .CMAIL_ICON_SS
  c0 <- (seq_len(n) - 0.5) / .CMAIL_ICON_SS
  list(X = matrix(c0, n, n, byrow = TRUE), Y = matrix(c0, n, n))
}

.cmail_icon_shapes <- function(g) {
  X <- g$X; Y <- g$Y
  d_seg <- function(x1, y1, x2, y2) {
    dx <- x2 - x1; dy <- y2 - y1
    t <- pmin(1, pmax(0, ((X - x1) * dx + (Y - y1) * dy) / (dx * dx + dy * dy)))
    sqrt((X - x1 - t * dx)^2 + (Y - y1 - t * dy)^2)
  }
  d_box <- function(x0, y0, x1, y1, r) {
    qx <- abs(X - (x0 + x1) / 2) - (x1 - x0) / 2 + r
    qy <- abs(Y - (y0 + y1) / 2) - (y1 - y0) / 2 + r
    sqrt(pmax(qx, 0)^2 + pmax(qy, 0)^2) + pmin(pmax(qx, qy), 0) - r
  }
  side <- function(ax, ay, bx, by) (bx - ax) * (Y - ay) - (by - ay) * (X - ax)
  list(
    disc = function(cx, cy, r) (X - cx)^2 + (Y - cy)^2 <= r^2,
    ring = function(cx, cy, r, w = .CMAIL_ICON_W) abs(sqrt((X - cx)^2 + (Y - cy)^2) - r) <= w / 2,
    seg = function(x1, y1, x2, y2, w = .CMAIL_ICON_W) d_seg(x1, y1, x2, y2) <= w / 2,
    capsule_ring = function(x1, y1, x2, y2, r, w = .CMAIL_ICON_W) abs(d_seg(x1, y1, x2, y2) - r) <= w / 2,
    rect = function(x0, y0, x1, y1) X >= x0 & X <= x1 & Y >= y0 & Y <= y1,
    rbox = function(x0, y0, x1, y1, r) d_box(x0, y0, x1, y1, r) <= 0,
    rbox_stroke = function(x0, y0, x1, y1, r, w = .CMAIL_ICON_W) abs(d_box(x0, y0, x1, y1, r)) <= w / 2,
    tri = function(ax, ay, bx, by, cx, cy) {
      s1 <- side(ax, ay, bx, by); s2 <- side(bx, by, cx, cy); s3 <- side(cx, cy, ax, ay)
      (s1 >= 0 & s2 >= 0 & s3 >= 0) | (s1 <= 0 & s2 <= 0 & s3 <= 0)
    },
    below = function(y) Y <= y,
    above = function(y) Y >= y
  )
}

# Máscara de cada ícono (unidades 0..48, y hacia abajo).
.cmail_icon_mask <- function(icon, s) {
  switch(icon,
    calendario = s$rbox_stroke(7, 10, 41, 41, 4) | s$seg(7, 19.5, 41, 19.5) |
      s$seg(16, 5, 16, 13) | s$seg(32, 5, 32, 13) | s$rbox(14, 26, 21, 33, 1.5),
    reloj = s$ring(24, 24, 18) | s$seg(24, 24, 24, 13) | s$seg(24, 24, 31, 29),
    candado = (s$rbox(9, 21, 39, 42, 4) & !(s$disc(24, 29.5, 3.2) | s$rect(22.6, 29.5, 25.4, 36))) |
      (s$ring(24, 20, 9) & s$below(20)) | s$seg(15, 20, 15, 22) | s$seg(33, 20, 33, 22),
    sobre = s$rbox_stroke(5, 11, 43, 37, 3) | s$seg(7, 14, 24, 27) | s$seg(24, 27, 41, 14),
    persona = s$disc(24, 15, 8) | (s$disc(24, 44, 15) & s$below(41)),
    grupo = {
      front <- s$disc(19, 17, 7) | (s$disc(19, 42, 12.5) & s$below(41))
      halo <- s$disc(19, 17, 9.5) | (s$disc(19, 42, 15) & s$below(43))
      back <- s$disc(33, 14, 6) | (s$disc(34, 37, 10.5) & s$below(41))
      front | (back & !halo)
    },
    mapa = (s$disc(24, 19, 13) | s$tri(12.5, 25, 35.5, 25, 24, 44)) & !s$disc(24, 19, 5),
    check = s$seg(10, 25, 20, 35, 5) | s$seg(20, 35, 38, 14, 5),
    info = s$disc(24, 24, 20) & !(s$disc(24, 14.5, 2.8) | s$rbox(21.8, 20.5, 26.2, 35, 1.5)),
    alerta = s$tri(24, 5, 45, 41, 3, 41) & !(s$seg(24, 17, 24, 28, 4.4) | s$disc(24, 34.5, 2.6)),
    regalo = ((s$rect(9, 23, 39, 42) | s$rect(6, 15, 42, 22)) & !s$rect(22.3, 15, 25.7, 42)) |
      s$ring(18.5, 10, 4.5, 3.5) | s$ring(29.5, 10, 4.5, 3.5),
    enlace = s$capsule_ring(12, 36, 19, 29, 6.5) | s$capsule_ring(29, 19, 36, 12, 6.5) |
      s$seg(19.5, 28.5, 28.5, 19.5),
    NULL
  )
}

#' PNG cuadrado (48 × 48, RGBA) de un ícono cerrado en `color` (#rrggbb).
#' @keywords internal
.cmail_icon_png <- function(icon, color) {
  if (!(icon %in% .CMAIL_ICONS)) return(NULL)
  dir <- file.path(tempdir(), "prosecnur-cmail-piezas")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir, sprintf("icono-%s-%s.png", icon, sub("^#", "", tolower(color))))
  if (file.exists(path)) return(path)
  mask <- .cmail_icon_mask(icon, .cmail_icon_shapes(.cmail_icon_grid()))
  n <- .CMAIL_ICON_PX; ss <- .CMAIL_ICON_SS
  # Cobertura: promedio de cada bloque ss × ss.
  idx <- rep(seq_len(n), each = ss)
  alpha <- rowsum(t(rowsum(mask * 1, idx)), idx) / (ss * ss)
  alpha <- t(alpha)
  ink <- .cmail_rgb(color) / 255
  img <- array(0, dim = c(n, n, 4L))
  for (ch in 1:3) img[, , ch] <- ink[[ch]]
  img[, , 4L] <- alpha
  tmp <- tempfile("icono-", tmpdir = dir, fileext = ".png")
  png::writePNG(img, tmp)
  file.rename(tmp, path)
  path
}
