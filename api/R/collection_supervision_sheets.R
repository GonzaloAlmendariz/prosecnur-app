# collection_supervision_sheets.R — la base de supervisión de un lote, construida en su propio Sheets
# (ADR 0125 anexo A3; Gonzalo eligió «Fórmula en el Sheets», 2 nov 2026).
#
# Una pestaña «Supervisión <lote_id>» por lote, en un documento de supervisión aparte del barrido: los
# enumeradores no ven la supervisión de sus propias llamadas. Monitoreo la lee de aquí, por lote y por
# «Código» (`collection_supervision_documentos()`), en lugar de publicar sus «Ronda N».
#
# Material no escribe datos personales: nombre, teléfono y lo demás del barrido llegan por fórmula desde la
# pestaña Barrido del documento del barrido (IMPORTRANGE + XLOOKUP por llave). Tres trampas conocidas:
#   - La API interpreta la fórmula con el idioma del documento (`USER_ENTERED`). El separador de
#     argumentos no se adivina por el locale: se escribe una fórmula de prueba y se lee qué dio.
#   - IMPORTRANGE da #REF! hasta que alguien pulsa «Permitir acceso» una vez por par de documentos. Las
#     fórmulas de la base van dentro de IFERROR (si no, la pestaña entera sale en #REF!) y la pestaña
#     «Acceso al barrido» lleva el IMPORTRANGE desnudo, que es donde se pulsa.
#   - Una pestaña que ya existe es del supervisor (puede estar llenando veredictos): no se toca.

.MSS_HOJA_ACCESO <- "Acceso al barrido"
.MSS_PROBE <- "COUNTA(\"a\";\"b\")"

.mss_pestana <- function(lote_id) paste("Supervisión", lote_id)

.mss_url <- function(id) sprintf("https://docs.google.com/spreadsheets/d/%s/edit", id)

# El separador que acepta el documento: se escribe la prueba con «;» y se lee. Con «;» un documento en
# inglés da error o texto; en uno en español da 2.
.mss_separador <- function(id, pestana, google) {
  rango <- paste0(.monitoreo_sheets_quote_sheet(pestana), "!Z1")
  google(.monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"), method = "POST",
    body = list(valueInputOption = "USER_ENTERED", data = list(list(range = rango, values = list(list(paste0("=", .MSS_PROBE))))))))
  leido <- google(.monitoreo_google_api(paste0(.monitoreo_sheets_api_base(id), "/values/",
                                               utils::URLencode(rango, reserved = TRUE), "?valueRenderOption=UNFORMATTED_VALUE")))
  valor <- tryCatch(leido$values[[1]][[1]], error = function(e) NULL)
  google(.monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"), method = "POST",
    body = list(valueInputOption = "RAW", data = list(list(range = rango, values = list(list("")))))))
  if (identical(suppressWarnings(as.numeric(valor %||% NA)), 2)) ";" else ","
}

# La fórmula que trae una columna del barrido por llave. `sep` es el separador del documento.
.mss_formula <- function(barrido_url, col_llave, col_valor, fila, sep, hoja = .MBP_HOJA) {
  ref <- .monitoreo_sheets_quote_sheet(hoja)
  rango <- function(col) sprintf("IMPORTRANGE(\"%s\"%s\"%s!%s:%s\")", barrido_url, sep, ref, col, col)
  sprintf("=IFERROR(XLOOKUP($A%d%s%s%s%s%s\"\")%s\"\")", fila, sep, rango(col_llave), sep, rango(col_valor), sep, sep)
}

# La fila 1 del Barrido del documento del barrido: de ahí salen las letras de cada columna (el equipo
# pudo moverlas; se lee lo que hay, no lo que se sembró).
.mss_cabecera_del_barrido <- function(barrido_id, google, hoja = .MBP_HOJA) {
  r <- google(.monitoreo_google_api(paste0(.monitoreo_sheets_api_base(barrido_id), "/values/",
                                           utils::URLencode(paste0(.monitoreo_sheets_quote_sheet(hoja), "!1:1"), reserved = TRUE))))
  trimws(as.character(unlist(r$values[[1]] %||% list())))
}

#' Construye la pestaña del lote en el Sheets de supervisión. Lo que ya existe no se toca.
#' @keywords internal
collection_supervision_sheets_sembrar <- function(sid, campaign_id = NULL, enlace = NULL) {
  s <- session_get(sid)
  hit <- .msup_campana(s, campaign_id)
  lote_id <- .mcamp_supervision_lote_id(hit$entry)
  lote <- .msup_lote(s, lote_id)
  if (is.null(lote)) {
    stop_api(409, "E_COLLECTION_SUPERVISION_SIN_LOTE", "Monitoreo ya no tiene ese lote: la base se arma con un lote vigente.",
             details = list(lote = lote_id))
  }
  barrido <- s$material_telefonica_sheets
  barrido_id <- .mtf_txt((barrido %||% list())$spreadsheet_id)
  if (!nzchar(barrido_id)) {
    stop_api(409, "E_COLLECTION_SUPERVISION_SHEETS_SIN_BARRIDO",
             "Primero construye el barrido en su Sheets (Telefónica › Barrido): la supervisión trae de ahí nombre y teléfono.")
  }
  guardado <- .msup_config_guardada(s, hit$entry$id)
  id <- .monitoreo_extract_spreadsheet_id(.mtf_txt(enlace))
  if (!nzchar(id)) id <- .mtf_txt(.mss_documento_guardado(s, hit$entry$id))
  if (!nzchar(id)) {
    stop_api(422, "E_COLLECTION_SUPERVISION_SHEETS_SIN_ENLACE", "Pega el enlace del Sheets de supervisión: un documento aparte del barrido.")
  }
  if (identical(id, barrido_id)) {
    stop_api(409, "E_COLLECTION_SUPERVISION_SHEETS_ES_BARRIDO",
             "Ese es el Sheets del barrido, el que ven los enumeradores. La supervisión va en un documento aparte: crea uno nuevo y pega su enlace.",
             details = list(spreadsheet_id = id))
  }
  google <- function(expr) tryCatch(expr, api_error = function(e) stop(e), error = function(e) {
    stop_api(502, "E_COLLECTION_BARRIDO_SHEETS_GOOGLE", sprintf("Google Sheets no respondió como se esperaba: %s", conditionMessage(e)))
  })
  col <- collection_supervision_columnas_get(sid, hit$entry$id)
  pestana <- .mss_pestana(lote_id)
  existentes <- names(google(.monitoreo_sheets_tab_map(.monitoreo_sheets_metadata(id))))
  hojas <- list()
  if (pestana %in% existentes) {
    hojas[[length(hojas) + 1L]] <- list(hoja = pestana, accion = "respetada", filas = 0L)
  } else {
    # La pestaña del barrido de la campaña de la que viene este lote (una por telefónica en el mismo documento).
    hoja_barrido <- .mbs_pestana_de(s, .msup_viene_de(hit$entry))
    cab_barrido <- .mss_cabecera_del_barrido(barrido_id, google, hoja_barrido)
    k_llave <- match(col$llave, cab_barrido)
    if (is.na(k_llave)) {
      stop_api(409, "E_COLLECTION_SUPERVISION_SHEETS_SIN_LLAVE",
               sprintf("La pestaña «%s» no tiene la columna «%s»: sin ella no se encuentra a nadie.", hoja_barrido, col$llave))
    }
    barrido_cols <- setdiff(unlist(col$elegidas$barrido) %||% character(0), c(col$llave, "Enumerador", "Fecha de la llamada"))
    resultados <- unlist(col$elegidas$resultados) %||% character(0)
    columnas <- c(col$llave, "Enumerador", "Fecha de la llamada", barrido_cols, resultados, MATERIAL_SUPERVISION_COLUMNAS_FIJAS)
    google(.monitoreo_sheets_batch_update(id, list(list(addSheet = list(properties = list(title = pestana))))))
    sep <- .mss_separador(id, pestana, google)
    url_b <- .mss_url(barrido_id)
    letra <- function(nombre) { k <- match(nombre, cab_barrido); if (is.na(k)) NA_character_ else openxlsx::int2col(k) }
    filas <- lapply(seq_along(lote$casos), function(i) {
      caso <- lote$casos[[i]]
      fila <- i + 1L
      # El apóstrofo deja la llave y la fecha como texto: USER_ENTERED se comería el cero de «00123».
      c(paste0("'", caso$llave), paste0("'", caso$responsable), paste0("'", caso$fecha_llamada),
        vapply(barrido_cols, function(b) {
          l <- letra(b)
          if (is.na(l)) "" else .mss_formula(url_b, openxlsx::int2col(k_llave), l, fila, sep, hoja_barrido)
        }, ""),
        rep("", length(resultados) + length(MATERIAL_SUPERVISION_COLUMNAS_FIJAS)))
    })
    # Sin nombres: una fila con nombres viajaría como objeto JSON y Google la rechaza.
    valores <- c(list(as.list(unname(columnas))), lapply(filas, function(f) as.list(unname(f))))
    google(.monitoreo_google_api(
      paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"), method = "POST",
      body = list(valueInputOption = "USER_ENTERED", data = list(list(
        range = .monitoreo_sheets_quote_sheet(pestana), majorDimension = "ROWS", values = valores)))))
    hojas[[length(hojas) + 1L]] <- list(hoja = pestana, accion = "sembrada", filas = length(filas))
    # Donde se pulsa «Permitir acceso»: el IMPORTRANGE desnudo, sin IFERROR que lo esconda.
    if (!.MSS_HOJA_ACCESO %in% existentes) {
      google(.monitoreo_sheets_batch_update(id, list(list(addSheet = list(properties = list(title = .MSS_HOJA_ACCESO))))))
      google(.monitoreo_google_api(
        paste0(.monitoreo_sheets_api_base(id), "/values:batchUpdate"), method = "POST",
        body = list(valueInputOption = "USER_ENTERED", data = list(list(
          range = .monitoreo_sheets_quote_sheet(.MSS_HOJA_ACCESO), majorDimension = "ROWS",
          values = list(list("Si la celda de abajo dice #REF!, pásale el cursor y pulsa «Permitir acceso»: así la supervisión trae nombre y teléfono del barrido."),
                        list(sprintf("=IMPORTRANGE(\"%s\"%s\"%s!%s1\")", url_b, sep, .monitoreo_sheets_quote_sheet(hoja_barrido), openxlsx::int2col(k_llave)))))))))
      hojas[[length(hojas) + 1L]] <- list(hoja = .MSS_HOJA_ACCESO, accion = "sembrada", filas = 1L)
    }
  }
  .mss_documento_guardar(sid, hit$entry$id, id)
  list(ok = TRUE, campaign_id = hit$entry$id, lote_id = lote_id, spreadsheet_id = id, url = .mss_url(id),
       pestana = pestana, hojas = hojas, revision = guardado$revision %||% 0L)
}

# El documento de supervisión de una campaña, en `material_supervision_config$por_campana[[id]]`.
.mss_documento_guardado <- function(s, campaign_id) {
  x <- s$material_supervision_config
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_SUPERVISION_CONFIG_SCHEMA)) return("")
  .mtf_txt(((x$por_campana %||% list())[[campaign_id]] %||% list())$spreadsheet_id)
}

.mss_documento_guardar <- function(sid, campaign_id, spreadsheet_id) {
  x <- session_get(sid)$material_supervision_config
  if (!is.list(x) || !identical(.mtf_txt(x$schema), MATERIAL_SUPERVISION_CONFIG_SCHEMA)) {
    x <- list(schema = MATERIAL_SUPERVISION_CONFIG_SCHEMA, por_campana = list())
  }
  actual <- x$por_campana[[campaign_id]] %||% list()
  actual$spreadsheet_id <- spreadsheet_id
  actual$construida_en <- .collection_now_iso()
  x$por_campana[[campaign_id]] <- actual
  session_set(sid, "material_supervision_config", x)
  invisible(TRUE)
}

#' Los documentos de supervisión que Monitoreo lee (contrato acordado el 2 nov 2026): una entrada por
#' campaña con documento; una sin documento no aparece y Monitoreo cae a su «Ronda N» vieja.
#' @keywords internal
collection_supervision_documentos <- function(s) {
  hits <- .mcamp_supervision_entries(.mcamp_registry(s))
  out <- lapply(hits, function(h) {
    id <- .mss_documento_guardado(s, h$entry$id)
    if (!nzchar(id)) return(NULL)
    c_ <- ((s$material_supervision_config$por_campana %||% list())[[h$entry$id]] %||% list())
    lote_id <- .mcamp_supervision_lote_id(h$entry)
    list(campaign_id = h$entry$id, lote_id = lote_id, spreadsheet_id = id, pestana = .mss_pestana(lote_id),
         construida_en = .mtf_txt(c_$construida_en))
  })
  Filter(Negate(is.null), out)
}
