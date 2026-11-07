# Relaciones huérfanas en un .xlsx escrito por openxlsx.
#
# openxlsx (4.2.8.1) escribe en `xl/worksheets/_rels/sheetN.xml.rels` una
# relación a `../drawings/drawingN.xml` (y a `vmlDrawingN.vml`) aunque la hoja
# no tenga dibujos, y luego no escribe esos archivos. Excel lo tolera porque la
# hoja no declara `<drawing>`, pero openpyxl —que es lo que usa pyxform, y por
# tanto Kobo al importar un XLSForm— sigue la relación y falla con:
#   KeyError: "There is no item named 'xl/drawings/drawing1.xml' in the archive"
# Pasó con el editor XLSForm (2026-11-06, Instrumento_SerAdolescente.xlsx).
#
# `xlsx_quitar_relaciones_huerfanas()` reescribe el zip sin las relaciones
# internas cuyo destino no existe, y sin los `<drawing>`/`<legacyDrawing>` de
# las hojas que apuntaban a ellas. Si no hay nada que quitar, no toca el
# archivo. Devuelve (invisible) cuántas relaciones quitó.
xlsx_quitar_relaciones_huerfanas <- function(path) {
  if (!file.exists(path)) return(invisible(0L))
  dir <- tempfile("xlsx_rels_")
  dir.create(dir)
  on.exit(unlink(dir, recursive = TRUE, force = TRUE), add = TRUE)

  entradas <- zip::zip_list(path)$filename
  zip::unzip(path, exdir = dir)
  rels <- entradas[grepl("(^|/)_rels/[^/]*\\.rels$", entradas)]
  quitadas <- 0L

  for (rel in rels) {
    rel_path <- file.path(dir, rel)
    xml <- paste(readLines(rel_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    nodos <- regmatches(xml, gregexpr("<Relationship\\b[^>]*/>", xml))[[1]]
    if (!length(nodos)) next
    # La parte dueña del .rels: "xl/worksheets/_rels/sheet1.xml.rels" -> "xl/worksheets"
    base <- dirname(dirname(rel))
    ids_quitados <- character()
    for (nodo in nodos) {
      if (grepl("TargetMode=\"External\"", nodo, fixed = TRUE)) next
      target <- sub(".*\\bTarget=\"([^\"]*)\".*", "\\1", nodo)
      if (identical(target, nodo) || !nzchar(target)) next
      destino <- if (startsWith(target, "/")) {
        sub("^/", "", target)
      } else {
        .xlsx_normalizar_ruta(if (base %in% c(".", "")) target else file.path(base, target))
      }
      if (!destino %in% entradas) {
        xml <- sub(nodo, "", xml, fixed = TRUE)
        ids_quitados <- c(ids_quitados, sub(".*\\bId=\"([^\"]*)\".*", "\\1", nodo))
        quitadas <- quitadas + 1L
      }
    }
    if (!length(ids_quitados)) next
    writeLines(xml, rel_path, useBytes = TRUE)

    # Quitar de la parte dueña las referencias a los ids que ya no existen.
    parte <- file.path(dir, base, sub("\\.rels$", "", basename(rel)))
    if (file.exists(parte)) {
      px <- paste(readLines(parte, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
      for (id in ids_quitados) {
        patron <- sprintf("<(drawing|legacyDrawing|legacyDrawingHF)\\b[^>]*r:id=\"%s\"[^>]*/>", id)
        px <- gsub(patron, "", px, perl = TRUE)
      }
      writeLines(px, parte, useBytes = TRUE)
    }
  }

  if (quitadas > 0L) {
    # [Content_Types].xml primero, como lo escribe Excel.
    orden <- c(intersect("[Content_Types].xml", entradas), setdiff(entradas, "[Content_Types].xml"))
    orden <- orden[!endsWith(orden, "/")]
    tmp <- tempfile("xlsx_rels_out_", fileext = ".xlsx")
    zip::zip(tmp, files = orden, root = dir, mode = "mirror")
    file.copy(tmp, path, overwrite = TRUE)
    unlink(tmp)
  }
  invisible(quitadas)
}

# "xl/worksheets/../drawings/drawing1.xml" -> "xl/drawings/drawing1.xml"
.xlsx_normalizar_ruta <- function(ruta) {
  partes <- strsplit(ruta, "/", fixed = TRUE)[[1]]
  out <- character()
  for (p in partes) {
    if (p %in% c("", ".")) next
    if (p == "..") out <- head(out, -1L) else out <- c(out, p)
  }
  paste(out, collapse = "/")
}
