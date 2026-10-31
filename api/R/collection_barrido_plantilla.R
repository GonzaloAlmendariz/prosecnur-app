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
#     código corto y clase (efectivo, en gestión, reintentable, terminal).
#   - «Parámetros» con la meta por estrato, fuera de las fórmulas; «Léeme»; «Control»
#     oculta con el sello de la plantilla.
# Lo que Monitoreo lee hoy (llave declarada, estrato, Status, Responsable, Intentos y
# Fecha) conserva su nombre de columna.

COLLECTION_BARRIDO_PLANTILLA_VERSION <- "barrido_telefonico/v1"

.MBP_HOJA <- "Barrido"
.MBP_COLA <- c("Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", "Observación")
.MBP_ORIGEN <- c("Muestra", "Backup")
.MBP_CLASES <- c("efectivo", "en_gestion", "reintentable", "terminal")
.MBP_FILAS_MAX <- 20000L

# Vocabulario por defecto: «Efectivo» y «Rechazo» con su nombre literal, porque son los
# dos que Monitoreo reconoce sin reglas; el estudio puede mandar el suyo.
.MBP_STATUS <- list(
  list(codigo = "EF", status = "Efectivo", clase = "efectivo"),
  list(codigo = "EP", status = "Encuesta parcial", clase = "en_gestion"),
  list(codigo = "AG", status = "Agendado", clase = "en_gestion"),
  list(codigo = "NB", status = "No barrido", clase = "en_gestion"),
  list(codigo = "NC", status = "No contesta", clase = "reintentable"),
  list(codigo = "AP", status = "Apagado", clase = "reintentable"),
  list(codigo = "OC", status = "Ocupado", clase = "reintentable"),
  list(codigo = "BV", status = "Buzón de voz", clase = "reintentable"),
  list(codigo = "CC", status = "Colgó", clase = "reintentable"),
  list(codigo = "RE", status = "Rechazo", clase = "terminal"),
  list(codigo = "NI", status = "Número incorrecto", clase = "terminal"),
  list(codigo = "FS", status = "Fuera de servicio", clase = "terminal"),
  list(codigo = "NE", status = "No elegible", clase = "terminal"),
  list(codigo = "ND", status = "No disponible en el periodo", clase = "terminal")
)

.mbp_txt <- function(x) {
  v <- if (is.null(x) || !length(x)) "" else as.character(unlist(x)[1])
  if (is.na(v)) "" else trimws(v)
}

.mbp_textos <- function(x) {
  v <- trimws(as.character(unlist(x %||% list())))
  unique(v[!is.na(v) & nzchar(v)])
}

# Parámetros validados; lo que no tiene forma es 422 con su motivo (nada se adivina).
.mbp_parametros <- function(estudio, llave, estratos, telefonos, reemplazo, responsables, status, filas) {
  problemas <- character(0)
  llave <- .mbp_txt(llave); if (!nzchar(llave)) llave <- "Código"
  estratos <- .mbp_textos(estratos)
  telefonos <- suppressWarnings(as.integer(.mbp_txt(telefonos))); if (is.na(telefonos)) telefonos <- 2L
  if (!telefonos %in% 1:3) problemas <- c(problemas, "Los teléfonos por caso van de 1 a 3")
  filas <- suppressWarnings(as.integer(.mbp_txt(filas))); if (is.na(filas)) filas <- 2000L
  if (filas < 1L || filas > .MBP_FILAS_MAX) problemas <- c(problemas, sprintf("Las filas van de 1 a %d", .MBP_FILAS_MAX))
  responsables <- setdiff(.mbp_textos(responsables), "Responsable")  # el rótulo no es una opción (RMS)
  fijas <- c(llave, "Origen", "Tanda", "Nombre", .MBP_COLA)
  choque <- intersect(estratos, fijas)
  if (length(choque)) problemas <- c(problemas, sprintf("El estrato «%s» se llama como una columna fija", choque[[1]]))
  catalogo <- if (is.null(status) || !length(status)) .MBP_STATUS else lapply(Filter(is.list, status), function(s) {
    list(codigo = toupper(.mbp_txt(s$codigo)), status = .mbp_txt(s$status %||% s$etiqueta), clase = .mbp_txt(s$clase))
  })
  if (!length(catalogo)) problemas <- c(problemas, "El catálogo de Status está vacío")
  for (s in catalogo) {
    if (!nzchar(s$codigo) || !nzchar(s$status)) { problemas <- c(problemas, "Cada Status necesita código y etiqueta"); break }
    if (!s$clase %in% .MBP_CLASES) { problemas <- c(problemas, sprintf("La clase de «%s» no es efectivo, en_gestion, reintentable ni terminal", s$status)); break }
  }
  etiquetas <- vapply(catalogo, `[[`, "", "status"); codigos <- vapply(catalogo, `[[`, "", "codigo")
  if (anyDuplicated(etiquetas) || anyDuplicated(codigos)) problemas <- c(problemas, "Hay un Status o un código repetido")
  if (length(problemas)) {
    stop_api(422, "E_COLLECTION_BARRIDO_PLANTILLA_INVALIDA", "La plantilla del barrido no se puede armar así.",
             details = list(problemas = as.list(problemas)))
  }
  list(estudio = .mbp_txt(estudio), llave = llave, estratos = estratos, telefonos = telefonos,
       reemplazo = isTRUE(as.logical(.mbp_txt(reemplazo))), responsables = responsables, status = catalogo, filas = filas)
}

.mbp_columnas <- function(p) {
  identidad <- c(p$llave, "Origen", "Tanda", "Nombre", paste("Teléfono", seq_len(p$telefonos)), p$estratos)
  reemplazo <- if (p$reemplazo) c("Reemplaza a", "Reemplazado por", "¿Se reemplaza?") else character(0)
  list(todas = c(identidad, reemplazo, .MBP_COLA), campo = .MBP_COLA)
}

#' Genera el libro de la plantilla del barrido telefónico (C8). No toca el estado del
#' proyecto: registra el archivo en la sesión y devuelve su `file_id`.
#' @keywords internal
collection_barrido_plantilla <- function(sid, estudio = "", llave = NULL, estratos = list(), telefonos = 2L, reemplazo = FALSE,
                                         responsables = list(), status = NULL, filas = 2000L) {
  p <- .mbp_parametros(estudio, llave, estratos, telefonos, reemplazo, responsables, status, filas)
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
    sprintf("«%s» es la llave del caso: escríbela como texto y no la repitas.", p$llave),
    "Origen es Muestra o Backup; la tanda va aparte, en «Tanda» (1, 2, 3…).",
    "Las columnas en ámbar las llena campo: Responsable, Status, Teléfono de la encuesta, Intentos, Fecha y Observación.",
    "Status es obligatorio en cuanto hay Intentos o Fecha: la fila se marca si falta.",
    "Los valores permitidos están en la pestaña «Listas»; las metas por estrato, en «Parámetros».",
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
  cuerpo <- 2:ultima
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(locked = FALSE), rows = cuerpo, cols = seq_len(n), gridExpand = TRUE)
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(locked = FALSE, fgFill = "#FFF6D6"), rows = cuerpo,
                     cols = match(col$campo, col$todas), gridExpand = TRUE, stack = TRUE)
  texto <- c(p$llave, paste("Teléfono", seq_len(p$telefonos)), if (p$reemplazo) c("Reemplaza a", "Reemplazado por"))
  openxlsx::addStyle(wb, .MBP_HOJA, openxlsx::createStyle(numFmt = "@", locked = FALSE), rows = cuerpo, cols = idx(texto), gridExpand = TRUE, stack = TRUE)
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
  valida("Origen", type = "list", value = lista("E", length(.MBP_ORIGEN)))
  valida("Teléfono de la encuesta", type = "list", value = lista("I", length(tel)))
  # Sin lista de responsables la columna queda libre: una lista vacía bloquearía todo.
  if (length(p$responsables)) valida("Responsable", type = "list", value = lista("G", length(p$responsables)))
  valida("Intentos", type = "whole", operator = "greaterThanOrEqual", value = 0)
  valida("Tanda", type = "whole", operator = "greaterThanOrEqual", value = 1)
  valida("Fecha", type = "date", operator = "greaterThanOrEqual", value = as.Date("2020-01-01"))
  if (p$reemplazo) valida("¿Se reemplaza?", type = "list", value = '"Sí,No"')
  # Status obligatorio si hay Intentos o Fecha: la fila se pinta en rojo suave.
  openxlsx::conditionalFormatting(wb, .MBP_HOJA, cols = idx("Status"), rows = cuerpo, type = "expression",
                                  rule = sprintf('AND($%s2="",OR($%s2<>"",$%s2<>""))', letra("Status"), letra("Intentos"), letra("Fecha")),
                                  style = openxlsx::createStyle(bgFill = "#F8D7DA"))

  # --- Parámetros: metas por estrato, fuera de las fórmulas ---
  openxlsx::addWorksheet(wb, "Parámetros", gridLines = FALSE)
  openxlsx::writeData(wb, "Parámetros", data.frame(Estrato = if (length(p$estratos)) p$estratos else "(sin estratos)",
                                                   Valor = "", Meta = NA_integer_), headerStyle = cab)
  openxlsx::setColWidths(wb, "Parámetros", cols = 1:3, widths = c(28, 28, 10))

  # --- Control (oculta): sello de la plantilla ---
  openxlsx::addWorksheet(wb, "Control", visible = FALSE)
  openxlsx::writeData(wb, "Control", data.frame(
    clave = c("plantilla", "estudio", "llave", "estratos", "filas", "generado"),
    valor = c(COLLECTION_BARRIDO_PLANTILLA_VERSION, p$estudio, p$llave, paste(p$estratos, collapse = " | "),
              as.character(p$filas), format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  ), colNames = FALSE)

  # Encabezados de verdad protegidos: la hoja va protegida, el cuerpo queda editable y
  # se puede seguir usando vistas de filtro y formato de filas.
  openxlsx::protectWorksheet(wb, .MBP_HOJA, protect = TRUE, lockFormattingCells = FALSE, lockFormattingRows = FALSE,
                             lockAutoFilter = FALSE, lockSorting = TRUE, lockInsertingRows = FALSE)
  openxlsx::protectWorksheet(wb, "Listas", protect = TRUE)
  openxlsx::protectWorksheet(wb, "Léeme", protect = TRUE)
  openxlsx::worksheetOrder(wb) <- match(c("Léeme", .MBP_HOJA, "Listas", "Parámetros", "Control"), names(wb))
  openxlsx::activeSheet(wb) <- 2L

  path <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  nombre <- .export_filename(sid, "plantilla_barrido", "xlsx")
  meta <- .register_output_file(sid, "plantilla_barrido", path, original_name = nombre)
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, version = COLLECTION_BARRIDO_PLANTILLA_VERSION,
       columnas = as.list(col$todas), status = length(p$status), filas = p$filas)
}
