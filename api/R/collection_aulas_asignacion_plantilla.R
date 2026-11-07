# collection_aulas_asignacion_plantilla.R — la planilla inicial de aplicadores (R7 del mapa
# de responsabilidades, 2 nov 2026).
#
# Gonzalo: Material de campo son los «imprimibles y excel que campo llena como asignaciones,
# las llena al inicio para que se usen en campo pero no les da seguimiento». Esta es esa
# planilla: cada aula titular de la entrega con una columna «Aplicador» que el coordinador
# llena al empezar, eligiendo de la lista del equipo.
#
# No es el reparto de Monitoreo. Ése se rehace cada día sobre la agenda en vivo (tramos,
# equidad, fijaciones del Sheets de distribución) y es control del operativo: se queda allá.
# Aquí no hay agenda, fechas ni sorteo. Por eso sólo titulares: una reserva se asigna el día
# que su titular cae, y eso ya es seguimiento.

#' La planilla inicial de asignación de aplicadores, lista para llenar.
#'
#' @param path destino `.xlsx`.
#' @param unidades filas de la entrega de Material (`collection_aulas_entrega_get()$unidades`).
#' @param aplicadores nombres del equipo, para el desplegable de la columna «Aplicador».
#' @return lista con `path`, `aulas` (titulares escritas) y `aplicadores`, invisible.
#' @keywords internal
aulas_asignacion_plantilla <- function(path, unidades, aplicadores = character(0)) {
  txt <- function(x) { v <- as.character(x %||% "")[1]; if (is.na(v)) "" else trimws(v) }
  titulares <- Filter(function(u) is.list(u) && identical(tolower(txt(u[["sample_role"]])), "titular"), unidades %||% list())
  filas <- data.frame(
    `Código` = vapply(titulares, function(u) { c <- txt(u[["operational_code"]]); if (nzchar(c)) c else txt(u[["label"]]) }, ""),
    Facultad = vapply(titulares, function(u) txt(u[["faculty"]]), ""),
    Curso = vapply(titulares, function(u) txt(u[["course_name"]]), ""),
    Docente = vapply(titulares, function(u) txt(u[["teacher"]]), ""),
    Horario = vapply(titulares, function(u) txt(u[["schedule"]]), ""),
    Elegibles = vapply(titulares, function(u) suppressWarnings(as.integer(u[["eligible_n"]] %||% NA))[1], 0L),
    Aplicador = rep("", length(titulares)),
    `Observación` = rep("", length(titulares)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  nombres <- unique(trimws(as.character(aplicadores)))
  nombres <- nombres[!is.na(nombres) & nzchar(nombres)]

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Asignación")
  openxlsx::writeData(wb, "Asignación", filas, startRow = 1, colNames = TRUE)
  cab <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E7EEF9", border = "bottom",
                               borderColour = "#C9BEB8", valign = "bottom", fontSize = 10)
  openxlsx::addStyle(wb, "Asignación", cab, rows = 1, cols = seq_len(ncol(filas)), gridExpand = TRUE)
  # Las dos columnas que llena campo, en otro tono: el resto lo trae la entrega.
  openxlsx::addStyle(wb, "Asignación", openxlsx::createStyle(textDecoration = "bold", fgFill = "#FFF4D6",
                                                             border = "bottom", borderColour = "#C9BEB8"),
                     rows = 1, cols = 7:8, gridExpand = TRUE)
  openxlsx::setColWidths(wb, "Asignación", cols = seq_len(ncol(filas)), widths = c(12, 28, 34, 26, 18, 10, 26, 30))
  # Impresa, la columna que se llena necesita renglón: borde fino en las dos de campo.
  if (nrow(filas)) {
    openxlsx::addStyle(wb, "Asignación", openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "#C9BEB8"),
                       rows = 2:(nrow(filas) + 1L), cols = 7:8, gridExpand = TRUE)
    # Y alto para escribir a mano: el renglón por defecto es para teclear.
    openxlsx::setRowHeights(wb, "Asignación", rows = 2:(nrow(filas) + 1L), heights = 22)
  }
  openxlsx::freezePane(wb, "Asignación", firstRow = TRUE)
  # Se imprime y se lleva a campo: apaisada y a una página de ancho. En vertical sólo cabían
  # tres columnas y «Aplicador», la que se llena, salía en otra hoja (medido al renderizar).
  openxlsx::pageSetup(wb, "Asignación", orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE,
                      printTitleRows = 1)

  # La lista del equipo en su propia hoja, y el desplegable apunta ahí: escribir el nombre a
  # mano deja «Ana M.» y «Ana María» como dos aplicadores.
  openxlsx::addWorksheet(wb, "Equipo")
  openxlsx::writeData(wb, "Equipo", data.frame(Aplicador = nombres, stringsAsFactors = FALSE), colNames = TRUE)
  openxlsx::setColWidths(wb, "Equipo", cols = 1, widths = 34)
  if (length(nombres) && nrow(filas)) {
    openxlsx::dataValidation(wb, "Asignación", cols = 7, rows = 2:(nrow(filas) + 1L), type = "list",
                             value = sprintf("'Equipo'!$A$2:$A$%d", length(nombres) + 1L))
  }

  openxlsx::addWorksheet(wb, "Instrucciones")
  openxlsx::writeData(wb, "Instrucciones", data.frame(Instrucciones = c(
    "Una fila por aula titular de la entrega de Material.",
    "Llena «Aplicador» (elige de la lista de la hoja Equipo) y, si hace falta, «Observación».",
    "Es la asignación con la que campo empieza. Los reemplazos se asignan el día que su titular cae.",
    "El reparto de cada día y su seguimiento los lleva Monitoreo."
  ), stringsAsFactors = FALSE), colNames = TRUE)
  openxlsx::setColWidths(wb, "Instrucciones", cols = 1, widths = 100)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(list(path = path, aulas = nrow(filas), aplicadores = length(nombres)))
}
