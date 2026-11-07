# Cómo entrega el backend un archivo al cliente (descargas unificadas, fase 1).
#
# Antes cada router armaba `Content-Disposition` con `sprintf()`: un nombre con
# tilde viajaba sin `filename*` y el navegador lo mutilaba, una comilla rompía
# la cabecera y varios sitios dejaban pasar el prefijo `<uuid>__` del job.
# Todo `res$setHeader("Content-Disposition", ...)` pasa por aquí
# (test-descargas-entrega.R lo vigila).

# Cabecera `Content-Disposition` con nombre público.
#   modo:     "attachment" | "inline"; cualquier otro valor cae a "attachment".
#   filename: nombre del archivo (no una ruta); se le quita el prefijo interno
#             `<uuid>__` / `<uuid>_` con `.strip_internal_prefix()`.
# Devuelve `<modo>; filename="<ascii>"; filename*=UTF-8''<pct>` (RFC 6266 +
# RFC 5987): el fallback ASCII para clientes viejos y el nombre real en UTF-8.
.content_disposition <- function(modo, filename) {
  modo <- if (is.character(modo) && length(modo) >= 1L && !is.na(modo[[1]]) &&
                modo[[1]] %in% c("attachment", "inline")) modo[[1]] else "attachment"
  nombre <- .descarga_nombre_publico(filename)
  sprintf(
    "%s; filename=\"%s\"; filename*=UTF-8''%s",
    modo,
    .descarga_nombre_ascii(nombre),
    utils::URLencode(nombre, reserved = TRUE)
  )
}

# Nombre público en UTF-8, sin prefijo interno ni caracteres de control.
.descarga_nombre_publico <- function(filename) {
  x <- if (length(filename) >= 1L) as.character(filename[[1]]) else ""
  if (is.na(x)) x <- ""
  x <- enc2utf8(.strip_internal_prefix(x))
  x <- gsub("[[:cntrl:]]+", "", x)
  x <- trimws(x)
  if (!nzchar(x)) "descarga" else x
}

# Fallback ASCII de `filename=`: transliterado, sin comillas dobles ni barras
# invertidas (romperían el quoted-string) y sin otro byte fuera de ASCII.
.descarga_nombre_ascii <- function(nombre) {
  x <- stringi::stri_trans_general(nombre, "Latin-ASCII")
  x <- gsub("[\"\\\\[:cntrl:]]", "", x)
  x <- gsub("[^\\x20-\\x7E]", "_", x, perl = TRUE)
  x <- trimws(x)
  if (!nzchar(x)) "descarga" else x
}

# Directorio de la sesión donde se escriben las piezas de una descarga
# compuesta (p. ej. el paquete de evidencia de Monitoreo). Nunca relativo al
# cwd del proceso R: en la app de escritorio ese cwd no es una carpeta del
# usuario.
.session_downloads_dir <- function(sid, ...) {
  s <- session_get(sid)
  d <- file.path(s$dir, "downloads", ...)
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
  d
}
