# Generador de formularios en PDF para papel.
#
# Este motor no intenta reproducir Enketo/ODK. Toma el XLSForm como fuente
# de estructura y lo compila a una plantilla impresa Pulso: A4, tablas con
# codigos visibles, espacios para escribir y saltos como instrucciones.

.form_pdf_chr <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]] %||% default)
  if (is.na(out)) default else out
}

.form_pdf_is_yes <- function(x) {
  tolower(trimws(.form_pdf_chr(x))) %in% c("1", "yes", "true", "si", "s\u00ed", "x")
}

.form_pdf_clean_text <- function(x) {
  x <- .form_pdf_chr(x)
  x <- gsub("\u00a0", " ", x, fixed = TRUE)
  x <- gsub("\u2013|\u2014|\u2212", "-", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'", x, perl = TRUE)
  x <- gsub("\u201c|\u201d", "\"", x, perl = TRUE)
  x <- gsub("\\*\\*([^*]+)\\*\\*", "\\1", x, perl = TRUE)
  x <- gsub("__([^_]+)__", "\\1", x, perl = TRUE)
  x <- gsub("[`*]", "", x, perl = TRUE)
  x <- gsub("\\s+", " ", x, perl = TRUE)
  trimws(x)
}

.form_pdf_df <- function(df) {
  if (is.null(df)) return(data.frame(stringsAsFactors = FALSE, check.names = FALSE))
  out <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  names(out) <- as.character(names(out))
  for (nm in names(out)) {
    out[[nm]] <- as.character(out[[nm]])
    out[[nm]][is.na(out[[nm]])] <- ""
    Encoding(out[[nm]]) <- "UTF-8"
  }
  out
}

.form_pdf_ensure_cols <- function(df, cols) {
  df <- .form_pdf_df(df)
  for (col in cols) if (!col %in% names(df)) df[[col]] <- rep("", nrow(df))
  df
}

.form_pdf_cell <- function(df, row, col, default = "") {
  if (is.null(df) || !nrow(df) || !col %in% names(df) || row < 1L || row > nrow(df)) return(default)
  .form_pdf_chr(df[[col]][row], default)
}

.form_pdf_type_base <- function(type) {
  parts <- strsplit(trimws(.form_pdf_chr(type)), "\\s+")[[1]]
  if (!length(parts) || !nzchar(parts[1])) "" else parts[1]
}

.form_pdf_type_list <- function(type) {
  parts <- strsplit(trimws(.form_pdf_chr(type)), "\\s+")[[1]]
  if (length(parts) < 2L) "" else paste(parts[-1], collapse = " ")
}

.form_pdf_question_bases <- function() {
  c(
    "select_one", "select_multiple", "text", "integer", "decimal", "date", "time", "datetime",
    "geopoint", "geotrace", "geoshape", "barcode", "image", "audio", "video", "file", "acknowledge"
  )
}

.form_pdf_skip_bases <- function() {
  c(
    "", "start", "end", "today", "deviceid", "subscriberid", "simserial",
    "phonenumber", "username", "email", "audit", "calculate", "hidden",
    "end_group", "end_repeat"
  )
}

.form_pdf_setting <- function(settings, field, default = "") {
  if (is.null(settings) || !nrow(settings) || !field %in% names(settings)) return(default)
  .form_pdf_chr(settings[[field]][1], default)
}

.form_pdf_number_from_name <- function(name, fallback) {
  raw <- .form_pdf_chr(name)
  m <- regmatches(raw, regexec("^[A-Za-z_]*0*([0-9]+)(?:[_./-].*)?$", raw, perl = TRUE))[[1]]
  if (length(m) >= 2L) return(as.character(as.integer(m[2])))
  as.character(fallback)
}

.form_pdf_first_nonempty <- function(...) {
  vals <- list(...)
  for (val in vals) {
    txt <- .form_pdf_clean_text(val)
    if (nzchar(txt)) return(txt)
  }
  ""
}

.form_pdf_strip_leading_number <- function(label, number) {
  label <- .form_pdf_clean_text(label)
  number <- .form_pdf_clean_text(number)
  if (!nzchar(label)) return(label)
  if (nzchar(number)) {
    escaped <- gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", number, perl = TRUE)
    label <- gsub(paste0("^", escaped, "\\s*[).:-]?\\s+"), "", label, perl = TRUE)
  }
  trimws(gsub("^\\s*[0-9]+\\s*[).:-]\\s+", "", label, perl = TRUE))
}

.form_pdf_paper_text <- function(text, blank = "__________") {
  text <- .form_pdf_clean_text(text)
  if (!nzchar(text)) return(text)
  gsub("\\$\\{[^}]+\\}", blank, text, perl = TRUE)
}

.form_pdf_prefix <- function(name) {
  raw <- .form_pdf_chr(name)
  m <- regmatches(raw, regexec("^([A-Za-z_]*[0-9]+)[_./-].+$", raw, perl = TRUE))[[1]]
  if (length(m) >= 2L) m[2] else ""
}

.form_pdf_options_by_list <- function(choices) {
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  if (!nrow(choices)) return(list())
  rows <- split(choices, choices$list_name)
  rows <- rows[nzchar(names(rows))]
  lapply(rows, function(df) {
    lapply(seq_len(nrow(df)), function(i) {
      list(
        code = .form_pdf_chr(df$name[i]),
        label = .form_pdf_paper_text(df$label[i]),
        paper_skip = .form_pdf_clean_text(df$paper_skip[i])
      )
    })
  })
}

.form_pdf_parse_simple_relevant <- function(expr) {
  raw <- trimws(.form_pdf_chr(expr))
  if (!nzchar(raw)) return(NULL)

  m <- regmatches(raw, regexec("^selected\\(\\s*\\$\\{([^}]+)\\}\\s*,\\s*['\"]?([^'\")]+)['\"]?\\s*\\)$", raw, perl = TRUE))[[1]]
  if (length(m) >= 3L) {
    return(list(var = trimws(m[2]), value = trimws(m[3]), positive = TRUE, raw = raw))
  }

  m <- regmatches(raw, regexec("^\\$\\{([^}]+)\\}\\s*=\\s*['\"]?([^'\"]+)['\"]?$", raw, perl = TRUE))[[1]]
  if (length(m) >= 3L) {
    return(list(var = trimws(m[2]), value = trimws(m[3]), positive = TRUE, raw = raw))
  }

  m <- regmatches(raw, regexec("^\\$\\{([^}]+)\\}\\s*!=\\s*['\"]?([^'\"]+)['\"]?$", raw, perl = TRUE))[[1]]
  if (length(m) >= 3L) {
    return(list(var = trimws(m[2]), value = trimws(m[3]), positive = FALSE, raw = raw))
  }

  NULL
}

.form_pdf_display_numbers <- function(survey, matrix_keys = NULL, tenor_keys = character(0)) {
  # Numeracion de nivel superior. Por defecto SECUENCIAL: cada pregunta y cada
  # fila de matriz toma el siguiente entero correlativo. Excepcion: una matriz con
  # TENOR (su key esta en `tenor_keys`) consume UN solo numero X (en su 1a fila);
  # las demas filas quedan "" y build_model deriva la subnumeracion X.1..X.k.
  n <- nrow(survey)
  if (is.null(matrix_keys)) matrix_keys <- rep("", n)
  out <- rep("", n)
  last_num <- 0L
  assign_top <- function(row) {
    explicit <- .form_pdf_clean_text(survey$paper_number[row])
    # Sentinel "-": pregunta SIN numero (datos generales), no avanza el contador.
    if (identical(explicit, "-")) { out[row] <<- ""; return(invisible(NULL)) }
    if (nzchar(explicit)) {
      out[row] <<- explicit
      ne <- suppressWarnings(as.integer(explicit))
      if (!is.na(ne)) last_num <<- max(last_num, ne)
      return(invisible(NULL))
    }
    candidate <- suppressWarnings(as.integer(.form_pdf_number_from_name(survey$name[row], NA_integer_)))
    next_num <- if (!is.na(candidate) && candidate > last_num) candidate else last_num + 1L
    out[row] <<- as.character(next_num)
    last_num <<- next_num
    invisible(NULL)
  }

  i <- 1L
  while (i <= n) {
    key <- matrix_keys[i]
    if (nzchar(key) && key %in% tenor_keys) {
      # Matriz con tenor: un solo numero de nivel superior (en la 1a fila).
      j <- i
      while (j + 1L <= n && identical(matrix_keys[j + 1L], key)) j <- j + 1L
      assign_top(i)
      i <- j + 1L
      next
    }
    base <- .form_pdf_type_base(survey$type[i])
    explicit <- .form_pdf_clean_text(survey$paper_number[i])
    if (identical(explicit, "-")) { out[i] <- ""; i <- i + 1L; next }
    if (nzchar(explicit)) {
      out[i] <- explicit
      ne <- suppressWarnings(as.integer(explicit))
      if (!is.na(ne)) last_num <- max(last_num, ne)
      i <- i + 1L
      next
    }
    if (!base %in% .form_pdf_question_bases()) { i <- i + 1L; next }
    assign_top(i)
    i <- i + 1L
  }
  out
}

.form_pdf_next_number_after <- function(survey, numbers, start_idx) {
  if (start_idx >= nrow(survey)) return("FIN")
  for (j in seq.int(start_idx + 1L, nrow(survey))) {
    if (nzchar(numbers[j])) return(numbers[j])
  }
  "FIN"
}

# Dado un `begin_group`/`begin_repeat` en `start_idx`, devuelve el indice de su
# `end_group`/`end_repeat` correspondiente respetando el anidamiento. Sin cierre
# (grupo abierto hasta el final), devuelve la ultima fila.
.form_pdf_matching_group_end <- function(survey, start_idx) {
  n <- nrow(survey)
  depth <- 0L
  for (j in seq.int(start_idx, n)) {
    b <- .form_pdf_type_base(survey$type[j])
    if (b %in% c("begin_group", "begin_repeat")) {
      depth <- depth + 1L
    } else if (b %in% c("end_group", "end_repeat")) {
      depth <- depth - 1L
      if (depth <= 0L) return(j)
    }
  }
  n
}

.form_pdf_infer_choice_skips <- function(survey, choices_by_list, numbers, consent_var = "") {
  warnings <- character(0)
  skips <- list()
  name_to_row <- stats::setNames(seq_len(nrow(survey)), survey$name)
  manual_sources <- survey$name[nzchar(survey$paper_skip)]

  add_skip <- function(source, code, instruction) {
    if (!nzchar(source) || !nzchar(code) || source %in% manual_sources) return()
    current <- skips[[source]] %||% list()
    if (is.null(current[[code]]) || !nzchar(current[[code]])) {
      current[[code]] <- instruction
      skips[[source]] <<- current
    }
  }

  i <- 1L
  while (i <= nrow(survey)) {
    rel <- .form_pdf_clean_text(survey$relevant[i])
    if (!nzchar(rel)) {
      i <- i + 1L
      next
    }
    parsed <- .form_pdf_parse_simple_relevant(rel)
    if (is.null(parsed)) {
      warnings <- c(warnings, sprintf(
        "No se pudo inferir salto impreso para `%s`: relevant complejo.",
        .form_pdf_cell(survey, i, "name", sprintf("fila %d", i))
      ))
      i <- i + 1L
      next
    }

    source_row <- unname(name_to_row[parsed$var])
    if (!length(source_row) || is.na(source_row)) {
      warnings <- c(warnings, sprintf(
        "No se pudo inferir salto impreso para `%s`: variable origen `%s` no existe.",
        .form_pdf_cell(survey, i, "name", sprintf("fila %d", i)),
        parsed$var
      ))
      i <- i + 1L
      next
    }

    # Alcance de la condicion: si el `relevant` esta en un begin_group/begin_repeat,
    # el bloque condicionado es TODO el grupo (hasta su cierre con anidamiento); el
    # destino es la primera pregunta numerada DESPUES del cierre. Si no, la corrida
    # es la secuencia contigua de filas con el mismo relevant.
    base_i <- .form_pdf_type_base(survey$type[i])
    is_group <- base_i %in% c("begin_group", "begin_repeat")
    if (is_group) {
      run_end <- .form_pdf_matching_group_end(survey, i)
    } else {
      run_end <- i
      while (run_end + 1L <= nrow(survey) && identical(.form_pdf_clean_text(survey$relevant[run_end + 1L]), rel)) {
        run_end <- run_end + 1L
      }
    }
    destination <- .form_pdf_next_number_after(survey, numbers, run_end)
    # Consentimiento: sin el, no se abre ninguna otra seccion -> terminacion.
    is_consent <- nzchar(consent_var) && identical(parsed$var, consent_var)
    # Supresion de salto no-op: si el destino es la pregunta inmediatamente siguiente
    # al ORIGEN (no se salta ninguna pregunta en medio), no se emite. El consent
    # siempre enuncia su terminacion.
    imm_after_source <- .form_pdf_next_number_after(survey, numbers, source_row)
    advance <- if (is_group) i + 1L else run_end + 1L
    if (!is_consent && identical(destination, imm_after_source)) {
      i <- advance
      next
    }
    instruction <- if (is_consent || identical(destination, "FIN")) "Fin de la encuesta"
      else sprintf("pase a la pregunta %s", destination)

    list_name <- .form_pdf_type_list(survey$type[source_row])
    opts <- choices_by_list[[list_name]] %||% list()
    if (!length(opts)) {
      warnings <- c(warnings, sprintf(
        "No se pudo inferir salto impreso desde `%s`: no hay opciones en `%s`.",
        parsed$var,
        list_name
      ))
      i <- advance
      next
    }

    for (opt in opts) {
      code <- opt$code
      should_show <- if (isTRUE(parsed$positive)) identical(code, parsed$value) else !identical(code, parsed$value)
      if (!should_show) add_skip(parsed$var, code, instruction)
    }
    i <- advance
  }

  # Consentimiento como gate global: aunque ninguna pregunta lo referencie via
  # `relevant`, su opcion negativa (todo lo que no sea la 1a/afirmativa) TERMINA
  # la encuesta — el "No · Fin de encuesta" de la referencia. add_skip es
  # idempotente: no pisa un salto ya inferido ni un paper_skip manual.
  if (nzchar(consent_var)) {
    crow <- unname(name_to_row[consent_var])
    if (length(crow) == 1L && !is.na(crow)) {
      clist <- .form_pdf_type_list(survey$type[crow])
      copts <- choices_by_list[[clist]] %||% list()
      if (length(copts) >= 2L) {
        for (k in seq_along(copts)) {
          if (k > 1L) add_skip(consent_var, copts[[k]]$code, "Fin de la encuesta")
        }
      }
    }
  }

  list(skips = skips, warnings = unique(warnings))
}

.form_pdf_matrix_keys <- function(survey) {
  n <- nrow(survey)
  keys <- rep("", n)
  explicit <- survey$paper_group
  keys[nzchar(explicit)] <- paste0("manual:", explicit[nzchar(explicit)])

  i <- 1L
  while (i <= n) {
    if (nzchar(keys[i])) {
      i <- i + 1L
      next
    }
    base <- .form_pdf_type_base(survey$type[i])
    list_name <- .form_pdf_type_list(survey$type[i])
    prefix <- .form_pdf_prefix(survey$name[i])
    if (!(base %in% c("select_one", "select_multiple")) || !nzchar(list_name) || !nzchar(prefix)) {
      i <- i + 1L
      next
    }
    j <- i
    while (
      j <= n &&
        !nzchar(keys[j]) &&
        identical(.form_pdf_type_base(survey$type[j]), base) &&
        identical(.form_pdf_type_list(survey$type[j]), list_name) &&
        identical(.form_pdf_prefix(survey$name[j]), prefix)
    ) {
      j <- j + 1L
    }
    if ((j - i) >= 3L) keys[i:(j - 1L)] <- paste0("auto:", prefix, ":", list_name)
    i <- max(j, i + 1L)
  }
  keys
}

# Construye `matrix_keys` a partir de una agrupacion EXPLICITA enviada por el
# frontend (`options$matrix_groups`): lista de grupos. Cada grupo puede ser un
# vector de `name`s (forma vieja, sin tenor) o un objeto `{members:[names],
# tenor:"texto", special:"auto"|"none"|<codigo>}`. Valida existencia, contiguidad
# y >=2 miembros; grupos invalidos/parciales se ignoran con warning. Devuelve keys
# + tenors + specials por key. `special` fija la columna especial de la matriz:
# "auto"/ausente = heuristica contextual, "none" = sin especial (todo escala),
# "<codigo>" = fuerza esa opcion como especial.
.form_pdf_matrix_keys_from_groups <- function(survey, groups) {
  n <- nrow(survey)
  keys <- rep("", n)
  tenors <- list()
  specials <- list()
  headers <- list()
  warnings <- character(0)
  if (is.null(groups) || !length(groups)) return(list(keys = keys, tenors = tenors, specials = specials, headers = headers, warnings = warnings))
  name_to_row <- stats::setNames(seq_len(n), survey$name)
  gi <- 0L
  for (g in groups) {
    if (is.list(g) && !is.null(g[["members"]])) {
      members <- as.character(unlist(g[["members"]]))
      tenor <- .form_pdf_clean_text(g[["tenor"]] %||% "")
      special <- .form_pdf_clean_text(g[["special"]] %||% "")
      header <- .form_pdf_clean_text(g[["header"]] %||% "")
    } else {
      members <- as.character(unlist(g))
      tenor <- ""
      special <- ""
      header <- ""
    }
    # `special` normalizado: vacio -> "auto"; se conserva el codigo literal.
    if (!nzchar(special)) special <- "auto"
    # `header` = modo de cabecera: "auto" (default) | "extremos" | "categorias".
    header <- tolower(header)
    if (!header %in% c("extremos", "categorias")) header <- "auto"
    members <- members[nzchar(members)]
    if (!length(members)) next
    rows <- unname(name_to_row[members])
    if (anyNA(rows)) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: preguntas inexistentes (%s).",
        paste(members[is.na(rows)], collapse = ", ")))
      next
    }
    rows <- sort(unique(rows))
    if (length(rows) < 1L) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: sin preguntas válidas (%s).",
        paste(members, collapse = ", ")))
      next
    }
    if (!identical(rows, seq.int(rows[1], rows[length(rows)]))) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: las preguntas no son contiguas (%s).",
        paste(members, collapse = ", ")))
      next
    }
    if (any(nzchar(keys[rows]))) {
      warnings <- c(warnings, sprintf(
        "Grupo de matriz ignorado: solapa con otro grupo (%s).",
        paste(members, collapse = ", ")))
      next
    }
    gi <- gi + 1L
    gkey <- paste0("group:", gi)
    keys[rows] <- gkey
    tenors[[gkey]] <- tenor
    specials[[gkey]] <- special
    headers[[gkey]] <- header
  }
  list(keys = keys, tenors = tenors, specials = specials, headers = headers, warnings = warnings)
}

# Reescribe el verbo de salto legacy ("IR A LA PREGUNTA"/"IR AL FINAL") a la
# redaccion nueva ("Salto a la"/"Salto al final") en textos de salto manuales.
.form_pdf_rephrase_skip <- function(text) {
  t <- .form_pdf_clean_text(text)
  if (!nzchar(t)) return(t)
  t <- gsub("IR\\s+A\\s+LA\\s+PREGUNTA", "Salto a la", t, ignore.case = TRUE, perl = TRUE)
  t <- gsub("IR\\s+AL\\s+FINAL", "Salto al final", t, ignore.case = TRUE, perl = TRUE)
  t
}

# Redacta una "apertura de condición" a partir de un `relevant` simple. Resuelve
# var->numero de pregunta y value->etiqueta de la opcion. Devuelve list(text, warning).
# Si `consent_var` esta seteado y la condicion referencia esa variable, se OMITE la
# apertura (text=""): es la condicion global de consentimiento, obvia, no ruido por seccion.
.form_pdf_render_condition <- function(rel, nm, survey, choices_by_list, numbers, name_to_row, consent_var = "") {
  parsed <- .form_pdf_parse_simple_relevant(rel)
  if (is.null(parsed)) {
    return(list(text = "", warning = sprintf(
      "No se pudo enunciar la condicion para `%s`: relevant complejo.", nm)))
  }
  if (nzchar(consent_var) && identical(parsed$var, consent_var)) {
    return(list(text = "", warning = ""))  # condicion de consentimiento: no se enuncia
  }
  src <- unname(name_to_row[parsed$var])
  if (!length(src) || is.na(src)) {
    return(list(text = "", warning = sprintf(
      "No se pudo enunciar la condicion para `%s`: variable origen `%s` no existe.",
      nm, parsed$var)))
  }
  qnum <- .form_pdf_clean_text(numbers[src])
  ref <- if (nzchar(qnum)) paste0("la pregunta ", qnum) else paste0("`", parsed$var, "`")
  list_name <- .form_pdf_type_list(survey$type[src])
  opts <- choices_by_list[[list_name]] %||% list()
  lbl <- parsed$value
  for (o in opts) {
    if (identical(.form_pdf_clean_text(o$code), .form_pdf_clean_text(parsed$value))) {
      cand <- .form_pdf_clean_text(o$label %||% "")
      if (nzchar(cand)) lbl <- cand
      break
    }
  }
  verb <- if (isTRUE(parsed$positive)) "haber respondido" else "NO haber respondido"
  list(text = sprintf("En caso de %s «%s» en %s:", verb, lbl, ref), warning = "")
}

# Calcula la apertura de condicion por fila del survey (modo "condiciones"),
# deduplicando herencia de grupo y corridas del mismo relevant. Devuelve un vector
# alineado a las filas del survey (secciones y preguntas) + warnings.
.form_pdf_compute_openings <- function(survey, choices_by_list, numbers, consent_var = "") {
  n <- nrow(survey)
  openings <- rep("", n)
  warnings <- character(0)
  name_to_row <- stats::setNames(seq_len(n), survey$name)
  stack <- character(0)     # relevants de los grupos abiertos (puede incluir "")
  prev_relevant <- ""       # para dedup de corridas de preguntas consecutivas

  inherited_set <- function() unique(stack[nzchar(stack)])
  emit <- function(rel, nm) {
    r <- .form_pdf_render_condition(rel, nm, survey, choices_by_list, numbers, name_to_row, consent_var)
    if (nzchar(r$warning)) warnings <<- c(warnings, r$warning)
    r$text
  }

  for (i in seq_len(n)) {
    base <- .form_pdf_type_base(survey$type[i])
    rel <- .form_pdf_clean_text(survey$relevant[i])
    nm <- .form_pdf_cell(survey, i, "name", sprintf("fila %d", i))

    if (base %in% c("begin_group", "begin_repeat")) {
      inh <- inherited_set()
      if (nzchar(rel) && !(rel %in% inh)) openings[i] <- emit(rel, nm)
      stack <- c(stack, rel)
      prev_relevant <- ""
      next
    }
    if (base %in% c("end_group", "end_repeat")) {
      if (length(stack)) stack <- stack[-length(stack)]
      prev_relevant <- ""
      next
    }
    if (base %in% .form_pdf_skip_bases()) next

    if (!nzchar(rel)) { prev_relevant <- ""; next }
    if (rel %in% inherited_set()) { prev_relevant <- rel; next }  # heredado del grupo
    if (identical(rel, prev_relevant)) next                       # corrida: solo la 1a
    openings[i] <- emit(rel, nm)
    prev_relevant <- rel
  }

  list(openings = openings, warnings = unique(warnings))
}

.form_pdf_resolve_label_cols <- function(df, lang) {
  # Materializa `label` (y `hint` si el instrumento la trae) desde columnas
  # localizadas `label::es`, `hint::es`, etc., prefiriendo español. Sin esto los
  # XLSForms multilingües / SurveyMonkey salen con los numeros pero sin texto.
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  if (!nrow(df)) return(df)
  df$label <- xlsform_coalesce_label(df, lang, "label")
  if ("hint" %in% names(df) || length(grep("^hint(::|_)", names(df), ignore.case = TRUE))) {
    df$hint <- xlsform_coalesce_label(df, lang, "hint")
  }
  df
}

formulario_pdf_build_model <- function(survey, choices, settings = NULL, paper = NULL, options = list()) {
  settings <- .form_pdf_ensure_cols(settings, c("form_title", "form_id", "default_language"))
  lang <- tolower(trimws(.form_pdf_setting(settings, "default_language", "es")))
  if (!nzchar(lang)) lang <- "es"
  survey <- .form_pdf_resolve_label_cols(survey, lang)
  choices <- .form_pdf_resolve_label_cols(choices, lang)

  survey <- .form_pdf_ensure_cols(
    survey,
    c("type", "name", "label", "hint", "relevant", "appearance",
      "paper_number", "paper_label", "paper_layout", "paper_group",
      "paper_subgroup", "paper_only", "paper_skip", "repeat_count")
  )
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  paper <- .form_pdf_ensure_cols(paper, c("id", "kind", "position", "title", "body", "layout"))

  title <- .form_pdf_clean_text(options$title %||% "")
  if (!nzchar(title)) title <- .form_pdf_setting(settings, "form_title", "Formulario")
  if (!nzchar(title)) title <- "Formulario"
  footer_title <- .form_pdf_clean_text(options$footer_title %||% title)
  max_options_per_question <- suppressWarnings(as.integer(options$max_options_per_question %||% 18L))
  if (is.na(max_options_per_question) || max_options_per_question < 4L) max_options_per_question <- 18L
  # Toggle 1 o 2 columnas al exportar (default 2 = comportamiento historico).
  columns <- suppressWarnings(as.integer(options$columns %||% 2L))
  if (is.na(columns) || !columns %in% c(1L, 2L)) columns <- 2L
  # Ancho de las matrices: "full" (default, ancho completo) | "column" (fluyen
  # dentro de UNA columna en render de 2 columnas, como la referencia Polarizacion).
  matrix_layout <- tolower(trimws(.form_pdf_chr(options$matrix_layout %||% "full")))
  if (!matrix_layout %in% c("full", "column")) matrix_layout <- "full"
  # Lenguaje de logica: "saltos" (flechas IR/Salto) o "condiciones" (aperturas).
  logic_language <- tolower(trimws(.form_pdf_chr(options$logic_language %||% "saltos")))
  if (!logic_language %in% c("saltos", "condiciones")) logic_language <- "saltos"
  condiciones <- identical(logic_language, "condiciones")
  # Variable de consentimiento (nombre de pregunta, opcional). Si esta seteada, la
  # condicion que la referencia se trata como la puerta global de la encuesta:
  # en condiciones se omite su apertura; en saltos su negativa "Termina la encuesta".
  consent_var <- trimws(.form_pdf_chr(options$consent_var %||% ""))
  # Recuadros "N.º de cuestionario" en el header: opcional (default TRUE).
  sqn <- options$show_questionnaire_number
  show_qnum <- if (is.null(sqn)) TRUE
    else if (is.logical(sqn)) isTRUE(sqn[[1]])
    else !(tolower(trimws(as.character(sqn)[[1]])) %in% c("false", "0", "no", "f", "n"))
  # Titulo pequeno en el header superior (se repite por pagina): opcional
  # (default TRUE). Se puede ocultar cuando la portada ya lleva el titulo grande.
  sht <- options$show_header_title
  show_header_title <- if (is.null(sht)) TRUE
    else if (is.logical(sht)) isTRUE(sht[[1]])
    else !(tolower(trimws(as.character(sht)[[1]])) %in% c("false", "0", "no", "f", "n"))

  choices_by_list <- .form_pdf_options_by_list(choices)
  # Agrupacion de matrices: si el frontend manda `matrix_groups` (aunque sea []),
  # se respeta EXACTAMENTE y se ignora la autodeteccion; si esta AUSENTE, autodetecta.
  group_warnings <- character(0)
  group_tenors <- list()
  group_specials <- list()
  group_headers <- list()
  if (!is.null(options$matrix_groups)) {
    mg <- .form_pdf_matrix_keys_from_groups(survey, options$matrix_groups)
    matrix_keys <- mg$keys
    group_tenors <- mg$tenors
    group_specials <- mg$specials
    group_headers <- mg$headers
    group_warnings <- mg$warnings
  } else {
    matrix_keys <- .form_pdf_matrix_keys(survey)
  }
  # Las matrices con tenor no vacio consumen un solo numero (subnumeracion X.j);
  # el resto (autodeteccion, grupos sin tenor) numera secuencialmente.
  tenor_keys <- names(group_tenors)[vapply(group_tenors, function(t) nzchar(t %||% ""), logical(1))]
  numbers <- .form_pdf_display_numbers(survey, matrix_keys, tenor_keys)
  if (condiciones) {
    inferred <- list(skips = list(), warnings = character(0))
    opened <- .form_pdf_compute_openings(survey, choices_by_list, numbers, consent_var)
    openings <- opened$openings
    warnings <- c(group_warnings, opened$warnings)
  } else {
    inferred <- .form_pdf_infer_choice_skips(survey, choices_by_list, numbers, consent_var)
    openings <- rep("", nrow(survey))
    warnings <- c(group_warnings, inferred$warnings)
  }

  blocks <- list()
  add_block <- function(block) {
    blocks[[length(blocks) + 1L]] <<- block
  }

  # Portada: titulo prominente centrado en la primera pagina, sobre las
  # instrucciones (jerarquia tipo referencia Word).
  add_block(list(kind = "cover", title = title, full_width = TRUE))

  if (nrow(paper)) {
    pos <- suppressWarnings(as.numeric(paper$position))
    pos[is.na(pos)] <- seq_along(pos)[is.na(pos)]
    paper <- paper[order(pos), , drop = FALSE]
    for (i in seq_len(nrow(paper))) {
      kind <- .form_pdf_clean_text(paper$kind[i])
      add_block(list(
        kind = "paper",
        paper_kind = if (nzchar(kind)) kind else "note",
        title = .form_pdf_paper_text(paper$title[i]),
        body = .form_pdf_paper_text(paper$body[i]),
        layout = .form_pdf_clean_text(paper$layout[i]),
        full_width = TRUE
      ))
    }
  } else if (!isTRUE(options$no_default_intro)) {
    # Banda "INSTRUCCIONES" por defecto (guia de campo). Se omite con
    # `no_default_intro = TRUE` cuando el instrumento ya trae su propia
    # introduccion (p.ej. una nota de saludo/consentimiento del modelo).
    add_block(list(
      kind = "paper",
      paper_kind = "intro",
      title = "INSTRUCCIONES",
      body = "Use este cuestionario en papel siguiendo los saltos impresos. Registre códigos y marcas de forma legible.",
      layout = "intro",
      full_width = TRUE
    ))
  }

  i <- 1L
  while (i <= nrow(survey)) {
    base <- .form_pdf_type_base(survey$type[i])
    if (base %in% .form_pdf_skip_bases()) {
      i <- i + 1L
      next
    }

    key <- matrix_keys[i]
    if (nzchar(key)) {
      idx <- i
      while (idx[length(idx)] + 1L <= nrow(survey) && identical(matrix_keys[idx[length(idx)] + 1L], key)) {
        idx <- c(idx, idx[length(idx)] + 1L)
      }
      list_name <- .form_pdf_type_list(survey$type[i])
      mat_key <- matrix_keys[i]
      tenor <- .form_pdf_paper_text(.form_pdf_clean_text(group_tenors[[mat_key]] %||% ""))
      # Override de columna especial: default "auto" (heuristica) para matrices
      # autodetectadas o grupos sin `special`.
      special_override <- .form_pdf_clean_text(group_specials[[mat_key]] %||% "auto")
      if (!nzchar(special_override)) special_override <- "auto"
      # Modo de cabecera (extremos/categorias/auto); se resuelve al dibujar/medir.
      header_mode <- .form_pdf_clean_text(group_headers[[mat_key]] %||% "auto")
      if (!header_mode %in% c("extremos", "categorias")) header_mode <- "auto"
      # Ancho de la matriz. Default full_width. En modo "column" con 2 columnas la
      # matriz fluye en col_w, SALVO fallback de gracia: si tiene demasiadas columnas
      # de escala+especial (> 6) se queda full_width para no romper la legibilidad.
      mat_opts <- choices_by_list[[list_name]] %||% list()
      mat_full <- TRUE
      if (identical(matrix_layout, "column") && columns == 2L) {
        mat_part <- suppressWarnings(.form_pdf_matrix_partition_options(mat_opts, special_override))
        mat_total_cols <- length(mat_part$scale) + (if (!is.null(mat_part$special)) 1L else 0L)
        mat_full <- mat_total_cols > 6L  # umbral de legibilidad en una columna
      }
      mat_number <- numbers[i]
      # Salto por-FILA de matriz (lenguaje "saltos"): si la fila es un filtro
      # (su opcion negativa dispara un salto), se enuncia inline "Si responde
      # «No», salto a la N", como la referencia. En condiciones va vacio (el
      # salto se expresa como apertura del bloque destino).
      mk_item_skip <- function(r) {
        if (condiciones) return("")
        sk <- inferred$skips[[.form_pdf_chr(survey$name[r])]] %||% list()
        if (!length(sk)) return("")
        lopts <- choices_by_list[[.form_pdf_type_list(survey$type[r])]] %||% list()
        lbl_by_code <- stats::setNames(
          vapply(lopts, function(o) .form_pdf_clean_text(o$label %||% o$code), character(1)),
          vapply(lopts, function(o) .form_pdf_chr(o$code), character(1)))
        parts <- character(0)
        for (code in names(sk)) {
          instr <- .form_pdf_clean_text(sk[[code]])
          if (!nzchar(instr)) next
          olbl <- lbl_by_code[[code]] %||% code
          instr_lc <- paste0(tolower(substring(instr, 1, 1)), substring(instr, 2))
          parts <- c(parts, sprintf("Si respondió «%s», %s", olbl, instr_lc))
        }
        paste(parts, collapse = "  ·  ")
      }
      if (nzchar(tenor)) {
        # Con tenor: la matriz consume un solo numero X; titulo = "X. {tenor}",
        # filas subnumeradas X.1 .. X.k con su propia etiqueta.
        mat_title <- tenor
        mat_items <- lapply(seq_along(idx), function(jj) {
          r <- idx[jj]
          item_num <- if (nzchar(mat_number)) sprintf("%s.%d", mat_number, jj) else as.character(jj)
          list(
            number = item_num,
            name = .form_pdf_chr(survey$name[r]),
            label = .form_pdf_paper_text(.form_pdf_strip_leading_number(
              .form_pdf_first_nonempty(survey$paper_label[r], survey$label[r]), item_num)),
            skip = mk_item_skip(r)
          )
        })
      } else {
        # Sin tenor: numeracion secuencial, cada fila su propio entero.
        mat_title <- .form_pdf_paper_text(.form_pdf_strip_leading_number(
          .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i]), mat_number))
        subletters <- (survey$paper_subletter %||% rep("", nrow(survey)))
        mat_items <- lapply(idx, function(r) {
          subl <- .form_pdf_clean_text(subletters[r])
          is_parent <- identical(subl, "@")
          list(
            number = numbers[r],
            # Sub-pregunta: letra (a/b/c...) en vez de numero; madre ("@") = enunciado.
            subletter = if (is_parent) "" else subl,
            is_parent = is_parent,
            name = .form_pdf_chr(survey$name[r]),
            label = .form_pdf_paper_text(.form_pdf_strip_leading_number(
              .form_pdf_first_nonempty(survey$paper_label[r], survey$label[r]), numbers[r])),
            skip = mk_item_skip(r)
          )
        })
      }
      add_block(list(
        kind = "matrix",
        number = mat_number,
        name = .form_pdf_chr(survey$name[i]),
        title = mat_title,
        # Etiqueta de sub-grupo (subcriterio): va en la celda superior-izquierda
        # del header de la matriz, como los bloques grises de la referencia.
        group_label = .form_pdf_paper_text(.form_pdf_clean_text(survey$paper_subgroup[i])),
        tenor = tenor,
        hint = .form_pdf_paper_text(survey$hint[i]),
        items = mat_items,
        options = mat_opts,
        special_override = special_override,
        header_mode = header_mode,
        skip = if (condiciones) "" else .form_pdf_clean_text(survey$paper_skip[i]),
        opening_condition = openings[i],
        layout = .form_pdf_clean_text(survey$paper_layout[i]),
        full_width = mat_full
      ))
      i <- idx[length(idx)] + 1L
      next
    }

    if (base %in% c("begin_group", "begin_repeat")) {
      # Cardinalidad de repeat (ADR 0030, Fase 4): distinguir begin_repeat de
      # begin_group para marcar la sección como repetible (one-to-many/roster) y,
      # si el instrumento lo trae, su repeat_count.
      is_repeat <- identical(base, "begin_repeat")
      add_block(list(
        kind = "section",
        number = numbers[i],
        name = .form_pdf_chr(survey$name[i]),
        title = .form_pdf_paper_text(.form_pdf_strip_leading_number(
          .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i]),
          numbers[i]
        )),
        hint = .form_pdf_paper_text(survey$hint[i]),
        skip = if (condiciones) "" else .form_pdf_rephrase_skip(survey$paper_skip[i]),
        opening_condition = openings[i],
        repeatable = is_repeat,
        repeat_count = if (is_repeat) .form_pdf_clean_text(survey$repeat_count[i]) else "",
        full_width = TRUE
      ))
      i <- i + 1L
      next
    }

    list_name <- .form_pdf_type_list(survey$type[i])
    source_skips <- inferred$skips[[.form_pdf_chr(survey$name[i])]] %||% list()
    opts <- choices_by_list[[list_name]] %||% list()
    if (length(opts)) {
      opts <- lapply(opts, function(opt) {
        if (condiciones) {
          opt$paper_skip <- ""  # en condiciones no se mezclan lenguajes
        } else {
          manual <- .form_pdf_rephrase_skip(opt$paper_skip)
          inferred_skip <- .form_pdf_clean_text(source_skips[[opt$code]] %||% "")
          opt$paper_skip <- if (nzchar(manual)) manual else inferred_skip
        }
        opt
      })
    }
    label <- .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i])
    label <- .form_pdf_strip_leading_number(label, numbers[i])
    label <- .form_pdf_paper_text(label)
    hint <- .form_pdf_paper_text(survey$hint[i])
    layout <- .form_pdf_clean_text(survey$paper_layout[i])
    force_all_choices <- layout %in% c("choices", "all_choices", "full_choices")
    coded_list <- base %in% c("select_one", "select_multiple") &&
      length(opts) > max_options_per_question &&
      !force_all_choices
    if (coded_list) {
      warnings <- c(warnings, sprintf(
        "La pregunta `%s` tiene %d opciones; se imprime como campo codificado. Use `paper_layout = 'all_choices'` para forzar la lista completa.",
        .form_pdf_chr(survey$name[i]),
        length(opts)
      ))
      opts <- list()
    }
    option_lines <- if (length(opts)) {
      sum(vapply(opts, function(opt) {
        max(1L, length(.form_pdf_wrap(paste(opt$label, opt$paper_skip), 44L)))
      }, numeric(1)))
    } else 0
    full <- (base == "note" && nchar(label) > 90) ||
      layout %in% c("full", "wide") ||
      nchar(label) > 230 ||
      length(opts) > 10L ||
      option_lines > 14L
    add_block(list(
      kind = "question",
      type = base,
      number = numbers[i],
      name = .form_pdf_chr(survey$name[i]),
      label = label,
      hint = hint,
      options = opts,
      skip = if (condiciones) "" else .form_pdf_rephrase_skip(survey$paper_skip[i]),
      opening_condition = openings[i],
      layout = layout,
      coded_list = coded_list,
      full_width = full
    ))
    i <- i + 1L
  }

  # Indice de seccion corrido (para el kicker "SECCION N").
  sec_i <- 0L
  for (bi in seq_along(blocks)) {
    if (identical(blocks[[bi]]$kind, "section")) {
      sec_i <- sec_i + 1L
      blocks[[bi]]$section_index <- sec_i
    }
  }

  # Columna unica: tratar TODOS los bloques como full_width y reutilizar la
  # maquinaria de ancho completo del render (sin divisor central ni 2a columna).
  if (columns == 1L) {
    blocks <- lapply(blocks, function(b) { b$full_width <- TRUE; b })
  }

  list(
    title = title,
    footer_title = footer_title,
    columns = columns,
    matrix_layout = matrix_layout,
    logic_language = logic_language,
    show_questionnaire_number = show_qnum,
    show_header_title = show_header_title,
    blocks = blocks,
    warnings = unique(warnings),
    summary = list(
      n_blocks = as.integer(length(blocks)),
      n_questions = as.integer(sum(vapply(blocks, function(b) b$kind %in% c("question", "matrix"), logical(1)))),
      n_sections = as.integer(sum(vapply(blocks, function(b) identical(b$kind, "section"), logical(1)))),
      n_matrices = as.integer(sum(vapply(blocks, function(b) identical(b$kind, "matrix"), logical(1))))
    )
  )
}

.form_pdf_wrap <- function(text, chars) {
  text <- .form_pdf_clean_text(text)
  if (!nzchar(text)) return(character(0))
  unlist(strwrap(text, width = max(12L, as.integer(chars)), simplify = FALSE), use.names = FALSE)
}

# Envuelve `text` al ancho real `w` (npc) midiendo cada palabra con el font
# efectivo (fontsize/fontface), no por conteo de caracteres. Resuelve el desfase
# del strwrap: con un limite fijo de caracteres las letras anchas (m, w, á) se
# pasaban de la columna y las angostas (i, l) dejaban hueco. Requiere un device
# grafico abierto (lo hay durante `formulario_pdf_render`, y block_height corre
# despues de abrir el pdf); si la medicion falla, cae al wrap por caracteres.
.form_pdf_wrap_fit <- function(text, w, fontsize = 7.3, fontface = "plain") {
  text <- .form_pdf_clean_text(text)
  if (!nzchar(text)) return(character(0))
  if (!is.finite(w) || w <= 0) return(.form_pdf_wrap(text, 40L))
  gp0 <- grid::gpar(fontsize = fontsize, fontface = fontface, lineheight = 1.05)
  meas <- function(s) tryCatch(
    grid::convertWidth(grid::grobWidth(grid::textGrob(s, gp = gp0)), "npc", valueOnly = TRUE),
    error = function(e) NA_real_)
  space_w <- meas(" ")
  if (!is.finite(space_w)) return(.form_pdf_wrap(text, max(12L, floor(w * 185))))
  words <- strsplit(text, " +")[[1]]
  words <- words[nzchar(words)]
  if (!length(words)) return(character(0))
  lines <- character(0)
  cur <- ""; cur_w <- 0
  for (word in words) {
    ww <- meas(word)
    if (!is.finite(ww)) ww <- nchar(word, type = "chars") * space_w
    if (!nzchar(cur)) {
      cur <- word; cur_w <- ww
    } else if (cur_w + space_w + ww <= w) {
      cur <- paste(cur, word); cur_w <- cur_w + space_w + ww
    } else {
      lines <- c(lines, cur); cur <- word; cur_w <- ww
    }
  }
  if (nzchar(cur)) lines <- c(lines, cur)
  lines
}

.form_pdf_lines_height <- function(lines, line_h = 0.015, min_h = 0) {
  max(min_h, length(lines) * line_h)
}

.form_pdf_opening_height <- function(text, chars = 112L) {
  if (!nzchar(text %||% "")) return(0)
  # El badge de apertura envuelve el texto con padding vertical; se mide con la
  # misma altura de linea del dibujo (.form_pdf_draw_opening) + el padding.
  length(.form_pdf_wrap(text, chars)) * 0.0118 + 0.015
}

.form_pdf_block_height <- function(block, width) {
  chars <- if (isTRUE(block$full_width)) 118L else 56L
  if (identical(block$kind, "cover")) {
    return(0.030 + .form_pdf_lines_height(.form_pdf_wrap(block$title, 46), 0.026) + 0.026)
  }
  if (identical(block$kind, "section")) {
    return(0.058 + .form_pdf_lines_height(.form_pdf_wrap(block$title, chars), 0.014) +
             .form_pdf_opening_height(block$opening_condition, chars))
  }
  if (identical(block$kind, "paper")) {
    return(0.042 + .form_pdf_lines_height(.form_pdf_wrap(block$title, 118), 0.014) +
             .form_pdf_lines_height(.form_pdf_wrap(block$body, 126), 0.012))
  }
  if (identical(block$kind, "matrix")) {
    # Mide las filas reales (etiqueta con su numero) para no subestimar la altura
    # cuando los items envuelven a varias lineas. Usa EXACTAMENTE la misma
    # calibracion (label_w adaptativo + chars) que el dibujo.
    part <- .form_pdf_matrix_partition_options(block$options, block$special_override %||% "auto")
    n_scale <- length(part$scale)
    has_special <- !is.null(part$special)
    total_cols <- n_scale + (if (has_special) 1L else 0L)
    inner <- width - 0.012
    label_w <- max(0.05, inner * .form_pdf_matrix_label_frac(total_cols))
    col_w <- if (total_cols > 0L) (inner - label_w) / total_cols else 0
    lbl_w_txt <- label_w - 0.012
    rows_h <- sum(vapply(block$items %||% list(), function(it) {
      num <- .form_pdf_clean_text(it$number %||% "")
      subl <- .form_pdf_clean_text(it$subletter %||% "")
      is_parent <- isTRUE(it$is_parent)
      # Misma geometria por-rol que el dibujo (madre a ancho completo, hijo
      # sangrado), para no desincronizar el paginado.
      if (is_parent) {
        lbl <- if (nzchar(num)) paste0(num, ".  ", it$label) else (it$label %||% ""); txt_w <- inner - 0.012
      } else if (nzchar(subl)) {
        lbl <- paste0(subl, ")  ", it$label %||% ""); txt_w <- lbl_w_txt - 0.012
      } else {
        lbl <- if (nzchar(num)) paste0(num, ".  ", it$label) else (it$label %||% ""); txt_w <- lbl_w_txt
      }
      sk <- .form_pdf_clean_text(it$skip %||% "")
      lbl_n <- length(.form_pdf_wrap_fit(lbl, txt_w, fontsize = 7.3))
      sk_n <- if (nzchar(sk)) length(.form_pdf_wrap_fit(sk, lbl_w_txt, fontsize = 6.6, fontface = "italic")) else 0L
      max(0.018, (lbl_n + sk_n) * 0.012 + 0.007)
    }, numeric(1)))
    # Alto de cabecera segun el modo (misma resolucion que el dibujo).
    header_mode <- .form_pdf_matrix_header_mode(part$scale, block$header_mode %||% "auto")
    if (identical(header_mode, "categorias")) {
      cat_labels <- vapply(part$scale, function(o) .form_pdf_clean_text(o$label %||% o$code), character(1))
      sp_label <- if (has_special) .form_pdf_clean_text(part$special$label %||% part$special$code) else ""
      geom <- .form_pdf_matrix_cat_header_geom(cat_labels, sp_label, has_special, col_w, total_cols)
      header_h <- geom$height + 0.006
    } else {
      header_h <- 0.050  # cabecera de anclas (hasta ~3 lineas) + margenes
    }
    # Sin tenor no se dibuja el encabezado/titulo: no reservar su altura.
    title_h <- if (nzchar(block$tenor %||% ""))
      .form_pdf_lines_height(.form_pdf_wrap(block$title, 118), 0.014) else 0
    return(header_h + rows_h + 0.022 + title_h +
             .form_pdf_lines_height(.form_pdf_wrap(block$hint, 118), 0.011) +
             .form_pdf_opening_height(block$opening_condition, 112L))
  }
  label_h <- .form_pdf_lines_height(.form_pdf_wrap(block$label, chars), 0.014, 0.02)
  hint_h <- .form_pdf_lines_height(.form_pdf_wrap(block$hint, chars), 0.011)
  opt_count <- length(block$options %||% list())
  options_h <- if (opt_count) {
    # Misma geometria por-fila que el dibujo (chip de salto incluido) para no
    # desincronizar el paginado: el area de opciones es `width - 0.012`.
    cm <- .form_pdf_options_code_mark(block$options, identical(block$type %||% "", "select_multiple"))
    w_opt <- width - 0.012
    sum(vapply(block$options, function(opt) {
      .form_pdf_option_row_geom(opt, w_opt, cm$code_w, cm$mark_w)$h
    }, numeric(1)))
  } else if (isTRUE(block$coded_list)) {
    0.044
  } else if ((block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")) {
    0.04
  } else {
    0.02
  }
  skip_h <- .form_pdf_lines_height(.form_pdf_wrap(block$skip, chars), 0.012)
  0.024 + label_h + hint_h + options_h + skip_h +
    .form_pdf_opening_height(block$opening_condition, chars)
}

.form_pdf_rect <- function(x, y, w, h, fill = NA, col = "black", lwd = 0.6) {
  grid::grid.rect(
    x = grid::unit(x + w / 2, "npc"),
    y = grid::unit(y - h / 2, "npc"),
    width = grid::unit(w, "npc"),
    height = grid::unit(h, "npc"),
    gp = grid::gpar(fill = fill, col = col, lwd = lwd)
  )
}

.form_pdf_text <- function(text, x, y, w, chars = NULL, fontsize = 8.4,
                           fontface = "plain", align = "left", col = "black",
                           line_h = 0.014, lines = NULL) {
  if (is.null(chars)) chars <- max(12L, floor(w * 130))
  # `lines` pre-cortadas (p. ej. por ancho real via .form_pdf_wrap_fit) tienen
  # prioridad sobre el wrap interno por caracteres.
  if (is.null(lines)) lines <- .form_pdf_wrap(text, chars)
  if (!length(lines)) return(y)
  gp0 <- grid::gpar(fontsize = fontsize, fontface = fontface, col = col, lineheight = 1.05)
  # --- JUSTIFICADO: distribuye el espacio sobrante entre palabras (menos la
  # ultima linea). Mide el ancho real de cada palabra en npc. ---
  if (identical(align, "justify")) {
    wgt <- function(s) tryCatch(
      grid::convertWidth(grid::grobWidth(grid::textGrob(s, gp = gp0)), "npc", valueOnly = TRUE),
      error = function(e) nchar(s, type = "width") * (w / max(1L, chars)))
    for (li in seq_along(lines)) {
      yy <- y - (li - 1L) * line_h
      words <- strsplit(lines[[li]], " +")[[1]]
      words <- words[nzchar(words)]
      if (li == length(lines) || length(words) <= 1L) {
        grid::grid.text(lines[[li]], x = grid::unit(x, "npc"), y = grid::unit(yy, "npc"),
                        just = c("left", "top"), gp = gp0)
        next
      }
      ww <- vapply(words, wgt, numeric(1))
      gap <- (w - sum(ww)) / (length(words) - 1L)
      if (!is.finite(gap) || gap < 0) gap <- 0.004
      cx <- x
      for (k in seq_along(words)) {
        grid::grid.text(words[[k]], x = grid::unit(cx, "npc"), y = grid::unit(yy, "npc"),
                        just = c("left", "top"), gp = gp0)
        cx <- cx + ww[[k]] + gap
      }
    }
    return(y - length(lines) * line_h)
  }
  just <- switch(align, center = c("center", "top"), right = c("right", "top"), c("left", "top"))
  tx <- switch(align, center = x + w / 2, right = x + w, x)
  grid::grid.text(
    paste(lines, collapse = "\n"),
    x = grid::unit(tx, "npc"),
    y = grid::unit(y, "npc"),
    just = just,
    gp = grid::gpar(fontsize = fontsize, fontface = fontface, col = col, lineheight = 1.05)
  )
  y - length(lines) * line_h
}

.form_pdf_logo_path <- function() {
  cands <- c(
    system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnurapp"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png"),
    file.path(getwd(), "inst", "hojas_ruta", "assets", "logo_pulso.png")
  )
  cands <- cands[nzchar(cands) & file.exists(cands)]
  if (length(cands)) cands[[1]] else NA_character_
}

.form_pdf_draw_logo <- function(x, y, width_npc = 0.115) {
  path <- .form_pdf_logo_path()
  if (!is.na(path) && requireNamespace("png", quietly = TRUE)) {
    img <- tryCatch(png::readPNG(path), error = function(e) NULL)
    if (!is.null(img)) {
      img_h <- dim(img)[1]; img_w <- dim(img)[2]
      h_npc <- width_npc * (img_h / img_w) * (8.27 / 11.69)
      grid::grid.raster(img, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                        just = c("left", "center"), interpolate = TRUE,
                        width = grid::unit(width_npc, "npc"),
                        height = grid::unit(h_npc, "npc"))
      return(invisible(TRUE))
    }
  }
  grid::grid.text("PULSO PUCP", x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = pulso_pdf_tokens()$navy))
  invisible(FALSE)
}

.form_pdf_header <- function(model, page_no) {
  tk <- pulso_pdf_tokens()
  .form_pdf_draw_logo(0.052, 0.962, width_npc = 0.115)
  if (!identical(model$show_header_title, FALSE)) {
    .form_pdf_text(toupper(model$title), 0.190, 0.976, 0.480, chars = 62, fontsize = 8.4,
                   fontface = "bold", col = tk$navy, line_h = 0.012)
  }
  if (!identical(model$show_questionnaire_number, FALSE)) {
    grid::grid.text("N.º de cuestionario", x = grid::unit(0.878, "npc"), y = grid::unit(0.938, "npc"),
                    just = c("center", "center"), gp = grid::gpar(fontsize = 6.6, col = tk$soft))
    for (i in 0:3) .form_pdf_rect(0.826 + i * 0.026, 0.982, 0.026, 0.031, fill = "white", col = tk$ink, lwd = 0.7)
  }
  grid::grid.lines(x = grid::unit(c(0.052, 0.930), "npc"), y = grid::unit(0.922, "npc"),
                   gp = grid::gpar(col = tk$navy, lwd = 1.1))
  invisible(page_no)
}

.form_pdf_footer <- function(model, page_no) {
  tk <- pulso_pdf_tokens()
  grid::grid.lines(x = grid::unit(c(0.052, 0.930), "npc"), y = grid::unit(0.056, "npc"),
                   gp = grid::gpar(col = tk$line, lwd = 0.7))
  grid::grid.text(as.character(page_no), x = grid::unit(0.052, "npc"), y = grid::unit(0.034, "npc"),
                  just = c("left", "center"), gp = grid::gpar(fontsize = 8, col = tk$soft))
  .form_pdf_text(toupper(model$footer_title), 0.16, 0.039, 0.58, chars = 105,
                 fontsize = 6.2, align = "center", col = tk$soft, line_h = 0.008)
  grid::grid.text("PULSO PUCP", x = grid::unit(0.930, "npc"), y = grid::unit(0.034, "npc"),
                  just = c("right", "center"),
                  gp = grid::gpar(fontsize = 6.6, fontface = "bold", col = tk$navy))
}

.form_pdf_band <- function(title, x, y, w, chars, kicker = "") {
  # Banda navy fina; titulo en blanco CENTRADO (sin kicker "SECCION N").
  tk <- pulso_pdf_tokens()
  lines <- .form_pdf_wrap(toupper(title), chars)
  if (!length(lines)) return(y)
  band_h <- length(lines) * 0.0138 + 0.011
  .form_pdf_rect(x, y, w, band_h, fill = tk$navy, col = NA, lwd = 0)
  .form_pdf_text(paste(lines, collapse = "\n"), x, y - 0.0088, w,
                 chars = chars, fontsize = 8.5, fontface = "bold", col = "white",
                 align = "center", line_h = 0.0138)
  y - band_h
}

# Glifo vectorial de "rama" (una L navy con punta a la derecha), dibujado con
# primitivas para no depender de glifos unicode que la fuente Helvetica del
# device PDF no soporta (↳/• se sustituyen por ".").
.form_pdf_draw_branch_glyph <- function(cx, cy, tk, s = 0.006) {
  grid::grid.lines(x = grid::unit(c(cx, cx), "npc"),
                   y = grid::unit(c(cy + s * 0.9, cy - s * 0.2), "npc"),
                   gp = grid::gpar(col = tk$navy, lwd = 1.0))
  grid::grid.lines(x = grid::unit(c(cx, cx + s * 1.3), "npc"),
                   y = grid::unit(c(cy - s * 0.2, cy - s * 0.2), "npc"),
                   arrow = grid::arrow(angle = 24, length = grid::unit(0.6, "mm"), type = "closed"),
                   gp = grid::gpar(col = tk$navy, fill = tk$navy, lwd = 1.0))
}

# Apertura de condicion como BADGE tenue: roundrect de fondo suave (tbl_zebra,
# borde line) con un glifo de rama navy al inicio y el texto en itálica soft.
# Condicion de apertura: texto italic sobrio (minimalismo del modelo, sin
# roundrect ni glyph). Tinte navy tenue para diferenciarlo del cuerpo.
.form_pdf_draw_opening <- function(text, x, y, w, chars_factor = 112) {
  if (!nzchar(text %||% "")) return(y)
  tk <- pulso_pdf_tokens()
  cw <- max(20L, floor((w - 0.012) * chars_factor))
  lines <- .form_pdf_wrap(text, cw)
  if (!length(lines)) return(y)
  y <- .form_pdf_text(paste(lines, collapse = "\n"), x + 0.008, y - 0.005, w - 0.016,
                      chars = cw, fontsize = 7.3, fontface = "italic", col = tk$navy, line_h = 0.0118)
  y - 0.004
}

.form_pdf_draw_cover <- function(block, x, y, w) {
  tk <- pulso_pdf_tokens()
  cx <- x + w / 2
  y <- y - 0.018
  lines <- .form_pdf_wrap(block$title, 46)
  grid::grid.text(paste(lines, collapse = "\n"), x = grid::unit(cx, "npc"),
                  y = grid::unit(y, "npc"), just = c("center", "top"),
                  gp = grid::gpar(fontsize = 16.5, fontface = "bold", col = tk$navy, lineheight = 1.06))
  y <- y - length(lines) * 0.026 - 0.008
  grid::grid.lines(x = grid::unit(c(cx - 0.055, cx + 0.055), "npc"),
                   y = grid::unit(y, "npc"), gp = grid::gpar(col = tk$navy, lwd = 1.4))
  y - 0.018
}

.form_pdf_draw_paper <- function(block, x, y, w) {
  if (nzchar(block$title %||% "")) {
    y <- .form_pdf_band(block$title, x, y, w, chars = 118)
    y <- y - 0.008
  }
  if (nzchar(block$body %||% "")) {
    y <- .form_pdf_text(block$body, x + 0.008, y, w - 0.016, chars = 122,
                        fontsize = 8.1, align = "justify", col = pulso_pdf_tokens()$ink, line_h = 0.012)
  }
  y - 0.012
}

.form_pdf_draw_section <- function(block, x, y, w) {
  label <- block$title
  # Marca textual de sección repetible (ADR 0030, Fase 4).
  label <- paste0(label, .repeat_pdf_section_suffix(isTRUE(block$repeatable), block$repeat_count))
  # Sin kicker "SECCIÓN N": la banda (centrada) se basta sola.
  y <- .form_pdf_band(label, x, y, w, chars = 112)
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y - 0.006, w)
  }
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.008, y - 0.006, w - 0.016, chars = 112,
                        fontsize = 7.5, fontface = "italic", col = pulso_pdf_tokens()$soft, line_h = 0.012)
  }
  y - 0.008
}

# Geometria de codigo/marca de una lista de opciones (compartida por dibujo y
# calculo de altura para no desincronizar el paginado). Solo depende de las
# opciones y del flag `multiple`, no del ancho.
.form_pdf_options_code_mark <- function(options, multiple) {
  code_visible <- vapply(options, function(opt) {
    code <- .form_pdf_clean_text(opt$code %||% "")
    label <- .form_pdf_clean_text(opt$label %||% "")
    nzchar(code) &&
      !identical(tolower(code), tolower(label)) &&
      nchar(code, type = "width") <= 8L &&
      !grepl("\\s", code)
  }, logical(1))
  show_code <- any(code_visible)
  max_code_chars <- max(1L, max(nchar(vapply(options, function(opt) .form_pdf_clean_text(opt$code %||% ""), character(1)), type = "width")))
  code_w <- if (show_code) min(0.070, max(0.038, max_code_chars * 0.011)) else 0
  mark_w <- if (multiple || !show_code) 0.026 else 0
  list(code_visible = code_visible, show_code = show_code, code_w = code_w, mark_w = mark_w)
}

# Ancho estimado del chip de salto (roundrect con flecha vectorial + verbo). Se
# reserva flecha (~0.014) + padding; calibrado a la fuente del chip (~6.9pt).
.form_pdf_skip_chip_w <- function(skip) {
  s <- .form_pdf_clean_text(skip)
  0.010 + nchar(s, type = "width") * 0.0070
}

# Geometria por-fila de una opcion: decide si el chip de salto cabe a la DERECHA
# de la fila o baja bajo el label, y calcula lineas del label y alto de la fila.
# Idéntica en dibujo y en `.form_pdf_block_height` (sincroniza el paginado).
.form_pdf_option_row_geom <- function(opt, w, code_w, mark_w) {
  skip <- .form_pdf_clean_text(opt$paper_skip %||% "")
  has_skip <- nzchar(skip)
  label_area <- w - code_w - mark_w - 0.010
  chip_w <- if (has_skip) .form_pdf_skip_chip_w(skip) else 0
  chip_right <- has_skip && chip_w <= label_area * 0.5
  lbl_w <- if (chip_right) max(0.05, label_area - chip_w - 0.006) else label_area
  label_chars <- max(6L, floor(lbl_w * 125))
  n_lines <- max(1L, length(.form_pdf_wrap(.form_pdf_clean_text(opt$label %||% ""), label_chars)))
  chip_below <- has_skip && !chip_right
  h <- max(0.021, n_lines * 0.013 + (if (chip_below) 0.015 else 0) + 0.008)
  list(skip = skip, has_skip = has_skip, chip_w = chip_w, chip_right = chip_right,
       chip_below = chip_below, lbl_w = lbl_w, label_chars = label_chars,
       n_lines = n_lines, h = h)
}

# Salto de opcion: texto italic navy sobrio (minimalismo del modelo, sin
# roundrect ni flecha). `x` = borde izquierdo, `cy` = centro vertical.
.form_pdf_draw_skip_chip <- function(skip, x, cy, chip_w, tk, chip_h = 0.016) {
  grid::grid.text(skip, x = grid::unit(x + 0.004, "npc"), y = grid::unit(cy, "npc"),
                  just = c("left", "center"),
                  gp = grid::gpar(fontsize = 6.9, fontface = "italic", col = tk$navy))
}

.form_pdf_draw_options <- function(options, x, y, w, multiple = FALSE) {
  if (!length(options)) return(y)
  tk <- pulso_pdf_tokens()
  cm <- .form_pdf_options_code_mark(options, multiple)
  code_visible <- cm$code_visible
  show_code <- cm$show_code
  code_w <- cm$code_w
  mark_w <- cm$mark_w
  y_start <- y
  for (idx in seq_along(options)) {
    opt <- options[[idx]]
    geom <- .form_pdf_option_row_geom(opt, w, code_w, mark_w)
    h <- geom$h
    # Zebra sutil en filas pares (patron codebook).
    if (idx %% 2L == 0L) .form_pdf_rect(x, y, w, h, fill = tk$tbl_zebra, col = NA, lwd = 0)
    xx <- x
    if (mark_w > 0) {
      # casilla de marca (checkbox) alineada con la primera linea
      bx <- xx + 0.006
      grid::grid.rect(x = grid::unit(bx + 0.006, "npc"), y = grid::unit(y - 0.0095, "npc"),
                      width = grid::unit(0.011, "npc"), height = grid::unit(0.011, "npc"),
                      gp = grid::gpar(fill = tk$surface, col = tk$tbl_frame, lwd = 0.5))
      xx <- xx + mark_w
    }
    if (show_code) {
      if (isTRUE(code_visible[[idx]])) {
        grid::grid.text(opt$code, x = grid::unit(xx + code_w / 2, "npc"),
                        y = grid::unit(y - 0.010, "npc"),
                        gp = grid::gpar(fontsize = 7.7, fontface = "bold", col = tk$navy))
      }
    }
    # Label de la opcion (sin el salto pegado: el salto ahora es un chip aparte).
    .form_pdf_text(.form_pdf_clean_text(opt$label %||% ""), xx + code_w + 0.004, y - 0.005,
                   geom$lbl_w, chars = geom$label_chars, fontsize = 7.9,
                   col = tk$ink, line_h = 0.012)
    if (geom$has_skip) {
      if (geom$chip_right) {
        .form_pdf_draw_skip_chip(geom$skip, x + w - geom$chip_w - 0.004, y - 0.008, geom$chip_w, tk)
      } else {
        .form_pdf_draw_skip_chip(geom$skip, xx + code_w + 0.004,
                                 y - geom$n_lines * 0.013 - 0.010, geom$chip_w, tk)
      }
    }
    y <- y - h
  }
  # Marco exterior fino + divisor bajo el codigo.
  grid::grid.rect(x = grid::unit(x + w / 2, "npc"), y = grid::unit((y_start + y) / 2, "npc"),
                  width = grid::unit(w, "npc"), height = grid::unit(y_start - y, "npc"),
                  gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
  if (show_code || mark_w > 0) {
    div_x <- x + mark_w + code_w
    grid::grid.lines(x = grid::unit(c(div_x, div_x), "npc"),
                     y = grid::unit(c(y, y_start), "npc"),
                     gp = grid::gpar(col = tk$tbl_div, lwd = 0.4))
  }
  y
}

.form_pdf_draw_question <- function(block, x, y, w) {
  tk <- pulso_pdf_tokens()
  chars_lbl <- if (isTRUE(block$full_width)) 118 else 54
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y, w,
                                chars_factor = if (isTRUE(block$full_width)) 112 else 108)
    y <- y - 0.002
  }
  prefix <- if (nzchar(block$number %||% "")) paste0(block$number, ".  ") else ""
  # Notas informativas: texto justificado (como el modelo). Preguntas: izquierda.
  lbl_align <- if (identical(block$type %||% "", "note")) "justify" else "left"
  y <- .form_pdf_text(paste0(prefix, block$label), x + 0.006, y, w - 0.012,
                      chars = chars_lbl, align = lbl_align,
                      fontsize = 8.4, fontface = "bold", col = tk$ink, line_h = 0.0142)
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                        chars = chars_lbl,
                        fontsize = 7.3, fontface = "italic", col = tk$soft, line_h = 0.011)
  }
  y <- y - 0.007
  if (isTRUE(block$coded_list)) {
    grid::grid.rect(x = grid::unit(x + 0.006 + (w - 0.012) / 2, "npc"), y = grid::unit(y - 0.017, "npc"),
                    width = grid::unit(w - 0.012, "npc"), height = grid::unit(0.034, "npc"),
                    gp = grid::gpar(fill = tk$tbl_zebra, col = tk$tbl_frame, lwd = 0.5))
    .form_pdf_text("Código / respuesta:", x + 0.012, y - 0.008, w - 0.024,
                   chars = if (isTRUE(block$full_width)) 112 else 48,
                   fontsize = 7.5, fontface = "italic", col = tk$soft, line_h = 0.011)
    y <- y - 0.034
  } else if ((block$type %||% "") %in% c("select_one", "select_multiple")) {
    y <- .form_pdf_draw_options(block$options, x + 0.006, y, w - 0.012, multiple = identical(block$type, "select_multiple"))
  } else if ((block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")) {
    h <- if (identical(block$type, "text")) 0.034 else 0.025
    grid::grid.rect(x = grid::unit(x + 0.006 + (w - 0.012) / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                    width = grid::unit(w - 0.012, "npc"), height = grid::unit(h, "npc"),
                    gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
    y <- y - h
  } else if (identical(block$type, "note")) {
    # Solo texto informativo.
  } else {
    grid::grid.rect(x = grid::unit(x + 0.006 + (w - 0.012) / 2, "npc"), y = grid::unit(y - 0.0125, "npc"),
                    width = grid::unit(w - 0.012, "npc"), height = grid::unit(0.025, "npc"),
                    gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
    y <- y - 0.025
  }
  if (nzchar(block$skip %||% "")) {
    y <- .form_pdf_text(block$skip, x + 0.012, y - 0.006, w - 0.024,
                        chars = if (isTRUE(block$full_width)) 112 else 48,
                        fontsize = 7.6, fontface = "italic", col = tk$navy, line_h = 0.012)
  }
  y - 0.013
}

# Patron fuerte de etiqueta de valor faltante / NS-NR (independiente del codigo).
.form_pdf_option_label_is_missing <- function(label) {
  label <- tolower(.form_pdf_clean_text(label %||% ""))
  if (!nzchar(label)) return(FALSE)
  grepl(paste0(
    "(^|\\b)(sin\\s*inf(?![a-z])|sin\\s+informaci|no\\s+sabe|ns\\s*[/.–-]?\\s*nr|no\\s+responde|",
    "no\\s+contesta|no\\s+aplica|prefiero\\s+no\\s+responder|valor\\s+perdido|",
    "blanco|viciad|no\\s+informa)"),
    label, perl = TRUE)
}

# Chequeo por-opcion (etiqueta faltante o codigo centinela alto/9). La decision
# FINAL en una matriz es CONTEXTUAL (.form_pdf_matrix_partition_options); este
# helper se conserva por compatibilidad y para casos aislados.
.form_pdf_option_is_special <- function(opt) {
  if (.form_pdf_option_label_is_missing(opt$label %||% "")) return(TRUE)
  num <- suppressWarnings(as.integer(.form_pdf_clean_text(opt$code %||% "")))
  !is.na(num) && (num >= 88L || num == 9L)
}

# Divide las opciones de una matriz en la escala ordenada y (a lo sumo) UNA opcion
# especial. `special_override` fija esa decision:
#  - "none"      -> sin especial; TODAS las opciones son escala.
#  - "<codigo>"  -> la opcion con ese codigo es la especial (resto = escala); si el
#                   codigo no existe entre las opciones, cae a heuristica con warning.
#  - "auto"/NULL -> heuristica CONTEXTUAL (comportamiento por defecto):
#     * especial si la etiqueta matchea NS-NR/faltante, O
#     * si el codigo esta FUERA de la corrida contigua 1..k de la escala Y es un
#       centinela alto (>=88) o el clasico 9 (solo cuando hay gap respecto a 1..k).
# Escalas contiguas legitimas (1..5, 1..9, 1..12) NO producen especial. Conservador:
# ante duda, se trata como escala. Maximo UNA especial (la ultima que califique).
.form_pdf_matrix_partition_options <- function(options, special_override = "auto") {
  options <- options %||% list()
  n <- length(options)
  if (!n) return(list(scale = list(), special = NULL))
  ov <- .form_pdf_clean_text(special_override %||% "auto")
  if (!nzchar(ov)) ov <- "auto"

  # "none": sin columna especial, todo es escala.
  if (identical(tolower(ov), "none")) return(list(scale = options, special = NULL))

  # "<codigo>": fuerza esa opcion como especial. Si el codigo no existe, se avisa y
  # se cae a la heuristica ("auto"). Defensivo: solo una especial (el primer match).
  if (!identical(tolower(ov), "auto")) {
    codes_ov <- vapply(options, function(o) .form_pdf_clean_text(o$code %||% ""), character(1))
    hit <- which(codes_ov == ov)
    if (length(hit)) {
      sp_idx <- hit[1]
      scale <- options[-sp_idx]
      if (!length(scale)) return(list(scale = options, special = NULL))
      return(list(scale = scale, special = options[[sp_idx]]))
    }
    warning(sprintf(
      "Columna especial forzada '%s' inexistente en la matriz; se usa autodeteccion.", ov))
    # fall-through a la heuristica de abajo.
  }

  codes <- vapply(options, function(o) .form_pdf_clean_text(o$code %||% ""), character(1))
  num <- suppressWarnings(as.integer(codes))
  valid <- !is.na(num)
  miss_lab <- vapply(options, function(o) .form_pdf_option_label_is_missing(o$label %||% ""), logical(1))

  # Corrida contigua: la MAYOR secuencia de enteros consecutivos (paso 1) entre los
  # codigos. Los que quedan fuera son candidatos a especial. Se toma la mas larga
  # (no la que arranca en el menor) para que un centinela BAJO discontinuo (ej. 0 o
  # 9 con gap) no arrastre la escala 1..k a una corrida diminuta.
  in_run <- rep(FALSE, n)
  if (any(valid)) {
    sorted_vals <- sort(unique(num[valid]))
    best_start <- 1L; best_len <- 1L; cur_start <- 1L
    for (k in seq_along(sorted_vals)) {
      if (k > 1L && sorted_vals[k] != sorted_vals[k - 1L] + 1L) cur_start <- k
      cur_len <- k - cur_start + 1L
      if (cur_len > best_len) { best_len <- cur_len; best_start <- cur_start }
    }
    run_vals <- sorted_vals[best_start:(best_start + best_len - 1L)]
    in_run <- valid & (num %in% run_vals)
  }

  is_special <- vapply(seq_len(n), function(k) {
    if (isTRUE(miss_lab[k])) return(TRUE)
    if (!valid[k]) return(FALSE)   # no numerico y sin etiqueta NS-NR -> escala
    if (in_run[k]) return(FALSE)   # dentro de la corrida contigua -> escala
    # Centinelas fuera de la corrida: altos (>=88), el clasico 9 y el bajo 0 (NS/NR).
    # Conservador: 0 solo cuenta aqui si esta FUERA de la corrida (hay gap); si el 0
    # es parte contigua de la escala (0..k) queda dentro de la corrida y no aplica.
    (num[k] >= 88L) || identical(num[k], 9L) || identical(num[k], 0L)
  }, logical(1))

  if (!any(is_special)) return(list(scale = options, special = NULL))
  sp_last <- max(which(is_special))   # a lo sumo UNA especial: la ultima que califica
  scale <- options[-sp_last]
  if (!length(scale)) return(list(scale = options, special = NULL))
  list(scale = scale, special = options[[sp_last]])
}

# Fraccion de ancho para la columna de etiqueta segun nº de columnas de escala:
# con pocas columnas la etiqueta puede ser mas ancha; con muchas se acota para que
# la escala respire.
.form_pdf_matrix_label_frac <- function(total_cols) {
  # El label del item se lleva la mayor parte del ancho: las columnas de escala
  # solo imprimen el codigo (1-2 digitos), asi que con pocas columnas la
  # etiqueta puede ser MUCHO mas ancha (menos wrap, filas mas bajas). Con muchas
  # columnas se acota para que la escala respire.
  if (total_cols <= 2L) 0.82 else if (total_cols <= 4L) 0.72
  else if (total_cols <= 7L) 0.60 else 0.50
}

# Geometria del header CATEGORIAS: decide horizontal vs rotado 90 segun si las
# etiquetas caben en el ancho de columna, y devuelve la altura reservada. Draw y
# measure llaman a este mismo helper para no desincronizar el paginado.
# `horizontal` = la etiqueta cabe (hasta 2 lineas) en col_w -> texto derecho
# (Si/No, "Muy satisfecho"); si no, `rotated` (categorias largas estilo
# Polarizacion). ~118 char/npc calibra el ancho a la tipografia del header.
.form_pdf_matrix_cat_header_geom <- function(cat_labels, sp_label, has_special, col_w, total_cols) {
  all_labels <- c(cat_labels, if (has_special) sp_label else character(0))
  all_labels <- all_labels[nzchar(all_labels)]
  if (!length(all_labels)) all_labels <- ""
  max_chars <- max(1L, max(nchar(all_labels, type = "width")))
  col_chars <- max(1L, floor(col_w * 118))
  # Categorias SIEMPRE horizontal con wrap (hasta 4 lineas), como la referencia
  # ("Totalmente en desacuerdo" partido en varias lineas sobre su columna). Solo
  # se rota si aun envolviendo excede 4 lineas (label absurdamente largo).
  hdr_lines <- max(1L, max(vapply(all_labels, function(l)
    length(.form_pdf_wrap(l, col_chars)), integer(1))))
  if (hdr_lines <= 4L) {
    list(layout = "horizontal", height = hdr_lines * 0.011 + 0.010,
         col_chars = col_chars, cat_fs = if (total_cols >= 6L) 5.6 else 6.2)
  } else {
    list(layout = "rotated", height = min(0.115, max_chars * 0.0044 + 0.013),
         col_chars = col_chars, cat_fs = if (total_cols >= 6L) 5.6 else 6.0)
  }
}

# Calibracion char/npc del label del item (~150 para LLENAR el ancho, como el kit).
.form_pdf_matrix_lbl_chars <- function(label_w) max(20L, floor((label_w - 0.012) * 185))

# Resuelve el modo de cabecera de la matriz: "extremos" (solo anclas de los
# extremos, actual) | "categorias" (cada opcion de escala rotulada sobre su
# columna, con texto rotado). `override`: "auto" (default) | "extremos" | "categorias".
# Auto = categorias (cada opcion rotulada, horizontal con wrap como la
# referencia) si TODAS las labels estan presentes, no son numericas y hay <=6
# columnas de escala; si no, extremos (ej. 1..10 numerica, sin etiqueta, o >6).
.form_pdf_matrix_header_mode <- function(scale, override = "auto") {
  ov <- tolower(.form_pdf_clean_text(override %||% "auto"))
  if (ov %in% c("extremos", "categorias")) return(ov)
  n <- length(scale)
  if (!n || n > 6L) return("extremos")
  labs <- vapply(scale, function(o) .form_pdf_clean_text(o$label %||% ""), character(1))
  if (any(!nzchar(labs))) return("extremos")            # sin etiqueta -> extremos
  if (all(grepl("^[0-9]+$", labs))) return("extremos")  # escala numerica (1..10)
  "categorias"  # etiquetas presentes (aunque largas): categorias con wrap
}

.form_pdf_draw_matrix <- function(block, x, y, w) {
  tk <- pulso_pdf_tokens()
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y, w)
    y <- y - 0.002
  }
  # Encabezado solo CON tenor: "X. {tenor}" sobre la tabla. Sin tenor, el titulo
  # es la etiqueta del 1er item y ademas ese item ya aparece como fila 1 -> se
  # omite el encabezado para no duplicarlo (la tabla numerada se basta sola).
  has_tenor <- nzchar(block$tenor %||% "")
  if (has_tenor) {
    prefix <- if (nzchar(block$number %||% "")) paste0(block$number, ".  ") else ""
    y <- .form_pdf_text(paste0(prefix, block$title), x + 0.006, y, w - 0.012,
                        chars = 118, fontsize = 8.4, fontface = "bold", col = tk$ink, line_h = 0.0142)
  }
  if (nzchar(block$hint %||% "")) {
    y <- .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                        chars = 118, fontsize = 7.2, fontface = "italic", col = tk$soft, line_h = 0.011)
  }
  y <- y - 0.007

  part <- .form_pdf_matrix_partition_options(block$options, block$special_override %||% "auto")
  scale <- part$scale
  special <- part$special
  n_scale <- length(scale)
  has_special <- !is.null(special)
  total_cols <- n_scale + (if (has_special) 1L else 0L)

  inner <- w - 0.012
  x0 <- x + 0.006

  # Ancho de etiqueta adaptativo al nº de columnas; el resto se reparte entre las
  # columnas de escala + especial, llenando el ancho.
  label_w <- if (total_cols > 0L) inner * .form_pdf_matrix_label_frac(total_cols) else inner
  scale_area <- inner - label_w
  col_w <- if (total_cols > 0L) scale_area / total_cols else 0
  scale_x0 <- x0 + label_w
  scale_w <- n_scale * col_w
  y_top_tbl <- y

  code_y_off <- 0.010  # los codigos se alinean con la primera linea del item
  # Con muchas columnas, reduce el tamaño del codigo para que quepa.
  code_fs <- if (total_cols >= 10L) 6.0 else if (total_cols >= 8L) 6.6 else 7.4
  header_mode <- .form_pdf_matrix_header_mode(scale, block$header_mode %||% "auto")

  if (total_cols > 0L && identical(header_mode, "categorias")) {
    # --- Cabecera CATEGORIAS: cada label de escala rotulada SOBRE su columna. Si
    # la etiqueta cabe en el ancho de columna se dibuja HORIZONTAL (Si/No,
    # escalas cortas); si es larga se rota 90° (categorias estilo Polarizacion). ---
    cat_labels <- vapply(scale, function(o) .form_pdf_clean_text(o$label %||% o$code), character(1))
    sp_label <- if (has_special) .form_pdf_clean_text(special$label %||% special$code) else ""
    geom <- .form_pdf_matrix_cat_header_geom(cat_labels, sp_label, has_special, col_w, total_cols)
    header_h <- geom$height
    cat_fs <- geom$cat_fs

    grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(y - header_h / 2, "npc"),
                    width = grid::unit(inner, "npc"), height = grid::unit(header_h, "npc"),
                    gp = grid::gpar(fill = tk$tbl_header, col = NA))
    if (identical(geom$layout, "horizontal")) {
      hy <- y - header_h / 2
      for (k in seq_len(n_scale)) {
        grid::grid.text(paste(.form_pdf_wrap(cat_labels[k], geom$col_chars), collapse = "\n"),
                        x = grid::unit(scale_x0 + (k - 0.5) * col_w, "npc"),
                        y = grid::unit(hy, "npc"), just = c("center", "center"),
                        gp = grid::gpar(fontsize = cat_fs, fontface = "bold", col = tk$navy, lineheight = 0.95))
      }
      if (has_special) {
        grid::grid.text(paste(.form_pdf_wrap(sp_label, geom$col_chars), collapse = "\n"),
                        x = grid::unit(scale_x0 + scale_w + col_w / 2, "npc"),
                        y = grid::unit(hy, "npc"), just = c("center", "center"),
                        gp = grid::gpar(fontsize = cat_fs, fontface = "bold", col = tk$soft, lineheight = 0.95))
      }
    } else {
      y_hdr_bottom <- y - header_h + 0.006
      for (k in seq_len(n_scale)) {
        grid::grid.text(cat_labels[k], x = grid::unit(scale_x0 + (k - 0.5) * col_w, "npc"),
                        y = grid::unit(y_hdr_bottom, "npc"), rot = 90, just = c("left", "center"),
                        gp = grid::gpar(fontsize = cat_fs, fontface = "bold", col = tk$navy))
      }
      if (has_special) {
        grid::grid.text(sp_label, x = grid::unit(scale_x0 + scale_w + col_w / 2, "npc"),
                        y = grid::unit(y_hdr_bottom, "npc"), rot = 90, just = c("left", "center"),
                        gp = grid::gpar(fontsize = cat_fs, fontface = "bold", col = tk$soft))
      }
    }
    y <- y - header_h
  } else if (total_cols > 0L) {
    # --- Cabecera EXTREMOS: primer/ultimo ancla CENTRADAS sobre su mitad de
    # columnas + especial; todo centrado (horizontal y vertical), nunca izq/der. ---
    left_n <- ceiling(n_scale / 2)
    right_n <- n_scale - left_n
    anchor_cw <- max(8L, floor(max(1L, left_n) * col_w * 118))
    special_cw <- max(6L, floor(col_w * 118))
    left_lines <- if (n_scale >= 1L) .form_pdf_wrap(scale[[1]]$label %||% scale[[1]]$code, anchor_cw) else character(0)
    right_lines <- if (n_scale >= 2L) .form_pdf_wrap(scale[[n_scale]]$label %||% scale[[n_scale]]$code, anchor_cw) else character(0)
    special_lines <- if (has_special) .form_pdf_wrap(.form_pdf_clean_text(special$label %||% special$code), special_cw) else character(0)
    hdr_lines <- max(1L, length(left_lines), length(right_lines), length(special_lines))
    header_h <- hdr_lines * 0.0110 + 0.010
    hy <- y - header_h / 2

    grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(hy, "npc"),
                    width = grid::unit(inner, "npc"), height = grid::unit(header_h, "npc"),
                    gp = grid::gpar(fill = tk$tbl_header, col = NA))
    if (length(left_lines)) {
      grid::grid.text(paste(left_lines, collapse = "\n"),
                      x = grid::unit(scale_x0 + left_n * col_w / 2, "npc"),
                      y = grid::unit(hy, "npc"), just = c("center", "center"),
                      gp = grid::gpar(fontsize = 6.2, fontface = "bold", col = tk$navy, lineheight = 0.95))
    }
    if (length(right_lines)) {
      grid::grid.text(paste(right_lines, collapse = "\n"),
                      x = grid::unit(scale_x0 + left_n * col_w + right_n * col_w / 2, "npc"),
                      y = grid::unit(hy, "npc"), just = c("center", "center"),
                      gp = grid::gpar(fontsize = 6.2, fontface = "bold", col = tk$navy, lineheight = 0.95))
    }
    if (length(special_lines)) {
      grid::grid.text(paste(special_lines, collapse = "\n"),
                      x = grid::unit(scale_x0 + scale_w + col_w / 2, "npc"),
                      y = grid::unit(hy, "npc"), just = c("center", "center"),
                      gp = grid::gpar(fontsize = 5.8, fontface = "bold", col = tk$soft, lineheight = 0.9))
    }
    y <- y - header_h
  } else {
    header_h <- 0
  }
  # Etiqueta de sub-grupo (subcriterio) en la celda superior-izquierda del header,
  # como los bloques grises de la referencia. Navy bold, alineada a la izquierda.
  if (nzchar(block$group_label %||% "") && header_h > 0) {
    glbl_chars <- max(8L, floor((label_w - 0.012) * 118))
    grid::grid.text(paste(.form_pdf_wrap(block$group_label, glbl_chars), collapse = "\n"),
                    x = grid::unit(x0 + 0.006, "npc"), y = grid::unit(y_top_tbl - header_h / 2, "npc"),
                    just = c("left", "center"),
                    gp = grid::gpar(fontsize = 6.8, fontface = "bold", col = tk$navy, lineheight = 0.95))
  }
  y_body_top <- y

  # --- Filas de items: etiqueta ancha + el CODIGO impreso en cada columna ---
  row_idx <- 0L
  lbl_w_txt <- label_w - 0.012
  for (item in block$items %||% list()) {
    row_idx <- row_idx + 1L
    num <- .form_pdf_clean_text(item$number %||% "")
    subl <- .form_pdf_clean_text(item$subletter %||% "")
    is_parent <- isTRUE(item$is_parent)
    # Prefijo + geometria segun rol: enunciado madre (ancho completo, sin
    # codigos), sub-pregunta a/b/c (letra + sangria) o fila normal (numero).
    if (is_parent) {
      lbl <- if (nzchar(num)) paste0(num, ".  ", item$label) else item$label
      txt_w <- inner - 0.012; indent <- 0
    } else if (nzchar(subl)) {
      lbl <- paste0(subl, ")  ", item$label)
      txt_w <- lbl_w_txt - 0.012; indent <- 0.012
    } else {
      lbl <- if (nzchar(num)) paste0(num, ".  ", item$label) else item$label
      txt_w <- lbl_w_txt; indent <- 0
    }
    # Wrap por ancho real: corta exacto al borde. Debe igualar a .form_pdf_block_height.
    lines <- .form_pdf_wrap_fit(lbl, txt_w, fontsize = 7.3)
    isk <- .form_pdf_clean_text(item$skip %||% "")
    sk_lines <- if (nzchar(isk)) .form_pdf_wrap_fit(isk, lbl_w_txt, fontsize = 6.6, fontface = "italic") else character(0)
    h <- max(0.018, (length(lines) + length(sk_lines)) * 0.012 + 0.007)
    if (row_idx %% 2L == 0L) {
      grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                      width = grid::unit(inner, "npc"), height = grid::unit(h, "npc"),
                      gp = grid::gpar(fill = tk$tbl_zebra, col = NA))
    }
    .form_pdf_text(lbl, x0 + 0.006 + indent, y - 0.004, txt_w,
                   lines = lines, fontsize = 7.3, col = tk$ink, line_h = 0.012)
    if (length(sk_lines)) {
      grid::grid.text(paste(sk_lines, collapse = "\n"), x = grid::unit(x0 + 0.012, "npc"),
                      y = grid::unit(y - 0.004 - length(lines) * 0.012 - 0.001, "npc"),
                      just = c("left", "top"),
                      gp = grid::gpar(fontsize = 6.6, fontface = "italic", col = tk$navy, lineheight = 0.95))
    }
    # La madre (enunciado) no lleva codigos; solo las filas respondibles.
    if (total_cols > 0L && !is_parent) {
      # Codigos CENTRADOS verticalmente sobre el bloque de etiqueta (no el salto).
      cy <- y - 0.004 - length(lines) * 0.012 / 2
      xx <- scale_x0
      for (k in seq_len(n_scale)) {
        grid::grid.text(.form_pdf_clean_text(scale[[k]]$code), x = grid::unit(xx + col_w / 2, "npc"),
                        y = grid::unit(cy, "npc"),
                        gp = grid::gpar(fontsize = code_fs, col = tk$ink))
        xx <- xx + col_w
      }
      if (has_special) {
        grid::grid.text(.form_pdf_clean_text(special$code), x = grid::unit(xx + col_w / 2, "npc"),
                        y = grid::unit(cy, "npc"),
                        gp = grid::gpar(fontsize = code_fs, col = tk$soft))
      }
    }
    y <- y - h
  }

  # Marco exterior + reglas (marco fino; divisores de escala punteados suaves;
  # divisor mas marcado antes de la columna especial).
  tbl_bottom <- y
  grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit((y_top_tbl + tbl_bottom) / 2, "npc"),
                  width = grid::unit(inner, "npc"), height = grid::unit(y_top_tbl - tbl_bottom, "npc"),
                  gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
  if (total_cols > 0L) {
    # divisor etiqueta | escala (solido)
    grid::grid.lines(x = grid::unit(c(scale_x0, scale_x0), "npc"),
                     y = grid::unit(c(tbl_bottom, y_top_tbl), "npc"),
                     gp = grid::gpar(col = tk$tbl_frame, lwd = 0.5))
    # divisores internos entre columnas de escala (punteados suaves)
    if (n_scale >= 2L) {
      for (k in seq_len(n_scale - 1L)) {
        dx <- scale_x0 + col_w * k
        grid::grid.lines(x = grid::unit(c(dx, dx), "npc"), y = grid::unit(c(tbl_bottom, y_top_tbl), "npc"),
                         gp = grid::gpar(col = tk$tbl_div, lwd = 0.4, lty = "dotted"))
      }
    }
    # divisor mas marcado antes de la columna especial
    if (has_special) {
      sdx <- scale_x0 + scale_w
      grid::grid.lines(x = grid::unit(c(sdx, sdx), "npc"), y = grid::unit(c(tbl_bottom, y_top_tbl), "npc"),
                       gp = grid::gpar(col = tk$tbl_frame, lwd = 0.5))
    }
    # regla bajo la cabecera
    grid::grid.lines(x = grid::unit(c(x0, x0 + inner), "npc"),
                     y = grid::unit(c(y_body_top, y_body_top), "npc"),
                     gp = grid::gpar(col = tk$tbl_frame, lwd = 0.5))
  }
  y <- tbl_bottom
  if (nzchar(block$skip %||% "")) {
    y <- .form_pdf_text(block$skip, x + 0.012, y - 0.006, w - 0.024,
                        chars = 112, fontsize = 7.6, fontface = "italic", col = tk$navy, line_h = 0.012)
  }
  y - 0.014
}

.form_pdf_draw_block <- function(block, x, y, w) {
  switch(
    block$kind,
    cover = .form_pdf_draw_cover(block, x, y, w),
    paper = .form_pdf_draw_paper(block, x, y, w),
    section = .form_pdf_draw_section(block, x, y, w),
    matrix = .form_pdf_draw_matrix(block, x, y, w),
    question = .form_pdf_draw_question(block, x, y, w),
    y
  )
}

formulario_pdf_render <- function(model, output_file) {
  grDevices::pdf(output_file, paper = "a4", width = 8.27, height = 11.69, onefile = TRUE)
  on.exit(grDevices::dev.off(), add = TRUE)

  page_no <- 0L
  y_top <- 0.885
  y_bottom <- 0.072
  col_x <- c(0.058, 0.525)
  col_w <- 0.405
  full_x <- 0.058
  full_w <- 0.875
  current_col <- 1L
  y <- c(y_top, y_top)
  divider_top <- NA_real_

  flush_divider <- function(bottom_y = y_bottom) {
    if (is.na(divider_top)) return(invisible(NULL))
    if ((divider_top - bottom_y) > 0.025) {
      grid::grid.lines(
        x = grid::unit(c(0.5, 0.5), "npc"),
        y = grid::unit(c(bottom_y, divider_top), "npc"),
        gp = grid::gpar(col = pulso_pdf_tokens()$faint, lwd = 0.5)
      )
    }
    divider_top <<- NA_real_
    invisible(NULL)
  }

  new_page <- function() {
    if (page_no > 0L) flush_divider(y_bottom)
    page_no <<- page_no + 1L
    grid::grid.newpage()
    .form_pdf_header(model, page_no)
    .form_pdf_footer(model, page_no)
    current_col <<- 1L
    y <<- c(y_top, y_top)
    divider_top <<- NA_real_
  }
  new_page()

  blocks <- model$blocks
  for (bi in seq_along(blocks)) {
    block <- blocks[[bi]]
    nxt <- if (bi < length(blocks)) blocks[[bi + 1L]] else NULL
    h <- .form_pdf_block_height(block, if (isTRUE(block$full_width)) full_w else col_w)
    if (isTRUE(block$full_width)) {
      flush_divider(min(y))
      yy <- min(y)
      # Control de viudas/huerfanas: una banda de seccion no debe quedar sola al
      # pie; debe caber con el inicio de su primer bloque siguiente.
      keep <- h
      if (identical(block$kind, "section") && !is.null(nxt)) {
        nxt_h <- .form_pdf_block_height(nxt, full_w)
        keep <- h + min(nxt_h, 0.085)
      }
      if (yy - h < y_bottom || (yy - keep < y_bottom && yy < (y_top - 0.001))) {
        new_page()
        yy <- y_top
      }
      y_next <- .form_pdf_draw_block(block, full_x, yy, full_w)
      y <- c(y_next, y_next)
      current_col <- 1L
      next
    }

    if (y[current_col] - h < y_bottom) {
      if (current_col == 1L) {
        current_col <- 2L
      } else {
        new_page()
      }
    }
    if (y[current_col] - h < y_bottom) {
      # Bloque mas alto que una columna: dibujarlo igual en pagina nueva.
      if (current_col == 2L) new_page()
    }
    if (is.na(divider_top)) divider_top <- y[current_col]
    y[current_col] <- .form_pdf_draw_block(block, col_x[current_col], y[current_col], col_w)
  }

  flush_divider(y_bottom)
  invisible(output_file)
}

reporte_formulario_pdf <- function(survey, choices, settings = NULL, paper = NULL,
                                   output_file, options = list()) {
  model <- formulario_pdf_build_model(
    survey = survey,
    choices = choices,
    settings = settings,
    paper = paper,
    options = options
  )
  formulario_pdf_render(model, output_file)
  list(
    path = output_file,
    summary = model$summary,
    warnings = model$warnings
  )
}
