# ¿El estudio tiene canal telefónico? Sin él, el arranque de Acreditación no
# prepara el tablero telefónico (`phone_summary`), que costaba ~6 s del warm start
# de un estudio sólo de correo (Acreditación 2026: 6 encuestas de SurveyMonkey
# por Mailchimp y 6 padrones de Google Sheets, ningún público con teléfono).
#
# Conservador: sin públicos ni fuentes declarados no se sabe, y se prepara
# como antes. Si una vista lo necesita, el scope se pide al entrar.
.monitoreo_estudio_usa_telefono <- function(config = list(), sources = list()) {
  units <- ((config %||% list())$monitoreo_profile %||% list())$units %||% list()
  fuentes <- if (is.list(sources) && !is.null(sources$sources)) sources$sources else sources
  if (!length(units) && !length(fuentes)) return(TRUE)
  for (unit in units) {
    phone <- if (is.list(unit)) unit$phone %||% unit$telefono %||% list() else list()
    if (is.list(phone) && isTRUE(.monitoreo_bool(phone$enabled %||% phone$activo, FALSE))) return(TRUE)
  }
  es_telefono <- function(texto) grepl("telef|phone|llamad", .monitoreo_text_key(.monitoreo_scalar(texto, "")))
  for (fuente in fuentes) {
    if (!is.list(fuente)) next
    dims <- fuente$dimensions %||% list()
    if (es_telefono(dims$canal %||% dims$channel %||% fuente$channel %||% "") ||
        es_telefono(fuente$role %||% "") ||
        identical(.monitoreo_text_key(.monitoreo_scalar(fuente$role, "")), "barrido")) {
      return(TRUE)
    }
  }
  FALSE
}
