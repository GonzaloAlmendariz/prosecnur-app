# lamina_seccion_variantes.R — las otras versiones del separador del recetario (G8, Gonzalo 2026-10-13: «no entiendo
# por qué el separador de sección no te muestra todas las versiones del recetario»).
#
# Recetario moderno, láminas 52–57: capítulo A «número» (52), B «rótulo» (53, la que ya dibujaba `.lam_laminas_seccion`)
# y C «número de fondo» (54); subcapítulo 1 «sobria» (55, la de siempre), 2 «barra lateral» (56) y 3 «banda clara»
# (57). La geometría es la del recetario, medida sobre recetario-moderna.pptx.

#' Variante del separador por nivel; lo que no se reconoce cae en la de siempre
#' @keywords internal
.lam_seccion_variante <- function(variante, nivel = c("capitulo", "subcapitulo")) {
  nivel <- match.arg(nivel)
  v <- tolower(trimws(as.character(variante %||% "")[1]))
  if (is.na(v)) v <- ""
  if (nivel == "capitulo") {
    if (v %in% c("numero", "a")) "numero" else if (v %in% c("fondo", "numero_fondo", "c")) "fondo" else "rotulo"
  } else {
    if (v %in% c("barra", "barra_lateral", "2")) "barra" else if (v %in% c("banda", "banda_clara", "3")) "banda" else "sobria"
  }
}

#' Capítulo A (número grande en coral con filete vertical) o C (número de fondo detrás, a la derecha)
#' @keywords internal
.lam_capitulo_variante <- function(lz, info, titulo, sub) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  if (identical(info$variante, "numero")) {
    # 52: el número a 110 pt; el filete y el título se corren lo que mida un número de dos cifras.
    wn <- max(1.35, .lam_ancho_tinta(info$numero, 110, TRUE) + 0.05)
    .lam_txt(lz, info$numero, 2.5, 3.8, wn + 0.05, 1.7, 110, coral, bold = TRUE, nombre = "seccion:numero")
    x <- 2.5 + wn
    .lam_caja(lz, x, 4.3, 0.04, 1.2, coral, nombre = "seccion:filete")
    .lam_txt(lz, titulo, x + 0.25, 4.2, 13.333 - 0.31 - x - 0.25, 0.6, 30, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, x + 0.25, 4.8, 13.333 - 0.31 - x - 0.25, 0.4, 15, suave, nombre = "seccion:subtitulo")
  } else {
    # 54: el número va primero para quedar detrás del texto.
    .lam_txt(lz, info$numero, 10, 3.7, 2.6, 2.6, 180, .std_color("numero_fondo"), bold = TRUE, align = "right", nombre = "seccion:numero_fondo")
    .lam_txt(lz, toupper(paste(info$rotulo, info$numero)), 2.5, 3.85, 6, 0.36, 15, coral, bold = TRUE, nombre = "seccion:rotulo")
    h <- max(0.7, .lam_alto_tinta(titulo, 7.4, 32, TRUE))
    .lam_txt(lz, titulo, 2.5, 4.25, 7.4, h, 32, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, 2.5, 4.25 + h, 7.4, 0.4, 15, suave, nombre = "seccion:subtitulo")
  }
  invisible(lz)
}

#' Subcapítulo 2 (barra coral a la izquierda) o 3 (banda clara a lo ancho)
#' @keywords internal
.lam_subcapitulo_variante <- function(lz, info, titulo, sub) {
  azul <- .std_color("azul"); coral <- .std_color("coral"); suave <- .std_color("texto_suave")
  con_cap <- !is.na(info$capitulo %||% NA)
  if (identical(info$variante, "barra")) {
    # 56: la ruta, «n.m  Título» en una línea y el subtítulo, junto a una barra coral.
    .lam_caja(lz, 0.49, 2.85, 0.06, 1.35, coral, nombre = "seccion:barra")
    if (con_cap) .lam_txt(lz, toupper(paste0(info$rotulo, " ", info$capitulo_numero, ": ", info$capitulo)), 0.69, 2.82, 9, 0.3, 11, suave, bold = TRUE, nombre = "seccion:ruta")
    .lam_txt(lz, paste0(info$numero, "  ", titulo), 0.69, 3.12, 10, 0.6, 30, azul, bold = TRUE, nombre = "seccion:titulo")
    if (!is.null(sub)) .lam_txt(lz, sub, 0.69, 3.75, 9, 0.4, 15, suave, nombre = "seccion:subtitulo")
  } else {
    # 57: banda clara a lo ancho, el número a 44 pt, un filete coral y debajo del título la ruta (o el subtítulo).
    .lam_caja(lz, 0, 2.55, 13.333, 1.75, .std_color("banda_clara"), nombre = "seccion:banda")
    .lam_txt(lz, info$numero, 0.49, 2.95, 1.6, 0.9, 44, azul, bold = TRUE, nombre = "seccion:numero")
    .lam_caja(lz, 1.95, 3.0, 0.03, 0.9, coral, nombre = "seccion:filete")
    .lam_txt(lz, titulo, 2.15, 2.95, 9, 0.6, 30, azul, bold = TRUE, nombre = "seccion:titulo")
    pie <- sub %||% if (con_cap) paste0(info$rotulo, " ", info$capitulo_numero, ": ", info$capitulo) else NULL
    if (!is.null(pie)) .lam_txt(lz, pie, 2.15, 3.55, 9, 0.4, 14, suave, nombre = "seccion:subtitulo")
  }
  invisible(lz)
}
