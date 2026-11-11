# =============================================================================
# Material de campo › Correo › Seguimiento › Prueba de horarios: informe PDF.
#
# Estética Pulso PDF (pulso_pdf_theme.R): cabecera navy y pie con logo,
# periodo y página. Layout propio, A4 vertical:
#   página 1  conclusión destacada en una banda navy, cuatro cifras en
#             tarjetas con franja de acento, una tarjeta por recordatorio (dos
#             cifras grandes, barras comparadas y el veredicto) y la línea de
#             horas de cada grupo, que muestra el cruce entre recordatorios;
#   luego     un bloque por recordatorio: cabecera con veredicto, tabla por
#             público con barras dentro de la celda y su lectura, la diferencia
#             por público con su intervalo y la curva de completas por horas
#             desde el envío de cada grupo;
#   al final  cómo se midió, en un recuadro.
# Las cifras salen sólo de `collection_mail_prueba_horario_resultados()`.
# =============================================================================

.MPH_PDF_COL <- list(A = "#002457", B = "#b7791f", A_suave = "#dfe6f1", B_suave = "#f5e9d3",
                     gana = "#0f766e", gana_suave = "#dcefe9", empate = "#5f6b7a", empate_suave = "#eceff3")

.mph_pdf_estudio <- function(s) {
  nm <- tryCatch(.mseg_chr(.planner_identidad(s)$nombre), error = function(e) "")
  if (nzchar(nm)) return(nm)
  pp <- as.character(s$project_path %||% "")[1]
  if (!is.na(pp) && nzchar(pp)) return(tools::file_path_sans_ext(basename(pp)))
  ""
}

.mph_pdf_periodo <- function(t) {
  meses <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
             "octubre", "noviembre", "diciembre")
  lt <- as.POSIXlt(t, tz = .MPH_TZ)
  sprintf("%s de %d", meses[lt$mon + 1L], lt$year + 1900L)
}

# ---- primitivas ------------------------------------------------------------------------

.mph_u <- function(v) grid::unit(v, "npc")

.mph_pdf_txt <- function(label, x, y, size, col, face = "plain", just = c("left", "center")) {
  grid::grid.text(label, x = .mph_u(x), y = .mph_u(y), just = just,
                  gp = grid::gpar(fontsize = size, fontface = face, col = col))
}

# Ancho de un texto en npc (con el device abierto).
.mph_pdf_ancho <- function(label, size, face = "plain") {
  grid::convertWidth(grid::grobWidth(grid::textGrob(label, gp = grid::gpar(fontsize = size, fontface = face))),
                     "npc", valueOnly = TRUE)
}

.mph_pdf_rect <- function(x, y, w, h, fill, col = NA, r = 0.004, lwd = 0.6) {
  grid::grid.roundrect(x = .mph_u(x), y = .mph_u(y), width = .mph_u(w), height = .mph_u(h),
                       just = c("left", "top"), r = .mph_u(r), gp = grid::gpar(fill = fill, col = col, lwd = lwd))
}

# Línea de texto envuelta al ancho; devuelve la y siguiente.
.mph_pdf_parrafo <- function(texto, x, y, w, fontsize, col, fontface = "plain", line_h = NULL) {
  if (!nzchar(texto %||% "")) return(y)
  line_h <- line_h %||% (fontsize * 1.42 / (11.69 * 72))
  lines <- .form_pdf_wrap_fit(texto, w, fontsize = fontsize, fontface = fontface)
  .form_pdf_text(texto, x = x, y = y, w = w, fontsize = fontsize, fontface = fontface, col = col,
                 line_h = line_h, lines = lines)
  y - length(lines) * line_h
}

.mph_pdf_alto_parrafo <- function(texto, w, fontsize, fontface = "plain") {
  length(.form_pdf_wrap_fit(texto, w, fontsize = fontsize, fontface = fontface)) * fontsize * 1.42 / (11.69 * 72)
}

# Píldora con texto; devuelve el ancho usado.
.mph_pdf_pildora <- function(texto, x, y, fill, col, size = 7.6, just = "left") {
  w <- .mph_pdf_ancho(texto, size, "bold") + 0.022
  x0 <- if (identical(just, "right")) x - w else x
  .mph_pdf_rect(x0, y + 0.0085, w, 0.017, fill = fill, r = 0.0085)
  .mph_pdf_txt(texto, x0 + w / 2, y, size, col, "bold", c("center", "center"))
  w
}

.mph_pdf_seccion <- function(titulo, x, y, tk, ty) {
  grid::grid.lines(x = .mph_u(c(x, x + 0.03)), y = .mph_u(y + 0.013),
                   gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$acento))
  .mph_pdf_txt(titulo, x, y, ty$section * 0.80, tk$navy, "bold")
  y - 0.028
}

.mph_pdf_veredicto <- function(ganador, r) {
  switch(ganador,
         A = list(texto = sprintf("Ganó %s", r$horaA), fill = .MPH_PDF_COL$gana_suave, col = .MPH_PDF_COL$gana),
         B = list(texto = sprintf("Ganó %s", r$horaB), fill = .MPH_PDF_COL$gana_suave, col = .MPH_PDF_COL$gana),
         list(texto = "Sin diferencia clara", fill = .MPH_PDF_COL$empate_suave, col = .MPH_PDF_COL$empate))
}

.mph_pdf_fmt_n <- function(x) formatC(as.numeric(x), format = "d", big.mark = ",")
.mph_pdf_fmt_dif <- function(f) sprintf("%+.2f pp", f$dif_pp)
.mph_pdf_fmt_ic <- function(f) sprintf("%+.2f a %+.2f", f$dif_li, f$dif_ls)

# ---- piezas de la portada ---------------------------------------------------------------

# Titular de la prueba: qué hora ganó en qué recordatorio, en una frase.
.mph_pdf_titular <- function(rondas, cruce) {
  if (isTRUE(cruce$confirmado)) {
    f <- cruce$franja %||% "una franja"
    return(sprintf("%s%s rinde más: ganó con los grupos cruzados.", toupper(substr(f, 1, 1)), substr(f, 2, nchar(f))))
  }
  gan <- Filter(function(r) r$ganador %in% c("A", "B"), rondas)
  if (!length(gan)) return("Por ahora, ninguna hora rinde más que la otra.")
  partes <- vapply(gan, function(r) sprintf("las %s en el %s", if (r$ganador == "A") r$horaA else r$horaB,
                                            tolower(r$etiqueta)), "")
  empates <- length(rondas) - length(gan)
  txt <- sprintf("Ganaron %s.", paste(partes, collapse = " y "))
  if (empates) txt <- paste(txt, if (empates == 1L) "El otro recordatorio empató." else sprintf("Los otros %d recordatorios empataron.", empates))
  txt
}

.mph_pdf_kpi <- function(x, y, w, h, valor, rotulo, tk, ty, acento = tk$navy) {
  .mph_pdf_rect(x, y, w, h, fill = tk$surface, col = tk$tbl_frame)
  grid::grid.rect(x = .mph_u(x), y = .mph_u(y), width = .mph_u(0.0045), height = .mph_u(h), just = c("left", "top"),
                  gp = grid::gpar(fill = acento, col = NA))
  .mph_pdf_txt(valor, x + 0.018, y - h * 0.40, 17, tk$navy, "bold")
  .mph_pdf_txt(rotulo, x + 0.018, y - h * 0.76, ty$caption, tk$soft)
}

# Tarjeta de un recordatorio: dos cifras, dos barras y el veredicto.
.mph_pdf_tarjeta_ronda <- function(r, x, y, w, h, escala, tk, ty) {
  .mph_pdf_rect(x, y, w, h, fill = tk$surface, col = tk$tbl_frame)
  pad <- 0.016
  .mph_pdf_txt(r$etiqueta, x + pad, y - 0.020, ty$body, tk$navy, "bold")
  .mph_pdf_txt(sprintf("%s%s", r$fecha, if (isTRUE(r$en_curso)) ", en curso" else ""), x + pad, y - 0.036, ty$caption, tk$soft)
  v <- .mph_pdf_veredicto(r$ganador, r)
  .mph_pdf_pildora(v$texto, x + pad, y - 0.056, v$fill, v$col)
  bw <- w - 2 * pad
  for (k in 1:2) {
    g <- c("A", "B")[k]
    pct <- r$total[[paste0("pct", g)]]; hora <- if (g == "A") r$horaA else r$horaB
    yy <- y - 0.086 - (k - 1) * 0.040
    gana <- identical(r$ganador, g)
    .mph_pdf_txt(sprintf("Grupo %s, %s", g, hora), x + pad, yy, ty$caption, tk$ink, if (gana) "bold" else "plain")
    .mph_pdf_txt(.mph_pct_txt(pct), x + w - pad, yy, 13, .MPH_PDF_COL[[g]], "bold", c("right", "center"))
    .mph_pdf_rect(x + pad, yy - 0.010, bw, 0.009, fill = .MPH_PDF_COL[[paste0(g, "_suave")]], r = 0.0045)
    if (!is.na(pct) && pct > 0) .mph_pdf_rect(x + pad, yy - 0.010, bw * min(1, pct / escala), 0.009, fill = .MPH_PDF_COL[[g]], r = 0.0045)
  }
  grid::grid.lines(x = .mph_u(c(x + pad, x + w - pad)), y = .mph_u(y - h + 0.036), gp = grid::gpar(col = tk$rule, lwd = 0.4))
  .mph_pdf_txt(sprintf("A menos B: %s (IC %s)", .mph_pdf_fmt_dif(r$total), .mph_pdf_fmt_ic(r$total)),
               x + pad, y - h + 0.024, ty$eyebrow + 0.6, tk$ink)
  .mph_pdf_txt(sprintf("%s, a %s horas del envío", r$cmh$p_txt, formatC(r$horizonte_h, format = "fg")),
               x + pad, y - h + 0.011, ty$eyebrow + 0.6, tk$soft)
}

# Horas de cada grupo por recordatorio sobre un eje de 7:00 a 23:00: muestra el cruce.
.mph_pdf_linea_horas <- function(rondas, x, y, w, tk, ty) {
  x0 <- x + 0.17; x1 <- x + w - 0.01
  hmin <- 7; hmax <- 23
  sx <- function(h) x0 + (h - hmin) / (hmax - hmin) * (x1 - x0)
  fila <- 0.030
  for (h in seq(hmin, hmax, by = 2)) {
    grid::grid.lines(x = .mph_u(rep(sx(h), 2)), y = .mph_u(c(y + 0.004, y - fila * length(rondas))),
                     gp = grid::gpar(col = tk$rule, lwd = 0.4))
    lab <- if (h < 12) sprintf("%d a. m.", h) else if (h == 12) "12 m." else sprintf("%d p. m.", h - 12)
    .mph_pdf_txt(lab, sx(h), y + 0.012, ty$eyebrow, tk$soft, just = c("center", "center"))
  }
  hora_num <- function(txt) {
    m <- regmatches(txt, regexec("^([0-9]+):([0-9]+) ([ap])", txt))[[1]]
    if (length(m) < 4) return(NA_real_)
    h <- as.numeric(m[2]) %% 12 + as.numeric(m[3]) / 60
    if (m[4] == "p") h + 12 else h
  }
  for (k in seq_along(rondas)) {
    r <- rondas[[k]]
    yc <- y - (k - 0.5) * fila
    if (k %% 2L == 0L) grid::grid.rect(x = .mph_u(x), y = .mph_u(yc), width = .mph_u(w), height = .mph_u(fila),
                                       just = c("left", "center"), gp = grid::gpar(fill = tk$tbl_zebra, col = NA))
    .mph_pdf_txt(r$etiqueta, x + 0.004, yc, ty$code, tk$ink)
    hA <- hora_num(r$horaA); hB <- hora_num(r$horaB)
    if (!is.na(hA) && !is.na(hB)) grid::grid.lines(x = .mph_u(c(sx(hA), sx(hB))), y = .mph_u(yc), gp = grid::gpar(col = tk$tbl_frame, lwd = 1))
    for (g in c("A", "B")) {
      hh <- if (g == "A") hA else hB
      if (is.na(hh)) next
      grid::grid.circle(x = .mph_u(sx(hh)), y = .mph_u(yc), r = grid::unit(5.2, "pt"),
                        gp = grid::gpar(fill = .MPH_PDF_COL[[g]], col = if (identical(r$ganador, g)) .MPH_PDF_COL$gana else "white", lwd = 1.6))
      .mph_pdf_txt(g, sx(hh), yc, 6.4, "white", "bold", c("center", "center"))
    }
  }
  y - fila * length(rondas) - 0.006
}

# ---- piezas del detalle -------------------------------------------------------------------

# Tabla por público: barras dentro de la celda y lectura en píldora.
.mph_pdf_tabla_publicos <- function(r, x, y, w, tk, ty, fila_h = 0.029) {
  filas <- c(r$publicos, list(c(r$total, list(publico = "Total"))))
  lim <- max(1, ceiling(max(abs(unlist(lapply(filas, function(f) c(f$dif_li, f$dif_ls)))), na.rm = TRUE)))
  escala <- max(1, ceiling(max(unlist(lapply(filas, function(f) c(f$pctA, f$pctB))), na.rm = TRUE)))
  cw <- c(0.22, 0.215, 0.215, 0.22, 0.13) * w
  xs <- x + c(0, cumsum(cw))
  cab_h <- 0.024
  .mph_pdf_rect(x, y, w, cab_h, fill = tk$tbl_header, r = 0.003)
  cabs <- c("Público", sprintf("Grupo A, %s", r$horaA), sprintf("Grupo B, %s", r$horaB),
            "A menos B (IC 95 %)", "Lectura")
  for (i in seq_along(cabs)) .mph_pdf_txt(cabs[[i]], xs[i] + 0.008, y - cab_h / 2, ty$caption, tk$navy, "bold")
  yy <- y - cab_h
  for (k in seq_along(filas)) {
    f <- filas[[k]]; total <- k == length(filas)
    yc <- yy - fila_h / 2
    if (total) grid::grid.rect(x = .mph_u(x), y = .mph_u(yy), width = .mph_u(w), height = .mph_u(fila_h), just = c("left", "top"),
                               gp = grid::gpar(fill = tk$tbl_zebra, col = NA))
    .mph_pdf_txt(f$publico, xs[1] + 0.008, yc, ty$code, tk$ink, if (total) "bold" else "plain")
    for (g in c("A", "B")) {
      i <- if (g == "A") 2 else 3
      pct <- f[[paste0("pct", g)]]
      bx <- xs[i] + 0.008; bw <- cw[i] - 0.016
      .mph_pdf_txt(.mph_pct_txt(pct), bx, yc + 0.007, ty$code, .MPH_PDF_COL[[g]], "bold")
      .mph_pdf_txt(sprintf("%s de %s", .mph_pdf_fmt_n(f[[paste0("x", g)]]), .mph_pdf_fmt_n(f[[paste0("n", g)]])),
                   bx + bw, yc + 0.007, ty$eyebrow + 0.4, tk$soft, just = c("right", "center"))
      .mph_pdf_rect(bx, yc - 0.004, bw, 0.006, fill = .MPH_PDF_COL[[paste0(g, "_suave")]], r = 0.003)
      if (!is.na(pct) && pct > 0) .mph_pdf_rect(bx, yc - 0.004, bw * min(1, pct / escala), 0.006, fill = .MPH_PDF_COL[[g]], r = 0.003)
    }
    .mph_pdf_txt(.mph_pdf_fmt_dif(f), xs[4] + 0.008, yc + 0.007, ty$code, tk$ink, "bold")
    .mph_pdf_txt(.mph_pdf_fmt_ic(f), xs[5] - 0.008, yc + 0.007, ty$eyebrow + 0.4, tk$soft, just = c("right", "center"))
    # Intervalo dibujado: a la derecha del cero gana A, a la izquierda B.
    fx0 <- xs[4] + 0.008; fx1 <- xs[5] - 0.008
    fsx <- function(v) fx0 + (v + lim) / (2 * lim) * (fx1 - fx0)
    grid::grid.lines(x = .mph_u(c(fx0, fx1)), y = .mph_u(yc - 0.006), gp = grid::gpar(col = tk$rule, lwd = 0.5))
    grid::grid.lines(x = .mph_u(rep(fsx(0), 2)), y = .mph_u(c(yc - 0.0105, yc - 0.0015)), gp = grid::gpar(col = tk$soft, lwd = 0.6))
    if (!any(is.na(c(f$dif_pp, f$dif_li, f$dif_ls)))) {
      fc <- if (f$veredicto %in% c("A", "B")) .MPH_PDF_COL[[f$veredicto]] else tk$soft
      grid::grid.lines(x = .mph_u(c(fsx(f$dif_li), fsx(f$dif_ls))), y = .mph_u(yc - 0.006), gp = grid::gpar(col = fc, lwd = 2, lineend = "round"))
      grid::grid.circle(x = .mph_u(fsx(f$dif_pp)), y = .mph_u(yc - 0.006), r = grid::unit(2.4, "pt"), gp = grid::gpar(fill = fc, col = "white", lwd = 0.8))
    }
    if (total) {
      .mph_pdf_txt(sprintf("OR %s", formatC(r$cmh$or, format = "f", digits = 2)), xs[5] + 0.008, yc + 0.006, ty$caption, tk$ink, "bold")
      .mph_pdf_txt(r$cmh$p_txt, xs[5] + 0.008, yc - 0.007, ty$caption, tk$soft)
    } else {
      gan <- if (f$veredicto %in% c("A", "B")) f$veredicto else "empate"
      v <- .mph_pdf_veredicto(gan, list(horaA = f$horaA, horaB = f$horaB))
      txt <- if (gan == "empate") (if (isTRUE(f$pocos_casos)) "Pocos casos" else "Empate") else sub("^Ganó ", "", v$texto)
      .mph_pdf_pildora(txt, xs[5] + 0.008, yc, v$fill, v$col, size = 6.8)
    }
    yy <- yy - fila_h
    grid::grid.lines(x = .mph_u(c(x, x + w)), y = .mph_u(yy), gp = grid::gpar(col = tk$rule, lwd = 0.4))
  }
  yy
}

# Diferencia A - B por público con su intervalo y la zona de cada grupo.
.mph_pdf_forest <- function(items, x, y, w, tk, ty, fila_h = 0.024, etiqueta_w = 0.30) {
  if (!length(items)) return(y)
  lim <- max(1, ceiling(max(abs(unlist(lapply(items, function(i) c(i$li, i$ls)))), na.rm = TRUE)))
  x0 <- x + etiqueta_w; x1 <- x + w - 0.01
  sx <- function(v) x0 + (v + lim) / (2 * lim) * (x1 - x0)
  alto <- length(items) * fila_h
  grid::grid.rect(x = .mph_u(sx(0)), y = .mph_u(y), width = .mph_u(x1 - sx(0)), height = .mph_u(alto), just = c("left", "top"),
                  gp = grid::gpar(fill = .MPH_PDF_COL$A_suave, col = NA, alpha = 0.45))
  grid::grid.rect(x = .mph_u(x0), y = .mph_u(y), width = .mph_u(sx(0) - x0), height = .mph_u(alto), just = c("left", "top"),
                  gp = grid::gpar(fill = .MPH_PDF_COL$B_suave, col = NA, alpha = 0.45))
  grid::grid.lines(x = .mph_u(rep(sx(0), 2)), y = .mph_u(c(y, y - alto)), gp = grid::gpar(col = tk$soft, lwd = 0.8))
  for (k in seq_along(items)) {
    it <- items[[k]]
    yc <- y - (k - 0.5) * fila_h
    .mph_pdf_txt(it$etiqueta, x, yc, ty$code, tk$ink)
    if (any(is.na(c(it$dif, it$li, it$ls)))) next
    col <- if (it$veredicto %in% c("A", "B")) .MPH_PDF_COL[[it$veredicto]] else tk$soft
    grid::grid.lines(x = .mph_u(c(sx(it$li), sx(it$ls))), y = .mph_u(yc), gp = grid::gpar(col = col, lwd = 2.2, lineend = "round"))
    grid::grid.circle(x = .mph_u(sx(it$dif)), y = .mph_u(yc), r = grid::unit(3.4, "pt"), gp = grid::gpar(fill = col, col = "white", lwd = 1))
  }
  yb <- y - alto
  for (v in c(-lim, 0, lim)) .mph_pdf_txt(if (v == 0) "0" else sprintf("%+g pp", v), sx(v), yb - 0.009, ty$eyebrow, tk$soft, just = c("center", "center"))
  .mph_pdf_txt(items[[1]]$izq %||% "", x0 + 0.004, y + 0.009, ty$eyebrow, .MPH_PDF_COL$B, "bold")
  .mph_pdf_txt(items[[1]]$der %||% "", x1 - 0.004, y + 0.009, ty$eyebrow, .MPH_PDF_COL$A, "bold", just = c("right", "center"))
  yb - 0.020
}

# Completas acumuladas por horas desde el envío de cada grupo, con área y cifra final.
.mph_pdf_curva <- function(r, x, y, w, h, tk, ty) {
  cur <- r$curvas
  if (length(cur) < 2L) return(invisible(NULL))
  hs <- vapply(cur, function(c) as.numeric(c$horas), 0)
  vals <- list(A = vapply(cur, function(c) as.numeric(c$pctA %||% NA), 0), B = vapply(cur, function(c) as.numeric(c$pctB %||% NA), 0))
  ymax <- max(unlist(vals), na.rm = TRUE); ymax <- if (!is.finite(ymax) || ymax <= 0) 1 else ceiling(ymax * 1.15)
  x0 <- x + 0.045; x1 <- x + w - 0.05; y0 <- y - h + 0.018; y1 <- y - 0.008
  sx <- function(v) x0 + v / max(hs) * (x1 - x0); sy <- function(v) y0 + v / ymax * (y1 - y0)
  for (v in pretty(c(0, ymax), n = 3)) if (v <= ymax) {
    grid::grid.lines(x = .mph_u(c(x0, x1)), y = .mph_u(rep(sy(v), 2)), gp = grid::gpar(col = tk$rule, lwd = 0.4))
    .mph_pdf_txt(sprintf("%g %%", v), x0 - 0.006, sy(v), ty$eyebrow, tk$soft, just = c("right", "center"))
  }
  for (v in Filter(function(v) v <= max(hs), pretty(c(0, max(hs)), n = 4))) .mph_pdf_txt(sprintf("%g h", v), sx(v), y0 - 0.010, ty$eyebrow, tk$soft, just = c("center", "center"))
  for (g in c("B", "A")) {
    v <- vals[[g]]; ok <- !is.na(v)
    grid::grid.lines(x = .mph_u(sx(hs[ok])), y = .mph_u(sy(v[ok])), gp = grid::gpar(col = .MPH_PDF_COL[[g]], lwd = 1.8))
  }
  fin <- c(A = utils::tail(stats::na.omit(vals$A), 1), B = utils::tail(stats::na.omit(vals$B), 1))
  ys <- sy(fin); if (abs(ys[["A"]] - ys[["B"]]) < 0.014) { o <- order(ys); ys[o[1]] <- ys[o[1]] - 0.007; ys[o[2]] <- ys[o[2]] + 0.007 }
  for (g in c("A", "B")) .mph_pdf_txt(.mph_pct_txt(fin[[g]]), x1 + 0.006, ys[[g]], ty$eyebrow + 0.8, .MPH_PDF_COL[[g]], "bold")
}

# ---- informe -----------------------------------------------------------------------------

#' Dibuja el informe. Puro respecto de la sesión.
#' @param res salida de `collection_mail_prueba_horario_resultados()`.
#' @param meta list(estudio, corte POSIXct).
#' @keywords internal
.mph_pdf_render <- function(res, path, meta) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type("cliente"); geo <- pulso_pdf_geo("portrait")
  m <- geo$margin; W <- 1 - 2 * m
  periodo <- .mph_pdf_periodo(meta$corte)
  pulso_pdf_abrir(path, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  pagina <- 0L
  sub <- paste(c(if (nzchar(meta$estudio %||% "")) meta$estudio,
                 sprintf("Datos al %s, %s", .mph_fecha_txt(meta$corte), .mph_hora_txt(meta$corte))), collapse = ". ")
  nueva <- function() {
    grid::grid.newpage()
    pagina <<- pagina + 1L
    # La escala "cliente" lleva el título a 17 pt: el subtítulo baja para no pisarlo.
    pulso_pdf_header("Prueba de horario de los recordatorios", sub, tokens = tk, ty = ty, geo = geo,
                     y_titulo = 0.970, y_subtitulo = 0.943, y_regla = 0.920)
    pulso_pdf_footer(pagina, periodo, tokens = tk, ty = ty, geo = geo)
    geo$y_top - 0.004
  }
  y <- nueva()
  rondas <- Filter(function(r) isTRUE(r$comparable), res$rondas)

  # Banda con la conclusión.
  titular <- .mph_pdf_titular(rondas, res$cruce %||% list())
  apoyo <- if (nzchar(res$cruce$texto %||% "")) res$cruce$texto else
    "Cada recordatorio se compara consigo mismo, con las mismas horas desde el envío de cada grupo."
  hb <- 0.028 + .mph_pdf_alto_parrafo(titular, W - 0.05, 15, "bold") + .mph_pdf_alto_parrafo(apoyo, W - 0.05, ty$code) + 0.02
  .mph_pdf_rect(m, y, W, hb, fill = tk$navy, r = 0.006)
  .mph_pdf_txt("Resultado de la prueba", m + 0.025, y - 0.020, ty$caption, tk$sobre_navy_tenue, "bold")
  yt <- .mph_pdf_parrafo(titular, m + 0.025, y - 0.038, W - 0.05, 15, tk$sobre_navy, "bold")
  .mph_pdf_parrafo(apoyo, m + 0.025, yt - 0.004, W - 0.05, ty$code, tk$sobre_navy_tenue)
  y <- y - hb - 0.018

  # Cifras.
  n_pub <- length(unique(unlist(lapply(rondas, function(r) vapply(r$publicos, function(f) f$publico, "")))))
  kpis <- list(
    list(.mph_pdf_fmt_n(res$personas %||% 0), "personas en la prueba"),
    list(as.character(n_pub), if (n_pub == 1L) "público comparado" else "públicos comparados"),
    list(as.character(length(rondas)), if (length(rondas) == 1L) "recordatorio comparado" else "recordatorios comparados"),
    list(as.character(res$semilla %||% ""), "semilla de la asignación"))
  kw <- (W - 3 * 0.014) / 4; kh <- 0.062
  for (i in seq_along(kpis)) .mph_pdf_kpi(m + (i - 1) * (kw + 0.014), y, kw, kh, kpis[[i]][[1]], kpis[[i]][[2]], tk, ty,
                                         acento = if (i == 4L) tk$soft else tk$navy)
  y <- y - kh - 0.032

  # Tarjetas por recordatorio.
  if (length(rondas)) {
    y <- .mph_pdf_seccion("Completas por grupo en cada recordatorio", m, y, tk, ty)
    escala <- max(1, ceiling(max(unlist(lapply(rondas, function(r) c(r$total$pctA, r$total$pctB))), na.rm = TRUE) * 1.1))
    por_fila <- min(3L, length(rondas)); cw <- (W - (por_fila - 1) * 0.014) / por_fila; ch <- 0.180
    for (i in seq_along(rondas)) {
      col <- (i - 1L) %% por_fila; fila <- (i - 1L) %/% por_fila
      .mph_pdf_tarjeta_ronda(rondas[[i]], m + col * (cw + 0.014), y - fila * (ch + 0.014), cw, ch, escala, tk, ty)
    }
    y <- y - ceiling(length(rondas) / por_fila) * (ch + 0.014) - 0.024
    y <- .mph_pdf_seccion("Hora de cada grupo en cada recordatorio", m, y, tk, ty)
    y <- .mph_pdf_linea_horas(rondas, m, y - 0.014, W, tk, ty)
    .mph_pdf_txt("Un borde verde marca la hora que ganó. Los grupos se cruzan: quien recibe en la mañana en un recordatorio recibe en la noche en el siguiente.",
                 m, y - 0.010, ty$eyebrow + 0.6, tk$soft)
    y <- y - 0.05
    y <- .mph_pdf_seccion("Lectura de cada recordatorio", m, y, tk, ty)
    for (r in rondas) {
      .mph_pdf_txt(r$etiqueta, m, y, ty$code, tk$navy, "bold")
      y <- .mph_pdf_parrafo(r$lectura, m + 0.15, y + 0.005, W - 0.15, ty$code, tk$ink) - 0.012
    }
    # Lo que sigue empieza en página nueva: la portada se lee sola.
    y <- geo$y_bottom
  } else {
    y <- .mph_pdf_parrafo("Todavía no hay recordatorios con los dos grupos enviados.", m, y, W, ty$body, tk$soft)
  }

  # Un bloque por recordatorio.
  for (r in rondas) {
    alto <- 0.054 + 0.024 + 0.029 * (length(r$publicos) + 1) + 0.175
    if (y - alto < geo$y_bottom + 0.01) y <- nueva()
    .mph_pdf_rect(m, y, W, 0.040, fill = tk$canvas, col = NA)
    grid::grid.rect(x = .mph_u(m), y = .mph_u(y), width = .mph_u(0.005), height = .mph_u(0.040), just = c("left", "top"),
                    gp = grid::gpar(fill = tk$navy, col = NA))
    .mph_pdf_txt(sprintf("%s, %s", r$etiqueta, r$fecha), m + 0.020, y - 0.014, ty$body + 1, tk$navy, "bold")
    .mph_pdf_txt(sprintf("Grupo A a las %s y grupo B a las %s; completas a %s horas de cada envío%s.", r$horaA, r$horaB,
                         formatC(r$horizonte_h, format = "fg"), if (isTRUE(r$en_curso)) ", en curso" else ""),
                 m + 0.020, y - 0.029, ty$caption, tk$soft)
    v <- .mph_pdf_veredicto(r$ganador, r)
    .mph_pdf_pildora(v$texto, m + W - 0.014, y - 0.020, v$fill, v$col, just = "right")
    y <- y - 0.054
    y <- .mph_pdf_tabla_publicos(r, m, y, W, tk, ty) - 0.010
    if (length(r$excluidos)) {
      ex <- paste(vapply(r$excluidos, function(e) sprintf("%s (%s)", e$publico, e$motivo), ""), collapse = "; ")
      y <- .mph_pdf_parrafo(sprintf("Fuera de la comparación: %s.", ex), m, y, W, ty$caption, tk$soft) - 0.004
    }
    # Lectura a la izquierda y curva acumulada a la derecha.
    y <- y - 0.016
    colw <- W * 0.42
    .mph_pdf_txt("Lectura", m, y, ty$caption, tk$navy, "bold")
    .mph_pdf_txt("Completas acumuladas", m + colw + 0.03, y, ty$caption, tk$navy, "bold")
    yl <- .mph_pdf_parrafo(r$lectura, m, y - 0.016, colw, ty$code, tk$ink)
    lect <- vapply(Filter(function(f) f$veredicto %in% c("A", "B"), r$publicos), function(f)
      sprintf("%s: mejor %s (%s contra %s).", f$publico, if (f$veredicto == "A") f$horaA else f$horaB,
              .mph_pct_txt(if (f$veredicto == "A") f$pctA else f$pctB), .mph_pct_txt(if (f$veredicto == "A") f$pctB else f$pctA)), "")
    for (t in lect) yl <- .mph_pdf_parrafo(t, m, yl - 0.006, colw, ty$code, tk$ink)
    ytop <- y - 0.012
    .mph_pdf_curva(r, m + colw + 0.03, ytop, W - colw - 0.03, 0.110, tk, ty)
    # Leyenda en la línea del título del gráfico.
    lx_fin <- m + W
    for (g in c("B", "A")) {
      txt <- sprintf("Grupo %s, %s", g, if (g == "A") r$horaA else r$horaB)
      lx <- lx_fin - .mph_pdf_ancho(txt, ty$eyebrow + 0.8) - 0.026
      lx_fin <- lx - 0.018
      grid::grid.lines(x = .mph_u(c(lx, lx + 0.020)), y = .mph_u(y), gp = grid::gpar(col = .MPH_PDF_COL[[g]], lwd = 2))
      .mph_pdf_txt(txt, lx + 0.026, y, ty$eyebrow + 0.8, tk$ink)
    }
    y <- min(yl, ytop - 0.115) - 0.026
  }

  # Cómo se midió.
  notas <- list(
    c("Destinatarios", "Personas del grupo con enlace personal que no habían completado la encuesta antes del envío de su grupo."),
    c("Completa", sprintf("Respuesta completa en SurveyMonkey con el enlace personal, contada una vez a la hora en que se completó. Respuestas leídas el %s.",
                          if (nzchar(res$respuestas_leidas_en %||% "")) .mph_fecha_txt(.mc_parse_time(res$respuestas_leidas_en)) else "último día de lectura")),
    c("Ventana", "Las mismas horas desde el envío de cada grupo, para que ninguno gane por haber tenido más tiempo. Si un recordatorio sigue en curso, se recorta a lo que alcanzó el grupo que salió último."),
    c("Hora del envío", sprintf("%d horas leídas de Mailchimp y %d tomadas del plan.", res$horas_de_mailchimp %||% 0L, res$horas_del_plan %||% 0L)),
    c("Comparación", "Cochran-Mantel-Haenszel con cada público como estrato; una razón de odds (OR) mayor que 1 favorece al grupo A. Cada diferencia lleva su intervalo de confianza del 95 % (Newcombe). Con menos de 10 completas esperadas en un grupo, la diferencia se lee como tendencia."),
    c("Exclusiones", "Un público con la misma hora en los dos grupos no entra a la comparación de ese recordatorio."))
  colw <- (W - 0.05) / 2
  alto_nota <- function(n) .mph_pdf_alto_parrafo(n[[2]], colw - 0.01, ty$caption) + 0.026
  izq <- notas[c(1, 3, 5)]; der <- notas[c(2, 4, 6)]
  caja_h <- max(sum(vapply(izq, alto_nota, 0)), sum(vapply(der, alto_nota, 0))) + 0.05
  if (y - caja_h < geo$y_bottom + 0.01) y <- nueva()
  .mph_pdf_rect(m, y, W, caja_h, fill = tk$canvas, col = tk$tbl_frame)
  .mph_pdf_txt("Cómo se midió", m + 0.02, y - 0.022, ty$body, tk$navy, "bold")
  for (lado in 1:2) {
    yy <- y - 0.046
    for (n in list(izq, der)[[lado]]) {
      xx <- m + 0.02 + (lado - 1) * (colw + 0.01)
      .mph_pdf_txt(n[[1]], xx, yy, ty$caption, tk$ink, "bold")
      yy <- .mph_pdf_parrafo(n[[2]], xx, yy - 0.014, colw - 0.01, ty$caption, tk$soft) - 0.012
    }
  }
  invisible(path)
}

#' `POST /api/recopiladores/mail-seguimiento/horario/informe`: PDF del análisis.
#' @keywords internal
collection_mail_prueba_horario_informe <- function(sid, horizonte_h = NULL, ahora = Sys.time()) {
  res <- collection_mail_prueba_horario_resultados(sid, horizonte_h = horizonte_h, ahora = ahora)
  if (!any(vapply(res$rondas, function(r) isTRUE(r$comparable), NA))) {
    stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SIN_ENVIOS",
             "Todavía no hay un recordatorio con los dos grupos enviados: el informe sale cuando haya uno.")
  }
  s <- session_get(sid)
  path <- file.path(s$dir, "downloads", paste0(uuid::UUIDgenerate(), "_prueba_horarios.pdf"))
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  .mph_pdf_render(res, path, list(estudio = .mph_pdf_estudio(s), corte = as.POSIXct(ahora, tz = "UTC")))
  meta <- entregable_registrar(sid, path, "collection_mail_prueba_horario_pdf", original_name = "prueba_horarios.pdf")
  entregable_respuesta(list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name %||% basename(path),
                            size = meta$size), meta)
}
