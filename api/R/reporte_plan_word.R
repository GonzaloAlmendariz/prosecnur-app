# =============================================================================
# PRESETS WORD
# =============================================================================

.WORD_CHART_PRESETS_DEFAULT_PULSO <- list(
  barras_apiladas = list(
    mostrar_barra_extra      = FALSE,
    barra_extra_preset       = "ninguno",
    prefijo_barra_extra      = "",
    titulo_barra_extra       = "",

    canvas_w_etiquetas       = 0.18,
    canvas_w_buf_etq_bars    = 0,
    canvas_w_bars            = 0.82,
    canvas_w_buf_bars_extra  = 0,
    canvas_w_extra           = 0,

    canvas_h_toprow_in       = 0,
    canvas_h_legend_in       = 0.42,
    canvas_h_caption_in      = 0.45,
    canvas_h_panel_in_min    = 1.1,
    alto_por_categoria       = 0.55,

    grosor_barras_mult       = 1.5,
    ancho_max_eje_y          = 36,
    size_ejes                = 7,
    size_texto_barras        = 2.8,
    # W-1 (B52): sin este espejo, el preset editorial PPT (5.6 mm) seguia
    # gobernando las etiquetas de segmentos chicos via el fallback
    # `size_texto_barras_peq %||% size_texto_barras` del graficador, y el
    # "2%" salia al doble de tamano que el resto de valores en Word.
    size_texto_barras_peq    = 2.8,

    leyenda_posicion         = "abajo",
    mostrar_leyenda          = TRUE,
    legend_key_cm            = 0.18,
    legend_espaciado         = 0,
    legend_n_por_fila        = 10,
    # 6 pt era ilegible en el lienzo de 6.1in (B52/W-1); 8 pt es el piso
    # legible del manual para texto auxiliar impreso.
    size_leyenda             = 8,
    # W-5 (B54): cuando la columna extra pedida sobrevive en Word, su
    # tipografia baja del 16 editorial (calibrado a 12.2in) al cuerpo del
    # lienzo de 6.1in.
    size_barra_extra         = 9,
    size_titulo_extra        = 9,
    centro_cowplot           = 0.5
  ),

  # W-3 (B52): los bloques multiapiladas (baterias y laminas multiactor)
  # renderizaban en Word con el preset editorial PPT (16 pt sobre un lienzo
  # de 6.1in): las etiquetas de actor clipeaban por la izquierda y la
  # leyenda desbordaba. Estos tamanos estan calibrados al lienzo Word.
  multi_apiladas = list(
    mostrar_barra_extra      = FALSE,

    canvas_w_etiquetas       = 0.30,
    canvas_w_buf_etq_bars    = 0.02,
    canvas_w_bars            = 0.60,
    canvas_w_extra           = 0.08,

    canvas_h_toprow_in       = 0,
    canvas_h_legend_in       = 0.42,
    canvas_h_caption_in      = 0.45,
    alto_por_categoria       = 0.55,

    ancho_max_eje_y          = 26,
    size_ejes                = 9,
    size_titulos_grupo       = 9,
    size_texto_barras        = 2.8,
    size_texto_barras_peq    = 2.8,
    size_barra_extra         = 9,
    size_titulo_extra        = 9,

    leyenda_posicion         = "abajo",
    mostrar_leyenda          = TRUE,
    legend_key_cm            = 0.18,
    legend_espaciado         = 0,
    legend_n_por_fila        = 10,
    size_leyenda             = 8
  )
)

.WORD_PRESETS_DEFAULT_PULSO <- list(
  chart_options = list(ocultar_etiqueta_si_titulo = TRUE),
  chart_presets = .WORD_CHART_PRESETS_DEFAULT_PULSO
)

.word_chart_presets_merge_defaults <- function(chart_presets = NULL) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  out <- .WORD_CHART_PRESETS_DEFAULT_PULSO
  if (is.null(chart_presets)) return(out)
  if (!is.list(chart_presets)) return(out)

  for (nm in names(chart_presets)) {
    patch <- chart_presets[[nm]]
    if (is.null(patch) || !is.list(patch)) next
    if (!is.null(patch$args) && is.list(patch$args)) patch <- patch$args
    out[[nm]] <- utils::modifyList(out[[nm]] %||% list(), patch)
  }

  out
}

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
    toc                  = list(enabled = FALSE, title = NULL),
    chart_options        = list(ocultar_etiqueta_si_titulo = TRUE),
    chart_presets        = NULL
) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
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
    toc                   = toc,
    chart_options         = chart_options %||% list(),
    chart_presets         = .word_chart_presets_merge_defaults(chart_presets)
  )
  class(out) <- c("word_presets", "list")
  out
}

.apply_word_chart_presets <- function(presets_ppt, presets_word) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  presets_ppt <- presets_ppt %||% list()
  if (!is.list(presets_ppt)) presets_ppt <- list()

  ensure_block <- function(x) {
    if (is.null(x)) return(list(args = list()))
    if (!is.list(x)) return(list(args = list()))
    if (!is.null(x$args)) {
      if (!is.list(x$args)) x$args <- list()
      return(x)
    }
    list(args = x)
  }

  for (nm in c("base", "barras_apiladas", "multi_apiladas", "barras_agrupadas",
               "barras_numericas", "histograma", "boxplot", "pie", "donut", "radar_tabla",
               "media_rango", "dim_heatmap", "dim_heatmap_criterios", "dim_radar",
               "dim_comparativo_radarbar", "dim_foda", "debug")) {
    presets_ppt[[nm]] <- ensure_block(presets_ppt[[nm]])
  }

  chart_options <- presets_word$chart_options %||% list()
  ocultar_dup <- chart_options$ocultar_etiqueta_si_titulo %||% TRUE
  ocultar_dup <- isTRUE(ocultar_dup)
  for (nm in c("barras_apiladas", "multi_apiladas")) {
    presets_ppt[[nm]]$args$word_ocultar_etiqueta_categoria <-
      presets_ppt[[nm]]$args$word_ocultar_etiqueta_categoria %||% ocultar_dup
  }

  # Fallback legacy: antes de los defaults Word completos, solo existía un
  # ajuste de grosor. Se conserva por si un preset Word antiguo llega sin
  # `chart_presets$barras_apiladas`.
  if (is.null(presets_ppt$barras_apiladas$args$grosor_barras_mult)) {
    presets_ppt$barras_apiladas$args$grosor_barras_mult <- 1.2
  }

  chart_presets <- presets_word$chart_presets %||% list()
  if (is.list(chart_presets) && length(chart_presets)) {
    for (nm in names(chart_presets)) {
      patch <- chart_presets[[nm]]
      if (is.null(patch) || !is.list(patch)) next
      if (!is.null(patch$args) && is.list(patch$args)) patch <- patch$args
      presets_ppt[[nm]] <- ensure_block(presets_ppt[[nm]])
      # W-5 (B54): si el preset PPT del usuario pide la columna extra de
      # forma deliberada (barra_extra_preset != "ninguno"), el patch Word
      # no puede apagarla ni pisar la particion de anchos que ese preset
      # declara; solo re-escala el resto (tipografia, alturas, leyenda).
      if (nm %in% c("barras_apiladas", "multi_apiladas")) {
        patch <- .word_patch_conservar_barra_extra(patch, presets_ppt[[nm]]$args)
      }
      presets_ppt[[nm]]$args <- utils::modifyList(
        presets_ppt[[nm]]$args %||% list(),
        patch
      )
    }
  }

  # W-1/W-3 (B52): el render Word ocurre DENTRO de reporte_ppt_plan, que no
  # recibe presets_word. Se sella aqui el lienzo fisico del docx para que
  # `.word_ajustar_el()` re-calibre ancho/alto del canvas (el slot adapter
  # PPT inyecta ~12.2x5.9in y la imagen Word se inserta a este tamano).
  img <- (presets_word %||% list())$image %||% list()
  presets_ppt$base$args$word_image <- list(
    width_in  = suppressWarnings(as.numeric(img$width_in  %||% 6.1)[1]),
    height_in = suppressWarnings(as.numeric(img$height_in %||% 2.95)[1])
  )

  class(presets_ppt) <- c("ppt_presets", "list")
  presets_ppt
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
  # 1) Presets Word + capa compacta sobre presets PPT
  # -------------------------------------------------------------------------
  presets_word <- presets_word %||% w_presets()
  if (!inherits(presets_word, "word_presets"))
    stop("`presets_word` debe venir de `w_presets()`.", call. = FALSE)

  presets_ppt_word <- .apply_word_chart_presets(presets_ppt, presets_word)

  # -------------------------------------------------------------------------
  # 2) render_meta via reporte_ppt_plan (solo_lista + build_render_meta)
  # -------------------------------------------------------------------------
  if (isTRUE(mensajes_progreso)) message("Preparando render_meta desde plan PPT...")

  ppt_result <- reporte_ppt_plan(
    data               = data,
    instrumento        = instrumento,
    presets            = presets_ppt_word,
    plan               = plan,
    env_diapos         = env_diapos,
    strict_diapos      = strict_diapos,
    solo_lista         = TRUE,
    build_render_meta  = TRUE,
    mensajes_progreso  = mensajes_progreso
  )

  render_meta <- ppt_result$render_meta %||% list()
  if (!length(render_meta)) stop("El plan no produjo ningún elemento para Word.", call. = FALSE)

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
  .add_par_w <- function(doc, text, st, align = "left", style = NULL, keep_with_next = FALSE) {
    if (is.null(text) || !nzchar(trimws(as.character(text)[1]))) return(doc)
    text <- trimws(as.character(text)[1])
    fpar <- officer::fpar(
      officer::ftext(text, prop = .fp_w(st)),
      fp_p = officer::fp_par(text.align = align, keep_with_next = isTRUE(keep_with_next))
    )
    # W-2 (B52): en officer 0.7.x, body_add_fpar con `style` REEMPLAZA el
    # pPr del fpar (se pierden keepNext y jc). Si el párrafo exige
    # keep_with_next, manda el fp_par y se omite el estilo nombrado.
    if (isTRUE(keep_with_next)) style <- NULL
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

  .is_company_name_title <- function(x) {
    txt <- paste(as.character(x %||% ""), collapse = " ")
    txt <- iconv(txt, from = "", to = "ASCII//TRANSLIT")
    txt <- tolower(txt)
    txt <- trimws(gsub("\\s+", " ", txt, perl = TRUE))
    grepl("nombre\\s+de\\s+la\\s+empresa|empresa\\s+para\\s+la\\s+cual", txt, perl = TRUE)
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
  # B55: los PNG temporales de cada gráfico deben sobrevivir hasta que
  # print(doc) empaquete el docx (officer copia las imágenes recién ahí).
  # Se acumulan y se limpian al salir — también en rutas de error.
  img_paths <- character(0)
  on.exit(unlink(img_paths[file.exists(img_paths)]), add = TRUE)

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
      if (g_i > 1L && !isTRUE(presets_word$pagebreak_between) && .is_company_name_title(title_txt)) {
        doc <- officer::body_add_break(doc)
      }
      doc <- .add_par_w(doc, title_txt, presets_word$title_style, align = "center", style = "Normal", keep_with_next = TRUE)
      # W-2 (B52): body_add_gg no permite fp_par, asi que el parrafo de la
      # imagen no podia declarar keep_with_next y la Base quedaba huerfana
      # al otro lado de un salto de pagina. Se renderiza el PNG y se inserta
      # via fpar(external_img) para que titulo+imagen+Base viajen juntos.
      img_path <- tempfile(fileext = ".png")
      img_paths <- c(img_paths, img_path)
      ggplot2::ggsave(
        filename = img_path, plot = p, width = w, height = h,
        units = "in", dpi = img_dpi, bg = presets_word$image$bg %||% "white"
      )
      # B55: officer (temp_blipfill) COPIA la imagen a un segundo tempfile
      # png propio durante body_add_fpar; ese es el archivo que r:embed
      # referencia al hacer print(doc). El snapshot acotado a esta llamada
      # registra esa copia para la misma limpieza post-print.
      pngs_pre_add <- list.files(tempdir(), pattern = "\\.png$", full.names = TRUE)
      doc <- officer::body_add_fpar(
        doc,
        value = officer::fpar(
          officer::external_img(img_path, width = w, height = h, unit = "in"),
          fp_p = officer::fp_par(text.align = "center", keep_with_next = TRUE)
        )
      )
      img_paths <- c(img_paths, setdiff(
        list.files(tempdir(), pattern = "\\.png$", full.names = TRUE),
        pngs_pre_add
      ))
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
    # Con el docx ya escrito, los PNG intermedios sobran (el on.exit cubre
    # además los caminos de error previos al print).
    unlink(img_paths[file.exists(img_paths)])
    if (isTRUE(mensajes_progreso))
      message("DOCX generado en: ", normalizePath(path_docx, winslash = "/"))
  }

  invisible(list(
    doc  = if (isTRUE(solo_lista)) NULL else doc,
    plan = ppt_result$plan,
    log  = log
  ))
}
