# collection_supervision_base.R — las columnas y el Excel de la base de supervisión (ADR 0125 anexo A3).
#
# Material propone y el analista elige qué columnas lleva la base: del barrido (por defecto Responsable y
# Status) y de los resultados (las variables que se van a repreguntar). Siempre van, al final y con nombre
# fijo porque las lee Monitoreo, las tres de la supervisión (MATERIAL_SUPERVISION_COLUMNAS_FIJAS).
#
# Una fila por caso del lote de Monitoreo: la llave del barrido, quién lo llamó y cuándo salen del lote.
# Material no tiene los valores del barrido ni de los resultados —nombres y teléfonos viven sólo en el
# Sheets del operativo— así que esas columnas salen con su encabezado y vacías, para completarlas desde
# el barrido. La elección se guarda por campaña en `material_supervision_config`.

MATERIAL_SUPERVISION_CONFIG_SCHEMA <- "material_supervision_config/v1"
.MSUP_POR_DEFECTO_BARRIDO <- c("Responsable", "Status")
.MSUP_TIPOS_FUERA <- c("note", "begin group", "end group", "begin_group", "end_group", "begin repeat", "end repeat",
                      "begin_repeat", "end_repeat", "calculate", "start", "end", "today", "deviceid", "username",
                      "audit", "phonenumber", "simserial", "subscriberid")

.msup_campana <- function(s, campaign_id) {
  id <- .mcamp_id_arg(campaign_id)
  hit <- Find(function(h) identical(h$entry$id, id), .mcamp_supervision_entries(.mcamp_registry(s)))
  if (is.null(hit)) {
    stop_api(404, "E_COLLECTION_CAMPAIGN_NOT_FOUND", "La campaña no existe en este proyecto.", details = list(id = id))
  }
  hit
}

# Columnas del barrido que puede llevar la base: las de la plantilla de la telefónica, sin la llave (va
# siempre primera) ni las sensibles.
.msup_viene_de <- function(entry) .mtf_txt((entry$relacion %||% list())$viene_de) |> (\(v) if (nzchar(v)) v else .MCAMP_SUPERVISION_VIENE_DE)()

.msup_barrido_disponibles <- function(s, viene_de = .MCAMP_SUPERVISION_VIENE_DE) {
  hits <- .mcamp_telefonica_entries(.mcamp_registry(s))
  tel <- Find(function(h) identical(h$entry$id, viene_de), hits) %||% (if (length(hits)) hits[[1]] else NULL)
  if (is.null(tel)) return(list(llave = "Código", columnas = character(0)))
  cfg <- .mtel_config(s, tel$entry$id)
  p <- tryCatch(.mbp_parametros("", cfg$llave, cfg$estratos, cfg$telefonos, cfg$reemplazo, cfg$responsables, cfg$status,
                                2000L, cfg$observacion, cfg$sensibles), error = function(e) NULL)
  if (is.null(p)) return(list(llave = cfg$llave, columnas = character(0)))
  list(llave = p$llave, columnas = setdiff(.mbp_columnas(p)$todas, c(.MBP_COD_PULSO, p$llave, p$sensibles)))
}

# Variables del instrumento que se pueden repreguntar: preguntas con nombre, sin notas, grupos ni metadatos.
.msup_resultados_disponibles <- function(sid) {
  path <- tryCatch(codif_xlsform_path(sid), error = function(e) NULL)
  if (is.null(path) || !file.exists(path)) return(list())
  survey <- tryCatch(openxlsx::read.xlsx(path, sheet = "survey"), error = function(e) NULL)
  if (!is.data.frame(survey) || !"name" %in% names(survey)) return(list())
  tipo <- tolower(trimws(as.character(survey$type %||% "")))
  nombre <- trimws(as.character(survey$name))
  col_label <- grep("^label", names(survey), value = TRUE)[1]
  etiqueta <- if (is.na(col_label)) rep("", nrow(survey)) else trimws(as.character(survey[[col_label]]))
  ok <- !is.na(nombre) & nzchar(nombre) & !(sub("\\s.*$", "", tipo) %in% .MSUP_TIPOS_FUERA) & !(tipo %in% .MSUP_TIPOS_FUERA)
  etiqueta[is.na(etiqueta)] <- ""
  unname(Map(function(n, e) list(nombre = n, etiqueta = e), nombre[ok], etiqueta[ok]))
}

.msup_config_guardada <- function(s, campaign_id) {
  x <- s$material_supervision_config
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_SUPERVISION_CONFIG_SCHEMA)) return(NULL)
  c <- (x$por_campana %||% list())[[campaign_id]]
  if (!is.list(c)) return(NULL)
  list(barrido = .mbp_textos(c$barrido), resultados = .mbp_textos(c$resultados),
       revision = max(0L, suppressWarnings(as.integer(.mtf_txt(c$revision))), na.rm = TRUE))
}

#' Columnas de la base de supervisión: lo disponible, lo elegido y lo fijo.
#' @keywords internal
collection_supervision_columnas_get <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  hit <- .msup_campana(s, campaign_id)
  barrido <- .msup_barrido_disponibles(s, .msup_viene_de(hit$entry))
  resultados <- .msup_resultados_disponibles(sid)
  g <- .msup_config_guardada(s, hit$entry$id)
  nombres_res <- vapply(resultados, `[[`, "", "nombre")
  list(
    ok = TRUE, campaign_id = hit$entry$id, llave = barrido$llave,
    disponibles = list(barrido = as.list(barrido$columnas), resultados = resultados),
    elegidas = list(
      barrido = as.list(if (is.null(g)) intersect(.MSUP_POR_DEFECTO_BARRIDO, barrido$columnas) else intersect(g$barrido, barrido$columnas)),
      resultados = as.list(if (is.null(g)) character(0) else intersect(g$resultados, nombres_res))
    ),
    fijas = as.list(MATERIAL_SUPERVISION_COLUMNAS_FIJAS),
    veredictos = as.list(MATERIAL_SUPERVISION_VEREDICTOS),
    revision = if (is.null(g)) 0L else g$revision
  )
}

#' Guarda qué columnas del barrido y de los resultados lleva la base de supervisión.
#' @keywords internal
collection_supervision_columnas_put <- function(sid, campaign_id = NULL, barrido = list(), resultados = list(),
                                                expected_revision = NULL) {
  actual <- collection_supervision_columnas_get(sid, campaign_id)
  if (!is.null(expected_revision) && length(expected_revision)) {
    esperada <- suppressWarnings(as.integer(unlist(expected_revision)[1]))
    if (is.na(esperada) || !identical(esperada, actual$revision)) {
      stop_api(409, "E_COLLECTION_SUPERVISION_COLUMNAS_STALE", "Las columnas cambiaron desde que se abrió la pantalla.",
               details = list(expected = if (is.na(esperada)) NULL else esperada, current = actual$revision))
    }
  }
  b <- .mbp_textos(barrido); r <- .mbp_textos(resultados)
  ajenas <- c(setdiff(b, unlist(actual$disponibles$barrido)),
              setdiff(r, vapply(actual$disponibles$resultados, `[[`, "", "nombre")))
  if (length(ajenas)) {
    stop_api(422, "E_COLLECTION_SUPERVISION_COLUMNAS_INVALIDAS",
             sprintf("«%s» no es una columna del barrido ni una variable del instrumento.", ajenas[[1]]),
             details = list(columnas = as.list(ajenas)))
  }
  s <- session_get(sid)
  x <- s$material_supervision_config
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_SUPERVISION_CONFIG_SCHEMA)) {
    x <- list(schema = MATERIAL_SUPERVISION_CONFIG_SCHEMA, por_campana = list())
  }
  previo <- x$por_campana[[actual$campaign_id]] %||% list()
  # El documento de supervisión (collection_supervision_sheets.R) se conserva al cambiar columnas.
  x$por_campana[[actual$campaign_id]] <- c(list(barrido = as.list(b), resultados = as.list(r), revision = actual$revision + 1L,
                                                updated_at = .collection_now_iso()),
                                           previo[intersect(c("spreadsheet_id", "construida_en"), names(previo))])
  session_set(sid, "material_supervision_config", x)
  collection_supervision_columnas_get(sid, actual$campaign_id)
}

#' El Excel de la base de supervisión: una fila por caso del lote.
#' @keywords internal
collection_supervision_excel <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  hit <- .msup_campana(s, campaign_id)
  lote_id <- .mcamp_supervision_lote_id(hit$entry)
  lote <- .msup_lote(s, lote_id)
  if (is.null(lote)) {
    stop_api(409, "E_COLLECTION_SUPERVISION_SIN_LOTE", "Monitoreo ya no tiene ese lote: la base se arma con un lote vigente.",
             details = list(lote = lote_id))
  }
  col <- collection_supervision_columnas_get(sid, hit$entry$id)
  barrido <- unlist(col$elegidas$barrido) %||% character(0)
  resultados <- unlist(col$elegidas$resultados) %||% character(0)
  ident <- c(col$llave, "Enumerador", "Fecha de la llamada")
  # Un rótulo del barrido que se llama como uno de la identidad no se repite.
  barrido <- setdiff(barrido, ident)
  columnas <- c(ident, barrido, resultados, MATERIAL_SUPERVISION_COLUMNAS_FIJAS)
  casos <- lote$casos
  n <- length(casos)
  tabla <- as.data.frame(matrix(NA_character_, nrow = n, ncol = length(columnas)), stringsAsFactors = FALSE)  # celdas vacías, no texto vacío: ahí se pega
  names(tabla) <- columnas
  if (n) {
    tabla[[col$llave]] <- vapply(casos, `[[`, "", "llave")
    tabla[["Enumerador"]] <- vapply(casos, `[[`, "", "responsable")
    tabla[["Fecha de la llamada"]] <- vapply(casos, `[[`, "", "fecha_llamada")
  }
  hoja <- "Supervisión"
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, hoja, gridLines = TRUE)
  openxlsx::writeData(wb, hoja, tabla, headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F",
                                                                           fontColour = "#FFFFFF", wrapText = TRUE, valign = "center"))
  k_fijas <- match(MATERIAL_SUPERVISION_COLUMNAS_FIJAS, columnas)
  k_completar <- match(c(barrido, resultados), columnas)
  openxlsx::addStyle(wb, hoja, openxlsx::createStyle(textDecoration = "bold", fgFill = "#B7791F", fontColour = "#FFFFFF", wrapText = TRUE),
                     rows = 1, cols = k_fijas, gridExpand = TRUE)
  if (length(k_completar)) {
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(textDecoration = "bold", fgFill = "#5B6573", fontColour = "#FFFFFF", wrapText = TRUE),
                       rows = 1, cols = k_completar, gridExpand = TRUE)
  }
  openxlsx::addStyle(wb, hoja, openxlsx::createStyle(numFmt = "@"), rows = seq_len(max(1L, n)) + 1L, cols = 1, stack = TRUE)
  openxlsx::freezePane(wb, hoja, firstRow = TRUE, firstCol = TRUE)
  openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE, printTitleRows = 1)
  openxlsx::setColWidths(wb, hoja, cols = seq_along(columnas), widths = pmin(40, pmax(14, nchar(columnas) + 4)))
  # Veredicto con su catálogo cerrado, desde una columna oculta.
  openxlsx::writeData(wb, hoja, data.frame(v = MATERIAL_SUPERVISION_VEREDICTOS), startCol = 60, startRow = 1, colNames = FALSE)
  openxlsx::setColWidths(wb, hoja, cols = 60, widths = 0, hidden = TRUE)
  if (n) {
    openxlsx::dataValidation(wb, hoja, cols = match("Veredicto", columnas), rows = seq_len(n) + 1L, type = "list",
                             value = sprintf("$%s$1:$%s$%d", openxlsx::int2col(60), openxlsx::int2col(60), length(MATERIAL_SUPERVISION_VEREDICTOS)))
  }

  openxlsx::addWorksheet(wb, "Léeme", gridLines = FALSE)
  leeme <- c(
    sprintf("Supervisión · %s", hit$entry$name),
    sprintf("Lote %s de Monitoreo: %s. %d %s.", lote_id, lote$criterio, n, if (n == 1L) "caso" else "casos"),
    sprintf("«%s», «Enumerador» y «Fecha de la llamada» salen del lote: no los cambies.", col$llave),
    if (length(k_completar)) sprintf("Las columnas en gris (%s) se completan desde el barrido y los resultados, buscando por «%s».",
                                     paste(c(barrido, resultados), collapse = ", "), col$llave),
    sprintf("Las tres en ámbar las llena el supervisor y las lee Monitoreo: %s. El Veredicto es %s.",
            paste(MATERIAL_SUPERVISION_COLUMNAS_FIJAS, collapse = ", "), paste(MATERIAL_SUPERVISION_VEREDICTOS, collapse = ", "))
  )
  openxlsx::writeData(wb, "Léeme", data.frame(x = leeme), colNames = FALSE)
  openxlsx::addStyle(wb, "Léeme", openxlsx::createStyle(fontSize = 14, textDecoration = "bold", fontColour = "#002457"), rows = 1, cols = 1)
  openxlsx::setColWidths(wb, "Léeme", cols = 1, widths = 110)
  openxlsx::addWorksheet(wb, "Control", visible = FALSE)
  openxlsx::writeData(wb, "Control", data.frame(clave = c("campaign_id", "lote_id", "viene_de", "generado"),
                                                valor = c(hit$entry$id, lote_id, .MCAMP_SUPERVISION_VIENE_DE,
                                                          format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))), colNames = FALSE)
  path <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  meta <- .register_output_file(sid, "supervision_base", path, original_name = .export_filename(sid, paste0("supervision_", lote_id), "xlsx"))
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, casos = n, columnas = as.list(columnas))
}
