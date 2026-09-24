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

.FORM_WORD_NAVY    <- "#002457"
.FORM_WORD_SOFT    <- "#5A6B85"
.FORM_WORD_INK     <- "#1A1A1A"
.FORM_WORD_ZEBRA   <- "#F1F4F9"
.FORM_WORD_LINE    <- "#C7D0E0"
# Cabecera de matriz: gris azulado pálido (paridad con tbl_header del PDF), no
# navy sólido — la paleta minimalista reserva el navy para la banda de sección.
.FORM_WORD_TBLHEAD <- "#E9EEF6"

# Ancho util aproximado de una carta con margenes por defecto de officer (pulg).
# officer emite A4 (11906 x 16838 twips) con margenes de 1417: 9072 twips utiles.
.FORM_WORD_USABLE_IN <- 6.3
# Separacion entre columnas cuando un tramo va a dos columnas. 425 twips es el
# valor del instrumento de referencia (<w:cols w:num="2" w:sep="1" w:space="425"/>).
.FORM_WORD_COL_SPACE_TWIPS <- 425
.FORM_WORD_COL_SPACE_IN <- .FORM_WORD_COL_SPACE_TWIPS / 1440

# TRUE si el tramo ocupa el ancho completo de la caja de texto (una columna).
.form_word_tramo_is_full <- function(usable) {
  isTRUE(all.equal(usable %||% .FORM_WORD_USABLE_IN, .FORM_WORD_USABLE_IN))
}

# Ancho util (pulg) de UN tramo segun su numero de columnas.
.form_word_tramo_usable_in <- function(columns) {
  if (identical(as.integer(columns %||% 1L), 2L)) {
    (.FORM_WORD_USABLE_IN - .FORM_WORD_COL_SPACE_IN) / 2
  } else {
    .FORM_WORD_USABLE_IN
  }
}

# Parrafo con formato. Devuelve el doc (officer es inmutable: hay que reasignar).
# `keep_with_next` emite `w:keepNext` en el pPr: el parrafo no se separa de lo
# que le sigue (item 3 del checklist: el enunciado no se queda solo al pie).
.form_word_par <- function(doc, text, size = 10, bold = FALSE, italic = FALSE,
                           color = .FORM_WORD_INK, align = "left", shade = NULL,
                           space_after = 4, space_before = 0,
                           keep_with_next = FALSE) {
  txt <- .form_pdf_clean_text(text %||% "")
  fp_t <- officer::fp_text(font.size = size, bold = bold, italic = italic,
                           color = color, font.family = "Calibri")
  fp_p <- officer::fp_par(
    text.align = align,
    shading.color = if (!is.null(shade)) shade else "transparent",
    padding.top = (if (!is.null(shade)) 3 else 0) + space_before,
    padding.bottom = (if (!is.null(shade)) 3 else 0) + space_after,
    padding.left = if (!is.null(shade)) 6 else 0,
    keep_with_next = isTRUE(keep_with_next)
  )
  officer::body_add_fpar(doc, officer::fpar(officer::ftext(txt, prop = fp_t), fp_p = fp_p))
}

.form_word_blank <- function(doc) officer::body_add_par(doc, "", style = "Normal")

# Estilo base compartido por las tablas (bordes finos, tipografia, layout fijo).
#
# ITEM 3 del checklist — una matriz no se parte entre paginas. El mecanismo
# elegido es `opts_word = list(split = FALSE)` de flextable 0.9.10, que es lo
# UNICO que esta version emite como `<w:cantSplit/>` en el `w:trPr` de CADA fila
# (medido: 4 filas -> 4 `cantSplit`). Se descartaron dos alternativas:
#   - `opts_word$keep_with_next`: en 0.9.10 NO produce `w:keepNext` (medido: 0).
#   - `flextable::paginate()`: emite `keepNext` en los parrafos de TODAS las
#     celdas, lo que pega la tabla ademas a lo que venga despues.
# La otra mitad del item (que la cabecera no se quede sola al pie de pagina) se
# resuelve en el parrafo del enunciado con `fp_par(keep_with_next = TRUE)`.
#
# LIMITE MEDIDO — `cantSplit` NO se emite dentro de un tramo de dos columnas.
# En una seccion con `w:cols num="2"`, una tabla con `cantSplit` cuyas filas no
# caben en lo que resta de columna hace que LibreOffice las DESCARTE en vez de
# pasarlas a la columna siguiente: la P3 "Nivel educativo" salio con "Primaria"
# y sin "Secundaria" ni "Superior" (las tres estaban en el document.xml; el PDF
# solo traia una). Aislado con el mismo modelo renderizado con y sin `split`:
# con cantSplit 0 apariciones, sin cantSplit 1. Perder contenido es peor que una
# tabla partida, y ademas el item 3 habla de MATRICES, que siempre caen en un
# tramo de una columna (el plan las manda ahi por `min_width_twips`).
.form_word_table_base <- function(ft, col_ids, no_split = TRUE) {
  bd <- officer::fp_border(color = .FORM_WORD_LINE, width = 0.5)
  ft <- flextable::border_remove(ft)
  ft <- flextable::border_outer(ft, border = bd, part = "all")
  ft <- flextable::padding(ft, padding = 3, part = "all")
  ft <- flextable::font(ft, fontname = "Calibri", part = "all")
  ft <- flextable::valign(ft, valign = "center", part = "all")
  flextable::set_table_properties(
    ft, layout = "fixed",
    opts_word = list(split = !isTRUE(no_split))
  )
}

# Matriz -> flextable: 1a columna ancha (etiqueta del item) + N columnas de
# escala con el codigo impreso por celda + columna especial opcional. Cabecera
# replica el modo del PDF: "categorias" (cada opcion rotulada) o "extremos"
# (solo primer/ultimo ancla + especial). Devuelve NULL si no hay filas.
.form_word_matrix_flextable <- function(block, usable = .FORM_WORD_USABLE_IN) {
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

  # Rol por fila: enunciado madre ("parent", sin codigos, fila fusionada),
  # sub-pregunta ("child", letra a/b/c + sangria) o fila normal (numero).
  roles <- vapply(items, function(it) {
    if (isTRUE(it$is_parent)) "parent"
    else if (nzchar(.form_pdf_clean_text(it$subletter %||% ""))) "child"
    else "normal"
  }, character(1))
  df <- data.frame(
    lbl = vapply(items, function(it) {
      num <- .form_pdf_clean_text(it$number %||% "")
      subl <- .form_pdf_clean_text(it$subletter %||% "")
      base <- .form_pdf_clean_text(it$label %||% "")
      if (isTRUE(it$is_parent)) { if (nzchar(num)) paste0(num, ".  ", base) else base }
      else if (nzchar(subl)) paste0(subl, ")  ", base)
      else if (nzchar(num)) paste0(num, ".  ", base) else base
    }, character(1)),
    stringsAsFactors = FALSE
  )
  # La madre no lleva codigos (celdas de escala vacias -> fila fusionada abajo).
  for (k in seq_len(n_scale)) df[[paste0("s", k)]] <- ifelse(roles == "parent", "", scale_codes[k])
  if (has_special) df[["sp"]] <- ifelse(roles == "parent", "", sp_code)
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
    # Pre-envuelve por PALABRA (como el PDF) para que Word no parta a mitad
    # ("satisfech/o"); flextable respeta los "\n". Los 11 caracteres estan
    # calibrados para el ancho nominal (una columna); en un tramo angosto se
    # escalan con el ancho real, para no re-envolver lo que ya sale bien hoy.
    wrap_chars <- if (isTRUE(all.equal(usable, .FORM_WORD_USABLE_IN))) {
      11L
    } else {
      max(5L, as.integer(round(11 * usable / .FORM_WORD_USABLE_IN)))
    }
    for (k in seq_len(n_scale)) {
      hdr[[paste0("s", k)]] <- paste(.form_pdf_wrap(scale_labels[k], wrap_chars), collapse = "\n")
    }
    if (has_special) hdr[["sp"]] <- paste(.form_pdf_wrap(sp_label, wrap_chars), collapse = "\n")
  } else if (merge_extremos) {
    hdr[["s1"]] <- scale_labels[1]                                       # ancla izquierda
    if (length(right_ids)) hdr[[right_ids[1]]] <- scale_labels[n_scale]  # ancla derecha
    if (has_special) hdr[["sp"]] <- sp_label
  } else {
    hdr[["s1"]] <- scale_labels[1]
    if (has_special) hdr[["sp"]] <- sp_label
  }
  # Etiqueta de sub-grupo (subcriterio) en la celda superior-izquierda del header.
  hdr[["lbl"]] <- .form_pdf_clean_text(block$group_label %||% "")
  ft <- do.call(flextable::set_header_labels, c(list(ft), as.list(hdr)))
  if (merge_extremos) {
    if (length(left_ids) >= 2L) ft <- flextable::merge_at(ft, i = 1, j = left_ids, part = "header")
    if (length(right_ids) >= 2L) ft <- flextable::merge_at(ft, i = 1, j = right_ids, part = "header")
  }

  # --- Anchos: la columna de etiqueta se lleva la mayor parte (mismo criterio
  # que el PDF, .form_pdf_matrix_label_frac), la escala se reparte el resto. ---
  total_cols <- n_scale + (if (has_special) 1L else 0L)
  frac <- .form_pdf_matrix_label_frac(total_cols)
  lbl_w <- usable * frac
  col_w <- (usable - lbl_w) / max(1L, total_cols)
  ft <- flextable::width(ft, j = "lbl", width = lbl_w)
  for (cid in scale_ids) ft <- flextable::width(ft, j = cid, width = col_w)

  # --- Estilo (cabecera gris azulado pálido tipo PDF: título navy, categorías
  # soft; escala centrada, zebra por fila) ---
  ft <- flextable::bg(ft, bg = .FORM_WORD_TBLHEAD, part = "header")
  ft <- flextable::color(ft, color = .FORM_WORD_SOFT, part = "header")
  ft <- flextable::color(ft, j = "lbl", color = .FORM_WORD_NAVY, part = "header")
  ft <- flextable::bold(ft, part = "header")
  ft <- flextable::fontsize(ft, size = 7, part = "header")
  ft <- flextable::fontsize(ft, size = 9, part = "body")
  ft <- flextable::color(ft, j = "lbl", color = .FORM_WORD_INK, part = "body")
  ft <- flextable::align(ft, j = scale_ids, align = "center", part = "all")
  ft <- flextable::align(ft, j = "lbl", align = "left", part = "all")
  # En extremos, las anclas van pegadas a su extremo (izq/der), no centradas.
  if (merge_extremos) {
    ft <- flextable::align(ft, i = 1, j = left_ids, align = "center", part = "header")
    if (length(right_ids)) ft <- flextable::align(ft, i = 1, j = right_ids, align = "center", part = "header")
  }
  even <- which(seq_len(nrow(df)) %% 2L == 0L)
  if (length(even)) ft <- flextable::bg(ft, i = even, bg = .FORM_WORD_ZEBRA, part = "body")
  # Sub-preguntas (competencias): el enunciado madre ocupa toda la fila (merge)
  # y los hijos van sangrados con su letra a/b/c.
  parent_rows <- which(roles == "parent")
  child_rows <- which(roles == "child")
  for (pr in parent_rows) ft <- flextable::merge_at(ft, i = pr, j = col_ids, part = "body")
  if (length(child_rows)) ft <- flextable::padding(ft, i = child_rows, j = "lbl", padding.left = 16, part = "body")
  # Salto por-FILA (filtro): "Si responde «No», salto a la N" bajo la etiqueta,
  # italic navy, como la referencia. Se compone la celda (etiqueta + salto).
  item_skips <- vapply(items, function(it) .form_pdf_clean_text(it$skip %||% ""), character(1))
  for (ri in which(nzchar(item_skips))) {
    ft <- flextable::compose(ft, i = ri, j = "lbl", part = "body",
      value = flextable::as_paragraph(
        flextable::as_chunk(df$lbl[ri]),
        flextable::as_chunk(paste0("\n", item_skips[ri]),
          props = officer::fp_text(italic = TRUE, color = .FORM_WORD_NAVY,
                                   font.size = 8, font.family = "Calibri"))))
  }
  ft <- .form_word_table_base(ft, col_ids, no_split = .form_word_tramo_is_full(usable))
  bd <- officer::fp_border(color = .FORM_WORD_LINE, width = 0.5)
  ft <- flextable::border_inner_v(ft, border = bd, part = "all")
  ft
}

# Lista de opciones (pregunta suelta) -> flextable de 2 columnas: codigo | etiqueta.
.form_word_options_flextable <- function(opts, usable = .FORM_WORD_USABLE_IN) {
  if (!length(opts)) return(NULL)
  codes  <- vapply(opts, function(o) .form_pdf_clean_text(o$code %||% ""), character(1))
  labels <- vapply(opts, function(o) .form_pdf_clean_text(o$label %||% o$code %||% ""), character(1))
  # Salto por-opcion (lenguaje "saltos"): "Salto a la 5" / "Termina la encuesta"
  # sobre la opcion que lo dispara. Si ninguna lo trae, tabla de 2 columnas.
  skips  <- vapply(opts, function(o) .form_pdf_clean_text(o$paper_skip %||% ""), character(1))
  has_skip <- any(nzchar(skips))
  df <- if (has_skip) {
    data.frame(code = codes, label = labels,
               skip = skips,
               stringsAsFactors = FALSE)
  } else {
    data.frame(code = codes, label = labels, stringsAsFactors = FALSE)
  }
  ft <- flextable::flextable(df)
  ft <- flextable::delete_part(ft, part = "header")
  # En un tramo angosto (dos columnas) la columna de saltos se encoge con el
  # resto; nunca puede llevarse mas de un tercio del ancho disponible.
  skip_w <- min(1.7, max(0.8, (usable - 0.4) / 3))
  ft <- flextable::width(ft, j = "code", width = 0.4)
  if (has_skip) {
    ft <- flextable::width(ft, j = "label", width = usable - 0.4 - skip_w)
    ft <- flextable::width(ft, j = "skip", width = skip_w)
    ft <- flextable::align(ft, j = "skip", align = "right", part = "body")
    ft <- flextable::italic(ft, j = "skip", part = "body")
    ft <- flextable::color(ft, j = "skip", color = .FORM_WORD_NAVY, part = "body")
    ft <- flextable::fontsize(ft, j = "skip", size = 8, part = "body")
  } else {
    ft <- flextable::width(ft, j = "label", width = usable - 0.4)
  }
  ft <- flextable::align(ft, j = "code", align = "center", part = "body")
  ft <- flextable::color(ft, j = "code", color = .FORM_WORD_NAVY, part = "body")
  ft <- flextable::bold(ft, j = "code", part = "body")
  ft <- flextable::fontsize(ft, j = "label", size = 9, part = "body")
  even <- which(seq_len(nrow(df)) %% 2L == 0L)
  if (length(even)) ft <- flextable::bg(ft, i = even, bg = .FORM_WORD_ZEBRA, part = "body")
  ft <- .form_word_table_base(ft, names(df), no_split = .form_word_tramo_is_full(usable))
  ft <- flextable::border_inner_h(ft, border = officer::fp_border(color = "#EEEEEE", width = 0.3), part = "body")
  ft
}

# --- ITEM 5 del checklist: ninguna caja dibujada, todo lo que enmarque va en tabla ---
#
# El consentimiento del instrumento artesanal DESAPARECIO en Word porque era una
# caja de texto (`w:drawing`) sin rama `mc:Fallback`; LibreOffice si la pintaba,
# asi que todos los chequeos por PDF lo daban por bueno. La forma robusta —y la
# unica que este motor admite para enmarcar— es una tabla de una fila y una
# celda con bordes.
# Que se enmarca: el consentimiento SIEMPRE (es el bloque que desaparecio), y
# cualquier bloque que el autor marque explicitamente como caja.
#
# `intro` queda DELIBERADAMENTE fuera: el bloque "INSTRUCCIONES" que este motor
# inyecta por defecto cuando el instrumento no trae hoja `paper` no es una caja
# que nadie pidiera, y enmarcarlo cambiaria la salida de todos los formularios
# existentes. Quien quiera enmarcar su introduccion lo declara con
# `kind`/`layout` = caja/recuadro/box.
.FORM_WORD_PAPER_FRAMED <- "consent|consentimiento|asentimiento|box|caja|marco|frame|recuadro"

# Normaliza acentos para que "introducción" case con "intro" y
# "consentimiento informado" con "consent".
.form_word_paper_is_framed <- function(block) {
  raw <- paste(c(block$paper_kind %||% "", block$layout %||% ""), collapse = " ")
  norm <- iconv(raw, to = "ASCII//TRANSLIT")
  if (is.na(norm)) norm <- raw
  grepl(.FORM_WORD_PAPER_FRAMED, tolower(norm))
}

# Bloque `paper` enmarcado -> flextable 1x1 con borde navy. El titulo va como
# primer chunk (bold navy, mayusculas) y el cuerpo debajo, en la MISMA celda,
# para que el marco abarque a los dos.
.form_word_paper_flextable <- function(block, usable = .FORM_WORD_USABLE_IN) {
  title <- .form_pdf_clean_text(block$title %||% "")
  body  <- .form_pdf_clean_text(block$body %||% "")
  if (!nzchar(title) && !nzchar(body)) return(NULL)
  ft <- flextable::flextable(data.frame(cell = "", stringsAsFactors = FALSE))
  ft <- flextable::delete_part(ft, part = "header")
  chunks <- list()
  if (nzchar(title)) {
    chunks <- c(chunks, list(flextable::as_chunk(
      toupper(title),
      props = officer::fp_text(font.size = 10, bold = TRUE, color = .FORM_WORD_NAVY,
                               font.family = "Calibri"))))
  }
  if (nzchar(body)) {
    sep <- if (length(chunks)) "\n" else ""
    chunks <- c(chunks, list(flextable::as_chunk(
      paste0(sep, body),
      props = officer::fp_text(font.size = 9.5, color = .FORM_WORD_INK,
                               font.family = "Calibri"))))
  }
  ft <- flextable::compose(ft, i = 1, j = "cell", part = "body",
                           value = do.call(flextable::as_paragraph, chunks))
  ft <- flextable::width(ft, j = "cell", width = usable)
  ft <- flextable::align(ft, j = "cell", align = "justify", part = "body")
  ft <- flextable::padding(ft, padding = 7, part = "body")
  ft <- flextable::valign(ft, valign = "top", part = "body")
  ft <- flextable::font(ft, fontname = "Calibri", part = "all")
  ft <- flextable::border_remove(ft)
  ft <- flextable::border_outer(
    ft, border = officer::fp_border(color = .FORM_WORD_NAVY, width = 1), part = "body")
  flextable::set_table_properties(
    ft, layout = "fixed",
    opts_word = list(split = !.form_word_tramo_is_full(usable))
  )
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

# Encabezado (logo + regla navy) y pie (PULSO PUCP + n.º de pagina) del
# formulario. Se devuelven como piezas para poder RE-ADJUNTARLAS a cada seccion:
# en OOXML el mobiliario es propiedad del `sectPr`, asi que una seccion nueva sin
# `headerReference`/`footerReference` se queda sin pie (item 9 del checklist).
# Si el logo no existe, cae a texto "PULSO PUCP" en el encabezado.
.form_word_furniture_parts <- function() {
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
  soft_fp <- officer::fp_text(font.size = 8, color = .FORM_WORD_SOFT, font.family = "Calibri")
  footer_par <- officer::fpar(
    officer::ftext("PULSO PUCP",
      prop = officer::fp_text(font.size = 8, bold = TRUE, color = navy, font.family = "Calibri")),
    officer::ftext("     ·     Página ", prop = soft_fp),
    officer::run_word_field("PAGE", prop = soft_fp),
    fp_p = officer::fp_par(text.align = "center", padding.top = 4,
      border.top = officer::fp_border(color = .FORM_WORD_LINE, width = 0.5))
  )
  list(header = header_par, footer = footer_par)
}

# `prop_section` de UN tramo: columnas + mobiliario heredado.
#
# ITEM 9 — el pie sobrevive en la ultima pagina. Dos decisiones deliberadas:
#   1. `header_default` / `footer_default` se pasan SIEMPRE, tambien en las
#      secciones intermedias. Sin eso Word hereda de la seccion anterior solo
#      mientras officer no escriba un `sectPr` propio; en cuanto lo escribe, el
#      pie desaparece del tramo.
#   2. NO se pasa `header_first` / `footer_first`: eso es lo que hace que officer
#      emita `<w:titlePg/>`, y con `titlePg` la primera pagina de CADA seccion
#      queda sin pie. El instrumento de referencia lleva `titlePg` en seis de sus
#      siete secciones y por eso pierde el pie donde no debe.
.form_word_section_prop <- function(columns, furniture, type = "continuous") {
  ncol <- if (identical(as.integer(columns %||% 1L), 2L)) 2L else 1L
  cols <- if (ncol == 2L) {
    w <- .form_word_tramo_usable_in(2L)
    officer::section_columns(widths = c(w, w), space = .FORM_WORD_COL_SPACE_IN, sep = TRUE)
  } else {
    NULL   # section_columns() exige >= 2 anchos; una columna va con <w:cols/>.
  }
  officer::prop_section(
    type = type,
    section_columns = cols,
    header_default = officer::block_list(furniture$header),
    footer_default = officer::block_list(furniture$footer)
  )
}

# Seccion por defecto del docx (la que cierra el ULTIMO tramo).
.form_word_apply_furniture <- function(doc, columns = 1L, furniture = NULL) {
  furn <- furniture %||% .form_word_furniture_parts()
  officer::body_set_default_section(doc, .form_word_section_prop(columns, furn))
}

# --- ITEM 1, trampa documentada: el orden de hijos del `sectPr` es ESTRICTO ---
#
# CT_SectPr exige (ECMA-376): headerReference*, footerReference*, footnotePr,
# endnotePr, type, pgSz, pgMar, paperSrc, pgBorders, lnNumType, pgNumType, cols,
# formProt, vAlign, noEndnote, titlePg, ... Word escribe en ese orden (medido
# sobre el instrumento de referencia: type, pgSz, pgMar, pgNumType, cols,
# titlePg). officer 0.7.1 escribe headerReference, footerReference, pgMar, pgSz,
# type, cols: tres elementos fuera de sitio, en TODO sectPr que genera.
#
# NO se post-procesa, y la razon esta medida, no razonada. Reordenar el XML en
# memoria (`doc$doc_obj$get()` + xml2) ROMPE el render: `xml_add_child()` copia
# el nodo añadiendole su propia declaracion `xmlns:w`, y el post-proceso de
# officer (`print.rdocx` -> `process_sections_content` -> `extract_hof`) busca
# `<w:headerReference w:officer="true"` por cadena, deja de encontrarlo y
# aborta con "arguments imply differing number of rows: 1, 0". Quitar la
# declaracion con `xml_set_attr(k, "xmlns:w", NULL)` tampoco vale: xml2 pierde
# los prefijos y el nodo sale como `<type val="continuous"/>`.
# Queda como revision pendiente aguas arriba (officer), no como parche aqui.

# Render puro del modelo a .docx (paralelo a formulario_pdf_render).
formulario_word_render <- function(model, output_file) {
  if (!requireNamespace("officer", quietly = TRUE) ||
        !requireNamespace("flextable", quietly = TRUE)) {
    stop_api(500, "E_WORD_DEPS",
             "Faltan los paquetes officer/flextable para exportar el cuestionario en Word.")
  }
  dir.create(dirname(output_file), recursive = TRUE, showWarnings = FALSE)
  doc <- officer::read_docx()

  furniture <- .form_word_furniture_parts()
  plan <- .form_word_column_plan(model)
  emit_sections <- .form_word_sections_enabled(model, plan)

  for (ti in seq_along(plan)) {
    tramo <- plan[[ti]]
    usable <- if (emit_sections) .form_word_tramo_usable_in(tramo$columns) else .FORM_WORD_USABLE_IN
    for (bi in seq.int(tramo$from, tramo$to)) {
      doc <- .form_word_add_block(doc, model$blocks[[bi]], usable = usable)
    }
    # Un `block_section` CIERRA el tramo que termina ahi: se emite DESPUES de
    # pintar sus bloques. El ultimo lo cierra la seccion por defecto (abajo).
    if (emit_sections && ti < length(plan)) {
      doc <- officer::body_end_block_section(
        doc, officer::block_section(.form_word_section_prop(tramo$columns, furniture)))
    }
  }

  # Encabezado (logo + regla) y pie (PULSO PUCP + n.º de página) CORRIDOS por
  # pagina, para paridad con el PDF. La seccion por defecto cierra el ultimo
  # tramo, asi que hereda SU numero de columnas.
  last_cols <- if (emit_sections) plan[[length(plan)]]$columns else 1L
  doc <- .form_word_apply_furniture(doc, columns = last_cols, furniture = furniture)
  print(doc, target = output_file)
  invisible(output_file)
}

# --- ITEM 1: plan de columnas ---
#
# Contrato de entrada (lo publica `formulario_pdf_build_model()`):
#   model$column_plan: lista de tramos contiguos, 1-based sobre `model$blocks`,
#     cada uno list(columns = 1L|2L, from, to, reason); cubren todos los bloques
#     exactamente una vez.
# Defensa: si el plan falta, esta vacio o no cubre los bloques, se degrada a UN
# tramo de una columna (el comportamiento de hoy), nunca a un render parcial.
.form_word_column_plan <- function(model) {
  n <- length(model$blocks %||% list())
  fallback <- if (n) list(list(columns = 1L, from = 1L, to = n, reason = "fallback")) else list()
  plan <- model$column_plan
  if (!is.list(plan) || !length(plan) || !n) return(fallback)
  cursor <- 1L
  out <- vector("list", length(plan))
  for (i in seq_along(plan)) {
    tr <- plan[[i]]
    from <- suppressWarnings(as.integer(tr$from %||% NA_integer_))
    to   <- suppressWarnings(as.integer(tr$to %||% NA_integer_))
    cols <- suppressWarnings(as.integer(tr$columns %||% 1L))
    if (is.na(from) || is.na(to) || from != cursor || to < from || to > n) return(fallback)
    if (is.na(cols) || !cols %in% c(1L, 2L)) cols <- 1L
    out[[i]] <- list(columns = cols, from = from, to = to,
                     reason = .form_pdf_clean_text(tr$reason %||% ""))
    cursor <- to + 1L
  }
  if (cursor != n + 1L) return(fallback)  # el plan no cubre todos los bloques
  out
}

# Regla de compatibilidad, innegociable: con `model$columns` igual a 1 o 2 la
# salida .docx es la de HOY (una columna, sin `sectPr` intermedios). Solo el modo
# "auto" —y solo si su plan tiene mas de un tramo o un tramo de dos columnas—
# emite secciones. `model$columns` NO decide la geometria (esa sale del plan):
# decide unicamente si este motor esta autorizado a cambiar la salida.
.form_word_sections_enabled <- function(model, plan) {
  if (!identical(tolower(as.character(model$columns %||% "1")[1]), "auto")) return(FALSE)
  if (!length(plan)) return(FALSE)
  length(plan) > 1L ||
    any(vapply(plan, function(tr) identical(as.integer(tr$columns), 2L), logical(1)))
}

# Pinta UN bloque del modelo. `usable` es el ancho (pulg) del tramo en curso:
# en un tramo de dos columnas las tablas se encogen a la mitad.
.form_word_add_block <- function(doc, block, usable = .FORM_WORD_USABLE_IN) {
  {
    kind <- block$kind %||% ""

    # Condicion de apertura (lenguaje "condiciones") antes del bloque.
    if (nzchar(block$opening_condition %||% "")) {
      doc <- .form_word_par(doc, block$opening_condition, size = 9, italic = TRUE,
                            color = .FORM_WORD_NAVY, space_after = 2, space_before = 2,
                            keep_with_next = TRUE)
    }

    if (identical(kind, "cover")) {
      doc <- .form_word_par(doc, block$title, size = 20, bold = TRUE, color = .FORM_WORD_NAVY,
                            align = "center", space_before = 6, space_after = 2)
      # Regla corta centrada bajo el titulo (paridad con la portada del PDF).
      doc <- .form_word_par(doc, strrep("─", 10), size = 11, color = .FORM_WORD_NAVY,
                            align = "center", space_after = 10)

    } else if (identical(kind, "paper")) {
      # ITEM 5: consentimiento / introducción van ENMARCADOS, y el marco es una
      # tabla 1x1 (nunca una caja dibujada, que Word puede no renderizar).
      ft <- if (.form_word_paper_is_framed(block)) {
        .form_word_paper_flextable(block, usable = usable)
      } else NULL
      if (!is.null(ft)) {
        doc <- flextable::body_add_flextable(doc, ft, align = "left")
        doc <- .form_word_blank(doc)
      } else {
        if (nzchar(block$title %||% "")) {
          doc <- .form_word_par(doc, toupper(block$title), size = 10.5, bold = TRUE, color = "#FFFFFF",
                                shade = .FORM_WORD_NAVY, space_before = 4, space_after = 2,
                                keep_with_next = nzchar(block$body %||% ""))
        }
        if (nzchar(block$body %||% "")) {
          doc <- .form_word_par(doc, block$body, size = 9.5, space_after = 6)
        }
      }

    } else if (identical(kind, "section")) {
      # Banda de seccion CENTRADA, sin kicker "SECCIÓN N" (la banda se basta sola).
      num <- .form_pdf_clean_text(block$number %||% "")
      ttl <- if (nzchar(num)) paste0(num, "  ", block$title) else (block$title %||% "")
      # La banda de sección no se queda sola al pie: arrastra lo que sigue.
      doc <- .form_word_par(doc, toupper(ttl), size = 11, bold = TRUE, color = "#FFFFFF",
                            shade = .FORM_WORD_NAVY, align = "center", space_after = 4,
                            keep_with_next = TRUE)
      if (nzchar(block$hint %||% "")) {
        doc <- .form_word_par(doc, block$hint, size = 8.5, italic = TRUE, color = .FORM_WORD_SOFT,
                              keep_with_next = TRUE)
      }

    } else if (identical(kind, "matrix")) {
      # ITEM 3: el enunciado y la pista NUNCA se separan de su matriz.
      if (nzchar(block$tenor %||% "")) {
        num <- .form_pdf_clean_text(block$number %||% "")
        pre <- if (nzchar(num)) paste0(num, ".  ") else ""
        doc <- .form_word_par(doc, paste0(pre, block$title), size = 10, bold = TRUE,
                              space_before = 4, space_after = 2, keep_with_next = TRUE)
      }
      if (nzchar(block$hint %||% "")) {
        doc <- .form_word_par(doc, block$hint, size = 8.5, italic = TRUE, color = .FORM_WORD_SOFT,
                              keep_with_next = TRUE)
      }
      ft <- .form_word_matrix_flextable(block, usable = usable)
      if (!is.null(ft)) {
        doc <- flextable::body_add_flextable(doc, ft, align = "left")
        doc <- .form_word_blank(doc)
      }

    } else if (identical(kind, "question")) {
      if (identical(block$type %||% "", "note")) {
        # Nota informativa (tipo `note` del XLSForm): texto de sección/escala como
        # en la referencia — párrafo justificado semibold, NO una pregunta numerada.
        doc <- .form_word_par(doc, block$label %||% "", size = 9.5, bold = TRUE,
                              color = .FORM_WORD_INK, align = "justify",
                              space_before = 4, space_after = 6)
      } else {
        num <- .form_pdf_clean_text(block$number %||% "")
        lbl <- if (nzchar(num)) paste0(num, ".  ", block$label) else (block$label %||% "")
        # Mismo criterio que la matriz: el enunciado viaja con sus opciones.
        has_body <- length(block$options %||% list()) > 0 || isTRUE(block$coded_list) ||
          (block$type %||% "") %in% c("text", "integer", "decimal", "date", "time", "datetime")
        doc <- .form_word_par(doc, lbl, size = 10, bold = TRUE, space_before = 4, space_after = 3,
                              keep_with_next = has_body)
        if (nzchar(block$hint %||% "")) {
          doc <- .form_word_par(doc, block$hint, size = 8.5, italic = TRUE, color = .FORM_WORD_SOFT,
                                keep_with_next = has_body)
        }
        opts <- block$options %||% list()
        if (length(opts)) {
          ft <- .form_word_options_flextable(opts, usable = usable)
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
    }

    # Salto (lenguaje "saltos") despues del bloque.
    if (nzchar(block$skip %||% "")) {
      doc <- .form_word_par(doc, block$skip, size = 9, italic = TRUE,
                            color = .FORM_WORD_NAVY, space_before = 2, space_after = 4)
    }
  }
  doc
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
