# collection_territorial_papel_conteo.R — la hoja de conteo por zona de un territorial por cuotas
# (ADR 0125 §2; contrato contratos-material-por-tipo-2026-11-02.md §1: «la ficha de seguimiento es una hoja
# de conteo por zona, celdas de cuota para marcar»).
#
# Una hoja por zona: filas por rango de edad y, por cada sexo, la cuota impresa, un espacio para marcar una
# raya por entrevista y la casilla de logradas. Es papel en blanco: el avance real lo mide Monitoreo con lo
# validado de Kobo, y la app no guarda lo que se marca aquí.

# Rangos y sexos en el orden en que llegan las cuotas (el de la matriz de Población).
.mtp_conteo_matriz <- function(cuotas) {
  rango_de <- function(c) if (nzchar(c$rango_edad %||% "")) c$rango_edad else c$rango_id
  rangos <- unique(vapply(cuotas, rango_de, ""))
  sexos <- unique(vapply(cuotas, function(c) c$sexo, ""))
  m <- matrix(NA_integer_, nrow = length(rangos), ncol = length(sexos), dimnames = list(rangos, sexos))
  for (c in cuotas) m[rango_de(c), c$sexo] <- c$n
  m
}

# ADR 0126: qué dimensión es referencia en la zona (Hojas de ruta la declara y viaja en el envío).
.mtp_conteo_referenciales <- function(caracter) {
  ref <- names(Filter(function(v) identical(as.character(v)[1], "referencial"), caracter %||% list()))
  intersect(ref, c("sexo", "edad"))
}

#' El subtítulo de la hoja: qué se exige en la zona.
#' @keywords internal
.mtp_conteo_subtitulo <- function(n, caracter = list()) {
  ref <- .mtp_conteo_referenciales(caracter)
  if (!length(ref)) return(sprintf("%d entrevistas por cuota de sexo y edad", n))
  if (setequal(ref, c("sexo", "edad"))) return(sprintf("%d entrevistas en la zona; sexo y edad son referencia", n))
  if (identical(ref, "sexo")) return(sprintf("%d entrevistas con meta por edad; el sexo es referencia", n))
  sprintf("%d entrevistas con meta por sexo; la edad es referencia", n)
}

# Los textos de la hoja según lo que se exige. Sin referencia, los de siempre.
.mtp_conteo_textos <- function(caracter = list()) {
  ref <- .mtp_conteo_referenciales(caracter)
  base <- list(celda = "cuota", ultima = "Cuota de la fila", total = "Total",
               corte = "Cuando una celda llega a su cuota, deje de entrevistar a personas de ese sexo y edad en la zona.",
               fila_meta = FALSE, total_meta = FALSE)
  if (!length(ref)) return(base)
  base$celda <- "referencia"
  if (setequal(ref, c("sexo", "edad"))) {
    base$ultima <- "Referencia de la fila"; base$total <- "Total de la zona (meta)"; base$total_meta <- TRUE
    base$corte <- "Sólo se exige el total de la zona. Sexo y edad son referencia: procure acercarse a lo impreso, sin dejar de entrevistar."
  } else if (identical(ref, "sexo")) {
    base$ultima <- "Meta de la fila"; base$fila_meta <- TRUE
    base$corte <- "Cuando una edad llega a la meta de su fila, deje de entrevistar a esa edad. El sexo es referencia: procure acercarse a lo impreso."
  } else {
    base$ultima <- "Referencia de la fila"; base$total <- "Meta por sexo"; base$total_meta <- TRUE
    base$corte <- "Cuando un sexo llega a su meta (última fila), deje de entrevistar a ese sexo. La edad es referencia: procure acercarse a lo impreso."
  }
  base
}

.mtp_conteo_pdf <- function(ctx, out_pdf) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type(); geo <- pulso_pdf_geo("portrait")
  margen <- geo$margin; ancho <- 1 - 2 * margen
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  paginas <- 0L
  for (cab in ctx$cabeceras) {
    grid::grid.newpage(); paginas <- paginas + 1L
    pulso_pdf_header(sprintf("Hoja de conteo · %s", .hojas_ruta_title_case(cab$label)), cab$subtitulo,
                     tokens = tk, ty = ty, geo = geo, y_subtitulo = 0.944, y_regla = 0.922)
    .mtp_campos(list(list("Encuestador", cab$encuestador), list("Fecha", ""), list("Hoja n.º", "")), margen, 0.876, ancho, tk, ty)

    m <- .mtp_conteo_matriz(cab$cuotas)
    sexos <- colnames(m)
    tx <- .mtp_conteo_textos(cab$caracter)
    cols <- c("Rango de edad", unlist(lapply(sexos, function(s) c(paste(s, "·", tx$celda), paste(s, "· conteo (una raya por entrevista)"), paste(s, "· logradas")))),
              tx$ultima)
    fijo <- c(0.110, rep(c(0.065, NA, 0.070), length(sexos)), 0.080)
    fijo[is.na(fijo)] <- (ancho - sum(fijo, na.rm = TRUE)) / length(sexos)
    filas <- c(rownames(m), tx$total)
    y <- 0.830
    fila_h <- max(0.040, min(0.060, (y - 0.300) / (length(filas) + 1L)))
    cab_h <- 0.034
    logradas <- 1L + 3L * seq_along(sexos)
    yb <- .mtp_tabla(cols, fijo, margen, y, fila_h, length(filas), tk, primera = filas, sombra = logradas,
                     cuerpo = 9, chars_npc = 150, cab_h = cab_h)
    # La cuota impresa en su celda; la fila Total suma por sexo y la última columna, por rango.
    # ADR 0126: lo que se exige va en negrita azul; lo que es referencia, en gris y sin negrita.
    xs <- margen + c(0, cumsum(fijo))
    totales <- rbind(m, Total = colSums(m, na.rm = TRUE))
    for (i in seq_along(filas)) {
      yi <- y - cab_h - (i - 1) * fila_h - fila_h / 2
      peso <- if (i == length(filas)) "bold" else "plain"
      es_total <- i == length(filas)
      celda_exigida <- identical(tx$celda, "cuota") || (es_total && tx$total_meta)
      for (j in seq_along(sexos)) {
        v <- totales[i, j]
        .hojas_ruta_hd_txt_at(if (is.na(v)) "—" else format(v), xs[[3L * j - 1L]] + 0.010, yi, 10,
                              if (celda_exigida) tk$navy else tk$soft, if (celda_exigida) "bold" else "plain")
      }
      fila_exigida <- tx$fila_meta && !es_total
      .hojas_ruta_hd_txt_at(format(sum(totales[i, ], na.rm = TRUE)), xs[[length(cols)]] + 0.010, yi, 10,
                            if (fila_exigida) tk$navy else tk$ink, if (fila_exigida) "bold" else peso)
    }
    grid::grid.lines(x = c(margen, margen + ancho), y = rep(y - cab_h - (length(filas) - 1) * fila_h, 2),
                     gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$columna))
    .hojas_ruta_hd_txt_at("Marque una raya por entrevista efectiva en la celda de su sexo y edad; al cerrar la jornada, anote las logradas en la casilla sombreada.",
                          margen, yb - 0.014, 7, tk$soft)
    .hojas_ruta_hd_txt_at(tx$corte, margen, yb - 0.028, 7, tk$soft)

    yo <- yb - 0.070
    .hojas_ruta_hd_txt_at("Observaciones", margen, yo, 10.5, tk$navy, "bold")
    for (yl in utils::head(seq(yo - 0.030, 0.100, by = -0.030), 5L)) {
      grid::grid.lines(x = c(margen, margen + ancho), y = rep(yl, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = 0.6))
    }
    .mtp_pie(ctx, "Hoja de conteo por cuotas", paginas, tk, ty, geo)
  }
  attr(out_pdf, "paginas") <- paginas
  invisible(out_pdf)
}
