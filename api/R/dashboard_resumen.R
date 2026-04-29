# ============================================================
# Tab "Resumen" — endpoint de payload por sección.
#
# Para una sección dada (más filtros activos), retorna las "filas":
# una por pregunta (SO o SM), con su distribución agregada lista para
# que el frontend renderice barras horizontales.
#
# Reusa `.interactivo_resumen_build_rows()` (interactivo_dashboard.R:229)
# para clasificar y ordenar las preguntas — la diferencia es que aquí
# computamos `dist` server-side en vez de delegar a Plotly via Shiny.
# ============================================================

# ------------------------------------------------------------
# Distribución para una variable SO — counts y % por categoría con su
# label resuelto. Espejo del map_code_to_label de
# .preparar_tabla_kpi_safe (interactivo_resumen.R:279).
.dashboard_dist_so <- function(df, var, rp_inst, palette = NULL, extra_labels = NULL) {
  if (!(var %in% names(df))) return(list())
  x <- as.character(df[[var]])
  x <- x[!is.na(x) & nzchar(x) & x != "NA"]
  if (!length(x)) return(list())

  surv <- rp_inst$survey
  ch <- rp_inst$choices
  label_col <- if (!is.null(ch) && "label" %in% names(ch)) "label"
               else if (!is.null(ch)) grep("^label(::|$)", names(ch), value = TRUE)[1]
               else NULL

  map_code_to_label <- NULL
  if (!is.null(surv) && !is.null(ch) &&
      all(c("name", "list_name") %in% names(surv)) &&
      all(c("name", "list_name") %in% names(ch)) &&
      !is.null(label_col) && !is.na(label_col) && label_col %in% names(ch)) {
    i <- which(!is.na(surv$name) & surv$name == var)[1]
    if (!is.na(i)) {
      ln <- as.character(surv$list_name[i])
      if (!is.na(ln) && nzchar(ln)) {
        ch_v <- ch[ch$list_name == ln, , drop = FALSE]
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
    labs_attr <- attr(df[[var]], "labels", exact = TRUE)
    if (!is.null(labs_attr) && length(labs_attr) > 0L) {
      map_code_to_label <- stats::setNames(
        as.character(unname(labs_attr)),
        as.character(names(labs_attr))
      )
    }
  }
  # Si nos pasaron etiquetas extra (típicamente desde grupos_recod cuando
  # estamos mostrando la versión recodificada), las mergeamos. Pisamos
  # primero las del XLSForm; si XLSForm no tiene etiqueta para un código,
  # se usa la extra.
  if (is.list(extra_labels) && length(extra_labels)) {
    if (is.null(map_code_to_label)) {
      map_code_to_label <- character(0)
    }
    for (cd in names(extra_labels)) {
      cur <- map_code_to_label[cd]
      if (is.na(cur) || !nzchar(cur)) {
        map_code_to_label[cd] <- as.character(extra_labels[[cd]])
      }
    }
  }

  tab <- as.data.frame(table(x), stringsAsFactors = FALSE)
  names(tab) <- c("code", "n")
  tab$n <- as.numeric(tab$n)
  tab$label <- if (!is.null(map_code_to_label)) {
    out <- unname(map_code_to_label[tab$code])
    out[is.na(out) | out == ""] <- tab$code[is.na(out) | out == ""]
    out
  } else {
    tab$code
  }
  tab$pct <- tab$n / sum(tab$n)

  # Orden por orden de choices si está disponible; si no, por n desc.
  if (!is.null(map_code_to_label)) {
    orden <- unname(map_code_to_label)
    orden <- orden[!is.na(orden) & nzchar(orden)]
    if (length(orden)) {
      tab$label <- factor(tab$label, levels = orden)
      tab <- tab[order(tab$label), , drop = FALSE]
      tab$label <- as.character(tab$label)
    }
  } else {
    tab <- tab[order(-tab$n), , drop = FALSE]
  }

  lapply(seq_len(nrow(tab)), function(k) {
    label <- as.character(tab$label[k])
    item <- list(
      code = as.character(tab$code[k]),
      label = label,
      n = as.integer(tab$n[k]),
      pct = round(as.numeric(tab$pct[k]), 6)
    )
    color <- .dashboard_color_for_label(label, palette)
    if (!is.null(color)) item$color <- color
    item
  })
}

# ------------------------------------------------------------
# Distribución para una variable SM (madre) — para cada opción/dummy
# devuelve {code, label, n_yes, pct_yes, n_total}. Espejo de
# .plot_sm_dummy_fill (interactivo_resumen.R:1144).
.dashboard_dist_sm <- function(df, var_madre, rp_inst, palette = NULL, s = NULL) {
  spec <- .dashboard_resolver_sm_spec(var_madre, rp_inst, df, s = s)
  if (!length(spec$cols)) return(list())

  lapply(spec$cols, function(col) {
    code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var_madre, "."))),
                "", col)
    code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var_madre, "/"))),
                "", code)
    label <- as.character(spec$map_code_to_label[[code]] %||% code)

    x <- df[[col]]
    x2 <- suppressWarnings(as.numeric(as.character(x)))
    if (all(is.na(x2)) && is.logical(x)) x2 <- as.numeric(x)
    ok <- !is.na(x2) & x2 %in% c(0, 1)
    x2 <- x2[ok]
    n_total <- length(x2)
    n_yes <- sum(x2 == 1)
    pct_yes <- if (n_total) n_yes / n_total else 0

    item <- list(
      code = code,
      label = label,
      col_dummy = col,
      n_yes = as.integer(n_yes),
      n_total = as.integer(n_total),
      pct_yes = round(pct_yes, 6)
    )
    color <- .dashboard_color_for_label(label, palette)
    if (!is.null(color)) item$color <- color
    item
  })
}

# ------------------------------------------------------------
# Payload principal del tab Resumen para una sección dada.
# - Aplica filtros sobre rp_data.
# - Construye rows via .interactivo_resumen_build_rows.
# - Para cada row, computa `dist` (so) o `options` con stats (sm).
.dashboard_resumen_payload <- function(s, seccion, filtros = list()) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    return(list(seccion = seccion, n_total = 0L, rows = list()))
  }

  data <- .dashboard_apply_filtros(s$rp_data, filtros)
  secciones <- .dashboard_curated_secciones(s)
  if (!(seccion %in% names(secciones))) {
    return(list(seccion = seccion, n_total = nrow(data), rows = list()))
  }

  sm_madres <- .dashboard_sm_madres(s$rp_inst)
  spec <- .interactivo_resumen_build_rows(
    sec = seccion,
    secciones_limpias = secciones,
    instrumento = s$rp_inst,
    data = s$rp_data,
    sm_madres = sm_madres,
    max_so_rows = 16L,
    label_var = function(v) .obtener_label_var(v, s$rp_inst, s$rp_data),
    resolver_var_spec_fn = function(var_madre) {
      .dashboard_resolver_sm_spec(var_madre, s$rp_inst, data, s = s)
    }
  )

  # Mapa de modos por variable (config.dashboard_var_modes). Se aplica
  # ANTES de calcular dist/options: si modo="recod" y existe la columna
  # `<var>_recod`, intercambiamos la fuente para que el resumen muestre
  # la versión recodificada en lugar de la original. La pregunta sigue
  # mostrándose con su label humano del XLSForm — solo cambia QUÉ datos
  # se grafican.
  cfg <- s$dashboard_config
  var_modes <- if (is.list(cfg)) (cfg$dashboard_var_modes %||% list()) else list()
  var_overrides <- if (is.list(cfg)) (cfg$dashboard_var_overrides %||% list()) else list()
  # Catálogo de etiquetas humanas para los códigos recod, indexado por
  # variable padre. Viene de `s$codif_por_base[[src]]$grupos_recod`.
  recod_labels_for <- function(var_original) {
    out <- list()
    if (!is.list(s$codif_por_base)) return(out)
    for (src_name in names(s$codif_por_base)) {
      gr <- s$codif_por_base[[src_name]]$grupos_recod[[var_original]]
      if (!is.list(gr)) next
      for (g in gr) {
        cd <- as.character(g$codigo %||% "")
        et <- as.character(g$etiqueta %||% "")
        if (nzchar(cd) && nzchar(et) && is.null(out[[cd]])) out[[cd]] <- et
      }
    }
    out
  }

  rows <- lapply(spec$rows, function(row) {
    var_original <- row$var
    # Override por variable (config.dashboard_var_overrides):
    # - enabled=false → la variable se omite del resumen.
    # - label="texto" → reemplaza el label del XLSForm (ej. para
    #   diferenciar p10_ule de p10_ciam que comparten título).
    ov <- var_overrides[[var_original]]
    if (is.list(ov)) {
      if (isFALSE(ov$enabled)) return(NULL)
      if (is.character(ov$label) && nzchar(ov$label)) row$label <- as.character(ov$label)
    }
    modo <- as.character(var_modes[[var_original]]$modo %||% "original")
    var_efectiva <- var_original
    extra_labels <- NULL
    forced_so <- FALSE
    if (identical(modo, "recod")) {
      candidata <- paste0(var_original, "_recod")
      if (candidata %in% names(data)) {
        var_efectiva <- candidata
        extra_labels <- recod_labels_for(var_original)
        # `<var>_recod` es siempre una sola columna SO con códigos
        # recodificados. Aunque `<var>` original sea SM, al elegir "recod"
        # la pregunta pasa a graficarse como SO sobre la columna recod.
        forced_so <- TRUE
      }
    }

    tipo <- if (forced_so) "so" else .dashboard_tipo_pregunta(var_original, s$rp_inst, s$rp_data)
    row$type <- tipo
    row$list_name <- .dashboard_list_name_for_var(var_original, s$rp_inst)
    if (identical(tipo, "so")) {
      row$dist <- .dashboard_dist_so(
        data,
        var_efectiva,
        s$rp_inst,
        .dashboard_palette_for_var(var_original, s$rp_inst, s),
        extra_labels = extra_labels
      )
    } else if (identical(tipo, "sm")) {
      row$options <- .dashboard_dist_sm(
        data,
        var_efectiva,
        s$rp_inst,
        .dashboard_palette_for_var(var_original, s$rp_inst, s),
        s = s
      )
    }
    row$slot_id <- NULL  # campo Shiny, irrelevante para React
    row
  })

  # Las vars con override.enabled=false vuelven NULL — los filtramos aquí.
  rows <- Filter(Negate(is.null), rows)

  list(
    seccion = seccion,
    n_total = nrow(data),
    rows = rows
  )
}

# ------------------------------------------------------------
# KPI sidebar — para cada `kpi_var` (SO con pocas categorías)
# devuelve la dist. El frontend lo renderiza como medio-donut.
.dashboard_resumen_kpis <- function(s, filtros = list()) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) return(list())
  data <- .dashboard_apply_filtros(s$rp_data, filtros)
  if (!nrow(data)) return(list(n_total = 0L, kpis = list()))

  payload <- .dashboard_secciones_payload(s)
  kpi_vars <- as.character(unlist(payload$kpi_vars %||% list()))
  if (!length(kpi_vars)) return(list(n_total = nrow(data), kpis = list()))

  kpis <- lapply(kpi_vars, function(v) {
    list(
      var = v,
      list_name = .dashboard_list_name_for_var(v, s$rp_inst),
      label = .obtener_label_var(v, s$rp_inst, s$rp_data),
      dist = .dashboard_dist_so(
        data,
        v,
        s$rp_inst,
        .dashboard_palette_for_var(v, s$rp_inst, s)
      )
    )
  })

  list(
    n_total = nrow(data),
    kpis = kpis
  )
}
