# Motor Word (.docx) del cuestionario en papel.
#
# SEGUNDO renderer del MISMO modelo que el PDF: reutiliza
# `formulario_pdf_build_model()` (agnostico del renderer) y lo pinta con
# officer + flextable, replicando las caracteristicas del motor PDF
# (`reporte_formulario_pdf.R`): portada con titulo grande, bandas de seccion
# navy, matrices Likert con cabecera extremos/categorias + columna especial +
# tenor con subnumeracion X.1/X.2, listas de opciones codificadas, y los dos
# lenguajes de logica (saltos / condiciones). Comparte helpers internos del PDF
# (`.form_pdf_matrix_partition_options`, `.form_pdf_matrix_header_mode`,
# `.form_pdf_matrix_label_frac`, `.form_pdf_clean_text`) para no duplicar dominio.

.FORM_WORD_NAVY  <- "#002457"
.FORM_WORD_SOFT  <- "#5A6B85"
.FORM_WORD_INK   <- "#1A1A1A"
.FORM_WORD_ZEBRA <- "#F1F4F9"
.FORM_WORD_LINE  <- "#C7D0E0"

# Ancho util aproximado de una carta con margenes por defecto de officer (pulg).
.FORM_WORD_USABLE_IN <- 6.3

# Parrafo con formato. Devuelve el doc (officer es inmutable: hay que reasignar).
.form_word_par <- function(doc, text, size = 10, bold = FALSE, italic = FALSE,
                           color = .FORM_WORD_INK, align = "left", shade = NULL,
                           space_after = 4, space_before = 0) {
  txt <- .form_pdf_clean_text(text %||% "")
  fp_t <- officer::fp_text(font.size = size, bold = bold, italic = italic,
                           color = color, font.family = "Calibri")
  fp_p <- officer::fp_par(
    text.align = align,
    shading.color = if (!is.null(shade)) shade else "transparent",
    padding.top = (if (!is.null(shade)) 3 else 0) + space_before,
    padding.bottom = (if (!is.null(shade)) 3 else 0) + space_after,
    padding.left = if (!is.null(shade)) 6 else 0
  )
  officer::body_add_fpar(doc, officer::fpar(officer::ftext(txt, prop = fp_t), fp_p = fp_p))
}

.form_word_blank <- function(doc) officer::body_add_par(doc, "", style = "Normal")

# Estilo base compartido por las tablas (bordes finos, tipografia, layout fijo).
.form_word_table_base <- function(ft, col_ids) {
  bd <- officer::fp_border(color = .FORM_WORD_LINE, width = 0.5)
  ft <- flextable::border_remove(ft)
  ft <- flextable::border_outer(ft, border = bd, part = "all")
  ft <- flextable::padding(ft, padding = 3, part = "all")
  ft <- flextable::font(ft, fontname = "Calibri", part = "all")
  ft <- flextable::valign(ft, valign = "center", part = "all")
  flextable::set_table_properties(ft, layout = "fixed")
}

# Matriz -> flextable: 1a columna ancha (etiqueta del item) + N columnas de
# escala con el codigo impreso por celda + columna especial opcional. Cabecera
# replica el modo del PDF: "categorias" (cada opcion rotulada) o "extremos"
# (solo primer/ultimo ancla + especial). Devuelve NULL si no hay filas.
.form_word_matrix_flextable <- function(block) {
  part <- .form_pdf_matrix_partition_options(block$options, block$special_override %||% "auto")
  scale <- part$scale
  special <- part$special
  has_special <- !is.null(special)
  n_scale <- length(scale)
  items <- block$items %||% list()
  if (!n_scale || !length(items)) return(NULL)

  scale_codes  <- vapply(scale, function(o) .form_pdf_clean_text(o$code), character(1))
  scale_labels <- vapply(scale, function(o) .form_pdf_clean_text(o$label %||% o$code), character(1))
  sp_code  <- if (has_special) .form_pdf_clean_text(special$code) else ""
  sp_label <- if (has_special) .form_pdf_clean_text(special$label %||% special$code) else ""
  header_mode <- .form_pdf_matrix_header_mode(scale, block$header_mode %||% "auto")

  df <- data.frame(
    lbl = vapply(items, function(it) {
      num <- .form_pdf_clean_text(it$number %||% "")
      base <- .form_pdf_clean_text(it$label %||% "")
      if (nzchar(num)) paste0(num, ".  ", base) else base
    }, character(1)),
    stringsAsFactors = FALSE
  )
  for (k in seq_len(n_scale)) df[[paste0("s", k)]] <- rep(scale_codes[k], nrow(df))
  if (has_special) df[["sp"]] <- rep(sp_code, nrow(df))
  col_ids <- names(df)
  scale_ids <- setdiff(col_ids, "lbl")

  ft <- flextable::flextable(df)

  # --- Etiquetas de cabecera ---
  # "categorias": cada opcion rotulada en su columna (Sí/No, escalas cortas).
  # "extremos": el ancla IZQUIERDA abarca la primera mitad de columnas (alineada
  # a la izquierda) y la DERECHA la segunda mitad (alineada a la derecha), como
  # el PDF — cada polo sobre su lado, no una sola celda que abarca todo.
  merge_extremos <- !identical(header_mode, "categorias") && n_scale >= 2L
  left_n <- ceiling(n_scale / 2)
  left_ids <- paste0("s", seq_len(left_n))
  right_ids <- if (n_scale > left_n) paste0("s", seq(left_n + 1L, n_scale)) else character(0)
  hdr <- stats::setNames(rep("", length(col_ids)), col_ids)
  if (identical(header_mode, "categorias")) {
    for (k in seq_len(n_scale)) hdr[[paste0("s", k)]] <- scale_labels[k]
    if (has_special) hdr[["sp"]] <- sp_label
  } else if (merge_extremos) {
    hdr[["s1"]] <- scale_labels[1]                                       # ancla izquierda
    if (length(right_ids)) hdr[[right_ids[1]]] <- scale_labels[n_scale]  # ancla derecha
    if (has_special) hdr[["sp"]] <- sp_label
  } else {
    hdr[["s1"]] <- scale_labels[1]
    if (has_special) hdr[["sp"]] <- sp_label
  }
  ft <- do.call(flextable::set_header_labels, c(list(ft), as.list(hdr)))
  if (merge_extremos) {
    if (length(left_ids) >= 2L) ft <- flextable::merge_at(ft, i = 1, j = left_ids, part = "header")
    if (length(right_ids) >= 2L) ft <- flextable::merge_at(ft, i = 1, j = right_ids, part = "header")
  }

  # --- Anchos: la columna de etiqueta se lleva la mayor parte (mismo criterio
  # que el PDF, .form_pdf_matrix_label_frac), la escala se reparte el resto. ---
  total_cols <- n_scale + (if (has_special) 1L else 0L)
  frac <- .form_pdf_matrix_label_frac(total_cols)
  usable <- .FORM_WORD_USABLE_IN
  lbl_w <- usable * frac
  col_w <- (usable - lbl_w) / max(1L, total_cols)
  ft <- flextable::width(ft, j = "lbl", width = lbl_w)
  for (cid in scale_ids) ft <- flextable::width(ft, j = cid, width = col_w)

  # --- Estilo (cabecera navy, escala centrada, zebra por fila) ---
  ft <- flextable::bg(ft, bg = .FORM_WORD_NAVY, part = "header")
  ft <- flextable::color(ft, color = "#FFFFFF", part = "header")
  ft <- flextable::bold(ft, part = "header")
  ft <- flextable::fontsize(ft, size = 8, part = "header")
  ft <- flextable::fontsize(ft, size = 9, part = "body")
  ft <- flextable::color(ft, j = "lbl", color = .FORM_WORD_INK, part = "body")
  ft <- flextable::align(ft, j = scale_ids, align = "center", part = "all")
  ft <- flextable::align(ft, j = "lbl", align = "left", part = "all")
  # En extremos, las anclas van pegadas a su extremo (izq/der), no centradas.
  if (merge_extremos) {
    ft <- flextable::align(ft, i = 1, j = left_ids, align = "left", part = "header")
    if (length(right_ids)) ft <- flextable::align(ft, i = 1, j = right_ids, align = "right", part = "header")
  }
  even <- which(seq_len(nrow(df)) %% 2L == 0L)
  if (length(even)) ft <- flextable::bg(ft, i = even, bg = .FORM_WORD_ZEBRA, part = "body")
  ft <- .form_word_table_base(ft, col_ids)
  bd <- officer::fp_border(color = .FORM_WORD_LINE, width = 0.5)
  ft <- flextable::border_inner_v(ft, border = bd, part = "all")
  ft
}

# Lista de opciones (pregunta suelta) -> flextable de 2 columnas: codigo | etiqueta.
.form_word_options_flextable <- function(opts) {
  if (!length(opts)) return(NULL)
  df <- data.frame(
    code  = vapply(opts, function(o) .form_pdf_clean_text(o$code %||% ""), character(1)),
    label = vapply(opts, function(o) .form_pdf_clean_text(o$label %||% o$code %||% ""), character(1)),
    stringsAsFactors = FALSE
  )
  ft <- flextable::flextable(df)
  ft <- flextable::delete_part(ft, part = "header")
  ft <- flextable::width(ft, j = "code", width = 0.4)
  ft <- flextable::width(ft, j = "label", width = .FORM_WORD_USABLE_IN - 0.4)
  ft <- flextable::align(ft, j = "code", align = "center", part = "body")
  ft <- flextable::color(ft, j = "code", color = .FORM_WORD_NAVY, part = "body")
  ft <- flextable::bold(ft, j = "code", part = "body")
  ft <- flextable::fontsize(ft, size = 9, part = "body")
  even <- which(seq_len(nrow(df)) %% 2L == 0L)
  if (length(even)) ft <- flextable::bg(ft, i = even, bg = .FORM_WORD_ZEBRA, part = "body")
  ft <- .form_word_table_base(ft, names(df))
  ft <- flextable::border_inner_h(ft, border = officer::fp_border(color = "#EEEEEE", width = 0.3), part = "body")
  ft
}

# Resuelve la ruta del logo Pulso (instalado o en dev via load_all). "" si falta.
.form_word_logo_path <- function() {
  p <- system.file("www", "pulso-pucp-logo.png", package = "prosecnurapp")
  if (nzchar(p) && file.exists(p)) return(p)
  for (cand in c("api/inst/www/pulso-pucp-logo.png", "inst/www/pulso-pucp-logo.png")) {
    if (file.exists(cand)) return(cand)
  }
  ""
}

# Aplica encabezado (logo + regla navy) y pie (PULSO PUCP + n.º de pagina)
# corridos por pagina, via la seccion por defecto del docx. Si el logo no existe,
# cae a texto "PULSO PUCP" en el encabezado.
.form_word_apply_furniture <- function(doc) {
  navy <- .FORM_WORD_NAVY
  logo <- .form_word_logo_path()
  hdr_runs <- if (nzchar(logo)) {
    list(officer::external_img(src = logo, width = 1.15, height = 0.45))
  } else {
    list(officer::ftext("PULSO PUCP",
      prop = officer::fp_text(font.size = 9, bold = TRUE, color = navy, font.family = "Calibri")))
  }
  header_par <- officer::fpar(
    values = hdr_runs,
    fp_p = officer::fp_par(text.align = "left", padding.bottom = 4,
      border.bottom = officer::fp_border(color = navy, width = 1))
  )
  footer_par <- officer::fpar(
    officer::ftext("PULSO PUCP",
      prop = officer::fp_text(font.size = 8, bold = TRUE, color = navy, font.family = "Calibri")),
    officer::ftext("      ·      Página ",
      prop = officer::fp_text(font.size = 8, color = .FORM_WORD_SOFT, font.family = "Calibri")),
    officer::run_word_field("PAGE"),
    fp_p = officer::fp_par(text.align = "center", padding.top = 4,
      border.top = officer::fp_border(color = .FORM_WORD_LINE, width = 0.5))
  )
  sect <- officer::prop_section(
    header_default = officer::block_list(header_par),
    footer_default = officer::block_list(footer_par)
  )
  officer::body_set_default_section(doc, sect)
}

# Render puro del modelo a .docx (paralelo a formulario_pdf_render).
formulario_word_render <- function(model, output_file) {
  if (!requireNamespace("officer", quietly = TRUE) ||
        !requireNamespace("flextable", quietly = TRUE)) {
    stop_api(500, "E_WORD_DEPS",
             "Faltan los paquetes officer/flextable para exportar el cuestionario en Word.")
  }
  dir.create(dirname(output_file), recursive = TRUE, showWarnings = FALSE)
  doc <- officer::read_docx()

  for (block in model$blocks %||% list()) {
    kind <- block$kind %||% ""

    # Condicion de apertura (lenguaje "condiciones") antes del bloque.
    if (nzchar(block$opening_condition %||% "")) {
      doc <- .form_word_par(doc, block$opening_condition, size = 9, italic = TRUE,
                            color = .FORM_WORD_NAVY, space_after = 2, space_before = 2)
    }

    if (identical(kind, "cover")) {
      doc <- .form_word_par(doc, block$title, size = 20, bold = TRUE, color = .FORM_WORD_NAVY,
                            align = "center", space_before = 6, space_after = 2)
      # Regla corta centrada bajo el titulo (paridad con la portada del PDF).
      doc <- .form_word_par(doc, strrep("─", 10), size = 11, color = .FORM_WORD_NAVY,
                            align = "center", space_after = 10)

    } else if (identical(kind, "paper")) {
      if (nzchar(block$title %||% "")) {
        doc <- .form_word_par(doc, toupper(block$title), size = 10.5, bold = TRUE, color = "#FFFFFF",
                              shade = .FORM_WORD_NAVY, space_before = 4, space_after = 2)
      }
      if (nzchar(block$body %||% "")) {
        doc <- .form_word_par(doc, block$body, size = 9.5, space_after = 6)
      }

    } else if (identical(kind, "section")) {
      # Kicker "SECCIÓN N": se omite cuando el titulo YA empieza con numeracion
      # (1, 1.1, 2.1...) para no duplicar el numero — mismo criterio que el PDF.
      title_has_number <- grepl("^\\s*\\d+(\\.\\d+)*\\b", block$title %||% "", perl = TRUE)
      if (!is.null(block$section_index) && !title_has_number) {
        doc <- .form_word_par(doc, sprintf("SECCIÓN %d", block$section_index), size = 7.5,
                              color = .FORM_WORD_SOFT, space_before = 8, space_after = 1)
      }
      num <- .form_pdf_clean_text(block$number %||% "")
      ttl <- if (nzchar(num)) paste0(num, "  ", block$title) else (block$title %||% "")
      doc <- .form_word_par(doc, toupper(ttl), size = 11, bold = TRUE, color = "#FFFFFF",
                            shade = .FORM_WORD_NAVY, space_after = 4)
      if (nzchar(block$hint %||% "")) {
        doc <- .form_word_par(doc, block$hint, size = 8.5, italic = TRUE, color = .FORM_WORD_SOFT)
      }

    } else if (identical(kind, "matrix")) {
      if (nzchar(block$tenor %||% "")) {
        num <- .form_pdf_clean_text(block$number %||% "")
        pre <- if (nzchar(num)) paste0(num, ".  ") else ""
        doc <- .form_word_par(doc, paste0(pre, block$title), size = 10, bold = TRUE,
                              space_before = 4, space_after = 2)
      }
      if (nzchar(block$hint %||% "")) {
        doc <- .form_word_par(doc, block$hint, size = 8.5, italic = TRUE, color = .FORM_WORD_SOFT)
      }
      ft <- .form_word_matrix_flextable(block)
      if (!is.null(ft)) {
        doc <- flextable::body_add_flextable(doc, ft, align = "left")
        doc <- .form_word_blank(doc)
      }

    } else if (identical(kind, "question")) {
      num <- .form_pdf_clean_text(block$number %||% "")
      lbl <- if (nzchar(num)) paste0(num, ".  ", block$label) else (block$label %||% "")
      doc <- .form_word_par(doc, lbl, size = 10, bold = TRUE, space_before = 4, space_after = 3)
      if (nzchar(block$hint %||% "")) {
        doc <- .form_word_par(doc, block$hint, size = 8.5, italic = TRUE, color = .FORM_WORD_SOFT)
      }
      opts <- block$options %||% list()
      if (length(opts)) {
        ft <- .form_word_options_flextable(opts)
        if (!is.null(ft)) {
          doc <- flextable::body_add_flextable(doc, ft, align = "left")
          doc <- .form_word_blank(doc)
        }
      } else if (isTRUE(block$coded_list)) {
        doc <- .form_word_par(doc, "Código: ______", size = 9, color = .FORM_WORD_SOFT, space_after = 6)
      } else if ((block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")) {
        doc <- .form_word_par(doc, strrep("_", 60), size = 9, color = .FORM_WORD_SOFT, space_after = 6)
      }
    }

    # Salto (lenguaje "saltos") despues del bloque.
    if (nzchar(block$skip %||% "")) {
      doc <- .form_word_par(doc, block$skip, size = 9, italic = TRUE,
                            color = .FORM_WORD_NAVY, space_before = 2, space_after = 4)
    }
  }

  # Encabezado (logo + regla) y pie (PULSO PUCP + n.º de página) CORRIDOS por
  # pagina, para paridad con el PDF. officer los soporta via prop_section.
  doc <- .form_word_apply_furniture(doc)
  print(doc, target = output_file)
  invisible(output_file)
}

# Entrada publica: construye el modelo (compartido con el PDF) y lo renderiza a Word.
reporte_formulario_word <- function(survey, choices, settings = NULL, paper = NULL,
                                    output_file, options = list()) {
  model <- formulario_pdf_build_model(
    survey = survey, choices = choices, settings = settings, paper = paper, options = options
  )
  formulario_word_render(model, output_file)
  list(path = output_file, summary = model$summary, warnings = model$warnings)
}
