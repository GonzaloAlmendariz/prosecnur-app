# =============================================================================
# XLS/XLSX multihoja: begin_repeat -> bases hijas relacionadas (ADR 0030)
# =============================================================================

.xlsx_repeat_existing_base <- function(bases, parent_base_name, repeat_group) {
  hits <- names(bases)[vapply(bases, function(b) {
    identical(as.character(b$parent_base %||% ""), parent_base_name) &&
      identical(as.character(b$repeat_group %||% ""), repeat_group)
  }, logical(1))]
  if (length(hits)) hits[[1]] else NULL
}

.xlsx_repeat_link_contract <- function(parent_df, child_df) {
  if (all(c("_index", "_parent_index") %in% c(names(parent_df), names(child_df))) &&
      "_index" %in% names(parent_df) && "_parent_index" %in% names(child_df)) {
    return(list(link_key = "_parent_index", parent_index_key = "_index",
                link_key_fallback = if ("_submission__id" %in% names(child_df) && "_id" %in% names(parent_df)) "_submission__id" else ""))
  }
  if ("_id" %in% names(parent_df) && "_submission__id" %in% names(child_df)) {
    return(list(link_key = "_submission__id", parent_index_key = "_id",
                link_key_fallback = ""))
  }
  NULL
}

.xlsx_repeat_write_child <- function(sid, child_df, child_model, repeat_group) {
  s <- session_get(sid)
  out_dir <- file.path(s$dir, "downloads")
  slug <- .carga_slug(repeat_group, "xlsx_repeat")
  inst_path <- file.path(out_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_repeat_xlsform.xlsx"))
  .carga_write_xlsform_model(child_model, inst_path)
  inst_meta <- save_upload(
    sid, "xlsform", paste0(slug, "_repeat_xlsform.xlsx"),
    readBin(inst_path, "raw", n = file.info(inst_path)$size)
  )
  child_inst <- reporte_instrumento(path = inst_meta$path)
  child_norm <- normalize_data_for_xlsform(child_df, child_inst,
                                            choice_code_maps = .carga_editor_choice_code_maps(sid))
  child_norm <- .carga_backfill_missing_expected(child_norm, child_inst)
  .carga_assert_data_xlsform_compatible(child_norm, child_inst)
  data_path <- file.path(out_dir, paste0(uuid::UUIDgenerate(), "_", slug, "_repeat_data.xlsx"))
  .carga_write_xlsx_sheet(child_norm, data_path, "datos")
  data_meta <- save_upload(
    sid, "data", paste0(slug, "_repeat_data.xlsx"),
    readBin(data_path, "raw", n = file.info(data_path)$size)
  )
  list(
    inst_meta = inst_meta, data_meta = data_meta, inst = child_inst,
    data = child_norm, rp_data = reporte_data(child_norm, instrumento = child_inst)
  )
}

# Materializa únicamente hojas cuyo nombre coincide exactamente con un
# begin_repeat del instrumento padre. Devuelve TRUE si creó/reemplazó alguna
# hija, FALSE si no había candidatas válidas o todo ya estaba actualizado.
.carga_xlsx_register_repeat_bases <- function(sid, parent_base_name = "default") {
  s <- session_get(sid, required = FALSE)
  parent <- ((s$estudio %||% list())$bases %||% list())[[parent_base_name]]
  if (is.null(parent)) return(invisible(FALSE))
  data_meta <- (s$files %||% list())[[as.character(parent$data_file_id %||% "")]]
  inst_meta <- (s$files %||% list())[[as.character(parent$xlsform_file_id %||% "")]]
  if (is.null(data_meta) || is.null(inst_meta) ||
      !file.exists(data_meta$path %||% "") || !file.exists(inst_meta$path %||% "")) {
    return(invisible(FALSE))
  }
  if (!(tolower(as.character(data_meta$ext %||% tools::file_ext(data_meta$path))) %in% c("xlsx", "xls"))) {
    return(invisible(FALSE))
  }

  inst <- tryCatch(reporte_instrumento(path = inst_meta$path), error = function(e) NULL)
  specs <- if (is.null(inst)) list() else .kobo_repeat_specs(inst)
  if (!length(specs)) return(invisible(FALSE))
  sheets <- tryCatch(readxl::excel_sheets(data_meta$path), error = function(e) character(0))
  if (!length(sheets)) return(invisible(FALSE))
  parent_df <- tryCatch(
    as.data.frame(readxl::read_excel(data_meta$path, sheet = sheets[[1]]),
                  stringsAsFactors = FALSE, check.names = FALSE),
    error = function(e) NULL
  )
  if (is.null(parent_df)) return(invisible(FALSE))

  changed <- FALSE
  for (spec in specs) {
    if (!(spec$name %in% sheets) || !length(spec$leaf_vars)) next
    child_df <- tryCatch(
      as.data.frame(readxl::read_excel(data_meta$path, sheet = spec$name),
                    stringsAsFactors = FALSE, check.names = FALSE),
      error = function(e) NULL
    )
    if (is.null(child_df)) next
    link <- .xlsx_repeat_link_contract(parent_df, child_df)
    if (is.null(link)) next
    if (!("_index" %in% names(child_df))) child_df[["_index"]] <- seq_len(nrow(child_df))

    s_now <- session_get(sid)
    existing <- .xlsx_repeat_existing_base(
      s_now$estudio$bases %||% list(), parent_base_name, spec$name
    )
    if (!is.null(existing)) {
      meta <- s_now$estudio$bases[[existing]]
      same_source <- identical(as.character(meta$source_data_file_id %||% ""), data_meta$file_id) &&
        identical(as.character(meta$source_xlsform_file_id %||% ""), inst_meta$file_id)
      child_files_ok <- all(vapply(c(meta$xlsform_file_id, meta$data_file_id), function(fid) {
        hit <- (s_now$files %||% list())[[as.character(fid %||% "")]]
        !is.null(hit) && file.exists(hit$path %||% "")
      }, logical(1)))
      if (isTRUE(same_source) && isTRUE(child_files_ok)) next
    }

    child_model <- .kobo_build_repeat_instrument(
      inst, spec, extra_cols = setdiff(names(child_df), c("_index", "_parent_index", "_submission__id"))
    )
    built <- .xlsx_repeat_write_child(sid, child_df, child_model, spec$name)
    imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
    relation_meta <- c(list(
      source_kind = "xlsx_repeat", parent_base = parent_base_name,
      repeat_group = spec$name, repeat_relevant = as.character(spec$group_relevant %||% ""),
      source_data_file_id = data_meta$file_id, source_xlsform_file_id = inst_meta$file_id,
      imported_at = imported_at
    ), link)

    if (is.null(existing)) {
      base_name <- if (!(spec$name %in% names(session_get(sid)$estudio$bases))) {
        spec$name
      } else {
        .carga_unique_base_name(spec$name, names(session_get(sid)$estudio$bases),
                                paste0("rep_", .carga_slug(spec$name, "xlsx_repeat")))
      }
      estudio_add_base(
        sid, base_name, built$inst_meta$file_id, built$data_meta$file_id, "xlsx",
        built$rp_data, built$inst, nrow(built$data), ncol(built$data),
        extra_meta = relation_meta
      )
    } else {
      estudio_replace_base_files(
        sid, existing, built$inst_meta$file_id, built$data_meta$file_id, "xlsx",
        built$rp_data, built$inst, nrow(built$data), ncol(built$data)
      )
      s_updated <- session_get(sid)
      for (key in names(relation_meta)) s_updated$estudio$bases[[existing]][[key]] <- relation_meta[[key]]
      s_updated <- .mark_project_dirty(s_updated)
      .session_env[[sid]] <- s_updated
    }
    changed <- TRUE
  }
  invisible(changed)
}

.pulso_repair_xlsx_repeat_bases <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- (s$estudio %||% list())$bases %||% list()
  if (!length(bases)) return(invisible(FALSE))
  parents <- names(bases)[!vapply(bases, function(b) nzchar(as.character(b$parent_base %||% "")), logical(1))]
  changed <- FALSE
  for (parent in parents) {
    changed <- isTRUE(.carga_xlsx_register_repeat_bases(sid, parent)) || changed
  }
  invisible(changed)
}
