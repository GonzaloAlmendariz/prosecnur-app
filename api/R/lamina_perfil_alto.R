# =============================================================================
# lamina_perfil_alto.R — la lámina de perfil usa el alto libre antes de mandar un panel a su imagen de respaldo
# =============================================================================
#
# Ola 3, O4 (verificar_mazo sobre Arte, láminas «PERFIL DEL DOCENTE / ESTUDIANTE»): con el reparto entre filas
# (`.lam_perfil_reparto`) todavía faltaban 0.07 in en la lámina de cinco y 0.4 in en la de cuatro, y el panel que no
# cabía iba como imagen con barras de 0.38–0.50 cm (R5: piso 0.65 cm) y grosores distintos del resto (B3). Mientras
# tanto la lámina dejaba en blanco la franja entre el título de una línea y la zona de datos (~0.8 in) y, en la de
# cinco, 0.47 in bajo la fila de abajo. Gonzalo, 2026-11-08: «los gráficos no aprovechan su alto de forma adecuada
# cuando podrían hacerlo».
#
# Regla: sólo si con el reparto algún panel sigue sin caber, el bloque de paneles se estira en vertical —arriba hasta
# el fin del título más su aire (nunca sobre la cabecera, `composicion.perfil.zona_y0_min`), abajo hasta el fin del
# contenido— y se vuelve a repartir. Quien llama acepta el estiramiento con la misma condición que el reparto: lleva
# paneles del respaldo a barras sin cambiar la forma de ningún otro. Una lámina que ya cabe no cambia: su geometría
# sigue siendo la del recetario.

#' El bloque de paneles de una lámina mixta estirado al alto libre de la lámina
#'
#' @param geo Geometría de la lámina (`.lam_mixta_geo()`, ya bajo su título).
#' @param titulo,sub Título y subtítulo de la lámina; sin título no se sube el bloque (sólo baja su fin).
#' @return `geo` con paneles y filetes llevados a `[y0', contenido_y1]`: crecen las filas, no las calles, o `geo` igual si no
#'   gana alto.
#' @keywords internal
.lam_perfil_estirar <- function(geo, titulo = NULL, sub = NULL) {
  P <- geo$paneles
  # Las disposiciones con receta (corona, tira) dibujan lo que fija el recetario: no se estiran.
  if (length(P) < 2L || !is.null(geo$cifras) || any(!vapply(P, function(p) is.null(p$receta), TRUE))) return(geo)
  y0 <- min(vapply(P, `[[`, 0, "y")); y1 <- max(vapply(P, function(p) p$y + p$h, 0))
  tope <- if (is.null(titulo) || !nzchar(trimws(as.character(titulo)[1]))) y0 else
    max(.std_comp("perfil", "zona_y0_min"), .lam_titulo_fin(titulo, sub) + .std_comp("perfil", "aire_bajo_titulo"))
  n0 <- min(y0, tope); n1 <- max(y1, .std_geom("contenido_y1"))
  if (n0 >= y0 - 0.01 && n1 <= y1 + 0.01) return(geo)
  # Las calles entre filas (con su filete) conservan su alto; sólo crecen las filas de paneles.
  tops <- sort(unique(round(vapply(P, `[[`, 0, "y"), 3)))
  fins <- vapply(tops, function(t) max(vapply(Filter(function(p) abs(p$y - t) < 0.002, P), function(p) p$y + p$h, 0)), 0)
  if (length(tops) > 1L && any(tops[-1] < fins[-length(fins)] - 0.002)) return(geo)   # filas que se solapan: no se estira
  calles <- sum(tops[-1] - fins[-length(fins)])
  k <- (n1 - n0 - calles) / (y1 - y0 - calles)
  xs <- c(rbind(tops, fins)); ys <- numeric(length(xs)); ys[1] <- n0
  for (i in seq_along(xs)[-1]) ys[i] <- ys[i - 1] + (xs[i] - xs[i - 1]) * (if (i %% 2 == 0) k else 1)
  ty <- function(y) stats::approx(xs, ys, xout = y, rule = 2, ties = "ordered")$y +
    (if (y > max(xs)) (y - max(xs)) else if (y < min(xs)) (y - min(xs)) else 0)
  geo$paneles <- lapply(P, function(p) { y <- ty(p$y); p$h <- ty(p$y + p$h) - y; p$y <- y; p })
  geo$filetes <- lapply(geo$filetes, function(f) {
    if (identical(f$tipo, "v")) { f$y0 <- ty(f$y0); f$y1 <- ty(f$y1) } else f$y <- ty(f$y)
    f
  })
  geo
}
