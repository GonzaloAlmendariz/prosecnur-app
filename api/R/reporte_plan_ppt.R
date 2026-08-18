# =============================================================================
# NUEVO API  -  PPT "PLAN" (declarativo)
# - presets se definen en un chunk previo como `list(...)` o con `p_presets()`
# - p_* crea ELEMENTOS (graficos / texto / base) con overrides por diapositiva
# - p_slide_* crea SLIDES (layout fijo, sin strings sueltos)
# - reporte_ppt_plan() recolecta diapo_### o recibe plan explicito y exporta
# =============================================================================

#' @title Reporte PowerPoint basado en "plan" (p_* + diapo_###)
#'
#' @description
#' Genera un archivo **.pptx** a partir de un **plan de diapositivas** compuesto por:
#' - **elementos** `p_*()` (graficos / texto / base),
#' - **slides** `p_slide_*()` (contenedores con layout fijo),
#' - y objetos `diapo_###` (convencion para recoleccion automatica).
#'
#' El flujo recomendado es:
#' 1) Definir un objeto `presets <- list(...)` (o usar `p_presets()`) en un chunk previo.
#' 2) Definir `diapo_001 <- p_slide_*(...)`, `diapo_002 <- ...` (uno o varios chunks).
#' 3) Llamar a `reporte_ppt_plan(presets = presets, ...)` para recolectar y exportar.
#'
#' Cuando `data` e `instrumento` son listas nombradas, los elementos `p_*()` pueden
#' referenciar variables con la sintaxis `fuente$variable`, por ejemplo
#' `"estudiantes$p6_1"` o `"docentes$p4_1"`.
#'
#' @param data `data.frame`/`tibble` con las variables (o dummies) a reportar, o
#'   una lista nombrada de bases cuando el plan combina varias fuentes.
#' @param instrumento Objeto de instrumento con al menos `survey` (y opcionalmente `choices`,
#'   `orders_list`), o una lista nombrada de instrumentos alineada con `data`.
#'   Si es `NULL`, se busca el atributo `instrumento_reporte` en `data` cuando
#'   hay una sola fuente.
#' @param path_ppt Ruta del `.pptx` de salida.
#'
#' @param presets Lista de presets por tipo de grafico. El contrato esperado es
#'   `base$args`, `barras_apiladas$args`, `multi_apiladas$args`,
#'   `barras_agrupadas$args`, `barras_numericas$args`, `boxplot$args`, `pie$args`,
#'   `donut$args`, `radar_tabla$args`, `dim_heatmap$args`,
#'   `dim_radar$args` y `dim_foda$args`.
#'   Tambien puede construirse con `p_presets()`.
#'
#' @param plan Lista de slides ya construidos con `p_plan()` o `list(diapo_001=..., ...)`.
#'   Si es `NULL`, se recolectan objetos `diapo_###` desde `env_diapos`.
#' @param env_diapos Entorno donde se buscaran objetos `diapo_###` cuando `plan` sea `NULL`.
#'   Por defecto se usa `parent.frame()`.
#' @param strict_diapos Si `TRUE`, errores en vez de warnings cuando los `diapo_###` no son
#'   consecutivos o cuando hay inconsistencias estructurales (por ejemplo, slot requerido vacio).
#'
#' @param template_pptx Ruta a plantilla `.pptx`. Si es `NULL`, se intenta usar una plantilla
#'   interna del paquete y, si no existe, la plantilla por defecto de PowerPoint.
#' @param master Nombre del master de la plantilla (por defecto `"Office Theme"`).
#'
#' @param mensajes_progreso Si `TRUE`, imprime mensajes de avance durante el proceso.
#' @param solo_lista Si `TRUE`, no se escribe el archivo y solo se retorna el objeto de salida.
#' @param auto_otros_slides Si `TRUE`, inserta automaticamente una slide "Otros"
#'   despues de cada grafico con campo abierto asociado no vacio.
#' @param template_id Identidad explícita de la plantilla para el contrato de
#'   composición. Si se omite, se usa la identidad genérica; nunca se infiere
#'   desde el path o el nombre del archivo.
#'
#' @return Invisiblemente una lista con:
#' \describe{
#'   \item{doc}{Objeto `officer::pptx` cuando se exporta; `NULL` si `solo_lista = TRUE`.}
#'   \item{plan}{Plan normalizado de slides (lista).}
#'   \item{log}{Tabla con decisiones/alertas por slide y por elemento.}
#' }
#'
#' @family reporte
#' @export
reporte_ppt_plan <- function(
    data,
    instrumento        = NULL,
    path_ppt           = "reporte_ppt_plan.pptx",
    presets            = NULL,
    plan               = NULL,
    env_diapos         = parent.frame(),
    strict_diapos      = FALSE,
    template_pptx      = getOption("prosecnur.template_pptx", NA_character_),
    master             = "Office Theme",
    mensajes_progreso  = TRUE,
    solo_lista         = FALSE,
    # B41/G-18: opt-in. El default TRUE hacia aparecer la lamina "Otros" en
    # todo caller que no pasara el flag (feedback directo de Gonzalo: la
    # lamina automatica es una opcion, no lo normal).
    auto_otros_slides  = FALSE,
    build_render_meta  = FALSE,
    template_id        = NULL
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y

  # -----------------------
  # 0) Validaciones minimas
  # -----------------------
  if (!requireNamespace("officer", quietly = TRUE) ||
      !requireNamespace("rvg", quietly = TRUE)) {
    stop("Se requieren los paquetes 'officer' y 'rvg'.", call. = FALSE)
  }
  if (!is.logical(auto_otros_slides) || length(auto_otros_slides) != 1L || is.na(auto_otros_slides)) {
    .plan_input_abort("`auto_otros_slides` debe ser logical(1).")
  }

  .is_data_sources <- function(x) {
    is.list(x) && !is.data.frame(x) && length(x) > 0L &&
      all(vapply(x, is.data.frame, logical(1)))
  }

  .is_inst_sources <- function(x) {
    is.list(x) && !is.data.frame(x) && length(x) > 0L &&
      all(vapply(x, function(z) {
        is.list(z) && !is.data.frame(z) &&
          ("survey" %in% names(z)) &&
          !is.null(z[["survey"]])
      }, logical(1)))
  }

  .normalize_named_sources <- function(x, arg_name) {
    nms <- names(x)
    if (is.null(nms) || any(!nzchar(trimws(nms)))) {
      .plan_input_abort("`", arg_name, "` debe ser una lista nombrada cuando contiene varias fuentes.")
    }
    names(x) <- trimws(nms)
    x
  }

  if (!is.data.frame(data) && !.is_data_sources(data)) {
    .plan_input_abort("`data` debe ser un data.frame/tibble o una lista nombrada de data.frames.")
  }

  data_sources <- if (is.data.frame(data)) {
    list(default = data)
  } else {
    .normalize_named_sources(data, "data")
  }

  if (is.null(instrumento)) {
    if (length(data_sources) != 1L) {
      .plan_input_abort("Cuando `data` contiene varias fuentes, `instrumento` debe proveerse explicitamente como lista nombrada.")
    }
    instrumento <- attr(data_sources[[1]], "instrumento_reporte", exact = TRUE)
    if (is.null(instrumento)) {
      .plan_input_abort("No se proporciono `instrumento` y `data` no tiene atributo `instrumento_reporte`.")
    }
  }

  instrument_sources <- if (.is_inst_sources(instrumento)) {
    .normalize_named_sources(instrumento, "instrumento")
  } else if (is.list(instrumento) && !is.null(instrumento$survey)) {
    stats::setNames(list(instrumento), names(data_sources)[1])
  } else {
    .plan_input_abort("`instrumento` debe ser un objeto con `$survey` o una lista nombrada de instrumentos.")
  }

  missing_inst <- setdiff(names(data_sources), names(instrument_sources))
  if (length(missing_inst)) {
    .plan_input_abort(
      "`instrumento` no contiene definicion para estas fuentes de `data`: ",
      paste(missing_inst, collapse = ", ")
    )
  }

  default_source <- if (length(data_sources) == 1L) {
    names(data_sources)[1]
  } else if ("default" %in% names(data_sources)) {
    "default"
  } else {
    NA_character_
  }
  if (!is.na(default_source)) {
    survey      <- instrument_sources[[default_source]]$survey %||% NULL
    choices     <- instrument_sources[[default_source]]$choices %||% NULL
    orders_list <- instrument_sources[[default_source]]$orders_list %||% NULL
  } else {
    survey <- NULL
    choices <- NULL
    orders_list <- NULL
  }

  # -----------------------
  # 0.1) Presets (tu contrato)
  # -----------------------
  presets <- presets %||% list()
  if (!is.null(presets$dim_radar_tabla)) {
    warning(
      "`presets$dim_radar_tabla` fue retirado del flujo PPT y sera ignorado. Use `dim_radar` o `dim_heatmap`.",
      call. = FALSE
    )
  }
  # defaults minimos si el usuario no paso nada
  presets$barras_apiladas <- presets$barras_apiladas %||% list(args = list())
  if (is.null(presets$barras_apiladas$args) || !is.list(presets$barras_apiladas$args)) {
    presets$barras_apiladas$args <- list()
  }
  # defaults de seguridad
  presets$barras_apiladas$args$usar_canvas <- presets$barras_apiladas$args$usar_canvas %||% TRUE
  presets$barras_apiladas$args$exportar    <- presets$barras_apiladas$args$exportar %||% "rplot"
  # defaults para BASE auto (si el usuario no declara base)
  presets$base <- presets$base %||% list()
  presets$base$args <- presets$base$args %||% list()

  presets$base$args$formato   <- presets$base$args$formato %||% "Base: %s"
  presets$base$args$sufijo_auto <- presets$base$args$sufijo_auto %||% NULL

  # defaults para que nunca falle el acceso a $args
  presets$barras_agrupadas <- presets$barras_agrupadas %||% list(args = list())
  presets$barras_agrupadas$args <- presets$barras_agrupadas$args %||% list()
  presets$barras_categoricas <- presets$barras_categoricas %||% list(args = list())
  presets$barras_categoricas$args <- presets$barras_categoricas$args %||% list()

  presets$barras_numericas <- presets$barras_numericas %||% list(args = list())
  presets$barras_numericas$args <- presets$barras_numericas$args %||% list()
  presets$histograma <- presets$histograma %||% list(args = list())
  presets$histograma$args <- presets$histograma$args %||% list()

  presets$boxplot <- presets$boxplot %||% list(args = list())
  presets$boxplot$args <- presets$boxplot$args %||% list()
  presets$media_rango <- presets$media_rango %||% list(args = list())
  presets$media_rango$args <- presets$media_rango$args %||% list()

  presets$nube_palabras <- presets$nube_palabras %||% list(args = list())
  presets$nube_palabras$args <- presets$nube_palabras$args %||% list()

  presets$radar_tabla <- presets$radar_tabla %||% list(args = list())
  presets$radar_tabla$args <- presets$radar_tabla$args %||% list()

  presets$dim_heatmap <- presets$dim_heatmap %||% list(args = list())
  presets$dim_heatmap$args <- presets$dim_heatmap$args %||% list()
  presets$dim_heatmap_criterios <- presets$dim_heatmap_criterios %||% list(args = list())
  presets$dim_heatmap_criterios$args <- presets$dim_heatmap_criterios$args %||% list()

  presets$dim_radar <- presets$dim_radar %||% list(args = list())
  presets$dim_radar$args <- presets$dim_radar$args %||% list()
  presets$dim_comparativo_radarbar <- presets$dim_comparativo_radarbar %||% list(args = list())
  presets$dim_comparativo_radarbar$args <- presets$dim_comparativo_radarbar$args %||% list()

  presets$dim_foda <- presets$dim_foda %||% list(args = list())
  presets$dim_foda$args <- presets$dim_foda$args %||% list()

  # ------------------------------------------------------------
  # HERENCIA: base$args (solo estilo) -> todos los presets$args
  # ------------------------------------------------------------
  base_style <- presets$base$args %||% list()

  # NO pasar estos al graficador (son solo para texto base auto)
  base_style$formato     <- NULL
  base_style$sufijo_auto <- NULL

  # a que presets se les hereda
  targets <- intersect(
    names(presets),
    c("barras_apiladas", "multi_apiladas", "barras_agrupadas",
      "barras_categoricas", "barras_numericas", "histograma", "boxplot", "media_rango", "nube_palabras", "pie", "donut", "radar_tabla",
      "dim_heatmap", "dim_heatmap_criterios", "dim_radar", "dim_comparativo_radarbar", "dim_foda")
  )

  for (nm in targets) {
    presets[[nm]]$args <- modifyList(base_style, presets[[nm]]$args %||% list())
  }

  # defaults multi_apiladas
  presets$multi_apiladas <- presets$multi_apiladas %||% list(args = list())
  if (is.null(presets$multi_apiladas$args) || !is.list(presets$multi_apiladas$args)) {
    presets$multi_apiladas$args <- list()
  }

  # heredar defaults de barras_apiladas si quieres (opcional)
  presets$multi_apiladas$args$usar_canvas <- presets$multi_apiladas$args$usar_canvas %||% TRUE
  presets$multi_apiladas$args$exportar    <- presets$multi_apiladas$args$exportar %||% "rplot"

  # defaults pie/donut
  presets$pie   <- presets$pie   %||% list(args = list())
  presets$donut <- presets$donut %||% list(args = list())
  presets$boxplot <- presets$boxplot %||% list(args = list())

  presets$pie$args   <- presets$pie$args   %||% list()
  presets$donut$args <- presets$donut$args %||% list()
  presets$boxplot$args <- presets$boxplot$args %||% list()

  # herencia: donut hereda pie
  presets$donut$args <- .merge_args(presets$pie$args, presets$donut$args)

  # defaults de seguridad
  presets$pie$args$usar_canvas   <- presets$pie$args$usar_canvas   %||% TRUE
  presets$pie$args$exportar      <- presets$pie$args$exportar      %||% "rplot"
  presets$donut$args$usar_canvas <- presets$donut$args$usar_canvas %||% presets$pie$args$usar_canvas
  presets$donut$args$exportar    <- presets$donut$args$exportar    %||% presets$pie$args$exportar
  presets$boxplot$args$usar_canvas <- presets$boxplot$args$usar_canvas %||% TRUE
  presets$boxplot$args$exportar    <- presets$boxplot$args$exportar %||% "rplot"
  presets$media_rango$args$usar_canvas <- presets$media_rango$args$usar_canvas %||% presets$boxplot$args$usar_canvas
  presets$media_rango$args$exportar    <- presets$media_rango$args$exportar %||% presets$boxplot$args$exportar

  # defaults esteticos unicos para dimensiones (PPT)
  presets$dim_heatmap$args$angle_x <- presets$dim_heatmap$args$angle_x %||% 0
  presets$dim_heatmap$args$size_ejes <- presets$dim_heatmap$args$size_ejes %||% 10
  presets$dim_heatmap$args$size_texto_celdas <- presets$dim_heatmap$args$size_texto_celdas %||% 10
  presets$dim_heatmap$args$canvas_h_title <- presets$dim_heatmap$args$canvas_h_title %||% 0.13
  presets$dim_heatmap$args$canvas_h_legend <- presets$dim_heatmap$args$canvas_h_legend %||% 0.09
  presets$dim_heatmap$args$canvas_h_caption <- presets$dim_heatmap$args$canvas_h_caption %||% 0.06
  presets$dim_heatmap_criterios$args$font_family <- presets$dim_heatmap_criterios$args$font_family %||% presets$base$args$font_family_ppt %||% presets$base$args$font_family %||% "Arial"

  presets$dim_radar$args$cortes_grilla <- presets$dim_radar$args$cortes_grilla %||% 4
  presets$dim_radar$args$wrap_ejes <- presets$dim_radar$args$wrap_ejes %||% 22
  presets$dim_radar$args$eje_label_mult <- presets$dim_radar$args$eje_label_mult %||% 1.03
  presets$dim_radar$args$leyenda_posicion <- presets$dim_radar$args$leyenda_posicion %||% "abajo"
  presets$dim_radar$args$legend_n_por_fila <- presets$dim_radar$args$legend_n_por_fila %||% 4
  presets$dim_radar$args$legend_key_cm <- presets$dim_radar$args$legend_key_cm %||% 0.45
  presets$dim_radar$args$legend_espaciado <- presets$dim_radar$args$legend_espaciado %||% 12
  presets$dim_radar$args$canvas_h_header_in <- presets$dim_radar$args$canvas_h_header_in %||% 0.58
  presets$dim_radar$args$canvas_h_legend_in <- presets$dim_radar$args$canvas_h_legend_in %||% 0.20
  presets$dim_radar$args$canvas_h_caption_in <- presets$dim_radar$args$canvas_h_caption_in %||% 0.08

  presets$dim_foda$args$canvas_h_title <- presets$dim_foda$args$canvas_h_title %||% 0
  presets$dim_foda$args$canvas_h_legend <- presets$dim_foda$args$canvas_h_legend %||% 0.09
  presets$dim_foda$args$canvas_h_caption <- presets$dim_foda$args$canvas_h_caption %||% 0.06

  # ---------------------------------------------------------------------------
  # 1) Helpers  -  PPT strict con contrato interno (.PPT_CONTRACT)
  # ---------------------------------------------------------------------------
  .layout_exists <- function(layout_name) {
    layout_name %in% layout_info$layout
  }

  .add_slide_strict <- function(doc, layout_name) {
    if (!.layout_exists(layout_name)) {
      .plan_input_abort("La plantilla NO tiene el layout requerido: '", layout_name, "'.")
    }
    officer::add_slide(doc, layout = layout_name, master = master)
  }

  .ph_loc <- function(type, type_idx = NULL) {
    if (is.null(type_idx)) return(officer::ph_location_type(type = type))
    tryCatch(
      officer::ph_location_type(type = type, type_idx = type_idx),
      error = function(e) tryCatch(
        officer::ph_location_type(type = type, id = type_idx),
        error = function(e2) officer::ph_location_type(type = type)
      )
    )
  }

  .select_placeholder_props <- function(props, spec, layout_name, master_name) {
    selected <- .ppt_slide_template_select_placeholder(props, spec)
    if (!is.null(selected)) return(selected)
    .plan_input_abort(
      "No se encontro el placeholder efectivo type='", spec$type %||% "<NA>",
      "' idx='", spec$type_idx %||% "<NA>",
      "' en layout='", layout_name %||% "<NA>",
      "', master='", master_name %||% "<NA>", "'."
    )
  }

  .is_slide_title_spec <- function(spec) {
    if (is.null(spec) || is.null(spec$type)) return(FALSE)
    type <- as.character(spec$type)[1]
    type %in% c("title", "ctrTitle")
  }

  .is_body_text_spec <- function(spec) {
    label <- as.character(spec$ph_label %||% "")[1]
    nzchar(label) && grepl(":text$", label)
  }

  .is_note_text_spec <- function(spec) {
    label <- as.character(spec$ph_label %||% "")[1]
    nzchar(label) && grepl(":(base|footer|right|right_text)$", label)
  }

  .styled_slide_title <- function(text, spec) {
    base_args <- presets$base$args %||% list()
    is_cover_title <- identical(as.character(spec$type)[1], "ctrTitle")
    spec_label <- as.character(spec$ph_label %||% "")[1]
    is_section_title <- identical(spec_label, "prosecnur:section:title")

    font_family <- if (is_cover_title) {
      base_args$font_family_titulo_portada %||% base_args$font_family_portada %||%
        base_args$font_family_ppt %||% base_args$font_family
    } else {
      base_args$font_family_ppt %||% base_args$font_family
    }
    font_family <- font_family %||% "Arial"
    font_family <- as.character(font_family)[1]
    if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"

    font_size_value <- if (is_cover_title) {
      base_args$size_titulo_portada %||% base_args$title_cover_size %||% base_args$size_titulo_slide
    } else if (is_section_title) {
      # Misma regla que usa la capa router al precocinar los presets, para que
      # el tamano no dependa del path por el que se pidio el export.
      .ppt_section_title_size(
        base_args$size_titulo_seccion,
        base_args$size_titulo_slide
      )
    } else {
      base_args$size_titulo_slide
    }
    font_size <- suppressWarnings(as.numeric(font_size_value %||% 24)[1])
    if (!is.finite(font_size) || is.na(font_size) || font_size <= 0) font_size <- 24

    color <- if (is_cover_title) {
      base_args$color_titulo_portada %||% base_args$title_cover_color %||% base_args$color_titulo_slide
    } else if (is_section_title) {
      base_args$color_titulo_seccion %||% base_args$color_titulo_slide
    } else {
      base_args$color_titulo_slide
    }
    color <- color %||% "#CA5651"
    color <- as.character(color)[1]
    if (is.na(color) || !nzchar(trimws(color))) color <- "#CA5651"

    align <- if (is_cover_title) "center" else "left"
    uppercase_title <- if (is_cover_title) {
      base_args$mayusculas_titulo_portada %||% base_args$uppercase_title_cover %||%
        base_args$mayusculas_titulo_slide %||% base_args$uppercase_title_slide
    } else if (is_section_title) {
      base_args$mayusculas_titulo_seccion %||% FALSE
    } else {
      base_args$mayusculas_titulo_slide %||% base_args$uppercase_title_slide
    }
    uppercase_title <- uppercase_title %||% TRUE
    uppercase_title <- isTRUE(uppercase_title)

    bold_title <- if (is_cover_title) {
      base_args$bold_titulo_portada %||% base_args$title_cover_bold %||%
        base_args$bold_titulo_slide %||% base_args$title_slide_bold
    } else if (is_section_title) {
      base_args$bold_titulo_seccion %||% TRUE
    } else {
      base_args$bold_titulo_slide %||% base_args$title_slide_bold
    }
    bold_title <- bold_title %||% TRUE
    bold_title <- isTRUE(bold_title)

    title_text <- as.character(text)[1]
    if (uppercase_title) title_text <- toupper(title_text)

    officer::fpar(
      officer::ftext(
        title_text,
        prop = officer::fp_text(
          color = color,
          font.size = font_size,
          font.family = font_family,
          bold = bold_title
        )
      ),
      fp_p = officer::fp_par(text.align = align, line_spacing = 1)
    )
  }

  .styled_body_text <- function(text) {
    base_args <- presets$base$args %||% list()
    font_family <- base_args$font_family_ppt %||% base_args$font_family %||% "Arial"
    font_family <- as.character(font_family)[1]
    if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"

    font_size <- suppressWarnings(as.numeric(base_args$size_cuerpo_slide %||% 14)[1])
    if (!is.finite(font_size) || is.na(font_size) || font_size <= 0) font_size <- 14
    font_size <- max(12, min(14, font_size))

    officer::fpar(
      officer::ftext(
        as.character(text)[1],
        prop = officer::fp_text(
          color = base_args$color_nota_pie %||% "#081F5C",
          font.size = font_size,
          font.family = font_family,
          bold = FALSE
        )
      ),
      fp_p = officer::fp_par(text.align = "justify", line_spacing = 1)
    )
  }

  .styled_note_text <- function(text, spec = NULL) {
    base_args <- presets$base$args %||% list()
    font_family <- base_args$font_family_ppt %||% base_args$font_family %||% "Arial"
    font_family <- as.character(font_family)[1]
    if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"

    font_size <- suppressWarnings(as.numeric(base_args$size_nota_pie %||% 10)[1])
    if (!is.finite(font_size) || is.na(font_size) || font_size <= 0) font_size <- 10
    align <- as.character((spec %||% list())$align %||% "left")[1]
    if (is.na(align) || !nzchar(trimws(align))) align <- "left"

    officer::fpar(
      officer::ftext(
        as.character(text)[1],
        prop = officer::fp_text(
          color = base_args$color_nota_pie %||% "#081F5C",
          font.size = font_size,
          font.family = font_family,
          bold = FALSE
        )
      ),
      fp_p = officer::fp_par(text.align = align, line_spacing = 1)
    )
  }

  .ph_with_strict <- function(doc, value, spec) {
    if (is.null(spec) || is.null(spec$type)) {
      .plan_input_abort("Placeholder spec invalido (NULL o sin $type).")
    }
    # `suppress` lo marca .ppt_calibrar_pies_iconos: sin cajon real, se omite.
    if (isTRUE(spec$suppress)) return(doc)
    type_idx <- spec$type_idx %||% NULL
    if (!is.null(type_idx)) {
      type_idx <- suppressWarnings(as.integer(type_idx))
      if (length(type_idx) != 1L || is.na(type_idx)) {
        .plan_input_abort("`type_idx` debe ser un entero escalar.")
      }
    }

    slide <- doc$slide$get_slide(doc$cursor)
    xfrm <- tryCatch(slide$get_xfrm(), error = function(e) NULL)

    layout_name <- NULL
    master_name <- NULL

    if (!is.null(xfrm)) {
      layout_vals <- unique(as.character(xfrm$name))
      layout_vals <- layout_vals[!is.na(layout_vals) & nzchar(trimws(layout_vals))]
      if (length(layout_vals)) layout_name <- layout_vals[1]

      master_vals <- unique(as.character(xfrm$master_name))
      master_vals <- master_vals[!is.na(master_vals) & nzchar(trimws(master_vals))]
      if (length(master_vals)) master_name <- master_vals[1]
    }

    if (is.null(master_name) || !nzchar(master_name)) {
      master_name <- master
    }

    explicit_loc <- spec$loc %||% NULL
    if (!is.null(explicit_loc)) {
      if (is.numeric(explicit_loc) && length(explicit_loc) >= 4L) {
        explicit_loc <- list(
          left = explicit_loc[[1]],
          top = explicit_loc[[2]],
          width = explicit_loc[[3]],
          height = explicit_loc[[4]]
        )
      }
      required_loc <- c("left", "top", "width", "height")
      if (!is.list(explicit_loc) || !all(required_loc %in% names(explicit_loc))) {
        .plan_input_abort("`spec$loc` debe incluir left, top, width y height.")
      }
      loc <- officer::ph_location(
        left = as.numeric(explicit_loc$left),
        top = as.numeric(explicit_loc$top),
        width = as.numeric(explicit_loc$width),
        height = as.numeric(explicit_loc$height),
        newlabel = spec$ph_label %||% "",
        rotation = as.numeric(explicit_loc$rotation %||% 0)
      )
      # Un `ph_location()` por coordenadas emite `<p:ph/>` VACÍO. PowerPoint no
      # lo resuelve y hereda las propiedades de texto del ancestro que le toque:
      # en «Objetivos_Secciones» le tocaba el título, que es vertical, y el
      # párrafo del objetivo salía girado. LibreOffice lo resolvía a horizontal,
      # así que la cadena de PDF nunca lo enseñó — sólo se vio exportando con
      # PowerPoint de verdad.
      #
      # Con `ph_xml` declarado en el contrato se escribe el placeholder real y
      # el texto hereda de quien debe. Sólo donde se declara: los demás slots
      # llevan imágenes, que no heredan propiedades de párrafo.
      if (!is.null(spec$ph_xml)) loc$ph <- spec$ph_xml
      target_loc <- loc
    } else {
      props <- officer::layout_properties(
        doc,
        layout = layout_name,
        master = master_name
      )

      props <- .select_placeholder_props(props, spec, layout_name, master_name)

      loc <- officer::ph_location(
        left = props$offx[[1]],
        top = props$offy[[1]],
        width = props$cx[[1]],
        height = props$cy[[1]],
        newlabel = props$ph_label[[1]] %||% "",
        rotation = props$rotation[[1]]
      )

      target_type <- props$type[[1]] %||% spec$type
      target_type_idx <- props$type_idx[[1]] %||% type_idx
      target_loc <- .ph_loc(target_type, type_idx = target_type_idx)
    }

    .ph_with_dml_safe <- function(doc, value, location) {
      img_directory <- tempfile("rvg-img-")
      dir.create(img_directory, recursive = TRUE, showWarnings = FALSE)
      dml_file <- tempfile("rvg-", fileext = ".xml")

      pars <- list(
        file = dml_file,
        offx = location$left,
        offy = location$top,
        width = location$width,
        height = location$height,
        bg = value$bg,
        fonts = value$fonts,
        pointsize = value$pointsize,
        editable = value$editable,
        id = 0L,
        last_rel_id = 1L,
        raster_prefix = paste0(img_directory, "/raster-"),
        standalone = FALSE
      )

      do.call(rvg::dml_pptx, pars)
      tryCatch(
        {
          if (!is.null(value$ggobj)) {
            stopifnot(inherits(value$ggobj, "ggplot"))
            print(value$ggobj)
          } else {
            rlang::eval_tidy(value$code)
          }
        },
        finally = dev.off()
      )

      dml_lines <- scan(
        dml_file,
        what = "character",
        quiet = TRUE,
        sep = "\n",
        encoding = "UTF-8"
      )

      if (length(dml_lines) == 1L && identical(dml_lines, "</p:grpSp>")) {
        stop("There was no plot output produced, can not add an empty plot to pptx document.", call. = FALSE)
      }

      dml_xml <- paste(dml_lines, collapse = "")

      officer::ph_with(
        x = doc,
        value = xml2::as_xml_document(dml_xml),
        location = location
      )
    }

    if (is.character(value) && length(value) == 1L && nzchar(trimws(value))) {
      if (.is_slide_title_spec(spec)) {
        value <- .styled_slide_title(value, spec)
      } else if (.is_body_text_spec(spec)) {
        value <- .styled_body_text(value)
      } else if (.is_note_text_spec(spec)) {
        value <- .styled_note_text(value, spec = spec)
      }
    }

    out <- tryCatch(
      if (inherits(value, "dml")) {
        .ph_with_dml_safe(doc, value = value, location = loc)
      } else {
        officer::ph_with(
          doc,
          value = value,
          location = target_loc
        )
      },
      error = identity
    )
    if (inherits(out, "error")) {
      .plan_input_abort(
        "No se pudo insertar en placeholder type='", spec$type,
        "' type_idx=", spec$type_idx %||% "NULL",
        ". Error: ", conditionMessage(out)
      )
    }
    if (!is.null(spec$anchor)) {
      out <- .ppt_set_shape_anchor(out, spec$ph_label, spec$anchor)
    }
    out
  }

  .plot_slot_expand_down_cm <- function(spec, extra_cm = NULL, max_height_cm = NULL) {
    if (is.null(spec) || is.null(spec$loc)) return(spec)
    loc <- spec$loc
    if (is.numeric(loc) && length(loc) >= 4L) {
      loc <- list(left = loc[[1]], top = loc[[2]], width = loc[[3]], height = loc[[4]])
    }
    required_loc <- c("left", "top", "width", "height")
    if (!is.list(loc) || !all(required_loc %in% names(loc))) return(spec)

    extra_cm <- suppressWarnings(as.numeric(extra_cm %||% 0)[1])
    if (!is.finite(extra_cm) || is.na(extra_cm) || extra_cm <= 0) return(spec)

    max_height_cm <- suppressWarnings(as.numeric(max_height_cm %||% NA_real_)[1])
    new_height_cm <- as.numeric(loc$height) * 2.54 + extra_cm
    if (is.finite(max_height_cm) && !is.na(max_height_cm) && max_height_cm > 0) {
      new_height_cm <- min(new_height_cm, max_height_cm)
    }

    spec$loc <- loc
    # H32: la expansion nunca cruza el borde inferior de la lamina.
    tope_in <- 7.32 - suppressWarnings(as.numeric(loc$top)[1])
    alto_exp <- max(as.numeric(loc$height), new_height_cm / 2.54)
    spec$loc$height <- if (is.finite(tope_in) && tope_in > 0) min(alto_exp, max(as.numeric(loc$height), tope_in)) else alto_exp
    spec
  }

  .plot_slot_for_rendered_plot <- function(spec, plot) {
    if (!isTRUE(attr(plot, "pulso_needs_tall_plot_slot", exact = TRUE))) return(spec)
    base_args <- presets$base$args %||% list()
    .plot_slot_expand_down_cm(
      spec,
      extra_cm = base_args$slide_1_plot_extra_height_cm_apiladas_arriba %||% 1.20,
      max_height_cm = base_args$slide_1_plot_max_height_cm_apiladas_arriba %||% 15.35
    )
  }

  # Delegado: la lógica vive en reporte_plan_helpers.R (freeze de este archivo);
  # es pura sobre (el, spec), sin estado del closure.
  .element_adapt_to_plot_slot <- function(el, spec) {
    .reporte_plan_element_adapt_to_plot_slot(el, spec)
  }

  .resolve_partner_logo_path <- function(path = NULL) {
    raw <- path %||% ""
    raw <- as.character(raw)[1]
    candidates <- character(0)
    if (nzchar(trimws(raw))) candidates <- c(candidates, raw)
    candidates <- c(
      candidates,
      system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnurapp"),
      system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnur"),
      file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png"),
      file.path(getwd(), "inst", "hojas_ruta", "assets", "logo_pulso.png")
    )
    candidates <- candidates[nzchar(candidates)]
    hit <- candidates[file.exists(candidates)][1]
    if (is.na(hit) || !nzchar(hit)) "" else normalizePath(hit, winslash = "/", mustWork = TRUE)
  }

  .add_partner_footer_logo <- function(doc) {
    base_args <- presets$base$args %||% list()
    enabled <- base_args$partner_logo_footer %||% base_args$logo_pulso_footer %||% FALSE
    if (!isTRUE(enabled)) return(doc)

    logo_path <- .resolve_partner_logo_path(base_args$partner_logo_path %||% base_args$logo_pulso_path %||% NULL)
    if (!nzchar(logo_path)) return(doc)

    logo_h <- suppressWarnings(as.numeric(base_args$partner_logo_height %||% base_args$logo_pulso_height %||% 0.42)[1])
    if (!is.finite(logo_h) || is.na(logo_h) || logo_h <= 0) logo_h <- 0.42
    logo_w <- suppressWarnings(as.numeric(base_args$partner_logo_width %||% base_args$logo_pulso_width %||% (logo_h * 1078 / 423))[1])
    if (!is.finite(logo_w) || is.na(logo_w) || logo_w <= 0) logo_w <- logo_h * 1078 / 423

    slide_dims <- tryCatch(officer::slide_size(doc), error = function(e) NULL)
    slide_h <- suppressWarnings(as.numeric(slide_dims$height %||% 7.5)[1])
    if (!is.finite(slide_h) || is.na(slide_h) || slide_h <= 0) slide_h <- 7.5

    logo_left <- suppressWarnings(as.numeric(base_args$partner_logo_left %||% base_args$logo_pulso_left %||% 0.46)[1])
    logo_top <- suppressWarnings(as.numeric(base_args$partner_logo_top %||% base_args$logo_pulso_top %||% (slide_h - logo_h - 0.22))[1])
    if (!is.finite(logo_left) || is.na(logo_left)) logo_left <- 0.46
    if (!is.finite(logo_top) || is.na(logo_top)) logo_top <- slide_h - logo_h - 0.22

    officer::ph_with(
      doc,
      value = officer::external_img(src = logo_path, width = logo_w, height = logo_h, alt = "PULSO PUCP"),
      location = officer::ph_location(
        left = logo_left,
        top = logo_top,
        width = logo_w,
        height = logo_h,
        newlabel = "PULSO PUCP footer logo"
      )
    )
  }

  .style_value <- function(style, name, default) {
    out <- style[[name]] %||% default
    if (length(out) == 0L || is.na(out[[1]])) return(default)
    out[[1]]
  }

  .style_num <- function(style, name, default, min = NULL, max = NULL) {
    out <- suppressWarnings(as.numeric(.style_value(style, name, default))[1])
    if (!is.finite(out)) out <- default
    if (!is.null(min)) out <- base::max(min, out)
    if (!is.null(max)) out <- base::min(max, out)
    out
  }

  .technical_table_row_heights <- function(tbl, style, table_height) {
    n <- nrow(tbl)
    row_heights <- style$row_heights %||% NULL
    if (!is.null(row_heights)) {
      row_heights <- suppressWarnings(as.numeric(row_heights))
      if (length(row_heights) == n && all(is.finite(row_heights)) && all(row_heights > 0)) {
        if (sum(row_heights) > table_height) {
          row_heights <- row_heights * (table_height / sum(row_heights))
        }
        return(row_heights)
      }
    }

    min_row_height <- .style_num(style, "min_row_height", 0.48, min = 0.25)
    if (n * min_row_height > table_height) {
      return(rep(table_height / n, n))
    }

    # El peso son las LINEAS que ocupa la fila, no sus caracteres: un salto no
    # suma caracteres y si suma alto. Ver `reporte_ppt_tabla_lineas.R`.
    weights <- vapply(
      seq_len(n),
      function(i) as.numeric(.tabla_peso_fila(tbl$criterio[[i]], tbl$detalle[[i]])),
      numeric(1)
    )
    out <- table_height * weights / sum(weights)
    out <- pmax(min_row_height, out)
    if (sum(out) > table_height) {
      out <- out * (table_height / sum(out))
    }
    out
  }

  .make_technical_table_flextable <- function(tbl, style, font_family_default) {
    if (!requireNamespace("flextable", quietly = TRUE)) {
      stop("Se requiere el paquete 'flextable' para renderizar `technical_table`.", call. = FALSE)
    }

    is_matrix_mode <- ncol(tbl) > 2L

    if (!is_matrix_mode) {
      tbl <- as.data.frame(tbl[, seq_len(2L), drop = FALSE], stringsAsFactors = FALSE)
      names(tbl) <- c("criterio", "detalle")
      tbl$criterio <- as.character(tbl$criterio)
      tbl$detalle <- as.character(tbl$detalle)
      tbl$criterio[is.na(tbl$criterio)] <- ""
      tbl$detalle[is.na(tbl$detalle)] <- ""
    } else {
      tbl <- as.data.frame(tbl, stringsAsFactors = FALSE, check.names = FALSE)
      for (j in seq_along(tbl)) {
        col <- as.character(tbl[[j]])
        col[is.na(col)] <- ""
        tbl[[j]] <- col
      }
    }

    table_width <- .style_num(style, "table_width", 12.30, min = 4)
    table_height <- .style_num(style, "table_height", 5.55, min = 1)
    # El piso baja de 0.14 a 0.02: con 0.14 la primera columna nunca podia ser
    # un cuadro de leyenda —topaba en 4.38 cm sobre un cajon de 31— y la lamina
    # de escala salia con rectangulos 4:1 en vez de cuadros. La ficha tecnica
    # declara su 0.20 y no se entera.
    first_col_pct <- .style_num(style, "first_col_pct", 0.20, min = 0.02, max = 0.32)
    font_family <- as.character(.style_value(style, "font_family", font_family_default))[1]
    text_color <- as.character(.style_value(style, "text_color", "#081F5C"))[1]
    first_col_fill <- as.character(.style_value(style, "first_col_fill", "#D8D8D8"))[1]
    body_fill <- as.character(.style_value(style, "body_fill", "#F2F2F2"))[1]
    # `757070` y no `BFBFBF`: es el gris con que el entregable aprobado declara
    # los cuatro lados de cada celda de su ficha tecnica, medido sobre el XML.
    # El claro se perdia sobre el relleno `F2F2F2` del cuerpo. Mismo valor que
    # usa el otro constructor de tablas nativas —`.tabla_nativa_flextable()`—,
    # para que las cinco tablas del mazo lleven una sola rejilla.
    border_color <- as.character(.style_value(style, "border_color", "#757070"))[1]
    border_width <- .style_num(style, "border_width", 0.75, min = 0.1)
    first_col_size <- .style_num(style, "first_col_size", 14, min = 6)
    body_size <- .style_num(style, "body_size", 14, min = 6)
    pad_h <- .style_num(style, "padding_h", 8, min = 0)
    pad_v <- .style_num(style, "padding_v", 5, min = 0)

    border <- officer::fp_border(color = border_color, width = border_width)

    if (!is_matrix_mode) {
      row_heights <- .technical_table_row_heights(tbl, style, table_height)

      ft <- flextable::flextable(tbl)
      ft <- flextable::delete_part(ft, part = "header")
      ft <- flextable::set_table_properties(ft, layout = "fixed")
      ft <- flextable::width(ft, j = 1, width = table_width * first_col_pct)
      ft <- flextable::width(ft, j = 2, width = table_width * (1 - first_col_pct))
      ft <- flextable::font(ft, fontname = font_family, part = "all")
      ft <- flextable::fontsize(ft, j = 1, size = first_col_size, part = "body")
      ft <- flextable::fontsize(ft, j = 2, size = body_size, part = "body")
      ft <- flextable::bold(ft, j = 1, bold = TRUE, part = "body")
      ft <- flextable::color(ft, color = text_color, part = "all")
      ft <- flextable::bg(ft, j = 1, bg = first_col_fill, part = "body")
      ft <- flextable::bg(ft, j = 2, bg = body_fill, part = "body")
      # Un color por fila en la primera columna convierte la tabla en la leyenda
      # de una escala: el cuadro de color a la izquierda y su etiqueta al lado,
      # que es como el entregable aprobado explica los cuatro grados. Sin esto
      # la lamina de escala solo podia llevar texto.
      # Directo y no con `.style_value()`: ese accesor devuelve `out[[1]]` y
      # trunca cualquier vector a su primer elemento, asi que los cuatro colores
      # de la rampa llegaban como uno.
      fills_fila <- style[["first_col_fill_by_row"]]
      if (!is.null(fills_fila)) {
        fills_fila <- as.character(unlist(fills_fila))
        for (r in seq_len(min(length(fills_fila), nrow(tbl)))) {
          if (!nzchar(fills_fila[[r]]) || is.na(fills_fila[[r]])) next
          ft <- flextable::bg(ft, i = r, j = 1, bg = fills_fila[[r]], part = "body")
        }
      }
      ft <- flextable::align(ft, j = 1, align = "center", part = "body")
      ft <- flextable::align(ft, j = 2, align = "left", part = "body")
      ft <- flextable::valign(ft, valign = "center", part = "body")
      ft <- flextable::padding(
        ft,
        padding.top = pad_v,
        padding.bottom = pad_v,
        padding.left = pad_h,
        padding.right = pad_h,
        part = "body"
      )
      ft <- flextable::line_spacing(ft, space = 1.00, part = "body")
      ft <- flextable::height(ft, i = seq_len(nrow(tbl)), height = row_heights, part = "body")
      ft <- flextable::hrule(ft, rule = "atleast", part = "body")
      ft <- flextable::border_remove(ft)
      ft <- flextable::border_outer(ft, border = border, part = "body")
      ft <- flextable::border_inner_h(ft, border = border, part = "body")
      ft <- flextable::border_inner_v(ft, border = border, part = "body")
      return(flextable::fix_border_issues(ft))
    }

    # --- Matrix mode (N columnas) -------------------------------------------
    n_rows <- nrow(tbl)
    n_cols <- ncol(tbl)
    header_fill <- as.character(.style_value(style, "header_fill", first_col_fill))[1]
    total_row_fill <- as.character(.style_value(style, "total_row_fill", first_col_fill))[1]
    has_total_row <- isTRUE(.style_value(style, "total_row", FALSE))
    matrix_first_col_pct <- .style_num(style, "matrix_first_col_pct", first_col_pct, min = 0.10, max = 0.45)
    matrix_body_size <- .style_num(style, "matrix_body_size", body_size, min = 6)

    first_w <- table_width * matrix_first_col_pct
    other_w <- (table_width - first_w) / max(1L, n_cols - 1L)

    min_row_height <- .style_num(style, "min_row_height", 0.36, min = 0.22)
    row_h <- max(min_row_height, table_height / max(1L, n_rows))

    ft <- flextable::flextable(tbl)
    ft <- flextable::set_table_properties(ft, layout = "fixed")
    ft <- flextable::font(ft, fontname = font_family, part = "all")
    ft <- flextable::color(ft, color = text_color, part = "all")
    ft <- flextable::fontsize(ft, size = matrix_body_size, part = "all")
    ft <- flextable::bold(ft, bold = TRUE, part = "header")
    ft <- flextable::bold(ft, j = 1, bold = TRUE, part = "body")
    ft <- flextable::bg(ft, bg = header_fill, part = "header")
    ft <- flextable::bg(ft, j = 1, bg = first_col_fill, part = "body")
    if (n_cols >= 2L) {
      ft <- flextable::bg(ft, j = seq(2L, n_cols), bg = body_fill, part = "body")
    }
    if (has_total_row && n_rows >= 1L) {
      ft <- flextable::bg(ft, i = n_rows, bg = total_row_fill, part = "body")
      ft <- flextable::bold(ft, i = n_rows, bold = TRUE, part = "body")
    }
    ft <- flextable::width(ft, j = 1, width = first_w)
    if (n_cols >= 2L) {
      ft <- flextable::width(ft, j = seq(2L, n_cols), width = other_w)
    }
    ft <- flextable::align(ft, j = 1, align = "left", part = "body")
    if (n_cols >= 2L) {
      ft <- flextable::align(ft, j = seq(2L, n_cols), align = "center", part = "body")
    }
    ft <- flextable::align(ft, align = "center", part = "header")
    ft <- flextable::valign(ft, valign = "center", part = "all")
    ft <- flextable::padding(
      ft,
      padding.top = pad_v,
      padding.bottom = pad_v,
      padding.left = pad_h,
      padding.right = pad_h,
      part = "all"
    )
    ft <- flextable::line_spacing(ft, space = 1.05, part = "all")
    ft <- flextable::height(ft, i = seq_len(n_rows), height = row_h, part = "body")
    ft <- flextable::hrule(ft, rule = "atleast", part = "body")
    ft <- flextable::border_remove(ft)
    ft <- flextable::border_outer(ft, border = border, part = "body")
    ft <- flextable::border_inner_h(ft, border = border, part = "body")
    ft <- flextable::border_inner_v(ft, border = border, part = "body")
    ft <- flextable::border_outer(ft, border = border, part = "header")
    ft <- flextable::border_inner_h(ft, border = border, part = "header")
    ft <- flextable::border_inner_v(ft, border = border, part = "header")
    flextable::fix_border_issues(ft)
  }

  .indice_clean_vec <- function(x) {
    if (is.null(x)) return(character(0))
    if (is.data.frame(x)) {
      if (!ncol(x) || !nrow(x)) return(character(0))
      x <- x[[1]]
    } else if (is.list(x)) {
      x <- unlist(x, recursive = TRUE, use.names = FALSE)
    }
    x <- as.character(x)
    x <- x[!is.na(x)]
    x <- unlist(strsplit(x, "\\r?\\n", perl = TRUE), use.names = FALSE)
    x <- trimws(x)
    x[nzchar(x)]
  }

  .indice_subindices_df <- function(subindices = NULL, subtemas = NULL, secciones = character(0)) {
    clean <- function(x) {
      x <- as.character(x)
      x[is.na(x)] <- ""
      trimws(x)
    }

    last_section <- if (length(secciones)) tail(as.character(secciones), 1) else ""
    rows <- list()

    if (!is.null(subindices)) {
      if (is.data.frame(subindices)) {
        df <- as.data.frame(subindices, stringsAsFactors = FALSE, check.names = FALSE)
        if (ncol(df) >= 2L && nrow(df)) {
          names_low <- tolower(names(df))
          col_section <- match(TRUE, names_low %in% c("seccion", "section", "indice", "grupo"))
          col_item <- match(TRUE, names_low %in% c("subindice", "subtema", "tema", "item"))
          if (is.na(col_section)) col_section <- 1L
          if (is.na(col_item)) col_item <- 2L
          rows[[length(rows) + 1L]] <- data.frame(
            seccion = clean(df[[col_section]]),
            item = clean(df[[col_item]]),
            stringsAsFactors = FALSE
          )
        }
      } else if (is.list(subindices) && !is.data.frame(subindices)) {
        nm <- names(subindices)
        if (is.null(nm)) nm <- rep(last_section, length(subindices))
        for (i in seq_along(subindices)) {
          items <- .indice_clean_vec(subindices[[i]])
          if (!length(items)) next
          section <- clean(nm[[i]])
          if (!nzchar(section)) section <- last_section
          rows[[length(rows) + 1L]] <- data.frame(
            seccion = rep(section, length(items)),
            item = items,
            stringsAsFactors = FALSE
          )
        }
      } else {
        lines <- .indice_clean_vec(subindices)
        if (length(lines)) {
          parsed <- lapply(lines, function(line) {
            parts <- regexpr("\\s*[:|]\\s*", line, perl = TRUE)
            if (parts[[1]] > 0L) {
              start <- parts[[1]]
              len <- attr(parts, "match.length")[[1]]
              seccion <- substr(line, 1L, start - 1L)
              item <- substr(line, start + len, nchar(line))
            } else {
              seccion <- last_section
              item <- line
            }
            data.frame(
              seccion = clean(seccion),
              item = clean(item),
              stringsAsFactors = FALSE
            )
          })
          rows <- c(rows, parsed)
        }
      }
    }

    if (!length(rows)) {
      items <- .indice_clean_vec(subtemas)
      if (length(items)) {
        rows[[1L]] <- data.frame(
          seccion = rep(last_section, length(items)),
          item = items,
          stringsAsFactors = FALSE
        )
      }
    }

    if (!length(rows)) {
      return(data.frame(seccion = character(0), item = character(0), stringsAsFactors = FALSE))
    }
    out <- do.call(rbind, rows)
    out$seccion <- clean(out$seccion)
    out$item <- clean(out$item)
    out <- out[nzchar(out$item), , drop = FALSE]
    rownames(out) <- NULL
    out
  }

  .indice_section_key <- function(x) {
    x <- as.character(x)
    x[is.na(x)] <- ""
    x <- iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
    x <- tolower(trimws(x))
    gsub("\\s+", " ", x, perl = TRUE)
  }

  .indice_subtopic_number_labels <- function(subindices_df, secciones = character(0)) {
    if (!is.data.frame(subindices_df) || !nrow(subindices_df)) {
      return(character(0))
    }

    n <- nrow(subindices_df)
    labels <- rep(NA_character_, n)
    section_keys <- .indice_section_key(secciones)
    if (!length(section_keys)) return(labels)

    sub_keys <- .indice_section_key(subindices_df$seccion %||% rep("", n))
    counters <- integer(length(section_keys))
    for (idx in seq_len(n)) {
      section_idx <- match(sub_keys[[idx]], section_keys)
      if (is.na(section_idx)) next
      counters[[section_idx]] <- counters[[section_idx]] + 1L
      labels[[idx]] <- paste0(section_idx, ".", counters[[section_idx]])
    }
    labels
  }

  .make_indice_sections_flextable <- function(secciones, style, font_family_default, numeros = NULL) {
    if (!requireNamespace("flextable", quietly = TRUE)) {
      stop("Se requiere el paquete 'flextable' para renderizar `p_slide_indice` con contenido.", call. = FALSE)
    }

    tbl <- data.frame(
      numero = as.character(numeros %||% seq_along(secciones)),
      seccion = as.character(secciones),
      stringsAsFactors = FALSE
    )

    table_width <- .style_num(style, "table_width", 6.85, min = 3)
    number_width <- .style_num(style, "number_width", 0.52, min = 0.30, max = 0.90)
    # 0.543 in son los 1.38 cm que mide cada entrada del indice en el
    # entregable aprobado. Con 0.39 las cinco entradas salian a 1.19 cm de paso
    # contra los 1.71 del aprobado, y el indice se leia apretado.
    row_height <- .style_num(style, "row_height", 0.543, min = 0.24)
    font_family <- as.character(.style_value(style, "font_family", font_family_default))[1]
    number_fill <- as.character(.style_value(style, "number_fill", "#D8504F"))[1]
    section_fill <- as.character(.style_value(style, "section_fill", "#E7E7E7"))[1]
    text_color <- as.character(.style_value(style, "text_color", "#081F5C"))[1]
    number_size <- .style_num(style, "number_size", 14, min = 7)
    section_size <- .style_num(style, "section_size", 13, min = 7)
    row_gap_color <- as.character(.style_value(style, "row_gap_color", "#F2F2F2"))[1]

    ft <- flextable::flextable(tbl)
    ft <- flextable::delete_part(ft, part = "header")
    ft <- flextable::set_table_properties(ft, layout = "fixed")
    ft <- flextable::width(ft, j = 1, width = number_width)
    ft <- flextable::width(ft, j = 2, width = table_width - number_width)
    ft <- flextable::height(ft, i = seq_len(nrow(tbl)), height = row_height, part = "body")
    # `height()` sola es una sugerencia: flextable deja que la fila se encoja
    # hasta lo que pide su texto, y el indice salia a 1.19 cm por fila pidiendo
    # 1.38. Con la regla exacta el alto se respeta.
    ft <- flextable::hrule(ft, rule = "exact", part = "body")
    ft <- flextable::hrule(ft, rule = "exact", part = "body")
    ft <- flextable::font(ft, fontname = font_family, part = "all")
    ft <- flextable::fontsize(ft, j = 1, size = number_size, part = "body")
    ft <- flextable::fontsize(ft, j = 2, size = section_size, part = "body")
    ft <- flextable::bold(ft, bold = TRUE, part = "body")
    ft <- flextable::color(ft, j = 1, color = "#FFFFFF", part = "body")
    ft <- flextable::color(ft, j = 2, color = text_color, part = "body")
    ft <- flextable::bg(ft, j = 1, bg = number_fill, part = "body")
    ft <- flextable::bg(ft, j = 2, bg = section_fill, part = "body")
    ft <- flextable::align(ft, j = 1, align = "center", part = "body")
    ft <- flextable::align(ft, j = 2, align = "left", part = "body")
    ft <- flextable::valign(ft, valign = "center", part = "body")
    ft <- flextable::padding(
      ft,
      padding.top = 2,
      padding.bottom = 2,
      padding.left = 7,
      padding.right = 7,
      part = "body"
    )
    ft <- flextable::border_remove(ft)
    # El «hueco» entre entradas es un borde del color del fondo. 9.4 pt son los
    # 0.33 cm que separan un cuadro del siguiente en el aprobado (paso 1.71 cm
    # menos la entrada de 1.38); con 4 pt quedaban pegadas.
    row_gap_pt <- .style_num(style, "row_gap_pt", 9.4, min = 0, max = 24)
    row_gap <- officer::fp_border(color = row_gap_color, width = row_gap_pt)
    ft <- flextable::border_inner_h(ft, border = row_gap, part = "body")
    flextable::fix_border_issues(ft)
  }

  .make_indice_cover_flextable <- function(width, height, fill = "#F2F2F2") {
    if (!requireNamespace("flextable", quietly = TRUE)) {
      stop("Se requiere el paquete 'flextable' para renderizar `p_slide_indice` con contenido.", call. = FALSE)
    }
    ft <- flextable::flextable(data.frame(x = "", stringsAsFactors = FALSE))
    ft <- flextable::delete_part(ft, part = "header")
    ft <- flextable::set_table_properties(ft, layout = "fixed")
    ft <- flextable::width(ft, j = 1, width = width)
    ft <- flextable::height(ft, i = 1, height = height, part = "body")
    ft <- flextable::hrule(ft, rule = "exact", part = "body")
    ft <- flextable::bg(ft, bg = fill, part = "body")
    ft <- flextable::color(ft, color = fill, part = "body")
    ft <- flextable::padding(ft, padding.top = 0, padding.bottom = 0, padding.left = 0, padding.right = 0, part = "body")
    ft <- flextable::border_remove(ft)
    flextable::fix_border_issues(ft)
  }

  .indice_sanitize_fill <- function(fill, default = "#F2F2F2") {
    fill <- as.character(fill %||% default)[1]
    if (!grepl("^#[0-9A-Fa-f]{6}$", fill)) default else fill
  }

  .indice_cover_svg <- function(fill = "#F2F2F2") {
    fill <- .indice_sanitize_fill(fill)
    out <- tempfile("indice_cover_", fileext = ".svg")
    writeLines(
      sprintf(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="%s"/></svg>',
        fill
      ),
      con = out,
      useBytes = TRUE
    )
    out
  }

  .add_indice_cover <- function(doc, left, top, width, height, fill = "#F2F2F2", label = "Indice cover") {
    svg <- .indice_cover_svg(fill)
    officer::ph_with(
      doc,
      value = officer::external_img(src = svg, width = width, height = height, alt = label),
      location = officer::ph_location(
        left = left,
        top = top,
        width = width,
        height = height,
        newlabel = label
      )
    )
  }

  .indice_icon_cover_svg <- function(fill = "#F2F2F2") {
    fill <- .indice_sanitize_fill(fill)
    out <- tempfile("indice_icon_cover_", fileext = ".svg")
    writeLines(
      sprintf(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="50" ry="50" fill="%s"/></svg>',
        fill
      ),
      con = out,
      useBytes = TRUE
    )
    out
  }

  .add_indice_icon_cover <- function(doc, left, top, width, height, fill, label) {
    svg <- .indice_icon_cover_svg(fill)
    officer::ph_with(
      doc,
      value = officer::external_img(src = svg, width = width, height = height, alt = label),
      location = officer::ph_location(
        left = left,
        top = top,
        width = width,
        height = height,
        newlabel = label
      )
    )
  }

  .indice_icon_compuesto_svg <- function(icon_path, fill = "#F2F2F2", icon_scale = 0.66) {
    fill <- .indice_sanitize_fill(fill)
    icon_scale <- suppressWarnings(as.numeric(icon_scale)[1])
    if (!is.finite(icon_scale)) icon_scale <- 0.66
    icon_scale <- max(0.30, min(0.86, icon_scale))

    ext <- tolower(tools::file_ext(icon_path))
    mime <- switch(
      ext,
      "svg" = "image/svg+xml",
      "jpg" = "image/jpeg",
      "jpeg" = "image/jpeg",
      "image/png"
    )
    bin <- readBin(icon_path, what = "raw", n = file.info(icon_path)$size)
    encoded <- openssl::base64_encode(bin)
    icon_size <- 512 * icon_scale
    icon_xy <- (512 - icon_size) / 2

    out <- tempfile("indice_icon_compuesto_", fileext = ".svg")
    writeLines(
      c(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512">',
        sprintf('<circle cx="256" cy="256" r="256" fill="%s"/>', fill),
        sprintf(
          '<image x="%.2f" y="%.2f" width="%.2f" height="%.2f" preserveAspectRatio="xMidYMid meet" href="data:%s;base64,%s" xlink:href="data:%s;base64,%s"/>',
          icon_xy, icon_xy, icon_size, icon_size, mime, encoded, mime, encoded
        ),
        '</svg>'
      ),
      con = out,
      useBytes = TRUE
    )
    out
  }

  .indice_icon_compuesto_asset <- function(icon_path, fill = "#F2F2F2", icon_scale = 0.66) {
    svg <- .indice_icon_compuesto_svg(icon_path, fill = fill, icon_scale = icon_scale)
    if (!requireNamespace("rsvg", quietly = TRUE)) {
      return(svg)
    }
    out <- tempfile("indice_icon_compuesto_", fileext = ".png")
    rsvg::rsvg_png(svg, file = out, width = 1024, height = 1024)
    out
  }

  .indice_subtopic_badge_asset <- function(label, fill = "#D8504F", text_color = "#FFFFFF",
                                           font_family = "Arial") {
    fill <- .indice_sanitize_fill(fill, "#D8504F")
    text_color <- .indice_sanitize_fill(text_color, "#FFFFFF")
    label <- gsub("&", "&amp;", as.character(label %||% "")[1], fixed = TRUE)
    label <- gsub("<", "&lt;", label, fixed = TRUE)
    label <- gsub(">", "&gt;", label, fixed = TRUE)
    label <- gsub('"', "&quot;", label, fixed = TRUE)
    font_family <- gsub('"', "", as.character(font_family %||% "Arial")[1], fixed = TRUE)
    out <- tempfile("indice_subtopic_badge_", fileext = ".svg")
    writeLines(
      c(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="72" viewBox="0 0 160 72">',
        sprintf('<rect x="6" y="6" width="148" height="60" rx="18" fill="%s"/>', fill),
        sprintf('<text x="80" y="38" text-anchor="middle" dominant-baseline="middle" font-family="%s, Arial, sans-serif" font-size="28" font-weight="700" fill="%s">%s</text>',
                font_family, text_color, label),
        '</svg>'
      ),
      con = out,
      useBytes = TRUE
    )
    out
  }

  .indice_bullet_text <- function(label, bullet_color = "#081F5C", text_color = "#081F5C",
                                  font_family = "Arial", font_size = 10.5,
                                  marker = NULL, marker_style = c("bullet", "number", "none")) {
    marker_style <- match.arg(marker_style)
    marker_text <- switch(
      marker_style,
      bullet = "•  ",
      number = paste0(as.character(marker %||% ""), "  "),
      none = ""
    )
    text_run <- officer::ftext(as.character(label), prop = officer::fp_text(
      color = text_color,
      font.size = font_size,
      bold = marker_style == "number",
      font.family = font_family
    ))
    if (nzchar(marker_text)) {
      return(officer::fpar(
        officer::ftext(marker_text, prop = officer::fp_text(
          color = bullet_color,
          font.size = font_size,
          bold = TRUE,
          font.family = font_family
        )),
        text_run,
        fp_p = officer::fp_par(text.align = "left", line_spacing = 1.05)
      ))
    }
    officer::fpar(
      text_run,
      fp_p = officer::fp_par(text.align = "left", line_spacing = 1.05)
    )
  }

  .add_indice_subtopics <- function(doc, labels, style, font_family_default,
                                    anchor_left, anchor_top, anchor_width,
                                    number_labels = NULL) {
    labels <- .indice_clean_vec(labels)
    if (!length(labels)) return(doc)
    number_labels <- as.character(number_labels %||% character(0))
    if (!length(number_labels)) {
      number_labels <- rep(NA_character_, length(labels))
    } else {
      number_labels <- trimws(number_labels)
      empty_number_label <- is.na(number_labels) | !nzchar(number_labels)
      number_labels[empty_number_label] <- NA_character_
      length(number_labels) <- length(labels)
    }

    font_family <- as.character(.style_value(style, "font_family", font_family_default))[1]
    text_color <- as.character(.style_value(style, "subtopic_color", "#081F5C"))[1]
    bullet_color <- as.character(.style_value(style, "subtopic_bullet_color", text_color))[1]
    badge_fill <- as.character(.style_value(style, "subtopic_badge_fill", .style_value(style, "accent_color", "#D8504F")))[1]
    badge_text_color <- as.character(.style_value(style, "subtopic_badge_text_color", "#FFFFFF"))[1]
    font_size <- .style_num(style, "subtopic_size", 10.1, min = 6)
    marker_style <- as.character(.style_value(style, "subtopic_marker", "number_text"))[1]
    if (!marker_style %in% c("bullet", "number", "number_text", "none")) marker_style <- "number_text"
    cols <- as.integer(round(.style_num(style, "subtopic_cols", 2, min = 1, max = 3)))
    row_height <- .style_num(style, "subtopic_row_height", 0.26, min = 0.18)
    col_gap <- .style_num(style, "subtopic_col_gap", 0.34, min = 0.05, max = 1)
    badge_width <- .style_num(style, "subtopic_badge_width", 0.34, min = 0.18, max = 0.70)
    if (any(grepl("\\.", number_labels, fixed = FALSE), na.rm = TRUE)) {
      badge_width <- max(badge_width, 0.62)
    }
    badge_gap <- .style_num(style, "subtopic_badge_gap", 0.09, min = 0.02, max = 0.25)
    badge_height <- .style_num(
      style,
      "subtopic_badge_height",
      min(0.28, max(0.24, row_height * 0.45)),
      min = 0.12,
      max = 0.40
    )
    col_width <- (anchor_width - (cols - 1L) * col_gap) / cols
    rows <- ceiling(length(labels) / cols)

    number_for <- function(idx) {
      custom <- number_labels[[idx]]
      if (!is.na(custom) && nzchar(custom)) return(custom)
      if (isTRUE(.style_value(style, "subtopic_number_zero_pad", FALSE))) {
        sprintf("%02d", idx)
      } else {
        as.character(idx)
      }
    }

    if (isTRUE(.style_value(style, "subtopic_heading", TRUE))) {
      heading <- as.character(.style_value(style, "subtopic_heading_text", "Principales resultados"))[1]
      heading_size <- .style_num(style, "subtopic_heading_size", 10.9, min = 7)
      heading_color <- as.character(.style_value(style, "subtopic_heading_color", .style_value(style, "accent_color", text_color)))[1]
      heading_top <- anchor_top
      heading_value <- officer::fpar(
        officer::ftext(heading, prop = officer::fp_text(
          color = heading_color,
          font.size = heading_size,
          bold = TRUE,
          font.family = font_family
        )),
        fp_p = officer::fp_par(text.align = "left", line_spacing = 1.05)
      )
      doc <- officer::ph_with(
        doc,
        value = heading_value,
        location = officer::ph_location(
          left = anchor_left,
          top = heading_top,
          width = anchor_width,
          height = 0.20,
          newlabel = "Indice subtopics heading"
        )
      )
      anchor_top <- anchor_top + .style_num(style, "subtopic_heading_gap", 0.23, min = 0.08, max = 0.5)
    }

    for (idx in seq_along(labels)) {
      col <- ((idx - 1L) %/% rows) + 1L
      row <- ((idx - 1L) %% rows) + 1L
      left <- anchor_left + (col - 1L) * (col_width + col_gap)
      top <- anchor_top + (row - 1L) * row_height
      text_left <- left
      text_width <- col_width
      text_marker_style <- marker_style
      if (identical(marker_style, "number")) {
        number_label <- number_for(idx)
        badge_top <- top + max(0, (row_height - badge_height) / 2)
        doc <- officer::ph_with(
          doc,
          value = officer::external_img(
            src = .indice_subtopic_badge_asset(
              number_label,
              fill = badge_fill,
              text_color = badge_text_color,
              font_family = font_family
            ),
            width = badge_width,
            height = badge_height,
            alt = paste("Subindice", number_label)
          ),
          location = officer::ph_location(
            left = left,
            top = badge_top,
            width = badge_width,
            height = badge_height,
            newlabel = paste0("Indice subtopic badge ", idx)
          )
        )
        text_left <- left + badge_width + badge_gap
        text_width <- max(0.3, col_width - badge_width - badge_gap)
        text_marker_style <- "none"
      } else if (identical(marker_style, "number_text")) {
        number_label <- number_for(idx)
        number_value <- officer::fpar(
          officer::ftext(number_label, prop = officer::fp_text(
            color = badge_fill,
            font.size = .style_num(style, "subtopic_number_size", font_size, min = 6),
            bold = TRUE,
            font.family = font_family
          )),
          fp_p = officer::fp_par(text.align = "right", line_spacing = 1.05)
        )
        doc <- officer::ph_with(
          doc,
          value = number_value,
          location = officer::ph_location(
            left = left,
            top = top,
            width = badge_width,
            height = row_height + 0.04,
            newlabel = paste0("Indice subtopic number ", idx)
          )
        )
        text_left <- left + badge_width + badge_gap
        text_width <- max(0.3, col_width - badge_width - badge_gap)
        text_marker_style <- "none"
      }
      doc <- officer::ph_with(
        doc,
        value = .indice_bullet_text(
          labels[[idx]],
          bullet_color = bullet_color,
          text_color = text_color,
          font_family = font_family,
          font_size = font_size,
          marker = sprintf("%02d", idx),
          marker_style = if (identical(text_marker_style, "number_text")) "none" else text_marker_style
        ),
        location = officer::ph_location(
          left = text_left,
          top = top,
          width = text_width,
          height = row_height + 0.04,
          newlabel = paste0("Indice subtopic ", idx)
        )
      )
    }
    doc
  }

  .indice_subtopics_height <- function(labels, style) {
    labels <- .indice_clean_vec(labels)
    if (!length(labels)) return(0)

    cols <- as.integer(round(.style_num(style, "subtopic_cols", 2, min = 1, max = 3)))
    row_height <- .style_num(style, "subtopic_row_height", 0.26, min = 0.18)
    rows <- ceiling(length(labels) / cols)
    height <- rows * row_height + 0.04
    if (isTRUE(.style_value(style, "subtopic_heading", TRUE))) {
      height <- height +
        0.20 +
        .style_num(style, "subtopic_heading_gap", 0.23, min = 0.08, max = 0.5)
    }
    height
  }

  .indice_icon_dir <- function() {
    candidates <- c(
      system.file("ppt_assets/indice_icons", package = "prosecnurapp"),
      system.file("ppt_assets/indice_icons", package = "prosecnur"),
      file.path(getwd(), "api", "inst", "ppt_assets", "indice_icons"),
      file.path(getwd(), "inst", "ppt_assets", "indice_icons")
    )
    candidates <- candidates[nzchar(candidates)]
    hit <- candidates[dir.exists(candidates)][1]
    if (is.na(hit) || !nzchar(hit)) "" else normalizePath(hit, winslash = "/", mustWork = TRUE)
  }

  .indice_default_icon_names <- function() {
    c(
      "target-arrow",
      "clipboard-list",
      "circle-user-round",
      "chart-column",
      "artificial-intelligence"
    )
  }

  .indice_icon_values <- function(style) {
    icons <- style[["iconos_focos"]] %||%
      style[["icons_focos"]] %||%
      style[["indice_icons"]] %||%
      style[["indice_iconos"]] %||%
      NULL
    if (is.null(icons) || length(icons) == 0L) {
      return(.indice_default_icon_names())
    }
    if (is.character(icons) && length(icons) == 1L) {
      icons <- .indice_clean_vec(icons)
    } else if (is.list(icons) && !is.data.frame(icons)) {
      icons <- vapply(icons, function(x) {
        if (is.list(x)) {
          as.character(x$icono %||% x$icon %||% x$name %||% x$ruta %||% x$path %||% "")[1]
        } else {
          as.character(x)[1]
        }
      }, character(1))
    } else {
      icons <- as.character(icons)
    }
    defaults <- .indice_default_icon_names()
    out <- defaults
    n <- min(length(out), length(icons))
    if (n > 0L) {
      repl <- trimws(icons[seq_len(n)])
      keep <- nzchar(repl)
      out[seq_len(n)[keep]] <- repl[keep]
    }
    out
  }

  .resolve_indice_icon_path <- function(icon) {
    icon <- trimws(as.character(icon %||% "")[1])
    if (!nzchar(icon)) return("")
    if (tolower(icon) %in% c("none", "plantilla", "template", "sin_icono", "sin-icono")) return("")
    if (file.exists(icon)) return(normalizePath(icon, winslash = "/", mustWork = TRUE))
    icon_base <- sub("\\.(svg|png|jpg|jpeg)$", "", basename(icon), ignore.case = TRUE)
    icon_dir <- .indice_icon_dir()
    if (!nzchar(icon_dir)) return("")
    candidates <- file.path(icon_dir, paste0(icon_base, c(".png", ".svg", ".jpg", ".jpeg")))
    hit <- candidates[file.exists(candidates)][1]
    if (is.na(hit) || !nzchar(hit)) "" else normalizePath(hit, winslash = "/", mustWork = TRUE)
  }

  .indice_parse_numeric_vec <- function(x) {
    if (is.null(x) || length(x) == 0L) return(NULL)
    if (is.character(x) && length(x) == 1L) {
      x <- unlist(strsplit(x, "[,;|\\r\\n\\t ]+", perl = TRUE), use.names = FALSE)
    }
    out <- suppressWarnings(as.numeric(x))
    out <- out[is.finite(out)]
    if (!length(out)) NULL else out
  }

  .indice_recycle_focus_vec <- function(x, n = 5L) {
    if (is.null(x)) return(NULL)
    if (length(x) == 1L) rep(x, n) else x
  }

  .indice_cm_to_in_vec <- function(x, recycle = FALSE) {
    out <- .indice_parse_numeric_vec(x)
    if (is.null(out)) return(NULL)
    out <- out / 2.54
    if (isTRUE(recycle)) out <- .indice_recycle_focus_vec(out)
    out
  }

  .style_num_vec <- function(style, name, default) {
    raw <- style[[name]]
    if (is.null(raw) || length(raw) == 0L) return(default)
    out <- suppressWarnings(as.numeric(raw))
    if (length(out) < length(default)) out <- c(out, default[(length(out) + 1L):length(default)])
    out <- out[seq_along(default)]
    out[!is.finite(out)] <- default[!is.finite(out)]
    out
  }

  .indice_bulbs_base_svg <- function(style) {
    background_fill <- .indice_sanitize_fill(.style_value(style, "background_fill", "#F2F2F2"))
    dark <- .indice_sanitize_fill(.style_value(style, "focos_cap_color", "#061B2A"), "#061B2A")
    fills <- as.character(style[["iconos_focos_fill"]] %||%
      c("#EFD25E", "#E4A34C", "#9688D3", "#7594CC", "#85BB85"))
    default_fills <- c("#EFD25E", "#E4A34C", "#9688D3", "#7594CC", "#85BB85")
    if (length(fills) < length(default_fills)) fills <- c(fills, default_fills[(length(fills) + 1L):length(default_fills)])
    fills <- vapply(seq_along(default_fills), function(i) .indice_sanitize_fill(fills[[i]], default_fills[[i]]), character(1))

    bulb_path <- function(cx, y, scale, fill) {
      neck <- 31 * scale
      side <- 64 * scale
      bottom <- 153 * scale
      sprintf(
        '<path d="M %.1f %.1f H %.1f C %.1f %.1f %.1f %.1f %.1f %.1f C %.1f %.1f %.1f %.1f %.1f %.1f C %.1f %.1f %.1f %.1f %.1f %.1f C %.1f %.1f %.1f %.1f %.1f %.1f Z" fill="%s"/>',
        cx - neck, y, cx + neck,
        cx + neck, y + 24 * scale, cx + side, y + 45 * scale, cx + side, y + 86 * scale,
        cx + side, y + 127 * scale, cx + 30 * scale, y + bottom, cx, y + bottom,
        cx - 30 * scale, y + bottom, cx - side, y + 127 * scale, cx - side, y + 86 * scale,
        cx - side, y + 45 * scale, cx - neck, y + 24 * scale, cx - neck, y,
        fill
      )
    }
    cap <- function(cx, y, w, h) {
      sprintf('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="15" fill="%s"/>', cx - w / 2, y, w, h, dark)
    }
    cord <- function(x, y1, y2) {
      sprintf('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="8" stroke-linecap="round"/>', x, y1, x, y2, dark)
    }

    parts <- c(
      cord(112, -12, 180),
      bulb_path(112, 218, 1.02, fills[[1]]),
      cap(112, 176, 66, 43),
      cord(270, -12, 180),
      bulb_path(270, 220, 1.00, fills[[2]]),
      cap(270, 176, 66, 43),
      cord(196, -12, 404),
      bulb_path(196, 444, 0.96, fills[[3]]),
      cap(196, 402, 66, 43),
      cord(360, -12, 436),
      bulb_path(360, 478, 0.96, fills[[4]]),
      cap(360, 434, 66, 43),
      cord(492, -12, 224),
      bulb_path(492, 266, 0.91, fills[[5]]),
      cap(492, 222, 62, 43)
    )

    out <- tempfile("indice_bulbs_clean_", fileext = ".svg")
    writeLines(
      c(
        sprintf('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="720" viewBox="0 0 640 720">'),
        sprintf('<rect x="0" y="0" width="640" height="720" fill="%s"/>', background_fill),
        parts,
        '</svg>'
      ),
      con = out,
      useBytes = TRUE
    )
    out
  }

  .add_indice_bulbs_base <- function(doc, style) {
    svg <- .indice_bulbs_base_svg(style)
    left <- .style_num(style, "focos_panel_left", 0, min = 0)
    top <- .style_num(style, "focos_panel_top", 0, min = 0)
    width <- .style_num(style, "focos_panel_width", 6.40, min = 1)
    height <- .style_num(style, "focos_panel_height", 7.20, min = 1)
    officer::ph_with(
      doc,
      value = officer::external_img(src = svg, width = width, height = height, alt = "Indice bulbs"),
      location = officer::ph_location(
        left = left,
        top = top,
        width = width,
        height = height,
        newlabel = "Indice clean bulbs"
      )
    )
  }

  .add_indice_bulb_icons <- function(doc, style) {
    if (!isTRUE(.style_value(style, "mostrar_iconos_focos", TRUE))) return(doc)

    cm_to_in <- function(x) x / 2.54
    defaults <- data.frame(
      left = cm_to_in(c(1.85, 6.28, 11.63, 4.32, 8.67)),
      top = cm_to_in(c(6.68, 6.68, 7.52, 11.07, 11.56)),
      width = rep(cm_to_in(2.18), 5),
      height = rep(cm_to_in(2.18), 5),
      fill = c("#EFD25E", "#E4A34C", "#85BB85", "#9688D3", "#7594CC"),
      stringsAsFactors = FALSE
    )
    icons <- .indice_icon_values(style)
    defaults$icon <- icons[seq_len(nrow(defaults))]
    defaults$width <- .style_num_vec(style, "iconos_focos_width", defaults$width)
    defaults$height <- .style_num_vec(style, "iconos_focos_height", defaults$height)
    fills <- style[["iconos_focos_fill"]] %||% defaults$fill
    fills <- as.character(fills)
    if (length(fills) < nrow(defaults)) fills <- c(fills, defaults$fill[(length(fills) + 1L):nrow(defaults)])
    defaults$fill <- vapply(seq_len(nrow(defaults)), function(k) .indice_sanitize_fill(fills[[k]], defaults$fill[[k]]), character(1))
    cover_left <- defaults$left
    cover_top <- defaults$top
    cover_width <- .style_num_vec(style, "iconos_focos_cover_width", defaults$width)
    cover_height <- .style_num_vec(style, "iconos_focos_cover_height", defaults$height)
    icon_scale <- .style_num_vec(style, "iconos_focos_icon_scale", rep(0.76, nrow(defaults)))
    usar_objeto_unico <- isTRUE(.style_value(style, "iconos_focos_objeto_unico", TRUE))
    redibujar_focos <- isTRUE(.style_value(style, "redibujar_focos", FALSE))
    if (redibujar_focos) {
      doc <- .add_indice_bulbs_base(doc, style)
    }

    for (idx in seq_len(nrow(defaults))) {
      icon_path <- .resolve_indice_icon_path(defaults$icon[[idx]])
      if (!nzchar(icon_path)) next
      if (usar_objeto_unico) {
        icon_compuesto <- .indice_icon_compuesto_asset(
          icon_path = icon_path,
          fill = defaults$fill[[idx]],
          icon_scale = icon_scale[[idx]]
        )
        doc <- officer::ph_with(
          doc,
          value = officer::external_img(
            src = icon_compuesto,
            width = cover_width[[idx]],
            height = cover_height[[idx]],
            alt = paste("Indice icon", idx)
          ),
          location = officer::ph_location(
            left = cover_left[[idx]],
            top = cover_top[[idx]],
            width = cover_width[[idx]],
            height = cover_height[[idx]],
            newlabel = paste0("Indice bulb icon ", idx)
          )
        )
        next
      }
      if (!redibujar_focos && isTRUE(.style_value(style, "limpiar_iconos_focos", TRUE))) {
        doc <- .add_indice_icon_cover(
          doc,
          left = cover_left[[idx]],
          top = cover_top[[idx]],
          width = cover_width[[idx]],
          height = cover_height[[idx]],
          fill = defaults$fill[[idx]],
          label = paste0("Indice bulb icon cover ", idx)
        )
      }
      doc <- officer::ph_with(
        doc,
        value = officer::external_img(
          src = icon_path,
          width = defaults$width[[idx]],
          height = defaults$height[[idx]],
          alt = paste("Indice icon", idx)
        ),
        location = officer::ph_location(
          left = defaults$left[[idx]],
          top = defaults$top[[idx]],
          width = defaults$width[[idx]],
          height = defaults$height[[idx]],
          newlabel = paste0("Indice bulb icon ", idx)
        )
      )
    }
    doc
  }

  .svg_text_escape <- function(x) {
    x <- as.character(x %||% "")[1]
    x <- gsub("&", "&amp;", x, fixed = TRUE)
    x <- gsub("<", "&lt;", x, fixed = TRUE)
    x <- gsub(">", "&gt;", x, fixed = TRUE)
    x <- gsub('"', "&quot;", x, fixed = TRUE)
    x
  }

  # Extremo negativo NARANJA, no rojo (regla R4). Ver `reporte_ppt_numero_respuestas.R`.
  .top_two_parse_colors <- function(style, n) {
    default <- c("#F4B183", "#FFD966", "#B7D7A8", "#70AD47")
    raw <- style[["colores"]] %||% style[["colores_escala"]] %||% default
    if (is.list(raw) && !is.data.frame(raw)) {
      raw <- unlist(raw, recursive = TRUE, use.names = FALSE)
    }
    raw <- as.character(raw)
    if (length(raw) == 1L && grepl("[,;|\\n]", raw)) {
      raw <- unlist(strsplit(raw, "[,;|\\n]+"))
    }
    raw <- trimws(raw)
    raw <- raw[nzchar(raw)]
    if (!length(raw)) raw <- default
    # Interpolar, no reciclar: con n > 4 el reciclado repetia naranja/amarillo
    # en el extremo positivo (H18).
    raw <- if (length(raw) < n) grDevices::colorRampPalette(raw)(n) else raw[seq_len(n)]
    fallback <- if (n > length(default)) grDevices::colorRampPalette(default)(n) else rep(default, length.out = n)
    vapply(seq_len(n), function(i) .indice_sanitize_fill(raw[[i]], fallback[[i]]), character(1))
  }

  .top_two_box_svg <- function(valores, etiquetas, top_two_indices, extremo_izquierda, extremo_derecha, style) {
    valores <- suppressWarnings(as.numeric(valores))
    valores <- valores[is.finite(valores) & valores >= 0]
    if (!length(valores)) valores <- c(5, 5, 35, 55)
    etiquetas <- as.character(etiquetas %||% seq_along(valores))
    if (length(etiquetas) < length(valores)) etiquetas <- c(etiquetas, as.character((length(etiquetas) + 1L):length(valores)))
    etiquetas <- etiquetas[seq_along(valores)]
    total <- sum(valores)
    if (!is.finite(total) || total <= 0) {
      valores <- c(5, 5, 35, 55)
      total <- sum(valores)
    }
    valores_pct <- valores / total * 100
    top_two_indices <- suppressWarnings(as.integer(top_two_indices %||% tail(seq_along(valores), 2)))
    top_two_indices <- top_two_indices[top_two_indices >= 1L & top_two_indices <= length(valores)]
    if (!length(top_two_indices)) top_two_indices <- tail(seq_along(valores), min(2L, length(valores)))

    colors <- .top_two_parse_colors(style, length(valores))
    blue <- .indice_sanitize_fill(.style_value(style, "text_color", "#081F5C"), "#081F5C")
    accent <- .indice_sanitize_fill(.style_value(style, "accent_color", .style_value(style, "title_color", "#D8504F")), "#D8504F")
    brace_color <- .indice_sanitize_fill(.style_value(style, "brace_color", accent), accent)
    top_label_color <- .indice_sanitize_fill(.style_value(style, "top_label_color", accent), accent)
    label_color <- .indice_sanitize_fill(
      .style_value(style, "color_texto_porcentajes", .style_value(style, "svg_label_color", "#FFFFFF")),
      "#FFFFFF"
    )
    background <- .indice_sanitize_fill(.style_value(style, "background_fill", "#F2F2F2"), "#F2F2F2")

    style_num_any <- function(names, default) {
      for (nm in names) {
        val <- suppressWarnings(as.numeric(.style_value(style, nm, NA_real_))[1])
        if (is.finite(val)) return(val)
      }
      default
    }
    top_two_bar_height <- function(default = 70) {
      val <- style_num_any(c("svg_bar_height", "grosor_barra", "grosor_barras"), default)
      if (is.finite(val) && val > 0 && val <= 2.5) val <- val / 0.82 * default
      min(130, max(30, val))
    }
    top_two_label_size <- function(default = 21,
                                   names = c("svg_label_size", "size_texto_porcentajes", "size_texto_barras")) {
      val <- style_num_any(names, default)
      if (is.finite(val) && val > 0 && val <= 12) val <- val * 16 / 5.6
      min(42, max(8, val))
    }

    bar_x <- .style_num(style, "svg_bar_x", 160, min = 20)
    bar_y <- .style_num(style, "svg_bar_y", 68, min = 20)
    bar_w <- .style_num(style, "svg_bar_width", 650, min = 200)
    bar_h <- top_two_bar_height(82)
    label_size <- top_two_label_size(22)
    small_label_size <- top_two_label_size(
      16,
      c("svg_small_label_size", "size_texto_porcentajes_peq", "size_texto_barras_peq")
    )
    legend_size <- .style_num(style, "svg_legend_size", 20, min = 8)
    brace_pad <- .style_num(style, "margen_llave", .style_num(style, "svg_brace_pad", 4, min = 0, max = 24), min = 0, max = 24)
    arrow_width <- .style_num(style, "grosor_flecha", .style_num(style, "svg_arrow_width", 3.6, min = 1, max = 8), min = 1, max = 8)
    arrow_head <- .style_num(style, "svg_arrow_head", 12, min = 6, max = 24)
    arrow_y <- .style_num(style, "svg_arrow_y", 360, min = 300, max = 430)

    starts <- cumsum(c(0, head(valores_pct, -1))) / 100 * bar_w
    widths <- valores_pct / 100 * bar_w
    rects <- vapply(seq_along(valores), function(i) {
      x <- bar_x + starts[[i]]
      w <- widths[[i]]
      fs <- if (w < 45) small_label_size else label_size
      sprintf(
        '<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s"/><text x="%.2f" y="%.2f" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="%.1f" font-weight="700" fill="%s">%s%%</text>',
        x, bar_y, w, bar_h, colors[[i]],
        x + w / 2, bar_y + bar_h / 2,
        fs, label_color,
        round(valores[[i]])
      )
    }, character(1))

    top_start <- min(starts[top_two_indices])
    top_end <- max(starts[top_two_indices] + widths[top_two_indices])
    brace_x1 <- max(bar_x, bar_x + top_start - brace_pad)
    brace_x2 <- min(bar_x + bar_w, bar_x + top_end + brace_pad)
    brace_y <- bar_y + bar_h + 28
    brace_mid <- (brace_x1 + brace_x2) / 2
    top_sum <- sum(valores[top_two_indices])
    top_formula <- paste(paste0(round(valores[top_two_indices]), "%"), collapse = " + ")

    # Gap adaptativo + etiquetas a dos lineas (H18): reporte_plan_helpers.R.
    legends <- .top_two_legend_svg(
      etiquetas, colors, bar_x, bar_w, legend_size, blue, .svg_text_escape
    )

    left_lines <- strsplit(as.character(extremo_izquierda %||% ""), "\\n", fixed = FALSE)[[1]]
    right_lines <- strsplit(as.character(extremo_derecha %||% ""), "\\n", fixed = FALSE)[[1]]
    mk_multiline <- function(lines, x, y, anchor) {
      paste(vapply(seq_along(lines), function(i) {
        sprintf(
          '<text x="%.2f" y="%.2f" text-anchor="%s" font-family="Arial, sans-serif" font-size="22" fill="%s">%s</text>',
          x, y + (i - 1L) * 26, anchor, blue, .svg_text_escape(lines[[i]])
        )
      }, character(1)), collapse = "")
    }

    out <- tempfile("top_two_box_", fileext = ".svg")
    writeLines(
      c(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520">',
        sprintf('<rect x="0" y="0" width="1000" height="520" fill="%s"/>', background),
        rects,
        sprintf('<path d="M %.2f %.2f V %.2f H %.2f V %.2f" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
                brace_x1, brace_y - 14, brace_y + 6,
                brace_x2, brace_y - 14,
                brace_color),
        sprintf('<path d="M %.2f %.2f V %.2f" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round"/>',
                brace_mid, brace_y + 6, brace_y + 24, brace_color),
        sprintf('<text x="%.2f" y="%.2f" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="%s">TOP TWO BOX</text>', brace_mid, brace_y + 60, top_label_color),
        sprintf('<text x="%.2f" y="%.2f" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="%s">%s</text>', brace_mid, brace_y + 86, top_label_color, .svg_text_escape(top_formula)),
        sprintf('<text x="%.2f" y="%.2f" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="%s">%s%%</text>', brace_mid, brace_y + 112, top_label_color, round(top_sum)),
        mk_multiline(left_lines, bar_x + 55, 368, "middle"),
        mk_multiline(right_lines, bar_x + bar_w - 28, 368, "middle"),
        sprintf('<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="%s" stroke-width="%.2f" stroke-linecap="round"/>',
                bar_x + 150 + arrow_head, arrow_y,
                bar_x + bar_w - 105 - arrow_head, arrow_y,
                blue, arrow_width),
        sprintf('<polygon points="%.2f,%.2f %.2f,%.2f %.2f,%.2f" fill="%s"/>',
                bar_x + 150, arrow_y,
                bar_x + 150 + arrow_head, arrow_y - arrow_head * 0.62,
                bar_x + 150 + arrow_head, arrow_y + arrow_head * 0.62,
                blue),
        sprintf('<polygon points="%.2f,%.2f %.2f,%.2f %.2f,%.2f" fill="%s"/>',
                bar_x + bar_w - 105, arrow_y,
                bar_x + bar_w - 105 - arrow_head, arrow_y - arrow_head * 0.62,
                bar_x + bar_w - 105 - arrow_head, arrow_y + arrow_head * 0.62,
                blue),
        legends,
        '</svg>'
      ),
      con = out,
      useBytes = TRUE
    )
    out
  }

  .make_indice_subtopics_flextable <- function(subtemas, style, font_family_default) {
    if (!requireNamespace("flextable", quietly = TRUE)) {
      stop("Se requiere el paquete 'flextable' para renderizar `p_slide_indice` con contenido.", call. = FALSE)
    }

    n_cols <- .style_num(style, "subtopic_cols", 2, min = 1, max = 3)
    n_cols <- as.integer(round(n_cols))
    n_rows <- ceiling(length(subtemas) / n_cols)
    values <- rep("", n_rows * n_cols)
    values[seq_along(subtemas)] <- paste0("•  ", subtemas)
    tbl <- as.data.frame(
      matrix(values, nrow = n_rows, ncol = n_cols, byrow = FALSE),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
    names(tbl) <- paste0("col", seq_len(n_cols))

    table_width <- .style_num(style, "subtopic_width", 6.85, min = 3)
    row_height <- .style_num(style, "subtopic_row_height", 0.27, min = 0.18)
    font_family <- as.character(.style_value(style, "font_family", font_family_default))[1]
    text_color <- as.character(.style_value(style, "subtopic_color", "#081F5C"))[1]
    font_size <- .style_num(style, "subtopic_size", 10.6, min = 6)

    ft <- flextable::flextable(tbl)
    ft <- flextable::delete_part(ft, part = "header")
    ft <- flextable::set_table_properties(ft, layout = "fixed")
    ft <- flextable::font(ft, fontname = font_family, part = "all")
    ft <- flextable::fontsize(ft, size = font_size, part = "body")
    ft <- flextable::color(ft, color = text_color, part = "body")
    ft <- flextable::align(ft, align = "left", part = "body")
    ft <- flextable::valign(ft, valign = "top", part = "body")
    ft <- flextable::padding(
      ft,
      padding.top = 1,
      padding.bottom = 1,
      padding.left = 2,
      padding.right = 8,
      part = "body"
    )
    ft <- flextable::height(ft, i = seq_len(n_rows), height = row_height, part = "body")
    ft <- flextable::hrule(ft, rule = "atleast", part = "body")
    for (j in seq_len(n_cols)) {
      ft <- flextable::width(ft, j = j, width = table_width / n_cols)
    }
    ft <- flextable::border_remove(ft)
    flextable::fix_border_issues(ft)
  }

  # ---------------------------------------------------------------------------
  # 2) Helpers  -  Plan (recoleccion diapo_###)
  # ---------------------------------------------------------------------------
  .collect_diapos <- function(env, strict = FALSE) {
    nms <- ls(envir = env, all.names = TRUE)
    nms <- nms[grepl("^diapo_\\d{3}$", nms)]
    if (!length(nms)) return(list())

    ord <- order(as.integer(sub("^diapo_(\\d{3})$", "\\1", nms)))
    nms <- nms[ord]
    objs <- mget(nms, envir = env, inherits = FALSE)

    if (isTRUE(strict)) {
      ids <- as.integer(sub("^diapo_(\\d{3})$", "\\1", names(objs)))
      if (length(ids) > 1) {
        dif <- diff(ids)
        if (any(dif != 1L)) .plan_input_abort("strict_diapos=TRUE: los `diapo_###` no son consecutivos.")
      }
    }
    objs
  }

  # ---------------------------------------------------------------------------
  # 3) Helpers  -  Instrumento / tablas / titulos
  # ---------------------------------------------------------------------------
  .pretty_source_label <- function(source) {
    source <- as.character(source %||% "")[1]
    source <- gsub("_+", " ", trimws(source))
    if (!nzchar(source)) return(source)
    tools::toTitleCase(source)
  }

  .parse_ref_parts <- function(ref) {
    ref <- as.character(ref %||% NA_character_)[1]
    if (is.na(ref) || !nzchar(trimws(ref))) {
      return(list(source = NA_character_, var = NA_character_, qualified = FALSE, raw = ref))
    }
    ref <- trimws(ref)
    m <- regexec("^([^$]+)\\$(.+)$", ref, perl = TRUE)
    got <- regmatches(ref, m)[[1]]
    if (length(got) == 3L) {
      return(list(
        source = trimws(got[2]),
        var = trimws(got[3]),
        qualified = TRUE,
        raw = ref
      ))
    }
    list(source = NA_character_, var = ref, qualified = FALSE, raw = ref)
  }

  .resolve_source_name <- function(source = NULL, ref = NULL, arg_name = "var") {
    ref_info <- .parse_ref_parts(ref)
    candidates <- c(source, ref_info$source, default_source)
    candidates <- as.character(candidates)
    candidates <- candidates[!is.na(candidates)]
    candidates <- trimws(candidates)
    candidates <- candidates[nzchar(candidates)]
    src <- if (length(candidates)) candidates[1] else NA_character_

    if (is.na(src) || !nzchar(trimws(src))) {
      .plan_input_abort(
        "La referencia de `", arg_name, "` requiere prefijo `fuente$` porque `data` contiene varias fuentes."
      )
    }
    src <- trimws(src)

    if (!src %in% names(data_sources)) {
      .plan_input_abort("La fuente `", src, "` no existe en `data`.")
    }
    if (!src %in% names(instrument_sources)) {
      .plan_input_abort("La fuente `", src, "` no existe en `instrumento`.")
    }

    src
  }

  .source_ctx <- function(source) {
    src <- .resolve_source_name(source = source, ref = NULL, arg_name = "source")
    inst <- instrument_sources[[src]]
    surv <- inst$survey %||% NULL
    if (is.null(surv) || !"name" %in% names(surv)) {
      .plan_input_abort("`instrumento[['", src, "']]$survey` debe existir y contener al menos la columna `name`.")
    }
    list(
      source = src,
      data = data_sources[[src]],
      instrumento = inst,
      survey = surv,
      choices = inst$choices %||% inst$choices_raw %||% NULL,
      orders_list = inst$orders_list %||% NULL
    )
  }

  .resolve_ref <- function(ref, source = NULL, arg_name = "var") {
    ref_info <- .parse_ref_parts(ref)
    if (is.na(ref_info$var) || !nzchar(ref_info$var)) {
      .plan_input_abort("`", arg_name, "` debe ser character(1) no vacio.")
    }
    ctx <- .source_ctx(.resolve_source_name(source = source, ref = ref, arg_name = arg_name))
    ctx$var_requested <- ref_info$var
    ctx$var <- .reporte_plan_resolve_recod_var(ref_info$var, ctx$data)
    ctx$recod_redirected <- !identical(ctx$var, ctx$var_requested)
    ctx$qualified <- isTRUE(ref_info$qualified)
    ctx$raw_ref <- ref_info$raw
    ctx
  }

  .extract_ref_values <- function(x) {
    if (is.null(x)) return(character(0))
    if (is.character(x)) return(x)
    if (is.list(x)) {
      return(unlist(lapply(x, .extract_ref_values), use.names = FALSE))
    }
    character(0)
  }

  .element_var_label <- function(el) {
    if (!inherits(el, "ppt_element")) return(NA_character_)
    ref <- el$var %||% el$vars %||% NULL
    out <- .fmt_vars(ref)
    if (identical(out, "<sin vars>")) NA_character_ else out
  }

  .named_lookup <- function(x, key, default = NULL) {
    key <- as.character(key %||% NA_character_)[1]
    if (is.null(x) || is.na(key) || !nzchar(trimws(key))) return(default)
    nms <- names(x)
    if (is.null(nms)) return(default)
    nms <- trimws(as.character(nms))
    idx <- which(nms == trimws(key))
    if (!length(idx)) return(default)
    x[[idx[1]]]
  }

  .single_source_for_refs <- function(refs,
                                      source = NULL,
                                      arg_name = "var") {
    refs <- .extract_ref_values(refs)
    if (!length(refs)) {
      return(.resolve_source_name(source = source, ref = NULL, arg_name = arg_name))
    }
    srcs <- unique(vapply(refs, function(ref) {
      .resolve_ref(ref, source = source, arg_name = arg_name)$source
    }, character(1)))
    if (length(srcs) != 1L) {
      .plan_input_abort("Las referencias de `", arg_name, "` deben pertenecer a una sola fuente en este grafico.")
    }
    srcs[1]
  }

  .element_source <- function(el, allow_multi = FALSE) {
    explicit_source <- as.character(el$source %||% NA_character_)[1]
    if (is.na(explicit_source) || !nzchar(trimws(explicit_source))) explicit_source <- NULL
    refs <- c(
      .extract_ref_values(el$var %||% NULL),
      .extract_ref_values(el$vars %||% NULL),
      .extract_ref_values(el$cruces %||% NULL),
      .extract_ref_values(el$cruce %||% NULL),
      .extract_ref_values(el$iter_var %||% NULL)
    )
    refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
    if (!length(refs)) {
      return(if (isTRUE(allow_multi)) character(0) else .resolve_source_name(source = explicit_source, ref = NULL, arg_name = "var"))
    }
    srcs <- unique(vapply(refs, function(ref) {
      .resolve_ref(ref, source = explicit_source, arg_name = "var")$source
    }, character(1)))
    if (!allow_multi && length(srcs) != 1L) {
      .plan_input_abort("El elemento usa variables de varias fuentes; este renderer requiere una sola.")
    }
    srcs
  }

  .list_name_from_ctx <- function(ctx) {
    surv <- ctx$survey
    var <- ctx$var
    if ("list_name" %in% names(surv)) {
      idx <- !is.na(surv$name) & surv$name == var
      x <- surv$list_name[idx]
      x <- x[!is.na(x) & nzchar(x)]
      if (length(x)) return(x[1])
    }
    if ("list_norm" %in% names(surv)) {
      idx <- !is.na(surv$name) & surv$name == var
      x <- surv$list_norm[idx]
      x <- x[!is.na(x) & nzchar(x)]
      if (length(x)) return(x[1])
    }
    NA_character_
  }

  .exclusion_for_choices <- function(list_name, choices_use, excluir_opciones) {
    excluir_opciones <- .reporte_plan_excluir_opciones(excluir_opciones)
    if (!length(excluir_opciones)) return(NULL)

    levels <- .reporte_plan_choice_levels_for_list(list_name, choices_use)
    if (!nrow(levels)) return(excluir_opciones)

    blocked <- .reporte_plan_norm_option_alias(excluir_opciones)
    hit <- .reporte_plan_norm_option_alias(levels$label) %in% blocked |
      .reporte_plan_norm_option_alias(levels$code) %in% blocked

    .reporte_plan_excluir_opciones(
      excluir_opciones,
      levels$code[hit],
      levels$label[hit]
    )
  }

  .exclusion_for_ctx <- function(ctx, excluir_opciones) {
    .exclusion_for_choices(.list_name_from_ctx(ctx), ctx$choices, excluir_opciones)
  }

  .list_name_of_var <- function(var, source = NULL) {
    .list_name_from_ctx(.resolve_ref(var, source = source, arg_name = "var"))
  }

  .choices_label_col <- function(choices_tbl) {
    .reporte_plan_choice_label_col(choices_tbl)
  }

  .choice_signature_from_ctx <- function(ctx) {
    ln <- .list_name_from_ctx(ctx)
    ch <- ctx$choices
    if (is.null(ch) || !is.data.frame(ch) || !nzchar(ln) ||
        !("list_name" %in% names(ch)) || !("name" %in% names(ch))) {
      return(NA_character_)
    }
    lab_col <- .choices_label_col(ch)
    sub <- ch[ch$list_name == ln, , drop = FALSE]
    if (!nrow(sub)) return(NA_character_)
    labels <- if (!is.na(lab_col) && lab_col %in% names(sub)) sub[[lab_col]] else sub$name
    labels <- as.character(labels)
    labels[is.na(labels)] <- ""
    codes <- as.character(sub$name)
    codes[is.na(codes)] <- ""
    paste(paste(codes, labels, sep = "="), collapse = "|")
  }

  # B42/G-20: en multibase cada instrumento nombra sus listas distinto y las
  # etiquetas divergen en detalles sin significado (mayusculas: "En
  # desacuerdo" vs "En Desacuerdo") o en la presencia de la categoria
  # residual SIN INF. Comparar la firma EXACTA rechazaba escalas
  # semanticamente identicas y el "comparar publicos por tema" moria en
  # "Sin datos". La equivalencia se decide en tres pasadas: exacta →
  # normalizada (trim/minusculas/sin acentos) → normalizada sin categorias
  # especiales (SIN INF y familia 90/94-99 del estandar de la casa).
  .norm_label_scale <- function(x) {
    x <- tolower(trimws(as.character(x)))
    x <- iconv(x, from = "UTF-8", to = "ASCII//TRANSLIT")
    x[is.na(x)] <- ""
    gsub("[^a-z0-9]+", " ", x)
  }

  .es_categoria_especial <- function(codes, labels) {
    codes_chr <- trimws(as.character(codes))
    lab_norm <- .norm_label_scale(labels)
    codes_chr %in% c("90", "94", "95", "96", "97", "98", "99") |
      lab_norm %in% c("sin inf", "sin informacion", "ns nr", "no sabe",
                      "no responde", "no sabe no responde", "no aplica",
                      "no precisa")
  }

  .choice_signature_from_ctx_norm <- function(ctx, sin_especiales = FALSE) {
    ln <- .list_name_from_ctx(ctx)
    ch <- ctx$choices
    if (is.na(ln) || !nzchar(ln) || is.null(ch) || !is.data.frame(ch) ||
        !("list_name" %in% names(ch)) || !("name" %in% names(ch))) {
      return(NA_character_)
    }
    lab_col <- .choices_label_col(ch)
    sub <- ch[ch$list_name == ln, , drop = FALSE]
    if (!nrow(sub)) return(NA_character_)
    labels <- if (!is.na(lab_col) && lab_col %in% names(sub)) sub[[lab_col]] else sub$name
    codes <- trimws(as.character(sub$name))
    if (isTRUE(sin_especiales)) {
      keep <- !.es_categoria_especial(codes, labels)
      codes <- codes[keep]
      labels <- labels[keep]
    }
    if (!length(codes)) return(NA_character_)
    paste(paste(codes, .norm_label_scale(labels), sep = "="), collapse = "|")
  }

  .shared_scale_spec <- function(ctxs, arg_name = "vars") {
    lns <- vapply(ctxs, .list_name_from_ctx, character(1))
    lns_nonempty <- unique(lns[!is.na(lns) & nzchar(lns)])
    if (length(lns_nonempty) == 1L) {
      choices_use <- NULL
      for (ctx_tmp in ctxs) {
        if (!is.null(ctx_tmp$choices) && is.data.frame(ctx_tmp$choices)) {
          choices_use <- ctx_tmp$choices
          break
        }
      }
      return(list(
        list_name = lns_nonempty[1],
        choices = choices_use,
        equivalent = FALSE
      ))
    }

    sigs <- vapply(ctxs, .choice_signature_from_ctx, character(1))
    sigs_nonempty <- unique(sigs[!is.na(sigs) & nzchar(sigs)])
    if (length(sigs_nonempty) == 1L) {
      idx <- which(!is.na(sigs) & nzchar(sigs))[1]
      return(list(
        list_name = lns[idx] %||% NA_character_,
        choices = ctxs[[idx]]$choices %||% NULL,
        equivalent = TRUE
      ))
    }

    for (sin_especiales in c(FALSE, TRUE)) {
      sigs_n <- vapply(ctxs, .choice_signature_from_ctx_norm, character(1),
                       sin_especiales = sin_especiales)
      sigs_n_nonempty <- unique(sigs_n[!is.na(sigs_n) & nzchar(sigs_n)])
      if (length(sigs_n_nonempty) == 1L) {
        idx <- which(!is.na(sigs_n) & nzchar(sigs_n))[1]
        return(list(
          list_name = lns[idx] %||% NA_character_,
          choices = ctxs[[idx]]$choices %||% NULL,
          equivalent = TRUE
        ))
      }
    }

    stop(
      "multiapiladas (modo='", arg_name, "'): las referencias no comparten una escala compatible. ",
      "Listas encontradas: ", paste(lns_nonempty, collapse = " | "),
      call. = FALSE
    )
  }


  # B42/G-20b: con escala equivalente por firma, las etiquetas crudas de cada
  # fuente ("De acuerdo" vs "De Acuerdo") deben fundirse en la etiqueta
  # canonica de la escala elegida. Sin esto, la union de opciones duplicaba
  # series y leyenda, y el top2box contaba solo la mitad de los actores.
  .canonizar_freq_a_escala <- function(tab, ctx, spec) {
    if (is.null(tab) || !nrow(tab) || !isTRUE(spec$equivalent)) return(tab)
    ch_canon <- spec$choices
    ln_canon <- spec$list_name
    if (is.null(ch_canon) || !is.data.frame(ch_canon) ||
        is.na(ln_canon) || !nzchar(ln_canon)) return(tab)
    ch_src <- ctx$choices
    ln_src <- .list_name_from_ctx(ctx)
    if (is.null(ch_src) || !is.data.frame(ch_src) ||
        is.na(ln_src) || !nzchar(ln_src)) return(tab)
    lab_col_src <- .choices_label_col(ch_src)
    lab_col_can <- .choices_label_col(ch_canon)
    sub_src <- ch_src[ch_src$list_name == ln_src, , drop = FALSE]
    sub_can <- ch_canon[ch_canon$list_name == ln_canon, , drop = FALSE]
    if (!nrow(sub_src) || !nrow(sub_can)) return(tab)
    labs_src <- as.character(if (!is.na(lab_col_src) && lab_col_src %in% names(sub_src)) sub_src[[lab_col_src]] else sub_src$name)
    labs_can <- as.character(if (!is.na(lab_col_can) && lab_col_can %in% names(sub_can)) sub_can[[lab_col_can]] else sub_can$name)
    codes_src <- trimws(as.character(sub_src$name))
    codes_can <- trimws(as.character(sub_can$name))
    canon_por_codigo <- stats::setNames(labs_can, codes_can)
    codigo_por_label_src <- stats::setNames(codes_src, labs_src)
    ops <- as.character(tab$Opciones)
    codes_of_ops <- unname(codigo_por_label_src[ops])
    mapped <- unname(canon_por_codigo[codes_of_ops])
    ok <- !is.na(mapped) & nzchar(mapped)
    ops[ok] <- mapped[ok]
    tab$Opciones <- ops
    tab
  }

  .title_of_var <- function(var, source = NULL) {
    ctx <- .resolve_ref(var, source = source, arg_name = "var")
    if (exists("titulo_var", mode = "function", inherits = TRUE)) {
      return(titulo_var(
        ctx$var,
        dic_vars        = ctx$survey,
        labels_override = NULL,
        orders_list     = ctx$orders_list,
        df              = ctx$data
      ))
    }
    ctx$var
  }

  .qualified_ref <- function(var, source) {
    info <- .parse_ref_parts(var)
    if (isTRUE(info$qualified)) return(info$raw)
    source <- as.character(source %||% "")[1]
    if (length(data_sources) > 1L && nzchar(trimws(source)) && !identical(source, "default")) {
      paste0(source, "$", info$var)
    } else {
      info$var
    }
  }

  .otros_norm <- function(x) .reporte_plan_norm_option_alias(x)

  .looks_like_otros_label <- function(x) {
    x <- .otros_norm(x)
    nzchar(x) & grepl("\\b(otro|otra|otros|otras|other)\\b", x, perl = TRUE)
  }

  # `.looks_like_otros_label()` hace un match de palabra suelta ("\botros\b")
  # pensado para etiquetas CORTAS de display (una barra, un bullet ya
  # resuelto). Para identificar la opcion catch-all "Otros" DENTRO de una
  # lista de choices, eso no alcanza: una categoria nombrada con una
  # descripcion larga puede mencionar la palabra de forma incidental (ej.
  # "...para reflejar mejor transporte, geotecnia... y otros campos
  # profesionales") sin ser el cajon catch-all. Exigimos ademas que el
  # termino aparezca cerca del inicio Y que la etiqueta completa sea breve
  # (las opciones "Otros" reales son cortas: "Otros", "Otro, especifique",
  # "Otra institucion:").
  .looks_like_otros_catchall_label <- function(x) {
    x_norm <- .otros_norm(x)
    is_hit <- nzchar(x_norm) & grepl("\\b(otro|otra|otros|otras|other)\\b", x_norm, perl = TRUE)
    words <- strsplit(trimws(x_norm), "\\s+", perl = TRUE)
    n_words <- vapply(words, length, integer(1))
    first_two <- vapply(words, function(w) paste(utils::head(w, 2), collapse = " "), character(1))
    near_start <- grepl("\\b(otro|otra|otros|otras|other)\\b", first_two, perl = TRUE)
    is_hit & near_start & (n_words <= 6)
  }

  .other_option_values <- function(ctx) {
    ln <- .list_name_from_ctx(ctx)
    levels <- .reporte_plan_choice_levels_for_list(ln, ctx$choices)
    if (!nrow(levels)) {
      return(data.frame(code = character(0), label = character(0), stringsAsFactors = FALSE))
    }
    hit <- .looks_like_otros_catchall_label(levels$label) | .looks_like_otros_catchall_label(levels$code)
    levels[hit, , drop = FALSE]
  }

  .other_text_candidates <- function(ctx_parent) {
    base_names <- unique(.reporte_plan_clean_chr(c(
      ctx_parent$var_requested,
      ctx_parent$var,
      sub("_recod$", "", ctx_parent$var)
    )))
    base_names <- base_names[nzchar(base_names)]
    suffixes <- c("_other", "_otros", "_otro", "_otra", "_specify", "_especifique", "_texto", "_text")
    suffixed <- unlist(lapply(base_names, function(base) {
      c(
        paste0(base, suffixes),
        paste0(base, ".", sub("^_", "", suffixes)),
        paste0(base, "/", sub("^_", "", suffixes))
      )
    }), use.names = FALSE)
    recod_bases <- unique(sub("_recod$", "", base_names[grepl("_recod$", base_names, ignore.case = TRUE)]))
    recod_bases <- recod_bases[nzchar(recod_bases)]
    unique(c(suffixed, recod_bases))
  }

  .nonblank_open_text <- function(x) {
    x <- .reporte_plan_clean_chr(x)
    !is.na(x) & nzchar(x)
  }

  .clean_open_text_for_nube <- function(x) {
    x <- .reporte_plan_clean_chr(x)
    x <- gsub("https?://\\S+|www\\.\\S+", " ", x, perl = TRUE, ignore.case = TRUE)
    x <- gsub("\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b", " ", x, perl = TRUE, ignore.case = TRUE)
    x <- gsub("\\+?\\d[\\d\\s().-]{6,}\\d", " ", x, perl = TRUE)
    x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
    x[is.na(x)] <- ""
    x <- tolower(x)
    x <- gsub("[^[:alpha:] ]+", " ", x, perl = TRUE)
    trimws(gsub("\\s+", " ", x, perl = TRUE))
  }

  .nonblank_open_text_for_nube <- function(x) {
    nzchar(.clean_open_text_for_nube(x))
  }

  .clean_other_response_bullet <- function(x) {
    x <- .reporte_plan_clean_chr(x)
    x <- gsub("[\r\n\t]+", " ", x, perl = TRUE)
    trimws(gsub("\\s+", " ", x, perl = TRUE))
  }

  .sentence_case_other_response <- function(x) {
    unname(vapply(
      as.character(x),
      function(s) {
        if (is.na(s)) return(NA_character_)
        s <- trimws(gsub("\\s+", " ", s, perl = TRUE))
        if (!nzchar(s)) return(s)
        chars <- strsplit(tolower(s), "", fixed = FALSE, useBytes = FALSE)[[1]]
        idx <- which(grepl("[[:alpha:]]", chars))[1]
        if (length(idx) && is.finite(idx) && !is.na(idx)) {
          chars[[idx]] <- toupper(chars[[idx]])
        }
        paste0(chars, collapse = "")
      },
      character(1)
    ))
  }

  .normalizar_other_response_mode <- function(modo = "ninguna") {
    if (is.null(modo)) modo <- "ninguna"
    modo <- as.character(modo)[1]
    if (is.na(modo) || !nzchar(trimws(modo))) modo <- "ninguna"
    modo <- tolower(trimws(modo))
    modo <- gsub("[ -]+", "_", modo)
    if (modo %in% c("sin_cambio", "original", "none", "no", "false")) modo <- "ninguna"
    if (modo %in% c("capital_inicial", "sentence_case", "oracion", "oración")) modo <- "mayuscula_inicial"
    if (!modo %in% c("ninguna", "mayuscula_inicial")) modo <- "ninguna"
    modo
  }

  .normalizar_other_response_bullets <- function(x, modo = "ninguna") {
    modo <- .normalizar_other_response_mode(modo)
    switch(
      modo,
      mayuscula_inicial = .sentence_case_other_response(x),
      x
    )
  }

  # Las variables select_multiple normalizadas viven como columnas dummy
  # "<var>.<codigo>" (una por opcion) — NUNCA como una columna "<var>" a
  # secas ni como "<var>/<codigo>" (convencion ODK cruda). Esto aplica
  # tanto a select_multiple nativas del XLSForm (ej. p19, p7) como a
  # variables recodificadas manualmente de texto libre a select_multiple
  # (ej. p35_recod, con 9 categorias). `.related_recod_var()` y las
  # funciones de mascara de abajo comparaban contra "<var>/<codigo>", que
  # nunca matchea nada en este formato — degenerando a comparar el TEXTO
  # LIBRE crudo contra la palabra "otros", lo que genera falsos positivos
  # cuando esa palabra aparece de forma natural en una respuesta larga
  # (ej. "...en otros rubros.").
  .reporte_plan_has_sm_dummy_cols <- function(dsrc, var) {
    var <- as.character(var %||% "")[1]
    if (is.na(var) || !nzchar(var)) return(FALSE)
    any(startsWith(names(dsrc), paste0(var, ".")))
  }

  .related_recod_var <- function(dsrc, ctx_parent, text_var) {
    if (grepl("_recod$", ctx_parent$var, ignore.case = TRUE) &&
        (ctx_parent$var %in% names(dsrc) || .reporte_plan_has_sm_dummy_cols(dsrc, ctx_parent$var))) {
      return(ctx_parent$var)
    }
    if (grepl("_recod$", ctx_parent$var_requested, ignore.case = TRUE) &&
        (ctx_parent$var_requested %in% names(dsrc) || .reporte_plan_has_sm_dummy_cols(dsrc, ctx_parent$var_requested))) {
      return(ctx_parent$var_requested)
    }

    candidates <- unique(.reporte_plan_clean_chr(c(
      if (!grepl("_recod$", ctx_parent$var, ignore.case = TRUE)) paste0(ctx_parent$var, "_recod"),
      if (!grepl("_recod$", ctx_parent$var_requested, ignore.case = TRUE)) paste0(ctx_parent$var_requested, "_recod"),
      sub("(_other|_otros|_otro|_otra|_specify|_especifique|_texto|_text)$", "_recod", text_var, ignore.case = TRUE, perl = TRUE)
    )))
    candidates <- candidates[nzchar(candidates) & candidates %in% names(dsrc)]
    candidates <- setdiff(candidates, ctx_parent$var)
    candidates[1] %||% NA_character_
  }

  .not_already_categorized_mask <- function(dsrc, ctx_parent, text_var) {
    recod_var <- .related_recod_var(dsrc, ctx_parent, text_var)
    if (is.na(recod_var) || !nzchar(recod_var)) return(rep(TRUE, nrow(dsrc)))

    is_marked_col <- function(col) {
      if (!col %in% names(dsrc)) return(rep(FALSE, nrow(dsrc)))
      x <- dsrc[[col]]
      !is.na(x) & as.character(x) %in% c("1", "TRUE", "true", "Si", "Sí", "si", "sí")
    }

    # select_multiple normalizado: solo existen columnas dummy
    # "<recod_var>.<codigo>", no una columna madre "<recod_var>" a secas.
    # "Ya categorizado" = marco alguna opcion NOMBRADA (cualquiera que no
    # sea la opcion catch-all "Otros" de su propia lista de choices) Y NO
    # tiene marcada la opcion "Otros" en si misma. En una select_multiple,
    # marcar una categoria nombrada y "Otros" a la vez es valido (dos
    # selecciones distintas del mismo respondiente) — si solo mirasemos
    # "any_named_marked" excluiriamos del detalle de texto libre a alguien
    # cuyo "Otros" sigue genuinamente marcado, solo porque tambien marco
    # otra opcion.
    if (!(recod_var %in% names(dsrc)) && .reporte_plan_has_sm_dummy_cols(dsrc, recod_var)) {
      ctx_recod <- tryCatch(.resolve_ref(recod_var, source = ctx_parent$source, arg_name = "recod"), error = function(e) NULL)
      other_values <- if (!is.null(ctx_recod)) .other_option_values(ctx_recod) else NULL
      other_codes <- .reporte_plan_clean_chr(other_values$code %||% character(0))
      other_codes <- other_codes[nzchar(other_codes)]
      other_dummy_cols <- paste0(recod_var, ".", other_codes)

      dummy_cols <- names(dsrc)[startsWith(names(dsrc), paste0(recod_var, "."))]
      named_dummy_cols <- setdiff(dummy_cols, other_dummy_cols)
      any_named_marked <- Reduce(`|`, lapply(named_dummy_cols, is_marked_col), rep(FALSE, nrow(dsrc)))
      any_otros_marked <- Reduce(`|`, lapply(other_dummy_cols, is_marked_col), rep(FALSE, nrow(dsrc)))
      return(!any_named_marked | any_otros_marked)
    }

    recod_raw <- .reporte_plan_clean_chr(dsrc[[recod_var]])
    recod_blank <- !nzchar(recod_raw)

    ctx_recod <- tryCatch(.resolve_ref(recod_var, source = ctx_parent$source, arg_name = "recod"), error = function(e) NULL)
    recod_other <- rep(FALSE, nrow(dsrc))
    if (!is.null(ctx_recod)) {
      other_values <- .other_option_values(ctx_recod)
      other_raw <- unique(.reporte_plan_clean_chr(c(other_values$code, other_values$label)))
      other_raw <- other_raw[nzchar(other_raw)]
      other_norm <- .otros_norm(other_raw)

      if (length(other_raw)) {
        recod_other <- recod_raw %in% other_raw | .otros_norm(recod_raw) %in% other_norm
        recod_split <- vapply(recod_raw, function(v) {
          parts <- unlist(strsplit(v, "[,;| ]+", perl = TRUE), use.names = FALSE)
          parts <- .reporte_plan_clean_chr(parts)
          parts <- parts[nzchar(parts)]
          any(parts %in% other_raw | .otros_norm(parts) %in% other_norm)
        }, logical(1))
        recod_other <- recod_other | recod_split

        codes <- .reporte_plan_clean_chr(other_values$code)
        codes <- codes[nzchar(codes)]
        for (code in codes) {
          recod_other <- recod_other | is_marked_col(paste0(recod_var, "/", code)) | is_marked_col(paste0(recod_var, ".", code))
        }
      }
    }

    recod_blank | recod_other
  }

  .parent_other_mask <- function(dsrc, ctx_parent, other_values, text_var = NULL) {
    if (!nrow(dsrc)) return(logical(0))

    masks <- list()
    if (nrow(other_values)) {
      direct_cols <- unique(.reporte_plan_clean_chr(c(
        ctx_parent$var,
        ctx_parent$var_requested,
        sub("_recod$", "", ctx_parent$var, ignore.case = TRUE, perl = TRUE),
        sub("_recod$", "", ctx_parent$var_requested, ignore.case = TRUE, perl = TRUE)
      )))
      # Si al despojar "_recod" el nombre coincide con la propia columna de
      # texto libre (caso de una variable recodificada desde cero a partir
      # de un "text" sin select_multiple nativo, ej. p35 -> p35_recod), esa
      # columna NO es una lista de codigos separados por delimitador: es
      # prosa libre. Compararla contra el codigo/etiqueta de "Otros" genera
      # falsos positivos cuando esa palabra aparece de forma natural en la
      # respuesta (ej. "...en otros rubros."). La excluimos de este chequeo
      # directo; el chequeo por columnas dummy de abajo sigue aplicando.
      if (!is.null(text_var) && nzchar(as.character(text_var)[1])) {
        direct_cols <- setdiff(direct_cols, as.character(text_var)[1])
      }
      direct_cols <- direct_cols[nzchar(direct_cols) & direct_cols %in% names(dsrc)]

      other_raw <- unique(.reporte_plan_clean_chr(c(other_values$code, other_values$label)))
      other_raw <- other_raw[nzchar(other_raw)]
      other_norm <- .otros_norm(other_raw)

      for (direct_col in direct_cols) {
        raw_vals <- .reporte_plan_clean_chr(dsrc[[direct_col]])
        direct <- raw_vals %in% other_raw | .otros_norm(raw_vals) %in% other_norm
        split_hit <- vapply(raw_vals, function(v) {
          parts <- unlist(strsplit(v, "[,;| ]+", perl = TRUE), use.names = FALSE)
          parts <- .reporte_plan_clean_chr(parts)
          parts <- parts[nzchar(parts)]
          any(parts %in% other_raw | .otros_norm(parts) %in% other_norm)
        }, logical(1))
        masks[[length(masks) + 1L]] <- direct | split_hit
      }
    }

    if (nrow(other_values)) {
      codes <- .reporte_plan_clean_chr(other_values$code)
      codes <- codes[nzchar(codes)]
      for (code in codes) {
        candidates <- c(
          paste0(ctx_parent$var_requested, "/", code),
          paste0(ctx_parent$var, "/", code),
          paste0(sub("_recod$", "", ctx_parent$var), "/", code),
          paste0(ctx_parent$var_requested, ".", code),
          paste0(ctx_parent$var, ".", code),
          paste0(sub("_recod$", "", ctx_parent$var), ".", code)
        )
        for (col in unique(candidates)) {
          if (!col %in% names(dsrc)) next
          x <- dsrc[[col]]
          masks[[length(masks) + 1L]] <- !is.na(x) & as.character(x) %in% c("1", "TRUE", "true", "Si", "Sí", "si", "sí")
        }
      }
    }

    if (!length(masks)) return(rep(FALSE, nrow(dsrc)))
    Reduce(`|`, masks)
  }

  .other_text_info_for_ref <- function(ref, filtros = list(), source = NULL, title_override = NULL) {
    ctx_parent <- tryCatch(.resolve_ref(ref, source = source, arg_name = "var"), error = function(e) NULL)
    if (is.null(ctx_parent)) return(NULL)

    other_values <- .other_option_values(ctx_parent)
    has_predefined_otros <- nrow(other_values) > 0

    dsrc <- tryCatch(.filter_data(filtros, source = ctx_parent$source), error = function(e) NULL)
    if (is.null(dsrc) || !nrow(dsrc)) return(NULL)

    candidates <- .other_text_candidates(ctx_parent)
    text_var <- candidates[candidates %in% names(dsrc)][1]
    if (is.na(text_var) || !nzchar(text_var)) return(NULL)

    text_raw <- .reporte_plan_clean_chr(dsrc[[text_var]])
    text_mask <- .nonblank_open_text(text_raw) & .nonblank_open_text_for_nube(text_raw)
    if (!any(text_mask)) return(NULL)

    if (!has_predefined_otros && !nzchar(as.character(.related_recod_var(dsrc, ctx_parent, text_var) %||% ""))) {
      return(NULL)
    }

    parent_mask <- if (has_predefined_otros) {
      .parent_other_mask(dsrc, ctx_parent, other_values, text_var = text_var)
    } else {
      rep(TRUE, nrow(dsrc))
    }
    if (length(parent_mask) != length(text_mask) || !any(parent_mask & text_mask)) return(NULL)
    text_mask <- text_mask & parent_mask

    text_mask <- text_mask & .not_already_categorized_mask(dsrc, ctx_parent, text_var)
    if (!any(text_mask)) return(NULL)

    respuestas <- .clean_other_response_bullet(text_raw[text_mask])
    respuestas <- respuestas[nzchar(respuestas)]
    if (!length(respuestas)) return(NULL)

    title <- .reporte_plan_clean_chr(title_override %||% "")
    title <- title[nzchar(title)]
    title <- if (length(title)) title[[1]] else NULL
    if (is.null(title)) {
      title <- tryCatch(.word_clean_inferred_title(.title_of_var(ref, source = ctx_parent$source)), error = function(e) NULL)
    }
    title <- title %||% ctx_parent$var_requested

    list(
      source = ctx_parent$source,
      parent_var = ctx_parent$var_requested,
      parent_ref = .qualified_ref(ctx_parent$var_requested, ctx_parent$source),
      text_var = text_var,
      text_ref = .qualified_ref(text_var, ctx_parent$source),
      title = title,
      filtros = filtros %||% list(),
      n = length(respuestas),
      respuestas = respuestas,
      base = .apply_base_format(paste0(
        format(as.integer(length(respuestas)), big.mark = ",", scientific = FALSE, trim = TRUE),
        " respuestas en Otros en la pregunta ", title
      ))
    )
  }

  .is_grouped_no_response_label <- function(x) {
    y <- iconv(as.character(x %||% ""), from = "", to = "ASCII//TRANSLIT")
    y <- tolower(trimws(y))
    y <- gsub("[^a-z]+", "", y, perl = TRUE)
    y %in% c(
      "prefieronoresponder",
      "prefierenoresponder",
      "noresponde",
      "noresponder",
      "norespondio",
      "norespondieron",
      "noquiereresponder",
      "noquierocontestar",
      "norespondioestaopcion",
      "nosabe",
      "nosabenoopina",
      "nosabenoopino",
      "nosabenoresponde",
      "nosabenocontesta",
      "nspnr",
      "nsnr",
      "nsnc",
      "noaplica",
      "noaplicable",
      "nocorresponde",
      "nohetrabajado",
      "nohatrabajado",
      "notrabajo",
      "notrabaja",
      "notrabaje",
      "notrabajoactualmente"
    )
  }

  .is_grouped_otros_final_label <- function(x) {
    .looks_like_otros_label(x) | .is_grouped_no_response_label(x)
  }

  .grouped_otros_info_for_element <- function(el) {
    if (is.null(el) || !inherits(el, "ppt_element")) return(NULL)
    if (!identical(el$.element_type %||% "", "barras_agrupadas")) return(NULL)

    var <- el$var %||% NULL
    if (is.null(var) || !nzchar(trimws(as.character(var)[1]))) return(NULL)

    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    if (!is.null(el$mostrar_ceros)) {
      overrides$mostrar_ceros <- isTRUE(el$mostrar_ceros)
    }

    preset_args <- presets$barras_agrupadas$args %||% list()
    merged_args <- .merge_args(preset_args, overrides)
    max_categorias_eff <- suppressWarnings(as.integer(merged_args$max_categorias)[1])
    if (!is.finite(max_categorias_eff) || is.na(max_categorias_eff) || max_categorias_eff < 2L) {
      return(NULL)
    }
    if (!isTRUE(merged_args$agrupar_resto_en_otros %||% TRUE)) return(NULL)

    ctx <- tryCatch(.resolve_ref(var, source = el$source %||% NULL, arg_name = "var"), error = function(e) NULL)
    if (is.null(ctx)) return(NULL)

    tab_raw <- tryCatch(.tab_freq(var, filtros = filtros, source = el$source %||% NULL), error = function(e) NULL)
    if (is.null(tab_raw) || !is.data.frame(tab_raw) || !nrow(tab_raw)) return(NULL)

    excluir_opciones <- .reporte_plan_excluir_cascada(preset_args, overrides, el)
    excluir_opciones <- .exclusion_for_ctx(ctx, excluir_opciones)

    mostrar_ceros <- .should_show_zero_options(
      var,
      tab = tab_raw,
      preset_args = preset_args,
      overrides = overrides,
      source = el$source %||% NULL,
      word_render = isTRUE(el$.word_render)
    )
    tab <- .reporte_plan_prepare_freq_options(tab_raw, incluir_sin_n = mostrar_ceros)
    tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
    if (is.null(tab) || !is.data.frame(tab) || !nrow(tab) || nrow(tab) <= max_categorias_eff) return(NULL)

    cat_vals <- as.character(tab$Opciones)
    n_vals <- suppressWarnings(as.numeric(tab$n))
    n_vals[!is.finite(n_vals) | is.na(n_vals)] <- 0

    idx_final_protegido <- which(.is_grouped_no_response_label(cat_vals))
    idx_no_final <- which(!.is_grouped_otros_final_label(cat_vals))
    keep_n <- max(0L, max_categorias_eff - length(idx_final_protegido) - 1L)

    idx_keep <- integer(0)
    if (length(idx_no_final) && keep_n > 0L) {
      idx_ord <- idx_no_final[order(-n_vals[idx_no_final], seq_along(idx_no_final))]
      idx_keep <- head(idx_ord, keep_n)
    }

    idx_resto <- setdiff(seq_len(nrow(tab)), c(idx_keep, idx_final_protegido))
    if (!length(idx_resto)) return(NULL)

    detalle <- tab[idx_resto, , drop = FALSE]
    detalle$n <- suppressWarnings(as.numeric(detalle$n))
    detalle <- detalle[is.finite(detalle$n) & !is.na(detalle$n) & detalle$n > 0, , drop = FALSE]
    if (!nrow(detalle)) return(NULL)

    # La categoria catch-all "Otro/Otros" ya recodificada NO se lista aqui
    # como un conteo agregado mas: su contenido real (lo que la persona
    # escribio) ya se muestra, con texto individual, en el detalle de
    # `.other_text_info_for_ref()` (kind = "open_text_otros"). Mostrarla
    # tambien aca duplicaria la misma informacion como un numero sin
    # texto, cuando lo que le importa al lector es justamente que
    # escribieron esos casos. Se detecta por el label ya mostrado (mismo
    # criterio que .is_grouped_otros_final_label() usa arriba para
    # excluir "Otros" del ranking de top-N), no por el label crudo del
    # choices sheet, porque este puede diferir del label que se termina
    # mostrando (ej. choices dice "Otra institucion:", pero el dato/chart
    # ya lo muestra acortado como "Otros").
    detalle <- detalle[!.looks_like_otros_label(as.character(detalle$Opciones)), , drop = FALSE]
    if (!nrow(detalle)) return(NULL)
    ln <- .list_name_from_ctx(ctx)
    detalle_labels <- .reporte_plan_labels_for_levels(ln, detalle$Opciones, ctx$choices)
    detalle_labels <- .reporte_plan_clean_chr(detalle_labels)
    detalle$Opciones[nzchar(detalle_labels)] <- detalle_labels[nzchar(detalle_labels)]
    detalle$Opciones <- .clean_other_response_bullet(detalle$Opciones)
    detalle <- detalle[nzchar(detalle$Opciones), , drop = FALSE]
    if (!nrow(detalle)) return(NULL)

    detalle <- detalle[order(-detalle$n, detalle$Opciones), , drop = FALSE]
    n_agrupado <- sum(detalle$n, na.rm = TRUE)
    if (!is.finite(n_agrupado) || n_agrupado <= 0) return(NULL)

    fmt_n <- function(x) format(as.integer(round(x)), big.mark = ",", scientific = FALSE, trim = TRUE)
    respuestas <- paste0(detalle$Opciones, " (", fmt_n(detalle$n), ")")

    title <- merged_args$titulo %||% el$title_slide %||% NULL
    if (is.null(title) || !nzchar(trimws(as.character(title)[1]))) {
      title <- tryCatch(.word_clean_inferred_title(.title_of_var(var, source = ctx$source)), error = function(e) NULL)
    }
    title <- title %||% ctx$var_requested

    list(
      source = ctx$source,
      parent_var = ctx$var_requested,
      parent_ref = .qualified_ref(ctx$var_requested, ctx$source),
      text_var = paste0(ctx$var_requested, "::agrupado_otros"),
      text_ref = paste0(.qualified_ref(ctx$var_requested, ctx$source), "::agrupado_otros"),
      title = as.character(title)[1],
      filtros = filtros %||% list(),
      n = length(respuestas),
      n_agrupado = n_agrupado,
      respuestas = respuestas,
      base = .apply_base_format(paste0(fmt_n(n_agrupado), " respuestas agrupadas en Otros en la pregunta ", as.character(title)[1])),
      kind = "grouped_otros"
    )
  }

  .slide_plot_elements <- function(x) {
    out <- list()
    walk <- function(obj) {
      if (inherits(obj, "ppt_element")) {
        out[[length(out) + 1L]] <<- obj
        return(invisible(NULL))
      }
      if (is.list(obj)) {
        for (item in obj) walk(item)
      }
      invisible(NULL)
    }
    walk(x$slots %||% x)
    out
  }

  .element_refs_for_otros <- function(el) {
    if (is.null(el) || !inherits(el, "ppt_element")) return(character(0))
    if (identical(el$.element_type %||% "", "nube_palabras")) return(character(0))
    if (identical(el$.element_type %||% "", "barras_multiapiladas") &&
        identical(el$modo %||% "", "multilista")) {
      return(unique(unlist(lapply(el$bloques %||% list(), .element_refs_for_otros), use.names = FALSE)))
    }
    refs <- c(
      .extract_ref_values(el$var %||% NULL),
      .extract_ref_values(el$vars %||% NULL)
    )
    refs <- .reporte_plan_clean_chr(refs)
    unique(refs[nzchar(refs)])
  }

  .otros_key <- function(info) {
    filtros_key <- tryCatch(
      jsonlite::toJSON(info$filtros %||% list(), auto_unbox = TRUE, null = "null"),
      error = function(e) paste(capture.output(str(info$filtros %||% list())), collapse = "|")
    )
    paste(info$source, info$parent_var, info$text_var, filtros_key, sep = "\r")
  }

  .otros_bullet_line_count <- function(x, wrap_chars = 88L) {
    x <- trimws(as.character(x %||% ""))
    if (!nzchar(x)) return(0L)
    wrap_chars <- suppressWarnings(as.integer(wrap_chars)[1])
    if (!is.finite(wrap_chars) || is.na(wrap_chars) || wrap_chars < 30L) wrap_chars <- 88L

    parts <- unlist(strsplit(x, "\\s*\\n+\\s*", perl = TRUE), use.names = FALSE)
    parts <- parts[nzchar(trimws(parts))]
    if (!length(parts)) parts <- x

    # +2 accounts for the bullet glyph and the hanging-indent cost in PowerPoint.
    sum(pmax(1L, ceiling((nchar(parts, type = "width") + 2L) / wrap_chars)))
  }

  .chunk_otros_respuestas <- function(respuestas,
                                      max_lines = 18L,
                                      max_items = 8L,
                                      wrap_chars = 88L) {
    respuestas <- respuestas[nzchar(respuestas)]
    if (!length(respuestas)) return(list())

    max_lines <- suppressWarnings(as.integer(max_lines)[1])
    max_items <- suppressWarnings(as.integer(max_items)[1])
    if (!is.finite(max_lines) || is.na(max_lines) || max_lines < 6L) max_lines <- 18L
    if (!is.finite(max_items) || is.na(max_items) || max_items < 1L) max_items <- 8L

    chunks <- list()
    current <- character(0)
    current_lines <- 0L

    for (resp in respuestas) {
      resp_lines <- max(1L, .otros_bullet_line_count(resp, wrap_chars = wrap_chars))
      would_overflow_lines <- length(current) > 0L && (current_lines + resp_lines) > max_lines
      would_overflow_items <- length(current) >= max_items

      if (would_overflow_lines || would_overflow_items) {
        chunks[[length(chunks) + 1L]] <- current
        current <- character(0)
        current_lines <- 0L
      }

      current <- c(current, resp)
      current_lines <- current_lines + resp_lines
    }

    if (length(current)) chunks[[length(chunks) + 1L]] <- current
    chunks
  }

  # Reparte una pagina de bullets entre `n_cols` columnas balanceando por
  # cantidad de LINEAS estimadas (no por cantidad de items), asi columnas
  # con textos mas largos reciben menos items que columnas con textos cortos.
  .balance_otros_columns <- function(items, n_cols, wrap_chars) {
    if (n_cols <= 1L || length(items) <= 1L) return(list(items))
    cols <- vector("list", n_cols)
    loads <- rep(0L, n_cols)
    for (it in items) {
      lc <- max(1L, .otros_bullet_line_count(it, wrap_chars = wrap_chars))
      idx <- which.min(loads)
      cols[[idx]] <- c(cols[[idx]], it)
      loads[[idx]] <- loads[[idx]] + lc
    }
    Filter(function(x) length(x) > 0L, cols)
  }

  # Listas cortas no necesitan columnas (se verian desbalanceadas / con
  # una columna casi vacia). Solo repartimos en columnas cuando el volumen
  # realmente lo amerita.
  .otros_cols_for_count <- function(n_items, max_cols = 2L) {
    if (max_cols <= 1L || n_items <= 12L) 1L else max_cols
  }

  # Pagina una lista de respuestas "Otros" en N slides, cada una con hasta
  # `max_cols` columnas. A diferencia del chunking de una sola columna
  # (que subutilizaba el alto disponible apenas se llegaba a `max_items`),
  # esto reparte la capacidad entre columnas: mas items por slide antes de
  # necesitar una diapositiva de continuacion "Otros (cont.)".
  .paginate_otros_columns <- function(respuestas,
                                       lines_per_col = 14L,
                                       max_items_per_page = 30L,
                                       max_cols = 2L,
                                       wrap_chars_per_col = 46L) {
    respuestas <- respuestas[nzchar(respuestas)]
    if (!length(respuestas)) return(list())

    lines_per_col <- suppressWarnings(as.integer(lines_per_col)[1])
    if (!is.finite(lines_per_col) || is.na(lines_per_col) || lines_per_col < 4L) lines_per_col <- 14L
    max_items_per_page <- suppressWarnings(as.integer(max_items_per_page)[1])
    if (!is.finite(max_items_per_page) || is.na(max_items_per_page) || max_items_per_page < 1L) max_items_per_page <- 30L
    max_cols <- suppressWarnings(as.integer(max_cols)[1])
    if (!is.finite(max_cols) || is.na(max_cols) || max_cols < 1L) max_cols <- 2L

    pages <- list()
    current <- character(0)
    sim_loads <- rep(0L, max_cols)

    for (resp in respuestas) {
      lc <- max(1L, .otros_bullet_line_count(resp, wrap_chars = wrap_chars_per_col))
      idx <- which.min(sim_loads)
      would_exceed_lines <- length(current) > 0L && (sim_loads[[idx]] + lc) > lines_per_col
      would_exceed_items <- length(current) >= max_items_per_page

      if (would_exceed_lines || would_exceed_items) {
        pages[[length(pages) + 1L]] <- current
        current <- character(0)
        sim_loads <- rep(0L, max_cols)
        idx <- 1L
      }

      current <- c(current, resp)
      sim_loads[[idx]] <- sim_loads[[idx]] + lc
    }
    if (length(current)) pages[[length(pages) + 1L]] <- current

    lapply(pages, function(page_items) {
      n_cols <- min(max_cols, .otros_cols_for_count(length(page_items), max_cols = max_cols))
      list(
        items = page_items,
        columnas = .balance_otros_columns(page_items, n_cols, wrap_chars = wrap_chars_per_col)
      )
    })
  }

  .make_otros_slides <- function(info) {
    respuestas <- .clean_other_response_bullet(info$respuestas %||% character(0))
    normalizar_modo <- info$normalizar_respuestas %||% {
      if (identical(info$kind %||% "open_text_otros", "grouped_otros")) "ninguna" else "mayuscula_inicial"
    }
    respuestas <- .normalizar_other_response_bullets(respuestas, normalizar_modo)
    respuestas <- respuestas[nzchar(respuestas)]
    if (!length(respuestas)) return(list())

    paginas <- .paginate_otros_columns(
      respuestas,
      lines_per_col = info$lines_per_col %||% 22L,
      max_items_per_page = info$max_items_per_page %||% 40L,
      max_cols = info$max_cols %||% 2L,
      wrap_chars_per_col = info$wrap_chars_per_col %||% 46L
    )
    total_paginas <- length(paginas)
    n_txt <- format(as.integer(length(respuestas)), big.mark = ",", scientific = FALSE, trim = TRUE)
    base_txt <- info$base %||% .apply_base_format(paste0(n_txt, " respuestas en Otros en la pregunta ", info$title))

    lapply(seq_along(paginas), function(i) {
      title <- paste0("Otros: ", info$title)
      pagina <- paginas[[i]]
      slide <- p_slide_texto(
        titulo = title,
        bullets = pagina$items,
        base = base_txt,
        meta = list(
          auto_otros = TRUE,
          source = info$source,
          parent_var = info$parent_var,
          text_var = info$text_var,
          kind = info$kind %||% "open_text_otros",
          chunk = i,
          chunks = total_paginas
        )
      )
      slide$slots$columnas <- pagina$columnas
      slide
    })
  }

  # Combina un `grouped_otros_info` (categorias con nombre plegadas en la
  # barra "Otros" solo por limite visual de max_categorias) con el
  # `other_text_info` de ESA MISMA variable (texto libre nunca codificado)
  # en un unico objeto "info", para que ambos casos aparezcan como una sola
  # lista bajo un unico titulo "Otros: <pregunta>" con un Base combinado —
  # en vez de dos slides consecutivas casi identicas (mismo titulo, un
  # "Base: N" distinto cada una) que confunden al lector sobre si son la
  # misma pregunta o dos preguntas distintas.
  .merge_otros_infos <- function(grouped_info, text_info) {
    grouped_txt <- .normalizar_other_response_bullets(
      .clean_other_response_bullet(grouped_info$respuestas %||% character(0)), "ninguna"
    )
    text_txt <- .normalizar_other_response_bullets(
      .clean_other_response_bullet(text_info$respuestas %||% character(0)), "mayuscula_inicial"
    )
    respuestas <- c(grouped_txt, text_txt)
    respuestas <- respuestas[nzchar(respuestas)]
    n_total <- length(grouped_txt) + length(text_txt)

    combined <- grouped_info
    combined$respuestas <- respuestas
    combined$normalizar_respuestas <- "ninguna"
    combined$n <- length(respuestas)
    combined$base <- .apply_base_format(paste0(
      format(as.integer(n_total), big.mark = ",", scientific = FALSE, trim = TRUE),
      " respuestas en Otros en la pregunta ", combined$title
    ))
    combined
  }

  .reporte_plan_insert_otros_slides <- function(plan) {
    if (!isTRUE(auto_otros_slides) || !length(plan)) return(plan)

    seen <- character(0)
    out <- list()

    for (slide in plan) {
      out[[length(out) + 1L]] <- slide
      elements <- .slide_plot_elements(slide)
      if (!length(elements)) next

      for (el in elements) {
        grouped_info <- .grouped_otros_info_for_element(el)
        has_grouped <- !is.null(grouped_info) && is.finite(grouped_info$n) && grouped_info$n > 0

        refs <- .element_refs_for_otros(el)
        text_infos <- list()
        for (ref in refs) {
          info <- .other_text_info_for_ref(
            ref,
            filtros = el$filtros %||% list(),
            source = el$source %||% NULL,
            title_override = (el$overrides %||% list())$titulo %||% el$title_slide %||% NULL
          )
          if (!is.null(info) && is.finite(info$n) && info$n > 0) {
            text_infos[[length(text_infos) + 1L]] <- info
          }
        }

        merged_idx <- NA_integer_
        if (has_grouped && length(text_infos)) {
          hit <- which(vapply(text_infos, function(ti) {
            identical(ti$parent_var, grouped_info$parent_var) && identical(ti$source, grouped_info$source)
          }, logical(1)))
          if (length(hit)) merged_idx <- hit[[1]]
        }

        if (has_grouped) {
          info_to_render <- if (!is.na(merged_idx)) {
            .merge_otros_infos(grouped_info, text_infos[[merged_idx]])
          } else {
            grouped_info
          }
          key <- .otros_key(info_to_render)
          if (!key %in% seen) {
            seen <- c(seen, key)
            if (!is.na(merged_idx)) seen <- c(seen, .otros_key(text_infos[[merged_idx]]))
            otros_slides <- .make_otros_slides(info_to_render)
            for (otros_slide in otros_slides) out[[length(out) + 1L]] <- otros_slide
          }
        }

        if (length(text_infos)) {
          for (idx in seq_along(text_infos)) {
            if (!is.na(merged_idx) && idx == merged_idx) next
            info <- text_infos[[idx]]
            key <- .otros_key(info)
            if (key %in% seen) next
            seen <- c(seen, key)
            otros_slides <- .make_otros_slides(info)
            for (otros_slide in otros_slides) out[[length(out) + 1L]] <- otros_slide
          }
        }
      }
    }

    class(out) <- unique(c("ppt_plan", "list", class(plan)))
    out
  }

  # El prefijo de numeración de los grupos lo decide `reporte_plan_prefijo_grupos.R`:
  # declarado por el analista, deducido de las etiquetas que ya vienen
  # numeradas, o —solo por compatibilidad y avisando— la vieja detección de
  # objetivos educacionales.
  .oe_labels_for_visible_order <- function(labels, el, refs = character(0)) {
    prefijo <- .prefijo_grupos_efectivo(el, refs = refs, labels = labels)
    .prefijo_grupos_aplicar(labels, prefijo, refs = refs)
  }

  .word_text_or_null <- function(x) {
    if (is.null(x)) return(NULL)
    x <- trimws(as.character(x)[1])
    if (is.na(x) || !nzchar(x)) NULL else x
  }

  .word_clean_inferred_title <- function(x) {
    x <- .word_text_or_null(x)
    if (is.null(x)) return(NULL)
    x <- gsub("\\s*\\(\\s*Recodificada\\s*\\)\\s*$", "", x, ignore.case = TRUE, perl = TRUE)
    .word_text_or_null(x)
  }

  .plain_text_for_rule <- function(x) {
    x <- paste(as.character(x %||% ""), collapse = " ")
    x <- iconv(x, from = "", to = "ASCII//TRANSLIT")
    x <- tolower(x)
    trimws(gsub("\\s+", " ", x, perl = TRUE))
  }

  .is_company_name_catalog <- function(var, tab = NULL, source = NULL) {
    title <- tryCatch(.title_of_var(var, source = source), error = function(e) var)
    ln <- tryCatch(.list_name_of_var(var, source = source), error = function(e) "")
    txt <- .plain_text_for_rule(c(var, ln, title))

    n_opts <- NA_integer_
    if (is.data.frame(tab) && "Opciones" %in% names(tab)) {
      n_opts <- sum(as.character(tab$Opciones) != "Total", na.rm = TRUE)
    }

    explicit_company_name <- grepl("nombre\\s+de\\s+la\\s+empresa", txt, perl = TRUE) ||
      grepl("empresa\\s+para\\s+la\\s+cual\\s+.*trabaj", txt, perl = TRUE) ||
      grepl("empresa\\s+en\\s+la\\s+que\\s+.*trabaj", txt, perl = TRUE)

    huge_company_catalog <- is.finite(n_opts) && n_opts > 40L &&
      grepl("\\bempresa\\b|razon\\s+social|organizacion", txt, perl = TRUE)

    explicit_company_name || huge_company_catalog
  }

  .should_show_zero_options <- function(var, tab = NULL, preset_args = list(), overrides = list(), source = NULL,
                                        word_render = FALSE) {
    explicit <- !is.null(overrides$mostrar_ceros)
    show <- if (explicit) {
      isTRUE(overrides$mostrar_ceros)
    } else if (isTRUE(word_render)) {
      TRUE
    } else {
      isTRUE(preset_args$mostrar_ceros %||% FALSE)
    }
    if (show && !explicit && .is_company_name_catalog(var, tab = tab, source = source)) {
      show <- FALSE
    }
    show
  }

  .word_title_for_element <- function(el, fallback = NULL) {
    if (is.null(el) || !inherits(el, "ppt_element")) return(.word_text_or_null(fallback))

    title <- .word_text_or_null(el$title_slide %||% (el$overrides %||% list())$titulo %||% NULL)
    if (!is.null(title)) return(title)

    refs <- c(
      .extract_ref_values(el$var %||% NULL),
      .extract_ref_values(el$vars %||% NULL)
    )
    refs <- unique(refs[!is.na(refs) & nzchar(trimws(refs))])
    for (ref in refs) {
      src <- if (grepl("\\$", ref)) NULL else el$source %||% NULL
      title <- tryCatch(.word_clean_inferred_title(.title_of_var(ref, source = src)), error = function(e) NULL)
      if (!is.null(title)) return(title)
    }

    .word_text_or_null(fallback)
  }

  .filter_data <- function(filtros = list(), source = NULL, ref = NULL) {
    src <- .resolve_source_name(source = source, ref = ref, arg_name = "var")
    # `_safe`: un filtro con valor real sobre una columna ausente en la fuente
    # resuelta degrada ESA lamina a canvas en blanco (0 filas) en vez de matar
    # el reporte. Ver reporte_filter_guards.R (bug ACNUR multibase madre+repeat).
    .apply_named_filters_safe(data_sources[[src]], filters = filtros %||% list(), arg_name = "filtros")
  }

  .blank_canvas <- function(preset_args = list(), overrides = list(), mensaje = "Sin datos para mostrar") {
    dbg <- .merge_args(presets$base$args %||% list(), preset_args %||% list(), overrides %||% list())
    if (exists(".dim_blank_canvas", mode = "function", inherits = TRUE)) {
      return(.dim_blank_canvas(
        mensaje = mensaje,
        debug_ph_bordes = isTRUE(dbg$debug_ph_bordes %||% FALSE),
        debug_ph_col = dbg$debug_ph_col %||% .GUIA_COL,
        debug_ph_lwd = dbg$debug_ph_lwd %||% 0.6
      ))
    }

    cowplot::ggdraw() +
      cowplot::draw_label(
        label = mensaje,
        x = 0.5, y = 0.5,
        hjust = 0.5, vjust = 0.5,
        size = 12,
        colour = "#20324d"
      )
  }

  .tab_freq <- function(var, filtros = list(), source = NULL) {
    ctx <- .resolve_ref(var, source = source, arg_name = "var")
    dsub <- .filter_data(filtros, source = ctx$source)
    if (!nrow(dsub)) return(NULL)

    freq_table_spss(
      dsub,
      ctx$var,
      survey        = ctx$survey,
      sm_vars_force = NULL,
      orders_list   = ctx$orders_list,
      mostrar_todo  = TRUE
    )
  }

  # `select_multiple`: cada respondente puede aportar a varias opciones a la
  # vez, asi que el `n` de cada opcion NO es una particion del total (no son
  # mutuamente excluyentes). El N_total valido para el % siempre es "cuantos
  # respondentes marcaron algo" (fila "Total" de freq_table_spss), sin
  # importar cuantas opciones se oculten del grafico. Sumar los `n` de las
  # opciones visibles tras excluir alguna (como se hace para select_one) da
  # un numero sin sentido estadistico para select_multiple.
  .reporte_plan_is_select_multiple <- function(var, source = NULL) {
    ctx_v <- tryCatch(.resolve_ref(var, source = source, arg_name = "var"), error = function(e) NULL)
    if (is.null(ctx_v) || is.null(ctx_v$survey) || !all(c("type", "name") %in% names(ctx_v$survey))) {
      return(FALSE)
    }
    mask <- !is.na(ctx_v$survey$name) & ctx_v$survey$name == ctx_v$var
    tps <- unique(stats::na.omit(ctx_v$survey$type[mask]))
    any(grepl("^select_multiple(\\s|$)", tps))
  }

  # ---------------------------------------------------------------------------
  # 4) Helpers  -  paleta_<listname> auto desde env_diapos
  # ---------------------------------------------------------------------------
  .paleta_auto <- function(list_name, env = env_diapos) {
    ln <- as.character(list_name %||% NA_character_)[1]
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

  .inject_dimensiones_palette <- function(dsrc, cruce = NULL, source = NULL) {
    if (is.null(cruce)) return(dsrc)
    cr_ctx <- .resolve_ref(cruce, source = source, arg_name = "cruce")
    if (!(cr_ctx$var %in% names(dsrc))) return(dsrc)

    ln <- .list_name_from_ctx(cr_ctx)
    pal <- .paleta_auto(ln, env_diapos)
    if (is.null(pal) || !length(pal)) return(dsrc)

    cfg <- attr(dsrc, "dimensiones_config", exact = TRUE)
    if (is.null(cfg) || !is.list(cfg)) {
      cfg <- reporte_dimensiones_config(dsrc)
    }

    cfg$paletas_cruce <- cfg$paletas_cruce %||% list()
    cfg$paletas_cruce[[cr_ctx$var]] <- pal

    attr(dsrc, "dimensiones_config") <- cfg
    dsrc
  }

  .base_auto_from_var <- function(var, filtros = list(), sufijo_auto = NULL, formato = "Base: %s", excluir_opciones = NULL) {
    if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) return(NULL)

    ctx_base <- tryCatch(.resolve_ref(var, arg_name = "var"), error = function(e) NULL)
    if (!is.null(ctx_base)) {
      excluir_opciones <- .exclusion_for_ctx(ctx_base, excluir_opciones)
    }

    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(NULL)

    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    tab2 <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = FALSE)
    tab2 <- .reporte_plan_filter_freq_options(tab2, excluir_opciones)
    excluded_any <- isTRUE(attr(tab2, "excluded_any", exact = TRUE))

    if (!nrow(tab2)) return(NULL)
    reducida <- (excluded_any || .reporte_plan_base_na_reducida(N_total, tryCatch(.filter_data(filtros, source = ctx_base$source), error = function(e) NULL))) && !.reporte_plan_is_select_multiple(var)
    if ((excluded_any && !.reporte_plan_is_select_multiple(var)) || !is.finite(N_total)) N_total <- sum(tab2$n, na.rm = TRUE)
    if (!is.finite(N_total)) return(NULL)

    # B56/W-8: composicion (N + sufijo_auto + marca de criterio cuando la
    # exclusion redujo el denominador) delegada a reporte_plan_base_criterio.R.
    .reporte_plan_base_componer_nota(N_total, sufijo_auto, formato, reducida)
  }

  .base_auto_from_refs <- function(refs, filtros = list(), sufijo_auto = NULL, formato = "Base: %s", excluir_opciones = NULL) {
    refs <- .extract_ref_values(refs)
    refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
    if (!length(refs)) return(NULL)

    .fmt_base_part <- function(n_txt, src) {
      src <- trimws(as.character(src %||% "")[1])
      if (!nzchar(src) || identical(src, "default")) return(n_txt)
      paste(n_txt, src)
    }

    ctxs <- lapply(refs, .resolve_ref, arg_name = "var")
    src_order <- names(data_sources)
    srcs_used <- unique(vapply(ctxs, `[[`, character(1), "source"))
    srcs_used <- src_order[src_order %in% srcs_used]
    if (!length(srcs_used)) return(NULL)

    if (length(srcs_used) == 1L) {
      src <- srcs_used[1]
      first_ref <- refs[match(src, vapply(ctxs, `[[`, character(1), "source"))]

      # Si el reporte completo usa multiples BBDD, la base automatica debe
      # rotularse por fuente (igual que en PPT), incluso cuando el grafico
      # particular use solo una.
      if (length(data_sources) > 1L) {
        ctx_first <- tryCatch(.resolve_ref(first_ref, source = src, arg_name = "var"), error = function(e) NULL)
        excluir_src <- if (is.null(ctx_first)) excluir_opciones else .exclusion_for_ctx(ctx_first, excluir_opciones)
        tab <- .tab_freq(first_ref, filtros = filtros, source = src)
        if (is.null(tab) || !nrow(tab)) return(NULL)

        N_total <- NA_real_
        if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
          idx_tot <- which(tab$Opciones == "Total")
          if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
        }

        tab2 <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = FALSE)
        tab2 <- .reporte_plan_filter_freq_options(tab2, excluir_src)
        excluded_any <- isTRUE(attr(tab2, "excluded_any", exact = TRUE))

        if (!nrow(tab2)) return(NULL)
        reducida <- (excluded_any || .reporte_plan_base_na_reducida(N_total, tryCatch(.filter_data(filtros, source = src), error = function(e) NULL))) && !.reporte_plan_is_select_multiple(first_ref, source = src)
        if ((excluded_any && !.reporte_plan_is_select_multiple(first_ref, source = src)) || !is.finite(N_total)) N_total <- sum(tab2$n, na.rm = TRUE)
        if (!is.finite(N_total)) return(NULL)

        N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)
        return(sprintf(formato, .reporte_plan_base_marca_criterio(.fmt_base_part(N_pretty, src), reducida)))
      }

      return(.base_auto_from_var(
        var = first_ref,
        filtros = filtros,
        sufijo_auto = sufijo_auto,
        formato = formato,
        excluir_opciones = excluir_opciones
      ))
    }

    parts <- character(0)
    alguna_reducida <- FALSE
    for (src in srcs_used) {
      idx <- which(vapply(ctxs, `[[`, character(1), "source") == src)[1]
      ref_src <- refs[idx]
      ctx_ref <- tryCatch(.resolve_ref(ref_src, source = src, arg_name = "var"), error = function(e) NULL)
      excluir_src <- if (is.null(ctx_ref)) excluir_opciones else .exclusion_for_ctx(ctx_ref, excluir_opciones)
      tab <- .tab_freq(ref_src, filtros = filtros, source = src)
      if (is.null(tab) || !nrow(tab)) next

      N_total <- NA_real_
      if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
        idx_tot <- which(tab$Opciones == "Total")
        if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
      }

      tab2 <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = FALSE)
      tab2 <- .reporte_plan_filter_freq_options(tab2, excluir_src)
      excluded_any <- isTRUE(attr(tab2, "excluded_any", exact = TRUE))

      if (!nrow(tab2)) next
      reducida <- (excluded_any || .reporte_plan_base_na_reducida(N_total, tryCatch(.filter_data(filtros, source = src), error = function(e) NULL))) && !.reporte_plan_is_select_multiple(ref_src, source = src)
      if ((excluded_any && !.reporte_plan_is_select_multiple(ref_src, source = src)) || !is.finite(N_total)) N_total <- sum(tab2$n, na.rm = TRUE)
      if (!is.finite(N_total)) next
      alguna_reducida <- alguna_reducida || reducida

      N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)
      parts <- c(parts, .fmt_base_part(N_pretty, src))
    }

    if (!length(parts)) return(NULL)
    base_core <- if (length(parts) == 1L) {
      parts
    } else if (length(parts) == 2L) {
      paste(parts, collapse = " y ")
    } else {
      paste0(paste(parts[-length(parts)], collapse = ", "), " y ", parts[length(parts)])
    }
    sprintf(formato, .reporte_plan_base_marca_criterio(base_core, alguna_reducida))
  }

  # Caption "Base: N" degradable: si el calculo falla por datos, la lamina sale
  # sin caption (warning) en vez de matar el deck (reporte_plan_condiciones.R).
  # B48/G-24: en laminas de VARIOS graficos (2/4 poblacion), la Base auto
  # tomaba solo el primer elemento — «Base: 52 docentes» en una lamina que
  # compara 4 actores. Este combinador junta las refs de todos los
  # elementos: si cruzan varias fuentes, la Base sale prorrateada por
  # fuente (reusa .base_auto_from_refs); si no, cae al primer elemento.
  .base_auto_de_elementos <- function(els, sufijo_auto = NULL, formato = "Base: %s") {
    refs <- character(0)
    for (el in els) {
      if (!inherits(el, "ppt_element")) next
      ref <- tryCatch({
        v <- as.character(el$var %||% "")[1]
        if (is.na(v) || !nzchar(trimws(v))) NA_character_
        else if (grepl("$", v, fixed = TRUE)) v
        else {
          src <- tryCatch(.element_source(el), error = function(e) NULL)
          if (!is.null(src) && nzchar(as.character(src)[1])) paste0(src, "$", trimws(v)) else v
        }
      }, error = function(e) NA_character_)
      if (!is.na(ref)) refs <- c(refs, ref)
    }
    refs <- unique(refs)
    srcs <- unique(vapply(refs, function(r) {
      m <- regmatches(r, regexec("^([^$]+)\\$", r))[[1]]
      if (length(m) == 2L) m[2] else ""
    }, character(1)))
    srcs <- srcs[nzchar(srcs)]
    if (length(refs) >= 2L && length(srcs) >= 2L) {
      combinada <- tryCatch(
        .base_auto_from_refs(refs, sufijo_auto = sufijo_auto, formato = formato),
        error = function(e) NULL
      )
      if (!is.null(combinada) && nzchar(trimws(as.character(combinada)[1]))) return(combinada)
    }
    primero <- Filter(function(e) inherits(e, "ppt_element"), els)
    if (!length(primero)) return(NULL)
    .base_auto_from_element(primero[[1]], sufijo_auto = sufijo_auto, formato = formato)
  }

  .base_auto_from_element <- function(el, sufijo_auto = NULL, formato = "Base: %s") .reporte_plan_nota_base_sellada(.plan_base_caption_segura(.base_auto_from_element_impl, el, sufijo_auto, formato), data_sources, source = tryCatch(.element_source(el), error = function(e) NULL))
  .base_auto_from_element_impl <- function(el, sufijo_auto = NULL, formato = "Base: %s") {
    if (is.null(el) || !inherits(el, "ppt_element")) return(NULL)

    etype <- el$.element_type %||% ""
    # Doctrina B36 (Gonzalo): la base vive en la esquina inferior izquierda
    # del SLIDE (su placeholder de base).
    # Apiladas, multiapiladas y agrupadas (G-17) ya NO imprimen caption
    # propio, asi que su base de slide vuelve. Los etypes que aun llevan
    # caption en el grafico (categoricas/pie/donut) siguen suprimidos.
    if (etype %in% c("barras_categoricas", "pie", "donut")) return(NULL)
    excluir_base <- switch(
      etype,
      barras_multiapiladas = .reporte_plan_excluir_cascada(
        presets$barras_apiladas$args, el$overrides %||% list(), el,
        preset_args_extra = presets$multi_apiladas$args
      ),
      NULL
    )

    if (identical(etype, "barras_multiapiladas") && identical(el$modo %||% NULL, "multilista")) {
      bloques <- el$bloques %||% list()
      if (!length(bloques)) return(NULL)

      refs_base <- character(0)
      filtros_base <- el$filtros %||% list()
      for (block in bloques) {
        refs_block <- c(
          .extract_ref_values(block$var %||% NULL),
          .extract_ref_values(block$vars %||% NULL)
        )
        refs_block <- refs_block[!is.na(refs_block) & nzchar(trimws(refs_block))]
        if (length(refs_block)) refs_base <- c(refs_base, refs_block)
      }
      refs_base <- refs_base[!duplicated(refs_base)]
      if (!length(refs_base)) return(NULL)  # sin exigir multifuente: ver .base_refs_multifuente()

      return(.base_auto_from_refs(
        refs = refs_base,
        filtros = filtros_base,
        sufijo_auto = sufijo_auto,
        formato = formato,
        excluir_opciones = excluir_base
      ))
    }

    if (identical(etype, "media_rango")) {
      source_use <- .element_source(el)
      var_ref <- el$var %||% NULL
      if (is.null(var_ref) || !is.character(var_ref) || !nzchar(trimws(var_ref))) return(NULL)

      ctx_var <- .resolve_ref(var_ref, source = source_use, arg_name = "var")
      df_base <- .filter_data(el$filtros %||% list(), source = ctx_var$source)
      if (!nrow(df_base) || !(ctx_var$var %in% names(df_base))) return(NULL)

      x_raw <- df_base[[ctx_var$var]]
      if (is.factor(x_raw)) x_raw <- as.character(x_raw)
      x_num <- suppressWarnings(as.numeric(x_raw))
      keep <- is.finite(x_num)

      cruce_ref <- el$cruce %||% NULL
      if (!is.null(cruce_ref) &&
          is.character(cruce_ref) &&
          length(cruce_ref) == 1L &&
          nzchar(trimws(cruce_ref))) {
        ctx_cruce <- .resolve_ref(cruce_ref, source = ctx_var$source, arg_name = "cruce")
        if (!(ctx_cruce$var %in% names(df_base))) return(NULL)
        g <- df_base[[ctx_cruce$var]]
        keep <- keep & !is.na(g) & nzchar(trimws(as.character(g)))
      }

      N_total <- sum(keep, na.rm = TRUE)
      if (!is.finite(N_total) || N_total <= 0) return(NULL)

      N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)
      suf <- NULL
      if (!is.null(sufijo_auto) && is.character(sufijo_auto) && length(sufijo_auto) == 1L) {
        sufijo_auto <- trimws(sufijo_auto)
        if (nzchar(sufijo_auto)) suf <- sufijo_auto
      }
      base_core <- if (is.null(suf)) N_pretty else paste(N_pretty, suf)
      return(sprintf(formato, base_core))
    }

    if (identical(etype, "nube_palabras")) {
      var_ref <- el$var %||% NULL
      if (is.null(var_ref) || !is.character(var_ref) || !nzchar(trimws(var_ref))) return(NULL)
      ctx_var <- .resolve_ref(var_ref, source = el$source %||% NULL, arg_name = "var")
      df_base <- .filter_data(el$filtros %||% list(), source = ctx_var$source)
      if (!nrow(df_base) || !ctx_var$var %in% names(df_base)) return(NULL)
      keep <- .nonblank_open_text(df_base[[ctx_var$var]]) &
        .nonblank_open_text_for_nube(df_base[[ctx_var$var]])
      parent_var <- el$parent_var %||% NULL
      if (!is.null(parent_var) && is.character(parent_var) && nzchar(trimws(parent_var))) {
        ctx_parent <- tryCatch(.resolve_ref(parent_var, source = ctx_var$source, arg_name = "parent_var"), error = function(e) NULL)
        if (!is.null(ctx_parent)) {
          parent_mask <- .parent_other_mask(df_base, ctx_parent, .other_option_values(ctx_parent))
          if (length(parent_mask) == length(keep)) keep <- keep & parent_mask
        }
      }
      N_total <- sum(keep, na.rm = TRUE)
      if (!is.finite(N_total) || N_total <= 0) return(NULL)
      N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)
      return(sprintf(formato, paste(N_pretty, "respuestas abiertas")))
    }

    if (etype %in% c("dim_heatmap", "dim_heatmap_criterios", "dim_radar", "dim_comparativo_radarbar", "dim_foda")) {
      if (!exists(".dim_build_context", mode = "function", inherits = TRUE)) return(NULL)

      source_use <- .element_source(el)
      ctx_src <- .source_ctx(source_use)
      ctx <- .dim_build_context(ctx_src$data, instrumento = ctx_src$instrumento)

      N_total <- NA_real_
      if (etype %in% c("dim_heatmap", "dim_radar", "dim_comparativo_radarbar")) {
        if (!exists(".dim_build_payload", mode = "function", inherits = TRUE)) return(NULL)

        cruce_ref <- el$cruce %||% NULL
        iter_ref <- el$iter_var %||% NULL
        cruce_var <- if (!is.null(cruce_ref)) .resolve_ref(cruce_ref, source = source_use, arg_name = "cruce")$var else NULL
        iter_var <- if (!is.null(iter_ref)) .resolve_ref(iter_ref, source = source_use, arg_name = "iter_var")$var else NULL

        payload <- .dim_build_payload(
          ctx,
          modo = el$modo,
          objetivo = el$objetivo,
          cruce = cruce_var,
          incluir_total = el$incluir_total %||% NULL,
          filtros = el$filtros %||% list(),
          iter_var = iter_var,
          iter_level = el$iter_level %||% NULL
        )

        # En dimensiones, la base automatica debe reflejar el universo analizado
        # (post filtros/iteracion), incluso cuando `incluir_total = FALSE`.
        N_total <- suppressWarnings(as.numeric(payload$base_universe)[1])
        if (!is.finite(N_total)) {
          sc <- payload$score_plot %||% data.frame()
          if (!nrow(sc) || !("base" %in% names(sc))) return(NULL)

          grupos <- as.character(sc$grupo %||% character(0))
          bases <- suppressWarnings(as.numeric(sc$base))
          idx_total <- which(grupos == "Total")
          N_total <- if (length(idx_total)) bases[idx_total[1]] else suppressWarnings(max(bases, na.rm = TRUE))
        }
      } else if (identical(etype, "dim_heatmap_criterios")) {
        if (!exists(".dim_safe_weights", mode = "function", inherits = TRUE)) {
          return(NULL)
        }
        w <- .dim_safe_weights(ctx_src$data, weight_col = ctx$weight_col)
        N_total <- suppressWarnings(sum(as.numeric(w), na.rm = TRUE))
        if (!is.finite(N_total) || is.na(N_total) || N_total <= 0) {
          N_total <- nrow(ctx_src$data)
        }
      } else {
        if (!exists(".dim_apply_filters", mode = "function", inherits = TRUE) ||
            !exists(".dim_safe_weights", mode = "function", inherits = TRUE)) {
          return(NULL)
        }
        df_foda <- .dim_apply_filters(ctx_src$data, filters = el$filtros %||% list())
        if (!nrow(df_foda)) return(NULL)

        if (isTRUE(el$usar_pesos %||% TRUE)) {
          w <- .dim_safe_weights(df_foda, weight_col = ctx$weight_col)
          N_total <- suppressWarnings(sum(as.numeric(w), na.rm = TRUE))
        } else {
          N_total <- as.numeric(nrow(df_foda))
        }
      }
      if (!is.finite(N_total)) return(NULL)

      N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)
      suf <- NULL
      if (!is.null(sufijo_auto) && is.character(sufijo_auto) && length(sufijo_auto) == 1L) {
        sufijo_auto <- trimws(sufijo_auto)
        if (nzchar(sufijo_auto)) suf <- sufijo_auto
      }
      base_core <- if (is.null(suf)) N_pretty else paste(N_pretty, suf)
      return(sprintf(formato, base_core))
    }

    refs_base <- c(
      .extract_ref_values(el$var %||% NULL),
      .extract_ref_values(el$vars %||% NULL)
    )
    refs_base <- refs_base[!is.na(refs_base) & nzchar(trimws(refs_base))]
    if (!length(refs_base)) return(NULL)

    .base_auto_from_refs(
      refs = refs_base,
      filtros = el$filtros %||% list(),
      sufijo_auto = sufijo_auto,
      formato = formato,
      excluir_opciones = excluir_base
    )
  }

  .slide_subtitle_style <- function() {
    base_args <- presets$base$args %||% list()
    font_size <- suppressWarnings(as.numeric(base_args$size_subtitulo_slide %||% base_args$size_subtitulo %||% 16)[1])
    if (!is.finite(font_size) || is.na(font_size) || font_size <= 0) font_size <- 16
    font_family <- base_args$font_family_ppt %||% base_args$font_family %||% "Arial"
    font_family <- as.character(font_family)[1]
    if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"
    list(
      font_family = font_family,
      font_size = font_size,
      color = base_args$color_subtitulo %||% "#85BB85",
      # Separacion corta y consistente bajo el titulo.
      top_gap = 0.008,
      # Altura suficiente para evitar que PowerPoint reduzca automaticamente la fuente.
      height = max(0.36, font_size * 0.022)
    )
  }

  .placeholder_props_current <- function(doc, spec) {
    if (is.null(spec) || is.null(spec$type)) {
      .plan_input_abort("Placeholder spec invalido (NULL o sin $type).")
    }
    type_idx <- spec$type_idx %||% NULL
    if (!is.null(type_idx)) {
      type_idx <- suppressWarnings(as.integer(type_idx))
      if (length(type_idx) != 1L || is.na(type_idx)) {
        .plan_input_abort("`type_idx` debe ser un entero escalar.")
      }
    }

    slide <- doc$slide$get_slide(doc$cursor)
    xfrm <- tryCatch(slide$get_xfrm(), error = function(e) NULL)
    layout_name <- NULL
    master_name <- NULL

    if (!is.null(xfrm)) {
      layout_vals <- unique(as.character(xfrm$name))
      layout_vals <- layout_vals[!is.na(layout_vals) & nzchar(trimws(layout_vals))]
      if (length(layout_vals)) layout_name <- layout_vals[1]

      master_vals <- unique(as.character(xfrm$master_name))
      master_vals <- master_vals[!is.na(master_vals) & nzchar(trimws(master_vals))]
      if (length(master_vals)) master_name <- master_vals[1]
    }

    if (is.null(master_name) || !nzchar(master_name)) {
      master_name <- master
    }

    props <- officer::layout_properties(
      doc,
      layout = layout_name,
      master = master_name
    )

    .select_placeholder_props(props, spec, layout_name, master_name)
  }

  .ph_with_slide_subtitle <- function(doc, subtitle, title_spec) {
    subtitle <- as.character(subtitle %||% "")[1]
    if (!nzchar(trimws(subtitle))) return(doc)

    title_props <- .placeholder_props_current(doc, title_spec)
    st <- .slide_subtitle_style()
    top_gap <- suppressWarnings(as.numeric(st$top_gap)[1])
    height <- suppressWarnings(as.numeric(st$height)[1])
    if (!is.finite(top_gap) || is.na(top_gap) || top_gap < 0) top_gap <- 0.05
    if (!is.finite(height) || is.na(height) || height <= 0) height <- 0.32

    loc <- officer::ph_location(
      left = title_props$offx[[1]],
      top = title_props$offy[[1]] + title_props$cy[[1]] + top_gap,
      width = title_props$cx[[1]],
      height = height
    )

    fp_txt <- officer::fp_text(
      color = st$color,
      font.size = st$font_size,
      font.family = st$font_family,
      bold = TRUE
    )
    fp_par <- officer::fp_par(text.align = "left")
    value <- officer::fpar(officer::ftext(subtitle, prop = fp_txt), fp_p = fp_par)

    officer::ph_with(doc, value = value, location = loc)
  }

  .ph_with_styled_text <- function(
      doc,
      text,
      spec,
      color = NULL,
      font_size = NULL,
      font_family = NULL,
      bold = TRUE,
      align = "center",
      top_offset = 0,
      height = NULL
  ) {
    text <- as.character(text %||% "")[1]
    if (!nzchar(trimws(text))) return(doc)

    props <- .placeholder_props_current(doc, spec)
    base_args <- presets$base$args %||% list()

    font_family <- font_family %||% base_args$font_family_ppt %||% base_args$font_family %||% "Arial"
    font_family <- as.character(font_family)[1]
    if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"

    if (is.null(font_size)) {
      font_size <- suppressWarnings(as.numeric(base_args$size_subtitulo_slide %||% base_args$size_subtitulo %||% 16)[1])
    }
    if (!is.finite(font_size) || is.na(font_size) || font_size <= 0) font_size <- 16

    color <- color %||% base_args$color_subtitulo %||% "#081F5C"
    color <- as.character(color)[1]
    if (is.na(color) || !nzchar(trimws(color))) color <- "#081F5C"

    loc <- officer::ph_location(
      left = props$offx[[1]],
      top = props$offy[[1]] + top_offset,
      width = props$cx[[1]],
      height = height %||% props$cy[[1]],
      newlabel = props$ph_label[[1]] %||% "",
      rotation = props$rotation[[1]]
    )

    fp_txt <- officer::fp_text(
      color = color,
      font.size = font_size,
      font.family = font_family,
      bold = isTRUE(bold)
    )
    value <- officer::fpar(officer::ftext(text, prop = fp_txt), fp_p = officer::fp_par(text.align = align))
    officer::ph_with(doc, value = value, location = loc)
  }

  # ---------------------------------------------------------------------------
  # 5) Renders
  # ---------------------------------------------------------------------------

  # ---------------------------------------------------------------------------
  # Helper: acumula render_meta para uso externo (Word, etc.)
  # - Para multilista: renderiza cada bloque por separado (sin titulo en el chart).
  # - Para el resto: re-renderiza sin overrides de titulo para que el titulo
  #   vaya fuera del grafico en Word.
  # Solo se llama cuando build_render_meta = TRUE.
  # ---------------------------------------------------------------------------
  .push_render_meta_for_element <- function(el, plot) {
    if (is.null(el) || !inherits(el, "ppt_element")) return(invisible(NULL))

    etype <- el$.element_type %||% ""

    .is_multi_source_element <- function(el_src) {
      refs <- c(
        .extract_ref_values(el_src$var %||% NULL),
        .extract_ref_values(el_src$vars %||% NULL)
      )
      refs <- refs[!is.na(refs) & nzchar(trimws(refs))]
      if (!length(refs)) return(FALSE)

      srcs <- tryCatch(
        unique(vapply(lapply(refs, .resolve_ref, arg_name = "var"), `[[`, character(1), "source")),
        error = function(e) character(0)
      )
      length(srcs) > 1L
    }

    # Constantes de preset usadas en todos los sub-renders
    pm  <- presets$multi_apiladas$args  %||% list()
    ps  <- presets$barras_apiladas$args %||% list()
    suf <- presets$base$args$sufijo_auto %||% NULL
    fmt <- presets$base$args$formato     %||% "Base: %s"

    # Helper: renderiza un sub-bloque multiapiladas y agrega a render_meta
    .push_multi_block <- function(block_data, title_word) {
      title_word <- .word_text_or_null(title_word) %||% .word_title_for_element(block_data)
      # Limpieza + geometria Word del bloque (helper en reporte_plan_helpers.R)
      block_clean <- .word_preparar_block_multi(
        block_data,
        word_image = presets$base$args$word_image %||% NULL
      )

      p_b <- tryCatch(
        .render_barras_multiapiladas(block_clean, preset_args_multi = pm, preset_args_single = ps),
        error = function(e) NULL
      )
      if (is.null(p_b)) return(invisible(NULL))

      block_el <- structure(
        c(block_clean, list(.element_type = "barras_multiapiladas")),
        class = "ppt_element"
      )
      base_b <- tryCatch(
        .base_auto_from_element(block_el, sufijo_auto = suf, formato = fmt),
        error = function(e) NULL
      )
      # W-4 (B52): la Base sellada/prorrateada («52 docentes y 155
      # estudiantes») manda, igual que en el slide PPT; el caption por actor
      # («Docentes (52) y …») queda solo como fallback.
      base_b <- base_b %||% attr(p_b, "pulso_actor_base_caption", exact = TRUE)

      render_meta[[length(render_meta) + 1]] <<- list(
        kind      = "chart",
        plot_word = p_b,
        title     = title_word,
        base      = base_b,
        base_multi_source = .is_multi_source_element(block_el),
        etype     = "barras_multiapiladas_block"
      )
    }

    # Helper: divide un bloque var_cruce/var en un entry por grupo/variable
    .split_multi_block <- function(block_data) {
      modo_b <- block_data$modo %||% "var"

      if (identical(modo_b, "var_cruce")) {
        # Un chart por grupo (dim): titulo va fuera como parrafo Word
        vars_list     <- block_data$vars          %||% list()
        titulos_grupo <- block_data$titulos_grupo %||% list()
        for (nm in names(vars_list)) {
          sub               <- block_data
          sub$vars          <- vars_list[nm]
          sub$titulos_grupo <- NULL   # no mostrar en el chart; sale como titulo Word
          title_g <- .word_titulo_bloque_multi(block_data$title_slide, titulos_grupo[[nm]] %||% nm)
          .push_multi_block(sub, title_g)
        }

      } else if (identical(modo_b, "var")) {
        # Un chart por variable individual; titulo va fuera como parrafo Word
        vars_vec <- block_data$vars %||% character(0)
        if (is.list(vars_vec)) vars_vec <- unlist(vars_vec, use.names = FALSE)
        for (v in vars_vec) {
          sub               <- block_data
          sub$vars          <- v
          sub$titulos_grupo <- NULL
          title_v <- tryCatch(.title_of_var(v), error = function(e) v)
          if (is.null(title_v) || !nzchar(trimws(as.character(title_v)[1]))) title_v <- v
          .push_multi_block(sub, .word_titulo_bloque_multi(block_data$title_slide, title_v))
        }

      } else {
        # Modo desconocido: renderizar como bloque unico
        title_b <- .word_title_for_element(block_data)
        .push_multi_block(block_data, title_b)
      }
    }

    # --- MULTILISTA: un entry por grupo dentro de cada bloque ---
    if (identical(etype, "barras_multiapiladas") && identical(el$modo %||% "", "multilista")) {
      for (block in el$bloques %||% list()) .split_multi_block(block)
      return(invisible(NULL))
    }

    # --- MULTIAPILADAS var_cruce / var: un entry por grupo/variable ---
    if (identical(etype, "barras_multiapiladas")) {
      .split_multi_block(el)
      return(invisible(NULL))
    }

    # --- ELEMENTO NORMAL ---
    title <- .word_title_for_element(el)

    word_note <- .plot_note_from(plot, el$overrides$nota_pie %||% el$nota_pie %||% NULL)

    el_for_word <- el
    el_for_word$.word_render <- TRUE
    el_for_word$overrides <- el_for_word$overrides %||% list()
    el_for_word$overrides$titulo    <- NULL
    el_for_word$overrides$subtitulo <- NULL
    el_for_word$overrides$nota_pie  <- NULL
    el_for_word <- .word_ajustar_el(el_for_word, etype, word_image = presets$base$args$word_image %||% NULL)
    p_word <- tryCatch(.render_element_impl(el_for_word), error = function(e) plot)

    base <- tryCatch(
      .base_auto_from_element(el, sufijo_auto = suf, formato = fmt),
      error = function(e) NULL
    )

    render_meta[[length(render_meta) + 1]] <<- list(
      kind      = "chart",
      plot_word = p_word,
      title     = title,
      base      = base,
      note      = word_note,
      base_multi_source = .is_multi_source_element(el),
      etype     = etype
    )
    invisible(NULL)
  }

  # Para barras_agrupadas: inyecta el label de la variable como titulo en overrides
  # para que aparezca dentro del grafico en PPT.
  # El mecanismo Word lo suprime luego via el_for_word$overrides$titulo <- NULL.
  .inject_var_titulo <- function(el) {
    if (!isTRUE(el$inject_title_ppt %||% FALSE)) return(el)
    el$overrides <- el$overrides %||% list()
    titulo_actual <- el$overrides$titulo %||% el$title_slide %||% NULL
    if (!is.null(titulo_actual) && nzchar(trimws(as.character(titulo_actual)[1]))) {
      el$overrides$titulo <- as.character(titulo_actual)[1]
      return(el)
    }
    var_lbl <- NULL
    if (!is.null(el$var)) {
      var_lbl <- tryCatch(.title_of_var(el$var), error = function(e) NULL)
    }
    if (!is.null(var_lbl) && nzchar(trimws(as.character(var_lbl)[1]))) {
      el$overrides$titulo <- as.character(var_lbl)[1]
    }
    el
  }

  # Inyecta title_slide como overrides$titulo en slides multi-grafico
  # (donde no hay placeholder PPT individual por grafico)
  .inject_title_override <- function(el) {
    if (!isTRUE(el$inject_title_ppt %||% FALSE)) return(el)
    el$overrides <- el$overrides %||% list()
    titulo_actual <- el$overrides$titulo %||% el$title_slide %||% NULL
    if (!is.null(titulo_actual) && nzchar(trimws(as.character(titulo_actual)[1]))) {
      el$overrides$titulo <- as.character(titulo_actual)[1]
    }
    el
  }

  .clean_note_text <- function(x) {
    if (is.null(x)) return(NULL)
    x <- as.character(x)[1]
    if (is.na(x) || !nzchar(trimws(x))) return(NULL)
    trimws(x)
  }

  .plot_note_from <- function(plot_obj, fallback = NULL) {
    note_attr <- attr(plot_obj, "note_outside", exact = TRUE)
    note_attr <- .clean_note_text(note_attr)
    nota <- if (is.null(note_attr)) .clean_note_text(fallback) else note_attr
    .reporte_plan_nota_base_sellada(nota, data_sources)
  }

  .ppt_note_from <- function(plot_obj, fallback = NULL) {
    .plot_note_from(plot_obj, fallback = fallback)
  }

  # Aplica el formato de base declarado en presets (p.ej. "Base: %s" o "N = %s")
  # sobre un nucleo ya compuesto. Degrada al prefijo clasico si el formato no
  # trae marcador, para que un preset mal escrito no rompa el render.
  .apply_base_format <- function(core) {
    fmt <- presets$base$args$formato %||% "Base: %s"
    fmt <- as.character(fmt)[1]
    if (is.na(fmt) || !nzchar(fmt) || !grepl("%s", fmt, fixed = TRUE)) {
      return(paste0("Base: ", core))
    }
    tryCatch(sprintf(fmt, core), error = function(e) paste0("Base: ", core))
  }

  .format_n_caption <- function(n_values, unit = "respuestas") {
    n_values <- suppressWarnings(as.numeric(n_values))
    n_values <- n_values[is.finite(n_values) & !is.na(n_values) & n_values > 0]
    if (!length(n_values)) return(NULL)
    n_values <- unique(round(n_values))
    n_values <- sort(n_values)
    unit <- .clean_note_text(unit) %||% "respuestas"
    fmt <- function(x) format(x, big.mark = ",", scientific = FALSE, trim = TRUE)
    core <- if (length(n_values) == 1L) {
      paste0(fmt(n_values[[1]]), " ", unit)
    } else {
      paste0(fmt(min(n_values)), "-", fmt(max(n_values)), " ", unit)
    }
    # El prefijo sale del preset (`presets$base$args$formato`) igual que en
    # `.base_auto_from_var`: un estudio que declara "N = %s" no debe quedar con
    # dos prefijos distintos segun que camino compuso la nota de base.
    .apply_base_format(core)
  }

  .force_canvas_args <- function(fun, args) {
    fml <- tryCatch(names(formals(fun)), error = function(e) character(0))
    if ("usar_canvas" %in% fml) args$usar_canvas <- TRUE
    args
  }

  .collapse_y_label_space_word <- function(overrides) {
    overrides <- overrides %||% list()
    overrides$usar_canvas <- TRUE
    overrides$canvas_w_etiquetas <- 0
    overrides$canvas_w_buf_etq_bars <- 0
    overrides
  }

  # Dispatcher generico: renderiza cualquier ppt_element. La cascara degrada
  # `pulso_slide_render_error` a canvas "Sin datos" (reporte_plan_condiciones.R)
  # para que un fallo por-lamina no mate el deck completo.
  # ancho_slot: ancho fisico (in) del cajon destino, para el wrap real (H22).
  # alto_slot: idem para el ALTO (P42). Sin el, el graficador se queda con el
  # default de su firma —seis pulgadas— y en una lamina de cuatro paneles cree
  # tener el doble de alto del que tiene: cualquier cuenta vertical suya se
  # equivoca por ese factor y las etiquetas de eje de dos lineas se montan sobre
  # la fila vecina. Medidos en el XML, esos cajones son 5.17 x 2.56 in.
  .render_element <- function(el, ancho_slot = NULL, alto_slot = NULL) {
    if (!is.null(ancho_slot) && inherits(el, "ppt_element") && is.null((el$overrides %||% list())$ancho)) {
      el$overrides$ancho <- ancho_slot
    }
    if (!is.null(alto_slot) && inherits(el, "ppt_element") && is.null((el$overrides %||% list())$alto)) {
      el$overrides$alto <- alto_slot
    }
    .plan_render_element_degradable(.render_element_impl, el)
  }

  .render_element_impl <- function(el) {

    if (is.null(el) || !inherits(el, "ppt_element")) {
      .slide_abort_render(".render_element(): `el` debe ser `ppt_element`.")
    }

    etype <- el$.element_type %||% NA_character_
    if (is.na(etype) || !nzchar(etype)) {
      .slide_abort_render(".render_element(): elemento sin `.element_type`.")
    }
    if (identical(etype, "dim_radar_tabla")) {
      .slide_abort_render(
        "`dim_radar_tabla` fue retirado del flujo PPT. Use `p_dim_radar()` o `p_dim_heatmap()`."
      )
    }

    fn_name <- paste0(".render_", etype)
    if (!exists(fn_name, mode = "function", inherits = TRUE)) {
      .slide_abort_render("No existe renderer para etype='", etype, "' (se esperaba ", fn_name, "()).")
    }
    fn <- get(fn_name, mode = "function", inherits = TRUE)
    # Cómo se redondea no se decide por lámina: ver graficos_calculos_gobernados.R
    el$overrides <- .calculos_sanear_overrides(el$overrides %||% NULL)
    el <- .calculos_aplicar_nota(el, presets)

    # presets por tipo (si no existen, lista vacia)
    pa_apiladas <- presets$barras_apiladas$args %||% list()
    pa_multi    <- presets$multi_apiladas$args  %||% list()
    pa_agrup    <- presets$barras_agrupadas$args %||% list()
    pa_cat      <- presets$barras_categoricas$args %||% list()
    pa_num      <- presets$barras_numericas$args %||% list()
    pa_hist     <- presets$histograma$args %||% list()
    pa_box      <- presets$boxplot$args %||% list()
    pa_media_rng <- presets$media_rango$args %||% presets$boxplot$args %||% list()
    pa_nube     <- presets$nube_palabras$args %||% list()
    pa_pie      <- presets$pie$args %||% list()
    pa_donut    <- presets$donut$args %||% list()
    pa_radar    <- presets$radar_tabla$args %||% list()
    pa_dim_heat <- presets$dim_heatmap$args %||% list()
    pa_dim_heat_criterios <- presets$dim_heatmap_criterios$args %||% pa_dim_heat
    pa_dim_rad  <- presets$dim_radar$args %||% list()
    pa_dim_comp <- presets$dim_comparativo_radarbar$args %||% list()
    pa_dim_foda <- presets$dim_foda$args %||% list()

    # helper: llamar pasando SOLO args que la funcion soporte
    .call_keep_formals <- function(fun, args) {
      fml <- names(formals(fun))
      if ("..." %in% fml) return(do.call(fun, args))
      do.call(fun, args[names(args) %in% fml])
    }

    # Caso especial: multiapiladas (firma distinta)
    if (identical(etype, "barras_multiapiladas")) {
      # firma esperada: (el, preset_args_multi, preset_args_single)
      args <- list(
        el                = el,
        preset_args_multi  = pa_multi,
        preset_args_single = pa_apiladas
      )
      out <- tryCatch(.call_keep_formals(fn, args), error = identity)
      if (inherits(out, "error")) {
        .slide_abort_render(
          "Renderer encontrado (", fn_name, ") pero fallo al ejecutarse: ",
          conditionMessage(out)
        )
      }
      return(out)
    }

    # Mapeo estandar: (el, preset_args)
    preset_args <- switch(
      etype,
      barras_apiladas  = pa_apiladas,
      barras_agrupadas = pa_agrup,
      barras_categoricas = pa_cat,
      numerico         = pa_num,
      histograma       = pa_hist,
      boxplot          = pa_box,
      media_rango      = pa_media_rng,
      nube_palabras    = pa_nube,
      pie              = pa_pie,
      donut            = pa_donut,
      radar_tabla      = pa_radar,
      # `radar_publicos` es el mismo preset visto por el otro renderer: el modo
      # `publicos` del radar tiene su propio `etype` y sin esta entrada llegaba
      # con `preset_args` VACIO, asi que ninguna de las catorce claves `tabla_*`
      # del proyecto tenia efecto y la tabla se dibujaba con los defectos.
      radar_publicos   = pa_radar,
      dim_heatmap      = pa_dim_heat,
      dim_heatmap_criterios = pa_dim_heat_criterios,
      dim_radar        = pa_dim_rad,
      dim_comparativo_radarbar = pa_dim_comp,
      dim_foda         = pa_dim_foda,
      # default: si hay nuevos etypes, se intenta pasar lista vacia
      list()
    )

    args <- list(el = el, preset_args = preset_args)
    out <- tryCatch(.call_keep_formals(fn, args), error = identity)

    if (inherits(out, "error")) {
      # fallback final: intentar SOLO con `el` (por si un renderer nuevo no usa presets)
      out2 <- tryCatch(do.call(fn, list(el = el)), error = identity)
      if (!inherits(out2, "error")) return(out2)

      .slide_abort_render(
        "Renderer encontrado (", fn_name, ") pero fallo al ejecutarse: ",
        conditionMessage(out)
      )
    }

    out
  }

  # --- Renderer para ggplot crudo (p_ggplot_raw) ---
  .render_ggplot_raw <- function(el, preset_args = list()) {
    el$gg
  }

  .render_mapa_cobertura_territorial <- function(el, preset_args = list()) {
    if (!exists("graficar_mapa_cobertura_territorial", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_mapa_cobertura_territorial()` en el entorno/paquete.", call. = FALSE)
    }
    overrides <- el$overrides %||% list()
    args <- .merge_args(
      list(
        contexto = el$contexto %||% list(),
        titulo = el$title_slide %||% NULL
      ),
      preset_args %||% list(),
      overrides
    )
    fun <- graficar_mapa_cobertura_territorial
    args <- .keep_formals(fun, args)
    suppressWarnings(do.call(fun, args))
  }

  .render_nube_palabras <- function(el, preset_args = list()) {
    if (!exists("graficar_nube_palabras", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_nube_palabras()` en el entorno/paquete.", call. = FALSE)
    }

    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    ctx <- .resolve_ref(var, arg_name = "var")
    dsrc <- .filter_data(filtros, source = ctx$source)
    if (!nrow(dsrc) || !ctx$var %in% names(dsrc)) {
      return(.blank_canvas(preset_args, overrides, mensaje = "Sin respuestas abiertas para mostrar"))
    }

    text_vals <- .reporte_plan_clean_chr(dsrc[[ctx$var]])
    keep <- nzchar(text_vals) & .nonblank_open_text_for_nube(text_vals)
    parent_var <- el$parent_var %||% NULL
    if (!is.null(parent_var) && is.character(parent_var) && nzchar(trimws(parent_var))) {
      ctx_parent <- tryCatch(.resolve_ref(parent_var, source = ctx$source, arg_name = "parent_var"), error = function(e) NULL)
      if (!is.null(ctx_parent)) {
        parent_mask <- .parent_other_mask(dsrc, ctx_parent, .other_option_values(ctx_parent))
        if (length(parent_mask) == length(keep)) keep <- keep & parent_mask
      }
    }
    if (!any(keep)) {
      return(.blank_canvas(preset_args, overrides, mensaje = "Sin respuestas abiertas para mostrar"))
    }

    df_text <- data.frame(texto = text_vals[keep], stringsAsFactors = FALSE)

    base_args <- list(
      data = df_text,
      var_texto = "texto",
      titulo = el$title_slide %||% NULL,
      subtitulo = NULL,
      nota_pie = NULL,
      font_family = presets$base$args$font_family_ppt %||% presets$base$args$font_family %||% "Arial"
    )

    args <- .merge_args(base_args, preset_args %||% list(), overrides)
    fun <- graficar_nube_palabras
    args <- .keep_formals(fun, args)
    suppressWarnings(do.call(fun, args))
  }

  .render_barras_apiladas <- function(el, preset_args) {
    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    # H29: con cruce delega en multiapiladas modo "cruce" (fila por grupo).
    cruce_ref <- .extract_ref_values(el$cruces %||% overrides$cruces %||% NULL)
    cruce_ref <- cruce_ref[!is.na(cruce_ref) & nzchar(trimws(cruce_ref))]
    if (length(cruce_ref)) {
      el$modo <- "cruce"
      el$cruce <- cruce_ref[[1]]
      el$.element_type <- "barras_multiapiladas"
      return(.render_element_impl(el))
    }
    excluir_opciones <- .reporte_plan_excluir_cascada(preset_args, overrides, el)
    ctx_excluir <- .resolve_ref(var, arg_name = "var")
    excluir_opciones <- .exclusion_for_ctx(ctx_excluir, excluir_opciones)
    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(.blank_canvas(preset_args, overrides))

    # N desde Total si existe
    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = TRUE)
    tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
    excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))

    if (!nrow(tab)) return(.blank_canvas(preset_args, overrides))
    if ((excluded_any && !.reporte_plan_is_select_multiple(var)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
    if (!is.finite(N_total) || N_total <= 0) return(.blank_canvas(preset_args, overrides))

    # paleta auto (paleta_<listname>) y orden institucional del instrumento
    ln <- .list_name_of_var(var)
    ctx_paleta <- .resolve_ref(var, arg_name = "var")
    colores_grupos <- .paleta_auto(ln, env_diapos)
    ordered_opts <- .reporte_plan_ordered_stack_levels(
      ln,
      as.character(tab$Opciones),
      choices_use = ctx_paleta$choices,
      palette_names = names(colores_grupos %||% NULL)
    )
    idx_order <- match(ordered_opts, as.character(tab$Opciones), nomatch = 0L)
    idx_order <- idx_order[idx_order > 0L]
    if (length(idx_order)) tab <- tab[idx_order, , drop = FALSE]
    etiquetas_opts <- .reporte_plan_labels_for_levels(
      ln,
      as.character(tab$Opciones),
      choices_use = ctx_paleta$choices
    )
    leyenda_opts <- .reporte_plan_legend_labels_for_levels(
      ln,
      as.character(tab$Opciones),
      choices_use = ctx_paleta$choices
    )
    if (is.null(colores_grupos) || !length(colores_grupos)) {
      colores_grupos <- .reporte_plan_pulso_palette_for_levels(etiquetas_opts)
    }
    colores_grupos <- .reporte_plan_palette_for_levels(
      ln,
      etiquetas_opts,
      choices_use = ctx_paleta$choices,
      palette = colores_grupos
    )

    pct_exacto  <- .calculos_pct_exacto(tab$n)
    cols_pct <- paste0("pct_", seq_len(nrow(tab)))
    cols_n <- paste0("n_", seq_len(nrow(tab)))

    ocultar_categoria_word <- isTRUE(el$.word_render) &&
      isTRUE(overrides$word_ocultar_etiqueta_categoria %||%
               preset_args$word_ocultar_etiqueta_categoria %||%
               TRUE)
    ocultar_categoria <- isTRUE(overrides$ocultar_etiqueta_categoria %||%
                                  preset_args$ocultar_etiqueta_categoria %||%
                                  FALSE) ||
      ocultar_categoria_word

    df_wide <- tibble::tibble(
      categoria = if (ocultar_categoria) "" else .title_of_var(var),
      N         = N_total
    )
    for (i in seq_along(cols_pct)) {
      df_wide[[cols_pct[i]]] <- pct_exacto[i] / 100
      df_wide[[cols_n[i]]] <- suppressWarnings(as.numeric(tab$n[i]))
    }

    etiquetas_grupos <- stats::setNames(etiquetas_opts, cols_pct)

    if (!exists("graficar_barras_apiladas", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_barras_apiladas()` en el entorno/paquete.", call. = FALSE)
    }

    # base args minimos + preset_args + overrides
    base_args <- list(
      data             = df_wide,
      var_categoria    = "categoria",
      var_n            = "N",
      cols_porcentaje  = cols_pct,
      etiquetas_grupos = etiquetas_grupos,
      etiquetas_leyenda = stats::setNames(leyenda_opts, etiquetas_opts),
      cols_n           = stats::setNames(cols_n, cols_pct),
      mostrar_n_en_etiquetas = FALSE,
      escala_valor     = "proporcion_1",
      colores_grupos   = colores_grupos,
      titulo           = NULL,
      subtitulo        = NULL,
      # Doctrina de Gonzalo (B36): la base vive en la esquina inferior
      # IZQUIERDA del SLIDE (su placeholder de base), no como caption del
      # grafico. El analista puede reactivarla via overrides$nota_pie.
      nota_pie         = NULL
    )

    # merge: base_args <- preset_args <- overrides (overrides manda)
    preset_args <- preset_args %||% list()
    preset_args$excluir_opciones <- NULL
    overrides$excluir_opciones <- NULL
    if (ocultar_categoria_word) {
      overrides <- .collapse_y_label_space_word(overrides)
    }

    args <- .merge_args(base_args, preset_args, overrides)
    args <- .reservar_pie_para_base_slide(args, word_render = isTRUE(el$.word_render))
    fun  <- graficar_barras_apiladas
    args <- .force_canvas_args(fun, args)
    args <- .keep_formals(fun, args)
    suppressWarnings(do.call(fun, args))
  }


  .render_barras_multiapiladas <- function(el, preset_args_multi, preset_args_single) {

    `%||%` <- function(x, y) if (!is.null(x)) x else y

    modo <- el$modo %||% "var"
    filtros <- el$filtros %||% list()
    preset_args_multi  <- preset_args_multi  %||% list()
    preset_args_single <- preset_args_single %||% list()
    overrides          <- el$overrides %||% list()
    excluir_opciones <- .reporte_plan_excluir_cascada(
      preset_args_single, overrides, el, preset_args_extra = preset_args_multi
    )
    preset_args_single$excluir_opciones <- NULL
    preset_args_multi$excluir_opciones <- NULL
    overrides$excluir_opciones <- NULL
    incluir_sin_n <- TRUE
    # H31: el$wrap_y (decision por grafico) gana al preset de tipo.
    wrap_y_eff <- overrides$ancho_max_eje_y %||% overrides$wrap_y %||%
      el$ancho_max_eje_y %||% el$wrap_y %||%
      preset_args_multi$ancho_max_eje_y %||% preset_args_multi$wrap_y %||%
      preset_args_single$ancho_max_eje_y %||% preset_args_single$wrap_y %||%
      50
    wrap_y_eff <- suppressWarnings(as.numeric(wrap_y_eff)[1])
    if (!is.finite(wrap_y_eff) || is.na(wrap_y_eff) || wrap_y_eff < 10) {
      wrap_y_eff <- 50
    }

    # ============================================================
    # helpers locales
    # ============================================================
    .clean_chr <- function(x) {
      x <- as.character(x)
      x[is.na(x)] <- ""
      trimws(x)
    }

    .ordered_stack_levels <- function(list_name,
                                      observed_opts,
                                      choices_use = NULL,
                                      palette_names = NULL) {
      .reporte_plan_ordered_stack_levels(
        list_name = list_name,
        observed_opts = observed_opts,
        choices_use = choices_use,
        palette_names = palette_names
      )
    }

    .apply_top2box_alias <- function(base_args) {
      if (!isTRUE(el$top2box)) return(base_args)

      base_args$mostrar_barra_extra <- TRUE
      base_args$barra_extra_preset  <- "top2box"
      if (!is.null(el$top2box_labels) && length(el$top2box_labels)) {
        base_args$top2box_labels <- el$top2box_labels
      }
      if (is.null(base_args$titulo_barra_extra) || !nzchar(base_args$titulo_barra_extra)) {
        # «TOP TWO BOX», como lo escribe el entregable aprobado en sus 41
        # laminas. Ademas de coherencia, la forma importa para medir: buscando
        # «Top 2 Box» el conteo sobre el aprobado devolvia 0 columnas cuando
        # tiene 40.
        base_args$titulo_barra_extra <- "TOP TWO BOX"
      }
      col_extra <- as.character(base_args$color_barra_extra %||% "")[1]
      if (is.na(col_extra)) col_extra <- ""
      col_extra <- trimws(col_extra)
      if (!nzchar(col_extra) || identical(toupper(col_extra), "#081F5C")) {
        base_args$color_barra_extra <- "#70AD47"
      }

      base_args
    }

    .resolve_cruce_levels <- function(dsrc, cruce_name, survey_use, orders_list_use) {
      cm <- .radar_cruce_map(
        data        = dsrc,
        cruce       = cruce_name,
        survey      = survey_use,
        orders_list = orders_list_use,
        env_paletas = env_diapos
      )
      lvls_keys   <- .clean_chr(cm$keys)
      lvls_labels <- .clean_chr(cm$labels)
      keep <- nzchar(lvls_keys) & nzchar(lvls_labels)
      lvls_keys   <- lvls_keys[keep]
      lvls_labels <- lvls_labels[keep]

      if (!length(lvls_keys) || !length(lvls_labels)) {
        x <- .clean_chr(dsrc[[cruce_name]])
        lvls_keys <- sort(unique(x[nzchar(x)]))
        lvls_labels <- lvls_keys
      }

      list(keys = lvls_keys, labels = lvls_labels)
    }

    .multilista_wrap_lines <- function(x, width) {
      x <- .clean_chr(x)
      x <- x[nzchar(x)]
      if (!length(x)) return(0L)

      if (requireNamespace("stringr", quietly = TRUE)) {
        wrapped <- stringr::str_wrap(x, width = width)
        sum(lengths(strsplit(wrapped, "\n", fixed = TRUE)))
      } else {
        length(x)
      }
    }

    # Las lineas que ocupa un ENUNCIADO de grupo, medidas en su canal real.
    #
    # P45. El estimador de altura contaba estos enunciados con el mismo
    # `block_wrap` que las etiquetas del eje, y ahi hay dos magnitudes
    # distintas bajo la misma idea: `ancho_max_eje_y`/`wrap_y` son el
    # envoltorio del EJE, y el enunciado vive en el canal lateral, que es mas
    # estrecho. Con el 50 de reserva contaba 4 lineas donde el canal da 6, y el
    # bloque acababa con la mitad del alto que pedia. El detalle medido esta
    # anotado en `.multilista_block_height()`.
    #
    # Aqui se mide con `.barras_wrap_titulo_grupo()`, que es lo mismo que usa
    # el graficador al dibujarlos. Se mide al cuerpo DECLARADO: si luego el
    # graficador lo achica para que quepa (P46), el reparto ya le habra dado
    # sitio de sobra, que es la direccion segura.
    #
    # El estimador viejo queda de respaldo para cuando no haya canal declarado.
    .multilista_lineas_enunciado <- function(x, wrap_respaldo, block_overrides) {
      w <- block_overrides$canvas_w_grupo %||%
        preset_args_multi$canvas_w_grupo %||%
        preset_args_single$canvas_w_grupo
      a <- (el$overrides %||% list())$ancho
      s <- block_overrides$size_titulos_grupo %||%
        preset_args_multi$size_titulos_grupo %||%
        preset_args_single$size_titulos_grupo %||% 14
      fam <- block_overrides$font_family %||%
        preset_args_multi$font_family %||%
        preset_args_single$font_family %||% ""
      n <- .multilista_lineas_medidas(x, w, a, s, fam)
      if (is.na(n)) return(.multilista_wrap_lines(x, max(12, floor(wrap_respaldo * 0.8))))
      n
    }

    .multilista_block_height <- function(block_el) {
      if (!is.null(block_el$altura_rel)) {
        h <- suppressWarnings(as.numeric(block_el$altura_rel)[1])
        if (is.finite(h) && !is.na(h) && h > 0) return(h)
      }

      block_overrides <- block_el$overrides %||% list()
      block_wrap <- block_overrides$ancho_max_eje_y %||% block_overrides$wrap_y %||%
        block_el$ancho_max_eje_y %||% block_el$wrap_y %||%
        preset_args_multi$ancho_max_eje_y %||% preset_args_multi$wrap_y %||%
        preset_args_single$ancho_max_eje_y %||% preset_args_single$wrap_y %||% 50
      block_wrap <- suppressWarnings(as.numeric(block_wrap)[1])
      if (!is.finite(block_wrap) || is.na(block_wrap) || block_wrap < 10) block_wrap <- 50
      # P45, MEDIDO: ESTE 50 ES LA MITAD DEL ANCHO REAL, y de ahi sale que al
      # bloque que mas alto necesita se le de menos.
      #
      # `block_wrap` decide cuantas lineas cuenta este estimador para el
      # enunciado, y con eso se reparte la altura de la lamina entre sus
      # bloques. Pero 50 no es el ancho del canal del enunciado: el canal real
      # da entre 23 y 30 caracteres. Medido sobre «La Unidad facilita los medios
      # necesarios para que los estudiantes realicen actividades
      # extracurriculares…», el de la lamina 41:
      #
      #   wrap 50 -> 4 lineas      wrap 30 -> 7 lineas
      #   wrap 38 -> 5 lineas      wrap 23 -> 9 lineas
      #
      # O sea que cuenta la MITAD de las lineas que el enunciado ocupa de
      # verdad, y el bloque acaba con la mitad del alto que pedia. Se ve en el
      # reparto: en la lamina 41 el bloque de rampa —dos filas y un enunciado de
      # seis lineas— recibe **1.019 in** y el azul —tres filas, enunciado
      # corto—, **2.055**. Proporcion 1:2 cuando sus filas son 2:3. El
      # entregable aprobado hace lo contrario en su lamina 39: 1.622 al de dos
      # filas contra 2.052 al de tres, o sea 1:1.27.
      #
      # Y ademas los `%||%` de arriba caen en `ancho_max_eje_y` / `wrap_y`, que
      # son el envoltorio del EJE, no el del enunciado: dos magnitudes distintas
      # con el mismo nombre de idea.
      #
      # Lo que toca es medirlo con `.barras_wrap_titulo_grupo()` —que ya mide
      # con `grid::textGrob` y va memoizada— en vez de este 50. Antes de
      # cambiarlo hay que ver el efecto en el reparto de las mixtas Y en la
      # vara, porque mover la altura de los bloques mueve el grosor, que es B3.

      n_rows <- 1L
      title_lines <- 0L
      # Filas de leyenda del bloque: el plano fijo de abajo pagaba UNA y una
      # escala de cinco categorias ocupa DOS, asi que el bloque entraba en un
      # hueco mas corto que su canvas y `plot_grid()` lo comprimia hasta que la
      # segunda fila pisaba la primera (ver `.multilista_filas_leyenda_de_refs`).
      filas_leyenda <- 1L
      size_leyenda_blk <- block_overrides$size_leyenda %||%
        preset_args_multi$size_leyenda %||% preset_args_single$size_leyenda %||% 10

      if (identical(block_el$modo, "var")) {
        n_rows <- max(1L, length(block_el$vars %||% character(0)))
        if (length(block_el$vars %||% character(0))) {
          title_lines <- .multilista_wrap_lines(vapply(
            block_el$vars,
            function(v) .title_of_var(v),
            character(1)
          ), block_wrap)
        }
      } else if (identical(block_el$modo, "cruce")) {
        ctx_var <- .resolve_ref(block_el$var, arg_name = "var")
        ctx_cruce <- .resolve_ref(block_el$cruce, source = ctx_var$source, arg_name = "cruce")
        dsrc <- .filter_data(block_el$filtros %||% list(), source = ctx_var$source)
        lvls <- .resolve_cruce_levels(
          dsrc,
          ctx_cruce$var,
          survey_use = ctx_var$survey,
          orders_list_use = ctx_var$orders_list
        )
        n_rows <- max(1L, length(lvls$labels))
        title_lines <- .multilista_wrap_lines(lvls$labels, block_wrap)
      } else if (identical(block_el$modo, "var_cruce")) {
        if (is.list(block_el$vars) && !is.character(block_el$vars)) {
          n_rows <- sum(lengths(block_el$vars))
          filas_leyenda <- .multilista_filas_leyenda_de_refs(.extract_ref_values(block_el$vars),
            .resolve_ref, .shared_scale_spec, size_leyenda_blk)
          tg <- block_el$titulos_grupo %||% character(0)
          lines_group <- 0L
          for (nm in names(block_el$vars)) {
            ttl <- .named_lookup(tg, nm, default = nm)
            lines_group <- lines_group + .multilista_lineas_enunciado(ttl, block_wrap, block_overrides)
          }
          title_lines <- lines_group
        } else {
          ctx_vars <- lapply(block_el$vars, .resolve_ref, arg_name = "vars")
          ctx_cruce <- .resolve_ref(block_el$cruce, source = ctx_vars[[1]]$source, arg_name = "cruce")
          dsrc <- .filter_data(block_el$filtros %||% list(), source = ctx_vars[[1]]$source)
          lvls <- .resolve_cruce_levels(
            dsrc,
            ctx_cruce$var,
            survey_use = ctx_vars[[1]]$survey,
            orders_list_use = ctx_vars[[1]]$orders_list
          )
          n_rows <- max(1L, length(block_el$vars) * length(lvls$labels))
          tg <- block_el$titulos_grupo %||% character(0)
          title_lines <- 0L
          for (v in block_el$vars) {
            ttl <- .named_lookup(tg, v, default = .title_of_var(v))
            title_lines <- title_lines + .multilista_lineas_enunciado(ttl, block_wrap, block_overrides)
          }
        }
      }

      show_legend <- block_overrides$mostrar_leyenda %||%
        preset_args_multi$mostrar_leyenda %||% preset_args_single$mostrar_leyenda %||% TRUE

      show_extra <- block_overrides$mostrar_barra_extra %||%
        isTRUE(block_el$top2box) ||
        (!is.null(block_overrides$barra_extra_preset) &&
           !identical(block_overrides$barra_extra_preset, "ninguno"))

      min_rows <- block_overrides$canvas_min_filas %||%
        preset_args_multi$canvas_min_filas %||%
        preset_args_single$canvas_min_filas %||%
        1L
      min_rows <- suppressWarnings(as.numeric(min_rows)[1])
      if (!is.finite(min_rows) || is.na(min_rows) || min_rows < 1) min_rows <- 1
      n_rows_eff <- max(1, n_rows, min_rows)

      uses_canvas <- block_overrides$usar_canvas %||%
        preset_args_multi$usar_canvas %||%
        preset_args_single$usar_canvas %||%
        TRUE
      if (isTRUE(uses_canvas) && n_rows == 1L) {
        n_rows_eff <- max(n_rows_eff, 2)
      }

      alto <- 0.85 +
        (0.90 * n_rows_eff) +
        (0.18 * title_lines) +
        if (isTRUE(show_legend)) 0.70 * max(1L, filas_leyenda) else 0 +
        if (isTRUE(show_extra)) 0.25 else 0

      # `n_rows` y las lineas de etiqueta salen ya calculados aqui; se cuelgan
      # del alto para que el reparto de bloques pueda pedir el paso de fila de
      # cada uno sin repetir el calculo. Ver `graficador_row_step.R`.
      attr(alto, "n_rows") <- n_rows_eff
      attr(alto, "title_lines") <- title_lines
      alto
    }

    if (identical(modo, "multilista")) {
      bloques <- el$bloques %||% list()
      if (!length(bloques)) return(NULL)
      if (!requireNamespace("cowplot", quietly = TRUE)) {
        stop("multiapiladas (modo='multilista'): se requiere cowplot.", call. = FALSE)
      }

      alturas_bloque <- lapply(bloques, .multilista_block_height)
      rel_heights_plan <- vapply(alturas_bloque, function(a) as.numeric(a)[1], numeric(1))

      # Base por publico de TODA la lamina: el graficador ve una pregunta por
      # llamada y no puede deducirla. Ver `graficador_n_por_barra.R`.
      n_obs <- numeric(0); n_pub <- character(0)
      for (bq in bloques) {
        for (r in .extract_ref_values(bq$vars %||% character(0))) {
          ctx <- tryCatch(.resolve_ref(r, arg_name = "var"), error = function(e) NULL)
          if (is.null(ctx)) next
          tb <- tryCatch(.tab_freq(r, filtros = bq$filtros %||% list(), source = ctx$source),
                         error = function(e) NULL)
          if (is.null(tb) || !all(c("Opciones", "n") %in% names(tb))) next
          it <- which(tb$Opciones == "Total")
          if (!length(it)) next
          n_obs <- c(n_obs, suppressWarnings(as.numeric(tb$n[it[1]])))
          n_pub <- c(n_pub, as.character(ctx$source))
        }
      }
      bases_publico <- .n_barra_bases_de_lamina(n_obs, n_pub)

      # Paso de fila COMUN. Cada bloque lo calculaba con SUS categorias, asi que
      # en una lamina con un bloque de escala y otro dicotomico las barras
      # salian a 1.19 y 0.90 cm —la fraccion era 0.33 contra 0.26—. Se toma el
      # mayor: es el unico que cubre el texto de todos.
      row_step_comun <- .apiladas_row_step_comun(vapply(alturas_bloque, function(a) {
        .apiladas_row_step(
          attr(a, "n_rows") %||% NA_real_,
          attr(a, "title_lines") %||% NA_real_
        )
      }, numeric(1)))

      # El reparto de alto tiene que seguir al paso. Con el paso comun impuesto,
      # un bloque de tres filas ocupa 3 x paso unidades y uno de dos, 2 x paso;
      # si `rel_heights` no lo refleja, el primero mete mas unidades en el mismo
      # espacio fisico y SUS barras adelgazan —medido: la escala de «Mecanismos
      # de admision» caia a 0.66 cm contra el piso de 0.77—.
      if (!is.null(row_step_comun)) {
        rel_heights_plan <- vapply(seq_along(alturas_bloque), function(k) {
          a <- alturas_bloque[[k]]
          n <- suppressWarnings(as.numeric(attr(a, "n_rows") %||% NA_real_)[1])
          alto <- as.numeric(a)[1]
          if (!is.finite(n) || n <= 0) return(alto)
          # Se infla solo la parte proporcional a las filas; el cromo del bloque
          # —titulo, leyenda, columna extra— no depende del paso.
          filas <- 0.90 * n
          (alto - filas) + filas * row_step_comun
        }, numeric(1))
        rel_heights_plan[!is.finite(rel_heights_plan) | rel_heights_plan <= 0] <- 1
        rel_total <- sum(rel_heights_plan, na.rm = TRUE)
        if (!is.finite(rel_total) || rel_total <= 0) rel_total <- length(bloques)
      }
      rel_heights_plan[!is.finite(rel_heights_plan) | rel_heights_plan <= 0] <- 1
      rel_total <- sum(rel_heights_plan, na.rm = TRUE)
      if (!is.finite(rel_total) || rel_total <= 0) rel_total <- length(bloques)

      parent_aspect_yx <- overrides$legend_key_aspect_yx %||%
        preset_args_multi$legend_key_aspect_yx %||%
        preset_args_single$legend_key_aspect_yx %||%
        0.60
      parent_aspect_yx <- suppressWarnings(as.numeric(parent_aspect_yx)[1])
      if (!is.finite(parent_aspect_yx) || parent_aspect_yx <= 0) {
        parent_aspect_yx <- 0.60
      }

      rendered <- list()
      rel_heights <- numeric(0)
      for (idx_block in seq_along(bloques)) {
        block <- bloques[[idx_block]]
        # En multilista, cada subbloque debe renderizarse sin titulo/subtitulo
        # automaticos salvo que el usuario los haya pedido explicitamente.
        block_render <- block
        block_render$title_slide <- NULL
        block_render$overrides <- block_render$overrides %||% list()
        block_render$overrides$titulo <- block_render$.multilista_block_title %||% ""
        block_render$overrides$subtitulo <- block_render$.multilista_block_subtitle %||% ""
        # La exclusion se resolvio arriba y las tres fuentes quedaron en NULL; sin
        # reponerla aqui el subbloque la pierde y «SIN INF» vuelve al denominador
        # (93 % en vez de 94 % en la bateria p30 de acrconta).
        block_render$overrides$excluir_opciones <- block_render$overrides$excluir_opciones %||% excluir_opciones
        if (!is.null(row_step_comun) &&
            is.null(block_render$overrides$row_step_forzado)) {
          block_render$overrides$row_step_forzado <- row_step_comun
        }
        # La base por publico viaja al graficador para que pueda anotar la N de
        # las preguntas con salto de cuestionario.
        if (length(bases_publico)) {
          block_render$overrides$bases_publico <- bases_publico
        }
        # Y el tamano del cajon tambien: `.render_element()` se lo inyecto al
        # elemento PADRE, pero cada subbloque es un `ppt_element` propio que se
        # renderiza sin pasar por ahi. Sin esto el graficador se queda con el
        # default de su firma —diez pulgadas— y envuelve el enunciado contra un
        # canal que no es el suyo (P46). Ver `.multilista_heredar_cajon()`.
        block_render$overrides <- .multilista_heredar_cajon(
          block_render$overrides, el$overrides %||% list()
        )
        if (is.null(block_render$overrides$legend_key_aspect_yx)) {
          block_aspect_yx <- parent_aspect_yx * (rel_heights_plan[[idx_block]] / rel_total)
          block_render$overrides[c("legend_key_aspect_yx", "titulos_grupo_alto_rel")] <- list(max(0.08, min(parent_aspect_yx, block_aspect_yx)), rel_heights_plan[[idx_block]] / rel_total)
        }

        p_block <- .render_barras_multiapiladas(
          block_render,
          preset_args_multi = preset_args_multi,
          preset_args_single = preset_args_single
        )
        if (is.null(p_block)) next
        rendered[[length(rendered) + 1L]] <- p_block
        rel_heights <- c(rel_heights, rel_heights_plan[[idx_block]])
      }

      if (!length(rendered)) {
        return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
      }

      return(cowplot::plot_grid(
        plotlist = rendered,
        ncol = 1,
        align = "v",
        rel_heights = rel_heights
      ))
    }

    # ============================================================
    # MODO "var"
    # ============================================================
    if (identical(modo, "var")) {

      vars <- el$vars
      if (!is.character(vars) || length(vars) < 1L) return(NULL)
      vars <- trimws(vars); vars <- vars[nzchar(vars)]
      if (!length(vars)) return(NULL)

      ctxs <- lapply(vars, .resolve_ref, arg_name = "vars")

      scale_spec <- .shared_scale_spec(ctxs, arg_name = "var")
      ln <- scale_spec$list_name

      colores_grupos <- .paleta_auto(ln, env_diapos)
      choices_use <- scale_spec$choices
      excluir_opciones <- .exclusion_for_choices(ln, choices_use, excluir_opciones)

      rows <- list()
      all_opts <- character(0)
      tabs_by_v <- list()
      N_by_v <- numeric(0)
      labels_by_v <- character(0)

      for (i in seq_along(vars)) {
        v <- vars[i]
        ctx_v <- ctxs[[i]]
        tab <- .tab_freq(v, filtros = filtros)
        if (is.null(tab) || !nrow(tab)) next
        tab <- .canonizar_freq_a_escala(tab, ctx_v, scale_spec)

        N_total <- NA_real_
        if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
          idx_tot <- which(tab$Opciones == "Total")
          if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
        }

        tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = incluir_sin_n)
        tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
        excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))

        if (!nrow(tab)) next
        if ((excluded_any && !.reporte_plan_is_select_multiple(v)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
        if (!is.finite(N_total) || N_total <= 0) next

        tabs_by_v[[v]] <- tab
        N_by_v[v] <- N_total
        labels_by_v[v] <- as.character(.named_lookup(el$overrides$etiquetas_vars, v, .title_of_var(v)))[1]
        all_opts <- union(all_opts, as.character(tab$Opciones))
      }

      if (!length(tabs_by_v)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))

      all_opts <- .ordered_stack_levels(
        ln,
        all_opts,
        choices_use = choices_use,
        palette_names = names(colores_grupos %||% NULL)
      )
      if (is.null(colores_grupos) || !length(colores_grupos)) {
        colores_grupos <- .reporte_plan_pulso_palette_for_levels(
          .reporte_plan_labels_for_levels(ln, all_opts, choices_use = choices_use)
        )
      }
      labels_opts <- .reporte_plan_labels_for_levels(ln, all_opts, choices_use = choices_use)
      leyenda_opts <- .reporte_plan_legend_labels_for_levels(ln, all_opts, choices_use = choices_use)
      colores_grupos <- .reporte_plan_palette_for_levels(
        ln,
        labels_opts,
        choices_use = choices_use,
        palette = colores_grupos
      )

      cols_pct <- paste0("pct_", seq_along(all_opts))
      cols_n <- paste0("n_", seq_along(all_opts))
      etiquetas_grupos <- stats::setNames(labels_opts, cols_pct)

      duplicated_labels <- duplicated(labels_by_v) | duplicated(labels_by_v, fromLast = TRUE)
      labels_by_v <- .oe_labels_for_visible_order(
        labels_by_v,
        el,
        refs = names(labels_by_v)
      )

      # En Word con una sola variable, el label puede salir como titulo arriba.
      single_word_var <- isTRUE(el$.word_sin_grupo) && length(vars) == 1L
      hide_single_word_label <- single_word_var &&
        isTRUE(overrides$word_ocultar_etiqueta_categoria %||%
                 preset_args_multi$word_ocultar_etiqueta_categoria %||%
                 preset_args_single$word_ocultar_etiqueta_categoria %||%
                 TRUE)

      for (v in vars) {
        tab <- tabs_by_v[[v]]
        if (is.null(tab)) next

        ctx_v <- .resolve_ref(v, arg_name = "vars")
        if (hide_single_word_label) {
          label_v <- ""
        } else {
          label_v <- labels_by_v[[v]] %||% .title_of_var(v)
          if (isTRUE(duplicated_labels[match(v, names(labels_by_v))])) {
            label_v <- .pretty_source_label(ctx_v$source)
          }
          if (requireNamespace("stringr", quietly = TRUE)) {
            label_v <- stringr::str_wrap(label_v, width = wrap_y_eff)
          }
        }

        pct_exacto <- .calculos_pct_exacto(tab$n)
        names(pct_exacto) <- as.character(tab$Opciones)
        n_int <- suppressWarnings(as.numeric(tab$n))
        names(n_int) <- as.character(tab$Opciones)

        row <- tibble::tibble(
          categoria = label_v,
          N         = unname(N_by_v[v])
        )
        for (i in seq_along(all_opts)) {
          opt <- all_opts[i]
          row[[cols_pct[i]]] <- (pct_exacto[opt] %||% 0) / 100
          row[[cols_n[i]]] <- n_int[opt] %||% 0
        }
        rows[[length(rows) + 1]] <- row
      }

      if (!length(rows)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
      df_block <- dplyr::bind_rows(rows)

      actor_caption <- .format_actor_base_caption_from_refs(names(N_by_v), N_by_v)

      base_args <- list(
        data             = df_block,
        var_categoria    = "categoria",
        var_n            = "N",
        cols_porcentaje  = cols_pct,
        etiquetas_grupos = etiquetas_grupos,
        etiquetas_leyenda = stats::setNames(leyenda_opts, labels_opts),
        cols_n           = stats::setNames(cols_n, cols_pct),
        mostrar_n_en_etiquetas = FALSE,
        escala_valor     = "proporcion_1",
        colores_grupos   = colores_grupos,
        titulo           = NULL,
        subtitulo        = NULL,
        nota_pie         = NULL
      )

      base_args <- .apply_top2box_alias(base_args)

      # Word, una sola variable: el titulo ya sale como encabezado del bloque,
      # por lo que no debe reservarse columna izquierda para una etiqueta vacia.
      if (hide_single_word_label) {
        overrides <- .collapse_y_label_space_word(overrides)
      }

      args <- .merge_args(base_args, preset_args_single, preset_args_multi, overrides)
      args <- .reservar_pie_para_base_slide(args, min_in = .PLAN_RESERVA_PIE_MULTI_IN, word_render = isTRUE(el$.word_render))
      args$ancho_max_eje_y <- wrap_y_eff  # sin re-wrap del graficador (H31)
      fun  <- graficar_barras_apiladas
      args <- .force_canvas_args(fun, args)
      args <- .keep_formals(fun, args)
      return(.with_actor_base_caption(suppressWarnings(do.call(fun, args)), actor_caption))
    }

    # ============================================================
    # MODO "cruce" (NUEVO)
    #   - 1 fila por nivel del cruce
    #   - segmentos = opciones de `var`
    # ============================================================
    if (identical(modo, "cruce")) {

      var   <- el$var %||% NULL
      cruce <- el$cruce %||% NULL

      if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) return(NULL)
      if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
        stop("multiapiladas (modo='cruce'): falta `cruce` (character(1)).", call. = FALSE)
      }
      ctx_var <- .resolve_ref(var, arg_name = "var")
      ctx_cruce <- .resolve_ref(cruce, source = ctx_var$source, arg_name = "cruce")
      dsrc <- .filter_data(filtros, source = ctx_var$source)
      if (!nrow(dsrc)) {
        return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
      }
      var <- ctx_var$var
      cruce <- ctx_cruce$var

      # --- segmentos: opciones de var (y paleta de var)
      ln_var <- .list_name_from_ctx(ctx_var)
      if (is.na(ln_var) || !nzchar(ln_var)) {
        stop("multiapiladas (modo='cruce'): no se encontro list_name para `var`=", var, call. = FALSE)
      }
      excluir_opciones <- .exclusion_for_ctx(ctx_var, excluir_opciones)
      colores_grupos <- .paleta_auto(ln_var, env_diapos)

      # --- niveles del cruce (keys para filtrar + labels para mostrar) usando instrumento
      cruce_levels <- .resolve_cruce_levels(
        dsrc,
        cruce,
        survey_use = ctx_var$survey,
        orders_list_use = ctx_var$orders_list
      )
      lvls_keys   <- cruce_levels$keys
      lvls_labels <- cruce_levels$labels

      # --- primero, descubrir el set de opciones (segmentos) de var (sobre total)
      tab_total <- .tab_freq(var, filtros = filtros)
      if (is.null(tab_total) || !nrow(tab_total)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))

      tab_total <- .reporte_plan_prepare_freq_options(tab_total, incluir_sin_n = incluir_sin_n)
      tab_total <- .reporte_plan_filter_freq_options(tab_total, excluir_opciones)

      if (!nrow(tab_total)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))

      all_opts <- as.character(tab_total$Opciones)

      all_opts <- .ordered_stack_levels(
        ln_var,
        all_opts,
        choices_use = ctx_var$choices,
        palette_names = names(colores_grupos %||% NULL)
      )
      if (is.null(colores_grupos) || !length(colores_grupos)) {
        colores_grupos <- .reporte_plan_pulso_palette_for_levels(
          .reporte_plan_labels_for_levels(ln_var, all_opts, choices_use = ctx_var$choices)
        )
      }
      labels_opts <- .reporte_plan_labels_for_levels(ln_var, all_opts, choices_use = ctx_var$choices)
      leyenda_opts <- .reporte_plan_legend_labels_for_levels(ln_var, all_opts, choices_use = ctx_var$choices)
      colores_grupos <- .reporte_plan_palette_for_levels(
        ln_var,
        labels_opts,
        choices_use = ctx_var$choices,
        palette = colores_grupos
      )

      cols_pct <- paste0("pct_", seq_along(all_opts))
      cols_n <- paste0("n_", seq_along(all_opts))
      etiquetas_grupos <- stats::setNames(labels_opts, cols_pct)

      # --- construir 1 fila por nivel del cruce
      rows <- list()

      x_cruce <- .clean_chr(dsrc[[cruce]])

      for (j in seq_along(lvls_keys)) {

        key_j <- lvls_keys[j]
        lab_j <- lvls_labels[j]

        mask <- nzchar(x_cruce) & (x_cruce == .clean_chr(key_j))

        dsub <- dsrc[mask, , drop = FALSE]
        if (!nrow(dsub)) next

        tab <- freq_table_spss(
          dsub,
          var,
          survey        = ctx_var$survey,
          sm_vars_force = NULL,
          orders_list   = ctx_var$orders_list,
          mostrar_todo  = TRUE
        )

        if (is.null(tab) || !nrow(tab)) next

        # N desde Total si existe
        N_total <- NA_real_
        if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
          idx_tot <- which(tab$Opciones == "Total")
          if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
        }

        tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = incluir_sin_n)
        tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
        excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))

        if (!nrow(tab)) next
        if ((excluded_any && !.reporte_plan_is_select_multiple(var)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
        if (!is.finite(N_total) || N_total <= 0) next

        # pct enteros a 100 dentro del grupo
        pct_exacto <- .calculos_pct_exacto(tab$n)
        names(pct_exacto) <- as.character(tab$Opciones)
        n_int <- suppressWarnings(as.numeric(tab$n))
        names(n_int) <- as.character(tab$Opciones)

        cat_j <- as.character(lab_j)
        if (requireNamespace("stringr", quietly = TRUE)) {
          cat_j <- stringr::str_wrap(cat_j, width = wrap_y_eff)
        }

        row <- tibble::tibble(
          categoria = cat_j,
          N         = N_total
        )
        for (i in seq_along(all_opts)) {
          opt <- all_opts[i]
          row[[cols_pct[i]]] <- (pct_exacto[opt] %||% 0) / 100
          row[[cols_n[i]]] <- n_int[opt] %||% 0
        }

        rows[[length(rows) + 1]] <- row
      }

      if (!length(rows)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
      df_block <- dplyr::bind_rows(rows)

      base_args <- list(
        data             = df_block,
        var_categoria    = "categoria",
        var_n            = "N",
        cols_porcentaje  = cols_pct,
        etiquetas_grupos = etiquetas_grupos,
        etiquetas_leyenda = stats::setNames(leyenda_opts, labels_opts),
        cols_n           = stats::setNames(cols_n, cols_pct),
        mostrar_n_en_etiquetas = FALSE,
        escala_valor     = "proporcion_1",
        colores_grupos   = colores_grupos,
        titulo           = NULL,
        subtitulo        = NULL,
        nota_pie         = NULL
      )

      base_args <- .apply_top2box_alias(base_args)

      # Significancia entre los grupos del cruce. Aqui cada FILA es un grupo de
      # personas distinto, asi que el contraste por segmento es el mismo que en
      # agrupadas sobre el layout transpuesto (ver graficos_significancia.R).
      sig_activa <- isTRUE(
        overrides$mostrar_significancia %||%
        preset_args_multi$mostrar_significancia %||%
        preset_args_single$mostrar_significancia
      )
      base_args <- .graficos_sig_aplicar_transpuesto(
        base_args         = base_args,
        df_block          = df_block,
        cols_n            = cols_n,
        cols_porcentaje   = cols_pct,
        etiquetas_opciones = labels_opts,
        activo            = sig_activa,
        alpha             = overrides$significancia_alpha %||%
                            preset_args_multi$significancia_alpha %||%
                            preset_args_single$significancia_alpha %||% 0.05,
        diseno            = .graficos_sig_diseno_de_fuente(ctx_var$instrumento, var)
      )
      nota_sig <- base_args$nota_pie_significancia
      base_args$nota_pie_significancia <- NULL
      if (!is.null(nota_sig) && nzchar(nota_sig) &&
          is.null(overrides$nota_pie) && is.null(preset_args_multi$nota_pie) &&
          is.null(preset_args_single$nota_pie)) {
        base_args$nota_pie <- nota_sig
      }
      for (k in c("mostrar_significancia", "significancia_alpha")) {
        overrides[[k]] <- NULL
        preset_args_multi[[k]] <- NULL
        preset_args_single[[k]] <- NULL
      }

      args <- .merge_args(base_args, preset_args_single, preset_args_multi, overrides)
      args <- .reservar_pie_para_base_slide(args, min_in = .PLAN_RESERVA_PIE_MULTI_IN, word_render = isTRUE(el$.word_render))
      args$ancho_max_eje_y <- wrap_y_eff  # idem modo var: sin re-wrap (H31)
      fun  <- graficar_barras_apiladas
      args <- .force_canvas_args(fun, args)
      args <- .keep_formals(fun, args)
      return(suppressWarnings(do.call(fun, args)))
    }

    if (identical(modo, "var_cruce")) {

      vars  <- el$vars
      cruce <- el$cruce %||% NULL
      usar_layout_multiactor <- FALSE

      titulos_grupo  <- el$titulos_grupo %||% character(0)
      sin_grupo_word <- isTRUE(el$.word_sin_grupo)  # TRUE al renderizar para Word

      if (is.list(vars) && !is.character(vars)) {
        group_refs <- vars
        group_ids <- names(group_refs)
        if (!length(group_refs)) return(NULL)

        flat_refs <- .extract_ref_values(group_refs)
        ctx_all <- lapply(flat_refs, .resolve_ref, arg_name = "vars")
        src_all <- unique(vapply(ctx_all, `[[`, character(1), "source"))
        usar_layout_multiactor <- length(src_all) > 1L &&
          length(group_ids) > 0L && all(nzchar(trimws(group_ids)))

        if (!is.null(cruce) && nzchar(trimws(as.character(cruce)[1])) && length(src_all) > 1L) {
          stop("multiapiladas (modo='var_cruce'): cuando `vars` usa varias fuentes, `cruces` debe ser NULL.", call. = FALSE)
        }

        scale_spec <- .shared_scale_spec(ctx_all, arg_name = "var_cruce")
        ln <- scale_spec$list_name
        colores_grupos <- .paleta_auto(ln, env_diapos)
        choices_use <- scale_spec$choices
        excluir_opciones <- .exclusion_for_choices(ln, choices_use, excluir_opciones)

        all_opts <- character(0)
        valid_refs <- list()
        for (group_id in group_ids) {
          refs_i <- group_refs[[group_id]]
          refs_i <- refs_i[!is.na(refs_i) & nzchar(trimws(refs_i))]
          if (!length(refs_i)) next

          valid_refs[[group_id]] <- list()
          for (ref in refs_i) {
            tab_total <- .tab_freq(ref, filtros = filtros)
            if (is.null(tab_total) || !nrow(tab_total)) next

            tab_total <- .canonizar_freq_a_escala(
              tab_total, .resolve_ref(ref, arg_name = "vars"), scale_spec
            )
            tab_total <- .reporte_plan_prepare_freq_options(tab_total, incluir_sin_n = incluir_sin_n)
            tab_total <- .reporte_plan_filter_freq_options(tab_total, excluir_opciones)

            if (!nrow(tab_total)) next
            valid_refs[[group_id]][[ref]] <- .resolve_ref(ref, arg_name = "vars")
            all_opts <- union(all_opts, as.character(tab_total$Opciones))
          }

          if (!length(valid_refs[[group_id]])) {
            valid_refs[[group_id]] <- NULL
          }
        }

        if (!length(valid_refs) || !length(all_opts)) {
          return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
        }

        all_opts <- .ordered_stack_levels(
          ln,
          all_opts,
          choices_use = choices_use,
          palette_names = names(colores_grupos %||% NULL)
        )
        if (is.null(colores_grupos) || !length(colores_grupos)) {
          colores_grupos <- .reporte_plan_pulso_palette_for_levels(
            .reporte_plan_labels_for_levels(ln, all_opts, choices_use = choices_use)
          )
        }
        labels_opts <- .reporte_plan_labels_for_levels(ln, all_opts, choices_use = choices_use)
        leyenda_opts <- .reporte_plan_legend_labels_for_levels(ln, all_opts, choices_use = choices_use)
        colores_grupos <- .reporte_plan_palette_for_levels(
          ln,
          labels_opts,
          choices_use = choices_use,
          palette = colores_grupos
        )
        cols_pct <- paste0("pct_", seq_along(all_opts))
        cols_n <- paste0("n_", seq_along(all_opts))
        etiquetas_grupos <- stats::setNames(labels_opts, cols_pct)

        group_titles_visible <- vapply(names(valid_refs), function(group_id) {
          ttl <- .named_lookup(titulos_grupo, group_id, default = group_id)
          ttl <- as.character(ttl)[1]
          if (!nzchar(trimws(ttl))) group_id else ttl
        }, character(1))
        group_titles_visible <- .oe_labels_for_visible_order(
          group_titles_visible,
          el,
          refs = names(group_titles_visible)
        )

        rows <- list()
        for (group_id in names(valid_refs)) {
          refs_i <- valid_refs[[group_id]]
          if (!length(refs_i)) next

          group_title <- group_titles_visible[[group_id]] %||%
            .named_lookup(titulos_grupo, group_id, default = group_id)
          group_title <- as.character(group_title)[1]
          if (!nzchar(trimws(group_title))) group_title <- group_id
          if (requireNamespace("stringr", quietly = TRUE)) {
            # El wrap sigue al ancho REAL de la columna del tema, o ensancharla
            # no sirve de nada: medido, con la columna a 0.22 y el wrap intacto
            # el enunciado no cambió ni una línea.
            group_title <- stringr::str_wrap(group_title, width = .multiactor_wrap_tema(
              .reporte_plan_multiactor_canvas_defaults(
                TRUE, (presets$multi_apiladas_multiactor$args %||% list())
              )$canvas_w_grupo,
              wrap_y_eff))
          }

          filas_var <- 0L
          for (ref in names(refs_i)) {
            ctx_v <- refs_i[[ref]]
            tab <- .tab_freq(ref, filtros = filtros)
            if (is.null(tab) || !nrow(tab)) next
            tab <- .canonizar_freq_a_escala(tab, ctx_v, scale_spec)

            N_total <- NA_real_
            if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
              idx_tot <- which(tab$Opciones == "Total")
              if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
            }

            tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = incluir_sin_n)
            tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
            excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))

            if (!nrow(tab)) next
            if ((excluded_any && !.reporte_plan_is_select_multiple(ref)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
            if (!is.finite(N_total) || N_total <= 0) next

            pct_exacto <- .calculos_pct_exacto(tab$n)
            names(pct_exacto) <- as.character(tab$Opciones)
            n_int <- suppressWarnings(as.numeric(tab$n))
            names(n_int) <- as.character(tab$Opciones)

            cat_label <- .pretty_source_label(ctx_v$source)
            if (requireNamespace("stringr", quietly = TRUE)) {
              cat_label <- stringr::str_wrap(cat_label, width = wrap_y_eff)
            }

            row <- tibble::tibble(
              .categoria_id = paste0(group_id, "__", filas_var + 1L, "__", ctx_v$source),
              categoria     = cat_label,
              N             = N_total
            )
            if (!sin_grupo_word) {
              row$.grupo_id     <- group_id
              row$.grupo_titulo <- group_title
            }
            for (k in seq_along(all_opts)) {
              opt <- all_opts[k]
              row[[cols_pct[k]]] <- (pct_exacto[opt] %||% 0) / 100
              row[[cols_n[k]]] <- n_int[opt] %||% 0
            }

            rows[[length(rows) + 1L]] <- row
            filas_var <- filas_var + 1L
          }
        }
      } else {
        if (!is.character(vars) || length(vars) < 1L) return(NULL)
        vars <- trimws(vars)
        vars <- vars[nzchar(vars)]
        if (!length(vars)) return(NULL)

        if (!is.character(cruce) || length(cruce) != 1L || !nzchar(trimws(cruce))) {
          stop("multiapiladas (modo='var_cruce'): falta `cruce` (character(1)).", call. = FALSE)
        }
        source_use <- .single_source_for_refs(vars, arg_name = "vars")
        ctx_vars <- lapply(vars, .resolve_ref, source = source_use, arg_name = "vars")
        ctx_cruce <- .resolve_ref(cruce, source = source_use, arg_name = "cruce")
        dsrc <- .filter_data(filtros, source = source_use)
        if (!nrow(dsrc)) {
          return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
        }
        cruce <- ctx_cruce$var

        scale_spec <- .shared_scale_spec(ctx_vars, arg_name = "var_cruce")
        ln <- scale_spec$list_name
        colores_grupos <- .paleta_auto(ln, env_diapos)
        excluir_opciones <- .exclusion_for_choices(ln, scale_spec$choices, excluir_opciones)

        cruce_levels <- .resolve_cruce_levels(
          dsrc,
          cruce,
          survey_use = ctx_vars[[1]]$survey,
          orders_list_use = ctx_vars[[1]]$orders_list
        )
        lvls_keys   <- cruce_levels$keys
        lvls_labels <- cruce_levels$labels

        all_opts <- character(0)
        vars_con_datos <- list()
        for (i in seq_along(vars)) {
          v <- vars[i]
          tab_total <- .tab_freq(v, filtros = filtros)
          if (is.null(tab_total) || !nrow(tab_total)) next

          tab_total <- .canonizar_freq_a_escala(tab_total, ctx_vars[[i]], scale_spec)
          tab_total <- .reporte_plan_prepare_freq_options(tab_total, incluir_sin_n = incluir_sin_n)
          tab_total <- .reporte_plan_filter_freq_options(tab_total, excluir_opciones)

          if (!nrow(tab_total)) next
          vars_con_datos[[v]] <- ctx_vars[[i]]
          all_opts <- union(all_opts, as.character(tab_total$Opciones))
        }

        if (!length(vars_con_datos) || !length(all_opts)) {
          return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
        }

        all_opts <- .ordered_stack_levels(
          ln,
          all_opts,
          choices_use = scale_spec$choices,
          palette_names = names(colores_grupos %||% NULL)
        )
        if (is.null(colores_grupos) || !length(colores_grupos)) {
          colores_grupos <- .reporte_plan_pulso_palette_for_levels(
            .reporte_plan_labels_for_levels(ln, all_opts, choices_use = scale_spec$choices)
          )
        }
        labels_opts <- .reporte_plan_labels_for_levels(ln, all_opts, choices_use = scale_spec$choices)
        leyenda_opts <- .reporte_plan_legend_labels_for_levels(ln, all_opts, choices_use = scale_spec$choices)
        colores_grupos <- .reporte_plan_palette_for_levels(
          ln,
          labels_opts,
          choices_use = scale_spec$choices,
          palette = colores_grupos
        )
        cols_pct <- paste0("pct_", seq_along(all_opts))
        cols_n <- paste0("n_", seq_along(all_opts))
        etiquetas_grupos <- stats::setNames(labels_opts, cols_pct)

        vars_visibles <- names(vars_con_datos)
        group_titles_visible <- vapply(vars_visibles, function(v) {
          ctx_tmp <- vars_con_datos[[v]]
          ttl <- .named_lookup(titulos_grupo, ctx_tmp$raw_ref,
            default = .named_lookup(titulos_grupo, ctx_tmp$var, default = .title_of_var(v))
          )
          ttl <- as.character(ttl)[1]
          if (!nzchar(trimws(ttl))) .title_of_var(v) else ttl
        }, character(1))
        group_titles_visible <- .oe_labels_for_visible_order(
          group_titles_visible,
          el,
          refs = vars_visibles
        )

        rows <- list()
        x_cruce <- .clean_chr(dsrc[[cruce]])

        for (i in seq_along(vars)) {
          v <- vars[i]
          ctx_v <- vars_con_datos[[v]]
          if (is.null(ctx_v)) next

          group_title <- group_titles_visible[[v]] %||%
            .named_lookup(titulos_grupo, ctx_v$raw_ref,
              default = .named_lookup(titulos_grupo, ctx_v$var, default = .title_of_var(v))
            )
          group_title <- as.character(group_title)[1]
          if (!nzchar(trimws(group_title))) group_title <- .title_of_var(v)
          if (requireNamespace("stringr", quietly = TRUE)) {
            group_title <- stringr::str_wrap(group_title, width = max(12, floor(wrap_y_eff * 0.8)))
          }

          filas_var <- 0L
          for (j in seq_along(lvls_keys)) {
            key_j <- lvls_keys[j]
            lab_j <- lvls_labels[j]

            mask <- nzchar(x_cruce) & (x_cruce == .clean_chr(key_j))
            dsub <- dsrc[mask, , drop = FALSE]
            if (!nrow(dsub)) next

            tab <- freq_table_spss(
              dsub,
              ctx_v$var,
              survey        = ctx_v$survey,
              sm_vars_force = NULL,
              orders_list   = ctx_v$orders_list,
              mostrar_todo  = TRUE
            )

            if (is.null(tab) || !nrow(tab)) next
            tab <- .canonizar_freq_a_escala(tab, ctx_v, scale_spec)

            N_total <- NA_real_
            if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
              idx_tot <- which(tab$Opciones == "Total")
              if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
            }

            tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = incluir_sin_n)
            tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
            excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))

            if (!nrow(tab)) next
            if ((excluded_any && !.reporte_plan_is_select_multiple(ctx_v$var)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
            if (!is.finite(N_total) || N_total <= 0) next

            pct_exacto <- .calculos_pct_exacto(tab$n)
            names(pct_exacto) <- as.character(tab$Opciones)
            n_int <- suppressWarnings(as.numeric(tab$n))
            names(n_int) <- as.character(tab$Opciones)

            cat_label <- as.character(lab_j)
            if (requireNamespace("stringr", quietly = TRUE)) {
              cat_label <- stringr::str_wrap(cat_label, width = wrap_y_eff)
            }

            row <- tibble::tibble(
              .categoria_id = paste0(ctx_v$raw_ref, "__", filas_var + 1L, "__", key_j),
              categoria     = cat_label,
              N             = N_total
            )
            if (!sin_grupo_word) {
              row$.grupo_id     <- ctx_v$raw_ref
              row$.grupo_titulo <- group_title
            }
            for (k in seq_along(all_opts)) {
              opt <- all_opts[k]
              row[[cols_pct[k]]] <- (pct_exacto[opt] %||% 0) / 100
              row[[cols_n[k]]] <- n_int[opt] %||% 0
            }

            rows[[length(rows) + 1L]] <- row
            filas_var <- filas_var + 1L
          }
        }
      }

      if (!length(rows)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
      df_block <- dplyr::bind_rows(rows)

      actor_caption <- if (is.list(vars) && !is.character(vars) &&
                           any(grepl("$", .extract_ref_values(vars), fixed = TRUE))) {
        .format_actor_base_caption(df_block$categoria, df_block$N)
      } else {
        NULL
      }

      base_args <- list(
        data                   = df_block,
        var_categoria          = ".categoria_id",
        var_etiqueta_categoria = "categoria",
        var_grupo_id           = if (!sin_grupo_word) ".grupo_id"    else NULL,
        var_grupo_titulo       = if (!sin_grupo_word) ".grupo_titulo" else NULL,
        var_n                  = "N",
        cols_porcentaje        = cols_pct,
        etiquetas_grupos       = etiquetas_grupos,
        etiquetas_leyenda      = stats::setNames(leyenda_opts, labels_opts),
        cols_n                 = stats::setNames(cols_n, cols_pct),
        mostrar_n_en_etiquetas = FALSE,
        escala_valor           = "proporcion_1",
        colores_grupos         = colores_grupos,
        titulo                 = NULL,
        subtitulo              = NULL,
        nota_pie               = NULL,
        usar_canvas            = TRUE,
        canvas_w_grupo         = if (!sin_grupo_word) 0.24 else 0,
        canvas_w_buf_grupo_etq = if (!sin_grupo_word) 0.03 else 0,
        # 0.65 y no 0.35: medido sobre el entregable aprobado, que separa
        # 1.76 cm entre premisas contra los 0.97 que daba el 0.35. Es lo que
        # hay detras de «se ve muy apretado» y «mas separacion entre pregunta
        # y pregunta». La unidad son altos de fila.
        #
        # REMEDIDO CONTRA EL APROBADO, y hoy este 0.85 es LA HOLGURA de donde
        # puede salir el alto que les falta a los enunciados que aun se cortan
        # (P46, 10 en 8 laminas). Medidos los huecos entre filas de barras sobre
        # las mismas familias de lamina —30 huecos del motor contra 29 del
        # aprobado, mismo denominador—:
        #
        #   motor     mediana 1.77 cm   max 3.50
        #   aprobado  mediana 0.92 cm   max 3.43
        #
        # O sea que el motor separa CASI EL DOBLE. Los extremos coinciden —los
        # dos tienen huecos pequenos dentro de un bloque, 0.32-0.41 el motor y
        # 0.26-0.92 el aprobado, y grandes entre bloques, 1.61-3.50 contra
        # 1.65-2.84—: lo que difiere es cuantos caen en el grupo grande.
        #
        # Y CLASIFICADOS LOS HUECOS, ESE 1.77 CONTRA 0.92 NO DICE LO QUE PARECIA.
        # `canvas_gap_grupos` solo separa BLOQUES, asi que dentro de una lamina
        # los huecos pequenos son el paso de fila y los grandes llevan el gap
        # encima. Partiendo cada lamina por su propio corte —1.5x su hueco
        # minimo, porque el paso de fila cambia de lamina a lamina—:
        #
        #   dentro de bloque   motor mediana 0.37 cm (n=27)
        #                      aprobado      0.62 cm (n=18)
        #   entre bloques      motor mediana 1.77 cm (n=15)
        #                      aprobado      2.14 cm (n=18)
        #
        # O sea que el motor NO separa el doble: separa MENOS que el aprobado en
        # las dos partes. La mediana global —1.77 contra 0.92— era un artefacto
        # de composicion: el motor tiene proporcionalmente mas huecos grandes
        # porque tiene mas bloques de una sola fila, 15 de 42 contra 18 de 36.
        #
        # DESCARTADO, ENTONCES, bajar este 0.85 para sacarle alto a los
        # enunciados que aun se cortan (P46): iria en direccion contraria a la
        # vara. Medido sobre `p48.pptx` contra el entregable aprobado.
        #
        # Y OJO AL SUBIRLO: el 1.76 cm que lo justifico era el hueco ENTRE
        # BLOQUES del aprobado —su cola alta— aplicado a TODOS los huecos. Da la
        # cifra correcta para la parte de arriba y no dice nada de la de abajo.
        canvas_gap_grupos      = if (!sin_grupo_word) 0.85 else 0
      )
      base_args <- .apply_top2box_alias(base_args)

      args <- .merge_args(base_args, preset_args_single, preset_args_multi)
      if (isTRUE(usar_layout_multiactor)) {
        effective_args <- .merge_args(args, overrides)
        extra_preset <- as.character(effective_args$barra_extra_preset %||% "ninguno")[1]
        show_flag <- effective_args$mostrar_barra_extra
        if (is.null(show_flag)) show_flag <- TRUE
        show_extra <- isTRUE(el$top2box) ||
          isTRUE(show_flag) ||
          (!is.na(extra_preset) && extra_preset != "ninguno")
        if (!is.null(overrides$mostrar_barra_extra)) {
          show_extra <- isTRUE(overrides$mostrar_barra_extra)
        }
        args <- .merge_args(
          args,
          .reporte_plan_multiactor_canvas_defaults(
            isTRUE(show_extra),
            preset_args = (presets$multi_apiladas_multiactor$args %||% list())
          )
        )
        args$mostrar_barra_extra <- isTRUE(show_extra)
      }

      args <- .merge_args(args, overrides)
      args <- .reservar_pie_para_base_slide(args, min_in = .PLAN_RESERVA_PIE_MULTI_IN, word_render = isTRUE(el$.word_render))
      args$usar_canvas <- TRUE
      fun  <- graficar_barras_apiladas
      args <- .force_canvas_args(fun, args)
      args <- .keep_formals(fun, args)
      return(.with_actor_base_caption(suppressWarnings(do.call(fun, args)), actor_caption))
    }

    stop("multiapiladas: modo no soportado: ", modo, call. = FALSE)
  }


  .render_barras_agrupadas <- function(el, preset_args) {

    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    base_unit <- .clean_note_text(overrides$unidad_base %||% preset_args$unidad_base) %||% "respuestas"
    base_por_grupo <- isTRUE(overrides$base_por_grupo %||% preset_args$base_por_grupo)
    overrides$unidad_base <- NULL
    overrides$base_por_grupo <- NULL
    preset_args$unidad_base <- NULL
    preset_args$base_por_grupo <- NULL
    cruce_ref <- overrides$cruces %||% el$cruces %||% preset_args$cruces %||% NULL
    overrides$cruces <- NULL
    preset_args$cruces <- NULL
    if (!is.null(el$mostrar_ceros)) {
      overrides$mostrar_ceros <- isTRUE(el$mostrar_ceros)
    }
    excluir_opciones <- .reporte_plan_excluir_cascada(preset_args, overrides, el)
    ctx_var <- .resolve_ref(var, arg_name = "var")
    excluir_opciones <- .exclusion_for_ctx(ctx_var, excluir_opciones)
    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(.blank_canvas(preset_args, overrides))

    # N desde Total si existe
    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    mostrar_ceros <- .should_show_zero_options(
      var,
      tab = tab,
      preset_args = preset_args,
      overrides = overrides,
      source = el$source %||% NULL,
      word_render = isTRUE(el$.word_render)
    )

    tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = mostrar_ceros)
    tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
    excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))

    if (!nrow(tab)) return(.blank_canvas(preset_args, overrides))

    if ((excluded_any && !.reporte_plan_is_select_multiple(var)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
    if (!is.finite(N_total) || N_total <= 0) return(.blank_canvas(preset_args, overrides))

    # ----------------------------
    # LONG: 1 fila por opcion
    # (esto evita: eje Y con "titulo" y colores distintos por opcion)
    # ----------------------------
    df_long <- NULL
    etiquetas_series <- NULL
    cols_n <- NULL
    group_totals <- numeric(0)
    colores_series <- NULL
    colores_categorias <- NULL

    if (is.null(cruce_ref) || !is.character(cruce_ref) || length(cruce_ref) != 1L ||
        !nzchar(trimws(cruce_ref))) {
      df_long <- tibble::tibble(
        categoria = as.character(tab$Opciones),
        N         = N_total,
        n         = suppressWarnings(as.numeric(tab$n)),
        pct       = as.numeric(tab$n) / N_total
      )
      etiquetas_series <- c(pct = "Porcentaje")
      cols_n <- c(pct = "n")
      ln <- .list_name_of_var(var)
      colores_categorias <- .paleta_auto(ln, env_diapos)
    } else {
      ctx_cruce <- .resolve_ref(cruce_ref, source = ctx_var$source, arg_name = "cruces")
      df_cross <- .filter_data(filtros, source = ctx_var$source)
      if (!ctx_cruce$var %in% names(df_cross)) return(.blank_canvas(preset_args, overrides))

      cruce_values <- .reporte_plan_clean_chr(df_cross[[ctx_cruce$var]])
      present_values <- unique(cruce_values[nzchar(cruce_values)])
      cruce_list <- .list_name_from_ctx(ctx_cruce)
      cruce_levels <- .reporte_plan_choice_levels_for_list(cruce_list, ctx_cruce$choices)
      ordered_values <- if (nrow(cruce_levels)) {
        c(
          intersect(as.character(cruce_levels$code), present_values),
          setdiff(present_values, as.character(cruce_levels$code))
        )
      } else {
        present_values
      }
      ordered_values <- unique(ordered_values[nzchar(ordered_values)])
      if (!length(ordered_values)) return(.blank_canvas(preset_args, overrides))

      group_labels <- .reporte_plan_labels_for_levels(
        cruce_list,
        ordered_values,
        ctx_cruce$choices
      )
      group_labels <- .reporte_plan_clean_chr(group_labels)
      group_labels[!nzchar(group_labels)] <- ordered_values[!nzchar(group_labels)]

      df_long <- tibble::tibble(
        categoria = as.character(tab$Opciones),
        N = N_total
      )
      etiquetas_series <- character(0)
      cols_n <- character(0)

      for (j in seq_along(ordered_values)) {
        group_mask <- !is.na(cruce_values) & cruce_values == ordered_values[[j]]
        group_data <- df_cross[group_mask, , drop = FALSE]
        group_tab <- if (nrow(group_data)) {
          freq_table_spss(
            group_data,
            ctx_var$var,
            survey = ctx_var$survey,
            sm_vars_force = NULL,
            orders_list = ctx_var$orders_list,
            mostrar_todo = TRUE
          )
        } else {
          NULL
        }
        if (is.null(group_tab) || !nrow(group_tab)) next

        group_total <- NA_real_
        if (all(c("Opciones", "n") %in% names(group_tab))) {
          total_idx <- which(group_tab$Opciones == "Total")
          if (length(total_idx)) group_total <- suppressWarnings(as.numeric(group_tab$n[total_idx[[1]]]))
        }
        group_tab <- .reporte_plan_prepare_freq_options(group_tab, incluir_sin_n = mostrar_ceros)
        group_tab <- .reporte_plan_filter_freq_options(group_tab, excluir_opciones)
        if (!is.finite(group_total) || group_total <= 0 || !nrow(group_tab)) next

        pct_col <- paste0("pct_", j)
        n_col <- paste0("n_", j)
        match_idx <- match(df_long$categoria, as.character(group_tab$Opciones))
        group_n <- suppressWarnings(as.numeric(group_tab$n[match_idx]))
        group_n[!is.finite(group_n) | is.na(group_n)] <- 0
        df_long[[n_col]] <- group_n
        df_long[[pct_col]] <- group_n / group_total
        etiquetas_series[[pct_col]] <- group_labels[[j]]
        cols_n[[pct_col]] <- n_col
        group_totals[[pct_col]] <- group_total
      }

      if (!length(etiquetas_series)) return(.blank_canvas(preset_args, overrides))
      series_keys <- .graficos_norm_text_key(unname(etiquetas_series))
      colores_series <- if (any(grepl("intervenci|comparaci", series_keys))) {
        stats::setNames(ifelse(
          grepl("intervenci", series_keys), "#0072BC",
          ifelse(grepl("comparaci", series_keys), "#00A98F", "#B8C4CE")
        ), unname(etiquetas_series))
      } else {
        # Cruce sin marca institucional: dejar que .graficos_mk_palette asigne
        # colores distinguibles de la casa. El gris #B8C4CE uniforme para toda
        # serie no-ACNUR hacia ilegible cualquier cruce (P9 del GOAL loop).
        NULL
      }
    }

    # Detectar si la variable es select_multiple -> agregar subtitulo destacado.
    if (is.null(overrides$subtitulo)) {
      ctx_v <- tryCatch(.resolve_ref(var, arg_name = "var"), error = function(e) NULL)
      if (!is.null(ctx_v) && !is.null(ctx_v$survey) && all(c("type", "name") %in% names(ctx_v$survey))) {
        mask <- !is.na(ctx_v$survey$name) & ctx_v$survey$name == ctx_v$var
        tps  <- unique(stats::na.omit(ctx_v$survey$type[mask]))
        if (any(grepl("^select_multiple(\\s|$)", tps))) {
          overrides <- .ppt_multiple_choice_notice_overrides(overrides)
        }
      }
    }

    if (!exists("graficar_barras_agrupadas", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_barras_agrupadas()` en el entorno/paquete.", call. = FALSE)
    }

    base_caption <- if (isTRUE(base_por_grupo) && length(group_totals)) {
      .format_group_base_caption(
        unname(etiquetas_series[names(group_totals)]),
        unname(group_totals)
      )
    } else {
      NULL
    }

    base_args <- list(
      data                = df_long,
      var_categoria       = "categoria",
      var_n               = "N",
      cols_porcentaje     = "pct",
      etiquetas_series    = etiquetas_series,
      cols_n              = cols_n,
      mostrar_n_en_etiquetas = FALSE,
      colores_series      = colores_series,
      colores_categorias  = colores_categorias,
      mostrar_ceros       = mostrar_ceros,
      umbral_barra        = 0,
      titulo              = NULL,
      subtitulo           = NULL,
      # Doctrina B36 extendida a agrupadas (G-17, pedido directo): la base
      # vive en la esquina inferior izquierda del SLIDE, no como caption del
      # grafico. Reactivable via overrides$nota_pie.
      nota_pie            = NULL
    )

    preset_args <- preset_args %||% list()
    preset_args$mostrar_ceros <- NULL
    preset_args$excluir_opciones <- NULL
    if (length(etiquetas_series) > 1L) {
      base_args$cols_porcentaje <- names(etiquetas_series)
      preset_args$colores_series <- NULL
      preset_args$colores_categorias <- NULL
      overrides$colores_categorias <- NULL
    }
    if (!is.null(overrides$colores_categorias) && length(overrides$colores_categorias)) {
      preset_args$colores_series <- NULL
    }
    overrides$mostrar_ceros <- NULL
    overrides$excluir_opciones <- NULL
    # limpiar cosas que NO aplican a agrupadas (por si vienen de presets genericos)
    preset_args$var_grupo      <- NULL
    preset_args$colores_grupos <- NULL
    overrides$var_grupo        <- NULL
    overrides$colores_grupos   <- NULL

    # Significancia entre columnas del cruce. El calculo vive en
    # `graficos_significancia.R` y consume `comparar_columnas_sig()` —la misma
    # prueba que firma las letras del XLSX— sobre los conteos que este render YA
    # produjo, sin recalcular denominadores.
    base_args <- .graficos_sig_aplicar(
      base_args        = base_args,
      df_long          = df_long,
      cols_n           = cols_n,
      group_totals     = group_totals,
      cols_porcentaje  = names(etiquetas_series),
      etiquetas_series = etiquetas_series,
      activo           = isTRUE(overrides$mostrar_significancia %||% preset_args$mostrar_significancia),
      alpha            = overrides$significancia_alpha %||% preset_args$significancia_alpha %||% 0.05,
      diseno           = .graficos_sig_diseno_de_fuente(ctx_var$instrumento, ctx_var$var)
    )
    nota_significancia <- base_args$nota_pie_significancia
    base_args$nota_pie_significancia <- NULL
    # Doctrina B36: agrupadas dejo de imprimir caption propio para que la Base
    # viva en el placeholder del SLIDE. La nota de letras es la excepcion
    # declarada: describe el metodo del grafico y tiene que viajar pegada a el,
    # no al slide, porque una lamina de dos graficos tendria dos mapas de letras
    # distintos y un solo pie. Solo se activa con la opcion encendida, asi que
    # apagada el caption sigue vacio y la banda de Base se reserva igual.
    if (!is.null(nota_significancia) && nzchar(nota_significancia) &&
        is.null(overrides$nota_pie) && is.null(preset_args$nota_pie)) {
      base_args$nota_pie <- nota_significancia
    }
    preset_args$mostrar_significancia <- NULL
    preset_args$significancia_alpha <- NULL
    overrides$mostrar_significancia <- NULL
    overrides$significancia_alpha <- NULL

    args <- .merge_args(base_args, preset_args, overrides)
    args <- .reservar_pie_para_base_slide(args, word_render = isTRUE(el$.word_render))
    fun  <- graficar_barras_agrupadas
    args <- .force_canvas_args(fun, args)
    args <- .keep_formals(fun, args)

    plot <- suppressWarnings(do.call(fun, args))
    attr(plot, "pulso_barras_series") <- unname(etiquetas_series)
    attr(plot, "pulso_barras_cruce") <- if (length(etiquetas_series) > 1L) cruce_ref else NULL
    attr(plot, "pulso_barras_bases") <- stats::setNames(
      unname(group_totals),
      unname(etiquetas_series[names(group_totals)])
    )
    attr(plot, "pulso_barras_base_caption") <- base_caption
    # La nota viaja como atributo, igual que la base: por doctrina B36 el pie del
    # SLIDE es el dueño de ese texto y el grafico no dibuja su propio caption.
    attr(plot, "pulso_sig_nota") <- nota_significancia
    plot
  }

  .render_barras_categoricas <- function(el, preset_args) {

    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    if (!is.null(el$mostrar_ceros)) {
      overrides$mostrar_ceros <- isTRUE(el$mostrar_ceros)
    }
    excluir_opciones <- .reporte_plan_excluir_cascada(preset_args, overrides, el)
    ctx <- tryCatch(.resolve_ref(var, arg_name = "var"), error = function(e) NULL)
    if (!is.null(ctx)) {
      excluir_opciones <- .exclusion_for_ctx(ctx, excluir_opciones)
    }

    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(.blank_canvas(preset_args, overrides))

    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    mostrar_ceros <- .should_show_zero_options(
      var,
      tab = tab,
      preset_args = preset_args,
      overrides = overrides,
      source = el$source %||% NULL,
      word_render = isTRUE(el$.word_render)
    )

    tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = mostrar_ceros)
    tab <- .reporte_plan_filter_freq_options(tab, excluir_opciones)
    excluded_any <- isTRUE(attr(tab, "excluded_any", exact = TRUE))
    if (!nrow(tab)) return(.blank_canvas(preset_args, overrides))

    if ((excluded_any && !.reporte_plan_is_select_multiple(var)) || !is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
    if (!is.finite(N_total) || N_total <= 0) return(.blank_canvas(preset_args, overrides))

    df_cat <- tibble::tibble(
      categoria = as.character(tab$Opciones),
      n = suppressWarnings(as.numeric(tab$n)),
      pct = suppressWarnings(as.numeric(tab$n)) / N_total
    )

    promedio_auto <- NULL
    if (isTRUE(overrides$mostrar_promedio %||% preset_args$mostrar_promedio %||% FALSE)) {
      vals <- suppressWarnings(as.numeric(df_cat$categoria))
      if ((any(!is.finite(vals)) || all(is.na(vals))) && !is.null(ctx)) {
        ln_prom <- .list_name_from_ctx(ctx)
        choices_levels <- .reporte_plan_choice_levels_for_list(ln_prom, ctx$choices)
        if (nrow(choices_levels)) {
          code_num <- suppressWarnings(as.numeric(choices_levels$code))
          label_to_code <- stats::setNames(code_num, choices_levels$label)
          code_to_code <- stats::setNames(code_num, choices_levels$code)
          vals <- unname(label_to_code[df_cat$categoria])
          missing <- !is.finite(vals)
          vals[missing] <- unname(code_to_code[df_cat$categoria[missing]])
        }
      }
      if (all(is.finite(vals)) && sum(df_cat$n, na.rm = TRUE) > 0) {
        promedio_auto <- stats::weighted.mean(vals, df_cat$n, na.rm = TRUE)
      }
    }

    if (!exists("graficar_barras_categoricas", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_barras_categoricas()` en el entorno/paquete.", call. = FALSE)
    }

    ln <- tryCatch(.list_name_of_var(var), error = function(e) "")
    colores_categorias <- .paleta_auto(ln, env_diapos)

    base_args <- list(
      data = df_cat,
      var_categoria = "categoria",
      var_valor = "pct",
      var_n = "n",
      var_pct = "pct",
      modo_valor = "valor",
      formato_valor = "porcentaje",   # doctrina: el conteo es opt-in de la UI
      mostrar_frecuencia = FALSE,
      colores_categorias = colores_categorias,
      titulo = NULL,
      subtitulo = NULL,
      nota_pie = .format_n_caption(N_total),
      promedio = promedio_auto
    )

    preset_args <- preset_args %||% list()
    preset_args$mostrar_ceros <- NULL
    preset_args$excluir_opciones <- NULL
    overrides$mostrar_ceros <- NULL
    overrides$excluir_opciones <- NULL

    args <- .merge_args(base_args, preset_args, overrides)
    fun <- graficar_barras_categoricas
    args <- .keep_formals(fun, args)

    suppressWarnings(do.call(fun, args))
  }

  .render_pie <- function(el, preset_args, tipo_pie = c("pie", "donut")) {
    tipo_pie <- match.arg(tipo_pie)

    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(.blank_canvas(preset_args, overrides))

    tab <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = FALSE)

    if (!nrow(tab)) return(.blank_canvas(preset_args, overrides))

    df_long <- tab |>
      dplyr::transmute(
        opcion = as.character(.data$Opciones),
        n      = as.numeric(.data$n)
      ) |>
      dplyr::mutate(
        pct = .data$n / sum(.data$n, na.rm = TRUE)  # proporcion 0-1
      )

    ln <- .list_name_of_var(var)
    colores_grupos <- .paleta_auto(ln, env_diapos)

    if (!exists("graficar_pie", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_pie()` en el entorno/paquete.", call. = FALSE)
    }

    base_args <- list(
      data           = df_long,
      var_categoria  = "opcion",
      var_pct        = "pct",
      var_n          = "n",
      tipo_pie       = tipo_pie,
      colores_categorias = colores_grupos,
      titulo         = NULL,
      subtitulo      = NULL,
      nota_pie       = .format_n_caption(sum(df_long$n, na.rm = TRUE))
    )

    preset_args <- preset_args %||% list()
    args <- .merge_args(base_args, preset_args, overrides)

    fun  <- graficar_pie
    args <- .force_canvas_args(fun, args)
    args <- .keep_formals(fun, args)

    suppressWarnings(do.call(fun, args))
  }

  .render_donut <- function(el, preset_args) {
    .render_pie(el, preset_args = preset_args, tipo_pie = "donut")
  }

  .render_boxplot <- function(el, preset_args) {

    `%||%` <- function(x, y) if (!is.null(x)) x else y

    var <- el$var
    if (is.null(var) || !nzchar(trimws(var))) return(NULL)

    preset_args <- preset_args %||% list()
    overrides   <- el$overrides %||% list()

    ctx_var <- .resolve_ref(var, arg_name = "var")

    cruce_ref <- overrides$cruce %||% el$cruce %||% preset_args$cruce %||% NULL
    preset_args$cruce <- NULL
    overrides$cruce   <- NULL

    ctx_cruce <- NULL
    cruce <- NULL
    if (!is.null(cruce_ref) &&
        is.character(cruce_ref) &&
        length(cruce_ref) == 1L &&
        nzchar(trimws(cruce_ref))) {
      ctx_cruce <- .resolve_ref(cruce_ref, source = ctx_var$source, arg_name = "cruce")
      cruce <- ctx_cruce$var
    }

    .labels_from_inst <- function(inst, varname) {
      if (is.null(inst) || is.null(inst$survey)) return(NULL)
      surv <- inst$survey
      if (!("name" %in% names(surv))) return(NULL)

      ln <- NA_character_
      if ("list_name" %in% names(surv)) {
        tmp <- surv$list_name[surv$name == varname]
        if (length(tmp)) ln <- tmp[1]
      } else if ("list_norm" %in% names(surv)) {
        tmp <- surv$list_norm[surv$name == varname]
        if (length(tmp)) ln <- tmp[1]
      }
      if (is.na(ln) || !nzchar(ln)) return(NULL)

      ch <- inst$choices_raw %||% inst$choices %||% NULL
      if (is.null(ch) || !("list_name" %in% names(ch)) || !("name" %in% names(ch))) return(NULL)

      lab_col <- NULL
      if ("label::Spanish (ES)" %in% names(ch)) lab_col <- "label::Spanish (ES)"
      if (is.null(lab_col) && "label" %in% names(ch)) lab_col <- "label"
      if (is.null(lab_col)) return(NULL)

      sub <- ch[ch$list_name == ln, , drop = FALSE]
      if (!nrow(sub)) return(NULL)

      codes  <- as.character(sub$name)
      labels <- as.character(sub[[lab_col]])
      out <- stats::setNames(labels, codes)
      attr(out, "levels_labels") <- labels
      out
    }

    .apply_cruce_labels <- function(x_cruce, inst, cruce_name) {

      if (requireNamespace("haven", quietly = TRUE) &&
          inherits(x_cruce, "haven_labelled")) {
        x_chr <- as.character(haven::as_factor(x_cruce, levels = "labels"))
        lvls  <- unique(x_chr)
        return(list(x = x_chr, lvls = lvls))
      }

      if (is.factor(x_cruce)) {
        x_chr <- as.character(x_cruce)
        return(list(x = x_chr, lvls = levels(x_cruce)))
      }

      map <- .labels_from_inst(inst, cruce_name)
      if (!is.null(map)) {
        x_chr <- as.character(x_cruce)
        x_lab <- ifelse(x_chr %in% names(map), unname(map[x_chr]), x_chr)

        lvls <- attr(map, "levels_labels")
        lvls <- lvls[!is.na(lvls) & nzchar(lvls)]
        extras <- setdiff(unique(x_lab), lvls)
        lvls2  <- c(lvls, extras)

        return(list(x = x_lab, lvls = lvls2))
      }

      x_chr <- as.character(x_cruce)
      list(x = x_chr, lvls = unique(x_chr))
    }

    df <- .filter_data(el$filtros %||% list(), source = ctx_var$source)
    if (!nrow(df)) return(.blank_canvas(preset_args, overrides))
    if (!ctx_var$var %in% names(df)) return(NULL)

    x_raw <- df[[ctx_var$var]]
    if (is.factor(x_raw)) x_raw <- as.character(x_raw)
    x_num <- suppressWarnings(as.numeric(x_raw))

    df_plot <- NULL
    if (is.null(cruce)) {
      cat_label <- tryCatch(.title_of_var(ctx_var$raw_ref), error = function(e) ctx_var$var)
      if (is.null(cat_label) || !nzchar(trimws(as.character(cat_label)[1]))) cat_label <- ctx_var$var
      df_plot <- tibble::tibble(
        categoria = as.character(cat_label)[1],
        valor = x_num
      )
    } else {
      if (!cruce %in% names(df)) return(.blank_canvas(preset_args, overrides))
      cr <- .apply_cruce_labels(df[[cruce]], ctx_var$instrumento, cruce)
      df_plot <- tibble::tibble(
        categoria = cr$x,
        valor = x_num
      )
      if (!is.null(cr$lvls) && length(cr$lvls)) {
        df_plot$categoria <- factor(df_plot$categoria, levels = cr$lvls)
      }
    }

    df_plot <- df_plot |>
      dplyr::filter(
        !is.na(.data$categoria),
        nzchar(trimws(as.character(.data$categoria))),
        is.finite(.data$valor)
      )

    if (!nrow(df_plot)) return(.blank_canvas(preset_args, overrides))

    map_cruce <- if (!is.null(cruce)) .labels_from_inst(ctx_var$instrumento, cruce) else NULL

    list_name_use <- if (!is.null(ctx_cruce)) {
      .list_name_from_ctx(ctx_cruce)
    } else {
      .list_name_from_ctx(ctx_var)
    }
    colores_cat <- .paleta_auto(list_name_use, env_diapos)
    if (!is.null(colores_cat) && length(colores_cat) && !is.null(names(colores_cat))) {
      nms <- as.character(names(colores_cat))
      nms <- trimws(nms)
      if (!is.null(map_cruce) && length(map_cruce)) {
        nms <- ifelse(nms %in% names(map_cruce), unname(map_cruce[nms]), nms)
      }
      names(colores_cat) <- nms
      colores_cat <- colores_cat[!duplicated(names(colores_cat))]
    }

    base_args <- list(
      data              = df_plot,
      var_categoria     = "categoria",
      var_valor         = "valor",
      colores_categorias = colores_cat,
      titulo            = NULL,
      subtitulo         = NULL,
      nota_pie          = NULL,
      usar_canvas       = TRUE,
      exportar          = "rplot"
    )

    if (!exists("graficar_boxplot", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_boxplot()` en el entorno/paquete.", call. = FALSE)
    }

    fun  <- graficar_boxplot
    args <- .merge_args(base_args, preset_args, overrides)
    args <- .keep_formals(fun, args)

    tryCatch(
      suppressWarnings(do.call(fun, args)),
      error = function(e) {
        message("⚠️ .render_boxplot(): ", conditionMessage(e))
        NULL
      }
    )
  }

  .render_media_rango <- function(el, preset_args) {

    `%||%` <- function(x, y) if (!is.null(x)) x else y

    var <- el$var
    if (is.null(var) || !nzchar(trimws(var))) return(NULL)

    preset_args <- preset_args %||% list()
    overrides   <- el$overrides %||% list()

    ctx_var <- .resolve_ref(var, arg_name = "var")

    cruce_ref <- overrides$cruce %||% el$cruce %||% preset_args$cruce %||% NULL
    preset_args$cruce <- NULL
    overrides$cruce   <- NULL

    ctx_cruce <- NULL
    cruce <- NULL
    if (!is.null(cruce_ref) &&
        is.character(cruce_ref) &&
        length(cruce_ref) == 1L &&
        nzchar(trimws(cruce_ref))) {
      ctx_cruce <- .resolve_ref(cruce_ref, source = ctx_var$source, arg_name = "cruce")
      cruce <- ctx_cruce$var
    }

    .labels_from_inst <- function(inst, varname) {
      if (is.null(inst) || is.null(inst$survey)) return(NULL)
      surv <- inst$survey
      if (!("name" %in% names(surv))) return(NULL)

      ln <- NA_character_
      if ("list_name" %in% names(surv)) {
        tmp <- surv$list_name[surv$name == varname]
        if (length(tmp)) ln <- tmp[1]
      } else if ("list_norm" %in% names(surv)) {
        tmp <- surv$list_norm[surv$name == varname]
        if (length(tmp)) ln <- tmp[1]
      }
      if (is.na(ln) || !nzchar(ln)) return(NULL)

      ch <- inst$choices_raw %||% inst$choices %||% NULL
      if (is.null(ch) || !("list_name" %in% names(ch)) || !("name" %in% names(ch))) return(NULL)

      lab_col <- NULL
      if ("label::Spanish (ES)" %in% names(ch)) lab_col <- "label::Spanish (ES)"
      if (is.null(lab_col) && "label" %in% names(ch)) lab_col <- "label"
      if (is.null(lab_col)) return(NULL)

      sub <- ch[ch$list_name == ln, , drop = FALSE]
      if (!nrow(sub)) return(NULL)

      codes  <- as.character(sub$name)
      labels <- as.character(sub[[lab_col]])
      out <- stats::setNames(labels, codes)
      attr(out, "levels_labels") <- labels
      out
    }

    .apply_cruce_labels <- function(x_cruce, inst, cruce_name) {
      if (requireNamespace("haven", quietly = TRUE) &&
          inherits(x_cruce, "haven_labelled")) {
        x_chr <- as.character(haven::as_factor(x_cruce, levels = "labels"))
        lvls  <- unique(x_chr)
        return(list(x = x_chr, lvls = lvls))
      }

      if (is.factor(x_cruce)) {
        x_chr <- as.character(x_cruce)
        return(list(x = x_chr, lvls = levels(x_cruce)))
      }

      map <- .labels_from_inst(inst, cruce_name)
      if (!is.null(map)) {
        x_chr <- as.character(x_cruce)
        x_lab <- ifelse(x_chr %in% names(map), unname(map[x_chr]), x_chr)

        lvls <- attr(map, "levels_labels")
        lvls <- lvls[!is.na(lvls) & nzchar(lvls)]
        extras <- setdiff(unique(x_lab), lvls)
        lvls2  <- c(lvls, extras)

        return(list(x = x_lab, lvls = lvls2))
      }

      x_chr <- as.character(x_cruce)
      list(x = x_chr, lvls = unique(x_chr))
    }

    df <- .filter_data(el$filtros %||% list(), source = ctx_var$source)
    if (!nrow(df)) return(.blank_canvas(preset_args, overrides))
    if (!ctx_var$var %in% names(df)) return(NULL)

    x_raw <- df[[ctx_var$var]]
    if (is.factor(x_raw)) x_raw <- as.character(x_raw)
    x_num <- suppressWarnings(as.numeric(x_raw))

    df_plot <- NULL
    if (is.null(cruce)) {
      cat_label <- tryCatch(.title_of_var(ctx_var$raw_ref), error = function(e) ctx_var$var)
      if (is.null(cat_label) || !nzchar(trimws(as.character(cat_label)[1]))) cat_label <- ctx_var$var
      df_plot <- tibble::tibble(
        categoria = as.character(cat_label)[1],
        valor = x_num
      )
    } else {
      if (!cruce %in% names(df)) return(.blank_canvas(preset_args, overrides))
      cr <- .apply_cruce_labels(df[[cruce]], ctx_var$instrumento, cruce)
      df_plot <- tibble::tibble(
        categoria = cr$x,
        valor = x_num
      )
      if (!is.null(cr$lvls) && length(cr$lvls)) {
        df_plot$categoria <- factor(df_plot$categoria, levels = cr$lvls)
      }
    }

    df_plot <- df_plot |>
      dplyr::filter(
        !is.na(.data$categoria),
        nzchar(trimws(as.character(.data$categoria))),
        is.finite(.data$valor)
      )

    if (!nrow(df_plot)) return(.blank_canvas(preset_args, overrides))

    map_cruce <- if (!is.null(cruce)) .labels_from_inst(ctx_var$instrumento, cruce) else NULL

    list_name_use <- if (!is.null(ctx_cruce)) {
      .list_name_from_ctx(ctx_cruce)
    } else {
      .list_name_from_ctx(ctx_var)
    }
    colores_cat <- .paleta_auto(list_name_use, env_diapos)
    if (!is.null(colores_cat) && length(colores_cat) && !is.null(names(colores_cat))) {
      nms <- as.character(names(colores_cat))
      nms <- trimws(nms)
      if (!is.null(map_cruce) && length(map_cruce)) {
        nms <- ifelse(nms %in% names(map_cruce), unname(map_cruce[nms]), nms)
      }
      names(colores_cat) <- nms
      colores_cat <- colores_cat[!duplicated(names(colores_cat))]
    }

    base_args <- list(
      data              = df_plot,
      var_categoria     = "categoria",
      var_valor         = "valor",
      colores_categorias = colores_cat,
      titulo            = NULL,
      subtitulo         = NULL,
      nota_pie          = NULL,
      usar_canvas       = TRUE,
      exportar          = "rplot"
    )

    if (!exists("graficar_media_rango", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_media_rango()` en el entorno/paquete.", call. = FALSE)
    }

    fun  <- graficar_media_rango
    args <- .merge_args(base_args, preset_args, overrides)
    args <- .media_rango_activar_score_ref(args)
    args <- .keep_formals(fun, args)

    tryCatch(
      suppressWarnings(do.call(fun, args)),
      error = function(e) {
        message("⚠️ .render_media_rango(): ", conditionMessage(e))
        NULL
      }
    )
  }

  .render_numerico <- function(el, preset_args) {

    `%||%` <- function(x, y) if (!is.null(x)) x else y

    var <- el$var
    if (is.null(var) || !nzchar(var)) return(NULL)

    preset_args <- preset_args %||% list()
    overrides   <- el$overrides %||% list()

    ctx_var <- .resolve_ref(var, arg_name = "var")

    cruce_ref <- overrides$cruce %||% el$cruce %||% preset_args$cruce %||% NULL
    preset_args$cruce <- NULL
    overrides$cruce   <- NULL

    ctx_cruce <- NULL
    cruce <- NULL
    if (!is.null(cruce_ref) &&
        is.character(cruce_ref) &&
        length(cruce_ref) == 1L &&
        nzchar(trimws(cruce_ref))) {
      ctx_cruce <- .resolve_ref(cruce_ref, source = ctx_var$source, arg_name = "cruce")
      cruce <- ctx_cruce$var
    }

    df <- .filter_data(el$filtros %||% list(), source = ctx_var$source)
    if (!nrow(df)) return(.blank_canvas(preset_args, overrides))
    if (!ctx_var$var %in% names(df)) return(NULL)

    .labels_from_inst <- function(inst, varname) {
      if (is.null(inst) || is.null(inst$survey)) return(NULL)
      surv <- inst$survey
      if (!("name" %in% names(surv))) return(NULL)

      ln <- NA_character_
      if ("list_name" %in% names(surv)) {
        tmp <- surv$list_name[surv$name == varname]
        if (length(tmp)) ln <- tmp[1]
      } else if ("list_norm" %in% names(surv)) {
        tmp <- surv$list_norm[surv$name == varname]
        if (length(tmp)) ln <- tmp[1]
      }
      if (is.na(ln) || !nzchar(ln)) return(NULL)

      ch <- inst$choices_raw %||% inst$choices %||% NULL
      if (is.null(ch) || !("list_name" %in% names(ch)) || !("name" %in% names(ch))) return(NULL)

      lab_col <- NULL
      if ("label::Spanish (ES)" %in% names(ch)) lab_col <- "label::Spanish (ES)"
      if (is.null(lab_col) && "label" %in% names(ch)) lab_col <- "label"
      if (is.null(lab_col)) return(NULL)

      sub <- ch[ch$list_name == ln, , drop = FALSE]
      if (!nrow(sub)) return(NULL)

      codes  <- as.character(sub$name)
      labels <- as.character(sub[[lab_col]])
      out <- stats::setNames(labels, codes)
      attr(out, "levels_labels") <- labels
      out
    }

    .apply_cruce_labels <- function(x_cruce, inst, cruce_name) {

      if (requireNamespace("haven", quietly = TRUE) &&
          inherits(x_cruce, "haven_labelled")) {
        x_chr <- as.character(haven::as_factor(x_cruce, levels = "labels"))
        lvls  <- unique(x_chr)
        return(list(x = x_chr, lvls = lvls))
      }

      if (is.factor(x_cruce)) {
        x_chr <- as.character(x_cruce)
        return(list(x = x_chr, lvls = levels(x_cruce)))
      }

      map <- .labels_from_inst(inst, cruce_name)
      if (!is.null(map)) {
        x_chr <- as.character(x_cruce)
        x_lab <- ifelse(x_chr %in% names(map), unname(map[x_chr]), x_chr)

        lvls <- attr(map, "levels_labels")
        lvls <- lvls[!is.na(lvls) & nzchar(lvls)]
        extras <- setdiff(unique(x_lab), lvls)
        lvls2  <- c(lvls, extras)

        return(list(x = x_lab, lvls = lvls2))
      }

      x_chr <- as.character(x_cruce)
      return(list(x = x_chr, lvls = unique(x_chr)))
    }

    x_raw <- df[[ctx_var$var]]
    if (is.factor(x_raw)) x_raw <- as.character(x_raw)
    x <- suppressWarnings(as.numeric(x_raw))

    # H36/H37 — cascada, semantica y defaults en reporte_plan_numerico.R.
    metrica <- .numerico_resolver_metrica(overrides, el, preset_args)

    nombre_serie   <- preset_args$nombre_serie   %||% overrides$nombre_serie   %||% "v1"
    etiqueta_serie <- preset_args$etiqueta_serie %||% overrides$etiqueta_serie %||%
      .numerico_etiqueta_metrica(metrica)

    preset_args$metrica <- preset_args$nombre_serie <- preset_args$etiqueta_serie <- NULL
    overrides$metrica   <- overrides$nombre_serie   <- overrides$etiqueta_serie   <- NULL

    if (is.null(cruce)) {

      x2 <- x[is.finite(x)]
      if (!length(x2)) return(.blank_canvas(preset_args, overrides))

      N <- length(x2)
      # Sin cruce, `pct` es la cobertura: casos validos sobre casos de la base.
      m <- .numerico_agregar(x2, nrow(df), metrica)
      if (!is.finite(m)) return(.blank_canvas(preset_args, overrides))

      cat_label <- tryCatch(.title_of_var(ctx_var$raw_ref), error = function(e) ctx_var$var)
      if (is.null(cat_label) || !nzchar(cat_label)) cat_label <- ctx_var$var

      df_wide <- tibble::tibble(
        categoria = cat_label,
        N         = N
      )
      df_wide[[nombre_serie]] <- m

    } else {

      inst <- ctx_var$instrumento
      cr <- .apply_cruce_labels(df[[cruce]], inst, cruce)

      d2 <- tibble::tibble(
        .cruce = cr$x,
        .x     = x
      )

      d2 <- d2[is.finite(d2$.x), , drop = FALSE]
      d2 <- d2[!is.na(d2$.cruce) & nzchar(trimws(as.character(d2$.cruce))), , drop = FALSE]
      if (!nrow(d2)) return(.blank_canvas(preset_args, overrides))

      # Con cruce, `pct` reparte el total valido entre los grupos visibles.
      n_universo <- nrow(d2)
      df_wide <- d2 |>
        dplyr::group_by(.data$.cruce) |>
        dplyr::summarise(
          N  = dplyr::n(),
          .m = .numerico_agregar(.data$.x[is.finite(.data$.x)], n_universo, metrica),
          .groups = "drop"
        ) |>
        dplyr::rename(categoria = .data$.cruce)

      df_wide[[nombre_serie]] <- df_wide$.m
      df_wide$.m <- NULL

      lvls <- cr$lvls
      if (!is.null(lvls) && length(lvls)) {
        df_wide$categoria <- factor(df_wide$categoria, levels = lvls)
      }
    }

    if (!nrow(df_wide) || all(!is.finite(df_wide[[nombre_serie]]))) {
      return(.blank_canvas(preset_args, overrides))
    }

    list_name_use <- if (!is.null(ctx_cruce)) {
      .list_name_from_ctx(ctx_cruce)
    } else {
      .list_name_from_ctx(ctx_var)
    }
    colores_cat <- .paleta_auto(list_name_use, env_diapos)

    .aj <- .numerico_ajustar_args(el, preset_args, overrides, metrica, etiqueta_serie)
    preset_args <- .aj$preset_args; overrides <- .aj$overrides

    base_args <- list(
      data                = df_wide,
      var_categoria       = "categoria",
      var_n               = "N",
      vars_valor          = nombre_serie,
      etiquetas_series    = stats::setNames(etiqueta_serie, nombre_serie),
      colores_categorias  = colores_cat,

      titulo              = NULL,
      subtitulo           = NULL,
      nota_pie            = NULL,

      usar_canvas         = TRUE,
      exportar            = "rplot"
    )

    for (k in c("titulo","subtitulo","nota_pie","title","subtitle","caption","main","sub")) {
      if (!is.null(preset_args[[k]])) preset_args[[k]] <- NULL
      if (!is.null(overrides[[k]]))   overrides[[k]]   <- NULL
    }

    if (!exists("graficar_barras_numericas", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_barras_numericas()` en el entorno/paquete.", call. = FALSE)
    }

    fun  <- graficar_barras_numericas
    args <- .merge_args(base_args, preset_args, overrides)
    args <- .force_canvas_args(fun, args)
    args <- .keep_formals(fun, args)

    p <- tryCatch(suppressWarnings(do.call(fun, args)), error = function(e) {
      message("⚠️ .render_numerico(): ", conditionMessage(e)); NULL
    })
    .numerico_sellar(p, metrica, etiqueta_serie, df_wide, nombre_serie, args)
  }

  .render_histograma <- function(el, preset_args) {

    `%||%` <- function(x, y) if (!is.null(x)) x else y

    var <- el$var
    if (is.null(var) || !nzchar(var)) return(NULL)

    preset_args <- preset_args %||% list()
    overrides   <- el$overrides %||% list()
    title_arg <- overrides$titulo %||% overrides$title %||%
      preset_args$titulo %||% preset_args$title %||%
      el$title_slide %||% el$titulo %||% NULL
    subtitle_arg <- overrides$subtitulo %||% overrides$subtitle %||%
      preset_args$subtitulo %||% preset_args$subtitle %||% NULL
    note_arg <- overrides$nota_pie %||% overrides$caption %||%
      preset_args$nota_pie %||% preset_args$caption %||% NULL

    ctx_var <- .resolve_ref(var, arg_name = "var")
    # Para histogramas interesa la variable numerica cruda. Si el motor
    # resolvio automaticamente a *_recod pero la columna pedida existe, se usa
    # la columna original.
    if (!is.null(ctx_var$var_requested) &&
        ctx_var$var_requested %in% names(ctx_var$data) &&
        !identical(ctx_var$var_requested, ctx_var$var)) {
      ctx_var$var <- ctx_var$var_requested
      ctx_var$recod_redirected <- FALSE
    }

    grupo_ref <- overrides$grupo %||% overrides$cruce %||% el$grupo %||% el$cruce %||% preset_args$grupo %||% preset_args$cruce %||% NULL
    for (k in c("grupo", "cruce")) {
      preset_args[[k]] <- NULL
      overrides[[k]] <- NULL
    }

    ctx_grupo <- NULL
    grupo <- NULL
    if (!is.null(grupo_ref) &&
        is.character(grupo_ref) &&
        length(grupo_ref) == 1L &&
        nzchar(trimws(grupo_ref))) {
      ctx_grupo <- .resolve_ref(grupo_ref, source = ctx_var$source, arg_name = "grupo")
      grupo <- ctx_grupo$var
    }

    df <- .filter_data(el$filtros %||% list(), source = ctx_var$source)
    if (!nrow(df)) return(.blank_canvas(preset_args, overrides))
    if (!ctx_var$var %in% names(df)) return(NULL)
    if (!is.null(grupo) && !grupo %in% names(df)) return(NULL)

    df_hist <- df
    colores_grupos <- NULL
    if (!is.null(ctx_grupo)) {
      ln <- .list_name_from_ctx(ctx_grupo)
      g_raw <- df_hist[[grupo]]
      raw_levels <- if (is.factor(g_raw)) levels(g_raw) else unique(as.character(g_raw))
      raw_levels <- raw_levels[!is.na(raw_levels) & nzchar(trimws(raw_levels))]
      lab_levels <- .reporte_plan_labels_for_levels(ln, raw_levels, choices_use = ctx_grupo$choices)
      names(lab_levels) <- raw_levels

      g_chr <- as.character(g_raw)
      g_lab <- ifelse(g_chr %in% names(lab_levels), unname(lab_levels[g_chr]), g_chr)
      df_hist[[grupo]] <- factor(g_lab, levels = unique(unname(lab_levels)))

      pal <- .paleta_auto(ln, env_diapos)
      if (!is.null(pal) && length(pal)) {
        vals <- vapply(seq_along(raw_levels), function(i) {
          raw <- raw_levels[i]
          lab <- unname(lab_levels[i])
          pal[[lab]] %||% pal[[raw]] %||% NA_character_
        }, character(1))
        ok <- !is.na(vals) & nzchar(vals)
        if (any(ok)) colores_grupos <- stats::setNames(vals[ok], unname(lab_levels[ok]))
      }
    }

    base_args <- list(
      data           = df_hist,
      var            = ctx_var$var,
      grupo          = grupo,
      colores_grupos = colores_grupos,

      titulo         = title_arg,
      subtitulo      = subtitle_arg,
      nota_pie       = note_arg,

      usar_canvas    = TRUE,
      exportar       = "rplot"
    )

    for (k in c("titulo", "subtitulo", "nota_pie", "title", "subtitle", "caption", "main", "sub")) {
      if (!is.null(preset_args[[k]])) preset_args[[k]] <- NULL
      if (!is.null(overrides[[k]]))   overrides[[k]]   <- NULL
    }

    if (!exists("graficar_histograma", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_histograma()` en el entorno/paquete.", call. = FALSE)
    }

    fun  <- graficar_histograma
    args <- .merge_args(base_args, preset_args, overrides)
    args <- .force_canvas_args(fun, args)
    args <- .keep_formals(fun, args)

    tryCatch(
      suppressWarnings(do.call(fun, args)),
      error = function(e) {
        message("⚠️ .render_histograma(): ", conditionMessage(e))
        NULL
      }
    )
  }

  .render_radar_tabla <- function(el, preset_args) {

    if (!exists("graficar_radar", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_radar()` en el entorno/paquete.", call. = FALSE)
    }

    modo  <- el$modo %||% "sm"
    multi_source_box <- identical(modo, "box") && is.list(el$vars) && !is.character(el$vars)

    source_use <- if (isTRUE(multi_source_box)) NULL else .element_source(el)
    ctx_src <- if (isTRUE(multi_source_box)) NULL else .source_ctx(source_use)

    cruce <- if (!is.null(el$cruce)) {
      .resolve_ref(el$cruce, source = source_use, arg_name = "cruce")$var
    } else {
      NULL
    }
    titulo_tabla <- el$titulo_tabla %||% if (modo == "sm") "Opciones" else "Top 2 Box"
    data_radar <- if (isTRUE(multi_source_box)) NULL else .filter_data(el$filtros %||% list(), source = source_use)
    if (!isTRUE(multi_source_box) && !nrow(data_radar)) return(.blank_canvas(preset_args, el$overrides %||% list()))

    preset_args <- preset_args %||% list()
    overrides   <- el$overrides %||% list()

    # Defaults editoriales del radar-tabla. Pueden sobreescribirse en preset/overrides.
    preset_args$mostrar_radios    <- preset_args$mostrar_radios    %||% FALSE
    preset_args$mostrar_niveles   <- preset_args$mostrar_niveles   %||% FALSE
    preset_args$tabla_auto_fit    <- preset_args$tabla_auto_fit    %||% TRUE
    preset_args$tabla_header_fill <- preset_args$tabla_header_fill %||% NA
    preset_args$tabla_body_fill   <- preset_args$tabla_body_fill   %||% NA
    preset_args$tabla_grid_col    <- preset_args$tabla_grid_col    %||% "#062A63"
    preset_args$tabla_text_blue   <- preset_args$tabla_text_blue   %||% "#062A63"
    preset_args$tabla_firstcol_bold <- preset_args$tabla_firstcol_bold %||% FALSE
    preset_args$tabla_firstcol_size <- preset_args$tabla_firstcol_size %||% 11
    preset_args$tabla_firstcol_indent_npc <- preset_args$tabla_firstcol_indent_npc %||% 0.015
    preset_args$tabla_height_frac <- preset_args$tabla_height_frac %||% 1
    preset_args$tabla_line_lwd <- preset_args$tabla_line_lwd %||% 1.4
    preset_args$eje_label_mult    <- preset_args$eje_label_mult    %||% 1.06
    preset_args$radar_scale       <- preset_args$radar_scale       %||% 1

    if (identical(modo, "sm")) {
      var_use <- .resolve_ref(el$var, source = source_use, arg_name = "var")$var

      omit_codes  <- el$sm_omit_codes  %||% preset_args$sm_omit_codes  %||% NULL
      omit_labels <- el$sm_omit_labels %||% preset_args$sm_omit_labels %||% NULL
      omit_na     <- el$sm_omit_na     %||% preset_args$sm_omit_na     %||% TRUE

      d_radar <- .radar_build_sm(
        var         = var_use,
        cruce       = cruce,
        top_n       = el$top_n %||% NULL,

        sm_omit_codes  = omit_codes,
        sm_omit_labels = omit_labels,
        sm_omit_na     = omit_na,

        data        = data_radar,
        survey      = ctx_src$survey,
        orders_list = ctx_src$orders_list,
        env_paletas = env_diapos
      )
    } else if (identical(modo, "box")) {
      if (is.list(el$vars) && !is.character(el$vars)) {
        axis_refs <- el$vars
        flat_refs <- .extract_ref_values(axis_refs)
        ctx_all <- lapply(flat_refs, .resolve_ref, arg_name = "vars")
        src_order <- names(data_sources)
        srcs_used <- unique(vapply(ctx_all, `[[`, character(1), "source"))
        srcs_used <- src_order[src_order %in% srcs_used]

        if (!is.null(cruce) && length(srcs_used) > 1L) {
          stop("radar_tabla (modo='box'): cuando `vars` usa varias fuentes, `cruce` debe ser NULL.", call. = FALSE)
        }

        scale_spec <- .shared_scale_spec(ctx_all, arg_name = "radar_tabla(box)")
        ln <- scale_spec$list_name
        choices_use <- scale_spec$choices
        choices_label_col <- .choices_label_col(choices_use)

        label_to_code <- NULL
        if (!is.null(choices_use) && is.data.frame(choices_use) &&
            !is.na(ln) && nzchar(ln) && "list_name" %in% names(choices_use) && "name" %in% names(choices_use)) {
          sub_choices <- choices_use[choices_use$list_name == ln, , drop = FALSE]
          if (nrow(sub_choices)) {
            labels_use <- if (!is.na(choices_label_col) && choices_label_col %in% names(sub_choices)) {
              as.character(sub_choices[[choices_label_col]])
            } else {
              as.character(sub_choices$name)
            }
            label_to_code <- stats::setNames(as.character(sub_choices$name), labels_use)
          }
        }

        codes_box_global <- NULL
        if (!is.null(label_to_code)) {
          codes_box_global <- unname(label_to_code[el$box_labels])
          if (any(is.na(codes_box_global))) {
            stop(
              "radar_tabla (modo='box'): no se mapearon correctamente los codigos desde `box_labels`.\n",
              "Labels pedidos: ", paste(el$box_labels, collapse = " | "),
              call. = FALSE
            )
          }
        }

        default_palette <- function(labels) {
          .graficos_mk_palette(as.character(labels))
        }

        rows <- list()
        for (axis_id in names(axis_refs)) {
          refs_i <- axis_refs[[axis_id]]
          axis_title <- axis_id
          if (!nzchar(trimws(axis_title))) axis_title <- axis_id

          for (ref in refs_i) {
            ctx_v <- .resolve_ref(ref, arg_name = "vars")
            tab <- .tab_freq(ref, filtros = el$filtros %||% list(), source = ctx_v$source)
            if (is.null(tab) || !nrow(tab)) next

            N_total <- NA_real_
            if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
              idx_tot <- which(tab$Opciones == "Total")
              if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
            }

            tab <- tab |>
              dplyr::filter(.data$Opciones != "Total") |>
              dplyr::filter(!is.na(.data$n) & .data$n > 0)

            if (!nrow(tab)) next
            if (!is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
            if (!is.finite(N_total) || N_total <= 0) next

            opts_chr <- as.character(tab$Opciones)
            labels_sel <- el$box_labels
            codes_sel <- codes_box_global %||% character(0)
            matched_sel <- union(
              labels_sel[labels_sel %in% opts_chr],
              codes_sel[codes_sel %in% opts_chr]
            )
            if (!length(matched_sel)) {
              stop(
                "radar_tabla (modo='box'): no se mapearon correctamente las categorias desde `box_labels`.\n",
                "Labels pedidos: ", paste(el$box_labels, collapse = " | "),
                "\nLabels disponibles: ", paste(unique(opts_chr), collapse = " | "),
                call. = FALSE
              )
            }

            n_box <- sum(tab$n[opts_chr %in% matched_sel], na.rm = TRUE)
            pct <- as.numeric(n_box) / N_total

            rows[[length(rows) + 1L]] <- tibble::tibble(
              eje = as.character(axis_title),
              grupo = .pretty_source_label(ctx_v$source),
              valor = as.numeric(pct)
            )
          }
        }

        d_radar <- dplyr::bind_rows(rows)
        if (nrow(d_radar)) {
          group_levels <- unique(unlist(lapply(axis_refs, function(refs_i) {
            refs_i <- refs_i[!is.na(refs_i) & nzchar(trimws(refs_i))]
            if (!length(refs_i)) return(character(0))
            ctx_i <- lapply(refs_i, .resolve_ref, arg_name = "vars")
            src_i <- unique(vapply(ctx_i, `[[`, character(1), "source"))
            src_i <- src_order[src_order %in% src_i]
            vapply(src_i, .pretty_source_label, character(1))
          }), use.names = FALSE))

          d_radar$grupo <- factor(as.character(d_radar$grupo), levels = unique(group_levels))
          pal_user <- el$colores_series %||% NULL
          if (!is.null(pal_user) && !is.null(names(pal_user))) {
            keep <- levels(d_radar$grupo)[levels(d_radar$grupo) %in% names(pal_user)]
            pal_use <- pal_user[keep]
          } else {
            pal_use <- default_palette(levels(d_radar$grupo))
          }
          attr(d_radar, "palette") <- pal_use
        }
      } else {
        vars_use <- vapply(
          .extract_ref_values(el$vars),
          function(v) .resolve_ref(v, source = source_use, arg_name = "vars")$var,
          character(1)
        )
        d_radar <- .radar_build_box(
          vars        = vars_use,
          cruce       = cruce,
          box_labels  = el$box_labels,
          titulo_tabla = titulo_tabla,
          data        = data_radar,
          survey      = ctx_src$survey,
          orders_list = ctx_src$orders_list,
          env_paletas = env_diapos
        )
      }
    } else {
      stop("radar_tabla: modo no soportado: ", modo, call. = FALSE)
    }

    if (is.null(d_radar) || !nrow(d_radar)) return(.blank_canvas(preset_args, el$overrides %||% list()))

    base_args <- list(
      data         = d_radar,
      var_eje      = "eje",
      var_grupo    = "grupo",
      var_valor    = "valor",
      titulo_tabla = titulo_tabla
    )

    # -----------------------------
    # FIX: pasar paleta del CRUCE
    # -----------------------------
    pal_series <- el$colores_series %||% attr(d_radar, "palette", exact = TRUE)

    if (!is.null(pal_series) && is.atomic(pal_series) && length(pal_series) && !is.null(names(pal_series))) {

      # asegurar que los nombres calcen con los niveles reales de `grupo`
      grupos_lvl <- NULL
      if ("grupo" %in% names(d_radar)) {
        if (is.factor(d_radar$grupo)) grupos_lvl <- levels(d_radar$grupo)
        else grupos_lvl <- sort(unique(as.character(d_radar$grupo)))
      }
      if (length(grupos_lvl)) {
        pal_series <- pal_series[names(pal_series) %in% grupos_lvl]
      }

      # inyectar en el argumento correcto segun como se llame en graficar_radar()
      fml <- names(formals(graficar_radar))

      if ("colores_series" %in% fml) {
        base_args$colores_series <- pal_series
      } else if ("colores_grupos" %in% fml) {
        base_args$colores_grupos <- pal_series
      } else if ("colores_lineas" %in% fml) {
        base_args$colores_lineas <- pal_series
      } else if ("palette" %in% fml) {
        base_args$palette <- pal_series
      } else if ("paleta" %in% fml) {
        base_args$paleta <- pal_series
      } else {
        # ultimo recurso: meterlo en overrides por si tu graficar_radar lo recoge alli
        overrides$colores_series <- overrides$colores_series %||% pal_series
        overrides$colores_grupos <- overrides$colores_grupos %||% pal_series
        overrides$colores_lineas <- overrides$colores_lineas %||% pal_series
      }
    }

    args <- .merge_args(base_args, preset_args, overrides)
    fun  <- graficar_radar
    args <- .force_canvas_args(fun, args)
    args <- .keep_formals(fun, args)

    suppressWarnings(do.call(fun, args))
  }

  .render_dim_heatmap <- function(el, preset_args) {
    if (!exists("graficar_heatmap_dimensiones", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_heatmap_dimensiones()` en el entorno/paquete.", call. = FALSE)
    }

    source_use <- .element_source(el)
    ctx_src <- .source_ctx(source_use)
    cruce_var <- if (!is.null(el$cruce)) .resolve_ref(el$cruce, source = source_use, arg_name = "cruce")$var else NULL
    iter_var <- if (!is.null(el$iter_var)) .resolve_ref(el$iter_var, source = source_use, arg_name = "iter_var")$var else NULL
    data_dim <- .inject_dimensiones_palette(ctx_src$data, el$cruce %||% NULL, source = source_use)

    base_args <- list(
      data = data_dim,
      instrumento = ctx_src$instrumento,
      modo = el$modo,
      objetivo = el$objetivo,
      cruce = cruce_var,
      incluir_total = el$incluir_total %||% NULL,
      modo_semaforo = el$modo_semaforo %||% NULL,
      brecha_filas = el$brecha_filas %||% FALSE,
      etiq_brecha_filas = el$etiq_brecha_filas %||% "Brecha",
      brecha_cols = el$brecha_cols %||% FALSE,
      etiq_brecha_cols = el$etiq_brecha_cols %||% "Brecha",
      aplicar_gradiente_brecha = el$aplicar_gradiente_brecha %||% TRUE,
      brecha_colores = el$brecha_colores %||% c(bajo = "#FFFFFF", alto = "#F4B183"),
      brecha_cortes = el$brecha_cortes %||% c(0, 30),
      size_ejes_x = el$size_ejes_x %||% NULL,
      titulo_total_x = el$titulo_total_x %||% "Total",
      titulo_total_y = el$titulo_total_y %||% "Total cruce",
      mostrar_n_cruce_x = el$mostrar_n_cruce_x %||% FALSE,
      filtros = el$filtros %||% list(),
      iter_var = iter_var,
      iter_level = el$iter_level %||% NULL,
      titulo = NULL,
      subtitulo = NULL,
      nota_pie = NULL,
      nota_pie_externa = TRUE
    )

    args <- .merge_args(base_args, preset_args %||% list(), el$overrides %||% list())
    args <- .force_canvas_args(graficar_heatmap_dimensiones, args)
    args <- .keep_formals(graficar_heatmap_dimensiones, args)
    suppressWarnings(do.call(graficar_heatmap_dimensiones, args))
  }

  .render_dim_heatmap_criterios <- function(el, preset_args) {
    if (!exists("graficar_heatmap_criterios_dimensiones", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_heatmap_criterios_dimensiones()` en el entorno/paquete.", call. = FALSE)
    }

    source_use <- .element_source(el)
    ctx_src <- .source_ctx(source_use)
    data_dim <- .filter_data(el$filtros %||% list(), source = source_use)

    config_use <- lapply(el$config_criterios, function(cfg) {
      cfg <- as.list(cfg)
      vars <- as.character(cfg$vars %||% character(0))
      vars <- vars[!is.na(vars) & nzchar(trimws(vars))]
      if (!length(vars)) {
        stop("Cada conductor en `config_criterios` debe incluir `vars` no vacios.", call. = FALSE)
      }
      cfg$vars <- vapply(vars, function(v) {
        .resolve_ref(v, source = source_use, arg_name = "config_criterios$vars")$var
      }, character(1))
      cfg
    })

    base_args <- list(
      data = data_dim,
      instrumento = ctx_src$instrumento,
      config_criterios = config_use,
      titulo = NULL,
      subtitulo = NULL,
      nota_pie = NULL
    )

    args <- .merge_args(base_args, preset_args %||% list(), el$overrides %||% list())
    args <- .force_canvas_args(graficar_heatmap_criterios_dimensiones, args)
    args <- .keep_formals(graficar_heatmap_criterios_dimensiones, args)
    suppressWarnings(do.call(graficar_heatmap_criterios_dimensiones, args))
  }

  .render_dim_radar <- function(el, preset_args) {
    if (!exists("graficar_radar_dimensiones", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_radar_dimensiones()` en el entorno/paquete.", call. = FALSE)
    }

    source_use <- .element_source(el)
    ctx_src <- .source_ctx(source_use)
    cruce_var <- if (!is.null(el$cruce)) .resolve_ref(el$cruce, source = source_use, arg_name = "cruce")$var else NULL
    iter_var <- if (!is.null(el$iter_var)) .resolve_ref(el$iter_var, source = source_use, arg_name = "iter_var")$var else NULL
    data_dim <- .inject_dimensiones_palette(ctx_src$data, el$cruce %||% NULL, source = source_use)

    base_args <- list(
      data = data_dim,
      instrumento = ctx_src$instrumento,
      modo = el$modo,
      objetivo = el$objetivo,
      cruce = cruce_var,
      incluir_total = el$incluir_total %||% NULL,
      inicio_eje_pct = el$inicio_eje_pct %||% NULL,
      filtros = el$filtros %||% list(),
      iter_var = iter_var,
      iter_level = el$iter_level %||% NULL,
      titulo = NULL,
      subtitulo = NULL,
      nota_pie = NULL,
      nota_pie_externa = TRUE
    )

    args <- .merge_args(base_args, preset_args %||% list(), el$overrides %||% list())
    args <- .force_canvas_args(graficar_radar_dimensiones, args)
    args <- .keep_formals(graficar_radar_dimensiones, args)
    suppressWarnings(do.call(graficar_radar_dimensiones, args))
  }

  .render_dim_comparativo_radarbar <- function(el, preset_args) {
    if (!exists("graficar_comparativo_radarbar_dimensiones", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_comparativo_radarbar_dimensiones()` en el entorno/paquete.", call. = FALSE)
    }

    source_use <- .element_source(el)
    ctx_src <- .source_ctx(source_use)
    cruce_var <- if (!is.null(el$cruce)) .resolve_ref(el$cruce, source = source_use, arg_name = "cruce")$var else NULL
    iter_var <- if (!is.null(el$iter_var)) .resolve_ref(el$iter_var, source = source_use, arg_name = "iter_var")$var else NULL
    data_dim <- .inject_dimensiones_palette(ctx_src$data, el$cruce %||% NULL, source = source_use)

    base_args <- list(
      data = data_dim,
      instrumento = ctx_src$instrumento,
      modo = el$modo,
      objetivo = el$objetivo,
      cruce = cruce_var,
      incluir_total = el$incluir_total %||% FALSE,
      radar_min_ejes = el$radar_min_ejes %||% 5L,
      inicio_eje_pct = el$inicio_eje_pct %||% NULL,
      filtros = el$filtros %||% list(),
      iter_var = iter_var,
      iter_level = el$iter_level %||% NULL,
      titulo = NULL,
      subtitulo = NULL,
      nota_pie = NULL,
      nota_pie_externa = TRUE
    )

    args <- .merge_args(base_args, preset_args %||% list(), el$overrides %||% list())
    args <- .force_canvas_args(graficar_comparativo_radarbar_dimensiones, args)
    args <- .keep_formals(graficar_comparativo_radarbar_dimensiones, args)
    suppressWarnings(do.call(graficar_comparativo_radarbar_dimensiones, args))
  }

  .render_dim_foda <- function(el, preset_args) {
    if (!exists("graficar_foda_dimensiones", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_foda_dimensiones()` en el entorno/paquete.", call. = FALSE)
    }

    source_use <- .element_source(el)
    ctx_src <- .source_ctx(source_use)
    preset_args <- preset_args %||% list()
    overrides <- el$overrides %||% list()

    cruce_ref <- overrides$cruce %||% el$cruce %||% preset_args$cruce %||% NULL
    overrides$cruce <- NULL
    preset_args$cruce <- NULL

    cruce_var <- NULL
    if (!is.null(cruce_ref) &&
        is.character(cruce_ref) &&
        length(cruce_ref) == 1L &&
        nzchar(trimws(cruce_ref))) {
      cruce_var <- .resolve_ref(cruce_ref, source = source_use, arg_name = "cruce")$var
    }

    data_dim <- .inject_dimensiones_palette(
      ctx_src$data,
      cruce = cruce_ref,
      source = source_use
    )

    base_args <- list(
      data = data_dim,
      instrumento = ctx_src$instrumento,
      nivel = el$nivel %||% "subindices",
      objetivo = el$objetivo %||% NULL,
      modo_foda = el$modo_foda %||% "matriz",
      cruce = cruce_var,
      incluir_total = el$incluir_total %||% TRUE,
      filtros = el$filtros %||% list(),
      usar_pesos = el$usar_pesos %||% TRUE,
      modo_semaforo = el$modo_semaforo %||% NULL,
      titulo = NULL,
      subtitulo = NULL,
      nota_pie = NULL
    )

    args <- .merge_args(base_args, preset_args, overrides)
    args <- .force_canvas_args(graficar_foda_dimensiones, args)
    args <- .keep_formals(graficar_foda_dimensiones, args)
    suppressWarnings(do.call(graficar_foda_dimensiones, args))
  }

  # ---------------------------------------------------------------------------
  # 6) Normalizar plan
  # ---------------------------------------------------------------------------
  if (is.null(plan)) {
    plan_accum <- NULL
    if (exists(.ppt_plan_name, envir = env_diapos, inherits = TRUE)) {
      cand <- get(.ppt_plan_name, envir = env_diapos, inherits = TRUE)
      if (is.list(cand) && length(cand)) {
        plan_accum <- cand
        class(plan_accum) <- unique(c("ppt_plan","list", class(plan_accum)))
      }
    }

    if (!is.null(plan_accum) && length(plan_accum)) {
      plan <- plan_accum
      .validate_plan(plan, strict = strict_diapos)

    } else {
      diapos <- .collect_diapos(env = env_diapos, strict = strict_diapos)
      if (!length(diapos)) {
        plan <- structure(list(), class = c("ppt_plan", "list"))
      } else {
        plan <- unname(diapos)
        class(plan) <- c("ppt_plan", "list")
        attr(plan, "diapo_names") <- names(diapos)
      }
      .validate_plan(plan, strict = strict_diapos)
    }

  } else {
    if (!is.list(plan)) .plan_input_abort("`plan` debe ser una lista de slides.")
    .validate_plan(plan, strict = strict_diapos)
  }

  if (isTRUE(auto_otros_slides)) {
    plan <- .reporte_plan_insert_otros_slides(plan)
    .validate_plan(plan, strict = strict_diapos)
  }

  # Ver `reporte_plan_particion.R`: una escala con demasiadas barras adelgaza
  # hasta ser ilegible, y la unica salida es una lamina de mas.
  plan <- .plan_particionar_escalas(plan, .slide_plot_elements)

  if (!length(plan)) .plan_input_abort("No hay diapositivas...")

  # ---------------------------------------------------------------------------
  # 7) Abrir plantilla / doc (solo si exporta)
  # ---------------------------------------------------------------------------
  opened_template_path <- NULL

  if (isTRUE(solo_lista)) {
    doc <- NULL
  } else {

    # Si el usuario no paso template_pptx (NULL/NA/"") -> intentar interna.
    # Busca primero en `prosecnurapp` (paquete actual de la app), luego en
    # `prosecnur` (paquete legacy) como fallback. Esto permite que el repo
    # del proyecto incluya su propia plantilla actualizada en
    # api/inst/plantillas/ sin depender del paquete viejo instalado.
    if (is.null(template_pptx) || is.na(template_pptx) || !nzchar(template_pptx)) {

      template_interno <- system.file("plantillas/plantilla_16_9.pptx", package = "prosecnurapp")
      if (!nzchar(template_interno) || !file.exists(template_interno)) {
        # Fallback: paquete legacy `prosecnur`
        template_interno <- system.file("plantillas/plantilla_16_9.pptx", package = "prosecnur")
      }
      # Fallback adicional: ruta absoluta dentro del repo (útil cuando el
      # paquete prosecnurapp se carga via pkgload::load_all() y system.file()
      # aún no encuentra inst/ por el modo dev)
      if (!nzchar(template_interno) || !file.exists(template_interno)) {
        repo_root <- Sys.getenv("PULSO_REPO_ROOT", "")
        if (nzchar(repo_root)) {
          candidate <- file.path(repo_root, "api", "inst", "plantillas", "plantilla_16_9.pptx")
          if (file.exists(candidate)) template_interno <- candidate
        }
      }

      if (nzchar(template_interno) && file.exists(template_interno)) {
        if (isTRUE(mensajes_progreso)) message("Usando plantilla interna: ", template_interno)
        opened_template_path <- template_interno
        doc <- officer::read_pptx(path = template_interno)
      } else {
        if (isTRUE(mensajes_progreso)) message("No se encontro plantilla interna. Usando PPT default.")
        doc <- officer::read_pptx()
      }

    } else {
      # Plantilla externa explicita
      if (!file.exists(template_pptx)) .plan_input_abort("No existe `template_pptx`: ", template_pptx)
      if (isTRUE(mensajes_progreso)) message("Usando plantilla externa: ", template_pptx)
      opened_template_path <- template_pptx
      doc <- officer::read_pptx(path = template_pptx)
    }

    # La selección de layouts y toda calibración efectiva se resuelven una sola
    # vez, fuera de esta rama, para compartir el mismo objeto con el serializer.
  }

  explicit_template_id <- trimws(as.character(template_id %||% "")[1])
  PPT_RESOLVED_CONTRACT <- .ppt_resolve_slide_template_contract(
    doc = doc,
    master = master,
    presets = presets,
    metadata = .SLIDES_META,
    template_id = explicit_template_id,
    identity_source = if (nzchar(explicit_template_id)) "template_id" else "default",
    template_fingerprint = .ppt_slide_template_file_fingerprint(opened_template_path)
  )
  PPT_CONTRACT <- attr(PPT_RESOLVED_CONTRACT, "ppt_contract")
  layout_info <- attr(PPT_RESOLVED_CONTRACT, "layout_info")
  master <- attr(PPT_RESOLVED_CONTRACT, "master")

  # ---------------------------------------------------------------------------
  # 8) Render + export (estricto con .PPT_CONTRACT)
  # ---------------------------------------------------------------------------
  log_rows   <- list()
  rendered   <- list()
  render_meta <- list()

  for (i in seq_along(plan)) {

    slide <- plan[[i]]
    if (!inherits(slide, "ppt_slide")) {
      .plan_input_abort("Cada slide debe tener clase `ppt_slide`.")
    }

    stype <- slide$.slide_type %||% NA_character_

    if (isTRUE(mensajes_progreso)) {
      .msg_diapo(
        i, length(plan), stype,
        el_plot = NULL,
        mensajes_progreso = mensajes_progreso
      )
    }

    # ---- TITLE SLIDE ---------------------------------------------------------
    if (identical(stype, "title_slide")) {

      contract <- PPT_CONTRACT$title_slide
      slots <- slide$slots %||% list()

      ttl  <- slots$title      %||% slide$title %||% NULL
      sub  <- slots$subtitle   %||% NULL
      dt   <- slots$date       %||% NULL
      stx  <- slots$subtexto   %||% NULL

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)
        doc <- .ppt_add_partner_cover_logo(doc, presets$base$args %||% list())

        # title (requerido)
        if (!is.null(ttl) && nzchar(trimws(ttl))) {
          doc <- .ph_with_strict(doc, ttl, contract$slots$title)
        } else {
          .plan_input_abort("title_slide requiere `title` no vacio.")
        }

        # opcionales (solo si vienen)
        if (!is.null(sub) && nzchar(trimws(sub))) {
          base_args <- presets$base$args %||% list()
          doc <- .ph_with_styled_text(
            doc,
            sub,
            contract$slots$subtitle,
            color = base_args$color_subtitulo_portada %||% base_args$color_subtitulo %||% "#081F5C",
            font_size = base_args$size_subtitulo_portada %||% base_args$size_subtitulo_slide %||% 16,
            font_family = base_args$font_family_subtitulo_portada %||% base_args$font_family_portada %||%
              base_args$font_family_ppt %||% base_args$font_family,
            bold = TRUE,
            align = "center",
            top_offset = base_args$top_offset_subtitulo_portada %||% 0.28,
            height = base_args$height_subtitulo_portada %||% 0.42
          )
        }
        if (!is.null(dt) && nzchar(trimws(dt))) {
          doc <- .ph_with_strict(doc, dt, contract$slots$date)
        }
        if (!is.null(stx) && nzchar(trimws(stx))) {
          doc <- .ph_with_strict(doc, stx, contract$slots$subtexto)
        }
      }

      if (isTRUE(build_render_meta)) {
        render_meta[[length(render_meta) + 1]] <- list(
          kind     = "title_doc",
          title    = ttl,
          subtitle = sub,
          date     = dt,
          subtexto = stx
        )
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "title_slide",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- INDICE --------------------------------------------------------------
    if (identical(stype, "indice")) {

      contract <- PPT_CONTRACT$indice
      slots <- slide$slots %||% list()
      style <- slide$style %||% slots$estilo %||% list()
      if (!is.null(slots$iconos_focos)) style$iconos_focos <- slots$iconos_focos
      if (!is.null(slots$redibujar_focos)) style$redibujar_focos <- isTRUE(slots$redibujar_focos)
      if (!is.null(slots$mostrar_iconos_focos)) style$mostrar_iconos_focos <- isTRUE(slots$mostrar_iconos_focos)
      if (!is.null(slots$iconos_focos_fill)) style$iconos_focos_fill <- slots$iconos_focos_fill
      if (!is.null(slots$iconos_focos_objeto_unico)) {
        style$iconos_focos_objeto_unico <- isTRUE(slots$iconos_focos_objeto_unico)
      }
      diametro_in <- .indice_cm_to_in_vec(slots$iconos_focos_diametro_cm %||% NULL, recycle = TRUE)
      if (!is.null(diametro_in)) {
        style$iconos_focos_cover_width <- diametro_in
        style$iconos_focos_cover_height <- diametro_in
      }
      icon_scale <- .indice_recycle_focus_vec(.indice_parse_numeric_vec(slots$iconos_focos_icon_scale %||% NULL))
      if (!is.null(icon_scale)) style$iconos_focos_icon_scale <- icon_scale
      for (nm in c("subtopic_badge_fill", "subtopic_badge_width", "subtopic_badge_gap")) {
        if (!is.null(slots[[nm]])) style[[nm]] <- slots[[nm]]
      }

      title_raw <- slots$title %||% slide$title %||% NULL
      secciones <- .indice_clean_vec(slots$secciones %||% NULL)
      subtemas <- .indice_clean_vec(slots$subtemas %||% NULL)
      subindices_df <- .indice_subindices_df(
        subindices = slots$subindices %||% NULL,
        subtemas = subtemas,
        secciones = secciones
      )
      has_custom_index <- length(secciones) > 0L ||
        nrow(subindices_df) > 0L ||
        (!is.null(title_raw) && nzchar(trimws(as.character(title_raw)[1])))

      two_column_index <- isTRUE(.style_value(style, "acnur_two_column_index", FALSE))
      if (!isTRUE(solo_lista) && isTRUE(has_custom_index) && isTRUE(two_column_index)) {
        custom_layout <- PPT_CONTRACT$text_slide$layout %||% contract$layout
        doc <- .add_slide_strict(doc, custom_layout)
        font_family_default <- presets$base$args$font_family_ppt %||%
          presets$base$args$font_family %||% "Arial"
        doc <- .ppt_add_acnur_two_column_index(
          doc,
          title = title_raw %||% "Contenido",
          sections = secciones,
          style = style,
          font_family = font_family_default
        )
      } else if (!isTRUE(solo_lista)) {
        if (isTRUE(has_custom_index)) {
          custom_layout <- contract$layout %||% NA_character_
          if (is.null(custom_layout) || is.na(custom_layout) || !nzchar(custom_layout)) {
            custom_layout <- PPT_CONTRACT$text_slide$layout %||% NA_character_
          }
          doc <- .add_slide_strict(doc, custom_layout)

          font_family_default <- presets$base$args$font_family_ppt %||%
            presets$base$args$font_family %||% "Arial"
          style$font_family <- style$font_family %||% font_family_default
          background_fill <- as.character(.style_value(style, "background_fill", "#F2F2F2"))[1]

          if (isTRUE(.style_value(style, "limpiar_panel_indice", TRUE))) {
            doc <- .add_indice_cover(
              doc,
              left = .style_num(style, "panel_left", 6.42, min = 0),
              top = .style_num(style, "panel_top", 1.55, min = 0),
              width = .style_num(style, "panel_width", 5.86, min = 1),
              height = .style_num(style, "panel_height", 4.22, min = 1),
              fill = background_fill,
              label = "Indice right content cover"
            )
          }
          doc <- .add_indice_bulb_icons(doc, style)

          title_txt <- title_raw %||% "Índice"
          title_txt <- as.character(title_txt)[1]
          title_txt <- trimws(title_txt)
          if (!nzchar(title_txt)) title_txt <- "Índice"
          if (isTRUE(.style_value(style, "mayusculas_titulo", TRUE))) {
            title_txt <- toupper(title_txt)
          }

          # Geometria adaptativa (H16/H17): titulo multilinea corre la tabla,
          # badges por digitos y compresion vertical. reporte_plan_helpers.R.
          style$title_left <- style$title_left %||% contract$slots$title$loc$left
          style$title_top <- style$title_top %||% contract$slots$title$loc$top
          style$title_width <- style$title_width %||% contract$slots$title$loc$width
          style$title_height <- style$title_height %||% contract$slots$title$loc$height
          style$table_left <- style$table_left %||% contract$slots$content$loc$left
          style$table_top <- style$table_top %||% contract$slots$content$loc$top
          style$table_width <- style$table_width %||% contract$slots$content$loc$width
          fit <- .indice_fit_layout(style, title_txt, secciones, subindices_df)
          style <- fit$style
          title_prop <- officer::fp_text(
            color = as.character(.style_value(style, "title_color", "#081F5C"))[1],
            font.size = fit$title_size,
            bold = TRUE,
            font.family = as.character(style$font_family)[1]
          )
          title_value <- officer::fpar(
            officer::ftext(title_txt, prop = title_prop),
            fp_p = officer::fp_par(
              text.align = as.character(.style_value(style, "title_align", "center"))[1],
              line_spacing = 1
            )
          )
          doc <- officer::ph_with(
            doc,
            value = title_value,
            location = officer::ph_location(
              left = fit$title_left,
              top = fit$title_top,
              width = fit$title_width,
              height = fit$title_height
            )
          )

          table_left <- fit$table_left
          table_top <- fit$table_top
          table_width <- fit$table_width
          row_height <- fit$row_height

          subindices_inline <- isTRUE(.style_value(style, "subindices_inline", TRUE))
          if (length(secciones) && nrow(subindices_df) && subindices_inline) {
            sub_keys <- .indice_section_key(subindices_df$seccion)
            section_keys <- .indice_section_key(secciones)
            current_top <- table_top
            row_gap <- .style_num(style, "row_gap", 0.10, min = 0, max = 0.35)
            subtopic_top_gap <- .style_num(style, "subtopic_inline_top_gap", 0.10, min = 0, max = 0.30)
            subtopic_bottom_gap <- .style_num(style, "subtopic_inline_bottom_gap", 0.13, min = 0, max = 0.35)
            subtopic_left <- .style_num(
              style,
              "subtopic_inline_left",
              table_left + 0.18,
              min = 0
            )
            subtopic_width <- .style_num(
              style,
              "subtopic_inline_width",
              table_width + 0.60,
              min = 2.2
            )

            for (idx_section in seq_along(secciones)) {
              ft_index <- .make_indice_sections_flextable(
                secciones[[idx_section]],
                style = style,
                font_family_default = font_family_default,
                numeros = idx_section
              )
              doc <- officer::ph_with(
                doc,
                value = ft_index,
                location = officer::ph_location(
                  left = table_left,
                  top = current_top,
                  width = table_width,
                  height = row_height + 0.04
                )
              )

              current_top <- current_top + row_height
              subtopic_items <- subindices_df$item[sub_keys == section_keys[[idx_section]]]
              if (length(subtopic_items)) {
                mostrar_grupo <- .style_value(style, "mostrar_grupo_subindice", FALSE)
                subtopic_labels <- if (isTRUE(mostrar_grupo)) {
                  paste0(secciones[[idx_section]], ": ", subtopic_items)
                } else {
                  subtopic_items
                }
                subtopic_numbers <- paste0(idx_section, ".", seq_along(subtopic_labels))
                doc <- .add_indice_subtopics(
                  doc,
                  labels = subtopic_labels,
                  style = style,
                  font_family_default = font_family_default,
                  anchor_left = subtopic_left,
                  anchor_top = current_top + subtopic_top_gap,
                  anchor_width = subtopic_width,
                  number_labels = subtopic_numbers
                )
                current_top <- current_top +
                  subtopic_top_gap +
                  .indice_subtopics_height(subtopic_labels, style) +
                  subtopic_bottom_gap
              } else {
                current_top <- current_top + row_gap
              }
            }
          } else if (length(secciones)) {
            ft_index <- .make_indice_sections_flextable(
              secciones,
              style = style,
              font_family_default = font_family_default
            )
            doc <- officer::ph_with(
              doc,
              value = ft_index,
              location = officer::ph_location(
                left = table_left,
                top = table_top,
                width = table_width,
                height = row_height * length(secciones) + 0.08
              )
            )
          }

          if (nrow(subindices_df) && (!length(secciones) || !subindices_inline)) {
            subtopic_top <- .style_num(
              style,
              "subtopic_top",
              table_top + max(1L, length(secciones)) * row_height + 0.30,
              min = 0
            )
            subtopic_left <- .style_num(style, "subtopic_left", table_left + 0.18, min = 0)
            subtopic_width <- .style_num(style, "subtopic_width", table_width - 0.18, min = 3)

            mostrar_grupo <- .style_value(
              style,
              "mostrar_grupo_subindice",
              FALSE
            )
            subtopic_labels <- if (isTRUE(mostrar_grupo)) {
              paste0(subindices_df$seccion, ": ", subindices_df$item)
            } else {
              subindices_df$item
            }
            subtopic_numbers <- .indice_subtopic_number_labels(
              subindices_df,
              secciones = secciones
            )
            doc <- .add_indice_subtopics(
              doc,
              labels = subtopic_labels,
              style = style,
              font_family_default = font_family_default,
              anchor_left = subtopic_left,
              anchor_top = subtopic_top,
              anchor_width = subtopic_width,
              number_labels = subtopic_numbers
            )
          }
        } else {
          doc <- .add_slide_strict(doc, contract$layout)
        }
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "indice",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- TOP_TWO_BOX --------------------------------------------------------
    if (identical(stype, "top_two_box")) {

      contract <- PPT_CONTRACT$top_two_box
      slots <- slide$slots %||% list()
      style <- slide$style %||% slots$estilo %||% list()
      if (!is.null(slots$accent_color)) style$accent_color <- slots$accent_color
      if (!is.null(slots$colores)) style$colores <- slots$colores
      if (!is.null(slots$grosor_barra)) style$grosor_barra <- slots$grosor_barra
      if (!is.null(slots$size_texto_porcentajes)) style$size_texto_porcentajes <- slots$size_texto_porcentajes
      if (!is.null(slots$size_texto_porcentajes_peq)) style$size_texto_porcentajes_peq <- slots$size_texto_porcentajes_peq
      if (!is.null(slots$color_texto_porcentajes)) style$color_texto_porcentajes <- slots$color_texto_porcentajes
      if (!is.null(slots$margen_llave)) style$margen_llave <- slots$margen_llave
      if (!is.null(slots$grosor_flecha)) style$grosor_flecha <- slots$grosor_flecha

      if (is.null(contract$layout) || is.na(contract$layout) || !nzchar(contract$layout)) {
        .plan_input_abort("La plantilla NO tiene layout requerido para `top_two_box`: 'Title and Content' o 'General Objective'.")
      }

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)

        font_family_default <- presets$base$args$font_family_ppt %||%
          presets$base$args$font_family %||% "Arial"
        style$font_family <- style$font_family %||% font_family_default

        title_text <- as.character(slots$title %||% slide$title %||% "TOP TWO BOX")[1]
        if (!nzchar(trimws(title_text))) title_text <- "TOP TWO BOX"
        if (isTRUE(.style_value(style, "mayusculas_titulo", TRUE))) title_text <- toupper(title_text)

        title_value <- officer::fpar(
          officer::ftext(
            title_text,
            prop = officer::fp_text(
              color = as.character(.style_value(style, "title_color", .style_value(style, "accent_color", "#D8504F")))[1],
              font.size = .style_num(style, "title_size", 24, min = 8),
              bold = TRUE,
              font.family = as.character(style$font_family)[1]
            )
          ),
          fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
        )
        doc <- officer::ph_with(
          doc,
          value = title_value,
          location = officer::ph_location(
            left = .style_num(style, "title_left", contract$slots$title$loc$left, min = 0),
            top = .style_num(style, "title_top", contract$slots$title$loc$top, min = 0),
            width = .style_num(style, "title_width", contract$slots$title$loc$width, min = 1),
            height = .style_num(style, "title_height", contract$slots$title$loc$height, min = 0.2),
            newlabel = "Top Two Box title"
          )
        )

        body_text <- as.character(slots$text %||% "")[1]
        body_value <- officer::fpar(
          officer::ftext(
            body_text,
            prop = officer::fp_text(
              color = as.character(.style_value(style, "text_color", "#081F5C"))[1],
              font.size = .style_num(style, "text_size", 14.8, min = 8),
              bold = FALSE,
              font.family = as.character(style$font_family)[1]
            )
          ),
          fp_p = officer::fp_par(text.align = "justify", line_spacing = 1.05)
        )
        doc <- officer::ph_with(
          doc,
          value = body_value,
          location = officer::ph_location(
            left = .style_num(style, "text_left", contract$slots$text$loc$left, min = 0),
            top = .style_num(style, "text_top", contract$slots$text$loc$top, min = 0),
            width = .style_num(style, "text_width", contract$slots$text$loc$width, min = 3),
            height = .style_num(style, "text_height", contract$slots$text$loc$height, min = 0.2),
            newlabel = "Top Two Box text"
          )
        )

        svg <- .top_two_box_svg(
          valores = slots$valores %||% c(5, 5, 35, 55),
          etiquetas = slots$etiquetas %||% c("1", "2", "3", "4"),
          top_two_indices = slots$top_two_indices %||% c(3, 4),
          extremo_izquierda = slots$extremo_izquierda %||% "Totalmente\nen desacuerdo",
          extremo_derecha = slots$extremo_derecha %||% "Totalmente\nde acuerdo",
          style = style
        )
        diagram_spec <- contract$slots$diagram$loc
        diagram_top <- .style_num(style, "diagram_top", diagram_spec$top, min = 0)
        diagram_height <- .style_num(style, "diagram_height", diagram_spec$height, min = 1)
        diagram_width_default <- diagram_spec$width
        diagram_width <- .style_num(style, "diagram_width", diagram_width_default, min = 3)
        diagram_center_x <- .style_num(
          style,
          "diagram_center_x",
          diagram_spec$left + diagram_spec$width / 2,
          min = 0
        )
        diagram_left <- .style_num(
          style,
          "diagram_left",
          if (is.null(style$diagram_center_x) && is.null(style$diagram_width)) {
            diagram_spec$left
          } else {
            max(0, diagram_center_x - diagram_width / 2)
          },
          min = 0
        )
        doc <- officer::ph_with(
          doc,
          value = officer::external_img(src = svg, width = diagram_width, height = diagram_height, alt = "Top Two Box"),
          location = officer::ph_location(
            left = diagram_left,
            top = diagram_top,
            width = diagram_width,
            height = diagram_height,
            newlabel = "Top Two Box diagram"
          )
        )
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "top_two_box",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- REDONDEO (lámina metodológica; renderer en reporte_slide_redondeo.R) -
    if (identical(stype, "redondeo")) {
      if (!isTRUE(solo_lista)) doc <- .reporte_slide_redondeo(
        doc, slide, presets, PPT_CONTRACT$top_two_box,
        list(add_slide = .add_slide_strict, style_value = .style_value,
             style_num = .style_num, escape = .svg_text_escape, fill = .indice_sanitize_fill))
      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i = i, slide_type = "redondeo", element = NA_character_, var = NA_character_)
      next
    }

    # ---- TEXT_SLIDE ----------------------------------------------------------
    if (identical(stype, "text_slide")) {

      contract <- PPT_CONTRACT$text_slide
      slots <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL
      txt <- slots$text %||% NULL

      if (is.null(contract$layout) || is.na(contract$layout) || !nzchar(contract$layout)) {
        .plan_input_abort("La plantilla NO tiene layout requerido para `text_slide`: 'Title and Content' o 'General Objective'.")
      }

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)

        base_args <- presets$base$args %||% list()
        font_family <- base_args$font_family_ppt %||% base_args$font_family %||% "Arial"
        font_family <- as.character(font_family)[1]
        if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"

        title_size <- suppressWarnings(as.numeric(base_args$size_titulo_slide %||% 24)[1])
        if (!is.finite(title_size) || is.na(title_size) || title_size <= 0) title_size <- 24
        body_size <- suppressWarnings(as.numeric(base_args$size_cuerpo_slide %||% 14)[1])
        if (!is.finite(body_size) || is.na(body_size) || body_size <= 0) body_size <- 14

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          title_value <- officer::fpar(
            officer::ftext(
              as.character(title_slide)[1],
              prop = officer::fp_text(
                color = base_args$color_titulo_slide %||% "#CA5651",
                font.size = title_size,
                bold = TRUE,
                font.family = font_family
              )
            ),
            fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
          )
          # R7: el placeholder de este layout vive a 0.57 cm del borde. Si queda
          # bajo el piso se emite por coordenadas; si ya cumple, `NULL` y sigue
          # la via del placeholder. Ver `reporte_ppt_titulo_piso.R`.
          loc_piso <- .ppt_titulo_loc_con_piso(
            doc, contract$layout, contract$slots$title
          )
          if (is.null(loc_piso)) {
            doc <- .ph_with_strict(doc, title_value, contract$slots$title)
          } else {
            doc <- officer::ph_with(doc, value = title_value, location = loc_piso)
          }
        } else {
          .plan_input_abort("text_slide requiere `title` no vacio.")
        }

        if (is.null(txt) || !nzchar(trimws(as.character(txt)[1]))) txt <- " "
        # Multilinea y a la IZQUIERDA. El cuerpo se emitia en un solo run, donde
        # un `\n` no es salto de linea en OOXML, asi que el texto y sus bullets
        # —que el constructor si separa— salian pegados: «...gráfico
        # correspondiente.• Los porcentajes están redondeados...». Y justificado
        # cuando el resto del mazo, y el entregable aprobado, van a la izquierda.
        body_value <- .ppt_fpar_multilinea(
          as.character(txt)[1],
          prop = officer::fp_text(
            color = base_args$color_nota_pie %||% "#081F5C",
            font.size = body_size,
            bold = FALSE,
            font.family = font_family
          ),
          align = as.character(.style_value(slide$style %||% list(), "text_align", "left"))[1]
        )

        # Diapositivas auto-generadas de "Otros" traen `slots$columnas`: una
        # lista de bloques de bullets ya repartidos entre N columnas (ver
        # `.paginate_otros_columns()` / `.make_otros_slides()`). Se renderizan
        # como N cajas de texto lado a lado (en vez del bloque unico de
        # `text_slide`) para aprovechar mejor el alto y ancho disponibles, y
        # con una caja aparte para "Base: ..." debajo de las columnas.
        columnas_otros <- slots$columnas %||% NULL
        geom_otros <- NULL
        if (isTRUE(slide$meta$auto_otros %||% FALSE) && length(columnas_otros)) {
          slide_obj <- doc$slide$get_slide(doc$cursor)
          xfrm <- tryCatch(slide_obj$get_xfrm(), error = function(e) NULL)
          layout_name <- NULL
          master_name <- NULL
          if (!is.null(xfrm)) {
            layout_vals <- unique(as.character(xfrm$name))
            layout_vals <- layout_vals[!is.na(layout_vals) & nzchar(trimws(layout_vals))]
            if (length(layout_vals)) layout_name <- layout_vals[1]
            master_vals <- unique(as.character(xfrm$master_name))
            master_vals <- master_vals[!is.na(master_vals) & nzchar(trimws(master_vals))]
            if (length(master_vals)) master_name <- master_vals[1]
          }
          if (is.null(master_name) || !nzchar(master_name)) master_name <- master

          geom_otros <- tryCatch({
            props <- officer::layout_properties(doc, layout = layout_name, master = master_name)
            props <- .select_placeholder_props(props, contract$slots$text, layout_name, master_name)
            list(left = props$offx[[1]], top = props$offy[[1]], width = props$cx[[1]], height = props$cy[[1]])
          }, error = function(e) NULL)
        }

        if (!is.null(geom_otros)) {
          n_cols <- length(columnas_otros)
          otros_body_size <- suppressWarnings(as.numeric(base_args$size_cuerpo_otros %||% 16)[1])
          if (!is.finite(otros_body_size) || is.na(otros_body_size) || otros_body_size <= 0) otros_body_size <- 16

          # El placeholder "body" de la plantilla se define bajo/angosto
          # (pensado para 3-4 lineas de narrativa), lo que dejaba la mitad
          # inferior de la diapositiva vacia para estas listas largas de
          # "Otros". Extendemos la caja hasta cerca del borde inferior real
          # de la diapositiva (via `slide_size()`) en vez de respetar el
          # alto nominal del placeholder, ya que aca renderizamos con
          # `ph_location` explicito (no `.ph_with_strict`).
          slide_dims_otros <- tryCatch(officer::slide_size(doc), error = function(e) NULL)
          slide_h_otros <- suppressWarnings(as.numeric(slide_dims_otros$height %||% 7.5)[1])
          if (!is.finite(slide_h_otros) || is.na(slide_h_otros) || slide_h_otros <= 0) slide_h_otros <- 7.5
          bottom_margin_otros <- 0.35
          avail_height_otros <- max(geom_otros$height, (slide_h_otros - bottom_margin_otros) - geom_otros$top)

          base_line_h <- 0.35
          gap_v <- 0.1
          gutter <- 0.35
          cols_height <- max(0.6, avail_height_otros - base_line_h - gap_v)
          col_width <- max(1.0, (geom_otros$width - gutter * (n_cols - 1)) / n_cols)

          for (ci in seq_len(n_cols)) {
            col_items <- columnas_otros[[ci]]
            if (!length(col_items)) next
            col_value <- officer::fpar(
              officer::ftext(
                .ppt_norm_text_lines(bullets = col_items, blank = " "),
                prop = officer::fp_text(
                  color = base_args$color_nota_pie %||% "#081F5C",
                  font.size = otros_body_size,
                  bold = FALSE,
                  font.family = font_family
                )
              ),
              fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
            )
            doc <- officer::ph_with(
              doc,
              value = col_value,
              location = officer::ph_location(
                left = geom_otros$left + (ci - 1) * (col_width + gutter),
                top = geom_otros$top,
                width = col_width,
                height = cols_height,
                newlabel = paste0("Otros columna ", ci)
              )
            )
          }

          base_txt_otros <- slots$base %||% NULL
          if (!is.null(base_txt_otros) && nzchar(trimws(as.character(base_txt_otros)[1]))) {
            base_value <- officer::fpar(
              officer::ftext(
                as.character(base_txt_otros)[1],
                prop = officer::fp_text(
                  color = base_args$color_nota_pie %||% "#081F5C",
                  font.size = min(otros_body_size, 12),
                  bold = FALSE,
                  font.family = font_family
                )
              ),
              fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
            )
            doc <- officer::ph_with(
              doc,
              value = base_value,
              location = officer::ph_location(
                left = geom_otros$left,
                top = geom_otros$top + cols_height + gap_v,
                width = geom_otros$width,
                height = base_line_h,
                newlabel = "Otros base"
              )
            )
          }
        } else {
          doc <- .ph_with_strict(doc, body_value, contract$slots$text)
        }
      }

      # Diagrama opcional bajo el texto (`reporte_ppt_numero_respuestas.R`):
      # decide y coloca alli, aqui solo se le pasa lo que ve esta lamina.
      doc <- .nresp_colocar(doc, slots, style, solo_lista = solo_lista)

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "text_slide",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- TECHNICAL_TABLE ----------------------------------------------------
    if (identical(stype, "technical_table")) {

      contract <- PPT_CONTRACT$technical_table
      slots <- slide$slots %||% list()
      style <- slide$style %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL
      table_data <- slots$table %||% NULL
      base_txt <- slots$base %||% NULL

      if (is.null(contract$layout) || is.na(contract$layout) || !nzchar(contract$layout)) {
        .plan_input_abort("La plantilla NO tiene layout requerido para `technical_table`: 'Title and Content' o 'General Objective'.")
      }
      if (is.null(title_slide) || !nzchar(trimws(as.character(title_slide)[1]))) {
        .plan_input_abort("technical_table requiere `title` no vacio.")
      }
      if (is.null(table_data) || !is.data.frame(table_data) || ncol(table_data) < 2L || !nrow(table_data)) {
        .plan_input_abort("technical_table requiere `slots$table` como data.frame con al menos dos columnas y una fila.")
      }

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)

        font_family_default <- presets$base$args$font_family_ppt %||%
          presets$base$args$font_family %||% "Arial"
        style$font_family <- style$font_family %||% font_family_default

        title_left <- .style_num(style, "title_left", contract$slots$title$loc$left, min = 0)
        title_top <- .style_num(style, "title_top", contract$slots$title$loc$top, min = 0)
        title_width <- .style_num(style, "title_width", contract$slots$title$loc$width, min = 1)
        title_height <- .style_num(style, "title_height", contract$slots$title$loc$height, min = 0.2)
        title_size <- .style_num(style, "title_size", 24, min = 8)
        title_color <- as.character(.style_value(style, "title_color", "#CA5651"))[1]
        uppercase_title <- .style_value(
          style,
          "mayusculas_titulo",
          FALSE
        )
        uppercase_title <- isTRUE(uppercase_title)
        title_text <- as.character(title_slide)[1]
        if (uppercase_title) title_text <- toupper(title_text)

        title_prop <- officer::fp_text(
          color = title_color,
          font.size = title_size,
          bold = TRUE,
          font.family = as.character(style$font_family)[1]
        )
        title_value <- officer::fpar(
          officer::ftext(title_text, prop = title_prop),
          fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
        )
        doc <- officer::ph_with(
          doc,
          value = title_value,
          location = officer::ph_location(
            left = title_left,
            top = title_top,
            width = title_width,
            height = title_height
          )
        )

        table_left <- .style_num(style, "table_left", contract$slots$table$loc$left, min = 0)
        table_top <- .style_num(style, "table_top", contract$slots$table$loc$top, min = 0)
        table_width <- .style_num(style, "table_width", contract$slots$table$loc$width, min = 4)
        table_height <- .style_num(style, "table_height", contract$slots$table$loc$height, min = 1)
        ft <- .make_technical_table_flextable(
          table_data,
          style = style,
          font_family_default = font_family_default
        )
        doc <- officer::ph_with(
          doc,
          value = ft,
          location = officer::ph_location(
            left = table_left,
            top = table_top,
            width = table_width,
            height = table_height
          )
        )

        if (!is.null(base_txt) && nzchar(trimws(as.character(base_txt)[1]))) {
          footer_prop <- officer::fp_text(
            color = as.character(.style_value(style, "footer_color", "#081F5C"))[1],
            font.size = .style_num(style, "footer_size", 10, min = 5),
            font.family = as.character(style$font_family)[1]
          )
          footer_value <- officer::fpar(
            officer::ftext(as.character(base_txt)[1], prop = footer_prop),
            fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
          )
          doc <- officer::ph_with(
            doc,
            value = footer_value,
            location = officer::ph_location(
              left = .style_num(style, "footer_left", contract$slots$footer$loc$left, min = 0),
              top = .style_num(style, "footer_top", contract$slots$footer$loc$top, min = 0),
              width = .style_num(style, "footer_width", contract$slots$footer$loc$width, min = 1),
              height = .style_num(style, "footer_height", contract$slots$footer$loc$height, min = 0.1)
            )
          )
        }
        doc <- .add_partner_footer_logo(doc)
      }

      if (isTRUE(build_render_meta)) {
        render_meta[[length(render_meta) + 1]] <- list(
          kind = "technical_table",
          title = as.character(title_slide)[1],
          nrow = nrow(table_data)
        )
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "technical_table",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- OBJETIVO_ICONO ------------------------------------------------------
    if (identical(stype, "objetivo_icono")) {

      contract <- PPT_CONTRACT$objetivo_icono
      slots <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL
      txt <- slots$text %||% NULL
      el_icon <- slots$icon %||% NULL

      if (!inherits(el_icon, "ppt_element")) {
        el_icon <- .plan_elemento_degradado("En `p_slide_objetivo_icono()`, `icono` debe ser `ppt_element`.")
      }

      p_icon <- .render_element(el_icon)
      if (is.null(p_icon)) {
        p_icon <- .plan_canvas_render_nulo("No se pudo renderizar `icono` en `p_slide_objetivo_icono()`.")
      }
      rendered[[length(rendered) + 1]] <- p_icon

      if (isTRUE(build_render_meta)) {
        .push_render_meta_for_element(el_icon, p_icon)
      }

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        if (is.null(txt) || !nzchar(trimws(as.character(txt)[1]))) txt <- " "
        # El texto se emitia crudo, asi que heredaba los 12 pt del placeholder
        # del layout. El entregable aprobado escribe el objetivo a 20: es la
        # lamina que declara para que se hizo el estudio y salia en cuerpo de
        # nota al pie.
        style_obj <- slide$style %||% slots$estilo %||% list()
        doc <- .ph_with_strict(
          doc,
          officer::fpar(
            officer::ftext(
              as.character(txt)[1],
              prop = officer::fp_text(
                color = as.character(.style_value(style_obj, "text_color", "#081F5C"))[1],
                font.size = .style_num(style_obj, "text_size", 20, min = 8),
                font.family = as.character(
                  style_obj$font_family %||%
                    presets$base$args$font_family_ppt %||%
                    presets$base$args$font_family %||% "Arial"
                )[1]
              )
            ),
            fp_p = officer::fp_par(text.align = "left", line_spacing = 1)
          ),
          contract$slots$text
        )
        doc <- .ph_with_strict(
          doc,
          .dml_o_tabla(p_icon),
          contract$slots$icon
        )
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "objetivo_icono",
        element    = el_icon$.element_type %||% NA_character_,
        var        = .element_var_label(el_icon)
      )
      next
    }

    # ---- SECTION -------------------------------------------------------------
    if (identical(stype, "section")) {

      contract <- PPT_CONTRACT$section
      title    <- slide$title %||% ""
      subtitle <- slide$subtitle %||% NULL

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)
        doc <- .ph_with_strict(doc, title, contract$slots$title)
        # subtitle no tiene placeholder real en Section Header;
        # se ignora en PPT (solo se usa en Word via build_render_meta).
        # El separador también lleva el logo PULSO (helper en
        # reporte_plan_helpers.R), como portada/ficha/gráficos.
        doc <- .ppt_add_partner_section_logo(doc, presets$base$args %||% list())
      }

      if (isTRUE(build_render_meta)) {
        render_meta[[length(render_meta) + 1]] <- list(
          kind     = "section",
          title    = slide$title    %||% "",
          subtitle = slide$subtitle %||% NULL,
          word_intro = slide$word_intro %||% slide$meta$word_intro %||% NULL,
          meta = slide$meta %||% list()
        )
      }

      if (isTRUE(mensajes_progreso)) {
        message(sprintf("  • seccion: %s", slide$title %||% "<sin titulo>"))
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "section",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- SLIDE_1 -------------------------------------------------------------
    if (identical(stype, "slide_1")) {

      contract <- PPT_CONTRACT$slide_1

      title_slide <- slide$title %||% NULL
      slots       <- slide$slots %||% list()
      suppress_base_placeholder <- isTRUE((slide$meta %||% list())$suppress_base_placeholder)
      suppress_footer_placeholder <- isTRUE((slide$meta %||% list())$suppress_footer_placeholder)
      subtitle_slide <- slots$subtitle %||% NULL
      el_plot     <- slots$plot %||% NULL

      if (!inherits(el_plot, "ppt_element")) {
        el_plot <- .plan_elemento_degradado("En `p_slide_1_grafico()`, `grafico` debe ser `ppt_element`.")
      }

      etype <- el_plot$.element_type %||% NA_character_

      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      el_plot <- .element_adapt_to_plot_slot(el_plot, contract$slots$plot)
      el_plot <- .inject_var_titulo(el_plot)
      p <- .render_element(el_plot, ancho_slot = 12.5)

      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        p <- .plan_canvas_render_nulo("No se pudo renderizar elemento: ", etype, " (", vv, ").")
      }

      rendered[[length(rendered) + 1]] <- p

      if (isTRUE(build_render_meta)) {
        # Inyectar titulo del slide en el elemento para render_meta Word
        if (!is.null(title_slide) && is.null(el_plot$title_slide)) {
          el_plot$title_slide <- title_slide
        }
        .push_render_meta_for_element(el_plot, p)
      }

      # Resolver titulo del slide si no viene
      if (is.null(title_slide)) {
        title_slide <- el_plot$title_slide %||% {
          if (!is.null(el_plot$var)) .title_of_var(el_plot$var) else {
            v1 <- el_plot$vars %||% NULL
            first_ref <- if (!is.null(v1) && length(v1)) .extract_ref_values(v1)[1] else NULL
            if (!is.null(first_ref) && nzchar(first_ref)) .title_of_var(first_ref) else NULL
          }
        }
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(title_slide)) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        if (!is.null(subtitle_slide) && nzchar(trimws(as.character(subtitle_slide)[1]))) {
          doc <- .ph_with_slide_subtitle(doc, subtitle = subtitle_slide, title_spec = contract$slots$title)
        }

        plot_slot <- .plot_slot_for_rendered_plot(contract$slots$plot, p)

        # Grafico Y tabla en el mismo cajon: el aprobado pone el radar a la
        # izquierda y su tabla a la derecha, las dos como formas propias. Si el
        # graficador adjunto la geometria de su tabla, se emite aqui como tabla
        # nativa. Ver `reporte_plan_tabla_nativa.R`.
        geom_tab <- .tabla_nativa_geom(p, plot_slot$loc %||% contract$slots$plot$loc)

        # Y el grafico se aparta: sin esto los dos ocupan el mismo cajon y la
        # tabla se dibuja ENCIMA del canvas. El canvas ya no reserva hueco
        # —dejaba un cuadro vacio en medio—, asi que quien tiene que estrecharse
        # es su slot. Se recorta hasta donde empieza la tabla.
        plot_slot <- .plot_slot_recortado_por_tabla(plot_slot, geom_tab)
        doc <- .ph_with_strict(
          doc,
          .dml_o_tabla(p),
          plot_slot
        )
        if (!is.null(geom_tab)) {
          nativa_tab <- .tabla_nativa_de(p)
          doc <- officer::ph_with(
            doc,
            value = .tabla_nativa_flextable(
              nativa_tab$tabla,
              # El ancho real del cajon: sin el, la tabla reparte por contenido
              # y deja la caja a medias.
              utils::modifyList(nativa_tab$estilo, list(ancho_in = geom_tab$width)),
              font_family_default = presets$base$args$font_family_ppt %||%
                presets$base$args$font_family %||% "Arial"
            ),
            location = officer::ph_location(
              left = geom_tab$left, top = geom_tab$top,
              width = geom_tab$width, height = geom_tab$height
            )
          )
        }

        # BASE (manual o auto). Algunos perfiles institucionales integran la
        # base dentro del grafico y no deben materializar el marcador externo.
        base_txt <- if (suppress_base_placeholder) "" else slots$base %||% NULL

        if (!suppress_base_placeholder && is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el_plot,
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }

        if (!suppress_base_placeholder) {
          if (is.null(base_txt)) base_txt <- " "
          doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)
        }

        # RIGHT (usa footer o deja en blanco)
        right_obj <- if (suppress_footer_placeholder) NULL else slots$footer %||% NULL

        right_txt <- NULL
        if (inherits(right_obj, "ppt_element_text")) right_txt <- right_obj$text %||% NULL
        if (is.character(right_obj) && length(right_obj) == 1L) right_txt <- right_obj
        if (!suppress_footer_placeholder &&
            (is.null(right_txt) || !nzchar(trimws(as.character(right_txt)[1])))) {
          right_txt <- .ppt_note_from(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
        }

        if (!suppress_footer_placeholder) {
          if (is.null(right_txt) || !nzchar(trimws(right_txt))) right_txt <- " "
          doc <- .ph_with_strict(doc, right_txt, contract$slots$right)
        }
        doc <- .add_partner_footer_logo(doc)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "slide_1",
        element    = el_plot$.element_type %||% NA_character_,
        var        = .element_var_label(el_plot)
      )
      next
    }

    # ---- SLIDE_2 -------------------------------------------------------------
    if (identical(stype, "slide_2")) {

      contract <- PPT_CONTRACT$slide_2

      title_slide <- slide$title %||% NULL
      slots       <- slide$slots %||% list()

      el_left  <- slots$left  %||% NULL
      el_right <- slots$right %||% NULL

      if (!inherits(el_left, "ppt_element"))  el_left  <- .plan_elemento_degradado("En `p_slide_2_graficos()`, `izquierda` debe ser `ppt_element`.")
      if (!inherits(el_right, "ppt_element")) el_right <- .plan_elemento_degradado("En `p_slide_2_graficos()`, `derecha` debe ser `ppt_element`.")

      el_left  <- .element_adapt_to_plot_slot(el_left, contract$slots$left)
      el_right <- .element_adapt_to_plot_slot(el_right, contract$slots$right)
      el_left  <- .inject_var_titulo(el_left)
      el_right <- .inject_var_titulo(el_right)
      pL <- .render_element(el_left, ancho_slot = 6.1)
      pR <- .render_element(el_right, ancho_slot = 6.1)

      if (is.null(pL)) pL <- .plan_canvas_render_nulo("No se pudo renderizar left: ",  el_left$.element_type  %||% "<NA>")
      if (is.null(pR)) pR <- .plan_canvas_render_nulo("No se pudo renderizar right: ", el_right$.element_type %||% "<NA>")

      rendered[[length(rendered) + 1]] <- pL
      rendered[[length(rendered) + 1]] <- pR

      if (isTRUE(build_render_meta)) {
        # Inyectar titulo Word: preferir label de variable sobre titulo del slide
        .resolve_word_title <- function(el, fallback) {
          if (!is.null(el$title_slide)) return(el)
          if (!is.null(el$overrides$titulo)) return(el)
          var_lbl <- if (!is.null(el$var) && nzchar(trimws(el$var)))
            tryCatch(.title_of_var(el$var), error = function(e) NULL)
          else NULL
          el$title_slide <- var_lbl %||% fallback
          el
        }
        el_left  <- .resolve_word_title(el_left,  title_slide)
        el_right <- .resolve_word_title(el_right, title_slide)
        .push_render_meta_for_element(el_left,  pL)
        .push_render_meta_for_element(el_right, pR)
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(title_slide)) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        doc <- .ph_with_strict(doc, .dml_o_tabla(pL), contract$slots$left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pR), contract$slots$right)

        # BASE auto desde left si no se declara
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_de_elementos(
            els        = list(el_left, el_right),
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt)) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        rt_txt <- slots$right_text %||% NULL
        if (is.null(rt_txt) || !nzchar(trimws(as.character(rt_txt)[1]))) {
          rt_txt <- .ppt_note_from(
            pL,
            el_left$overrides$nota_pie %||%
              el_left$nota_pie %||%
              .ppt_note_from(pR, el_right$overrides$nota_pie %||% el_right$nota_pie %||% NULL)
          )
        }
        if (!is.null(rt_txt) && is.character(rt_txt) && length(rt_txt) == 1L) {
          doc <- .ph_with_strict(doc, rt_txt, contract$slots$right_text)
        } else {
          doc <- .ph_with_strict(doc, " ", contract$slots$right_text)
        }
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "slide_2",
        element    = paste0(
          el_left$.element_type  %||% "<NA>", " + ",
          el_right$.element_type %||% "<NA>"
        ),
        var = paste0(
          (.element_var_label(el_left) %||% "<sin vars>"),
          " | ",
          (.element_var_label(el_right) %||% "<sin vars>")
        )
      )
      next
    }

    # ---- SLIDE_1_NARRATIVO --------------------------------------------------
    if (identical(stype, "slide_1_narrativo")) {

      contract <- PPT_CONTRACT$slide_1_narrativo
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL
      el_plot     <- slots$plot %||% NULL

      if (!inherits(el_plot, "ppt_element")) {
        el_plot <- .plan_elemento_degradado("slide_1_narrativo: `plot` debe ser `ppt_element`.")
      }

      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      el_plot <- .element_adapt_to_plot_slot(el_plot, contract$slots$plot)
      p <- .render_element(el_plot, ancho_slot = 12.75)
      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        p <- .plan_canvas_render_nulo("slide_1_narrativo: no se pudo renderizar plot (", el_plot$.element_type %||% "<NA>", " | ", vv, ").")
      }
      rendered[[length(rendered) + 1]] <- p

      if (isTRUE(build_render_meta)) .push_render_meta_for_element(el_plot, p)

      if (is.null(title_slide)) {
        title_slide <- el_plot$title_slide %||% {
          if (!is.null(el_plot$var)) .title_of_var(el_plot$var) else {
            v1 <- el_plot$vars %||% NULL
            first_ref <- if (!is.null(v1) && length(v1)) .extract_ref_values(v1)[1] else NULL
            if (!is.null(first_ref) && nzchar(first_ref)) .title_of_var(first_ref) else NULL
          }
        }
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        # Combinar etiqueta + texto en un solo bloque
        # (el layout solo tiene 1 placeholder de texto real: body 2)
        tag_txt <- slots$tag %||% NULL
        tx      <- slots$text %||% NULL
        combined <- if (!is.null(tag_txt) && nzchar(trimws(as.character(tag_txt)[1]))) {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1])))
            paste0(as.character(tag_txt)[1], "\n", as.character(tx)[1])
          else as.character(tag_txt)[1]
        } else {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else NULL
        }
        if (!is.null(combined)) {
          doc <- .ph_with_strict(doc, combined, contract$slots$text)
        }

        plot_slot <- contract$slots$plot
        slide_meta <- slide$meta %||% list()
        if (is.list(slide_meta)) {
          plot_slot <- .plot_slot_expand_down_cm(
            plot_slot,
            extra_cm = slide_meta$plot_extra_height_cm %||% slide_meta$grafico_extra_height_cm %||% NULL,
            max_height_cm = slide_meta$plot_max_height_cm %||% slide_meta$grafico_max_height_cm %||% NULL
          )
        }

        doc <- .ph_with_strict(
          doc,
          .dml_o_tabla(p),
          plot_slot
        )

        suppress_base_placeholder <- isTRUE((slide$meta %||% list())$suppress_base_placeholder)
        if (suppress_base_placeholder) {
          doc <- .ph_with_strict(doc, " ", contract$slots$base)
        } else {
          base_txt <- slots$base %||% NULL
          if (is.null(base_txt)) {
            base_txt <- .base_auto_from_element(
              el          = el_plot,
              sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
              formato     = presets$base$args$formato %||% "Base: %s"
            )
          }
          if (!is.null(base_txt) && nzchar(trimws(as.character(base_txt)[1]))) {
            doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)
          }
        }

        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
        }
        if (!is.null(ft) && nzchar(trimws(as.character(ft)[1]))) {
          doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
        }
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "slide_1_narrativo",
        element    = el_plot$.element_type %||% NA_character_,
        var        = .element_var_label(el_plot)
      )
      next
    }

    # ---- SLIDE_2_NARRATIVO --------------------------------------------------
    if (identical(stype, "slide_2_narrativo")) {

      contract <- PPT_CONTRACT$slide_2_narrativo
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL
      el_left  <- slots$left  %||% NULL
      el_right <- slots$right %||% NULL

      if (!inherits(el_left, "ppt_element"))  el_left  <- .plan_elemento_degradado("slide_2_narrativo: `left` debe ser `ppt_element`.")
      if (!inherits(el_right, "ppt_element")) el_right <- .plan_elemento_degradado("slide_2_narrativo: `right` debe ser `ppt_element`.")

      el_left  <- .element_adapt_to_plot_slot(el_left, contract$slots$left)
      el_right <- .element_adapt_to_plot_slot(el_right, contract$slots$right)
      el_left  <- .inject_var_titulo(el_left)
      el_right <- .inject_var_titulo(el_right)
      pL <- .render_element(el_left, ancho_slot = 6.1)
      pR <- .render_element(el_right, ancho_slot = 6.1)

      if (is.null(pL)) pL <- .plan_canvas_render_nulo("slide_2_narrativo: no se pudo renderizar left.")
      if (is.null(pR)) pR <- .plan_canvas_render_nulo("slide_2_narrativo: no se pudo renderizar right.")

      rendered[[length(rendered) + 1]] <- pL
      rendered[[length(rendered) + 1]] <- pR

      if (isTRUE(build_render_meta)) {
        .resolve_word_title <- function(el, fallback) {
          if (!is.null(el$title_slide)) return(el)
          if (!is.null(el$overrides$titulo)) return(el)
          var_lbl <- if (!is.null(el$var) && nzchar(trimws(el$var)))
            tryCatch(.title_of_var(el$var), error = function(e) NULL)
          else NULL
          el$title_slide <- var_lbl %||% fallback
          el
        }
        el_left  <- .resolve_word_title(el_left,  title_slide)
        el_right <- .resolve_word_title(el_right, title_slide)
        .push_render_meta_for_element(el_left,  pL)
        .push_render_meta_for_element(el_right, pR)
      }

      if (is.null(title_slide)) {
        title_slide <- el_left$title_slide %||% {
          if (!is.null(el_left$var)) .title_of_var(el_left$var) else NULL
        }
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        # Combinar etiqueta + texto en un solo bloque (1 placeholder)
        tag_txt <- slots$tag %||% NULL
        tx      <- slots$text %||% NULL
        combined <- if (!is.null(tag_txt) && nzchar(trimws(as.character(tag_txt)[1]))) {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1])))
            paste0(as.character(tag_txt)[1], "\n", as.character(tx)[1])
          else as.character(tag_txt)[1]
        } else {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else " "
        }
        doc <- .ph_with_strict(doc, combined, contract$slots$text)

        doc <- .ph_with_strict(doc, .dml_o_tabla(pL), contract$slots$left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pR), contract$slots$right)

        suppress_base_placeholder <- isTRUE((slide$meta %||% list())$suppress_base_placeholder)
        base_txt <- if (suppress_base_placeholder) " " else slots$base %||% NULL
        if (!suppress_base_placeholder && is.null(base_txt)) {
          base_txt <- .base_auto_de_elementos(
            els        = list(el_left, el_right),
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(
            pL,
            el_left$overrides$nota_pie %||%
              el_left$nota_pie %||%
              .ppt_note_from(pR, el_right$overrides$nota_pie %||% el_right$nota_pie %||% NULL)
          )
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "slide_2_narrativo",
        element    = paste0(
          el_left$.element_type  %||% "<NA>", " + ",
          el_right$.element_type %||% "<NA>"
        ),
        var = paste0(
          (.element_var_label(el_left) %||% "<sin vars>"),
          " | ",
          (.element_var_label(el_right) %||% "<sin vars>")
        )
      )
      next
    }

    # ---- 4_PANELES ----------------------------------------------------------
    if (identical(stype, "paneles_4")) {

      contract <- PPT_CONTRACT$paneles_4
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      el_ul <- slots$up_left      %||% NULL
      el_ur <- slots$up_right     %||% NULL
      el_bl <- slots$bottom_left  %||% NULL
      el_br <- slots$bottom_right %||% NULL

      if (!inherits(el_ul, "ppt_element")) el_ul <- .plan_elemento_degradado("paneles_4: `up_left` debe ser `ppt_element`.")
      if (!inherits(el_ur, "ppt_element")) el_ur <- .plan_elemento_degradado("paneles_4: `up_right` debe ser `ppt_element`.")
      if (!inherits(el_bl, "ppt_element")) el_bl <- .plan_elemento_degradado("paneles_4: `bottom_left` debe ser `ppt_element`.")
      if (!inherits(el_br, "ppt_element")) el_br <- .plan_elemento_degradado("paneles_4: `bottom_right` debe ser `ppt_element`.")

      el_ul <- .inject_var_titulo(el_ul)
      el_ur <- .inject_var_titulo(el_ur)
      el_bl <- .inject_var_titulo(el_bl)
      el_br <- .inject_var_titulo(el_br)
      # Sin `alto_slot`: el cajon de ESTE layout no esta medido. El 2.565 que
      # sale en `poblacion_4` es de aquella plantilla, no de esta.
      pUL <- .render_element(.inject_title_override(el_ul), ancho_slot = 6.1)
      pUR <- .render_element(.inject_title_override(el_ur), ancho_slot = 6.1)
      pBL <- .render_element(.inject_title_override(el_bl), ancho_slot = 6.1)
      pBR <- .render_element(.inject_title_override(el_br), ancho_slot = 6.1)

      if (is.null(pUL)) pUL <- .plan_canvas_render_nulo("paneles_4: no se pudo renderizar up_left.")
      if (is.null(pUR)) pUR <- .plan_canvas_render_nulo("paneles_4: no se pudo renderizar up_right.")
      if (is.null(pBL)) pBL <- .plan_canvas_render_nulo("paneles_4: no se pudo renderizar bottom_left.")
      if (is.null(pBR)) pBR <- .plan_canvas_render_nulo("paneles_4: no se pudo renderizar bottom_right.")

      rendered[[length(rendered) + 1]] <- pUL
      rendered[[length(rendered) + 1]] <- pUR
      rendered[[length(rendered) + 1]] <- pBL
      rendered[[length(rendered) + 1]] <- pBR

      if (isTRUE(build_render_meta)) {
        .resolve_word_title_el <- function(el, fallback) {
          if (!is.null(el$title_slide)) return(el)
          if (!is.null(el$overrides$titulo)) return(el)
          var_lbl <- if (!is.null(el$var) && nzchar(trimws(el$var)))
            tryCatch(.title_of_var(el$var), error = function(e) NULL)
          else NULL
          el$title_slide <- var_lbl %||% fallback
          el
        }
        el_ul <- .resolve_word_title_el(el_ul, title_slide)
        el_ur <- .resolve_word_title_el(el_ur, title_slide)
        el_bl <- .resolve_word_title_el(el_bl, title_slide)
        el_br <- .resolve_word_title_el(el_br, title_slide)
        .push_render_meta_for_element(el_ul, pUL)
        .push_render_meta_for_element(el_ur, pUR)
        .push_render_meta_for_element(el_bl, pBL)
        .push_render_meta_for_element(el_br, pBR)
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        # tag/etiqueta no tiene placeholder en 4_paneles (body 1 es logo) — se ignora

        doc <- .ph_with_strict(doc, .dml_o_tabla(pUL), contract$slots$up_left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pUR), contract$slots$up_right)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pBL), contract$slots$bottom_left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pBR), contract$slots$bottom_right)

        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_de_elementos(
            els        = list(el_ul, el_ur, el_bl, el_br),
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(
            pUL,
            el_ul$overrides$nota_pie %||%
              el_ul$nota_pie %||%
              .ppt_note_from(pUR, el_ur$overrides$nota_pie %||% el_ur$nota_pie %||%
                               .ppt_note_from(pBL, el_bl$overrides$nota_pie %||% el_bl$nota_pie %||%
                                                .ppt_note_from(pBR, el_br$overrides$nota_pie %||% el_br$nota_pie %||% NULL)))
          )
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "paneles_4",
        element    = paste(
          el_ul$.element_type %||% "<NA>",
          el_ur$.element_type %||% "<NA>",
          el_bl$.element_type %||% "<NA>",
          el_br$.element_type %||% "<NA>",
          sep = " | "
        ),
        var = paste(
          .element_var_label(el_ul) %||% "<sin vars>",
          .element_var_label(el_ur) %||% "<sin vars>",
          .element_var_label(el_bl) %||% "<sin vars>",
          .element_var_label(el_br) %||% "<sin vars>",
          sep = " || "
        )
      )
      next
    }

    # ---- POBLACION_4 (4 graficos 2x2) ----------------------------------------
    # Las closures del motor que necesitan los renderers que viven fuera de este
    # archivo. Se arma una vez y se pasa entera: enumerarlas en cada llamada era
    # trece líneas por disposición.
    .plan_ppt_helpers_slide <- function() {
      list(
        add_slide_strict = .add_slide_strict, ph_with_strict = .ph_with_strict,
        render_element = .render_element, dml_o_tabla = .dml_o_tabla,
        elemento_degradado = .plan_elemento_degradado,
        canvas_render_nulo = .plan_canvas_render_nulo,
        inject_var_titulo = .inject_var_titulo,
        inject_title_override = .inject_title_override,
        base_por_grafico = .base_por_grafico,
        base_auto_from_element = .base_auto_from_element
      )
    }

    # Las disposiciones de composición comparten renderer: lo que las distingue
    # está en la plantilla. Una rama para las seis, no seis ramas.
    if (stype %in% names(.SLIDES_COMPOSICION)) {
      res <- .composicion_render(
        doc = doc, slide = slide, contract = PPT_CONTRACT[[stype]],
        helpers = .plan_ppt_helpers_slide(), presets = presets,
        solo_lista = isTRUE(solo_lista)
      )
      doc <- res$doc
      for (p in res$rendered) rendered[[length(rendered) + 1]] <- p
      next
    }

    # `poblacion_3` vive entero en `reporte_slide_poblacion_3.R`: aquí queda solo
    # el despacho y el paso de las closures del motor, que son las que saben
    # resolver un placeholder contra el layout real.
    if (identical(stype, "poblacion_3")) {
      res <- .poblacion_3_render(
        doc = doc, slide = slide, contract = PPT_CONTRACT$poblacion_3,
        helpers = .plan_ppt_helpers_slide(),
        presets = presets, solo_lista = isTRUE(solo_lista)
      )
      doc <- res$doc
      for (p in res$rendered) rendered[[length(rendered) + 1]] <- p
      next
    }

    if (identical(stype, "poblacion_4")) {

      contract <- PPT_CONTRACT$poblacion_4
      slots    <- slide$slots %||% list()

      # titulo (opcional)
      title_slide <- slots$title %||% slide$title %||% NULL

      # elementos requeridos (4)
      el_ul <- slots$up_left      %||% NULL
      el_ur <- slots$up_right     %||% NULL
      el_bl <- slots$bottom_left  %||% NULL
      el_br <- slots$bottom_right %||% NULL

      if (!inherits(el_ul, "ppt_element")) el_ul <- .plan_elemento_degradado("poblacion_4: `up_left` debe ser `ppt_element`.")
      if (!inherits(el_ur, "ppt_element")) el_ur <- .plan_elemento_degradado("poblacion_4: `up_right` debe ser `ppt_element`.")
      if (!inherits(el_bl, "ppt_element")) el_bl <- .plan_elemento_degradado("poblacion_4: `bottom_left` debe ser `ppt_element`.")
      if (!inherits(el_br, "ppt_element")) el_br <- .plan_elemento_degradado("poblacion_4: `bottom_right` debe ser `ppt_element`.")

      el_ul <- .inject_var_titulo(el_ul)
      el_ur <- .inject_var_titulo(el_ur)
      el_bl <- .inject_var_titulo(el_bl)
      el_br <- .inject_var_titulo(el_br)
      # La base es del gráfico, no de la lámina: `reporte_plan_base_por_grafico.R`.
      el_ul <- .base_por_grafico(el_ul, presets, .base_auto_from_element)
      el_ur <- .base_por_grafico(el_ur, presets, .base_auto_from_element)
      el_bl <- .base_por_grafico(el_bl, presets, .base_auto_from_element)
      el_br <- .base_por_grafico(el_br, presets, .base_auto_from_element)
      # 5.2 de ancho y 2.565 de alto: los dos medidos en el XML de la lamina 13.
      pUL <- .render_element(.inject_title_override(el_ul), ancho_slot = 5.2,
                              alto_slot = .POBLACION_4_ALTO_SLOT_IN)
      pUR <- .render_element(.inject_title_override(el_ur), ancho_slot = 5.2,
                              alto_slot = .POBLACION_4_ALTO_SLOT_IN)
      pBL <- .render_element(.inject_title_override(el_bl), ancho_slot = 5.2,
                              alto_slot = .POBLACION_4_ALTO_SLOT_IN)
      pBR <- .render_element(.inject_title_override(el_br), ancho_slot = 5.2,
                              alto_slot = .POBLACION_4_ALTO_SLOT_IN)

      if (is.null(pUL)) pUL <- .plan_canvas_render_nulo("poblacion_4: no se pudo renderizar up_left (",      el_ul$.element_type %||% "<NA>", ").")
      if (is.null(pUR)) pUR <- .plan_canvas_render_nulo("poblacion_4: no se pudo renderizar up_right (",     el_ur$.element_type %||% "<NA>", ").")
      if (is.null(pBL)) pBL <- .plan_canvas_render_nulo("poblacion_4: no se pudo renderizar bottom_left (",  el_bl$.element_type %||% "<NA>", ").")
      if (is.null(pBR)) pBR <- .plan_canvas_render_nulo("poblacion_4: no se pudo renderizar bottom_right (", el_br$.element_type %||% "<NA>", ").")

      rendered[[length(rendered) + 1]] <- pUL
      rendered[[length(rendered) + 1]] <- pUR
      rendered[[length(rendered) + 1]] <- pBL
      rendered[[length(rendered) + 1]] <- pBR

      if (isTRUE(build_render_meta)) {
        .resolve_word_title_el <- function(el, fallback) {
          if (!is.null(el$title_slide)) return(el)
          if (!is.null(el$overrides$titulo)) return(el)
          var_lbl <- if (!is.null(el$var) && nzchar(trimws(el$var)))
            tryCatch(.title_of_var(el$var), error = function(e) NULL)
          else NULL
          el$title_slide <- var_lbl %||% fallback
          el
        }
        el_ul <- .resolve_word_title_el(el_ul, title_slide)
        el_ur <- .resolve_word_title_el(el_ur, title_slide)
        el_bl <- .resolve_word_title_el(el_bl, title_slide)
        el_br <- .resolve_word_title_el(el_br, title_slide)
        .push_render_meta_for_element(el_ul, pUL)
        .push_render_meta_for_element(el_ur, pUR)
        .push_render_meta_for_element(el_bl, pBL)
        .push_render_meta_for_element(el_br, pBR)
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        doc <- .ph_with_strict(doc, .dml_o_tabla(pUL), contract$slots$up_left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pUR), contract$slots$up_right)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pBL), contract$slots$bottom_left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pBR), contract$slots$bottom_right)

        # icono central (body 2 = circulo central 1.9x1.9) — opcional
        el_icon <- slots$icon %||% NULL
        if (!is.null(el_icon)) {
          if (!inherits(el_icon, "ppt_element")) {
            el_icon <- .plan_elemento_degradado("En `p_slide_4_graficos_poblacion()`, `icono` debe ser `ppt_element`.")
          }
          p_icon <- .render_element(el_icon)
          if (is.null(p_icon)) {
            p_icon <- .plan_canvas_render_nulo("No se pudo renderizar `icono` en `p_slide_4_graficos_poblacion()`.")
          }
          doc <- .ph_with_strict(
            doc,
            .dml_o_tabla(p_icon),
            contract$slots$icon
          )
        }

        # base (body 3 = pie de lamina)  -  opcional/auto
        # Sólo si el analista la declaró: cada panel ya lleva la suya dentro, y
        # repetirla abajo dice dos veces lo mismo cuando coinciden y se
        # contradice cuando no.
        doc <- .ph_with_strict(doc, .base_de_lamina_texto(slots$base), contract$slots$base)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "poblacion_4",
        element    = paste(
          el_ul$.element_type %||% "<NA>",
          el_ur$.element_type %||% "<NA>",
          el_bl$.element_type %||% "<NA>",
          el_br$.element_type %||% "<NA>",
          sep = " | "
        ),
        var = paste(
          .element_var_label(el_ul) %||% "<sin vars>",
          .element_var_label(el_ur) %||% "<sin vars>",
          .element_var_label(el_bl) %||% "<sin vars>",
          .element_var_label(el_br) %||% "<sin vars>",
          sep = " || "
        )
      )
      next
    }

    # ---- TEXT_R (grafico izquierda, texto derecha) ------------------------------
    if (identical(stype, "text_r")) {

      contract <- PPT_CONTRACT$text_r
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      el_plot <- slots$plot %||% NULL
      if (!inherits(el_plot, "ppt_element")) {
        el_plot <- .plan_elemento_degradado("text_r: `plot` debe ser `ppt_element`.")
      }

      # render plot
      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      p <- .render_element(el_plot, ancho_slot = 6.1)
      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        p <- .plan_canvas_render_nulo("text_r: no se pudo renderizar plot (", el_plot$.element_type %||% "<NA>", " | ", vv, ").")
      }
      rendered[[length(rendered) + 1]] <- p

      if (isTRUE(build_render_meta)) .push_render_meta_for_element(el_plot, p)

      # inferir titulo si no viene
      if (is.null(title_slide)) {
        title_slide <- el_plot$title_slide %||% {
          if (!is.null(el_plot$var)) .title_of_var(el_plot$var) else {
            v1 <- el_plot$vars %||% NULL
            first_ref <- if (!is.null(v1) && length(v1)) .extract_ref_values(v1)[1] else NULL
            if (!is.null(first_ref) && nzchar(first_ref)) .title_of_var(first_ref) else NULL
          }
        }
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        # plot
        doc <- .ph_with_strict(
          doc,
          .dml_o_tabla(p),
          contract$slots$plot
        )

        # texto derecha — combina etiqueta + texto en el unico placeholder
        tag_txt <- slots$tag %||% NULL
        tx <- slots$text %||% NULL
        combined_tx <- if (!is.null(tag_txt) && nzchar(trimws(as.character(tag_txt)[1]))) {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1])))
            paste0(as.character(tag_txt)[1], "\n", as.character(tx)[1])
          else as.character(tag_txt)[1]
        } else {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else " "
        }
        doc <- .ph_with_strict(doc, combined_tx, contract$slots$text)

        # base (manual o auto)
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el_plot,
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        # footer opcional
        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "text_r",
        element    = el_plot$.element_type %||% NA_character_,
        var        = .element_var_label(el_plot)
      )
      next
    }

    # ---- TEXT_L (texto izquierda, grafico derecha) ------------------------------
    if (identical(stype, "text_l")) {

      contract <- PPT_CONTRACT$text_l
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      el_plot <- slots$plot %||% NULL
      if (!inherits(el_plot, "ppt_element")) {
        el_plot <- .plan_elemento_degradado("text_l: `plot` debe ser `ppt_element`.")
      }

      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      p <- .render_element(el_plot, ancho_slot = 6.1)
      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        p <- .plan_canvas_render_nulo("text_l: no se pudo renderizar plot (", el_plot$.element_type %||% "<NA>", " | ", vv, ").")
      }
      rendered[[length(rendered) + 1]] <- p

      if (isTRUE(build_render_meta)) .push_render_meta_for_element(el_plot, p)

      if (is.null(title_slide)) {
        title_slide <- el_plot$title_slide %||% {
          if (!is.null(el_plot$var)) .title_of_var(el_plot$var) else {
            v1 <- el_plot$vars %||% NULL
            first_ref <- if (!is.null(v1) && length(v1)) .extract_ref_values(v1)[1] else NULL
            if (!is.null(first_ref) && nzchar(first_ref)) .title_of_var(first_ref) else NULL
          }
        }
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        # texto izquierda — combina etiqueta + texto en el unico placeholder
        tag_txt <- slots$tag %||% NULL
        tx <- slots$text %||% NULL
        combined_tx <- if (!is.null(tag_txt) && nzchar(trimws(as.character(tag_txt)[1]))) {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1])))
            paste0(as.character(tag_txt)[1], "\n", as.character(tx)[1])
          else as.character(tag_txt)[1]
        } else {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else " "
        }
        doc <- .ph_with_strict(doc, combined_tx, contract$slots$text)

        # plot derecha
        doc <- .ph_with_strict(
          doc,
          .dml_o_tabla(p),
          contract$slots$plot
        )

        # base (manual o auto)
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el_plot,
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        # footer opcional
        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "text_l",
        element    = el_plot$.element_type %||% NA_character_,
        var        = .element_var_label(el_plot)
      )
      next
    }

    if (identical(stype, "text_r2")) {

      contract <- PPT_CONTRACT$text_r2
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      el1 <- slots$plot1 %||% NULL
      el2 <- slots$plot2 %||% NULL

      if (!inherits(el1, "ppt_element")) el1 <- .plan_elemento_degradado("text_r2: `plot1` debe ser `ppt_element`.")
      if (!inherits(el2, "ppt_element")) el2 <- .plan_elemento_degradado("text_r2: `plot2` debe ser `ppt_element`.")

      p1 <- .render_element(el1, ancho_slot = 6.1)
      p2 <- .render_element(el2, ancho_slot = 6.1)

      if (is.null(p1)) p1 <- .plan_canvas_render_nulo("text_r2: no se pudo renderizar plot1.")
      if (is.null(p2)) p2 <- .plan_canvas_render_nulo("text_r2: no se pudo renderizar plot2.")

      rendered[[length(rendered) + 1]] <- p1
      rendered[[length(rendered) + 1]] <- p2

      if (isTRUE(build_render_meta)) {
        .push_render_meta_for_element(el1, p1)
        .push_render_meta_for_element(el2, p2)
      }

      # inferir titulo si no viene
      if (is.null(title_slide)) {
        title_slide <- el1$title_slide %||% if (!is.null(el1$var)) .title_of_var(el1$var) else NULL
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        # 2 plots
        doc <- .ph_with_strict(doc, .dml_o_tabla(p1), contract$slots$plot1)
        doc <- .ph_with_strict(doc, .dml_o_tabla(p2), contract$slots$plot2)

        # texto derecha — combina etiqueta + texto en el unico placeholder
        tag_txt <- slots$tag %||% NULL
        tx <- slots$text %||% NULL
        combined_tx <- if (!is.null(tag_txt) && nzchar(trimws(as.character(tag_txt)[1]))) {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1])))
            paste0(as.character(tag_txt)[1], "\n", as.character(tx)[1])
          else as.character(tag_txt)[1]
        } else {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else " "
        }
        doc <- .ph_with_strict(doc, combined_tx, contract$slots$text)

        # base auto (por defecto desde plot1)
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_de_elementos(
            els        = list(el1, el2),
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        # footer opcional
        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(
            p1,
            el1$overrides$nota_pie %||%
              el1$nota_pie %||%
              .ppt_note_from(p2, el2$overrides$nota_pie %||% el2$nota_pie %||% NULL)
          )
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
      }

      next
    }

    if (identical(stype, "text_l2")) {

      contract <- PPT_CONTRACT$text_l2
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      el1 <- slots$plot1 %||% NULL
      el2 <- slots$plot2 %||% NULL

      if (!inherits(el1, "ppt_element")) el1 <- .plan_elemento_degradado("text_l2: `plot1` debe ser `ppt_element`.")
      if (!inherits(el2, "ppt_element")) el2 <- .plan_elemento_degradado("text_l2: `plot2` debe ser `ppt_element`.")

      p1 <- .render_element(el1, ancho_slot = 6.1)
      p2 <- .render_element(el2, ancho_slot = 6.1)

      if (is.null(p1)) p1 <- .plan_canvas_render_nulo("text_l2: no se pudo renderizar plot1.")
      if (is.null(p2)) p2 <- .plan_canvas_render_nulo("text_l2: no se pudo renderizar plot2.")

      rendered[[length(rendered) + 1]] <- p1
      rendered[[length(rendered) + 1]] <- p2

      if (isTRUE(build_render_meta)) {
        .push_render_meta_for_element(el1, p1)
        .push_render_meta_for_element(el2, p2)
      }

      if (is.null(title_slide)) {
        title_slide <- el1$title_slide %||% if (!is.null(el1$var)) .title_of_var(el1$var) else NULL
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(title_slide))) {
          doc <- .ph_with_strict(doc, title_slide, contract$slots$title)
        }

        # texto izquierda — combina etiqueta + texto en el unico placeholder
        tag_txt <- slots$tag %||% NULL
        tx <- slots$text %||% NULL
        combined_tx <- if (!is.null(tag_txt) && nzchar(trimws(as.character(tag_txt)[1]))) {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1])))
            paste0(as.character(tag_txt)[1], "\n", as.character(tx)[1])
          else as.character(tag_txt)[1]
        } else {
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else " "
        }
        doc <- .ph_with_strict(doc, combined_tx, contract$slots$text)

        # 2 plots
        doc <- .ph_with_strict(doc, .dml_o_tabla(p1), contract$slots$plot1)
        doc <- .ph_with_strict(doc, .dml_o_tabla(p2), contract$slots$plot2)

        # base auto desde plot1
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_de_elementos(
            els        = list(el1, el2),
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        # footer opcional
        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(
            p1,
            el1$overrides$nota_pie %||%
              el1$nota_pie %||%
              .ppt_note_from(p2, el2$overrides$nota_pie %||% el2$nota_pie %||% NULL)
          )
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
      }

      next
    }

    # ---- POBLACION_2 ------------------------------------------------------------
    if (identical(stype, "poblacion_2")) {

      contract <- PPT_CONTRACT$poblacion_2
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      el_left  <- slots$left  %||% NULL
      el_right <- slots$right %||% NULL

      if (!inherits(el_left, "ppt_element"))  el_left <- .plan_elemento_degradado("poblacion_2: `left` debe ser `ppt_element`.")
      if (!inherits(el_right, "ppt_element")) el_right <- .plan_elemento_degradado("poblacion_2: `right` debe ser `ppt_element`.")

      # La base es del gráfico, no de la lámina: `reporte_plan_base_por_grafico.R`.
      el_left  <- .base_por_grafico(el_left,  presets, .base_auto_from_element)
      el_right <- .base_por_grafico(el_right, presets, .base_auto_from_element)
      pL <- .render_element(.inject_title_override(el_left), ancho_slot = 5.1)
      pR <- .render_element(.inject_title_override(el_right), ancho_slot = 5.1)

      if (is.null(pL)) pL <- .plan_canvas_render_nulo("poblacion_2: no se pudo renderizar left.")
      if (is.null(pR)) pR <- .plan_canvas_render_nulo("poblacion_2: no se pudo renderizar right.")

      rendered[[length(rendered) + 1]] <- pL
      rendered[[length(rendered) + 1]] <- pR

      if (isTRUE(build_render_meta)) {
        .push_render_meta_for_element(el_left,  pL)
        .push_render_meta_for_element(el_right, pR)
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        tx <- slots$text %||% NULL
        if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) {
          doc <- .ph_with_strict(doc, as.character(tx)[1], contract$slots$text)
        } else if (!is.null(contract$slots$text)) {
          doc <- .ph_with_strict(doc, " ", contract$slots$text)
        }

        # left y right: body 2 (izquierda) y body 3 (derecha)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pL), contract$slots$left)
        doc <- .ph_with_strict(doc, .dml_o_tabla(pR), contract$slots$right)

        # icono central (body 4 = circulo central 1.9x1.9) — opcional
        icon_val <- slots$icon %||% NULL
        if (!is.null(icon_val)) {
          if (!inherits(icon_val, "ppt_element")) {
            icon_val <- .plan_elemento_degradado("En `p_slide_2_graficos_poblacion()`, `icono` debe ser `ppt_element`.")
          }
          p_icon <- .render_element(icon_val)
          if (is.null(p_icon)) {
            p_icon <- .plan_canvas_render_nulo("No se pudo renderizar `icono` en `p_slide_2_graficos_poblacion()`.")
          }
          doc <- .ph_with_strict(
            doc,
            .dml_o_tabla(p_icon),
            contract$slots$icon
          )
        }

        base_txt <- slots$base %||% NULL
        if (!is.null(base_txt) && nzchar(trimws(as.character(base_txt)[1]))) {
          doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)
        }
      }

      next
    }

    # ---- POBLACION_5 ------------------------------------------------------------
    if (identical(stype, "poblacion_5")) {

      contract <- PPT_CONTRACT$poblacion_5
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      pics <- lapply(1:5, function(i) slots[[paste0("pic", i)]] %||% NULL)
      for (i in 1:5) if (!inherits(pics[[i]], "ppt_element")) pics[[i]] <- .plan_elemento_degradado("poblacion_5: `pic", i, "` debe ser `ppt_element`.")

      pics <- lapply(pics, .base_por_grafico, presets, .base_auto_from_element)
      plots <- lapply(pics, function(pic) .render_element(.inject_title_override(pic), ancho_slot = 3.95))
      for (i in 1:5) if (is.null(plots[[i]])) plots[[i]] <- .plan_canvas_render_nulo("poblacion_5: no se pudo renderizar pic", i, ".")

      rendered <- c(rendered, plots)

      if (isTRUE(build_render_meta)) {
        for (j in seq_along(pics)) .push_render_meta_for_element(pics[[j]], plots[[j]])
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        el_icon <- slots$icon %||% NULL
        if (!is.null(el_icon)) {
          if (!inherits(el_icon, "ppt_element")) {
            el_icon <- .plan_elemento_degradado("En `p_slide_5_graficos_poblacion()`, `icono` debe ser `ppt_element`.")
          }
          p_icon <- .render_element(el_icon)
          if (is.null(p_icon)) {
            p_icon <- .plan_canvas_render_nulo("No se pudo renderizar `icono` en `p_slide_5_graficos_poblacion()`.")
          }
          doc <- .ph_with_strict(
            doc,
            .dml_o_tabla(p_icon),
            contract$slots$icon
          )
        }

        ft <- slots$footer %||% NULL
        if (!is.null(ft) && nzchar(trimws(as.character(ft)[1]))) {
          doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
        }

        # 5 pics
        for (i in 1:5) {
          doc <- .ph_with_strict(
            doc,
            .dml_o_tabla(plots[[i]]),
            contract$slots[[paste0("pic", i)]]
          )
        }
      }

      next
    }

    # ---- POBLACION_6 ------------------------------------------------------------
    if (identical(stype, "poblacion_6")) {

      contract <- PPT_CONTRACT$poblacion_6
      slots    <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL

      pics <- lapply(1:6, function(i) slots[[paste0("pic", i)]] %||% NULL)
      for (i in 1:6) if (!inherits(pics[[i]], "ppt_element")) pics[[i]] <- .plan_elemento_degradado("poblacion_6: `pic", i, "` debe ser `ppt_element`.")

      pics <- lapply(pics, .base_por_grafico, presets, .base_auto_from_element)
      plots <- lapply(pics, function(pic) .render_element(.inject_title_override(pic), ancho_slot = 3.95))
      for (i in 1:6) if (is.null(plots[[i]])) plots[[i]] <- .plan_canvas_render_nulo("poblacion_6: no se pudo renderizar pic", i, ".")

      rendered <- c(rendered, plots)

      if (isTRUE(build_render_meta)) {
        for (j in seq_along(pics)) .push_render_meta_for_element(pics[[j]], plots[[j]])
      }

      if (!isTRUE(solo_lista)) {

        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        }

        el_icon <- slots$icon %||% NULL
        if (!is.null(el_icon)) {
          if (!inherits(el_icon, "ppt_element")) {
            el_icon <- .plan_elemento_degradado("En `p_slide_6_graficos_poblacion()`, `icono` debe ser `ppt_element`.")
          }
          p_icon <- .render_element(el_icon)
          if (is.null(p_icon)) {
            p_icon <- .plan_canvas_render_nulo("No se pudo renderizar `icono` en `p_slide_6_graficos_poblacion()`.")
          }
          doc <- .ph_with_strict(
            doc,
            .dml_o_tabla(p_icon),
            contract$slots$icon
          )
        }

        ft <- slots$footer %||% NULL
        if (!is.null(ft) && nzchar(trimws(as.character(ft)[1]))) {
          doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
        }

        for (i in 1:6) {
          doc <- .ph_with_strict(
            doc,
            .dml_o_tabla(plots[[i]]),
            contract$slots[[paste0("pic", i)]]
          )
        }
      }

      next
    }

    .plan_input_abort("Tipo de slide no implementado: ", stype)
  }

  log <- dplyr::bind_rows(log_rows)

  if (!isTRUE(solo_lista)) {
    print(doc, target = path_ppt)
    # officer escribe las fuentes del `rPr` en un orden que el esquema no
    # admite, y PowerPoint abre el archivo con «found a problem» y lo repara
    # QUITANDO contenido. LibreOffice no se queja, asi que sin este paso el
    # mazo se validaba sano y el cliente lo abria roto. Ver
    # `reporte_ppt_saneo_ooxml.R`.
    ppt_sanear_ooxml(path_ppt)
    if (isTRUE(mensajes_progreso)) {
      message("PPT generado en: ", normalizePath(path_ppt, winslash = "/"))
    }
  }

  # ---------------------------------------------------------------------------
  # Limpiar plan acumulado (si se uso diapo())
  # ---------------------------------------------------------------------------
  if (exists(".ppt_plan_clear", mode = "function", inherits = TRUE)) {
    try(.ppt_plan_clear(env_diapos), silent = TRUE)
  }

  invisible(list(
    doc             = if (isTRUE(solo_lista)) NULL else doc,
    plan            = plan,
    rendered        = rendered,
    render_meta     = render_meta,
    slide_layout_contract = PPT_RESOLVED_CONTRACT,
    .render_element = .render_element,
    log             = log
  ))
}

# =============================================================================
# PRESETS
# =============================================================================

#' @title Definir presets por tipo de elemento
#'
#' @description
#' Construye un objeto de presets que centraliza configuraciones por tipo:
#' `base`, `barras_apiladas`, `multi_apiladas`, `barras_agrupadas`,
#' `barras_categoricas`, `barras_numericas`, `boxplot`, `pie`, `donut`, `radar_tabla`, `dim_heatmap`,
#' `dim_radar` y `dim_foda`.
#'
#' Este helper refleja el contrato real que consume `reporte_ppt_plan()`, equivalente
#' a pasar manualmente una lista con sublistas `args`.
#'
#' @param base Lista de parametros por defecto para texto de base automatico.
#' @param barras_apiladas Lista de parametros por defecto para `graficar_barras_apiladas()`.
#' @param multi_apiladas Lista de parametros por defecto para `graficar_barras_apiladas()` en modo bloque.
#' @param barras_agrupadas Lista de parametros por defecto para `graficar_barras_agrupadas()`.
#' @param barras_categoricas Lista de parametros por defecto para `graficar_barras_categoricas()`.
#' @param barras_numericas Lista de parametros por defecto para `graficar_barras_numericas()`.
#' @param histograma Lista de parametros por defecto para `graficar_histograma()`.
#' @param boxplot Lista de parametros por defecto para `graficar_boxplot()`.
#' @param media_rango Lista de parametros por defecto para `graficar_media_rango()`.
#' @param pie Lista de parametros por defecto para `graficar_pie(tipo_pie="pie")`.
#' @param donut Lista de parametros por defecto para `graficar_pie(tipo_pie="donut")`.
#' @param radar_tabla Lista de parametros por defecto para `graficar_radar()`.
#' @param dim_heatmap Lista de parametros por defecto para `graficar_heatmap_dimensiones()`.
#' @param dim_heatmap_criterios Lista de parametros por defecto para `graficar_heatmap_criterios_dimensiones()`.
#' @param dim_radar Lista de parametros por defecto para `graficar_radar_dimensiones()`.
#' @param dim_foda Lista de parametros por defecto para `graficar_foda_dimensiones()`.
#' @param numerico Alias legado de `barras_numericas`. Se mantiene por compatibilidad.
#' @param debug Lista opcional de parametros de depuracion.
#' @param ... Argumentos extra heredados de versiones previas. Se ignoran.
#'
#' @return Objeto con clase `"ppt_presets"`.
#'
#' @family reporte
#' @export
p_presets <- function(
    base             = list(),
    barras_apiladas  = list(),
    multi_apiladas   = list(),
    multi_apiladas_multiactor = list(),
    barras_agrupadas = list(),
    barras_categoricas = list(),
    barras_numericas = list(),
    histograma       = list(),
    boxplot          = list(),
    media_rango      = list(),
    nube_palabras    = list(),
    pie              = list(),
    donut            = list(),
    radar_tabla      = list(),
    dim_heatmap      = list(),
    dim_heatmap_criterios = list(),
    dim_radar        = list(),
    dim_foda         = list(),
    numerico         = NULL,
    debug            = list(),
    ...
) {
  extras <- list(...)
  if (length(extras)) {
    warning(
      "Se ignoraron presets no soportados: ",
      paste(names(extras), collapse = ", "),
      call. = FALSE
    )
  }

  # Un bloque MIXTO —claves sueltas Y `args`— perdia las sueltas. Ver
  # `reporte_ppt_preset_bloque.R`.
  normalize_block <- .preset_bloque_normalizado

  if ((is.null(barras_numericas) || !length(barras_numericas)) && !is.null(numerico)) {
    barras_numericas <- numerico
  }

  out <- list(
    base             = normalize_block(base),
    barras_apiladas  = normalize_block(barras_apiladas),
    multi_apiladas   = normalize_block(multi_apiladas),
    multi_apiladas_multiactor = normalize_block(multi_apiladas_multiactor),
    barras_agrupadas = normalize_block(barras_agrupadas),
    barras_categoricas = normalize_block(barras_categoricas),
    barras_numericas = normalize_block(barras_numericas),
    histograma       = normalize_block(histograma),
    boxplot          = normalize_block(boxplot),
    media_rango      = normalize_block(media_rango),
    nube_palabras    = normalize_block(nube_palabras),
    pie              = normalize_block(pie),
    donut            = normalize_block(donut),
    radar_tabla      = normalize_block(radar_tabla),
    dim_heatmap      = normalize_block(dim_heatmap),
    dim_heatmap_criterios = normalize_block(dim_heatmap_criterios),
    dim_radar        = normalize_block(dim_radar),
    dim_foda         = normalize_block(dim_foda),
    debug            = normalize_block(debug)
  )

  class(out) <- c("ppt_presets", "list")
  out
}
