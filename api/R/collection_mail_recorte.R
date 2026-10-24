# collection_mail_recorte.R — recorte de la foto a una proporción fija (GOAL
# editor de correos profesional, L7; benchmark §8, reglas 1 y 2).
#
#   crop { ratio?, x?, y?, zoom? }      en la foto de una sección (`.CMAIL_PHOTO_TYPES`) y de un bloque Imagen
#
# `ratio` es cerrado: original · 1:1 · 4:3 · 2:1 · 16:9. Sin `crop`, la
# proporción de la maqueta aprobada: en un Destacado 1:1 con la foto a un lado
# y 2:1 arriba; en Pasos 2:1; en Cita y Contacto (retratos) 1:1; en un bloque
# Imagen, «original»: ningún correo de antes cambia.
# `x` e `y` (0 a 1) son el centro del encuadre; `zoom` (1 a 3) acerca.
#
# **El recorte es del archivo, no de CSS.** `object-fit` no existe en Outlook ni
# en Gmail: el render recorta los píxeles y guarda un archivo derivado con su
# propio id (`<id>-r<w>x<h>-<huella>`), que viaja en el ZIP como cualquier
# imagen. No se reescala: el recorte conserva la resolución del original, así
# que la nitidez se mide sobre él. Si nadie más usa el original, no viaja.
#
# Sin archivo (sólo URL, como en SurveyMonkey) no se puede recortar: la foto
# sale entera, a su proporción, y la revisión no lo marca como error.
#
# **Retratos redondos horneados (L13).** Outlook ignora `border-radius`: el
# retrato de Cita y Contacto salía cuadrado. Su recorte se guarda como PNG con
# el círculo en el canal alfa (borde suavizado), así se ve redondo sobre
# cualquier fondo y en cualquier cliente. Sólo cuando el recorte es cuadrado
# (con «original» la foto no es un círculo y queda el CSS). Un PNG sin pérdida
# de toda la resolución pesaba ~2 MB y bloqueaba el ZIP de Mailchimp: el
# retrato se reduce antes a 2× lo que se muestra (`.CMAIL_PORTRAIT_PX`, 192 px).

.CMAIL_CROP_RATIOS <- c(original = NA_real_, "1:1" = 1, "4:3" = 4 / 3, "2:1" = 2, "16:9" = 16 / 9)
.CMAIL_CROP_KEYS <- c("ratio", "x", "y", "zoom")
.CMAIL_CROP_ZOOM_MAX <- 3

# ---- validación ---------------------------------------------------------------

.cmail_crop_problems <- function(crop, path) {
  if (!is.list(crop) || (length(crop) && is.null(names(crop)))) {
    return(list(.cmail_problem(path, "bad_crop", "crop es un objeto con ratio, x, y y zoom.")))
  }
  out <- list()
  push <- function(prop, code, detail) out[[length(out) + 1L]] <<- .cmail_problem(paste0(path, ".", prop), code, detail)
  for (k in setdiff(names(crop), .CMAIL_CROP_KEYS)) push(k, "unknown_key", sprintf("`%s` no pertenece al recorte.", k))
  if (!is.null(crop$ratio)) {
    v <- .cmail_one(crop$ratio)
    if (is.null(v) || !(v %in% names(.CMAIL_CROP_RATIOS))) {
      push("ratio", "bad_crop_ratio", sprintf("ratio es %s.", paste(names(.CMAIL_CROP_RATIOS), collapse = ", ")))
    }
  }
  num <- function(k, lo, hi) {
    if (is.null(crop[[k]])) return()
    v <- suppressWarnings(as.numeric(unlist(crop[[k]])))
    if (length(v) != 1L || is.na(v) || v < lo || v > hi) push(k, paste0("bad_crop_", k), sprintf("%s va de %s a %s.", k, lo, hi))
  }
  num("x", 0, 1); num("y", 0, 1); num("zoom", 1, .CMAIL_CROP_ZOOM_MAX)
  out
}

# ---- geometría ----------------------------------------------------------------

#' El recorte efectivo de un Destacado: NULL si va «original».
#' @keywords internal
.cmail_crop_of <- function(b) {
  crop <- if (is.list(b$crop)) b$crop else list()
  type <- .cmail_one(b$type) %||% ""
  defecto <- switch(type,
    feature = if (identical(.cmail_style(b, "layout", "izquierda"), "arriba")) "2:1" else "1:1",
    steps = "2:1", quote = , contact = "1:1",
    "original")
  ratio <- .cmail_one(crop$ratio) %||% defecto
  if (identical(ratio, "original") || !(ratio %in% names(.CMAIL_CROP_RATIOS))) return(NULL)
  num <- function(k, default) {
    v <- suppressWarnings(as.numeric(unlist(crop[[k]])))
    if (length(v) == 1L && !is.na(v)) v else default
  }
  list(ratio = ratio, r = .CMAIL_CROP_RATIOS[[ratio]],
       x = min(1, max(0, num("x", 0.5))), y = min(1, max(0, num("y", 0.5))),
       zoom = min(.CMAIL_CROP_ZOOM_MAX, max(1, num("zoom", 1))))
}

#' Rectángulo del recorte en píxeles del original: list(x0, y0, w, h).
#' @keywords internal
.cmail_crop_rect <- function(size, crop) {
  W <- as.numeric(size$width); H <- as.numeric(size$height)
  if (W / H > crop$r) { h <- H / crop$zoom; w <- h * crop$r } else { w <- W / crop$zoom; h <- w / crop$r }
  w <- max(1L, as.integer(floor(w))); h <- max(1L, as.integer(floor(h)))
  # Media hacia arriba, como Math.round del editor (round() de R va al par: 244.5 -> 244).
  x0 <- as.integer(floor(min(max(crop$x * W - w / 2, 0), W - w) + 0.5))
  y0 <- as.integer(floor(min(max(crop$y * H - h / 2, 0), H - h) + 0.5))
  list(x0 = x0, y0 = y0, w = w, h = h)
}

.cmail_crop_key <- function(rect, round = FALSE) sprintf("%d-%d-%d-%d%s", rect$x0, rect$y0, rect$w, rect$h, if (round) "-c" else "")

# ¿El recorte de este bloque se hornea redondo? Retratos de Cita y Contacto, recortados en cuadrado.
.cmail_crop_round <- function(b, crop) {
  isTRUE((.cmail_one(b$type) %||% "") %in% c("quote", "contact")) && !is.null(crop) && isTRUE(crop$r == 1)
}

# El recorte con el círculo en el canal alfa: 1 dentro, 0 fuera, medio píxel suavizado en el borde.
.cmail_circle_alpha <- function(px) {
  h <- dim(px)[1]; w <- dim(px)[2]
  nc <- if (length(dim(px)) == 2L) 1L else dim(px)[3]
  # Gris (1 o 2 canales) se repite en los tres; el alfa de origen (canal 2 o 4) se conserva.
  rgb <- if (nc <= 2L) array(rep(if (nc == 1L) px else px[, , 1], 3L), c(h, w, 3L)) else px[, , 1:3, drop = FALSE]
  cx <- (w + 1) / 2; cy <- (h + 1) / 2; r <- min(w, h) / 2
  d <- sqrt(outer((seq_len(h) - cy)^2, (seq_len(w) - cx)^2, `+`))
  a <- pmin(1, pmax(0, r - d + 0.5))
  if (nc %in% c(2L, 4L)) a <- a * px[, , nc]
  out <- array(0, c(h, w, 4L))
  out[, , 1:3] <- rgb
  out[, , 4] <- a
  out
}

# ---- archivos derivados ----------------------------------------------------------

# Escribe (o reutiliza) el recorte de `img` y devuelve su entrada de imagen.
# `round`: el círculo horneado en un PNG con alfa (retratos, L13).
.cmail_crop_file <- function(img, rect, round = FALSE) {
  # La huella cambia con el archivo y con el rectángulo: subir otra foto con el mismo id no reusa un recorte viejo.
  sello <- substr(sub("^sha256:", "", collection_fingerprint(list(unname(tools::md5sum(img$path)), .cmail_crop_key(rect, round)))), 1L, 6L)
  # El retrato redondo se reduce a 2× lo que se muestra: un PNG sin pérdida más grande no cabe en el ZIP.
  lado <- if (round) as.integer(min(rect$w, 2L * .CMAIL_PORTRAIT_PX)) else NULL
  size <- if (round) list(width = lado, height = lado) else list(width = rect$w, height = rect$h)
  id <- sprintf("%s-r%dx%d%s-%s", img$id, size$width, size$height, if (round) "c" else "", sello)
  type <- if (round) "png" else img$type
  ext <- if (identical(type, "jpeg")) "jpg" else "png"
  dir <- file.path(tempdir(), "prosecnur-cmail-recortes")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  path <- file.path(dir, sprintf("%s.%s", id, ext))
  if (!file.exists(path)) {
    raw <- readBin(img$path, "raw", file.info(img$path)$size)
    px <- .cmail_decode(raw, img$type)
    if (is.null(px)) return(NULL)
    rows <- (rect$y0 + 1L):(rect$y0 + rect$h)
    cols <- (rect$x0 + 1L):(rect$x0 + rect$w)
    cut <- if (is.matrix(px)) px[rows, cols, drop = FALSE] else px[rows, cols, , drop = FALSE]
    if (round) {
      if (lado < rect$w) cut <- .cmail_resample_image(cut, lado, lado)
      cut <- .cmail_circle_alpha(cut)
    }
    writeBin(.cmail_encode(cut, type), path)
  }
  list(id = id, path = path, type = type, size = size,
       bytes = as.numeric(file.info(path)$size), url = NULL, alt = img$alt %||% "",
       export_name = sprintf("%s.%s", id, ext), cropped_from = img$id)
}

#' Suma los recortes de los Destacados a las imágenes resueltas. Cada original
#' recortado anota sus recortes (`crops`, por rectángulo); si nadie más lo usa,
#' queda `superseded` y no entra al ZIP.
#' @keywords internal
.cmail_crop_apply <- function(template, images) {
  usados_enteros <- character(0)
  h <- template$header %||% list()
  usados_enteros <- c(usados_enteros, if (identical(h$kind, "banner")) as.character(h$image_ref) else
    as.character(unlist(h$logo_ids %||% list(), use.names = FALSE)))
  recortados <- character(0)
  for (b in template$blocks %||% list()) {
    type <- .cmail_one(b$type) %||% ""
    if (identical(type, "two_images")) usados_enteros <- c(usados_enteros, as.character(c(.cmail_one(b$left), .cmail_one(b$right))))
    # La versión del celular no se recorta: viaja entera.
    if (identical(type, "image") && !is.null(.cmail_mobile_ref(b))) usados_enteros <- c(usados_enteros, .cmail_mobile_ref(b))
    if (!(type %in% c(.CMAIL_PHOTO_TYPES, "image"))) next
    id <- .cmail_one(b$image_ref)
    img <- if (!is.null(id)) images[[id]] else NULL
    crop <- .cmail_crop_of(b)
    if (is.null(img) || is.null(crop) || is.null(img$path) || !file.exists(img$path) || !.cmail_size_ok(img$size)) {
      if (!is.null(id)) usados_enteros <- c(usados_enteros, id)
      next
    }
    rect <- .cmail_crop_rect(img$size, crop)
    round <- .cmail_crop_round(b, crop)
    key <- .cmail_crop_key(rect, round)
    if (is.null(images[[id]]$crops[[key]])) {
      entry <- .cmail_crop_file(img, rect, round)
      if (is.null(entry)) { usados_enteros <- c(usados_enteros, id); next }
      images[[entry$id]] <- entry
      images[[id]]$crops[[key]] <- entry$id
    }
    recortados <- c(recortados, id)
  }
  for (id in setdiff(unique(recortados), usados_enteros)) images[[id]]$superseded <- TRUE
  images
}

#' La imagen que muestra un bloque con `image_ref` (una sección o una Imagen): su
#' recorte si existe; si no, la original.
#' @keywords internal
.cmail_feature_img <- function(b, ctx) {
  id <- as.character(.cmail_one(b$image_ref) %||% "")
  img <- ctx$images[[id]] %||% .cmail_image_placeholder(id)
  crop <- .cmail_crop_of(b)
  if (is.null(crop) || !.cmail_size_ok(img$size)) return(list(img = img, crop = crop))
  key <- .cmail_crop_key(.cmail_crop_rect(img$size, crop), .cmail_crop_round(b, crop))
  cut <- img$crops[[key]]
  list(img = if (!is.null(cut) && !is.null(ctx$images[[cut]])) ctx$images[[cut]] else img, crop = crop)
}
