# reporte_comparativo_buffer.R — las celdas de una fila de respuesta, de una vez
# ===============================================================================
#
# Medido en HSyVbG 2026 (2026-10-22, H16): el comparativo de cruces escribía
# celda por celda (`.comparativo_put`: un writeData y un addStyle por celda), y
# openxlsx recorre TODOS los estilos del libro en cada writeData (`classStyles`).
# Una sola pregunta son ~150 celdas por respuesta (3 años × 7 cruces × n/%), así
# que el costo era cuadrático ya dentro de la tabla: 10 preguntas, 362 s.
#
# El búfer junta las celdas de una fila de respuesta y las vuelca con un
# writeData por tramo contiguo de cada fila y un addStyle por estilo distinto.
# Se vuelca ANTES de los estilos con `stack = TRUE` de esa fila (regla, negrita
# del Total), que se combinan con lo ya aplicado; el libro resultante es el mismo.

.comparativo_buffer <- function() {
  b <- new.env(parent = emptyenv())
  b$filas <- integer(0); b$cols <- integer(0); b$valores <- list(); b$estilos <- list()
  b$put <- function(wb, hoja, fila, col, valor, estilo) {
    b$filas <- c(b$filas, as.integer(fila)); b$cols <- c(b$cols, as.integer(col))
    b$valores[[length(b$valores) + 1L]] <- valor
    b$estilos[[length(b$estilos) + 1L]] <- estilo
    invisible(NULL)
  }
  b
}

#' Escribe y estiliza lo acumulado; deja el búfer vacío.
#' @noRd
.comparativo_buffer_volcar <- function(wb, hoja, b) {
  n <- length(b$filas)
  if (!n) return(invisible(wb))
  # Si una celda se escribió dos veces vale la última, como con writeData directo.
  vive <- !duplicated(paste(b$filas, b$cols), fromLast = TRUE)
  filas <- b$filas[vive]; cols <- b$cols[vive]
  valores <- b$valores[vive]; estilos <- b$estilos[vive]
  for (r in unique(filas)) {
    en_r <- which(filas == r)
    en_r <- en_r[order(cols[en_r])]
    cc <- cols[en_r]
    tramo <- cumsum(c(1L, diff(cc) != 1L))
    for (t in unique(tramo)) {
      idx <- en_r[tramo == t]
      fila_df <- as.data.frame(stats::setNames(valores[idx], paste0("c", seq_along(idx))),
                               stringsAsFactors = FALSE, check.names = FALSE)
      openxlsx::writeData(wb, hoja, fila_df, startRow = r, startCol = min(cols[idx]),
                          colNames = FALSE)
    }
  }
  dir <- vapply(estilos, rlang::obj_address, "")
  for (d in unique(dir)) {
    k <- which(dir == d)
    openxlsx::addStyle(wb, hoja, estilos[[k[1]]], rows = filas[k], cols = cols[k],
                       gridExpand = FALSE, stack = FALSE)
  }
  b$filas <- integer(0); b$cols <- integer(0); b$valores <- list(); b$estilos <- list()
  invisible(wb)
}
