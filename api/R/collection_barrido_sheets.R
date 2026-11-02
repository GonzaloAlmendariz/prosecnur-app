# collection_barrido_sheets.R — la base de barrido construida en el Sheets del estudio
# (decisión de Gonzalo 2 nov 2026, «Sí, en el Sheets»; ADR 0125 «Material arma, Monitoreo sigue»).
#
# Material arma la base con las columnas de la plantilla (collection_barrido_plantilla.R) directamente
# en el Sheets del operativo, que se comparte sólo con el equipo; el analista pega ahí los casos, con
# nombres y teléfonos, y campo la llena. Monitoreo la conecta como fuente y la lee como hoy.
#
# Lo que este archivo NO hace, a propósito:
#   - No escribe datos personales: sólo encabezados, el correlativo «Cod pulso», el Origen cuando el
#     estudio declara muestra y backup, y los vocabularios de «Listas». Material sigue sin guardarlos.
#   - No copia las columnas sensibles (en rojo en la plantilla): no van al Sheets compartido.
#   - No toca una pestaña que ya existe. Sembrar es sólo crear lo que falta: si «Barrido» ya está, es
#     del equipo (alguien puede estar llenándola en vivo) y queda `respetada`, sin un solo request.
#   - Si no puede leer qué pestañas tiene el documento, no escribe: no se siembra a ciegas.
#   - No escribe en un Sheets que use Monitoreo para el control. Gonzalo (2 nov 2026): «los enumeradores
#     solo tienen acceso a la base de barrido no la de control». El barrido es un documento propio, el que
#     se comparte con los enumeradores; si el enlace es uno de control, es 409 y no se toca.

.MBS_CLAVES_ID <- c("spreadsheet_id", "spreadsheetId", "url", "enlace")

# Los Sheets que Monitoreo usa para el control: todo id de Google Sheets en su estado (config, fuentes,
# libro de aulas, distribución, rondas publicadas), salvo una fuente con papel `barrido`, que es
# justamente el documento de los enumeradores. Recorre el árbol entero para no depender de dónde lo
# guarde cada perfil: un destino nuevo de Monitoreo queda protegido sin tocar este archivo.
.mbs_documentos_de_control <- function(s) {
  ids <- character(0)
  visitar <- function(x) {
    if (!is.list(x)) return(invisible())
    if (identical(.mtf_txt(x[["role"]] %||% x[["rol"]] %||% x[["papel"]]), "barrido")) return(invisible())
    for (k in intersect(.MBS_CLAVES_ID, names(x))) {
      id <- .monitoreo_extract_spreadsheet_id(.mtf_txt(x[[k]]))
      if (nzchar(id) && (k != "url" || grepl("docs.google.com/spreadsheets", .mtf_txt(x[[k]]), fixed = TRUE))) ids <<- c(ids, id)
    }
    for (v in x) visitar(v)
  }
  for (clave in grep("^monitoreo_", names(s), value = TRUE)) visitar(s[[clave]])
  unique(ids)
}

.MBS_HOJA_LISTAS <- "Listas"
.MBS_HOJA_LEEME <- "Léeme"

# Lo que se siembra: encabezados y cuerpo no personal de cada pestaña, en el orden en que se crean.
.mbs_pestanas <- function(p) {
  col <- .mbp_columnas(p)
  cabecera <- setdiff(col$todas, p$sensibles)
  filas <- p$filas
  cuerpo <- matrix("", nrow = filas, ncol = length(cabecera))
  cuerpo[, match(.MBP_COD_PULSO, cabecera)] <- as.character(seq_len(filas))
  if (p$reemplazo && "Origen" %in% cabecera && (p$muestra + p$backup) > 0L) {
    origen <- c(rep("Muestra", min(p$muestra, filas)), rep("Backup", max(0L, min(p$backup, filas - p$muestra))))
    cuerpo[seq_along(origen), match("Origen", cabecera)] <- origen
  }
  barrido <- rbind(cabecera, cuerpo)
  dimnames(barrido) <- NULL

  status <- vapply(p$status, `[[`, "", "status")
  listas <- list(Status = status, Clase = vapply(p$status, `[[`, "", "clase"),
                 Responsable = p$responsables, Origen = if (p$reemplazo) .MBP_ORIGEN else character(0))
  listas <- Filter(length, listas)
  alto <- max(vapply(listas, length, 1L))
  tabla_listas <- rbind(names(listas), do.call(cbind, lapply(listas, function(v) c(v, rep("", alto - length(v))))))
  dimnames(tabla_listas) <- NULL

  leeme <- c(
    sprintf("Barrido telefónico%s", if (nzchar(p$estudio)) paste(" ·", p$estudio) else ""),
    "Una fila por caso. No cambies los encabezados de la fila 1: con ellos lee Monitoreo.",
    sprintf("«%s» es el correlativo de Pulso y «%s» la llave del caso: escríbela como texto y no la repitas.", .MBP_COD_PULSO, p$llave),
    "Pega aquí la base del cliente, con nombres y teléfonos: este documento se comparte sólo con el equipo del operativo.",
    sprintf("Las columnas en ámbar las llena campo: %s.", paste(col$campo, collapse = ", ")),
    if (length(p$sensibles)) sprintf("No están aquí, a propósito, las columnas sensibles: %s. No se copian a este documento.", paste(p$sensibles, collapse = ", ")),
    "Status es obligatorio en cuanto hay Intentos o Fecha. Los valores permitidos están en «Listas».",
    "Para filtrar usa vistas de filtro, no un filtro con orden en el documento compartido."
  )
  stats::setNames(list(
    list(valores = barrido, columnas = cabecera, campo = intersect(col$campo, cabecera)),
    list(valores = tabla_listas, listas = listas),
    list(valores = matrix(leeme, ncol = 1L))
  ), c(.MBP_HOJA, .MBS_HOJA_LISTAS, .MBS_HOJA_LEEME))
}

# Encabezado congelado y en navy, la cola de campo en ámbar y los desplegables contra «Listas».
.mbs_formato <- function(sheet_id, pestana, listas) {
  n <- length(pestana$columnas); filas <- nrow(pestana$valores)
  color <- function(hex) { v <- strtoi(substring(hex, c(2, 4, 6), c(3, 5, 7)), 16L) / 255; list(red = v[1], green = v[2], blue = v[3]) }
  celdas <- function(c0, c1, fondo) list(repeatCell = list(
    range = list(sheetId = sheet_id, startRowIndex = 0L, endRowIndex = 1L, startColumnIndex = c0, endColumnIndex = c1),
    cell = list(userEnteredFormat = list(backgroundColor = color(fondo), wrapStrategy = "WRAP",
                                         textFormat = list(bold = TRUE, foregroundColor = color("#FFFFFF")))),
    fields = "userEnteredFormat(backgroundColor,textFormat,wrapStrategy)"))
  reqs <- list(
    list(updateSheetProperties = list(properties = list(sheetId = sheet_id, gridProperties = list(frozenRowCount = 1L)),
                                      fields = "gridProperties.frozenRowCount")),
    celdas(0L, n, "#1F3A5F")
  )
  for (k in match(pestana$campo, pestana$columnas)) reqs[[length(reqs) + 1L]] <- celdas(k - 1L, k, "#B7791F")
  letra <- function(i) openxlsx::int2col(i)
  for (nombre in intersect(c("Status", "Responsable", "Origen"), names(listas))) {
    k <- match(nombre, pestana$columnas)
    if (is.na(k)) next
    j <- match(nombre, names(listas))
    rango <- sprintf("=%s!$%s$2:$%s$%d", .monitoreo_sheets_quote_sheet(.MBS_HOJA_LISTAS), letra(j), letra(j), length(listas[[nombre]]) + 1L)
    reqs[[length(reqs) + 1L]] <- list(setDataValidation = list(
      range = list(sheetId = sheet_id, startRowIndex = 1L, endRowIndex = filas, startColumnIndex = k - 1L, endColumnIndex = k),
      rule = list(condition = list(type = "ONE_OF_RANGE", values = list(list(userEnteredValue = rango))),
                  showCustomUi = TRUE, strict = FALSE)))
  }
  reqs
}

#' Siembra la base de barrido en el Sheets del estudio con la configuración de la campaña telefónica.
#'
#' Crea sólo las pestañas que faltan («Barrido», «Listas», «Léeme»); una que existe queda
#' `respetada`. Devuelve la URL y qué le pasó a cada pestaña.
#' @keywords internal
collection_telefonica_sheets_sembrar <- function(sid, campaign_id = NULL, enlace = NULL) {
  s <- session_get(sid)
  hit <- .mtel_campana(s, campaign_id)
  cfg <- .mtel_config(s, hit$entry$id)
  id <- .monitoreo_extract_spreadsheet_id(.mtf_txt(enlace))
  if (!nzchar(id)) {
    stop_api(422, "E_COLLECTION_BARRIDO_SHEETS_SIN_ENLACE",
             "Pega el enlace del Sheets del estudio: ahí se construye la base de barrido.")
  }
  if (id %in% .mbs_documentos_de_control(s)) {
    stop_api(409, "E_COLLECTION_BARRIDO_SHEETS_ES_CONTROL",
             "Ese Sheets lo usa Monitoreo para el control. El barrido va en un documento propio, el que se comparte con los enumeradores: crea uno nuevo y pega su enlace.",
             details = list(spreadsheet_id = id))
  }
  casos <- cfg$muestra + cfg$backup
  p <- .mbp_parametros(hit$entry$name, cfg$llave, cfg$estratos, cfg$telefonos, cfg$reemplazo, cfg$responsables,
                       cfg$status, if (casos > 0L) casos else 2000L, cfg$observacion, cfg$sensibles)
  p$muestra <- cfg$muestra; p$backup <- cfg$backup
  pestanas <- .mbs_pestanas(p)

  google <- function(expr) tryCatch(expr, api_error = function(e) stop(e), error = function(e) {
    stop_api(502, "E_COLLECTION_BARRIDO_SHEETS_GOOGLE",
             sprintf("Google Sheets no respondió como se esperaba: %s", conditionMessage(e)))
  })
  # Sin saber qué hay, no se escribe nada.
  existentes <- names(google(.monitoreo_sheets_tab_map(.monitoreo_sheets_metadata(id))))
  faltan <- setdiff(names(pestanas), existentes)
  if (length(faltan)) {
    google(.monitoreo_sheets_batch_update(id, lapply(faltan, function(h) list(addSheet = list(properties = list(title = h))))))
    mapa <- google(.monitoreo_sheets_tab_map(.monitoreo_sheets_metadata(id)))
    google(.monitoreo_google_api(
      paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"), method = "POST",
      body = list(valueInputOption = "RAW", data = lapply(faltan, function(h) list(
        range = .monitoreo_sheets_quote_sheet(h), majorDimension = "ROWS",
        values = lapply(seq_len(nrow(pestanas[[h]]$valores)), function(i) as.list(pestanas[[h]]$valores[i, ])))))
    ))
    if (.MBP_HOJA %in% faltan) {
      google(.monitoreo_sheets_batch_update(id, .mbs_formato(mapa[[.MBP_HOJA]]$sheet_id, pestanas[[.MBP_HOJA]], pestanas[[.MBS_HOJA_LISTAS]]$listas)))
    }
  }
  list(
    ok = TRUE, campaign_id = hit$entry$id, spreadsheet_id = id,
    url = sprintf("https://docs.google.com/spreadsheets/d/%s/edit", id),
    hojas = lapply(names(pestanas), function(h) list(
      hoja = h, accion = if (h %in% faltan) "sembrada" else "respetada",
      filas = if (h %in% faltan) as.integer(nrow(pestanas[[h]]$valores) - 1L) else 0L)),
    columnas = as.list(pestanas[[.MBP_HOJA]]$columnas),
    sin_sensibles = as.list(p$sensibles)
  )
}
