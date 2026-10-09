# =============================================================================
# reporte_word_documento.R — el Word del recetario armado desde render_meta (N8.15)
# =============================================================================
#
# La fachada del documento completo (ADR 0093; Gonzalo, R9: «El documento completo»): portada con los logos, índices,
# «Cómo leer este informe» cuando hay escalas, un capítulo por sección de nivel 1 con su apertura, encabezado y folio,
# las figuras con su rótulo SEQ, base y renderer del recetario (`.word_grafico`), las tablas técnicas y la contraportada.
# Recorre la misma `render_meta` que el Word clásico (`reporte_word_plan`), que lo llama con
# `estilo_documento = "recetario"`.

# Un texto de una entrada: NULL, NA o vacío dan "" (as.character(NULL)[1] es NA).
.word_txt1 <- function(x) { x <- as.character(x %||% ""); if (!length(x) || is.na(x[1])) "" else trimws(x[1]) }

# Siglas que se conservan al pasar un título en mayúsculas a tipo oración.
.WORD_SIGLAS <- c("PUCP", "PULSO", "ACNUR", "UNSA", "SPSS", "ONG", "IA", "TI", "PDM", "CBI", "KOICA", "MEF", "INEI", "SUNEDU", "SINEACE", "ACRD")

#' Un título escrito todo en mayúsculas (convención del PPT fiel) pasa a tipo oración como en el recetario Word,
#' conservando las siglas; uno con minúsculas queda como está
#' @keywords internal
.word_oracion <- function(x) {
  x <- .word_txt1(x)
  letras <- gsub("[^[:alpha:]]", "", x)
  if (nchar(letras) < 4L || letras != toupper(letras)) return(x)
  p <- strsplit(tolower(x), " ", fixed = TRUE)[[1]]
  orig <- strsplit(x, " ", fixed = TRUE)[[1]]
  sig <- gsub("[^[:alpha:]]", "", orig) %in% .WORD_SIGLAS
  p[sig] <- orig[sig]
  out <- paste(p, collapse = " ")
  paste0(toupper(substr(out, 1, 1)), substr(out, 2, nchar(out)))
}

#' Título corto del encabezado: el que se dé o el título del informe cortado en la última palabra antes de 60 caracteres
#' @keywords internal
.word_titulo_corto <- function(titulo, dado = NULL, max = 60L) {
  if (nzchar(.word_txt1(dado))) return(.word_txt1(dado))
  t <- .word_oracion(titulo)
  if (nchar(t) <= max) return(t)
  corte <- substr(t, 1, max); corte <- sub("\\s+\\S*$", "", corte)
  paste0(sub("[,;:]$", "", corte), "…")
}

#' Arma el Word del recetario desde `render_meta`
#'
#' @param render_meta Lista de entradas de `reporte_ppt_plan(solo_lista = TRUE, build_render_meta = TRUE)`.
#' @param path_docx Archivo de salida.
#' @param fuente Fuente que cierra cada base («Fuente: PULSO PUCP 2026.»).
#' @param opciones Lista: `portada` («A», «B», «C»), `apertura` («B», «A»), `como_leer` (`NULL` = si hay escalas),
#'   `redondeo` («estandar», «resto_mayor»), `contacto` (para la contraportada), `meta_portada` (ante, para, version...).
#' @return Invisible: `list(path, figuras, tablas, avisos)`.
#' @keywords internal
.word_documento <- function(render_meta, path_docx, fuente = NULL, opciones = list(), mensajes = FALSE) {
  op <- utils::modifyList(list(portada = "A", apertura = "B", como_leer = NULL, redondeo = "estandar", contacto = list(), meta_portada = list()), opciones)
  avisos <- character(0); avisar <- function(...) { m <- paste0(...); avisos <<- c(avisos, m); message("[PULSO-AVISO] ", m) }
  base_de <- function(e) {
    partes <- c(if (nzchar(trimws(as.character(e$base %||% "")[1]))) trimws(as.character(e$base)[1]),
                if (!isTRUE(e$base_multi_source) && nzchar(trimws(as.character(fuente %||% "")[1]))) trimws(as.character(fuente)[1]))
    if (length(partes)) paste(partes, collapse = " ") else NULL
  }
  tit <- Filter(function(e) identical(e$kind, "title_doc"), render_meta)
  titulo_informe <- if (length(tit) && nzchar(.word_txt1(tit[[1]]$title))) .word_oracion(tit[[1]]$title) else "Informe"
  titulo_corto <- .word_titulo_corto(titulo_informe, op$titulo_corto)
  hay_escalas <- any(vapply(render_meta, function(e) identical(e$kind %||% "chart", "chart") &&
                              identical(as.character((attr(e$plot_word, "pulso_espec") %||% list())$tipo %||% "")[1], "escala"), TRUE))
  hay_bottom <- any(vapply(render_meta, function(e) {
    esp <- attr(e$plot_word, "pulso_espec"); is.list(esp) && !is.null(esp$box2)
  }, TRUE))
  con_tablas <- any(vapply(render_meta, function(e) identical(e$kind, "technical_table"), TRUE))

  # B55: los PNG de cada figura (y la copia que officer hace al insertarlos) viven en tempdir() hasta que print(doc)
  # empaqueta el docx; se borran al salir, también si algo falla antes.
  pngs_antes <- list.files(tempdir(), pattern = "\\.png$", full.names = TRUE)
  on.exit(unlink(setdiff(list.files(tempdir(), pattern = "\\.png$", full.names = TRUE), pngs_antes)), add = TRUE)
  doc <- .word_documento_nuevo()
  # Portada sola en su página, con los logos en el encabezado de la primera página.
  t1 <- if (length(tit)) tit[[1]] else list()
  meta <- utils::modifyList(list(titulo = titulo_informe, sub = .word_txt1(t1$subtitle), fecha = .word_txt1(t1$date)), op$meta_portada)
  doc <- .word_portada(doc, meta, op$portada)
  doc <- .word_cerrar_capitulo(doc, "", titulo_corto, primera = .word_logos())
  doc <- .word_indices(doc, con_tablas = con_tablas)
  doc <- .word_cerrar_capitulo(doc, "Contenido", titulo_corto)

  figura <- 1L; tabla <- 1L; cap <- 0L; sec <- 0L; cap_titulo <- NULL
  cerrar <- function(doc) if (is.null(cap_titulo)) doc else .word_cerrar_capitulo(doc, cap_titulo, titulo_corto)
  if (isTRUE(op$como_leer %||% hay_escalas)) {
    cap <- cap + 1L
    doc <- .word_como_leer(doc, numero = cap, redondeo = op$redondeo, con_bottom = hay_bottom, figura = figura, tabla = tabla, variante_apertura = op$apertura)
    sig <- attr(doc, "siguientes"); figura <- sig[["figura"]]; tabla <- sig[["tabla"]]
    cap_titulo <- "Cómo leer este informe"
  }
  for (i in seq_along(render_meta)) {
    e <- render_meta[[i]]; kind <- e$kind %||% "chart"
    if (isTRUE(mensajes)) message(sprintf("  Word %03d/%03d — %s", i, length(render_meta), kind))
    if (identical(kind, "title_doc")) next
    if (identical(kind, "section")) {
      nivel <- suppressWarnings(as.integer(e$meta$word_heading_level %||% 1L)[1]); if (!is.finite(nivel)) nivel <- 1L
      titulo <- .word_oracion(sub("^\\s*\\d+(?:\\.\\d+)*\\.?\\s+", "", .word_txt1(e$title), perl = TRUE))
      if (nivel <= 1L) {
        doc <- cerrar(doc); cap <- cap + 1L; sec <- 0L; cap_titulo <- titulo
        doc <- .word_apertura(doc, cap, titulo, intro = .word_txt1(e$word_intro %||% e$subtitle), variante = op$apertura)
      } else {
        sec <- sec + 1L
        doc <- .word_seccion(doc, titulo, if (cap > 0L) paste0(cap, ".", sec) else NULL)
        doc <- .word_entrada(doc, .word_txt1(e$subtitle))
      }
      next
    }
    if (identical(kind, "technical_table")) {
      if (is.data.frame(e$table) && nrow(e$table)) { doc <- .word_tabla_tecnica(doc, tabla, e); tabla <- tabla + 1L }
      else avisar("La tabla técnica «", e$title %||% "", "» no trae filas y no entra al Word.")
      next
    }
    if (!identical(kind, "chart")) next
    p <- e$plot_word
    # Un dibujo sin título ni espec (la lámina de objetivo con íconos del PPT) no es una figura del informe Word.
    if (identical(e$etype, "ggplot_raw") && !nzchar(.word_txt1(e$title)) && is.null(attr(p, "pulso_espec"))) {
      avisar("Un dibujo sin título de la lámina ", i, " (íconos de identidad del PPT) no entra al Word como figura."); next }
    if (!inherits(p, "ggplot")) { avisar("El gráfico «", e$title %||% i, "» no tiene dibujo para el Word y se omite."); next }
    g <- tryCatch(.word_grafico(p), error = function(err) { avisar("El gráfico «", e$title %||% i, "» no se pudo dibujar: ", conditionMessage(err)); NULL })
    if (is.null(g)) next
    ancho <- attr(g, "ancho") %||% .std_word("pagina", "ancho_util")
    png <- .word_png(g, attr(g, "alto"), ancho = ancho)
    doc <- .word_figura(doc, figura, .word_oracion(e$title), png, alto = attr(g, "alto"), ancho = ancho, base = base_de(e))
    figura <- figura + 1L
  }
  doc <- cerrar(doc)
  doc <- .word_contraportada(doc, op$contacto)
  print(doc, target = path_docx)
  .docx_conformar(path_docx, revista = TRUE)
  invisible(list(path = path_docx, figuras = figura - 1L, tablas = tabla - 1L, avisos = avisos))
}
