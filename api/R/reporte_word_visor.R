# Visor del documento Word del recetario: páginas reales y mapa de capítulos (F6.0b.4; dirección F6 §4 «Documento Word»).
#
# El editor muestra «la última versión exportada» del Word: sus páginas como imágenes y un esquema que lleva a cada
# capítulo y sección. El DOCX se convierte una vez a PDF con LibreOffice, cada página se rasteriza con pdftools y el texto
# de cada página da el mapa: el encabezado corrido nombra el capítulo vigente, «CAPÍTULO n» marca dónde empieza y las
# secciones van numeradas («2.4. Cifras muy pequeñas»). Medido sobre acrconta (2026-10-09): 59 páginas.
#
# LibreOffice no rellena los campos TOC (Word sí, al abrir): el visor lo avisa en vez de mostrar un índice vacío como si
# fuera el entregable.

#' Mapa de capítulos y secciones a partir del texto de cada página
#'
#' @param textos Vector de caracteres, uno por página (`pdftools::pdf_text`).
#' @return `list(capitulos, secciones, paginas, indice_vacio)`: `capitulos` con `numero`, `titulo`, `desde` y `hasta`;
#'   `secciones` con `numero`, `titulo`, `pagina`; `paginas` con el capítulo de cada página (`NA` en portada e índices);
#'   `indice_vacio` si la página «Contenido» no trae entradas (LibreOffice no resuelve el TOC).
#' @keywords internal
.word_visor_mapa <- function(textos) {
  lineas <- lapply(textos, function(t) { l <- trimws(strsplit(t %||% "", "\n", fixed = TRUE)[[1]]); l[nzchar(l)] })
  n <- length(lineas)
  capitulos <- list(); secciones <- list()
  for (p in seq_len(n)) {
    l <- lineas[[p]]
    k <- grep("^CAP[IÍ]TULO\\s+([0-9]+)$", l)
    if (length(k) && k[1] < length(l)) {
      # Un título largo ocupa dos líneas: la segunda se une si la primera queda colgando («…administrativa y») o si la
      # siguiente empieza en minúscula.
      j <- k[1] + 1L; titulo <- l[j]
      while (j < length(l) && (grepl("(,|\\s(y|e|o|de|del|la|las|los|el|en|con|para|por))$", titulo) || grepl("^[[:lower:]]", l[j + 1L]))) {
        j <- j + 1L; titulo <- paste(titulo, l[j])
      }
      capitulos[[length(capitulos) + 1L]] <- list(numero = sub("^CAP[IÍ]TULO\\s+", "", l[k[1]]), titulo = titulo, desde = p)
    }
    for (s in grep("^([0-9]+\\.[0-9]+)\\.\\s+\\S", l, value = TRUE)) {
      secciones[[length(secciones) + 1L]] <- list(numero = sub("^([0-9]+\\.[0-9]+)\\..*$", "\\1", s),
                                                  titulo = sub("^[0-9]+\\.[0-9]+\\.\\s+", "", s), pagina = p)
    }
  }
  for (i in seq_along(capitulos)) {
    capitulos[[i]]$hasta <- if (i < length(capitulos)) capitulos[[i + 1L]]$desde - 1L else n
  }
  cap_de <- rep(NA_character_, n)
  for (c in capitulos) cap_de[c$desde:c$hasta] <- c$numero
  pag_contenido <- which(vapply(lineas, function(l) any(l == "Contenido"), logical(1)))[1]
  indice_vacio <- !is.na(pag_contenido) &&
    !any(grepl("\\.{3,}|\\s[0-9]+$", utils::tail(lineas[[pag_contenido]], -2L)))
  list(capitulos = capitulos, secciones = secciones,
       paginas = lapply(seq_len(n), function(p) list(numero = p, capitulo = cap_de[p])),
       indice_vacio = isTRUE(indice_vacio))
}

#' Páginas del Word como PNG y su mapa de capítulos
#'
#' @param docx_path El DOCX exportado.
#' @param out_dir Carpeta donde quedan `pagina_NNN.png` y el PDF.
#' @param dpi Resolución de las páginas (60 basta para el visor; la página abierta puede pedirse aparte).
#' @return `list(n, archivos, mapa)`, o `NULL` si no hay LibreOffice o pdftools.
#' @keywords internal
.word_visor_paginas <- function(docx_path, out_dir, dpi = 60, timeout = 60) {
  if (!requireNamespace("pdftools", quietly = TRUE)) return(NULL)
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  pdf <- .pptx_to_pdf_soffice(docx_path, out_dir, timeout = timeout)   # LibreOffice convierte cualquier documento a PDF
  if (is.null(pdf)) return(NULL)
  n <- pdftools::pdf_info(pdf)$pages
  archivos <- vapply(seq_len(n), function(p) {
    destino <- file.path(out_dir, sprintf("pagina_%03d.png", p))
    png::writePNG(pdftools::pdf_render_page(pdf, page = p, dpi = dpi, numeric = TRUE), destino)
    destino
  }, character(1))
  list(n = n, archivos = archivos, mapa = .word_visor_mapa(pdftools::pdf_text(pdf)))
}
