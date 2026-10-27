# collection_mail_logo_blanco.R — los logos de la franja oscura en blanco
# (loop editor de correos, L1; Acreditación Institucional 2026: el logo de la
# PUCP azul se recoloreó a blanco fuera de la app para ponerlo sobre el azul).
#
# Cabecera `logos` con `background = "dark"` y `logo_tone = "blanco"`: cada logo
# se deriva a un PNG blanco con alfa. Lo oscuro del archivo pasa a blanco opaco
# y lo claro a transparente, así un logo con fondo blanco (sin alfa) no sale
# como un rectángulo blanco: alfa = (1 − luminancia) / (1 − tinta), donde la
# tinta es la luminancia más oscura del logo, y se multiplica por el alfa del
# archivo. Es una silueta: un logo de varios colores sale de un solo blanco.
#
# El derivado se escribe en tempdir con un id `<id>-blanco-<huella>` (la huella
# cambia con el archivo), viaja en el ZIP como una imagen más y el original
# queda `superseded` si nadie más lo usa (como un recorte, collection_mail_recorte.R).
# Sin `logo_tone`, o con "original", la franja sale como antes.

.CMAIL_LOGO_TONES <- c("original", "blanco")

#' ¿La franja de esta plantilla lleva los logos en blanco?
#' @keywords internal
.cmail_logos_blancos <- function(template) {
  h <- template$header %||% list()
  identical(.cmail_one(h$kind), "logos") && identical(.cmail_one(h$background), "dark") &&
    identical(.cmail_one(h$logo_tone), "blanco")
}

# Silueta blanca de un arreglo de píxeles (gris, gris+alfa, RGB o RGBA en 0..1).
.cmail_white_silhouette <- function(px) {
  h <- dim(px)[1]; w <- dim(px)[2]
  nc <- if (length(dim(px)) == 2L) 1L else dim(px)[3]
  lum <- if (nc <= 2L) (if (nc == 1L) px else px[, , 1]) else 0.2126 * px[, , 1] + 0.7152 * px[, , 2] + 0.0722 * px[, , 3]
  alpha_src <- if (nc %in% c(2L, 4L)) px[, , nc] else matrix(1, h, w)
  opacos <- lum[alpha_src > 0.98]
  ink <- if (length(opacos)) min(opacos) else min(lum)
  a <- pmin(1, pmax(0, (1 - lum) / max(1e-6, 1 - ink))) * alpha_src
  out <- array(1, c(h, w, 4L))
  out[, , 4] <- a
  out
}

.cmail_logo_white_file <- function(img) {
  sello <- substr(sub("^sha256:", "", collection_fingerprint(list(unname(tools::md5sum(img$path)), "blanco"))), 1L, 6L)
  id <- sprintf("%s-blanco-%s", img$id, sello)
  dir <- file.path(tempdir(), "prosecnur-cmail-logos-blancos")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir, sprintf("%s.png", id))
  if (!file.exists(path)) {
    raw <- readBin(img$path, "raw", file.info(img$path)$size)
    px <- .cmail_decode(raw, img$type)
    if (is.null(px)) return(NULL)
    writeBin(.cmail_encode(.cmail_white_silhouette(px), "png"), path)
  }
  list(id = id, path = path, type = "png", size = img$size,
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = img$alt %||% "",
       export_name = sprintf("%s.png", id), whitened_from = img$id)
}

#' Suma los logos blancos a las imágenes resueltas; cada original anota su
#' derivado en `white`.
#' @keywords internal
.cmail_logo_white_apply <- function(template, images) {
  if (!.cmail_logos_blancos(template)) return(images)
  ids <- as.character(unlist(template$header$logo_ids %||% list(), use.names = FALSE))
  for (id in unique(ids)) {
    img <- images[[id]]
    if (is.null(img) || is.null(img$path) || !file.exists(img$path) || !is.null(img$white)) next
    entry <- .cmail_logo_white_file(img)
    if (is.null(entry)) next
    images[[entry$id]] <- entry
    images[[id]]$white <- entry$id
    # Un logo que sólo va en la franja no viaja en su versión original.
    otros <- vapply(template$blocks %||% list(), function(b) {
      any(vapply(c("image_ref", "left", "right", "mobile_ref"), function(k) identical(.cmail_one(b[[k]]), id), logical(1)))
    }, logical(1))
    if (!any(otros)) images[[id]]$superseded <- TRUE
  }
  images
}

#' El logo que dibuja la franja: su versión blanca si corresponde.
#' @keywords internal
.cmail_header_logo <- function(ctx, id, blancos) {
  img <- ctx$images[[id]]
  if (isTRUE(blancos) && !is.null(img$white) && !is.null(ctx$images[[img$white]])) ctx$images[[img$white]] else img
}
