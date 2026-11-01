# =============================================================================
# xlsform_editor_word_visor.R — páginas reales del Word del cuestionario (L36 · DOC.2)
# =============================================================================
#
# «Previsualizar» ya mostraba el PDF. L36 pide ver el Word, que es el entregable
# editable, como páginas reales y saber en qué página cae cada pregunta: es la
# base de DOC.3 (bloques seleccionables). Un solo job arma el modelo, dibuja el
# .docx con el mismo `formulario_word_render`, lo pasa a PDF con LibreOffice y
# rasteriza cada página. El .docx se registra como cualquier export: lo que se
# ve es lo que se descarga. Diseño: docs/qa/l36-doc0-direccion-cuestionario-2026-11-01.md
# (D-L36-9 a D-L36-12).

#' Números impresos del modelo, en orden: preguntas (`7`) e ítems de matriz (`8.1`)
#' @keywords internal
.cuestionario_numeros_del_modelo <- function(model) {
  nums <- character(0)
  for (b in model$blocks %||% list()) {
    if (identical(b$kind, "question")) nums <- c(nums, .form_pdf_clean_text(b$number %||% ""))
    if (identical(b$kind, "matrix")) {
      for (it in b$items %||% list()) nums <- c(nums, .form_pdf_clean_text(it$number %||% ""))
    }
  }
  unique(nums[nzchar(nums)])
}

#' Página en que empieza cada pregunta, a partir del texto de cada página
#'
#' Sólo se buscan los números que el modelo imprimió (D-L36-10): una pregunta
#' `7` es una línea que empieza con «7.» y un ítem `8.1`, una que empieza con
#' «8.1». Así un código de opción («1 Técnico») o una celda de escala no se
#' confunden con una pregunta. Un número que no aparece queda con `pagina = NA`.
#'
#' @param textos Un texto por página (`pdftools::pdf_text`).
#' @param numeros Números impresos, en el orden del modelo.
#' @return `list(list(numero, pagina), ...)`.
#' @keywords internal
.cuestionario_visor_mapa <- function(textos, numeros) {
  lineas <- lapply(textos, function(t) trimws(strsplit(t %||% "", "\n", fixed = TRUE)[[1]]))
  # Los números impresos sólo llevan cifras y puntos: basta con escapar el punto.
  escapar <- function(x) gsub(".", "\\.", x, fixed = TRUE)
  lapply(numeros, function(num) {
    patron <- if (grepl(".", num, fixed = TRUE)) {
      paste0("^", escapar(num), "(\\s|$)")
    } else {
      paste0("^", escapar(num), "\\.(\\s|$)")
    }
    pagina <- NA_integer_
    for (p in seq_along(lineas)) {
      if (any(grepl(patron, lineas[[p]]))) { pagina <- p; break }
    }
    list(numero = num, pagina = pagina)
  })
}

# Worker del job (subproceso callr). Misma firma que `xlsform_editor_export_job_runner`
# para compartir el handler de export; `formato` no se usa: siempre es docx.
xlsform_editor_word_visor_job_runner <- function(input_path, formato, fail_code, fail_message,
                                                 result_path, progress_path = NULL) {
  progreso <- job_progress_writer(progress_path)
  tryCatch({
    p <- readRDS(input_path)
    progreso("modelo", percent = 10, message = "Armando el modelo")
    model <- formulario_pdf_build_model(
      survey = p$survey, choices = p$choices, settings = p$settings,
      paper = p$paper, options = p$options
    )
    if (!requireNamespace("pdftools", quietly = TRUE)) stop("falta pdftools para rasterizar el Word")
    out_dir <- paste0(result_path, "_paginas")
    dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
    # officer y LibreOffice exigen la extensión .docx: se dibuja con ella y se
    # copia al resultado del job, que es lo que registra on_complete.
    docx <- file.path(out_dir, "cuestionario.docx")
    progreso("dibujando", percent = 30, message = "Dibujando el Word")
    formulario_word_render(model, docx)
    file.copy(docx, result_path, overwrite = TRUE)
    progreso("paginas", percent = 55, message = "Convirtiendo a páginas")
    pdf <- .pptx_to_pdf_soffice(docx, out_dir, timeout = 90)
    if (is.null(pdf)) stop("LibreOffice no convirtió el Word a PDF")
    n <- pdftools::pdf_info(pdf)$pages
    archivos <- vapply(seq_len(n), function(k) {
      destino <- file.path(out_dir, sprintf("pagina_%03d.png", k))
      png::writePNG(pdftools::pdf_render_page(pdf, page = k, dpi = 60, numeric = TRUE), destino)
      destino
    }, character(1))
    progreso("mapa", percent = 90, message = "Ubicando las preguntas")
    mapa <- .cuestionario_visor_mapa(pdftools::pdf_text(pdf), .cuestionario_numeros_del_modelo(model))
    list(ok = TRUE, summary = model$summary, warnings = model$warnings,
         n = n, archivos = archivos, mapa = mapa)
  }, error = function(e) .xlsform_editor_export_error(e, fail_code, fail_message))
}

# `on_complete` (proceso principal): registra el .docx como el export de Word y
# agrega las páginas como data URI y el mapa. Nunca lanza.
.xlsform_editor_word_visor_on_complete <- function(sid, spec, filename) {
  base <- .xlsform_editor_export_on_complete(sid, spec, filename)
  function(j) {
    data <- j$result_data %||% list()
    archivos <- as.character(unlist(data$archivos %||% character(0)))
    salida <- base(j)
    if (!isTRUE(salida$ok)) return(salida)
    paginas <- vapply(archivos[file.exists(archivos)], function(f) {
      paste0("data:image/png;base64,", jsonlite::base64_enc(readBin(f, "raw", file.info(f)$size)))
    }, character(1), USE.NAMES = FALSE)
    # Las páginas ya viajan en la respuesta: su carpeta temporal sobra.
    if (length(archivos)) unlink(dirname(archivos[1]), recursive = TRUE)
    salida$n <- as.integer(data$n %||% length(paginas))
    salida$paginas <- I(paginas)
    salida$mapa <- data$mapa %||% list()
    salida
  }
}
attr(xlsform_editor_word_visor_job_runner, "prosecnur_job_function_name") <- "xlsform_editor_word_visor_job_runner"
