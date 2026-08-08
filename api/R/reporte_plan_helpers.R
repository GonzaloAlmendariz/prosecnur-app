# CONTRATO DE LAYOUT Y PLACEHOLDER DE PPT
#
# IMPORTANTE:  En casi todos los layouts la plantilla tiene un placeholder
# decorativo tipo "body" en la esquina superior derecha (~11.0, 0.2) que
# contiene el logo institucional.  Ese placeholder NUNCA debe mapearse a
# un slot del contrato — el paquete no debe escribir nada ahí.
#
# La tabla siguiente resume el body type_idx del logo en cada layout:
#
#   Layout                          | Logo body_idx | Acción
#   --------------------------------|:-------------:|--------
#   Section Header                  |       1       | SKIP
#   Graficos                        |       1       | SKIP
#   Graficos2                       |       1       | SKIP
#   Graficos_2columnas              |       1       | SKIP
#   4_paneles                       |       1       | SKIP
#   1_Grafico_narrativo             |       1       | SKIP
#   1_Graficos_2columnas_narrativo  |       1       | SKIP
#   right_grafico_texto             |       1       | SKIP
#   left_grafico_texto              |       1       | SKIP
#   right_2graficos_texto           |       1       | SKIP
#   left_2graficos_texto            |       1       | SKIP
#   poblacion_2                     |       1       | SKIP
#   poblacion_4                     |       1       | SKIP
#   poblacion_5                     |       1       | SKIP
#   poblacion_6                     |       1       | SKIP
#   Objetivos_Secciones             |       1       | SKIP
#   Title Slide                     |       1       | SKIP (logo derecho)

# B55 (higiene): definición canónica NULL-only de `%||%` para este archivo.
# OJO: no puede asignarse como `%||%` top-level — helpers_calc_comunes.R ya
# publica un `%||%` en el namespace con OTRA semántica (NA también cae al
# fallback) y, por orden de colación, un binding aquí lo pisaría para todo
# el paquete (calc-muestra incluido). Los closures del archivo que necesitan
# la semántica NULL-only la alian localmente: `%||%` <- .rp_null_default.
.rp_null_default <- function(x, y) if (!is.null(x)) x else y

# Unidad de análisis que acompaña a cada resultado en planes relacionales.
# Vive fuera del renderer grande para que Gráficos, PPT y sus pruebas usen el
# mismo vocabulario sin depender de nombres técnicos de las fuentes.
.reporte_plan_base_label <- function(role = "principal", grain = NULL,
                                     n_rows = NULL, prefix = "Base: ") {
  role <- tolower(trimws(as.character(role %||% "principal")[1]))
  grain <- grain %||% list()
  scalar_int <- function(x, fallback = NA_integer_) {
    out <- suppressWarnings(as.integer(x %||% fallback)[1])
    if (is.na(out) || out < 0L) fallback else out
  }
  plural <- function(n, singular, plural_form) {
    if (identical(as.integer(n), 1L)) singular else plural_form
  }

  if (role %in% c("repeat", "repetible", "instancia")) {
    responses <- scalar_int(grain$n_instancias, scalar_int(n_rows))
    surveys <- scalar_int(grain$n_personas)
    if (is.na(responses)) return("")
    response_text <- sprintf(
      "%s %s",
      format(responses, big.mark = ",", scientific = FALSE),
      plural(responses, "respuesta", "respuestas")
    )
    if (!is.na(surveys)) {
      response_text <- sprintf(
        "%s de %s %s",
        response_text,
        format(surveys, big.mark = ",", scientific = FALSE),
        plural(surveys, "encuesta", "encuestas")
      )
    }
    return(paste0(prefix, response_text))
  }

  surveys <- scalar_int(grain$n_encuestas, scalar_int(n_rows))
  if (is.na(surveys)) return("")
  paste0(
    prefix,
    format(surveys, big.mark = ",", scientific = FALSE),
    " ", plural(surveys, "encuesta", "encuestas")
  )
}

.reporte_plan_multiactor_canvas_defaults <- function(show_extra = FALSE) {
  show_extra <- isTRUE(show_extra)
  list(
    canvas_w_grupo = 0.13,
    canvas_w_buf_grupo_etq = 0.01,
    canvas_w_etiquetas = 0.17,
    canvas_w_buf_etq_bars = 0.01,
    canvas_w_bars = if (show_extra) 0.56 else 0.68,
    canvas_w_buf_bars_extra = if (show_extra) 0.02 else 0,
    canvas_w_extra = if (show_extra) 0.10 else 0
  )
}

.ppt_pulso_logo_asset <- function(variant = c("navy", "white", "black"),
                                  override = NULL) {
  variant <- match.arg(variant)
  override <- as.character(override %||% "")[1]
  filename <- paste0(variant, ".png")
  candidates <- c(
    if (nzchar(trimws(override))) override else character(0),
    system.file("ppt_assets", "brand", "pulso-pucp", filename, package = "prosecnurapp"),
    system.file("ppt_assets", "brand", "pulso-pucp", filename, package = "prosecnur"),
    file.path(getwd(), "api", "inst", "ppt_assets", "brand", "pulso-pucp", filename),
    file.path(getwd(), "inst", "ppt_assets", "brand", "pulso-pucp", filename)
  )
  candidates <- candidates[nzchar(candidates) & file.exists(candidates)]
  if (!length(candidates)) return("")
  normalizePath(candidates[[1L]], winslash = "/", mustWork = TRUE)
}

.ppt_add_partner_cover_logo <- function(doc, base_args = list()) {
  enabled <- base_args$partner_logo_cover %||% base_args$logo_pulso_cover %||% FALSE
  if (!isTRUE(enabled)) return(doc)

  variant <- as.character(
    base_args$partner_logo_cover_variant %||% base_args$logo_pulso_cover_variant %||% "white"
  )[1]
  if (!variant %in% c("navy", "white", "black")) variant <- "white"
  path <- .ppt_pulso_logo_asset(
    variant,
    override = base_args$partner_logo_cover_path %||% base_args$logo_pulso_cover_path %||% NULL
  )
  if (!nzchar(path)) return(doc)

  number <- function(x, fallback) {
    value <- suppressWarnings(as.numeric(x %||% fallback)[1])
    if (!is.finite(value)) fallback else value
  }
  height <- number(base_args$partner_logo_cover_height, 0.60)
  width <- number(base_args$partner_logo_cover_width, height * 1078 / 423)
  left <- number(base_args$partner_logo_cover_left, 0.46)
  top <- number(base_args$partner_logo_cover_top, 0.30)

  officer::ph_with(
    doc,
    value = officer::external_img(
      src = path,
      width = width,
      height = height,
      alt = "PULSO PUCP"
    ),
    location = officer::ph_location(
      left = left,
      top = top,
      width = width,
      height = height,
      newlabel = "PULSO PUCP cover logo"
    )
  )
}

#' Logo PULSO en las láminas de SEPARADOR DE SECCIÓN.
#'
#' Las secciones traen del master solo el logo del socio (UNHCR) sobre la banda
#' azul al pie; el resto de láminas (portada/ficha/gráficos) muestran PULSO +
#' socio. Este helper añade el logo PULSO también al separador, de forma
#' consistente con la portada (variante clara sobre fondo oscuro). Gated por el
#' preset `partner_logo_section` (por defecto hereda de `partner_logo_cover`).
#' La geometría reusa por defecto la de la portada (`partner_logo_cover_*`), con
#' overrides opcionales `partner_logo_section_*`.
#' @keywords internal
.ppt_add_partner_section_logo <- function(doc, base_args = list()) {
  enabled <- base_args$partner_logo_section %||% base_args$logo_pulso_section %||%
    base_args$partner_logo_cover %||% base_args$logo_pulso_cover %||% FALSE
  if (!isTRUE(enabled)) return(doc)

  variant <- as.character(
    base_args$partner_logo_section_variant %||% base_args$partner_logo_cover_variant %||%
      base_args$logo_pulso_cover_variant %||% "white"
  )[1]
  if (!variant %in% c("navy", "white", "black")) variant <- "white"
  path <- .ppt_pulso_logo_asset(
    variant,
    override = base_args$partner_logo_section_path %||% base_args$partner_logo_cover_path %||%
      base_args$logo_pulso_cover_path %||% NULL
  )
  if (!nzchar(path)) return(doc)

  number <- function(x, fallback) {
    value <- suppressWarnings(as.numeric(x %||% fallback)[1])
    if (!is.finite(value)) fallback else value
  }
  height <- number(base_args$partner_logo_section_height %||% base_args$partner_logo_cover_height, 0.60)
  width <- number(base_args$partner_logo_section_width %||% base_args$partner_logo_cover_width,
                  height * 1078 / 423)
  left <- number(base_args$partner_logo_section_left %||% base_args$partner_logo_cover_left, 0.46)
  top <- number(base_args$partner_logo_section_top %||% base_args$partner_logo_cover_top, 6.75)

  officer::ph_with(
    doc,
    value = officer::external_img(
      src = path,
      width = width,
      height = height,
      alt = "PULSO PUCP"
    ),
    location = officer::ph_location(
      left = left,
      top = top,
      width = width,
      height = height,
      newlabel = "PULSO PUCP section logo"
    )
  )
}

# Los divisores por seccion se leen mejor con un cuerpo mas grande que el titulo
# de slide. El ratio y la derivacion viven aqui, en un solo lugar, porque los
# consumen dos capas: la del router (.enriquecer_presets(), que precocina los
# presets antes del worker) y la del motor (.styled_slide_title(), que ademas
# atiende paths que NO pasan por el router: preview de lamina, Word directo,
# tests). Cuando cada capa tenia su propia regla, el mismo proyecto exportaba
# el titulo de seccion en 29.2 pt o en 22.5 pt segun por donde entrara.
.PPT_SECTION_TITLE_RATIO <- 1.3

# Devuelve el cuerpo del titulo de seccion en puntos, o NA_real_ si no hay nada
# utilizable (el llamador aplica su propio default). Un valor explicito del
# perfil o del analista siempre manda sobre el derivado.
.ppt_section_title_size <- function(size_seccion = NULL, size_slide = NULL) {
  explicit <- suppressWarnings(as.numeric(size_seccion %||% NA_real_)[1])
  if (is.finite(explicit) && explicit > 0) return(explicit)
  slide <- suppressWarnings(as.numeric(size_slide %||% NA_real_)[1])
  if (is.finite(slide) && slide > 0) {
    return(round(slide * .PPT_SECTION_TITLE_RATIO, 1))
  }
  NA_real_
}

# `officer::ph_location()` (0.7.1) no expone el anclaje vertical, asi que lo
# fijamos sobre el XML de la shape recien insertada. La ubicamos por el nombre
# que `newlabel=` dejo en <p:cNvPr>, la misma convencion de etiquetado semantico
# que usa el resto del contrato. Devuelve el doc intacto si no encuentra nada:
# es un ajuste cosmetico y no debe tumbar un export.
.ppt_set_shape_anchor <- function(doc, ph_label, anchor = "ctr") {
  label <- as.character(ph_label %||% "")[1]
  anchor <- as.character(anchor %||% "")[1]
  if (!nzchar(label) || !nzchar(anchor)) return(doc)
  slide <- tryCatch(doc$slide$get_slide(doc$cursor), error = function(e) NULL)
  if (is.null(slide)) return(doc)
  xml <- tryCatch(slide$get(), error = function(e) NULL)
  if (is.null(xml)) return(doc)
  ns <- c(
    p = "http://schemas.openxmlformats.org/presentationml/2006/main",
    a = "http://schemas.openxmlformats.org/drawingml/2006/main"
  )
  nodes <- tryCatch(
    xml2::xml_find_all(
      xml,
      sprintf(".//p:sp[.//p:nvSpPr/p:cNvPr[@name=\"%s\"]]//a:bodyPr", label),
      ns
    ),
    error = function(e) NULL
  )
  if (is.null(nodes) || !length(nodes)) return(doc)
  for (node in nodes) xml2::xml_set_attr(node, "anchor", anchor)
  doc
}

.ppt_title_spec_with_height <- function(layout_props, spec, height = NULL) {
  height <- suppressWarnings(as.numeric(height %||% NA_real_)[1])
  if (!is.finite(height) || height <= 0 || !is.data.frame(layout_props) || !nrow(layout_props)) {
    return(spec)
  }
  types <- as.character(spec$type %||% "title")
  candidates <- layout_props[layout_props$type %in% types, , drop = FALSE]
  label <- as.character(spec$ph_label %||% "")[1]
  if (nzchar(label) && "ph_label" %in% names(candidates)) {
    labelled <- candidates[candidates$ph_label == label, , drop = FALSE]
    if (nrow(labelled)) candidates <- labelled
  }
  if (!nrow(candidates)) return(spec)
  row <- candidates[1L, , drop = FALSE]
  spec$loc <- list(
    left = as.numeric(row$offx[[1L]]),
    top = as.numeric(row$offy[[1L]]),
    width = as.numeric(row$cx[[1L]]),
    height = max(as.numeric(row$cy[[1L]]), height)
  )
  spec
}

.ppt_add_acnur_two_column_index <- function(doc, title, sections, style = list(),
                                             font_family = "Arial") {
  clean <- function(x) {
    x <- trimws(as.character(x %||% character(0)))
    x[!is.na(x) & nzchar(x)]
  }
  number <- function(name, fallback, min = NULL, max = NULL) {
    value <- suppressWarnings(as.numeric(style[[name]] %||% fallback)[1])
    if (!is.finite(value)) value <- fallback
    if (!is.null(min)) value <- base::max(min, value)
    if (!is.null(max)) value <- base::min(max, value)
    value
  }
  add_text <- function(doc, text, left, top, width, height, size, color,
                       bold = FALSE, align = "left") {
    value <- officer::fpar(
      officer::ftext(
        as.character(text)[1],
        prop = officer::fp_text(
          color = color,
          font.size = size,
          font.family = font_family,
          bold = bold
        )
      ),
      fp_p = officer::fp_par(text.align = align, line_spacing = 1)
    )
    officer::ph_with(
      doc,
      value = value,
      location = officer::ph_location(
        left = left,
        top = top,
        width = width,
        height = height
      )
    )
  }

  sections <- clean(sections)
  title <- as.character(title %||% "Contenido")[1]
  if (!nzchar(trimws(title))) title <- "Contenido"
  title_color <- as.character(style$title_color %||% "#081F5C")[1]
  accent <- as.character(style$accent_color %||% "#0072BC")[1]
  text_color <- as.character(style$text_color %||% "#081F5C")[1]
  title_size <- number("title_size", 24, min = 18)
  section_size <- number("section_size", 18, min = 16)
  number_size <- number("number_size", 18, min = 16)
  title_left <- number("title_left", 0.72, min = 0)
  title_top <- number("title_top", 0.62, min = 0)
  title_width <- number("title_width", 11.90, min = 4)
  content_top <- number("content_top", 1.72, min = 1)
  content_height <- number("content_height", 4.90, min = 2)
  left_col <- number("left_col", 0.82, min = 0)
  right_col <- number("right_col", 6.88, min = 4)
  col_width <- number("col_width", 5.46, min = 3)
  number_width <- number("number_width", 0.54, min = 0.4, max = 0.9)
  gap <- number("number_gap", 0.16, min = 0.05, max = 0.4)
  break_at <- suppressWarnings(as.integer(style$column_break %||% ceiling(length(sections) / 2))[1])
  if (!is.finite(break_at) || break_at < 1L) break_at <- ceiling(length(sections) / 2)
  break_at <- min(length(sections), break_at)
  offset <- suppressWarnings(as.integer(style$number_offset %||% 0L)[1])
  if (!is.finite(offset)) offset <- 0L

  doc <- add_text(
    doc, title, title_left, title_top, title_width, 0.55,
    title_size, title_color, bold = TRUE
  )
  columns <- list(seq_len(break_at), if (break_at < length(sections)) seq.int(break_at + 1L, length(sections)) else integer(0))
  max_rows <- max(1L, lengths(columns))
  row_height <- content_height / max_rows
  column_lefts <- c(left_col, right_col)

  for (col in seq_along(columns)) {
    indices <- columns[[col]]
    if (!length(indices)) next
    for (row_pos in seq_along(indices)) {
      idx <- indices[[row_pos]]
      top <- content_top + (row_pos - 1L) * row_height
      label <- sections[[idx]]
      size <- if (nchar(label, type = "width") > 58L) 16 else section_size
      doc <- add_text(
        doc,
        sprintf("%02d", offset + idx),
        column_lefts[[col]], top + 0.02, number_width, row_height - 0.04,
        number_size, accent, bold = TRUE
      )
      doc <- add_text(
        doc,
        label,
        column_lefts[[col]] + number_width + gap,
        top,
        col_width - number_width - gap,
        row_height,
        size,
        text_color,
        bold = TRUE
      )
    }
  }
  doc
}

# Resuelve los dos marcadores inferiores de texto por su geometría real. Las
# plantillas general y ACNUR no asignan los mismos `type_idx`, por lo que usar
# índices fijos puede enviar la fuente al pie izquierdo y hacerla chocar con el
# logo de la institución asociada.
.ppt_bottom_text_specs <- function(layout_props, slide_width = 13.33333,
                                   slide_height = 7.5) {
  if (!is.data.frame(layout_props) || !nrow(layout_props)) return(NULL)
  required <- c("type", "type_idx", "ph_label", "offx", "offy", "cx", "cy")
  if (!all(required %in% names(layout_props))) return(NULL)

  props <- layout_props[
    layout_props$type == "body" &
      is.finite(layout_props$offx) & is.finite(layout_props$offy) &
      is.finite(layout_props$cx) & is.finite(layout_props$cy) &
      layout_props$offx >= 0 & layout_props$offy >= slide_height * 0.72 &
      layout_props$offx + layout_props$cx <= slide_width + 0.05 &
      layout_props$offy + layout_props$cy <= slide_height + 0.05 &
      layout_props$cx >= 1 & layout_props$cy >= 0.10,
    , drop = FALSE
  ]
  if (nrow(props) < 2L) return(NULL)
  props <- props[order(props$offx), , drop = FALSE]
  picks <- props[c(1L, nrow(props)), , drop = FALSE]

  as_spec <- function(row, semantic_label, align) {
    list(
      type = "body",
      type_idx = as.integer(row$type_idx[[1]]),
      ph_label = semantic_label,
      align = align,
      loc = list(
        left = as.numeric(row$offx[[1]]),
        top = as.numeric(row$offy[[1]]),
        width = as.numeric(row$cx[[1]]),
        height = as.numeric(row$cy[[1]])
      )
    )
  }

  list(
    base = as_spec(picks[1, , drop = FALSE], "prosecnur:slide_1:base", "left"),
    right = as_spec(picks[2, , drop = FALSE], "prosecnur:slide_1:right", "right")
  )
}

# TRUE si los refs de un multilista abarcan mas de una fuente explicita
# ("docentes$x", "estudiantes$y"). Con una sola fuente, la base auto del
# slide duplica el caption del grafico y se suprime (dedup P20); la base
# multi-fuente ("Base: 2 docentes, 3 estudiantes...") si aporta y se queda.
#' @keywords internal
.base_multifuente_el <- function(el, extract) {
  refs <- c(
    extract(el$vars %||% NULL), extract(el$var %||% NULL),
    unlist(lapply(el$bloques %||% list(), function(b) {
      extract(c(b$var %||% NULL, b$vars %||% NULL))
    }))
  )
  .base_refs_multifuente(refs)
}

#' @keywords internal
# OJO: este predicado NO decide si hay nota de base, solo si las refs cruzan
# varias fuentes. El camino `multilista` de `reporte_plan_ppt.R` lo usaba como
# condicion para emitirla, y una lamina de escalas mixtas sobre un solo publico
# salia SIN base — 9 de las 44 del mazo de equivalencias medido. En un informe de
# encuesta la base no es opcional; si se vuelve a usar como guard, que sea para
# elegir el FORMATO, nunca para decidir si se escribe.
.base_refs_multifuente <- function(refs) {
  refs <- as.character(refs %||% character(0))
  srcs <- refs[grepl("$", refs, fixed = TRUE)]
  srcs <- unique(sub("\\$.*$", "", srcs))
  length(srcs) > 1L
}

# Leyenda del slide Top Two Box (H18). Con el layout fijo (gap 88, una linea
# centrada bajo cada swatch) diez categorias desbordaban sobre el texto del
# extremo derecho y las etiquetas largas se superponian en una sopa ilegible.
# Aqui el gap se adapta al ancho de la barra, la tipografia se reduce con
# muchas categorias y cada etiqueta envuelve a lo sumo en dos lineas que
# caben bajo su swatch (con elipsis si aun asi no cabe).
#' @keywords internal
.top_two_legend_svg <- function(etiquetas, colores, bar_x, bar_w,
                                legend_size, color_texto, escape) {
  n <- length(etiquetas)
  if (!n) return(character(0))
  legend_y <- 385
  gap <- base::max(56, base::min(88, (bar_w - 260) / base::max(1L, n - 1L)))
  x0 <- if (n <= 5L) bar_x + 170 else bar_x + (bar_w - gap * (n - 1L)) / 2
  size_eff <- if (n > 8L) base::max(10, legend_size - 9)
    else if (n > 6L) base::max(12, legend_size - 6)
    else legend_size
  max_chars <- base::max(6L, as.integer(floor(gap / (size_eff * 0.55))))

  vapply(seq_len(n), function(i) {
    x <- x0 + (i - 1L) * gap
    palabras <- strsplit(as.character(etiquetas[[i]] %||% ""), "\\s+")[[1]]
    lineas <- character(0)
    actual <- ""
    for (w in palabras) {
      cand <- if (nzchar(actual)) paste(actual, w) else w
      if (nchar(cand) > max_chars && nzchar(actual)) {
        lineas <- c(lineas, actual)
        actual <- w
      } else {
        actual <- cand
      }
    }
    lineas <- c(lineas, actual)
    if (length(lineas) > 2L) {
      lineas <- c(lineas[[1]], paste(lineas[-1], collapse = " "))
    }
    lineas <- vapply(lineas, function(l) {
      if (nchar(l) > max_chars + 2L) paste0(substr(l, 1L, base::max(1L, max_chars)), "…") else l
    }, character(1))
    textos <- paste(vapply(seq_along(lineas), function(j) {
      sprintf(
        '<text x="%.2f" y="%.2f" text-anchor="middle" font-family="Arial, sans-serif" font-size="%.1f" font-weight="700" fill="%s">%s</text>',
        x + 12, legend_y + 46 + (j - 1L) * (size_eff + 4), size_eff, color_texto, escape(lineas[[j]])
      )
    }, character(1)), collapse = "")
    sprintf(
      '<rect x="%.2f" y="%.2f" width="24" height="24" fill="%s"/>%s',
      x, legend_y, colores[[i]], textos
    )
  }, character(1))
}

# Geometria adaptativa del indice limpio. La version rigida colisionaba en dos
# bordes vistos en render (H16/H17 del GOAL loop del motor PPT): un titulo que
# envuelve a dos lineas quedaba pisado por la primera fila (caja fija de 0.62
# y tabla anclada en 2.14), y con ~10 secciones el bloque desbordaba la lamina
# ademas de partir el badge "10.1" en dos lineas (ancho fijo 0.26). Aqui se
# estiman las lineas del titulo, se corre la tabla, se dimensiona el badge por
# digitos reales y se comprime filas/subtemas (con pisos y reduccion tipografica
# suave) cuando el presupuesto vertical no alcanza. Los overrides explicitos del
# analista en `style` son el punto de partida; la compresion solo los reduce
# cuando el bloque desbordaria la lamina.
#' @keywords internal
.indice_fit_layout <- function(style, title_txt, secciones, subindices_df) {
  sv <- function(name, default) {
    v <- style[[name]]
    if (is.null(v)) default else v
  }
  sn <- function(name, default, min = NULL, max = NULL) {
    v <- suppressWarnings(as.numeric(sv(name, default))[1])
    if (!length(v) || !is.finite(v)) v <- default
    if (!is.null(min)) v <- base::max(min, v)
    if (!is.null(max)) v <- base::min(max, v)
    v
  }

  n <- length(secciones)
  title_txt <- as.character(title_txt %||% "")[1]

  title_left <- sn("title_left", 6.58, min = 0)
  title_top <- sn("title_top", 1.32, min = 0)
  title_width <- sn("title_width", 5.10, min = 1)
  title_size <- sn("title_size", 28, min = 10)
  # 0.85 em por caracter: el titulo del indice va en mayusculas y bold.
  chars_por_linea <- base::max(8, floor(title_width * 96 / (title_size * 0.85)))
  lineas_titulo <- base::max(1L, as.integer(ceiling(nchar(title_txt) / chars_por_linea)))
  title_height <- sn("title_height", 0.62 + 0.40 * (lineas_titulo - 1L), min = 0.2)

  table_left <- sn("table_left", 6.56, min = 0)
  table_top <- sn("table_top", 2.14 + base::max(0, title_height - 0.62), min = 0)
  table_width <- sn("table_width", 5.22, min = 3)
  row_height_default <- if (n <= 4L) 0.55 else base::max(0.34, base::min(0.48, 2.34 / n))
  row_height <- sn("row_height", row_height_default, min = 0.24)

  style$number_width <- sv("number_width", 0.55)
  style$number_size <- sv("number_size", if (n <= 4L) 20 else 16)
  style$section_size <- sv("section_size", if (n <= 4L) 18 else 16)
  style$section_fill <- sv("section_fill", "#E7E7E7")
  style$row_gap_color <- sv("row_gap_color", "#F2F2F2")
  style$subtopic_heading <- sv("subtopic_heading", FALSE)
  style$subtopic_marker <- sv("subtopic_marker", "number_text")
  style$subtopic_row_height <- sn("subtopic_row_height", 0.76, min = 0.18)
  style$subtopic_col_gap <- sv("subtopic_col_gap", 0.16)
  style$subtopic_size <- sv("subtopic_size", 16)
  style$subtopic_number_size <- sv("subtopic_number_size", 16)
  style$subtopic_badge_gap <- sv("subtopic_badge_gap", 0.08)

  n_sub <- if (is.data.frame(subindices_df)) nrow(subindices_df) else 0L
  max_chars_numero <- if (n_sub > 0L) nchar(paste0(base::max(1L, n), ".", n_sub)) else 3L
  # 0.26 historico alcanza hasta "9.9"; cada caracter extra suma 0.07.
  style$subtopic_badge_width <- sv(
    "subtopic_badge_width",
    0.26 + 0.07 * base::max(0L, max_chars_numero - 3L)
  )

  bottom <- sn("indice_bottom_limit", 7.05, min = 5)
  cols <- base::max(1, round(sn("subtopic_cols", 2, min = 1, max = 3)))
  filas_sub <- if (n_sub > 0L) ceiling(n_sub / cols) else 0L
  colchon <- if (n_sub > 0L) 0.5 else 0.15
  filas_alto <- n * row_height + filas_sub * style$subtopic_row_height
  requerido <- filas_alto + colchon
  disponible <- bottom - table_top
  if (requerido > disponible && filas_alto > 0) {
    # El colchon no se escala: la reduccion recae entera sobre las filas.
    escala <- base::max(0.45, (disponible - colchon) / filas_alto)
    row_height <- base::max(0.26, row_height * escala)
    style$subtopic_row_height <- base::max(0.34, style$subtopic_row_height * escala)
    if (escala < 0.8) {
      reduce <- function(v, piso) base::max(piso, round(suppressWarnings(as.numeric(v)[1]) * 0.85))
      style$section_size <- reduce(style$section_size, 11)
      style$number_size <- reduce(style$number_size, 11)
      style$subtopic_size <- reduce(style$subtopic_size, 10)
      style$subtopic_number_size <- reduce(style$subtopic_number_size, 10)
    }
  }
  style$table_width <- table_width
  style$row_height <- row_height

  list(
    style = style,
    title_left = title_left, title_top = title_top,
    title_width = title_width, title_height = title_height, title_size = title_size,
    table_left = table_left, table_top = table_top,
    table_width = table_width, row_height = row_height
  )
}

# Recalibra pies (base/right/footer) e iconos del contrato contra la geometria
# del layout real. Los `type_idx` del contrato estan calibrados contra
# `plantilla_16_9.pptx`; las plantillas institucionales numeran los `body`
# distinto (la ACNUR no tiene el body-logo y todo el indice corre en uno), y el
# fallback por tipo colocaba el footer dentro del texto narrativo o del panel,
# y el pie de poblacion dentro del hueco del icono central.
#
# Criterio geometrico (el mismo que ya usaba slide_1 via
# `.ppt_bottom_text_specs`): pie = cajon inferior mas a la derecha; base =
# cajon inferior mas a la izquierda; icono = cajon cuadrado chico centrado
# fuera de la franja inferior. Si el layout tiene un solo cajon inferior y el
# slide tambien declara `base`, el pie se suprime (el cajon es de la base).
# Sin cajon utilizable, el slot se marca `suppress` y `.ph_with_strict` lo
# omite: mejor no mostrar el texto que ponerlo en un placeholder arbitrario.
#' @keywords internal
.ppt_calibrar_pies_iconos <- function(contract, doc, master, slide_dims,
                                      layout_exists, base_args = list()) {
  calibraciones <- list(
    list(ck = "slide_1",           slot = "base",       modo = "base"),
    list(ck = "slide_1",           slot = "right",      modo = "pie"),
    list(ck = "slide_2",           slot = "right_text", modo = "pie"),
    list(ck = "slide_1_narrativo", slot = "footer",     modo = "pie"),
    list(ck = "slide_2_narrativo", slot = "footer",     modo = "pie"),
    list(ck = "paneles_4",         slot = "footer",     modo = "pie"),
    list(ck = "text_r",            slot = "footer",     modo = "pie"),
    list(ck = "text_l",            slot = "footer",     modo = "pie"),
    list(ck = "text_r2",           slot = "footer",     modo = "pie"),
    list(ck = "text_l2",           slot = "footer",     modo = "pie"),
    list(ck = "text_r",            slot = "text",       modo = "panel"),
    list(ck = "text_l",            slot = "text",       modo = "panel"),
    list(ck = "text_r2",           slot = "text",       modo = "panel"),
    list(ck = "text_l2",           slot = "text",       modo = "panel"),
    list(ck = "poblacion_5",       slot = "footer",     modo = "pie"),
    list(ck = "poblacion_6",       slot = "footer",     modo = "pie"),
    list(ck = "poblacion_2",       slot = "icon",       modo = "icono"),
    list(ck = "poblacion_4",       slot = "icon",       modo = "icono"),
    list(ck = "poblacion_5",       slot = "icon",       modo = "icono"),
    list(ck = "poblacion_6",       slot = "icon",       modo = "icono")
  )

  props_cache <- list()
  layout_props_de <- function(layout_name) {
    if (!is.null(props_cache[[layout_name]])) return(props_cache[[layout_name]])
    props <- tryCatch(
      officer::layout_properties(doc, layout = layout_name, master = master),
      error = function(e) NULL
    )
    props_cache[[layout_name]] <<- props
    props
  }

  for (cal in calibraciones) {
    entry <- contract[[cal$ck]]
    if (is.null(entry)) next
    layout_name <- entry$layout
    if (is.null(layout_name) || is.na(layout_name) || !layout_exists(layout_name)) next
    spec <- entry$slots[[cal$slot]]
    if (is.null(spec)) next
    props <- layout_props_de(layout_name)
    if (is.null(props) || !nrow(props)) next

    bodies <- props[
      props$type == "body" &
        is.finite(props$offx) & is.finite(props$offy) &
        is.finite(props$cx) & is.finite(props$cy),
      , drop = FALSE
    ]
    target <- NULL
    if (cal$modo %in% c("pie", "base")) {
      bottom <- bodies[
        bodies$offy >= slide_dims$height * 0.72 &
          bodies$cy > 0.05 & bodies$cy <= 1 & bodies$cx >= 1 &
          bodies$offx >= 0 &
          bodies$offx + bodies$cx <= slide_dims$width + 0.05,
        , drop = FALSE
      ]
      if (identical(cal$modo, "base")) {
        if (nrow(bottom)) target <- bottom[which.min(bottom$offx), , drop = FALSE]
        # Sin cajon inferior, la base conserva su loc del contrato.
        if (is.null(target)) next
      } else {
        tiene_base <- !is.null(entry$slots$base)
        if (nrow(bottom) >= 2L || (nrow(bottom) == 1L && !tiene_base)) {
          target <- bottom[which.max(bottom$offx), , drop = FALSE]
        }
      }
    } else if (identical(cal$modo, "panel")) {
      # El panel lateral de texto de los layouts grafico+texto: el unico
      # cajon alto fuera de la franja inferior. Sin el, el texto principal
      # caia al cajon inferior-izquierdo.
      paneles <- bodies[
        bodies$offy < slide_dims$height * 0.72 & bodies$cy >= 3,
        , drop = FALSE
      ]
      if (nrow(paneles)) target <- paneles[which.max(paneles$cy), , drop = FALSE]
      if (is.null(target)) next
    } else if (identical(cal$modo, "icono")) {
      cuadrados <- bodies[
        bodies$offy < slide_dims$height * 0.72 &
          bodies$cy >= 1 & bodies$cx <= 3 &
          abs(bodies$cx - bodies$cy) <= 0.6,
        , drop = FALSE
      ]
      if (nrow(cuadrados)) {
        centrado <- abs(cuadrados$offx + cuadrados$cx / 2 - slide_dims$width / 2)
        target <- cuadrados[which.min(centrado), , drop = FALSE]
      }
    }

    if (is.null(target)) {
      spec$suppress <- TRUE
      spec$loc <- NULL
    } else {
      spec$suppress <- NULL
      spec$type_idx <- suppressWarnings(as.integer(target$type_idx[[1]]))
      spec$loc <- list(
        left = as.numeric(target$offx[[1]]),
        top = as.numeric(target$offy[[1]]),
        width = as.numeric(target$cx[[1]]),
        height = as.numeric(target$cy[[1]])
      )
      if (identical(cal$modo, "base")) spec$align <- spec$align %||% "left"
      if (identical(cal$modo, "pie")) spec$align <- spec$align %||% "right"
    }
    if (identical(cal$ck, "slide_1") && identical(cal$slot, "right") &&
        !isTRUE(spec$suppress)) {
      spec <- .ppt_configured_source_spec(spec, base_args)
    }
    contract[[cal$ck]]$slots[[cal$slot]] <- spec
  }

  contract
}

.ppt_configured_source_spec <- function(spec, base_args = list()) {
  if (!is.list(spec)) return(spec)
  values <- suppressWarnings(as.numeric(c(
    base_args$source_footer_left,
    base_args$source_footer_top,
    base_args$source_footer_width,
    base_args$source_footer_height
  )))
  if (length(values) == 4L && all(is.finite(values)) &&
      values[[1]] >= 0 && values[[2]] >= 0 && values[[3]] > 0 && values[[4]] > 0) {
    spec$loc <- list(
      left = values[[1]],
      top = values[[2]],
      width = values[[3]],
      height = values[[4]]
    )
  }
  align <- tolower(trimws(as.character(base_args$source_footer_align %||% spec$align %||% "left")[[1]]))
  if (!align %in% c("left", "center", "right")) align <- "left"
  spec$align <- align
  spec$ph_label <- "prosecnur:slide_1:right"
  spec
}

# Conserva el placeholder nativo cuando es utilizable y aplica una ubicación
# segura únicamente cuando la plantilla lo dejó fuera del lienzo o sin tamaño.
.ppt_safe_section_title_spec <- function(layout_props, slide_width = 13.33333,
                                         slide_height = 7.5, spec) {
  if (!is.list(spec)) spec <- list(type = "title", type_idx = 1L)
  # Marcamos el placeholder como titulo de seccion para que el estilizador de
  # PPT aplique la tipografia de seccion del perfil (tamano/color/bold propios,
  # ej. ACNUR 30pt azul institucional) en lugar del estilo de titulo de slide.
  spec$ph_label <- "prosecnur:section:title"
  props <- if (is.data.frame(layout_props) && nrow(layout_props)) {
    layout_props[layout_props$type == "title", , drop = FALSE]
  } else {
    data.frame()
  }
  if (nrow(props) && !is.null(spec$type_idx) && "type_idx" %in% names(props)) {
    indexed <- props[props$type_idx == as.integer(spec$type_idx)[1], , drop = FALSE]
    if (nrow(indexed)) props <- indexed
  }

  valid <- nrow(props) > 0L && all(c("offx", "offy", "cx", "cy") %in% names(props))
  if (valid) {
    row <- props[1, , drop = FALSE]
    values <- unlist(row[c("offx", "offy", "cx", "cy")], use.names = TRUE)
    valid <- all(is.finite(values)) &&
      values[["offx"]] >= 0 && values[["offy"]] >= 0 &&
      values[["cx"]] >= 1 && values[["cy"]] >= 0.30 &&
      values[["offx"]] + values[["cx"]] <= slide_width + 0.05 &&
      values[["offy"]] + values[["cy"]] <= slide_height + 0.05
  }
  if (isTRUE(valid)) return(spec)

  # Titulo de seccion desplazado a la derecha del acento vertical de la
  # plantilla y centrado verticalmente, para que la lamina lea como un divisor
  # intencional y no como un titulo flotando en un lienzo vacio.
  #
  # OJO: estas constantes NO son arbitrarias y no hay que "alinearlas" con el
  # margen de las laminas de contenido (0.88 cm). El layout trae una barra de
  # acento (`prosecnur:section:accent`) en x 2.06-2.39 cm centrada en y 8.86 cm;
  # el 0.082 deja el titulo justo a su derecha y el 0.335 + 0.26 centran la caja
  # sobre ella. Bajar el left a 0.88 hace que el acento parta la primera letra.
  spec$loc <- list(
    left = slide_width * 0.082,
    top = slide_height * 0.335,
    width = slide_width * 0.82,
    height = slide_height * 0.26
  )
  # El texto va centrado en su caja para quedar a la altura del acento. Sin esto
  # officer emite un `<a:bodyPr/>` vacio y, como la shape lleva un `<p:ph/>` sin
  # type ni idx, no resuelve contra el placeholder `title` del layout: hereda el
  # body del master (anchor="t") y el titulo se despega hacia arriba de la barra.
  spec$anchor <- "ctr"
  spec
}

#' @keywords internal
.PPT_CONTRACT <- list(

  # ------------------------------------------------------------
  # SECTION
  # body 1 = LOGO (skip)
  # No hay placeholder de subtitulo real en la plantilla;
  # el argumento subtitulo del slide solo se usa en Word.
  # ------------------------------------------------------------
  section = list(
    layout = "Section Header",
    slots  = list(
      title = list(type = "title", type_idx = NULL)
    )
  ),

  # ------------------------------------------------------------
  # TEXT SLIDE
  # layout textual limpio (Title and Content)
  # title = placeholder de titulo
  # body  = contenido analitico y base concatenada al final
  # ------------------------------------------------------------
  text_slide = list(
    layout = "Title and Content",
    slots  = list(
      title = list(type = "title", type_idx = 1),
      text  = list(type = "body",  type_idx = 2)
    )
  ),

  # ------------------------------------------------------------
  # TECHNICAL TABLE
  # Usa el layout textual como base, pero el contenido se inserta
  # con posiciones absolutas para producir una tabla PPT nativa.
  # ------------------------------------------------------------
  technical_table = list(
    layout = "Title and Content",
    slots  = list()
  ),

  # ------------------------------------------------------------
  # TITLE SLIDE
  # body 1 = logo derecho (Google Shape;18;p45) — SKIP
  # body 2 = logo izquierdo (Google Shape;19;p45) — SKIP
  # body 3 = linea decorativa (shape) — SKIP
  # body 4 = "Text Placeholder 3" (4.1, 6.5) — subtexto inferior
  # ------------------------------------------------------------
  title_slide = list(
    layout = "Title Slide",
    slots  = list(
      title    = list(type = "ctrTitle", type_idx = 1),
      subtitle = list(type = "subTitle", type_idx = 1),
      date     = list(type = "dt",       type_idx = 1),
      subtexto = list(type = "body",     type_idx = 4)
    )
  ),

  # ------------------------------------------------------------
  # INDICE
  # ------------------------------------------------------------
  indice = list(
    layout = "Indice",
    slots  = list()
  ),

  # ------------------------------------------------------------
  # OBJETIVO CON ICONO
  # body 1 = logo superior derecho (Google Shape;66;p47) — SKIP
  # body 2 = "Marcador de texto 11" (3.9, 1.9) 8.5x2.3 — TEXT
  # body 3 = "Marcador de contenido 2" (1.7, 2.1) 1.9x1.9 — ICON
  # body 4..8 = shapes decorativos — SKIP
  # ------------------------------------------------------------
  objetivo_icono = list(
    layout = "Objetivos_Secciones",
    slots  = list(
      title = list(type = "title", type_idx = 1),
      icon  = list(type = "body",  type_idx = 3),
      text  = list(type = "body",  type_idx = 2)
    )
  ),

  # ------------------------------------------------------------
  # SLIDE 1 (1 gráfico)
  # Tanto `Graficos` como `Graficos2` comparten esta estructura efectiva:
  # body 1 = LOGO (skip)
  # body 2 = placeholder inferior izquierdo — base
  # body 3 = placeholder inferior derecho — pie/right
  # ------------------------------------------------------------
  slide_1 = list(
    layout = "Graficos",
    slots  = list(
      title = list(type = "title", type_idx = NULL),
      plot  = list(type = "pic",   type_idx = NULL),
      base  = list(type = "body",  type_idx = 2, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      # `role` lo lee solo la capa de preview (.graficos_placeholder_role):
      # sin la marca, la heuristica por nombre clasificaba este pie de texto
      # como slot de grafico. El motor PPT ignora este campo.
      right = list(type = "body",  type_idx = 3, role = "note")
    )
  ),

  # ------------------------------------------------------------
  # SLIDE 2 (2 gráficos)
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 3 = "Text Placeholder 9" (8.2, 6.9) — right_text/pie
  # ------------------------------------------------------------
  slide_2 = list(
    layout = "Graficos_2columnas",
    slots  = list(
      title      = list(type = "title", type_idx = NULL),
      left       = list(type = "pic",   type_idx = 2),
      right      = list(type = "pic",   type_idx = 1),
      base       = list(type = "body",  type_idx = 2, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      right_text = list(type = "body",  type_idx = 3)
    )
  ),

  # ------------------------------------------------------------
  # SLIDE 1 NARRATIVO (1 grafico + bloque narrativo)
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 9" (0.3, 1.3) 12.7x0.6 — texto narrativo
  # body 3 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 4 = "Text Placeholder 9" (8.2, 6.9) — footer
  # ------------------------------------------------------------
  slide_1_narrativo = list(
    layout = "1_Grafico_narrativo",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      text   = list(type = "body",  type_idx = 2, loc = list(left = 0.55, top = 1.10, width = 12.10, height = 0.38)),
      plot   = list(type = "pic",   type_idx = 1, loc = list(left = 0.55, top = 1.55, width = 12.10, height = 5.22)),
      base   = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer = list(type = "body",  type_idx = 4)
    )
  ),

  # ------------------------------------------------------------
  # SLIDE 2 NARRATIVO (2 graficos + bloque narrativo)
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 9" (0.3, 1.3) 12.7x0.6 — texto narrativo
  # body 3 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 4 = "Text Placeholder 9" (8.2, 6.9) — footer
  # ------------------------------------------------------------
  slide_2_narrativo = list(
    layout = "1_Graficos_2columnas_narrativo",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      text   = list(type = "body",  type_idx = 2, loc = list(left = 0.55, top = 1.10, width = 12.10, height = 0.38)),
      left   = list(type = "pic",   type_idx = 2, loc = list(left = 0.55, top = 1.58, width = 5.95, height = 5.14)),
      right  = list(type = "pic",   type_idx = 1, loc = list(left = 7.05, top = 1.58, width = 5.95, height = 5.14)),
      base   = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer = list(type = "body",  type_idx = 4)
    )
  ),

  # ------------------------------------------------------------
  # 4_PANELES (4 graficos sin espacio para iconos)
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 3 = "Text Placeholder 9" (8.2, 6.9) — footer
  # No hay placeholder para tag/etiqueta en este layout.
  # ------------------------------------------------------------
  paneles_4 = list(
    layout = "4_paneles",
    slots  = list(
      title        = list(type = "title", type_idx = 1),
      up_left      = list(type = "pic",   type_idx = 2),
      up_right     = list(type = "pic",   type_idx = 1),
      bottom_left  = list(type = "pic",   type_idx = 4),
      bottom_right = list(type = "pic",   type_idx = 3),
      base         = list(type = "body",  type_idx = 2, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer       = list(type = "body",  type_idx = 3)
    )
  ),

  # ------------------------------------------------------------
  # POBLACION_4 — 4 gráficos 2x2 con nombres posicionales
  # body 1 = logo superior derecho — SKIP
  # body 2 = "Content Placeholder 5" (5.8, 3.2) 1.9x1.9 — icono central
  # body 3 = "Text Placeholder 9" (0.5, 6.9) — base (pie de lamina)
  # ------------------------------------------------------------
  poblacion_4 = list(
    layout = "poblacion_4",
    slots  = list(
      title        = list(type = "title", type_idx = 1),

      up_left      = list(type = "pic",   type_idx = 1),
      up_right     = list(type = "pic",   type_idx = 2),
      bottom_left  = list(type = "pic",   type_idx = 3),
      bottom_right = list(type = "pic",   type_idx = 4),

      base         = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      icon         = list(type = "body",  type_idx = 2)
    )
  ),

  # ------------------------------------------------------------
  # POBLACION_2 — 2 paneles grandes (body/body) + icono central
  # body 1 = logo superior derecho — SKIP
  # body 2 = "Place holder 1" (0.4, 1.4) 5.1x5.3 — panel IZQUIERDO
  # body 3 = "Place holder 2" (7.9, 1.4) 5.1x5.3 — panel DERECHO
  # body 4 = "Content Placeholder 5" (5.8, 3.2) 1.9x1.9 — icono central
  # ------------------------------------------------------------
  poblacion_2 = list(
    layout = "poblacion_2",
    slots  = list(
      title = list(type = "title", type_idx = 1),
      text  = list(type = "body",  type_idx = 2, loc = list(left = 0.55, top = 1.10, width = 12.10, height = 0.38)),
      left  = list(type = "body",  type_idx = 2, loc = list(left = 0.50, top = 1.62, width = 5.15, height = 5.05)),
      right = list(type = "body",  type_idx = 3, loc = list(left = 7.68, top = 1.62, width = 5.15, height = 5.05)),
      icon  = list(type = "body",  type_idx = 4),
      base  = list(type = "body",  type_idx = NULL, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left")
    )
  ),

  # ------------------------------------------------------------
  # POBLACION_5 — 5 pics + footer + icon
  # body 1 = logo superior derecho — SKIP
  # body 2 = "Content Placeholder 5" (5.7, 3.4) 1.9x1.9 — icono central
  # body 3 = "Text Placeholder 9" (0.5, 6.9) — footer (pie de lamina)
  # pics:  pic 1..5
  # ------------------------------------------------------------
  poblacion_5 = list(
    layout = "poblacion_5",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      footer = list(type = "body",  type_idx = 3),
      icon   = list(type = "body",  type_idx = 2),

      pic1   = list(type = "pic",   type_idx = 1),
      pic2   = list(type = "pic",   type_idx = 2),
      pic3   = list(type = "pic",   type_idx = 3),
      pic4   = list(type = "pic",   type_idx = 4),
      pic5   = list(type = "pic",   type_idx = 5)
    )
  ),

  # ------------------------------------------------------------
  # POBLACION_6 — 6 pics + footer + icon
  # body 1 = logo superior derecho — SKIP
  # body 2 = "Content Placeholder 5" (6.0, 3.4) 1.5x1.5 — icono central
  # body 3 = "Text Placeholder 9" (0.5, 6.9) — footer (pie de lamina)
  # pics:  pic 1..6
  # ------------------------------------------------------------
  poblacion_6 = list(
    layout = "poblacion_6",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      footer = list(type = "body",  type_idx = 3),
      icon   = list(type = "body",  type_idx = 2),

      pic1   = list(type = "pic",   type_idx = 1),
      pic2   = list(type = "pic",   type_idx = 2),
      pic3   = list(type = "pic",   type_idx = 3),
      pic4   = list(type = "pic",   type_idx = 4),
      pic5   = list(type = "pic",   type_idx = 5),
      pic6   = list(type = "pic",   type_idx = 6)
    )
  ),

  # ------------------------------------------------------------
  # GRAFICO + TEXTO — gráfico izquierda, texto derecha
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 4" (6.8, 1.2) 6.1x5.6 — texto principal
  # body 3 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 4 = "Text Placeholder 9" (8.2, 6.9) — footer
  # ------------------------------------------------------------
  text_r = list(
    layout = "right_grafico_texto",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      text   = list(type = "body",  type_idx = 2),
      plot   = list(type = "pic",   type_idx = 1),
      base   = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer = list(type = "body",  type_idx = 4)
    )
  ),

  # ------------------------------------------------------------
  # GRAFICO + TEXTO — texto izquierda, gráfico derecha
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 4" (0.3, 1.2) 6.1x5.6 — texto principal
  # body 3 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 4 = "Text Placeholder 9" (8.2, 6.9) — footer
  # ------------------------------------------------------------
  text_l = list(
    layout = "left_grafico_texto",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      text   = list(type = "body",  type_idx = 2),
      plot   = list(type = "pic",   type_idx = 1),
      base   = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer = list(type = "body",  type_idx = 4)
    )
  ),

  # ------------------------------------------------------------
  # 2 GRAFICOS + TEXTO — 2 gráficos + texto a la derecha
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 4" (6.8, 1.2) 6.1x5.6 — texto principal
  # body 3 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 4 = "Text Placeholder 9" (8.2, 6.9) — footer
  # ------------------------------------------------------------
  text_r2 = list(
    layout = "right_2graficos_texto",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      text   = list(type = "body",  type_idx = 2),

      plot1  = list(type = "pic",   type_idx = 1),
      plot2  = list(type = "pic",   type_idx = 2),

      base   = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer = list(type = "body",  type_idx = 4)
    )
  ),

  # ------------------------------------------------------------
  # 2 GRAFICOS + TEXTO — texto a la izquierda + 2 gráficos
  # body 1 = LOGO (skip)
  # body 2 = "Text Placeholder 4" (0.3, 1.2) 6.1x5.6 — texto principal
  # body 3 = "Text Placeholder 9" (0.3, 6.9) — base
  # body 4 = "Text Placeholder 9" (8.2, 6.9) — footer
  # ------------------------------------------------------------
  text_l2 = list(
    layout = "left_2graficos_texto",
    slots  = list(
      title  = list(type = "title", type_idx = 1),
      text   = list(type = "body",  type_idx = 2),

      plot1  = list(type = "pic",   type_idx = 1),
      plot2  = list(type = "pic",   type_idx = 2),

      base   = list(type = "body",  type_idx = 3, loc = list(left = 0.50, top = 7.04, width = 6.40, height = 0.25), align = "left"),
      footer = list(type = "body",  type_idx = 4)
    )
  )

)

#' @keywords internal
.ppt_contract_with_semantic_labels <- function(contract) {
  if (!is.list(contract) || !length(contract)) return(contract)

  for (ctype in names(contract)) {
    slots <- contract[[ctype]]$slots %||% NULL
    if (is.null(slots) || !is.list(slots) || !length(slots)) next

    for (slot_name in names(slots)) {
      spec <- slots[[slot_name]]
      if (!is.list(spec) || is.null(spec$type)) next
      if (is.null(spec$ph_label) || !nzchar(spec$ph_label)) {
        spec$ph_label <- paste0("prosecnur:", ctype, ":", slot_name)
      }
      slots[[slot_name]] <- spec
    }

    contract[[ctype]]$slots <- slots
  }

  contract
}

.PPT_CONTRACT <- .ppt_contract_with_semantic_labels(.PPT_CONTRACT)

# =============================================================================
# HELPERS internos (recolección, construcción y validación)
# - MVP: p_slide_seccion() + p_slide_1_grafico() + p_barras_apiladas()
# - Se asume que los slides tienen clase "ppt_slide" y campo .slide_type
# =============================================================================

#' @keywords internal
.collect_diapo_objects <- function(env = parent.frame(), strict = FALSE) {

  if (!is.environment(env)) {
    stop("`.collect_diapo_objects()`: `env` debe ser un environment.", call. = FALSE)
  }

  nms <- ls(envir = env, all.names = TRUE)
  nms <- nms[grepl("^diapo_\\d{3}$", nms)]

  if (!length(nms)) {
    return(list())
  }

  # ordenar por número
  ids <- as.integer(sub("^diapo_(\\d{3})$", "\\1", nms))
  ord <- order(ids)
  nms <- nms[ord]
  ids <- ids[ord]

  # recuperar objetos SIN heredar (para evitar colisiones raras)
  objs <- mget(nms, envir = env, inherits = FALSE)

  # validación ligera: clase ppt_slide
  bad <- vapply(objs, function(x) !inherits(x, "ppt_slide"), logical(1))
  if (any(bad)) {
    msg <- paste0(
      "`.collect_diapo_objects()`: estos objetos `diapo_###` no son `ppt_slide`: ",
      paste(names(objs)[bad], collapse = ", ")
    )
    if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
  }

  # strict: consecutividad (si hay >1)
  if (isTRUE(strict) && length(ids) > 1) {
    dif <- diff(ids)
    if (any(dif != 1L)) {
      stop(
        "strict=TRUE: los `diapo_###` no son consecutivos (hay saltos en la numeración).",
        call. = FALSE
      )
    }
  }

  objs
}

#' @keywords internal
.validate_plan <- function(plan, strict = FALSE) {

  if (!is.list(plan)) {
    stop("`.validate_plan()`: `plan` debe ser una lista de slides.", call. = FALSE)
  }
  if (!length(plan)) return(invisible(TRUE))

  bad_slide <- vapply(plan, function(x) !inherits(x, "ppt_slide"), logical(1))
  if (any(bad_slide)) {
    msg <- paste0(
      "`.validate_plan()`: hay elementos del plan que no son `ppt_slide` en posiciones: ",
      paste(which(bad_slide), collapse = ", ")
    )
    if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
  }

  for (i in seq_along(plan)) {
    s <- plan[[i]]
    if (!inherits(s, "ppt_slide")) next

    stype <- s$.slide_type %||% NA_character_

    # ---- SECTION ------------------------------------------------------------
    if (identical(stype, "section")) {

      ttl <- s$title %||% NULL
      ok  <- !is.null(ttl) && is.character(ttl) && length(ttl) == 1L && nzchar(trimws(ttl))

      if (!ok) {
        msg <- paste0("`.validate_plan()`: section (i=", i, ") requiere `title` no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }

      # subtitle es opcional; si existe debe ser character(1)
      sub <- s$subtitle %||% NULL
      if (!is.null(sub) && !(is.character(sub) && length(sub) == 1L)) {
        msg <- paste0("`.validate_plan()`: section (i=", i, ") `subtitle` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }

      next
    }

    # -------------------------
    # TEXT_SLIDE
    # -------------------------
    if (identical(stype, "text_slide")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: text_slide (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      ttl <- slots$title %||% s$title %||% NULL
      if (is.null(ttl) || !is.character(ttl) || length(ttl) != 1L || !nzchar(trimws(ttl))) {
        msg <- paste0("`.validate_plan()`: text_slide (i=", i, ") requiere `title` no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      txt <- slots$text %||% NULL
      if (is.null(txt) || !(is.character(txt) && length(txt) == 1L && nzchar(trimws(txt)))) {
        msg <- paste0("`.validate_plan()`: text_slide (i=", i, ") requiere `slots$text` como character(1) no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # TECHNICAL_TABLE
    # -------------------------
    if (identical(stype, "technical_table")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: technical_table (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      ttl <- slots$title %||% s$title %||% NULL
      if (is.null(ttl) || !is.character(ttl) || length(ttl) != 1L || !nzchar(trimws(ttl))) {
        msg <- paste0("`.validate_plan()`: technical_table (i=", i, ") requiere `title` no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      tb <- slots$table %||% NULL
      if (is.null(tb) || !is.data.frame(tb) || ncol(tb) < 2L || !nrow(tb)) {
        msg <- paste0("`.validate_plan()`: technical_table (i=", i, ") requiere `slots$table` como data.frame con al menos dos columnas y una fila.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      base <- slots$base %||% NULL
      if (!is.null(base) && !(is.character(base) && length(base) == 1L)) {
        msg <- paste0("`.validate_plan()`: technical_table (i=", i, ") `slots$base` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # TITLE SLIDE (nuevo)
    # -------------------------
    if (identical(stype, "title_slide")) {
      ttl <- s$slots$title %||% s$title %||% NULL
      ok  <- !is.null(ttl) && is.character(ttl) && length(ttl) == 1L && nzchar(trimws(ttl))
      if (!ok) {
        msg <- paste0("`.validate_plan()`: title_slide (i=", i, ") requiere `title` no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # INDICE
    # -------------------------
    if (identical(stype, "indice")) {
      next
    }

    # -------------------------
    # TOP_TWO_BOX
    # -------------------------
    if (identical(stype, "top_two_box")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: top_two_box (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      ttl <- slots$title %||% s$title %||% NULL
      if (is.null(ttl) || !is.character(ttl) || length(ttl) != 1L || !nzchar(trimws(ttl))) {
        msg <- paste0("`.validate_plan()`: top_two_box (i=", i, ") requiere `title` no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      txt <- slots$text %||% NULL
      if (is.null(txt) || !(is.character(txt) && length(txt) == 1L && nzchar(trimws(txt)))) {
        msg <- paste0("`.validate_plan()`: top_two_box (i=", i, ") requiere `slots$text` como character(1) no vacío.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # OBJETIVO_ICONO
    # -------------------------
    if (identical(stype, "objetivo_icono")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: objetivo_icono (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      ic <- slots$icon %||% NULL
      if (is.null(ic) || !inherits(ic, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: objetivo_icono (i=", i, ") requiere `slots$icon` como `ppt_element`.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      tx <- slots$text %||% NULL
      if (!is.null(tx) && !(is.character(tx) && length(tx) == 1L)) {
        msg <- paste0("`.validate_plan()`: objetivo_icono (i=", i, ") `slots$text` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # SLIDE_1
    # -------------------------
    if (identical(stype, "slide_1")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: slide_1 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      pl <- slots$plot %||% NULL
      if (is.null(pl) || !inherits(pl, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: slide_1 (i=", i, ") requiere `slots$plot` como `ppt_element`.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # SLIDE_2
    # -------------------------
    if (identical(stype, "slide_2")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: slide_2 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      el_left  <- slots$left  %||% NULL
      el_right <- slots$right %||% NULL
      if (is.null(el_left) || !inherits(el_left, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: slide_2 (i=", i, ") requiere `slots$left` como `ppt_element`.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      if (is.null(el_right) || !inherits(el_right, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: slide_2 (i=", i, ") requiere `slots$right` como `ppt_element`.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # SLIDE_1_NARRATIVO
    # -------------------------
    if (identical(stype, "slide_1_narrativo")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: slide_1_narrativo (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      pl <- slots$plot %||% NULL
      if (is.null(pl) || !inherits(pl, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: slide_1_narrativo (i=", i, ") requiere `slots$plot` como `ppt_element`.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      tx <- slots$text %||% NULL
      if (!is.null(tx) && !(is.character(tx) && length(tx) == 1L)) {
        msg <- paste0("`.validate_plan()`: slide_1_narrativo (i=", i, ") `slots$text` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # SLIDE_2_NARRATIVO
    # -------------------------
    if (identical(stype, "slide_2_narrativo")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: slide_2_narrativo (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      for (nm in c("left", "right")) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: slide_2_narrativo (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      tx <- slots$text %||% NULL
      if (!is.null(tx) && !(is.character(tx) && length(tx) == 1L)) {
        msg <- paste0("`.validate_plan()`: slide_2_narrativo (i=", i, ") `slots$text` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # POBLACION_4
    # -------------------------
    if (identical(stype, "poblacion_4")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: poblacion_4 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      need <- c("up_left","up_right","bottom_left","bottom_right")
      for (nm in need) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: poblacion_4 (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      ic <- slots$icon %||% NULL
      if (!is.null(ic) && !inherits(ic, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: poblacion_4 (i=", i, ") `slots$icon` debe ser `ppt_element` o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # PANELES_4
    # -------------------------
    if (identical(stype, "paneles_4")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: paneles_4 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      need <- c("up_left","up_right","bottom_left","bottom_right")
      for (nm in need) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: paneles_4 (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      next
    }

    # -------------------------
    # TEXT_R / TEXT_L
    # -------------------------
    if (identical(stype, "text_r") || identical(stype, "text_l")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: ", stype, " (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      el_plot <- slots$plot %||% NULL
      if (is.null(el_plot) || !inherits(el_plot, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: ", stype, " (i=", i, ") requiere `slots$plot` como `ppt_element`.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      # texto puede ser character(1) (lo insertas en PPT)
      tx <- slots$text %||% NULL
      if (!is.null(tx) && !(is.character(tx) && length(tx) == 1L)) {
        msg <- paste0("`.validate_plan()`: ", stype, " (i=", i, ") `slots$text` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # POBLACION_2
    # -------------------------
    if (identical(stype, "poblacion_2")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: poblacion_2 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      # Ajusta los nombres si tu layout usa otros
      need <- c("left", "right")
      for (nm in need) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: poblacion_2 (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      ic <- slots$icon %||% NULL
      if (!is.null(ic) && !inherits(ic, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: poblacion_2 (i=", i, ") `slots$icon` debe ser `ppt_element` o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # POBLACION_5
    # -------------------------
    if (identical(stype, "poblacion_5")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: poblacion_5 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      need <- paste0("pic", 1:5)
      for (nm in need) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: poblacion_5 (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      ic <- slots$icon %||% NULL
      if (!is.null(ic) && !inherits(ic, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: poblacion_5 (i=", i, ") `slots$icon` debe ser `ppt_element` o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # POBLACION_6
    # -------------------------
    if (identical(stype, "poblacion_6")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: poblacion_6 (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      need <- paste0("pic", 1:6)
      for (nm in need) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: poblacion_6 (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      ic <- slots$icon %||% NULL
      if (!is.null(ic) && !inherits(ic, "ppt_element")) {
        msg <- paste0("`.validate_plan()`: poblacion_6 (i=", i, ") `slots$icon` debe ser `ppt_element` o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }

    # -------------------------
    # TEXT_R2 / TEXT_L2
    # -------------------------
    if (identical(stype, "text_r2") || identical(stype, "text_l2")) {
      slots <- s$slots %||% NULL
      if (is.null(slots) || !is.list(slots)) {
        msg <- paste0("`.validate_plan()`: ", stype, " (i=", i, ") requiere `slots` como lista.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        next
      }
      for (nm in c("plot1","plot2")) {
        el <- slots[[nm]] %||% NULL
        if (is.null(el) || !inherits(el, "ppt_element")) {
          msg <- paste0("`.validate_plan()`: ", stype, " (i=", i, ") requiere `slots$", nm, "` como `ppt_element`.")
          if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
        }
      }
      tx <- slots$text %||% NULL
      if (!is.null(tx) && !(is.character(tx) && length(tx) == 1L)) {
        msg <- paste0("`.validate_plan()`: ", stype, " (i=", i, ") `slots$text` debe ser character(1) o NULL.")
        if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
      }
      next
    }


    # -------------------------
    # default
    # -------------------------
    msg <- paste0(
      "`.validate_plan()`: slide type no soportado (i=", i, "): ",
      if (is.na(stype)) "<NA>" else stype
    )
    if (isTRUE(strict)) stop(msg, call. = FALSE) else warning(msg, call. = FALSE)
  }
}

#' @keywords internal
.merge_args <- function(...) {
  .arg_empty <- function(v) {
    is.null(v) ||
      length(v) == 0L ||
      (length(v) == 1L && is.list(v) && is.null(v[[1]])) ||
      (length(v) == 1L && is.atomic(v) && is.na(v))
  }
  out <- list()
  for (lst in list(...)) {
    if (is.null(lst) || !length(lst)) next
    if (is.null(names(lst)) || any(names(lst) == "")) {
      stop("Todos los args deben venir nombrados (sin nombres vacíos).", call. = FALSE)
    }
    for (nm in names(lst)) {
      val <- lst[[nm]]
      if (.arg_empty(val)) next
      out[[nm]] <- val
    }
  }
  out
}
#' @keywords internal
.keep_formals <- function(fun, args, contexto = NULL) {
  fml <- names(formals(fun))
  if ("..." %in% fml) return(args)

  sobran <- setdiff(names(args), fml)
  if (length(sobran)) {
    # El descarte deja rastro. Antes se perdia en silencio: el analista movia un
    # control, el grafico no cambiaba y no habia nada que mirar. Se ACUMULA en
    # vez de avisar aqui porque esta funcion corre una vez por slot de cada
    # lamina (ver reporte_args_descartados.R).
    ctx <- contexto %||% .reporte_args_nombre_de_funcion(
      fun,
      fallback = tryCatch(deparse(substitute(fun))[1], error = function(e) NULL)
    )
    .reporte_args_anotar_descarte(sobran, contexto = ctx)
  }

  args[names(args) %in% fml]
}

# -----------------------------------------------------------------------------
# LOG helpers (mensajes de progreso)
# -----------------------------------------------------------------------------
.fmt_vars <- function(x) {
  if (is.null(x)) return("<sin vars>")
  if (is.character(x)) {
    x <- trimws(x); x <- x[nzchar(x)]
    if (!length(x)) return("<sin vars>")
    return(paste(x, collapse = ", "))
  }
  if (is.list(x)) {
    vals <- unlist(lapply(x, .fmt_vars), use.names = FALSE)
    vals <- vals[!is.na(vals) & nzchar(trimws(vals)) & vals != "<sin vars>"]
    if (!length(vals)) return("<sin vars>")
    return(paste(vals, collapse = ", "))
  }
  "<sin vars>"
}

.fmt_grafico <- function(el_plot) {
  if (!inherits(el_plot, "ppt_element")) return("<sin elemento>")
  et <- el_plot$.element_type %||% "<NA>"
  # vars o var
  vv <- el_plot$var %||% el_plot$vars %||% NULL
  paste0(et, " | vars: ", .fmt_vars(vv))
}

.msg_diapo <- function(i, n, stype, el_plot = NULL, mensajes_progreso = FALSE) {
  # stype: section/slide_1/slide_2...
  tipo   <- stype %||% "<NA>"
  header <- sprintf("Diapositiva %03d/%03d — %s", i, n, tipo)

  if (!isTRUE(mensajes_progreso)) return(invisible(NULL))

  if (is.null(el_plot)) {
    message(header)
  } else {
    message(header, " — gráfico: ", .fmt_grafico(el_plot))
  }
  invisible(NULL)
}

# ---------------------------------------------------------------------------
# Radar helpers internos (FIX)
# - Cruce: usa keys (códigos) para filtrar y labels para mostrar (tabla/leyenda)
# - Colores de líneas: desde paleta_<list_name_del_cruce> (si existe), usando labels
# ---------------------------------------------------------------------------

.as_chr <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  trimws(x)
}

# ---- paleta auto (paleta_<listname>) desde env_diapos -----------------------
# (usa el mismo patrón que tu .paleta_auto() del exportador)
.paleta_auto_local <- function(list_name, env) {
  if (is.null(env) || !is.environment(env)) env <- parent.frame()
  ln <- as.character(list_name)[1]
  ln <- trimws(ln)
  if (is.na(ln) || !nzchar(ln)) return(NULL)

  .paleta_candidates <- function(x) {
    x <- trimws(as.character(x))
    x <- x[!is.na(x) & nzchar(x)]
    if (!length(x)) return(character(0))
    out <- x
    if (grepl("s$", x[1])) out <- c(out, sub("s$", "", x[1]))
    if (grepl("es$", x[1])) out <- c(out, sub("es$", "", x[1]))
    out <- c(out, paste0(x[1], "s"), paste0(x[1], "es"))
    out <- trimws(as.character(out))
    unique(out[!is.na(out) & nzchar(out)])
  }

  obj_candidates <- paste0("paleta_", .paleta_candidates(ln))
  hit <- obj_candidates[vapply(
    obj_candidates,
    function(obj_name) exists(obj_name, envir = env, inherits = TRUE),
    logical(1)
  )]
  if (!length(hit)) return(NULL)

  pal <- get(hit[1], envir = env, inherits = TRUE)
  if (!is.atomic(pal) || is.null(names(pal))) return(NULL)
  pal
}

# ---- list_name de una var (survey) ------------------------------------------
.list_name_of_var_local <- function(v, survey) {
  if (!is.data.frame(survey)) return(NA_character_)
  if ("list_name" %in% names(survey)) {
    idx <- !is.na(survey$name) & survey$name == v
    x <- survey$list_name[idx]
    x <- x[!is.na(x) & nzchar(x)]
    if (length(x)) return(x[1])
  }
  if ("list_norm" %in% names(survey)) {
    idx <- !is.na(survey$name) & survey$name == v
    x <- survey$list_norm[idx]
    x <- x[!is.na(x) & nzchar(x)]
    if (length(x)) return(x[1])
  }
  NA_character_
}

# ---- map del cruce: keys (para filtrar) + labels (para mostrar) -------------
.radar_cruce_map <- function(data, cruce, survey, orders_list,
                             env_paletas = parent.frame()) {

  # categorías del cruce desde instrumento
  cats <- get_categorias(
    var              = cruce,
    data             = data,
    survey           = survey,
    orders_list      = orders_list,
    opciones_excluir = NULL
  )

  estr_codes  <- .as_chr(cats$codes)
  estr_labels <- .as_chr(cats$labels)

  # fallback si no hay nada en instrumento
  if (!length(estr_codes) || !length(estr_labels)) {
    v <- sort(unique(na.omit(.as_chr(data[[cruce]]))))
    pal <- NULL
    return(list(keys = v, labels = v, palette = pal))
  }

  # valores observados en data
  v_estr <- .as_chr(data[[cruce]])
  v_estr <- v_estr[nzchar(v_estr)]

  # ¿data usa códigos o labels?
  usa_codes  <- any(v_estr %in% estr_codes)
  usa_labels <- any(v_estr %in% estr_labels)

  keys_vec <- if (usa_codes || !usa_labels) estr_codes else estr_labels
  labels_vec <- estr_labels

  # paleta por list_name del CRUCE
  ln_cruce <- .list_name_of_var_local(cruce, survey)
  pal <- .paleta_auto_local(ln_cruce, env = env_paletas)

  # si paleta existe:
  # - idealmente nombres de paleta son labels (como sueles hacer en listas)
  # - si nombres son códigos, mapear a labels
  pal_out <- NULL
  if (!is.null(pal)) {
    pal_names <- .as_chr(names(pal))

    # map code -> label (vector nombrado)
    map_code2lab <- stats::setNames(labels_vec, estr_codes)

    if (any(pal_names %in% labels_vec)) {
      # ya viene por labels
      pal_out <- pal
      # reordenar a labels_vec si se puede
      keep <- labels_vec[labels_vec %in% names(pal_out)]
      if (length(keep)) pal_out <- pal_out[keep]
    } else if (any(pal_names %in% estr_codes)) {
      # viene por códigos: renombrar a labels
      new_names <- ifelse(pal_names %in% names(map_code2lab), unname(map_code2lab[pal_names]), pal_names)
      pal_out <- pal
      names(pal_out) <- new_names
      keep <- labels_vec[labels_vec %in% names(pal_out)]
      if (length(keep)) pal_out <- pal_out[keep]
    } else {
      # nombres no calzan: se usa tal cual (fallback)
      pal_out <- pal
    }
  }

  list(keys = keys_vec, labels = labels_vec, palette = pal_out)
}

# ---- cruce labels safe (fallback) -------------------------------------------
.apply_cruce_labels_safe <- function(df, cruce_name) {
  # Reutiliza el helper ya definido en .render_numerico() si existe en scope:
  if (exists(".apply_cruce_labels", mode = "function", inherits = TRUE)) {
    inst <- NULL
    if (exists(".get_inst", mode = "function", inherits = TRUE)) inst <- .get_inst()
    out <- .apply_cruce_labels(df[[cruce_name]], inst, cruce_name)
    return(list(x = out$x, lvls = out$lvls))
  }
  x <- .as_chr(df[[cruce_name]])
  list(x = x, lvls = unique(x[nzchar(x)]))
}

# Radar SM: devuelve long (eje, grupo, valor) + attr(palette)
.radar_build_sm <- function(var, cruce = NULL, top_n = NULL,
                            sm_omit_codes  = NULL,
                            sm_omit_labels = NULL,
                            sm_omit_na     = TRUE,
                            data, survey, orders_list,
                            env_paletas = parent.frame()) {

  cats <- get_categorias(
    var              = var,
    data             = data,
    survey           = survey,
    orders_list      = orders_list,
    opciones_excluir = NULL
  )

  codes_row  <- .as_chr(cats$codes)
  labels_row <- .as_chr(cats$labels)

  # 1) Omit manual (por codes / labels)
  if (!is.null(sm_omit_codes) || !is.null(sm_omit_labels)) {

    keep <- rep(TRUE, length(codes_row))

    if (!is.null(sm_omit_codes) && length(sm_omit_codes)) {
      oc <- .as_chr(sm_omit_codes)
      keep <- keep & !(codes_row %in% oc)
    }

    if (!is.null(sm_omit_labels) && length(sm_omit_labels)) {
      ol <- .as_chr(sm_omit_labels)
      keep <- keep & !(labels_row %in% ol)
    }

    codes_row  <- codes_row[keep]
    labels_row <- labels_row[keep]
  }

  if (!length(codes_row)) return(NULL)

  # 2) Drop "Total" (RECALCULAR *después* del omit)
  op_chr <- trimws(tolower(as.character(labels_row)))
  cd_chr <- trimws(tolower(as.character(codes_row)))

  drop_total <- (op_chr == "total") | (cd_chr == "total") | is.na(op_chr) | (op_chr == "")

  if (any(drop_total)) {
    codes_row  <- codes_row[!drop_total]
    labels_row <- labels_row[!drop_total]
  }

  if (!length(codes_row)) return(NULL)

  # 3) Tipo de pregunta
  tp <- tipo_pregunta(var, survey = survey, sm_vars_force = NULL, data = data)

  # ---- series (cruce) FIX ---------------------------------------------------
  pal_series <- NULL

  if (is.null(cruce)) {
    lvls_keys   <- "Total"
    lvls_labels <- "Total"
    grupo_x     <- rep("Total", nrow(data))
  } else {

    # map cruce usando instrumento (keys vs labels) + paleta
    cm <- .radar_cruce_map(
      data        = data,
      cruce       = cruce,
      survey      = survey,
      orders_list = orders_list,
      env_paletas = env_paletas
    )

    # keys para filtrar
    lvls_keys <- cm$keys
    # labels para mostrar (leyenda/tabla)
    lvls_labels <- cm$labels
    pal_series <- cm$palette

    # si por alguna razón no hay levels válidos, fallback a Total
    lvls_keys   <- lvls_keys[nzchar(trimws(lvls_keys))]
    lvls_labels <- lvls_labels[nzchar(trimws(lvls_labels))]

    if (!length(lvls_keys) || !length(lvls_labels)) {
      lvls_keys   <- "Total"
      lvls_labels <- "Total"
      grupo_x     <- rep("Total", nrow(data))
      pal_series  <- NULL
    } else {
      # cruce en data (raw) se compara contra keys (códigos si aplica)
      grupo_x <- .as_chr(data[[cruce]])
    }
  }

  # ---- top_n ---------------------------------------------------------------
  if (!is.null(top_n) && length(codes_row) > top_n) {
    n_all <- contar_por_opcion(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = rep(TRUE, nrow(data)),
      weight_col = "peso"
    )
    ord <- order(n_all, decreasing = TRUE)
    keep <- head(ord, top_n)
    codes_row  <- codes_row[keep]
    labels_row <- labels_row[keep]
  }

  # ---- construir long -------------------------------------------------------
  out_rows <- list()

  if (identical(lvls_keys, "Total")) {

    mask_g <- rep(TRUE, nrow(data))

    n_vec <- contar_por_opcion(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = mask_g,
      weight_col = "peso"
    )

    N_g <- denominador_validos(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = mask_g,
      weight_col = "peso"
    )

    pct <- if (is.finite(N_g) && N_g > 0) as.numeric(n_vec) / N_g else rep(NA_real_, length(n_vec))

    out_rows[[1]] <- tibble::tibble(
      eje   = as.character(labels_row),
      grupo = "Total",
      valor = as.numeric(pct)
    )

    d <- dplyr::bind_rows(out_rows)
    if (!nrow(d)) return(NULL)
    d$grupo <- factor(d$grupo, levels = "Total")
    attr(d, "palette") <- pal_series
    return(d)
  }

  # loop por niveles: filtrar con KEY, mostrar LABEL
  for (j in seq_along(lvls_keys)) {

    key_j <- lvls_keys[j]
    lab_j <- lvls_labels[j]

    mask_g <- (!is.na(grupo_x) & .as_chr(grupo_x) == .as_chr(key_j))

    n_vec <- contar_por_opcion(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = mask_g,
      weight_col = "peso"
    )

    N_g <- denominador_validos(
      data       = data,
      var        = var,
      codes      = codes_row,
      tp         = tp,
      mask       = mask_g,
      weight_col = "peso"
    )

    pct <- if (is.finite(N_g) && N_g > 0) as.numeric(n_vec) / N_g else rep(NA_real_, length(n_vec))

    out_rows[[length(out_rows) + 1]] <- tibble::tibble(
      eje   = as.character(labels_row),
      grupo = as.character(lab_j),   # <- LABEL visible
      valor = as.numeric(pct)
    )
  }

  d <- dplyr::bind_rows(out_rows)
  if (!nrow(d)) return(NULL)

  d$grupo <- factor(d$grupo, levels = lvls_labels)

  # adjuntar paleta para series (por labels)
  if (!is.null(pal_series) && !is.null(names(pal_series))) {
    keep <- lvls_labels[lvls_labels %in% names(pal_series)]
    if (length(keep)) pal_series <- pal_series[keep]
  } else {
    pal_series <- NULL
  }
  attr(d, "palette") <- pal_series
  d
}

# ---------------------------------------------------------------------------
# Radar BOX (Top/Bottom box): devuelve long + attr(palette)
# ---------------------------------------------------------------------------
.radar_build_box <- function(vars, cruce = NULL, box_labels,
                             data, survey, orders_list,
                             titulo_tabla = "Top 2 Box",
                             env_paletas = parent.frame()) {

  vars <- trimws(as.character(vars)); vars <- vars[nzchar(vars)]
  if (!length(vars)) return(NULL)

  # asegurar 1 list_name para el set de respuestas (vars)
  lns <- vapply(vars, .list_name_of_var_local, character(1), survey = survey)
  lns <- unique(lns[!is.na(lns) & nzchar(lns)])
  if (length(lns) != 1L) {
    stop("radar(box): `vars` no comparten un único list_name. Encontrados: ",
         paste(lns, collapse = " | "), call. = FALSE)
  }

  cats0 <- get_categorias(
    var              = vars[1],
    data             = data,
    survey           = survey,
    orders_list      = orders_list,
    opciones_excluir = NULL
  )
  codes_all  <- .as_chr(cats0$codes)
  labels_all <- .as_chr(cats0$labels)
  if (!length(codes_all)) return(NULL)

  # map labels -> codes para box
  codes_box <- codes_all[labels_all %in% box_labels]
  if (length(codes_box) != length(box_labels)) {
    stop(
      "radar(box): no se mapearon correctamente los códigos desde `box_labels`.\n",
      "Labels pedidos: ", paste(box_labels, collapse = " | "),
      "\nLabels disponibles: ", paste(unique(labels_all), collapse = " | "),
      call. = FALSE
    )
  }

  # ---- cruce FIX + paleta por CRUCE ----------------------------------------
  pal_series <- NULL

  if (is.null(cruce)) {
    lvls_keys   <- "Total"
    lvls_labels <- "Total"
    grupo_x     <- rep("Total", nrow(data))
  } else {

    cm <- .radar_cruce_map(
      data        = data,
      cruce       = cruce,
      survey      = survey,
      orders_list = orders_list,
      env_paletas = env_paletas
    )

    lvls_keys   <- cm$keys
    lvls_labels <- cm$labels
    pal_series  <- cm$palette

    lvls_keys   <- lvls_keys[nzchar(trimws(lvls_keys))]
    lvls_labels <- lvls_labels[nzchar(trimws(lvls_labels))]

    if (!length(lvls_keys) || !length(lvls_labels)) {
      lvls_keys   <- "Total"
      lvls_labels <- "Total"
      grupo_x     <- rep("Total", nrow(data))
      pal_series  <- NULL
    } else {
      grupo_x <- .as_chr(data[[cruce]])
    }
  }

  .count_in_codes <- function(v, mask, codes_keep, weight_col = "peso") {
    w <- get_pesos(data, weight_col)
    v_codes <- .as_chr(data[[v]])
    ok <- mask & nzchar(v_codes) & (v_codes %in% codes_keep)
    sum(w[ok], na.rm = TRUE)
  }

  out_rows <- list()

  for (v in vars) {

    tpv <- tipo_pregunta(v, survey = survey, sm_vars_force = NULL, data = data)
    if (!identical(tpv, "so")) tpv <- "so"

    eje_lbl <- label_variable(
      v,
      dic_vars = dplyr::select(survey, name, label),
      labels_override = NULL,
      data = data
    )

    cats_v <- get_categorias(
      var              = v,
      data             = data,
      survey           = survey,
      orders_list      = orders_list,
      opciones_excluir = NULL
    )
    codes_v  <- .as_chr(cats_v$codes)
    labels_v <- .as_chr(cats_v$labels)

    # map box por variable (por si el set cambia)
    codes_box_v <- codes_v[labels_v %in% box_labels]
    if (length(codes_box_v) != length(box_labels)) codes_box_v <- codes_box

    if (identical(lvls_keys, "Total")) {

      mask_g <- rep(TRUE, nrow(data))

      N_g <- denominador_validos(
        data       = data,
        var        = v,
        codes      = codes_v,
        tp         = tpv,
        mask       = mask_g,
        weight_col = "peso"
      )

      n_box <- .count_in_codes(v, mask_g, codes_box_v, weight_col = "peso")
      pct <- if (is.finite(N_g) && N_g > 0) as.numeric(n_box) / N_g else NA_real_

      out_rows[[length(out_rows) + 1]] <- tibble::tibble(
        eje   = as.character(eje_lbl),
        grupo = "Total",
        valor = as.numeric(pct)
      )

      next
    }

    # loop por niveles: filtrar con KEY, mostrar LABEL
    for (j in seq_along(lvls_keys)) {

      key_j <- lvls_keys[j]
      lab_j <- lvls_labels[j]

      mask_g <- (!is.na(grupo_x) & .as_chr(grupo_x) == .as_chr(key_j))

      N_g <- denominador_validos(
        data       = data,
        var        = v,
        codes      = codes_v,
        tp         = tpv,
        mask       = mask_g,
        weight_col = "peso"
      )

      n_box <- .count_in_codes(v, mask_g, codes_box_v, weight_col = "peso")
      pct <- if (is.finite(N_g) && N_g > 0) as.numeric(n_box) / N_g else NA_real_

      out_rows[[length(out_rows) + 1]] <- tibble::tibble(
        eje   = as.character(eje_lbl),
        grupo = as.character(lab_j),   # <- LABEL visible
        valor = as.numeric(pct)
      )
    }
  }

  d <- dplyr::bind_rows(out_rows)
  if (!nrow(d)) return(NULL)

  d$grupo <- factor(d$grupo, levels = lvls_labels)

  # adjuntar paleta para series (por labels)
  if (!is.null(pal_series) && !is.null(names(pal_series))) {
    keep <- lvls_labels[lvls_labels %in% names(pal_series)]
    if (length(keep)) pal_series <- pal_series[keep]
  } else {
    pal_series <- NULL
  }
  attr(d, "palette") <- pal_series
  d
}

# =============================================================================
# PLAN acumulativo por chunks: diapo() / .ppt_plan_env
# =============================================================================

.ppt_plan_name <- ".ppt_plan_accum"

#' @keywords internal
.ppt_plan_env <- function(env = parent.frame()) {
  if (!is.environment(env)) stop("`.ppt_plan_env()`: `env` debe ser environment.", call. = FALSE)

  if (!exists(.ppt_plan_name, envir = env, inherits = FALSE)) {
    init <- structure(list(), class = c("ppt_plan", "list"))
    assign(.ppt_plan_name, init, envir = env)
  }

  get(.ppt_plan_name, envir = env, inherits = FALSE)
}

#' @keywords internal
.ppt_plan_set <- function(plan, env = parent.frame()) {
  if (!is.environment(env)) stop("`.ppt_plan_set()`: `env` debe ser environment.", call. = FALSE)
  if (!is.list(plan)) stop("`.ppt_plan_set()`: `plan` debe ser lista.", call. = FALSE)
  class(plan) <- unique(c("ppt_plan","list", class(plan)))
  assign(.ppt_plan_name, plan, envir = env)
  invisible(plan)
}

#' @keywords internal
.ppt_plan_push <- function(slide, env = parent.frame()) {
  if (is.null(slide) || !inherits(slide, "ppt_slide")) {
    stop("`.ppt_plan_push()`: `slide` debe ser `ppt_slide`.", call. = FALSE)
  }
  plan <- .ppt_plan_env(env)
  plan[[length(plan) + 1L]] <- slide
  .ppt_plan_set(plan, env)
}

#' @keywords internal
.ppt_plan_clear <- function(env = parent.frame()) {
  .ppt_plan_set(structure(list(), class = c("ppt_plan","list")), env)
}

#' Agregar una diapositiva al plan acumulado
#'
#' Inserta un objeto `ppt_slide` al final del plan acumulado en el entorno
#' indicado. Esta función se usa como acumulador durante la construcción
#' declarativa de reportes basados en plan.
#'
#' @param slide Objeto de clase `ppt_slide` que se agregará al plan.
#' @param env Entorno donde se guardará el acumulador del plan (por defecto,
#'   el entorno del llamador).
#' @return El mismo objeto `slide` recibido.
#' @family reporte
#' @export
diapo <- function(slide, env = parent.frame()) {
  .ppt_plan_push(slide, env = env)
  slide
}

#' Obtener el plan acumulado sin limpiarlo
#'
#' Devuelve el plan de diapositivas acumulado por `diapo()` en el entorno
#' indicado. A diferencia de `reporte_ppt_plan()`, no borra el acumulador.
#' Útil para capturar el plan y pasarlo luego a `reporte_word_plan()`
#' sin necesidad de guardar el objeto pesado devuelto por `reporte_ppt_plan()`.
#'
#' @param env Entorno donde se buscará el acumulador (por defecto el entorno
#'   del llamador, igual que `diapo()`).
#' @return Objeto `ppt_plan` (lista de `ppt_slide`).
#' @family reporte
#' @export
p_get_plan <- function(env = parent.frame()) {
  .ppt_plan_env(env)
}


# =============================================================================
# RESET PPT — limpiar acumulados de diapo() + objetos diapo_###
# - Se una al INICIO del script / qmd antes de definir diapo_### otra vez.
# =============================================================================
#' @family reporte
#' @export
p_reset <- function(
    env = parent.frame(),
    drop_diapos = TRUE,     # borra diapo_### del env
    drop_plan   = TRUE,     # borra plan acumulado si existe
    drop_misc   = TRUE,     # borra caches comunes (rendered/logs) si existen
    verbose     = TRUE
) {

  # helper
  .rm_if_exists <- function(nm, envir) {
    if (exists(nm, envir = envir, inherits = FALSE)) {
      rm(list = nm, envir = envir)
      TRUE
    } else FALSE
  }

  removed <- character(0)

  # 1) Borrar diapo_###
  if (isTRUE(drop_diapos)) {
    nms <- ls(envir = env, all.names = TRUE)
    di <- nms[grepl("^diapo_\\d{3}$", nms)]
    if (length(di)) {
      rm(list = di, envir = env)
      removed <- c(removed, di)
    }
  }

  # 2) Borrar plan acumulado (múltiples estrategias)
  if (isTRUE(drop_plan)) {

    # a) si existe una función oficial para limpiar, úsala
    if (exists(".ppt_plan_clear", mode = "function", inherits = TRUE)) {
      try(.ppt_plan_clear(env), silent = TRUE)
      removed <- c(removed, "<.ppt_plan_clear()>")
    }

    # b) posibles nombres típicos de plan acumulado en el env
    candidates <- c(
      ".ppt_plan", "ppt_plan", "plan_ppt",
      ".plan", "plan", ".ppt_plan_accum",
      ".ppt_plan_obj", ".ppt_plan_cache"
    )
    for (nm in candidates) {
      if (.rm_if_exists(nm, env)) removed <- c(removed, nm)
    }

    # c) si tienes un “nombre del plan” guardado en .ppt_plan_name
    if (exists(".ppt_plan_name", envir = env, inherits = TRUE)) {
      nm_plan <- try(get(".ppt_plan_name", envir = env, inherits = TRUE), silent = TRUE)
      if (is.character(nm_plan) && length(nm_plan) == 1L && nzchar(nm_plan)) {
        if (.rm_if_exists(nm_plan, env)) removed <- c(removed, nm_plan)
      }
    }
  }

  # 3) Borrar caches comunes (por si guardaste cosas auxiliares)
  if (isTRUE(drop_misc)) {
    misc <- c("rendered", "ppt_rendered", ".ppt_rendered", "ppt_log", ".ppt_log")
    for (nm in misc) {
      if (.rm_if_exists(nm, env)) removed <- c(removed, nm)
    }
  }

  if (isTRUE(verbose)) {
    if (!length(removed)) message("✅ ppt_reset(): nada que limpiar (todo ya estaba limpio).")
    else message("🧹 ppt_reset(): limpiado -> ", paste(unique(removed), collapse = ", "))
  }

  invisible(unique(removed))
}



.format_group_base_caption <- function(labels, totals) {
  labels <- trimws(as.character(labels %||% character(0)))
  totals <- suppressWarnings(as.numeric(totals %||% numeric(0)))
  n <- min(length(labels), length(totals))
  if (!n) return(NULL)
  labels <- labels[seq_len(n)]
  totals <- totals[seq_len(n)]
  keep <- !is.na(labels) & nzchar(labels) & is.finite(totals) & totals >= 0
  labels <- labels[keep]
  totals <- totals[keep]
  if (!length(labels)) return(NULL)
  parts <- paste0(
    labels,
    " (",
    format(round(totals), big.mark = ",", scientific = FALSE, trim = TRUE),
    ")"
  )
  joined <- if (length(parts) == 1L) {
    parts
  } else if (length(parts) == 2L) {
    paste(parts, collapse = " y ")
  } else {
    paste0(paste(parts[-length(parts)], collapse = ", "), " y ", parts[[length(parts)]])
  }
  paste0("Base: ", joined)
}

.format_actor_base_caption <- function(sources, totals) {
  sources <- trimws(as.character(sources %||% character(0)))
  totals <- suppressWarnings(as.numeric(totals %||% numeric(0)))
  n <- min(length(sources), length(totals))
  if (!n) return(NULL)

  sources <- sources[seq_len(n)]
  totals <- totals[seq_len(n)]
  keep <- !is.na(sources) & nzchar(sources) & is.finite(totals) & totals > 0
  sources <- sources[keep]
  totals <- round(totals[keep])
  if (!length(sources)) return(NULL)

  actor_order <- unique(sources)
  parts <- vapply(actor_order, function(source) {
    actor <- gsub("_+", " ", source)
    actor <- tools::toTitleCase(actor)
    actor_totals <- sort(unique(totals[sources == source]))
    total_text <- if (length(actor_totals) == 1L) {
      format(actor_totals[[1L]], big.mark = ",", scientific = FALSE, trim = TRUE)
    } else {
      paste0(
        format(min(actor_totals), big.mark = ",", scientific = FALSE, trim = TRUE),
        "-",
        format(max(actor_totals), big.mark = ",", scientific = FALSE, trim = TRUE),
        " según variable"
      )
    }
    paste0(actor, " (", total_text, ")")
  }, character(1))

  joined <- if (length(parts) == 1L) {
    parts
  } else if (length(parts) == 2L) {
    paste(parts, collapse = " y ")
  } else {
    paste0(paste(parts[-length(parts)], collapse = ", "), " y ", parts[[length(parts)]])
  }
  paste0("Base: ", joined)
}

.format_actor_base_caption_from_refs <- function(refs, totals) {
  refs <- trimws(as.character(refs %||% character(0)))
  qualified <- grepl("$", refs, fixed = TRUE)
  if (!any(qualified)) return(NULL)
  .format_actor_base_caption(sub("\\$.*$", "", refs[qualified]), totals[qualified])
}

.with_actor_base_caption <- function(plot, caption) {
  if (!is.null(caption)) attr(plot, "pulso_actor_base_caption") <- caption
  plot
}

# -----------------------------------------------------------------------------
# Adaptación del elemento al slot de gráfico del layout.
# Extraída VERBATIM del closure `.element_adapt_to_plot_slot` dentro de
# `reporte_ppt_plan()` (reporte_plan_ppt.R, congelado a crecimiento): es una
# función pura sobre (el, spec), no captura estado del motor. El motor la llama
# vía un delegado de una línea.
# -----------------------------------------------------------------------------

#' @noRd
.reporte_plan_element_adapt_to_plot_slot <- function(el, spec) {
  if (!inherits(el, "ppt_element") || is.null(spec) || is.null(spec$loc)) return(el)
  loc <- spec$loc
  if (is.numeric(loc) && length(loc) >= 4L) {
    loc <- list(left = loc[[1]], top = loc[[2]], width = loc[[3]], height = loc[[4]])
  }
  if (!is.list(loc) || !all(c("width", "height") %in% names(loc))) return(el)
  width <- suppressWarnings(as.numeric(loc$width)[1])
  height <- suppressWarnings(as.numeric(loc$height)[1])
  if (!is.finite(width) || !is.finite(height) || width <= 0 || height <= 0) return(el)

  el$overrides <- el$overrides %||% list()
  if (is.null(el$overrides$ancho)) el$overrides$ancho <- width
  if (is.null(el$overrides$alto)) el$overrides$alto <- height

  # The editorial preset is calibrated for a full-width plot. Two-chart
  # layouts have roughly half that width, so the same 16 pt axes/legend
  # produce collisions even though the underlying plot is valid. Adapt only
  # implicit styling; an explicit user override remains authoritative.
  etype <- el$.element_type %||% ""
  if (identical(etype, "barras_apiladas")) {
    split_ref <- el$cruce %||% el$grupo %||%
      el$overrides$cruce %||% el$overrides$grupo %||% NULL
    has_split <- !is.null(split_ref) && length(split_ref) > 0L &&
      any(nzchar(trimws(as.character(split_ref))))
    if (!has_split) {
      # A simple one-question chart already names the question in its title;
      # repeating it as a y-axis row wastes the first column and compresses
      # the bar, especially in a two-chart composition.
      if (is.null(el$overrides$canvas_w_etiquetas)) el$overrides$canvas_w_etiquetas <- 0
      if (is.null(el$overrides$canvas_w_buf_etq_bars)) el$overrides$canvas_w_buf_etq_bars <- 0
    }
  }
  if (identical(etype, "barras_multiapiladas") &&
      identical(el$modo %||% "", "var") && length(el$vars %||% character(0)) >= 3L) {
    # Automatic ordinal batteries need denser editorial typography than a
    # shared actor comparison. Their long row labels otherwise collide with
    # the title/legend even on a full-width slide.
    if (is.null(el$overrides$size_leyenda)) el$overrides$size_leyenda <- 11
    if (is.null(el$overrides$size_ejes)) el$overrides$size_ejes <- 11
    if (is.null(el$overrides$size_barra_extra)) el$overrides$size_barra_extra <- 11
    if (is.null(el$overrides$size_titulo_extra)) el$overrides$size_titulo_extra <- 11
    if (is.null(el$overrides$size_nota_pie)) el$overrides$size_nota_pie <- 10
    if (is.null(el$overrides$canvas_h_legend_in)) el$overrides$canvas_h_legend_in <- 0.55
    if (is.null(el$overrides$canvas_h_caption_in)) el$overrides$canvas_h_caption_in <- 0.34
    if (is.null(el$overrides$umbral_ocultar_etiqueta)) el$overrides$umbral_ocultar_etiqueta <- 0.15
    if (is.null(el$overrides$etiquetas_arriba_si_no_caben)) {
      el$overrides$etiquetas_arriba_si_no_caben <- FALSE
    }
  }
  if (width < 7.25 && etype %in% c("barras_apiladas", "barras_multiapiladas")) {
    if (is.null(el$overrides$size_leyenda)) el$overrides$size_leyenda <- 10
    if (is.null(el$overrides$size_ejes)) el$overrides$size_ejes <- 11
    if (is.null(el$overrides$size_barra_extra)) el$overrides$size_barra_extra <- 11
    if (is.null(el$overrides$size_titulo_extra)) el$overrides$size_titulo_extra <- 11
    if (is.null(el$overrides$canvas_h_legend_in)) el$overrides$canvas_h_legend_in <- 0.68
    if (is.null(el$overrides$umbral_ocultar_etiqueta)) el$overrides$umbral_ocultar_etiqueta <- 0.15
  }
  el
}

# "Mostrar referencia" de la UI de media_rango promete linea/etiqueta del
# promedio global, que solo existe en modo score_ref: encenderlo sin declarar
# modo activa ese modo (si no, el switch es inerte con el default "score").
# Indexado exacto obligatorio: args$modo hace partial-match con modo_semaforo.
.media_rango_activar_score_ref <- function(args) {
  if (isTRUE(args[["mostrar_ref_label"]]) && is.null(args[["modo"]])) {
    args[["modo"]] <- "score_ref"
    args[["mostrar_ref_line"]] <- args[["mostrar_ref_line"]] %||% TRUE
  }
  args
}

# Lienzo fisico de la imagen Word (pulgadas). El sello viaja en
# presets$base$args$word_image (lo estampa .apply_word_chart_presets desde
# w_presets()$image); si falta, caen los defaults de w_presets().
.word_canvas_image_in <- function(word_image = NULL) {
  word_image <- if (is.list(word_image)) word_image else list()
  w <- suppressWarnings(as.numeric(word_image$width_in)[1])
  h <- suppressWarnings(as.numeric(word_image$height_in)[1])
  if (!is.finite(w) || is.na(w) || w <= 0) w <- 6.1
  if (!is.finite(h) || is.na(h) || h <= 0) h <- 2.95
  list(width_in = w, height_in = h)
}

# W-1/W-3 (B52): el slot adapter del PPT inyecta overrides$ancho/alto con la
# geometria del SLIDE (~12.2x5.9in), pero el docx inserta la imagen al tamano
# de w_presets()$image (6.1x2.95in por defecto). Con el ancho fantasma, la
# leyenda estimaba sus filas contra 12in (items solapados al render real) y
# el estiramiento B46 inflaba el alto de una barra sola hasta ~6in de vacio.
# En el camino Word, el canvas se calibra SIEMPRE al lienzo del docx; el
# control explicito del usuario para Word es w_presets(image=...).
.word_calibrar_canvas_overrides <- function(ov, word_image = NULL) {
  dims <- .word_canvas_image_in(word_image)
  ov$ancho <- dims$width_in
  ov$alto <- dims$height_in
  ov
}

# W-5 (B54): el default Word apaga la columna extra (mostrar_barra_extra
# FALSE + canvas_w_extra 0) porque la marca N implicita del preset editorial
# PPT (mostrar_barra_extra=TRUE de fabrica con barra_extra_preset="ninguno")
# no aporta en el lienzo de 6.1in. Pero un pedido DELIBERADO en los overrides
# de la lamina — barra_extra_preset ("top2box", "totales", ...),
# titulo_barra_extra o mostrar_barra_extra=TRUE — tiene que sobrevivir: Word
# solo re-escala la geometria (las fracciones canvas_w_* se normalizan por su
# suma contra el lienzo fisico del docx, ver w_sum en el graficador). Un
# mostrar_barra_extra=FALSE explicito en la lamina sigue mandando.
.word_barra_extra_pedida <- function(ov) {
  `%||%` <- .rp_null_default
  if (!is.list(ov)) ov <- list()
  preset_extra <- trimws(as.character(ov$barra_extra_preset %||% "")[1])
  titulo_extra <- trimws(as.character(ov$titulo_barra_extra %||% "")[1])
  if (is.na(preset_extra)) preset_extra <- ""
  if (is.na(titulo_extra)) titulo_extra <- ""
  isTRUE(ov$mostrar_barra_extra) ||
    (nzchar(preset_extra) && !identical(preset_extra, "ninguno")) ||
    nzchar(titulo_extra)
}

.word_conservar_barra_extra_pedida <- function(ov, w_extra = 0.16, w_bars = 0.64,
                                               w_buf = 0.02) {
  if (!is.list(ov)) ov <- list()
  if (isFALSE(ov$mostrar_barra_extra)) return(ov)
  if (!.word_barra_extra_pedida(ov)) return(ov)
  ov$mostrar_barra_extra <- TRUE
  # Geometria Word solo donde la lamina no la fijo: la columna extra recibe
  # una fraccion legible del lienzo (0.16 de 6.1in ~ 1in) y las barras ceden
  # el ancho equivalente. Las fracciones son relativas (se re-normalizan).
  if (is.null(ov$canvas_w_extra)) ov$canvas_w_extra <- w_extra
  if (is.null(ov$canvas_w_buf_bars_extra)) ov$canvas_w_buf_bars_extra <- w_buf
  if (is.null(ov$canvas_w_bars)) ov$canvas_w_bars <- w_bars
  ov
}

# W-5 (B54), capa de PRESET: el default PPT de fabrica tambien trae
# mostrar_barra_extra=TRUE (columna N implicita), asi que el unico pedido
# inequivoco en esta capa es un barra_extra_preset explicito del usuario
# ("totales"/"top2box"/...). Con el, el patch default Word no puede apagar la
# columna ni pisar la particion de anchos que el preset del usuario declara.
.word_patch_conservar_barra_extra <- function(patch, ppt_args) {
  `%||%` <- .rp_null_default
  if (!is.list(patch)) return(patch)
  if (!is.list(ppt_args)) ppt_args <- list()
  preset_extra <- trimws(as.character(ppt_args$barra_extra_preset %||% "")[1])
  if (is.na(preset_extra) || !nzchar(preset_extra) ||
      identical(preset_extra, "ninguno")) {
    return(patch)
  }
  drop_keys <- c(
    "mostrar_barra_extra", "barra_extra_preset", "prefijo_barra_extra",
    "titulo_barra_extra", "canvas_w_etiquetas", "canvas_w_buf_etq_bars",
    "canvas_w_bars", "canvas_w_buf_bars_extra", "canvas_w_extra"
  )
  patch[setdiff(names(patch), drop_keys)]
}

# W-6 (B54): en Word el alto de la imagen ES alto_word_sugerido, asi que el
# piso B46 del graficador (panel de 2.8in para <=2 filas, pensado para llenar
# el slot fisico del SLIDE) hacia que un bloque de 2 actores saliera con
# barras ~2.5x mas gruesas que su vecino de 4 en la misma pagina. Fijar
# canvas_h_panel_in proporcional a los actores esquiva ese piso: 0.55in por
# fila (espejo de alto_por_categoria del preset Word) con piso 1.1in
# (canvas_h_panel_in_min del preset Word).
.word_escalar_panel_multi <- function(block_clean) {
  `%||%` <- .rp_null_default
  ov <- block_clean$overrides %||% list()
  if (!is.null(ov$canvas_h_panel_in)) return(block_clean)
  # Con `cruce` las filas dependen de los niveles observados en la data; se
  # respeta el calculo intrinseco del graficador.
  if (!is.null(block_clean$cruce)) return(block_clean)
  refs <- unlist(block_clean$vars %||% list(), use.names = FALSE)
  refs <- trimws(as.character(refs))
  n_act <- sum(!is.na(refs) & nzchar(refs))
  if (n_act < 1L) return(block_clean)
  alto_cat <- suppressWarnings(as.numeric(ov$alto_por_categoria %||% 0.55)[1])
  if (!is.finite(alto_cat) || alto_cat <= 0) alto_cat <- 0.55
  ov$canvas_h_panel_in <- max(1.1, alto_cat * n_act)
  block_clean$overrides <- ov
  block_clean
}

# W-7 (B54): el titulo de la lamina (payload$titulo -> el$title_slide) se
# integra al titulo Word de cada bloque del split multiapiladas. Sin el, dos
# grupos con el mismo titulos_grupo salian con titulos identicos («Grafico
# N 3. Servicio de salud» / «N 4. Servicio de salud») y el texto que el
# usuario escribio en su lamina no viajaba al docx.
.word_titulo_bloque_multi <- function(titulo_lamina, titulo_grupo) {
  `%||%` <- .rp_null_default
  lam <- trimws(as.character(titulo_lamina %||% "")[1])
  grp <- trimws(as.character(titulo_grupo %||% "")[1])
  if (is.na(lam)) lam <- ""
  if (is.na(grp)) grp <- ""
  if (!nzchar(lam)) return(grp)
  if (!nzchar(grp)) return(lam)
  if (identical(tolower(lam), tolower(grp))) return(grp)
  paste0(lam, " \u2014 ", grp)
}

# Limpieza + geometria Word de un bloque multiapiladas (extraida del closure
# `.push_multi_block` de reporte_ppt_plan(), congelado a crecimiento).
.word_preparar_block_multi <- function(block_data, word_image = NULL) {
  `%||%` <- .rp_null_default
  block_clean <- block_data
  block_clean$overrides <- block_clean$overrides %||% list()
  block_clean$overrides$titulo    <- NULL
  block_clean$overrides$subtitulo <- NULL
  # Flag para renderizado Word: omite columna de grupo en var_cruce
  block_clean$.word_sin_grupo <- TRUE
  block_clean$.word_render <- TRUE
  # Compensar que sin columna de grupo las barras se perciben algo mas delgadas
  if (is.null(block_clean$overrides$grosor_barras_mult))
    block_clean$overrides$grosor_barras_mult <- 2.30
  # W-5 (B54): un pedido explicito de columna extra en la lamina sobrevive al
  # default Word; particion multiactor (0.30 etiquetas + 0.54 barras + 0.14).
  block_clean$overrides <- .word_conservar_barra_extra_pedida(
    block_clean$overrides, w_extra = 0.14, w_bars = 0.54
  )
  # W-6 (B54): panel proporcional al numero de actores del bloque.
  block_clean <- .word_escalar_panel_multi(block_clean)
  block_clean$overrides <- .word_calibrar_canvas_overrides(
    block_clean$overrides, word_image
  )
  block_clean
}

# Ajustes por tipo para la variante Word de un elemento (device mas angosto
# que el PPT: 6.0-6.6in vs 12.5). Absorbe el bloque ad-hoc de media_rango y
# suma el del FODA (B-H29: las tarjetas truncaban label y chip en Word).
.word_ajustar_el <- function(el_for_word, etype, word_image = NULL) {
  `%||%` <- .rp_null_default
  ov <- el_for_word$overrides %||% list()
  if (etype %in% c("barras_apiladas", "barras_multiapiladas", "barras_agrupadas")) {
    ov <- .word_calibrar_canvas_overrides(ov, word_image)
  }
  if (etype %in% c("barras_apiladas", "barras_multiapiladas")) {
    # W-5 (B54): el pedido de columna extra de la lamina sobrevive al default
    # Word que la apaga (el default solo rige cuando nadie la pidio).
    ov <- .word_conservar_barra_extra_pedida(ov)
  }
  if (identical(etype, "media_rango")) {
    size_ejes_orig <- ov$size_ejes %||% 9
    ov$size_ejes <- min(size_ejes_orig, 8)
    modo_word <- ov$modo %||% NULL
    if (identical(modo_word, "score_ref") && is.null(ov$size_delta)) {
      size_media_word <- suppressWarnings(as.numeric(ov$size_media)[1])
      if (!is.finite(size_media_word) || is.na(size_media_word) || size_media_word <= 0) {
        size_media_word <- 3
      }
      ov$size_delta <- max(2.4, size_media_word * 0.72)
    }
    if (identical(modo_word, "score_ref") && is.null(ov$delta_umbral_cerca_ref)) {
      ov$delta_umbral_cerca_ref <- 5
    }
    if (identical(modo_word, "score_ref") && is.null(ov$delta_rel_cerca_ref)) {
      ov$delta_rel_cerca_ref <- 0.34
    }
  } else if (identical(etype, "dim_foda")) {
    if (is.null(ov$tamano_texto_tarjeta)) ov$tamano_texto_tarjeta <- 7
    if (is.null(ov$tamano_texto_chip)) ov$tamano_texto_chip <- 7.5
    if (is.null(ov$ancho_tarjeta_base_rel)) ov$ancho_tarjeta_base_rel <- 0.88
  }
  el_for_word$overrides <- ov
  el_for_word
}

# B41: cuando el caption del grafico esta apagado (doctrina B36/G-17: la
# Base vive en la esquina inferior izquierda del SLIDE), el panel del canvas
# no puede llegar hasta el borde inferior — la franja del pie queda para el
# texto de Base del slide. Sin esta reserva, la leyenda del grafico y la
# Base se solapaban (visto en el export real de Conta, lamina de docentes
# con canvas_h_caption_in = 0).
#
# W-8 (B55): la reserva es doctrina de SLIDE. En Word la Base es un parrafo
# del documento (reporte_word_plan la agrega debajo de la imagen), asi que
# la banda solo abria 0.34-0.85in de aire muerto dentro del PNG entre el
# grafico y su Base. Con word_render = TRUE la reserva no se impone; una
# nota_pie o una reserva explicita del analista siguen mandando.
.reservar_pie_para_base_slide <- function(args, min_in = 0.34, word_render = FALSE) {
  if (!is.list(args)) return(args)
  if (isTRUE(word_render)) return(args)
  np <- args$nota_pie %||% NULL
  tiene_caption <- !is.null(np) && any(nzchar(trimws(as.character(np))))
  if (tiene_caption) return(args)
  cap <- suppressWarnings(as.numeric(args$canvas_h_caption_in %||% NA_real_)[1])
  # 0.24 quedaba justo: el texto de Base (size 14) rozaba la leyenda en los
  # exports reales de Conta. 0.34 cubre una linea; las multiapiladas
  # multibase pasan 0.5 porque su Base prorrateada ("Base: 47 docentes,
  # 128 estudiantes, ...") envuelve a DOS lineas en el placeholder del
  # template.
  min_in <- suppressWarnings(as.numeric(min_in)[1])
  if (!is.finite(min_in) || min_in <= 0) min_in <- 0.34
  # La banda va en canvas_h_reserva_pie_in: la fila caption desaparece
  # cuando no hay nota_pie, asi que reservar via canvas_h_caption_in era
  # un no-op (B44).
  reserva <- suppressWarnings(as.numeric(args$canvas_h_reserva_pie_in %||% NA_real_)[1])
  if (!is.finite(reserva) || reserva < min_in) args$canvas_h_reserva_pie_in <- min_in
  args
}
