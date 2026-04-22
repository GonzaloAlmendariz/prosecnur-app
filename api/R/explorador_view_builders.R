# =============================================================================
# Explorador de datos — view builders (Sprint 3)
# =============================================================================
# Funciones que, dada una variable de una base, detectan su tipo
# (so/sm/num/fecha/texto) y arman uno o más ViewDescriptor plotly para
# mostrar su distribución univariada + un KPI card con resumen.
#
# El backend llama:
#   - `.explorar_inventario(data, instrumento)` → lista de variables por
#     sección con tipo detectado.
#   - `build_view_univariado(data, var, instrumento)` → list de
#     ViewDescriptor (kpi + 1-2 gráficos).
#   - `build_view_bivariado(data, var_x, var_y, instrumento)` → un solo
#     ViewDescriptor de bar_stack / chip_bars.
#
# Se apoya en:
#   - `.interactivo_tipo_pregunta()` para distinguir so/sm.
#   - `vd_bar_h`, `vd_kpi_card`, `vd_heatmap_semaforo` de
#     `validacion_view_descriptors.R` como building blocks.

# -----------------------------------------------------------------------------
# Detección de tipo de variable (extendida: so/sm/num/fecha/texto)
# -----------------------------------------------------------------------------
# Devuelve una de: "so", "sm", "num", "fecha", "texto", "mixto".
# Estrategia:
#   1) Si tipo XLSForm es select_multiple → "sm".
#   2) Si tipo XLSForm es select_one O la columna es factor/labelled → "so".
#   3) Si columna es Date/POSIXct → "fecha".
#   4) Si tipo XLSForm es integer/decimal O columna es numérica sin labels → "num".
#   5) Si tipo XLSForm es text o la columna es character con alta cardinalidad
#      (>30% únicos) → "texto".
#   6) Fallback "mixto".
.explorar_tipo_var <- function(var, survey = NULL, df = NULL) {
  var <- as.character(var)[1]
  if (is.na(var) || !nzchar(trimws(var))) return("mixto")

  # (1) y (2): usar .interactivo_tipo_pregunta para so/sm nativos.
  if (!is.null(survey) && "name" %in% names(survey) && "type" %in% names(survey)) {
    mask <- !is.na(survey$name) & as.character(survey$name) == var
    if (any(mask)) {
      tipos <- tolower(as.character(unique(na.omit(survey$type[mask]))))
      if (any(grepl("^select_multiple(\\s|$)", tipos))) return("sm")
      if (any(grepl("^select_one(\\s|$)", tipos))) return("so")
      # Tipos XLSForm primitivos.
      if (any(grepl("^(integer|decimal)(\\s|$)", tipos))) return("num")
      if (any(grepl("^(date|datetime|time)(\\s|$)", tipos))) return("fecha")
      if (any(grepl("^text(\\s|$)", tipos))) return("texto")
    }
  }

  # (3) + fallback heurístico: inspeccionar la columna del df.
  if (!is.null(df) && var %in% names(df)) {
    col <- df[[var]]
    if (inherits(col, c("Date", "POSIXct", "POSIXlt", "POSIXt"))) return("fecha")
    if (inherits(col, "haven_labelled")) {
      labs <- attr(col, "labels", exact = TRUE)
      # haven_labelled con muchos códigos = select_one con labels.
      if (!is.null(labs) && length(labs) > 0L) return("so")
    }
    if (is.factor(col)) return("so")
    if (is.numeric(col)) return("num")
    if (is.character(col) || is.logical(col)) {
      non_na <- col[!is.na(col) & nzchar(as.character(col))]
      if (!length(non_na)) return("texto")
      uniq <- length(unique(non_na))
      if (uniq / length(non_na) > 0.30) return("texto")
      return("so")  # baja cardinalidad → probablemente categorial
    }
  }

  # (4) fallback: asumimos SO (si el survey tiene el name pero no tipo claro).
  "so"
}

# -----------------------------------------------------------------------------
# Label humano de una variable (label del XLSForm, o el nombre si no hay)
# -----------------------------------------------------------------------------
.explorar_label_var <- function(var, instrumento) {
  surv <- instrumento$survey %||% NULL
  if (!is.null(surv) && all(c("name", "label") %in% names(surv))) {
    i <- which(!is.na(surv$name) & as.character(surv$name) == var)[1]
    if (!is.na(i)) {
      lab <- as.character(surv$label[i])
      if (!is.na(lab) && nzchar(lab)) return(lab)
    }
  }
  var
}

# -----------------------------------------------------------------------------
# Mapa código → etiqueta para select_one (desde choices del instrumento)
# -----------------------------------------------------------------------------
.explorar_map_choices <- function(var, instrumento) {
  surv <- instrumento$survey %||% NULL
  ch   <- instrumento$choices %||% NULL
  if (is.null(surv) || is.null(ch)) return(NULL)
  if (!all(c("name", "list_name") %in% names(surv))) return(NULL)
  if (!all(c("list_name", "name") %in% names(ch))) return(NULL)
  lbl_col <- if ("label" %in% names(ch)) "label" else
             if ("label_es" %in% names(ch)) "label_es" else NULL
  if (is.null(lbl_col)) return(NULL)
  i <- which(!is.na(surv$name) & as.character(surv$name) == var)[1]
  if (is.na(i)) return(NULL)
  ln <- as.character(surv$list_name[i])
  if (is.na(ln) || !nzchar(ln)) return(NULL)
  rows <- ch[as.character(ch$list_name) == ln, , drop = FALSE]
  if (!nrow(rows)) return(NULL)
  stats::setNames(as.character(rows[[lbl_col]]), as.character(rows$name))
}

# -----------------------------------------------------------------------------
# Tabla de frecuencia SO con labels legibles
# -----------------------------------------------------------------------------
# Retorna data.frame con columnas code, label, n, pct. Excluye NAs y
# vacíos. Respeta orden del catálogo cuando está disponible.
.explorar_tab_frec_so <- function(df, var, instrumento) {
  if (!var %in% names(df)) return(NULL)
  raw <- df[[var]]
  x <- as.character(raw)
  x <- x[!is.na(x) & nzchar(x) & x != "NA"]
  if (!length(x)) return(NULL)
  # Labels desde choices.
  map_lab <- .explorar_map_choices(var, instrumento)
  # Si no hay choices, probar atributos haven_labelled.
  if (is.null(map_lab) && inherits(raw, "haven_labelled")) {
    labs <- attr(raw, "labels", exact = TRUE)
    if (!is.null(labs)) {
      map_lab <- stats::setNames(as.character(unname(labs)),
                                  as.character(names(labs)))
    }
  }
  tb <- as.data.frame(table(x), stringsAsFactors = FALSE)
  names(tb) <- c("code", "n")
  tb$n <- as.integer(tb$n)
  tb$label <- if (!is.null(map_lab)) {
    ifelse(tb$code %in% names(map_lab), unname(map_lab[tb$code]), tb$code)
  } else tb$code
  tb$label[is.na(tb$label) | !nzchar(tb$label)] <- tb$code[is.na(tb$label) | !nzchar(tb$label)]
  tb$pct <- tb$n / sum(tb$n)
  # Ordenar por orden del catálogo si existe; sino, por frecuencia desc.
  if (!is.null(map_lab)) {
    levels_cat <- names(map_lab)
    ord <- match(tb$code, levels_cat)
    ord[is.na(ord)] <- 1e9
    tb <- tb[order(ord), , drop = FALSE]
  } else {
    tb <- tb[order(-tb$n), , drop = FALSE]
  }
  rownames(tb) <- NULL
  tb
}

# -----------------------------------------------------------------------------
# Tabla de frecuencia SM (select_multiple) — basado en columnas dummy
# -----------------------------------------------------------------------------
# XLSForm genera columnas dummy por opción: `<var>.<opcion>` o `<var>/<opcion>`.
# Cuenta 1s en cada dummy y retorna % sobre el N de la tabla.
.explorar_tab_frec_sm <- function(df, var, instrumento) {
  var_esc <- gsub("([\\W])", "\\\\\\1", as.character(var)[1])
  dummy_cols <- grep(paste0("^", var_esc, "[/\\.]"), names(df), value = TRUE)
  if (!length(dummy_cols)) return(NULL)
  n_total <- nrow(df)
  map_lab <- .explorar_map_choices(var, instrumento) %||% list()
  rows <- lapply(dummy_cols, function(col) {
    v <- df[[col]]
    # tratar 1/"1"/TRUE como marcado.
    n1 <- sum(as.character(v) %in% c("1", "TRUE", "true"), na.rm = TRUE)
    opt <- sub(paste0("^", var_esc, "[/\\.]"), "", col)
    lab <- if (opt %in% names(map_lab)) map_lab[[opt]] else opt
    data.frame(code = opt, label = lab, n = as.integer(n1),
               pct = n1 / max(1L, n_total), stringsAsFactors = FALSE)
  })
  tb <- do.call(rbind, rows)
  if (is.null(tb) || !nrow(tb)) return(NULL)
  tb <- tb[order(-tb$n), , drop = FALSE]
  rownames(tb) <- NULL
  tb
}

# -----------------------------------------------------------------------------
# KPIs básicos por tipo
# -----------------------------------------------------------------------------
.explorar_kpi_cards <- function(df, var, tipo) {
  if (!var %in% names(df)) {
    return(list(vd_kpi_card(title = "Variable", value = "—",
                             subtitle = "No existe en la base",
                             severidad = "warn")))
  }
  col <- df[[var]]
  n_total <- length(col)
  n_na <- sum(is.na(col) | (is.character(col) & (!nzchar(col) | col == "NA")))
  n_validos <- n_total - n_na
  pct_na <- if (n_total > 0L) n_na / n_total else 0
  sev_na <- if (pct_na < 0.05) "success" else if (pct_na < 0.20) "warn" else "danger"

  base_kpis <- list(
    vd_kpi_card(
      title = "Total casos",
      value = as.integer(n_total),
      subtitle = "Filas en la base",
      severidad = "neutral",
      icon = "database"
    ),
    vd_kpi_card(
      title = "Válidos",
      value = as.integer(n_validos),
      subtitle = sprintf("%.1f%% de la base", 100 * (1 - pct_na)),
      severidad = if (n_validos > 0L) "success" else "warn",
      icon = "check-circle"
    ),
    vd_kpi_card(
      title = "Missing",
      value = sprintf("%.1f%%", 100 * pct_na),
      subtitle = sprintf("%d de %d casos sin valor", as.integer(n_na), as.integer(n_total)),
      severidad = sev_na,
      icon = "alert-circle"
    )
  )

  # Específicos numéricos.
  if (tipo == "num") {
    x <- suppressWarnings(as.numeric(col))
    x <- x[is.finite(x)]
    if (length(x) > 0L) {
      base_kpis <- c(base_kpis, list(
        vd_kpi_card(
          title = "Media / Mediana",
          value = sprintf("%.2f / %.2f", mean(x), stats::median(x)),
          subtitle = sprintf("Rango: %.2f – %.2f", min(x), max(x)),
          severidad = "neutral",
          icon = "trending-up"
        )
      ))
    }
  }

  base_kpis
}

# -----------------------------------------------------------------------------
# Chart principal por tipo
# -----------------------------------------------------------------------------
.explorar_chart_univariado <- function(df, var, tipo, instrumento) {
  label <- .explorar_label_var(var, instrumento)
  titulo <- sprintf("Distribución de %s", label)

  if (tipo %in% c("so", "sm")) {
    tab <- if (tipo == "so") .explorar_tab_frec_so(df, var, instrumento)
           else .explorar_tab_frec_sm(df, var, instrumento)
    if (is.null(tab) || !nrow(tab)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(var = var, tipo = tipo,
                    empty_hint = "Sin casos para graficar.")
      ))
    }
    # Truncar categorías excesivas.
    lim <- .interactivo_limit_levels(tab$label, max_levels = 20L)
    keep <- lim$visible
    tab <- tab[tab$label %in% keep, , drop = FALSE]

    subt <- if (tipo == "sm") {
      sprintf("Select_multiple — %% sobre %d respondentes (opciones no excluyentes).", nrow(df))
    } else {
      sprintf("Select_one — frecuencia absoluta (n=%d válidos).", sum(tab$n))
    }
    # Redondear label con porcentaje para SM.
    y_labels <- if (tipo == "sm") {
      sprintf("%s (%.1f%%)", tab$label, 100 * tab$pct)
    } else tab$label

    return(vd_bar_h(
      title = titulo,
      subtitle = subt,
      labels = y_labels,
      values = as.integer(tab$n),
      x_title = if (tipo == "sm") "Menciones" else "Casos",
      meta = list(var = var, tipo = tipo,
                  n_categorias = nrow(tab), n_total = sum(tab$n))
    ))
  }

  if (tipo == "num") {
    x <- suppressWarnings(as.numeric(df[[var]]))
    x <- x[is.finite(x)]
    if (!length(x)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(var = var, tipo = tipo,
                    empty_hint = "Sin valores numéricos para graficar.")
      ))
    }
    # Histograma con ~30 bins automáticos.
    trace <- list(
      type = "histogram",
      x = x,
      marker = list(color = "#2563eb"),
      hovertemplate = "Rango: %{x}<br>n=%{y}<extra></extra>"
    )
    layout <- list(
      margin = list(l = 56, r = 24, t = 16, b = 48),
      xaxis = list(title = list(text = label), gridcolor = "#e5e7eb"),
      yaxis = list(title = list(text = "Frecuencia"), gridcolor = "#e5e7eb"),
      plot_bgcolor = "#ffffff", paper_bgcolor = "#ffffff",
      showlegend = FALSE, height = 320L
    )
    return(list(
      version = 1L, kind = "histogram",
      title = titulo,
      subtitle = sprintf("n=%d válidos · min=%.2f · max=%.2f · media=%.2f",
                          length(x), min(x), max(x), mean(x)),
      meta = list(var = var, tipo = tipo, n_validos = length(x)),
      plotly = list(data = list(trace), layout = layout,
                    config = list(displayModeBar = FALSE, responsive = TRUE)),
      actions = list()
    ))
  }

  if (tipo == "fecha") {
    raw <- df[[var]]
    dates <- tryCatch(as.Date(raw), error = function(e) NULL)
    if (is.null(dates)) dates <- as.Date(as.character(raw), optional = TRUE)
    dates <- dates[!is.na(dates)]
    if (!length(dates)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(var = var, tipo = tipo,
                    empty_hint = "Sin fechas válidas para graficar.")
      ))
    }
    trace <- list(
      type = "histogram",
      x = as.character(dates),
      marker = list(color = "#2563eb"),
      hovertemplate = "%{x}<br>n=%{y}<extra></extra>"
    )
    layout <- list(
      margin = list(l = 56, r = 24, t = 16, b = 48),
      xaxis = list(type = "date", title = list(text = label),
                    gridcolor = "#e5e7eb"),
      yaxis = list(title = list(text = "Frecuencia"), gridcolor = "#e5e7eb"),
      plot_bgcolor = "#ffffff", paper_bgcolor = "#ffffff",
      showlegend = FALSE, height = 300L
    )
    return(list(
      version = 1L, kind = "histogram",
      title = titulo,
      subtitle = sprintf("Rango: %s → %s", min(dates), max(dates)),
      meta = list(var = var, tipo = tipo, n_validos = length(dates)),
      plotly = list(data = list(trace), layout = layout,
                    config = list(displayModeBar = FALSE, responsive = TRUE)),
      actions = list()
    ))
  }

  # texto: no graficamos distribución. Mostramos muestra.
  if (tipo == "texto") {
    raw <- df[[var]]
    x <- as.character(raw)
    x <- x[!is.na(x) & nzchar(x)]
    n_val <- length(x)
    sample_n <- utils::head(unique(x), 20L)
    return(list(
      version = 1L, kind = "table",
      title = titulo,
      subtitle = sprintf("Texto libre — %d respuestas únicas (muestra máx 20).", length(unique(x))),
      meta = list(var = var, tipo = tipo, n_validos = n_val,
                  empty_hint = if (!length(sample_n)) "Sin respuestas."),
      plotly = list(data = list(), layout = list(), config = list()),
      actions = list(),
      samples = as.list(sample_n)
    ))
  }

  # Fallback.
  vd_bar_h(
    title = titulo, labels = character(), values = numeric(),
    meta = list(var = var, tipo = tipo,
                empty_hint = "Tipo de variable no soportado aún.")
  )
}

# -----------------------------------------------------------------------------
# Inventario de variables por sección
# -----------------------------------------------------------------------------
# Devuelve lista con: { n_variables, secciones = [{nombre, variables = [...]}] }
# Cada variable: { name, label, tipo, n_validos, n_nulos }.
.explorar_inventario <- function(data, instrumento) {
  if (is.null(data) || !ncol(data)) {
    return(list(n_variables = 0L, secciones = list()))
  }
  surv <- instrumento$survey %||% NULL
  sm <- instrumento$meta$section_map %||% NULL

  # Mapa variable → sección (nombre legible). Si no hay section_map,
  # tratamos todo como "General".
  var_seccion <- character(0)
  if (!is.null(surv) && "name" %in% names(surv)) {
    # Recorrer el survey de arriba a abajo y propagar la sección actual.
    current <- "General"
    for (i in seq_len(nrow(surv))) {
      t <- tolower(as.character(surv$type[i] %||% ""))
      nm <- as.character(surv$name[i] %||% "")
      if (grepl("^begin[_ ]group$", t) || grepl("^begin[_ ]repeat$", t)) {
        current <- if (nzchar(nm)) nm else current
      } else if (grepl("^end[_ ]group$", t) || grepl("^end[_ ]repeat$", t)) {
        current <- "General"
      } else if (nzchar(nm)) {
        var_seccion[nm] <- current
      }
    }
  }

  # Filtrar variables del df que existan en el survey (o todas si no hay).
  nombres_df <- names(data)
  # SM madre: si existe var.opcion o var/opcion, reconocemos `var` aunque
  # no exista como columna directa.
  sm_madres <- if (!is.null(surv) && all(c("name", "type") %in% names(surv))) {
    m <- !is.na(surv$name) &
         grepl("^select_multiple(\\s|$)", tolower(as.character(surv$type)))
    as.character(surv$name[m])
  } else character(0)

  var_candidatas <- unique(c(nombres_df, sm_madres))
  var_candidatas <- var_candidatas[!is.na(var_candidatas) & nzchar(var_candidatas)]

  # Excluir columnas dummy de SM, meta-columnas técnicas y etiquetas.
  dummy_patterns <- if (length(sm_madres)) {
    paste0("^(", paste(gsub("([\\W])", "\\\\\\1", sm_madres), collapse = "|"), ")[/\\.]")
  } else NULL
  excluir <- c("meta", "start", "end", "today", "deviceid", "_uuid",
                "_submission_time", "_id", "_submitted_by", "_index",
                "_parent_table_name", "_parent_index")
  var_candidatas <- var_candidatas[!var_candidatas %in% excluir]
  if (!is.null(dummy_patterns)) {
    var_candidatas <- var_candidatas[!grepl(dummy_patterns, var_candidatas)]
  }

  # Armar meta por variable.
  meta_rows <- lapply(var_candidatas, function(v) {
    tipo <- .explorar_tipo_var(v, survey = surv, df = data)
    # Contar válidos/nulos. Para SM, usar la 1ra columna dummy como proxy.
    col_name <- v
    if (tipo == "sm" && !(v %in% nombres_df)) {
      v_esc <- gsub("([\\W])", "\\\\\\1", v)
      dcols <- grep(paste0("^", v_esc, "[/\\.]"), nombres_df, value = TRUE)
      col_name <- dcols[1] %||% v
    }
    col <- if (col_name %in% nombres_df) data[[col_name]] else NULL
    n_total <- nrow(data)
    if (is.null(col)) {
      n_validos <- 0L; n_nulos <- n_total
    } else {
      n_na <- sum(is.na(col) | (is.character(col) & (!nzchar(col) | col == "NA")))
      n_nulos <- as.integer(n_na)
      n_validos <- as.integer(n_total - n_na)
    }
    list(
      name = v,
      label = .explorar_label_var(v, instrumento),
      tipo = tipo,
      n_validos = n_validos,
      n_nulos = n_nulos,
      seccion = unname(var_seccion[v]) %||% "General"
    )
  })

  # Agrupar por sección.
  secciones_chr <- vapply(meta_rows, function(r) r$seccion, character(1))
  sec_order <- unique(secciones_chr)
  secciones_out <- lapply(sec_order, function(sec) {
    idx <- which(secciones_chr == sec)
    vars <- lapply(meta_rows[idx], function(r) {
      list(
        name = r$name, label = r$label, tipo = r$tipo,
        n_validos = r$n_validos, n_nulos = r$n_nulos
      )
    })
    list(nombre = sec, variables = vars)
  })

  list(n_variables = length(meta_rows), secciones = secciones_out)
}

# -----------------------------------------------------------------------------
# Público: build_view_univariado
# -----------------------------------------------------------------------------
build_view_univariado <- function(data, var, instrumento) {
  tipo <- .explorar_tipo_var(var, survey = instrumento$survey %||% NULL, df = data)
  kpis <- .explorar_kpi_cards(data, var, tipo)
  # Para SM, la columna de conteos no se llama "var" directo.
  chart <- .explorar_chart_univariado(data, var, tipo, instrumento)
  list(
    ok = TRUE,
    var = var,
    tipo = tipo,
    label = .explorar_label_var(var, instrumento),
    kpis = kpis,
    chart = chart
  )
}

# -----------------------------------------------------------------------------
# Público: build_view_bivariado (SO×SO como bar_stack; otros como stretch)
# -----------------------------------------------------------------------------
build_view_bivariado <- function(data, var_x, var_y, instrumento) {
  surv <- instrumento$survey %||% NULL
  tipo_x <- .explorar_tipo_var(var_x, survey = surv, df = data)
  tipo_y <- .explorar_tipo_var(var_y, survey = surv, df = data)
  label_x <- .explorar_label_var(var_x, instrumento)
  label_y <- .explorar_label_var(var_y, instrumento)

  titulo <- sprintf("%s × %s", label_x, label_y)

  # SO × SO: bar_stack con x=categorías de var_x, serie por var_y.
  if (tipo_x == "so" && tipo_y == "so") {
    if (!(var_x %in% names(data)) || !(var_y %in% names(data))) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(empty_hint = "Alguna variable no existe en la base.")
      ))
    }
    map_x <- .explorar_map_choices(var_x, instrumento)
    map_y <- .explorar_map_choices(var_y, instrumento)
    xv <- as.character(data[[var_x]])
    yv <- as.character(data[[var_y]])
    ok <- !is.na(xv) & nzchar(xv) & xv != "NA" &
          !is.na(yv) & nzchar(yv) & yv != "NA"
    xv <- xv[ok]; yv <- yv[ok]
    if (!length(xv)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(empty_hint = "Sin casos válidos en ambas variables.")
      ))
    }
    xv_lab <- if (!is.null(map_x)) unname(map_x[xv]) else xv
    xv_lab[is.na(xv_lab)] <- xv[is.na(xv_lab)]
    yv_lab <- if (!is.null(map_y)) unname(map_y[yv]) else yv
    yv_lab[is.na(yv_lab)] <- yv[is.na(yv_lab)]

    x_levels <- if (!is.null(map_x)) unique(unname(map_x)) else sort(unique(xv_lab))
    y_levels <- if (!is.null(map_y)) unique(unname(map_y)) else sort(unique(yv_lab))
    x_levels <- x_levels[x_levels %in% xv_lab]
    y_levels <- y_levels[y_levels %in% yv_lab]

    traces <- lapply(y_levels, function(yl) {
      counts <- vapply(x_levels, function(xl) sum(xv_lab == xl & yv_lab == yl),
                        integer(1))
      list(
        type = "bar",
        name = yl,
        x = x_levels,
        y = as.integer(counts),
        hovertemplate = sprintf("%s = %%{x}<br>%s = %s<br>n=%%{y}<extra></extra>",
                                 label_x, label_y, yl)
      )
    })
    layout <- list(
      barmode = "stack",
      margin = list(l = 56, r = 24, t = 16, b = 80),
      xaxis = list(title = list(text = label_x), tickangle = -20,
                    automargin = TRUE),
      yaxis = list(title = list(text = "Casos"), gridcolor = "#e5e7eb"),
      plot_bgcolor = "#ffffff", paper_bgcolor = "#ffffff",
      legend = list(orientation = "h", y = -0.3),
      height = 360L
    )
    return(list(
      version = 1L, kind = "bar_stack",
      title = titulo,
      subtitle = sprintf("n=%d casos válidos.", length(xv)),
      meta = list(var_x = var_x, var_y = var_y,
                  tipo_x = tipo_x, tipo_y = tipo_y),
      plotly = list(data = traces, layout = layout,
                    config = list(displayModeBar = FALSE, responsive = TRUE)),
      actions = list()
    ))
  }

  # Otros cruces: mensaje suave — stretch para sprints futuros.
  vd_bar_h(
    title = titulo, labels = character(), values = numeric(),
    meta = list(
      tipo_x = tipo_x, tipo_y = tipo_y,
      empty_hint = sprintf(
        "Cruce %s × %s no soportado aún (sólo SO × SO por ahora).",
        tipo_x, tipo_y
      )
    )
  )
}
