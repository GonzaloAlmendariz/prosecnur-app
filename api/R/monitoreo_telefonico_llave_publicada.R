# =============================================================================
# monitoreo_telefonico_llave_publicada.R — el código que se publica por caso
# =============================================================================
#
# `.monitoreo_report_phone_blocks` (monitoreo_telefonico.R) publica en cada
# fila del barrido un código para mostrar y cruzar (CodPulso de
# comparacion_codpulso, Insistencia, Discrepancias, Supervisión). Lo buscaba
# con `.monitoreo_report_col`, cuyo respaldo por subcadena encuentra el alias
# «id» dentro de `.source_id`: con un barrido sin CodPulso (RMS, llave
# «Código proGres») publicaba el id de la fuente («rms_barrido») en todas las
# filas y pisaba la llave real con la que el avance sí cruzaba. Llave y
# Respuestas decían «0 de N cruzan» y el proGres de Discrepancias colisionaba.
#
# Regla: la columna de código es una columna del estudio (nunca las de
# metadatos de fuente, que empiezan por «.»). Primero por nombre exacto en el
# orden de los alias; la búsqueda por subcadena solo con alias de al menos
# cuatro letras (ni «id» ni «ID»). La columna proGres que reconoce
# `monitoreo_llave_progres.R` tampoco: sin CodPulso, el motor publica la llave
# del cruce (proGres normalizado), la misma que publica Kobo en
# control_tiempo_kobo, y Llave/Respuestas cruzan tal cual, no «por dígitos».
# =============================================================================

.MONITOREO_TELEFONICO_CODIGO_ALIAS <- c(
  "CodPulso", "Cod Pulso", "Cód Pulso", "Codigo Pulso", "Código Pulso", "Código PUCP", "Codigo PUCP",
  "ID", "id", "codigo", "Código", "Codigo"
)

#' Columna del barrido con el código del caso, o "".
#' @noRd
.monitoreo_telefonico_columna_codigo <- function(phone, aliases = .MONITOREO_TELEFONICO_CODIGO_ALIAS) {
  if (is.null(phone) || !is.data.frame(phone) || !ncol(phone)) return("")
  progres <- names(phone)[.monitoreo_progres_columnas(
    phone, .monitoreo_variable_label_map(phone), .monitoreo_source_variable_label_map(phone)
  )]
  nombres <- setdiff(names(phone)[!startsWith(names(phone), ".")], progres)
  if (!length(nombres)) return("")
  claves <- .monitoreo_text_key(nombres)
  buscados <- .monitoreo_text_key(aliases)
  for (alias in buscados) {
    idx <- which(claves == alias)
    if (length(idx)) return(nombres[[idx[[1]]]])
  }
  for (alias in buscados[nchar(buscados) >= 4L]) {
    idx <- which(grepl(alias, claves, fixed = TRUE))
    if (length(idx)) return(nombres[[idx[[1]]]])
  }
  ""
}

#' La llave del cruce sin su prefijo de tipo («codigo:CGU269000061» →
#' «CGU269000061»): la misma forma que publica Kobo (`phone_key_display`).
#' @noRd
.monitoreo_telefonico_llave_visible <- function(value) {
  value <- .monitoreo_scalar(value, "")
  if (!nzchar(value)) return("")
  sub("^(codpulso|cod pulso|codigo|código|id|cv_id|custom_value):", "", value, ignore.case = TRUE)
}
