# Writers XLSX de los comparativos armonizados (contrato E4-E7, R4)
# ===============================================================
#
# Dos libros, una hoja cada uno, tablas apiladas, misma estética que
# frecuencias y cruces (`xlsx_theme.R`, monocromo Pulso). La geometría replica
# la maqueta aprobada por la OIGD («HSyVBG PUCP 2026_Lista y formato de
# entregables.xlsx», hojas «Comparativo simple 2024-2026» y «Comparativo
# cruces 2024-2026»):
#
#   Comparativo simple  períodos en columnas (N y %), filas = escala + Total,
#                       sin Total combinado entre períodos, % a dos decimales.
#   Comparativo cruces  Respuesta × período en filas (respuesta combinada en
#                       vertical), banner de cruces en columnas (n y %), y la
#                       subtabla de letras calculadas DENTRO de cada período.
#
# Los modelos llegan calculados desde `analitica_armonizada.R`; aquí sólo se
# dibuja. Las notas al pie usan el bloque `notas` de Analítica
# (`reporte_notas_pie.R`). Textos sin raya, sin punto medio y sin punto y coma.

.COMPARATIVO_NA <- "n.a."
.COMPARATIVO_NC <- "n.c."

# Estilos del comparativo: los de cruces del tema más las tres variantes que
# la maqueta pide (marca gris en cursiva, % a dos decimales, total en negrita).
.comparativo_estilos <- function(pct_fmt = "0.0%") {
  st <- pulso_xlsx_styles("cruces")
  pal <- pulso_xlsx_palette()
  ft <- pulso_xlsx_font()
  cs <- function(...) openxlsx::createStyle(fontName = ft, fontSize = 10, valign = "center",
                                            fontColour = pal$ink, ...)
  for (fill in c("bg", "zebra")) {
    sfx <- if (fill == "bg") "" else "_z"
    st[[paste0("c_txt", sfx)]] <- cs(halign = "left", wrapText = TRUE, fgFill = pal[[fill]])
    st[[paste0("c_lbl", sfx)]] <- cs(halign = "center", fgFill = pal[[fill]])
    st[[paste0("c_int", sfx)]] <- cs(halign = "center", numFmt = "#,##0", fgFill = pal[[fill]])
    st[[paste0("c_pct", sfx)]] <- cs(halign = "center", numFmt = pct_fmt, fgFill = pal[[fill]])
    st[[paste0("c_marca", sfx)]] <- openxlsx::createStyle(
      fontName = ft, fontSize = 10, textDecoration = "italic", halign = "center",
      valign = "center", fontColour = pal$ink_soft, fgFill = pal[[fill]])
  }
  st$c_head <- openxlsx::createStyle(fontName = ft, fontSize = 10, textDecoration = "bold",
                                     halign = "center", valign = "center", wrapText = TRUE,
                                     fontColour = pal$ink, fgFill = pal$bg)
  st$c_bold <- openxlsx::createStyle(textDecoration = "bold")
  st$c_regla <- openxlsx::createStyle(border = "bottom", borderStyle = "thin",
                                      borderColour = pal$rule)
  st$c_top <- openxlsx::createStyle(border = "top", borderStyle = "thin",
                                    borderColour = pal$rule_strong)
  st$c_bottom <- openxlsx::createStyle(border = "bottom", borderStyle = "thin",
                                       borderColour = pal$rule_strong)
  st
}

.comparativo_put <- function(wb, hoja, fila, col, valor, estilo) {
  openxlsx::writeData(wb, hoja, valor, startRow = fila, startCol = col, colNames = FALSE)
  openxlsx::addStyle(wb, hoja, estilo, rows = fila, cols = col, stack = FALSE)
}

.comparativo_titulo <- function(wb, hoja, st, fila, texto, ncol, seccion = FALSE) {
  .comparativo_put(wb, hoja, fila, 1, texto, if (seccion) st$sec_title else st$q_title)
  if (ncol > 1L) openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncol)
  alto <- if (seccion) 28 else max(22, .calc_row_height(texto, col_width = min(220, 12 * ncol + 40), font_size = 11))
  openxlsx::setRowHeights(wb, hoja, rows = fila, heights = alto)
  fila + 1L
}

.comparativo_notas <- function(wb, hoja, st, fila, lineas, ncol) {
  ancho <- min(60 + 13 * (max(1L, ncol) - 1L), 220)
  for (t in lineas) {
    if (!nzchar(t)) next
    .comparativo_put(wb, hoja, fila, 1, t, st$note)
    if (ncol > 1L) openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncol)
    openxlsx::setRowHeights(wb, hoja, rows = fila,
                            heights = max(14, .calc_row_height(t, col_width = ancho, font_size = 9)))
    fila <- fila + 1L
  }
  fila
}

# Texto de base de una pregunta: `base_por_pregunta` acepta el id de la fila,
# su etiqueta estándar o cualquiera de sus variables. Si no, la base por defecto.
.comparativo_base <- function(notas, claves) {
  notas <- .notas_pie_normalizar(notas)
  bpp <- notas$base_por_pregunta
  hit <- intersect(claves, names(bpp))
  if (length(hit)) return(.notas_pie_texto(bpp[[hit[[1]]]]))
  notas$base_defecto
}

.comparativo_por_cruce <- function(notas, cruces) {
  pc <- .notas_pie_normalizar(notas)$por_cruce
  out <- vapply(cruces, function(x) {
    hit <- intersect(x$claves, names(pc))
    if (length(hit)) .notas_pie_texto(pc[[hit[[1]]]]) else ""
  }, character(1))
  unname(out[nzchar(out)])
}

# «n.c.: no comparable…». Una sola nota en minúscula se lee de corrido, como en
# la maqueta («n.c.: no comparable por diferencias en la redacción…»).
.comparativo_linea_nc <- function(partes) {
  partes <- unique(partes[nzchar(partes)])
  if (!length(partes)) return(paste0(.COMPARATIVO_NC, ": no comparable."))
  if (length(partes) == 1L && grepl("^[[:lower:]]", partes)) {
    return(paste0(.COMPARATIVO_NC, ": no comparable ", .notas_pie_cerrar(partes)))
  }
  paste0(.COMPARATIVO_NC, ": no comparable. ",
         paste(vapply(partes, .notas_pie_cerrar, character(1)), collapse = " "))
}

.comparativo_lista_rotulos <- function(rotulos) .notas_pie_unir_es(unname(rotulos))

.comparativo_sheet_setup <- function(wb, hoja) {
  pulso_xlsx_new_sheet(wb, hoja)
  openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE)
}

.comparativo_guardar <- function(wb, path) {
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  pulso_xlsx_ignore_number_warnings(path)
  invisible(path)
}

# ---- Comparativo simple -----------------------------------------------------------

#' Escribe el comparativo simple (hoja «Comparativo»).
#'
#' @param modelo Salida de `armonizada_modelo_frecuencias()`.
#' @param rotulos Rótulo por período (nombre = base), de `.armz_rotulos()`.
#' @param notas Bloque `notas` de Analítica.
#' @return Resumen: filas escritas, marcas n.c. por pregunta.
#' @keywords internal
reporte_comparativo_simple <- function(modelo, path, rotulos, notas = NULL) {
  wb <- openxlsx::createWorkbook()
  hoja <- "Comparativo"
  .comparativo_sheet_setup(wb, hoja)
  st <- .comparativo_estilos("0.00%")
  notas_n <- .notas_pie_normalizar(notas)
  periodos <- modelo$periodos
  ncol <- 1L + 2L * length(periodos)
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 58)
  openxlsx::setColWidths(wb, hoja, cols = 2:ncol, widths = 12.66)

  fila <- 1L
  seccion_previa <- NULL
  resumen <- list()
  for (q in modelo$preguntas) {
    sec <- toupper(q$seccion %||% "")
    if (nzchar(sec) && !identical(sec, seccion_previa)) {
      fila <- .comparativo_titulo(wb, hoja, st, fila, sec, ncol, seccion = TRUE) + 1L
      seccion_previa <- sec
    }
    fila <- .comparativo_titulo(wb, hoja, st, fila, q$titulo, ncol)

    # Encabezado: período combinado sobre N y %.
    h1 <- fila; h2 <- fila + 1L
    # Como en la maqueta: la fila del período no lleva regla, la de N/% sí.
    .comparativo_put(wb, hoja, h1, 1, "", st$c_head)
    .comparativo_put(wb, hoja, h2, 1, "", st$header)
    seps <- integer(0)
    for (k in seq_along(periodos)) {
      c0 <- 2L * k
      seps <- c(seps, c0)
      .comparativo_put(wb, hoja, h1, c0, rotulos[[periodos[k]]], st$c_head)
      .comparativo_put(wb, hoja, h1, c0 + 1L, "", st$c_head)
      openxlsx::mergeCells(wb, hoja, rows = h1, cols = c0:(c0 + 1L))
      .comparativo_put(wb, hoja, h2, c0, "N", st$header)
      .comparativo_put(wb, hoja, h2, c0 + 1L, "%", st$header)
    }
    fila <- h2 + 1L

    etiquetas <- c(q$escala$etiquetas, "Total")
    nc_periodos <- character(0)
    na_periodos <- character(0)
    for (i in seq_along(etiquetas)) {
      es_total <- i == length(etiquetas)
      sfx <- if (i %% 2L == 0L && !es_total) "_z" else ""
      .comparativo_put(wb, hoja, fila, 1, etiquetas[i], st[[paste0("c_txt", sfx)]])
      for (k in seq_along(periodos)) {
        b <- periodos[k]; c0 <- 2L * k
        pp <- q$periodos[[b]]
        if (!identical(pp$estado, "ok")) {
          marca <- if (identical(pp$estado, "n.c.")) .COMPARATIVO_NC else .COMPARATIVO_NA
          if (identical(marca, .COMPARATIVO_NC)) nc_periodos <- c(nc_periodos, b) else na_periodos <- c(na_periodos, b)
          .comparativo_put(wb, hoja, fila, c0, marca, st[[paste0("c_marca", sfx)]])
          .comparativo_put(wb, hoja, fila, c0 + 1L, marca, st[[paste0("c_marca", sfx)]])
          next
        }
        n <- if (es_total) pp$N else unname(pp$n[[i]])
        p <- if (es_total) 1 else unname(pp$pct[[i]])
        .comparativo_put(wb, hoja, fila, c0, n, st[[paste0("c_int", sfx)]])
        .comparativo_put(wb, hoja, fila, c0 + 1L, p, st[[paste0("c_pct", sfx)]])
      }
      if (es_total) {
        openxlsx::addStyle(wb, hoja, st$c_bold, rows = fila, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$c_top, rows = fila, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$c_bottom, rows = fila, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
      }
      fila <- fila + 1L
    }
    pulso_xlsx_box(wb, hoja, h1, fila - 1L, 1L, ncol, sep_cols = seps)

    nc_periodos <- unique(nc_periodos); na_periodos <- unique(na_periodos)
    base <- .comparativo_base(notas, q$claves)
    lineas <- c(
      paste0("Fuente: ", .notas_pie_cerrar(notas_n$fuente)),
      if (nzchar(base)) paste0("Base: ", .notas_pie_cerrar(base)) else character(0),
      if (length(nc_periodos)) .comparativo_linea_nc(unname(q$notas[nc_periodos])) else character(0),
      if (length(na_periodos)) paste0(.COMPARATIVO_NA, ": no aplica, sin casos en ",
                                      .comparativo_lista_rotulos(rotulos[na_periodos]), ".") else character(0)
    )
    fila <- .comparativo_notas(wb, hoja, st, fila, lineas, ncol) + 1L
    resumen[[length(resumen) + 1L]] <- list(titulo = q$titulo, n_c = as.list(nc_periodos),
                                            n_a = as.list(na_periodos))
  }
  .comparativo_guardar(wb, path)
  list(hoja = hoja, n_preguntas = length(modelo$preguntas), preguntas = resumen)
}

# ---- Comparativo de cruces --------------------------------------------------------

.comparativo_linea_na <- function(items, rotulos) {
  if (!length(items)) return("")
  df <- do.call(rbind, lapply(items, as.data.frame, stringsAsFactors = FALSE))
  notas_decl <- unique(df$nota[nzchar(df$nota)])
  if (length(notas_decl) && all(nzchar(df$nota))) {
    return(paste0(.COMPARATIVO_NA, ": no aplica. ",
                  paste(vapply(notas_decl, .notas_pie_cerrar, character(1)), collapse = " ")))
  }
  frases <- character(0)
  for (b in unique(df$periodo)) {
    sub <- df[df$periodo == b, , drop = FALSE]
    for (cr in unique(sub$cruce)) {
      cats <- unique(sub$categoria[sub$cruce == cr])
      frases <- c(frases, sprintf("%s (%s) %s casos en %s.",
                                  .notas_pie_unir_es(paste0("«", cats, "»")), cr,
                                  if (length(cats) > 1L) "no tienen" else "no tiene",
                                  rotulos[[b]]))
    }
  }
  paste0(.COMPARATIVO_NA, ": no aplica. ", paste(frases, collapse = " "))
}

#' Escribe el comparativo de cruces (hoja «Comparativo cruces»).
#'
#' @param modelo Salida de `armonizada_modelo_cruces()`.
#' @param alpha Nivel de significancia de las letras.
#' @param show_sig Si FALSE no se escribe la subtabla de letras.
#' @keywords internal
reporte_comparativo_cruces <- function(modelo, path, rotulos, notas = NULL,
                                       alpha = 0.05, show_sig = TRUE) {
  wb <- openxlsx::createWorkbook()
  hoja <- "Comparativo cruces"
  .comparativo_sheet_setup(wb, hoja)
  st <- .comparativo_estilos("0.0%")
  notas_n <- .notas_pie_normalizar(notas)
  periodos <- modelo$periodos
  cruces <- modelo$cruces
  ncat <- vapply(cruces, function(x) length(x$escala$codigos), integer(1))
  ncol <- 4L + 2L * sum(ncat)
  nsig <- 2L + sum(ncat)
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 30)
  openxlsx::setColWidths(wb, hoja, cols = 2, widths = 8)
  openxlsx::setColWidths(wb, hoja, cols = 3:ncol, widths = 13.5)
  openxlsx::freezePane(wb, hoja, firstActiveCol = 3)

  # Columna de inicio de cada cruce (n de su primera categoría).
  inicio <- 5L + c(0L, cumsum(2L * ncat))[seq_along(cruces)]
  inicio_sig <- 3L + c(0L, cumsum(ncat))[seq_along(cruces)]

  fila <- 1L
  seccion_previa <- NULL
  resumen <- list()
  for (q in modelo$preguntas) {
    sec <- toupper(q$seccion %||% "")
    if (nzchar(sec) && !identical(sec, seccion_previa)) {
      fila <- .comparativo_titulo(wb, hoja, st, fila, sec, ncol, seccion = TRUE) + 1L
      seccion_previa <- sec
    }
    fila <- .comparativo_titulo(wb, hoja, st, fila, q$titulo, ncol)

    # Encabezado de tres filas: grupo, categoría, n/%.
    rg <- fila; rc <- fila + 1L; rn <- fila + 2L
    for (r in c(rg, rc, rn)) {
      openxlsx::addStyle(wb, hoja, st$header, rows = r, cols = 1:ncol, gridExpand = TRUE)
    }
    openxlsx::mergeCells(wb, hoja, rows = rg, cols = 1:4)
    .comparativo_put(wb, hoja, rn, 1, "Respuesta", st$header_A)
    .comparativo_put(wb, hoja, rn, 2, "Año", st$header)
    openxlsx::writeData(wb, hoja, "Total", startRow = rc, startCol = 3)
    openxlsx::mergeCells(wb, hoja, rows = rc, cols = 3:4)
    openxlsx::writeData(wb, hoja, t(c("n", "%")), startRow = rn, startCol = 3, colNames = FALSE)
    for (j in seq_along(cruces)) {
      x <- cruces[[j]]; c0 <- inicio[j]
      openxlsx::writeData(wb, hoja, x$etiqueta, startRow = rg, startCol = c0)
      openxlsx::mergeCells(wb, hoja, rows = rg, cols = c0:(c0 + 2L * ncat[j] - 1L))
      for (k in seq_len(ncat[j])) {
        ck <- c0 + 2L * (k - 1L)
        openxlsx::writeData(wb, hoja, x$escala$etiquetas[k], startRow = rc, startCol = ck)
        openxlsx::mergeCells(wb, hoja, rows = rc, cols = ck:(ck + 1L))
        openxlsx::writeData(wb, hoja, t(c("n", "%")), startRow = rn, startCol = ck, colNames = FALSE)
      }
    }
    openxlsx::setRowHeights(wb, hoja, rows = rc, heights = 30)
    fila <- rn + 1L

    etiquetas <- c(q$escala$etiquetas, "Total")
    nc_partes <- character(0)
    na_items <- list()
    reducidas <- list()
    for (i in seq_along(etiquetas)) {
      es_total <- i == length(etiquetas)
      zebra <- (i %% 2L == 0L) && !es_total
      sfx <- if (zebra) "_z" else ""
      r0 <- fila
      .comparativo_put(wb, hoja, r0, 1, etiquetas[i], st[[paste0("c_txt", sfx)]])
      for (k in seq_along(periodos)) {
        b <- periodos[k]; rr <- r0 + k - 1L
        if (k > 1L) openxlsx::addStyle(wb, hoja, st[[paste0("c_txt", sfx)]], rows = rr, cols = 1)
        .comparativo_put(wb, hoja, rr, 2, rotulos[[b]], st[[paste0("c_lbl", sfx)]])
        pp <- q$periodos[[b]]
        celda <- function(col, n, N, p_override = NULL) {
          if (is.na(N) || N <= 0) {
            .comparativo_put(wb, hoja, rr, col, .COMPARATIVO_NA, st[[paste0("c_marca", sfx)]])
            .comparativo_put(wb, hoja, rr, col + 1L, .COMPARATIVO_NA, st[[paste0("c_marca", sfx)]])
          } else {
            .comparativo_put(wb, hoja, rr, col, if (es_total) N else n, st[[paste0("c_int", sfx)]])
            .comparativo_put(wb, hoja, rr, col + 1L, if (es_total) 1 else n / N, st[[paste0("c_pct", sfx)]])
          }
        }
        marca <- function(col, m) {
          .comparativo_put(wb, hoja, rr, col, m, st[[paste0("c_marca", sfx)]])
          .comparativo_put(wb, hoja, rr, col + 1L, m, st[[paste0("c_marca", sfx)]])
        }
        if (!identical(pp$estado, "ok")) {
          for (col in seq(3L, ncol - 1L, by = 2L)) marca(col, .COMPARATIVO_NC)
          if (i == 1L) nc_partes <- c(nc_partes, if (nzchar(q$notas[[b]])) q$notas[[b]] else
            sprintf("La pregunta no es comparable en %s", rotulos[[b]]))
          next
        }
        celda(3L, if (es_total) NA_real_ else unname(pp$total$n[i]), pp$total$N)
        for (j in seq_along(cruces)) {
          x <- cruces[[j]]; pc <- pp$cruces[[x$key]]
          for (kk in seq_len(ncat[j])) {
            ck <- inicio[j] + 2L * (kk - 1L)
            if (!identical(pc$estado, "ok")) {
              marca(ck, .COMPARATIVO_NC)
              next
            }
            Nk <- unname(pc$N_vec[kk])
            celda(ck, if (es_total) NA_real_ else unname(pc$n_mat[i, kk]), Nk)
            if (i == 1L) {
              if (Nk <= 0) {
                na_items[[length(na_items) + 1L]] <- list(
                  periodo = b, cruce = x$etiqueta, categoria = x$escala$etiquetas[kk],
                  nota = x$notas[[b]] %||% "")
              } else {
                reducidas[[length(reducidas) + 1L]] <- list(
                  variable = paste0(x$etiqueta, ", ", rotulos[[b]]),
                  columna = x$escala$etiquetas[kk], n = unname(pc$N_sin_peso[kk]))
              }
            }
          }
          if (i == 1L && !identical(pc$estado, "ok")) {
            nc_partes <- c(nc_partes, if (nzchar(x$notas[[b]])) paste0(x$etiqueta, ": ", x$notas[[b]]) else
              sprintf("%s no es comparable en %s", x$etiqueta, rotulos[[b]]))
          }
        }
      }
      r_fin <- r0 + length(periodos) - 1L
      if (length(periodos) > 1L) openxlsx::mergeCells(wb, hoja, rows = r0:r_fin, cols = 1)
      openxlsx::addStyle(wb, hoja, st$c_regla, rows = r_fin, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
      if (es_total) {
        openxlsx::addStyle(wb, hoja, st$c_bold, rows = r0:r_fin, cols = 1:2, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$c_top, rows = r0, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
      }
      fila <- r_fin + 1L
    }
    pulso_xlsx_box(wb, hoja, rg, fila - 1L, 1L, ncol, sep_cols = c(3L, inicio))

    base <- .comparativo_base(notas, q$claves)
    linea1 <- paste0("Fuente: ", .notas_pie_cerrar(notas_n$fuente),
                     if (nzchar(base)) paste0(" Base: ", .notas_pie_cerrar(base)) else "",
                     " Porcentajes por columna dentro de cada año.")
    linea_na <- .comparativo_linea_na(na_items, rotulos)
    linea_red <- if (isTRUE(notas_n$base_reducida$activo) && length(reducidas)) {
      .notas_pie_linea_base_reducida(do.call(rbind, lapply(reducidas, as.data.frame, stringsAsFactors = FALSE)),
                                     notas_n$base_reducida$umbral)
    } else ""
    linea_nc <- if (length(nc_partes)) .comparativo_linea_nc(nc_partes) else ""
    lineas <- c(linea1, .comparativo_por_cruce(notas, cruces), linea_nc, linea_na, linea_red)
    fila <- .comparativo_notas(wb, hoja, st, fila, lineas, ncol) + 1L

    if (isTRUE(show_sig) && length(cruces)) {
      fila <- .comparativo_titulo(wb, hoja, st, fila, "Comparaciones de proporciones de columna", nsig)
      sg <- fila; sc <- fila + 1L
      for (r in c(sg, sc)) openxlsx::addStyle(wb, hoja, st$header, rows = r, cols = 1:nsig, gridExpand = TRUE)
      openxlsx::mergeCells(wb, hoja, rows = sg, cols = 1:2)
      .comparativo_put(wb, hoja, sc, 1, "Respuesta", st$header_A)
      .comparativo_put(wb, hoja, sc, 2, "Año", st$header)
      for (j in seq_along(cruces)) {
        x <- cruces[[j]]; c0 <- inicio_sig[j]
        openxlsx::writeData(wb, hoja, x$etiqueta, startRow = sg, startCol = c0)
        if (ncat[j] > 1L) openxlsx::mergeCells(wb, hoja, rows = sg, cols = c0:(c0 + ncat[j] - 1L))
        hdr <- paste0(x$escala$etiquetas, " (", LETTERS[seq_len(ncat[j])], ")")
        openxlsx::writeData(wb, hoja, t(hdr), startRow = sc, startCol = c0, colNames = FALSE)
      }
      openxlsx::setRowHeights(wb, hoja, rows = sc, heights = 58)
      fila <- sc + 1L
      for (i in seq_along(q$escala$etiquetas)) {
        sfx <- if (i %% 2L == 0L) "_z" else ""
        r0 <- fila
        .comparativo_put(wb, hoja, r0, 1, q$escala$etiquetas[i], st[[paste0("c_txt", sfx)]])
        for (k in seq_along(periodos)) {
          b <- periodos[k]; rr <- r0 + k - 1L
          if (k > 1L) openxlsx::addStyle(wb, hoja, st[[paste0("c_txt", sfx)]], rows = rr, cols = 1)
          .comparativo_put(wb, hoja, rr, 2, rotulos[[b]], st[[paste0("c_lbl", sfx)]])
          pp <- q$periodos[[b]]
          for (j in seq_along(cruces)) {
            x <- cruces[[j]]
            pc <- if (identical(pp$estado, "ok")) pp$cruces[[x$key]] else list(estado = "n.c.")
            for (kk in seq_len(ncat[j])) {
              col <- inicio_sig[j] + kk - 1L
              if (!identical(pc$estado, "ok")) {
                .comparativo_put(wb, hoja, rr, col, .COMPARATIVO_NC, st[[paste0("c_marca", sfx)]])
              } else {
                v <- pc$letras[i, kk]
                est <- if (identical(v, .COMPARATIVO_NA)) st[[paste0("c_marca", sfx)]] else st[[paste0("c_lbl", sfx)]]
                .comparativo_put(wb, hoja, rr, col, v, est)
              }
            }
          }
        }
        r_fin <- r0 + length(periodos) - 1L
        if (length(periodos) > 1L) openxlsx::mergeCells(wb, hoja, rows = r0:r_fin, cols = 1)
        openxlsx::addStyle(wb, hoja, st$c_regla, rows = r_fin, cols = 1:nsig, gridExpand = TRUE, stack = TRUE)
        fila <- r_fin + 1L
      }
      pulso_xlsx_box(wb, hoja, sg, fila - 1L, 1L, nsig, sep_cols = c(3L, inicio_sig))
      sig <- paste0(.notas_pie_significancia("z", alpha), " Las comparaciones se hacen dentro de cada año.")
      # El pie de la subtabla va al ancho de la tabla principal, como en la
      # maqueta: a su propio ancho la nota de significancia ocupa cuatro renglones.
      fila <- .comparativo_notas(wb, hoja, st, fila, c(sig, linea_nc, linea_na), ncol) + 1L
    }
    fila <- fila + 1L
    resumen[[length(resumen) + 1L]] <- list(
      titulo = q$titulo,
      n_c = as.list(unique(nc_partes)),
      n_a = lapply(na_items, function(it) it[c("periodo", "cruce", "categoria")]),
      n_reducidas = length(Filter(function(r) r$n > 0 && r$n < notas_n$base_reducida$umbral, reducidas))
    )
  }
  .comparativo_guardar(wb, path)
  list(hoja = hoja, n_preguntas = length(modelo$preguntas), preguntas = resumen)
}

# ---- Manifest ---------------------------------------------------------------

#' Manifest JSON del comparativo: períodos, rótulos, ponderación por período,
#' marcas por pregunta y huella del XLSX. Es el artefacto `manifest`.
#' @keywords internal
reporte_comparativo_manifest <- function(path_json, tipo, path_xlsx, filename, periodos,
                                         rotulos, ponderacion, resumen) {
  man <- list(
    tipo = tipo,
    generado = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    entregable = list(filename = filename,
                      sha256 = tolower(digest::digest(file = path_xlsx, algo = "sha256")),
                      size = as.integer(file.info(path_xlsx)$size)),
    periodos = lapply(periodos, function(b) list(
      base = b, rotulo = unname(rotulos[[b]]),
      ponderacion = ponderacion[[b]] %||% list(pondera = FALSE, estado = "sin_ponderar"))),
    preguntas = resumen$preguntas
  )
  jsonlite::write_json(man, path_json, auto_unbox = TRUE, pretty = TRUE, null = "null")
  invisible(man)
}
