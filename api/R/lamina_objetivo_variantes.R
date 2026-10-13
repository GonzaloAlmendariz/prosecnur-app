# lamina_objetivo_variantes.R — las otras dos versiones del objetivo del recetario (G6, Gonzalo 2026-10-13: «en el
# recetario hay varios y cada uno resalta cosas ligeramente diferentes… incluso había uno que te permitía poner perfiles o
# actores»).
#
# Recetario moderno: 26 «clásica» (la de `.lam_laminas_objetivo`: el objetivo y la fila de actores), 27 «panel» (un panel
# azul a la izquierda con la diana y el rótulo; el objetivo y los actores en grilla a la derecha) y 28 «dimensiones»
# («Conocer la percepción sobre» con hasta cuatro tarjetas y «a partir de la opinión de» con los actores). Geometría
# medida con python-pptx sobre recetario-moderna.pptx.

#' Lo que la lámina de objetivo lee de su `meta` (o, por compatibilidad, sólo los actores)
#' @keywords internal
.lam_objetivo_args <- function(x) {
  limpio <- function(v) { v <- as.character(unlist(v %||% character(0))); v[!is.na(v) & nzchar(trimws(v))] }
  # `actores_iconos` va alineado con `actores` («» = automático); una fila vacía se descarta junto con su ícono.
  con_iconos <- function(actores, iconos) {
    actores <- as.character(unlist(actores %||% character(0)))
    iconos <- as.character(unlist(iconos %||% character(0)))
    iconos <- c(iconos, rep("", max(0L, length(actores) - length(iconos))))[seq_along(actores)]
    iconos[is.na(iconos)] <- ""
    vale <- !is.na(actores) & nzchar(trimws(actores))
    list(actores = actores[vale], iconos = trimws(iconos[vale]))
  }
  if (is.list(x) && !is.null(names(x))) {
    ai <- con_iconos(x$actores, x$actores_iconos)
    return(list(actores = ai$actores, iconos = ai$iconos, variante = .lam_objetivo_variante(x$variante),
                dimensiones = limpio(x$dimensiones)))
  }
  ai <- con_iconos(x, NULL)
  list(actores = ai$actores, iconos = ai$iconos, variante = "clasica", dimensiones = character(0))
}

#' Variante del objetivo: «clasica» (26, por defecto), «panel» (27) o «dimensiones» (28)
#' @keywords internal
.lam_objetivo_variante <- function(v) {
  v <- tolower(trimws(as.character(v %||% "")[1]))
  if (is.na(v)) return("clasica")
  if (v %in% c("panel", "27")) "panel" else if (v %in% c("dimensiones", "28")) "dimensiones" else "clasica"
}

#' Un actor con su ícono en un círculo azul (fila o grilla del objetivo)
#' @keywords internal
.lam_objetivo_actor <- function(lz, iconos, actor, x, y, d, centrado = FALSE, w_rotulo = 1.97, size = 13, icono = "") {
  .lam_caja(lz, x, y, d, d, .std_color("azul"), geom = "ellipse", nombre = "objetivo:actor_fondo")
  di <- d * 0.52
  iconos[[length(iconos) + 1L]] <- list(n = .lam_icono_actor(actor, icono), color = "blanco", x = x + (d - di) / 2, y = y + (d - di) / 2, d = di)
  if (centrado) .lam_txt(lz, actor, x + d / 2 - w_rotulo / 2, y + d + 0.08, w_rotulo, 0.5, size, .std_color("azul"), bold = TRUE, align = "center", nombre = "objetivo:actor")
  else .lam_txt(lz, actor, x + d + 0.1, y + (d - 0.42) / 2, w_rotulo, 0.42, size, .std_color("azul"), bold = TRUE, nombre = "objetivo:actor")
  iconos
}

#' Lámina de objetivo 27 (panel) o 28 (dimensiones)
#' @keywords internal
.lam_objetivo_variante_dibujar <- function(doc, texto, titulo, a, layout, master, por_lamina = function(doc) doc) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave"); W <- .std_geom("ancho")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  lz <- .lam_lienzo(); iconos <- list()
  if (identical(a$variante, "panel")) {
    .lam_caja(lz, 0, 0, 4.4, 7.5, azul, nombre = "objetivo:panel")
    iconos[[1]] <- list(n = "diana-flecha", color = "blanco", x = 0.75, y = 1.75, d = 1.15)
    .lam_txt(lz, titulo, 0.75, 3.15, 3.3, 1.3, 32, "#FFFFFF", bold = TRUE, nombre = "objetivo:titulo")
    .lam_caja(lz, 0.75, 4.6, 0.9, 0.06, coral, nombre = "objetivo:filete")
    .lam_txt_tramos(lz, .lam_narrativa_tramos(texto), 5.0, 1.55, 8.02, 2.6, size = 20, nombre = "objetivo:texto")
    if (length(a$actores)) {
      .lam_separador_h(lz, 5.0, 13.02, 4.3)
      .lam_txt(lz, "Actores consultados", 5.0, 4.45, 8.02, 0.32, 12, suave, bold = TRUE, nombre = "objetivo:actores_rotulo")
      for (k in seq_along(a$actores)) {
        fila <- (k - 1L) %/% 3L; col <- (k - 1L) %% 3L
        iconos <- .lam_objetivo_actor(lz, iconos, a$actores[k], 5.0 + col * 2.675, 4.95 + fila * 0.9, 0.58, icono = a$iconos[k])
      }
    }
  } else {
    .lam_caja(lz, 0.49, 0.62, 0.62, 0.62, coral, geom = "ellipse", nombre = "objetivo:icono_fondo")
    iconos[[1]] <- list(n = "diana-flecha", color = "blanco", x = 0.64, y = 0.77, d = 0.32)
    .lam_txt(lz, titulo, 1.29, 0.7, 6, 0.45, 20, coral, bold = TRUE, nombre = "objetivo:titulo")
    .lam_txt(lz, "Conocer la percepción sobre", 0.49, 1.55, 12.52, 0.45, 18, azul, bold = TRUE, nombre = "objetivo:introduccion")
    dims <- utils::head(a$dimensiones, 4L); wt <- 2.94; gap <- (12.52 - 4 * wt) / 3
    for (k in seq_along(dims)) {
      x <- 0.49 + (k - 1L) * (wt + gap)
      .lam_caja(lz, x, 2.1, wt, 1.35, "#FFFFFF", nombre = "objetivo:tarjeta")
      .lam_caja(lz, x, 2.1, wt, 0.06, azul, nombre = "objetivo:tarjeta_filete")
      iconos[[length(iconos) + 1L]] <- list(n = .lam_icono_capitulo(dims[k]), color = "navy", x = x + 0.25, y = 2.38, d = 0.42)
      .lam_txt(lz, dims[k], x + 0.25, 2.86, 2.49, 0.55, 14, azul, bold = TRUE, nombre = "objetivo:dimension")
    }
    if (length(a$actores)) {
      .lam_txt(lz, "a partir de la opinión de", 0.49, 3.85, 12.52, 0.45, 18, azul, bold = TRUE, nombre = "objetivo:actores_rotulo")
      n <- length(a$actores); wc <- 12.52 / n
      for (k in seq_len(n)) {
        xc <- 0.49 + (k - 0.5) * wc
        iconos <- .lam_objetivo_actor(lz, iconos, a$actores[k], xc - 0.36, 4.45, 0.72, centrado = TRUE, w_rotulo = min(2.09, wc),
                                      icono = a$iconos[k])
      }
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:objetivo")
  for (ic in iconos) {
    ruta <- .lam_icono_ruta(ic$n, ic$color)
    if (!is.null(ruta)) doc <- officer::ph_with(doc, officer::external_img(ruta, width = ic$d, height = ic$d),
                                                location = officer::ph_location(left = ic$x, top = ic$y, width = ic$d, height = ic$d, newlabel = "objetivo:icono"))
  }
  list(doc = por_lamina(doc), partes = 1L)
}
