# collection_mail_reducir.R — la imagen del correo que llega más grande de lo
# que el correo necesita se reduce sola al subirla (2026-10-22).
#
# Los banners que manda el cliente vienen a 1.201 o 3.201 px de ancho y hasta
# 6,6 MB. El correo los muestra a lo sumo a 600 px; el check `image_width` pide
# 2x para pantallas retina, así que 1.200 px (`.CMAIL_IMAGE_MAX_W`) es el tope
# de nitidez y nada más ancho aporta. Reglas:
#
# - Más ancha que 1.200 px → 1.200 px de ancho, alto = round(1200 * alto/ancho):
#   la proporción no se toca.
# - Mismo formato (PNG queda PNG, JPEG queda JPEG). Si un PNG fotográfico sigue
#   pasando de 1 MB a 1.200 px, sale JPEG de calidad 85 y la respuesta lo dice.
# - Remuestreo por promedio de área (box filter exacto con bordes fraccionarios):
#   cada píxel de salida es la media de los de entrada que cubre. Se calcula con
#   sumas prefijo vectorizadas, O(píxeles), sin bucles por píxel. El vecino más
#   cercano pixela el texto de los logos; el promedio de área no.
# - La transparencia se promedia premultiplicada por alfa (sin halos en los
#   bordes de un logo recortado).
# - Lo que ya cumple (≤ 1.200 px y ≤ 1 MB) se guarda byte a byte.

.CMAIL_IMAGE_JPEG_QUALITY <- 0.85
# Tope de decodificación: un PNG de 16 MP ocupa ~512 MB como array double de 4
# canales. Más allá no se intenta leer y se pide una versión más chica.
.CMAIL_IMAGE_MAX_PIXELS <- 16e6
.CMAIL_IMAGE_MAX_UPLOAD_BYTES <- 40L * 1024L * 1024L
.CMAIL_TIMES <- "×"

.cmail_reducir_dims <- function(width, height, max_w = .CMAIL_IMAGE_MAX_W) {
  if (width <= max_w) return(c(width = as.integer(width), height = as.integer(height)))
  c(width = as.integer(max_w), height = max(1L, as.integer(round(max_w * height / width))))
}

# Suma prefijo por filas con una fila de ceros arriba: P[k + 1, ] = sum(A[1:k, ]).
# cumsum sobre el vector column-major y se resta el acumulado de la columna previa.
.cmail_prefix_rows <- function(m) {
  h <- nrow(m)
  cs <- matrix(cumsum(as.vector(m)), nrow = h)
  if (ncol(m) > 1L) cs[, -1L] <- cs[, -1L, drop = FALSE] - rep(cs[h, -ncol(m)], each = h)
  rbind(0, cs)
}

# Promedio de área a lo largo de las filas: h filas → new_h filas.
.cmail_area_rows <- function(m, new_h) {
  h <- nrow(m)
  if (new_h == h) return(m)
  p <- .cmail_prefix_rows(m)
  edges <- seq(0, h, length.out = new_h + 1L)
  # P en posición fraccionaria y: interpolación lineal entre filas enteras de P
  # (exacta: dentro de una fila la masa crece lineal).
  at <- function(y) {
    i0 <- pmin(floor(y), h - 1)
    f <- y - i0
    p[i0 + 1L, , drop = FALSE] * (1 - f) + p[i0 + 2L, , drop = FALSE] * f
  }
  (at(edges[-1L]) - at(edges[-(new_h + 1L)])) / (h / new_h)
}

#' Reduce una matriz (h x w) por promedio de área a (new_h x new_w).
#' @keywords internal
.cmail_area_resample <- function(m, new_w, new_h) {
  r <- .cmail_area_rows(m, new_h)
  t(.cmail_area_rows(t(r), new_w))
}

# Array h x w x c (o matriz gris) → mismo número de canales a new_w x new_h.
# Con alfa (2 o 4 canales) promedia el color premultiplicado.
.cmail_resample_image <- function(img, new_w, new_h) {
  if (is.matrix(img)) return(pmin(pmax(.cmail_area_resample(img, new_w, new_h), 0), 1))
  nc <- dim(img)[3]
  out <- array(0, dim = c(new_h, new_w, nc))
  has_alpha <- nc %in% c(2L, 4L)
  color <- if (has_alpha) seq_len(nc - 1L) else seq_len(nc)
  if (has_alpha) {
    a <- img[, , nc]
    a_out <- .cmail_area_resample(a, new_w, new_h)
    out[, , nc] <- a_out
    safe <- ifelse(a_out > 1e-9, a_out, 1)
    for (k in color) {
      v <- .cmail_area_resample(img[, , k] * a, new_w, new_h) / safe
      v[a_out <= 1e-9] <- 0
      out[, , k] <- v
    }
  } else {
    for (k in color) out[, , k] <- .cmail_area_resample(img[, , k], new_w, new_h)
  }
  out[out < 0] <- 0
  out[out > 1] <- 1
  out
}

# Quita la transparencia componiendo sobre blanco (JPEG no tiene alfa).
.cmail_flatten_white <- function(img) {
  if (is.matrix(img)) return(img)
  nc <- dim(img)[3]
  if (!(nc %in% c(2L, 4L))) return(img)
  a <- img[, , nc]
  color <- seq_len(nc - 1L)
  out <- array(0, dim = c(dim(img)[1:2], length(color)))
  for (k in color) out[, , k] <- img[, , k] * a + (1 - a)
  if (length(color) == 1L) out[, , 1L] else out
}

# Transparencia visible: algún alfa por debajo de 1 en más de medio nivel de 8
# bits (el promedio de un alfa todo opaco puede dar 0.9999999 por redondeo).
.CMAIL_ALPHA_OPAQUE <- 1 - 1 / 510

.cmail_has_transparency <- function(img) {
  if (is.matrix(img)) return(FALSE)
  nc <- dim(img)[3]
  nc %in% c(2L, 4L) && any(img[, , nc] < .CMAIL_ALPHA_OPAQUE)
}

# Un canal alfa todo opaco no aporta nada y pesa un cuarto del PNG: se quita.
.cmail_drop_opaque_alpha <- function(img) {
  if (is.matrix(img) || !(dim(img)[3] %in% c(2L, 4L)) || .cmail_has_transparency(img)) return(img)
  nc <- dim(img)[3]
  if (nc == 2L) img[, , 1L] else img[, , 1:3]
}

.cmail_encode <- function(img, type, quality = .CMAIL_IMAGE_JPEG_QUALITY) {
  if (identical(type, "png")) return(png::writePNG(img))
  jpeg::writeJPEG(.cmail_flatten_white(img), target = raw(), quality = quality)
}

.cmail_decode <- function(raw, type) {
  tryCatch(
    if (identical(type, "png")) png::readPNG(raw) else jpeg::readJPEG(raw),
    error = function(e) NULL
  )
}

.cmail_dims_label <- function(w, h) sprintf("%d%s%d", as.integer(w), .CMAIL_TIMES, as.integer(h))

#' Prepara una subida `mail_image`: valida y, si hace falta, la reduce.
#'
#' Devuelve `list(raw, ext, type, width, height, image_id, reduccion)`, donde
#' `raw` son los bytes que se guardan (los originales si ya cumplía) y
#' `reduccion` describe qué pasó para que el front lo diga. Rechaza con 422
#' `E_COLLECTION_MAIL_IMAGE_INVALID` lo que no es PNG/JPEG, lo ilegible, lo
#' angosto (< 40 px), lo enorme para decodificar y lo que aun reducido pasa de 1 MB.
#' @keywords internal
.cmail_image_upload_prepare <- function(original_name, raw) {
  invalid <- function(reason, msg, extra = list()) {
    stop_api(422, "E_COLLECTION_MAIL_IMAGE_INVALID", msg, details = c(list(reason = reason), extra))
  }
  type <- .cmail_image_type_raw(raw)
  if (is.null(type)) invalid("format", "La imagen del correo es PNG o JPEG.")
  size <- if (identical(type, "png")) .cmail_png_size_raw(raw) else .cmail_jpeg_size_raw(raw)
  if (is.null(size) || !is.finite(size$width) || !is.finite(size$height) || size$height < 1) {
    invalid("unreadable", "No se pudieron leer las medidas de la imagen.")
  }
  w <- as.integer(size$width); h <- as.integer(size$height)
  if (w < .CMAIL_IMAGE_MIN_W) {
    invalid("width", sprintf("La imagen mide %d px de ancho; el correo necesita al menos %d px.", w, .CMAIL_IMAGE_MIN_W),
            list(width = w))
  }
  slug <- .cm_brand_slug(original_name)
  if (!.cmail_image_id_ok(slug)) {
    invalid("name", "El nombre del archivo debe tener letras o números (hasta 60): de él sale el id de la imagen.")
  }
  ext_of <- function(t) if (identical(t, "png")) "png" else "jpg"
  bytes_in <- length(raw)
  if (w <= .CMAIL_IMAGE_MAX_W && bytes_in <= .CMAIL_IMAGE_MAX_BYTES) {
    return(list(raw = raw, ext = ext_of(type), type = type, width = w, height = h, image_id = slug,
                reduccion = list(reducida = FALSE, convertida = FALSE, de = .cmail_dims_label(w, h),
                                 a = .cmail_dims_label(w, h), peso_antes = bytes_in, peso_despues = bytes_in,
                                 formato_antes = type, formato_despues = type, aviso = NULL)))
  }
  if (bytes_in > .CMAIL_IMAGE_MAX_UPLOAD_BYTES || as.numeric(w) * as.numeric(h) > .CMAIL_IMAGE_MAX_PIXELS) {
    invalid("too_large", sprintf(
      "La imagen mide %s px y pesa %.1f MB: es demasiado grande para reducirla aquí. Exporta una versión de hasta %d px de ancho y vuelve a subirla.",
      .cmail_dims_label(w, h), bytes_in / 1048576, .CMAIL_IMAGE_MAX_W),
      list(width = w, height = h, size_bytes = bytes_in))
  }
  img <- .cmail_decode(raw, type)
  if (is.null(img)) {
    invalid("unreadable", "No se pudo leer la imagen para reducirla; vuelve a exportarla como PNG o JPEG.")
  }
  dims <- .cmail_reducir_dims(w, h)
  if (dims[["width"]] != w) img <- .cmail_resample_image(img, dims[["width"]], dims[["height"]])
  img <- .cmail_drop_opaque_alpha(img)
  out_type <- type
  out <- .cmail_encode(img, type, quality = if (identical(type, "jpeg")) 0.9 else .CMAIL_IMAGE_JPEG_QUALITY)
  if (identical(type, "jpeg") && length(out) > .CMAIL_IMAGE_MAX_BYTES) out <- .cmail_encode(img, "jpeg")
  aviso <- NULL
  if (length(out) > .CMAIL_IMAGE_MAX_BYTES && identical(type, "png")) {
    transp <- .cmail_has_transparency(img)
    out <- .cmail_encode(img, "jpeg")
    out_type <- "jpeg"
    aviso <- paste0(
      sprintf("A %s px el PNG seguía pesando más de 1 MB; la guardamos como JPEG (calidad 85).",
              .cmail_dims_label(dims[["width"]], dims[["height"]])),
      if (transp) " Las zonas transparentes quedaron en blanco." else "")
  }
  if (length(out) > .CMAIL_IMAGE_MAX_BYTES) {
    invalid("too_large", sprintf(
      "Aun reducida a %s px la imagen pesa %.1f MB; el correo admite hasta 1 MB. Exporta una versión más liviana.",
      .cmail_dims_label(dims[["width"]], dims[["height"]]), length(out) / 1048576),
      list(size_bytes = length(out)))
  }
  list(raw = out, ext = ext_of(out_type), type = out_type,
       width = dims[["width"]], height = dims[["height"]], image_id = slug,
       reduccion = list(reducida = TRUE, convertida = !identical(out_type, type),
                        de = .cmail_dims_label(w, h), a = .cmail_dims_label(dims[["width"]], dims[["height"]]),
                        peso_antes = bytes_in, peso_despues = length(out),
                        formato_antes = type, formato_despues = out_type, aviso = aviso))
}
