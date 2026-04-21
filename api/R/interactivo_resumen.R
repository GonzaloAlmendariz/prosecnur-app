# =============================================================================
# Tab 1: Resumen (UI + server) — v3.9 debug KPI + color fix
# -----------------------------------------------------------------------------
# - Títulos/subtítulos y % externo SM usan color_primario
# - Texto del nombre de cada opción SM usa color_texto
# - SM 0% no muestra etiqueta
# - Logs ampliados para rastrear por qué no se construyen los KPI
# =============================================================================
#' @keywords internal
#' @noRd

.ui_tab_resumen <- function(ctx) {

  shiny::sidebarLayout(
    shiny::sidebarPanel(
      width = 3,
      class = "sidebar-panel-base",
      shiny::div(
        class = "sidebar-stack",
        shiny::div(
          class = "sidebar-module sidebar-module-rel",
          shiny::h3(class = "sidebar-module-title", "Resumen"),
          shiny::p(
            class = "sidebar-module-help",
            "Selecciona sección y aplica filtros para analizar resultados."
          ),
          shiny::div(
            class = "cardbox",
            shiny::div(
              class = "cardbox-header",
              shiny::div(class = "cardbox-title", "Perfil de la muestra")
            ),
            shiny::uiOutput("kpi_panel")
          ),
          shiny::div(
            class = "sidebar-module-card rel-sidebar-card-gap",
            shiny::div(
              class = "rel-iter-head",
              shiny::div(class = "sidebar-subtitle rel-iter-head-title", "Filtros"),
              shiny::tags$label(
                class = "switch rel-iter-head-switch",
                shiny::tags$input(id = "filtros_enabled", type = "checkbox"),
                shiny::tags$span(class = "slider")
              )
            ),
            shiny::conditionalPanel(
              condition = "input['filtros_enabled']",
              shiny::uiOutput("filtro_rows_ui"),
              shiny::uiOutput("filtro_activos_ui"),
              shiny::div(
                class = "sidebar-quick-actions",
                shiny::actionButton(
                  inputId = "filtro_agregar",
                  label   = "Agregar filtro",
                  class = "sidebar-quick-btn"
                ),
                shiny::actionButton(
                  inputId = "limpiar_filtros",
                  label   = "Restablecer filtros",
                  class = "sidebar-quick-btn"
                )
              ),
              shiny::uiOutput("filtro_rows_hint_ui")
            )
          ),
          shiny::div(style = "height: 24px;")
        ),
      )
    ),

    shiny::mainPanel(
      width = 9,

      shiny::fluidRow(
        shiny::column(
          width = 12,
          shiny::div(
            class = "cardbox",
            shiny::div(
              class = "cardbox-header",
              shiny::div(
                class = "cardbox-title section-title-inline",
                shiny::span(class = "section-title-prefix", "Resumen de sección:"),
                shiny::div(
                  class = "section-title-select",
                  shiny::selectizeInput(
                    inputId = "seccion",
                    label = NULL,
                    choices = stats::setNames(ctx$secciones_nombres, ctx$secciones_nombres),
                    selected = ctx$secciones_nombres[1],
                    options = list(dropdownParent = "body")
                  )
                )
              )
            ),
            shiny::uiOutput("section_summary_ui")
          )
        )
      ),

      shiny::div(style = "height: 48px;")
    )
  )
}

#' @keywords internal
#' @noRd
.server_tab_resumen <- function(ctx, input, output, session) {

  data        <- ctx$data
  instrumento <- ctx$instrumento

  MAX_SO_ROWS <- 16L
  BAR_HEIGHT  <- 64
  PCT_FSIZE   <- 13

  `%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

  # ---------------------------------------------------------------------------
  # LOG helper
  # ---------------------------------------------------------------------------
  debug_resumen <- isTRUE(getOption("prosecnur.debug.tab_resumen", FALSE))
  .log_resumen <- function(...) {
    if (!debug_resumen) return(invisible(NULL))
    msg <- paste(..., collapse = "")
    message("[tab_resumen] ", msg)
  }

  .safe_chr <- function(x, max_n = 80) {
    if (is.null(x)) return("NULL")
    x <- as.character(x)
    if (!length(x)) return("")
    if (length(x) > max_n) {
      x <- c(x[seq_len(max_n)], paste0("...(+", length(x) - max_n, " más)"))
    }
    paste(x, collapse = ", ")
  }

  # ---------------------------------------------------------------------------
  # Tema visual
  # ---------------------------------------------------------------------------
  theme_default <- if (exists("reporte_interactivo_theme_default", mode = "function")) {
    reporte_interactivo_theme_default()
  } else {
    list(
      color_primario      = "#002457",
      color_fondo_app     = "#f5f6fa",
      color_borde         = "#e6e9f2",
      color_texto         = "#1f2933",
      color_texto_suave   = "#5f6b7a",
      color_superficie    = "#ffffff",
      color_superficie_2  = "#fafbff",
      color_header_tabla  = "#f1f3f9"
    )
  }

  theme_app <- theme_default
  if (!is.null(ctx$theme_app) && is.list(ctx$theme_app)) {
    nm <- intersect(names(ctx$theme_app), names(theme_app))
    if (length(nm)) theme_app[nm] <- ctx$theme_app[nm]
  }

  # Reglas visuales pedidas:
  # - barras SM: color_primario
  # - % externo SM: color_primario
  # - títulos/subtítulos: color_primario
  # - nombre de cada opción SM: color_texto
  SM_COLOR_YES        <- theme_app$color_primario
  SM_COLOR_BG         <- theme_app$color_superficie_2
  SM_TEXT_OUT         <- theme_app$color_primario
  SM_SUBTITLE         <- theme_app$color_primario
  SM_OPTION_TEXT      <- theme_app$color_texto
  MSG_COLOR           <- theme_app$color_texto_suave

  .log_resumen(
    "Theme -> primario=", SM_COLOR_YES,
    " | bg_sm=", SM_COLOR_BG,
    " | texto_out=", SM_TEXT_OUT,
    " | sm_option_text=", SM_OPTION_TEXT
  )

  # ---------------------------------------------------------------------------
  # Helpers locales
  # ---------------------------------------------------------------------------
  .wrap_titulo_html <- get0(
    ".wrap_titulo_html",
    ifnotfound = function(txt, width = 110) {
      if (!requireNamespace("stringr", quietly = TRUE)) return(as.character(txt))
      if (is.null(txt)) return("")
      lineas <- stringr::str_wrap(as.character(txt), width = width)
      paste(lineas, collapse = "<br>")
    }
  )

  .get_label_col_safe_local <- function(df) {
    if (is.null(df)) return(NULL)
    if ("label" %in% names(df)) return("label")
    lab_candidates <- grep("^label(::|$)", names(df), value = TRUE)
    if (length(lab_candidates)) return(lab_candidates[1])
    NULL
  }

  .obtener_label_var <- get0(
    ".obtener_label_var",
    ifnotfound = function(var, instrumento, data = NULL) {
      var <- trimws(as.character(var)[1])
      surv <- instrumento$survey

      if (!is.null(surv) && "name" %in% names(surv)) {
        label_col <- .get_label_col_safe_local(surv)
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
        if (!is.null(vl) && nzchar(as.character(vl))) return(as.character(vl))
      }

      as.character(var)
    }
  )

  .get_choice_label_col <- function(ch) {
    if (is.null(ch)) return(NULL)
    if ("label" %in% names(ch)) return("label")
    lab_candidates <- grep("^label(::|$)", names(ch), value = TRUE)
    if (length(lab_candidates)) return(lab_candidates[1])
    NULL
  }

  .resolver_paleta_var_safe <- function(var, opcion_levels) {
    f <- get0(".resolver_paleta_var", mode = "function", ifnotfound = NULL)
    if (is.null(f)) {
      f <- get0("resolver_paleta_var", mode = "function", ifnotfound = NULL)
    }

    .log_resumen(
      "Paleta -> var=", var,
      " | helper=", if (is.null(f)) "NO" else "SI",
      " | niveles=", .safe_chr(opcion_levels)
    )

    if (!is.null(f)) {
      pal <- tryCatch(
        f(
          var = var,
          instrumento = instrumento,
          colores_apiladas_por_listname = ctx$colores_apiladas_por_listname,
          opcion_levels = opcion_levels
        ),
        error = function(e) {
          .log_resumen("Paleta ERROR en var=", var, " -> ", conditionMessage(e))
          NULL
        }
      )
      if (!is.null(pal) && length(pal)) {
        .log_resumen("Paleta OK var=", var, " -> ", .safe_chr(paste(names(pal), pal, sep = "=")))
        return(pal)
      }
    }

    out <- grDevices::hcl.colors(max(3L, length(opcion_levels)), "Blues")
    out <- out[seq_len(length(opcion_levels))]
    names(out) <- opcion_levels
    .log_resumen("Paleta fallback var=", var, " -> ", .safe_chr(paste(names(out), out, sep = "=")))
    out
  }

  .preparar_tabla_kpi_safe <- function(df, var, codigos_perdidos = NULL) {

    .log_resumen("KPI prep -> var=", var)

    if (!var %in% names(df)) {
      .log_resumen("KPI prep FAIL -> var no existe en df: ", var)
      return(NULL)
    }

    surv <- instrumento$survey %||% NULL
    ch   <- instrumento$choices %||% NULL
    label_col <- .get_choice_label_col(ch)

    x <- as.character(df[[var]])
    x <- x[!is.na(x) & nzchar(x) & x != "NA"]

    .log_resumen("KPI prep -> casos iniciales válidos=", length(x))

    if (!is.null(codigos_perdidos) && length(codigos_perdidos)) {
      x <- x[!(x %in% as.character(codigos_perdidos))]
      .log_resumen("KPI prep -> tras excluir perdidos=", length(x), " | perdidos=", .safe_chr(codigos_perdidos))
    }

    if (!length(x)) {
      .log_resumen("KPI prep FAIL -> no quedan casos para ", var)
      return(NULL)
    }

    map_code_to_label <- NULL

    if (!is.null(surv) &&
        all(c("name", "list_name") %in% names(surv)) &&
        !is.null(ch) &&
        all(c("list_name", "name") %in% names(ch)) &&
        !is.null(label_col) && label_col %in% names(ch)) {

      i <- which(!is.na(surv$name) & surv$name == var)[1]
      if (!is.na(i)) {
        ln <- as.character(surv$list_name[i])
        .log_resumen("KPI prep -> list_name=", ln, " | label_col=", label_col)
        if (!is.na(ln) && nzchar(ln)) {
          ch_v <- ch[ch$list_name == ln, , drop = FALSE]
          .log_resumen("KPI prep -> nrow choices=", nrow(ch_v))
          if (nrow(ch_v)) {
            map_code_to_label <- stats::setNames(
              as.character(ch_v[[label_col]]),
              as.character(ch_v$name)
            )
          }
        }
      }
    }

    if (is.null(map_code_to_label)) {
      labs <- attr(df[[var]], "labels", exact = TRUE)
      if (!is.null(labs) && length(labs) > 0) {
        .log_resumen("KPI prep -> usando labels de atributo para ", var)
        map_code_to_label <- stats::setNames(
          as.character(unname(labs)),
          as.character(names(labs))
        )
      }
    }

    if (is.null(map_code_to_label)) {
      vals <- sort(unique(x))
      .log_resumen("KPI prep -> sin diccionario; usando valores crudos")
      map_code_to_label <- stats::setNames(vals, vals)
    }

    tab <- as.data.frame(table(x), stringsAsFactors = FALSE)
    names(tab) <- c("code", "n")
    tab$n <- as.numeric(tab$n)

    tab$label <- unname(map_code_to_label[tab$code])
    tab$label[is.na(tab$label) | tab$label == ""] <- tab$code[is.na(tab$label) | tab$label == ""]

    orden <- unique(unname(map_code_to_label))
    orden <- orden[!is.na(orden) & nzchar(orden)]
    if (length(orden)) {
      tab$label <- factor(tab$label, levels = orden)
      tab <- tab[order(tab$label), , drop = FALSE]
      tab$label <- as.character(tab$label)
    }

    tab$pct <- tab$n / sum(tab$n)

    .log_resumen(
      "KPI prep OK -> var=", var,
      " | filas=", nrow(tab),
      " | labels=", .safe_chr(tab$label),
      " | n=", .safe_chr(tab$n)
    )

    tab
  }

  .construir_kpi_halfdonut_safe <- function(df, var_kpi) {

    .log_resumen("KPI build -> INICIO var=", var_kpi)

    if (!requireNamespace("plotly", quietly = TRUE)) {
      .log_resumen("KPI build FAIL -> plotly no disponible")
      return(NULL)
    }
    if (!var_kpi %in% names(df)) {
      .log_resumen("KPI build FAIL -> var no existe en df: ", var_kpi)
      return(NULL)
    }

    # 1) Intentar helper original real
    f <- get0(".construir_kpi_halfdonut", mode = "function", ifnotfound = NULL)
    if (is.null(f)) {
      f <- get0("construir_kpi_halfdonut", mode = "function", ifnotfound = NULL)
    }

    .log_resumen("KPI build -> helper original encontrado=", if (is.null(f)) "NO" else "SI")

    if (!is.null(f)) {
      out <- tryCatch(
        f(
          df = df,
          var_kpi = var_kpi,
          instrumento = instrumento,
          colores_apiladas_por_listname = ctx$colores_apiladas_por_listname,
          codigos_perdidos = ctx$codigos_perdidos
        ),
        error = function(e) {
          .log_resumen("KPI helper original ERROR var=", var_kpi, " -> ", conditionMessage(e))
          NULL
        }
      )

      if (!is.null(out)) {
        .log_resumen(
          "KPI helper original retornó lista? ", is.list(out),
          " | plot null? ", is.null(out$plot),
          " | legend null? ", is.null(out$legend),
          " | title null? ", is.null(out$title_html)
        )
      }

      if (!is.null(out) &&
          is.list(out) &&
          !is.null(out$plot) &&
          !is.null(out$legend) &&
          !is.null(out$title_html)) {
        .log_resumen("KPI build OK via helper original -> var=", var_kpi)
        return(out)
      }
    }

    # 2) Fallback robusto
    .log_resumen("KPI build -> usando fallback para var=", var_kpi)

    tab <- .preparar_tabla_kpi_safe(
      df = df,
      var = var_kpi,
      codigos_perdidos = ctx$codigos_perdidos
    )

    if (is.null(tab) || !nrow(tab)) {
      .log_resumen("KPI build FAIL fallback -> tabla nula/vacía para ", var_kpi)
      return(NULL)
    }

    titulo_kpi <- .wrap_titulo_html(
      .obtener_label_var(var_kpi, instrumento, df),
      width = 45
    )

    opcion_levels <- as.character(tab$label)
    paleta <- .resolver_paleta_var_safe(var_kpi, opcion_levels = opcion_levels)

    legend_df <- data.frame(
      label = opcion_levels,
      color = unname(paleta[opcion_levels]),
      stringsAsFactors = FALSE
    )

    .log_resumen(
      "KPI fallback -> labels=", .safe_chr(opcion_levels),
      " | colores=", .safe_chr(unname(paleta[opcion_levels]))
    )

    p <- tryCatch(
      plotly::plot_ly(
        data   = tab,
        labels = ~label,
        values = ~n,
        type   = "pie",
        hole   = 0.68,
        direction = "clockwise",
        rotation  = 180,
        sort      = FALSE,
        textinfo  = "none",
        marker    = list(colors = unname(paleta[opcion_levels])),
        hovertemplate = "%{label}: %{percent}<extra></extra>"
      ) |>
        plotly::layout(
          title = NULL,
          showlegend = FALSE,
          margin = list(l = 10, r = 10, t = 10, b = 5)
        ) |>
        plotly::config(displayModeBar = FALSE, responsive = TRUE),
      error = function(e) {
        .log_resumen("KPI fallback plot ERROR var=", var_kpi, " -> ", conditionMessage(e))
        NULL
      }
    )

    if (is.null(p)) {
      .log_resumen("KPI build FAIL -> plot nulo en fallback para ", var_kpi)
      return(NULL)
    }

    .log_resumen("KPI build OK via fallback -> var=", var_kpi)

    list(
      plot = p,
      legend = legend_df,
      title_html = titulo_kpi
    )
  }

  # ---------------------------------------------------------------------------
  # Filtros
  # ---------------------------------------------------------------------------
  .var_filtrable <- function(v) {
    if (!(v %in% names(data))) return(FALSE)
    x <- data[[v]]
    x_chr <- trimws(as.character(x))
    x_chr <- x_chr[!is.na(x_chr) & nzchar(x_chr) & x_chr != "NA"]
    n_u <- length(unique(x_chr))
    if (!is.finite(n_u) || n_u <= 1L) return(FALSE)

    surv <- instrumento$survey %||% NULL
    if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
      tipo <- tolower(as.character(surv$type[surv$name == v][1] %||% ""))
      if (grepl("^select_one\\b", tipo) || grepl("^select_multiple\\b", tipo)) return(TRUE)
    }

    n_u <= 60L
  }

  .catalogo_categorias_filtro <- function(var, df_base) {
    if (!nzchar(var) || !(var %in% names(df_base))) {
      return(data.frame(value = character(0), label = character(0), stringsAsFactors = FALSE))
    }

    vals_obs <- trimws(as.character(df_base[[var]]))
    vals_obs <- vals_obs[!is.na(vals_obs) & nzchar(vals_obs) & vals_obs != "NA"]
    vals_obs <- unique(vals_obs)

    out <- data.frame(value = character(0), label = character(0), stringsAsFactors = FALSE)

    surv <- instrumento$survey %||% NULL
    ch <- instrumento$choices %||% NULL
    label_col <- .get_choice_label_col(ch)

    if (!is.null(surv) && all(c("name", "list_name") %in% names(surv)) &&
        !is.null(ch) && all(c("list_name", "name") %in% names(ch)) &&
        !is.null(label_col) && label_col %in% names(ch)) {
      ln <- .get_list_name_safe(surv, var)
      if (!is.na(ln) && nzchar(ln)) {
        ch_v <- ch[ch$list_name == ln, , drop = FALSE]
        if (nrow(ch_v)) {
          vals <- as.character(ch_v$name)
          labs <- as.character(ch_v[[label_col]])
          ok <- !is.na(vals) & nzchar(trimws(vals))
          if (any(ok)) {
            vals <- vals[ok]
            labs <- labs[ok]
            labs[is.na(labs) | !nzchar(trimws(labs))] <- vals[is.na(labs) | !nzchar(trimws(labs))]
            out <- data.frame(value = vals, label = labs, stringsAsFactors = FALSE)
          }
        }
      }
    }

    if (!nrow(out) && var %in% names(df_base)) {
      labs_attr <- attr(df_base[[var]], "labels", exact = TRUE)
      if (!is.null(labs_attr) && length(labs_attr) > 0) {
        vals <- as.character(names(labs_attr))
        labs <- as.character(unname(labs_attr))
        ok <- !is.na(vals) & nzchar(trimws(vals))
        if (any(ok)) {
          vals <- vals[ok]
          labs <- labs[ok]
          labs[is.na(labs) | !nzchar(trimws(labs))] <- vals[is.na(labs) | !nzchar(trimws(labs))]
          out <- data.frame(value = vals, label = labs, stringsAsFactors = FALSE)
        }
      }
    }

    extra <- setdiff(vals_obs, out$value)
    if (length(extra)) {
      out <- rbind(
        out,
        data.frame(value = extra, label = extra, stringsAsFactors = FALSE)
      )
    }

    if (nrow(out)) {
      out$value <- as.character(out$value)
      out$label <- as.character(out$label)
      out$label[is.na(out$label) | !nzchar(trimws(out$label))] <- out$value[is.na(out$label) | !nzchar(trimws(out$label))]
      out <- out[!duplicated(out$value), , drop = FALSE]
    }

    out
  }

  filtro_vars_por_seccion <- lapply(ctx$secciones_limpias %||% list(), function(vs) {
    vv <- unique(as.character(vs))
    vv <- vv[vapply(vv, .var_filtrable, logical(1))]
    vv
  })
  filtro_vars_por_seccion <- filtro_vars_por_seccion[vapply(filtro_vars_por_seccion, length, integer(1)) > 0]
  filtro_secs <- names(filtro_vars_por_seccion)
  filtro_sec_default <- as.character(filtro_secs[1] %||% "")[1]
  MAX_FILTROS <- 6L
  filtro_rows <- shiny::reactiveValues(
    ids = 1L,
    next_id = 2L,
    bound = integer(0),
    last_valid = list()
  )

  .f_sec_id <- function(id) paste0("filtro_seccion_", id)
  .f_var_id <- function(id) paste0("filtro_var_", id)
  .f_cat_id <- function(id) paste0("filtro_categorias_", id)
  .f_rm_id  <- function(id) paste0("filtro_quitar_", id)
  .f_chip_rm_id <- function(id) paste0("filtro_chip_quitar_", id)
  .f_state_key <- function(id) paste0("filtro_", as.integer(id))

  .get_last_valid_cats <- function(id, var = NULL) {
    state <- filtro_rows$last_valid %||% list()
    entry <- state[[.f_state_key(id)]]
    if (is.null(entry)) return(character(0))

    if (!is.null(var)) {
      var_req <- as.character(var %||% "")[1]
      var_cur <- as.character(entry$var %||% "")[1]
      if (!identical(var_cur, var_req)) return(character(0))
    }

    cats <- as.character(entry$cats %||% character(0))
    cats[!is.na(cats) & nzchar(trimws(cats))]
  }

  .set_last_valid_cats <- function(id, var, cats) {
    state <- filtro_rows$last_valid %||% list()
    key <- .f_state_key(id)
    var <- as.character(var %||% "")[1]
    cats <- as.character(cats %||% character(0))
    cats <- cats[!is.na(cats) & nzchar(trimws(cats))]
    cats <- unique(cats)

    if (!nzchar(var) || !length(cats)) {
      state[[key]] <- NULL
      filtro_rows$last_valid <- state
      return(invisible(NULL))
    }

    state[[key]] <- list(var = var, cats = cats)
    filtro_rows$last_valid <- state
    invisible(cats)
  }

  .clear_last_valid_cats <- function(id) {
    state <- filtro_rows$last_valid %||% list()
    state[[.f_state_key(id)]] <- NULL
    filtro_rows$last_valid <- state
    invisible(NULL)
  }

  .remove_filter_row <- function(id) {
    ids <- as.integer(filtro_rows$ids %||% integer(0))
    ids <- setdiff(ids, as.integer(id))
    .clear_last_valid_cats(id)
    if (!length(ids)) {
      nid <- as.integer(filtro_rows$next_id %||% 2L)
      filtro_rows$next_id <- nid + 1L
      ids <- nid
    }
    filtro_rows$ids <- ids
  }

  .used_filter_vars <- function(except_id = NA_integer_) {
    ids <- as.integer(filtro_rows$ids %||% integer(0))
    ids <- ids[ids != as.integer(except_id)]
    out <- character(0)
    for (rid in ids) {
      vv <- as.character(input[[.f_var_id(rid)]] %||% "")[1]
      if (nzchar(vv)) out <- c(out, vv)
    }
    unique(out)
  }

  .register_filter_row <- function(id) {
    if (id %in% as.integer(filtro_rows$bound %||% integer(0))) return(invisible(NULL))
    filtro_rows$bound <- c(as.integer(filtro_rows$bound %||% integer(0)), as.integer(id))

    sec_id <- .f_sec_id(id)
    var_id <- .f_var_id(id)
    cat_id <- .f_cat_id(id)
    rm_id  <- .f_rm_id(id)
    chip_rm_id <- .f_chip_rm_id(id)

    shiny::observe({
      if (!(id %in% as.integer(filtro_rows$ids %||% integer(0)))) return()

      if (!length(filtro_secs)) {
        shiny::updateSelectizeInput(session, sec_id, choices = c(), selected = character(0), server = FALSE)
        shiny::updateSelectizeInput(session, var_id, choices = c("Sin filtro" = ""), selected = "", server = FALSE)
        shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
        return()
      }

      sec_cur <- as.character(input[[sec_id]] %||% filtro_sec_default)[1]
      sec_sel <- if (sec_cur %in% filtro_secs) sec_cur else filtro_sec_default
      shiny::updateSelectizeInput(
        session,
        inputId = sec_id,
        choices = stats::setNames(filtro_secs, filtro_secs),
        selected = sec_sel,
        server = FALSE
      )

      vars_sec <- filtro_vars_por_seccion[[sec_sel]] %||% character(0)
      vars_sec <- vars_sec[vars_sec %in% names(data)]
      used_other <- .used_filter_vars(except_id = id)
      vars_avail <- setdiff(vars_sec, used_other)

      cur_var <- as.character(input[[var_id]] %||% "")[1]
      if (nzchar(cur_var) && cur_var %in% vars_sec && !(cur_var %in% vars_avail)) {
        vars_avail <- c(cur_var, vars_avail)
      }
      vars_avail <- unique(vars_avail)
      vars_lab <- vapply(vars_avail, ctx$label_var, character(1))

      sel_var <- if (nzchar(cur_var) && cur_var %in% vars_avail) cur_var else ""
      shiny::updateSelectizeInput(
        session,
        inputId = var_id,
        choices = c("Sin filtro" = "", stats::setNames(vars_avail, vars_lab)),
        selected = sel_var,
        server = FALSE
      )
    })

    shiny::observeEvent(input[[var_id]], {
      if (!(id %in% as.integer(filtro_rows$ids %||% integer(0)))) return()
      v <- as.character(input[[var_id]] %||% "")[1]
      if (!nzchar(v) || !(v %in% names(data))) {
        .clear_last_valid_cats(id)
        shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
        return()
      }

      cat_df <- .catalogo_categorias_filtro(v, data)
      if (!nrow(cat_df)) {
        .clear_last_valid_cats(id)
        shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
        return()
      }

      cat_choices <- stats::setNames(cat_df$value, cat_df$label)
      prev_sel <- as.character(input[[cat_id]] %||% character(0))
      sel <- .interactivo_resolve_filter_selection(
        selected = prev_sel,
        valid_values = cat_df$value,
        last_valid = .get_last_valid_cats(id, var = v),
        fallback = "all"
      )
      .set_last_valid_cats(id, v, sel)

      shiny::updateSelectizeInput(
        session,
        inputId = cat_id,
        choices = cat_choices,
        selected = sel,
        server = FALSE
      )
    }, ignoreInit = FALSE)

    shiny::observeEvent(input[[cat_id]], {
      if (!(id %in% as.integer(filtro_rows$ids %||% integer(0)))) return()

      v <- as.character(input[[var_id]] %||% "")[1]
      if (!nzchar(v) || !(v %in% names(data))) {
        .clear_last_valid_cats(id)
        return()
      }

      cat_df <- .catalogo_categorias_filtro(v, data)
      if (!nrow(cat_df)) {
        .clear_last_valid_cats(id)
        return()
      }

      cur_sel <- .interactivo_resolve_filter_selection(
        selected = input[[cat_id]],
        valid_values = cat_df$value,
        last_valid = .get_last_valid_cats(id, var = v),
        fallback = "all"
      )
      prev_sel <- .get_last_valid_cats(id, var = v)

      .set_last_valid_cats(id, v, cur_sel)
      if (!identical(cur_sel, prev_sel) && length(as.character(input[[cat_id]] %||% character(0)))) {
        return()
      }

      raw_sel <- as.character(input[[cat_id]] %||% character(0))
      raw_sel <- raw_sel[!is.na(raw_sel) & nzchar(trimws(raw_sel))]
      if (identical(raw_sel, cur_sel)) return()

      shiny::updateSelectizeInput(
        session,
        inputId = cat_id,
        choices = stats::setNames(cat_df$value, cat_df$label),
        selected = cur_sel,
        server = FALSE
      )
    }, ignoreInit = TRUE)

    shiny::observeEvent(input[[rm_id]], .remove_filter_row(id), ignoreInit = TRUE)
    shiny::observeEvent(input[[chip_rm_id]], .remove_filter_row(id), ignoreInit = TRUE)

    invisible(NULL)
  }

  output$filtro_rows_ui <- shiny::renderUI({
    if (!length(filtro_secs)) {
      return(shiny::p(class = "rel-sidebar-hint", "No hay variables categóricas disponibles para filtrar."))
    }

    ids <- as.integer(filtro_rows$ids %||% integer(0))
    if (!length(ids)) return(NULL)

    shiny::tagList(
      lapply(seq_along(ids), function(i) {
        id <- ids[i]
        shiny::div(
          class = "sidebar-filter-row",
          shiny::div(
            class = "sidebar-filter-row-head",
            shiny::div(class = "sidebar-filter-row-title", paste0("Filtro ", i)),
            if (length(ids) > 1L) {
              shiny::actionButton(
                inputId = .f_rm_id(id),
                label = NULL,
                icon = shiny::icon("times"),
                class = "sidebar-filter-remove-btn",
                title = "Quitar filtro"
              )
            }
          ),
          shiny::selectizeInput(
            inputId = .f_sec_id(id),
            label = "Sección",
            choices = c(),
            selected = "",
            options = list(dropdownParent = "body")
          ),
          shiny::selectizeInput(
            inputId = .f_var_id(id),
            label = "Variable",
            choices = c("Sin filtro" = ""),
            selected = "",
            options = list(dropdownParent = "body")
          ),
          shiny::selectizeInput(
            inputId = .f_cat_id(id),
            label = "Categorías",
            choices = c(),
            selected = character(0),
            multiple = TRUE,
            options = list(
              plugins = list("remove_button"),
              closeAfterSelect = FALSE,
              placeholder = "Selecciona categorías",
              dropdownParent = "body"
            )
          )
        )
      })
    )
  })

  shiny::observe({
    ids <- as.integer(filtro_rows$ids %||% integer(0))
    for (id in ids) .register_filter_row(id)
  })

  shiny::observeEvent(input$filtro_agregar, {
    ids <- as.integer(filtro_rows$ids %||% integer(0))
    if (length(ids) >= MAX_FILTROS) return()
    nid <- as.integer(filtro_rows$next_id %||% 2L)
    filtro_rows$next_id <- nid + 1L
    filtro_rows$ids <- c(ids, nid)
  }, ignoreInit = TRUE)

  shiny::observeEvent(input$limpiar_filtros, {
    nid <- as.integer(filtro_rows$next_id %||% 2L)
    filtro_rows$next_id <- nid + 1L
    filtro_rows$ids <- nid
  }, ignoreInit = TRUE)

  .filtros_rows <- shiny::reactive({
    ids <- as.integer(filtro_rows$ids %||% integer(0))
    lapply(ids, function(id) {
      sec <- as.character(input[[.f_sec_id(id)]] %||% "")[1]
      var <- as.character(input[[.f_var_id(id)]] %||% "")[1]
      cats <- as.character(input[[.f_cat_id(id)]] %||% character(0))
      cats <- cats[!is.na(cats) & nzchar(trimws(cats))]
      if (nzchar(var) && var %in% names(data)) {
        valid_values <- as.character(.catalogo_categorias_filtro(var, data)$value %||% character(0))
        cats <- .interactivo_resolve_filter_selection(
          selected = cats,
          valid_values = valid_values,
          last_valid = .get_last_valid_cats(id, var = var),
          fallback = "all"
        )
      }
      list(id = id, sec = sec, var = var, cats = unique(cats))
    })
  })

  filtros_activos <- shiny::reactive({
    rows <- .filtros_rows()
    Filter(function(r) nzchar(r$var) && length(r$cats) > 0L, rows)
  })

  output$filtro_activos_ui <- shiny::renderUI({
    rows <- filtros_activos()
    if (!length(rows)) return(NULL)

    chips <- lapply(rows, function(r) {
      sec_lab <- if (nzchar(r$sec)) r$sec else "Sección"
      var_lab <- ctx$label_var(r$var)
      txt <- paste0(sec_lab, " · ", var_lab, " · ", length(r$cats), " categorías")
      shiny::div(
        class = "sidebar-filter-chip",
        shiny::span(class = "sidebar-filter-chip-text", txt),
        shiny::actionButton(
          inputId = .f_chip_rm_id(r$id),
          label = NULL,
          icon = shiny::icon("times"),
          class = "sidebar-filter-chip-remove",
          title = "Quitar filtro"
        )
      )
    })

    shiny::div(
      class = "sidebar-filter-active-wrap",
      shiny::div(class = "sidebar-filter-active-title", "Filtros activos"),
      shiny::div(class = "sidebar-filter-active-list", chips)
    )
  })

  output$filtro_rows_hint_ui <- shiny::renderUI({
    ids <- as.integer(filtro_rows$ids %||% integer(0))
    if (length(ids) < MAX_FILTROS) return(NULL)
    shiny::p(class = "rel-sidebar-hint", paste0("Máximo ", MAX_FILTROS, " filtros."))
  })

  data_filtrada <- shiny::reactive({
    df <- data
    if (!isTRUE(input$filtros_enabled)) return(df)

    rows <- filtros_activos()
    if (!length(rows)) return(df)

    for (r in rows) {
      if (!(r$var %in% names(df)) || !length(r$cats)) next
      xv <- trimws(as.character(df[[r$var]]))
      keep <- !is.na(xv) & xv %in% r$cats
      df <- df[keep, , drop = FALSE]
    }
    df
  })
  data_filtrada_debounced <- shiny::debounce(data_filtrada, millis = 150)

  section_spec <- shiny::reactive({
    shiny::req(input$seccion)
    .interactivo_resumen_build_rows(
      sec = input$seccion,
      secciones_limpias = ctx$secciones_limpias,
      instrumento = instrumento,
      data = data,
      sm_madres = ctx$sm_madres %||% NULL,
      max_so_rows = MAX_SO_ROWS,
      label_var = ctx$label_var,
      resolver_var_spec_fn = function(var_madre) {
        .resolver_var_spec_safe(var_madre = var_madre, ctx = ctx, df = data)
      }
    )
  })

  # ---------------------------------------------------------------------------
  # Helpers tipo / detección de SM
  # ---------------------------------------------------------------------------
  tipo_pregunta <- function(var, survey = NULL, sm_vars_force = NULL, df = NULL) {
    .interactivo_tipo_pregunta(
      var = var,
      survey = survey,
      sm_vars_force = sm_vars_force,
      df = df
    )
  }

  get_categorias <- function(var, df, survey = NULL, orders_list = NULL, opciones_excluir = NULL) {

    x <- if (var %in% names(df)) df[[var]] else NULL
    lab_attr <- if (!is.null(x)) attr(x, "labels", exact = TRUE) else NULL

    ln <- NA_character_
    if (!is.null(survey) && all(c("name", "list_name") %in% names(survey))) {
      ln <- .get_list_name_safe(survey, var)
    }

    codes  <- character(0)
    labels <- character(0)

    obj <- NULL
    if (!is.null(orders_list)) {
      if (var %in% names(orders_list)) obj <- orders_list[[var]]
      else if (!is.na(ln) && ln %in% names(orders_list)) obj <- orders_list[[ln]]
    }

    if (!is.null(obj)) {
      codes  <- as.character(obj$names)
      labels <- as.character(obj$labels)
    } else if (!is.null(lab_attr) && length(lab_attr) > 0) {
      codes  <- names(lab_attr)
      labels <- as.character(unname(lab_attr))
    } else if (!is.null(x)) {
      codes  <- sort(unique(na.omit(as.character(x))))
      labels <- codes
    }

    ok <- !is.na(codes) & nzchar(codes)
    codes  <- codes[ok]
    labels <- labels[ok]

    if (!is.null(opciones_excluir) && length(opciones_excluir) > 0) {
      ok2 <- !(labels %in% opciones_excluir)
      codes  <- codes[ok2]
      labels <- labels[ok2]
    }

    list(codes = codes, labels = labels, list_name = ln)
  }

  # ---------------------------------------------------------------------------
  # Plot SO
  # ---------------------------------------------------------------------------
  .plot_so_total <- function(df, var, paleta_colores) {

    if (!var %in% names(df)) {
      return(.interactivo_empty_plotly(
        title = "Sin variable disponible",
        subtitle = "La pregunta no está disponible con la selección actual.",
        height = BAR_HEIGHT
      ))
    }

    x <- as.character(df[[var]])
    x <- x[!is.na(x) & nzchar(x) & x != "NA"]
    if (!length(x)) {
      return(.interactivo_empty_plotly(
        title = "Sin casos por mostrar",
        subtitle = "Ajusta los filtros para ver información en este gráfico.",
        height = BAR_HEIGHT
      ))
    }

    tab <- as.data.frame(table(x), stringsAsFactors = FALSE)
    names(tab) <- c("code", "n")
    tab$n   <- as.numeric(tab$n)
    tab$pct <- tab$n / sum(tab$n)

    map_code_to_label <- NULL
    labs <- attr(df[[var]], "labels", exact = TRUE)
    if (!is.null(labs) && length(labs) > 0) {
      map_code_to_label <- stats::setNames(as.character(unname(labs)), as.character(names(labs)))
    }

    tab$label <- if (!is.null(map_code_to_label)) {
      out <- unname(map_code_to_label[tab$code])
      out[is.na(out) | out == ""] <- tab$code[is.na(out) | out == ""]
      out
    } else {
      tab$code
    }

    if (!is.null(paleta_colores) && !is.null(names(paleta_colores)) &&
        all(tab$label %in% names(paleta_colores))) {
      tab$label <- factor(tab$label, levels = names(paleta_colores))
      tab <- tab[order(tab$label), , drop = FALSE]
    } else {
      tab <- tab[order(tab$pct, decreasing = TRUE), , drop = FALSE]
    }

    tab$txt <- ifelse(
      tab$pct < 0.04,
      "",
      paste0("<b>", round(100 * tab$pct, 0), "%</b>")
    )
    tab$text_pos <- ifelse(tab$pct < 0.04, "none", "inside")
    tab$hover <- sprintf(
      "%s: %s%%<br>n: %s",
      as.character(tab$label),
      round(100 * tab$pct, 1),
      format(tab$n, big.mark = ",")
    )

    p <- plotly::plot_ly(height = BAR_HEIGHT)

    for (lab in as.character(tab$label)) {
      d <- tab[as.character(tab$label) == lab, , drop = FALSE]
      if (!nrow(d)) next

      col <- if (!is.null(paleta_colores) && !is.null(names(paleta_colores)) &&
                 lab %in% names(paleta_colores)) {
        unname(paleta_colores[[lab]])
      } else NULL

      p <- p |>
        plotly::add_bars(
          data             = d,
          x                = ~pct,
          y                = I("Total"),
          name             = lab,
          orientation      = "h",
          text             = ~txt,
          textposition     = ~text_pos,
          insidetextanchor = "middle",
          textfont         = list(color = "white", size = PCT_FSIZE),
          customdata       = ~hover,
          hovertemplate    = "%{customdata}<extra></extra>",
          marker           = list(color = col, line = list(width = 0))
        )
    }

    p |>
      plotly::layout(
        barmode = "stack",
        xaxis = list(title = "", range = c(0,1), showgrid = FALSE, zeroline = FALSE,
                     showticklabels = FALSE, ticks = ""),
        yaxis = list(title = "", showgrid = FALSE, zeroline = FALSE,
                     showticklabels = FALSE, ticks = ""),
        margin = list(l = 10, r = 10, t = 0, b = 0),
        showlegend = FALSE
      ) |>
      plotly::config(displayModeBar = FALSE, responsive = TRUE)
  }

  # ---------------------------------------------------------------------------
  # Plot SM dummy fill-only
  # ---------------------------------------------------------------------------
  .plot_sm_dummy_fill <- function(df, col_dummy,
                                  col_yes = SM_COLOR_YES,
                                  col_bg  = SM_COLOR_BG,
                                  text_out_color = SM_TEXT_OUT,
                                  pct_inside_threshold = 0.05) {

    .log_resumen("SM plot -> col=", col_dummy, " | text_out_color=", text_out_color)

    if (!col_dummy %in% names(df)) {
      .log_resumen("SM plot FAIL -> dummy no existe: ", col_dummy)
      return(.interactivo_empty_plotly(
        title = "Sin variable disponible",
        subtitle = "La pregunta no está disponible con la selección actual.",
        height = BAR_HEIGHT
      ))
    }

    x <- df[[col_dummy]]

    x2 <- suppressWarnings(as.numeric(as.character(x)))
    if (all(is.na(x2)) && is.logical(x)) x2 <- as.numeric(x)

    ok <- !is.na(x2) & x2 %in% c(0, 1)
    x2 <- x2[ok]

    if (!length(x2)) {
      .log_resumen("SM plot FAIL -> sin datos válidos en ", col_dummy)
      return(.interactivo_empty_plotly(
        title = "Sin casos por mostrar",
        subtitle = "Ajusta los filtros para ver información en este gráfico.",
        height = BAR_HEIGHT
      ))
    }

    N     <- length(x2)
    n_yes <- sum(x2 == 1)
    pct_y <- n_yes / N

    .log_resumen(
      "SM plot -> col=", col_dummy,
      " | N=", N,
      " | n_yes=", n_yes,
      " | pct=", round(pct_y, 4)
    )

    if (pct_y == 0) {
      .log_resumen("SM plot -> pct=0; no se dibuja etiqueta")
      p <- plotly::plot_ly(height = BAR_HEIGHT) |>
        plotly::add_bars(
          x           = 1,
          y           = I("Total"),
          orientation = "h",
          marker      = list(color = col_bg, line = list(width = 0)),
          hovertemplate = paste0(
            "Sí: 0%<br>",
            "n: 0<br>",
            "N: ", format(N, big.mark = ","), "<extra></extra>"
          ),
          showlegend  = FALSE
        ) |>
        plotly::layout(
          barmode = "stack",
          xaxis = list(title = "", range = c(0,1), showgrid = FALSE, zeroline = FALSE,
                       showticklabels = FALSE, ticks = ""),
          yaxis = list(title = "", showgrid = FALSE, zeroline = FALSE,
                       showticklabels = FALSE, ticks = ""),
          margin = list(l = 10, r = 10, t = 0, b = 0),
          showlegend = FALSE
        ) |>
        plotly::config(displayModeBar = FALSE, responsive = TRUE)

      return(p)
    }

    pct_r <- 1 - pct_y

    seg <- data.frame(
      seg   = c("yes", "bg"),
      pct   = c(pct_y, pct_r),
      n_yes = n_yes,
      N     = N,
      stringsAsFactors = FALSE
    )

    pct_num <- round(100 * pct_y, 0)
    pct_txt_plain  <- paste0(pct_num, "%")
    pct_txt_inside <- paste0("<b>", pct_txt_plain, "</b>")

    seg$hover <- c(
      sprintf(
        "Sí: %s%%<br>n: %s<br>N: %s",
        round(100 * pct_y, 1),
        format(n_yes, big.mark = ","),
        format(N, big.mark = ",")
      ),
      ""
    )

    p <- plotly::plot_ly(height = BAR_HEIGHT)

    p <- p |>
      plotly::add_bars(
        data             = seg[seg$seg == "yes", , drop = FALSE],
        x                = ~pct,
        y                = I("Total"),
        orientation      = "h",
        marker           = list(color = col_yes, line = list(width = 0)),
        customdata       = ~hover,
        hovertemplate    = "%{customdata}<extra></extra>",
        showlegend       = FALSE
      )

    p <- p |>
      plotly::add_bars(
        data        = seg[seg$seg == "bg", , drop = FALSE],
        x           = ~pct,
        y           = I("Total"),
        orientation = "h",
        marker      = list(color = col_bg, line = list(width = 0)),
        hoverinfo   = "skip",
        showlegend  = FALSE
      )

    ann <- list()
    if (pct_y < 0.04) {
      .log_resumen("SM plot -> etiqueta oculta por pct < 4% en ", col_dummy)
    } else if (pct_y >= pct_inside_threshold) {
      .log_resumen("SM plot -> etiqueta INSIDE col=", col_dummy)
      ann <- list(list(
        x = pct_y / 2,
        y = "Total",
        xref = "x",
        yref = "y",
        text = pct_txt_inside,
        showarrow = FALSE,
        xanchor = "center",
        yanchor = "middle",
        align = "center",
        font = list(color = "white", size = PCT_FSIZE)
      ))
    } else {
      .log_resumen(
        "SM plot -> etiqueta OUTSIDE col=", col_dummy,
        " | texto=", pct_txt_plain,
        " | color=", col_yes
      )
      ann <- list(list(
        x = pct_y,
        y = "Total",
        xref = "x",
        yref = "y",
        text = pct_txt_plain,
        showarrow = FALSE,
        xanchor = "left",
        yanchor = "middle",
        align = "left",
        xshift = 6,
        font = list(color = col_yes, size = PCT_FSIZE)
      ))
    }

    p |>
      plotly::layout(
        barmode = "stack",
        xaxis = list(title = "", range = c(0,1), showgrid = FALSE, zeroline = FALSE,
                     showticklabels = FALSE, ticks = ""),
        yaxis = list(title = "", showgrid = FALSE, zeroline = FALSE,
                     showticklabels = FALSE, ticks = ""),
        margin = list(l = 10, r = 28, t = 0, b = 0),
        showlegend = FALSE,
        annotations = ann
      ) |>
      plotly::config(displayModeBar = FALSE, responsive = TRUE)
  }

  # ---------------------------------------------------------------------------
  # Resolver spec SM
  # ---------------------------------------------------------------------------
  .resolver_var_spec_safe <- function(var_madre, ctx, df) {
    f <- get0("resolver_var_spec", mode = "function", ifnotfound = NULL)
    if (is.null(f)) return(list(cols = character(0), map_code_to_label = list()))
    out <- tryCatch(
      f(var_madre = var_madre, ctx = ctx, df = df),
      error = function(e) {
        .log_resumen("resolver_var_spec ERROR var=", var_madre, " -> ", conditionMessage(e))
        list(cols = character(0), map_code_to_label = list())
      }
    )
    if (is.null(out$cols)) out$cols <- character(0)
    if (is.null(out$map_code_to_label)) out$map_code_to_label <- list()
    out
  }

  # ---------------------------------------------------------------------------
  # UI: resumen de sección
  # ---------------------------------------------------------------------------
  output$section_summary_ui <- shiny::renderUI({
    spec <- section_spec()
    rows <- spec$rows %||% list()
    if (!length(rows)) {
      return(shiny::div(style = paste0("font-size:12px;color:", MSG_COLOR, ";"), "Sin variables disponibles."))
    }

    shiny::div(
      class = "section-summary",
      lapply(rows, function(row) {
        lab_html <- .wrap_titulo_html(row$label %||% row$var %||% "", width = 120)

        if (identical(row$type, "so")) {
          return(
            shiny::div(
              class = "summary-row",
              shiny::div(class = "summary-row-title", shiny::HTML(lab_html)),
              shiny::div(
                class = "summary-row-plot",
                shiny::uiOutput(row$slot_id)
              )
            )
          )
        }
        if (!length(row$options %||% list())) {
          return(
            shiny::div(
              class = "summary-row",
              shiny::div(class = "summary-row-title", shiny::HTML(lab_html)),
              .interactivo_empty_hint_ui(
                title = "Sin datos para mostrar",
                subtitle = "Esta pregunta no tiene niveles disponibles con la configuración actual.",
                extra_class = "summary-empty-hint"
              )
            )
          )
        }

        shiny::div(
          class = "summary-row",
          shiny::div(class = "summary-row-title", shiny::HTML(lab_html)),
          shiny::div(
            class = "summary-row-plot",
            style = "height:auto; overflow:visible;",
            shiny::div(
              class = "sm-card-inner",
              style = "display:flex; flex-direction:column; gap:12px; height:auto; overflow:visible;",
              lapply(row$options, function(opt) {
                shiny::div(
                  class = "sm-option-block",
                  style = "height:auto; overflow:visible;",
                  shiny::div(
                    class = "sm-option-title",
                    style = paste0(
                      "color:", SM_OPTION_TEXT, ";",
                      "font-size:12px;",
                      "font-weight:400;",
                      "margin:0 0 6px 0;"
                    ),
                    opt$label
                  ),
                  shiny::uiOutput(opt$slot_id)
                )
              })
            )
          )
        )
      })
    )
  })

  # ---------------------------------------------------------------------------
  # Render dinámico de plots del resumen
  # ---------------------------------------------------------------------------
  shiny::observeEvent(section_spec(), {
    spec <- section_spec()
    rows <- spec$rows %||% list()
    if (!length(rows)) return()

    surv <- instrumento$survey %||% NULL

    .log_resumen(
      "Resumen sección=", spec$section %||% "",
      " | vars_show=", .safe_chr(vapply(rows, function(r) as.character(r$var %||% ""), character(1)))
    )

    for (i in seq_along(rows)) {
      local({
        ii <- i
        row <- rows[[ii]]
        v  <- row$var
        out_so <- row$slot_id
        plot_out_so <- paste0(out_so, "__plot")

        output[[out_so]] <- shiny::renderUI({
          df2 <- data_filtrada_debounced()
          if (!nrow(df2) || !.interactivo_has_cases_so(df2, v)) {
            return(.interactivo_empty_hint_ui(
              title = "Sin casos por mostrar",
              subtitle = "Ajusta los filtros para ver información en este gráfico.",
              extra_class = "summary-empty-hint"
            ))
          }

          plotly::plotlyOutput(plot_out_so, height = paste0(BAR_HEIGHT, "px"))
        })

        output[[plot_out_so]] <- plotly::renderPlotly({
          df2 <- data_filtrada_debounced()
          if (!nrow(df2)) {
            return(.interactivo_empty_plotly(
              title = "Sin casos por mostrar",
              subtitle = "Ajusta los filtros para ver información en este gráfico.",
              height = BAR_HEIGHT
            ))
          }

          tp <- tipo_pregunta(v, survey = surv, sm_vars_force = ctx$sm_madres %||% NULL, df = df2)
          if (tp != "so") return(NULL)

          cats <- get_categorias(
            var = v,
            df = df2,
            survey = surv,
            orders_list = (instrumento$orders_list %||% NULL),
            opciones_excluir = NULL
          )

          pal <- .resolver_paleta_var_safe(v, opcion_levels = as.character(cats$labels))
          .plot_so_total(df2, v, paleta_colores = pal)
        })

        tp0 <- row$type %||% tipo_pregunta(v, survey = surv, sm_vars_force = ctx$sm_madres %||% NULL, df = data)
        if (tp0 == "sm") {
          opts0 <- row$options %||% list()
          cols0 <- vapply(opts0, function(opt) as.character(opt$col_dummy %||% ""), character(1))
          if (!length(cols0)) return()

          .log_resumen("SM madre=", v, " | dummies=", .safe_chr(cols0))

          for (j in seq_along(opts0)) {
            local({
              jj   <- j
              colj <- as.character(opts0[[jj]]$col_dummy %||% "")
              out_id <- as.character(opts0[[jj]]$slot_id %||% "")
              plot_out_id <- paste0(out_id, "__plot")

              output[[out_id]] <- shiny::renderUI({
                df2 <- data_filtrada_debounced()
                if (!nrow(df2) || !.interactivo_has_cases_dummy(df2, colj)) {
                  return(.interactivo_empty_hint_ui(
                    title = "Sin casos por mostrar",
                    subtitle = "Ajusta los filtros para ver información en este gráfico.",
                    extra_class = "summary-empty-hint"
                  ))
                }

                plotly::plotlyOutput(plot_out_id, height = paste0(BAR_HEIGHT, "px"))
              })

              output[[plot_out_id]] <- plotly::renderPlotly({
                df2 <- data_filtrada_debounced()
                if (!nrow(df2)) {
                  return(.interactivo_empty_plotly(
                    title = "Sin casos por mostrar",
                    subtitle = "Ajusta los filtros para ver información en este gráfico.",
                    height = BAR_HEIGHT
                  ))
                }

                .plot_sm_dummy_fill(
                  df = df2,
                  col_dummy = colj,
                  col_yes = SM_COLOR_YES,
                  col_bg  = SM_COLOR_BG,
                  text_out_color = SM_TEXT_OUT,
                  pct_inside_threshold = 0.05
                )
              })
            })
          }
        }
      })
    }
  }, ignoreInit = FALSE)

  # ---------------------------------------------------------------------------
  # KPI STATE
  # ---------------------------------------------------------------------------
  kpi_state <- shiny::reactive({
    df <- data_filtrada_debounced()
    if (!nrow(df)) {
      return(list(
        ok = FALSE,
        msg_title = "Sin datos para mostrar",
        msg_subtitle = "Ajusta los filtros para volver a mostrar indicadores."
      ))
    }

    .log_resumen("KPI state -> ctx$kpi_vars raw=", .safe_chr(ctx$kpi_vars))
    .log_resumen("KPI state -> names(df) ejemplo=", .safe_chr(names(df), max_n = 40))

    kpi_vars <- ctx$kpi_vars %||% character(0)
    kpi_vars <- unique(kpi_vars[kpi_vars %in% names(df)])
    if (length(kpi_vars) > 2L) kpi_vars <- kpi_vars[1:2]

    .log_resumen("KPI state -> vars filtradas=", .safe_chr(kpi_vars))

    n_unidades <- if (!is.null(ctx$id_unidad) && ctx$id_unidad %in% names(df)) {
      dplyr::n_distinct(df[[ctx$id_unidad]])
    } else {
      nrow(df)
    }

    n_sufijo <- if (!is.null(ctx$id_unidad) && nzchar(ctx$id_unidad)) ctx$id_unidad else ""
    texto_N  <- paste0(
      "N: ",
      format(n_unidades, big.mark = ",", scientific = FALSE),
      if (nzchar(n_sufijo)) paste0(" ", n_sufijo) else ""
    )

    kpi_obj_1 <- NULL
    kpi_obj_2 <- NULL

    if (length(kpi_vars) >= 1) {
      kpi_obj_1 <- tryCatch(
        .construir_kpi_halfdonut_safe(df = df, var_kpi = kpi_vars[1]),
        error = function(e) {
          .log_resumen("KPI state ERROR obj1 -> ", conditionMessage(e))
          NULL
        }
      )
    }

    if (length(kpi_vars) >= 2) {
      kpi_obj_2 <- tryCatch(
        .construir_kpi_halfdonut_safe(df = df, var_kpi = kpi_vars[2]),
        error = function(e) {
          .log_resumen("KPI state ERROR obj2 -> ", conditionMessage(e))
          NULL
        }
      )
    }

    .log_resumen(
      "KPI state -> obj1 null=", is.null(kpi_obj_1),
      " | obj2 null=", is.null(kpi_obj_2)
    )

    list(
      ok        = TRUE,
      texto_N   = texto_N,
      kpi_vars  = kpi_vars,
      kpi_obj_1 = kpi_obj_1,
      kpi_obj_2 = kpi_obj_2
    )
  })

  # ---------------------------------------------------------------------------
  # RenderPlotly KPIs
  # ---------------------------------------------------------------------------
  output$kpi_plot_1 <- plotly::renderPlotly({
    st <- kpi_state()
    .log_resumen("render kpi_plot_1 -> obj null=", is.null(st$kpi_obj_1))
    if (!isTRUE(st$ok) || is.null(st$kpi_obj_1)) return(NULL)
    st$kpi_obj_1$plot |>
      plotly::config(displayModeBar = FALSE, responsive = TRUE)
  })

  output$kpi_plot_2 <- plotly::renderPlotly({
    st <- kpi_state()
    .log_resumen("render kpi_plot_2 -> obj null=", is.null(st$kpi_obj_2))
    if (!isTRUE(st$ok) || is.null(st$kpi_obj_2)) return(NULL)
    st$kpi_obj_2$plot |>
      plotly::config(displayModeBar = FALSE, responsive = TRUE)
  })

  # ---------------------------------------------------------------------------
  # KPI panel UI
  # ---------------------------------------------------------------------------
  output$kpi_panel <- shiny::renderUI({

    legend_html <- function(legend_df) {
      shiny::div(
        class = "kpi-legend",
        lapply(seq_len(nrow(legend_df)), function(i) {
          shiny::div(
            class = "kpi-legend-item",
            shiny::span(
              class = "kpi-legend-swatch",
              style = paste0("background:", legend_df$color[i], ";")
            ),
            shiny::span(legend_df$label[i])
          )
        })
      )
    }

    st <- kpi_state()
    if (!isTRUE(st$ok)) {
      return(.interactivo_empty_hint_ui(
        title = st$msg_title %||% "Sin datos para mostrar",
        subtitle = st$msg_subtitle %||% "Ajusta los filtros para volver a mostrar indicadores.",
        extra_class = "kpi-empty-hint"
      ))
    }

    shiny::div(
      class = "kpi-sidebar-stack",

      shiny::div(
        class = "kpi-n-card",
        shiny::div(class = "kpi-n-text", st$texto_N)
      ),

      if (!is.null(st$kpi_obj_1)) shiny::div(
        class = "kpi-cell",
        shiny::div(class = "kpi-donut-title", shiny::HTML(st$kpi_obj_1$title_html)),
        plotly::plotlyOutput("kpi_plot_1", height = "260px"),
        legend_html(st$kpi_obj_1$legend)
      ) else NULL,

      if (!is.null(st$kpi_obj_2)) shiny::div(
        class = "kpi-cell",
        shiny::div(class = "kpi-donut-title", shiny::HTML(st$kpi_obj_2$title_html)),
        plotly::plotlyOutput("kpi_plot_2", height = "260px"),
        legend_html(st$kpi_obj_2$legend)
      ) else NULL,

      if (is.null(st$kpi_obj_1) && is.null(st$kpi_obj_2)) .interactivo_empty_hint_ui(
        title = "Sin indicadores para mostrar",
        subtitle = "No hay suficientes casos válidos para construir KPIs con la selección actual.",
        extra_class = "kpi-empty-hint"
      ) else NULL
    )
  })

  invisible(NULL)
}
