# =============================================================================
# Familia SurveyMonkey -> XLSForm de referencia -> data compatible con reporte
# =============================================================================

.sm_or <- function(x, y) if (is.null(x) || (length(x) == 1L && is.na(x))) y else x

.sm_chr <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- NA_character_
  x
}

.sm_norm_ws <- function(x) {
  x <- .sm_chr(x)
  x <- gsub("[[:space:]]+", " ", x)
  trimws(x)
}

.sm_nonempty <- function(x) {
  x <- .sm_chr(x)
  x[!is.na(x) & nzchar(trimws(x))]
}

.sm_first_nonempty <- function(x, fallback = NA_character_) {
  x <- .sm_nonempty(x)
  if (!length(x)) return(as.character(fallback)[1])
  x[1]
}

.sm_unique_nonempty <- function(x) {
  x <- .sm_norm_ws(x)
  x <- x[!is.na(x) & nzchar(x)]
  unique(x)
}

.sm_unique_codes <- function(labels) {
  codes <- .sm_safe_slug(labels)
  used <- character(0)
  out <- character(length(codes))

  for (i in seq_along(codes)) {
    out[i] <- .sm_unique_name(codes[i], used = used, suffix = "opt")
    used <- c(used, out[i])
  }

  out
}

.sm_text_label_set <- function(x) {
  labels <- .sm_unique_nonempty(x)
  if (length(labels) < 2L) return(character(0))
  stats::setNames(.sm_unique_codes(labels), labels)
}

.sm_mode_nonempty <- function(x, fallback = NA_character_) {
  x <- .sm_nonempty(x)
  if (!length(x)) return(as.character(fallback)[1])
  tb <- sort(table(x), decreasing = TRUE)
  names(tb)[1]
}

.sm_common_prefix <- function(x) {
  x <- unique(.sm_norm_ws(x))
  x <- x[!is.na(x) & nzchar(x)]
  if (!length(x)) return(NA_character_)
  if (length(x) == 1L) return(x[1])

  prefix <- x[1]
  for (i in seq_along(x)[-1]) {
    cur <- x[i]
    max_n <- min(nchar(prefix), nchar(cur))
    if (!max_n) return(NA_character_)

    j <- 0L
    while (j < max_n && substr(prefix, j + 1L, j + 1L) == substr(cur, j + 1L, j + 1L)) {
      j <- j + 1L
    }

    prefix <- substr(prefix, 1L, j)
    if (!nzchar(prefix)) return(NA_character_)
  }

  prefix
}

.sm_prompt_from_labels <- function(labels) {
  labels <- unique(.sm_norm_ws(labels))
  labels <- labels[!is.na(labels) & nzchar(labels)]
  if (!length(labels)) return(NA_character_)

  direct <- labels[grepl("\\?$", labels)]
  if (length(direct)) {
    direct <- direct[order(nchar(direct), direct)]
    return(direct[1])
  }

  prefix <- .sm_common_prefix(labels)
  if (is.na(prefix) || !nzchar(prefix)) return(NA_character_)

  prefix <- sub("\\s+[_:;,-]*\\s*$", "", prefix)
  if (!grepl("[\\?\\.:]$", prefix)) {
    prefix <- sub("\\s+\\S*$", "", prefix)
  }
  prefix <- .sm_norm_ws(prefix)

  words_n <- if (nzchar(prefix)) length(strsplit(prefix, "\\s+")[[1]]) else 0L
  if (!nzchar(prefix) || nchar(prefix) < 20L || words_n < 4L) {
    return(NA_character_)
  }

  prefix
}

.sm_safe_slug <- function(x) {
  x <- janitor::make_clean_names(as.character(x))
  x <- gsub("_+", "_", x)
  x <- gsub("^_|_$", "", x)
  ifelse(!nzchar(x), "var", x)
}

.sm_other_name <- function(group_guess, fallback = "other") {
  grp <- .sm_safe_slug(.sm_or(group_guess, fallback))[1]
  paste0(grp, "_other")
}

.sm_unique_name <- function(base, used, suffix = "x") {
  nm <- .sm_safe_slug(base)[1]
  if (!nm %in% used) return(nm)

  i <- 1L
  repeat {
    cand <- paste0(nm, "_", suffix, i)
    if (!cand %in% used) return(cand)
    i <- i + 1L
  }
}

.sm_parse_var_name <- function(nm) {
  nm <- as.character(nm)[1]
  low <- tolower(trimws(nm))

  if (grepl("^(.*?)[_.](o|other|otro)$", low, perl = TRUE)) {
    stem <- sub("^(.*?)[_.](o|other|otro)$", "\\1", low, perl = TRUE)
    return(list(stem = stem, suffix = "O", is_other = TRUE))
  }

  if (grepl("^(.*?)[_.]([0-9]+)$", low, perl = TRUE)) {
    stem <- sub("^(.*?)[_.]([0-9]+)$", "\\1", low, perl = TRUE)
    sfx  <- sub("^(.*?)[_.]([0-9]+)$", "\\2", low, perl = TRUE)
    return(list(stem = stem, suffix = sfx, is_other = FALSE))
  }

  # Sufijo alfabético: P2_a, P5_b. Solo aceptamos si el stem termina en
  # dígito (variable claramente numerada en SurveyMonkey) — para no agrupar
  # falsos positivos como `respondent_id` (donde "id" se vería como sufijo).
  if (grepl("^(.*[0-9])[_.]([a-z]+)$", low, perl = TRUE)) {
    stem <- sub("^(.*[0-9])[_.]([a-z]+)$", "\\1", low, perl = TRUE)
    sfx  <- sub("^(.*[0-9])[_.]([a-z]+)$", "\\2", low, perl = TRUE)
    return(list(stem = stem, suffix = sfx, is_other = FALSE))
  }

  list(stem = low, suffix = NA_character_, is_other = FALSE)
}

.sm_label_signature <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  if (is.null(labs) || !length(labs)) return(NA_character_)
  paste0(names(labs), "=", unname(labs), collapse = " | ")
}

.sm_binary_string_set <- c(
  # ASCII universal
  "0", "1", "true", "false", "t", "f", "y", "n",
  # Inglés
  "yes", "no",
  # Español
  "si", "sí", "no",
  # Portugués
  "sim", "nao", "não",
  # Francés
  "oui", "non",
  # Alemán
  "ja", "nein",
  # Italiano
  "si", "no"
)

.sm_is_binary_like <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  if (!is.null(labs) && length(labs) == 1L) return(TRUE)
  if (is.logical(x)) return(TRUE)

  x_chr <- trimws(as.character(x))
  x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr)]
  if (!length(x_chr)) return(FALSE)

  x_num <- suppressWarnings(as.numeric(x_chr))
  if (all(!is.na(x_num))) {
    return(all(unique(x_num) %in% c(0, 1)))
  }

  # Translitera a ASCII para que tildes (sí/não) coincidan con la lista
  # normalizada — evita falsos negativos por encoding del .sav.
  x_ascii <- .sm_ascii_lower(x_chr)
  all(unique(x_ascii) %in% .sm_ascii_lower(.sm_binary_string_set))
}

.sm_is_text_select_one_like <- function(x) {
  if (!(is.character(x) || is.factor(x))) return(FALSE)

  vals <- .sm_unique_nonempty(x)
  n_vals <- length(vals)
  if (n_vals < 2L || n_vals > 8L) return(FALSE)
  if (any(nchar(vals) > 80L)) return(FALSE)

  x_chr <- .sm_norm_ws(x)
  x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr)]
  n_nonmiss <- length(x_chr)
  if (!n_nonmiss) return(FALSE)

  # Evita tratar textos realmente abiertos como categorías cuando casi todo es único.
  if (n_vals > max(3L, floor(n_nonmiss * 0.5))) return(FALSE)

  TRUE
}

.sm_is_dummy_selected <- function(x) {
  labs <- attr(x, "labels", exact = TRUE)
  x_chr <- as.character(x)
  selected <- rep(FALSE, length(x_chr))

  if (!is.null(labs) && length(labs) == 1L) {
    code <- as.character(unname(labs)[1])
    selected <- !is.na(x_chr) & trimws(x_chr) == trimws(code)
    return(selected)
  }

  x_num <- suppressWarnings(as.numeric(x_chr))
  if (!all(is.na(x_num))) {
    return(!is.na(x_num) & x_num == 1)
  }

  x_low <- tolower(trimws(x_chr))
  !is.na(x_low) & x_low %in% c("1", "true", "t", "si", "sí", "yes")
}

.sm_is_metadata_name <- function(nm) {
  low <- tolower(trimws(as.character(nm)[1]))
  low %in% c(
    "collectornm", "respondent_id", "collector_id", "date_created",
    "date_modified", "ip_address", "email_address", "first_name",
    "last_name"
  ) || grepl("^custom_[0-9]+$", low)
}

.sm_is_question_name <- function(nm) {
  low <- tolower(trimws(as.character(nm)[1]))
  # Acepta P{n} (P1, P4_2, P5_O) y Q{n} (q1, q0007_0001) — SurveyMonkey usa
  # ambas convenciones según cómo se descargue el SPSS. El sufijo opcional
  # puede ser numérico (con o sin padding), alfabético, u "other".
  grepl("^[pq][0-9]+([_.](?:[0-9]+|[a-z]+|o|other|otro))?$", low, perl = TRUE)
}

.sm_infer_other_label <- function(other_row, choice_labels = character()) {
  choice_labels <- .sm_norm_ws(choice_labels)
  if (length(choice_labels)) {
    idx_other <- which(.sm_is_other_label(choice_labels))
    if (length(idx_other)) {
      return(choice_labels[idx_other[1]])
    }
  }

  lab <- .sm_norm_ws(.sm_as_question_label(other_row))
  if (grepl("^other\\b", tolower(lab))) {
    return("Otro:")
  }

  lab
}

.sm_is_other_label <- function(x) {
  x_norm <- .sm_ascii_lower(x)
  grepl("^(otro|otra|otros|otras|other)(\\b|:)", x_norm, perl = TRUE)
}

# ============================================================================
# Renombrado a convención `pN` y `PagN` (postprocesador del XLSForm)
# ============================================================================
# Tras armar `survey`, asignamos nombres canónicos cortos: cada pregunta del
# instrumento recibe `p1, p2, p3, ...` en orden de aparición, y cada sección
# de página `Pag1, Pag2, ...`. Tres reglas:
#   - Las preguntas hijas de un `select_multiple` con dummy + `_other` reciben
#     el sufijo `_other` sobre el padre (ej. p7_other).
#   - Battery/matriz: cada item es una pregunta independiente — recibe su
#     propio número secuencial (es lo que ya emite el survey).
#   - Las dummies de SM (`q0007_0001..0007`) NO viven en el survey final
#     (solo la madre `q0007`); su mapping se construye desde `multi_specs`.
# Ya con el mapping listo:
#   - Reescribimos `${old}` → `${new}` en relevant/constraint/calculation/
#     choice_filter (incluye selected(${old}, ...)).
#   - Renombramos las columnas de `data` (incluidas las dummies con sufijo).

# Convierte `q0007` → `p7` (sin padding). Si el nombre no matchea
# `q<digits>(_<rest>)?` devuelve NA — preserva el nombre tal cual.
.sm_q_to_p <- function(name) {
  if (is.na(name) || !nzchar(name)) return(NA_character_)
  m <- regmatches(name, regexec("^[qQ]0*([0-9]+)(.*)$", name))[[1]]
  if (length(m) < 3L) return(NA_character_)
  num <- as.integer(m[2])
  rest <- m[3]
  paste0("p", num, rest)
}

# Construye mapping `oldName → newName` aplicando `q<N> → p<N>` (sin padding,
# preservando sufijos como `_other`, `_0001`, `_NN`). Las dummies SM que
# están en data pero no en survey reciben mapping vía `multi_specs`.
.sm_build_pname_remap <- function(survey, multi_specs = NULL, battery_specs = NULL) {
  remap <- character(0)

  emit <- function(old, new) {
    if (is.na(old) || !nzchar(old)) return(invisible())
    if (is.na(new) || !nzchar(new)) return(invisible())
    if (identical(old, new)) return(invisible())
    remap[[old]] <<- new
  }

  # Tipos que NO son preguntas (no se renombran).
  non_question_types <- c("begin_repeat", "end_repeat",
                           "start", "end", "today", "deviceid",
                           "audit", "subscriberid", "phonenumber",
                           "simserial", "username", "note")

  # Metadata/auxiliary preservan nombres crudos (respondent_id, ip_address...).
  excluded_groups <- c("survey_monkey_metadata", "survey_monkey_auxiliary")
  group_stack <- character(0)
  in_excluded_group <- function() any(group_stack %in% excluded_groups)

  for (i in seq_len(nrow(survey))) {
    nm <- as.character(survey$name[i] %||% NA_character_)
    tp <- as.character(survey$type[i] %||% "")
    if (identical(tp, "begin_group") || identical(tp, "begin_repeat")) {
      group_stack <- c(group_stack, nm %||% "")
      next
    }
    if (identical(tp, "end_group") || identical(tp, "end_repeat")) {
      if (length(group_stack)) group_stack <- group_stack[-length(group_stack)]
      next
    }
    # `end_group` ya retornó arriba; el resto se procesa.
    if (is.na(nm) || !nzchar(nm)) next
    if (tp %in% non_question_types) next
    if (in_excluded_group()) next
    new <- .sm_q_to_p(nm)
    if (!is.na(new)) emit(nm, new)
  }

  # Dummies de select_multiple SM (q0007_0001..0007 → p7_0001..p7_0007)
  # también necesitan mapping para que `surveymonkey_data` y consumidores
  # con keep_raw_multi=TRUE generen los nombres remapeados. Conservamos el
  # padding original del suffix.
  if (length(multi_specs)) {
    for (grp in names(multi_specs)) {
      msp <- multi_specs[[grp]]
      ch <- msp$children
      if (is.null(ch) || !nrow(ch)) next
      for (k in seq_len(nrow(ch))) {
        raw <- as.character(ch$name_raw[k])
        if (!nzchar(raw)) next
        new <- .sm_q_to_p(raw)
        if (!is.na(new)) emit(raw, new)
      }
    }
  }

  remap
}

# Reescribe `${old}` → `${new}` en una expresión XLSForm. Usamos un loop
# por nombre con `fixed=TRUE` para evitar tratar nombres como regex (los
# nombres pueden contener `.` o caracteres ambiguos).
.sm_rewrite_expr <- function(expr, remap) {
  if (is.na(expr) || !nzchar(expr) || !length(remap)) return(expr)
  for (old in names(remap)) {
    new <- remap[[old]]
    expr <- gsub(paste0("${", old, "}"), paste0("${", new, "}"), expr, fixed = TRUE)
  }
  expr
}

# Construye el mapping `section_pag_<id>` → `Pag<N>` enumerando las
# secciones de página en orden de aparición. Devuelve también un label
# legible "Pag<N> (p<first>-p<last>)" calculado con el remap de preguntas
# ya aplicado al survey.
.sm_build_page_remap <- function(survey, name_remap) {
  page_remap <- character(0)
  page_label <- character(0)
  page_seq <- 0L
  current_page <- NA_character_
  current_first_q <- NA_character_
  current_last_q <- NA_character_

  flush_label <- function() {
    if (is.na(current_page) || !nzchar(current_page)) return(invisible())
    new_name <- page_remap[[current_page]]
    if (is.null(new_name)) return(invisible())
    rng <- if (!is.na(current_first_q) && !is.na(current_last_q)) {
      if (identical(current_first_q, current_last_q)) {
        sprintf(" (%s)", current_first_q)
      } else {
        sprintf(" (%s-%s)", current_first_q, current_last_q)
      }
    } else ""
    page_label[[current_page]] <<- paste0(new_name, rng)
  }

  for (i in seq_len(nrow(survey))) {
    nm <- as.character(survey$name[i] %||% NA_character_)
    tp <- as.character(survey$type[i] %||% "")
    if (identical(tp, "begin_group") && grepl("^section_pag_", nm %||% "")) {
      flush_label()
      page_seq <- page_seq + 1L
      page_remap[[nm]] <- sprintf("Pag%d", page_seq)
      current_page <- nm
      current_first_q <- NA_character_
      current_last_q <- NA_character_
      next
    }
    if (identical(tp, "end_group") && !is.na(current_page)) {
      sec_name <- as.character(survey$section[i] %||% NA_character_)
      if (identical(sec_name, current_page)) {
        flush_label()
        current_page <- NA_character_
      }
      next
    }
    if (!is.na(current_page) && !is.na(nm) && nzchar(nm) && (nm %in% names(name_remap))) {
      mapped <- name_remap[[nm]]
      if (!is.na(mapped)) {
        if (is.na(current_first_q)) current_first_q <- mapped
        current_last_q <- mapped
      }
    }
  }
  flush_label()

  list(name_map = page_remap, label_map = page_label)
}

.sm_apply_remap_to_spec <- function(spec) {
  if (is.null(spec) || is.null(spec$survey) || !nrow(spec$survey)) return(spec)
  survey <- spec$survey

  remap <- .sm_build_pname_remap(survey,
                                  multi_specs = spec$multi_specs,
                                  battery_specs = spec$battery_specs)
  if (!length(remap)) {
    spec$name_remap <- character(0)
    spec$page_remap <- character(0)
    return(spec)
  }

  page_info <- .sm_build_page_remap(survey, remap)

  rewrite_col <- function(x) vapply(x, .sm_rewrite_expr, character(1), remap = remap)
  apply_remap <- function(x) {
    out <- as.character(x)
    keys <- names(remap)
    hit <- which(out %in% keys)
    out[hit] <- unname(remap[out[hit]])
    out
  }
  apply_page_remap <- function(x) {
    out <- as.character(x)
    keys <- names(page_info$name_map)
    hit <- which(out %in% keys)
    out[hit] <- unname(page_info$name_map[out[hit]])
    out
  }

  # 1. Survey: renombrar `name` (preguntas), `section` (asignación de página),
  #    reescribir expresiones y reemplazar el name + label de los begin_group
  #    de página.
  survey$name <- apply_remap(survey$name)
  survey$section <- apply_page_remap(survey$section)
  if ("relevant" %in% names(survey))      survey$relevant      <- rewrite_col(survey$relevant)
  if ("constraint" %in% names(survey))    survey$constraint    <- rewrite_col(survey$constraint)
  if ("calculation" %in% names(survey))   survey$calculation   <- rewrite_col(survey$calculation)
  if ("choice_filter" %in% names(survey)) survey$choice_filter <- rewrite_col(survey$choice_filter)

  # Renombrar los begin_group/end_group de página + sustituir el label.
  for (i in seq_len(nrow(survey))) {
    nm <- as.character(survey$name[i] %||% NA_character_)
    tp <- as.character(survey$type[i] %||% "")
    if (identical(tp, "begin_group") && nm %in% names(page_info$name_map)) {
      survey$name[i] <- page_info$name_map[[nm]]
      if ("label::es" %in% names(survey)) {
        new_label <- page_info$label_map[[nm]] %||% page_info$name_map[[nm]]
        survey$`label::es`[i] <- new_label
      }
    }
  }
  spec$survey <- survey

  # 1.5 Renombrar listas: lst_q<NNNN> → lst_p<N>. El remap de preguntas
  #     ya tiene q<NNNN>→p<N>; lo extendemos al naming de las listas para
  #     mantener convención consistente. Aplica a survey$type
  #     (formato "select_one lst_q0007") y a choices$list_name.
  list_remap <- character(0)
  for (q_old in names(remap)) {
    m <- regmatches(q_old, regexec("^[qQ]0*([0-9]+)$", q_old))[[1]]
    if (length(m) >= 2L) {
      list_remap[[paste0("lst_", q_old)]] <- paste0("lst_p", as.integer(m[2]))
    }
  }
  if (length(list_remap)) {
    for (oldn in names(list_remap)) {
      pat <- paste0("\\b", oldn, "\\b")
      spec$survey$type <- gsub(pat, list_remap[[oldn]], spec$survey$type, perl = TRUE)
      if (length(spec$multi_specs)) {
        for (grp in names(spec$multi_specs)) {
          msp <- spec$multi_specs[[grp]]
          if (!is.null(msp$mother) && "type" %in% names(msp$mother)) {
            msp$mother$type <- gsub(pat, list_remap[[oldn]], msp$mother$type, perl = TRUE)
          }
          if (length(msp$questions)) {
            for (k in seq_along(msp$questions)) {
              q <- msp$questions[[k]]
              if ("type" %in% names(q)) q$type <- gsub(pat, list_remap[[oldn]], q$type, perl = TRUE)
              msp$questions[[k]] <- q
            }
          }
          spec$multi_specs[[grp]] <- msp
        }
      }
      if (!is.null(spec$question_specs) && "type" %in% names(spec$question_specs)) {
        spec$question_specs$type <- gsub(pat, list_remap[[oldn]], spec$question_specs$type, perl = TRUE)
      }
    }
    if (!is.null(spec$choices) && "list_name" %in% names(spec$choices)) {
      hits <- which(spec$choices$list_name %in% names(list_remap))
      if (length(hits)) {
        spec$choices$list_name[hits] <- unname(list_remap[spec$choices$list_name[hits]])
      }
    }
  }
  spec$list_remap <- list_remap

  # 2. Question_specs y multi_specs/battery_specs: actualizar nombres para
  #    que `surveymonkey_data` produzca columnas con los nombres ya remapeados.
  if (!is.null(spec$question_specs) && nrow(spec$question_specs)) {
    qs <- spec$question_specs
    qs$name <- apply_remap(qs$name)
    qs$section <- apply_page_remap(qs$section)
    if ("relevant" %in% names(qs)) qs$relevant <- rewrite_col(qs$relevant)
    spec$question_specs <- qs
  }
  if (length(spec$multi_specs)) {
    for (grp in names(spec$multi_specs)) {
      msp <- spec$multi_specs[[grp]]
      if (!is.null(msp$mother)) {
        msp$mother$name <- apply_remap(msp$mother$name)
        msp$mother$section <- apply_page_remap(msp$mother$section)
        if ("relevant" %in% names(msp$mother)) msp$mother$relevant <- rewrite_col(msp$mother$relevant)
      }
      if (length(msp$questions)) {
        for (k in seq_along(msp$questions)) {
          q <- msp$questions[[k]]
          q$name <- apply_remap(q$name)
          q$section <- apply_page_remap(q$section)
          if ("relevant" %in% names(q)) q$relevant <- rewrite_col(q$relevant)
          msp$questions[[k]] <- q
        }
      }
      # Children: actualizamos `name_final` (usado por keep_raw_multi=TRUE
      # en surveymonkey_data) pero NO `name_raw` (que es la columna real
      # del SAV y debe coincidir con el archivo).
      if (!is.null(msp$children) && nrow(msp$children) && "name_final" %in% names(msp$children)) {
        msp$children$name_final <- apply_remap(msp$children$name_final)
      }
      spec$multi_specs[[grp]] <- msp
    }
  }
  if (length(spec$battery_specs)) {
    for (grp in names(spec$battery_specs)) {
      bsp <- spec$battery_specs[[grp]]
      # group_name de battery NO está mapeado (no es pregunta); preservar.
      spec$battery_specs[[grp]] <- bsp
    }
  }

  # 3. Diagnóstico: actualizar `name_final` y `section_final` in place para
  #    que reflejen los nombres canónicos. NO agregamos columnas nuevas para
  #    no romper consumidores aguas abajo que asumen el shape original.
  if (!is.null(spec$diagnostico) && nrow(spec$diagnostico)) {
    spec$diagnostico$name_final <- apply_remap(spec$diagnostico$name_final)
    spec$diagnostico$section_final <- apply_page_remap(spec$diagnostico$section_final)
  }

  # Persistimos los mappings en el spec — `surveymonkey_data` y consumidores
  # externos los necesitan para renombrar columnas de la data SAV.
  spec$name_remap <- remap
  spec$page_remap <- page_info$name_map
  spec
}

.sm_other_choice_value <- function(labs) {
  if (is.null(labs) || !length(labs)) return(NA_character_)
  idx <- which(.sm_is_other_label(names(labs)))
  if (!length(idx)) return(NA_character_)
  as.character(unname(labs)[idx[1]])
}

.sm_other_relevant <- function(parent_name, other_value) {
  if (is.na(parent_name) || !nzchar(parent_name) || is.na(other_value) || !nzchar(other_value)) {
    return(NA_character_)
  }
  sprintf("selected(${%s}, '%s')", parent_name, other_value)
}

.sm_infer_other_label_from_group <- function(row, vars_tbl, label_sets) {
  siblings <- vars_tbl[
    vars_tbl$group_guess == row$group_guess &
      vars_tbl$name_raw != row$name_raw &
      vars_tbl$n_value_labels > 1L,
    ,
    drop = FALSE
  ]

  if (nrow(siblings)) {
    for (i in seq_len(nrow(siblings))) {
      labs <- .sm_or(label_sets[[siblings$name_raw[i]]], numeric(0))
      if (!length(labs)) next
      lbl <- .sm_infer_other_label(row, choice_labels = names(labs))
      if (!is.na(lbl) && nzchar(lbl)) {
        return(lbl)
      }
    }
  }

  .sm_infer_other_label(row)
}

.sm_ascii_lower <- function(x) {
  x <- .sm_norm_ws(x)
  out <- if (requireNamespace("stringi", quietly = TRUE)) {
    stringi::stri_trans_general(x, "Latin-ASCII")
  } else {
    iconv(x, from = "", to = "ASCII//TRANSLIT")
  }
  tolower(out)
}

.sm_choice_signature <- function(labs) {
  if (is.null(labs) || !length(labs)) return(NA_character_)
  ord <- order(unname(labs), seq_along(labs))
  codes <- as.character(unname(labs)[ord])
  labels <- .sm_ascii_lower(names(labs)[ord])
  paste(paste0(codes, ":", labels), collapse = " | ")
}

.sm_choice_family_base <- function(labs) {
  if (is.null(labs) || !length(labs)) return(NA_character_)

  ord <- order(unname(labs), seq_along(labs))
  codes <- unname(labs)[ord]
  labels <- .sm_ascii_lower(names(labs)[ord])

  miss_idx <- grepl(
    paste(
      c(
        "^sin\\s*inf",
        "sin informacion suficiente",
        "sin información suficiente",
        "no tiene informacion suficiente",
        "no tiene información suficiente",
        "^ns/?nr$",
        "no sabe",
        "no responde"
      ),
      collapse = "|"
    ),
    labels
  )

  core_labels <- labels[!miss_idx]
  core_codes <- codes[!miss_idx]

  if (identical(core_labels, c("si", "no")) && identical(as.numeric(core_codes), c(1, 2))) {
    return("si_no")
  }

  if (
    identical(
      core_labels,
      c("totalmente en desacuerdo", "en desacuerdo", "de acuerdo", "totalmente de acuerdo")
    )
  ) {
    return("acuerdo_4")
  }

  if (
    identical(
      core_labels,
      c("nada satisfecho", "poco satisfecho", "satisfecho", "muy satisfecho")
    )
  ) {
    return("satisfaccion_4")
  }

  if (
    identical(
      core_labels,
      c("muy insatisfecho", "insatisfecho", "satisfecho", "muy satisfecho")
    )
  ) {
    return("satisfaccion_4")
  }

  NA_character_
}

.sm_sort_group_rows <- function(df) {
  if (is.null(df) || !nrow(df) || !("suffix" %in% names(df))) return(df)
  suffix_num <- suppressWarnings(as.numeric(as.character(df$suffix)))
  if (all(!is.na(suffix_num))) {
    df <- df[order(suffix_num, df$order), , drop = FALSE]
  } else if (all(!is.na(df$suffix))) {
    # Sufijo alfabético (P2_a, P2_b): orden alfabético consistente.
    df <- df[order(as.character(df$suffix), df$order), , drop = FALSE]
  } else {
    df <- df[order(df$order), , drop = FALSE]
  }
  if ("order" %in% names(df)) {
    start_ord <- suppressWarnings(min(as.numeric(df$order), na.rm = TRUE))
    if (!is.finite(start_ord)) start_ord <- 1L
    df$order <- start_ord + seq_len(nrow(df)) - 1L
  }
  df
}

.sm_detect_datetime <- function(x, nm = NULL) {
  if (inherits(x, c("POSIXct", "POSIXlt"))) return(TRUE)

  nm_low <- tolower(trimws(as.character(.sm_or(nm, ""))[1]))
  x_chr <- trimws(as.character(x))
  x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr)]
  if (!length(x_chr)) return(FALSE)

  if (!(nm_low %in% c("date_created", "date_modified") ||
        grepl("date|fecha|time|hora", nm_low))) {
    return(FALSE)
  }

  formats <- c(
    "%m/%d/%Y %I:%M:%S %p",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %I:%M:%S %p"
  )

  ratios <- vapply(formats, function(fmt) {
    parsed <- as.POSIXct(x_chr, format = fmt, tz = "UTC")
    mean(!is.na(parsed))
  }, numeric(1))

  max(ratios, na.rm = TRUE) >= 0.8
}

.sm_storage_type_guess <- function(x, nm = NULL) {
  if (.sm_detect_datetime(x, nm = nm)) return("datetime")

  if (is.numeric(x) || inherits(x, "haven_labelled")) {
    x_num <- suppressWarnings(as.numeric(x))
    x_num <- x_num[!is.na(x_num)]
    if (!length(x_num)) return("integer")
    if (all(abs(x_num - round(x_num)) < 1e-8)) return("integer")
    return("decimal")
  }

  "text"
}

.sm_multi_groups <- function(vars_tbl) {
  grps <- split(vars_tbl, vars_tbl$group_guess)
  keep <- vapply(grps, function(df) {
    df2 <- df[!df$is_metadata & !df$is_other & df$is_question_like, , drop = FALSE]
    if (nrow(df2) < 2L) return(FALSE)
    # Sufijo numérico (P5_1, P5_2) o alfabético (P5_a, P5_b) — ambos válidos.
    if (any(is.na(df2$suffix))) return(FALSE)
    valid_suffix <- grepl("^([0-9]+|[a-z]+)$", df2$suffix)
    if (!all(valid_suffix)) return(FALSE)
    # Sufijos del grupo deben ser homogéneos (todos numéricos o todos alfa).
    suffix_kinds <- unique(grepl("^[0-9]+$", df2$suffix))
    if (length(suffix_kinds) != 1L) return(FALSE)
    all(df2$n_value_labels == 1L | df2$binary_like)
  }, logical(1))
  names(grps)[keep]
}

# Mapea cada name_raw del dataset a la sección-página a la que pertenece,
# según el mapeo `paginas = list("16" = c("Q24"), "17" = c("Q25",...))`.
# Devuelve named character vector (una entrada por name_raw); NA cuando la
# pregunta no está mapeada (queda al nivel raíz del survey).
.sm_build_section_map <- function(paginas, vars_tbl) {
  out <- stats::setNames(rep(NA_character_, nrow(vars_tbl)), vars_tbl$name_raw)
  if (is.null(paginas) || !length(paginas)) return(out)

  style <- .sm_detect_naming_style(vars_tbl$name_raw)
  raw_upper <- toupper(vars_tbl$name_raw)

  for (page_id in names(paginas)) {
    qs <- paginas[[page_id]]
    if (!length(qs)) next
    section_name <- paste0("section_pag_", page_id)
    for (q in qs) {
      variants <- toupper(.sm_qp_variants(q, style))
      # Match exacto al name_raw
      hit_idx <- which(raw_upper %in% variants)
      # Match por prefijo (battery/multi children: Q24 → Q24_0001..0007)
      if (TRUE) {
        prefix_pat <- paste0("^(", paste(variants, collapse = "|"), ")_")
        hit_idx <- unique(c(hit_idx, grep(prefix_pat, raw_upper, perl = TRUE)))
      }
      out[hit_idx] <- section_name
    }
  }
  out
}

.sm_battery_groups <- function(vars_tbl, threshold = 0.8) {
  grps <- split(vars_tbl, vars_tbl$group_guess)
  keep <- vapply(grps, function(df) {
    df2 <- df[!df$is_metadata & !df$is_other & df$is_question_like, , drop = FALSE]
    if (nrow(df2) < 2L) return(FALSE)
    if (any(is.na(df2$suffix) | !grepl("^[0-9]+$", df2$suffix))) return(FALSE)
    if (any(df2$n_value_labels <= 1L)) return(FALSE)
    sigs <- df2$label_signature[!is.na(df2$label_signature)]
    if (!length(sigs)) return(FALSE)
    # Battery se forma si la firma dominante cubre `threshold` (80% por
    # defecto) de los items con sufijo numérico — los outliers se filtran
    # en .sm_battery_outliers y caen como select_one con su propia lista.
    counts <- table(sigs)
    max(counts) / length(sigs) >= threshold && max(counts) >= 2L
  }, logical(1))
  names(grps)[keep]
}

# Devuelve un vector de `name_raw` que pertenecen a un grupo aceptado como
# battery pero cuya firma de etiquetas difiere de la dominante. Estos items
# NO se marcan como battery_item — caen al kind_guess default (select_one)
# y reciben aviso en la hoja diagnostico.
.sm_battery_outliers <- function(vars_tbl, battery_groups) {
  if (!length(battery_groups)) return(character(0))
  out <- character(0)
  for (g in battery_groups) {
    df <- vars_tbl[vars_tbl$group_guess == g, , drop = FALSE]
    df2 <- df[!df$is_metadata & !df$is_other & df$is_question_like, , drop = FALSE]
    sigs <- df2$label_signature
    sigs_known <- sigs[!is.na(sigs)]
    if (!length(sigs_known)) next
    dominant <- names(sort(table(sigs_known), decreasing = TRUE))[1]
    is_outlier <- !is.na(sigs) & sigs != dominant
    if (any(is_outlier)) {
      out <- c(out, df2$name_raw[is_outlier])
    }
  }
  out
}

# Anexa avisos diagnósticos a vars_tbl para que la hoja `diagnostico` muestre
# por qué un grupo de variables que "parecían" battery/multi quedó suelto.
# Solo detectamos descartes muy claros para evitar falsos positivos.
.sm_attach_avisos <- function(vars_tbl) {
  vars_tbl$aviso_tipo <- NA_character_
  vars_tbl$aviso_mensaje <- NA_character_

  if (!nrow(vars_tbl)) return(vars_tbl)

  # Outliers de battery: el grupo se aceptó como battery con tolerancia,
  # pero estos items tienen firma de etiquetas distinta a la dominante y
  # quedaron fuera del begin_group como select_one independientes.
  if (!is.null(vars_tbl$is_battery_outlier)) {
    where <- which(isTRUE(vars_tbl$is_battery_outlier) | vars_tbl$is_battery_outlier)
    if (length(where)) {
      vars_tbl$aviso_tipo[where] <- "battery_outlier"
      vars_tbl$aviso_mensaje[where] <- paste(
        "Item del grupo battery con etiquetas distintas al resto:",
        "se mantuvo el grupo (la mayoría comparte la misma escala) pero este item",
        "quedó fuera como select_one independiente."
      )
    }
  }

  is_kept_battery <- vars_tbl$kind_guess == "battery_item"
  is_kept_multi <- vars_tbl$kind_guess == "select_multiple_dummy"

  for (g in unique(vars_tbl$group_guess)) {
    if (!nzchar(g)) next
    idx <- which(vars_tbl$group_guess == g)
    df <- vars_tbl[idx, , drop = FALSE]
    df_q <- df[!df$is_metadata & !df$is_other & df$is_question_like, , drop = FALSE]
    if (nrow(df_q) < 2L) next
    if (any(is_kept_battery[idx]) || any(is_kept_multi[idx])) next

    suffixes_numeric <- !any(is.na(df_q$suffix) | !grepl("^[0-9]+$", df_q$suffix))

    # Battery candidata: 2+ vars con etiquetas (n_value_labels > 1) y sufijos
    # numéricos, pero firmas de etiquetas distintas → fragmenta el grupo.
    if (suffixes_numeric && all(df_q$n_value_labels > 1L)) {
      sigs <- unique(df_q$label_signature[!is.na(df_q$label_signature)])
      if (length(sigs) > 1L) {
        vars_tbl$aviso_tipo[idx] <- "battery_descartada"
        vars_tbl$aviso_mensaje[idx] <- paste(
          "Battery candidata descartada: las opciones de respuesta difieren entre items del grupo",
          sprintf("(%d firmas distintas).", length(sigs)),
          "Para agruparlos como matriz Likert, asegúrate de que todos los items compartan exactamente las mismas opciones."
        )
        next
      }
    }

  }

  # Segunda pasada: detecta variables con sufijo alfabético (P2_a, P5_b)
  # que NO terminaron como select_multiple_dummy ni battery_item — es decir,
  # el detector las vio pero no se cumplían las condiciones (no eran dummy
  # ni tenían etiquetas homogéneas). Avisamos para que el usuario revise.
  alpha_suffix <- grepl("^[Pp][0-9]+_[A-Za-z]+$", vars_tbl$name_raw) &
    !vars_tbl$is_metadata & !vars_tbl$is_other &
    !vars_tbl$kind_guess %in% c("select_multiple_dummy", "battery_item") &
    is.na(vars_tbl$aviso_tipo)
  if (any(alpha_suffix)) {
    where_all <- which(alpha_suffix)
    prefixes <- sub("_[A-Za-z]+$", "", vars_tbl$name_raw[where_all])
    for (px in unique(prefixes)) {
      where <- where_all[prefixes == px]
      if (length(where) < 2L) next
      vars_tbl$aviso_tipo[where] <- "multi_descartada"
      vars_tbl$aviso_mensaje[where] <- paste(
        "Multi-select candidata descartada:",
        "el sufijo de las variables no es numérico (esperado p1_1, p1_2, ...).",
        "Revisa los nombres en SurveyMonkey si querías que se agrupen como select_multiple."
      )
    }
  }

  vars_tbl
}

.sm_build_read_object <- function(path, user_na = TRUE) {
  data_raw <- tryCatch(
    haven::read_sav(path, user_na = user_na),
    error = function(e) {
      stop(
        sprintf(
          "No pude leer '%s' como SPSS .sav (%s). Verifica que sea un export SPSS de SurveyMonkey y no un .csv/.xlsx renombrado.",
          basename(path), conditionMessage(e)
        ),
        call. = FALSE
      )
    }
  )
  cols <- names(data_raw)
  if (length(cols) == 0L) {
    stop(
      sprintf("El archivo '%s' no tiene columnas — no hay nada que traducir.", basename(path)),
      call. = FALSE
    )
  }
  if (nrow(data_raw) == 0L) {
    stop(
      sprintf(
        "El archivo '%s' no tiene filas. La traducción necesita al menos una respuesta para inferir tipos de pregunta a partir de los valores observados.",
        basename(path)
      ),
      call. = FALSE
    )
  }
  parsed <- lapply(cols, .sm_parse_var_name)
  name_clean <- janitor::make_clean_names(cols)

  vars_tbl <- tibble::tibble(
    order = seq_along(cols),
    name_raw = cols,
    name_clean = name_clean,
    label = vapply(data_raw, function(v) .sm_first_nonempty(attr(v, "label", exact = TRUE), fallback = NA_character_), character(1)),
    class = vapply(data_raw, function(v) paste(class(v), collapse = ","), character(1)),
    n_value_labels = vapply(data_raw, function(v) length(.sm_or(attr(v, "labels", exact = TRUE), numeric(0))), integer(1)),
    is_labelled = vapply(data_raw, inherits, logical(1), what = "haven_labelled"),
    stem = vapply(parsed, `[[`, character(1), "stem"),
    suffix = vapply(parsed, `[[`, character(1), "suffix"),
    is_other = vapply(parsed, `[[`, logical(1), "is_other"),
    group_guess = vapply(parsed, function(z) .sm_safe_slug(z$stem), character(1)),
    is_metadata = vapply(cols, .sm_is_metadata_name, logical(1)),
    is_question_like = vapply(cols, .sm_is_question_name, logical(1)),
    label_signature = vapply(data_raw, .sm_label_signature, character(1)),
    binary_like = vapply(data_raw, .sm_is_binary_like, logical(1)),
    text_select_one_like = vapply(data_raw, .sm_is_text_select_one_like, logical(1)),
    storage_type_guess = vapply(seq_along(data_raw), function(i) .sm_storage_type_guess(data_raw[[i]], cols[i]), character(1))
  )
  vars_tbl$is_auxiliary <- !vars_tbl$is_metadata & !vars_tbl$is_question_like

  multi_groups <- .sm_multi_groups(vars_tbl)
  battery_groups <- .sm_battery_groups(vars_tbl)
  battery_outliers <- .sm_battery_outliers(vars_tbl, battery_groups)
  vars_tbl$is_battery_outlier <- vars_tbl$name_raw %in% battery_outliers

  in_battery <- vars_tbl$group_guess %in% battery_groups & !vars_tbl$is_battery_outlier

  vars_tbl$kind_guess <- ifelse(
    vars_tbl$is_metadata, "metadata",
    ifelse(
      vars_tbl$is_other, "other_text",
      ifelse(
        vars_tbl$group_guess %in% multi_groups, "select_multiple_dummy",
        ifelse(
          in_battery, "battery_item",
          ifelse(vars_tbl$n_value_labels > 1L | vars_tbl$text_select_one_like, "select_one", vars_tbl$storage_type_guess)
        )
      )
    )
  )

  label_sets <- stats::setNames(lapply(seq_along(data_raw), function(i) {
    labs <- attr(data_raw[[i]], "labels", exact = TRUE)
    if (!is.null(labs) && length(labs)) return(labs)
    if (isTRUE(vars_tbl$text_select_one_like[i])) return(.sm_text_label_set(data_raw[[i]]))
    character(0)
  }), cols)
  structure(
    list(
      data_raw = as.data.frame(data_raw, stringsAsFactors = FALSE),
      vars_tbl = vars_tbl,
      label_sets = label_sets,
      meta = list(
        path = normalizePath(path, winslash = "/", mustWork = TRUE),
        file_name = basename(path),
        n_rows = nrow(data_raw),
        n_cols = ncol(data_raw),
        multi_groups = multi_groups,
        battery_groups = battery_groups
      )
    ),
    class = "prosecnur_surveymonkey"
  )
}

.sm_as_question_label <- function(row) {
  .sm_first_nonempty(row$label, fallback = row$name_raw)
}

.sm_build_spec <- function(x, lang = "es", paginas = NULL, paginas_labels = NULL) {
  if (!inherits(x, "prosecnur_surveymonkey")) {
    stop("`x` debe ser el resultado de `surveymonkey_leer()`.", call. = FALSE)
  }

  vars_tbl <- x$vars_tbl
  label_sets <- x$label_sets
  used_names <- character(0)
  used_lists <- character(0)
  question_specs <- list()
  multi_specs <- list()
  battery_specs <- list()

  metadata_section <- "survey_monkey_metadata"
  auxiliary_section <- "survey_monkey_auxiliary"
  list_registry_sig <- character(0)
  list_registry_name <- character(0)

  name_candidates <- vars_tbl$name_clean
  idx_other <- which(vars_tbl$kind_guess == "other_text")
  if (length(idx_other)) {
    name_candidates[idx_other] <- vapply(idx_other, function(i) {
      .sm_other_name(vars_tbl$group_guess[i], fallback = vars_tbl$name_clean[i])
    }, character(1))
  }

  vars_tbl$name_final <- NA_character_
  used_final_names <- character(0)
  for (i in seq_len(nrow(vars_tbl))) {
    vars_tbl$name_final[i] <- .sm_unique_name(
      name_candidates[i],
      used = used_final_names,
      suffix = "q"
    )
    used_final_names <- c(used_final_names, vars_tbl$name_final[i])
  }
  vars_tbl$list_name_final <- NA_character_
  vars_tbl$section_final <- ifelse(
    vars_tbl$is_metadata, metadata_section,
    ifelse(vars_tbl$is_auxiliary, auxiliary_section,
    ifelse(vars_tbl$kind_guess %in% c("battery_item", "select_multiple_dummy", "other_text"),
           vars_tbl$group_guess,
           "survey_monkey_main"))
  )

  alloc_choice_list_name <- function(labs, fallback_base) {
    sig <- .sm_choice_signature(labs)
    if (!is.na(sig) && sig %in% list_registry_sig) {
      return(list_registry_name[match(sig, list_registry_sig)])
    }

    base <- .sm_choice_family_base(labs)
    if (is.na(base) || !nzchar(base)) {
      base <- .sm_safe_slug(fallback_base)[1]
    }

    list_name <- .sm_unique_name(paste0("lst_", base), used_lists, suffix = "ln")
    used_lists <<- c(used_lists, list_name)

    if (!is.na(sig) && nzchar(sig)) {
      list_registry_sig <<- c(list_registry_sig, sig)
      list_registry_name <<- c(list_registry_name, list_name)
    }

    list_name
  }

  # -- precompute battery list names ---------------------------------------
  battery_groups <- unique(vars_tbl$group_guess[vars_tbl$kind_guess == "battery_item"])
  for (grp in battery_groups) {
    rows <- vars_tbl[vars_tbl$group_guess == grp & vars_tbl$kind_guess == "battery_item", , drop = FALSE]
    rows <- .sm_sort_group_rows(rows)
    prompt_label <- .sm_prompt_from_labels(rows$label)

    labs <- .sm_or(label_sets[[rows$name_raw[1]]], numeric(0))
    list_name <- alloc_choice_list_name(
      labs = labs,
      fallback_base = grp
    )
    vars_tbl$list_name_final[match(rows$name_raw, vars_tbl$name_raw)] <- list_name
    battery_specs[[grp]] <- list(
      group_name = .sm_unique_name(paste0("grp_", grp), character(0), suffix = "grp"),
      group_label = prompt_label,
      rows = rows,
      list_name = list_name,
      choices = tibble::tibble(
        list_name = list_name,
        name = as.character(unname(labs)),
        `label::es` = as.character(names(labs))
      )
    )
  }

  # -- precompute select_multiple groups -----------------------------------
  multi_groups <- unique(vars_tbl$group_guess[vars_tbl$kind_guess == "select_multiple_dummy"])
  non_multi_names <- vars_tbl$name_final[vars_tbl$kind_guess != "select_multiple_dummy"]
  for (grp in multi_groups) {
    rows <- vars_tbl[vars_tbl$group_guess == grp & vars_tbl$kind_guess == "select_multiple_dummy", , drop = FALSE]
    rows <- .sm_sort_group_rows(rows)
    others <- vars_tbl[vars_tbl$group_guess == grp & vars_tbl$kind_guess == "other_text", , drop = FALSE]

    mother_name <- .sm_unique_name(grp, c(non_multi_names, used_names), suffix = "sm")
    used_names <- c(used_names, mother_name)

    choice_labels <- vapply(seq_len(nrow(rows)), function(i) {
      labs <- .sm_or(label_sets[[rows$name_raw[i]]], numeric(0))
      if (length(labs) >= 1L) {
        as.character(names(labs)[1])
      } else {
        .sm_as_question_label(rows[i, , drop = FALSE])
      }
    }, character(1))
    choice_names <- as.character(rows$suffix)
    choice_names[.sm_is_other_label(choice_labels)] <- "other"
    rows$choice_name <- choice_names
    question_label <- .sm_or(
      .sm_prompt_from_labels(rows$label),
      .sm_mode_nonempty(rows$label, fallback = grp)
    )
    labs_multi <- stats::setNames(choice_names, choice_labels)
    list_name <- alloc_choice_list_name(
      labs = labs_multi,
      fallback_base = grp
    )
    choice_rows <- lapply(seq_len(nrow(rows)), function(i) {
      tibble::tibble(
        list_name = list_name,
        name = choice_names[i],
        `label::es` = choice_labels[i]
      )
    })
    other_value <- if (any(.sm_is_other_label(choice_labels))) "other" else NA_character_

    other_specs <- if (nrow(others)) {
      lapply(seq_len(nrow(others)), function(i) {
        tibble::tibble(
          role = "other_text",
          raw_name = others$name_raw[i],
          name = others$name_final[i],
          label = .sm_infer_other_label(others[i, , drop = FALSE], choice_labels = choice_labels),
          type = "text",
          list_name = NA_character_,
          relevant = .sm_other_relevant(mother_name, other_value),
          section = others$section_final[i],
          order = others$order[i],
          group_guess = grp
        )
      })
    } else {
      list()
    }

    multi_specs[[grp]] <- list(
      mother = tibble::tibble(
        role = "select_multiple",
        raw_name = NA_character_,
        name = mother_name,
        label = question_label,
        type = paste("select_multiple", list_name),
        list_name = list_name,
        relevant = NA_character_,
        section = rows$section_final[1],
        order = min(rows$order),
        group_guess = grp
      ),
      children = rows,
      others = others,
      questions = other_specs,
      choices = dplyr::bind_rows(choice_rows)
    )
  }

  # -- standalone question specs -------------------------------------------
  for (i in seq_len(nrow(vars_tbl))) {
    row <- vars_tbl[i, , drop = FALSE]
    if (row$kind_guess %in% c("select_multiple_dummy", "battery_item")) next
    if (row$kind_guess == "other_text" && row$group_guess %in% names(multi_specs)) next

    q_type <- switch(
      row$kind_guess,
      metadata = row$storage_type_guess,
      select_one = {
        labs <- .sm_or(label_sets[[row$name_raw]], numeric(0))
        list_name <- alloc_choice_list_name(
          labs = labs,
          fallback_base = row$group_guess
        )
        vars_tbl$list_name_final[i] <- list_name
        paste("select_one", list_name)
      },
      integer = "integer",
      decimal = "decimal",
      datetime = "datetime",
      other_text = "text",
      "text"
    )

    q_relevant <- NA_character_
    if (row$kind_guess == "other_text") {
      parent_rows <- vars_tbl[
        vars_tbl$group_guess == row$group_guess &
          vars_tbl$kind_guess == "select_one" &
          vars_tbl$name_raw != row$name_raw,
        ,
        drop = FALSE
      ]
      if (nrow(parent_rows)) {
        parent_rows <- parent_rows[order(parent_rows$order), , drop = FALSE]
        for (j in seq_len(nrow(parent_rows))) {
          parent_raw <- parent_rows$name_raw[j]
          other_value <- .sm_other_choice_value(label_sets[[parent_raw]])
          if (!is.na(other_value) && nzchar(other_value)) {
            q_relevant <- .sm_other_relevant(parent_rows$name_final[j], other_value)
            break
          }
        }
      }
    }

    question_specs[[length(question_specs) + 1L]] <- tibble::tibble(
      role = row$kind_guess,
      raw_name = row$name_raw,
      name = row$name_final,
      label = if (row$kind_guess == "other_text") {
        .sm_infer_other_label_from_group(row, vars_tbl = vars_tbl, label_sets = label_sets)
      } else {
        .sm_as_question_label(row)
      },
      type = q_type,
      list_name = .sm_or(vars_tbl$list_name_final[i], NA_character_),
      relevant = q_relevant,
      section = row$section_final,
      order = row$order,
      group_guess = row$group_guess
    )
  }

  # -- battery items --------------------------------------------------------
  for (grp in names(battery_specs)) {
    rows <- battery_specs[[grp]]$rows
    list_name <- battery_specs[[grp]]$list_name
    for (i in seq_len(nrow(rows))) {
      question_specs[[length(question_specs) + 1L]] <- tibble::tibble(
        role = "battery_item",
        raw_name = rows$name_raw[i],
        name = rows$name_final[i],
        label = .sm_as_question_label(rows[i, , drop = FALSE]),
        type = paste("select_one", list_name),
        list_name = list_name,
        relevant = NA_character_,
        section = rows$section_final[i],
        order = rows$order[i],
        group_guess = grp
      )
    }
  }

  question_specs <- dplyr::bind_rows(question_specs)
  # Si todas las variables del .sav son multi/battery (caso atípico, sin
  # metadata ni standalone), bind_rows devuelve un tibble vacío sin columnas
  # — el join posterior con vars_tbl falla. Aseguramos columnas mínimas.
  if (!nrow(question_specs)) {
    question_specs <- tibble::tibble(
      role = character(0),
      raw_name = character(0),
      name = character(0),
      label = character(0),
      type = character(0),
      list_name = character(0),
      relevant = character(0),
      section = character(0),
      order = integer(0),
      group_guess = character(0)
    )
  }

  # -- choices for standalone select_one -----------------------------------
  choice_parts <- list()
  so_rows <- question_specs[question_specs$role == "select_one", , drop = FALSE]
  if (nrow(so_rows)) {
    for (i in seq_len(nrow(so_rows))) {
      raw_name <- so_rows$raw_name[i]
      labs <- .sm_or(label_sets[[raw_name]], numeric(0))
      if (!length(labs)) next
      choice_parts[[length(choice_parts) + 1L]] <- tibble::tibble(
        list_name = so_rows$list_name[i],
        name = as.character(unname(labs)),
        `label::es` = as.character(names(labs))
      )
    }
  }

  if (length(battery_specs)) {
    choice_parts <- c(choice_parts, lapply(battery_specs, `[[`, "choices"))
  }
  if (length(multi_specs)) {
    choice_parts <- c(choice_parts, lapply(multi_specs, `[[`, "choices"))
  }

  choices <- if (length(choice_parts)) {
    dplyr::bind_rows(choice_parts) |>
      dplyr::distinct(.data$list_name, .data$name, .keep_all = TRUE)
  } else {
    tibble::tibble(list_name = character(), name = character(), `label::es` = character())
  }

  # -- survey rows with begin/end groups -----------------------------------
  survey_rows <- list()
  seen_battery <- character(0)
  seen_multi <- character(0)
  metadata_open <- FALSE
  auxiliary_open <- FALSE

  vars_ordered <- vars_tbl[order(vars_tbl$order), , drop = FALSE]
  metadata_name <- metadata_section
  metadata_label <- "Metadata SurveyMonkey"
  auxiliary_name <- auxiliary_section
  auxiliary_label <- "Variables auxiliares SurveyMonkey"

  # Mapeo nombre_raw → "section_pag_N" según paginas (NA si la pregunta no
  # está mapeada — queda al raíz del survey).
  section_map <- .sm_build_section_map(paginas, vars_ordered)
  current_page_section <- NA_character_

  add_question_by_raw <- function(raw_name) {
    question_specs[question_specs$raw_name == raw_name, , drop = FALSE]
  }

  # Helper: emite begin/end de la sección-página actual cuando cambia.
  # Devuelve filas a anexar a survey_rows (vacío si no hay transición).
  page_section_transition <- function(target_section) {
    out <- list()
    if (identical(target_section, current_page_section)) return(out)
    if (!is.na(current_page_section)) {
      out[[length(out) + 1L]] <- tibble::tibble(
        type = "end_group", name = NA_character_, `label::es` = NA_character_,
        required = NA_character_, relevant = NA_character_,
        constraint = NA_character_, calculation = NA_character_,
        choice_filter = NA_character_, section = current_page_section
      )
    }
    if (!is.na(target_section)) {
      page_id <- sub("^section_pag_", "", target_section)
      page_label <- if (!is.null(paginas_labels) && !is.null(paginas_labels[[page_id]])) {
        .sm_first_nonempty(paginas_labels[[page_id]], fallback = paste("Sección", page_id))
      } else {
        paste("Sección", page_id)
      }
      out[[length(out) + 1L]] <- tibble::tibble(
        type = "begin_group", name = target_section,
        `label::es` = page_label,
        required = NA_character_, relevant = NA_character_,
        constraint = NA_character_, calculation = NA_character_,
        choice_filter = NA_character_, section = target_section
      )
    }
    current_page_section <<- target_section
    out
  }

  for (i in seq_len(nrow(vars_ordered))) {
    row <- vars_ordered[i, , drop = FALSE]

    # Si la fila pertenece a una sección-página, gestionar la transición
    # antes de emitir su contenido. Metadata/auxiliary tienen su propio
    # agrupamiento y nunca van dentro de una página.
    if (!row$is_metadata && !row$is_auxiliary) {
      target_section <- section_map[[row$name_raw]]
      # Para batteries/multi, la primera child determina la sección y todas
      # las demás siguen en la misma; no necesitamos transiciones internas.
      transitions <- page_section_transition(target_section)
      for (tr in transitions) {
        survey_rows[[length(survey_rows) + 1L]] <- tr
      }
    } else {
      # Cerrar sección-página antes de entrar a metadata/auxiliary.
      transitions <- page_section_transition(NA_character_)
      for (tr in transitions) {
        survey_rows[[length(survey_rows) + 1L]] <- tr
      }
    }

    if (row$is_metadata) {
      if (!metadata_open) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "begin_group",
          name = metadata_name,
          `label::es` = metadata_label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = metadata_name
        )
        metadata_open <- TRUE
      }

      survey_rows[[length(survey_rows) + 1L]] <- add_question_by_raw(row$name_raw) |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = .data$relevant,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      next_is_meta <- i < nrow(vars_ordered) && isTRUE(vars_ordered$is_metadata[i + 1L])
      if (!next_is_meta) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "end_group",
          name = NA_character_,
          `label::es` = NA_character_,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = metadata_name
        )
        metadata_open <- FALSE
      }
      next
    }

    if (row$is_auxiliary) {
      if (!auxiliary_open) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "begin_group",
          name = auxiliary_name,
          `label::es` = auxiliary_label,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = auxiliary_name
        )
        auxiliary_open <- TRUE
      }

      survey_rows[[length(survey_rows) + 1L]] <- add_question_by_raw(row$name_raw) |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = .data$relevant,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      next_is_aux <- i < nrow(vars_ordered) && isTRUE(vars_ordered$is_auxiliary[i + 1L])
      if (!next_is_aux) {
        survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
          type = "end_group",
          name = NA_character_,
          `label::es` = NA_character_,
          required = NA_character_,
          relevant = NA_character_,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = auxiliary_name
        )
        auxiliary_open <- FALSE
      }
      next
    }

    if (row$kind_guess == "battery_item") {
      grp <- row$group_guess
      if (grp %in% seen_battery) next

      spec_grp <- battery_specs[[grp]]
      survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
        type = "begin_group",
        name = spec_grp$group_name,
        `label::es` = .sm_or(spec_grp$group_label, NA_character_),
        required = NA_character_,
        relevant = NA_character_,
        constraint = NA_character_,
        calculation = NA_character_,
        choice_filter = NA_character_,
        section = grp
      )

      group_rows <- question_specs[question_specs$group_guess == grp & question_specs$role == "battery_item", , drop = FALSE]
      group_rows <- group_rows[order(group_rows$order), , drop = FALSE]
      survey_rows[[length(survey_rows) + 1L]] <- group_rows |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = .data$relevant,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      survey_rows[[length(survey_rows) + 1L]] <- tibble::tibble(
        type = "end_group",
        name = NA_character_,
        `label::es` = NA_character_,
        required = NA_character_,
        relevant = NA_character_,
        constraint = NA_character_,
        calculation = NA_character_,
        choice_filter = NA_character_,
        section = grp
      )

      seen_battery <- c(seen_battery, grp)
      next
    }

    if (row$kind_guess == "select_multiple_dummy") {
      grp <- row$group_guess
      if (grp %in% seen_multi) next

      spec_grp <- multi_specs[[grp]]
      survey_rows[[length(survey_rows) + 1L]] <- spec_grp$mother |>
        dplyr::transmute(
          type = .data$type,
          name = .data$name,
          `label::es` = .data$label,
          required = NA_character_,
          relevant = .data$relevant,
          constraint = NA_character_,
          calculation = NA_character_,
          choice_filter = NA_character_,
          section = .data$section
        )

      if (length(spec_grp$questions)) {
        survey_rows[[length(survey_rows) + 1L]] <- dplyr::bind_rows(spec_grp$questions) |>
          dplyr::arrange(.data$order) |>
          dplyr::transmute(
            type = .data$type,
            name = .data$name,
            `label::es` = .data$label,
            required = NA_character_,
            relevant = .data$relevant,
            constraint = NA_character_,
            calculation = NA_character_,
            choice_filter = NA_character_,
            section = .data$section
          )
      }

      seen_multi <- c(seen_multi, grp)
      next
    }

    if (row$kind_guess == "other_text" && row$group_guess %in% names(multi_specs)) next

    survey_rows[[length(survey_rows) + 1L]] <- add_question_by_raw(row$name_raw) |>
      dplyr::transmute(
        type = .data$type,
        name = .data$name,
        `label::es` = .data$label,
        required = NA_character_,
        relevant = .data$relevant,
        constraint = NA_character_,
        calculation = NA_character_,
        choice_filter = NA_character_,
        section = .data$section
      )
  }

  # Cerrar la última sección-página si quedó abierta.
  closing <- page_section_transition(NA_character_)
  for (tr in closing) survey_rows[[length(survey_rows) + 1L]] <- tr

  survey <- dplyr::bind_rows(survey_rows)

  settings <- tibble::tibble(
    form_title = paste("SurveyMonkey reference", tools::file_path_sans_ext(x$meta$file_name)),
    form_id = .sm_safe_slug(tools::file_path_sans_ext(x$meta$file_name)),
    default_language = lang,
    version = format(Sys.Date(), "%Y%m%d")
  )

  # Avisos: detecta grupos que parecían candidatos a battery/multi pero
  # fueron descartados por la heurística, para que el usuario vea por qué
  # quedaron sueltos en el survey.
  vars_tbl <- .sm_attach_avisos(vars_tbl)

  diagnostico <- vars_tbl |>
    dplyr::left_join(
      question_specs |>
        dplyr::select(
          "raw_name",
          name_final_ref = "name",
          type_final_ref = "type",
          list_name_final_ref = "list_name"
        ),
      by = c("name_raw" = "raw_name")
    ) |>
    dplyr::mutate(
      name_final = dplyr::coalesce(.data$name_final_ref, .data$name_final, .data$name_clean),
      type_final = dplyr::coalesce(
        .data$type_final_ref,
        ifelse(.data$kind_guess == "select_multiple_dummy", "select_multiple (mother)", .data$storage_type_guess)
      ),
      list_name_final = dplyr::coalesce(.data$list_name_final_ref, .data$list_name_final)
    ) |>
    dplyr::select(
      "order",
      "name_raw",
      "name_clean",
      "name_final",
      "label",
      "kind_guess",
      "storage_type_guess",
      "type_final",
      "list_name_final",
      "section_final",
      "is_metadata",
      "is_auxiliary",
      "is_other",
      "is_question_like",
      "group_guess",
      "n_value_labels",
      "class",
      "aviso_tipo",
      "aviso_mensaje"
    )

  spec_raw <- list(
    survey = survey,
    choices = choices,
    settings = settings,
    diagnostico = diagnostico,
    question_specs = question_specs,
    multi_specs = multi_specs,
    battery_specs = battery_specs
  )

  # Postproceso: renombrar nombres SM (`q0001`, `section_pag_1`) a la
  # convención canónica (`p1`, `Pag1`) y reescribir todas las referencias
  # `${...}` en relevant/constraint/calculation/choice_filter. Persiste el
  # mapping en `spec$name_remap` para que `surveymonkey_data` renombre las
  # columnas de la data SAV correspondientemente.
  .sm_apply_remap_to_spec(spec_raw)
}

#' Leer un export SPSS (.sav) de SurveyMonkey
#'
#' @param path Ruta al archivo `.sav`.
#' @param user_na Si `TRUE`, preserva los user missing de SPSS.
#' @return Objeto clase `prosecnur_surveymonkey`.
#' @family surveymonkey
#' @export
surveymonkey_leer <- function(path, user_na = TRUE) {
  if (!file.exists(path)) {
    stop("No existe el archivo: ", path, call. = FALSE)
  }
  .sm_build_read_object(path = path, user_na = user_na)
}

#' Generar un XLSForm de referencia desde SurveyMonkey
#'
#' @param x Objeto generado por [surveymonkey_leer()].
#' @param path Ruta opcional para escribir el workbook `.xlsx`.
#' @param lang Idioma del XLSForm de referencia.
#' @return Lista clase `prosecnur_surveymonkey_xlsform`.
#' @family surveymonkey
#' @export
surveymonkey_xlsform <- function(x, path = NULL, lang = "es", paginas = NULL, paginas_labels = NULL) {
  spec <- .sm_build_spec(x = x, lang = lang, paginas = paginas, paginas_labels = paginas_labels)

  out <- structure(
    list(
      survey = spec$survey,
      choices = spec$choices,
      settings = spec$settings,
      diagnostico = spec$diagnostico
    ),
    class = "prosecnur_surveymonkey_xlsform"
  )

  if (!is.null(path)) {
    openxlsx::write.xlsx(
      x = list(
        survey = out$survey,
        choices = out$choices,
        settings = out$settings,
        diagnostico = out$diagnostico
      ),
      file = path,
      overwrite = TRUE
    )
  }

  out
}

#' Preparar data de SurveyMonkey para el flujo analítico
#'
#' @param x Objeto generado por [surveymonkey_leer()].
#' @param keep_raw_multi Si `TRUE`, conserva también las columnas dummy crudas
#'   originales tipo `parent_code`.
#' @param keep_metadata Si `TRUE`, conserva las variables técnicas de SurveyMonkey.
#' @return `data.frame` compatible con `reporte_instrumento()` + `reporte_data()`.
#' @family surveymonkey
#' @export
surveymonkey_data <- function(x, keep_raw_multi = FALSE, keep_metadata = TRUE) {
  spec <- .sm_build_spec(x = x, lang = "es")
  df <- x$data_raw
  out <- list()

  question_specs <- spec$question_specs[order(spec$question_specs$order), , drop = FALSE]

  recode_text_select_one <- function(values, labs) {
    if (!(is.character(values) || is.factor(values)) || is.null(labs) || !length(labs)) {
      return(values)
    }

    labels_norm <- .sm_norm_ws(names(labs))
    codes_chr <- as.character(unname(labs))
    map <- stats::setNames(codes_chr, labels_norm)

    values_norm <- .sm_norm_ws(values)
    out_vals <- unname(map[values_norm])
    out_vals[is.na(values_norm) | !nzchar(values_norm)] <- NA_character_
    out_vals[!is.na(values_norm) & nzchar(values_norm) & is.na(out_vals)] <- values_norm[!is.na(values_norm) & nzchar(values_norm) & is.na(out_vals)]
    out_vals
  }

  for (i in seq_len(nrow(question_specs))) {
    row <- question_specs[i, , drop = FALSE]
    row_role <- as.character(row$role[1])

    if (identical(row_role, "metadata") && !isTRUE(keep_metadata)) next

    if (!is.na(row$raw_name) && row$raw_name %in% names(df)) {
      values <- df[[row$raw_name]]
      if (identical(row_role, "select_one")) {
        values <- recode_text_select_one(values, x$label_sets[[row$raw_name]])
      }
      out[[row$name]] <- values
    }
  }

  if (length(spec$multi_specs)) {
    for (grp in names(spec$multi_specs)) {
      msp <- spec$multi_specs[[grp]]
      mother_name <- msp$mother$name[1]
      child_rows <- msp$children[order(msp$children$order), , drop = FALSE]
      codes <- if ("choice_name" %in% names(child_rows)) {
        as.character(child_rows$choice_name)
      } else {
        as.character(child_rows$suffix)
      }

      tokens <- lapply(seq_len(nrow(child_rows)), function(i) {
        sel <- .sm_is_dummy_selected(df[[child_rows$name_raw[i]]])
        ifelse(sel, codes[i], NA_character_)
      })

      token_mat <- do.call(cbind, tokens)
      if (is.null(dim(token_mat))) {
        token_mat <- matrix(token_mat, ncol = 1L)
      }

      mother <- apply(token_mat, 1, function(z) {
        z <- z[!is.na(z) & nzchar(z)]
        if (!length(z)) return(NA_character_)
        paste(z, collapse = " ")
      })
      out[[mother_name]] <- mother

      if (length(msp$questions)) {
        other_questions <- dplyr::bind_rows(msp$questions) |>
          dplyr::arrange(.data$order)
        for (i in seq_len(nrow(other_questions))) {
          out[[other_questions$name[i]]] <- df[[other_questions$raw_name[i]]]
        }
      }

      choice_labels <- msp$choices$`label::es`[match(codes, msp$choices$name)]

      for (i in seq_len(nrow(child_rows))) {
        slash_name <- paste0(mother_name, "/", codes[i])
        out[[slash_name]] <- df[[child_rows$name_raw[i]]]

        lbl_i <- .sm_or(choice_labels[i], .sm_as_question_label(child_rows[i, , drop = FALSE]))
        if (
          grepl("^(otro|otra|other)(\\b|:)", tolower(lbl_i)) &&
            !paste0(mother_name, "/other") %in% names(out)
        ) {
          out[[paste0(mother_name, "/other")]] <- df[[child_rows$name_raw[i]]]
        }
      }

      if (isTRUE(keep_raw_multi)) {
        for (i in seq_len(nrow(child_rows))) {
          out[[child_rows$name_final[i]]] <- df[[child_rows$name_raw[i]]]
        }
      }
    }
  }

  out_df <- as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)

  # Reordenar según el survey generado, conservando extras opcionales al final.
  survey_names <- spec$survey$name[!is.na(spec$survey$name) & nzchar(spec$survey$name)]
  survey_names <- survey_names[survey_names %in% names(out_df)]
  extra_names <- setdiff(names(out_df), survey_names)
  ordered <- character(0)
  for (nm in survey_names) {
    ordered <- c(
      ordered,
      nm,
      extra_names[startsWith(extra_names, paste0(nm, "/"))],
      extra_names[startsWith(extra_names, paste0(nm, "_"))]
    )
  }
  ordered <- unique(c(ordered, setdiff(extra_names, ordered)))
  ordered <- ordered[ordered %in% names(out_df)]
  out_df[, ordered, drop = FALSE]
}
