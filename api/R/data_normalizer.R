# =============================================================================
# Normalizacion de data contra XLSForm
# =============================================================================

.dn_norm_text <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- trimws(x)
  x <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT")
  }
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", " ", x)
  trimws(gsub("\\s+", " ", x))
}

.dn_escape_regex <- function(x) {
  gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", x)
}

.dn_survey_list_name <- function(row) {
  ln <- as.character(row$list_name %||% NA_character_)[1]
  if (!is.na(ln) && nzchar(trimws(ln))) return(trimws(ln))
  tp <- trimws(as.character(row$type %||% "")[1])
  if (grepl("^select_(one|multiple)\\b", tp)) {
    out <- sub("^select_(one|multiple)\\s+([^\\s]+).*$", "\\2", tp)
    if (!identical(out, tp) && nzchar(out)) return(out)
  }
  NA_character_
}

.dn_choice_label_col <- function(choices) {
  candidates <- c("label", "label::es", "label::Spanish (ES)", "label_spanish_es")
  hit <- candidates[candidates %in% names(choices)][1]
  hit %||% NA_character_
}

.dn_is_selected_dummy <- function(x) {
  if (is.logical(x)) return(!is.na(x) & x)
  x_chr <- trimws(as.character(x))
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) {
    selected_code <- trimws(as.character(unname(labs)[1]))
    return(!is.na(x_chr) & nzchar(x_chr) & x_chr == selected_code)
  }
  x_num <- suppressWarnings(as.numeric(x_chr))
  if (!all(is.na(x_num))) {
    return(!is.na(x_num) & x_num == 1)
  }
  tolower(x_chr) %in% c("1", "true", "t", "yes", "y", "si", "sí")
}

.dn_dummy_option_label <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) {
    return(as.character(names(labs)[1]))
  }
  NA_character_
}

.dn_q_to_p_name <- function(name) {
  m <- regmatches(name, regexec("^[qQ]0*([0-9]+)(.*)$", name))[[1]]
  if (length(m) < 3L) return(NA_character_)
  rest <- m[3]
  if (grepl("^_0*[0-9]+$", rest, perl = TRUE)) {
    rest_num <- suppressWarnings(as.integer(sub("^_0*([0-9]+)$", "\\1", rest, perl = TRUE)))
    if (!is.na(rest_num)) rest <- paste0("_", rest_num)
  }
  paste0("p", as.integer(m[2]), rest)
}

.dn_pad_numeric_suffix_name <- function(name) {
  if (!grepl("^(.*_)([0-9]+)$", name, perl = TRUE)) return(NA_character_)
  prefix <- sub("^(.*_)([0-9]+)$", "\\1", name, perl = TRUE)
  suffix <- suppressWarnings(as.integer(sub("^(.*_)([0-9]+)$", "\\2", name, perl = TRUE)))
  if (is.na(suffix)) return(NA_character_)
  paste0(prefix, sprintf("%04d", suffix))
}

.dn_unpad_numeric_suffix_name <- function(name) {
  if (!grepl("^(.*_)([0-9]+)$", name, perl = TRUE)) return(NA_character_)
  prefix <- sub("^(.*_)([0-9]+)$", "\\1", name, perl = TRUE)
  suffix <- suppressWarnings(as.integer(sub("^(.*_)([0-9]+)$", "\\2", name, perl = TRUE)))
  if (is.na(suffix)) return(NA_character_)
  paste0(prefix, suffix)
}

.dn_match_sm_dummy_columns <- function(data, parent, choices_sub) {
  data_names <- names(data)
  if (!length(data_names) || is.na(parent) || !nzchar(parent)) {
    return(stats::setNames(rep(NA_character_, nrow(choices_sub)), choices_sub$name))
  }

  prefix_pat <- paste0("^", .dn_escape_regex(parent), "([_/.])(.+)$")
  candidates <- data_names[grepl(prefix_pat, data_names, perl = TRUE)]
  candidates <- candidates[!grepl("([_/.])(other|otro|otra|specify|texto)$", candidates, ignore.case = TRUE)]
  if (!length(candidates)) {
    return(stats::setNames(rep(NA_character_, nrow(choices_sub)), choices_sub$name))
  }

  suffix <- sub(prefix_pat, "\\2", candidates, perl = TRUE)
  suffix_unpadded <- sub("^0+([0-9]+)$", "\\1", suffix)
  suffix_unpadded[!nzchar(suffix_unpadded)] <- "0"
  choice_names <- as.character(choices_sub$name)

  out <- stats::setNames(rep(NA_character_, length(choice_names)), choice_names)

  # 1. Match por etiqueta de opcion del dummy SPSS vs label del XLSForm.
  choice_labels <- .dn_norm_text(choices_sub$label)
  dummy_labels <- .dn_norm_text(vapply(candidates, function(nm) .dn_dummy_option_label(data[[nm]]), character(1)))
  for (i in seq_along(choice_names)) {
    if (!nzchar(choice_labels[i])) next
    hit <- which(dummy_labels == choice_labels[i])
    if (length(hit)) out[[i]] <- candidates[hit[1]]
  }

  # 2. Match por codigo literal o codigo sin padding.
  for (i in seq_along(choice_names)) {
    if (!is.na(out[[i]]) && nzchar(out[[i]])) next
    code <- choice_names[i]
    code_unpadded <- sub("^0+([0-9]+)$", "\\1", code)
    if (!nzchar(code_unpadded)) code_unpadded <- "0"
    hit <- which(suffix == code | suffix_unpadded == code_unpadded)
    if (length(hit)) out[[i]] <- candidates[hit[1]]
  }

  # 3. Fallback por orden solo para opciones no resueltas.
  remaining_choices <- which(is.na(out) | !nzchar(out))
  remaining_dummies <- setdiff(candidates, out[!is.na(out) & nzchar(out)])
  if (length(remaining_choices) && length(remaining_dummies)) {
    ord_num <- suppressWarnings(as.numeric(sub(prefix_pat, "\\2", remaining_dummies, perl = TRUE)))
    remaining_dummies <- remaining_dummies[order(is.na(ord_num), ord_num, remaining_dummies)]
    n <- min(length(remaining_choices), length(remaining_dummies))
    out[remaining_choices[seq_len(n)]] <- remaining_dummies[seq_len(n)]
  }

  out
}

# Si la data viene con nombres SM crudos (`q0001`, `q0007_0001`) y el
# XLSForm ya está renombrado a `p1, p7` (post-importador), aliasamos las
# columnas q* a sus equivalentes p* para que el resto del normalizador y
# del pipeline encuentren las columnas. Toma las columnas del XLSForm como
# fuente de verdad: solo aliasa columnas para las que existe un equivalente
# `p<N>` en survey.
.dn_alias_q_to_p_columns <- function(data, survey) {
  if (!nrow(survey) || !"name" %in% names(survey)) {
    return(list(data = data, aliased = character(0), dropped = character(0)))
  }
  survey_names <- as.character(survey$name)
  survey_names <- survey_names[!is.na(survey_names) & nzchar(survey_names)]
  out <- data
  aliased <- character(0)
  dropped <- character(0)
  for (col in names(out)) {
    # Solo nombres con prefijo q<digits> calificarían como SM legacy.
    p_equiv <- .dn_q_to_p_name(col)
    if (is.na(p_equiv) || !nzchar(p_equiv)) next
    if (p_equiv == col) next
    target <- p_equiv
    padded_equiv <- .dn_pad_numeric_suffix_name(p_equiv)
    if (!(target %in% survey_names) && !is.na(padded_equiv) && padded_equiv %in% survey_names) {
      target <- padded_equiv
    }
    if (!(target %in% survey_names)) {
      # También podría ser una dummy `p7_1` cuyo padre `p7` está en survey.
      mp <- regmatches(p_equiv, regexec("^(p[0-9]+)(_.*)?$", p_equiv))[[1]]
      if (length(mp) < 2L) next
      parent_p <- mp[2]
      if (!(parent_p %in% survey_names)) next
      target <- p_equiv
    }
    if (target %in% names(out)) next
    out[[target]] <- out[[col]]
    aliased <- c(aliased, stats::setNames(col, target))
    dropped <- c(dropped, col)
  }
  list(data = out, aliased = aliased, dropped = unique(dropped))
}

.dn_alias_padded_survey_columns <- function(data, survey) {
  out <- data
  aliased <- character(0)
  dropped <- character(0)
  if (!nrow(survey) || !"name" %in% names(survey)) {
    return(list(data = out, aliased = aliased, dropped = dropped))
  }

  survey_names <- as.character(survey$name)
  survey_names <- survey_names[!is.na(survey_names) & nzchar(survey_names)]
  for (nm in survey_names) {
    if (nm %in% names(out)) next
    if (!grepl("^(.*_)([0-9]+)$", nm, perl = TRUE)) next
    candidates <- unique(c(
      .dn_unpad_numeric_suffix_name(nm),
      .dn_pad_numeric_suffix_name(nm)
    ))
    candidates <- candidates[!is.na(candidates) & nzchar(candidates) & candidates != nm]
    hit <- candidates[candidates %in% names(out)][1]
    if (!is.na(hit) && nzchar(hit)) {
      out[[nm]] <- out[[hit]]
      aliased <- c(aliased, stats::setNames(hit, nm))
      dropped <- c(dropped, hit)
    }
  }
  list(data = out, aliased = aliased, dropped = unique(dropped))
}

#' Normalizar data cruda al contrato canónico del XLSForm.
#'
#' Convierte exports SurveyMonkey/SPSS de `select_multiple` desplegados como
#' columnas dummy (`q0007_0001`, `q0007_0002`, ...) a la columna madre ODK
#' normalizada (`p7 = "1 3 5"`). Usa `instrumento` como fuente de verdad para saber qué
#' preguntas son `select_multiple` y cuáles son sus opciones.
#'
#' @export
normalize_data_for_xlsform <- function(data,
                                       instrumento,
                                       drop_source_dummies = TRUE,
                                       add_metadata = TRUE) {
  if (!is.data.frame(data) || is.null(instrumento) || is.null(instrumento$survey)) {
    return(data)
  }
  survey <- instrumento$survey
  choices <- instrumento$choices %||% data.frame()
  if (!nrow(survey) || !all(c("name", "type") %in% names(survey))) {
    return(data)
  }

  out <- as.data.frame(data, stringsAsFactors = FALSE, check.names = FALSE)
  # 1. Si el XLSForm usa convención `p<N>` (post-importador SM) y la data
  #    aún viene con nombres `q<N>...`, aliasamos q* → p* primero.
  q2p_info <- .dn_alias_q_to_p_columns(out, survey)
  out <- q2p_info$data
  # 2. Alias de padding para datos que aún llegan como p7_0001 frente a un XLSForm p7_1.
  alias_info <- .dn_alias_padded_survey_columns(out, survey)
  out <- alias_info$data
  sm_rows <- survey[grepl("^select_multiple\\b", as.character(survey$type)), , drop = FALSE]

  dropped <- unique(c(q2p_info$dropped, alias_info$dropped))
  aliased_combined <- c(q2p_info$aliased, alias_info$aliased)
  normalized <- list()

  choices_ok <- nrow(choices) > 0L && all(c("list_name", "name") %in% names(choices))
  if (choices_ok) {
    lab_col <- .dn_choice_label_col(choices)
    if (is.na(lab_col)) choices$label <- as.character(choices$name) else choices$label <- as.character(choices[[lab_col]])
  } else {
    sm_rows <- sm_rows[0, , drop = FALSE]
  }

  for (i in seq_len(nrow(sm_rows))) {
    parent <- as.character(sm_rows$name[i])
    if (is.na(parent) || !nzchar(parent)) next
    ln <- .dn_survey_list_name(sm_rows[i, , drop = FALSE])
    if (is.na(ln) || !nzchar(ln)) next
    ch <- choices[as.character(choices$list_name) == ln, c("name", "label"), drop = FALSE]
    if (!nrow(ch)) next
    ch$name <- as.character(ch$name)
    dummies <- .dn_match_sm_dummy_columns(out, parent, ch)
    dummies <- dummies[!is.na(dummies) & nzchar(dummies) & dummies %in% names(out)]
    if (!length(dummies)) next

    token_mat <- vapply(names(dummies), function(code) {
      ifelse(.dn_is_selected_dummy(out[[dummies[[code]]]]), code, NA_character_)
    }, character(nrow(out)))
    if (is.null(dim(token_mat))) {
      token_mat <- matrix(token_mat, ncol = 1L)
      colnames(token_mat) <- names(dummies)
    }
    mother <- apply(token_mat, 1L, function(z) {
      z <- z[!is.na(z) & nzchar(z)]
      if (!length(z)) return(NA_character_)
      paste(z, collapse = " ")
    })
    out[[parent]] <- mother
    attr(out[[parent]], "label") <- as.character(sm_rows$label[i] %||% parent)
    normalized[[parent]] <- unname(dummies)
    dropped <- unique(c(dropped, unname(dummies)))
  }

  if (isTRUE(drop_source_dummies) && length(dropped)) {
    out <- out[, setdiff(names(out), dropped), drop = FALSE]
  }

  if (isTRUE(add_metadata) && (length(normalized) || length(aliased_combined))) {
    attr(out, "xlsform_normalized") <- list(
      normalized_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
      select_multiple = normalized,
      aliases = aliased_combined,
      dropped_columns = if (isTRUE(drop_source_dummies)) dropped else character(0)
    )
  }

  out
}
