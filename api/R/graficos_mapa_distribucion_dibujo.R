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
# porque las áreas se pintan encima); áreas con borde blanco de 0,75 pt; Lima Metropolitana y el Callao (Perú) con trazo
# de su propio color; rótulos; «Océano Pacífico»; escala gráfica; en el Perú, el recuadro de la zona de Lima.

.MAPA_DIST_PX <- 1 / 96   # 1 px del lienzo de la maqueta, en pulgadas

#' Cuerpos de letra del mapa (pt) para la lámina o el Word (Word: rótulos 10,5 pt, leyenda y escala 9 pt; nunca < 8 pt)
#' @keywords internal
.mapa_dist_pt <- function(destino = c("lamina", "word")) {
  destino <- match.arg(destino)
  if (identical(destino, "word")) list(rotulo = 10.5, leyenda = 9, escala = 9, oceano = 9.75, pais = 9, zona = 9)
  else list(rotulo = 9, leyenda = 8.25, escala = 8.25, oceano = 9.75, pais = 8.25, zona = 8.25)
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
  a <- espec$areas; m <- 16 * .MAPA_DIST_PX
  if (identical(espec$area, "peru") || identical(espec$encuadre, "completo")) {
    bb <- sf::st_bbox(espec$carto$areas)
    lon <- bb[c("xmin", "xmax")]; lat <- bb[c("ymin", "ymax")]
  } else {
    sel <- a[a$n > 0, , drop = FALSE]
    if (!nrow(sel)) sel <- a
    lon <- range(c(sel$cx, espec$puntos$lon)); lat <- range(c(sel$cy, espec$puntos$lat))
    pad <- max(0.025, 0.18 * max(diff(lon), diff(lat)))
    lon <- lon + c(-pad, pad); lat <- lat + c(-pad, pad)
  }
  lat0 <- mean(lat); k <- cos(lat0 * pi / 180); lon0 <- lon[[1]]
  dx <- (lon[[2]] - lon[[1]]) * k; dy <- lat[[2]] - lat[[1]]
  util_w <- ancho - col - m; util_h <- alto - 2 * m
  s <- min(util_w / dx, util_h / dy) * (if (identical(espec$area, "peru")) 0.94 else 1)
  # Sin recuadro de la zona de Lima ni rótulos que pidan columna, el Perú se centra; si no, va a la derecha.
  tx <- if (identical(espec$area, "peru") && is.null(espec$zona)) (ancho - dx * s) / 2 else ancho - m - dx * s
  ty <- (alto - dy * s) / 2 - lat[[1]] * s
  list(k = k, s = s, tx = tx, ty = ty, lon0 = lon0, lat0 = lat0)
}

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

#' Dónde va el nombre de cada país vecino: su punto del archivo si queda dentro del recuadro con aire; si no, un punto
#' de su parte visible, siempre que ésta mida al menos 0,25 in² (un borde que apenas asoma no se rotula)
#' @keywords internal
.mapa_dist_rotulos_vecinos <- function(vec, pr, caja, pt) {
  margen <- 0.3
  out <- lapply(seq_len(nrow(vec)), function(i) {
    p <- .mapa_dist_xy(pr, vec$rot_x[i], vec$rot_y[i])
    w <- .lam_ancho_tinta(vec$nombre[i], pt$pais, TRUE) / 2 + 0.05
    if (is.finite(p$x) && p$x - w > caja[1] + 0.05 && p$x + w < caja[2] - 0.05 && p$y > caja[3] + 0.15 && p$y < caja[4] - 0.15) {
      return(data.frame(x = p$x, y = p$y, t = vec$nombre[i]))
    }
    pol <- .mapa_dist_sf(vec[i, ], pr, c(caja[1] + margen, caja[2] - margen, caja[3] + 0.15, caja[4] - 0.15))[[1]]
    if (is.null(pol) || sum(as.numeric(sf::st_area(pol))) < 0.25) return(NULL)
    pol <- sf::st_cast(pol, "POLYGON"); pol <- pol[which.max(as.numeric(sf::st_area(pol)))]
    c0 <- sf::st_coordinates(suppressWarnings(sf::st_point_on_surface(pol)))
    data.frame(x = c0[1, "X"], y = c0[1, "Y"], t = vec$nombre[i])
  })
  out <- Filter(Negate(is.null), out)
  if (!length(out)) data.frame(x = numeric(0), y = numeric(0), t = character(0)) else do.call(rbind, out)
}

#' Coloca los rótulos en una columna sobre el mar, sin chocar, con su guía horizontal y luego diagonal
#'
#' Maqueta (tablero 3): cada rótulo baja hasta la altura de su lugar (o lo justo para no pisar al anterior, 21 px a
#' 12 px de letra) y se alinea a la derecha en `x_txt`; su guía va recta hasta cerca del lugar y en diagonal hasta él. Si
#' no caben todos en el alto, quedan primero los puntos de referencia y luego los de mayor cifra.
#' @param items data.frame `texto`, `x`, `y` (lugar, pulgadas desde abajo), `prioridad` (mayor = se queda).
#' @return `items` (los que caben) con `y_txt` y la guía `gx`, `gy` (3 vértices por rótulo, en `guia`).
#' @keywords internal
.mapa_dist_rotulos_columna <- function(items, alto, x_txt, pt, arriba = 44 * .MAPA_DIST_PX) {
  P <- .MAPA_DIST_PX
  if (!nrow(items)) return(list(items = items, guia = data.frame(g = integer(0), x = numeric(0), y = numeric(0))))
  paso <- 21 * P * pt / 9; abajo <- 14 * P
  cupo <- max(1L, floor((alto - arriba - abajo) / paso) + 1L)
  if (nrow(items) > cupo) items <- items[order(-items$prioridad), , drop = FALSE][seq_len(cupo), , drop = FALSE]
  items$yd <- alto - items$y                       # hacia abajo, como el lienzo
  items <- items[order(items$yd), , drop = FALSE]
  prev <- -Inf; y_txt <- numeric(nrow(items))
  for (i in seq_len(nrow(items))) { y_txt[i] <- max(items$yd[i], prev + paso, arriba); prev <- y_txt[i] }
  sobra <- prev - (alto - abajo)
  if (sobra > 0) y_txt <- y_txt - sobra
  items$y_txt <- alto - y_txt
  guia <- do.call(rbind, lapply(seq_len(nrow(items)), function(i) {
    yl <- items$y_txt[i]; tx <- items$x[i]; ty <- items$y[i]
    xe <- max(x_txt + 8 * P, tx - min(28 * P, abs(ty - yl) + 10 * P))
    data.frame(g = i, x = c(x_txt + 4 * P, xe, tx), y = c(yl, yl, ty))
  }))
  list(items = items, guia = guia)
}

#' Ancho de la columna de rótulos (pulgadas): el rótulo más ancho y su aire, hasta el 36 % del recuadro; sin puntos de
#' referencia, una franja mínima de mar
#' @keywords internal
.mapa_dist_col <- function(espec, ancho, pt) {
  if (identical(espec$area, "peru") && !is.null(espec$zona)) return(.mapa_dist_zona_ancho(espec, pt) + 16 * .MAPA_DIST_PX)   # la franja del recuadro
  tinta <- max(c(0, .lam_ancho_tinta(espec$rotulos$texto, pt$rotulo, TRUE)))
  min(0.36 * ancho, max(0.5, tinta * 1.08 + 0.45))
}

#' El panel del mapa de distribución
#' @param ancho,alto Recuadro (pulgadas). @param pt Cuerpos (`.mapa_dist_pt`).
#' @return ggplot sin márgenes, en pulgadas de 0 a `ancho` y de 0 a `alto`.
#' @keywords internal
.mapa_dist_panel_gg <- function(espec, ancho, alto, pt = .mapa_dist_pt("lamina")) {
  M <- .MAPA_DIST; P <- .MAPA_DIST_PX; fuente <- .std_pt("fuente")
  s2 <- suppressMessages(sf::sf_use_s2(FALSE)); on.exit(suppressMessages(sf::sf_use_s2(s2)), add = TRUE)
  col <- .mapa_dist_col(espec, ancho, pt)
  pr <- .mapa_dist_proyeccion(espec, ancho, alto, col)
  caja <- c(0, ancho, 0, alto)
  areas <- espec$carto$areas
  datos <- espec$areas[match(areas$clave, espec$areas$clave), ]
  arriba_de_todo <- areas$clave %in% c("15M", "07") & identical(espec$area, "peru")   # una sola área sin distritos
  datos$trazo <- ifelse(arriba_de_todo, datos$color, M$borde)
  orden <- order(arriba_de_todo)
  poly <- .mapa_dist_df(areas[orden, ], pr, caja, datos[orden, ], c("clave", "color", "trazo"), id = "a")
  ctx <- .mapa_dist_df(espec$carto$contexto, pr, caja, id = "c")
  g <- ggplot2::ggplot() +
    ggplot2::annotate("rect", xmin = 0, xmax = ancho, ymin = 0, ymax = alto, fill = M$mar) +
    ggplot2::geom_polygon(data = ctx, ggplot2::aes(.data$x, .data$y, group = .data$grupo),
                          fill = M$tierra, colour = M$tierra_borde, linewidth = .mapa_dist_lw(0.75), linejoin = "round")
  # Los nombres de los países vecinos (Perú), en mayúsculas grises sobre su tierra.
  # El rótulo va sobre la parte VISIBLE de cada país (su punto del archivo si cae dentro; si no, un punto de lo recortado).
  vec <- espec$carto$contexto
  if (!is.null(vec) && any(is.finite(vec$rot_x))) {
    dv <- .mapa_dist_rotulos_vecinos(vec, pr, caja, pt)
    if (nrow(dv)) g <- g + ggplot2::geom_text(data = dv, ggplot2::aes(.data$x, .data$y, label = .data$t), size = pt$pais / ggplot2::.pt,
                                              fontface = "bold", colour = M$pais, family = fuente)
  }
  g <- g +
    ggplot2::geom_polygon(data = poly, ggplot2::aes(.data$x, .data$y, group = .data$grupo),
                          fill = NA, colour = M$contorno, linewidth = .mapa_dist_lw(2.4), linejoin = "round") +
    ggplot2::geom_polygon(data = poly, ggplot2::aes(.data$x, .data$y, group = .data$grupo, fill = .data$color,
                                                    colour = .data$trazo), linewidth = .mapa_dist_lw(0.75), linejoin = "round") +
    ggplot2::scale_fill_identity() + ggplot2::scale_colour_identity()
  # Rótulos.
  rot <- espec$rotulos
  if (NROW(rot)) {
    xy <- .mapa_dist_xy(pr, rot$lon, rot$lat)
    rot$x <- xy$x; rot$y <- xy$y
    rot <- rot[rot$x >= 0 & rot$x <= ancho & rot$y >= 0 & rot$y <= alto, , drop = FALSE]
  }
  if (NROW(rot) && identical(espec$area, "peru") && !is.null(espec$zona)) {
    rot <- rot[0, , drop = FALSE]   # en el Perú los puntos de referencia van en el recuadro de la zona de Lima
  } else if (NROW(rot)) {
    x_txt <- col - 18 * P
    rot$prioridad <- seq(nrow(rot), 1)
    lay <- .mapa_dist_rotulos_columna(rot, alto, x_txt, pt$rotulo)
    it <- lay$items
    g <- g +
      ggplot2::geom_path(data = lay$guia, ggplot2::aes(.data$x, .data$y, group = .data$g), colour = M$guia, linewidth = .mapa_dist_lw(0.68)) +
      ggplot2::geom_point(data = it, ggplot2::aes(.data$x, .data$y), shape = 21, size = 1.45, stroke = 0.35, colour = "#FFFFFF", fill = it$punto) +
      ggplot2::geom_text(data = it, ggplot2::aes(x_txt, .data$y_txt, label = .data$texto), hjust = 1, vjust = 0.5,
                         size = pt$rotulo / ggplot2::.pt, fontface = "bold", colour = it$color, family = fuente)
    attr(g, "pulso_rotulos") <- it
  }
  # «Océano Pacífico».
  # En el Perú, a la derecha del recuadro de la zona de Lima, sobre el mar del sur.
  x_oc <- if (identical(espec$area, "peru")) 212 * P else 16 * P
  y_oc <- if (identical(espec$area, "peru")) 0.45 else alto - 26 * P
  g <- g + ggplot2::annotate("text", x = x_oc, y = y_oc, label = "Océano Pacífico", hjust = 0, vjust = 0.5, size = pt$oceano / ggplot2::.pt,
                             fontface = "italic", colour = M$oceano, family = fuente)
  # Escala gráfica, gris y sin flecha de norte: 5 km en la esquina inferior derecha de Lima; en el Perú, 200 km sobre el
  # mar del sur, bajo «Océano Pacífico» (en la esquina estaría encima de Tacna).
  km <- if (identical(espec$area, "peru")) 200 else 5
  largo <- km / 111.32 * pr$s
  if (identical(espec$area, "peru")) { x0 <- x_oc; x1 <- x0 + largo } else { x1 <- ancho - 22 * P; x0 <- x1 - largo }
  y0 <- 14 * P
  esc <- data.frame(x = c(x0, x0, x1, x1), y = c(y0 + 4 * P, y0, y0, y0 + 4 * P))
  g <- g + ggplot2::geom_path(data = esc, ggplot2::aes(.data$x, .data$y), colour = M$gris, linewidth = .mapa_dist_lw(0.9)) +
    ggplot2::annotate("text", x = (x0 + x1) / 2, y = y0 + 10 * P, label = paste(km, "km"), vjust = 0, size = pt$escala / ggplot2::.pt,
                      colour = M$gris, family = fuente)
  if (identical(espec$area, "peru") && !is.null(espec$zona)) g <- .mapa_dist_zona_lima(g, espec, pr, alto, pt)
  g <- g + ggplot2::coord_fixed(xlim = c(0, ancho), ylim = c(0, alto), expand = FALSE, clip = "on") +
    ggplot2::theme_void() + ggplot2::theme(plot.margin = ggplot2::margin(0, 0, 0, 0), plot.background = ggplot2::element_blank())
  attr(g, "pulso_proyeccion") <- pr
  g
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
  M <- .MAPA_DIST; P <- .MAPA_DIST_PX; fuente <- .std_pt("fuente")
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
  g + ggplot2::annotate("segment", x = x0, xend = x0 + w, y = my0, yend = my0, colour = "#E3E6EB", linewidth = .mapa_dist_lw(0.75)) +
    ggplot2::geom_tile(data = filas, ggplot2::aes(x0 + 15 * P, .data$y, fill = .data$color), width = 12 * P, height = 10 * P) +
    ggplot2::geom_text(data = filas, ggplot2::aes(x0 + 27 * P, .data$y, label = .data$nombre), hjust = 0, size = pt$zona / ggplot2::.pt,
                       colour = "#2A3448", family = fuente) +
    ggplot2::geom_text(data = filas, ggplot2::aes(x0 + w - 9 * P, .data$y, label = .data$cifra), hjust = 1, size = pt$zona / ggplot2::.pt,
                       fontface = "bold", colour = M$texto, family = fuente)
}
