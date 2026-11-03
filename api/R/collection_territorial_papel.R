# collection_territorial_papel.R — la hoja de ruteo y la hoja de consolidados por UMP
# (checklist-formatos-campo D1, pasos B2/B3 del plan conjunto). Es el juego de papel que
# campo ya usa y hasta ahora se armaba a mano en Word: la app lo entrega con la cabecera
# llena (distrito, UMP, rango de encuestas y el encuestador de la asignación) y con los
# códigos de resultado del estudio (`collection_territorial_formatos.R`).
#
# Son formularios en blanco: nombres, edades o teléfonos los escribe campo a mano y la
# app no los guarda (arquitectura de campo §11). La hoja del encuestador sólo muestra su
# código y su nombre, nunca un DNI.

.MTP_PIEZAS <- c("ruteo", "consolidados", "conteo")  # conteo: sólo cuotas (collection_territorial_papel_conteo.R)
.MTP_ALCANCES <- c("titulares", "todas")

.mtp_txt <- function(x) if (is.null(x) || !length(x) || is.na(x[[1]])) "" else as.character(x[[1]])

# El código operativo ya suele empezar por «UMP»: no se repite en el título.
.mtp_titulo <- function(pieza, label) {
  sprintf("%s · %s", pieza, if (grepl("^UMP\\b", label)) label else paste("UMP", label))
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
    unidades <- Filter(function(u) u$role %in% c("titular", "zona"), unidades)  # en cuotas, todas las zonas
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
    if (identical(u$role, "zona")) {
      return(list(unit_id = u$unit_id, label = u$label, encuestador = enc, rango = rango, n = u$n, cuotas = u$cuotas,
                  caracter = u$caracter %||% list(),
                  subtitulo = .mtp_conteo_subtitulo(u$n, u$caracter %||% list())))
    }
    partes <- c(.hojas_ruta_title_case(.mtp_txt(u$distrito)),
                if (nzchar(.mtp_txt(u$zona))) paste("Zona", u$zona),
                if (nzchar(.mtp_txt(u$manzana))) paste("Manzana", u$manzana),
                if (length(rango)) sprintf("Encuestas %d a %d", rango[1], rango[2]),
                if (identical(u$role, "reemplazo") && !is.na(u$titular_id)) paste("Reemplaza a", unname(label_de[u$titular_id])))
    list(unit_id = u$unit_id, label = u$label, encuestador = enc, rango = rango,
         subtitulo = paste(Filter(nzchar, partes), collapse = " · "))
  })
  # El nombre del estudio va en el título y el pie, como en las hojas reales (sale del Planner).
  estudio <- tryCatch(.mtp_txt(.planner_leer(s)$estudio$nombre), error = function(e) "")
  list(campana = hit$entry, cabeceras = cabeceras, estudio = estudio,
       formatos = collection_territorial_formatos_get(sid, hit$entry$id))
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
.mtp_tabla <- function(cols, anchos, x0, y, fila_h, n_filas, tk, primera = NULL, sombra = integer(0), cuerpo = 7.4, chars_npc = 160,
                       cab_h = fila_h) {
  w <- sum(anchos); xs <- x0 + c(0, cumsum(anchos))
  grid::grid.rect(x = x0, y = y, width = w, height = cab_h, just = c("left", "top"), gp = grid::gpar(col = NA, fill = tk$tbl_header))
  # El rótulo largo parte en dos líneas antes que montarse sobre la columna vecina.
  for (c in seq_along(cols)) {
    rot <- paste(strwrap(cols[[c]], width = max(6L, floor(anchos[[c]] * chars_npc))), collapse = "\n")
    grid::grid.text(rot, x = grid::unit(xs[[c]] + 0.005, "npc"), y = grid::unit(y - cab_h / 2, "npc"), just = c("left", "center"),
                    gp = grid::gpar(fontsize = 6.8, fontface = "bold", col = tk$ink, lineheight = 0.95))
  }
  grid::grid.lines(x = c(x0, x0 + w), y = rep(y, 2), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$bloque))
  grid::grid.lines(x = c(x0, x0 + w), y = rep(y - cab_h, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = pulso_pdf_pesos()$columna))
  y1 <- y - cab_h
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

# Leyenda de códigos en `n_col` columnas, sobre lienzo con el acento navy. Un rótulo largo
# («Vivienda abandonada / sin vivencia / inaccesible») se parte en líneas dentro de su
# columna en vez de montarse sobre la vecina; la fila crece con el rótulo más largo.
.mtp_leyenda <- function(codigos, x0, y, w, tk, n_col = 3L, titulo = "Códigos de resultado", chars_npc = 175) {
  filas <- ceiling(length(codigos) / n_col)
  cw <- (w - 0.014) / n_col
  ancho_txt <- max(8L, floor((cw - 0.036) * chars_npc))
  lineas <- lapply(codigos, function(k) strwrap(k$rotulo, width = ancho_txt))
  linea_h <- 0.0108
  alto_fila <- vapply(seq_len(filas), function(f) {
    en_fila <- which(((seq_along(codigos) - 1L) %% filas) + 1L == f)
    max(1L, vapply(lineas[en_fila], length, 1L)) * linea_h + 0.0028
  }, numeric(1))
  h <- 0.024 + sum(alto_fila) + 0.004
  grid::grid.rect(x = x0, y = y, width = w, height = h, just = c("left", "top"), gp = grid::gpar(col = NA, fill = tk$canvas))
  grid::grid.lines(x = rep(x0, 2), y = c(y, y - h), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$acento))
  .hojas_ruta_hd_txt_at(titulo, x0 + 0.014, y - 0.012, 9, tk$navy, "bold")
  y_fila <- y - 0.026 - c(0, cumsum(alto_fila))[seq_len(filas)]
  for (i in seq_along(codigos)) {
    col <- (i - 1L) %/% filas; fila <- (i - 1L) %% filas
    xc <- x0 + 0.014 + col * cw; yc <- y_fila[[fila + 1L]]
    .hojas_ruta_hd_txt_at(codigos[[i]]$codigo, xc, yc, 8, tk$navy, "bold")
    for (j in seq_along(lineas[[i]])) .hojas_ruta_hd_txt_at(lineas[[i]][[j]], xc + 0.030, yc - (j - 1L) * linea_h, 7.6, tk$ink)
  }
  h
}

# Casillas para marcar a mano (☐ no está en la fuente del PDF: se dibujan).
.mtp_casillas <- function(etiqueta, opciones, x0, y, tk, ty, geo) {
  .hojas_ruta_hd_txt_at(toupper(etiqueta), x0, y + 0.018, ty$eyebrow, tk$soft, "bold")
  x <- x0
  lado <- 0.011
  for (o in opciones) {
    grid::grid.rect(x = grid::unit(x, "npc"), y = grid::unit(y + 0.006, "npc"), width = grid::unit(lado, "npc"),
                    height = grid::unit(lado * geo$page_w / geo$page_h, "npc"), just = c("left", "center"),
                    gp = grid::gpar(col = tk$ink, fill = "white", lwd = 0.6))
    .hojas_ruta_hd_txt_at(o, x + lado + 0.006, y + 0.006, 8.4, tk$ink)
    x <- x + lado + 0.012 + nchar(o) * 0.0075
  }
}

# Pie de las hojas impresas: el estudio y la pieza, como en las reales («… Hoja de ruteo, cara 1 de 2»).
.mtp_pie <- function(ctx, pieza, paginas, tk, ty, geo) {
  rot <- paste(Filter(nzchar, c(ctx$estudio, pieza)), collapse = " · ")
  pulso_pdf_footer(paginas, rot, tokens = tk, ty = ty, geo = geo, pagina = FALSE)
}

.mtp_ruteo_pdf <- function(ctx, out_pdf) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type(); geo <- pulso_pdf_geo("portrait")
  margen <- geo$margin; ancho <- 1 - 2 * margen
  f <- ctx$formatos
  crit <- f$columna_criterio
  # Columnas de la hoja real de Ser Adolescente (03_Hoja_de_ruteo): N°, dirección, N.º de la vivienda,
  # resultado, participante, edad, sexo y el criterio del estudio. Opcionales (formatos, extras_ruteo):
  # «Mz.» y el número de encuesta de la hoja de seguimiento de ACNUR, y SUP. (Sí / No) de supervisión.
  ex <- unlist(f$extras_ruteo %||% list("supervision"))
  fijas <- list(list("N°", 0.035), if ("manzana" %in% ex) list("Mz.", 0.045), list("Dirección: calle, avenida o pasaje", NA),
                list("N.º", 0.050), list("Resultado", 0.065), list("Nombre del participante", NA), list("Edad", 0.040),
                list("Sexo", 0.040), if (nzchar(crit)) list(crit, 0.090),
                if ("cuestionario" %in% ex) list("N.º de encuesta", 0.060), if ("supervision" %in% ex) list("SUP. (Sí / No)", 0.100))
  fijas <- Filter(Negate(is.null), fijas)
  cols <- vapply(fijas, `[[`, "", 1L)
  anchos <- vapply(fijas, function(x) x[[2]], numeric(1))
  # Dirección y participante se reparten lo que queda (55 / 45).
  libre <- ancho - sum(anchos, na.rm = TRUE)
  anchos[is.na(anchos)] <- libre * c(0.55, 0.45)
  fila_h <- 0.0140  # ~49 filas en la cara 1 y ~58 en la 2, como la hoja real (49 + 56)
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  paginas <- 0L
  for (cab in ctx$cabeceras) {
    n0 <- 0L
    for (cara in seq_len(f$caras_ruteo)) {
      grid::grid.newpage(); paginas <- paginas + 1L
      pie <- sprintf("Hoja de ruteo, cara %d de %d", cara, f$caras_ruteo)
      if (cara == 1L) {
        pulso_pdf_header(.mtp_titulo("Hoja de ruteo", cab$label), cab$subtitulo, tokens = tk, ty = ty, geo = geo,
                         y_subtitulo = 0.944, y_regla = 0.922)
        .mtp_campos(list(list("Encuestador", cab$encuestador), list("Fecha", ""), list("Hoja n.º", "")), margen, 0.876, ancho * 0.66, tk, ty)
        .mtp_casillas("Ámbito", c("Urbano", "Periurbano"), margen + ancho * 0.70, 0.876, tk, ty, geo)
        y <- 0.852
        y <- y - .mtp_leyenda(f$codigos, margen, y, ancho, tk) - 0.012
      } else {
        # La cara 2 sólo sigue la tabla; arriba, lo justo para no confundir la hoja.
        .hojas_ruta_hd_txt_at(sprintf("%s · %s", .mtp_titulo("Hoja de ruteo", cab$label), pie), margen, 0.962, 9, tk$navy, "bold")
        y <- 0.945
      }
      n <- max(1L, floor((y - 0.100) / fila_h) - 1L)
      yb <- .mtp_tabla(cols, anchos, margen, y, fila_h, n, tk, primera = n0 + seq_len(n), sombra = match("Resultado", cols),
                       cuerpo = 6.8, cab_h = 0.022)
      n0 <- n0 + n
      if (cara == 1L) {
        .hojas_ruta_hd_txt_at("Un código por visita, en la columna sombreada. Con 8 (efectiva), registre a la persona en la hoja de consolidados.",
                              margen, yb - 0.010, 6.6, tk$soft)
      }
      .mtp_pie(ctx, pie, paginas, tk, ty, geo)
    }
  }
  attr(out_pdf, "paginas") <- paginas
  invisible(out_pdf)
}

.mtp_consolidados_pdf <- function(ctx, out_pdf) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type(); geo <- pulso_pdf_geo("landscape")
  margen <- geo$margin; derecha <- 1 - margen; ancho <- derecha - margen
  f <- ctx$formatos
  crit <- f$columna_criterio
  extras <- unlist(f$extras_consolidado %||% list())
  grupo <- vapply(f$codigos, `[[`, "", "grupo")
  no_apl <- f$codigos[grupo == "no_aplicada"]
  efectiva <- f$codigos[grupo == "efectiva"]
  manzana <- f$codigos[grupo == "manzana"]
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  paginas <- 0L
  for (cab in ctx$cabeceras) {
    grid::grid.newpage(); paginas <- paginas + 1L
    pulso_pdf_header(.mtp_titulo("Hoja de consolidados", cab$label), cab$subtitulo, tokens = tk, ty = ty, geo = geo,
                     y_subtitulo = 0.940, y_regla = 0.912)
    .mtp_campos(list(list("Encuestador", cab$encuestador), list("Fecha", ""), list("Hoja n.º", "")), margen, 0.858, ancho * 0.62, tk, ty)
    .mtp_casillas("Ámbito", c("Urbano", "Periurbano"), margen + ancho * 0.66, 0.858, tk, ty, geo)

    # --- Ocurrencias del recorrido: una fila, el código arriba y la casilla abajo (como la hoja real) ---
    y <- 0.818
    .hojas_ruta_hd_txt_at("Ocurrencias del recorrido", margen, y, 10.5, tk$navy, "bold")
    y <- y - 0.016
    cols_oc <- c(vapply(no_apl, function(k) sprintf("%s (%s)", k$rotulo, k$codigo), ""),
                 sprintf("Total no aplicadas (%s)", paste(vapply(no_apl, `[[`, "", "codigo"), collapse = ", ")),
                 vapply(efectiva, function(k) sprintf("%s (%s)", k$rotulo, k$codigo), ""),
                 "Total de intentos",
                 vapply(manzana, function(k) sprintf("%s (%s)", k$rotulo, k$codigo), ""))
    anchos_oc <- rep(ancho / length(cols_oc), length(cols_oc))
    yb <- .mtp_tabla(cols_oc, anchos_oc, margen, y, 0.040, 1L, tk, cab_h = 0.062, chars_npc = 230,
                     sombra = match(c(sprintf("Total no aplicadas (%s)", paste(vapply(no_apl, `[[`, "", "codigo"), collapse = ", ")), "Total de intentos"), cols_oc))
    if (length(manzana)) {
      .hojas_ruta_hd_txt_at("El código de la manzana no entra en los intentos.", margen, yb - 0.012, 6.6, tk$soft)
    }

    # --- Registro de encuestados: una fila por cuestionario del rango de la UMP (pre-numerado, decisión d) ---
    y <- yb - 0.040
    .hojas_ruta_hd_txt_at("Registro de encuestados", margen, y, 10.5, tk$navy, "bold")
    if ("manzana" %in% extras) .mtp_campos(list(list("Total de manzanas recorridas", "")), margen + ancho * 0.62, y - 0.010, ancho * 0.38, tk, ty)
    y <- y - 0.018
    cols <- c("N.º de cuestionario", if ("manzana" %in% extras) "Mz.", "Nombre del participante", "Edad", "Sexo",
              if (nzchar(crit)) crit, if ("nse" %in% extras) "NSE",
              "Dirección completa: avenida, calle, jirón, n.º, lote, interior, piso, urbanización o asentamiento humano",
              "Teléfono", "Hora de inicio", if ("hora_final" %in% extras) "Hora final")
    base <- c(0.070, if ("manzana" %in% extras) 0.040, 0.150, 0.035, 0.035, if (nzchar(crit)) 0.075, if ("nse" %in% extras) 0.040,
              0, 0.080, 0.060, if ("hora_final" %in% extras) 0.060)
    base[base == 0] <- ancho - sum(base)
    numeros <- if (length(cab$rango)) seq.int(cab$rango[1], cab$rango[2]) else rep("", 12L)
    piso <- 0.20
    fila_h <- max(0.026, min(0.034, (y - piso) / (length(numeros) + 1L)))
    n_cabe <- floor((y - 0.032 - piso) / fila_h)
    mostrados <- utils::head(numeros, n_cabe)
    yb <- .mtp_tabla(cols, base, margen, y, fila_h, length(mostrados), tk, primera = mostrados, cuerpo = 8, chars_npc = 230, cab_h = 0.032)
    if (length(numeros) > n_cabe) {
      .hojas_ruta_hd_txt_at(sprintf("Faltan %d cuestionarios en esta hoja: anótelos al reverso.", length(numeros) - n_cabe),
                            margen, yb - 0.012, 6.6, tk$danger)
    }
    # --- Observaciones: líneas para escribir hasta el pie ---
    yo <- yb - 0.040
    .hojas_ruta_hd_txt_at("Observaciones", margen, yo, 10.5, tk$navy, "bold")
    for (yl in utils::head(seq(yo - 0.030, 0.100, by = -0.028), 4L)) {
      grid::grid.lines(x = c(margen, derecha), y = rep(yl, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = 0.6))
    }
    .mtp_pie(ctx, "Hoja de consolidados", paginas, tk, ty, geo)
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
    stop_api(422, "E_COLLECTION_TERRITORIAL_PAPEL_PIEZA", "La hoja pedida no existe: es «ruteo», «consolidados» o «conteo».",
             details = list(pieza = pieza, alcance = alcance))
  }
  ctx <- .mtp_contexto(sid, campaign_id, unidad, alcance)
  if (identical(pieza, "conteo") && !all(vapply(ctx$cabeceras, function(c) is.list(c$cuotas), TRUE))) {
    stop_api(422, "E_COLLECTION_TERRITORIAL_PAPEL_PIEZA", "La hoja de conteo es de un territorial por cuotas: esta muestra se envió por UMP.",
             details = list(pieza = pieza))
  }
  path <- tempfile(fileext = ".pdf")
  out <- switch(pieza, ruteo = .mtp_ruteo_pdf(ctx, path), consolidados = .mtp_consolidados_pdf(ctx, path),
                conteo = .mtp_conteo_pdf(ctx, path))
  base <- c(ruteo = "HojaRuteo", consolidados = "HojaConsolidados", conteo = "HojaConteo")[[pieza]]
  nombre <- if (length(ctx$cabeceras) == 1L) {
    sprintf("%s_%s.pdf", base, hojas_ruta_sanitize_filename(ctx$cabeceras[[1]]$label))
  } else sprintf("%s_%d%s.pdf", base, length(ctx$cabeceras), if (identical(pieza, "conteo")) "Zonas" else "UMP")
  meta <- .register_output_file(sid, paste0("material_", pieza), path, original_name = nombre)
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, pieza = pieza,
       umps = length(ctx$cabeceras), paginas = attr(out, "paginas") %||% NA_integer_)
}
