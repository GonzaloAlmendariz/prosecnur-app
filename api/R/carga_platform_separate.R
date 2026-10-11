# carga_platform_separate.R — imports de plataforma (SurveyMonkey / Kobo) para la
# estrategia «bases separadas» de Carga, y la preparación compartida
# (fetch + normalización + escritura) que reutilizan también los imports de base
# única de router_carga.R.
#
# Diferencia con los otros caminos:
#   - base única (`surveymonkey_import`, `kobo_import`): termina en
#     `.carga_platform_finalize()`, que SIEMPRE reescribe la base `default` y el
#     instrumento single-base de la sesión.
#   - hermanas independientes (`kobo_import_independent`, SM multibase
#     independiente): exigen `processing_mode = "independent_siblings"`.
#   - separadas (este archivo): el estudio sigue en `processing_mode =
#     "multibase"` y la fuente se AGREGA como una base nueva con nombre propio vía
#     `estudio_add_base()` —el mismo registro que la carga manual por carriles
#     (`POST /api/estudio/base`)—. Las bases hermanas, la base activa y el
#     instrumento single-base no se tocan.
#
# Base de escritura: SOLO la base nueva (`base_name`; y sus hijas de repeat en
# Kobo). Base de lectura: ninguna existente (el instrumento y la data salen de la
# plataforma). Nunca cae implícitamente en la primera base ni en `default`.

# ---------------------------------------------------------------------------
# Preparación compartida (sin registrar nada en el estudio)
# ---------------------------------------------------------------------------

# SurveyMonkey: estructura → XLSForm en el file store → respuestas normalizadas
# → data XLSX en el file store. Devuelve todo lo que necesita quien registra.
.carga_sm_prepare_import <- function(sid, parsed) {
  survey_id <- trimws(as.character(parsed$survey_id %||% parsed$surveyId %||% ""))
  if (!nzchar(survey_id)) stop_api(400, "E_SM_SURVEY_REQUIRED", "Selecciona una encuesta SurveyMonkey.")
  base_url <- trimws(as.character(parsed$base_url %||% parsed$baseUrl %||% "https://api.surveymonkey.com/v3"))
  profile_id <- parsed$connection_profile_id %||% parsed$profile_id %||% parsed$profileId %||% NULL
  token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
  statuses <- as.character(unlist(parsed$response_statuses %||% parsed$responseStatuses %||% list("completed"), use.names = FALSE))
  statuses <- statuses[!is.na(statuses) & nzchar(statuses)]
  if (!length(statuses)) statuses <- "completed"
  keep_missing <- isTRUE(parsed$keep_missing_status %||% parsed$keepMissingStatus)

  .carga_job_progress("fetch", message = "SurveyMonkey: leyendo estructura de la encuesta...")
  details <- sm_api_fetch_survey_details(survey_id, token, base_url = base_url)
  xls_model <- sm_api_xlsform(details, style = .sm_api_default_style(), lang = "es")
  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)

  title <- trimws(as.character(details$title %||% parsed$title %||% paste("SurveyMonkey", survey_id)))
  slug <- .carga_slug(title, paste0("surveymonkey_", survey_id))
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_xlsform.xlsx"))
  .carga_write_xlsform_model(xls_model, inst_path)
  inst_meta <- save_upload(sid, "xlsform", paste0(slug, "_xlsform.xlsx"), readBin(inst_path, "raw", n = file.info(inst_path)$size))
  rp_inst <- reporte_instrumento(path = inst_meta$path)

  payload <- .carga_platform_fetch_sm_bulk(survey_id, token, base_url = base_url)
  .carga_job_progress("normalize", message = "Normalizando respuestas...")
  data_df <- sm_multibase_api_responses_to_canonical_data(
    details = details,
    responses = payload$data %||% list(),
    inst = rp_inst,
    survey_id = survey_id,
    source_title = title,
    source_channel = as.character(parsed$source_channel %||% parsed$channel %||% ""),
    response_statuses = statuses,
    keep_missing_status = keep_missing
  )
  response_filter <- attr(data_df, "sm_response_filter", exact = TRUE) %||% list()
  data_df <- if (is.data.frame(data_df) && nrow(data_df)) {
    normalize_data_for_xlsform(data_df, rp_inst, choice_code_maps = .carga_editor_choice_code_maps(sid))
  } else {
    .carga_empty_data_for_instrument(rp_inst)
  }
  # Backfill benigno (import por API): una columna esperada ausente = pregunta
  # sin respuestas en el mismo asset, no un desajuste de versión.
  data_df <- .carga_backfill_missing_expected(data_df, rp_inst)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)

  .carga_job_progress("write", message = "Escribiendo base importada...")
  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_data.xlsx"))
  .carga_write_xlsx_sheet(data_df, data_path, "datos")
  data_meta <- save_upload(sid, "data", paste0(slug, "_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))

  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  source_spec <- list(
    survey_id = survey_id,
    source_title = title,
    source_alias = trimws(as.character(parsed$source_alias %||% parsed$label %||% title)),
    source_channel = as.character(parsed$source_channel %||% parsed$channel %||% ""),
    response_statuses = as.list(statuses),
    keep_missing_status = keep_missing,
    base_url = base_url,
    connection_profile_id = as.character(profile_id %||% "")
  )
  response_filter$kind <- "surveymonkey_api"
  response_filter$survey_id <- survey_id
  response_filter$source_title <- title
  response_filter$imported_at <- imported_at

  list(
    survey_id = survey_id,
    title = title,
    slug = slug,
    inst_meta = inst_meta,
    data_meta = data_meta,
    rp_inst = rp_inst,
    data_df = data_df,
    source_spec = source_spec,
    response_filter = response_filter,
    imported_at = imported_at
  )
}

# Kobo: detalle del asset → XLSForm → data aplanada, alineada y normalizada.
# `repeat_source_df` conserva los blobs de repeat (ADR 0030) para expandir las
# bases hijas después de registrar la madre.
.carga_kobo_prepare_import <- function(sid, parsed) {
  asset_uid <- trimws(as.character(parsed$asset_uid %||% parsed$assetUid %||% ""))
  if (!nzchar(asset_uid)) stop_api(400, "E_KOBO_ASSET_REQUIRED", "Selecciona un proyecto Kobo.")
  profile_id <- parsed$connection_profile_id %||% parsed$profile_id %||% parsed$profileId %||% NULL
  base_url <- trimws(as.character(parsed$base_url %||% parsed$baseUrl %||% ""))
  if (!nzchar(base_url)) base_url <- .connections_profile_base_url("kobo", profile_id)
  if (!nzchar(base_url)) base_url <- kobo_api_default_base_url()
  token <- .connections_token_require("kobo", sid, profile_id = profile_id, base_url = base_url)
  .carga_job_progress("fetch", message = "Kobo: leyendo estructura del proyecto...")
  detail_url <- sprintf(
    "%s/api/v2/assets/%s/?format=json",
    .kobo_api_trim_base_url(base_url),
    utils::URLencode(asset_uid, reserved = TRUE)
  )
  detail <- .kobo_api_fetch_json(detail_url, token)
  xls_model <- .carga_kobo_xlsform_model(detail)

  downloads_dir <- file.path(session_get(sid)$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  title <- trimws(as.character(detail$name %||% parsed$title %||% parsed$name %||% paste("Kobo", asset_uid)))
  slug <- .carga_slug(title, paste0("kobo_", asset_uid))
  inst_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_xlsform.xlsx"))
  .carga_write_xlsform_model(xls_model, inst_path)
  inst_meta <- save_upload(sid, "xlsform", paste0(slug, "_xlsform.xlsx"), readBin(inst_path, "raw", n = file.info(inst_path)$size))
  rp_inst <- reporte_instrumento(path = inst_meta$path)

  payload <- .carga_platform_fetch_kobo(asset_uid, token, base_url)
  .carga_job_progress("normalize", message = "Normalizando respuestas...")
  data_df <- kobo_api_flatten_results(payload$results %||% list())
  data_df <- .carga_align_kobo_data(data_df, rp_inst)
  # Conservamos la data aplanada+alineada (con los blobs de repeat y las llaves
  # de enlace _id/_uuid) para expandir los repeats a bases hijas DESPUÉS de
  # registrar la base ancha. Sólo cuando el instrumento tiene begin_repeat le
  # fijamos `_index` = 1..N (ADR 0030): la base ancha recibe el mismo índice
  # (mismo orden de fila) para que `_parent_index` de la hija case con `_index`.
  has_repeats <- length(.kobo_repeat_specs(rp_inst)) > 0L
  repeat_source_df <- if (has_repeats) .kobo_ensure_wide_index(data_df) else data_df
  # Backfill benigno: form y data salen del mismo asset, así que una columna
  # esperada ausente = pregunta sin respuestas (Kobo omite columnas vacías).
  data_df <- .carga_backfill_missing_expected(data_df, rp_inst)
  data_df <- if (is.data.frame(data_df) && nrow(data_df)) {
    normalize_data_for_xlsform(data_df, rp_inst, choice_code_maps = .carga_editor_choice_code_maps(sid))
  } else {
    .carga_empty_data_for_instrument(rp_inst)
  }
  # Los repeat groups de Kobo llegan como una columna JSON-string; la base ancha
  # no puede representarlos. Quitamos ese blob del padre (se expande aparte).
  data_df <- .kobo_drop_repeat_blob_columns(data_df, rp_inst)
  if (has_repeats) data_df <- .kobo_ensure_wide_index(data_df)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)

  .carga_job_progress("write", message = "Escribiendo base importada...")
  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_data.xlsx"))
  .carga_write_xlsx_sheet(data_df, data_path, "datos")
  data_meta <- save_upload(sid, "data", paste0(slug, "_data.xlsx"), readBin(data_path, "raw", n = file.info(data_path)$size))

  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  source_spec <- .carga_kobo_source_spec(
    asset_uid = asset_uid,
    base_url = base_url,
    profile_id = profile_id,
    detail = detail,
    payload = payload,
    inst_meta = inst_meta,
    data_meta = data_meta,
    imported_at = imported_at
  )
  source_meta <- c(list(
    kind = "kobo_api",
    source_title = title,
    source_alias = title
  ), source_spec)

  list(
    asset_uid = asset_uid,
    title = title,
    slug = slug,
    downloads_dir = downloads_dir,
    inst_meta = inst_meta,
    data_meta = data_meta,
    rp_inst = rp_inst,
    data_df = data_df,
    repeat_source_df = repeat_source_df,
    source_spec = source_spec,
    source_meta = source_meta,
    imported_at = imported_at
  )
}

# ---------------------------------------------------------------------------
# Registro «bases separadas»
# ---------------------------------------------------------------------------

# Un estudio de hermanas independientes tiene su propio flujo de import; mezclar
# una base separada lo dejaría en un modo que ninguno de los dos motores entiende.
.carga_separate_assert_mode <- function(sid) {
  if (length(estudio_list_bases(sid)) > 0L && estudio_is_independent_siblings(sid)) {
    stop_api(409, "E_ESTUDIO_MODE_CONFLICT",
             "El estudio es de bases hermanas independientes. Usa el import independiente o crea un estudio nuevo para bases separadas.")
  }
  invisible(TRUE)
}

# Todo lo que puede rechazar el registro se comprueba ANTES del fetch: si el
# nombre explícito choca o el estudio está lleno, el import no debe dejar
# uploads huérfanos en s$files (y el XLSForm huérfano entraría al .pulso).
.carga_separate_precheck <- function(sid, parsed) {
  .carga_separate_assert_mode(sid)
  bases <- estudio_list_bases(sid)
  if (length(bases) >= .ESTUDIO_MAX_BASES) {
    stop_api(400, "E_BASE_LIMITE",
             sprintf("El estudio llegó al límite de %d bases.", .ESTUDIO_MAX_BASES))
  }
  requested <- .carga_chr1(parsed$base_name %||% parsed$baseName %||% parsed$nombre, "")
  if (nzchar(requested)) {
    if (grepl("\\$|\\s", requested)) {
      stop_api(400, "E_BASE_NOMBRE_INVALIDO",
               "El nombre de la base no puede contener '$' ni espacios.")
    }
    if (requested %in% names(bases)) {
      stop_api(409, "E_BASE_DUP", sprintf("Ya existe una base con nombre '%s' en este estudio.", requested))
    }
  }
  invisible(TRUE)
}

# Nombre pedido (`base_name` / `nombre`) o derivado del título de la fuente.
# Un nombre explícito se respeta tal cual (si ya existe, estudio_add_base
# responde E_BASE_DUP); el derivado se desambigua con sufijo _2, _3…
.carga_separate_base_name <- function(sid, parsed, title, fallback) {
  requested <- .carga_chr1(parsed$base_name %||% parsed$baseName %||% parsed$nombre, "")
  if (nzchar(requested)) {
    if (grepl("\\$|\\s", requested)) {
      stop_api(400, "E_BASE_NOMBRE_INVALIDO",
               "El nombre de la base no puede contener '$' ni espacios.")
    }
    return(requested)
  }
  .carga_unique_base_name(title, names(estudio_list_bases(sid)), fallback)
}

.carga_separate_register <- function(sid, base_name, prep, extra_meta) {
  rp_data <- reporte_data(prep$data_df, instrumento = prep$rp_inst)
  base_meta <- estudio_add_base(
    sid,
    nombre = base_name,
    xlsform_file_id = prep$inst_meta$file_id,
    data_file_id = prep$data_meta$file_id,
    data_ext = "xlsx",
    rp_data = rp_data,
    rp_inst = prep$rp_inst,
    n_filas = as.integer(nrow(prep$data_df)),
    n_columnas = as.integer(ncol(prep$data_df)),
    extra_meta = c(list(imported_at = prep$imported_at), extra_meta)
  )
  # Mismo contrato que POST /api/estudio/base: la primera base del estudio
  # habilita analítica y queda como fuente.
  if (length(estudio_list_bases(sid)) == 1L) {
    session_set(sid, "analitica_prep_ok", TRUE)
    session_set(sid, "analitica_fuente", sprintf("estudio:%s", base_name))
  }
  base_meta
}

.carga_separate_payload <- function(sid, provider, base_name, prep, child_bases = list()) {
  s <- session_get(sid, required = FALSE)
  base_meta <- estudio_list_bases(sid)[[base_name]]
  list(
    ok = TRUE,
    provider = provider,
    strategy = "separate",
    base_name = base_name,
    base = .estudio_base_payload(base_meta, s),
    xlsform_file_id = prep$inst_meta$file_id,
    data_file_id = prep$data_meta$file_id,
    n_filas = as.integer(nrow(prep$data_df)),
    n_columnas = as.integer(ncol(prep$data_df)),
    source = prep$source_spec,
    child_bases = child_bases,
    active_base = as.character(estudio_active_base(sid) %||% NA_character_),
    n_bases = length(estudio_list_bases(sid)),
    estudio = .estudio_payload(sid)
  )
}

.carga_import_surveymonkey_separate <- function(sid, parsed) {
  .carga_separate_precheck(sid, parsed)
  prep <- .carga_sm_prepare_import(sid, parsed)
  base_name <- .carga_separate_base_name(sid, parsed, prep$source_spec$source_alias %||% prep$title,
                                         paste0("surveymonkey_", prep$survey_id))
  .carga_job_progress("finalize", message = "Registrando base en el estudio...")
  .carga_separate_register(sid, base_name, prep, list(
    source_kind = "surveymonkey",
    survey_id = prep$survey_id,
    source_title = prep$title,
    source_alias = prep$source_spec$source_alias,
    source_channel = prep$source_spec$source_channel,
    connection_profile_id = prep$source_spec$connection_profile_id,
    base_url = prep$source_spec$base_url,
    response_filter = prep$response_filter,
    surveymonkey_source_spec = prep$source_spec,
    surveymonkey_effective_data_file_id = prep$data_meta$file_id
  ))
  .carga_separate_payload(sid, "surveymonkey", base_name, prep)
}

.carga_import_kobo_separate <- function(sid, parsed) {
  .carga_separate_precheck(sid, parsed)
  prep <- .carga_kobo_prepare_import(sid, parsed)
  base_name <- .carga_separate_base_name(sid, parsed, prep$title, paste0("kobo_", prep$asset_uid))
  .carga_job_progress("finalize", message = "Registrando base en el estudio...")
  .carga_separate_register(sid, base_name, prep, list(
    source_kind = "kobo",
    survey_id = prep$asset_uid,
    asset_uid = prep$asset_uid,
    source_title = prep$title,
    source_alias = prep$title,
    connection_profile_id = as.character(prep$source_spec$connection_profile_id %||% ""),
    base_url = as.character(prep$source_spec$base_url %||% ""),
    response_filter = prep$source_meta,
    kobo_source_spec = prep$source_spec,
    kobo_effective_data_file_id = prep$data_meta$file_id
  ))
  # Hijas de repeat (ADR 0030) colgadas de ESTA base, no de `default`.
  child_bases <- .carga_kobo_register_repeat_bases(
    sid,
    data_df = prep$repeat_source_df,
    rp_inst = prep$rp_inst,
    parent_base_name = base_name,
    title = prep$title,
    downloads_dir = prep$downloads_dir,
    choice_code_maps = .carga_editor_choice_code_maps(sid, base_name)
  )
  .carga_separate_payload(sid, "kobo", base_name, prep, child_bases = child_bases)
}
