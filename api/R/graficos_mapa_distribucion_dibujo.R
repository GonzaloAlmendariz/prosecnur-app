# =============================================================================
# graficos_mapa_distribucion_dibujo.R — el panel del mapa de distribución, dibujado en pulgadas
# =============================================================================
#
# El panel es un ggplot cuyo sistema de coordenadas son las pulgadas del recuadro donde va (lámina o Word): así los
# rótulos, sus guías y la escala gráfica se espacian en medidas físicas, como en la maqueta aprobada (1 px del lienzo =
# 1/96 in). La geometría se proyecta (longitud por el coseno de la latitud media), se escala al recuadro y se RECORTA con
# `sf` al borde: el dispositivo vectorial del PPT (rvg) se cae con polígonos fuera del recorte.
#
# Capas, de abajo arriba (maqueta, tableros 2–4): mar; tierra de contexto; contorno gris de 2,4 pt (asoma sólo por fuera
# porque las áreas se pintan encima); áreas con borde gris oscuro de 0,5 pt (la maqueta usaba blanco; Gonzalo pidió que
# se distingan los distritos); Lima Metropolitana y el Callao (Perú) con trazo
# de su propio color; rótulos; «Océano Pacífico»; escala gráfica; en el Perú, el recuadro de la zona de Lima.

.MAPA_DIST_PX <- 1 / 96   # 1 px del lienzo de la maqueta, en pulgadas

#' Cuerpos de letra del mapa (pt) para la lámina o el Word (Word: rótulos 10,5 pt, leyenda y escala 9 pt; nunca < 8 pt)
#' @keywords internal
.mapa_dist_pt <- function(destino = c("lamina", "word")) {
  destino <- match.arg(destino)
  if (identical(destino, "word")) list(rotulo = 10.5, leyenda = 9, escala = 9, oceano = 9.75, zona = 9)
  else list(rotulo = 9, leyenda = 8.25, escala = 8.25, oceano = 9.75, zona = 8.25)
}

#' ¿Es oscuro el relleno? Luminancia relativa (WCAG) bajo 0.3: el borde gris oscuro no se ve sobre él
#' @keywords internal
.mapa_dist_oscuro <- function(col) {
  ok <- !is.na(col) & nzchar(col)
  out <- rep(FALSE, length(col))
  if (!any(ok)) return(out)
  rgb <- grDevices::col2rgb(col[ok]) / 255
  lin <- ifelse(rgb <= 0.03928, rgb / 12.92, ((rgb + 0.055) / 1.055)^2.4)
  out[ok] <- (0.2126 * lin[1, ] + 0.7152 * lin[2, ] + 0.0722 * lin[3, ]) < 0.3
  out
}

#' Grosor en puntos a `linewidth` de ggplot (mm): 1 mm de linewidth son ~2,13 pt
#' @keywords internal
.mapa_dist_lw <- function(pt) pt / (ggplot2::.pt * 0.75)

#' La proyección del panel: de lon/lat a pulgadas del recuadro
#'
#' Encuadre «datos» en Lima: los centros de las áreas con encuestados y los puntos, con aire, a la DERECHA del recuadro; a
#' la izquierda queda una franja de mar de `col` pulgadas para la columna de rótulos. En el Perú, todo el país a la
#' derecha (a la izquierda va el recuadro de la zona de Lima).
#' @return `list(k, s, tx, ty, lon0, lat0)`: x = ((lon − lon0)·k)·s + tx, y = lat·s + ty.
#' @keywords internal
.mapa_dist_proyeccion <- function(espec, ancho, alto, col) {
  m <- .mapa_dist_margen(espec)
  v <- .mapa_dist_ventana(espec); lon <- v$lon; lat <- v$lat
  lat0 <- mean(lat); k <- cos(lat0 * pi / 180); lon0 <- lon[[1]]
  dx <- (lon[[2]] - lon[[1]]) * k; dy <- lat[[2]] - lat[[1]]
  util_w <- ancho - col - m; util_h <- alto - 2 * m
  s <- min(util_w / dx, util_h / dy)
  # Sin recuadro de la zona de Lima ni rótulos que pidan columna, el Perú se centra; si no, va a la derecha.
  # Sin columna de rótulos (especificación aprobada: el rótulo de la PUCP va dentro del mapa) el mapa se centra.
  tx <- if (col <= 0) (ancho - dx * s) / 2 else ancho - m - dx * s
  ty <- (alto - dy * s) / 2 - lat[[1]] * s
  list(k = k, s = s, tx = tx, ty = ty, lon0 = lon0, lat0 = lat0)
}

#' La ventana del mapa en lon/lat: todo el país (Perú, o encuadre «completo») o las áreas con encuestados y los puntos,
#' con aire
#' @keywords internal
.mapa_dist_ventana <- function(espec) {
  a <- espec$areas
  if (identical(espec$area, "peru") || identical(espec$encuadre, "completo")) {
    bb <- sf::st_bbox(espec$carto$areas)
    return(list(lon = unname(bb[c("xmin", "xmax")]), lat = unname(bb[c("ymin", "ymax")])))
  }
  sel <- a[a$n > 0, , drop = FALSE]
  if (!nrow(sel)) sel <- a
  lon <- range(c(sel$cx, espec$puntos$lon)); lat <- range(c(sel$cy, espec$puntos$lat))
  pad <- max(0.025, 0.18 * max(diff(lon), diff(lat)))
  list(lon = lon + c(-pad, pad), lat = lat + c(-pad, pad))
}

#' Ancho (in) que pide el panel para un alto dado: la columna de la izquierda, el mapa a su escala y el margen
#'
#' Gonzalo, 2026-11-02: «el mapa tiene mucho ancho y se ve raro el encuadre». La tarjeta del mapa mide lo que su
#' contenido pide en vez de una fracción fija de la lámina; lo que sobra va a la tarjeta del ranking.
#' @keywords internal
.mapa_dist_ancho_natural <- function(espec, alto, pt) {
  m <- .mapa_dist_margen(espec); v <- .mapa_dist_ventana(espec)
  k <- cos(mean(v$lat) * pi / 180)
  s <- (alto - 2 * m) / diff(v$lat)
  .mapa_dist_col(espec, 99, pt) + diff(v$lon) * k * s + 2 * m
}

#' Alto (in) que pide el panel para un ancho dado (Word: el mapa va al ancho de texto)
#' @keywords internal
.mapa_dist_alto_natural <- function(espec, ancho, pt) {
  m <- .mapa_dist_margen(espec); v <- .mapa_dist_ventana(espec)
  k <- cos(mean(v$lat) * pi / 180)
  s <- (ancho - .mapa_dist_col(espec, ancho, pt) - 2 * m) / (diff(v$lon) * k)
  diff(v$lat) * s + 2 * m
}

#' Aire (in) entre el territorio y el borde del panel
#'
#' Revisión v7, lámina 19 (Gonzalo, 2026-11-04): «los mapas nacionales pueden tener algo más de zoom» y luego «en el mapa del
#' Perú se puede hacer aún más zoom». El Perú va casi al borde (5 px del lienzo, sin el 6 % de reducción de antes); Lima
#' conserva sus 16 px porque su encuadre ya lleva aire alrededor de las áreas con encuestados.
#' @keywords internal
.mapa_dist_margen <- function(espec) (if (identical(espec$area, "peru")) 5 else 16) * .MAPA_DIST_PX

#' Proyecta lon/lat a pulgadas con la proyección del panel
#' @keywords internal
.mapa_dist_xy <- function(pr, lon, lat) list(x = (lon - pr$lon0) * pr$k * pr$s + pr$tx, y = lat * pr$s + pr$ty)

#' Geometrías proyectadas al recuadro y recortadas a `caja` (pulgadas): una geometría (o vacía) por fila de `g`
#' @keywords internal
.mapa_dist_sf <- function(g, pr, caja) {
  geo <- sf::st_geometry(g); sf::st_crs(geo) <- NA
  M <- matrix(c(pr$k * pr$s, 0, 0, pr$s), 2, 2)
  geo <- geo * M + c(pr$tx - pr$lon0 * pr$k * pr$s, pr$ty)
  rect <- sf::st_sfc(sf::st_polygon(list(rbind(c(caja[1], caja[3]), c(caja[2], caja[3]), c(caja[2], caja[4]), c(caja[1], caja[4]),
                                               c(caja[1], caja[3])))))
  lapply(seq_along(geo), function(i) {
    r <- tryCatch(suppressWarnings(sf::st_intersection(sf::st_make_valid(geo[i]), rect)), error = function(e) NULL)
    if (is.null(r) || !length(r) || all(sf::st_is_empty(r))) return(NULL)
    r <- suppressWarnings(sf::st_cast(sf::st_collection_extract(r, "POLYGON"), "MULTIPOLYGON"))
    if (!length(r)) NULL else r
  })
}

#' Geometrías `sf` proyectadas y recortadas, como data.frame para `geom_polygon`
#'
#' @return data.frame `x`, `y`, `grupo` (cada polígono, su anillo exterior) y las columnas de `datos` pedidas en `cols`;
#'   sin filas si nada cae en la caja.
#' @keywords internal
.mapa_dist_df <- function(g, pr, caja, datos = NULL, cols = character(0), id = "f") {
  vacio <- data.frame(x = numeric(0), y = numeric(0), grupo = character(0))
  if (is.null(g) || !length(sf::st_geometry(g))) return(vacio)
  geos <- .mapa_dist_sf(g, pr, caja)
  piezas <- lapply(seq_along(geos), function(i) {
    r <- geos[[i]]; if (is.null(r)) return(NULL)
    cc <- as.data.frame(sf::st_coordinates(r))
    # Sólo anillos exteriores: el dispositivo del PPT (rvg) se cae con trazados con huecos (`subgroup` → pathGrob). El
    # único hueco de estos mapas, el de Lima Metropolitana dentro de Lima provincias, queda cubierto por Lima Metropolitana.
    cc <- cc[cc$L1 == 1, , drop = FALSE]
    if (!nrow(cc)) return(NULL)
    d <- data.frame(x = cc$X, y = cc$Y, grupo = paste(id, i, cc$L3, cc$L2, sep = "-"), stringsAsFactors = FALSE)
    # Fuera las astillas que deja el recorte en los bordes (menos de 4 vértices o área casi nula): también tumban a rvg.
    area <- vapply(split(d, d$grupo), function(a) abs(sum(a$x * c(a$y[-1], a$y[1]) - c(a$x[-1], a$x[1]) * a$y)) / 2, 0)
    nv <- table(d$grupo)
    vivos <- names(area)[area > 1e-5 & as.integer(nv[names(area)]) >= 4]
    d <- d[d$grupo %in% vivos & is.finite(d$x) & is.finite(d$y), , drop = FALSE]
    if (!nrow(d)) return(NULL)
    for (cn in cols) d[[cn]] <- datos[[cn]][i]
    d
  })
  piezas <- Filter(Negate(is.null), piezas)
  if (!length(piezas)) return(vacio)
  do.call(rbind, piezas)
}

#' Coloca los rótulos en una columna sobre el mar, sin chocar, con su guía horizontal y luego diagonal
#'
#' Maqueta (tablero 3): cada rótulo baja hasta la altura de su lugar (o lo justo para no pisar al anterior, 21 px a
#' 12 px de letra) y se alinea a la derecha en `x_txt`; su guía va recta hasta cerca del lugar y en diagonal hasta él. Si
#' no caben todos en el alto, quedan primero los puntos de referencia y luego los de mayor cifra.
#' @param items data.frame `texto`, `x`, `y` (lugar, pulgadas desde abajo), `prioridad` (mayor = se queda).
#' @return `items` (los que caben) con `y_txt` y la guía `gx`, `gy` (3 vértices por rótulo, en `guia`).
#' @keywords internal
.mapa_dist_rotulos_columna <- function(items, alto, x_txt, pt, arriba = 44 * .MAPA_DIST_PX, tierra = NULL) {
  P <- .MAPA_DIST_PX
  if (!nrow(items)) return(list(items = items, guia = data.frame(g = integer(0), x = numeric(0), y = numeric(0))))
  paso <- 21 * P * pt / 9; abajo <- 14 * P
  cupo <- max(1L, floor((alto - arriba - abajo) / paso) + 1L)
  if (nrow(items) > cupo) items <- items[order(-items$prioridad), , drop = FALSE][seq_len(cupo), , drop = FALSE]
  # Gonzalo, 2026-11-03: «¿por qué no baja un poco en diagonal para no tapar ningún distrito?». Con `tierra`, cada guía baja
  # en diagonal (45°) desde su lugar lo mínimo para que el tramo recto hacia el rótulo vaya entero sobre el mar.
  items$baja <- if (is.null(tierra)) 0 else vapply(seq_len(nrow(items)), function(i)
    .mapa_dist_bajada(items$x[i], items$y[i], x_txt + 4 * P, tierra, max_baja = items$y[i] - abajo), 0)
  items$yd <- alto - (items$y - items$baja)        # hacia abajo, como el lienzo
  items <- items[order(items$yd), , drop = FALSE]
  prev <- -Inf; y_txt <- numeric(nrow(items))
  for (i in seq_len(nrow(items))) { y_txt[i] <- max(items$yd[i], prev + paso, arriba); prev <- y_txt[i] }
  sobra <- prev - (alto - abajo)
  if (sobra > 0) y_txt <- y_txt - sobra
  items$y_txt <- alto - y_txt
  # El rótulo se queda cerca de su codo, sobre el mar, en vez de irse al borde de la columna (Gonzalo, 2026-11-03: «no
  # irse tan a la izquierda»): su borde derecho a 0,45 in del codo, nunca más a la izquierda que la columna.
  items$xe <- vapply(seq_len(nrow(items)), function(i) {
    yl <- items$y_txt[i]; tx <- items$x[i]; ty <- items$y[i]
    if (items$baja[i] > 0) max(x_txt + 8 * P, tx - abs(ty - yl)) else max(x_txt + 8 * P, tx - min(28 * P, abs(ty - yl) + 10 * P))
  }, 0)
  items$x_lab <- if (is.null(tierra)) rep(x_txt, nrow(items)) else pmax(x_txt, items$xe - 0.45)
  guia <- do.call(rbind, lapply(seq_len(nrow(items)), function(i) {
    data.frame(g = i, x = c(items$x_lab[i] + 4 * P, items$xe[i], items$x[i]), y = c(items$y_txt[i], items$y_txt[i], items$y[i]))
  }))
  list(items = items, guia = guia)
}

#' La tierra del panel como una geometría (pulgadas): la unión de los anillos dibujados
#' @keywords internal
.mapa_dist_tierra <- function(d) {
  if (!nrow(d)) return(NULL)
  polys <- lapply(split(d, d$grupo), function(a) { m <- as.matrix(a[c("x", "y")]); sf::st_polygon(list(rbind(m, m[1, ]))) })
  sf::st_union(sf::st_make_valid(sf::st_sfc(polys)))
}

#' Cuánto baja la guía de un punto (in) para que su tramo recto hacia la columna no cruce tierra
#'
#' Prueba bajadas de 0,05 in en 0,05 in: el codo queda a 45° del punto, abajo a la izquierda, y el tramo de ahí a la columna
#' tiene que ir entero sobre el mar (sin tocar `tierra`, la unión de áreas y contexto en pulgadas). Si ninguna sirve, 0.
#' @keywords internal
.mapa_dist_bajada <- function(x, y, x_col, tierra, max_baja = 1.5, extra = 0.15) {
  if (is.null(tierra) || !is.finite(x) || !is.finite(y)) return(0)
  for (b in seq(0, max(0, min(1.5, max_baja)), by = 0.05)) {
    xe <- x - b; ye <- y - b
    if (xe <= x_col) break
    tramo <- sf::st_sfc(sf::st_linestring(rbind(c(x_col, ye), c(xe - 0.03, ye))))
    if (!any(sf::st_intersects(tramo, tierra, sparse = FALSE))) {
      # Un poco más de bajada que la mínima, si el tramo sigue sobre el mar (Gonzalo, 2026-11-03: «puede bajar un poco más»).
      b2 <- b + extra; xe2 <- x - b2; ye2 <- y - b2
      if (b2 <= max_baja && xe2 > x_col) {
        t2 <- sf::st_sfc(sf::st_linestring(rbind(c(x_col, ye2), c(xe2 - 0.03, ye2))))
        if (!any(sf::st_intersects(t2, tierra, sparse = FALSE))) return(b2)
      }
      return(b)
    }
  }
  0
}

#' Ancho de la columna de rótulos (pulgadas): el rótulo más ancho y su aire, hasta el 36 % del recuadro; sin puntos de
#' referencia, una franja mínima de mar
#' @keywords internal
.mapa_dist_col <- function(espec, ancho, pt) {
  if (identical(espec$area, "peru") && !is.null(espec$zona)) return(.mapa_dist_zona_ancho(espec, pt) + 16 * .MAPA_DIST_PX)   # la franja del recuadro
  # Especificación aprobada (Gonzalo, 2026-11-03): la guía y el rótulo de la PUCP van dentro del mapa («la etiqueta se
  # sale del gráfico»), así que no hay columna de rótulos sobre el mar.
  0
}

#' El panel del mapa de distribución
#' @param ancho,alto Recuadro (pulgadas). @param pt Cuerpos (`.mapa_dist_pt`).
#' @return ggplot sin márgenes, en pulgadas de 0 a `ancho` y de 0 a `alto`.
#' @keywords internal
.mapa_dist_panel_gg <- function(espec, ancho, alto, pt = .mapa_dist_pt("lamina")) {
  M <- .MAPA_DIST(); P <- .MAPA_DIST_PX; fuente <- .std_pt("fuente")
  s2 <- suppressMessages(sf::sf_use_s2(FALSE)); on.exit(suppressMessages(sf::sf_use_s2(s2)), add = TRUE)
  col <- .mapa_dist_col(espec, ancho, pt)
  pr <- .mapa_dist_proyeccion(espec, ancho, alto, col)
  caja <- c(0, ancho, 0, alto)
  areas <- espec$carto$areas
  datos <- espec$areas[match(areas$clave, espec$areas$clave), ]
  arriba_de_todo <- areas$clave %in% c("15M", "07") & identical(espec$area, "peru")   # una sola área sin distritos
  # Revisión v7, lámina 11: «los bordes distritales de los distritos con el mismo tono no se perciben». Sobre las clases
  # oscuras el borde va blanco y esas áreas se dibujan al final, para que su borde quede encima del de la vecina clara.
  oscura <- .mapa_dist_oscuro(datos$color)
  datos$trazo <- ifelse(arriba_de_todo | (datos$lima_par %||% FALSE) %in% TRUE, datos$color, ifelse(oscura, M$borde_oscura, M$borde))
  orden <- order(arriba_de_todo, oscura)
  poly <- .mapa_dist_df(areas[orden, ], pr, caja, datos[orden, ], c("clave", "color", "trazo"), id = "a")
  ctx <- .mapa_dist_df(espec$carto$contexto, pr, caja, id = "c")
  g <- ggplot2::ggplot() +
    ggplot2::annotate("rect", xmin = 0, xmax = ancho, ymin = 0, ymax = alto, fill = M$mar) +
    ggplot2::geom_polygon(data = ctx, ggplot2::aes(.data$x, .data$y, group = .data$grupo),
                          fill = M$tierra, colour = M$tierra_borde, linewidth = .mapa_dist_lw(0.75), linejoin = "round")
  # Los países vecinos van sin nombre (Gonzalo, 2026-11-03: «no es necesario que los países vecinos tengan nombre»).
  g <- g +
    ggplot2::geom_polygon(data = poly, ggplot2::aes(.data$x, .data$y, group = .data$grupo),
                          fill = NA, colour = M$contorno, linewidth = .mapa_dist_lw(2.4), linejoin = "round") +
    ggplot2::geom_polygon(data = poly, ggplot2::aes(.data$x, .data$y, group = .data$grupo, fill = .data$color,
                                                    colour = .data$trazo), linewidth = .mapa_dist_lw(M$borde_pt), linejoin = "round") +
    ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity()
  # Las áreas de otra respuesta del filtro: gris con rayado, para que no se lean como «Sin encuestados».
  # Un rayado por grupo, en sentidos alternos: Lima Metropolitana y el Callao no son Lima provincias.
  grupos <- espec$otra_grupos %||% list(espec$otra %||% character(0))
  for (gi in seq_along(grupos)) {
    raya <- .mapa_dist_rayado(poly[poly$clave %in% grupos[[gi]], , drop = FALSE], sentido = if (gi %% 2) 1 else -1)
    if (nrow(raya)) g <- g + ggplot2::geom_path(data = raya, ggplot2::aes(.data$x, .data$y, group = .data$g), colour = M$otra_raya,
                                                linewidth = .mapa_dist_lw(0.6), lineend = "butt")
  }
  # Rótulos.
  rot <- espec$rotulos
  if (NROW(rot)) {
    xy <- .mapa_dist_xy(pr, rot$lon, rot$lat)
    rot$x <- xy$x; rot$y <- xy$y
    rot <- rot[rot$x >= 0 & rot$x <= ancho & rot$y >= 0 & rot$y <= alto, , drop = FALSE]
  }
  if (NROW(rot) && identical(espec$area, "peru") && !is.null(espec$zona)) {
    rot <- rot[0, , drop = FALSE]   # en el Perú los puntos de referencia van en el recuadro de la zona de Lima
  } else if (NROW(rot) && col <= 0) {
    g <- .mapa_dist_punto_corto(g, rot, pt, ancho, alto)
  } else if (NROW(rot)) {
    x_txt <- col - 18 * P
    rot$prioridad <- seq(nrow(rot), 1)
    # La tierra en pulgadas (áreas y contexto) para que las guías bajen hasta el mar antes de ir a la columna.
    tierra <- tryCatch(.mapa_dist_tierra(rbind(poly[c("x", "y", "grupo")], ctx[c("x", "y", "grupo")])), error = function(e) NULL)
    lay <- .mapa_dist_rotulos_columna(rot, alto, x_txt, pt$rotulo, tierra = tierra)
    it <- lay$items
    g <- g +
      # La guía va del color de su punto, con halo blanco debajo: gris oscura y fina desaparecía sobre los distritos
      # azul oscuro (Gonzalo, 2026-11-03: «el color de la flecha hace que no se vea bien»).
      ggplot2::geom_path(data = lay$guia, ggplot2::aes(.data$x, .data$y, group = .data$g), colour = "#FFFFFF",
                         linewidth = .mapa_dist_lw(2.6), lineend = "round", linejoin = "round") +
      ggplot2::geom_path(data = transform(lay$guia, col = it$punto[lay$guia$g]), ggplot2::aes(.data$x, .data$y, group = .data$g, colour = .data$col),
                         linewidth = .mapa_dist_lw(1), lineend = "round", linejoin = "round") +
      ggplot2::geom_point(data = it, ggplot2::aes(.data$x, .data$y), shape = 21, size = 1.45, stroke = 0.35, colour = "#FFFFFF", fill = it$punto) +
      ggplot2::geom_text(data = it, ggplot2::aes(.data$x_lab, .data$y_txt, label = .data$texto), hjust = 1, vjust = 0.5,
                         size = pt$rotulo / ggplot2::.pt, fontface = "bold", colour = it$color, family = fuente)
    attr(g, "pulso_rotulos") <- it
  }
  # «Océano Pacífico» sólo cuando el mapa es grande (lámina del mapa suelto); en las tarjetas de la lámina con su filtro no
  # cabe sin tocar tierra. Sin escala gráfica (especificación aprobada, Gonzalo, 2026-11-03).
  # La base del mapa, si no es la del estudio, en la esquina inferior izquierda (revisión v7, lámina 12: «para saber que
  # nos referimos a un subgrupo»).
  con_base <- !is.null(espec$base_rotulo) && nzchar(espec$base_rotulo)
  if (con_base) {
    g <- g + ggplot2::annotate("text", x = 10 * P, y = 9 * P, label = espec$base_rotulo, hjust = 0, vjust = 0,
                               size = pt$leyenda / ggplot2::.pt, fontface = "bold", colour = M$guia, family = fuente)
  }
  if (ancho >= 5.5 || !is.null(espec$zona)) {
    # En el Perú con recuadro, a su derecha sobre el mar del sur; si no, en la esquina del mar (a 212 px caía sobre Tacna).
    x_oc <- if (identical(espec$area, "peru") && !is.null(espec$zona)) 212 * P else 16 * P
    y_oc <- if (identical(espec$area, "peru")) 0.45 + (if (con_base) 0.25 else 0) else alto - 26 * P
    g <- g + ggplot2::annotate("text", x = x_oc, y = y_oc, label = "Océano Pacífico", hjust = 0, vjust = 0.5, size = pt$oceano / ggplot2::.pt,
                               fontface = "italic", colour = M$oceano, family = fuente)
  }
  if (identical(espec$area, "peru") && !is.null(espec$zona)) g <- .mapa_dist_zona_lima(g, espec, pr, alto, pt)
  g <- g + ggplot2::coord_fixed(xlim = c(0, ancho), ylim = c(0, alto), expand = FALSE, clip = "on") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(0, 0, 0, 0), plot.background = ggplot2::element_blank())
  attr(g, "pulso_proyeccion") <- pr
  g
}

#' Rayas a 45° dentro de las áreas de otra respuesta (pulgadas del panel): una línea cada 0.07 in recortada a sus anillos
#' @param d Anillos `x`, `y`, `grupo` (salida de `.mapa_dist_df`). @param sentido 1 («/») o -1 («\\»).
#' @return data.frame `g`, `x`, `y` para `geom_path`.
#' @keywords internal
.mapa_dist_rayado <- function(d, paso = 0.07, sentido = 1) {
  vacio <- data.frame(g = character(0), x = numeric(0), y = numeric(0))
  if (!NROW(d)) return(vacio)
  zona <- tryCatch(.mapa_dist_tierra(d), error = function(e) NULL)
  if (is.null(zona)) return(vacio)
  bb <- sf::st_bbox(zona); w <- bb[["xmax"]] - bb[["xmin"]]; h <- bb[["ymax"]] - bb[["ymin"]]
  cs <- seq(bb[["xmin"]] - h, bb[["xmax"]], by = paso)
  # `sentido = 1`: «/»; `-1`: «\\».
  lineas <- sf::st_sfc(lapply(cs, function(c0) if (sentido > 0) sf::st_linestring(rbind(c(c0, bb[["ymin"]]), c(c0 + h, bb[["ymax"]]))) else
    sf::st_linestring(rbind(c(c0, bb[["ymax"]]), c(c0 + h, bb[["ymin"]])))))
  r <- tryCatch(suppressWarnings(sf::st_intersection(lineas, zona)), error = function(e) NULL)
  if (is.null(r) || !length(r)) return(vacio)
  r <- suppressWarnings(sf::st_cast(sf::st_collection_extract(r, "LINESTRING"), "LINESTRING"))
  cc <- as.data.frame(sf::st_coordinates(r))
  if (!nrow(cc)) return(vacio)
  data.frame(g = paste0("r", cc$L1), x = cc$X, y = cc$Y)
}

#' El punto de referencia con su guía corta dentro del mapa (especificación aprobada, regla 6): unos 22 px a la izquierda y
#' 44 hacia abajo del lienzo de 1600 px, y el rótulo centrado bajo la guía, con halo blanco
#' @keywords internal
.mapa_dist_punto_corto <- function(g, rot, pt, ancho, alto) {
  fuente <- .std_pt("fuente"); px <- 13.333 / 1600
  dx <- 22 * px; dy <- 44 * px
  it <- rot
  it$xe <- pmax(0.25, it$x - dx); it$ye <- pmax(0.2, it$y - dy)
  it$yt <- it$ye - 0.09
  halo <- do.call(rbind, lapply(seq(0, 2 * pi, length.out = 9)[-9], function(a) transform(it, xt = xe + cos(a) * 0.012, ytt = yt + sin(a) * 0.012)))
  g + ggplot2::geom_segment(data = it, ggplot2::aes(x = .data$x, y = .data$y, xend = .data$xe, yend = .data$ye), colour = "#FFFFFF",
                            linewidth = .mapa_dist_lw(2.6), lineend = "round") +
    ggplot2::geom_segment(data = it, ggplot2::aes(x = .data$x, y = .data$y, xend = .data$xe, yend = .data$ye), colour = it$color,
                          linewidth = .mapa_dist_lw(1), lineend = "round") +
    ggplot2::geom_point(data = it, ggplot2::aes(.data$x, .data$y), shape = 21, size = 1.8, stroke = 0.5, colour = "#FFFFFF", fill = it$punto) +
    ggplot2::geom_text(data = halo, ggplot2::aes(.data$xt, .data$ytt, label = .data$texto), hjust = 0.5, vjust = 1,
                       size = pt$rotulo / ggplot2::.pt, fontface = "bold", colour = "#FFFFFF", family = fuente) +
    ggplot2::geom_text(data = it, ggplot2::aes(.data$xe, .data$yt, label = .data$texto), hjust = 0.5, vjust = 1,
                       size = pt$rotulo / ggplot2::.pt, fontface = "bold", colour = it$color, family = fuente)
}

#' Ancho (in) del recuadro de la zona de Lima: 184 px a la letra de la lámina, y crece con su letra y sus filas (a 9 pt,
#' en el Word, «Lima Metropolitana 286 (72%)» no cabía en 184 px)
#' @keywords internal
.mapa_dist_zona_ancho <- function(espec, pt) {
  tinta <- max(.lam_ancho_tinta(paste(espec$zona$nombre, espec$zona$cifra), pt$zona, TRUE)) * 1.1
  max(184 * .MAPA_DIST_PX * pt$zona / 8.25, tinta + 40 * .MAPA_DIST_PX)
}

#' Recuadro «Zona de Lima, ampliada» del mapa del Perú: Lima Metropolitana, el Callao y Lima provincias con sus cifras,
#' unido por una línea al lugar en el mapa
#' @keywords internal
.mapa_dist_zona_lima <- function(g, espec, pr, alto, pt) {
  M <- .MAPA_DIST(); P <- .MAPA_DIST_PX; fuente <- .std_pt("fuente")
  f <- pt$zona / 8.25
  x0 <- 12 * P; w <- .mapa_dist_zona_ancho(espec, pt); top <- alto - 112 * P
  h_map <- 170 * P; h_cab <- 21 * P * f; h_filas <- 3 * 16 * P * f + 12 * P
  y_bot <- top - h_cab - h_map - h_filas
  if (y_bot < 0.5) { top <- top + (0.5 - y_bot); y_bot <- 0.5 }
  areas <- espec$carto$areas; z <- espec$zona
  # Encuadre: la caja de Lima Metropolitana más el Callao con un 30 % de aire por lado (centrada solo en Lima
  # Metropolitana, el Callao quedaba casi fuera y sobraba costa vacía).
  bb <- sf::st_bbox(areas[areas$clave %in% c("15M", "07"), ])
  cxl <- mean(bb[c("xmin", "xmax")]); cyl <- mean(bb[c("ymin", "ymax")])
  k <- pr$k
  mx0 <- x0 + P; mx1 <- x0 + w - P; my1 <- top - h_cab; my0 <- my1 - h_map
  sz <- min((mx1 - mx0) / ((bb[["xmax"]] - bb[["xmin"]]) * k * 1.6), (my1 - my0) / ((bb[["ymax"]] - bb[["ymin"]]) * 1.6))
  prz <- list(k = k, s = sz, lon0 = cxl, tx = (mx0 + mx1) / 2, ty = (my0 + my1) / 2 - cyl * sz)
  datos <- espec$areas[match(areas$clave, espec$areas$clave), ]
  orden <- order(areas$clave %in% c("15M", "07"))   # todas las áreas, recortadas al recuadro; Lima Met. y el Callao encima
  datos$trazo <- ifelse(areas$clave %in% c("15M", "07"), datos$color, M$borde)
  dz <- .mapa_dist_df(areas[orden, ], prz, c(mx0, mx1, my0, my1), datos[orden, ], c("color", "trazo"), id = "z")
  # La línea que une el recuadro con Lima en el mapa.
  lmc <- .mapa_dist_xy(pr, cxl, cyl)
  g <- g +
    ggplot2::annotate("segment", x = x0 + w, xend = lmc$x, y = lmc$y, yend = lmc$y, colour = M$texto, linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::annotate("rect", xmin = x0, xmax = x0 + w, ymin = y_bot, ymax = top, fill = "#FFFFFF", colour = M$vacio_borde,
                      linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::annotate("text", x = x0 + 9 * P, y = top - 12 * P, label = "Zona de Lima, ampliada", hjust = 0, size = pt$zona / ggplot2::.pt,
                      fontface = "bold", colour = M$texto, family = fuente) +
    ggplot2::annotate("rect", xmin = mx0, xmax = mx1, ymin = my0, ymax = my1, fill = M$mar) +
    ggplot2::geom_polygon(data = dz, ggplot2::aes(.data$x, .data$y, group = .data$grupo, fill = .data$color,
                                                  colour = .data$trazo), linewidth = .mapa_dist_lw(0.6), linejoin = "round")
  pts <- espec$puntos
  if (NROW(pts)) {
    pp <- .mapa_dist_xy(prz, pts$lon, pts$lat)
    dp <- data.frame(x = pp$x, y = pp$y, t = pts$etiqueta, col = ifelse(pts$color == .std_color("coral"), M$punto, pts$color))
    dp <- dp[dp$x > mx0 & dp$x < mx1 & dp$y > my0 & dp$y < my1, , drop = FALSE]
    if (nrow(dp)) g <- g + ggplot2::geom_point(data = dp, ggplot2::aes(.data$x, .data$y), shape = 21, size = 1.45, stroke = 0.35,
                                               colour = "#FFFFFF", fill = dp$col) +
      ggplot2::geom_text(data = dp, ggplot2::aes(.data$x + 5 * P, .data$y, label = .data$t), hjust = 0, size = pt$zona / ggplot2::.pt,
                         fontface = "bold", colour = dp$col, family = fuente)
  }
  filas <- data.frame(y = my0 - 6 * P - (seq_len(nrow(z)) - 0.5) * 16 * P * f, nombre = z$nombre, cifra = z$cifra, color = z$color)
  g + ggplot2::annotate("segment", x = x0, xend = x0 + w, y = my0, yend = my0, colour = .MAPA_DIST()$zona_filete, linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::geom_tile(data = filas, ggplot2::aes(x0 + 15 * P, .data$y, fill = .data$color), width = 12 * P, height = 10 * P) +
    ggplot2::geom_text(data = filas, ggplot2::aes(x0 + 27 * P, .data$y, label = .data$nombre), hjust = 0, size = pt$zona / ggplot2::.pt,
                       colour = .MAPA_DIST()$zona_texto, family = fuente) +
    ggplot2::geom_text(data = filas, ggplot2::aes(x0 + w - 9 * P, .data$y, label = .data$cifra), hjust = 1, size = pt$zona / ggplot2::.pt,
                       fontface = "bold", colour = M$texto, family = fuente)
}
