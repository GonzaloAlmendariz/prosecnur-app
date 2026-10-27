# Literales hex del motor de entregables que no son colores del estándar (checklist-recetario-desfase, P8).
# Lo usan test-hex-fuera-del-estandar.R y, para regenerar la lista de excepciones, el script del checklist.

.HEX_ARCHIVOS_ENTREGABLES <- "^(graficador_|lamina_|reporte_plan_|reporte_ppt_|reporte_word_|reporte_slide_|reporte_lamina_|graficos_).*[.]R$"

.hex_del_estandar <- function(ruta_json) {
  out <- character()
  walk <- function(o) {
    if (is.list(o)) for (v in o) walk(v)
    else if (is.character(o)) out <<- c(out, o[grepl("^#[0-9A-Fa-f]{6}$", o)])
  }
  walk(jsonlite::fromJSON(ruta_json, simplifyVector = FALSE))
  unique(toupper(out))
}

# Pares (archivo, hex) de los literales de cadena, sin comentarios, con hex fuera del estándar; blanco y negro no cuentan.
.hex_fuera_del_estandar <- function(dir_r, ruta_json) {
  std <- c(.hex_del_estandar(ruta_json), "#FFFFFF", "#000000")
  fs <- list.files(dir_r, pattern = .HEX_ARCHIVOS_ENTREGABLES, full.names = TRUE)
  filas <- lapply(fs, function(f) {
    pd <- utils::getParseData(parse(f, keep.source = TRUE))
    t <- pd$text[pd$token == "STR_CONST"]
    hex <- toupper(gsub("[\"']", "", t[grepl('^["\']#[0-9A-Fa-f]{6}["\']$', t)]))
    hex <- unique(setdiff(hex, std))
    if (length(hex)) data.frame(archivo = basename(f), hex = sort(hex), stringsAsFactors = FALSE) else NULL
  })
  out <- do.call(rbind, filas)
  if (is.null(out)) data.frame(archivo = character(), hex = character()) else out[order(out$archivo, out$hex), ]
}
