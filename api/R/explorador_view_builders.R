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
# Aplicar filtros a un data.frame
# -----------------------------------------------------------------------------
# Filtros es una lista nombrada var → list de valores aceptados.
#   list(p1 = list("1","2"), distrito = list("Lima"))
# Para SM, el valor es el nombre de la opción (dummy) y se interpreta como
# "caso donde p10.opcion == 1". Para SO, se interpreta como "p1 %in% vals".
# Devuelve un df filtrado preservando atributos (labels, etc.).
.explorar_apply_filtros <- function(data, filtros, survey = NULL) {
  if (is.null(filtros) || length(filtros) == 0L || !nrow(data)) return(data)
  keep <- rep(TRUE, nrow(data))
  for (var in names(filtros)) {
    f <- filtros[[var]]
    if (is.null(f)) next
    tipo <- .explorar_tipo_var(var, survey = survey, df = data)

    # Filtro numérico/fecha: {min, max} (ambos opcionales).
    is_range_filter <- is.list(f) && (!is.null(f$min) || !is.null(f$max)) &&
                        !is.null(names(f))
    if (is_range_filter && var %in% names(data)) {
      if (tipo == "fecha") {
        col <- suppressWarnings(as.Date(data[[var]]))
        mn <- suppressWarnings(as.Date(f$min %||% NA))
        mx <- suppressWarnings(as.Date(f$max %||% NA))
        mask <- !is.na(col)
        if (!is.na(mn)) mask <- mask & (col >= mn)
        if (!is.na(mx)) mask <- mask & (col <= mx)
      } else {
        x <- suppressWarnings(as.numeric(data[[var]]))
        mn <- suppressWarnings(as.numeric(f$min))
        mx <- suppressWarnings(as.numeric(f$max))
        mask <- !is.na(x)
        if (!is.na(mn)) mask <- mask & (x >= mn)
        if (!is.na(mx)) mask <- mask & (x <= mx)
      }
      keep <- keep & mask
      next
    }

    vals <- unlist(f)
    vals <- as.character(vals[!is.na(vals) & nzchar(as.character(vals))])
    if (!length(vals)) next
    if (tipo == "sm") {
      # OR sobre columnas dummy: si alguna dummy de la opción está en 1.
      var_esc <- gsub("([\\W])", "\\\\\\1", var)
      mask_any <- rep(FALSE, nrow(data))
      for (v in vals) {
        for (sep in c(".", "/")) {
          cname <- paste0(var, sep, v)
          if (cname %in% names(data)) {
            mk <- as.character(data[[cname]]) %in% c("1", "TRUE", "true")
            mask_any <- mask_any | mk
          }
        }
      }
      keep <- keep & mask_any
    } else if (var %in% names(data)) {
      col <- as.character(data[[var]])
      keep <- keep & (col %in% vals)
    }
  }
  data[keep, , drop = FALSE]
}

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

.explorar_wrap_label <- function(x, width = 36L) {
  x <- as.character(x %||% "")
  vapply(x, function(label) {
    paste(strwrap(label, width = width, simplify = FALSE)[[1]], collapse = "<br>")
  }, character(1))
}

# -----------------------------------------------------------------------------
# KPIs básicos por tipo
# -----------------------------------------------------------------------------
.explorar_kpi_cards <- function(df, var, tipo, instrumento = NULL) {
  if (tipo == "sm") {
    tab_sm <- .explorar_tab_frec_sm(df, var, instrumento %||% list())
    if (is.null(tab_sm) || !nrow(tab_sm)) {
      return(list(vd_kpi_card(title = "Variable", value = "—",
                               subtitle = "No existe en la base",
                               severidad = "warn")))
    }
    var_esc <- gsub("([\\W])", "\\\\\\1", as.character(var)[1])
    dummy_cols <- grep(paste0("^", var_esc, "[/\\.]"), names(df), value = TRUE)
    n_total <- nrow(df)
    if (!length(dummy_cols)) {
      n_validos <- 0L
      n_na <- n_total
    } else {
      raw_rows <- lapply(dummy_cols, function(col) as.character(df[[col]]))
      available <- Reduce(`|`, lapply(raw_rows, function(x) !is.na(x) & nzchar(x) & x != "NA"))
      n_validos <- sum(available, na.rm = TRUE)
      n_na <- n_total - n_validos
    }
    pct_na <- if (n_total > 0L) n_na / n_total else 0
    sev_na <- if (pct_na < 0.05) "success" else if (pct_na < 0.20) "warn" else "danger"

    return(list(
      vd_kpi_card(
        title = "Total casos",
        value = as.integer(n_total),
        subtitle = "Filas en la base",
        severidad = "neutral",
        icon = "database"
      ),
      vd_kpi_card(
        title = "Respondentes con dato",
        value = as.integer(n_validos),
        subtitle = sprintf("%.1f%% de la base", 100 * (1 - pct_na)),
        severidad = if (n_validos > 0L) "success" else "warn",
        icon = "check-circle"
      ),
      vd_kpi_card(
        title = "Sin respuesta",
        value = sprintf("%.1f%%", 100 * pct_na),
        subtitle = sprintf("%d de %d casos sin marca en la selección múltiple", as.integer(n_na), as.integer(n_total)),
        severidad = sev_na,
        icon = "alert-circle"
      ),
      vd_kpi_card(
        title = "Opciones activas",
        value = as.integer(sum(tab_sm$n > 0, na.rm = TRUE)),
        subtitle = sprintf("%d opciones con al menos una marca", nrow(tab_sm)),
        severidad = "neutral",
        icon = "list"
      )
    ))
  }

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

  if (tipo == "so") {
    tab <- .explorar_tab_frec_so(df, var, instrumento)
    if (is.null(tab) || !nrow(tab)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(var = var, tipo = tipo,
                    empty_hint = "Sin casos para graficar.")
      ))
    }
    lim <- .interactivo_limit_levels(tab$label, max_levels = 20L)
    keep <- lim$visible
    tab <- tab[tab$label %in% keep, , drop = FALSE]
    pal_so <- grDevices::colorRampPalette(c("#dbe8ff", "#7aa2f8", "#2457d6", "#002457"))(nrow(tab))
    traces <- lapply(seq_len(nrow(tab)), function(i) {
      show_text <- as.numeric(tab$pct[i]) >= 0.05
      list(
        type = "bar",
        name = as.character(tab$label[i]),
        orientation = "h",
        x = list(as.numeric(tab$pct[i])),
        y = list("Distribución"),
        text = list(if (show_text) sprintf("%.1f%%", 100 * tab$pct[i]) else ""),
        textposition = "inside",
        insidetextanchor = "middle",
        marker = list(color = pal_so[i]),
        hovertemplate = sprintf(
          "%s<br>n=%d<br>%s<extra></extra>",
          as.character(tab$label[i]),
          as.integer(tab$n[i]),
          sprintf("%.1f%%", 100 * tab$pct[i])
        )
      )
    })
    layout <- utils::modifyList(
      pulso_plotly_layout_base(
        height = max(180L, 140L + 8L * nrow(tab)),
        margin = list(l = 36, r = 24, t = 12, b = 52),
        showlegend = TRUE,
        legend = list(
          orientation = "h",
          y = -0.24,
          x = 0.5,
          xanchor = "center",
          traceorder = "reversed"
        )
      ),
      list(
        barmode = "stack",
        xaxis = utils::modifyList(
          pulso_plotly_axis(title = NULL),
          list(tickformat = ",.0%", range = c(0, 1))
        ),
        yaxis = utils::modifyList(
          pulso_plotly_axis(title = NULL),
          list(showticklabels = FALSE)
        )
      )
    )
    return(list(
      version = 1L,
      kind = "bar_stack",
      title = titulo,
      subtitle = sprintf("Selección única — barra apilada con %d categorías válidas.", nrow(tab)),
      meta = list(
        var = var,
        tipo = tipo,
        n_categorias = nrow(tab),
        n_total = sum(tab$n),
        eyebrow = "Selección única",
        note = "Cada segmento muestra la participación de una categoría sobre el total válido."
      ),
      plotly = list(
        data = traces,
        layout = layout,
        config = pulso_plotly_config_base()
      ),
      actions = list()
    ))
  }

  if (tipo == "sm") {
    tab <- .explorar_tab_frec_sm(df, var, instrumento)
    if (is.null(tab) || !nrow(tab)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(var = var, tipo = tipo,
                    empty_hint = "Sin casos para graficar.")
      ))
    }
    lim <- .interactivo_limit_levels(tab$label, max_levels = 20L)
    keep <- lim$visible
    tab <- tab[tab$label %in% keep, , drop = FALSE]
    labels_wrapped <- .explorar_wrap_label(tab$label, width = 42L)
    trace <- list(
      type = "bar",
      orientation = "h",
      x = as.numeric(tab$pct),
      y = labels_wrapped,
      hovertext = as.character(tab$label),
      text = sprintf("%.1f%%", 100 * tab$pct),
      textposition = "outside",
      cliponaxis = FALSE,
      marker = list(color = pulso_plotly_palette()$success),
      customdata = as.integer(tab$n),
      hovertemplate = "%{hovertext}<br>%{text}<br>Menciones: %{customdata}<extra></extra>"
    )
    layout <- utils::modifyList(
      pulso_plotly_layout_base(
        height = max(280L, 36L * nrow(tab) + 110L),
        margin = list(l = 280, r = 64, t = 12, b = 56),
        showlegend = FALSE
      ),
      list(
        xaxis = utils::modifyList(
          pulso_plotly_axis(title = "Porcentaje de respondentes"),
          list(
            tickformat = ",.0%",
            range = c(0, max(0.05, min(1, max(tab$pct, na.rm = TRUE) * 1.15)))
          )
        ),
        yaxis = utils::modifyList(
          pulso_plotly_axis(title = NULL, autorange = "reversed"),
          list(automargin = TRUE)
        )
      )
    )
    return(list(
      version = 1L,
      kind = "bar_h",
      title = titulo,
      subtitle = sprintf("Selección múltiple — porcentaje sobre %d respondentes.", nrow(df)),
      meta = list(
        var = var,
        tipo = tipo,
        n_categorias = nrow(tab),
        n_total = nrow(df),
        eyebrow = "Selección múltiple",
        note = "Las etiquetas muestran el porcentaje con 1 decimal sobre el total de respondentes."
      ),
      plotly = list(
        data = list(trace),
        layout = layout,
        config = pulso_plotly_config_base()
      ),
      actions = list()
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
    trace <- list(
      type = "histogram",
      x = x,
      marker = list(
        color = "#7c3aed",
        line = list(color = "#ffffff", width = 1.5)
      ),
      hovertemplate = "Rango: %{x}<br>n=%{y}<extra></extra>"
    )
    layout <- utils::modifyList(
      pulso_plotly_layout_base(
        height = 320L,
        margin = list(l = 56, r = 24, t = 16, b = 48),
        showlegend = FALSE
      ),
      list(
        xaxis = pulso_plotly_axis(title = label),
        yaxis = pulso_plotly_axis(title = "Frecuencia")
      )
    )
    return(list(
      version = 1L, kind = "histogram",
      title = titulo,
      subtitle = sprintf("n=%d válidos · min=%.2f · max=%.2f · media=%.2f",
                          length(x), min(x), max(x), mean(x)),
      meta = list(
        var = var,
        tipo = tipo,
        n_validos = length(x),
        eyebrow = "Numérica",
        note = "Histograma disponible para variables integer y decimal."
      ),
      plotly = list(data = list(trace), layout = layout,
                    config = pulso_plotly_config_base()),
      actions = list()
    ))
  }

  vd_bar_h(
    title = titulo, labels = character(), values = numeric(),
    meta = list(var = var, tipo = tipo,
                empty_hint = "Explorar datos solo soporta selección única, selección múltiple y variables numéricas.")
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
  meta_rows <- Filter(function(r) r$tipo %in% c("so", "sm", "num"), meta_rows)

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
# Público: build_view_univariado (con filtros opcionales)
# -----------------------------------------------------------------------------
build_view_univariado <- function(data, var, instrumento, filtros = NULL) {
  surv <- instrumento$survey %||% NULL
  data_f <- .explorar_apply_filtros(data, filtros, survey = surv)
  tipo <- .explorar_tipo_var(var, survey = surv, df = data_f)
  kpis <- .explorar_kpi_cards(data_f, var, tipo, instrumento)
  chart <- .explorar_chart_univariado(data_f, var, tipo, instrumento)
  n_tras_filtro <- nrow(data_f)
  n_total <- nrow(data)
  list(
    ok = TRUE,
    var = var,
    tipo = tipo,
    label = .explorar_label_var(var, instrumento),
    kpis = kpis,
    chart = chart,
    n_tras_filtro = as.integer(n_tras_filtro),
    n_total = as.integer(n_total),
    filtros_aplicados = length(filtros %||% list())
  )
}

# -----------------------------------------------------------------------------
# Público: build_view_bivariado (SO×SO, SO×SM, SO×NUM con filtros opcionales)
# -----------------------------------------------------------------------------
build_view_bivariado <- function(data, var_x, var_y, instrumento, filtros = NULL) {
  surv <- instrumento$survey %||% NULL
  data <- .explorar_apply_filtros(data, filtros, survey = surv)
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

    # Total por nivel de X — usado para (a) normalizar al 100% (via
    # `barnorm = "percent"` en layout) y (b) anotar el N total encima
    # de cada barra para que el eje 0-100% no borre la magnitud real.
    n_total_por_x <- vapply(x_levels, function(xl) sum(xv_lab == xl),
                             integer(1))

    traces <- lapply(y_levels, function(yl) {
      counts <- vapply(x_levels, function(xl) sum(xv_lab == xl & yv_lab == yl),
                        integer(1))
      # % = count / total del nivel X (0 si el nivel está vacío).
      pct <- ifelse(n_total_por_x > 0,
                     100 * counts / n_total_por_x,
                     0)
      # customdata: matriz con [count, pct] por punto — habilita mostrar
      # tanto el valor absoluto como el % en el hover, aun cuando la
      # barra está normalizada al 100% por barnorm.
      cd <- matrix(c(as.integer(counts), as.numeric(pct)), ncol = 2L)
      list(
        type = "bar",
        name = yl,
        x = x_levels,
        y = as.integer(counts),
        customdata = cd,
        hovertemplate = sprintf(
          paste0("%s = %%{x}<br>%s = %s<br>",
                 "n = %%{customdata[0]} (%%{customdata[1]:.1f}%%)<extra></extra>"),
          label_x, label_y, yl
        )
      )
    })

    # Anotaciones con el N total por cada nivel del eje X. Van arriba
    # del 100% en el eje Y (y = 100, yshift = 12) — así el porcentaje
    # se lee dentro del chart y la magnitud absoluta queda visible
    # sin ocupar el eje Y.
    annotations <- lapply(seq_along(x_levels), function(i) {
      list(
        x = x_levels[i],
        y = 100,
        text = sprintf("N=%s", format(n_total_por_x[i], big.mark = ",")),
        xref = "x",
        yref = "y",
        showarrow = FALSE,
        yshift = 14,
        font = list(size = 11, color = "#5f6b7a", family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif")
      )
    })

    layout <- list(
      barmode = "stack",
      barnorm = "percent",
      margin = list(l = 56, r = 24, t = 36, b = 80),
      xaxis = list(title = list(text = label_x), tickangle = -20,
                    automargin = TRUE),
      yaxis = list(title = list(text = "Proporción"),
                    ticksuffix = "%",
                    range = c(0, 100),
                    gridcolor = "#e5e7eb"),
      plot_bgcolor = "#ffffff", paper_bgcolor = "#ffffff",
      legend = list(orientation = "h", y = -0.3, traceorder = "reversed"),
      annotations = annotations,
      height = 380L
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

  # SO × SM: chip_bars. Por cada opción SM mostramos barra (fill-only)
  # segmentada por var_x (SO).
  if (tipo_x == "so" && tipo_y == "sm") {
    tab_sm <- .explorar_tab_frec_sm(data, var_y, instrumento)
    if (is.null(tab_sm) || !nrow(tab_sm) || !(var_x %in% names(data))) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(tipo_x = tipo_x, tipo_y = tipo_y,
                    empty_hint = "Sin dummies SM para graficar.")
      ))
    }
    map_x <- .explorar_map_choices(var_x, instrumento)
    xv_raw <- as.character(data[[var_x]])
    ok <- !is.na(xv_raw) & nzchar(xv_raw) & xv_raw != "NA"
    df_ok <- data[ok, , drop = FALSE]
    xv <- xv_raw[ok]
    xv_lab <- if (!is.null(map_x)) unname(map_x[xv]) else xv
    xv_lab[is.na(xv_lab)] <- xv[is.na(xv_lab)]
    x_levels <- if (!is.null(map_x)) unique(unname(map_x)) else sort(unique(xv_lab))
    x_levels <- x_levels[x_levels %in% xv_lab]
    # Para cada opción SM (fila de tab_sm) armamos una barra apilada
    # por x_levels.
    var_esc <- gsub("([\\W])", "\\\\\\1", var_y)
    traces <- list()
    # Trace por x_level (color por categoría de var_x) — cada trace tiene
    # y=opciones SM, x=proporción que marcó esa opción en ese x_level.
    n_total_por_x <- vapply(x_levels, function(xl) sum(xv_lab == xl),
                             integer(1))
    for (i in seq_along(x_levels)) {
      xl <- x_levels[i]
      n_cat <- n_total_por_x[i]
      if (n_cat == 0L) next
      vals <- vapply(tab_sm$code, function(opt_code) {
        # Detectar columna dummy.
        cname <- NULL
        for (sep in c(".", "/")) {
          cn <- paste0(var_y, sep, opt_code)
          if (cn %in% names(df_ok)) { cname <- cn; break }
        }
        if (is.null(cname)) return(0)
        col <- df_ok[[cname]]
        vv <- as.character(col)[xv_lab == xl]
        sum(vv %in% c("1", "TRUE", "true"), na.rm = TRUE) / n_cat
      }, numeric(1))
      traces[[length(traces) + 1L]] <- list(
        type = "bar",
        orientation = "h",
        name = as.character(xl),
        x = as.numeric(vals),
        y = as.character(tab_sm$label),
        hovertemplate = sprintf("%%{y}<br>%s = %%{x:.1%%}<extra>%s</extra>",
                                 xl, xl)
      )
    }
    layout <- list(
      barmode = "group",
      margin = list(l = 200, r = 24, t = 16, b = 60),
      xaxis = list(title = list(text = "Proporción dentro de la categoría"),
                    tickformat = ",.0%", range = c(0, 1),
                    gridcolor = "#e5e7eb"),
      yaxis = list(automargin = TRUE, autorange = "reversed"),
      plot_bgcolor = "#ffffff", paper_bgcolor = "#ffffff",
      legend = list(orientation = "h", y = -0.15),
      height = max(300L, 32L * nrow(tab_sm) + 140L)
    )
    return(list(
      version = 1L, kind = "chip_bars",
      title = titulo,
      subtitle = sprintf(
        "Cada barra compara la proporción que marcó la opción según %s.",
        label_x
      ),
      meta = list(var_x = var_x, var_y = var_y,
                  tipo_x = tipo_x, tipo_y = tipo_y),
      plotly = list(data = traces, layout = layout,
                    config = list(displayModeBar = FALSE, responsive = TRUE)),
      actions = list()
    ))
  }

  # SO × NUM: boxplot por categoría de SO.
  if (tipo_x == "so" && tipo_y == "num") {
    if (!(var_x %in% names(data)) || !(var_y %in% names(data))) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(empty_hint = "Variables no presentes en la base.")
      ))
    }
    map_x <- .explorar_map_choices(var_x, instrumento)
    xv <- as.character(data[[var_x]])
    yv <- suppressWarnings(as.numeric(data[[var_y]]))
    ok <- !is.na(xv) & nzchar(xv) & xv != "NA" & is.finite(yv)
    xv <- xv[ok]; yv <- yv[ok]
    if (!length(xv)) {
      return(vd_bar_h(
        title = titulo, labels = character(), values = numeric(),
        meta = list(empty_hint = "Sin casos válidos en ambas variables.")
      ))
    }
    xv_lab <- if (!is.null(map_x)) unname(map_x[xv]) else xv
    xv_lab[is.na(xv_lab)] <- xv[is.na(xv_lab)]
    cats <- if (!is.null(map_x)) unique(unname(map_x)) else sort(unique(xv_lab))
    cats <- cats[cats %in% xv_lab]
    trace <- list(
      type = "box",
      x = as.character(xv_lab),
      y = as.numeric(yv),
      boxpoints = "outliers",
      marker = list(color = "#2563eb"),
      line = list(color = "#1e40af"),
      hovertemplate = sprintf("%s=%%{x}<br>%s=%%{y}<extra></extra>",
                                label_x, label_y)
    )
    layout <- list(
      margin = list(l = 56, r = 24, t = 16, b = 60),
      xaxis = list(title = list(text = label_x), tickangle = -20,
                    categoryorder = "array",
                    categoryarray = cats, automargin = TRUE),
      yaxis = list(title = list(text = label_y), gridcolor = "#e5e7eb"),
      plot_bgcolor = "#ffffff", paper_bgcolor = "#ffffff",
      showlegend = FALSE,
      height = 360L
    )
    return(list(
      version = 1L, kind = "boxplot",
      title = titulo,
      subtitle = sprintf("Distribución de %s por categoría (n=%d).",
                          label_y, length(xv)),
      meta = list(var_x = var_x, var_y = var_y,
                  tipo_x = tipo_x, tipo_y = tipo_y),
      plotly = list(data = list(trace), layout = layout,
                    config = list(displayModeBar = FALSE, responsive = TRUE)),
      actions = list()
    ))
  }

  # Otros cruces: fallback con mensaje.
  vd_bar_h(
    title = titulo, labels = character(), values = numeric(),
    meta = list(
      tipo_x = tipo_x, tipo_y = tipo_y,
      empty_hint = sprintf(
        "Cruce %s × %s no soportado (soportados: so×so, so×sm, so×num).",
        tipo_x, tipo_y
      )
    )
  )
}

# -----------------------------------------------------------------------------
# Resumen de rango para variables num/fecha (para el filtro UI)
# -----------------------------------------------------------------------------
# Retorna list(min, max, q1, q3, mediana, p1, p99, n_validos) o NULL si la
# variable no aplica. Usado por /api/validacion/v2/explorar/valores para
# que el frontend arme un slider de rango con atajos Q1-Q3 / p1-p99.
.explorar_resumen_rango <- function(df, var, tipo) {
  if (!var %in% names(df)) return(NULL)
  raw <- df[[var]]
  if (tipo == "fecha") {
    d <- suppressWarnings(as.Date(raw))
    d <- d[!is.na(d)]
    if (!length(d)) return(NULL)
    return(list(
      min = as.character(min(d)),
      max = as.character(max(d)),
      n_validos = as.integer(length(d))
    ))
  }
  if (tipo == "num") {
    x <- suppressWarnings(as.numeric(raw))
    x <- x[is.finite(x)]
    if (!length(x)) return(NULL)
    qs <- stats::quantile(x, c(0.01, 0.25, 0.5, 0.75, 0.99),
                          na.rm = TRUE, names = FALSE)
    return(list(
      min = as.numeric(min(x)),
      max = as.numeric(max(x)),
      p1 = as.numeric(qs[1]),
      q1 = as.numeric(qs[2]),
      mediana = as.numeric(qs[3]),
      q3 = as.numeric(qs[4]),
      p99 = as.numeric(qs[5]),
      n_validos = as.integer(length(x))
    ))
  }
  NULL
}
