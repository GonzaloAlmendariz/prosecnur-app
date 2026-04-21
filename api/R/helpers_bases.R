# Helpers para la exportación de Bases (Analítica · Fase 4).
#
# El pane "Bases" produce 3 formatos independientes:
#   - .sav  (SPSS binario, con labels + value-labels + measure embebidos)
#   - .csv  (con opción de códigos vs etiquetas + manejo de multi-select)
#   - .xlsx (íd. + opción "ambos" que escribe dos hojas)
#
# Estos helpers viven al nivel del paquete `prosecnurapp` (no `prosecnur`)
# porque la lógica de exportación combina conocimientos del instrumento
# (que vive en la app) con conversiones que prosecnur no expone.
#
# Las funciones privadas (`.` prefix) no se exportan.

# ---- Inferencia de metadatos SPSS ------------------------------------------

# Regresa la medida SPSS apropiada para una columna. Regla:
#   - select_one likert-ish (códigos son secuencia ordenada 1..N con labels que
#     sugieren gradación) → "ordinal"
#   - select_one general → "nominal"
#   - select_multiple → "nominal" (binaria 0/1 por opción cuando se expanda)
#   - integer / decimal / range / calculate numérico → "scale"
#   - date / time / datetime → "scale"
#   - text / geopoint / image / audio / video → "nominal"
.infer_measure <- function(name, col, survey) {
  row <- survey[survey$name %in% name, , drop = FALSE]
  tipo <- if (nrow(row) > 0L) as.character(row$type[1]) else ""
  base <- sub("\\s.*$", "", tipo)

  if (base == "select_one") {
    if (.is_ordinal_choice_list(col)) "ordinal" else "nominal"
  } else if (base == "select_multiple") {
    "nominal"
  } else if (base %in% c("integer", "decimal", "range")) {
    "scale"
  } else if (base == "calculate") {
    # Si el resultado es numérico, asumimos escala; si no, nominal.
    if (is.numeric(col)) "scale" else "nominal"
  } else if (base %in% c("date", "time", "datetime", "start", "end", "today")) {
    "scale"
  } else {
    "nominal"
  }
}

# Heurística: una lista de choices es "ordinal" si los códigos son una
# secuencia numérica monótona (1,2,3,... o 0,1,2,...) y las etiquetas
# tienen alguna pista de gradación ("Nada", "Poco", "Mucho", o números
# al inicio como "1- Nada"). Conservador: si duda, cae en "nominal".
.is_ordinal_choice_list <- function(col) {
  labs <- attr(col, "labels", exact = TRUE)
  if (is.null(labs) || length(labs) < 3L) return(FALSE)
  codigos <- suppressWarnings(as.numeric(labs))
  if (any(is.na(codigos))) return(FALSE)
  # Secuencia ordenada
  sorted <- sort(codigos)
  if (!all(sorted == codigos) && !all(rev(sorted) == codigos)) return(FALSE)
  # Etiquetas: buscar palabras de gradación
  textos <- tolower(as.character(names(labs)))
  pistas <- enc2utf8(c(
    "nada", "poco", "algo", "mucho", "muy", "muchisim", "muchisima",
    "totalmente", "siempre", "nunca", "a veces", "rara vez",
    "bajo", "medio", "alto", "acuerdo", "desacuerdo",
    "satisfech", "insatisfech",
    "malo", "bueno", "regular", "excelente", "pesimo",
    "nivel"
  ))
  # Forzar UTF-8 en `textos` también para evitar "regular expression is
  # invalid UTF-8" cuando el locale es C/POSIX y hay strings con
  # encoding "unknown" que contienen bytes no-ASCII.
  textos <- enc2utf8(textos)
  if (any(vapply(pistas, function(p) any(grepl(p, textos, fixed = TRUE)), logical(1)))) {
    return(TRUE)
  }
  # Códigos prefijados en labels ("1- Nada", "2) Algo", etc.)
  if (all(grepl("^[0-9]+\\s*[\\-\\.\\)]", textos))) return(TRUE)
  FALSE
}

# Formato SPSS: F<w>.<d> para numéricos, DATE/TIME para fechas. Para
# strings devolvemos NA — haven/readstat auto-infiere `A<w>` del ancho
# real de la columna, incluido soporte de "very long string" (>255 chars).
# Si forzamos un A255 manual sobre una columna con strings de 800+ chars,
# readstat escribe bytes que luego no se pueden releer ("Unable to convert
# string to the requested encoding"). Dejarlo en NA evita ese bug.
.infer_spss_format <- function(col) {
  if (inherits(col, "Date")) return("DATE10")
  if (inherits(col, "POSIXct") || inherits(col, "POSIXt")) return("DATETIME20")
  if (inherits(col, "hms") || inherits(col, "times")) return("TIME10")
  if (is.numeric(col) || inherits(col, "haven_labelled") || inherits(col, "haven_labelled_spss")) {
    # Numéricos con decimales: F12.2; enteros: F8.0.
    x <- suppressWarnings(as.numeric(col))
    is_int <- all(is.na(x) | x == as.integer(x))
    if (is_int) "F8.0" else "F12.2"
  } else {
    # character / factor / lo que sea: NA → haven auto-infiere.
    NA_character_
  }
}

# Ancho de display (para SPSS Variable View). Match con format.spss.
.infer_width <- function(col) {
  if (is.numeric(col) || inherits(col, c("haven_labelled", "haven_labelled_spss"))) return(12L)
  if (inherits(col, "Date") || inherits(col, "POSIXct")) return(10L)
  if (is.character(col) || is.factor(col)) {
    w <- suppressWarnings(max(nchar(as.character(col)), na.rm = TRUE))
    if (!is.finite(w) || w <= 0) w <- 20L
    as.integer(min(max(w, 8L), 40L))
  } else {
    20L
  }
}

# Prepara el data frame para write_sav: setea measure, format.spss y
# display_width en cada columna cuando faltan. No destruye los atributos
# existentes (idempotente).
.bases_sav_prepare <- function(df, rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey)) survey <- data.frame(name = character(0), type = character(0), stringsAsFactors = FALSE)

  for (v in names(df)) {
    col <- df[[v]]
    if (is.null(attr(col, "measure", exact = TRUE))) {
      attr(df[[v]], "measure") <- .infer_measure(v, col, survey)
    }
    if (is.null(attr(col, "format.spss", exact = TRUE))) {
      fmt <- .infer_spss_format(col)
      # Solo asignar si es un format válido — para character/factor caemos
      # al auto-inference de haven (que maneja very-long-strings).
      if (!is.na(fmt)) attr(df[[v]], "format.spss") <- fmt
    }
    if (is.null(attr(col, "display_width", exact = TRUE))) {
      attr(df[[v]], "display_width") <- .infer_width(col)
    }
  }
  df
}

# ---- Multi-select expand ---------------------------------------------------

# Detecta columnas select_multiple desde survey y devuelve lista
# nombrada: name -> list_name. Ignora variables que no están en df.
.detect_multiselect <- function(df, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || nrow(sv) == 0L) return(list())
  tipos <- as.character(sv$type %||% "")
  base <- sub("\\s.*$", "", tipos)
  list_names <- trimws(sub("^\\S+\\s*", "", tipos))
  out <- list()
  for (i in seq_len(nrow(sv))) {
    nm <- as.character(sv$name[i] %||% "")
    if (!nzchar(nm) || !nm %in% names(df)) next
    if (base[i] == "select_multiple") out[[nm]] <- list_names[i]
  }
  out
}

# Lee las choices de una lista (`list_name`) desde el instrumento. Devuelve
# data.frame con columnas `name` (código) y `label` (etiqueta en ESP si
# existe). Usa `rp_inst$choices` si disponible, con fallback a atributos de
# la columna.
.choices_desde_instrumento <- function(rp_inst, list_name, fallback_col = NULL) {
  ch <- rp_inst$choices
  if (!is.null(ch) && "list_name" %in% names(ch)) {
    sel <- ch[ch$list_name == list_name, , drop = FALSE]
    if (nrow(sel) > 0L) {
      nm <- as.character(sel$name %||% sel$value %||% "")
      # Label preference: label::Spanish > label
      lab_col <- if (!is.null(rp_inst$choices_raw)) {
        raw <- rp_inst$choices_raw
        raw_sel <- raw[raw$list_name == list_name, , drop = FALSE]
        cands <- grep("^label", tolower(names(raw_sel)))
        if (length(cands) > 0L) {
          sp <- grep("spanish|español", tolower(names(raw_sel)[cands]))
          pick <- if (length(sp) > 0L) cands[sp[1]] else cands[1]
          as.character(raw_sel[[pick]])
        } else NULL
      } else NULL
      lb <- if (!is.null(lab_col) && length(lab_col) == length(nm)) lab_col else as.character(sel$label %||% "")
      Encoding(lb) <- "UTF-8"
      return(data.frame(name = nm, label = lb, stringsAsFactors = FALSE))
    }
  }
  # Fallback: leer attr(, "labels") de una columna representativa
  if (!is.null(fallback_col)) {
    labs <- attr(fallback_col, "labels", exact = TRUE)
    if (!is.null(labs) && length(labs) > 0L) {
      return(data.frame(
        name = as.character(labs),
        label = as.character(names(labs)),
        stringsAsFactors = FALSE
      ))
    }
  }
  data.frame(name = character(0), label = character(0), stringsAsFactors = FALSE)
}

# Slug-ifica un string para usarlo como sufijo de columna (ASCII, sin
# espacios). Preserva códigos numéricos ("1" → "1").
.slug_code <- function(s) {
  s <- as.character(s)
  s <- iconv(s, to = "ASCII//TRANSLIT", sub = "")
  s <- tolower(s)
  s <- gsub("[^a-z0-9]+", "_", s)
  s <- gsub("^_+|_+$", "", s)
  s[!nzchar(s)] <- "na"
  s
}

# Expande columnas select_multiple a dummies 0/1. Para cada variable `v`
# con choices (a, b, c, ...) crea `v___a`, `v___b`, `v___c` con valor 1 si
# el código aparece en la respuesta (split por espacios; soporta formatos
# "1 3 5" y "1;3;5"). Las columnas originales select_multiple se quitan.
.expand_multiselect <- function(df, rp_inst) {
  ms <- .detect_multiselect(df, rp_inst)
  if (length(ms) == 0L) return(df)

  # Preserva atributos top-level del data frame.
  top_attrs <- attributes(df)
  keep_attrs <- setdiff(names(top_attrs), c("names", "row.names", "class"))

  keep_cols <- setdiff(names(df), names(ms))
  out <- df[, keep_cols, drop = FALSE]

  for (v in names(ms)) {
    col <- df[[v]]
    choices <- .choices_desde_instrumento(rp_inst, ms[[v]], fallback_col = col)
    if (nrow(choices) == 0L) {
      # No podemos expandir: devolvemos la columna original intacta.
      out[[v]] <- col
      next
    }
    # Normalizar respuestas: split por espacio o punto y coma, tomar no-vacíos.
    raw <- as.character(col)
    raw[is.na(raw)] <- ""
    tokens_per_row <- strsplit(raw, "[\\s;,]+", perl = TRUE)
    var_label <- attr(col, "label", exact = TRUE) %||% v
    for (i in seq_len(nrow(choices))) {
      code <- choices$name[i]
      label <- choices$label[i]
      new_name <- sprintf("%s___%s", v, .slug_code(code))
      # Evitar colisión si ya existe
      if (new_name %in% names(out)) {
        new_name <- sprintf("%s___c%s", v, .slug_code(code))
      }
      hit <- vapply(tokens_per_row, function(t) any(t == code), logical(1))
      dummy <- as.integer(hit)
      # Filas donde la respuesta original está NA o vacía → NA (no 0).
      na_rows <- is.na(col) | !nzchar(raw)
      dummy[na_rows] <- NA_integer_
      attr(dummy, "label") <- sprintf("%s = %s", var_label, label)
      attr(dummy, "labels") <- stats::setNames(c(0L, 1L), c("No", "Sí"))
      attr(dummy, "measure") <- "nominal"
      attr(dummy, "format.spss") <- "F1.0"
      out[[new_name]] <- haven::labelled_spss(dummy, labels = c("No" = 0, "Sí" = 1))
      attr(out[[new_name]], "label") <- sprintf("%s = %s", var_label, label)
      attr(out[[new_name]], "measure") <- "nominal"
      attr(out[[new_name]], "format.spss") <- "F1.0"
    }
  }

  # Restaurar atributos top-level del df original.
  for (nm in keep_attrs) attr(out, nm) <- top_attrs[[nm]]
  out
}

# ---- Aplicación de etiquetas (códigos → labels) ---------------------------

# Reemplaza cada código por su etiqueta en columnas con `attr(, "labels")`.
# Modo:
#   "codigos"         → no-op, devuelve df tal cual
#   "etiquetas"       → select_one: código → label; select_multiple: "1 3 5"
#                       → "Label A | Label C | Label E" (separador " | ")
# Multi-select:
#   - "codigos_crudos"   → preserva la respuesta tal cual (no decodifica)
#   - "etiquetas_unidas" → join con " | " (solo efectivo si valores="etiquetas")
#   - "dummy_01"         → se expande antes con .expand_multiselect; en ese
#                          punto ya no hay strings multi-select en df.
.aplicar_etiquetas <- function(df, rp_inst, valores = "etiquetas",
                                multi_select = "etiquetas_unidas") {
  if (valores == "codigos") return(df)

  ms_cols <- names(.detect_multiselect(df, rp_inst))

  for (v in names(df)) {
    col <- df[[v]]
    labs <- attr(col, "labels", exact = TRUE)
    if (is.null(labs) || length(labs) == 0L) next

    # Para haven_labelled, names(labs)=etiqueta, labs[]=código (numérico)
    # En reporte_data de prosecnur a veces están al revés. Detectamos:
    # si names son numéricos, entonces names=códigos y values=labels.
    codigos_en_names <- suppressWarnings(!any(is.na(as.numeric(names(labs)))))
    if (codigos_en_names) {
      # names = códigos, labs[] = etiquetas
      map_cod_to_lab <- stats::setNames(as.character(labs), names(labs))
    } else {
      # names = etiquetas, labs[] = códigos
      map_cod_to_lab <- stats::setNames(names(labs), as.character(labs))
    }

    is_multi <- v %in% ms_cols
    raw <- as.character(col)

    if (is_multi) {
      if (multi_select == "codigos_crudos") next
      # "etiquetas_unidas": split + decode + join
      new_vals <- vapply(raw, function(s) {
        if (is.na(s) || !nzchar(s)) return(NA_character_)
        toks <- strsplit(s, "[\\s;,]+", perl = TRUE)[[1]]
        toks <- toks[nzchar(toks)]
        mapped <- map_cod_to_lab[toks]
        mapped[is.na(mapped)] <- toks[is.na(mapped)]
        paste(mapped, collapse = " | ")
      }, character(1), USE.NAMES = FALSE)
    } else {
      # select_one: mapear directo
      new_vals <- map_cod_to_lab[raw]
      new_vals[is.na(new_vals) & !is.na(raw)] <- raw[is.na(new_vals) & !is.na(raw)]
    }

    # Preservar atributo `label` (variable label) pero quitar `labels`
    # (value-labels) porque la columna ahora es texto libre.
    var_label <- attr(col, "label", exact = TRUE)
    df[[v]] <- new_vals
    if (!is.null(var_label)) attr(df[[v]], "label") <- var_label
  }

  df
}

# ---- CSV writer ------------------------------------------------------------

# Escribe un CSV UTF-8 con BOM (para Excel en Windows/es). Soporta ,
# o ; como separador. Los NA se escriben como "" para que Excel los
# muestre vacíos en vez de "NA".
.bases_write_csv <- function(df, path, separador = ",") {
  # Quitar atributos de haven_labelled para que write.csv lo trate como
  # columna plana. El data que llega puede venir con o sin etiquetas
  # aplicadas (según valores= en la config).
  for (v in names(df)) {
    col <- df[[v]]
    if (inherits(col, c("haven_labelled", "haven_labelled_spss"))) {
      df[[v]] <- unclass(col)
      attributes(df[[v]]) <- NULL
    }
  }
  # Construir fila de variable-labels (si están disponibles) como segundo
  # header opcional. Decidimos NO escribirlo en CSV para mantener el
  # archivo RFC-compliant; los labels viven en Excel.
  dec <- if (separador == ";") "," else "."
  con <- file(path, open = "wt", encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  # BOM para Excel
  writeLines("\ufeff", con, sep = "")
  utils::write.table(
    df, file = con, sep = separador, dec = dec,
    row.names = FALSE, col.names = TRUE,
    qmethod = "double", na = "", quote = TRUE, fileEncoding = ""
  )
  path
}

# ---- XLSX writer -----------------------------------------------------------

# Escribe un XLSX con una o dos hojas según `valores`:
#   "codigos"   → hoja única "datos"
#   "etiquetas" → hoja única "datos"
#   "ambos"     → dos hojas: "codigos" + "etiquetas"
# En cada hoja, la fila 1 son los nombres técnicos (para programmatic
# use) y la fila 2 son los labels de variable (legible). Los datos
# empiezan en la fila 3. El analista puede ocultar la fila 2 desde Excel
# si prefiere una tabla plana.
.bases_write_xlsx <- function(df_cod, df_lab, path, valores = "ambos") {
  wb <- openxlsx::createWorkbook()

  escribir_hoja <- function(sheet_name, data) {
    openxlsx::addWorksheet(wb, sheet_name)
    # Fila 1: nombres técnicos
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(names(data)), stringsAsFactors = FALSE), colNames = FALSE, startRow = 1L)
    # Fila 2: labels de variable (si existen)
    var_labels <- vapply(data, function(c) {
      l <- attr(c, "label", exact = TRUE)
      if (is.null(l)) "" else as.character(l)
    }, character(1))
    openxlsx::writeData(wb, sheet_name, as.data.frame(as.list(var_labels), stringsAsFactors = FALSE), colNames = FALSE, startRow = 2L)
    # Limpia atributos haven antes de escribir (writeData no los respeta).
    for (v in names(data)) {
      col <- data[[v]]
      if (inherits(col, c("haven_labelled", "haven_labelled_spss"))) {
        data[[v]] <- unclass(col)
        attributes(data[[v]]) <- NULL
      }
    }
    openxlsx::writeData(wb, sheet_name, data, startRow = 3L, colNames = FALSE)
    # Estilo: fila 1 bold + fondo gris claro, fila 2 italic + gris más claro
    header1 <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E8EAED", halign = "left")
    header2 <- openxlsx::createStyle(textDecoration = "italic", fontColour = "#5F6368", fgFill = "#F6F7F9")
    openxlsx::addStyle(wb, sheet_name, header1, rows = 1L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::addStyle(wb, sheet_name, header2, rows = 2L, cols = seq_along(data), gridExpand = TRUE)
    openxlsx::freezePane(wb, sheet_name, firstActiveRow = 3L)
    openxlsx::setColWidths(wb, sheet_name, cols = seq_along(data), widths = "auto")
  }

  if (valores == "ambos") {
    escribir_hoja("codigos", df_cod)
    escribir_hoja("etiquetas", df_lab)
  } else if (valores == "etiquetas") {
    escribir_hoja("datos", df_lab)
  } else {
    escribir_hoja("datos", df_cod)
  }

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# ---- Generador SPSS syntax (.sps) de respaldo -----------------------------

# Implementación local de generación de niveles_medida.sps. Previamente
# se usaba generar_spss_niveles dentro de reporte_spss. Aquí
# lo replicamos en la app para tener control total del toggle "Avanzado".
.bases_generar_sps <- function(df, path_sps) {
  lines <- character(0)
  lines <- c(lines, "* Niveles de medida y formatos de respaldo.")
  lines <- c(lines, "* Ejecutar este syntax después de abrir el .sav si SPSS no respetó los atributos embebidos.")
  lines <- c(lines, "")

  # VARIABLE LEVEL (por measure)
  por_medida <- list(nominal = character(0), ordinal = character(0), scale = character(0))
  for (v in names(df)) {
    m <- attr(df[[v]], "measure", exact = TRUE)
    if (is.null(m)) next
    if (m %in% names(por_medida)) por_medida[[m]] <- c(por_medida[[m]], v)
  }
  for (m in names(por_medida)) {
    if (length(por_medida[[m]]) == 0L) next
    lines <- c(lines,
               sprintf("VARIABLE LEVEL %s (%s).",
                       paste(por_medida[[m]], collapse = " "),
                       toupper(m)))
  }
  lines <- c(lines, "")

  # FORMATS (por format.spss)
  por_fmt <- list()
  for (v in names(df)) {
    f <- attr(df[[v]], "format.spss", exact = TRUE)
    if (is.null(f)) next
    por_fmt[[f]] <- c(por_fmt[[f]], v)
  }
  for (f in names(por_fmt)) {
    lines <- c(lines,
               sprintf("FORMATS %s (%s).",
                       paste(por_fmt[[f]], collapse = " "),
                       f))
  }
  lines <- c(lines, "")
  lines <- c(lines, "EXECUTE.")

  # Convertimos a UTF-8 explícitamente para evitar warnings de conversión
  # si el locale del proceso es C/POSIX.
  lines <- enc2utf8(lines)
  con <- file(path_sps, open = "wb")
  on.exit(close(con), add = TRUE)
  writeBin(charToRaw(paste0(paste(lines, collapse = "\n"), "\n")), con)
  path_sps
}

# Normaliza toda string (columnas + atributos label/labels) a UTF-8.
# Es crítico antes de haven::write_sav: si una columna tiene strings con
# encoding marcado como "unknown" o "latin1", readstat rechaza el archivo
# al releerlo ("Unable to convert string to the requested encoding").
.bases_enforce_utf8 <- function(df) {
  for (v in names(df)) {
    col <- df[[v]]
    # Atributos de strings
    lab <- attr(col, "label", exact = TRUE)
    if (is.character(lab)) {
      attr(df[[v]], "label") <- enc2utf8(lab)
    }
    labs <- attr(col, "labels", exact = TRUE)
    if (!is.null(labs)) {
      # names(labs) suelen ser las etiquetas visibles; reforzamos UTF-8
      if (is.character(names(labs))) {
        names(labs) <- enc2utf8(names(labs))
      }
      if (is.character(labs)) {
        labs_utf8 <- enc2utf8(as.character(labs))
        labs <- stats::setNames(labs_utf8, names(labs))
      }
      attr(df[[v]], "labels") <- labs
    }
    # Columnas character
    if (is.character(col)) {
      df[[v]] <- enc2utf8(col)
    } else if (is.factor(col)) {
      levels(df[[v]]) <- enc2utf8(levels(col))
    }
  }
  df
}

# ---- Metadatos: preview + overrides --------------------------------------

# Devuelve una lista de variables con la inferencia completa (tipo XLSForm,
# measure inferido, format.spss inferido, si tiene value-labels) para que la
# UI la muestre como tabla editable. La preview NO aplica overrides del
# usuario — expone solo lo que el motor inferiría por defecto. La UI
# mergea con los overrides del store para el display final.
.bases_metadata_preview <- function(df, rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv)) sv <- data.frame(name = character(0), type = character(0), stringsAsFactors = FALSE)
  out <- vector("list", length(names(df)))
  for (i in seq_along(names(df))) {
    v <- names(df)[i]
    col <- df[[v]]
    row <- sv[sv$name %in% v, , drop = FALSE]
    tipo <- if (nrow(row) > 0L) as.character(row$type[1]) else ""
    base <- sub("\\s.*$", "", tipo)
    label <- attr(col, "label", exact = TRUE) %||% ""
    if (is.character(label)) label <- enc2utf8(label)
    has_labels <- !is.null(attr(col, "labels", exact = TRUE))
    inferred_measure <- .infer_measure(v, col, sv)
    # Para el preview, format.spss NA se presenta como "auto" (haven lo
    # inferirá al escribir). El usuario puede overridearlo si quiere
    # forzar un ancho específico.
    inf_fmt <- .infer_spss_format(col)
    inferred_format_spss <- if (is.na(inf_fmt)) "auto" else inf_fmt
    out[[i]] <- list(
      name = v,
      label = label,
      tipo_xlsform = if (nzchar(base)) base else NA_character_,
      inferred_measure = inferred_measure,
      inferred_format_spss = inferred_format_spss,
      has_labels = has_labels
    )
  }
  out
}

# Normaliza overrides del store. `raw` es la lista tal cual sale del JSON
# (puede tener claves vacías, valores inválidos, etc.). Devuelve una
# estructura list(name -> list(measure=?, format_spss=?)) solo con
# entradas válidas.
.bases_overrides_parse <- function(raw) {
  if (is.null(raw) || length(raw) == 0L) return(list())
  valid_measures <- c("nominal", "ordinal", "scale")
  out <- list()
  if (is.list(raw)) {
    for (nm in names(raw)) {
      if (!nzchar(nm)) next
      ov <- raw[[nm]]
      if (!is.list(ov)) next
      clean <- list()
      if (!is.null(ov$measure)) {
        m <- as.character(ov$measure)[1]
        if (m %in% valid_measures) clean$measure <- m
      }
      if (!is.null(ov$format_spss)) {
        f <- as.character(ov$format_spss)[1]
        if (nzchar(f)) clean$format_spss <- f
      }
      if (length(clean) > 0L) out[[nm]] <- clean
    }
  }
  out
}

# Aplica los overrides sobre un df ya preparado (con measure / format.spss
# inferidos). Los overrides ganan sobre la inferencia.
.bases_apply_overrides <- function(df, overrides) {
  if (length(overrides) == 0L) return(df)
  for (nm in names(overrides)) {
    if (!nm %in% names(df)) next
    ov <- overrides[[nm]]
    if (!is.null(ov$measure)) attr(df[[nm]], "measure") <- ov$measure
    if (!is.null(ov$format_spss)) attr(df[[nm]], "format.spss") <- ov$format_spss
  }
  df
}

# ---- Helper global de export completo para .sav ---------------------------

# Prepara + escribe el .sav. Devuelve el path. Si `incluir_sps` es TRUE,
# también genera `niveles_medida.sps` en el mismo directorio.
# `overrides` es opcional: lista `name -> list(measure?, format_spss?)`.
.bases_export_sav <- function(df, rp_inst, path_sav, path_sps = NULL,
                              overrides = list()) {
  # 1) Convertir columnas con value-labels a haven_labelled_spss. Reusa
  #    el post-procesamiento de reporte_spss vía attrs — aplica
  #    la misma conversión pero sin correr ese wrapper (que escribe a
  #    disco).
  df2 <- df
  for (v in names(df2)) {
    x <- df2[[v]]
    labs <- attr(x, "labels", exact = TRUE)
    v_lab <- attr(x, "label", exact = TRUE)
    meas <- attr(x, "measure", exact = TRUE)
    fmt <- attr(x, "format.spss", exact = TRUE)
    dw <- attr(x, "display_width", exact = TRUE)

    if (!is.null(labs) && length(labs) > 0L) {
      codigos_en_names <- suppressWarnings(!any(is.na(as.numeric(names(labs)))))
      if (codigos_en_names) {
        codigos <- suppressWarnings(as.numeric(names(labs)))
        textos <- as.character(unname(labs))
      } else {
        codigos <- suppressWarnings(as.numeric(labs))
        textos <- as.character(names(labs))
      }
      ok <- !is.na(codigos)
      codigos <- codigos[ok]
      textos <- textos[ok]
      dup <- duplicated(codigos)
      codigos <- codigos[!dup]
      textos <- textos[!dup]
      if (length(codigos) > 0L) {
        labs_new <- stats::setNames(codigos, textos)
        x_num <- suppressWarnings(as.numeric(x))
        df2[[v]] <- haven::labelled_spss(x_num, labels = labs_new)
      }
    }

    if (!is.null(v_lab)) attr(df2[[v]], "label") <- v_lab
    if (!is.null(meas)) attr(df2[[v]], "measure") <- meas
    if (!is.null(fmt)) attr(df2[[v]], "format.spss") <- fmt
    if (!is.null(dw)) attr(df2[[v]], "display_width") <- dw
  }

  # 2) Completar metadatos faltantes (measure/format.spss/display_width).
  df2 <- .bases_sav_prepare(df2, rp_inst)

  # 2b) Aplicar overrides del usuario sobre la inferencia. El usuario
  #     puede corregir un ordinal que quedó como nominal, o forzar un
  #     ancho A40 en una variable de texto específica.
  df2 <- .bases_apply_overrides(df2, overrides)

  # 3) Renombrar columnas que empiecen con "_" (no válidas en SPSS).
  bad <- grepl("^_", names(df2))
  if (any(bad)) {
    proposed <- sub("^_", "", names(df2)[bad])
    safe <- !(proposed %in% names(df2)[!bad])
    if (any(safe)) names(df2)[bad][safe] <- proposed[safe]
  }

  # 4) Tipos especiales (Date/POSIXct/hms) — si no se aplicó antes.
  instr <- attr(df2, "instrumento_reporte", exact = TRUE)
  vars_fecha <- attr(df2, "vars_fecha", exact = TRUE) %||% instr$vars_fecha
  vars_hora <- attr(df2, "vars_hora", exact = TRUE) %||% instr$vars_hora
  vars_dt <- attr(df2, "vars_datetime", exact = TRUE) %||% instr$vars_datetime
  if (length(vars_fecha)) {
    for (v in intersect(vars_fecha, names(df2))) {
      if (!inherits(df2[[v]], "Date")) df2[[v]] <- try(as.Date(df2[[v]]), silent = TRUE)
    }
  }
  if (length(vars_hora) && requireNamespace("hms", quietly = TRUE)) {
    for (v in intersect(vars_hora, names(df2))) {
      if (!inherits(df2[[v]], "hms")) df2[[v]] <- try(hms::as_hms(df2[[v]]), silent = TRUE)
    }
  }
  if (length(vars_dt)) {
    for (v in intersect(vars_dt, names(df2))) {
      if (!inherits(df2[[v]], "POSIXct")) df2[[v]] <- try(as.POSIXct(df2[[v]]), silent = TRUE)
    }
  }

  # 5) Normalizar encoding antes de escribir (evita "Unable to convert
  #    string to the requested encoding" al releer el .sav).
  df2 <- .bases_enforce_utf8(df2)

  # 6) Escribir
  haven::write_sav(data = df2, path = path_sav, compress = TRUE)

  if (!is.null(path_sps)) .bases_generar_sps(df2, path_sps)

  invisible(df2)
}
