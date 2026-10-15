# El antetítulo que hace de leyenda (checklist-histograma-serie-antetitulo-2026-10-14.md, G4).
#
# Gonzalo (2026-10-14): «integrar cosas elegantes como un antetítulo con colores de los actores o perfiles por
# leyenda». En una lámina que compara públicos o perfiles, el antetítulo conserva el capítulo en gris y sigue con cada
# público en su color, con un punto delante: la leyenda queda arriba, donde se lee antes que el gráfico, y la de abajo
# sobra. Una lámina puede apagarlo con `meta$leyenda_antetitulo = FALSE` (el compositor lo deja en la opción
# `prosecnur.lam_leyenda_antetitulo` mientras arma esa lámina).

#' ¿Esta lámina lleva la leyenda en el antetítulo?
#' @param grupos Nombres de las series que la lámina leyendaría.
#' @keywords internal
.lam_leyenda_va_arriba <- function(grupos) {
  grupos <- as.character(grupos %||% character(0))
  sintetica <- length(grupos) == 1L && trimws(tolower(grupos[1])) %in% c("total", "")
  length(grupos) >= 2L && !sintetica && !identical(getOption("prosecnur.lam_leyenda_antetitulo", TRUE), FALSE)
}

#' Antetítulo con el capítulo en gris y cada público en su color
#'
#' @param ante Antetítulo de la lámina (capítulo), o `NULL`.
#' @param colores Colores nombrados por serie, en el orden de la leyenda.
#' @keywords internal
.lam_txt_ante_leyenda <- function(lz, ante, colores, l, t, w, h, size, color_ante, nombre = "Antetitulo lamina") {
  fuente <- .std_pt("fuente")
  run <- function(texto, color) paste0(
    '<a:r><a:rPr lang="es-PE" sz="', round(size * 100), '" b="1" i="0" dirty="0">',
    '<a:solidFill><a:srgbClr val="', .lam_hex(color), '"/></a:solidFill>',
    '<a:latin typeface="', fuente, '"/><a:ea typeface="', fuente, '"/><a:cs typeface="', fuente, '"/></a:rPr>',
    '<a:t>', .lam_xml_esc(texto), '</a:t></a:r>')
  runs <- character(0)
  if (!is.null(ante) && nzchar(ante)) runs <- c(runs, run(toupper(ante), color_ante), run("   ", color_ante))
  for (k in seq_along(colores)) {
    runs <- c(runs, run("● ", colores[[k]]), run(toupper(names(colores)[k]), colores[[k]]))
    if (k < length(colores)) runs <- c(runs, run("    ", color_ante))
  }
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, w, h), '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>',
    '<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="t" anchorCtr="0">',
    '<a:noAutofit/></a:bodyPr><a:lstStyle/>',
    '<a:p><a:pPr algn="l" marL="0" marR="0" indent="0"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc>',
    '<a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>',
    paste(runs, collapse = ""), '</a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, w, h)
}
