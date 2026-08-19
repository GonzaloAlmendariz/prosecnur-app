# Deteccion del encabezado desplazado en bases Excel de marco.
#
# Los reportes DTI de la PUCP (BBDD 2026-2, solicitud 207915) llegan con un
# preambulo de seis filas (titulo, solicitud, fecha, aviso legal), cinco filas
# vacias y el encabezado real en la fila 12. Leidos con `read_excel` a secas,
# readxl toma la fila 1 como encabezado y recorta las columnas vacias: la hoja
# entera se ve como UNA columna llamada «Reporte de Alumnos matriculados
# 2026-2», el clasificador de roles la declara desconocida y el marco no se
# puede construir. Medido el 2026-08-19 sobre los dos archivos reales.
#
# La deteccion es geometrica y conservadora: se escanean las primeras filas
# ancladas a A1 (con `cell_limits` para que readxl no recorte nada) y el
# encabezado es la PRIMERA fila suficientemente densa. Si esa fila es la 1
# —toda base normal—, el skip es 0 y nada cambia.

#' Cuantas filas hay que saltar para que el encabezado quede primero.
#'
#' @param path ruta al Excel.
#' @param sheet nombre de hoja; vacio o NULL usa la primera.
#' @param max_scan cuantas filas iniciales examinar.
#' @return entero >= 0; 0 significa «encabezado en la fila 1» (caso normal).
.cm_aulas_encabezado_skip <- function(path, sheet = NULL, max_scan = 25L) {
  sheet_arg <- .cm_aulas_scalar(sheet, "")
  scan <- tryCatch(
    suppressMessages(suppressWarnings(as.data.frame(
      readxl::read_excel(
        path,
        sheet = if (nzchar(sheet_arg)) sheet_arg else 1L,
        # Rango explicito: sin el, readxl descarta filas y columnas vacias
        # iniciales y el indice de fila ya no seria el del sheet.
        range = readxl::cell_limits(c(1L, 1L), c(as.integer(max_scan), NA)),
        col_names = FALSE,
        col_types = "text"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ))),
    error = function(e) NULL
  )
  if (is.null(scan) || !nrow(scan) || !ncol(scan)) return(0L)
  densidad <- vapply(seq_len(nrow(scan)), function(i) {
    v <- trimws(as.character(unlist(scan[i, ], use.names = FALSE)))
    sum(!is.na(v) & nzchar(v) & v != "NA")
  }, integer(1))
  ancho <- max(densidad)
  # Con menos de 3 celdas en la mejor fila no hay tabla que detectar: mejor
  # dejar la lectura como esta que inventar un salto.
  if (ancho < 3L) return(0L)
  umbral <- max(3L, as.integer(ceiling(ancho * 0.6)))
  fila <- which(densidad >= umbral)[1]
  if (is.na(fila) || fila <= 1L) return(0L)
  fila - 1L
}
