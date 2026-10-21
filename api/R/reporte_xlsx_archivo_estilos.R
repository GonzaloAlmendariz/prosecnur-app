# reporte_xlsx_archivo_estilos.R — estilos de tablas ya cerradas fuera del camino
# ===============================================================================
#
# Medido en HSyVbG 2026 (2026-10-21, H16): las tablas de cruces de 331 variables
# no terminaban en 81 minutos, cuando cada variable sola tarda ~0,7 s. openxlsx
# guarda cada `addStyle` como un objeto en `wb$styleObjects`, y tanto
# `addStyle(stack = TRUE)` como `writeData` (vía `classStyles`) recorren TODOS
# los objetos en cada llamada; `mergeCells` hace lo mismo con las combinaciones
# de la hoja. El costo crece con el cuadrado de las tablas: 30 variables 63 s,
# 60 variables 239 s.
#
# Una tabla ya escrita no vuelve a recibir estilos, así que sus objetos pueden
# salir de la lista mientras se escribe la siguiente y volver antes de guardar.
# Al volver se compactan en un objeto por estilo distinto, porque el guardado
# también recorre la hoja una vez por objeto. Cada celda conserva su estilo
# efectivo; sólo cambia el orden de los ids en styles.xml.

.xlsx_archivo_estilos <- function() {
  archivo <- new.env(parent = emptyenv())
  archivo$estilos <- list()
  archivo$merges <- list()
  archivo
}

#' Saca del libro los estilos y combinaciones escritos hasta ahora.
#' @noRd
.xlsx_archivar_estilos <- function(wb, archivo) {
  if (length(wb$styleObjects)) {
    archivo$estilos[[length(archivo$estilos) + 1L]] <- wb$styleObjects
    wb$styleObjects <- list()
  }
  for (i in seq_along(wb$worksheets)) {
    m <- wb$worksheets[[i]]$mergeCells
    if (length(m)) {
      archivo$merges[[as.character(i)]] <- c(archivo$merges[[as.character(i)]], m)
      wb$worksheets[[i]]$mergeCells <- character(0)
    }
  }
  invisible(wb)
}

.XLSX_CAMPOS_ESTILO <- c("fontName", "fontColour", "fontSize", "fontFamily", "fontScheme",
  "fontDecoration", "borderTop", "borderLeft", "borderRight", "borderBottom", "borderTopColour",
  "borderLeftColour", "borderRightColour", "borderBottomColour", "borderDiagonal",
  "borderDiagonalColour", "borderDiagonalUp", "borderDiagonalDown", "halign", "valign", "indent",
  "textRotation", "numFmt", "fill", "wrapText", "locked", "hidden", "xfId")

.xlsx_firma_estilo <- function(st) {
  paste(vapply(.XLSX_CAMPOS_ESTILO, function(f) paste(deparse(st$field(f)), collapse = ""), ""),
        collapse = "\u001f")
}

#' Junta los objetos de estilo en uno por estilo distinto y hoja.
#'
#' Al guardar, openxlsx recorre todas las celdas de la hoja UNA VEZ POR OBJETO
#' (`preSaveCleanUp`): con 331 tablas eran ~53.000 objetos y el guardado volvía
#' a ser cuadrático. Cada celda conserva el estilo del ÚLTIMO objeto que la
#' nombra, que es el que openxlsx le dejaría.
#' @noRd
.xlsx_compactar_estilos <- function(objetos) {
  if (length(objetos) < 2L) return(objetos)
  ok <- vapply(objetos, function(x) length(x$rows) > 0L && length(x$cols) > 0L, logical(1))
  objetos <- objetos[ok]
  # Firma por referencia primero: la mayoría de los objetos comparten el mismo
  # Style (st$body_txt…); sólo los combinados por stack son copias nuevas.
  dir_ref <- vapply(objetos, function(x) rlang::obj_address(x$style), "")
  firmas_ref <- vapply(objetos[!duplicated(dir_ref)], function(x) .xlsx_firma_estilo(x$style), "")
  names(firmas_ref) <- dir_ref[!duplicated(dir_ref)]
  firma <- unname(firmas_ref[dir_ref])
  largo <- vapply(objetos, function(x) length(x$rows), integer(1))
  idx <- rep.int(seq_along(objetos), largo)
  hoja <- rep.int(vapply(objetos, function(x) as.character(x$sheet), ""), largo)
  filas <- unlist(lapply(objetos, `[[`, "rows"), use.names = FALSE)
  cols <- unlist(lapply(objetos, `[[`, "cols"), use.names = FALSE)
  vive <- !duplicated(data.frame(hoja, filas, cols), fromLast = TRUE)
  grupo <- paste(hoja[vive], firma[idx[vive]], sep = "\u001e")
  primero <- idx[vive][!duplicated(grupo)]
  partes <- split(seq_along(grupo), factor(grupo, levels = unique(grupo)))
  filas_v <- filas[vive]; cols_v <- cols[vive]
  unname(Map(function(k, celdas) list(style = objetos[[k]]$style, sheet = objetos[[k]]$sheet,
                                      rows = filas_v[celdas], cols = cols_v[celdas]),
             primero, partes))
}

#' Devuelve al libro todo lo archivado, en el orden en que se escribió.
#' @noRd
.xlsx_restaurar_estilos <- function(wb, archivo) {
  wb$styleObjects <- .xlsx_compactar_estilos(
    c(unlist(archivo$estilos, recursive = FALSE), wb$styleObjects))
  for (i in names(archivo$merges)) {
    k <- as.integer(i)
    wb$worksheets[[k]]$mergeCells <- c(archivo$merges[[i]], wb$worksheets[[k]]$mergeCells)
  }
  archivo$estilos <- list()
  archivo$merges <- list()
  invisible(wb)
}
