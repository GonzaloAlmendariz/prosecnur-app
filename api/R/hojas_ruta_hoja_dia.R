# Hoja del día de Hojas de ruta (U15, ADR 0116 §1).
#
# Una jornada del plan de campo (`hojas_ruta_plan_campo`, U14) impresa para el
# encuestador: el distrito, las rutas en orden de visita (código UMP, zona,
# manzana, viviendas, salto, visitas esperadas, esquina y casa de inicio,
# reemplazo) y la regla ante la no respuesta. Es la portada de la jornada: cada
# visita se anota en la hoja de ruteo de su UMP, con los códigos de resultado del
# estudio (Material de campo, `collection_territorial_papel.R`; decisión D2(a) del
# 31 oct, que retiró la grilla con disposiciones propias que campo no usaba).
#
# Dos capas, como todo PDF de la casa: un modelo puro (`hojas_ruta_hoja_dia_modelo`)
# que se prueba sin dibujar, y un render con el kit Pulso PDF
# (`pulso_pdf_theme.R`). Audiencia interna (equipo de campo); grano: la jornada.


.hojas_ruta_hd_int <- function(x) {
  v <- suppressWarnings(as.integer(if (is.null(x) || !length(x)) NA else x[[1]]))
  if (!length(v)) NA_integer_ else v
}

.hojas_ruta_hd_txt <- function(x, default = "") {
  if (is.null(x) || !length(x) || is.na(x[[1]])) return(default)
  v <- trimws(as.character(x[[1]]))
  if (nzchar(v)) v else default
}

.hojas_ruta_hd_coord <- function(propia, respaldo) {
  v <- suppressWarnings(as.numeric(if (is.null(propia) || !length(propia)) NA else propia[[1]]))
  if (length(v) && is.finite(v)) return(v)
  r <- suppressWarnings(as.numeric(if (is.null(respaldo) || !length(respaldo)) NA else respaldo[[1]]))
  if (length(r) && is.finite(r)) r else NA_real_
}

.hojas_ruta_hd_puntos <- function(puntos, ubigeo) {
  vacio <- data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0))
  p <- if (is.data.frame(puntos)) puntos else tryCatch(hojas_ruta_marco_elegible_puntos(ubigeo), error = function(e) vacio)
  if (!is.data.frame(p) || !all(c("id_manzana", "lon", "lat") %in% names(p))) return(vacio)
  p
}

#' Modelo de la hoja del día de una jornada.
#'
#' @param sample Muestra guardada (`workspace_outputs$sample`).
#' @param jornada_id Id de la jornada del plan ("J03").
#' @param supuestos Supuestos del plan (`ui_state$plan_campo`).
#' @param puntos Puntos interiores de las manzanas, como en `hojas_ruta_plan_campo`;
#'   NULL los lee de la cartografía local (igual que `/plan-campo`).
#' @param plan Plan ya calculado (opcional; si no, se calcula).
#' @return Lista con la jornada, sus rutas y la regla, o NULL si la jornada no existe.
#' @keywords internal
hojas_ruta_hoja_dia_modelo <- function(sample, jornada_id, supuestos = list(), puntos = NULL, plan = NULL) {
  plan <- plan %||% hojas_ruta_plan_campo(sample$blocks %||% list(), supuestos, puntos = puntos)
  jid <- toupper(trimws(as.character(jornada_id %||% "")[1]))
  j <- Find(function(x) identical(toupper(as.character(x$id)), jid), plan$jornadas %||% list())
  if (is.null(j)) return(NULL)
  cfg <- sample$config %||% list()
  titulares <- .hojas_ruta_rows_df(sample$blocks %||% list())
  reemplazos <- .hojas_ruta_rows_df(sample$replacement_blocks %||% list())
  ids_jornada <- as.character(unlist(j$rutas))
  ss <- if (is.list(cfg$sample_size)) cfg$sample_size else list()
  r_resp <- suppressWarnings(as.numeric(ss$response_rate %||% 0.9)[1]); if (is.na(r_resp) || r_resp <= 0) r_resp <- 0.9
  e_ocup <- suppressWarnings(as.numeric(ss$ocupacion %||% 1)[1]); if (is.na(e_ocup) || e_ocup <= 0) e_ocup <- 1
  # Puntos interiores de las manzanas del distrito (los mismos que ordenan el plan):
  # ubican las rutas en el mapa cuando la muestra no trae lat/lon, y dan el contexto.
  pts <- .hojas_ruta_hd_puntos(puntos, j$ubigeo)
  reglas <- character(0)
  rutas <- lapply(seq_along(ids_jornada), function(i) {
    id <- ids_jornada[[i]]
    fila <- which(as.character(titulares$id_manzana) == id)
    block <- if (length(fila)) {
      b <- as.list(titulares[fila[[1]], , drop = FALSE]); b[] <- lapply(b, function(x) x[[1]]); b
    } else {
      list(id_manzana = id)
    }
    ops <- .hojas_ruta_vp_ops_sobre_visitas(.hojas_ruta_route_operational_values(block, cfg), block)
    visitas <- .hojas_ruta_vp_visitas(block)
    k <- max(1L, .hojas_ruta_hd_int(block$entrevistas %||% cfg$entrevistas_por_manzana %||% 1L), na.rm = TRUE)
    regla <- .hojas_ruta_vp_regla(block)
    if (nzchar(regla)) reglas <<- c(reglas, regla)
    repl <- if (nrow(reemplazos) && "titular_id_manzana" %in% names(reemplazos)) {
      reemplazos[as.character(reemplazos$titular_id_manzana) == id, , drop = FALSE]
    } else reemplazos[0, , drop = FALSE]
    repl_codigos <- if (nrow(repl)) {
      vapply(seq_len(nrow(repl)), function(r) {
        rb <- as.list(repl[r, , drop = FALSE]); rb[] <- lapply(rb, function(x) x[[1]])
        rb$tipo_manzana <- "reemplazo"
        sprintf("%s (Z %s Mz %s)", .hojas_ruta_operational_code(rb, "reemplazo"),
                .hojas_ruta_hd_txt(rb$zona, "-"), .hojas_ruta_hd_txt(rb$manzana, "-"))
      }, character(1))
    } else character(0)
    cap_v <- as.integer(hojas_ruta_visitas_cap(k, r_resp, e_ocup))
    list(
      orden = i,
      id_manzana = id,
      codigo = .hojas_ruta_operational_code(block, "titular"),
      zona = .hojas_ruta_hd_txt(block$zona, "-"),
      manzana = .hojas_ruta_hd_txt(block$manzana, "-"),
      viviendas = .hojas_ruta_hd_int(block$viviendas),
      entrevistas = as.integer(k),
      visitas_esperadas = visitas,
      salto = as.integer(ops$constante_salto),
      modo = as.character(ops$modo_seleccion_vivienda),
      esquina = as.character(ops$esquina_inicio),
      recorrido = as.character(ops$sentido_recorrido),
      casa_inicio = as.integer(ops$vivienda_inicio),
      rango_inicio = .hojas_ruta_hd_int(block$rango_inicio),
      rango_fin = .hojas_ruta_hd_int(block$rango_fin),
      reemplazos = as.list(repl_codigos),
      # La ruta va entera aunque no quepa en la jornada: sigue al día siguiente.
      excede_jornada = isTRUE(j$excede_jornada),
      jornadas_equivalentes = as.integer(j$jornadas_equivalentes %||% 1L),
      # Visitas con margen del ADR 0116 (percentil 90 de la binomial negativa).
      visitas_cap = cap_v,
      lat = .hojas_ruta_hd_coord(block$lat, pts$lat[match(id, as.character(pts$id_manzana))]),
      lon = .hojas_ruta_hd_coord(block$lon, pts$lon[match(id, as.character(pts$id_manzana))])
    )
  })
  # Contexto del mapa: las manzanas del distrito, con las demás titulares marcadas.
  ids_titulares <- as.character(titulares$id_manzana %||% character(0))
  contexto <- data.frame(
    lat = suppressWarnings(as.numeric(pts$lat)),
    lon = suppressWarnings(as.numeric(pts$lon)),
    titular = as.character(pts$id_manzana) %in% setdiff(ids_titulares, ids_jornada)
  )
  list(
    ok = TRUE,
    jornada = as.character(j$id),
    ubigeo = as.character(j$ubigeo),
    distrito = .hojas_ruta_hd_txt(j$distrito, as.character(j$ubigeo)),
    visitas = .hojas_ruta_hd_int(j$visitas),
    km = suppressWarnings(as.numeric(j$km %||% 0)),
    entrevistas = sum(vapply(rutas, `[[`, integer(1), "entrevistas")),
    total_jornadas = length(plan$jornadas),
    visitas_declaradas = all(!is.na(vapply(rutas, `[[`, integer(1), "visitas_esperadas"))),
    # F38: con el salto apagado, el texto canónico (también el que trae una muestra vieja) va sin salto.
    regla = {
      rg <- if (length(reglas)) reglas[[1]] else HOJAS_RUTA_REGLA_NO_RESPUESTA
      if (identical(rg, HOJAS_RUTA_REGLA_NO_RESPUESTA)) hojas_ruta_regla_no_respuesta(identical(as.character(cfg$route_jump_mode %||% ""), "off")) else rg
    },
    rutas = rutas,
    contexto = contexto,
    proyecto = .hojas_ruta_hd_txt(cfg$project_code, "")
  )
}

# ---------- Render ----------

.hojas_ruta_hd_meses <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                          "agosto", "septiembre", "octubre", "noviembre", "diciembre")

.hojas_ruta_hd_txt_at <- function(label, x, y, size, col, face = "plain", just = c("left", "center")) {
  grid::grid.text(label, x = grid::unit(x, "npc"), y = grid::unit(y, "npc"), just = just,
                  gp = grid::gpar(fontsize = size, fontface = face, col = col))
}

# Mapa pequeño de la jornada: las rutas en orden de visita sobre las demás
# titulares del distrito, con el mismo aspecto en x e y.
.hojas_ruta_hd_mapa <- function(m, x0, y0, w, h, tk, geo) {
  lat <- vapply(m$rutas, function(r) r$lat, numeric(1))
  lon <- vapply(m$rutas, function(r) r$lon, numeric(1))
  ok <- is.finite(lat) & is.finite(lon)
  grid::grid.rect(x = x0, y = y0, width = w, height = h, just = c("left", "bottom"),
                  gp = grid::gpar(col = tk$tbl_frame, fill = tk$canvas, lwd = 0.6))
  .hojas_ruta_hd_txt_at("RECORRIDO DE LA JORNADA", x0 + 0.010, y0 + h - 0.012, 5.8, tk$soft, "bold")
  if (!any(ok)) {
    .hojas_ruta_hd_txt_at("Sin coordenadas para dibujar el recorrido.", x0 + w / 2, y0 + h / 2, 7, tk$faint,
                          just = c("center", "center"))
    return(invisible(FALSE))
  }
  lat0 <- mean(lat[ok]); kx <- cos(lat0 * pi / 180)
  px <- lon * kx; py <- lat
  cx <- mean(range(px[ok])); cy <- mean(range(py[ok]))
  # Extensión mínima ~300 m para que una sola ruta no quede como un punto en el vacío.
  ext_x <- max(diff(range(px[ok])), 0.003); ext_y <- max(diff(range(py[ok])), 0.003)
  pad <- 0.022
  iw <- (w - 2 * pad) * geo$page_w; ih <- (h - 2 * pad - 0.014) * geo$page_h
  esc <- min(iw / (ext_x * 1.25), ih / (ext_y * 1.25))
  a_npc <- function(xx, yy) list(
    x = x0 + w / 2 + (xx - cx) * esc / geo$page_w,
    y = y0 + (h - 0.014) / 2 + (yy - cy) * esc / geo$page_h
  )
  dentro <- function(p) p$x > x0 + 0.004 & p$x < x0 + w - 0.004 & p$y > y0 + 0.020 & p$y < y0 + h - 0.020
  ctx <- m$contexto
  if (nrow(ctx)) {
    pc <- a_npc(ctx$lon * kx, ctx$lat)
    sel <- is.finite(pc$x) & is.finite(pc$y) & dentro(pc)
    tit <- if ("titular" %in% names(ctx)) ctx$titular %in% TRUE else rep(FALSE, nrow(ctx))
    if (any(sel & !tit)) {
      grid::grid.points(x = grid::unit(pc$x[sel & !tit], "npc"), y = grid::unit(pc$y[sel & !tit], "npc"),
                        pch = 16, size = grid::unit(0.9, "mm"), gp = grid::gpar(col = tk$rule))
    }
    if (any(sel & tit)) {
      grid::grid.points(x = grid::unit(pc$x[sel & tit], "npc"), y = grid::unit(pc$y[sel & tit], "npc"),
                        pch = 21, size = grid::unit(2.2, "mm"), gp = grid::gpar(col = tk$faint, fill = "white", lwd = 0.6))
    }
  }
  p <- a_npc(px[ok], py[ok])
  p <- .hojas_ruta_hd_separar(p, geo, diametro_mm = 4.4)
  if (sum(ok) > 1L) {
    grid::grid.lines(x = grid::unit(p$x, "npc"), y = grid::unit(p$y, "npc"),
                     gp = grid::gpar(col = tk$navy, lwd = 1, lty = "22"))
  }
  num <- vapply(m$rutas, function(r) r$orden, integer(1))[ok]
  grid::grid.points(x = grid::unit(p$x, "npc"), y = grid::unit(p$y, "npc"),
                    pch = 21, size = grid::unit(4.2, "mm"), gp = grid::gpar(col = "white", fill = tk$navy, lwd = 0.8))
  grid::grid.text(as.character(num), x = grid::unit(p$x, "npc"), y = grid::unit(p$y, "npc"),
                  gp = grid::gpar(fontsize = 6.6, fontface = "bold", col = "white"))
  .hojas_ruta_hd_txt_at("Número = orden de visita · círculo = otra titular",
                        x0 + 0.010, y0 + 0.009, 5.8, tk$soft)
  invisible(TRUE)
}

# Dos rutas vecinas dejaban sus marcadores uno sobre otro y el número no se leía:
# cada marcador que pisa a uno anterior se corre hacia afuera del centro del grupo
# lo justo para no tocarlo. La línea del recorrido sigue a los marcadores.
.hojas_ruta_hd_separar <- function(p, geo, diametro_mm = 4.4) {
  n <- length(p$x)
  if (n < 2L) return(p)
  mm_x <- geo$page_w * 25.4; mm_y <- geo$page_h * 25.4
  x <- p$x * mm_x; y <- p$y * mm_y
  cx <- mean(x); cy <- mean(y)
  for (pasada in 1:6) {
    movido <- FALSE
    for (i in 2:n) for (k in seq_len(i - 1L)) {
      d <- sqrt((x[i] - x[k])^2 + (y[i] - y[k])^2)
      if (d >= diametro_mm) next
      ang <- if (d > 1e-6) atan2(y[i] - y[k], x[i] - x[k]) else atan2(y[i] - cy, x[i] - cx) + i
      x[i] <- x[k] + cos(ang) * diametro_mm
      y[i] <- y[k] + sin(ang) * diametro_mm
      movido <- TRUE
    }
    if (!movido) break
  }
  list(x = x / mm_x, y = y / mm_y)
}

#' Dibuja la hoja del día en un PDF A4 vertical.
#' @param m Salida de `hojas_ruta_hoja_dia_modelo()`.
#' @param out_pdf Ruta del PDF.
#' @return Ruta del PDF, invisible; atributo `paginas`.
#' @keywords internal
hojas_ruta_hoja_dia_pdf <- function(m, out_pdf, fecha = Sys.Date()) {
  tk <- pulso_pdf_tokens(); ty <- pulso_pdf_type(); geo <- pulso_pdf_geo("portrait")
  margen <- geo$margin; derecha <- 1 - margen; ancho <- derecha - margen
  periodo <- sprintf("%s %s", .hojas_ruta_hd_meses[as.integer(format(fecha, "%m"))], format(fecha, "%Y"))
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  n_rutas <- length(m$rutas)
  titulo <- sprintf("Hoja del día · Jornada %s", m$jornada)
  subtitulo <- sprintf("%s (%s) · %d %s · %d entrevistas · %s visitas esperadas · %s km de recorrido",
                       .hojas_ruta_title_case(m$distrito), m$ubigeo, n_rutas, if (n_rutas == 1L) "ruta" else "rutas",
                       m$entrevistas, if (is.na(m$visitas)) "-" else as.character(m$visitas),
                       formatC(m$km, format = "f", digits = 1))

  # Una sola página: sin la grilla, la jornada cabe entera (las rutas que no, se cuentan).
  pagina <- 1L
  grid::grid.newpage()
  pulso_pdf_header(titulo, subtitulo, tokens = tk, ty = ty, geo = geo, y_subtitulo = 0.944, y_regla = 0.922)

  # --- Banda superior: datos del encuestador (izq) y mapa (der) ---
  band_top <- 0.902; band_h <- 0.150
  map_w <- 0.34; map_x <- derecha - map_w
  .hojas_ruta_hd_mapa(m, map_x, band_top - band_h, map_w, band_h, tk, geo)
  izq_w <- map_x - margen - 0.025
  kpis <- list(
    list("RUTAS", as.character(n_rutas)),
    list("ENTREVISTAS", as.character(m$entrevistas)),
    list("VISITAS ESPERADAS", if (is.na(m$visitas)) "-" else as.character(m$visitas)),
    list("JORNADA", sprintf("%s de %d", sub("^J0*", "", m$jornada), m$total_jornadas))
  )
  kw <- izq_w / length(kpis)
  for (i in seq_along(kpis)) {
    xk <- margen + (i - 1) * kw
    .hojas_ruta_hd_txt_at(kpis[[i]][[1]], xk, band_top - 0.010, ty$eyebrow, tk$soft, "bold")
    .hojas_ruta_hd_txt_at(kpis[[i]][[2]], xk, band_top - 0.034, 17, tk$navy, "bold")
  }
  pulso_pdf_hairline(margen, margen + izq_w, band_top - 0.054, tk)
  campos <- list(c("Encuestador", "Fecha"), c("Supervisor", "Hora de inicio / fin"))
  for (f in seq_along(campos)) {
    yf <- band_top - 0.054 - f * 0.040
    for (c2 in 1:2) {
      xf <- margen + (c2 - 1) * (izq_w / 2 + 0.01)
      wf <- izq_w / 2 - 0.01
      .hojas_ruta_hd_txt_at(toupper(campos[[f]][[c2]]), xf, yf + 0.016, ty$eyebrow, tk$soft, "bold")
      grid::grid.lines(x = c(xf, xf + wf), y = rep(yf, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = 0.6))
    }
  }

  # --- Rutas en orden de visita ---
  y <- band_top - band_h - 0.030
  .hojas_ruta_hd_txt_at("Rutas en orden de visita", margen, y, 10.5, tk$navy, "bold")
  y <- y - 0.016
  cols <- c("#", "UMP", "Zona · Mz", "Viv.", "Entrev.", "Visitas esp.", "Salto", "Inicio", "Encuestas", "Reemplazo")
  anchos <- c(0.030, 0.085, 0.110, 0.045, 0.060, 0.080, 0.075, 0.110, 0.075, 0)
  anchos[length(anchos)] <- ancho - sum(anchos)
  xs <- margen + c(0, cumsum(anchos))
  # La tabla se aprieta si la jornada trae muchas rutas, hasta un mínimo legible.
  fila_h <- max(0.014, min(0.022, (y - 0.30) / (n_rutas + 1L)))
  grid::grid.rect(x = margen, y = y, width = ancho, height = fila_h, just = c("left", "top"),
                  gp = grid::gpar(col = NA, fill = tk$tbl_header))
  for (cidx in seq_along(cols)) {
    .hojas_ruta_hd_txt_at(cols[[cidx]], xs[[cidx]] + 0.005, y - fila_h / 2, 6.8, tk$ink, "bold")
  }
  grid::grid.lines(x = c(margen, derecha), y = rep(y, 2), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$bloque))
  grid::grid.lines(x = c(margen, derecha), y = rep(y - fila_h, 2), gp = grid::gpar(col = tk$tbl_frame, lwd = pulso_pdf_pesos()$columna))
  y <- y - fila_h
  omitidas <- 0L
  for (r in m$rutas) {
    # Una jornada de más de ~28 rutas no cabe: se dice cuántas faltan, no se callan.
    if (y - fila_h < 0.20) { omitidas <- omitidas + 1L; next }
    if (r$orden %% 2L == 0L) {
      grid::grid.rect(x = margen, y = y, width = ancho, height = fila_h, just = c("left", "top"),
                      gp = grid::gpar(col = NA, fill = tk$tbl_zebra))
    }
    salto <- if (identical(r$modo, "Sin constante de salto")) "No" else if (r$salto <= 1L) "1 (barrido)" else as.character(r$salto)
    reemplazo <- if (length(r$reemplazos)) paste(unlist(r$reemplazos), collapse = "; ") else "-"
    max_chars <- max(8L, floor(anchos[[length(anchos)]] * 165))
    if (nchar(reemplazo) > max_chars) reemplazo <- paste0(substr(reemplazo, 1L, max_chars - 3L), "...")
    celdas <- c(
      as.character(r$orden), r$codigo, sprintf("%s · %s", r$zona, r$manzana),
      if (is.na(r$viviendas)) "-" else as.character(r$viviendas),
      as.character(r$entrevistas),
      if (is.na(r$visitas_esperadas)) "-" else as.character(r$visitas_esperadas),
      salto,
      sprintf("Esq. %s · casa %s", r$esquina, r$casa_inicio),
      if (is.na(r$rango_inicio)) "-" else sprintf("%d a %d", r$rango_inicio, r$rango_fin),
      reemplazo
    )
    for (cidx in seq_along(celdas)) {
      face <- if (cidx %in% c(2L, 6L)) "bold" else "plain"
      .hojas_ruta_hd_txt_at(celdas[[cidx]], xs[[cidx]] + 0.005, y - fila_h / 2, 7.4, tk$ink, face)
    }
    grid::grid.lines(x = c(margen, derecha), y = rep(y - fila_h, 2), gp = grid::gpar(col = tk$rule, lwd = pulso_pdf_pesos()$fila))
    y <- y - fila_h
  }
  grid::grid.lines(x = c(margen, derecha), y = rep(y, 2), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$bloque))
  nota <- if (omitidas > 0L) {
    sprintf("Faltan %d rutas en esta tabla: la jornada es demasiado larga para una hoja. Baje las visitas por jornada.", omitidas)
  } else if (isTRUE(m$visitas_declaradas)) {
    "Salto sobre visitas: cada ruta toca las viviendas esperadas para lograr sus completas (ADR 0116)."
  } else {
    "Esta muestra se sorteó sin visitas esperadas: el salto supone respuesta total. Vuelva a sortear para calcularlo sobre visitas."
  }
  .hojas_ruta_hd_txt_at(nota, margen, y - 0.011, 6.6, if (omitidas > 0L) tk$danger else tk$soft)
  # Una ruta más larga que la jornada sigue al día siguiente con la misma persona.
  largas <- Filter(function(r) isTRUE(r$excede_jornada), m$rutas)
  if (length(largas)) {
    y <- y - 0.012
    .hojas_ruta_hd_txt_at(paste(vapply(largas, function(r) sprintf("La ruta %d (%s) toma %d jornadas, mismo encuestador.",
                                                                    r$orden, r$codigo, r$jornadas_equivalentes), ""), collapse = " "),
                          margen, y - 0.011, 6.6, tk$ink)
  }

  # --- Regla ante la no respuesta ---
  y <- y - 0.030
  pasos <- .hojas_ruta_vp_regla_pasos(m$regla)
  # Cada paso parte en líneas al ancho de la hoja: el tercero se salía por el borde.
  lineas <- lapply(seq_along(pasos), function(i) strwrap(sprintf("%d.  %s", i, pasos[[i]]), width = floor((ancho - 0.03) * 165), exdent = 4L))
  regla_h <- 0.022 + length(unlist(lineas)) * 0.0135 + 0.006
  grid::grid.rect(x = margen, y = y, width = ancho, height = regla_h, just = c("left", "top"),
                  gp = grid::gpar(col = NA, fill = tk$canvas))
  grid::grid.lines(x = rep(margen, 2), y = c(y, y - regla_h), gp = grid::gpar(col = tk$navy, lwd = pulso_pdf_pesos()$acento))
  .hojas_ruta_hd_txt_at("Ante la no respuesta", margen + 0.014, y - 0.012, 9, tk$navy, "bold")
  for (i in seq_along(unlist(lineas))) {
    .hojas_ruta_hd_txt_at(unlist(lineas)[[i]], margen + 0.014, y - 0.022 - (i - 0.5) * 0.0135, 7.8, tk$ink)
  }
  y <- y - regla_h - 0.026

  # --- Dónde se anotan las visitas: la hoja de ruteo de cada UMP (D2(a)) ---
  .hojas_ruta_hd_txt_at("Registro de visitas", margen, y, 10.5, tk$navy, "bold")
  .hojas_ruta_hd_txt_at(
    "Cada visita se anota en la hoja de ruteo de su UMP, con los códigos de resultado del estudio. Las efectivas van a la hoja de consolidados.",
    margen, y - 0.014, 7.4, tk$ink)
  pulso_pdf_footer(pagina, periodo, tokens = tk, ty = ty, geo = geo, pagina = FALSE)
  attr(out_pdf, "paginas") <- pagina
  invisible(out_pdf)
}

# Detalle del nombre de la hoja del día (ADR 0133 §3): «J03 Breña».
.hojas_ruta_hd_detalle <- function(m) {
  partes <- trimws(c(as.character(m$jornada %||% "")[1], as.character(m$distrito %||% "")[1]))
  paste(partes[!is.na(partes) & nzchar(partes)], collapse = " ")
}
