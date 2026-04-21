# =============================================================================
# PRESETS WORD
# =============================================================================

#' @title Definir presets para Word (imagen + estilos de párrafo)
#' @family reporte
#' @export
w_presets <- function(
    image = list(width_in = 6.1, height_in = 2.95, dpi = 300, bg = "white"),
    title_style  = list(font = "Arial", size = 12, bold = TRUE,  italic = FALSE, color = "#39588B"),
    base_style   = list(font = "Arial", size = 9,  bold = FALSE, italic = TRUE,  color = "#39588B",
                        formato = "Base: %s", sufijo_auto = NULL),
    intro_style  = list(font = "Arial", size = 10, bold = FALSE, italic = FALSE, color = "#3F556E"),
    subsection_style = list(font = "Arial", size = 12, bold = TRUE, italic = FALSE, color = "#39588B"),
    section_style = list(font = "Arial", size = 14, bold = TRUE, italic = FALSE, color = "#39588B"),
    figure_numbering     = list(enabled = TRUE, prefix = "Gr\u00e1fico", sep = ". "),
    pagebreak_between    = FALSE,
    pagebreak_after_title = TRUE,
    toc                  = list(enabled = FALSE, title = NULL)
) {
  image$width_in  <- as.numeric(image$width_in  %||% 6.6)
  image$height_in <- as.numeric(image$height_in %||% 3.9)
  image$dpi       <- as.integer(image$dpi       %||% 300L)
  image$bg        <- as.character(image$bg       %||% "white")[1]
  base_style$formato <- as.character(base_style$formato %||% "Base: %s")[1]

  out <- list(
    image                 = image,
    title_style           = title_style,
    base_style            = base_style,
    intro_style           = intro_style,
    subsection_style      = subsection_style,
    section_style         = section_style,
    figure_numbering      = figure_numbering,
    pagebreak_between     = isTRUE(pagebreak_between),
    pagebreak_after_title = isTRUE(pagebreak_after_title),
    toc                   = toc
  )
  class(out) <- c("word_presets", "list")
  out
}

# =============================================================================
# PLAN WORD — genera Word desde el mismo plan declarativo que plan_ppt
# =============================================================================

#' @title Generar Word desde el plan declarativo PPT
#'
#' @description
#' Usa el mismo plan de diapositivas (\code{diapo_###} / \code{p_slide_*}) que
#' \code{reporte_ppt_plan()} y genera un Word (.docx) donde cada gráfico ocupa
#' un bloque independiente con título numerado fuera del gráfico.
#'
#' @param data \code{data.frame}/\code{tibble} o lista nombrada de bases.
#' @param instrumento Instrumento con al menos \code{$survey}, o lista nombrada.
#' @param path_docx Ruta del \code{.docx} de salida.
#' @param presets_ppt Presets PPT para renderizar los gráficos (\code{p_presets()}).
#' @param presets_word Presets Word (\code{w_presets()}). \code{NULL} usa defaults.
#' @param fuente Texto de fuente concatenado tras la base de cada gráfico.
#' @param plan Lista de slides ya construida, o \code{NULL} para recolectar
#'   objetos \code{diapo_###} desde \code{env_diapos}.
#' @param env_diapos Entorno donde buscar objetos \code{diapo_###}.
#' @param strict_diapos Si \code{TRUE}, error en saltos de numeración.
#' @param mensajes_progreso Si \code{TRUE}, imprime mensajes de avance.
#' @param solo_lista Si \code{TRUE}, no escribe el archivo; solo devuelve la lista.
#'
#' @return Invisiblemente una lista con \code{doc}, \code{plan}, \code{log}.
#' @family reporte
#' @export
reporte_word_plan <- function(
    data,
    instrumento        = NULL,
    path_docx          = "reporte.docx",
    presets_ppt        = NULL,
    presets_word       = NULL,
    fuente             = NULL,
    plan               = NULL,
    env_diapos         = parent.frame(),
    strict_diapos      = FALSE,
    mensajes_progreso  = TRUE,
    solo_lista         = FALSE
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y

  if (!requireNamespace("officer", quietly = TRUE)) stop("Se requiere 'officer'.", call. = FALSE)
  if (!requireNamespace("ggplot2", quietly = TRUE)) stop("Se requiere 'ggplot2'.", call. = FALSE)

  has_tibble <- requireNamespace("tibble", quietly = TRUE)
  has_dplyr  <- requireNamespace("dplyr",  quietly = TRUE)

  # -------------------------------------------------------------------------
  # 1) render_meta via reporte_ppt_plan (solo_lista + build_render_meta)
  # -------------------------------------------------------------------------
  if (isTRUE(mensajes_progreso)) message("Preparando render_meta desde plan PPT...")

  ppt_result <- reporte_ppt_plan(
    data               = data,
    instrumento        = instrumento,
    presets            = presets_ppt,
    plan               = plan,
    env_diapos         = env_diapos,
    strict_diapos      = strict_diapos,
    solo_lista         = TRUE,
    build_render_meta  = TRUE,
    mensajes_progreso  = mensajes_progreso
  )

  render_meta <- ppt_result$render_meta %||% list()
  if (!length(render_meta)) stop("El plan no produjo ningún elemento para Word.", call. = FALSE)

  # -------------------------------------------------------------------------
  # 2) Presets Word
  # -------------------------------------------------------------------------
  presets_word <- presets_word %||% w_presets()
  if (!inherits(presets_word, "word_presets"))
    stop("`presets_word` debe venir de `w_presets()`.", call. = FALSE)

  img_w   <- presets_word$image$width_in
  img_h   <- presets_word$image$height_in
  img_dpi <- presets_word$image$dpi

  # -------------------------------------------------------------------------
  # 3) Helpers de formato
  # -------------------------------------------------------------------------
  .fp_w <- function(st) {
    officer::fp_text(
      font.size   = st$size   %||% 11,
      font.family = st$font   %||% "Arial",
      bold        = isTRUE(st$bold   %||% FALSE),
      italic      = isTRUE(st$italic %||% FALSE),
      color       = st$color  %||% "#000000"
    )
  }

  # Párrafo con fpar — sin style forzado para que fp_p tenga pleno efecto
  .add_par_w <- function(doc, text, st, align = "left", style = NULL) {
    if (is.null(text) || !nzchar(trimws(as.character(text)[1]))) return(doc)
    text <- trimws(as.character(text)[1])
    fpar <- officer::fpar(
      officer::ftext(text, prop = .fp_w(st)),
      fp_p = officer::fp_par(text.align = align)
    )
    officer::body_add_fpar(doc, value = fpar, style = style)
  }

  .strip_heading_number <- function(text) {
    txt <- trimws(as.character(text %||% "")[1])
    if (!nzchar(txt)) return(txt)
    sub("^\\s*\\d+(?:\\.\\d+)*\\.?\\s+", "", txt, perl = TRUE)
  }

  .add_toc_w <- function(doc, presets_word) {
    toc_cfg <- presets_word$toc %||% list()
    if (!isTRUE(toc_cfg$enabled)) return(doc)
    toc_title <- as.character(toc_cfg$title %||% "")[1]
    if (nzchar(trimws(toc_title))) {
      doc <- .add_par_w(
        doc,
        toc_title,
        presets_word$section_style,
        align = "left",
        style = "Normal"
      )
    }
    officer::body_add_toc(doc, level = 2)
  }

  # -------------------------------------------------------------------------
  # 4) Helpers de contenido
  # -------------------------------------------------------------------------
  .make_title_txt <- function(title, g_i) {
    fn   <- presets_word$figure_numbering %||% list()
    pref <- fn$prefix %||% "Gr\u00e1fico"
    sep  <- fn$sep    %||% ". "
    head <- paste0(pref, " N\u00ba ", g_i, sep)
    t <- trimws(as.character(title %||% "")[1])
    if (nzchar(t)) paste0(head, t) else head
  }

  .make_pie_txt <- function(base_txt, base_multi_source = FALSE) {
    parts <- c(
      if (!is.null(base_txt) && nzchar(trimws(as.character(base_txt)[1])))
        trimws(as.character(base_txt)[1]),
      if (!isTRUE(base_multi_source) &&
          !is.null(fuente) &&
          nzchar(trimws(as.character(fuente)[1])))
        trimws(as.character(fuente)[1])
    )
    if (!length(parts)) NULL else paste(parts, collapse = " ")
  }

  # -------------------------------------------------------------------------
  # 5) Abrir docx
  # -------------------------------------------------------------------------
  doc <- if (!isTRUE(solo_lista)) officer::read_docx() else NULL
  toc_inserted <- FALSE

  # -------------------------------------------------------------------------
  # 6) Loop render_meta
  # -------------------------------------------------------------------------
  g_i      <- 0L
  log_rows <- vector("list", length(render_meta))

  for (idx in seq_along(render_meta)) {
    entry <- render_meta[[idx]]
    kind  <- entry$kind %||% "chart"

    if (isTRUE(mensajes_progreso))
      message(sprintf("  Word %03d/%03d \u2014 %s", idx, length(render_meta), kind))

    # -- Portada del documento ------------------------------------------------
    if (identical(kind, "title_doc")) {
      if (!isTRUE(solo_lista)) {
        ts <- presets_word$title_style
        doc <- .add_par_w(doc, entry$title,    ts, align = "center")
        doc <- .add_par_w(doc, entry$subtitle, ts, align = "center")
        doc <- .add_par_w(doc, entry$date,     ts, align = "center")
        if (isTRUE(presets_word$pagebreak_after_title))
          doc <- officer::body_add_break(doc)
        if (isTRUE((presets_word$toc %||% list())$enabled) && !isTRUE(toc_inserted)) {
          doc <- .add_toc_w(doc, presets_word)
          toc_inserted <- TRUE
          doc <- officer::body_add_break(doc)
        }
      }
      log_rows[[idx]] <- list(block_i = idx, block_type = "title_doc",
                              element = NA_character_, var = NA_character_)
      next
    }

    # -- Sección --------------------------------------------------------------
    if (identical(kind, "section")) {
      if (!isTRUE(solo_lista)) {
        if (isTRUE((presets_word$toc %||% list())$enabled) && !isTRUE(toc_inserted)) {
          doc <- .add_toc_w(doc, presets_word)
          toc_inserted <- TRUE
          doc <- officer::body_add_break(doc)
        }
        level_i <- suppressWarnings(as.integer(entry$meta$word_heading_level %||% 1L)[1])
        if (!is.finite(level_i) || is.na(level_i) || level_i < 1L) level_i <- 1L
        heading_style <- if (level_i <= 1L) "heading 1" else "heading 2"
        heading_fp <- if (level_i <= 1L) presets_word$section_style else (presets_word$subsection_style %||% presets_word$title_style)
        heading_txt <- .strip_heading_number(entry$title)
        doc <- .add_par_w(doc, heading_txt, heading_fp, style = heading_style)
        doc <- .add_par_w(doc, entry$subtitle, heading_fp)
        if (level_i <= 1L) {
          doc <- .add_par_w(doc, entry$word_intro %||% NULL, presets_word$intro_style, align = "left", style = "Normal")
        }
        doc <- officer::body_add_par(doc, "", style = "Normal")
      }
      log_rows[[idx]] <- list(block_i = idx, block_type = "section",
                              element = NA_character_, var = NA_character_)
      next
    }

    # -- Gráfico --------------------------------------------------------------
    if (!identical(kind, "chart")) next

    p <- entry$plot_word %||% NULL
    if (is.null(p)) next

    g_i       <- g_i + 1L
    title_txt <- .make_title_txt(entry$title %||% NULL, g_i)
    pie_txt   <- .make_pie_txt(
      entry$base %||% NULL,
      base_multi_source = isTRUE(entry$base_multi_source)
    )

    # altura dinámica si el graficador la sugiere:
    w <- attr(p, "ancho_word_sugerido", exact = TRUE)
    if (is.null(w) || !is.finite(w)) w <- img_w
    w <- max(w, 1.5)

    h <- attr(p, "alto_word_sugerido", exact = TRUE)
    if (is.null(h) || !is.finite(h)) h <- img_h
    h <- max(h, 0.9)

    if (!isTRUE(solo_lista)) {
      if (isTRUE((presets_word$toc %||% list())$enabled) && !isTRUE(toc_inserted)) {
        doc <- .add_toc_w(doc, presets_word)
        toc_inserted <- TRUE
        doc <- officer::body_add_break(doc)
      }
      doc <- .add_par_w(doc, title_txt, presets_word$title_style, align = "center", style = "Normal")
      doc <- officer::body_add_gg(doc, value = p, width = w, height = h, res = img_dpi)
      if (!is.null(pie_txt))
        doc <- .add_par_w(doc, pie_txt, presets_word$base_style, align = "center")
      doc <- officer::body_add_par(doc, "", style = "Normal")
      if (isTRUE(presets_word$pagebreak_between))
        doc <- officer::body_add_break(doc)
    }

    log_rows[[idx]] <- list(block_i = idx, block_type = "chart",
                            element = entry$etype %||% NA_character_,
                            var     = NA_character_)
  }

  log <- if (has_dplyr && has_tibble) {
    dplyr::bind_rows(lapply(log_rows, function(x) {
      if (is.null(x)) return(tibble::tibble(block_i = NA_integer_, block_type = NA_character_,
                                             element = NA_character_, var = NA_character_))
      tibble::tibble(block_i    = as.integer(x$block_i),
                     block_type = as.character(x$block_type %||% NA),
                     element    = as.character(x$element    %||% NA),
                     var        = as.character(x$var        %||% NA))
    }))
  } else log_rows

  if (!isTRUE(solo_lista)) {
    print(doc, target = path_docx)
    if (isTRUE(mensajes_progreso))
      message("DOCX generado en: ", normalizePath(path_docx, winslash = "/"))
  }

  invisible(list(
    doc  = if (isTRUE(solo_lista)) NULL else doc,
    plan = ppt_result$plan,
    log  = log
  ))
}
