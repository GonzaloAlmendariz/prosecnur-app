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
                              destacados = list(), antetitulo = "") {
  pesos <- pulso_pdf_pesos()
  m <- geo$margin
  banda <- 0.365

  grid::grid.rect(x = 0, y = 0, width = 1, height = 1, just = c("left", "bottom"),
                  gp = grid::gpar(fill = tokens$surface, col = NA))
  grid::grid.rect(x = 0, y = 0, width = banda, height = 1, just = c("left", "bottom"),
                  gp = grid::gpar(fill = tokens$navy, col = NA))

  # --- La banda: logo arriba, procedencia abajo -----------------------------
  #
  # La primera versión dejaba la banda con el logo y nada más: un tercio de
  # página en azul vacío, que no es sobriedad sino hueco. Los metadatos viven
  # aquí porque son la FICHA del documento —para quién, de cuándo, con qué
  # datos— y no el mensaje; en la columna blanca competían con el título.
  x_banda <- 0.062
  if (!.pulso_pdf_portada_logo(x_banda, 0.905, geo = geo, just = c("left", "centre"))) {
    grid::grid.text("PULSO PUCP", x = x_banda, y = 0.905, just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$sobre_navy, fontsize = 13, fontface = "bold"))
  }

  meta <- list(
    list("Preparado para", portada$cliente),
    list("Periodo de campo", portada$periodo),
    list("Datos al", portada$corte)
  )
  meta <- Filter(function(p) nzchar(p[[2L]]), meta)
  w_banda <- banda - x_banda - 0.030
  y <- 0.455
  for (p in meta) {
    grid::grid.lines(x = grid::unit(c(x_banda, x_banda + 0.030), "npc"),
                     y = grid::unit(y + 0.034, "npc"),
                     gp = grid::gpar(col = tokens$sobre_navy_tenue, lwd = 0.7))
    grid::grid.text(pulso_pdf_versalitas(p[[1L]]), x = x_banda, y = y + 0.012,
                    just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$sobre_navy_tenue, fontsize = ty$eyebrow,
                                    fontface = "bold"))
    .form_pdf_text(p[[2L]], x = x_banda, y = y - 0.004, w = w_banda,
                   chars = pulso_pdf_chars(w_banda, factor = 108), fontsize = 10.5,
                   col = tokens$sobre_navy, line_h = 0.026)
    y <- y - 0.112
  }

  # --- La columna blanca: antetítulo, título, bajada y las cifras -----------
  izq <- banda + 0.062
  ancho <- 1 - izq - m

  if (nzchar(antetitulo %||% "")) {
    grid::grid.text(pulso_pdf_versalitas(antetitulo), x = izq, y = 0.905,
                    just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }

  # El título NO usa todo el ancho de su columna: se le da el 78 %, para que
  # rompa en dos líneas parejas en vez de dejar una sola palabra colgando. Un
  # título compuesto se mide por el equilibrio de sus líneas, no por cuántas
  # palabras caben en la primera.
  w_titulo <- ancho * 0.78
  .form_pdf_text(portada$titulo, x = izq, y = 0.735, w = w_titulo,
                 chars = pulso_pdf_chars(w_titulo, factor = 44), fontsize = 27,
                 fontface = "bold", col = tokens$navy, line_h = 0.054)

  grid::grid.lines(x = grid::unit(c(izq, izq + 0.062), "npc"), y = grid::unit(0.565, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 2.4))

  if (nzchar(portada$subtitulo)) {
    .form_pdf_text(portada$subtitulo, x = izq, y = 0.530, w = ancho,
                   chars = pulso_pdf_chars(ancho, factor = 95), fontsize = 12,
                   col = tokens$soft, line_h = 0.028)
  }

  # Las cifras van SIN tarjeta: en la página 2 el panel las agrupa entre otras
  # cinco, pero en una portada una caja con relleno se lee como un recorte
  # pegado. Aquí las separa una hairline y las ordena el mismo aire.
  if (length(destacados)) {
    pulso_pdf_hairline(izq, izq + ancho, 0.250, tokens = tokens, lwd = pesos$bloque)
    ancho_k <- ancho / length(destacados)
    for (k in seq_along(destacados)) {
      d <- destacados[[k]]
      x0 <- izq + (k - 1L) * ancho_k
      if (k > 1L) {
        grid::grid.lines(x = grid::unit(c(x0 - 0.018, x0 - 0.018), "npc"),
                         y = grid::unit(c(0.115, 0.225), "npc"),
                         gp = grid::gpar(col = tokens$rule, lwd = pesos$columna))
      }
      grid::grid.text(d$valor, x = x0, y = 0.160, just = c("left", "bottom"),
                      gp = grid::gpar(col = tokens$navy, fontsize = 21, fontface = "bold"))
      grid::grid.text(pulso_pdf_versalitas(d$rotulo), x = x0, y = 0.130,
                      just = c("left", "bottom"),
                      gp = grid::gpar(col = tokens$faint, fontsize = ty$eyebrow, fontface = "bold"))
    }
    pulso_pdf_hairline(izq, izq + ancho, 0.105, tokens = tokens, lwd = pesos$columna)
  }

  if (nzchar(portada$nota)) {
    .form_pdf_text(portada$nota, x = izq, y = 0.078, w = ancho,
                   chars = pulso_pdf_chars(ancho, factor = 150), fontsize = ty$caption,
                   col = tokens$faint, line_h = 0.020)
  }
  invisible(NULL)
}

# El logo sobre fondo navy: mismo dibujo que el del kit, pero sin el fallback en
# navy. Devuelve TRUE si pudo pintar la imagen.
.pulso_pdf_portada_logo <- function(x, y, geo = pulso_pdf_geo("landscape"),
                                    width_npc = 0.170, just = c("centre", "centre")) {
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
                    just = just, interpolate = TRUE,
                    width = grid::unit(width_npc, "npc"), height = grid::unit(h_npc, "npc"))
  TRUE
}
