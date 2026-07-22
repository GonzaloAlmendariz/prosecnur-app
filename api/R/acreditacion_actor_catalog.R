# =============================================================================
# Catálogo canónico de actores de acreditación
# =============================================================================
#
# Editor e intake deben validar contra la misma lectura que alimenta las
# sugerencias de Procesamiento: perfil de acreditación y fuentes activas de
# respuestas SurveyMonkey/Kobo. La derivación del actor se mantiene en los
# helpers `.estudio_suggestion_*`; este helper no introduce unidades paralelas.

.ACREDITACION_ACTOR_INSTRUMENT_SCHEMA <-
  "acreditacion_actor_instrument_draft/v1"

.acreditacion_actor_profile_active <- function(s) {
  profile <- .estudio_suggestion_profile(s)
  identical(
    .estudio_suggestion_key(.estudio_scalar(profile$family, "")),
    "acreditacion"
  )
}

.acreditacion_actor_instrument <- function(source) {
  source <- source %||% list()
  if (!is.list(source)) source <- list()
  identical(
    .estudio_scalar(source$schema, ""),
    .ACREDITACION_ACTOR_INSTRUMENT_SCHEMA
  )
}

.acreditacion_actor_catalog <- function(s) {
  if (!.acreditacion_actor_profile_active(s)) return(character(0))

  sources <- lapply(
    .estudio_suggestion_sources(s),
    .estudio_suggestion_source_payload
  )
  sources <- Filter(function(source) {
    if (!isTRUE(source$enabled) ||
        !(source$kind %in% c("surveymonkey", "kobo"))) {
      return(FALSE)
    }
    .estudio_suggestion_key(source$role) %in% c("", "respuestas", "respuesta") ||
      nzchar(source$survey_id) || nzchar(source$asset_uid)
  }, sources)
  if (!length(sources)) return(character(0))

  actor_keys <- vapply(sources, function(source) {
    actor <- source$actor
    if (!nzchar(actor)) {
      actor <- source$label %||% source$title %||% "Sin actor"
    }
    .estudio_suggestion_slug(actor, "sin_actor")
  }, character(1))
  unique(actor_keys[nzchar(actor_keys) & actor_keys != "sin_actor"])
}
