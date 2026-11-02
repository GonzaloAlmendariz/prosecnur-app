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
  # Una fuente mal formada no debe tumbar la lectura de la campaña: cuenta como «no es esta».
  ids <- vapply(fuentes, function(f) {
    .mtf_txt(tryCatch(.monitoreo_sheet_binding(f)$spreadsheet_id, error = function(e) ""))
  }, character(1))
  cuando <- .mtf_txt(b$actualizado_en)
  list(construido = TRUE, url = sprintf("https://docs.google.com/spreadsheets/d/%s/edit", id),
       pestana = pestana, actualizado_en = if (nzchar(cuando)) cuando else NULL,
       conectado_en_monitoreo = id %in% ids)
}
