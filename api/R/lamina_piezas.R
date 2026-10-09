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

#' Línea recta de un punto a otro (la pendiente de la serie de dos mediciones, recetario_m3c.R:61)
#'
#' Una forma `line` con su caja de (x1, y1) a (x2, y2): si sube hacia la derecha se voltea en vertical.
#' @keywords internal
.lam_linea <- function(lz, x1, y1, x2, y2, col, pt = 3, nombre = "linea") {
  l <- min(x1, x2); t <- min(y1, y2); w <- abs(x2 - x1); h <- abs(y2 - y1)
  flip <- (x2 - x1) * (y2 - y1) < 0
  xfrm <- sprintf('<a:xfrm%s><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/></a:xfrm>', if (flip) ' flipV="1"' else '',
                  l * .EMU, t * .EMU, w * .EMU, h * .EMU)
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', xfrm, '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>',
    '<a:ln w="', as.integer(round(pt * 12700)), '" cap="rnd"><a:solidFill><a:srgbClr val="', .lam_hex(col), '"/></a:solidFill></a:ln></p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>'
  )
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Rectángulo de relleno sólido (`caja()` del recetario)
#' @keywords internal
.lam_caja <- function(lz, l, t, w, h, fill, nombre = "caja", geom = c("rect", "triangle", "ellipse"), borde = NULL, borde_pt = 0.75) {
  geom <- match.arg(geom)
  hex <- .lam_hex(fill); hex_borde <- .lam_hex(borde %||% fill); w_borde <- if (is.null(borde)) 3175L else as.integer(round(borde_pt * 12700))
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, w, h), '<a:prstGeom prst="', geom, '"><a:avLst/></a:prstGeom>',
    '<a:solidFill><a:srgbClr val="', hex, '"/></a:solidFill>',
    '<a:ln w="', w_borde, '"><a:solidFill><a:srgbClr val="', hex_borde, '"/></a:solidFill></a:ln></p:spPr>',
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

#' Cuadro de texto de un párrafo con tramos en negrita (`txt_runs()` del recetario)
#'
#' @param tramos Lista de pares `list(texto, negrita)`.
#' @keywords internal
.lam_txt_tramos <- function(lz, tramos, l, t, w, h, size = 12, color = .std_color("azul"), nombre = "texto") {
  fuente <- .std_pt("fuente")
  rpr <- function(negrita) paste0(
    '<a:rPr lang="es-PE" sz="', round(size * 100), '" b="', if (isTRUE(negrita)) 1 else 0, '" i="0" dirty="0">',
    '<a:solidFill><a:srgbClr val="', .lam_hex(color), '"/></a:solidFill>',
    '<a:latin typeface="', fuente, '"/><a:ea typeface="', fuente, '"/><a:cs typeface="', fuente, '"/></a:rPr>')
  # Un salto de línea dentro de un tramo es un salto de verdad (<a:br>), con el formato de su tramo; el formato se arma
  # directo y no se recorta con un regex (que no cruzaba el «\n» y anidaba un run dentro de otro: verificador de N7).
  runs <- vapply(tramos, function(tr) {
    texto <- as.character(tr[[1]]); negrita <- isTRUE(tr[[2]])
    partes <- strsplit(texto, "\n", fixed = TRUE)[[1]]
    if (!length(partes)) partes <- ""
    if (endsWith(texto, "\n")) partes <- c(partes, "")                       # «Uno.\n» guarda su salto
    pedazos <- vapply(partes, function(x) if (!nzchar(x)) "" else paste0("<a:r>", rpr(negrita), "<a:t>", .lam_xml_esc(x), "</a:t></a:r>"), "", USE.NAMES = FALSE)
    paste(pedazos, collapse = paste0("<a:br>", rpr(negrita), "</a:br>"))
  }, "")
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
#' Líneas que compone un cuadro de texto: corte por palabras (greedy, como PowerPoint) sobre el ancho útil `w - 0.2`
#'
#' `.lam_alto_tinta` divide el ancho total de la tinta por el de la caja y no ve lo que se pierde al final de cada
#' línea: en la frontera daba tres líneas donde se componían cuatro (verificador de N7, ronda 11).
#' @keywords internal
.lam_lineas_tinta <- function(s, w, size, bold = FALSE) {
  util <- w - 0.2 - 0.02
  vapply(s, function(x) {
    total <- 0L
    for (parrafo in strsplit(as.character(x), "\n", fixed = FALSE)[[1]]) {
      pal <- strsplit(trimws(parrafo), "\\s+")[[1]]; pal <- pal[nzchar(pal)]
      if (!length(pal)) { total <- total + 1L; next }
      a <- .lam_ancho_tinta(pal, size, bold); esp <- .lam_ancho_tinta(" ", size, bold)
      n <- 1L; cur <- a[1]
      for (k in seq_along(pal)[-1]) if (cur + esp + a[k] <= util) cur <- cur + esp + a[k] else { n <- n + 1L; cur <- a[k] }
      total <- total + n
    }
    max(1L, total)
  }, 0L, USE.NAMES = FALSE)
}

#' Alto de un texto con las líneas contadas sobre el ancho real de su tinta (systemfonts), no por carácter
#' @keywords internal
.lam_alto_tinta <- function(s, w, size, bold = FALSE) {
  # Líneas cortadas por palabras (`.lam_lineas_tinta`): dividir el ancho total no ve lo que se pierde al final de cada
  # línea y en la frontera daba una línea menos (verificador de N7, ronda 11).
  stats::setNames(.lam_lineas_tinta(s, w, size, bold) * size * 1.2 / 72 + 0.1, if (is.null(names(s))) s else names(s))
}

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

#' Tramos de una narrativa: lo escrito entre `**` va en negrita, como los tramos del recetario
#' @keywords internal
.lam_narrativa_tramos <- function(texto) {
  partes <- strsplit(as.character(texto)[1], "**", fixed = TRUE)[[1]]
  # Un `**` sin pareja queda literal: si no, la negrita se invertía desde ahí hasta el final (verificador de N7).
  n_sep <- lengths(regmatches(as.character(texto)[1], gregexpr("**", as.character(texto)[1], fixed = TRUE)))
  if (n_sep %% 2 == 1 && length(partes) >= 2) partes <- c(partes[seq_len(length(partes) - 2)], paste0(partes[length(partes) - 1], "**", partes[length(partes)]))
  tramos <- lapply(seq_along(partes), function(k) list(partes[k], k %% 2 == 0))
  Filter(function(tr) nzchar(tr[[1]]), tramos)
}

#' Alto de una narrativa a 15 pt en su ancho (mínimo 0.45 in, una línea del recetario)
#' @keywords internal
.lam_narrativa_alto <- function(texto, w, size = 15) {
  max(0.45, .lam_narrativa_lineas(texto, w, size) * size * 1.2 / 72 + 0.1)
}

#' Líneas de una narrativa: cada párrafo (salto de línea) se mide aparte con la tinta (verificador de N7)
#' @keywords internal
.lam_narrativa_lineas <- function(texto, w, size = 15) {
  parrafos <- strsplit(gsub("**", "", as.character(texto)[1], fixed = TRUE), "\n")[[1]]
  if (!length(parrafos)) return(1L)
  sum(vapply(parrafos, function(p) max(1, ceiling(.lam_ancho_tinta(p, size, TRUE) / (w - 0.22 - 0.1))), 0))
}

#' Narrativa del recetario: filete coral y párrafo con tramos en negrita (`narrativa()`, recetario_piezas.R:30)
#' @keywords internal
.lam_narrativa <- function(lz, texto, x, y, w, h, size = 15) {
  .lam_caja(lz, x, y + 0.05, 0.05, h - 0.1, .std_color("coral"), nombre = "narrativa:filete")
  .lam_txt_tramos(lz, .lam_narrativa_tramos(texto), x + 0.22, y, w - 0.22, h, size = size, nombre = "narrativa:texto")
  invisible(lz)
}

#' Contorno sin relleno (el `contorno()` del recetario, que marca una celda)
#' @keywords internal
.lam_contorno <- function(lz, l, t, w, h, color, pt = 1.25, nombre = "contorno") {
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', .lam_xfrm(l, t, w, h), '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>',
    '<a:ln w="', as.integer(round(pt * 12700)), '"><a:solidFill><a:srgbClr val="', .lam_hex(color), '"/></a:solidFill></a:ln></p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, w, h)
}
