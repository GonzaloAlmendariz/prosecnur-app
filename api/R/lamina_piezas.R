# =============================================================================
# lamina_piezas.R — primitivas nativas de la lámina (ADR 0093)
# =============================================================================
#
# Portadas de `docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R` (`txt`,
# `caja`, `ancho_tinta`, `texto_sobre`, `alto_txt`). La diferencia es que aquí no
# se escribe forma por forma en la lámina: las piezas se acumulan en un lienzo y
# entran como UN `p:grpSp` (decisión 7), para que el gráfico se mueva y se edite
# en PowerPoint como un bloque y los medidores lo encuentren.
#
# Dentro de un grupo no puede haber placeholders, así que cada forma lleva
# explícito lo que en el recetario heredaba del master (`<p:ph/>`): márgenes
# internos de 0.1 y 0.05 in, ancla arriba, Arial. La letra nunca encoge
# (`noAutofit`): «si no cabe, la lámina se parte y la letra no encoge».

.EMU <- 914400

#' Lienzo vacío de piezas nativas
#' @keywords internal
.lam_lienzo <- function() {
  lz <- new.env(parent = emptyenv())
  lz$formas <- list()
  lz$cajas <- list()   # bounding boxes en pulgadas: c(l, t, r, b)
  lz
}

.lam_xml_esc <- function(s) {
  s <- gsub("&", "&amp;", s, fixed = TRUE); s <- gsub("<", "&lt;", s, fixed = TRUE)
  gsub(">", "&gt;", s, fixed = TRUE)
}
.lam_hex <- function(col) toupper(sub("^#", "", substr(col, 1, 7)))
.lam_xfrm <- function(l, t, w, h) {
  sprintf('<a:xfrm><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/></a:xfrm>',
          l * .EMU, t * .EMU, max(0, w) * .EMU, max(0, h) * .EMU)
}
.lam_registrar <- function(lz, xml, l, t, w, h) {
  lz$formas[[length(lz$formas) + 1L]] <- xml
  lz$cajas[[length(lz$cajas) + 1L]] <- c(l, t, l + max(0, w), t + max(0, h))
  invisible(lz)
}

#' Rectángulo de relleno sólido (`caja()` del recetario)
#' @keywords internal
.lam_caja <- function(lz, l, t, w, h, fill, nombre = "caja") {
  hex <- .lam_hex(fill)
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, w, h), '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '<a:solidFill><a:srgbClr val="', hex, '"/></a:solidFill>',
    '<a:ln w="3175"><a:solidFill><a:srgbClr val="', hex, '"/></a:solidFill></a:ln></p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>'
  )
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Cuadro de texto de un párrafo (`txt()` del recetario)
#' @keywords internal
.lam_txt <- function(lz, s, l, t, w, h, size = 12, color = .std_color("azul"), bold = FALSE,
                     align = c("left", "center", "right"), nombre = "texto") {
  align <- match.arg(align)
  algn <- c(left = "l", center = "ctr", right = "r")[[align]]
  fuente <- .std_pt("fuente")
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, w, h), '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>',
    '<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="t" anchorCtr="0">',
    '<a:noAutofit/></a:bodyPr><a:lstStyle/>',
    '<a:p><a:pPr algn="', algn, '" marL="0" marR="0" indent="0"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc>',
    '<a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>',
    '<a:r><a:rPr lang="es-PE" sz="', round(size * 100), '" b="', if (isTRUE(bold)) 1 else 0, '" i="0" dirty="0">',
    '<a:solidFill><a:srgbClr val="', .lam_hex(color), '"/></a:solidFill>',
    '<a:latin typeface="', fuente, '"/><a:ea typeface="', fuente, '"/><a:cs typeface="', fuente, '"/></a:rPr>',
    '<a:t>', .lam_xml_esc(s), '</a:t></a:r></a:p></p:txBody></p:sp>'
  )
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Inserta el lienzo en la lámina como un grupo
#'
#' El grupo mide lo que su contenido (transformación identidad: `chOff`/`chExt`
#' iguales a `off`/`ext`, que es lo que escribe officer) y cada forma recibe un
#' `cNvPr id` único en la lámina.
#' @keywords internal
.lam_agrupar <- function(doc, lz, nombre = "prosecnur:grafico") {
  if (!length(lz$formas)) return(doc)
  bb <- do.call(rbind, lz$cajas)
  l <- min(bb[, 1]); t <- min(bb[, 2]); r <- max(bb[, 3]); b <- max(bb[, 4])
  slide <- doc$slide$get_slide(doc$cursor)$get()
  ids <- suppressWarnings(as.integer(xml2::xml_attr(xml2::xml_find_all(slide, "//p:cNvPr"), "id")))
  siguiente <- max(c(1L, ids), na.rm = TRUE) + 1L
  formas <- vapply(seq_along(lz$formas), function(k) {
    sub('<p:cNvPr id="0"', sprintf('<p:cNvPr id="%d"', siguiente + k), lz$formas[[k]], fixed = TRUE)
  }, character(1))
  xml <- paste0(
    '<p:grpSp xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '<p:nvGrpSpPr><p:cNvPr id="', siguiente, '" name="', .lam_xml_esc(nombre), '"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    paste(formas, collapse = ""), '</p:grpSp>'
  )
  officer::ph_with(doc, value = xml2::read_xml(xml),
                   location = officer::ph_location(left = l, top = t, width = r - l, height = b - t, newlabel = nombre))
}

# ---- medición de texto (recetario.R:41-48, 142) ------------------------------

#' Ancho de tinta en pulgadas (systemfonts, Arial)
#' @keywords internal
.lam_ancho_tinta <- function(s, size, bold = FALSE) {
  systemfonts::string_width(s, family = .std_pt("fuente"), size = size, res = 72, bold = bold) / 72
}
.lam_ancho_txt <- function(s, size, bold = FALSE) nchar(s) * size * (if (bold) 0.56 else 0.52) / 72
.lam_lineas <- function(s, w, size, bold = FALSE) max(1, ceiling(.lam_ancho_txt(s, size, bold) / (w - 0.2)))
.lam_alto_txt <- function(s, w, size, bold = FALSE) .lam_lineas(s, w, size, bold) * size * 1.2 / 72 + 0.1

.lam_lum <- function(hex) {
  v <- grDevices::col2rgb(hex)[, 1] / 255
  v <- ifelse(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055)^2.4)
  sum(c(0.2126, 0.7152, 0.0722) * v)
}
#' Color de texto con más contraste sobre un relleno (recetario.R:45)
#' @keywords internal
.lam_texto_sobre <- function(hex) {
  l <- .lam_lum(hex); azul <- .std_color("azul")
  if (1.05 / (l + .05) >= (l + .05) / (.lam_lum(azul) + .05)) "#FFFFFF" else azul
}
