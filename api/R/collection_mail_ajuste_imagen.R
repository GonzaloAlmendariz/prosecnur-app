# collection_mail_ajuste_imagen.R — la imagen de producto, sin pasos fuera de la
# app (loop editor de correos, L5 y L11; Acreditación Institucional 2026: la
# tablet del sorteo se achicó agregándole aire transparente y se le quitaron
# los márgenes a mano).
#
# `image_trim = true` (Destacado e Imagen): el render deriva un archivo ajustado
# a la caja del contenido. Con alfa, el contenido es lo que tiene alfa > 0,02;
# sin alfa, lo que no es casi blanco (algún canal < 0,96). El archivo derivado
# (`<id>-t<huella>`) reemplaza al original en ese bloque y el recorte de
# proporción (collection_mail_recorte.R) se aplica después, sobre él. Si el
# contenido ya llega al borde, no se deriva nada.
#
# `image_size` (Destacado): "completa" (sin él) | "tres_cuartos" | "mitad" del
# ancho de su ranura, centrada; el factor también vale en teléfono (no se
# estira a todo el ancho).

.CMAIL_IMAGE_SIZES <- c(completa = 1, tres_cuartos = 0.75, mitad = 0.5)
.CMAIL_TRIM_ALPHA <- 0.02
.CMAIL_TRIM_WHITE <- 0.96

#' Factor del ancho de la imagen de un Destacado.
#' @keywords internal
.cmail_image_size_factor <- function(b) {
  v <- .cmail_one(b$image_size) %||% "completa"
  f <- .CMAIL_IMAGE_SIZES[v]
  if (is.na(f)) 1 else unname(f)
}

#' ¿El bloque pide quitar los márgenes de su imagen?
#' @keywords internal
.cmail_trim_of <- function(b) isTRUE(unlist(b$image_trim)[1])

#' Caja del contenido en píxeles (list(x0, y0, w, h), base 0) o NULL si llega al borde.
#' @keywords internal
.cmail_trim_box <- function(px) {
  h <- dim(px)[1]; w <- dim(px)[2]
  nc <- if (length(dim(px)) == 2L) 1L else dim(px)[3]
  lleno <- if (nc %in% c(2L, 4L)) {
    px[, , nc] > .CMAIL_TRIM_ALPHA
  } else {
    canales <- if (nc == 1L) list(px) else lapply(1:3, function(k) px[, , k])
    Reduce(`|`, lapply(canales, function(m) m < .CMAIL_TRIM_WHITE))
  }
  filas <- which(rowSums(lleno) > 0); cols <- which(colSums(lleno) > 0)
  if (!length(filas) || !length(cols)) return(NULL)
  box <- list(x0 = min(cols) - 1L, y0 = min(filas) - 1L, w = max(cols) - min(cols) + 1L, h = max(filas) - min(filas) + 1L)
  if (box$w == w && box$h == h) NULL else box
}

#' La imagen sin márgenes: su entrada derivada, o la misma si no hay nada que quitar.
#' @keywords internal
.cmail_trim_file <- function(img) {
  sello <- substr(sub("^sha256:", "", collection_fingerprint(list(unname(tools::md5sum(img$path)), "trim"))), 1L, 6L)
  dir <- file.path(tempdir(), "prosecnur-cmail-ajustes")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  raw <- readBin(img$path, "raw", file.info(img$path)$size)
  px <- .cmail_decode(raw, img$type)
  if (is.null(px)) return(NULL)
  box <- .cmail_trim_box(px)
  if (is.null(box)) return(NULL)
  id <- sprintf("%s-t%dx%d-%s", img$id, box$w, box$h, sello)
  ext <- if (identical(img$type, "jpeg")) "jpg" else "png"
  path <- file.path(dir, sprintf("%s.%s", id, ext))
  if (!file.exists(path)) {
    rows <- (box$y0 + 1L):(box$y0 + box$h); cols <- (box$x0 + 1L):(box$x0 + box$w)
    cut <- if (is.matrix(px)) px[rows, cols, drop = FALSE] else px[rows, cols, , drop = FALSE]
    writeBin(.cmail_encode(cut, img$type), path)
  }
  list(id = id, path = path, type = img$type, size = list(width = box$w, height = box$h),
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = img$alt %||% "",
       export_name = sprintf("%s.%s", id, ext), trimmed_from = img$id)
}

#' Deriva (una vez por imagen) la versión sin márgenes y la anota en `trimmed`.
#' Devuelve las imágenes y el id de la imagen que el bloque usa de verdad.
#' @keywords internal
.cmail_trim_apply_one <- function(images, id) {
  img <- images[[id]]
  if (is.null(img) || is.null(img$path) || !file.exists(img$path)) return(list(images = images, id = id))
  if (is.null(img$trimmed)) {
    entry <- .cmail_trim_file(img)
    images[[id]]$trimmed <- if (is.null(entry)) "" else entry$id
    if (!is.null(entry)) images[[entry$id]] <- entry
  }
  tid <- images[[id]]$trimmed
  list(images = images, id = if (nzchar(tid)) tid else id)
}

#' La imagen de la que parte un bloque: la sin márgenes si la pide y existe.
#' @keywords internal
.cmail_block_source_id <- function(b, images, id) {
  if (!.cmail_trim_of(b)) return(id)
  tid <- images[[id]]$trimmed
  if (!is.null(tid) && nzchar(tid) && !is.null(images[[tid]])) tid else id
}
