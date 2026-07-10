# Ficha tecnica comun para entregables analiticos en XLSX.

if (!exists("%||%", mode = "function")) {
  `%||%` <- function(x, y) if (is.null(x)) y else x
}

.ficha_tecnica_scalar <- function(x, fallback = "") {
  if (is.null(x) || length(x) == 0L) return(fallback)
  out <- as.character(x[[1]])
  if (is.na(out) || !nzchar(trimws(out))) fallback else trimws(out)
}

.ficha_tecnica_chr_vec <- function(x) {
  if (is.null(x)) return(character(0))
  v <- unlist(x, use.names = FALSE)
  if (is.null(v)) return(character(0))
  out <- as.character(v)
  out[!is.na(out) & nzchar(out)]
}

.ficha_tecnica_type_base <- function(type) {
  out <- trimws(sub("\\s+.*$", "", as.character(type %||% "")))
  out[is.na(out)] <- ""
  out
}

.ficha_tecnica_cfg <- function(cfg, key, fallback = NULL) {
  ft <- (cfg %||% list())$ficha_tecnica %||% list()
  .ficha_tecnica_scalar(ft[[key]], fallback %||% "")
}

.ficha_tecnica_form_title <- function(instrumento = NULL) {
  settings <- (instrumento %||% list())$settings %||% NULL
  if (is.data.frame(settings) && nrow(settings) > 0L) {
    for (col in c("form_title", "title", "form_id", "id_string")) {
      if (col %in% names(settings)) {
        value <- .ficha_tecnica_scalar(settings[[col]][1], "")
        if (nzchar(value)) return(value)
      }
    }
  }
  ""
}

.ficha_tecnica_instrumento_resumen <- function(data = NULL, instrumento = NULL) {
  survey <- (instrumento %||% list())$survey %||% NULL
  if (!is.data.frame(survey) || nrow(survey) == 0L || !"type" %in% names(survey)) {
    if (is.data.frame(data)) {
      return(sprintf("Base procesada con %s variables.", format(ncol(data), big.mark = ",")))
    }
    return("Instrumento no documentado en la ficha metodológica disponible.")
  }

  types <- .ficha_tecnica_type_base(survey$type)
  data_types <- setdiff(types, c(
    "begin_group", "end_group", "begin_repeat", "end_repeat",
    "note", "calculate", "start", "end", "today", "deviceid",
    "subscriberid", "phonenumber", "simserial", "username", "audit"
  ))
  data_types <- data_types[nzchar(data_types)]
  n_items <- length(data_types)
  n_select_one <- sum(data_types == "select_one", na.rm = TRUE)
  n_select_multiple <- sum(data_types == "select_multiple", na.rm = TRUE)
  n_numeric <- sum(data_types %in% c("integer", "decimal", "range"), na.rm = TRUE)
  n_text <- sum(data_types %in% c("text", "geopoint", "geoshape", "geotrace"), na.rm = TRUE)

  paste(
    sprintf("XLSForm con %s preguntas de datos", format(n_items, big.mark = ",")),
    sprintf("%s de selección única", format(n_select_one, big.mark = ",")),
    sprintf("%s de selección múltiple", format(n_select_multiple, big.mark = ",")),
    sprintf("%s numéricas", format(n_numeric, big.mark = ",")),
    sprintf("%s de texto u otras abiertas.", format(n_text, big.mark = ",")),
    sep = "; "
  )
}

.ficha_tecnica_sheet_name <- function(wb, sheet = "Ficha tecnica") {
  base <- trimws(as.character(sheet %||% "Ficha tecnica")[1])
  if (!nzchar(base)) base <- "Ficha tecnica"
  base <- gsub("[:\\\\/\\?\\*\\[\\]]", " ", base)
  base <- gsub("\\s+", " ", base)
  base <- substr(base, 1L, 31L)
  existing <- names(wb)
  if (!(base %in% existing)) return(base)
  for (i in seq_len(99L)) {
    suffix <- paste0(" ", i)
    candidate <- substr(base, 1L, 31L - nchar(suffix))
    candidate <- paste0(candidate, suffix)
    if (!(candidate %in% existing)) return(candidate)
  }
  tempfile("Ficha ")
}

.ficha_tecnica_rows <- function(data = NULL,
                                instrumento = NULL,
                                reporte = "Entregable analitico",
                                fuente = NULL,
                                cfg = NULL,
                                hojas = NULL,
                                detalles = NULL,
                                generado_en = Sys.time()) {
  n_filas <- if (is.data.frame(data)) nrow(data) else NA_integer_
  n_cols <- if (is.data.frame(data)) ncol(data) else NA_integer_
  excluidas <- .ficha_tecnica_chr_vec((cfg %||% list())$variables_excluidas)
  cod_presentes <- .ficha_tecnica_chr_vec(((cfg %||% list())$codebook %||% list())$codigos_solo_si_presentes)
  fuente_pref <- .ficha_tecnica_scalar((cfg %||% list())$fuente_preferida, "")
  if (!nzchar(fuente_pref)) fuente_pref <- .ficha_tecnica_scalar(fuente, "No informada")

  estudio <- .ficha_tecnica_cfg(cfg, "estudio", .ficha_tecnica_form_title(instrumento))
  if (!nzchar(estudio)) estudio <- "No documentado en la ficha metodológica disponible."

  # Grano de instancia si el entregable se genera sobre una base hija repeat
  # (ADR 0030, Fase 4). La Fase 3 deja el meta de grano en
  # `attr(instrumento, "repeat_grain")`; aquí sólo se anexa la nota de N correcta
  # (N=instancias ... de N personas). Bases normales -> nota vacía, sin cambios.
  grain_nota <- .repeat_grain_ficha_nota(.repeat_grain_from_inst(instrumento))
  muestra <- if (is.finite(n_filas) && is.finite(n_cols)) {
    base_txt <- sprintf(
      "Base de análisis del entregable: %s casos y %s variables.",
      format(n_filas, big.mark = ","),
      format(n_cols, big.mark = ",")
    )
    if (nzchar(grain_nota)) paste(base_txt, grain_nota) else base_txt
  } else {
    "No aplica o no disponible para este entregable."
  }

  hojas_txt <- if (length(hojas)) {
    paste(as.character(hojas), collapse = ", ")
  } else {
    "No disponible."
  }

  limpieza <- c(
    if (length(excluidas)) {
      sprintf("Variables excluidas para este entregable: %s.", paste(excluidas, collapse = ", "))
    } else {
      "No se registran variables excluidas para este entregable."
    },
    if (length(cod_presentes)) {
      sprintf("Codigos especiales documentados solo si aparecen en la data: %s.", paste(cod_presentes, collapse = ", "))
    } else {
      "No se registran codigos especiales condicionados a presencia."
    }
  )

  base_rows <- data.frame(
    Campo = c(
      "Tipo de investigacion",
      "Estudio",
      "Universo de estudio",
      "Base de analisis",
      "Criterios de inclusion",
      "Ambito geografico",
      "Distritos seleccionados",
      "Aplicacion piloto",
      "Aplicacion del recojo de informacion",
      "Marco muestral",
      "Tamano de la muestra",
      "Procedimiento de muestreo",
      "Nivel de representatividad",
      "Instrumento",
      "Tecnica de aplicacion",
      "Supervision y control de calidad",
      "Digitacion / procesamiento",
      "Plan de limpieza de datos y consistencia",
      "Entregables",
      "Trazabilidad del entregable"
    ),
    Detalle = c(
      .ficha_tecnica_cfg(cfg, "tipo_investigacion", "Estudio cuantitativo documentado a partir de bases de encuesta procesadas."),
      estudio,
      .ficha_tecnica_cfg(cfg, "universo_estudio", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "base_analisis", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "criterios_inclusion", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "ambito_geografico", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "distritos_seleccionados", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "aplicacion_piloto", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(
        cfg,
        "aplicacion_recojo",
        .ficha_tecnica_cfg(cfg, "aplicacion_de_encuestas", "No documentado en la ficha metodológica disponible.")
      ),
      .ficha_tecnica_cfg(cfg, "marco_muestral", "No documentado en la ficha metodológica disponible."),
      muestra,
      .ficha_tecnica_cfg(cfg, "procedimiento_muestreo", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "nivel_representatividad", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "instrumento", .ficha_tecnica_instrumento_resumen(data, instrumento)),
      .ficha_tecnica_cfg(cfg, "tecnica_aplicacion", "No documentado en la ficha metodológica disponible."),
      .ficha_tecnica_cfg(cfg, "supervision_control", "Revisión de consistencia y controles de calidad aplicados durante el procesamiento del estudio."),
      .ficha_tecnica_cfg(cfg, "digitacion_procesamiento", sprintf("Procesamiento local de la base de encuesta. Fuente declarada: %s.", fuente_pref)),
      .ficha_tecnica_cfg(cfg, "plan_limpieza", paste(limpieza, collapse = " ")),
      .ficha_tecnica_cfg(cfg, "entregables", sprintf("Este archivo XLSX incluye las hojas: %s.", hojas_txt)),
      sprintf(
        "Reporte: %s. Generado el %s.",
        .ficha_tecnica_scalar(reporte, "Entregable analitico"),
        format(generado_en, "%Y-%m-%d %H:%M:%S %Z")
      )
    ),
    Observacion = c(
      "Campo descriptivo editable; no reemplaza la documentacion metodologica completa del estudio.",
      if (identical(estudio, "No documentado en la ficha metodológica disponible.")) "Pendiente de completar en la ficha metodológica." else "Tomado de la documentación metodológica o del instrumento.",
      "Pendiente si el proyecto no registra ficha metodologica.",
      "Pendiente si el proyecto no registra base de análisis.",
      "Pendiente si el proyecto no registra criterios de elegibilidad.",
      "Pendiente si el proyecto no registra ficha metodologica.",
      "Pendiente si el proyecto no registra distritos de la muestra.",
      "Pendiente si no corresponde o no fue documentado.",
      "Pendiente si el proyecto no registra periodo de campo.",
      "Pendiente si el proyecto no registra marco muestral.",
      "Calculado desde la base escrita en este entregable.",
      "Pendiente si el proyecto no registra diseno muestral.",
      "Pendiente si el proyecto no registra alcance de representatividad.",
      "Calculado desde el XLSForm usado por el entregable.",
      "Pendiente si el proyecto no registra modalidad de aplicacion.",
      "Describe el procesamiento disponible desde Analitica.",
      "Generado automáticamente.",
      "Generado automáticamente desde la configuración metodológica.",
      "Generado automáticamente desde el libro actual.",
      "Generado automáticamente."
    ),
    stringsAsFactors = FALSE
  )

  if (is.list(detalles) && length(detalles)) {
    extra <- data.frame(
      Campo = names(detalles),
      Detalle = vapply(detalles, function(x) paste(as.character(unlist(x)), collapse = ", "), character(1)),
      Observacion = "Detalle adicional del generador del entregable.",
      stringsAsFactors = FALSE
    )
    base_rows <- rbind(base_rows, extra)
  }

  base_rows
}

.ficha_tecnica_norm_field <- function(x) {
  out <- enc2utf8(as.character(x %||% ""))
  replacements <- c(
    "\u00e1" = "a", "\u00e0" = "a", "\u00e4" = "a", "\u00e2" = "a", "\u00e3" = "a",
    "\u00c1" = "A", "\u00c0" = "A", "\u00c4" = "A", "\u00c2" = "A", "\u00c3" = "A",
    "\u00e9" = "e", "\u00e8" = "e", "\u00eb" = "e", "\u00ea" = "e",
    "\u00c9" = "E", "\u00c8" = "E", "\u00cb" = "E", "\u00ca" = "E",
    "\u00ed" = "i", "\u00ec" = "i", "\u00ef" = "i", "\u00ee" = "i",
    "\u00cd" = "I", "\u00cc" = "I", "\u00cf" = "I", "\u00ce" = "I",
    "\u00f3" = "o", "\u00f2" = "o", "\u00f6" = "o", "\u00f4" = "o", "\u00f5" = "o",
    "\u00d3" = "O", "\u00d2" = "O", "\u00d6" = "O", "\u00d4" = "O", "\u00d5" = "O",
    "\u00fa" = "u", "\u00f9" = "u", "\u00fc" = "u", "\u00fb" = "u",
    "\u00da" = "U", "\u00d9" = "U", "\u00dc" = "U", "\u00db" = "U",
    "\u00f1" = "n", "\u00d1" = "N", "\u00e7" = "c", "\u00c7" = "C"
  )
  for (from in names(replacements)) {
    out <- gsub(from, replacements[[from]], out, fixed = TRUE)
  }
  out <- iconv(out, to = "ASCII//TRANSLIT", sub = "")
  out <- tolower(out)
  out <- gsub("[^a-z0-9]+", "_", out)
  gsub("^_+|_+$", "", out)
}

.ficha_tecnica_docx_labels <- function() {
  c(
    "Tipo de investigaci\u00f3n",
    "Estudio",
    "Universo de estudio",
    "Base de an\u00e1lisis",
    "Criterios de inclusi\u00f3n",
    "\u00c1mbito geogr\u00e1fico",
    "Distritos seleccionados",
    "Aplicaci\u00f3n de encuestas piloto",
    "Aplicaci\u00f3n de encuestas",
    "Marco muestral",
    "Tama\u00f1o de la muestra",
    "Procedimiento de muestreo",
    "Nivel de representatividad",
    "Ponderaci\u00f3n",
    "Instrumento",
    "T\u00e9cnica de aplicaci\u00f3n",
    "Prueba piloto",
    "Supervisi\u00f3n de mesa",
    "Supervisi\u00f3n de campo",
    "Digitaci\u00f3n",
    "Plan de limpieza de datos y consistencia",
    "Entregables"
  )
}

.ficha_tecnica_docx_aliases <- function() {
  list(
    tipo_de_investigacion = c("tipo_de_investigacion"),
    estudio = c("estudio"),
    universo_de_estudio = c("universo_de_estudio"),
    base_de_analisis = c("base_de_analisis", "base_analisis"),
    criterios_de_inclusion = c("criterios_de_inclusion", "criterios_inclusion"),
    ambito_geografico = c("ambito_geografico"),
    distritos_seleccionados = c("distritos_seleccionados", "distritos_muestra", "distritos"),
    aplicacion_de_encuestas_piloto = c("aplicacion_de_encuestas_piloto", "aplicacion_piloto"),
    aplicacion_de_encuestas = c("aplicacion_de_encuestas", "aplicacion_del_recojo_de_informacion", "aplicacion_recojo"),
    marco_muestral = c("marco_muestral"),
    tamano_de_la_muestra = c("tamano_de_la_muestra", "tamano_muestra"),
    procedimiento_de_muestreo = c("procedimiento_de_muestreo"),
    nivel_de_representatividad = c("nivel_de_representatividad"),
    ponderacion = c("ponderacion"),
    instrumento = c("instrumento"),
    tecnica_de_aplicacion = c("tecnica_de_aplicacion", "tecnica_aplicacion"),
    prueba_piloto = c("prueba_piloto"),
    supervision_de_mesa = c("supervision_de_mesa", "supervision_control"),
    supervision_de_campo = c("supervision_de_campo", "supervision_control"),
    digitacion = c("digitacion", "digitacion_procesamiento"),
    plan_de_limpieza_de_datos_y_consistencia = c("plan_de_limpieza_de_datos_y_consistencia", "plan_limpieza"),
    entregables = c("entregables")
  )
}

.ficha_tecnica_lookup <- function(values, key, fallback = "No documentado en la ficha metodológica disponible.") {
  aliases <- .ficha_tecnica_docx_aliases()
  keys <- unique(c(key, aliases[[key]] %||% character(0)))
  for (k in keys) {
    if (k %in% names(values)) {
      value <- .ficha_tecnica_scalar(values[[k]], "")
      if (nzchar(value)) return(value)
    }
  }
  fallback
}

.ficha_tecnica_docx_rows <- function(data = NULL,
                                     instrumento = NULL,
                                     reporte = "Ficha tecnica",
                                     fuente = NULL,
                                     cfg = NULL,
                                     hojas = NULL,
                                     detalles = NULL) {
  rows <- .ficha_tecnica_rows(
    data = data,
    instrumento = instrumento,
    reporte = reporte,
    fuente = fuente,
    cfg = cfg,
    hojas = hojas,
    detalles = detalles
  )
  values <- stats::setNames(as.character(rows$Detalle), .ficha_tecnica_norm_field(rows$Campo))
  values[.ficha_tecnica_norm_field("Prueba piloto")] <- .ficha_tecnica_cfg(
    cfg,
    "prueba_piloto",
    "No documentado en la ficha metodológica disponible."
  )
  ft <- (cfg %||% list())$ficha_tecnica %||% list()
  extra_keys <- c(
    "aplicacion_de_encuestas_piloto", "aplicacion_de_encuestas",
    "base_de_analisis", "base_analisis", "criterios_de_inclusion", "criterios_inclusion",
    "distritos_seleccionados", "distritos_muestra", "distritos",
    "tamano_de_la_muestra", "ponderacion", "supervision_de_mesa", "supervision_de_campo",
    "tecnica_de_aplicacion", "tecnica_aplicacion", "digitacion", "entregables"
  )
  for (key in extra_keys) {
    value <- .ficha_tecnica_scalar(ft[[key]], "")
    if (nzchar(value)) values[[key]] <- value
  }
  labels <- .ficha_tecnica_docx_labels()
  out <- data.frame(
    Campo = labels,
    Detalle = vapply(labels, function(label) {
      key <- .ficha_tecnica_norm_field(label)
      .ficha_tecnica_lookup(values, key)
    }, character(1)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  omitted <- .ficha_tecnica_chr_vec(
    ft$campos_omitidos %||% ft$omit_fields %||% ft$ocultar_campos %||% ft$hidden_fields
  )
  omitted <- .ficha_tecnica_norm_field(omitted)
  if (length(omitted)) {
    out <- out[!(.ficha_tecnica_norm_field(out$Campo) %in% omitted), , drop = FALSE]
  }
  out
}

.ficha_tecnica_xml_escape <- function(x) {
  out <- as.character(x %||% "")
  out <- gsub("&", "&amp;", out, fixed = TRUE)
  out <- gsub("<", "&lt;", out, fixed = TRUE)
  out <- gsub(">", "&gt;", out, fixed = TRUE)
  out <- gsub("\"", "&quot;", out, fixed = TRUE)
  out
}

.ficha_tecnica_docx_replace_cell <- function(cell, value) {
  ns_w <- "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  children <- xml2::xml_children(cell)
  if (length(children)) {
    keep <- xml2::xml_name(children) == "tcPr"
    xml2::xml_remove(children[!keep])
  }
  value <- gsub("\\r\\n?", "\n", as.character(value %||% ""))
  lines <- strsplit(value, "\n", fixed = TRUE)[[1]]
  if (!length(lines)) lines <- ""
  for (line in lines) {
    p_xml <- sprintf(
      '<w:p xmlns:w="%s"><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>',
      ns_w,
      .ficha_tecnica_xml_escape(line)
    )
    xml2::xml_add_child(cell, xml2::xml_root(xml2::read_xml(p_xml)))
  }
  invisible(cell)
}

.ficha_tecnica_write_docx_template <- function(rows, template_path, path_docx) {
  if (!requireNamespace("xml2", quietly = TRUE)) {
    stop("Para escribir la ficha tecnica Word desde plantilla se requiere xml2.", call. = FALSE)
  }
  if (!requireNamespace("zip", quietly = TRUE)) {
    stop("Para escribir la ficha tecnica Word desde plantilla se requiere zip.", call. = FALSE)
  }
  if (!file.exists(template_path)) {
    stop(sprintf("No existe la plantilla Word: %s", template_path), call. = FALSE)
  }

  tmp <- tempfile("ficha_tecnica_docx_")
  dir.create(tmp, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(template_path, exdir = tmp)
  doc_xml <- file.path(tmp, "word", "document.xml")
  doc <- xml2::read_xml(doc_xml)
  ns <- xml2::xml_ns(doc)
  table <- xml2::xml_find_first(doc, ".//w:tbl", ns)
  if (inherits(table, "xml_missing")) {
    stop("La plantilla Word no contiene una tabla de ficha tecnica.", call. = FALSE)
  }

  values <- stats::setNames(as.character(rows$Detalle), .ficha_tecnica_norm_field(rows$Campo))
  trs <- xml2::xml_find_all(table, "./w:tr", ns)
  for (tr in trs) {
    cells <- xml2::xml_find_all(tr, "./w:tc", ns)
    if (length(cells) < 2L) next
    label <- .ficha_tecnica_norm_field(xml2::xml_text(cells[[1]]))
    if (!nzchar(label) || !label %in% names(values)) next
    .ficha_tecnica_docx_replace_cell(cells[[2]], values[[label]])
  }
  xml2::write_xml(doc, doc_xml, options = "format")
  settings_xml <- file.path(tmp, "word", "settings.xml")
  if (!file.exists(settings_xml)) {
    writeLines(
      paste0(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'
      ),
      settings_xml,
      useBytes = TRUE
    )
  }

  target_dir <- normalizePath(dirname(path_docx), mustWork = TRUE)
  path_docx <- file.path(target_dir, basename(path_docx))
  if (file.exists(path_docx)) unlink(path_docx)
  old <- setwd(tmp)
  on.exit(setwd(old), add = TRUE)
  files <- list.files(".", recursive = TRUE, all.files = TRUE, no.. = TRUE)
  zip::zipr(zipfile = path_docx, files = files, root = ".", mode = "mirror")
  invisible(path_docx)
}

.ficha_tecnica_logo_path <- function() {
  candidates <- c(
    system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnurapp"),
    system.file("hojas_ruta/assets/logo_pulso.png", package = "prosecnur"),
    file.path(getwd(), "api", "inst", "hojas_ruta", "assets", "logo_pulso.png")
  )
  candidates <- candidates[nzchar(candidates) & file.exists(candidates)]
  if (length(candidates)) candidates[[1]] else ""
}

.ficha_tecnica_bullets <- function(x) {
  lines <- unlist(strsplit(as.character(x %||% ""), "\\r?\\n"), use.names = FALSE)
  lines <- trimws(lines)
  lines <- lines[nzchar(lines)]
  if (!length(lines)) return("")
  lines <- gsub(paste0("^([", "\u2022", "\\-\\*]\\s*)+"), "", lines)
  paste(paste0("\u2022 ", lines), collapse = "\n")
}

.ficha_tecnica_nested_table_text <- function(x) {
  .ficha_tecnica_xml_escape(.ficha_tecnica_scalar(x, ""))
}

.ficha_tecnica_nested_table_cell_xml <- function(value,
                                                 width,
                                                 fill = NULL,
                                                 color = "002060",
                                                 bold = FALSE,
                                                 align = "left",
                                                 font_size = 14L) {
  shade <- if (nzchar(fill %||% "")) sprintf('<w:shd w:fill="%s"/>', fill) else ""
  bold_xml <- if (isTRUE(bold)) "<w:b/>" else ""
  sprintf(
    paste0(
      '<w:tc>',
      '<w:tcPr><w:tcW w:w="%s" w:type="dxa"/>%s',
      '<w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="150" w:type="dxa"/>',
      '<w:bottom w:w="70" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>',
      '<w:vAlign w:val="center"/></w:tcPr>',
      '<w:p><w:pPr><w:jc w:val="%s"/></w:pPr>',
      '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>',
      '<w:sz w:val="%s"/><w:color w:val="%s"/>%s</w:rPr>',
      '<w:t xml:space="preserve">%s</w:t></w:r></w:p>',
      '</w:tc>'
    ),
    as.integer(width),
    shade,
    align,
    as.integer(font_size),
    color,
    bold_xml,
    .ficha_tecnica_nested_table_text(value)
  )
}

.ficha_tecnica_nested_table_xml <- function(df, widths = NULL, font_size = 14L, indent = 180L) {
  if (!is.data.frame(df) || !nrow(df) || !ncol(df)) return(NULL)
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  indent <- suppressWarnings(as.integer(indent))
  if (!is.finite(indent) || indent < 0L) indent <- 0L
  table_width <- max(5600L, 7200L - indent)
  if (is.null(widths) || length(widths) != ncol(df)) {
    widths <- rep(floor(table_width / ncol(df)), ncol(df))
  }
  widths <- as.integer(widths)
  total_width <- sum(widths, na.rm = TRUE)
  if (is.finite(total_width) && total_width > table_width) {
    widths <- pmax(260L, floor(widths * table_width / total_width))
    width_delta <- table_width - sum(widths, na.rm = TRUE)
    widths[[length(widths)]] <- widths[[length(widths)]] + width_delta
  }
  table_width <- sum(widths, na.rm = TRUE)
  headers <- names(df)
  grid <- paste(sprintf('<w:gridCol w:w="%s"/>', widths), collapse = "")
  header_cells <- paste(vapply(seq_along(headers), function(j) {
    .ficha_tecnica_nested_table_cell_xml(
      headers[[j]],
      widths[[j]],
      fill = "002060",
      color = "FFFFFF",
      bold = TRUE,
      align = "center",
      font_size = font_size
    )
  }, character(1)), collapse = "")
  body_rows <- vapply(seq_len(nrow(df)), function(i) {
    cells <- paste(vapply(seq_len(ncol(df)), function(j) {
      value <- df[i, j, drop = TRUE]
      align <- if (grepl("^(Manz\\.|Encuestas|Casos|n|N|%|Etapa|Marco|Muestra|Precisi|Respaldo)$", headers[[j]], ignore.case = TRUE)) "center" else "left"
      .ficha_tecnica_nested_table_cell_xml(value, widths[[j]], align = align, font_size = font_size)
    }, character(1)), collapse = "")
    paste0("<w:tr>", cells, "</w:tr>")
  }, character(1))
  paste0(
    '<w:tbl xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:tblPr>',
    sprintf('<w:tblW w:w="%s" w:type="dxa"/>', as.integer(table_width)),
    sprintf('<w:tblInd w:w="%s" w:type="dxa"/>', as.integer(indent)),
    '<w:tblLayout w:type="fixed"/>',
    '<w:tblBorders>',
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>',
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>',
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>',
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>',
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>',
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>',
    '</w:tblBorders>',
    '</w:tblPr>',
    '<w:tblGrid>', grid, '</w:tblGrid>',
    '<w:tr>', header_cells, '</w:tr>',
    paste(body_rows, collapse = ""),
    '</w:tbl>'
  )
}

.ficha_tecnica_docx_insert_nested_tables <- function(path_docx, subtables = NULL) {
  if (is.null(subtables) || !length(subtables)) return(invisible(path_docx))
  if (!requireNamespace("xml2", quietly = TRUE) || !requireNamespace("zip", quietly = TRUE)) {
    stop("Para insertar subtablas en la ficha tecnica Word se requieren xml2 y zip.", call. = FALSE)
  }
  path_docx <- normalizePath(path_docx, mustWork = TRUE)
  tmp <- tempfile("ficha_nested_docx_")
  dir.create(tmp, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path_docx, exdir = tmp)
  doc_xml <- file.path(tmp, "word", "document.xml")
  doc <- xml2::read_xml(doc_xml)
  ns <- xml2::xml_ns(doc)
  main_tables <- xml2::xml_find_all(doc, ".//w:body/w:tbl", ns)
  for (tbl in main_tables) {
    rows <- xml2::xml_find_all(tbl, "./w:tr", ns)
    for (tr in rows) {
      cells <- xml2::xml_find_all(tr, "./w:tc", ns)
      if (length(cells) < 2L) next
      key <- .ficha_tecnica_norm_field(xml2::xml_text(cells[[1]]))
      spec <- subtables[[key]]
      if (is.null(spec)) next
      nested_df <- spec$data %||% spec$df %||% NULL
      if (!is.data.frame(nested_df) || !nrow(nested_df)) next
      caption <- .ficha_tecnica_scalar(spec$title %||% spec$caption, "")
      if (nzchar(caption)) {
        caption_xml <- sprintf(
          paste0(
            '<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
            '<w:pPr><w:spacing w:before="120" w:after="60"/><w:ind w:left="180"/></w:pPr>',
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>',
            '<w:sz w:val="16"/><w:color w:val="002060"/><w:b/></w:rPr>',
            '<w:t xml:space="preserve">%s</w:t></w:r></w:p>'
          ),
          .ficha_tecnica_xml_escape(caption)
        )
        xml2::xml_add_child(cells[[2]], xml2::xml_root(xml2::read_xml(caption_xml)))
      }
      table_xml <- .ficha_tecnica_nested_table_xml(
        nested_df,
        widths = spec$widths %||% NULL,
        font_size = spec$font_size %||% 14L,
        indent = spec$indent %||% 180L
      )
      if (!is.null(table_xml)) {
        xml2::xml_add_child(cells[[2]], xml2::xml_root(xml2::read_xml(table_xml)))
        xml2::xml_add_child(
          cells[[2]],
          xml2::xml_root(xml2::read_xml('<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'))
        )
      }
    }
  }
  xml2::write_xml(doc, doc_xml, options = "format")
  if (file.exists(path_docx)) unlink(path_docx)
  old <- setwd(tmp)
  on.exit(setwd(old), add = TRUE)
  files <- list.files(".", recursive = TRUE, all.files = TRUE, no.. = TRUE)
  zip::zipr(zipfile = path_docx, files = files, root = ".", mode = "mirror")
  invisible(path_docx)
}

.ficha_tecnica_pulso_table <- function(rows) {
  blue <- "#002060"
  gray <- "#F2F2F2"
  border_dark <- "#111111"
  border_soft <- "#7F7F7F"

  ft <- flextable::flextable(rows[, c("Campo", "Detalle"), drop = FALSE])
  ft <- flextable::delete_part(ft, part = "header")
  ft <- flextable::theme_box(ft)
  ft <- flextable::font(ft, fontname = "Arial", part = "all")
  ft <- flextable::fontsize(ft, size = 10.2, part = "all")
  ft <- flextable::color(ft, color = blue, part = "all")
  ft <- flextable::bg(ft, j = 1, bg = gray, part = "body")
  ft <- flextable::bold(ft, bold = FALSE, part = "all")
  ft <- flextable::padding(ft, padding.top = 6, padding.bottom = 6, padding.left = 6, padding.right = 6, part = "all")
  ft <- flextable::padding(ft, j = 2, padding.left = 10, part = "body")
  ft <- flextable::line_spacing(ft, space = 1.03, part = "all")
  ft <- flextable::align(ft, align = "left", part = "all")
  ft <- flextable::valign(ft, j = 1, valign = "center", part = "body")
  ft <- flextable::valign(ft, j = 2, valign = "top", part = "body")
  ft <- flextable::border_outer(ft, border = officer::fp_border(color = border_dark, width = 0.9), part = "all")
  ft <- flextable::border_inner_h(ft, border = officer::fp_border(color = border_soft, width = 0.55), part = "all")
  ft <- flextable::border_inner_v(ft, border = officer::fp_border(color = border_dark, width = 0.85), part = "all")
  ft <- flextable::width(ft, j = 1, width = 1.65)
  ft <- flextable::width(ft, j = 2, width = 5.35)
  ft <- flextable::set_table_properties(ft, width = 1, layout = "fixed")
  flextable::hrule(ft, rule = "auto", part = "body")
}

.ficha_tecnica_appendix_table <- function(df, font_size = 7.6) {
  blue <- "#002060"
  border_dark <- "#111111"
  border_soft <- "#7F7F7F"
  ft <- flextable::flextable(df)
  header_labels <- stats::setNames(
    gsub("\\s+[0-9]+$", "", names(df)),
    names(df)
  )
  ft <- do.call(flextable::set_header_labels, c(list(x = ft), as.list(header_labels)))
  ft <- flextable::theme_box(ft)
  ft <- flextable::font(ft, fontname = "Arial", part = "all")
  ft <- flextable::fontsize(ft, size = font_size, part = "all")
  ft <- flextable::fontsize(ft, size = font_size + 0.2, part = "header")
  ft <- flextable::color(ft, color = blue, part = "body")
  ft <- flextable::color(ft, color = "#FFFFFF", part = "header")
  ft <- flextable::bg(ft, bg = blue, part = "header")
  ft <- flextable::bold(ft, bold = TRUE, part = "header")
  ft <- flextable::padding(ft, padding.top = 3, padding.bottom = 3, padding.left = 4, padding.right = 4, part = "all")
  ft <- flextable::line_spacing(ft, space = 1.0, part = "all")
  ft <- flextable::align(ft, align = "left", part = "all")
  numeric_cols <- which(grepl("^(Encuestas|%)", names(df)))
  if (length(numeric_cols)) {
    ft <- flextable::align(ft, j = numeric_cols, align = "center", part = "all")
  }
  ft <- flextable::valign(ft, valign = "center", part = "all")
  ft <- flextable::border_outer(ft, border = officer::fp_border(color = border_dark, width = 0.8), part = "all")
  ft <- flextable::border_inner_h(ft, border = officer::fp_border(color = border_soft, width = 0.45), part = "all")
  ft <- flextable::border_inner_v(ft, border = officer::fp_border(color = border_soft, width = 0.45), part = "all")
  for (j in seq_along(names(df))) {
    width <- if (grepl("^Distrito", names(df)[[j]])) {
      2.15
    } else if (grepl("^Encuestas", names(df)[[j]])) {
      0.82
    } else {
      0.42
    }
    ft <- flextable::width(ft, j = j, width = width)
  }
  ft <- flextable::set_table_properties(ft, width = 1, layout = "fixed")
  flextable::hrule(ft, rule = "auto", part = "all")
}

.ficha_tecnica_add_appendices <- function(doc, appendices = NULL) {
  if (is.null(appendices) || !length(appendices)) return(doc)
  blue <- "#002060"
  doc <- officer::body_add_break(doc)
  first <- TRUE
  for (spec in appendices) {
    if (!isTRUE(first)) {
      if (isTRUE(spec$page_break_before)) {
        doc <- officer::body_add_break(doc)
      } else {
        doc <- officer::body_add_par(doc, "", style = "Normal")
      }
    }
    first <- FALSE
    title <- .ficha_tecnica_scalar(spec$title, "")
    if (nzchar(title)) {
      doc <- officer::body_add_fpar(
        doc,
        officer::fpar(
          officer::ftext(
            title,
            prop = officer::fp_text(font.size = 12, bold = TRUE, font.family = "Arial", color = blue)
          ),
          fp_p = officer::fp_par(text.align = "left", padding.bottom = 4)
        )
      )
    }
    note <- .ficha_tecnica_scalar(spec$note, "")
    if (nzchar(note)) {
      doc <- officer::body_add_fpar(
        doc,
        officer::fpar(
          officer::ftext(
            note,
            prop = officer::fp_text(font.size = 9, font.family = "Arial", color = blue)
          ),
          fp_p = officer::fp_par(text.align = "left", padding.bottom = 6)
        )
      )
    }
    appendix_df <- spec$data %||% spec$df %||% NULL
    if (is.data.frame(appendix_df) && nrow(appendix_df)) {
      doc <- flextable::body_add_flextable(
        doc,
        .ficha_tecnica_appendix_table(appendix_df, font_size = spec$font_size %||% 7.6)
      )
    }
  }
  doc
}

.ficha_tecnica_pulso_groups <- function(rows) {
  labels <- .ficha_tecnica_docx_labels()
  groups <- list(
    labels[1:8],
    labels[9],
    labels[10:11],
    labels[12],
    labels[13:16],
    labels[17:length(labels)]
  )
  out <- lapply(groups, function(group_labels) {
    idx <- match(group_labels, rows$Campo)
    idx <- idx[!is.na(idx)]
    rows[idx, , drop = FALSE]
  })
  Filter(function(x) nrow(x) > 0L, out)
}

.ficha_tecnica_write_docx_pulso <- function(rows, path_docx, subtables = NULL, appendices = NULL) {
  if (!requireNamespace("officer", quietly = TRUE) ||
      !requireNamespace("flextable", quietly = TRUE)) {
    stop("Para generar ficha tecnica Word se requieren officer y flextable.", call. = FALSE)
  }

  rows <- rows[, c("Campo", "Detalle"), drop = FALSE]
  rows$Detalle <- as.character(rows$Detalle)
  rows$Detalle[rows$Campo == "Entregables"] <- vapply(
    rows$Detalle[rows$Campo == "Entregables"],
    .ficha_tecnica_bullets,
    character(1)
  )

  blue <- "#002060"

  header_default <- officer::block_list(
    officer::fpar(
      officer::ftext(
        "Ficha T\u00e9cnica Pulso-PUCP",
        prop = officer::fp_text(font.size = 8.5, font.family = "Arial", color = "#808080")
      ),
      fp_p = officer::fp_par(
        text.align = "right",
        border.bottom = officer::fp_border(color = "#BFBFBF", width = 0.6),
        padding.bottom = 3
      )
    )
  )
  section <- officer::prop_section(
    page_size = officer::page_size(width = 8.27, height = 11.69, orient = "portrait"),
    page_margins = officer::page_mar(
      top = 0.68,
      bottom = 0.70,
      left = 0.78,
      right = 0.78,
      header = 0.36,
      footer = 0.35
    ),
    header_default = header_default,
    header_first = officer::block_list(officer::fpar(""))
  )

  doc <- officer::read_docx()
  doc <- officer::body_set_default_section(doc, section)

  logo <- .ficha_tecnica_logo_path()
  if (nzchar(logo)) {
    doc <- officer::body_add_img(doc, src = logo, width = 1.65, height = 0.60, style = "Normal")
  } else {
    doc <- officer::body_add_par(doc, "", style = "Normal")
  }
  doc <- officer::body_add_par(doc, "", style = "Normal")
  doc <- officer::body_add_fpar(
    doc,
    officer::fpar(
      officer::ftext(
        "FICHA T\u00c9CNICA",
        prop = officer::fp_text(font.size = 18, font.family = "Arial", color = blue)
      ),
      fp_p = officer::fp_par(text.align = "center", padding.bottom = 10)
    )
  )

  groups <- .ficha_tecnica_pulso_groups(rows)
  for (i in seq_along(groups)) {
    if (i > 1L) {
      doc <- officer::body_add_break(doc)
      doc <- officer::body_add_par(doc, "", style = "Normal")
      doc <- officer::body_add_par(doc, "", style = "Normal")
    }
    doc <- flextable::body_add_flextable(doc, .ficha_tecnica_pulso_table(groups[[i]]))
  }
  doc <- .ficha_tecnica_add_appendices(doc, appendices)
  print(doc, target = path_docx)
  .ficha_tecnica_docx_insert_nested_tables(path_docx, subtables)
  invisible(path_docx)
}

.ficha_tecnica_write_docx_fallback <- function(rows, path_docx) {
  if (!requireNamespace("officer", quietly = TRUE) ||
      !requireNamespace("flextable", quietly = TRUE)) {
    stop("Para generar ficha tecnica Word se requieren officer y flextable.", call. = FALSE)
  }
  doc <- officer::read_docx()
  title <- officer::fpar(
    officer::ftext(
      "FICHA T\u00c9CNICA",
      prop = officer::fp_text(font.size = 18, bold = TRUE, font.family = "Arial", color = "#0B2545")
    ),
    fp_p = officer::fp_par(text.align = "center", padding.bottom = 12)
  )
  doc <- officer::body_add_fpar(doc, title)
  ft <- flextable::flextable(rows)
  ft <- flextable::delete_part(ft, part = "header")
  ft <- flextable::font(ft, fontname = "Arial", part = "all")
  ft <- flextable::fontsize(ft, size = 9.5, part = "all")
  ft <- flextable::bold(ft, j = 1, bold = TRUE, part = "body")
  ft <- flextable::bg(ft, j = 1, bg = "#F2F2F2", part = "body")
  ft <- flextable::color(ft, j = 1, color = "#1F4D78", part = "body")
  ft <- flextable::border_outer(ft, border = officer::fp_border(color = "#CBD5E1", width = 0.7), part = "all")
  ft <- flextable::border_inner(ft, border = officer::fp_border(color = "#CBD5E1", width = 0.5), part = "all")
  ft <- flextable::padding(ft, padding = 5, part = "all")
  ft <- flextable::width(ft, j = 1, width = 2.1)
  ft <- flextable::width(ft, j = 2, width = 4.4)
  ft <- flextable::valign(ft, valign = "top", part = "all")
  doc <- flextable::body_add_flextable(doc, ft)
  print(doc, target = path_docx)
  invisible(path_docx)
}

.ficha_tecnica_fmt_int <- function(x) {
  x <- suppressWarnings(as.numeric(x))
  if (!is.finite(x)) return("0")
  format(round(x), big.mark = ",", scientific = FALSE, trim = TRUE)
}

.ficha_tecnica_fmt_int_blank <- function(x, fallback = "") {
  x <- suppressWarnings(as.numeric(x))
  if (!is.finite(x)) return(fallback)
  format(round(x), big.mark = ",", scientific = FALSE, trim = TRUE)
}

.ficha_tecnica_fmt_pct <- function(x) {
  x <- suppressWarnings(as.numeric(x))
  if (!is.finite(x)) return("")
  sprintf("%.0f%%", x * 100)
}

.ficha_tecnica_fmt_pct_blank <- function(x, fallback = "") {
  x <- suppressWarnings(as.numeric(x))
  if (!is.finite(x)) return(fallback)
  sprintf("%.0f%%", x * 100)
}

.ficha_tecnica_title_case_es <- function(x) {
  x <- trimws(as.character(x %||% ""))
  x <- x[!is.na(x) & nzchar(x)]
  if (!length(x)) return(character(0))
  official_names <- c(
    san_martin_de_porres = "San Martín de Porres",
    villa_maria_del_triunfo = "Villa María del Triunfo",
    jesus_maria = "Jesús María",
    rimac = "Rímac",
    brena = "Breña"
  )
  keys <- .ficha_tecnica_norm_field(x)
  out <- tools::toTitleCase(tolower(x))
  out <- vapply(seq_along(out), function(i) {
    mapped <- unname(official_names[keys[[i]]])
    if (!is.na(mapped) && nzchar(mapped)) return(mapped)
    out[[i]]
  }, character(1), USE.NAMES = FALSE)
  vapply(out, function(value) {
    parts <- strsplit(value, "\\s+", perl = TRUE)[[1]]
    if (length(parts) > 1L) {
      lower_words <- c("De", "Del", "La", "Las", "Los", "Y")
      hit <- seq_along(parts) > 1L & parts %in% lower_words
      parts[hit] <- tolower(parts[hit])
    }
    paste(parts, collapse = " ")
  }, character(1), USE.NAMES = FALSE)
}

.ficha_tecnica_join_sentence <- function(x) {
  x <- unique(trimws(as.character(x %||% "")))
  x <- x[!is.na(x) & nzchar(x)]
  if (!length(x)) return("")
  if (length(x) == 1L) return(x[[1]])
  if (length(x) == 2L) return(paste(x, collapse = " y "))
  paste0(paste(x[-length(x)], collapse = ", "), " y ", x[[length(x)]])
}

.ficha_tecnica_district_names <- function(distribution) {
  if (!is.data.frame(distribution) || !nrow(distribution) || !"distrito" %in% names(distribution)) {
    return(character(0))
  }
  .ficha_tecnica_title_case_es(distribution$distrito)
}

.ficha_tecnica_first_nonempty <- function(...) {
  values <- list(...)
  for (value in values) {
    out <- .ficha_tecnica_scalar(value, "")
    if (nzchar(out)) return(out)
  }
  ""
}

.ficha_tecnica_parse_date_vector <- function(x) {
  if (is.null(x) || length(x) == 0L) return(as.Date(character(0)))
  if (inherits(x, "Date")) return(as.Date(x))
  if (inherits(x, c("POSIXct", "POSIXt"))) return(as.Date(x))
  if (is.numeric(x)) {
    out <- rep(as.Date(NA), length(x))
    plausible <- is.finite(x) & x > 20000 & x < 70000
    out[plausible] <- as.Date(x[plausible], origin = "1899-12-30")
    return(out)
  }
  raw <- trimws(as.character(x))
  raw[raw %in% c("", "NA", "NaN", "NULL")] <- NA_character_
  raw <- chartr("/", ".", raw)
  out <- rep(as.Date(NA), length(raw))
  for (i in seq_along(raw)) {
    value <- raw[[i]]
    if (is.na(value) || !nzchar(value)) next
    if (grepl("^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$", value)) {
      out[[i]] <- suppressWarnings(as.Date(value))
      next
    }
    parts <- strsplit(value, ".", fixed = TRUE)[[1]]
    if (length(parts) != 3L || !all(grepl("^[0-9]+$", parts))) next
    year <- suppressWarnings(as.integer(parts[[3]]))
    if (!is.na(year) && year < 100L) year <- 2000L + year
    candidate <- suppressWarnings(as.Date(sprintf(
      "%04d-%02d-%02d",
      year,
      as.integer(parts[[2]]),
      as.integer(parts[[1]])
    )))
    if (!is.na(candidate)) out[[i]] <- candidate
  }
  out
}

.ficha_tecnica_date_label <- function(x) {
  date <- .ficha_tecnica_parse_date_vector(x)
  date <- date[!is.na(date)]
  if (!length(date)) return("")
  meses <- c(
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  )
  d <- date[[1]]
  sprintf("%s de %s de %s", format(d, "%d"), meses[[as.integer(format(d, "%m"))]], format(d, "%Y"))
}

.ficha_tecnica_date_range_label <- function(start = NULL, end = NULL) {
  s <- .ficha_tecnica_date_label(start)
  e <- .ficha_tecnica_date_label(end)
  if (nzchar(s) && nzchar(e)) {
    if (identical(s, e)) return(s)
    return(sprintf("%s al %s", s, e))
  }
  if (nzchar(s)) return(s)
  if (nzchar(e)) return(e)
  ""
}

.ficha_tecnica_human_var <- function(x) {
  key <- .ficha_tecnica_norm_field(x)
  switch(
    key,
    distrito = "distrito",
    zona = "zona censal",
    territorio_muestral = "territorio muestral",
    rango_edad = "rango de edad",
    edad = "edad",
    sexo = "sexo",
    viviendas = "viviendas",
    poblacion = "población",
    .ficha_tecnica_scalar(x, "")
  )
}

.ficha_tecnica_age_range_labels <- function(ranges) {
  if (!is.list(ranges) || !length(ranges)) return(character(0))
  labels <- vapply(ranges, function(item) {
    label <- .ficha_tecnica_scalar(item$label, "")
    if (nzchar(label)) return(label)
    min_age <- suppressWarnings(as.numeric(item$min %||% NA))
    max_age <- suppressWarnings(as.numeric(item$max %||% NA))
    if (is.finite(min_age) && is.finite(max_age)) {
      return(sprintf("%s-%s", .ficha_tecnica_fmt_int(min_age), .ficha_tecnica_fmt_int(max_age)))
    }
    if (is.finite(min_age)) return(sprintf("%s+", .ficha_tecnica_fmt_int(min_age)))
    ""
  }, character(1))
  labels[nzchar(labels)]
}

.ficha_tecnica_route_description <- function(summary) {
  mode <- .ficha_tecnica_norm_field(summary$route_jump_mode %||% "")
  if (identical(mode, "off") || identical(mode, "sin_salto") || !nzchar(mode)) {
    return("recorrido operativo controlado, con punto de arranque y sentido de recorrido previamente definidos")
  }
  jump <- suppressWarnings(as.numeric(summary$route_jump_manual %||% NA))
  if (is.finite(jump) && jump > 1) {
    return(sprintf(
      "recorrido sistemático de viviendas con salto operativo de %s unidades y punto de arranque previamente definido",
      .ficha_tecnica_fmt_int(jump)
    ))
  }
  "recorrido operativo controlado de viviendas"
}

.ficha_tecnica_quota_description <- function(summary) {
  vars <- c(
    .ficha_tecnica_human_var(summary$col_var %||% ""),
    .ficha_tecnica_human_var(summary$subquota_var %||% "")
  )
  vars <- vars[nzchar(vars)]
  if (!length(vars)) return("los criterios de elegibilidad del cuestionario")
  ranges <- .ficha_tecnica_age_range_labels(summary$age_ranges %||% list())
  suffix <- if (length(ranges)) sprintf(" (%s)", paste(ranges, collapse = ", ")) else ""
  sprintf("cuotas de %s%s", paste(unique(vars), collapse = " y "), suffix)
}

.ficha_tecnica_calc_method_label <- function(x) {
  key <- .ficha_tecnica_norm_field(x)
  switch(
    key,
    prob_aleatorio_simple = "muestreo aleatorio simple",
    prob_estratificado = "muestreo estratificado proporcional",
    prob_estratificado_independiente = "muestreo estratificado por dominios independientes",
    prob_conglomerado_multietapico = "muestreo por conglomerados multietápico",
    sistematico = "muestreo sistemático",
    medicion_recurrente = "medición recurrente",
    barrido = "barrido operativo",
    intencion_censal = "intención censal",
    listado_externo_meta_fija = "listado externo con meta fija",
    no_prob_conveniencia = "muestra no probabilística por conveniencia",
    no_prob_cuotas = "muestra no probabilística por cuotas",
    .ficha_tecnica_scalar(x, "")
  )
}

.ficha_tecnica_calc_inference_label <- function(x) {
  key <- .ficha_tecnica_norm_field(x)
  switch(
    key,
    representatividad_estadistica = "representatividad estadística",
    representatividad_operacional = "representatividad operacional",
    representatividad_teorica_controlada = "representatividad teórica controlada",
    cobertura_balanceada = "cobertura balanceada",
    evidencia_descriptiva = "evidencia descriptiva",
    .ficha_tecnica_scalar(x, "")
  )
}

.ficha_tecnica_list_value <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NA_character_)
  out <- unlist(x, use.names = FALSE)
  if (!length(out)) return(NA_character_)
  paste(as.character(out), collapse = ", ")
}

.ficha_tecnica_list_rows <- function(items) {
  if (!is.list(items) || !length(items)) return(data.frame())
  keys <- unique(unlist(lapply(items, names), use.names = FALSE))
  if (!length(keys)) return(data.frame())
  rows <- lapply(items, function(item) {
    values <- vapply(keys, function(key) .ficha_tecnica_list_value(item[[key]]), character(1))
    stats::setNames(as.data.frame(as.list(values), stringsAsFactors = FALSE), keys)
  })
  do.call(rbind, rows)
}

.ficha_tecnica_calc_study <- function(context = NULL) {
  if (is.null(context)) return(NULL)
  if (is.list(context$calc_muestra_estudio)) return(context$calc_muestra_estudio)
  if (is.list(context$estudio) && !is.null(context$estudio$componentes)) return(context$estudio)
  if (is.list(context$calculo_muestra) && !is.null(context$calculo_muestra$componentes)) return(context$calculo_muestra)
  if (is.list(context$componentes)) return(context)
  NULL
}

.ficha_tecnica_calc_component_label <- function(comp, index) {
  value <- .ficha_tecnica_first_nonempty(
    comp$actor,
    comp$nombre,
    comp$label,
    comp$titulo,
    comp$id
  )
  if (nzchar(value)) value else sprintf("Componente %s", index)
}

.ficha_tecnica_calc_component_rows <- function(components) {
  if (!is.list(components) || !length(components)) return(data.frame())
  rows <- lapply(seq_along(components), function(i) {
    comp <- components[[i]] %||% list()
    marco <- comp$marco %||% list()
    params <- comp$parametros %||% list()
    result <- comp$resultado %||% list()
    inference <- result$inferencia %||% list()
    marco_n <- marco$marco_validado %||% marco$marco_contactable %||% marco$universo_bruto %||% NA
    n_obj <- result$n_objetivo %||% result$n_teorico %||% result$n %||% (comp$meta %||% list())$valor %||% NA
    n_op <- result$n_operativo %||% NA
    precision <- result$precision_alcanzada %||% params$e %||% NA
    data.frame(
      Componente = .ficha_tecnica_calc_component_label(comp, i),
      Técnica = .ficha_tecnica_calc_method_label(result$tecnica %||% comp$tecnica),
      Marco = .ficha_tecnica_fmt_int_blank(marco_n),
      `Muestra objetivo` = .ficha_tecnica_fmt_int_blank(n_obj),
      `Muestra operativa` = .ficha_tecnica_fmt_int_blank(n_op),
      `Precisión estimada` = if (is.finite(suppressWarnings(as.numeric(precision)))) {
        paste0("±", .ficha_tecnica_fmt_pct_blank(precision))
      } else {
        ""
      },
      `Alcance inferencial` = .ficha_tecnica_calc_inference_label(inference$nivel_respaldo %||% inference$respaldo),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  out <- do.call(rbind, rows)
  out[rowSums(out[, c("Marco", "Muestra objetivo", "Muestra operativa"), drop = FALSE] != "") > 0L, , drop = FALSE]
}

.ficha_tecnica_calc_distribution_table <- function(comp, index) {
  result <- (comp %||% list())$resultado %||% list()
  dist <- result$distribucion_estratos %||% result$distribucion_sub %||% list()
  df <- .ficha_tecnica_list_rows(dist)
  if (!is.data.frame(df) || !nrow(df)) return(NULL)
  estrato <- if ("estrato" %in% names(df)) df$estrato else df[[1]]
  sub <- if ("sub" %in% names(df)) df$sub else NULL
  n_col <- if ("n" %in% names(df)) df$n else if ("cuota" %in% names(df)) df$cuota else NA
  N_col <- if ("N" %in% names(df)) df$N else NA
  precision <- if ("precision_e" %in% names(df)) df$precision_e else NA
  etiqueta <- as.character(estrato)
  if (!is.null(sub)) etiqueta <- paste(etiqueta, as.character(sub), sep = " - ")
  total_n <- sum(suppressWarnings(as.numeric(n_col)), na.rm = TRUE)
  out <- data.frame(
    Estrato = etiqueta,
    Marco = vapply(N_col, .ficha_tecnica_fmt_int_blank, character(1)),
    Muestra = vapply(n_col, .ficha_tecnica_fmt_int_blank, character(1)),
    `% muestra` = if (is.finite(total_n) && total_n > 0) {
      vapply(suppressWarnings(as.numeric(n_col)) / total_n, .ficha_tecnica_fmt_pct_blank, character(1))
    } else {
      rep("", length(etiqueta))
    },
    Precisión = vapply(precision, function(x) {
      if (is.finite(suppressWarnings(as.numeric(x)))) paste0("±", .ficha_tecnica_fmt_pct_blank(x)) else ""
    }, character(1)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  out[rowSums(out[, c("Marco", "Muestra"), drop = FALSE] != "") > 0L, , drop = FALSE]
}

.ficha_tecnica_calc_muestra_summary <- function(context = NULL) {
  study <- .ficha_tecnica_calc_study(context)
  if (is.null(study)) return(NULL)
  components <- study$componentes %||% list()
  if (!length(components)) return(NULL)
  rows <- .ficha_tecnica_calc_component_rows(components)
  if (!is.data.frame(rows) || !nrow(rows)) return(NULL)
  numeric_value <- function(x) suppressWarnings(as.numeric(gsub(",", "", as.character(x))))
  n_obj <- numeric_value(rows$`Muestra objetivo`)
  n_op <- numeric_value(rows$`Muestra operativa`)
  marco <- numeric_value(rows$Marco)
  methods <- unique(rows$Técnica[nzchar(rows$Técnica)])
  params <- lapply(components, function(comp) (comp %||% list())$parametros %||% list())
  get_param <- function(key) {
    values <- vapply(params, function(p) .ficha_tecnica_scalar(p[[key]], ""), character(1))
    values[nzchar(values)]
  }
  list(
    title = .ficha_tecnica_scalar(study$titulo, "Cálculo muestral"),
    macro_familia = .ficha_tecnica_scalar(study$macro_familia, ""),
    modo_trabajo = .ficha_tecnica_scalar(study$modo_trabajo, ""),
    n_componentes = length(components),
    rows = rows,
    total_n_objetivo = sum(n_obj, na.rm = TRUE),
    total_n_operativo = sum(n_op, na.rm = TRUE),
    total_marco = sum(marco, na.rm = TRUE),
    methods = methods,
    z = unique(get_param("z")),
    p = unique(get_param("p")),
    e = unique(get_param("e")),
    deff = unique(get_param("deff")),
    oversample_pct = unique(get_param("oversample_pct")),
    components = components
  )
}

.ficha_tecnica_calc_muestra_texts <- function(summary) {
  if (is.null(summary) || !is.data.frame(summary$rows) || !nrow(summary$rows)) return(list())
  methods_txt <- if (length(summary$methods)) paste(summary$methods, collapse = ", ") else "las técnicas definidas para el estudio"
  marco <- if (is.finite(summary$total_marco) && summary$total_marco > 0) {
    sprintf(
      "El marco muestral considerado contiene %s unidades válidas distribuidas en %s componente(s) de análisis.",
      .ficha_tecnica_fmt_int(summary$total_marco),
      .ficha_tecnica_fmt_int(summary$n_componentes)
    )
  } else {
    ""
  }
  tamano <- sprintf(
    paste0(
      "El diseño muestral considera %s componente(s) de análisis. ",
      "La muestra objetivo acumulada es de %s casos y la muestra operativa, cuando corresponde, asciende a %s casos. ",
      "La tabla incorporada documenta el marco, la técnica de selección, la muestra prevista, la muestra operativa y la precisión estimada por componente."
    ),
    .ficha_tecnica_fmt_int(summary$n_componentes),
    .ficha_tecnica_fmt_int(summary$total_n_objetivo),
    .ficha_tecnica_fmt_int(summary$total_n_operativo)
  )
  procedimiento <- sprintf(
    paste0(
      "El procedimiento muestral se definió a partir de %s. ",
      "Para cada componente se documentó la técnica de selección, el marco de referencia, ",
      "los parámetros de precisión y el alcance inferencial declarado."
    ),
    methods_txt
  )
  params_bits <- c(
    if (length(summary$z)) sprintf("valor crítico %s", paste(summary$z, collapse = "/")) else NULL,
    if (length(summary$p)) sprintf("proporción esperada %s", paste(summary$p, collapse = "/")) else NULL,
    if (length(summary$e)) sprintf("margen de error %s", paste(vapply(summary$e, function(x) .ficha_tecnica_fmt_pct_blank(x, x), character(1)), collapse = "/")) else NULL,
    if (length(summary$deff)) sprintf("efecto de diseño %s", paste(summary$deff, collapse = "/")) else NULL,
    if (length(summary$oversample_pct)) sprintf("sobremuestra prevista %s", paste(vapply(summary$oversample_pct, function(x) .ficha_tecnica_fmt_pct_blank(x, x), character(1)), collapse = "/")) else NULL
  )
  nivel <- if (length(params_bits)) {
    sprintf(
      "Los supuestos del cálculo muestral registrados por componente incluyen %s. La interpretación de representatividad depende de la técnica asignada a cada componente.",
      paste(params_bits, collapse = ", ")
    )
  } else {
    ""
  }
  out <- list(
    tamano_de_la_muestra = tamano,
    procedimiento_muestreo = procedimiento
  )
  if (nzchar(marco)) out$marco_muestral <- marco
  if (nzchar(nivel)) out$nivel_representatividad <- nivel
  out
}

.ficha_tecnica_calc_muestra_subtables <- function(summary) {
  if (is.null(summary) || !is.data.frame(summary$rows) || !nrow(summary$rows)) return(list())
  list(
    tamano_de_la_muestra = list(
      title = "Componentes del cálculo muestral",
      data = summary$rows,
      widths = c(1480, 1600, 760, 850, 850, 760, 900),
      font_size = 13L
    )
  )
}

.ficha_tecnica_calc_muestra_appendices <- function(summary) {
  if (is.null(summary) || !length(summary$components)) return(list())
  appendices <- list()
  for (i in seq_along(summary$components)) {
    comp <- summary$components[[i]]
    table <- .ficha_tecnica_calc_distribution_table(comp, i)
    if (!is.data.frame(table) || !nrow(table)) next
    label <- .ficha_tecnica_calc_component_label(comp, i)
    key <- paste0("calc_muestra_distribucion_", i)
    appendices[[key]] <- list(
      title = sprintf("Distribución muestral por estrato - %s", label),
      note = "La tabla resume la distribución muestral prevista para el componente seleccionado.",
      data = table,
      font_size = 8.0
    )
  }
  appendices
}

.ficha_tecnica_panel_date_column <- function(df, wave = list(), panel = list()) {
  configured <- c(
    wave$date_variable,
    wave$fecha_variable,
    wave$field_date_variable,
    panel$date_variable,
    panel$fecha_variable,
    panel$field_date_variable
  )
  configured <- .ficha_tecnica_chr_vec(configured)
  configured <- configured[configured %in% names(df)]
  if (length(configured)) return(configured[[1]])
  normalized <- stats::setNames(.ficha_tecnica_norm_field(names(df)), names(df))
  priority <- c(
    "fecha",
    "fecha_encuesta",
    "fecha_aplicacion",
    "fecha_campo",
    "survey_date",
    "submission_date",
    "submitted_at",
    "today"
  )
  for (candidate in priority) {
    hit <- names(normalized)[normalized == candidate]
    if (length(hit)) return(hit[[1]])
  }
  hit <- names(normalized)[grepl("fecha|date", normalized)]
  if (length(hit)) hit[[1]] else ""
}

.ficha_tecnica_panel_wave_dates <- function(df, wave = list(), panel = list()) {
  explicit_start <- .ficha_tecnica_first_nonempty(
    wave$date_start,
    wave$fecha_inicio,
    wave$fieldwork_start,
    wave$inicio_campo
  )
  explicit_end <- .ficha_tecnica_first_nonempty(
    wave$date_end,
    wave$fecha_fin,
    wave$fieldwork_end,
    wave$fin_campo
  )
  if (nzchar(explicit_start) || nzchar(explicit_end)) {
    range <- .ficha_tecnica_date_range_label(explicit_start, explicit_end)
    var <- .ficha_tecnica_panel_date_column(df, wave, panel)
    n_registrada <- suppressWarnings(as.numeric(wave$n_fecha_registrada %||% NA))
    n_valida <- suppressWarnings(as.numeric(wave$n_fecha_valida %||% NA))
    observacion <- .ficha_tecnica_first_nonempty(
      wave$observacion_fecha,
      wave$date_observation,
      "Rango declarado en la configuración metodológica de la medición."
    )
    if (nzchar(var) && var %in% names(df)) {
      raw <- df[[var]]
      nonmissing <- !is.na(raw) & nzchar(trimws(as.character(raw)))
      parsed <- .ficha_tecnica_parse_date_vector(raw)
      valid <- !is.na(parsed)
      start_date <- .ficha_tecnica_parse_date_vector(explicit_start)
      end_date <- .ficha_tecnica_parse_date_vector(explicit_end)
      start_date <- if (length(start_date)) start_date[[1]] else as.Date(NA)
      end_date <- if (length(end_date)) end_date[[1]] else as.Date(NA)
      inside <- valid
      if (!is.na(start_date)) inside <- inside & parsed >= start_date
      if (!is.na(end_date)) inside <- inside & parsed <= end_date
      if (!is.finite(n_registrada)) n_registrada <- sum(nonmissing)
      if (!is.finite(n_valida)) n_valida <- sum(inside)
      invalid <- sum(nonmissing) - sum(valid)
      outside <- sum(valid & !inside)
      obs_bits <- c(
        if (invalid > 0L) sprintf("%s valor(es) de fecha no pudieron interpretarse.", .ficha_tecnica_fmt_int(invalid)) else NULL,
        if (outside > 0L) sprintf("%s fecha(s) interpretables quedan fuera del rango declarado y se reportan como atípicas.", .ficha_tecnica_fmt_int(outside)) else NULL
      )
      if (length(obs_bits)) observacion <- paste(observacion, paste(obs_bits, collapse = " "))
    }
    return(list(
      variable = var,
      n_fecha_registrada = as.integer(n_registrada),
      n_fecha_valida = as.integer(n_valida),
      rango = range,
      observacion_fecha = observacion
    ))
  }

  var <- .ficha_tecnica_panel_date_column(df, wave, panel)
  if (!nzchar(var) || !var %in% names(df)) {
    return(list(
      variable = "",
      n_fecha_registrada = 0L,
      n_fecha_valida = 0L,
      rango = "",
      observacion_fecha = "No se detectó una variable de fecha para esta medición."
    ))
  }
  raw <- df[[var]]
  nonmissing <- !is.na(raw) & nzchar(trimws(as.character(raw)))
  parsed <- .ficha_tecnica_parse_date_vector(raw)
  valid <- !is.na(parsed)
  valid_dates <- parsed[valid]
  range <- if (length(valid_dates)) {
    .ficha_tecnica_date_range_label(min(valid_dates), max(valid_dates))
  } else {
    ""
  }
  years <- format(valid_dates, "%Y")
  dominant_year <- if (length(years)) names(sort(table(years), decreasing = TRUE))[[1]] else ""
  outside_dominant <- if (nzchar(dominant_year)) sum(years != dominant_year, na.rm = TRUE) else 0L
  invalid <- sum(nonmissing) - sum(valid)
  obs <- c(
    if (sum(nonmissing) == 0L) "La variable de fecha no contiene valores registrados." else NULL,
    if (invalid > 0L) sprintf("%s valor(es) de fecha no pudieron interpretarse.", .ficha_tecnica_fmt_int(invalid)) else NULL,
    if (outside_dominant > 0L) sprintf("%s fecha(s) quedan fuera del año dominante %s.", .ficha_tecnica_fmt_int(outside_dominant), dominant_year) else NULL
  )
  list(
    variable = var,
    n_fecha_registrada = sum(nonmissing),
    n_fecha_valida = sum(valid),
    rango = range,
    observacion_fecha = if (length(obs)) paste(obs, collapse = " ") else "Rango inferido desde la variable de fecha registrada en la base."
  )
}

.ficha_tecnica_panel_measurement_label <- function(i) {
  labels <- c(
    "Primera medición", "Segunda medición", "Tercera medición",
    "Cuarta medición", "Quinta medición", "Sexta medición"
  )
  if (i <= length(labels)) labels[[i]] else sprintf("Medición %s", .ficha_tecnica_fmt_int(i))
}

.ficha_tecnica_distribution_standardize <- function(distribution) {
  if (!is.data.frame(distribution) && is.list(distribution)) {
    distribution <- .ficha_tecnica_list_rows(distribution)
  }
  if (!is.data.frame(distribution) || !nrow(distribution)) return(data.frame())
  normalized <- stats::setNames(.ficha_tecnica_norm_field(names(distribution)), names(distribution))
  district_col <- names(normalized)[normalized %in% c(
    "distrito", "distrito_nombre", "nombre_distrito", "distrito_asignado",
    "territorio", "ambito"
  )][1]
  count_col <- names(normalized)[normalized %in% c(
    "entrevistas", "encuestas", "casos", "n", "frecuencia", "total"
  )][1]
  pct_col <- names(normalized)[normalized %in% c(
    "porcentaje", "pct", "peso", "proporcion"
  )][1]
  if (is.na(district_col) || !nzchar(district_col)) return(data.frame())
  out <- data.frame(
    distrito = trimws(as.character(distribution[[district_col]])),
    stringsAsFactors = FALSE
  )
  out$distrito[is.na(out$distrito) | !nzchar(out$distrito)] <- "Sin distrito asignado"
  if (!is.na(count_col) && nzchar(count_col)) {
    out$entrevistas <- suppressWarnings(as.numeric(distribution[[count_col]]))
  } else {
    out$entrevistas <- 1
  }
  out$entrevistas[is.na(out$entrevistas)] <- 0
  out <- stats::aggregate(entrevistas ~ distrito, data = out, sum, na.rm = TRUE)
  out <- out[out$entrevistas > 0, , drop = FALSE]
  if (!nrow(out)) return(data.frame())
  if (!is.na(pct_col) && nzchar(pct_col) && nrow(out) == nrow(distribution)) {
    pct_values <- suppressWarnings(as.numeric(distribution[[pct_col]]))
    if (any(is.finite(pct_values))) {
      pct_df <- data.frame(
        distrito = trimws(as.character(distribution[[district_col]])),
        porcentaje = pct_values,
        stringsAsFactors = FALSE
      )
      pct_df$distrito[is.na(pct_df$distrito) | !nzchar(pct_df$distrito)] <- "Sin distrito asignado"
      pct_df <- stats::aggregate(porcentaje ~ distrito, data = pct_df, sum, na.rm = TRUE)
      out$porcentaje <- pct_df$porcentaje[match(out$distrito, pct_df$distrito)]
    }
  }
  if (!"porcentaje" %in% names(out) || all(!is.finite(out$porcentaje))) {
    total <- sum(out$entrevistas, na.rm = TRUE)
    out$porcentaje <- if (total > 0) out$entrevistas / total else NA_real_
  }
  out <- out[order(-out$entrevistas, out$distrito), , drop = FALSE]
  rownames(out) <- NULL
  out
}

.ficha_tecnica_panel_district_column <- function(df) {
  if (!is.data.frame(df) || !ncol(df)) return("")
  normalized <- stats::setNames(.ficha_tecnica_norm_field(names(df)), names(df))
  priority <- c(
    "distrito", "distrito_nombre", "nombre_distrito", "distrito_asignado",
    "distrito_encuesta", "distrito_residencia"
  )
  for (candidate in priority) {
    hit <- names(normalized)[normalized == candidate]
    if (length(hit)) return(hit[[1]])
  }
  hit <- names(normalized)[grepl("^distrito($|_)", normalized)]
  if (length(hit)) hit[[1]] else ""
}

.ficha_tecnica_panel_distribution <- function(df = NULL, wave = list()) {
  explicit <- wave$district_distribution %||%
    wave$distribucion_distrito %||%
    wave$distribucion_distrital %||%
    wave$distribucion %||%
    NULL
  explicit <- .ficha_tecnica_distribution_standardize(explicit)
  if (is.data.frame(explicit) && nrow(explicit)) return(explicit)

  col <- .ficha_tecnica_panel_district_column(df)
  if (!nzchar(col) || !col %in% names(df)) return(data.frame())
  raw <- trimws(as.character(df[[col]]))
  has_district <- !is.na(raw) & nzchar(raw)
  if (!any(has_district)) return(data.frame())
  raw[!has_district] <- "Sin distrito asignado"
  tab <- as.data.frame(table(raw, useNA = "no"), stringsAsFactors = FALSE)
  names(tab) <- c("distrito", "entrevistas")
  tab$entrevistas <- as.numeric(tab$entrevistas)
  total <- sum(tab$entrevistas, na.rm = TRUE)
  tab$porcentaje <- if (total > 0) tab$entrevistas / total else NA_real_
  tab <- tab[order(-tab$entrevistas, tab$distrito), , drop = FALSE]
  rownames(tab) <- NULL
  tab
}

.ficha_tecnica_panel_summary <- function(context = NULL) {
  if (is.null(context) || !is.list(context)) return(NULL)
  panel <- context$panel %||% context$config %||% list()
  summary <- context$summary %||% list()
  data_sources <- context$data_sources %||% list()
  if (!length(data_sources) && is.list(context$waves)) {
    data_sources <- lapply(context$waves, function(w) w$data %||% NULL)
    names(data_sources) <- vapply(context$waves, function(w) .ficha_tecnica_scalar(w$base %||% w$label, ""), character(1))
    data_sources <- Filter(function(x) is.data.frame(x), data_sources)
  }
  panel_waves <- panel$waves %||% list()
  summary_waves <- summary$waves %||% list()
  if (length(panel_waves) && length(summary_waves)) {
    waves_cfg <- lapply(seq_along(panel_waves), function(i) {
      wave <- panel_waves[[i]] %||% list()
      base <- .ficha_tecnica_scalar(wave$base, "")
      hit <- which(vapply(summary_waves, function(sw) identical(.ficha_tecnica_scalar(sw$base, ""), base), logical(1)))[1]
      summary_wave <- if (!is.na(hit)) summary_waves[[hit]] else summary_waves[[min(i, length(summary_waves))]]
      utils::modifyList(summary_wave %||% list(), wave)
    })
  } else {
    waves_cfg <- if (length(panel_waves)) {
      panel_waves
    } else if (length(summary_waves)) {
      summary_waves
    } else {
      context$waves %||% list()
    }
  }
  if (!length(waves_cfg) && length(data_sources)) {
    waves_cfg <- lapply(seq_along(data_sources), function(i) {
      list(
        base = names(data_sources)[[i]],
        label = sprintf("Medición %s", i),
        suffix = paste0("ola", i)
      )
    })
  }
  if (length(waves_cfg) < 2L && length(data_sources) < 2L) return(NULL)
  key <- .ficha_tecnica_first_nonempty(summary$key, panel$key, panel$panel_key, context$key)
  key_label <- .ficha_tecnica_first_nonempty(
    summary$key_label,
    panel$key_label,
    panel$label_key,
    context$key_label
  )

  rows <- lapply(seq_along(waves_cfg), function(i) {
    wave <- waves_cfg[[i]] %||% list()
    fallback_base <- if (length(data_sources) >= i) names(data_sources)[[i]] else ""
    base <- .ficha_tecnica_first_nonempty(wave$base, fallback_base)
    df <- data_sources[[base]] %||% wave$data %||% NULL
    n_filas <- suppressWarnings(as.numeric(wave$n_filas %||% NA))
    if (!is.finite(n_filas) && is.data.frame(df)) n_filas <- nrow(df)
    n_llaves <- suppressWarnings(as.numeric(wave$n_llaves %||% NA))
    if (!is.finite(n_llaves) && is.data.frame(df) && nzchar(key) && key %in% names(df)) {
      kvals <- trimws(as.character(df[[key]]))
      n_llaves <- length(unique(kvals[!is.na(kvals) & nzchar(kvals)]))
    }
    dates <- if (is.data.frame(df)) .ficha_tecnica_panel_wave_dates(df, wave, panel) else list(
      variable = .ficha_tecnica_scalar(wave$fecha_variable %||% wave$date_variable, ""),
      n_fecha_registrada = suppressWarnings(as.numeric(wave$n_fecha_registrada %||% NA)),
      n_fecha_valida = suppressWarnings(as.numeric(wave$n_fecha_valida %||% NA)),
      rango = .ficha_tecnica_first_nonempty(
        wave$rango,
        wave$fecha_rango,
        .ficha_tecnica_date_range_label(
          wave$date_start %||% wave$fecha_inicio,
          wave$date_end %||% wave$fecha_fin
        )
      ),
      observacion_fecha = .ficha_tecnica_first_nonempty(
        wave$observacion,
        wave$observacion_fecha,
        if (!is.null(wave$date_start) || !is.null(wave$fecha_inicio) || !is.null(wave$fecha_rango)) {
          "Rango declarado en la configuración metodológica de la medición."
        } else {
          "No se cargó la data de la medición para inferir fechas."
        }
      )
    )
    district_distribution <- if (is.data.frame(df)) {
      .ficha_tecnica_panel_distribution(df, wave)
    } else {
      .ficha_tecnica_panel_distribution(NULL, wave)
    }
    list(
      ola = .ficha_tecnica_first_nonempty(wave$label, sprintf("Medición %s", i)),
      base = base,
      suffix = .ficha_tecnica_first_nonempty(wave$suffix, paste0("ola", i)),
      n_filas = n_filas,
      n_llaves = n_llaves,
      fecha_variable = dates$variable,
      n_fecha_registrada = dates$n_fecha_registrada,
      n_fecha_valida = dates$n_fecha_valida,
      rango = .ficha_tecnica_scalar(dates$rango, ""),
      nota_publica = .ficha_tecnica_first_nonempty(
        wave$nota_publica,
        wave$descripcion_publica,
        if (i == 1L) "Primera medición del estudio." else "Medición de seguimiento del panel."
      ),
      observacion = .ficha_tecnica_scalar(dates$observacion_fecha, ""),
      district_distribution = district_distribution
    )
  })
  wave_table <- do.call(rbind, lapply(rows, function(row) {
    data.frame(
      Medición = row$ola,
      `Encuestas realizadas` = .ficha_tecnica_fmt_int_blank(row$n_filas),
      `Personas entrevistadas` = .ficha_tecnica_fmt_int_blank(row$n_llaves),
      `Periodo de aplicación` = row$rango,
      Descripción = row$nota_publica,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  }))
  complete <- suppressWarnings(as.numeric(summary$n_complete_keys %||% context$n_complete_keys %||% NA))
  incomplete <- suppressWarnings(as.numeric(summary$n_incomplete_keys %||% context$n_incomplete_keys %||% NA))
  panel_keys <- suppressWarnings(as.numeric(summary$n_panel_keys %||% context$n_panel_keys %||% NA))
  list(
    key = key,
    key_label = key_label,
    waves = rows,
    table = wave_table,
    n_waves = length(rows),
    n_panel_keys = panel_keys,
    n_complete_keys = complete,
    n_incomplete_keys = incomplete,
    instrumentos = summary$instrumentos %||% context$instrumentos %||% NULL
  )
}

.ficha_tecnica_panel_instrumento_text <- function(summary) {
  instrumentos <- summary$instrumentos %||% NULL
  if (!is.data.frame(instrumentos) || !nrow(instrumentos)) return("")
  ordinal <- function(i) {
    labels <- c(
      "La primera medición", "La segunda medición", "La tercera medición",
      "La cuarta medición", "La quinta medición", "La sexta medición"
    )
    if (i <= length(labels)) labels[[i]] else sprintf("La medición %s", .ficha_tecnica_fmt_int(i))
  }
  question_label <- function(n) {
    n <- suppressWarnings(as.numeric(n))
    if (!is.finite(n)) return("")
    sprintf("%s %s", .ficha_tecnica_fmt_int(n), if (identical(round(n), 1)) "pregunta" else "preguntas")
  }
  wave_bits <- vapply(seq_len(nrow(instrumentos)), function(i) {
    row <- instrumentos[i, , drop = FALSE]
    total <- suppressWarnings(as.numeric(
      row$preguntas_reportadas %||%
        row$preguntas_numeradas_entrevistado %||%
        row$preguntas_entrevistado %||%
        row$items_cuestionario %||%
        NA
    ))
    value <- question_label(total)
    if (!nzchar(value)) return("")
    sprintf("\u2022 %s: %s.", ordinal(i), value)
  }, character(1))
  wave_bits <- wave_bits[nzchar(wave_bits)]
  paste(wave_bits, collapse = "\n")
}

.ficha_tecnica_panel_texts <- function(summary) {
  if (is.null(summary) || !is.data.frame(summary$table) || !nrow(summary$table)) return(list())
  wave_bits <- vapply(seq_along(summary$waves), function(i) {
    row <- summary$waves[[i]]
    encuestas <- .ficha_tecnica_fmt_int_blank(row$n_filas)
    ordinal <- if (i == 1L) "primera" else if (i == 2L) "segunda" else paste0("medición ", i)
    sprintf("La %s medición registró %s encuestas", ordinal, encuestas)
  }, character(1))
  complete_txt <- if (is.finite(summary$n_complete_keys)) {
    sprintf(
      "La base longitudinal permite observar a %s participantes en ambas mediciones",
      .ficha_tecnica_fmt_int(summary$n_complete_keys)
    )
  } else {
    "La base longitudinal permite comparar las mediciones disponibles para cada participante"
  }
  incomplete_txt <- if (is.finite(summary$n_incomplete_keys)) {
    sprintf("y registra %s participantes con información disponible en una sola medición", .ficha_tecnica_fmt_int(summary$n_incomplete_keys))
  } else {
    ""
  }
  followup_txt <- if (nzchar(incomplete_txt)) paste(complete_txt, incomplete_txt) else complete_txt
  n_waves_label <- if (identical(suppressWarnings(as.integer(summary$n_waves)), 2L)) {
    "dos"
  } else {
    .ficha_tecnica_fmt_int(summary$n_waves)
  }
  base_text <- sprintf(
    "%s. %s.",
    paste(wave_bits, collapse = ". "),
    followup_txt
  )
  text <- sprintf(
    paste0(
      "El estudio se organizó como un panel longitudinal con %s mediciones sucesivas, orientado a comparar respuestas de las mismas personas ",
      "en distintos momentos del proceso electoral. Para preservar la lectura longitudinal, las respuestas de cada medición ",
      "se conservan separadas en la base de análisis y no se combinan en un único valor. %s. %s."
    ),
    n_waves_label,
    paste(wave_bits, collapse = ". "),
    followup_txt
  )
  out <- list(
    base_de_analisis = paste(
      "Base longitudinal de análisis, construida con una fila por participante y variables conservadas por medición.",
      base_text
    ),
    aplicacion_de_encuestas = text
  )
  instrumento <- .ficha_tecnica_panel_instrumento_text(summary)
  if (nzchar(instrumento)) out$instrumento <- instrumento
  out
}

.ficha_tecnica_panel_subtables <- function(summary) {
  if (is.null(summary) || !is.data.frame(summary$table) || !nrow(summary$table)) return(list())
  list(
    aplicacion_de_encuestas = list(
      title = "Estructura de aplicación por medición",
      data = summary$table,
      widths = c(900, 1100, 1200, 1800, 2150),
      font_size = 12L
    )
  )
}

.ficha_tecnica_distribution_reorder <- function(distribution, reference_order = character(0)) {
  if (!is.data.frame(distribution) || !nrow(distribution) || !"distrito" %in% names(distribution)) {
    return(distribution)
  }
  reference_order <- trimws(as.character(reference_order %||% character(0)))
  reference_order <- reference_order[!is.na(reference_order) & nzchar(reference_order)]
  if (!length(reference_order)) return(distribution)
  reference_key <- .ficha_tecnica_norm_field(reference_order)
  current_key <- .ficha_tecnica_norm_field(distribution$distrito)
  rank <- match(current_key, reference_key)
  missing_rank <- is.na(rank)
  if (any(missing_rank)) {
    rank[missing_rank] <- length(reference_key) + seq_len(sum(missing_rank))
  }
  distribution[order(rank), , drop = FALSE]
}

.ficha_tecnica_panel_appendices <- function(summary) {
  if (is.null(summary) || !length(summary$waves)) return(list())
  appendices <- list()
  reference_order <- character(0)
  for (i in seq_along(summary$waves)) {
    distribution <- summary$waves[[i]]$district_distribution %||% data.frame()
    if (is.data.frame(distribution) && nrow(distribution)) {
      if (!length(reference_order)) {
        reference_order <- as.character(distribution$distrito %||% character(0))
      } else {
        distribution <- .ficha_tecnica_distribution_reorder(distribution, reference_order)
      }
    }
    table <- .ficha_tecnica_compact_distribution_table(distribution, groups = 2L)
    if (!is.data.frame(table) || !nrow(table)) next
    label <- .ficha_tecnica_panel_measurement_label(i)
    key <- paste0("distribucion_medicion_", i)
    appendices[[key]] <- list(
      title = "Distribución",
      note = sprintf("%s: distribución de encuestas realizadas por distrito.", label),
      data = table,
      font_size = 8.1,
      page_break_before = i > 1L
    )
  }
  appendices
}

.ficha_tecnica_read_pulso_state <- function(path) {
  path <- .ficha_tecnica_scalar(path, "")
  if (!nzchar(path) || !file.exists(path)) return(NULL)
  tmp <- tempfile("ficha_pulso_")
  dir.create(tmp, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(path, files = "state.rds", exdir = tmp)
  state_path <- file.path(tmp, "state.rds")
  if (!file.exists(state_path)) return(NULL)
  tryCatch(readRDS(state_path), error = function(e) NULL)
}

.ficha_tecnica_hojas_ruta_summary <- function(context = NULL) {
  if (is.null(context)) return(NULL)
  if (!is.null(context$hojas_ruta_workspace_outputs) || !is.null(context$hojas_ruta_config)) {
    outputs <- context$hojas_ruta_workspace_outputs %||% list()
    cfg <- context$hojas_ruta_config %||% list()
  } else {
    outputs <- context$workspace_outputs %||% context$outputs %||% context
    cfg <- context$config %||% list()
  }
  sample <- outputs$sample %||% list()
  if (!length(sample)) return(NULL)
  cfg <- sample$config %||% cfg
  frame_meta <- sample$frame_meta %||%
    (outputs$population %||% list())$frame_meta %||%
    (outputs$quota %||% list())$frame_meta %||% list()
  size_preview <- outputs$sample_size_preview %||% list()
  size_cfg <- size_preview$sample_size %||% cfg$sample_size %||% list()
  blocks <- .ficha_tecnica_list_rows(sample$blocks %||% list())
  replacements <- .ficha_tecnica_list_rows(sample$replacement_blocks %||% list())
  n_blocks <- if (nrow(blocks)) nrow(blocks) else as.integer(sample$n_blocks %||% 0L)
  n_replacements <- if (nrow(replacements)) nrow(replacements) else as.integer(sample$n_replacement_blocks %||% 0L)
  interviews <- suppressWarnings(as.numeric(blocks$entrevistas %||% numeric(0)))
  replacement_interviews <- suppressWarnings(as.numeric(replacements$entrevistas %||% numeric(0)))
  selected_districts <- if (nrow(blocks) && "ubigeo" %in% names(blocks)) length(unique(blocks$ubigeo)) else NA_integer_
  selected_zones <- if (nrow(blocks) && all(c("ubigeo", "zona") %in% names(blocks))) {
    length(unique(paste(blocks$ubigeo, blocks$zona)))
  } else {
    NA_integer_
  }
  district_distribution <- data.frame()
  if (nrow(blocks) && all(c("distrito", "id_manzana", "entrevistas") %in% names(blocks))) {
    blocks$entrevistas_num <- suppressWarnings(as.numeric(blocks$entrevistas))
    titular_counts <- stats::aggregate(
      list(manzanas_titulares = blocks$id_manzana),
      by = list(distrito = blocks$distrito),
      FUN = function(x) length(unique(x))
    )
    titular_interviews <- stats::aggregate(
      list(entrevistas = blocks$entrevistas_num),
      by = list(distrito = blocks$distrito),
      FUN = function(x) sum(x, na.rm = TRUE)
    )
    titulares <- merge(titular_counts, titular_interviews, by = "distrito", all = TRUE, sort = FALSE)
    replacement_counts <- data.frame(distrito = character(0), manzanas_reemplazo = integer(0), stringsAsFactors = FALSE)
    if (nrow(replacements) && all(c("distrito", "id_manzana") %in% names(replacements))) {
      replacement_counts <- stats::aggregate(
        list(manzanas_reemplazo = replacements$id_manzana),
        by = list(distrito = replacements$distrito),
        FUN = function(x) length(unique(x))
      )
    }
    district_distribution <- merge(titulares, replacement_counts, by = "distrito", all.x = TRUE, sort = FALSE)
    district_distribution$manzanas_reemplazo[is.na(district_distribution$manzanas_reemplazo)] <- 0L
    district_distribution <- district_distribution[order(
      -suppressWarnings(as.numeric(district_distribution$entrevistas)),
      district_distribution$distrito
    ), , drop = FALSE]
    total_district_interviews <- sum(suppressWarnings(as.numeric(district_distribution$entrevistas)), na.rm = TRUE)
    district_distribution$porcentaje <- if (is.finite(total_district_interviews) && total_district_interviews > 0) {
      suppressWarnings(as.numeric(district_distribution$entrevistas)) / total_district_interviews
    } else {
      NA_real_
    }
    row.names(district_distribution) <- NULL
  }
  configured_territories <- cfg$territorios %||% list()
  list(
    source = .ficha_tecnica_scalar(frame_meta$source, "INEI"),
    year = .ficha_tecnica_scalar(frame_meta$year, ""),
    version = .ficha_tecnica_scalar(frame_meta$version, ""),
    coverage = .ficha_tecnica_scalar(frame_meta$coverage, ""),
    granularity = .ficha_tecnica_scalar(frame_meta$granularity, ""),
    frame_manzanas = suppressWarnings(as.numeric(frame_meta$n_manzanas %||% NA)),
    frame_viviendas = suppressWarnings(as.numeric(frame_meta$viviendas %||% NA)),
    frame_poblacion = suppressWarnings(as.numeric(frame_meta$poblacion %||% NA)),
    n_objetivo = suppressWarnings(as.numeric(cfg$n_objetivo %||% sample$total_entrevistas %||% NA)),
    method = .ficha_tecnica_scalar(sample$method %||% cfg$sampling_method, ""),
    seed = .ficha_tecnica_scalar(sample$seed %||% cfg$seed, ""),
    measure_var = .ficha_tecnica_scalar(cfg$measure_var, ""),
    interviews_per_block = suppressWarnings(as.numeric(cfg$entrevistas_por_manzana %||% NA)),
    max_per_block = suppressWarnings(as.numeric(cfg$max_per_manzana %||% NA)),
    n_blocks = n_blocks,
    total_interviews = if (length(interviews)) sum(interviews, na.rm = TRUE) else suppressWarnings(as.numeric(sample$total_entrevistas %||% NA)),
    n_replacements = n_replacements,
    total_replacement_interviews = if (length(replacement_interviews)) sum(replacement_interviews, na.rm = TRUE) else suppressWarnings(as.numeric(sample$total_replacement_interviews %||% NA)),
    replacement_policy = .ficha_tecnica_scalar(cfg$replacement_policy %||% sample$replacement_policy, ""),
    replacements_per_titular = suppressWarnings(as.numeric(cfg$replacements_per_titular %||% NA)),
    row_var = .ficha_tecnica_scalar(cfg$row_var, ""),
    col_var = .ficha_tecnica_scalar(cfg$col_var, ""),
    subquota_var = .ficha_tecnica_scalar(cfg$subquota_var, ""),
    route_start_corner = .ficha_tecnica_scalar(cfg$route_start_corner, ""),
    route_jump_mode = .ficha_tecnica_scalar(cfg$route_jump_mode, ""),
    route_jump_manual = suppressWarnings(as.numeric(cfg$route_jump_manual %||% NA)),
    age_range_mode = .ficha_tecnica_scalar(cfg$age_range_mode, ""),
    age_range_scope = .ficha_tecnica_scalar(cfg$age_range_scope, ""),
    zone_allocation = .ficha_tecnica_scalar(cfg$zone_allocation, ""),
    age_ranges = cfg$age_ranges %||% list(),
    configured_territories = length(configured_territories),
    selected_districts = selected_districts,
    selected_zones = selected_zones,
    confidence_level = suppressWarnings(as.numeric(size_cfg$confidence_level %||% NA)),
    expected_proportion = suppressWarnings(as.numeric(size_cfg$expected_proportion %||% NA)),
    response_rate = suppressWarnings(as.numeric(size_cfg$response_rate %||% NA)),
    margin_total_estimated = suppressWarnings(as.numeric(size_preview$margin_total_estimated %||% NA)),
    district_distribution = district_distribution
  )
}

.ficha_tecnica_compact_distribution_table <- function(distribution, groups = 2L) {
  if (!is.data.frame(distribution) || !nrow(distribution)) return(NULL)
  groups <- max(1L, min(4L, as.integer(groups %||% 2L)))
  rows_per_group <- ceiling(nrow(distribution) / groups)
  cols <- list()
  for (group in seq_len(groups)) {
    start <- (group - 1L) * rows_per_group + 1L
    end <- min(group * rows_per_group, nrow(distribution))
    chunk <- if (start <= nrow(distribution)) {
      distribution[seq.int(start, end), , drop = FALSE]
    } else {
      distribution[0L, , drop = FALSE]
    }
    while (nrow(chunk) < rows_per_group) {
      chunk <- rbind(chunk, chunk[NA_integer_, , drop = FALSE])
    }
    prefix <- if (groups > 1L) paste0(" ", group) else ""
    district_values <- as.character(chunk$distrito)
    district_hit <- !is.na(district_values) & nzchar(trimws(district_values))
    district_values[district_hit] <- .ficha_tecnica_title_case_es(district_values[district_hit])
    district_values[is.na(district_values)] <- ""
    cols[[paste0("Distrito", prefix)]] <- district_values
    cols[[paste0("Encuestas", prefix)]] <- as.character(chunk$entrevistas)
    cols[[paste0("%", prefix)]] <- vapply(chunk$porcentaje, .ficha_tecnica_fmt_pct, character(1))
  }
  out <- as.data.frame(cols, stringsAsFactors = FALSE, check.names = FALSE)
  out[is.na(out)] <- ""
  out
}

.ficha_tecnica_sampling_stages_table <- function(summary) {
  if (is.null(summary)) return(NULL)
  method_label <- toupper(.ficha_tecnica_scalar(summary$method, "PPS"))
  measure_label <- .ficha_tecnica_scalar(summary$measure_var, "viviendas")
  route_label <- .ficha_tecnica_route_description(summary)
  quota_label <- .ficha_tecnica_quota_description(summary)
  replacement_label <- switch(
    .ficha_tecnica_scalar(summary$replacement_policy, ""),
    paired_by_titular_zone = "una manzana de reemplazo pareada por zona para cada manzana titular",
    "manzanas de reemplazo definidas para preservar la cobertura territorial"
  )
  data.frame(
    Etapa = c("Primera", "Segunda", "Tercera"),
    Unidades = c("Manzanas urbanas", "Viviendas", "Personas"),
    `Método de selección` = c(
      sprintf(
        paste0(
          "Selección aleatoria con probabilidad proporcional al tamaño, ",
          "usando %s como medida de tamaño. Se seleccionaron %s manzanas titulares en Lima Metropolitana y Callao ",
          "y se definió %s."
        ),
        measure_label,
        .ficha_tecnica_fmt_int(summary$n_blocks),
        replacement_label
      ),
      sprintf(
        paste0(
          "En cada manzana titular se programaron %s entrevistas. La selección operativa de viviendas siguió un ",
          "%s; ante incidencias se mantuvo la equivalencia territorial mediante la manzana de reemplazo asignada."
        ),
        .ficha_tecnica_fmt_int(summary$interviews_per_block),
        route_label
      ),
      sprintf(
        paste0(
          "Se aplicó una encuesta por vivienda seleccionada a una persona de 18 años o más, ",
          "con control operativo de %s."
        ),
        quota_label
      )
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.ficha_tecnica_precision_table <- function(summary) {
  if (is.null(summary)) return(NULL)
  entrevistas <- summary$total_interviews %||% summary$n_objetivo
  if (!is.finite(suppressWarnings(as.numeric(entrevistas)))) return(NULL)
  ambito <- .ficha_tecnica_scalar(summary$coverage, "Lima Metropolitana y Callao")
  if (is.finite(summary$selected_districts)) {
    ambito <- sprintf(
      "%s, dentro de los %s distritos incluidos en el diseño",
      ambito,
      .ficha_tecnica_fmt_int(summary$selected_districts)
    )
  }
  margen <- if (is.finite(summary$margin_total_estimated)) {
    paste0("±", .ficha_tecnica_fmt_pct(summary$margin_total_estimated))
  } else {
    "No estimado"
  }
  confianza <- if (is.finite(summary$confidence_level)) {
    .ficha_tecnica_fmt_pct(summary$confidence_level)
  } else {
    "No especificado"
  }
  supuesto <- if (is.finite(summary$expected_proportion)) {
    "Máxima heterogeneidad"
  } else {
    "Supuestos declarados del diseño"
  }
  data.frame(
    Ámbito = ambito,
    `Encuestas programadas` = .ficha_tecnica_fmt_int_blank(entrevistas),
    `Margen de error estimado` = margen,
    `Nivel de confianza` = confianza,
    Supuesto = supuesto,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.ficha_tecnica_hojas_ruta_subtables <- function(summary) {
  if (is.null(summary)) return(list())
  subtables <- list()
  precision <- .ficha_tecnica_precision_table(summary)
  if (is.data.frame(precision) && nrow(precision)) {
    subtables$tamano_de_la_muestra <- list(
      title = "Precisión muestral estimada",
      data = precision,
      widths = c(2100, 1300, 1350, 1150, 1250),
      font_size = 12L
    )
  }
  stages <- .ficha_tecnica_sampling_stages_table(summary)
  if (is.data.frame(stages) && nrow(stages)) {
    subtables$procedimiento_de_muestreo <- list(
      title = "Etapas del diseño muestral",
      data = stages,
      widths = c(940, 1260, 4820),
      font_size = 15L
    )
  }
  subtables
}

.ficha_tecnica_hojas_ruta_appendices <- function(summary) {
  if (is.null(summary)) return(list())
  appendices <- list()
  table <- .ficha_tecnica_compact_distribution_table(summary$district_distribution, groups = 2L)
  if (is.data.frame(table) && nrow(table)) {
    appendices$distribucion_distrito <- list(
      title = "Distribución",
      note = "La tabla resume la cantidad de encuestas programadas por distrito y su peso relativo sobre el total de la muestra.",
      data = table,
      font_size = 8.1
    )
  }
  appendices
}

.ficha_tecnica_hojas_ruta_texts <- function(summary) {
  if (is.null(summary)) return(list())
  source_year <- .ficha_tecnica_scalar(summary$source, "INEI")
  year <- .ficha_tecnica_scalar(summary$year, "")
  if (nzchar(year) && !grepl(year, source_year, fixed = TRUE)) {
    source_year <- paste(source_year, year)
  }
  source_year <- trimws(source_year)
  method_label <- toupper(.ficha_tecnica_scalar(summary$method, "PPS"))
  measure_label <- .ficha_tecnica_scalar(summary$measure_var, "viviendas")
  replacement_label <- switch(
    .ficha_tecnica_scalar(summary$replacement_policy, ""),
    paired_by_titular_zone = "pareadas por la zona de la manzana titular",
    "definidas para preservar la cobertura territorial"
  )
  route_label <- .ficha_tecnica_route_description(summary)
  quota_label <- .ficha_tecnica_quota_description(summary)
  allocation_label <- switch(
    .ficha_tecnica_norm_field(summary$zone_allocation %||% ""),
    proportional = "proporcional",
    equal = "uniforme",
    ""
  )
  allocation_sentence <- if (nzchar(allocation_label)) {
    sprintf(
      "La asignación territorial de entrevistas se realizó de manera %s entre las unidades territoriales de trabajo.",
      allocation_label
    )
  } else {
    "La asignación territorial de entrevistas se definió para cubrir los territorios muestrales previstos en el diseño."
  }
  seed_sentence <- if (nzchar(summary$seed)) {
    "El procedimiento quedó documentado para permitir la verificación metodológica de la selección desde el mismo marco."
  } else {
    "La selección quedó documentada para permitir la auditoría de la muestra desde el mismo marco."
  }
  district_names <- .ficha_tecnica_district_names(summary$district_distribution)
  district_count <- length(district_names)
  district_list <- .ficha_tecnica_join_sentence(district_names)
  distritos <- if (district_count > 0L && nzchar(district_list)) {
    sprintf(
      "%s distritos seleccionados: %s.",
      .ficha_tecnica_fmt_int(district_count),
      district_list
    )
  } else {
    ""
  }
  criterios <- sprintf(
    paste0(
      "Se incluyeron personas de 18 años o más, residentes en viviendas ubicadas en las manzanas seleccionadas ",
      "dentro del ámbito del estudio. La entrevista se aplicó a una persona elegible por vivienda, con control ",
      "operativo de %s."
    ),
    quota_label
  )
  ambito <- if (nzchar(summary$coverage)) {
    sprintf(
      "%s. La muestra se distribuyó en %s unidades territoriales de trabajo, con manzanas titulares ubicadas en %s distritos.",
      summary$coverage,
      .ficha_tecnica_fmt_int(summary$configured_territories),
      .ficha_tecnica_fmt_int(summary$selected_districts)
    )
  } else {
    ""
  }
  marco <- sprintf(
    paste0(
      "Para la selección de manzanas se utilizó como marco muestral la cartografía censal del %s, ",
      "correspondiente a manzanas urbanas de Lima Metropolitana y Callao. El marco de referencia considerado ",
      "contiene %s manzanas, %s viviendas y %s personas registradas."
    ),
    source_year,
    .ficha_tecnica_fmt_int(summary$frame_manzanas),
    .ficha_tecnica_fmt_int(summary$frame_viviendas),
    .ficha_tecnica_fmt_int(summary$frame_poblacion)
  )
  tamano <- sprintf(
    paste0(
      "La muestra programada fue de %s entrevistas, distribuidas en %s manzanas titulares. ",
      "En cada manzana se asignaron %s entrevistas. Además, se generaron %s manzanas de reemplazo ",
      "para preservar la cobertura del trabajo de campo ante rechazos, ausencias u otras incidencias operativas. ",
      "La precisión muestral estimada se resume en la tabla siguiente."
    ),
    .ficha_tecnica_fmt_int(summary$total_interviews %||% summary$n_objetivo),
    .ficha_tecnica_fmt_int(summary$n_blocks),
    .ficha_tecnica_fmt_int(summary$interviews_per_block),
    .ficha_tecnica_fmt_int(summary$n_replacements)
  )
  procedimiento <- sprintf(
    paste0(
      "Muestra semi-probabilística polietápica.\n\n",
      "Dentro de Lima Metropolitana y Callao, la muestra se organizó como un diseño urbano por conglomerados. ",
      "El marco de selección estuvo compuesto por manzanas censales urbanas, agrupadas en territorios muestrales ",
      "de trabajo definidos para el levantamiento. %s\n\n",
      "En la primera etapa se seleccionaron manzanas urbanas mediante un procedimiento aleatorio con probabilidad ",
      "proporcional al tamaño, usando %s como medida de tamaño. ",
      "Esta etapa constituye el componente probabilístico central del diseño y se realizó sobre el marco ",
      "cartográfico disponible. %s\n\n",
      "En la segunda etapa, en cada manzana titular se programaron %s entrevistas y se aplicó un %s. El diseño ",
      "contempló reemplazos muestrales para sostener la cobertura ante rechazos, ausencias u otras incidencias ",
      "de campo; para este proyecto, las manzanas de reemplazo fueron %s, preservando la trazabilidad entre ",
      "manzana titular, zona de trabajo y reemplazo aplicado.\n\n",
      "En la tercera etapa se entrevistó a una persona elegible de 18 años o más en cada vivienda seleccionada, ",
      "con control operativo de %s. En la siguiente tabla se resumen las etapas descritas:"
    ),
    allocation_sentence,
    measure_label,
    seed_sentence,
    .ficha_tecnica_fmt_int(summary$interviews_per_block),
    route_label,
    replacement_label,
    quota_label
  )
  margen_txt <- if (is.finite(summary$margin_total_estimated)) {
    sprintf("un margen de error total estimado de ±%s", .ficha_tecnica_fmt_pct(summary$margin_total_estimated))
  } else {
    ""
  }
  confianza_txt <- if (is.finite(summary$confidence_level)) {
    sprintf("un nivel de confianza de %s", .ficha_tecnica_fmt_pct(summary$confidence_level))
  } else {
    ""
  }
  precision_txt <- paste(c(margen_txt, confianza_txt)[nzchar(c(margen_txt, confianza_txt))], collapse = ", con ")
  nivel <- if (nzchar(precision_txt)) {
    total_muestra <- summary$total_interviews %||% summary$n_objetivo
    total_muestra_txt <- if (is.finite(suppressWarnings(as.numeric(total_muestra)))) {
      sprintf("muestra programada inicial de %s entrevistas", .ficha_tecnica_fmt_int(total_muestra))
    } else {
      "muestra programada inicial"
    }
    sprintf(
      paste0(
        "La muestra permite reportar resultados para Lima Metropolitana y Callao, dentro del conjunto de distritos incluidos ",
        "en el diseño muestral. Para la %s, la precisión total estimada corresponde a %s, ",
        "bajo el supuesto de máxima heterogeneidad."
      ),
      total_muestra_txt,
      precision_txt
    )
  } else {
    ""
  }
  out <- list(
    criterios_de_inclusion = criterios,
    ambito_geografico = ambito,
    distritos_seleccionados = distritos,
    marco_muestral = marco,
    tamano_de_la_muestra = tamano,
    procedimiento_muestreo = procedimiento
  )
  if (nzchar(nivel)) out$nivel_representatividad <- nivel
  out
}

.ficha_tecnica_cfg_with_hojas_ruta <- function(cfg) {
  cfg <- cfg %||% list()
  ft <- cfg$ficha_tecnica %||% list()
  project_context <- ft$metodologia_contexto %||% ft$project_context %||% ft$proyecto_contexto %||% NULL
  if (is.null(project_context)) {
    project_context <- .ficha_tecnica_read_pulso_state(ft$project_pulso_path %||% ft$proyecto_pulso_path %||% "")
  }

  context <- ft$hojas_ruta_context %||% project_context
  if (is.null(context)) {
    context <- .ficha_tecnica_read_pulso_state(ft$hojas_ruta_pulso_path %||% "")
  }
  summary <- .ficha_tecnica_hojas_ruta_summary(context)
  texts <- .ficha_tecnica_hojas_ruta_texts(summary)
  subtables <- .ficha_tecnica_hojas_ruta_subtables(summary)
  appendices <- .ficha_tecnica_hojas_ruta_appendices(summary)
  calc_context <- ft$calc_muestra_context %||% project_context
  if (is.null(calc_context)) {
    calc_context <- .ficha_tecnica_read_pulso_state(ft$calc_muestra_pulso_path %||% "")
  }
  calc_summary <- .ficha_tecnica_calc_muestra_summary(calc_context)
  calc_texts <- .ficha_tecnica_calc_muestra_texts(calc_summary)
  calc_subtables <- .ficha_tecnica_calc_muestra_subtables(calc_summary)
  calc_appendices <- .ficha_tecnica_calc_muestra_appendices(calc_summary)
  panel_context <- ft$panel_context %||% project_context
  panel_summary <- .ficha_tecnica_panel_summary(panel_context)
  panel_texts <- .ficha_tecnica_panel_texts(panel_summary)
  panel_subtables <- .ficha_tecnica_panel_subtables(panel_summary)
  panel_appendices <- .ficha_tecnica_panel_appendices(panel_summary)
  texts <- utils::modifyList(calc_texts, texts)
  texts <- utils::modifyList(texts, panel_texts)
  subtables <- utils::modifyList(calc_subtables, subtables)
  subtables <- utils::modifyList(subtables, panel_subtables)
  appendices <- utils::modifyList(calc_appendices, appendices)
  if (length(panel_appendices)) appendices$distribucion_distrito <- NULL
  appendices <- utils::modifyList(appendices, panel_appendices)
  if (!length(texts) && !length(subtables) && !length(appendices)) return(cfg)
  for (key in names(texts)) {
    current <- .ficha_tecnica_scalar(ft[[key]], "")
    value <- .ficha_tecnica_scalar(texts[[key]], "")
    if (!nzchar(value)) next
    if (identical(key, "aplicacion_de_encuestas") && nzchar(current)) {
      current_norm <- .ficha_tecnica_norm_field(current)
      has_panel_text <- grepl("panel|medicion", current_norm) &&
        grepl("primera_medicion|segunda_medicion|dos_mediciones", current_norm)
      if (!has_panel_text) ft[[key]] <- paste(current, value, sep = "\n\n")
    } else if (!nzchar(current)) {
      ft[[key]] <- value
    }
  }
  if (length(subtables)) {
    ft$subtables <- utils::modifyList(ft$subtables %||% list(), subtables)
  }
  if (length(appendices)) {
    ft$appendices <- utils::modifyList(ft$appendices %||% list(), appendices)
  }
  cfg$ficha_tecnica <- ft
  cfg
}

.analitica_write_ficha_tecnica_docx <- function(path_docx,
                                                data = NULL,
                                                instrumento = NULL,
                                                reporte = "Ficha tecnica",
                                                fuente = NULL,
                                                cfg = NULL,
                                                hojas = NULL,
                                                detalles = NULL,
                                                template_path = NULL) {
  cfg <- cfg %||% list()
  cfg <- .ficha_tecnica_cfg_with_hojas_ruta(cfg)
  template_path <- .ficha_tecnica_scalar(
    template_path %||% ((cfg$ficha_tecnica %||% list())$template_path),
    Sys.getenv("PROSECNUR_FICHA_TECNICA_TEMPLATE", "")
  )
  layout <- .ficha_tecnica_scalar((cfg$ficha_tecnica %||% list())$layout, "")
  if (!nzchar(layout)) {
    layout <- "pulso_oficial"
  }
  rows <- .ficha_tecnica_docx_rows(
    data = data,
    instrumento = instrumento,
    reporte = reporte,
    fuente = fuente,
    cfg = cfg,
    hojas = hojas,
    detalles = detalles
  )
  if (identical(layout, "template") && nzchar(template_path) && file.exists(template_path)) {
    .ficha_tecnica_write_docx_template(rows, template_path, path_docx)
  } else if (identical(layout, "pulso_oficial")) {
    .ficha_tecnica_write_docx_pulso(
      rows,
      path_docx,
      subtables = (cfg$ficha_tecnica %||% list())$subtables %||% NULL,
      appendices = (cfg$ficha_tecnica %||% list())$appendices %||% NULL
    )
  } else {
    .ficha_tecnica_write_docx_fallback(rows, path_docx)
  }
  invisible(path_docx)
}

.ficha_tecnica_row_height <- function(values, widths) {
  txt <- paste(as.character(values), collapse = " ")
  txt <- gsub("\\r?\\n", " ", txt)
  chars <- max(1L, sum(pmax(10L, as.integer(widths)), na.rm = TRUE))
  lines <- max(1L, ceiling(nchar(txt, type = "width", allowNA = FALSE, keepNA = FALSE) / chars))
  min(126, 22 + (lines - 1L) * 15)
}

.analitica_add_ficha_tecnica_sheet <- function(wb,
                                               data = NULL,
                                               instrumento = NULL,
                                               reporte = "Entregable analitico",
                                               fuente = NULL,
                                               cfg = NULL,
                                               hojas = NULL,
                                               detalles = NULL,
                                               sheet = "Ficha tecnica") {
  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("Se requiere openxlsx para agregar la ficha tecnica.", call. = FALSE)
  }
  cfg <- .ficha_tecnica_cfg_with_hojas_ruta(cfg %||% list())
  if (is.null(hojas)) hojas <- names(wb)
  sheet <- .ficha_tecnica_sheet_name(wb, sheet)
  rows <- .ficha_tecnica_rows(
    data = data,
    instrumento = instrumento,
    reporte = reporte,
    fuente = fuente,
    cfg = cfg,
    hojas = hojas,
    detalles = detalles
  )

  openxlsx::addWorksheet(wb, sheet, gridLines = FALSE)
  openxlsx::writeData(wb, sheet, "FICHA TECNICA", startRow = 1, startCol = 1, colNames = FALSE)
  openxlsx::writeData(
    wb,
    sheet,
    "Ficha generada automaticamente para documentar el entregable analitico.",
    startRow = 2,
    startCol = 1,
    colNames = FALSE
  )
  openxlsx::mergeCells(wb, sheet, rows = 1, cols = 1:3)
  openxlsx::mergeCells(wb, sheet, rows = 2, cols = 1:3)

  title_style <- openxlsx::createStyle(
    fontName = "Arial",
    fontSize = 18,
    textDecoration = "bold",
    fontColour = "#0B2545",
    halign = "center",
    valign = "center"
  )
  subtitle_style <- openxlsx::createStyle(
    fontName = "Arial",
    fontSize = 10,
    fontColour = "#5E6773",
    halign = "center",
    valign = "center",
    wrapText = TRUE
  )
  header_style <- openxlsx::createStyle(
    fontName = "Arial",
    fontSize = 10,
    textDecoration = "bold",
    fontColour = "#0B2545",
    fgFill = "#E8EEF5",
    border = "TopBottomLeftRight",
    borderColour = "#CBD5E1",
    halign = "left",
    valign = "center",
    wrapText = TRUE
  )
  label_style <- openxlsx::createStyle(
    fontName = "Arial",
    fontSize = 10,
    fontColour = "#1F4D78",
    fgFill = "#F2F2F2",
    border = "TopBottomLeftRight",
    borderColour = "#CBD5E1",
    valign = "top",
    wrapText = TRUE
  )
  body_style <- openxlsx::createStyle(
    fontName = "Arial",
    fontSize = 10,
    fontColour = "#0B2545",
    border = "TopBottomLeftRight",
    borderColour = "#CBD5E1",
    valign = "top",
    wrapText = TRUE
  )
  note_style <- openxlsx::createStyle(
    fontName = "Arial",
    fontSize = 9,
    fontColour = "#5E6773",
    border = "TopBottomLeftRight",
    borderColour = "#CBD5E1",
    valign = "top",
    wrapText = TRUE
  )

  openxlsx::addStyle(wb, sheet, title_style, rows = 1, cols = 1:3, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, subtitle_style, rows = 2, cols = 1:3, gridExpand = TRUE, stack = TRUE)
  openxlsx::writeData(wb, sheet, rows, startRow = 4, startCol = 1, headerStyle = header_style)
  if (nrow(rows) > 0L) {
    body_rows <- seq.int(5L, 4L + nrow(rows))
    openxlsx::addStyle(wb, sheet, label_style, rows = body_rows, cols = 1, gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, sheet, body_style, rows = body_rows, cols = 2, gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, sheet, note_style, rows = body_rows, cols = 3, gridExpand = TRUE, stack = TRUE)
    heights <- vapply(seq_len(nrow(rows)), function(i) {
      .ficha_tecnica_row_height(rows[i, , drop = TRUE], c(28, 74, 48))
    }, numeric(1))
    openxlsx::setRowHeights(wb, sheet, rows = body_rows, heights = heights)
  }
  openxlsx::setRowHeights(wb, sheet, rows = 1, heights = 28)
  openxlsx::setRowHeights(wb, sheet, rows = 2, heights = 30)
  openxlsx::setColWidths(wb, sheet, cols = 1, widths = 28)
  openxlsx::setColWidths(wb, sheet, cols = 2, widths = 74)
  openxlsx::setColWidths(wb, sheet, cols = 3, widths = 48)
  openxlsx::freezePane(wb, sheet, firstActiveRow = 5)
  invisible(sheet)
}

.analitica_add_ficha_tecnica_from_spec <- function(defaults, ficha_tecnica = NULL) {
  if (identical(ficha_tecnica, FALSE)) return(invisible(NULL))
  if (is.null(ficha_tecnica) || isTRUE(ficha_tecnica)) ficha_tecnica <- list()
  if (!is.list(ficha_tecnica)) ficha_tecnica <- list()
  args <- utils::modifyList(defaults, ficha_tecnica)
  do.call(.analitica_add_ficha_tecnica_sheet, args)
}
