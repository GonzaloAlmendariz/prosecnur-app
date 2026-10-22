# Compartido por los tests de rendimiento de los motores XLSX (H16, 2026-10-21).

# Estilo efectivo de cada celda (fuente, relleno, borde, formato numérico y
# alineación ya resueltos), independiente del orden de los ids de styles.xml.
.xlsx_estilos_por_celda <- function(path, hoja = 1L) {
  d <- tempfile(); on.exit(unlink(d, recursive = TRUE))
  utils::unzip(path, exdir = d)
  st <- xml2::read_xml(file.path(d, "xl/styles.xml")); xml2::xml_ns_strip(st)
  sh <- xml2::read_xml(file.path(d, sprintf("xl/worksheets/sheet%d.xml", hoja))); xml2::xml_ns_strip(sh)
  hijos <- function(tag) as.character(xml2::xml_find_all(st, sprintf("//%s/*", tag)))
  fonts <- hijos("fonts"); fills <- hijos("fills"); borders <- hijos("borders")
  nf <- xml2::xml_find_all(st, "//numFmts/numFmt")
  formatos <- stats::setNames(xml2::xml_attr(nf, "formatCode"), xml2::xml_attr(nf, "numFmtId"))
  canon <- vapply(xml2::xml_find_all(st, "//cellXfs/xf"), function(x) {
    a <- as.list(xml2::xml_attrs(x)); g <- function(k) a[[k]] %||% "0"
    paste(fonts[as.integer(g("fontId")) + 1], fills[as.integer(g("fillId")) + 1],
          borders[as.integer(g("borderId")) + 1], formatos[g("numFmtId")] %||% g("numFmtId"),
          paste(as.character(xml2::xml_children(x)), collapse = ""), sep = "|")
  }, "")
  celdas <- xml2::xml_find_all(sh, "//sheetData/row/c")
  s <- xml2::xml_attr(celdas, "s"); s[is.na(s)] <- "0"
  stats::setNames(canon[as.integer(s) + 1], xml2::xml_attr(celdas, "r"))
}

