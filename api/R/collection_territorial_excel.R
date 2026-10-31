# collection_territorial_excel.R — el Excel con el que campo asigna UMP a encuestadores
# (checklist-formatos-campo-2026-10-31, C1 y C3; decisión de Gonzalo «Sí, Material»).
#
# El equipo de campo no usa la app: trabaja sobre un Excel (o su copia en Sheets) que
# llena y reasigna a mano. En ACNUR acogida fue el «Excel operativo» de Hojas de ruta
# con columnas agregadas a mano (Encuestador, fechas, observaciones). Aquí Material lo
# genera ya con esas columnas, con el desplegable de la lista de encuestadores de
# Monitoreo, y lo vuelve a leer:
#
#   - generar: sale de la FOTO enviada de la fase de la campaña, con la asignación
#     guardada ya escrita. Exige foto vigente y lista de Monitoreo (como el PUT).
#   - importar: lectura PURA del archivo llenado. Devuelve la propuesta UMP → código y
#     cada fila que no se pudo leer con su motivo; la escribe el PUT de
#     collection_territorial_asignacion.R, que la vuelve a validar. Lee también el
#     Excel operativo viejo («Codigo manzana», «Encuestador»).
#
# Sólo se lee el encuestador. Fechas, estado y observaciones se quedan en el Excel para
# campo (el avance lo mide Monitoreo, C7), y la respuesta lo dice.

.MTX_HOJA <- "Asignación"
.MTX_HOJA_EQUIPO <- "Encuestadores"
.MTX_HOJA_CONTROL <- "Control"
.MTX_FILA_CABECERA <- 4L
.MTX_COLUMNAS <- c("Distrito", "Zona", "Manzana", "Código de manzana", "Tipo", "UMP", "Reemplaza a",
                   "Encuestas", "Viviendas", "Encuestador", "Fecha de salida", "Fecha de entrega",
                   "Estado", "Observaciones")
.MTX_ESTADOS <- c("Pendiente", "En campo", "Finalizada", "Reemplazada", "Anulada")

# «P844 · Encuestador Ejemplo Uno»: lo que muestra el desplegable y lo que se lee de vuelta.
.mtx_etiqueta <- function(e) if (nzchar(e$nombre)) paste0(e$codigo, " · ", e$nombre) else e$codigo

.mtx_normalizar_nombre <- function(x) {
  x <- iconv(as.character(x %||% ""), from = "UTF-8", to = "ASCII//TRANSLIT", sub = "")
  x[is.na(x)] <- ""
  # El TRANSLIT de macOS deja la tilde delante («'i»): se quita antes de limpiar.
  x <- gsub("[`'^~\"]", "", x)
  x <- gsub("[^a-z ]", " ", tolower(x))
  trimws(gsub("\\s+", " ", x))
}

# Foto vigente, campaña y lista de Monitoreo; los mismos 404/409 que el PUT.
.mtx_contexto <- function(sid, campaign_id) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  fase <- .mcamp_territorial_fase_of(hit$entry)
  envio <- .mcamp_territorial_envio(s, fase)
  if (is.null(envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_SIN_FUENTE", "La muestra enviada desde Hojas de ruta ya no está: vuelve a enviarla.",
             details = list(id = hit$entry$id, fase = fase))
  }
  if (.mcamp_territorial_stale(s, fase, envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_DESACTUALIZADA",
             "La muestra cambió en Hojas de ruta desde el envío: reenvíala antes de asignar encuestadores.",
             details = list(id = hit$entry$id, fase = fase))
  }
  eq <- .mta_equipo(s)
  if (!length(eq$equipo)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_SIN_EQUIPO",
             if (identical(eq$code_format, "DNI")) "La lista de encuestadores de Monitoreo identifica por DNI: cárgala con códigos (P001, P002…) para asignar."
             else "Aún no hay encuestadores: carga la lista en Monitoreo › Territorial.",
             details = list(code_format = eq$code_format))
  }
  list(s = s, hit = hit, fase = fase, envio = envio, eq = eq, unidades = .mta_unidades(envio))
}

#' Genera el Excel de asignación de la campaña territorial (C1).
#' @keywords internal
collection_territorial_asignacion_excel <- function(sid, campaign_id = NULL) {
  ctx <- .mtx_contexto(sid, campaign_id)
  equipo <- ctx$eq$equipo
  etiquetas <- vapply(equipo, .mtx_etiqueta, "")
  etiqueta_de <- stats::setNames(etiquetas, vapply(equipo, `[[`, "", "codigo"))
  actual <- collection_territorial_asignacion_get(sid, ctx$hit$entry$id)
  explicita <- Filter(function(a) identical(a$origen, "explicita"), actual$asignacion)
  codigo_de <- stats::setNames(vapply(explicita, `[[`, "", "codigo"), vapply(explicita, `[[`, "", "id_manzana"))
  label_de <- stats::setNames(vapply(ctx$unidades, `[[`, "", "label"), vapply(ctx$unidades, `[[`, "", "unit_id"))
  txt <- function(x) if (is.null(x) || is.na(x)) "" else as.character(x)

  # Cada reemplazo debajo de su titular, como en el Excel operativo que campo ya usa.
  titulares <- Filter(function(u) identical(u$role, "titular"), ctx$unidades)
  reemplazos <- Filter(function(u) identical(u$role, "reemplazo"), ctx$unidades)
  de_titular <- vapply(reemplazos, function(u) if (is.na(u$titular_id)) "" else u$titular_id, "")
  ordenadas <- c(unlist(lapply(titulares, function(t) c(list(t), reemplazos[de_titular == t$unit_id])), recursive = FALSE),
                 reemplazos[!de_titular %in% vapply(titulares, `[[`, "", "unit_id")])
  filas <- lapply(ordenadas, function(u) {
    cod <- unname(codigo_de[u$unit_id])
    enc <- if (is.na(cod)) "" else unname(etiqueta_de[cod])
    if (!is.na(cod) && is.na(enc)) enc <- cod  # código que ya no está en la lista: se escribe tal cual
    data.frame(
      Distrito = txt(u$distrito), Zona = txt(u$zona), Manzana = txt(u$manzana), `Código de manzana` = u$unit_id,
      Tipo = if (identical(u$role, "reemplazo")) "Reemplazo" else "Titular", UMP = u$label,
      `Reemplaza a` = if (identical(u$role, "reemplazo") && !is.na(u$titular_id)) txt(unname(label_de[u$titular_id])) else "",
      Encuestas = if (!is.na(u$rango_inicio) && !is.na(u$rango_fin)) sprintf("%d a %d", u$rango_inicio, u$rango_fin) else "",
      Viviendas = if (is.na(u$viviendas)) NA_integer_ else u$viviendas,
      Encuestador = if (is.na(enc)) "" else enc, `Fecha de salida` = "", `Fecha de entrega` = "",
      Estado = "Pendiente", Observaciones = "",
      check.names = FALSE, stringsAsFactors = FALSE
    )
  })
  tabla <- do.call(rbind, filas)
  # P2: una columna por código de resultado del estudio, donde campo transcribe los
  # totales de su hoja de consolidados. Se leen de vuelta como declarados (C7).
  conteo_cols <- .mtx_columnas_conteo(collection_territorial_formatos_get(sid, ctx$hit$entry$id)$codigos)
  for (cc in conteo_cols) tabla[[cc]] <- NA_integer_
  columnas <- names(tabla)
  n <- nrow(tabla)
  primera <- .MTX_FILA_CABECERA + 1L
  ultima <- .MTX_FILA_CABECERA + n
  col_enc <- match("Encuestador", .MTX_COLUMNAS)

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, .MTX_HOJA, gridLines = FALSE)
  openxlsx::writeData(wb, .MTX_HOJA, sprintf("Asignación de UMP a encuestadores · %s", ctx$hit$entry$name), startRow = 1)
  openxlsx::writeData(wb, .MTX_HOJA, paste(
    "Elige en «Encuestador» quién hace cada UMP; un reemplazo va con su titular salvo que elijas a otra persona.",
    "Para reasignar, cambia el encuestador y vuelve a subir el archivo en Material de campo.",
    "No cambies «Código de manzana»: con ella la app lee este archivo."
  ), startRow = 2)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fontSize = 14, textDecoration = "bold"), rows = 1, cols = 1)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fontSize = 10, fontColour = "#5B6573", wrapText = TRUE), rows = 2, cols = 1)
  openxlsx::mergeCells(wb, .MTX_HOJA, cols = seq_along(columnas), rows = 2)
  openxlsx::setRowHeights(wb, .MTX_HOJA, rows = 2, heights = 32)
  openxlsx::writeData(wb, .MTX_HOJA, tabla, startRow = .MTX_FILA_CABECERA,
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F", fontColour = "#FFFFFF",
                                                          border = "Bottom", wrapText = TRUE, valign = "center"))
  # Titulares en azul y reemplazos en amarillo, como el Excel operativo que campo ya conoce.
  es_reemplazo <- tabla$Tipo == "Reemplazo"
  if (any(!es_reemplazo)) openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fgFill = "#E8F0FB"),
                                             rows = which(!es_reemplazo) + .MTX_FILA_CABECERA, cols = seq_along(columnas), gridExpand = TRUE, stack = TRUE)
  if (any(es_reemplazo)) openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(fgFill = "#FFF6D6"),
                                            rows = which(es_reemplazo) + .MTX_FILA_CABECERA, cols = seq_along(columnas), gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(numFmt = "@"), rows = primera:ultima, cols = match("Código de manzana", .MTX_COLUMNAS), stack = TRUE)
  openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(numFmt = "dd/mm/yyyy"), rows = primera:ultima,
                     cols = match(c("Fecha de salida", "Fecha de entrega"), .MTX_COLUMNAS), gridExpand = TRUE, stack = TRUE)
  openxlsx::setColWidths(wb, .MTX_HOJA, cols = seq_along(columnas),
                         widths = c(18, 8, 9, 18, 10, 8, 11, 10, 9, 34, 13, 13, 12, 36, rep(14, length(conteo_cols))))
  openxlsx::freezePane(wb, .MTX_HOJA, firstActiveRow = primera, firstActiveCol = col_enc)
  openxlsx::addFilter(wb, .MTX_HOJA, rows = .MTX_FILA_CABECERA, cols = seq_along(columnas))
  openxlsx::pageSetup(wb, .MTX_HOJA, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE,
                      printTitleRows = .MTX_FILA_CABECERA)

  # La lista de Monitoreo: el desplegable y cuántas UMP lleva cada uno.
  openxlsx::addWorksheet(wb, .MTX_HOJA_EQUIPO, gridLines = FALSE)
  openxlsx::writeData(wb, .MTX_HOJA_EQUIPO, data.frame(Código = names(etiqueta_de), Nombre = vapply(equipo, `[[`, "", "nombre"),
                                                       `Como aparece en la lista` = unname(etiquetas), check.names = FALSE),
                      headerStyle = openxlsx::createStyle(textDecoration = "bold", border = "Bottom"))
  col_letra <- openxlsx::int2col(col_enc)
  openxlsx::writeData(wb, .MTX_HOJA_EQUIPO, "UMP asignadas", startCol = 4, startRow = 1)
  openxlsx::addStyle(wb, .MTX_HOJA_EQUIPO, openxlsx::createStyle(textDecoration = "bold", border = "Bottom"), rows = 1, cols = 4)
  for (i in seq_along(etiquetas)) {
    openxlsx::writeFormula(wb, .MTX_HOJA_EQUIPO, sprintf("COUNTIF('%s'!$%s$%d:$%s$%d,C%d)", .MTX_HOJA, col_letra, primera, col_letra, ultima, i + 1L),
                           startCol = 4, startRow = i + 1L)
  }
  openxlsx::setColWidths(wb, .MTX_HOJA_EQUIPO, cols = 1:4, widths = c(10, 34, 40, 14))
  openxlsx::dataValidation(wb, .MTX_HOJA, cols = col_enc, rows = primera:ultima, type = "list",
                           value = sprintf("'%s'!$C$2:$C$%d", .MTX_HOJA_EQUIPO, length(etiquetas) + 1L))
  openxlsx::writeData(wb, .MTX_HOJA, data.frame(e = .MTX_ESTADOS), startCol = 30, startRow = 1, colNames = FALSE)
  openxlsx::setColWidths(wb, .MTX_HOJA, cols = 30, widths = 0, hidden = TRUE)
  if (length(conteo_cols)) {
    openxlsx::dataValidation(wb, .MTX_HOJA, cols = match(conteo_cols, columnas), rows = primera:ultima, type = "whole",
                             operator = "greaterThanOrEqual", value = 0)
    openxlsx::addStyle(wb, .MTX_HOJA, openxlsx::createStyle(textDecoration = "bold", fgFill = "#B7791F", fontColour = "#FFFFFF",
                                                            border = "Bottom", wrapText = TRUE, valign = "center"),
                       rows = .MTX_FILA_CABECERA, cols = match(conteo_cols, columnas))
  }
  openxlsx::dataValidation(wb, .MTX_HOJA, cols = match("Estado", .MTX_COLUMNAS), rows = primera:ultima, type = "list",
                           value = sprintf("$AD$1:$AD$%d", length(.MTX_ESTADOS)))

  # Con qué foto se generó: al subirlo, una huella distinta se avisa.
  openxlsx::addWorksheet(wb, .MTX_HOJA_CONTROL, visible = FALSE)
  openxlsx::writeData(wb, .MTX_HOJA_CONTROL, data.frame(
    clave = c("campaign_id", "fase", "sample_fingerprint", "generado"),
    valor = c(ctx$hit$entry$id, ctx$fase, ctx$envio$sample_fingerprint, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  ), colNames = FALSE)

  path <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  nombre <- .export_filename(sid, "asignacion_encuestadores", "xlsx")
  meta <- .register_output_file(sid, "asignacion_encuestadores", path, original_name = nombre)
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, umps = n,
       encuestadores = length(equipo), asignadas = length(explicita))
}

# Columna por su rótulo, con los nombres del Excel operativo viejo como alias.
# P2: «1 · No quiso participar»: el código va delante y es lo que se lee de vuelta.
.mtx_columnas_conteo <- function(codigos) vapply(codigos, function(k) sprintf("%s · %s", k$codigo, k$rotulo), "")

.mtx_columna <- function(cabecera, opciones) {
  norm <- .mtx_normalizar_nombre(cabecera)
  hit <- match(.mtx_normalizar_nombre(opciones), norm)
  hit <- hit[!is.na(hit)]
  if (length(hit)) hit[[1]] else NA_integer_
}

.mtx_leer_tabla <- function(path) {
  hojas <- tryCatch(suppressWarnings(openxlsx::getSheetNames(path)), error = function(e) character(0))
  if (!length(hojas)) stop_api(422, "E_COLLECTION_TERRITORIAL_EXCEL_ILEGIBLE", "El archivo no se pudo abrir como Excel (.xlsx).")
  orden <- unique(c(intersect(c(.MTX_HOJA, "Hojas_de_ruta"), hojas), setdiff(hojas, c(.MTX_HOJA_EQUIPO, .MTX_HOJA_CONTROL))))
  for (h in orden) {
    crudo <- tryCatch(openxlsx::read.xlsx(path, sheet = h, colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE),
                      error = function(e) NULL)
    if (!is.data.frame(crudo) || !nrow(crudo)) next
    for (r in seq_len(min(15L, nrow(crudo)))) {
      cab <- vapply(crudo[r, ], function(x) as.character(x %||% ""), "")
      ci <- .mtx_columna(cab, c("Código de manzana", "Codigo manzana", "id_manzana"))
      ce <- .mtx_columna(cab, c("Encuestador"))
      if (!is.na(ci) && !is.na(ce)) {
        cuerpo <- if (r < nrow(crudo)) crudo[(r + 1L):nrow(crudo), , drop = FALSE] else crudo[0, , drop = FALSE]
        # C7: Estado y fechas son opcionales (el Excel operativo viejo no los trae).
        opcional <- function(nombres) { k <- .mtx_columna(cab, nombres); if (is.na(k)) rep(NA, nrow(cuerpo)) else cuerpo[[k]] }
        # P2: columnas de conteo por su código delante («8 · Encuesta efectiva»).
        de_conteo <- which(grepl("^\\s*[0-9]+\\s*·", cab))
        conteos <- stats::setNames(lapply(de_conteo, function(k) cuerpo[[k]]), trimws(sub("·.*$", "", cab[de_conteo])))
        return(list(hoja = h, fila0 = r, id = cuerpo[[ci]], encuestador = cuerpo[[ce]], estado = opcional("Estado"),
                    fecha_salida = opcional("Fecha de salida"), fecha_entrega = opcional("Fecha de entrega"), conteos = conteos))
      }
    }
  }
  stop_api(422, "E_COLLECTION_TERRITORIAL_EXCEL_ILEGIBLE",
           "No se encontró una hoja con las columnas «Código de manzana» y «Encuestador».")
}

.mtx_texto_id <- function(x) {
  if (is.numeric(x)) return(vapply(x, function(v) if (is.na(v)) "" else format(v, scientific = FALSE, trim = TRUE), ""))
  out <- trimws(as.character(x))
  out[is.na(out)] <- ""
  out
}

.mtx_control <- function(path) {
  if (!.MTX_HOJA_CONTROL %in% openxlsx::getSheetNames(path)) return(list())
  t <- tryCatch(openxlsx::read.xlsx(path, sheet = .MTX_HOJA_CONTROL, colNames = FALSE), error = function(e) NULL)
  if (!is.data.frame(t) || ncol(t) < 2) return(list())
  stats::setNames(as.list(as.character(t[[2]])), as.character(t[[1]]))
}

#' Lee el Excel de asignación llenado por campo (C3). Lectura pura: no escribe.
#' @keywords internal
collection_territorial_asignacion_importar <- function(sid, campaign_id = NULL, file_raw = NULL, file_name = NULL,
                                                       content_base64 = NULL) {
  ctx <- .mtx_contexto(sid, campaign_id)
  if (is.null(file_raw) && length(content_base64) && nzchar(content_base64[[1]])) {
    file_raw <- tryCatch(jsonlite::base64_dec(content_base64[[1]]), error = function(e) NULL)
  }
  if (!is.raw(file_raw) || !length(file_raw)) {
    stop_api(400, "E_COLLECTION_TERRITORIAL_EXCEL_ILEGIBLE", "Falta el archivo de Excel.")
  }
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path), add = TRUE)
  writeBin(file_raw, path)
  t <- .mtx_leer_tabla(path)
  control <- .mtx_control(path)

  equipo <- ctx$eq$equipo
  codigos <- vapply(equipo, `[[`, "", "codigo")
  nombres <- .mtx_normalizar_nombre(vapply(equipo, `[[`, "", "nombre"))
  unidades <- stats::setNames(ctx$unidades, vapply(ctx$unidades, `[[`, "", "unit_id"))
  resolver <- function(valor) {
    v <- trimws(valor)
    izquierda <- trimws(sub("·.*$", "", v))
    for (cand in unique(c(izquierda, v))) {
      cod <- .monitoreo_territorial_clean_code(cand, ctx$eq$code_format)
      if (nzchar(cod) && cod %in% codigos) return(cod)
    }
    derecha <- .mtx_normalizar_nombre(if (grepl("·", v)) sub("^[^·]*·", "", v) else v)
    hit <- which(nombres == derecha & nzchar(derecha))
    if (length(hit) == 1L) return(codigos[[hit]])
    NA_character_
  }

  ids <- .mtx_texto_id(t$id)
  encs <- trimws(vapply(t$encuestador, function(x) if (is.null(x) || is.na(x)) "" else as.character(x), ""))
  propuesta <- list(); problemas <- list(); vistos <- character(0); estados <- list()
  sin_encuestador <- 0L
  for (i in seq_along(ids)) {
    fila <- t$fila0 + i
    id <- ids[[i]]
    if (!nzchar(id) && !nzchar(encs[[i]])) next
    # Una columna que Sheets volvió numérica pierde el cero de los ubigeos 01–09.
    if (nzchar(id) && is.null(unidades[[id]]) && !is.null(unidades[[paste0("0", id)]])) id <- paste0("0", id)
    if (!nzchar(id) || is.null(unidades[[id]])) {
      problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = encs[[i]], motivo = "La UMP no está en la muestra enviada")
      next
    }
    if (id %in% vistos) {
      problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = encs[[i]], motivo = "La UMP aparece dos veces; vale la primera")
      next
    }
    vistos <- c(vistos, id)
    # C7: lo declarado se lee en toda UMP de la muestra, tenga o no encuestador.
    est <- .mte_estado(t$estado[i]); fs <- .mte_fecha(t$fecha_salida[i]); fe <- .mte_fecha(t$fecha_entrega[i])
    crudo_fecha <- function(x) { v <- x[[1]]; !is.null(v) && !is.na(v) && nzchar(trimws(as.character(v))) }
    if (is.na(est)) problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = as.character(t$estado[[i]]), motivo = "El Estado no es uno de la lista; no se lee")
    if (is.na(fs) && crudo_fecha(t$fecha_salida[i])) problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = as.character(t$fecha_salida[[i]]), motivo = "La fecha de salida no se reconoce")
    if (is.na(fe) && crudo_fecha(t$fecha_entrega[i])) problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = as.character(t$fecha_entrega[[i]]), motivo = "La fecha de entrega no se reconoce")
    est <- if (is.na(est)) "" else est
    cuenta <- list()
    for (k in names(t$conteos)) {
      v <- t$conteos[[k]][[i]]
      if (is.null(v) || is.na(v) || !nzchar(trimws(as.character(v)))) next
      num <- suppressWarnings(as.numeric(v))
      if (is.na(num) || num < 0 || num != floor(num)) {
        problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = as.character(v), motivo = sprintf("El conteo del código %s no es un entero desde cero", k))
      } else cuenta[[k]] <- as.integer(num)
    }
    if (nzchar(est) || !is.na(fs) || !is.na(fe) || length(cuenta)) {
      estados[[id]] <- list(id_manzana = id, estado_declarado = est,
                            fecha_salida = if (is.na(fs)) "" else fs, fecha_entrega = if (is.na(fe)) "" else fe,
                            conteos = cuenta)
    }
    if (!nzchar(encs[[i]])) { sin_encuestador <- sin_encuestador + 1L; next }
    cod <- resolver(encs[[i]])
    if (is.na(cod)) {
      problemas[[length(problemas) + 1L]] <- list(fila = fila, id_manzana = id, valor = encs[[i]], motivo = "No está en la lista de encuestadores de Monitoreo")
      next
    }
    propuesta[[id]] <- list(id_manzana = id, codigo = cod, fila = fila)
  }
  # Un reemplazo con el mismo encuestador que su titular hereda: no se guarda aparte.
  for (id in names(propuesta)) {
    u <- unidades[[id]]
    if (identical(u$role, "reemplazo") && !is.na(u$titular_id) && identical(propuesta[[u$titular_id]]$codigo, propuesta[[id]]$codigo)) {
      propuesta[[id]] <- NULL
    }
  }
  titulares <- Filter(function(u) identical(u$role, "titular"), ctx$unidades)
  con <- vapply(titulares, function(u) !is.null(propuesta[[u$unit_id]]), TRUE)
  conteo <- table(factor(vapply(propuesta, `[[`, "", "codigo"), levels = codigos))
  # Aplicar reemplaza todo: cuántas UMP con encuestador hoy se quedarían sin él.
  guardada <- collection_territorial_asignacion_get(sid, ctx$hit$entry$id)
  hoy <- vapply(Filter(function(a) identical(a$origen, "explicita"), guardada$asignacion), `[[`, "", "id_manzana")
  # Un reemplazo que ahora hereda de su titular asignado no pierde a nadie.
  pierden <- Filter(function(id) {
    if (!is.null(propuesta[[id]])) return(FALSE)
    u <- unidades[[id]]
    !(identical(u$role, "reemplazo") && !is.na(u$titular_id) && !is.null(propuesta[[u$titular_id]]))
  }, setdiff(hoy, names(propuesta)))
  list(
    ok = TRUE, campaign_id = ctx$hit$entry$id, hoja = t$hoja,
    propuesta = unname(lapply(propuesta, function(p) p[c("id_manzana", "codigo")])),
    estados = unname(estados),
    problemas = problemas,
    resumen = list(titulares = length(titulares), titulares_con_encuestador = as.integer(sum(con)),
                   filas_sin_encuestador = sin_encuestador, problemas = length(problemas),
                   pierden_encuestador = length(pierden),
                   conteos_declarados = length(Filter(function(e) length(e$conteos) > 0L, estados)),
                   estados_declarados = length(Filter(function(e) nzchar(e$estado_declarado) && !identical(e$estado_declarado, "Pendiente"), estados))),
    por_encuestador = lapply(seq_along(codigos), function(i) list(codigo = codigos[[i]], nombre = equipo[[i]]$nombre, umps = as.integer(conteo[[i]]))),
    otra_muestra = nzchar(control$sample_fingerprint %||% "") && !identical(control$sample_fingerprint, ctx$envio$sample_fingerprint),
    nota = "Se leen el encuestador, el Estado, las fechas y los conteos por código de resultado; es lo que declara campo y no cambia el avance, que sale de Kobo. Las observaciones se quedan en el Excel."
  )
}

# multipart con la parte `file` (y `id`), o JSON {id, content_base64, file_name}.
.mtx_import_request <- function(req) {
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (grepl("multipart/form-data", ctype, fixed = TRUE)) {
    parts <- tryCatch(parse_multipart_upload(req), error = function(e) NULL)
    part <- if (is.list(parts)) parts[["file"]] else NULL
    if (!is.list(part) || !is.raw(part$value)) {
      stop_api(400, "E_COLLECTION_TERRITORIAL_EXCEL_ILEGIBLE", "Falta el archivo de Excel.")
    }
    id <- parts[["id"]]
    id <- if (is.list(id) && is.raw(id$value)) rawToChar(id$value) else if (is.raw(id)) rawToChar(id) else NULL
    return(list(file_raw = part$value, file_name = part$filename %||% "asignacion.xlsx", id = id))
  }
  body <- .collection_parse_body(req)
  list(file_raw = NULL, content_base64 = body[["content_base64"]], file_name = body[["file_name"]], id = body[["id"]])
}
