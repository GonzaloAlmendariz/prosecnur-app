# Excel de escenarios de una propuesta (pedido de Gonzalo, 2026-11-11: "que el
# cálculo muestral cree Excel, pero también pueda crear PPTs"). Sale de
# `calc_muestra_propuesta_tablas()`, la misma fuente del PPT: las cifras de los
# dos archivos no pueden diferir.
#
# Se escriben valores, no fórmulas: el diseño se recalcula en Cálculo de
# muestra, y una fórmula editada en el Excel dejaría de coincidir con el PPT.

.cmx_estilos <- function() {
  list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold", fontColour = .std_color("azul")),
    # Sin ajuste de línea: el texto corre sobre las celdas vacías de la derecha.
    sub = openxlsx::createStyle(fontSize = 10, textDecoration = "italic", fontColour = .std_color("texto_suave")),
    cab = openxlsx::createStyle(fontColour = "#FFFFFF", fgFill = .std_color("azul"), textDecoration = "bold",
                                halign = "center", valign = "center", wrapText = TRUE,
                                border = "TopBottomLeftRight", borderColour = .std_color("filete")),
    cuerpo = openxlsx::createStyle(fontColour = .std_color("azul"), valign = "top", wrapText = TRUE,
                                   border = "TopBottomLeftRight", borderColour = .std_color("filete")),
    entero = openxlsx::createStyle(numFmt = "#,##0", halign = "center"),
    pct = openxlsx::createStyle(numFmt = "0.0 %", halign = "center"),
    total = openxlsx::createStyle(textDecoration = "bold", fgFill = .std_color("banda_clara")),
    grupo = openxlsx::createStyle(fontColour = "#FFFFFF", fgFill = .std_color("azul_medio"), textDecoration = "bold",
                                  halign = "center", border = "TopBottomLeftRight", borderColour = .std_color("filete"))
  )
}

.cmx_hoja <- function(wb, nombre, titulo, sub) {
  openxlsx::addWorksheet(wb, nombre, gridLines = FALSE)
  openxlsx::writeData(wb, nombre, titulo, startRow = 1, startCol = 1)
  openxlsx::addStyle(wb, nombre, .cmx_estilos()$titulo, rows = 1, cols = 1)
  if (length(sub) && nzchar(sub)) {
    openxlsx::writeData(wb, nombre, sub, startRow = 2, startCol = 1)
    openxlsx::addStyle(wb, nombre, .cmx_estilos()$sub, rows = 2, cols = 1)
  }
}

# Escribe una tabla desde la fila `fila` con cabecera, cuerpo, formatos por columna y fila de total.
.cmx_tabla <- function(wb, hoja, df, fila, enteros = integer(), pcts = integer(), total = FALSE) {
  E <- .cmx_estilos()
  openxlsx::writeData(wb, hoja, df, startRow = fila, startCol = 1, headerStyle = E$cab)
  cuerpo <- seq_len(nrow(df)) + fila
  openxlsx::addStyle(wb, hoja, E$cuerpo, rows = cuerpo, cols = seq_len(ncol(df)), gridExpand = TRUE)
  if (length(enteros)) openxlsx::addStyle(wb, hoja, E$entero, rows = cuerpo, cols = enteros, gridExpand = TRUE, stack = TRUE)
  if (length(pcts)) openxlsx::addStyle(wb, hoja, E$pct, rows = cuerpo, cols = pcts, gridExpand = TRUE, stack = TRUE)
  if (total) openxlsx::addStyle(wb, hoja, E$total, rows = max(cuerpo), cols = seq_len(ncol(df)), gridExpand = TRUE, stack = TRUE)
  # Cabeceras de hasta tres líneas ("Margen de referencia Propuesta A").
  openxlsx::setRowHeights(wb, hoja, rows = fila, heights = 46)
  max(cuerpo)
}

#' Genera el Excel de escenarios de una propuesta.
#'
#' Hojas: Resumen (escenarios lado a lado), una por público con segmentos,
#' Viabilidad y Supuestos. Misma entrada que `calc_muestra_propuesta_ppt()`.
#'
#' @param propuesta Ver `calc_muestra_propuesta_ppt.R`.
#' @param path_xlsx Ruta del `.xlsx`.
#' @return Invisible: list(path, hojas, tablas).
#' @export
calc_muestra_propuesta_xlsx <- function(propuesta, path_xlsx) {
  t <- calc_muestra_propuesta_tablas(propuesta)
  d <- t$datos; esc <- t$escenarios; E <- .cmx_estilos()
  wb <- openxlsx::createWorkbook()
  openxlsx::modifyBaseFont(wb, fontSize = 10, fontName = "Arial")

  # --- Resumen: por público, cada escenario con meta, respuesta necesaria y margen de referencia.
  titulo <- as.character(propuesta$titulo %||% "Diseño muestral")[1]
  .cmx_hoja(wb, "Resumen", paste0(titulo, ": escenarios de muestra"), "")
  # Las notas van bajo la tabla, en celdas combinadas con ajuste: una nota larga en la fila 2 corría
  # a la derecha y la impresión a una página de ancho achicaba la hoja entera.
  notas_res <- c(
    if (length(t$agregados)) sprintf("Las metas incluyen lo que agrega el mínimo de %d por segmento: %s.",
                                     as.integer(propuesta$minimo_segmento %||% 30L), paste(t$agregados, collapse = "; ")),
    "El margen de error es referencial, por tratarse de una muestra no probabilística.")
  res <- data.frame(`Público` = c(d$publicos, "Total"), `Segmento de cruce` = c(d$segmentacion, ""),
                    `Población` = c(d$N, sum(d$N)), check.names = FALSE)
  for (k in esc) {
    m <- d$metas[[k]]
    res[[paste0(k, ": meta")]] <- c(m, sum(m))
    res[[paste0(k, ": respuesta necesaria")]] <- c(m / d$N, sum(m) / sum(d$N))
    res[[paste0(k, ": margen de referencia")]] <- c(.cmp_margen_ref(m, d$N), NA_real_)
  }
  rot_ref <- paste0("Respuesta de referencia", if (nzchar(d$referencia_rotulo)) paste0(" (", d$referencia_rotulo, ")") else "")
  res[[rot_ref]] <- c(d$referencia, NA_real_)
  nc <- ncol(res)
  # Fila de grupo sobre las columnas de cada escenario.
  openxlsx::writeData(wb, "Resumen", t(c("", "", "")), startRow = 4, startCol = 1, colNames = FALSE)
  for (i in seq_along(esc)) {
    c0 <- 4L + (i - 1L) * 3L
    openxlsx::writeData(wb, "Resumen", esc[i], startRow = 4, startCol = c0)
    openxlsx::mergeCells(wb, "Resumen", cols = c0:(c0 + 2L), rows = 4)
    openxlsx::addStyle(wb, "Resumen", E$grupo, rows = 4, cols = c0:(c0 + 2L), gridExpand = TRUE)
  }
  names(res) <- sub("^.*: ", "", names(res))
  names(res)[names(res) == "meta"] <- "Meta"
  names(res)[names(res) == "respuesta necesaria"] <- "Respuesta necesaria"
  names(res)[names(res) == "margen de referencia"] <- "Margen de referencia"
  col_n <- c(3L, 4L + 3L * (seq_along(esc) - 1L))
  col_p <- c(5L + 3L * (seq_along(esc) - 1L), 6L + 3L * (seq_along(esc) - 1L), nc)
  fin_res <- .cmx_tabla(wb, "Resumen", res, 5, enteros = col_n, pcts = col_p, total = TRUE)
  for (j in seq_along(notas_res)) {
    fila <- fin_res + 1L + j
    openxlsx::writeData(wb, "Resumen", notas_res[j], startRow = fila, startCol = 1)
    openxlsx::mergeCells(wb, "Resumen", cols = seq_len(nc), rows = fila)
    openxlsx::addStyle(wb, "Resumen", openxlsx::createStyle(fontSize = 10, fontColour = .std_color("texto_suave"), wrapText = TRUE, valign = "top"),
                       rows = fila, cols = 1)
    openxlsx::setRowHeights(wb, "Resumen", rows = fila, heights = 28)
  }
  openxlsx::setColWidths(wb, "Resumen", cols = 1:nc, widths = c(26, 32, 12, rep(13, nc - 4L), 17))

  # --- Una hoja por público con segmentos.
  hojas_pub <- character()
  for (p in names(d$segmentos)) {
    s <- d$segmentos[[p]]
    hoja <- substr(gsub("[\\[\\]\\*\\?/\\\\:]", "", p), 1, 31)
    hojas_pub <- c(hojas_pub, hoja)
    control <- identical(d$usos[match(p, d$publicos)], "control")
    al_min <- attr(t$segmentos[[p]], "al_minimo")
    sub_h <- paste(c(
      if (control) "Cuotas para controlar la composición de la muestra; no se reportan resultados por cuota.",
      if (length(al_min)) sprintf("Suben al mínimo de %d (o a todas sus personas): %s.",
                                  as.integer(propuesta$minimo_segmento %||% 30L), paste(al_min, collapse = ", "))), collapse = " ")
    .cmx_hoja(wb, hoja, paste0(if (control) "Metas por cuota de control: " else "Metas por segmento: ", p), sub_h)
    tab <- data.frame(Segmento = c(s$segmento, "Total"), `Población` = c(s$N, sum(s$N)),
                      `% de la población` = c(s$N / sum(s$N), 1), check.names = FALSE)
    for (k in esc) {
      tab[[paste0("Meta ", k)]] <- c(s[[k]], sum(s[[k]]))
      tab[[paste0("Respuesta necesaria ", k)]] <- c(s[[k]] / s$N, sum(s[[k]]) / sum(s$N))
      # Las cuotas de control no se reportan: no llevan margen de referencia.
      if (!control) tab[[paste0("Margen de referencia ", k)]] <- c(.cmp_margen_ref(s[[k]], s$N), NA_real_)
    }
    n_esc <- length(esc); paso <- if (control) 2L else 3L
    .cmx_tabla(wb, hoja, tab, 4, enteros = c(2L, 4L + paso * (seq_len(n_esc) - 1L)),
               pcts = c(3L, 5L + paso * (seq_len(n_esc) - 1L), if (!control) 6L + paso * (seq_len(n_esc) - 1L)), total = TRUE)
    openxlsx::setColWidths(wb, hoja, cols = seq_len(ncol(tab)), widths = c(36, rep(14, ncol(tab) - 1L)))
  }

  # --- Viabilidad y avisos: lámina interna, sólo si se pide (revisión 2026-11-11).
  if (isTRUE(propuesta$incluir_viabilidad)) {
  .cmx_hoja(wb, "Viabilidad", "Viabilidad de las metas",
            "Respuesta necesaria = meta sobre personas en la base; se compara con la respuesta de referencia.")
  v <- data.frame(`Público` = d$publicos, check.names = FALSE)
  v[[rot_ref]] <- d$referencia
  for (k in esc) v[[paste0("Respuesta necesaria ", k)]] <- d$metas[[k]] / d$N
  v$Lectura <- t$viabilidad$Lectura
  fin <- .cmx_tabla(wb, "Viabilidad", v, 4, pcts = 2:(ncol(v) - 1L))
  if (length(t$avisos)) {
    openxlsx::writeData(wb, "Viabilidad", "Segmentos que exigen más respuesta de la esperada", startRow = fin + 2, startCol = 1)
    openxlsx::addStyle(wb, "Viabilidad", openxlsx::createStyle(textDecoration = "bold", fontColour = .std_color("coral")), rows = fin + 2, cols = 1)
    openxlsx::writeData(wb, "Viabilidad", t$avisos, startRow = fin + 3, startCol = 1)
  }
  openxlsx::setColWidths(wb, "Viabilidad", cols = seq_len(ncol(v)), widths = c(26, rep(18, ncol(v) - 2L), 40))
  }

  # --- Diseño (el mismo procedimiento que la lámina del PPT).
  .cmx_hoja(wb, "Diseño", "Diseño muestral", "")
  proc <- propuesta$procedimiento %||% .cmp_procedimiento_barrido(as.integer(propuesta$minimo_segmento %||% 30L))
  .cmx_tabla(wb, "Diseño", proc, 3)
  openxlsx::setColWidths(wb, "Diseño", cols = 1:2, widths = c(22, 100))

  # Impresión: horizontal y una página de ancho.
  for (h in names(wb)) openxlsx::pageSetup(wb, h, orientation = "landscape", fitToWidth = 1, fitToHeight = 0)
  openxlsx::saveWorkbook(wb, path_xlsx, overwrite = TRUE)
  invisible(list(path = path_xlsx, hojas = c("Resumen", hojas_pub, if (isTRUE(propuesta$incluir_viabilidad)) "Viabilidad", "Diseño"), tablas = t))
}
