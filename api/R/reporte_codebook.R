#' Generar libro de códigos en Excel a partir de una base de reporte
#'
#' `reporte_codebook()` toma una base ya adaptada para reporte (típicamente el
#' resultado de [reporte_data()]) y genera un libro de códigos en formato Excel.
#' La información se toma de los atributos de cada variable:
#' \itemize{
#'   \item `attr(, "label")` para la etiqueta de la variable.
#'   \item `attr(, "labels")` para los value-labels (códigos y etiquetas).
#' }
#'
#' Opcionalmente, si el objeto `data` conserva el atributo
#' `instrumento_reporte` (tal como lo asigna [reporte_data()]) y este contiene
#' un elemento `orders_list`, se utilizará como insumo adicional para el
#' orden y descripción de los valores.
#'
#' El layout del Excel sigue una estructura pensada para documentación:
#' \enumerate{
#'   \item Nombre de la variable en una fila propia (itálica).
#'   \item Fila de "Atributos estándar" con la etiqueta de la variable.
#'   \item Bloque "Valores válidos" con códigos y etiquetas, en columnas
#'         separadas.
#' }
#'
#' El argumento `codigos_solo_si_presentes` permite que ciertos códigos
#' (por ejemplo, 96, 97, 98, 99) solo se documenten en el bloque de "Valores
#' válidos" si efectivamente aparecen en la base de datos para la variable
#' correspondiente. De esta forma, se evita llenar el codebook con códigos
#' de respuesta especiales que no se usaron en la práctica.
#'
#' @param data Un `data.frame` o `tibble`, idealmente el objeto devuelto por
#'   [reporte_data()], que contiene los atributos `label` y `labels`.
#' @param path_xlsx Ruta del archivo Excel a generar. Por defecto
#'   `"codebook_from_data.xlsx"`.
#' @param sheet Nombre de la hoja donde se escribirá el codebook. Por defecto
#'   `"Codebook"`.
#' @param ord Lista opcional con información adicional de orden y etiquetas
#'   (por ejemplo, `orders_list` generado en fases previas). Si es `NULL`,
#'   la función intentará recuperarla desde
#'   `attr(data, "instrumento_reporte")$orders_list`, si existe.
#' @param codigos_solo_si_presentes Vector opcional de códigos (por ejemplo
#'   `c(96, 97, 98, 99)`) que solo se mostrarán en el bloque de "Valores
#'   válidos" si aparecen al menos una vez en la variable correspondiente
#'   dentro de `data`. Los demás códigos se muestran siempre.
#'
#' @return Invisiblemente, la ruta normalizada del archivo Excel generado.
#'
#' @examples
#' \dontrun{
#'   rp_data <- reporte_data(data_cruda_adaptada, rp_inst)
#'   reporte_codebook(
#'     rp_data,
#'     path_xlsx = "codebook_OPS_EES.xlsx",
#'     codigos_solo_si_presentes = c(96, 97, 98, 99)
#'   )
#' }
#'
#' @family reporte
#' @export
reporte_codebook <- function(data,
                             path_xlsx = "codebook_from_data.xlsx",
                             sheet     = "Codebook",
                             ord       = NULL,
                             codigos_solo_si_presentes = NULL) {

  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para `reporte_codebook()`. ",
         "Instálalo con install.packages('openxlsx').", call. = FALSE)
  }

  if (!is.data.frame(data)) {
    stop("`data` debe ser un data.frame o tibble.", call. = FALSE)
  }

  # Si no se pasa ord, intentar recuperarlo desde el instrumento asociado
  if (is.null(ord)) {
    instr <- attr(data, "instrumento_reporte", exact = TRUE)
    if (!is.null(instr) && !is.null(instr$orders_list)) {
      ord <- instr$orders_list
    }
  }

  # Nombre simbólico del data.frame (por si se quisiera registrar)
  df_name <- deparse(substitute(data))

  .write_codebook_from_df(
    df      = data,
    ord     = ord,
    outfile = path_xlsx,
    sheet   = sheet,
    df_name = df_name,
    codigos_solo_si_presentes = codigos_solo_si_presentes
  )
}

# -------------------------------------------------------------------
# Helper interno: escritura del codebook en Excel
# -------------------------------------------------------------------
#' @noRd
.write_codebook_from_df <- function(df,
                                    ord     = NULL,  # opcional: ord$orders_list
                                    outfile = "codebook_from_data.xlsx",
                                    sheet   = "Codebook",
                                    df_name = "df",
                                    codigos_solo_si_presentes = NULL) {

  if (!requireNamespace("openxlsx", quietly = TRUE)) {
    stop("El paquete 'openxlsx' es necesario para generar el codebook.",
         call. = FALSE)
  }

  # Normalizar códigos condicionales a carácter (para comparar con names(labels))
  codigos_cond_chr <- if (is.null(codigos_solo_si_presentes)) {
    character(0)
  } else {
    as.character(codigos_solo_si_presentes)
  }

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, sheet)
  cur_row <- 1L

  # ---- limpiar hoja (fondo blanco básico) ----
  clearStyle <- openxlsx::createStyle(
    fgFill   = "#FFFFFF",
    fontName = "Arial",
    fontSize = 10
  )
  openxlsx::addStyle(
    wb, sheet, style = clearStyle,
    rows = 1:50000, cols = 1:5,
    gridExpand = TRUE, stack = TRUE
  )

  # ---- helper: etiqueta de variable ----
  get_var_label <- function(v) {
    vl <- attr(df[[v]], "label", exact = TRUE)
    if (!is.null(vl) && length(vl)) {
      return(as.character(vl))
    }
    if (!is.null(ord) && !is.null(ord[[v]]) && !is.null(ord[[v]]$var_label)) {
      return(as.character(ord[[v]]$var_label))
    }
    return(NA_character_)
  }

  # ---- helper: filtrar códigos según presencia en la data ----
  filter_codes_by_data <- function(v, codes, labels) {
    if (!length(codes)) return(list(codes = codes, labels = labels))
    if (!length(codigos_cond_chr)) {
      return(list(codes = codes, labels = labels))
    }
    if (!(v %in% names(df))) {
      return(list(codes = codes, labels = labels))
    }

    # valores usados en la variable (convertidos a carácter)
    used_vals  <- df[[v]]
    used_codes <- unique(as.character(used_vals))
    used_codes <- used_codes[!is.na(used_codes) & nzchar(used_codes)]

    # regla: si el código está en codigos_cond_chr y no está usado, se omite
    keep <- !(codes %in% codigos_cond_chr & !(codes %in% used_codes))

    list(
      codes  = codes[keep],
      labels = labels[keep]
    )
  }

  # ---- helper: value-labels (códigos y etiquetas) ----
  get_value_labels <- function(v) {
    lab_attr <- attr(df[[v]], "labels", exact = TRUE)

    if (!is.null(lab_attr) && length(lab_attr)) {
      # En este flujo: NOMBRES = códigos, VALORES = etiquetas
      codes_vec  <- as.character(names(lab_attr))       # "1", "2", "99"
      labels_vec <- as.character(unname(lab_attr))      # "Sí", "No", etc.

      flt <- filter_codes_by_data(v, codes_vec, labels_vec)
      if (!length(flt$codes)) return(NULL)

      return(list(codes = flt$codes, labels = flt$labels))
    }

    # fallback a ord$orders_list, si lo usas
    if (!is.null(ord) && !is.null(ord[[v]])) {
      ordv <- ord[[v]]
      if (!is.null(ordv$labels) && !is.null(ordv$names)) {
        codes_vec  <- as.character(ordv$names)
        labels_vec <- as.character(ordv$labels)

        flt <- filter_codes_by_data(v, codes_vec, labels_vec)
        if (!length(flt$codes)) return(NULL)

        return(list(codes = flt$codes, labels = flt$labels))
      }
    }

    return(NULL)
  }

  # ---- variables a procesar (que tengan labels o estén en ord) ----
  vars_all <- names(df)
  vars_with_labels <- vapply(
    vars_all,
    function(v) {
      !is.null(attr(df[[v]], "labels", exact = TRUE)) ||
        (!is.null(ord) && !is.null(ord[[v]]))
    },
    logical(1)
  )
  vars_to_write <- vars_all[vars_with_labels]

  if (length(vars_to_write) == 0L) {
    stop("No se encontraron variables con value-labels ni entradas en `ord`.",
         call. = FALSE)
  }

  # ---- estilos ----
  st_varname <- openxlsx::createStyle(
    textDecoration = "italic",
    halign = "left", valign = "center"
  )
  st_val_row  <- openxlsx::createStyle(
    border = c("top", "bottom"),
    borderStyle = "thin"
  )
  st_attr_lbl <- openxlsx::createStyle(
    halign = "left", valign = "top"
  )
  st_vals     <- openxlsx::createStyle(
    halign = "left", valign = "top",
    wrapText = TRUE
  )
  st_btm      <- openxlsx::createStyle(
    border = "bottom", borderStyle = "thin"
  )

  # ---- recorrer variables ----
  for (v in vars_to_write) {

    varlabel <- get_var_label(v)
    vl <- get_value_labels(v)
    if (is.null(vl)) next

    codes  <- trimws(as.character(vl$codes))
    labels <- trimws(as.character(vl$labels))
    n <- length(codes)
    if (n == 0L) next

    # 1) nombre de variable (itálica) en A:C
    openxlsx::writeData(
      wb, sheet, x = v,
      startCol = 1, startRow = cur_row, colNames = FALSE
    )
    openxlsx::addStyle(
      wb, sheet, style = st_varname,
      rows = cur_row, cols = 1:3, gridExpand = TRUE
    )
    cur_row <- cur_row + 1L

    # 2) fila de encabezado: solo "Valor" en la columna C
    openxlsx::writeData(
      wb, sheet, x = "Valor",
      startCol = 3, startRow = cur_row, colNames = FALSE
    )
    openxlsx::addStyle(
      wb, sheet, style = st_val_row,
      rows = cur_row, cols = 1:3, gridExpand = TRUE
    )
    cur_row <- cur_row + 1L

    # 3) fila de atributos estándar: A = "Atributos estándar",
    #    B = "Etiqueta", C = <varlabel>
    openxlsx::writeData(
      wb, sheet, x = "Atributos estándar",
      startCol = 1, startRow = cur_row, colNames = FALSE
    )
    openxlsx::writeData(
      wb, sheet, x = "Etiqueta",
      startCol = 2, startRow = cur_row, colNames = FALSE
    )
    openxlsx::writeData(
      wb, sheet,
      x = ifelse(is.na(varlabel), "", varlabel),
      startCol = 3, startRow = cur_row, colNames = FALSE
    )
    openxlsx::addStyle(
      wb, sheet, style = st_attr_lbl,
      rows = cur_row, cols = 1:3, gridExpand = TRUE
    )
    cur_row <- cur_row + 1L

    # 4) bloque "Valores válidos"
    vals_start <- cur_row
    vals_end   <- vals_start + n - 1L

    openxlsx::mergeCells(wb, sheet, cols = 1, rows = vals_start:vals_end)
    openxlsx::writeData(
      wb, sheet, x = "Valores válidos",
      startCol = 1, startRow = vals_start, colNames = FALSE
    )
    openxlsx::addStyle(
      wb, sheet, style = st_vals,
      rows = vals_start:vals_end, cols = 1, gridExpand = TRUE
    )

    # Códigos en columna B, etiquetas en columna C
    openxlsx::writeData(
      wb, sheet,
      x = codes,
      startCol = 2, startRow = vals_start, colNames = FALSE
    )
    openxlsx::writeData(
      wb, sheet,
      x = labels,
      startCol = 3, startRow = vals_start, colNames = FALSE
    )
    openxlsx::addStyle(
      wb, sheet, style = st_vals,
      rows = vals_start:vals_end, cols = 2:3, gridExpand = TRUE
    )

    # 5) borde inferior
    openxlsx::addStyle(
      wb, sheet, style = st_btm,
      rows = vals_end, cols = 1:3, gridExpand = TRUE
    )

    # espacio entre bloques
    cur_row <- vals_end + 3L
  }

  # anchos de columnas
  openxlsx::setColWidths(wb, sheet, cols = 1, widths = 18)
  openxlsx::setColWidths(wb, sheet, cols = 2, widths = 12)  # códigos
  openxlsx::setColWidths(wb, sheet, cols = 3, widths = 55)  # etiquetas y texto largo

  openxlsx::saveWorkbook(wb, outfile, overwrite = TRUE)
  message("Codebook guardado en: ", normalizePath(outfile, winslash = "/"))
  invisible(normalizePath(outfile, winslash = "/"))
}
