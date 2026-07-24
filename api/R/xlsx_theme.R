# =============================================================================
# xlsx_theme.R — Tema visual unico para los entregables XLSX
# -----------------------------------------------------------------------------
# Fuente de verdad para el estilo de: libro de codigos, tablas de frecuencias
# y cruces (normal y panel). Direccion visual: MONOCROMO EDITORIAL — solo
# blanco, grises y negro; la jerarquia la cargan tipografia, espaciado y
# reglas "hairline". Zebra sutil en tablas largas.
#
# Notas de carga (pkgload::load_all): las funciones se resuelven en tiempo de
# llamada, por lo que el orden alfabetico de sourcing de R/ no afecta.
# =============================================================================

# Suprime el aviso de Excel "numero almacenado como texto" (triangulo verde)
# en un .xlsx ya escrito, SIN alterar datos ni tipos: inyecta <ignoredErrors
# numberStoredAsText="1"> por hoja. Encoding-safe (usa sub con anclas fijas en
# orden de esquema; ignoredErrors va justo antes de smartTags/drawing/.../worksheet).
# Devuelve TRUE si proceso el archivo. Silencioso ante cualquier problema.
#' @noRd
pulso_xlsx_ignore_number_warnings <- function(path) {
  if (!length(path) || is.na(path) || !file.exists(path)) return(invisible(FALSE))
  if (!requireNamespace("zip", quietly = TRUE)) return(invisible(FALSE))
  path <- normalizePath(path, mustWork = TRUE)
  tmp <- tempfile("xlsx_ignwarn_")
  dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
  ok <- tryCatch({
    utils::unzip(path, exdir = tmp)
    ws_dir <- file.path(tmp, "xl", "worksheets")
    sheets <- if (dir.exists(ws_dir)) list.files(ws_dir, pattern = "\\.xml$", full.names = TRUE) else character(0)
    # Anclas en ORDEN DE ESQUEMA (ignoredErrors precede a todas ellas).
    anchors <- c("<smartTags", "<drawing", "<legacyDrawing", "<oleObjects",
                 "<controls", "<picture", "<tableParts", "<extLst", "</worksheet>")
    for (sh in sheets) {
      xml <- readChar(sh, file.info(sh)$size, useBytes = TRUE)
      if (grepl("<ignoredErrors", xml, fixed = TRUE)) next
      m <- regexpr('<dimension ref="[^"]+"', xml)
      dim_ref <- if (m > 0) sub('<dimension ref="([^"]+)".*', "\\1", regmatches(xml, m)) else ""
      if (!nzchar(dim_ref) || !grepl(":", dim_ref, fixed = TRUE)) dim_ref <- "A1:XFD1048576"
      ig <- sprintf('<ignoredErrors><ignoredError sqref="%s" numberStoredAsText="1"/></ignoredErrors>', dim_ref)
      for (a in anchors) {
        if (grepl(a, xml, fixed = TRUE)) {
          xml <- sub(a, paste0(ig, a), xml, fixed = TRUE)
          break
        }
      }
      con <- file(sh, open = "wb")
      writeChar(xml, con, nchars = nchar(xml, type = "bytes"), useBytes = TRUE, eos = NULL)
      close(con)
    }
    all_files <- list.files(tmp, recursive = TRUE, all.files = TRUE, no.. = TRUE)
    if (file.exists(path)) unlink(path)
    # modo espejo (default): preserva la estructura de directorios relativa a root.
    zip::zip(zipfile = path, files = all_files, root = tmp)
    TRUE
  }, error = function(e) FALSE)
  invisible(ok)
}

#' Paleta monocroma de los entregables XLSX
#' @noRd
pulso_xlsx_palette <- function() {
  list(
    bg          = "#FFFFFF",  # fondo (con gridlines apagadas la hoja ya es blanca)
    ink         = "#111111",  # texto principal casi-negro (editorial)
    ink_soft    = "#6B7280",  # notas, footers, leyendas
    rule        = "#D0D5DD",  # regla hairline gris (reemplaza el borde negro)
    rule_strong = "#9AA3AF",  # regla de encabezado, apenas mas marcada
    zebra       = "#FAFAFA",  # sombreado alterno casi invisible
    # Semaforo: color FUNCIONAL (codificacion de dato), fuera del monocromo.
    # Solo lo usa reporte_cruces modo="dimensiones" (no aparece en panel).
    sem_rojo    = "#F8D7DA",
    sem_amarillo= "#FFF3CD",
    sem_verde   = "#D4EDDA"
  )
}

#' Fuente de casa para los XLSX
#' @noRd
pulso_xlsx_font <- function() "Arial"

# =============================================================================
# Firma de color de recodificaciones (feature: cfg$color_recodificaciones)
# -----------------------------------------------------------------------------
# La codificacion crea variables `<var>_recod` (SM, SO, INTEGER). Cuando el
# switch de Analitica esta encendido (default TRUE), los entregables resaltan
# esas variables con una firma de color POR TIPO (SM verde, SO azul, INTEGER
# morado). El tono es SUAVE (pastel muy claro): se nota sin competir con el
# texto. Para los dummies de select_multiple (`<var>_recod.<code>`) el tipo se
# resuelve desde la variable padre en el survey, de modo que salgan VERDES (SM)
# y no en el lavanda generico (que solo es fallback cuando el tipo no se resuelve).
# =============================================================================

#' Paleta suave de la firma de recodificaciones (pastel claro por tipo)
#' @noRd
pulso_recod_palette <- function() {
  list(
    # Superficie (BBDD columnas `_recod`, choices del instrumento).
    sm  = "#EEF8EE", so  = "#EAF2FF", int = "#F2EBF9",
    # Fila del survey del instrumento: un matiz apenas mas marcado, misma familia.
    sm_row = "#E3F3E3", so_row = "#DEEDFF", int_row = "#E9DFF5",
    # Fallback cuando no se puede resolver el tipo: lavanda muy claro.
    generic = "#F2EBF9",
    # Tinte MUY tenue, exclusivo del CUERPO de la TABLA `Codigo | Etiqueta` del
    # libro de codigos: se nota apenas y no compite con el texto.
    sm_faint = "#F4FBF4", so_faint = "#F4F9FF", int_faint = "#FAF6FD",
    generic_faint = "#FAF6FD",
    # Encabezado `Codigo | Etiqueta` de la tabla recod: un paso mas oscuro que el
    # cuerpo faint (misma familia por tipo), analogo al header gris vs cuerpo
    # blanco de las tablas normales. Sigue siendo suave.
    sm_head = "#E4F3E4", so_head = "#E4F0FF", int_head = "#EFE6F8",
    generic_head = "#EFE6F8"
  )
}

# ¿El nombre de variable/columna corresponde a una recodificacion? Cubre el
# sufijo `_recod`, sus dummies de select_multiple (`<var>_recod/<code>`,
# `<var>_recod.<code>`) y variantes `_recod_label`.
#' @noRd
pulso_recod_is_name <- function(name) {
  nm <- as.character(name %||% "")
  grepl("_recod", nm, fixed = TRUE)
}

# Clasifica el tipo de recod a partir de la columna `type` del survey XLSForm.
# Devuelve "sm" | "so" | "int" | NA_character_.
#' @noRd
pulso_recod_type_from_xlsform <- function(type_str) {
  t <- tolower(trimws(as.character(type_str %||% "")))
  if (!nzchar(t)) return(NA_character_)
  if (startsWith(t, "select_multiple")) return("sm")
  if (startsWith(t, "select_one"))      return("so")
  if (startsWith(t, "integer") || startsWith(t, "decimal") || startsWith(t, "range")) return("int")
  NA_character_
}

# Construye el mapa `nombre_variable -> tipo` ("sm"/"so"/"int") desde el survey
# de un rp_inst. Incluye tanto las variables originales como las `_recod`.
#' @noRd
pulso_recod_type_map <- function(survey) {
  if (is.null(survey) || !all(c("type", "name") %in% names(survey))) return(list())
  nm <- as.character(survey$name); tp <- as.character(survey$type)
  out <- list()
  for (i in seq_along(nm)) {
    t <- pulso_recod_type_from_xlsform(tp[i])
    if (!is.na(t) && !is.na(nm[i]) && nzchar(nm[i])) out[[nm[i]]] <- t
  }
  out
}

# Resuelve el tipo de una columna/bloque recod (incluidos los dummies de SM).
# Estrategia: quita el sufijo de dummy `.N`/`/N`, prueba el nombre recod tal
# cual y, si no esta en el mapa, quita `_recod` para caer en la variable padre
# ORIGINAL. Devuelve "sm"/"so"/"int" o NA si no se puede resolver.
#' @noRd
pulso_recod_resolve_type <- function(name, type_map = NULL) {
  if (is.null(type_map) || !length(type_map)) return(NA_character_)
  nm <- as.character(name %||% "")
  base <- sub("[./][0-9]+$", "", nm)                 # <var>_recod.96 -> <var>_recod
  candidates <- unique(c(base, sub("_recod$", "", base)))  # + variable padre original
  for (k in candidates) {
    v <- type_map[[k]]
    if (!is.null(v) && !is.na(v) && nzchar(v)) return(v)
  }
  NA_character_
}

# Color de superficie (relleno de area) para un tipo de recod. NA -> generico.
#' @noRd
pulso_recod_area_color <- function(tp) {
  pal <- pulso_recod_palette()
  switch(as.character(tp %||% ""),
         sm = pal$sm, so = pal$so, int = pal$int, pal$generic)
}

# Tinte MUY tenue para el CUERPO de la tabla `Codigo | Etiqueta` del libro de
# codigos. Solo las celdas de la tabla llevan color (no el nombre ni la etiqueta
# de la variable). NA -> generico tenue.
#' @noRd
pulso_recod_codebook_color <- function(tp) {
  pal <- pulso_recod_palette()
  switch(as.character(tp %||% ""),
         sm = pal$sm_faint, so = pal$so_faint, int = pal$int_faint, pal$generic_faint)
}

# Tinte del ENCABEZADO `Codigo | Etiqueta` de la tabla recod: un paso mas oscuro
# que el cuerpo (misma familia por tipo). NA -> generico.
#' @noRd
pulso_recod_codebook_header_color <- function(tp) {
  pal <- pulso_recod_palette()
  switch(as.character(tp %||% ""),
         sm = pal$sm_head, so = pal$so_head, int = pal$int_head, pal$generic_head)
}

# Estilo de relleno para un color de recod (createStyle con fgFill).
#' @noRd
pulso_recod_fill_style <- function(hex) {
  openxlsx::createStyle(fgFill = hex)
}

# Resalta en una hoja XLSX las COLUMNAS `_recod` (cabecera + celdas de datos)
# con el color de recod POR TIPO. `colnames` es el vector de nombres tecnicos en
# el orden de las columnas escritas; `type_map` (de pulso_recod_type_map) resuelve
# el tipo, incluidos los dummies de SM. Sin mapa, cae al generico. No hace nada
# si `enabled` es FALSE. stack = TRUE preserva el resto de formato.
#' @noRd
pulso_xlsx_highlight_recod_cols <- function(wb, sheet, colnames,
                                            header_rows = 1L,
                                            first_data_row = NULL,
                                            last_data_row = NULL,
                                            enabled = TRUE,
                                            type_map = NULL) {
  if (!isTRUE(enabled)) return(invisible(NULL))
  cols <- which(pulso_recod_is_name(colnames))
  if (!length(cols)) return(invisible(NULL))
  for (c in cols) {
    hex <- pulso_recod_area_color(pulso_recod_resolve_type(colnames[c], type_map))
    style <- pulso_recod_fill_style(hex)
    rows <- as.integer(header_rows)
    if (!is.null(first_data_row) && !is.null(last_data_row) && last_data_row >= first_data_row) {
      rows <- c(rows, seq.int(first_data_row, last_data_row))
    }
    openxlsx::addStyle(wb, sheet, style, rows = rows, cols = c,
                       gridExpand = TRUE, stack = TRUE)
  }
  invisible(NULL)
}

# Estilos de borde reutilizables para dar un "cuadro" claro a cada tabla:
# marco exterior (arriba/abajo/izq/der) y separador vertical entre grupos de cruce.
# Minimalismo con claridad: gris medio (rule_strong), no negro.
#' @noRd
pulso_xlsx_rules <- function() {
  pal <- pulso_xlsx_palette()
  th  <- function(sides) openxlsx::createStyle(border = sides, borderStyle = "thin",
                                               borderColour = pal$rule_strong)
  list(
    box_top    = th("top"),
    box_bottom = th("bottom"),
    box_left   = th("left"),
    box_right  = th("right"),
    sep_left   = th("left")  # separador vertical entre grupos (Sexo | Edad | NSE)
  )
}

# Dibuja un cuadro alrededor de una region (r1:r2 x c1:c2) con separadores
# verticales opcionales en sep_cols (borde izquierdo). stack=TRUE preserva
# rellenos/formatos ya aplicados. Es la forma unica de "cerrar" una tabla.
#' @noRd
pulso_xlsx_box <- function(wb, sheet, r1, r2, c1, c2, sep_cols = integer(0)) {
  if (r2 < r1 || c2 < c1) return(invisible(NULL))
  ru <- pulso_xlsx_rules()
  openxlsx::addStyle(wb, sheet, ru$box_top,    rows = r1,     cols = c1:c2, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, ru$box_bottom, rows = r2,     cols = c1:c2, gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, ru$box_left,   rows = r1:r2,  cols = c1,    gridExpand = TRUE, stack = TRUE)
  openxlsx::addStyle(wb, sheet, ru$box_right,  rows = r1:r2,  cols = c2,    gridExpand = TRUE, stack = TRUE)
  sep_cols <- sep_cols[sep_cols > c1 & sep_cols <= c2]
  for (sc in unique(sep_cols)) {
    openxlsx::addStyle(wb, sheet, ru$sep_left, rows = r1:r2, cols = sc, gridExpand = TRUE, stack = TRUE)
  }
  invisible(NULL)
}

# Helper interno: crea una hoja con las gridlines apagadas (fondo blanco en todo
# el documento). Reemplaza el patron de "pintar un canvas blanco acotado", que
# era el origen del bug "el fondo no sale en todo el documento".
#' @noRd
pulso_xlsx_new_sheet <- function(wb, sheet, ...) {
  ok <- tryCatch(
    "gridLines" %in% names(formals(openxlsx::addWorksheet)),
    error = function(e) FALSE
  )
  if (isTRUE(ok)) {
    openxlsx::addWorksheet(wb, sheet, gridLines = FALSE, ...)
  } else {
    openxlsx::addWorksheet(wb, sheet, ...)
  }
  # Doble seguro por si la version de openxlsx ignora el argumento anterior.
  if ("showGridLines" %in% getNamespaceExports("openxlsx")) {
    try(openxlsx::showGridLines(wb, sheet, showGridLines = FALSE), silent = TRUE)
  }
  invisible(wb)
}

# Apaga las gridlines de una hoja YA creada (para motores que crean la hoja por
# su cuenta y no pueden usar pulso_xlsx_new_sheet directamente).
#' @noRd
pulso_xlsx_hide_gridlines <- function(wb, sheet) {
  if ("showGridLines" %in% getNamespaceExports("openxlsx")) {
    try(openxlsx::showGridLines(wb, sheet, showGridLines = FALSE), silent = TRUE)
  }
  invisible(wb)
}

#' Diccionario de estilos createStyle segun contexto
#'
#' @param context "freq", "cruces" o "codebook". Devuelve una lista con las
#'   mismas keys que consumen los writers de cada motor, pero con la paleta
#'   monocroma y reglas hairline.
#' @noRd
pulso_xlsx_styles <- function(context = c("freq", "cruces", "codebook")) {
  context <- match.arg(context)
  pal <- pulso_xlsx_palette()
  ft  <- pulso_xlsx_font()

  cs <- function(...) openxlsx::createStyle(fontName = ft, ...)

  # --- Roles comunes -------------------------------------------------------
  sec_title <- cs(
    fontSize = 14, textDecoration = "bold",
    halign = "center", valign = "center", wrapText = TRUE,
    fontColour = pal$ink, fgFill = pal$bg
  )
  q_title <- cs(
    fontSize = 11, textDecoration = "italic",
    halign = "left", valign = "center", wrapText = TRUE,
    fontColour = pal$ink, fgFill = pal$bg
  )
  header <- cs(
    fontSize = 10, textDecoration = "bold",
    border = "bottom", borderStyle = "thin", borderColour = pal$rule_strong,
    halign = "center", valign = "center", wrapText = TRUE,
    fontColour = pal$ink, fgFill = pal$bg
  )
  header_A <- cs(
    fontSize = 10, textDecoration = "bold",
    border = "bottom", borderStyle = "thin", borderColour = pal$rule_strong,
    halign = "left", valign = "center", wrapText = TRUE,
    fontColour = pal$ink, fgFill = pal$bg
  )
  body_txt <- cs(
    fontSize = 10, halign = "left", valign = "center", wrapText = TRUE,
    fontColour = pal$ink, fgFill = pal$bg
  )
  body_int <- cs(
    fontSize = 10, numFmt = "#,##0", halign = "right", valign = "center",
    fontColour = pal$ink, fgFill = pal$bg
  )
  body_num <- cs(
    fontSize = 10, numFmt = "#,##0.0", halign = "right", valign = "center",
    fontColour = pal$ink, fgFill = pal$bg
  )
  body_pct <- cs(
    fontSize = 10, numFmt = "0.0%", halign = "right", valign = "center",
    fontColour = pal$ink, fgFill = pal$bg
  )
  note <- cs(
    fontSize = 9, textDecoration = "italic",
    halign = "left", valign = "center", wrapText = TRUE,
    fontColour = pal$ink_soft, fgFill = pal$bg
  )
  # Regla hairline de cierre de tabla / separadores.
  table_rule <- openxlsx::createStyle(
    border = "bottom", borderStyle = "thin", borderColour = pal$rule
  )
  header_rule <- openxlsx::createStyle(
    border = "bottom", borderStyle = "thin", borderColour = pal$rule_strong
  )

  # Variantes zebra (mismas props que body pero con fgFill = zebra).
  zebra_txt <- cs(
    fontSize = 10, halign = "left", valign = "center", wrapText = TRUE,
    fontColour = pal$ink, fgFill = pal$zebra
  )
  zebra_int_r <- cs(
    fontSize = 10, numFmt = "#,##0", halign = "right", valign = "center",
    fontColour = pal$ink, fgFill = pal$zebra
  )
  zebra_pct_r <- cs(
    fontSize = 10, numFmt = "0.0%", halign = "right", valign = "center",
    fontColour = pal$ink, fgFill = pal$zebra
  )
  zebra_int_c <- cs(
    fontSize = 10, numFmt = "#,##0", halign = "center", valign = "center",
    fontColour = pal$ink, fgFill = pal$zebra
  )
  zebra_pct_c <- cs(
    fontSize = 10, numFmt = "0.0%", halign = "center", valign = "center",
    fontColour = pal$ink, fgFill = pal$zebra
  )

  if (context == "freq") {
    return(list(
      sec_title = sec_title,
      q_title   = q_title,
      header    = header,
      body_txt  = body_txt,
      body_int  = body_int,
      body_num  = body_num,
      body_pct  = body_pct,
      total_row = cs(fontSize = 10, numFmt = "#,##0", halign = "right",
                     valign = "center", fontColour = pal$ink, fgFill = pal$bg),
      # variantes "freq_*" (conteos/% centrados) que usa write_one_freq
      freq_body_int  = cs(fontSize = 10, numFmt = "#,##0", halign = "center",
                          valign = "center", fontColour = pal$ink, fgFill = pal$bg),
      freq_body_pct  = cs(fontSize = 10, numFmt = "0.0%", halign = "center",
                          valign = "center", fontColour = pal$ink, fgFill = pal$bg),
      freq_total_num = cs(fontSize = 10, numFmt = "#,##0", halign = "center",
                          valign = "center", textDecoration = "bold",
                          fontColour = pal$ink, fgFill = pal$bg),
      freq_total_pct = cs(fontSize = 10, numFmt = "0.0%", halign = "center",
                          valign = "center", textDecoration = "bold",
                          fontColour = pal$ink, fgFill = pal$bg),
      total_label = cs(fontSize = 10, textDecoration = "bold", halign = "left",
                       valign = "center", fontColour = pal$ink, fgFill = pal$bg),
      table_end   = table_rule,
      # zebra (centrado, como el cuerpo de frecuencias)
      zebra_txt     = zebra_txt,
      zebra_int     = zebra_int_c,
      zebra_pct     = zebra_pct_c,
      note          = note
    ))
  }

  if (context == "cruces") {
    # Valores n/% CENTRADOS bajo sus encabezados (n/%), tambien centrados.
    body_int_c <- cs(fontSize = 10, numFmt = "#,##0", halign = "center",
                     valign = "center", fontColour = pal$ink, fgFill = pal$bg)
    body_num_c <- cs(fontSize = 10, numFmt = "#,##0.0", halign = "center",
                     valign = "center", fontColour = pal$ink, fgFill = pal$bg)
    body_pct_c <- cs(fontSize = 10, numFmt = "0.0%", halign = "center",
                     valign = "center", fontColour = pal$ink, fgFill = pal$bg)
    return(list(
      sec_title  = sec_title,
      q_title    = q_title,
      header     = header,
      header_A   = header_A,
      body_txt   = body_txt,
      body_int   = body_int_c,
      body_num   = body_num_c,
      body_pct   = body_pct_c,
      note       = note,
      total_bold = cs(textDecoration = "bold", fontColour = pal$ink),
      table_end  = table_rule,
      footer_top = header_rule,
      cell       = cs(fontSize = 10, halign = "center", valign = "center",
                      fontColour = pal$ink, fgFill = pal$bg),
      # zebra centrada, igual que el cuerpo
      zebra_txt  = zebra_txt,
      zebra_int  = zebra_int_c,
      zebra_pct  = zebra_pct_c
    ))
  }

  # context == "codebook"
  list(
    st_varname  = cs(fontSize = 10, textDecoration = "italic",
                     halign = "left", valign = "center",
                     fontColour = pal$ink, fgFill = pal$bg),
    st_val_row  = openxlsx::createStyle(border = "bottom",
                                        borderStyle = "thin", borderColour = pal$rule_strong),
    # Fila de "Etiqueta": la pregunta puede ser larga -> wrap.
    st_attr_lbl = cs(fontSize = 10, halign = "left", valign = "top", wrapText = TRUE,
                     fontColour = pal$ink, fgFill = pal$bg),
    st_vals     = cs(fontSize = 10, halign = "left", valign = "top",
                     wrapText = TRUE, fontColour = pal$ink, fgFill = pal$bg),
    st_btm      = openxlsx::createStyle(border = "bottom", borderStyle = "thin",
                                        borderColour = pal$rule_strong)
  )
}
