# Ficha de trabajo de campo de una UMP: página 1 del PDF por manzana.
#
# La dibuja la entrega (ZIP, una por titular y por reemplazo), las hojas de
# reemplazos puntuales y la vista previa `POST /api/hojas-ruta/ficha-ump`. El
# motor congelado (`hojas_ruta_engine.R`) la llama con un enganche de una línea
# desde `.hojas_ruta_draw_integrated_pdf_page1`.
#
# Dos piezas separadas a propósito:
#   - `hojas_ruta_ficha_modelo()` decide QUÉ dice la hoja (puro, testeable sin
#     device): datos generales, cuota de la hoja —la matriz sexo × edad de
#     siempre, con la cuota sólo en los totales y los cruces en blanco para que
#     el encuestador vaya sumando—, y la selección de casas (esquina, sentido,
#     casa de inicio, salto sobre visitas).
#   Se imprime en blanco y negro: nada se distingue sólo por color (casas
#   visitadas llenas vs. huecas, esquina de inicio rellena, cabecera en contorno).
#   - `.hojas_ruta_ficha_dibujar()` decide CÓMO se ve, con la capa Pulso PDF
#     (`pulso_pdf_theme.R`).
#
# El esquema de la sección C explica SÓLO el recorrido de la manzana sorteada:
# por qué esquina se entra, en qué sentido se da la vuelta y cada cuántas casas
# se visita. El esquema anterior rodeaba la manzana de «Reemplazo 1…8» y en
# campo se leía como el reemplazo real, que es otra manzana sorteada y a menudo
# de otra zona. Las manzanas de alrededor no se dibujan ni se nombran.

# ---------- Modelo ----------

# Las esquinas se numeran en sentido horario desde el noreste
# (`.hojas_ruta_route_operational_values`: noreste = 1 … noroeste = 4).
.hojas_ruta_ficha_esquinas <- c("1" = "noreste", "2" = "sureste", "3" = "suroeste", "4" = "noroeste")

# Sentido del recorrido. El motor sortea «1» o «2» sin rotularlos; como las
# esquinas están numeradas en sentido horario, el recorrido 1 sigue esa
# numeración (1 → 2 → 3 → 4) y el 2 la recorre al revés.
.hojas_ruta_ficha_sentidos <- c("1" = "horario", "2" = "antihorario")

.hojas_ruta_ficha_int <- function(x, default = NA_integer_) {
  v <- suppressWarnings(as.integer(x %||% default))
  if (!length(v) || is.na(v[[1]])) default else v[[1]]
}

.hojas_ruta_ficha_txt <- function(x) {
  v <- as.character(x %||% "")
  if (!length(v) || is.na(v[[1]])) "" else trimws(v[[1]])
}

#' Modelo de la ficha de una UMP: lo que la hoja imprime, sin dibujar nada.
#'
#' @param block Manzana (titular o reemplazo) como lista de escalares.
#' @param quota_table Tabla de cuota del dominio (no se usa para los números:
#'   la cuota de la hoja sale de `cuota_sexo_totals`/`cuota_edad_totals` del
#'   bloque, vía `.hojas_ruta_reference_quota_marginals`).
#' @param config Configuración de la muestra.
#' @return lista con `encabezado`, `datos`, `cuota`, `seleccion` y `no_respuesta`.
#' @keywords internal
hojas_ruta_ficha_modelo <- function(block, quota_table = NULL, config = list()) {
  block <- block %||% list()
  config <- config %||% list()
  start <- .hojas_ruta_ficha_int(block$rango_inicio, 1L)
  end <- .hojas_ruta_ficha_int(block$rango_fin %||% block$entrevistas, start)
  es_reemplazo <- identical(.hojas_ruta_ficha_txt(block$tipo_manzana), "reemplazo")
  codigo <- .hojas_ruta_operational_code(block)
  reemplaza <- ""
  if (es_reemplazo) {
    reemplaza <- .hojas_ruta_ficha_txt(block$replacement_label)
    if (!nzchar(reemplaza) ||
        grepl("^Reemplazo( [0-9]+ de [0-9]+)?( de [0-9]+ a [0-9]+)?$", reemplaza)) {
      reemplaza <- .hojas_ruta_replacement_range_label(
        start, end, block$replacement_order, block$replacement_total, block$titular_id_manzana
      )[[1]]
    }
  }

  ops <- .hojas_ruta_route_operational_values(block, config)
  ops <- .hojas_ruta_vp_ops_sobre_visitas(ops, block)  # U15 / ADR 0116: salto sobre visitas
  esquina <- .hojas_ruta_ficha_txt(ops$esquina_coordenada %||% ops$esquina_inicio)
  sentido <- .hojas_ruta_ficha_txt(ops$sentido_recorrido)
  modo <- .hojas_ruta_ficha_txt(ops$modo_seleccion_vivienda)
  salto <- max(1L, .hojas_ruta_ficha_int(ops$constante_salto, 1L))
  inicio <- max(1L, .hojas_ruta_ficha_int(ops$domicilio_inicio %||% ops$vivienda_inicio, 1L))
  sin_salto <- identical(modo, "Sin constante de salto")
  barrido <- sin_salto || identical(modo, "Barrido completo") || salto <= 1L
  salto_label <- if (sin_salto) {
    "Deshabilitada"
  } else if (barrido) {
    "1 · barrido completo"
  } else {
    sprintf("%d · una de cada %d casas", salto, salto)
  }

  m <- .hojas_ruta_reference_quota_marginals(block, config)
  edades <- vapply(m$defs, function(d) {
    lab <- .hojas_ruta_ficha_txt(d$label)
    lab <- sub("^([0-9]+)-([0-9]+)$", "\\1 a \\2", lab)
    sub("^([0-9]+)\\+$", "\\1 a más", lab)
  }, character(1))

  visitas <- .hojas_ruta_vp_visitas(block)
  year <- format(Sys.Date(), "%Y")
  list(
    encabezado = list(
      titulo = if (es_reemplazo) "Ficha de reemplazo" else "Ficha de trabajo de campo",
      codigo = codigo,
      es_reemplazo = es_reemplazo,
      reemplaza = reemplaza,
      encuestas = sprintf("Encuestas %d a %d", start, end),
      distrito = .hojas_ruta_title_case(block$distrito %||% ""),
      zona = .hojas_ruta_ficha_txt(block$zona),
      manzana = .hojas_ruta_ficha_txt(block$manzana),
      ubigeo = .hojas_ruta_ficha_txt(block$ubigeo),
      territorio = paste(
        .hojas_ruta_title_case(block$departamento %||% ""),
        .hojas_ruta_title_case(block$provincia %||% ""),
        sep = " · "
      ),
      rango = c(start, end)
    ),
    datos = list(
      codigo_estudio = .hojas_ruta_ficha_txt(config$project_code %||% "001"),
      tipo_ruta = if (es_reemplazo) "Reemplazo" else "Titular",
      fechas = sprintf("__/__/%s  al  __/__/%s", year, year),
      nse = "-",
      zona = .hojas_ruta_ficha_txt(block$zona),
      manzana = .hojas_ruta_ficha_txt(block$manzana),
      viviendas = max(0L, .hojas_ruta_ficha_int(block$viviendas, 0L))
    ),
    cuota = list(
      sexo = c(Hombres = as.integer(m$hombre_total), Mujeres = as.integer(m$mujer_total)),
      edad = stats::setNames(as.integer(m$age_totals), edades),
      total = as.integer(m$entrevistas)
    ),
    seleccion = list(
      esquina = esquina,
      esquina_nombre = unname(.hojas_ruta_ficha_esquinas[esquina]) %||% "",
      sentido = sentido,
      sentido_nombre = unname(.hojas_ruta_ficha_sentidos[sentido]) %||% "",
      inicio = inicio,
      salto = if (barrido) 1L else salto,
      salto_label = salto_label,
      barrido = barrido,
      sin_salto = sin_salto
    ),
    no_respuesta = list(
      visitas = visitas,
      entrevistas = .hojas_ruta_ficha_int(block$entrevistas),
      pasos = .hojas_ruta_vp_regla_pasos(.hojas_ruta_vp_regla(block))
    )
  )
}

# ---------- Imágenes ----------

# Un PNG se decodifica una vez por proceso y como nativeRaster: decodificarlo
# por hoja y convertirlo a raster de R era la mitad del tiempo de la ficha.
.hojas_ruta_ficha_png_cache <- new.env(parent = emptyenv())

.hojas_ruta_ficha_png <- function(path) {
  if (is.na(path) || !nzchar(path) || !requireNamespace("png", quietly = TRUE)) return(NULL)
  if (!exists(path, envir = .hojas_ruta_ficha_png_cache, inherits = FALSE)) {
    img <- tryCatch(png::readPNG(path, native = TRUE), error = function(e) NULL)
    assign(path, img, envir = .hojas_ruta_ficha_png_cache)
  }
  get(path, envir = .hojas_ruta_ficha_png_cache, inherits = FALSE)
}

# ---------- Primitivas de dibujo ----------

.hfp_text <- function(label, x, y, size, col, face = "plain", just = c("left", "center"),
                      spacing = 0) {
  grid::grid.text(label, x = x, y = y, just = just,
                  gp = grid::gpar(fontsize = size, fontface = face, col = col,
                                  letter.spacing = spacing))
}

.hfp_rect <- function(x, y, w, h, fill = NA, col = NA, lwd = 0.6, r = 0) {
  if (r > 0) {
    grid::grid.roundrect(x = x, y = y, width = w, height = h, just = c("left", "top"),
                         r = grid::unit(r, "snpc"), gp = grid::gpar(fill = fill, col = col, lwd = lwd))
  } else {
    grid::grid.rect(x = x, y = y, width = w, height = h, just = c("left", "top"),
                    gp = grid::gpar(fill = fill, col = col, lwd = lwd))
  }
}

.hfp_line <- function(x0, x1, y0, y1 = y0, col, lwd) {
  grid::grid.lines(x = c(x0, x1), y = c(y0, y1), gp = grid::gpar(col = col, lwd = lwd))
}

# Título de sección: letra + nombre en navy, con el segmento de acento a la izquierda.
.hfp_seccion <- function(letra, titulo, x, y, w, tk, nota = "") {
  grid::grid.rect(x = x, y = y, width = 0.006, height = 0.018, just = c("left", "center"),
                  gp = grid::gpar(fill = tk$navy, col = NA))
  .hfp_text(sprintf("%s.  %s", letra, titulo), x + 0.016, y, 11, tk$navy, "bold")
  if (nzchar(nota)) .hfp_text(nota, x + w, y, 7.6, tk$soft, just = c("right", "center"))
}

# Celda de formulario: rótulo en versalitas arriba, valor o renglón para llenar.
.hfp_campo <- function(x, y, w, h, rotulo, valor = "", tk, llenar = FALSE, valor_size = 10.5) {
  .hfp_text(toupper(rotulo), x + 0.012, y - 0.011, 6.4, tk$soft, "bold", spacing = 0.6)
  if (nzchar(valor)) {
    .hfp_text(valor, x + 0.012, y - h + 0.014, valor_size, tk$ink, "bold")
  } else if (llenar) {
    .hfp_line(x + 0.012, x + w - 0.012, y - h + 0.009, col = tk$tbl_frame, lwd = 0.5)
  }
}

# ---------- Esquema de recorrido ----------

# Casa del esquema: llena si se visita, hueca si se salta.
.hfp_casa <- function(x, y, visita, tk) {
  grid::grid.circle(x = x, y = y, r = grid::unit(if (visita) 2.8 else 2.3, "pt"),
                    gp = grid::gpar(fill = if (visita) tk$navy else "#ffffff",
                                    col = if (visita) tk$navy else tk$faint, lwd = 0.7))
}

# Posición de la esquina `k` (1..4) en un cuadrado de lado `s` con esquina
# superior izquierda (x0, y0): 1 noreste, 2 sureste, 3 suroeste, 4 noroeste.
.hfp_esquina_xy <- function(k, x0, y0, sx, sy) {
  switch(as.character(k),
         "1" = c(x0 + sx, y0),
         "2" = c(x0 + sx, y0 - sy),
         "3" = c(x0, y0 - sy),
         "4" = c(x0, y0),
         c(x0 + sx, y0))
}

# Puntos a lo largo del perímetro, desde la esquina de inicio y en el sentido
# pedido. `t` en [0, 1) es la fracción del perímetro recorrida.
.hfp_perimetro <- function(t, esquina, horario, x0, y0, sx, sy) {
  orden <- if (horario) c(4, 1, 2, 3) else c(4, 3, 2, 1)
  k0 <- suppressWarnings(as.integer(esquina))
  if (is.na(k0) || !k0 %in% 1:4) k0 <- 1L
  pos0 <- match(k0, orden)
  vert <- lapply(orden[((seq_len(4) + pos0 - 2L) %% 4L) + 1L], .hfp_esquina_xy, x0, y0, sx, sy)
  vert <- c(vert, vert[1])
  lados <- vapply(1:4, function(i) sqrt(sum((vert[[i + 1]] - vert[[i]])^2)), numeric(1))
  acum <- c(0, cumsum(lados)) / sum(lados)
  t(vapply(t, function(tt) {
    i <- max(which(acum[1:4] <= tt))
    f <- (tt - acum[i]) / (acum[i + 1] - acum[i])
    vert[[i]] + f * (vert[[i + 1]] - vert[[i]])
  }, numeric(2)))
}

#' Dibuja el esquema del recorrido de la manzana sorteada: esquina de entrada,
#' sentido de la vuelta y las casas que se visitan según el salto.
#'
#' Ilustrativo: dibuja hasta 20 casas, no la manzana real. Nunca rotula
#' manzanas vecinas.
#' @keywords internal
.hojas_ruta_ficha_esquema_recorrido <- function(sel, x, y, w, h, tk = pulso_pdf_tokens(),
                                                aspecto = 8.27 / 11.69) {
  horario <- !identical(sel$sentido, "2")
  # Cuadrado real en la hoja: en npc el alto se corrige por el aspecto de página.
  lado <- min(w * 0.56, h * 0.6 / aspecto)
  sx <- lado
  sy <- lado * aspecto
  x0 <- x + (w - sx) / 2
  y0 <- y - (h - sy) / 2 + 0.006

  # Calles: una banda tenue alrededor de la manzana.
  pad_x <- 0.03
  pad_y <- pad_x * aspecto
  .hfp_rect(x0 - pad_x, y0 + pad_y, sx + 2 * pad_x, sy + 2 * pad_y,
            fill = tk$canvas, col = NA)
  .hfp_rect(x0, y0, sx, sy, fill = "#ffffff", col = tk$navy, lwd = 1.1)
  .hfp_text("MANZANA", x0 + sx / 2, y0 - sy / 2, 6.6, tk$soft, "bold",
            just = c("center", "center"), spacing = 0.8)

  # Casas: puntos sobre el perímetro (por dentro), desde la esquina de inicio.
  n <- 20L
  inset_x <- 0.012
  inset_y <- inset_x * aspecto
  ts <- (seq_len(n) - 0.5) / n
  pts <- .hfp_perimetro(ts, sel$esquina, horario, x0 + inset_x, y0 - inset_y,
                        sx - 2 * inset_x, sy - 2 * inset_y)
  salto <- max(1L, as.integer(sel$salto %||% 1L))
  inicio <- max(1L, as.integer(sel$inicio %||% 1L))
  visitada <- if (isTRUE(sel$barrido)) rep(TRUE, n) else
    (seq_len(n) >= inicio) & ((seq_len(n) - inicio) %% salto == 0L)
  if (any(!visitada)) .hfp_casa(pts[!visitada, 1], pts[!visitada, 2], FALSE, tk)
  if (any(visitada)) .hfp_casa(pts[visitada, 1], pts[visitada, 2], TRUE, tk)
  # Número de casa en las primeras visitadas (hasta tres) para leer el salto.
  idx <- utils::head(which(visitada), 3L)
  cx <- x0 + sx / 2
  cy <- y0 - sy / 2
  for (i in idx) {
    dx <- pts[i, 1] - cx
    dy <- (pts[i, 2] - cy) / aspecto
    nrm <- sqrt(dx^2 + dy^2)
    if (!is.finite(nrm) || nrm == 0) next
    .hfp_text(as.character(i), pts[i, 1] - dx / nrm * 0.016, pts[i, 2] - dy / nrm * 0.016 * aspecto,
              6.4, tk$navy, "bold", just = c("center", "center"))
  }

  # Sentido: una flecha por lado, por fuera y sobre la calle, empezando en la
  # esquina de inicio; así el sentido se lee en cualquier tramo, no sólo al final.
  out_x <- pad_x * 0.5
  out_y <- out_x * aspecto
  for (t0 in c(0, 0.25, 0.5, 0.75)) {
    tramo <- .hfp_perimetro(seq(t0 + 0.03, t0 + 0.21, length.out = 20), sel$esquina, horario,
                            x0 - out_x, y0 + out_y, sx + 2 * out_x, sy + 2 * out_y)
    grid::grid.lines(x = tramo[, 1], y = tramo[, 2],
                     arrow = grid::arrow(angle = 24, length = grid::unit(6.5, "pt"), type = "closed"),
                     gp = grid::gpar(col = tk$navy, fill = tk$navy, lwd = if (t0 == 0) 2 else 1.3))
  }

  # Esquinas numeradas, fuera de la calle; la de inicio resaltada.
  for (k in 1:4) {
    p <- .hfp_esquina_xy(k, x0, y0, sx, sy)
    ox <- if (p[1] > x0 + sx / 2) 1 else -1
    oy <- if (p[2] > y0 - sy / 2) 1 else -1
    px <- p[1] + ox * (pad_x + 0.014)
    py <- p[2] + oy * (pad_y + 0.014 * aspecto)
    es_inicio <- identical(as.character(k), as.character(sel$esquina))
    grid::grid.circle(x = px, y = py, r = grid::unit(if (es_inicio) 8.5 else 7, "pt"),
                      gp = grid::gpar(fill = if (es_inicio) tk$navy else "#ffffff",
                                      col = if (es_inicio) tk$navy else tk$tbl_frame, lwd = 0.8))
    .hfp_text(as.character(k), px, py, if (es_inicio) 9.5 else 8,
              if (es_inicio) "#ffffff" else tk$soft, "bold", just = c("center", "center"))
    if (es_inicio) {
      # Hacia adentro: hacia afuera se sale del panel.
      .hfp_text("INICIO", px - ox * 0.02, py, 6.6, tk$navy, "bold",
                just = c(if (ox > 0) "right" else "left", "center"), spacing = 0.8)
    }
  }
  # Rosa mínima: norte arriba, en la fila del rótulo del panel.
  nx <- x + w - 0.016
  grid::grid.lines(x = c(nx, nx), y = c(y + 0.002, y + 0.022),
                   arrow = grid::arrow(angle = 25, length = grid::unit(4, "pt"), type = "closed"),
                   gp = grid::gpar(col = tk$soft, fill = tk$soft, lwd = 0.8))
  .hfp_text("N", nx - 0.008, y + 0.01, 7, tk$soft, "bold", just = c("right", "center"))
  invisible(TRUE)
}

# ---------- Página ----------

.hojas_ruta_ficha_dibujar <- function(modelo, out_pdf) {
  tk <- pulso_pdf_tokens()
  pesos <- pulso_pdf_pesos()
  geo <- pulso_pdf_geo("portrait")
  aspecto <- geo$page_w / geo$page_h
  pulso_pdf_abrir(out_pdf, geo)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::grid.rect(gp = grid::gpar(fill = "#ffffff", col = NA))

  enc <- modelo$encabezado
  L <- 0.07
  R <- 0.93
  W <- R - L

  # --- Cabecera: antetítulo, título y la ficha de la ruta a la derecha -------
  .hfp_text(toupper(enc$territorio), L, 0.958, 7.4, tk$soft, "bold", spacing = 1.2)
  .hfp_text(enc$titulo, L, 0.934, 19, tk$navy, "bold")
  .hfp_text(sprintf("%s  ·  Zona %s  ·  Manzana %s", enc$distrito, enc$zona, enc$manzana),
            L, 0.910, 10.5, tk$ink)
  .hfp_text(sprintf("UBIGEO %s", enc$ubigeo), L, 0.893, 8, tk$soft, spacing = 0.6)

  chip_w <- 0.205
  chip_h <- 0.07
  chip_x <- R - chip_w
  # Se imprime en blanco y negro: la ficha de la ruta va en contorno sobre
  # blanco, no en un bloque navy que en B/N es una mancha de tóner.
  .hfp_rect(chip_x, 0.968, chip_w, chip_h, fill = "#ffffff", col = tk$navy, lwd = 1.6, r = 0.08)
  .hfp_text(if (enc$es_reemplazo) "REEMPLAZO" else "RUTA", chip_x + chip_w / 2, 0.953, 6.6,
            tk$soft, "bold", just = c("center", "center"), spacing = 1.2)
  .hfp_text(enc$codigo, chip_x + chip_w / 2, 0.932, 17, tk$navy, "bold",
            just = c("center", "center"))
  .hfp_text(enc$encuestas, chip_x + chip_w / 2, 0.910, 8, tk$ink,
            just = c("center", "center"))

  y <- 0.876
  if (isTRUE(enc$es_reemplazo) && nzchar(enc$reemplaza)) {
    .hfp_rect(L, y, W, 0.026, fill = "#ffffff", col = tk$ink, lwd = 0.8)
    grid::grid.rect(x = L, y = y, width = 0.006, height = 0.026, just = c("left", "top"),
                    gp = grid::gpar(fill = tk$ink, col = NA))
    .hfp_text(sprintf("Reemplaza a la manzana %s", sub("^Reemplazo de ", "", enc$reemplaza)),
              L + 0.016, y - 0.013, 8.4, tk$ink, "bold")
    y <- y - 0.034
  }
  .hfp_line(L, R, y, col = tk$navy, lwd = pesos$bloque)

  # --- A. Datos generales ---------------------------------------------------
  y <- y - 0.024
  .hfp_seccion("A", "Datos generales", L, y, W, tk)
  d <- modelo$datos
  y <- y - 0.016
  fila_h <- 0.037
  cols <- c(0.25, 0.25, 0.25, 0.25) * W
  xs <- L + c(0, cumsum(cols)[-4])
  filas <- list(
    list(c("Código de estudio", d$codigo_estudio), c("Tipo de ruta", d$tipo_ruta),
         c("Código de zona", d$zona), c("Código de manzana", d$manzana)),
    list(c("Total de viviendas", as.character(d$viviendas)), c("Nivel socioeconómico", d$nse),
         c("Fecha de inicio / fin", ""), c("", ""))
  )
  .hfp_rect(L, y, W, fila_h * 2 + fila_h * 2, fill = NA, col = tk$tbl_frame, lwd = pesos$fila)
  for (i in seq_along(filas)) {
    yy <- y - (i - 1) * fila_h
    .hfp_rect(L, yy, W, fila_h, fill = tk$tbl_zebra, col = NA)
    for (j in 1:4) {
      cel <- filas[[i]][[j]]
      if (!nzchar(cel[[1]])) next
      if (identical(cel[[1]], "Fecha de inicio / fin")) {
        .hfp_campo(xs[j], yy, cols[j] * 2, fila_h, cel[[1]], d$fechas, tk, valor_size = 9.5)
      } else {
        .hfp_campo(xs[j], yy, cols[j], fila_h, cel[[1]], cel[[2]], tk)
      }
    }
    .hfp_line(L, R, yy - fila_h, col = tk$tbl_frame, lwd = pesos$fila)
  }
  # Renglones para llenar a mano.
  yy <- y - 2 * fila_h
  manos <- list(c("Nombre del encuestador", 0.5), c("Supervisor de mesa", 0.25),
                c("Supervisor de campo", 0.25))
  xx <- L
  for (m in manos) {
    ww <- as.numeric(m[[2]]) * W
    .hfp_campo(xx, yy, ww, fila_h, m[[1]], "", tk, llenar = TRUE)
    xx <- xx + ww
  }
  .hfp_line(L, R, yy - fila_h, col = tk$tbl_frame, lwd = pesos$fila)
  yy <- yy - fila_h
  .hfp_campo(L, yy, W, fila_h, "Líneas de transporte, rutas y paraderos para llegar a la zona",
             "", tk, llenar = TRUE)
  for (k in seq_along(xs)[-1]) {
    .hfp_line(xs[k], xs[k], y, y - if (k == 4L) fila_h else 2 * fila_h, col = tk$tbl_div, lwd = pesos$fila)
  }
  .hfp_line(L + 0.5 * W, L + 0.5 * W, y - 2 * fila_h, y - 3 * fila_h, col = tk$tbl_div, lwd = pesos$fila)
  .hfp_line(L + 0.75 * W, L + 0.75 * W, y - 2 * fila_h, y - 3 * fila_h, col = tk$tbl_div, lwd = pesos$fila)
  y <- y - 4 * fila_h

  # --- B. Cuota de esta hoja --------------------------------------------------
  y <- y - 0.026
  cu <- modelo$cuota
  .hfp_seccion("B", "Cuota de esta hoja: total por sexo y por edad", L, y, W, tk)
  y <- y - 0.016
  gap <- 0.022
  y <- .hfp_cuota_matriz(L, y, W, cu, tk, pesos)

  # --- C. Selección de casas ------------------------------------------------
  y <- y - 0.026
  sel <- modelo$seleccion
  .hfp_seccion("C", "Selección de casas", L, y, W, tk)
  y <- y - 0.016
  bloque_h <- 0.262
  esq_w <- 0.47 * W
  .hfp_rect(L, y, esq_w, bloque_h, fill = NA, col = tk$tbl_frame, lwd = pesos$fila)
  .hfp_text("ESQUEMA DEL RECORRIDO", L + 0.014, y - 0.014, 6.4, tk$soft, "bold", spacing = 0.8)
  .hojas_ruta_ficha_esquema_recorrido(sel, L, y - 0.026, esq_w, bloque_h - 0.056, tk, aspecto)
  ley_y <- y - bloque_h + 0.016
  # Leyenda centrada bajo el esquema; en barrido no hay casas que se salten.
  items <- if (isTRUE(sel$barrido)) list(list("Visita", TRUE)) else
    list(list("Visita", TRUE), list("Salto", FALSE))
  item_w <- 0.075
  lx <- L + esq_w / 2 - item_w * length(items) / 2
  for (it in items) {
    .hfp_casa(lx + 0.01, ley_y, it[[2]], tk)
    .hfp_text(it[[1]], lx + 0.02, ley_y, 7.6, tk$soft)
    lx <- lx + item_w
  }

  # Parámetros a la derecha del esquema.
  px <- L + esq_w + gap
  pw <- R - px
  param_h <- bloque_h / 4  # la columna cierra a la altura del panel del esquema
  params <- list(
    c("Esquina de inicio", sel$esquina, if (nzchar(sel$esquina_nombre)) sel$esquina_nombre else ""),
    # Por lo que es, no por el código que sortea el motor («1»/«2»).
    c("Sentido", if (nzchar(sel$sentido_nombre)) sprintf("Recorrido %s", sel$sentido_nombre) else sel$sentido, ""),
    c("Casa de inicio", as.character(sel$inicio), ""),
    c("Constante de salto", if (sel$sin_salto) "–" else as.character(sel$salto),
      if (sel$sin_salto) "deshabilitada" else if (sel$barrido) "barrido completo" else
        sprintf("una de cada %d casas", sel$salto))
  )
  for (i in seq_along(params)) {
    yy <- y - (i - 1) * param_h
    p <- params[[i]]
    if (i %% 2 == 1) .hfp_rect(px, yy, pw, param_h, fill = tk$tbl_zebra, col = NA)
    .hfp_text(toupper(p[[1]]), px + 0.012, yy - 0.014, 6.4, tk$soft, "bold", spacing = 0.6)
    .hfp_text(p[[2]], px + 0.012, yy - param_h * 0.58, if (nchar(p[[2]]) > 3) 14 else 16, tk$navy, "bold")
    if (nzchar(p[[3]])) .hfp_text(p[[3]], px + 0.06, yy - param_h * 0.58, 8.6, tk$ink)
    .hfp_line(px, R, yy - param_h, col = tk$tbl_frame, lwd = pesos$fila)
  }
  .hfp_line(px, R, y, col = tk$navy, lwd = pesos$bloque)
  y <- y - bloque_h

  # --- Visitas esperadas y no respuesta (ADR 0116) ------------------------
  nr <- modelo$no_respuesta
  if (!is.na(nr$visitas) || length(nr$pasos)) {
    y <- y - 0.016
    .hfp_dibujar_no_respuesta(nr, L, y, W, tk, pesos)
  }

  # --- Pie Pulso: logo · ruta · fecha --------------------------------------
  .hfp_line(L, R, 0.058, col = tk$line, lwd = 0.7)
  logo <- .hojas_ruta_ficha_png(.pulso_pdf_logo_path())
  if (!is.null(logo)) {
    lw <- 0.11
    lh <- lw * (dim(logo)[1] / dim(logo)[2]) * aspecto
    grid::grid.raster(logo, x = L, y = 0.036, width = lw, height = lh, just = c("left", "center"),
                      interpolate = TRUE)
  } else {
    .hfp_text("PULSO PUCP", L, 0.036, 8.5, tk$navy, "bold")
  }
  .hfp_text(sprintf("%s  ·  %s", enc$codigo, enc$encuestas), 0.5, 0.036, 8, tk$soft,
            just = c("center", "center"))
  .hfp_text(format(Sys.Date(), "%d/%m/%Y"), R, 0.036, 8, tk$soft, just = c("right", "center"))
  invisible(out_pdf)
}

# Matriz de cuota: filas Hombres / Mujeres / Total y una columna por rango de
# edad más la de Total. Es la de siempre y los encuestadores la usan para sumar:
# los cruces sexo × edad van EN BLANCO (no hay cuota por cruce, ADR de cuotas
# por ficha) y la cuota está en los marginales —la columna Total y la fila Total—.
# Devuelve la `y` del borde inferior.
.hfp_cuota_matriz <- function(x, y, w, cu, tk, pesos) {
  edades <- names(cu$edad)
  n_ed <- length(edades)
  lab_w <- 0.13 * w
  tot_w <- 0.11 * w
  cw <- (w - lab_w - tot_w) / max(1L, n_ed)
  head_h <- 0.027
  fila_h <- 0.031
  filas <- list(
    list(lab = "Hombres", celdas = rep("", n_ed), total = cu$sexo[["Hombres"]]),
    list(lab = "Mujeres", celdas = rep("", n_ed), total = cu$sexo[["Mujeres"]]),
    list(lab = "Total", celdas = as.character(cu$edad), total = cu$total)
  )
  alto <- head_h + fila_h * length(filas)
  col_x <- function(j) x + lab_w + (j - 1) * cw
  tot_x <- x + w - tot_w
  # Banda de encabezado y columna/fila de marginales sombreadas.
  .hfp_rect(x, y, w, head_h, fill = tk$tbl_header, col = NA)
  .hfp_rect(tot_x, y - head_h, tot_w, alto - head_h, fill = tk$tbl_zebra, col = NA)
  .hfp_rect(x, y - head_h - 2 * fila_h, w - tot_w, fila_h, fill = tk$tbl_zebra, col = NA)
  # Rango con cuota 0: la columna entera va en gris para que nadie anote ahí.
  # Gris que sobrevive a la impresión en blanco y negro, no un tinte de pantalla.
  for (j in which(as.integer(cu$edad) == 0L)) {
    .hfp_rect(col_x(j), y - head_h, cw, alto - head_h, fill = "#d4d4d4", col = NA)
  }
  .hfp_text("SEXO / EDAD", x + 0.01, y - head_h / 2, 6.4, tk$navy, "bold", spacing = 0.6)
  for (j in seq_len(n_ed)) {
    .hfp_text(edades[[j]], col_x(j) + cw / 2, y - head_h / 2, if (nchar(edades[[j]]) > 8) 7.6 else 8.2,
              tk$navy, "bold", just = c("center", "center"))
  }
  .hfp_text("Total", tot_x + tot_w / 2, y - head_h / 2, 8.2, tk$navy, "bold", just = c("center", "center"))
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    yc <- y - head_h - (i - 0.5) * fila_h
    es_total <- i == length(filas)
    .hfp_text(f$lab, x + 0.01, yc, 9, if (es_total) tk$navy else tk$ink, "bold")
    for (j in seq_len(n_ed)) {
      v <- f$celdas[[j]]
      if (nzchar(v)) {
        .hfp_text(v, col_x(j) + cw / 2, yc, 13, tk$ink, "bold",
                  just = c("center", "center"))
      }
    }
    .hfp_text(as.character(f$total), tot_x + tot_w / 2, yc, 14, tk$navy, "bold",
              just = c("center", "center"))
    if (i < length(filas)) {
      .hfp_line(x, x + w, y - head_h - i * fila_h, col = if (i == 2L) tk$tbl_frame else tk$rule,
                lwd = if (i == 2L) pesos$columna else pesos$fila)
    }
  }
  # Divisores de columna y marco.
  for (j in seq_len(n_ed)) .hfp_line(col_x(j), col_x(j), y, y - alto, col = tk$tbl_div, lwd = pesos$fila)
  .hfp_line(tot_x, tot_x, y, y - alto, col = tk$tbl_frame, lwd = pesos$columna)
  .hfp_line(x, x + w, y - head_h, col = tk$tbl_frame, lwd = pesos$columna)
  .hfp_rect(x, y, w, alto, fill = NA, col = tk$tbl_frame, lwd = pesos$fila)
  y - alto
}

.hfp_dibujar_no_respuesta <- function(nr, x, y, w, tk, pesos) {
  gap <- 0.022
  tiene_v <- !is.na(nr$visitas)
  vis_w <- if (tiene_v) 0.30 * w else 0
  reg_x <- x + if (tiene_v) vis_w + gap else 0
  reg_w <- x + w - reg_x
  body <- 7.8
  line_h <- 0.0128
  lineas <- lapply(nr$pasos, function(p) .form_pdf_wrap_fit(p, reg_w - 0.05, fontsize = body))
  nota <- if (!is.na(nr$entrevistas)) {
    sprintf("Viviendas que se espera tocar para lograr %d entrevistas completas. El salto ya las considera.",
            nr$entrevistas)
  } else {
    "Viviendas que se espera tocar para completar la ruta. El salto ya las considera."
  }
  nota_l <- if (tiene_v) .form_pdf_wrap_fit(nota, vis_w - 0.03, fontsize = 7.8) else character(0)
  h_reg <- 0.03 + sum(lengths(lineas)) * line_h + max(0L, length(lineas) - 1L) * 0.005 + 0.008
  h_vis <- 0.03 + length(nota_l) * line_h + 0.008
  h <- max(h_reg, h_vis)
  if (tiene_v) {
    .hfp_rect(x, y, vis_w, h, fill = tk$canvas, col = NA)
    grid::grid.rect(x = x, y = y, width = 0.005, height = h, just = c("left", "top"),
                    gp = grid::gpar(fill = tk$navy, col = NA))
    .hfp_text(sprintf("Visitas esperadas: %d", nr$visitas), x + 0.018, y - 0.015, 9.5, tk$navy, "bold")
    yy <- y - 0.034
    for (l in nota_l) {
      .hfp_text(l, x + 0.018, yy, 7.8, tk$ink)
      yy <- yy - line_h
    }
  }
  if (length(lineas)) {
    .hfp_rect(reg_x, y, reg_w, h, fill = NA, col = tk$tbl_frame, lwd = pesos$fila)
    grid::grid.rect(x = reg_x, y = y, width = 0.005, height = h, just = c("left", "top"),
                    gp = grid::gpar(fill = tk$navy, col = NA))
    .hfp_text("Ante la no respuesta", reg_x + 0.018, y - 0.015, 9.5, tk$navy, "bold")
    yy <- y - 0.034
    for (i in seq_along(lineas)) {
      .hfp_text(sprintf("%d.", i), reg_x + 0.018, yy, body, tk$navy, "bold")
      for (l in lineas[[i]]) {
        .hfp_text(l, reg_x + 0.036, yy, body, tk$ink)
        yy <- yy - line_h
      }
      yy <- yy - 0.005
    }
  }
  invisible(h)
}

#' Página 1 de la ficha de una UMP (enganche desde el motor congelado).
#' @keywords internal
hojas_ruta_ficha_pdf_pagina <- function(block, quota_table, meta, config, out_pdf) {
  modelo <- hojas_ruta_ficha_modelo(block, quota_table, config)
  .hojas_ruta_ficha_dibujar(modelo, out_pdf)
}
