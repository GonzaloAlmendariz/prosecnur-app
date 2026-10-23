# =============================================================================
# reporte_word_portada.R — portada e índices del Word del recetario (N8.11)
# =============================================================================
#
# Portan `portada_A`, `portada_B`, `portada_C` (recetario_word_identidad.R:71-105) y los índices reales del documento
# (recetario_word.R:132-139): «Contenido» con el campo TOC de los títulos 1 y 2 y los índices de gráficos y de tablas
# con el campo TOC de sus SEQ. Las tres portadas son variantes elegibles (decisión de N7, 2026-10-09: «Dejar las 4 como
# posibilidades, eso incluye las variantes de título y cierre»). Los índices los llena Word al abrir (updateFields de
# `.docx_conformar(revista = TRUE)`); LibreOffice no los llena, así que se verifican en el XML.

#' Párrafo con formato directo del recetario (`parr()` + `tx()`, recetario_word.R:24-27): Arial, interlineado 1.3
#' @param ... Trozos `list(texto, pt, color, negrita, cursiva)`.
#' @keywords internal
.word_parr <- function(doc, ..., align = "left", antes = 0, despues = 8, mantener = FALSE) {
  f <- .std_word("tipografia", "fuente")
  trozos <- lapply(list(...), function(t) {
    t <- c(as.list(t), vector("list", 5L))[1:5]   # texto, pt, color, negrita, cursiva: lo que falte va por defecto
    officer::ftext(as.character(t[[1]]), officer::fp_text(font.family = f, font.size = t[[2]] %||% 10.5, color = t[[3]] %||% .std_word("colores", "texto"),
                                                       bold = isTRUE(t[[4]]), italic = isTRUE(t[[5]])))
  })
  officer::body_add_fpar(doc, do.call(officer::fpar, c(trozos, list(fp_p = officer::fp_par(text.align = align, padding.bottom = despues,
                                                                                           padding.top = antes, line_spacing = 1.3, keep_with_next = mantener)))))
}

#' Filete corto coral de la portada (`filete_coral()`): 0.9 in, 2.5 pt
#' @keywords internal
.word_filete_coral <- function(doc, w = 0.9) {
  ft <- flextable::flextable(data.frame(a = "")) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(j = 1, width = w) |> flextable::height(height = 0.02) |>
    flextable::hline_top(border = officer::fp_border(color = .std_word("colores", "acento"), width = 2.5)) |> flextable::padding(padding = 0)
  flextable::body_add_flextable(doc, ft, align = "left")
}

#' Portada del informe en una de sus tres variantes del recetario
#'
#' A: tipográfica (antetítulo, título de 28 pt, filete coral, subtítulo, quién y cuándo). B: banda navy a la izquierda y el
#' texto abajo. C: como A con la ficha del encargo (para quién, por quién, fecha y versión).
#' @param meta Lista con `ante`, `titulo`, `sub`, `para`, `por`, `fecha`, `version` (lo que falte se omite).
#' @keywords internal
.word_portada <- function(doc, meta, variante = c("A", "B", "C")) {
  variante <- match.arg(variante)
  navy <- .std_word("colores", "titulos"); suave <- .std_word("colores", "suave"); txt <- .std_word("colores", "texto")
  m <- lapply(list(ante = "", titulo = "", sub = "", para = "", por = "PULSO PUCP", fecha = "", version = ""), identity)
  m[names(meta)] <- lapply(meta, function(x) as.character(x %||% "")[1])
  if (identical(variante, "B")) {
    f <- .std_word("tipografia", "fuente"); ch <- function(t, pt, col, b = FALSE) flextable::as_chunk(t, props = officer::fp_text(font.family = f, font.size = pt, color = col, bold = b))
    ft <- flextable::flextable(data.frame(a = "", b = "")) |> flextable::delete_part("header") |> flextable::border_remove() |>
      flextable::width(j = 1, width = 0.3) |> flextable::width(j = 2, width = .std_word("pagina", "ancho_util") - 0.3) |>
      flextable::bg(j = 1, bg = navy) |> flextable::height(height = 8.4) |> flextable::hrule(rule = "exact") |> flextable::valign(j = 2, valign = "bottom") |>
      flextable::compose(j = 2, value = flextable::as_paragraph(ch(m$ante, 9, suave, TRUE), "\n\n", ch(m$titulo, 26, navy, TRUE), "\n\n",
                                                                 ch(m$sub, 12, txt), "\n\n\n\n", ch(trimws(paste(m$por, m$fecha, sep = "   ")), 9.5, navy, TRUE))) |>
      flextable::padding(j = 2, padding.left = 28, padding.bottom = 10) |> flextable::line_spacing(space = 1.05)
    return(flextable::body_add_flextable(doc, ft, align = "left"))
  }
  grande <- if (identical(variante, "A")) 28 else 26
  for (k in seq_len(if (identical(variante, "A")) 6L else 5L)) doc <- officer::body_add_par(doc, "")
  if (nzchar(m$ante)) doc <- .word_parr(doc, list(m$ante, 9, suave, TRUE), despues = 10)
  doc <- .word_parr(doc, list(m$titulo, grande, navy, TRUE), despues = 14)
  doc <- .word_filete_coral(doc)
  if (nzchar(m$sub)) doc <- .word_parr(doc, list(m$sub, if (identical(variante, "A")) 13 else 12, txt), antes = 10, despues = if (identical(variante, "A")) 120 else 90)
  if (identical(variante, "A")) {
    doc <- .word_parr(doc, list(m$por, 9.5, navy, TRUE), despues = 2)
    return(if (nzchar(m$fecha)) .word_parr(doc, list(m$fecha, 9.5, suave), despues = 2) else doc)
  }
  fic <- data.frame(k = c("Elaborado para", "Elaborado por", "Fecha", "Versión"), v = c(m$para, m$por, m$fecha, m$version))
  fic <- fic[nzchar(fic$v), , drop = FALSE]
  ft <- flextable::flextable(fic) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(j = 1, width = 1.6) |> flextable::width(j = 2, width = 3.2) |> flextable::font(fontname = .std_word("tipografia", "fuente"), part = "all") |>
    flextable::fontsize(size = 9.5) |> flextable::color(j = 1, color = suave) |> flextable::color(j = 2, color = navy) |> flextable::bold(j = 2) |>
    flextable::hline(border = officer::fp_border(color = .std_word("colores", "filete"), width = 0.5)) |>
    flextable::hline_top(border = officer::fp_border(color = navy, width = 0.75)) |>
    flextable::padding(padding.top = 4, padding.bottom = 4) |> flextable::padding(j = 1, padding.left = 0)
  flextable::body_add_flextable(doc, ft, align = "left")
}

#' Opciones de los índices normalizadas: lo que falte o no se entienda queda como hoy
#'
#' @param indices `NULL` o lista con `contenido` (lógico), `graficos` y `tablas` (`"inicio"`, `"anexo"` o `FALSE`; `TRUE` es
#'   `"inicio"`). Default = el de siempre: los tres al inicio.
#' @return `list(contenido, graficos, tablas)`.
#' @keywords internal
.word_indices_opciones <- function(indices = NULL) {
  ubic <- function(v) {
    v <- unlist(v)[1]
    if (is.null(v) || is.na(v)) return("inicio")
    if (is.logical(v)) return(if (v) "inicio" else "ninguno")
    if (tolower(trimws(as.character(v))) %in% c("inicio", "anexo", "ninguno")) tolower(trimws(as.character(v))) else "inicio"
  }
  cont <- unlist(indices$contenido)[1]
  list(contenido = if (is.logical(cont) && !is.na(cont)) cont else TRUE, graficos = ubic(indices$graficos), tablas = ubic(indices$tablas))
}

#' Índices del informe: «Contenido» (títulos 1 y 2), índice de gráficos y, si hay tablas, índice de tablas; todos campos
#' TOC de Word con la nota de cómo se actualizan (recetario_word.R:132-139)
#'
#' Escribe los que van en `donde` (`"inicio"`: la página de «Contenido», como siempre; `"anexo"`: la de cierre antes de la
#' contraportada). «Contenido» (el TOC) sólo existe al inicio.
#' @param con_tablas Si el informe tiene tablas numeradas.
#' @param indices Ver `.word_indices_opciones()`.
#' @param donde `"inicio"` o `"anexo"`.
#' @keywords internal
.word_indices <- function(doc, con_tablas = TRUE, indices = NULL, donde = c("inicio", "anexo")) {
  donde <- match.arg(donde); ind <- .word_indices_opciones(indices)
  navy <- .std_word("colores", "titulos")
  quiere <- c(contenido = identical(donde, "inicio") && isTRUE(ind$contenido), graficos = identical(ind$graficos, donde),
              tablas = isTRUE(con_tablas) && identical(ind$tablas, donde))
  if (!any(quiere)) return(doc)
  primero <- TRUE
  titulo <- function(doc, t, tam, antes, despues) { a <- if (primero) 0 else antes; primero <<- FALSE; .word_parr(doc, list(t, tam, navy, TRUE), antes = a, despues = despues) }
  if (quiere[["contenido"]]) {
    doc <- titulo(doc, "Contenido", 18, 0, 10)
    doc <- officer::body_add(doc, officer::block_toc(level = 2))
  }
  if (quiere[["graficos"]]) {
    doc <- titulo(doc, "Índice de gráficos", 13, 16, 6)
    doc <- officer::body_add(doc, officer::block_toc(seq_id = "Gráfico"))
  }
  if (quiere[["tablas"]]) {
    doc <- titulo(doc, "Índice de tablas", 13, 16, 6)
    doc <- officer::body_add(doc, officer::block_toc(seq_id = "Tabla"))
  }
  .word_parr(doc, list("Los índices son campos de Word: se actualizan con clic derecho > Actualizar campos, o seleccionando todo y presionando F9.",
                       8.5, .std_word("colores", "suave"), FALSE, TRUE), antes = 8)
}

#' Ruta de un logo del estándar (recortados de la plantilla: image1 = PUCP, image8 = PULSO PUCP, como `logo_tinta()`)
#' @keywords internal
.word_logo <- function(nombre = c("pucp", "pulso")) {
  nombre <- match.arg(nombre)
  # Al lado del JSON del estándar: `.std_ruta()` ya resuelve el paquete instalado, load_all y la raíz del repo.
  file.path(dirname(.std_ruta()), "logos", paste0("logo_", nombre, ".png"))
}

#' Ancho sobre alto de un PNG, leído de su cabecera (sin magick ni png)
#' @keywords internal
.word_png_aspecto <- function(f) {
  con <- file(f, "rb"); on.exit(close(con)); b <- readBin(con, "raw", 24L)
  ent <- function(x) sum(as.integer(x) * 256^(3:0))
  ent(b[17:20]) / ent(b[21:24])
}

#' Un logo propio del cliente si su ruta existe; si no, el del recetario (A6 R3: degrada, no aborta)
#' @keywords internal
.word_logo_o_recetario <- function(ruta, nombre) {
  ruta <- as.character(ruta %||% "")[1]
  if (!is.na(ruta) && nzchar(ruta) && file.exists(ruta)) ruta else .word_logo(nombre)
}

#' Logos de la primera página (`logos_ft()`): PUCP a la izquierda y PULSO PUCP a la derecha, 0.5 in de alto, para el
#' encabezado de la portada (`.word_cerrar_capitulo(primera = .word_logos())`)
#' @param logos Rutas de los logos propios del cliente (`portada_izquierda`, `portada_derecha`), ya resueltas por el
#'   router (`.graficos_estilo_cliente_resolver`); el lugar que no venga lleva el del recetario.
#' @keywords internal
.word_logos <- function(h = 0.5, logos = list()) {
  # Rutas con nombres que no sean columnas: compose() evalúa `value` dentro de los datos de la tabla (columnas a y b).
  logo_izq <- .word_logo_o_recetario(logos$portada_izquierda, "pucp")
  logo_der <- .word_logo_o_recetario(logos$portada_derecha, "pulso"); w <- .std_word("pagina", "ancho_util") / 2
  ft <- flextable::flextable(data.frame(a = "", b = "")) |> flextable::delete_part("header") |> flextable::border_remove() |>
    flextable::width(j = 1, width = w) |> flextable::width(j = 2, width = w) |>
    flextable::compose(j = 1, value = flextable::as_paragraph(flextable::as_image(src = logo_izq, width = h * .word_png_aspecto(logo_izq), height = h))) |>
    flextable::compose(j = 2, value = flextable::as_paragraph(flextable::as_image(src = logo_der, width = h * .word_png_aspecto(logo_der), height = h))) |>
    flextable::align(j = 1, align = "left") |> flextable::align(j = 2, align = "right") |> flextable::valign(valign = "center") |> flextable::padding(padding = 0)
  officer::block_list(ft)
}

#' Contraportada del informe (`contraportada()`, página 81): el logo de PULSO PUCP de 1 in al centro y el contacto debajo
#' en una línea de 8.5 pt. El contacto es el mismo de la lámina de cierre del PPT (`.lam_cierre_contacto`): el plan puede
#' reemplazar cada dato y uno vacío se omite. La sección anterior cierra con su salto de página.
#' @param contacto Lista con `correo`, `direccion`, `web` (lo que no venga usa el de PULSO PUCP).
#' @param logo Ruta del logo propio del cliente para la contraportada (o `NULL`: el de PULSO PUCP).
#' @keywords internal
.word_contraportada <- function(doc, contacto = list(), logo = NULL) {
  for (k in 1:14) doc <- officer::body_add_par(doc, "")
  logo <- .word_logo_o_recetario(logo, "pulso")
  doc <- officer::body_add_fpar(doc, officer::fpar(officer::external_img(logo, width = 1.0 * .word_png_aspecto(logo), height = 1.0),
                                                   fp_p = officer::fp_par(text.align = "center")))
  datos <- .lam_cierre_contacto(contacto)$dato
  if (!length(datos)) return(doc)
  .word_parr(doc, list(paste(datos, collapse = "     "), 8.5, .std_word("colores", "suave")), align = "center", antes = 24)
}
