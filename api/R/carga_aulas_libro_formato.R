# Formato del libro operativo de aulas.
#
# El libro se generaba con `openxlsx::write.xlsx(hojas, ...)`: un volcado. Medido
# sobre el libro de HSVG2026 recien generado —tres hojas, 842 x 241, 204 x 102 y
# 204 x 39—: CERO validaciones de datos, cero paneles congelados, cero anchos de
# columna, cero proteccion, cero formato condicional, cero autofiltro.
#
# Eso no es cosmetica. Sin lista desplegable, `STATUS MUESTRA` se escribe a mano
# 2 040 veces y el lector recibe «AGENDADA», «agendada», «Agendada» y «se
# agendo»; sin panel congelado, en la fila 300 de una hoja de 241 columnas nadie
# sabe que columna esta llenando. El vocabulario NO se inventa aqui: sale de lo
# observado en el estudio real de 2025 —`docs/qa/anatomia-excels-aulas-2026-08-16.md`—
# que es exactamente lo que el lector ya sabe traducir.
#
# Las listas viven en una hoja propia y no como literales del `dataValidation`:
# asi quedan a la vista de quien llena, y Excel no tiene el limite de 255
# caracteres de la lista inline —`EN RESERVA 1..11` lo rozaria—.

# Vocabulario observado en el estudio de 2025, con sus frecuencias:
# AGENDADA (119) · REEMPLAZADA (24) · EN RESERVA 1 (19) · REAGENDADA (8).
# `EN RESERVA n` se completa con la profundidad real de las cadenas del plan,
# no con un 1 fijo: un estudio con cadenas de once necesita las once.
AULAS_LIBRO_STATUS_MUESTRA_BASE <- c("AGENDADA", "REAGENDADA", "REEMPLAZADA")

# Llamada (123) · Correo Electronico (33). El «-» observado (14) NO entra: es
# como el equipo escribe «todavia nada aqui», y el lector ya lo trata como
# ausencia. Ofrecerlo en el desplegable lo convertiria en un valor.
AULAS_LIBRO_MEDIO_CONTACTO <- c("Llamada", "Correo Electrónico", "Presencial")

AULAS_LIBRO_DIA <- c("LUN", "MAR", "MIE", "JUE", "VIE", "SAB")

AULAS_LIBRO_STATUS_APLICACION <- c("APLICADA", "NO APLICADA")

#' Las opciones de `STATUS MUESTRA` para una profundidad de cadena dada.
#'
#' @param profundidad eslabones de la cadena mas larga del plan.
#' @export
aulas_libro_status_muestra <- function(profundidad = 1L) {
  n <- max(1L, suppressWarnings(as.integer(profundidad)))
  if (!is.finite(n)) n <- 1L
  # Sin el titular: `EN RESERVA k` describe a la reserva k, y el bloque 1 es el
  # titular. Con profundidad 12 (titular + 11) salen once reservas.
  reservas <- if (n > 1L) paste("EN RESERVA", seq_len(n - 1L)) else character(0)
  c(AULAS_LIBRO_STATUS_MUESTRA_BASE, reservas)
}

# Hoja de listas: una columna por vocabulario, con su titulo en la fila 1.
.calf_hoja_listas <- function(wb, listas, hoja = "Listas") {
  openxlsx::addWorksheet(wb, hoja)
  for (i in seq_along(listas)) {
    valores <- listas[[i]]
    openxlsx::writeData(wb, hoja, c(names(listas)[[i]], valores), startCol = i, startRow = 1)
  }
  openxlsx::setColWidths(wb, hoja, cols = seq_along(listas), widths = 22)
  invisible(wb)
}

# La referencia absoluta a la columna i de la hoja de listas, sin su titulo.
.calf_rango <- function(hoja, i, n) {
  col <- openxlsx::int2col(i)
  sprintf("'%s'!$%s$2:$%s$%d", hoja, col, col, n + 1L)
}

#' Aplica el formato del libro sobre un workbook ya escrito.
#'
#' @param wb workbook de openxlsx con las tres hojas ya volcadas.
#' @param filas_cabecera cuantas filas de cabecera tiene cada hoja, por nombre.
#' @param validaciones lista de `list(hoja, cols, lista, filas)`.
#' @param listas vocabularios, en el orden de las columnas de la hoja «Listas».
#' @export
aulas_libro_aplicar_formato <- function(wb, filas_cabecera, validaciones = list(), listas = list()) {
  cabecera <- openxlsx::createStyle(
    textDecoration = "bold", fgFill = "#002457", fontColour = "#FFFFFF",
    halign = "left", valign = "center", wrapText = TRUE, border = "TopBottomLeftRight",
    borderColour = "#FFFFFF"
  )
  hojas <- names(filas_cabecera)
  if (length(listas)) .calf_hoja_listas(wb, listas)

  for (hoja in hojas) {
    n_cab <- filas_cabecera[[hoja]]
    dims <- dim(openxlsx::readWorkbook(wb, sheet = hoja, colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE))
    n_col <- if (is.null(dims)) 1L else dims[[2]]
    openxlsx::addStyle(wb, hoja, cabecera, rows = seq_len(n_cab), cols = seq_len(n_col),
                       gridExpand = TRUE, stack = TRUE)
    # El panel congela las cabeceras Y la primera columna: en una hoja de 241
    # columnas, perder de vista el `ID MATCH` es perder la fila.
    openxlsx::freezePane(wb, hoja, firstActiveRow = n_cab + 1L, firstActiveCol = 2L)
    openxlsx::setColWidths(wb, hoja, cols = seq_len(n_col), widths = 18)
    openxlsx::setColWidths(wb, hoja, cols = 1, widths = 10)
  }

  for (v in validaciones) {
    if (!length(v$cols) || !v$filas) next
    # UNA llamada por columna. Con el vector entero, `openxlsx` escribe un
    # `sqref` rectangular desde la primera hasta la ultima —medido: `P2:IB842`,
    # unas 230 columnas— y el desplegable de STATUS MUESTRA caia sobre el
    # nombre del docente, el enlace y todo lo que hay en medio. Los eslabones
    # de la cadena estan a 20 columnas de distancia: no son contiguos y no
    # pueden pedirse como un rango.
    for (col in v$cols) {
      openxlsx::dataValidation(
        wb, v$hoja, cols = col, rows = seq_len(v$filas) + v$desde,
        type = "list", value = v$rango, allowBlank = TRUE, showErrorMsg = FALSE
      )
    }
  }
  invisible(wb)
}
