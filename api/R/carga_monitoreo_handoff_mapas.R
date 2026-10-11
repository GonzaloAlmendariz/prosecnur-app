# Mapas de códigos del editor en el puente Monitoreo -> Procesamiento (H5).
#
# Misma regla de procedencia que el import de plataforma (N4,
# `.carga_platform_choice_code_maps`): los `choice_code_maps` del editor sólo se
# aplican si el formulario que los trae es el de la MISMA encuesta que los datos
# del handoff. Antes el handoff tomaba los mapas del formulario ACTIVO sin mirar
# de qué encuesta era, y con un formulario de otra encuesta abierto recodificaba
# categorías en silencio (Si<->No).
#
# - Kobo nunca hereda mapas (Kobo no produce `surveyMonkeyLogic`).
# - SurveyMonkey: sólo los del formulario cuyo `source$survey_id` coincide.
# - Si la fuente no declara proveedor o identificador, no hay procedencia: no se
#   aplica nada y se declara.
# Devuelve list(maps, aplicados, mapas_omitidos, proveedor, fuente_id). Cuando
# no se aplican mapas, `mapas_omitidos` dice por qué; nunca queda en silencio.

.CARGA_HANDOFF_MAPAS_KOBO <- c("kobo", "kobo_api", "monitoreo_kobo")
.CARGA_HANDOFF_MAPAS_SM <- c("surveymonkey", "surveymonkey_api", "sm")

.carga_handoff_mapas_proveedor <- function(kind) {
  kind <- tolower(.carga_chr1(kind, ""))
  if (kind %in% .CARGA_HANDOFF_MAPAS_KOBO) return("kobo")
  if (kind %in% .CARGA_HANDOFF_MAPAS_SM) return("surveymonkey")
  ""
}

.carga_handoff_choice_maps <- function(sid, source) {
  source <- source %||% list()
  proveedor <- .carga_handoff_mapas_proveedor(source$kind)
  fuente_id <- if (identical(proveedor, "kobo")) {
    .carga_chr1(source$asset_uid %||% source$kobo_asset_uid, "")
  } else {
    .carga_chr1(source$survey_id %||% source$surveyId, "")
  }
  omitido <- function(motivo) {
    list(maps = NULL, aplicados = FALSE, mapas_omitidos = motivo,
         proveedor = proveedor, fuente_id = fuente_id)
  }
  if (identical(proveedor, "kobo")) return(omitido("fuente kobo"))
  if (!nzchar(proveedor) || !nzchar(fuente_id)) return(omitido("sin procedencia"))
  maps <- .carga_platform_choice_code_maps(sid, proveedor, fuente_id)
  if (!length(maps)) return(omitido("sin formulario de la misma encuesta"))
  list(maps = maps, aplicados = TRUE, mapas_omitidos = NULL,
       proveedor = proveedor, fuente_id = fuente_id)
}

# Bloque serializable para el resultado del handoff.
.carga_handoff_mapas_payload <- function(mapas) {
  list(
    aplicados = isTRUE(mapas$aplicados),
    mapas_omitidos = mapas$mapas_omitidos %||% NULL,
    proveedor = .carga_chr1(mapas$proveedor, ""),
    fuente_id = .carga_chr1(mapas$fuente_id, "")
  )
}
