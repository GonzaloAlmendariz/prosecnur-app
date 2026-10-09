# =============================================================================
# lamina_compositor.R — la lámina entera del recetario (ADR 0093, N1)
# =============================================================================
#
# El compositor posee la lámina: antetítulo con su barra navy, título, el bloque
# de la ranura, base y folio (`titulo()` y `pie()` de
# `docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R:112-140`, estilo
# moderno), y la partición en «(cont.)» cuando el bloque no cabe.

#' Título de la lámina: barra navy al borde, antetítulo en versalitas y título coral
#' @keywords internal
.lam_titulo <- function(doc, titulo, ante = NULL, sub = NULL) {
  g <- .std_geom; ml0 <- g("margen_izq_borde"); ml <- g("margen_izq"); yt <- g("titulo_y")
  lz <- .lam_lienzo()
  .lam_caja(lz, ml0, yt - 0.12, 0.05, if (is.null(sub)) 0.72 else 0.98, .std_color("azul"), nombre = "titulo:barra")
  if (!is.null(ante) && nzchar(ante)) {
    .lam_txt(lz, toupper(ante), ml, yt - 0.17, 9, 0.26, .std_pt("antetitulo"), .std_color("texto_suave"), bold = TRUE, nombre = "Antetitulo lamina")
  }
  .lam_txt(lz, titulo, ml, yt + 0.06, 10.4, 0.5, .std_pt("titulo"), .std_color("coral"), bold = TRUE, nombre = "Titulo lamina")
  if (!is.null(sub) && nzchar(sub)) .lam_txt(lz, sub, ml, yt + 0.55, 10.4, 0.32, 12.5, .std_color("texto_suave"), nombre = "Subtitulo lamina")
  .lam_agrupar(doc, lz, nombre = "prosecnur:titulo")
}

#' Pie de la lámina: base en negrita y folio a la derecha
#' @keywords internal
.lam_pie <- function(doc, base, folio) {
  g <- .std_geom; lz <- .lam_lienzo()
  if (!is.null(base) && nzchar(base)) .lam_txt(lz, base, g("margen_izq"), g("base_y"), 10.5, 0.4, .std_pt("base"), .std_color("azul"), bold = TRUE, nombre = "Base lamina")
  if (!is.null(folio)) .lam_txt(lz, as.character(folio), g("ancho") - g("margen_der") - 0.6, g("base_y"), 0.6, 0.3, .std_pt("base"),
                                .std_color("texto_suave"), align = "right", nombre = "Folio lamina")
  .lam_agrupar(doc, lz, nombre = "prosecnur:pie")
}

#' Láminas de un gráfico de escala, con su partición
#'
#' @param doc Documento `officer`.
#' @param espec Resultado de `preparar_escala()`.
#' @param folio Folio de la primera lámina (o `NULL` sin folio).
#' @return Lista con `doc` y `partes` (número de láminas agregadas).
#' @keywords internal
.lam_laminas_escala <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL,
                                layout = "Graficos2", master = "Office Theme") {
  premisas <- .lam_escala_premisas(espec)
  partes <- .lam_escala_partir(premisas)
  for (k in seq_along(partes)) {
    doc <- officer::add_slide(doc, layout = layout, master = master)
    doc <- .lam_titulo(doc, paste0(titulo, if (k > 1) " (cont.)" else ""), ante = ante)
    lz <- .lam_lienzo()
    .lam_bloque_escala(lz, espec, partes[[k]], solo = length(partes) == 1L)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:escala")
    doc <- .lam_pie(doc, base, if (is.null(folio)) NULL else folio + k - 1L)
  }
  list(doc = doc, partes = length(partes))
}
