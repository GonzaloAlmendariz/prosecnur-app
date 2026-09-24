# =============================================================================
# Verificador OOXML de un `.docx` — helper compartido
# =============================================================================
#
# Por que existe (item 10 del checklist
# `docs/qa/checklist-motor-formulario-papel-2026-09-24.md`): el motor de
# formulario en papel escribe OOXML a mano a traves de officer/flextable, y los
# accidentes que ha tenido NO son "el archivo no se genero" sino "el archivo se
# genero y Word lo abre roto". Dos ya ocurrieron: un bloque de consentimiento en
# caja de texto que Word no pintaba (LibreOffice si, asi que todo chequeo por
# PDF lo daba por bueno) y un elemento fuera de la secuencia del esquema que
# provoco «contenido ilegible».
#
# Se recorre con `xml2`, como ATRIBUTOS y NODOS, nunca con `grepl` sobre el
# texto del XML. La leccion esta pagada dos veces en este repo:
#   - `helper-formato-xlsx.R`: limpiar un color con `[^0-9A-Fa-f]` dejaba la `b`
#     de `rgb=` pegada delante, porque la `b` es un digito hexadecimal valido.
#   - `.ooxml_patron_bloque()` (`api/R/reporte_ppt_saneo_ooxml.R:40`): un
#     `<a:rPr/>` autocerrado hacia que la captura se comiera hasta el cierre del
#     bloque SIGUIENTE — 68 falsos positivos sobre un entregable que tiene cero.
#   En OOXML todo elemento puede venir autocerrado y todo prefijo puede
#   confundirse con texto: se lee el arbol, no la cadena.
#
# --- DE DONDE SALEN LAS SECUENCIAS DEL ESQUEMA ---
#
# ECMA-376 Part 1 (5th ed.), WordprocessingML, `wml.xsd`. El orden de hijos de
# un `xsd:sequence` es NORMATIVO: un documento con los mismos elementos en otro
# orden esta bien formado (ningun validador XML generico lo detecta) pero NO es
# conforme, y Word es estricto donde LibreOffice es permisivo. Las secuencias
# transcritas abajo son, tipo a tipo:
#   CT_PPrBase   §17.3.1.26 (`w:pPr`),  mas rPr/sectPr/pPrChange de CT_PPr
#   CT_RPrBase   §17.3.2.28 (`w:rPr`),  mas ins/del/moveFrom/moveTo de CT_ParaRPr
#   CT_TrPrBase  §17.4.82   (`w:trPr`)
#   CT_TcPrBase  §17.4.70   (`w:tcPr`)
#   CT_TblPrBase §17.4.60   (`w:tblPr`)
#   CT_SectPr    §17.6.17   (`w:sectPr`), con EG_HdrFtrReferences al frente
# No estaban en el repo: se traen aqui y se dejan documentadas para que el
# proximo que las toque sepa que no son criterio de nadie.
#
# --- DEFECTO CONOCIDO AGUAS ARRIBA (officer 0.7.1 / flextable 0.9.10) ---
#
# Las librerias emiten varios de estos hijos fuera de secuencia en TODO
# documento que generan; el motor no los controla (no elige el orden: llama a
# `fp_text()`, `fp_par()`, `prop_section()`). El caso mas visible es `sectPr`:
# officer escribe `headerReference footerReference pgMar pgSz type cols` donde
# el esquema pide `headerReference footerReference type pgSz pgMar cols`.
# Ya se intento corregirlo en el motor y ROMPE el render de officer (ver el
# comentario largo en `api/R/reporte_formulario_word.R`).
#
# Por eso el verificador SEPARA las dos cosas y no da verde por no mirar:
#   - `desorden`  : inventario literal de TODA inversion encontrada, que el
#                   llamador puede afirmar entera (`expect_setequal`).
#   - la expectativa que falla es solo sobre lo que NO esta en
#     `known_disorder`, es decir, sobre un desorden NUEVO — que si seria del
#     motor. Un desorden conocido que DESAPARECE tampoco pasa inadvertido: el
#     llamador afirma el inventario completo, asi que el dia que officer lo
#     arregle el test avisa de que la lista de excepciones quedo rancia.

# Secuencias normativas. `_` al final = elementos que el tipo admite despues de
# la secuencia base (extensiones del CT concreto).
.OOXML_ORDEN_HIJOS <- list(
  "w:pPr" = c(
    "pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl",
    "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens",
    "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE",
    "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind",
    "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
    "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle",
    "rPr", "sectPr", "pPrChange"
  ),
  "w:rPr" = c(
    "ins", "del", "moveFrom", "moveTo",
    "rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike",
    "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid",
    "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz",
    "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign",
    "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath",
    "rPrChange"
  ),
  "w:trPr" = c(
    "cnfStyle", "divId", "gridBefore", "gridAfter", "wBefore", "wAfter",
    "cantSplit", "trHeight", "tblHeader", "tblCellSpacing", "jc", "hidden",
    "ins", "del", "trPrChange"
  ),
  "w:tcPr" = c(
    "cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders", "shd",
    "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark",
    "headers", "cellIns", "cellDel", "cellMerge", "tcPrChange"
  ),
  "w:tblPr" = c(
    "tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize",
    "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders",
    "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription",
    "tblPrChange"
  ),
  "w:sectPr" = c(
    "headerReference", "footerReference", "footnotePr", "endnotePr", "type",
    "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols",
    "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi",
    "rtlGutter", "docGrid", "printerSettings", "sectPrChange"
  )
)

# Inventario LITERAL del desorden que emiten officer 0.7.1 y flextable 0.9.10.
# Medido el 2026-09-24 sobre un `.docx` generado por `reporte_formulario_word()`.
# No se puede corregir desde el motor (ver cabecera). Cada entrada es
# "<elemento>: <hijo> antes de <hijo>" tal y como la formatea `.ooxml_desorden()`.
.OOXML_DESORDEN_OFFICER_071 <- c(
  # fp_par(): la justificacion sale antes de bordes/sombreado/espaciado/sangria.
  "w:pPr: jc antes de pBdr",
  "w:pPr: jc antes de keepNext",
  "w:pPr: ind antes de shd",
  # fp_text(): cursiva antes de negrita, subrayado antes de tamano, color al final.
  "w:rPr: i antes de b",
  "w:rPr: u antes de strike",
  "w:rPr: szCs antes de color",
  # flextable: la justificacion de la tabla sale despues del layout.
  "w:tblPr: tblLayout antes de jc",
  # prop_section(): margenes y tamano de pagina antes del tipo de seccion.
  "w:sectPr: pgMar antes de pgSz",
  "w:sectPr: pgSz antes de type"
)

# Partes del paquete que escribe el motor (document + mobiliario de cada
# seccion). `word/styles.xml` y el resto vienen de la plantilla de officer y no
# son responsabilidad de este motor.
.ooxml_partes_del_motor <- function(nombres) {
  grep("^word/(document|header[0-9]*|footer[0-9]*)\\.xml$", nombres, value = TRUE)
}

# Abre el `.docx` en un directorio temporal y devuelve sus partes ya parseadas.
.ooxml_abrir_docx <- function(path, parts = NULL) {
  d <- tempfile("docx_ooxml_")
  dir.create(d)
  # Se limpia al volver: xml2 deja los documentos en memoria (misma razon y mismo
  # patron que `.piezas_xlsx()` en helper-formato-xlsx.R).
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  todas <- gsub("\\\\", "/", list.files(d, recursive = TRUE))
  objetivo <- parts %||% .ooxml_partes_del_motor(todas)
  objetivo <- intersect(objetivo, todas)
  docs <- lapply(objetivo, function(p) xml2::read_xml(file.path(d, p)))
  names(docs) <- objetivo
  list(todas = todas, docs = docs)
}

# Inversiones de secuencia de UN documento. Devuelve cadenas
# "<elemento>: <hijo> antes de <hijo>", una por par adyacente invertido.
#
# Se comparan pares ADYACENTES y con `>` estricto: los elementos repetibles
# (varios `headerReference`) comparten indice y no cuentan como inversion. Un
# hijo que no esta en la secuencia (extension de otro namespace, `mc:`, `w14:`)
# se ignora: no se puede afirmar su posicion contra un esquema que no lo declara.
.ooxml_desorden <- function(doc) {
  ns <- xml2::xml_ns(doc)
  out <- character(0)
  for (tag in names(.OOXML_ORDEN_HIJOS)) {
    seq_esperada <- .OOXML_ORDEN_HIJOS[[tag]]
    nodos <- xml2::xml_find_all(doc, paste0("//", tag), ns)
    for (n in nodos) {
      hijos <- xml2::xml_name(xml2::xml_children(n))
      idx <- match(hijos, seq_esperada)
      keep <- !is.na(idx)
      hijos <- hijos[keep]
      idx <- idx[keep]
      if (length(idx) < 2L) next
      mal <- which(idx[-length(idx)] > idx[-1L])
      if (length(mal)) {
        out <- c(out, sprintf("%s: %s antes de %s", tag, hijos[mal], hijos[mal + 1L]))
      }
    }
  }
  unique(out)
}

#' Contrato OOXML de un `.docx` generado por el motor
#'
#' @param path ruta al `.docx`.
#' @param parts partes del zip a auditar; por defecto `word/document.xml` y el
#'   mobiliario (`header*.xml` / `footer*.xml`) que escribe el motor.
#' @param known_disorder inversiones de secuencia ya conocidas aguas arriba que
#'   el motor no controla. Se REPORTAN siempre en el valor de retorno; solo no
#'   hacen fallar la expectativa. Pasar `character(0)` para exigir conformidad
#'   total.
#' @param forbid_numPr item 6 del checklist medido sobre el artefacto: quien
#'   numera es el motor, con texto. Un solo `w:numPr` (lo deja, por ejemplo, un
#'   `body_add_par(style = "heading 1")`) hace que Word imprima ADEMAS su propia
#'   numeracion encima del prefijo: salieron "C. C. SOLEDAD" y "3. P6.".
#' @return invisible(list(desorden, desorden_nuevo, estilos, comentarios)).
expect_docx_ooxml_valid <- function(path, parts = NULL,
                                    known_disorder = .OOXML_DESORDEN_OFFICER_071,
                                    forbid_numPr = TRUE) {
  testthat::expect_true(file.exists(path), info = path)

  # 1) Integridad del zip. `zip_list()` lee el directorio central: si el paquete
  #    esta truncado o corrupto, falla aqui y no en un parseo confuso mas abajo.
  listado <- tryCatch(zip::zip_list(path), error = function(e) e)
  testthat::expect_false(
    inherits(listado, "error"),
    info = sprintf("zip corrupto (%s): %s", basename(path),
                   if (inherits(listado, "error")) conditionMessage(listado) else "")
  )
  if (inherits(listado, "error")) return(invisible(NULL))

  piezas <- .ooxml_abrir_docx(path, parts)
  testthat::expect_true(
    "[Content_Types].xml" %in% piezas$todas,
    info = "el .docx no declara [Content_Types].xml"
  )
  testthat::expect_true(
    "word/document.xml" %in% piezas$todas,
    info = "el .docx no trae word/document.xml"
  )
  testthat::expect_gt(length(piezas$docs), 0L)

  # 2) Orden de hijos conforme al esquema.
  desorden <- unique(unlist(lapply(piezas$docs, .ooxml_desorden), use.names = FALSE))
  desorden <- if (is.null(desorden)) character(0) else desorden
  nuevo <- setdiff(desorden, known_disorder)
  testthat::expect_identical(
    nuevo, character(0),
    info = sprintf(
      "hijos fuera de la secuencia del esquema en %s y no declarados como defecto aguas arriba:\n  %s",
      basename(path), paste(nuevo, collapse = "\n  ")
    )
  )

  # 3) Cero `w:rStyle` apuntando a un estilo inexistente. Los `styleId` se leen
  #    como ATRIBUTO de `w:style` en word/styles.xml, nunca buscando la cadena
  #    en el XML: un id puede aparecer como subcadena de otro.
  d <- tempfile("docx_styles_")
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, files = "word/styles.xml", exdir = d)
  estilos <- character(0)
  f_est <- file.path(d, "word", "styles.xml")
  if (file.exists(f_est)) {
    sx <- xml2::read_xml(f_est)
    nodos <- xml2::xml_find_all(sx, "//w:style", xml2::xml_ns(sx))
    estilos <- stats::na.omit(xml2::xml_attr(nodos, "styleId"))
  }
  usados <- unique(unlist(lapply(piezas$docs, function(doc) {
    ns <- xml2::xml_ns(doc)
    stats::na.omit(xml2::xml_attr(xml2::xml_find_all(doc, "//w:rStyle", ns), "val"))
  }), use.names = FALSE))
  usados <- if (is.null(usados)) character(0) else as.character(usados)
  huerfanos <- setdiff(usados, as.character(estilos))
  testthat::expect_identical(
    huerfanos, character(0),
    info = sprintf("w:rStyle apunta a estilos que word/styles.xml no define: %s",
                   paste(huerfanos, collapse = ", "))
  )

  # 4) Comentarios y anclas balanceados. Un `commentRangeStart` sin su cierre
  #    deja el comentario abierto hasta el final del documento y Word lo repara
  #    ELIMINANDO contenido.
  cuenta <- function(tag) {
    sum(vapply(piezas$docs, function(doc) {
      length(xml2::xml_find_all(doc, paste0("//w:", tag), xml2::xml_ns(doc)))
    }, integer(1)))
  }
  n_ini <- cuenta("commentRangeStart")
  n_fin <- cuenta("commentRangeEnd")
  n_ref <- cuenta("commentReference")
  testthat::expect_identical(
    c(n_fin, n_ref), c(n_ini, n_ini),
    info = sprintf("comentarios descuadrados: start=%d end=%d reference=%d", n_ini, n_fin, n_ref)
  )

  # 5) Cero em dashes. El motor normaliza los guiones largos del instrumento a
  #    "-" (`.form_pdf_clean_text`); uno que sobreviva delata texto que no paso
  #    por la limpieza.
  em <- unlist(lapply(names(piezas$docs), function(p) {
    doc <- piezas$docs[[p]]
    textos <- xml2::xml_text(xml2::xml_find_all(doc, "//w:t", xml2::xml_ns(doc)))
    textos[grepl("—", textos, fixed = TRUE)]
  }), use.names = FALSE)
  em <- if (is.null(em)) character(0) else em
  testthat::expect_identical(
    em, character(0),
    info = sprintf("em dashes en el texto del .docx: %s", paste(em, collapse = " | "))
  )

  # 6) Cero numeracion automatica (ver `forbid_numPr`).
  if (isTRUE(forbid_numPr)) {
    doc <- piezas$docs[["word/document.xml"]]
    n_num <- if (is.null(doc)) 0L else
      length(xml2::xml_find_all(doc, "//w:numPr", xml2::xml_ns(doc)))
    testthat::expect_identical(
      n_num, 0L,
      info = "w:numPr en word/document.xml: Word numeraria ENCIMA del numero que pone el motor"
    )
  }

  invisible(list(
    desorden = desorden,
    desorden_nuevo = nuevo,
    estilos = as.character(estilos),
    comentarios = c(start = n_ini, end = n_fin, reference = n_ref)
  ))
}
