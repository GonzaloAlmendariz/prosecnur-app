# =============================================================================
# reporte_word_figura.R — la figura del informe Word del recetario: rótulo, imagen, base y lectura (N8.4)
# =============================================================================
#
# recetario_word.R:28-66. Todo lo que pone el motor es un estilo o un campo de Word, para que la posedición se haga desde
# Inicio > Estilos y la numeración se recalcule sola:
#   - rótulo en una línea centrada «Gráfico N° N: título» (estilo de carácter «Número de rótulo», azul, negrita y cursiva —R1,
#     reporte_word_rotulo.R—, con campo SEQ
#     en el número) dentro del estilo «Rótulo de gráfico»; con el SEQ, Word arma el índice de gráficos;
#   - la imagen centrada, del ancho del texto y pegada a lo que sigue;
#   - la base y la fuente centradas, sin la palabra «Nota»; si hay lectura, no se separan de ella;
#   - la lectura con las cifras en negrita.

#' Run de texto con un estilo de carácter
#' @keywords internal
.word_run_estilo <- function(texto, estilo = NULL) structure(list(t = as.character(texto), sty = estilo), class = c("pulso_run_estilo", "run"))

#' Run con un campo SEQ (numeración de Word) y el número que se ve antes de actualizar
#' @keywords internal
.word_run_seq <- function(id, n, estilo = NULL) structure(list(id = id, n = n, sty = estilo), class = c("pulso_run_seq", "run"))

.word_xml_esc <- function(x) gsub(">", "&gt;", gsub("<", "&lt;", gsub("&", "&amp;", x, fixed = TRUE), fixed = TRUE), fixed = TRUE)
.word_rpr <- function(estilo) if (is.null(estilo)) "" else sprintf('<w:rPr><w:rStyle w:val="%s"/></w:rPr>', estilo)

#' @exportS3Method officer::to_wml
to_wml.pulso_run_estilo <- function(x, add_ns = FALSE, ...) {
  sprintf('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>', .word_rpr(x$sty), .word_xml_esc(x$t))
}

#' @exportS3Method officer::to_wml
to_wml.pulso_run_seq <- function(x, add_ns = FALSE, ...) {
  r <- .word_rpr(x$sty)
  paste0('<w:r>', r, '<w:fldChar w:fldCharType="begin"/></w:r>',
         '<w:r>', r, '<w:instrText xml:space="preserve"> SEQ ', .word_xml_esc(x$id), ' \\* ARABIC </w:instrText></w:r>',
         '<w:r>', r, '<w:fldChar w:fldCharType="separate"/></w:r>',
         '<w:r>', r, '<w:t>', x$n, '</w:t></w:r>',
         '<w:r>', r, '<w:fldChar w:fldCharType="end"/></w:r>')
}

#' Separador entre «Gráfico N» y su título en el rótulo (una sola línea); cámbialo aquí
#' @keywords internal
.WORD_ROTULO_SEPARADOR <- ": "

#' Título del rótulo sin vacíos: NULL, NA, espacios y el espacio duro de «sin título» (`.WORD_TITULO_VACIO`) cuentan como vacío
#' @keywords internal
.word_rotulo_titulo <- function(titulo) {
  if (is.null(titulo) || !length(titulo) || is.na(titulo[[1]])) return("")
  trimws(gsub("[\u00A0\u2007\u202F]", " ", as.character(titulo[[1]])))
}

#' Rótulo de una figura o tabla: UNA línea centrada «Gráfico N° N: título», todo con el estilo de carácter «Número de
#' rótulo» (azul, negrita y cursiva; prefijo y cursiva en reporte_word_rotulo.R); el número lleva el campo SEQ. Sin título
#' queda solo «Gráfico N° N».
#' @keywords internal
.word_rotulo <- function(doc, n, titulo, etiqueta = "Gráfico") {
  num <- .word_estilo_id(doc, "Número de rótulo")
  titulo <- .texto_espacio_duro(.word_rotulo_titulo(titulo))   # C6: «38 %» y «N° 7» no se parten (texto_espacio_duro.R)
  # Sin número (`n = NA`): un ejemplo ilustrativo, como los de «Cómo leer este informe». Va como «Ejemplo: …» y SIN campo
  # SEQ: Word renumera los SEQ en orden, así que no basta con saltarse el contador (Gonzalo, 2026-10-26: el ejemplo del
  # Top Two Box salía como «Gráfico 1» y corría la numeración del informe; tampoco entra al índice de gráficos).
  if (length(n) != 1L || is.na(n)) {
    partes <- list(.word_run_estilo("Ejemplo", num))
    if (nzchar(titulo)) partes[[2]] <- .word_run_estilo(paste0(.WORD_ROTULO_SEPARADOR, titulo), num)
    return(officer::body_add_fpar(doc, do.call(officer::fpar, partes), style = "Rótulo de gráfico"))
  }
  # R1: «Gráfico N° » + SEQ (identificador = etiqueta, el que pide el índice) (reporte_word_rotulo.R)
  partes <- list(.word_run_estilo(.texto_espacio_duro(.word_rotulo_prefijo(etiqueta)), num), .word_run_seq(etiqueta, n, num))
  if (nzchar(titulo)) partes[[3]] <- .word_run_estilo(paste0(.WORD_ROTULO_SEPARADOR, titulo), num)
  officer::body_add_fpar(doc, do.call(officer::fpar, partes), style = "Rótulo de gráfico")
}

#' Base y fuente bajo la figura; con lectura, el estilo que no la separa de ella
#' @keywords internal
.word_base <- function(doc, texto, con_lectura = FALSE) {
  if (is.null(texto) || !nzchar(trimws(texto))) return(doc)
  officer::body_add_fpar(doc, officer::fpar(officer::ftext(trimws(texto))), style = if (isTRUE(con_lectura)) "Base y fuente con lectura" else "Base y fuente")
}

#' Lectura de la figura: las cifras (porcentajes, puntos) en negrita y el resto con el estilo
#' @keywords internal
.word_lectura <- function(doc, texto) {
  if (is.null(texto) || !nzchar(trimws(texto))) return(doc)
  texto <- trimws(texto)
  pos <- gregexpr("[0-9]+([.,][0-9]+)*( ?%| pts| puntos)?", texto)[[1]]; partes <- list(); k <- 1L
  if (pos[1] > 0) for (i in seq_along(pos)) {
    a <- pos[i]; b <- a + attr(pos, "match.length")[i] - 1L
    if (a > k) partes[[length(partes) + 1L]] <- officer::ftext(substr(texto, k, a - 1L))
    partes[[length(partes) + 1L]] <- officer::ftext(substr(texto, a, b), officer::fp_text_lite(bold = TRUE)); k <- b + 1L
  }
  if (k <= nchar(texto)) partes[[length(partes) + 1L]] <- officer::ftext(substr(texto, k, nchar(texto)))
  officer::body_add_fpar(doc, do.call(officer::fpar, partes), style = "Lectura")
}

#' Figura completa del recetario: rótulo, imagen centrada pegada a la base, base y, si la hay, la lectura
#'
#' @param png Imagen ya dibujada (fondo transparente).
#' @param ancho,alto Medidas de la imagen en pulgadas (el ancho útil del texto por defecto).
#' @param tabla `NULL` o la tabla de datos (`.radar_mb_tabla_cifras`) que va encima de la imagen, centrada.
#' @keywords internal
.word_figura <- function(doc, n, titulo, png, alto, ancho = .std_word("pagina", "ancho_util"), base = NULL, lectura = NULL,
                          tabla = NULL) {
  doc <- .word_rotulo(doc, n, titulo)
  # Tabla de datos encima de la figura (reporte_word_tabla_grafico.R): rótulo, tabla e imagen quedan pegados.
  if (!is.null(tabla)) doc <- .word_tabla_encima(doc, tabla)
  doc <- officer::body_add_fpar(doc, officer::fpar(officer::external_img(png, width = ancho, height = alto),
                                                   fp_p = officer::fp_par(text.align = "center", keep_with_next = !is.null(base) && nzchar(trimws(base)),
                                                                          padding.top = if (is.null(tabla)) 0 else 6)))
  # Sin base la imagen no se pega a lo que sigue: encadenaba figura tras figura y empujaba el capítulo a otra página (N8.13).
  con_lectura <- !is.null(lectura) && nzchar(trimws(lectura))
  doc <- .word_base(doc, base, con_lectura = con_lectura)
  if (con_lectura) doc <- .word_lectura(doc, lectura)
  doc
}

# ---- Alto por filas, fondo transparente y piso de 8 pt (N8.5; recetario_word_graficos.R:14-16, 31-35, 77, 99) --------

#' Filas efectivas de una figura: cada rótulo pesa según sus líneas (0.55 + 0.34 por línea, con mínimo 1)
#' @param envolver Caracteres por línea con que se parte el rótulo.
#' @keywords internal
.word_filas <- function(rotulos, envolver = 22, minimo = 1) {
  rotulos <- as.character(rotulos)
  if (!length(rotulos)) return(0)
  nl <- vapply(rotulos, function(r) length(strwrap(r, width = envolver)) %||% 1L, 1L)
  sum(pmax(minimo, 0.55 + 0.34 * pmax(1L, nl)))
}

#' Alto de la figura en el documento: apilada 1.2 + 0.36 por fila, barras 0.75 + 0.27, menos los 0.22 in del pie que
#' ya no va dentro de la imagen; los tipos de alto fijo, su medida del recetario
#' @keywords internal
.word_alto_figura <- function(tipo, filas = 1) {
  ap <- .std_word("figura", "alto_apilada"); ba <- .std_word("figura", "alto_barras")
  fijos <- c(dicotomia = 1.5, columnas = 2.3, torta = 2.6, dona = 2.9, histograma = 2.5, numerico = 2.2, media_rango = 2.2, boxplot = 2.4,
             lollipop = 2.8, serie = 2.4, radar = 3.4, mapa = 4.2, nube = 2.7)
  alto <- switch(tipo,
    escala = ap$base + ap$por_fila * filas,
    barras = , categorica = ba$base + ba$por_fila * filas,
    divergentes = 0.9 + 0.3 * filas,
    pesas = 1.0 + 0.27 * filas,
    heatmap_dim = , heatmap_criterios = min(3.9, 0.8 + 0.3 * filas),
    unname(fijos[tipo]) %||% NA_real_)
  if (!is.finite(alto)) alto <- 2.95
  alto - 0.22
}

#' Grosor de la barra en el Word (cm), igual para escala, barras y apilada (N25, Renzo, Arte, 2026-10-22)
#'
#' Medido antes: escala de 1 barra 0,92 cm, de 5 enunciados 0,62, categóricas 0,55-0,6, apilada 1,2. 0,70 cm es el punto
#' medio: la cifra de 9 pt cabe dentro de la barra con aire y una figura de 6 barras sigue cabiendo en media página.
#' @keywords internal
.WORD_GROSOR_BARRA_CM <- 0.70

#' Parte del alto de una figura que no es panel: márgenes y leyenda, en pulgadas (lo que el gtable reserva en términos absolutos)
#' @keywords internal
.word_alto_fijo <- function(g) {
  gt <- suppressWarnings(ggplot2::ggplotGrob(g))
  # convertHeight evalúa las unidades «null» como 0: queda solo lo absoluto (márgenes, leyenda), incluso dentro de sum(0.5null, 0.28cm, ...)
  fijo <- tryCatch(suppressWarnings(sum(vapply(seq_along(gt$heights), function(i) grid::convertHeight(gt$heights[i], "in", valueOnly = TRUE), 0))),
                   error = function(e) NA_real_)
  if (is.finite(fijo)) fijo else 0.5
}

#' Fija el alto de la figura desde su eje y para que la barra mida `.WORD_GROSOR_BARRA_CM` (N25)
#'
#' La barra ocupa la fracción `h` de la unidad-y; las pulgadas por unidad-y son `grosor / h`, así que el alto del panel es
#' esa razón por el rango del eje y, más lo fijo (márgenes y leyenda). Con piso para figuras de una barra y tope por página.
#' @param h Fracción de la unidad-y que ocupa la barra (escala 0,58; barras 0,64; apilada 1).
#' @return El ggplot con atributos `alto` (in) y `alto_fijo`.
#' @keywords internal
.word_fijar_alto_por_grosor <- function(g, h, minimo = 0.4, tope = 8.5) {
  dy <- diff(suppressWarnings(ggplot2::ggplot_build(g))$layout$panel_params[[1]]$y.range)
  fijo <- .word_alto_fijo(g)
  k <- (.WORD_GROSOR_BARRA_CM / 2.54) / h
  attr(g, "alto_fijo") <- fijo
  attr(g, "alto") <- min(tope, max(minimo, k * dy + fijo))
  g
}

#' Ningún texto de la figura bajo 8 pt (la letra mínima del Word del recetario)
#' @keywords internal
.word_piso_texto <- function(p, minimo = .std_word("tipografia", "grafico_minimo")) {
  if (!inherits(p, "ggplot")) return(p)
  piso <- minimo / ggplot2::.pt
  for (i in seq_along(p$layers)) {
    ly <- p$layers[[i]]
    if (inherits(ly$geom, c("GeomText", "GeomLabel")) && is.numeric(ly$aes_params$size) && ly$aes_params$size < piso) p$layers[[i]]$aes_params$size <- piso
  }
  th <- ggplot2::theme_get() + p$theme
  for (nm in names(th)) {
    el <- th[[nm]]
    if (inherits(el, "element_text") && is.numeric(el$size) && !inherits(el$size, "rel") && el$size < minimo) {
      p <- p + do.call(ggplot2::theme, stats::setNames(list(ggplot2::element_text(size = minimo)), nm))
    }
  }
  p
}

#' Dibuja la figura en PNG de 300 dpi con fondo transparente, sin el pie (la base va en su párrafo)
#' @keywords internal
.word_png <- function(p, alto, ancho = .std_word("pagina", "ancho_util"), archivo = tempfile(fileext = ".png")) {
  if (inherits(p, "ggplot")) p <- .word_piso_texto(p + ggplot2::labs(caption = NULL))
  ggplot2::ggsave(archivo, p, width = ancho, height = alto, dpi = .std_word("figura", "dpi"), bg = "transparent")
  archivo
}
