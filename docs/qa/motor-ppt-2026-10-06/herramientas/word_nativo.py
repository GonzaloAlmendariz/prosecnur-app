# Posproceso de la propuesta en Word. Uso: python3 word_nativo.py archivo.docx
# 1. Da separación (w:space, en puntos) al filete izquierdo del estilo «Lectura»: officer escribe w:space="0".
# 2. Pide a Word actualizar los campos al abrir, para que el índice y los índices de gráficos y tablas aparezcan llenos.
# 3. Deja el XML conforme al esquema de Word (validate.py del skill docx), porque officer 0.7.1 y flextable escriben:
#    - texto suelto dentro de <w:tr> (los identificadores de fila «body1», «header1») y dentro de <w:footerReference>;
#    - hijos de <w:pPr>, <w:pBdr>, <w:tblPr> y <w:settings> fuera de orden;
#    - el atributo w:dirty en <w:instrText>, donde el esquema no lo admite.
#    Ver también el punto 4, más abajo.
import sys, zipfile, shutil, re, tempfile
from lxml import etree
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ORDEN = {
  "pPr": ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs",
          "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
          "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment",
          "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"],
  "pBdr": ["top", "left", "bottom", "right", "between", "bar"],
  "tcBorders": ["top", "start", "left", "bottom", "end", "right", "insideH", "insideV", "tl2br", "tr2bl"],
  "tblBorders": ["top", "start", "left", "bottom", "end", "right", "insideH", "insideV"],
  "tblCellMar": ["top", "start", "left", "bottom", "end", "right"],
  "tcMar": ["top", "start", "left", "bottom", "end", "right"],
  "sectPr": ["headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType",
             "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings", "sectPrChange"],
  "tblPr": ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd",
            "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription"],
  "settings": ["writeProtection", "view", "zoom", "removePersonalInformation", "removeDateAndTime", "doNotDisplayPageBoundaries", "displayBackgroundShape",
               "printPostScriptOverText", "printFractionalCharacterWidth", "printFormsData", "embedTrueTypeFonts", "embedSystemFonts", "saveSubsetFonts",
               "saveFormsData", "mirrorMargins", "alignBordersAndEdges", "bordersDoNotSurroundHeader", "bordersDoNotSurroundFooter", "gutterAtTop",
               "hideSpellingErrors", "hideGrammaticalErrors", "activeWritingStyle", "proofState", "formsDesign", "attachedTemplate", "linkStyles",
               "stylePaneFormatFilter", "stylePaneSortMethod", "documentType", "mailMerge", "revisionView", "trackRevisions", "doNotTrackMoves",
               "doNotTrackFormatting", "documentProtection", "autoFormatOverride", "styleLockTheme", "styleLockQFSet", "defaultTabStop", "autoHyphenation",
               "consecutiveHyphenLimit", "hyphenationZone", "doNotHyphenateCaps", "showEnvelope", "summaryLength", "clickAndTypeStyle", "defaultTableStyle",
               "evenAndOddHeaders", "bookFoldRevPrinting", "bookFoldPrinting", "bookFoldPrintingSheets", "drawingGridHorizontalSpacing",
               "drawingGridVerticalSpacing", "displayHorizontalDrawingGridEvery", "displayVerticalDrawingGridEvery", "doNotUseMarginsForDrawingGridOrigin",
               "drawingGridHorizontalOrigin", "drawingGridVerticalOrigin", "doNotShadeFormData", "noPunctuationKerning", "characterSpacingControl",
               "printTwoOnOne", "strictFirstAndLastChars", "noLineBreaksAfter", "noLineBreaksBefore", "savePreviewPicture", "doNotValidateAgainstSchema",
               "saveInvalidXml", "ignoreMixedContent", "alwaysShowPlaceholderText", "doNotDemarcateInvalidXml", "saveXmlDataOnly", "useXSLTWhenSaving",
               "saveThroughXslt", "showXMLTags", "alwaysMergeEmptyNamespace", "updateFields", "hdrShapeDefaults", "footnotePr", "endnotePr", "compat",
               "docVars", "rsids", "mathPr", "attachedSchema", "themeFontLang", "clrSchemeMapping", "doNotIncludeSubdocsInStats",
               "doNotAutoCompressPictures", "forceUpgrade", "captions", "readModeInkLockDown", "smartTagType", "schemaLibrary", "shapeDefaults",
               "doNotEmbedSmartTags", "decimalSymbol", "listSeparator"]}

def ordenar(nodo, orden):
    hijos = list(nodo)
    hijos.sort(key=lambda e: orden.index(etree.QName(e).localname) if isinstance(e.tag, str) and etree.QName(e).localname in orden else len(orden))
    for e in hijos: nodo.remove(e)
    for e in hijos: nodo.append(e)

def revista(raiz):
    """Diagramado de revista en styles.xml: idioma español (ortografía), control de viudas y huérfanas,
    y sangría francesa en el estilo «Referencia»."""
    dd = raiz.find(W + "docDefaults")
    if dd is not None:
        rpr = dd.find(W + "rPrDefault/" + W + "rPr")
        if rpr is not None:
            lang = rpr.find(W + "lang")
            if lang is None: lang = etree.SubElement(rpr, W + "lang")
            lang.set(W + "val", "es-PE")
        ppr = dd.find(W + "pPrDefault/" + W + "pPr")
        if ppr is None:
            pd = dd.find(W + "pPrDefault")
            if pd is None: pd = etree.SubElement(dd, W + "pPrDefault")
            ppr = etree.SubElement(pd, W + "pPr")
        if ppr.find(W + "widowControl") is None: etree.SubElement(ppr, W + "widowControl")
    for st in raiz.findall(W + "style"):
        if st.get(W + "styleId") == "Referencia":
            ppr = st.find(W + "pPr")
            if ppr is None: ppr = etree.SubElement(st, W + "pPr")
            ind = ppr.find(W + "ind")
            if ind is None: ind = etree.SubElement(ppr, W + "ind")
            for k in ("firstLine", "start", "end"):   # officer deja firstLine="0", que anula la sangría colgante
                if W + k in ind.attrib: del ind.attrib[W + k]
            ind.set(W + "left", "567"); ind.set(W + "hanging", "567")

def conformar(xml, es_settings=False, es_estilos=False):
    raiz = etree.fromstring(xml)
    if es_estilos: revista(raiz)
    if es_settings:
        if raiz.find(W + "updateFields") is None:
            u = etree.SubElement(raiz, W + "updateFields"); u.set(W + "val", "true")
        # Sin separación silábica automática: en un Word sin el componente de español, abrir el archivo mostraba
        # «Word hyphenation feature is not available» (Gonzalo, 2026-10-08). El texto sigue justificado.
        for h in raiz.findall(W + "autoHyphenation"): raiz.remove(h)
        ordenar(raiz, ORDEN["settings"])
    for tag in ("pPr", "pBdr", "tblPr", "tcBorders", "tblBorders", "tblCellMar", "tcMar", "sectPr"):
        for n in raiz.iter(W + tag): ordenar(n, ORDEN[tag])
    for tr in raiz.iter(W + "tr"):            # texto suelto entre las celdas de una fila
        tr.text = None
        for h in tr: h.tail = None
    for ref in list(raiz.iter(W + "footerReference")) + list(raiz.iter(W + "headerReference")):
        ref.text = None
        for h in list(ref): ref.remove(h)
        if W + "officer" in ref.attrib: del ref.attrib[W + "officer"]   # marca interna de officer, fuera del esquema
    for it in raiz.iter(W + "instrText"):
        if W + "dirty" in it.attrib: del it.attrib[W + "dirty"]
    return etree.tostring(raiz, xml_declaration=True, encoding="UTF-8", standalone=True)

src = sys.argv[1]; tmp = tempfile.mktemp(suffix=".docx")
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
# 4. La plantilla de officer trae comments.xml y footnotes.xml sin relación que los use: se retiran con su Override.
rels = zin.read("word/_rels/document.xml.rels").decode()
huerfanos = [n for n in ("word/comments.xml", "word/footnotes.xml") if n in zin.namelist() and n.split("/")[-1] not in rels]
for it in zin.infolist():
    if it.filename in huerfanos: continue
    d = zin.read(it.filename)
    if it.filename == "[Content_Types].xml":
        for n in huerfanos: d = re.sub(rb'<Override[^>]*PartName="/' + n.encode() + rb'"[^>]*/>', b"", d)
    if it.filename == "word/styles.xml":
        x = d.decode()
        def fix(m): return re.sub(r'(<w:left w:val="single"[^>]*w:space=")0(")', r'\g<1>9\2', m.group(0))
        d = re.sub(r'<w:style [^>]*w:styleId="Lectura".*?</w:style>', fix, x, flags=re.S).encode()
    if re.match(r"word/(document|styles|settings|header\d*|footer\d*)\.xml$", it.filename):
        d = conformar(d, es_settings=it.filename == "word/settings.xml", es_estilos=it.filename == "word/styles.xml")
    zout.writestr(it, d)
zout.close(); zin.close(); shutil.move(tmp, src)
