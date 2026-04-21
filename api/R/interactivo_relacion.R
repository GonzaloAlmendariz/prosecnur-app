# =============================================================================
# Pestaña: Relación (Cruces) — versión theme-aware corregida
# -----------------------------------------------------------------------------
# - Usa theme_app recibido como argumento (sin get("theme_app", ...)).
# - Respeta paleta personalizada en títulos, subtítulos, cards, barras SM y leyenda SO.
# - SO: leyenda externa HTML, sin tocar orden del apilado.
# - SM: chips por opción, barras fill-only por estrato.
# - Estratos sin datos válidos: se omiten en cada chip.
# =============================================================================

# -----------------------------------------------------------------------------
# UI del módulo
# -----------------------------------------------------------------------------
relacion_tab_ui <- function(id) {
  ns <- shiny::NS(id)

  shiny::tabPanel(
    title = "Relación",
    shiny::sidebarLayout(
      shiny::sidebarPanel(
        width = 3,
        class = "sidebar-panel-base",

        shiny::div(
          class = "sidebar-stack",
          shiny::div(
            class = "sidebar-module sidebar-module-rel",
            shiny::h3(class = "sidebar-module-title", "Relación"),
            shiny::p(
              class = "sidebar-module-help",
              "Define variable principal y segmento para explorar patrones y diferencias."
            ),
            shiny::div(
              class = "sidebar-module-card",
              shiny::div(class = "sidebar-subtitle", "Variable principal"),
              shiny::selectizeInput(
                inputId = ns("main_seccion"),
                label   = "Sección",
                choices = NULL,
                options = list(dropdownParent = "body")
              ),
              shiny::selectizeInput(
                inputId = ns("main_var"),
                label   = "Variable",
                choices = NULL,
                options = list(dropdownParent = "body")
              ),
              shiny::div(
                class = "sidebar-module-help rel-sidebar-hint",
                "Se grafica la distribución de la variable elegida."
              )
            ),
            shiny::div(
              class = "sidebar-module-card rel-sidebar-card-gap",
              shiny::div(class = "sidebar-subtitle", "Cruce"),
              shiny::selectizeInput(
                inputId = ns("cruce_seccion"),
                label   = "Sección",
                choices = NULL,
                options = list(dropdownParent = "body")
              ),
              shiny::selectizeInput(
                inputId = ns("cruce_var"),
                label   = "Segmento",
                choices = NULL,
                options = list(dropdownParent = "body")
              ),
              shiny::div(
                class = "sidebar-module-help rel-sidebar-hint",
                "La comparación se calcula dentro de cada grupo del segmento."
              )
            ),
            shiny::div(
              class = "sidebar-module-card rel-sidebar-card-gap",
              shiny::div(
                class = "rel-iter-head",
                shiny::div(class = "sidebar-subtitle rel-iter-head-title", "Filtros"),
                shiny::tags$label(
                  class = "switch rel-iter-head-switch",
                  shiny::tags$input(id = ns("rel_filters_enabled"), type = "checkbox"),
                  shiny::tags$span(class = "slider")
                )
              ),
              shiny::conditionalPanel(
                condition = sprintf("input['%s']", ns("rel_filters_enabled")),
                shiny::uiOutput(ns("rel_filter_rows_ui")),
                shiny::uiOutput(ns("rel_filter_active_ui")),
                shiny::div(
                  class = "sidebar-quick-actions",
                  shiny::actionButton(
                    inputId = ns("rel_filter_add"),
                    label = "Agregar filtro",
                    class = "sidebar-quick-btn"
                  ),
                  shiny::actionButton(
                    inputId = ns("rel_filter_reset"),
                    label = "Restablecer filtros",
                    class = "sidebar-quick-btn"
                  )
                ),
                shiny::uiOutput(ns("rel_filter_hint_ui"))
              )
            ),
            shiny::div(
              class = "sidebar-module-card rel-sidebar-card-gap",
              shiny::div(
                class = "rel-iter-head",
                shiny::div(class = "sidebar-subtitle rel-iter-head-title", "Iterar"),
                shiny::tags$label(
                  class = "switch rel-iter-head-switch",
                  shiny::tags$input(id = ns("iter_enabled"), type = "checkbox"),
                  shiny::tags$span(class = "slider")
                )
              ),
              shiny::conditionalPanel(
                condition = sprintf("input['%s']", ns("iter_enabled")),
                shiny::selectizeInput(
                  inputId = ns("iter_seccion"),
                  label   = "Sección",
                  choices = NULL,
                  options = list(dropdownParent = "body")
                ),
                shiny::selectizeInput(
                  inputId = ns("iter_var"),
                  label   = "Variable",
                  choices = c("Sin iteración" = ""),
                  selected = "",
                  options = list(dropdownParent = "body")
                ),
                shiny::uiOutput(ns("iter_hidden_hint_ui")),
                shiny::uiOutput(ns("rel_iter_btn_ui"))
              ),
              shiny::div(
                class = "sidebar-module-help rel-sidebar-hint",
                "Activa esta opción para repetir el mismo cruce por cada nivel de una tercera variable."
              )
            )
          )
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
                class = "cardbox-header rel-plot-header",
                shiny::div(class = "rel-plot-header-main", shiny::uiOutput(ns("rel_plot_header")))
              ),
              shiny::uiOutput(ns("rel_plot_ui")),
              shiny::uiOutput(ns("rel_so_legend"))
            )
          )
        ),

        shiny::br(),

        shiny::fluidRow(
          shiny::column(
            width = 12,
            shiny::div(
              class = "cardbox",
              shiny::div(
                class = "cardbox-header rel-table-header",
                shiny::div(
                  class = "rel-table-header-main",
                  shiny::div(class = "cardbox-title", "Tabla de cruces"),
                  shiny::uiOutput(ns("rel_table_subtitle"))
                ),
                shiny::div(
                  class = "rel-table-header-actions",
                  shiny::downloadButton(
                    outputId = ns("rel_tabla_descargar"),
                    label = "Excel",
                    class = "btn-sm rel-download-btn"
                  )
                )
              ),
              shiny::uiOutput(ns("rel_tabla_panel_ui"))
            )
          )
        ),

        shiny::div(style = "height: 48px;")
      )
    )
  )
}

# -----------------------------------------------------------------------------
# Server del módulo
# -----------------------------------------------------------------------------
relacion_tab_server <- function(
    id,
    data,
    instrumento,
    secciones,
    vars_so,
    vars_sm_madres,
    colores_apiladas_por_listname = NULL,
    codigos_perdidos = NULL,
    weight_col = "peso",
    orders_list = NULL,
    labels_override = NULL,
    theme_app = NULL
) {

  shiny::moduleServer(id, function(input, output, session) {

    MAX_SM_CHIPS <- 14L
    BAR_HEIGHT   <- 52
    PCT_FSIZE    <- 12

    `%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

    # -------------------------------------------------------------------------
    # Tema visual
    # -------------------------------------------------------------------------
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

    theme_rel <- theme_default
    if (!is.null(theme_app) && is.list(theme_app)) {
      nm <- intersect(names(theme_app), names(theme_rel))
      if (length(nm)) theme_rel[nm] <- theme_app[nm]
    }

    COLOR_PRIMARIO    <- theme_rel$color_primario
    COLOR_FONDO_APP   <- theme_rel$color_fondo_app
    COLOR_BORDE       <- theme_rel$color_borde
    COLOR_TEXTO       <- theme_rel$color_texto
    COLOR_TEXTO_SUAVE <- theme_rel$color_texto_suave
    COLOR_SUPERFICIE  <- theme_rel$color_superficie
    COLOR_SUPERFICIE2 <- theme_rel$color_superficie_2

    SM_COLOR_YES <- COLOR_PRIMARIO
    SM_COLOR_BG  <- COLOR_SUPERFICIE2

    # -------------------------------------------------------------------------
    # Helpers texto
    # -------------------------------------------------------------------------
    .wrap_titulo_html <- get0(
      ".wrap_titulo_html",
      ifnotfound = function(txt, width = 110) {
        if (!requireNamespace("stringr", quietly = TRUE)) return(as.character(txt))
        if (is.null(txt)) return("")
        lineas <- stringr::str_wrap(as.character(txt), width = width)
        paste(lineas, collapse = "<br>")
      }
    )

    .obtener_label_var <- get0(
      ".obtener_label_var",
      ifnotfound = function(var, instrumento, data = NULL) {
        surv <- instrumento$survey

        if (!is.null(surv) && "name" %in% names(surv)) {
          label_col <- if ("label" %in% names(surv)) {
            "label"
          } else {
            cand <- grep("^label(::|$)", names(surv), value = TRUE)
            if (length(cand)) cand[1] else NULL
          }

          if (!is.null(label_col) && label_col %in% names(surv)) {
            i <- which(!is.na(surv$name) & surv$name == var)[1]
            if (!is.na(i)) {
              lab <- surv[[label_col]][i]
              if (!is.na(lab) && nzchar(as.character(lab))) return(as.character(lab))
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

    .clamp <- function(x, lo, hi) {
      max(lo, min(hi, x))
    }

    .calc_left_margin <- function(labels, min_px = 110, max_px = 260, base = 24, per_char = 7) {
      labs <- as.character(labels %||% character(0))
      labs <- gsub("<br\\s*/?>", " ", labs, ignore.case = TRUE)
      labs <- gsub("<[^>]+>", "", labs)
      labs <- trimws(labs)
      max_chars <- if (length(labs)) max(nchar(labs, type = "width"), na.rm = TRUE) else 0
      .clamp(base + per_char * max_chars, min_px, max_px)
    }

    .clean_file_token <- function(x) {
      x <- as.character(x %||% "")
      x <- gsub("[^[:alnum:]_\\-]+", "_", x)
      x <- gsub("_+", "_", x)
      x <- gsub("^_|_$", "", x)
      if (!nzchar(x)) "variable" else x
    }

    .get_styles_cruces <- function() {
      f <- get0("mk_styles_cruces", mode = "function", ifnotfound = NULL)
      if (is.function(f)) return(f())

      list(
        header = openxlsx::createStyle(
          fontSize = 10, textDecoration = "bold", halign = "center",
          valign = "center", border = c("top", "bottom"), borderStyle = "thin",
          borderColour = "#000000", fontName = "Arial"
        ),
        header_A = openxlsx::createStyle(
          fontSize = 10, textDecoration = "bold", halign = "left",
          valign = "center", fontName = "Arial"
        ),
        body_txt = openxlsx::createStyle(fontSize = 10, halign = "left", valign = "center", fontName = "Arial"),
        body_int = openxlsx::createStyle(fontSize = 10, numFmt = "#,##0", halign = "right", valign = "center", fontName = "Arial"),
        body_pct = openxlsx::createStyle(fontSize = 10, numFmt = "0.0%", halign = "right", valign = "center", fontName = "Arial"),
        total_bold = openxlsx::createStyle(textDecoration = "bold", fontName = "Arial"),
        table_end = openxlsx::createStyle(border = "bottom", borderStyle = "thin", borderColour = "#000000")
      )
    }

    .prepare_export_tabla <- function(cuerpo, estr_labels) {
      if (!is.data.frame(cuerpo) || !ncol(cuerpo)) return(NULL)

      out <- as.data.frame(cuerpo, stringsAsFactors = FALSE)
      blocks <- c("Total", as.character(estr_labels %||% character(0)))

      expected <- 1L + 2L * length(blocks)
      if (ncol(out) != expected) {
        n_pairs <- max(0L, floor((ncol(out) - 1L) / 2L))
        blocks <- c("Total", paste0("Segmento ", seq_len(max(0L, n_pairs - 1L))))
      }

      display_names <- c("Opciones", as.vector(rbind(paste0(blocks, " n"), paste0(blocks, " %"))))
      display_names <- display_names[seq_len(ncol(out))]
      names(out) <- display_names

      n_idx <- which(grepl(" n$", names(out)))
      p_idx <- which(grepl(" %$", names(out)))

      for (j in n_idx) out[[j]] <- suppressWarnings(as.numeric(out[[j]]))
      for (j in p_idx) out[[j]] <- suppressWarnings(as.numeric(out[[j]]))

      list(
        data = out,
        blocks = blocks,
        n_idx = n_idx,
        p_idx = p_idx
      )
    }

    .sanitize_sheet_name <- function(x, fallback = "Nivel") {
      y <- as.character(x %||% "")
      y <- gsub("[\\[\\]\\*\\?/\\\\:]", " ", y)
      y <- gsub("[[:cntrl:]]", " ", y)
      y <- gsub("\\s+", " ", trimws(y))
      if (!nzchar(y)) y <- fallback
      substr(y, 1, 31)
    }

    .unique_sheet_names <- function(labels) {
      used <- character(0)
      out <- character(length(labels))
      for (i in seq_along(labels)) {
        base <- .sanitize_sheet_name(labels[i], fallback = paste0("Nivel_", i))
        cand <- base
        j <- 1L
        while (cand %in% used) {
          j <- j + 1L
          suf <- paste0("_", j)
          cand <- paste0(substr(base, 1, max(1, 31 - nchar(suf))), suf)
        }
        out[i] <- cand
        used <- c(used, cand)
      }
      out
    }

    .write_relacion_sheet <- function(wb, hoja, obj) {
      exp_tab <- .prepare_export_tabla(
        cuerpo = obj$cuerpo,
        estr_labels = obj$estr_labels
      )
      if (is.null(exp_tab) || !nrow(exp_tab$data)) {
        stop("No hay datos para exportar.", call. = FALSE)
      }

      st <- .get_styles_cruces()
      x <- exp_tab$data
      ncols <- ncol(x)
      blocks <- exp_tab$blocks

      r1 <- rep("", ncols)
      r1[1] <- as.character(obj$cruce_lbl %||% "Cruce")

      r2 <- rep("", ncols)
      for (i in seq_along(blocks)) {
        c0 <- 2 + (i - 1) * 2
        if (c0 <= ncols) r2[c0] <- blocks[i]
      }

      r3 <- rep("", ncols)
      for (i in seq_along(blocks)) {
        c0 <- 2 + (i - 1) * 2
        c1 <- c0 + 1
        if (c0 <= ncols) r3[c0] <- "n"
        if (c1 <= ncols) r3[c1] <- "%"
      }

      openxlsx::writeData(wb, hoja, t(r1), startRow = 1, startCol = 1, colNames = FALSE)
      openxlsx::writeData(wb, hoja, t(r2), startRow = 2, startCol = 1, colNames = FALSE)
      openxlsx::writeData(wb, hoja, t(r3), startRow = 3, startCol = 1, colNames = FALSE)

      openxlsx::mergeCells(wb, hoja, rows = 1, cols = 1:ncols)
      openxlsx::mergeCells(wb, hoja, rows = 2:3, cols = 1)
      for (i in seq_along(blocks)) {
        c0 <- 2 + (i - 1) * 2
        c1 <- c0 + 1
        if (c1 <= ncols) openxlsx::mergeCells(wb, hoja, rows = 2, cols = c0:c1)
      }

      openxlsx::addStyle(wb, hoja, st$header, rows = 1, cols = 1:ncols, gridExpand = TRUE, stack = TRUE)
      openxlsx::addStyle(wb, hoja, st$header_A, rows = 2:3, cols = 1, gridExpand = TRUE, stack = TRUE)
      if (ncols >= 2) openxlsx::addStyle(wb, hoja, st$header, rows = 2:3, cols = 2:ncols, gridExpand = TRUE, stack = TRUE)

      row_ini <- 4
      openxlsx::writeData(wb, hoja, x, startRow = row_ini, startCol = 1, colNames = FALSE)
      row_fin <- row_ini + nrow(x) - 1

      openxlsx::addStyle(wb, hoja, st$body_txt, rows = row_ini:row_fin, cols = 1, gridExpand = TRUE, stack = TRUE)
      if (length(exp_tab$n_idx)) {
        openxlsx::addStyle(wb, hoja, st$body_int, rows = row_ini:row_fin, cols = exp_tab$n_idx, gridExpand = TRUE, stack = TRUE)
      }
      if (length(exp_tab$p_idx)) {
        openxlsx::addStyle(wb, hoja, st$body_pct, rows = row_ini:row_fin, cols = exp_tab$p_idx, gridExpand = TRUE, stack = TRUE)
      }

      i_total <- which(trimws(as.character(x[[1]])) == "Total")
      if (length(i_total)) {
        rows_total <- row_ini + i_total - 1L
        openxlsx::addStyle(wb, hoja, st$total_bold, rows = rows_total, cols = 1:ncols, gridExpand = TRUE, stack = TRUE)
      }

      openxlsx::addStyle(wb, hoja, st$table_end, rows = row_fin, cols = 1:ncols, gridExpand = TRUE, stack = TRUE)
      openxlsx::setColWidths(wb, hoja, cols = 1, widths = 52)
      if (ncols >= 2) openxlsx::setColWidths(wb, hoja, cols = 2:ncols, widths = 12)
    }

    .write_relacion_excel <- function(path, obj_base, iter_entries = NULL, iter_var_label = NULL) {
      if (!requireNamespace("openxlsx", quietly = TRUE)) {
        stop("Se requiere el paquete 'openxlsx' para exportar Excel.", call. = FALSE)
      }

      wb <- openxlsx::createWorkbook()

      has_iter <- !is.null(iter_entries) && length(iter_entries) > 0

      if (!has_iter) {
        openxlsx::addWorksheet(wb, "Relación")
        .write_relacion_sheet(wb, "Relación", obj_base)
      } else {
        labels <- vapply(iter_entries, function(e) as.character(e$label %||% ""), character(1))
        bases  <- vapply(iter_entries, function(e) as.numeric(e$base_n %||% NA_real_), numeric(1))
        sheets <- .unique_sheet_names(labels)

        idx <- data.frame(
          Iteracion = rep(as.character(iter_var_label %||% "Iteración"), length(iter_entries)),
          Nivel = labels,
          Base_ponderada = bases,
          Hoja = sheets,
          stringsAsFactors = FALSE
        )

        openxlsx::addWorksheet(wb, "Indice")
        openxlsx::writeData(wb, "Indice", idx, startRow = 1, startCol = 1, headerStyle = .get_styles_cruces()$header)
        openxlsx::setColWidths(wb, "Indice", cols = 1:ncol(idx), widths = "auto")

        for (i in seq_along(iter_entries)) {
          openxlsx::addWorksheet(wb, sheets[i])
          .write_relacion_sheet(wb, sheets[i], iter_entries[[i]]$obj)
        }
      }

      openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
      invisible(path)
    }

    # -------------------------------------------------------------------------
    # Helpers base
    # -------------------------------------------------------------------------
    get_pesos <- function(df, weight_col = "peso") {
      if (!is.null(weight_col) && weight_col %in% names(df)) {
        w <- suppressWarnings(as.numeric(df[[weight_col]]))
        w[is.na(w) | !is.finite(w)] <- 0
        return(w)
      }
      rep(1, nrow(df))
    }

    .has_var_or_dummies <- function(df, var) {
      if (!is.data.frame(df)) return(FALSE)
      if (var %in% names(df)) return(TRUE)
      var_esc <- gsub("([\\W])", "\\\\\\1", var)
      any(grepl(paste0("^", var_esc, "[/\\.]"), names(df)))
    }

    tipo_pregunta <- function(var, survey = NULL, sm_vars_force = NULL, df = NULL) {
      if (!is.null(sm_vars_force) && var %in% sm_vars_force) return("sm")
      if (!is.null(survey) && any(survey$name == var)) {
        tipos <- unique(na.omit(survey$type[survey$name == var]))
        tipos <- tolower(as.character(tipos))
        if (any(grepl("^select_multiple(\\s|$)", tipos))) return("sm")
        if (any(grepl("^select_one(\\s|$)", tipos))) return("so")
      }
      if (!is.null(df) && .has_var_or_dummies(df, var) && !(var %in% names(df))) return("sm")
      "so"
    }

    get_list_name <- function(var, survey = NULL) {
      if (is.null(survey) || !all(c("name", "list_name") %in% names(survey))) return(NA_character_)
      ln <- unique(na.omit(as.character(survey$list_name[survey$name == var])))
      if (!length(ln)) return(NA_character_)
      ln[1]
    }

    .get_list_name_safe <- function(survey, var) {
      if (is.null(survey) || !all(c("name","list_name") %in% names(survey))) return(NA_character_)
      i <- which(!is.na(survey$name) & survey$name == var)[1]
      if (is.na(i)) return(NA_character_)
      ln <- as.character(survey$list_name[i])
      if (is.na(ln) || !nzchar(ln)) return(NA_character_)
      ln
    }

    # -------------------------------------------------------------------------
    # Resolver SM seguro
    # -------------------------------------------------------------------------
    .resolver_var_spec_safe <- function(var_madre, df) {

      f <- get0("resolver_var_spec", mode = "function", ifnotfound = NULL)
      if (!is.null(f)) {
        out <- tryCatch(
          f(var_madre = var_madre, ctx = list(data = df, instrumento = instrumento), df = df),
          error = function(e) NULL
        )
        if (is.list(out) && length(out$cols)) return(out)
      }

      var_esc <- gsub("([\\W])", "\\\\\\1", var_madre)
      cols <- grep(paste0("^", var_esc, "\\."), names(df), value = TRUE)

      surv <- instrumento$survey %||% NULL
      ch   <- instrumento$choices %||% NULL

      ln <- NA_character_
      if (!is.null(surv) && all(c("name","list_name") %in% names(surv)) && var_madre %in% surv$name) {
        ln <- get_list_name(var_madre, surv)
      }

      map_code_to_label <- list()

      if (!is.null(ch) && all(c("list_name","name") %in% names(ch)) && !is.na(ln) && nzchar(ln)) {
        label_col <- if ("label" %in% names(ch)) {
          "label"
        } else {
          cand <- grep("^label(::|$)", names(ch), value = TRUE)
          if (length(cand)) cand[1] else NULL
        }

        if (!is.null(label_col) && label_col %in% names(ch)) {
          ch_v <- ch[ch$list_name == ln, , drop = FALSE]
          if (nrow(ch_v)) {
            m <- stats::setNames(as.character(ch_v[[label_col]]), as.character(ch_v$name))
            map_code_to_label <- as.list(m)
          }
        }
      }

      list(
        var_madre = var_madre,
        cols = cols,
        map_code_to_label = map_code_to_label,
        list_name = ln,
        col_compact = NA_character_
      )
    }

    # -------------------------------------------------------------------------
    # Categorías SO
    # -------------------------------------------------------------------------
    get_categorias_so <- function(var, df, survey = NULL, orders_list = NULL) {

      x <- df[[var]]
      lab_attr <- attr(x, "labels", exact = TRUE)

      ln <- get_list_name(var, survey)

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
      } else {
        codes  <- sort(unique(na.omit(as.character(x))))
        labels <- codes
      }

      ok <- !is.na(codes) & nzchar(codes)
      codes  <- codes[ok]
      labels <- labels[ok]

      list(codes = codes, labels = labels, list_name = ln)
    }

    # -------------------------------------------------------------------------
    # SM: validez + numerador
    # -------------------------------------------------------------------------
    .sm_valid_ids <- function(df, var_madre, cols_dummies = NULL, col_compact = NULL) {

      if (!is.null(col_compact) && !is.na(col_compact) && col_compact %in% names(df)) {
        x <- as.character(df[[col_compact]])
        ok <- !is.na(x) & nzchar(x) & x != "NA"
        return(which(ok))
      }

      if (!is.null(cols_dummies) && length(cols_dummies)) {
        cols_dummies <- cols_dummies[cols_dummies %in% names(df)]
        if (!length(cols_dummies)) return(integer(0))

        mat <- sapply(cols_dummies, function(cc) {
          v <- suppressWarnings(as.numeric(as.character(df[[cc]])))
          v %in% c(0, 1)
        })
        if (!is.matrix(mat)) mat <- matrix(mat, ncol = 1)

        ok <- rowSums(mat, na.rm = TRUE) > 0
        return(which(ok))
      }

      integer(0)
    }

    .sm_numerador_option <- function(df, var_madre, code, cols_dummies = NULL, col_compact = NULL) {

      if (!is.null(col_compact) && !is.na(col_compact) && col_compact %in% names(df)) {
        x <- as.character(df[[col_compact]])
        ok <- !is.na(x) & nzchar(x) & x != "NA"
        if (!any(ok)) return(integer(0))
        vals <- strsplit(x[ok], "\\s*;\\s*")
        ids_ok <- which(ok)
        hit <- vapply(vals, function(v) any(trimws(v) == code), logical(1))
        return(ids_ok[hit])
      }

      if (!is.null(cols_dummies) && length(cols_dummies)) {
        col <- paste0(var_madre, ".", code)
        if (!col %in% names(df)) return(integer(0))
        v <- suppressWarnings(as.numeric(as.character(df[[col]])))
        return(which(!is.na(v) & v == 1))
      }

      integer(0)
    }

    # -------------------------------------------------------------------------
    # Paleta SO
    # -------------------------------------------------------------------------
    .resolver_paleta_var <- function(var, instrumento, colores_apiladas_por_listname, opcion_levels) {

      surv <- instrumento$survey %||% NULL
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

      if (!is.null(instrumento$choices) &&
          all(c("list_name", "name") %in% names(instrumento$choices)) &&
          !is.null(names(pal))) {

        fila <- surv[surv$name == var, , drop = FALSE]
        list_var <- if (nrow(fila)) fila$list_name[1] else NA_character_

        label_col <- if ("label" %in% names(instrumento$choices)) {
          "label"
        } else {
          cand <- grep("^label(::|$)", names(instrumento$choices), value = TRUE)
          if (length(cand)) cand[1] else NULL
        }

        if (!is.na(list_var) && nzchar(list_var) &&
            !is.null(label_col) && label_col %in% names(instrumento$choices)) {

          ch <- instrumento$choices[instrumento$choices$list_name == list_var, , drop = FALSE]
          map_code_to_label <- stats::setNames(
            as.character(ch[[label_col]]),
            as.character(ch$name)
          )

          idx <- names(pal) %in% names(map_code_to_label)
          if (any(idx)) {
            pal_lab <- stats::setNames(pal[idx], map_code_to_label[names(pal)[idx]])

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
      }

      pal2 <- rep(pal, length.out = length(opcion_levels))
      names(pal2) <- opcion_levels
      pal2
    }

    # -------------------------------------------------------------------------
    # Plot SO x SO
    # -------------------------------------------------------------------------
    .plot_so_so <- function(df, var_main, var_cruce) {

      survey <- instrumento$survey %||% NULL

      cats_main <- get_categorias_so(var_main, df, survey, orders_list %||% instrumento$orders_list %||% NULL)
      codes_row <- as.character(cats_main$codes)
      opciones  <- as.character(cats_main$labels)

      if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0 && length(codes_row)) {
        codp <- as.character(codigos_perdidos)
        keep <- !(codes_row %in% codp)
        codes_row <- codes_row[keep]
        opciones  <- opciones[keep]
      }

      cats_cruce <- get_categorias_so(var_cruce, df, survey, orders_list %||% instrumento$orders_list %||% NULL)
      estr_codes  <- as.character(cats_cruce$codes)
      estr_labels <- as.character(cats_cruce$labels)

      v_main  <- as.character(df[[var_main]])
      v_cruce <- as.character(df[[var_cruce]])
      w <- get_pesos(df, weight_col)

      rows <- list()

      for (j in seq_along(estr_codes)) {
        key_j  <- estr_codes[j]
        mask_j <- !is.na(v_cruce) & v_cruce == key_j

        elig <- mask_j & !is.na(v_main) & nzchar(v_main) & v_main != "NA" & (v_main %in% codes_row)
        N_j  <- sum(w[elig], na.rm = TRUE)

        if (is.na(N_j) || N_j <= 0) next

        for (i in seq_along(codes_row)) {
          code_i <- codes_row[i]
          n_ij <- sum(w[elig & v_main == code_i], na.rm = TRUE)
          rows[[length(rows) + 1]] <- data.frame(
            estrato_label = .wrap_titulo_html(estr_labels[j], width = 50),
            opcion_label  = opciones[i],
            pct = n_ij / N_j,
            n   = n_ij,
            stringsAsFactors = FALSE
          )
        }
      }

      df_tab <- dplyr::bind_rows(rows)
      if (!nrow(df_tab)) {
        return(
          plotly::plot_ly() |>
            plotly::layout(
              annotations = list(list(
                text = "Sin datos para graficar.",
                showarrow = FALSE,
                font = list(color = COLOR_TEXTO_SUAVE)
              )),
              paper_bgcolor = COLOR_SUPERFICIE,
              plot_bgcolor  = COLOR_SUPERFICIE
            ) |>
            plotly::config(displayModeBar = FALSE, responsive = TRUE)
        )
      }

      pal <- .resolver_paleta_var(
        var = var_main,
        instrumento = instrumento,
        colores_apiladas_por_listname = colores_apiladas_por_listname,
        opcion_levels = unique(opciones)
      )

      df_tab$opcion_label  <- factor(df_tab$opcion_label, levels = opciones)
      df_tab$estrato_label <- factor(df_tab$estrato_label, levels = rev(unique(df_tab$estrato_label)))
      left_margin <- .calc_left_margin(as.character(df_tab$estrato_label))

      p <- plotly::plot_ly()

      for (opt in opciones) {
        dfo <- df_tab[df_tab$opcion_label == opt, , drop = FALSE]
        if (!nrow(dfo)) next

        dfo$hover <- sprintf(
          "%s<br>%s: %s%%<br>n: %s",
          as.character(dfo$estrato_label),
          opt,
          round(100 * dfo$pct, 1),
          format(round(dfo$n, 0), big.mark = ",")
        )

        col_opt <- pal[[opt]] %||% unname(pal[opt]) %||% "#9aa4b2"

        p <- p |>
          plotly::add_bars(
            data             = dfo,
            x                = ~pct,
            y                = ~estrato_label,
            name             = opt,
            orientation      = "h",
            text             = ~paste0("<b>", round(100 * pct, 0), "%</b>"),
            textposition     = "inside",
            insidetextanchor = "middle",
            textfont         = list(color = "white", size = 11),
            customdata       = ~hover,
            hovertemplate    = "%{customdata}<extra></extra>",
            marker           = list(color = col_opt, line = list(width = 0)),
            showlegend       = FALSE
          )
      }

      p |>
        plotly::layout(
          barmode = "stack",
          bargap  = 0.25,
          xaxis   = list(
            title = "",
            range = c(-0.06, 1),
            showgrid = FALSE,
            zeroline = FALSE,
            showticklabels = FALSE,
            ticks = ""
          ),
          yaxis   = list(
            title = "",
            automargin = TRUE,
            showgrid = FALSE,
            zeroline = FALSE,
            ticks = "",
            tickpadding = 18,
            tickfont = list(color = COLOR_TEXTO)
          ),
          margin  = list(l = left_margin, r = 25, t = 10, b = 25),
          hovermode = "closest",
          transition = list(duration = 520, easing = "cubic-in-out"),
          showlegend = FALSE,
          paper_bgcolor = COLOR_SUPERFICIE,
          plot_bgcolor  = COLOR_SUPERFICIE
        ) |>
        plotly::config(displayModeBar = FALSE, responsive = TRUE)
    }

    # -------------------------------------------------------------------------
    # Plot SM por opción x estratos
    # -------------------------------------------------------------------------
    .plot_sm_option_chip <- function(df, var_madre, code, opt_label, var_cruce,
                                     cols_dummies = NULL, col_compact = NULL) {

      survey <- instrumento$survey %||% NULL
      cats_cruce <- get_categorias_so(var_cruce, df, survey, orders_list %||% instrumento$orders_list %||% NULL)
      estr_codes  <- as.character(cats_cruce$codes)
      estr_labels <- as.character(cats_cruce$labels)

      v_cruce <- as.character(df[[var_cruce]])
      w <- get_pesos(df, weight_col)

      rows <- list()

      for (j in seq_along(estr_codes)) {
        key_j  <- estr_codes[j]
        mask_j <- !is.na(v_cruce) & v_cruce == key_j

        ids_valid_sm <- .sm_valid_ids(df, var_madre, cols_dummies = cols_dummies, col_compact = col_compact)
        if (!length(ids_valid_sm)) next

        ids_mask <- which(mask_j)
        ids_denom <- intersect(ids_mask, ids_valid_sm)
        if (!length(ids_denom)) next

        N_j <- sum(w[ids_denom], na.rm = TRUE)
        if (is.na(N_j) || N_j <= 0) next

        ids_yes <- .sm_numerador_option(df, var_madre, code, cols_dummies = cols_dummies, col_compact = col_compact)
        ids_yes <- intersect(ids_yes, ids_denom)

        n_yes <- sum(w[ids_yes], na.rm = TRUE)
        pct_y <- if (N_j > 0) n_yes / N_j else 0
        pct_y <- max(0, min(1, pct_y))

        rows[[length(rows) + 1]] <- data.frame(
          estrato_label = .wrap_titulo_html(estr_labels[j], width = 50),
          pct_yes = pct_y,
          n_yes = n_yes,
          N = N_j,
          stringsAsFactors = FALSE
        )
      }

      dfi <- dplyr::bind_rows(rows)

      if (!nrow(dfi)) {
        return(
          plotly::plot_ly(height = BAR_HEIGHT) |>
            plotly::layout(
              annotations = list(list(
                text = "Sin datos válidos.",
                showarrow = FALSE,
                font = list(color = COLOR_TEXTO_SUAVE)
              )),
              xaxis = list(visible = FALSE),
              yaxis = list(visible = FALSE),
              margin = list(l = 10, r = 10, t = 0, b = 0),
              paper_bgcolor = COLOR_SUPERFICIE,
              plot_bgcolor  = COLOR_SUPERFICIE
            ) |>
            plotly::config(displayModeBar = FALSE, responsive = TRUE)
        )
      }

      dfi$estrato_label <- factor(dfi$estrato_label, levels = rev(unique(dfi$estrato_label)))
      dfi$pct_bg <- 1 - dfi$pct_yes
      left_margin <- .calc_left_margin(as.character(dfi$estrato_label))

      dfi$txt <- paste0("<b>", round(100 * dfi$pct_yes, 0), "%</b>")
      dfi$hover <- sprintf(
        "%s<br>%s: %s%%<br>n: %s<br>N: %s",
        as.character(dfi$estrato_label),
        opt_label,
        round(100 * dfi$pct_yes, 1),
        format(round(dfi$n_yes, 0), big.mark = ","),
        format(round(dfi$N, 0), big.mark = ",")
      )

      p <- plotly::plot_ly(height = max(220, 70 + 32 * nrow(dfi)))

      p <- p |>
        plotly::add_bars(
          data             = dfi,
          x                = ~pct_yes,
          y                = ~estrato_label,
          name             = "Sí",
          orientation      = "h",
          text             = ~txt,
          textposition     = "inside",
          insidetextanchor = "middle",
          textfont         = list(color = "white", size = PCT_FSIZE),
          customdata       = ~hover,
          hovertemplate    = "%{customdata}<extra></extra>",
          marker           = list(color = SM_COLOR_YES, line = list(width = 0))
        )

      p <- p |>
        plotly::add_bars(
          data        = dfi,
          x           = ~pct_bg,
          y           = ~estrato_label,
          name        = " ",
          orientation = "h",
          hoverinfo   = "skip",
          marker      = list(color = SM_COLOR_BG, line = list(width = 0)),
          showlegend  = FALSE
        )

      p |>
        plotly::layout(
          barmode = "stack",
          xaxis = list(
            range = c(-0.06, 1),
            showgrid = FALSE,
            zeroline = FALSE,
            showticklabels = FALSE,
            ticks = "",
            title = ""
          ),
          yaxis = list(
            title = "",
            automargin = TRUE,
            showgrid = FALSE,
            zeroline = FALSE,
            tickpadding = 18,
            tickfont = list(color = COLOR_TEXTO)
          ),
          margin = list(l = left_margin, r = 15, t = 8, b = 10),
          transition = list(duration = 520, easing = "cubic-in-out"),
          showlegend = FALSE,
          uniformtext = list(minsize = 10, mode = "hide"),
          paper_bgcolor = COLOR_SUPERFICIE,
          plot_bgcolor  = COLOR_SUPERFICIE
        ) |>
        plotly::config(displayModeBar = FALSE, responsive = TRUE)
    }

    # -------------------------------------------------------------------------
    # Tabla
    # -------------------------------------------------------------------------
    .build_cuerpo <- function(df, var_main, var_cruce) {

      survey <- instrumento$survey %||% NULL
      tp_main <- tipo_pregunta(var_main, survey = survey, sm_vars_force = vars_sm_madres, df = df)

      cats_cruce <- get_categorias_so(var_cruce, df, survey, orders_list %||% instrumento$orders_list %||% NULL)
      estr_codes  <- as.character(cats_cruce$codes)
      estr_labels <- as.character(cats_cruce$labels)

      v_cruce <- as.character(df[[var_cruce]])
      w <- get_pesos(df, weight_col)

      if (tp_main == "so") {

        cats_main <- get_categorias_so(var_main, df, survey, orders_list %||% instrumento$orders_list %||% NULL)
        codes_row <- as.character(cats_main$codes)
        labels_row <- as.character(cats_main$labels)

        if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0 && length(codes_row)) {
          codp <- as.character(codigos_perdidos)
          keep <- !(codes_row %in% codp)
          codes_row <- codes_row[keep]
          labels_row <- labels_row[keep]
        }

        cuerpo <- tibble::tibble(Opciones = labels_row)
        denom_map <- list()

        v_main <- as.character(df[[var_main]])
        elig_total <- !is.na(v_main) & nzchar(v_main) & v_main != "NA" & (v_main %in% codes_row)
        N_total <- sum(w[elig_total], na.rm = TRUE)

        n_total <- vapply(seq_along(codes_row), function(i) sum(w[elig_total & v_main == codes_row[i]], na.rm = TRUE), numeric(1))
        pct_total <- if (N_total > 0) n_total / N_total else rep(0, length(n_total))

        cuerpo <- dplyr::bind_cols(cuerpo, tibble::tibble(Total__n = n_total, Total__pct = pct_total))
        denom_map[["Total__n"]] <- N_total

        for (j in seq_along(estr_codes)) {
          key_j <- estr_codes[j]
          mask_j <- !is.na(v_cruce) & v_cruce == key_j

          elig <- mask_j & elig_total
          N_j <- sum(w[elig], na.rm = TRUE)

          if (is.na(N_j) || N_j <= 0) {
            n_vec <- rep(0, length(codes_row))
            pct   <- rep(0, length(codes_row))
          } else {
            n_vec <- vapply(seq_along(codes_row), function(i) sum(w[elig & v_main == codes_row[i]], na.rm = TRUE), numeric(1))
            pct   <- n_vec / N_j
          }

          nm_n   <- paste0(var_cruce, "__", make.names(estr_labels[j]), "__n")
          nm_pct <- paste0(var_cruce, "__", make.names(estr_labels[j]), "__pct")

          cuerpo <- dplyr::bind_cols(cuerpo, tibble::tibble(!!nm_n := n_vec, !!nm_pct := pct))
          denom_map[[nm_n]] <- N_j
        }

      } else {

        spec <- .resolver_var_spec_safe(var_main, df)
        cols <- spec$cols %||% character(0)

        codes_row <- sub(paste0("^", var_main, "\\."), "", cols)
        codes_row <- codes_row[nzchar(codes_row)]

        map <- spec$map_code_to_label %||% list()
        labels_row <- vapply(codes_row, function(cd) as.character(map[[cd]] %||% cd), character(1))

        if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0 && length(codes_row)) {
          codp <- as.character(codigos_perdidos)
          keep <- !(codes_row %in% codp)
          codes_row  <- codes_row[keep]
          labels_row <- labels_row[keep]
          cols       <- cols[sub(paste0("^", var_main, "\\."), "", cols) %in% codes_row]
        }

        cuerpo <- tibble::tibble(Opciones = labels_row)
        denom_map <- list()

        ids_valid <- .sm_valid_ids(df, var_main, cols_dummies = cols, col_compact = NA_character_)
        N_total <- if (length(ids_valid)) sum(w[ids_valid], na.rm = TRUE) else 0

        n_total <- vapply(seq_along(codes_row), function(i) {
          ids_yes <- .sm_numerador_option(df, var_main, codes_row[i], cols_dummies = cols, col_compact = NA_character_)
          ids_yes <- intersect(ids_yes, ids_valid)
          sum(w[ids_yes], na.rm = TRUE)
        }, numeric(1))

        pct_total <- if (N_total > 0) n_total / N_total else rep(0, length(n_total))

        cuerpo <- dplyr::bind_cols(cuerpo, tibble::tibble(Total__n = n_total, Total__pct = pct_total))
        denom_map[["Total__n"]] <- N_total

        for (j in seq_along(estr_codes)) {
          key_j <- estr_codes[j]
          mask_ids <- which(!is.na(v_cruce) & v_cruce == key_j)

          ids_denom <- intersect(mask_ids, ids_valid)
          N_j <- if (length(ids_denom)) sum(w[ids_denom], na.rm = TRUE) else 0

          if (is.na(N_j) || N_j <= 0) {
            n_vec <- rep(0, length(codes_row))
            pct   <- rep(0, length(codes_row))
          } else {
            n_vec <- vapply(seq_along(codes_row), function(i) {
              ids_yes <- .sm_numerador_option(df, var_main, codes_row[i], cols_dummies = cols, col_compact = NA_character_)
              ids_yes <- intersect(ids_yes, ids_denom)
              sum(w[ids_yes], na.rm = TRUE)
            }, numeric(1))
            pct <- n_vec / N_j
          }

          nm_n   <- paste0(var_cruce, "__", make.names(estr_labels[j]), "__n")
          nm_pct <- paste0(var_cruce, "__", make.names(estr_labels[j]), "__pct")

          cuerpo <- dplyr::bind_cols(cuerpo, tibble::tibble(!!nm_n := n_vec, !!nm_pct := pct))
          denom_map[[nm_n]] <- N_j
        }
      }

      total_row <- as.list(rep(NA, ncol(cuerpo)))
      names(total_row) <- names(cuerpo)
      total_row[["Opciones"]] <- "Total"

      n_cols   <- grep("__n$",   names(cuerpo))
      pct_cols <- grep("__pct$", names(cuerpo))

      for (k in n_cols) {
        nm <- names(cuerpo)[k]
        Nj <- denom_map[[nm]]
        total_row[[k]] <- if (is.null(Nj) || is.na(Nj)) NA_real_ else round(as.numeric(Nj), 0)
      }
      for (k in pct_cols) {
        nm_pct <- names(cuerpo)[k]
        nm_n   <- sub("__pct$", "__n", nm_pct)
        Nj <- denom_map[[nm_n]]
        total_row[[k]] <- if (is.null(Nj) || is.na(Nj) || Nj <= 0) 0 else 1
      }

      cuerpo <- dplyr::bind_rows(cuerpo, tibble::as_tibble(total_row))

      dic_vars <- NULL
      surv <- instrumento$survey %||% NULL
      if (!is.null(surv) && "name" %in% names(surv)) {
        label_col <- if ("label" %in% names(surv)) {
          "label"
        } else {
          cand <- grep("^label(::|$)", names(surv), value = TRUE)
          if (length(cand)) cand[1] else NULL
        }
        if (!is.null(label_col) && label_col %in% names(surv)) {
          dic_vars <- dplyr::transmute(surv, name = .data$name, label = .data[[label_col]])
        }
      }

      label_variable <- function(var, dic_vars = NULL, labels_override = NULL, df = NULL) {
        if (!is.null(labels_override) && var %in% names(labels_override)) return(as.character(labels_override[[var]]))
        if (!is.null(df) && var %in% names(df)) {
          vlab <- attr(df[[var]], "label", exact = TRUE)
          if (!is.null(vlab) && nzchar(as.character(vlab))) return(as.character(vlab))
        }
        if (!is.null(dic_vars) && all(c("name","label") %in% names(dic_vars))) {
          lab <- dic_vars$label[dic_vars$name == var]
          if (length(lab) && !all(is.na(lab))) return(as.character(lab[1]))
        }
        as.character(var)
      }

      cruce_lbl <- label_variable(var_cruce, dic_vars = dic_vars, labels_override = labels_override, df = df)

      list(
        cuerpo       = cuerpo,
        tipo_main    = tp_main,
        estr_labels  = estr_labels,
        cruce_lbl    = cruce_lbl
      )
    }

    # -------------------------------------------------------------------------
    # Encabezado DT
    # -------------------------------------------------------------------------
    .dt_container_multihdr <- function(cuerpo, cruce_lbl, estr_labels) {

      n_blocks <- 1L + length(estr_labels)
      ncols    <- ncol(cuerpo)
      exp_cols <- 1L + 2L * n_blocks

      if (is.na(ncols) || ncols != exp_cols) {
        return(htmltools::withTags(
          table(
            class = "display nowrap compact",
            thead(
              tr(lapply(names(cuerpo), function(x) htmltools::tags$th(x)))
            )
          )
        ))
      }

      fila2 <- c(
        list(htmltools::tags$th(colspan = 2, "Total")),
        lapply(estr_labels, function(lab) htmltools::tags$th(colspan = 2, as.character(lab)))
      )

      fila3 <- unlist(
        replicate(n_blocks, list(htmltools::tags$th("n"), htmltools::tags$th("%")), simplify = FALSE),
        recursive = FALSE
      )

      htmltools::withTags(
        table(
          class = "display nowrap compact",
          thead(
            tr(
              htmltools::tags$th(rowspan = 3, ""),
              htmltools::tags$th(colspan = ncols - 1, cruce_lbl)
            ),
            tr(fila2),
            tr(fila3)
          )
        )
      )
    }

    # -------------------------------------------------------------------------
    # Wiring UI
    # -------------------------------------------------------------------------
    secciones_limpias <- lapply(secciones, function(vs) {
      vs[vapply(vs, function(v) .has_var_or_dummies(data, v), logical(1))]
    })
    secciones_limpias <- secciones_limpias[vapply(secciones_limpias, length, integer(1)) > 0]

    .choice_label_col_rel <- function(ch) {
      if (is.null(ch)) return(NULL)
      if ("label" %in% names(ch)) return("label")
      cand <- grep("^label(::|$)", names(ch), value = TRUE)
      if (length(cand)) cand[1] else NULL
    }

    .choice_map_rel <- function(var) {
      surv <- instrumento$survey %||% NULL
      ch <- instrumento$choices %||% NULL
      if (is.null(surv) || is.null(ch) ||
          !all(c("name", "list_name") %in% names(surv)) ||
          !all(c("list_name", "name") %in% names(ch))) {
        return(stats::setNames(character(0), character(0)))
      }

      ln <- get_list_name(var, surv)
      if (is.na(ln) || !nzchar(ln)) return(stats::setNames(character(0), character(0)))

      col_lab <- .choice_label_col_rel(ch)
      if (is.null(col_lab) || !(col_lab %in% names(ch))) return(stats::setNames(character(0), character(0)))

      chv <- ch[ch$list_name == ln, , drop = FALSE]
      if (!nrow(chv)) return(stats::setNames(character(0), character(0)))
      stats::setNames(as.character(chv[[col_lab]]), as.character(chv$name))
    }

    .catalogo_categorias_rel <- function(var, df_base) {
      if (!nzchar(var) || !(var %in% names(df_base))) {
        return(data.frame(value = character(0), label = character(0), stringsAsFactors = FALSE))
      }

      map_choice <- .choice_map_rel(var)
      out <- data.frame(value = character(0), label = character(0), stringsAsFactors = FALSE)
      if (length(map_choice)) {
        out <- data.frame(
          value = as.character(names(map_choice)),
          label = as.character(unname(map_choice)),
          stringsAsFactors = FALSE
        )
      } else {
        labs_attr <- attr(df_base[[var]], "labels", exact = TRUE)
        if (!is.null(labs_attr) && length(labs_attr)) {
          out <- data.frame(
            value = as.character(names(labs_attr)),
            label = as.character(unname(labs_attr)),
            stringsAsFactors = FALSE
          )
        }
      }

      vals_obs <- trimws(as.character(df_base[[var]]))
      vals_obs <- vals_obs[!is.na(vals_obs) & nzchar(vals_obs) & vals_obs != "NA"]
      vals_obs <- unique(vals_obs)

      extra <- setdiff(vals_obs, out$value)
      if (length(extra)) {
        out <- rbind(out, data.frame(value = extra, label = extra, stringsAsFactors = FALSE))
      }

      if (nrow(out)) {
        out$value <- as.character(out$value)
        out$label <- as.character(out$label)
        out$label[is.na(out$label) | !nzchar(trimws(out$label))] <- out$value[is.na(out$label) | !nzchar(trimws(out$label))]
        out <- out[!duplicated(out$value), , drop = FALSE]
      }
      out
    }

    .var_filtrable_rel <- function(v) {
      if (!(v %in% names(data))) return(FALSE)
      surv <- instrumento$survey %||% NULL
      if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
        tipo <- tolower(as.character(surv$type[surv$name == v][1] %||% ""))
        if (grepl("^select_one\\b", tipo) || grepl("^select_multiple\\b", tipo)) return(TRUE)
      }
      if (length(.choice_map_rel(v))) return(TRUE)
      x <- trimws(as.character(data[[v]]))
      x <- x[!is.na(x) & nzchar(x) & x != "NA"]
      n_u <- length(unique(x))
      is.finite(n_u) && n_u > 1L && n_u <= 60L
    }

    filtro_vars_por_seccion <- lapply(secciones_limpias, function(vs) {
      vv <- unique(as.character(vs))
      vv <- vv[vapply(vv, .var_filtrable_rel, logical(1))]
      vv
    })
    filtro_vars_por_seccion <- filtro_vars_por_seccion[vapply(filtro_vars_por_seccion, length, integer(1)) > 0]
    filtro_secs <- names(filtro_vars_por_seccion)
    filtro_sec_default <- as.character(filtro_secs[1] %||% "")[1]

    MAX_REL_FILTROS <- 6L
    rel_filter_rows <- shiny::reactiveValues(ids = 1L, next_id = 2L, bound = integer(0))

    .rf_sec_id <- function(id) paste0("rel_filter_seccion_", id)
    .rf_var_id <- function(id) paste0("rel_filter_var_", id)
    .rf_cat_id <- function(id) paste0("rel_filter_categorias_", id)
    .rf_rm_id  <- function(id) paste0("rel_filter_quitar_", id)
    .rf_chip_rm_id <- function(id) paste0("rel_filter_chip_quitar_", id)

    .remove_rel_filter_row <- function(id) {
      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      ids <- setdiff(ids, as.integer(id))
      if (!length(ids)) {
        nid <- as.integer(rel_filter_rows$next_id %||% 2L)
        rel_filter_rows$next_id <- nid + 1L
        ids <- nid
      }
      rel_filter_rows$ids <- ids
    }

    .used_rel_filter_vars <- function(except_id = NA_integer_) {
      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      ids <- ids[ids != as.integer(except_id)]
      out <- character(0)
      for (rid in ids) {
        vv <- as.character(input[[.rf_var_id(rid)]] %||% "")[1]
        if (nzchar(vv)) out <- c(out, vv)
      }
      unique(out)
    }

    .register_rel_filter_row <- function(id) {
      if (id %in% as.integer(rel_filter_rows$bound %||% integer(0))) return(invisible(NULL))
      rel_filter_rows$bound <- c(as.integer(rel_filter_rows$bound %||% integer(0)), as.integer(id))

      sec_id <- .rf_sec_id(id)
      var_id <- .rf_var_id(id)
      cat_id <- .rf_cat_id(id)
      rm_id <- .rf_rm_id(id)
      chip_rm_id <- .rf_chip_rm_id(id)

      shiny::observe({
        if (!(id %in% as.integer(rel_filter_rows$ids %||% integer(0)))) return()

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
        used_other <- .used_rel_filter_vars(except_id = id)
        vars_avail <- setdiff(vars_sec, used_other)

        cur_var <- as.character(input[[var_id]] %||% "")[1]
        if (nzchar(cur_var) && cur_var %in% vars_sec && !(cur_var %in% vars_avail)) {
          vars_avail <- c(cur_var, vars_avail)
        }
        vars_avail <- unique(vars_avail)

        var_labs <- vapply(vars_avail, function(v) .obtener_label_var(v, instrumento, data), character(1))
        sel_var <- if (nzchar(cur_var) && cur_var %in% vars_avail) cur_var else ""
        shiny::updateSelectizeInput(
          session,
          inputId = var_id,
          choices = c("Sin filtro" = "", stats::setNames(vars_avail, var_labs)),
          selected = sel_var,
          server = FALSE
        )
      })

      shiny::observeEvent(input[[var_id]], {
        if (!(id %in% as.integer(rel_filter_rows$ids %||% integer(0)))) return()
        v <- as.character(input[[var_id]] %||% "")[1]
        if (!nzchar(v) || !(v %in% names(data))) {
          shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
          return()
        }

        cat_df <- .catalogo_categorias_rel(v, data)
        if (!nrow(cat_df)) {
          shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
          return()
        }

        cat_choices <- stats::setNames(cat_df$value, cat_df$label)
        prev_sel <- as.character(input[[cat_id]] %||% character(0))
        sel <- if (length(prev_sel)) intersect(prev_sel, cat_df$value) else character(0)
        if (!length(sel)) sel <- as.character(cat_df$value)

        shiny::updateSelectizeInput(
          session,
          inputId = cat_id,
          choices = cat_choices,
          selected = sel,
          server = FALSE
        )
      }, ignoreInit = FALSE)

      shiny::observeEvent(input[[rm_id]], .remove_rel_filter_row(id), ignoreInit = TRUE)
      shiny::observeEvent(input[[chip_rm_id]], .remove_rel_filter_row(id), ignoreInit = TRUE)

      invisible(NULL)
    }

    output$rel_filter_rows_ui <- shiny::renderUI({
      if (!length(filtro_secs)) {
        return(shiny::p(class = "rel-sidebar-hint", "No hay variables categóricas disponibles para filtrar."))
      }

      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      if (!length(ids)) return(NULL)
      ns <- session$ns

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
                  inputId = ns(.rf_rm_id(id)),
                  label = NULL,
                  icon = shiny::icon("times"),
                  class = "sidebar-filter-remove-btn",
                  title = "Quitar filtro"
                )
              }
            ),
            shiny::selectizeInput(
              inputId = ns(.rf_sec_id(id)),
              label = "Sección",
              choices = c(),
              selected = "",
              options = list(dropdownParent = "body")
            ),
            shiny::selectizeInput(
              inputId = ns(.rf_var_id(id)),
              label = "Variable",
              choices = c("Sin filtro" = ""),
              selected = "",
              options = list(dropdownParent = "body")
            ),
            shiny::selectizeInput(
              inputId = ns(.rf_cat_id(id)),
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
      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      for (id in ids) .register_rel_filter_row(id)
    })

    shiny::observeEvent(input$rel_filter_add, {
      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      if (length(ids) >= MAX_REL_FILTROS) return()
      nid <- as.integer(rel_filter_rows$next_id %||% 2L)
      rel_filter_rows$next_id <- nid + 1L
      rel_filter_rows$ids <- c(ids, nid)
    }, ignoreInit = TRUE)

    shiny::observeEvent(input$rel_filter_reset, {
      nid <- as.integer(rel_filter_rows$next_id %||% 2L)
      rel_filter_rows$next_id <- nid + 1L
      rel_filter_rows$ids <- nid
    }, ignoreInit = TRUE)

    .rel_filter_rows_state <- shiny::reactive({
      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      lapply(ids, function(id) {
        sec <- as.character(input[[.rf_sec_id(id)]] %||% "")[1]
        var <- as.character(input[[.rf_var_id(id)]] %||% "")[1]
        cats <- as.character(input[[.rf_cat_id(id)]] %||% character(0))
        cats <- cats[!is.na(cats) & nzchar(trimws(cats))]
        list(id = id, sec = sec, var = var, cats = unique(cats))
      })
    })

    rel_filters_activos <- shiny::reactive({
      rows <- .rel_filter_rows_state()
      Filter(function(r) nzchar(r$var) && length(r$cats) > 0L, rows)
    })

    output$rel_filter_active_ui <- shiny::renderUI({
      rows <- rel_filters_activos()
      if (!length(rows)) return(NULL)
      ns <- session$ns

      chips <- lapply(rows, function(r) {
        sec_lab <- if (nzchar(r$sec)) r$sec else "Sección"
        var_lab <- .obtener_label_var(r$var, instrumento, data)
        txt <- paste0(sec_lab, " · ", var_lab, " · ", length(r$cats), " categorías")
        shiny::div(
          class = "sidebar-filter-chip",
          shiny::span(class = "sidebar-filter-chip-text", txt),
          shiny::actionButton(
            inputId = ns(.rf_chip_rm_id(r$id)),
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

    output$rel_filter_hint_ui <- shiny::renderUI({
      ids <- as.integer(rel_filter_rows$ids %||% integer(0))
      if (length(ids) < MAX_REL_FILTROS) return(NULL)
      shiny::p(class = "rel-sidebar-hint", paste0("Máximo ", MAX_REL_FILTROS, " filtros."))
    })

    rel_data_filtrada <- shiny::reactive({
      df <- data
      if (!isTRUE(input$rel_filters_enabled)) return(df)

      rows <- rel_filters_activos()
      if (!length(rows)) return(df)

      for (r in rows) {
        if (!(r$var %in% names(df)) || !length(r$cats)) next
        xv <- trimws(as.character(df[[r$var]]))
        keep <- !is.na(xv) & xv %in% r$cats
        df <- df[keep, , drop = FALSE]
      }
      df
    })

    shiny::observe({
      secs <- names(secciones_limpias)
      if (!length(secs)) {
        shiny::updateSelectizeInput(session, "main_seccion", choices = c(), selected = character(0), server = FALSE)
        shiny::updateSelectizeInput(session, "cruce_seccion", choices = c(), selected = character(0), server = FALSE)
        shiny::updateSelectizeInput(session, "iter_seccion", choices = c(), selected = character(0), server = FALSE)
      } else {
        shiny::updateSelectizeInput(session, "main_seccion", choices = stats::setNames(secs, secs), selected = secs[1], server = FALSE)
        shiny::updateSelectizeInput(session, "cruce_seccion", choices = stats::setNames(secs, secs), selected = secs[1], server = FALSE)
        shiny::updateSelectizeInput(session, "iter_seccion", choices = stats::setNames(secs, secs), selected = secs[1], server = FALSE)
      }
    })

    shiny::observeEvent(input$main_seccion, {
      sec <- input$main_seccion
      if (is.null(sec) || !nzchar(sec) || is.null(secciones_limpias[[sec]])) return()

      vars_sec <- secciones_limpias[[sec]]
      pool_main <- unique(c(vars_so, vars_sm_madres))

      main_choices <- unique(vars_sec[vars_sec %in% pool_main])
      if (!length(main_choices)) main_choices <- pool_main

      main_lab <- stats::setNames(
        main_choices,
        vapply(main_choices, function(v) .obtener_label_var(v, instrumento, data), character(1))
      )

      shiny::updateSelectizeInput(session, "main_var", choices = main_lab, selected = main_choices[1] %||% "", server = FALSE)
    }, ignoreInit = TRUE)

    shiny::observeEvent(input$cruce_seccion, {
      sec <- input$cruce_seccion
      if (is.null(sec) || !nzchar(sec) || is.null(secciones_limpias[[sec]])) return()

      vars_sec <- secciones_limpias[[sec]]
      cruce_choices <- unique(vars_sec[vars_sec %in% vars_so])
      if (!length(cruce_choices)) cruce_choices <- vars_so

      cruce_lab <- stats::setNames(
        cruce_choices,
        vapply(cruce_choices, function(v) .obtener_label_var(v, instrumento, data), character(1))
      )

      shiny::updateSelectizeInput(session, "cruce_var", choices = cruce_lab, selected = cruce_choices[1] %||% "", server = FALSE)
    }, ignoreInit = TRUE)

    .update_iter_var_choices <- function() {
      if (!isTRUE(input$iter_enabled)) {
        shiny::updateSelectizeInput(session, "iter_var", choices = c("Sin iteración" = ""), selected = "", server = FALSE)
        return(invisible(NULL))
      }

      sec <- input$iter_seccion
      if (is.null(sec) || !nzchar(sec) || is.null(secciones_limpias[[sec]])) {
        shiny::updateSelectizeInput(session, "iter_var", choices = c("Sin iteración" = ""), selected = "", server = FALSE)
        return(invisible(NULL))
      }

      vars_sec <- secciones_limpias[[sec]]
      iter_choices <- unique(vars_sec[vars_sec %in% vars_so])
      iter_choices <- setdiff(iter_choices, c(input$main_var %||% "", input$cruce_var %||% ""))

      iter_lab <- stats::setNames(
        iter_choices,
        vapply(iter_choices, function(v) .obtener_label_var(v, instrumento, data), character(1))
      )

      ch <- c("Sin iteración" = "", iter_lab)
      cur <- input$iter_var %||% ""
      sel <- if (cur %in% unname(ch)) cur else ""
      shiny::updateSelectizeInput(session, "iter_var", choices = ch, selected = sel, server = FALSE)
      invisible(NULL)
    }

    shiny::observeEvent(input$iter_seccion, .update_iter_var_choices(), ignoreInit = FALSE)
    shiny::observeEvent(input$main_var, .update_iter_var_choices(), ignoreInit = TRUE)
    shiny::observeEvent(input$cruce_var, .update_iter_var_choices(), ignoreInit = TRUE)
    shiny::observeEvent(input$iter_enabled, .update_iter_var_choices(), ignoreInit = TRUE)

    # -------------------------------------------------------------------------
    # Header gráfico
    # -------------------------------------------------------------------------
    output$rel_plot_header <- shiny::renderUI({
      obj <- rel_obj_plot()
      base_obj <- rel_obj_base()
      var_main <- obj$var_main %||% base_obj$var_main
      var_cruce <- obj$var_cruce %||% base_obj$var_cruce
      shiny::req(var_main, var_cruce)

      t_main  <- .wrap_titulo_html(.obtener_label_var(var_main, instrumento, data), width = 110)
      t_cruce <- .obtener_label_var(var_cruce, instrumento, data)

      subt <- paste0("Cruce: ", t_cruce)
      if (isTRUE(obj$iter_active)) {
        subt <- paste0(
          subt,
          " | Iteración: ",
          as.character(obj$iter_var_label %||% "Variable"),
          " = ",
          as.character(obj$iter_level_label %||% "")
        )
      }

      shiny::tagList(
        shiny::div(class = "cardbox-title", shiny::HTML(t_main)),
        shiny::div(
          class = "cardbox-subtitle",
          style = paste0("color:", COLOR_TEXTO_SUAVE, ";"),
          subt
        )
      )
    })

    # -------------------------------------------------------------------------
    # Reactivos centrales
    # -------------------------------------------------------------------------
    rel_obj_base <- shiny::reactive({
      shiny::req(input$main_var, input$cruce_var)

      var_main  <- input$main_var
      var_cruce <- input$cruce_var

      if (!(var_cruce %in% vars_so)) {
        return(list(error = "No es posible cruzar con la selección actual."))
      }

      df <- rel_data_filtrada()
      if (var_cruce %in% names(df)) df <- df[!is.na(df[[var_cruce]]), , drop = FALSE]
      if (!nrow(df)) return(list(error = "Sin datos disponibles."))

      survey <- instrumento$survey %||% NULL
      tp_main <- tipo_pregunta(var_main, survey = survey, sm_vars_force = vars_sm_madres, df = df)

      out_tab <- .build_cuerpo(df, var_main, var_cruce)

      list(
        df          = df,
        var_main    = var_main,
        var_cruce   = var_cruce,
        tipo_main   = tp_main,
        cuerpo      = out_tab$cuerpo,
        cruce_lbl   = out_tab$cruce_lbl,
        estr_labels = out_tab$estr_labels,
        error       = NULL
      )
    })

    rel_iter_payload <- shiny::reactive({
      base_obj <- rel_obj_base()
      iter_on <- isTRUE(input$iter_enabled)
      iter_var <- as.character(input$iter_var %||% "")[1]

      if (!iter_on || !nzchar(iter_var)) {
        return(list(
          active = FALSE,
          iter_var = NULL,
          iter_var_label = NULL,
          all_entries = list(),
          visible_entries = list(),
          hidden_count = 0L
        ))
      }

      if (!is.null(base_obj$error)) {
        return(list(
          active = TRUE,
          iter_var = iter_var,
          iter_var_label = .obtener_label_var(iter_var, instrumento, data),
          all_entries = list(),
          visible_entries = list(),
          hidden_count = 0L
        ))
      }

      df <- base_obj$df
      if (!(iter_var %in% names(df))) {
        return(list(
          active = TRUE,
          iter_var = iter_var,
          iter_var_label = .obtener_label_var(iter_var, instrumento, data),
          all_entries = list(),
          visible_entries = list(),
          hidden_count = 0L
        ))
      }

      survey <- instrumento$survey %||% NULL
      cats_iter <- get_categorias_so(iter_var, df, survey, orders_list %||% instrumento$orders_list %||% NULL)
      iter_codes  <- as.character(cats_iter$codes)
      iter_labels <- as.character(cats_iter$labels)
      if (!length(iter_codes)) {
        return(list(
          active = TRUE,
          iter_var = iter_var,
          iter_var_label = .obtener_label_var(iter_var, instrumento, data),
          all_entries = list(),
          visible_entries = list(),
          hidden_count = 0L
        ))
      }

      v_iter <- as.character(df[[iter_var]])
      usa_codes  <- any(v_iter %in% iter_codes)
      usa_labels <- any(v_iter %in% iter_labels)
      iter_keys <- if (usa_codes || !usa_labels) iter_codes else iter_labels
      iter_labs <- if (usa_codes || !usa_labels) iter_labels else iter_labels

      entries <- list()
      for (j in seq_along(iter_keys)) {
        key_j <- iter_keys[j]
        mask_j <- !is.na(v_iter) & v_iter == key_j
        df_j <- df[mask_j, , drop = FALSE]
        if (!nrow(df_j)) next

        out_tab <- .build_cuerpo(df_j, base_obj$var_main, base_obj$var_cruce)
        cuerpo_j <- out_tab$cuerpo %||% NULL
        if (!is.data.frame(cuerpo_j) || !nrow(cuerpo_j)) next

        i_total <- which(trimws(as.character(cuerpo_j$Opciones %||% "")) == "Total")[1]
        base_n <- if (!is.na(i_total) && "Total__n" %in% names(cuerpo_j)) {
          suppressWarnings(as.numeric(cuerpo_j$Total__n[i_total]))
        } else {
          NA_real_
        }

        tp_main_j <- tipo_pregunta(base_obj$var_main, survey = survey, sm_vars_force = vars_sm_madres, df = df_j)
        obj_j <- list(
          df = df_j,
          var_main = base_obj$var_main,
          var_cruce = base_obj$var_cruce,
          tipo_main = tp_main_j,
          cuerpo = cuerpo_j,
          cruce_lbl = out_tab$cruce_lbl,
          estr_labels = out_tab$estr_labels,
          error = NULL
        )

        entries[[length(entries) + 1L]] <- list(
          key = as.character(key_j),
          label = as.character(iter_labs[j] %||% key_j),
          base_n = if (is.finite(base_n)) base_n else 0,
          obj = obj_j
        )
      }

      if (length(entries)) {
        ord <- order(vapply(entries, function(e) -as.numeric(e$base_n %||% 0), numeric(1)))
        entries <- entries[ord]
      }

      max_show <- 12L
      visible_entries <- if (length(entries)) entries[seq_len(min(max_show, length(entries)))] else list()
      hidden_count <- max(0L, length(entries) - length(visible_entries))

      list(
        active = TRUE,
        iter_var = iter_var,
        iter_var_label = .obtener_label_var(iter_var, instrumento, data),
        all_entries = entries,
        visible_entries = visible_entries,
        hidden_count = hidden_count
      )
    })

    output$rel_table_subtitle <- shiny::renderUI({
      payload <- rel_iter_payload()
      txt <- if (isTRUE(payload$active)) {
        "Tabla de frecuencia por cruce e iteración."
      } else {
        "Tabla de frecuencia por cruce."
      }
      shiny::div(class = "cardbox-subtitle", txt)
    })

    output$iter_hidden_hint_ui <- shiny::renderUI({
      payload <- rel_iter_payload()
      if (!isTRUE(payload$active)) return(NULL)
      if (payload$hidden_count <= 0) return(NULL)
      shiny::div(
        class = "rel-iter-hint",
        paste0(
          "La vista rápida prioriza 12 de ",
          length(payload$all_entries),
          " niveles. El selector permite buscar todos."
        )
      )
    })

    iter_level_key <- shiny::reactiveVal("")

    shiny::observe({
      payload <- rel_iter_payload()
      entries <- payload$all_entries
      if (!isTRUE(payload$active) || !length(entries)) {
        iter_level_key("")
        return()
      }

      keys <- vapply(entries, function(e) as.character(e$key), character(1))
      cur <- as.character(iter_level_key() %||% "")[1]
      if (!nzchar(cur) || !(cur %in% keys)) {
        iter_level_key(keys[1])
      }
    })

    shiny::observeEvent(input$iter_level_select, {
      payload <- rel_iter_payload()
      entries <- payload$all_entries
      if (!isTRUE(payload$active) || !length(entries)) return()

      key <- as.character(input$iter_level_select %||% "")[1]
      keys <- vapply(entries, function(e) as.character(e$key), character(1))
      if (nzchar(key) && key %in% keys) {
        iter_level_key(key)
      }
    })

    output$rel_iter_btn_ui <- shiny::renderUI({
      payload <- rel_iter_payload()
      if (!isTRUE(payload$active)) return(NULL)

      entries <- payload$all_entries
      if (!length(entries)) return(NULL)

      keys <- vapply(entries, function(e) as.character(e$key), character(1))
      cur <- as.character(iter_level_key() %||% "")[1]
      idx <- which(keys == cur)[1]
      if (is.na(idx)) idx <- 1L
      pick <- entries[[idx]]
      items <- lapply(entries, function(e) {
        list(
          value = as.character(e$key %||% ""),
          label = as.character(e$label %||% ""),
          meta = paste0("N ", format(round(as.numeric(e$base_n %||% 0), 0), big.mark = ","))
        )
      })

      .interactivo_iter_popover_ui(
        ns = session$ns,
        select_id = "iter_level_select",
        current_label = as.character(pick$label),
        current_meta = paste0("N ", format(round(as.numeric(pick$base_n %||% 0), 0), big.mark = ",")),
        items = items,
        selected = as.character(pick$key),
        title = "Seleccionar nivel",
        note = paste0("Disponible: ", length(entries), " niveles")
      )
    })

    rel_obj_plot <- shiny::reactive({
      payload <- rel_iter_payload()
      base_obj <- rel_obj_base()
      if (!isTRUE(payload$active)) {
        base_obj$iter_active <- FALSE
        return(base_obj)
      }

      entries <- payload$all_entries
      if (!length(entries)) {
        return(list(error = "Sin niveles válidos para iterar con la selección actual."))
      }

      keys <- vapply(entries, function(e) as.character(e$key), character(1))
      cur <- as.character(iter_level_key() %||% "")[1]
      idx <- which(keys == cur)[1]
      if (is.na(idx)) idx <- 1L
      pick <- entries[[idx]]

      out <- pick$obj
      out$iter_active <- TRUE
      out$iter_var_label <- payload$iter_var_label
      out$iter_level_label <- pick$label
      out
    })

    # -------------------------------------------------------------------------
    # UI dinámica del gráfico
    # -------------------------------------------------------------------------
    output$rel_plot_ui <- shiny::renderUI({
      obj <- rel_obj_plot()
      if (!is.null(obj$error)) {
        return(shiny::div(style = paste0("padding:12px;color:", COLOR_TEXTO_SUAVE, ";"), obj$error))
      }

      if (identical(obj$tipo_main, "so")) {
        return(
          shiny::div(
            class = "rel-plot-stage",
            plotly::plotlyOutput(session$ns("rel_plot"), height = "520px")
          )
        )
      }

      shiny::div(
        class = "rel-plot-stage",
        shiny::uiOutput(session$ns("rel_sm_chips_ui"))
      )
    })

    # -------------------------------------------------------------------------
    # Leyenda SO externa
    # -------------------------------------------------------------------------
    output$rel_so_legend <- shiny::renderUI({

      obj <- rel_obj_plot()
      if (!is.null(obj$error)) return(NULL)
      if (!identical(obj$tipo_main, "so")) return(NULL)

      df <- obj$df
      var_main <- obj$var_main
      survey <- instrumento$survey %||% NULL

      cats_main <- get_categorias_so(
        var = var_main,
        df = df,
        survey = survey,
        orders_list = orders_list %||% instrumento$orders_list %||% NULL
      )

      codes_row <- as.character(cats_main$codes)
      opciones  <- as.character(cats_main$labels)

      if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0 && length(codes_row)) {
        codp <- as.character(codigos_perdidos)
        keep <- !(codes_row %in% codp)
        opciones <- opciones[keep]
      }

      pal <- .resolver_paleta_var(
        var = var_main,
        instrumento = instrumento,
        colores_apiladas_por_listname = colores_apiladas_por_listname,
        opcion_levels = unique(opciones)
      )

      legend_levels <- opciones

      shiny::div(
        class = "rel-legend",
        style = paste0(
          "margin-top:14px;",
          "padding:12px 14px;",
          "border:1px solid ", COLOR_BORDE, ";",
          "border-radius:14px;",
          "background:", COLOR_SUPERFICIE, ";"
        ),
        shiny::div(
          style = "display:flex; justify-content:center; width:100%;",
          shiny::div(
            style = "display:flex; flex-wrap:wrap; justify-content:center; gap:12px 18px; align-items:center; max-width:980px; width:100%;",
            lapply(legend_levels, function(lab) {
              col <- pal[[lab]] %||% unname(pal[lab]) %||% "#9aa4b2"

              shiny::div(
                style = "display:flex; align-items:center; gap:10px; max-width:360px;",
                shiny::span(style = paste0(
                  "display:inline-block;",
                  "width:16px; height:16px;",
                  "border-radius:4px;",
                  "background:", col, ";",
                  "box-shadow:0 0 0 1px rgba(0,0,0,0.06) inset;"
                )),
                shiny::span(
                  style = paste0(
                    "font-size:14px;",
                    "font-weight:500;",
                    "color:", COLOR_TEXTO, ";",
                    "line-height:1.15;",
                    "white-space:normal;",
                    "word-break:break-word;"
                  ),
                  lab
                )
              )
            })
          )
        )
      )
    })

    # -------------------------------------------------------------------------
    # UI chips SM
    # -------------------------------------------------------------------------
    output$rel_sm_chips_ui <- shiny::renderUI({
      obj <- rel_obj_plot()
      if (!is.null(obj$error)) return(NULL)
      if (!identical(obj$tipo_main, "sm")) return(NULL)

      df <- obj$df
      var_main <- obj$var_main

      spec <- .resolver_var_spec_safe(var_main, df)
      cols <- spec$cols %||% character(0)
      if (!length(cols)) {
        return(shiny::div(style = paste0("padding:12px;color:", COLOR_TEXTO_SUAVE, ";"), "SM sin dummies disponibles."))
      }

      codes <- sub(paste0("^", var_main, "\\."), "", cols)
      codes <- codes[nzchar(codes)]

      if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0) {
        codp <- as.character(codigos_perdidos)
        keep <- !(codes %in% codp)
        codes <- codes[keep]
      }

      if (!length(codes)) {
        return(shiny::div(style = paste0("padding:12px;color:", COLOR_TEXTO_SUAVE, ";"), "SM sin opciones graficables."))
      }

      if (length(codes) > MAX_SM_CHIPS) {
        return(shiny::div(
          style = paste0("padding:12px;color:", COLOR_TEXTO_SUAVE, ";"),
          "Variable con demasiadas opciones para graficar en chips. (Ver tabla)"
        ))
      }

      map <- spec$map_code_to_label %||% list()

      shiny::div(
        class = "rel-sm-chip-list",
        lapply(seq_along(codes), function(i) {
          code_i <- codes[i]
          lab_i  <- as.character(map[[code_i]] %||% code_i)
          out_id <- paste0("rel_sm_plot_", i)

          shiny::div(
            class = "rel-sm-chip",
            style = paste0(
              "border:1px solid ", COLOR_BORDE, ";",
              "border-radius:14px;",
              "padding:10px 12px;",
              "background:", COLOR_SUPERFICIE, ";",
              "animation-delay:", sprintf("%.2fs", 0.04 * i), ";"
            ),
            shiny::div(
              style = paste0(
                "font-size:12px;",
                "font-weight:400;",
                "color:", COLOR_TEXTO, ";",
                "margin:0 0 8px 0;"
              ),
              lab_i
            ),
            plotly::plotlyOutput(session$ns(out_id), height = "260px")
          )
        })
      )
    })

    # -------------------------------------------------------------------------
    # Render SO
    # -------------------------------------------------------------------------
    output$rel_plot <- plotly::renderPlotly({
      obj <- rel_obj_plot()
      if (!is.null(obj$error)) {
        return(
          plotly::plot_ly() |>
            plotly::layout(
              annotations = list(list(
                text = obj$error,
                showarrow = FALSE,
                font = list(color = COLOR_TEXTO_SUAVE)
              )),
              paper_bgcolor = COLOR_SUPERFICIE,
              plot_bgcolor  = COLOR_SUPERFICIE
            ) |>
            plotly::config(displayModeBar = FALSE, responsive = TRUE)
        )
      }

      if (!identical(obj$tipo_main, "so")) return(NULL)
      .plot_so_so(obj$df, obj$var_main, obj$var_cruce)
    })

    # -------------------------------------------------------------------------
    # Render SM chips
    # -------------------------------------------------------------------------
    shiny::observe({
      obj <- rel_obj_plot()
      if (!is.null(obj$error)) return()
      if (!identical(obj$tipo_main, "sm")) return()

      df <- obj$df
      var_main  <- obj$var_main
      var_cruce <- obj$var_cruce

      spec <- .resolver_var_spec_safe(var_main, df)
      cols <- spec$cols %||% character(0)
      if (!length(cols)) return()

      codes <- sub(paste0("^", var_main, "\\."), "", cols)
      codes <- codes[nzchar(codes)]

      if (!is.null(codigos_perdidos) && length(codigos_perdidos) > 0) {
        codp <- as.character(codigos_perdidos)
        keep <- !(codes %in% codp)
        codes <- codes[keep]
      }

      if (!length(codes)) return()
      if (length(codes) > MAX_SM_CHIPS) return()

      map <- spec$map_code_to_label %||% list()

      for (i in seq_along(codes)) {
        local({
          ii <- i
          code_i <- codes[ii]
          lab_i  <- as.character(map[[code_i]] %||% code_i)
          out_id <- paste0("rel_sm_plot_", ii)

          output[[out_id]] <- plotly::renderPlotly({
            .plot_sm_option_chip(
              df = df,
              var_madre = var_main,
              code = code_i,
              opt_label = lab_i,
              var_cruce = var_cruce,
              cols_dummies = cols,
              col_compact  = NA_character_
            )
          })
        })
      }
    })

    shiny::observe({
      base_obj <- rel_obj_base()
      payload <- rel_iter_payload()
      enabled <- if (isTRUE(payload$active)) {
        length(payload$all_entries) > 0
      } else {
        is.null(base_obj$error) && is.data.frame(base_obj$cuerpo) && nrow(base_obj$cuerpo) > 0
      }
      .interactivo_set_download_state(session, "rel_tabla_descargar", enabled = enabled)
    })

    output$rel_tabla_descargar <- shiny::downloadHandler(
      filename = function() {
        main_tok <- .clean_file_token(input$main_var)
        cruce_tok <- .clean_file_token(input$cruce_var)
        payload <- rel_iter_payload()
        iter_tok <- if (isTRUE(payload$active) && nzchar(payload$iter_var %||% "")) {
          paste0("_iter_", .clean_file_token(payload$iter_var))
        } else {
          ""
        }
        ts <- format(Sys.time(), "%Y%m%d_%H%M%S")
        paste0("relacion_", main_tok, "_x_", cruce_tok, iter_tok, "_", ts, ".xlsx")
      },
      content = function(file) {
        base_obj <- rel_obj_base()
        payload <- rel_iter_payload()

        if (!isTRUE(payload$active)) {
          if (!is.null(base_obj$error)) stop("No hay datos para exportar.", call. = FALSE)
          .write_relacion_excel(path = file, obj_base = base_obj)
          return(invisible(NULL))
        }

        if (!length(payload$all_entries)) stop("No hay iteraciones válidas para exportar.", call. = FALSE)
        .write_relacion_excel(
          path = file,
          obj_base = base_obj,
          iter_entries = payload$all_entries,
          iter_var_label = payload$iter_var_label
        )
      }
    )

    # -------------------------------------------------------------------------
    # Tabla DT
    # -------------------------------------------------------------------------
    .build_rel_dt_widget <- function(obj) {
      if (!is.list(obj)) {
        return(DT::datatable(
          data.frame(Mensaje = "Sin datos disponibles."),
          rownames = FALSE,
          options = list(paging = FALSE, searching = FALSE, info = FALSE, ordering = FALSE)
        ))
      }

      if (!is.null(obj$error)) {
        return(DT::datatable(
          data.frame(Mensaje = obj$error),
          rownames = FALSE,
          options = list(
            paging    = FALSE,
            searching = FALSE,
            info      = FALSE,
            ordering  = FALSE,
            orderCellsTop = TRUE,
            scrollX   = TRUE,
            language  = list(url = "//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"),
            columnDefs = list(list(className = "dt-center", targets = "_all"))
          )
        ))
      }

      cuerpo <- obj$cuerpo

      container <- .dt_container_multihdr(
        cuerpo = cuerpo,
        cruce_lbl = obj$cruce_lbl,
        estr_labels = obj$estr_labels
      )

      is_pct <- grepl("__pct$", names(cuerpo))
      is_n   <- grepl("__n$", names(cuerpo))

      DT::datatable(
        cuerpo,
        rownames  = FALSE,
        container = container,
        class = "display nowrap compact rel-table-dt",
        options = list(
          paging    = FALSE,
          searching = FALSE,
          info      = FALSE,
          ordering  = FALSE,
          autoWidth = TRUE,
          scrollX   = TRUE,
          scrollCollapse = TRUE,
          language  = list(url = "//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"),
          columnDefs = list(
            list(className = "dt-left",  targets = 0),
            list(className = "dt-right", targets = which(is_n) - 1),
            list(className = "dt-right", targets = which(is_pct) - 1)
          )
        )
      ) |>
        DT::formatRound(columns = which(is_n), digits = 0) |>
        DT::formatPercentage(columns = which(is_pct), digits = 1)
    }

    output$rel_tabla_panel_ui <- shiny::renderUI({
      payload <- rel_iter_payload()
      if (!isTRUE(payload$active)) {
        return(DT::dataTableOutput(session$ns("rel_tabla")))
      }

      entries <- payload$visible_entries
      if (!length(entries)) {
        return(
          shiny::div(
            class = "table-empty-hint",
            shiny::div(class = "table-empty-title", "Sin niveles válidos"),
            shiny::div(
              class = "table-empty-subtitle",
              "No hay suficientes datos para iterar con la variable seleccionada."
            )
          )
        )
      }

      keys <- vapply(entries, function(e) as.character(e$key), character(1))
      cur <- as.character(iter_level_key() %||% "")[1]
      idx <- which(keys == cur)[1]
      if (is.na(idx)) idx <- 1L
      pick <- entries[[idx]]

      shiny::tagList(
        if (payload$hidden_count > 0) shiny::div(
          class = "rel-iter-note",
          paste0(
            "Se muestran 12 niveles con mayor base. ",
            "Hay ",
            payload$hidden_count,
            " niveles adicionales en la descarga Excel."
          )
        ),
        shiny::div(
          class = "rel-iter-table-stack",
          shiny::div(
            class = "rel-iter-table-block",
            shiny::div(
              class = "rel-iter-table-head",
              shiny::div(class = "rel-iter-table-title", paste0("Nivel: ", pick$label)),
              shiny::div(
                class = "rel-iter-table-subtitle",
                paste0(
                  "Base: ",
                  format(round(as.numeric(pick$base_n %||% 0), 0), big.mark = ",")
                )
              )
            ),
            DT::dataTableOutput(session$ns("rel_tabla_iter_activa"))
          )
        )
      )
    })

    output$rel_tabla <- DT::renderDataTable({
      .build_rel_dt_widget(rel_obj_base())
    })

    output$rel_tabla_iter_activa <- DT::renderDataTable({
      payload <- rel_iter_payload()
      shiny::req(isTRUE(payload$active))
      entries <- payload$visible_entries
      shiny::req(length(entries) > 0)

      keys <- vapply(entries, function(e) as.character(e$key), character(1))
      cur <- as.character(iter_level_key() %||% "")[1]
      idx <- which(keys == cur)[1]
      if (is.na(idx)) idx <- 1L
      .build_rel_dt_widget(entries[[idx]]$obj)
    })

    invisible(NULL)
  })
}
