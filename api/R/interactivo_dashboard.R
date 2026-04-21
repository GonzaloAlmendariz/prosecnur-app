# =============================================================================
# Explorador interactivo: reporte_interactivo()
# - Helpers compartidos
# - Función exportada
# - Wiring UI/Server (delegación a tabs)
# =============================================================================

`%||%` <- function(x, y) if (!is.null(x)) x else y

# -----------------------------------------------------------------------------
# Helpers internos
# -----------------------------------------------------------------------------

.interactivo_limit_levels <- function(x, max_levels = 12L) {
  n <- if (is.data.frame(x)) {
    nrow(x)
  } else if (is.list(x)) {
    length(x)
  } else {
    length(x)
  }

  if (!is.finite(max_levels) || is.na(max_levels) || max_levels < 1L) {
    max_levels <- n
  }
  max_levels <- as.integer(max_levels)

  visible_n <- min(n, max_levels)
  visible <- if (n <= 0L) {
    if (is.data.frame(x)) x[0, , drop = FALSE] else x[0]
  } else if (is.data.frame(x)) {
    x[seq_len(visible_n), , drop = FALSE]
  } else if (is.list(x)) {
    x[seq_len(visible_n)]
  } else {
    x[seq_len(visible_n)]
  }

  list(
    all = x,
    visible = visible,
    total = as.integer(n),
    hidden_count = max(0L, as.integer(n - visible_n))
  )
}

.interactivo_resolve_filter_selection <- function(
    selected = character(0),
    valid_values = character(0),
    last_valid = character(0),
    fallback = c("all", "first", "none")
) {
  fallback <- match.arg(fallback)

  clean_chr <- function(x) {
    x <- as.character(x %||% character(0))
    x <- x[!is.na(x) & nzchar(trimws(x))]
    unique(x)
  }

  valid <- clean_chr(valid_values)
  if (!length(valid)) return(character(0))

  selected_clean <- intersect(clean_chr(selected), valid)
  if (length(selected_clean)) return(selected_clean)

  last_valid_clean <- intersect(clean_chr(last_valid), valid)
  if (length(last_valid_clean)) return(last_valid_clean)

  switch(
    fallback,
    all = valid,
    first = valid[1],
    none = character(0)
  )
}

.interactivo_has_cases_so <- function(df, var) {
  if (!is.data.frame(df) || !nrow(df) || !(var %in% names(df))) return(FALSE)

  x <- as.character(df[[var]])
  any(!is.na(x) & nzchar(trimws(x)) & x != "NA")
}

.interactivo_has_cases_dummy <- function(df, col_dummy) {
  if (!is.data.frame(df) || !nrow(df) || !(col_dummy %in% names(df))) return(FALSE)

  x <- df[[col_dummy]]
  x2 <- suppressWarnings(as.numeric(as.character(x)))
  if (all(is.na(x2)) && is.logical(x)) x2 <- as.numeric(x)

  any(!is.na(x2) & x2 %in% c(0, 1))
}

.interactivo_text_default <- function(x, default = "") {
  if (is.null(x) || is.function(x)) return(as.character(default)[1])

  x_chr <- as.character(x)
  if (!length(x_chr)) return(as.character(default)[1])

  val <- x_chr[1]
  if (is.na(val) || !nzchar(trimws(val))) return(as.character(default)[1])
  val
}

.interactivo_empty_hint_ui <- function(
    title = "Sin datos que mostrar",
    subtitle = NULL,
    extra_class = NULL
) {
  classes <- c("table-empty-hint", extra_class)
  classes <- classes[!is.na(classes) & nzchar(trimws(classes))]
  title_txt <- .interactivo_text_default(title, "Sin datos que mostrar")
  subtitle_txt <- .interactivo_text_default(subtitle, "")

  shiny::div(
    class = paste(classes, collapse = " "),
    shiny::div(class = "table-empty-title", title_txt),
    if (nzchar(subtitle_txt)) {
      shiny::div(class = "table-empty-subtitle", subtitle_txt)
    }
  )
}

.interactivo_empty_plotly <- function(
    title = "Sin datos para mostrar",
    subtitle = NULL,
    height = 84L
) {
  title_txt <- .interactivo_text_default(title, "Sin datos para mostrar")
  subtitle_txt <- .interactivo_text_default(subtitle, "")
  annotations <- list(
    list(
      x = 0.5,
      y = 0.60,
      xref = "paper",
      yref = "paper",
      text = paste0("<b>", title_txt, "</b>"),
      showarrow = FALSE,
      xanchor = "center",
      yanchor = "middle",
      align = "center",
      font = list(size = 12, color = "#002457")
    )
  )

  if (nzchar(subtitle_txt)) {
    annotations[[length(annotations) + 1L]] <- list(
      x = 0.5,
      y = 0.34,
      xref = "paper",
      yref = "paper",
      text = subtitle_txt,
      showarrow = FALSE,
      xanchor = "center",
      yanchor = "middle",
      align = "center",
      font = list(size = 10.5, color = "#5f6f8f")
    )
  }

  plotly::plot_ly(
    x = 0,
    y = 0,
    type = "scatter",
    mode = "markers",
    marker = list(size = 1, opacity = 0),
    hoverinfo = "skip",
    showlegend = FALSE,
    height = as.integer(height)
  ) |>
    plotly::layout(
      xaxis = list(visible = FALSE, fixedrange = TRUE),
      yaxis = list(visible = FALSE, fixedrange = TRUE),
      margin = list(l = 2, r = 2, t = 2, b = 2),
      paper_bgcolor = "rgba(255,255,255,0)",
      plot_bgcolor = "rgba(255,255,255,0)",
      shapes = list(
        list(
          type = "rect",
          xref = "paper",
          yref = "paper",
          x0 = 0.02,
          x1 = 0.98,
          y0 = 0.12,
          y1 = 0.88,
          line = list(color = "rgba(217,224,238,0.95)", width = 1, dash = "dot"),
          fillcolor = "rgba(247,250,255,0.98)",
          layer = "below"
        )
      ),
      annotations = annotations
    ) |>
    plotly::config(displayModeBar = FALSE, responsive = TRUE, staticPlot = TRUE)
}

.interactivo_has_var_or_dummies <- function(df, var) {
  if (!is.data.frame(df)) return(FALSE)
  if (var %in% names(df)) return(TRUE)
  var_esc <- gsub("([\\W])", "\\\\\\1", as.character(var)[1])
  any(grepl(paste0("^", var_esc, "[/\\.]"), names(df)))
}

.interactivo_tipo_pregunta <- function(var, survey = NULL, sm_vars_force = NULL, df = NULL) {
  var <- as.character(var)[1]
  if (is.na(var) || !nzchar(trimws(var))) return("so")

  if (!is.null(sm_vars_force) && var %in% sm_vars_force) return("sm")

  if (!is.null(survey) &&
      "name" %in% names(survey) &&
      "type" %in% names(survey) &&
      any(survey$name == var, na.rm = TRUE)) {

    mask <- !is.na(survey$name) & as.character(survey$name) == var
    tipos <- unique(na.omit(survey$type[mask]))
    tipos <- tolower(as.character(tipos))
    if (any(grepl("^select_multiple(\\s|$)", tipos))) return("sm")
    if (any(grepl("^select_one(\\s|$)", tipos))) return("so")
  }

  if (!is.null(df) && .interactivo_has_var_or_dummies(df, var) && !(var %in% names(df))) {
    return("sm")
  }

  "so"
}

.interactivo_resumen_build_rows <- function(
    sec,
    secciones_limpias,
    instrumento,
    data,
    sm_madres = NULL,
    max_so_rows = 16L,
    label_var = NULL,
    resolver_var_spec_fn = NULL
) {
  vars_sec <- secciones_limpias[[sec]] %||% character(0)
  if (!length(vars_sec)) return(list(section = sec, rows = list()))

  surv <- instrumento$survey %||% NULL
  if (!is.function(label_var)) {
    label_var <- function(var) .obtener_label_var(var, instrumento, data)
  }

  vars_so <- vars_sec[vapply(
    vars_sec,
    function(v) .interactivo_tipo_pregunta(v, survey = surv, sm_vars_force = sm_madres, df = data) == "so",
    logical(1)
  )]
  vars_sm <- vars_sec[vapply(
    vars_sec,
    function(v) .interactivo_tipo_pregunta(v, survey = surv, sm_vars_force = sm_madres, df = data) == "sm",
    logical(1)
  )]

  if (length(vars_so) > max_so_rows) vars_so <- vars_so[seq_len(max_so_rows)]
  vars_show <- c(vars_so, vars_sm)
  if (!length(vars_show)) return(list(section = sec, rows = list()))

  rows <- lapply(seq_along(vars_show), function(i) {
    var <- vars_show[i]
    tipo <- .interactivo_tipo_pregunta(var, survey = surv, sm_vars_force = sm_madres, df = data)
    row <- list(
      type = tipo,
      var = var,
      label = as.character(label_var(var)),
      slot_id = paste0("sum_plot_", i),
      options = list()
    )

    if (!identical(tipo, "sm")) return(row)
    if (!is.function(resolver_var_spec_fn)) return(row)

    spec <- resolver_var_spec_fn(var)
    cols <- as.character(spec$cols %||% character(0))
    if (!length(cols)) return(row)

    map_code_to_label <- spec$map_code_to_label %||% list()
    row$options <- lapply(seq_along(cols), function(j) {
      code <- sub(paste0("^", var, "\\."), "", cols[j])
      list(
        code = code,
        label = as.character(map_code_to_label[[code]] %||% code),
        col_dummy = cols[j],
        slot_id = paste0("sum_plot_", i, "_", j)
      )
    })

    row
  })

  list(section = sec, rows = rows)
}

.interactivo_iter_popover_ui <- function(
    ns = identity,
    select_id,
    current_label,
    current_meta = NULL,
    items = list(),
    selected = NULL,
    title = "Seleccionar nivel",
    note = NULL
) {
  selected_val <- as.character(selected %||% "")[1]

  if (!length(items)) {
    return(
      shiny::div(
        class = "rel-iter-level-control rel-iter-level-control-center",
        shiny::div(
          class = "rel-iter-level-chip",
          shiny::div(class = "rel-iter-level-name", current_label %||% "Sin niveles disponibles"),
          if (!is.null(current_meta) && nzchar(as.character(current_meta)[1])) {
            shiny::div(class = "rel-iter-level-meta", current_meta)
          }
        )
      )
    )
  }

  shiny::div(
    class = "rel-iter-level-control rel-iter-level-control-center iter-popover-wrap",
    shiny::tags$button(
      type = "button",
      class = "btn rel-iter-circle-btn iter-popover-toggle",
      title = title,
      `aria-expanded` = "false",
      `aria-haspopup` = "dialog",
      shiny::icon("list-ul")
    ),
    shiny::div(
      class = "rel-iter-level-chip",
      shiny::div(class = "rel-iter-level-name", current_label),
      if (!is.null(current_meta) && nzchar(as.character(current_meta)[1])) {
        shiny::div(class = "rel-iter-level-meta", current_meta)
      }
    ),
    shiny::div(
      class = "iter-level-popover",
      shiny::div(
        class = "iter-level-popover-header",
        shiny::div(class = "iter-level-popover-title", title),
        shiny::tags$button(
          type = "button",
          class = "iter-popover-close",
          `aria-label` = "Cerrar selector",
          "\u00d7"
        )
      ),
      shiny::div(
        class = "iter-level-popover-body",
        shiny::div(
          class = "iter-level-option-list",
          lapply(items, function(item) {
            value <- as.character(item$value %||% "")[1]
            label <- as.character(item$label %||% value)[1]
            meta <- as.character(item$meta %||% "")[1]
            item_classes <- c("iter-level-option")
            if (nzchar(selected_val) && identical(value, selected_val)) {
              item_classes <- c(item_classes, "is-active")
            }

            shiny::tags$button(
              type = "button",
              class = paste(item_classes, collapse = " "),
              `data-target-input` = ns(select_id),
              `data-value` = value,
              shiny::span(
                class = "iter-level-option-main",
                shiny::span(class = "iter-level-option-label", label),
                if (nzchar(meta)) shiny::span(class = "iter-level-option-meta", meta)
              )
            )
          })
        ),
        if (!is.null(note) && nzchar(as.character(note)[1])) {
          shiny::div(class = "iter-level-popover-note", note)
        }
      )
    )
  )
}

.interactivo_write_simple_xlsx <- function(path, data, sheet_name = "Datos") {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("Se requiere el paquete 'openxlsx' para exportar Excel.", call. = FALSE)
  }
  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame para exportar Excel.", call. = FALSE)
  }

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, sheetName = as.character(sheet_name)[1])
  openxlsx::writeData(wb, sheet = as.character(sheet_name)[1], x = data, withFilter = TRUE)
  if (ncol(data) > 0L) {
    openxlsx::setColWidths(wb, sheet = as.character(sheet_name)[1], cols = seq_len(ncol(data)), widths = "auto")
  }
  openxlsx::saveWorkbook(wb, file = path, overwrite = TRUE)
  invisible(path)
}

.interactivo_set_download_state <- function(session, output_id, enabled = TRUE) {
  ns <- session$ns
  if (!is.function(ns)) ns <- identity
  session$sendCustomMessage(
    type = "toggleDownloadDisabled",
    message = list(
      id = ns(output_id),
      disabled = !isTRUE(enabled)
    )
  )
  invisible(enabled)
}

.get_label_col_safe <- function(df) {
  if (is.null(df)) return(NULL)
  if ("label" %in% names(df)) return("label")
  lab_candidates <- grep("^label(::|$)", names(df), value = TRUE)
  if (length(lab_candidates)) return(lab_candidates[1])
  NULL
}

.get_list_name_safe <- function(survey, var) {
  if (is.null(survey) || !all(c("name", "list_name") %in% names(survey))) {
    return(NA_character_)
  }
  i <- which(!is.na(survey$name) & survey$name == var)[1]
  if (is.na(i)) return(NA_character_)

  ln <- as.character(survey$list_name[i])
  if (is.na(ln) || !nzchar(ln)) return(NA_character_)
  ln
}

.wrap_y <- function(x, width = 35) {
  x <- as.character(x)
  if (requireNamespace("stringr", quietly = TRUE)) {
    x <- stringr::str_wrap(x, width = width)
  }
  gsub("\n", "<br>", x, fixed = TRUE)
}

.resolver_paleta_var <- function(var,
                                 instrumento,
                                 colores_apiladas_por_listname,
                                 opcion_levels) {

  surv <- instrumento$survey
  pal  <- NULL

  if (!is.null(colores_apiladas_por_listname) &&
      !is.null(surv) &&
      all(c("name", "list_name") %in% names(surv))) {

    ln <- .get_list_name_safe(surv, var)
    if (!is.na(ln) && ln %in% names(colores_apiladas_por_listname)) {
      pal <- colores_apiladas_por_listname[[ln]]
    }
  }

  if (is.null(pal) || !length(pal)) {
    out <- grDevices::hcl.colors(max(3L, length(opcion_levels)), "Blues")
    out <- out[seq_len(length(opcion_levels))]
    names(out) <- opcion_levels
    return(out)
  }

  if (!is.null(names(pal)) && all(opcion_levels %in% names(pal))) {
    pal2 <- pal[opcion_levels]
    names(pal2) <- opcion_levels
    return(pal2)
  }

  fila <- surv[surv$name == var, , drop = FALSE]
  list_var <- if (nrow(fila)) fila$list_name[1] else NA_character_

  label_col <- .get_label_col_safe(instrumento$choices)

  if (!is.null(instrumento$choices) &&
      all(c("list_name", "name") %in% names(instrumento$choices)) &&
      !is.null(label_col) && label_col %in% names(instrumento$choices) &&
      !is.na(list_var) && nzchar(list_var) &&
      !is.null(names(pal))) {

    ch <- instrumento$choices[instrumento$choices$list_name == list_var, , drop = FALSE]
    map_code_to_label <- stats::setNames(
      as.character(ch[[label_col]]),
      as.character(ch$name)
    )

    idx <- names(pal) %in% names(map_code_to_label)
    if (any(idx)) {
      pal_lab <- stats::setNames(
        pal[idx],
        map_code_to_label[names(pal)[idx]]
      )

      if (!all(opcion_levels %in% names(pal_lab))) {
        falt <- setdiff(opcion_levels, names(pal_lab))
        extra <- grDevices::hcl.colors(max(3L, length(falt)), "Blues")
        extra <- extra[seq_len(length(falt))]
        pal_lab <- c(pal_lab, stats::setNames(extra, falt))
      }

      pal_lab <- pal_lab[opcion_levels]
      names(pal_lab) <- opcion_levels
      return(pal_lab)
    }
  }

  pal <- rep(pal, length.out = length(opcion_levels))
  names(pal) <- opcion_levels
  pal
}

.obtener_label_var <- function(var, instrumento, data = NULL) {

  var <- trimws(as.character(var)[1])
  surv <- instrumento$survey

  if (!is.null(surv) && "name" %in% names(surv)) {

    label_col <- .get_label_col_safe(surv)

    if (!is.null(label_col) && label_col %in% names(surv)) {
      nm <- trimws(as.character(surv$name))
      i  <- which(!is.na(nm) & nm == var)[1]

      if (!is.na(i)) {
        lab <- surv[[label_col]][i]
        if (!is.na(lab) && nzchar(trimws(as.character(lab)))) {
          return(as.character(lab))
        }
      }
    }
  }

  if (!is.null(data) && var %in% names(data)) {
    vl <- attr(data[[var]], "label", exact = TRUE)
    if (!is.null(vl) && nzchar(trimws(as.character(vl)))) {
      return(as.character(vl))
    }
  }

  var
}

.wrap_titulo_html <- function(txt, width = 120) {
  if (!requireNamespace("stringr", quietly = TRUE)) return(txt)
  txt <- as.character(txt)
  if (!nzchar(txt)) return(txt)
  lineas <- stringr::str_wrap(txt, width = width)
  paste(lineas, collapse = "<br>")
}

.anotar_porcentajes_enteros <- function(df_tab) {
  if (!requireNamespace("dplyr", quietly = TRUE)) {
    stop("Se requiere 'dplyr' para .anotar_porcentajes_enteros().", call. = FALSE)
  }

  df_tab$pct[is.na(df_tab$pct)] <- 0
  df_tab$pct[df_tab$pct < 0]    <- 0

  df_split <- split(df_tab, df_tab$estrato_label, drop = FALSE)

  df_list <- lapply(df_split, function(df_g) {
    total <- sum(df_g$pct, na.rm = TRUE)

    if (is.na(total) || total <= 0) {
      df_g$porc_raw <- 0
      df_g$porc_int <- 0L
      return(df_g)
    }

    pct_norm <- df_g$pct / total

    raw  <- pct_norm * 100
    base <- floor(raw + 1e-9)
    frac <- raw - base

    suma_base <- sum(base)
    rem       <- as.integer(round(100 - suma_base))

    if (rem > 0) {
      ord <- order(frac, decreasing = TRUE, na.last = NA)
      k   <- min(rem, length(ord))
      if (k > 0) base[ord[seq_len(k)]] <- base[ord[seq_len(k)]] + 1L
    } else if (rem < 0) {
      ord <- order(frac, decreasing = FALSE, na.last = NA)
      k   <- min(-rem, length(ord))
      if (k > 0) base[ord[seq_len(k)]] <- pmax(0L, base[ord[seq_len(k)]] - 1L)
    }

    df_g$porc_raw <- pct_norm
    df_g$porc_int <- base
    df_g
  })

  dplyr::bind_rows(df_list)
}

.preparar_tabla_proporciones <- function(data,
                                         instrumento,
                                         var,
                                         var_cruce = NULL,
                                         codigos_perdidos = NULL) {

  if (!requireNamespace("dplyr", quietly = TRUE)) {
    stop("Se requiere 'dplyr' para `reporte_interactivo()`.", call. = FALSE)
  }

  survey  <- instrumento$survey
  choices <- instrumento$choices %||% NULL
  label_col <- .get_label_col_safe(choices)

  if (is.null(survey) || !"name" %in% names(survey)) {
    stop("El `instrumento` debe contener `survey` válido.", call. = FALSE)
  }

  idx_var <- which(!is.na(survey$name) & as.character(survey$name) == var)[1]
  if (is.na(idx_var)) {
    stop("La variable '", var, "' no está en `instrumento$survey`.", call. = FALSE)
  }
  list_main <- as.character(survey$list_name[idx_var])

  if (!is.null(choices) &&
      all(c("list_name", "name") %in% names(choices)) &&
      !is.null(label_col) && label_col %in% names(choices) &&
      !is.na(list_main) && nzchar(list_main)) {

    ch_main      <- choices[choices$list_name == list_main, , drop = FALSE]
    codigos_main <- as.character(ch_main$name)
    labels_main  <- as.character(ch_main[[label_col]])
  } else {
    codigos_main <- sort(unique(as.character(data[[var]])))
    labels_main  <- codigos_main
  }

  map_main <- stats::setNames(labels_main, codigos_main)
  orden_lvls_main <- map_main[codigos_main]

  df <- data
  if (!var %in% names(df)) {
    stop("La variable '", var, "' no existe en `data`.", call. = FALSE)
  }

  df[[var]] <- as.character(df[[var]])
  df <- df[!is.na(df[[var]]), , drop = FALSE]

  if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0) {
    df <- df[!(df[[var]] %in% as.character(codigos_perdidos)), , drop = FALSE]
  }

  if (nrow(df) == 0L) {
    stop("No hay datos válidos para '", var, "'.", call. = FALSE)
  }

  if (is.null(var_cruce) || !nzchar(var_cruce)) {

    df_tab <- df |>
      dplyr::count(.data[[var]], name = "n") |>
      dplyr::mutate(
        pct           = n / sum(n),
        opcion_code   = as.character(.data[[var]]),
        opcion_label  = map_main[opcion_code] %||% opcion_code,
        estrato_label = ""
      ) |>
      dplyr::select(estrato_label, opcion_label, pct, n)

    df_tab$opcion_label <- factor(
      df_tab$opcion_label,
      levels = unique(orden_lvls_main[!is.na(orden_lvls_main)])
    )

    df_tab <- df_tab[order(df_tab$opcion_label), , drop = FALSE]
    return(df_tab)
  }

  if (!var_cruce %in% names(df)) {
    stop("Cruce '", var_cruce, "' no existe en `data`.", call. = FALSE)
  }

  df[[var_cruce]] <- as.character(df[[var_cruce]])

  fila_cruce <- survey[survey$name == var_cruce, , drop = FALSE]
  list_cruce <- if (nrow(fila_cruce)) fila_cruce$list_name[1] else NA_character_

  if (!is.null(choices) &&
      all(c("list_name", "name") %in% names(choices)) &&
      !is.null(label_col) && label_col %in% names(choices) &&
      !is.na(list_cruce) && nzchar(list_cruce)) {

    ch_cruce  <- choices[choices$list_name == list_cruce, , drop = FALSE]
    map_cruce <- stats::setNames(as.character(ch_cruce[[label_col]]), as.character(ch_cruce$name))
  } else {
    niveles_cruce <- sort(unique(df[[var_cruce]]))
    map_cruce     <- stats::setNames(niveles_cruce, niveles_cruce)
  }

  df_tab <- df |>
    dplyr::count(.data[[var_cruce]], .data[[var]], name = "n") |>
    dplyr::group_by(.data[[var_cruce]]) |>
    dplyr::mutate(pct = n / sum(n)) |>
    dplyr::ungroup() |>
    dplyr::mutate(
      opcion_code   = as.character(.data[[var]]),
      opcion_label  = map_main[opcion_code] %||% opcion_code,
      estrato_code  = as.character(.data[[var_cruce]]),
      estrato_label = map_cruce[estrato_code] %||% estrato_code
    ) |>
    dplyr::select(estrato_label, opcion_label, pct, n)

  df_tab$opcion_label  <- factor(
    df_tab$opcion_label,
    levels = unique(orden_lvls_main[!is.na(orden_lvls_main)])
  )
  df_tab$estrato_label <- factor(
    df_tab$estrato_label,
    levels = sort(unique(df_tab$estrato_label))
  )

  if (length(unique(df_tab$estrato_label)) == 1 &&
      unique(as.character(df_tab$estrato_label)) %in% c("Total", "TOTAL", "total")) {
    df_tab$estrato_label <- factor(rep("", nrow(df_tab)))
  }

  df_tab[order(df_tab$estrato_label, df_tab$opcion_label), , drop = FALSE]
}

.construir_tabla_resumen <- function(df_tab) {
  if (!requireNamespace("dplyr", quietly = TRUE)) {
    stop("Se requiere 'dplyr' para la tabla resumen.", call. = FALSE)
  }

  df_tab <- .anotar_porcentajes_enteros(df_tab)

  if (all(as.character(df_tab$estrato_label) %in% c("", NA))) {
    df_tab |>
      dplyr::arrange(opcion_label) |>
      dplyr::transmute(
        Respuesta  = as.character(.data$opcion_label),
        N          = .data$n,
        Porcentaje = paste0(.data$porc_int, "%")
      )
  } else {
    df_tab |>
      dplyr::arrange(estrato_label, opcion_label) |>
      dplyr::transmute(
        Estrato    = as.character(.data$estrato_label),
        Respuesta  = as.character(.data$opcion_label),
        N          = .data$n,
        Porcentaje = paste0(.data$porc_int, "%")
      )
  }
}

.construir_plotly_barras <- function(df_tab,
                                     titulo,
                                     var_paleta = NULL,
                                     instrumento = NULL,
                                     colores_apiladas_por_listname = NULL,
                                     paleta_colores = NULL,
                                     height = NULL,
                                     mostrar_leyenda = TRUE) {

  if (!requireNamespace("plotly", quietly = TRUE)) {
    stop("Se requiere 'plotly' para `reporte_interactivo()`.", call. = FALSE)
  }

  df_tab$pct[is.na(df_tab$pct)] <- 0
  df_tab$pct[df_tab$pct < 0]    <- 0
  df_tab$n[is.na(df_tab$n)]     <- 0

  df_tab <- .anotar_porcentajes_enteros(df_tab)

  df_tab$texto_pct      <- paste0(df_tab$porc_int, "%")
  df_tab$texto_pct_html <- paste0("<b>", df_tab$porc_int, "%</b>")

  opcion_levels  <- levels(df_tab$opcion_label) %||% unique(df_tab$opcion_label)
  estrato_levels <- levels(df_tab$estrato_label) %||% unique(df_tab$estrato_label)

  df_tab$opcion_label  <- factor(df_tab$opcion_label,  levels = opcion_levels)
  df_tab$estrato_label <- factor(df_tab$estrato_label, levels = estrato_levels)

  solo_total <- all(as.character(df_tab$estrato_label) %in% c("", NA))

  if (is.null(paleta_colores) || !length(paleta_colores)) {
    if (!is.null(var_paleta) && !is.null(instrumento)) {
      paleta_colores <- .resolver_paleta_var(
        var = var_paleta,
        instrumento = instrumento,
        colores_apiladas_por_listname = colores_apiladas_por_listname,
        opcion_levels = as.character(opcion_levels)
      )
    } else {
      paleta_colores <- grDevices::hcl.colors(max(3L, length(opcion_levels)), "Blues")
      paleta_colores <- paleta_colores[seq_len(length(opcion_levels))]
      names(paleta_colores) <- as.character(opcion_levels)
    }
  } else {
    if (is.null(names(paleta_colores))) {
      paleta_colores <- rep(paleta_colores, length.out = length(opcion_levels))
      names(paleta_colores) <- as.character(opcion_levels)
    } else if (!all(as.character(opcion_levels) %in% names(paleta_colores))) {
      falt <- setdiff(as.character(opcion_levels), names(paleta_colores))
      extra <- grDevices::hcl.colors(max(3L, length(falt)), "Blues")
      extra <- extra[seq_len(length(falt))]
      paleta_colores <- c(paleta_colores, stats::setNames(extra, falt))
    }
    paleta_colores <- paleta_colores[as.character(opcion_levels)]
    names(paleta_colores) <- as.character(opcion_levels)
  }

  n_estratos <- length(unique(df_tab$estrato_label))
  if (is.null(height)) height <- max(220, min(650, 160 + 60 * n_estratos))

  if (mostrar_leyenda) {
    titulo_margin_top <- 60
    margin_left       <- if (solo_total) 20 else 170
    margin_right      <- 25
    margin_bottom     <- 45
  } else {
    titulo_margin_top <- 35
    margin_left       <- if (solo_total) 20 else 120
    margin_right      <- 10
    margin_bottom     <- 25
  }

  p <- plotly::plot_ly(height = height)

  for (opt in as.character(opcion_levels)) {
    df_opt <- df_tab[df_tab$opcion_label == opt, , drop = FALSE]
    if (!nrow(df_opt)) next

    if (solo_total) {
      df_opt$hover_text <- sprintf("%s: %s<br>N: %s", opt, df_opt$texto_pct, df_opt$n)
    } else {
      df_opt$hover_text <- sprintf(
        "%s<br>%s: %s<br>N: %s",
        as.character(df_opt$estrato_label),
        opt,
        df_opt$texto_pct,
        df_opt$n
      )
    }

    df_opt$texto_in  <- paste0("<b>", df_opt$texto_pct, "</b>")

    p <- p |>
      plotly::add_bars(
        data             = df_opt,
        x                = ~pct,
        y                = ~estrato_label,
        name             = opt,
        orientation      = "h",
        text             = ~texto_in,
        textposition     = "inside",
        insidetextanchor = "middle",
        textfont         = list(color = "white", size = 11),
        customdata       = ~hover_text,
        hovertemplate    = "%{customdata}<extra></extra>",
        marker           = list(
          color = unname(paleta_colores[opt]),
          line  = list(width = 0)
        )
      )
  }

  p <- p |>
    plotly::layout(
      barmode = "stack",
      bargap  = 0.25,
      xaxis   = list(
        title          = "",
        range          = c(0, 1),
        showgrid       = FALSE,
        zeroline       = FALSE,
        showticklabels = FALSE,
        ticks          = ""
      ),
      yaxis   = list(
        title          = "",
        automargin     = !solo_total,
        showticklabels = !solo_total,
        showgrid       = FALSE,
        zeroline       = FALSE,
        ticks          = ""
      ),
      legend = list(
        orientation = "h",
        x = 0.5, xanchor = "center",
        y = -0.12
      ),
      margin = list(l = margin_left, r = margin_right, t = titulo_margin_top, b = margin_bottom),
      uniformtext = list(minsize = 10, mode = "hide"),
      hovermode  = "closest",
      showlegend = mostrar_leyenda,
      transition = list(duration = 450, easing = "cubic-in-out")
    ) |>
    plotly::config(displayModeBar = FALSE, responsive = TRUE)

  plotly::animation_opts(
    p,
    frame      = 600,
    transition = 450,
    easing     = "cubic-in-out",
    redraw     = TRUE
  )
}

.construir_kpi_halfdonut <- function(df,
                                     var_kpi,
                                     instrumento,
                                     colores_apiladas_por_listname,
                                     codigos_perdidos = NULL) {

  if (!requireNamespace("plotly", quietly = TRUE)) return(NULL)
  if (!var_kpi %in% names(df)) return(NULL)

  df_kpi <- df[!is.na(df[[var_kpi]]), , drop = FALSE]
  if (!nrow(df_kpi)) return(NULL)

  df_tab <- .preparar_tabla_proporciones(
    data             = df_kpi,
    instrumento      = instrumento,
    var              = var_kpi,
    var_cruce        = NULL,
    codigos_perdidos = codigos_perdidos
  )
  df_tab <- .anotar_porcentajes_enteros(df_tab)

  df_tab$opcion_label <- as.character(df_tab$opcion_label)
  df_tab <- df_tab[order(df_tab$opcion_label), , drop = FALSE]

  titulo_kpi <- .wrap_titulo_html(
    .obtener_label_var(var_kpi, instrumento, df_kpi),
    width = 45
  )

  opcion_levels <- as.character(df_tab$opcion_label)
  paleta <- .resolver_paleta_var(
    var = var_kpi,
    instrumento = instrumento,
    colores_apiladas_por_listname = colores_apiladas_por_listname,
    opcion_levels = opcion_levels
  )

  legend_df <- data.frame(
    label = opcion_levels,
    color = unname(paleta[opcion_levels]),
    stringsAsFactors = FALSE
  )

  p <- plotly::plot_ly(
    data   = df_tab,
    labels = ~opcion_label,
    values = ~porc_int,
    type   = "pie",
    hole   = 0.68,
    direction = "clockwise",
    rotation  = 180,
    sort      = FALSE,
    textinfo  = "none",
    marker    = list(colors = unname(paleta[as.character(df_tab$opcion_label)])),
    hovertemplate = "%{label}: %{value}%<extra></extra>"
  ) |>
    plotly::layout(
      title = NULL,
      showlegend = FALSE,
      margin = list(l = 10, r = 10, t = 10, b = 5),
      annotations = list(),
      transition = list(duration = 450, easing = "cubic-in-out")
    ) |>
    plotly::animation_opts(
      frame      = 600,
      transition = 450,
      easing     = "cubic-in-out",
      redraw     = TRUE
    ) |>
    plotly::config(displayModeBar = FALSE, responsive = TRUE)

  list(plot = p, legend = legend_df, title_html = titulo_kpi)
}

# =============================================================================
# Helper para variables select_multiple "madre" que en la data viven como dummies
# =============================================================================
resolver_var_spec <- function(var_madre, ctx, df = NULL) {

  `%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

  data <- df %||% ctx$data
  inst <- ctx$instrumento

  if (is.null(data) || !is.data.frame(data) || is.null(inst)) {
    return(list(
      var_madre = var_madre,
      cols = character(0),
      map_code_to_label = list(),
      list_name = NA_character_,
      col_compact = NA_character_
    ))
  }

  var_esc <- gsub("([\\W])", "\\\\\\1", var_madre)
  pat_dum <- paste0("^", var_esc, "(\\.|_recod\\.)")
  cols <- grep(pat_dum, names(data), value = TRUE)

  col_compact <- NA_character_
  cand1 <- paste0(var_madre, "_ORIG")
  if (cand1 %in% names(data)) {
    col_compact <- cand1
  } else if (var_madre %in% names(data)) {
    col_compact <- var_madre
  }

  surv <- inst$survey %||% NULL
  ch   <- inst$choices %||% NULL

  list_name <- NA_character_
  if (!is.null(surv) && all(c("name", "list_name") %in% names(surv))) {
    i <- which(!is.na(surv$name) & surv$name == var_madre)[1]
    if (!is.na(i)) {
      list_name <- as.character(surv$list_name[i])
      if (is.na(list_name) || !nzchar(list_name)) list_name <- NA_character_
    }
  }

  map_code_to_label <- NULL
  label_col <- .get_label_col_safe(ch)

  if (!is.null(ch) &&
      all(c("list_name", "name") %in% names(ch)) &&
      !is.null(label_col) && label_col %in% names(ch)) {

    if (!is.na(list_name) && nzchar(list_name)) {
      ch_v <- ch[ch$list_name == list_name, , drop = FALSE]
      if (nrow(ch_v)) {
        map_code_to_label <- stats::setNames(
          as.character(ch_v[[label_col]]),
          as.character(ch_v$name)
        )
      }
    }
  }

  if (is.null(map_code_to_label)) {
    cand_attr <- NULL
    if (!is.na(col_compact) && col_compact %in% names(data)) cand_attr <- col_compact
    if (is.null(cand_attr) && length(cols)) cand_attr <- cols[1]

    if (!is.null(cand_attr) && cand_attr %in% names(data)) {
      labs <- attr(data[[cand_attr]], "labels", exact = TRUE)
      if (!is.null(labs) && length(labs) > 0) {
        map_code_to_label <- stats::setNames(
          as.character(unname(labs)),
          as.character(names(labs))
        )
      }
    }
  }

  if (is.null(map_code_to_label)) map_code_to_label <- character(0)

  dummy_code <- function(x) {
    sub(paste0("^", var_esc, "(\\.|_recod\\.)"), "", x)
  }

  dummy_codes <- if (length(cols)) dummy_code(cols) else character(0)

  codes_order <- character(0)
  if (length(map_code_to_label) > 0) {
    codes_order <- as.character(names(map_code_to_label))
  }

  if (!length(codes_order) && !is.na(col_compact) && col_compact %in% names(data)) {
    x <- as.character(data[[col_compact]])
    x <- x[!is.na(x) & nzchar(x) & x != "NA"]
    if (length(x)) {
      vals <- unlist(strsplit(x, "\\s*;\\s*"), use.names = FALSE)
      vals <- trimws(vals)
      vals <- vals[!is.na(vals) & nzchar(vals) & vals != "NA"]
      codes_order <- unique(vals)
    }
  }

  if (!length(codes_order) && length(dummy_codes)) {
    codes_order <- unique(dummy_codes)
  }

  if (length(codes_order)) {
    suppressWarnings(num <- as.numeric(codes_order))
    if (!all(is.na(num))) {
      ord <- order(is.na(num), num, codes_order)
      codes_order <- codes_order[ord]
    } else {
      codes_order <- sort(codes_order)
    }
  }

  if (length(cols) && length(codes_order)) {
    ord_idx <- match(dummy_codes, codes_order)
    if (all(is.na(ord_idx))) {
      ord_idx <- seq_along(cols)
    } else {
      nf <- is.na(ord_idx)
      if (any(nf)) {
        base <- max(ord_idx, na.rm = TRUE)
        ord_idx[nf] <- base + seq_len(sum(nf))
      }
    }
    cols <- cols[order(ord_idx)]
  }

  if (length(dummy_codes)) {
    falt <- setdiff(dummy_codes, names(map_code_to_label))
    if (length(falt)) {
      extra <- stats::setNames(falt, falt)
      map_code_to_label <- c(map_code_to_label, extra)
    }
  }

  map_list <- as.list(map_code_to_label)

  list(
    var_madre = var_madre,
    cols = cols,
    map_code_to_label = map_list,
    list_name = list_name,
    col_compact = col_compact
  )
}

.plot_dummy_yesno <- function(x, label_opcion = NULL) {

  BAR_HEIGHT <- 64
  PCT_FSIZE  <- 13

  x <- x[!is.na(x)]
  if (!length(x)) {
    return(
      plotly::plot_ly(height = BAR_HEIGHT) |>
        plotly::layout(
          annotations = list(list(text = "Sin datos", showarrow = FALSE)),
          margin = list(l = 10, r = 10, t = 0, b = 0)
        ) |>
        plotly::config(displayModeBar = FALSE, responsive = TRUE)
    )
  }

  n_si <- sum(x == 1)
  n_no <- sum(x == 0)
  tot  <- n_si + n_no

  tab <- data.frame(
    resp = c("Sí", "No"),
    pct  = c(n_si, n_no) / tot
  )

  p <- plotly::plot_ly(height = BAR_HEIGHT) |>
    plotly::add_bars(
      data = tab,
      x = ~pct,
      y = I("Total"),
      orientation = "h",
      marker = list(
        color = c("#1B679D", "#E5ECF6"),
        line = list(width = 0)
      ),
      text = paste0("<b>", round(100 * tab$pct, 0), "%</b>"),
      textposition = "inside",
      insidetextanchor = "middle",
      textfont = list(color = "white", size = PCT_FSIZE),
      hoverinfo = "skip"
    ) |>
    plotly::layout(
      barmode = "stack",
      xaxis = list(range = c(0, 1), visible = FALSE),
      yaxis = list(visible = FALSE),
      margin = list(l = 10, r = 10, t = 0, b = 0),
      showlegend = FALSE
    ) |>
    plotly::config(displayModeBar = FALSE, responsive = TRUE)

  p
}

# -----------------------------------------------------------------------------
# Registry de pestañas
# -----------------------------------------------------------------------------

.make_tabs_registry <- function(ctx, tabs = c("resumen", "relacion", "base_datos", "dimensiones")) {

  registry <- list(

    resumen = list(
      ui = function(ctx) shiny::tabPanel(title = "Resumen", .ui_tab_resumen(ctx)),
      server = function(ctx, input, output, session) .server_tab_resumen(ctx, input, output, session)
    ),

    relacion = list(
      ui = function(ctx) shiny::tabPanel(title = "Relación", relacion_tab_ui("relacion")),
      server = function(ctx, input, output, session) {
        relacion_tab_server(
          id          = "relacion",
          data        = ctx$data,
          instrumento = ctx$instrumento,
          secciones   = ctx$secciones_limpias,
          vars_so     = ctx$so_vars %||% character(0),
          vars_sm_madres = ctx$sm_madres %||% character(0),
          colores_apiladas_por_listname = ctx$colores_apiladas_por_listname,
          codigos_perdidos = ctx$codigos_perdidos,
          weight_col = "peso",
          orders_list = ctx$instrumento$orders_list %||% NULL,
          labels_override = NULL,
          theme_app = ctx$theme_app
        )
      }
    ),

    base_datos = list(
      ui = function(ctx) shiny::tabPanel(title = "Base de datos", .ui_tab_base_datos(ctx)),
      server = function(ctx, input, output, session) .server_tab_base_datos(ctx, input, output, session)
    ),

    dimensiones = list(
      ui = function(ctx) shiny::tabPanel(title = "Dimensiones", .ui_tab_dimensiones(ctx)),
      server = function(ctx, input, output, session) .server_tab_dimensiones(ctx, input, output, session)
    )
  )

  if (!isTRUE(ctx$dimensiones_habilitado)) {
    registry$dimensiones <- NULL
  }

  tabs <- (tabs %||% c("resumen", "base_datos"))
  tabs <- tabs[tabs %in% names(registry)]
  if (!length(tabs)) stop("`tabs` no contiene pestañas válidas.", call. = FALSE)

  registry[tabs]
}

# -----------------------------------------------------------------------------
# Función exportada
# -----------------------------------------------------------------------------

#' Explorador interactivo de resultados (pestañas parametrizables)
#' @family interactivo
#' @export
#' @importFrom stats setNames
#' @importFrom dplyr n_distinct
reporte_interactivo <- function(
    data,
    instrumento,
    secciones,
    datos_dimensiones = NULL,
    rotulos_dimensiones = NULL,
    dimensiones_config = NULL,
    dimensiones_semaforo_cortes = NULL,
    dimensiones_semaforo_colores = NULL,
    fuente      = NULL,
    titulo      = "Explorador interactivo",
    colores_apiladas_por_listname = NULL,
    codigos_perdidos = NULL,
    facet_vars = NULL,
    id_unidad  = NULL,
    kpi_vars   = NULL,
    logo_png   = NULL,
    logo_alt   = "Logo",
    logo_height_px = 52,
    tabs = c("resumen", "relacion", "base_datos", "dimensiones"),
    theme_app  = NULL
) {

  if (!requireNamespace("shiny", quietly = TRUE) ||
      !requireNamespace("plotly", quietly = TRUE) ||
      !requireNamespace("dplyr",  quietly = TRUE) ||
      !requireNamespace("DT",     quietly = TRUE)) {
    stop("Se requieren 'shiny', 'plotly', 'dplyr' y 'DT' para `reporte_interactivo()`.", call. = FALSE)
  }

  if (!exists("reporte_interactivo_theme_css", mode = "function") ||
      !exists("reporte_interactivo_theme_js",  mode = "function")) {
    stop(
      "No se encontraron las funciones de tema visual. ",
      "Asegúrate de cargar también el archivo `reporte_interactivo_theme.R`.",
      call. = FALSE
    )
  }

  .norm_dim_sem_cortes <- function(x) {
    if (is.null(x)) return(NULL)
    cts <- suppressWarnings(as.numeric(x))
    cts <- cts[is.finite(cts)]
    if (length(cts) < 2L) {
      stop("`dimensiones_semaforo_cortes` debe tener al menos 2 valores numéricos.", call. = FALSE)
    }
    cts <- sort(unique(cts))[1:2]
    cts <- pmax(0, pmin(100, cts))
    if (length(cts) < 2L || cts[1] >= cts[2]) {
      stop("`dimensiones_semaforo_cortes` debe definir dos cortes válidos y crecientes.", call. = FALSE)
    }
    cts
  }

  .norm_dim_sem_colores <- function(x) {
    if (is.null(x)) return(NULL)
    cols <- as.character(x)
    nms <- names(cols %||% character(0))
    if (is.null(nms)) nms <- character(0)
    if (!all(c("rojo", "ambar", "verde") %in% nms)) {
      stop("`dimensiones_semaforo_colores` debe incluir nombres: rojo, ambar y verde.", call. = FALSE)
    }
    c(
      rojo = as.character(cols[["rojo"]]),
      ambar = as.character(cols[["ambar"]]),
      verde = as.character(cols[["verde"]])
    )
  }

  dim_sem_cortes_override <- .norm_dim_sem_cortes(dimensiones_semaforo_cortes)
  dim_sem_colores_override <- .norm_dim_sem_colores(dimensiones_semaforo_colores)

  tiene_labels <- any(vapply(names(data), function(v) {
    !is.null(attr(data[[v]], "label",  exact = TRUE)) ||
      !is.null(attr(data[[v]], "labels", exact = TRUE)) ||
      !is.null(attr(data[[v]], "measure", exact = TRUE))
  }, logical(1)))

  if (!inherits(data, "prosecnur_reporte_tbl") || !tiene_labels) {
    data <- reporte_data(
      data        = data,
      instrumento = instrumento
    )
  }

  survey <- instrumento$survey
  if (is.null(survey) || !"name" %in% names(survey)) {
    stop("El `instrumento` debe contener un `survey` válido.", call. = FALSE)
  }

  if (is.null(secciones) || !length(secciones)) {
    stop("`secciones` debe ser una lista nombrada con vectores de variables.", call. = FALSE)
  }

  .is_tecnica <- function(v, instrumento) {
    if (!nzchar(v)) return(TRUE)
    if (startsWith(v, "_")) return(TRUE)

    vf <- as.character(attr(data, "vars_fecha", exact = TRUE) %||% instrumento$vars_fecha %||% character(0))
    vh <- as.character(attr(data, "vars_hora", exact = TRUE) %||% instrumento$vars_hora %||% character(0))
    vd <- as.character(attr(data, "vars_datetime", exact = TRUE) %||% instrumento$vars_datetime %||% character(0))
    if (v %in% c(vf, vh, vd)) return(TRUE)

    if (!is.null(instrumento$survey) && all(c("name", "type") %in% names(instrumento$survey))) {
      fila <- instrumento$survey[instrumento$survey$name == v, , drop = FALSE]
      if (nrow(fila)) {
        tp <- tolower(as.character(fila$type[1]))
        if (tp %in% c("start", "end", "deviceid", "subscriberid", "simserial",
                      "phonenumber", "today", "username", "audit")) {
          return(TRUE)
        }
      }
    }

    FALSE
  }

  label_var <- function(v) .obtener_label_var(v, instrumento, data)

  vars_data_visibles <- setdiff(
    names(data),
    names(data)[vapply(names(data), .is_tecnica, logical(1), instrumento = instrumento)]
  )

  so_inst <- survey$name[grepl("^select_one\\b", tolower(survey$type))]
  sm_inst <- survey$name[grepl("^select_multiple\\b", tolower(survey$type))]

  so_vars <- intersect(so_inst, vars_data_visibles)

  sm_disponibles <- sm_inst[vapply(sm_inst, function(v) {
    patt <- paste0("^", v, "(\\.|_recod\\.|_otro$)")
    any(grepl(patt, vars_data_visibles))
  }, logical(1))]

  vars_diccionario_all <- sort(unique(c(so_vars, sm_disponibles)))

  sm_cols_map <- stats::setNames(vector("list", length(sm_disponibles)), sm_disponibles)
  for (v in sm_disponibles) {
    patt <- paste0("^", v, "(\\.|_recod\\.|_otro$)")
    sm_cols_map[[v]] <- grep(patt, vars_data_visibles, value = TRUE)
  }

  .to_labels_df <- function(df) {
    out <- df
    for (v in names(out)) {
      labs <- attr(out[[v]], "labels", exact = TRUE)
      if (!is.null(labs) && length(labs) > 0) {
        codes <- names(labs)
        lbls  <- unname(labs)

        x <- out[[v]]
        x_chr <- as.character(x)

        map_code_to_label <- stats::setNames(as.character(lbls), as.character(codes))
        x_lbl <- unname(map_code_to_label[x_chr])
        x_lbl[is.na(x_lbl) & !is.na(x_chr)] <- x_chr[is.na(x_lbl) & !is.na(x_chr)]
        out[[v]] <- x_lbl
      } else {
        out[[v]] <- out[[v]]
      }
    }
    out
  }

  kpi_vars <- (kpi_vars %||% character(0))
  kpi_vars <- unique(kpi_vars[kpi_vars %in% names(data)])
  if (length(kpi_vars) > 2L) kpi_vars <- kpi_vars[1:2]

  secciones_limpias <- lapply(secciones, function(vs) {

    keep <- vs[vs %in% names(data)]

    falt <- setdiff(vs, keep)
    if (length(falt)) {
      falt_sm <- falt[falt %in% names(sm_cols_map)]
      falt_sm <- falt_sm[vapply(falt_sm, function(v) length(sm_cols_map[[v]]) > 0, logical(1))]
      keep <- c(keep, falt_sm)
    }

    unique(keep)
  })

  secciones_limpias <- secciones_limpias[vapply(secciones_limpias, length, integer(1)) > 0]
  if (!length(secciones_limpias)) {
    stop("Ninguna sección de `secciones` tiene variables presentes en `data`.", call. = FALSE)
  }
  secciones_nombres <- names(secciones_limpias)

  facet_vars <- (facet_vars %||% character(0))
  facet_vars <- facet_vars[facet_vars %in% names(data)]
  facet_choices <- stats::setNames(facet_vars, vapply(facet_vars, label_var, character(1)))

  # ---------------------------------------------------------------------------
  # Contexto opcional: Tab Dimensiones (datos_idx + rn)
  # ---------------------------------------------------------------------------
  dimensiones_ctx <- NULL
  dimensiones_habilitado <- FALSE

  .deep_merge <- function(base, over) {
    if (is.null(over)) return(base)
    if (!is.list(base) || !is.list(over)) return(over)
    out <- base
    for (nm in names(over)) {
      if (nm %in% names(out) && is.list(out[[nm]]) && is.list(over[[nm]])) {
        out[[nm]] <- .deep_merge(out[[nm]], over[[nm]])
      } else {
        out[[nm]] <- over[[nm]]
      }
    }
    out
  }

  .as_named_chr <- function(x) {
    if (is.null(x)) return(stats::setNames(character(0), character(0)))
    v <- as.character(unlist(x, use.names = TRUE))
    n <- names(v)
    if (is.null(n)) return(stats::setNames(character(0), character(0)))
    ok <- !is.na(n) & nzchar(trimws(n)) & !is.na(v) & nzchar(trimws(v))
    stats::setNames(v[ok], n[ok])
  }

  .nm_get <- function(x, key) {
    key <- as.character(key %||% "")[1]
    if (!nzchar(key)) return(NULL)
    nms <- names(x)
    if (is.null(nms)) return(NULL)
    i <- match(key, nms)
    if (is.na(i)) return(NULL)
    as.character(x[i])[1]
  }

  .pretty_dim <- function(x) {
    x <- as.character(x %||% "")
    x <- gsub("^idx_", "", x)
    x <- gsub("^sub_", "", x)
    x <- gsub("^r100_", "", x)
    x <- gsub("[_\\.]+", " ", x)
    x <- trimws(x)
    if (!nzchar(x)) return("Variable")
    paste0(toupper(substring(x, 1, 1)), substring(x, 2))
  }

  .first_nonempty <- function(...) {
    vals <- list(...)
    for (vv in vals) {
      v <- as.character(vv %||% "")[1]
      if (!is.na(v) && nzchar(trimws(v))) return(trimws(v))
    }
    ""
  }

  .extract_rotulos_map <- function(rn_obj = NULL, valid_vars = character(0)) {
    out <- stats::setNames(character(0), character(0))

    if (is.data.frame(rn_obj) && nrow(rn_obj)) {
      nms <- names(rn_obj)
      low <- tolower(nms)
      pick_col <- function(cands) {
        idx <- which(low %in% cands)[1]
        if (is.na(idx)) NULL else nms[idx]
      }
      col_var <- pick_col(c("variable", "var", "name", "id", "codigo"))
      col_lab <- pick_col(c("etiqueta", "label", "titulo", "nombre", "dimension"))
      if (!is.null(col_var) && !is.null(col_lab)) {
        vars <- as.character(rn_obj[[col_var]])
        labs <- as.character(rn_obj[[col_lab]])
        ok <- !is.na(vars) & nzchar(trimws(vars)) & !is.na(labs) & nzchar(trimws(labs))
        if (any(ok)) out <- stats::setNames(labs[ok], vars[ok])
      }
    } else if (is.character(rn_obj) && length(rn_obj) && !is.null(names(rn_obj))) {
      vals <- as.character(rn_obj)
      nms <- names(rn_obj)
      ok <- !is.na(nms) & nzchar(trimws(nms)) & !is.na(vals) & nzchar(trimws(vals))
      if (any(ok)) out <- stats::setNames(vals[ok], nms[ok])
    }

    if (length(valid_vars)) {
      out <- out[names(out) %in% valid_vars]
    }
    out
  }

  .fallback_dim_cfg <- function() {
    list(
      version = 1L,
      catalog_general = list(),
      catalog_indicadores = list(),
      labels_indices = stats::setNames(character(0), character(0)),
      labels_subindices = stats::setNames(character(0), character(0)),
      labels_indicadores = stats::setNames(character(0), character(0)),
      semaforo = list(
        cortes = c(50, 75),
        colores = c(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B")
      ),
      visual = list(
        radar_min_ejes = 3L,
        incluir_total_default = TRUE,
        iteracion_habilitada_default = FALSE,
        max_categorias_principal = 8L,
        max_niveles_iteracion = 12L,
        paleta_radar = "okabe_ito"
      )
    )
  }

  datos_dim_ready <- datos_dimensiones
  if (is.data.frame(datos_dim_ready) && nrow(datos_dim_ready) && ncol(datos_dim_ready)) {

    tiene_labels_dim <- any(vapply(names(datos_dim_ready), function(v) {
      !is.null(attr(datos_dim_ready[[v]], "label", exact = TRUE)) ||
        !is.null(attr(datos_dim_ready[[v]], "labels", exact = TRUE)) ||
        !is.null(attr(datos_dim_ready[[v]], "measure", exact = TRUE))
    }, logical(1)))

    if (!inherits(datos_dim_ready, "prosecnur_reporte_tbl") || !tiene_labels_dim) {
      datos_dim_ready <- tryCatch(
        reporte_data(
          data = datos_dim_ready,
          instrumento = instrumento
        ),
        error = function(e) datos_dimensiones
      )
    }

    idx_vars <- grep("^idx_", names(datos_dim_ready), value = TRUE)
    idx_vars <- idx_vars[vapply(idx_vars, function(v) {
      any(is.finite(suppressWarnings(as.numeric(datos_dim_ready[[v]]))), na.rm = TRUE)
    }, logical(1))]

    if (length(idx_vars)) {
      catalogo_base <- data.frame(
        variable = idx_vars,
        etiqueta = idx_vars,
        seccion = "Dimensiones",
        orden = seq_along(idx_vars),
        stringsAsFactors = FALSE
      )

      for (i in seq_len(nrow(catalogo_base))) {
        v <- catalogo_base$variable[i]
        catalogo_base$etiqueta[i] <- .obtener_label_var(v, instrumento, data = datos_dim_ready)
      }

      if (!is.null(dimensiones_config) && !is.list(dimensiones_config)) {
        stop("`dimensiones_config` debe ser NULL o una lista.", call. = FALSE)
      }

      cfg_infer <- tryCatch(
        reporte_dimensiones_config(datos_dim_ready),
        error = function(e) NULL
      )
      cfg <- .deep_merge(.fallback_dim_cfg(), cfg_infer)
      cfg <- .deep_merge(cfg, dimensiones_config)
      if (!is.null(dim_sem_cortes_override)) cfg$semaforo$cortes <- dim_sem_cortes_override
      if (!is.null(dim_sem_colores_override)) cfg$semaforo$colores <- dim_sem_colores_override

      idx_meta <- attr(datos_dim_ready, "indices_meta", exact = TRUE)
      rec_meta <- attr(datos_dim_ready, "recodificacion_items_meta", exact = TRUE)
      meta_indices <- if (is.list(idx_meta) && is.list(idx_meta$indices)) idx_meta$indices else list()
      meta_subindices <- if (is.list(idx_meta) && is.list(idx_meta$subindices)) idx_meta$subindices else list()

      idx_key_to_var <- stats::setNames(
        vapply(meta_indices, function(x) as.character(x$salida %||% NA_character_)[1], character(1)),
        names(meta_indices)
      )
      idx_key_to_var <- idx_key_to_var[!is.na(idx_key_to_var) & nzchar(idx_key_to_var)]
      idx_var_to_key <- stats::setNames(names(idx_key_to_var), as.character(idx_key_to_var))

      sub_key_to_var <- stats::setNames(
        vapply(meta_subindices, function(x) as.character(x$salida %||% NA_character_)[1], character(1)),
        names(meta_subindices)
      )
      sub_key_to_var <- sub_key_to_var[!is.na(sub_key_to_var) & nzchar(sub_key_to_var)]
      sub_var_to_key <- stats::setNames(names(sub_key_to_var), as.character(sub_key_to_var))

      rec_out_to_src <- stats::setNames(character(0), character(0))
      if (is.list(rec_meta) && length(rec_meta)) {
        rec_df <- data.frame(
          src = names(rec_meta),
          out = vapply(rec_meta, function(x) as.character(x$variable_salida %||% NA_character_)[1], character(1)),
          stringsAsFactors = FALSE
        )
        rec_df <- rec_df[!is.na(rec_df$out) & nzchar(rec_df$out), , drop = FALSE]
        if (nrow(rec_df)) {
          rec_out_to_src <- stats::setNames(as.character(rec_df$src), as.character(rec_df$out))
        }
      }

      rot_map <- .extract_rotulos_map(rotulos_dimensiones, valid_vars = names(datos_dim_ready))
      lbl_idx_cfg <- .as_named_chr(cfg$labels_indices)
      lbl_sub_cfg <- .as_named_chr(cfg$labels_subindices)
      lbl_ind_cfg <- .as_named_chr(cfg$labels_indicadores)

      .var_attr_label <- function(v) {
        if (!(v %in% names(datos_dim_ready))) return("")
        lb <- attr(datos_dim_ready[[v]], "label", exact = TRUE)
        lb <- as.character(lb %||% "")
        lb <- gsub("\\s*\\[0-100\\]$", "", lb)
        if (nzchar(trimws(lb))) trimws(lb) else ""
      }

      .label_idx <- function(v, key = NULL) {
        kk <- as.character(key %||% .nm_get(idx_var_to_key, v) %||% "")
        .first_nonempty(
          .nm_get(lbl_idx_cfg, kk),
          .nm_get(lbl_idx_cfg, v),
          .nm_get(rot_map, v),
          if (nzchar(kk)) .pretty_dim(kk) else "",
          .var_attr_label(v),
          .pretty_dim(v)
        )
      }

      .label_sub <- function(v, key = NULL) {
        kk <- as.character(key %||% .nm_get(sub_var_to_key, v) %||% "")
        sub_etiq <- if (nzchar(kk) && kk %in% names(meta_subindices)) meta_subindices[[kk]]$etiqueta else NULL
        .first_nonempty(
          sub_etiq,
          .nm_get(lbl_sub_cfg, kk),
          .nm_get(lbl_sub_cfg, v),
          .nm_get(rot_map, v),
          if (nzchar(kk)) .pretty_dim(kk) else "",
          .var_attr_label(v),
          .pretty_dim(v)
        )
      }

      .label_ind <- function(v) {
        src <- as.character(.nm_get(rec_out_to_src, v) %||% "")
        .first_nonempty(
          .nm_get(lbl_ind_cfg, v),
          if (nzchar(src)) .nm_get(lbl_ind_cfg, src) else "",
          .nm_get(rot_map, v),
          .var_attr_label(v),
          if (nzchar(src)) .pretty_dim(src) else "",
          .pretty_dim(v)
        )
      }

      catalog_general <- cfg$catalog_general %||% list()
      catalog_indicadores <- cfg$catalog_indicadores %||% list()

      if (!length(catalog_general)) {
        for (nm in names(meta_indices)) {
          it <- meta_indices[[nm]]
          idx_var <- as.character(it$salida %||% NA_character_)[1]
          if (is.na(idx_var) || !nzchar(idx_var) || !(idx_var %in% names(datos_dim_ready))) next

          refs <- unique(c(
            as.character(it$refs_resueltas %||% character(0)),
            as.character(it$refs %||% character(0))
          ))
          axis_vars <- character(0)
          for (r in refs) {
            rv <- if (r %in% names(datos_dim_ready)) {
              r
            } else if (r %in% names(sub_key_to_var)) {
              as.character(sub_key_to_var[[r]])
            } else {
              NA_character_
            }
            if (!is.na(rv) && nzchar(rv) && rv %in% names(datos_dim_ready) && !(rv %in% axis_vars)) {
              axis_vars <- c(axis_vars, rv)
            }
          }
          if (!length(axis_vars)) next
          catalog_general[[idx_var]] <- list(
            id = idx_var,
            key = nm,
            label = .label_idx(idx_var, nm),
            axis_vars = axis_vars,
            axis_labels = vapply(axis_vars, .label_sub, character(1))
          )
        }
      } else {
        for (nm in names(catalog_general)) {
          it <- catalog_general[[nm]]
          idx_var <- as.character(it$id %||% nm)[1]
          key <- as.character(it$key %||% .nm_get(idx_var_to_key, idx_var) %||% nm)[1]
          axis_vars <- as.character(it$axis_vars %||% character(0))
          axis_vars <- axis_vars[axis_vars %in% names(datos_dim_ready)]
          if (!length(axis_vars) && key %in% names(meta_indices)) {
            mt <- meta_indices[[key]]
            refs <- unique(c(
              as.character(mt$refs_resueltas %||% character(0)),
              as.character(mt$refs %||% character(0))
            ))
            for (r in refs) {
              rv <- if (r %in% names(datos_dim_ready)) {
                r
              } else if (r %in% names(sub_key_to_var)) {
                as.character(sub_key_to_var[[r]])
              } else {
                NA_character_
              }
              if (!is.na(rv) && nzchar(rv) && rv %in% names(datos_dim_ready) && !(rv %in% axis_vars)) {
                axis_vars <- c(axis_vars, rv)
              }
            }
          }
          if (!length(axis_vars) || !(idx_var %in% names(datos_dim_ready))) next
          catalog_general[[nm]] <- list(
            id = idx_var,
            key = key,
            label = .label_idx(idx_var, key),
            axis_vars = axis_vars,
            axis_labels = vapply(axis_vars, .label_sub, character(1))
          )
        }
        catalog_general <- catalog_general[lengths(catalog_general) > 0L]
      }

      if (!length(catalog_indicadores)) {
        for (bk in names(meta_subindices)) {
          bl <- meta_subindices[[bk]]
          bvar <- as.character(bl$salida %||% NA_character_)[1]
          vars <- unique(as.character(bl$vars %||% character(0)))
          vars <- vars[vars %in% names(datos_dim_ready)]
          if (!length(vars)) next
          catalog_indicadores[[bk]] <- list(
            id = bk,
            key = bk,
            label = .label_sub(bvar, bk),
            block_var = bvar,
            axis_vars = vars,
            axis_labels = vapply(vars, .label_ind, character(1))
          )
        }
      } else {
        for (nm in names(catalog_indicadores)) {
          it <- catalog_indicadores[[nm]]
          key <- as.character(it$key %||% it$id %||% nm)[1]
          bvar <- as.character(it$block_var %||% .nm_get(sub_key_to_var, key) %||% NA_character_)[1]
          vars <- as.character(it$axis_vars %||% character(0))
          vars <- vars[vars %in% names(datos_dim_ready)]
          if (!length(vars) && key %in% names(meta_subindices)) {
            vars <- unique(as.character(meta_subindices[[key]]$vars %||% character(0)))
            vars <- vars[vars %in% names(datos_dim_ready)]
          }
          if (!length(vars)) next
          catalog_indicadores[[nm]] <- list(
            id = key,
            key = key,
            label = .label_sub(bvar, key),
            block_var = bvar,
            axis_vars = vars,
            axis_labels = vapply(vars, .label_ind, character(1))
          )
        }
        catalog_indicadores <- catalog_indicadores[lengths(catalog_indicadores) > 0L]
      }

      lbl_idx_out <- lbl_idx_cfg
      for (v in intersect(idx_vars, names(datos_dim_ready))) {
        kk <- as.character(.nm_get(idx_var_to_key, v) %||% "")
        lab <- .label_idx(v, kk)
        lbl_idx_out[v] <- lab
        if (nzchar(kk)) lbl_idx_out[kk] <- lab
      }

      lbl_sub_out <- lbl_sub_cfg
      for (v in unique(c(names(sub_var_to_key), unname(sub_key_to_var)))) {
        if (!nzchar(v)) next
        kk <- as.character(.nm_get(sub_var_to_key, v) %||% "")
        lab <- .label_sub(v, kk)
        lbl_sub_out[v] <- lab
        if (nzchar(kk)) lbl_sub_out[kk] <- lab
      }

      lbl_ind_out <- lbl_ind_cfg
      ind_vars <- grep("^r100_", names(datos_dim_ready), value = TRUE)
      for (v in ind_vars) {
        lbl_ind_out[v] <- .label_ind(v)
      }

      cfg$catalog_general <- catalog_general
      cfg$catalog_indicadores <- catalog_indicadores
      cfg$labels_indices <- lbl_idx_out
      cfg$labels_subindices <- lbl_sub_out
      cfg$labels_indicadores <- lbl_ind_out

      sem_c <- suppressWarnings(as.numeric(cfg$semaforo$cortes %||% c(50, 75)))
      sem_c <- sem_c[is.finite(sem_c)]
      if (length(sem_c) < 2L) sem_c <- c(50, 75)
      sem_c <- sort(unique(sem_c))[1:2]
      sem_c <- pmax(0, pmin(100, sem_c))
      if (length(sem_c) < 2L || sem_c[1] >= sem_c[2]) sem_c <- c(50, 75)

      sem_cols <- as.character(cfg$semaforo$colores %||% character(0))
      nms_sem <- names(sem_cols %||% character(0))
      if (is.null(nms_sem)) nms_sem <- character(0)
      cfg$semaforo <- list(
        cortes = sem_c,
        colores = c(
          rojo = if ("rojo" %in% nms_sem) sem_cols[["rojo"]] else "#D84B55",
          ambar = if ("ambar" %in% nms_sem) sem_cols[["ambar"]] else "#E0B44C",
          verde = if ("verde" %in% nms_sem) sem_cols[["verde"]] else "#3A9A5B"
        )
      )

      vis <- cfg$visual %||% list()
      vis$radar_min_ejes <- as.integer(suppressWarnings(vis$radar_min_ejes)[1] %||% 3L)
      if (!is.finite(vis$radar_min_ejes) || is.na(vis$radar_min_ejes) || vis$radar_min_ejes < 1L) vis$radar_min_ejes <- 3L

      vis$max_categorias_principal <- as.integer(suppressWarnings(vis$max_categorias_principal)[1] %||% 8L)
      if (!is.finite(vis$max_categorias_principal) || is.na(vis$max_categorias_principal) || vis$max_categorias_principal < 1L) {
        vis$max_categorias_principal <- 8L
      }

      vis$max_niveles_iteracion <- as.integer(suppressWarnings(vis$max_niveles_iteracion)[1] %||% 12L)
      if (!is.finite(vis$max_niveles_iteracion) || is.na(vis$max_niveles_iteracion) || vis$max_niveles_iteracion < 1L) {
        vis$max_niveles_iteracion <- 12L
      }

      vis$incluir_total_default <- isTRUE(vis$incluir_total_default)
      vis$iteracion_habilitada_default <- isTRUE(vis$iteracion_habilitada_default)
      vis$paleta_radar <- as.character(vis$paleta_radar %||% "okabe_ito")[1]
      if (!vis$paleta_radar %in% c("okabe_ito", "ipe")) vis$paleta_radar <- "okabe_ito"
      cfg$visual <- vis

      catalogo_dim <- catalogo_base
      if (length(catalog_general)) {
        cg_df <- data.frame(
          variable = vapply(catalog_general, function(x) as.character(x$id %||% NA_character_)[1], character(1)),
          etiqueta = vapply(catalog_general, function(x) as.character(x$label %||% x$id %||% ""), character(1)),
          seccion = "Índices",
          orden = seq_along(catalog_general),
          stringsAsFactors = FALSE
        )
        cg_df <- cg_df[!is.na(cg_df$variable) & cg_df$variable %in% idx_vars, , drop = FALSE]
        if (nrow(cg_df)) catalogo_dim <- cg_df
      }

      vars_filtro <- facet_vars[facet_vars %in% names(datos_dim_ready)]
      if (!length(vars_filtro)) {
        so_inst_dim <- survey$name[grepl("^select_one\\b", tolower(survey$type))]
        vars_filtro <- intersect(so_inst_dim, names(datos_dim_ready))
      }
      filtro_choices_dim <- stats::setNames(vars_filtro, vapply(vars_filtro, function(v) {
        .obtener_label_var(v, instrumento, datos_dim_ready)
      }, character(1)))

      weight_dim <- attr(datos_dim_ready, "var_peso", exact = TRUE)
      if (is.null(weight_dim) || !nzchar(as.character(weight_dim)) || !(weight_dim %in% names(datos_dim_ready))) {
        weight_dim <- if ("peso" %in% names(datos_dim_ready)) "peso" else NA_character_
      }

      dimensiones_ctx <- list(
        habilitado = TRUE,
        data = datos_dim_ready,
        catalogo = catalogo_dim,
        secciones = unique(as.character(catalogo_dim$seccion)),
        filtro_choices = filtro_choices_dim,
        segment_choices = filtro_choices_dim,
        weight_col = weight_dim,
        config = cfg
      )
      dimensiones_habilitado <- TRUE
    }
  }

  logo_src <- NULL
  if (!is.null(logo_png) && nzchar(logo_png)) {
    logo_src <- sub("^www/", "", logo_png)
  }

  ctx <- list(
    data = data,
    instrumento = instrumento,
    secciones_limpias = secciones_limpias,
    secciones_nombres = secciones_nombres,
    facet_choices = facet_choices,
    vars_data_visibles = vars_data_visibles,
    vars_diccionario_all = vars_diccionario_all,
    sm_cols_map = sm_cols_map,
    .to_labels_df = .to_labels_df,
    label_var = label_var,
    codigos_perdidos = codigos_perdidos,
    colores_apiladas_por_listname = colores_apiladas_por_listname,
    id_unidad = id_unidad,
    kpi_vars = kpi_vars,
    so_vars   = so_vars,
    sm_madres = sm_disponibles,
    theme_app = theme_app,
    dimensiones = dimensiones_ctx,
    dimensiones_habilitado = dimensiones_habilitado
  )

  tabs_registry <- .make_tabs_registry(ctx, tabs = tabs)

  ui <- shiny::fluidPage(

    shiny::tags$head(
      reporte_interactivo_theme_css(theme_app = theme_app),
      reporte_interactivo_theme_js()
    ),

    shiny::div(
      class = "topbar",
      shiny::div(class = "topbar-title", titulo),
      if (!is.null(logo_src)) shiny::tags$img(
        src   = logo_src,
        alt   = logo_alt,
        class = "topbar-logo",
        style = paste0("height:", as.integer(logo_height_px), "px;")
      )
    ),

    do.call(
      shiny::navbarPage,
      c(
        list(title = NULL, id = "tabs_main"),
        unname(lapply(tabs_registry, function(def) def$ui(ctx)))
      )
    )
  )

  server <- function(input, output, session) {
    for (nm in names(tabs_registry)) {
      tabs_registry[[nm]]$server(ctx, input, output, session)
    }
  }

  shiny::shinyApp(ui = ui, server = server)
}
