# Publicación de acreditación: construcción de las hojas del libro.
#
# Por qué existe. `monitoreo_engine.R` está congelado a crecimiento
# (`agentic/manifest.json`) y es, con casi 40.000 líneas, el archivo que más
# eleva el radio de regresión de todo el repo. La regla de la casa para
# saldarlo es la extracción en caliente: cada cambio que lo toque se lleva el
# tema tocado a `monitoreo_<tema>.R`. Estas 37 funciones comparten el prefijo
# `.monitoreo_publication_accreditation_*`, vivían contiguas y son un solo
# tema, así que se mudan enteras.
#
# Qué vive aquí: la capa que convierte los reportes de acreditación en las
# hojas del libro que se publica. Tres familias:
#
#   1. Presentación de valores y fechas (`_present_values`, `_normalize_dates`,
#      `_present_df`, y las etiquetas `_pct_label`, `_int_label`,
#      `_datetime_label`): cómo se ve un dato en la hoja publicada, que no es
#      cómo se ve en la app.
#   2. Armado de filas por sección (`_block_rows`, `_sources_rows`,
#      `_survey_rows`, `_detail_rows`, `_client_report_rows`…): cada función
#      produce el data.frame de una hoja.
#   3. Avance por actor (`_actor_advance_*`): el orden, el estado y las
#      pestañas del corte por actor.
#
# Qué NO vive aquí: la decisión de a qué hoja de cálculo va el libro, el canje
# de credenciales y la confirmación de audiencia. Eso es del router
# (`monitoreo_router_publicacion.R`). La frontera es esa —aquí se arma el
# contenido; allá se decide dónde y con permiso de quién se escribe—.
#
# La extracción es un movimiento literal: ninguna función cambió de cuerpo. El
# paquete no declara `Collate`, así que la colación sigue siendo alfabética y
# estas definiciones quedan disponibles igual que antes.

.monitoreo_publication_accreditation_present_values <- function(df) {
  df <- .monitoreo_workbook_df(df)
  if (!nrow(df) && !ncol(df)) return(df)
  replacements <- c(
    "No disponible" = "Sin dato",
    "No registrado" = "Sin registro",
    "No registrada" = "Sin registro",
    "Sin umbral configurado" = "Sin mínimo configurado",
    "Efectivas" = "Completas",
    "Meta alcanzada" = "Mínimo completo",
    "Mínimo alcanzado" = "Mínimo completo",
    "Sobre el mínimo" = "Por encima del mínimo",
    "Cerca del mínimo" = "Cerca de completar",
    "Bajo mínimo" = "Falta avance",
    "En campo" = "En seguimiento",
    "Pendientes universo" = "Pendientes por cubrir",
    "Brecha contra mínimo" = "Faltan para mínimo",
    "% sobre mínimo" = "% mínimo logrado",
    "% sobre universo" = "% universo logrado",
    "% avance universo" = "% avance",
    "% cobertura" = "% avance",
    "Filas internas de seguimiento" = "Filas de seguimiento",
    "Referencia operativa total" = "Mínimo esperado",
    "% umbral interno" = "% mínimo logrado",
    "Campos técnicos crudos" = "Campos del registro",
    "Actor faltante" = "Actor sin asignar",
    "Fecha faltante" = "Fecha sin registro",
    "Baja cobertura" = "Avance bajo",
    "Actor por debajo del mínimo interno." = "Actor por debajo del mínimo esperado.",
    "Avance de campo" = "Avance del corte",
    "Encuestadores y rutas" = "Responsables y fuentes",
    "Validacion de tiempos" = "Validación del registro",
    "Validación de tiempos" = "Validación del registro",
    "Enumerador" = "Responsable de carga",
    "Fecha de encuesta" = "Fecha de respuesta",
    "Estado del caso" = "Estado de respuesta",
    "Duracion" = "Duración",
    "config" = "Configuración",
    "email" = "Correo electrónico",
    "weblink" = "Enlace web",
    "web link" = "Enlace web",
    "phone" = "Telefónico",
    "telephone" = "Telefónico"
  )
  for (col in names(df)) {
    if (!is.character(df[[col]]) && !is.factor(df[[col]])) next
    values <- as.character(df[[col]])
    replace_idx <- match(values, names(replacements))
    values[!is.na(replace_idx)] <- unname(replacements[replace_idx[!is.na(replace_idx)]])
    df[[col]] <- values
  }
  df
}

.monitoreo_publication_accreditation_normalize_dates <- function(df) {
  df <- .monitoreo_workbook_df(df)
  if (!nrow(df) && !ncol(df)) return(df)
  date_cols <- grep(
    "fecha|registro|efectiva|actualizaci[oó]n|corte publicado|corte de datos",
    names(df),
    ignore.case = TRUE
  )
  for (col in date_cols) {
    raw <- trimws(as.character(df[[col]] %||% ""))
    raw[is.na(raw)] <- ""
    parsed <- suppressWarnings(.monitoreo_parse_time_vec(raw))
    has_date <- !is.na(parsed)
    if (any(has_date)) raw[has_date] <- as.character(as.Date(parsed[has_date]))
    df[[col]] <- raw
  }
  df
}

.monitoreo_publication_accreditation_present_df <- function(df, audience = "client", purpose = "") {
  df <- .monitoreo_workbook_df(df)
  if (!nrow(df) && !ncol(df)) return(df)
  audience <- .monitoreo_workbook_audience(audience)
  purpose <- .monitoreo_text_key(purpose)
  if (all(c("% avance universo", "% cobertura") %in% names(df))) {
    df <- df[, setdiff(names(df), "% cobertura"), drop = FALSE]
  }
  if (identical(audience, "client")) {
    noisy <- grep(
      "session|spreadsheet|warning|warnings|campo detectado|columna detectada|seccion|sección|origen tecnico|origen técnico|schema|source_id|^\\.|^_",
      names(df),
      ignore.case = TRUE
    )
    if (length(noisy) && purpose %in% c("fuentes_actualizacion", "sources", "corte_y_fuentes")) {
      df <- df[, -noisy, drop = FALSE]
    }
  }
  names_map <- c(
    "Mínimo/meta operativa" = "Mínimo esperado",
    "Referencia operativa" = "Mínimo esperado",
    "% sobre mínimo" = "% mínimo logrado",
    "% sobre mínimo acumulado" = "% mínimo acumulado",
    "% umbral interno" = "% mínimo logrado",
    "% umbral interno acumulado" = "% mínimo acumulado",
    "Brecha contra mínimo" = "Faltan para mínimo",
    "Brecha umbral interno" = "Faltan para mínimo",
    "Estado interno" = "Estado del mínimo",
    "Estado umbral interno" = "Estado del mínimo",
    "% avance universo" = "% avance",
    "% avance universo acumulado" = "% avance acumulado",
    "% sobre universo" = "% universo logrado",
    "Efectivas" = "Completas",
    "Nuevas efectivas" = "Completas del día",
    "Efectivas acumuladas" = "Completas acumuladas",
    "Último aumento" = "Último avance",
    "Rechazos plataforma" = "Rechazo",
    "Rechazos" = "Rechazo",
    "Sin respuesta plataforma" = "Sin respuesta",
    "Total respuestas" = "Respuestas registradas",
    "Primer día" = "Primer registro",
    "Última respuesta" = "Último registro",
    "Última efectiva" = "Última completa",
    "Canal" = "Canal operativo",
    "Fuente" = "Título / fuente",
    "Recopilador" = "Responsable de carga",
    "Collector" = "Responsable de carga",
    "Tipo recopilador" = "Tipo de responsable",
    "Pendientes universo" = "Pendientes por cubrir",
    "Filas internas de seguimiento" = "Filas de seguimiento",
    "Base técnica" = "Registros del corte",
    "Auditoría técnica" = "Trazabilidad del corte",
    "Seccion" = "Sección",
    "Fecha/hora de publicación" = "Corte publicado",
    "Tipo registro" = "Tipo de información",
    "Campo detectado" = "Campo usado"
  )
  if (identical(audience, "internal") && purpose %in% c("control_seguimiento", "seguimiento_operativo")) {
    names_map <- names_map[!names(names_map) %in% c("Rechazos plataforma", "Sin respuesta plataforma")]
  }
  mapped <- unname(names_map[names(df)])
  names(df)[!is.na(mapped) & nzchar(mapped)] <- mapped[!is.na(mapped) & nzchar(mapped)]
  if (purpose %in% c("alertas_internas", "casos_accionables", "auditoria_tecnica")) {
    alert_map <- c(
      "Prioridad" = "Nivel",
      "Tipo de alerta" = "Motivo",
      "ID caso" = "Caso",
      "Descripción" = "Detalle",
      "Fuente" = if (identical(purpose, "auditoria_tecnica")) "Origen de alerta" else "Origen"
    )
    mapped_alert <- unname(alert_map[names(df)])
    names(df)[!is.na(mapped_alert) & nzchar(mapped_alert)] <- mapped_alert[!is.na(mapped_alert) & nzchar(mapped_alert)]
  }
  if (purpose %in% c("base_tecnica", "registros")) {
    base_map <- c(
      "response_id" = "ID registro",
      "_id" = "ID registro",
      "_uuid" = "UUID",
      "uuid" = "UUID",
      "nombre_contacto" = "Nombre",
      "correo_contacto" = "Correo",
      "telefono_contacto" = "Teléfono",
      "dim_actor" = "Actor",
      "carrera" = "Segmento",
      "fecha" = "Fecha",
      "status" = "Estado",
      "efectiva" = "Respondió",
      ".source_id" = "ID fuente",
      ".source_role" = "Rol fuente",
      ".source_label" = "Fuente"
    )
    mapped_base <- unname(base_map[names(df)])
    names(df)[!is.na(mapped_base) & nzchar(mapped_base)] <- mapped_base[!is.na(mapped_base) & nzchar(mapped_base)]
  }
  if (any(duplicated(names(df)))) {
    duplicate_names <- unique(names(df)[duplicated(names(df))])
    drop <- logical(ncol(df))
    for (nm in duplicate_names) {
      idx <- which(names(df) == nm)
      first <- idx[[1]]
      for (candidate in idx[-1]) {
        same_values <- identical(as.character(df[[first]]), as.character(df[[candidate]]))
        empty_values <- !any(nzchar(trimws(as.character(df[[candidate]]))), na.rm = TRUE)
        if (isTRUE(same_values) || isTRUE(empty_values)) drop[[candidate]] <- TRUE
      }
    }
    if (any(drop)) df <- df[, !drop, drop = FALSE]
    names(df) <- make.unique(names(df), sep = " ")
  }
  df <- .monitoreo_publication_accreditation_present_values(df)
  df <- .monitoreo_publication_accreditation_normalize_dates(df)
  if (purpose %in% c("summary", "resumen_ejecutivo", "resumen_operativo") && "Indicador" %in% names(df)) {
    indicator <- trimws(as.character(df$Indicador %||% ""))
    keep <- !duplicated(indicator)
    keep[!nzchar(indicator)] <- TRUE
    df <- df[keep, , drop = FALSE]
  }
  keep_empty_columns <- character()
  if (purpose %in% c("avance_por_canal_recopilador", "avance_por_canal_fuente", "channel")) {
    keep_empty_columns <- c(
      keep_empty_columns,
      "Canal operativo",
      "Responsable de carga",
      "Tipo de responsable"
    )
  }
  if (purpose %in% c("metas_internas_actor", "pendientes_por_actor", "targets", "pending", "avance_general", "avance_por_actor", "actor", "avance_diario", "daily", "avance_por_segmento", "segment")) {
    keep_empty_columns <- c(
      keep_empty_columns,
      "Mínimo esperado",
      "Faltan para mínimo",
      "% mínimo logrado",
      "Estado del mínimo"
    )
  }
  if (purpose %in% c("control_seguimiento", "seguimiento_operativo")) {
    keep_empty_columns <- c(keep_empty_columns, "Brecha mínimo")
    if (!"Brecha mínimo" %in% names(df)) {
      minimum_gap <- rep("", nrow(df))
      gap_col <- intersect(c("Faltan para mínimo", "Brecha contra mínimo"), names(df))
      if (length(gap_col)) {
        minimum_gap <- as.character(df[[gap_col[[1]]]])
      } else {
        minimum_col <- intersect(c("Mínimo esperado", "Mínimo", "Minimo", "Referencia operativa"), names(df))
        complete_col <- intersect(c("Completas", "Efectivas"), names(df))
        if (length(minimum_col) && length(complete_col)) {
          parse_number <- function(values) {
            suppressWarnings(as.numeric(gsub("%", "", gsub("[[:space:]]", "", gsub(",", ".", as.character(values))))))
          }
          minimum <- parse_number(df[[minimum_col[[1]]]])
          complete <- parse_number(df[[complete_col[[1]]]])
          gap <- pmax(minimum - complete, 0)
          gap[!is.finite(minimum) | !is.finite(complete)] <- NA_real_
          minimum_gap <- ifelse(is.na(gap), "", as.character(gap))
        }
      }
      df[["Brecha mínimo"]] <- minimum_gap
    }
  }
  df <- .monitoreo_publication_drop_empty_columns(df, keep = keep_empty_columns)
  if (purpose %in% c("avance_por_canal_recopilador", "avance_por_canal_fuente", "channel")) {
    df <- .monitoreo_publication_cols_first(df, c("Actor", "Canal operativo", "Título / fuente", "Responsable de carga", "Tipo de responsable", "Completas", "Parciales", "Rechazos", "Sin respuesta", "Respuestas registradas", "Primer registro", "Último registro", "Última completa"))
  } else if (purpose %in% c("control_seguimiento", "seguimiento_operativo")) {
    df <- .monitoreo_publication_cols_first(df, c("Actor", "Unidad", "Universo", "Mínimo esperado", "Mínimo", "Completas", "Parciales", "Rechazo", "Rechazos plataforma", "Rechazos telefónicos", "Sin respuesta", "Brecha mínimo", "% avance", "Avance total", "Estado"))
  } else if (purpose %in% c("metas_internas_actor", "pendientes_por_actor", "targets", "pending")) {
    df <- .monitoreo_publication_cols_first(df, c("Actor", "Universo", "Mínimo esperado", "Completas", "Pendientes", "Faltan para mínimo", "% mínimo logrado", "% universo logrado", "Último avance", "Estado del mínimo"))
  } else if (purpose %in% c("avance_por_actor", "actor")) {
    df <- .monitoreo_publication_cols_first(df, c("Actor", "Universo", "Completas", "Parciales", "Rechazo", "Sin respuesta", "% avance", "Mínimo esperado", "% mínimo logrado", "Faltan para mínimo", "Último avance", "Estado de avance", "Estado del mínimo"))
  } else if (purpose %in% c("avance_diario", "daily")) {
    df <- .monitoreo_publication_cols_first(df, c("Fecha", "Actor", "Completas del día", "Completas acumuladas", "Universo", "Sin respuesta", "Pendientes", "% avance acumulado", "Mínimo esperado", "% mínimo acumulado", "Faltan para mínimo", "Estado de avance"))
  } else if (purpose %in% c("avance_por_segmento", "segment")) {
    df <- .monitoreo_publication_cols_first(df, c("Segmento", "Actor", "Universo", "Completas", "Pendientes", "% avance", "Mínimo esperado", "% mínimo logrado", "Faltan para mínimo", "Estado de avance", "Estado del mínimo"))
  }
  rownames(df) <- NULL
  df
}

.monitoreo_publication_accreditation_section_table <- function(title, df, audience = "client", purpose = "") {
  .monitoreo_sheets_section_table(
    title,
    .monitoreo_publication_accreditation_present_df(df, audience = audience, purpose = purpose)
  )
}

.monitoreo_publication_accreditation_block_rows <- function(title, df, audience = "client", purpose = "") {
  df <- .monitoreo_workbook_df(df)
  if (!nrow(df) || !"Bloque" %in% names(df)) {
    return(.monitoreo_publication_accreditation_section_table(title, df, audience, purpose))
  }
  blocks <- unique(trimws(as.character(df$Bloque %||% "")))
  blocks <- blocks[nzchar(blocks)]
  if (!length(blocks)) return(.monitoreo_publication_accreditation_section_table(title, df, audience, purpose))
  rows <- list()
  for (block in blocks) {
    part <- .monitoreo_publication_block_df(df, block)
    rows <- c(rows, .monitoreo_publication_accreditation_section_table(block, part, audience, purpose))
  }
  rows
}

.monitoreo_publication_accreditation_sources_rows <- function(df, audience = "client") {
  df <- .monitoreo_workbook_df(df)
  audience <- .monitoreo_workbook_audience(audience)
  if (!nrow(df)) {
    return(.monitoreo_publication_accreditation_section_table("Corte y fuentes", df, audience, "fuentes_actualizacion"))
  }
  has_text <- function(col) {
    if (!col %in% names(df)) return(rep(FALSE, nrow(df)))
    values <- trimws(as.character(df[[col]]))
    values[is.na(values)] <- ""
    nzchar(values)
  }
  tipo <- if ("Tipo" %in% names(df)) trimws(as.character(df$Tipo)) else rep("", nrow(df))
  tipo[is.na(tipo)] <- ""
  source_like <- tipo %in% c("Fuente", "Corte") | has_text("Fuente de datos") | has_text("Registros procesados")
  channel_like <- has_text("Actor") | has_text("Canal")
  field_like <- !source_like & !channel_like
  rows <- list()
  sources <- df[source_like, , drop = FALSE]
  if (nrow(sources)) {
    sources <- sources[, intersect(c(
      "Tipo", "Fuente de datos", "Rol", "Conector", "Fecha/hora de publicación",
      "Última actualización", "Ultima actualización", "Registros procesados", "Registros excluidos"
    ), names(sources)), drop = FALSE]
    rows <- c(rows, .monitoreo_publication_accreditation_section_table("Fuentes del corte", sources, audience, "fuentes_actualizacion"))
  }
  if (identical(audience, "internal")) {
    fields <- df[field_like, , drop = FALSE]
    if (nrow(fields)) {
      fields <- fields[, intersect(c(
        "Seccion", "Sección", "Concepto", "Campo", "Campo detectado",
        "Etiqueta publicación", "Origen", "Estado", "Familia de monitoreo",
        "Audiencia", "Sección UI / componente", "Dato o cálculo existente",
        "Sección publicada", "Campos faltantes tolerados"
      ), names(fields)), drop = FALSE]
      rows <- c(rows, .monitoreo_publication_accreditation_section_table("Campos usados para el corte", fields, audience, "fuentes_actualizacion"))
    }
  }
  if (!length(rows)) {
    rows <- .monitoreo_publication_accreditation_section_table("Corte y fuentes", df, audience, "fuentes_actualizacion")
  }
  rows
}

.monitoreo_publication_accreditation_cover_value <- function(model, field, default = "") {
  cover <- .monitoreo_publication_section_frame(model, "portada")
  if (!nrow(cover) || !all(c("Campo", "Valor") %in% names(cover))) return(default)
  keys <- .monitoreo_text_key(cover$Campo)
  idx <- match(.monitoreo_text_key(field), keys, nomatch = 0L)
  if (!idx) return(default)
  value <- .monitoreo_workbook_cell_value(cover$Valor[[idx]])
  if (nzchar(trimws(value))) value else default
}

.monitoreo_publication_accreditation_num <- function(value, default = 0) {
  raw <- gsub("%", "", gsub(",", ".", .monitoreo_workbook_cell_value(value)), fixed = TRUE)
  out <- suppressWarnings(as.numeric(raw))
  if (length(out) && is.finite(out[[1]])) out[[1]] else default
}

.monitoreo_publication_accreditation_pct_label <- function(num, den, digits = 0L) {
  num <- suppressWarnings(as.numeric(num))
  den <- suppressWarnings(as.numeric(den))
  if (!is.finite(num) || !is.finite(den) || den <= 0) return("S/D")
  sprintf(paste0("%.", max(0L, .monitoreo_int(digits, 0L)), "f%%"), 100 * num / den)
}

.monitoreo_publication_accreditation_int_label <- function(value) {
  value <- suppressWarnings(as.numeric(value))
  if (!length(value) || !is.finite(value[[1]])) return("")
  format(as.integer(round(value[[1]])), big.mark = ",", scientific = FALSE, trim = TRUE)
}

.monitoreo_publication_accreditation_datetime_label <- function(value, default = "") {
  raw <- trimws(as.character(value %||% ""))
  raw[is.na(raw)] <- ""
  raw <- raw[nzchar(raw)]
  if (!length(raw)) return(default)
  parsed <- suppressWarnings(.monitoreo_parse_time_vec(raw[[1]]))
  if (length(parsed) && !is.na(parsed[[1]])) {
    date <- .monitoreo_format_date_label_vec(parsed[1], raw[[1]])[[1]]
    time <- .monitoreo_format_time_label_vec(parsed[1], raw[[1]])[[1]]
    if (nzchar(time)) return(trimws(paste(date, time, sep = " · ")))
    if (nzchar(date)) return(date)
  }
  .monitoreo_publication_date_label_scalar(raw[[1]], default = raw[[1]])
}

.monitoreo_publication_accreditation_datetime_stamp <- function(value, default = "") {
  raw <- trimws(as.character(value %||% ""))
  raw[is.na(raw)] <- ""
  raw <- raw[nzchar(raw)]
  if (!length(raw)) return(default)
  parsed <- suppressWarnings(.monitoreo_parse_time_vec(raw[[1]]))
  if (length(parsed) && !is.na(parsed[[1]])) {
    tz <- .monitoreo_datetime_display_tz(raw[[1]])[[1]]
    return(format(parsed[[1]], "%d/%m/%Y %H:%M", tz = tz, usetz = FALSE))
  }
  default_value <- .monitoreo_workbook_cell_value(default)
  if (nzchar(default_value)) default_value else raw[[1]]
}

.monitoreo_publication_accreditation_date_order <- function(values) {
  values <- as.character(values %||% character())
  parsed <- suppressWarnings(as.Date(values))
  order(is.na(parsed), parsed, values, na.last = TRUE)
}

.monitoreo_publication_accreditation_wide_date_cols <- function(df) {
  cols <- .monitoreo_client_report_date_cols(df)
  cols[grepl("^\\d{4}-\\d{2}-\\d{2}$|^\\d{1,2}/\\d{1,2}/\\d{4}$|^Sin fecha$", cols)]
}

.monitoreo_publication_accreditation_actor_summary_df <- function(actor_df) {
  actor_df <- .monitoreo_workbook_df(actor_df)
  if (!nrow(actor_df) || !"Actor" %in% names(actor_df)) {
    return(data.frame(
      Actor = "Sin actores",
      Universo = 0L,
      Completas = 0L,
      Parciales = 0L,
      Rechazos = 0L,
      `Sin respuesta` = 0L,
      `% avance` = "S/D",
      `Último avance` = "",
      Estado = "Sin avance",
      check.names = FALSE,
      stringsAsFactors = FALSE
    ))
  }
  rows <- lapply(seq_len(nrow(actor_df)), function(idx) {
    row <- as.list(actor_df[idx, , drop = FALSE])
    actor <- .monitoreo_publication_row_chr(row, c("Actor", "Unidad"), "Sin actor")
    universe <- .monitoreo_publication_row_num(row, c("Universo", "Total"), NA_real_)
    complete <- .monitoreo_publication_row_num(row, c("Efectivas", "Completas"), 0)
    partial <- .monitoreo_publication_row_num(row, c("Parciales"), 0)
    refusal <- .monitoreo_publication_platform_refusal_value(row, 0)
    no_response <- .monitoreo_publication_row_num(row, c("Sin respuesta", "Pendientes"), NA_real_)
    if (!is.finite(no_response) && is.finite(universe)) {
      no_response <- max(0, universe - complete - partial - refusal)
    }
    status <- if (is.finite(universe) && universe > 0 && complete >= universe) {
      "Completo"
    } else if (is.finite(no_response) && no_response <= 0 && (complete > 0 || partial > 0 || refusal > 0)) {
      "Avanzado"
    } else if (complete > 0 || partial > 0 || refusal > 0) {
      "En avance"
    } else {
      "Sin avance"
    }
    source_status <- .monitoreo_publication_row_chr(row, c("Estado de avance", "Estado"), "")
    if (nzchar(source_status)) status <- source_status
    if (is.finite(no_response) && no_response <= 0 && (complete > 0 || partial > 0 || refusal > 0) &&
        (!is.finite(universe) || complete < universe)) {
      status <- "Avanzado"
    }
    data.frame(
      Actor = actor,
      Universo = if (is.finite(universe)) as.integer(universe) else NA_integer_,
      Completas = as.integer(complete),
      Parciales = as.integer(partial),
      Rechazos = as.integer(refusal),
      `Sin respuesta` = if (is.finite(no_response)) as.integer(no_response) else NA_integer_,
      `% avance` = .monitoreo_publication_accreditation_pct_label(complete, universe, digits = 0L),
      `Último avance` = .monitoreo_publication_row_chr(row, c("Último avance", "Ultimo avance", "Última completa", "Ultima completa"), ""),
      Estado = status,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  rownames(out) <- NULL
  out
}

.monitoreo_publication_accreditation_progress_summary <- function(daily_df, actor_summary, updated = "") {
  daily_df <- .monitoreo_workbook_df(daily_df)
  actor_summary <- .monitoreo_workbook_df(actor_summary)
  daily_status <- daily_df
  if (nrow(daily_status) && "Bloque" %in% names(daily_status)) {
    general <- daily_status[as.character(daily_status$Bloque) == "General", , drop = FALSE]
    if (nrow(general)) daily_status <- general
  }
  dates <- if (nrow(daily_status) && "Fecha" %in% names(daily_status)) unique(as.character(daily_status$Fecha %||% "")) else character()
  dates <- dates[nzchar(dates) & !is.na(dates)]
  dates <- dates[.monitoreo_publication_accreditation_date_order(dates)]
  last_date <- if (length(dates)) dates[[length(dates)]] else ""
  new_last_day <- 0L
  if (nrow(daily_status) && nzchar(last_date) && "Fecha" %in% names(daily_status)) {
    idx <- as.character(daily_status$Fecha %||% "") == last_date
    if ("Nuevas efectivas" %in% names(daily_status)) {
      new_last_day <- sum(suppressWarnings(as.numeric(daily_status$`Nuevas efectivas`[idx])), na.rm = TRUE)
    } else if ("Efectivas" %in% names(daily_status)) {
      new_last_day <- sum(suppressWarnings(as.numeric(daily_status$Efectivas[idx])), na.rm = TRUE)
    }
  }
  num_col <- function(name) {
    if (!nrow(actor_summary) || !name %in% names(actor_summary)) return(numeric(0))
    suppressWarnings(as.numeric(actor_summary[[name]]))
  }
  total_universe <- sum(num_col("Universo"), na.rm = TRUE)
  total_complete <- sum(num_col("Completas"), na.rm = TRUE)
  total_partial <- sum(num_col("Parciales"), na.rm = TRUE)
  total_refusal <- sum(num_col("Rechazos"), na.rm = TRUE)
  total_pending <- sum(num_col("Sin respuesta"), na.rm = TRUE)
  status <- if (total_universe > 0 && total_complete >= total_universe) {
    "Completo"
  } else if (is.finite(total_pending) && total_pending <= 0 && (total_complete > 0 || total_partial > 0 || total_refusal > 0)) {
    "Avanzado"
  } else if (total_complete > 0 || total_partial > 0 || total_refusal > 0) {
    "En avance"
  } else {
    "Sin avance"
  }
  list(
    total_universe = total_universe,
    total_complete = total_complete,
    total_partial = total_partial,
    total_refusal = total_refusal,
    total_pending = total_pending,
    pct_label = .monitoreo_publication_accreditation_pct_label(total_complete, total_universe, digits = 0L),
    new_last_day = new_last_day,
    last_date = last_date,
    last_date_label = .monitoreo_publication_date_label_scalar(last_date, default = last_date),
    updated = .monitoreo_workbook_cell_value(updated),
    updated_label = .monitoreo_publication_accreditation_datetime_label(updated, default = .monitoreo_workbook_cell_value(updated)),
    status = status
  )
}

.monitoreo_publication_accreditation_summary_cards_df <- function(progress) {
  data.frame(
    Indicador = c(
      "Universo total", "Completas", "Parciales",
      "Rechazos", "Sin respuesta", "% avance",
      "Nuevas último día", "Última fecha con avance", "Actualización"
    ),
    n = c(
      .monitoreo_publication_accreditation_int_label(progress$total_universe),
      .monitoreo_publication_accreditation_int_label(progress$total_complete),
      .monitoreo_publication_accreditation_int_label(progress$total_partial),
      .monitoreo_publication_accreditation_int_label(progress$total_refusal),
      .monitoreo_publication_accreditation_int_label(progress$total_pending),
      progress$pct_label,
      .monitoreo_publication_accreditation_int_label(progress$new_last_day),
      progress$last_date_label,
      progress$updated_label
    ),
    Lectura = c(
      "Casos base considerados para el avance.",
      "Respuestas completas que sí cuentan para el avance.",
      "Respuestas iniciadas; se muestran separadas de completas.",
      "Respuestas rechazadas identificadas en plataforma.",
      "Casos del universo que todavía no tienen respuesta completa.",
      "Completas sobre universo total del corte.",
      "Completas nuevas en la fecha más reciente.",
      "Último día con movimiento registrado.",
      "Fecha y hora compacta del corte publicado."
    ),
    Estado = c(
      "Base", progress$status, "Seguimiento",
      if (progress$total_refusal > 0) "Trazabilidad" else "Sin rechazos",
      if (progress$total_pending > 0) "Por cerrar" else "Completo",
      progress$status,
      if (progress$new_last_day > 0) "Con movimiento" else "Sin movimiento",
      if (nzchar(progress$last_date_label)) "Con fecha" else "Sin fecha",
      progress$status
    ),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.monitoreo_publication_accreditation_validation_df <- function(progress) {
  data.frame(
    Campo = c(
      "Base de avance",
      "Qué cuenta como completa",
      "Parciales y rechazos",
      "Sin respuesta",
      "Estado del corte",
      "Última actualización"
    ),
    Valor = c(
      sprintf(
        "%s completas de %s casos",
        .monitoreo_publication_accreditation_int_label(progress$total_complete),
        .monitoreo_publication_accreditation_int_label(progress$total_universe)
      ),
      "Solo respuestas completas o efectivas",
      sprintf(
        "%s parciales · %s rechazos",
        .monitoreo_publication_accreditation_int_label(progress$total_partial),
        .monitoreo_publication_accreditation_int_label(progress$total_refusal)
      ),
      .monitoreo_publication_accreditation_int_label(progress$total_pending),
      progress$status,
      progress$updated_label
    ),
    Lectura = c(
      "El porcentaje de avance se calcula con completas sobre universo.",
      "Parciales, rechazos y sin respuesta no inflan el avance.",
      "Quedan visibles para trazabilidad, pero separados del logro.",
      "Casos pendientes por cerrar o contactar.",
      "Lectura ejecutiva del corte para cliente.",
      "Se conserva el corte publicado en formato compacto."
    ),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.monitoreo_publication_accreditation_daily_matrix_rows <- function(daily_df, actor_df, states = c(Completas = "Nuevas efectivas"), effective_label = "Completas") {
  daily_df <- .monitoreo_workbook_df(daily_df)
  actor_df <- .monitoreo_workbook_df(actor_df)
  if (!nrow(daily_df) || !"Fecha" %in% names(daily_df)) {
    return(list(c("Unidad", "Estado"), c("Sin datos", effective_label)))
  }
  if ("Bloque" %in% names(daily_df)) {
    by_actor <- daily_df[as.character(daily_df$Bloque) == "Por actor", setdiff(names(daily_df), "Bloque"), drop = FALSE]
  } else {
    by_actor <- daily_df
  }
  if (!nrow(by_actor) || !"Actor" %in% names(by_actor)) {
    return(list(c("Unidad", "Estado"), c("Sin datos", effective_label)))
  }
  dates <- unique(as.character(by_actor$Fecha %||% ""))
  dates <- dates[nzchar(dates) & !is.na(dates)]
  dates <- dates[.monitoreo_publication_accreditation_date_order(dates)]
  actors <- if (nrow(actor_df) && "Actor" %in% names(actor_df)) as.character(actor_df$Actor) else unique(as.character(by_actor$Actor))
  actors <- actors[nzchar(actors) & !is.na(actors)]
  if (!length(dates) || !length(actors)) {
    return(list(c("Unidad", "Estado"), c("Sin datos", effective_label)))
  }
  rows <- list(c("Unidad", "Estado", dates, "Total"))
  for (actor in actors) {
    for (state_label in names(states)) {
      col <- states[[state_label]]
      values <- vapply(dates, function(day) {
        idx <- as.character(by_actor$Actor) == actor & as.character(by_actor$Fecha) == day
        if (!col %in% names(by_actor)) return(0L)
        as.integer(sum(suppressWarnings(as.numeric(by_actor[[col]][idx])), na.rm = TRUE))
      }, integer(1))
      rows[[length(rows) + 1L]] <- c(actor, state_label, as.character(values), as.character(sum(values, na.rm = TRUE)))
    }
  }
  rows
}

.monitoreo_publication_accreditation_progress_status_rows <- function(daily_df, actor_df, updated = "") {
  actor_summary <- .monitoreo_publication_accreditation_actor_summary_df(actor_df)
  progress <- .monitoreo_publication_accreditation_progress_summary(daily_df, actor_summary, updated)
  list(
    .monitoreo_sheets_blank_row(),
    c("Nuevas respuestas último día", "Última fecha con avance", "Última actualización", "Estado de avance"),
    c(
      .monitoreo_publication_accreditation_int_label(progress$new_last_day),
      progress$last_date_label,
      progress$updated_label,
      progress$status
    )
  )
}

.monitoreo_publication_accreditation_actor_block_rows <- function(actor_summary) {
  actor_summary <- .monitoreo_workbook_df(actor_summary)
  if (!nrow(actor_summary)) return(list())
  preferred <- c("Administrativos", "Docentes", "Egresados", "Estudiantes")
  actors <- as.character(actor_summary$Actor %||% "")
  actors <- actors[nzchar(actors) & !is.na(actors)]
  order_values <- c(intersect(preferred, actors), setdiff(actors[order(actors)], preferred))
  rows <- list()
  for (actor in order_values) {
    idx <- match(actor, as.character(actor_summary$Actor %||% ""))
    if (is.na(idx)) next
    row <- actor_summary[idx, , drop = FALSE]
    rows <- c(rows, list(
      c(actor, "", "", "", "", ""),
      c("Total", "Respuestas en el sistema", "", "", "Sin respuesta", "Avance"),
      c("", "Completas", "Parciales", "Rechazos", "", ""),
      c(
        .monitoreo_publication_accreditation_int_label(row$Universo[[1]]),
        .monitoreo_publication_accreditation_int_label(row$Completas[[1]]),
        .monitoreo_publication_accreditation_int_label(row$Parciales[[1]]),
        .monitoreo_publication_accreditation_int_label(row$Rechazos[[1]]),
        .monitoreo_publication_accreditation_int_label(row$`Sin respuesta`[[1]]),
        .monitoreo_workbook_cell_value(row$`% avance`[[1]])
      ),
      .monitoreo_sheets_blank_row()
    ))
  }
  rows
}

.monitoreo_publication_accreditation_client_report_rows <- function(model) {
  title <- .monitoreo_publication_accreditation_cover_value(model, "Reporte", "Reporte de avance")
  cutoff <- .monitoreo_publication_accreditation_cover_value(model, "Corte de datos", "")
  updated <- .monitoreo_scalar(model$synced_at %||% model$generated_at %||% "", "")
  if (!nzchar(trimws(updated))) updated <- cutoff
  actors <- .monitoreo_publication_section_frame(model, "avance_por_actor")
  daily <- .monitoreo_publication_section_frame(model, "avance_diario")
  actor_summary <- .monitoreo_publication_accreditation_actor_summary_df(actors)
  progress <- .monitoreo_publication_accreditation_progress_summary(daily, actor_summary, updated)
  cutoff_label <- .monitoreo_publication_accreditation_datetime_label(cutoff, default = cutoff)
  title_label <- trimws(.monitoreo_workbook_cell_value(title))
  if (!nzchar(title_label)) title_label <- "Reporte de avance"
  if (!grepl("reporte|avance", .monitoreo_text_key(title_label), perl = TRUE)) {
    title_label <- paste("Reporte de avance", title_label, sep = " - ")
  }
  c(
    list(
      .monitoreo_sheets_section_row("Monitoreo"),
      c("Seguimiento de Encuestas", "", "", "", "", ""),
      c("", "Ultima actualizacion", "", .monitoreo_publication_accreditation_datetime_stamp(updated, default = cutoff_label), "", ""),
      .monitoreo_sheets_blank_row(),
      c("Avance general", "", "", "", "", ""),
      c("Total", "Respuestas en el sistema", "", "", "Sin respuesta", "Avance"),
      c("", "Completas", "Parciales", "Rechazos", "", ""),
      c(
        .monitoreo_publication_accreditation_int_label(progress$total_universe),
        .monitoreo_publication_accreditation_int_label(progress$total_complete),
        .monitoreo_publication_accreditation_int_label(progress$total_partial),
        .monitoreo_publication_accreditation_int_label(progress$total_refusal),
        .monitoreo_publication_accreditation_int_label(progress$total_pending),
        progress$pct_label
      ),
      .monitoreo_sheets_blank_row()
    ),
    .monitoreo_publication_accreditation_actor_block_rows(actor_summary),
    .monitoreo_publication_accreditation_progress_status_rows(daily, actors, updated)
  )
}

.monitoreo_publication_accreditation_detail_rows <- function(model) {
  actors <- .monitoreo_publication_section_frame(model, "avance_por_actor")
  actor_summary <- .monitoreo_publication_accreditation_actor_summary_df(actors)
  actor_detail <- actor_summary[, intersect(
    c("Actor", "Universo", "Completas", "Parciales", "Rechazos", "Sin respuesta", "% avance", "Estado"),
    names(actor_summary)
  ), drop = FALSE]
  names(actor_detail)[names(actor_detail) == "Rechazos"] <- "Rechazo"
  names(actor_detail)[names(actor_detail) == "% avance"] <- "% avance universo"
  names(actor_detail)[names(actor_detail) == "Estado"] <- "Estado de avance"
  rows <- .monitoreo_sheets_section_table("Resumen por actor", actor_detail)
  controls <- .monitoreo_publication_section_frame(model, "detalle_variables_control")
  if (!nrow(controls) || !"Unidad" %in% names(controls)) {
    return(c(
      rows,
      .monitoreo_publication_accreditation_section_table(
        "Detalle completo por variables de control",
        .monitoreo_publication_section_frame(model, "avance_por_segmento"),
        "client",
        "avance_por_segmento"
      )
    ))
  }
  rows <- c(rows, list(.monitoreo_sheets_section_row("Detalle completo por variables de control")))
  group_key <- paste(as.character(controls$Unidad), as.character(controls$Variable), sep = "\r")
  for (key in unique(group_key)) {
    part <- controls[group_key == key, , drop = FALSE]
    if (!nrow(part)) next
    actor <- .monitoreo_scalar(part$Unidad[[1]], "Unidad")
    variable <- .monitoreo_scalar(part$Variable[[1]], "Variable")
    full <- data.frame(
      Valor = part$Valor,
      Total = part$Universo,
      Completas = part$Efectivas,
      Parciales = part$Parciales,
      Rechazos = part$Rechazos,
      `Sin respuesta` = part$`Sin respuesta`,
      Avance = part$`Avance efectivo`,
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
    rows <- c(rows, list(.monitoreo_sheets_section_row(paste(actor, variable, sep = " - "))), .monitoreo_sheets_table_rows(full), list(.monitoreo_sheets_blank_row()))
  }
  rows
}

.monitoreo_publication_accreditation_survey_matrix_rows <- function(source_daily, actors) {
  source_daily <- .monitoreo_workbook_df(source_daily)
  actors <- .monitoreo_workbook_df(actors)
  date_cols <- .monitoreo_publication_accreditation_wide_date_cols(source_daily)
  if (!nrow(source_daily) || !length(date_cols) || !"Canal" %in% names(source_daily)) return(list())
  actor_order <- if (nrow(actors) && "Actor" %in% names(actors)) as.character(actors$Actor) else unique(as.character(source_daily$Actor %||% ""))
  actor_order <- actor_order[nzchar(actor_order) & !is.na(actor_order)]
  channels <- unique(trimws(as.character(source_daily$Canal %||% "")))
  channels <- channels[nzchar(channels) & !is.na(channels)]
  rows <- list()
  for (channel in channels) {
    part <- source_daily[trimws(as.character(source_daily$Canal %||% "")) == channel, , drop = FALSE]
    if ("Estado" %in% names(part)) {
      part <- part[grepl("efectiva|completa", .monitoreo_text_key(part$Estado)), , drop = FALSE]
    }
    rows <- c(rows, list(.monitoreo_sheets_section_row(paste("Efectivas por día", channel, sep = " - "))))
    rows[[length(rows) + 1L]] <- c("Unidad", date_cols, "Total")
    for (actor in actor_order) {
      idx <- as.character(part$Actor %||% "") == actor
      values <- vapply(date_cols, function(day) {
        as.integer(sum(suppressWarnings(as.numeric(part[[day]][idx])), na.rm = TRUE))
      }, integer(1))
      rows[[length(rows) + 1L]] <- c(actor, as.character(values), as.character(sum(values, na.rm = TRUE)))
    }
    rows[[length(rows) + 1L]] <- .monitoreo_sheets_blank_row()
  }
  rows
}

.monitoreo_publication_accreditation_survey_summary_matrix_rows <- function(channel_summary, actors) {
  channel_summary <- .monitoreo_workbook_df(channel_summary)
  actors <- .monitoreo_workbook_df(actors)
  if (!nrow(channel_summary) || !"Canal" %in% names(channel_summary) || !"Efectivas" %in% names(channel_summary)) {
    return(list())
  }
  actor_order <- if (nrow(actors) && "Actor" %in% names(actors)) as.character(actors$Actor) else unique(as.character(channel_summary$Actor %||% ""))
  actor_order <- actor_order[nzchar(actor_order) & !is.na(actor_order)]
  if (!length(actor_order)) actor_order <- unique(as.character(channel_summary$Actor %||% ""))
  channel_values <- trimws(as.character(channel_summary$Canal %||% ""))
  channels <- unique(channel_values[nzchar(channel_values) & !is.na(channel_values)])
  date_candidates <- intersect(c("Última efectiva", "Ultima efectiva", "Última respuesta", "Ultima respuesta", "Primer día", "Primer dia"), names(channel_summary))
  date_col <- if (length(date_candidates)) date_candidates[[1L]] else ""
  rows <- list()
  for (channel in channels) {
    part <- channel_summary[channel_values == channel, , drop = FALSE]
    day_values <- if (nzchar(date_col)) trimws(as.character(part[[date_col]])) else character(0)
    day_values <- day_values[nzchar(day_values) & !is.na(day_values)]
    unique_days <- unique(day_values)
    date_cols <- unique_days[.monitoreo_publication_accreditation_date_order(unique_days)]
    rows <- c(rows, list(.monitoreo_sheets_section_row(paste("Efectivas por día", channel, sep = " - "))))
    if (length(date_cols)) {
      rows[[length(rows) + 1L]] <- c("Unidad", date_cols, "Total")
      for (actor in actor_order) {
        idx_actor <- as.character(part$Actor %||% "") == actor
        values <- vapply(date_cols, function(day) {
          idx <- idx_actor & trimws(as.character(part[[date_col]])) == day
          as.integer(sum(suppressWarnings(as.numeric(part$Efectivas[idx])), na.rm = TRUE))
        }, integer(1))
        rows[[length(rows) + 1L]] <- c(actor, as.character(values), as.character(sum(values, na.rm = TRUE)))
      }
    } else {
      rows[[length(rows) + 1L]] <- c("Unidad", "Total")
      for (actor in actor_order) {
        idx <- as.character(part$Actor %||% "") == actor
        total <- as.integer(sum(suppressWarnings(as.numeric(part$Efectivas[idx])), na.rm = TRUE))
        rows[[length(rows) + 1L]] <- c(actor, as.character(total))
      }
    }
    rows[[length(rows) + 1L]] <- .monitoreo_sheets_blank_row()
  }
  rows
}

.monitoreo_publication_accreditation_collector_summary <- function(collector_daily) {
  collector_daily <- .monitoreo_workbook_df(collector_daily)
  date_cols <- .monitoreo_publication_accreditation_wide_date_cols(collector_daily)
  if (!nrow(collector_daily) || !length(date_cols)) return(data.frame())
  text_col <- function(col, default = "") {
    if (!col %in% names(collector_daily)) return(rep(default, nrow(collector_daily)))
    values <- trimws(as.character(collector_daily[[col]]))
    values[is.na(values) | !nzchar(values)] <- default
    values
  }
  key_df <- data.frame(
    Actor = text_col("Actor", "Sin actor"),
    Canal = text_col("Canal", "Sin canal"),
    Fuente = text_col("Fuente", "Encuesta"),
    Recopilador = text_col("Recopilador", "Sin recopilador"),
    `Tipo recopilador` = text_col("Tipo recopilador", "Sin dato"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  key <- do.call(paste, c(key_df, sep = "\r"))
  state <- .monitoreo_text_key(text_col("Estado", ""))
  rows <- lapply(unique(key), function(item) {
    idx <- key == item
    first <- which(idx)[[1]]
    total_by_row <- rowSums(as.data.frame(lapply(date_cols, function(day) {
      suppressWarnings(as.numeric(collector_daily[[day]]))
    })), na.rm = TRUE)
    complete <- sum(total_by_row[idx & grepl("efectiva|completa", state)], na.rm = TRUE)
    partial <- sum(total_by_row[idx & grepl("parcial", state)], na.rm = TRUE)
    refusal <- sum(total_by_row[idx & grepl("rechazo", state)], na.rm = TRUE)
    active_dates <- date_cols[vapply(date_cols, function(day) {
      sum(suppressWarnings(as.numeric(collector_daily[[day]][idx])), na.rm = TRUE) > 0
    }, logical(1))]
    data.frame(
      Actor = key_df$Actor[[first]],
      `Canal encuesta` = key_df$Canal[[first]],
      `Uso operativo` = paste("Aplicación", key_df$Canal[[first]]),
      Titulo = key_df$Fuente[[first]],
      Recopilador = key_df$Recopilador[[first]],
      `Tipo recopilador` = key_df$`Tipo recopilador`[[first]],
      Completas = as.integer(complete),
      Parciales = as.integer(partial),
      Rechazos = as.integer(refusal),
      `Total respuestas` = as.integer(complete + partial + refusal),
      `Ultima actualizacion` = if (length(active_dates)) active_dates[[length(active_dates)]] else "",
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out <- out[order(out$Actor, out$`Canal encuesta`, out$Titulo, out$Recopilador), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.monitoreo_publication_accreditation_channel_collector_summary <- function(channel_summary) {
  channel_summary <- .monitoreo_workbook_df(channel_summary)
  if (!nrow(channel_summary)) return(data.frame())
  text_col <- function(col, default = "") {
    if (!col %in% names(channel_summary)) return(rep(default, nrow(channel_summary)))
    values <- trimws(as.character(channel_summary[[col]]))
    values[is.na(values) | !nzchar(values)] <- default
    values
  }
  num_col <- function(col) {
    if (!col %in% names(channel_summary)) return(rep(0, nrow(channel_summary)))
    values <- suppressWarnings(as.numeric(channel_summary[[col]]))
    values[is.na(values)] <- 0
    values
  }
  channel <- text_col("Canal", "Sin canal")
  source <- text_col("Fuente", "Encuesta")
  update_candidates <- intersect(c("Última respuesta", "Ultima respuesta", "Última efectiva", "Ultima efectiva"), names(channel_summary))
  last_update <- if (length(update_candidates)) text_col(update_candidates[[1L]], "") else rep("", nrow(channel_summary))
  total <- if ("Total respuestas" %in% names(channel_summary)) {
    num_col("Total respuestas")
  } else {
    num_col("Efectivas") + num_col("Parciales") + num_col("Rechazos plataforma") + num_col("Rechazos")
  }
  data.frame(
    Actor = text_col("Actor", "Sin actor"),
    `Canal encuesta` = channel,
    `Uso operativo` = paste("Aplicación", channel),
    Titulo = source,
    Recopilador = source,
    `Tipo recopilador` = "Fuente agregada",
    Completas = as.integer(num_col("Efectivas")),
    Parciales = as.integer(num_col("Parciales")),
    Rechazos = as.integer(num_col("Rechazos plataforma") + num_col("Rechazos")),
    `Total respuestas` = as.integer(total),
    `Ultima actualizacion` = last_update,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

.monitoreo_publication_accreditation_response_source_catalog <- function(sources) {
  sources <- .monitoreo_workbook_df(sources)
  if (!nrow(sources) || !"Fuente de datos" %in% names(sources)) return(data.frame())
  role <- if ("Rol" %in% names(sources)) .monitoreo_text_key(sources$Rol) else rep("", nrow(sources))
  type <- if ("Tipo" %in% names(sources)) .monitoreo_text_key(sources$Tipo) else rep("", nrow(sources))
  keep <- type %in% c("fuente") & role %in% c("respuestas", "respuesta")
  out <- sources[keep, intersect(c("Fuente de datos", "Rol", "Registros procesados"), names(sources)), drop = FALSE]
  if (!nrow(out)) return(data.frame())
  names(out)[names(out) == "Fuente de datos"] <- "Fuente"
  rownames(out) <- NULL
  out
}

.monitoreo_publication_accreditation_survey_rows <- function(model) {
  survey <- .monitoreo_publication_section_frame(model, "avance_por_encuesta")
  source_daily <- .monitoreo_publication_block_df(survey, "Avance diario por fuente")
  collector_daily <- .monitoreo_publication_block_df(survey, "Avance diario por recopilador")
  actors <- .monitoreo_publication_section_frame(model, "avance_por_actor")
  channel_summary <- .monitoreo_publication_section_frame(model, "avance_por_canal_fuente")
  source_catalog <- .monitoreo_publication_accreditation_response_source_catalog(.monitoreo_publication_section_frame(model, "fuentes_actualizacion"))
  rows <- .monitoreo_publication_accreditation_survey_matrix_rows(source_daily, actors)
  if (!length(rows)) {
    rows <- .monitoreo_publication_accreditation_survey_summary_matrix_rows(channel_summary, actors)
  }
  collector_summary <- .monitoreo_publication_accreditation_collector_summary(collector_daily)
  if (!nrow(collector_summary)) {
    collector_summary <- .monitoreo_publication_accreditation_channel_collector_summary(channel_summary)
  }
  if (nrow(collector_summary)) {
    rows <- c(rows, .monitoreo_sheets_section_table("Avance por recopilador", collector_summary))
  }
  if (nrow(source_catalog)) {
    rows <- c(rows, .monitoreo_sheets_section_table("Fuentes consideradas", source_catalog))
  }
  if (length(rows)) return(rows)
  .monitoreo_publication_accreditation_section_table("Avance por recopilador", channel_summary, "client", "avance_por_canal_fuente")
}

.monitoreo_publication_accreditation_actor_advance_order <- function(actors) {
  actors <- unique(trimws(as.character(actors %||% character(0))))
  actors <- actors[nzchar(actors) & !is.na(actors)]
  preferred <- c("Administrativos", "Docentes", "Egresados", "Empleadores", "Estudiantes")
  c(intersect(preferred, actors), sort(setdiff(actors, preferred)))
}

.monitoreo_publication_accreditation_actor_advance_status <- function(value = "") {
  key <- .monitoreo_text_key(value)
  if (key %in% c("completa", "completo", "complete", "completed")) return("Completa")
  if (key %in% c("parcial", "partial", "incomplete")) return("Parcial")
  if (key %in% c("rechazo", "rechazado", "rechazada", "rejected", "refusal")) return("Rechazo")
  "Sin respuesta"
}

.monitoreo_publication_accreditation_actor_advance_state_rank <- function(value = "") {
  switch(.monitoreo_publication_accreditation_actor_advance_status(value),
    Completa = 4L,
    Parcial = 3L,
    Rechazo = 2L,
    `Sin respuesta` = 1L,
    0L
  )
}

.monitoreo_publication_accreditation_actor_advance_columns <- function(base_rows, actor = "") {
  base_rows <- .monitoreo_workbook_df(base_rows)
  if (!nrow(base_rows) || !ncol(base_rows)) return(character(0))
  has_value <- function(col) {
    if (!col %in% names(base_rows)) return(FALSE)
    values <- trimws(as.character(base_rows[[col]] %||% ""))
    any(nzchar(values) & !is.na(values), na.rm = TRUE)
  }
  actor_key <- .monitoreo_report_unit_key(actor)
  preferred <- switch(actor_key,
    docentes = c("N°", "Nº", "Código", "Codigo", "Código PUCP", "Codigo PUCP", "Apellidos del docente", "Nombre del Docente", "Nombre completo", "Dedicación", "Categoría", "Celular", "E-mail", "email", "celular"),
    administrativos = c("N°", "Nº", "Código PUCP", "Codigo PUCP", "Código", "Codigo", "Apellidos y nombres", "Nombres", "Nombre", "Área de trabajo", "email", "E-mail", "celular", "Celular"),
    egresados = c("N°", "Nº", "Código PUCP", "Codigo PUCP", "Código", "Codigo", "Apellidos, Nombres", "Apellidos y nombres", "Nombre", "Nombre2", "Ciclo de egreso", "Ciclo", "E-Mail", "E-mail", "CORREO PUCP", "email", "Celular", "celular", "Teléfonos"),
    c("N°", "Nº", "Código PUCP", "Codigo PUCP", "Código", "Codigo", "CodPulso", "Apellidos, Nombres", "Apellidos y nombres", "Nombres", "Nombre", "Nombre completo", "Ciclo", "E-Mail", "E-mail", "email", "Celular", "celular")
  )
  available_preferred <- preferred[preferred %in% names(base_rows)]
  preferred <- unique(available_preferred[vapply(available_preferred, has_value, logical(1))])
  preferred
}

.monitoreo_publication_accreditation_actor_advance_case_key <- function(items, row, identifier = "") {
  base <- list(
    key = if (length(items)) .monitoreo_scalar(items[[1L]]$key, "") else "",
    key_details = items %||% list(),
    row = row,
    identifier = identifier
  )
  .monitoreo_internal_candidate_id(base)
}

.monitoreo_publication_accreditation_actor_advance_df <- function(data, config = list(), actor = "", case_rollup = NULL) {
  data <- .monitoreo_workbook_df(data)
  if (!nrow(data)) return(data.frame())
  cfg <- monitoreo_normalize_config(config, data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  base_mask <- .monitoreo_report_base_mask(data)
  if (!any(base_mask, na.rm = TRUE)) return(data.frame())
  base_rows_all <- data[base_mask, , drop = FALSE]
  base_idx_all <- which(base_mask)
  base_actors_all <- .monitoreo_report_trace_actor_values(base_rows_all, profile)
  actor_key <- .monitoreo_report_unit_key(actor)
  base_actor_keys <- vapply(base_actors_all, .monitoreo_report_unit_key, character(1))
  keep <- base_actor_keys == actor_key
  if (!any(keep, na.rm = TRUE)) return(data.frame())
  base_rows <- base_rows_all[keep, , drop = FALSE]
  base_idx <- base_idx_all[keep]
  base_actors <- base_actors_all[keep]
  base_details <- .monitoreo_report_key_details(base_rows, profile, "universo")
  base_ids <- .monitoreo_report_first_values(base_rows, c(
    "CodPulso", "Cod Pulso", "Cód Pulso", "Codigo Pulso", "Código Pulso", "Código PUCP", "Codigo PUCP",
    "Código", "Codigo", "ID", "id", "correo", "email", "E-mail", "CORREO PUCP",
    "Nombre", "Nombres", "Apellidos"
  ))
  missing_ids <- !nzchar(trimws(base_ids)) | is.na(base_ids)
  base_ids[missing_ids] <- paste0("Fila base ", base_idx[missing_ids])
  base_case_keys <- vapply(seq_along(base_details), function(i) {
    .monitoreo_publication_accreditation_actor_advance_case_key(base_details[[i]], base_idx[[i]], base_ids[[i]])
  }, character(1))

  rollup <- .monitoreo_workbook_df(case_rollup %||% list())
  if (!nrow(rollup)) {
    rollup <- .monitoreo_acreditacion_case_rollup_df(data, profile)
  }
  if (!nrow(rollup)) {
    rollup <- data.frame(actor = character(), case_key = character(), base_record = character(), platform_state = character(), counts_in_advance = logical(), stringsAsFactors = FALSE)
  }
  rollup_actor_key <- vapply(as.character(rollup$actor %||% ""), .monitoreo_report_unit_key, character(1))
  rollup_case_key <- trimws(as.character(rollup$case_key %||% ""))
  rollup_base_record <- trimws(as.character(rollup$base_record %||% ""))
  rollup_lookup <- c(
    paste(rollup_actor_key, "case", rollup_case_key, sep = "\r"),
    paste(rollup_actor_key, "record", rollup_base_record, sep = "\r")
  )
  rollup_rows <- c(seq_len(nrow(rollup)), seq_len(nrow(rollup)))
  status_for <- function(i) {
    keys <- c(
      paste(.monitoreo_report_unit_key(base_actors[[i]]), "case", base_case_keys[[i]], sep = "\r"),
      paste(.monitoreo_report_unit_key(base_actors[[i]]), "record", trimws(as.character(base_ids[[i]])), sep = "\r")
    )
    keys <- unique(keys[nzchar(sub("^[^\r]+\r[^\r]+\r", "", keys))])
    idx <- rollup_rows[rollup_lookup %in% keys]
    if (!length(idx)) return("Sin respuesta")
    states <- as.character(rollup$platform_state[idx] %||% "")
    ranks <- vapply(states, .monitoreo_publication_accreditation_actor_advance_state_rank, integer(1))
    counts <- vapply(rollup$counts_in_advance[idx] %||% rep(FALSE, length(idx)), .monitoreo_bool, logical(1), default = FALSE)
    selected <- order(counts, ranks, decreasing = TRUE)[[1L]]
    .monitoreo_publication_accreditation_actor_advance_status(states[[selected]])
  }
  status <- vapply(seq_len(nrow(base_rows)), status_for, character(1))
  cols <- .monitoreo_publication_accreditation_actor_advance_columns(base_rows, actor)
  out <- data.frame(`Estado avance` = status, check.names = FALSE, stringsAsFactors = FALSE)
  if (length(cols)) out <- cbind(out, base_rows[, cols, drop = FALSE])
  rownames(out) <- NULL
  out
}

.monitoreo_publication_accreditation_actor_advance_tabs <- function(data, config = list(), reports = list()) {
  data <- .monitoreo_workbook_df(data)
  if (!nrow(data)) return(list())
  cfg <- monitoreo_normalize_config(config, data)
  profile <- cfg$monitoreo_profile %||% monitoreo_normalize_profile(list())
  base_mask <- .monitoreo_report_base_mask(data)
  if (!any(base_mask, na.rm = TRUE)) return(list())
  base_rows <- data[base_mask, , drop = FALSE]
  actors <- .monitoreo_report_trace_actor_values(base_rows, profile)
  actors <- .monitoreo_publication_accreditation_actor_advance_order(actors)
  if (!length(actors)) return(list())
  queries <- reports$internal_queries %||% list()
  case_rollup <- queries$case_rollup %||% list()
  if (!nrow(.monitoreo_workbook_df(case_rollup))) {
    case_rollup <- .monitoreo_acreditacion_case_rollup_df(data, profile)
  }
  out <- list()
  for (actor in actors) {
    df <- .monitoreo_publication_accreditation_actor_advance_df(data, cfg, actor, case_rollup = case_rollup)
    if (!nrow(df)) next
    out[[paste(actor, "Avance", sep = " - ")]] <- .monitoreo_publication_sheet_rows(paste(actor, "Avance", sep = " - "), df)
  }
  out
}

.monitoreo_publication_accreditation_sheet_rows <- function(model, key) {
  audience <- .monitoreo_workbook_audience(model$audience %||% "client")
  family_key <- .monitoreo_publication_family_key(model$family %||% "")
  tabs <- .monitoreo_publication_sheet_tab_names(model$family, audience)
  tab_title <- unname(tabs[[key]] %||% key)
  section_df <- .monitoreo_publication_section_frame(model, key)
  frame <- function(section_key) .monitoreo_publication_section_frame(model, section_key)
  table <- function(title, df, purpose = key) {
    .monitoreo_publication_accreditation_section_table(title, df, audience, purpose)
  }
  is_empty_state <- function(df) {
    df <- .monitoreo_workbook_df(df)
    !nrow(df) ||
      (identical(names(df), "Estado") && nrow(df) <= 1L)
  }
  structured_empty <- function(kind, message) {
    message <- .monitoreo_scalar(message, "Sin datos para este corte.")
    if (identical(kind, "control")) {
      return(data.frame(
        Actor = "Todos",
        `Brecha mínimo` = "",
        Estado = message,
        Detalle = "No hay seguimiento operativo adicional para este corte.",
        Origen = "Motor canónico",
        check.names = FALSE,
        stringsAsFactors = FALSE
      ))
    }
    if (identical(kind, "phone")) {
      return(data.frame(
        Actor = "Todos",
        Responsable = "",
        Estatus = "Sin monitoreo",
        `Rechazos telefónicos` = 0L,
        Estado = message,
        Detalle = "Sin estados telefónicos operativos para este corte.",
        check.names = FALSE,
        stringsAsFactors = FALSE
      ))
    }
    if (identical(kind, "channel")) {
      return(data.frame(
        Actor = "Todos",
        `Canal operativo` = "Sin canal registrado",
        `Título / fuente` = "Sin fuente de respuestas para este corte",
        `Responsable de carga` = "Sin dato",
        `Tipo de responsable` = "Sin dato",
        Completas = 0L,
        Parciales = 0L,
        Rechazos = 0L,
        `Sin respuesta` = 0L,
        `Respuestas registradas` = 0L,
        Estado = "Sin avance por canal/fuente para este corte.",
        check.names = FALSE,
        stringsAsFactors = FALSE
      ))
    }
    if (identical(kind, "case")) {
      return(data.frame(
        Nivel = "Sin casos",
        Caso = "",
        Detalle = message,
        Origen = "Motor canónico",
        Estado = "Sin casos accionables",
        check.names = FALSE,
        stringsAsFactors = FALSE
      ))
    }
    if (identical(kind, "alert")) {
      return(data.frame(
        Nivel = "Sin alertas",
        Motivo = message,
        Detalle = message,
        Origen = "Motor canónico",
        Estado = "Sin alertas",
        check.names = FALSE,
        stringsAsFactors = FALSE
      ))
    }
    .monitoreo_publication_empty_df(message)
  }
  daily_tables <- function(daily) {
    daily <- .monitoreo_workbook_df(daily)
    if (nrow(daily) && "Bloque" %in% names(daily)) {
      general <- daily[as.character(daily$Bloque) == "General", setdiff(names(daily), "Bloque"), drop = FALSE]
      by_actor <- daily[as.character(daily$Bloque) == "Por actor", setdiff(names(daily), "Bloque"), drop = FALSE]
      return(c(
        table("Ritmo general", general, "avance_diario"),
        table("Ritmo por actor", by_actor, "avance_diario")
      ))
    }
    table("Ritmo diario", daily, "avance_diario")
  }
  if (identical(key, "portada")) {
    if (identical(audience, "client") && identical(family_key, "telefonico")) {
      return(c(
        table("Datos del corte", section_df, "portada"),
        table("Seguimiento telefónico", frame("monitoreo_telefonico"), "monitoreo_telefonico"),
        table("Puntos de atención", frame("alertas_internas"), "alertas_internas")
      ))
    }
    if (identical(audience, "client") && identical(family_key, "acreditacion")) {
      return(.monitoreo_publication_accreditation_client_report_rows(model))
    }
    return(table("Resumen del corte", section_df, "portada"))
  }
  if (identical(key, "resumen_ejecutivo")) {
    cards <- .monitoreo_publication_accreditation_present_df(section_df, audience, "summary")
    return(c(
      .monitoreo_sheets_card_rows("Indicadores del corte", cards),
      table("Avance por actor", frame("avance_por_actor"), "avance_por_actor"),
      table("Pendientes por cubrir", frame("cobertura_pendientes"), "cobertura_pendientes")
    ))
  }
  if (identical(key, "resumen_operativo")) {
    cards <- .monitoreo_publication_accreditation_present_df(section_df, audience, "summary")
    return(c(
      table("Datos del corte", frame("portada"), "portada"),
      .monitoreo_sheets_card_rows("Indicadores del corte", cards),
      table("Vista general", frame("avance_general"), "avance_general"),
      table("Avance por actor", frame("avance_por_actor"), "avance_por_actor"),
      table("Mínimos por actor", frame("metas_internas_actor"), "metas_internas_actor"),
      table("Faltantes por actor", frame("pendientes_por_actor"), "pendientes_por_actor")
    ))
  }
  if (identical(key, "produccion_responsable")) {
    return(.monitoreo_publication_accreditation_block_rows("Producción por responsable", section_df, audience, "produccion_responsable"))
  }
  if (identical(key, "avance_diario")) {
    if (identical(audience, "client") && identical(family_key, "acreditacion")) {
      return(.monitoreo_publication_accreditation_detail_rows(model))
    }
    rows <- daily_tables(section_df)
    if (identical(audience, "client")) {
      return(c(
        rows,
        table("Avance por segmento", frame("avance_por_segmento"), "avance_por_segmento")
      ))
    }
    return(rows)
  }
  if (identical(key, "avance_por_canal_fuente") && identical(audience, "client") && identical(family_key, "acreditacion")) {
    return(.monitoreo_publication_accreditation_survey_rows(model))
  }
  if (identical(key, "cobertura_pendientes")) {
    coverage <- .monitoreo_workbook_df(section_df)
    if (nrow(coverage) && "Tipo" %in% names(coverage)) {
      actors <- coverage[as.character(coverage$Tipo) == "Actor", setdiff(names(coverage), "Tipo"), drop = FALSE]
      segments <- coverage[as.character(coverage$Tipo) == "Segmento", setdiff(names(coverage), "Tipo"), drop = FALSE]
      return(c(
        table("Pendientes por actor", actors, "cobertura_pendientes"),
        table("Pendientes por segmento", segments, "cobertura_pendientes")
      ))
    }
    return(table("Pendientes por cubrir", coverage, "cobertura_pendientes"))
  }
  if (identical(key, "control_seguimiento")) {
    tracking <- section_df
    if (is_empty_state(tracking)) {
      tracking <- structured_empty("control", "Sin control de seguimiento interno para este corte.")
    }
    phone <- frame("monitoreo_telefonico")
    if (is_empty_state(phone)) {
      phone <- structured_empty("phone", "Sin monitoreo telefónico para este corte.")
    }
    cases <- frame("casos_accionables")
    if (is_empty_state(cases)) {
      cases <- structured_empty("case", "Sin casos accionables internos.")
    }
    return(c(
      table("Seguimiento operativo", tracking, "control_seguimiento"),
      table("Seguimiento telefónico", phone, "monitoreo_telefonico"),
      table("Casos para revisar", cases, "casos_accionables")
    ))
  }
  if (identical(key, "avance_por_canal_recopilador")) {
    channel <- section_df
    if (is_empty_state(channel)) {
      channel <- structured_empty("channel", "Sin avance por canal/fuente para este corte.")
    }
    return(c(
      daily_tables(frame("avance_diario")),
      table("Avance por canal y responsable", channel, "avance_por_canal_recopilador"),
      table("Avance por segmento", frame("avance_por_segmento"), "avance_por_segmento")
    ))
  }
  if (identical(key, "fuentes_actualizacion")) {
    return(.monitoreo_publication_accreditation_sources_rows(section_df, audience))
  }
  if (identical(key, "auditoria_tecnica")) {
    return(.monitoreo_publication_accreditation_block_rows("Trazabilidad del corte", section_df, audience, "auditoria_tecnica"))
  }
  if (identical(key, "base_tecnica")) {
    return(table("Registros del corte", section_df, "base_tecnica"))
  }
  if (identical(key, "alertas_internas") && is_empty_state(section_df)) {
    section_df <- structured_empty("alert", "Sin alertas internas determinísticas para este corte.")
  }
  section_titles <- c(
    avance_general = "Vista general",
    avance_por_actor = "Avance por actor",
    avance_por_segmento = "Avance por segmento",
    avance_por_canal_fuente = "Avance por canal",
    avance_por_canal_recopilador = "Canal y responsable",
    produccion_responsable = "Producción por responsable",
    metas_internas_actor = "Mínimos por actor",
    pendientes_por_actor = "Faltantes por actor",
    monitoreo_telefonico = "Seguimiento telefónico",
    alertas_internas = "Puntos de atención",
    casos_accionables = "Casos para revisar"
  )
  table(unname(section_titles[[key]] %||% tab_title), section_df, key)
}

