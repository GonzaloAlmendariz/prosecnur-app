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
# @param path ruta al `.xlsx`.
# @param hoja nombre de la hoja.
# @param col indice de columna (1 = A).
# @param fila numero de fila del `.xlsx` (1 = la primera).
# @return el `formatCode` como cadena; `""` si la celda no lleva formato, `NA`
#   si la celda no existe.
formato_de_celda <- function(path, hoja, col, fila) {
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(NA_character_)
  xml <- paste(readLines(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])),
                         warn = FALSE), collapse = "")
  st <- paste(readLines(file.path(d, "xl", "styles.xml"), warn = FALSE), collapse = "")

  ref <- paste0(openxlsx::int2col(col), fila)
  celda <- regmatches(xml, regexpr(sprintf('<c r="%s"[^>]*>', ref), xml))
  if (!length(celda)) return(NA_character_)
  sidx <- regmatches(celda, regexpr('s="[0-9]+"', celda))
  if (!length(sidx)) return("")
  sidx <- as.integer(gsub("[^0-9]", "", sidx))
  xfs <- regmatches(st, regexpr("<cellXfs.*?</cellXfs>", st))
  if (!length(xfs)) return("")
  xf <- regmatches(xfs, gregexpr("<xf [^>]*/?>", xfs))[[1]]
  if (sidx + 1L > length(xf)) return("")
  nid <- regmatches(xf[[sidx + 1L]], regexpr('numFmtId="[0-9]+"', xf[[sidx + 1L]]))
  if (!length(nid)) return("")
  nid <- gsub("[^0-9]", "", nid)
  fmt <- regmatches(st, regexpr(sprintf('<numFmt numFmtId="%s" formatCode="[^"]*"', nid), st))
  if (!length(fmt)) return(nid)
  gsub('.*formatCode="([^"]*)".*', "\\1", fmt)
}

# El RELLENO real de una celda, por el mismo motivo que el formato.
#
# Buscar «FF002457» en `styles.xml` no prueba que la cabecera de ESTA hoja lo
# lleve: la portada usa el mismo navy en su titulo, sus secciones y su barra de
# datos, asi que el color esta en el catalogo pase lo que pase. Comprobado con
# el mutante: quitarle el navy a la cabecera de las hojas no rompia nada.
#
# Camino: `s=` de la celda -> `cellXfs` -> `fillId` -> `fills` -> `fgColor rgb`.
#
# @return el rgb como cadena (por ejemplo «FF002457»); `""` si no tiene relleno,
#   `NA` si la celda no existe.
relleno_de_celda <- function(path, hoja, col, fila) {
  d <- tempfile()
  dir.create(d)
  on.exit(unlink(d, recursive = TRUE), add = TRUE)
  utils::unzip(path, exdir = d)
  hojas <- openxlsx::getSheetNames(path)
  i <- which(hojas == hoja)
  if (!length(i)) return(NA_character_)
  xml <- paste(readLines(file.path(d, "xl", "worksheets", sprintf("sheet%d.xml", i[[1]])),
                         warn = FALSE), collapse = "")
  st <- paste(readLines(file.path(d, "xl", "styles.xml"), warn = FALSE), collapse = "")

  ref <- paste0(openxlsx::int2col(col), fila)
  celda <- regmatches(xml, regexpr(sprintf('<c r="%s"[^>]*>', ref), xml))
  if (!length(celda)) return(NA_character_)
  sidx <- regmatches(celda, regexpr('s="[0-9]+"', celda))
  if (!length(sidx)) return("")
  sidx <- as.integer(gsub("[^0-9]", "", sidx))
  xfs <- regmatches(st, regexpr("<cellXfs.*?</cellXfs>", st))
  if (!length(xfs)) return("")
  xf <- regmatches(xfs, gregexpr("<xf [^>]*/?>", xfs))[[1]]
  if (sidx + 1L > length(xf)) return("")
  fid <- regmatches(xf[[sidx + 1L]], regexpr('fillId="[0-9]+"', xf[[sidx + 1L]]))
  if (!length(fid)) return("")
  fid <- as.integer(gsub("[^0-9]", "", fid))
  fills <- regmatches(st, regexpr("<fills.*?</fills>", st))
  if (!length(fills)) return("")
  uno <- regmatches(fills, gregexpr("<fill>.*?</fill>", fills))[[1]]
  if (fid + 1L > length(uno)) return("")
  rgb <- regmatches(uno[[fid + 1L]], regexpr('rgb="[0-9A-Fa-f]+"', uno[[fid + 1L]]))
  if (!length(rgb)) return("")
  # El valor entre comillas, no «todo lo que parezca hexadecimal»: la `b` de
  # `rgb=` es una letra valida en hex y se colaba delante del color.
  toupper(gsub('^rgb="|"$', "", rgb))
}
