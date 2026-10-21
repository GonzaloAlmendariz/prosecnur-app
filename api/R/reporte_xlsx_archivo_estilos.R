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
# El libro que se graba es el mismo; sólo deja de pagar el recorrido.

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

#' Devuelve al libro todo lo archivado, en el orden en que se escribió.
#' @noRd
.xlsx_restaurar_estilos <- function(wb, archivo) {
  wb$styleObjects <- c(unlist(archivo$estilos, recursive = FALSE), wb$styleObjects)
  for (i in names(archivo$merges)) {
    k <- as.integer(i)
    wb$worksheets[[k]]$mergeCells <- c(archivo$merges[[i]], wb$worksheets[[k]]$mergeCells)
  }
  archivo$estilos <- list()
  archivo$merges <- list()
  invisible(wb)
}
