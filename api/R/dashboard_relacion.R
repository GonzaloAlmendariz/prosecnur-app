# ============================================================
# Tab "Relaciones" — cruce var_principal × var_segmento, opcionalmente
# iterado por una tercera variable. Produce contingencia + traces para
# Plotly (barras apiladas) y tabla; soporta descarga Excel multi-hoja.
#
# Reusa: .dashboard_apply_filtros, .dashboard_tipo_pregunta,
# .dashboard_resolver_sm_spec, .dashboard_dist_so. Espejo de
# interactivo_relacion.R en el legacy (sin Shiny modules).
# ============================================================

# Resuelve catálogo {code, label} ordenado para una variable SO o
# para los dummies de una SM madre. Sirve como eje categórico.
.dashboard_relacion_levels <- function(var, tipo, rp_inst, df, s = NULL) {
  if (identical(tipo, "sm")) {
    spec <- .dashboard_resolver_sm_spec(var, rp_inst, df, s = s)
    if (!length(spec$cols)) return(list())
    lapply(spec$cols, function(col) {
      code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var, "."))),
                  "", col)
      code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(var, "/"))),
                  "", code)
      label <- as.character(spec$map_code_to_label[[code]] %||% code)
      list(code = code, label = label, col_dummy = col)
    })
  } else {
    if (!(var %in% names(df))) return(list())
    surv <- rp_inst$survey
    ch <- rp_inst$choices
    label_col <- if (!is.null(ch) && "label" %in% names(ch)) "label"
                 else if (!is.null(ch)) grep("^label(::|$)", names(ch), value = TRUE)[1]
                 else NULL
    map <- NULL
    if (!is.null(surv) && !is.null(ch) && !is.null(label_col) &&
        !is.na(label_col) && label_col %in% names(ch)) {
      i <- which(!is.na(surv$name) & surv$name == var)[1]
      if (!is.na(i)) {
        ln <- as.character(surv$list_name[i])
        if (!is.na(ln) && nzchar(ln)) {
          ch_v <- ch[ch$list_name == ln, , drop = FALSE]
          if (nrow(ch_v)) {
            map <- stats::setNames(
              as.character(ch_v[[label_col]]),
              as.character(ch_v$name)
            )
          }
        }
      }
    }
    codes <- if (!is.null(map)) names(map) else {
      x <- as.character(df[[var]])
      x <- x[!is.na(x) & nzchar(x) & x != "NA"]
      sort(unique(x))
    }
    lapply(codes, function(code) {
      label <- if (!is.null(map)) as.character(map[[code]] %||% code) else code
      list(code = as.character(code), label = label)
    })
  }
}

# Para una fila de data (df_row), determina si el respondente "tiene"
# el code dado de la variable (SO: igualdad; SM: dummy == 1).
.dashboard_pertenece_a_nivel <- function(df, var, tipo, nivel) {
  if (identical(tipo, "sm")) {
    col <- nivel$col_dummy
    if (is.null(col) || !(col %in% names(df))) return(rep(FALSE, nrow(df)))
    x <- suppressWarnings(as.numeric(as.character(df[[col]])))
    if (all(is.na(x)) && is.logical(df[[col]])) x <- as.numeric(df[[col]])
    !is.na(x) & x == 1
  } else {
    if (!(var %in% names(df))) return(rep(FALSE, nrow(df)))
    x <- as.character(df[[var]])
    !is.na(x) & x == as.character(nivel$code)
  }
}

# Produce un cruce "principal × segmento" sobre un slice de data.
# Devuelve {n_total, contingencia: {filas, columnas, celdas}, plot_traces}.
# - filas = niveles de var_principal
# - columnas = niveles de var_segmento (+ "Total")
# - celdas[i][j] = {n, pct_col, pct_row}
.dashboard_relacion_one_cross <- function(df, var_principal, var_segmento,
                                          rp_inst, palette = NULL, s = NULL) {
  if (!nrow(df)) {
    return(list(
      n_total = 0L,
      filas = list(),
      columnas = list(),
      celdas = list(),
      plot_traces = list()
    ))
  }

  tipo_p <- .dashboard_tipo_pregunta(var_principal, rp_inst, df)
  tipo_s <- .dashboard_tipo_pregunta(var_segmento, rp_inst, df)
  niveles_p <- .dashboard_relacion_levels(var_principal, tipo_p, rp_inst, df, s = s)
  niveles_s <- .dashboard_relacion_levels(var_segmento, tipo_s, rp_inst, df, s = s)
  if (!length(niveles_p) || !length(niveles_s)) {
    return(list(
      n_total = nrow(df),
      filas = lapply(niveles_p, function(n) list(code = n$code, label = n$label)),
      columnas = lapply(niveles_s, function(n) list(code = n$code, label = n$label)),
      celdas = list(),
      plot_traces = list()
    ))
  }

  # Construir matriz n[i,j].
  n_mat <- matrix(0L, nrow = length(niveles_p), ncol = length(niveles_s))
  pertenece_p <- lapply(niveles_p, function(nv) .dashboard_pertenece_a_nivel(df, var_principal, tipo_p, nv))
  pertenece_s <- lapply(niveles_s, function(nv) .dashboard_pertenece_a_nivel(df, var_segmento, tipo_s, nv))
  for (i in seq_along(niveles_p)) {
    for (j in seq_along(niveles_s)) {
      n_mat[i, j] <- as.integer(sum(pertenece_p[[i]] & pertenece_s[[j]], na.rm = TRUE))
    }
  }

  # Totales.
  col_totals <- colSums(n_mat)
  row_totals <- rowSums(n_mat)
  grand_total <- sum(n_mat)

  filas <- lapply(seq_along(niveles_p), function(i) {
    list(code = niveles_p[[i]]$code,
         label = niveles_p[[i]]$label,
         n_total = as.integer(row_totals[i]))
  })
  columnas <- lapply(seq_along(niveles_s), function(j) {
    list(code = niveles_s[[j]]$code,
         label = niveles_s[[j]]$label,
         n_total = as.integer(col_totals[j]))
  })

  celdas <- lapply(seq_along(niveles_p), function(i) {
    lapply(seq_along(niveles_s), function(j) {
      n <- as.integer(n_mat[i, j])
      pct_col <- if (col_totals[j] > 0) n / col_totals[j] else 0
      pct_row <- if (row_totals[i] > 0) n / row_totals[i] else 0
      list(n = n,
           pct_col = round(pct_col, 6),
           pct_row = round(pct_row, 6))
    })
  })

  # Plotly stacked bar: una traza por nivel de var_principal; X = niveles
  # de var_segmento; Y = pct_col (apilada da 100%).
  plot_traces <- lapply(seq_along(niveles_p), function(i) {
    color <- .dashboard_color_for_label(niveles_p[[i]]$label, palette)
    trace <- list(
      type = "bar",
      name = niveles_p[[i]]$label,
      x = lapply(niveles_s, function(s) s$label),
      y = lapply(seq_along(niveles_s), function(j) {
        if (col_totals[j] > 0) round(n_mat[i, j] / col_totals[j], 6) else 0
      }),
      text = lapply(seq_along(niveles_s), function(j) {
        n <- n_mat[i, j]
        pct <- if (col_totals[j] > 0) n / col_totals[j] else 0
        sprintf("%d (%.1f%%)", n, 100 * pct)
      }),
      hoverinfo = "text+name"
    )
    if (!is.null(color)) trace$marker <- list(color = color)
    trace
  })

  list(
    n_total = as.integer(grand_total),
    filas = filas,
    columnas = columnas,
    celdas = celdas,
    plot_traces = plot_traces
  )
}

# Endpoint principal: cruce con filtros e iteración opcional.
# `iterar` = list(var = "...") (NULL si no aplica).
# Devuelve `cruces` = list de cruces; cada cruce trae nivel? + payload.
.dashboard_relacion_payload <- function(s, var_principal, var_segmento,
                                        filtros = list(), iterar = NULL) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst) ||
      !nzchar(var_principal) || !nzchar(var_segmento)) {
    return(list(cruces = list(), n_total = 0L))
  }

  data <- .dashboard_apply_filtros(s$rp_data, filtros)
  if (!nrow(data)) return(list(cruces = list(), n_total = 0L))

  paleta_p <- .dashboard_palette_for_var(var_principal, s$rp_inst, s)

  iter_var <- if (is.list(iterar)) as.character(iterar$var %||% "")[1] else ""
  if (!nzchar(iter_var) || !(iter_var %in% names(data))) {
    cruce <- .dashboard_relacion_one_cross(
      data, var_principal, var_segmento, s$rp_inst, paleta_p, s = s
    )
    return(list(
      n_total = as.integer(nrow(data)),
      iterado = FALSE,
      cruces = list(c(list(nivel = NA_character_), cruce))
    ))
  }

  # Iteración: split por niveles de iter_var (SO/SM).
  tipo_iter <- .dashboard_tipo_pregunta(iter_var, s$rp_inst, data)
  niveles_iter <- .dashboard_relacion_levels(iter_var, tipo_iter, s$rp_inst, data, s = s)
  if (!length(niveles_iter)) {
    return(list(cruces = list(), n_total = 0L))
  }

  cruces <- lapply(niveles_iter, function(nv) {
    keep <- .dashboard_pertenece_a_nivel(data, iter_var, tipo_iter, nv)
    sub <- data[keep, , drop = FALSE]
    cruce <- .dashboard_relacion_one_cross(
      sub, var_principal, var_segmento, s$rp_inst, paleta_p, s = s
    )
    c(list(nivel = nv$label, nivel_code = nv$code), cruce)
  })

  list(
    n_total = as.integer(nrow(data)),
    iterado = TRUE,
    iter_var = iter_var,
    iter_label = .obtener_label_var(iter_var, s$rp_inst, s$rp_data),
    cruces = cruces
  )
}

# ------------------------------------------------------------
# Descarga Excel — escribe un workbook con una hoja índice (si itera)
# y una hoja por cruce. Devuelve el path del tempfile (.xlsx).
.dashboard_relacion_descargar <- function(s, var_principal, var_segmento,
                                          filtros = list(), iterar = NULL) {
  payload <- .dashboard_relacion_payload(s, var_principal, var_segmento, filtros, iterar)

  wb <- openxlsx::createWorkbook()
  header_style <- openxlsx::createStyle(
    textDecoration = "bold",
    fgFill = "#f1f3f9",
    border = "TopBottom",
    halign = "center"
  )
  num_style <- openxlsx::createStyle(numFmt = "0")
  pct_style <- openxlsx::createStyle(numFmt = "0.0%")

  cruces <- payload$cruces %||% list()

  # Sheet "Índice" si hay iteración.
  if (isTRUE(payload$iterado) && length(cruces) > 1L) {
    openxlsx::addWorksheet(wb, "Índice")
    openxlsx::writeData(wb, "Índice",
                        data.frame(
                          Nivel = sapply(cruces, function(c) as.character(c$nivel %||% "")),
                          N = sapply(cruces, function(c) as.integer(c$n_total %||% 0L)),
                          stringsAsFactors = FALSE
                        ),
                        startRow = 1, startCol = 1)
    openxlsx::addStyle(wb, "Índice", header_style, rows = 1, cols = 1:2, gridExpand = TRUE)
    openxlsx::setColWidths(wb, "Índice", cols = 1:2, widths = c(40, 12))
  }

  for (idx in seq_along(cruces)) {
    cruce <- cruces[[idx]]
    sheet_name <- if (isTRUE(payload$iterado)) {
      nm <- as.character(cruce$nivel %||% paste0("Nivel ", idx))
      nm <- gsub("[/\\\\?*\\[\\]:]", " ", nm)
      substr(paste0(idx, ". ", nm), 1, 31)
    } else {
      "Cruce"
    }
    openxlsx::addWorksheet(wb, sheet_name)

    filas <- cruce$filas %||% list()
    columnas <- cruce$columnas %||% list()
    celdas <- cruce$celdas %||% list()

    # Cabecera.
    header <- c("", sapply(columnas, function(c) as.character(c$label)), "Total")
    openxlsx::writeData(wb, sheet_name, t(header), startRow = 1, startCol = 1, colNames = FALSE)
    openxlsx::addStyle(wb, sheet_name, header_style,
                       rows = 1, cols = seq_along(header), gridExpand = TRUE)

    # Filas: para cada fila, n y pct_col por columna + total fila.
    for (i in seq_along(filas)) {
      row_data <- c(as.character(filas[[i]]$label))
      for (j in seq_along(columnas)) {
        cell <- celdas[[i]][[j]]
        n <- as.integer(cell$n %||% 0L)
        pct <- as.numeric(cell$pct_col %||% 0)
        row_data <- c(row_data, sprintf("%d (%.1f%%)", n, 100 * pct))
      }
      row_data <- c(row_data, sprintf("%d", as.integer(filas[[i]]$n_total %||% 0L)))
      openxlsx::writeData(wb, sheet_name, t(row_data),
                          startRow = i + 1, startCol = 1, colNames = FALSE)
    }

    # Fila Total.
    total_row <- c("Total", sapply(columnas, function(c) sprintf("%d", as.integer(c$n_total %||% 0L))),
                   sprintf("%d", as.integer(cruce$n_total %||% 0L)))
    openxlsx::writeData(wb, sheet_name, t(total_row),
                        startRow = length(filas) + 2, startCol = 1, colNames = FALSE)
    openxlsx::addStyle(wb, sheet_name, header_style,
                       rows = length(filas) + 2,
                       cols = seq_along(total_row),
                       gridExpand = TRUE)

    openxlsx::setColWidths(wb, sheet_name,
                           cols = 1:length(header),
                           widths = c(40, rep(20, length(columnas)), 12))
  }

  if (!length(cruces)) {
    openxlsx::addWorksheet(wb, "Cruce")
    openxlsx::writeData(wb, "Cruce", "Sin datos para cruzar.", startRow = 1, startCol = 1)
  }

  out <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, out, overwrite = TRUE)
  out
}
