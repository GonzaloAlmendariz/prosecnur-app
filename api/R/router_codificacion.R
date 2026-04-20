.require_xlsform_path <- function(sid) {
  s <- session_get(sid)
  xls <- Filter(function(f) f$kind == "xlsform", s$files)
  if (length(xls) == 0) stop_api(409, "E_NO_XLSFORM", "Falta cargar el XLSForm en Fase 1.")
  xls[[length(xls)]]
}

.require_data_path <- function(sid) {
  s <- session_get(sid)
  d <- Filter(function(f) f$kind %in% c("data", "sav"), s$files)
  if (length(d) == 0) stop_api(409, "E_NO_DATA", "Falta cargar la base de datos en Fase 1.")
  d[[length(d)]]
}

.read_data_any <- function(meta) {
  switch(meta$ext,
    xlsx = readxl::read_excel(meta$path),
    xls  = readxl::read_excel(meta$path),
    csv  = utils::read.csv(meta$path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(meta$path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Extensión no soportada: %s", meta$ext))
  )
}

.register_output_file <- function(sid, kind, path) {
  s <- session_get(sid)
  file_id <- uuid::UUIDgenerate()
  original_name <- sub("^[0-9a-fA-F-]{36}__", "", basename(path))
  meta <- list(
    file_id = file_id, kind = kind,
    original_name = original_name, path = path,
    size = as.integer(file.info(path)$size),
    ext = tools::file_ext(path),
    uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  files <- s$files
  files[[file_id]] <- meta
  session_set(sid, "files", files)
  meta
}

# ---- Canonical familias draft ---------------------------------------------
# The canonical model lives as a list of rows in session. We bridge to
# prosecnur by writing an ephemeral xlsx only when crossing the package
# boundary (leer_familias_clasificar, exportar_*, ppra_adaptar_*).

.familias_rows_from_df <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(list())
  chr_cols <- c("tipo","modo_so","parent","parent_label","list_norm",
                "parent_col","other_dummy_col","text_col",
                "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
  for (cc in intersect(chr_cols, names(df))) {
    df[[cc]] <- as.character(df[[cc]])
    df[[cc]][is.na(df[[cc]])] <- ""
  }
  if ("use" %in% names(df)) df$use <- isTRUE_vec(df$use)
  if ("q_order" %in% names(df)) df$q_order <- suppressWarnings(as.integer(df$q_order))
  rows <- vector("list", nrow(df))
  for (i in seq_len(nrow(df))) {
    r <- as.list(df[i, , drop = FALSE])
    r <- lapply(r, function(v) if (length(v) == 1) unname(v) else unname(v))
    rows[[i]] <- r
  }
  rows
}

# jsonlite::fromJSON doesn't set Encoding() on character elements. When a
# UTF-8 body round-trips through session + toJSON, unmarked bytes get escaped
# as <c2><bf> etc. Fix by walking the parsed structure and marking strings.
.mark_utf8 <- function(x) {
  if (is.character(x)) {
    Encoding(x) <- "UTF-8"
    return(x)
  }
  if (is.list(x)) return(lapply(x, .mark_utf8))
  x
}

# Normalize open text responses for similarity grouping: trim whitespace,
# collapse multiple spaces, lowercase, strip accents. Used to dedupe
# visually-equivalent answers ("No sé", "no se ", "NO SE" → "no se").
.normalize_text <- function(s) {
  if (length(s) == 0) return(character(0))
  x <- as.character(s)
  x[is.na(x)] <- ""
  x <- tolower(trimws(x))
  x <- gsub("\\s+", " ", x)
  # strip accents via iconv to ASCII//TRANSLIT fallback
  x <- iconv(x, from = "UTF-8", to = "ASCII//TRANSLIT", sub = "byte")
  # TRANSLIT may leave byte-sequences like <U+00BF> for chars it can't map;
  # drop them together with other non-printable residues.
  x <- gsub("<[^>]+>", "", x)
  x
}

# Walk inst$survey and build a per-question map of {section, section_label,
# q_order}. Sections come from begin_group/end_group markers and nest via
# a stack. Only the innermost section is recorded per pregunta.
.section_map <- function(inst) {
  sv <- inst$survey
  if (is.null(sv) || nrow(sv) == 0L) return(data.frame(name = character(0), section = character(0), section_label = character(0), q_order = integer(0), stringsAsFactors = FALSE))
  # Pull label (prefer Spanish if survey_raw has label::Spanish (es))
  label_raw <- rep("", nrow(sv))
  if (!is.null(inst$survey_raw)) {
    lab_idx <- grep("^label", tolower(names(inst$survey_raw)))
    if (length(lab_idx) > 0L) {
      sp_idx <- grep("spanish|español", tolower(names(inst$survey_raw)[lab_idx]))
      pick <- if (length(sp_idx) > 0L) lab_idx[sp_idx[1]] else lab_idx[1]
      lab_col <- as.character(inst$survey_raw[[pick]])
      if (length(lab_col) == nrow(sv)) label_raw <- lab_col
    }
  }
  if (all(label_raw == "") && "label" %in% names(sv)) label_raw <- as.character(sv$label)
  label_raw[is.na(label_raw)] <- ""
  Encoding(label_raw) <- "UTF-8"

  stack_name <- character(0)
  stack_label <- character(0)
  n <- nrow(sv)
  section <- character(n)
  section_label <- character(n)
  for (i in seq_len(n)) {
    t <- as.character(sv$type[i] %||% "")
    nm <- as.character(sv$name[i] %||% "")
    lb <- label_raw[i]
    if (t == "begin_group" || t == "begin_repeat") {
      stack_name <- c(stack_name, nm)
      stack_label <- c(stack_label, if (nzchar(lb)) lb else nm)
    } else if (t == "end_group" || t == "end_repeat") {
      if (length(stack_name) > 0L) {
        stack_name <- stack_name[-length(stack_name)]
        stack_label <- stack_label[-length(stack_label)]
      }
    } else {
      section[i] <- if (length(stack_name) > 0L) stack_name[length(stack_name)] else ""
      section_label[i] <- if (length(stack_label) > 0L) stack_label[length(stack_label)] else ""
    }
  }
  data.frame(
    name = as.character(sv$name),
    section = section,
    section_label = section_label,
    q_order = if ("q_order" %in% names(sv)) as.integer(sv$q_order) else seq_len(n),
    stringsAsFactors = FALSE
  )
}

# For a SM pregunta, return the full list of choice options with their
# code + label + the dummy column each one corresponds to. Lets the UI
# show "1 · Presencial, 2 · Telefónica, ..., 99 · Otros" so a non-technical
# analyst can click the actual "Otros" option instead of guessing which
# column name ("p7/99"?) is the right dummy.
.opciones_sm <- function(parent, list_name, inst, data_df) {
  if (!nzchar(list_name) || is.null(inst$choices)) return(list())
  ch <- inst$choices[as.character(inst$choices$list_name) == list_name, , drop = FALSE]
  if (nrow(ch) == 0L) return(list())
  # Label preference: label from choices (already UTF-8).
  lbls <- as.character(ch$label %||% ch$name)
  Encoding(lbls) <- "UTF-8"
  codes <- as.character(ch$name)
  cols_data <- names(data_df)
  # Candidate dummy column patterns (SurveyCTO and ODK variants).
  build_cols <- function(code) {
    c(
      sprintf("%s/%s", parent, code),
      sprintf("%s_%s", parent, code),
      sprintf("%s.%s", parent, code)
    )
  }
  lapply(seq_len(nrow(ch)), function(i) {
    code <- codes[i]
    label <- lbls[i]
    candidates <- build_cols(code)
    col_dummy <- candidates[candidates %in% cols_data][1] %||% ""
    if (is.na(col_dummy)) col_dummy <- ""
    # Heuristic: is this the "Otros" option? label contains "otro"/"otra"
    # (case-insensitive after strip accents), or it's the last code >= 70.
    label_norm <- tolower(iconv(label, from = "UTF-8", to = "ASCII//TRANSLIT", sub = ""))
    es_otros <- grepl("\\b(otro|otra|otros|otras|especifi[qc]ue)", label_norm) ||
                suppressWarnings(as.integer(code)) %in% c(70L, 95L, 98L, 99L)
    list(
      codigo = code,
      label = label,
      col_dummy = col_dummy,
      existe_en_data = nzchar(col_dummy),
      es_otros_sugerido = isTRUE(es_otros)
    )
  })
}

# For a SO/SM pregunta, score candidate text columns in data that could be
# its "Otros, especifique". Higher = more confident.
# Rules:
#   1.0  -  column named exactly <parent>_otro(s) | <parent>_especifique | <parent>_detail
#   0.6  -  starts with parent name but doesn't match pattern
#   0.3  -  same section, any text-type column
.candidatos_texto_for <- function(parent, data_df, section_info, all_text_rows) {
  if (!nzchar(parent)) return(list())
  data_cols <- names(data_df)
  # Use PCRE \Q...\E to quote the parent name literally — avoids having to
  # hand-escape each regex metachar (brackets, dots, plus, etc.).
  quoted_parent <- sprintf("\\Q%s\\E", parent)
  strong_suffixes <- c("otro", "otros", "especifique", "detail", "desc", "descripcion")
  strong_rx <- sprintf("^%s[_ \\-]*(%s)s?$", quoted_parent, paste(strong_suffixes, collapse = "|"))
  prefix_rx <- sprintf("^%s[_ \\-]", quoted_parent)
  # Drop NA-name rows (begin_group/end_group markers) to keep `==` safe.
  si <- section_info[!is.na(section_info$name), , drop = FALSE]
  parent_section <- ""
  hit <- si$section[si$name == parent]
  if (length(hit) > 0L) parent_section <- as.character(hit[1])

  cands <- list()
  for (col in data_cols) {
    text_row <- all_text_rows[all_text_rows$name == col, , drop = FALSE]
    if (nrow(text_row) == 0L) next
    score <- 0
    col_sec_hit <- si$section[si$name == col]
    col_section <- if (length(col_sec_hit) > 0L) as.character(col_sec_hit[1]) else ""
    strong_match <- tryCatch(grepl(strong_rx, col, ignore.case = TRUE, perl = TRUE), error = function(e) FALSE)
    prefix_match <- tryCatch(grepl(prefix_rx, col, ignore.case = TRUE, perl = TRUE), error = function(e) FALSE)
    if (isTRUE(strong_match)) score <- 1.0
    else if (isTRUE(prefix_match)) score <- 0.6
    else if (nzchar(parent_section) && col_section == parent_section) score <- 0.3
    if (score > 0) {
      cands[[length(cands) + 1L]] <- list(
        col = col,
        parent_detectado = parent,
        confianza = score
      )
    }
  }
  if (length(cands) > 1L) {
    scores <- vapply(cands, function(c) c$confianza, numeric(1))
    cands <- cands[order(-scores)]
  }
  head(cands, 5)
}

# Given a pregunta row from the draft and the raw data.frame, compute
# response stats: which column to read, total non-empty, unique dedup.
.pregunta_stats <- function(row, data_df) {
  tipo <- as.character(row$tipo %||% "")
  modo_so <- as.character(row$modo_so %||% "")
  parent <- as.character(row$parent %||% "")
  # Pick the relevant column per type, with fallback to parent name
  explicit <- if (tipo == "text") row$text_col %||% row$parent_col
    else if (tipo == "select_one" && modo_so == "hijo") row$text_col
    else if (tipo == "select_one" && modo_so == "padre") row$parent_col
    else if (tipo %in% c("select_multiple", "integer")) row$parent_col
    else NA_character_
  .safe_str <- function(x) {
    if (is.null(x) || length(x) == 0L) return("")
    v <- as.character(x)[[1]]
    if (is.na(v)) "" else v
  }
  col_name <- .safe_str(explicit)
  parent <- .safe_str(parent)
  # Fallback: for tipos that read a value column (not text), the variable
  # name itself typically matches a data column.
  if (col_name == "" && tipo %in% c("integer", "select_multiple") && parent != "") {
    col_name <- parent
  }
  if (col_name == "" && tipo == "select_one" && modo_so == "padre" && parent != "") {
    col_name <- parent
  }
  if (col_name == "" && tipo == "text" && parent != "") {
    col_name <- parent
  }
  if (col_name == "" || !col_name %in% names(data_df)) {
    return(list(col = col_name, n_respuestas = 0L, n_unicas = 0L, preview = character(0)))
  }
  vals <- data_df[[col_name]]
  if (is.factor(vals)) vals <- as.character(vals)
  vals <- as.character(vals)
  vals <- vals[!is.na(vals)]
  if (length(vals) > 0) vals <- vals[nzchar(trimws(vals))]
  n_resp <- length(vals)
  if (n_resp == 0L) {
    return(list(col = col_name, n_respuestas = 0L, n_unicas = 0L, preview = character(0)))
  }
  normed <- .normalize_text(vals)
  normed_nz <- normed[nzchar(normed)]
  uniq <- unique(normed_nz)
  tab <- sort(table(normed_nz), decreasing = TRUE)
  preview <- head(names(tab), 5)
  if (length(preview) > 0) Encoding(preview) <- "UTF-8"
  list(
    col = col_name,
    n_respuestas = as.integer(n_resp),
    n_unicas = as.integer(length(uniq)),
    preview = preview
  )
}

# Build a code→label lookup for a choice list. Used to decorate SO/SM
# responses with their human label (e.g. 1 → "Hombre"). Returns an empty
# named list when list_name is empty or not found.
.choices_lookup <- function(inst, list_name) {
  if (is.null(inst$choices) || !nzchar(list_name %||% "")) return(character(0))
  ch <- inst$choices
  hit <- as.character(ch$list_name) == list_name
  if (!any(hit)) return(character(0))
  codes <- as.character(ch$name[hit])
  labels <- as.character(ch$label[hit])
  Encoding(labels) <- "UTF-8"
  names(labels) <- codes
  labels
}

# Given a parent/child_col pair, enumerate unique responses in data with
# frequency + uuids (for audit). Used by the detail view of text / SO-hijo
# to let the analyst group responses into coded families.
.respuestas_unicas <- function(col, data_df, labels_lookup = character(0)) {
  if (!nzchar(col) || !col %in% names(data_df)) return(list())
  vals <- data_df[[col]]
  if (is.factor(vals)) vals <- as.character(vals)
  vals <- as.character(vals)
  # Resolve uuid column — prosecnur conventions
  uuid_col <- NULL
  for (cn in c("_uuid", "uuid", "Pulso_code")) {
    if (cn %in% names(data_df)) { uuid_col <- cn; break }
  }
  uuids <- if (!is.null(uuid_col)) as.character(data_df[[uuid_col]]) else as.character(seq_along(vals))

  keep_idx <- !is.na(vals) & nzchar(trimws(vals))
  vals <- vals[keep_idx]
  uuids <- uuids[keep_idx]
  if (length(vals) == 0L) return(list())

  normed <- .normalize_text(vals)
  keys <- unique(normed)
  out <- lapply(keys, function(k) {
    ixs <- which(normed == k)
    raws <- vals[ixs]
    raw_tab <- sort(table(raws), decreasing = TRUE)
    display <- names(raw_tab)[1]
    Encoding(display) <- "UTF-8"
    uuids_sample <- uuids[ixs[seq_len(min(10L, length(ixs)))]]
    # Human label via choice list if available (SO/SM: the value is a code
    # like "1" whose display label lives in inst$choices). For text/int
    # without labels_lookup we pass "" and the UI hides the label.
    label <- ""
    if (length(labels_lookup) > 0L) {
      lab <- labels_lookup[display]
      if (!is.null(lab) && !is.na(lab) && nzchar(lab)) {
        label <- as.character(lab)
        Encoding(label) <- "UTF-8"
      }
    }
    list(
      texto_normalizado = k,
      texto = display,
      label = label,
      variantes = as.integer(length(raw_tab)),
      frecuencia = as.integer(length(ixs)),
      uuids = uuids_sample
    )
  })
  freqs <- vapply(out, function(o) o$frecuencia, integer(1))
  out[order(-freqs)]
}

# Classify each column of a "codigos" data sheet by its role. Editable
# columns are {recod, control, aux} — the rest are reference only.
.codigos_col_role <- function(colname) {
  nm <- as.character(colname %||% "")
  if (nm == "") return("pad")
  if (nm %in% c("_uuid", "_index", "Código pulso", "Codigo pulso")) return("id")
  if (grepl("_recod$", nm)) return("recod")
  if (nm %in% c("Control", "Control / notas")) return("control")
  if (nm %in% c("nuevo_codigo", "nueva_etiqueta")) return("aux")
  if (nm %in% c("Seleccionadas", "Seleccionadas_cod")) return("computed")
  if (grepl("_cands$", nm)) return("ref")
  if (grepl("_label$", nm)) return("ref")
  if (nm %in% c("parent_label", "parent_col", "parent_col_cands")) return("ref")
  "ref"
}

isTRUE_vec <- function(x) {
  vapply(x, function(v) {
    if (is.logical(v)) isTRUE(v)
    else if (is.numeric(v)) isTRUE(v > 0)
    else {
      s <- tolower(trimws(as.character(v %||% "")))
      s %in% c("1","true","t","si","sí","yes","y")
    }
  }, logical(1))
}

# Generate the "suggestion" tibble that `escribir_plantilla_familias` would
# write to disk. We call it into a temp xlsx and read it back because the
# helpers that build the tibble are not exported from prosecnur.
.familias_suggest_tibble <- function(sid) {
  xls <- .require_xlsform_path(sid)
  dat <- .require_data_path(sid)
  s <- session_get(sid)
  inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(xls$path)
  data_df <- s$codif_data %||% .read_data_any(dat)
  session_set(sid, "codif_inst", inst)
  session_set(sid, "codif_data", data_df)
  tmp <- tempfile(fileext = ".xlsx")
  on.exit(unlink(tmp), add = TRUE)
  prosecnur::escribir_plantilla_familias(
    inst = inst, dat = list(raw = data_df), path = tmp
  )
  df <- readxl::read_excel(tmp, sheet = "familias")
  df
}

# Rehydrate a draft coming from the frontend into a tibble with the same
# shape as the xlsx "familias" sheet, then write it to an ephemeral xlsx
# so we can feed `leer_familias_clasificar`, which currently requires a
# path (see prosecnur/R/codificacion_flujo_hibrido.R:2416).
.familias_draft_to_xlsx <- function(draft, out_path) {
  rows <- draft$rows %||% list()
  expected <- c("use","q_order","tipo","modo_so","parent","parent_label","list_norm",
                "parent_col","other_dummy_col","text_col",
                "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
  mat <- lapply(expected, function(col) {
    vapply(rows, function(r) {
      v <- r[[col]]
      if (is.null(v)) "" else as.character(v)[[1]]
    }, character(1))
  })
  names(mat) <- expected
  df <- as.data.frame(mat, stringsAsFactors = FALSE)
  df$use <- tolower(trimws(df$use)) %in% c("true","1","t","si","sí","yes","y") |
            grepl("^TRUE$", df$use, ignore.case = TRUE)
  df$q_order <- suppressWarnings(as.integer(df$q_order))

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "familias")
  openxlsx::writeData(wb, "familias", df, colNames = TRUE)
  openxlsx::saveWorkbook(wb, out_path, overwrite = TRUE)
  out_path
}

# ---- Bridge: in-app grupos → plantilla xlsx --------------------------------
# The app is the source of truth: at /aplicar time we regenerate the plantilla
# fresh and patch it with every codification decision the analyst took in-app
# (grupos of responses → code, integer rules, SM dummy). The xlsx only exists
# as a transport layer for ppra_adaptar_* — never displayed to the user.
#
# This first iteration (B3.5a) handles only the "text-like" cases where the
# mapping is (normalized_text → code) 1-to-1:
#   * text solitaria / huerfana (no adopted): sheet named after the parent,
#     recod col <parent>_recod
#   * select_one modo=hijo: sheet named after the SO parent, recod col
#     <text_col>_recod (the adopted "otros" text column)
#
# TODO B3.5b: SO padre (mix original codes + new codes from "Otros" text) + integer ranges
# TODO B3.5c: SM (existing options as booleans + new option columns)

# Match a response text to its code, using the same normalization the UI used
# when building grupos. Returns "" if the text is not covered by any grupo.
.match_grupos <- function(grupos) {
  text_to_code <- new.env(parent = emptyenv())
  new_codes <- list()  # codigo -> etiqueta, only for origen == "nuevo"
  for (g in grupos) {
    codigo <- as.character(g$codigo %||% "")
    if (!nzchar(codigo)) next
    etiqueta <- as.character(g$etiqueta %||% "")
    origen <- as.character(g$origen %||% "")
    resps <- g$respuestas %||% list()
    for (t in resps) {
      tn <- .normalize_text(as.character(t))[1]
      if (nzchar(tn)) assign(tn, codigo, envir = text_to_code)
    }
    if (identical(origen, "nuevo") && nzchar(etiqueta)) {
      new_codes[[codigo]] <- etiqueta
    }
  }
  list(text_to_code = text_to_code, new_codes = new_codes)
}

# Patch a single sheet of the plantilla xlsx to fill one *_recod column
# based on (text in source_col of data_df) → grupo.codigo lookup. Also
# writes the nuevo_codigo / nueva_etiqueta aux block for origen=="nuevo"
# groups. Silently skips if required headers are missing.
.patch_text_sheet <- function(wb, sheet, recod_col, source_col, grupos, data_df) {
  # skipEmptyCols=FALSE is critical: some plantilla sheets have a blank
  # separator column between Control and the aux block. The default
  # (TRUE) sometimes collapses it, shifting column indices and writing
  # aux block data to the wrong column. Always read preserving positions.
  df <- tryCatch(
    openxlsx::readWorkbook(
      wb, sheet = sheet,
      colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE
    ),
    error = function(e) NULL
  )
  if (is.null(df) || nrow(df) < 2L) return(invisible(FALSE))
  tech_row <- as.character(df[1, , drop = TRUE])
  tech_row[is.na(tech_row)] <- ""

  # `which(...)` can inherit names from the tech_row vector; openxlsx::writeData
  # treats a named startCol as an Excel-letter reference, which silently
  # shifts writes. Always strip names.
  uuid_idx      <- unname(which(tech_row == "_uuid")[1])
  recod_idx     <- unname(which(tech_row == recod_col)[1])
  if (length(uuid_idx) == 0L || is.na(uuid_idx) ||
      length(recod_idx) == 0L || is.na(recod_idx)) return(invisible(FALSE))

  nuevo_cod_idx <- unname(which(tech_row == "nuevo_codigo")[1])
  nueva_et_idx  <- unname(which(tech_row == "nueva_etiqueta")[1])

  lookup <- .match_grupos(grupos)
  text_to_code <- lookup$text_to_code
  new_codes <- lookup$new_codes

  # Build uuid → raw response map from the source dataset.
  uuid_col_data <- NULL
  for (cn in c("_uuid", "uuid", "Pulso_code")) {
    if (cn %in% names(data_df)) { uuid_col_data <- cn; break }
  }
  if (is.null(uuid_col_data) || !source_col %in% names(data_df)) return(invisible(FALSE))
  u_raw <- as.character(data_df[[uuid_col_data]])
  r_raw <- as.character(data_df[[source_col]])
  uuid_to_response <- setNames(r_raw, u_raw)

  # Walk data rows in the sheet (xlsx row i == df row i, starting at 3).
  if (nrow(df) >= 3L) {
    for (i in 3:nrow(df)) {
      uid <- as.character(df[i, uuid_idx])
      if (is.na(uid) || !nzchar(uid)) next
      resp <- uuid_to_response[uid]
      if (is.null(resp) || length(resp) == 0L) next
      resp <- resp[[1]]
      if (is.na(resp) || !nzchar(trimws(resp))) next
      resp_norm <- .normalize_text(resp)[1]
      if (!nzchar(resp_norm)) next
      if (!exists(resp_norm, envir = text_to_code, inherits = FALSE)) next
      codigo <- get(resp_norm, envir = text_to_code, inherits = FALSE)
      if (!nzchar(codigo)) next
      openxlsx::writeData(
        wb, sheet = sheet, x = as.character(codigo),
        startCol = recod_idx, startRow = i, colNames = FALSE
      )
    }
  }

  # Aux block: declare new codes once (prosecnur requires unique codigo →
  # etiqueta). We overwrite from row 3 downwards — the block starts empty
  # in a fresh plantilla so there's nothing to preserve.
  if (length(new_codes) > 0L &&
      !is.na(nuevo_cod_idx) && length(nuevo_cod_idx) > 0L &&
      !is.na(nueva_et_idx)  && length(nueva_et_idx) > 0L) {
    codes_vec <- names(new_codes)
    labels_vec <- vapply(codes_vec, function(k) as.character(new_codes[[k]]), character(1))
    for (i in seq_along(codes_vec)) {
      openxlsx::writeData(
        wb, sheet = sheet, x = codes_vec[i],
        startCol = nuevo_cod_idx, startRow = 2L + i, colNames = FALSE
      )
      openxlsx::writeData(
        wb, sheet = sheet, x = labels_vec[i],
        startCol = nueva_et_idx, startRow = 2L + i, colNames = FALSE
      )
    }
  }

  invisible(TRUE)
}

# Main bridge entry point. Loads the plantilla xlsx from session, walks
# every pregunta with codified grupos, patches the sheet, saves.
# Returns a list of per-parent outcome tags for telemetry/debug.
.bridge_grupos_to_plantilla <- function(sid) {
  s <- session_get(sid)
  grupos_map <- s$codif_grupos_recod
  if (is.null(grupos_map) || length(grupos_map) == 0L) {
    return(list(patched = character(0), skipped = character(0)))
  }
  fid <- s$codif_plantilla_codigos_file_id
  if (is.null(fid)) stop_api(500, "E_NO_PLANTILLA_FID", "Falta plantilla xlsx generada.")
  meta <- get_file(sid, fid)
  draft <- s$codif_familias_draft
  data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))

  # Index draft rows by parent for O(1) lookup.
  rows_by_parent <- list()
  for (r in (draft$rows %||% list())) {
    p <- as.character(r$parent %||% "")
    if (nzchar(p)) rows_by_parent[[p]] <- r
  }

  wb <- openxlsx::loadWorkbook(meta$path)
  patched <- character(0)
  skipped <- character(0)

  for (parent in names(grupos_map)) {
    grupos <- grupos_map[[parent]]
    if (length(grupos) == 0L) { skipped <- c(skipped, parent); next }
    row <- rows_by_parent[[parent]]
    if (is.null(row)) { skipped <- c(skipped, parent); next }

    tipo <- as.character(row$tipo %||% "")
    modo_so <- as.character(row$modo_so %||% "")
    text_col <- as.character(row$text_col %||% "")
    parent_col <- as.character(row$parent_col %||% "")

    # Dispatch per arquetipo — for B3.5a only the text-like cases.
    if (tipo == "text") {
      # Text solitaria / huerfana not adopted by SO/SM. Sheet == parent
      # (its own text column), recod col == <parent>_recod. The source
      # column on the data frame is the parent (or text_col if it's a
      # draft where text_col was set explicitly).
      sheet <- parent
      source_col <- if (nzchar(text_col)) text_col else parent
      recod_col <- paste0(source_col, "_recod")
      ok <- .patch_text_sheet(wb, sheet, recod_col, source_col, grupos, data_df)
      if (isTRUE(ok)) patched <- c(patched, parent) else skipped <- c(skipped, parent)
    } else if (tipo == "select_one" && modo_so == "hijo") {
      # SO hijo: the "Otros" text goes into an independent coded variable.
      # Sheet == SO parent (e.g. "p3"), recod col == <text_col>_recod.
      sheet <- parent
      if (!nzchar(text_col)) { skipped <- c(skipped, parent); next }
      recod_col <- paste0(text_col, "_recod")
      ok <- .patch_text_sheet(wb, sheet, recod_col, text_col, grupos, data_df)
      if (isTRUE(ok)) patched <- c(patched, parent) else skipped <- c(skipped, parent)
    } else {
      # TODO B3.5b/c: SO padre, integer, SM
      skipped <- c(skipped, parent)
    }
  }

  openxlsx::saveWorkbook(wb, meta$path, overwrite = TRUE)
  list(patched = patched, skipped = skipped)
}

mount_codificacion <- function(pr) {
  pr |>
    plumber::pr_post("/api/codificacion/plantilla-familias", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      xls <- .require_xlsform_path(sid)
      dat <- .require_data_path(sid)
      inst <- prosecnur::leer_instrumento_xlsform(xls$path)
      data_df <- .read_data_any(dat)
      s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", sprintf("familias_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::escribir_plantilla_familias(inst = inst, dat = list(raw = data_df), path = out_path)
      meta <- .register_output_file(sid, "familias_template", out_path)
      session_set(sid, "codif_inst", inst)
      session_set(sid, "codif_data", data_df)
      session_set(sid, "codif_familias_generated", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_get("/api/codificacion/preguntas-abiertas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      # Ensure we have the draft (will auto-generate suggestion if absent)
      draft <- s$codif_familias_draft
      if (is.null(draft)) {
        # Generate suggestion just like GET /familias/draft does
        df <- .familias_suggest_tibble(sid)
        rows <- .familias_rows_from_df(df)
        draft <- list(
          rows = rows,
          source = "suggestion",
          updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
        )
        session_set(sid, "codif_familias_draft", draft)
        session_set(sid, "codif_familias_generated", TRUE)
      }
      data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      if (is.null(s$codif_data)) session_set(sid, "codif_data", data_df)
      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(.require_xlsform_path(sid)$path)
      if (is.null(s$codif_inst)) session_set(sid, "codif_inst", inst)

      section_info <- .section_map(inst)
      # Survey rows of type text, needed to filter candidatos_texto to actual
      # open-text vars that exist in the instrument.
      text_rows <- if (!is.null(inst$survey)) {
        is_text <- as.character(inst$survey$type) == "text"
        if (any(is_text)) data.frame(name = as.character(inst$survey$name[is_text]), stringsAsFactors = FALSE)
        else data.frame(name = character(0), stringsAsFactors = FALSE)
      } else data.frame(name = character(0), stringsAsFactors = FALSE)

      marcadas_set <- s$codif_marcadas %||% list()

      preguntas <- lapply(draft$rows, function(r) {
        tipo <- as.character(r$tipo %||% "")
        modo_so <- as.character(r$modo_so %||% "")
        parent <- as.character(r$parent %||% "")
        use_flag <- isTRUE(r$use)
        stats <- .pregunta_stats(r, data_df)
        subtipo <- if (tipo == "select_one") {
          if (modo_so == "padre") "select_one_padre"
          else if (modo_so == "hijo") "select_one_hijo"
          else "select_one_sin_modo"
        } else tipo
        recoded <- s$codif_respuestas_recod[[parent]] %||% list()
        n_cod <- length(recoded)
        needs_config <- tipo == "select_one" && !modo_so %in% c("padre", "hijo")
        status <- if (!use_flag) "no-aplica"
          else if (needs_config) "requiere-config"
          else if (stats$n_respuestas == 0L) "sin-datos"
          else if (n_cod == 0L) "no-iniciado"
          else if (n_cod < stats$n_unicas) "en-curso"
          else "completo"

        # XLSForm metadata (section + q_order)
        sec_row <- section_info[!is.na(section_info$name) & section_info$name == parent, , drop = FALSE]
        section <- if (nrow(sec_row) > 0L) as.character(sec_row$section[1]) else ""
        section_label <- if (nrow(sec_row) > 0L) as.character(sec_row$section_label[1]) else ""
        q_order_raw <- if (nrow(sec_row) > 0L) sec_row$q_order[1] else NA_integer_
        if (length(q_order_raw) == 0L || is.na(q_order_raw)) {
          q_order_raw <- tryCatch(as.integer(r$q_order %||% NA), error = function(e) NA_integer_)
        }
        if (length(q_order_raw) == 0L || is.na(q_order_raw)) q_order_raw <- NA_integer_
        if (is.na(section)) section <- ""
        if (is.na(section_label)) section_label <- ""

        # Candidatos de texto solo para SO/SM que no tienen text_col aún asignado
        text_col_current <- as.character(r$text_col %||% "")
        candidatos <- if (tipo %in% c("select_one", "select_multiple") && !nzchar(text_col_current)) {
          .candidatos_texto_for(parent, data_df, section_info, text_rows)
        } else list()

        # Pareja committeada: si text_col no está vacío, hay emparejamiento
        pareja <- if (nzchar(text_col_current)) {
          list(
            child_col = text_col_current,
            modo_so = modo_so,
            dummy_col = as.character(r$other_dummy_col %||% "")
          )
        } else NULL

        # Opciones enriquecidas para SM: permiten a la UI mostrar un selector
        # con codigo + label de cada opcion del instrumento, asi el analista
        # elige "Otros" por semantica y no por nombre de columna cryptico.
        opciones_sm <- if (tipo == "select_multiple") {
          list_norm_r <- as.character(r$list_norm %||% "")
          .opciones_sm(parent, list_norm_r, inst, data_df)
        } else list()

        list(
          parent = parent,
          parent_label = as.character(r$parent_label %||% ""),
          tipo = tipo,
          subtipo = subtipo,
          modo_so = modo_so,
          text_col = text_col_current,
          parent_col = as.character(r$parent_col %||% ""),
          list_norm = as.character(r$list_norm %||% ""),
          col_efectiva = stats$col,
          n_respuestas = stats$n_respuestas,
          n_unicas = stats$n_unicas,
          n_codificadas = as.integer(n_cod),
          status = status,
          habilitada = use_flag,
          preview = stats$preview,
          section = section,
          section_label = section_label,
          q_order = if (is.na(q_order_raw)) NA_integer_ else as.integer(q_order_raw),
          candidatos_texto = candidatos,
          pareja = pareja,
          opciones_sm = opciones_sm,
          # 'marcada': ¿la pregunta entra en el flujo de codificación?
          # - Auto TRUE e inmutable si tiene pareja committeada.
          # - Auto FALSE para adoptadas (su padre las codifica) y para SO
          #   aún sin modo.
          # - Toggle explícito (codif_marcadas) para integer, SO-padre sin
          #   hija, SM sin hija, y text-solitaria/huerfana.
          marcada = !is.null(pareja) || isTRUE(marcadas_set[[parent]]),
          marcada_auto = !is.null(pareja)
        )
      })
      list(ok = TRUE, preguntas = preguntas)
    })) |>
    plumber::pr_post("/api/codificacion/pareja", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      parent <- as.character(parsed$parent %||% "")
      child_col <- as.character(parsed$child_col %||% "")
      modo_so <- as.character(parsed$modo_so %||% "")
      dummy_col <- as.character(parsed$dummy_col %||% "")
      if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent'.")
      if (!nzchar(child_col)) stop_api(400, "E_NO_CHILD", "Falta 'child_col'.")
      draft <- s$codif_familias_draft
      if (is.null(draft)) stop_api(409, "E_NO_DRAFT", "Primero genera el draft de familias.")
      rows <- draft$rows
      hit <- FALSE
      for (i in seq_along(rows)) {
        if (as.character(rows[[i]]$parent %||% "") == parent) {
          rows[[i]]$text_col <- child_col
          if (nzchar(modo_so)) rows[[i]]$modo_so <- modo_so
          if (nzchar(dummy_col)) rows[[i]]$other_dummy_col <- dummy_col
          rows[[i]]$use <- TRUE
          hit <- TRUE
          break
        }
      }
      if (!hit) stop_api(404, "E_NO_PARENT_ROW", sprintf("No se encontró fila para parent='%s'.", parent))
      draft$rows <- rows
      draft$source <- "draft"
      draft$updated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      session_set(sid, "codif_familias_draft", draft)
      list(ok = TRUE, parent = parent, child_col = child_col, modo_so = modo_so, dummy_col = dummy_col)
    })) |>
    plumber::pr_get("/api/codificacion/respuestas", wrap_endpoint(function(req, res, parent = NULL) {
      sid <- session_header(req)
      s <- session_get(sid)
      parent <- as.character(parent %||% "")
      if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent' como query param.")
      draft <- s$codif_familias_draft
      if (is.null(draft)) stop_api(409, "E_NO_DRAFT", "Primero cargá la fase 3.")
      # Find row
      row <- NULL
      for (r in draft$rows) {
        if (as.character(r$parent %||% "") == parent) { row <- r; break }
      }
      if (is.null(row)) stop_api(404, "E_NO_PREGUNTA", sprintf("No encontré la pregunta '%s'.", parent))

      data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      if (is.null(s$codif_data)) session_set(sid, "codif_data", data_df)

      tipo <- as.character(row$tipo %||% "")
      modo_so <- as.character(row$modo_so %||% "")
      # Columna efectiva: en text / SO / SM la cosa a codificar es el
      # texto libre del "Otros, especifique" cuando existe. En SO-padre
      # los valores originales se mantienen automáticamente en el bridge
      # — solo se codifica el text_col para convertir los textos en
      # nuevas opciones del mismo SO. Integer siempre usa parent_col.
      col <- if (tipo == "text") {
        as.character(row$text_col %||% "")
      } else if (tipo == "select_one") {
        tc <- as.character(row$text_col %||% "")
        if (nzchar(tc)) tc else as.character(row$parent_col %||% "")
      } else if (tipo == "select_multiple") {
        tc <- as.character(row$text_col %||% "")
        if (nzchar(tc)) tc else as.character(row$parent_col %||% "")
      } else if (tipo == "integer") {
        as.character(row$parent_col %||% "")
      } else ""
      if (!nzchar(col)) col <- parent  # fallback naming
      # Decorate with choice labels when the column holds SO/SM codes that
      # have a human label in inst$choices. For SO-padre the list is the
      # one declared in the instrument; for SO-hijo, the text_col already
      # contains free text so the lookup returns nothing (no harm).
      inst <- s$codif_inst
      list_name_for_lookup <- if (tipo %in% c("select_one", "select_multiple")) {
        as.character(row$list_norm %||% "")
      } else ""
      labels_lookup <- if (!is.null(inst) && nzchar(list_name_for_lookup)) {
        .choices_lookup(inst, list_name_for_lookup)
      } else character(0)
      respuestas <- .respuestas_unicas(col, data_df, labels_lookup)

      grupos <- s$codif_grupos_recod[[parent]] %||% list()

      # Opciones existentes del choice list del parent (para SO/SM). El
      # codificador las precarga como grupos "existentes" (read-only
      # codigo+etiqueta) para que el analista pueda recategorizar textos
      # hacia ellas en vez de siempre crear códigos nuevos.
      opciones_existentes <- if (length(labels_lookup) > 0L) {
        codes <- names(labels_lookup)
        lapply(seq_along(codes), function(i) {
          lab <- as.character(labels_lookup[[i]])
          Encoding(lab) <- "UTF-8"
          list(codigo = codes[i], etiqueta = lab)
        })
      } else list()

      list(
        ok = TRUE,
        parent = parent,
        col_efectiva = col,
        tipo = tipo,
        modo_so = modo_so,
        respuestas = respuestas,
        grupos = grupos,
        opciones_existentes = opciones_existentes
      )
    })) |>
    plumber::pr_post("/api/codificacion/grupos", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      parent <- as.character(parsed$parent %||% "")
      grupos <- .mark_utf8(parsed$grupos)
      if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent'.")
      if (is.null(grupos)) grupos <- list()
      all_grupos <- s$codif_grupos_recod %||% list()
      all_grupos[[parent]] <- grupos
      session_set(sid, "codif_grupos_recod", all_grupos)
      # Also store summary for status calculation
      recod <- s$codif_respuestas_recod %||% list()
      # cuenta respuestas distintas con grupo asignado
      cod_set <- character(0)
      for (g in grupos) {
        for (t in g$respuestas %||% list()) {
          cod_set <- c(cod_set, as.character(t))
        }
      }
      recod[[parent]] <- as.list(unique(cod_set))
      session_set(sid, "codif_respuestas_recod", recod)
      list(ok = TRUE, parent = parent, n_grupos = length(grupos), n_codificadas = length(unique(cod_set)),
           updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_delete("/api/codificacion/pareja", wrap_endpoint(function(req, res, parent = NULL) {
      sid <- session_header(req)
      s <- session_get(sid)
      parent <- as.character(parent %||% "")
      if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent' como query param.")
      draft <- s$codif_familias_draft
      if (is.null(draft)) stop_api(409, "E_NO_DRAFT", "No hay draft.")
      rows <- draft$rows
      hit <- FALSE
      for (i in seq_along(rows)) {
        if (as.character(rows[[i]]$parent %||% "") == parent) {
          rows[[i]]$text_col <- ""
          rows[[i]]$modo_so <- ""
          rows[[i]]$other_dummy_col <- ""
          hit <- TRUE
          break
        }
      }
      if (!hit) stop_api(404, "E_NO_PARENT_ROW", sprintf("No se encontró fila para parent='%s'.", parent))
      draft$rows <- rows
      draft$updated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      session_set(sid, "codif_familias_draft", draft)
      list(ok = TRUE, parent = parent)
    })) |>
    plumber::pr_post("/api/codificacion/marcar", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      parent <- as.character(parsed$parent %||% "")
      marcada <- isTRUE(parsed$marcada)
      if (!nzchar(parent)) stop_api(400, "E_NO_PARENT", "Falta 'parent'.")
      set <- s$codif_marcadas %||% list()
      if (marcada) {
        if (!parent %in% names(set)) set[[parent]] <- TRUE
      } else {
        set[[parent]] <- NULL
      }
      session_set(sid, "codif_marcadas", set)
      list(ok = TRUE, parent = parent, marcada = marcada)
    })) |>
    plumber::pr_get("/api/codificacion/columnas", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      if (is.null(s$codif_data)) session_set(sid, "codif_data", data_df)
      list(ok = TRUE, columnas = as.character(names(data_df)))
    })) |>
    plumber::pr_get("/api/codificacion/familias/draft", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (!is.null(s$codif_familias_draft)) {
        d <- s$codif_familias_draft
        return(list(
          ok = TRUE,
          rows = d$rows,
          source = d$source %||% "draft",
          updated_at = d$updated_at
        ))
      }
      df <- .familias_suggest_tibble(sid)
      rows <- .familias_rows_from_df(df)
      draft <- list(
        rows = rows,
        source = "suggestion",
        updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
      session_set(sid, "codif_familias_draft", draft)
      session_set(sid, "codif_familias_generated", TRUE)
      list(ok = TRUE, rows = rows, source = "suggestion", updated_at = draft$updated_at)
    })) |>
    plumber::pr_post("/api/codificacion/familias/draft", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      rows <- .mark_utf8(parsed$rows)
      if (is.null(rows)) stop_api(400, "E_MISSING_ROWS", "Body debe incluir 'rows' (lista de filas de familias)")
      if (!is.list(rows)) stop_api(400, "E_BAD_ROWS", "'rows' debe ser una lista JSON")
      draft <- list(
        rows = rows,
        source = "draft",
        updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
      session_set(sid, "codif_familias_draft", draft)
      list(ok = TRUE, n_rows = length(rows), updated_at = draft$updated_at)
    })) |>
    plumber::pr_post("/api/codificacion/familias/commit", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      draft <- s$codif_familias_draft
      if (is.null(draft)) stop_api(409, "E_NO_DRAFT", "No hay draft de familias. Genera primero con GET /api/codificacion/familias/draft.")
      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(.require_xlsform_path(sid)$path)
      data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      dat <- list(raw = data_df)

      fam_path <- file.path(s$dir, "downloads", sprintf("familias_draft_%s.xlsx", uuid::UUIDgenerate()))
      dir.create(dirname(fam_path), showWarnings = FALSE, recursive = TRUE)
      .familias_draft_to_xlsx(draft, fam_path)

      split <- prosecnur::leer_familias_clasificar(path = fam_path, inst = inst, dat = dat, verbose = FALSE)

      session_set(sid, "codif_familias_split", split)
      session_set(sid, "codif_familias_xlsx_path", fam_path)
      session_set(sid, "codif_inst", inst)
      session_set(sid, "codif_data", data_df)

      resumen <- tryCatch(split$resumen, error = function(e) NULL)
      list(
        ok = TRUE,
        n_select_one = nrow(split$select_one %||% data.frame()),
        n_select_multiple = nrow(split$select_multiple %||% data.frame()),
        n_integer = nrow(split$integer %||% data.frame()),
        n_text = nrow(split$text %||% data.frame()),
        n_huerfanos = nrow(split$textos_huerfanos %||% data.frame()),
        resumen = if (!is.null(resumen)) .familias_rows_from_df(resumen) else list()
      )
    })) |>
    plumber::pr_post("/api/codificacion/plantilla-codigos/generar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      split <- s$codif_familias_split
      if (is.null(split)) stop_api(409, "E_NO_SPLIT",
        "Primero valida el borrador de familias (POST /api/codificacion/familias/commit).")
      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(.require_xlsform_path(sid)$path)
      data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      dat <- list(raw = data_df)
      plantilla <- prosecnur::construir_plantilla_desde_familias(inst = inst, dat = dat, split = split)
      out_path <- file.path(s$dir, "downloads",
        sprintf("plantilla_codificacion_%s.xlsx", uuid::UUIDgenerate()))
      dir.create(dirname(out_path), showWarnings = FALSE, recursive = TRUE)
      prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = out_path, inst = inst)
      meta <- .register_output_file(sid, "plantilla_codif_template", out_path)
      session_set(sid, "codif_plantilla_template", TRUE)
      # Auto-register as THE codes template so Paso 4 (aplicar) can work
      # even if the analyst edits everything in-app without re-uploading.
      session_set(sid, "codif_plantilla_codigos_file_id", meta$file_id)
      # Cache sheet metadata so the UI can navigate sheets without reparsing
      nav <- plantilla$navegacion
      sheets_meta <- lapply(seq_len(nrow(nav)), function(i) {
        list(
          name = as.character(nav$hoja[i]),
          tipo = as.character(nav$tipo[i]),
          n = as.integer(nav$n[i])
        )
      })
      session_set(sid, "codif_codigos_sheets_meta", sheets_meta)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size, sheets = sheets_meta)
    })) |>
    plumber::pr_get("/api/codificacion/codigos/sheets", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      meta <- s$codif_codigos_sheets_meta
      if (is.null(meta)) stop_api(409, "E_NO_PLANTILLA",
        "Primero genera la plantilla (POST /api/codificacion/plantilla-codigos/generar).")
      list(ok = TRUE, sheets = meta)
    })) |>
    plumber::pr_get("/api/codificacion/codigos/sheet", wrap_endpoint(function(req, res, name = NULL) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (is.null(name) || !nzchar(name)) stop_api(400, "E_NO_SHEET", "Falta 'name' como query param.")
      fid <- s$codif_plantilla_codigos_file_id
      if (is.null(fid)) stop_api(409, "E_NO_PLANTILLA", "Genera primero la plantilla.")
      meta <- get_file(sid, fid)
      df <- readxl::read_excel(meta$path, sheet = name, col_names = FALSE, .name_repair = "minimal")
      if (nrow(df) < 2) stop_api(500, "E_SHEET_BAD", sprintf("Hoja %s no tiene headers.", name))
      tech_row <- as.character(unlist(df[1, , drop = TRUE]))
      label_row <- as.character(unlist(df[2, , drop = TRUE]))
      tech_row[is.na(tech_row)] <- ""
      label_row[is.na(label_row)] <- ""
      data_rows <- if (nrow(df) > 2) {
        lapply(3:nrow(df), function(i) {
          vals <- unname(unlist(df[i, , drop = TRUE], use.names = FALSE))
          lapply(vals, function(v) {
            if (is.na(v)) return("")
            s <- as.character(v)
            Encoding(s) <- "UTF-8"
            s
          })
        })
      } else list()
      Encoding(tech_row) <- "UTF-8"
      Encoding(label_row) <- "UTF-8"
      col_meta <- lapply(tech_row, function(cn) list(name = cn, role = .codigos_col_role(cn)))
      list(
        ok = TRUE,
        name = name,
        tech_row = as.list(tech_row),
        label_row = as.list(label_row),
        rows = data_rows,
        col_meta = col_meta
      )
    })) |>
    plumber::pr_post("/api/codificacion/codigos/sheet/patches", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      s <- session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      name <- parsed$name
      patches <- .mark_utf8(parsed$patches)
      if (is.null(name) || !nzchar(name)) stop_api(400, "E_NO_SHEET", "Body debe incluir 'name'.")
      if (is.null(patches) || length(patches) == 0L) return(list(ok = TRUE, applied = 0L))
      fid <- s$codif_plantilla_codigos_file_id
      if (is.null(fid)) stop_api(409, "E_NO_PLANTILLA", "Genera primero la plantilla.")
      meta <- get_file(sid, fid)
      wb <- openxlsx::loadWorkbook(meta$path)
      # Each patch: {row (0-indexed data row => xlsx row = row+3), col_index (0-indexed), value}
      applied <- 0L
      for (p in patches) {
        xlsx_row <- as.integer(p$row) + 3L
        xlsx_col <- as.integer(p$col_index) + 1L
        val <- p$value
        if (is.null(val)) val <- ""
        openxlsx::writeData(wb, sheet = name, x = as.character(val),
                            startCol = xlsx_col, startRow = xlsx_row, colNames = FALSE)
        applied <- applied + 1L
      }
      openxlsx::saveWorkbook(wb, meta$path, overwrite = TRUE)
      # refresh size in file metadata
      files <- s$files
      if (!is.null(files[[fid]])) {
        files[[fid]]$size <- as.integer(file.info(meta$path)$size)
        files[[fid]]$uploaded_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
        session_set(sid, "files", files)
      }
      list(ok = TRUE, applied = applied, updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
    })) |>
    plumber::pr_post("/api/codificacion/familias/aplicar", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta file_id del xlsx de familias editado")
      fam_meta <- get_file(sid, file_id)
      s <- session_get(sid)
      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(.require_xlsform_path(sid)$path)
      dat_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      dat <- if (is.data.frame(dat_df)) list(raw = dat_df) else dat_df

      split <- prosecnur::leer_familias_clasificar(path = fam_meta$path, inst = inst, dat = dat, verbose = FALSE)
      plantilla <- prosecnur::construir_plantilla_desde_familias(inst = inst, dat = dat, split = split)

      out_path <- file.path(s$dir, "downloads", sprintf("plantilla_codificacion_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = out_path, inst = inst)
      meta <- .register_output_file(sid, "plantilla_codif_template", out_path)
      session_set(sid, "codif_familias_file_id", file_id)
      session_set(sid, "codif_plantilla_template", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/codificacion/plantilla-codigos/subir", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta file_id de la plantilla de códigos editada")
      meta <- get_file(sid, file_id)
      session_set(sid, "codif_plantilla_codigos_file_id", file_id)
      list(ok = TRUE, original_name = meta$original_name, size = meta$size)
    })) |>
    plumber::pr_post("/api/codificacion/aplicar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      xls <- .require_xlsform_path(sid)
      dat <- .require_data_path(sid)

      # The app is the source of truth. On every /aplicar we rebuild the
      # plantilla xlsx from the current in-app state (familias draft +
      # grupos + rules) — no reliance on stale user-edited xlsx files.

      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(xls$path)
      data_df <- s$codif_data %||% .read_data_any(dat)
      session_set(sid, "codif_inst", inst)
      session_set(sid, "codif_data", data_df)

      # 1) Ensure we have a familias draft (auto-generate from suggestion
      # if the analyst never touched Fase 3).
      draft <- s$codif_familias_draft
      if (is.null(draft)) {
        df <- .familias_suggest_tibble(sid)
        rows <- .familias_rows_from_df(df)
        draft <- list(
          rows = rows,
          source = "suggestion",
          updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
        )
        session_set(sid, "codif_familias_draft", draft)
      }

      # Promote the user's manual "marcada" toggles into draft$rows$use so
      # prosecnur::leer_familias_clasificar picks them up. Auto-marcadas
      # (preguntas con pareja comitteada) ya tienen use=TRUE porque lo seteó
      # /pareja, pero las text-huerfanas/solitarias/integer marcadas a mano
      # por la UI solo viven en codif_marcadas hasta este momento.
      marcadas_set <- s$codif_marcadas %||% list()
      if (length(marcadas_set) > 0L) {
        for (i in seq_along(draft$rows)) {
          p <- as.character(draft$rows[[i]]$parent %||% "")
          if (nzchar(p) && isTRUE(marcadas_set[[p]])) {
            draft$rows[[i]]$use <- TRUE
          }
        }
      }

      # Normalize draft for prosecnur: our UI only tracks pairing at the
      # parent level, but construir_plantilla_desde_familias requires
      # parent_col to point to an actual data column (rows with empty
      # parent_col are silently skipped). For SO/SM/integer this is
      # always the parent name when present in data; we fill it here.
      data_cols <- names(data_df)
      for (i in seq_along(draft$rows)) {
        r <- draft$rows[[i]]
        tipo <- as.character(r$tipo %||% "")
        parent <- as.character(r$parent %||% "")
        pcol <- as.character(r$parent_col %||% "")
        if (!nzchar(pcol) &&
            tipo %in% c("select_one","select_multiple","integer") &&
            nzchar(parent) && parent %in% data_cols) {
          draft$rows[[i]]$parent_col <- parent
        }
      }

      # 2) Write the draft to a fresh xlsx and classify it via prosecnur.
      fam_path <- file.path(s$dir, "downloads",
        sprintf("familias_draft_%s.xlsx", uuid::UUIDgenerate()))
      dir.create(dirname(fam_path), showWarnings = FALSE, recursive = TRUE)
      .familias_draft_to_xlsx(draft, fam_path)
      split <- prosecnur::leer_familias_clasificar(
        path = fam_path, inst = inst, dat = list(raw = data_df), verbose = FALSE
      )
      session_set(sid, "codif_familias_split", split)
      session_set(sid, "codif_familias_xlsx_path", fam_path)

      # 3) Build & export the plantilla xlsx (empty recod columns).
      plantilla <- prosecnur::construir_plantilla_desde_familias(
        inst = inst, dat = list(raw = data_df), split = split
      )
      codes_path <- file.path(s$dir, "downloads",
        sprintf("plantilla_codificacion_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::exportar_plantilla_codificacion_xlsx(
        plantilla, path_xlsx = codes_path, inst = inst
      )
      codes_meta <- .register_output_file(sid, "plantilla_codif_template", codes_path)
      session_set(sid, "codif_plantilla_codigos_file_id", codes_meta$file_id)

      # 4) Bridge — write every in-app codification decision into the xlsx.
      .bridge_grupos_to_plantilla(sid)

      # 5) Extract the list of vars ppra_adaptar_data needs to know explicitly
      # (it's a bare-bones function: no args → no work done). Pull them from
      # the split we just produced.
      .vars_from_split <- function(sub, modo = NULL) {
        if (is.null(sub) || !nrow(sub)) return(character(0))
        x <- if (!is.null(modo)) sub[sub$modo_so == modo, , drop = FALSE] else sub
        out <- as.character(x$parent_col %||% x$parent)
        out <- out[!is.na(out) & nzchar(out)]
        unique(out)
      }
      so_parent_vars <- .vars_from_split(split$select_one, modo = "padre")
      so_child_vars  <- .vars_from_split(split$select_one, modo = "hijo")
      sm_vars        <- .vars_from_split(split$select_multiple)
      int_vars       <- .vars_from_split(split$integer)

      data_out <- file.path(s$dir, "downloads",
        sprintf("data_adaptada_%s.xlsx", uuid::UUIDgenerate()))
      inst_out <- file.path(s$dir, "downloads",
        sprintf("instrumento_adaptado_%s.xlsx", uuid::UUIDgenerate()))

      job_id <- job_submit(
        sid = sid,
        kind = "codificacion.aplicar",
        func = function(xls_path, data_path, codes_path, fam_path, data_out, inst_out,
                        sm_vars, so_parent_vars, so_child_vars, int_vars) {
          prosecnur::ppra_adaptar_data(
            path_instrumento = xls_path,
            path_datos       = data_path,
            path_plantilla   = codes_path,
            sm_vars          = sm_vars,
            so_parent_vars   = so_parent_vars,
            so_child_vars    = so_child_vars,
            int_vars         = int_vars,
            out_path         = data_out,
            path_familias    = fam_path
          )
          prosecnur::ppra_adaptar_instrumento(
            path_instrumento_in  = xls_path,
            path_data_adaptada   = data_out,
            path_instrumento_out = inst_out,
            path_plantilla       = codes_path
          )
          list(data_out = data_out, inst_out = inst_out)
        },
        args = list(
          xls_path = xls$path,
          data_path = dat$path,
          codes_path = codes_path,
          fam_path = fam_path,
          data_out = data_out,
          inst_out = inst_out,
          sm_vars = sm_vars,
          so_parent_vars = so_parent_vars,
          so_child_vars = so_child_vars,
          int_vars = int_vars
        ),
        on_complete = function(j) {
          paths <- j$result_data
          data_meta <- .register_output_file(j$sid, "data_adaptada", paths$data_out)
          inst_meta <- .register_output_file(j$sid, "instrumento_adaptado", paths$inst_out)
          session_set(j$sid, "codif_data_adaptada_fid", data_meta$file_id)
          session_set(j$sid, "codif_inst_adaptado_fid", inst_meta$file_id)
          session_set(j$sid, "codif_aplicado", TRUE)
          list(
            ok = TRUE,
            data_adaptada = list(file_id = data_meta$file_id, size = data_meta$size),
            instrumento_adaptado = list(file_id = inst_meta$file_id, size = inst_meta$size)
          )
        }
      )
      list(ok = TRUE, job_id = job_id, kind = "codificacion.aplicar")
    }))
}
