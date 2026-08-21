# El formato REAL de una celda de un `.xlsx`, resuelto hasta el `formatCode`.
#
# **Mirar si `styles.xml` contiene «0.0%» NO vale.** El libro tiene varias hojas
# y basta con que UNA aplique ese formato para que el fichero lo declare: un
# test que solo mire el catalogo de estilos pasa aunque la hoja que le importa
# se quede sin formato.
#
# Y no es teorico. El test que fijaba el porcentaje de «Aulas Aplicadas (Campo)»
# dejo de discriminar el dia que la hoja «Datos» empezo a aplicar el mismo
# formato: quitarlo de la hoja de campo ya no rompia nada. Se descubrio pasando
# el mutante DESPUES de tocar otra hoja.
#
# El camino completo es `s=` de la celda -> indice en `cellXfs` -> `numFmtId` ->
# `formatCode` de `numFmts`.
#
# **Se recorre con `xml2`, no con expresiones regulares.** Lo hace asi
# `test-analitica-color-recod.R` desde antes —«lee el fill REAL del .xlsx, no un
# proxy»— y la primera version de este helper, escrita con `regmatches`, ya se
# equivoco: limpiar el color con `[^0-9A-Fa-f]` dejaba **la `b` de `rgb=`**
# pegada delante, porque la `b` es un digito hexadecimal valido. Un atributo se
# lee como atributo.
#
# @param path ruta al `.xlsx`.
# @param hoja nombre de la hoja.
# @param col indice de columna (1 = A).
# @param fila numero de fila del `.xlsx` (1 = la primera).
# @return el `formatCode` como cadena; `""` si la celda no lleva formato, `NA`
#   si la celda no existe.
.NS_XLSX <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# Abre el `.xlsx` una vez y devuelve las piezas que los tres lectores comparten.
.piezas_xlsx <- function(path, hoja) {
  d <- tempfile()
  dir.create(d)
  # Se limpia aqui mismo: `xml2::read_xml()` deja el documento en memoria, asi
  # que el directorio ya no hace falta cuando esta funcion vuelve. Intentar
  # registrar el `on.exit` en el frame del llamador no funciona —`d` no existe
  # alli— y dejaba los tres lectores con «object 'd' not found».
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(NULL)
  list(
    estilos = xml2::read_xml(file.path(d, "xl", "styles.xml")),
    hoja = xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  )
}

# El indice de estilo (`s=`) de una celda, o NA si la celda no existe.
.estilo_de_celda <- function(doc, ref) {
  c1 <- xml2::xml_find_first(doc, sprintf(".//a:c[@r='%s']", ref), .NS_XLSX)
  if (inherits(c1, "xml_missing")) return(NA_integer_)
  s <- xml2::xml_attr(c1, "s")
  if (is.na(s)) 0L else as.integer(s)
}

# El `xf` numero `idx` de `cellXfs`.
.xf_de <- function(estilos, idx) {
  xfs <- xml2::xml_find_all(estilos, ".//a:cellXfs/a:xf", .NS_XLSX)
  if (idx + 1L > length(xfs)) return(NULL)
  xfs[[idx + 1L]]
}

formato_de_celda <- function(path, hoja, col, fila) {
  p <- .piezas_xlsx(path, hoja)
  if (is.null(p)) return(NA_character_)
  idx <- .estilo_de_celda(p$hoja, paste0(openxlsx::int2col(col), fila))
  if (is.na(idx)) return(NA_character_)
  xf <- .xf_de(p$estilos, idx)
  if (is.null(xf)) return("")
  nid <- xml2::xml_attr(xf, "numFmtId")
  if (is.na(nid)) return("")
  fmt <- xml2::xml_find_first(p$estilos, sprintf(".//a:numFmts/a:numFmt[@numFmtId='%s']", nid),
                              .NS_XLSX)
  # Los `numFmtId` por debajo de 164 son los integrados de Excel y no aparecen
  # en `numFmts`: se devuelve el id, que es lo unico que hay.
  if (inherits(fmt, "xml_missing")) return(nid)
  xml2::xml_attr(fmt, "formatCode")
}

# El RELLENO real de una celda, por el mismo motivo que el formato.
#
# Buscar «FF002457» en `styles.xml` no prueba que la cabecera de ESTA hoja lo
# lleve: la portada usa el mismo navy en su titulo, sus secciones y su barra de
# datos, asi que el color esta en el catalogo pase lo que pase. Comprobado con
# el mutante: quitarle el navy a la cabecera de las hojas no rompia nada.
#
# Camino: `s=` de la celda -> `cellXfs` -> `fillId` -> `fills` -> `fgColor rgb`,
# recorrido con `xml2` por lo mismo que el de arriba.
#
# @return el rgb como cadena (por ejemplo «FF002457»); `""` si no tiene relleno,
#   `NA` si la celda no existe.
relleno_de_celda <- function(path, hoja, col, fila) {
  p <- .piezas_xlsx(path, hoja)
  if (is.null(p)) return(NA_character_)
  idx <- .estilo_de_celda(p$hoja, paste0(openxlsx::int2col(col), fila))
  if (is.na(idx)) return(NA_character_)
  xf <- .xf_de(p$estilos, idx)
  if (is.null(xf)) return("")
  fid <- xml2::xml_attr(xf, "fillId")
  if (is.na(fid)) return("")
  fills <- xml2::xml_find_all(p$estilos, ".//a:fills/a:fill", .NS_XLSX)
  fid <- as.integer(fid)
  if (fid + 1L > length(fills)) return("")
  fg <- xml2::xml_find_first(fills[[fid + 1L]], ".//a:fgColor", .NS_XLSX)
  if (inherits(fg, "xml_missing")) return("")
  rgb <- xml2::xml_attr(fg, "rgb")
  if (is.na(rgb)) "" else toupper(rgb)
}

# El rango de columnas que una hoja repite al imprimir (`Print_Titles`).
#
# **Contar cuantos `Print_Titles` hay en `workbook.xml` no vale.** El libro tiene
# seis hojas y varias lo declaran, asi que el conteo se cumple aunque la hoja que
# importa repita la columna equivocada. Comprobado con el mutante: hacer que la
# agenda y la hoja de campo repitieran solo `ID MATCH` —el defecto real que se
# encontro mirando el PDF— no rompia ningun test.
#
# @return el rango como cadena (por ejemplo «$A:$D»); `""` si la hoja no declara
#   columnas repetidas.
columnas_repetidas_de <- function(path, hoja) {
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  wb <- xml2::read_xml(file.path(d, "xl", "workbook.xml"))
  nombres <- xml2::xml_find_all(wb, ".//a:definedNames/a:definedName", .NS_XLSX)
  for (n in nombres) {
    if (!identical(xml2::xml_attr(n, "name"), "_xlnm.Print_Titles")) next
    v <- xml2::xml_text(n)
    # El valor lleva la hoja delante y puede traer filas y columnas separadas
    # por coma: «'Aulas Agendadas'!$A:$D,'Aulas Agendadas'!$1:$1».
    for (parte in strsplit(v, ",", fixed = TRUE)[[1]]) {
      if (!startsWith(parte, sprintf("'%s'!", hoja))) next
      rango <- sub(".*!", "", parte)
      if (grepl("^\\$[A-Z]+:\\$[A-Z]+$", rango)) return(rango)
    }
  }
  ""
}

# Cuantas celdas combinadas tiene UNA hoja.
#
# «El XML contiene <mergeCell>» se satisface con una: con el mutante que dejaba
# la Base de control combinando un tramo de los cuatro, el test seguia verde.
# Lo que hay que comprobar es el numero, y contra la cuenta de tramos que
# declara el generador, no contra un 4 escrito a mano.
celdas_combinadas_de <- function(path, hoja) {
  p <- .piezas_xlsx(path, hoja)
  if (is.null(p)) return(NA_integer_)
  length(xml2::xml_find_all(p$hoja, ".//a:mergeCells/a:mergeCell", .NS_XLSX))
}

# Las validaciones de lista de una hoja: a que celdas se aplican y de donde
# sacan sus valores.
#
# `openxlsx` escribe las validaciones que apuntan a OTRA hoja en el namespace de
# extension `x14`, no como `<dataValidation>` normal — buscar la etiqueta simple
# devuelve cero sobre un libro que si las lleva.
#
# @return `data.frame(sqref, formula)`, una fila por validacion.
validaciones_de <- function(path, hoja) {
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
          x14 = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main",
          xm = "http://schemas.microsoft.com/office/excel/2006/main")
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(data.frame(sqref = character(0), formula = character(0)))
  doc <- xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  vs <- xml2::xml_find_all(doc, "//x14:dataValidation", ns)
  data.frame(
    sqref = vapply(vs, function(v) xml2::xml_text(xml2::xml_find_first(v, ".//xm:sqref", ns)),
                   character(1)),
    formula = vapply(vs, function(v) xml2::xml_text(xml2::xml_find_first(v, ".//xm:f", ns)),
                     character(1)),
    stringsAsFactors = FALSE
  )
}

# El ajuste de impresion de UNA hoja: orientacion y si encaja a lo ancho.
#
# Vive aqui porque el `pageSetup` es por hoja y `workbook.xml` no lo lleva: esta
# en el `<pageSetup>` de la propia hoja.
impresion_de <- function(path, hoja) {
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(NULL)
  doc <- xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  ps <- xml2::xml_find_first(doc, ".//a:pageSetup", ns)
  if (inherits(ps, "xml_missing")) return(list(orientacion = "", ancho = NA_character_))
  list(
    orientacion = xml2::xml_attr(ps, "orientation") %||% "",
    ancho = xml2::xml_attr(ps, "fitToWidth")
  )
}

# El alto declarado de una fila, o NA si va con el alto por defecto.
alto_de_fila <- function(path, hoja, fila) {
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(NA_real_)
  doc <- xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  r <- xml2::xml_find_first(doc, sprintf(".//a:sheetData/a:row[@r='%d']", fila), ns)
  if (inherits(r, "xml_missing")) return(NA_real_)
  ht <- xml2::xml_attr(r, "ht")
  if (is.na(ht)) NA_real_ else as.numeric(ht)
}

# El TIPO de una celda: `"n"` numerica, `"s"`/`"str"` texto, `""` sin declarar.
#
# Es lo que decide si Excel puede ordenar y filtrar por rango. Un
# `expect_gt(length(grep('t="n"', celdas)), 0)` sobre la hoja entera NO sirve
# para vigilar una columna: cualquier otra columna numerica lo satisface —paso
# exactamente eso con las fechas el dia que se empezaron a tipar los conteos—.
tipo_de_celda <- function(path, hoja, col, fila) {
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(NA_character_)
  doc <- xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  ref <- paste0(openxlsx::int2col(col), fila)
  c1 <- xml2::xml_find_first(doc, sprintf(".//a:c[@r='%s']", ref), ns)
  if (inherits(c1, "xml_missing")) return(NA_character_)
  t <- xml2::xml_attr(c1, "t")
  # Sin atributo `t`, Excel entiende numero.
  if (is.na(t)) "n" else t
}

# Las columnas que llevan formato condicional en una hoja, como letras.
#
# El semaforo se cuelga por posicion, y ya se pinto una vez sobre la columna
# equivocada —`MEDIO DE CONTACTO` en vez de `STATUS DE APLICACION`—: una regla
# que existe pero no tiñe nada no se ve por ningun lado.
columnas_con_formato_condicional <- function(path, hoja) {
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(character(0))
  doc <- xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  sq <- xml2::xml_attr(xml2::xml_find_all(doc, ".//a:conditionalFormatting", ns), "sqref")
  sq <- sq[!is.na(sq)]
  unique(sub("([A-Z]+).*", "\\1", unlist(strsplit(sq, "[ :]"))))
}

# Las reglas de formato condicional de una hoja, con su TIPO y su columna.
#
# `columnas_con_formato_condicional()` dice donde hay regla; esta dice cual.
# Hace falta cuando una hoja lleva varias clases —una barra de datos y un
# semaforo de texto no son lo mismo— y comprobar solo la columna deja pasar que
# se cambie una por otra.
#
# **Devuelve tambien el `sqref` crudo**, y hace falta: `openxlsx` agrupa varias
# columnas en UNA sola etiqueta —`sqref="B23:G42"`—, asi que mirar solo la
# primera letra no distingue «la barra esta en su columna» de «la barra esta en
# las seis». Un mutante sobrevivio exactamente por eso.
#
# @return `data.frame(col, tipo, sqref)`, una fila por regla.
reglas_condicionales_de <- function(path, hoja) {
  ns <- c(a = "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  vacio <- data.frame(col = character(0), tipo = character(0), stringsAsFactors = FALSE)
  if (!length(i)) return(vacio)
  doc <- xml2::read_xml(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])))
  cfs <- xml2::xml_find_all(doc, ".//a:conditionalFormatting", ns)
  if (!length(cfs)) return(vacio)
  filas <- lapply(cfs, function(cf) {
    sq <- xml2::xml_attr(cf, "sqref")
    col <- sub("([A-Z]+).*", "\\1", strsplit(sq, "[ :]")[[1]][[1]])
    tipos <- xml2::xml_attr(xml2::xml_find_all(cf, ".//a:cfRule", ns), "type")
    data.frame(col = rep(col, length(tipos)), tipo = tipos,
               sqref = rep(sq, length(tipos)), stringsAsFactors = FALSE)
  })
  do.call(rbind, filas)
}
