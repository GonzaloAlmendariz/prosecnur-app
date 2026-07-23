# =============================================================================
# Helpers de opciones, etiquetas y paletas del motor de reportes "plan" (PPT).
# =============================================================================
#
# Origen: bloque de helpers top-level extraído VERBATIM de la cabecera de
# `reporte_plan_ppt.R` (archivo congelado a crecimiento — Fase 2 del plan de
# mejoras 2026-07). Cero cambio de comportamiento: son funciones del paquete,
# los call sites (reporte_plan_ppt.R, graficos_consolidado.R y tests) las
# siguen resolviendo por el mismo namespace.
#
# Qué vive aquí:
#   - Normalización de texto/opciones de tablas de frecuencia
#     (.reporte_plan_clean_chr, .reporte_plan_prepare_freq_options,
#      .reporte_plan_filter_freq_options, alias de exclusión).
#   - Resolución de variables recodificadas y dummies de select_multiple
#     (.reporte_plan_resolve_recod_var, .reporte_plan_has_var_or_dummies).
#   - Etiquetas y niveles desde el catálogo de choices del instrumento
#     (.reporte_plan_choice_levels_for_list, .reporte_plan_labels_for_levels,
#      .reporte_plan_ordered_stack_levels, prefijos OE).
#   - Paletas por list_name (.reporte_plan_palette_for_levels,
#      .reporte_plan_pulso_palette_for_levels).
#   - Aviso interno de opción múltiple (.ppt_multiple_choice_notice_overrides).

#' @noRd
.reporte_plan_regex_escape <- function(x) {
  gsub("([][{}()+*^$.|?\\\\])", "\\\\\\1", as.character(x), perl = TRUE)
}

#' @noRd
.reporte_plan_has_var_or_dummies <- function(data, var) {
  if (!is.data.frame(data)) return(FALSE)
  var <- if (is.null(var)) "" else as.character(var)[1]
  if (!nzchar(trimws(var))) return(FALSE)
  if (var %in% names(data)) return(TRUE)

  esc <- .reporte_plan_regex_escape(var)
  any(grepl(paste0("^", esc, "([/]|\\.)"), names(data), perl = TRUE))
}

#' @noRd
.reporte_plan_resolve_recod_var <- function(var, data) {
  var <- if (is.null(var)) "" else as.character(var)[1]
  if (!nzchar(trimws(var)) || grepl("_recod$", var)) return(var)

  recod <- paste0(var, "_recod")
  if (.reporte_plan_has_var_or_dummies(data, recod)) recod else var
}

#' @noRd
.reporte_plan_clean_chr <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  trimws(x)
}

#' @noRd
.reporte_plan_ascii_lower <- function(x) {
  x <- .reporte_plan_clean_chr(x)
  out <- iconv(x, from = "", to = "ASCII//TRANSLIT")
  out[is.na(out)] <- x[is.na(out)]
  tolower(out)
}

#' @noRd
.reporte_plan_clean_other_label_es <- function(x) {
  y <- .reporte_plan_clean_chr(x)
  if (!length(y)) return(y)

  norm <- .reporte_plan_ascii_lower(y)
  norm <- gsub("\\s+", " ", norm, perl = TRUE)
  norm <- trimws(norm)
  stripped <- gsub("\\s*\\([^)]*(especific|specif|please)[^)]*\\)\\s*:?", "", norm, perl = TRUE)
  stripped <- gsub("\\s*,?\\s*(por favor\\s+)?(especificar|especifique|especifica|specify|please specify)\\s*:?", "", stripped, perl = TRUE)
  stripped <- trimws(gsub("\\s+", " ", stripped, perl = TRUE))

  is_other <- (
    grepl("\\b(other|otro|otra|otros|otras)\\b", norm, perl = TRUE) &
      grepl("\\b(especific|specif|please|por favor)\\b", norm, perl = TRUE)
  ) | grepl("^\\s*(other|otro|otra|otros|otras)\\b", norm, perl = TRUE) |
    stripped %in% c("other", "otro", "otra", "otros", "otras")

  y[is_other] <- "Otros"
  y
}

#' @noRd
.reporte_plan_prepare_freq_options <- function(tab, incluir_sin_n = FALSE) {
  if (is.null(tab) || !is.data.frame(tab) || !nrow(tab)) return(tab)
  if (!all(c("Opciones", "n") %in% names(tab))) return(tab)

  opts <- .reporte_plan_clean_chr(tab$Opciones)
  n_vals <- suppressWarnings(as.numeric(tab$n))
  keep <- opts != "Total" & !is.na(n_vals)
  if (!isTRUE(incluir_sin_n)) keep <- keep & n_vals > 0

  out <- data.frame(
    Opciones = opts[keep],
    n = n_vals[keep],
    stringsAsFactors = FALSE
  )
  if (!nrow(out)) return(out)

  out$Opciones <- .reporte_plan_clean_other_label_es(out$Opciones)
  out <- out[nzchar(out$Opciones), , drop = FALSE]
  if (!nrow(out)) return(out)

  if (anyDuplicated(out$Opciones)) {
    keys <- unique(out$Opciones)
    out <- data.frame(
      Opciones = keys,
      n = vapply(keys, function(k) sum(out$n[out$Opciones == k], na.rm = TRUE), numeric(1)),
      stringsAsFactors = FALSE
    )
  }

  out
}

#' @noRd
.reporte_plan_norm_option_alias <- function(x) {
  x <- .reporte_plan_ascii_lower(x)
  x <- gsub("[^a-z0-9]+", " ", x, perl = TRUE)
  trimws(gsub("\\s+", " ", x, perl = TRUE))
}

#' @noRd
.reporte_plan_excluir_opciones <- function(...) {
  vals <- unlist(list(...), use.names = FALSE)
  if (is.null(vals) || !length(vals)) return(NULL)
  vals <- .reporte_plan_clean_chr(vals)
  vals <- vals[nzchar(vals)]
  if (!length(vals)) return(NULL)
  unique(vals)
}

#' @noRd
.reporte_plan_filter_freq_options <- function(tab, excluir_opciones = NULL) {
  if (is.null(tab) || !is.data.frame(tab) || !nrow(tab)) return(tab)
  attr(tab, "excluded_any") <- FALSE
  if (!all(c("Opciones", "n") %in% names(tab))) return(tab)

  excluir_opciones <- .reporte_plan_excluir_opciones(excluir_opciones)
  if (!length(excluir_opciones)) return(tab)

  blocked <- .reporte_plan_norm_option_alias(excluir_opciones)
  blocked <- blocked[nzchar(blocked)]
  if (!length(blocked)) return(tab)

  opts_norm <- .reporte_plan_norm_option_alias(tab$Opciones)
  keep <- !opts_norm %in% blocked
  out <- tab[keep, , drop = FALSE]
  attr(out, "excluded_any") <- any(!keep)
  out
}

#' @noRd
.reporte_plan_oe_numbers_from_refs <- function(refs) {
  refs <- .reporte_plan_clean_chr(refs)
  if (!length(refs)) return(integer(0))

  vapply(refs, function(ref) {
    ref <- sub("^.*(::|\\$|/)", "", ref, perl = TRUE)
    ref <- sub("_recod$", "", ref, ignore.case = TRUE, perl = TRUE)
    m <- regexec("(?:^|[_\\.-])(p13|oe|objetiv[oa]s?|obj)[_\\.-]*([0-9]+)$", ref, ignore.case = TRUE, perl = TRUE)
    got <- regmatches(ref, m)[[1]]
    if (length(got) == 3L) {
      n <- suppressWarnings(as.integer(got[3]))
      if (is.finite(n) && !is.na(n) && n > 0L) return(n)
    }
    NA_integer_
  }, integer(1))
}

#' @noRd
.reporte_plan_prefix_oe_labels <- function(labels, refs = NULL) {
  nms <- names(labels)
  labels <- .reporte_plan_clean_chr(labels)
  if (!length(labels)) return(labels)

  ref_nums <- .reporte_plan_oe_numbers_from_refs(refs %||% names(labels) %||% character(0))
  use_ref_nums <- length(ref_nums) == length(labels) &&
    all(!is.na(ref_nums)) &&
    !anyDuplicated(ref_nums)

  out <- labels
  for (i in seq_along(out)) {
    lab <- out[i]
    if (!nzchar(lab)) next
    m <- regexec("^\\s*OE\\s*([0-9]+)\\s*[:.-]\\s*(.*)$", lab, ignore.case = TRUE, perl = TRUE)
    got <- regmatches(lab, m)[[1]]
    if (length(got) == 3L) {
      rest <- trimws(got[3])
      out[i] <- paste0("OE ", got[2], ": ", rest)
    } else {
      n_oe <- if (use_ref_nums) ref_nums[[i]] else i
      out[i] <- paste0("OE ", n_oe, ": ", lab)
    }
  }
  if (!is.null(nms) && length(nms) == length(out)) names(out) <- nms
  out
}

#' @noRd
.reporte_plan_choice_label_col <- function(choices_tbl) {
  if (is.null(choices_tbl) || !is.data.frame(choices_tbl)) return(NA_character_)
  if (!length(names(choices_tbl))) return(NA_character_)

  nms <- names(choices_tbl)
  nms_lower <- tolower(nms)

  preferred <- c(
    "label",
    "label::es",
    "label::spanish (es)",
    "label::spanish(es)",
    "label_spanish_es",
    "label::spanish",
    "label::español",
    "label::espanol",
    "label_es"
  )
  preferred_hits <- nms[nms_lower %in% preferred]
  label_hits <- nms[grepl("^label(::|_)", nms, ignore.case = TRUE)]
  candidates <- unique(c(preferred_hits, label_hits))

  for (col in candidates) {
    vals <- .reporte_plan_clean_chr(choices_tbl[[col]])
    if (any(nzchar(vals))) return(col)
  }

  extras <- setdiff(nms, c("list_name", "name", "value"))
  for (col in extras) {
    vals <- .reporte_plan_clean_chr(choices_tbl[[col]])
    if (any(nzchar(vals))) return(col)
  }

  NA_character_
}

#' @noRd
.reporte_plan_choice_levels_for_list <- function(list_name, choices_use) {
  ln <- .reporte_plan_clean_chr(list_name)[1]
  if (is.na(ln) || !nzchar(ln) ||
      is.null(choices_use) || !is.data.frame(choices_use) ||
      !all(c("list_name", "name") %in% names(choices_use))) {
    return(data.frame(code = character(0), label = character(0), stringsAsFactors = FALSE))
  }

  sub <- choices_use[.reporte_plan_clean_chr(choices_use$list_name) == ln, , drop = FALSE]
  if (!nrow(sub)) {
    return(data.frame(code = character(0), label = character(0), stringsAsFactors = FALSE))
  }

  codes <- .reporte_plan_clean_chr(sub$name)
  lab_col <- .reporte_plan_choice_label_col(sub)
  labels <- if (!is.na(lab_col) && lab_col %in% names(sub)) {
    .reporte_plan_clean_chr(sub[[lab_col]])
  } else {
    codes
  }
  labels[!nzchar(labels)] <- codes[!nzchar(labels)]

  keep <- nzchar(codes) | nzchar(labels)
  data.frame(
    code = codes[keep],
    label = labels[keep],
    stringsAsFactors = FALSE
  )
}

#' @noRd
.reporte_plan_labels_for_levels <- function(list_name, levels, choices_use = NULL) {
  levels <- .reporte_plan_clean_chr(levels)
  out <- levels
  choices_levels <- .reporte_plan_choice_levels_for_list(list_name, choices_use)
  if (!nrow(choices_levels) || !length(levels)) return(out)

  for (i in seq_along(levels)) {
    level <- levels[i]
    idx <- which(choices_levels$code == level | choices_levels$label == level)
    if (length(idx)) {
      label <- choices_levels$label[idx[1]]
      if (!is.na(label) && nzchar(trimws(label))) out[i] <- label
    }
  }
  out
}

#' @noRd
.reporte_plan_legend_labels_for_levels <- function(list_name, levels, choices_use = NULL) {
  .reporte_plan_labels_for_levels(list_name, levels, choices_use = choices_use)
}

#' @noRd
.reporte_plan_ordered_stack_levels <- function(list_name,
                                               observed_opts,
                                               choices_use = NULL,
                                               palette_names = NULL) {
  observed_opts <- unique(.reporte_plan_clean_chr(observed_opts))
  observed_opts <- observed_opts[nzchar(observed_opts)]
  if (!length(observed_opts)) return(character(0))

  choices_levels <- .reporte_plan_choice_levels_for_list(list_name, choices_use)
  if (nrow(choices_levels)) {
    ordered <- character(0)
    for (i in seq_len(nrow(choices_levels))) {
      candidates <- unique(.reporte_plan_clean_chr(c(
        choices_levels$label[i],
        choices_levels$code[i]
      )))
      candidates <- candidates[nzchar(candidates)]
      hit <- observed_opts[match(candidates, observed_opts, nomatch = 0L)]
      hit <- hit[nzchar(hit)]
      hit <- setdiff(hit, ordered)
      if (length(hit)) ordered <- c(ordered, hit[1])
    }
    extras <- setdiff(observed_opts, ordered)
    return(c(ordered, extras))
  }

  palette_names <- unique(.reporte_plan_clean_chr(palette_names))
  palette_names <- palette_names[nzchar(palette_names)]
  if (length(palette_names)) {
    ordered <- intersect(palette_names, observed_opts)
    extras <- setdiff(observed_opts, ordered)
    return(c(ordered, extras))
  }

  observed_opts
}

#' @noRd
.reporte_plan_palette_for_levels <- function(list_name,
                                             levels,
                                             choices_use = NULL,
                                             palette = NULL) {
  if (is.null(palette) || !length(palette)) return(palette)

  pal <- palette
  if (is.list(pal) && !is.data.frame(pal)) {
    pal <- unlist(pal, use.names = TRUE)
  }
  if (!is.atomic(pal) || !length(pal)) return(palette)

  pal <- as.character(pal)
  ok_color <- !is.na(pal) & nzchar(trimws(pal))
  pal <- pal[ok_color]
  if (!length(pal)) return(NULL)

  levels <- .reporte_plan_clean_chr(levels)
  levels <- levels[nzchar(levels)]
  if (!length(levels)) return(pal)

  pal_names <- .reporte_plan_clean_chr(names(pal))
  if (!length(pal_names) || !any(nzchar(pal_names))) {
    n <- min(length(levels), length(pal))
    return(stats::setNames(unname(pal[seq_len(n)]), levels[seq_len(n)]))
  }

  names(pal) <- pal_names
  pal <- pal[nzchar(names(pal))]
  pal <- pal[!duplicated(names(pal))]

  choices_levels <- .reporte_plan_choice_levels_for_list(list_name, choices_use)
  out <- rep(NA_character_, length(levels))
  names(out) <- levels

  for (level in levels) {
    candidates <- level
    if (nrow(choices_levels)) {
      idx <- which(choices_levels$label == level | choices_levels$code == level)
      if (length(idx)) {
        candidates <- c(candidates, choices_levels$label[idx], choices_levels$code[idx])
      }
    }
    candidates <- unique(.reporte_plan_clean_chr(candidates))
    candidates <- candidates[nzchar(candidates)]
    hit <- pal[candidates]
    hit <- hit[!is.na(hit) & nzchar(trimws(hit))]
    if (length(hit)) out[level] <- unname(hit[1])
  }

  missing <- is.na(out) | !nzchar(trimws(out))
  if (any(missing)) {
    fallback <- unname(pal)
    n <- min(length(fallback), length(out))
    if (n > 0L) {
      positional <- stats::setNames(fallback[seq_len(n)], names(out)[seq_len(n)])
      out[missing] <- positional[names(out)[missing]]
    }
  }

  out[!is.na(out) & nzchar(trimws(out))]
}

#' @noRd
.reporte_plan_pulso_palette_for_levels <- function(levels) {
  levels <- .reporte_plan_clean_chr(levels)
  levels <- levels[nzchar(levels)]
  if (!length(levels)) return(NULL)

  main <- c("#081F5C", "#CA5651", "#85BB85", "#EFD25E", "#BFBFBF",
            "#E4A34C", "#7594CC", "#9688D3", "#D8D8D8")
  approval <- c("#CA5651", "#EFD25E", "#85BB85", "#081F5C", "#BFBFBF",
                "#E4A34C", "#7594CC", "#9688D3", "#D8D8D8")

  low_high_words <- paste(
    "nada", "poco", "bajo", "desacuerdo", "insatis", "malo",
    "alto", "acuerdo", "satis", "bueno", "mucho", "muy",
    sep = "|"
  )
  looks_like_scale <- all(grepl("^[0-9]+$", levels)) ||
    any(grepl(low_high_words, tolower(levels), perl = TRUE))

  pal <- if (looks_like_scale && length(levels) >= 3L) approval else main
  stats::setNames(rep_len(pal, length(levels)), levels)
}

#' Ajusta el aviso interno de opción múltiple sin restar altura a las barras.
#'
#' El título de la pregunta pertenece a la diapositiva, no al gráfico. Por eso
#' este encabezado solo necesita alojar el aviso de una línea.
#' @noRd
.ppt_multiple_choice_notice_overrides <- function(overrides = list()) {
  if (!is.list(overrides)) overrides <- list()

  overrides$subtitulo <- "Pregunta de opción múltiple"
  overrides$face_subtitulo <- "bold"

  size_sub <- suppressWarnings(as.numeric(overrides$size_subtitulo %||% NA_real_)[1])
  overrides$size_subtitulo <- if (is.finite(size_sub)) min(size_sub, 10.5) else 10.0
  overrides$canvas_h_header_in <- 0.34
  overrides$encabezado_separacion_in <- 0
  overrides
}
