# collection_mail_recipients.R — destinatarios del correo (ADR 0110 §2 y
# Consecuencias).
#
# **Los destinatarios son datos personales y NO entran al `.pulso`.** Se guardan
# solo en el directorio temporal de la sesión, una carpeta por campaña
# (`<session$dir>/mail_recipients/<campaign_id>/recipients.rds`, ver
# collection_mail_campaigns.R): ni en `collection_state`, ni
# en `session$files` (que es persistible), ni en ninguna clave de session_schema.
# Al cerrar la sesión desaparecen; al reemplazar la sesión con un `open
# in_place` se borran (`.cmail_purge_personal_data`); para exportar otra vez se
# vuelven a importar.
#
# La vista nunca recibe correos: el GET devuelve conteo, columnas, mapeo y una
# muestra con nombre y campos, sin la columna de correo y con todo valor con
# forma de correo oculto (`.cmail_mask_pii`).
#
# Población y unidad (D1-D3). La lista importada ES la población: la app no la
# cruza con la muestra. La unidad es la persona contactable, identificada por su
# correo normalizado (collection_mail_text.R). Partición disjunta y exhaustiva
# de las filas no vacías:
#   total = valid + without_email + invalid_email + duplicated
# `valid` (efectivos) = correo válido y primera aparición del correo. Las filas
# totalmente vacías se descartan antes y se cuentan aparte
# (`rows_blank_dropped`), fuera de `total`.
#
# Nombre de pila (FNAME): ver `.cmail_first_name`. Es cosmético (el saludo), no
# un dato de análisis.

.CMAIL_RECIPIENTS_MAX_BYTES <- 10 * 1024^2
.CMAIL_RECIPIENTS_MAX_ROWS <- 50000L
.CMAIL_SAMPLE_SIZE <- 5L

.cmail_recipients_root <- function(session) file.path(session$dir, "mail_recipients")

# Carpeta de una campaña; sin campaign_id, la raíz (la purga borra el árbol).
.cmail_recipients_dir <- function(session, campaign_id = NULL) {
  root <- .cmail_recipients_root(session)
  if (is.null(campaign_id)) return(root)
  # El id entra a una ruta: nunca algo fuera del patrón (ni «..», ni «/»).
  if (!.cmail_campaign_id_ok(campaign_id)) {
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "La campaña de correo no existe en este proyecto.")
  }
  file.path(root, campaign_id)
}
.cmail_recipients_path <- function(session, campaign_id) {
  file.path(.cmail_recipients_dir(session, campaign_id), "recipients.rds")
}

# Una sesión de la versión de una sola plantilla guardó en la raíz. Ese archivo
# es de la única campaña (la migrada): se mueve a su carpeta.
.cmail_recipients_adopt_legacy <- function(session, campaign_id) {
  legacy <- file.path(.cmail_recipients_root(session), "recipients.rds")
  if (is.null(session$dir) || !file.exists(legacy)) return(invisible(FALSE))
  target <- .cmail_recipients_path(session, campaign_id)
  if (file.exists(target)) return(invisible(FALSE))
  dir.create(dirname(target), recursive = TRUE, showWarnings = FALSE)
  invisible(file.rename(legacy, target))
}

.cmail_recipients_forget <- function(session, campaign_id) {
  unlink(.cmail_recipients_dir(session, campaign_id), recursive = TRUE, force = TRUE)
}

.cmail_norm_header <- function(x) {
  x <- stringi::stri_trans_general(tolower(trimws(as.character(x))), "Latin-ASCII")
  x <- gsub("[^a-z0-9]+", "_", x)
  gsub("^_+|_+$", "", x)
}

# ---- lectura ------------------------------------------------------------------

# Bytes de un CSV -> texto UTF-8. Excel en Windows guarda «CSV» en
# Windows-1252; antes se leía como UTF-8 y la lectura se cortaba en la primera
# «Ñ» sin error. Devuelve list(text, encoding).
.cmail_decode_csv <- function(raw) {
  enc_error <- function() {
    stop_api(422, "E_COLLECTION_MAIL_RECIPIENTS_ENCODING",
             "No se reconoce la codificación del archivo. Guárdalo como «CSV UTF-8» o como XLSX.")
  }
  b <- as.integer(raw[seq_len(min(3L, length(raw)))])
  if (length(b) >= 2L && ((b[1] == 0xFF && b[2] == 0xFE) || (b[1] == 0xFE && b[2] == 0xFF))) {
    from <- if (b[1] == 0xFF) "UTF-16LE" else "UTF-16BE"
    text <- tryCatch(stringi::stri_encode(raw[-(1:2)], from = from, to = "UTF-8"), warning = function(w) NULL,
                     error = function(e) NULL)
    if (is.null(text)) enc_error()
    return(list(text = text, encoding = "utf-16"))
  }
  if (length(b) >= 3L && b[1] == 0xEF && b[2] == 0xBB && b[3] == 0xBF) raw <- raw[-(1:3)]
  if (any(raw == as.raw(0))) enc_error()
  if (isTRUE(stringi::stri_enc_isutf8(raw))) {
    text <- rawToChar(raw)
    Encoding(text) <- "UTF-8"
    return(list(text = text, encoding = "utf-8"))
  }
  # Bytes sin carácter en Windows-1252: no es ese juego, y adivinar otro
  # fabricaría letras.
  if (any(raw %in% as.raw(c(0x81, 0x8D, 0x8F, 0x90, 0x9D)))) enc_error()
  text <- tryCatch(stringi::stri_encode(raw, from = "windows-1252", to = "UTF-8"),
                   warning = function(w) NULL, error = function(e) NULL)
  if (is.null(text)) enc_error()
  list(text = text, encoding = "windows-1252")
}

# Un fallo de lectura: al cliente un motivo fijo y un error_id; el mensaje
# original (con lo que el lector citó del archivo, enmascarado) a stderr.
.cmail_unreadable <- function(reason, cond = NULL) {
  error_id <- .api_error_id()
  if (!is.null(cond)) {
    message(sprintf("[collection_mail] %s %s: %s", reason, error_id,
                    .cmail_mask_pii(substr(conditionMessage(cond), 1L, 300L))))
  }
  stop_api(422, "E_COLLECTION_MAIL_RECIPIENTS_UNREADABLE", "No se pudo leer el archivo de destinatarios.",
           details = list(reason = reason, error_id = error_id))
}

.cmail_parse_csv <- function(raw) {
  decoded <- .cmail_decode_csv(raw)
  text <- gsub("\r\n?", "\n", decoded$text)
  if (!endsWith(text, "\n")) text <- paste0(text, "\n")
  first <- strsplit(substr(text, 1L, 20000L), "\n", fixed = TRUE)[[1]][1] %||% ""
  seps <- c(",", ";", "\t")
  counts <- vapply(seps, function(ch) lengths(regmatches(first, gregexpr(ch, first, fixed = TRUE))), integer(1))
  sep <- if (any(counts > 0L)) seps[[which.max(counts)]] else ","
  tmp <- tempfile(fileext = ".csv")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  writeBin(charToRaw(enc2utf8(text)), tmp)
  warned <- NULL
  df <- withCallingHandlers(
    tryCatch(
      utils::read.csv(tmp, sep = sep, colClasses = "character", check.names = FALSE, encoding = "UTF-8",
                      na.strings = character(0), strip.white = TRUE, blank.lines.skip = FALSE, quote = "\""),
      error = function(e) .cmail_unreadable("parse_error", e)
    ),
    warning = function(w) {
      if (is.null(warned)) warned <<- w
      invokeRestart("muffleWarning")
    }
  )
  # Un aviso del lector (comilla sin cerrar, fin de archivo a media fila) es
  # una lectura parcial: nunca se acepta en silencio.
  if (!is.null(warned)) .cmail_unreadable("parse_warning", warned)
  list(df = df, encoding = decoded$encoding)
}

.cmail_read_table <- function(raw, file_name) {
  ext <- tolower(tools::file_ext(file_name %||% ""))
  if (!(ext %in% c("xlsx", "xls", "csv", "txt"))) {
    stop_api(415, "E_COLLECTION_MAIL_RECIPIENTS_FORMAT", "Los destinatarios se importan desde un CSV o un XLSX.")
  }
  encoding <- NULL
  if (ext %in% c("xlsx", "xls")) {
    tmp <- tempfile(fileext = paste0(".", ext))
    on.exit(unlink(tmp, force = TRUE), add = TRUE)
    writeBin(raw, tmp)
    df <- tryCatch({
      out <- suppressWarnings(readxl::read_excel(tmp, col_types = "text", .name_repair = "minimal"))
      as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
    }, error = function(e) .cmail_unreadable("parse_error", e))
  } else {
    parsed <- .cmail_parse_csv(raw)
    df <- parsed$df
    encoding <- parsed$encoding
  }
  # Encabezado vacío o repetido: se queda la primera columna con ese nombre.
  names(df) <- .cmail_clean_text(names(df))
  # Sin fila de encabezados, el primer destinatario se volvería «columnas»: se
  # perdería una persona sin aviso y su correo saldría en la respuesta. No se
  # cita el valor (D6).
  if (any(grepl(.CMAIL_EMAIL_LIKE_RE, names(df)))) {
    stop_api(422, "E_COLLECTION_MAIL_RECIPIENTS_NO_HEADER",
             "La primera fila parece un destinatario; agrega una fila de encabezados.")
  }
  keep <- nzchar(names(df)) & !duplicated(names(df))
  df <- df[, keep, drop = FALSE]
  df[] <- lapply(df, .cmail_clean_text)
  # Fila 1 = encabezado; la fila de datos i está en la fila i + 1 del archivo.
  source_row <- seq_len(nrow(df)) + 1L
  blank <- if (nrow(df) && ncol(df)) !apply(df, 1L, function(r) any(nzchar(r))) else rep(TRUE, nrow(df))
  # Filas completamente vacías (el pie típico de una hoja de Excel): fuera de
  # la población y contadas aparte.
  df <- df[!blank, , drop = FALSE]
  source_row <- source_row[!blank]
  if (!ncol(df) || !nrow(df)) {
    stop_api(422, "E_COLLECTION_MAIL_RECIPIENTS_EMPTY", "El archivo no trae destinatarios.")
  }
  if (nrow(df) > .CMAIL_RECIPIENTS_MAX_ROWS) {
    stop_api(413, "E_COLLECTION_MAIL_RECIPIENTS_TOO_MANY",
             sprintf("Máximo %d destinatarios por importación.", .CMAIL_RECIPIENTS_MAX_ROWS))
  }
  rownames(df) <- NULL
  list(df = df, source_row = as.integer(source_row), rows_blank_dropped = as.integer(sum(blank)),
       encoding = encoding)
}

# ---- mapeo --------------------------------------------------------------------

.cmail_guess_mapping <- function(df, template) {
  columns <- names(df)
  norm <- .cmail_norm_header(columns)
  pick <- function(idx) if (length(idx)) columns[[idx[[1]]]] else NULL
  email <- pick(which(grepl("(^|_)(correo|email|e_mail|mail)($|_)", norm)))
  if (is.null(email)) {
    share <- vapply(df, function(col) {
      v <- .cmail_email_normalize(col); v <- v[nzchar(v)]
      if (length(v)) mean(.cmail_email_valid(v)) else 0
    }, numeric(1))
    email <- pick(which(share >= 0.5))
  }
  free <- columns != (email %||% "")
  # El nombre: un encabezado de persona («Nombre», «Apellidos y nombres»), nunca
  # otro sustantivo que lleve la palabra («Nombre de la carrera»).
  exact_name <- which(free & norm %in% c("nombre", "nombres", "first_name", "primer_nombre", "nombre_de_pila",
                                         "name", "full_name", "nombre_completo", "nombres_completos"))
  combo_name <- which(free & grepl("^(apellidos?_(y_)?nombres?|nombres?_(y_)?apellidos?)$", norm))
  loose_name <- which(free & grepl("^nombres?($|_)", norm) & !grepl("_(de|del)_", norm))
  person <- which(free & norm %in% c("estudiante", "alumno", "alumna", "participante", "docente", "persona",
                                     "destinatario", "contacto", "encuestado", "encuestada"))
  # Un encabezado de persona con valores que son solo dígitos es un código
  # («Estudiante» = 20260001), no un nombre.
  digits <- vapply(df, function(col) {
    v <- .cmail_value(col); v <- v[nzchar(v)]
    length(v) > 0L && mean(grepl("^[0-9]+$", v)) >= 0.5
  }, NA)
  person <- person[!digits[person]]
  name <- pick(c(exact_name, combo_name, loose_name, person))
  fields <- list()
  for (f in template$fields %||% list()) {
    key <- as.character(f$key)
    label <- .cmail_norm_header(f$label %||% key)
    hit <- which(free & (norm == key | norm == label | norm == tolower(as.character(f$tag))))
    if (!length(hit)) hit <- which(free & grepl(paste0("(^|_)", key, "($|_)"), norm))
    col <- pick(hit)
    if (!is.null(col)) fields[[key]] <- col
  }
  list(email_column = email, name_column = name,
       name_format = .cmail_name_format(name, if (!is.null(name)) df[[name]]), fields = fields)
}

.cmail_mapping_validate <- function(mapping, df, template) {
  columns <- names(df)
  if (!is.list(mapping)) {
    stop_api(422, "E_COLLECTION_MAIL_MAPPING_INVALID", "mapping debe ser un objeto {email_column, name_column, fields}.")
  }
  problems <- character(0)
  one_col <- function(x, what) {
    v <- .cmail_one(x)
    if (is.null(x)) return(NULL)
    if (is.null(v) || !(v %in% columns)) {
      problems <<- c(problems, sprintf("%s: '%s' no es una columna del archivo.", what, paste(unlist(x), collapse = ",")))
      return(NULL)
    }
    v
  }
  email <- one_col(mapping$email_column, "email_column")
  name <- one_col(mapping$name_column, "name_column")
  # La columna del correo no puede alimentar otra etiqueta: el correo llegaría
  # a la muestra, a la vista previa y al cuerpo del correo.
  if (!is.null(email) && identical(name, email)) {
    problems <- c(problems, "name_column: no puede ser la columna del correo.")
    name <- NULL
  }
  fmt <- .cmail_one(mapping$name_format) %||% .cmail_name_format(name, if (!is.null(name)) df[[name]])
  if (!(fmt %in% c("apellidos_coma_nombres", "nombre"))) {
    problems <- c(problems, "name_format es apellidos_coma_nombres o nombre.")
  }
  keys <- vapply(template$fields %||% list(), function(f) as.character(f$key), "")
  fields <- list()
  raw_fields <- mapping$fields %||% list()
  if (!is.list(raw_fields)) raw_fields <- as.list(raw_fields)
  for (k in names(raw_fields)) {
    if (!(k %in% keys)) {
      problems <- c(problems, sprintf("fields.%s: no es un campo de la plantilla.", k))
      next
    }
    col <- one_col(raw_fields[[k]], paste0("fields.", k))
    if (!is.null(col) && !is.null(email) && identical(col, email)) {
      problems <- c(problems, sprintf("fields.%s: no puede ser la columna del correo.", k))
      next
    }
    if (!is.null(col)) fields[[k]] <- col
  }
  if (length(problems)) {
    stop_api(422, "E_COLLECTION_MAIL_MAPPING_INVALID", "El mapeo de columnas no calza con el archivo.",
             details = list(problems = as.list(problems)))
  }
  list(email_column = email, name_column = name, name_format = fmt, fields = fields)
}

# ---- almacenamiento efímero -----------------------------------------------------

.cmail_recipients_load <- function(session, campaign_id) {
  path <- .cmail_recipients_path(session, campaign_id)
  if (!file.exists(path)) return(NULL)
  readRDS(path)
}

.cmail_recipients_save <- function(session, campaign_id, store) {
  dir.create(.cmail_recipients_dir(session, campaign_id), recursive = TRUE, showWarnings = FALSE)
  saveRDS(store, .cmail_recipients_path(session, campaign_id))
  invisible(store)
}

#' Borra los datos personales de una sesión: los destinatarios importados y los
#' ZIP exportados (sensitivity = personal_data). Se llama al reemplazar la
#' sesión con `open in_place`; cerrar la sesión ya borra su directorio entero.
#' @keywords internal
.cmail_purge_personal_data <- function(session) {
  if (is.null(session) || is.null(session$dir)) return(invisible(FALSE))
  unlink(.cmail_recipients_root(session), recursive = TRUE, force = TRUE)
  root <- normalizePath(session$dir, mustWork = FALSE)
  for (meta in session$files %||% list()) {
    if (!is.list(meta) || !identical(as.character(meta$sensitivity %||% "")[1], "personal_data")) next
    path <- as.character(meta$path %||% "")[1]
    if (nzchar(path) && startsWith(normalizePath(path, mustWork = FALSE), root)) unlink(path, force = TRUE)
  }
  invisible(TRUE)
}

# Claves de la plantilla con su etiqueta y columna; sin plantilla, todo lo mapeado.
.cmail_mapped_keys <- function(m, template = NULL) {
  fields <- if (!is.null(template)) .cmail_field_index(template) else list()
  keys <- c(if (!is.null(m$name_column)) "nombre", names(m$fields %||% list()))
  if (!is.null(template)) keys <- intersect(keys, .cmail_used_keys(template))
  lapply(stats::setNames(keys, keys), function(k) {
    if (identical(k, "nombre")) list(key = k, tag = "FNAME", column = m$name_column)
    else list(key = k, tag = fields[[k]]$tag %||% toupper(k), column = m$fields[[k]])
  })
}

.cmail_key_values <- function(store, first_name, k) {
  if (identical(k$key, "nombre")) first_name else .cmail_value(store$rows[[k$column]])
}

#' Destinatarios efectivos y la partición de la población.
#'
#' @param template plantilla de trabajo: decide qué campos cuentan para
#'   `duplicated_conflicting` y `persons_with_any_empty` (sin ella, todo lo
#'   mapeado).
#' @keywords internal
.cmail_recipients_resolve <- function(store, template = NULL) {
  df <- store$rows
  m <- store$mapping
  n <- nrow(df)
  source_row <- store$source_row %||% (seq_len(n) + 1L)
  email <- if (!is.null(m$email_column)) .cmail_email_normalize(df[[m$email_column]]) else rep("", n)
  has <- nzchar(email)
  valid <- has & .cmail_email_valid(email)
  key <- tolower(email)
  dup <- rep(FALSE, n)
  dup[valid] <- duplicated(key[valid])
  keep <- valid & !dup
  names_info <- lapply(seq_len(n), function(i) {
    .cmail_first_name(if (!is.null(m$name_column)) df[[m$name_column]][[i]] else "", m$name_format)
  })
  first_name <- vapply(names_info, `[[`, "", "name")
  unsplit <- vapply(names_info, `[[`, NA, "unsplit")

  keys <- .cmail_mapped_keys(m, template)
  values <- lapply(keys, function(k) .cmail_key_values(store, first_name, k))

  # Mismo correo, otro dato en un campo usado: el que queda es la primera fila.
  first_idx <- match(key, key[keep])
  first_row <- which(keep)[first_idx]
  conflicts <- list()
  for (i in which(dup)) {
    j <- first_row[[i]]
    differ <- vapply(keys, function(k) !identical(values[[k$key]][[i]], values[[k$key]][[j]]), NA)
    if (any(differ)) {
      conflicts[[length(conflicts) + 1L]] <- list(
        row = as.integer(source_row[[i]]), first_row = as.integer(source_row[[j]]),
        tags = as.list(unname(vapply(keys[differ], `[[`, "", "tag"))), keys = as.list(names(keys)[differ])
      )
    }
  }
  any_empty <- if (length(keys)) Reduce(`|`, lapply(values, function(v) !nzchar(v))) else rep(FALSE, n)

  list(
    rows = which(keep),
    email = email,
    first_name = first_name,
    unsplit = unsplit,
    source_row = as.integer(source_row),
    keys = keys,
    values = values,
    conflicts = conflicts,
    counts = list(
      total = as.integer(n),
      valid = as.integer(sum(keep)),
      without_email = as.integer(sum(!has)),
      invalid_email = as.integer(sum(has & !valid)),
      duplicated = as.integer(sum(dup)),
      duplicated_conflicting = as.integer(length(conflicts)),
      names_unsplit = as.integer(sum(unsplit[keep])),
      persons_with_any_empty = as.integer(sum(any_empty[keep])),
      rows_blank_dropped = as.integer(store$rows_blank_dropped %||% 0L)
    )
  )
}

.cmail_recipient_values <- function(store, resolved, i) {
  m <- store$mapping
  fields <- lapply(m$fields, function(col) .cmail_value(store$rows[[col]][[i]]))
  list(nombre = resolved$first_name[[i]], fields = fields)
}

# Lo único que la UI ve: nunca la columna de correo, nunca un valor con forma de correo.
.cmail_recipients_public <- function(store, template = NULL, campaign_id = NULL) {
  if (is.null(store)) {
    out <- list(ok = TRUE, loaded = FALSE, row_count = 0L, columns = list(), mapping = NULL,
                counts = NULL, sample = list())
    if (!is.null(campaign_id)) out <- append(out, list(campaign_id = campaign_id), after = 1L)
    return(out)
  }
  resolved <- .cmail_recipients_resolve(store, template)
  rows <- utils::head(resolved$rows, .CMAIL_SAMPLE_SIZE)
  sample <- lapply(seq_along(rows), function(j) {
    v <- .cmail_mask_pii(.cmail_recipient_values(store, resolved, rows[[j]]))
    list(index = as.integer(j), nombre = v$nombre, fields = if (length(v$fields)) v$fields else structure(list(), names = character(0)))
  })
  mapping <- store$mapping
  mapping$fields <- if (length(mapping$fields)) mapping$fields else structure(list(), names = character(0))
  .cmc_drop_nulls_deep(list(
    ok = TRUE,
    campaign_id = campaign_id,
    loaded = TRUE,
    file_name = store$file_name,
    imported_at = store$imported_at,
    encoding = store$encoding,
    row_count = as.integer(nrow(store$rows)),
    # Defensa (D6): un encabezado con forma de correo nunca sale tal cual.
    columns = as.list(.cmail_mask_pii(names(store$rows))),
    mapping = .cmail_mask_pii(.cmc_drop_nulls_deep(mapping)),
    counts = resolved$counts,
    sample = sample
  ))
}

# Campaña del pedido y su plantilla guardada (validada).
.cmail_campaign_template_for_session <- function(session, campaign_id = NULL) {
  pick <- .cmail_campaign_for(session, .collection_current(session), campaign_id)
  list(campaign_id = pick$campaign$campaign_id, template = .cmail_campaign_template_checked(pick$campaign),
       platform = .cmail_platform_of(pick$campaign))
}

# ---- API ----------------------------------------------------------------------

.cmail_import_payload <- function(file_raw, file_name, content_base64) {
  if (is.null(file_raw) && !is.null(.cmail_one(content_base64))) {
    file_raw <- tryCatch(jsonlite::base64_dec(.cmail_one(content_base64)), error = function(e) NULL)
  }
  name <- .cmail_one(file_name)
  if (!is.raw(file_raw) || !length(file_raw) || is.null(name)) {
    stop_api(400, "E_COLLECTION_MAIL_RECIPIENTS_FILE", "Falta el archivo de destinatarios (file o file_name + content_base64).")
  }
  if (length(file_raw) > .CMAIL_RECIPIENTS_MAX_BYTES) {
    stop_api(413, "E_COLLECTION_MAIL_RECIPIENTS_TOO_MANY", "El archivo de destinatarios supera 10 MB.")
  }
  list(raw = file_raw, name = basename(name))
}

#' Importa destinatarios al directorio temporal de la sesión.
#'
#' @param file_raw bytes del archivo (multipart) o NULL.
#' @param file_name nombre original (decide CSV/XLSX).
#' @param content_base64 alternativa JSON al multipart.
#' @param mapping mapeo opcional; sin él se adivina por los encabezados.
#' @keywords internal
collection_mail_recipients_import <- function(sid, file_raw = NULL, file_name = NULL,
                                              content_base64 = NULL, mapping = NULL, campaign_id = NULL) {
  session <- session_get(sid)
  ct <- .cmail_campaign_template_for_session(session, campaign_id)
  # E1j: con SurveyMonkey los contactos viven en su recopilador; la app no los guarda.
  if (identical(ct$platform, "surveymonkey")) {
    stop_api(422, "E_COLLECTION_MAIL_PLATFORM",
             "Esta campaña se envía por SurveyMonkey: los contactos viven en su recopilador, no se importan aquí.",
             details = list(campaign_id = ct$campaign_id, platform = "surveymonkey"))
  }
  template <- ct$template
  payload <- .cmail_import_payload(file_raw, file_name, content_base64)
  read <- .cmail_read_table(payload$raw, payload$name)
  df <- read$df
  mapping <- if (is.null(mapping)) .cmail_guess_mapping(df, template) else .cmail_mapping_validate(mapping, df, template)
  store <- list(
    schema = "collection_mail_recipients/v1",
    file_name = payload$name,
    imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    source_sha256 = paste0("sha256:", tolower(digest::digest(payload$raw, algo = "sha256", serialize = FALSE))),
    encoding = read$encoding,
    rows = df,
    source_row = read$source_row,
    rows_blank_dropped = read$rows_blank_dropped,
    mapping = mapping
  )
  .cmail_recipients_save(session, ct$campaign_id, store)
  .cmail_recipients_public(store, template, ct$campaign_id)
}

#' Cambia el mapeo de columnas sin volver a subir el archivo.
#' @keywords internal
collection_mail_recipients_mapping_put <- function(sid, mapping, campaign_id = NULL) {
  session <- session_get(sid)
  ct <- .cmail_campaign_template_for_session(session, campaign_id)
  store <- .cmail_recipients_load(session, ct$campaign_id)
  if (is.null(store)) {
    stop_api(409, "E_COLLECTION_MAIL_NO_RECIPIENTS", "Primero importa los destinatarios.")
  }
  store$mapping <- .cmail_mapping_validate(mapping, store$rows, ct$template)
  .cmail_recipients_save(session, ct$campaign_id, store)
  .cmail_recipients_public(store, ct$template, ct$campaign_id)
}

#' Resumen de los destinatarios, sin correos.
#' @keywords internal
collection_mail_recipients_get <- function(sid, campaign_id = NULL) {
  session <- session_get(sid)
  ct <- .cmail_campaign_template_for_session(session, campaign_id)
  store <- .cmail_recipients_load(session, ct$campaign_id)
  .cmail_recipients_public(store, if (!is.null(store)) ct$template, ct$campaign_id)
}

#' Olvida los destinatarios de la sesión.
#' @keywords internal
collection_mail_recipients_delete <- function(sid, campaign_id = NULL) {
  session <- session_get(sid)
  pick <- .cmail_campaign_for(session, .collection_current(session), campaign_id)
  .cmail_recipients_forget(session, pick$campaign$campaign_id)
  .cmail_recipients_public(NULL, campaign_id = pick$campaign$campaign_id)
}

# Lectura del pedido de importación: multipart (`file` + `mapping` JSON
# opcional) o JSON (`file_name` + `content_base64` + `mapping`). Vive aquí y no
# en el router para que el router siga siendo forma HTTP + llamada.
.cmail_import_request <- function(req) {
  ctype <- req$HTTP_CONTENT_TYPE %||% req$CONTENT_TYPE %||% ""
  if (grepl("multipart/form-data", ctype, fixed = TRUE)) {
    parts <- tryCatch(parse_multipart_upload(req), error = function(e) NULL)
    part <- if (is.list(parts)) parts$file else NULL
    if (!is.list(part) || !is.raw(part$value)) {
      stop_api(400, "E_COLLECTION_MAIL_RECIPIENTS_FILE", "Falta el campo file en el multipart.")
    }
    mapping <- NULL
    raw_map <- parts$mapping
    map_txt <- if (is.list(raw_map) && is.raw(raw_map$value)) {
      rawToChar(raw_map$value)
    } else if (is.raw(raw_map)) {
      rawToChar(raw_map)
    } else {
      NULL
    }
    if (!is.null(map_txt)) Encoding(map_txt) <- "UTF-8"
    if (!is.null(map_txt) && nzchar(trimws(map_txt))) {
      mapping <- tryCatch(
        jsonlite::fromJSON(map_txt, simplifyVector = FALSE),
        error = function(e) stop_api(422, "E_COLLECTION_MAIL_MAPPING_INVALID", "mapping no es JSON válido.")
      )
    }
    return(list(file_raw = part$value, file_name = part$filename %||% "destinatarios.csv", mapping = mapping,
                campaign_id = .cmail_part_text(parts$campaign_id)))
  }
  body <- .collection_parse_body(req)
  list(file_raw = NULL, file_name = body$file_name, content_base64 = body$content_base64, mapping = body$mapping,
       campaign_id = body$campaign_id)
}

# Texto de una parte del multipart (campo sin archivo), o NULL.
.cmail_part_text <- function(part) {
  txt <- if (is.list(part) && is.raw(part$value)) {
    rawToChar(part$value)
  } else if (is.raw(part)) {
    rawToChar(part)
  } else if (is.character(part) && length(part) == 1L) {
    part
  } else {
    NULL
  }
  if (is.null(txt)) return(NULL)
  Encoding(txt) <- "UTF-8"
  txt <- trimws(txt)
  if (nzchar(txt)) txt else NULL
}
