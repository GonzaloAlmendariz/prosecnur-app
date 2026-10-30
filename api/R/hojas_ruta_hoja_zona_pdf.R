# Hoja de zona del paquete de entrega: una página A4 apaisada por zona con todas
# sus rutas sobre el mismo mapa de la cara 2 de la ficha (calles con nombre,
# límites de zona y distrito, referencias), y al lado el resumen, el contexto distrital y
# la leyenda con la capa Pulso PDF (hojas_ruta_ficha_pdf.R, hojas_ruta_mapa_marco.R).
#
# El motor congelado (`hojas_ruta_engine.R`) la llama desde
# `.hojas_ruta_draw_zone_sheet_pdf` con un enganche de una línea; si no hay
# contexto cartográfico sigue usando su hoja de respaldo.
#
# Se imprime en blanco y negro: titular rellena con insignia navy numerada,
# reemplazo en blanco con borde discontinuo e insignia «R n». Nada se distingue
# sólo por color.

.hojas_ruta_hz_num <- function(x) format(as.integer(x %||% 0L), big.mark = ",")

#' Filas de la tabla de rutas de la zona, titulares primero.
#' @keywords internal
.hojas_ruta_hoja_zona_filas <- function(zone_blocks) {
  if (!nrow(zone_blocks)) return(list())
  tipo <- if ("tipo_manzana" %in% names(zone_blocks)) as.character(zone_blocks$tipo_manzana) else rep("titular", nrow(zone_blocks))
  orden <- order(ifelse(tipo == "reemplazo", 1L, 0L), zone_blocks$orden_seleccion %||% seq_len(nrow(zone_blocks)), zone_blocks$id_manzana)
  lapply(orden, function(i) {
    row <- as.list(zone_blocks[i, , drop = FALSE])
    row[] <- lapply(row, function(x) x[[1]])
    es_r <- identical(as.character(row$tipo_manzana %||% ""), "reemplazo")
    a <- suppressWarnings(as.integer(row$rango_inicio %||% NA))
    b <- suppressWarnings(as.integer(row$rango_fin %||% NA))
    reemplaza <- if (es_r) {
      t <- suppressWarnings(as.integer(row$titular_hoja_num %||% row$titular_orden_seleccion %||% NA))
      if (length(t) && !is.na(t)) sprintf("UMP %d", t) else "—"
    } else "—"
    list(
      id = as.character(row$id_manzana %||% ""),
      reemplazo = es_r,
      codigo = .hojas_ruta_operational_code(row),
      manzana = as.character(row$manzana %||% ""),
      encuestas = if (length(a) && length(b) && !is.na(a) && !is.na(b)) sprintf("%d–%d", a, b) else as.character(row$entrevistas %||% ""),
      viviendas = .hojas_ruta_hz_num(row$viviendas),
      viviendas_n = suppressWarnings(as.integer(row$viviendas %||% NA)),
      encuestas_n = if (length(a) && length(b) && !is.na(a) && !is.na(b)) b - a + 1L else suppressWarnings(as.integer(row$entrevistas %||% NA)),
      reemplaza = reemplaza
    )
  })
}

#' Rutas que dibuja la hoja de zona. Una zona con titulares no lleva sus
#' reemplazos: un reemplazo sólo sale si la titular no se pudo hacer, y entonces
#' va con su propia ficha. Si la zona sólo entra al paquete por reemplazos, la
#' hoja es de esos reemplazos.
#' @keywords internal
.hojas_ruta_hoja_zona_rutas <- function(zone_blocks) {
  filas <- .hojas_ruta_hoja_zona_filas(zone_blocks)
  titulares <- Filter(function(f) !f$reemplazo, filas)
  if (length(titulares)) titulares else filas
}

# Lista corta para el resumen: «UMP 1, 2, 5» o «R 3, 4», con «y N más» si no cabe.
.hojas_ruta_hz_lista_rutas <- function(codigos, max = 6L) {
  if (!length(codigos)) return("—")
  prefijo <- sub("\\s*\\d.*$", "", codigos[[1]])
  nums <- trimws(sub("^\\D*", "", codigos))
  txt <- paste(utils::head(nums, max), collapse = ", ")
  if (length(nums) > max) txt <- sprintf("%s y %d más", txt, length(nums) - max)
  trimws(paste(prefijo, txt))
}

# Insignia de una ruta sobre el mapa: círculo navy con número blanco (titular) o
# círculo blanco con borde navy y «R n» (reemplazo).
.hojas_ruta_hz_insignia <- function(x, y, texto, reemplazo, tk) {
  r <- grid::unit(if (nchar(texto) > 2) 7.2 else 6.2, "pt")
  grid::grid.circle(x = x, y = y, r = r, default.units = "npc",
                    gp = grid::gpar(fill = if (reemplazo) "#ffffff" else tk$navy, col = tk$navy, lwd = 1.2))
  grid::grid.text(texto, x = x, y = y, default.units = "npc",
                  gp = grid::gpar(fontsize = if (nchar(texto) > 2) 6.4 else 7.4, fontface = "bold",
                                  col = if (reemplazo) tk$navy else "#ffffff"))
}

#' Dibuja la hoja de zona. Devuelve TRUE, o FALSE si no hay contexto cartográfico.
#' @keywords internal
hojas_ruta_hoja_zona_pdf <- function(zone_row, zone_blocks, config, out_pdf, render_ctx = NULL) {
  ubigeo <- as.character(zone_row$ubigeo %||% "")
  zona <- as.character(zone_row$zona %||% "")
  filas <- .hojas_ruta_hoja_zona_rutas(zone_blocks)
  ids <- vapply(filas, `[[`, "", "id")
  ctx_zone <- .hojas_ruta_zone_context_features(ubigeo, zona, ids, render_ctx = render_ctx)
  if (is.null(ctx_zone)) return(FALSE)
  tk <- pulso_pdf_tokens()
  pesos <- pulso_pdf_pesos()

  grDevices::pdf(out_pdf, paper = "special", width = 11.69, height = 8.27)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  L <- 0.035
  R <- 0.97
  primero <- if (nrow(zone_blocks)) { b <- as.list(zone_blocks[1, , drop = FALSE]); b[] <- lapply(b, function(x) x[[1]]); b } else list()
  territorio <- toupper(paste(Filter(nzchar, c(.hojas_ruta_ficha_nombre(primero$departamento %||% ""),
                                              .hojas_ruta_ficha_nombre(primero$provincia %||% ""))), collapse = " · "))
  distrito <- .hojas_ruta_ficha_nombre(zone_row$distrito %||% primero$distrito %||% "")
  n_tit <- sum(!vapply(filas, `[[`, FALSE, "reemplazo"))
  n_rem <- length(filas) - n_tit

  # --- Cabecera --------------------------------------------------------------
  if (nzchar(territorio)) .hfp_text(territorio, L, 0.962, 7.4, tk$soft, "bold", spacing = 1.2)
  .hfp_text("Hoja de zona", L, 0.935, 17, tk$navy, "bold")
  .hfp_text(sprintf("%s  ·  Zona %s  ·  UBIGEO %s", distrito, zona, ubigeo), L, 0.905, 9.5, tk$ink)
  chip_x <- 0.80
  chip_w <- R - chip_x
  .hfp_rect(chip_x, 0.975, chip_w, 0.078, fill = "#ffffff", col = tk$navy, lwd = 1.6, r = 0.08)
  .hfp_text("ZONA", chip_x + chip_w / 2, 0.958, 6.6, tk$soft, "bold", just = c("center", "center"), spacing = 1.2)
  .hfp_text(zona, chip_x + chip_w / 2, 0.937, 15, tk$navy, "bold", just = c("center", "center"))
  .hfp_text(if (n_tit) sprintf("%d ruta%s titular%s", n_tit, if (n_tit == 1) "" else "s", if (n_tit == 1) "" else "es")
            else sprintf("%d reemplazo%s", n_rem, if (n_rem == 1) "" else "s"),
            chip_x + chip_w / 2, 0.913, 7.6, tk$ink, just = c("center", "center"))
  .hfp_line(L, R, 0.886, col = tk$navy, lwd = pesos$bloque)

  # --- Mapa ------------------------------------------------------------------
  map_x <- L
  map_y <- 0.072
  map_w <- 0.70
  map_h <- 0.798
  grid::grid.rect(x = map_x + map_w / 2, y = map_y + map_h / 2, width = map_w, height = map_h,
                  gp = grid::gpar(fill = "#fbfbfb", col = NA))
  # Encuadre: la zona y todas sus rutas (un reemplazo puede caer al borde).
  sel_feats <- Filter(function(f) as.character(f$id %||% "") %in% ids, ctx_zone$all %||% ctx_zone$features)
  base_bbox <- .hojas_ruta_bbox_from_rings(c(unlist(lapply(ctx_zone$zone_features, `[[`, "rings"), recursive = FALSE),
                                             unlist(lapply(sel_feats, `[[`, "rings"), recursive = FALSE)))
  map_bbox <- .hojas_ruta_bbox_fit_aspect(.hojas_ruta_bbox_expand(base_bbox, pad = 0.075), width = map_w, height = map_h)
  project <- .hojas_ruta_project_rings(list(.hojas_ruta_bbox_to_ring(map_bbox)), 0.012, 0.012, 0.976, 0.976, pad = 0)

  visibles <- Filter(function(f) .hojas_ruta_bbox_intersects(f$bbox %||% .hojas_ruta_bbox_from_rings(f$rings), map_bbox),
                     ctx_zone$all %||% ctx_zone$features)
  zone_outlines <- .hojas_ruta_pdf_zone_outline_features(ubigeo, map_bbox, render_ctx = render_ctx)
  vecinas <- .hojas_ruta_pdf_neighbor_block_features(ubigeo, map_bbox, render_ctx = render_ctx)
  distritos <- tryCatch(.hojas_ruta_pdf_district_context_features(ubigeo, map_bbox), error = function(e) list())
  streets <- .hojas_ruta_pdf_street_features(ubigeo, map_bbox, max_features = 1800L, render_ctx = render_ctx)
  urbano <- .hojas_ruta_pdf_context_features(ubigeo, map_bbox, render_ctx = render_ctx)
  aspecto_vp <- (map_w * 11.69) / (map_h * 8.27)

  grid::pushViewport(grid::viewport(x = map_x + map_w / 2, y = map_y + map_h / 2, width = map_w, height = map_h, clip = "on"))
  for (feature in urbano$polygons %||% list()) {
    fill <- switch(feature$class, water = "#e8f4fb", square = "#f2f2f2", "#f5fff1")
    border <- switch(feature$class, water = "#6d9fbd", square = "#777777", "#78ad68")
    for (ring in feature$rings) {
      p <- project(ring)
      grid::grid.polygon(x = p$x, y = p$y, default.units = "npc", gp = grid::gpar(fill = fill, col = border, lwd = 0.32))
      if (identical(feature$class, "green")) .hojas_ruta_draw_green_texture(p)
    }
  }
  an <- .hojas_ruta_mapa_anillos(vecinas, project)
  sp <- vapply(vecinas, .hojas_ruta_pdf_feature_without_population, logical(1))[an$feature]
  .hojas_ruta_mapa_poligonos(an$p, fill = ifelse(sp, "#eeeeee", "#f7f7f7"), col = "#c8c8c8", lwd = 0.16)
  for (p in an$p[sp]) .hojas_ruta_draw_no_population_texture(p, density = 0.011)
  hay_sin_poblacion <- any(sp)
  otras <- Filter(function(f) !(as.character(f$id %||% "") %in% ids), visibles)
  an <- .hojas_ruta_mapa_anillos(otras, project)
  sp <- vapply(otras, .hojas_ruta_pdf_feature_without_population, logical(1))[an$feature]
  iz <- vapply(otras, function(f) isTRUE(f$in_zone), logical(1))[an$feature]
  .hojas_ruta_mapa_poligonos(an$p, fill = ifelse(sp, "#f1f1f1", ifelse(iz, "#ffffff", "#fbfbfb")),
                             col = ifelse(sp, "#9a9a9a", ifelse(iz, "#333333", "#b8b8b8")),
                             lwd = ifelse(sp, 0.24, ifelse(iz, 0.30, 0.18)))
  for (p in an$p[sp]) .hojas_ruta_draw_no_population_texture(p, density = 0.010)
  hay_sin_poblacion <- hay_sin_poblacion || any(sp)

  ub6 <- sprintf("%06s", ubigeo)
  for (d in distritos[order(vapply(distritos, function(f) identical(as.character(f$ubigeo %||% ""), ub6), logical(1)))]) {
    activo <- identical(as.character(d$ubigeo %||% ""), ub6)
    for (ring in d$rings) {
      p <- project(.hojas_ruta_chaikin_smooth(ring, iters = 1L, closed = TRUE))
      grid::grid.polygon(x = p$x, y = p$y, default.units = "npc",
                         gp = grid::gpar(fill = NA, col = if (activo) "#111111" else "#555555", lwd = if (activo) 0.95 else 0.65, linejoin = "round"))
    }
  }
  for (z in zone_outlines) {
    actual <- identical(as.character(z$zona %||% ""), zona)
    for (ring in z$rings) {
      p <- project(.hojas_ruta_chaikin_smooth(ring, iters = 2L, closed = TRUE))
      grid::grid.polygon(x = p$x, y = p$y, default.units = "npc",
                         gp = grid::gpar(fill = NA, col = if (actual) "#083f88" else "#d7191c", lwd = if (actual) 1.85 else 0.75, linejoin = "round"))
    }
  }

  # Rutas: titulares rellenas, reemplazos en blanco con borde discontinuo.
  seleccion <- NULL
  centros <- list()
  for (fila in filas) {
    f <- Find(function(x) identical(as.character(x$id %||% ""), fila$id), visibles)
    if (is.null(f)) next
    xs <- c(); ys <- c()
    for (ring in f$rings) {
      p <- project(ring)
      grid::grid.polygon(x = p$x, y = p$y, default.units = "npc",
                         gp = grid::gpar(fill = if (fila$reemplazo) "#ffffff" else "#cfe8ff", col = "#003f88",
                                         lwd = if (fila$reemplazo) 1.4 else 1.75, lty = if (fila$reemplazo) "22" else "solid"))
      xs <- c(xs, p$x); ys <- c(ys, p$y)
      seleccion <- c(x0 = min(p$x, seleccion[["x0"]]), x1 = max(p$x, seleccion[["x1"]]),
                     y0 = min(p$y, seleccion[["y0"]]), y1 = max(p$y, seleccion[["y1"]]))
    }
    if (length(xs)) centros[[length(centros) + 1L]] <- list(x = mean(range(xs)), y = mean(range(ys)), fila = fila)
  }

  etiquetas <- .hojas_ruta_pdf_block_label_candidates(otras, project, "")
  .hojas_ruta_mapa_textos(vapply(etiquetas, function(l) as.character(l$label), ""),
                          vapply(etiquetas, `[[`, 0, "x"), vapply(etiquetas, `[[`, 0, "y"),
                          size = vapply(etiquetas, function(l) as.numeric(l$fontsize), 0),
                          col = ifelse(vapply(etiquetas, function(l) isTRUE(l$in_zone), logical(1)), "#111111", "#707070"), halo_pt = 0.6)
  calles <- .hojas_ruta_pdf_street_label_candidates_map(streets, project, max_labels = 220L, viewport_aspect = aspecto_vp)
  .hojas_ruta_mapa_textos(vapply(calles, function(l) as.character(l$name), ""),
                          vapply(calles, `[[`, 0, "x"), vapply(calles, `[[`, 0, "y"),
                          rot = vapply(calles, function(l) as.numeric(l$angle), 0),
                          size = vapply(calles, function(l) as.numeric(l$fontsize), 0),
                          face = ifelse(vapply(calles, function(l) isTRUE(l$major), logical(1)), "bold", "plain"),
                          halo_pt = 0.8)
  .hojas_ruta_mapa_rotulos_zona(zone_outlines, zona, project, seleccion)
  zona_rings <- unlist(lapply(Filter(function(z) identical(as.character(z$zona %||% ""), zona), zone_outlines), `[[`, "rings"), recursive = FALSE)
  referencias <- .hojas_ruta_mapa_dibujar_referencias(ubigeo, map_bbox, project, render_ctx, zona = zona_rings)
  # Insignias al final: encima de calles, números y referencias.
  for (c0 in centros) {
    texto <- if (c0$fila$reemplazo) sub("^R\\s*", "R", c0$fila$codigo) else sub("^UMP\\s*", "", c0$fila$codigo)
    .hojas_ruta_hz_insignia(c0$x, c0$y, texto, c0$fila$reemplazo, tk)
  }
  grid::popViewport()
  grid::grid.rect(x = map_x + map_w / 2, y = map_y + map_h / 2, width = map_w, height = map_h,
                  gp = grid::gpar(fill = NA, col = "black", lwd = 0.7))

  # --- Panel lateral: resumen, contexto distrital y leyenda --------------------
  sx <- map_x + map_w + 0.02
  sw <- R - sx
  .hojas_ruta_mapa_rotulo("Resumen de la zona", sx, 0.855, sw, tk)
  suma <- function(campo) { v <- unlist(lapply(filas, `[[`, campo)); if (length(v) && any(!is.na(v))) sum(v, na.rm = TRUE) else NA }
  rutas_txt <- .hojas_ruta_hz_lista_rutas(vapply(filas, `[[`, "", "codigo"))
  mzs <- vapply(filas, `[[`, "", "manzana")
  mzs_txt <- if (length(mzs) > 4) sprintf("%s y %d más", paste(utils::head(mzs, 4), collapse = ", "), length(mzs) - 4) else paste(mzs, collapse = ", ")
  resumen <- list(
    c("Población censada", .hojas_ruta_hz_num(zone_row$poblacion)),
    c("Viviendas censadas", .hojas_ruta_hz_num(zone_row$viviendas)),
    c("Manzanas de la zona", .hojas_ruta_hz_num(zone_row$manzanas_zona)),
    c(if (n_tit) "Rutas" else "Reemplazos", rutas_txt),
    c(if (length(mzs) == 1) "Manzana" else "Manzanas", mzs_txt),
    c("Viviendas en ruta", .hojas_ruta_hz_num(suma("viviendas_n"))),
    c("Encuestas", .hojas_ruta_hz_num(suma("encuestas_n")))
  )
  y <- 0.835
  fh <- 0.026
  for (i in seq_along(resumen)) {
    if (i %% 2 == 1) .hfp_rect(sx, y, sw, fh, fill = tk$tbl_zebra, col = NA)
    .hfp_text(resumen[[i]][[1]], sx + 0.006, y - fh / 2, 7.6, tk$soft)
    .hfp_text(resumen[[i]][[2]], sx + sw - 0.006, y - fh / 2, 8.4, tk$ink, "bold", just = c("right", "center"))
    y <- y - fh
  }
  .hfp_line(sx, sx + sw, y, col = tk$tbl_frame, lwd = pesos$fila)

  # Dónde queda la zona dentro del distrito y entre sus vecinos, como en la cara 2.
  mini_top <- y - 0.058
  mini_h <- 0.29
  .hojas_ruta_mapa_contexto_distrital(list(ubigeo = ubigeo, zona = zona, distrito = distrito),
                                      sx, mini_top - mini_h, sw, mini_h,
                                      fallback_rings = unlist(lapply(ctx_zone$zone_features, `[[`, "rings"), recursive = FALSE),
                                      render_ctx = render_ctx)

  # Leyenda: sólo lo que el mapa dibujó, con la marca de ruta primero.
  ly <- mini_top - mini_h - 0.04
  .hojas_ruta_mapa_rotulo("Leyenda", sx, ly, sw, tk)
  items <- c(
    if (n_tit) list(list("Ruta titular", function(x0, yy) .hojas_ruta_hz_insignia(x0 + 0.012, yy, "1", FALSE, tk))),
    if (n_rem) list(list("Reemplazo", function(x0, yy) .hojas_ruta_hz_insignia(x0 + 0.012, yy, "R1", TRUE, tk))),
    list(list("Límite de zona", function(x0, yy) grid::grid.lines(x = c(x0 + 0.004, x0 + 0.02), y = c(yy, yy), gp = grid::gpar(col = "#083f88", lwd = 1.9))))
  )
  if (length(distritos)) items <- c(items, list(list("Límite distrital", function(x0, yy) grid::grid.lines(x = c(x0 + 0.004, x0 + 0.02), y = c(yy, yy), gp = grid::gpar(col = "#111111", lwd = 0.95)))))
  if (any(vapply(zone_outlines, function(z) !identical(as.character(z$zona %||% ""), zona), logical(1)))) {
    items <- c(items, list(list("Otras zonas INEI", function(x0, yy) grid::grid.lines(x = c(x0 + 0.004, x0 + 0.02), y = c(yy, yy), gp = grid::gpar(col = "#d7191c", lwd = 0.75)))))
  }
  if (hay_sin_poblacion) items <- c(items, list(list("Sin población", function(x0, yy) grid::grid.rect(x = x0 + 0.004, y = yy, width = 0.016, height = 0.02, just = c("left", "center"), gp = grid::gpar(fill = "#f1f1f1", col = "#9a9a9a", lwd = 0.4)))))
  for (tipo in intersect(names(.hojas_ruta_mapa_referencia_tipos), referencias)) {
    items <- c(items, list(list(.hojas_ruta_mapa_referencia_rotulos[[tipo]],
                                local({ tt <- tipo; function(x0, yy) .hojas_ruta_mapa_icono(tt, x0 + 0.012, yy, r_pt = 4.6) }))))
  }
  # Dos columnas cuando no caben en una sobre el pie del mapa.
  paso <- 0.028
  cabe <- max(1L, floor((ly - 0.03 - map_y) / paso) + 1L)
  ncol <- if (length(items) > cabe) 2L else 1L
  por_col <- ceiling(length(items) / ncol)
  for (k in seq_along(items)) {
    col_k <- (k - 1L) %/% por_col
    xx <- sx + col_k * sw / 2
    yy <- ly - 0.03 - ((k - 1L) %% por_col) * paso
    it <- items[[k]]
    it[[2]](xx, yy)
    .hfp_text(it[[1]], xx + 0.03, yy, 7.6, tk$ink)
  }

  # --- Pie -----------------------------------------------------------------
  .hfp_line(L, R, 0.052, col = tk$line, lwd = 0.7)
  logo <- .hojas_ruta_ficha_png(.pulso_pdf_logo_path())
  if (!is.null(logo)) {
    lw <- 0.075
    lh <- lw * (dim(logo)[1] / dim(logo)[2]) * .hojas_ruta_mapa_aspecto
    grid::grid.raster(logo, x = L, y = 0.03, width = lw, height = lh, just = c("left", "center"), interpolate = TRUE)
  } else {
    .hfp_text("PULSO PUCP", L, 0.03, 8.5, tk$navy, "bold")
  }
  .hfp_text(sprintf("Hoja de zona  ·  %s  ·  Zona %s", distrito, zona), 0.5, 0.03, 8, tk$soft, just = c("center", "center"))
  .hfp_text(format(Sys.Date(), "%d/%m/%Y"), R, 0.03, 8, tk$soft, just = c("right", "center"))
  invisible(TRUE)
}
