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

# Limpieza INOCUA y reversible: homogeneiza espacios y puntuacion tipografica
# sin borrar ningun caracter con significado. Es la unica que puede tocar una
# ETIQUETA DE CATEGORIA (checklist item 11 y "regla que no se negocia": las
# categorias de respuesta existentes no se tocan).
.form_pdf_clean_text_safe <- function(x) {
  x <- .form_pdf_chr(x)
  x <- gsub("\u00a0", " ", x, fixed = TRUE)
  x <- gsub("\u2013|\u2014|\u2212", "-", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'", x, perl = TRUE)
  x <- gsub("\u201c|\u201d", "\"", x, perl = TRUE)
  x <- gsub("\\s+", " ", x, perl = TRUE)
  trimws(x)
}

# Limpieza COMPLETA: la inocua mas el desmarcado de markdown (`**`, `__`) y el
# borrado de backticks y asteriscos sueltos. Con PERDIDA: `De 5* a 10*` sale
# `De 5 a 10`. Se aplica a enunciados y titulos, NUNCA a categorias.
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

# Elige el primer valor no vacio. Limpia con la variante que CONSERVA el enfasis:
# su trabajo es elegir, no decidir el formato — de eso se encarga el llamador, y
# si aqui se borran los `**` ya no llegan. Esta era la CUARTA capa que re-limpiaba
# el mismo texto (las otras: clean_text, paper_text y strip_leading_number), y
# basto una para perder el enfasis del instrumento entero.
.form_pdf_first_nonempty <- function(...) {
  vals <- list(...)
  for (val in vals) {
    txt <- .form_pdf_clean_text_enfasis(val)
    if (nzchar(txt)) return(txt)
  }
  ""
}

# Quita del enunciado el prefijo de numeracion que trae el XLSForm, para que no
# se imprima dos veces junto al numero que impone el motor (item 6 del
# checklist: salieron "C. C. SOLEDAD" y "3. P6.").
#
# CUBIERTO (se quita):
#   "6. ", "6) ", "6: ", "6- ", "6.- " (separador de dos caracteres),
#   "6.¿"  (sin espacio tras el separador), "(6) " (entre parentesis),
#   "P6. ", "P.6 ", "Pregunta 6. " (prefijo con letra),
#   "C. ", "A) " (letra suelta) y "IV. " (romano) SOLO si coinciden con el
#   identificador que el motor va a imponer.
#
# NO CUBIERTO A PROPOSITO (se conserva):
#   "3 de cada 5 jovenes..."  -> sin separador el digito es parte del enunciado;
#                                solo se quita sin separador si lo que sigue abre
#                                pregunta o exclamacion (¿ ¡ « ").
#   "2. ° piso"               -> tras el separador viene un ordinal: no es
#                                numeracion, y quitarlo rompe el texto.
#   "1990. Ano de nacimiento" -> mas de tres digitos no es numero de pregunta.
#   "12.3 Item de bateria"    -> sin separador; y el "12." de en medio no se
#                                quita solo, que dejaria el enunciado en "3 Item".
#   "A. DATOS GENERALES"      -> letra suelta que el motor NO impone (las bandas
#                                de seccion no reciben numero): es la unica
#                                fuente de esa letra, no se toca.
#   Cualquier prefijo cuyo retiro deje la etiqueta vacia.
.form_pdf_strip_leading_number <- function(label, number) {
  # Limpieza que CONSERVA el enfasis: esta funcion corre ANTES de
  # `paper_text_enfasis`, asi que si aqui se borran los `**` el enfasis ya no
  # llega. Van tres capas re-limpiando el mismo texto; esta es la primera.
  label <- .form_pdf_clean_text_enfasis(label)
  number <- .form_pdf_clean_text(number)
  if (!nzchar(label)) return(label)

  # Aplica `rx` solo si el resultado sigue siendo una etiqueta legible.
  try_strip <- function(lbl, rx) {
    out <- sub(rx, "", lbl, perl = TRUE)
    if (identical(out, lbl)) return(lbl)
    out <- trimws(out)
    if (!nzchar(out)) return(lbl)                                   # no vaciar
    if (grepl("^[\u00b0\u00ba\u00aa]", out, perl = TRUE)) return(lbl)  # "2. ° piso"
    out
  }

  if (nzchar(number)) {
    esc <- gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", number, perl = TRUE)
    # Con separador: "(6)", "P.6.-", "Pregunta 6:", "6.¿", "IV.", "C)".
    before <- paste0(
      "^\\s*\\(?\\s*(?:[Pp](?:regunta|REGUNTA)?\\s*\\.?\\s*)?", esc, "\\s*\\)?"
    )
    label <- try_strip(label, paste0(before, "\\s*[).:\u2013-]{1,2}\\s*"))
    # Sin separador: solo cuando lo que sigue abre pregunta/exclamacion/cita.
    label <- try_strip(label, paste0(before, "\\s+(?=[\u00bf\u00a1\u00ab\"])"))
    # Sin separador pero CON letra de pregunta ("P.6 ", "P6 ", "Pregunta 6 "):
    # la letra ya hace inequivoco que es numeracion.
    label <- try_strip(label, paste0(
      "^\\s*[Pp](?:regunta|REGUNTA)?\\s*\\.?\\s*", esc, "\\s*[).:\u2013-]{0,2}\\s+"))
    # Sin separador pero con SUBNUMERO impuesto ("12.3 Afirmacion"): un numero
    # compuesto al inicio ya es inequivocamente numeracion, no enunciado.
    if (grepl(".", number, fixed = TRUE)) {
      label <- try_strip(label, paste0("^\\s*", esc, "\\s+"))
    }
    # Entre parentesis cerrados sin separador extra: "(6) Edad".
    label <- try_strip(label, paste0("^\\s*\\(\\s*", esc, "\\s*\\)\\s*"))
  }

  # Prefijo INEQUIVOCO de numeracion (digito de 1 a 3 cifras con separador
  # explicito), aunque no coincida con el numero impuesto: "P6.-", "6.1)", "6.\u00bf".
  # La unica letra admitida sin coincidencia es la P de "P6"/"Pregunta 6": otra
  # letra suelta seria texto del enunciado ("De 5. ..." no se toca).
  # El `(?![0-9])` tras el separador evita comerse la mitad de un numero
  # compuesto: en "12.3 Item" el "12." NO es prefijo, el numero es "12.3".
  num_rx <- "(?:[Pp](?:regunta|REGUNTA)?\\s*\\.?\\s*)?[0-9]{1,3}(?:\\.[0-9]{1,2})?"
  label <- try_strip(label, paste0("^\\s*", num_rx, "\\s*[).:\u2013-]{1,2}\\s*(?![0-9])"))
  # Con letra de pregunta no hace falta separador: "P.6 ", "Pregunta 6 ".
  label <- try_strip(
    label,
    "^\\s*[Pp](?:regunta|REGUNTA)\\s*\\.?\\s*[0-9]{1,3}(?:\\.[0-9]{1,2})?\\s*[).:\u2013-]{0,2}\\s+(?![0-9])")
  # Entre parentesis: "(12) Edad" (el parentesis ya hace de separador).
  label <- try_strip(label, paste0("^\\s*\\(\\s*", num_rx, "\\s*\\)\\s*[.:\u2013-]?\\s*"))
  trimws(label)
}

# Limpieza que CONSERVA el enfasis del autor. La completa borra `**palabra**` y
# deja texto plano; la referencia usa esa negrita para el sujeto de cada item
# («Mi **mama/cuidadora** se da cuenta de lo que necesito»), asi que borrarla
# pierde intencion del instrumento, igual que borrar un `*` de una categoria
# perdia contenido. Los renderers la pintan; el resto de la limpieza es la misma.
.form_pdf_clean_text_enfasis <- function(x) {
  x <- .form_pdf_chr(x)
  x <- gsub("\u00a0", " ", x, fixed = TRUE)
  x <- gsub("\u2013|\u2014|\u2212", "-", x, perl = TRUE)
  x <- gsub("\u2018|\u2019", "'", x, perl = TRUE)
  x <- gsub("\u201c|\u201d", "\"", x, perl = TRUE)
  x <- gsub("__([^_]+)__", "\\1", x, perl = TRUE)
  # Se van los backticks y los asteriscos SUELTOS; los pares `**` sobreviven.
  x <- gsub("`", "", x, perl = TRUE)
  x <- gsub("(?<!\\*)\\*(?!\\*)", "", x, perl = TRUE)
  x <- gsub("\\s+", " ", x, perl = TRUE)
  trimws(x)
}

.form_pdf_paper_text_enfasis <- function(text, blank = "__________") {
  text <- .form_pdf_clean_text_enfasis(text)
  if (!nzchar(text)) return(text)
  gsub("\\$\\{[^}]+\\}", blank, text, perl = TRUE)
}

# Parte un texto en tramos `list(texto, negrita)` segun los pares `**`. Es lo que
# consumen los renderers para pintar el enfasis en vez de tirarlo.
.form_pdf_tramos_enfasis <- function(txt) {
  txt <- .form_pdf_chr(txt)
  if (!nzchar(txt)) return(list())
  piezas <- strsplit(txt, "\\*\\*", fixed = FALSE)[[1]]
  if (length(piezas) < 2L) return(list(list(texto = txt, negrita = FALSE)))
  # Los pares alternan: fuera, dentro, fuera, dentro...
  # Con un numero IMPAR de marcadores el ultimo no cierra nada, asi que su tramo
  # va en redonda. Si no, un `**` suelto pondria en negrita todo el resto de la
  # etiqueta, que es peor que ignorarlo.
  n_marcas <- lengths(regmatches(txt, gregexpr("\\*\\*", txt)))
  cierra <- (n_marcas %% 2L) == 0L
  out <- list()
  for (i in seq_along(piezas)) {
    if (!nzchar(piezas[i])) next
    dentro <- (i %% 2L == 0L) && (cierra || i < length(piezas))
    out[[length(out) + 1L]] <- list(texto = piezas[i], negrita = dentro)
  }
  out
}

.form_pdf_paper_text <- function(text, blank = "__________") {
  text <- .form_pdf_clean_text(text)
  if (!nzchar(text)) return(text)
  gsub("\\$\\{[^}]+\\}", blank, text, perl = TRUE)
}

# Variante sin perdida para etiquetas de categoria (ver `.form_pdf_clean_text_safe`).
.form_pdf_paper_text_safe <- function(text, blank = "__________") {
  text <- .form_pdf_clean_text_safe(text)
  if (!nzchar(text)) return(text)
  gsub("\\$\\{[^}]+\\}", blank, text, perl = TRUE)
}

.form_pdf_prefix <- function(name) {
  raw <- .form_pdf_chr(name)
  m <- regmatches(raw, regexec("^([A-Za-z_]*[0-9]+)[_./-].+$", raw, perl = TRUE))[[1]]
  if (length(m) >= 2L) m[2] else ""
}

# Las ETIQUETAS DE CATEGORIA pasan por la limpieza SEGURA (item 11): la
# completa borraba `*` y backticks en silencio (`De 5* a 10*` -> `De 5 a 10`).
# Cuando ambas limpiezas difieren se declara el caso en un warning del modelo
# (atributo "warnings" del resultado): declarado y reversible, nunca en silencio.
.form_pdf_options_by_list <- function(choices) {
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  if (!nrow(choices)) return(structure(list(), warnings = character(0)))
  rows <- split(choices, choices$list_name)
  rows <- rows[nzchar(names(rows))]
  warnings <- character(0)
  out <- lapply(names(rows), function(list_name) {
    df <- rows[[list_name]]
    lapply(seq_len(nrow(df)), function(i) {
      label_safe <- .form_pdf_paper_text_safe(df$label[i])
      label_full <- .form_pdf_paper_text(df$label[i])
      if (!identical(label_safe, label_full)) {
        warnings <<- c(warnings, sprintf(
          "Categoria conservada tal cual en la lista `%s`, codigo `%s`: «%s» (la limpieza de enunciados la habria dejado como «%s»).",
          list_name, .form_pdf_chr(df$name[i]), label_safe, label_full
        ))
      }
      list(
        code = .form_pdf_chr(df$name[i]),
        label = label_safe,
        # Item 19: tramos de la categoria (solo HTML; `**` y `#` son texto).
        label_rt = if (".rt_label" %in% names(df))
          .form_rt_de(df$.rt_label[i], label_safe, enfasis = FALSE, markdown = FALSE),
        paper_skip = .form_pdf_clean_text(df$paper_skip[i])
      )
    })
  })
  names(out) <- names(rows)
  structure(out, warnings = unique(warnings))
}

.form_pdf_matrix_keys <- function(survey) {
  n <- nrow(survey)
  keys <- rep("", n)
  warnings <- character(0)
  explicit <- survey$paper_group
  # Item 7: una fila que no es pregunta (tipicamente la instruccion `note` que
  # encabeza la bateria) NO entra a la matriz aunque comparta `paper_group`;
  # si entrara, se dibujaria como fila 1 con celdas de escala.
  bases <- vapply(seq_len(n), function(i) .form_pdf_type_base(survey$type[i]), character(1))
  eligible <- bases %in% .form_pdf_question_bases()
  dropped <- nzchar(explicit) & !eligible
  if (any(dropped)) {
    warnings <- c(warnings, sprintf(
      "Excluidas de la matriz `%s` filas que no son preguntas: %s.",
      paste(unique(explicit[dropped]), collapse = ", "),
      paste(survey$name[dropped], collapse = ", ")
    ))
  }
  keep <- nzchar(explicit) & eligible
  keys[keep] <- paste0("manual:", explicit[keep])

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
  structure(keys, warnings = unique(warnings))
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
    # Item 7: las filas que no son preguntas (la instruccion `note` que encabeza
    # la bateria) salen del grupo antes de comprobar contiguidad. Si al quitarlas
    # el resto deja de ser contiguo, el grupo se ignora por la via de siempre.
    not_q <- vapply(rows, function(r) {
      !(.form_pdf_type_base(survey$type[r]) %in% .form_pdf_question_bases())
    }, logical(1))
    if (any(not_q)) {
      warnings <- c(warnings, sprintf(
        "Excluidas del grupo de matriz filas que no son preguntas: %s.",
        paste(survey$name[rows[not_q]], collapse = ", ")))
      rows <- rows[!not_q]
    }
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

.form_pdf_resolve_label_cols <- function(df, lang) {
  # Materializa `label` (y `hint` si el instrumento la trae) desde columnas
  # localizadas `label::es`, `hint::es`, etc., prefiriendo español. Sin esto los
  # XLSForms multilingües / SurveyMonkey salen con los numeros pero sin texto.
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  if (!nrow(df)) return(df)
  lab <- xlsform_coalesce_label(df, lang, "label")
  prestadas <- attr(lab, "otro_idioma")
  ajenas <- attr(lab, "otra_escritura")
  df$label <- as.character(lab)
  if ("hint" %in% names(df) || length(grep("^hint(::|_)", names(df), ignore.case = TRUE))) {
    hin <- xlsform_coalesce_label(df, lang, "hint")
    prestadas <- rbind(prestadas, attr(hin, "otro_idioma"))
    ajenas <- rbind(ajenas, attr(hin, "otra_escritura"))
    df$hint <- as.character(hin)
  }
  # Item 43: lo que se tomo de otro idioma se declara (celda por celda).
  attr(df, "otro_idioma") <- .form_pdf_aviso_otro_idioma(df, prestadas, lang, ajenas)
  df
}

# Numeros de pregunta de primer nivel que el instrumento IMPRIME, sin repetir.
# Es el grano de `summary$n_questions` (B2). Se lee de lo que los renderers
# pintan, no de los tipos del XLSForm:
#   - una `note` no lleva numero (item 7): no cuenta;
#   - una pregunta con `paper_number = "-"` sale sin numero: no cuenta;
#   - una matriz CON tenor imprime «X. tenor» y sus filas X.1, X.2…: cuenta 1;
#   - una matriz SIN tenor imprime un numero por fila: cuenta sus filas, salvo
#     las sub-preguntas (a, b, c…), que se rotulan con letra, no con numero;
#   - un numero con punto (`paper_number = "5.1"`) es de segundo nivel.
# Unico, porque un numero repetido a mano sigue siendo una sola «P5».
.form_pdf_numeros_impresos <- function(blocks) {
  nums <- character(0)
  for (b in blocks %||% list()) {
    kind <- b$kind %||% ""
    if (identical(kind, "question")) {
      if (identical(b$type %||% "", "note")) next
      nums <- c(nums, .form_pdf_clean_text(b$number %||% ""))
    } else if (identical(kind, "matrix")) {
      # Item 39: una matriz consume UN numero X (sus filas son X.1..X.k).
      nums <- c(nums, .form_pdf_clean_text(b$number %||% ""))
    }
  }
  nums <- nums[nzchar(nums) & !grepl(".", nums, fixed = TRUE)]
  unique(nums)
}

formulario_pdf_build_model <- function(survey, choices, settings = NULL, paper = NULL, options = list()) {
  # Item 46: NFC al leer (la tilde combinada salia con otra fuente).
  survey <- .form_pdf_nfc(survey); choices <- .form_pdf_nfc(choices)
  settings <- .form_pdf_nfc(settings); paper <- .form_pdf_nfc(paper)
  settings <- .form_pdf_ensure_cols(settings, c("form_title", "form_id", "default_language"))
  lang <- tolower(trimws(.form_pdf_setting(settings, "default_language", "es")))
  if (!nzchar(lang)) lang <- "es"
  survey <- .form_pdf_resolve_label_cols(survey, lang)
  choices <- .form_pdf_resolve_label_cols(choices, lang)
  aviso_idioma <- c(attr(survey, "otro_idioma"), attr(choices, "otro_idioma"))

  survey <- .form_pdf_ensure_cols(
    survey,
    c("type", "name", "label", "hint", "relevant", "appearance",
      "paper_number", "paper_label", "paper_layout", "paper_group",
      "paper_subgroup", "paper_only", "paper_skip", "repeat_count")
  )
  survey <- .form_pdf_tipo_con_lista(survey)   # item 38: lista en `list_name`
  choices <- .form_pdf_ensure_cols(choices, c("list_name", "name", "label", "paper_skip"))
  paper <- .form_pdf_ensure_cols(paper, c("id", "kind", "position", "title", "body", "layout"))
  # Item 19: el formato del instrumento (HTML, entidades, `#`, `**`) se
  # INTERPRETA antes de leer ningun texto: las columnas quedan planas y el crudo
  # se guarda para los tramos de cada bloque (reporte_formulario_ricotexto.R).
  rti <- .form_rt_instrumento(survey, choices, paper, settings)
  survey <- rti$survey; choices <- rti$choices
  paper <- rti$paper; settings <- rti$settings

  titulo_crudo <- .form_pdf_chr(options$title %||% "")
  title <- .form_pdf_clean_text(.form_rt_a_plano(titulo_crudo))
  if (!nzchar(title)) {
    titulo_crudo <- .form_pdf_chr(settings$.rt_form_title %||% "")
    title <- .form_pdf_setting(settings, "form_title", "Formulario")
  }
  if (!nzchar(title)) title <- "Formulario"
  footer_title <- .form_pdf_clean_text(.form_rt_a_plano(options$footer_title %||% title))
  max_options_per_question <- suppressWarnings(as.integer(options$max_options_per_question %||% 18L))
  if (is.na(max_options_per_question) || max_options_per_question < 4L) max_options_per_question <- 18L
  # Toggle de columnas al exportar: 1 | 2 (default = comportamiento historico) |
  # "auto" (tramos por seccion decididos por ancho medido, items 1 y 2 del
  # checklist; ver `reporte_formulario_tramos.R`). Cualquier otro valor cae a 2
  # como antes, pero ahora lo DECLARA en `warnings` en vez de tragarselo.
  option_warnings <- character(0)
  columns_raw <- options$columns %||% 2L
  columns_is_auto <- identical(tolower(trimws(.form_pdf_chr(columns_raw))), "auto")
  if (columns_is_auto) {
    columns <- "auto"
  } else {
    columns <- suppressWarnings(as.integer(columns_raw))
    if (is.na(columns) || !columns %in% c(1L, 2L)) {
      option_warnings <- c(option_warnings, sprintf(
        "Opcion `columns` no reconocida: se recibio «%s» y se usa 2 (valores validos: 1, 2, \"auto\").",
        .form_pdf_chr(columns_raw)))
      columns <- 2L
    }
  }
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
  # Categorias de la pregunta de consentimiento (vacio si no se declaro
  # `consent_var`). El renderer las usa para rotular las casillas de acuerdo SIN
  # inventarlas: salen del instrumento.
  consent_opts <- local({
    if (!nzchar(consent_var)) return(list())
    cr <- which(as.character(survey$name) == consent_var)
    if (!length(cr)) return(list())
    choices_by_list[[.form_pdf_type_list(survey$type[cr[1]])]] %||% list()
  })
  # Categoria sin rotulo: la celda de etiqueta sale VACIA en el papel y el
  # encuestado marca un codigo cuyo significado el instrumento nunca define.
  # Es un defecto del instrumento, no de formato, asi que se declara. (Ademas
  # una etiqueta vacia cambia en silencio el modo de cabecera de la matriz:
  # `.form_pdf_matrix_header_mode` cae a "extremos" si CUALQUIERA falta.)
  categorias_mudas <- character(0)
  for (ln in names(choices_by_list)) {
    for (o in choices_by_list[[ln]]) {
      if (!nzchar(.form_pdf_clean_text_safe(o$label %||% ""))) {
        categorias_mudas <- c(categorias_mudas, sprintf("`%s` / codigo `%s`", ln, .form_pdf_chr(o$code)))
      }
    }
  }
  option_warnings <- c(option_warnings, attr(choices_by_list, "warnings") %||% character(0))
  # Item 44: que es cada fila en el papel. Las omitidas y los «Especifique» en
  # linea salen del survey que se numera y se dibuja; el completo queda para
  # saber de que tipo es una variable que nombra una condicion.
  survey_completo <- survey
  cls <- .form_pdf_clasificar(survey, choices_by_list, cabecera_n_cuestionario = show_qnum)
  especifique <- list()
  for (k in seq_len(nrow(cls$especifique))) {
    e <- cls$especifique[k, ]
    src <- .form_pdf_chr(survey$name[e$origen])
    especifique[[src]][[e$codigo]] <- .form_pdf_chr(survey$name[e$fila])
  }
  quedan <- !cls$rol %in% c("omitida", "cabecera", "especifique")
  survey <- survey[quedan, , drop = FALSE]
  rol <- cls$rol[quedan]; control <- cls$control[quedan]
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
    group_warnings <- c(group_warnings, attr(matrix_keys, "warnings") %||% character(0))
  }
  # Item 39: numeracion decidida una vez por instrumento; una matriz, un numero.
  num <- .form_pdf_numeracion(survey, matrix_keys, rol)
  numbers <- num$numeros
  # Items 40, 41 y 46: saltos, saltos de salida y condiciones de UN evaluador.
  ctx_logica <- .form_logica_contexto(survey, choices_by_list, numbers, num$items, rol, control,
                                      matrix_keys, survey_completo)
  logica <- .form_pdf_logica(ctx_logica, if (condiciones) "condiciones" else "saltos", consent_var)
  inferred <- list(skips = logica$skips)
  openings <- logica$condiciones
  warnings <- c(option_warnings, group_warnings, cls$avisos, num$avisos, logica$avisos)
  if (length(categorias_mudas)) warnings <- c(warnings, sprintf(
    "Categorias sin rotulo (saldran como celda vacia en el papel): %s.",
    paste(unique(categorias_mudas), collapse = "; ")))

  warnings <- c(rti$aviso, aviso_idioma, warnings)

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
      # Las categorias de la pregunta de consentimiento viajan CON el bloque que
      # las va a pintar, no por un argumento que cruce medio renderer. Solo en
      # el bloque de consentimiento: son suyas, no del documento.
      es_consent <- grepl("consent|consentimiento|asentimiento",
                          tolower(paste(kind, .form_pdf_clean_text(paper$layout[i]))))
      add_block(list(
        kind = "paper",
        paper_kind = if (nzchar(kind)) kind else "note",
        consent_options = if (es_consent) consent_opts else list(),
        title = .form_pdf_paper_text(paper$title[i]),
        body = .form_pdf_paper_text(paper$body[i]),
        layout = .form_pdf_clean_text(paper$layout[i]),
        fila = i,
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
  # L17 — SUBSECCION COMO SEGUNDO NIVEL DE BANDA. La referencia tiene dos niveles
  # («D. FAMILIA» y debajo «D.4. SOBRE EL APOYO DE TU MAMA Y PAPA») y los separa
  # por TONO, no por forma: misma caja, misma negrita, mismo cuerpo, relleno mas
  # claro (D9D9D9 la seccion, DBE5F1 la subseccion — luma 217 vs 227). En
  # monocromo el equivalente es E8E8E8, que ademas ya esta en el inventario de
  # grises de la referencia: no se inventa un gris nuevo.
  #
  # Hasta aqui `paper_subgroup` solo llegaba a las matrices, metido en la esquina
  # de su cabecera; una pregunta suelta con subgrupo no lo mostraba en ninguna
  # parte. Ahora emite banda, y por eso los renderers DEJAN de pintarlo en la
  # esquina: enunciarlo en los dos sitios es duplicarlo.
  cur_subgroup <- ""
  sin_rotulo <- character(0)
  while (i <= nrow(survey)) {
    base <- .form_pdf_type_base(survey$type[i])
    if (identical(rol[i], "control")) {
      # Item 44: campo de control que se anota a mano. Sin numero, con `[var]`.
      add_block(list(
        kind = "question", type = "text", number = "", name = .form_pdf_chr(survey$name[i]),
        label = paste0(control[i], ":"), hint = "", options = list(), skip = "",
        opening_condition = openings[i], layout = "", coded_list = FALSE,
        control = TRUE, var_tag = .form_pdf_chr(survey$name[i]), full_width = FALSE))
      i <- i + 1L
      next
    }
    if (base %in% .form_pdf_skip_bases()) {
      i <- i + 1L
      next
    }
    if (base %in% c("begin_group", "begin_repeat")) {
      # Una seccion nueva reabre la subseccion: si la siguiente repite etiqueta,
      # la banda se vuelve a emitir, que es lo que hace la referencia (D.1 y E.1
      # comparten forma y las dos se anuncian).
      cur_subgroup <- ""
    } else {
      sub_i <- .form_pdf_paper_text(.form_pdf_clean_text(
        (survey$paper_subgroup %||% rep("", nrow(survey)))[i]))
      if (!identical(sub_i, cur_subgroup)) {
        cur_subgroup <- sub_i
        if (nzchar(sub_i)) add_block(list(kind = "subsection", title = sub_i, fila = i, full_width = TRUE))
      }
    }

    key <- matrix_keys[i]
    if (nzchar(key)) {
      idx <- i
      while (idx[length(idx)] + 1L <= nrow(survey) && identical(matrix_keys[idx[length(idx)] + 1L], key)) {
        idx <- c(idx, idx[length(idx)] + 1L)
      }
      list_name <- .form_pdf_type_list(survey$type[i])
      mat_key <- matrix_keys[i]
      tenor <- .form_pdf_paper_text(.form_pdf_clean_text(.form_rt_a_plano(group_tenors[[mat_key]] %||% "")))
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
      if (identical(matrix_layout, "column") && identical(columns, 2L)) {
        mat_part <- suppressWarnings(.form_pdf_matrix_partition_options(mat_opts, special_override))
        mat_total_cols <- length(mat_part$scale) + (if (!is.null(mat_part$special)) 1L else 0L)
        mat_full <- mat_total_cols > 6L  # umbral de legibilidad en una columna
      }
      mat_number <- numbers[i]
      # Item 44: el «Especifique» de una fila de matriz no tiene opcion propia
      # donde ir; entra en la instruccion de la fila para no perderse del papel.
      lbl_mat <- stats::setNames(
        vapply(mat_opts, function(o) .form_pdf_clean_text(o$label), character(1)),
        vapply(mat_opts, function(o) .form_pdf_chr(o$code), character(1)))
      esp_item <- function(r, skip_r) {
        esp_r <- especifique[[.form_pdf_chr(survey$name[r])]] %||% list()
        if (!length(esp_r)) return(skip_r)
        txt <- vapply(names(esp_r), function(cod) sprintf(
          "Si responde «%s», especifique: __________ [%s]", lbl_mat[[cod]] %||% cod, esp_r[[cod]]),
          character(1))
        paste(c(if (nzchar(skip_r %||% "")) skip_r, txt), collapse = "  ·  ")
      }
      # Salto por-FILA de matriz (lenguaje "saltos"): si la fila es un filtro
      # (su opcion negativa dispara un salto), se enuncia inline "Si responde
      # «No», salto a la N", como la referencia. En condiciones va vacio (el
      # salto se expresa como apertura del bloque destino).
      mk_item_skip <- function(r) {
        # Condicion propia de la fila (cuando las filas no comparten una).
        cond_r <- if (r != i) openings[r] else ""
        if (condiciones) return(cond_r)
        sk <- inferred$skips[[.form_pdf_chr(survey$name[r])]] %||% list()
        if (!length(sk)) return(cond_r)
        lopts <- choices_by_list[[.form_pdf_type_list(survey$type[r])]] %||% list()
        lbl_by_code <- stats::setNames(
          vapply(lopts, function(o) .form_pdf_clean_text_safe(o$label %||% o$code), character(1)),
          vapply(lopts, function(o) .form_pdf_chr(o$code), character(1)))
        parts <- character(0)
        for (code in names(sk)) {
          instr <- .form_pdf_clean_text(sk[[code]])
          if (!nzchar(instr)) next
          olbl <- lbl_by_code[[code]] %||% code
          instr_lc <- paste0(tolower(substring(instr, 1, 1)), substring(instr, 2))
          parts <- c(parts, sprintf("Si respondió «%s», %s", olbl, instr_lc))
        }
        paste(c(if (nzchar(cond_r)) cond_r, parts), collapse = "  ·  ")
      }
      if (nzchar(tenor)) {
        # Con tenor: la matriz consume un solo numero X; titulo = "X. {tenor}",
        # filas subnumeradas X.1 .. X.k con su propia etiqueta.
        mat_title <- tenor
        mat_items <- lapply(seq_along(idx), function(jj) {
          r <- idx[jj]
          item_num <- if (nzchar(num$items[r])) num$items[r]
            else if (nzchar(mat_number)) sprintf("%s.%d", mat_number, jj) else as.character(jj)
          list(
            number = item_num,
            var_tag = num$tags[r],
            name = .form_pdf_chr(survey$name[r]),
            label = .form_pdf_paper_text_enfasis(.form_pdf_strip_leading_number(
              .form_pdf_first_nonempty(survey$paper_label[r], survey$label[r]), item_num)),
            skip = esp_item(r, mk_item_skip(r))
          )
        })
      } else {
        # Sin tenor: numeracion secuencial, cada fila su propio entero.
        mat_title <- .form_pdf_paper_text_enfasis(.form_pdf_strip_leading_number(
          .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i]), mat_number))
        subletters <- (survey$paper_subletter %||% rep("", nrow(survey)))
        mat_items <- lapply(seq_along(idx), function(jj) {
          r <- idx[jj]
          subl <- .form_pdf_clean_text(subletters[r])
          is_parent <- identical(subl, "@")
          item_num <- if (nzchar(num$items[r])) num$items[r]
            else if (nzchar(mat_number)) sprintf("%s.%d", mat_number, jj) else ""
          list(
            number = item_num,
            var_tag = num$tags[r],
            # Sub-pregunta: letra (a/b/c...) en vez de numero; madre ("@") = enunciado.
            subletter = if (is_parent) "" else subl,
            is_parent = is_parent,
            name = .form_pdf_chr(survey$name[r]),
            label = .form_pdf_paper_text_enfasis(.form_pdf_strip_leading_number(
              .form_pdf_first_nonempty(survey$paper_label[r], survey$label[r]), item_num)),
            skip = esp_item(r, mk_item_skip(r))
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
        skip = if (condiciones) "" else .form_pdf_first_nonempty(
          .form_pdf_clean_text(survey$paper_skip[idx[length(idx)]]),
          logica$salidas[[.form_pdf_chr(survey$name[i])]] %||% ""),
        opening_condition = openings[i],
        layout = .form_pdf_clean_text(survey$paper_layout[i]),
        matrix_key = mat_key,
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
        title = .form_pdf_paper_text_enfasis(.form_pdf_strip_leading_number(
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
    esp_i <- especifique[[.form_pdf_chr(survey$name[i])]] %||% list()
    if (length(opts)) {
      opts <- lapply(opts, function(opt) {
        if (condiciones) {
          opt$paper_skip <- ""  # en condiciones no se mezclan lenguajes
        } else {
          manual <- .form_pdf_rephrase_skip(opt$paper_skip)
          inferred_skip <- .form_pdf_clean_text(source_skips[[opt$code]] %||% "")
          opt$paper_skip <- if (nzchar(manual)) manual else inferred_skip
        }
        # Item 44: «Otro, especifique» en linea junto a su opcion, sin numero.
        ev <- esp_i[[.form_pdf_chr(opt$code)]]
        if (!is.null(ev)) {
          opt$especifique <- ev
          esp_txt <- sprintf("Especifique: __________ [%s]", ev)
          opt$paper_skip <- if (nzchar(opt$paper_skip)) paste(esp_txt, opt$paper_skip, sep = "  \u00b7  ") else esp_txt
        }
        opt
      })
    }
    label <- .form_pdf_first_nonempty(survey$paper_label[i], survey$label[i])
    label <- .form_pdf_strip_leading_number(label, numbers[i])
    label <- .form_pdf_paper_text(label)
    if (!nzchar(label) && !identical(base, "note")) sin_rotulo <- c(sin_rotulo, .form_pdf_chr(survey$name[i]))
    hint <- .form_pdf_paper_text(survey$hint[i])
    layout <- .form_pdf_clean_text(survey$paper_layout[i])
    force_all_choices <- layout %in% c("choices", "all_choices", "full_choices")
    coded_list <- base %in% c("select_one", "select_multiple") &&
      length(opts) > max_options_per_question &&
      !force_all_choices
    # Lista dinamica (`select_one ${var}`: opciones que salen de otra respuesta o
    # de un repeat): no hay categorias fijas que imprimir, va como campo
    # codificado en vez de una pregunta sin donde responder.
    dinamica <- base %in% c("select_one", "select_multiple") && startsWith(list_name, "${")
    if (dinamica) {
      warnings <- c(warnings, sprintf(
        "La pregunta `%s` toma sus opciones de otra respuesta (%s): se imprime como campo codificado.",
        .form_pdf_chr(survey$name[i]), list_name))
      opts <- list()
      coded_list <- TRUE
    }
    # Una lista que no existe en `choices` es un error del instrumento: se avisa
    # con su nombre y la pregunta queda como campo codificado, con un lugar
    # donde anotar la respuesta en vez de un enunciado sin donde responder.
    if (!dinamica && base %in% c("select_one", "select_multiple") && !length(opts)) {
      warnings <- c(warnings, sprintf(
        "La pregunta `%s` pide la lista `%s`, que no existe en la hoja choices: se imprime como campo codificado.",
        .form_pdf_chr(survey$name[i]), list_name))
      coded_list <- TRUE
    }
    if (coded_list && length(esp_i)) {
      # Item 44: sin lista impresa no hay opcion donde colgar el «Especifique»;
      # va en la ayuda para que la variable no desaparezca del papel.
      lbl_cod <- stats::setNames(
        vapply(opts, function(o) .form_pdf_clean_text(o$label), character(1)),
        vapply(opts, function(o) .form_pdf_chr(o$code), character(1)))
      esp_hint <- vapply(names(esp_i), function(cod) sprintf(
        "Si responde «%s» (%s), especifique: __________ [%s]",
        lbl_cod[[cod]] %||% cod, cod, esp_i[[cod]]), character(1))
      hint <- paste(c(if (nzchar(hint)) hint, esp_hint), collapse = "  ·  ")
    }
    if (coded_list && !dinamica) {
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
      skip = if (condiciones) "" else .form_pdf_first_nonempty(
        .form_pdf_rephrase_skip(survey$paper_skip[i]),
        logica$salidas[[.form_pdf_chr(survey$name[i])]] %||% ""),
      opening_condition = openings[i],
      layout = layout,
      coded_list = coded_list,
      var_tag = num$tags[i],
      full_width = full
    ))
    i <- i + 1L
  }

  if (length(sin_rotulo)) warnings <- c(warnings, sprintf(
    "Preguntas sin rotulo en el instrumento (salen con su numero y la variable, sin enunciado): %s.",
    paste(sin_rotulo, collapse = ", ")))
  # Indice de seccion corrido (para el kicker "SECCION N").
  sec_i <- 0L
  for (bi in seq_along(blocks)) {
    if (identical(blocks[[bi]]$kind, "section")) {
      sec_i <- sec_i + 1L
      blocks[[bi]]$section_index <- sec_i
    }
  }

  # Ancho minimo medido de cada bloque (item 2): es la cota que decide si un
  # tramo cabe en dos columnas. Se publica en el modelo para que el gate y los
  # dos renderers puedan auditar la decision sin recalcularla.
  usable_twips <- .FORM_TRAMOS_USABLE_TWIPS
  gutter_twips <- .FORM_TRAMOS_GUTTER_TWIPS
  for (bi in seq_along(blocks)) {
    blocks[[bi]]$min_width_twips <- .form_tramos_min_width(blocks[[bi]], usable_twips)
  }

  # Item 19: tramos con formato de cada texto que se imprime, alineados a su
  # campo plano (reporte_formulario_ricotexto.R).
  blocks <- .form_rt_bloques(blocks, survey, paper, titulo_crudo, group_tenors)
  # Item 39: `[var]` en cuerpo menor cuando el numero no coincide con la variable.
  blocks <- .form_pdf_aplicar_tags(blocks)

  # Item 17: la nota que introduce un bloque ancho hereda su ancho y va pegada
  # a el. Antes del plan "auto", que lee `full_width`.
  blocks <- .form_pdf_nota_hereda_ancho(blocks)

  # Columna unica: tratar TODOS los bloques como full_width y reutilizar la
  # maquinaria de ancho completo del render (sin divisor central ni 2a columna).
  if (identical(columns, 1L)) {
    blocks <- lapply(blocks, function(b) { b$full_width <- TRUE; b })
  }

  # Plan de columnas por tramos. Con 1 o 2 el plan es UN tramo que cubre todo,
  # para que el consumidor sea uniforme y no tenga rama especial. Con "auto"
  # sale de `formulario_tramos_plan()` y los tramos de 1 columna se marcan
  # full_width: asi el ITEM 1 lo implementa la maquinaria de ancho completo que
  # el renderer PDF ya tiene, sin tocar el render.
  column_plan <- if (!length(blocks)) {
    list()
  } else if (columns_is_auto) {
    formulario_tramos_plan(blocks, usable_twips, gutter_twips)
  } else {
    list(list(columns = as.integer(columns), from = 1L, to = length(blocks),
              reason = "opcion-explicita"))
  }
  if (columns_is_auto) {
    for (tr in column_plan) {
      if (identical(tr$columns, 1L)) {
        for (bi in seq.int(tr$from, tr$to)) blocks[[bi]]$full_width <- TRUE
      }
    }
  }

  list(
    title = title,
    footer_title = footer_title,
    # Lo que el simulador de recorrido necesita para verificar saltos y
    # condiciones contra los `relevant` (reporte_formulario_simulador.R).
    .logica = list(ctx = ctx_logica, origenes = logica$origenes, arboles = logica$arboles,
                   alcance = logica$alcance, modo = num$modo, survey_completo = survey_completo,
                   rol_completo = cls$rol),
    columns = columns,
    column_plan = column_plan,
    matrix_layout = matrix_layout,
    logic_language = logic_language,
    show_questionnaire_number = show_qnum,
    # Categorias de la pregunta de consentimiento, para que un renderer pueda
    # pintar la casilla de acuerdo bajo el texto del consentimiento SIN inventar
    # sus etiquetas: salen del instrumento, no del motor. Vacio si no se declaro
    # `consent_var` o si esa pregunta no tiene lista de opciones.
    consent_options = local({
      if (!nzchar(consent_var)) return(list())
      # `.form_pdf_chr` es ESCALAR (devuelve x[[1]]): sobre la columna entera
      # colapsaria a un solo nombre y la busqueda no encontraria nada.
      cr <- which(as.character(survey$name) == consent_var)
      if (!length(cr)) return(list())
      choices_by_list[[.form_pdf_type_list(survey$type[cr[1]])]] %||% list()
    }),
    show_header_title = show_header_title,
    blocks = blocks,
    warnings = unique(c(warnings, .form_fuente_aviso_glifos(list(title = title, blocks = blocks)))),
    summary = list(
      n_blocks = as.integer(length(blocks)),
      # GRANO (B2, 2026-10-15): numeros de pregunta de PRIMER NIVEL que imprime
      # el instrumento («P1…PN» de un aplicador). Ver .form_pdf_numeros_impresos.
      n_questions = length(.form_pdf_numeros_impresos(blocks)),
      n_sections = as.integer(sum(vapply(blocks, function(b) identical(b$kind, "section"), logical(1)))),
      n_matrices = as.integer(sum(vapply(blocks, function(b) identical(b$kind, "matrix"), logical(1))))
    )
  )
}

# OJO: limpieza INOCUA. Esta capa corre al DIBUJAR, sobre texto que el modelo ya
# limpio con el criterio que le tocaba (enunciados con la completa, categorias
# con la segura). Re-limpiar aqui con perdida borraba `*` y backticks de las
# categorias justo antes de pintarlas, despues de que el modelo las conservara.
# Quita los marcadores de enfasis sin tocar nada mas. El PDF dibuja cada cadena
# con un solo `gpar`; las filas de matriz, que es donde el modelo conserva el
# enfasis con texto base en redonda, ya se dibujan tramo a tramo (L15,
# reporte_formulario_ricotexto_pdf.R). En el resto (enunciados, bandas, esquinas)
# todo va en negrita y aqui se retiran para que no salgan `**` en el papel.
.form_pdf_sin_marcas <- function(x) gsub("\\*\\*", "", .form_pdf_chr(x), perl = TRUE)

.form_pdf_wrap <- function(text, chars) {
  text <- .form_pdf_sin_marcas(.form_pdf_clean_text_safe(text))
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
  text <- .form_pdf_sin_marcas(.form_pdf_clean_text_safe(text))
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
  # Una palabra mas ancha que la linea (la etiqueta `[var]` de una variable
  # larga, p. ej. `[Information_to_give_reasons_not_reporting_other]`) no se
  # partia y salia del marco. Se parte en los `_` y, si aun no cabe, por letras.
  partir <- function(word) {
    if (!is.finite(meas(word)) || meas(word) <= w) return(word)
    trozos <- regmatches(word, gregexpr("[^_]+_?|_", word))[[1]]
    out <- character(0); cur <- ""
    for (t in trozos) {
      cand <- paste0(cur, t)
      if (nzchar(cur) && meas(cand) > w) { out <- c(out, cur); cur <- t } else cur <- cand
    }
    if (nzchar(cur)) out <- c(out, cur)
    unlist(lapply(out, function(p) {
      if (meas(p) <= w) return(p)
      letras <- strsplit(p, "")[[1]]; res <- character(0); acc <- ""
      for (ch in letras) {
        if (nzchar(acc) && meas(paste0(acc, ch)) > w) { res <- c(res, acc); acc <- ch } else acc <- paste0(acc, ch)
      }
      c(res, acc)
    }), use.names = FALSE)
  }
  words <- unlist(lapply(words, partir), use.names = FALSE)
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
    # L19: la cuenta EXACTA de `.form_pdf_draw_cover()` —mismo envoltorio a 46
    # caracteres, mismo 0.023 por linea, mismos 0.011 + 0.005 + 0.011 de
    # margenes—. Antes eran 0.056 + lineas * 0.026: 90.9 pt reservados para
    # dibujar 61.5.
    lay <- .form_pdf_rt_si(.form_rt_campo(block, "title"), width, 15, 0.023, base_b = TRUE)
    if (!is.null(lay)) return(0.027 + lay$alto)
    return(0.027 + length(.form_pdf_wrap(block$title, 46)) * 0.023)
  }
  if (identical(block$kind, "section")) {
    # L19 — LA RESERVA SIGUE AL DIBUJO. Aqui habia un `0.058` fijo (48.8 pt) mas
    # las lineas del titulo a 0.014: 60.6 pt reservados para dibujar 27.6. El
    # exceso no deja hueco DENTRO de la pagina —la `y` la fija el dibujo— pero
    # adelanta el salto, y medido sobre un instrumento de 6 secciones dejaba
    # 144.8 pt de holgura al pie de la pagina 1: un 17% de pagina en blanco.
    # Ahora sale de `.form_pdf_band_height()`, que es lo que dibuja la banda, mas
    # el sufijo de repetible (que el dibujo anade al titulo) y el `- 0.008` final.
    etiqueta <- paste0(block$title,
                       .repeat_pdf_section_suffix(isTRUE(block$repeatable), block$repeat_count))
    return(.form_pdf_band_height(etiqueta, 112, rt = .form_pdf_section_rt(block), w = width) + 0.008 +
             .form_pdf_opening_height(block$opening_condition, chars) +
             .form_pdf_section_hint_alto(block, width))
  }
  if (identical(block$kind, "subsection")) {
    # Misma cuenta que la banda de seccion menos lo que esta no lleva (pista y
    # condicion de apertura). La banda mide `lineas * 0.0138 + 0.011` y el dibujo
    # descuenta 0.006 mas.
    return(.form_pdf_band_height(block$title, 112, rt = .form_rt_campo(block, "title"), w = width) + 0.006)
  }
  if (identical(block$kind, "paper")) {
    # L21 (item 14): la cuenta de `.form_pdf_draw_paper`, casilla de acuerdo
    # incluida (antes no se reservaba).
    return(.form_pdf_paper_geom(block, width)$h)
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
    # Misma geometria por-fila que el dibujo (rol, sangria, enfasis por tramos y
    # salto): UN helper para los dos, `.form_pdf_matrix_fila_geom` (L15/L19).
    rows_h <- sum(vapply(block$items %||% list(), function(it) {
      .form_pdf_matrix_fila_geom(it, inner, lbl_w_txt)$h
    }, numeric(1)))
    # Alto de cabecera segun el modo (misma resolucion que el dibujo).
    header_mode <- .form_pdf_matrix_header_mode(part$scale, block$header_mode %||% "auto")
    if (identical(header_mode, "categorias")) {
      cat_labels <- vapply(part$scale, function(o) .form_pdf_clean_text_safe(o$label %||% o$code), character(1))
      sp_label <- if (has_special) .form_pdf_clean_text_safe(part$special$label %||% part$special$code) else ""
      geom <- .form_pdf_matrix_cat_header_geom(cat_labels, sp_label, has_special, col_w, total_cols)
      header_h <- geom$height + 0.006
    } else {
      header_h <- 0.050  # cabecera de anclas (hasta ~3 lineas) + margenes
    }
    # L16: el enunciado ya NO reserva altura PROPIA encima de la tabla — vive en
    # la esquina, asi que lo que hace es EMPUJAR la cabecera. Con `title_h`
    # suelto aqui el paginado reservaba el enunciado dos veces y dejaba un hueco
    # del alto del enunciado al pie de cada matriz.
    esq_h <- .form_pdf_matrix_esquina(block, label_w, inner)$height
    header_h <- max(header_h, esq_h)
    hint_h <- if (nzchar(block$tenor %||% "")) 0 else {
      lay_h <- .form_pdf_rt_si(.form_rt_campo(block, "hint"), width - 0.012, 7.2, 0.011, base_i = TRUE)
      if (is.null(lay_h)) .form_pdf_lines_height(.form_pdf_wrap(block$hint, 118), 0.011) else lay_h$alto
    }
    return(header_h + rows_h + 0.022 + hint_h +
             .form_pdf_opening_height(block$opening_condition, 112L))
  }
  # L21 (item 14): pregunta y nota miden con la MISMA geometria que las dibuja
  # (reporte_formulario_reserva_pdf.R), como las bandas desde L19.
  .form_pdf_question_geom(block, width)$h
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
                  gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = .form_pdf_tokens()$navy))
  invisible(FALSE)
}

.form_pdf_header <- function(model, page_no) {
  tk <- .form_pdf_tokens()
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

.form_pdf_footer <- function(model, page_no, total_pages = NA_integer_) {
  tk <- .form_pdf_tokens()
  grid::grid.lines(x = grid::unit(c(0.052, 0.930), "npc"), y = grid::unit(0.056, "npc"),
                   gp = grid::gpar(col = tk$line, lwd = 0.7))
  # «Pagina N de M»: el total llega de la primera pasada de
  # `formulario_pdf_render`. En la pasada de conteo aun no se sabe y se omite,
  # que es lo correcto — NUNCA se inventa un total.
  folio <- if (is.na(total_pages)) as.character(page_no)
    else sprintf("%d de %d", page_no, total_pages)
  grid::grid.text(folio, x = grid::unit(0.052, "npc"), y = grid::unit(0.034, "npc"),
                  just = c("left", "center"), gp = grid::gpar(fontsize = 8, col = tk$soft))
  .form_pdf_text(toupper(model$footer_title), 0.16, 0.039, 0.58, chars = 105,
                 fontsize = 6.2, align = "center", col = tk$soft, line_h = 0.008)
  grid::grid.text("PULSO PUCP", x = grid::unit(0.930, "npc"), y = grid::unit(0.034, "npc"),
                  just = c("right", "center"),
                  gp = grid::gpar(fontsize = 6.6, fontface = "bold", col = tk$navy))
}

# Ancho de la REGION de dibujo en «points» de grid (1/72.27 in), que es en lo
# que mide `convertWidth(..., "points")`. No es la hoja: `pdf(paper = "a4",
# width = 8.27)` deja 0.25 in por lado, asi que 1 npc = A4 (595.2756 bp) menos
# 36 bp = 559.2756 bp = 561.37 points. Se dividia entre 8.27 x 72 = 595.44 y todo
# lo medido asi salia un 6 % corto: la fila horizontal de opciones montaba la
# etiqueta sobre la celda del codigo («No se / Prefiero no decir» contra el 99).
.FORM_PDF_REGION_PT <- (595.2756 - 36) * 72.27 / 72

# Ancho de un texto en npc de la region de dibujo del motor.
.form_pdf_ancho_npc <- function(txt, fontsize) {
  txt <- .form_pdf_clean_text_safe(txt %||% "")
  if (!nzchar(txt)) return(0)
  pt <- tryCatch(
    grid::convertWidth(grid::grobWidth(grid::textGrob(txt, gp = grid::gpar(fontsize = fontsize))),
                       "points", valueOnly = TRUE),
    error = function(e) nchar(txt) * fontsize * 0.45)
  if (!is.finite(pt)) pt <- nchar(txt) * fontsize * 0.45
  pt / .FORM_PDF_REGION_PT
}

# Alto de una banda. UNA cuenta para el dibujo y para el paginado (L19): tenerlas
# separadas es como `section` acabo reservando 60.6 pt para dibujar 27.6.
.form_pdf_band_height <- function(title, chars, rt = NULL, w = NULL) {
  # Item 19: con formato visible en la banda (cursiva, subrayado, salto,
  # encabezado) el alto sale del layout por tramos, el mismo que la dibuja.
  if (!is.null(w)) {
    lay <- .form_pdf_rt_si(rt, w, 8.5, 0.0138, base_b = TRUE, mayusculas = TRUE)
    if (!is.null(lay)) return(lay$alto + 0.011)
  }
  lines <- .form_pdf_wrap(toupper(title %||% ""), chars)
  if (!length(lines)) return(0)
  length(lines) * 0.0138 + 0.011
}

.form_pdf_band <- function(title, x, y, w, chars, kicker = "", fill = NULL, align = "center",
                           rt = NULL) {
  # Banda de seccion: caja GRIS con borde y titulo NEGRO centrado.
  # Antes era navy solido con el titulo en blanco. En monocromo ese relleno cae a
  # negro puro: 100% de tinta a todo el ancho por ejemplar, peor que el navy
  # (88%), y el texto reversado es lo primero que se empasta al fotocopiar. El
  # relleno no sale del token de acento sino del de banda, como en el renderer
  # Word.
  tk <- .form_pdf_tokens()
  lines <- .form_pdf_wrap(toupper(title), chars)
  if (!length(lines)) return(y)
  band_h <- .form_pdf_band_height(title, chars, rt = rt, w = w)
  .form_pdf_rect(x, y, w, band_h, fill = fill %||% tk$tbl_header, col = tk$ink, lwd = 0.6)
  lay <- .form_pdf_rt_si(rt, w, 8.5, 0.0138, base_b = TRUE, mayusculas = TRUE)
  if (!is.null(lay)) {
    .form_pdf_rt_draw(lay, x, y - 0.0088, w, col = tk$ink, align = align)
  } else {
    .form_pdf_text(paste(lines, collapse = "\n"), x, y - 0.0088, w,
                   chars = chars, fontsize = 8.5, fontface = "bold", col = tk$ink,
                   align = align, line_h = 0.0138)
  }
  y - band_h
}

# Banda de SUBSECCION (L17). Misma caja y mismo cuerpo que la de seccion: lo
# unico que cambia es el tono del relleno y que va alineada a la izquierda, como
# en la referencia («D. FAMILIA» centrada arriba, «D.4. SOBRE EL APOYO...»
# pegada al margen). Distinguirlas por forma —caja contra linea, o cuerpo mayor—
# habria roto la lectura de que las dos son el mismo tipo de rotulo.
.form_pdf_draw_subsection <- function(block, x, y, w) {
  tk <- .form_pdf_tokens()
  y <- .form_pdf_band(block$title, x, y, w, chars = 112,
                      fill = tk$tbl_header_sub, align = "left",
                      rt = .form_rt_campo(block, "title"))
  y - 0.006
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
  tk <- .form_pdf_tokens()
  cw <- max(20L, floor((w - 0.012) * chars_factor))
  lines <- .form_pdf_wrap(text, cw)
  if (!length(lines)) return(y)
  y <- .form_pdf_text(paste(lines, collapse = "\n"), x + 0.008, y - 0.005, w - 0.016,
                      chars = cw, fontsize = 7.3, fontface = "italic", col = tk$navy, line_h = 0.0118)
  y - 0.004
}

.form_pdf_draw_cover <- function(block, x, y, w) {
  tk <- .form_pdf_tokens()
  cx <- x + w / 2
  # Portada mas apretada (L6): el contenido arrancaba 105 pt mas abajo que en el
  # .docx sobre el mismo instrumento, y buena parte era aire de la portada.
  y <- y - 0.011
  lay <- .form_pdf_rt_si(.form_rt_campo(block, "title"), w, 15, 0.023, base_b = TRUE)
  if (!is.null(lay)) {
    y <- .form_pdf_rt_draw(lay, x, y, w, col = tk$ink, align = "center") - 0.005
  } else {
    lines <- .form_pdf_wrap(block$title, 46)
    grid::grid.text(paste(lines, collapse = "\n"), x = grid::unit(cx, "npc"),
                    y = grid::unit(y, "npc"), just = c("center", "top"),
                    gp = grid::gpar(fontsize = 15, fontface = "bold", col = tk$ink, lineheight = 1.04))
    y <- y - length(lines) * 0.023 - 0.005
  }
  grid::grid.lines(x = grid::unit(c(cx - 0.055, cx + 0.055), "npc"),
                   y = grid::unit(y, "npc"), gp = grid::gpar(col = tk$ink, lwd = 1.2))
  y - 0.011
}

.form_pdf_draw_paper <- function(block, x, y, w) {
  tk <- .form_pdf_tokens()
  opts <- block$consent_options %||% list()
  y0 <- y
  g <- .form_pdf_paper_geom(block, w)
  if (nzchar(block$title %||% "")) {
    y <- .form_pdf_band(block$title, x, y, w, chars = 118, rt = .form_rt_campo(block, "title"))
    y <- y - 0.008
  }
  if (nzchar(block$body %||% "")) {
    # L21: las mismas lineas que reserva `.form_pdf_paper_geom`.
    if (is.null(g$body_lay)) {
      y <- .form_pdf_text(block$body, x + 0.008, y, w - 0.016, chars = 122,
                          lines = g$body_lines,
                          fontsize = 8.1, align = "justify", col = tk$ink, line_h = 0.012)
    } else {
      y <- .form_pdf_rt_draw(g$body_lay, x + 0.008, y, w - 0.016, col = tk$ink, align = "justify")
    }
  }
  if (length(opts)) {
    # CASILLA DE ACUERDO (L13). Una celda marcable por categoria, rotulada con SU
    # PROPIA etiqueta: salen de `consent_options`, que el modelo arma desde la
    # pregunta declarada en `consent_var`. Escribir "Si"/"No" aqui seria inventar
    # las categorias de respuesta de un instrumento acordado con el cliente.
    y <- y - 0.010
    caja <- 0.016
    xx <- x + w - 0.008
    for (k in rev(seq_along(opts))) {
      lbl <- .form_pdf_clean_text_safe(opts[[k]]$label %||% opts[[k]]$code %||% "")
      .form_pdf_rect(xx - caja, y, caja, caja, fill = "white", col = tk$ink, lwd = 0.7)
      grid::grid.text(lbl, x = grid::unit(xx - caja - 0.006, "npc"),
                      y = grid::unit(y - caja / 2, "npc"), just = c("right", "center"),
                      gp = grid::gpar(fontsize = 8.1, fontface = "bold", col = tk$ink))
      # El rotulo se dibuja a 0.006 a la IZQUIERDA de su casilla, asi que el
      # avance tiene que descontar ese hueco ademas del ancho del texto; sin eso
      # el rotulo siguiente se monta sobre la casilla anterior.
      xx <- xx - caja - 0.006 - .form_pdf_ancho_npc(lbl, 8.1) - 0.016
    }
    y <- y - caja
    # MARCO en TABLA, nunca caja dibujada flotante: el consentimiento del
    # instrumento a mano desaparecio en Word por ser una caja de texto sin
    # `mc:Fallback`. Aqui el marco es un rectangulo del propio flujo, que es el
    # equivalente en este motor.
    .form_pdf_rect(x, y0, w, y0 - y + 0.006, fill = NA, col = tk$ink, lwd = 0.7)
    y <- y - 0.006
  }
  y - 0.012
}

.form_pdf_draw_section <- function(block, x, y, w) {
  label <- block$title
  # Marca textual de sección repetible (ADR 0030, Fase 4).
  label <- paste0(label, .repeat_pdf_section_suffix(isTRUE(block$repeatable), block$repeat_count))
  # Sin kicker "SECCIÓN N": la banda (centrada) se basta sola.
  y <- .form_pdf_band(label, x, y, w, chars = 112, rt = .form_pdf_section_rt(block))
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y - 0.006, w)
  }
  if (nzchar(block$hint %||% "")) {
    lay <- .form_pdf_rt_si(.form_rt_campo(block, "hint"), w - 0.016, 7.5, 0.012, base_i = TRUE)
    if (is.null(lay)) {
      y <- .form_pdf_text(block$hint, x + 0.008, y - 0.006, w - 0.016, chars = 112,
                          fontsize = 7.5, fontface = "italic", col = .form_pdf_tokens()$soft, line_h = 0.012)
    } else {
      y <- .form_pdf_rt_draw(lay, x + 0.008, y - 0.006, w - 0.016, col = .form_pdf_tokens()$soft)
    }
  }
  y - 0.008
}

# Geometria de codigo/marca de una lista de opciones (compartida por dibujo y
# calculo de altura para no desincronizar el paginado). Solo depende de las
# opciones y del flag `multiple`, no del ancho.
.form_pdf_options_code_mark <- function(options, multiple) {
  # Paridad con Word (decision 2026-10-15): se imprime TODO codigo no vacio,
  # tambien el de mas de 8 caracteres, el igual a su etiqueta y el que lleva
  # espacios — Word no tiene ninguna de esas excepciones. La escalera del item
  # 18 le hace sitio (crecer, bajar el cuerpo, partir).
  code_visible <- vapply(options, function(opt) {
    nzchar(.form_pdf_clean_text_safe(opt$code %||% ""))
  }, logical(1))
  show_code <- any(code_visible)
  max_code_chars <- max(1L, max(nchar(vapply(options, function(opt) .form_pdf_clean_text(opt$code %||% ""), character(1)), type = "width")))
  code_w <- if (show_code) min(0.070, max(0.038, max_code_chars * 0.011)) else 0
  # Item 18: ese ancho (por conteo) es el PISO; si el codigo visible mas ancho
  # MEDIDO no cabe, la columna crece hasta el doble, luego baja el cuerpo hasta
  # 7 pt y solo despues se parte (reporte_formulario_codigos.R).
  cg <- if (show_code) {
    .form_pdf_codigo_geom(vapply(options[code_visible], function(opt)
      .form_pdf_clean_text_safe(opt$code %||% ""), character(1)), code_w)
  } else list(code_w = 0, code_fs = .FORM_PDF_CODIGO_FS, lineas = list())
  mark_w <- if (multiple || !show_code) 0.026 else 0
  list(code_visible = code_visible, show_code = show_code, code_w = cg$code_w, mark_w = mark_w,
       code_fs = cg$code_fs, code_lineas = cg$lineas)
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
# FILA HORIZONTAL para opciones cortas (L8 del GOAL). En la referencia una
# pregunta de pocas opciones con etiquetas breves no gasta una fila por opcion:
# van todas en UNA, alternando etiqueta y codigo.
#
# El corte es por ANCHO MEDIDO, nunca por `length(options)`: un umbral tipo «tres
# o menos» es la clase de criterio a ojo que el §2 del checklist ya se comio una
# vez. Consecuencia buscada: el mismo juego de opciones puede ir horizontal en un
# tramo de una columna y vertical en uno de dos, porque el ancho util es la mitad.
#
# Helper COMPARTIDO por el dibujo (.form_pdf_draw_options) y por la medida del
# alto (.form_pdf_block_height). Si cada uno decidiera por su cuenta, el reparto
# en columnas y el salto de pagina se descuadrarian en cuanto alguien tocara uno.
.FORM_PDF_OPCIONES_FILA_H <- 0.0178   # alto de la fila horizontal (L8)

.form_pdf_options_horizontal <- function(options, w, code_w, code_lineas = list()) {
  if (length(options) < 2L) return(FALSE)
  # Un codigo partido (item 18) no cabe en una fila de alto fijo.
  if (any(lengths(code_lineas) > 1L)) return(FALSE)
  # Una categoria con formato (item 19) va en su fila, donde se compone por tramos.
  if (any(vapply(options, function(o) .form_rt_tiene_formato(o$label_rt), logical(1)))) return(FALSE)
  # Con saltos por opcion se queda vertical: cada salto necesita su propio sitio.
  if (any(vapply(options, function(o) nzchar(.form_pdf_clean_text(o$paper_skip %||% "")),
                 logical(1)))) return(FALSE)
  total <- sum(vapply(options, function(o) {
    .form_pdf_ancho_npc(.form_pdf_clean_text_safe(o$label %||% o$code %||% ""), 7.9) +
      code_w + 0.010
  }, numeric(1)))
  total <= w
}

.form_pdf_option_row_geom <- function(opt, w, code_w, mark_w, cm = NULL) {
  skip <- .form_pdf_clean_text(opt$paper_skip %||% "")
  has_skip <- nzchar(skip)
  label_area <- w - code_w - mark_w - 0.010
  chip_w <- if (has_skip) .form_pdf_skip_chip_w(skip) else 0
  chip_right <- has_skip && chip_w <= label_area * 0.5
  lbl_w <- if (chip_right) max(0.05, label_area - chip_w - 0.006) else label_area
  label_chars <- max(6L, floor(lbl_w * 125))
  n_lines <- max(1L, length(.form_pdf_wrap(.form_pdf_clean_text_safe(opt$label %||% ""), label_chars)))
  # Item 19: categoria con formato -> tramos al ancho real; las lineas se cuentan
  # en unidades de la interlinea del dibujo (0.012).
  lay <- .form_pdf_rt_si(.form_rt_campo(list(label = .form_pdf_clean_text_safe(opt$label %||% ""),
                                             label_rt = opt$label_rt), "label"),
                         lbl_w, 7.9, 0.012)
  if (!is.null(lay)) n_lines <- max(1, lay$alto / 0.012)
  # Codigo partido en varias lineas (ultimo peldano del item 18): la fila crece.
  n_code <- length((cm$code_lineas %||% list())[[.form_pdf_clean_text_safe(opt$code %||% "")]] %||% "")
  n_lines <- max(n_lines, n_code)
  chip_below <- has_skip && !chip_right
  # Bajo la opcion la instruccion se envuelve al ancho real: de una linea, un
  # «Especifique» con una etiqueta `[var]` larga salia del marco.
  chip_lines <- if (chip_below) .form_pdf_wrap_fit(skip, label_area, 6.9, "italic") else skip
  # DENSIDAD (L6). Medido contra el .docx sobre el mismo instrumento: el PDF
  # gastaba 61,4 pt por pregunta frente a 51,6 del Word, un 19 % mas, y el
  # exceso estaba aqui — 0,021 npc de alto minimo de fila son 17,7 pt en A4,
  # contra los ~14 que usa el .docx. Un formulario en papel no es un documento
  # de oficina: la densidad ES la funcion.
  h <- max(0.0178, n_lines * 0.0125 +
             (if (chip_below) 0.014 + (max(1L, length(chip_lines)) - 1L) * 0.0105 else 0) + 0.0055)
  list(skip = skip, has_skip = has_skip, chip_w = chip_w, chip_right = chip_right,
       chip_below = chip_below, chip_lines = chip_lines, lbl_w = lbl_w, label_chars = label_chars, lay = lay,
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
  tk <- .form_pdf_tokens()
  cm <- .form_pdf_options_code_mark(options, multiple)
  code_visible <- cm$code_visible
  show_code <- cm$show_code
  code_w <- cm$code_w
  mark_w <- cm$mark_w

  if (.form_pdf_options_horizontal(options, w, code_w, cm$code_lineas)) {
    h <- .FORM_PDF_OPCIONES_FILA_H
    .form_pdf_rect(x, y, w, h, fill = NA, col = tk$tbl_frame, lwd = 0.5)
    xx <- x
    for (idx in seq_along(options)) {
      opt <- options[[idx]]
      lbl <- .form_pdf_clean_text_safe(opt$label %||% "")
      lw <- .form_pdf_ancho_npc(lbl, 7.9) + 0.008
      grid::grid.text(lbl, x = grid::unit(xx + 0.004, "npc"),
                      y = grid::unit(y - h / 2, "npc"), just = c("left", "center"),
                      gp = grid::gpar(fontsize = 7.9, col = tk$ink))
      xx <- xx + lw
      grid::grid.lines(x = grid::unit(c(xx, xx), "npc"),
                       y = grid::unit(c(y, y - h), "npc"),
                       gp = grid::gpar(col = tk$tbl_div, lwd = 0.5))
      grid::grid.text(.form_pdf_clean_text_safe(opt$code %||% ""),
                      x = grid::unit(xx + code_w / 2, "npc"),
                      y = grid::unit(y - h / 2, "npc"), just = c("center", "center"),
                      gp = grid::gpar(fontsize = cm$code_fs, fontface = "bold", col = tk$ink))
      xx <- xx + code_w
      if (idx < length(options)) {
        grid::grid.lines(x = grid::unit(c(xx, xx), "npc"),
                         y = grid::unit(c(y, y - h), "npc"),
                         gp = grid::gpar(col = tk$tbl_div, lwd = 0.5))
      }
    }
    return(y - h)
  }

  y_start <- y
  for (idx in seq_along(options)) {
    opt <- options[[idx]]
    geom <- .form_pdf_option_row_geom(opt, w, code_w, mark_w, cm)
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
        # Item 18: cuerpo de la escalera y, en el ultimo peldano, el codigo en
        # varias lineas (una por trozo, a la interlinea de la etiqueta).
        trozos <- cm$code_lineas[[.form_pdf_clean_text_safe(opt$code %||% "")]] %||% opt$code
        for (ti in seq_along(trozos)) {
          grid::grid.text(trozos[[ti]], x = grid::unit(xx + code_w / 2, "npc"),
                          y = grid::unit(y - 0.010 - (ti - 1L) * 0.0125, "npc"),
                          gp = grid::gpar(fontsize = cm$code_fs, fontface = "bold", col = tk$navy))
        }
      }
    }
    # Label de la opcion (sin el salto pegado: el salto ahora es un chip aparte).
    if (is.null(geom$lay)) {
      .form_pdf_text(.form_pdf_clean_text_safe(opt$label %||% ""), xx + code_w + 0.004, y - 0.005,
                     geom$lbl_w, chars = geom$label_chars, fontsize = 7.9,
                     col = tk$ink, line_h = 0.012)
    } else {
      .form_pdf_rt_draw(geom$lay, xx + code_w + 0.004, y - 0.005, geom$lbl_w, col = tk$ink)
    }
    if (geom$has_skip) {
      if (geom$chip_right) {
        .form_pdf_draw_skip_chip(geom$skip, x + w - geom$chip_w - 0.004, y - 0.008, geom$chip_w, tk)
      } else {
        y_chip <- y - geom$n_lines * 0.013 - 0.010
        for (li in seq_along(geom$chip_lines)) {
          .form_pdf_draw_skip_chip(geom$chip_lines[[li]], xx + code_w + 0.004,
                                   y_chip - (li - 1L) * 0.0105, geom$chip_w, tk)
        }
      }
    }
    y <- y - h
    # REJILLA (L3): linea entre filas. Antes las filas se separaban SOLO por la
    # zebra (F2F2F2, 5% de tinta), y en fotocopia ese relleno desaparece: la
    # lista quedaba como texto suelto sin rejilla. El instrumento se imprime y se
    # fotocopia, asi que la estructura tiene que colgar de las lineas, no del
    # relleno. La referencia lleva insideH en 46 de sus 50 tablas.
    if (idx < length(options)) {
      grid::grid.lines(x = grid::unit(c(x, x + w), "npc"),
                       y = grid::unit(c(y, y), "npc"),
                       gp = grid::gpar(col = tk$tbl_div, lwd = 0.5))
    }
  }
  # Marco exterior fino + divisor bajo el codigo.
  grid::grid.rect(x = grid::unit(x + w / 2, "npc"), y = grid::unit((y_start + y) / 2, "npc"),
                  width = grid::unit(w, "npc"), height = grid::unit(y_start - y, "npc"),
                  gp = grid::gpar(fill = NA, col = tk$tbl_frame, lwd = 0.5))
  if (show_code || mark_w > 0) {
    div_x <- x + mark_w + code_w
    grid::grid.lines(x = grid::unit(c(div_x, div_x), "npc"),
                     y = grid::unit(c(y, y_start), "npc"),
                     gp = grid::gpar(col = tk$tbl_div, lwd = 0.5))
  }
  y
}

.form_pdf_draw_question <- function(block, x, y, w) {
  tk <- .form_pdf_tokens()
  # L21: lineas y alturas salen de la misma geometria que reserva el paginado.
  g <- .form_pdf_question_geom(block, w)
  chars_lbl <- g$chars_lbl
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y, w,
                                chars_factor = if (isTRUE(block$full_width)) 112 else 108)
    y <- y - 0.002
  }
  # Item 7: una nota informativa no se numera NUNCA (el modelo ya le deja el
  # numero vacio; esto lo hace explicito para no depender de eso, y para que el
  # PDF no diverja del Word, que nunca la numero).
  is_note <- identical(block$type %||% "", "note")
  prefix <- if (!is_note && nzchar(block$number %||% "")) paste0(block$number, ".  ") else ""
  # Notas informativas: texto justificado (como el modelo). Preguntas: izquierda.
  lbl_align <- if (identical(block$type %||% "", "note")) "justify" else "left"
  # ENUNCIADO DENTRO DE LA TABLA (L4). En la referencia una pregunta no es «un
  # parrafo y debajo una tabla»: es UNA tabla cuya primera fila, sombreada, lleva
  # el enunciado. La diferencia no es estetica — suelto, el enunciado no tiene
  # relacion estructural con sus opciones, y si la columna corta justo ahi se
  # queda arriba y las opciones abajo: media pregunta sin texto.
  # Solo cuando la pregunta TIENE cuerpo tabular donde alojarse; una nota
  # informativa sigue siendo texto corrido.
  tiene_cuerpo <- !is_note &&
    (isTRUE(block$coded_list) ||
       (block$type %||% "") %in% c("select_one", "select_multiple",
                                   "text", "integer", "decimal", "date", "time", "datetime"))
  bx <- x + 0.006
  bw <- w - 0.012
  if (tiene_cuerpo) {
    lbl_lines <- g$lbl_lines
    hint_lines <- g$hint_lines
    head_h <- g$head_h
    .form_pdf_rect(bx, y, bw, head_h, fill = tk$tbl_zebra, col = tk$tbl_frame, lwd = 0.5)
    .form_pdf_traza("celda_enunciado", NA_integer_, y, y - head_h)
    # Item 19: con formato, por tramos (la misma geometria que reserva el alto).
    yt <- if (is.null(g$lbl_lay)) {
      .form_pdf_text(paste0(prefix, block$label), bx + 0.005, y - .FORM_PDF_ENUNCIADO_PAD, bw - 0.010,
                     lines = lbl_lines, align = lbl_align,
                     fontsize = 8.4, fontface = "bold", col = tk$ink, line_h = 0.0142)
    } else {
      .form_pdf_rt_draw(g$lbl_lay, bx + 0.005, y - .FORM_PDF_ENUNCIADO_PAD, bw - 0.010, col = tk$ink, align = lbl_align)
    }
    if (!is.null(g$hint_lay)) {
      .form_pdf_rt_draw(g$hint_lay, bx + 0.005, yt - 0.001, bw - 0.010, col = tk$ink)
    } else if (length(hint_lines)) {
      .form_pdf_text(block$hint, bx + 0.005, yt - 0.001, bw - 0.010,
                     lines = hint_lines,
                     fontsize = 7.3, fontface = "italic", col = tk$ink, line_h = 0.011)
    }
    # Sin hueco: la cabecera y el cuerpo son la MISMA tabla.
    y <- y - head_h
  } else {
    # El texto baja el mismo margen que el enunciado dentro de su celda: la caja
    # de la fuente sube ~3.2 pt sobre la «M», y pegado al borde superior del
    # bloque tocaba el final del divisor de columnas («académico», acrconta p. 3).
    # El avance NO cambia (la interlinea reservada sobra abajo): se dibuja `pad`
    # mas abajo y se avanza como siempre.
    pad <- .FORM_PDF_ENUNCIADO_PAD
    y <- pad + if (is.null(g$lbl_lay)) {
      .form_pdf_text(paste0(prefix, block$label), bx, y - pad, bw,
                     lines = g$lbl_lines, align = lbl_align,
                     fontsize = 8.4, fontface = "bold", col = tk$ink, line_h = 0.0142)
    } else {
      .form_pdf_rt_draw(g$lbl_lay, bx, y - pad, bw, col = tk$ink, align = lbl_align)
    }
    if (nzchar(block$hint %||% "")) {
      y <- pad + if (is.null(g$hint_lay)) {
        .form_pdf_text(block$hint, bx, y - 0.002 - pad, bw,
                       lines = g$hint_lines,
                       fontsize = 7.3, fontface = "italic", col = tk$ink, line_h = 0.011)
      } else {
        .form_pdf_rt_draw(g$hint_lay, bx, y - 0.002 - pad, bw, col = tk$ink)
      }
    }
    # Fondo del texto de la nota-introduccion (para medir su aire con la tabla):
    # donde termina lo dibujado, con su margen.
    if (isTRUE(g$intro)) .form_pdf_traza("nota_texto", NA_integer_, y - pad, y - pad)
    y <- y - (if (isTRUE(g$intro)) 0 else 0.007)
  }
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
  y - g$cierre
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
# Ancho de la columna del numero de item en la matriz (L5 del GOAL). En la
# referencia el numero vive en su propia columna estrecha a la izquierda de la
# etiqueta (~276 twips de sus 10 549 utiles = 0.026 del ancho); pegado al texto,
# las etiquetas arrancan a alturas distintas segun el numero tenga una o dos
# cifras. Constante UNICA porque la consumen dos sitios que deben coincidir: el
# dibujo (.form_pdf_draw_matrix) y la medida del alto (.form_pdf_block_height).
# Holgada a proposito: en el renderer Word una columna ajustada al milimetro
# partia "10" y "11" en dos lineas, y eso solo se ve en el render.
.FORM_PDF_MATRIX_NUM_W <- 0.021

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
# Parte las palabras que no entran en `chars` antes de envolver por palabras. El
# wrap normal respeta la palabra entera, asi que una sola palabra mas ancha que
# su columna se sale y se monta sobre la columna vecina (escala de 7 puntos con
# "Fuertemente" sobre una columna de 8 caracteres).
.form_pdf_break_long_words <- function(text, chars) {
  chars <- max(2L, as.integer(chars))
  words <- unlist(strsplit(.form_pdf_clean_text(text), "\\s+"))
  words <- words[nzchar(words)]
  if (!length(words)) return("")
  out <- vapply(words, function(w) {
    if (nchar(w, type = "width") <= chars) return(w)
    pieces <- character(0)
    while (nchar(w, type = "width") > chars) {
      pieces <- c(pieces, substr(w, 1L, chars))
      w <- substr(w, chars + 1L, nchar(w))
    }
    paste(c(pieces, w), collapse = " ")
  }, character(1))
  paste(out, collapse = " ")
}

.form_pdf_matrix_cat_header_geom <- function(cat_labels, sp_label, has_special, col_w, total_cols) {
  all_labels <- c(cat_labels, if (has_special) sp_label else character(0))
  rotulos <- all_labels
  all_labels <- all_labels[nzchar(all_labels)]
  if (!length(all_labels)) all_labels <- ""
  max_chars <- max(1L, max(nchar(all_labels, type = "width")))
  base_fs <- if (total_cols >= 6L) 5.6 else 6.2
  # La decision se toma MIDIENDO con la fuente del dispositivo (2026-10-15). Se
  # calibraba con «118 caracteres por npc a 6.5 pt», que es el ancho medio de una
  # sans normal: con una estrecha sobreestima ~50 % y una escala de 4 puntos
  # («Insatisfecho» en una columna de 34 pt, donde cabe a 6.2 pt) salia rotada.
  # Sin dispositivo abierto, cae al conteo de antes.
  util <- max(0.004, col_w - 0.006)
  palabras <- unique(unlist(lapply(all_labels, function(l) {
    w <- unlist(strsplit(.form_pdf_clean_text(l), "[[:space:]/-]+")); w[nzchar(w)]
  })))
  ancho_max <- function(fs) {
    if (!length(palabras)) return(0)
    v <- vapply(palabras, function(p) .form_pdf_medir_npc(p, fs, "bold"), numeric(1))
    if (any(!is.finite(v))) NA_real_ else max(v)
  }
  medible <- is.finite(ancho_max(base_fs))
  chars_at <- function(fs) max(1L, floor(col_w * 118 * (6.5 / fs)))
  longest_word <- max(1L, max(nchar(c(palabras, ""), type = "width")))
  cabe <- function(fs) if (medible) ancho_max(fs) <= util else longest_word <= chars_at(fs)
  # Manda la palabra mas larga: si no entra en la columna, el rotulo invade a su
  # vecino. Se baja el cuerpo hasta que entre, con piso legible.
  fs <- base_fs
  while (fs > 4.6 && !cabe(fs)) fs <- fs - 0.2
  col_chars <- chars_at(fs)
  # Si ni al cuerpo minimo entra la palabra mas larga, partirla deja un rotulo
  # ilegible ("Fuerteme / nte en / desacuer / do"). En ese caso el rotulo se
  # escribe rotado, que es como caben las escalas largas de 7 puntos.
  if (!cabe(fs)) {
    return(list(layout = "rotated",
                height = min(0.135, max_chars * 0.0046 + 0.014),
                col_chars = col_chars,
                cat_fs = min(base_fs, 5.8)))
  }
  # Lineas de cada rotulo, envueltas por ANCHO MEDIDO a su cuerpo (las mismas
  # que se dibujan: el dibujo las toma de aqui).
  lineas <- lapply(rotulos, function(l) {
    if (!nzchar(l)) return(character(0))
    if (medible) .form_pdf_wrap_fit(l, util, fontsize = fs, fontface = "bold")
    else .form_pdf_wrap(.form_pdf_break_long_words(l, col_chars), col_chars)
  })
  hdr_lines <- max(1L, max(lengths(lineas)))
  if (hdr_lines <= 4L) {
    list(layout = "horizontal", height = hdr_lines * 0.011 + 0.010,
         col_chars = col_chars, cat_fs = fs, lineas = lineas)
  } else {
    list(layout = "rotated", height = min(0.115, max_chars * 0.0044 + 0.013),
         col_chars = col_chars, cat_fs = min(fs, if (total_cols >= 6L) 5.6 else 6.0))
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
  if (!n) return("extremos")
  # Item 42 (tercera tanda): «extremos» solo rotula los dos polos, asi que solo
  # vale para una escala NUMERICA, la que el aplicador lee sin rotulos
  # intermedios: los de en medio son numeros o estan vacios («1 Nada … 5
  # Mucho», «0 … 10»). Toda lista con un rotulo intermedio de palabras es
  # nominal o tiene categorias que el papel no puede perder (los dias de la
  # semana de Polarizacion salian «Lunes … Ningun dia»): va por categorias, con
  # la escalera de ajuste de la cabecera (baja el cuerpo, parte, rota), tenga
  # las columnas que tenga. Antes el corte era «> 6 puntos -> extremos».
  labs <- vapply(scale, function(o) .form_pdf_clean_text(o$label %||% ""), character(1))
  medios <- if (n > 2L) labs[2:(n - 1L)] else character(0)
  numerica <- all(!nzchar(medios) | grepl("^[0-9]+([.,][0-9]+)?$", medios))
  if (n >= 3L && numerica) return("extremos")
  if (n <= 2L && all(!nzchar(labs) | grepl("^[0-9]+$", labs))) return("extremos")
  "categorias"
}

# ESQUINA DE LA MATRIZ (L16) — el enunciado de la bateria y lo que lo acompana,
# en la celda superior izquierda de la cabecera. UNA sola cuenta para el dibujo
# y para el paginado: tenerlas separadas es lo que descuadro L4 y L5, y aqui el
# riesgo es el mismo porque la cabecera tiene que CRECER hasta que la esquina
# quepa. Devuelve las lineas ya envueltas y la altura que reservan.
#
# El ancho de caracteres se deriva de la fraccion de etiqueta, no de una
# constante: en un tramo de dos columnas `label_w` es la mitad y una cifra fija
# haria que el enunciado se saliera de su celda solo en ese tramo.
.form_pdf_matrix_esquina <- function(block, label_w, inner) {
  tenor <- .form_pdf_clean_text(block$tenor %||% "")
  hint <- .form_pdf_clean_text(block$hint %||% "")
  chars <- max(10L, floor(118 * (label_w - 0.012) / max(1e-6, inner)))
  # El sub-grupo YA NO entra aqui: desde L17 tiene banda propia encima de la
  # matriz, y decirlo en los dos sitios es duplicarlo.
  if (!nzchar(tenor)) return(list(lineas = character(0), height = 0))
  num <- .form_pdf_clean_text(block$number %||% "")
  texto <- if (nzchar(num)) paste0(num, ".  ", tenor) else tenor
  lineas <- .form_pdf_wrap(texto, chars)
  if (nzchar(hint)) lineas <- c(lineas, .form_pdf_wrap(hint, chars))
  # Item 19: tenor (y pista) con formato visible -> tramos al ancho de la celda.
  rt <- .form_rt_campo(block, "tenor")
  if (nzchar(num)) rt <- c(list(.form_rt_run(paste0(num, ".  "))), rt)
  if (nzchar(hint)) rt <- c(rt, list(.FORM_RT_BR), .form_rt_campo(block, "hint"))
  lay <- .form_pdf_rt_si(rt, label_w - 0.012, 8.0, 0.0134, base_b = TRUE)
  if (!is.null(lay)) return(list(lineas = lay$plano, lay = lay, height = lay$alto + 0.012))
  list(lineas = lineas, height = length(lineas) * 0.0134 + 0.012)
}

.form_pdf_draw_matrix <- function(block, x, y, w) {
  tk <- .form_pdf_tokens()
  if (nzchar(block$opening_condition %||% "")) {
    y <- .form_pdf_draw_opening(block$opening_condition, x, y, w)
    y <- y - 0.002
  }
  # L16: CON tenor el enunciado ya NO va encima de la tabla — vive en la celda
  # superior izquierda de la cabecera, junto a la escala (patron P20..P22 de la
  # referencia). Se dibuja mas abajo, cuando `label_w` y `header_h` existen.
  # Sin tenor el titulo es la etiqueta del 1er item, que ademas ya aparece como
  # fila 1: no se dibuja nada para no duplicarlo.
  has_tenor <- nzchar(block$tenor %||% "")
  if (!has_tenor && nzchar(block$hint %||% "")) {
    lay_h <- .form_pdf_rt_si(.form_rt_campo(block, "hint"), w - 0.012, 7.2, 0.011, base_i = TRUE)
    y <- if (is.null(lay_h)) {
      .form_pdf_text(block$hint, x + 0.006, y - 0.002, w - 0.012,
                     chars = 118, fontsize = 7.2, fontface = "italic", col = tk$soft, line_h = 0.011)
    } else {
      .form_pdf_rt_draw(lay_h, x + 0.006, y - 0.002, w - 0.012, col = tk$soft)
    }
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
  .form_pdf_traza("tabla_tope", NA_integer_, y_top_tbl, y_top_tbl)

  code_y_off <- 0.010  # los codigos se alinean con la primera linea del item
  # Con muchas columnas, reduce el tamaño del codigo para que quepa.
  code_fs <- if (total_cols >= 10L) 6.0 else if (total_cols >= 8L) 6.6 else 7.4
  header_mode <- .form_pdf_matrix_header_mode(scale, block$header_mode %||% "auto")

  # ESQUINA (L16): el enunciado numerado, y debajo la pista y el sub-grupo si los
  # hay. Se mide ANTES de las ramas porque la cabecera tiene que crecer hasta
  # caber: si no, el enunciado se sale por debajo de su banda y pisa la 1a fila.
  esq <- .form_pdf_matrix_esquina(block, label_w, inner)
  esq_h <- esq$height

  if (total_cols > 0L && identical(header_mode, "categorias")) {
    # --- Cabecera CATEGORIAS: cada label de escala rotulada SOBRE su columna. Si
    # la etiqueta cabe en el ancho de columna se dibuja HORIZONTAL (Si/No,
    # escalas cortas); si es larga se rota 90° (categorias estilo Polarizacion). ---
    cat_labels <- vapply(scale, function(o) .form_pdf_clean_text_safe(o$label %||% o$code), character(1))
    sp_label <- if (has_special) .form_pdf_clean_text_safe(special$label %||% special$code) else ""
    geom <- .form_pdf_matrix_cat_header_geom(cat_labels, sp_label, has_special, col_w, total_cols)
    header_h <- max(geom$height, esq_h)
    cat_fs <- geom$cat_fs

    grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(y - header_h / 2, "npc"),
                    width = grid::unit(inner, "npc"), height = grid::unit(header_h, "npc"),
                    gp = grid::gpar(fill = tk$tbl_header, col = NA))
    if (identical(geom$layout, "horizontal")) {
      hy <- y - header_h / 2
      for (k in seq_len(n_scale)) {
        grid::grid.text(paste(geom$lineas[[k]], collapse = "\n"),
                        x = grid::unit(scale_x0 + (k - 0.5) * col_w, "npc"),
                        y = grid::unit(hy, "npc"), just = c("center", "center"),
                        gp = grid::gpar(fontsize = cat_fs, fontface = "bold", col = tk$navy, lineheight = 0.95))
      }
      if (has_special) {
        grid::grid.text(paste(geom$lineas[[n_scale + 1L]], collapse = "\n"),
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
    special_lines <- if (has_special) .form_pdf_wrap(.form_pdf_clean_text_safe(special$label %||% special$code), special_cw) else character(0)
    hdr_lines <- max(1L, length(left_lines), length(right_lines), length(special_lines))
    header_h <- max(hdr_lines * 0.0110 + 0.010, esq_h)
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
  # Celda superior-izquierda del header: enunciado de la bateria (L16) y/o
  # etiqueta de sub-grupo. Con enunciado se ancla ARRIBA —puede ocupar varias
  # lineas y centrarlo lo descuadraria respecto a la escala—; solo con
  # sub-grupo se mantiene el centrado que habia.
  if (!is.null(esq$lay) && header_h > 0) {
    .form_pdf_rt_draw(esq$lay, x0 + 0.006, y_top_tbl - 0.006, label_w - 0.012, col = tk$ink)
  } else if (length(esq$lineas) && header_h > 0) {
    grid::grid.text(paste(esq$lineas, collapse = "\n"),
                    x = grid::unit(x0 + 0.006, "npc"),
                    y = grid::unit(y_top_tbl - 0.006, "npc"),
                    just = c("left", "top"),
                    gp = grid::gpar(fontsize = 8.0, fontface = "bold", col = tk$ink, lineheight = 0.95))
  }
  y_body_top <- y

  # --- Filas de items: etiqueta ancha + el CODIGO impreso en cada columna ---
  row_idx <- 0L
  lbl_w_txt <- label_w - 0.012
  for (item in block$items %||% list()) {
    row_idx <- row_idx + 1L
    # Rol (madre / sub-pregunta / fila), sangria, envoltorio por ancho real con
    # el enfasis por tramos (L15) y alto de la fila: el MISMO helper que usa
    # .form_pdf_block_height, para que reserva y dibujo no diverjan.
    fg <- .form_pdf_matrix_fila_geom(item, inner, lbl_w_txt)
    num <- fg$num; is_parent <- fg$is_parent; indent <- fg$indent; txt_w <- fg$txt_w
    sk_lines <- fg$sk_lines
    n_lineas <- fg$n_lbl
    h <- fg$h
    if (row_idx %% 2L == 0L) {
      grid::grid.rect(x = grid::unit(x0 + inner / 2, "npc"), y = grid::unit(y - h / 2, "npc"),
                      width = grid::unit(inner, "npc"), height = grid::unit(h, "npc"),
                      gp = grid::gpar(fill = tk$tbl_zebra, col = NA))
    }
    if (!is_parent && nzchar(num)) {
      # Alineado por ARRIBA con la etiqueta, no centrado en la caja de linea:
      # centrar deja el numero un par de puntos por debajo de su texto, porque el
      # centro visual de una cifra no es el centro de su caja.
      grid::grid.text(num, x = grid::unit(x0 + 0.006 + .FORM_PDF_MATRIX_NUM_W / 2, "npc"),
                      y = grid::unit(y - 0.004, "npc"),
                      just = c("center", "top"),
                      gp = grid::gpar(fontsize = 7.3, col = tk$ink))
    }
    if (is.null(fg$lay)) {
      .form_pdf_text(fg$lbl, x0 + 0.006 + indent, y - 0.004, txt_w,
                     lines = fg$lineas, fontsize = 7.3, col = tk$ink, line_h = 0.012)
    } else {
      .form_pdf_rt_draw(fg$lay, x0 + 0.006 + indent, y - 0.004, txt_w, col = tk$ink)
    }
    if (length(sk_lines)) {
      grid::grid.text(paste(sk_lines, collapse = "\n"), x = grid::unit(x0 + 0.012, "npc"),
                      y = grid::unit(y - 0.004 - n_lineas * 0.012 - 0.001, "npc"),
                      just = c("left", "top"),
                      gp = grid::gpar(fontsize = 6.6, fontface = "italic", col = tk$navy, lineheight = 0.95))
    }
    # La madre (enunciado) no lleva codigos; solo las filas respondibles.
    if (total_cols > 0L && !is_parent) {
      # Codigos CENTRADOS verticalmente sobre el bloque de etiqueta (no el salto).
      cy <- y - 0.004 - n_lineas * 0.012 / 2
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
    # REJILLA (L3): linea entre filas de la matriz. Igual que en la lista de
    # opciones, las filas se separaban SOLO por zebra y ese relleno no sobrevive
    # a una fotocopia: una bateria de 15 items quedaba como texto flotando sobre
    # columnas de digitos, que en papel es donde mas se necesita la guia.
    if (row_idx < length(block$items %||% list())) {
      grid::grid.lines(x = grid::unit(c(x0, x0 + inner), "npc"),
                       y = grid::unit(c(y, y), "npc"),
                       gp = grid::gpar(col = tk$tbl_div, lwd = 0.5))
    }
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
    # divisores internos entre columnas de escala (punteados suaves). Item 42:
    # empiezan BAJO la cabecera. En «extremos» cada rotulo se centra sobre su
    # mitad de columnas y una linea a toda altura lo tachaba («Lu|nes»).
    if (n_scale >= 2L) {
      for (k in seq_len(n_scale - 1L)) {
        dx <- scale_x0 + col_w * k
        grid::grid.lines(x = grid::unit(c(dx, dx), "npc"), y = grid::unit(c(tbl_bottom, y_body_top), "npc"),
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
    subsection = .form_pdf_draw_subsection(block, x, y, w),
    matrix = .form_pdf_draw_matrix(block, x, y, w),
    question = .form_pdf_draw_question(block, x, y, w),
    y
  )
}

formulario_pdf_render <- function(model, output_file) {
  # DOS PASADAS para el «Pagina N de M» del pie (L10). En un PDF dibujado con
  # `grid` el total NO es un campo que el lector resuelva —como el NUMPAGES del
  # .docx—: el motor pinta pagina a pagina y no sabe cuantas habra hasta
  # terminar. Se recorre una vez sobre un dispositivo nulo SOLO para contarlas y
  # otra para dibujar de verdad.
  #
  # Se recorre DOS VECES EL MISMO codigo, no una simulacion aparte: el reparto en
  # columnas depende de lo que devuelve `.form_pdf_draw_block()`, no solo de
  # `.form_pdf_block_height()`, asi que una copia «solo para medir» divergiria del
  # dibujo en cuanto alguien tocara uno de los dos. Es el mismo motivo por el que
  # el ancho de la columna del numero es una constante compartida.
  .recorrer <- function(total_pages) {
  # TIPOGRAFIA ESTRECHA (L2). La referencia usa Arial Narrow, y es estrecha a
  # proposito: es lo que permite meter una matriz de nueve columnas en un A4 sin
  # partir los rotulos de la escala.
  #
  # Hasta el item 22 se usaba Helvetica-Narrow del dispositivo `pdf()`, sin
  # embeber, porque Arial Narrow es del SISTEMA y en el runner Linux no existe
  # (cairo caia a otra en silencio). Desde el item 22 la fuente es Liberation
  # Sans Narrow —metrico-compatible con Arial Narrow— EMBEBIDA y empaquetada:
  # sale igual en todas partes y no depende del visor. Ver
  # reporte_formulario_fuente.R.
  page_no <- 0L
  # Caja de texto (L6). La regla de cabecera esta en 0.922 y el contenido
  # arrancaba en 0.885: 31 pt de aire entre una y otro. El pie deja el suyo en
  # .form_pdf_footer. Medido contra el .docx sobre el mismo instrumento, el
  # contenido del PDF empezaba 105 pt mas abajo.
  y_top <- 0.906
  y_bottom <- 0.058
  col_x <- c(0.058, 0.525)
  col_w <- 0.405
  full_x <- 0.058
  full_w <- 0.875
  current_col <- 1L
  y <- c(y_top, y_top)
  divider_top <- NA_real_
  tras_ancho <- FALSE

  flush_divider <- function(bottom_y = y_bottom) {
    if (is.na(divider_top)) return(invisible(NULL))
    if ((divider_top - bottom_y) > 0.025) {
      grid::grid.lines(
        x = grid::unit(c(0.5, 0.5), "npc"),
        y = grid::unit(c(bottom_y, divider_top), "npc"),
        gp = grid::gpar(col = .form_pdf_tokens()$faint, lwd = 0.5)
      )
      .form_pdf_traza("divisor", page_no, divider_top, bottom_y)
    }
    divider_top <<- NA_real_
    invisible(NULL)
  }

  new_page <- function() {
    if (page_no > 0L) flush_divider(y_bottom)
    page_no <<- page_no + 1L
    grid::grid.newpage()
    # Item 22: la region de siempre dentro del A4 de cairo_pdf.
    .form_fuente_region()
    .form_pdf_header(model, page_no)
    .form_pdf_footer(model, page_no, total_pages)
    current_col <<- 1L
    y <<- c(y_top, y_top)
    divider_top <<- NA_real_
  }
  new_page()

  blocks <- model$blocks
  # Reparto equilibrado de los tramos de dos columnas (L12): sin esto la columna
  # izquierda se llena hasta el fondo y la derecha queda vacia. Las alturas se
  # miden una vez, con el ancho de columna.
  alturas <- vapply(blocks, function(b) {
    .form_pdf_block_height(b, if (isTRUE(b$full_width)) full_w else col_w)
  }, numeric(1))
  # Item 45: el corte se decide al EMPEZAR cada tramo de dos columnas en cada
  # pagina (`corte` = bloque que abre la derecha; NA = sin plan todavia).
  corte <- NA_integer_
  planificado <- FALSE

  for (bi in seq_along(blocks)) {
    block <- blocks[[bi]]
    h <- .form_pdf_block_height(block, if (isTRUE(block$full_width)) full_w else col_w)
    if (isTRUE(block$full_width)) {
      # El divisor se corta ANTES del bloque de ancho completo, con aire: si
      # termina justo en su borde, la linea toca la primera linea de texto
      # (acnur_pdm p. 2: «en|» en la nota de consentimiento). Se reanuda despues
      # (`tras_ancho`), tambien con aire.
      flush_divider(min(y) + .FORM_PDF_DIVISOR_AIRE)
      yy <- min(y)
      # Control de viudas/huerfanas: una banda no debe quedar sola al pie.
      #
      # L20 — AQUI HABIA UN TOPE, `min(nxt_h, 0.085)`, y era justo lo que dejaba
      # pasar la viuda que la regla existe para impedir. El tope tenia sentido si
      # el bloque siguiente pudiera EMPEZAR al pie y continuar en la pagina
      # siguiente, pero ningun bloque de ancho completo se parte: o cabe entero o
      # se va entero (el gate del §4 lo exige para las matrices). Asi que con un
      # siguiente mas alto que 71.6 pt —cualquier matriz— la banda se quedaba, el
      # bloque no cabia y la banda amanecia sola al pie. Medido: con 9 y con 10
      # preguntas de relleno antes de una seccion seguida de matriz, la banda
      # quedaba huerfana; con el tope fuera, no pasa en ningun relleno de 6 a 13.
      #
      # La excepcion es real y hay que dejarla: si el bloque siguiente no cabe ni
      # en una pagina entera, saltar no arregla nada y encima gastaria una pagina.
      # Item 17: una nota-introduccion (`keep_with_next`) arrastra a su bloque
      # igual que una banda; la cuenta de la cadena vive en
      # reporte_formulario_nota_intro.R.
      keep <- .form_pdf_alto_arrastre(blocks, bi, h, y_top - y_bottom,
                                      function(b) .form_pdf_block_height(b, full_w))
      if (yy - h < y_bottom || (yy - keep < y_bottom && yy < (y_top - 0.001))) {
        new_page()
        yy <- y_top
      }
      y_next <- .form_pdf_draw_block(block, full_x, yy, full_w)
      .form_pdf_traza("ancho", page_no, yy, y_next)
      y <- c(y_next, y_next)
      current_col <- 1L
      tras_ancho <- TRUE
      planificado <- FALSE
      next
    }

    # Corte equilibrado (L12 + item 45): al empezar el tramo en esta pagina se
    # decide que bloque abre la segunda columna; este bloque la abre aunque en
    # la primera todavia quepa.
    if (!planificado) {
      corte <- .form_pdf_corte_pagina(blocks, alturas, bi, y[1] - y_bottom)
      planificado <- TRUE
    }
    if (current_col == 1L && identical(bi, corte)) {
      current_col <- 2L
    }
    if (y[current_col] - h < y_bottom) {
      if (current_col == 1L) {
        current_col <- 2L
      } else {
        new_page()
        # Pagina nueva a mitad del tramo: se replanifica la cola.
        corte <- .form_pdf_corte_pagina(blocks, alturas, bi, y[1] - y_bottom)
        planificado <- TRUE
      }
    }
    if (y[current_col] - h < y_bottom) {
      # Bloque mas alto que una columna: dibujarlo igual en pagina nueva.
      if (current_col == 2L) new_page()
    }
    if (is.na(divider_top)) {
      divider_top <- y[current_col] - (if (tras_ancho && y[current_col] < y_top - 0.001) .FORM_PDF_DIVISOR_AIRE else 0)
    }
    tras_ancho <- FALSE
    y[current_col] <- .form_pdf_draw_block(block, col_x[current_col], y[current_col], col_w)
  }

  flush_divider(y_bottom)
    page_no
  }

  # Pasada 1: contar. Sobre el MISMO dispositivo que dibuja (papel, region y
  # fuente): todo lo que se mide en npc tiene que dar igual en las dos pasadas
  # (hsvg2026 imprimia «15 de 16» cuando contaba sobre otro). Item 22: es
  # `cairo_pdf()` con Liberation Sans Narrow embebida (reporte_formulario_fuente.R).
  cuenta <- tempfile(fileext = ".pdf")
  .form_fuente_dispositivo(cuenta)
  total <- tryCatch(.recorrer(NA_integer_), finally = { grDevices::dev.off(); unlink(cuenta) })

  # Pasada 2: dibujar con el total ya conocido.
  .form_fuente_dispositivo(output_file)
  on.exit(grDevices::dev.off(), add = TRUE)
  .recorrer(total)
  grDevices::dev.off()
  on.exit()
  # La fuente se comprueba EN EL ARTEFACTO: si cairo cayo a otra, falla con la causa.
  .form_fuente_verificar_pdf(output_file, .form_fuente_sin_glifo(.form_fuente_textos_modelo(model)))
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
