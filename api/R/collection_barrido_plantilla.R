# collection_barrido_plantilla.R — la plantilla del barrido telefónico que llena campo
# (checklist-formatos-campo C8, etapa 4 del plan conjunto; propuesta de la revisión del
# barrido del RMS 2026, §6). Dónde vive en Material (P10) está por decidir: este archivo
# sólo genera el libro; no crea campañas ni pantallas.
#
# El libro sigue las reglas de los Excel de campo del plan:
#   - Hoja «Barrido», una fila por caso: identidad (llave, Origen, Tanda, nombre,
#     teléfonos, estratos declarados) + reemplazo opcional + la COLA IDÉNTICA en todos los
#     estudios: Responsable, Status, Teléfono de la encuesta, Intentos, Fecha, Observación.
#     Las columnas que llena campo van en ámbar.
#   - Encabezados protegidos de verdad (la hoja va protegida y sólo el cuerpo queda
#     editable, hasta la última fila de la plantilla, no hasta la última usada).
#   - «Listas» con los valores permitidos; las validaciones apuntan ahí. Status lleva
#     código y clase (efectiva, pendiente, no contacto, rechazo, inválido).
#   - «Parámetros» con la meta por estrato, fuera de las fórmulas; «Léeme»; «Control»
#     oculta con el sello de la plantilla.
# Lo que Monitoreo lee hoy (llave declarada, estrato, Status, Responsable, Intentos y
# Fecha) conserva su nombre de columna.

COLLECTION_BARRIDO_PLANTILLA_VERSION <- "barrido_telefonico/v1"

.MBP_HOJA <- "Barrido"
# El correlativo interno de Pulso, primera columna en todas las bases reales (RMS, PDM, MDV, CBI).
.MBP_COD_PULSO <- "Cod pulso"
.MBP_COLA <- c("Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", "Observación")
.MBP_ORIGEN <- c("Muestra", "Backup")
.MBP_CLASES <- c("efectiva", "pendiente", "no_contacto", "rechazo", "invalido")
.MBP_FILAS_MAX <- 20000L
.MBP_FILAS_PARAMETROS <- 20L
.MBP_TELEFONOS_MAX <- 4L          # PDM llega a Teléfono 4 (T15)
.MBP_OBSERVACION <- "Observación"  # RMS la llama «Observaciones» (T13): el rótulo se configura
.MBP_ROTULO_MAX <- 30L
# Al final, después de la observación, con la instrucción en el rótulo como en RMS (T12).
.MBP_REEMPLAZO <- c("Reemplaza a", "Reemplazado por", "¿Se reemplaza con el Backup?")
.MBP_ASIGNACIONES_FILAS <- 40L

# La cola de campo con el rótulo de la observación del estudio.
.mbp_cola <- function(observacion = .MBP_OBSERVACION) c(.MBP_COLA[-length(.MBP_COLA)], observacion)

# Vocabulario por defecto: el del barrido del RMS 2026, leído de la validación de su
# Sheets el 31 oct (14 etiquetas literales, en su orden; ortografía exacta: «Número
# Incorrecto» con una r). El Sheets no trae códigos ni clases: el código es el slug de
# los outcome_values del perfil telefónico de Monitoreo y la clase es la propuesta de la
# sesión RMS (sin confirmar con ACNUR). «Efectivo» y «Rechazo» son los dos que Monitoreo
# reconoce sin reglas. El estudio puede mandar el suyo.
.MBP_STATUS <- list(
  list(codigo = "no_barrido", status = "No barrido", clase = "pendiente"),
  list(codigo = "efectivo", status = "Efectivo", clase = "efectiva"),
  list(codigo = "encuesta_parcial", status = "Encuesta parcial", clase = "pendiente"),
  list(codigo = "contactar_despues", status = "Contactar después", clase = "pendiente"),
  list(codigo = "rechazo", status = "Rechazo", clase = "rechazo"),
  list(codigo = "colgo_corto", status = "Colgó / Cortó la llamada", clase = "pendiente"),
  list(codigo = "apagado", status = "Apagado", clase = "no_contacto"),
  list(codigo = "numero_incorrecto", status = "Número Incorrecto", clase = "invalido"),
  list(codigo = "no_contesta", status = "No contesta", clase = "no_contacto"),
  list(codigo = "no_existe_numero", status = "No existe el número", clase = "invalido"),
  list(codigo = "numero_suspendido", status = "Número suspendido", clase = "invalido"),
  list(codigo = "no_efectivo", status = "No efectivo / No beneficiario", clase = "invalido"),
  list(codigo = "contactado_whatsapp", status = "Contactado por WhatsApp", clase = "pendiente"),
  list(codigo = "contactado_sms", status = "Contactado por mensaje de texto", clase = "pendiente")
)


# Escalares de un body con `.mtf_txt` (collection_territorial_formatos.R); listas, aquí.
.mbp_textos <- function(x) {
  v <- trimws(as.character(unlist(x %||% list())))
  unique(v[!is.na(v) & nzchar(v)])
}

# Parámetros validados; lo que no tiene forma es 422 con su motivo (nada se adivina).
.mbp_parametros <- function(estudio, llave, estratos, telefonos, reemplazo, responsables, status, filas,
                            observacion = NULL, sensibles = NULL) {
  problemas <- character(0)
  llave <- .mtf_txt(llave); if (!nzchar(llave)) llave <- "Código"
  estratos <- .mbp_textos(estratos)
  telefonos <- suppressWarnings(as.integer(.mtf_txt(telefonos))); if (is.na(telefonos)) telefonos <- 2L
  if (!telefonos %in% seq_len(.MBP_TELEFONOS_MAX)) problemas <- c(problemas, sprintf("Los teléfonos por caso van de 1 a %d", .MBP_TELEFONOS_MAX))
  observacion <- .mtf_txt(observacion); if (!nzchar(observacion)) observacion <- .MBP_OBSERVACION
  if (nchar(observacion) > .MBP_ROTULO_MAX) problemas <- c(problemas, sprintf("El rótulo de la observación tiene hasta %d caracteres", .MBP_ROTULO_MAX))
  filas <- suppressWarnings(as.integer(.mtf_txt(filas))); if (is.na(filas)) filas <- 2000L
  if (filas < 1L || filas > .MBP_FILAS_MAX) problemas <- c(problemas, sprintf("Las filas van de 1 a %d", .MBP_FILAS_MAX))
  responsables <- setdiff(.mbp_textos(responsables), "Responsable")  # el rótulo no es una opción (RMS)
  fijas <- c(.MBP_COD_PULSO, llave, "Origen", "Tanda", "Nombre", .mbp_cola(observacion), .MBP_REEMPLAZO)
  choque <- intersect(estratos, fijas)
  if (length(choque)) problemas <- c(problemas, sprintf("El estrato «%s» se llama como una columna fija", choque[[1]]))
  # T14: sólo una columna propia del estudio (un estrato) puede marcarse sensible.
  sensibles <- .mbp_textos(sensibles)
  ajenas <- setdiff(sensibles, estratos)
  if (length(ajenas)) problemas <- c(problemas, sprintf("«%s» no es una columna del estudio: sólo un estrato se marca sensible", ajenas[[1]]))
  catalogo <- if (is.null(status) || !length(status)) .MBP_STATUS else lapply(Filter(is.list, status), function(s) {
    list(codigo = .mtf_txt(s$codigo), status = .mtf_txt(s$status %||% s$etiqueta), clase = .mtf_txt(s$clase))
  })
  if (!length(catalogo)) problemas <- c(problemas, "El catálogo de Status está vacío")
  for (s in catalogo) {
    if (!nzchar(s$codigo) || !nzchar(s$status)) { problemas <- c(problemas, "Cada Status necesita código y etiqueta"); break }
    if (!s$clase %in% .MBP_CLASES) { problemas <- c(problemas, sprintf("La clase de «%s» no es efectiva, pendiente, no_contacto, rechazo ni invalido", s$status)); break }
  }
  etiquetas <- vapply(catalogo, `[[`, "", "status"); codigos <- vapply(catalogo, `[[`, "", "codigo")
  if (anyDuplicated(etiquetas) || anyDuplicated(codigos)) problemas <- c(problemas, "Hay un Status o un código repetido")
  if (length(problemas)) {
    stop_api(422, "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA", "La plantilla del barrido no se puede armar así.",
             details = list(problemas = as.list(problemas)))
  }
  list(estudio = .mtf_txt(estudio), llave = llave, estratos = estratos, telefonos = telefonos,
       reemplazo = isTRUE(as.logical(.mtf_txt(reemplazo))), responsables = responsables, status = catalogo, filas = filas,
       observacion = observacion, sensibles = intersect(sensibles, estratos))
}

.mbp_columnas <- function(p) {
  # Origen y Tanda sólo con backup: RMS 2025, MDV y CBI no los tienen (revisión de Drive, T7).
  identidad <- c(.MBP_COD_PULSO, p$llave, if (p$reemplazo) c("Origen", "Tanda"), "Nombre", paste("Teléfono", seq_len(p$telefonos)), p$estratos)
  reemplazo <- if (p$reemplazo) .MBP_REEMPLAZO else character(0)
  cola <- .mbp_cola(p$observacion)
  # La cola de campo contigua y el reemplazo al final (T12).
  list(todas = c(identidad, cola, reemplazo), campo = c(cola, reemplazo), identidad = identidad, cola = cola)
}

#' Genera el libro de la plantilla del barrido telefónico (C8). No toca el estado del
#' proyecto: registra el archivo en la sesión y devuelve su `file_id`.
#' @keywords internal
collection_barrido_plantilla <- function(sid, estudio = "", llave = NULL, estratos = list(), telefonos = 2L, reemplazo = FALSE,
                                         responsables = list(), status = NULL, filas = 2000L, observacion = NULL, sensibles = NULL,
                                         muestra = 0L, backup = 0L) {
  p <- .mbp_parametros(estudio, llave, estratos, telefonos, reemplazo, responsables, status, filas, observacion, sensibles)
  col <- .mbp_columnas(p)
  n <- length(col$todas); ultima <- p$filas + 1L
  idx <- function(nombre) match(nombre, col$todas)
  letra <- function(nombre) openxlsx::int2col(idx(nombre))
  wb <- openxlsx::createWorkbook()

  # --- Léeme ---
  openxlsx::addWorksheet(wb, "Léeme", gridLines = FALSE)
  leeme <- c(
    sprintf("Barrido telefónico%s", if (nzchar(p$estudio)) paste(" ·", p$estudio) else ""),
    "Una fila por caso. No cambies los encabezados de la fila 1: con ellos lee Monitoreo.",
    sprintf("«%s» es el correlativo de Pulso y «%s» la llave del caso: escríbela como texto y no la repitas.", .MBP_COD_PULSO, p$llave),
    if (p$reemplazo) "Origen es Muestra o Backup; la tanda va aparte, en «Tanda» (1, 2, 3…).",
    "La identidad del caso (de «Cod pulso» al último estrato) va protegida. Para pegar la base del cliente, desprotege la hoja (no tiene contraseña) y vuelve a protegerla.",
    sprintf("Las columnas en ámbar las llena campo: %s.", paste(col$campo, collapse = ", ")),
    if (length(p$sensibles)) sprintf("Columnas sensibles (en rojo): %s. No van al Sheets de los enumeradores, donde sólo van nombre y teléfono, ni salen en ningún artefacto.",
                                     paste(p$sensibles, collapse = ", ")),
    if (length(p$responsables)) "Cuántos casos lleva cada responsable está en «Asignaciones».",
    "Status es obligatorio en cuanto hay Intentos o Fecha: la fila se marca si falta.",
    "Los valores permitidos están en «Listas»; las metas por estrato, en «Parámetros»; el avance se calcula solo en «Indicadores».",
    "Lo que pase en el barrido y no quepa en una fila va en «Incidencias».",
    "Para filtrar usa vistas de filtro, no un filtro con orden en el libro compartido."
  )
  openxlsx::writeData(wb, "Léeme", data.frame(x = leeme), colNames = FALSE)
  openxlsx::addStyle(wb, "Léeme", openxlsx::createStyle(fontSize = 14, textDecoration = "bold", fontColour = "#002457"), rows = 1, cols = 1)
  openxlsx::setColWidths(wb, "Léeme", cols = 1, widths = 110)

  # --- Barrido ---
  openxlsx::addWorksheet(wb, .MBP_HOJA, gridLines = TRUE)
  openxlsx::writeData(wb, .MBP_HOJA, as.data.frame(as.list(stats::setNames(rep("", n), col$todas)), check.names = FALSE)[0, ],
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F", fontColour = "#FFFFFF",
                                                          border = "Bottom", wrapText = TRUE, valign = "center", locked = TRUE))
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(textDecoration = "bold", fgFill = "#B7791F", fontColour = "#FFFFFF",
                                                          border = "Bottom", wrapText = TRUE, valign = "center", locked = TRUE),
                     rows = 1, cols = match(col$campo, col$todas))
  # T14: las columnas sensibles (p. ej. «Estatus Legal») con su encabezado en rojo.
  if (length(p$sensibles)) {
    openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(textDecoration = "bold", fgFill = "#8E2424", fontColour = "#FFFFFF",
                                                            border = "Bottom", wrapText = TRUE, valign = "center", locked = TRUE),
                       rows = 1, cols = match(p$sensibles, col$todas))
  }
  cuerpo <- 2:ultima
  # La identidad queda bloqueada como en las bases reales (A–G en RMS, A–J en MDV); sólo lo de campo es editable.
  editables <- setdiff(col$todas, col$identidad)
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(locked = FALSE), rows = cuerpo, cols = idx(editables), gridExpand = TRUE)
  openxlsx::writeData(wb, .MBP_HOJA, data.frame(x = seq_len(p$filas)), startCol = idx(.MBP_COD_PULSO), startRow = 2, colNames = FALSE)
  # Con reemplazo y los casos declarados, Origen llega lleno: primero la muestra, luego el backup,
  # en el orden en que el equipo pega la base del cliente (decisión de coordinación, 1 nov 2026).
  n_muestra <- max(0L, suppressWarnings(as.integer(muestra %||% 0L))[1], na.rm = TRUE)
  n_backup <- max(0L, suppressWarnings(as.integer(backup %||% 0L))[1], na.rm = TRUE)
  if (p$reemplazo && (n_muestra + n_backup) > 0L) {
    origen <- utils::head(c(rep(.MBP_ORIGEN[[1]], n_muestra), rep(.MBP_ORIGEN[[2]], n_backup)), p$filas)
    openxlsx::writeData(wb, .MBP_HOJA, data.frame(x = origen), startCol = idx("Origen"), startRow = 2, colNames = FALSE)
  }
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(locked = FALSE, fgFill = "#FFF6D6"), rows = cuerpo,
                     cols = match(col$campo, col$todas), gridExpand = TRUE, stack = TRUE)
  texto <- c(p$llave, paste("Teléfono", seq_len(p$telefonos)), if (p$reemplazo) c("Reemplaza a", "Reemplazado por"))
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(numFmt = "@"), rows = cuerpo, cols = idx(texto), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(numFmt = "dd/mm/yyyy", locked = FALSE), rows = cuerpo, cols = idx("Fecha"), stack = TRUE)
  openxlsx::setColWidths(wb, .MBP_HOJA, cols = seq_len(n), widths = pmax(12, nchar(col$todas) + 4))
  openxlsx::setRowHeights(wb, .MBP_HOJA, rows = 1, heights = 30)
  openxlsx::freezePane(wb, .MBP_HOJA, firstRow = TRUE, firstCol = TRUE)
  openxlsx::pageSetup(wb, .MBP_HOJA, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE, printTitleRows = 1)

  # --- Listas: Status con código y clase, Origen, Responsable, Teléfono de la encuesta ---
  openxlsx::addWorksheet(wb, "Listas", gridLines = FALSE)
  st <- data.frame(Código = vapply(p$status, `[[`, "", "codigo"), Status = vapply(p$status, `[[`, "", "status"),
                   Clase = vapply(p$status, `[[`, "", "clase"), check.names = FALSE)
  cab <- openxlsx::createStyle(textDecoration = "bold", border = "Bottom")
  openxlsx::writeData(wb, "Listas", st, startCol = 1, headerStyle = cab)
  openxlsx::writeData(wb, "Listas", data.frame(Origen = .MBP_ORIGEN), startCol = 5, headerStyle = cab)
  openxlsx::writeData(wb, "Listas", data.frame(Responsable = if (length(p$responsables)) p$responsables else ""), startCol = 7, headerStyle = cab)
  tel <- paste("Teléfono", seq_len(p$telefonos))
  openxlsx::writeData(wb, "Listas", data.frame(`Teléfono de la encuesta` = tel, check.names = FALSE), startCol = 9, headerStyle = cab)
  openxlsx::setColWidths(wb, "Listas", cols = 1:9, widths = c(8, 30, 14, 3, 12, 3, 30, 3, 24))
  lista <- function(col_listas, cuantos) sprintf("'Listas'!$%s$2:$%s$%d", col_listas, col_listas, cuantos + 1L)
  valida <- function(nombre, ...) openxlsx::dataValidation(wb, .MBP_HOJA, cols = idx(nombre), rows = cuerpo, ...)
  valida("Status", type = "list", value = lista("B", nrow(st)))
  if (p$reemplazo) valida("Origen", type = "list", value = lista("E", length(.MBP_ORIGEN)))
  valida("Teléfono de la encuesta", type = "list", value = lista("I", length(tel)))
  # Sin lista de responsables la columna queda libre: una lista vacía bloquearía todo.
  if (length(p$responsables)) valida("Responsable", type = "list", value = lista("G", length(p$responsables)))
  valida("Intentos", type = "whole", operator = "greaterThanOrEqual", value = 0)
  if (p$reemplazo) valida("Tanda", type = "whole", operator = "greaterThanOrEqual", value = 1)
  valida("Fecha", type = "date", operator = "greaterThanOrEqual", value = as.Date("2020-01-01"))
  if (p$reemplazo) valida("¿Se reemplaza con el Backup?", type = "list", value = '"Sí,No"')
  # Status obligatorio si hay Intentos o Fecha: la fila se pinta en rojo suave.
  openxlsx::conditionalFormatting(wb, .MBP_HOJA, cols = idx("Status"), rows = cuerpo, type = "expression",
                                  rule = sprintf('AND($%s2="",OR($%s2<>"",$%s2<>""))', letra("Status"), letra("Intentos"), letra("Fecha")),
                                  style = openxlsx::createStyle(bgFill = "#F8D7DA"))

  # --- Parámetros: metas por estrato, fuera de las fórmulas ---
  openxlsx::addWorksheet(wb, "Parámetros", gridLines = FALSE)
  # Una fila por valor de estrato con su meta (p. ej. «Periodo de Llegada» · «Pandemia» · 70);
  # Indicadores la lee. El estrato se elige de la lista para que case con el encabezado.
  filas_par <- .MBP_FILAS_PARAMETROS
  openxlsx::writeData(wb, "Parámetros", data.frame(Estrato = c(p$estratos, rep("", filas_par - length(p$estratos))),
                                                   Valor = "", Meta = NA_integer_), headerStyle = cab)
  openxlsx::setColWidths(wb, "Parámetros", cols = 1:3, widths = c(28, 28, 10))
  if (length(p$estratos)) {
    openxlsx::writeData(wb, "Listas", data.frame(Estrato = p$estratos), startCol = 11, headerStyle = cab)
    openxlsx::dataValidation(wb, "Parámetros", cols = 1, rows = 2:(filas_par + 1L), type = "list", value = lista("K", length(p$estratos)))
  }
  openxlsx::dataValidation(wb, "Parámetros", cols = 3, rows = 2:(filas_par + 1L), type = "whole", operator = "greaterThanOrEqual", value = 0)

  # --- Indicadores: avance por estrato, Status y responsable × Status (T4), todo por fórmula ---
  .mbp_indicadores(wb, p, col, ultima, filas_par)

  # --- Asignaciones: cuántos casos lleva cada responsable (T11), por fórmula ---
  .mbp_asignaciones(wb, p, col, ultima)

  # --- Incidencias: lo que no cabe en una fila del barrido (T5) ---
  openxlsx::addWorksheet(wb, "Incidencias", gridLines = TRUE)
  openxlsx::writeData(wb, "Incidencias", data.frame(Fecha = character(0), Caso = character(0), Responsable = character(0),
                                                    Incidencia = character(0), Resolución = character(0), check.names = FALSE), headerStyle = cab)
  openxlsx::setColWidths(wb, "Incidencias", cols = 1:5, widths = c(12, 18, 24, 60, 40))
  openxlsx::addStyle(wb, "Incidencias", openxlsx::createStyle(numFmt = "dd/mm/yyyy"), rows = 2:500, cols = 1)
  openxlsx::dataValidation(wb, "Incidencias", cols = 1, rows = 2:500, type = "date", operator = "greaterThanOrEqual", value = as.Date("2020-01-01"))
  openxlsx::freezePane(wb, "Incidencias", firstRow = TRUE)

  # --- Control (oculta): sello de la plantilla ---
  openxlsx::addWorksheet(wb, "Control", visible = FALSE)
  openxlsx::writeData(wb, "Control", data.frame(
    clave = c("plantilla", "estudio", "llave", "estratos", "sensibles", "filas", "generado"),
    valor = c(COLLECTION_BARRIDO_PLANTILLA_VERSION, p$estudio, p$llave, paste(p$estratos, collapse = " | "),
              paste(p$sensibles, collapse = " | "),
              as.character(p$filas), format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  ), colNames = FALSE)

  # Encabezados de verdad protegidos: la hoja va protegida, el cuerpo queda editable y
  # se puede seguir usando vistas de filtro y formato de filas.
  openxlsx::protectWorksheet(wb, .MBP_HOJA, protect = TRUE, lockFormattingCells = FALSE, lockFormattingRows = FALSE,
                             lockAutoFilter = FALSE, lockSorting = TRUE, lockInsertingRows = FALSE)
  openxlsx::protectWorksheet(wb, "Listas", protect = TRUE)
  openxlsx::protectWorksheet(wb, "Léeme", protect = TRUE)
  openxlsx::protectWorksheet(wb, "Indicadores", protect = TRUE)
  openxlsx::protectWorksheet(wb, "Asignaciones", protect = TRUE)
  openxlsx::worksheetOrder(wb) <- match(c("Léeme", .MBP_HOJA, "Asignaciones", "Indicadores", "Incidencias", "Listas", "Parámetros", "Control"), names(wb))
  openxlsx::activeSheet(wb) <- 2L

  path <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  nombre <- .export_filename(sid, "plantilla_barrido", "xlsx")
  meta <- .register_output_file(sid, "plantilla_barrido", path, original_name = nombre)
  entregable_respuesta(list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size,
                            version = COLLECTION_BARRIDO_PLANTILLA_VERSION, columnas = as.list(col$todas),
                            sensibles = as.list(p$sensibles), status = length(p$status), filas = p$filas), meta)
}

# Asignaciones (T11): «Responsable» y «Casos asignados», como en el barrido del RMS. Con
# lista de responsables, la lista; sin ella, filas en blanco donde el equipo escribe los
# nombres (lo único editable) y la fórmula cuenta igual.
.mbp_asignaciones <- function(wb, p, col, ultima) {
  h <- "Asignaciones"
  openxlsx::addWorksheet(wb, h, gridLines = FALSE)
  l <- openxlsx::int2col(match("Responsable", col$todas))
  rango <- sprintf("'%s'!$%s$2:$%s$%d", .MBP_HOJA, l, l, ultima)
  n <- if (length(p$responsables)) length(p$responsables) else .MBP_ASIGNACIONES_FILAS
  openxlsx::writeData(wb, h, data.frame(Responsable = if (length(p$responsables)) p$responsables else rep("", n),
                                        `Casos asignados` = NA_integer_, check.names = FALSE),
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F", fontColour = "#FFFFFF", border = "Bottom"))
  for (i in seq_len(n)) {
    r <- i + 1L
    openxlsx::writeFormula(wb, h, sprintf("=IF(A%d=\"\",\"\",COUNTIF(%s,A%d))", r, rango, r), startCol = 2, startRow = r)
  }
  r_tot <- n + 3L
  openxlsx::writeData(wb, h, "Sin responsable", startRow = r_tot)
  openxlsx::writeFormula(wb, h, sprintf("=COUNTIFS('%s'!$%s$2:$%s$%d,\"<>\",%s,\"\")", .MBP_HOJA,
                                        openxlsx::int2col(match(p$llave, col$todas)), openxlsx::int2col(match(p$llave, col$todas)), ultima, rango),
                         startCol = 2, startRow = r_tot)
  if (!length(p$responsables)) {
    openxlsx::addStyle(wb, h, openxlsx::createStyle(locked = FALSE, fgFill = "#FFF6D6"), rows = 2:(n + 1L), cols = 1)
  }
  openxlsx::setColWidths(wb, h, cols = 1:2, widths = c(34, 16))
  openxlsx::freezePane(wb, h, firstRow = TRUE)
}

# Indicadores por fórmula sobre la hoja Barrido (T4): como las tablas dinámicas que el equipo
# arma a mano en las bases reales (meta y avance por perfil; responsable por Status).
.mbp_indicadores <- function(wb, p, col, ultima, filas_par) {
  h <- "Indicadores"
  openxlsx::addWorksheet(wb, h, gridLines = FALSE)
  rango <- function(nombre) {
    l <- openxlsx::int2col(match(nombre, col$todas))
    sprintf("'%s'!$%s$2:$%s$%d", .MBP_HOJA, l, l, ultima)
  }
  ancho <- openxlsx::int2col(length(col$todas))
  tabla <- sprintf("'%s'!$A$2:$%s$%d", .MBP_HOJA, ancho, ultima)
  cabecera <- sprintf("'%s'!$A$1:$%s$1", .MBP_HOJA, ancho)
  efectivos <- vapply(Filter(function(s) identical(s$clase, "efectiva"), p$status), `[[`, "", "status")
  efectivo <- if (length(efectivos)) efectivos[[1]] else p$status[[1]]$status
  titulo <- openxlsx::createStyle(fontSize = 12, textDecoration = "bold", fontColour = "#002457")
  cab <- openxlsx::createStyle(textDecoration = "bold", border = "Bottom")
  pct <- openxlsx::createStyle(numFmt = "0.0%")

  # Avance por estrato: lee las filas de Parámetros (estrato, valor, meta).
  openxlsx::writeData(wb, h, "Avance por estrato", startRow = 1)
  openxlsx::addStyle(wb, h, titulo, rows = 1, cols = 1)
  openxlsx::writeData(wb, h, data.frame(Estrato = character(0), Valor = character(0), Meta = character(0),
                                        Efectivos = character(0), Avance = character(0)), startRow = 2, headerStyle = cab)
  for (i in seq_len(filas_par)) {
    r <- i + 2L; pr <- i + 1L
    openxlsx::writeFormula(wb, h, sprintf("=IF('Parámetros'!A%d=\"\",\"\",'Parámetros'!A%d)", pr, pr), startCol = 1, startRow = r)
    openxlsx::writeFormula(wb, h, sprintf("=IF('Parámetros'!B%d=\"\",\"\",'Parámetros'!B%d)", pr, pr), startCol = 2, startRow = r)
    openxlsx::writeFormula(wb, h, sprintf("=IF('Parámetros'!C%d=\"\",\"\",'Parámetros'!C%d)", pr, pr), startCol = 3, startRow = r)
    openxlsx::writeFormula(wb, h, sprintf("=IF(OR(A%d=\"\",B%d=\"\"),\"\",COUNTIFS(INDEX(%s,0,MATCH(A%d,%s,0)),B%d,%s,\"%s\"))",
                                          r, r, tabla, r, cabecera, r, rango("Status"), efectivo), startCol = 4, startRow = r)
    openxlsx::writeFormula(wb, h, sprintf("=IF(OR(C%d=\"\",C%d=0,D%d=\"\"),\"\",D%d/C%d)", r, r, r, r, r), startCol = 5, startRow = r)
  }
  openxlsx::addStyle(wb, h, pct, rows = 3:(filas_par + 2L), cols = 5, gridExpand = TRUE)

  # Casos por Status.
  fila0 <- filas_par + 5L
  openxlsx::writeData(wb, h, "Casos por Status", startRow = fila0)
  openxlsx::addStyle(wb, h, titulo, rows = fila0, cols = 1)
  openxlsx::writeData(wb, h, data.frame(Status = character(0), Clase = character(0), Casos = character(0)), startRow = fila0 + 1L, headerStyle = cab)
  for (i in seq_along(p$status)) {
    r <- fila0 + 1L + i
    openxlsx::writeData(wb, h, data.frame(a = p$status[[i]]$status, b = p$status[[i]]$clase), startRow = r, colNames = FALSE)
    openxlsx::writeFormula(wb, h, sprintf("=COUNTIF(%s,A%d)", rango("Status"), r), startCol = 3, startRow = r)
  }
  # Casos con llave (el «Cod pulso» viene prellenado aun en filas vacías) y sin Status.
  r_sin <- fila0 + 2L + length(p$status)
  openxlsx::writeData(wb, h, "Sin Status", startRow = r_sin)
  openxlsx::writeFormula(wb, h, sprintf("=COUNTIFS(%s,\"<>\",%s,\"\")", rango(p$llave), rango("Status")), startCol = 3, startRow = r_sin)

  # Responsable × Status (sólo con lista de responsables).
  if (length(p$responsables)) {
    fila1 <- r_sin + 3L
    openxlsx::writeData(wb, h, "Responsable por Status", startRow = fila1)
    openxlsx::addStyle(wb, h, titulo, rows = fila1, cols = 1)
    etiquetas <- vapply(p$status, `[[`, "", "status")
    openxlsx::writeData(wb, h, as.data.frame(as.list(stats::setNames(rep("", length(etiquetas) + 1L), c("Responsable", etiquetas))),
                                             check.names = FALSE)[0, ], startRow = fila1 + 1L, headerStyle = cab)
    for (i in seq_along(p$responsables)) {
      r <- fila1 + 1L + i
      openxlsx::writeData(wb, h, p$responsables[[i]], startRow = r)
      for (j in seq_along(etiquetas)) {
        openxlsx::writeFormula(wb, h, sprintf("=COUNTIFS(%s,$A%d,%s,\"%s\")", rango("Responsable"), r, rango("Status"), etiquetas[[j]]),
                               startCol = j + 1L, startRow = r)
      }
    }
  }
  openxlsx::setColWidths(wb, h, cols = 1:5, widths = c(30, 28, 12, 12, 12))
}
