# lamina_marco_respaldo.R — la lámina que no cabe en pieza nativa lleva el mismo marco que las nativas.
#
# CCSS Perfil 2026 (láminas 8, 10, 28, 34 y 37): una dona de cuatro porciones, una categórica de trece categorías o una agrupada
# con cruces siguen por la ruta anterior (el gráfico entra como `ggplot`). Esa ruta rellenaba los marcadores de la plantilla:
# título sin la barra azul de acento ni antetítulo, sin folio, «Base:» 0.1 in a la izquierda y, con la nota de significancia,
# la nota en el marcador derecho debajo de la leyenda del gráfico (la pisaba). Con la plantilla estándar el marco se dibuja con
# las mismas piezas que la lámina nativa (`.lam_titulo`, `.lam_pie`, `.lam_nota_sig_dibujar`), el subtítulo baja lo que miden
# las líneas del título (`.lam_titulo`) y el cajón del gráfico cede el alto que ocupan el bloque de título y la nota.
# Con una plantilla propia nada cambia: el marco es el de sus marcadores.

#' Prepara el marco de una lámina por la ruta anterior
#'
#' @param activo ¿Plantilla estándar? Si no, el marco queda inactivo y la lámina sigue con los marcadores.
#' @param titulo,subtitulo,antetitulo Textos de la lámina.
#' @param p Gráfico ya renderizado (de él sale la nota de significancia).
#' @return Entorno con `activo`, los textos, `nota`, `base` y `derecha` (los llena el motor), y `folio` (se fija al dibujar).
#' @keywords internal
.lam_respaldo_marco <- function(activo, titulo, subtitulo, antetitulo, p) {
  m <- new.env(parent = emptyenv())
  limpio <- function(x) { x <- as.character(x %||% "")[1]; if (is.na(x) || !nzchar(trimws(x))) NULL else trimws(x) }
  m$activo <- isTRUE(activo)
  m$titulo <- limpio(titulo); m$sub <- limpio(subtitulo); m$ante <- limpio(antetitulo)
  m$nota <- .lam_nota_sig_de(p)
  m$base <- NULL; m$derecha <- NULL
  m
}

#' Dibuja el bloque de título (barra de acento, antetítulo, título y subtítulo) si el marco está activo
#' @keywords internal
.lam_respaldo_titulo <- function(doc, m) {
  if (!m$activo) return(doc)
  m$folio <- length(doc)   # la lámina ya se agregó: su número es el largo del documento
  .lam_titulo(doc, m$titulo %||% "", ante = m$ante, sub = m$sub)
}

#' Dibuja el pie (nota de significancia, «Base:» con su nota y folio) si el marco está activo
#'
#' La nota del marcador derecho se une a «Base:» como en la lámina nativa; si es la misma nota de significancia (que se escribe
#' aparte sobre «Base:») no se repite.
#' @keywords internal
.lam_respaldo_cierre <- function(doc, m) {
  if (!m$activo) return(doc)
  norm <- function(x) gsub("\\s+", " ", trimws(as.character(x %||% "")[1]))
  der <- m$derecha
  if (!is.null(der) && !is.null(m$nota) && identical(norm(der), norm(m$nota))) der <- NULL
  base <- paste(Filter(function(x) !is.null(x) && nzchar(trimws(x)), list(m$base, der)), collapse = ". ")
  if (!is.null(m$nota)) doc <- .lam_nota_sig_dibujar(doc, m$nota)
  .lam_pie(doc, if (nzchar(base)) base else NULL, m$folio)
}

#' Cajón del gráfico bajo el marco: baja bajo el subtítulo y sube sobre la nota
#'
#' Sólo se toca si hace falta: un título de una línea sin nota deja el cajón de la plantilla tal cual.
#' @param spec Marcador del gráfico del contrato.
#' @param pic Propiedades del marcador de imagen de la plantilla (`left`, `top`, `width`, `height` en pulgadas).
#' @param p Gráfico que va en el cajón: lo que su título de lienzo sobresale por arriba también baja el cajón (P2,
#'   lamina_titulo_lienzo.R), para que nunca toque el bloque de título.
#' @keywords internal
.lam_respaldo_cajon <- function(spec, m, pic, p = NULL) {
  if (!m$activo || is.null(pic)) return(spec)
  g <- .std_geom
  fin_bloque <- .lam_titulo_fin(m$titulo, m$sub)
  fondo <- pic$top + pic$height
  if (!is.null(m$nota)) fondo <- min(fondo, g("base_y") - .lam_nota_sig_alto(m$nota) - 0.05)
  aire <- if (isTRUE(attr(p, "pulso_titulo_panel", exact = TRUE))) 0.22 else 0.08   # CCSS-27: el encabezado de panel no se pega al título
  top <- max(pic$top, fin_bloque + aire)
  # El desborde depende del alto del cajón; tres pasadas bastan (el cajón sólo se acorta unas décimas).
  if (!is.null(p)) for (k in 1:3) top <- max(pic$top, fin_bloque + aire + .lienzo_desborde_superior_in(p, fondo - top))
  if (abs(top - pic$top) < 1e-6 && abs(fondo - pic$top - pic$height) < 1e-6) return(spec)
  spec$loc <- list(left = pic$left, top = top, width = pic$width, height = max(1, fondo - top))
  spec
}

#' Dónde termina el bloque de título de `.lam_titulo` (in): bajo el subtítulo si lo hay; si no, bajo la última línea del título
#' @keywords internal
.lam_titulo_fin <- function(titulo, sub = NULL) {
  g <- .std_geom
  hay_sub <- !is.null(sub) && length(sub) && !is.na(sub[1]) && nzchar(trimws(sub[1]))
  if (hay_sub) g("titulo_y") + 0.55 + .lam_titulo_baja(titulo) + 0.32 else
    g("titulo_y") + 0.06 + max(1, .lam_titulo_lineas(titulo)) * .std_pt("titulo") * 1.2 / 72 + 0.05
}

#' Líneas del título a 24 pt en el ancho del título (mínimo 1)
#' @keywords internal
.lam_titulo_lineas <- function(titulo) {
  t <- trimws(as.character(titulo %||% "")[1])
  if (is.na(t) || !nzchar(t)) return(1L)
  max(1L, as.integer(.lam_lineas_tinta(t, 10.4, .std_pt("titulo"), TRUE)[1]))
}

#' Lo que baja el subtítulo por las líneas de título de más (pulgadas)
#' @keywords internal
.lam_titulo_baja <- function(titulo) (.lam_titulo_lineas(titulo) - 1L) * .std_pt("titulo") * 1.2 / 72

#' Propiedades del marcador de imagen del layout (para recortar su cajón), o `NULL`
#' @keywords internal
.lam_respaldo_pic <- function(doc, layout, master) {
  pr <- tryCatch(officer::layout_properties(doc, layout = layout, master = master), error = function(e) NULL)
  if (is.null(pr)) return(NULL)
  pr <- pr[pr$type %in% "pic", , drop = FALSE]
  if (!nrow(pr)) return(NULL)
  list(left = pr$offx[[1]], top = pr$offy[[1]], width = pr$cx[[1]], height = pr$cy[[1]])
}
