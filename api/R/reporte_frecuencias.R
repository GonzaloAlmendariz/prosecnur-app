# ============================
# Helpers internos
# ============================

#' @noRd
.freq_is_consecutive_numeric_scale <- function(names) {
  codes <- trimws(as.character(names %||% character(0)))
  if (length(codes) < 5L || any(!nzchar(codes))) return(FALSE)
  if (any(!grepl("^-?[0-9]+$", codes))) return(FALSE)
  vals <- suppressWarnings(as.integer(codes))
  if (any(is.na(vals))) return(FALSE)
  all(diff(vals) == 1L)
}

#' @noRd
.freq_scale_labels_should_be_codes <- function(names, labels) {
  names <- as.character(names %||% character(0))
  labels <- as.character(labels %||% character(0))
  if (!.freq_is_consecutive_numeric_scale(names)) return(FALSE)
  if (!length(labels)) labels <- rep(NA_character_, length(names))
  if (length(labels) != length(names)) labels <- rep_len(labels, length(names))

  empty <- is.na(labels) | !nzchar(trimws(labels))
  if (any(empty)) return(TRUE)

  # Escalas ancladas: los intermedios ya son codigos, pero extremos traen texto.
  matches_code <- trimws(labels) == trimws(names)
  sum(matches_code, na.rm = TRUE) >= length(names) - 2L
}

#' @noRd
.freq_fill_empty_choice_labels <- function(names, labels) {
  names <- as.character(names %||% character(0))
  labels <- as.character(labels %||% character(0))
  if (!length(names)) return(character(0))
  if (!length(labels)) labels <- rep(NA_character_, length(names))
  if (length(labels) != length(names)) labels <- rep_len(labels, length(names))
  if (.freq_scale_labels_should_be_codes(names, labels)) return(names)
  empty <- is.na(labels) | !nzchar(trimws(labels))
  labels[empty] <- names[empty]
  labels
}

#' @noRd
.freq_orders_entry <- function(orders_list, var) {
  if (is.null(orders_list) || !(var %in% names(orders_list))) return(NULL)
  entry <- orders_list[[var]]
  ord_nam <- tryCatch(entry$names, error = function(e) NULL)
  ord_lbl <- tryCatch(entry$labels, error = function(e) NULL)
  if (is.null(ord_nam)) return(NULL)
  ord_nam <- as.character(ord_nam)
  ord_lbl <- .freq_fill_empty_choice_labels(ord_nam, ord_lbl)
  list(names = ord_nam, labels = ord_lbl, label = entry$label %||% var)
}

#' @noRd
.freq_survey_list_name <- function(row) {
  ln <- as.character(row$list_name %||% NA_character_)[1]
  if (!is.na(ln) && nzchar(trimws(ln))) return(trimws(ln))

  tp <- trimws(as.character(row$type %||% "")[1])
  if (grepl("^select_(one|multiple)\\b", tp)) {
    m <- regmatches(
      tp,
      regexec("^select_(?:one|multiple)\\s+(\\S+)", tp, perl = TRUE)
    )[[1]]
    if (length(m) >= 2L && nzchar(m[2])) return(m[2])
  }

  NA_character_
}

#' @noRd
.freq_augment_orders_list_from_choices <- function(orders_list = NULL,
                                                  survey = NULL,
                                                  choices = NULL) {
  out <- orders_list %||% list()
  for (nm in names(out)) {
    if (is.null(out[[nm]]$names)) next
    out[[nm]]$labels <- .freq_fill_empty_choice_labels(out[[nm]]$names, out[[nm]]$labels)
  }
  if (is.null(survey) || is.null(choices)) return(out)
  if (!("name" %in% names(survey))) return(out)
  if (!all(c("list_name", "name", "label") %in% names(choices))) return(out)

  survey_lns <- survey
  if (!("list_name" %in% names(survey_lns))) {
    survey_lns$list_name <- NA_character_
  }
  if (!("label" %in% names(survey_lns))) {
    survey_lns$label <- survey_lns$name
  }
  survey_lns$.list_name <- vapply(
    seq_len(nrow(survey_lns)),
    function(i) .freq_survey_list_name(survey_lns[i, , drop = FALSE]),
    character(1)
  )

  survey_lns <- survey_lns |>
    dplyr::filter(
      !is.na(.data$name), nzchar(as.character(.data$name)),
      !is.na(.data$.list_name), nzchar(as.character(.data$.list_name))
    ) |>
    dplyr::transmute(
      name = as.character(.data$name),
      list_name = as.character(.data$.list_name),
      label = as.character(.data$label)
    ) |>
    dplyr::distinct()

  if (!nrow(survey_lns)) return(out)

  for (i in seq_len(nrow(survey_lns))) {
    var <- as.character(survey_lns$name[i])
    if (var %in% names(out)) next
    ln <- as.character(survey_lns$list_name[i])
    ch <- choices |>
      dplyr::filter(
        as.character(.data$list_name) == ln,
        !is.na(.data$name), nzchar(as.character(.data$name))
      )
    if (!nrow(ch)) next
    labels <- .freq_fill_empty_choice_labels(ch$name, ch$label)
    out[[var]] <- list(
      names = as.character(ch$name),
      labels = labels,
      label = as.character(survey_lns$label[i] %||% var)
    )
  }

  out
}

#' @noRd
.peso_vec <- function(data){
  if (!("peso" %in% names(data))) return(rep(1, nrow(data)))
  w <- suppressWarnings(as.numeric(data$peso))
  w[!is.finite(w) | is.na(w)] <- 0
  w
}

#' @noRd
.auto_row_height <- function(text, chars_per_line = 70, base = 24, per_line = 16){
  if (length(text) == 0 || is.na(text)) return(base)
  txt <- gsub("\\r?\\n", " ", as.character(text))
  lines <- max(1, ceiling(nchar(txt) / chars_per_line))
  base + (lines - 1) * per_line
}

#' @noRd
.move_ns_pref_last <- function(tab){
  if (!nrow(tab) || !"Opciones" %in% names(tab)) return(tab)
  idx <- which(trimws(tab$Opciones) == "No sé / Prefiero no decir")
  if (length(idx) == 0) return(tab)
  dplyr::bind_rows(tab[-idx, , drop = FALSE],
                   tab[ idx, , drop = FALSE])
}

#' @noRd
.map_from_attr_labels <- function(tab, var, df){
  if (is.null(df) || !(var %in% names(df))) return(tab)

  lab_attr <- attr(df[[var]], "labels", exact = TRUE)
  if (is.null(lab_attr) || length(lab_attr) == 0) return(tab)

  codes_vec  <- as.character(names(lab_attr))
  labels_vec <- as.character(unname(lab_attr))

  if (!"Opciones" %in% names(tab)) return(tab)

  is_total <- tab$Opciones %in% c("Total", "")
  body  <- if (any(is_total)) tab[!is_total, , drop = FALSE] else tab
  total <- if (any(is_total)) tab[ is_total, , drop = FALSE] else NULL

  idx <- match(as.character(body$Opciones), codes_vec)
  body$Opciones <- ifelse(!is.na(idx), labels_vec[idx], body$Opciones)

  if (!is.null(total) && nrow(total)) dplyr::bind_rows(body, total) else body
}

#' @noRd
.map_to_labels <- function(tab, var, orders_list){
  if (is.null(orders_list)) return(tab)
  if (!"Opciones" %in% names(tab)) return(tab)

  is_total <- tab$Opciones == "Total"
  body <- if (any(is_total)) tab[!is_total, , drop = FALSE] else tab
  total <- if (any(is_total)) tab[ is_total, , drop = FALSE] else NULL
  if (!nrow(body)) return(tab)

  ord_entry <- .freq_orders_entry(orders_list, var)
  ord_lbl <- ord_entry$labels %||% NULL
  ord_nam <- ord_entry$names %||% NULL

  if (!is.null(ord_nam) && !is.null(ord_lbl)) {
    idx_code <- match(body$Opciones, ord_nam)
    body$Opciones <- ifelse(!is.na(idx_code), ord_lbl[idx_code], body$Opciones)
  }

  if (!is.null(total) && nrow(total)) dplyr::bind_rows(body, total) else body
}

#' Completar categorías faltantes con n = 0 según orders_list
#'
#' Si `mostrar_todo = TRUE`, rellena con categorías definidas en el
#' instrumento (orders_list[[var]]$labels) que no aparecen en la tabla.
#'
#' El argumento `codigos_solo_si_presentes` permite declarar códigos
#' especiales (normalmente en `orders_list[[var]]$names`) que **no** se
#' completan con n = 0 cuando no hay casos. Es decir, si no aparecen en la
#' data, se omiten del completado, aunque estén definidos en el instrumento.
#'
#' @noRd
.completar_categorias <- function(tab, var, orders_list, denom = NULL,
                                  mostrar_todo = FALSE,
                                  codigos_solo_si_presentes = NULL) {

  if (!isTRUE(mostrar_todo)) return(tab)
  if (is.null(orders_list))  return(tab)
  if (!("Opciones" %in% names(tab))) return(tab)
  if (!(var %in% names(orders_list))) return(tab)

  # normalizar códigos condicionales a character
  codigos_cond_chr <- if (is.null(codigos_solo_si_presentes)) {
    character(0)
  } else {
    as.character(codigos_solo_si_presentes)
  }

  is_total <- tab$Opciones == "Total"
  body  <- if (any(is_total)) tab[!is_total, , drop = FALSE] else tab
  total <- if (any(is_total)) tab[ is_total, , drop = FALSE] else NULL

  if (!nrow(body)) return(tab)

  ord_entry <- .freq_orders_entry(orders_list, var)
  ord_lbl   <- ord_entry$labels %||% NULL
  ord_nam   <- ord_entry$names %||% NULL

  if (is.null(ord_lbl)) return(tab)

  full_lbl <- as.character(ord_lbl)
  full_lbl <- full_lbl[!is.na(full_lbl) & nzchar(full_lbl)]

  # labels que no aparecen en la tabla actual
  faltan <- setdiff(full_lbl, body$Opciones)

  if (length(faltan)) {

    # Si hay códigos condicionales y tenemos 'names', filtrar los faltantes
    if (length(codigos_cond_chr) && !is.null(ord_nam)) {
      ord_lbl_chr <- as.character(ord_lbl)
      ord_nam_chr <- as.character(ord_nam)

      idx_faltan    <- match(faltan, ord_lbl_chr)
      codes_faltan  <- ord_nam_chr[idx_faltan]

      # descartar de 'faltan' aquellos cuya *code* esté en codigos_cond_chr
      keep <- !(codes_faltan %in% codigos_cond_chr)
      faltan <- faltan[keep]
    }

    if (length(faltan)) {
      add <- tibble::tibble(
        Opciones = faltan,
        n        = 0,
        pct      = if (!is.null(denom) && denom > 0) 0 else NA_real_
      )
      body <- dplyr::bind_rows(body, add)
    }
  }

  # reordenar según el orden del instrumento
  body <- body |>
    dplyr::mutate(.orden_aux = match(Opciones, full_lbl)) |>
    dplyr::arrange(.orden_aux) |>
    dplyr::select(-.orden_aux)

  if (!is.null(total) && nrow(total)) {
    dplyr::bind_rows(body, total)
  } else {
    body
  }
}

#' @noRd
.reordenar_por_instrumento <- function(tab, var, orders_list){
  if (is.null(orders_list) || !(var %in% names(orders_list))) return(tab)
  if (!all(c("Opciones","n","pct") %in% names(tab))) return(tab)

  is_total <- tab$Opciones == "Total"
  body <- if (any(is_total)) tab[!is_total, , drop = FALSE] else tab
  total <- if (any(is_total)) tab[ is_total, , drop = FALSE] else NULL
  if (!nrow(body)) return(tab)

  ord_entry <- .freq_orders_entry(orders_list, var)
  ord_lbl <- ord_entry$labels %||% NULL
  ord_nam <- ord_entry$names %||% NULL

  if (!is.null(ord_lbl)) {
    body <- dplyr::mutate(body, .orden_aux = match(Opciones, ord_lbl))
  } else {
    body$.orden_aux <- NA_integer_
  }

  if (all(is.na(body$.orden_aux)) && !is.null(ord_nam)) {
    body <- dplyr::mutate(body, .orden_aux = match(Opciones, ord_nam))
  }

  body <- body |>
    dplyr::mutate(
      .orden_aux = ifelse(
        is.na(.orden_aux),
        max(.orden_aux, na.rm = TRUE) + dplyr::row_number(),
        .orden_aux
      )
    ) |>
    dplyr::arrange(.orden_aux) |>
    dplyr::select(-.orden_aux)

  if (!is.null(total) && nrow(total)) dplyr::bind_rows(body, total) else body
}

#' @noRd
.clean_recode_title <- function(label) {
  label <- trimws(as.character(label %||% ""))
  label <- gsub("[[:space:]]+", " ", label)
  label <- gsub(
    "\\s*(\\(|\\[)?\\s*recodificad[ao]s?\\s*(\\)|\\])?\\s*$",
    "",
    label,
    ignore.case = TRUE,
    perl = TRUE
  )
  label <- trimws(label)
  if (!nzchar(label)) label <- "Variable"
  paste0(label, " (Recodificada)")
}

#' @noRd
.lookup_variable_label <- function(var, dic_vars = NULL, labels_override = NULL,
                                   orders_list = NULL, df = NULL) {
  if (!is.null(labels_override) && var %in% names(labels_override)) {
    return(as.character(labels_override[[var]]))
  }

  if (!is.null(df) && var %in% names(df)) {
    vl <- attr(df[[var]], "label", exact = TRUE)
    if (!is.null(vl) && nzchar(as.character(vl))) return(as.character(vl))
  }

  if (!is.null(orders_list) && var %in% names(orders_list)) {
    ordv <- orders_list[[var]]
    if (!is.null(ordv$label) && nzchar(as.character(ordv$label))) {
      return(as.character(ordv$label))
    }
    lab_attr <- tryCatch(attr(ordv$labels, "label"), error = function(e) NULL)
    if (!is.null(lab_attr) && nzchar(as.character(lab_attr))) {
      return(as.character(lab_attr))
    }
  }

  if (!is.null(dic_vars) && all(c("name","label") %in% names(dic_vars))) {
    lab <- dic_vars$label[dic_vars$name == var]
    if (length(lab) && !all(is.na(lab))) return(as.character(lab[1]))
  }

  NULL
}

#' @noRd
titulo_var <- function(var, dic_vars = NULL, labels_override = NULL,
                       orders_list = NULL, df = NULL) {
  if (grepl("_recod$", var)) {
    original <- sub("_recod$", "", var)
    original_label <- .lookup_variable_label(
      original,
      dic_vars = dic_vars,
      labels_override = labels_override,
      orders_list = orders_list,
      df = df
    )
    if (!is.null(original_label) && nzchar(as.character(original_label))) {
      return(.clean_recode_title(original_label))
    }
  }

  lab <- .lookup_variable_label(
    var,
    dic_vars = dic_vars,
    labels_override = labels_override,
    orders_list = orders_list,
    df = df
  )
  if (!is.null(lab) && nzchar(as.character(lab))) {
    if (grepl("_recod$", var)) return(.clean_recode_title(lab))
    return(as.character(lab))
  }

  return(as.character(var))
}

#' @noRd
tipo_pregunta_spss <- function(var, survey, sm_vars_force = NULL) {
  if (!is.null(sm_vars_force) && var %in% sm_vars_force) return("sm")

  if (!is.null(survey) && all(c("type","name") %in% names(survey))) {
    tps <- unique(stats::na.omit(survey$type[survey$name == var]))
    if (length(tps)) {
      if (any(grepl("^select_multiple(\\s|$)", tps))) return("sm")
      if (any(grepl("^select_one(\\s|$)", tps)))      return("so")
    }
  }
  if (!is.null(survey) &&
      any(grepl(paste0("^", stringr::fixed(var), "/"), names(survey)))) {
    return("sm")
  }
  "so_or_open"
}

#' @noRd
.freq_norm_key <- function(x) {
  y <- as.character(x)
  y[is.na(y)] <- ""
  y <- trimws(y)
  out <- iconv(y, from = "", to = "ASCII//TRANSLIT")
  out[is.na(out)] <- y[is.na(out)]
  out <- tolower(out)
  out <- gsub("[^a-z0-9]+", " ", out, perl = TRUE)
  trimws(gsub("\\s+", " ", out, perl = TRUE))
}

#' @noRd
.freq_blank_value <- function(x) {
  y <- as.character(x)
  is.na(y) | !nzchar(trimws(y)) | trimws(y) %in% c("NA", "NaN")
}

#' @noRd
.freq_is_other_option_label <- function(x) {
  y <- .freq_norm_key(x)
  nzchar(y) & (
    grepl("\\b(other|otro|otra|otros|otras)\\b", y, perl = TRUE) |
      grepl("\\b(especificar|especifique|especifica|specify|please specify)\\b", y, perl = TRUE)
  )
}

#' @noRd
.freq_other_text_col_for_var <- function(var, survey = NULL, data = NULL) {
  var <- as.character(var %||% "")[1]
  if (!nzchar(var)) return(NA_character_)

  base_var <- sub("_recod$", "", var)
  candidates <- unique(c(paste0(var, "_other"), paste0(base_var, "_other")))
  if (!is.null(data) && is.data.frame(data)) {
    hit <- candidates[candidates %in% names(data)][1]
    if (!is.na(hit) && nzchar(hit)) return(hit)
  }

  if (!is.null(survey) && is.data.frame(survey) && all(c("name", "type") %in% names(survey))) {
    s_names <- as.character(survey$name)
    s_types <- as.character(survey$type)
    rel <- if ("relevant" %in% names(survey)) as.character(survey$relevant) else rep("", nrow(survey))
    text_rows <- grepl("^text\\b", s_types, ignore.case = TRUE)
    hit <- which(text_rows & s_names %in% candidates)
    if (length(hit)) return(s_names[hit[1]])

    ref_pat <- paste0("\\$\\{", gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", base_var), "\\}")
    hit <- which(text_rows & grepl(ref_pat, rel, perl = TRUE))
    if (length(hit)) return(s_names[hit[1]])
  }

  NA_character_
}

#' @noRd
.freq_select_one_other_spec <- function(var, data = NULL, survey = NULL, orders_list = NULL) {
  codes <- labels <- character(0)

  ord <- tryCatch(orders_list[[var]], error = function(e) NULL)
  if (!is.null(ord)) {
    codes <- as.character(ord$names %||% character(0))
    labels <- as.character(ord$labels %||% character(0))
  }

  if ((!length(codes) || !length(labels)) &&
      !is.null(data) && is.data.frame(data) && var %in% names(data)) {
    lab_attr <- attr(data[[var]], "labels", exact = TRUE)
    if (!is.null(lab_attr) && length(lab_attr)) {
      codes <- as.character(names(lab_attr))
      labels <- as.character(unname(lab_attr))
    }
  }

  n <- max(length(codes), length(labels))
  if (!n) return(NULL)
  length(codes) <- n
  length(labels) <- n
  codes[is.na(codes)] <- ""
  labels[is.na(labels)] <- ""

  other_idx <- which(.freq_is_other_option_label(labels) | .freq_is_other_option_label(codes))
  if (!length(other_idx)) return(NULL)

  other_code <- codes[other_idx[1]]
  if (!nzchar(other_code)) other_code <- labels[other_idx[1]]
  if (!nzchar(other_code)) return(NULL)

  text_col <- .freq_other_text_col_for_var(var, survey = survey, data = data)
  if (is.na(text_col) || !nzchar(text_col) || is.null(data) || !(text_col %in% names(data))) {
    return(NULL)
  }

  valid <- unique(c(codes, labels))
  valid <- valid[!is.na(valid) & nzchar(trimws(valid))]
  list(
    valid = valid,
    other_code = other_code,
    text_col = text_col
  )
}

#' @noRd
.freq_collapse_select_one_other_text <- function(values, data, var, survey = NULL, orders_list = NULL) {
  spec <- .freq_select_one_other_spec(var, data = data, survey = survey, orders_list = orders_list)
  if (is.null(spec)) return(as.character(values))

  x <- as.character(values)
  valid_norm <- .freq_norm_key(spec$valid)
  valid_norm <- valid_norm[nzchar(valid_norm)]
  text_has_value <- !.freq_blank_value(data[[spec$text_col]])
  x_norm <- .freq_norm_key(x)

  collapse <- !.freq_blank_value(x) &
    text_has_value &
    nzchar(x_norm) &
    !(x_norm %in% valid_norm)
  x[collapse] <- spec$other_code
  x
}

#' @noRd
split_sm_tokens <- function(x) {
  x <- as.character(x)

  lapply(x, function(xx) {
    # descartar vacíos / NA
    if (is.na(xx) || !nzchar(xx) || xx == "NA") {
      return(character(0))
    }

    # SIEMPRE explotar en espacios y/o ';'. Usamos POSIX [:space:]
    # porque strsplit() no interpreta \s con el motor regex base de R.
    toks <- unlist(strsplit(xx, "[;[:space:]]+"))
    toks <- toks[nzchar(toks)]
    toks
  })
}

#' Detectar una madre select_multiple cuando el tipo no llegó explícito
#'
#' Algunas bases entran con la variable madre intacta (`"1 2"`, `"3;5"`) pero
#' sin que el `survey` permita reconocerla como `select_multiple` (por ejemplo,
#' variables recodificadas o metadatos incompletos). Para evitar partir textos
#' abiertos, solo inferimos múltiple si existe `orders_list[[var]]$names` y los
#' tokens observados calzan con códigos del instrumento.
#'
#' @noRd
.looks_like_select_multiple_main <- function(data, var, orders_list = NULL) {
  if (is.null(orders_list) || !(var %in% names(orders_list))) return(FALSE)
  if (!is.data.frame(data) || !(var %in% names(data))) return(FALSE)
  if (!(is.character(data[[var]]) || is.factor(data[[var]]))) return(FALSE)

  valid_codes <- tryCatch(as.character(orders_list[[var]][["names"]]), error = function(e) NULL)
  valid_codes <- valid_codes[!is.na(valid_codes) & nzchar(valid_codes)]
  if (is.null(valid_codes) || !length(valid_codes)) return(FALSE)

  vals <- as.character(data[[var]])
  vals <- vals[!is.na(vals) & nzchar(vals) & vals != "NA"]
  if (!length(vals)) return(FALSE)

  token_list <- split_sm_tokens(vals)
  token_lengths <- lengths(token_list)
  if (!any(token_lengths > 1L)) return(FALSE)

  observed_tokens <- unique(unlist(token_list, use.names = FALSE))
  observed_tokens <- observed_tokens[!is.na(observed_tokens) & nzchar(observed_tokens)]
  if (!length(observed_tokens)) return(FALSE)

  mean(observed_tokens %in% valid_codes) >= 0.8
}

#' Verificar si existe la variable o alguna dummy asociada
#'
#' Considera formatos de dummies `var/cod` (KoBo) y `var.cod` (SPSS normalizado).
#'
#' @noRd
.has_var_or_dummies <- function(data, var) {
  if (!is.data.frame(data)) return(FALSE)
  if (var %in% names(data)) return(TRUE)
  var_esc <- gsub("([\\W])", "\\\\\\1", var)
  any(grepl(paste0("^", var_esc, "[/\\.]"), names(data)))
}

# ============================
# Helper para resumen numérico
# ============================

#' @noRd
.resumen_numerico_w <- function(x, w, probs = c(.25, .5, .75), digits = 1) {
  x <- suppressWarnings(as.numeric(x))
  w <- suppressWarnings(as.numeric(w))
  labs <- c(
    "Casos válidos",
    "Promedio",
    "Desviación estándar",
    "Mínimo",
    "Percentil 25",
    "Mediana (Percentil 50)",
    "Percentil 75",
    "Máximo"
  )

  idx <- is.finite(x) & !is.na(x) & is.finite(w) & !is.na(w) & w > 0
  if (!any(idx)) {
    return(tibble::tibble(
      estadistico = labs,
      valor = c(0, rep(NA_real_, 7))
    ))
  }

  x <- x[idx]; w <- w[idx]
  n_val <- length(x)

  mu <- stats::weighted.mean(x, w, na.rm = TRUE)

  wsum <- sum(w)
  var_w <- if (wsum > 0) sum(w * (x - mu)^2) / wsum else NA_real_
  sd_w  <- sqrt(var_w)

  ord <- order(x)
  x2 <- x[ord]; w2 <- w[ord]
  cw <- cumsum(w2) / sum(w2)

  wq <- function(p) {
    j <- which(cw >= p)[1]
    if (is.na(j)) NA_real_ else x2[j]
  }

  q25 <- wq(probs[1]); q50 <- wq(probs[2]); q75 <- wq(probs[3])

  tibble::tibble(
    estadistico = labs,
    valor = c(
      n_val,
      round(mu, digits),
      round(sd_w, digits),
      round(min(x2), digits),
      round(q25, digits),
      round(q50, digits),
      round(q75, digits),
      round(max(x2), digits)
    )
  )
}

#' @noRd
write_one_numeric <- function(wb, sheet, data, var, dic_vars,
                              labels_override = NULL,
                              start_row = 1, start_col = 1,
                              fuente = "Pulso PUCP",
                              orders_list = NULL) {

  st <- mk_styles_spss()
  fila <- start_row

  label_q <- titulo_var(
    var,
    dic_vars,
    labels_override,
    orders_list = orders_list,
    df = data
  )
  label_q <- .freq_clean_other_title_es(label_q)

  # Título (merge 2 cols: Estadístico / Valor)
  openxlsx::writeData(wb, sheet, label_q, startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::mergeCells(wb, sheet, cols = start_col:(start_col + 1), rows = fila:fila)
  openxlsx::addStyle(wb, sheet, st$q_title, rows = fila, cols = start_col, gridExpand = TRUE, stack = TRUE)
  openxlsx::setRowHeights(
    wb, sheet, rows = fila,
    heights = .auto_row_height(label_q, chars_per_line = 70, base = 24, per_line = 16)
  )
  fila <- fila + 1

  # Header
  header_vec <- c("Estadístico", "Valor")
  openxlsx::writeData(wb, sheet, t(header_vec), startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$header, rows = fila, cols = start_col:(start_col + 1), gridExpand = TRUE, stack = TRUE)
  fila <- fila + 1

  # Tabla numérica ponderada (usa tu .peso_vec)
  w <- .peso_vec(data)
  tabn <- .resumen_numerico_w(data[[var]], w)

  openxlsx::writeData(wb, sheet, tabn, startRow = fila, startCol = start_col, colNames = FALSE)

  r_ini <- fila
  r_fin <- fila + nrow(tabn) - 1

  openxlsx::addStyle(wb, sheet, st$body_txt, rows = r_ini:r_fin, cols = start_col, gridExpand = TRUE)
  # Casos válidos -> entero
  openxlsx::addStyle(wb, sheet, st$body_int,
                     rows = r_ini, cols = start_col + 1, gridExpand = TRUE)

  # Resto -> decimal
  openxlsx::addStyle(wb, sheet, st$body_num,
                     rows = (r_ini + 1):r_fin, cols = start_col + 1, gridExpand = TRUE)

  fila <- r_fin + 1

  # Línea final
  openxlsx::addStyle(wb, sheet, st$table_end, rows = r_fin, cols = start_col:(start_col + 1), gridExpand = TRUE, stack = TRUE)

  # Fuente
  openxlsx::writeData(wb, sheet, paste0("Fuente: ", fuente), startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$note, rows = fila, cols = start_col, gridExpand = TRUE)
  openxlsx::mergeCells(wb, sheet, rows = fila, cols = start_col:(start_col + 1))

  # Anchos (compatibles con tu layout general)
  openxlsx::setColWidths(wb, sheet, cols = start_col,     widths = 55)
  openxlsx::setColWidths(wb, sheet, cols = start_col + 1, widths = 18)

  fila + 2
}


# ============================
# freq_table_spss
# ============================

#' Tabla de frecuencias ponderadas para una variable
#'
#' Calcula una tabla de frecuencias (n y porcentaje) para una variable de la
#' base de reporte. Soporta variables de tipo elección múltiple (`select_multiple`)
#' codificadas como:
#' \itemize{
#'   \item Variable madre con códigos separados por `";"` (p. ej. `"1;3;4"`).
#'   \item Dummies derivadas:
#'     \itemize{
#'       \item Formato original tipo KoBo: `var/cod`.
#'       \item Formato normalizado tipo SPSS: `var.cod` (solo dummies, sin madre).
#'     }
#' }
#'
#' La identificación de que una variable es `select_multiple` se basa en:
#' \itemize{
#'   \item El `survey` (tipo `select_multiple` para `name == var`), o
#'   \item El argumento `sm_vars_force`, o
#'   \item La existencia de dummies asociadas (`var/cod` o `var.cod`) aunque
#'         la madre no exista como columna.
#' }
#'
#' La función utiliza, cuando están disponibles:
#' \itemize{
#'   \item Atributos `labels` de la variable en `data` (para mapear códigos a
#'         etiquetas), en el caso de madres “pegadas”.
#'   \item `orders_list` (si se proporciona) para ordenar las categorías según
#'         el instrumento.
#'   \item Una variable de peso llamada `peso` en `data`. Si no existe, se
#'         asume peso 1 para todos los casos.
#' }
#'
#' El argumento `codigos_solo_si_presentes` permite declarar códigos especiales
#' (normalmente definidos en `orders_list[[var]]$names`) que **no** se completan
#' con filas de `n = 0` cuando `mostrar_todo = TRUE` si no hay casos en la
#' variable.
#'
#' @param data Data frame o tibble con la base de datos.
#' @param var Nombre de la variable (como cadena) para la que se desea la tabla.
#'   Puede ser el nombre de la madre (`"p106"`, `"p106_recod"`) aunque en la
#'   base solo existan las dummies (`p106.1`, `p106.2`, etc.).
#' @param survey Tibble con metadatos del instrumento (hoja `survey`), que
#'   debe contener al menos las columnas `name` y `type`. Se utiliza para
#'   diferenciar `select_one` y `select_multiple`. Puede ser `NULL`.
#' @param sm_vars_force Vector opcional de nombres de variables que deben tratarse
#'   como `select_multiple` aunque el instrumento no las marque como tales.
#' @param orders_list Lista opcional con información de orden de categorías
#'   por variable (por ejemplo, `instrumento$orders_list`).
#' @param mostrar_todo Lógico; si `TRUE`, incluye en la tabla todas las
#'   categorías definidas en `orders_list[[var]]$labels`, incluso si su
#'   frecuencia es 0 (salvo las indicadas en `codigos_solo_si_presentes` que
#'   no tengan casos).
#' @param codigos_solo_si_presentes Vector opcional de códigos (ej. `c(96,97,98,99)`)
#'   que solo se completarán con filas adicionales si hay al menos un caso en
#'   la variable. Si no se usan, el comportamiento es el mismo que antes.
#'
#' @return Un tibble con las columnas:
#' \describe{
#'   \item{Opciones}{Código o etiqueta de la categoría.}
#'   \item{n}{Frecuencia ponderada.}
#'   \item{pct}{Porcentaje relativo (0–1).}
#' }
#'
#' @family reporte
#' @export
freq_table_spss <- function(data, var, survey = NULL, sm_vars_force = NULL,
                            orders_list = NULL, mostrar_todo = FALSE,
                            codigos_solo_si_presentes = NULL) {

  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  # -----------------------------
  # Detectar presencia de madre y dummies
  # -----------------------------
  has_main <- var %in% names(data)

  # Dummies tipo "var/cod"
  var_escaped <- gsub("([\\W])", "\\\\\\1", var)
  subvars_slash <- names(data)[grepl(paste0("^", var_escaped, "/"), names(data))]

  # Dummies tipo "var.cod" (sufijo arbitrario sin punto adicional: 1, 2, 70, other, texto, etc.)
  subvars_dot <- names(data)[grepl(paste0("^", var_escaped, "\\.[^.]+$"), names(data))]

  subvars_all <- c(subvars_slash, subvars_dot)
  has_dummies <- length(subvars_all) > 0L

  if (!has_main && !has_dummies) {
    stop("`", var, "` no se encuentra en `data` ni se detectaron dummies asociadas.",
         call. = FALSE)
  }

  # Tipo base según survey / sm_vars_force
  tipo <- tipo_pregunta_spss(var, survey, sm_vars_force)

  # Si no se detectó como SM pero existen dummies, forzar a SM
  if (tipo != "sm" && has_dummies) {
    tipo <- "sm"
  }

  w <- .peso_vec(data)

  # ============================
  # Caso select_multiple
  # ============================
  if (tipo == "sm") {

    # -------------------------
    # Caso 1: madre "pegada" (ej. "1;3;4") presente en data
    # -------------------------
    if (has_main &&
        (is.character(data[[var]]) || is.factor(data[[var]]))) {

      vec <- as.character(data[[var]])
      df_long <- tibble::tibble(id = seq_len(nrow(data)), valor = vec) |>
        dplyr::filter(!is.na(valor) & nzchar(valor) & valor != "NA") |>
        dplyr::mutate(tokens = split_sm_tokens(valor)) |>
        dplyr::select(-valor) |>
        tidyr::unnest_longer(tokens, values_to = "op") |>
        dplyr::mutate(op = trimws(op)) |>
        dplyr::filter(nzchar(op)) |>
        dplyr::distinct(id, op)

      if (!nrow(df_long)) {
        return(tibble::tibble(Opciones = character(), n = numeric(), pct = numeric()))
      }

      ids_con_marca <- sort(unique(df_long$id))
      denom <- sum(w[ids_con_marca], na.rm = TRUE)

      tab <- df_long |>
        dplyr::left_join(
          tibble::tibble(id = seq_len(nrow(data)), peso = w),
          by = "id"
        ) |>
        dplyr::group_by(op) |>
        dplyr::summarise(n = sum(peso, na.rm = TRUE), .groups = "drop") |>
        dplyr::arrange(dplyr::desc(n)) |>
        dplyr::transmute(
          Opciones = op,
          n        = as.numeric(n),
          pct      = if (denom > 0) n/denom else NA_real_
        )

      tab <- .map_from_attr_labels(tab, var, data)
      tab <- .map_to_labels(tab, var, orders_list)
      tab <- .completar_categorias(
        tab, var, orders_list, denom,
        mostrar_todo = mostrar_todo,
        codigos_solo_si_presentes = codigos_solo_si_presentes
      )
      tab <- .reordenar_por_instrumento(tab, var, orders_list)
      tab <- .move_ns_pref_last(tab)

      total_row <- tibble::tibble(
        Opciones = "Total",
        n        = as.numeric(denom),
        pct      = 1
      )
      return(dplyr::bind_rows(tab, total_row))
    }

    # -------------------------
    # Caso 2: solo dummies (`var/cod` o `var.cod`)
    # -------------------------
    if (!length(subvars_all)) {
      return(tibble::tibble(Opciones = character(), n = numeric(), pct = numeric()))
    }

    mat <- as.data.frame(data[, subvars_all, drop = FALSE])
    mat[] <- lapply(mat, function(v) suppressWarnings(as.numeric(as.character(v))))

    # Denominador: casos con al menos una marca (1)
    has_any <- rowSums(mat == 1, na.rm = TRUE) > 0
    denom <- sum(w[has_any], na.rm = TRUE)

    # Conteo ponderado de cada dummy
    n_w <- vapply(subvars_all, function(sv){
      v <- suppressWarnings(as.numeric(as.character(mat[[sv]])))
      sum(w[v == 1 & !is.na(v)], na.rm = TRUE)
    }, numeric(1))

    tab <- tibble::tibble(subvar = subvars_all, n = as.numeric(n_w)) |>
      dplyr::mutate(
        # eliminar el prefijo "var/" o "var." y quedarse solo con el código
        Opciones = sub(
          paste0("^", var_escaped, "[/\\.]"),
          "",
          subvar
        )
      ) |>
      dplyr::arrange(dplyr::desc(n)) |>
      dplyr::transmute(
        Opciones,
        n,
        pct = if (denom > 0) n/denom else NA_real_
      )

    tab <- .map_to_labels(tab, var, orders_list)
    tab <- .completar_categorias(
      tab, var, orders_list, denom,
      mostrar_todo = mostrar_todo,
      codigos_solo_si_presentes = codigos_solo_si_presentes
    )
    tab <- .reordenar_por_instrumento(tab, var, orders_list)
    tab <- .move_ns_pref_last(tab)

    total_row <- tibble::tibble(
      Opciones = "Total",
      n        = as.numeric(denom),
      pct      = 1
    )
    return(dplyr::bind_rows(tab, total_row))
  }

  # ============================
  # Caso select_one / abierta
  # ============================
  if (!has_main) {
    stop("`", var, "` no existe como columna en `data` y no se detectó como ",
         "pregunta de respuesta múltiple con dummies.", call. = FALSE)
  }

  col <- var
  tib <- data |>
    dplyr::transmute(.op = as.character(.data[[col]]), peso = w) |>
    dplyr::filter(!is.na(.op) & nzchar(.op) & .op != "NA")

  if (!nrow(tib)) {
    return(tibble::tibble(Opciones = character(), n = numeric(), pct = numeric()))
  }

  denom <- sum(tib$peso, na.rm = TRUE)

  tab <- tib |>
    dplyr::group_by(.op) |>
    dplyr::summarise(n = sum(peso, na.rm = TRUE), .groups = "drop") |>
    dplyr::arrange(dplyr::desc(n)) |>
    dplyr::mutate(pct = if (denom > 0) n/denom else NA_real_) |>
    dplyr::rename(Opciones = .op)

  tab <- .map_from_attr_labels(tab, var, data)
  tab <- .map_to_labels(tab, var, orders_list)
  tab <- .completar_categorias(
    tab, var, orders_list, denom,
    mostrar_todo = mostrar_todo,
    codigos_solo_si_presentes = codigos_solo_si_presentes
  )
  tab <- .reordenar_por_instrumento(tab, var, orders_list)
  tab <- .move_ns_pref_last(tab)

  total_row <- tibble::tibble(
    Opciones = "Total",
    n        = sum(tab$n, na.rm = TRUE),
    pct      = 1
  )
  dplyr::bind_rows(tab, total_row)
}


# ============================
# Estilos y escritura en Excel
# ============================

#' @noRd
mk_styles_spss <- function() {
  list(
    sec_title = openxlsx::createStyle(
      fontSize = 18,
      halign = "center",
      valign = "center",
      wrapText = TRUE,
      fgFill = "#FFFFFF",
      fontColour = "#000000",
      fontName = "Arial"
    ),
    q_title = openxlsx::createStyle(
      fontSize = 11,
      textDecoration = "italic",
      halign = "left",
      valign = "center",
      wrapText = TRUE,
      fgFill = "#FFFFFF",
      fontColour = "#000000",
      fontName = "Arial"
    ),
    header = openxlsx::createStyle(
      fontSize = 10,
      border = c("top", "bottom"),
      borderStyle = "thin",
      borderColour = "#000000",
      halign = "center",
      valign = "center",
      fgFill = "#FFFFFF",
      fontName = "Arial"
    ),
    body_txt = openxlsx::createStyle(
      fontSize = 10,
      halign = "left",
      valign = "center",
      fgFill = "#FFFFFF",
      fontName = "Arial",
      wrapText = TRUE
    ),

    # Conteos (n) -> entero
    body_int = openxlsx::createStyle(
      fontSize = 10,
      numFmt   = "#,##0",
      halign   = "right",
      valign   = "center",
      fgFill   = "#FFFFFF",
      fontName = "Arial",
      wrapText = FALSE
    ),

    # >>> CLAVE: numérico mostrado como TEXTO con punto fijo (12.0, 3.4)
    body_num_txt = openxlsx::createStyle(
      fontSize = 10,
      numFmt   = "@",     # texto
      halign   = "right",
      valign   = "center",
      fgFill   = "#FFFFFF",
      fontName = "Arial"
    ),

    body_pct = openxlsx::createStyle(
      fontSize = 10,
      numFmt   = "0.0%",
      halign   = "right",
      valign   = "center",
      fgFill   = "#FFFFFF",
      fontName = "Arial"
    ),

    # Total en frecuencias (n) -> entero
    total_row = openxlsx::createStyle(
      fontSize = 10,
      textDecoration = NULL,
      numFmt = "#,##0",
      halign = "right",
      valign = "center",
      fgFill = "#FFFFFF",
      fontName = "Arial"
    ),
    total_label = openxlsx::createStyle(
      fontSize = 10,
      halign = "left",
      valign = "center",
      fgFill = "#FFFFFF",
      fontName = "Arial"
    ),
    table_end = openxlsx::createStyle(
      border = "bottom",
      borderStyle = "thin",
      borderColour = "#000000"
    )
  )
}

#' @noRd
.freq_clean_other_label_es <- function(x) {
  y <- as.character(x)
  y[is.na(y)] <- ""
  y <- trimws(y)
  if (!length(y)) return(y)

  norm <- iconv(y, from = "", to = "ASCII//TRANSLIT")
  norm[is.na(norm)] <- y[is.na(norm)]
  norm <- tolower(trimws(gsub("\\s+", " ", norm, perl = TRUE)))
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
.freq_clean_other_title_es <- function(x) {
  y <- as.character(x)
  y[is.na(y)] <- ""
  y <- trimws(y)
  if (!length(y)) return(y)

  y <- gsub(
    "\\bOther\\s*\\([^)]*(especific|specif|please)[^)]*\\)\\s*:?",
    "Otros",
    y,
    ignore.case = TRUE,
    perl = TRUE
  )
  y <- gsub(
    "\\bOther\\s*,?\\s*(please\\s+)?(specify|specificar|especificar|especifique|especifica)\\s*:?",
    "Otros",
    y,
    ignore.case = TRUE,
    perl = TRUE
  )
  y <- gsub(
    "\\bOtro(s|a|as)?\\s*\\([^)]*(especific|specif|please)[^)]*\\)\\s*:?",
    "Otros",
    y,
    ignore.case = TRUE,
    perl = TRUE
  )
  y <- gsub(
    "\\bOtro(s|a|as)?\\s*,?\\s*(por favor\\s+)?(especificar|especifique|especifica)\\s*:?",
    "Otros",
    y,
    ignore.case = TRUE,
    perl = TRUE
  )

  trimws(gsub("\\s+", " ", y, perl = TRUE))
}

#' @noRd
.freq_clean_section_label_for_export <- function(x) {
  y <- .freq_clean_other_title_es(x)
  y <- gsub("_OTHER\\b", "_OTROS", y, ignore.case = TRUE, perl = TRUE)
  y <- gsub("\\bOTHER\\b", "OTROS", y, ignore.case = TRUE, perl = TRUE)
  trimws(gsub("\\s+", " ", y, perl = TRUE))
}

#' @noRd
.freq_clean_option_labels_for_export <- function(tab) {
  if (is.null(tab) || !is.data.frame(tab) || !nrow(tab) || !"Opciones" %in% names(tab)) {
    return(tab)
  }

  is_total <- as.character(tab$Opciones) == "Total"
  total <- tab[is_total, , drop = FALSE]
  body <- tab[!is_total, , drop = FALSE]
  if (!nrow(body)) return(tab)

  body$Opciones <- .freq_clean_other_label_es(body$Opciones)
  if (anyDuplicated(body$Opciones) && "n" %in% names(body)) {
    has_pct <- "pct" %in% names(body)
    body <- body |>
      dplyr::group_by(.data$Opciones) |>
      dplyr::summarise(
        n = sum(.data$n, na.rm = TRUE),
        pct = if (has_pct) sum(.data$pct, na.rm = TRUE) else NA_real_,
        .groups = "drop"
      )
    if (!has_pct) body$pct <- NULL
  }

  dplyr::bind_rows(body, total)
}



# =============================================================================
# Nuevo: FRECUENCIAS (CATEGÓRICAS) + RESUMEN NUMÉRICO (DECLARADO)
# - NO rompe lo existente: freq_table_spss() queda igual.
# - Se agrega write_one_numeric() y soporte `numericas=` en export/reporte.
# =============================================================================


# =============================================================================
# freq_table_spss
# =============================================================================

#' Tabla de frecuencias ponderadas para una variable
#'
#' Calcula una tabla de frecuencias (n y porcentaje) para una variable de la
#' base de reporte. Soporta variables de tipo elección múltiple (`select_multiple`)
#' codificadas como:
#' \itemize{
#'   \item Variable madre con códigos separados por `";"` (p. ej. `"1;3;4"`).
#'   \item Dummies derivadas:
#'     \itemize{
#'       \item Formato original tipo KoBo: `var/cod`.
#'       \item Formato normalizado tipo SPSS: `var.cod` (solo dummies, sin madre).
#'     }
#' }
#'
#' La identificación de que una variable es `select_multiple` se basa en:
#' \itemize{
#'   \item El `survey` (tipo `select_multiple` para `name == var`), o
#'   \item El argumento `sm_vars_force`, o
#'   \item La existencia de dummies asociadas (`var/cod` o `var.cod`) aunque
#'         la madre no exista como columna.
#' }
#'
#' La función utiliza, cuando están disponibles:
#' \itemize{
#'   \item Atributos `labels` de la variable en `data` (para mapear códigos a
#'         etiquetas), en el caso de madres “pegadas”.
#'   \item `orders_list` (si se proporciona) para ordenar las categorías según
#'         el instrumento.
#'   \item Una variable de peso llamada `peso` en `data`. Si no existe, se
#'         asume peso 1 para todos los casos.
#' }
#'
#' El argumento `codigos_solo_si_presentes` permite declarar códigos especiales
#' (normalmente definidos en `orders_list[[var]]$names`) que **no** se completan
#' con filas de `n = 0` cuando `mostrar_todo = TRUE` si no hay casos en la
#' variable.
#'
#' @export
freq_table_spss <- function(data, var, survey = NULL, sm_vars_force = NULL,
                            orders_list = NULL, mostrar_todo = FALSE,
                            codigos_solo_si_presentes = NULL) {

  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  # Detectar presencia de madre y dummies
  has_main <- var %in% names(data)

  var_escaped   <- gsub("([\\W])", "\\\\\\1", var)
  subvars_slash <- names(data)[grepl(paste0("^", var_escaped, "/"), names(data))]
  subvars_dot   <- names(data)[grepl(paste0("^", var_escaped, "\\.[^.]+$"), names(data))]

  subvars_all <- c(subvars_slash, subvars_dot)
  has_dummies <- length(subvars_all) > 0L

  if (!has_main && !has_dummies) {
    stop("`", var, "` no se encuentra en `data` ni se detectaron dummies asociadas.",
         call. = FALSE)
  }

  tipo <- tipo_pregunta_spss(var, survey, sm_vars_force)
  if (tipo != "sm" && has_dummies) tipo <- "sm"
  if (tipo != "sm" && .looks_like_select_multiple_main(data, var, orders_list)) {
    tipo <- "sm"
  }

  w <- .peso_vec(data)

  # ----------------------------
  # select_multiple
  # ----------------------------
  if (tipo == "sm") {

    # Caso 1: madre pegada
    if (has_main && (is.character(data[[var]]) || is.factor(data[[var]]))) {

      vec <- as.character(data[[var]])
      df_long <- tibble::tibble(id = seq_len(nrow(data)), valor = vec) |>
        dplyr::filter(!is.na(valor) & nzchar(valor) & valor != "NA") |>
        dplyr::mutate(tokens = split_sm_tokens(valor)) |>
        dplyr::select(-valor) |>
        tidyr::unnest_longer(tokens, values_to = "op") |>
        dplyr::mutate(op = trimws(op)) |>
        dplyr::filter(nzchar(op)) |>
        dplyr::distinct(id, op)

      if (!nrow(df_long)) {
        return(tibble::tibble(Opciones = character(), n = numeric(), pct = numeric()))
      }

      ids_con_marca <- sort(unique(df_long$id))
      denom <- sum(w[ids_con_marca], na.rm = TRUE)

      tab <- df_long |>
        dplyr::left_join(
          tibble::tibble(id = seq_len(nrow(data)), peso = w),
          by = "id"
        ) |>
        dplyr::group_by(op) |>
        dplyr::summarise(n = sum(peso, na.rm = TRUE), .groups = "drop") |>
        dplyr::arrange(dplyr::desc(n)) |>
        dplyr::transmute(
          Opciones = op,
          n        = as.numeric(n),
          pct      = if (denom > 0) n / denom else NA_real_
        )

      tab <- .map_from_attr_labels(tab, var, data)
      tab <- .map_to_labels(tab, var, orders_list)
      tab <- .completar_categorias(
        tab, var, orders_list, denom,
        mostrar_todo = mostrar_todo,
        codigos_solo_si_presentes = codigos_solo_si_presentes
      )
      tab <- .reordenar_por_instrumento(tab, var, orders_list)
      tab <- .move_ns_pref_last(tab)

      total_row <- tibble::tibble(Opciones = "Total", n = as.numeric(denom), pct = 1)
      return(dplyr::bind_rows(tab, total_row))
    }

    # Caso 2: solo dummies
    if (!length(subvars_all)) {
      return(tibble::tibble(Opciones = character(), n = numeric(), pct = numeric()))
    }

    mat <- as.data.frame(data[, subvars_all, drop = FALSE])
    mat[] <- lapply(mat, function(v) suppressWarnings(as.numeric(as.character(v))))

    has_any <- rowSums(mat == 1, na.rm = TRUE) > 0
    denom   <- sum(w[has_any], na.rm = TRUE)

    n_w <- vapply(subvars_all, function(sv) {
      v <- suppressWarnings(as.numeric(as.character(mat[[sv]])))
      sum(w[v == 1 & !is.na(v)], na.rm = TRUE)
    }, numeric(1))

    tab <- tibble::tibble(subvar = subvars_all, n = as.numeric(n_w)) |>
      dplyr::mutate(
        Opciones = sub(paste0("^", var_escaped, "[/\\.]"), "", subvar)
      ) |>
      dplyr::arrange(dplyr::desc(n)) |>
      dplyr::transmute(
        Opciones,
        n,
        pct = if (denom > 0) n / denom else NA_real_
      )

    tab <- .map_to_labels(tab, var, orders_list)
    tab <- .completar_categorias(
      tab, var, orders_list, denom,
      mostrar_todo = mostrar_todo,
      codigos_solo_si_presentes = codigos_solo_si_presentes
    )
    tab <- .reordenar_por_instrumento(tab, var, orders_list)
    tab <- .move_ns_pref_last(tab)

    total_row <- tibble::tibble(Opciones = "Total", n = as.numeric(denom), pct = 1)
    return(dplyr::bind_rows(tab, total_row))
  }

  # ----------------------------
  # select_one / abierta
  # ----------------------------
  if (!has_main) {
    stop("`", var, "` no existe como columna en `data` y no se detectó como ",
         "pregunta de respuesta múltiple con dummies.", call. = FALSE)
  }

  tib <- data |>
    dplyr::transmute(
      .op = .freq_collapse_select_one_other_text(
        .data[[var]],
        data = data,
        var = var,
        survey = survey,
        orders_list = orders_list
      ),
      peso = w
    ) |>
    dplyr::filter(!is.na(.op) & nzchar(.op) & .op != "NA")

  if (!nrow(tib)) {
    return(tibble::tibble(Opciones = character(), n = numeric(), pct = numeric()))
  }

  denom <- sum(tib$peso, na.rm = TRUE)

  tab <- tib |>
    dplyr::group_by(.op) |>
    dplyr::summarise(n = sum(peso, na.rm = TRUE), .groups = "drop") |>
    dplyr::arrange(dplyr::desc(n)) |>
    dplyr::mutate(pct = if (denom > 0) n / denom else NA_real_) |>
    dplyr::rename(Opciones = .op)

  tab <- .map_from_attr_labels(tab, var, data)
  tab <- .map_to_labels(tab, var, orders_list)
  tab <- .completar_categorias(
    tab, var, orders_list, denom,
    mostrar_todo = mostrar_todo,
    codigos_solo_si_presentes = codigos_solo_si_presentes
  )
  tab <- .reordenar_por_instrumento(tab, var, orders_list)
  tab <- .move_ns_pref_last(tab)

  total_row <- tibble::tibble(Opciones = "Total", n = sum(tab$n, na.rm = TRUE), pct = 1)
  dplyr::bind_rows(tab, total_row)
}


# =============================================================================
# Estilos y escritura en Excel
# =============================================================================

#' @noRd
mk_styles_spss <- function() {
  # Tema monocromo editorial unico (ver api/R/xlsx_theme.R).
  pulso_xlsx_styles("freq")
}

#' @noRd
.prepare_frecuencias_sheet <- function(wb, sheet, rows = 5000L, cols = 30L) {
  # El fondo blanco en TODO el documento se logra apagando las gridlines de la
  # hoja (no pintando un canvas acotado, que dejaba celdas sin cubrir a la
  # derecha de la col 30 / debajo de la fila 5000). rows/cols se conservan en la
  # firma por compatibilidad con los llamadores, pero ya no se usan.
  pulso_xlsx_hide_gridlines(wb, sheet)
  invisible(wb)
}

#' @noRd
write_one_freq <- function(wb, sheet, data, var, dic_vars,
                           survey = NULL, sm_vars_force = NULL,
                           labels_override = NULL,
                           start_row = 1, start_col = 1,
                           fuente = "Pulso PUCP",
                           orders_list = NULL,
                           mostrar_todo = FALSE,
                           codigos_solo_si_presentes = NULL,
                           incluir_titulo = TRUE,
                           incluir_porcentajes = TRUE,
                           orden = "original") {

  st <- mk_styles_spss()
  fila <- start_row

  label_q <- titulo_var(
    var,
    dic_vars,
    labels_override,
    orders_list = orders_list,
    df = data
  )
  label_q <- .freq_clean_other_title_es(label_q)

  if (isTRUE(incluir_titulo)) {
    openxlsx::writeData(wb, sheet, label_q, startRow = fila, startCol = start_col, colNames = FALSE)
    ncols_title <- if (isTRUE(incluir_porcentajes)) 3L else 2L
    openxlsx::mergeCells(wb, sheet, cols = start_col:(start_col + ncols_title - 1L), rows = fila:fila)
    openxlsx::addStyle(wb, sheet, st$q_title, rows = fila, cols = start_col, gridExpand = TRUE, stack = TRUE)
    openxlsx::setRowHeights(
      wb, sheet, rows = fila,
      heights = .auto_row_height(label_q, chars_per_line = 70, base = 24, per_line = 16)
    )
    fila <- fila + 1
  }

  hdr_row <- fila  # primera fila del cuadro de la tabla (encabezado N/%)
  header_vec <- if (isTRUE(incluir_porcentajes)) c("N", "%") else "N"
  openxlsx::writeData(wb, sheet, t(header_vec), startRow = fila, startCol = start_col + 1L, colNames = FALSE)
  if (isTRUE(incluir_titulo)) {
    openxlsx::addStyle(
      wb, sheet, st$header,
      rows = fila,
      cols = (start_col + 1L):(start_col + length(header_vec)),
      gridExpand = TRUE,
      stack = TRUE
    )
    openxlsx::addStyle(wb, sheet, st$table_end, rows = fila, cols = start_col, gridExpand = TRUE, stack = TRUE)
  } else {
    openxlsx::addStyle(
      wb, sheet, st$header,
      rows = fila,
      cols = start_col:(start_col + length(header_vec)),
      gridExpand = TRUE,
      stack = TRUE
    )
  }
  fila <- fila + 1

  tab <- freq_table_spss(
    data,
    var,
    survey        = survey,
    sm_vars_force = sm_vars_force,
    orders_list   = orders_list,
    mostrar_todo  = mostrar_todo,
    codigos_solo_si_presentes = codigos_solo_si_presentes
  )
  tab <- .freq_clean_option_labels_for_export(tab)

  if (nrow(tab)) {
    is_total0 <- tab$Opciones == "Total"
    body0 <- tab[!is_total0, , drop = FALSE]
    total0 <- tab[is_total0, , drop = FALSE]
    orden <- as.character(orden %||% "original")
    if (orden %in% c("asc", "desc") && nrow(body0) && "n" %in% names(body0)) {
      body0 <- dplyr::arrange(body0, if (orden == "asc") n else dplyr::desc(n))
    }
    tab <- dplyr::bind_rows(body0, total0)
  }
  if (!isTRUE(incluir_porcentajes) && "pct" %in% names(tab)) {
    tab$pct <- NULL
  }

  if (!nrow(tab)) {
    openxlsx::writeData(wb, sheet, "Sin datos", startRow = fila, startCol = start_col)
    return(fila + 2)
  }

  is_total   <- tab$Opciones == "Total"
  body_rows  <- if (any(is_total)) tab[!is_total, , drop = FALSE] else tab
  total_row  <- if (any(is_total)) tab[ is_total, , drop = FALSE] else NULL

  if (nrow(body_rows)) {
    openxlsx::writeData(wb, sheet, body_rows, startRow = fila, startCol = start_col, colNames = FALSE)
    r_ini <- fila
    r_fin <- fila + nrow(body_rows) - 1

    # Zebra sutil: sombrea filas alternas (2, 4, ...) para seguir la fila a lo ancho.
    for (k in seq_len(nrow(body_rows))) {
      rr <- r_ini + k - 1L
      z  <- (k %% 2L == 0L)
      openxlsx::addStyle(wb, sheet, if (z) st$zebra_txt else st$body_txt,
                         rows = rr, cols = start_col)
      openxlsx::addStyle(wb, sheet, if (z) st$zebra_int else st$freq_body_int,
                         rows = rr, cols = start_col + 1)
      if (isTRUE(incluir_porcentajes)) {
        openxlsx::addStyle(wb, sheet, if (z) st$zebra_pct else st$freq_body_pct,
                           rows = rr, cols = start_col + 2)
      }
    }

    fila <- r_fin + 1
  }

  end_col <- start_col + if (isTRUE(incluir_porcentajes)) 2L else 1L
  if (!is.null(total_row) && nrow(total_row)) {
    openxlsx::writeData(wb, sheet, total_row, startRow = fila, startCol = start_col, colNames = FALSE)

    openxlsx::addStyle(wb, sheet, st$total_label, rows = fila, cols = start_col, gridExpand = TRUE)
    openxlsx::addStyle(wb, sheet, st$freq_total_num, rows = fila, cols = start_col + 1, gridExpand = TRUE)
    if (isTRUE(incluir_porcentajes)) {
      openxlsx::addStyle(wb, sheet, st$freq_total_pct, rows = fila, cols = start_col + 2, gridExpand = TRUE)
    }
    last_row <- fila
    fila <- fila + 1
  } else {
    last_row <- max(start_row + 1, fila - 1)
  }

  # cuadro completo de la tabla (marco exterior)
  pulso_xlsx_box(wb, sheet, r1 = hdr_row, r2 = last_row, c1 = start_col, c2 = end_col)

  openxlsx::writeData(wb, sheet, paste0("Fuente: ", fuente), startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$note, rows = fila, cols = start_col, gridExpand = TRUE)

  openxlsx::setColWidths(wb, sheet, cols = start_col,     widths = 55)
  openxlsx::setColWidths(wb, sheet, cols = start_col + 1, widths = 14)
  if (isTRUE(incluir_porcentajes)) openxlsx::setColWidths(wb, sheet, cols = start_col + 2, widths = 14)

  fila + 2
}

#' @noRd
write_one_numeric <- function(wb, sheet, data, var, dic_vars,
                              labels_override = NULL,
                              start_row = 1, start_col = 1,
                              fuente = "Pulso PUCP",
                              orders_list = NULL,
                              incluir_titulo = TRUE) {

  st <- mk_styles_spss()
  fila <- start_row

  label_q <- titulo_var(
    var,
    dic_vars,
    labels_override,
    orders_list = orders_list,
    df = data
  )
  label_q <- .freq_clean_other_title_es(label_q)

  if (isTRUE(incluir_titulo)) {
    openxlsx::writeData(wb, sheet, label_q, startRow = fila, startCol = start_col, colNames = FALSE)
    openxlsx::mergeCells(wb, sheet, cols = start_col:(start_col + 1), rows = fila:fila)
    openxlsx::addStyle(wb, sheet, st$q_title, rows = fila, cols = start_col, gridExpand = TRUE, stack = TRUE)
    openxlsx::setRowHeights(
      wb, sheet, rows = fila,
      heights = .auto_row_height(label_q, chars_per_line = 70, base = 24, per_line = 16)
    )
    fila <- fila + 1
  }

  header_vec <- c("Estadístico", "Valor")
  openxlsx::writeData(wb, sheet, t(header_vec), startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$header, rows = fila, cols = start_col:(start_col + 1), gridExpand = TRUE, stack = TRUE)
  fila <- fila + 1

  w    <- .peso_vec(data)
  tabn <- .resumen_numerico_w(data[[var]], w)

  if (!nrow(tabn)) {
    openxlsx::writeData(wb, sheet, "Sin datos", startRow = fila, startCol = start_col)
    return(fila + 2)
  }

  openxlsx::writeData(wb, sheet, tabn, startRow = fila, startCol = start_col, colNames = FALSE)

  r_ini <- fila
  r_fin <- fila + nrow(tabn) - 1

  # Columna texto (Estadístico) -> siempre texto
  openxlsx::addStyle(
    wb, sheet, st$body_txt,
    rows = r_ini:r_fin,
    cols = start_col,
    gridExpand = TRUE
  )

  # Columna valor:
  # - "Casos válidos" (primera fila del bloque) -> entero
  openxlsx::addStyle(
    wb, sheet, st$body_int,
    rows = r_ini,
    cols = start_col + 1,
    gridExpand = TRUE
  )

  # - resto de estadísticos -> numérico con decimales
  if (r_fin >= (r_ini + 1)) {
    openxlsx::addStyle(
      wb, sheet, st$body_num,
      rows = (r_ini + 1):r_fin,
      cols = start_col + 1,
      gridExpand = TRUE
    )
  }

  openxlsx::addStyle(wb, sheet, st$table_end, rows = r_fin, cols = start_col:(start_col + 1), gridExpand = TRUE, stack = TRUE)

  fila <- r_fin + 1

  openxlsx::writeData(wb, sheet, paste0("Fuente: ", fuente), startRow = fila, startCol = start_col, colNames = FALSE)
  openxlsx::addStyle(wb, sheet, st$note, rows = fila, cols = start_col, gridExpand = TRUE)
  openxlsx::mergeCells(wb, sheet, rows = fila, cols = start_col:(start_col + 1))

  openxlsx::setColWidths(wb, sheet, cols = start_col,     widths = 55)
  openxlsx::setColWidths(wb, sheet, cols = start_col + 1, widths = 18)

  fila + 2
}


# =============================================================================
# exportar_frecuencias_spss
# =============================================================================

#' Exportar tablas de frecuencias a Excel por secciones
#'
#' @param numericas Vector de variables numéricas (declaradas) para generar tabla
#'   de resumen (media, sd, cuantiles, etc.) en lugar de n/%.
#'
#' @family reporte
#' @export
exportar_frecuencias_spss <- function(
    data,
    dic_vars,
    SECCIONES,
    labels_override = NULL,
    path_xlsx = "frecuencias_spss.xlsx",
    orden = c("desc","asc","original"),
    sm_vars_force = NULL,
    fuente = "Pulso PUCP",
    orders_list = NULL,
    survey = NULL,
    mostrar_todo = FALSE,
    codigos_solo_si_presentes = NULL,
    numericas = NULL,
    incluir_titulos = TRUE,
    incluir_secciones = TRUE,
    incluir_porcentajes = TRUE,
    ficha_tecnica = NULL
){
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para `exportar_frecuencias_spss()`. ",
         "Instálalo con install.packages('openxlsx').", call. = FALSE)
  }

  orden <- match.arg(orden)
  numericas <- if (is.null(numericas)) character(0) else as.character(numericas)

  wb <- openxlsx::createWorkbook()
  sheet <- "Frecuencias"
  openxlsx::addWorksheet(wb, sheet)
  .prepare_frecuencias_sheet(wb, sheet)
  st <- mk_styles_spss()

  fila <- 1L

  for (sec in names(SECCIONES)) {
    vars_sec <- SECCIONES[[sec]]

    vars_sec <- vars_sec[vapply(vars_sec, function(v) .has_var_or_dummies(data, v), logical(1))]
    if (!length(vars_sec)) next

    if (isTRUE(incluir_secciones)) {
      sec_label <- toupper(.freq_clean_section_label_for_export(sec))
      openxlsx::writeData(wb, sheet, sec_label, startRow = fila, startCol = 1)

      # Merge depende de si habrá tablas numéricas en la sección
      ncols_sec <- if (any(vars_sec %in% numericas)) 2 else 3
      openxlsx::mergeCells(wb, sheet, cols = 1:ncols_sec, rows = fila:fila)

      openxlsx::addStyle(wb, sheet, st$sec_title, rows = fila, cols = 1, gridExpand = TRUE, stack = TRUE)
      openxlsx::setRowHeights(
        wb, sheet, rows = fila,
        heights = .auto_row_height(sec_label, chars_per_line = 70, base = 28, per_line = 18)
      )
      fila <- fila + 2
    }

    for (v in vars_sec) {

      # --- Tabla numérica (solo si se declara) ---
      if (v %in% numericas) {
        fila <- write_one_numeric(
          wb, sheet,
          data  = data,
          var   = v,
          dic_vars = dic_vars,
          labels_override = labels_override,
          start_row = fila,
          start_col = 1,
          fuente = fuente,
          orders_list = orders_list,
          incluir_titulo = incluir_titulos
        )
        next
      }

      # --- Tabla categórica (flujo actual) ---
      tab <- freq_table_spss(
        data,
        v,
        survey        = survey,
        sm_vars_force = sm_vars_force,
        orders_list   = orders_list,
        mostrar_todo  = mostrar_todo,
        codigos_solo_si_presentes = codigos_solo_si_presentes
      )

      if (nrow(tab)) {
        is_total <- tab$Opciones == "Total"
        body  <- tab[!is_total, , drop = FALSE]
        total <- tab[ is_total, , drop = FALSE]

        if (orden %in% c("asc","desc") && nrow(body)) {
          body <- dplyr::arrange(body, if (orden == "asc") n else dplyr::desc(n))
        }
        tab <- dplyr::bind_rows(body, total)
      }

      fila <- write_one_freq(
        wb, sheet,
        data  = data,
        var   = v,
        dic_vars = dic_vars,
        survey   = survey,
        sm_vars_force   = sm_vars_force,
        labels_override = labels_override,
        start_row = fila,
        start_col = 1,
        fuente = fuente,
        orders_list  = orders_list,
        mostrar_todo = mostrar_todo,
        codigos_solo_si_presentes = codigos_solo_si_presentes,
        incluir_titulo = incluir_titulos,
        incluir_porcentajes = incluir_porcentajes,
        orden = orden
      )
    }

    fila <- fila + 1
  }

  if (!identical(ficha_tecnica, FALSE) && exists(".analitica_add_ficha_tecnica_from_spec", mode = "function")) {
    instrumento_ficha <- list(survey = survey, orders_list = orders_list)
    .analitica_add_ficha_tecnica_from_spec(
      list(
        wb = wb,
        data = data,
        instrumento = instrumento_ficha,
        reporte = "Frecuencias",
        fuente = fuente,
        hojas = names(wb),
        detalles = list(
          "Orden de categorias" = orden,
          "Variables numericas declaradas" = if (length(numericas)) paste(numericas, collapse = ", ") else "Ninguna",
          "Muestra todas las categorias del instrumento" = if (isTRUE(mostrar_todo)) "Si" else "No"
        )
      ),
      ficha_tecnica
    )
  }

  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  if (exists("pulso_xlsx_ignore_number_warnings", mode = "function")) pulso_xlsx_ignore_number_warnings(path_xlsx)
  message("Frecuencias exportadas a: ", normalizePath(path_xlsx, winslash = "/"))
  invisible(normalizePath(path_xlsx, winslash = "/"))
}


# =============================================================================
# reporte_frecuencias
# =============================================================================

#' Generar reporte de frecuencias en Excel a partir de una base de reporte
#'
#' @param numericas Vector de variables numéricas (declaradas) para generar tabla
#'   de resumen en lugar de n/%.
#'
#' @family reporte
#' @export
reporte_frecuencias <- function(data,
                                instrumento = NULL,
                                secciones   = NULL,
                                path_xlsx   = "frecuencias_spss.xlsx",
                                orden       = c("desc", "asc", "original"),
                                sm_vars_force = NULL,
                                fuente      = "Pulso PUCP",
                                mostrar_todo = FALSE,
                                codigos_solo_si_presentes = NULL,
                                numericas = NULL,
                                incluir_titulos = TRUE,
                                incluir_secciones = TRUE,
                                incluir_porcentajes = TRUE,
                                ficha_tecnica = NULL) {

  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para `reporte_frecuencias()`. ",
         "Instálalo con install.packages('openxlsx').", call. = FALSE)
  }

  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  if (is.null(instrumento)) {
    instrumento <- attr(data, "instrumento_reporte", exact = TRUE)
    if (is.null(instrumento)) {
      stop("No se proporcionó `instrumento` y `data` no tiene atributo ",
           "`instrumento_reporte`.", call. = FALSE)
    }
  }

  survey <- instrumento$survey
  if (is.null(survey) || !all(c("name", "label") %in% names(survey))) {
    stop("El `instrumento` no contiene un `survey` con columnas `name` y `label`.",
         call. = FALSE)
  }

  dic_vars <- survey |>
    dplyr::filter(!is.na(.data$name), .data$name != "") |>
    dplyr::select(name, label) |>
    dplyr::mutate(label = trimws(as.character(.data$label))) |>
    dplyr::distinct(name, .keep_all = TRUE)

  orders_list <- if (!is.null(instrumento$orders_list)) instrumento$orders_list else NULL
  choices <- if (!is.null(instrumento$choices)) instrumento$choices else NULL
  orders_list <- .freq_augment_orders_list_from_choices(
    orders_list = orders_list,
    survey = survey,
    choices = choices
  )
  orden <- match.arg(orden)

  if (is.null(secciones)) {
    seccion_col <- NULL
    if ("section" %in% names(survey)) {
      seccion_col <- "section"
    } else if ("seccion" %in% names(survey)) {
      seccion_col <- "seccion"
    }

    if (!is.null(seccion_col)) {
      secciones_df <- survey |>
        dplyr::filter(
          !is.na(.data[[seccion_col]]),
          !is.na(.data$name),
          .data$name %in% names(data)
        ) |>
        dplyr::select(seccion = !!rlang::sym(seccion_col), name)

      if (nrow(secciones_df) == 0) {
        stop("No se pudieron inferir secciones desde `survey$",
             seccion_col, "`.", call. = FALSE)
      }

      secciones <- split(secciones_df$name, secciones_df$seccion)
    } else {
      stop("No se especificaron `secciones` y el `survey` no tiene columna ",
           "`section` ni `seccion`.", call. = FALSE)
    }
  }

  SECCIONES <- lapply(secciones, function(vars) {
    vars[vapply(vars, function(v) .has_var_or_dummies(data, v), logical(1))]
  })
  SECCIONES <- SECCIONES[vapply(SECCIONES, length, integer(1)) > 0L]

  if (length(SECCIONES) == 0L) {
    stop("Después de filtrar por presencia en `data` (variable o dummies), ",
         "ninguna sección tiene variables válidas. Revisar `secciones` y la base.",
         call. = FALSE)
  }

  exportar_frecuencias_spss(
    data            = data,
    dic_vars        = dic_vars,
    SECCIONES       = SECCIONES,
    labels_override = NULL,
    path_xlsx       = path_xlsx,
    orden           = orden,
    sm_vars_force   = sm_vars_force,
    fuente          = fuente,
    orders_list     = orders_list,
    survey          = survey,
    mostrar_todo    = mostrar_todo,
    codigos_solo_si_presentes = codigos_solo_si_presentes,
    numericas       = numericas,
    incluir_titulos = incluir_titulos,
    incluir_secciones = incluir_secciones,
    incluir_porcentajes = incluir_porcentajes,
    ficha_tecnica = ficha_tecnica
  )

  invisible(normalizePath(path_xlsx, winslash = "/"))
}
