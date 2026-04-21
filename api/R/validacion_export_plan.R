# =====================================================================
# Exportar Plan de Limpieza a Excel — versión “pro” y editable (Ajustado)
# =====================================================================

`%||%` <- function(a, b) if (is.null(a) || (length(a)==1 && is.na(a))) b else a

# ---------- Paletas / niveles ----------
.categoria_levels <- c(
  "Saltos de preguntas",
  "Preguntas de control",
  "Consistencia",
  "Valores atípicos",
  "Filtro de opciones",
  "Valores calculados"
)

.paletas_por_hue <- list(
  azul     = c("#EEF4FD", "#DDEBF7", "#CFE2F3", "#BFD7EE"),
  verde    = c("#EBF6EC", "#E2EFDA", "#D7EAD1", "#CFE6CA"),
  amarillo = c("#FFF9E6", "#FFF2CC", "#FFEFB3", "#FFE89A"),
  salmon   = c("#FDEEE8", "#FCE4D6", "#FAD9CC", "#F8CFC1"),
  violeta  = c("#F4EEFD", "#EAE1FA", "#E1D4F7", "#D7C7F4"),
  turquesa = c("#E9F7F6", "#D6EFEE", "#C8E7E6", "#B9DFDE"),
  gris     = c("#F7F7F7", "#EEEEEE", "#E6E6E6", "#DDDDDD")
)
._hues_order <- names(.paletas_por_hue)

# ---------- Helpers de estilo ----------
.approx_width <- function(x, min_w = 10, max_w = 80) {
  if (is.null(x) || length(x) == 0) return(min_w)
  w <- ceiling(pmin(pmax(nchar(x, allowNA = TRUE), min_w), max_w) * 0.8)
  pmax(min_w, pmin(max_w, max(w, na.rm = TRUE)))
}

.make_header_style <- function() {
  openxlsx::createStyle(
    fgFill = "#F2F2F2", halign = "center", valign = "center",
    textDecoration = "bold",
    border = "Bottom", borderColour = "#000000", borderStyle = "thin",
    wrapText = TRUE
  )
}

.make_body_style <- function(wrap = TRUE) {
  openxlsx::createStyle(
    halign = "left",
    valign = "top",
    wrapText = wrap,
    border = "TopBottomLeftRight",
    borderColour = "#000000",
    borderStyle = "thin"
  )
}

.section_prefix_from_id <- function(id) sub("^([A-Za-z0-9]+_).*", "\\1", id)

.build_section_type_palette <- function(plan) {
  stopifnot("ID" %in% names(plan), "Categoría" %in% names(plan))
  secciones <- plan$ID |> .section_prefix_from_id() |> unique()
  hue_idx <- seq_along(secciones)
  hues <- ._hues_order[ (hue_idx - 1L) %% length(._hues_order) + 1L ]
  out <- vector("list", length(secciones))
  names(out) <- secciones
  for (i in seq_along(secciones)) {
    tonos <- .paletas_por_hue[[ hues[[i]] ]]
    tonos <- rep_len(tonos, length.out = length(.categoria_levels))
    names(tonos) <- .categoria_levels
    out[[ secciones[[i]] ]] <- tonos
  }
  out
}

.shade_plan_by_section_and_type <- function(wb, sheet, datos) {
  if (!all(c("ID","Categoría") %in% names(datos))) return(invisible())
  pal_map <- .build_section_type_palette(datos)
  ids    <- as.character(datos$ID)
  tipos  <- as.character(datos$`Categoría`)
  seccs  <- .section_prefix_from_id(ids)
  combos <- unique(data.frame(secc = seccs, tipo = tipos, stringsAsFactors = FALSE))
  for (k in seq_len(nrow(combos))) {
    sec  <- combos$secc[k]
    tipo <- combos$tipo[k]
    if (!sec %in% names(pal_map)) next
    idx_tipo <- match(tipo, .categoria_levels)
    if (is.na(idx_tipo)) next
    color <- pal_map[[sec]][[ idx_tipo ]]
    st <- openxlsx::createStyle(
      fgFill = color,
      border = "TopBottomLeftRight",
      borderColour = "#000000",
      borderStyle = "thin"
    )
    filas <- which(seccs == sec & tipos == tipo) + 1L
    if (length(filas)) {
      openxlsx::addStyle(wb, sheet, st,
                         rows = filas, cols = 1:ncol(datos),
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  invisible()
}

.apply_zebra <- function(wb, sheet, nrow, ncol) {
  if (nrow <= 1) return(invisible())
  zebra <- openxlsx::createStyle(fgFill = "#FAFAFA")
  even_rows <- seq(3, nrow + 1L, by = 2)
  openxlsx::addStyle(wb, sheet, zebra, rows = even_rows, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
}

.add_sheet_with_table <- function(wb, sheet, data, freeze = TRUE, filter = TRUE,
                                  wrap = TRUE, widths = NULL, zebra = FALSE) {
  openxlsx::addWorksheet(wb, sheet)
  openxlsx::writeData(wb, sheet, data, withFilter = filter, headerStyle = .make_header_style())
  openxlsx::addStyle(wb, sheet, .make_body_style(wrap = wrap),
                     rows = 2:(nrow(data) + 1), cols = 1:ncol(data), gridExpand = TRUE)
  if (freeze) openxlsx::freezePane(wb, sheet, firstRow = TRUE)
  if (is.null(widths)) {
    w <- purrr::map_int(seq_len(ncol(data)), function(j) {
      hdr  <- names(data)[j]
      body <- as.character(utils::head(data[[j]], 200))
      .approx_width(c(hdr, body))
    })
    openxlsx::setColWidths(wb, sheet, cols = 1:ncol(data), widths = w)
  } else {
    openxlsx::setColWidths(wb, sheet, cols = 1:ncol(data), widths = widths)
  }
  if (isTRUE(zebra)) .apply_zebra(wb, sheet, nrow = nrow(data), ncol = ncol(data))
}

# ---------- Tablas auxiliares ----------
.build_resumen <- function(plan) {
  plan %>%
    dplyr::count(`Categoría`, name = "n_reglas") %>%
    dplyr::arrange(dplyr::desc(n_reglas))
}

.build_secciones <- function(x) {
  stopifnot(!is.null(x$meta$section_map))
  x$meta$section_map %>% dplyr::select(group_name, group_label, prefix)
}

.build_diccionario <- function(x) {
  survey <- x$survey
  label_col <- x$meta$label_col_survey %||% "_label_"
  out <- survey %>%
    dplyr::mutate(
      type_base = tolower(trimws(sub("\\s.*$", "", .data$type))),
      label = .data[[label_col]]
    ) %>%
    dplyr::select(dplyr::any_of(c(
      "name","label","type","type_base","group_name",
      "required","relevant","constraint","calculation","appearance","choice_filter"
    )))
  out
}

.build_choices <- function(x) {
  if (!"choices" %in% names(x) || nrow(x$choices) == 0) {
    return(tibble::tibble(list_name = character(), name = character(), label = character()))
  }
  label_col <- x$meta$label_col_choices %||% "_label_"
  x$choices %>%
    dplyr::mutate(label = .data[[label_col]] %||% NA_character_) %>%
    dplyr::select(dplyr::any_of(c("list_name", "name", "label")))
}

.build_readme <- function(plan, x, autor, titulo, version, hojas_presentes) {
  secmap <- .build_secciones(x)

  # Helper: siempre devolver chr(1)
  chr1 <- function(z) {
    z <- z %||% ""              # NULL -> ""
    if (length(z) == 0) z <- ""
    z <- as.character(z)
    if (length(z) == 0) "" else z[1]
  }

  toc <- paste0(
    if (isTRUE(hojas_presentes$plan))        "- [Plan](#'Plan'!A1)\n" else "",
    if (isTRUE(hojas_presentes$resumen))     "- [Resumen](#'Resumen'!A1)\n" else "",
    if (isTRUE(hojas_presentes$secciones))   "- [Secciones](#'Secciones'!A1)\n" else "",
    if (isTRUE(hojas_presentes$diccionario)) "- [Diccionario](#'Diccionario'!A1)\n" else "",
    if (isTRUE(hojas_presentes$choices))     "- [Choices](#'Choices'!A1)\n" else ""
  )

  secciones <- c(
    "Título", "Versión", "Autor", "Fecha",
    "Descripción",
    "Tabla de contenidos",
    "Estructura de columnas (Plan)",
    "Convenciones de Procesamiento",
    "Secciones y prefijos (resumen)"
  )

  contenidos <- c(
    chr1(titulo %||% "Plan de Limpieza – ACNUR"),
    chr1(as.character(version %||% Sys.Date())),
    chr1(autor %||% Sys.info()[["user"]] %||% "—"),
    chr1(format(Sys.time(), "%Y-%m-%d %H:%M:%S")),
    chr1("Este archivo contiene el plan de limpieza automatizado a partir de un XLSForm. \
Incluye reglas de control, saltos de preguntas, restricciones/consistencias, \
y referencias de diccionario y opciones."),
    chr1(toc),
    chr1("Plan: columnas esperadas:
- ID
- Tabla
- Categoría
- Tipo
- Nombre de regla
- Objetivo
- Variable 1 / 2 / 3 y sus etiquetas
- Procesamiento
- (técnicas y metadatos a la derecha)"),
    chr1("Convenciones clave:
- TRUE = inconsistencia (o según tu convención)
- Texto vacío: `trimws(var) == \"\"`
- NA: `is.na(var)`
- Rangos numéricos: usa conversión segura `suppressWarnings(as.numeric(var))`
- Token Other (select_multiple): `grepl(\"(^|\\\\s)(Other|Otro|Otra)(\\\\s|$)\", var)`"),
    chr1(paste0(
      "Secciones detectadas (", nrow(secmap), "): ",
      paste0(secmap$prefix, "→", secmap$group_name, collapse = "; ")
    ))
  )

  # Garantiza longitudes iguales
  stopifnot(length(secciones) == length(contenidos))

  tibble::tibble(
    Seccion  = secciones,
    Contenido = contenidos
  )
}

# ---------- Saneos de ordenación ----------
.reordenar_plan <- function(plan, x, orden_prefijos = NULL) {
  stopifnot(is.data.frame(plan), is.list(x), !is.null(x$meta$section_map))
  if (is.null(orden_prefijos)) {
    orden_prefijos <- x$meta$section_map$prefix
  }
  orden_sec <- setNames(seq_along(orden_prefijos), orden_prefijos)
  .id_prefix <- function(id) sub("^([A-Za-z0-9]+_).*", "\\1", as.character(id))
  .id_suffix <- function(id) sub("^[^_]*_", "", as.character(id))
  .id_num <- function(id) {
    suf <- .id_suffix(id)
    m <- regexpr("^[0-9]+", suf, perl = TRUE)
    hit <- ifelse(m > 0, regmatches(suf, m), "")
    suppressWarnings(as.integer(ifelse(nzchar(hit), hit, NA)))
  }
  plan %>%
    dplyr::mutate(
      pref   = .id_prefix(.data$ID),
      suf    = .id_suffix(.data$ID),
      num    = .id_num(.data$ID),
      sec_ord = dplyr::if_else(pref == "GEN_", -Inf, as.numeric(orden_sec[pref])),
      sec_ord = ifelse(is.na(sec_ord), Inf, sec_ord)
    ) %>%
    dplyr::arrange(
      sec_ord, pref,
      dplyr::desc(!is.na(num)),
      num, suf
    ) %>%
    dplyr::select(-pref, -suf, -num, -sec_ord)
}

# ---------- Helpers nuevos de polish ----------
.sanitize_sheet <- function(x) {
  x <- gsub("[\\[\\]\\*\\?:/\\\\]", "_", x)
  if (nchar(x) > 31) x <- substr(x, 1, 31)
  x <- ifelse(nchar(x) == 0, "Hoja", x)
  x
}

.get_pal_map <- function(plan) .build_section_type_palette(plan)

.group_plan_rows <- function(wb, sheet, datos) {
  if (!all(c("ID","Categoría") %in% names(datos))) return(invisible())

  gr_fun   <- get("groupRows", asNamespace("openxlsx"))
  gr_args  <- names(formals(gr_fun))
  has_ol   <- "outlineLevel" %in% gr_args
  has_lvl  <- "level"        %in% gr_args
  has_coll <- "collapsed"    %in% gr_args

  seccs <- .section_prefix_from_id(as.character(datos$ID))
  tipos <- as.character(datos$`Categoría`)
  sec_levels <- unique(seccs)

  .group_rows_call <- function(rows, lvl) {
    if (length(rows) < 2) return(invisible())
    if (has_ol) {
      openxlsx::groupRows(wb, sheet, rows = rows, outlineLevel = lvl)
    } else if (has_lvl) {
      openxlsx::groupRows(wb, sheet, rows = rows, level = lvl)
    } else if (has_coll) {
      openxlsx::groupRows(wb, sheet, rows = rows, collapsed = FALSE)
    } else {
      openxlsx::groupRows(wb, sheet, rows = rows)
    }
  }

  for (sec in sec_levels) {
    idx_sec <- which(seccs == sec)
    if (length(idx_sec) >= 2) {
      .group_rows_call(rows = (min(idx_sec)+1):(max(idx_sec)+1), lvl = 1)
    }
    tipos_local <- unique(tipos[idx_sec])
    for (tp in tipos_local) {
      idx_tp <- idx_sec[ tipos[idx_sec] == tp ]
      if (length(idx_tp) >= 2) {
        .group_rows_call(rows = (min(idx_tp)+1):(max(idx_tp)+1), lvl = 2)
      }
    }
  }
  invisible()
}

.add_legend_sheet <- function(wb, pal_map) {
  df <- tibble::tibble(
    Seccion = rep(names(pal_map), each = length(.categoria_levels)),
    `Categoría` = rep(.categoria_levels, times = length(pal_map)),
    Color = unlist(pal_map, use.names = FALSE)
  )
  sheet_name <- .sanitize_sheet("Leyenda")
  openxlsx::addWorksheet(wb, sheet_name)
  openxlsx::writeData(wb, sheet_name, df, headerStyle = .make_header_style())
  for (i in seq_len(nrow(df))) {
    st <- openxlsx::createStyle(
      fgFill = df$Color[i],
      border = "TopBottomLeftRight", borderStyle = "thin", borderColour = "#000000"
    )
    openxlsx::addStyle(wb, sheet_name, st, rows = i+1, cols = 3, gridExpand = TRUE, stack = TRUE)
  }
  openxlsx::setColWidths(wb, sheet_name, cols = 1:3, widths = c(18, 28, 16))
  openxlsx::freezePane(wb, sheet_name, firstRow = TRUE)
  invisible()
}

.polish_sheet <- function(wb, sheet, title = NULL, version = NULL) {
  if ("showGridLines" %in% getNamespaceExports("openxlsx")) {
    openxlsx::showGridLines(wb, sheet, showGridLines = FALSE)
  }
  openxlsx::pageSetup(wb, sheet, orientation = "landscape", fitToWidth = 1, fitToHeight = 0)
  openxlsx::setHeaderFooter(
    wb, sheet,
    header = c(
      left   = if (!is.null(title)) paste0("&B", title, "&B") else "",
      center = "",
      right  = if (!is.null(version)) paste0("Versión: ", version) else ""
    ),
    footer = c(
      left   = format(Sys.time(), "%Y-%m-%d %H:%M"),
      center = "&P de &N",
      right  = "ACNUR"
    )
  )
}

.force_text_column <- function(wb, sheet, col_index, n_rows) {
  st_txt <- openxlsx::createStyle(numFmt = "@", fontName = "Calibri")
  openxlsx::addStyle(wb, sheet, st_txt, rows = 2:(n_rows+1), cols = col_index,
                     gridExpand = TRUE, stack = TRUE)
}

# =====================================================================
# FUNCIÓN PRINCIPAL
# =====================================================================
#' Exportar el plan de limpieza a Excel con varias hojas y formato profesional
#'
#' @param plan Tibble/data.frame del plan (ya normalizado con columnas nuevas).
#' @param x Lista devuelta por `leer_xlsform_limpieza()` (con $meta$section_map).
#' @param path Ruta del archivo de salida `.xlsx`.
#' @param autor Autor opcional (string).
#' @param titulo Título del libro (string).
#' @param version Versión/etiqueta (string o `Date`).
#' @param incluir Lista booleana: `plan`, `resumen`, `secciones`, `diccionario`, `choices`, `readme`.
#' @param overwrite Si `TRUE`, sobrescribe `path`.
#' @param zebra Si `TRUE`, banda alternada en hojas auxiliares.
#' @return (invisible) `path`
#' @family validacion
#' @export
exportar_plan_limpieza <- function(plan,
                                   x,
                                   path,
                                   autor   = NULL,
                                   titulo  = NULL,
                                   version = Sys.Date(),
                                   incluir = list(plan = TRUE,
                                                  resumen = TRUE,
                                                  secciones = TRUE,
                                                  diccionario = TRUE,
                                                  choices = TRUE,
                                                  readme = TRUE),
                                   overwrite = TRUE,
                                   zebra = TRUE) {
  stopifnot(is.data.frame(plan), "meta" %in% names(x))
  if (file.exists(path) && !isTRUE(overwrite)) {
    stop("El archivo ya existe y overwrite=FALSE: ", path, call. = FALSE)
  }

  # --- Validación de columnas mínimas (nuevo orden/ naming)
  cols_need <- c(
    "ID","Tabla","Categoría","Tipo","Nombre de regla","Objetivo",
    "Variable 1","Variable 1 - Etiqueta",
    "Variable 2","Variable 2 - Etiqueta",
    "Variable 3","Variable 3 - Etiqueta",
    "Procesamiento"
  )
  miss <- setdiff(cols_need, names(plan))
  if (length(miss) > 0) {
    stop("Faltan columnas en `plan`: ", paste(miss, collapse = ", "), call. = FALSE)
  }

  wb <- openxlsx::createWorkbook(creator = autor %||% "acnur-cleaning")

  # --------- PLAN ----------
  if (isTRUE(incluir$plan)) {
    df_plan <- .reordenar_plan(plan, x)

    sheet_plan <- .sanitize_sheet("Plan")

    widths <- rep(18, ncol(df_plan))
    nm <- names(df_plan)
    widths[match("Objetivo", nm)]        <- 60
    widths[match("Procesamiento", nm)]   <- 90
    widths[match("Nombre de regla", nm)] <- 34
    widths[match("Tabla", nm)]           <- 18
    widths[match("Categoría", nm)]       <- 24

    .add_sheet_with_table(
      wb, sheet = sheet_plan, data = df_plan,
      freeze = TRUE, filter = TRUE, wrap = TRUE, widths = widths, zebra = FALSE
    )

    # Monoespaciado para Procesamiento
    st_code <- openxlsx::createStyle(fontName = "Consolas")
    openxlsx::addStyle(wb, sheet_plan, st_code,
                       rows = 2:(nrow(df_plan)+1),
                       cols = match("Procesamiento", names(df_plan)),
                       gridExpand = TRUE, stack = TRUE)

    # ID como texto
    .force_text_column(wb, sheet_plan, col_index = match("ID", names(df_plan)), n_rows = nrow(df_plan))

    # Colorear por sección/categoría
    .shade_plan_by_section_and_type(wb, sheet_plan, df_plan)

    # Agrupar por sección y por categoría
    .group_plan_rows(wb, sheet_plan, df_plan)

    # Pulido de hoja
    .polish_sheet(wb, sheet_plan, title = titulo %||% "Plan de Limpieza – ACNUR", version = as.character(version))
  }

  # --------- RESUMEN ----------
  if (isTRUE(incluir$resumen)) {
    df_res <- .build_resumen(plan)
    sheet_res <- .sanitize_sheet("Resumen")
    .add_sheet_with_table(wb, sheet_res, df_res, freeze = TRUE, filter = FALSE, wrap = FALSE, zebra = zebra)
    .polish_sheet(wb, sheet_res, title = titulo, version = as.character(version))
  }

  # --------- SECCIONES ----------
  if (isTRUE(incluir$secciones)) {
    df_sec <- .build_secciones(x)
    sheet_sec <- .sanitize_sheet("Secciones")
    .add_sheet_with_table(wb, sheet_sec, df_sec, freeze = TRUE, filter = TRUE, wrap = FALSE, zebra = zebra)
    .polish_sheet(wb, sheet_sec, title = titulo, version = as.character(version))
  }

  # --------- DICCIONARIO ----------
  if (isTRUE(incluir$diccionario)) {
    df_dic <- .build_diccionario(x)
    sheet_dic <- .sanitize_sheet("Diccionario")
    .add_sheet_with_table(wb, sheet_dic, df_dic, freeze = TRUE, filter = TRUE, wrap = TRUE, zebra = zebra)
    .polish_sheet(wb, sheet_dic, title = titulo, version = as.character(version))
  }

  # --------- CHOICES ----------
  if (isTRUE(incluir$choices)) {
    df_ch <- .build_choices(x)
    sheet_ch <- .sanitize_sheet("Choices")
    .add_sheet_with_table(wb, sheet_ch, df_ch, freeze = TRUE, filter = TRUE, wrap = FALSE, zebra = zebra)
    .polish_sheet(wb, sheet_ch, title = titulo, version = as.character(version))
  }

  # --------- README ----------
  if (isTRUE(incluir$readme)) {
    df_info <- .build_readme(plan, x, autor, titulo, version, hojas_presentes = incluir)
    sheet_readme <- .sanitize_sheet("README")
    openxlsx::addWorksheet(wb, sheet_readme)
    openxlsx::writeData(wb, sheet_readme, df_info, withFilter = FALSE, headerStyle = .make_header_style())
    openxlsx::addStyle(wb, sheet_readme, .make_body_style(wrap = TRUE),
                       rows = 2:(nrow(df_info)+1), cols = 1:ncol(df_info), gridExpand = TRUE)
    openxlsx::freezePane(wb, sheet_readme, firstRow = TRUE)
    openxlsx::setColWidths(wb, sheet_readme, cols = 1:2, widths = c(35, 120))
    .polish_sheet(wb, sheet_readme, title = titulo, version = as.character(version))

    # Hyperlinks rápidos (debajo del TOC)
    toc_rows <- which(df_info$Seccion == "Tabla de contenidos")
    if (length(toc_rows)) {
      r <- toc_rows + 1L
      c <- 2L
      if (isTRUE(incluir$plan))       { openxlsx::writeFormula(wb, sheet_readme, x = '=HYPERLINK("#\'Plan\'!A1","Ir a Plan")', startCol = c, startRow = r); r <- r + 1L }
      if (isTRUE(incluir$resumen))    { openxlsx::writeFormula(wb, sheet_readme, x = '=HYPERLINK("#\'Resumen\'!A1","Ir a Resumen")', startCol = c, startRow = r); r <- r + 1L }
      if (isTRUE(incluir$secciones))  { openxlsx::writeFormula(wb, sheet_readme, x = '=HYPERLINK("#\'Secciones\'!A1","Ir a Secciones")', startCol = c, startRow = r); r <- r + 1L }
      if (isTRUE(incluir$diccionario)){ openxlsx::writeFormula(wb, sheet_readme, x = '=HYPERLINK("#\'Diccionario\'!A1","Ir a Diccionario")', startCol = c, startRow = r); r <- r + 1L }
      if (isTRUE(incluir$choices))    { openxlsx::writeFormula(wb, sheet_readme, x = '=HYPERLINK("#\'Choices\'!A1","Ir a Choices")', startCol = c, startRow = r) }
    }
  }

  # --------- LEYENDA ----------
  pal_map <- .get_pal_map(plan)
  .add_legend_sheet(wb, pal_map)
  .polish_sheet(wb, .sanitize_sheet("Leyenda"), title = titulo %||% "Plan de Limpieza – ACNUR", version = as.character(version))

  # --------- Guardar ----------
  dir.create(dirname(path), showWarnings = FALSE, recursive = TRUE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}
