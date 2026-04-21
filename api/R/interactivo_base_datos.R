# =============================================================================
# Tab 3: Base de datos (UI + server) — SM dummies visibles + diccionario elegante
# =============================================================================
#' @keywords internal
#' @noRd

.ui_tab_base_datos <- function(ctx) {

  shiny::sidebarLayout(
    shiny::sidebarPanel(
      width = 3,
      class = "sidebar-panel-base",
      shiny::div(
        class = "sidebar-stack",

        shiny::div(
          class = "sidebar-module",
          shiny::h3(class = "sidebar-module-title", "Vista"),
          shiny::p(
            class = "sidebar-module-help",
            "Define qué preguntas mostrar en la tabla."
          ),

          shiny::div(
            class = "toggle-row",
            shiny::span(class = "toggle-label", "Codigos"),
            shiny::tags$label(
              class = "switch",
              shiny::tags$input(id = "vista_etiquetas", type = "checkbox", checked = "checked"),
              shiny::tags$span(class = "slider")
            ),
            shiny::span(class = "toggle-label", "Etiquetas")
          ),
          shiny::uiOutput("data_vars_check_ui"),

          shiny::div(
            class = "sidebar-quick-actions",
            shiny::actionButton(
              inputId = "data_vars_todas",
              label = "Todas",
              class = "sidebar-quick-btn"
            ),
            shiny::actionButton(
              inputId = "data_vars_ninguna",
              label = "Ninguna",
              class = "sidebar-quick-btn"
            )
          )
        ),

        shiny::div(
          class = "sidebar-module sidebar-module-download",
          shiny::h3(class = "sidebar-module-title", "Descargar datos"),
          shiny::p(
            class = "sidebar-module-help",
            "Exporta la vista actual con filtros activos."
          ),
          shiny::div(
            class = "sidebar-collapse-panel",
            shiny::div(
              class = "sidebar-download-controls",
              shiny::div(
                class = "sidebar-download-format",
                shiny::selectInput(
                  inputId = "data_formato_descarga",
                  label = "Formato",
                  choices = c("Excel" = "xlsx", "CSV" = "csv"),
                  selected = "xlsx"
                )
              ),
              shiny::div(
                class = "sidebar-download-action",
                shiny::downloadButton(
                  outputId = "data_descargar",
                  label = "Descargar datos",
                  class = "btn sidebar-download-btn"
                )
              )
            ),
            shiny::uiOutput("data_descarga_resumen_ui")
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
            class = "cardbox cardbox-data",
            shiny::div(
              class = "cardbox-header",
              shiny::div(class = "cardbox-title", "Base de datos"),
              shiny::div(class = "cardbox-subtitle", "Búsqueda, filtrado, ordenamiento y paginación disponibles.")
            ),
            shiny::div(
              id = "diccionario_flotante",
              class = "dictionary-popover",
              shiny::div(
                class = "dictionary-popover-header",
                shiny::div(class = "dictionary-popover-title", "Libro de códigos"),
                shiny::tags$button(
                  type = "button",
                  class = "dictionary-popover-close",
                  `aria-label` = "Cerrar libro de códigos",
                  "\u00d7"
                )
              ),
              shiny::div(
                class = "dictionary-popover-body",
                shiny::selectInput(
                  inputId  = "dicc_seccion",
                  label    = "Sección",
                  choices  = stats::setNames(ctx$secciones_nombres, ctx$secciones_nombres),
                  selected = ctx$secciones_nombres[1]
                ),
                shiny::selectInput(
                  inputId  = "dicc_var",
                  label    = "Variable",
                  choices  = c(),
                  selected = NULL
                ),
                shiny::div(
                  class = "dictionary-popover-card",
                  shiny::uiOutput("diccionario_detalle")
                )
              )
            ),
            shiny::uiOutput("tabla_data_ui")
          )
        )
      ),

      shiny::div(style = "height: 48px;")
    )
  )
}

#' @keywords internal
#' @noRd
.server_tab_base_datos <- function(ctx, input, output, session) {

  data        <- ctx$data
  instrumento <- ctx$instrumento

  `%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

  # ---------------------------------------------------------------------------
  # Helpers: labels / list_name / map code->label choices
  # ---------------------------------------------------------------------------
  .obtener_label_var <- get0(
    ".obtener_label_var",
    ifnotfound = function(var, instrumento, data = NULL) {
      surv <- instrumento$survey
      if (!is.null(surv) && all(c("name","label") %in% names(surv)) && var %in% surv$name) {
        lab <- surv$label[surv$name == var][1]
        if (!is.na(lab) && nzchar(as.character(lab))) return(as.character(lab))
      }
      if (!is.null(data) && var %in% names(data)) {
        vl <- attr(data[[var]], "label", exact = TRUE)
        if (!is.null(vl) && nzchar(as.character(vl))) return(as.character(vl))
      }
      as.character(var)
    }
  )

  .get_list_name <- function(var) {
    surv <- instrumento$survey %||% NULL
    if (is.null(surv) || !all(c("name","list_name") %in% names(surv))) return(NA_character_)
    ln <- get_list_name(var, surv)
    if (is.na(ln) || !nzchar(ln)) NA_character_ else ln
  }

  .choice_map <- function(var) {
    ln <- .get_list_name(var)
    ch <- instrumento$choices %||% NULL
    if (is.null(ch) || !all(c("list_name","name") %in% names(ch))) return(list())

    label_col <- if ("label" %in% names(ch)) "label" else {
      cand <- grep("^label(::|$)", names(ch), value = TRUE)
      if (length(cand)) cand[1] else NULL
    }
    if (is.null(label_col) || !label_col %in% names(ch)) return(list())
    if (is.na(ln) || !nzchar(ln)) return(list())

    chv <- ch[ch$list_name == ln, , drop = FALSE]
    if (!nrow(chv)) return(list())

    as.list(stats::setNames(as.character(chv[[label_col]]), as.character(chv$name)))
  }

  .is_sm_madre <- function(v) {
    v %in% (ctx$sm_madres %||% character(0)) ||
      v %in% (ctx$vars_sm_madres %||% character(0)) ||
      v %in% (ctx$vars_sm_madres_all %||% character(0)) ||
      v %in% (ctx$vars_diccionario_sm %||% character(0)) ||
      v %in% names(ctx$sm_cols_map %||% list())
  }

  .sm_cols <- function(v) {
    cols <- (ctx$sm_cols_map[[v]] %||% character(0))
    cols <- cols[cols %in% names(data)]
    cols
  }

  # Etiqueta de una dummy: "Pregunta — Opción"
  .resolver_dummy_parts <- function(col_dummy) {
    base_raw <- sub("\\..*$", "", as.character(col_dummy))
    code     <- sub("^.*\\.", "", as.character(col_dummy))

    cand <- unique(c(
      base_raw,
      sub("_recod$", "", base_raw),
      sub("_ORIG$", "", base_raw)
    ))
    cand <- cand[!is.na(cand) & nzchar(cand)]

    madre <- if (length(cand)) cand[1] else base_raw

    for (cc in cand) {
      if (cc %in% names(ctx$sm_cols_map %||% list())) {
        madre <- cc
        break
      }
      if (length(.choice_map(cc))) {
        madre <- cc
        break
      }
    }

    list(madre = madre, code = code)
  }

  .label_dummy <- function(col_dummy) {
    parts <- .resolver_dummy_parts(col_dummy)
    madre <- parts$madre
    code  <- parts$code

    preg <- .obtener_label_var(madre, instrumento, data = NULL)

    map <- .choice_map(madre)
    opt <- as.character(map[[code]] %||% code)

    paste0(preg, " — ", opt)
  }

  # ---------------------------------------------------------------------------
  # Diccionario: variables por sección
  # ---------------------------------------------------------------------------
  dicc_vars_por_seccion <- lapply(ctx$secciones_limpias, function(vs) {
    intersect(vs, ctx$vars_diccionario_all)
  })

  shiny::observe({
    sec <- input$dicc_seccion
    vars_sec <- dicc_vars_por_seccion[[sec]] %||% character(0)

    if (!length(vars_sec)) {
      shiny::updateSelectInput(session, "dicc_var", choices = c(), selected = NULL)
    } else {
      ch <- stats::setNames(vars_sec, vapply(vars_sec, ctx$label_var, character(1)))
      shiny::updateSelectInput(session, "dicc_var", choices = ch, selected = vars_sec[1])
    }
  })

  output$diccionario_detalle <- shiny::renderUI({
    v <- input$dicc_var

    if (is.null(v) || !nzchar(v) || !v %in% ctx$vars_diccionario_all) {
      return(shiny::div(style="font-size:12px;color:#5f6b7a;", "Sin variables codificadas disponibles."))
    }

    surv <- instrumento$survey
    nm <- as.character(surv$name)
    i  <- which(!is.na(nm) & trimws(nm) == trimws(v))[1]
    fila <- if (!is.na(i)) surv[i, , drop = FALSE] else surv[0, , drop = FALSE]
    tipo_survey <- if (nrow(fila)) tolower(as.character(fila$type[1])) else ""

    es_so <- grepl("^select_one\\b", tipo_survey)
    es_sm <- grepl("^select_multiple\\b", tipo_survey)

    # Etiqueta: para SM usar etiqueta de la madre (aunque no exista como columna)
    etq <- .obtener_label_var(v, instrumento, data = data)

    # Medición: para SO usar attr si existe; para SM forzar NOMINAL elegante
    meas <- if (es_so && v %in% names(data)) attr(data[[v]], "measure", exact = TRUE) else NULL
    meas <- if (!is.null(meas) && nzchar(as.character(meas))) toupper(as.character(meas)) else {
      if (es_sm) "NOMINAL" else "—"
    }

    tipo <- if (es_so) "Selección única" else if (es_sm) "Selección múltiple" else "Variable codificada"

    shiny::tagList(
      shiny::div(class="dicc-kv",
                 shiny::div(class="dicc-k","Variable"), shiny::div(class="dicc-v", v),
                 shiny::div(class="dicc-k","Etiqueta"), shiny::div(class="dicc-v", as.character(etq)),
                 shiny::div(class="dicc-k","Tipo"),     shiny::div(class="dicc-v", tipo),
                 shiny::div(class="dicc-k","Medición"), shiny::div(class="dicc-v", meas)
      ),
      shiny::hr(),
      shiny::div(style="font-size:12px;font-weight:800;color:#002457;margin-bottom:6px;", "Categorías"),
      DT::DTOutput("dicc_opciones")
    )
  })

  output$dicc_opciones <- DT::renderDT({
    v <- input$dicc_var
    if (is.null(v) || !nzchar(v) || !v %in% ctx$vars_diccionario_all) return(NULL)

    surv <- instrumento$survey
    nm <- as.character(surv$name)
    i  <- which(!is.na(nm) & trimws(nm) == trimws(v))[1]
    fila <- if (!is.na(i)) surv[i, , drop = FALSE] else surv[0, , drop = FALSE]
    tipo_survey <- if (nrow(fila)) tolower(as.character(fila$type[1])) else ""
    es_so <- grepl("^select_one\\b", tipo_survey)
    es_sm <- grepl("^select_multiple\\b", tipo_survey)

    ln <- if (nrow(fila) && "list_name" %in% names(fila)) as.character(fila$list_name[1]) else NA_character_
    ch <- instrumento$choices %||% NULL

    opts_df <- NULL
    if (!is.null(ch) && all(c("list_name","name") %in% names(ch)) &&
        !is.na(ln) && nzchar(ln)) {

      label_col <- if ("label" %in% names(ch)) "label" else {
        cand <- grep("^label(::|$)", names(ch), value = TRUE)
        if (length(cand)) cand[1] else NULL
      }

      if (!is.null(label_col) && label_col %in% names(ch)) {
        chv <- ch[ch$list_name == ln, c("name", label_col), drop = FALSE]
        if (nrow(chv)) {
          opts_df <- data.frame(
            Codigo   = as.character(chv$name),
            Etiqueta = as.character(chv[[label_col]]),
            stringsAsFactors = FALSE
          )
        }
      }
    }

    if (is.null(opts_df) || !nrow(opts_df)) {
      opts_df <- data.frame(Codigo = character(0), Etiqueta = character(0), stringsAsFactors = FALSE)
    }

    # Ocultar códigos perdidos salvo que se observen (SO o SM)
    cod_perd <- as.character(ctx$codigos_perdidos %||% character(0))
    if (length(cod_perd) > 0 && nrow(opts_df) > 0) {

      vals_obs <- character(0)

      if (es_so && v %in% names(data)) {
        x <- as.character(data[[v]])
        vals_obs <- unique(x[!is.na(x)])

      } else if (es_sm) {

        cols <- .sm_cols(v)
        if (length(cols)) {
          m <- data[, cols, drop = FALSE]
          m <- as.data.frame(lapply(m, function(z) suppressWarnings(as.numeric(as.character(z)))))
          cols_on <- cols[colSums(m == 1, na.rm = TRUE) > 0]
          if (length(cols_on)) {
            choice_codes <- sub(paste0("^", v, "\\."), "", cols_on)
            vals_obs <- unique(choice_codes)
          }
        }
      }

      keep_perd <- if (length(vals_obs)) intersect(cod_perd, vals_obs) else character(0)

      es_perd <- opts_df$Codigo %in% cod_perd
      opts_df <- opts_df[!es_perd | (opts_df$Codigo %in% keep_perd), , drop = FALSE]
    }

    DT::datatable(
      opts_df,
      rownames = FALSE,
      options = list(
        paging    = FALSE,
        searching = FALSE,
        info      = FALSE,
        language  = list(search = "Buscar:", zeroRecords = "Sin resultados")
      )
    )
  })

  # ---------------------------------------------------------------------------
  # 🔥 Base de datos: columnas visibles por sección (con expansión SM -> dummies)
  # ---------------------------------------------------------------------------
  vars_data_por_seccion <- lapply(ctx$secciones_limpias, function(vs) {

    vs0 <- intersect(vs, ctx$vars_data_visibles %||% names(data))

    # Expandir: si hay SM madre en la sección, añadir sus dummies (aunque la madre no sea columna)
    sm_madres_sec <- intersect(vs, names(ctx$sm_cols_map %||% list()))
    sm_dummies <- unique(unlist(lapply(sm_madres_sec, .sm_cols), use.names = FALSE))

    # Dejar solo columnas existentes en data
    cols <- unique(c(vs0[vs0 %in% names(data)], sm_dummies))
    cols
  })
  vars_data_por_seccion <- vars_data_por_seccion[vapply(vars_data_por_seccion, length, integer(1)) > 0]

  .label_columna <- function(vcol) {
    if (grepl("\\.", vcol)) {
      parts <- .resolver_dummy_parts(vcol)
      es_dummy_sm <- parts$madre %in% names(ctx$sm_cols_map %||% list()) ||
        length(.choice_map(parts$madre)) > 0
      if (isTRUE(es_dummy_sm)) return(.label_dummy(vcol))
    }

    if (vcol %in% names(data)) {
      lab <- attr(data[[vcol]], "label", exact = TRUE)
      if (!is.null(lab) && nzchar(as.character(lab))) return(as.character(lab))
    }

    .obtener_label_var(vcol, instrumento, data = NULL)
  }

  .vars_seccion <- function(sec) {
    vars_data_por_seccion[[sec]] %||% character(0)
  }

  .choices_vars_por_seccion <- function(sec) {
    cols <- .vars_seccion(sec)
    if (!length(cols)) return(c())
    stats::setNames(cols, vapply(cols, .label_columna, character(1)))
  }

  sec_names <- names(vars_data_por_seccion)

  .slug <- function(x) {
    out <- iconv(as.character(x)[1], from = "", to = "ASCII//TRANSLIT")
    if (is.na(out) || !nzchar(out)) out <- as.character(x)[1]
    out <- tolower(gsub("[^a-z0-9]+", "_", out))
    out <- gsub("^_+|_+$", "", out)
    if (!nzchar(out)) out <- "sec"
    out
  }

  sec_ids <- make.unique(vapply(sec_names, .slug, character(1)), sep = "_")
  sec_id_map <- stats::setNames(sec_ids, sec_names)

  .sec_var_input_id <- function(sec) paste0("data_vars_sec_", sec_id_map[[sec]])
  .sec_toggle_input_id <- function(sec) paste0("data_vars_sec_toggle_", sec_id_map[[sec]])
  .sec_panel_id <- function(sec) paste0("data_vars_panel_", sec_id_map[[sec]])

  output$data_vars_check_ui <- shiny::renderUI({
    if (!length(sec_names)) return(NULL)

    shiny::tagList(
      lapply(sec_names, function(sec) {
        ch <- .choices_vars_por_seccion(sec)
        if (!length(ch)) return(NULL)

        var_id <- .sec_var_input_id(sec)
        tg_id  <- .sec_toggle_input_id(sec)
        pnl_id <- .sec_panel_id(sec)

        shiny::div(
          class = "vars-section-block",
          shiny::div(
            class = "vars-section-head",
            shiny::checkboxInput(
              inputId = tg_id,
              label = sec,
              value = FALSE,
              width = "100%"
            ),
            shiny::tags$a(
              class = "vars-section-expand collapsed",
              `data-toggle` = "collapse",
              href = paste0("#", pnl_id),
              role = "button",
              `aria-expanded` = "false",
              `aria-controls` = pnl_id,
              "Ver preguntas"
            )
          ),
          shiny::div(
            id = pnl_id,
            class = "collapse vars-section-panel",
            shiny::checkboxGroupInput(
              inputId = var_id,
              label = NULL,
              choices = ch,
              selected = character(0)
            )
          )
        )
      })
    )
  })

  for (sec in sec_names) {
    local({
      sec_i <- sec
      var_id <- .sec_var_input_id(sec_i)
      tg_id  <- .sec_toggle_input_id(sec_i)
      sync_master <- shiny::reactiveVal(FALSE)

      shiny::observeEvent(input[[tg_id]], {
        if (isTRUE(sync_master())) return()

        ch <- .choices_vars_por_seccion(sec_i)
        if (!length(ch)) return()

        sel <- if (isTRUE(input[[tg_id]])) unname(ch) else character(0)
        shiny::updateCheckboxGroupInput(
          session = session,
          inputId = var_id,
          choices = ch,
          selected = sel
        )
      }, ignoreInit = TRUE)

      shiny::observeEvent(input[[var_id]], {
        vals <- as.character(input[[var_id]] %||% character(0))
        want <- length(vals) > 0
        cur <- isTRUE(input[[tg_id]])
        if (!identical(cur, want)) {
          sync_master(TRUE)
          session$onFlushed(function() sync_master(FALSE), once = TRUE)
          shiny::updateCheckboxInput(session, inputId = tg_id, value = want)
        }
      }, ignoreInit = TRUE)
    })
  }

  shiny::observeEvent(input$data_vars_todas, {
    for (sec in sec_names) {
      ch <- .choices_vars_por_seccion(sec)
      if (!length(ch)) next

      shiny::updateCheckboxGroupInput(
        session = session,
        inputId = .sec_var_input_id(sec),
        choices = ch,
        selected = unname(ch)
      )
      shiny::updateCheckboxInput(
        session = session,
        inputId = .sec_toggle_input_id(sec),
        value = TRUE
      )
    }
  }, ignoreInit = TRUE)

  shiny::observeEvent(input$data_vars_ninguna, {
    for (sec in sec_names) {
      ch <- .choices_vars_por_seccion(sec)
      if (!length(ch)) next

      shiny::updateCheckboxGroupInput(
        session = session,
        inputId = .sec_var_input_id(sec),
        choices = ch,
        selected = character(0)
      )
      shiny::updateCheckboxInput(
        session = session,
        inputId = .sec_toggle_input_id(sec),
        value = FALSE
      )
    }
  }, ignoreInit = TRUE)

  .vars_seleccionadas_en_seccion <- function(sec) {
    cols_sec <- .vars_seccion(sec)
    if (!length(cols_sec)) return(character(0))

    in_id <- .sec_var_input_id(sec)
    tg_id <- .sec_toggle_input_id(sec)
    vals <- input[[in_id]]

    if (is.null(vals)) {
      if (isTRUE(input[[tg_id]])) return(cols_sec)
      return(character(0))
    }

    intersect(as.character(vals), cols_sec)
  }

  .vars_seleccionadas_globales <- function() {
    if (!length(sec_names)) return(character(0))
    unique(unlist(lapply(sec_names, .vars_seleccionadas_en_seccion), use.names = FALSE))
  }

  data_base_filtrada <- shiny::reactive({
    cols <- intersect(.vars_seleccionadas_globales(), names(data))
    if (!length(cols)) return(data[, character(0), drop = FALSE])
    data[, cols, drop = FALSE]
  })

  data_base_vista <- shiny::reactive({

    df <- data_base_filtrada()
    use_labels <- isTRUE(input$vista_etiquetas)
    if (!ncol(df)) return(df)

    if (use_labels) {

      # Primero: valores con labels (SO) si tu helper lo hace
      df2 <- ctx$.to_labels_df(df)

      # Luego: renombrar columnas:
      cn <- vapply(names(df2), function(vcol) {

        # Dummy SM: soporta columnas madre y madre_recod
        es_dummy_sm <- FALSE
        if (grepl("\\.", vcol)) {
          parts <- .resolver_dummy_parts(vcol)
          es_dummy_sm <- parts$madre %in% names(ctx$sm_cols_map %||% list()) ||
            length(.choice_map(parts$madre)) > 0
        }

        if (es_dummy_sm) {
          return(.label_dummy(vcol))
        }

        # SO/otras: label attr si existe; sino label del instrumento; sino nombre
        lab <- if (vcol %in% names(data)) attr(data[[vcol]], "label", exact = TRUE) else NULL
        if (!is.null(lab) && nzchar(as.character(lab))) return(as.character(lab))

        .obtener_label_var(vcol, instrumento, data = NULL)
      }, character(1))

      names(df2) <- make.unique(cn, sep = " | ")
      return(df2)
    }

    df
  })

  output$tabla_data_ui <- shiny::renderUI({
    df <- data_base_vista()

    if (!ncol(df)) {
      return(
        shiny::div(
          class = "table-empty-hint",
          shiny::div(class = "table-empty-title", "Sin datos que mostrar"),
          shiny::div(
            class = "table-empty-subtitle",
            "Selecciona preguntas en Vista para construir la tabla."
          )
        )
      )
    }

    DT::dataTableOutput("tabla_data")
  })

  # ---------------------------------------------------------------------------
  # Tabla DT
  # ---------------------------------------------------------------------------
  output$tabla_data <- DT::renderDataTable({

    df <- data_base_vista()
    if (!ncol(df)) return(NULL)

    use_labels <- isTRUE(input$vista_etiquetas)
    raw_df <- data_base_filtrada()
    raw_cols <- names(raw_df)

    col_w <- if (use_labels) 240 else 130

    .filter_options_col <- function(vcol, use_labels = TRUE) {
      if (grepl("\\.", vcol)) return(NULL)
      map <- .choice_map(vcol)
      if (!length(map)) return(NULL)

      vals <- if (isTRUE(use_labels)) {
        as.character(unname(unlist(map, use.names = FALSE)))
      } else {
        as.character(names(map))
      }
      vals <- vals[!is.na(vals) & nzchar(trimws(vals))]
      vals <- unique(vals)
      if (!length(vals)) return(NULL)
      vals
    }

    preset_opts <- list()
    if (length(raw_cols)) {
      for (ii in seq_along(raw_cols)) {
        vv <- raw_cols[ii]
        op <- .filter_options_col(vv, use_labels = use_labels)
        if (!is.null(op) && length(op)) {
          preset_opts[[as.character(ii - 1L)]] <- op
        }
      }
    }
    preset_opts_json <- jsonlite::toJSON(preset_opts, auto_unbox = TRUE, null = "null")

    cb_txt <- paste0(
      "function(settings) {
  var api = this.api();
  var thead = $(api.table().header());
  var container = $(api.table().container());
  var presetOptions = ", preset_opts_json, ";

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  }

  var left = container.find('div.dt-toolbar-left');
  var diccPanel = $('#diccionario_flotante');

  if (left.length) {
    if (left.find('.dt-dicc-btn').length < 1) {
      var diccBtn = $('<button type=\"button\" class=\"btn dt-dicc-btn\" title=\"Libro de códigos\" aria-label=\"Libro de códigos\"><span class=\"glyphicon glyphicon-book\"></span></button>');
      left.append(diccBtn);

      diccBtn.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var open = !diccPanel.hasClass('is-open');
        diccPanel.toggleClass('is-open', open);
        diccBtn.toggleClass('is-active', open);
      });
    }
  }

  if (!window.__diccPanelBound) {
    $(document).on('click.diccPanel', function(e) {
      var panel = $('#diccionario_flotante');
      if (!panel.length || !panel.hasClass('is-open')) return;
      if ($(e.target).closest('#diccionario_flotante, .dt-dicc-btn').length) return;
      panel.removeClass('is-open');
      $('.dt-dicc-btn').removeClass('is-active');
    });

    $(document).on('click.diccPanelClose', '#diccionario_flotante .dictionary-popover-close', function(e) {
      e.preventDefault();
      var panel = $('#diccionario_flotante');
      panel.removeClass('is-open');
      $('.dt-dicc-btn').removeClass('is-active');
    });

    window.__diccPanelBound = true;
  }

  if (left.length && left.find('.dt-reset-btn').length < 1) {
    var btn = $('<button type=\"button\" class=\"btn dt-reset-btn\">Restablecer filtros</button>');
    left.append(btn);

    btn.on('click', function() {
      api.search('');
      container.find('div.dataTables_filter input').val('');

      api.columns().every(function() {
        this.search('');
      });

      $(thead).find('tr.dt-filter-row th').each(function() {
        var $th = $(this);
        var sel = $th.find('select')[0];
        if (sel && sel.selectize) {
          sel.selectize.clear(true);
          sel.selectize.close();
        }
        $th.find('input[type=\"text\"]').val('');
      });

      $('.selectize-dropdown').hide();
      api.draw();
    });
  }

  if ($(thead).find('tr').length < 2) {
    var filterRow = $('<tr class=\"dt-filter-row\">').appendTo(thead);

    api.columns().every(function() {
      var col = this;
      var th  = $('<th>').appendTo(filterRow);

      var preset = presetOptions[String(col.index())] || null;
      var uniq = (Array.isArray(preset) && preset.length)
        ? preset.slice()
        : col.data().unique().toArray()
            .filter(function(x){ return x !== null && x !== undefined && x !== ''; });

      if (!(Array.isArray(preset) && preset.length)) {
        uniq.sort();
      }

      if ((Array.isArray(preset) && preset.length) || uniq.length <= 20) {

        var sel = $('<select multiple></select>')
          .css({
            'width':'100%',
            'font-size':'11px',
            'box-sizing':'border-box'
          })
          .appendTo(th);

        $('<option></option>').attr('value','__ALL__').text('(Todos)').appendTo(sel);

        uniq.forEach(function(v){
          $('<option></option>').attr('value', v).text(v).appendTo(sel);
        });

        var $sel = $(sel).selectize({
          plugins: ['remove_button'],
          maxItems: null,
          closeAfterSelect: false,
          hideSelected: false,
          placeholder: 'Filtrar...',
          dropdownParent: 'body',

          render: {
            option: function(item, escape) {
              var label = item.text || item.value;
              var isAll = (item.value === '__ALL__');
              return '<div style=\"display:flex;align-items:center;gap:8px;\">'
                + '<input type=\"checkbox\" style=\"pointer-events:none;\"/>'
                + '<span>' + escape(label) + '</span>'
                + (isAll ? '<span style=\"margin-left:auto;color:#5f6b7a;font-weight:700;\">*</span>' : '')
                + '</div>';
            },
            item: function(item, escape) {
              return '<div>' + escape(item.text || item.value) + '</div>';
            }
          },

          onChange: function(vals) {
            vals = vals || [];

            if (vals.length === 0 || vals.indexOf('__ALL__') >= 0) {
              col.search('').draw();
              return;
            }

            var rx = '^(' + vals.map(escapeRegex).join('|') + ')$';
            col.search(rx, true, false).draw();
          }
        });

        var inst = $sel[0].selectize;
        var $ctrl = $(inst.$control);
        $ctrl.css({
          'border':'1px solid #e6e9f2',
          'border-radius':'10px',
          'min-height':'30px',
          'padding':'2px 4px',
          'box-shadow':'none'
        });

      } else {

        var inp = $('<input type=\"text\" placeholder=\"Filtrar\"/>')
          .css({
            'width':'100%',
            'border':'1px solid #e6e9f2',
            'border-radius':'10px',
            'padding':'6px 8px',
            'font-size':'11px',
            'box-sizing':'border-box'
          })
          .appendTo(th);

        inp.on('keyup change clear', function() {
          if (col.search() !== this.value) {
            col.search(this.value).draw();
          }
        });
      }
    });
  }
}"
    )

    cb <- DT::JS(cb_txt)

    DT::datatable(
      df,
      rownames   = FALSE,
      extensions = c("Scroller"),
      options = list(
        destroy     = TRUE,
        serverSide  = FALSE,
        dom         = "<'dt-toolbar'<'dt-toolbar-left'><'dt-toolbar-right'f>>rt<'bottom'lip>",
        autoWidth   = FALSE,
        columnDefs  = list(list(width = paste0(col_w, "px"), targets = "_all")),
        deferRender = TRUE,
        scrollX     = TRUE,
        scrollY     = 700,
        scroller    = TRUE,
        pageLength  = 15,
        lengthMenu  = c(10, 15, 25, 50),
        initComplete = cb,
        language = list(
          lengthMenu   = "Mostrando _MENU_ registros",
          search       = "Buscar:",
          info         = "Mostrando _START_ a _END_ de _TOTAL_ registros",
          infoEmpty    = "Mostrando 0 a 0 de 0 registros",
          infoFiltered = "(filtrado de _MAX_ registros)",
          zeroRecords  = "Sin resultados",
          paginate     = list(previous = "Anterior", `next` = "Siguiente")
        )
      )
    )
  })

  data_exportable <- shiny::reactive({
    df <- data_base_vista()
    if (!ncol(df)) return(df)

    rows_all <- input$tabla_data_rows_all
    if (is.null(rows_all)) return(df)

    idx <- suppressWarnings(as.integer(rows_all))
    idx <- idx[!is.na(idx) & idx >= 1L & idx <= nrow(df)]
    if (!length(idx)) return(df[0, , drop = FALSE])

    df[idx, , drop = FALSE]
  })

  output$data_descarga_resumen_ui <- shiny::renderUI({
    df <- data_exportable()

    if (!ncol(df)) {
      return(
        shiny::div(
          class = "sidebar-download-summary sidebar-download-summary-empty",
          "Selecciona al menos una variable para habilitar la descarga."
        )
      )
    }

    shiny::div(
      class = "sidebar-download-summary",
      shiny::div(
        class = "sidebar-download-stat",
        paste0("Filas a exportar: ", format(nrow(df), big.mark = ","))
      ),
      shiny::div(
        class = "sidebar-download-stat",
        paste0("Columnas: ", format(ncol(df), big.mark = ","))
      ),
      shiny::div(
        class = "sidebar-download-note",
        "La descarga respeta preguntas visibles, vista códigos/etiquetas y filtros activos de la tabla."
      )
    )
  })

  shiny::observe({
    df <- data_exportable()
    .interactivo_set_download_state(session, "data_descargar", enabled = ncol(df) > 0L)
  })

  output$data_descargar <- shiny::downloadHandler(
    filename = function() {
      fmt <- tolower(as.character(input$data_formato_descarga %||% "xlsx")[1])
      ext <- if (fmt == "csv") "csv" else "xlsx"

      ts <- format(Sys.time(), "%Y%m%d_%H%M%S")
      paste0("base_datos_vista_", ts, ".", ext)
    },
    content = function(file) {
      df <- data_exportable()
      if (!ncol(df)) {
        stop("No hay columnas seleccionadas para exportar.", call. = FALSE)
      }

      fmt <- tolower(as.character(input$data_formato_descarga %||% "xlsx")[1])
      if (fmt == "csv") {
        utils::write.csv(df, file = file, row.names = FALSE, fileEncoding = "UTF-8", na = "")
      } else {
        .interactivo_write_simple_xlsx(path = file, data = df, sheet_name = "Base de datos")
      }
    }
  )
}
