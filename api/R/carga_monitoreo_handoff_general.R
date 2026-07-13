# Puente Monitoreo -> Procesamiento para estudios NO territoriales.
#
# El camino territorial (validation_status por fila, KPIs cacheados) vive en
# carga_monitoreo_handoff.R y se conserva intacto. Este archivo agrega el camino
# GENERAL: un snapshot de Monitoreo multi-fuente (p.ej. un estudio telefonico con
# barrido en Google Sheets + respuestas de Kobo mezcladas en un mismo frame) NO
# tiene una columna `validation_status`; en su lugar cada fila trae tags de fuente
# (`.source_id`, `.source_kind`, `.source_label`, `.source_role`). Aca:
#   1. Identificamos las fuentes PROMOVIBLES (Kobo, enabled, con asset_uid) desde
#      `s$monitoreo_sources` y/o desde los tags presentes en el snapshot.
#   2. Contamos las filas PROCESABLES de cada fuente: validas por `status_var` /
#      `valid_statuses` si son resolubles en las filas de ESA fuente; si no, todas
#      las filas (validity="all_rows", declarado para transparencia).
#   3. Promovemos UNA fuente a base madre del estudio reusando el instrumento del
#      helper congelado (que sale SIEMPRE del XLSForm LOCAL subido, nunca de la API
#      de Kobo) y expandiendo sus repeat groups a bases hija (ADR 0030 Fase 1).
#
# Reusa los helpers frozen LLAMANDOLOS (nunca crece router_monitoreo.R): el
# extractor de instrumento `.monitoreo_processing_handoff_xlsform`, el detector de
# Kobo `.carga_kobo_detected_source`, el pipeline canonico de import Kobo
# (`.carga_align_kobo_data`, `.dn_backfill_missing_columns`,
# `.carga_kobo_register_repeat_bases`) y `estudio_add_base`.

# Columnas internas de tagging de fuente del snapshot multi-fuente. NO son datos
# del instrumento; se descartan antes de alinear la data madre.
.CARGA_HANDOFF_SOURCE_TAG_COLS <- c(".source_id", ".source_kind", ".source_label",
                                    ".source_role", "dim_origen")

# ¿El estudio es territorial? El camino territorial (validation_status) se prefiere
# cuando la familia lo declara o, en snapshots legacy sin familia, cuando hay KPIs
# territoriales cacheados. Cualquier familia explicita distinta de "territorial"
# (telefonico, acreditacion, ...) usa el camino general.
.carga_handoff_is_territorial <- function(s, snapshot) {
  profile <- ((s$monitoreo_config %||% list())$monitoreo_profile %||% list())
  family <- .carga_chr1(profile$family, "")
  if (identical(family, "territorial")) return(TRUE)
  if (nzchar(family)) return(FALSE)
  facts <- (snapshot %||% list())$territorial_overview_facts %||%
    ((((snapshot %||% list())$dashboard %||% list())$territorial_reports %||% list())$kpis %||% list())
  length(facts) > 0L && !is.null(facts$validas %||% facts$validada)
}

# Vector de estatus validos configurados (character, sin vacios).
.carga_handoff_valid_statuses <- function(cfg) {
  vs <- (cfg %||% list())$valid_statuses %||% (cfg %||% list())$validStatuses %||% character(0)
  vs <- trimws(as.character(unlist(vs, use.names = FALSE)))
  vs[!is.na(vs) & nzchar(vs)]
}

# Fuentes promovibles (Kobo, enabled, con asset_uid). Combina `s$monitoreo_sources`
# (autoritativa, conserva el asset con su casing y su perfil de conexion) con los
# tags del snapshot (fallback: fuentes Kobo tagueadas pero no listadas). Devuelve
# descriptores homogeneos {id, kind, asset_uid, label, base_url,
# connection_profile_id, role}.
.carga_handoff_promovible_sources <- function(s, data) {
  kobo_kinds <- c("kobo", "kobo_api")
  out <- list()
  seen_ids <- character(0)
  for (src in (s$monitoreo_sources %||% list())) {
    if (!is.list(src)) next
    if (!(.carga_chr1(src$kind, "") %in% kobo_kinds)) next
    if (!isTRUE(src$enabled)) next
    asset_uid <- .carga_chr1(src$asset_uid %||% src$assetUid, "")
    if (!nzchar(asset_uid)) next
    id <- .carga_chr1(src$id, "")
    out[[length(out) + 1L]] <- list(
      id = id,
      kind = "kobo",
      asset_uid = asset_uid,
      label = .carga_chr1(src$label %||% src$survey_title %||% src$source_title, asset_uid),
      base_url = .carga_chr1(src$base_url %||% src$baseUrl, ""),
      connection_profile_id = .carga_chr1(src$connection_profile_id %||% src$connectionProfileId, ""),
      role = .carga_chr1(src$role, "")
    )
    if (nzchar(id)) seen_ids <- c(seen_ids, id)
  }
  if (is.data.frame(data) && ".source_kind" %in% names(data)) {
    kk <- as.character(data$.source_kind)
    ids <- if (".source_id" %in% names(data)) as.character(data$.source_id) else rep("", nrow(data))
    labels <- if (".source_label" %in% names(data)) as.character(data$.source_label) else rep("", nrow(data))
    for (id in unique(ids[kk %in% kobo_kinds])) {
      if (!nzchar(id) || id %in% seen_ids) next
      lab <- labels[match(id, ids)]
      out[[length(out) + 1L]] <- list(
        id = id, kind = "kobo",
        # El id taguea el asset en minusculas (kobo_<uid>); es un fallback best-effort
        # cuando la fuente no esta en monitoreo_sources (ahi vive el casing real).
        asset_uid = sub("^kobo_", "", id),
        label = .carga_chr1(lab, id),
        base_url = "", connection_profile_id = "", role = ""
      )
      seen_ids <- c(seen_ids, id)
    }
  }
  out
}

# Mascara de filas de una fuente en el frame multi-fuente. Prefiere `.source_id`
# (precisa), luego `.source_kind`, y como ultimo recurso todas las filas (frame de
# una sola fuente sin tags).
.carga_handoff_source_row_mask <- function(data, src) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  if (!n) return(logical(0))
  id <- .carga_chr1(src$id, "")
  if (nzchar(id) && ".source_id" %in% names(data)) {
    m <- as.character(data$.source_id) == id
    m[is.na(m)] <- FALSE
    if (any(m)) return(m)
  }
  kind <- .carga_chr1(src$kind, "")
  if (nzchar(kind) && ".source_kind" %in% names(data)) {
    m <- as.character(data$.source_kind) == kind
    m[is.na(m)] <- FALSE
    if (any(m)) return(m)
  }
  rep(TRUE, n)
}

# Resuelve como se define "valido" para las filas de una fuente:
#   status_var       -> `status_var` configurado y con senal en el subset.
#   status_candidate -> `status_var` vacio pero hay una columna cuyos valores casan
#                       con `valid_statuses` (p.ej. `Status`).
#   all_rows         -> no hay status resoluble: toda fila de la fuente cuenta.
# Devuelve list(column, validity). Nota clave: una columna de status que existe en
# el frame pero esta 100% vacia PARA ESTA fuente (p.ej. `Status` de barrido en las
# filas Kobo del PDM) NO es resoluble -> all_rows.
.carga_handoff_resolve_validity <- function(sub_df, status_var, valid_statuses) {
  status_var <- .carga_chr1(status_var, "")
  valid_statuses <- trimws(as.character(valid_statuses %||% character(0)))
  valid_statuses <- valid_statuses[!is.na(valid_statuses) & nzchar(valid_statuses)]

  col_has_signal <- function(col) {
    if (!col %in% names(sub_df)) return(FALSE)
    v <- as.character(sub_df[[col]])
    any(!is.na(v) & nzchar(trimws(v)))
  }
  if (nzchar(status_var) && col_has_signal(status_var)) {
    return(list(column = status_var, validity = "status_var"))
  }
  if (!length(valid_statuses)) return(list(column = "", validity = "all_rows"))

  cand_cols <- setdiff(names(sub_df), .CARGA_HANDOFF_SOURCE_TAG_COLS)
  cand_cols <- cand_cols[!startsWith(cand_cols, ".")]
  best <- ""
  best_hits <- 0L
  for (col in cand_cols) {
    v <- as.character(sub_df[[col]])
    hits <- sum(!is.na(v) & v %in% valid_statuses)
    if (hits > best_hits) {
      best_hits <- hits
      best <- col
    }
  }
  if (best_hits > 0L) return(list(column = best, validity = "status_candidate"))
  list(column = "", validity = "all_rows")
}

# Conteos por fuente: filas procesables (validas) y total de filas de la fuente.
.carga_handoff_source_counts <- function(data, src, status_var, valid_statuses) {
  mask <- .carga_handoff_source_row_mask(data, src)
  sub <- data[mask, , drop = FALSE]
  total <- nrow(sub)
  vres <- .carga_handoff_resolve_validity(sub, status_var, valid_statuses)
  if (identical(vres$validity, "all_rows") || !nzchar(vres$column)) {
    processable <- total
  } else {
    v <- as.character(sub[[vres$column]])
    processable <- sum(!is.na(v) & v %in% valid_statuses)
  }
  list(
    processable = as.integer(processable),
    total = as.integer(total),
    validity = vres$validity,
    status_column = vres$column
  )
}

# Nombre de la base del estudio ya promovida desde ESTE asset Kobo (o "" si
# ninguna). Refina `already_promoted`: solo cuenta una base de provenance
# monitoreo/kobo que referencia el MISMO asset, no cualquier base existente.
.carga_handoff_base_for_asset <- function(s, asset_uid) {
  asset_uid <- .carga_chr1(asset_uid, "")
  if (!nzchar(asset_uid)) return("")
  kinds <- c("monitoreo_kobo", "kobo", "kobo_api")
  bases <- s$estudio$bases %||% list()
  for (nm in names(bases)) {
    b <- bases[[nm]]
    if (!(.carga_chr1(b$source_kind, "") %in% kinds)) next
    candidates <- c(
      .carga_chr1(b$kobo_asset_uid, ""),
      .carga_chr1(b$survey_id, ""),
      .carga_chr1((b$kobo_source_spec %||% list())$asset_uid, ""),
      .carga_chr1((b$response_filter %||% list())$asset_uid, "")
    )
    if (any(candidates == asset_uid)) return(nm)
  }
  ""
}

# Fuente del instrumento para la primaria general: SIEMPRE el XLSForm LOCAL que
# sube el usuario, NUNCA la API de Kobo (mismo contrato que el path territorial).
# "local" si hay XLSForm local en el proyecto; si no, "needs_upload" para que la
# UI pida subirlo antes de traer la data.
.carga_handoff_instrument_source_general <- function(sid, s, primary) {
  if (.carga_monitoreo_handoff_has_local_xlsform(sid, s)) "local" else "needs_upload"
}

# Nombre sugerido de base para la UI (etiqueta legible de la fuente).
.carga_handoff_suggest_base_name <- function(label) {
  nombre <- .carga_chr1(label, "")
  if (!nzchar(nombre)) nombre <- "Monitoreo Kobo"
  gsub("$", "", nombre, fixed = TRUE)
}

# Elige la fuente objetivo del promote: `parsed$source_id`/`parsed$source`
# (por id o asset_uid) o, por defecto, la de mas filas en el snapshot.
.carga_handoff_pick_target <- function(srcs, parsed, data, status_var, valid_statuses) {
  target_id <- .carga_chr1(parsed$source_id %||% parsed$source %||% parsed$sourceId, "")
  if (nzchar(target_id)) {
    for (src in srcs) {
      if (identical(src$id, target_id) || identical(src$asset_uid, target_id)) return(src)
    }
    stop_api(404, "E_MONITOREO_HANDOFF_SOURCE_NOT_FOUND",
             sprintf("No hay una fuente promovible con id/asset '%s'.", target_id))
  }
  totals <- vapply(srcs, function(src) {
    .carga_handoff_source_counts(data, src, status_var, valid_statuses)$total
  }, integer(1))
  srcs[[order(-totals)[1]]]
}

# Quita del frame las columnas internas de tagging de fuente (`.source_*`,
# `dim_origen`) antes de alinear al instrumento. `_id`/`_uuid` (llaves de enlace de
# repeats) se conservan: no llevan el prefijo `.`.
.carga_handoff_strip_source_tags <- function(df) {
  if (!is.data.frame(df)) return(df)
  drop <- names(df)[startsWith(names(df), ".source") | names(df) %in% .CARGA_HANDOFF_SOURCE_TAG_COLS]
  if (!length(drop)) return(df)
  df[, setdiff(names(df), drop), drop = FALSE]
}

# NOTA: ya no hay `.carga_handoff_synth_cfg`. Existia para inyectar el asset en la
# ranura territorial y que el extractor congelado reusara su preferencia de Kobo
# API; bajo el contrato vigente el instrumento sale SIEMPRE del XLSForm local, asi
# que `.monitoreo_processing_handoff_xlsform` ya no candidatea la API ni lee `cfg`.

# STATUS general: arma el contrato extendido (source primaria + lista `sources`)
# desde las fuentes promovibles del snapshot multi-fuente.
.carga_handoff_status_general <- function(sid, s, snapshot) {
  data <- snapshot$data
  cfg <- s$monitoreo_config %||% list()
  status_var <- .carga_chr1(cfg$status_var, "")
  valid_statuses <- .carga_handoff_valid_statuses(cfg)

  srcs <- .carga_handoff_promovible_sources(s, data)
  empty_counts <- list(processable = 0L, validada = 0L, revision = 0L,
                       no_defendible = 0L, total = 0L)
  if (!length(srcs)) {
    return(list(
      ok = TRUE, detected = FALSE, universe = "source",
      counts = empty_counts,
      source = list(label = "", kind = "", phase = "", kobo_asset_uid = "",
                    source_id = "", validity = "", status_column = "",
                    instrument_source = "none", instrument_available = FALSE,
                    instrument_needs_upload = FALSE),
      sources = list(),
      already_promoted = FALSE,
      existing_base = .carga_handoff_existing_base_payload(sid, s),
      base_nombre_sugerido = "Monitoreo"
    ))
  }

  enriched <- lapply(srcs, function(src) {
    c(src, .carga_handoff_source_counts(data, src, status_var, valid_statuses))
  })
  ord <- order(
    -vapply(enriched, function(e) e$processable, integer(1)),
    -vapply(enriched, function(e) e$total, integer(1))
  )
  enriched <- enriched[ord]
  primary <- enriched[[1]]

  instr <- .carga_handoff_instrument_source_general(sid, s, primary)
  already <- nzchar(.carga_handoff_base_for_asset(s, primary$asset_uid))

  list(
    ok = TRUE,
    detected = primary$processable > 0L,
    universe = "source",
    counts = list(
      processable = as.integer(primary$processable),
      validada = 0L, revision = 0L, no_defendible = 0L,
      total = as.integer(primary$total)
    ),
    source = list(
      label = primary$label,
      kind = "kobo",
      phase = "",
      kobo_asset_uid = primary$asset_uid,
      source_id = primary$id,
      validity = primary$validity,
      status_column = primary$status_column,
      instrument_source = instr,
      instrument_available = identical(instr, "local"),
      instrument_needs_upload = identical(instr, "needs_upload")
    ),
    sources = lapply(enriched, function(e) list(
      source_id = e$id,
      label = e$label,
      kind = "kobo",
      kobo_asset_uid = e$asset_uid,
      validity = e$validity,
      counts = list(processable = as.integer(e$processable), total = as.integer(e$total))
    )),
    already_promoted = already,
    existing_base = .carga_handoff_existing_base_payload(sid, s),
    base_nombre_sugerido = .carga_handoff_suggest_base_name(primary$label)
  )
}

# PROMOTE general: resuelve la fuente, filtra sus filas validas, trae el instrumento
# fidedigno (helper congelado), alinea/backfilea/normaliza al patron de import Kobo,
# registra la base madre y expande sus repeats a bases hija (ADR 0030 Fase 1).
.carga_handoff_promote_general <- function(sid, parsed, s, snapshot) {
  data_all <- snapshot$data
  cfg <- s$monitoreo_config %||% list()
  status_var <- .carga_chr1(cfg$status_var, "")
  valid_statuses <- .carga_handoff_valid_statuses(cfg)

  srcs <- .carga_handoff_promovible_sources(s, data_all)
  if (!length(srcs)) {
    stop_api(409, "E_MONITOREO_HANDOFF_NO_SOURCE",
             "No hay una fuente Kobo promovible en el snapshot de Monitoreo.")
  }
  target <- .carga_handoff_pick_target(srcs, parsed, data_all, status_var, valid_statuses)

  data_src <- data_all[.carga_handoff_source_row_mask(data_all, target), , drop = FALSE]
  if (!nrow(data_src)) {
    stop_api(409, "E_MONITOREO_HANDOFF_SOURCE_EMPTY",
             sprintf("La fuente '%s' no tiene filas en el snapshot de Monitoreo.", target$label))
  }

  vres <- .carga_handoff_resolve_validity(data_src, status_var, valid_statuses)
  validity <- vres$validity
  if (identical(validity, "all_rows") || !nzchar(vres$column)) {
    data_valid <- data_src
    validity <- "all_rows"
  } else {
    v <- as.character(data_src[[vres$column]])
    keep <- !is.na(v) & v %in% valid_statuses
    data_valid <- data_src[keep, , drop = FALSE]
    if (!nrow(data_valid)) {
      # Ninguna fila casa el universo valido: degradamos a todas las filas de la
      # fuente con aviso, en vez de crear una base vacia.
      data_valid <- data_src
      validity <- "all_rows"
    }
  }

  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  slug <- .carga_slug(target$label, paste0("kobo_", target$asset_uid))
  xls_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_handoff_xlsform.xlsx"))
  xlsform_meta <- .monitoreo_processing_handoff_xlsform(
    sid, session_get(sid), xls_path, data = NULL, cfg = NULL
  )
  inst_path <- .carga_chr1(xlsform_meta$path, xls_path)
  rp_inst <- reporte_instrumento(path = inst_path)

  # Pipeline canonico de import Kobo sobre las filas validas de la fuente.
  data_valid <- .carga_handoff_strip_source_tags(data_valid)
  aligned <- .carga_align_kobo_data(data_valid, rp_inst)
  has_repeats <- length(.kobo_repeat_specs(rp_inst)) > 0L
  # La data aplanada (con el blob del repeat y `_id`) alimenta la expansion a hijas.
  repeat_source_df <- if (has_repeats) .kobo_ensure_wide_index(aligned) else NULL
  data_df <- .dn_backfill_missing_columns(aligned, .dn_expected_data_names(rp_inst))
  data_df <- if (is.data.frame(data_df) && nrow(data_df)) {
    normalize_data_for_xlsform(data_df, rp_inst, choice_code_maps = .carga_editor_choice_code_maps(sid))
  } else {
    .carga_empty_data_for_instrument(rp_inst)
  }
  data_df <- .kobo_drop_repeat_blob_columns(data_df, rp_inst)
  if (has_repeats) data_df <- .kobo_ensure_wide_index(data_df)
  # PREVENCIÓN (frente A): persistir la base ya limpia. Colapsa dups
  # group-prefixed residuales, quita `.integration_mode`/tags de fuente y dropea
  # el esquema de seguimiento/universo que el bind multi-fuente inyecta VACÍO en
  # las filas Kobo. `monitoreo_handoff = TRUE`: aquí la proveniencia es segura.
  data_df <- sanitize_base_data(data_df, rp_inst, monitoreo_handoff = TRUE)
  data_df <- .carga_reorder_data_columns(data_df, rp_inst)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)

  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  inst_meta <- save_upload(sid, "xlsform", paste0(slug, "_xlsform.xlsx"),
                           readBin(inst_path, "raw", n = file.info(inst_path)$size))
  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_data.xlsx"))
  .carga_write_xlsx_sheet(data_df, data_path, "datos")
  data_meta <- save_upload(sid, "data", paste0(slug, "_data.xlsx"),
                           readBin(data_path, "raw", n = file.info(data_path)$size))
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  extra_meta <- list(
    source_kind = "monitoreo_kobo",
    monitoreo_source_id = target$id,
    kobo_asset_uid = target$asset_uid,
    survey_id = target$asset_uid,
    source_title = target$label,
    source_alias = target$label,
    xlsform_source = .carga_chr1(xlsform_meta$source, ""),
    validity = validity,
    response_filter = list(
      universe = "source",
      validity = validity,
      status_column = vres$column,
      valid_statuses = as.list(valid_statuses)
    ),
    imported_at = imported_at
  )

  estudio_ensure(sid)
  s_now <- session_get(sid)
  existing_name <- .carga_handoff_base_for_asset(s_now, target$asset_uid)
  if (nzchar(existing_name)) {
    base_nombre <- existing_name
    estudio_replace_base_files(sid, base_nombre,
                               xlsform_file_id = inst_meta$file_id,
                               data_file_id = data_meta$file_id,
                               data_ext = "xlsx",
                               rp_data = rp_data, rp_inst = rp_inst,
                               n_filas = nrow(data_df), n_columnas = ncol(data_df))
    estudio_update_base_metadata(sid, base_nombre, extra_meta)
  } else {
    base_label <- .carga_chr1(parsed$base_nombre %||% parsed$nombre, target$label)
    base_nombre <- .carga_unique_base_name(base_label, names(estudio_list_bases(sid)), "monitoreo_kobo")
    estudio_add_base(sid, nombre = base_nombre,
                     xlsform_file_id = inst_meta$file_id,
                     data_file_id = data_meta$file_id,
                     data_ext = "xlsx",
                     rp_data = rp_data, rp_inst = rp_inst,
                     n_filas = nrow(data_df), n_columnas = ncol(data_df),
                     extra_meta = extra_meta)
  }
  estudio_active_base_set(sid, base_nombre)

  # Bases hija de repeat (ADR 0030 Fase 1). tryCatch justificado: la base madre YA
  # quedo persistida; un blob raro no debe revertir el handoff, la hija se reintenta.
  child_bases <- if (has_repeats && is.data.frame(repeat_source_df)) {
    tryCatch(
      .carga_kobo_register_repeat_bases(
        sid, data_df = repeat_source_df, rp_inst = rp_inst,
        parent_base_name = base_nombre, title = base_nombre,
        downloads_dir = downloads_dir,
        choice_code_maps = .carga_editor_choice_code_maps(sid)
      ),
      error = function(e) list()
    )
  } else {
    list()
  }

  list(
    ok = TRUE,
    schema = "carga_monitoreo_handoff_general_v1",
    base_nombre = base_nombre,
    universe = "source",
    validity = validity,
    counts = list(
      processable = as.integer(nrow(data_df)),
      validada = 0L, revision = 0L, no_defendible = 0L,
      total = as.integer(nrow(data_src))
    ),
    source = list(
      source_id = target$id,
      label = target$label,
      kobo_asset_uid = target$asset_uid,
      validity = validity
    ),
    xlsform = list(file_id = inst_meta$file_id, source = .carga_chr1(xlsform_meta$source, "")),
    data = list(file_id = data_meta$file_id,
                n_filas = as.integer(nrow(data_df)),
                n_columnas = as.integer(ncol(data_df))),
    child_bases = child_bases,
    would_mutate_pulso = TRUE
  )
}
