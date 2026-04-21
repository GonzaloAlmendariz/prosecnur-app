# Helpers de render Typst para reporte_enumeradores()

#' @keywords internal
.enum_typst_escape <- function(x) {
  x <- as.character(x)
  x[is.na(x)] <- ""
  x <- gsub("\\\\", "\\\\\\\\", x)
  x <- gsub("([#\\[\\]{}$])", "\\\\\\1", x, perl = TRUE)
  x
}

#' @keywords internal
.enum_typst_cell <- function(x, bold = FALSE) {
  txt <- .enum_typst_escape(x)
  if (isTRUE(bold)) {
    return(paste0("[*", txt, "*]"))
  }
  paste0("[", txt, "]")
}

#' @keywords internal
.enum_upper_label <- function(x) {
  x <- as.character(x)[1]
  if (is.na(x) || !nzchar(trimws(x))) return("")
  toupper(trimws(x))
}

#' @keywords internal
.enum_or <- function(x, y) {
  if (is.null(x) || !length(x)) return(y)
  if (length(x) == 1L && is.na(x)) return(y)
  x
}

#' @keywords internal
.enum_header_font_size <- function(labels, n_cols) {
  labels <- as.character(labels)
  labels[is.na(labels)] <- ""
  max_len <- if (length(labels)) max(nchar(labels), na.rm = TRUE) else 0L
  n_cols <- as.integer(n_cols)

  size <- 8.6
  if (n_cols >= 6L || max_len >= 14L) size <- 8.0
  if (n_cols >= 8L || max_len >= 20L) size <- 7.4
  if (n_cols >= 10L || max_len >= 26L) size <- 6.9
  size
}

#' @keywords internal
.enum_typst_header_cell <- function(label, size_pt = 8.2) {
  txt <- .enum_typst_escape(label)
  inset_y <- if (isTRUE(size_pt <= 7.4)) 7 else 6
  paste0(
    "table.cell(",
    "inset: (x: 4pt, y: ", inset_y, "pt), ",
    "align(center, text(fill: white, weight: \"bold\", size: ", size_pt, "pt)[",
    txt,
    "]))"
  )
}

#' @keywords internal
.enum_titled_table_block <- function(level, title, table_markup) {
  ttl <- .enum_typst_escape(as.character(title)[1])
  paste0(
    "#block(breakable: false)[\n",
    "  #heading(level: ", as.integer(level), ")[", ttl, "]\n\n",
    "  ", table_markup, "\n",
    "]"
  )
}

#' @keywords internal
typst_tabla_enumeradores <- function(
    df,
    color_header = "#1A4A7A",
    color_total_row = "#DDE5F0",
    color_total_col = "#EEF2F8",
    color_stripe = "#F7F9FC"
) {
  if (!is.data.frame(df) || !ncol(df)) return("")

  align_cols <- c("left", rep("center", max(0, ncol(df) - 1L)))
  width_cols <- c("2fr", rep("1fr", max(0, ncol(df) - 1L)))

  nm <- names(df)
  nm_upper <- vapply(nm, .enum_upper_label, character(1))
  header_size <- .enum_header_font_size(nm_upper, ncol(df))
  header_cells <- vapply(
    nm_upper,
    .enum_typst_header_cell,
    character(1),
    size_pt = header_size
  )

  total_col_idx <- which(.enum_norm_text(nm) == "total")
  total_col_pos <- if (length(total_col_idx)) as.integer(total_col_idx[1] - 1L) else -1L

  body_cells <- character(0)

  if (nrow(df)) {
    for (i in seq_len(nrow(df))) {
      row_i <- df[i, , drop = FALSE]
      row_total <- identical(.enum_norm_text(row_i[[1]]), "total")

      for (j in seq_along(row_i)) {
        col_total <- (j - 1L) == total_col_pos
        use_bold <- isTRUE(row_total || col_total)
        val <- row_i[[j]]

        if (is.numeric(val)) {
          num <- format(round(val, 0), big.mark = ",", scientific = FALSE, trim = TRUE)
          body_cells <- c(
            body_cells,
            paste0("align(right, ", .enum_typst_cell(num, bold = use_bold), ")")
          )
        } else {
          body_cells <- c(body_cells, .enum_typst_cell(val, bold = use_bold))
        }
      }
    }
  }

  n_rows <- nrow(df)
  fill_logic <- c(
    "fill: (x, y) => {",
    paste0("  if y == 0 { rgb(\"", color_header, "\") }"),
    if (total_col_pos >= 0L) paste0("  else if y == ", n_rows, " and x == ", total_col_pos, " { rgb(\"", color_total_row, "\") }") else NULL,
    paste0("  else if y == ", n_rows, " { rgb(\"", color_total_row, "\") }"),
    if (total_col_pos >= 0L) paste0("  else if x == ", total_col_pos, " { rgb(\"", color_total_col, "\") }") else NULL,
    paste0("  else if calc.odd(y) { rgb(\"", color_stripe, "\") }"),
    "  else { white }",
    "},"
  )

  content <- c(
    paste0("table.header(", paste(header_cells, collapse = ", "), ")"),
    body_cells
  )

  paste0(
    "#block(breakable: false)[\n",
    "  #table(\n",
    "    columns: (", paste(width_cols, collapse = ", "), "),\n",
    "    align: (", paste(align_cols, collapse = ", "), "),\n",
    "    inset: 4pt,\n",
    "    stroke: 0.35pt,\n",
    "    ", paste(fill_logic, collapse = "\n    "), "\n",
    "    ", paste(content, collapse = ",\n    "), "\n",
    "  )\n",
    "]"
  )
}

#' @keywords internal
typst_section_header_enumeradores <- function(
    titulo,
    color = "#1A4A7A",
    text_color = "#FFFFFF"
) {
  ttl <- .enum_typst_escape(.enum_upper_label(titulo))
  paste0(
    "#block(fill: rgb(\"", color, "\"), inset: (x: 10pt, y: 7pt), radius: 4pt)[",
    "#text(fill: rgb(\"", text_color, "\"), weight: \"bold\", size: 12pt)[", ttl, "]",
    "]"
  )
}

#' @keywords internal
typst_kpi_box_enumeradores <- function(valores, etiquetas) {
  if (!length(valores) || !length(etiquetas)) return("")
  if (length(valores) != length(etiquetas)) {
    stop("`valores` y `etiquetas` deben tener el mismo largo.", call. = FALSE)
  }

  n <- length(valores)
  labels_cells <- vapply(etiquetas, .enum_typst_cell, character(1), bold = TRUE)
  value_cells <- vapply(
    valores,
    function(x) .enum_typst_cell(format(x, big.mark = ",", scientific = FALSE), bold = FALSE),
    character(1)
  )

  paste0(
    "#table(\n",
    "  columns: (", paste(rep("1fr", n), collapse = ", "), "),\n",
    "  align: (", paste(rep("center", n), collapse = ", "), "),\n",
    "  inset: 5pt,\n",
    "  stroke: 0.35pt,\n",
    "  table.header(", paste(labels_cells, collapse = ", "), "),\n",
    "  ", paste(value_cells, collapse = ", "), "\n",
    ")"
  )
}

#' @keywords internal
construir_typst_documento_enumeradores <- function(bundle) {
  titulo <- as.character(bundle$titulo)[1]
  subtitulo <- as.character(bundle$subtitulo)[1]

  if (is.na(titulo) || !nzchar(trimws(titulo))) {
    titulo <- "Reporte de Enumeradores"
  }

  parts <- c("#set par(justify: false)")

  parts <- c(parts, paste0(
    "#align(center)[#text(size: 17pt, weight: \"bold\")[",
    .enum_typst_escape(titulo),
    "]]"
  ))

  if (!is.na(subtitulo) && nzchar(trimws(subtitulo))) {
    parts <- c(
      parts,
      paste0(
        "#align(center)[#text(size: 11pt, fill: rgb(\"#4A4A4A\"))[",
        .enum_typst_escape(subtitulo),
        "]]"
      )
    )
  }

  kpi <- bundle$kpi
  if (is.list(kpi) && length(kpi)) {
    kpi_vals <- unlist(kpi, use.names = FALSE)
    kpi_nms <- names(kpi)
    if (!is.null(kpi_nms) && length(kpi_nms) == length(kpi_vals)) {
      parts <- c(parts, typst_kpi_box_enumeradores(kpi_vals, kpi_nms))
    }
  }

  if (is.data.frame(bundle$tabla_general)) {
    parts <- c(parts, .enum_titled_table_block(
      level = 2,
      title = "RESUMEN GENERAL DE PRODUCCION POR ENUMERADOR",
      table_markup = typst_tabla_enumeradores(
        bundle$tabla_general,
        color_header = "#1A4A7A",
        color_total_row = "#DCE3ED",
        color_total_col = "#EEF2F8",
        color_stripe = "#F8FAFC"
      )
    ))
  }

  secciones <- bundle$secciones
  if (is.list(secciones) && length(secciones)) {
    for (sec in secciones) {
      sec_titulo <- as.character(sec$modalidad)[1]
      sec_style <- sec$style
      color_sec <- as.character(.enum_or(sec_style$section, "#1A4A7A"))[1]
      color_tab <- as.character(.enum_or(sec_style$table_header, color_sec))[1]
      color_tot_row <- as.character(.enum_or(sec_style$total_row, "#DDE5F0"))[1]
      color_tot_col <- as.character(.enum_or(sec_style$total_col, "#EEF2F8"))[1]
      color_stripe <- as.character(.enum_or(sec_style$stripe, "#F7F9FC"))[1]

      parts <- c(
        parts,
        paste0(
          "#heading(level: 1)[ENCUESTAS ",
          .enum_typst_escape(.enum_upper_label(sec_titulo)),
          "]"
        )
      )

      if (is.data.frame(sec$tabla_resumen)) {
        parts <- c(parts, .enum_titled_table_block(
          level = 2,
          title = paste0(
            "RESUMEN DE PRODUCCION POR ENUMERADOR - ",
            .enum_upper_label(sec_titulo)
          ),
          table_markup = typst_tabla_enumeradores(
            sec$tabla_resumen,
            color_header = color_tab,
            color_total_row = color_tot_row,
            color_total_col = color_tot_col,
            color_stripe = color_stripe
          )
        ))
      }

      cortes <- sec$cortes
      if (is.list(cortes) && length(cortes)) {
        for (ct in cortes) {
          ct_name <- as.character(ct$nombre)[1]
          if (is.data.frame(ct$tabla)) {
            parts <- c(parts, .enum_titled_table_block(
              level = 3,
              title = paste0(
                "PRODUCCION POR ENUMERADOR SEGUN ",
                .enum_upper_label(ct_name),
                " - ",
                .enum_upper_label(sec_titulo)
              ),
              table_markup = typst_tabla_enumeradores(
                ct$tabla,
                color_header = color_tab,
                color_total_row = color_tot_row,
                color_total_col = color_tot_col,
                color_stripe = color_stripe
              )
            ))
          }
        }
      }
    }
  }

  paste(parts, collapse = "\n\n")
}
