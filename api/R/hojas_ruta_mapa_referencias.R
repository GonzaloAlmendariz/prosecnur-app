# Referencias para orientarse en el mapa de zona: centros de salud, colegios,
# comisarías, mercados e iglesias, como íconos en blanco y negro.
#
# Salen del contexto OSM empaquetado por distrito
# (inst/hojas_ruta/cartografia/contexto_osm_lima_callao/<ubigeo>.geojson.gz).
# Esos puntos ya venían en los datos, pero el mapa sólo usaba los polígonos de
# parques y agua —que en esos archivos no hay— y descartaba los puntos.
# Bancos, hoteles y paraderos se dejan fuera: saturan sin ayudar a llegar.

# Tipo de referencia por `kind` de OSM, en orden de prioridad cuando no caben todos.
.hojas_ruta_mapa_referencia_tipos <- list(
  salud = c("hospital", "clinic", "doctors", "health_centre", "health_post"),
  policia = c("police"),
  colegio = c("school", "college", "university", "kindergarten"),
  mercado = c("marketplace"),
  iglesia = c("place_of_worship")
)

.hojas_ruta_mapa_referencia_rotulos <- c(
  salud = "Centro de salud", policia = "Comisaría", colegio = "Colegio",
  mercado = "Mercado", iglesia = "Iglesia"
)

#' Puntos de referencia de un distrito: `data.frame(lon, lat, tipo, nombre)`.
#' Se cachea por distrito en el contexto de render.
#' @keywords internal
.hojas_ruta_mapa_referencias <- function(ubigeo, render_ctx = NULL) {
  u <- sprintf("%06s", as.character(ubigeo %||% ""))
  vacio <- data.frame(lon = numeric(0), lat = numeric(0), tipo = character(0), nombre = character(0))
  .hojas_ruta_render_cache_get(render_ctx, "referencias", u, function() {
    f <- tryCatch(.hojas_ruta_context_map_packaged_file(u), error = function(e) "")
    if (!length(f) || !nzchar(f) || !file.exists(f)) return(vacio)
    j <- tryCatch(.hojas_ruta_read_json_any(f), error = function(e) NULL)
    fs <- j$features %||% j$geojson$features %||% list()
    kinds <- unlist(.hojas_ruta_mapa_referencia_tipos, use.names = FALSE)
    tipo_de <- stats::setNames(rep(names(.hojas_ruta_mapa_referencia_tipos),
                                   lengths(.hojas_ruta_mapa_referencia_tipos)), kinds)
    filas <- lapply(fs, function(x) {
      kind <- as.character(x$properties$kind %||% "")
      if (!identical(x$geometry$type, "Point") || !kind %in% kinds) return(NULL)
      xy <- suppressWarnings(as.numeric(unlist(x$geometry$coordinates)))
      if (length(xy) < 2L || any(!is.finite(xy[1:2]))) return(NULL)
      data.frame(lon = xy[[1]], lat = xy[[2]], tipo = unname(tipo_de[[kind]]),
                 nombre = as.character(x$properties$name %||% ""))
    })
    filas <- Filter(Negate(is.null), filas)
    if (!length(filas)) vacio else do.call(rbind, filas)
  })
}

#' Ícono de una referencia: círculo navy con su signo en blanco.
#' @keywords internal
.hojas_ruta_mapa_icono <- function(tipo, x, y, r_pt = 5.2, tk = pulso_pdf_tokens()) {
  grid::grid.circle(x = x, y = y, r = grid::unit(r_pt, "pt"),
                    gp = grid::gpar(fill = tk$navy, col = "#ffffff", lwd = 0.8))
  if (identical(tipo, "salud")) {
    b <- grid::unit(r_pt * 0.55, "pt")
    gp <- grid::gpar(col = "#ffffff", lwd = r_pt * 0.38, lineend = "butt")
    grid::grid.segments(grid::unit(x, "npc") - b, grid::unit(y, "npc"), grid::unit(x, "npc") + b, grid::unit(y, "npc"), gp = gp)
    grid::grid.segments(grid::unit(x, "npc"), grid::unit(y, "npc") - b, grid::unit(x, "npc"), grid::unit(y, "npc") + b, gp = gp)
  } else {
    letra <- c(policia = "P", colegio = "C", mercado = "M", iglesia = "I")[[tipo]]
    grid::grid.text(letra, x = x, y = y, gp = grid::gpar(fontsize = r_pt * 1.25, fontface = "bold", col = "#ffffff"))
  }
  invisible(TRUE)
}

# Punto en polígono (par-impar), vectorizado sobre los puntos.
.hojas_ruta_mapa_dentro <- function(lon, lat, rings) {
  dentro <- rep(FALSE, length(lon))
  for (r in rings) {
    r <- as.matrix(r)
    r <- r[stats::complete.cases(r), , drop = FALSE]
    n <- nrow(r)
    if (n < 3L) next
    en_este <- rep(FALSE, length(lon))
    j <- n
    for (i in seq_len(n)) {
      xi <- r[i, 1]; yi <- r[i, 2]; xj <- r[j, 1]; yj <- r[j, 2]
      cruza <- ((yi > lat) != (yj > lat)) & (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      en_este <- xor(en_este, cruza)
      j <- i
    }
    dentro <- xor(dentro, en_este)
  }
  dentro
}

#' Dibuja las referencias que caen en la zona. Llamar dentro del viewport del mapa.
#'
#' Sólo las de adentro de la zona: con todas las del recuadro, en zonas angostas
#' la mayoría caía sobre manzanas que no se visitan y distraía.
#'
#' @param project proyección lon/lat -> npc del viewport del mapa.
#' @param bbox caja visible (`min_lon`, `max_lon`, `min_lat`, `max_lat`).
#' @param zona anillos (lon/lat) de la zona; si viene vacío, vale el recuadro.
#' @param maximo tope de íconos por mapa.
#' @return tipos dibujados (para la leyenda).
#' @keywords internal
.hojas_ruta_mapa_dibujar_referencias <- function(ubigeo, bbox, project, render_ctx = NULL,
                                                 zona = list(), maximo = 24L, separacion = 0.03) {
  refs <- .hojas_ruta_mapa_referencias(ubigeo, render_ctx)
  if (!nrow(refs)) return(character(0))
  dentro <- refs$lon >= bbox[["min_lon"]] & refs$lon <= bbox[["max_lon"]] &
    refs$lat >= bbox[["min_lat"]] & refs$lat <= bbox[["max_lat"]]
  refs <- refs[dentro, , drop = FALSE]
  if (nrow(refs) && length(zona)) refs <- refs[.hojas_ruta_mapa_dentro(refs$lon, refs$lat, zona), , drop = FALSE]
  if (!nrow(refs)) return(character(0))
  refs <- refs[order(match(refs$tipo, names(.hojas_ruta_mapa_referencia_tipos))), , drop = FALSE]
  p <- project(cbind(refs$lon, refs$lat))
  margen <- 0.015
  ok <- p$x > margen & p$x < 1 - margen & p$y > margen & p$y < 1 - margen
  aceptados <- integer(0)
  for (i in which(ok)) {
    if (length(aceptados) >= maximo) break
    if (length(aceptados) &&
        any((p$x[aceptados] - p$x[[i]])^2 + (p$y[aceptados] - p$y[[i]])^2 < separacion^2)) next
    aceptados <- c(aceptados, i)
  }
  for (i in aceptados) .hojas_ruta_mapa_icono(refs$tipo[[i]], p$x[[i]], p$y[[i]])
  unique(refs$tipo[aceptados])
}
