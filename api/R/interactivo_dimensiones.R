# =============================================================================
# Tab 4: Dimensiones (UI + server)
# - Vista General / Indicadores
# - Motor visual automático (Radar -> Barras cuando no aplica)
# - Heatmap semafórico + cruce principal + iteración + filtros categóricos
# =============================================================================
#' @keywords internal
#' @noRd

.ui_tab_dimensiones <- function(ctx) {
  `%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

  cfg <- ctx$dimensiones$config %||% list()
  vis <- cfg$visual %||% list()
  show_total_default <- isTRUE(vis$incluir_total_default)

  shiny::sidebarLayout(
    shiny::sidebarPanel(
      width = 3,
      class = "sidebar-panel-base",
      shiny::div(
        class = "sidebar-stack",
        shiny::div(
          class = "sidebar-module sidebar-module-rel",
          shiny::h3(class = "sidebar-module-title", "Dimensiones"),
          shiny::p(
            class = "sidebar-module-help",
            "Explora resultados de forma simple: elige una vista, compara por grupos y aplica filtros."
          ),

          shiny::div(
            class = "sidebar-module-card",
            shiny::div(class = "sidebar-subtitle", "Vista"),
            shiny::p(
              class = "rel-sidebar-hint",
              shiny::HTML("<strong>General:</strong> resume el indicador por sus componentes.")
            ),
            shiny::p(
              class = "rel-sidebar-hint",
              shiny::HTML("<strong>Indicadores:</strong> abre el detalle por preguntas.")
            ),
            shiny::div(
              class = "toggle-row dim-vista-switch-row",
              shiny::span(class = "toggle-label dim-vista-label", "General"),
              shiny::tags$label(
                class = "switch",
                shiny::tags$input(id = "dim_vista_indicadores", type = "checkbox"),
                shiny::tags$span(class = "slider")
              ),
              shiny::span(class = "toggle-label dim-vista-label", "Indicadores")
            ),
            shiny::selectizeInput(
              inputId = "dim_objetivo",
              label = "Selecciona un indicador",
              choices = c(),
              options = list(dropdownParent = "body")
            ),
            shiny::uiOutput("dim_objetivo_help_ui")
          ),
          shiny::div(
            class = "sidebar-module-card rel-sidebar-card-gap",
            shiny::div(class = "sidebar-subtitle", "Comparación"),
            shiny::selectizeInput(
              inputId = "dim_principal_seccion",
              label = "Sección",
              choices = c(),
              selected = "",
              options = list(dropdownParent = "body")
            ),
            shiny::selectizeInput(
              inputId = "dim_principal_var",
              label = "Comparar por",
              choices = c("Sin cruce" = ""),
              selected = "",
              options = list(dropdownParent = "body")
            ),
            shiny::div(
              class = "toggle-row",
              shiny::span(class = "toggle-label", "Iterar por"),
              shiny::tags$label(
                class = "switch",
                shiny::tags$input(id = "dim_iter_enabled", type = "checkbox"),
                shiny::tags$span(class = "slider")
              )
            ),
            shiny::p(
              class = "rel-sidebar-hint",
              "Activa esta opción para revisar el mismo resultado por niveles de otra variable."
            ),
            shiny::conditionalPanel(
              condition = "input['dim_iter_enabled']",
              shiny::selectizeInput(
                inputId = "dim_iter_seccion",
                label = "Sección",
                choices = c(),
                selected = "",
                options = list(dropdownParent = "body")
              ),
              shiny::selectizeInput(
                inputId = "dim_iter_var",
                label = "Variable",
                choices = c("Selecciona variable" = ""),
                selected = "",
                options = list(dropdownParent = "body")
              ),
              shiny::uiOutput("dim_iter_hidden_hint_ui"),
              shiny::uiOutput("dim_iter_controls_ui")
            ),
            shiny::div(
              class = "toggle-row",
              shiny::span(class = "toggle-label", "Incluir total"),
              shiny::tags$label(
                class = "switch",
                if (isTRUE(show_total_default)) {
                  shiny::tags$input(id = "dim_show_total", type = "checkbox", checked = "checked")
                } else {
                  shiny::tags$input(id = "dim_show_total", type = "checkbox")
                },
                shiny::tags$span(class = "slider")
              )
            ),
            shiny::p(
              class = "rel-sidebar-hint",
              "Usa el cruce para comparar el indicador entre categorías (ejemplo: servicio o distrito)."
            )
          ),

          shiny::div(
            class = "sidebar-module-card rel-sidebar-card-gap",
            shiny::div(
              class = "rel-iter-head",
              shiny::div(class = "sidebar-subtitle rel-iter-head-title", "Filtros"),
              shiny::tags$label(
                class = "switch rel-iter-head-switch",
                shiny::tags$input(id = "dim_filters_enabled", type = "checkbox"),
                shiny::tags$span(class = "slider")
              )
            ),
            shiny::conditionalPanel(
              condition = "input['dim_filters_enabled']",
              shiny::uiOutput("dim_filter_rows_ui"),
              shiny::uiOutput("dim_filter_active_ui"),
              shiny::div(
                class = "sidebar-quick-actions",
                shiny::actionButton(
                  inputId = "dim_filter_add",
                  label = "Agregar filtro",
                  class = "sidebar-quick-btn"
                ),
                shiny::actionButton(
                  inputId = "dim_limpiar_filtros",
                  label = "Restablecer filtros",
                  class = "sidebar-quick-btn"
                )
              ),
              shiny::uiOutput("dim_filter_hint_ui")
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
              class = "cardbox-header",
              shiny::div(class = "cardbox-title", "Mapa de calor"),
              shiny::uiOutput("dim_heatmap_subtitle_ui")
            ),
            shiny::div(class = "dim-plot-wrap", shiny::uiOutput("dim_heatmap_ui")),
            shiny::uiOutput("dim_heatmap_legend_ui")
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
              class = "cardbox-header rel-plot-header",
              shiny::div(
                class = "rel-plot-header-main",
                shiny::uiOutput("dim_main_title_ui"),
                shiny::uiOutput("dim_main_subtitle_ui")
              ),
              shiny::div(
                class = "rel-plot-header-actions",
                shiny::uiOutput("dim_focus_controls_ui")
              )
            ),
            shiny::div(class = "dim-plot-wrap", shiny::uiOutput("dim_main_plot_ui"))
          )
        )
      ),
      shiny::div(style = "height: 48px;")
    )
  )
}

#' @keywords internal
#' @noRd
.server_tab_dimensiones <- function(ctx, input, output, session) {
  `%||%` <- get0("%||%", ifnotfound = function(x, y) if (!is.null(x)) x else y)

  dim_ctx <- ctx$dimensiones %||% NULL
  if (is.null(dim_ctx) || !isTRUE(dim_ctx$habilitado)) return(invisible(NULL))

  data_dim <- dim_ctx$data
  instrumento <- ctx$instrumento
  cfg <- dim_ctx$config %||% list()

  if (!is.data.frame(data_dim) || !nrow(data_dim)) return(invisible(NULL))

  idx_meta <- attr(data_dim, "indices_meta", exact = TRUE)
  rec_meta <- attr(data_dim, "recodificacion_items_meta", exact = TRUE)

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

  .round_half_up <- function(x, digits = 0L) {
    s <- 10^as.integer(digits)
    out <- ifelse(
      is.na(x),
      NA_real_,
      ifelse(x >= 0, floor(x * s + 0.5), ceiling(x * s - 0.5)) / s
    )
    as.numeric(out)
  }

  .fmt_int <- function(x) {
    x <- .round_half_up(x, 0)
    ifelse(is.na(x), "", format(as.integer(x), trim = TRUE, scientific = FALSE))
  }

  .clamp <- function(x, lo, hi) max(lo, min(hi, x))

  .pretty_label <- function(x) {
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

  .label_var <- function(v) {
    f <- get0(".obtener_label_var", mode = "function", ifnotfound = NULL)
    if (is.function(f)) return(as.character(f(v, instrumento, data_dim)))
    as.character(v)
  }

  .label_data <- function(v) {
    if (!(v %in% names(data_dim))) return(.pretty_label(v))
    lb <- attr(data_dim[[v]], "label", exact = TRUE)
    lb <- as.character(lb %||% "")
    lb <- gsub("\\s*\\[0-100\\]$", "", lb)
    if (nzchar(trimws(lb))) trimws(lb) else .pretty_label(v)
  }

  lbl_idx <- .as_named_chr(cfg$labels_indices)
  lbl_sub <- .as_named_chr(cfg$labels_subindices)
  lbl_ind <- .as_named_chr(cfg$labels_indicadores)

  .label_idx <- function(v, key = NULL) {
    kk <- as.character(key %||% .nm_get(idx_var_to_key, v) %||% "")
    .first_nonempty(
      .nm_get(lbl_idx, kk),
      .nm_get(lbl_idx, v),
      if (nzchar(kk)) .pretty_label(kk) else "",
      .label_data(v),
      .label_var(v),
      .pretty_label(v)
    )
  }

  .label_sub <- function(v, key = NULL) {
    kk <- as.character(key %||% .nm_get(sub_var_to_key, v) %||% "")
    sub_etiq <- if (nzchar(kk) && kk %in% names(meta_subindices)) meta_subindices[[kk]]$etiqueta else NULL
    .first_nonempty(
      sub_etiq,
      .nm_get(lbl_sub, kk),
      .nm_get(lbl_sub, v),
      if (nzchar(kk)) .pretty_label(kk) else "",
      .label_data(v),
      .label_var(v),
      .pretty_label(v)
    )
  }

  .label_ind <- function(v) {
    src <- as.character(.nm_get(rec_out_to_src, v) %||% "")
    .first_nonempty(
      .nm_get(lbl_ind, v),
      if (nzchar(src)) .nm_get(lbl_ind, src) else "",
      .label_data(v),
      .label_var(v),
      if (nzchar(src)) .pretty_label(src) else "",
      .pretty_label(v)
    )
  }

  .wrap_axis_label <- function(x, width = 16L) {
    x <- as.character(x %||% "")
    if (!length(x)) return(x)
    if (requireNamespace("stringr", quietly = TRUE)) {
      out <- stringr::str_wrap(x, width = width)
    } else {
      out <- vapply(x, function(xx) paste(strwrap(xx, width = width), collapse = "\n"), character(1))
    }
    gsub("\n", "<br>", out, fixed = TRUE)
  }

  .add_alpha <- function(col, alpha = 0.22) {
    grDevices::adjustcolor(as.character(col %||% "#1F4E85"), alpha.f = alpha)
  }

  .palette_ipe <- function(n) {
    base_cols <- c(
      "#355C7D", "#6C5B7B", "#C06C84", "#F67280", "#F8B195",
      "#4575B4", "#74ADD1", "#ABD9E9", "#E0F3F8", "#FEE090",
      "#FDAE61", "#F46D43", "#D73027", "#66BD63", "#1A9850",
      "#006837", "#8C510A", "#BF812D", "#DFC27D", "#80CDC1",
      "#018571", "#35978F", "#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C"
    )
    if (n <= length(base_cols)) base_cols[seq_len(n)] else grDevices::colorRampPalette(base_cols)(n)
  }

  .palette_okabe <- function(n) {
    cols <- c("#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000")
    if (n <= length(cols)) cols[seq_len(n)] else grDevices::colorRampPalette(cols)(n)
  }

  vis_cfg <- cfg$visual %||% list()
  radar_min_ejes <- suppressWarnings(as.integer(vis_cfg$radar_min_ejes %||% 3L)[1])
  if (!is.finite(radar_min_ejes) || is.na(radar_min_ejes) || radar_min_ejes < 1L) radar_min_ejes <- 3L

  max_categorias_principal <- suppressWarnings(as.integer(vis_cfg$max_categorias_principal %||% 8L)[1])
  if (!is.finite(max_categorias_principal) || is.na(max_categorias_principal) || max_categorias_principal < 1L) {
    max_categorias_principal <- 8L
  }
  max_niveles_iteracion <- suppressWarnings(as.integer(vis_cfg$max_niveles_iteracion %||% 12L)[1])
  if (!is.finite(max_niveles_iteracion) || is.na(max_niveles_iteracion) || max_niveles_iteracion < 1L) {
    max_niveles_iteracion <- 12L
  }

  paleta_radar <- as.character(vis_cfg$paleta_radar %||% "okabe_ito")[1]
  if (!paleta_radar %in% c("okabe_ito", "ipe")) paleta_radar <- "okabe_ito"

  sem_cfg <- cfg$semaforo %||% list()
  sem_cortes <- suppressWarnings(as.numeric(sem_cfg$cortes %||% c(50, 75)))
  sem_cortes <- sem_cortes[is.finite(sem_cortes)]
  if (length(sem_cortes) < 2L) sem_cortes <- c(50, 75)
  sem_cortes <- sort(unique(sem_cortes))[1:2]
  sem_cortes <- pmax(0, pmin(100, sem_cortes))
  if (length(sem_cortes) < 2L || sem_cortes[1] >= sem_cortes[2]) sem_cortes <- c(50, 75)

  sem_cols <- as.character(sem_cfg$colores %||% character(0))
  nms_sem <- names(sem_cols %||% character(0))
  if (is.null(nms_sem)) nms_sem <- character(0)
  sem_col_rojo <- if ("rojo" %in% nms_sem) sem_cols[["rojo"]] else "#D84B55"
  sem_col_amb <- if ("ambar" %in% nms_sem) sem_cols[["ambar"]] else "#E0B44C"
  sem_col_ver <- if ("verde" %in% nms_sem) sem_cols[["verde"]] else "#3A9A5B"
  sem_col_na <- "#DFE5EE"

  .range_labels <- function(c1, c2) {
    c(
      paste0("Menor a ", .fmt_int(c1)),
      paste0(.fmt_int(c1), " - ", .fmt_int(c2 - 1)),
      paste0("Mayor a ", .fmt_int(c2 - 1))
    )
  }

  .group_colors <- function(groups) {
    groups <- unique(as.character(groups))
    if (!length(groups)) return(stats::setNames(character(0), character(0)))

    total_color <- as.character(ctx$theme_app$color_primario %||% "#0E3B74")
    others <- setdiff(groups, "Total")
    pal <- if (identical(paleta_radar, "ipe")) .palette_ipe(length(others)) else .palette_okabe(length(others))
    names(pal) <- others

    out <- stats::setNames(rep("#4B6E99", length(groups)), groups)
    if ("Total" %in% groups) out[["Total"]] <- total_color
    if (length(others)) out[others] <- pal[others]
    out
  }

  weight_col <- as.character(dim_ctx$weight_col %||% "")[1]
  if (!nzchar(weight_col) || !(weight_col %in% names(data_dim))) {
    weight_col <- if ("peso" %in% names(data_dim)) "peso" else ""
  }

  .safe_weights <- function(df) {
    if (!nzchar(weight_col) || !(weight_col %in% names(df))) return(rep(1, nrow(df)))
    w <- suppressWarnings(as.numeric(df[[weight_col]]))
    w[!is.finite(w) | is.na(w)] <- 0
    w
  }

  .weighted_mean <- function(x, w) {
    x <- suppressWarnings(as.numeric(x))
    w <- suppressWarnings(as.numeric(w))
    ok <- is.finite(x) & !is.na(x) & is.finite(w) & !is.na(w) & w > 0
    if (!any(ok)) return(NA_real_)
    sum(x[ok] * w[ok], na.rm = TRUE) / sum(w[ok], na.rm = TRUE)
  }

  .choices_label_col <- function(ch) {
    if (is.null(ch)) return(NULL)
    if ("label" %in% names(ch)) return("label")
    cand <- grep("^label(::|$)", names(ch), value = TRUE)
    if (length(cand)) cand[1] else NULL
  }

  .choice_map <- function(var) {
    surv <- instrumento$survey %||% NULL
    ch <- instrumento$choices %||% NULL
    if (is.null(surv) || is.null(ch) ||
        !all(c("name", "list_name") %in% names(surv)) ||
        !all(c("list_name", "name") %in% names(ch))) {
      return(stats::setNames(character(0), character(0)))
    }

    ln <- get_list_name(var, surv)
    if (is.na(ln) || !nzchar(ln)) return(stats::setNames(character(0), character(0)))

    col_lab <- .choices_label_col(ch)
    if (is.null(col_lab) || !(col_lab %in% names(ch))) return(stats::setNames(character(0), character(0)))

    chv <- ch[ch$list_name == ln, , drop = FALSE]
    if (!nrow(chv)) return(stats::setNames(character(0), character(0)))
    stats::setNames(as.character(chv[[col_lab]]), as.character(chv$name))
  }

  .level_label_map <- function(v) {
    if (!(v %in% names(data_dim))) return(stats::setNames(character(0), character(0)))

    out <- stats::setNames(character(0), character(0))
    labs <- attr(data_dim[[v]], "labels", exact = TRUE)
    if (!is.null(labs) && length(labs)) {
      out <- stats::setNames(as.character(unname(labs)), as.character(names(labs)))
    }

    map_choice <- .choice_map(v)
    if (length(map_choice)) out[names(map_choice)] <- map_choice
    out
  }

  .categorias_var <- function(df, var, w, max_levels = 12L) {
    out_empty <- list(
      rows = data.frame(value = character(0), label = character(0), base = numeric(0), stringsAsFactors = FALSE),
      total_levels = 0L,
      hidden_levels = 0L
    )

    if (!(var %in% names(df)) || !nrow(df)) return(out_empty)

    x <- trimws(as.character(df[[var]]))
    ok <- !is.na(x) & nzchar(x) & x != "NA"
    if (!any(ok)) return(out_empty)

    ww <- as.numeric(w)
    if (length(ww) != nrow(df)) ww <- rep(1, nrow(df))

    tab <- stats::aggregate(
      ww[ok],
      by = list(value = x[ok]),
      FUN = sum,
      na.rm = TRUE
    )
    names(tab) <- c("value", "base")
    tab <- tab[order(-tab$base, tab$value), , drop = FALSE]

    map <- .level_label_map(var)
    labs <- unname(map[tab$value])
    labs[is.na(labs) | !nzchar(labs)] <- tab$value[is.na(labs) | !nzchar(labs)]
    tab$label <- as.character(labs)

    n_tot <- nrow(tab)
    if (is.finite(max_levels) && max_levels > 0L && n_tot > max_levels) {
      tab <- tab[seq_len(max_levels), , drop = FALSE]
    }

    list(
      rows = tab[, c("value", "label", "base"), drop = FALSE],
      total_levels = n_tot,
      hidden_levels = max(0L, n_tot - nrow(tab))
    )
  }

  .build_catalog <- function(cat_in, mode = c("general", "indicadores")) {
    mode <- match.arg(mode)
    out <- list()

    if (is.list(cat_in) && length(cat_in)) {
      for (nm in names(cat_in)) {
        it <- cat_in[[nm]]
        if (!is.list(it)) next

        if (identical(mode, "general")) {
          id_var <- as.character(it$id %||% nm)[1]
          key <- as.character(it$key %||% .nm_get(idx_var_to_key, id_var) %||% nm)[1]
          axis_vars <- as.character(it$axis_vars %||% character(0))
          axis_vars <- axis_vars[axis_vars %in% names(data_dim)]
          if (!length(axis_vars) || !(id_var %in% names(data_dim))) next

          out[[id_var]] <- list(
            id = id_var,
            key = key,
            mode = "general",
            label = .label_idx(id_var, key),
            axis_vars = axis_vars,
            axis_labels = vapply(axis_vars, .label_sub, character(1))
          )
        } else {
          key <- as.character(it$key %||% it$id %||% nm)[1]
          bvar <- as.character(it$block_var %||% .nm_get(sub_key_to_var, key) %||% NA_character_)[1]
          axis_vars <- as.character(it$axis_vars %||% character(0))
          axis_vars <- axis_vars[axis_vars %in% names(data_dim)]
          if (!length(axis_vars)) next

          out[[key]] <- list(
            id = key,
            key = key,
            mode = "indicadores",
            label = .label_sub(bvar, key),
            block_var = bvar,
            axis_vars = axis_vars,
            axis_labels = vapply(axis_vars, .label_ind, character(1))
          )
        }
      }
    }

    out
  }

  catalog_general <- .build_catalog(cfg$catalog_general, mode = "general")
  catalog_indicadores <- .build_catalog(cfg$catalog_indicadores, mode = "indicadores")

  if (!length(catalog_general)) {
    for (nm in names(meta_indices)) {
      it <- meta_indices[[nm]]
      idx_var <- as.character(it$salida %||% NA_character_)[1]
      if (is.na(idx_var) || !nzchar(idx_var) || !(idx_var %in% names(data_dim))) next

      refs <- unique(c(
        as.character(it$refs_resueltas %||% character(0)),
        as.character(it$refs %||% character(0))
      ))
      axis_vars <- character(0)
      for (r in refs) {
        rv <- if (r %in% names(data_dim)) {
          r
        } else if (r %in% names(sub_key_to_var)) {
          as.character(sub_key_to_var[[r]])
        } else {
          NA_character_
        }
        if (!is.na(rv) && nzchar(rv) && rv %in% names(data_dim) && !(rv %in% axis_vars)) {
          axis_vars <- c(axis_vars, rv)
        }
      }
      if (!length(axis_vars)) next

      catalog_general[[idx_var]] <- list(
        id = idx_var,
        key = nm,
        mode = "general",
        label = .label_idx(idx_var, nm),
        axis_vars = axis_vars,
        axis_labels = vapply(axis_vars, .label_sub, character(1))
      )
    }
  }

  if (!length(catalog_indicadores)) {
    for (sk in names(meta_subindices)) {
      bl <- meta_subindices[[sk]]
      bvar <- as.character(bl$salida %||% NA_character_)[1]
      axis_vars <- unique(as.character(bl$vars %||% character(0)))
      axis_vars <- axis_vars[axis_vars %in% names(data_dim)]
      if (!length(axis_vars)) next

      catalog_indicadores[[sk]] <- list(
        id = sk,
        key = sk,
        mode = "indicadores",
        label = .label_sub(bvar, sk),
        block_var = bvar,
        axis_vars = axis_vars,
        axis_labels = vapply(axis_vars, .label_ind, character(1))
      )
    }
  }

  surv <- instrumento$survey %||% NULL
  so_all <- character(0)
  if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
    so_all <- as.character(surv$name[grepl("^select_one\\b", tolower(as.character(surv$type)))])
    so_all <- unique(so_all[so_all %in% names(data_dim)])
  }

  sec_map_raw <- ctx$secciones_limpias %||% list()
  if (!is.list(sec_map_raw) || !length(sec_map_raw)) {
    sec_map_raw <- list("Variables disponibles" = so_all)
  }
  if (is.null(names(sec_map_raw)) || !length(names(sec_map_raw))) {
    names(sec_map_raw) <- paste0("Sección ", seq_along(sec_map_raw))
  }

  section_var_map <- lapply(sec_map_raw, function(vs) {
    vv <- unique(as.character(vs))
    vv <- vv[vv %in% names(data_dim)]
    vv
  })
  section_var_map <- section_var_map[vapply(section_var_map, length, integer(1)) > 0]

  if (!length(section_var_map)) {
    fallback_vars <- if (length(so_all)) so_all else character(0)
    if (length(fallback_vars)) {
      section_var_map <- list("Variables disponibles" = fallback_vars)
    }
  }

  sec_names <- names(section_var_map)
  sec_default <- as.character(sec_names[1] %||% "")[1]
  principal_sec_choices <- stats::setNames(sec_names, sec_names)
  iter_sec_choices <- stats::setNames(sec_names, sec_names)

  .vars_for_section <- function(sec) {
    s <- as.character(sec %||% sec_default %||% "")[1]
    vv <- section_var_map[[s]] %||% character(0)
    vv <- vv[vv %in% names(data_dim)]
    labs <- vapply(vv, .label_var, character(1))
    list(vars = vv, labels = labs)
  }

  .choices_for_section <- function(sec, empty_label = "Sin selección") {
    out <- .vars_for_section(sec)
    c(stats::setNames("", empty_label), stats::setNames(out$vars, out$labels))
  }

  modes_disponibles <- shiny::reactive({
    modes <- character(0)
    if (length(catalog_general)) modes <- c(modes, "general")
    if (length(catalog_indicadores)) modes <- c(modes, "indicadores")
    unique(modes)
  })

  mode_activo <- shiny::reactive({
    modes <- modes_disponibles()
    if (!length(modes)) return("general")
    m <- if (isTRUE(input$dim_vista_indicadores)) "indicadores" else "general"
    if (m %in% modes) m else modes[1]
  })

  shiny::observe({
    modes <- modes_disponibles()
    if (!length(modes)) return()
    if (length(modes) == 1L) {
      shiny::updateCheckboxInput(
        session,
        "dim_vista_indicadores",
        value = identical(modes[1], "indicadores")
      )
    }
  })

  shiny::observe({
    mode <- mode_activo()
    obj_map <- if (identical(mode, "indicadores")) catalog_indicadores else catalog_general
    if (!length(obj_map)) {
      shiny::updateSelectizeInput(session, "dim_objetivo", choices = c(), selected = character(0), server = FALSE)
      return()
    }

    ids <- names(obj_map)
    labs <- vapply(obj_map, function(x) as.character(x$label %||% x$id), character(1))
    choices <- stats::setNames(ids, labs)

    cur <- as.character(input$dim_objetivo %||% "")[1]
    sel <- if (cur %in% ids) cur else ids[1]
    lbl <- if (identical(mode, "indicadores")) "Bloque a analizar" else "Índice a analizar"

    shiny::updateSelectizeInput(session, "dim_objetivo", label = lbl, choices = choices, selected = sel, server = FALSE)
  })

  output$dim_objetivo_help_ui <- shiny::renderUI({
    mode <- mode_activo()
    txt <- if (identical(mode, "indicadores")) {
      "Muestra cada bloque por sus preguntas recodificadas (aperturas)."
    } else {
      "Muestra el índice elegido y sus componentes para comparar brechas entre grupos."
    }
    shiny::p(class = "rel-sidebar-hint", txt)
  })

  shiny::observe({
    psec_cur <- as.character(input$dim_principal_seccion %||% sec_default)[1]
    psec_sel <- if (psec_cur %in% sec_names) psec_cur else sec_default
    shiny::updateSelectizeInput(
      session, "dim_principal_seccion",
      choices = principal_sec_choices,
      selected = psec_sel,
      server = FALSE
    )

    pvars <- .vars_for_section(psec_sel)$vars
    pcur <- as.character(input$dim_principal_var %||% "")[1]
    psel <- if (pcur %in% c("", pvars)) pcur else ""
    shiny::updateSelectizeInput(
      session, "dim_principal_var",
      choices = .choices_for_section(psec_sel, empty_label = "Sin cruce"),
      selected = psel,
      server = FALSE
    )

    isec_cur <- as.character(input$dim_iter_seccion %||% psec_sel %||% sec_default)[1]
    isec_sel <- if (isec_cur %in% sec_names) isec_cur else psec_sel
    if (!(isec_sel %in% sec_names)) isec_sel <- sec_default
    shiny::updateSelectizeInput(
      session, "dim_iter_seccion",
      choices = iter_sec_choices,
      selected = isec_sel,
      server = FALSE
    )

    ivars <- .vars_for_section(isec_sel)$vars
    ilabs <- .vars_for_section(isec_sel)$labels
    pv_now <- as.character(input$dim_principal_var %||% "")[1]
    keep_i <- !(ivars %in% c(pv_now))
    ivars <- ivars[keep_i]
    ilabs <- ilabs[keep_i]
    ichoices <- c("Selecciona variable" = "", stats::setNames(ivars, ilabs))
    icur <- as.character(input$dim_iter_var %||% "")[1]
    isel <- if (icur %in% c("", ivars)) icur else ""
    shiny::updateSelectizeInput(
      session, "dim_iter_var",
      choices = ichoices,
      selected = isel,
      server = FALSE
    )
  })

  .var_filtrable_dim <- function(v) {
    if (!(v %in% names(data_dim))) return(FALSE)

    surv <- instrumento$survey %||% NULL
    if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
      tipo <- tolower(as.character(surv$type[surv$name == v][1] %||% ""))
      if (grepl("^select_one\\b", tipo) || grepl("^select_multiple\\b", tipo)) return(TRUE)
    }

    if (length(.choice_map(v))) return(TRUE)

    x <- trimws(as.character(data_dim[[v]]))
    x <- x[!is.na(x) & nzchar(x) & x != "NA"]
    n_u <- length(unique(x))
    is.finite(n_u) && n_u > 1L && n_u <= 60L
  }

  filter_var_map <- lapply(section_var_map, function(vs) {
    vv <- unique(as.character(vs))
    vv <- vv[vapply(vv, .var_filtrable_dim, logical(1))]
    vv
  })
  filter_var_map <- filter_var_map[vapply(filter_var_map, length, integer(1)) > 0]
  filter_secs <- names(filter_var_map)
  filter_sec_default <- as.character(filter_secs[1] %||% sec_default %||% "")[1]

  dim_shared_ctx <- shiny::reactive({
    .dim_build_context(
      data_dim,
      instrumento = instrumento,
      config = cfg,
      secciones_limpias = ctx$secciones_limpias,
      theme_color = ctx$theme_app$color_primario %||% "#0E3B74",
      weight_col = dim_ctx$weight_col %||% NULL
    )
  })

  .catalogo_categorias_dim <- function(var, df_base) {
    if (!nzchar(var) || !(var %in% names(df_base))) {
      return(data.frame(value = character(0), label = character(0), stringsAsFactors = FALSE))
    }

    out <- data.frame(value = character(0), label = character(0), stringsAsFactors = FALSE)

    map_choice <- .choice_map(var)
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

  MAX_DIM_FILTROS <- 6L
  dim_filter_rows <- shiny::reactiveValues(ids = 1L, next_id = 2L, bound = integer(0))

  .df_sec_id <- function(id) paste0("dim_filter_seccion_", id)
  .df_var_id <- function(id) paste0("dim_filter_var_", id)
  .df_cat_id <- function(id) paste0("dim_filter_categorias_", id)
  .df_rm_id  <- function(id) paste0("dim_filter_quitar_", id)
  .df_chip_rm_id <- function(id) paste0("dim_filter_chip_quitar_", id)

  .remove_dim_filter_row <- function(id) {
    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
    ids <- setdiff(ids, as.integer(id))
    if (!length(ids)) {
      nid <- as.integer(dim_filter_rows$next_id %||% 2L)
      dim_filter_rows$next_id <- nid + 1L
      ids <- nid
    }
    dim_filter_rows$ids <- ids
  }

  .used_dim_filter_vars <- function(except_id = NA_integer_) {
    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
    ids <- ids[ids != as.integer(except_id)]
    out <- character(0)
    for (rid in ids) {
      vv <- as.character(input[[.df_var_id(rid)]] %||% "")[1]
      if (nzchar(vv)) out <- c(out, vv)
    }
    unique(out)
  }

  .register_dim_filter_row <- function(id) {
    if (id %in% as.integer(dim_filter_rows$bound %||% integer(0))) return(invisible(NULL))
    dim_filter_rows$bound <- c(as.integer(dim_filter_rows$bound %||% integer(0)), as.integer(id))

    sec_id <- .df_sec_id(id)
    var_id <- .df_var_id(id)
    cat_id <- .df_cat_id(id)
    rm_id <- .df_rm_id(id)
    chip_rm_id <- .df_chip_rm_id(id)

    shiny::observe({
      if (!(id %in% as.integer(dim_filter_rows$ids %||% integer(0)))) return()

      if (!length(filter_secs)) {
        shiny::updateSelectizeInput(session, sec_id, choices = c(), selected = character(0), server = FALSE)
        shiny::updateSelectizeInput(session, var_id, choices = c("Sin filtro" = ""), selected = "", server = FALSE)
        shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
        return()
      }

      sec_cur <- as.character(input[[sec_id]] %||% filter_sec_default)[1]
      sec_sel <- if (sec_cur %in% filter_secs) sec_cur else filter_sec_default
      shiny::updateSelectizeInput(
        session,
        inputId = sec_id,
        choices = stats::setNames(filter_secs, filter_secs),
        selected = sec_sel,
        server = FALSE
      )

      vars_sec <- filter_var_map[[sec_sel]] %||% character(0)
      used_other <- .used_dim_filter_vars(except_id = id)
      vars_avail <- setdiff(vars_sec, used_other)

      cur_var <- as.character(input[[var_id]] %||% "")[1]
      if (nzchar(cur_var) && cur_var %in% vars_sec && !(cur_var %in% vars_avail)) {
        vars_avail <- c(cur_var, vars_avail)
      }
      vars_avail <- unique(vars_avail)

      var_labs <- vapply(vars_avail, .label_var, character(1))
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
      if (!(id %in% as.integer(dim_filter_rows$ids %||% integer(0)))) return()
      v <- as.character(input[[var_id]] %||% "")[1]
      if (!nzchar(v) || !(v %in% names(data_dim))) {
        shiny::updateSelectizeInput(session, cat_id, choices = c(), selected = character(0), server = FALSE)
        return()
      }

      cat_df <- .catalogo_categorias_dim(v, data_dim)
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

    shiny::observeEvent(input[[rm_id]], .remove_dim_filter_row(id), ignoreInit = TRUE)
    shiny::observeEvent(input[[chip_rm_id]], .remove_dim_filter_row(id), ignoreInit = TRUE)

    invisible(NULL)
  }

  output$dim_filter_rows_ui <- shiny::renderUI({
    if (!length(filter_secs)) {
      return(shiny::p(class = "rel-sidebar-hint", "No hay variables categóricas disponibles para filtrar."))
    }

    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
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
                inputId = .df_rm_id(id),
                label = NULL,
                icon = shiny::icon("times"),
                class = "sidebar-filter-remove-btn",
                title = "Quitar filtro"
              )
            }
          ),
          shiny::selectizeInput(
            inputId = .df_sec_id(id),
            label = "Sección",
            choices = c(),
            selected = "",
            options = list(dropdownParent = "body")
          ),
          shiny::selectizeInput(
            inputId = .df_var_id(id),
            label = "Variable",
            choices = c("Sin filtro" = ""),
            selected = "",
            options = list(dropdownParent = "body")
          ),
          shiny::selectizeInput(
            inputId = .df_cat_id(id),
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
    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
    for (id in ids) .register_dim_filter_row(id)
  })

  shiny::observeEvent(input$dim_filter_add, {
    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
    if (length(ids) >= MAX_DIM_FILTROS) return()
    nid <- as.integer(dim_filter_rows$next_id %||% 2L)
    dim_filter_rows$next_id <- nid + 1L
    dim_filter_rows$ids <- c(ids, nid)
  }, ignoreInit = TRUE)

  shiny::observeEvent(input$dim_limpiar_filtros, {
    nid <- as.integer(dim_filter_rows$next_id %||% 2L)
    dim_filter_rows$next_id <- nid + 1L
    dim_filter_rows$ids <- nid
  }, ignoreInit = TRUE)

  .dim_filter_rows_state <- shiny::reactive({
    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
    lapply(ids, function(id) {
      sec <- as.character(input[[.df_sec_id(id)]] %||% "")[1]
      var <- as.character(input[[.df_var_id(id)]] %||% "")[1]
      cats <- as.character(input[[.df_cat_id(id)]] %||% character(0))
      cats <- cats[!is.na(cats) & nzchar(trimws(cats))]
      list(id = id, sec = sec, var = var, cats = unique(cats))
    })
  })

  dim_filters_activos <- shiny::reactive({
    rows <- .dim_filter_rows_state()
    Filter(function(r) nzchar(r$var) && length(r$cats) > 0L, rows)
  })

  output$dim_filter_active_ui <- shiny::renderUI({
    rows <- dim_filters_activos()
    if (!length(rows)) return(NULL)

    chips <- lapply(rows, function(r) {
      sec_lab <- if (nzchar(r$sec)) r$sec else "Sección"
      txt <- paste0(sec_lab, " · ", .label_var(r$var), " · ", length(r$cats), " categorías")
      shiny::div(
        class = "sidebar-filter-chip",
        shiny::span(class = "sidebar-filter-chip-text", txt),
        shiny::actionButton(
          inputId = .df_chip_rm_id(r$id),
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

  output$dim_filter_hint_ui <- shiny::renderUI({
    ids <- as.integer(dim_filter_rows$ids %||% integer(0))
    if (length(ids) < MAX_DIM_FILTROS) return(NULL)
    shiny::p(class = "rel-sidebar-hint", paste0("Máximo ", MAX_DIM_FILTROS, " filtros."))
  })

  data_filtrada <- shiny::reactive({
    df <- data_dim
    if (!isTRUE(input$dim_filters_enabled)) return(df)

    rows <- dim_filters_activos()
    if (!length(rows)) return(df)

    for (r in rows) {
      if (!(r$var %in% names(df)) || !length(r$cats)) next
      xv <- trimws(as.character(df[[r$var]]))
      keep <- !is.na(xv) & xv %in% r$cats
      df <- df[keep, , drop = FALSE]
    }
    df
  })

  iter_payload <- shiny::reactive({
    df <- data_filtrada()
    iter_on <- isTRUE(input$dim_iter_enabled)
    iv <- as.character(input$dim_iter_var %||% "")[1]
    if (!iter_on || !nrow(df) || !nzchar(iv) || !(iv %in% names(df))) {
      return(list(
        active = FALSE,
        var = "",
        var_label = "",
        rows = data.frame(value = character(0), label = character(0), base = numeric(0), stringsAsFactors = FALSE),
        rows_all = data.frame(value = character(0), label = character(0), base = numeric(0), stringsAsFactors = FALSE),
        hidden_levels = 0L
      ))
    }

    w <- .safe_weights(df)
    cats_all <- .categorias_var(df, iv, w, max_levels = Inf)
    lim <- .interactivo_limit_levels(cats_all$rows, max_levels = max_niveles_iteracion)
    if (!nrow(cats_all$rows)) {
      return(list(
        active = FALSE,
        var = iv,
        var_label = .label_var(iv),
        rows = lim$visible,
        rows_all = lim$all,
        hidden_levels = as.integer(lim$hidden_count)
      ))
    }

    list(
      active = TRUE,
      var = iv,
      var_label = .label_var(iv),
      rows = lim$visible,
      rows_all = lim$all,
      hidden_levels = as.integer(lim$hidden_count)
    )
  })

  iter_level_key <- shiny::reactiveVal("")

  shiny::observe({
    it <- iter_payload()
    if (!isTRUE(it$active)) {
      iter_level_key("")
      return()
    }
    keys <- as.character(it$rows_all$value)
    cur <- as.character(iter_level_key() %||% "")[1]
    if (!nzchar(cur) || !(cur %in% keys)) iter_level_key(keys[1])
  })

  shiny::observeEvent(input$dim_iter_level_select, {
    it <- iter_payload()
    if (!isTRUE(it$active) || !nrow(it$rows_all)) return()
    key <- as.character(input$dim_iter_level_select %||% "")[1]
    keys <- as.character(it$rows_all$value)
    if (nzchar(key) && key %in% keys) iter_level_key(key)
  })

  iter_pick <- shiny::reactive({
    it <- iter_payload()
    if (!isTRUE(it$active) || !nrow(it$rows_all)) return(NULL)
    key <- as.character(iter_level_key() %||% "")[1]
    if (!nzchar(key) || !(key %in% as.character(it$rows_all$value))) key <- as.character(it$rows_all$value[1])
    row <- it$rows_all[match(key, as.character(it$rows_all$value)), , drop = FALSE]
    if (!nrow(row)) return(NULL)
    list(
      key = as.character(row$value[1]),
      label = as.character(row$label[1]),
      base = as.numeric(row$base[1]),
      var = as.character(it$var),
      var_label = as.character(it$var_label),
      hidden_levels = as.integer(it$hidden_levels)
    )
  })

  output$dim_iter_hidden_hint_ui <- shiny::renderUI({
    it <- iter_payload()
    if (!isTRUE(it$active)) return(NULL)
    h <- as.integer(it$hidden_levels %||% 0L)
    if (h <= 0L) return(NULL)
    shiny::p(
      class = "rel-iter-hint",
      paste0("La vista rápida prioriza los niveles con mayor base. El selector permite buscar los ", nrow(it$rows_all), " niveles disponibles.")
    )
  })

  output$dim_iter_controls_ui <- shiny::renderUI({
    pick <- iter_pick()
    if (is.null(pick)) return(NULL)

    base_txt <- format(.round_half_up(pick$base, 0), big.mark = ",", scientific = FALSE)
    it <- iter_payload()
    items <- lapply(seq_len(nrow(it$rows_all)), function(i) {
      list(
        value = as.character(it$rows_all$value[i]),
        label = as.character(it$rows_all$label[i]),
        meta = paste0(
          "N ",
          format(.round_half_up(as.numeric(it$rows_all$base[i]), 0), big.mark = ",", scientific = FALSE)
        )
      )
    })

    .interactivo_iter_popover_ui(
      select_id = "dim_iter_level_select",
      current_label = pick$label,
      current_meta = paste0("N ", base_txt),
      items = items,
      selected = pick$key,
      title = "Seleccionar nivel",
      note = paste0("Disponible: ", nrow(it$rows_all), " niveles")
    )
  })

  data_iterada <- shiny::reactive({
    df <- data_filtrada()
    pick <- iter_pick()
    if (is.null(pick) || !nzchar(pick$var) || !(pick$var %in% names(df))) return(df)
    x <- trimws(as.character(df[[pick$var]]))
    keep <- !is.na(x) & x == as.character(pick$key)
    df[keep, , drop = FALSE]
  })

  objetivo_activo <- shiny::reactive({
    mode <- mode_activo()
    obj_map <- if (identical(mode, "indicadores")) catalog_indicadores else catalog_general
    if (!length(obj_map)) return(NULL)

    id <- as.character(input$dim_objetivo %||% "")[1]
    if (!nzchar(id) || !(id %in% names(obj_map))) id <- names(obj_map)[1]
    obj_map[[id]]
  })

  score_payload <- shiny::reactive({
    mode <- mode_activo()
    obj <- objetivo_activo()
    if (is.null(obj)) {
      return(.dim_empty_payload(dim_shared_ctx(), mode = mode, objective = NA_character_))
    }

    filtros_rows <- dim_filters_activos()
    filtros_list <- list()
    if (length(filtros_rows)) {
      filtros_list <- stats::setNames(
        lapply(filtros_rows, function(r) as.character(r$cats)),
        vapply(filtros_rows, function(r) as.character(r$var), character(1))
      )
    }

    iter_sel <- iter_pick()
    .dim_build_payload(
      dim_shared_ctx(),
      modo = mode,
      objetivo = if (identical(mode, "indicadores")) obj$key %||% obj$id else obj$id %||% obj$key,
      cruce = as.character(input$dim_principal_var %||% "")[1],
      incluir_total = isTRUE(input$dim_show_total),
      filtros = filtros_list,
      iter_var = if (!is.null(iter_sel)) as.character(iter_sel$var %||% "")[1] else as.character(input$dim_iter_var %||% "")[1],
      iter_level = if (!is.null(iter_sel)) as.character(iter_sel$key %||% "")[1] else NULL
    )
  })

  .group_order <- function(sc) {
    if (!nrow(sc)) return(character(0))
    base_df <- sc |>
      dplyr::distinct(.data$grupo, .data$base)

    others_df <- base_df[base_df$grupo != "Total", , drop = FALSE]
    others <- as.character(others_df$grupo[order(-others_df$base, as.character(others_df$grupo))])

    if ("Total" %in% as.character(base_df$grupo)) {
      unique(c("Total", others))
    } else {
      unique(others)
    }
  }

  visual_mode_resolved <- shiny::reactive({
    p <- score_payload()
    as.character(p$visual_mode %||% "barras")[1]
  })

  group_levels <- shiny::reactive({
    sc <- score_payload()$score_plot
    .group_order(sc)
  })

  focus_group <- shiny::reactiveVal("")

  shiny::observe({
    lv <- group_levels()
    if (!length(lv)) {
      focus_group("")
      return()
    }
    cur <- as.character(focus_group() %||% "")[1]
    if (!nzchar(cur) || !(cur %in% lv)) focus_group(lv[1])
  })

  shiny::observeEvent(input$dim_focus_next, {
    lv <- group_levels()
    if (length(lv) <= 1L) return()
    cur <- as.character(focus_group() %||% "")[1]
    idx <- which(lv == cur)[1]
    if (is.na(idx)) idx <- 1L
    nxt <- if (idx >= length(lv)) 1L else idx + 1L
    focus_group(lv[nxt])
  })

  focus_enabled <- shiny::reactive({
    isTRUE(input$dim_focus_enable) && length(group_levels()) > 1L
  })

  output$dim_focus_controls_ui <- shiny::renderUI({
    lv <- group_levels()
    if (length(lv) <= 1L) return(NULL)

    sc <- score_payload()$score_plot
    gf <- as.character(focus_group() %||% lv[1])[1]
    b <- sc$base[match(gf, as.character(sc$grupo))]
    b <- suppressWarnings(as.numeric(b[1]))

    shiny::div(
      class = "dim-focus-wrap",
      shiny::div(
        class = "toggle-row dim-focus-toggle",
        shiny::span(class = "toggle-label", "Comparar"),
        shiny::tags$label(
          class = "switch",
          if (isTRUE(input$dim_focus_enable)) {
            shiny::tags$input(id = "dim_focus_enable", type = "checkbox", checked = "checked")
          } else {
            shiny::tags$input(id = "dim_focus_enable", type = "checkbox")
          },
          shiny::tags$span(class = "slider")
        ),
        shiny::span(class = "toggle-label", "Enfoque")
      ),
      if (isTRUE(input$dim_focus_enable)) {
        shiny::div(
          class = "rel-iter-level-control",
          shiny::actionButton(
            inputId = "dim_focus_next",
            label = NULL,
            icon = shiny::icon("repeat"),
            class = "rel-iter-circle-btn",
            title = "Siguiente grupo"
          ),
          shiny::div(
            class = "rel-iter-level-chip",
            shiny::div(class = "rel-iter-level-name", gf),
            shiny::div(
              class = "rel-iter-level-meta",
              paste0("N ", format(round(b, 0), big.mark = ",", scientific = FALSE))
            )
          )
        )
      }
    )
  })

  output$dim_main_title_ui <- shiny::renderUI({
    ttl <- "Comparación del indicador"
    shiny::div(class = "cardbox-title", ttl)
  })

  output$dim_heatmap_subtitle_ui <- shiny::renderUI({
    p <- score_payload()
    if (!nrow(p$score_heat)) {
      return(shiny::div(class = "cardbox-subtitle", "Sin datos disponibles con la selección actual."))
    }

    sec_mode <- if (identical(p$mode, "indicadores")) "Vista Indicadores" else "Vista General"
    principal_txt <- if (nzchar(p$principal_var)) {
      paste0("Cruce: ", p$principal_label, ". ")
    } else {
      "Sin cruce. "
    }
    iter_txt <- if (isTRUE(p$iter_active)) {
      paste0("Iteración: ", p$iter_var_label, " = ", p$iter_level_label, ". ")
    } else {
      ""
    }

    cuts_lab <- .range_labels(sem_cortes[1], sem_cortes[2])

    shiny::div(
      class = "cardbox-subtitle",
      paste0(
        sec_mode, " | Objetivo: ", p$objective, " | ",
        principal_txt,
        iter_txt,
        "Rangos: ", cuts_lab[1], ", ", cuts_lab[2], ", ", cuts_lab[3], ".",
        if (isTRUE(p$principal_hidden > 0L)) paste0(" +", p$principal_hidden, " categorías no visibles por legibilidad.") else "",
        if (isTRUE(p$iter_hidden_levels > 0L)) paste0(" +", p$iter_hidden_levels, " niveles de iteración adicionales no visibles.") else ""
      )
    )
  })

  output$dim_main_subtitle_ui <- shiny::renderUI({
    p <- score_payload()
    if (!nrow(p$score_plot)) {
      return(shiny::div(class = "cardbox-subtitle", "Sin datos disponibles con la selección actual."))
    }

    shiny::div(
      class = "cardbox-subtitle",
      paste0(
        if (identical(p$mode, "indicadores")) "Vista indicadores" else "Vista general",
        " | Objetivo: ", p$objective,
        " | Total: ", if (isTRUE(input$dim_show_total)) "incluido" else "oculto",
        if (isTRUE(p$iter_active)) paste0(" | Iteración: ", p$iter_var_label, " = ", p$iter_level_label) else ""
      )
    )
  })

  output$dim_heatmap_ui <- shiny::renderUI({
    plotly::plotlyOutput("dim_heatmap_plot", height = "460px")
  })

  output$dim_heatmap_legend_ui <- shiny::renderUI({
    p <- score_payload()
    if (!nrow(p$score_heat)) return(NULL)

    cuts_lab <- .range_labels(sem_cortes[1], sem_cortes[2])
    shiny::div(
      class = "dim-heat-legend",
      shiny::div(
        class = "dim-heat-legend-item",
        shiny::span(class = "dim-heat-legend-swatch", style = paste0("background:", sem_col_rojo, ";")),
        shiny::span(class = "dim-heat-legend-text", cuts_lab[1])
      ),
      shiny::div(
        class = "dim-heat-legend-item",
        shiny::span(class = "dim-heat-legend-swatch", style = paste0("background:", sem_col_amb, ";")),
        shiny::span(class = "dim-heat-legend-text", cuts_lab[2])
      ),
      shiny::div(
        class = "dim-heat-legend-item",
        shiny::span(class = "dim-heat-legend-swatch", style = paste0("background:", sem_col_ver, ";")),
        shiny::span(class = "dim-heat-legend-text", cuts_lab[3])
      )
    )
  })

  output$dim_main_plot_ui <- shiny::renderUI({
    h <- if (identical(visual_mode_resolved(), "radar")) "600px" else "560px"
    plotly::plotlyOutput("dim_main_plot_plot", height = h)
  })

  .heat_colorscale <- function() {
    list(
      list(0.000000, sem_col_na),
      list(0.249999, sem_col_na),
      list(0.250000, sem_col_rojo),
      list(0.499999, sem_col_rojo),
      list(0.500000, sem_col_amb),
      list(0.749999, sem_col_amb),
      list(0.750000, sem_col_ver),
      list(1.000000, sem_col_ver)
    )
  }

  output$dim_heatmap_plot <- plotly::renderPlotly({
    p <- score_payload()
    sc <- p$score_heat

    if (!nrow(sc)) {
      return(
        plotly::plot_ly(height = 460) |>
          plotly::layout(
            annotations = list(list(text = "Sin datos para mostrar", showarrow = FALSE)),
            margin = list(l = 10, r = 10, t = 10, b = 10),
            xaxis = list(visible = FALSE),
            yaxis = list(visible = FALSE)
          ) |>
          plotly::config(displayModeBar = FALSE, responsive = TRUE)
      )
    }

    grupos_ord <- .group_order(sc)
    if (!length(grupos_ord)) grupos_ord <- unique(as.character(sc$grupo))

    axis_order <- as.character(p$axis_order_heat %||% unique(sc$axis_label))
    axis_order <- axis_order[axis_order %in% unique(sc$axis_label)]
    if (!length(axis_order)) axis_order <- unique(as.character(sc$axis_label))

    sc$grupo <- factor(sc$grupo, levels = grupos_ord)
    sc$axis_label <- factor(sc$axis_label, levels = rev(axis_order))
    sc$cat_code <- dplyr::case_when(
      is.na(sc$score_raw) ~ 0,
      sc$score_raw < sem_cortes[1] ~ 1,
      sc$score_raw < sem_cortes[2] ~ 2,
      TRUE ~ 3
    )
    sc$texto <- ifelse(is.na(sc$score_raw), "", .fmt_int(sc$score_round))

    cuts_lab <- .range_labels(sem_cortes[1], sem_cortes[2])
    sc$estado <- dplyr::case_when(
      is.na(sc$score_raw) ~ "Sin dato",
      sc$score_raw < sem_cortes[1] ~ cuts_lab[1],
      sc$score_raw < sem_cortes[2] ~ cuts_lab[2],
      TRUE ~ cuts_lab[3]
    )

    max_chars <- max(nchar(as.character(axis_order), type = "width"), na.rm = TRUE)
    left_margin <- .clamp(36 + 7 * max_chars, 130, 320)

    plotly::plot_ly(
      data = sc,
      x = ~grupo,
      y = ~axis_label,
      z = ~cat_code,
      text = ~texto,
      type = "heatmap",
      texttemplate = "%{text}",
      textfont = list(size = 11, color = "#122842"),
      xgap = 2,
      ygap = 2,
      colorscale = .heat_colorscale(),
      zmin = 0,
      zmax = 3,
      showscale = FALSE,
      hovertemplate = paste0(
        "<b>%{y}</b><br>",
        "Grupo: %{x}<br>",
        "Score: %{customdata}<br>",
        "Rango: %{meta}<extra></extra>"
      ),
      customdata = ~ifelse(is.na(score_raw), "Sin dato", .fmt_int(score_round)),
      meta = ~estado
      ) |>
      plotly::layout(
        margin = list(l = left_margin, r = 26, t = 8, b = 70),
        xaxis = list(title = "", tickangle = -18, tickfont = list(size = 11, color = "#20324d")),
        yaxis = list(title = "", tickfont = list(size = 11, color = "#20324d")),
        legend = list(title = list(text = ""))
      ) |>
      plotly::config(displayModeBar = FALSE, responsive = TRUE)
  })

  output$dim_main_plot_plot <- plotly::renderPlotly({
    p <- score_payload()
    sc <- p$score_plot

    if (!nrow(sc)) {
      return(
        plotly::plot_ly(height = 560) |>
          plotly::layout(
            annotations = list(list(text = "Sin datos para mostrar", showarrow = FALSE)),
            margin = list(l = 10, r = 10, t = 10, b = 10),
            xaxis = list(visible = FALSE),
            yaxis = list(visible = FALSE)
          ) |>
          plotly::config(displayModeBar = FALSE, responsive = TRUE)
      )
    }

    mode_plot <- visual_mode_resolved()
    grupos_ord_all <- .group_order(sc)
    if (!length(grupos_ord_all)) grupos_ord_all <- unique(as.character(sc$grupo))
    grupos_ord <- grupos_ord_all

    axis_order <- as.character(p$axis_order_plot %||% unique(sc$axis_label))
    axis_order <- axis_order[axis_order %in% unique(sc$axis_label)]
    if (!length(axis_order)) axis_order <- unique(as.character(sc$axis_label))

    if (isTRUE(focus_enabled())) {
      gf <- as.character(focus_group() %||% grupos_ord[1])[1]
      grupos_ord <- intersect(gf, grupos_ord)
      if (!length(grupos_ord)) grupos_ord <- unique(as.character(sc$grupo))[1]
    }

    cols_group_all <- .group_colors(grupos_ord_all)
    cols_group <- cols_group_all[grupos_ord]

    if (identical(mode_plot, "barras")) {
      max_chars <- max(nchar(as.character(axis_order), type = "width"), na.rm = TRUE)
      left_margin <- .clamp(36 + 7 * max_chars, 130, 320)

      pbar <- plotly::plot_ly(type = "bar", orientation = "h")
      for (g in grupos_ord) {
        dfg <- sc[as.character(sc$grupo) == g, , drop = FALSE]
        dfg <- dfg[match(axis_order, as.character(dfg$axis_label)), , drop = FALSE]

        pbar <- pbar |>
          plotly::add_trace(
            x = as.numeric(dfg$score_round),
            y = axis_order,
            name = g,
            marker = list(color = as.character(cols_group[[g]] %||% "#1F4E85")),
            hovertemplate = paste0(
              "<b>", g, "</b><br>",
              "%{y}: %{x}<extra></extra>"
            )
          )
      }

      return(
        pbar |>
          plotly::layout(
            barmode = "group",
            margin = list(l = left_margin, r = 26, t = 18, b = 78),
            xaxis = list(title = "Score (0-100)", range = c(0, 100), tickfont = list(size = 11, color = "#20324d")),
            yaxis = list(
              title = "",
              autorange = "reversed",
              tickfont = list(size = 11, color = "#20324d"),
              categoryorder = "array",
              categoryarray = axis_order
            ),
            legend = list(
              orientation = "h",
              y = -0.18,
              x = 0.5,
              xanchor = "center",
              entrywidthmode = if (length(grupos_ord_all) >= 5) "fraction" else NULL,
              entrywidth = if (length(grupos_ord_all) >= 5) 0.18 else NULL,
              title = list(text = "")
            )
          ) |>
          plotly::config(displayModeBar = FALSE, responsive = TRUE)
      )
    }

    theta_wrap <- .wrap_axis_label(axis_order, width = 16L)

    prad <- plotly::plot_ly(type = "scatterpolar", mode = "lines+markers")
    for (g in grupos_ord) {
      dfg <- sc[as.character(sc$grupo) == g, , drop = FALSE]
      dfg <- dfg[match(axis_order, as.character(dfg$axis_label)), , drop = FALSE]
      vals <- as.numeric(dfg$score_round)
      vals[!is.finite(vals)] <- NA_real_

      vals_poly <- c(vals, vals[1])
      theta_poly <- c(theta_wrap, theta_wrap[1])
      col_line <- as.character(cols_group[[g]] %||% "#1F4E85")
      is_total <- identical(g, "Total")

      prad <- prad |>
        plotly::add_trace(
          r = vals_poly,
          theta = theta_poly,
          name = g,
          fill = "toself",
          fillcolor = .add_alpha(col_line, if (is_total) 0.18 else 0.10),
          line = list(width = if (is_total) 3 else 2, color = col_line),
          marker = list(size = if (is_total) 6.8 else 5.2, color = col_line),
          hovertemplate = paste0(
            "<b>", g, "</b><br>",
            "%{theta}: %{r}<extra></extra>"
          )
        )
    }

    prad |>
      plotly::layout(
        polar = list(
          bgcolor = "rgba(255,255,255,0)",
          radialaxis = list(
            range = c(0, 100),
            tickmode = "array",
            tickvals = c(20, 40, 60, 80, 100),
            showticklabels = FALSE,
            ticks = "",
            gridcolor = "rgba(0,36,87,0.16)",
            linecolor = "rgba(0,36,87,0.16)"
          ),
          angularaxis = list(
            tickfont = list(size = 11, color = "#243a56"),
            rotation = 90,
            direction = "clockwise",
            linecolor = "rgba(0,36,87,0.16)",
            gridcolor = "rgba(0,36,87,0.10)"
          )
        ),
        legend = list(
          orientation = "h",
          y = -0.16,
          x = 0.5,
          xanchor = "center",
          entrywidthmode = if (length(grupos_ord_all) >= 5) "fraction" else NULL,
          entrywidth = if (length(grupos_ord_all) >= 5) 0.18 else NULL,
          title = list(text = "")
        ),
        margin = list(l = 54, r = 54, t = 64, b = 98)
      ) |>
      plotly::config(displayModeBar = FALSE, responsive = TRUE)
  })
}
