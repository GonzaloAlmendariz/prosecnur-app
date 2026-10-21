# collection_mail_images.R — imágenes del correo: logos (`brand_logo`) e
# imágenes de línea gráfica (`mail_image`, ADR 0110 §B).
#
# - Se suben por /api/files/upload con kind `mail_image`: PNG o JPEG (GIF fuera),
#   hasta 1 MB y de 40 a 1.200 px de ancho. El tipo se lee de los bytes, no de la
#   extensión; el `.ext` guardado es el real (png / jpg).
# - Se nombran por el slug de su nombre original, como los logos. Al resolver un
#   id gana el `mail_image` más reciente de ese slug; si no hay, el `brand_logo`.
# - Viajan en el `.pulso` (`.cmail_image_fids`, el vigente de cada slug).
# - Los ids de imagen siguen `^[a-z0-9][a-z0-9-]{0,59}$`, sin `_`: Mailchimp usa el
#   nombre de archivo tal cual al importar el ZIP (H-i).

.CMAIL_IMAGE_ID_RE <- "^[a-z0-9][a-z0-9-]{0,59}$"
.CMAIL_IMAGE_MAX_BYTES <- 1024L * 1024L
.CMAIL_IMAGE_WARN_BYTES <- 200L * 1024L
.CMAIL_IMAGE_MIN_W <- 40L
.CMAIL_IMAGE_MAX_W <- 1200L
# Marcador del alt que falta (lo deja el importador en un bloque imagen). Se
# admite al guardar para no bloquear la edición, pero `images_alt` lo trata
# como vacío: exportarlo sería publicar un alt falso.
.CMAIL_ALT_MARKER <- "[Describe la imagen]"

.cmail_alt_missing <- function(alt) {
  a <- trimws(as.character(alt %||% ""))
  !nzchar(a) || identical(a, .CMAIL_ALT_MARKER)
}

.cmail_image_id_ok <- function(x) {
  is.character(x) && length(x) == 1L && !is.na(x) && grepl(.CMAIL_IMAGE_ID_RE, x)
}

# Tipo por los primeros bytes: "png", "jpeg" o NULL.
.cmail_image_type_raw <- function(raw) {
  if (length(raw) >= 8L && identical(raw[1:8], as.raw(c(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))) return("png")
  if (length(raw) >= 3L && identical(raw[1:3], as.raw(c(0xff, 0xd8, 0xff)))) return("jpeg")
  NULL
}

.cmail_png_size_raw <- function(raw) {
  if (length(raw) < 24L || !identical(.cmail_image_type_raw(raw), "png")) return(NULL)
  int32 <- function(b) sum(as.integer(b) * c(16777216, 65536, 256, 1))
  list(width = int32(raw[17:20]), height = int32(raw[21:24]))
}

# Medidas de un JPEG: recorre los segmentos hasta el primer SOF (baseline,
# progresivo o sin pérdida) y lee alto y ancho. R puro, sin dependencias.
.cmail_jpeg_size_raw <- function(raw) {
  n <- length(raw)
  if (n < 4L || !identical(.cmail_image_type_raw(raw), "jpeg")) return(NULL)
  b <- as.integer(raw)
  sof <- c(0xc0:0xc3, 0xc5:0xc7, 0xc9:0xcb, 0xcd:0xcf)
  i <- 3L
  while (i + 1L <= n) {
    if (b[[i]] != 0xff) return(NULL)
    marker <- b[[i + 1L]]
    if (marker == 0xff) { i <- i + 1L; next }
    if (marker %in% c(0xd8, 0x01, 0xd0:0xd7)) { i <- i + 2L; next }
    if (i + 3L > n) return(NULL)
    len <- b[[i + 2L]] * 256L + b[[i + 3L]]
    if (marker %in% sof) {
      if (i + 8L > n) return(NULL)
      return(list(height = b[[i + 5L]] * 256L + b[[i + 6L]], width = b[[i + 7L]] * 256L + b[[i + 8L]]))
    }
    if (marker == 0xd9 || len < 2L) return(NULL)
    i <- i + 2L + len
  }
  NULL
}

.cmail_read_raw <- function(path) {
  if (is.null(path) || !nzchar(path) || !file.exists(path)) return(NULL)
  readBin(path, "raw", file.info(path)$size)
}

#' Tipo y medidas de una imagen en disco: list(type, width, height) o NULL.
#' @keywords internal
.cmail_image_info <- function(path) {
  raw <- .cmail_read_raw(path)
  if (is.null(raw)) return(NULL)
  type <- .cmail_image_type_raw(raw)
  if (is.null(type)) return(NULL)
  size <- if (identical(type, "png")) .cmail_png_size_raw(raw) else .cmail_jpeg_size_raw(raw)
  list(type = type, width = size$width, height = size$height, bytes = length(raw))
}

# Compatibilidad: medidas de un PNG (o JPEG) en disco.
.cmail_png_size <- function(path) {
  info <- .cmail_image_info(path)
  if (is.null(info) || is.null(info$width)) return(NULL)
  list(width = info$width, height = info$height)
}

#' Valida una subida `mail_image` y devuelve su extensión real.
#'
#' La llama `save_upload` (io.R) antes de escribir el archivo.
#' @keywords internal
.cmail_image_upload_check <- function(original_name, raw) {
  invalid <- function(reason, msg, extra = list()) {
    stop_api(422, "E_COLLECTION_MAIL_IMAGE_INVALID", msg, details = c(list(reason = reason), extra))
  }
  type <- .cmail_image_type_raw(raw)
  if (is.null(type)) invalid("format", "La imagen del correo es PNG o JPEG.")
  if (length(raw) > .CMAIL_IMAGE_MAX_BYTES) {
    invalid("too_large", "La imagen supera 1 MB; reduce su peso antes de subirla.",
            list(size_bytes = length(raw)))
  }
  size <- if (identical(type, "png")) .cmail_png_size_raw(raw) else .cmail_jpeg_size_raw(raw)
  if (is.null(size)) invalid("unreadable", "No se pudieron leer las medidas de la imagen.")
  if (size$width > .CMAIL_IMAGE_MAX_W || size$width < .CMAIL_IMAGE_MIN_W) {
    invalid("width", sprintf("La imagen mide %d px de ancho; se aceptan de %d a %d px.",
                             as.integer(size$width), .CMAIL_IMAGE_MIN_W, .CMAIL_IMAGE_MAX_W),
            list(width = as.integer(size$width)))
  }
  slug <- .cm_brand_slug(original_name)
  if (!.cmail_image_id_ok(slug)) {
    invalid("name", "El nombre del archivo debe tener letras o números (hasta 60): de él sale el id de la imagen.")
  }
  list(ext = if (identical(type, "png")) "png" else "jpg", type = type, width = size$width, height = size$height,
       image_id = slug)
}

#' Archivo vigente por id de imagen: `mail_image` primero, luego `brand_logo`.
#' @keywords internal
.cmail_image_latest <- function(files, require_file = TRUE) {
  out <- .cm_brand_logo_latest(files, require_file = require_file, kinds = "brand_logo")
  own <- .cm_brand_logo_latest(files, require_file = require_file, kinds = "mail_image")
  for (id in names(own)) out[[id]] <- own[[id]]
  out
}

#' file_id de las imágenes de correo vigentes, para el `.pulso`.
#' @keywords internal
.cmail_image_fids <- function(s) {
  latest <- .cm_brand_logo_latest(s$files, require_file = FALSE, kinds = "mail_image")
  fids <- vapply(latest, function(m) as.character(m$file_id %||% "")[1], character(1))
  unname(fids[!is.na(fids) & nzchar(fids)])
}

# Ids de imagen que usa la plantilla, en orden: cabecera y luego bloques image.
.cmail_image_ids <- function(template) {
  h <- template$header %||% list()
  head <- if (identical(h$kind, "banner")) as.character(h$image_ref) else
    as.character(unlist(h$logo_ids %||% list(), use.names = FALSE))
  blocks <- unlist(lapply(template$blocks %||% list(), function(b) {
    if (identical(b$type, "image")) as.character(.cmail_one(b$image_ref) %||% character(0)) else character(0)
  }), use.names = FALSE)
  unique(c(head, blocks))
}

#' Resuelve las imágenes de la plantilla contra el proyecto.
#'
#' Cada imagen sabe su ruta (si existe), tipo y medidas, su URL pública (si se
#' declaró en `images`), su alt y su nombre de archivo en el ZIP importable.
#' @keywords internal
.cmail_images_resolve <- function(session, template) {
  ids <- .cmail_image_ids(template)
  latest <- .cmail_image_latest(session$files)
  out <- lapply(stats::setNames(ids, ids), function(id) {
    decl <- (template$images %||% list())[[id]] %||% list()
    path <- if (!is.null(latest[[id]])) as.character(latest[[id]]$path)[1] else NULL
    info <- .cmail_image_info(path)
    ext <- if (identical(info$type, "jpeg")) "jpg" else "png"
    list(
      id = id,
      path = path,
      type = info$type,
      size = if (!is.null(info$width)) list(width = info$width, height = info$height),
      bytes = if (!is.null(path)) as.numeric(file.info(path)$size) else NA_real_,
      url = .cmail_one(decl$url),
      alt = .cmail_one(decl$alt) %||% "",
      export_name = sprintf("%s.%s", id, ext)
    )
  })
  # La onda del estilo campaña es una imagen generada (collection_mail_campana.R):
  # viaja en el ZIP como las demás; nunca pisa una imagen del autor con su id.
  onda <- if (!(.CMAIL_ONDA_ID %in% ids)) .cmail_onda_image(template)
  if (!is.null(onda)) out[[.CMAIL_ONDA_ID]] <- onda
  out
}

.cmail_image_placeholder <- function(id) {
  list(id = id, path = NULL, type = NULL, size = NULL, url = NULL, alt = "", export_name = sprintf("%s.png", id))
}

# `src` de una imagen. En export lo decide el dialecto: Mailchimp usa la URL
# https declarada o el nombre RELATIVO del archivo dentro del ZIP importable
# (Mailchimp lo sube y reescribe la ruta); SurveyMonkey, solo la URL https.
# Preview: data URI con el tipo real.
.cmail_image_src <- function(img, ctx) {
  if (isTRUE(ctx$export)) return(.cmail_dialect(ctx)$img_src(img))
  if (!is.null(img$path) && file.exists(img$path)) {
    raw <- readBin(img$path, "raw", file.info(img$path)$size)
    mime <- if (identical(img$type, "jpeg")) "image/jpeg" else "image/png"
    return(paste0("data:", mime, ";base64,", jsonlite::base64_enc(raw)))
  }
  img$url
}
