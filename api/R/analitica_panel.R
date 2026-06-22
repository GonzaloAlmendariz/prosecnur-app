# Motor de Analitica > Base panel.

.panel_scalar <- function(x, fallback = "") {
  if (is.null(x) || length(x) == 0L) return(fallback)
  x <- as.character(x)[1]
  if (is.na(x)) fallback else x
}

.panel_chr <- function(x) {
  if (is.null(x)) return(character(0))
  out <- as.character(unlist(x, use.names = FALSE))
  out[!is.na(out) & nzchar(out)]
}

.panel_bool <- function(x, default = TRUE) {
  if (is.null(x)) return(default)
  isTRUE(x)
}

.panel_slug <- function(x, fallback = "valor") {
  out <- tolower(iconv(.panel_scalar(x, fallback), to = "ASCII//TRANSLIT", sub = ""))
  out <- gsub("[^a-z0-9]+", "_", out)
  out <- gsub("^_+|_+$", "", out)
  if (!nzchar(out)) fallback else out
}

.panel_norm_name <- function(x) {
  out <- tolower(iconv(as.character(x %||% ""), to = "ASCII//TRANSLIT", sub = ""))
  out <- gsub("[^a-z0-9]+", "_", out)
  gsub("^_+|_+$", "", out)
}

.panel_type_base <- function(type) {
  out <- trimws(sub("\\s+.*$", "", as.character(type %||% "")))
  out[is.na(out)] <- ""
  tolower(out)
}

.panel_type_list_name <- function(row) {
  if (is.null(row) || !is.data.frame(row) || !nrow(row)) return("")
  if ("list_name" %in% names(row)) {
    out <- trimws(.panel_scalar(row$list_name[[1]], ""))
    if (nzchar(out)) return(out)
  }
  type <- trimws(.panel_scalar(row$type[[1]], ""))
  parts <- strsplit(type, "\\s+", perl = TRUE)[[1]]
  if (length(parts) >= 2L) parts[[2L]] else ""
}

.panel_survey_row <- function(inst = NULL, var = "") {
  survey <- (inst %||% list())$survey
  if (!is.data.frame(survey) || !"name" %in% names(survey)) return(data.frame())
  idx <- which(as.character(survey$name) == var)[1]
  if (is.na(idx)) return(data.frame())
  survey[idx, , drop = FALSE]
}

.panel_sheet_name <- function(x, existing = character(), fallback = "Hoja") {
  raw <- .panel_scalar(x, fallback)
  raw <- gsub("[][*/?:\\\\]", " ", raw)
  raw <- gsub("[[:space:]]+", " ", trimws(raw))
  if (!nzchar(raw)) raw <- fallback
  raw <- substr(raw, 1L, 31L)
  if (!raw %in% existing) return(raw)
  stem <- substr(raw, 1L, 26L)
  i <- 2L
  repeat {
    candidate <- substr(paste0(stem, " ", i), 1L, 31L)
    if (!candidate %in% existing) return(candidate)
    i <- i + 1L
  }
}

.panel_key_candidates <- function(data_sources) {
  preferred <- c(
    "numero_encuesta", "num_encuesta", "nro_encuesta", "n_encuesta",
    "numero_de_encuesta", "numero", "encuesta", "id_encuesta",
    "codigo_encuesta", "id_persona", "id_panel", "respondent_id",
    "response_id", "id"
  )
  all_cols <- unique(unlist(lapply(data_sources, names), use.names = FALSE))
  if (!length(all_cols)) return(list())
  normalized <- stats::setNames(.panel_norm_name(all_cols), all_cols)
  scores <- data.frame(
    name = all_cols,
    normalized = unname(normalized),
    priority = match(unname(normalized), preferred),
    stringsAsFactors = FALSE
  )
  scores$priority[is.na(scores$priority)] <- 999L
  scores$priority <- ifelse(grepl("encuesta|respondent|persona|panel|id", scores$normalized), scores$priority, 1999L)
  scores <- scores[scores$priority < 1999L, , drop = FALSE]
  scores <- scores[order(scores$priority, scores$normalized), , drop = FALSE]

  out <- list()
  for (nm in scores$name) {
    present <- names(Filter(function(df) nm %in% names(df), data_sources))
    if (length(present) < min(2L, length(data_sources))) next
    per_base <- lapply(names(data_sources), function(base) {
      df <- data_sources[[base]]
      if (!nm %in% names(df)) {
        return(list(base = base, present = FALSE, n = nrow(df), non_missing = 0L, unique = 0L, duplicates = 0L))
      }
      key <- trimws(as.character(df[[nm]]))
      key[is.na(key) | !nzchar(key)] <- NA_character_
      tab <- table(key, useNA = "no")
      list(
        base = base,
        present = TRUE,
        n = nrow(df),
        non_missing = sum(!is.na(key)),
        unique = length(unique(key[!is.na(key)])),
        duplicates = sum(tab > 1L)
      )
    })
    out[[nm]] <- list(
      name = nm,
      normalized = normalized[[nm]],
      recommended = identical(length(out), 0L),
      present_bases = length(present),
      per_base = per_base
    )
  }
  unname(out)
}

.panel_default_waves <- function(data_sources, cfg = NULL) {
  raw <- (cfg %||% list())$waves %||% list()
  by_base <- list()
  if (length(raw)) {
    for (w in raw) {
      base <- .panel_scalar(w$base, "")
      if (nzchar(base)) by_base[[base]] <- w
    }
  }
  idx <- seq_along(data_sources)
  names(idx) <- names(data_sources)
  suffixes <- character(0)
  waves <- lapply(names(data_sources), function(base) {
    existing <- by_base[[base]] %||% list()
    order <- suppressWarnings(as.integer(existing$order %||% idx[[base]]))
    if (is.na(order) || order < 1L) order <- idx[[base]]
    suffix <- .panel_slug(existing$suffix %||% paste0("ola", order), paste0("ola", order))
    if (suffix %in% suffixes) {
      suffix <- make.unique(c(suffixes, suffix), sep = "_")[length(suffixes) + 1L]
    }
    suffixes <<- c(suffixes, suffix)
    label <- .panel_scalar(existing$label %||% paste0("Ola ", order), paste0("Ola ", order))
    utils::modifyList(existing, list(base = base, label = label, suffix = suffix, order = order))
  })
  waves <- waves[order(vapply(waves, function(w) as.integer(w$order %||% 0L), integer(1)))]
  unname(waves)
}

.panel_config_resolve <- function(data_sources, cfg = NULL) {
  cfg <- cfg %||% list()
  candidates <- .panel_key_candidates(data_sources)
  key <- .panel_scalar(cfg$key %||% cfg$panel_key, "")
  if (!nzchar(key) && length(candidates)) key <- candidates[[1]]$name
  list(
    key = key,
    key_label = .panel_scalar(cfg$key_label %||% cfg$label_key, ""),
    date_variable = .panel_scalar(cfg$date_variable %||% cfg$fecha_variable %||% cfg$field_date_variable, ""),
    waves = .panel_default_waves(data_sources, cfg),
    include_codebook = .panel_bool((cfg$outputs %||% list())$codebook, TRUE),
    include_frequencies = .panel_bool((cfg$outputs %||% list())$frecuencias, TRUE),
    include_audit = .panel_bool((cfg$outputs %||% list())$auditoria, TRUE),
    include_cobertura_nse = .panel_bool((cfg$outputs %||% list())$cobertura_nse, TRUE),
    include_nse = .panel_bool((cfg$nse %||% list())$enabled, TRUE),
    nse_variables = .panel_chr((cfg$nse %||% list())$variables),
    candidates = candidates
  )
}

.panel_key_vector <- function(df, key) {
  if (!key %in% names(df)) return(rep(NA_character_, nrow(df)))
  out <- trimws(as.character(df[[key]]))
  out[is.na(out) | !nzchar(out)] <- NA_character_
  out
}

.panel_var_label <- function(data, var, inst = NULL) {
  lab <- attr(data[[var]], "label", exact = TRUE)
  if (!is.null(lab) && length(lab)) return(.panel_scalar(lab, var))
  survey <- (inst %||% list())$survey
  if (is.data.frame(survey) && all(c("name", "label") %in% names(survey))) {
    hit <- which(as.character(survey$name) == var)[1]
    if (!is.na(hit)) return(.panel_scalar(survey$label[[hit]], var))
  }
  var
}

.panel_var_type <- function(inst = NULL, var = "") {
  survey <- (inst %||% list())$survey
  if (!is.data.frame(survey) || !"name" %in% names(survey)) return("")
  hit <- which(as.character(survey$name) == var)[1]
  if (is.na(hit) || !"type" %in% names(survey)) return("")
  .panel_scalar(survey$type[[hit]], "")
}

.panel_analysis_vars <- function(data, inst, key) {
  survey <- (inst %||% list())$survey
  if (is.data.frame(survey) && all(c("name", "type") %in% names(survey))) {
    tb <- .panel_type_base(survey$type)
    names_s <- as.character(survey$name)
    keep <- !is.na(names_s) & nzchar(names_s) &
      !(names_s %in% key) &
      !(tb %in% c("begin_group", "end_group", "begin_repeat", "end_repeat", "note", "calculate"))
    vars <- unique(names_s[keep])
    vars <- vars[vapply(vars, function(v) {
      if (exists(".has_var_or_dummies", mode = "function")) .has_var_or_dummies(data, v) else v %in% names(data)
    }, logical(1))]
    if (length(vars)) return(vars)
  }
  setdiff(names(data), key)
}

.panel_infer_type <- function(x) {
  if (inherits(x, "Date")) return("date")
  if (inherits(x, c("POSIXct", "POSIXt"))) return("datetime")
  if (is.integer(x)) return("integer")
  if (is.numeric(x) || is.logical(x)) return("decimal")
  "text"
}

.panel_choice_rows <- function(inst = NULL, list_name = "", next_list_name = "") {
  list_name <- .panel_scalar(list_name, "")
  next_list_name <- .panel_scalar(next_list_name, list_name)
  choices <- (inst %||% list())$choices
  if (!nzchar(list_name) || !is.data.frame(choices) || !"list_name" %in% names(choices)) {
    return(data.frame())
  }
  rows <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
  if (!nrow(rows)) return(data.frame())
  rows <- as.data.frame(rows, stringsAsFactors = FALSE, check.names = FALSE)
  rows$list_name <- next_list_name
  for (col in intersect(c("list_name", "name", "label"), names(rows))) rows[[col]] <- as.character(rows[[col]])
  rows
}

.panel_choice_rows_from_labels <- function(labs, list_name) {
  if (is.null(labs) || !length(labs)) return(data.frame())
  if (exists(".bases_label_pairs", mode = "function")) {
    pairs <- .bases_label_pairs(labs)
    if (!nrow(pairs)) return(data.frame())
    return(data.frame(
      list_name = list_name,
      name = pairs$code,
      label = pairs$label,
      stringsAsFactors = FALSE
    ))
  }
  values <- as.character(unname(labs))
  labels <- as.character(names(labs) %||% values)
  data.frame(list_name = list_name, name = values, label = labels, stringsAsFactors = FALSE)
}

.panel_append_survey_row <- function(rows, name, type, label = "", list_name = "") {
  rows[[length(rows) + 1L]] <- data.frame(
    type = type,
    name = name,
    label = label,
    list_name = list_name,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  rows
}

.panel_wide_build <- function(data_sources, inst_sources = list(), cfg = NULL) {
  pcfg <- .panel_config_resolve(data_sources, cfg)
  key <- pcfg$key
  if (!nzchar(key)) stop("No se pudo detectar una llave de panel.", call. = FALSE)
  if (length(data_sources) < 2L) stop("Base panel requiere al menos dos bases/olas.", call. = FALSE)
  missing_key <- names(Filter(function(df) !key %in% names(df), data_sources))
  if (length(missing_key)) {
    stop(sprintf("La llave '%s' no existe en: %s.", key, paste(missing_key, collapse = ", ")), call. = FALSE)
  }

  keys_by_wave <- list()
  audit_rows <- list()
  ordered_keys <- character(0)
  for (wave in pcfg$waves) {
    base <- wave$base
    df <- data_sources[[base]]
    kvals <- .panel_key_vector(df, key)
    keys_by_wave[[base]] <- kvals
    ordered_keys <- c(ordered_keys, kvals[!is.na(kvals)])
    missing_n <- sum(is.na(kvals))
    if (missing_n > 0L) {
      audit_rows[[length(audit_rows) + 1L]] <- data.frame(
        tipo = "llave_faltante",
        ola = wave$label,
        base = base,
        numero_encuesta = NA_character_,
        variable = key,
        detalle = sprintf("%s filas no tienen valor de llave en %s.", missing_n, wave$label),
        stringsAsFactors = FALSE
      )
    }
    tab <- table(kvals, useNA = "no")
    dup_keys <- names(tab)[tab > 1L]
    if (length(dup_keys)) {
      for (dk in dup_keys) {
        audit_rows[[length(audit_rows) + 1L]] <- data.frame(
          tipo = "llave_duplicada",
          ola = wave$label,
          base = base,
          numero_encuesta = dk,
          variable = key,
          detalle = sprintf("La llave %s aparece %s veces en %s; la base wide conserva la primera fila y audita el resto.", dk, tab[[dk]], wave$label),
          stringsAsFactors = FALSE
        )
      }
    }
  }
  panel_keys <- unique(ordered_keys)
  wide <- data.frame(panel_key = panel_keys, stringsAsFactors = FALSE, check.names = FALSE)
  names(wide)[1] <- key
  codebook_rows <- list()
  survey_rows <- list()
  choices_rows <- list()
  variables_by_wave <- list()
  survey_rows <- .panel_append_survey_row(survey_rows, key, "text", key, "")

  used_cols <- names(wide)
  for (wave in pcfg$waves) {
    base <- wave$base
    df <- data_sources[[base]]
    inst <- inst_sources[[base]] %||% list()
    kvals <- keys_by_wave[[base]]
    first_idx <- match(panel_keys, kvals)
    present <- !is.na(first_idx)
    wide[[paste0("presente_", wave$suffix)]] <- present
    presente_var <- paste0("presente_", wave$suffix)
    attr(wide[[presente_var]], "label") <- sprintf("Indicador de presencia en %s", wave$label)
    attr(wide[[presente_var]], "labels") <- c(No = 0L, Si = 1L)
    attr(wide[[presente_var]], "measure") <- "nominal"
    survey_rows <- .panel_append_survey_row(
      survey_rows,
      presente_var,
      "select_one panel_si_no",
      sprintf("Indicador de presencia en %s", wave$label),
      "panel_si_no"
    )
    codebook_rows[[length(codebook_rows) + 1L]] <- data.frame(
      variable_panel = presente_var,
      variable_original = "presencia_ola",
      ola = wave$label,
      base = base,
      tipo = "indicator",
      etiqueta = sprintf("Indicador de presencia en %s", wave$label),
      codigo = "",
      etiqueta_codigo = "",
      stringsAsFactors = FALSE
    )
    vars <- setdiff(names(df), key)
    variables_by_wave[[base]] <- vars
    for (var in vars) {
      out_name <- paste0(var, "_", wave$suffix)
      if (out_name %in% used_cols) {
        out_name <- make.unique(c(used_cols, out_name), sep = "_")[length(used_cols) + 1L]
      }
      used_cols <- c(used_cols, out_name)
      vec <- rep(NA, length(panel_keys))
      vec[present] <- df[[var]][first_idx[present]]
      attr(vec, "label") <- sprintf("[%s] %s", wave$label, .panel_var_label(df, var, inst))
      labels <- attr(df[[var]], "labels", exact = TRUE)
      if (!is.null(labels)) attr(vec, "labels") <- labels
      wide[[out_name]] <- vec
      codebook_rows[[length(codebook_rows) + 1L]] <- .panel_codebook_rows(
        variable_panel = out_name,
        variable_original = var,
        ola = wave$label,
        base = base,
        data = df,
        inst = inst
      )
      row <- .panel_survey_row(inst, var)
      base_type <- if (nrow(row)) .panel_type_base(row$type[[1]]) else ""
      list_name <- if (nrow(row)) .panel_type_list_name(row) else ""
      next_type <- if (nzchar(base_type)) base_type else .panel_infer_type(vec)
      next_list <- ""
      if (base_type %in% c("select_one", "select_multiple")) {
        next_list <- .panel_slug(paste0(list_name, "_", wave$suffix), paste0("lista_", wave$suffix))
        next_type <- paste(next_type, next_list)
        choice_rows <- .panel_choice_rows(inst, list_name, next_list)
        if (nrow(choice_rows)) choices_rows[[length(choices_rows) + 1L]] <- choice_rows
      } else {
        labs <- attr(vec, "labels", exact = TRUE)
        if (!is.null(labs) && length(labs)) {
          next_list <- .panel_slug(paste0(var, "_labels_", wave$suffix), paste0("labels_", wave$suffix))
          next_type <- paste("select_one", next_list)
          choice_rows <- .panel_choice_rows_from_labels(labs, next_list)
          if (nrow(choice_rows)) choices_rows[[length(choices_rows) + 1L]] <- choice_rows
        }
      }
      survey_rows <- .panel_append_survey_row(
        survey_rows,
        out_name,
        next_type,
        attr(vec, "label", exact = TRUE) %||% out_name,
        next_list
      )
    }
  }

  for (key_value in panel_keys) {
    missing_waves <- vapply(pcfg$waves, function(wave) {
      !(key_value %in% keys_by_wave[[wave$base]])
    }, logical(1))
    if (any(missing_waves)) {
      labels <- vapply(pcfg$waves[missing_waves], function(w) w$label, character(1))
      audit_rows[[length(audit_rows) + 1L]] <- data.frame(
        tipo = "ola_faltante",
        ola = paste(labels, collapse = ", "),
        base = "",
        numero_encuesta = key_value,
        variable = key,
        detalle = sprintf("La persona %s no aparece en: %s.", key_value, paste(labels, collapse = ", ")),
        stringsAsFactors = FALSE
      )
    }
  }

  common_vars <- Reduce(intersect, variables_by_wave)
  if (length(common_vars)) {
    for (var in common_vars) {
      types <- vapply(pcfg$waves, function(w) .panel_var_type(inst_sources[[w$base]], var), character(1))
      labels <- vapply(pcfg$waves, function(w) .panel_var_label(data_sources[[w$base]], var, inst_sources[[w$base]]), character(1))
      if (length(unique(types[nzchar(types)])) > 1L || length(unique(labels[nzchar(labels)])) > 1L) {
        audit_rows[[length(audit_rows) + 1L]] <- data.frame(
          tipo = "variable_inconsistente",
          ola = "",
          base = paste(vapply(pcfg$waves, `[[`, character(1), "base"), collapse = ", "),
          numero_encuesta = NA_character_,
          variable = var,
          detalle = sprintf("La variable '%s' existe en varias olas, pero cambia tipo o etiqueta. Se conserva separada por sufijo.", var),
          stringsAsFactors = FALSE
        )
      }
    }
  }

  codebook <- if (length(codebook_rows)) dplyr::bind_rows(codebook_rows) else data.frame()
  survey <- if (length(survey_rows)) dplyr::bind_rows(survey_rows) else data.frame()
  choices <- if (length(choices_rows)) dplyr::bind_rows(choices_rows) else data.frame(
    list_name = character(0), name = character(0), label = character(0),
    stringsAsFactors = FALSE
  )
  if (nrow(choices)) choices <- choices[!duplicated(choices[, intersect(c("list_name", "name"), names(choices)), drop = FALSE]), , drop = FALSE]
  if (!any(as.character(choices$list_name %||% character(0)) == "panel_si_no")) {
    choices <- dplyr::bind_rows(
      data.frame(list_name = "panel_si_no", name = c("0", "1"), label = c("No", "Si"), stringsAsFactors = FALSE),
      choices
    )
  }
  inst_wide <- list(
    survey = survey,
    choices = choices,
    choices_raw = choices,
    orders_list = list(),
    var_labels = stats::setNames(
      vapply(wide, function(x) .panel_scalar(attr(x, "label", exact = TRUE), ""), character(1)),
      names(wide)
    ),
    measure_rules = data.frame(
      name = as.character(survey$name %||% character(0)),
      type = as.character(survey$type %||% character(0)),
      list_name = as.character(survey$list_name %||% character(0)),
      measure_sugerida = ifelse(.panel_type_base(survey$type %||% character(0)) %in% c("integer", "decimal", "range"), "scale", "nominal"),
      stringsAsFactors = FALSE
    )
  )
  attr(wide, "instrumento_reporte") <- inst_wide
  audit <- if (length(audit_rows)) dplyr::bind_rows(audit_rows) else data.frame(
    tipo = character(0), ola = character(0), base = character(0),
    numero_encuesta = character(0), variable = character(0), detalle = character(0),
    stringsAsFactors = FALSE
  )
  frequencies <- .panel_frequencies(data_sources, inst_sources, pcfg)
  coverage <- .panel_nse_coverage(wide, pcfg)
  summary <- .panel_summary(data_sources, keys_by_wave, pcfg, wide, audit, coverage)

  list(
    config = pcfg,
    base_wide = wide,
    inst_wide = inst_wide,
    codebook = codebook,
    frequencies = frequencies,
    audit = audit,
    cobertura_nse = coverage,
    summary = summary
  )
}

.panel_codebook_rows <- function(variable_panel, variable_original, ola, base, data, inst = NULL) {
  lab <- .panel_var_label(data, variable_original, inst)
  tipo <- .panel_var_type(inst, variable_original)
  labels <- attr(data[[variable_original]], "labels", exact = TRUE)
  if (!is.null(labels) && length(labels)) {
    data.frame(
      variable_panel = variable_panel,
      variable_original = variable_original,
      ola = ola,
      base = base,
      tipo = tipo,
      etiqueta = lab,
      codigo = as.character(unname(labels)),
      etiqueta_codigo = as.character(names(labels)),
      stringsAsFactors = FALSE
    )
  } else {
    data.frame(
      variable_panel = variable_panel,
      variable_original = variable_original,
      ola = ola,
      base = base,
      tipo = tipo,
      etiqueta = lab,
      codigo = "",
      etiqueta_codigo = "",
      stringsAsFactors = FALSE
    )
  }
}

.panel_frequencies <- function(data_sources, inst_sources = list(), pcfg) {
  rows <- list()
  for (wave in pcfg$waves) {
    data <- data_sources[[wave$base]]
    inst <- inst_sources[[wave$base]] %||% list()
    survey <- (inst %||% list())$survey
    vars <- .panel_analysis_vars(data, inst, pcfg$key)
    for (var in vars) {
      tab <- tryCatch({
        if (exists("freq_table_spss", mode = "function")) {
          freq_table_spss(
            data,
            var,
            survey = survey,
            orders_list = (inst %||% list())$orders_list,
            mostrar_todo = FALSE
          )
        } else {
          v <- as.character(data[[var]])
          v <- v[!is.na(v) & nzchar(v)]
          tt <- sort(table(v), decreasing = TRUE)
          data.frame(Opciones = names(tt), n = as.integer(tt), pct = as.numeric(tt) / max(1L, length(v)), stringsAsFactors = FALSE)
        }
      }, error = function(e) NULL)
      if (is.null(tab) || !nrow(tab)) next
      if (!"pct" %in% names(tab)) tab$pct <- NA_real_
      rows[[length(rows) + 1L]] <- data.frame(
        ola = wave$label,
        base = wave$base,
        variable_panel = paste0(var, "_", wave$suffix),
        variable_original = var,
        pregunta = .panel_var_label(data, var, inst),
        opcion = as.character(tab$Opciones),
        n = suppressWarnings(as.integer(tab$n)),
        pct = suppressWarnings(as.numeric(tab$pct)),
        stringsAsFactors = FALSE
      )
    }
  }
  if (length(rows)) dplyr::bind_rows(rows) else data.frame(
    ola = character(0), base = character(0), variable_panel = character(0),
    variable_original = character(0), pregunta = character(0), opcion = character(0),
    n = integer(0), pct = numeric(0), stringsAsFactors = FALSE
  )
}

.panel_nse_coverage <- function(wide, pcfg) {
  names_norm <- .panel_norm_name(names(wide))
  configured <- .panel_norm_name(pcfg$nse_variables)
  idx <- if (length(configured)) {
    names_norm %in% configured
  } else {
    grepl("(^|_)nse($|_)", names_norm)
  }
  vars <- names(wide)[idx]
  if (!length(vars)) {
    return(data.frame(
      variable_nse = "NSE no cargado",
      casos_con_nse = 0L,
      casos_sin_data = 0L,
      casos_vacios = nrow(wide),
      cobertura = 0,
      observacion = "No se detecto una variable NSE en la base panel. En esta etapa debe agregarse como variable externa antes de exportar.",
      stringsAsFactors = FALSE
    ))
  }
  rows <- lapply(vars, function(v) {
    vals <- trimws(as.character(wide[[v]]))
    vals[is.na(vals)] <- ""
    sin_data <- toupper(vals) == "SIN DATA"
    non_empty <- nzchar(vals)
    data.frame(
      variable_nse = v,
      casos_con_nse = sum(non_empty),
      casos_sin_data = sum(sin_data),
      casos_vacios = sum(!non_empty),
      cobertura = round(sum(non_empty) / max(1L, nrow(wide)), 4),
      observacion = if (any(sin_data)) {
        "'SIN DATA' se mantiene como categoria oficial de la fuente, no como faltante."
      } else {
        "Variable NSE detectada y conservada en la base panel."
      },
      stringsAsFactors = FALSE
    )
  })
  dplyr::bind_rows(rows)
}

.panel_summary <- function(data_sources, keys_by_wave, pcfg, wide, audit, coverage) {
  waves <- lapply(pcfg$waves, function(w) {
    key <- keys_by_wave[[w$base]]
    tab <- table(key, useNA = "no")
    date_info <- NULL
    if (exists(".ficha_tecnica_panel_wave_dates", mode = "function")) {
      date_info <- tryCatch(
        .ficha_tecnica_panel_wave_dates(data_sources[[w$base]], w, pcfg),
        error = function(e) NULL
      )
    }
    list(
      base = w$base,
      label = w$label,
      suffix = w$suffix,
      n_filas = nrow(data_sources[[w$base]]),
      n_llaves = length(unique(key[!is.na(key)])),
      n_llaves_duplicadas = sum(tab > 1L),
      n_llaves_vacias = sum(is.na(key)),
      fecha_variable = .panel_scalar((date_info %||% list())$variable, ""),
      n_fecha_registrada = suppressWarnings(as.integer((date_info %||% list())$n_fecha_registrada %||% NA_integer_)),
      n_fecha_valida = suppressWarnings(as.integer((date_info %||% list())$n_fecha_valida %||% NA_integer_)),
      fecha_rango = .panel_scalar((date_info %||% list())$rango, ""),
      observacion_fecha = .panel_scalar((date_info %||% list())$observacion_fecha, "")
    )
  })
  complete_cols <- paste0("presente_", vapply(pcfg$waves, `[[`, character(1), "suffix"))
  complete <- if (all(complete_cols %in% names(wide))) {
    rowSums(wide[, complete_cols, drop = FALSE]) == length(complete_cols)
  } else {
    rep(FALSE, nrow(wide))
  }
  list(
    ok = TRUE,
    available = length(data_sources) >= 2L && nzchar(pcfg$key),
    key = pcfg$key,
    n_bases = length(data_sources),
    n_panel_keys = nrow(wide),
    n_complete_keys = sum(complete),
    n_incomplete_keys = sum(!complete),
    n_duplicate_keys = sum(audit$tipo == "llave_duplicada", na.rm = TRUE),
    n_audit_rows = nrow(audit),
    nse_detected = !identical(as.character(coverage$variable_nse[[1]] %||% ""), "NSE no cargado"),
    waves = waves
  )
}

.panel_ficha_context <- function(built, data_sources = NULL) {
  list(
    panel = built$config %||% list(),
    summary = built$summary %||% list(),
    data_sources = data_sources %||% list()
  )
}

.panel_ficha_tecnica_with_context <- function(ficha_tecnica, built, data_sources = NULL) {
  if (identical(ficha_tecnica, FALSE)) return(FALSE)
  if (is.null(ficha_tecnica) || isTRUE(ficha_tecnica)) ficha_tecnica <- list()
  if (!is.list(ficha_tecnica)) ficha_tecnica <- list()
  ficha_tecnica$cfg <- ficha_tecnica$cfg %||% list()
  ficha_tecnica$cfg$ficha_tecnica <- ficha_tecnica$cfg$ficha_tecnica %||% list()
  if (is.null(ficha_tecnica$cfg$ficha_tecnica$panel_context)) {
    ficha_tecnica$cfg$ficha_tecnica$panel_context <- .panel_ficha_context(built, data_sources)
  }
  ficha_tecnica
}

.analitica_panel_load_sources <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  cfg <- cfg %||% .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  bases <- (s$estudio %||% list())$bases %||% list()

  if (length(bases) > 0L) {
    data_sources <- list()
    inst_sources <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
      if (is.null(pair) && identical(fuente, "adaptados")) {
        pair <- .analitica_pair_for_base(s, bases[[nombre]], "originales", nombre)
      }
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_PANEL_SOURCE_MISSING",
          sprintf("No se pudo resolver el par XLSForm/Data para la ola '%s'.", nombre))
      }
      parsed <- .analitica_read_pair(pair, bases[[nombre]])
      data_sources[[nombre]] <- parsed$data
      inst_sources[[nombre]] <- parsed$inst
    }
  } else {
    src <- .analitica_fuentes(sid, cfg)
    parsed <- .analitica_read_pair(list(
      xls = list(path = src$inst_path),
      data = src$data_meta
    ), NULL)
    data_sources <- list(default = parsed$data)
    inst_sources <- list(default = parsed$inst)
  }

  if (exists(".bases_normalize_source_contexts", mode = "function")) {
    normalized <- .bases_normalize_source_contexts(data_sources, inst_sources)
    data_sources <- normalized$data_sources
    inst_sources <- normalized$inst_sources
  }
  list(fuente = fuente, data_sources = data_sources, inst_sources = inst_sources)
}

.analitica_panel_read_info_data <- function(pair, base_meta = NULL) {
  dat <- .analitica_read_data_file(pair$data)
  inst <- tryCatch({
    rp_inst <- reporte_instrumento(path = pair$xls$path)
    .analitica_apply_integrated_key(rp_inst, base_meta)
  }, error = function(e) NULL)
  if (!is.null(inst)) {
    dat <- tryCatch(normalize_data_for_xlsform(dat, inst), error = function(e) dat)
    dat <- tryCatch(.analitica_apply_integrated_key_to_data(dat, inst, base_meta), error = function(e) dat)
  }
  as.data.frame(dat, stringsAsFactors = FALSE, check.names = FALSE)
}

.analitica_panel_load_info_sources <- function(sid, cfg = NULL) {
  s <- session_get(sid)
  cfg <- cfg %||% .analitica_get_config(sid)
  fuente <- .analitica_effective_source(s, cfg)
  bases <- (s$estudio %||% list())$bases %||% list()

  if (length(bases) > 0L) {
    data_sources <- list()
    for (nombre in names(bases)) {
      pair <- .analitica_pair_for_base(s, bases[[nombre]], fuente, nombre)
      if (is.null(pair) && identical(fuente, "adaptados")) {
        pair <- .analitica_pair_for_base(s, bases[[nombre]], "originales", nombre)
      }
      if (is.null(pair)) {
        stop_api(409, "E_ANALITICA_PANEL_SOURCE_MISSING",
          sprintf("No se pudo resolver la data para la ola '%s'.", nombre))
      }
      data_sources[[nombre]] <- .analitica_panel_read_info_data(pair, bases[[nombre]])
    }
  } else {
    src <- .analitica_fuentes(sid, cfg)
    data_sources <- list(default = .analitica_panel_read_info_data(list(
      xls = list(path = src$inst_path),
      data = src$data_meta
    ), NULL))
  }
  list(fuente = fuente, data_sources = data_sources)
}

.analitica_panel_info <- function(sid, cfg = NULL) {
  cfg <- cfg %||% .analitica_get_config(sid)
  panel_cfg <- (cfg %||% list())$panel %||% list()
  sources <- tryCatch(.analitica_panel_load_info_sources(sid, cfg), error = function(e) e)
  if (inherits(sources, "error")) {
    return(list(ok = TRUE, available = FALSE, reason = conditionMessage(sources), candidates = list(), waves = list()))
  }
  pcfg <- .panel_config_resolve(sources$data_sources, panel_cfg)
  enough <- length(sources$data_sources) >= 2L
  has_key <- nzchar(pcfg$key) && all(vapply(sources$data_sources, function(df) pcfg$key %in% names(df), logical(1)))
  waves <- lapply(pcfg$waves, function(w) {
    df <- sources$data_sources[[w$base]]
    key <- if (nzchar(pcfg$key) && pcfg$key %in% names(df)) .panel_key_vector(df, pcfg$key) else rep(NA_character_, nrow(df))
    tab <- table(key, useNA = "no")
    list(
      base = w$base,
      label = w$label,
      suffix = w$suffix,
      order = w$order,
      n_filas = nrow(df),
      n_columnas = ncol(df),
      n_llaves = length(unique(key[!is.na(key)])),
      n_llaves_duplicadas = sum(tab > 1L),
      n_llaves_vacias = sum(is.na(key))
    )
  })
  quick_summary <- NULL
  if (has_key) {
    keys_by_wave <- lapply(pcfg$waves, function(w) .panel_key_vector(sources$data_sources[[w$base]], pcfg$key))
    names(keys_by_wave) <- vapply(pcfg$waves, `[[`, character(1), "base")
    panel_keys <- unique(unlist(lapply(keys_by_wave, function(x) x[!is.na(x)]), use.names = FALSE))
    complete <- vapply(panel_keys, function(k) all(vapply(keys_by_wave, function(x) k %in% x, logical(1))), logical(1))
    dup_n <- sum(vapply(keys_by_wave, function(x) {
      tab <- table(x, useNA = "no")
      sum(tab > 1L)
    }, integer(1)))
    quick_summary <- list(
      ok = TRUE,
      available = TRUE,
      key = pcfg$key,
      n_bases = length(sources$data_sources),
      n_panel_keys = length(panel_keys),
      n_complete_keys = sum(complete),
      n_incomplete_keys = sum(!complete),
      n_duplicate_keys = dup_n,
      n_audit_rows = sum(!complete) + dup_n,
      nse_detected = any(grepl("(^|_)nse($|_)", .panel_norm_name(unlist(lapply(sources$data_sources, names), use.names = FALSE)))),
      waves = waves
    )
  }
  list(
    ok = TRUE,
    available = isTRUE(enough && has_key),
    reason = if (!enough) "Base panel requiere al menos dos bases/olas." else if (!has_key) "Selecciona una llave presente en todas las olas." else "",
    key = pcfg$key,
    candidates = pcfg$candidates,
    waves = waves,
    summary = quick_summary,
    n_bases = length(sources$data_sources),
    fuente = sources$fuente
  )
}

.analitica_panel_preview <- function(sid, cfg = NULL, rows = 25L) {
  cfg_all <- .analitica_get_config(sid)
  panel_cfg <- cfg %||% (cfg_all %||% list())$panel %||% list()
  sources <- .analitica_panel_load_sources(sid, cfg_all)
  built <- .panel_wide_build(sources$data_sources, sources$inst_sources, panel_cfg)
  n <- max(1L, min(as.integer(rows %||% 25L), 100L))
  list(
    ok = TRUE,
    summary = built$summary,
    preview = utils::head(built$base_wide, n),
    audit_preview = utils::head(built$audit, n),
    cobertura_nse = built$cobertura_nse,
    columns = names(built$base_wide)
  )
}

.analitica_panel_export <- function(sid, path_xlsx, cfg = NULL, progress = NULL) {
  cfg_all <- .analitica_get_config(sid)
  panel_cfg <- cfg %||% (cfg_all %||% list())$panel %||% list()
  cfg_all$panel <- panel_cfg
  progress <- progress %||% function(...) invisible(NULL)
  progress("loading", percent = 5, message = "Cargando olas del panel...")
  sources <- .analitica_panel_load_sources(sid, cfg_all)
  progress("building", percent = 35, message = "Construyendo base wide y auditoria...")
  built <- .panel_wide_build(sources$data_sources, sources$inst_sources, panel_cfg)
  progress("writing", percent = 75, message = "Escribiendo entregable XLSX...")
  .panel_write_xlsx(built, path_xlsx, ficha_tecnica = list(
    cfg = cfg_all,
    fuente = sources$fuente
  ))
  progress("done", percent = 99, message = "Base panel generada.")
  invisible(built$summary)
}

.panel_export_options <- function(raw = list()) {
  formato <- tolower(.panel_scalar(raw$formato %||% raw$format, "paquete"))
  if (identical(formato, "package")) formato <- "paquete"
  if (!formato %in% c("paquete", "xlsx", "csv", "sav")) formato <- "paquete"
  valores <- .panel_scalar(raw$valores, if (identical(formato, "csv")) "etiquetas" else "ambos")
  if (identical(formato, "csv") && !valores %in% c("codigos", "etiquetas")) valores <- "etiquetas"
  if (!identical(formato, "csv") && !valores %in% c("codigos", "etiquetas", "ambos")) valores <- "ambos"
  multi_select <- .panel_scalar(raw$multi_select, "dummy_01")
  if (!multi_select %in% c("codigos_crudos", "etiquetas_unidas", "dummy_01")) multi_select <- "dummy_01"
  separador <- .panel_scalar(raw$separador, ",")
  if (!separador %in% c(",", ";")) separador <- ","
  list(
    formato = formato,
    valores = valores,
    multi_select = multi_select,
    separador = separador,
    incluir_sps = isTRUE(raw$incluir_sps)
  )
}

.panel_wide_dataset <- function(built, multi_select = "dummy_01") {
  data <- built$base_wide
  inst <- built$inst_wide %||% attr(data, "instrumento_reporte", exact = TRUE) %||% list(survey = data.frame(), choices = data.frame())
  if (isTRUE(identical(multi_select, "dummy_01")) && exists(".expand_multiselect", mode = "function")) {
    data <- .expand_multiselect(data, inst)
  }
  attr(data, "instrumento_reporte") <- inst
  list(data = data, inst = inst)
}

.panel_ficha_spec <- function(defaults, ficha_tecnica = NULL) {
  if (identical(ficha_tecnica, FALSE)) return(FALSE)
  if (is.null(ficha_tecnica) || isTRUE(ficha_tecnica)) return(defaults)
  if (!is.list(ficha_tecnica)) return(defaults)
  utils::modifyList(defaults, ficha_tecnica)
}

.panel_export_wide_xlsx <- function(built, path, valores = "ambos", multi_select = "dummy_01",
                                    ficha_tecnica = NULL) {
  ctx <- .panel_wide_dataset(built, multi_select)
  data <- ctx$data
  inst <- ctx$inst
  if (exists(".aplicar_etiquetas", mode = "function")) {
    df_cod <- .aplicar_etiquetas(data, inst, valores = "codigos", multi_select = multi_select)
    df_lab <- if (identical(valores, "codigos")) df_cod else .aplicar_etiquetas(data, inst, valores = "etiquetas", multi_select = multi_select)
  } else {
    df_cod <- data
    df_lab <- data
  }
  if (exists(".bases_write_xlsx", mode = "function")) {
    return(.bases_write_xlsx(
      df_cod,
      df_lab,
      path,
      valores = valores,
      ficha_tecnica = .panel_ficha_spec(list(
        cfg = list(ficha_tecnica = list(panel_context = .panel_ficha_context(built))),
        reporte = "Base panel wide",
        instrumento = inst,
        detalles = list(
          "Llave panel" = built$config$key,
          "Olas incluidas" = paste(vapply(built$config$waves, function(w) as.character(w$label %||% w$suffix %||% ""), character(1)), collapse = ", "),
          "Tratamiento de select multiple" = multi_select
        )
      ), ficha_tecnica)
    ))
  }
  .analitica_write_plain_xlsx(if (identical(valores, "etiquetas")) df_lab else df_cod, path)
}

.panel_export_wide_csv <- function(built, path, valores = "etiquetas", multi_select = "dummy_01", separador = ",") {
  ctx <- .panel_wide_dataset(built, multi_select)
  data <- ctx$data
  inst <- ctx$inst
  if (exists(".aplicar_etiquetas", mode = "function")) {
    data <- .aplicar_etiquetas(data, inst, valores = valores, multi_select = multi_select)
  }
  if (exists(".bases_write_csv", mode = "function")) {
    return(.bases_write_csv(data, path, separador = separador))
  }
  utils::write.csv(data, path, row.names = FALSE, fileEncoding = "UTF-8")
  path
}

.panel_export_wide_sav <- function(built, path_sav, path_sps = NULL, overrides = list(),
                                   multi_select = "dummy_01") {
  ctx <- .panel_wide_dataset(built, multi_select)
  if (!exists(".bases_export_sav", mode = "function")) {
    stop("El exportador SAV de Bases no esta disponible.", call. = FALSE)
  }
  .bases_export_sav(ctx$data, ctx$inst, path_sav, path_sps = path_sps, overrides = overrides)
  invisible(path_sav)
}

.panel_export_write <- function(built, path, options = list(), overrides = list(), progress = NULL,
                                ficha_tecnica = NULL) {
  options <- .panel_export_options(options)
  progress <- progress %||% function(...) invisible(NULL)
  if (identical(options$formato, "paquete")) {
    progress("writing", percent = 82, message = "Escribiendo base, libro de codigos, frecuencias y auditoria...")
    .panel_write_xlsx(built, path, ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "xlsx")) {
    progress("writing", percent = 82, message = "Escribiendo base panel wide en Excel...")
    .panel_export_wide_xlsx(built, path, valores = options$valores, multi_select = options$multi_select,
                            ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "csv")) {
    progress("writing", percent = 82, message = "Escribiendo base panel wide en CSV...")
    .panel_export_wide_csv(built, path, valores = options$valores, multi_select = options$multi_select, separador = options$separador)
  } else if (identical(options$formato, "sav")) {
    if (isTRUE(options$incluir_sps)) {
      progress("writing", percent = 82, message = "Escribiendo base panel wide en SAV + SPS...")
      stage <- tempfile("panel_sav_stage_")
      dir.create(stage, recursive = TRUE, showWarnings = FALSE)
      on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
      sav_path <- file.path(stage, "base_panel_wide.sav")
      sps_path <- file.path(stage, "niveles_medida.sps")
      .panel_export_wide_sav(built, sav_path, sps_path, overrides = overrides, multi_select = options$multi_select)
      old_wd <- setwd(stage)
      on.exit(setwd(old_wd), add = TRUE)
      zip::zip(path, files = c(basename(sav_path), basename(sps_path)))
      setwd(old_wd)
    } else {
      progress("writing", percent = 82, message = "Escribiendo base panel wide en SAV...")
      .panel_export_wide_sav(built, path, NULL, overrides = overrides, multi_select = options$multi_select)
    }
  }
  invisible(path)
}

.panel_write_xlsx <- function(built, path_xlsx, ficha_tecnica = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para generar base panel.", call. = FALSE)
  }
  wb <- openxlsx::createWorkbook()
  sheets <- character(0)
  add_table <- function(label, df) {
    sheet <- .panel_sheet_name(label, sheets, label)
    sheets <<- c(sheets, sheet)
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df, withFilter = nrow(df) > 0L)
    if (ncol(df) > 0L) {
      openxlsx::freezePane(wb, sheet, firstRow = TRUE)
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
    }
  }
  add_table("base_wide", built$base_wide)
  if (isTRUE(built$config$include_codebook)) add_table("libro_codigos", built$codebook)
  if (isTRUE(built$config$include_frequencies)) add_table("frecuencias", built$frequencies)
  if (isTRUE(built$config$include_audit)) add_table("auditoria_panel", built$audit)
  if (isTRUE(built$config$include_nse) && isTRUE(built$config$include_cobertura_nse)) add_table("cobertura_nse", built$cobertura_nse)
  summary_df <- data.frame(
    campo = names(built$summary)[!names(built$summary) %in% "waves"],
    valor = vapply(built$summary[!names(built$summary) %in% "waves"], function(x) paste(as.character(unlist(x)), collapse = ", "), character(1)),
    stringsAsFactors = FALSE
  )
  add_table("configuracion", summary_df)
  if (exists(".analitica_add_ficha_tecnica_from_spec", mode = "function")) {
    ficha_tecnica <- .panel_ficha_tecnica_with_context(ficha_tecnica, built)
    .analitica_add_ficha_tecnica_from_spec(
      list(
        wb = wb,
        data = built$base_wide,
        instrumento = built$inst_wide %||% attr(built$base_wide, "instrumento_reporte", exact = TRUE),
        reporte = "Paquete de base panel",
        hojas = names(wb),
        detalles = list(
          "Llave panel" = built$config$key,
          "Olas incluidas" = paste(vapply(built$config$waves, function(w) as.character(w$label %||% w$suffix %||% ""), character(1)), collapse = ", "),
          "Personas o llaves panel" = built$summary$n_panel_keys,
          "Casos completos" = built$summary$n_complete_keys
        )
      ),
      ficha_tecnica
    )
  }
  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  invisible(path_xlsx)
}
