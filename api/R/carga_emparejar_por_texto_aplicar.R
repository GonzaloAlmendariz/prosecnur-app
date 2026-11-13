# Cargar una base con los encabezados emparejados por el texto de la pregunta.
#
# Ítem 4 del checklist de validación del practicante. La propuesta sale de
# `carga_emparejar_por_texto()` y la persona la revisa en Carga; aquí se aplica
# lo que aceptó: se escribe una copia del archivo con los encabezados
# renombrados a los `name` del formulario, se registra como el archivo de
# respuestas y se carga como cualquier otro. Desde ahí todo cruza por
# identificador, también al reabrir el `.pulso` (la copia viaja en `files/`).
#
# La copia se comprueba antes de usarla: releída con el mismo lector de la
# carga, cada columna debe traer los mismos valores que el original. Si no, la
# carga se detiene con su causa y no se registra nada.

.CET_EXT_TEXTO <- c("xlsx", "xls", "csv")

.cet_ext <- function(meta) {
  ext <- tolower(as.character(meta$ext %||% tools::file_ext(as.character(meta$path %||% ""))))
  if (!(ext %in% .CET_EXT_TEXTO)) {
    stop_api(400, "E_UNSUPPORTED_EXT",
             sprintf(paste("El emparejamiento por el texto de la pregunta lee .xlsx, .xls o .csv;",
                           "un .%s ya trae los nombres de sus variables."), ext))
  }
  ext
}

#' Encabezados de la base tal como los lee la carga (primera hoja de un libro).
#' @keywords internal
.cet_leer_encabezados <- function(meta) {
  ext <- .cet_ext(meta)
  # El libro se lee entero, con el lector de la carga: así las columnas son
  # exactamente las que tendrá la base (también las de encabezado vacío).
  if (ext %in% c("xlsx", "xls")) return(names(.read_data_any_path(meta$path, ext)))
  names(utils::read.csv(meta$path, nrows = 1L, check.names = FALSE, colClasses = "character",
                        fileEncoding = "UTF-8"))
}

#' Valida las parejas aceptadas y devuelve los nombres nuevos por posición.
#'
#' Cada pareja trae `columna` (posición en la base), `encabezado` (el texto que
#' tenía esa columna en la propuesta) y `name` (pregunta o `pregunta/opción`
#' del formulario).
#' @keywords internal
.cet_validar_parejas <- function(parejas, encabezados, instrumento) {
  if (!length(parejas)) {
    stop_api(400, "E_BAD_REQUEST", "No hay columnas aceptadas: marca al menos una pareja de la propuesta.")
  }
  destinos <- .cet_destinos(instrumento)$name
  nuevos <- encabezados
  usados <- character(0)
  for (p in parejas) {
    col <- suppressWarnings(as.integer(p$columna %||% NA))
    enc <- as.character(p$encabezado %||% "")[1]
    nm <- as.character(p$name %||% "")[1]
    if (is.na(col) || col < 1L || col > length(encabezados)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La columna %s no existe en la base.", as.character(p$columna %||% "")))
    }
    if (!identical(encabezados[col], enc)) {
      stop_api(400, "E_BAD_REQUEST",
               sprintf("La columna %d de la base se llama \"%s\" y la propuesta decía \"%s\": vuelve a subir la base.",
                       col, encabezados[col], enc))
    }
    if (!(nm %in% destinos)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("\"%s\" no es una pregunta del formulario.", nm))
    }
    if (nm %in% usados) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La pregunta \"%s\" quedó con dos columnas; deja una sola.", nm))
    }
    usados <- c(usados, nm)
    nuevos[col] <- nm
  }
  repetidos <- unique(nuevos[duplicated(nuevos)])
  if (length(repetidos)) {
    stop_api(400, "E_BAD_REQUEST",
             sprintf("La base ya trae una columna llamada \"%s\"; no se puede usar ese nombre para otra.", repetidos[1]))
  }
  nuevos
}

# ¿La copia trae los mismos valores, columna por columna, que el original?
.cet_mismo_contenido <- function(a, b) {
  if (!identical(dim(a), dim(b))) return(FALSE)
  all(vapply(seq_along(a), function(j) isTRUE(all.equal(a[[j]], b[[j]], check.attributes = FALSE)), logical(1)))
}

#' Escribe la copia de la base con los encabezados nuevos y la comprueba.
#' @return ruta del archivo escrito y su extensión.
#' @keywords internal
.cet_escribir_copia <- function(meta, nuevos) {
  ext <- .cet_ext(meta)
  original <- .read_data_any_path(meta$path, ext)
  destino <- tempfile("emparejada_", fileext = if (ext == "csv") ".csv" else ".xlsx")
  if (ext == "csv") {
    crudo <- utils::read.csv(meta$path, colClasses = "character", check.names = FALSE,
                             na.strings = character(0), fileEncoding = "UTF-8")
    names(crudo) <- nuevos
    utils::write.csv(crudo, destino, row.names = FALSE, fileEncoding = "UTF-8")
    ext_out <- "csv"
  } else {
    df <- as.data.frame(original, stringsAsFactors = FALSE, check.names = FALSE)
    names(df) <- nuevos
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "respuestas")
    openxlsx::writeData(wb, "respuestas", df, keepNA = FALSE)
    openxlsx::saveWorkbook(wb, destino, overwrite = TRUE)
    ext_out <- "xlsx"
  }
  copia <- .read_data_any_path(destino, ext_out)
  if (!.cet_mismo_contenido(original, copia)) {
    stop_api(500, "E_EXPORT_COPY_FAILED",
             "La copia de la base con los nombres del formulario no trae los mismos valores que el original; no se cargó.")
  }
  list(path = destino, ext = ext_out)
}

#' Carga la base con los encabezados emparejados por texto.
#'
#' Escribe la copia renombrada, la registra como archivo de respuestas en lugar
#' de la subida original y la procesa con `.carga_procesar_data()`. El router
#' la llama dentro de `.carga_sin_rastro_si_falla()`.
#' @keywords internal
carga_emparejar_por_texto_aplicar <- function(sid, meta, parejas) {
  inst <- .carga_current_instrumento_for_data(sid)
  if (is.null(inst)) {
    stop_api(409, "E_XLSFORM_REQUIRED_FOR_DATA",
             "Primero carga el XLSForm. La data se normaliza y valida usando ese formulario.")
  }
  encabezados <- .cet_leer_encabezados(meta)
  nuevos <- .cet_validar_parejas(parejas, encabezados, inst)
  copia <- .cet_escribir_copia(meta, nuevos)
  raiz <- tools::file_path_sans_ext(as.character(meta$original_name %||% "respuestas"))
  nombre <- sprintf("%s_nombres_del_formulario.%s", raiz, copia$ext)
  nueva <- save_upload(sid, "data", nombre, readBin(copia$path, "raw", file.info(copia$path)$size))
  unlink(copia$path)
  # La subida original queda fuera del registro: la base es la copia.
  s <- session_get(sid)
  s$files[[as.character(meta$file_id)]] <- NULL
  session_set(sid, "files", s$files)
  out <- .carga_procesar_data(sid, nueva)
  out$emparejamiento <- list(
    n_renombradas = as.integer(sum(nuevos != encabezados)),
    archivo = nombre
  )
  out
}

#' Propuesta de emparejamiento por texto para el archivo subido, sin registrar nada.
#' @keywords internal
carga_emparejar_por_texto_propuesta <- function(sid, meta) {
  inst <- .carga_current_instrumento_for_data(sid)
  if (is.null(inst)) {
    stop_api(409, "E_XLSFORM_REQUIRED_FOR_DATA",
             "Primero carga el XLSForm. La data se normaliza y valida usando ese formulario.")
  }
  r <- carga_emparejar_por_texto(.cet_leer_encabezados(meta), inst)
  .cet_payload(r)
}

# La propuesta para el cliente: filas como objetos, con sus candidatas y el texto de cada una.
.cet_payload <- function(r) {
  textos <- stats::setNames(r$destinos$texto, r$destinos$name)
  cols <- r$columnas
  filas <- lapply(seq_len(nrow(cols)), function(i) {
    cand <- r$candidatos[[i]]
    list(
      columna = cols$columna[i], encabezado = cols$encabezado[i], estado = cols$estado[i],
      name = cols$name[i], pregunta = cols$pregunta[i], confianza = cols$confianza[i], causa = cols$causa[i],
      candidatos = lapply(cand, function(nm) list(name = nm, pregunta = unname(textos[nm])))
    )
  })
  list(
    resumen = r$resumen,
    columnas = filas,
    sin_columna = lapply(seq_len(nrow(r$sin_columna)), function(i) {
      list(name = r$sin_columna$name[i], pregunta = r$sin_columna$pregunta[i])
    })
  )
}
