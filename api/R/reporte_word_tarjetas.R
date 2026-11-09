# =============================================================================
# reporte_word_tarjetas.R — las tarjetas de diferencias en la figura del Word A4 (ADR 0129, propuesta P08)
# =============================================================================
#
# Referencia visual: páginas `a4-*` de `generadores/tarjetas2.mjs` (maqueta del 2026-11-03). Las tarjetas van DEBAJO
# del gráfico del total, dentro de la misma figura: el rótulo «Gráfico N°…» arriba, el total, las tarjetas y «N = …
# Fuente: …» al pie. Es la misma tarjeta del PPT (`.lam_tarjeta_dibujar`), dibujada con `grid` y reducida a 0.8:
#
#   - una sola tarjeta va a todo el ancho del texto; dos, a la mitad cada una;
#   - con número impar, la principal va sola a todo el ancho y las demás de a dos debajo (Gonzalo, comentario en el
#     Word de la maqueta).

.WORD_TARJETAS_ZOOM <- 0.8
.WORD_TARJETAS_SEP <- 0.15   # entre columnas (in de página)
.WORD_TARJETAS_SEP_FILA <- 0.1

#' Corta un texto en líneas que caben en `w` pulgadas (por palabras, con la tinta real de Arial)
#' @keywords internal
.word_tarjetas_envolver <- function(s, w, size, bold = FALSE) {
  # La misma regla con que la tarjeta cuenta sus líneas (`w × 1.05 + 0.22`, lamina_tarjetas_diferencias.R): con una más
  # estrecha el Word partía un título en tres líneas que la tarjeta había medido en dos y pisaba el «Total».
  util <- w * .TARJETA_TINTA_TITULO + 0.2
  pal <- strsplit(trimws(as.character(s)), "\\s+")[[1]]; pal <- pal[nzchar(pal)]
  if (!length(pal)) return("")
  lineas <- character(0); cur <- pal[1]
  for (k in seq_along(pal)[-1]) {
    cand <- paste(cur, pal[k])
    if (.lam_ancho_tinta(cand, size, bold) <= util) cur <- cand else { lineas <- c(lineas, cur); cur <- pal[k] }
  }
  c(lineas, cur)
}

#' Backend `grid` de la tarjeta: coordenadas de diseño (in, origen arriba a la izquierda) por `z`, desde (`ox`, `oy`)
#' @param alto_pag Alto de la imagen en pulgadas de página.
#' @keywords internal
.word_tarjeta_backend_grid <- function(alto_pag, z = .WORD_TARJETAS_ZOOM, ox = 0, oy = 0) {
  Y <- function(t) grid::unit(alto_pag - (oy + t * z), "in")
  X <- function(x) grid::unit(ox + x * z, "in")
  L <- function(w) grid::unit(w * z, "in")   # largos: sin el desplazamiento (una posición lleva `ox`; un ancho, no)
  list(
    rect = function(l, t, w, h, fill = NULL, borde = NULL, pt = 0.75, punteado = FALSE, radio = 0, nombre = NULL) {
      gp <- grid::gpar(fill = fill %||% NA, col = borde %||% NA, lwd = pt * z * 96 / 72, lty = if (isTRUE(punteado)) "22" else "solid")
      if (radio > 0) {
        grid::grid.roundrect(X(l), Y(t + h), L(w), L(h), r = L(radio),
                             just = c("left", "bottom"), gp = gp)
      } else {
        grid::grid.rect(X(l), Y(t + h), L(w), L(h), just = c("left", "bottom"), gp = gp)
      }
    },
    txt = function(s, l, t, w, h, size, color, bold = FALSE, align = "left", nombre = NULL) {
      lineas <- .word_tarjetas_envolver(s, w, size, bold)
      x <- switch(align, right = l + w, center = l + w / 2, l)
      for (i in seq_along(lineas)) {
        grid::grid.text(lineas[i], X(x), Y(t + (i - 1) * size * 1.2 / 72 + size * 0.1 / 72), just = c(align, "top"),
                        gp = grid::gpar(fontsize = size * z, fontface = if (isTRUE(bold)) "bold" else "plain", col = color,
                                        fontfamily = .std_pt("fuente"), lineheight = 1.2))
      }
    },
    tri = function(x, yc, dir, fragil) {
      a <- 0.075; w <- a * 1.15
      col <- if (isTRUE(fragil)) .std_color("tarjeta_borde_95") else .std_color("azul")
      ys <- if (identical(dir, "down")) c(yc - a / 2, yc - a / 2, yc + a / 2) else c(yc + a / 2, yc + a / 2, yc - a / 2)
      grid::grid.polygon(X(c(x, x + w, x + w / 2)), Y(ys), gp = grid::gpar(fill = if (isTRUE(fragil)) NA else col, col = col,
                                                                          lwd = z * 96 / 72, linejoin = "round"))
    }
  )
}

#' Disposición de las tarjetas en el ancho del texto: filas, cajas y alto (in de diseño)
#' @keywords internal
.word_tarjetas_disponer <- function(tarjetas, ancho, cortos = character(0), tipo = "multiple", z = .WORD_TARJETAS_ZOOM) {
  filas <- .tarjetas_filas_word(length(tarjetas))
  W <- ancho / z; sep <- .WORD_TARJETAS_SEP / z; sep_f <- .WORD_TARJETAS_SEP_FILA / z
  cajas <- vector("list", length(tarjetas)); y <- 0
  for (f in filas) {
    cw <- if (length(f) == 1L) W else (W - sep) / 2
    h <- max(vapply(tarjetas[f], .lam_tarjeta_alto, numeric(1), w = cw, cortos = cortos, tipo = tipo))
    for (c in seq_along(f)) cajas[[f[c]]] <- list(l = (c - 1L) * (cw + sep), t = y, w = cw, h = h)
    y <- y + h + sep_f
  }
  list(cajas = cajas, alto = max(0, y - sep_f), filas = filas)
}

#' Imagen de las tarjetas para el Word
#' @param t `attr(p, "pulso_tarjetas")`.
#' @return Ruta del PNG con atributos `ancho` y `alto` (in de página), o NULL sin tarjetas.
#' @keywords internal
.word_tarjetas_png <- function(t, ancho = .std_word("pagina", "ancho_util"), archivo = tempfile(fileext = ".png")) {
  if (is.null(t) || !length(t$tarjetas)) return(NULL)
  z <- .WORD_TARJETAS_ZOOM
  cortos <- t$opcion$cortos
  L <- .word_tarjetas_disponer(t$tarjetas, ancho, cortos = cortos, tipo = t$tipo, z = z)
  alto_pag <- L$alto * z + 0.02
  dpi <- .std_word("figura", "dpi")
  .word_tarjetas_dispositivo(archivo, ancho, alto_pag, dpi)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  b <- .word_tarjeta_backend_grid(alto_pag, z = z)
  for (i in seq_along(t$tarjetas)) {
    tj <- t$tarjetas[[i]]
    .lam_tarjeta_dibujar(b, tj, L$cajas[[i]], unname(t$rotulos_cruce[tj$cruce]) %||% tj$cruce, cortos = cortos, tipo = t$tipo)
  }
  structure(archivo, ancho = ancho, alto = alto_pag)
}

#' Alto del gráfico del total cuando lleva tarjetas: más compacto, para que total y tarjetas quepan en una página
#'
#' La maqueta A4 (versión 6) pone el total con filas de 0.15 in y las tarjetas debajo; el caso más cargado de CCSS
#' (múltiple de diez opciones con seis tarjetas, más el párrafo) cabe en una página. Sin tarjetas el alto no cambia.
#' @keywords internal
.word_tarjetas_alto_total <- function(alto, tarjetas) {
  if (is.null(alto) || !is.finite(alto) || !length(tarjetas$tarjetas)) return(alto)
  # La escala no se compacta: sus cifras chicas van sobre la barra y se encimarían (CCSS, batería de pobreza).
  if (isTRUE(tarjetas$tipo %in% c("bateria", "entre_publicos"))) return(alto)   # ni el contraste de públicos (ADR 0138)
  # Compacta, nunca agranda: una franja Sí/No de 0,6 in subía al piso de 1,4 in y su barra salía al triple de su grosor
  # (CCSS v7.20, experiencia laboral vinculada con la carrera).
  min(alto, max(1.4, alto * 0.62))
}

#' Agrega las tarjetas bajo la imagen del total (dentro de la figura, antes de la base)
#' @keywords internal
.word_tarjetas_en_figura <- function(doc, tarjetas, ancho = .std_word("pagina", "ancho_util")) {
  png <- tryCatch(.word_tarjetas_png(tarjetas, ancho = ancho), error = function(e) {
    message("[word] las tarjetas de diferencias no se pudieron dibujar: ", conditionMessage(e))
    NULL
  })
  if (is.null(png)) return(doc)
  doc <- officer::body_add_fpar(doc, officer::fpar(officer::external_img(as.character(png), width = attr(png, "ancho"), height = attr(png, "alto")),
                                                   fp_p = officer::fp_par(text.align = "center", keep_with_next = TRUE, padding.top = 8)))
  # Opción `todas` (ítem 23): la frase que explica los grupos sin flecha, con el estilo de la base.
  if (isTRUE(tarjetas$opcion$todas)) doc <- officer::body_add_fpar(doc, officer::fpar(officer::ftext(.TARJETAS_FRASE_TODAS)), style = "Base y fuente")
  doc
}

#' Abre el dispositivo PNG de una imagen de tarjetas (ragg si está; si no, el de R)
#' @keywords internal
.word_tarjetas_dispositivo <- function(archivo, ancho, alto, dpi) {
  if (requireNamespace("ragg", quietly = TRUE)) {
    ragg::agg_png(archivo, width = ancho, height = alto, units = "in", res = dpi, background = "transparent")
  } else {
    grDevices::png(archivo, width = ancho, height = alto, units = "in", res = dpi, bg = "transparent")
  }
}

#' Imagen de ejemplo de la lectura: la tarjeta con sus dos anotaciones y la fila de leyenda (página `a4-0` de la maqueta)
#' @keywords internal
.word_tarjetas_ejemplo_png <- function(lectura, archivo = tempfile(fileext = ".png")) {
  tx <- .tarjetas_textos_lectura(lectura)
  t <- lectura$tarjeta
  Zw <- 0.95; cw <- 3.9; anot <- 2.1; sep <- 0.15
  ch <- .lam_tarjeta_alto(t, cw, character(0), lectura$tipo)
  ancho <- .std_word("pagina", "ancho_util")
  x0 <- (ancho - (cw * Zw + sep + anot)) / 2
  alto <- ch * Zw + 0.42
  .word_tarjetas_dispositivo(archivo, ancho, alto, .std_word("figura", "dpi"))
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  b <- .word_tarjeta_backend_grid(alto, z = Zw, ox = x0, oy = 0)
  .lam_tarjeta_dibujar(b, t, list(l = 0, t = 0, w = cw, h = ch), lectura$rotulo_cruce, character(0), lectura$tipo)
  m <- .lam_tarjeta_medidas(cw, t$grupos$etiqueta)
  y_g <- .lam_tarjeta_y_grupos(t, cw, lectura$tipo)
  y_tot <- (y_g[1] - m$aire_total - m$fila / 2) * Zw
  y_g1 <- y_g[1] * Zw; y_g2 <- y_g[2] * Zw
  xa <- x0 + cw * Zw + sep
  Y <- function(y) grid::unit(alto - y, "in"); X <- function(x) grid::unit(x, "in")
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); tenue <- .std_color("texto_tenue")
  grid::grid.lines(X(c(xa, xa + 0.25)), Y(c(y_tot, y_tot)), gp = grid::gpar(col = tenue, lwd = 1.2))
  grid::grid.text(tx$rotulo_total, X(xa + 0.32), Y(y_tot), just = c("left", "centre"),
                  gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = suave, fontfamily = .std_pt("fuente")))
  grid::grid.lines(X(c(xa, xa + 0.13, xa + 0.13, xa)), Y(c(y_g1, y_g1, y_g2, y_g2)), gp = grid::gpar(col = azul, lwd = 1.5))
  grid::grid.lines(X(c(xa + 0.13, xa + 0.25)), Y(rep((y_g1 + y_g2) / 2, 2)), gp = grid::gpar(col = azul, lwd = 1.5))
  lin <- .word_tarjetas_envolver(tx$rotulo_grupos, 1.75, 8.5, TRUE)
  for (i in seq_along(lin)) {
    grid::grid.text(lin[i], X(xa + 0.32), Y((y_g1 + y_g2) / 2 + (i - (length(lin) + 1) / 2) * 0.15), just = c("left", "centre"),
                    gp = grid::gpar(fontsize = 8.5, fontface = "bold", col = azul, fontfamily = .std_pt("fuente")))
  }
  # Leyenda centrada bajo la tarjeta, a 7.5 pt.
  pt <- 7.5; yl <- ch * Zw + 0.22
  items <- list(list("up", FALSE, tx$mayor, FALSE), list("down", FALSE, tx$menor, FALSE),
                list("up", FALSE, tx$nivel_1, TRUE), list("up", TRUE, tx$nivel_2, TRUE))
  w_it <- vapply(items, function(it) (if (it[[4]]) 0.4 else 0.1) + 0.06 + .lam_ancho_tinta(it[[3]], pt), numeric(1))
  x <- (ancho - sum(w_it) - 0.22 * (length(items) - 1L)) / 2
  bl <- .word_tarjeta_backend_grid(alto, z = 1, ox = 0, oy = 0)
  for (k in seq_along(items)) {
    it <- items[[k]]
    if (it[[4]]) {
      fr <- it[[2]]
      bl$rect(x, yl - 0.1, 0.4, 0.2, fill = .std_color(if (fr) "tarjeta_fondo_95" else "tarjeta_fondo"),
              borde = .std_color(if (fr) "tarjeta_borde_95" else "tarjeta_borde"), pt = if (fr) 1.05 else 0.75, punteado = fr, radio = 0.04)
      bl$rect(x + 0.06, yl - 0.035, 0.17, 0.07, fill = .std_color(if (fr) "tarjeta_barra_95" else "azul"))
      bl$tri(x + 0.27, yl, "up", fr)
      xt <- x + 0.46
    } else {
      bl$tri(x, yl, it[[1]], FALSE)
      xt <- x + 0.16
    }
    grid::grid.text(it[[3]], X(xt), Y(yl), just = c("left", "centre"), gp = grid::gpar(fontsize = pt, col = azul, fontfamily = .std_pt("fuente")))
    x <- x + w_it[k] + 0.22
  }
  structure(archivo, ancho = ancho, alto = alto)
}

#' Apartado «Pautas para la lectura del informe»: prosa justificada con la tarjeta de ejemplo (formato de los informes
#' de Pulso; maqueta `a4-0-como-leer`)
#' @keywords internal
.word_tarjetas_pautas <- function(doc, lectura, numero = NULL) {
  tx <- .tarjetas_textos_lectura(lectura)
  doc <- .word_seccion(doc, "Pautas para la lectura del informe", numero)
  for (p in tx$parrafos_word) {
    if (is.na(p)) {
      png <- tryCatch(.word_tarjetas_ejemplo_png(lectura), error = function(e) {
        message("[word] la tarjeta de ejemplo no se pudo dibujar: ", conditionMessage(e)); NULL })
      if (!is.null(png)) {
        doc <- officer::body_add_fpar(doc, officer::fpar(officer::external_img(as.character(png), width = attr(png, "ancho"), height = attr(png, "alto")),
                                                         fp_p = officer::fp_par(text.align = "center", padding.top = 4, padding.bottom = 8)))
      }
      next
    }
    doc <- .word_cuerpo(doc, p)
  }
  doc
}
