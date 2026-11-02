# collection_territorial_excel_cuotas.R — el Excel de asignación de un territorial por cuotas
# (ADR 0125 §2; contrato contratos-material-por-tipo-2026-11-02.md §1).
#
# En cuotas no hay manzanas sorteadas: Hojas de ruta envía ZONAS con su N y su cuota por
# celda (sexo × rango de edad). El Excel es encuestador ↔ zona: una fila por zona, con su
# cuota a la vista y el mismo desplegable de la lista de Monitoreo que el de UMP. Se lee de
# vuelta con `collection_territorial_asignacion_importar()` (columna «Código de zona») y lo
# guarda el PUT de collection_territorial_asignacion.R, como en UMP.

.MTX_CUOTAS_COLUMNAS_FIJAS_INICIO <- c("Zona", "Código de zona", "Entrevistas")
.MTX_CUOTAS_COLUMNAS_FIJAS_FIN <- c("Encuestador", "Fecha de salida", "Fecha de retorno", "Estado", "Observaciones")

# Las celdas de cuota en el orden en que llegan (sexo y rango, como la matriz de Población).
.mtx_cuotas_celdas <- function(zonas) {
  celdas <- character(0)
  for (z in zonas) for (c in z$cuotas %||% list()) {
    rotulo <- trimws(paste(c$sexo, if (nzchar(c$rango_edad %||% "")) c$rango_edad else c$rango_id, sep = " · "))
    if (!rotulo %in% celdas) celdas <- c(celdas, rotulo)
  }
  celdas
}

.mtx_asignacion_excel_cuotas <- function(sid, ctx) {
  equipo <- ctx$eq$equipo
  etiquetas <- vapply(equipo, .mtx_etiqueta, "")
  etiqueta_de <- stats::setNames(etiquetas, vapply(equipo, `[[`, "", "codigo"))
  actual <- collection_territorial_asignacion_get(sid, ctx$hit$entry$id)
  codigo_de <- stats::setNames(vapply(actual$asignacion, `[[`, "", "codigo"), vapply(actual$asignacion, `[[`, "", "id_manzana"))
  zonas <- ctx$unidades
  celdas <- .mtx_cuotas_celdas(zonas)

  filas <- lapply(zonas, function(z) {
    cod <- unname(codigo_de[z$unit_id])
    enc <- if (is.na(cod)) "" else unname(etiqueta_de[cod])
    if (!is.na(cod) && is.na(enc)) enc <- cod  # código que ya no está en la lista: se escribe tal cual
    cuota <- stats::setNames(rep(NA_integer_, length(celdas)), celdas)
    for (c in z$cuotas) {
      k <- trimws(paste(c$sexo, if (nzchar(c$rango_edad %||% "")) c$rango_edad else c$rango_id, sep = " · "))
      cuota[[k]] <- c$n
    }
    cbind(
      data.frame(Zona = z$label, `Código de zona` = z$unit_id, Entrevistas = z$n, check.names = FALSE, stringsAsFactors = FALSE),
      as.data.frame(as.list(cuota), check.names = FALSE),
      data.frame(Encuestador = if (is.na(enc)) "" else enc, `Fecha de salida` = "", `Fecha de retorno` = "",
                 Estado = "Pendiente", Observaciones = "", check.names = FALSE, stringsAsFactors = FALSE)
    )
  })
  tabla <- do.call(rbind, filas)
  columnas <- names(tabla)
  n <- nrow(tabla)
  primera <- .MTX_FILA_CABECERA + 1L
  ultima <- .MTX_FILA_CABECERA + n
  col_enc <- match("Encuestador", columnas)
  cols_cuota <- match(celdas, columnas)

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, .MTX_HOJA, gridLines = FALSE)
  openxlsx::writeData(wb, .MTX_HOJA, sprintf("Asignación de zonas a encuestadores · %s", ctx$hit$entry$name), startRow = 1)
  openxlsx::writeData(wb, .MTX_HOJA, paste(
    "Elige en «Encuestador» quién trabaja cada zona; las columnas de sexo y edad son la cuota que hay que cubrir en ella.",
    "Para reasignar, cambia el encuestador y vuelve a subir el archivo en Material de campo.",
    "No cambies «Código de zona»: con ella la app lee este archivo."
  ), startRow = 2)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fontSize = 14, textDecoration = "bold"), rows = 1, cols = 1)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fontSize = 10, fontColour = "#5B6573", wrapText = TRUE), rows = 2, cols = 1)
  openxlsx::mergeCells(wb, .MTX_HOJA, cols = seq_along(columnas), rows = 2)
  openxlsx::setRowHeights(wb, .MTX_HOJA, rows = 2, heights = 32)
  openxlsx::writeData(wb, .MTX_HOJA, tabla, startRow = .MTX_FILA_CABECERA,
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F", fontColour = "#FFFFFF",
                                                          border = "Bottom", wrapText = TRUE, valign = "center"))
  if (length(cols_cuota)) {
    openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fgFill = "#E8F0FB", halign = "center"),
                       rows = primera:ultima, cols = cols_cuota, gridExpand = TRUE, stack = TRUE)
  }
  # El total de la fila es la suma de sus cuotas, para que campo lo vea cuadrar.
  openxlsx::writeData(wb, .MTX_HOJA, "Total", startCol = 1, startRow = ultima + 1L)
  for (k in c(match("Entrevistas", columnas), cols_cuota)) {
    letra <- openxlsx::int2col(k)
    openxlsx::writeFormula(wb, .MTX_HOJA, sprintf("SUM(%s%d:%s%d)", letra, primera, letra, ultima), startCol = k, startRow = ultima + 1L)
  }
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(textDecoration = "bold", border = "Top"),
                     rows = ultima + 1L, cols = seq_along(columnas), stack = TRUE)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(numFmt = "@"), rows = primera:ultima, cols = match("Código de zona", columnas), stack = TRUE)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(numFmt = "dd/mm/yyyy"), rows = primera:ultima,
                     cols = match(c("Fecha de salida", "Fecha de retorno"), columnas), gridExpand = TRUE, stack = TRUE)
  openxlsx::setColWidths(wb, .MTX_HOJA, cols = seq_along(columnas),
                         widths = c(24, 14, 12, rep(11, length(celdas)), 34, 13, 13, 12, 36))
  openxlsx::freezePane(wb, .MTX_HOJA, firstActiveRow = primera, firstActiveCol = 3L)
  openxlsx::addFilter(wb, .MTX_HOJA, rows = .MTX_FILA_CABECERA, cols = seq_along(columnas))
  openxlsx::pageSetup(wb, .MTX_HOJA, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE,
                      printTitleRows = .MTX_FILA_CABECERA)

  # La lista de Monitoreo: el desplegable, cuántas zonas y cuántas entrevistas lleva cada uno.
  openxlsx::addWorksheet(wb, .MTX_HOJA_EQUIPO, gridLines = FALSE)
  openxlsx::writeData(wb, .MTX_HOJA_EQUIPO, data.frame(Código = names(etiqueta_de), Nombre = vapply(equipo, `[[`, "", "nombre"),
                                                       `Como aparece en la lista` = unname(etiquetas), check.names = FALSE),
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", border = "Bottom"))
  enc_l <- openxlsx::int2col(col_enc)
  ent_l <- openxlsx::int2col(match("Entrevistas", columnas))
  openxlsx::writeData(wb, .MTX_HOJA_EQUIPO, data.frame(a = "Zonas asignadas", b = "Entrevistas"), startCol = 4, startRow = 1, colNames = FALSE)
  openxlsx::addStyle(wb, .MTX_HOJA_EQUIPO, openxlsx::createStyle(textDecoration = "bold", border = "Bottom"), rows = 1, cols = 4:5, gridExpand = TRUE)
  for (i in seq_along(etiquetas)) {
    rango_enc <- sprintf("'%s'!$%s$%d:$%s$%d", .MTX_HOJA, enc_l, primera, enc_l, ultima)
    openxlsx::writeFormula(wb, .MTX_HOJA_EQUIPO, sprintf("COUNTIF(%s,C%d)", rango_enc, i + 1L), startCol = 4, startRow = i + 1L)
    openxlsx::writeFormula(wb, .MTX_HOJA_EQUIPO, sprintf("SUMIF(%s,C%d,'%s'!$%s$%d:$%s$%d)", rango_enc, i + 1L, .MTX_HOJA, ent_l, primera, ent_l, ultima),
                           startCol = 5, startRow = i + 1L)
  }
  openxlsx::setColWidths(wb, .MTX_HOJA_EQUIPO, cols = 1:5, widths = c(10, 34, 40, 16, 13))
  openxlsx::dataValidation(wb, .MTX_HOJA, cols = col_enc, rows = primera:ultima, type = "list",
                           value = sprintf("'%s'!$C$2:$C$%d", .MTX_HOJA_EQUIPO, length(etiquetas) + 1L))
  openxlsx::writeData(wb, .MTX_HOJA, data.frame(e = .MTX_ESTADOS), startCol = 30, startRow = 1, colNames = FALSE)
  openxlsx::setColWidths(wb, .MTX_HOJA, cols = 30, widths = 0, hidden = TRUE)
  openxlsx::dataValidation(wb, .MTX_HOJA, cols = match("Estado", columnas), rows = primera:ultima, type = "list",
                           value = sprintf("$AD$1:$AD$%d", length(.MTX_ESTADOS)))

  openxlsx::addWorksheet(wb, .MTX_HOJA_CONTROL, visible = FALSE)
  openxlsx::writeData(wb, .MTX_HOJA_CONTROL, data.frame(
    clave = c("campaign_id", "fase", "sample_fingerprint", "generado", "kind"),
    valor = c(ctx$hit$entry$id, ctx$fase, ctx$envio$sample_fingerprint, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"), "cuotas")
  ), colNames = FALSE)

  path <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  nombre <- .export_filename(sid, "asignacion_encuestadores", "xlsx")
  meta <- .register_output_file(sid, "asignacion_encuestadores", path, original_name = nombre)
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, kind = "cuotas", zonas = n, umps = 0L,
       entrevistas = as.integer(sum(tabla$Entrevistas, na.rm = TRUE)),
       encuestadores = length(equipo), asignadas = length(actual$asignacion), hojas_registro = list(), variante = NA_character_)
}
