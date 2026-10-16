# collection_mail_recipients.R — destinatarios del correo (ADR 0110 §2 y
# Consecuencias).
#
# **Los destinatarios son datos personales y NO entran al `.pulso`.** Se guardan
# solo en el directorio temporal de la sesión
# (`<session$dir>/mail_recipients/recipients.rds`): ni en `collection_state`, ni
# en `session$files` (que es persistible), ni en ninguna clave de session_schema.
# Al cerrar la sesión desaparecen; para exportar otra vez se vuelven a importar.
#
# La vista nunca recibe correos: el GET devuelve conteo, columnas, mapeo y una
# muestra con nombre y campos, sin la columna de correo.
#
# Nombre de pila (FNAME). El mapeo es explícito: la persona elige la columna del
# nombre. Si es una columna combinada («Apellidos y nombres», formato
# «APELLIDOS, NOMBRES»), FNAME es lo que va después de la coma, en tipo título;
# sin coma, FNAME es la cadena entera y la revisión lo cuenta como aviso. Es
# cosmético (el saludo), no un dato de análisis.

.CMAIL_RECIPIENTS_MAX_BYTES <- 10 * 1024^2
.CMAIL_RECIPIENTS_MAX_ROWS <- 50000L
.CMAIL_SAMPLE_SIZE <- 5L
.CMAIL_EMAIL_RE <- "^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$"

.cmail_recipients_dir <- function(session) file.path(session$dir, "mail_recipients")
.cmail_recipients_path <- function(session) file.path(.cmail_recipients_dir(session), "recipients.rds")

.cmail_norm_header <- function(x) {
  x <- stringi::stri_trans_general(tolower(trimws(as.character(x))), "Latin-ASCII")
  x <- gsub("[^a-z0-9]+", "_", x)
  gsub("^_+|_+$", "", x)
}

.cmail_title_case <- function(x) {
  words <- strsplit(tolower(trimws(x)), "\\s+")[[1]]
  words <- words[nzchar(words)]
  paste(vapply(words, function(w) paste0(toupper(substr(w, 1L, 1L)), substr(w, 2L, nchar(w))), ""), collapse = " ")
}

.cmail_first_name <- function(value, format) {
  value <- trimws(as.character(value %||% ""))
  if (is.na(value) || !nzchar(value)) return(list(name = "", unsplit = FALSE))
  if (identical(format, "apellidos_coma_nombres")) {
    if (grepl(",", value, fixed = TRUE)) {
      after <- trimws(sub("^[^,]*,", "", value))
      return(list(name = .cmail_title_case(after), unsplit = FALSE))
    }
    return(list(name = .cmail_title_case(value), unsplit = TRUE))
  }
  if (identical(toupper(value), value)) value <- .cmail_title_case(value)
  list(name = value, unsplit = FALSE)
}

# ---- lectura ------------------------------------------------------------------

.cmail_read_table <- function(raw, file_name) {
  ext <- tolower(tools::file_ext(file_name %||% ""))
  tmp <- tempfile(fileext = paste0(".", if (nzchar(ext)) ext else "bin"))
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  writeBin(raw, tmp)
  df <- tryCatch({
    if (ext %in% c("xlsx", "xls")) {
      out <- readxl::read_excel(tmp, col_types = "text", .name_repair = "minimal")
      as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
    } else if (ext %in% c("csv", "txt")) {
      first <- readLines(tmp, n = 1L, warn = FALSE, encoding = "UTF-8")
      sep <- if (length(first) && lengths(regmatches(first, gregexpr(";", first))) >
                 lengths(regmatches(first, gregexpr(",", first)))) ";" else ","
      utils::read.csv(tmp, sep = sep, colClasses = "character", check.names = FALSE,
                      fileEncoding = "UTF-8-BOM", na.strings = character(0), strip.white = TRUE)
    } else {
      NULL
    }
  }, error = function(e) e)
  if (is.null(df)) {
    stop_api(415, "E_COLLECTION_MAIL_RECIPIENTS_FORMAT", "Los destinatarios se importan desde un CSV o un XLSX.")
  }
  if (inherits(df, "error")) {
    stop_api(422, "E_COLLECTION_MAIL_RECIPIENTS_UNREADABLE", "No se pudo leer el archivo de destinatarios.",
             details = list(reason = conditionMessage(df)))
  }
  names(df) <- trimws(enc2utf8(as.character(names(df))))
  keep <- nzchar(names(df)) & !duplicated(names(df))
  df <- df[, keep, drop = FALSE]
  df[] <- lapply(df, function(col) { col <- enc2utf8(as.character(col)); col[is.na(col)] <- ""; trimws(col) })
  # Filas completamente vacías (el pie típico de una hoja de Excel) no cuentan.
  if (nrow(df)) df <- df[apply(df, 1L, function(r) any(nzchar(r))), , drop = FALSE]
  if (!ncol(df) || !nrow(df)) {
    stop_api(422, "E_COLLECTION_MAIL_RECIPIENTS_EMPTY", "El archivo no trae destinatarios.")
  }
  if (nrow(df) > .CMAIL_RECIPIENTS_MAX_ROWS) {
    stop_api(413, "E_COLLECTION_MAIL_RECIPIENTS_TOO_MANY",
             sprintf("Máximo %d destinatarios por importación.", .CMAIL_RECIPIENTS_MAX_ROWS))
  }
  rownames(df) <- NULL
  df
}

# ---- mapeo --------------------------------------------------------------------

.cmail_guess_mapping <- function(columns, template) {
  norm <- .cmail_norm_header(columns)
  pick <- function(idx) if (length(idx)) columns[[idx[[1]]]] else NULL
  email <- pick(which(grepl("(^|_)(correo|email|e_mail|mail)($|_)", norm)))
  exact_name <- which(norm %in% c("nombre", "nombres", "first_name", "primer_nombre"))
  name <- pick(if (length(exact_name)) exact_name else which(grepl("nombre", norm)))
  fields <- list()
  for (f in template$fields %||% list()) {
    key <- as.character(f$key)
    label <- .cmail_norm_header(f$label %||% key)
    hit <- which(norm == key | norm == label | norm == tolower(as.character(f$tag)))
    if (!length(hit)) hit <- which(grepl(paste0("(^|_)", key, "($|_)"), norm))
    col <- pick(hit)
    if (!is.null(col)) fields[[key]] <- col
  }
  list(email_column = email, name_column = name, name_format = .cmail_name_format(name), fields = fields)
}

.cmail_name_format <- function(name_column) {
  if (!is.null(name_column) && grepl("apellido", .cmail_norm_header(name_column))) "apellidos_coma_nombres" else "nombre"
}

.cmail_mapping_validate <- function(mapping, columns, template) {
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
  fmt <- .cmail_one(mapping$name_format) %||% .cmail_name_format(name)
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
    if (!is.null(col)) fields[[k]] <- col
  }
  if (length(problems)) {
    stop_api(422, "E_COLLECTION_MAIL_MAPPING_INVALID", "El mapeo de columnas no calza con el archivo.",
             details = list(problems = as.list(problems)))
  }
  list(email_column = email, name_column = name, name_format = fmt, fields = fields)
}

# ---- almacenamiento efímero -----------------------------------------------------

.cmail_recipients_load <- function(session) {
  path <- .cmail_recipients_path(session)
  if (!file.exists(path)) return(NULL)
  readRDS(path)
}

.cmail_recipients_save <- function(session, store) {
  dir.create(.cmail_recipients_dir(session), recursive = TRUE, showWarnings = FALSE)
  saveRDS(store, .cmail_recipients_path(session))
  invisible(store)
}

#' Destinatarios efectivos: correo válido, sin duplicados, con FNAME y campos.
#' @keywords internal
.cmail_recipients_resolve <- function(store) {
  df <- store$rows
  m <- store$mapping
  n <- nrow(df)
  email <- if (!is.null(m$email_column)) df[[m$email_column]] else rep("", n)
  valid <- grepl(.CMAIL_EMAIL_RE, email)
  dup <- duplicated(tolower(email)) & valid
  names_info <- lapply(seq_len(n), function(i) {
    .cmail_first_name(if (!is.null(m$name_column)) df[[m$name_column]][[i]] else "", m$name_format)
  })
  keep <- valid & !dup
  list(
    rows = which(keep),
    email = email,
    first_name = vapply(names_info, `[[`, "", "name"),
    unsplit = vapply(names_info, `[[`, NA, "unsplit"),
    counts = list(
      total = as.integer(n),
      valid = as.integer(sum(keep)),
      without_email = as.integer(sum(!nzchar(email))),
      invalid_email = as.integer(sum(nzchar(email) & !valid)),
      duplicated = as.integer(sum(dup)),
      names_unsplit = as.integer(sum(vapply(names_info, `[[`, NA, "unsplit")[keep]))
    )
  )
}

.cmail_recipient_values <- function(store, resolved, i) {
  m <- store$mapping
  fields <- lapply(m$fields, function(col) store$rows[[col]][[i]])
  list(nombre = resolved$first_name[[i]], fields = fields)
}

# Lo único que la UI ve: nunca la columna de correo.
.cmail_recipients_public <- function(store) {
  if (is.null(store)) {
    return(list(ok = TRUE, loaded = FALSE, row_count = 0L, columns = list(), mapping = NULL,
                counts = NULL, sample = list()))
  }
  resolved <- .cmail_recipients_resolve(store)
  rows <- utils::head(resolved$rows, .CMAIL_SAMPLE_SIZE)
  sample <- lapply(seq_along(rows), function(j) {
    v <- .cmail_recipient_values(store, resolved, rows[[j]])
    list(index = as.integer(j), nombre = v$nombre, fields = if (length(v$fields)) v$fields else structure(list(), names = character(0)))
  })
  mapping <- store$mapping
  mapping$fields <- if (length(mapping$fields)) mapping$fields else structure(list(), names = character(0))
  list(
    ok = TRUE,
    loaded = TRUE,
    file_name = store$file_name,
    imported_at = store$imported_at,
    row_count = as.integer(nrow(store$rows)),
    columns = as.list(names(store$rows)),
    mapping = .cmc_drop_nulls_deep(mapping),
    counts = resolved$counts,
    sample = sample
  )
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
                                              content_base64 = NULL, mapping = NULL) {
  session <- session_get(sid)
  template <- .cmail_template_of(.collection_current(session))
  payload <- .cmail_import_payload(file_raw, file_name, content_base64)
  df <- .cmail_read_table(payload$raw, payload$name)
  columns <- names(df)
  mapping <- if (is.null(mapping)) .cmail_guess_mapping(columns, template) else .cmail_mapping_validate(mapping, columns, template)
  store <- list(
    schema = "collection_mail_recipients/v1",
    file_name = payload$name,
    imported_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    rows = df,
    mapping = mapping
  )
  .cmail_recipients_save(session, store)
  .cmail_recipients_public(store)
}

#' Cambia el mapeo de columnas sin volver a subir el archivo.
#' @keywords internal
collection_mail_recipients_mapping_put <- function(sid, mapping) {
  session <- session_get(sid)
  store <- .cmail_recipients_load(session)
  if (is.null(store)) {
    stop_api(409, "E_COLLECTION_MAIL_NO_RECIPIENTS", "Primero importa los destinatarios.")
  }
  template <- .cmail_template_of(.collection_current(session))
  store$mapping <- .cmail_mapping_validate(mapping, names(store$rows), template)
  .cmail_recipients_save(session, store)
  .cmail_recipients_public(store)
}

#' Resumen de los destinatarios, sin correos.
#' @keywords internal
collection_mail_recipients_get <- function(sid) {
  .cmail_recipients_public(.cmail_recipients_load(session_get(sid)))
}

#' Olvida los destinatarios de la sesión.
#' @keywords internal
collection_mail_recipients_delete <- function(sid) {
  session <- session_get(sid)
  unlink(.cmail_recipients_dir(session), recursive = TRUE, force = TRUE)
  .cmail_recipients_public(NULL)
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
    if (!is.null(map_txt) && nzchar(trimws(map_txt))) {
      mapping <- tryCatch(
        jsonlite::fromJSON(map_txt, simplifyVector = FALSE),
        error = function(e) stop_api(422, "E_COLLECTION_MAIL_MAPPING_INVALID", "mapping no es JSON válido.")
      )
    }
    return(list(file_raw = part$value, file_name = part$filename %||% "destinatarios.csv", mapping = mapping))
  }
  body <- .collection_parse_body(req)
  list(file_raw = NULL, file_name = body$file_name, content_base64 = body$content_base64, mapping = body$mapping)
}
