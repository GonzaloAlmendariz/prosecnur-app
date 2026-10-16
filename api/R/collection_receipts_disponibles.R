# Disponibilidad del archivo de cada recibo de material (H23).
#
# El recibo se persiste en `collection_state$artifact_receipts` y viaja dentro
# del .pulso; el archivo que describe vive en el file store de la sesion
# (`s$files`), que `build_pulso` no copia. Al reabrir, el recibo sigue y el
# archivo no, y `GET /api/files/<id>/download` responde 404 E_NO_FILE.
#
# `file_available` es por eso un hecho de ESTA sesion, no del recibo: se deriva
# al armar el payload y nunca se escribe en `collection_state` ni en el .pulso.

.collection_receipt_file_available <- function(session, file_id) {
  if (!is.character(file_id) || length(file_id) != 1L || is.na(file_id) || !nzchar(file_id)) {
    return(FALSE)
  }
  meta <- (session$files %||% list())[[file_id]]
  if (!is.list(meta)) return(FALSE)
  path <- meta$path
  is.character(path) && length(path) == 1L && !is.na(path) && file.exists(path)
}

# Marca cada recibo del payload con `file_available`. Opera sobre la copia del
# estado que va al cliente; el estado de la sesion no se toca.
.collection_receipts_con_disponibilidad <- function(payload, session) {
  receipts <- payload$state$artifact_receipts
  if (!is.list(payload$state) || !is.list(receipts) || !length(receipts)) return(payload)
  payload$state$artifact_receipts <- lapply(receipts, function(receipt) {
    if (!is.list(receipt)) return(receipt)
    receipt$file_available <- .collection_receipt_file_available(session, receipt$file_id)
    receipt
  })
  payload
}
