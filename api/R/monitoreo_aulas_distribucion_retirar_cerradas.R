# =============================================================================
# Retirar de las semanas siguientes las clases que ya se cerraron en otra
# =============================================================================
#
# Gonzalo, 2026-09-23: «hay aulas ya aplicadas sin agenda que siguen
# apareciendo en semanas posteriores». La causa (arreglada en el generador):
# cada pestaña sólo miraba sus propios estados, así que un aula que el
# coordinador cerró en «Semana 1» se sembraba igual en «Semana 2» y «Semana 3».
# Medido ese día: 12 filas en la 2 y 17 en la 3.
#
# Arreglar el generador no las quita: una pestaña sembrada no se vuelve a
# escribir (lo manual manda). Esto retira SÓLO las filas que siguen siendo de
# la app —nadie las tocó—:
#
# - su curso-horario tiene un estado TERMINAL en cualquier otra fila del
#   documento (APLICADA, APLICADA SIN AGENDACIÓN, REAGENDADA, RECHAZADA…);
# - la fila conserva el estado que la app deduce, «POR APLICAR SIN
#   AGENDACIÓN»; y
# - no tiene aplicador.
#
# Cualquier fila que el coordinador haya tocado se queda. `ejecutar = FALSE`
# devuelve la lista sin escribir nada: es lo que se enseña antes de borrar.

.MARC_ESTADO_DE_LA_APP <- "POR APLICAR SIN AGENDACIÓN"

#' Las filas a retirar, y opcionalmente las retira.
#'
#' @param spreadsheet_id el documento de la distribución.
#' @param ejecutar `TRUE` para borrar; por defecto sólo se listan.
#' @return lista con `filas` (pestaña, fila de la hoja, código, fecha, cerrada_en)
#'   y `retiradas`.
#' @keywords internal
monitoreo_aulas_retirar_cerradas_en_otras_semanas <- function(spreadsheet_id, ejecutar = FALSE) {
  id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  meta <- .monitoreo_sheets_metadata(id)
  hojas <- lapply(meta$sheets %||% list(), function(h) list(
    titulo = .monitoreo_scalar(h$properties$title, ""),
    sheet_id = h$properties$sheetId))
  n <- length(.alpa_CABECERA)
  leidas <- lapply(hojas, function(h) tryCatch(.cads_valores_de_pestana(id, h$titulo), error = function(e) list()))
  col <- function(cab, titulo) which(cab == titulo)

  # Dónde está cerrado cada código, en todo el documento.
  cerradas <- list()
  for (i in seq_along(hojas)) {
    filas <- leidas[[i]]
    if (length(filas) < 2L) next
    cab <- .madc_valores(filas[[1L]], n)
    ic <- col(cab, "CURSO-HORARIO"); ie <- col(cab, "ESTADO"); ifc <- col(cab, "FECHA")
    if (length(ic) != 1L || length(ie) != 1L) next
    for (r in filas[-1L]) {
      v <- .madc_valores(r, n)
      if (aulas_distribucion_estado_canonico(v[[ie]]) %in% .ALPA_TERMINALES && nzchar(v[[ic]])) {
        cerradas[[v[[ic]]]] <- unique(c(cerradas[[v[[ic]]]],
          paste0(hojas[[i]]$titulo, " ", if (length(ifc) == 1L) v[[ifc]] else "")))
      }
    }
  }

  a_retirar <- list()
  for (i in seq_along(hojas)) {
    filas <- leidas[[i]]
    if (length(filas) < 2L) next
    cab <- .madc_valores(filas[[1L]], n)
    ic <- col(cab, "CURSO-HORARIO"); ie <- col(cab, "ESTADO"); ia <- col(cab, "APLICADOR")
    ifc <- col(cab, "FECHA")
    if (length(ic) != 1L || length(ie) != 1L || length(ia) != 1L) next
    for (k in seq_along(filas)[-1L]) {
      v <- .madc_valores(filas[[k]], n)
      cod <- v[[ic]]
      if (!nzchar(cod) || is.null(cerradas[[cod]])) next
      if (!identical(aulas_distribucion_estado_canonico(v[[ie]]), .MARC_ESTADO_DE_LA_APP)) next
      if (nzchar(trimws(v[[ia]]))) next
      a_retirar[[length(a_retirar) + 1L]] <- list(
        pestana = hojas[[i]]$titulo, sheet_id = hojas[[i]]$sheet_id, fila = k,
        codigo = cod, fecha = if (length(ifc) == 1L) v[[ifc]] else "",
        cerrada_en = paste(cerradas[[cod]], collapse = "; "))
    }
  }

  retiradas <- 0L
  if (isTRUE(ejecutar) && length(a_retirar)) {
    # De abajo hacia arriba en cada pestaña: borrar una fila corre las de abajo.
    orden <- order(vapply(a_retirar, function(x) as.numeric(x$sheet_id), numeric(1)),
                   -vapply(a_retirar, function(x) x$fila, numeric(1)))
    requests <- lapply(a_retirar[orden], function(x) list(deleteDimension = list(range = list(
      sheetId = x$sheet_id, dimension = "ROWS", startIndex = x$fila - 1L, endIndex = x$fila))))
    .monitoreo_sheets_batch_update(id, requests)
    retiradas <- length(requests)
  }
  list(filas = a_retirar, retiradas = retiradas)
}
