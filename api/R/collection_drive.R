# B6(b): la ficha QR en PDF conectada al Drive (D-L10, dictado 2026-08-31).
#
# El artefacto YA RENDERIZADO —el bundle de fichas o el PDF corrido, registrado
# con recibo en collection_state— se sube al Drive del operativo con la MISMA
# credencial Google del libro (ADR 0005: el token vive fuera del .pulso). No se
# re-renderiza nada: subir es rapido y el recibo ya garantiza que es el
# artefacto que el equipo vio.
#
# La carpeta destino («Fichas QR - <estudio>») se busca o se crea una vez y se
# RECUERDA en el estado, como el destino del libro (`libro_sheets`). Cada
# publicacion queda anotada en `drive_publicaciones` junto a su recibo; el
# recibo mismo no se toca (su contrato es cerrado).
#
# Degradaciones declaradas, nunca a medias:
# - sin credencial Google        -> E_DRIVE_SIN_GOOGLE (conectar Google)
# - token sin permiso de Drive   -> E_DRIVE_SCOPE (reconectar: el scope
#   drive.file entro a la conexion el 2026-09-03; tokens viejos no lo traen)
# - artefacto movido/adulterado  -> E_DRIVE_FICHAS (re-renderizar)
# Un fallo del upload no escribe NADA en el estado.

# Token de la conexion Google compartida. Envuelto para poder mockearse y para
# convertir el "no hay credencial" en su codigo declarado.
.cdr_token <- function() {
  .monitoreo_sheets_access_token()
}

# Llamadas JSON a la Drive API (buscar/crear carpeta): mismo transporte con
# timeout y refresh del resto de Google, pero el manejo de errores es PROPIO.
# Delegar en `.monitoreo_google_api` era un stop() crudo ante cualquier >=300:
# el 403 del token viejo al CREAR la carpeta —el escenario primario de la
# degradacion— salia como E_INTERNAL 500 en vez de pedir reconectar
# (hallazgo del verificador, 2026-09-03).
.cdr_drive_json <- function(url, method = "GET", body = NULL, token = NULL) {
  res <- .monitoreo_google_api_once(url, method = method, body = body, token = token)
  if (identical(as.integer(res$status_code), 401L)) {
    refreshed <- tryCatch(.monitoreo_sheets_refresh_access_token(), error = function(e) NULL)
    if (nzchar(as.character(refreshed %||% ""))) {
      res <- .monitoreo_google_api_once(url, method = method, body = body, token = refreshed)
    }
  }
  if (identical(as.integer(res$status_code), 403L)) {
    stop_api(
      409, "E_DRIVE_SCOPE",
      "La conexión con Google no tiene permiso de Drive: reconecta Google para autorizar la subida de archivos."
    )
  }
  if (res$status_code >= 300L) {
    stop_api(
      409, "E_DRIVE_FICHAS",
      sprintf(
        "Drive respondió HTTP %s: %s",
        res$status_code,
        res$parsed$error$message %||% res$parsed$error_description %||% "sin detalle"
      )
    )
  }
  res$parsed
}

# Cuerpo multipart/related de files.create: parte 1 metadata JSON, parte 2 el
# binario INTACTO. Se arma en raw porque un PDF/zip no sobrevive un paste0.
.cdr_multipart_body <- function(metadata, bytes, media_type, boundary) {
  meta_json <- jsonlite::toJSON(metadata, auto_unbox = TRUE)
  cabecera <- paste0(
    "--", boundary, "\r\n",
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    meta_json, "\r\n",
    "--", boundary, "\r\n",
    "Content-Type: ", media_type, "\r\n\r\n"
  )
  cierre <- paste0("\r\n--", boundary, "--")
  c(charToRaw(cabecera), bytes, charToRaw(cierre))
}

# Sube un archivo a Drive (files.create multipart). Timeout escalado al
# tamaño: el limite de 60 s del transporte JSON esta pensado para llamadas de
# control, no para un zip de cientos de fichas.
.cdr_drive_upload <- function(metadata, path, media_type, token) {
  bytes <- readBin(path, "raw", n = file.info(path)$size)
  boundary <- paste0("pulso", paste(sample(c(letters, 0:9), 24L, replace = TRUE), collapse = ""))
  cuerpo <- .cdr_multipart_body(metadata, bytes, media_type, boundary)
  url <- paste0(
    "https://www.googleapis.com/upload/drive/v3/files",
    "?uploadType=multipart&fields=id,name,webViewLink"
  )
  intento <- function(tk) {
    handle <- curl::new_handle(
      customrequest = "POST",
      httpheader = c(
        sprintf("Authorization: Bearer %s", tk),
        sprintf("Content-Type: multipart/related; boundary=%s", boundary)
      ),
      postfieldsize_large = length(cuerpo),
      postfields = cuerpo
    )
    .monitoreo_google_apply_timeouts(handle)
    curl::handle_setopt(handle, timeout = max(
      .monitoreo_google_timeout_seconds(),
      ceiling(length(cuerpo) / (64 * 1024))
    ))
    res <- curl::curl_fetch_memory(url, handle = handle)
    text <- rawToChar(res$content)
    parsed <- if (nzchar(text)) {
      tryCatch(jsonlite::fromJSON(text, simplifyVector = FALSE), error = function(e) list(raw = text))
    } else {
      list()
    }
    list(status_code = res$status_code, parsed = parsed)
  }
  res <- intento(token)
  if (identical(as.integer(res$status_code), 401L)) {
    refreshed <- tryCatch(.monitoreo_sheets_refresh_access_token(), error = function(e) NULL)
    if (nzchar(as.character(refreshed %||% ""))) res <- intento(refreshed)
  }
  if (identical(as.integer(res$status_code), 403L)) {
    stop_api(
      409, "E_DRIVE_SCOPE",
      "La conexión con Google no tiene permiso de Drive: reconecta Google para autorizar la subida de archivos."
    )
  }
  if (res$status_code >= 300L) {
    stop_api(
      409, "E_DRIVE_FICHAS",
      sprintf(
        "Drive no aceptó el archivo (HTTP %s): %s",
        res$status_code,
        res$parsed$error$message %||% "sin detalle"
      )
    )
  }
  res$parsed
}

# Busca la carpeta por nombre exacto (no en la papelera) o la crea. Devuelve
# el id; el llamador decide cuando recordarlo.
.cdr_carpeta_asegurar <- function(nombre, token) {
  q <- sprintf(
    "name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    gsub("'", "\\\\'", nombre)
  )
  listado <- .cdr_drive_json(
    paste0(
      "https://www.googleapis.com/drive/v3/files?q=",
      utils::URLencode(q, reserved = TRUE),
      "&fields=files(id,name)&pageSize=5"
    ),
    token = token
  )
  existentes <- listado$files %||% list()
  if (length(existentes)) {
    id <- as.character(existentes[[1]]$id %||% "")
    if (nzchar(id)) return(id)
  }
  creado <- .cdr_drive_json(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    method = "POST",
    body = list(name = nombre, mimeType = "application/vnd.google-apps.folder"),
    token = token
  )
  id <- as.character(creado$id %||% "")
  if (!nzchar(id)) {
    stop_api(409, "E_DRIVE_FICHAS", "Drive no devolvió el id de la carpeta creada.")
  }
  id
}

#' Publica en Drive un artefacto de materiales ya renderizado.
#'
#' @param sid sesión.
#' @param file_id id del archivo registrado por el job de materiales.
#' @param expected_revision revisión del estado que ve la pantalla.
#' @return metadatos de la publicación (id y enlace de Drive, carpeta).
#' @export
collection_drive_publicar <- function(sid, file_id, expected_revision) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)

  file_id <- as.character(file_id %||% "")[1]
  registro <- session$files[[file_id]]
  if (!is.list(registro) || !nzchar(as.character(registro$path %||% ""))) {
    stop_api(
      409, "E_DRIVE_FICHAS",
      "No hay un artefacto de fichas registrado con ese id: renderiza el material primero."
    )
  }
  path <- as.character(registro$path)[1]
  if (!file.exists(path)) {
    stop_api(
      409, "E_DRIVE_FICHAS",
      "El artefacto renderizado ya no está en el disco de la sesión: renderiza el material de nuevo."
    )
  }

  receipt_id <- as.character(registro$receipt_id %||% "")[1]
  recibo <- NULL
  for (candidato in .cm_receipts(current)) {
    if (identical(candidato$receipt_id, receipt_id)) recibo <- candidato
  }
  if (is.null(recibo)) {
    stop_api(
      409, "E_DRIVE_FICHAS",
      "El artefacto no tiene recibo en el estado: renderiza el material de nuevo."
    )
  }

  # El archivo del disco tiene que ser EXACTAMENTE el del recibo: subir un
  # artefacto adulterado con el sello del bueno seria peor que no subir.
  sha <- paste0("sha256:", tolower(digest::digest(file = path, algo = "sha256")))
  if (!identical(sha, as.character(recibo$sha256 %||% ""))) {
    stop_api(
      409, "E_DRIVE_FICHAS",
      "El artefacto del disco no coincide con su recibo (checksum distinto): renderiza el material de nuevo."
    )
  }

  token <- tryCatch(.cdr_token(), error = function(e) {
    stop_api(
      409, "E_DRIVE_SIN_GOOGLE",
      "No hay conexión con Google: conecta la cuenta del operativo (la misma del libro) para subir las fichas al Drive."
    )
  })

  proyecto <- .cm_project_snapshot(session)
  carpeta_nombre <- sprintf("Fichas QR - %s", proyecto$name)
  carpeta_id <- as.character(current$drive_fichas$folder_id %||% "")[1]
  if (!nzchar(carpeta_id)) {
    carpeta_id <- .cdr_carpeta_asegurar(carpeta_nombre, token)
  }

  subido <- .cdr_drive_upload(
    metadata = list(
      name = as.character(recibo$filename %||% registro$original_name %||% basename(path))[1],
      parents = list(carpeta_id)
    ),
    path = path,
    media_type = as.character(recibo$media_type %||% "application/octet-stream")[1],
    token = token
  )

  publicacion <- list(
    receipt_id = receipt_id,
    drive_file_id = as.character(subido$id %||% "")[1],
    web_view_link = as.character(subido$webViewLink %||% "")[1],
    folder_id = carpeta_id,
    uploaded_at = .collection_now_iso()
  )

  # Solo DESPUES del upload exitoso se escribe: carpeta recordada +
  # publicacion anotada, en una mutacion atomica con revision nueva.
  siguiente <- .collection_current(session_get(sid))
  siguiente$drive_fichas <- list(folder_id = carpeta_id, folder_name = carpeta_nombre)
  siguiente$drive_publicaciones <- c(siguiente$drive_publicaciones %||% list(), list(publicacion))
  siguiente$state_revision <- as.integer(siguiente$state_revision) + 1L
  .collection_store(sid, siguiente)

  list(
    ok = TRUE,
    drive_file_id = publicacion$drive_file_id,
    web_view_link = publicacion$web_view_link,
    folder_id = carpeta_id,
    folder_name = carpeta_nombre,
    filename = as.character(recibo$filename %||% "")[1],
    receipt_id = receipt_id,
    state = collection_state_get(sid)
  )
}
