# Helpers para la exportación de Bases (Analítica · Fase 4).
#
# El pane "Bases" produce 3 formatos independientes:
#   - .sav  (SPSS binario, con labels + value-labels + measure embebidos)
#   - .csv  (con opción de códigos vs etiquetas + manejo de multi-select)
#   - .xlsx (íd. + opción "ambos" que escribe dos hojas)
#
# Estos helpers viven al nivel del paquete `prosecnurapp` (no `prosecnur`)
# porque la lógica de exportación combina conocimientos del instrumento
# (que vive en la app) con conversiones que prosecnur no expone.
#
# Las funciones privadas (`.` prefix) no se exportan.

# ---- Inferencia de metadatos SPSS ------------------------------------------

# Regresa la medida SPSS apropiada para una columna. Regla:
#   - select_one likert-ish (códigos son secuencia ordenada 1..N con labels que
#     sugieren gradación) → "ordinal"
#   - select_one general → "nominal"
#   - select_multiple → "nominal" (binaria 0/1 por opción cuando se expanda)
#   - integer / decimal / range / calculate numérico → "scale"
#   - date / time / datetime → "scale"
#   - text / geopoint / image / audio / video → "nominal"
.infer_measure <- function(name, col, survey) {
  row <- .bases_survey_row(survey, name)
  tipo <- if (nrow(row) > 0L) as.character(row$type[1]) else ""
  base <- sub("\\s.*$", "", tipo)

  if (base == "select_one") {
    if (.is_ordinal_choice_list(col)) "ordinal" else "nominal"
  } else if (base == "select_multiple") {
    "nominal"
  } else if (base %in% c("integer", "decimal", "range")) {
    "scale"
  } else if (base == "calculate") {
    # Si el resultado es numérico, asumimos escala; si no, nominal.
    if (is.numeric(col)) "scale" else "nominal"
  } else if (base %in% c("date", "time", "datetime", "start", "end", "today")) {
    "scale"
  } else {
    "nominal"
  }
}

# Heurística: una lista de choices es "ordinal" si los códigos son una
# secuencia numérica monótona (1,2,3,... o 0,1,2,...) y las etiquetas
# tienen alguna pista de gradación ("Nada", "Poco", "Mucho", o números
# al inicio como "1- Nada"). Conservador: si duda, cae en "nominal".
.is_ordinal_choice_list <- function(col) {
  pairs <- .bases_label_pairs(attr(col, "labels", exact = TRUE))
  if (nrow(pairs) < 3L) return(FALSE)

  # Códigos tipo "Prefiero no responder" no deben romper una escala
  # ordinal 1..4/1..5. Se preservan como value-labels, pero no se usan
  # para decidir si la lista es ordenada.
  keep <- !.bases_is_missingish_label(pairs$label)
  pairs_ord <- pairs[keep, , drop = FALSE]
  if (nrow(pairs_ord) < 3L) return(FALSE)

  codigos <- suppressWarnings(as.numeric(pairs_ord$code))
  if (any(is.na(codigos))) return(FALSE)
  if (is.unsorted(codigos, strictly = TRUE)) return(FALSE)

  # Etiquetas: buscar palabras de gradación
  textos <- tolower(as.character(pairs_ord$label))
  textos <- chartr("áéíóúüñ", "aeiouun", textos)
  pistas <- enc2utf8(c(
    "nada", "poco", "algo", "mucho", "muy", "muchisim", "muchisima",
    "totalmente", "siempre", "nunca", "a veces", "rara vez",
    "bajo", "medio", "alto", "acuerdo", "desacuerdo",
    "satisfech", "insatisfech",
    "malo", "bueno", "regular", "excelente", "pesimo",
    "nivel", "anos", "edad", "a mas", "menor", "mayor"
  ))
  # Forzar UTF-8 en `textos` también para evitar "regular expression is
  # invalid UTF-8" cuando el locale es C/POSIX y hay strings con
  # encoding "unknown" que contienen bytes no-ASCII.
  textos <- enc2utf8(textos)
  if (any(vapply(pistas, function(p) any(grepl(p, textos, fixed = TRUE)), logical(1)))) {
    return(TRUE)
  }
  # Códigos prefijados en labels ("1- Nada", "2) Algo", etc.)
  if (all(grepl("^[0-9]+\\s*[\\-\\.\\)]", textos))) return(TRUE)
  FALSE
}

.bases_survey_row <- function(survey, name) {
  if (is.null(survey) || !is.data.frame(survey) || !"name" %in% names(survey)) {
    return(data.frame())
  }
  nms <- as.character(survey$name)
  idx <- which(!is.na(nms) & nms == name)
  if (!length(idx)) return(data.frame())
  survey[idx[1L], , drop = FALSE]
}

.bases_escape_regex <- function(x) {
  gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", as.character(x), perl = TRUE)
}

.bases_has_letters <- function(x) {
  grepl("[A-Za-zÁÉÍÓÚáéíóúÑñÜü]", enc2utf8(as.character(x)), perl = TRUE)
}

.bases_strip_redundant_choice_code <- function(label, code) {
  raw <- trimws(enc2utf8(as.character(label %||% "")))
  code <- trimws(as.character(code %||% ""))
  raw[is.na(raw)] <- ""
  code[is.na(code)] <- ""
  if (!nzchar(raw) || !nzchar(code)) return(raw)
  if (is.na(suppressWarnings(as.numeric(code)))) return(raw)

  code_re <- .bases_escape_regex(code)
  cleaned <- sub(paste0("\\s*(?:[\\(\\[]\\s*", code_re, "\\s*[\\)\\]]|[-–—:]?\\s+", code_re, ")\\s*$"),
                 "", raw, perl = TRUE)
  cleaned <- sub(paste0("^\\s*(?:[\\(\\[]\\s*", code_re, "\\s*[\\)\\]]|", code_re, "\\s*[-–—:]?)\\s+"),
                 "", cleaned, perl = TRUE)
  cleaned <- trimws(cleaned)
  n_words <- if (nzchar(cleaned)) length(strsplit(cleaned, "\\s+", perl = TRUE)[[1]]) else 0L
  if (!identical(cleaned, raw) && .bases_has_letters(cleaned) && n_words >= 2L) cleaned else raw
}

.bases_choice_labels_have_ordinal_cues <- function(labels) {
  textos <- tolower(enc2utf8(as.character(labels %||% "")))
  textos[is.na(textos)] <- ""
  textos <- chartr("áéíóúüñ", "aeiouun", textos)
  pistas <- enc2utf8(c(
    "nada", "poco", "algo", "mucho", "muy", "totalmente",
    "util", "competente", "acuerdo", "desacuerdo",
    "satisfech", "insatisfech", "probable", "improbable",
    "importante", "relevante", "facil", "dificil",
    "bajo", "medio", "alto", "malo", "bueno", "excelente",
    "nunca", "siempre", "rara vez", "a veces"
  ))
  any(vapply(pistas, function(p) any(grepl(p, textos, fixed = TRUE)), logical(1)))
}

.bases_choice_labels_should_strip_codes <- function(codes, labels) {
  codes <- trimws(as.character(codes %||% ""))
  labels <- as.character(labels %||% "")
  codes[is.na(codes)] <- ""
  labels[is.na(labels)] <- ""
  if (length(codes) < 3L || length(labels) < 3L) return(FALSE)

  keep <- !.bases_is_missingish_label(labels)
  if (sum(keep) < 3L) return(FALSE)
  nums <- suppressWarnings(as.numeric(codes[keep]))
  if (any(is.na(nums))) return(FALSE)
  unique_nums <- sort(unique(nums))
  if (length(unique_nums) < 3L || any(diff(unique_nums) != 1)) return(FALSE)
  if (!.bases_choice_labels_have_ordinal_cues(labels[keep])) return(FALSE)

  cleaned <- mapply(
    .bases_strip_redundant_choice_code,
    label = labels,
    code = codes,
    SIMPLIFY = TRUE,
    USE.NAMES = FALSE
  )
  any(!identical(cleaned, labels) & cleaned != labels)
}

.bases_clean_choice_labels <- function(codes, labels) {
  labels <- as.character(labels %||% "")
  labels[is.na(labels)] <- ""
  if (!.bases_choice_labels_should_strip_codes(codes, labels)) return(enc2utf8(labels))
  mapply(.bases_strip_redundant_choice_code,
         label = labels,
         code = codes,
         SIMPLIFY = TRUE,
         USE.NAMES = FALSE)
}

.bases_label_pairs <- function(labs) {
  if (is.null(labs) || length(labs) == 0L) {
    return(data.frame(code = character(0), label = character(0), stringsAsFactors = FALSE))
  }
  nms <- names(labs)
  if (is.null(nms)) nms <- rep("", length(labs))
  names_are_codes <- suppressWarnings(!any(is.na(as.numeric(nms))))
  if (names_are_codes) {
    code <- as.character(nms)
    label <- as.character(unname(labs))
  } else {
    code <- as.character(unname(labs))
    label <- as.character(nms)
  }
  label <- .bases_clean_choice_labels(code, label)
  out <- data.frame(code = code, label = enc2utf8(label), stringsAsFactors = FALSE)
  out <- out[!is.na(out$code) & nzchar(out$code), , drop = FALSE]
  out[!duplicated(out$code), , drop = FALSE]
}

.bases_is_missingish_label <- function(x) {
  z <- tolower(enc2utf8(as.character(x)))
  z <- chartr("áéíóúüñ", "aeiouun", z)
  grepl(
    "prefiero no responder|no responde|no sabe|no aplica|sin respuesta|rechaza",
    z,
    perl = TRUE
  )
}

# Formato SPSS: F<w>.<d> para numéricos, DATE/TIME para fechas. Para
# strings devolvemos NA — haven/readstat auto-infiere `A<w>` del ancho
# real de la columna, incluido soporte de "very long string" (>255 chars).
# Si forzamos un A255 manual sobre una columna con strings de 800+ chars,
# readstat escribe bytes que luego no se pueden releer ("Unable to convert
# string to the requested encoding"). Dejarlo en NA evita ese bug.
.infer_spss_format <- function(col) {
  if (inherits(col, "Date")) return("DATE10")
  if (inherits(col, "POSIXct") || inherits(col, "POSIXt")) return("DATETIME20")
  if (inherits(col, "hms") || inherits(col, "times")) return("TIME10")
  if (is.numeric(col) || inherits(col, "haven_labelled") || inherits(col, "haven_labelled_spss")) {
    # Numéricos con decimales: F12.2; enteros: F8.0.
    x <- suppressWarnings(as.numeric(col))
    is_int <- all(is.na(x) | x == as.integer(x))
    if (is_int) "F8.0" else "F12.2"
  } else {
    # character / factor / lo que sea: NA → haven auto-infiere.
    NA_character_
  }
}

# Ancho de display (para SPSS Variable View). Match con format.spss.
.infer_width <- function(col) {
  if (is.numeric(col) || inherits(col, c("haven_labelled", "haven_labelled_spss"))) return(12L)
  if (inherits(col, "Date") || inherits(col, "POSIXct")) return(10L)
  if (is.character(col) || is.factor(col)) {
    w <- suppressWarnings(max(nchar(as.character(col)), na.rm = TRUE))
    if (!is.finite(w) || w <= 0) w <- 20L
    as.integer(min(max(w, 8L), 40L))
  } else {
    20L
  }
}

# Prepara el data frame para write_sav: setea measure, format.spss y
# display_width en cada columna cuando faltan. No destruye los atributos
# existentes (idempotente).
.bases_sav_prepare <- function(df, rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey)) survey <- data.frame(name = character(0), type = character(0), stringsAsFactors = FALSE)

  for (v in names(df)) {
    col <- df[[v]]
    row <- .bases_survey_row(survey, v)
    # Si la variable existe en el instrumento, la inferencia actual del
    # XLSForm/lista gana sobre attrs heredados del data frame. Esos attrs
    # suelen venir de `measure_sugerida` y pueden estar desactualizados.
    # Los overrides del usuario se aplican después y siguen teniendo la
    # última palabra.
    if (nrow(row) > 0L || is.null(attr(col, "measure", exact = TRUE))) {
      attr(df[[v]], "measure") <- .infer_measure(v, col, survey)
    }
    if (is.null(attr(col, "format.spss", exact = TRUE))) {
      fmt <- .infer_spss_format(col)
      # Solo asignar si es un format válido — para character/factor caemos
      # al auto-inference de haven (que maneja very-long-strings).
      if (!is.na(fmt)) attr(df[[v]], "format.spss") <- fmt
    }
    if (is.null(attr(col, "display_width", exact = TRUE))) {
      attr(df[[v]], "display_width") <- .infer_width(col)
    }
  }
  df
}

.bases_xlsform_base_type <- function(type) {
  type <- as.character(type %||% "")
  if (!length(type) || is.na(type[1L]) || !nzchar(type[1L])) return("")
  sub("\\s.*$", "", type[1L])
}

.bases_restore_core_attrs <- function(x, label, labels, measure, format_spss, display_width) {
  if (!is.null(label)) attr(x, "label") <- label
  if (!is.null(labels)) attr(x, "labels") <- labels
  if (!is.null(measure)) attr(x, "measure") <- measure
  if (!is.null(format_spss)) attr(x, "format.spss") <- format_spss
  if (!is.null(display_width)) attr(x, "display_width") <- display_width
  x
}

# Antes de escribir SPSS, ajusta el tipo físico según el XLSForm cuando
# la fuente llegó con tipos ambiguos (por ejemplo, edad como character, o
# columnas text vacías importadas como numeric). Esto evita que SPSS marque
# textos/IDs como escala o continuas como A<w>.
.bases_coerce_spss_types <- function(df, rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey)) survey <- data.frame(name = character(0), type = character(0), stringsAsFactors = FALSE)
  numeric_types <- c("integer", "decimal", "range")
  text_types <- c(
    "text", "note", "begin_group", "end_group", "hidden", "geopoint",
    "image", "audio", "video", "file", "barcode", "username", "email",
    "deviceid", "simserial", "phonenumber"
  )

  for (v in names(df)) {
    row <- .bases_survey_row(survey, v)
    base <- if (nrow(row) > 0L && "type" %in% names(row)) {
      .bases_xlsform_base_type(row$type[1L])
    } else {
      ""
    }
    if (!nzchar(base)) next

    col <- df[[v]]
    label <- attr(col, "label", exact = TRUE)
    labels <- attr(col, "labels", exact = TRUE)
    measure <- attr(col, "measure", exact = TRUE)
    format_spss <- attr(col, "format.spss", exact = TRUE)
    display_width <- attr(col, "display_width", exact = TRUE)

    if (base %in% numeric_types && !is.numeric(col)) {
      raw <- trimws(as.character(col))
      non_empty <- !is.na(raw) & nzchar(raw)
      parsed <- suppressWarnings(as.numeric(raw))
      if (!any(non_empty) || all(!is.na(parsed[non_empty]))) {
        df[[v]] <- .bases_restore_core_attrs(parsed, label, labels, measure, format_spss, display_width)
      }
    } else if (base %in% text_types && !is.character(col) && !is.factor(col)) {
      txt <- as.character(col)
      txt[is.na(col)] <- NA_character_
      df[[v]] <- .bases_restore_core_attrs(txt, label, labels, measure, format_spss, display_width)
    }
  }

  df
}

# ---- Multi-select expand ---------------------------------------------------

# Detecta columnas select_multiple desde survey y devuelve lista
# nombrada: name -> list_name. Ignora variables que no están en df.
.detect_multiselect <- function(df, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L) return(list())
  tipos <- as.character(sv$type %||% "")
  base <- sub("\\s.*$", "", tipos)
  list_names <- trimws(sub("^\\S+\\s*", "", tipos))
  out <- list()
  for (i in seq_len(nrow(sv))) {
    nm <- as.character(sv$name[i] %||% "")
    if (!nzchar(nm) || !nm %in% names(df)) next
    if (base[i] == "select_multiple") out[[nm]] <- list_names[i]
  }
  out
}

# Lee las choices de una lista (`list_name`) desde el instrumento. Devuelve
# data.frame con columnas `name` (código) y `label` (etiqueta en ESP si
# existe). Usa `rp_inst$choices` si disponible, con fallback a atributos de
# la columna.
.choices_desde_instrumento <- function(rp_inst, list_name, fallback_col = NULL) {
  ch <- rp_inst$choices
  if (!is.null(ch) && "list_name" %in% names(ch)) {
    sel <- ch[ch$list_name == list_name, , drop = FALSE]
    if (nrow(sel) > 0L) {
      nm <- as.character(sel$name %||% sel$value %||% "")
      # Label preference: label::Spanish > label
      lab_col <- if (!is.null(rp_inst$choices_raw)) {
        raw <- rp_inst$choices_raw
        raw_sel <- raw[raw$list_name == list_name, , drop = FALSE]
        cands <- grep("^label", tolower(names(raw_sel)))
        if (length(cands) > 0L) {
          sp <- grep("spanish|español", tolower(names(raw_sel)[cands]))
          pick <- if (length(sp) > 0L) cands[sp[1]] else cands[1]
          as.character(raw_sel[[pick]])
        } else NULL
      } else NULL
      lb <- if (!is.null(lab_col) && length(lab_col) == length(nm)) lab_col else as.character(sel$label %||% "")
      lb <- .bases_clean_choice_labels(nm, lb)
      Encoding(lb) <- "UTF-8"
      return(data.frame(name = nm, label = lb, stringsAsFactors = FALSE))
    }
  }
  # Fallback: leer attr(, "labels") de una columna representativa
  if (!is.null(fallback_col)) {
    labs <- attr(fallback_col, "labels", exact = TRUE)
    if (!is.null(labs) && length(labs) > 0L) {
      pairs <- .bases_label_pairs(labs)
      return(data.frame(
        name = pairs$code,
        label = pairs$label,
        stringsAsFactors = FALSE
      ))
    }
  }
  data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE)
}

.bases_norm_text <- function(x) {
  out <- as.character(x %||% "")
  out <- chartr("áéíóúÁÉÍÓÚüÜñÑ", "aeiouAEIOUuUnN", out)
  out <- iconv(out, from = "", to = "ASCII//TRANSLIT", sub = "")
  out <- tolower(out)
  out <- gsub("[^a-z0-9]+", " ", out)
  out <- trimws(out)
  gsub("\\s+", " ", out)
}

.bases_survey_list_name <- function(row) {
  if (is.null(row) || !is.data.frame(row) || !nrow(row)) return("")
  if ("list_name" %in% names(row)) {
    list_name <- as.character(row$list_name[1] %||% "")
    if (!is.na(list_name) && nzchar(trimws(list_name))) return(trimws(list_name))
  }
  type <- as.character(row$type[1] %||% "")
  if (is.na(type) || !nzchar(type)) return("")
  parts <- strsplit(trimws(type), "\\s+", perl = TRUE)[[1]]
  if (length(parts) >= 2L) parts[2] else ""
}

.bases_choice_pairs_for_var <- function(df, rp_inst, var) {
  sv <- rp_inst$survey
  if (is.null(sv) || !is.data.frame(sv) || !"name" %in% names(sv)) {
    return(data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE))
  }
  survey_names <- as.character(sv$name)
  row <- sv[!is.na(survey_names) & survey_names == var, , drop = FALSE]
  if (!nrow(row)) {
    return(data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE))
  }
  choices <- .choices_desde_instrumento(
    rp_inst,
    .bases_survey_list_name(row[1, , drop = FALSE]),
    fallback_col = df[[var]]
  )
  if (!nrow(choices)) {
    return(data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE))
  }
  choices$name <- as.character(choices$name)
  choices$label <- as.character(choices$label)
  choices <- choices[!is.na(choices$name) & nzchar(choices$name), , drop = FALSE]
  choices[!duplicated(choices$name), , drop = FALSE]
}

.bases_other_text_col <- function(df, var) {
  candidates <- c(
    paste0(var, "_other"),
    paste0(var, "_otro"),
    paste0(var, "_otros"),
    paste0(var, "_specify"),
    paste0(var, "_other_text")
  )
  hit <- intersect(candidates, names(df))
  if (length(hit)) hit[1] else NULL
}

.bases_other_choice_code <- function(choices) {
  if (is.null(choices) || !nrow(choices)) return(NA_character_)
  text <- .bases_norm_text(paste(choices$name, choices$label))
  idx <- which(grepl("\\b(otro|otra|otros|otras|other)\\b|especific", text, perl = TRUE))
  if (!length(idx)) return(NA_character_)
  as.character(choices$name[idx[1]])
}

.bases_code_from_value <- function(value, choices) {
  raw <- trimws(as.character(value %||% ""))
  if (is.na(raw) || !nzchar(raw)) return(NA_character_)
  codes <- as.character(choices$name)
  if (raw %in% codes) return(raw)
  raw_norm <- .bases_norm_text(raw)
  labels_norm <- .bases_norm_text(choices$label)
  idx <- which(labels_norm == raw_norm)[1]
  if (!is.na(idx)) return(as.character(choices$name[idx]))
  NA_character_
}

.bases_normalize_select_one_other <- function(parent, other, choices, other_code) {
  raw <- as.character(parent)
  other_txt <- trimws(as.character(other))
  other_txt[is.na(other_txt)] <- ""
  out <- vapply(raw, .bases_code_from_value, character(1), choices = choices)
  raw_txt <- trimws(raw)
  raw_txt[is.na(raw_txt)] <- ""
  has_other <- nzchar(other_txt)
  same_as_other <- has_other & .bases_norm_text(raw_txt) == .bases_norm_text(other_txt)
  needs_other <- has_other & (!nzchar(raw_txt) | is.na(out) | same_as_other)
  if (!is.na(other_code) && nzchar(other_code)) {
    out[needs_other] <- other_code
  } else {
    out[needs_other] <- NA_character_
  }
  keep_raw <- is.na(out) & nzchar(raw_txt)
  out[keep_raw] <- raw_txt[keep_raw]
  out[!nzchar(raw_txt) & !needs_other] <- NA_character_
  out
}

.bases_normalize_select_multiple_other <- function(parent, other, choices, other_code) {
  raw <- as.character(parent)
  other_txt <- trimws(as.character(other))
  other_txt[is.na(other_txt)] <- ""
  codes <- as.character(choices$name)
  vapply(seq_along(raw), function(i) {
    raw_i <- trimws(raw[[i]] %||% "")
    if (is.na(raw_i)) raw_i <- ""
    other_i <- other_txt[[i]] %||% ""
    has_other <- nzchar(other_i)
    if (!nzchar(raw_i) && !has_other) return(NA_character_)

    direct <- .bases_code_from_value(raw_i, choices)
    selected <- if (!is.na(direct)) direct else character(0)
    if (!length(selected) && nzchar(raw_i)) {
      toks <- strsplit(raw_i, "[\\s;,]+", perl = TRUE)[[1]]
      toks <- toks[nzchar(toks)]
      selected <- toks[toks %in% codes]
    }
    unknown_text <- nzchar(raw_i) && !identical(.bases_norm_text(raw_i), paste(.bases_norm_text(selected), collapse = " "))
    if (has_other && (unknown_text || !length(selected)) && !is.na(other_code) && nzchar(other_code)) {
      selected <- c(selected, other_code)
    }
    selected <- unique(selected[nzchar(selected)])
    if (length(selected)) paste(selected, collapse = " ") else if (nzchar(raw_i)) raw_i else NA_character_
  }, character(1), USE.NAMES = FALSE)
}

.bases_restore_vector_attrs <- function(x, template) {
  attrs <- attributes(template)
  for (nm in setdiff(names(attrs), c("names", "dim", "dimnames"))) {
    attr(x, nm) <- attrs[[nm]]
  }
  x
}

# SurveyMonkey puede entregar el texto libre de "Otro" duplicado: en el campo
# select madre y tambien en la columna `<var>_other`. Para los exports, el
# campo madre debe conservar solo codigos validos del XLSForm; el texto libre
# queda en su columna companion.
.bases_normalize_other_selects <- function(df, rp_inst) {
  if (!is.data.frame(df) || !length(names(df))) return(df)
  sv <- rp_inst$survey
  if (is.null(sv) || !is.data.frame(sv) || !all(c("name", "type") %in% names(sv))) return(df)

  for (var in intersect(as.character(sv$name), names(df))) {
    survey_names <- as.character(sv$name)
    row <- sv[!is.na(survey_names) & survey_names == var, , drop = FALSE]
    base <- .bases_xlsform_base_type(row$type[1])
    if (!base %in% c("select_one", "select_multiple")) next
    other_col <- .bases_other_text_col(df, var)
    if (is.null(other_col)) next
    choices <- .bases_choice_pairs_for_var(df, rp_inst, var)
    if (!nrow(choices)) next
    other_code <- .bases_other_choice_code(choices)

    parent <- df[[var]]
    normalized <- if (identical(base, "select_multiple")) {
      .bases_normalize_select_multiple_other(parent, df[[other_col]], choices, other_code)
    } else {
      .bases_normalize_select_one_other(parent, df[[other_col]], choices, other_code)
    }
    df[[var]] <- .bases_restore_vector_attrs(normalized, parent)
  }

  df
}

.bases_clean_choice_df <- function(df) {
  if (is.null(df) || !is.data.frame(df) || !nrow(df)) return(df)
  label_cols <- grep("^label", names(df), value = TRUE, ignore.case = TRUE)
  if (!length(label_cols)) return(df)
  codes <- if ("name" %in% names(df)) {
    as.character(df$name)
  } else if ("value" %in% names(df)) {
    as.character(df$value)
  } else {
    rep("", nrow(df))
  }
  groups <- if ("list_name" %in% names(df)) {
    split(seq_len(nrow(df)), as.character(df$list_name))
  } else {
    list(seq_len(nrow(df)))
  }
  for (col in label_cols) {
    for (idx in groups) {
      df[[col]][idx] <- .bases_clean_choice_labels(codes[idx], df[[col]][idx])
    }
  }
  df
}

.bases_clean_report_instrument <- function(inst) {
  if (is.null(inst) || !is.list(inst)) return(inst)
  original_class <- class(inst)

  inst$choices <- .bases_clean_choice_df(inst$choices)
  inst$choices_raw <- .bases_clean_choice_df(inst$choices_raw)

  ch <- inst$choices
  if (!is.null(ch) && is.data.frame(ch) && all(c("list_name", "name") %in% names(ch))) {
    label_col <- if ("label" %in% names(ch)) {
      "label"
    } else {
      grep("^label", names(ch), value = TRUE, ignore.case = TRUE)[1]
    }
    if (!is.na(label_col) && nzchar(label_col)) {
      keep <- !is.na(ch$list_name) & nzchar(as.character(ch$list_name)) &
        !is.na(ch$name) & nzchar(as.character(ch$name)) &
        !is.na(ch[[label_col]])
      ch_valid <- ch[keep, , drop = FALSE]
      if (nrow(ch_valid)) {
        by_list <- split(ch_valid, as.character(ch_valid$list_name))
        inst$dicc_code_to_label <- lapply(by_list, function(x) {
          stats::setNames(as.character(x[[label_col]]), as.character(x$name))
        })
        inst$dicc_label_to_code <- lapply(by_list, function(x) {
          stats::setNames(as.character(x$name), as.character(x[[label_col]]))
        })

        if (!is.null(inst$orders_list) && length(inst$orders_list) &&
            !is.null(inst$survey) && is.data.frame(inst$survey) &&
            all(c("name", "type") %in% names(inst$survey))) {
          survey_names <- as.character(inst$survey$name)
          for (var in names(inst$orders_list)) {
            row <- inst$survey[!is.na(survey_names) & survey_names == var, , drop = FALSE]
            if (!nrow(row)) next
            ln <- .bases_survey_list_name(row[1, , drop = FALSE])
            if (!nzchar(ln) || is.null(inst$dicc_code_to_label[[ln]])) next
            codes_labels <- inst$dicc_code_to_label[[ln]]
            inst$orders_list[[var]]$names <- names(codes_labels)
            inst$orders_list[[var]]$labels <- unname(codes_labels)
          }
        }
      }
    }
  }

  if (!is.null(original_class)) class(inst) <- original_class
  inst
}

.bases_clean_report_data_labels <- function(data) {
  if (!is.data.frame(data) || !length(names(data))) return(data)
  for (v in names(data)) {
    labs <- attr(data[[v]], "labels", exact = TRUE)
    if (is.null(labs) || !length(labs)) next
    pairs <- .bases_label_pairs(labs)
    if (!nrow(pairs)) next
    attr(data[[v]], "labels") <- stats::setNames(as.character(pairs$label), as.character(pairs$code))
  }
  data
}

.bases_normalize_report_context <- function(data, inst, normalize_other = TRUE) {
  inst <- .bases_clean_report_instrument(inst)
  if (isTRUE(normalize_other)) {
    data <- .bases_normalize_other_selects(data, inst)
  }
  data <- .bases_clean_report_data_labels(data)
  list(data = data, inst = inst)
}

.bases_normalize_source_contexts <- function(data_sources, inst_sources, normalize_other = TRUE) {
  if (!is.list(data_sources) || is.data.frame(data_sources) ||
      !is.list(inst_sources) || is.data.frame(inst_sources)) {
    return(list(data_sources = data_sources, inst_sources = inst_sources))
  }
  common <- intersect(names(data_sources), names(inst_sources))
  if (!length(common)) {
    return(list(data_sources = data_sources, inst_sources = inst_sources))
  }
  for (nm in common) {
    ctx <- .bases_normalize_report_context(
      data_sources[[nm]],
      inst_sources[[nm]],
      normalize_other = normalize_other
    )
    data_sources[[nm]] <- ctx$data
    inst_sources[[nm]] <- ctx$inst
  }
  list(data_sources = data_sources, inst_sources = inst_sources)
}

# Slug-ifica un string para usarlo como sufijo de columna (ASCII, sin
# espacios). Preserva códigos numéricos ("1" → "1").
.slug_code <- function(s) {
  s <- as.character(s)
  s <- iconv(s, to = "ASCII//TRANSLIT", sub = "")
  s <- tolower(s)
  s <- gsub("[^a-z0-9]+", "_", s)
  s <- gsub("^_+|_+$", "", s)
  s[!nzchar(s)] <- "na"
  s
}

# Expande columnas select_multiple a dummies 0/1. Para cada variable `v`
# con choices (a, b, c, ...) crea `v___a`, `v___b`, `v___c` con valor 1 si
# el código aparece en la respuesta (split por espacios; soporta formatos
# "1 3 5" y "1;3;5"). Las columnas originales select_multiple se quitan.
.expand_multiselect <- function(df, rp_inst) {
  ms <- .detect_multiselect(df, rp_inst)
  if (length(ms) == 0L) return(df)

  # Preserva atributos top-level del data frame.
  top_attrs <- attributes(df)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))

  out <- df[, 0, drop = FALSE]

  for (v in names(df)) {
    if (!v %in% names(ms)) {
      out[[v]] <- df[[v]]
      next
    }

    col <- df[[v]]
    choices <- .choices_desde_instrumento(rp_inst, ms[[v]], fallback_col = col)
    if (nrow(choices) == 0L) {
      # No podemos expandir: devolvemos la columna original en su posición.
      out[[v]] <- col
      next
    }

    # Normalizar respuestas: split por espacio o punto y coma, tomar no-vacíos.
    raw <- as.character(col)
    raw[is.na(raw)] <- ""
    tokens_per_row <- strsplit(raw, "[\\s;,]+", perl = TRUE)
    var_label <- attr(col, "label", exact = TRUE) %||% v
    for (i in seq_len(nrow(choices))) {
      code <- choices$name[i]
      label <- choices$label[i]
      new_name <- sprintf("%s___%s", v, .slug_code(code))
      # Evitar colisión si ya existe
      if (new_name %in% names(out)) {
        new_name <- sprintf("%s___c%s", v, .slug_code(code))
      }
      while (new_name %in% names(out)) {
        new_name <- paste0(new_name, "_")
      }
      hit <- vapply(tokens_per_row, function(t) any(t == code), logical(1))
      dummy <- as.integer(hit)
      # Filas donde la respuesta original está NA o vacía → NA (no 0).
      na_rows <- is.na(col) | !nzchar(raw)
      dummy[na_rows] <- NA_integer_
      attr(dummy, "label") <- sprintf("%s = %s", var_label, label)
      attr(dummy, "labels") <- stats::setNames(c(0L, 1L), c("No", "Sí"))
      attr(dummy, "measure") <- "nominal"
      attr(dummy, "format.spss") <- "F1.0"
      out[[new_name]] <- haven::labelled_spss(dummy, labels = c("No" = 0, "Sí" = 1))
      attr(out[[new_name]], "label") <- sprintf("%s = %s", var_label, label)
      attr(out[[new_name]], "measure") <- "nominal"
      attr(out[[new_name]], "format.spss") <- "F1.0"
    }
  }

  # Restaurar atributos top-level del df original.
  for (nm in keep_attrs) attr(out, nm) <- top_attrs[[nm]]
  out
}

# ---- Aplicación de etiquetas (códigos → labels) ---------------------------

# Reemplaza cada código por su etiqueta en columnas con `attr(, "labels")`.
# Modo:
#   "codigos"         → no-op, devuelve df tal cual
#   "etiquetas"       → select_one: código → label; select_multiple: "1 3 5"
#                       → "Label A | Label C | Label E" (separador " | ")
# Multi-select:
#   - "codigos_crudos"   → preserva la respuesta tal cual (no decodifica)
#   - "etiquetas_unidas" → join con " | " (solo efectivo si valores="etiquetas")
#   - "dummy_01"         → se expande antes con .expand_multiselect; en ese
#                          punto ya no hay strings multi-select en df.
.aplicar_etiquetas <- function(df, rp_inst, valores = "etiquetas",
                                multi_select = "etiquetas_unidas") {
  if (valores == "codigos") return(df)

  ms_cols <- names(.detect_multiselect(df, rp_inst))

  for (v in names(df)) {
    col <- df[[v]]
    labs <- attr(col, "labels", exact = TRUE)
    if (is.null(labs) || length(labs) == 0L) next

    pairs <- .bases_label_pairs(labs)
    if (!nrow(pairs)) next
    map_cod_to_lab <- stats::setNames(pairs$label, pairs$code)

    is_multi <- v %in% ms_cols
    raw <- as.character(col)

    if (is_multi) {
      if (multi_select == "codigos_crudos") next
      # "etiquetas_unidas": split + decode + join
      new_vals <- vapply(raw, function(s) {
        if (is.na(s) || !nzchar(s)) return(NA_character_)
        toks <- strsplit(s, "[\\s;,]+", perl = TRUE)[[1]]
        toks <- toks[nzchar(toks)]
        mapped <- map_cod_to_lab[toks]
        mapped[is.na(mapped)] <- toks[is.na(mapped)]
        paste(mapped, collapse = " | ")
      }, character(1), USE.NAMES = FALSE)
    } else {
      # select_one: mapear directo
      new_vals <- map_cod_to_lab[raw]
      new_vals[is.na(new_vals) & !is.na(raw)] <- raw[is.na(new_vals) & !is.na(raw)]
    }

    # Preservar atributo `label` (variable label) pero quitar `labels`
    # (value-labels) porque la columna ahora es texto libre.
    var_label <- attr(col, "label", exact = TRUE)
    df[[v]] <- new_vals
    if (!is.null(var_label)) attr(df[[v]], "label") <- var_label
  }

  df
}

# ---- CSV writer ------------------------------------------------------------

# Escribe un CSV UTF-8 con BOM (para Excel en Windows/es). Soporta ,
# o ; como separador. Los NA se escriben como "" para que Excel los
# muestre vacíos en vez de "NA".
.bases_write_csv <- function(df, path, separador = ",") {
  # Quitar atributos de haven_labelled para que write.csv lo trate como
  # columna plana. El data que llega puede venir con o sin etiquetas
  # aplicadas (según valores= en la config).
  for (v in names(df)) {
    col <- df[[v]]
    if (inherits(col, c("haven_labelled", "haven_labelled_spss"))) {
      df[[v]] <- unclass(col)
      attributes(df[[v]]) <- NULL
    }
  }
  # Construir fila de variable-labels (si están disponibles) como segundo
  # header opcional. Decidimos NO escribirlo en CSV para mantener el
  # archivo RFC-compliant; los labels viven en Excel.
  dec <- if (separador == ";") "," else "."
  con <- file(path, open = "wt", encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  # BOM para Excel
  writeLines("\ufeff", con, sep = "")
  utils::write.table(
    df, file = con, sep = separador, dec = dec,
    row.names = FALSE, col.names = TRUE,
    qmethod = "double", na = "", quote = TRUE, fileEncoding = ""
  )
  path
}

# ---- XLSX writer -----------------------------------------------------------

# Escribe un XLSX con una o dos hojas según `valores`:
#   "codigos"   → hoja única "datos"
#   "etiquetas" → hoja única "datos"
#   "ambos"     → dos hojas: "codigos" + "etiquetas"
# En cada hoja, la fila 1 son los nombres técnicos (para programmatic
# use) y la fila 2 son los labels de variable (legible). Los datos
# empiezan en la fila 3. El analista puede ocultar la fila 2 desde Excel
# si prefiere una tabla plana.
.bases_write_xlsx <- function(df_cod, df_lab, path, valores = "ambos") {
  wb <- openxlsx::createWorkbook()

  escribir_hoja <- function(sheet_name, data) {
    openxlsx::addWorksheet(wb, sheet_name)
    # Fila 1: nombres técnicos
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(names(data)), stringsAsFactors = FALSE), colNames = FALSE, startRow = 1L)
    # Fila 2: labels de variable (si existen)
    var_labels <- vapply(data, function(c) {
      l <- attr(c, "label", exact = TRUE)
      if (is.null(l)) "" else as.character(l)
    }, character(1))
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(var_labels), stringsAsFactors = FALSE), colNames = FALSE, startRow = 2L)
    # Limpia atributos haven antes de escribir (writeData no los respeta).
    for (v in names(data)) {
      col <- data[[v]]
      if (inherits(col, c("haven_labelled", "haven_labelled_spss"))) {
        data[[v]] <- unclass(col)
        attributes(data[[v]]) <- NULL
      }
    }
    openxlsx::writeData(wb, sheet_name, data, startRow = 3L, colNames = FALSE)
    # Estilo: fila 1 bold + fondo gris claro, fila 2 italic + gris más claro
    header1 <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED", halign = "left")
    header2 <- openxlsx::createStyle(textDecoration = "italic", fontColour = "#5F6368", fgFill = "#F6F7F9")
    openxlsx::addStyle(wb, sheet_name, header1, rows = 1L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::addStyle(wb, sheet_name, header2, rows = 2L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::freezePane(wb, sheet_name, firstActiveRow = 3L)
    openxlsx::setColWidths(wb, sheet_name, cols = seq_along(data), widths = "auto")
  }

  if (valores == "ambos") {
    escribir_hoja("codigos", df_cod)
    escribir_hoja("etiquetas", df_lab)
  } else if (valores == "etiquetas") {
    escribir_hoja("datos", df_lab)
  } else {
    escribir_hoja("datos", df_cod)
  }

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# ---- Generador SPSS syntax (.sps) de respaldo -----------------------------

# Implementación local de generación de niveles_medida.sps. Previamente
# se usaba generar_spss_niveles dentro de reporte_spss. Aquí
# lo replicamos en la app para tener control total del toggle "Avanzado".
.bases_generar_sps <- function(df, path_sps) {
  lines <- character(0)
  lines <- c(lines, "* Niveles de medida y formatos de respaldo.")
  lines <- c(lines, "* Ejecutar este syntax después de abrir el .sav si SPSS no respetó los atributos embebidos.")
  lines <- c(lines, "")

  # VARIABLE LEVEL (por measure)
  por_medida <- list(nominal = character(0), ordinal = character(0), scale = character(0))
  for (v in names(df)) {
    m <- attr(df[[v]], "measure", exact = TRUE)
    if (is.null(m)) next
    if (m %in% names(por_medida)) por_medida[[m]] <- c(por_medida[[m]], v)
  }
  for (m in names(por_medida)) {
    if (length(por_medida[[m]]) == 0L) next
    lines <- c(lines,
               sprintf("VARIABLE LEVEL %s (%s).",
                       paste(por_medida[[m]], collapse = " "),
                       toupper(m)))
  }
  lines <- c(lines, "")

  # FORMATS (por format.spss)
  por_fmt <- list()
  for (v in names(df)) {
    f <- attr(df[[v]], "format.spss", exact = TRUE)
    if (is.null(f)) next
    por_fmt[[f]] <- c(por_fmt[[f]], v)
  }
  for (f in names(por_fmt)) {
    lines <- c(lines,
               sprintf("FORMATS %s (%s).",
                       paste(por_fmt[[f]], collapse = " "),
                       f))
  }
  lines <- c(lines, "")
  lines <- c(lines, "EXECUTE.")

  # Convertimos a UTF-8 explícitamente para evitar warnings de conversión
  # si el locale del proceso es C/POSIX.
  lines <- enc2utf8(lines)
  con <- file(path_sps, open = "wb")
  on.exit(close(con), add = TRUE)
  writeBin(charToRaw(paste0(paste(lines, collapse = "\n"), "\n")), con)
  path_sps
}

# Normaliza toda string (columnas + atributos label/labels) a UTF-8.
# Es crítico antes de haven::write_sav: si una columna tiene strings con
# encoding marcado como "unknown" o "latin1", readstat rechaza el archivo
# al releerlo ("Unable to convert string to the requested encoding").
.bases_enforce_utf8 <- function(df) {
  for (v in names(df)) {
    col <- df[[v]]
    # Atributos de strings
    lab <- attr(col, "label", exact = TRUE)
    if (is.character(lab)) {
      attr(df[[v]], "label") <- enc2utf8(lab)
    }
    labs <- attr(col, "labels", exact = TRUE)
    if (!is.null(labs)) {
      # names(labs) suelen ser las etiquetas visibles; reforzamos UTF-8
      if (is.character(names(labs))) {
        names(labs) <- enc2utf8(names(labs))
      }
      if (is.character(labs)) {
        labs_utf8 <- enc2utf8(as.character(labs))
        labs <- stats::setNames(labs_utf8, names(labs))
      }
      attr(df[[v]], "labels") <- labs
    }
    # Columnas character
    if (is.character(col)) {
      df[[v]] <- enc2utf8(col)
    } else if (is.factor(col)) {
      levels(df[[v]]) <- enc2utf8(levels(col))
    }
  }
  df
}

.bases_pyreadstat_python <- function() {
  candidates <- unique(c(
    Sys.getenv("PROSECNUR_PYREADSTAT_PYTHON", unset = ""),
    Sys.which("python3"),
    Sys.which("python")
  ))
  candidates <- candidates[nzchar(candidates)]
  if (!length(candidates)) return("")

  probe <- "import pandas, pyreadstat"
  for (py in candidates) {
    ok <- suppressWarnings(system2(py, c("-c", shQuote(probe)),
                                   stdout = FALSE, stderr = FALSE))
    if (identical(ok, 0L)) return(py)
  }
  ""
}

.bases_pyreadstat_available <- function() {
  nzchar(.bases_pyreadstat_python())
}

.bases_sav_storage_kind <- function(x) {
  if (inherits(x, c("haven_labelled", "haven_labelled_spss"))) return("numeric")
  if (is.numeric(x) || is.integer(x) || is.logical(x)) return("numeric")
  if (inherits(x, c("Date", "POSIXct", "POSIXt"))) return("string")
  "string"
}

.bases_sav_plain_data <- function(df) {
  out <- as.data.frame(df, check.names = FALSE, stringsAsFactors = FALSE)
  for (v in names(out)) {
    x <- out[[v]]
    if (inherits(x, c("haven_labelled", "haven_labelled_spss"))) {
      x <- suppressWarnings(as.numeric(x))
    } else if (is.factor(x)) {
      x <- as.character(x)
    } else if (inherits(x, "Date")) {
      x <- format(x, "%Y-%m-%d")
    } else if (inherits(x, c("POSIXct", "POSIXt"))) {
      x <- format(x, "%Y-%m-%d %H:%M:%S")
    } else if (is.logical(x)) {
      x <- as.integer(x)
    }
    out[[v]] <- x
  }
  out
}

.bases_sav_value_labels <- function(x, storage) {
  pairs <- .bases_label_pairs(attr(x, "labels", exact = TRUE))
  if (!nrow(pairs)) return(list())
  out <- lapply(seq_len(nrow(pairs)), function(i) {
    code <- pairs$code[[i]]
    if (identical(storage, "numeric")) {
      code_num <- suppressWarnings(as.numeric(code))
      if (is.na(code_num)) return(NULL)
      code <- code_num
    }
    list(code = code, label = pairs$label[[i]])
  })
  Filter(Negate(is.null), out)
}

.bases_sav_missing_ranges <- function(x, storage) {
  vals <- attr(x, "na_values", exact = TRUE) %||% attr(x, "missing_values", exact = TRUE)
  rng <- attr(x, "na_range", exact = TRUE)
  out <- list()
  if (!is.null(vals) && length(vals)) {
    vals <- as.vector(vals)
    vals <- vals[!is.na(vals)]
    if (length(vals)) {
      if (identical(storage, "numeric")) vals <- suppressWarnings(as.numeric(vals))
      out <- c(out, as.list(vals))
    }
  }
  if (!is.null(rng) && length(rng) >= 2L && identical(storage, "numeric")) {
    rng <- suppressWarnings(as.numeric(rng[1:2]))
    if (!any(is.na(rng))) out <- c(out, list(list(lo = min(rng), hi = max(rng))))
  }
  out
}

.bases_write_sav_pyreadstat <- function(df, path_sav) {
  py <- .bases_pyreadstat_python()
  if (!nzchar(py)) {
    stop("pyreadstat no disponible en python3.", call. = FALSE)
  }

  plain <- .bases_sav_plain_data(df)
  data_path <- tempfile(fileext = ".csv")
  meta_path <- tempfile(fileext = ".json")
  script_path <- tempfile(fileext = ".py")
  out_tmp <- tempfile(fileext = ".sav")
  on.exit(unlink(c(data_path, meta_path, script_path, out_tmp), force = TRUE), add = TRUE)

  columns <- lapply(names(df), function(v) {
    x <- df[[v]]
    storage <- .bases_sav_storage_kind(plain[[v]])
    label <- attr(x, "label", exact = TRUE) %||% ""
    if (!is.character(label) || !length(label) || is.na(label[1L]) || !nzchar(label[1L])) {
      label <- v
    }
    list(
      name = v,
      storage = storage,
      label = label[1L],
      measure = attr(x, "measure", exact = TRUE) %||% "unknown",
      format = attr(x, "format.spss", exact = TRUE) %||% "",
      display_width = attr(x, "display_width", exact = TRUE) %||% NA_integer_,
      value_labels = .bases_sav_value_labels(x, storage),
      missing_ranges = .bases_sav_missing_ranges(x, storage)
    )
  })
  names(columns) <- names(df)

  readr::write_csv(plain, data_path, na = "")
  jsonlite::write_json(
    list(columns = columns),
    meta_path,
    auto_unbox = TRUE,
    null = "null",
    pretty = FALSE
  )

  py_code <- c(
    "import json, sys",
    "import pandas as pd",
    "import pyreadstat",
    "",
    "csv_path, meta_path, out_path = sys.argv[1:4]",
    "with open(meta_path, 'r', encoding='utf-8') as fh:",
    "    meta = json.load(fh)",
    "df = pd.read_csv(csv_path, dtype=str, keep_default_na=False, na_filter=False)",
    "columns = meta.get('columns', {})",
    "column_labels = {}",
    "variable_measure = {}",
    "variable_format = {}",
    "variable_display_width = {}",
    "variable_value_labels = {}",
    "missing_ranges = {}",
    "",
    "def numeric_key(value):",
    "    try:",
    "        x = float(value)",
    "    except Exception:",
    "        return value",
    "    return int(x) if x.is_integer() else x",
    "",
    "for name, spec in columns.items():",
    "    storage = spec.get('storage', 'string')",
    "    if name not in df.columns:",
    "        continue",
    "    if storage == 'numeric':",
    "        df[name] = pd.to_numeric(df[name].replace('', pd.NA), errors='coerce')",
    "    else:",
    "        df[name] = df[name].astype(object)",
    "    label = spec.get('label') or ''",
    "    if label:",
    "        column_labels[name] = label",
    "    measure = spec.get('measure') or 'unknown'",
    "    if measure in ('nominal', 'ordinal', 'scale', 'unknown'):",
    "        variable_measure[name] = measure",
    "    fmt = spec.get('format') or ''",
    "    if fmt:",
    "        variable_format[name] = fmt",
    "    width = spec.get('display_width')",
    "    if isinstance(width, int) and width > 0:",
    "        variable_display_width[name] = width",
    "    labs = spec.get('value_labels') or []",
    "    if labs:",
    "        variable_value_labels[name] = {",
    "            (numeric_key(item.get('code')) if storage == 'numeric' else str(item.get('code'))): item.get('label', '')",
    "            for item in labs",
    "        }",
    "    miss = spec.get('missing_ranges') or []",
    "    if miss:",
    "        missing_ranges[name] = miss",
    "",
    "kwargs = dict(",
    "    column_labels=column_labels or None,",
    "    variable_value_labels=variable_value_labels or None,",
    "    variable_display_width=variable_display_width or None,",
    "    variable_measure=variable_measure or None,",
    "    variable_format=variable_format or None,",
    "    missing_ranges=missing_ranges or None,",
    "    row_compress=True,",
    ")",
    "kwargs = {k: v for k, v in kwargs.items() if v is not None}",
    "pyreadstat.write_sav(df, out_path, **kwargs)"
  )
  writeLines(py_code, script_path, useBytes = TRUE)

  if (file.exists(path_sav)) unlink(path_sav, force = TRUE)
  res <- suppressWarnings(system2(py, c(script_path, data_path, meta_path, out_tmp),
                                  stdout = TRUE, stderr = TRUE))
  status <- attr(res, "status")
  if (!is.null(status) && status != 0L) {
    stop(
      "pyreadstat no pudo escribir el SAV: ",
      paste(res, collapse = "\n"),
      call. = FALSE
    )
  }
  if (!file.exists(out_tmp) || file.info(out_tmp)$size <= 0L) {
    stop("pyreadstat no produjo un SAV valido.", call. = FALSE)
  }
  ok <- file.copy(out_tmp, path_sav, overwrite = TRUE)
  if (!isTRUE(ok) || !file.exists(path_sav) || file.info(path_sav)$size <= 0L) {
    stop("No se pudo copiar el SAV generado al destino final.", call. = FALSE)
  }
  invisible(path_sav)
}

# ---- Metadatos: preview + overrides --------------------------------------

# Devuelve una lista de variables con la inferencia completa (tipo XLSForm,
# measure inferido, format.spss inferido, si tiene value-labels) para que la
# UI la muestre como tabla editable. La preview NO aplica overrides del
# usuario — expone solo lo que el motor inferiría por defecto. La UI
# mergea con los overrides del store para el display final.
.bases_metadata_preview <- function(df, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv)) sv <- data.frame(name = character(0), type = character(0), stringsAsFactors = FALSE)
  out <- vector("list", length(names(df)))
  for (i in seq_along(names(df))) {
    v <- names(df)[i]
    col <- df[[v]]
    row <- sv[sv$name %in% v, , drop = FALSE]
    tipo <- if (nrow(row) > 0L) as.character(row$type[1]) else ""
    base <- sub("\\s.*$", "", tipo)
    label <- attr(col, "label", exact = TRUE) %||% ""
    if (is.character(label)) label <- enc2utf8(label)
    has_labels <- !is.null(attr(col, "labels", exact = TRUE))
    inferred_measure <- .infer_measure(v, col, sv)
    # Para el preview, format.spss NA se presenta como "auto" (haven lo
    # inferirá al escribir). El usuario puede overridearlo si quiere
    # forzar un ancho específico.
    inf_fmt <- .infer_spss_format(col)
    inferred_format_spss <- if (is.na(inf_fmt)) "auto" else inf_fmt
    out[[i]] <- list(
      name = v,
      label = label,
      tipo_xlsform = if (nzchar(base)) base else NA_character_,
      inferred_measure = inferred_measure,
      inferred_format_spss = inferred_format_spss,
      has_labels = has_labels
    )
  }
  out
}

# Normaliza overrides del store. `raw` es la lista tal cual sale del JSON
# (puede tener claves vacías, valores inválidos, etc.). Devuelve una
# estructura list(name -> list(measure=?, format_spss=?)) solo con
# entradas válidas.
.bases_overrides_parse <- function(raw) {
  if (is.null(raw) || length(raw) == 0L) return(list())
  valid_measures <- c("nominal", "ordinal", "scale")
  out <- list()
  if (is.list(raw)) {
    for (nm in names(raw)) {
      if (!nzchar(nm)) next
      ov <- raw[[nm]]
      if (!is.list(ov)) next
      clean <- list()
      if (!is.null(ov$measure)) {
        m <- as.character(ov$measure)[1]
        if (m %in% valid_measures) clean$measure <- m
      }
      if (!is.null(ov$format_spss)) {
        f <- as.character(ov$format_spss)[1]
        if (nzchar(f)) clean$format_spss <- f
      }
      if (length(clean) > 0L) out[[nm]] <- clean
    }
  }
  out
}

# Aplica los overrides sobre un df ya preparado (con measure / format.spss
# inferidos). Los overrides ganan sobre la inferencia.
.bases_apply_overrides <- function(df, overrides) {
  if (length(overrides) == 0L) return(df)
  for (nm in names(overrides)) {
    if (!nm %in% names(df)) next
    ov <- overrides[[nm]]
    if (!is.null(ov$measure)) attr(df[[nm]], "measure") <- ov$measure
    if (!is.null(ov$format_spss)) attr(df[[nm]], "format.spss") <- ov$format_spss
  }
  df
}

# ---- Helper global de export completo para .sav ---------------------------

# Prepara + escribe el .sav. Devuelve el path. Si `incluir_sps` es TRUE,
# también genera `niveles_medida.sps` en el mismo directorio.
# `overrides` es opcional: lista `name -> list(measure?, format_spss?)`.
.bases_export_sav <- function(df, rp_inst, path_sav, path_sps = NULL,
                              overrides = list()) {
  df <- .bases_normalize_other_selects(df, rp_inst)

  # 1) Convertir columnas con value-labels a haven_labelled_spss. Reusa
  #    el post-procesamiento de reporte_spss vía attrs — aplica
  #    la misma conversión pero sin correr ese wrapper (que escribe a
  #    disco).
  df2 <- .bases_coerce_spss_types(df, rp_inst)
  for (v in names(df2)) {
    x <- df2[[v]]
    labs <- attr(x, "labels", exact = TRUE)
    v_lab <- attr(x, "label", exact = TRUE)
    meas <- attr(x, "measure", exact = TRUE)
    fmt <- attr(x, "format.spss", exact = TRUE)
    dw <- attr(x, "display_width", exact = TRUE)

    if (!is.null(labs) && length(labs) > 0L) {
      pairs <- .bases_label_pairs(labs)
      codigos <- suppressWarnings(as.numeric(pairs$code))
      textos <- as.character(pairs$label)
      ok <- !is.na(codigos)
      codigos <- codigos[ok]
      textos <- textos[ok]
      dup <- duplicated(codigos)
      codigos <- codigos[!dup]
      textos <- textos[!dup]
      if (length(codigos) > 0L) {
        labs_new <- stats::setNames(codigos, textos)
        x_num <- suppressWarnings(as.numeric(x))
        df2[[v]] <- haven::labelled_spss(x_num, labels = labs_new)
      }
    }

    if (!is.null(v_lab)) attr(df2[[v]], "label") <- v_lab
    if (!is.null(meas)) attr(df2[[v]], "measure") <- meas
    if (!is.null(fmt)) attr(df2[[v]], "format.spss") <- fmt
    if (!is.null(dw)) attr(df2[[v]], "display_width") <- dw
  }

  # 2) Completar metadatos faltantes (measure/format.spss/display_width).
  df2 <- .bases_sav_prepare(df2, rp_inst)

  # 2b) Aplicar overrides del usuario sobre la inferencia. El usuario
  #     puede corregir un ordinal que quedó como nominal, o forzar un
  #     ancho A40 en una variable de texto específica.
  df2 <- .bases_apply_overrides(df2, overrides)

  # 3) Renombrar columnas que empiecen con "_" (no válidas en SPSS).
  bad <- grepl("^_", names(df2))
  if (any(bad)) {
    proposed <- sub("^_", "", names(df2)[bad])
    safe <- !(proposed %in% names(df2)[!bad])
    if (any(safe)) names(df2)[bad][safe] <- proposed[safe]
  }

  # 4) Tipos especiales (Date/POSIXct/hms) — si no se aplicó antes.
  instr <- attr(df2, "instrumento_reporte", exact = TRUE)
  vars_fecha <- attr(df2, "vars_fecha", exact = TRUE) %||% instr$vars_fecha
  vars_hora <- attr(df2, "vars_hora", exact = TRUE) %||% instr$vars_hora
  vars_dt <- attr(df2, "vars_datetime", exact = TRUE) %||% instr$vars_datetime
  if (length(vars_fecha)) {
    for (v in intersect(vars_fecha, names(df2))) {
      if (!inherits(df2[[v]], "Date")) df2[[v]] <- try(as.Date(df2[[v]]), silent = TRUE)
    }
  }
  if (length(vars_hora) && requireNamespace("hms", quietly = TRUE)) {
    for (v in intersect(vars_hora, names(df2))) {
      if (!inherits(df2[[v]], "hms")) df2[[v]] <- try(hms::as_hms(df2[[v]]), silent = TRUE)
    }
  }
  if (length(vars_dt)) {
    for (v in intersect(vars_dt, names(df2))) {
      if (!inherits(df2[[v]], "POSIXct")) df2[[v]] <- try(as.POSIXct(df2[[v]]), silent = TRUE)
    }
  }

  # 5) Normalizar encoding antes de escribir (evita "Unable to convert
  #    string to the requested encoding" al releer el .sav).
  df2 <- .bases_enforce_utf8(df2)

  # 6) Escribir. pyreadstat permite pasar variable_measure de manera
  # explícita; haven/readstat no siempre embebe ese metadata de forma
  # recuperable por SPSS/pyreadstat.
  writer <- Sys.getenv("PROSECNUR_SAV_WRITER", unset = "pyreadstat")
  if (identical(tolower(writer), "pyreadstat") && .bases_pyreadstat_available()) {
    .bases_write_sav_pyreadstat(df2, path_sav)
  } else {
    haven::write_sav(data = df2, path = path_sav, compress = TRUE)
  }

  if (!is.null(path_sps)) .bases_generar_sps(df2, path_sps)

  invisible(df2)
}
