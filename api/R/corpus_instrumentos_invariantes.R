# Corpus de instrumentos reales — corrida del motor del papel e invariantes.
#
# Grano de la evidencia: instrumento canonico x modo (pdf|docx x columnas
# 1|2|auto). Cada modo corre el camino del editor: hojas desde el workbook ->
# titulo con `.xlsform_editor_export_titulo` -> `formulario_pdf_build_model` ->
# `formulario_pdf_render` | `formulario_word_render` (el mismo par que el job
# `xlsform_editor_export_job_runner`). Los invariantes se miden EN EL ARTEFACTO
# (trampa 3 del GOAL), nunca en el modelo.
#
# Invariantes PDF:
#   fuente   solo LiberationSansNarrow*; otra familia solo si el modelo avisa
#            «La fuente del PDF no tiene N caracter(es)...» (reporte_formulario_fuente.R)
#   marcado  cero etiquetas HTML, `**` y `#` literales en `pdftotext`
#   marco    ninguna palabra fuera del marco de pagina (`pdftotext -bbox`); el
#            marco es el del gate §4 de test-xlsform-formulario-pdf.R
#   pie      cada pagina k dice «k de N», con N = paginas reales
# Invariantes Word:
#   xml      todas las partes XML del .docx parsean con xml2
#   fuente   todo `w:rFonts` (document, styles, numbering) es Arial Narrow
#   escape   cero `<` y `&amp;` en el texto de `w:t` (HTML crudo o doble escape)

.CORPUS_MARCO <- list(x0 = 0.045, x1 = 0.940, y0 = 0.025, y1 = 0.990)
.CORPUS_AVISO_GLIFOS <- "La fuente del PDF no tiene"
.CORPUS_MODOS <- data.frame(
  formato = rep(c("pdf", "docx"), each = 3L),
  columnas = rep(c("1", "2", "auto"), 2L),
  stringsAsFactors = FALSE
)

.corpus_bin <- function(nm) {
  b <- Sys.which(nm)
  if (!nzchar(b)) stop(sprintf("falta la herramienta `%s` (poppler)", nm))
  b
}

.corpus_sys <- function(bin, args) {
  suppressWarnings(system2(bin, args, stdout = TRUE, stderr = FALSE))
}

# Renderiza un modo. Devuelve list(ok, error, segundos, path, summary, warnings).
.corpus_render <- function(frames, formato, columnas, out_file, filename = "formulario") {
  opciones <- list(columns = if (identical(columnas, "auto")) "auto" else as.integer(columnas))
  opciones <- .xlsform_editor_export_titulo(opciones, frames$settings, paste0(filename, ".", formato))
  t0 <- proc.time()[["elapsed"]]
  avisos_r <- character(0)
  res <- withCallingHandlers(
    tryCatch({
      model <- formulario_pdf_build_model(
        survey = frames$survey, choices = frames$choices, settings = frames$settings,
        paper = frames$paper, options = opciones)
      if (identical(formato, "docx")) formulario_word_render(model, out_file)
      else formulario_pdf_render(model, out_file)
      list(ok = TRUE, error = NA_character_, summary = model$summary,
           warnings = as.character(unlist(model$warnings %||% character(0))))
    }, error = function(e) {
      list(ok = FALSE, error = .corpus_causa(e), summary = list(), warnings = character(0))
    }),
    warning = function(w) {
      avisos_r <<- c(avisos_r, conditionMessage(w))
      invokeRestart("muffleWarning")
    })
  res$segundos <- round(proc.time()[["elapsed"]] - t0, 2)
  res$avisos_r <- unique(avisos_r)
  res$path <- out_file
  res
}

# Causa legible de un error, con la llamada que lo lanzo (para localizarlo).
.corpus_causa <- function(e) {
  llamada <- tryCatch(paste(deparse(conditionCall(e), nlines = 1L), collapse = ""),
                      error = function(x) "")
  code <- if (inherits(e, "api_error")) paste0(e$code %||% "", ": ") else ""
  msg <- paste0(code, conditionMessage(e))
  if (nzchar(llamada)) msg <- paste0(msg, " [en ", substr(llamada, 1, 120), "]")
  gsub("[\r\n]+", " ", msg)
}

# --- PDF ---------------------------------------------------------------------

.corpus_pdf_paginas <- function(path) {
  info <- .corpus_sys(.corpus_bin("pdfinfo"), shQuote(path))
  as.integer(sub("^Pages:\\s+", "", grep("^Pages:", info, value = TRUE)[1]))
}

.corpus_pdf_fuentes <- function(path) {
  l <- .corpus_sys(.corpus_bin("pdffonts"), shQuote(path))
  l <- l[-(1:2)]
  if (!length(l)) return(character(0))
  unique(sub("^[A-Z]{6}\\+", "", sub("\\s.*$", "", l)))
}

# Palabras con caja en NPC (origen abajo-izquierda), como el gate §4.
.corpus_pdf_palabras <- function(path) {
  xhtml <- .corpus_sys(.corpus_bin("pdftotext"), c("-bbox", shQuote(path), "-"))
  doc <- xml2::read_xml(paste(xhtml, collapse = "\n"))
  ns <- xml2::xml_ns(doc)
  paginas <- xml2::xml_find_all(doc, "//d1:page", ns)
  filas <- lapply(seq_along(paginas), function(i) {
    p <- paginas[[i]]
    W <- as.numeric(xml2::xml_attr(p, "width")); H <- as.numeric(xml2::xml_attr(p, "height"))
    w <- xml2::xml_find_all(p, ".//d1:word", ns)
    if (!length(w)) return(NULL)
    data.frame(page = i, texto = xml2::xml_text(w),
               x0 = as.numeric(xml2::xml_attr(w, "xMin")) / W,
               x1 = as.numeric(xml2::xml_attr(w, "xMax")) / W,
               y0 = 1 - as.numeric(xml2::xml_attr(w, "yMax")) / H,
               y1 = 1 - as.numeric(xml2::xml_attr(w, "yMin")) / H,
               stringsAsFactors = FALSE)
  })
  do.call(rbind, filas)
}

.corpus_pdf_texto_paginas <- function(path, n) {
  vapply(seq_len(n), function(k) {
    paste(.corpus_sys(.corpus_bin("pdftotext"), c("-layout", "-f", k, "-l", k, shQuote(path), "-")),
          collapse = "\n")
  }, character(1))
}

# Marcado literal que no debio llegar al papel. Devuelve un vector de muestras.
.corpus_marcado_literal <- function(texto) {
  pats <- c(etiqueta = "<\\s*/?\\s*[A-Za-z][A-Za-z0-9]*(\\s[^<>]*)?/?>",
            asteriscos = "\\*\\*",
            almohadilla = "#")
  out <- character(0)
  for (nm in names(pats)) {
    m <- regmatches(texto, gregexpr(paste0(".{0,18}", pats[[nm]], ".{0,18}"), texto, perl = TRUE))[[1]]
    if (length(m)) out <- c(out, paste0(nm, ": «", trimws(m), "»"))
  }
  out
}

.corpus_invariantes_pdf <- function(path, warnings = character(0)) {
  n <- .corpus_pdf_paginas(path)
  fuentes <- .corpus_pdf_fuentes(path)
  ajenas <- fuentes[!grepl("^LiberationSansNarrow", fuentes)]
  aviso_glifos <- any(grepl(.CORPUS_AVISO_GLIFOS, warnings, fixed = TRUE))
  textos <- .corpus_pdf_texto_paginas(path, n)
  marcado <- .corpus_marcado_literal(paste(textos, collapse = "\n"))
  pal <- .corpus_pdf_palabras(path)
  fuera <- if (is.null(pal)) pal[0, ] else pal[
    pal$x0 < .CORPUS_MARCO$x0 | pal$x1 > .CORPUS_MARCO$x1 |
      pal$y0 < .CORPUS_MARCO$y0 | pal$y1 > .CORPUS_MARCO$y1, , drop = FALSE]
  pie_mal <- which(!vapply(seq_len(n), function(k) {
    grepl(sprintf("(^|\\s)%d de %d(\\s|$)", k, n), textos[[k]])
  }, logical(1)))
  list(
    paginas = n,
    fuentes = paste(fuentes, collapse = "|"),
    fuente_ok = !length(ajenas) || aviso_glifos,
    fuente_ajena = paste(ajenas, collapse = "|"),
    fuente_exceptuada = length(ajenas) > 0 && aviso_glifos,
    marcado_ok = !length(marcado),
    marcado = paste(utils::head(marcado, 6), collapse = " / "),
    n_marcado = length(marcado),
    marco_ok = !nrow(fuera),
    n_fuera_marco = nrow(fuera),
    fuera_marco = if (nrow(fuera)) paste(utils::head(sprintf("p%d «%s» x[%.3f,%.3f] y[%.3f,%.3f]",
      fuera$page, fuera$texto, fuera$x0, fuera$x1, fuera$y0, fuera$y1), 6), collapse = " / ") else "",
    pie_ok = !length(pie_mal),
    pie_mal = paste(pie_mal, collapse = "|")
  )
}

# --- Word --------------------------------------------------------------------

.corpus_invariantes_docx <- function(path) {
  d <- tempfile("corpus_docx_"); on.exit(unlink(d, recursive = TRUE), add = TRUE)
  partes <- tryCatch(utils::unzip(path, exdir = d), error = function(e) character(0))
  xmls <- partes[grepl("\\.(xml|rels)$", partes)]
  malos <- character(0)
  docs <- list()
  for (p in xmls) {
    x <- tryCatch(xml2::read_xml(p), error = function(e) NULL)
    if (is.null(x)) malos <- c(malos, sub(paste0("^", d, "/?"), "", p)) else docs[[sub(paste0("^", d, "/?"), "", p)]] <- x
  }
  doc <- docs[["word/document.xml"]]
  if (is.null(doc)) {
    return(list(xml_ok = FALSE, xml_malos = paste(c(malos, "sin word/document.xml"), collapse = "|"),
                fuente_ok = FALSE, fuentes = "", escape_ok = FALSE, escape = "", n_escape = NA_integer_,
                n_wt = 0L))
  }
  ns_w <- c(w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
  de_nodos <- function(nodos) {
    out <- character(0)
    for (a in c("ascii", "hAnsi", "cs", "eastAsia")) {
      v <- xml2::xml_attr(nodos, paste0("w:", a), ns = ns_w)
      out <- c(out, v[!is.na(v)])
    }
    out
  }
  # Fuentes que el documento PUEDE pintar: runs del cuerpo, cabeceras y pies,
  # docDefaults y los estilos que el documento usa (con su cadena basedOn).
  # Los estilos de la plantilla que nadie referencia (p. ej. «Textedebulles» con
  # Lucida Grande en la plantilla por defecto de officer) no se imprimen: se
  # informan aparte, no fallan el invariante.
  partes_texto <- grep("^word/(document|header[0-9]*|footer[0-9]*)\\.xml$", names(docs), value = TRUE)
  fuentes <- unlist(lapply(partes_texto, function(nm) de_nodos(xml2::xml_find_all(docs[[nm]], "//w:rFonts", ns_w))))
  sin_uso <- character(0)
  st <- docs[["word/styles.xml"]]
  if (!is.null(st)) {
    fuentes <- c(fuentes, de_nodos(xml2::xml_find_all(st, "//w:docDefaults//w:rFonts", ns_w)))
    usados <- unique(unlist(lapply(partes_texto, function(nm) xml2::xml_attr(
      xml2::xml_find_all(docs[[nm]], "//w:pStyle|//w:rStyle|//w:tblStyle", ns_w), "w:val", ns = ns_w))))
    estilos <- xml2::xml_find_all(st, "//w:style", ns_w)
    ids <- xml2::xml_attr(estilos, "w:styleId", ns = ns_w)
    por_defecto <- ids[xml2::xml_attr(estilos, "w:default", ns = ns_w) %in% c("1", "true")]
    usados <- unique(c(usados, por_defecto))
    repeat {
      ix <- match(usados, ids); ix <- ix[!is.na(ix)]
      extra <- unlist(lapply(estilos[ix], function(s) xml2::xml_attr(
        xml2::xml_find_all(s, "./w:basedOn|./w:link", ns_w), "w:val", ns = ns_w)))
      nuevos <- setdiff(extra[!is.na(extra)], usados)
      if (!length(nuevos)) break
      usados <- c(usados, nuevos)
    }
    for (k in seq_along(estilos)) {
      f <- de_nodos(xml2::xml_find_all(estilos[[k]], ".//w:rFonts", ns_w))
      if (ids[k] %in% usados) fuentes <- c(fuentes, f) else sin_uso <- c(sin_uso, f)
    }
  }
  fuentes <- unique(fuentes)
  sin_uso <- setdiff(unique(sin_uso), fuentes)
  textos <- character(0)
  for (nm in grep("^word/(document|header[0-9]*|footer[0-9]*)\\.xml$", names(docs), value = TRUE)) {
    textos <- c(textos, xml2::xml_text(xml2::xml_find_all(docs[[nm]], "//w:t", ns_w)))
  }
  malo <- textos[grepl("<|&amp;|&lt;|&gt;", textos)]
  list(
    xml_ok = !length(malos),
    xml_malos = paste(malos, collapse = "|"),
    fuente_ok = length(fuentes) > 0 && all(fuentes == "Arial Narrow"),
    fuentes = paste(fuentes, collapse = "|"),
    fuentes_estilos_sin_uso = paste(sin_uso, collapse = "|"),
    escape_ok = !length(malo),
    escape = paste(utils::head(substr(malo, 1, 60), 4), collapse = " / "),
    n_escape = length(malo),
    n_wt = length(textos)
  )
}

# Paginas del .docx segun su propio metadato (docProps/app.xml, si Word lo
# escribio). officer no lo calcula: NA es lo esperado.
.corpus_docx_paginas <- function(path) {
  d <- tempfile("corpus_app_"); on.exit(unlink(d, recursive = TRUE), add = TRUE)
  f <- tryCatch(utils::unzip(path, files = "docProps/app.xml", exdir = d), error = function(e) character(0))
  if (!length(f) || !file.exists(f)) return(NA_integer_)
  x <- xml2::read_xml(f)
  v <- xml2::xml_text(xml2::xml_find_first(x, "//*[local-name()='Pages']"))
  suppressWarnings(as.integer(v))
}

# Corre un modo y mide sus invariantes. Una fila de resultados.csv.
.corpus_correr_modo <- function(frames, formato, columnas, out_file, filename) {
  r <- .corpus_render(frames, formato, columnas, out_file, filename)
  fila <- list(
    formato = formato, columnas = columnas,
    ok = r$ok, error = r$error %||% NA_character_, segundos = r$segundos,
    n_questions = as.integer(r$summary$n_questions %||% NA_integer_),
    n_warnings = length(r$warnings),
    warnings = paste(substr(r$warnings, 1, 220), collapse = " || "),
    avisos_r = paste(utils::head(r$avisos_r, 3), collapse = " || "),
    artefacto = if (r$ok && file.exists(out_file)) out_file else "",
    sha256 = if (r$ok && file.exists(out_file)) .corpus_sha256_file(out_file) else "",
    bytes = if (r$ok && file.exists(out_file)) as.numeric(file.info(out_file)$size) else NA_real_
  )
  if (!isTRUE(r$ok)) return(fila)
  inv <- tryCatch(
    if (identical(formato, "pdf")) .corpus_invariantes_pdf(out_file, r$warnings)
    else c(list(paginas = .corpus_docx_paginas(out_file)), .corpus_invariantes_docx(out_file)),
    error = function(e) list(invariantes_error = .corpus_causa(e)))
  c(fila, inv)
}

# Veredicto de una fila: TRUE si no fallo y todos los invariantes del formato pasan.
.corpus_fila_conforme <- function(fila) {
  if (!isTRUE(as.logical(fila$ok))) return(FALSE)
  checks <- if (identical(fila$formato, "pdf")) c("fuente_ok", "marcado_ok", "marco_ok", "pie_ok")
            else c("xml_ok", "fuente_ok", "escape_ok")
  all(vapply(checks, function(k) isTRUE(as.logical(fila[[k]])), logical(1)))
}
