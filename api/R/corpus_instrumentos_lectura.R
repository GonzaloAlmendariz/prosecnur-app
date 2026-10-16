# Corpus de instrumentos reales — lectura, huella y familias.
#
# Herramienta de QA (no la llama ninguna ruta): la usan
# `api/scripts/corpus_instrumentos.R` y el test opt-in
# `test-corpus-instrumentos.R`. Los instrumentos son MATERIAL DE CLIENTE y viven
# fuera del repo (`PULSO_CORPUS_DIR`); aqui solo hay codigo.
#
# Regla de lectura: un instrumento se lee con el MISMO lector que usa el editor
# al importar (`.xlsform_editor_assert_xlsform_shape` + `.xlsform_editor_read_sheet`,
# router_xlsform_editor.R). Asi el corpus mide lo que el usuario veria al subir
# el archivo, no lo que un lector propio interpretaria. Nada se reescribe: las
# palabras, los codigos y el orden llegan intactos al workbook.

.CORPUS_HOJAS <- c("survey", "choices", "settings", "paper")

# Lee un .xlsx con el lector del editor. Devuelve list(ok, sheets, error).
.corpus_leer_xlsform <- function(path) {
  res <- tryCatch({
    .xlsform_editor_assert_xlsform_shape(path)
    sheets <- lapply(.CORPUS_HOJAS, function(h) {
      .xlsform_editor_read_sheet(path, h, .xlsform_editor_default_columns(h))
    })
    names(sheets) <- .CORPUS_HOJAS
    # Hoja paper ausente: el editor la siembra vacia; se conserva igual.
    list(ok = TRUE, sheets = sheets, error = NA_character_)
  }, error = function(e) {
    code <- if (inherits(e, "api_error")) as.character(e$code %||% "") else ""
    list(ok = FALSE, sheets = NULL,
         error = trimws(paste(code, conditionMessage(e))))
  })
  res
}

# Columna de una hoja por nombre, insensible a mayusculas; "" si no existe.
.corpus_col <- function(df, nm) {
  if (is.null(df) || !nrow(df)) return(character(0))
  hit <- which(tolower(names(df)) == tolower(nm))
  if (!length(hit)) return(rep("", nrow(df)))
  x <- as.character(df[[hit[1]]])
  x[is.na(x)] <- ""
  x
}

# Columnas de etiqueta (label, label::Español (es), ...), ordenadas.
.corpus_label_cols <- function(df) {
  nms <- names(df %||% list())
  sort(nms[grepl("^label($|::)", nms, ignore.case = TRUE)])
}

.corpus_norm <- function(x) {
  x <- enc2utf8(as.character(x))
  x[is.na(x)] <- ""
  gsub("\\s+", " ", trimws(x))
}

# Filas con contenido (type o name en survey; list_name o name en choices).
.corpus_survey_filas <- function(survey) {
  ty <- .corpus_norm(.corpus_col(survey, "type"))
  nm <- .corpus_norm(.corpus_col(survey, "name"))
  nzchar(ty) | nzchar(nm)
}

# Huella de contenido: secuencia (type, name, labels) de survey y
# (list_name, name, labels) de choices, normalizada (espacios colapsados, type
# en minusculas). Dos archivos con la misma huella son el MISMO instrumento.
.corpus_huella <- function(sheets) {
  sv <- sheets$survey; ch <- sheets$choices
  keep <- .corpus_survey_filas(sv)
  lab_sv <- .corpus_label_cols(sv)
  sv_txt <- paste(
    tolower(.corpus_norm(.corpus_col(sv, "type")))[keep],
    .corpus_norm(.corpus_col(sv, "name"))[keep],
    if (length(lab_sv)) do.call(paste, c(lapply(lab_sv, function(l) .corpus_norm(sv[[l]])[keep]), sep = "␟")) else "",
    sep = "␞")
  ln <- .corpus_norm(.corpus_col(ch, "list_name")); cn <- .corpus_norm(.corpus_col(ch, "name"))
  kc <- nzchar(ln) | nzchar(cn)
  lab_ch <- .corpus_label_cols(ch)
  ch_txt <- paste(ln[kc], cn[kc],
                  if (length(lab_ch)) do.call(paste, c(lapply(lab_ch, function(l) .corpus_norm(ch[[l]])[kc]), sep = "␟")) else "",
                  sep = "␞")
  digest_txt <- paste(c("S", sv_txt, "C", ch_txt), collapse = "\n")
  substr(.corpus_sha256_txt(digest_txt), 1, 16)
}

.corpus_sha256_txt <- function(txt) {
  digest::digest(enc2utf8(txt), algo = "sha256", serialize = FALSE)
}

.corpus_sha256_file <- function(path) {
  digest::digest(file = path, algo = "sha256")
}

# Nombres de variable de survey (sin estructura vacia), para medir versiones.
.corpus_nombres <- function(sheets) {
  sv <- sheets$survey
  nm <- .corpus_norm(.corpus_col(sv, "name"))
  unique(nm[nzchar(nm)])
}

# Similitud de Jaccard entre dos conjuntos de nombres.
.corpus_jaccard <- function(a, b) {
  if (!length(a) && !length(b)) return(1)
  length(intersect(a, b)) / length(union(a, b))
}

# Capacidades del motor que un instrumento ejercita (columnas del manifiesto).
.corpus_rasgos <- function(sheets) {
  sv <- sheets$survey; ch <- sheets$choices; st <- sheets$settings
  keep <- .corpus_survey_filas(sv)
  ty <- tolower(.corpus_norm(.corpus_col(sv, "type")))[keep]
  base <- sub("\\s.*$", "", ty)
  base <- sub("^begin$", "begin_group", base)
  ap <- tolower(.corpus_norm(.corpus_col(sv, "appearance")))[keep]
  labels_sv <- unlist(lapply(.corpus_label_cols(sv), function(l) as.character(sv[[l]])[keep]))
  labels_ch <- unlist(lapply(.corpus_label_cols(ch), function(l) as.character(ch[[l]])))
  textos <- c(labels_sv, labels_ch,
              unlist(lapply(names(sv)[grepl("^hint", names(sv), ignore.case = TRUE)],
                            function(h) as.character(sv[[h]]))))
  textos <- textos[!is.na(textos)]
  idiomas <- unique(sub("^label::", "", c(.corpus_label_cols(sv)[grepl("::", .corpus_label_cols(sv))])))
  paper_cols <- names(sv)[grepl("^paper_", names(sv), ignore.case = TRUE)]
  paper_usadas <- paper_cols[vapply(paper_cols, function(p) any(nzchar(.corpus_norm(sv[[p]]))), logical(1))]
  # Baterias: >= 3 select_one consecutivos con la misma lista (lo que el motor
  # autodetecta como matriz) o apariencias de matriz declaradas.
  bateria <- local({
    lst <- ifelse(base == "select_one", sub("^select_one\\s+", "", ty), NA_character_)
    r <- rle(ifelse(is.na(lst), "∅", lst))
    any(r$lengths >= 3 & r$values != "∅")
  })
  matriz_declarada <- any(ap %in% c("label", "list-nolabel", "table-list")) ||
    any(grepl("table-list|list-nolabel", ap))
  listas <- unique(.corpus_norm(.corpus_col(ch, "list_name")))
  tipos_pregunta <- setdiff(unique(base), c("begin_group", "end_group", "begin_repeat",
                                            "end_repeat", "end", "note", "calculate", ""))
  list(
    filas_survey = sum(keep),
    filas_choices = sum(nzchar(.corpus_norm(.corpus_col(ch, "list_name")))),
    repeat_ = any(base %in% c("begin_repeat")) || any(grepl("^begin repeat", ty)),
    matrices = bateria || matriz_declarada,
    idiomas = if (length(idiomas)) paste(idiomas, collapse = "|") else "",
    n_idiomas = max(1L, length(idiomas)),
    html = any(grepl("<[A-Za-z/][^>]*>|&[a-z]+;|&#[0-9]+;", textos)),
    markdown = any(grepl("\\*\\*[^*]+\\*\\*|(^|\n)\\s*#{1,6}", textos)),
    paper = if (length(paper_usadas)) paste(paper_usadas, collapse = "|") else "",
    hoja_paper = nrow(sheets$paper %||% data.frame()) > 0L,
    choice_filter = any(nzchar(.corpus_norm(.corpus_col(sv, "choice_filter")))),
    relevant = sum(nzchar(.corpus_norm(.corpus_col(sv, "relevant")))[keep]),
    n_listas = length(listas[nzchar(listas)]),
    tipos_mixtos = length(tipos_pregunta),
    tipos = paste(sort(tipos_pregunta), collapse = "|"),
    form_title = .corpus_norm(.corpus_col(st, "form_title"))[1] %||% ""
  )
}

# Familia (estudio) a partir de la ruta relativa al origen: en `01_Estudios/<X>`
# es <X>; en otras areas numeradas, `<area>-<nivel2>[-<nivel3>]` (las carpetas
# de herramientas agrupan varios estudios: ACNUR/MDV, ACNUR/RMS...).
.corpus_familia_de_ruta <- function(rel) {
  partes <- strsplit(rel, "/", fixed = TRUE)[[1]]
  dirs <- partes[-length(partes)]
  if (!length(dirs)) return("raiz")
  area <- sub("^[0-9]+_", "", dirs[1])
  if (grepl("^01_", dirs[1]) && length(dirs) >= 2) {
    fam <- dirs[2]
  } else if (length(dirs) >= 3) {
    fam <- paste(area, dirs[2], dirs[3], sep = "-")
  } else if (length(dirs) == 2) {
    fam <- paste(area, dirs[2], sep = "-")
  } else {
    fam <- area
  }
  .corpus_slug(fam)
}

.corpus_slug <- function(x, max = 48L) {
  x <- iconv(as.character(x), "UTF-8", "ASCII//TRANSLIT", sub = "")
  x <- tolower(gsub("[^A-Za-z0-9]+", "-", x))
  x <- gsub("^-+|-+$", "", x)
  substr(x, 1, max)
}

# Prioridad del area para dar casa a un instrumento repetido en varias carpetas.
.corpus_rango_area <- function(rel) {
  a <- sub("/.*$", "", rel)
  if (grepl("^01_", a)) 1L else if (grepl("^04_", a)) 2L else if (grepl("^90_", a)) 4L else 3L
}

# Orden de preferencia de la version canonica dentro de un grupo:
# no `.bak` > nombre con final/definitivo > vive en la carpeta de su familia >
# mtime mas reciente. El tercer criterio desempata copias de trabajo regadas en
# carpetas de prueba (`90_Pruebas/.../ihsfihi.xlsx`) frente al archivo del estudio.
.corpus_orden_canonico <- function(rel, mtime, en_casa = rep(TRUE, length(rel))) {
  nom <- tolower(basename(rel))
  es_bak <- grepl("\\.bak|backup|respaldo|autorecovered|repaired", tolower(rel))
  es_final <- grepl("final|definitiv", nom)
  order(es_bak, !es_final, !en_casa, -as.numeric(mtime))
}

# Workbook del editor (`{columns, rows}` por hoja) a partir de las hojas leidas.
.corpus_workbook <- function(sheets, original_name) {
  .xlsform_editor_workbook_payload(
    sheets = list(survey = sheets$survey, choices = sheets$choices,
                  settings = sheets$settings, paper = sheets$paper),
    source_kind = "xlsform",
    source_name = original_name
  )
}

# Hojas como data.frame de texto desde un workbook del editor (mismo camino que
# `.xlsform_editor_export_formulario`).
.corpus_frames_de_workbook <- function(workbook) {
  list(
    survey = .xlsform_editor_payload_to_df(workbook$survey, "survey"),
    choices = .xlsform_editor_payload_to_df(workbook$choices, "choices"),
    settings = .xlsform_editor_payload_to_df(workbook$settings, "settings"),
    paper = if (!is.null(workbook$paper)) .xlsform_editor_payload_to_df(workbook$paper, "paper")
            else .xlsform_editor_empty_df(.xlsform_editor_default_columns("paper"))
  )
}

# Construye un .pulso con la coleccion del editor (`s$xlsform_forms`), con los
# helpers reales: entrada -> guard del tope -> upsert -> build_pulso. Devuelve
# list(path, form_ids). `formas` = list(list(sheets, original_name, name)).
.corpus_construir_pulso <- function(formas, dest, nombre_proyecto) {
  if (length(formas) > .XLSFORM_FORMS_MAX) {
    stop(sprintf("%d formularios superan el tope de %d por proyecto", length(formas), .XLSFORM_FORMS_MAX))
  }
  sid <- session_create()
  on.exit(try(session_delete(sid), silent = TRUE), add = TRUE)
  ids <- character(0)
  for (f in formas) {
    payload <- .corpus_workbook(f$sheets, f$original_name)
    s <- session_get(sid)
    .xlsform_forms_guard_limit(s, NULL)
    entry <- .xlsform_forms_as_entry(
      list(workbook = payload$workbook, source = payload$source,
           hallazgos = list(), saved_at = .xlsform_forms_now()),
      name = f$name %||% NULL)
    s <- .xlsform_forms_upsert(s, entry, cliente = TRUE)
    .session_env[[sid]] <- s
    ids <- c(ids, entry$id)
  }
  if (file.exists(dest)) unlink(dest)
  build_pulso(sid, dest, project_name = nombre_proyecto)
  list(path = dest, form_ids = ids)
}

# Abre un .pulso con el MISMO cargador que PULSO_BOOTSTRAP_PROJECT (load_pulso)
# y devuelve sus formularios: list(sid, forms = list(list(id, name, workbook))).
.corpus_abrir_pulso <- function(path) {
  r <- load_pulso(path)
  s <- session_get(r$session_id)
  meta <- .xlsform_forms_list(s)
  forms <- lapply(meta, function(m) {
    e <- .xlsform_forms_get(s, m$id)
    list(id = m$id, name = m$name, n_questions = m$n_questions,
         original_name = as.character(e$source$original_name %||% "")[1],
         workbook = e$workbook)
  })
  list(sid = r$session_id, forms = forms)
}
