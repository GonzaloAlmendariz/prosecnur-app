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
    build_render_meta  = FALSE
) {

  `%||%` <- function(x, y) if (!is.null(x)) x else y

  # -----------------------
  # 0) Validaciones minimas
  # -----------------------
  if (!requireNamespace("officer", quietly = TRUE) ||
      !requireNamespace("rvg", quietly = TRUE)) {
    stop("Se requieren los paquetes 'officer' y 'rvg'.", call. = FALSE)
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
      stop("`", arg_name, "` debe ser una lista nombrada cuando contiene varias fuentes.", call. = FALSE)
    }
    names(x) <- trimws(nms)
    x
  }

  if (!is.data.frame(data) && !.is_data_sources(data)) {
    stop("`data` debe ser un data.frame/tibble o una lista nombrada de data.frames.", call. = FALSE)
  }

  data_sources <- if (is.data.frame(data)) {
    list(default = data)
  } else {
    .normalize_named_sources(data, "data")
  }

  if (is.null(instrumento)) {
    if (length(data_sources) != 1L) {
      stop("Cuando `data` contiene varias fuentes, `instrumento` debe proveerse explicitamente como lista nombrada.", call. = FALSE)
    }
    instrumento <- attr(data_sources[[1]], "instrumento_reporte", exact = TRUE)
    if (is.null(instrumento)) {
      stop("No se proporciono `instrumento` y `data` no tiene atributo `instrumento_reporte`.", call. = FALSE)
    }
  }

  instrument_sources <- if (.is_inst_sources(instrumento)) {
    .normalize_named_sources(instrumento, "instrumento")
  } else if (is.list(instrumento) && !is.null(instrumento$survey)) {
    stats::setNames(list(instrumento), names(data_sources)[1])
  } else {
    stop("`instrumento` debe ser un objeto con `$survey` o una lista nombrada de instrumentos.", call. = FALSE)
  }

  missing_inst <- setdiff(names(data_sources), names(instrument_sources))
  if (length(missing_inst)) {
    stop(
      "`instrumento` no contiene definicion para estas fuentes de `data`: ",
      paste(missing_inst, collapse = ", "),
      call. = FALSE
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

  presets$barras_numericas <- presets$barras_numericas %||% list(args = list())
  presets$barras_numericas$args <- presets$barras_numericas$args %||% list()

  presets$boxplot <- presets$boxplot %||% list(args = list())
  presets$boxplot$args <- presets$boxplot$args %||% list()
  presets$media_rango <- presets$media_rango %||% list(args = list())
  presets$media_rango$args <- presets$media_rango$args %||% list()

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
      "barras_numericas", "boxplot", "media_rango", "pie", "donut", "radar_tabla",
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
      stop("La plantilla NO tiene el layout requerido: '", layout_name, "'.", call. = FALSE)
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
    if (!nrow(props)) {
      stop(
        "No se encontro placeholder type='", spec$type,
        "' en layout='", layout_name %||% "<NA>",
        "', master='", master_name %||% "<NA>", "'.",
        call. = FALSE
      )
    }

    label <- spec$ph_label %||% NULL
    if (!is.null(label) && nzchar(label)) {
      props_label <- props[props$ph_label %in% label, , drop = FALSE]
      if (nrow(props_label)) {
        return(props_label[1, , drop = FALSE])
      }
    }

    type_idx <- spec$type_idx %||% NULL
    if (!is.null(type_idx)) {
      props_idx <- props[props$type_idx == type_idx, , drop = FALSE]
      if (nrow(props_idx)) {
        return(props_idx[1, , drop = FALSE])
      }
    }

    props[1, , drop = FALSE]
  }

  .ph_with_strict <- function(doc, value, spec) {
    if (is.null(spec) || is.null(spec$type)) {
      stop("Placeholder spec invalido (NULL o sin $type).", call. = FALSE)
    }
    type_idx <- spec$type_idx %||% NULL
    if (!is.null(type_idx)) {
      type_idx <- suppressWarnings(as.integer(type_idx))
      if (length(type_idx) != 1L || is.na(type_idx)) {
        stop("`type_idx` debe ser un entero escalar.", call. = FALSE)
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

    props <- props[props$type %in% spec$type, , drop = FALSE]
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
      stop(
        "No se pudo insertar en placeholder type='", spec$type,
        "' type_idx=", spec$type_idx %||% "NULL",
        ". Error: ", conditionMessage(out),
        call. = FALSE
      )
    }
    out
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

    weights <- pmax(
      1,
      nchar(tbl$criterio, type = "width") / 18,
      nchar(tbl$detalle, type = "width") / 92
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
    first_col_pct <- .style_num(style, "first_col_pct", 0.20, min = 0.14, max = 0.32)
    font_family <- as.character(.style_value(style, "font_family", font_family_default))[1]
    text_color <- as.character(.style_value(style, "text_color", "#0B1F4D"))[1]
    first_col_fill <- as.character(.style_value(style, "first_col_fill", "#D9D9D9"))[1]
    body_fill <- as.character(.style_value(style, "body_fill", "#F3F3F3"))[1]
    border_color <- as.character(.style_value(style, "border_color", "#7F7F7F"))[1]
    border_width <- .style_num(style, "border_width", 0.75, min = 0.1)
    first_col_size <- .style_num(style, "first_col_size", 16.5, min = 6)
    body_size <- .style_num(style, "body_size", 16.5, min = 6)
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
      ft <- flextable::line_spacing(ft, space = 1.05, part = "body")
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
        if (any(dif != 1L)) stop("strict_diapos=TRUE: los `diapo_###` no son consecutivos.", call. = FALSE)
      }
    }
    objs
  }

  # ---------------------------------------------------------------------------
  # 3) Helpers  -  Instrumento / tablas / titulos
  # ---------------------------------------------------------------------------
  .pct_enteros_100 <- function(n) {
    n <- as.numeric(n)
    n[is.na(n)] <- 0
    tot <- sum(n)
    if (!is.finite(tot) || tot <= 0) return(rep(0L, length(n)))
    raw <- n / tot * 100
    fl  <- floor(raw)
    resid <- as.integer(round(100 - sum(fl)))
    frac <- raw - fl
    if (resid > 0) {
      idx <- head(order(frac, decreasing = TRUE), resid)
      fl[idx] <- fl[idx] + 1L
    } else if (resid < 0) {
      idx <- head(order(frac, decreasing = FALSE), abs(resid))
      fl[idx] <- pmax(0L, fl[idx] - 1L)
    }
    fl
  }

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
      stop(
        "La referencia de `", arg_name, "` requiere prefijo `fuente$` porque `data` contiene varias fuentes.",
        call. = FALSE
      )
    }
    src <- trimws(src)

    if (!src %in% names(data_sources)) {
      stop("La fuente `", src, "` no existe en `data`.", call. = FALSE)
    }
    if (!src %in% names(instrument_sources)) {
      stop("La fuente `", src, "` no existe en `instrumento`.", call. = FALSE)
    }

    src
  }

  .source_ctx <- function(source) {
    src <- .resolve_source_name(source = source, ref = NULL, arg_name = "source")
    inst <- instrument_sources[[src]]
    surv <- inst$survey %||% NULL
    if (is.null(surv) || !"name" %in% names(surv)) {
      stop("`instrumento[['", src, "']]$survey` debe existir y contener al menos la columna `name`.", call. = FALSE)
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
      stop("`", arg_name, "` debe ser character(1) no vacio.", call. = FALSE)
    }
    ctx <- .source_ctx(.resolve_source_name(source = source, ref = ref, arg_name = arg_name))
    ctx$var <- ref_info$var
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
      stop("Las referencias de `", arg_name, "` deben pertenecer a una sola fuente en este grafico.", call. = FALSE)
    }
    srcs[1]
  }

  .element_source <- function(el, allow_multi = FALSE) {
    explicit_source <- as.character(el$source %||% NA_character_)[1]
    if (is.na(explicit_source) || !nzchar(trimws(explicit_source))) explicit_source <- NULL
    refs <- c(
      .extract_ref_values(el$var %||% NULL),
      .extract_ref_values(el$vars %||% NULL),
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
      stop("El elemento usa variables de varias fuentes; este renderer requiere una sola.", call. = FALSE)
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

  .list_name_of_var <- function(var, source = NULL) {
    .list_name_from_ctx(.resolve_ref(var, source = source, arg_name = "var"))
  }

  .choices_label_col <- function(choices_tbl) {
    if (is.null(choices_tbl) || !is.data.frame(choices_tbl)) return(NA_character_)
    candidates <- c("label", "label::es")
    hit <- candidates[candidates %in% names(choices_tbl)][1]
    if (!length(hit) || is.na(hit)) {
      extras <- setdiff(names(choices_tbl), c("list_name", "name", "value"))
      hit <- extras[1]
    }
    if (!length(hit) || is.na(hit)) NA_character_ else hit
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

    stop(
      "multiapiladas (modo='", arg_name, "'): las referencias no comparten una escala compatible. ",
      "Listas encontradas: ", paste(lns_nonempty, collapse = " | "),
      call. = FALSE
    )
  }

  .title_of_var <- function(var, source = NULL) {
    ctx <- .resolve_ref(var, source = source, arg_name = "var")
    if (exists("titulo_var", mode = "function", inherits = TRUE)) {
      return(titulo_var(
        ctx$var,
        dic_vars        = NULL,
        labels_override = NULL,
        orders_list     = ctx$orders_list,
        df              = ctx$data
      ))
    }
    ctx$var
  }

  .filter_data <- function(filtros = list(), source = NULL, ref = NULL) {
    src <- .resolve_source_name(source = source, ref = ref, arg_name = "var")
    .apply_named_filters(data_sources[[src]], filters = filtros %||% list(), arg_name = "filtros")
  }

  .blank_canvas <- function(preset_args = list(), overrides = list(), mensaje = "Sin datos para mostrar") {
    dbg <- .merge_args(presets$base$args %||% list(), preset_args %||% list(), overrides %||% list())
    if (exists(".dim_blank_canvas", mode = "function", inherits = TRUE)) {
      return(.dim_blank_canvas(
        mensaje = mensaje,
        debug_ph_bordes = isTRUE(dbg$debug_ph_bordes %||% FALSE),
        debug_ph_col = dbg$debug_ph_col %||% "#FF00FF",
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
      mostrar_todo  = FALSE
    )
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

  .base_auto_from_var <- function(var, filtros = list(), sufijo_auto = NULL, formato = "Base: %s") {
    if (!is.character(var) || length(var) != 1L || !nzchar(trimws(var))) return(NULL)

    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(NULL)

    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    tab2 <- tab |>
      dplyr::filter(.data$Opciones != "Total") |>
      dplyr::filter(!is.na(.data$n) & .data$n > 0)

    if (!nrow(tab2)) return(NULL)
    if (!is.finite(N_total)) N_total <- sum(tab2$n, na.rm = TRUE)
    if (!is.finite(N_total)) return(NULL)

    N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)

    # SOLO AUTO: sufijo opcional
    suf <- NULL
    if (!is.null(sufijo_auto) && is.character(sufijo_auto) && length(sufijo_auto) == 1L) {
      sufijo_auto <- trimws(sufijo_auto)
      if (nzchar(sufijo_auto)) suf <- sufijo_auto
    }

    base_core <- if (is.null(suf)) N_pretty else paste(N_pretty, suf)
    sprintf(formato, base_core)
  }

  .base_auto_from_refs <- function(refs, filtros = list(), sufijo_auto = NULL, formato = "Base: %s") {
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
        tab <- .tab_freq(first_ref, filtros = filtros, source = src)
        if (is.null(tab) || !nrow(tab)) return(NULL)

        N_total <- NA_real_
        if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
          idx_tot <- which(tab$Opciones == "Total")
          if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
        }

        tab2 <- tab |>
          dplyr::filter(.data$Opciones != "Total") |>
          dplyr::filter(!is.na(.data$n) & .data$n > 0)

        if (!nrow(tab2)) return(NULL)
        if (!is.finite(N_total)) N_total <- sum(tab2$n, na.rm = TRUE)
        if (!is.finite(N_total)) return(NULL)

        N_pretty <- format(N_total, big.mark = ",", scientific = FALSE)
        return(sprintf(formato, .fmt_base_part(N_pretty, src)))
      }

      return(.base_auto_from_var(
        var = first_ref,
        filtros = filtros,
        sufijo_auto = sufijo_auto,
        formato = formato
      ))
    }

    parts <- character(0)
    for (src in srcs_used) {
      idx <- which(vapply(ctxs, `[[`, character(1), "source") == src)[1]
      ref_src <- refs[idx]
      tab <- .tab_freq(ref_src, filtros = filtros, source = src)
      if (is.null(tab) || !nrow(tab)) next

      N_total <- NA_real_
      if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
        idx_tot <- which(tab$Opciones == "Total")
        if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
      }

      tab2 <- tab |>
        dplyr::filter(.data$Opciones != "Total") |>
        dplyr::filter(!is.na(.data$n) & .data$n > 0)

      if (!nrow(tab2)) next
      if (!is.finite(N_total)) N_total <- sum(tab2$n, na.rm = TRUE)
      if (!is.finite(N_total)) next

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
    sprintf(formato, base_core)
  }

  .base_auto_from_element <- function(el, sufijo_auto = NULL, formato = "Base: %s") {
    if (is.null(el) || !inherits(el, "ppt_element")) return(NULL)

    etype <- el$.element_type %||% ""
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
      if (!length(refs_base)) return(NULL)

      return(.base_auto_from_refs(
        refs = refs_base,
        filtros = filtros_base,
        sufijo_auto = sufijo_auto,
        formato = formato
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
      formato = formato
    )
  }

  .slide_subtitle_style <- function() {
    base_args <- presets$base$args %||% list()
    font_size <- suppressWarnings(as.numeric(base_args$size_subtitulo_slide %||% 18)[1])
    if (!is.finite(font_size) || is.na(font_size) || font_size <= 0) font_size <- 18
    font_family <- base_args$font_family_ppt %||% base_args$font_family %||% "Arial"
    font_family <- as.character(font_family)[1]
    if (is.na(font_family) || !nzchar(trimws(font_family))) font_family <- "Arial"
    list(
      font_family = font_family,
      font_size = font_size,
      color = base_args$color_nota_pie %||% "#39588B",
      # Separacion corta y consistente bajo el titulo.
      top_gap = 0.008,
      # Altura suficiente para evitar que PowerPoint reduzca automaticamente la fuente.
      height = max(0.36, font_size * 0.022)
    )
  }

  .placeholder_props_current <- function(doc, spec) {
    if (is.null(spec) || is.null(spec$type)) {
      stop("Placeholder spec invalido (NULL o sin $type).", call. = FALSE)
    }
    type_idx <- spec$type_idx %||% NULL
    if (!is.null(type_idx)) {
      type_idx <- suppressWarnings(as.integer(type_idx))
      if (length(type_idx) != 1L || is.na(type_idx)) {
        stop("`type_idx` debe ser un entero escalar.", call. = FALSE)
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

    props <- props[props$type %in% spec$type, , drop = FALSE]
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
          title_g <- as.character(titulos_grupo[[nm]] %||% nm)[1]
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
          .push_multi_block(sub, as.character(title_v)[1])
        }

      } else {
        # Modo desconocido: renderizar como bloque unico
        title_b <- block_data$title_slide %||% block_data$overrides$titulo %||% NULL
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
    title <- el$title_slide %||% el$overrides$titulo %||% NULL

    word_note <- .plot_note_from(plot, el$overrides$nota_pie %||% el$nota_pie %||% NULL)

    el_for_word <- el
    el_for_word$.word_render <- TRUE
    el_for_word$overrides <- el_for_word$overrides %||% list()
    el_for_word$overrides$titulo    <- NULL
    el_for_word$overrides$subtitulo <- NULL
    el_for_word$overrides$nota_pie  <- NULL
    if (identical(etype, "media_rango")) {
      # Reducir tamano de ejes para Word (device mas angosto)
      size_ejes_orig <- el_for_word$overrides$size_ejes %||% 9
      el_for_word$overrides$size_ejes <- min(size_ejes_orig, 8)
      modo_word <- el_for_word$overrides$modo %||% NULL
      if (identical(modo_word, "score_ref") && is.null(el_for_word$overrides$size_delta)) {
        size_media_word <- suppressWarnings(as.numeric(el_for_word$overrides$size_media)[1])
        if (!is.finite(size_media_word) || is.na(size_media_word) || size_media_word <= 0) {
          size_media_word <- 3
        }
        el_for_word$overrides$size_delta <- max(2.4, size_media_word * 0.72)
      }
      if (identical(modo_word, "score_ref") && is.null(el_for_word$overrides$delta_umbral_cerca_ref)) {
        el_for_word$overrides$delta_umbral_cerca_ref <- 5
      }
      if (identical(modo_word, "score_ref") && is.null(el_for_word$overrides$delta_rel_cerca_ref)) {
        el_for_word$overrides$delta_rel_cerca_ref <- 0.34
      }
    }
    p_word <- tryCatch(.render_element(el_for_word), error = function(e) plot)

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
    if (!is.null(note_attr)) return(note_attr)
    .clean_note_text(fallback)
  }

  .ppt_note_from <- function(plot_obj, fallback = NULL) {
    .plot_note_from(plot_obj, fallback = fallback)
  }

  .force_canvas_args <- function(fun, args) {
    fml <- tryCatch(names(formals(fun)), error = function(e) character(0))
    if ("usar_canvas" %in% fml) args$usar_canvas <- TRUE
    args
  }

  # Dispatcher generico: renderiza cualquier ppt_element
  .render_element <- function(el) {

    if (is.null(el) || !inherits(el, "ppt_element")) {
      stop(".render_element(): `el` debe ser `ppt_element`.", call. = FALSE)
    }

    etype <- el$.element_type %||% NA_character_
    if (is.na(etype) || !nzchar(etype)) {
      stop(".render_element(): elemento sin `.element_type`.", call. = FALSE)
    }
    if (identical(etype, "dim_radar_tabla")) {
      stop(
        "`dim_radar_tabla` fue retirado del flujo PPT. Use `p_dim_radar()` o `p_dim_heatmap()`.",
        call. = FALSE
      )
    }

    fn_name <- paste0(".render_", etype)
    if (!exists(fn_name, mode = "function", inherits = TRUE)) {
      stop("No existe renderer para etype='", etype, "' (se esperaba ", fn_name, "()).", call. = FALSE)
    }
    fn <- get(fn_name, mode = "function", inherits = TRUE)

    # presets por tipo (si no existen, lista vacia)
    pa_apiladas <- presets$barras_apiladas$args %||% list()
    pa_multi    <- presets$multi_apiladas$args  %||% list()
    pa_agrup    <- presets$barras_agrupadas$args %||% list()
    pa_num      <- presets$barras_numericas$args %||% list()
    pa_box      <- presets$boxplot$args %||% list()
    pa_media_rng <- presets$media_rango$args %||% presets$boxplot$args %||% list()
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
        stop(
          "Renderer encontrado (", fn_name, ") pero fallo al ejecutarse: ",
          conditionMessage(out),
          call. = FALSE
        )
      }
      return(out)
    }

    # Mapeo estandar: (el, preset_args)
    preset_args <- switch(
      etype,
      barras_apiladas  = pa_apiladas,
      barras_agrupadas = pa_agrup,
      numerico         = pa_num,
      boxplot          = pa_box,
      media_rango      = pa_media_rng,
      pie              = pa_pie,
      donut            = pa_donut,
      radar_tabla      = pa_radar,
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

      stop(
        "Renderer encontrado (", fn_name, ") pero fallo al ejecutarse: ",
        conditionMessage(out),
        call. = FALSE
      )
    }

    out
  }

  # --- Renderer para ggplot crudo (p_ggplot_raw) ---
  .render_ggplot_raw <- function(el, preset_args = list()) {
    el$gg
  }

  .render_barras_apiladas <- function(el, preset_args) {
    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(.blank_canvas(preset_args, overrides))

    # N desde Total si existe
    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    tab <- tab |>
      dplyr::filter(.data$Opciones != "Total") |>
      dplyr::filter(!is.na(.data$n) & .data$n > 0)

    if (!nrow(tab)) return(.blank_canvas(preset_args, overrides))
    if (!is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)

    pct_int  <- .pct_enteros_100(tab$n)
    cols_pct <- paste0("pct_", seq_len(nrow(tab)))

    ocultar_categoria_word <- isTRUE(el$.word_render) &&
      isTRUE(overrides$word_ocultar_etiqueta_categoria %||%
               preset_args$word_ocultar_etiqueta_categoria %||%
               TRUE)

    df_wide <- tibble::tibble(
      categoria = if (ocultar_categoria_word) "" else .title_of_var(var),
      N         = N_total
    )
    for (i in seq_along(cols_pct)) df_wide[[cols_pct[i]]] <- pct_int[i] / 100

    etiquetas_grupos <- stats::setNames(as.character(tab$Opciones), cols_pct)

    # paleta auto (paleta_<listname>)
    ln <- .list_name_of_var(var)
    colores_grupos <- .paleta_auto(ln, env_diapos)

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
      escala_valor     = "proporcion_1",
      colores_grupos   = colores_grupos,
      titulo           = NULL,
      subtitulo        = NULL,
      nota_pie         = NULL
    )

    # merge: base_args <- preset_args <- overrides (overrides manda)
    preset_args <- preset_args %||% list()

    args <- .merge_args(base_args, preset_args, overrides)
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
    wrap_y_eff <- overrides$ancho_max_eje_y %||%
      overrides$wrap_y %||%
      preset_args_multi$ancho_max_eje_y %||%
      preset_args_multi$wrap_y %||%
      preset_args_single$ancho_max_eje_y %||%
      preset_args_single$wrap_y %||%
      el$ancho_max_eje_y %||%
      el$wrap_y %||%
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
      observed_opts <- unique(.clean_chr(observed_opts))
      observed_opts <- observed_opts[nzchar(observed_opts)]
      if (!length(observed_opts)) return(character(0))

      niveles_formales <- character(0)
      if (!is.null(palette_names) && length(palette_names)) {
        niveles_formales <- palette_names
      } else if (!is.null(choices_use) &&
                 "list_name" %in% names(choices_use) &&
                 "label" %in% names(choices_use)) {
        niveles_formales <- as.character(choices_use$label[choices_use$list_name == list_name])
      }
      niveles_formales <- .clean_chr(niveles_formales)
      niveles_formales <- niveles_formales[nzchar(niveles_formales)]

      if (length(niveles_formales)) {
        ordered <- intersect(niveles_formales, observed_opts)
        extras <- setdiff(observed_opts, ordered)
        return(c(ordered, extras))
      }

      observed_opts
    }

    .apply_top2box_alias <- function(base_args) {
      if (!isTRUE(el$top2box)) return(base_args)

      base_args$mostrar_barra_extra <- TRUE
      base_args$barra_extra_preset  <- "top2box"
      if (!is.null(el$top2box_labels) && length(el$top2box_labels)) {
        base_args$top2box_labels <- el$top2box_labels
      }
      if (is.null(base_args$titulo_barra_extra) || !nzchar(base_args$titulo_barra_extra)) {
        base_args$titulo_barra_extra <- "TOP TWO BOX"
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

    .multilista_block_height <- function(block_el) {
      if (!is.null(block_el$altura_rel)) {
        h <- suppressWarnings(as.numeric(block_el$altura_rel)[1])
        if (is.finite(h) && !is.na(h) && h > 0) return(h)
      }

      block_overrides <- block_el$overrides %||% list()
      block_wrap <- block_overrides$ancho_max_eje_y %||%
        block_overrides$wrap_y %||%
        preset_args_multi$ancho_max_eje_y %||%
        preset_args_multi$wrap_y %||%
        preset_args_single$ancho_max_eje_y %||%
        preset_args_single$wrap_y %||%
        block_el$ancho_max_eje_y %||%
        block_el$wrap_y %||%
        50
      block_wrap <- suppressWarnings(as.numeric(block_wrap)[1])
      if (!is.finite(block_wrap) || is.na(block_wrap) || block_wrap < 10) {
        block_wrap <- 50
      }

      n_rows <- 1L
      title_lines <- 0L

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
          tg <- block_el$titulos_grupo %||% character(0)
          lines_group <- 0L
          for (nm in names(block_el$vars)) {
            ttl <- .named_lookup(tg, nm, default = nm)
            lines_group <- lines_group + .multilista_wrap_lines(
              ttl,
              max(12, floor(block_wrap * 0.8))
            )
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
            title_lines <- title_lines + .multilista_wrap_lines(
              ttl,
              max(12, floor(block_wrap * 0.8))
            )
          }
        }
      }

      show_legend <- block_overrides$mostrar_leyenda %||%
        preset_args_multi$mostrar_leyenda %||%
        preset_args_single$mostrar_leyenda %||%
        TRUE

      show_extra <- block_overrides$mostrar_barra_extra %||%
        isTRUE(block_el$top2box) ||
        (!is.null(block_overrides$barra_extra_preset) &&
           !identical(block_overrides$barra_extra_preset, "ninguno"))

      0.85 +
        (0.90 * max(1, n_rows)) +
        (0.18 * title_lines) +
        if (isTRUE(show_legend)) 0.70 else 0 +
        if (isTRUE(show_extra)) 0.25 else 0
    }

    if (identical(modo, "multilista")) {
      bloques <- el$bloques %||% list()
      if (!length(bloques)) return(NULL)
      if (!requireNamespace("cowplot", quietly = TRUE)) {
        stop("multiapiladas (modo='multilista'): se requiere cowplot.", call. = FALSE)
      }

      rendered <- list()
      rel_heights <- numeric(0)
      for (block in bloques) {
        # En multilista, cada subbloque debe renderizarse sin titulo/subtitulo
        # automaticos salvo que el usuario los haya pedido explicitamente.
        block_render <- block
        block_render$title_slide <- NULL
        block_render$overrides <- block_render$overrides %||% list()
        block_render$overrides$titulo <- block_render$.multilista_block_title %||% ""
        block_render$overrides$subtitulo <- block_render$.multilista_block_subtitle %||% ""

        p_block <- .render_barras_multiapiladas(
          block_render,
          preset_args_multi = preset_args_multi,
          preset_args_single = preset_args_single
        )
        if (is.null(p_block)) next
        rendered[[length(rendered) + 1L]] <- p_block
        rel_heights <- c(rel_heights, .multilista_block_height(block))
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

        tabs_by_v[[v]] <- tab
        N_by_v[v] <- N_total
        labels_by_v[v] <- .title_of_var(v)
        all_opts <- union(all_opts, as.character(tab$Opciones))
      }

      if (!length(tabs_by_v)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))

      all_opts <- .ordered_stack_levels(
        ln,
        all_opts,
        choices_use = choices_use,
        palette_names = names(colores_grupos %||% NULL)
      )

      cols_pct <- paste0("pct_", seq_along(all_opts))
      etiquetas_grupos <- stats::setNames(all_opts, cols_pct)

      duplicated_labels <- duplicated(labels_by_v) | duplicated(labels_by_v, fromLast = TRUE)

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

        pct_int <- .pct_enteros_100(tab$n)
        names(pct_int) <- as.character(tab$Opciones)

        row <- tibble::tibble(
          categoria = label_v,
          N         = unname(N_by_v[v])
        )
        for (i in seq_along(all_opts)) {
          opt <- all_opts[i]
          row[[cols_pct[i]]] <- (pct_int[opt] %||% 0) / 100
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
        escala_valor     = "proporcion_1",
        colores_grupos   = colores_grupos,
        titulo           = NULL,
        subtitulo        = NULL,
        nota_pie         = NULL
      )

      base_args <- .apply_top2box_alias(base_args)

      # Word, una sola variable: activar canvas para que el layout de columnas
      # sea identico al resto (misma posicion inicial de barras, sin expand ggplot).
      # NO se colapsa canvas_w_etiquetas para que las barras arranquen al mismo nivel.
      if (single_word_var) {
        overrides$usar_canvas <- TRUE

        # En split Word, no heredamos anchos "ad hoc" del bloque original (pensados
        # para etiquetas largas en PPT), para que 1 barra y 2+ barras compartan
        # el mismo punto de inicio y placeholders.
        width_keys <- c(
          "canvas_w_etiquetas",
          "canvas_w_buf_etq_bars",
          "canvas_w_bars",
          "canvas_w_buf_bars_extra",
          "canvas_w_extra"
        )
        for (k in width_keys) {
          val <- preset_args_single[[k]] %||% preset_args_multi[[k]] %||% NULL
          if (!is.null(val)) overrides[[k]] <- val
        }
      }

      args <- .merge_args(base_args, preset_args_single, preset_args_multi, overrides)
      fun  <- graficar_barras_apiladas
      args <- .force_canvas_args(fun, args)
      args <- .keep_formals(fun, args)
      return(suppressWarnings(do.call(fun, args)))
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

      tab_total <- tab_total |>
        dplyr::filter(.data$Opciones != "Total") |>
        dplyr::filter(!is.na(.data$n) & .data$n > 0)

      if (!nrow(tab_total)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))

      all_opts <- as.character(tab_total$Opciones)

      all_opts <- .ordered_stack_levels(
        ln_var,
        all_opts,
        choices_use = ctx_var$choices,
        palette_names = names(colores_grupos %||% NULL)
      )

      cols_pct <- paste0("pct_", seq_along(all_opts))
      etiquetas_grupos <- stats::setNames(all_opts, cols_pct)

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
          mostrar_todo  = FALSE
        )

        if (is.null(tab) || !nrow(tab)) next

        # N desde Total si existe
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

        # pct enteros a 100 dentro del grupo
        pct_int <- .pct_enteros_100(tab$n)
        names(pct_int) <- as.character(tab$Opciones)

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
          row[[cols_pct[i]]] <- (pct_int[opt] %||% 0) / 100
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
        escala_valor     = "proporcion_1",
        colores_grupos   = colores_grupos,
        titulo           = NULL,
        subtitulo        = NULL,
        nota_pie         = NULL
      )

      base_args <- .apply_top2box_alias(base_args)

      args <- .merge_args(base_args, preset_args_single, preset_args_multi, overrides)
      fun  <- graficar_barras_apiladas
      args <- .force_canvas_args(fun, args)
      args <- .keep_formals(fun, args)
      return(suppressWarnings(do.call(fun, args)))
    }

    if (identical(modo, "var_cruce")) {

      vars  <- el$vars
      cruce <- el$cruce %||% NULL

      titulos_grupo  <- el$titulos_grupo %||% character(0)
      sin_grupo_word <- isTRUE(el$.word_sin_grupo)  # TRUE al renderizar para Word

      if (is.list(vars) && !is.character(vars)) {
        group_refs <- vars
        group_ids <- names(group_refs)
        if (!length(group_refs)) return(NULL)

        flat_refs <- .extract_ref_values(group_refs)
        ctx_all <- lapply(flat_refs, .resolve_ref, arg_name = "vars")
        src_all <- unique(vapply(ctx_all, `[[`, character(1), "source"))

        if (!is.null(cruce) && nzchar(trimws(as.character(cruce)[1])) && length(src_all) > 1L) {
          stop("multiapiladas (modo='var_cruce'): cuando `vars` usa varias fuentes, `cruces` debe ser NULL.", call. = FALSE)
        }

        scale_spec <- .shared_scale_spec(ctx_all, arg_name = "var_cruce")
        ln <- scale_spec$list_name
        colores_grupos <- .paleta_auto(ln, env_diapos)
        choices_use <- scale_spec$choices

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

            tab_total <- tab_total |>
              dplyr::filter(.data$Opciones != "Total") |>
              dplyr::filter(!is.na(.data$n) & .data$n > 0)

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
        cols_pct <- paste0("pct_", seq_along(all_opts))
        etiquetas_grupos <- stats::setNames(all_opts, cols_pct)

        rows <- list()
        for (group_id in names(valid_refs)) {
          refs_i <- valid_refs[[group_id]]
          if (!length(refs_i)) next

          group_title <- .named_lookup(titulos_grupo, group_id, default = group_id)
          group_title <- as.character(group_title)[1]
          if (!nzchar(trimws(group_title))) group_title <- group_id
          if (requireNamespace("stringr", quietly = TRUE)) {
            group_title <- stringr::str_wrap(group_title, width = max(12, floor(wrap_y_eff * 0.8)))
          }

          filas_var <- 0L
          for (ref in names(refs_i)) {
            ctx_v <- refs_i[[ref]]
            tab <- .tab_freq(ref, filtros = filtros)
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

            pct_int <- .pct_enteros_100(tab$n)
            names(pct_int) <- as.character(tab$Opciones)

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
              row[[cols_pct[k]]] <- (pct_int[opt] %||% 0) / 100
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

          tab_total <- tab_total |>
            dplyr::filter(.data$Opciones != "Total") |>
            dplyr::filter(!is.na(.data$n) & .data$n > 0)

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
        cols_pct <- paste0("pct_", seq_along(all_opts))
        etiquetas_grupos <- stats::setNames(all_opts, cols_pct)

        rows <- list()
        x_cruce <- .clean_chr(dsrc[[cruce]])

        for (i in seq_along(vars)) {
          v <- vars[i]
          ctx_v <- vars_con_datos[[v]]
          if (is.null(ctx_v)) next

          group_title <- .named_lookup(titulos_grupo, ctx_v$raw_ref,
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
              mostrar_todo  = FALSE
            )

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

            pct_int <- .pct_enteros_100(tab$n)
            names(pct_int) <- as.character(tab$Opciones)

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
              row[[cols_pct[k]]] <- (pct_int[opt] %||% 0) / 100
            }

            rows[[length(rows) + 1L]] <- row
            filas_var <- filas_var + 1L
          }
        }
      }

      if (!length(rows)) return(.blank_canvas(preset_args_multi, el$overrides %||% list()))
      df_block <- dplyr::bind_rows(rows)

      base_args <- list(
        data                   = df_block,
        var_categoria          = ".categoria_id",
        var_etiqueta_categoria = "categoria",
        var_grupo_id           = if (!sin_grupo_word) ".grupo_id"    else NULL,
        var_grupo_titulo       = if (!sin_grupo_word) ".grupo_titulo" else NULL,
        var_n                  = "N",
        cols_porcentaje        = cols_pct,
        etiquetas_grupos       = etiquetas_grupos,
        escala_valor           = "proporcion_1",
        colores_grupos         = colores_grupos,
        titulo                 = NULL,
        subtitulo              = NULL,
        nota_pie               = NULL,
        usar_canvas            = TRUE,
        canvas_w_grupo         = if (!sin_grupo_word) 0.24 else 0,
        canvas_w_buf_grupo_etq = if (!sin_grupo_word) 0.03 else 0,
        canvas_gap_grupos      = if (!sin_grupo_word) 0.35 else 0
      )
      base_args <- .apply_top2box_alias(base_args)

      args <- .merge_args(base_args, preset_args_single, preset_args_multi, overrides)
      args$usar_canvas <- TRUE
      fun  <- graficar_barras_apiladas
      args <- .force_canvas_args(fun, args)
      args <- .keep_formals(fun, args)
      return(suppressWarnings(do.call(fun, args)))
    }

    stop("multiapiladas: modo no soportado: ", modo, call. = FALSE)
  }


  .render_barras_agrupadas <- function(el, preset_args) {

    var <- el$var
    filtros <- el$filtros %||% list()
    overrides <- el$overrides %||% list()
    tab <- .tab_freq(var, filtros = filtros)
    if (is.null(tab) || !nrow(tab)) return(.blank_canvas(preset_args, overrides))

    # N desde Total si existe
    N_total <- NA_real_
    if ("Opciones" %in% names(tab) && "n" %in% names(tab)) {
      idx_tot <- which(tab$Opciones == "Total")
      if (length(idx_tot)) N_total <- suppressWarnings(as.numeric(tab$n[idx_tot[1]]))
    }

    tab <- tab |>
      dplyr::filter(.data$Opciones != "Total") |>
      dplyr::filter(!is.na(.data$n) & .data$n > 0)

    if (!nrow(tab)) return(.blank_canvas(preset_args, overrides))

    if (!is.finite(N_total)) N_total <- sum(tab$n, na.rm = TRUE)
    if (!is.finite(N_total) || N_total <= 0) return(.blank_canvas(preset_args, overrides))

    # ----------------------------
    # LONG: 1 fila por opcion
    # (esto evita: eje Y con "titulo" y colores distintos por opcion)
    # ----------------------------
    df_long <- tibble::tibble(
      categoria = as.character(tab$Opciones),
      N         = N_total,
      pct       = as.numeric(tab$n) / N_total
    )

    etiquetas_series <- c(pct = "Porcentaje")

    # Detectar si la variable es select_multiple → agregar subtitulo en cursiva
    if (is.null(overrides$subtitulo)) {
      ctx_v <- tryCatch(.resolve_ref(var, arg_name = "var"), error = function(e) NULL)
      if (!is.null(ctx_v) && !is.null(ctx_v$survey) && all(c("type", "name") %in% names(ctx_v$survey))) {
        mask <- !is.na(ctx_v$survey$name) & ctx_v$survey$name == ctx_v$var
        tps  <- unique(stats::na.omit(ctx_v$survey$type[mask]))
        if (any(grepl("^select_multiple(\\s|$)", tps))) {
          overrides$subtitulo <- "Pregunta de opcion multiple"
        }
      }
    }

    if (!exists("graficar_barras_agrupadas", mode = "function", inherits = TRUE)) {
      stop("No existe `graficar_barras_agrupadas()` en el entorno/paquete.", call. = FALSE)
    }

    base_args <- list(
      data             = df_long,
      var_categoria    = "categoria",
      var_n            = "N",
      cols_porcentaje  = "pct",
      etiquetas_series = etiquetas_series,
      titulo           = NULL,
      subtitulo        = NULL,
      nota_pie         = NULL
    )

    preset_args <- preset_args %||% list()
    # limpiar cosas que NO aplican a agrupadas (por si vienen de presets genericos)
    preset_args$var_grupo      <- NULL
    preset_args$colores_grupos <- NULL
    overrides$var_grupo        <- NULL
    overrides$colores_grupos   <- NULL

    args <- .merge_args(base_args, preset_args, overrides)
    fun  <- graficar_barras_agrupadas
    args <- .force_canvas_args(fun, args)
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

    tab <- tab |>
      dplyr::filter(.data$Opciones != "Total") |>
      dplyr::filter(!is.na(.data$n) & .data$n > 0)

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
      tipo_pie       = tipo_pie,
      colores_categorias = colores_grupos,
      titulo         = NULL,
      subtitulo      = NULL,
      nota_pie       = NULL
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

    nombre_serie   <- preset_args$nombre_serie   %||% overrides$nombre_serie   %||% "v1"
    etiqueta_serie <- preset_args$etiqueta_serie %||% overrides$etiqueta_serie %||% "Media"

    preset_args$nombre_serie   <- NULL
    preset_args$etiqueta_serie <- NULL
    overrides$nombre_serie     <- NULL
    overrides$etiqueta_serie   <- NULL

    if (is.null(cruce)) {

      x2 <- x[is.finite(x)]
      if (!length(x2)) return(.blank_canvas(preset_args, overrides))

      N <- length(x2)
      m <- mean(x2, na.rm = TRUE)
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

      df_wide <- d2 |>
        dplyr::group_by(.data$.cruce) |>
        dplyr::summarise(
          N  = dplyr::n(),
          .m = mean(.data$.x, na.rm = TRUE),
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

    base_args <- list(
      data             = df_wide,
      var_categoria    = "categoria",
      var_n            = "N",
      vars_valor       = nombre_serie,
      etiquetas_series = stats::setNames(etiqueta_serie, nombre_serie),

      titulo           = NULL,
      subtitulo        = NULL,
      nota_pie         = NULL,

      usar_canvas      = TRUE,
      exportar         = "rplot"
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

    tryCatch(
      suppressWarnings(do.call(fun, args)),
      error = function(e) {
        message("⚠️ .render_numerico(): ", conditionMessage(e))
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
          cols <- grDevices::hcl.colors(length(labels), palette = "Dark 3")
          stats::setNames(cols, labels)
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
    if (!is.list(plan)) stop("`plan` debe ser una lista de slides.", call. = FALSE)
    .validate_plan(plan, strict = strict_diapos)
  }

  if (!length(plan)) stop("No hay diapositivas...", call. = FALSE)

  # ---------------------------------------------------------------------------
  # 7) Abrir plantilla / doc (solo si exporta)
  # ---------------------------------------------------------------------------
  PPT_CONTRACT <- .PPT_CONTRACT

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
        doc <- officer::read_pptx(path = template_interno)
      } else {
        if (isTRUE(mensajes_progreso)) message("No se encontro plantilla interna. Usando PPT default.")
        doc <- officer::read_pptx()
      }

    } else {
      # Plantilla externa explicita
      if (!file.exists(template_pptx)) stop("No existe `template_pptx`: ", template_pptx, call. = FALSE)
      if (isTRUE(mensajes_progreso)) message("Usando plantilla externa: ", template_pptx)
      doc <- officer::read_pptx(path = template_pptx)
    }

    layout_info <- tryCatch(officer::layout_summary(doc), error = function(e) NULL)
    if (is.null(layout_info) || !nrow(layout_info)) {
      stop("No se pudo leer `layout_summary()` del PPT.", call. = FALSE)
    }

    .pick_layout <- function(candidates) {
      hit <- candidates[candidates %in% layout_info$layout][1]
      if (length(hit) == 0 || is.na(hit)) return(NA_character_)
      hit
    }

    # Preferencias
    layout_graficos   <- .pick_layout(c("Graficos2", "Graficos"))
    layout_doble      <- .pick_layout(c("Graficos_2columnas"))
    layout_narrativo1 <- .pick_layout(c("1_Grafico_narrativo"))
    layout_narrativo2 <- .pick_layout(c("1_Graficos_2columnas_narrativo"))
    layout_paneles_4  <- .pick_layout(c("4_paneles"))
    layout_indice     <- .pick_layout(c("Indice"))
    layout_text_slide <- .pick_layout(c("Title and Content", "General Objective"))
    layout_objetivo_icono <- .pick_layout(c("Objetivos_Secciones"))
    layout_title      <- .pick_layout(c("Title Slide"))
    layout_poblacion4 <- .pick_layout(c("poblacion_4"))
    layout_text_right <- .pick_layout(c("right_grafico_texto"))
    layout_text_left  <- .pick_layout(c("left_grafico_texto"))
    layout_text_right2 <- .pick_layout(c("right_2graficos_texto"))
    layout_text_left2  <- .pick_layout(c("left_2graficos_texto"))
    layout_poblacion_2 <- .pick_layout(c("poblacion_2"))
    layout_poblacion_5 <- .pick_layout(c("poblacion_5"))
    layout_poblacion_6 <- .pick_layout(c("poblacion_6"))

    if (is.na(layout_graficos)) {
      stop("La plantilla NO tiene layout requerido: 'Graficos' o 'Graficos2'.", call. = FALSE)
    }
    if (is.na(layout_doble)) {
      stop("La plantilla NO tiene layout requerido: 'Graficos_2columnas'.", call. = FALSE)
    }
    if (is.na(layout_title)) {
      stop("La plantilla NO tiene layout requerido: 'Title Slide'.", call. = FALSE)
    }
    if (is.na(layout_poblacion4)) {
      stop("La plantilla NO tiene layout requerido: 'poblacion_4'.", call. = FALSE)
    }
    if (is.na(layout_text_right)) {
      stop("La plantilla NO tiene layout requerido: 'right_grafico_texto'.", call. = FALSE)
    }
    if (is.na(layout_text_left)) {
      stop("La plantilla NO tiene layout requerido: 'left_grafico_texto'.", call. = FALSE)
    }
    if (is.na(layout_text_right2)) {
      stop("La plantilla NO tiene layout requerido: 'right_2graficos_texto'.", call. = FALSE)
    }
    if (is.na(layout_text_left2)) {
      stop("La plantilla NO tiene layout requerido: 'left_2graficos_texto'.", call. = FALSE)
    }
    if (is.na(layout_poblacion_2)) stop("La plantilla NO tiene layout requerido: 'poblacion_2'.", call. = FALSE)
    if (is.na(layout_poblacion_5)) stop("La plantilla NO tiene layout requerido: 'poblacion_5'.", call. = FALSE)
    if (is.na(layout_poblacion_6)) stop("La plantilla NO tiene layout requerido: 'poblacion_6'.", call. = FALSE)

    slide_1_slots_by_layout <- list(
      Graficos = list(
        base  = list(type = "body", type_idx = 2),
        right = list(type = "body", type_idx = 3)
      ),
      Graficos2 = list(
        base  = list(type = "body", type_idx = 2),
        right = list(type = "body", type_idx = 3)
      )
    )

    PPT_CONTRACT$slide_1$layout     <- layout_graficos
    if (!is.null(slide_1_slots_by_layout[[layout_graficos]])) {
      PPT_CONTRACT$slide_1$slots$base  <- slide_1_slots_by_layout[[layout_graficos]]$base
      PPT_CONTRACT$slide_1$slots$right <- slide_1_slots_by_layout[[layout_graficos]]$right
    }
    PPT_CONTRACT$slide_2$layout     <- layout_doble
    if (!is.na(layout_narrativo1)) PPT_CONTRACT$slide_1_narrativo$layout <- layout_narrativo1
    if (!is.na(layout_narrativo2)) PPT_CONTRACT$slide_2_narrativo$layout <- layout_narrativo2
    if (!is.na(layout_paneles_4))  PPT_CONTRACT$paneles_4$layout <- layout_paneles_4
    if (!is.na(layout_indice)) PPT_CONTRACT$indice$layout <- layout_indice
    if (!is.na(layout_text_slide)) PPT_CONTRACT$text_slide$layout <- layout_text_slide
    if (!is.na(layout_text_slide)) PPT_CONTRACT$technical_table$layout <- layout_text_slide
    if (!is.na(layout_objetivo_icono)) PPT_CONTRACT$objetivo_icono$layout <- layout_objetivo_icono
    PPT_CONTRACT$title_slide$layout <- layout_title
    PPT_CONTRACT$poblacion_4$layout <- layout_poblacion4
    PPT_CONTRACT$text_r$layout      <- layout_text_right
    PPT_CONTRACT$text_l$layout      <- layout_text_left
    PPT_CONTRACT$text_r2$layout     <- layout_text_right2
    PPT_CONTRACT$text_l2$layout     <- layout_text_left2
    PPT_CONTRACT$poblacion_2$layout <- layout_poblacion_2
    PPT_CONTRACT$poblacion_5$layout <- layout_poblacion_5
    PPT_CONTRACT$poblacion_6$layout <- layout_poblacion_6
  }

  # ---------------------------------------------------------------------------
  # 8) Render + export (estricto con .PPT_CONTRACT)
  # ---------------------------------------------------------------------------
  log_rows   <- list()
  rendered   <- list()
  render_meta <- list()

  for (i in seq_along(plan)) {

    slide <- plan[[i]]
    if (!inherits(slide, "ppt_slide")) {
      stop("Cada slide debe tener clase `ppt_slide`.", call. = FALSE)
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

        # title (requerido)
        if (!is.null(ttl) && nzchar(trimws(ttl))) {
          doc <- .ph_with_strict(doc, ttl, contract$slots$title)
        } else {
          stop("title_slide requiere `title` no vacio.", call. = FALSE)
        }

        # opcionales (solo si vienen)
        if (!is.null(sub) && nzchar(trimws(sub))) {
          doc <- .ph_with_strict(doc, sub, contract$slots$subtitle)
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

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)
      }

      log_rows[[length(log_rows) + 1]] <- tibble::tibble(
        slide_i    = i,
        slide_type = "indice",
        element    = NA_character_,
        var        = NA_character_
      )
      next
    }

    # ---- TEXT_SLIDE ----------------------------------------------------------
    if (identical(stype, "text_slide")) {

      contract <- PPT_CONTRACT$text_slide
      slots <- slide$slots %||% list()

      title_slide <- slots$title %||% slide$title %||% NULL
      txt <- slots$text %||% NULL

      if (is.null(contract$layout) || is.na(contract$layout) || !nzchar(contract$layout)) {
        stop("La plantilla NO tiene layout requerido para `text_slide`: 'Title and Content' o 'General Objective'.", call. = FALSE)
      }

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)

        if (!is.null(title_slide) && nzchar(trimws(as.character(title_slide)[1]))) {
          doc <- .ph_with_strict(doc, as.character(title_slide)[1], contract$slots$title)
        } else {
          stop("text_slide requiere `title` no vacio.", call. = FALSE)
        }

        if (is.null(txt) || !nzchar(trimws(as.character(txt)[1]))) txt <- " "
        doc <- .ph_with_strict(doc, as.character(txt)[1], contract$slots$text)
      }

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
        stop("La plantilla NO tiene layout requerido para `technical_table`: 'Title and Content' o 'General Objective'.", call. = FALSE)
      }
      if (is.null(title_slide) || !nzchar(trimws(as.character(title_slide)[1]))) {
        stop("technical_table requiere `title` no vacio.", call. = FALSE)
      }
      if (is.null(table_data) || !is.data.frame(table_data) || ncol(table_data) < 2L || !nrow(table_data)) {
        stop("technical_table requiere `slots$table` como data.frame con al menos dos columnas y una fila.", call. = FALSE)
      }

      if (!isTRUE(solo_lista)) {
        doc <- .add_slide_strict(doc, contract$layout)

        font_family_default <- presets$base$args$font_family_ppt %||%
          presets$base$args$font_family %||% "Arial"
        style$font_family <- style$font_family %||% font_family_default

        title_left <- .style_num(style, "title_left", 0.62, min = 0)
        title_top <- .style_num(style, "title_top", 0.70, min = 0)
        title_width <- .style_num(style, "title_width", 11.9, min = 1)
        title_height <- .style_num(style, "title_height", 0.55, min = 0.2)
        title_size <- .style_num(style, "title_size", 25.5, min = 8)
        title_color <- as.character(.style_value(style, "title_color", "#D93A39"))[1]

        title_prop <- officer::fp_text(
          color = title_color,
          font.size = title_size,
          bold = TRUE,
          font.family = as.character(style$font_family)[1]
        )
        title_value <- officer::fpar(
          officer::ftext(toupper(as.character(title_slide)[1]), prop = title_prop),
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

        table_left <- .style_num(style, "table_left", 0.50, min = 0)
        table_top <- .style_num(style, "table_top", 1.45, min = 0)
        table_width <- .style_num(style, "table_width", 12.30, min = 4)
        table_height <- .style_num(style, "table_height", 5.55, min = 1)
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
            color = as.character(.style_value(style, "footer_color", "#4B5563"))[1],
            font.size = .style_num(style, "footer_size", 8.5, min = 5),
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
              left = .style_num(style, "footer_left", 0.50, min = 0),
              top = .style_num(style, "footer_top", 7.06, min = 0),
              width = .style_num(style, "footer_width", 12.25, min = 1),
              height = .style_num(style, "footer_height", 0.20, min = 0.1)
            )
          )
        }
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
        stop("En `p_slide_objetivo_icono()`, `icono` debe ser `ppt_element`.", call. = FALSE)
      }

      p_icon <- .render_element(el_icon)
      if (is.null(p_icon)) {
        stop("No se pudo renderizar `icono` en `p_slide_objetivo_icono()`.", call. = FALSE)
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
        doc <- .ph_with_strict(doc, as.character(txt)[1], contract$slots$text)
        doc <- .ph_with_strict(
          doc,
          rvg::dml(ggobj = p_icon, bg = "transparent"),
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
      subtitle_slide <- slots$subtitle %||% NULL
      el_plot     <- slots$plot %||% NULL

      if (!inherits(el_plot, "ppt_element")) {
        stop("En `p_slide_1_grafico()`, `grafico` debe ser `ppt_element`.", call. = FALSE)
      }

      etype <- el_plot$.element_type %||% NA_character_

      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      el_plot <- .inject_var_titulo(el_plot)
      p <- .render_element(el_plot)

      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        stop("No se pudo renderizar elemento: ", etype, " (", vv, ").", call. = FALSE)
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

        doc <- .ph_with_strict(
          doc,
          rvg::dml(ggobj = p, bg = "transparent"),
          contract$slots$plot
        )

        # BASE (manual o auto)
        base_txt <- slots$base %||% NULL

        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el_plot,
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }

        if (is.null(base_txt)) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        # RIGHT (usa footer o deja en blanco)
        right_obj <- slots$footer %||% NULL

        right_txt <- NULL
        if (inherits(right_obj, "ppt_element_text")) right_txt <- right_obj$text %||% NULL
        if (is.character(right_obj) && length(right_obj) == 1L) right_txt <- right_obj
        if (is.null(right_txt) || !nzchar(trimws(as.character(right_txt)[1]))) {
          right_txt <- .ppt_note_from(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
        }

        if (is.null(right_txt) || !nzchar(trimws(right_txt))) right_txt <- " "
        doc <- .ph_with_strict(doc, right_txt, contract$slots$right)
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

      if (!inherits(el_left, "ppt_element") || !inherits(el_right, "ppt_element")) {
        stop("En `p_slide_2_graficos()`, `izquierda` y `derecha` deben ser `ppt_element`.", call. = FALSE)
      }

      el_left  <- .inject_var_titulo(el_left)
      el_right <- .inject_var_titulo(el_right)
      pL <- .render_element(el_left)
      pR <- .render_element(el_right)

      if (is.null(pL)) stop("No se pudo renderizar left: ",  el_left$.element_type  %||% "<NA>", call. = FALSE)
      if (is.null(pR)) stop("No se pudo renderizar right: ", el_right$.element_type %||% "<NA>", call. = FALSE)

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

        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pL, bg = "transparent"), contract$slots$left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pR, bg = "transparent"), contract$slots$right)

        # BASE auto desde left si no se declara
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el_left,
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
        stop("slide_1_narrativo: `plot` debe ser `ppt_element`.", call. = FALSE)
      }

      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      p <- .render_element(el_plot)
      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        stop("slide_1_narrativo: no se pudo renderizar plot (", el_plot$.element_type %||% "<NA>", " | ", vv, ").", call. = FALSE)
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
          if (!is.null(tx) && nzchar(trimws(as.character(tx)[1]))) as.character(tx)[1] else " "
        }
        doc <- .ph_with_strict(doc, combined, contract$slots$text)

        doc <- .ph_with_strict(
          doc,
          rvg::dml(ggobj = p, bg = "transparent"),
          contract$slots$plot
        )

        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el          = el_plot,
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(as.character(base_txt)[1]))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)

        ft <- slots$footer %||% NULL
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) {
          ft <- .ppt_note_from(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL)
        }
        if (is.null(ft) || !nzchar(trimws(as.character(ft)[1]))) ft <- " "
        doc <- .ph_with_strict(doc, as.character(ft)[1], contract$slots$footer)
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

      if (!inherits(el_left, "ppt_element") || !inherits(el_right, "ppt_element")) {
        stop("slide_2_narrativo: `left` y `right` deben ser `ppt_element`.", call. = FALSE)
      }

      el_left  <- .inject_var_titulo(el_left)
      el_right <- .inject_var_titulo(el_right)
      pL <- .render_element(el_left)
      pR <- .render_element(el_right)

      if (is.null(pL)) stop("slide_2_narrativo: no se pudo renderizar left.",  call. = FALSE)
      if (is.null(pR)) stop("slide_2_narrativo: no se pudo renderizar right.", call. = FALSE)

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

        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pL, bg = "transparent"), contract$slots$left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pR, bg = "transparent"), contract$slots$right)

        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el          = el_left,
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

      if (!inherits(el_ul, "ppt_element")) stop("paneles_4: `up_left` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_ur, "ppt_element")) stop("paneles_4: `up_right` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_bl, "ppt_element")) stop("paneles_4: `bottom_left` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_br, "ppt_element")) stop("paneles_4: `bottom_right` debe ser `ppt_element`.", call. = FALSE)

      el_ul <- .inject_var_titulo(el_ul)
      el_ur <- .inject_var_titulo(el_ur)
      el_bl <- .inject_var_titulo(el_bl)
      el_br <- .inject_var_titulo(el_br)
      pUL <- .render_element(.inject_title_override(el_ul))
      pUR <- .render_element(.inject_title_override(el_ur))
      pBL <- .render_element(.inject_title_override(el_bl))
      pBR <- .render_element(.inject_title_override(el_br))

      if (is.null(pUL)) stop("paneles_4: no se pudo renderizar up_left.", call. = FALSE)
      if (is.null(pUR)) stop("paneles_4: no se pudo renderizar up_right.", call. = FALSE)
      if (is.null(pBL)) stop("paneles_4: no se pudo renderizar bottom_left.", call. = FALSE)
      if (is.null(pBR)) stop("paneles_4: no se pudo renderizar bottom_right.", call. = FALSE)

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

        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pUL, bg = "transparent"), contract$slots$up_left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pUR, bg = "transparent"), contract$slots$up_right)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pBL, bg = "transparent"), contract$slots$bottom_left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pBR, bg = "transparent"), contract$slots$bottom_right)

        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el          = el_ul,
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

      if (!inherits(el_ul, "ppt_element")) stop("poblacion_4: `up_left` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_ur, "ppt_element")) stop("poblacion_4: `up_right` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_bl, "ppt_element")) stop("poblacion_4: `bottom_left` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_br, "ppt_element")) stop("poblacion_4: `bottom_right` debe ser `ppt_element`.", call. = FALSE)

      el_ul <- .inject_var_titulo(el_ul)
      el_ur <- .inject_var_titulo(el_ur)
      el_bl <- .inject_var_titulo(el_bl)
      el_br <- .inject_var_titulo(el_br)
      pUL <- .render_element(.inject_title_override(el_ul))
      pUR <- .render_element(.inject_title_override(el_ur))
      pBL <- .render_element(.inject_title_override(el_bl))
      pBR <- .render_element(.inject_title_override(el_br))

      if (is.null(pUL)) stop("poblacion_4: no se pudo renderizar up_left (",      el_ul$.element_type %||% "<NA>", ").", call. = FALSE)
      if (is.null(pUR)) stop("poblacion_4: no se pudo renderizar up_right (",     el_ur$.element_type %||% "<NA>", ").", call. = FALSE)
      if (is.null(pBL)) stop("poblacion_4: no se pudo renderizar bottom_left (",  el_bl$.element_type %||% "<NA>", ").", call. = FALSE)
      if (is.null(pBR)) stop("poblacion_4: no se pudo renderizar bottom_right (", el_br$.element_type %||% "<NA>", ").", call. = FALSE)

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

        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pUL, bg = "transparent"), contract$slots$up_left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pUR, bg = "transparent"), contract$slots$up_right)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pBL, bg = "transparent"), contract$slots$bottom_left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pBR, bg = "transparent"), contract$slots$bottom_right)

        # icono central (body 2 = circulo central 1.9x1.9) — opcional
        el_icon <- slots$icon %||% NULL
        if (!is.null(el_icon)) {
          if (!inherits(el_icon, "ppt_element")) {
            stop("En `p_slide_4_graficos_poblacion()`, `icono` debe ser `ppt_element`.", call. = FALSE)
          }
          p_icon <- .render_element(el_icon)
          if (is.null(p_icon)) {
            stop("No se pudo renderizar `icono` en `p_slide_4_graficos_poblacion()`.", call. = FALSE)
          }
          doc <- .ph_with_strict(
            doc,
            rvg::dml(ggobj = p_icon, bg = "transparent"),
            contract$slots$icon
          )
        }

        # base (body 3 = pie de lamina)  -  opcional/auto
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el_ul,
            sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
            formato     = presets$base$args$formato %||% "Base: %s"
          )
        }
        if (is.null(base_txt) || !nzchar(trimws(base_txt))) base_txt <- " "
        doc <- .ph_with_strict(doc, as.character(base_txt)[1], contract$slots$base)
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
        stop("text_r: `plot` debe ser `ppt_element`.", call. = FALSE)
      }

      # render plot
      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      p <- .render_element(el_plot)
      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        stop("text_r: no se pudo renderizar plot (", el_plot$.element_type %||% "<NA>", " | ", vv, ").", call. = FALSE)
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
          rvg::dml(ggobj = p, bg = "transparent"),
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
        stop("text_l: `plot` debe ser `ppt_element`.", call. = FALSE)
      }

      if (isTRUE(mensajes_progreso)) {
        .msg_diapo(i, length(plan), stype, el_plot = el_plot, mensajes_progreso = mensajes_progreso)
        message("  • graficos a crear: 1")
      }

      p <- .render_element(el_plot)
      if (is.null(p)) {
        vv <- .element_var_label(el_plot) %||% "<sin vars>"
        stop("text_l: no se pudo renderizar plot (", el_plot$.element_type %||% "<NA>", " | ", vv, ").", call. = FALSE)
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
          rvg::dml(ggobj = p, bg = "transparent"),
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

      if (!inherits(el1, "ppt_element")) stop("text_r2: `plot1` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el2, "ppt_element")) stop("text_r2: `plot2` debe ser `ppt_element`.", call. = FALSE)

      p1 <- .render_element(el1)
      p2 <- .render_element(el2)

      if (is.null(p1)) stop("text_r2: no se pudo renderizar plot1.", call. = FALSE)
      if (is.null(p2)) stop("text_r2: no se pudo renderizar plot2.", call. = FALSE)

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
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = p1, bg = "transparent"), contract$slots$plot1)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = p2, bg = "transparent"), contract$slots$plot2)

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
          base_txt <- .base_auto_from_element(
            el         = el1,
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

      if (!inherits(el1, "ppt_element")) stop("text_l2: `plot1` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el2, "ppt_element")) stop("text_l2: `plot2` debe ser `ppt_element`.", call. = FALSE)

      p1 <- .render_element(el1)
      p2 <- .render_element(el2)

      if (is.null(p1)) stop("text_l2: no se pudo renderizar plot1.", call. = FALSE)
      if (is.null(p2)) stop("text_l2: no se pudo renderizar plot2.", call. = FALSE)

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
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = p1, bg = "transparent"), contract$slots$plot1)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = p2, bg = "transparent"), contract$slots$plot2)

        # base auto desde plot1
        base_txt <- slots$base %||% NULL
        if (is.null(base_txt)) {
          base_txt <- .base_auto_from_element(
            el         = el1,
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

      if (!inherits(el_left, "ppt_element"))  stop("poblacion_2: `left` debe ser `ppt_element`.", call. = FALSE)
      if (!inherits(el_right, "ppt_element")) stop("poblacion_2: `right` debe ser `ppt_element`.", call. = FALSE)

      pL <- .render_element(.inject_title_override(el_left))
      pR <- .render_element(.inject_title_override(el_right))

      if (is.null(pL)) stop("poblacion_2: no se pudo renderizar left.", call. = FALSE)
      if (is.null(pR)) stop("poblacion_2: no se pudo renderizar right.", call. = FALSE)

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

        # left y right: body 2 (izquierda) y body 3 (derecha)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pL, bg = "transparent"), contract$slots$left)
        doc <- .ph_with_strict(doc, rvg::dml(ggobj = pR, bg = "transparent"), contract$slots$right)

        # icono central (body 4 = circulo central 1.9x1.9) — opcional
        icon_val <- slots$icon %||% NULL
        if (!is.null(icon_val)) {
          if (!inherits(icon_val, "ppt_element")) {
            stop("En `p_slide_2_graficos_poblacion()`, `icono` debe ser `ppt_element`.", call. = FALSE)
          }
          p_icon <- .render_element(icon_val)
          if (is.null(p_icon)) {
            stop("No se pudo renderizar `icono` en `p_slide_2_graficos_poblacion()`.", call. = FALSE)
          }
          doc <- .ph_with_strict(
            doc,
            rvg::dml(ggobj = p_icon, bg = "transparent"),
            contract$slots$icon
          )
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
      for (i in 1:5) if (!inherits(pics[[i]], "ppt_element")) stop("poblacion_5: `pic", i, "` debe ser `ppt_element`.", call. = FALSE)

      plots <- lapply(pics, function(pic) .render_element(.inject_title_override(pic)))
      for (i in 1:5) if (is.null(plots[[i]])) stop("poblacion_5: no se pudo renderizar pic", i, ".", call. = FALSE)

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
            stop("En `p_slide_5_graficos_poblacion()`, `icono` debe ser `ppt_element`.", call. = FALSE)
          }
          p_icon <- .render_element(el_icon)
          if (is.null(p_icon)) {
            stop("No se pudo renderizar `icono` en `p_slide_5_graficos_poblacion()`.", call. = FALSE)
          }
          doc <- .ph_with_strict(
            doc,
            rvg::dml(ggobj = p_icon, bg = "transparent"),
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
            rvg::dml(ggobj = plots[[i]], bg = "transparent"),
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
      for (i in 1:6) if (!inherits(pics[[i]], "ppt_element")) stop("poblacion_6: `pic", i, "` debe ser `ppt_element`.", call. = FALSE)

      plots <- lapply(pics, function(pic) .render_element(.inject_title_override(pic)))
      for (i in 1:6) if (is.null(plots[[i]])) stop("poblacion_6: no se pudo renderizar pic", i, ".", call. = FALSE)

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
            stop("En `p_slide_6_graficos_poblacion()`, `icono` debe ser `ppt_element`.", call. = FALSE)
          }
          p_icon <- .render_element(el_icon)
          if (is.null(p_icon)) {
            stop("No se pudo renderizar `icono` en `p_slide_6_graficos_poblacion()`.", call. = FALSE)
          }
          doc <- .ph_with_strict(
            doc,
            rvg::dml(ggobj = p_icon, bg = "transparent"),
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
            rvg::dml(ggobj = plots[[i]], bg = "transparent"),
            contract$slots[[paste0("pic", i)]]
          )
        }
      }

      next
    }

    stop("Tipo de slide no implementado: ", stype, call. = FALSE)
  }

  log <- dplyr::bind_rows(log_rows)

  if (!isTRUE(solo_lista)) {
    print(doc, target = path_ppt)
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
#' `barras_numericas`, `boxplot`, `pie`, `donut`, `radar_tabla`, `dim_heatmap`,
#' `dim_radar` y `dim_foda`.
#'
#' Este helper refleja el contrato real que consume `reporte_ppt_plan()`, equivalente
#' a pasar manualmente una lista con sublistas `args`.
#'
#' @param base Lista de parametros por defecto para texto de base automatico.
#' @param barras_apiladas Lista de parametros por defecto para `graficar_barras_apiladas()`.
#' @param multi_apiladas Lista de parametros por defecto para `graficar_barras_apiladas()` en modo bloque.
#' @param barras_agrupadas Lista de parametros por defecto para `graficar_barras_agrupadas()`.
#' @param barras_numericas Lista de parametros por defecto para `graficar_barras_numericas()`.
#' @param boxplot Lista de parametros por defecto para `graficar_boxplot()`.
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
    barras_agrupadas = list(),
    barras_numericas = list(),
    boxplot          = list(),
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

  normalize_block <- function(x) {
    if (is.null(x)) return(list(args = list()))
    if (!is.list(x)) stop("Cada preset debe ser una lista.", call. = FALSE)
    if (!is.null(x$args)) {
      if (!is.list(x$args)) stop("`args` debe ser una lista.", call. = FALSE)
      return(x)
    }
    list(args = x)
  }

  if ((is.null(barras_numericas) || !length(barras_numericas)) && !is.null(numerico)) {
    barras_numericas <- numerico
  }

  out <- list(
    base             = normalize_block(base),
    barras_apiladas  = normalize_block(barras_apiladas),
    multi_apiladas   = normalize_block(multi_apiladas),
    barras_agrupadas = normalize_block(barras_agrupadas),
    barras_numericas = normalize_block(barras_numericas),
    boxplot          = normalize_block(boxplot),
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
