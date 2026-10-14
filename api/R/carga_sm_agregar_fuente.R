# carga_sm_agregar_fuente.R — «Agregar otra fuente a esta base» (propuesta F2, aprobada por Gonzalo 2026-10-11: «una de
# las bases es complementaria, por ejemplo un actor por dos vías»). Une las encuestas de SurveyMonkey de un mismo actor
# (por ejemplo QR en aula y correo) en UNA base, con el canal de cada respuesta.
#
# Cómo, sin perder nada de la base (F2b):
#   1. La encuesta nueva se empareja con el formulario de la base pregunta por pregunta (ADR 0099). Si calza menos del
#      80 %, es otro cuestionario: va como base aparte. Las preguntas que trae de más se AGREGAN al formulario de la
#      base (carga_sm_fuente_extra.R); las que le faltan quedan vacías en sus filas.
#   2. Sólo la fuente nueva se descarga y se codifica contra ese formulario; sus filas se suman a las que la base ya
#      tenía. No depende del modo del estudio (el refresh SM sólo existe para hermanas independientes).
#   3. Los archivos nuevos pasan a la base con `estudio_replace_base_files()`, que conserva su nombre y su
#      configuración por base (codificación, analítica, gráficos). `estudio_remove_base()` no sirve: la borra.
#   4. La base guarda la lista de sus fuentes en `surveymonkey_source_spec$sources`, la forma
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

#' Lo común a la vista previa y a la unión: la base, la encuesta nueva, su alineación con el formulario de la base y
#' las preguntas que trae de más (ADR 0099, enmienda F2b)
#' @keywords internal
.carga_sm_preparar_fuente <- function(sid, parsed) {
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
  base_path <- get_file(sid, .carga_chr1(meta$xlsform_file_id, ""))$path
  inst_base <- reporte_instrumento(path = base_path)
  details <- sm_api_fetch_survey_details(nueva$survey_id, token)
  inst_fuente <- .sm_mb_inst_generado(details)
  al <- .sm_mb_alinear_fuente(inst_base, inst_fuente)
  if (isTRUE(al$instrumento_distinto)) {
    stop_api(409, "E_FUENTE_OTRO_INSTRUMENTO", sprintf(
      "Esta encuesta comparte sólo el %s %% de las preguntas de «%s»: parece otro cuestionario. Agrégala como una base aparte.",
      .sm_mb_cobertura_texto(al$cobertura), base))
  }
  list(base = base, meta = meta, nueva = nueva, fuentes = fuentes, token = token, base_path = base_path,
       inst_base = inst_base, details = details, inst_fuente = inst_fuente, al = al)
}

#' Qué pasaría al unir, sin escribir nada: cuántas preguntas calzan, cuáles trae de más y cuáles le faltan
#' @keywords internal
.carga_sm_vista_previa_fuente <- function(sid, parsed) {
  p <- .carga_sm_preparar_fuente(sid, parsed)
  extra <- p$al$sin_par_fuente
  faltan <- p$al$sin_par_base
  list(
    ok = TRUE,
    base_name = p$base,
    titulo = .carga_chr1(p$details$title, p$nueva$source_title),
    n_emparejadas = as.integer(p$al$n_emparejadas),
    n_preguntas_base = as.integer(p$al$n_preguntas_base),
    extra = lapply(seq_len(NROW(extra)), function(i) list(variable = extra$variable[i], etiqueta = extra$etiqueta[i])),
    faltan = lapply(seq_len(NROW(faltan)), function(i) list(variable = faltan$variable[i], etiqueta = faltan$etiqueta[i]))
  )
}

.carga_sm_agregar_fuente <- function(sid, parsed) {
  p <- .carga_sm_preparar_fuente(sid, parsed)
  extra <- as.character(p$al$sin_par_fuente$variable %||% character(0))

  # 1. El formulario de la base, extendido con las preguntas que la fuente trae de más.
  .carga_job_progress("form", message = "Preparando el formulario de la base...")
  base_form <- .carga_sm_leer_form(p$base_path)
  ext <- .carga_sm_form_con_extra(base_form, sm_api_xlsform(p$details, style = .sm_api_default_style(), lang = "es"), extra)
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  form_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", p$base, "_xlsform.xlsx"))
  .sm_mb_write_xlsform_model(ext$form, form_path)
  inst_ext <- reporte_instrumento(path = form_path)

  # 2. Sólo la fuente nueva se descarga y se codifica contra ese formulario (alineada por pregunta, ADR 0099).
  .carga_job_progress("fetch", message = "SurveyMonkey: descargando la encuesta nueva...")
  respuestas <- .carga_platform_fetch_sm_bulk(p$nueva$survey_id, p$token)$data %||% list()
  nuevas <- .sm_mb_codificar_fuente(
    details_fuente = p$details, responses = respuestas, inst_base = inst_ext, survey_id = p$nueva$survey_id,
    inst_fuente = p$inst_fuente, source_title = .carga_chr1(p$details$title, p$nueva$source_title),
    source_channel = p$nueva$channel
  )
  if (!NROW(nuevas)) stop_api(409, "E_SM_NO_RESPONSES", "La encuesta nueva no tiene respuestas completas para unir.")

  # 3. Sus filas se suman a las que la base ya tenía; las preguntas nuevas quedan vacías en las filas anteriores.
  .carga_job_progress("normalize", message = "Uniendo las respuestas...")
  previas <- .sm_mb_read_base_original_data(sid, p$meta)
  data_df <- normalize_data_for_xlsform(.sm_mb_bind_rows(list(previas, nuevas)), inst_ext, choice_code_maps = list())
  .carga_assert_data_xlsform_compatible(data_df, inst_ext)
  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", p$base, "_data.xlsx"))
  .sm_mb_write_xlsx(data_df, data_path)
  inst_meta <- save_upload(sid, "xlsform", paste0(p$base, "_xlsform.xlsx"), readBin(form_path, "raw", n = file.info(form_path)$size))
  data_meta <- save_upload(sid, "data", paste0(p$base, "_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))
  inst_final <- reporte_instrumento(path = inst_meta$path)

  # 4. La base conserva su nombre y su configuración: sólo cambian sus archivos.
  estudio_replace_base_files(
    sid, p$base,
    xlsform_file_id = inst_meta$file_id, data_file_id = data_meta$file_id, data_ext = "xlsx",
    rp_data = reporte_data(data_df, instrumento = inst_final), rp_inst = inst_final,
    n_filas = as.integer(nrow(data_df)), n_columnas = as.integer(ncol(data_df))
  )
  .carga_sm_guardar_fuentes(sid, p$base, p$fuentes)

  list(ok = TRUE, base_name = p$base, n_filas = as.integer(nrow(data_df)), n_nuevas = as.integer(nrow(nuevas)),
       n_fuentes = length(p$fuentes),
       agregadas = lapply(seq_len(NROW(ext$agregadas)), function(i) as.list(ext$agregadas[i, , drop = FALSE])),
       estudio = .estudio_payload(sid))
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
