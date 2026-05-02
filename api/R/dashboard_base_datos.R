# ============================================================
# Tab "Base de datos" — vista tabular paginada de las respuestas, con
# expansión automática de SM madres a sus dummies, toggle códigos vs
# etiquetas, búsqueda, sort y descarga (CSV/XLSX). Diccionario de
# códigos por variable.
#
# Reusa: .dashboard_resolver_sm_spec, .dashboard_curated_secciones,
# .dashboard_sm_madres, .dashboard_tipo_pregunta. Espejo de
# interactivo_base_datos.R en el legacy.
# ============================================================

# Resuelve catálogo de la lista asociada a una variable SO o SM.
.dashboard_choices_for_var <- function(var, rp_inst) {
  surv <- rp_inst$survey
  ch <- rp_inst$choices
  if (is.null(surv) || is.null(ch)) return(NULL)
  i <- which(!is.na(surv$name) & surv$name == var)[1]
  if (is.na(i)) return(NULL)
  ln <- as.character(surv$list_name[i])
  if (is.na(ln) || !nzchar(ln)) return(NULL)
  ch_v <- ch[ch$list_name == ln, , drop = FALSE]
  if (!nrow(ch_v)) return(NULL)
  label_col <- if ("label" %in% names(ch_v)) "label"
               else grep("^label(::|$)", names(ch_v), value = TRUE)[1]
  if (is.null(label_col) || is.na(label_col)) return(NULL)
  list(
    list_name = ln,
    items = lapply(seq_len(nrow(ch_v)), function(k) {
      list(
        codigo = as.character(ch_v$name[k]),
        etiqueta = as.character(ch_v[[label_col]][k])
      )
    })
  )
}

# Resuelve tipo de medición a partir del survey (mapeo simple).
.dashboard_tipo_medicion <- function(var, rp_inst) {
  surv <- rp_inst$survey
  if (is.null(surv) || !"type" %in% names(surv)) return("NOMINAL")
  i <- which(!is.na(surv$name) & surv$name == var)[1]
  if (is.na(i)) return("NOMINAL")
  type <- as.character(surv$type[i])
  if (grepl("^integer", type) || grepl("^decimal", type)) return("ESCALA")
  if (grepl("^select_multiple", type)) return("NOMINAL")
  if (grepl("^select_one", type)) {
    # Heurística mínima: si la lista tiene labels que parecen una escala
    # (Likert, Muy/Algo/Poco/Nada, etc.) → ORDINAL. Conservador: NOMINAL
    # por defecto. El frontend puede overridear.
    return("NOMINAL")
  }
  "TEXTO"
}

# Estructura: secciones × variables (con dummies si SM madre).
.dashboard_base_datos_estructura <- function(s) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_inst) || is.null(s$rp_data)) {
    return(list(secciones = list()))
  }
  secciones <- .dashboard_visible_secciones(s)
  sm_madres <- .dashboard_sm_madres(s$rp_inst)

  out <- lapply(names(secciones), function(sec_id) {
    vars <- secciones[[sec_id]]
    label_sec <- .dashboard_label_seccion(sec_id, s$rp_inst) %||% sec_id
    variables <- lapply(vars, function(v) {
      tipo <- .dashboard_tipo_pregunta(v, s$rp_inst, s$rp_data)
      label <- .dashboard_var_label_override(s, v) %||% .obtener_label_var(v, s$rp_inst, s$rp_data)
      base <- list(
        name = v,
        label = label,
        tipo = tipo
      )
      if (identical(tipo, "sm")) {
        spec <- .dashboard_resolver_sm_spec(v, s$rp_inst, s$rp_data, s = s)
        base$dummies <- lapply(spec$cols, function(col) {
          code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(v, "."))),
                      "", col)
          code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(v, "/"))),
                      "", code)
          opt_label <- as.character(spec$map_code_to_label[[code]] %||% code)
          list(
            name = col,
            label = paste0(label, " — ", opt_label),
            opt_code = code,
            opt_label = opt_label
          )
        })
      }
      base
    })
    list(
      id = sec_id,
      label = label_sec,
      variables = variables
    )
  })
  list(secciones = out)
}

# Resuelve el label de una sección (usa rp_inst si tiene metadatos).
.dashboard_label_seccion <- function(sec_id, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || !"name" %in% names(sv)) return(sec_id)
  label_col <- if ("label" %in% names(sv)) "label"
               else grep("^label(::|$)", names(sv), value = TRUE)[1]
  if (is.null(label_col) || is.na(label_col)) return(sec_id)
  i <- which(sv$name == sec_id & grepl("^begin", as.character(sv$type %||% "")))[1]
  if (is.na(i)) return(sec_id)
  lbl <- as.character(sv[[label_col]][i])
  if (is.na(lbl) || !nzchar(lbl)) sec_id else lbl
}

# Expande las "variables" pedidas a columnas reales del data frame.
# - SO: la columna directa.
# - SM madre: las dummies hijas.
.dashboard_base_datos_expand_cols <- function(s, variables) {
  cols <- character(0)
  labels <- character(0)
  for (v in variables) {
    tipo <- .dashboard_tipo_pregunta(v, s$rp_inst, s$rp_data)
    base_label <- .obtener_label_var(v, s$rp_inst, s$rp_data)
    if (identical(tipo, "sm")) {
      spec <- .dashboard_resolver_sm_spec(v, s$rp_inst, s$rp_data, s = s)
      for (col in spec$cols) {
        code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(v, "."))),
                    "", col)
        code <- sub(paste0("^", gsub("([\\W])", "\\\\\\1", paste0(v, "/"))),
                    "", code)
        opt_lbl <- as.character(spec$map_code_to_label[[code]] %||% code)
        cols <- c(cols, col)
        labels <- c(labels, paste0(base_label, " — ", opt_lbl))
      }
    } else if (v %in% names(s$rp_data)) {
      cols <- c(cols, v)
      labels <- c(labels, base_label)
    }
  }
  list(cols = cols, labels = labels)
}

# Mapea el valor de una celda a su etiqueta (modo "etiquetas").
# Para SO usa choices; para SM dummy convierte 1/0 a "Sí"/"No".
.dashboard_cell_to_label <- function(value, var, rp_inst) {
  if (is.na(value) || (is.character(value) && !nzchar(value))) return(NA_character_)
  is_dummy <- grepl("\\.[A-Za-z0-9_\\-]+$|/[A-Za-z0-9_\\-]+$", var)
  if (is_dummy) {
    x <- suppressWarnings(as.numeric(as.character(value)))
    if (!is.na(x) && x == 1) return("Sí")
    if (!is.na(x) && x == 0) return("No")
    return(as.character(value))
  }
  ch <- .dashboard_choices_for_var(var, rp_inst)
  if (is.null(ch)) return(as.character(value))
  hit <- Filter(function(it) identical(as.character(it$codigo), as.character(value)),
                ch$items)
  if (length(hit)) return(as.character(hit[[1]]$etiqueta))
  as.character(value)
}

# Data paginada. Devuelve {rows, columnas:[{key,label}], total}.
.dashboard_base_datos_data <- function(s, modo = "codigos", variables = list(),
                                       page = 1L, page_size = 25L,
                                       search = NULL, sort = NULL) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    return(list(rows = list(), columnas = list(), total = 0L))
  }
  variables <- as.character(unlist(variables))
  variables <- variables[vapply(variables, function(v) .dashboard_var_enabled(s, v), logical(1))]
  if (!length(variables)) {
    return(list(rows = list(), columnas = list(), total = 0L))
  }

  spec <- .dashboard_base_datos_expand_cols(s, variables)
  cols <- spec$cols
  labels <- spec$labels
  if (!length(cols)) {
    return(list(rows = list(), columnas = list(), total = 0L))
  }

  df <- s$rp_data[, cols, drop = FALSE]

  # Conversión modo "etiquetas".
  if (identical(modo, "etiquetas")) {
    for (k in seq_along(cols)) {
      colname <- cols[k]
      df[[colname]] <- vapply(
        df[[colname]],
        function(v) .dashboard_cell_to_label(v, colname, s$rp_inst),
        character(1)
      )
    }
  } else {
    for (k in seq_along(cols)) {
      df[[cols[k]]] <- as.character(df[[cols[k]]])
    }
  }

  # Búsqueda full-text (case-insensitive, sobre todas las columnas).
  if (is.character(search) && nzchar(search)) {
    needle <- tolower(trimws(search))
    keep <- rep(FALSE, nrow(df))
    for (k in seq_along(cols)) {
      v <- as.character(df[[cols[k]]])
      keep <- keep | grepl(needle, tolower(v), fixed = TRUE)
    }
    df <- df[keep, , drop = FALSE]
  }

  # Sort (sort = list(col, desc)).
  if (is.list(sort) && !is.null(sort$col) && nzchar(as.character(sort$col)) &&
      sort$col %in% names(df)) {
    desc <- isTRUE(sort$desc)
    ord <- order(df[[sort$col]], decreasing = desc, na.last = TRUE)
    df <- df[ord, , drop = FALSE]
  }

  total <- nrow(df)
  page <- max(1L, as.integer(page %||% 1L))
  page_size <- max(1L, min(200L, as.integer(page_size %||% 25L)))
  start <- (page - 1L) * page_size + 1L
  end <- min(total, start + page_size - 1L)
  if (start > total) {
    rows <- list()
  } else {
    sliced <- df[start:end, , drop = FALSE]
    rows <- lapply(seq_len(nrow(sliced)), function(i) {
      as.list(sliced[i, , drop = FALSE])
    })
  }

  columnas <- lapply(seq_along(cols), function(k) {
    list(key = cols[k], label = labels[k])
  })

  list(
    rows = rows,
    columnas = columnas,
    total = as.integer(total)
  )
}

# Descarga: CSV o XLSX. Devuelve path del tempfile.
.dashboard_base_datos_descargar <- function(s, modo = "codigos", variables = list(),
                                            formato = "xlsx") {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_data) || is.null(s$rp_inst)) {
    out <- tempfile(fileext = ".csv")
    utils::write.csv(data.frame(error = "Sin data"), out, row.names = FALSE)
    return(list(path = out, formato = "csv"))
  }
  variables <- as.character(unlist(variables))
  spec <- .dashboard_base_datos_expand_cols(s, variables)
  cols <- spec$cols
  labels <- spec$labels
  if (!length(cols)) {
    out <- tempfile(fileext = ".csv")
    utils::write.csv(data.frame(), out, row.names = FALSE)
    return(list(path = out, formato = "csv"))
  }

  df <- s$rp_data[, cols, drop = FALSE]
  if (identical(modo, "etiquetas")) {
    for (k in seq_along(cols)) {
      colname <- cols[k]
      df[[colname]] <- vapply(
        df[[colname]],
        function(v) .dashboard_cell_to_label(v, colname, s$rp_inst),
        character(1)
      )
    }
  }
  names(df) <- labels

  formato <- tolower(as.character(formato %||% "xlsx"))
  if (identical(formato, "csv")) {
    out <- tempfile(fileext = ".csv")
    utils::write.csv(df, out, row.names = FALSE, fileEncoding = "UTF-8")
    list(path = out, formato = "csv")
  } else {
    out <- tempfile(fileext = ".xlsx")
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "Base de datos")
    openxlsx::writeData(wb, "Base de datos", df, startRow = 1, startCol = 1)
    header_style <- openxlsx::createStyle(
      textDecoration = "bold",
      fgFill = "#f1f3f9",
      border = "TopBottom"
    )
    openxlsx::addStyle(wb, "Base de datos", header_style,
                       rows = 1, cols = seq_len(ncol(df)), gridExpand = TRUE)
    openxlsx::setColWidths(wb, "Base de datos", cols = seq_len(ncol(df)), widths = "auto")
    openxlsx::saveWorkbook(wb, out, overwrite = TRUE)
    list(path = out, formato = "xlsx")
  }
}

# Diccionario de una variable: opciones código→etiqueta + tipo medición.
.dashboard_base_datos_diccionario <- function(s, variable) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_inst) || !nzchar(variable)) {
    return(list(variable = variable, etiqueta = "", tipo = "", tipo_medicion = "",
                opciones = list()))
  }
  tipo <- .dashboard_tipo_pregunta(variable, s$rp_inst, s$rp_data)
  ch <- .dashboard_choices_for_var(variable, s$rp_inst)
  list(
    variable = variable,
    etiqueta = .obtener_label_var(variable, s$rp_inst, s$rp_data),
    tipo = tipo,
    tipo_medicion = .dashboard_tipo_medicion(variable, s$rp_inst),
    opciones = if (is.null(ch)) list() else ch$items
  )
}
