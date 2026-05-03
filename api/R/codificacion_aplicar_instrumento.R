# =============================================================================
# ppra_adaptar_instrumento
# =============================================================================
`%||%` <- function(a,b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a

# ---------- helpers básicos ---------------------------------------------------

.guess_label_col <- function(df){
  nms <- tolower(names(df))
  hit <- match(TRUE, nms %in% c(
    "label::spanish (es)","label::spanish(es)","label::spanish_es",
    "label_spanish_es","label::spanish","label","label::es"
  ))
  if (is.na(hit)) "label" else names(df)[hit]
}

.norm_tokens <- function(x){
  x <- as.character(x)
  x <- gsub("[,;|/]+"," ", x, perl = TRUE)
  x <- gsub("\\s+"," ", x, perl = TRUE)
  x <- trimws(x)
  x[x==""] <- NA_character_
  x
}

.split_tokens <- function(v){
  v <- .norm_tokens(v)
  strsplit(ifelse(is.na(v),"",v), "\\s+")
}

.sanitize <- function(x){
  x <- gsub("[^A-Za-z0-9_]+","_", x)
  x <- gsub("_+","_", x)
  x <- sub("^_+","", x); x <- sub("_+$","", x)
  if (!nzchar(x)) "ppra_list" else x
}

.row_after <- function(df, row_idx, new_row){
  if (is.na(row_idx) || row_idx<=0 || row_idx>=nrow(df)) {
    dplyr::bind_rows(df, new_row)
  } else {
    dplyr::bind_rows(df[seq_len(row_idx), , drop = FALSE],
                     new_row,
                     df[(row_idx+1):nrow(df), , drop = FALSE])
  }
}

.extract_listname <- function(type_str){
  s <- as.character(type_str) %||% ""
  s <- trimws(s)
  parts <- strsplit(s, "\\s+")[[1]]
  if (!length(parts)) return(NA_character_)
  if (length(parts)>=2 && parts[1] %in% c("select_one","select_multiple")) parts[2] else NA_character_
}

.read_all_sheets <- function(path_xlsx){
  sh <- readxl::excel_sheets(path_xlsx)
  stats::setNames(lapply(sh, function(s){
    tryCatch(readxl::read_xlsx(path_xlsx, sheet = s), error = function(e) NULL)
  }), sh)
}

.collect_tokens_from_col <- function(df_or_path, col_name){
  # Une tokens de col_name en todas las hojas donde exista.
  if (is.character(df_or_path) && file.exists(df_or_path)) {
    lst <- .read_all_sheets(df_or_path)
  } else if (is.data.frame(df_or_path)) {
    lst <- list(DATA = df_or_path)
  } else stop("path_data_adaptada debe ser data.frame o ruta a XLSX con la data adaptada.")
  toks <- character(0)
  for (nm in names(lst)){
    d <- lst[[nm]]; if (is.null(d) || !ncol(d)) next
    if (col_name %in% names(d)) {
      v  <- d[[col_name]]
      vv <- unique(unlist(.split_tokens(v)))
      toks <- c(toks, vv)
    }
  }
  unique(toks[nzchar(toks)])
}

.collect_code_label_map_from_col <- function(df_or_path, code_col, label_col,
                                             known_codes = character(0),
                                             context = code_col){
  if (is.character(df_or_path) && file.exists(df_or_path)) {
    lst <- .read_all_sheets(df_or_path)
  } else if (is.data.frame(df_or_path)) {
    lst <- list(DATA = df_or_path)
  } else {
    stop("path_data_adaptada debe ser data.frame o ruta a XLSX con la data adaptada.")
  }

  acc <- tibble::tibble(code = character(0), label = character(0), sheet = character(0))
  for (nm in names(lst)) {
    d <- lst[[nm]]
    if (is.null(d) || !ncol(d) || !(code_col %in% names(d))) next
    codes <- trimws(as.character(d[[code_col]]))
    codes[codes == ""] <- NA_character_
    labels <- if (label_col %in% names(d)) trimws(as.character(d[[label_col]])) else rep(NA_character_, length(codes))
    labels[labels == ""] <- NA_character_
    keep <- !is.na(codes)
    if (!any(keep)) next
    acc <- dplyr::bind_rows(
      acc,
      tibble::tibble(code = codes[keep], label = labels[keep], sheet = nm)
    )
  }

  if (!nrow(acc)) return(character(0))

  new_codes <- setdiff(unique(acc$code), as.character(known_codes))
  if (!length(new_codes)) return(character(0))

  out <- character(0)
  for (code in new_codes) {
    labs <- unique(acc$label[acc$code == code & !is.na(acc$label)])
    if (!length(labs)) {
      stop(
        "[Recodificación] En la data adaptada, el código nuevo '", code, "' para '", context,
        "' no tiene etiqueta declarada en '", label_col,
        "'. Completa esa etiqueta al menos una vez para ese código.",
        call. = FALSE
      )
    }
    if (length(labs) > 1L) {
      stop(
        "[Recodificación] En la data adaptada, el código nuevo '", code, "' para '", context,
        "' tiene más de una etiqueta declarada en '", label_col,
        "': ", paste(shQuote(labs), collapse = ", "),
        ". Usa una sola etiqueta por código.",
        call. = FALSE
      )
    }
    out[code] <- labs[1]
  }
  out
}

.collect_code_label_map_from_sm_cols <- function(df_or_path, code_col, label_col,
                                                 known_codes = character(0),
                                                 context = code_col){
  if (is.character(df_or_path) && file.exists(df_or_path)) {
    lst <- .read_all_sheets(df_or_path)
  } else if (is.data.frame(df_or_path)) {
    lst <- list(DATA = df_or_path)
  } else {
    stop("path_data_adaptada debe ser data.frame o ruta a XLSX con la data adaptada.")
  }

  acc <- tibble::tibble(code = character(0), label = character(0), sheet = character(0))
  for (nm in names(lst)) {
    d <- lst[[nm]]
    if (is.null(d) || !ncol(d) || !(code_col %in% names(d)) || !(label_col %in% names(d))) next

    codes_raw <- as.character(d[[code_col]])
    labels_raw <- as.character(d[[label_col]])
    for (i in seq_along(codes_raw)) {
      codes_i <- .split_tokens(codes_raw[i])[[1]]
      codes_i <- codes_i[nzchar(codes_i)]
      if (!length(codes_i)) next

      lab_cell <- trimws(as.character(labels_raw[i]))
      if (!nzchar(lab_cell)) next
      labs_i <- strsplit(lab_cell, "\\s*\\|\\|\\s*", perl = TRUE)[[1]]
      labs_i <- trimws(as.character(labs_i))

      if (length(labs_i) != length(codes_i)) {
        stop(
          "[Recodificación] En la data adaptada, la fila ", i, " de la hoja '", nm,
          "' para '", context, "' tiene una cantidad distinta de códigos y etiquetas en ",
          shQuote(code_col), " / ", shQuote(label_col),
          ". Usa el formato 'label1 || label2' respetando el orden de códigos.",
          call. = FALSE
        )
      }

      keep <- nzchar(labs_i)
      if (!any(keep)) next
      acc <- dplyr::bind_rows(
        acc,
        tibble::tibble(
          code = codes_i[keep],
          label = labs_i[keep],
          sheet = nm
        )
      )
    }
  }

  if (!nrow(acc)) return(character(0))

  new_codes <- setdiff(unique(acc$code), as.character(known_codes))
  if (!length(new_codes)) return(character(0))

  out <- character(0)
  for (code in new_codes) {
    labs <- unique(acc$label[acc$code == code & nzchar(acc$label)])
    if (!length(labs)) next
    if (length(labs) > 1L) {
      stop(
        "[Recodificación] En la data adaptada, el código '", code, "' para '", context,
        "' tiene más de una etiqueta declarada en '", label_col,
        "': ", paste(shQuote(labs), collapse = ", "),
        ". Usa una sola etiqueta por código.",
        call. = FALSE
      )
    }
    out[code] <- labs[1]
  }
  out
}

.template_sheet_name <- function(path_xlsx, parent_var){
  sh <- readxl::excel_sheets(path_xlsx)
  hit <- which(sh == parent_var); if (length(hit)) return(sh[hit[1]])
  hit <- which(tolower(sh) == tolower(parent_var)); if (length(hit)) return(sh[hit[1]])
  p31 <- substr(parent_var, 1, 31)
  hit <- which(sh == p31 | tolower(sh) == tolower(p31)); if (length(hit)) return(sh[hit[1]])
  cl_parent <- gsub("[^A-Za-z0-9]+", "", tolower(parent_var))
  cl_sheets <- gsub("[^A-Za-z0-9]+", "", tolower(sh))
  hit <- which(cl_sheets == cl_parent); if (length(hit)) return(sh[hit[1]])
  d <- adist(cl_parent, cl_sheets); j <- which.min(d)
  if (length(j) && is.finite(d[j]) && d[j] <= 5) return(sh[j])
  NA_character_
}

.collect_sm_code_label_map_from_template <- function(path_plantilla, parent,
                                                     known_codes = character(0),
                                                     context = parent){
  if (is.null(path_plantilla) || !file.exists(path_plantilla)) return(character(0))
  sheet <- .template_sheet_name(path_plantilla, parent)
  if (is.na(sheet)) return(character(0))

  tpl <- suppressWarnings(readxl::read_xlsx(path_plantilla, sheet = sheet, col_types = "text"))
  if (is.null(tpl) || !ncol(tpl) || !nrow(tpl)) return(character(0))

  cols <- names(tpl)
  label_row <- as.character(tpl[1, , drop = TRUE])
  names(label_row) <- cols

  rx <- paste0("^", gsub("([\\W])", "\\\\\\1", parent), "/[^/]+_(?i:recod)$")
  sm_cols <- cols[grepl(rx, cols, perl = TRUE)]
  sm_cols <- sm_cols[!tolower(sm_cols) %in% tolower(c(
    paste0(parent, "/ejemplo_recod"),
    paste0(parent, "/__ejemplo__recod")
  ))]

  acc <- list()
  for (cc in sm_cols) {
    code <- sub("^.+/", "", cc)
    code <- sub("_(?i:recod)$", "", code, perl = TRUE)
    if (!nzchar(code) || code %in% as.character(known_codes)) next
    lab <- trimws(as.character(label_row[[cc]]))
    if (!nzchar(lab)) next
    prev <- acc[[code]] %||% character(0)
    acc[[code]] <- unique(c(prev, lab))
  }

  # También permite declarar códigos nuevos vía bloque auxiliar
  has_aux <- all(c("nuevo_codigo", "nueva_etiqueta") %in% cols)
  if (isTRUE(has_aux) && nrow(tpl) >= 2L) {
    codes <- trimws(as.character(tpl$nuevo_codigo[-1]))
    labels <- trimws(as.character(tpl$nueva_etiqueta[-1]))
    codes[codes == ""] <- NA_character_
    labels[labels == ""] <- NA_character_
    for (i in seq_along(codes)) {
      code <- codes[i]; lab <- labels[i]
      if (is.na(code) || code %in% as.character(known_codes) || is.na(lab) || !nzchar(lab)) next
      prev <- acc[[code]] %||% character(0)
      acc[[code]] <- unique(c(prev, lab))
    }
  }

  if (!length(acc)) return(character(0))

  out <- character(0)
  for (code in names(acc)) {
    labs <- unique(trimws(as.character(acc[[code]])))
    labs <- labs[nzchar(labs)]
    if (!length(labs)) next
    if (length(labs) > 1L) {
      stop(
        "[Recodificación] En la plantilla, el código nuevo '", code, "' para '", context,
        "' tiene más de una etiqueta declarada: ",
        paste(shQuote(labs), collapse = ", "),
        ". Usa una sola etiqueta por código.",
        call. = FALSE
      )
    }
    out[code] <- labs[1]
  }
  out
}

.collect_aux_code_label_map_from_template <- function(path_plantilla,
                                                      parent,
                                                      target_col,
                                                      known_codes = character(0),
                                                      required_codes = character(0),
                                                      context = target_col){
  if (is.null(path_plantilla) || !file.exists(path_plantilla)) return(character(0))
  sheet <- .template_sheet_name(path_plantilla, parent)
  if (is.na(sheet)) return(character(0))

  tpl <- suppressWarnings(readxl::read_xlsx(path_plantilla, sheet = sheet, col_types = "text"))
  if (is.null(tpl) || !ncol(tpl)) return(character(0))
  cols <- names(tpl)
  has_aux <- all(c("nuevo_codigo", "nueva_etiqueta") %in% cols)

  required_codes <- unique(trimws(as.character(required_codes)))
  required_codes <- required_codes[nzchar(required_codes)]
  required_codes <- setdiff(required_codes, as.character(known_codes))

  if (!has_aux) {
    if (length(required_codes)) {
      stop(
        "[Recodificación] En la plantilla (hoja '", sheet, "') faltan las columnas ",
        "'nuevo_codigo' y 'nueva_etiqueta' para declarar códigos nuevos de '", context, "'.",
        call. = FALSE
      )
    }
    return(character(0))
  }

  # La fila 1 de datos corresponde al encabezado visible (fila 2 de Excel).
  codes <- trimws(as.character(tpl$nuevo_codigo[-1]))
  labels <- trimws(as.character(tpl$nueva_etiqueta[-1]))
  codes[codes == ""] <- NA_character_
  labels[labels == ""] <- NA_character_

  has_code <- !is.na(codes)
  has_label <- !is.na(labels)
  if (any(has_label & !has_code)) {
    stop(
      "[Recodificación] En la plantilla (hoja '", sheet, "'), hay etiquetas sin código ",
      "en el bloque auxiliar para '", context, "'.",
      call. = FALSE
    )
  }
  if (any(has_code & !has_label)) {
    miss <- unique(codes[has_code & !has_label])
    stop(
      "[Recodificación] En la plantilla (hoja '", sheet, "'), hay códigos sin etiqueta ",
      "en el bloque auxiliar para '", context, "': ",
      paste(shQuote(miss), collapse = ", "),
      ".",
      call. = FALSE
    )
  }

  keep <- has_code & has_label
  if (!any(keep)) {
    if (length(required_codes)) {
      stop(
        "[Recodificación] En la plantilla (hoja '", sheet, "'), los códigos nuevos de '",
        context, "' deben declararse en 'nuevo_codigo'/'nueva_etiqueta'.",
        call. = FALSE
      )
    }
    return(character(0))
  }

  acc <- tibble::tibble(code = codes[keep], label = labels[keep])
  out <- character(0)
  for (code in unique(acc$code)) {
    if (code %in% as.character(known_codes)) next
    labs <- unique(acc$label[acc$code == code])
    if (length(labs) > 1L) {
      stop(
        "[Recodificación] En la plantilla, el código '", code, "' para '", context,
        "' tiene más de una etiqueta declarada: ",
        paste(shQuote(labs), collapse = ", "),
        ". Usa una sola etiqueta por código.",
        call. = FALSE
      )
    }
    out[code] <- labs[1]
  }

  missing_codes <- setdiff(required_codes, names(out))
  if (length(missing_codes)) {
    stop(
      "[Recodificación] En la plantilla, faltan etiquetas para códigos nuevos de '", context,
      "': ", paste(shQuote(missing_codes), collapse = ", "),
      ". Decláralos en 'nuevo_codigo'/'nueva_etiqueta'.",
      call. = FALSE
    )
  }
  out
}

.collect_child_cols <- function(df_or_path, parent){
  # Devuelve nombres de columnas hijas *_recod a lo largo de todas las hojas:
  # ^<parent>_.+_recod$, excluyendo <parent>_recod
  rx   <- paste0("^", gsub("([\\W])","\\\\\\1", parent), "_.+_recod$")
  main <- paste0(parent, "_recod")

  if (is.character(df_or_path) && file.exists(df_or_path)) {
    lst <- .read_all_sheets(df_or_path)
  } else if (is.data.frame(df_or_path)) {
    lst <- list(DATA = df_or_path)
  } else stop("path_data_adaptada debe ser data.frame o ruta a XLSX con la data adaptada.")

  out <- character(0)
  for (nm in names(lst)){
    d <- lst[[nm]]; if (is.null(d) || !ncol(d)) next
    hits <- grep(rx, names(d), value = TRUE, perl = TRUE)
    hits <- setdiff(hits, main)
    out  <- c(out, hits)
  }
  unique(out)
}

.collect_all_colnames <- function(df_or_path){
  if (is.character(df_or_path) && file.exists(df_or_path)) {
    lst <- .read_all_sheets(df_or_path)
  } else if (is.data.frame(df_or_path)) {
    lst <- list(DATA = df_or_path)
  } else {
    stop("path_data_adaptada debe ser data.frame o ruta a XLSX con la data adaptada.")
  }
  unique(unlist(lapply(lst, names), use.names = FALSE))
}

.find_text_children_for_parent <- function(survey, parent){
  if (is.null(survey) || !nrow(survey) || !all(c("name", "type") %in% names(survey))) {
    return(character(0))
  }
  rel_col <- names(survey)[match(TRUE, tolower(names(survey)) %in% c("relevant", "relevance"))]
  if (is.na(rel_col)) return(character(0))

  is_text <- grepl("^text\\b", trimws(as.character(survey$type)))
  rel <- as.character(survey[[rel_col]] %||% "")
  parent_rx <- paste0("\\$\\{", gsub("([\\W])", "\\\\\\1", parent), "\\}")
  hits <- is_text & grepl(parent_rx, rel, perl = TRUE)
  unique(as.character(survey$name[hits]))
}

.code_label_signature <- function(code_label_map){
  if (is.null(code_label_map) || !length(code_label_map)) return("")
  codes <- names(code_label_map)
  ord <- order(codes)
  paste0(codes[ord], "=", unname(code_label_map[ord]), collapse = "||")
}

.reorder_choices_by_anchor <- function(choices, survey, extra_anchor = NULL){
  if (is.null(choices) || !nrow(choices) || is.null(survey) || !nrow(survey)) return(choices)

  survey <- as.data.frame(survey, stringsAsFactors = FALSE, check.names = FALSE)
  survey$q_order_tmp <- seq_len(nrow(survey))
  survey$list_name_tmp <- vapply(as.character(survey$type), .extract_listname, FUN.VALUE = character(1))

  list_anchor <- survey %>%
    dplyr::filter(!is.na(.data$list_name_tmp) & nzchar(.data$list_name_tmp)) %>%
    dplyr::group_by(.data$list_name_tmp) %>%
    dplyr::summarise(anchor_order = min(.data$q_order_tmp), .groups = "drop") %>%
    dplyr::rename(list_name = .data$list_name_tmp)

  anchors <- list_anchor
  if (!is.null(extra_anchor) && nrow(extra_anchor)) {
    anchors <- dplyr::bind_rows(anchors, extra_anchor) %>%
      dplyr::group_by(.data$list_name) %>%
      dplyr::summarise(
        anchor_order = min(.data$anchor_order),
        is_new = max(dplyr::coalesce(.data$is_new, FALSE)),
        .groups = "drop"
      )
  } else {
    anchors$is_new <- FALSE
  }

  anchors$is_new[is.na(anchors$is_new)] <- FALSE
  choices$row_id_tmp <- seq_len(nrow(choices))
  choices <- choices %>%
    dplyr::left_join(anchors, by = "list_name") %>%
    dplyr::mutate(
      anchor_order = dplyr::coalesce(.data$anchor_order, Inf),
      is_new = dplyr::coalesce(.data$is_new, FALSE)
    ) %>%
    dplyr::arrange(.data$anchor_order, .data$is_new, .data$list_name, .data$row_id_tmp) %>%
    dplyr::select(-dplyr::all_of(c("row_id_tmp", "anchor_order", "is_new")))

  choices
}

.style <- function(hex) openxlsx::createStyle(fgFill = hex)

.paint_new <- function(wb, sheet, rows, ncols, hex){
  rows <- unique(rows[!is.na(rows)])
  if (!length(rows)) return()
  openxlsx::addStyle(wb, sheet, .style(hex),
                     rows = rows, cols = 1:ncols,
                     gridExpand = TRUE, stack = TRUE)
}

# ---------- núcleo: insertar una pregunta *_recod + lista ---------------------

.add_recoded_q <- function(survey, choices,
                           base_name,
                           kind = c("multiple","one"),
                           list_name_hint = NULL,
                           tokens_from_data = character(0),
                           labels_from_data = NULL,
                           lab_col_s,
                           lab_col_c,
                           choices_order = c("original_first","by_first_seen","alphabetical"),
                           insert_below_original = TRUE,
                           copy_from_original    = TRUE,
                           new_name_override     = NULL){

  kind          <- match.arg(kind)
  choices_order <- match.arg(choices_order)

  # fila base (si existe)
  i_base <- match(base_name, survey$name)
  base_type  <- if (!is.na(i_base)) as.character(survey$type[i_base]) else {
    if (kind=="multiple") "select_multiple" else "select_one"
  }
  base_label <- if (!is.na(i_base)) {
    as.character(survey[[lab_col_s]][i_base] %||% base_name)
  } else base_name

  # list original (si existe)
  ln_orig <- .extract_listname(base_type)

  # list destino
  base_list <- if (!is.null(list_name_hint)) {
    list_name_hint
  } else if (!is.na(ln_orig)) {
    paste0(ln_orig, "_recod")
  } else {
    paste0(.sanitize(base_name), "_recod")
  }

  # nombre nuevo de la pregunta
  new_name <- if (!is.null(new_name_override)) new_name_override else paste0(base_name, "_recod")
  new_type <- if (kind=="multiple") {
    paste("select_multiple", base_list)
  } else {
    paste("select_one", base_list)
  }

  # catálogo a crear
  codes   <- character(0)
  labels  <- character(0)
  copied_original <- FALSE

  # copiar catálogo original si aplica (SM / SO padre)
  if (copy_from_original && is.null(list_name_hint) && !is.na(ln_orig) &&
      ln_orig %in% choices$list_name) {
    orig <- choices %>% dplyr::filter(.data$list_name == ln_orig)
    if (nrow(orig)) {
      copied_original <- TRUE
      codes  <- c(codes, as.character(orig$name))
      labcol <- lab_col_c
      labels <- c(labels, as.character(orig[[labcol]]))
    }
  }

  # añadir tokens observados (de la data)
  if (length(tokens_from_data)) {
    seen <- unique(tokens_from_data[nzchar(tokens_from_data)])
    new_codes <- setdiff(seen, codes)
    if (length(new_codes)) {
      codes  <- c(codes, new_codes)
      labels <- c(labels, rep(NA_character_, length(new_codes)))
    }
  }

  if (length(codes) && !is.null(labels_from_data) && length(labels_from_data)) {
    idx_map <- match(codes, names(labels_from_data))
    hit_map <- !is.na(idx_map)
    labels[hit_map] <- dplyr::coalesce(labels[hit_map], unname(labels_from_data[idx_map[hit_map]]))
  }

  # completar labels faltantes desde el código para evitar choices sin etiqueta
  if (length(codes)) {
    na_lab <- is.na(labels) | !nzchar(labels)
    labels[na_lab] <- codes[na_lab]
  }

  # ordenar catálogo
  if (choices_order == "alphabetical" && length(codes)) {
    o <- order(codes)
    codes  <- codes[o]
    labels <- labels[o]
  }

  # fila nueva en survey (debajo de la base si existe)
  new_row <- survey[0,]
  new_row[1, setdiff(names(survey), character(0))] <- NA
  new_row$type <- new_type
  new_row$name <- new_name
  new_row[[lab_col_s]] <- base_label  # misma etiqueta que la base

  survey2 <- .row_after(survey, i_base, new_row)

  # inyectar choices del list destino (evitando duplicados exactos)
  if (length(codes)) {
    if (lab_col_c %in% names(choices)) {
      choices[[lab_col_c]] <- as.character(choices[[lab_col_c]])
    }
    add_choices <- tibble::tibble(list_name = base_list,
                                  name      = codes)
    add_choices[[lab_col_c]] <- labels

    dup_mask <- paste(choices$list_name, choices$name) %in%
      paste(add_choices$list_name, add_choices$name)
    if (any(dup_mask)) {
      choices <- choices[!dup_mask, , drop = FALSE]
    }

    # posición: debajo del catálogo original (si se desea y existe), o al final
    below <- NA_integer_
    if (insert_below_original && !is.na(ln_orig) && ln_orig %in% choices$list_name) {
      hit <- which(choices$list_name == ln_orig)
      if (length(hit)) below <- max(hit)
    }

    if (!is.na(below) && below < nrow(choices)) {
      choices2 <- dplyr::bind_rows(
        choices %>% dplyr::slice(1:below),
        add_choices,
        choices %>% dplyr::slice((below+1):dplyr::n())
      )
    } else {
      choices2 <- dplyr::bind_rows(choices, add_choices)
    }
  } else {
    choices2 <- choices
  }

  list(
    survey    = survey2,
    choices   = choices2,
    new_name  = new_name,
    list_name = base_list
  )
}

# =============================================================================
#' @title Adaptar instrumento XLSForm a partir de una data recodificada
#'
#' @description
#' Genera una versión adaptada de un instrumento XLSForm (hojas \code{survey} y
#' \code{choices}) a partir de una data ya recodificada (output de
#' \code{ppra_adaptar_data}), creando preguntas y listas nuevas para documentar
#' los códigos de recodificación.
#'
#' La función:
#' \itemize{
#'   \item Para variables \strong{select\_multiple} (\code{sm_vars}): crea una nueva
#'   pregunta \code{<parent>_recod} de tipo \code{select_multiple} con una lista
#'   derivada del catálogo original más los códigos observados en la data. La nueva
#'   lista se inserta \emph{debajo} del catálogo original en \code{choices}.
#'
#'   \item Para variables \strong{select\_one} que recodifican al padre
#'   (\code{so_parent_vars}): crea una nueva pregunta \code{<parent>_recod} de tipo
#'   \code{select_one} con una lista derivada del catálogo original más los códigos
#'   observados en la data. La nueva lista también se inserta \emph{debajo} del
#'   catálogo original en \code{choices}.
#'
#'   \item Para variables \strong{select\_one} cuyo recodificado está en el hijo
#'   (\code{so_child_vars}): detecta columnas hijas
#'   \code{^<parent>_.+_recod$} (excluyendo \code{<parent>_recod}) en todas
#'   las hojas de la data adaptada y crea, para cada una, una nueva pregunta
#'   cuyo nombre coincide con la columna hija (por ejemplo,
#'   \code{calidad_docente_why_recod}) de tipo \code{select_one} con una lista
#'   propia construida a partir de los valores observados en dicha columna.
#'   Estas listas se añaden al final de \code{choices}, con nombres del tipo
#'   \code{<child>_lista} (por ejemplo, \code{calidad_docente_why_recod_lista},
#'   sin sufijo extra \code{_recod}).
#'
#'   \item Para variables \strong{integer} (\code{integer_vars}): crea una nueva
#'   pregunta \code{<var>_recod} de tipo \code{select_one <var>_recod_lista}.
#'   La lista \code{<var>_recod_lista} se construye a partir de los valores
#'   únicos observados en \code{<var>_recod} en la data adaptada (todas las hojas)
#'   y se añade al final de \code{choices}.
#' }
#'
#' En todos los casos, la nueva pregunta hereda exactamente la misma etiqueta
#' (\code{label}) que la pregunta base, sin añadir sufijos como \code{"[recod]"}.
#'
#' Además, si \code{paint = TRUE}, la función colorea:
#' \itemize{
#'   \item Las nuevas filas de \code{survey}: verde para \code{sm_vars}, azul
#'   para \code{so_parent_vars} y \code{so_child_vars}, y morado para
#'   \code{integer_vars}.
#'   \item Las filas de \code{choices} correspondientes a las nuevas listas:
#'   verde claro (SM), azul claro (SO) y morado claro (integer).
#' }
#'
#' @param path_instrumento_in Ruta al XLSX del instrumento original. Debe contener,
#'   al menos, las hojas \code{"survey"} y \code{"choices"}.
#' @param path_data_adaptada Data adaptada sobre la cual se construyen los nuevos
#'   catálogos y preguntas. Puede ser:
#'   \itemize{
#'     \item una ruta a un archivo XLSX (potencialmente con varias hojas), o
#'     \item un \code{data.frame} con las columnas \code{*_recod}.
#'   }
#'   Si es XLSX, la función lee todas las hojas para recolectar los tokens.
#' @param path_instrumento_out Ruta del XLSX de salida con el instrumento
#'   adaptado. Por defecto \code{"instrumento_adaptado.xlsx"}.
#' @param path_plantilla Ruta opcional a la plantilla de codificación. Si se
#'   proporciona, se usa para recuperar etiquetas de códigos nuevos en
#'   \code{select_multiple}, \code{select_one} e \code{integer}, sin requerir
#'   columnas \code{*_recod_label} en la data.
#' @param sm_vars Vector de nombres de variables \code{select_multiple} (padres)
#'   para las que se creará \code{<parent>_recod} como \code{select_multiple}.
#' @param so_parent_vars Vector de nombres de variables \code{select_one} (padres)
#'   para las que se creará \code{<parent>_recod} como \code{select_one}, usando
#'   el catálogo del padre más los códigos observados en la data.
#' @param so_child_vars Vector de nombres de variables \code{select_one} cuyos
#'   recodificados están en columnas hijas \code{<parent>_<alias>_recod}. Para
#'   cada hija detectada se crea una nueva pregunta (con el mismo nombre de la
#'   columna hija) con lista propia, basada en los valores observados en la data
#'   adaptada.
#' @param integer_vars Vector de nombres de variables \code{integer} para las
#'   que se creará una nueva pregunta \code{<var>_recod} de tipo
#'   \code{select_one <var>_recod_lista}, donde \code{<var>_recod_lista} se
#'   construye a partir de los valores únicos observados en \code{<var>_recod}.
#' @param choices_order Criterio de orden para los códigos en las nuevas listas.
#'   Puede ser \code{"original_first"} (por defecto), \code{"alphabetical"} o
#'   \code{"by_first_seen"}.
#' @param paint Lógico; si es \code{TRUE}, colorea las filas nuevas en
#'   \code{survey} y las listas nuevas en \code{choices} para facilitar la
#'   inspección visual.
#'
#' @return Invisiblemente, una lista con:
#'   \itemize{
#'     \item \code{survey}: data.frame de la hoja \code{survey} adaptada.
#'     \item \code{choices}: data.frame de la hoja \code{choices} adaptada.
#'     \item \code{out_path}: ruta al XLSX escrito en disco.
#'   }
#'
#' @family codificacion
#' @export
# =============================================================================
ppra_adaptar_instrumento <- function(path_instrumento_in,
                                     path_data_adaptada,
                                     path_instrumento_out = "instrumento_adaptado.xlsx",
                                     sm_vars        = character(0),
                                     so_parent_vars = character(0),
                                     so_child_vars  = character(0),
                                     text_vars      = character(0),
                                     integer_vars   = character(0),
                                     choices_order  = c("original_first","by_first_seen","alphabetical"),
                                     paint = TRUE,
                                     path_plantilla = NULL){

  choices_order <- match.arg(choices_order)
  stopifnot(file.exists(path_instrumento_in))

  # --- leer instrumento base ---
  survey  <- readxl::read_excel(path_instrumento_in, sheet = "survey")
  choices <- readxl::read_excel(path_instrumento_in, sheet = "choices")
  if (!all(c("type","name") %in% names(survey)))
    stop("survey debe tener columnas 'type' y 'name'.")
  if (!all(c("list_name","name") %in% names(choices)))
    stop("choices debe tener columnas 'list_name' y 'name'.")

  lab_col_s <- .guess_label_col(survey)
  lab_col_c <- .guess_label_col(choices)

  survey$name       <- as.character(survey$name)
  choices$name      <- as.character(choices$name)
  choices$list_name <- as.character(choices$list_name)
  survey_base <- survey

  # --- preparar acceso multi-hojas ---
  df_is_xlsx <- is.character(path_data_adaptada) && file.exists(path_data_adaptada)
  df_single  <- is.data.frame(path_data_adaptada)
  if (!df_is_xlsx && !df_single)
    stop("path_data_adaptada debe ser data.frame o ruta a XLSX con la data adaptada.")
  all_cols_data <- .collect_all_colnames(path_data_adaptada)

  # --- logs de NUEVOS NOMBRES (survey) y listas nuevas (choices) -------------
  new_names_sm   <- character(0)   # nombres nuevos para SM
  new_names_so   <- character(0)   # nombres nuevos para SO (padre + hijo)
  new_names_int  <- character(0)   # nombres nuevos para INTEGER

  new_lists_sm   <- character(0)   # list_name nuevas SM
  new_lists_so   <- character(0)   # list_name nuevas SO (padre + hijo)
  new_lists_int  <- character(0)   # list_name nuevas INTEGER
  integer_registry <- list()

  # =======================
  # 1) SELECT MULTIPLE (padre)
  # =======================
  if (length(sm_vars)) {
    for (pv in sm_vars) {
      col_rec <- paste0(pv, "_recod")
      toks <- .collect_tokens_from_col(path_data_adaptada, col_rec)
      known_codes <- if (pv %in% survey$name) {
        ln_orig <- .extract_listname(as.character(survey$type[match(pv, survey$name)][1]))
        if (!is.na(ln_orig) && ln_orig %in% choices$list_name) {
          as.character(choices$name[choices$list_name == ln_orig])
        } else {
          character(0)
        }
      } else {
        character(0)
      }

      lab_map <- .collect_sm_code_label_map_from_template(
        path_plantilla = path_plantilla,
        parent = pv,
        known_codes = known_codes,
        context = pv
      )
      if (!length(lab_map)) {
        lab_map <- .collect_code_label_map_from_sm_cols(
          path_data_adaptada,
          code_col = col_rec,
          label_col = paste0(col_rec, "_label"),
          known_codes = known_codes,
          context = pv
        )
      }

      res <- .add_recoded_q(survey, choices,
                            base_name      = pv,
                            kind           = "multiple",
                            list_name_hint = NULL,  # usa <ln_orig>_recod
                            tokens_from_data = toks,
                            labels_from_data = lab_map,
                            lab_col_s      = lab_col_s,
                            lab_col_c      = lab_col_c,
                            choices_order  = choices_order,
                            insert_below_original = TRUE,
                            copy_from_original    = TRUE,
                            new_name_override     = NULL)

      survey  <- res$survey
      choices <- res$choices

      new_names_sm   <- c(new_names_sm,   res$new_name)
      new_lists_sm   <- c(new_lists_sm,   res$list_name)
    }
  }

  # =======================
  # 2) SELECT ONE (padre)
  # =======================
  if (length(so_parent_vars)) {
    for (pv in so_parent_vars) {
      col_rec <- paste0(pv, "_recod")
      toks <- .collect_tokens_from_col(path_data_adaptada, col_rec)
      known_codes <- if (pv %in% survey$name) {
        ln_orig <- .extract_listname(as.character(survey$type[match(pv, survey$name)][1]))
        if (!is.na(ln_orig) && ln_orig %in% choices$list_name) {
          as.character(choices$name[choices$list_name == ln_orig])
        } else {
          character(0)
        }
      } else {
        character(0)
      }
      required_new <- setdiff(unique(toks[nzchar(toks)]), known_codes)
      lab_map <- .collect_aux_code_label_map_from_template(
        path_plantilla = path_plantilla,
        parent = pv,
        target_col = col_rec,
        known_codes = known_codes,
        required_codes = required_new,
        context = pv
      )
      if (!length(lab_map)) {
        lab_map <- .collect_code_label_map_from_col(
          path_data_adaptada,
          code_col = col_rec,
          label_col = paste0(pv, "_recod_label"),
          known_codes = known_codes,
          context = pv
        )
      }

      res <- .add_recoded_q(survey, choices,
                            base_name      = pv,
                            kind           = "one",
                            list_name_hint = NULL,  # usa <ln_orig>_recod
                            tokens_from_data = toks,
                            labels_from_data = lab_map,
                            lab_col_s      = lab_col_s,
                            lab_col_c      = lab_col_c,
                            choices_order  = choices_order,
                            insert_below_original = TRUE,
                            copy_from_original    = TRUE,
                            new_name_override     = NULL)

      survey  <- res$survey
      choices <- res$choices

      new_names_so   <- c(new_names_so,   res$new_name)
      new_lists_so   <- c(new_lists_so,   res$list_name)
    }
  }

  # =======================
  # 3) SELECT ONE (hijo)
  # =======================
  if (length(so_child_vars)) {
    for (pv in so_child_vars) {
      child_vars <- .find_text_children_for_parent(survey_base, pv)
      child_cols <- intersect(paste0(child_vars, "_recod"), all_cols_data)
      if (!length(child_cols)) {
        child_cols <- .collect_child_cols(path_data_adaptada, pv)
      }
      if (!length(child_cols)) next

      for (cc in child_cols) {
        toks <- .collect_tokens_from_col(path_data_adaptada, cc)
        toks <- toks[nzchar(toks)]
        lab_map <- .collect_aux_code_label_map_from_template(
          path_plantilla = path_plantilla,
          parent = pv,
          target_col = cc,
          known_codes = character(0),
          required_codes = unique(toks),
          context = cc
        )
        if (!length(lab_map)) {
          lab_map <- .collect_code_label_map_from_col(
            path_data_adaptada,
            code_col = cc,
            label_col = paste0(cc, "_label"),
            known_codes = character(0),
            context = cc
          )
        }

        # base para la etiqueta: versión sin _recod
        base_child_name <- sub("(?i)_recod$", "", cc, perl = TRUE)

        res <- .add_recoded_q(survey, choices,
                              base_name      = base_child_name,                 # para type/label
                              kind           = "one",
                              list_name_hint = paste0("lst_", cc),
                              tokens_from_data = toks,
                              labels_from_data = lab_map,
                              lab_col_s      = lab_col_s,
                              lab_col_c      = lab_col_c,
                              choices_order  = choices_order,
                              insert_below_original = FALSE,
                              copy_from_original    = FALSE,   # sin catálogo original
                              new_name_override     = cc)      # nombre EXACTO de la col hija recod

      survey  <- res$survey
      choices <- res$choices

        new_names_so   <- c(new_names_so,   res$new_name)
        new_lists_so   <- c(new_lists_so,   res$list_name)
      }
    }
  }

  # =======================
  # 4) TEXT independiente
  # =======================
  if (length(text_vars)) {
    for (pv in text_vars) {
      col_rec <- paste0(pv, "_recod")
      if (!col_rec %in% all_cols_data) next
      toks <- .collect_tokens_from_col(path_data_adaptada, col_rec)
      toks <- toks[nzchar(toks)]
      lab_map <- .collect_aux_code_label_map_from_template(
        path_plantilla = path_plantilla,
        parent = pv,
        target_col = col_rec,
        known_codes = character(0),
        required_codes = unique(toks),
        context = col_rec
      )
      if (!length(lab_map)) {
        lab_map <- .collect_code_label_map_from_col(
          path_data_adaptada,
          code_col = col_rec,
          label_col = paste0(col_rec, "_label"),
          known_codes = character(0),
          context = col_rec
        )
      }

      res <- .add_recoded_q(survey, choices,
                            base_name      = pv,
                            kind           = "one",
                            list_name_hint = paste0("lst_", col_rec),
                            tokens_from_data = toks,
                            labels_from_data = lab_map,
                            lab_col_s      = lab_col_s,
                            lab_col_c      = lab_col_c,
                            choices_order  = choices_order,
                            insert_below_original = TRUE,
                            copy_from_original    = FALSE,
                            new_name_override     = col_rec)

      survey  <- res$survey
      choices <- res$choices

      new_names_so <- c(new_names_so, res$new_name)
      new_lists_so <- c(new_lists_so, res$list_name)
    }
  }

  # =======================
  # 5) INTEGER
  # =======================
  if (length(integer_vars)) {
    for (pv in integer_vars) {
      col_rec <- paste0(pv, "_recod")
      toks <- .collect_tokens_from_col(path_data_adaptada, col_rec)
      lab_map <- .collect_aux_code_label_map_from_template(
        path_plantilla = path_plantilla,
        parent = pv,
        target_col = col_rec,
        known_codes = character(0),
        required_codes = unique(toks[nzchar(toks)]),
        context = pv
      )
      if (!length(lab_map)) {
        lab_map <- .collect_code_label_map_from_col(
          path_data_adaptada,
          code_col = col_rec,
          label_col = paste0(col_rec, "_label"),
          known_codes = character(0),
          context = pv
        )
      }
      sig <- .code_label_signature(lab_map)
      known_list <- if (nzchar(sig) && !is.null(integer_registry[[sig]])) integer_registry[[sig]] else NULL
      list_hint <- known_list %||% paste0("lst_", pv, "_recod")
      tokens_use <- if (is.null(known_list)) toks else character(0)
      labels_use <- if (is.null(known_list)) lab_map else NULL

      res <- .add_recoded_q(survey, choices,
                            base_name      = pv,
                            kind           = "one",
                            list_name_hint = list_hint,
                            tokens_from_data = tokens_use,
                            labels_from_data = labels_use,
                            lab_col_s      = lab_col_s,
                            lab_col_c      = lab_col_c,
                            choices_order  = choices_order,
                            insert_below_original = FALSE,
                            copy_from_original    = FALSE,  # no hay catálogo original
                            new_name_override     = NULL)   # genera <var>_recod

      if (nzchar(sig) && is.null(integer_registry[[sig]])) {
        integer_registry[[sig]] <- res$list_name
      }

      survey  <- res$survey
      choices <- res$choices

      new_names_int  <- c(new_names_int,  res$new_name)
      new_lists_int  <- c(new_lists_int,  res$list_name)
    }
  }

  choices <- .reorder_choices_by_anchor(choices, survey)

  # =======================
  # 5) Exportar + colorear
  # =======================
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    warning("No se encontró 'openxlsx'. Se guarda sin color.")
    openxlsx::write.xlsx(list(survey = survey, choices = choices),
                         path_instrumento_out, overwrite = TRUE)
  } else {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "survey")
    openxlsx::addWorksheet(wb, "choices")
    openxlsx::writeData(wb, "survey", survey)
    openxlsx::writeData(wb, "choices", choices)

    if (isTRUE(paint)) {
      # Colores pastel: SM (verde), SO (azul), INTEGER (morado)
      verde_s  <- "#DFF5DF"
      azul_s   <- "#DCEBFF"
      morado_s <- "#E6D9F2"

      verde_c  <- "#EFFAEF"
      azul_c   <- "#EEF5FF"
      morado_c <- "#F2E6FF"

      # survey: localizar filas por NOMBRE (columna name)
      rows_sm  <- which(survey$name %in% unique(new_names_sm))
      rows_so  <- which(survey$name %in% unique(new_names_so))
      rows_int <- which(survey$name %in% unique(new_names_int))

      # en Excel, fila 1 = encabezados → sumar 1
      .paint_new(wb, "survey", rows_sm  + 1L, ncol(survey), verde_s)
      .paint_new(wb, "survey", rows_so  + 1L, ncol(survey), azul_s)
      .paint_new(wb, "survey", rows_int + 1L, ncol(survey), morado_s)

      # choices: pintar por list_name nuevas
      paint_choices <- function(list_names, hex){
        list_names <- unique(list_names)
        if (!length(list_names)) return()
        ln_idx <- which(choices$list_name %in% list_names)
        if (length(ln_idx)) {
          openxlsx::addStyle(wb, "choices", .style(hex),
                             rows = ln_idx + 1L, cols = 1:ncol(choices),
                             gridExpand = TRUE, stack = TRUE)
        }
      }

      paint_choices(unique(new_lists_sm),  verde_c)
      paint_choices(unique(new_lists_so),  azul_c)
      paint_choices(unique(new_lists_int), morado_c)
    }

    openxlsx::freezePane(wb, "survey",  firstActiveRow = 2)
    openxlsx::freezePane(wb, "choices", firstActiveRow = 2)
    openxlsx::setColWidths(wb, "survey",  cols = 1:ncol(survey),  widths = "auto")
    openxlsx::setColWidths(wb, "choices", cols = 1:ncol(choices), widths = "auto")
    openxlsx::saveWorkbook(wb, path_instrumento_out, overwrite = TRUE)
  }

  invisible(list(
    survey   = survey,
    choices  = choices,
    out_path = path_instrumento_out
  ))
}
