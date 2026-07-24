# Libro relacional para estudios con una base de encuestas y uno o más grupos
# repetibles. A diferencia de `run_report_multibase()`, estas tablas no son
# actores ni mediciones independientes: forman un solo conjunto 1:N.

.arx_chr1 <- function(x, fallback = "") {
  if (is.null(x) || !length(x)) return(fallback)
  out <- as.character(x)[1]
  if (is.na(out) || !nzchar(trimws(out))) fallback else trimws(out)
}

.arx_stop <- function(code, message) {
  if (exists("stop_api", mode = "function")) stop_api(409, code, message)
  stop(message, call. = FALSE)
}

.analitica_relational_spec <- function(sid) {
  s <- session_get(sid, required = FALSE)
  bases <- ((s %||% list())$estudio %||% list())$bases %||% list()
  if (length(bases) < 2L) return(NULL)

  children <- names(Filter(function(meta) {
    parent <- .arx_chr1((meta %||% list())$parent_base)
    group <- .arx_chr1((meta %||% list())$repeat_group)
    link <- .arx_chr1((meta %||% list())$link_key, "_parent_index")
    nzchar(parent) && parent %in% names(bases) && nzchar(group) && nzchar(link)
  }, bases))
  if (!length(children)) return(NULL)

  parents <- unique(vapply(children, function(nombre) {
    .arx_chr1(bases[[nombre]]$parent_base)
  }, character(1)))
  included <- unique(c(parents, children))
  # Una relación madre-repeat no debe absorber tablas hermanas independientes.
  if (!setequal(included, names(bases))) return(NULL)

  list(
    bases = bases,
    parents = parents,
    children = children,
    order = c(parents, setdiff(children, parents))
  )
}

.analitica_relational_available <- function(sid) {
  !is.null(.analitica_relational_spec(sid))
}

.arx_slug_es <- function(x, fallback = "respuestas") {
  out <- iconv(.arx_chr1(x, fallback), to = "ASCII//TRANSLIT", sub = "")
  out <- tolower(gsub("[^a-z0-9]+", "_", out))
  out <- gsub("^_+|_+$", "", out)
  out <- sub("^(rep|repeat|grupo_repetible|grupo_repeat)_+", "", out)
  if (!nzchar(out)) fallback else out
}

.arx_unique_sheet <- function(stem, suffix, existing = character(0)) {
  raw <- paste0(.arx_slug_es(stem), "_", suffix)
  raw <- substr(raw, 1L, 31L)
  if (!raw %in% existing) return(raw)
  i <- 2L
  repeat {
    tag <- paste0("_", i)
    candidate <- paste0(substr(raw, 1L, 31L - nchar(tag)), tag)
    if (!candidate %in% existing) return(candidate)
    i <- i + 1L
  }
}

.arx_base_roles <- function(spec) {
  roles <- list()
  for (parent in spec$parents) roles[[parent]] <- "encuestas"
  for (child in spec$children) {
    meta <- spec$bases[[child]] %||% list()
    roles[[child]] <- .arx_slug_es(meta$repeat_group %||% child, "respuestas")
  }
  roles
}

.arx_values <- function(x) {
  out <- as.character(x)
  out[is.na(out)] <- ""
  trimws(out)
}

.arx_assert_unique <- function(x, label) {
  if (!length(x) || any(!nzchar(x)) || anyDuplicated(x)) {
    .arx_stop("E_RELATIONAL_KEY_INVALID", sprintf("La llave pública '%s' contiene vacíos o duplicados.", label))
  }
  invisible(TRUE)
}

.arx_parent_key_col <- function(spec, parent) {
  cols <- unique(vapply(spec$children, function(child) {
    meta <- spec$bases[[child]] %||% list()
    if (identical(.arx_chr1(meta$parent_base), parent)) {
      .arx_chr1(meta$parent_index_key, "_index")
    } else ""
  }, character(1)))
  cols <- cols[nzchar(cols)]
  if (!length(cols)) "_index" else cols[[1]]
}

.arx_key_contract <- function(spec, nombre, data) {
  if (nombre %in% spec$parents) {
    key_col <- .arx_parent_key_col(spec, nombre)
    if (!key_col %in% names(data)) {
      .arx_stop("E_RELATIONAL_PARENT_KEY", sprintf("La base '%s' no contiene la llave '%s'.", nombre, key_col))
    }
    id_encuesta <- .arx_values(data[[key_col]])
    .arx_assert_unique(id_encuesta, "id_encuesta")
    return(list(id_encuesta = id_encuesta, id_respuesta = NULL))
  }

  meta <- spec$bases[[nombre]] %||% list()
  link_col <- .arx_chr1(meta$link_key, "_parent_index")
  if (!link_col %in% names(data)) {
    .arx_stop("E_RELATIONAL_CHILD_LINK", sprintf("La base repetible '%s' no contiene la llave '%s'.", nombre, link_col))
  }
  id_encuesta <- .arx_values(data[[link_col]])
  response_col <- c("_index", "_submission__id")
  response_col <- response_col[response_col %in% names(data)]
  id_respuesta <- if (length(response_col)) .arx_values(data[[response_col[[1]]]]) else rep("", nrow(data))
  if (any(!nzchar(id_respuesta)) || anyDuplicated(id_respuesta)) {
    ordinal <- ave(seq_along(id_encuesta), id_encuesta, FUN = seq_along)
    id_respuesta <- paste0(id_encuesta, "::", ordinal)
  }
  .arx_assert_unique(id_respuesta, "id_respuesta")
  if (any(!nzchar(id_encuesta))) {
    .arx_stop("E_RELATIONAL_CHILD_LINK", sprintf("La base repetible '%s' contiene respuestas sin encuesta.", nombre))
  }
  list(id_encuesta = id_encuesta, id_respuesta = id_respuesta)
}

.arx_add_public_keys <- function(df, keys) {
  out <- df
  out$id_encuesta <- keys$id_encuesta
  attr(out$id_encuesta, "label") <- "Identificador de la encuesta"
  first <- "id_encuesta"
  if (!is.null(keys$id_respuesta)) {
    out$id_respuesta <- keys$id_respuesta
    attr(out$id_respuesta, "label") <- "Identificador de la respuesta repetible"
    first <- c("id_encuesta", "id_respuesta")
  }
  out[, c(first, setdiff(names(out), first)), drop = FALSE]
}

.arx_prepare_base <- function(data, inst, cfg, keys, multi_select, incluir_madre_sm,
                              child = FALSE) {
  reviewed <- .analitica_apply_data_review(data, inst, cfg)
  reviewed$data <- .bases_normalize_other_selects(reviewed$data, reviewed$inst)
  if (isTRUE(child)) {
    stripped <- .repeat_strip_inherited(reviewed$data, reviewed$inst)
    reviewed$data <- stripped$data
    reviewed$inst <- stripped$inst
  }
  recon <- .reconciliacion_export_plan(reviewed$data, reviewed$inst, cfg)
  empty_cols <- setdiff(.analitica_base_empty_cols(reviewed$data), recon$extra_incluidas)
  base <- .excluir_cols(
    reviewed$data,
    c(
      .as_chr_vec(cfg$variables_excluidas),
      .analitica_base_internal_cols(reviewed$data),
      empty_cols,
      recon$extra_a_excluir
    )
  )
  if (identical(multi_select, "dummy_01")) base <- .expand_multiselect(base, reviewed$inst)
  if (isTRUE(incluir_madre_sm)) base <- .analitica_base_reconstruct_madre_sm(base, reviewed$inst)
  # Las llaves técnicas se reemplazan por el contrato público antes de escribir.
  base <- .repeat_drop_technical_cols(base)
  codigos <- .aplicar_etiquetas(base, reviewed$inst, valores = "codigos", multi_select = multi_select)
  etiquetas <- .aplicar_etiquetas(base, reviewed$inst, valores = "etiquetas", multi_select = multi_select)
  list(
    codigos = .arx_add_public_keys(codigos, keys),
    etiquetas = .arx_add_public_keys(etiquetas, keys),
    inst = reviewed$inst
  )
}

.arx_plain <- function(df) {
  out <- df
  for (name in names(out)) {
    if (inherits(out[[name]], c("haven_labelled", "haven_labelled_spss"))) {
      label <- attr(out[[name]], "label", exact = TRUE)
      out[[name]] <- as.vector(out[[name]])
      if (!is.null(label)) attr(out[[name]], "label") <- label
    }
  }
  out
}

.arx_col_widths <- function(data, labels = FALSE, cap = 32L) {
  vapply(names(data), function(name) {
    values <- as.character(data[[name]])
    values[is.na(values)] <- ""
    value_width <- if (length(values)) max(nchar(values)) else 0L
    label <- if (isTRUE(labels)) .arx_chr1(attr(data[[name]], "label", exact = TRUE)) else ""
    min(cap, max(8L, nchar(name), nchar(label), value_width) + 2L)
  }, numeric(1))
}

.arx_write_sheet <- function(wb, sheet, data, labels = FALSE, color_recod = FALSE,
                             type_map = NULL) {
  data <- .arx_plain(data)
  openxlsx::addWorksheet(wb, sheet, tabColour = if (labels) "#2F855A" else "#6B7280")
  openxlsx::writeData(
    wb, sheet,
    as.data.frame(as.list(names(data)), stringsAsFactors = FALSE),
    colNames = FALSE, startRow = 1L
  )
  data_row <- 2L
  if (labels) {
    variable_labels <- vapply(data, function(column) {
      .arx_chr1(attr(column, "label", exact = TRUE))
    }, character(1))
    openxlsx::writeData(
      wb, sheet,
      as.data.frame(as.list(variable_labels), stringsAsFactors = FALSE),
      colNames = FALSE, startRow = 2L
    )
    data_row <- 3L
  }
  openxlsx::writeData(wb, sheet, data, colNames = FALSE, startRow = data_row)
  header <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED")
  openxlsx::addStyle(wb, sheet, header, rows = 1L, cols = seq_along(data), gridExpand = TRUE)
  if (labels) {
    label_style <- openxlsx::createStyle(
      textDecoration = "italic", fontColour = "#5F6368", fgFill = "#F6F7F9"
    )
    openxlsx::addStyle(wb, sheet, label_style, rows = 2L, cols = seq_along(data), gridExpand = TRUE)
  }
  # Firma de color de recods POR TIPO (dummies SM en verde vía type_map).
  pulso_xlsx_highlight_recod_cols(
    wb, sheet, colnames = names(data),
    header_rows = seq_len(data_row - 1L),
    first_data_row = data_row,
    last_data_row = if (nrow(data) > 0L) data_row + nrow(data) - 1L else NULL,
    enabled = color_recod, type_map = type_map
  )
  openxlsx::freezePane(wb, sheet, firstActiveRow = data_row)
  openxlsx::setColWidths(
    wb, sheet, cols = seq_along(data),
    widths = .arx_col_widths(data, labels = labels, cap = if (labels) 32L else 16L)
  )
}

.analitica_relational_write_xlsx <- function(sid, data_sources, inst_sources, cfg,
                                              path_xlsx, multi_select = "dummy_01",
                                              incluir_madre_sm = FALSE) {
  spec <- .analitica_relational_spec(sid)
  if (is.null(spec)) {
    .arx_stop("E_RELATIONAL_NOT_AVAILABLE", "El estudio no tiene una relación madre–repeat completa.")
  }
  missing <- setdiff(spec$order, intersect(names(data_sources), names(inst_sources)))
  if (length(missing)) {
    .arx_stop("E_RELATIONAL_SOURCE_MISSING", sprintf("Faltan fuentes para: %s.", paste(missing, collapse = ", ")))
  }

  roles <- .arx_base_roles(spec)
  prepared <- list()
  parent_ids <- list()
  for (nombre in spec$order) {
    keys <- .arx_key_contract(spec, nombre, data_sources[[nombre]])
    prepared[[nombre]] <- .arx_prepare_base(
      data_sources[[nombre]], inst_sources[[nombre]], cfg, keys,
      multi_select = multi_select,
      incluir_madre_sm = incluir_madre_sm,
      child = nombre %in% spec$children
    )
    if (nombre %in% spec$parents) parent_ids[[nombre]] <- keys$id_encuesta
  }

  for (child in spec$children) {
    parent <- .arx_chr1(spec$bases[[child]]$parent_base)
    child_ids <- prepared[[child]]$codigos$id_encuesta
    if (any(!child_ids %in% parent_ids[[parent]])) {
      .arx_stop("E_RELATIONAL_ORPHANS", sprintf("La base repetible '%s' contiene respuestas sin encuesta.", child))
    }
  }

  color_recod <- .analitica_color_recod_enabled(cfg)
  wb <- openxlsx::createWorkbook()
  sheets <- character(0)
  rows <- list()
  for (nombre in spec$order) {
    role <- roles[[nombre]]
    sheet_codes <- .arx_unique_sheet(role, "codigos", sheets)
    sheets <- c(sheets, sheet_codes)
    sheet_labels <- .arx_unique_sheet(role, "etiquetas", sheets)
    sheets <- c(sheets, sheet_labels)
    tmap <- pulso_recod_type_map((prepared[[nombre]]$inst %||% list())$survey)
    .arx_write_sheet(wb, sheet_codes, prepared[[nombre]]$codigos, labels = FALSE, color_recod = color_recod, type_map = tmap)
    .arx_write_sheet(wb, sheet_labels, prepared[[nombre]]$etiquetas, labels = TRUE, color_recod = color_recod, type_map = tmap)
    rows[[nombre]] <- nrow(prepared[[nombre]]$codigos)
  }
  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  list(
    path = path_xlsx,
    sheets = sheets,
    rows = rows,
    n_bases = length(spec$order),
    roles = roles
  )
}
