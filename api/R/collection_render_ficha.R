# collection_render_ficha.R — Spike de render de la ficha de aplicación.
#
# Unidad 10 del plan de Recopiladores. Es un SPIKE a propósito: prueba que una
# ficha con QR es dibujable con el kit `grid` compartido antes de congelar
# `collection_material_template/v1`. Descubrir acá que un bloque no se puede
# dibujar es barato; descubrirlo con el schema congelado, no.
#
# Por eso la entrada es una lista plana y no un schema validado: lo que se está
# probando es el dibujo, no el contrato.
#
# --- Las dos decisiones del ADR 0046 que este archivo materializa -------------
#
# §14, "el mismo compilador" es literal. `.crf_draw_ficha()` es el ÚNICO cuerpo
# de dibujo. `collection_render_ficha()` abre un device y lo llama; el PDF y el
# PNG difieren en el device y en nada más. No se rasteriza el PDF y no se
# depende de ImageMagick. Si la preview y el PDF final divergieran, sería porque
# el device miente, no porque haya dos dibujos que alguien tiene que mantener
# sincronizados.
#
# §13, el QR se genera acá y no en el navegador, con el paquete CRAN `qrcode`
# porque es R puro y no exige librerías de sistema que el R embebido de Electron
# no puede garantizar. Va en `Imports` y no en `Suggests` a propósito: un
# `requireNamespace` con fallback silencioso es exactamente el bug que ya
# ocurrió con `sampling` en los goldens de aulas, donde la ausencia del paquete
# cambiaba el resultado sin decirlo.

# --- Geometría de la ficha (npc dentro de la página) --------------------------
# Una hoja A4 por curso-horario. El QR manda en el reparto: tiene que ser
# escaneable desde la distancia a la que un estudiante mira una hoja pegada.
.crf_layout <- function() {
  list(
    qr_side = 0.34,      # lado del QR en npc de ancho de página
    qr_x = 0.72,         # centro del QR
    qr_y = 0.62,
    x_left = 0.075,
    y_title = 0.80,
    y_rows_top = 0.70,
    row_step = 0.055,
    y_link = 0.30,
    label_w = 0.13       # ancho reservado a la etiqueta de cada fila
  )
}

.crf_txt <- function(value, fallback = "Por confirmar") {
  v <- if (is.null(value)) "" else trimws(as.character(value)[1])
  if (!nzchar(v) || is.na(v)) fallback else v
}

# --- QR ----------------------------------------------------------------------

#' Matriz del QR de un enlace.
#'
#' Devuelve la matriz lógica de módulos (TRUE = módulo oscuro), con la quiet zone
#' que `qrcode` ya incluye. Se expone porque el test compara esta matriz contra
#' lo que quedó dibujado en el PNG: es la única forma de verificar fidelidad de
#' módulos sin depender de un decodificador con librerías de sistema.
#'
#' @param link texto a codificar.
#' @return matriz lógica.
#' @export
collection_qr_matrix <- function(link) {
  link <- .crf_txt(link, "")
  if (!nzchar(link)) {
    stop("No hay enlace que codificar: un QR sin enlace no identifica nada.", call. = FALSE)
  }
  m <- qrcode::qr_code(link)
  # `qr_code` devuelve una matriz lógica con clase propia; se normaliza para que
  # el resto del archivo no dependa de esa clase.
  matrix(as.logical(m), nrow = nrow(m), ncol = ncol(m))
}

# Viewport CUADRADO en pulgadas para el área del QR.
#
# Es la corrección que el spike descubrió y que justifica su existencia: A4 no es
# cuadrada (8,27 × 11,69), así que dibujar los módulos con `width` y `height` en
# npc los estira verticalmente en un 41%. Un QR con módulos rectangulares deja de
# ser un QR. Fijando el lado en pulgadas, el módulo es cuadrado de verdad y el
# lado del QR es el mismo número que usa quien relee el PNG.
.crf_qr_viewport <- function(x, y, side_npc, geo = pulso_pdf_geo("portrait")) {
  lado <- grid::unit(side_npc * geo$page_w, "inches")
  grid::viewport(x = x, y = y, width = lado, height = lado, default.units = "npc")
}

# Dibuja la matriz como rectángulos de un solo `grid.rect` vectorizado. Un
# `rasterGrob` sería más corto pero interpola: en PDF el módulo queda con bordes
# suaves y el lector pierde el umbral. Rectángulos nítidos es el punto.
#
# Se llama DENTRO del viewport cuadrado, así que acá npc ya es isotrópico.
.crf_draw_qr_modules <- function(m) {
  n <- nrow(m)
  cell <- 1 / n
  idx <- which(m, arr.ind = TRUE)
  if (!nrow(idx)) return(invisible(NULL))
  # `row` crece hacia abajo en la matriz y hacia arriba en npc: se invierte.
  cx <- (idx[, "col"] - 0.5) * cell
  cy <- 1 - (idx[, "row"] - 0.5) * cell
  grid::grid.rect(
    x = cx, y = cy, width = cell, height = cell,
    default.units = "npc",
    gp = grid::gpar(fill = "#000000", col = NA)
  )
}

# --- Cuerpo de dibujo: el único que existe -----------------------------------
.crf_draw_ficha <- function(ficha, tokens = pulso_pdf_tokens(), type = pulso_pdf_type()) {
  L <- .crf_layout()
  geo <- pulso_pdf_geo("portrait")

  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  pulso_pdf_header(
    titulo = .crf_txt(ficha$unit_label, "Curso-horario"),
    subtitulo = .crf_txt(ficha$faculty, ""),
    tokens = tokens, geo = geo
  )

  # Fondo blanco detrás del QR, también cuadrado: el marco tiene que seguir al
  # QR y no a la proporción de la página. La quiet zone la trae la propia matriz
  # de `qr_code`; este recuadro es el respaldo blanco, no la quiet zone.
  grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side * 1.20, geo))
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = tokens$rule, lwd = 0.7))
  grid::popViewport()

  link <- .crf_txt(ficha$link, "")
  if (nzchar(link)) {
    grid::pushViewport(.crf_qr_viewport(L$qr_x, L$qr_y, L$qr_side, geo))
    .crf_draw_qr_modules(collection_qr_matrix(link))
    grid::popViewport()
  } else {
    # Sin enlace no se inventa un QR: se dice que falta. Un cuadro vacío que
    # parece un QR es peor que un hueco rotulado.
    grid::grid.text(
      "Sin enlace", x = L$qr_x, y = L$qr_y,
      gp = grid::gpar(col = tokens$faint, fontsize = type$body), default.units = "npc"
    )
  }

  grid::grid.text(
    .crf_txt(ficha$course_name, "Curso sin nombre"),
    x = L$x_left, y = L$y_title, just = "left", default.units = "npc",
    gp = grid::gpar(col = tokens$navy, fontsize = type$section, fontface = "bold")
  )

  filas <- list(
    c("Horario", .crf_txt(ficha$schedule)),
    c("Salón", .crf_txt(ficha$venue)),
    c("Docente", .crf_txt(ficha$teacher)),
    c("Muestra", .crf_txt(ficha$sample_label, "Selección")),
    # "Sin dato" y no un guión largo: el device PDF por defecto no codifica
    # U+2014 y lo sustituye con un warning. Además dice más.
    c("Estudiantes", .crf_txt(ficha$eligible_n, "Sin dato"))
  )
  for (i in seq_along(filas)) {
    y <- L$y_rows_top - (i - 1) * L$row_step
    grid::grid.text(
      filas[[i]][1], x = L$x_left, y = y, just = "left", default.units = "npc",
      gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
    )
    grid::grid.text(
      filas[[i]][2], x = L$x_left + L$label_w, y = y, just = "left", default.units = "npc",
      gp = grid::gpar(col = tokens$ink, fontsize = type$body)
    )
  }

  pulso_pdf_hairline(L$x_left, 1 - L$x_left, L$y_link + 0.045, tokens = tokens)

  # El enlace va visible y no solo dentro del QR: si el QR no escanea —cámara
  # mala, hoja arrugada, luz— el enlace se digita y el campo no se detiene.
  grid::grid.text(
    "Enlace de la encuesta", x = L$x_left, y = L$y_link + 0.022,
    just = "left", default.units = "npc",
    gp = grid::gpar(col = tokens$soft, fontsize = type$caption)
  )
  grid::grid.text(
    if (nzchar(link)) link else "Pendiente de generar",
    x = L$x_left, y = L$y_link, just = "left", default.units = "npc",
    gp = grid::gpar(col = tokens$ink, fontsize = type$code)
  )

  pulso_pdf_footer(1, periodo = .crf_txt(ficha$period, ""), tokens = tokens, geo = geo)
  invisible(TRUE)
}

# --- Devices -----------------------------------------------------------------

#' Renderiza la ficha de aplicación de un curso-horario.
#'
#' @param ficha lista plana con `unit_label`, `course_name`, `schedule`, `venue`,
#'   `teacher`, `faculty`, `sample_label`, `eligible_n`, `link`, `period`.
#' @param path destino.
#' @param device "pdf" o "png". El dibujo es el mismo; solo cambia el device.
#' @param dpi resolución del PNG. Ignorado en PDF, que es vectorial.
#' @return lista con `path`, `device`, `sha256`, `bytes` y, en PNG, `px`.
#' @export
collection_render_ficha <- function(ficha, path, device = c("pdf", "png"), dpi = 150) {
  device <- match.arg(device)
  geo <- pulso_pdf_geo("portrait")

  if (device == "pdf") {
    grDevices::pdf(path, width = geo$page_w, height = geo$page_h, onefile = TRUE)
  } else {
    if (!isTRUE(capabilities("png"))) {
      stop("Este R no tiene device PNG; la preview autoritativa no se puede rasterizar.", call. = FALSE)
    }
    grDevices::png(
      path,
      width = round(geo$page_w * dpi), height = round(geo$page_h * dpi),
      res = dpi, type = "cairo-png", bg = "white"
    )
  }
  on.exit(grDevices::dev.off(), add = TRUE)

  .crf_draw_ficha(ficha)

  invisible(list(path = path, device = device))
}

#' Igual que `collection_render_ficha` pero devuelve el recibo del artefacto.
#'
#' El spike no registra archivos ni emite manifest —eso es la unidad 13—, pero sí
#' devuelve sha256 y tamaño, que es lo mínimo para comparar dos corridas.
#'
#' @inheritParams collection_render_ficha
#' @return lista con `path`, `device`, `sha256` y `bytes`.
#' @export
collection_render_ficha_receipt <- function(ficha, path, device = c("pdf", "png"), dpi = 150) {
  device <- match.arg(device)
  collection_render_ficha(ficha, path, device = device, dpi = dpi)
  list(
    path = path,
    device = device,
    sha256 = digest::digest(file = path, algo = "sha256"),
    bytes = file.info(path)$size
  )
}

#' Lee de vuelta la matriz de módulos del QR desde un PNG ya renderizado.
#'
#' Muestrea el centro de cada módulo dentro del área que ocupa el QR en la
#' página. NO es un decodificador de terceros: decodificar de verdad exigiría
#' zbar u OpenCV, librerías de sistema que el ADR 0046 §13 evita justamente
#' porque el R embebido de Electron no las garantiza.
#'
#' Lo que verifica es fidelidad de módulos, que es donde falla el dibujo en la
#' práctica: escala mal calculada, antialiasing que come un módulo, colores
#' invertidos o quiet zone comida. Un QR con los módulos correctos y quiet zone
#' correcta es decodificable por construcción.
#'
#' @param png_path ruta al PNG renderizado.
#' @param n número de módulos por lado (de `collection_qr_matrix`).
#' @param dpi el mismo dpi con que se renderizó.
#' @return matriz lógica del mismo tamaño que la original.
#' @export
collection_qr_matrix_from_png <- function(png_path, n, dpi = 150) {
  if (!requireNamespace("png", quietly = TRUE)) {
    stop("Se necesita el paquete 'png' para releer la matriz del QR.", call. = FALSE)
  }
  img <- png::readPNG(png_path)
  # Escala de grises: basta el primer canal, el dibujo es blanco y negro.
  gris <- if (length(dim(img)) == 3L) img[, , 1] else img

  geo <- pulso_pdf_geo("portrait")
  L <- .crf_layout()
  px_w <- ncol(gris)
  px_h <- nrow(gris)

  # npc → píxel. En `grid` el eje y crece hacia arriba; en la matriz de la
  # imagen, la fila 1 es la de arriba.
  side_px <- L$qr_side * px_w
  cx <- L$qr_x * px_w
  cy <- (1 - L$qr_y) * px_h
  x0 <- cx - side_px / 2
  y0 <- cy - side_px / 2
  cell <- side_px / n

  out <- matrix(FALSE, nrow = n, ncol = n)
  for (r in seq_len(n)) {
    for (c in seq_len(n)) {
      px <- round(x0 + (c - 0.5) * cell)
      py <- round(y0 + (r - 0.5) * cell)
      px <- max(1L, min(px_w, px))
      py <- max(1L, min(px_h, py))
      out[r, c] <- gris[py, px] < 0.5
    }
  }
  out
}
