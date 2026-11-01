# =============================================================================
# Planner › Equipo en Excel (figura vg-planner del plan maestro)
# =============================================================================
#
# La plantilla trae la lista vigente del equipo (declarada o proyectada) con
# desplegables de rol y estado; el coordinador la llena fuera de la app y la
# sube. Leerla es puro: devuelve las personas y lo que no se entendió, y la UI
# las carga para revisar. Guarda el PUT /api/planner/equipo, con su validación.
#
# Los datos personales son los mismos que ya guarda `planner$equipo$personas`
# (código y nombre): la plantilla no pide DNI, teléfono ni correo.

.PEX_HOJA <- "Equipo"
.PEX_HOJA_LISTAS <- "Listas"
.PEX_COLUMNAS <- c("Código", "Nombre", "Rol", "Perfiles", "Activo")
.PEX_FILA_CABECERA <- 3L
.PEX_FILAS_LIBRES <- 60L
.PEX_ROL <- c(encuestador = "Encuestador", aplicador = "Aplicador", supervisor = "Supervisor", operador = "Operador")
.PEX_PERFIL <- c(territorial = "Territorial presencial", aulas = "Aulas universitarias",
                 telefonico = "Telefónico", acreditacion = "Acreditación")

.pex_norm <- function(x) {
  x <- tolower(trimws(as.character(x %||% "")))
  x <- iconv(x, to = "ASCII//TRANSLIT")
  gsub("[^a-z0-9]+", "", x %||% "")
}

#' Plantilla del equipo con la lista vigente. Lectura pura del Planner.
#' @keywords internal
.planner_equipo_excel <- function(sid) {
  p <- .planner_payload(session_get(sid))
  personas <- p$planner$equipo$personas
  tipos <- vapply(p$planner$perfiles, `[[`, "", "tipo")
  txt <- function(x) if (is.null(x) || !length(x) || is.na(x[[1]])) "" else as.character(x[[1]])
  tabla <- data.frame(
    Código = vapply(personas, function(x) txt(x$codigo), ""),
    Nombre = vapply(personas, function(x) txt(x$nombre), ""),
    Rol = vapply(personas, function(x) unname(.PEX_ROL[txt(x$rol)]) %||% "Encuestador", ""),
    Perfiles = vapply(personas, function(x) paste(unname(.PEX_PERFIL[unlist(x$perfiles)]), collapse = ", "), ""),
    Activo = vapply(personas, function(x) if (isFALSE(x$activo)) "No" else "Sí", ""),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  primera <- .PEX_FILA_CABECERA + 1L
  ultima <- .PEX_FILA_CABECERA + nrow(tabla) + .PEX_FILAS_LIBRES

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, .PEX_HOJA, gridLines = FALSE)
  openxlsx::writeData(wb, .PEX_HOJA, "Equipo de campo", startRow = 1)
  openxlsx::writeData(wb, .PEX_HOJA, paste(
    "Una fila por persona. El código es con el que la reconocen Material y Monitoreo; el nombre, como debe salir impreso.",
    if (length(tipos) > 1L) "En «Perfiles», los perfiles separados por comas." else "Si dejas «Perfiles» vacío, va al perfil del estudio.",
    "Súbelo en Planner › Equipo: la app te lo muestra para revisar antes de guardar."
  ), startRow = 2)
  openxlsx::addStyle(wb, .PEX_HOJA, openxlsx::createStyle(fontSize = 14, textDecoration = "bold"), rows = 1, cols = 1)
  openxlsx::addStyle(wb, .PEX_HOJA, openxlsx::createStyle(fontSize = 10, fontColour = "#5B6573", wrapText = TRUE), rows = 2, cols = 1)
  openxlsx::mergeCells(wb, .PEX_HOJA, cols = seq_along(.PEX_COLUMNAS), rows = 2)
  openxlsx::setRowHeights(wb, .PEX_HOJA, rows = 2, heights = 32)
  openxlsx::writeData(wb, .PEX_HOJA, tabla, startRow = .PEX_FILA_CABECERA,
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F", fontColour = "#FFFFFF",
                                                          border = "Bottom", valign = "center"))
  openxlsx::addStyle(wb, .PEX_HOJA, openxlsx::createStyle(numFmt = "@"), rows = primera:ultima, cols = 1, stack = TRUE)
  openxlsx::setColWidths(wb, .PEX_HOJA, cols = seq_along(.PEX_COLUMNAS), widths = c(12, 38, 16, 34, 10))
  openxlsx::freezePane(wb, .PEX_HOJA, firstActiveRow = primera)

  # Las listas de los desplegables, en una hoja aparte.
  openxlsx::addWorksheet(wb, .PEX_HOJA_LISTAS, gridLines = FALSE)
  perfiles_estudio <- unname(.PEX_PERFIL[if (length(tipos)) tipos else names(.PEX_PERFIL)])
  openxlsx::writeData(wb, .PEX_HOJA_LISTAS, data.frame(Rol = unname(.PEX_ROL)), startCol = 1)
  openxlsx::writeData(wb, .PEX_HOJA_LISTAS, data.frame(Activo = c("Sí", "No")), startCol = 2)
  openxlsx::writeData(wb, .PEX_HOJA_LISTAS, data.frame(Perfiles = perfiles_estudio), startCol = 3)
  openxlsx::dataValidation(wb, .PEX_HOJA, cols = 3, rows = primera:ultima, type = "list",
                           value = sprintf("'%s'!$A$2:$A$%d", .PEX_HOJA_LISTAS, length(.PEX_ROL) + 1L))
  openxlsx::dataValidation(wb, .PEX_HOJA, cols = 5, rows = primera:ultima, type = "list",
                           value = sprintf("'%s'!$B$2:$B$3", .PEX_HOJA_LISTAS))
  # Un solo perfil: desplegable. Varios: texto libre separado por comas (un desplegable no deja elegir dos).
  if (length(perfiles_estudio) == 1L) {
    openxlsx::dataValidation(wb, .PEX_HOJA, cols = 4, rows = primera:ultima, type = "list",
                             value = sprintf("'%s'!$C$2:$C$2", .PEX_HOJA_LISTAS))
  }

  path <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  nombre <- .export_filename(sid, "equipo_de_campo", "xlsx")
  meta <- .register_output_file(sid, "equipo_de_campo", path, original_name = nombre)
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, personas = nrow(tabla))
}

# La tabla de la hoja «Equipo» (o de la primera hoja), desde la fila cuya
# cabecera trae «Nombre». Lo que no tiene esa cabecera no es la plantilla.
.pex_leer_tabla <- function(path) {
  hojas <- openxlsx::getSheetNames(path)
  hoja <- if (.PEX_HOJA %in% hojas) .PEX_HOJA else hojas[[1]]
  crudo <- openxlsx::read.xlsx(path, sheet = hoja, colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  if (!is.data.frame(crudo) || !nrow(crudo)) return(NULL)
  for (r in seq_len(min(nrow(crudo), 15L))) {
    cab <- vapply(crudo[r, ], function(x) .pex_norm(x), "")
    if ("nombre" %in% cab) {
      col <- function(...) { i <- which(cab %in% c(...)); if (length(i)) i[[1]] else NA_integer_ }
      return(list(fila0 = r, cuerpo = crudo[-seq_len(r), , drop = FALSE],
                  codigo = col("codigo", "cod"), nombre = col("nombre"), rol = col("rol"),
                  perfiles = col("perfiles", "perfil"), activo = col("activo", "estado")))
    }
  }
  NULL
}

#' Lee una plantilla del equipo llenada. Puro: no escribe en la sesión.
#' @keywords internal
.planner_equipo_importar <- function(sid, file_raw = NULL, content_base64 = NULL) {
  if (is.null(file_raw) && length(content_base64) && nzchar(content_base64[[1]])) {
    file_raw <- tryCatch(jsonlite::base64_dec(content_base64[[1]]), error = function(e) NULL)
  }
  if (!is.raw(file_raw) || !length(file_raw)) .planner_invalido("Falta el archivo de Excel del equipo.")
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  writeBin(file_raw, path)
  t <- tryCatch(.pex_leer_tabla(path), error = function(e) NULL)
  if (is.null(t)) .planner_invalido("No encuentro la columna «Nombre»: sube la plantilla del equipo que descargaste aquí.")

  tipos <- vapply(.planner_payload(session_get(sid))$planner$perfiles, `[[`, "", "tipo")
  roles <- stats::setNames(names(.PEX_ROL), .pex_norm(.PEX_ROL))
  roles[.pex_norm(names(.PEX_ROL))] <- names(.PEX_ROL)
  perfiles <- stats::setNames(names(.PEX_PERFIL), .pex_norm(.PEX_PERFIL))
  perfiles[.pex_norm(names(.PEX_PERFIL))] <- names(.PEX_PERFIL)
  celda <- function(i, j) {
    if (is.na(j)) return("")
    v <- t$cuerpo[i, j]
    if (is.null(v) || is.na(v)) "" else trimws(as.character(v))
  }
  personas <- list(); problemas <- list(); vistos <- character(0)
  problema <- function(fila, motivo) problemas[[length(problemas) + 1L]] <<- list(fila = fila, motivo = motivo)
  for (i in seq_len(nrow(t$cuerpo))) {
    fila <- t$fila0 + i
    codigo <- celda(i, t$codigo)
    nombre <- celda(i, t$nombre)
    if (!nzchar(codigo) && !nzchar(nombre)) next
    if (!nzchar(nombre)) { problema(fila, sprintf("El código %s no tiene nombre; no se lee.", codigo)); next }
    if (nzchar(codigo) && codigo %in% vistos) {
      problema(fila, sprintf("El código %s aparece dos veces; vale la primera.", codigo)); next
    }
    if (length(personas) >= PLANNER_MAX_PERSONAS) {
      problema(fila, sprintf("El equipo admite hasta %d personas; desde aquí no se lee.", PLANNER_MAX_PERSONAS)); break
    }
    rol_txt <- celda(i, t$rol)
    rol <- unname(roles[.pex_norm(rol_txt)])
    if (!nzchar(rol_txt)) rol <- "encuestador"
    if (is.na(rol)) { problema(fila, sprintf("«%s» no es un rol; queda como encuestador.", rol_txt)); rol <- "encuestador" }
    pedidos <- trimws(strsplit(celda(i, t$perfiles), "[,;/]")[[1]])
    pedidos <- pedidos[nzchar(pedidos)]
    sus <- unname(perfiles[.pex_norm(pedidos)])
    if (any(is.na(sus))) problema(fila, sprintf("«%s» no es un perfil; se ignora.", paste(pedidos[is.na(sus)], collapse = ", ")))
    sus <- unique(sus[!is.na(sus)])
    fuera <- setdiff(sus, tipos)
    if (length(fuera) && length(tipos)) {
      problema(fila, sprintf("El estudio no declara %s; se ignora.", paste(.PEX_PERFIL[fuera], collapse = ", ")))
      sus <- intersect(sus, tipos)
    }
    if (!length(sus) && length(tipos) == 1L) sus <- tipos
    activo <- .pex_norm(celda(i, t$activo))
    vistos <- c(vistos, codigo[nzchar(codigo)])
    personas[[length(personas) + 1L]] <- list(codigo = codigo, nombre = nombre, rol = rol, perfiles = as.list(sus),
                                              activo = !activo %in% c("no", "baja", "inactivo", "false", "0"))
  }
  list(ok = TRUE, personas = personas, problemas = problemas, filas = nrow(t$cuerpo))
}

.planner_import_request <- function(req) {
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (grepl("multipart/form-data", ctype, fixed = TRUE)) {
    parts <- tryCatch(parse_multipart_upload(req), error = function(e) NULL)
    part <- if (is.list(parts)) parts[["file"]] else NULL
    return(list(file_raw = if (is.list(part) && is.raw(part$value)) part$value else NULL))
  }
  list(content_base64 = .planner_parse_body(req)[["content_base64"]])
}
