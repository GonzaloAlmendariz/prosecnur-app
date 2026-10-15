# Conformidad OOXML de los .docx que escribe la app.
#
# officer 0.7.1 y flextable escriben, incluso en un documento mínimo, XML que el
# esquema de Word no admite, y Word puede ofrecer "reparar" el archivo al abrirlo:
#   - texto suelto dentro de <w:tr> (los identificadores de fila "body1",
#     "header1" de flextable) y dentro de <w:footerReference>;
#   - el atributo w:officer en header/footerReference y w:dirty en instrText;
#   - hijos de pPr, pBdr, tblPr, tcBorders, tblBorders, tblCellMar, tcMar,
#     sectPr y settings fuera del orden del esquema;
#   - word/comments.xml y word/footnotes.xml sin relación que los use.
# .docx_conformar() corrige el paquete en el lugar, sin cambiar lo que se ve.
# Se llama después de escribir el archivo, en cada motor Word.

.DOCX_ORDEN <- list(
  pPr = c("pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs",
          "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
          "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment",
          "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"),
  pBdr = c("top", "left", "bottom", "right", "between", "bar"),
  tblPr = c("tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd",
            "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription"),
  tcBorders = c("top", "start", "left", "bottom", "end", "right", "insideH", "insideV", "tl2br", "tr2bl"),
  tblBorders = c("top", "start", "left", "bottom", "end", "right", "insideH", "insideV"),
  tblCellMar = c("top", "start", "left", "bottom", "end", "right"),
  tcMar = c("top", "start", "left", "bottom", "end", "right"),
  sectPr = c("headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType",
             "pgNumType", "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings",
             "sectPrChange"),
  settings = c("writeProtection", "view", "zoom", "removePersonalInformation", "removeDateAndTime", "doNotDisplayPageBoundaries",
               "displayBackgroundShape", "printPostScriptOverText", "printFractionalCharacterWidth", "printFormsData", "embedTrueTypeFonts",
               "embedSystemFonts", "saveSubsetFonts", "saveFormsData", "mirrorMargins", "alignBordersAndEdges", "bordersDoNotSurroundHeader",
               "bordersDoNotSurroundFooter", "gutterAtTop", "hideSpellingErrors", "hideGrammaticalErrors", "activeWritingStyle", "proofState",
               "formsDesign", "attachedTemplate", "linkStyles", "stylePaneFormatFilter", "stylePaneSortMethod", "documentType", "mailMerge",
               "revisionView", "trackRevisions", "doNotTrackMoves", "doNotTrackFormatting", "documentProtection", "autoFormatOverride",
               "styleLockTheme", "styleLockQFSet", "defaultTabStop", "autoHyphenation", "consecutiveHyphenLimit", "hyphenationZone",
               "doNotHyphenateCaps", "showEnvelope", "summaryLength", "clickAndTypeStyle", "defaultTableStyle", "evenAndOddHeaders",
               "bookFoldRevPrinting", "bookFoldPrinting", "bookFoldPrintingSheets", "drawingGridHorizontalSpacing", "drawingGridVerticalSpacing",
               "displayHorizontalDrawingGridEvery", "displayVerticalDrawingGridEvery", "doNotUseMarginsForDrawingGridOrigin",
               "drawingGridHorizontalOrigin", "drawingGridVerticalOrigin", "doNotShadeFormData", "noPunctuationKerning", "characterSpacingControl",
               "printTwoOnOne", "strictFirstAndLastChars", "noLineBreaksAfter", "noLineBreaksBefore", "savePreviewPicture",
               "doNotValidateAgainstSchema", "saveInvalidXml", "ignoreMixedContent", "alwaysShowPlaceholderText", "doNotDemarcateInvalidXml",
               "saveXmlDataOnly", "useXSLTWhenSaving", "saveThroughXslt", "showXMLTags", "alwaysMergeEmptyNamespace", "updateFields",
               "hdrShapeDefaults", "footnotePr", "endnotePr", "compat", "docVars", "rsids", "mathPr", "attachedSchema", "themeFontLang",
               "clrSchemeMapping", "doNotIncludeSubdocsInStats", "doNotAutoCompressPictures", "forceUpgrade", "captions", "readModeInkLockDown",
               "smartTagType", "schemaLibrary", "shapeDefaults", "doNotEmbedSmartTags", "decimalSymbol", "listSeparator")
)

# Reordena los hijos de un nodo según el esquema. xml_add_child copia, así que
# se agregan las copias en orden y después se retiran los originales.
.docx_ordenar_hijos <- function(nodo, orden) {
  hijos <- xml2::xml_children(nodo)
  if (length(hijos) < 2L) return(invisible(nodo))
  pos <- match(xml2::xml_name(hijos), orden)
  pos[is.na(pos)] <- length(orden) + 1L
  if (!is.unsorted(pos)) return(invisible(nodo))
  for (i in order(pos)) xml2::xml_add_child(nodo, hijos[[i]])
  for (h in hijos) xml2::xml_remove(h)
  invisible(nodo)
}

#' Diagramado de revista del informe (N8.2, lo que hacía `herramientas/word_nativo.py:49-83`)
#'
#' En styles.xml: idioma es-PE (la ortografía de Word), control de viudas y huérfanas, y sangría francesa de 567 twips
#' en «Referencia» (officer deja firstLine = 0, que anula la colgante). En settings.xml: `updateFields`, para que Word
#' llene los índices y los rótulos SEQ al abrir, y sin separación silábica automática (en un Word sin el componente de
#' español mostraba «Word hyphenation feature is not available»; Gonzalo, 2026-10-08).
#' @keywords internal
.docx_revista <- function(doc, parte, ns) {
  w <- function(nodo, nombre) { h <- xml2::xml_find_first(nodo, paste0("w:", nombre), ns); if (inherits(h, "xml_missing")) xml2::xml_add_child(nodo, paste0("w:", nombre)) else h }
  if (identical(parte, "styles.xml")) {
    dd <- xml2::xml_find_first(doc, "/w:styles/w:docDefaults", ns)
    if (!inherits(dd, "xml_missing")) {
      rpr <- w(w(dd, "rPrDefault"), "rPr"); xml2::xml_set_attr(w(rpr, "lang"), "w:val", "es-PE", ns)
      w(w(w(dd, "pPrDefault"), "pPr"), "widowControl")
    }
    for (st in xml2::xml_find_all(doc, "//w:style[w:name[@w:val='Referencia']]", ns)) {
      ind <- w(w(st, "pPr"), "ind")
      for (k in c("w:firstLine", "w:start", "w:end")) xml2::xml_set_attr(ind, k, NULL, ns)
      xml2::xml_set_attr(ind, "w:left", "567", ns); xml2::xml_set_attr(ind, "w:hanging", "567", ns)
    }
  }
  if (identical(parte, "settings.xml")) {
    raiz <- xml2::xml_find_first(doc, "/w:settings", ns)
    xml2::xml_set_attr(w(raiz, "updateFields"), "w:val", "true", ns)
    xml2::xml_remove(xml2::xml_find_all(doc, "/w:settings/w:autoHyphenation", ns))
  }
  invisible(doc)
}

.docx_conformar_parte <- function(path_xml, revista = FALSE) {
  doc <- xml2::read_xml(path_xml)
  ns <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  if (isTRUE(revista)) .docx_revista(doc, basename(path_xml), ns)
  for (tag in names(.DOCX_ORDEN)) {
    nodos <- if (identical(tag, "settings")) xml2::xml_find_all(doc, "/w:settings", ns) else xml2::xml_find_all(doc, sprintf("//w:%s", tag), ns)
    for (n in nodos) .docx_ordenar_hijos(n, .DOCX_ORDEN[[tag]])
  }
  xml2::xml_remove(xml2::xml_find_all(doc, "//w:tr/text()[normalize-space(.) != ''] | //w:footerReference/text() | //w:headerReference/text()", ns))
  for (ref in xml2::xml_find_all(doc, "//w:footerReference[@w:officer] | //w:headerReference[@w:officer]", ns)) xml2::xml_set_attr(ref, "w:officer", NULL, ns)
  for (it in xml2::xml_find_all(doc, "//w:instrText[@w:dirty]", ns)) xml2::xml_set_attr(it, "w:dirty", NULL, ns)
  xml2::write_xml(doc, path_xml, options = "as_xml")   # sin "format": no se agrega espacio entre elementos
  # Los nodos copiados al reordenar traen de nuevo la declaración de su espacio de nombres
  # (<w:keepNext xmlns:w="…"/>). La raíz ya la declara: se retira de los nodos interiores.
  txt <- paste(readLines(path_xml, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  pos_raiz <- regexpr("<[A-Za-z][^>]*>", txt)   # la primera etiqueta de elemento (la declaración <?xml no casa)
  if (pos_raiz > 0) {
    raiz <- regmatches(txt, pos_raiz)
    decl <- regmatches(raiz, gregexpr('xmlns:[A-Za-z0-9]+="[^"]*"', raiz))[[1]]
    corte <- pos_raiz + attr(pos_raiz, "match.length")
    # `last` EXPLICITO: el default de substring() es 1000000L, y un document.xml
    # de mas de 1M caracteres salia truncado e ilegible (formularios de ~100
    # filas ya lo pasan; medido 2026-10-15: 802 KB -> 577 KB, Word/LibreOffice
    # no lo abrian).
    resto <- substring(txt, corte, nchar(txt))
    for (d in decl) resto <- gsub(paste0(" ", d), "", resto, fixed = TRUE)
    writeLines(paste0(substring(txt, 1, corte - 1), resto), path_xml, useBytes = TRUE)
  }
  invisible(path_xml)
}

# `revista = TRUE` suma el diagramado del informe del recetario (`.docx_revista`): sólo el informe, no los formularios
# ni las fichas, que no llevan campos que actualizar.
.docx_conformar <- function(path_docx, revista = FALSE) {
  if (!length(path_docx) || !nzchar(path_docx) || !file.exists(path_docx)) return(invisible(path_docx))
  tmp <- tempfile("docx_conformar_")
  dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  utils::unzip(path_docx, exdir = tmp)
  partes <- list.files(file.path(tmp, "word"), pattern = "^(document|styles|settings|header[0-9]*|footer[0-9]*)\\.xml$", full.names = TRUE)
  for (p in partes) .docx_conformar_parte(p, revista = revista)
  # Partes de la plantilla de officer que ninguna relación usa: se retiran con su Override.
  rels_path <- file.path(tmp, "word", "_rels", "document.xml.rels")
  rels <- if (file.exists(rels_path)) paste(readLines(rels_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n") else ""
  ct_path <- file.path(tmp, "[Content_Types].xml")
  for (huerfana in c("comments.xml", "footnotes.xml")) {
    f <- file.path(tmp, "word", huerfana)
    if (file.exists(f) && !grepl(huerfana, rels, fixed = TRUE)) {
      unlink(f)
      ct <- paste(readLines(ct_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
      ct <- gsub(sprintf('<Override[^>]*PartName="/word/%s"[^>]*/>', gsub(".", "\\.", huerfana, fixed = TRUE)), "", ct)
      writeLines(ct, ct_path, useBytes = TRUE)
    }
  }
  archivos <- list.files(tmp, recursive = TRUE, all.files = TRUE, no.. = TRUE)
  archivos <- c("[Content_Types].xml", setdiff(archivos, "[Content_Types].xml"))   # el tipo de contenido va primero en el zip
  # Se escribe a un temporal y sólo si el zip sale bien reemplaza al original: un fallo no deja al usuario sin su docx.
  destino <- normalizePath(path_docx, mustWork = TRUE)
  nuevo <- tempfile("docx_conformado_", tmpdir = dirname(destino), fileext = ".docx")
  ok <- tryCatch({ zip::zipr(zipfile = nuevo, files = archivos, root = tmp, mode = "mirror"); file.exists(nuevo) }, error = function(e) FALSE)
  if (!isTRUE(ok)) { unlink(nuevo); return(invisible(path_docx)) }
  if (!file.rename(nuevo, destino)) { file.copy(nuevo, destino, overwrite = TRUE); unlink(nuevo) }
  invisible(path_docx)
}
