# collection_territorial_papel.R — la hoja de ruteo y la hoja de consolidados por UMP
# (checklist-formatos-campo D1, pasos B2/B3 del plan conjunto). Es el juego de papel que
# campo ya usa y hasta ahora se armaba a mano en Word: la app lo entrega con la cabecera
# llena (distrito, UMP, rango de encuestas y el encuestador de la asignación) y con los
# códigos de resultado del estudio (`collection_territorial_formatos.R`).
#
# Son formularios en blanco: nombres, edades o teléfonos los escribe campo a mano y la
# app no los guarda (arquitectura de campo §11). La hoja del encuestador sólo muestra su
# código y su nombre, nunca un DNI.

.MTP_PIEZAS <- c("ruteo", "consolidados")
.MTP_ALCANCES <- c("titulares", "todas")

.mtp_txt <- function(x) if (is.null(x) || !length(x) || is.na(x[[1]])) "" else as.character(x[[1]])

# El código operativo ya suele empezar por «UMP»: no se repite en el título.
.mtp_titulo <- function(pieza, label) {
  sprintf("%s · %s", pieza, if (grepl("^UMP\\b", label)) label else paste("UMP", label))
}

.mtp_periodo <- function(fecha = Sys.Date()) {
  sprintf("%s %s", .hojas_ruta_hd_meses[as.integer(format(fecha, "%m"))], format(fecha, "%Y"))
}

# Lo que comparten las dos hojas: qué UMP salen y la cabecera de cada una.
.mtp_contexto <- function(sid, campaign_id, unidad, alcance) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  fase <- .mcamp_territorial_fase_of(hit$entry)
  envio <- .mcamp_territorial_envio(s, fase)
  if (is.null(envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_SIN_FUENTE", "La muestra enviada desde Hojas de ruta ya no está: vuelve a enviarla.",
             details = list(id = hit$entry$id, fase = fase))
  }
  if (.mcamp_territorial_stale(s, fase, envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_DESACTUALIZADA",
             "La muestra cambió en Hojas de ruta desde el envío: reenvíala antes de imprimir las hojas.",
             details = list(id = hit$entry$id, fase = fase))
  }
  unidades <- .mta_unidades(envio)
  id <- .mtp_txt(unidad)
  if (nzchar(id)) {
    unidades <- Filter(function(u) identical(u$unit_id, id), unidades)
    if (!length(unidades)) {
      stop_api(404, "E_COLLECTION_TERRITORIAL_PAPEL_UNIDAD", "Esa UMP no está en la muestra enviada.", details = list(unidad = id))
    }
  } else if (!identical(alcance, "todas")) {
    unidades <- Filter(function(u) identical(u$role, "titular"), unidades)
  }
  asig <- collection_territorial_asignacion_get(sid, hit$entry$id)
  nombre_de <- stats::setNames(vapply(asig$equipo, `[[`, "", "nombre"), vapply(asig$equipo, `[[`, "", "codigo"))
  codigo_de <- stats::setNames(vapply(asig$asignacion, `[[`, "", "codigo"), vapply(asig$asignacion, `[[`, "", "id_manzana"))
  label_de <- stats::setNames(vapply(.mta_unidades(envio), `[[`, "", "label"), vapply(.mta_unidades(envio), `[[`, "", "unit_id"))
  cabeceras <- lapply(unidades, function(u) {
    cod <- unname(codigo_de[u$unit_id])
    # Sólo se imprime quien está en la lista de Monitoreo: un código huérfano queda en blanco.
    enc <- if (!is.na(cod) && !is.na(nombre_de[cod])) {
      nm <- unname(nombre_de[cod]); if (nzchar(nm)) paste0(cod, " · ", nm) else cod
    } else ""
    rango <- if (!is.na(u$rango_inicio) && !is.na(u$rango_fin)) c(u$rango_inicio, u$rango_fin) else integer(0)
    partes <- c(.hojas_ruta_title_case(.mtp_txt(u$distrito)),
                if (nzchar(.mtp_txt(u$zona))) paste("Zona", u$zona),
                if (nzchar(.mtp_txt(u$manzana))) paste("Manzana", u$manzana),
                if (length(rango)) sprintf("Encuestas %d a %d", rango[1], rango[2]),
                if (identical(u$role, "reemplazo") && !is.na(u$titular_id)) paste("Reemplaza a", unname(label_de[u$titular_id])))
    list(unit_id = u$unit_id, label = u$label, encuestador = enc, rango = rango,
         subtitulo = paste(Filter(nzchar, partes), collapse = " · "))
  })
  list(campana = hit$entry, cabeceras = cabeceras, formatos = collection_territorial_formatos_get(sid, hit$entry$id))
}

# Una fila de campos con línea para escribir; `valor` ya impreso cuando la app lo sabe.
.mtp_campos <- function(campos, x0, y, w, tk, ty) {
  cw <- w / length(campos)
  for (i in seq_along(campos)) {
    xf <- x0 + (i - 1) * cw
    .hojas_ruta_hd_txt_at(toupper(campos[[i]][[1]]), xf, y + 0.018, ty$eyebrow, tk$soft, "bold")
    if (nzchar(campos[[i]][[2]])) .hojas_ruta_hd_txt_at(campos[[i]][[2]], xf, y + 0.006, 9, tk$ink, "bold")
    grid::grid.lines(x = c(xf, xf + cw - 0.014), y = rep(y, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = 0.6))
  }
}

# Tabla vacía con banda de encabezado; devuelve la y inferior.
.mtp_tabla <- function(cols, anchos, x0, y, fila_h, n_filas, tk, primera = NULL, sombra = integer(0), cuerpo = 7.4, chars_npc = 160) {
  w <- sum(anchos); xs <- x0 + c(0, cumsum(anchos))
  grid::grid.rect(x = x0, y = y, width = w, height = fila_h, just = c("left", "top"), gp = grid::gpar(col = NA, fill = tk$tbl_header))
  # El rótulo largo parte en dos líneas antes que montarse sobre la columna vecina.
  for (c in seq_along(cols)) {
    rot <- paste(strwrap(cols[[c]], width = max(6L, floor(anchos[[c]] * chars_npc))), collapse = "\n")
    grid::grid.text(rot, x = grid::unit(xs[[c]] + 0.005, "npc"), y = grid::unit(y - fila_h / 2, "npc"), just = c("left", "center"),
                    gp = grid::gpar(fontsize = 6.8, fontface = "bold", col = tk$ink, lineheight = 0.95))
  }
  grid::grid.lines(x = c(x0, x0 + w), y = rep(y, 2), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$bloque))
  grid::grid.lines(x = c(x0, x0 + w), y = rep(y - fila_h, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = pulso_pdf_pesos()$columna))
  y1 <- y - fila_h
  for (c in sombra) {
    grid::grid.rect(x = xs[[c]], y = y1, width = anchos[[c]], height = n_filas * fila_h, just = c("left", "top"),
                    gp = grid::gpar(col = NA, fill = tk$canvas))
  }
  for (i in seq_len(n_filas)) {
    yi <- y1 - (i - 1) * fila_h
    if (!is.null(primera)) .hojas_ruta_hd_txt_at(as.character(primera[[i]]), xs[[1]] + 0.005, yi - fila_h / 2, cuerpo, tk$soft)
    grid::grid.lines(x = c(x0, x0 + w), y = rep(yi - fila_h, 2), gp = grid::gpar(col = tk$rule, lwd = pulso_pdf_pesos()$fila))
  }
  y2 <- y1 - n_filas * fila_h
  for (c in seq_along(xs)[-c(1L, length(xs))]) {
    grid::grid.lines(x = rep(xs[[c]], 2), y = c(y1, y2), gp = grid::gpar(col = tk$tbl_div, lwd = 0.25))
  }
  grid::grid.lines(x = c(x0, x0 + w), y = rep(y2, 2), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$bloque))
  y2
}

# Leyenda de códigos en `n_col` columnas, sobre lienzo con el acento navy.
.mtp_leyenda <- function(codigos, x0, y, w, tk, n_col = 3L, titulo = "Códigos de resultado") {
  filas <- ceiling(length(codigos) / n_col)
  h <- 0.024 + filas * 0.0135 + 0.004
  grid::grid.rect(x = x0, y = y, width = w, height = h, just = c("left", "top"), gp = grid::gpar(col = NA, fill = tk$canvas))
  grid::grid.lines(x = rep(x0, 2), y = c(y, y - h), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$acento))
  .hojas_ruta_hd_txt_at(titulo, x0 + 0.014, y - 0.012, 9, tk$navy, "bold")
  cw <- (w - 0.014) / n_col
  for (i in seq_along(codigos)) {
    col <- (i - 1L) %/% filas; fila <- (i - 1L) %% filas
    xc <- x0 + 0.014 + col * cw; yc <- y - 0.026 - fila * 0.0135
    .hojas_ruta_hd_txt_at(codigos[[i]]$codigo, xc, yc, 8, tk$navy, "bold")
    .hojas_ruta_hd_txt_at(codigos[[i]]$rotulo, xc + 0.030, yc, 7.6, tk$ink)
  }
  h
}

.mtp_ruteo_pdf <- function(ctx, out_pdf) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type(); geo <- pulso_pdf_geo("portrait")
  margen <- geo$margin; ancho <- 1 - 2 * margen
  f <- ctx$formatos; periodo <- .mtp_periodo()
  crit <- f$columna_criterio
  cols <- c("N.º", "Dirección o referencia", "Puerta", "Resultado", "Nombre", "Edad", "Sexo", if (nzchar(crit)) crit)
  anchos <- if (nzchar(crit)) c(0.040, 0.270, 0.065, 0.075, 0.190, 0.050, 0.050, 0) else c(0.040, 0.310, 0.070, 0.080, 0.290, 0.055, 0)
  anchos[length(anchos)] <- ancho - sum(anchos)
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  paginas <- 0L
  for (cab in ctx$cabeceras) {
    n0 <- 0L
    for (cara in seq_len(f$caras_ruteo)) {
      grid::grid.newpage(); paginas <- paginas + 1L
      pulso_pdf_header(.mtp_titulo("Hoja de ruteo", cab$label), cab$subtitulo, tokens = tk, ty = ty, geo = geo,
                       y_subtitulo = 0.944, y_regla = 0.922)
      .mtp_campos(list(list("Encuestador", cab$encuestador), list("Fecha", ""), list("Supervisor", ""),
                       list("Cara", sprintf("%d de %d", cara, f$caras_ruteo))), margen, 0.872, ancho, tk, ty)
      y <- 0.846
      if (cara == 1L) y <- y - .mtp_leyenda(f$codigos, margen, y, ancho, tk) - 0.016
      fila_h <- 0.0205
      n <- max(1L, floor((y - 0.115) / fila_h) - 1L)
      yb <- .mtp_tabla(cols, anchos, margen, y, fila_h, n, tk, primera = n0 + seq_len(n), sombra = 4L)
      n0 <- n0 + n
      .hojas_ruta_hd_txt_at(
        "Un código por visita, en la columna sombreada. Con 8 (efectiva), registre a la persona en la hoja de consolidados.",
        margen, yb - 0.012, 6.8, tk$soft)
      pulso_pdf_footer(paginas, periodo, tokens = tk, ty = ty, geo = geo, pagina = FALSE)
    }
  }
  attr(out_pdf, "paginas") <- paginas
  invisible(out_pdf)
}

.mtp_consolidados_pdf <- function(ctx, out_pdf) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type(); geo <- pulso_pdf_geo("landscape")
  margen <- geo$margin; derecha <- 1 - margen; ancho <- derecha - margen
  f <- ctx$formatos; periodo <- .mtp_periodo()
  crit <- f$columna_criterio
  grupo <- vapply(f$codigos, `[[`, "", "grupo")
  no_apl <- vapply(f$codigos[grupo == "no_aplicada"], `[[`, "", "codigo")
  izq_w <- 0.26; der_x <- margen + izq_w + 0.03; der_w <- derecha - der_x
  cols <- c("N.º cuestionario", "Nombre", "Edad", "Sexo", if (nzchar(crit)) crit, "Dirección completa", "Teléfono", "Hora de inicio")
  anchos <- c(0.070, 0.130, 0.035, 0.035, if (nzchar(crit)) 0.075, 0, 0.080, 0.060)
  anchos[anchos == 0] <- der_w - sum(anchos)
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  paginas <- 0L
  for (cab in ctx$cabeceras) {
    grid::grid.newpage(); paginas <- paginas + 1L
    pulso_pdf_header(.mtp_titulo("Hoja de consolidados", cab$label), cab$subtitulo, tokens = tk, ty = ty, geo = geo,
                     y_subtitulo = 0.940, y_regla = 0.912)
    .mtp_campos(list(list("Encuestador", cab$encuestador), list("Fecha", ""), list("Supervisor", "")), margen, 0.850, ancho * 0.75, tk, ty)

    # --- Ocurrencias del recorrido: un total por código y los tres resúmenes ---
    y <- 0.800
    .hojas_ruta_hd_txt_at("Ocurrencias del recorrido", margen, y, 10.5, tk$navy, "bold")
    y <- y - 0.018
    fila_h <- 0.030
    filas <- c(lapply(f$codigos, function(k) c(k$codigo, k$rotulo)),
               list(c("", sprintf("Total no aplicadas (%s)", paste(no_apl, collapse = ", "))),
                    c("", "Encuestas efectivas (8)"), c("", "Total de intentos")))
    yb <- .mtp_tabla(c("Código", "Resultado", "Total"), c(0.045, izq_w - 0.045 - 0.055, 0.055), margen, y, fila_h, length(filas), tk, sombra = 3L)
    for (i in seq_along(filas)) {
      yi <- y - fila_h - (i - 0.5) * fila_h
      resumen <- i > length(f$codigos)
      .hojas_ruta_hd_txt_at(filas[[i]][[1]], margen + 0.005, yi, 8, tk$navy, "bold")
      .hojas_ruta_hd_txt_at(filas[[i]][[2]], margen + 0.050, yi, 7.6, tk$ink, if (resumen) "bold" else "plain")
    }
    grid::grid.lines(x = c(margen, margen + izq_w), y = rep(y - fila_h * (1 + length(f$codigos)), 2),
                     gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$columna))
    if ("99" %in% vapply(f$codigos, `[[`, "", "codigo")) {
      .hojas_ruta_hd_txt_at("El 99 es de la manzana: no entra en los intentos.", margen, yb - 0.014, 6.8, tk$soft)
    }

    # --- Registro de encuestados: una fila por cuestionario del rango de la UMP ---
    y <- 0.800
    .hojas_ruta_hd_txt_at("Registro de encuestados", der_x, y, 10.5, tk$navy, "bold")
    y <- y - 0.018
    numeros <- if (length(cab$rango)) seq.int(cab$rango[1], cab$rango[2]) else rep("", 12L)
    piso <- 0.25  # deja sitio a las observaciones
    fila_h <- max(0.026, min(0.036, (y - piso) / (length(numeros) + 1L)))
    n_cabe <- floor((y - piso) / fila_h) - 1L
    mostrados <- utils::head(numeros, n_cabe)
    yb <- .mtp_tabla(cols, anchos, der_x, y, fila_h, length(mostrados), tk, primera = mostrados, cuerpo = 8, chars_npc = 230)
    if (length(numeros) > n_cabe) {
      .hojas_ruta_hd_txt_at(sprintf("Faltan %d cuestionarios en esta hoja: anótelos al reverso.", length(numeros) - n_cabe),
                            der_x, yb - 0.014, 6.8, tk$danger)
    }
    # --- Observaciones de la jornada: líneas para escribir hasta el pie ---
    yo <- yb - 0.050
    .hojas_ruta_hd_txt_at("Observaciones", der_x, yo, 10.5, tk$navy, "bold")
    for (yl in utils::head(seq(yo - 0.036, 0.105, by = -0.030), 6L)) {
      grid::grid.lines(x = c(der_x, derecha), y = rep(yl, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = 0.6))
    }
    pulso_pdf_footer(paginas, periodo, tokens = tk, ty = ty, geo = geo, pagina = FALSE)
  }
  attr(out_pdf, "paginas") <- paginas
  invisible(out_pdf)
}

#' PDF de la hoja de ruteo o de consolidados de la campaña territorial (D1).
#' Sin `unidad`, una por UMP titular (`alcance = "todas"` suma los reemplazos).
#' @keywords internal
collection_territorial_papel <- function(sid, campaign_id = NULL, pieza = "ruteo", unidad = NULL, alcance = "titulares") {
  pieza <- .mtp_txt(pieza); alcance <- .mtp_txt(alcance)
  if (!nzchar(alcance)) alcance <- "titulares"
  if (!pieza %in% .MTP_PIEZAS || !alcance %in% .MTP_ALCANCES) {
    stop_api(422, "E_COLLECTION_TERRITORIAL_PAPEL_PIEZA", "La hoja pedida no existe: es «ruteo» o «consolidados».",
             details = list(pieza = pieza, alcance = alcance))
  }
  ctx <- .mtp_contexto(sid, campaign_id, unidad, alcance)
  path <- tempfile(fileext = ".pdf")
  out <- if (identical(pieza, "ruteo")) .mtp_ruteo_pdf(ctx, path) else .mtp_consolidados_pdf(ctx, path)
  base <- if (identical(pieza, "ruteo")) "HojaRuteo" else "HojaConsolidados"
  nombre <- if (length(ctx$cabeceras) == 1L) {
    sprintf("%s_%s.pdf", base, hojas_ruta_sanitize_filename(ctx$cabeceras[[1]]$label))
  } else sprintf("%s_%dUMP.pdf", base, length(ctx$cabeceras))
  meta <- .register_output_file(sid, paste0("material_", pieza), path, original_name = nombre)
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, pieza = pieza,
       umps = length(ctx$cabeceras), paginas = attr(out, "paginas") %||% NA_integer_)
}
