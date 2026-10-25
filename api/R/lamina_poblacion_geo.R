# Láminas de población de tira, cinco y seis gráficos con el marco del recetario (checklist-poblacion-y-filtro, P4).
#
# Antes no tenían composición nativa: salían siempre en la plantilla anterior (título en mayúsculas, sin el enunciado de
# cada pregunta, gráficos ggplot). Las ranuras salen del estándar (`ppt.tipos_lamina`), la fuente única de su geometría.
# La tira lleva el enunciado en una columna a la izquierda y el gráfico a la derecha (recetario_m2c.R:26-35).

#' Paneles y filetes de una lámina de población desde las ranuras del estándar
#' @param lateral La receta de la tira: el enunciado a la izquierda y el gráfico a su derecha.
#' @keywords internal
.lam_poblacion_geo <- function(tipo_std, lateral = FALSE) {
  r <- Filter(function(x) identical(x$tipo, "grafico"), .std_tipo_lamina(tipo_std)$ranuras %||% list())
  if (!length(r)) return(NULL)
  receta <- if (isTRUE(lateral)) .lam_receta_lateral() else NULL
  paneles <- lapply(r, function(q) list(x = q$x, y = q$y, w = q$w, h = q$h, receta = receta))
  filetes <- list()
  for (i in seq_along(r)) for (j in seq_along(r)) {
    a <- r[[i]]; b <- r[[j]]
    # Vecinos en la misma fila: filete vertical al medio de la calle. En la misma columna: horizontal.
    if (abs(a$y - b$y) < 0.05 && b$x > a$x + a$w - 0.01 && b$x - (a$x + a$w) < 1) {
      filetes[[length(filetes) + 1L]] <- list(tipo = "v", x = (a$x + a$w + b$x) / 2, y0 = a$y, y1 = a$y + a$h)
    }
    if (b$y > a$y + a$h - 0.01 && b$y - (a$y + a$h) < 1 && b$x < a$x + a$w && b$x + b$w > a$x && i < j) {
      filetes[[length(filetes) + 1L]] <- list(tipo = "h", x0 = min(a$x, b$x), x1 = max(a$x + a$w, b$x + b$w), y = (a$y + a$h + b$y) / 2)
    }
  }
  # Un filete horizontal por fila basta, y cubre el ancho de todos los paneles que separa: dos filetes a la misma altura
  # se unen en uno (antes se quedaba el primero y la lámina de cinco dejaba sin línea el panel de abajo a la derecha).
  claves <- vapply(filetes, function(f) paste(f$tipo, round(f$x %||% f$y, 2)), "")
  unidos <- filetes[!duplicated(claves)]
  # Lo mismo en vertical (CCSS-30): el filete de la fila de abajo cae en la misma x que el de arriba y se descartaba; se
  # unen en uno continuo por columna, como en la grilla de cuatro.
  for (k in seq_along(unidos)) {
    mismos <- filetes[claves == claves[!duplicated(claves)][k]]
    if (identical(unidos[[k]]$tipo, "h")) {
      unidos[[k]]$x0 <- min(vapply(mismos, function(f) f$x0, 0))
      unidos[[k]]$x1 <- max(vapply(mismos, function(f) f$x1, 0))
    } else {
      unidos[[k]]$y0 <- min(vapply(mismos, function(f) f$y0, 0))
      unidos[[k]]$y1 <- max(vapply(mismos, function(f) f$y1, 0))
    }
  }
  list(paneles = paneles, filetes = unidos)
}

#' Receta de la tira (recetario_m2c.R:26-35): enunciado en una columna de 3.9 in, gráfico desde 4.2 in, dicotomía de 20 pt
#' @keywords internal
.lam_receta_lateral <- function() {
  list(lateral = list(w_titulo = 3.9, x_grafico = 4.2),
       dicotomia = list(ancho_pleno = TRUE, size = 20, g = 0.32, dy = -0.05, alto_min = 0.8),
       barras = list(dy = 0, fila = 0.42, sangria = 0))
}

#' El rectángulo del gráfico en un panel lateral (sin enunciado encima: va a la izquierda)
#' @keywords internal
.lam_panel_lateral_rect <- function(p) {
  la <- p$receta$lateral
  list(x = p$x + la$x_grafico, y = p$y, w = p$w - la$x_grafico, h = p$h)
}
