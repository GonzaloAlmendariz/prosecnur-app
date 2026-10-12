# carga_sm_agregar_fuente.R — «Agregar otra fuente a esta base» (propuesta F2, aprobada por Gonzalo 2026-10-11: «una de
# las bases es complementaria, por ejemplo un actor por dos vías»). Une las encuestas de SurveyMonkey de un mismo actor
# (por ejemplo QR en aula y correo) en UNA base, con el canal de cada respuesta.
#
# Cómo, sin perder nada de la base:
#   1. Las fuentes de la base (las que ya tenía + la nueva) se importan con `sm_multibase_import()` en una base
#      TEMPORAL. Ahí corre la auditoría: si las encuestas no tienen las mismas preguntas, falla con sus diferencias y
#      la base original no se toca.
#   2. Los archivos de la temporal pasan a la base original con `estudio_replace_base_files()`, que conserva su nombre
#      y su configuración por base (codificación, analítica, gráficos). `estudio_remove_base()` no sirve para el
#      cambio: borra esa configuración.
#   3. La temporal se quita y la base guarda la lista de sus fuentes en `surveymonkey_source_spec$sources`, la forma
#      que ya lee el resumen de fuentes de la base (`.estudio_sm_source_items`, router_estudio.R) y que el payload
#      publica como `surveymonkey_sources`.

#' Las fuentes SurveyMonkey que ya tiene una base: su lista, o la encuesta única con la que se importó
#' @keywords internal
.carga_sm_fuentes_de_base <- function(meta) {
  previas <- (meta$surveymonkey_source_spec %||% list())$sources
  if (is.list(previas) && length(previas)) return(unname(previas))
  encuesta <- .carga_chr1(meta$survey_id, "")
  if (!nzchar(encuesta) || !identical(.carga_chr1(meta$source_kind, "surveymonkey"), "surveymonkey")) {
    stop_api(409, "E_BASE_SIN_ENCUESTA",
             "Esta base no viene de SurveyMonkey: para sumarle otra encuesta, impórtala primero desde SurveyMonkey.")
  }
  list(list(
    survey_id = encuesta,
    source_title = .carga_chr1(meta$source_title, ""),
    source_alias = .carga_chr1(meta$source_alias, ""),
    channel = .carga_chr1(meta$source_channel, "")
  ))
}

#' Las fuentes con la nueva al final; la misma encuesta por el mismo canal no se suma dos veces
#' @keywords internal
.carga_sm_fuentes_con_nueva <- function(previas, nueva) {
  misma <- vapply(previas, function(p) {
    identical(.carga_chr1(p$survey_id, ""), .carga_chr1(nueva$survey_id, "")) &&
      identical(.carga_chr1(p$channel %||% p$source_channel, ""), .carga_chr1(nueva$channel, ""))
  }, logical(1))
  if (any(misma)) stop_api(409, "E_FUENTE_REPETIDA", "Esa encuesta ya es una fuente de esta base por ese mismo canal.")
  c(previas, list(nueva))
}

.carga_sm_agregar_fuente <- function(sid, parsed) {
  base <- .carga_chr1(parsed$base_name %||% parsed$baseName, "")
  bases <- estudio_list_bases(sid)
  if (!nzchar(base) || is.null(bases[[base]])) stop_api(404, "E_BASE_NOT_FOUND", "No encuentro esa base en el estudio.")
  meta <- bases[[base]]
  nueva <- list(
    survey_id = .carga_chr1(parsed$survey_id %||% parsed$surveyId, ""),
    source_title = .carga_chr1(parsed$title, ""),
    source_alias = .carga_chr1(parsed$title, ""),
    channel = .carga_chr1(parsed$source_channel %||% parsed$channel, "")
  )
  if (!nzchar(nueva$survey_id)) stop_api(400, "E_SM_SURVEY_REQUIRED", "Selecciona una encuesta SurveyMonkey.")
  fuentes <- .carga_sm_fuentes_con_nueva(.carga_sm_fuentes_de_base(meta), nueva)
  token <- .connections_token_require("surveymonkey", sid,
                                      profile_id = parsed$connection_profile_id %||% parsed$profile_id %||% NULL)

  temporal <- paste0(base, "_fuentes_nuevas")
  res <- sm_multibase_import(sid, fuentes, token, canonical_file_id = .carga_chr1(meta$xlsform_file_id, ""),
                             base_name = temporal)
  creada <- .carga_chr1(res$base$nombre, temporal)
  # Si algo falla después de crear la temporal, no debe quedar como una base más del estudio. El `try` es a propósito:
  # en la salida normal ya se quitó, y un error al limpiar no puede tapar el error original.
  on.exit(if (!is.null(estudio_list_bases(sid)[[creada]])) try(estudio_remove_base(sid, creada), silent = TRUE), add = TRUE)

  s <- session_get(sid)
  meta_tmp <- s$estudio$bases[[creada]]
  estudio_replace_base_files(
    sid, base,
    xlsform_file_id = meta_tmp$xlsform_file_id,
    data_file_id = meta_tmp$data_file_id,
    data_ext = "xlsx",
    rp_data = s$rp_data_sources[[creada]],
    rp_inst = s$rp_inst_sources[[creada]],
    n_filas = as.integer(res$n_filas),
    n_columnas = as.integer(res$n_columnas)
  )
  estudio_remove_base(sid, creada)
  .carga_sm_guardar_fuentes(sid, base, fuentes)

  list(ok = TRUE, base_name = base, n_filas = as.integer(res$n_filas), n_fuentes = length(fuentes),
       audit = res$audit, estudio = .estudio_payload(sid))
}

#' Guarda en la base la lista de sus fuentes SurveyMonkey dentro de su `surveymonkey_source_spec`
#' @keywords internal
.carga_sm_guardar_fuentes <- function(sid, base, fuentes) {
  s <- session_get(sid)
  spec <- s$estudio$bases[[base]]$surveymonkey_source_spec
  if (!is.list(spec)) spec <- list()
  spec$sources <- fuentes
  s$estudio$bases[[base]]$surveymonkey_source_spec <- spec
  s$estudio$bases[[base]]$source_kind <- "surveymonkey"
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(fuentes)
}
