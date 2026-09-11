# La PORTADA del sistema Pulso PDF.
#
# Ningún reporte del repositorio tenía portada: todos abrían por la cabecera de
# la primera página. Un entregable que sale del equipo hacia un cliente sí la
# necesita, y Gonzalo la pidió explícitamente el 2026-09-11 —«apaisado, portada
# pero editable desde la UI»—.
#
# **Todo campo es un OVERRIDE OPT-IN.** El motor deriva un valor por defecto de
# lo que ya sabe (el título del reporte, el periodo de campo, la fecha de corte)
# y lo que venga escrito desde la UI gana. Es la regla de la casa: cada
# comportamiento automático tiene que ser visible, explicado y sobreescribible.
# Por eso `pulso_pdf_portada_normalizar()` recibe los defectos y los valores del
# usuario por separado, y no un solo saco donde ya no se distinguen.

#' Normaliza los campos de una portada mezclando defectos del motor y lo escrito
#' en la UI.
#'
#' @param defectos lista con lo que el motor derivó.
#' @param usuario lista con lo que se escribió en la UI; cada campo no vacío
#'   pisa al defecto. Un campo en blanco NO borra el defecto: para vaciar un
#'   campo se apaga la portada o se escribe un guion.
#' @return lista con `titulo`, `subtitulo`, `cliente`, `periodo`, `corte` y
#'   `nota`, todos `character(1)`.
#' @export
pulso_pdf_portada_normalizar <- function(defectos = list(), usuario = list()) {
  campos <- c("titulo", "subtitulo", "cliente", "periodo", "corte", "nota")
  texto <- function(x) {
    if (is.null(x) || !length(x)) return("")
    v <- trimws(as.character(x)[[1L]])
    if (is.na(v)) "" else v
  }
  out <- lapply(campos, function(k) {
    del_usuario <- texto(usuario[[k]])
    if (nzchar(del_usuario)) del_usuario else texto(defectos[[k]])
  })
  names(out) <- campos
  out
}

#' Dibuja una portada apaisada en la página actual.
#'
#' Estructura: banda navy a la izquierda con el logo, y a la derecha el título,
#' el subtítulo y un bloque de metadatos rotulado. La banda ocupa un tercio y no
#' la mitad: con la mitad, un título de tres líneas queda encajonado.
#'
#' @param portada salida de `pulso_pdf_portada_normalizar()`.
#' @param destacados lista de `list(rotulo=, valor=)` para la franja inferior
#'   (opcional): las tres cifras que el cliente busca antes de pasar de página.
#' @export
pulso_pdf_portada <- function(portada, tokens = pulso_pdf_tokens(),
                              ty = pulso_pdf_type(), geo = pulso_pdf_geo("landscape"),
                              destacados = list()) {
  m <- geo$margin
  banda <- 0.30

  grid::grid.rect(x = 0, y = 0, width = 1, height = 1, just = c("left", "bottom"),
                  gp = grid::gpar(fill = tokens$surface, col = NA))
  grid::grid.rect(x = 0, y = 0, width = banda, height = 1, just = c("left", "bottom"),
                  gp = grid::gpar(fill = tokens$navy, col = NA))

  # El logo va sobre la banda navy, así que se dibuja en su versión de texto
  # blanco si el PNG no carga: el fallback del kit escribe en navy y sobre navy
  # no se vería.
  if (!.pulso_pdf_portada_logo(banda / 2, 0.86, geo = geo)) {
    grid::grid.text("PULSO PUCP", x = banda / 2, y = 0.86, just = c("centre", "centre"),
                    gp = grid::gpar(col = "#ffffff", fontsize = 13, fontface = "bold"))
  }

  izq <- banda + 0.055
  ancho <- 1 - izq - m

  .form_pdf_text(portada$titulo, x = izq, y = 0.800, w = ancho,
                 chars = pulso_pdf_chars(ancho, factor = 46), fontsize = 30,
                 fontface = "bold", col = tokens$navy, line_h = 0.058)

  if (nzchar(portada$subtitulo)) {
    .form_pdf_text(portada$subtitulo, x = izq, y = 0.630, w = ancho,
                   chars = pulso_pdf_chars(ancho, factor = 95), fontsize = 13,
                   col = tokens$soft, line_h = 0.028)
  }

  grid::grid.lines(x = grid::unit(c(izq, izq + 0.085), "npc"), y = grid::unit(0.565, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 2.4))

  # Los metadatos van APILADOS y no en tres columnas. En columnas, «Pontificia
  # Universidad Católica del Perú» mide más que su tercio y se monta sobre el
  # periodo de al lado; repartir por ancho medido tampoco sirve, porque el campo
  # lo escribe el usuario y su largo no se conoce al maquetar.
  meta <- list(
    list("Preparado para", portada$cliente),
    list("Periodo de campo", portada$periodo),
    list("Datos al", portada$corte)
  )
  meta <- Filter(function(p) nzchar(p[[2L]]), meta)
  y <- 0.490
  for (p in meta) {
    grid::grid.text(toupper(p[[1L]]), x = izq, y = y, just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$caption, fontface = "bold"))
    .form_pdf_text(p[[2L]], x = izq, y = y - 0.014, w = ancho,
                   chars = pulso_pdf_chars(ancho, factor = 110), fontsize = 11.5,
                   col = tokens$ink, line_h = 0.026)
    y <- y - 0.082
  }

  if (length(destacados)) {
    ancho_k <- (ancho - 0.018 * (length(destacados) - 1L)) / length(destacados)
    for (k in seq_along(destacados)) {
      d <- destacados[[k]]
      x0 <- izq + (k - 1L) * (ancho_k + 0.018)
      pulso_pdf_panel(x0, 0.085, ancho_k, 0.145, tokens = tokens, fill = tokens$canvas,
                      col = tokens$rule)
      grid::grid.text(toupper(d$rotulo), x = x0 + 0.016, y = 0.205, just = c("left", "top"),
                      gp = grid::gpar(col = tokens$soft, fontsize = ty$caption, fontface = "bold"))
      grid::grid.text(d$valor, x = x0 + 0.016, y = 0.112, just = c("left", "bottom"),
                      gp = grid::gpar(col = tokens$navy, fontsize = 22, fontface = "bold"))
    }
  }

  if (nzchar(portada$nota)) {
    .form_pdf_text(portada$nota, x = izq, y = 0.062, w = ancho,
                   chars = pulso_pdf_chars(ancho, factor = 150), fontsize = ty$caption,
                   col = tokens$faint, line_h = 0.020)
  }
  invisible(NULL)
}

# El logo sobre fondo navy: mismo dibujo que el del kit, pero sin el fallback en
# navy. Devuelve TRUE si pudo pintar la imagen.
.pulso_pdf_portada_logo <- function(x, y, geo = pulso_pdf_geo("landscape"), width_npc = 0.170) {
  path <- .pulso_pdf_logo_path()
  if (is.na(path) || !requireNamespace("png", quietly = TRUE)) return(FALSE)
  img <- tryCatch(png::readPNG(path), error = function(e) NULL)
  if (is.null(img)) return(FALSE)
  img_h <- dim(img)[1]; img_w <- dim(img)[2]
  h_npc <- width_npc * (img_h / img_w) * (geo$page_w / geo$page_h)
  # El logo canónico es oscuro sobre transparente; sobre la banda navy se pinta
  # su silueta en blanco usando el canal alfa, que es lo que hace el manual de
  # marca para fondos oscuros.
  if (length(dim(img)) == 3L && dim(img)[3L] == 4L) {
    alpha <- img[, , 4L]
    blanco <- array(1, dim = c(img_h, img_w, 4L))
    blanco[, , 4L] <- alpha
    img <- blanco
  }
  grid::grid.raster(img, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                    just = c("centre", "centre"), interpolate = TRUE,
                    width = grid::unit(width_npc, "npc"), height = grid::unit(h_npc, "npc"))
  TRUE
}
