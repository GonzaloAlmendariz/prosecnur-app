# collection_barrido_estado.R — Telefónica › Barrido (revamp de Material v5, ADR 0125 §4):
# qué documento es el barrido de esta campaña, cuándo se construyó su pestaña y si Monitoreo
# ya lo conectó como fuente. Es lectura pura del estado: Material no toca las fuentes de
# Monitoreo, sólo mira si el mismo Sheets está entre ellas.

.mtel_barrido_estado <- function(s, campaign_id) {
  b <- s$material_telefonica_sheets %||% list()
  id <- .mtf_txt(b$spreadsheet_id)
  pestana <- .mtf_txt((b$pestanas %||% list())[[campaign_id]])
  if (!nzchar(id) || !nzchar(pestana)) {
    return(list(construido = FALSE, url = NULL, pestana = NULL, actualizado_en = NULL,
                conectado_en_monitoreo = FALSE))
  }
  fuentes <- Filter(function(f) is.list(f) && identical(.mtf_txt(f$kind), "google_sheets"),
                    s$monitoreo_sources %||% list())
  # Cuenta como conectada sólo la fuente que apunta a ESTE documento y a la pestaña de ESTA
  # campaña: varias rondas comparten el Sheets, cada una en su pestaña. Una fuente sin pestaña
  # declarada lee la primera hoja, así que no se toma como conexión de ninguna ronda en particular.
  # Una fuente mal formada no debe tumbar la lectura de la campaña: cuenta como «no es esta».
  conectada <- vapply(fuentes, function(f) {
    b <- tryCatch(.monitoreo_sheet_binding(f), error = function(e) list())
    identical(.mtf_txt(b$spreadsheet_id), id) && identical(.mtf_txt(b$sheet_name), pestana)
  }, logical(1))
  cuando <- .mtf_txt(b$actualizado_en)
  list(construido = TRUE, url = sprintf("https://docs.google.com/spreadsheets/d/%s/edit", id),
       pestana = pestana, actualizado_en = if (nzchar(cuando)) cuando else NULL,
       conectado_en_monitoreo = any(conectada))
}
