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

.panel_public_wave_label <- function(label = "", order = NA_integer_) {
  out <- .panel_scalar(label, "")
  norm <- .panel_norm_name(out)
  norm <- gsub("medici_on", "medicion", norm, fixed = TRUE)
  if (norm %in% c("primera_medicion", "medicion_1", "medicion_01", "ola_1", "ola1")) return("Primera medición")
  if (norm %in% c("segunda_medicion", "medicion_2", "medicion_02", "ola_2", "ola2")) return("Segunda medición")
  if (is.na(out) || !nzchar(out)) {
    order <- suppressWarnings(as.integer(order))
    if (isTRUE(order == 1L)) return("Primera medición")
    if (isTRUE(order == 2L)) return("Segunda medición")
    if (isTRUE(is.finite(order) && order > 0L)) return(paste0("Medición ", order))
    return("Medición")
  }
  if (!is.na(order)) {
    order <- suppressWarnings(as.integer(order))
    if (norm == paste0("medicion_", order)) {
      if (isTRUE(order == 1L)) return("Primera medición")
      if (isTRUE(order == 2L)) return("Segunda medición")
    }
  }
  out
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

.panel_instrument_summary <- function(inst_sources = list(), pcfg = list()) {
  admin_names <- .panel_norm_name(c(
    "num_encuesta", "numero_encuesta", "nro_encuesta",
    "telefono", "telefono_1", "telefono_2", "referencia_esp", "nombres",
    "observaciones", "dir_avenida", "dir_numero", "dir_urb", "direccion",
    "ubigeo", "cod_zona", "cod_manzana", "entrevistador_nombre",
    "fecha_supervision", "supervisor_nombre", "digitador_nombre", "duracion"
  ))
  not_respondent_names <- .panel_norm_name(c(
    "sexo_obs", "sexo_observado", "grupo", "grupo_vigneta", "tratamiento",
    "nse", "nse_asignado", "nse_inei"
  ))
  excluded_types <- c(
    "begin_group", "end_group", "begin_repeat", "end_repeat", "note", "calculate",
    "start", "end", "today", "deviceid", "subscriberid", "phonenumber",
    "simserial", "username", "audit"
  )
  rows <- lapply(pcfg$waves %||% list(), function(wave) {
    inst <- inst_sources[[wave$base]] %||% list()
    survey <- inst$survey %||% data.frame()
    if (!is.data.frame(survey) || !nrow(survey) || !"name" %in% names(survey)) {
      return(NULL)
    }
    type_base <- .panel_type_base(survey$type %||% "")
    names_norm <- .panel_norm_name(survey$name)
    labels_norm <- .panel_norm_name(survey$label %||% "")
    is_item <- !(type_base %in% excluded_types) & nzchar(names_norm)
    is_admin <- is_item & names_norm %in% admin_names
    is_not_respondent <- is_item & (
      names_norm %in% not_respondent_names |
        grepl("para_el_encuestador|por_observacion|observacion_directa|califique_su_percepci|conocimiento.*entrevistado", labels_norm)
    )
    questionnaire <- is_item & !is_admin
    respondent_questions <- questionnaire & !is_not_respondent
    pnum <- suppressWarnings(as.integer(sub("^p([0-9]+).*$", "\\1", names_norm)))
    numbered_questions <- length(unique(pnum[respondent_questions & grepl("^p[0-9]", names_norm) & is.finite(pnum)]))
    reviewed_questions <- suppressWarnings(as.integer(
      wave$preguntas_entrevistado %||% wave$question_count %||% wave$n_preguntas %||% NA_integer_
    ))
    if (!is.finite(reviewed_questions) || reviewed_questions < 0L) reviewed_questions <- NA_integer_
    substantive <- questionnaire & (grepl("^p[0-9]", names_norm) | names_norm %in% c(
      "educacion", "nse", "nse_asignado", "nse_inei", "grupo", "tratamiento"
    ))
    if (!any(substantive)) substantive <- questionnaire
    data.frame(
      base = .panel_scalar(wave$base, ""),
      medicion = .panel_scalar(wave$label, ""),
      items_cuestionario = sum(questionnaire, na.rm = TRUE),
      preguntas_entrevistado = sum(respondent_questions, na.rm = TRUE),
      preguntas_numeradas_entrevistado = numbered_questions,
      preguntas_reportadas = reviewed_questions,
      items_sustantivos = sum(substantive, na.rm = TRUE),
      items_filtro_seguimiento = sum(questionnaire & !substantive, na.rm = TRUE),
      campos_control = sum(is_admin, na.rm = TRUE),
      campos_no_preguntados = sum(is_not_respondent, na.rm = TRUE),
      seleccion_unica = sum(type_base[substantive] == "select_one", na.rm = TRUE),
      seleccion_multiple = sum(type_base[substantive] == "select_multiple", na.rm = TRUE),
      abiertas_o_numericas = sum(type_base[substantive] %in% c("text", "integer", "decimal", "range", "date"), na.rm = TRUE),
      stringsAsFactors = FALSE
    )
  })
  rows <- Filter(Negate(is.null), rows)
  if (length(rows)) dplyr::bind_rows(rows) else data.frame()
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
    raw_suffix <- .panel_scalar(existing$suffix %||% paste0("med", order), paste0("med", order))
    if (grepl("^(ola|met)[0-9]+$", raw_suffix, ignore.case = TRUE)) {
      raw_suffix <- sub("^(ola|met)", "med", raw_suffix, ignore.case = TRUE)
    }
    suffix <- .panel_slug(raw_suffix, paste0("med", order))
    if (suffix %in% suffixes) {
      suffix <- make.unique(c(suffixes, suffix), sep = "_")[length(suffixes) + 1L]
    }
    suffixes <<- c(suffixes, suffix)
    label <- .panel_public_wave_label(existing$label %||% paste0("Medición ", order), order = order)
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
    include_crosses = .panel_bool((cfg$outputs %||% list())$cruces, FALSE),
    include_audit = .panel_bool((cfg$outputs %||% list())$auditoria, TRUE),
    include_cobertura_nse = .panel_bool((cfg$outputs %||% list())$cobertura_nse, TRUE),
    include_nse = .panel_bool((cfg$nse %||% list())$enabled, TRUE),
    nse_variables = .panel_chr((cfg$nse %||% list())$variables),
    cross_vars = cfg$cross_vars %||% cfg$cruces_vars %||% list(),
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

.panel_regex_escape <- function(x) {
  gsub("([][{}()+*^$.|\\\\?])", "\\\\\\1", as.character(x), perl = TRUE)
}

.panel_clean_export_label <- function(label) {
  out <- as.character(label %||% "")
  out <- gsub("^\\[(Primera|Segunda|[0-9]+|Medici[oó]n [0-9]+).*?\\]\\s*", "", out, ignore.case = TRUE, perl = TRUE)
  out <- gsub("\\s*\\((Primera|Segunda) medici[oó]n\\)\\s*$", "", out, ignore.case = TRUE, perl = TRUE)
  trimws(out)
}

.panel_clean_dummy_name <- function(x) {
  base <- gsub("/", ".", x)
  base <- iconv(base, from = "", to = "ASCII//TRANSLIT")
  base <- tolower(base)
  base <- gsub(" ", ".", base)
  base <- gsub("[^a-z0-9._]", "_", base)
  base <- gsub("_+", "_", base)
  base <- gsub("\\.+", ".", base)
  gsub("^[_\\.]+|[_\\.]+$", "", base)
}

.panel_suffix_of <- function(x, suffixes) {
  out <- rep("", length(x))
  for (suffix in suffixes) {
    hit <- grepl(paste0("_", .panel_regex_escape(suffix), "$"), as.character(x), perl = TRUE)
    out[hit] <- suffix
  }
  out
}

.panel_stem_of <- function(x, suffixes) {
  out <- as.character(x)
  for (suffix in suffixes) {
    hit <- grepl(paste0("_", .panel_regex_escape(suffix), "$"), out, perl = TRUE)
    out[hit] <- sub(paste0("_", .panel_regex_escape(suffix), "$"), "", out[hit], perl = TRUE)
  }
  out
}

.panel_pad_numbers <- function(x) {
  vapply(as.character(x), function(s) {
    loc <- gregexpr("[0-9]+", s, perl = TRUE)
    nums <- regmatches(s, loc)[[1]]
    if (!length(nums) || identical(loc[[1]][1], -1L)) return(tolower(s))
    regmatches(s, loc) <- list(sprintf("%05d", suppressWarnings(as.integer(nums))))
    tolower(s)
  }, character(1), USE.NAMES = FALSE)
}

.panel_order_stems <- function(stems) {
  stems <- unique(as.character(stems))
  pre <- c(
    "consentimiento", "vive_vivienda", "dni_habilitado", "sexo_obs",
    "edad", "educacion", "grupo", "tratamiento", "modelo_noticia"
  )
  post <- c(
    "volver_contactar", "telefono", "telefono_1", "telefono_2", "referencia_esp",
    "nombres", "observaciones", "dir_avenida", "dir_numero", "dir_urb",
    "direccion", "ubigeo", "cod_zona", "cod_manzana", "entrevistador_nombre",
    "fecha_supervision", "supervisor_nombre", "digitador_nombre", "duracion"
  )
  pnum <- suppressWarnings(as.integer(sub("^p([0-9]+).*$", "\\1", stems, perl = TRUE)))
  pnum[!grepl("^p[0-9]+", stems)] <- NA_integer_
  pre_rank <- match(stems, pre)
  post_rank <- match(stems, post)
  is_p <- !is.na(pnum)
  group <- ifelse(!is.na(pre_rank), 1L, ifelse(is_p, 2L, ifelse(!is.na(post_rank), 4L, 3L)))
  primary <- ifelse(group == 1L, pre_rank, ifelse(group == 2L, pnum, ifelse(group == 4L, post_rank, 9999L)))
  stems[order(group, primary, .panel_pad_numbers(stems), stems, na.last = TRUE)]
}

# Orden de stems segun la posicion en el survey del instrumento panel (orden del
# XLSForm). El heuristico previo (.panel_order_stems) colocaba las variables no
# numeradas ni listadas en un balde alfabetico, enterrando preguntas hechas
# temprano (p.ej. bloques M/E/A del ACNUR o metadata Kobo) muy adelante o muy
# atras. Aqui priorizamos la posicion real de cada variable en el survey y solo
# caemos al heuristico como desempate para las que no existan en el survey.
.panel_order_stems_by_survey <- function(stems, survey_names, suffixes) {
  stems <- unique(as.character(stems))
  if (!length(stems)) return(stems)
  survey_names <- as.character(survey_names %||% character(0))
  if (!length(survey_names)) return(.panel_order_stems(stems))
  survey_stems <- .panel_stem_of(survey_names, suffixes)
  pos <- match(stems, survey_stems)                 # primera aparicion = orden XLSForm
  fallback <- match(stems, .panel_order_stems(stems))
  big <- length(stems) + 1L
  primary <- ifelse(is.na(pos), big + fallback, pos)
  stems[order(primary, fallback)]
}

.panel_dummy_label_overrides <- function(inst_sources = list(), pcfg = list()) {
  out <- character(0)
  for (wave in pcfg$waves %||% list()) {
    inst <- inst_sources[[wave$base]] %||% list()
    survey <- inst$survey %||% data.frame()
    choices <- inst$choices %||% data.frame()
    if (!is.data.frame(survey) || !nrow(survey) || !all(c("type", "name", "label") %in% names(survey))) next
    if (!is.data.frame(choices) || !nrow(choices) || !all(c("list_name", "name", "label") %in% names(choices))) next
    sm_rows <- survey[grepl("^select_multiple\\b", as.character(survey$type %||% ""), perl = TRUE), , drop = FALSE]
    if (!nrow(sm_rows)) next
    for (i in seq_len(nrow(sm_rows))) {
      parent <- as.character(sm_rows$name[[i]] %||% "")
      question <- .panel_clean_export_label(sm_rows$label[[i]] %||% "")
      list_name <- .panel_type_list_name(sm_rows[i, , drop = FALSE])
      if (!nzchar(parent) || !nzchar(question) || !nzchar(list_name)) next
      opts <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
      if (!nrow(opts)) next
      for (j in seq_len(nrow(opts))) {
        code <- as.character(opts$name[[j]] %||% "")
        option <- .panel_clean_export_label(opts$label[[j]] %||% "")
        if (!nzchar(code) || !nzchar(option)) next
        panel_name <- paste0(.panel_clean_dummy_name(paste0(parent, "/", code)), "_", wave$suffix)
        out[[panel_name]] <- paste0(question, " = ", option)
      }
    }
  }
  out
}

.panel_finalize_wide_build <- function(built, inst_sources = list()) {
  pcfg <- built$config %||% list()
  suffixes <- vapply(pcfg$waves %||% list(), function(w) .panel_scalar(w$suffix, ""), character(1))
  suffixes <- suffixes[nzchar(suffixes)]
  if (!length(suffixes) || !is.data.frame(built$base_wide)) return(built)
  wave_labels <- stats::setNames(
    vapply(pcfg$waves %||% list(), function(w) .panel_public_wave_label(w$label, w$order %||% NA_integer_), character(1)),
    suffixes
  )
  dummy_overrides <- .panel_dummy_label_overrides(inst_sources, pcfg)
  technical_stems <- c("presente")
  external_vars <- intersect(unique(c(
    pcfg$nse_variables %||% character(0),
    "nse_atribuido_inei", "nse_codigo_inei", "manzana_usada_nse",
    "tipo_nse", "inferencia_nse"
  )), names(built$base_wide))

  panel_label <- function(label, suffix, variable = "") {
    stem <- .panel_stem_of(variable, suffixes)
    meas <- wave_labels[[suffix]] %||% suffix
    base <- .panel_clean_export_label(label)
    override <- if (variable %in% names(dummy_overrides)) dummy_overrides[[variable]] else ""
    if (nzchar(override)) base <- override
    if (identical(stem, "presente")) return(paste0("Indicador de presencia en ", meas))
    if (!nzchar(base)) base <- variable
    paste0(base, " (", meas, ")")
  }

  names_bw <- names(built$base_wide)
  suffixed <- names_bw[nzchar(.panel_suffix_of(names_bw, suffixes))]
  for (nm in suffixed) {
    sfx <- .panel_suffix_of(nm, suffixes)
    attr(built$base_wide[[nm]], "label") <- panel_label(attr(built$base_wide[[nm]], "label", exact = TRUE), sfx, nm)
  }

  key_col <- pcfg$key
  # Posicion en el survey del instrumento panel ANTES de reordenarlo (linea ~534):
  # en este punto sigue el orden de construccion (orden de columnas de la data =
  # orden del XLSForm), que es el que debe mandar en el libro de codigos.
  survey_names_pre <- if (is.data.frame(built$inst_wide$survey) && "name" %in% names(built$inst_wide$survey)) {
    as.character(built$inst_wide$survey$name)
  } else {
    character(0)
  }
  technical_cols <- suffixed[.panel_stem_of(suffixed, suffixes) %in% technical_stems]
  content_cols <- setdiff(suffixed, technical_cols)
  ordered_content <- unlist(lapply(.panel_order_stems_by_survey(.panel_stem_of(content_cols, suffixes), survey_names_pre, suffixes), function(stem) {
    intersect(paste0(stem, "_", suffixes), content_cols)
  }), use.names = FALSE)
  ordered_technical <- unlist(lapply(.panel_order_stems_by_survey(.panel_stem_of(technical_cols, suffixes), survey_names_pre, suffixes), function(stem) {
    intersect(paste0(stem, "_", suffixes), technical_cols)
  }), use.names = FALSE)
  # El balde restante (columnas no clasificadas como content/technical/external) se
  # ordena tambien por posicion en el survey; las que no existan en el survey
  # conservan su orden actual y quedan al final (na.last).
  rest_cols <- setdiff(names_bw, c(key_col, ordered_content, external_vars, ordered_technical))
  rest_pos <- match(rest_cols, survey_names_pre)
  rest_cols <- rest_cols[order(rest_pos, seq_along(rest_cols), na.last = TRUE)]
  final_cols <- c(
    key_col,
    ordered_content,
    external_vars,
    ordered_technical,
    rest_cols
  )
  final_cols <- final_cols[nzchar(final_cols) & final_cols %in% names_bw]
  built$base_wide <- built$base_wide[, final_cols, drop = FALSE]
  var_order <- stats::setNames(seq_along(final_cols), final_cols)
  sort_by_panel_order <- function(df, var_col) {
    if (!is.data.frame(df) || !nrow(df) || !var_col %in% names(df)) return(df)
    ord <- var_order[as.character(df[[var_col]])]
    ord[is.na(ord)] <- length(var_order) + seq_len(sum(is.na(ord)))
    df[order(ord, seq_len(nrow(df))), , drop = FALSE]
  }

  if (is.data.frame(built$inst_wide$survey) && nrow(built$inst_wide$survey) && "name" %in% names(built$inst_wide$survey)) {
    for (i in seq_len(nrow(built$inst_wide$survey))) {
      nm <- as.character(built$inst_wide$survey$name[[i]] %||% "")
      sfx <- .panel_suffix_of(nm, suffixes)
      if (nzchar(sfx) && "label" %in% names(built$inst_wide$survey)) {
        built$inst_wide$survey$label[[i]] <- panel_label(built$inst_wide$survey$label[[i]], sfx, nm)
      }
    }
    built$inst_wide$survey <- sort_by_panel_order(built$inst_wide$survey, "name")
  }
  if (is.data.frame(built$inst_wide$measure_rules) && nrow(built$inst_wide$measure_rules) && "name" %in% names(built$inst_wide$measure_rules)) {
    built$inst_wide$measure_rules <- sort_by_panel_order(built$inst_wide$measure_rules, "name")
  }
  built$inst_wide$var_labels <- stats::setNames(
    vapply(built$base_wide, function(x) .panel_scalar(attr(x, "label", exact = TRUE), ""), character(1)),
    names(built$base_wide)
  )

  if (is.data.frame(built$codebook) && nrow(built$codebook) && "variable_panel" %in% names(built$codebook)) {
    for (i in seq_len(nrow(built$codebook))) {
      nm <- as.character(built$codebook$variable_panel[[i]] %||% "")
      sfx <- .panel_suffix_of(nm, suffixes)
      if (nzchar(sfx) && "etiqueta" %in% names(built$codebook)) {
        built$codebook$etiqueta[[i]] <- panel_label(built$codebook$etiqueta[[i]], sfx, nm)
      }
    }
    built$codebook <- sort_by_panel_order(built$codebook, "variable_panel")
  }
  if (is.data.frame(built$frequencies) && nrow(built$frequencies) && "variable_panel" %in% names(built$frequencies)) {
    for (i in seq_len(nrow(built$frequencies))) {
      nm <- as.character(built$frequencies$variable_panel[[i]] %||% "")
      sfx <- .panel_suffix_of(nm, suffixes)
      if (nzchar(sfx) && "pregunta" %in% names(built$frequencies)) {
        built$frequencies$pregunta[[i]] <- panel_label(built$frequencies$pregunta[[i]], sfx, nm)
      }
    }
    built$frequencies <- sort_by_panel_order(built$frequencies, "variable_panel")
  }

  attr(built$base_wide, "instrumento_reporte") <- built$inst_wide
  built
}

.panel_wide_build <- function(data_sources, inst_sources = list(), cfg = NULL) {
  pcfg <- .panel_config_resolve(data_sources, cfg)
  key <- pcfg$key
  if (!nzchar(key)) stop("No se pudo detectar una llave de panel.", call. = FALSE)
  if (length(data_sources) < 2L) stop("Base panel requiere al menos dos bases/mediciones.", call. = FALSE)
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
      variable_original = "presencia_medicion",
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
        tipo = "medicion_faltante",
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
          detalle = sprintf("La variable '%s' existe en varias mediciones, pero cambia tipo o etiqueta. Se conserva separada por sufijo.", var),
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
  # DETALLE CRITICO (listas ordinales en los entregables del panel):
  # `inst_wide` historicamente NO llevaba `dicc_code_to_label`, asi que
  # `.orden_categorias_ordinal_auto` (que lee justo ese campo) no podia
  # auto-detectar likert sobre el instrumento panel — solo funcionaba el
  # override manual, y ademas el panel renombra cada lista con un sufijo de
  # medicion (`likert_o1`, `likert_o2`). Construimos el diccionario desde las
  # `choices` YA sufijadas para que la auto-deteccion devuelva los `list_name`
  # sufijados EXACTOS que el motor de frecuencias/cruces matchea por variable
  # via `get_list_name(v, survey)`.
  dicc_maps <- .bases_dicc_maps_from_choices(choices)
  inst_wide <- list(
    survey = survey,
    choices = choices,
    choices_raw = choices,
    orders_list = list(),
    dicc_code_to_label = dicc_maps$code_to_label,
    dicc_label_to_code = dicc_maps$label_to_code,
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
  summary$instrumentos <- .panel_instrument_summary(inst_sources, pcfg)

  built <- list(
    config = pcfg,
    base_wide = wide,
    inst_wide = inst_wide,
    codebook = codebook,
    frequencies = frequencies,
    audit = audit,
    cobertura_nse = coverage,
    summary = summary
  )
  .panel_finalize_wide_build(built, inst_sources)
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
          sprintf("No se pudo resolver el par XLSForm/Data para la medición '%s'.", nombre))
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
          sprintf("No se pudo resolver la data para la medición '%s'.", nombre))
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
    reason = if (!enough) "Base panel requiere al menos dos bases/mediciones." else if (!has_key) "Selecciona una llave presente en todas las mediciones." else "",
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
  progress("loading", percent = 5, message = "Cargando mediciones del panel...")
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
  if (formato %in% c("codebook", "libro", "libro-codigos", "libro_codigos")) formato <- "libro_codigos"
  if (formato %in% c("frequency", "frequencies", "freq", "frecuencia")) formato <- "frecuencias"
  if (formato %in% c("cross", "crosstabs", "tablas_cruzadas", "tabla_cruces")) formato <- "cruces"
  if (formato %in% c("audit", "auditorias")) formato <- "auditoria"
  if (!formato %in% c("paquete", "xlsx", "csv", "sav", "libro_codigos", "frecuencias", "cruces", "auditoria")) formato <- "paquete"
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

.panel_embed_ficha_xlsx <- function(ficha_tecnica = NULL) {
  if (identical(ficha_tecnica, FALSE) || is.null(ficha_tecnica)) return(FALSE)
  if (isTRUE(ficha_tecnica)) return(TRUE)
  if (!is.list(ficha_tecnica)) return(FALSE)
  cfg_ft <- ((ficha_tecnica$cfg %||% list())$ficha_tecnica %||% list())
  direct_ft <- ficha_tecnica$ficha_tecnica %||% list()
  flags <- c(
    ficha_tecnica$adjuntar_a_xlsx,
    ficha_tecnica$incluir_en_xlsx,
    ficha_tecnica$incluir_en_entregable,
    cfg_ft$adjuntar_a_xlsx,
    cfg_ft$incluir_en_xlsx,
    cfg_ft$incluir_en_entregable,
    direct_ft$adjuntar_a_xlsx,
    direct_ft$incluir_en_xlsx,
    direct_ft$incluir_en_entregable
  )
  any(vapply(flags, isTRUE, logical(1)))
}

.panel_ficha_spec_if_embedded <- function(defaults, ficha_tecnica = NULL) {
  if (.panel_embed_ficha_xlsx(ficha_tecnica)) .panel_ficha_spec(defaults, ficha_tecnica) else FALSE
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
      ficha_tecnica = .panel_ficha_spec_if_embedded(list(
        cfg = list(ficha_tecnica = list(panel_context = .panel_ficha_context(built))),
        reporte = "Base panel wide",
        instrumento = inst,
        detalles = list(
          "Llave panel" = built$config$key,
          "Mediciones incluidas" = paste(vapply(built$config$waves, function(w) as.character(w$label %||% w$suffix %||% ""), character(1)), collapse = ", "),
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

.panel_cfg_from_ficha <- function(ficha_tecnica = NULL) {
  if (is.list(ficha_tecnica) && is.list(ficha_tecnica$cfg)) return(ficha_tecnica$cfg)
  list()
}

.panel_as_chr_vec <- function(x) {
  if (exists(".as_chr_vec", mode = "function")) return(.as_chr_vec(x))
  .panel_chr(x)
}

.panel_as_int_vec <- function(x) {
  out <- suppressWarnings(as.integer(.panel_as_chr_vec(x)))
  out[is.finite(out)]
}

.panel_report_context <- function(built) {
  data <- built$base_wide
  inst <- built$inst_wide %||% attr(data, "instrumento_reporte", exact = TRUE) %||% list(survey = data.frame(), choices = data.frame())
  if (exists(".bases_normalize_other_selects", mode = "function")) {
    data <- .bases_normalize_other_selects(data, inst)
  }
  attr(data, "instrumento_reporte") <- inst
  list(data = data, inst = inst)
}

.panel_report_numericas <- function(cfg = list()) {
  if (exists(".analitica_declared_numericas", mode = "function")) {
    return(.analitica_declared_numericas(cfg, override_frecuencias = TRUE))
  }
  .panel_as_chr_vec((cfg$frecuencias %||% list())$numericas_override %||% cfg$numericas)
}

.panel_report_codebook_codes <- function(cfg = list()) {
  out <- .panel_as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)
  if (length(out)) out else NULL
}

.panel_report_frequency_codes <- function(cfg = list()) {
  fc <- cfg$frecuencias %||% list()
  out <- .panel_as_int_vec(fc$codigos_solo_si_presentes)
  if (!length(out)) out <- .panel_as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)
  if (length(out)) out else NULL
}

.panel_allowed_report_vars <- function(data, inst, numericas = character(0)) {
  vars <- character(0)
  if (exists(".analitica_allowed_vars", mode = "function")) {
    vars <- .analitica_allowed_vars(inst, numericas)
  }
  if (!length(vars)) {
    survey <- inst$survey %||% data.frame()
    if (is.data.frame(survey) && "name" %in% names(survey)) {
      types <- if ("type" %in% names(survey)) .panel_type_base(survey$type) else rep("", nrow(survey))
      names_s <- as.character(survey$name)
      keep <- types %in% c("select_one", "select_multiple") |
        (types %in% c("integer", "decimal") & names_s %in% .panel_as_chr_vec(numericas))
      vars <- unique(as.character(survey$name[keep]))
    }
  }
  vars <- intersect(vars, names(data))
  vars[!is.na(vars) & nzchar(vars)]
}

.panel_report_sections_from_wide <- function(built, data, inst, numericas = character(0),
                                             excluidas = character(0), drop_vars = character(0)) {
  suffixes <- .panel_measurement_suffixes(built)
  labels <- .panel_measurement_labels(built)
  vars <- .panel_allowed_report_vars(data, inst, numericas)
  if (!length(vars)) vars <- names(data)
  key <- .panel_scalar(built$config$key, "numero_encuesta")
  vars <- setdiff(vars, unique(c(key, grep("^presente_", names(data), value = TRUE), excluidas, drop_vars)))
  vars <- vars[vars %in% names(data)]
  out <- list()
  if (length(suffixes)) {
    for (suffix in suffixes) {
      hit <- vars[.panel_suffix_of(vars, suffixes) == suffix]
      hit <- hit[!is.na(hit) & nzchar(hit)]
      if (length(hit)) out[[labels[[suffix]] %||% suffix]] <- unique(hit)
    }
  }
  external <- vars[!nzchar(.panel_suffix_of(vars, suffixes))]
  external <- external[!is.na(external) & nzchar(external)]
  if (length(external)) out[["Variables externas"]] <- unique(external)
  if (!length(out) && length(vars)) out[["Base panel"]] <- unique(vars)
  out
}

.panel_report_sections <- function(built, data, inst, cfg = list(), numericas = character(0),
                                   excluidas = character(0), drop_vars = character(0)) {
  secs <- NULL
  fc <- cfg$frecuencias %||% list()
  if (exists(".secciones_from_config", mode = "function")) {
    activas <- .panel_as_chr_vec(fc$secciones_activas)
    secs <- .secciones_from_config(cfg, activas_filter = if (length(activas)) activas else NULL)
  }
  if (exists(".analitica_filter_sections", mode = "function")) {
    secs <- tryCatch(
      .analitica_filter_sections(secs, inst, numericas, excluidas),
      error = function(e) NULL
    )
  }
  if (exists(".analitica_append_missing_select_multiple_sections", mode = "function")) {
    secs <- tryCatch(
      .analitica_append_missing_select_multiple_sections(secs, inst, numericas, excluidas),
      error = function(e) secs
    )
  }
  clean <- function(x) {
    if (is.null(x) || !is.list(x) || !length(x)) return(NULL)
    x <- lapply(x, function(vars) {
      vars <- intersect(unique(as.character(vars)), names(data))
      setdiff(vars[!is.na(vars) & nzchar(vars)], drop_vars)
    })
    x <- x[vapply(x, length, integer(1)) > 0L]
    if (length(x)) x else NULL
  }
  secs <- clean(secs)
  if (is.null(secs)) secs <- .panel_report_sections_from_wide(built, data, inst, numericas, excluidas, drop_vars)
  clean(secs)
}

.panel_report_cross_vars <- function(built, data, cfg = list()) {
  defs <- .panel_cross_var_defs(built)
  vars <- unique(vapply(defs, function(x) as.character(x$name %||% ""), character(1)))
  vars <- vars[!is.na(vars) & nzchar(vars)]
  if (!length(vars)) {
    raw <- (cfg$cruces %||% list())$cruces_vars
    if (exists(".cruces_vars_parse", mode = "function")) {
      vars <- names(.cruces_vars_parse(raw))
    } else {
      vars <- .panel_as_chr_vec(raw)
    }
  }
  if (!length(vars)) {
    candidates <- c(
      "sexo_obs_med1", "sexo_med1", "sexo_observado_med1", "sexo_obs", "sexo",
      "nse_atribuido_inei", "nse_inei_med1", "nse_med1", "nse_inei", "nse",
      "distrito_panel", "distrito_med1", "distrito", "ubigeo_med1", "ubigeo"
    )
    vars <- intersect(candidates, names(data))
  }
  unique(vars[vars %in% names(data)])
}

.panel_identifier_exclusions <- function(cols, key = "num_encuesta") {
  cols <- as.character(cols %||% character(0))
  key <- .panel_scalar(key, "num_encuesta")
  allowed <- unique(c(
    key, "num_encuesta", "numero_encuesta",
    "distrito_panel", "distrito_med1", "distrito_med2", "distrito",
    "nse_atribuido_inei", "nse_inei_med1", "nse_inei_med2", "nse_med1", "nse_med2",
    "sexo_obs_med1", "sexo_obs_med2", "sexo_med1", "sexo_med2"
  ))
  rx <- paste(c(
    "telefono", "celular", "whatsapp", "(^|_)fono($|_)",
    "nombres?", "apellidos?", "dni",
    "^consentimiento(_|$)", "^presente(_|$)",
    "referencia", "^dir_", "direccion", "direcci[oó]n", "avenida", "calle", "jiron", "jir[oó]n",
    "observaciones?",
    "ubigeo", "cod_zona", "(^|_)zona(_|$)", "cod_manzana", "(^|_)manzana(_|$)",
    "entrevistador", "encuestador", "supervisor", "digitador",
    "gps", "latitud", "longitud", "coordenada",
    "correo", "email", "contacto",
    "inferencia_nse", "tipo_nse", "nse_codigo", "distrito_fuente"
  ), collapse = "|")
  out <- cols[grepl(rx, cols, ignore.case = TRUE, perl = TRUE)]
  setdiff(unique(out), allowed)
}

.panel_public_sanitize_values <- function(x) {
  if (is.factor(x)) x <- as.character(x)
  if (!is.character(x)) return(x)
  out <- x
  out[grepl("^\\s*Ubigeo sin nombre oficial", out, ignore.case = TRUE)] <- "Distrito no identificado"
  out[grepl("^\\s*Sin ubigeo en Datos de control", out, ignore.case = TRUE)] <- "Distrito no identificado"
  labels <- attr(out, "labels", exact = TRUE)
  if (!is.null(labels)) {
    label_names <- names(labels)
    if (!is.null(label_names)) names(labels) <- .panel_public_sanitize_values(label_names)
    if (is.character(labels)) labels <- .panel_public_sanitize_values(labels)
    attr(out, "labels") <- labels
  }
  label <- attr(out, "label", exact = TRUE)
  if (!is.null(label)) attr(out, "label") <- .panel_public_sanitize_values(as.character(label))
  out
}

.panel_public_sanitize_frame <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return(df)
  for (col in names(df)) df[[col]] <- .panel_public_sanitize_values(df[[col]])
  df
}

.panel_anonymize_built <- function(built, cfg = list()) {
  if (!is.list(built) || !is.data.frame(built$base_wide)) return(built)
  key <- .panel_scalar((built$config %||% list())$key, "num_encuesta")
  explicit <- .panel_as_chr_vec((cfg$panel %||% list())$privacy$excluir_variables %||% cfg$variables_privadas)
  drop <- unique(c(.panel_identifier_exclusions(names(built$base_wide), key), explicit))
  drop <- setdiff(drop, key)
  drop <- intersect(drop, names(built$base_wide))
  if (!length(drop)) return(built)

  built$base_wide <- built$base_wide[, setdiff(names(built$base_wide), drop), drop = FALSE]
  built$base_wide <- .panel_public_sanitize_frame(built$base_wide)

  if (is.list(built$inst_wide) && is.data.frame(built$inst_wide$survey) && "name" %in% names(built$inst_wide$survey)) {
    built$inst_wide$survey <- built$inst_wide$survey[!(as.character(built$inst_wide$survey$name) %in% drop), , drop = FALSE]
  }
  if (is.list(built$inst_wide)) {
    if (is.data.frame(built$inst_wide$survey)) built$inst_wide$survey <- .panel_public_sanitize_frame(built$inst_wide$survey)
    if (is.data.frame(built$inst_wide$choices)) built$inst_wide$choices <- .panel_public_sanitize_frame(built$inst_wide$choices)
  }

  filter_frame <- function(df) {
    if (!is.data.frame(df) || !nrow(df)) return(df)
    keep <- rep(TRUE, nrow(df))
    for (col in intersect(c("variable", "variable_panel", "variable_original", "name"), names(df))) {
      vals <- as.character(df[[col]])
      keep <- keep & !(vals %in% drop)
      stems <- .panel_stem_of(vals, .panel_measurement_suffixes(built))
      keep <- keep & !(stems %in% .panel_stem_of(drop, .panel_measurement_suffixes(built)))
    }
    df[keep, , drop = FALSE]
  }

  built$codebook <- .panel_public_sanitize_frame(filter_frame(built$codebook))
  built$frequencies <- .panel_public_sanitize_frame(filter_frame(built$frequencies))
  built$audit <- .panel_public_sanitize_frame(filter_frame(built$audit))
  built$cobertura_nse <- .panel_public_sanitize_frame(built$cobertura_nse)
  built$config$privacy_excluded_vars <- drop
  built
}

.panel_package_ficha <- function(built, inst, ficha_tecnica = NULL, reporte = "Base panel") {
  .panel_ficha_spec(list(
    cfg = list(ficha_tecnica = list(panel_context = .panel_ficha_context(built))),
    reporte = reporte,
    instrumento = inst,
    detalles = list(
      "Llave panel" = built$config$key,
      "Mediciones incluidas" = paste(vapply(built$config$waves, function(w) {
        as.character(w$label %||% w$suffix %||% "")
      }, character(1)), collapse = ", "),
      "Personas o llaves panel" = built$summary$n_panel_keys,
      "Casos completos" = built$summary$n_complete_keys
    )
  ), ficha_tecnica)
}

.panel_write_named_tables_xlsx <- function(path, tables) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para generar XLSX panel.", call. = FALSE)
  }
  wb <- openxlsx::createWorkbook()
  used <- character(0)
  add_table <- function(label, df) {
    sheet <- .panel_sheet_name(label, used, label)
    used <<- c(used, sheet)
    df <- as.data.frame(df %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df, withFilter = nrow(df) > 0L)
    if (ncol(df) > 0L) {
      header <- openxlsx::createStyle(
        textDecoration = "bold", fgFill = "#0B2B63", fontColour = "#FFFFFF",
        halign = "center", valign = "center", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#93A4BD"
      )
      body <- openxlsx::createStyle(
        valign = "top", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#D9E2F2"
      )
      pct <- openxlsx::createStyle(
        numFmt = "0.0%", valign = "top", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#D9E2F2"
      )
      openxlsx::addStyle(wb, sheet, header, rows = 1L, cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      if (nrow(df) > 0L) {
        openxlsx::addStyle(wb, sheet, body, rows = 2:(nrow(df) + 1L), cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      }
      pct_cols <- grep("^%|porcentaje|dentro del cruce", names(df), ignore.case = TRUE)
      if (length(pct_cols) && nrow(df) > 0L) {
        openxlsx::addStyle(wb, sheet, pct, rows = 2:(nrow(df) + 1L), cols = pct_cols, gridExpand = TRUE, stack = TRUE)
      }
      widths <- vapply(seq_len(ncol(df)), function(j) {
        if (!nzchar(trimws(names(df)[j]))) return(3)
        vals <- as.character(c(names(df)[j], utils::head(df[[j]], 250)))
        vals[is.na(vals)] <- ""
        max(nchar(vals), na.rm = TRUE) + 2
      }, numeric(1))
      widths <- pmin(pmax(widths, 8), 62)
      widths[!nzchar(trimws(names(df)))] <- 3
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = widths)
      openxlsx::freezePane(wb, sheet, firstRow = TRUE)
      if (nrow(df) > 0L) {
        row_ids <- seq_len(min(nrow(df), 500L))
        heights <- vapply(row_ids, function(i) {
          vals <- as.character(df[i, , drop = TRUE])
          vals[is.na(vals)] <- ""
          max(18, min(80, 16 + max(nchar(vals), na.rm = TRUE) / 70 * 10))
        }, numeric(1))
        openxlsx::setRowHeights(wb, sheet, rows = row_ids + 1L, heights = heights)
      }
    }
  }
  for (nm in names(tables)) add_table(nm, tables[[nm]])
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

.panel_codebook_value_labels <- function(df, v, ord = NULL, codigos_cond_chr = character(0)) {
  filter_codes <- function(codes, labels) {
    if (!length(codes)) return(list(codes = codes, labels = labels))
    if (!length(codigos_cond_chr) || !(v %in% names(df))) {
      return(list(codes = codes, labels = labels))
    }
    used_codes <- unique(as.character(df[[v]]))
    used_codes <- used_codes[!is.na(used_codes) & nzchar(used_codes)]
    keep <- !(codes %in% codigos_cond_chr & !(codes %in% used_codes))
    list(codes = codes[keep], labels = labels[keep])
  }

  inst <- attr(df, "instrumento_reporte", exact = TRUE)
  survey <- (inst %||% list())$survey
  choices <- (inst %||% list())$choices
  if (is.data.frame(survey) && is.data.frame(choices) &&
      all(c("name", "type") %in% names(survey)) &&
      all(c("list_name", "name", "label") %in% names(choices))) {
    row <- survey[as.character(survey$name) == v, , drop = FALSE]
    if (nrow(row)) {
      list_name <- .panel_type_list_name(row[1, , drop = FALSE])
      if (nzchar(list_name)) {
        ch <- choices[as.character(choices$list_name) == list_name, , drop = FALSE]
        if (nrow(ch)) {
          codes <- trimws(as.character(ch$name))
          labels <- trimws(as.character(ch$label))
          labels[is.na(labels) | !nzchar(labels)] <- codes[is.na(labels) | !nzchar(labels)]
          flt <- filter_codes(codes, labels)
          if (length(flt$codes)) return(flt)
        }
      }
    }
  }

  lab_attr <- attr(df[[v]], "labels", exact = TRUE)
  if (!is.null(lab_attr) && length(lab_attr)) {
    mapped <- if (exists(".labels_attr_to_codes_labels", mode = "function")) {
      .labels_attr_to_codes_labels(lab_attr, observed = df[[v]])
    } else {
      list(codes = as.character(names(lab_attr)), labels = as.character(unname(lab_attr)))
    }
    codes <- trimws(as.character(mapped$codes))
    labels <- trimws(as.character(mapped$labels))
    flt <- filter_codes(codes, labels)
    if (!length(flt$codes)) return(NULL)
    return(flt)
  }

  if (!is.null(ord) && !is.null(ord[[v]])) {
    ordv <- ord[[v]]
    if (!is.null(ordv$labels) && !is.null(ordv$names)) {
      codes <- trimws(as.character(ordv$names))
      labels <- trimws(as.character(ordv$labels))
      flt <- filter_codes(codes, labels)
      if (!length(flt$codes)) return(NULL)
      return(flt)
    }
  }

  NULL
}

.panel_export_codebook_parallel_xlsx <- function(data, path, built, cfg = list(), ficha_tecnica = NULL) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para generar el codebook.", call. = FALSE)
  }
  ord <- attr(data, "instrumento_reporte", exact = TRUE)$orders_list %||% NULL
  codigos_cond_chr <- as.character(.panel_report_codebook_codes(cfg) %||% character(0))
  suffixes <- .panel_measurement_suffixes(built)
  waves <- built$config$waves %||% list()
  suffix_order <- vapply(waves, function(w) .panel_scalar(w$suffix, ""), character(1))
  suffix_order <- suffix_order[nzchar(suffix_order)]
  if (!length(suffix_order)) suffix_order <- suffixes

  has_value_labels <- vapply(names(data), function(v) {
    !is.null(.panel_codebook_value_labels(data, v, ord = ord, codigos_cond_chr = codigos_cond_chr))
  }, logical(1))
  vars_to_write <- names(data)[has_value_labels]
  if (!length(vars_to_write)) {
    stop("No se encontraron variables con value-labels ni entradas en `ord`.", call. = FALSE)
  }

  wb <- openxlsx::createWorkbook()
  sheet <- "Codebook"
  openxlsx::addWorksheet(wb, sheet)
  # Fondo blanco en TODO el documento apagando las gridlines (reemplaza el canvas
  # acotado a cols 1:max_col, que dejaba gridlines a la derecha del ultimo bloque).
  pulso_xlsx_hide_gridlines(wb, sheet)

  block_width <- 3L
  gap_width <- 1L
  n_blocks <- max(1L, length(suffix_order))
  max_col <- n_blocks * block_width + max(0L, n_blocks - 1L) * gap_width

  # Estilos del tema monocromo editorial unico (ver api/R/xlsx_theme.R).
  .st <- pulso_xlsx_styles("codebook")
  st_varname  <- .st$st_varname
  st_val_row  <- .st$st_val_row
  st_attr_lbl <- .st$st_attr_lbl
  st_vals     <- .st$st_vals
  st_btm      <- .st$st_btm

  start_col_for <- function(suffix) {
    idx <- match(suffix, suffix_order)
    if (is.na(idx)) idx <- 1L
    as.integer(1L + (idx - 1L) * (block_width + gap_width))
  }

  get_var_label <- function(v) {
    vl <- attr(data[[v]], "label", exact = TRUE)
    if (!is.null(vl) && length(vl)) return(as.character(vl))
    if (!is.null(ord) && !is.null(ord[[v]]) && !is.null(ord[[v]]$var_label)) return(as.character(ord[[v]]$var_label))
    NA_character_
  }

  write_block <- function(v, row0, col0) {
    vl <- .panel_codebook_value_labels(data, v, ord = ord, codigos_cond_chr = codigos_cond_chr)
    if (is.null(vl)) return(0L)
    codes <- trimws(as.character(vl$codes))
    labels <- trimws(as.character(vl$labels))
    n <- length(codes)
    if (!n) return(0L)
    varlabel <- get_var_label(v)

    openxlsx::writeData(wb, sheet, x = v, startCol = col0, startRow = row0, colNames = FALSE)
    openxlsx::addStyle(wb, sheet, st_varname, rows = row0, cols = col0:(col0 + 2L), gridExpand = TRUE)

    openxlsx::writeData(wb, sheet, x = "Valor", startCol = col0 + 2L, startRow = row0 + 1L, colNames = FALSE)
    openxlsx::addStyle(wb, sheet, st_val_row, rows = row0 + 1L, cols = col0:(col0 + 2L), gridExpand = TRUE)

    openxlsx::writeData(wb, sheet, x = "Atributos estándar", startCol = col0, startRow = row0 + 2L, colNames = FALSE)
    openxlsx::writeData(wb, sheet, x = "Etiqueta", startCol = col0 + 1L, startRow = row0 + 2L, colNames = FALSE)
    openxlsx::writeData(wb, sheet, x = ifelse(is.na(varlabel), "", varlabel), startCol = col0 + 2L, startRow = row0 + 2L, colNames = FALSE)
    openxlsx::addStyle(wb, sheet, st_attr_lbl, rows = row0 + 2L, cols = col0:(col0 + 2L), gridExpand = TRUE)

    vals_start <- row0 + 3L
    vals_end <- vals_start + n - 1L
    openxlsx::mergeCells(wb, sheet, cols = col0, rows = vals_start:vals_end)
    openxlsx::writeData(wb, sheet, x = "Valores válidos", startCol = col0, startRow = vals_start, colNames = FALSE)
    openxlsx::writeData(wb, sheet, x = codes, startCol = col0 + 1L, startRow = vals_start, colNames = FALSE)
    openxlsx::writeData(wb, sheet, x = labels, startCol = col0 + 2L, startRow = vals_start, colNames = FALSE)
    openxlsx::addStyle(wb, sheet, st_vals, rows = vals_start:vals_end, cols = col0:(col0 + 2L), gridExpand = TRUE)
    # cuadro del bloque (marco exterior definido)
    pulso_xlsx_box(wb, sheet, r1 = row0, r2 = vals_end, c1 = col0, c2 = col0 + 2L)

    3L + n
  }

  stems <- .panel_stem_of(vars_to_write, suffixes)
  stem_order <- unique(stems)
  cur_row <- 1L
  for (stem in stem_order) {
    vars <- vars_to_write[stems == stem]
    heights <- integer(0)
    for (v in vars) {
      sfx <- .panel_suffix_of(v, suffixes)
      col0 <- if (nzchar(sfx)) start_col_for(sfx) else 1L
      heights <- c(heights, write_block(v, cur_row, col0))
    }
    block_height <- max(heights, na.rm = TRUE)
    if (!is.finite(block_height) || block_height <= 0L) block_height <- 1L
    cur_row <- cur_row + block_height + 2L
  }

  for (idx in seq_len(n_blocks)) {
    col0 <- 1L + (idx - 1L) * (block_width + gap_width)
    openxlsx::setColWidths(wb, sheet, cols = col0, widths = 18)
    openxlsx::setColWidths(wb, sheet, cols = col0 + 1L, widths = 12)
    openxlsx::setColWidths(wb, sheet, cols = col0 + 2L, widths = 55)
    if (idx < n_blocks) openxlsx::setColWidths(wb, sheet, cols = col0 + 3L, widths = 4)
  }

  if (.panel_embed_ficha_xlsx(ficha_tecnica) && exists(".analitica_add_ficha_tecnica_from_spec", mode = "function")) {
    .analitica_add_ficha_tecnica_from_spec(
      list(
        wb = wb,
        data = data,
        instrumento = attr(data, "instrumento_reporte", exact = TRUE),
        reporte = "Libro de codigos panel",
        hojas = names(wb),
        detalles = list(
          "Politica de codigos especiales" = if (length(codigos_cond_chr)) paste(codigos_cond_chr, collapse = ", ") else "No configurada"
        )
      ),
      ficha_tecnica
    )
  }

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  if (exists("pulso_xlsx_ignore_number_warnings", mode = "function")) pulso_xlsx_ignore_number_warnings(path)
  message("Codebook guardado en: ", normalizePath(path, winslash = "/"))
  invisible(normalizePath(path, winslash = "/"))
}

.panel_write_package_audit_xlsx <- function(built, path_xlsx) {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para generar auditorias panel.", call. = FALSE)
  }
  wb <- openxlsx::createWorkbook()
  sheets <- character(0)
  add_table <- function(label, df) {
    sheet <- .panel_sheet_name(label, sheets, label)
    sheets <<- c(sheets, sheet)
    df <- as.data.frame(df %||% data.frame(), stringsAsFactors = FALSE, check.names = FALSE)
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df, withFilter = nrow(df) > 0L)
    if (ncol(df) > 0L) {
      header <- openxlsx::createStyle(
        textDecoration = "bold", fgFill = "#0B2B63", fontColour = "#FFFFFF",
        halign = "center", valign = "center", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#93A4BD"
      )
      body <- openxlsx::createStyle(
        valign = "top", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#D9E2F2"
      )
      openxlsx::addStyle(wb, sheet, header, rows = 1L, cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      if (nrow(df) > 0L) {
        openxlsx::addStyle(wb, sheet, body, rows = 2:(nrow(df) + 1L), cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      }
      openxlsx::freezePane(wb, sheet, firstRow = TRUE)
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = "auto")
    }
  }
  add_table("auditoria_panel", .panel_public_table(built$audit))
  if (isTRUE(built$config$include_nse) && isTRUE(built$config$include_cobertura_nse)) {
    add_table("cobertura_nse", built$cobertura_nse)
  }
  if (isTRUE(built$config$include_frequencies)) {
    add_table("cruces_longitudinales", .panel_transition_tables(built))
  }
  summary_df <- data.frame(
    Campo = names(built$summary)[!names(built$summary) %in% "waves"],
    Valor = vapply(built$summary[!names(built$summary) %in% "waves"], function(x) paste(as.character(unlist(x)), collapse = ", "), character(1)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  add_table("configuracion", summary_df)
  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  invisible(path_xlsx)
}

.panel_zip_files <- function(path_zip, files, root) {
  if (file.exists(path_zip)) unlink(path_zip)
  if (requireNamespace("zip", quietly = TRUE)) {
    zip::zip(zipfile = path_zip, files = files, root = root, mode = "cherry-pick")
  } else {
    old_wd <- setwd(root)
    on.exit(setwd(old_wd), add = TRUE)
    utils::zip(zipfile = path_zip, files = files)
  }
  invisible(path_zip)
}

.panel_export_codebook_xlsx <- function(built, path, ficha_tecnica = NULL) {
  cfg <- .panel_cfg_from_ficha(ficha_tecnica)
  ctx <- .panel_report_context(built)
  # El libro de codigos es un entregable en si mismo: NO embebe la ficha tecnica
  # (que tiene su propio boton "Generar ficha tecnica"). Pasamos ficha_tecnica =
  # FALSE al escritor para no colar una 2a hoja "tras bambalinas", pero
  # conservamos `cfg` para la politica de codigos especiales del codebook. Los
  # demas formatos (xlsx base, frecuencias, cruces, auditoria) no cambian.
  .panel_export_codebook_parallel_xlsx(ctx$data, path, built, cfg = cfg, ficha_tecnica = FALSE)
  invisible(path)
}

# Libro de codigos en PDF A4 (dos columnas, cabecera + pie con logo Pulso).
# titulo/subtitulo se toman de cfg$codebook$titulo_pdf/subtitulo_pdf si existen.
.panel_export_codebook_pdf <- function(built, path, ficha_tecnica = NULL) {
  if (!exists("reporte_codebook_pdf", mode = "function")) {
    stop("El generador de libro de codigos PDF no esta disponible.", call. = FALSE)
  }
  cfg <- .panel_cfg_from_ficha(ficha_tecnica)
  ctx <- .panel_report_context(built)
  cb <- cfg$codebook %||% list()
  reporte_codebook_pdf(
    ctx$data, path,
    titulo = .panel_scalar(cb$titulo_pdf, "LIBRO DE CODIGOS"),
    subtitulo = .panel_scalar(cb$subtitulo_pdf, ""),
    ord = (attr(ctx$data, "instrumento_reporte", exact = TRUE) %||% list())$orders_list,
    codigos_solo_si_presentes = .panel_report_codebook_codes(cfg),
    periodo = .panel_scalar(cb$periodo_pdf, ""),
    incluir_indice = FALSE  # el libro de codigos va directo al contenido, sin indice
  )
  invisible(path)
}

.panel_export_frequencies_xlsx <- function(built, path, ficha_tecnica = NULL) {
  if (!exists("reporte_frecuencias", mode = "function")) {
    stop("El generador estandar de frecuencias no esta disponible.", call. = FALSE)
  }
  cfg <- .panel_cfg_from_ficha(ficha_tecnica)
  ctx <- .panel_report_context(built)
  fc <- cfg$frecuencias %||% list()
  numericas <- .panel_report_numericas(cfg)
  excluidas <- setdiff(.panel_as_chr_vec(cfg$variables_excluidas), .panel_scalar(built$config$key, "numero_encuesta"))
  sections <- .panel_report_sections(built, ctx$data, ctx$inst, cfg, numericas, excluidas)
  if (is.null(sections) || !length(sections)) {
    stop("No hay variables analizables para generar frecuencias panel.", call. = FALSE)
  }
  ficha <- if (.panel_embed_ficha_xlsx(ficha_tecnica)) .panel_package_ficha(built, ctx$inst, ficha_tecnica, reporte = "Frecuencias panel") else FALSE
  # Listas ordinales EFECTIVAS del instrumento panel (override manual del
  # analista ∪ auto-deteccion likert). Fuerzan "original" por variable ordinal
  # aunque `orden` global sea desc/asc — igual que la ruta estandar.
  ordinal_lists <- .orden_categorias_ordinal_set(ctx$inst, cfg)
  reporte_frecuencias(
    ctx$data,
    instrumento = ctx$inst,
    secciones = sections,
    path_xlsx = path,
    orden = .panel_scalar(fc$orden, "desc"),
    mostrar_todo = isTRUE(fc$mostrar_todo),
    codigos_solo_si_presentes = .panel_report_frequency_codes(cfg),
    numericas = numericas,
    incluir_titulos = !identical(fc$incluir_titulos, FALSE),
    incluir_secciones = !identical(fc$incluir_secciones, FALSE),
    ordinal_lists = ordinal_lists,
    ficha_tecnica = ficha
  )
  invisible(path)
}

.panel_cross_exclusion_map <- function(built) {
  defs <- .panel_cross_var_defs(built)
  out <- list()
  for (nm in names(defs)) {
    def <- defs[[nm]]
    var <- .panel_scalar(def$name, "")
    if (!nzchar(var)) next
    excl <- .panel_as_chr_vec(def$exclude_levels %||% def$excluidas %||% def$excluir_categorias %||% def$omit_levels %||% def$omitir_categorias)
    out[[var]] <- excl
  }
  out
}

.panel_filter_cross_rows <- function(data, exclusion_map) {
  if (!is.data.frame(data) || !nrow(data) || !length(exclusion_map)) return(data)
  keep <- rep(TRUE, nrow(data))
  for (nm in names(exclusion_map)) {
    excl <- .panel_as_chr_vec(exclusion_map[[nm]])
    if (!length(excl) || !(nm %in% names(data))) next
    norm_excl <- toupper(trimws(excl))
    raw_chr <- trimws(as.character(data[[nm]]))
    raw_vals <- toupper(raw_chr)
    labelled_chr <- raw_chr
    lab_attr <- attr(data[[nm]], "labels", exact = TRUE)
    if (!is.null(lab_attr) && length(lab_attr)) {
      mapped <- if (exists(".labels_attr_to_codes_labels", mode = "function")) {
        .labels_attr_to_codes_labels(lab_attr, observed = data[[nm]])
      } else {
        list(codes = as.character(names(lab_attr)), labels = as.character(unname(lab_attr)))
      }
      if (length(mapped$codes) && length(mapped$labels)) {
        value_map <- stats::setNames(as.character(mapped$labels), as.character(mapped$codes))
        hit <- match(raw_chr, names(value_map))
        labelled_chr[!is.na(hit)] <- unname(value_map[hit[!is.na(hit)]])
      }
    }
    labelled_vals <- toupper(trimws(labelled_chr))
    keep <- keep & !(raw_vals %in% norm_excl | labelled_vals %in% norm_excl)
  }
  if (all(keep)) return(data)
  out <- data[keep, , drop = FALSE]
  for (nm in setdiff(names(attributes(data)), c("names", "row.names", "class"))) {
    attr(out, nm) <- attr(data, nm)
  }
  out
}

.panel_export_crosses_xlsx <- function(built, path, ficha_tecnica = NULL) {
  if (!exists("reporte_cruces", mode = "function")) {
    stop("El generador estandar de cruces no esta disponible.", call. = FALSE)
  }
  cfg <- .panel_cfg_from_ficha(ficha_tecnica)
  ctx <- .panel_report_context(built)
  data <- ctx$data
  if (!length(.panel_cross_var_defs(built))) {
    cross_vars <- .panel_report_cross_vars(built, data, cfg)
    built$config$cross_vars <- stats::setNames(lapply(cross_vars, function(v) {
      list(name = v, label = attr(data[[v]], "label", exact = TRUE) %||% v)
    }), vapply(cross_vars, function(v) .panel_slug(v, "cruce"), character(1)))
  }
  cross_vars <- .panel_report_cross_vars(built, data, cfg)
  if (!length(cross_vars)) {
    stop("Configura al menos una variable de cruce para generar cruces panel.", call. = FALSE)
  }
  cr <- cfg$cruces %||% list()
  numericas <- .panel_report_numericas(cfg)
  excluidas <- setdiff(.panel_as_chr_vec(cfg$variables_excluidas), .panel_scalar(built$config$key, "numero_encuesta"))
  cross_sections <- .panel_report_sections(built, data, ctx$inst, cfg, numericas, excluidas, drop_vars = cross_vars)
  if (is.null(cross_sections) || !length(cross_sections)) {
    stop("No hay variables analizables para generar cruces panel.", call. = FALSE)
  }
  exclusion_map <- .panel_cross_exclusion_map(built)
  data <- .panel_filter_cross_rows(data, exclusion_map)
  attr(data, "instrumento_reporte") <- ctx$inst
  opciones_excluir <- unique(.panel_as_chr_vec(unlist(exclusion_map, use.names = FALSE)))
  ficha <- if (.panel_embed_ficha_xlsx(ficha_tecnica)) .panel_package_ficha(built, ctx$inst, ficha_tecnica, reporte = "Cruces panel") else FALSE
  # Orden de cruces elegido por el analista (mismo default/validacion que la
  # ruta estandar) + listas ordinales efectivas para que las variables likert
  # queden en su orden fijo aunque el orden global sea desc/asc.
  orden_cruces <- as.character(cr$orden %||% "original")
  if (!orden_cruces %in% c("desc", "asc", "original")) orden_cruces <- "original"
  ordinal_lists <- .orden_categorias_ordinal_set(ctx$inst, cfg)
  reporte_cruces(
    data = data,
    instrumento = ctx$inst,
    SECCIONES = cross_sections,
    cruces = cross_vars,
    modo = "estandar",
    path_xlsx = path,
    show_sig = isTRUE(cr$show_sig),
    alpha = suppressWarnings(as.numeric(cr$alpha %||% 0.05)),
    codigos_solo_si_presentes = .panel_report_frequency_codes(cfg),
    numericas = numericas,
    opciones_excluir = opciones_excluir,
    orden = orden_cruces,
    ordinal_lists = ordinal_lists,
    incluir_total = !identical(cr$incluir_total, FALSE),
    incluir_titulos = !identical(cr$incluir_titulos, FALSE),
    incluir_secciones = !identical(cr$incluir_secciones, FALSE),
    brecha_filas = isTRUE(cr$brecha_filas),
    brecha_cols = isTRUE(cr$brecha_cols),
    aplicar_semaforo = isTRUE(cr$aplicar_semaforo),
    ficha_tecnica = ficha
  )
  invisible(path)
}

.panel_export_audit_xlsx <- function(built, path, ficha_tecnica = NULL) {
  .panel_write_package_audit_xlsx(built, path)
  invisible(path)
}

.panel_write_standard_package_zip <- function(built, path_zip, options = list(), overrides = list(),
                                              progress = NULL, ficha_tecnica = NULL) {
  if (is.null(progress)) progress <- function(...) invisible(NULL)
  cfg <- .panel_cfg_from_ficha(ficha_tecnica)
  ctx <- .panel_report_context(built)
  data_report <- ctx$data
  inst <- ctx$inst
  ficha <- if (.panel_embed_ficha_xlsx(ficha_tecnica)) .panel_package_ficha(built, inst, ficha_tecnica, reporte = "Paquete de base panel") else FALSE
  stage <- tempfile("panel_package_stage_")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)

  panel_formats <- (cfg$panel %||% list())$formatos %||% list()
  xlsx_opts <- panel_formats$xlsx %||% list()
  csv_opts <- panel_formats$csv %||% list()
  sav_opts <- panel_formats$sav %||% list()
  files <- character(0)
  add_file <- function(path) {
    files <<- c(files, basename(path))
    invisible(path)
  }

  progress("writing", percent = 70, message = "Generando base panel con los exportadores de Bases...")
  base_xlsx <- file.path(stage, "01_base_panel_wide.xlsx")
  .panel_export_wide_xlsx(
    built,
    base_xlsx,
    valores = .panel_scalar(xlsx_opts$valores, "ambos"),
    multi_select = .panel_scalar(xlsx_opts$multi_select, "dummy_01"),
    ficha_tecnica = ficha
  )
  add_file(base_xlsx)

  base_csv <- file.path(stage, "01_base_panel_wide.csv")
  .panel_export_wide_csv(
    built,
    base_csv,
    valores = .panel_scalar(csv_opts$valores, "etiquetas"),
    multi_select = .panel_scalar(csv_opts$multi_select, "dummy_01"),
    separador = .panel_scalar(csv_opts$separador, ",")
  )
  add_file(base_csv)

  base_sav <- file.path(stage, "01_base_panel_wide.sav")
  base_sps <- file.path(stage, "01_niveles_medida.sps")
  .panel_export_wide_sav(
    built,
    base_sav,
    base_sps,
    overrides = overrides,
    multi_select = .panel_scalar(sav_opts$multi_select, "dummy_01")
  )
  add_file(base_sav)
  if (file.exists(base_sps)) add_file(base_sps)

  numericas <- .panel_report_numericas(cfg)
  excluidas <- setdiff(.panel_as_chr_vec(cfg$variables_excluidas), .panel_scalar(built$config$key, "numero_encuesta"))
  sections <- .panel_report_sections(built, data_report, inst, cfg, numericas, excluidas)

  if (isTRUE(built$config$include_codebook) && !exists("reporte_codebook", mode = "function")) {
    stop("El generador estandar de libro de codigos no esta disponible.", call. = FALSE)
  }
  if (isTRUE(built$config$include_codebook)) {
    progress("writing", percent = 78, message = "Generando libro de codigos con el motor de Analitica...")
    codebook_path <- file.path(stage, "02_libro_codigos.xlsx")
    .panel_export_codebook_xlsx(built, codebook_path, ficha_tecnica = ficha_tecnica)
    add_file(codebook_path)
  }

  if (isTRUE(built$config$include_frequencies) && !exists("reporte_frecuencias", mode = "function")) {
    stop("El generador estandar de frecuencias no esta disponible.", call. = FALSE)
  }
  if (isTRUE(built$config$include_frequencies)) {
    progress("writing", percent = 84, message = "Generando frecuencias con el motor de Analitica...")
    fc <- cfg$frecuencias %||% list()
    freq_path <- file.path(stage, "03_frecuencias.xlsx")
    # Mismo cableado ordinal que `.panel_export_frequencies_xlsx`: la copia
    # inline del paquete tambien debe respetar las listas ordinales.
    freq_ordinal_lists <- .orden_categorias_ordinal_set(inst, cfg)
    reporte_frecuencias(
      data_report,
      instrumento = inst,
      secciones = sections,
      path_xlsx = freq_path,
      orden = .panel_scalar(fc$orden, "desc"),
      mostrar_todo = isTRUE(fc$mostrar_todo),
      codigos_solo_si_presentes = .panel_report_frequency_codes(cfg),
      numericas = numericas,
      incluir_titulos = !identical(fc$incluir_titulos, FALSE),
      incluir_secciones = !identical(fc$incluir_secciones, FALSE),
      ordinal_lists = freq_ordinal_lists,
      ficha_tecnica = ficha
    )
    add_file(freq_path)
  }

  cross_vars <- .panel_report_cross_vars(built, data_report, cfg)
  if (isTRUE(built$config$include_crosses) && length(cross_vars) && !exists("reporte_cruces", mode = "function")) {
    stop("El generador estandar de cruces no esta disponible.", call. = FALSE)
  }
  if (isTRUE(built$config$include_crosses) && length(cross_vars)) {
    progress("writing", percent = 90, message = "Generando cruces con el motor de Analitica...")
    cross_path <- file.path(stage, "04_cruces.xlsx")
    .panel_export_crosses_xlsx(built, cross_path, ficha_tecnica = ficha_tecnica)
    add_file(cross_path)
  }

  progress("writing", percent = 95, message = "Generando auditorias y cobertura panel...")
  audit_path <- file.path(stage, "05_auditoria_panel.xlsx")
  .panel_write_package_audit_xlsx(built, audit_path)
  add_file(audit_path)

  .panel_zip_files(path_zip, files = files, root = stage)
  invisible(path_zip)
}

.panel_export_write <- function(built, path, options = list(), overrides = list(), progress = NULL,
                                ficha_tecnica = NULL) {
  options <- .panel_export_options(options)
  built <- .panel_anonymize_built(built, .panel_cfg_from_ficha(ficha_tecnica))
  if (is.null(progress)) progress <- function(...) invisible(NULL)
  if (identical(options$formato, "paquete")) {
    progress("writing", percent = 68, message = "Preparando paquete panel con entregables de Analitica...")
    .panel_write_standard_package_zip(
      built,
      path,
      options = options,
      overrides = overrides,
      progress = progress,
      ficha_tecnica = ficha_tecnica
    )
  } else if (identical(options$formato, "xlsx")) {
    progress("writing", percent = 82, message = "Escribiendo base panel wide en Excel...")
    .panel_export_wide_xlsx(built, path, valores = options$valores, multi_select = options$multi_select,
                            ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "csv")) {
    progress("writing", percent = 82, message = "Escribiendo base panel wide en CSV...")
    .panel_export_wide_csv(built, path, valores = options$valores, multi_select = options$multi_select, separador = options$separador)
  } else if (identical(options$formato, "libro_codigos")) {
    progress("writing", percent = 82, message = "Generando libro de codigos panel...")
    .panel_export_codebook_xlsx(built, path, ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "libro_codigos_pdf")) {
    progress("writing", percent = 82, message = "Generando libro de codigos panel (PDF)...")
    .panel_export_codebook_pdf(built, path, ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "frecuencias")) {
    progress("writing", percent = 82, message = "Generando frecuencias panel...")
    .panel_export_frequencies_xlsx(built, path, ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "cruces")) {
    progress("writing", percent = 82, message = "Generando cruces panel...")
    .panel_export_crosses_xlsx(built, path, ficha_tecnica = ficha_tecnica)
  } else if (identical(options$formato, "auditoria")) {
    progress("writing", percent = 82, message = "Generando auditoria panel...")
    .panel_export_audit_xlsx(built, path, ficha_tecnica = ficha_tecnica)
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

.panel_public_table <- function(df) {
  if (!is.data.frame(df)) return(df)
  out <- df
  if ("ola" %in% names(out) && !"medicion" %in% names(out)) {
    names(out)[names(out) == "ola"] <- "medicion"
  }
  if ("tipo" %in% names(out)) {
    out$tipo <- gsub("ola", "medicion", as.character(out$tipo), fixed = TRUE)
  }
  if ("variable_original" %in% names(out)) {
    out$variable_original <- gsub("presencia_ola", "presencia_medicion", as.character(out$variable_original), fixed = TRUE)
  }
  out
}

.panel_measurement_suffixes <- function(built) {
  out <- vapply((built$config %||% list())$waves %||% list(), function(w) .panel_scalar(w$suffix, ""), character(1))
  out[nzchar(out)]
}

.panel_measurement_labels <- function(built) {
  waves <- (built$config %||% list())$waves %||% list()
  suffixes <- .panel_measurement_suffixes(built)
  labels <- vapply(waves, function(w) .panel_public_wave_label(w$label, w$order %||% NA_integer_), character(1))
  stats::setNames(labels[seq_along(suffixes)], suffixes)
}

.panel_status_for_stem <- function(present_labels) {
  present_labels <- present_labels[nzchar(present_labels)]
  if (length(present_labels) > 1L) return("Común")
  if (length(present_labels) == 1L) return(paste("Solo en", present_labels[[1]]))
  "Sin medición"
}

.panel_codebook_aligned <- function(built) {
  cb <- built$codebook
  if (!is.data.frame(cb) || !nrow(cb) || !"variable_panel" %in% names(cb)) return(data.frame())
  suffixes <- .panel_measurement_suffixes(built)
  wave_labels <- .panel_measurement_labels(built)
  if (!length(suffixes)) return(data.frame())
  cb$.suffix <- .panel_suffix_of(as.character(cb$variable_panel), suffixes)
  cb$.stem <- .panel_stem_of(as.character(cb$variable_panel), suffixes)
  panel_cb <- cb[nzchar(cb$.suffix), , drop = FALSE]
  if (!nrow(panel_cb)) return(data.frame())
  stems <- .panel_order_stems(unique(panel_cb$.stem))
  rows <- list()
  option_keys <- function(x) {
    if (!nrow(x)) return(character(0))
    labels <- trimws(as.character(x$etiqueta_codigo %||% ""))
    codes <- trimws(as.character(x$codigo %||% ""))
    keys <- ifelse(nzchar(labels), labels, codes)
    keys[nzchar(keys)]
  }
  for (stem in stems) {
    by_suffix <- lapply(suffixes, function(sfx) panel_cb[panel_cb$.stem == stem & panel_cb$.suffix == sfx, , drop = FALSE])
    names(by_suffix) <- suffixes
    present <- suffixes[vapply(by_suffix, nrow, integer(1)) > 0L]
    keys <- unique(unlist(lapply(by_suffix, option_keys), use.names = FALSE))
    if (!length(keys)) keys <- ""
    for (key in keys) {
      out <- list(
        "Variable base" = stem,
        "Estado" = .panel_status_for_stem(unname(wave_labels[present]))
      )
      sep_idx <- 0L
      for (sfx_i in seq_along(suffixes)) {
        sfx <- suffixes[[sfx_i]]
        if (sfx_i > 1L) {
          sep_idx <- sep_idx + 1L
          out[[strrep(" ", sep_idx)]] <- ""
        }
        label <- wave_labels[[sfx]] %||% sfx
        d <- by_suffix[[sfx]]
        hit <- if (nrow(d) && nzchar(key)) {
          labels <- trimws(as.character(d$etiqueta_codigo %||% ""))
          codes <- trimws(as.character(d$codigo %||% ""))
          d[labels == key | (!nzchar(labels) & codes == key), , drop = FALSE]
        } else d
        if (!nrow(hit)) hit <- d[0, , drop = FALSE]
        first <- if (nrow(hit)) hit[1, , drop = FALSE] else data.frame()
        out[[paste("Variable", label)]] <- if (nrow(first)) as.character(first$variable_panel[[1]] %||% "") else ""
        out[[paste("Pregunta", label)]] <- if (nrow(first)) as.character(first$etiqueta[[1]] %||% "") else ""
        out[[paste("Tipo", label)]] <- if (nrow(first)) as.character(first$tipo[[1]] %||% "") else ""
        out[[paste("Código", label)]] <- if (nrow(first)) as.character(first$codigo[[1]] %||% "") else ""
        out[[paste("Categoría", label)]] <- if (nrow(first)) as.character(first$etiqueta_codigo[[1]] %||% "") else ""
      }
      rows[[length(rows) + 1L]] <- as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
    }
  }
  if (length(rows)) dplyr::bind_rows(rows) else data.frame()
}

.panel_frequencies_aligned <- function(built) {
  fr <- built$frequencies
  if (!is.data.frame(fr) || !nrow(fr) || !"variable_panel" %in% names(fr)) return(data.frame())
  suffixes <- .panel_measurement_suffixes(built)
  wave_labels <- .panel_measurement_labels(built)
  if (!length(suffixes)) return(data.frame())
  fr$.suffix <- .panel_suffix_of(as.character(fr$variable_panel), suffixes)
  fr$.stem <- .panel_stem_of(as.character(fr$variable_panel), suffixes)
  panel_fr <- fr[nzchar(fr$.suffix), , drop = FALSE]
  if (!nrow(panel_fr)) return(data.frame())
  stems <- .panel_order_stems(unique(panel_fr$.stem))
  rows <- list()
  for (stem in stems) {
    by_suffix <- lapply(suffixes, function(sfx) panel_fr[panel_fr$.stem == stem & panel_fr$.suffix == sfx, , drop = FALSE])
    names(by_suffix) <- suffixes
    present <- suffixes[vapply(by_suffix, nrow, integer(1)) > 0L]
    options <- unique(unlist(lapply(by_suffix, function(x) {
      if (!nrow(x) || !"opcion" %in% names(x)) return(character(0))
      vals <- trimws(as.character(x$opcion %||% ""))
      vals[nzchar(vals)]
    }), use.names = FALSE))
    if (!length(options)) next
    for (opt in options) {
      first_label <- ""
      out <- list(
        "Variable base" = stem,
        "Estado" = .panel_status_for_stem(unname(wave_labels[present])),
        "Opción" = opt
      )
      for (sfx in suffixes) {
        label <- wave_labels[[sfx]] %||% sfx
        d <- by_suffix[[sfx]]
        hit <- if (nrow(d) && "opcion" %in% names(d)) {
          d[trimws(as.character(d$opcion %||% "")) == opt, , drop = FALSE]
        } else d[0, , drop = FALSE]
        if (nrow(hit) && !nzchar(first_label)) first_label <- as.character(hit$pregunta[[1]] %||% "")
        out[[paste("Variable", label)]] <- if (nrow(hit)) as.character(hit$variable_panel[[1]] %||% "") else ""
        out[[paste("n", label)]] <- if (nrow(hit)) suppressWarnings(as.integer(hit$n[[1]] %||% 0L)) else 0L
        out[[paste("%", label)]] <- if (nrow(hit)) suppressWarnings(as.numeric(hit$pct[[1]] %||% NA_real_)) else NA_real_
      }
      out <- c(out[1:2], list("Pregunta" = first_label), out[-(1:2)])
      rows[[length(rows) + 1L]] <- as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
    }
  }
  if (length(rows)) dplyr::bind_rows(rows) else data.frame()
}

.panel_codebook_value_map <- function(built, var) {
  cb <- built$codebook
  if (!is.data.frame(cb) || !nrow(cb) || !"variable_panel" %in% names(cb)) return(character(0))
  d <- cb[as.character(cb$variable_panel) == var, , drop = FALSE]
  if (!nrow(d) || !"codigo" %in% names(d) || !"etiqueta_codigo" %in% names(d)) return(character(0))
  codes <- trimws(as.character(d$codigo %||% ""))
  labs <- trimws(as.character(d$etiqueta_codigo %||% ""))
  keep <- nzchar(codes) & nzchar(labs)
  stats::setNames(labs[keep], codes[keep])
}

.panel_label_values <- function(x, value_map = character(0)) {
  vals <- trimws(as.character(x))
  vals[is.na(vals) | !nzchar(vals)] <- NA_character_
  if (length(value_map)) {
    hit <- match(vals, names(value_map))
    vals[!is.na(hit)] <- unname(value_map[hit[!is.na(hit)]])
  }
  vals
}

.panel_transition_tables <- function(built, max_levels = 30L) {
  data <- built$base_wide
  if (!is.data.frame(data) || !nrow(data)) return(data.frame())
  suffixes <- .panel_measurement_suffixes(built)
  wave_labels <- .panel_measurement_labels(built)
  if (length(suffixes) < 2L) return(data.frame())
  rows <- list()
  stems <- .panel_order_stems(unique(.panel_stem_of(names(data)[nzchar(.panel_suffix_of(names(data), suffixes))], suffixes)))
  pairs <- Map(c, head(suffixes, -1L), tail(suffixes, -1L))
  for (stem in stems) {
    for (pair in pairs) {
      var_a <- paste0(stem, "_", pair[[1]])
      var_b <- paste0(stem, "_", pair[[2]])
      if (!all(c(var_a, var_b) %in% names(data))) next
      a <- .panel_label_values(data[[var_a]], .panel_codebook_value_map(built, var_a))
      b <- .panel_label_values(data[[var_b]], .panel_codebook_value_map(built, var_b))
      keep <- !is.na(a) & !is.na(b)
      if (!any(keep)) next
      lev_a <- unique(c(unname(.panel_codebook_value_map(built, var_a)), a[keep]))
      lev_b <- unique(c(unname(.panel_codebook_value_map(built, var_b)), b[keep]))
      lev_a <- lev_a[!is.na(lev_a) & nzchar(lev_a)]
      lev_b <- lev_b[!is.na(lev_b) & nzchar(lev_b)]
      if (length(lev_a) > max_levels || length(lev_b) > max_levels) {
        rows[[length(rows) + 1L]] <- data.frame(
          "Variable base" = stem,
          "Pregunta" = .panel_clean_export_label(attr(data[[var_a]], "label", exact = TRUE) %||% var_a),
          "Cruce" = paste(wave_labels[[pair[[1]]]], "→", wave_labels[[pair[[2]]]]),
          "Primera categoría" = "No tabulado",
          "Segunda categoría" = "No tabulado",
          "n" = NA_integer_,
          "% fila" = NA_real_,
          "% total" = NA_real_,
          "Observación" = "Se omitió porque una de las mediciones supera el máximo de categorías para una tabla legible.",
          check.names = FALSE
        )
        next
      }
      tab <- table(factor(a[keep], levels = lev_a), factor(b[keep], levels = lev_b), useNA = "no")
      total <- sum(tab)
      row_tot <- rowSums(tab)
      for (i in seq_along(lev_a)) {
        for (j in seq_along(lev_b)) {
          n <- as.integer(tab[i, j])
          rows[[length(rows) + 1L]] <- data.frame(
            "Variable base" = stem,
            "Pregunta" = .panel_clean_export_label(attr(data[[var_a]], "label", exact = TRUE) %||% var_a),
            "Cruce" = paste(wave_labels[[pair[[1]]]], "→", wave_labels[[pair[[2]]]]),
            "Primera categoría" = lev_a[[i]],
            "Segunda categoría" = lev_b[[j]],
            "n" = n,
            "% fila" = if (row_tot[[i]] > 0) n / row_tot[[i]] else NA_real_,
            "% total" = if (total > 0) n / total else NA_real_,
            "Observación" = "Cruce calculado",
            check.names = FALSE
          )
        }
      }
    }
  }
  if (length(rows)) dplyr::bind_rows(rows) else data.frame()
}

.panel_cross_var_defs <- function(built) {
  raw <- (built$config %||% list())$cross_vars %||% (built$config %||% list())$cruces_vars %||% list()
  if (is.null(raw) || !length(raw)) return(list())
  keep_def <- function(x) {
    is.list(x) && !is.null(x$name) && length(x$name) &&
      !is.na(.panel_scalar(x$name, NA_character_)) && nzchar(.panel_scalar(x$name, ""))
  }
  slug_names <- function(x) {
    if (!length(x)) return(character(0))
    make.unique(vapply(as.character(x), function(v) .panel_slug(v, "cruce"), character(1)), sep = "_")
  }
  if (is.character(raw)) {
    out <- lapply(raw, function(v) list(name = as.character(v), label = as.character(v)))
    names(out) <- slug_names(raw)
    return(Filter(keep_def, out))
  }
  if (is.list(raw) && !is.null(names(raw)) && all(nzchar(names(raw)))) {
    out <- lapply(names(raw), function(label) {
      val <- raw[[label]]
      if (is.list(val)) {
        val$name <- .panel_scalar(val$name %||% val$variable %||% val$var, "")
        val$label <- .panel_scalar(val$label %||% label, label)
        val
      } else {
        list(name = .panel_scalar(val, ""), label = label)
      }
    })
    names(out) <- slug_names(names(raw))
    return(Filter(keep_def, out))
  }
  out <- lapply(raw, function(x) {
    if (is.list(x)) {
      x$name <- .panel_scalar(x$name %||% x$variable %||% x$var, "")
      x$label <- .panel_scalar(x$label %||% x$name %||% x$variable %||% x$var, "Cruce")
      x
    }
    else list(name = .panel_scalar(x, ""), label = .panel_scalar(x, "Cruce"))
  })
  names(out) <- slug_names(vapply(out, function(x) .panel_scalar(x$label, "cruce"), character(1)))
  Filter(keep_def, out)
}

.panel_cross_tab_by <- function(built, cross_var, cross_label = NULL, exclude_levels = character(0)) {
  cross_var <- .panel_scalar(cross_var, "")
  data <- built$base_wide
  fr <- built$frequencies
  if (!nzchar(cross_var)) return(data.frame())
  if (!is.data.frame(data) || !nrow(data) || !(cross_var %in% names(data))) return(data.frame())
  if (!is.data.frame(fr) || !nrow(fr) || !"variable_panel" %in% names(fr)) return(data.frame())
  suffixes <- .panel_measurement_suffixes(built)
  wave_labels <- .panel_measurement_labels(built)
  if (!length(suffixes)) return(data.frame())
  cross_label <- .panel_scalar(cross_label, attr(data[[cross_var]], "label", exact = TRUE) %||% cross_var)
  cross_values <- .panel_label_values(data[[cross_var]], .panel_codebook_value_map(built, cross_var))
  exclude_levels <- .panel_as_chr_vec(exclude_levels)
  if (length(exclude_levels)) {
    norm_exclude <- toupper(trimws(exclude_levels))
    norm_values <- toupper(trimws(as.character(cross_values)))
    cross_values[!is.na(norm_values) & norm_values %in% norm_exclude] <- NA_character_
  }
  cross_values[is.na(cross_values) | !nzchar(cross_values)] <- "Sin dato"
  if (length(exclude_levels)) {
    norm_exclude <- toupper(trimws(exclude_levels))
    cross_values[toupper(trimws(cross_values)) %in% norm_exclude] <- NA_character_
  }
  cross_levels <- unique(c(unname(.panel_codebook_value_map(built, cross_var)), cross_values))
  if (length(exclude_levels)) {
    cross_levels <- cross_levels[!(toupper(trimws(cross_levels)) %in% toupper(trimws(exclude_levels)))]
  }
  cross_levels <- cross_levels[!is.na(cross_levels) & nzchar(cross_levels)]
  fr$.suffix <- .panel_suffix_of(as.character(fr$variable_panel), suffixes)
  fr$.stem <- .panel_stem_of(as.character(fr$variable_panel), suffixes)
  fr <- fr[nzchar(fr$.suffix), , drop = FALSE]
  if (!nrow(fr)) return(data.frame())
  var_order <- names(data)
  vars <- unique(as.character(fr$variable_panel))
  vars <- vars[vars %in% names(data) & vars != cross_var]
  vars <- vars[order(match(vars, var_order))]
  rows <- list()
  for (var in vars) {
    opts <- unique(trimws(as.character(fr$opcion[as.character(fr$variable_panel) == var] %||% "")))
    opts <- opts[nzchar(opts)]
    if (!length(opts)) next
    sfx <- .panel_suffix_of(var, suffixes)
    values <- .panel_label_values(data[[var]], .panel_codebook_value_map(built, var))
    pregunta <- unique(as.character(fr$pregunta[as.character(fr$variable_panel) == var] %||% ""))
    pregunta <- pregunta[nzchar(pregunta)][1] %||% attr(data[[var]], "label", exact = TRUE) %||% var
    valid <- !is.na(values) & nzchar(values)
    for (level in cross_levels) {
      in_group <- !is.na(cross_values) & cross_values == level
      denom <- sum(in_group & valid, na.rm = TRUE)
      for (opt in opts) {
        n <- if (identical(opt, "Total")) denom else sum(in_group & valid & values == opt, na.rm = TRUE)
        rows[[length(rows) + 1L]] <- data.frame(
          "Variable base" = .panel_stem_of(var, suffixes),
          "Variable" = var,
          "Pregunta" = pregunta,
          "Medición" = wave_labels[[sfx]] %||% sfx,
          "Variable de cruce" = cross_label,
          "Categoría de cruce" = level,
          "Opción" = opt,
          "n" = as.integer(n),
          "% dentro del cruce" = if (denom > 0) n / denom else NA_real_,
          "Total válido del cruce" = as.integer(denom),
          check.names = FALSE
        )
      }
    }
  }
  if (length(rows)) dplyr::bind_rows(rows) else data.frame()
}

.panel_cross_tabs_all <- function(built) {
  defs <- .panel_cross_var_defs(built)
  if (!length(defs)) return(list())
  out <- list()
  for (nm in names(defs)) {
    def <- defs[[nm]]
    exclude_levels <- .panel_as_chr_vec(def$exclude_levels %||% def$excluir_categorias %||% def$omit_levels %||% def$omitir_categorias)
    tab <- .panel_cross_tab_by(built, def$name, def$label, exclude_levels = exclude_levels)
    if (nrow(tab)) out[[nm]] <- tab
  }
  out
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
    df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, df, withFilter = nrow(df) > 0L)
    if (ncol(df) > 0L) {
      header <- openxlsx::createStyle(
        textDecoration = "bold", fgFill = "#0B2B63", fontColour = "#FFFFFF",
        halign = "center", valign = "center", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#93A4BD"
      )
      body <- openxlsx::createStyle(
        valign = "top", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#D9E2F2"
      )
      pct <- openxlsx::createStyle(
        numFmt = "0.0%", valign = "top", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#D9E2F2"
      )
      int <- openxlsx::createStyle(
        numFmt = "#,##0", valign = "top", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#D9E2F2"
      )
      openxlsx::addStyle(wb, sheet, header, rows = 1, cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      if (nrow(df) > 0L) openxlsx::addStyle(wb, sheet, body, rows = 2:(nrow(df) + 1L), cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
      pct_cols <- grep("^(%|pct$|cobertura$)", names(df), ignore.case = TRUE)
      if (length(pct_cols) && nrow(df) > 0L) openxlsx::addStyle(wb, sheet, pct, rows = 2:(nrow(df) + 1L), cols = pct_cols, gridExpand = TRUE, stack = TRUE)
      int_cols <- grep("^(n$|n |casos|filas|columnas|llaves)", names(df), ignore.case = TRUE)
      if (length(int_cols) && nrow(df) > 0L) openxlsx::addStyle(wb, sheet, int, rows = 2:(nrow(df) + 1L), cols = int_cols, gridExpand = TRUE, stack = TRUE)
      openxlsx::freezePane(wb, sheet, firstRow = TRUE)
      widths <- vapply(seq_len(ncol(df)), function(j) {
        vals <- as.character(c(names(df)[j], utils::head(df[[j]], 300)))
        vals[is.na(vals)] <- ""
        max(nchar(vals), na.rm = TRUE) + 2
      }, numeric(1))
      widths <- pmin(pmax(widths, 10), 62)
      openxlsx::setColWidths(wb, sheet, cols = seq_len(ncol(df)), widths = widths)
      if (nrow(df) > 0L) {
        rows_to_size <- seq_len(min(nrow(df), 500L))
        heights <- vapply(rows_to_size, function(i) {
          vals <- as.character(df[i, , drop = TRUE])
          vals[is.na(vals)] <- ""
          max(18, min(90, 16 + max(nchar(vals), na.rm = TRUE) / 55 * 12))
        }, numeric(1))
        openxlsx::setRowHeights(wb, sheet, rows = rows_to_size + 1L, heights = heights)
      }
    }
  }
  add_table("base_wide", built$base_wide)
  if (isTRUE(built$config$include_codebook)) {
    aligned_codebook <- .panel_codebook_aligned(built)
    add_table("libro_codigos", if (nrow(aligned_codebook)) aligned_codebook else .panel_public_table(built$codebook))
    add_table("libro_codigos_detalle", .panel_public_table(built$codebook))
  }
  if (isTRUE(built$config$include_frequencies)) {
    aligned_freq <- .panel_frequencies_aligned(built)
    add_table("frecuencias", if (nrow(aligned_freq)) aligned_freq else .panel_public_table(built$frequencies))
    add_table("frecuencias_detalle", .panel_public_table(built$frequencies))
    cross_tabs <- .panel_cross_tabs_all(built)
    longitudinal_cross <- .panel_transition_tables(built)
    if (length(cross_tabs)) {
      cross_all <- dplyr::bind_rows(cross_tabs, .id = "cruce")
      add_table("cruces", cross_all)
      for (nm in names(cross_tabs)) add_table(paste0("cruces_", nm), cross_tabs[[nm]])
    } else {
      add_table("cruces", longitudinal_cross)
    }
    add_table("cruces_longitudinales", longitudinal_cross)
  }
  if (isTRUE(built$config$include_audit)) add_table("auditoria_panel", .panel_public_table(built$audit))
  if (isTRUE(built$config$include_nse) && isTRUE(built$config$include_cobertura_nse)) add_table("cobertura_nse", built$cobertura_nse)
  summary_df <- data.frame(
    campo = names(built$summary)[!names(built$summary) %in% "waves"],
    valor = vapply(built$summary[!names(built$summary) %in% "waves"], function(x) paste(as.character(unlist(x)), collapse = ", "), character(1)),
    stringsAsFactors = FALSE
  )
  add_table("configuracion", summary_df)
  if (.panel_embed_ficha_xlsx(ficha_tecnica) && exists(".analitica_add_ficha_tecnica_from_spec", mode = "function")) {
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
          "Mediciones incluidas" = paste(vapply(built$config$waves, function(w) as.character(w$label %||% w$suffix %||% ""), character(1)), collapse = ", "),
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
