# Geometría compacta de un distrito para el lienzo de Hojas de ruta (ADR 0114 §7).
#
# El lienzo dibuja en Canvas manzanas, vías mayores y zonas censales de varios
# distritos a la vez. Los GeoJSON que sirven block-map, street-map y zone-map
# pesan decenas de MB por distrito y vienen en lon/lat; aquí se reducen a lo que
# el lienzo necesita:
#
# - coordenadas en metros enteros, con un origen común para Lima y Callao, para
#   que los distritos encajen en un mismo mapa sin reproyectar en el front;
# - Douglas-Peucker con tolerancia en metros. Un anillo cerrado se parte en su
#   punto más lejano antes de simplificar: con primer y último punto iguales el
#   algoritmo lo reducía a dos puntos y la manzana desaparecía;
# - el NSE por su nivel en texto. El código numérico del paquete va al revés de
#   lo que se supondría (5 = Bajo), así que no se usa.
#
# La salida se cachea en memoria por ubigeo: armarla cuesta segundos y no cambia
# mientras no cambie el paquete de cartografía.

HOJAS_RUTA_GEOMETRIA_VERSION <- "hojas_ruta_geometria/v1"
HOJAS_RUTA_GEOMETRIA_ORIGEN <- c(lon = -76.99, lat = -12.03)

.hojas_ruta_geometria_cache <- new.env(parent = emptyenv())

.hojas_ruta_geometria_nivel_nse <- function(nivel) {
  codigo <- c("ALTO" = 1L, "MEDIO ALTO" = 2L, "MEDIO" = 3L, "MEDIO BAJO" = 4L, "BAJO" = 5L)
  clave <- toupper(trimws(as.character(nivel %||% "")))
  if (!length(clave) || is.na(clave) || !clave %in% names(codigo)) return(0L)
  unname(codigo[[clave]])
}

# Matriz n×2 de lon/lat a partir de un anillo o una línea de GeoJSON, venga como
# matriz o como lista de pares.
.hojas_ruta_geometria_matriz <- function(coords) {
  if (is.null(coords) || !length(coords)) return(matrix(numeric(0), ncol = 2))
  if (is.matrix(coords)) return(coords[, 1:2, drop = FALSE])
  m <- do.call(rbind, lapply(coords, function(p) as.numeric(unlist(p))[1:2]))
  if (is.null(m)) matrix(numeric(0), ncol = 2) else m
}

.hojas_ruta_geometria_proyectar <- function(m) {
  kx <- 111320 * cos(HOJAS_RUTA_GEOMETRIA_ORIGEN[["lat"]] * pi / 180)
  ky <- 110540
  cbind(
    round((m[, 1] - HOJAS_RUTA_GEOMETRIA_ORIGEN[["lon"]]) * kx),
    round(-(m[, 2] - HOJAS_RUTA_GEOMETRIA_ORIGEN[["lat"]]) * ky)
  )
}

# Douglas-Peucker iterativo sobre una polilínea abierta (matriz n×2).
.hojas_ruta_geometria_dp <- function(p, tol) {
  n <- nrow(p)
  if (n < 4L) return(p)
  keep <- logical(n)
  keep[c(1L, n)] <- TRUE
  pila <- list(c(1L, n))
  while (length(pila)) {
    tramo <- pila[[length(pila)]]
    pila[[length(pila)]] <- NULL
    a <- tramo[[1]]
    b <- tramo[[2]]
    if (b - a < 2L) next
    idx <- (a + 1L):(b - 1L)
    dx <- p[b, 1] - p[a, 1]
    dy <- p[b, 2] - p[a, 2]
    largo <- sqrt(dx * dx + dy * dy)
    d <- if (largo > 0) {
      abs(dy * p[idx, 1] - dx * p[idx, 2] + p[b, 1] * p[a, 2] - p[b, 2] * p[a, 1]) / largo
    } else {
      sqrt((p[idx, 1] - p[a, 1])^2 + (p[idx, 2] - p[a, 2])^2)
    }
    i <- which.max(d)
    if (d[[i]] > tol) {
      m <- idx[[i]]
      keep[m] <- TRUE
      pila[[length(pila) + 1L]] <- c(a, m)
      pila[[length(pila) + 1L]] <- c(m, b)
    }
  }
  p[keep, , drop = FALSE]
}

# Simplifica un anillo o una línea ya proyectados y los aplana a x1,y1,x2,y2…
.hojas_ruta_geometria_simplificar <- function(p, tol) {
  n <- nrow(p)
  if (n < 2L) return(integer(0))
  cerrado <- n > 3L && all(p[1, ] == p[n, ])
  q <- if (cerrado) {
    lejos <- which.max((p[, 1] - p[1, 1])^2 + (p[, 2] - p[1, 2])^2)
    ida <- .hojas_ruta_geometria_dp(p[1:lejos, , drop = FALSE], tol)
    vuelta <- .hojas_ruta_geometria_dp(p[lejos:n, , drop = FALSE], tol)
    rbind(ida, vuelta[-1L, , drop = FALSE])
  } else {
    .hojas_ruta_geometria_dp(p, tol)
  }
  as.integer(as.vector(t(q)))
}

# Anillos exteriores de un Polygon o MultiPolygon.
.hojas_ruta_geometria_anillos <- function(geom, tol) {
  tipo <- geom$type %||% ""
  coords <- geom$coordinates %||% list()
  exteriores <- if (identical(tipo, "Polygon")) list(coords[[1]]) else if (identical(tipo, "MultiPolygon")) lapply(coords, function(poly) poly[[1]]) else list()
  out <- lapply(exteriores, function(r) .hojas_ruta_geometria_simplificar(.hojas_ruta_geometria_proyectar(.hojas_ruta_geometria_matriz(r)), tol))
  Filter(function(r) length(r) >= 6L, out)
}

.hojas_ruta_geometria_lineas <- function(geom, tol) {
  tipo <- geom$type %||% ""
  coords <- geom$coordinates %||% list()
  lineas <- if (identical(tipo, "LineString")) list(coords) else if (identical(tipo, "MultiLineString")) coords else list()
  out <- lapply(lineas, function(l) .hojas_ruta_geometria_simplificar(.hojas_ruta_geometria_proyectar(.hojas_ruta_geometria_matriz(l)), tol))
  Filter(function(l) length(l) >= 4L, out)
}

# Jerarquía de una vía: 2 troncal o primaria, 1 secundaria u otra mayor, 0 local.
.hojas_ruta_geometria_rango_via <- function(props) {
  if (!identical(props$class_group %||% "", "major")) return(0L)
  if ((props$highway %||% "") %in% c("trunk", "primary", "motorway")) 2L else 1L
}

#' Geometría compacta de un distrito para el lienzo de Hojas de ruta
#'
#' Manzanas con viviendas, zona y NSE; vías mayores con su nombre y zonas
#' censales, en metros con origen común. Ver ADR 0114 §7.
#' @noRd
hojas_ruta_geometria_compacta <- function(ubigeo) {
  ubigeo <- .pulso_ceros_izq(6L, as.character(ubigeo %||% ""))
  cache <- .hojas_ruta_geometria_cache[[ubigeo]]
  if (!is.null(cache)) return(cache)

  bloques <- hojas_ruta_block_map_preview(ubigeo, limit = 0L)
  if (!isTRUE(bloques$ok)) {
    return(list(ok = FALSE, version = HOJAS_RUTA_GEOMETRIA_VERSION, ubigeo = ubigeo,
                alerts = bloques$alerts %||% list()))
  }
  feats <- bloques$geojson$features %||% list()
  manzanas <- lapply(feats, function(f) {
    p <- f$properties %||% list()
    list(
      as.character(p$ID_MANZANA %||% p$inei_id_manzana %||% ""),
      as.integer(p$inei_viviendas %||% 0L),
      as.character(p$inei_zona %||% ""),
      .hojas_ruta_geometria_nivel_nse(p$nse_nivel),
      .hojas_ruta_geometria_anillos(f$geometry %||% list(), tol = 1.2)
    )
  })
  manzanas <- Filter(function(m) length(m[[5]]) > 0L, manzanas)

  calles_src <- tryCatch(hojas_ruta_street_map_preview(ubigeo), error = function(e) list(geojson = list(features = list())))
  calles <- list()
  for (f in calles_src$geojson$features %||% list()) {
    props <- f$properties %||% list()
    rango <- .hojas_ruta_geometria_rango_via(props)
    if (rango == 0L) next
    lineas <- .hojas_ruta_geometria_lineas(f$geometry %||% list(), tol = 2)
    if (!length(lineas)) next
    nombre <- as.character(props$name_es %||% "")
    calles[[length(calles) + 1L]] <- list(rango, if (nzchar(nombre) && !identical(nombre, "SN")) as.character(props$display_name %||% nombre) else "", lineas)
  }

  zonas_src <- tryCatch(hojas_ruta_zone_map_preview(ubigeo), error = function(e) list(geojson = list(features = list())))
  zonas <- lapply(zonas_src$geojson$features %||% list(), function(f) {
    p <- f$properties %||% list()
    list(as.character(p$CODZONA %||% p$codzona %||% ""), .hojas_ruta_geometria_anillos(f$geometry %||% list(), tol = 3))
  })
  zonas <- Filter(function(z) length(z[[2]]) > 0L, zonas)

  xs <- unlist(lapply(manzanas, function(m) lapply(m[[5]], function(r) r[c(TRUE, FALSE)])))
  ys <- unlist(lapply(manzanas, function(m) lapply(m[[5]], function(r) r[c(FALSE, TRUE)])))
  out <- list(
    ok = TRUE,
    version = HOJAS_RUTA_GEOMETRIA_VERSION,
    ubigeo = ubigeo,
    nombre = as.character(bloques$territory$distrito %||% ubigeo),
    origen = as.list(HOJAS_RUTA_GEOMETRIA_ORIGEN),
    bbox = if (length(xs)) c(min(xs), min(ys), max(xs), max(ys)) else c(0, 0, 0, 0),
    manz = manzanas,
    calles = calles,
    zonas = zonas,
    fuente = list(manzanas = bloques$source$source %||% NULL, calles = calles_src$source$source %||% NULL, zonas = zonas_src$source$source %||% NULL)
  )
  assign(ubigeo, out, envir = .hojas_ruta_geometria_cache)
  out
}

# Firma de los paquetes de entrada: si cambia la cartografía empaquetada, cambia
# el nombre del archivo de caché y el resultado se rearma.
.hojas_ruta_geometria_firma <- function(ubigeo) {
  perfil <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  entradas <- c(
    if (!is.null(perfil)) .hojas_ruta_block_map_packaged_file(perfil, ubigeo),
    .hojas_ruta_street_map_packaged_file(ubigeo, source = "inei"),
    .hojas_ruta_street_map_packaged_file(ubigeo, source = "osm")
  )
  info <- file.info(entradas[file.exists(entradas)])
  sprintf("%s_%d", ubigeo, as.integer(sum(as.numeric(info$mtime), info$size) %% 1e9))
}

.hojas_ruta_geometria_archivo <- function(ubigeo) {
  dir <- file.path(hojas_ruta_cache_dir(), "geometria_v1")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  file.path(dir, paste0(.hojas_ruta_geometria_firma(ubigeo), ".json.gz"))
}

#' JSON de la geometría compacta, con caché en disco
#'
#' Leer la capa vial empaquetada cuesta ~14 s por distrito (Ate, medido el
#' 2026-10-29); el resultado compacto se guarda gzip en la caché de cartografía
#' y las siguientes lecturas lo devuelven tal cual.
#' @noRd
hojas_ruta_geometria_compacta_json <- function(ubigeo) {
  ubigeo <- .pulso_ceros_izq(6L, as.character(ubigeo %||% ""))
  archivo <- .hojas_ruta_geometria_archivo(ubigeo)
  if (file.exists(archivo)) {
    con <- gzfile(archivo, "rb")
    on.exit(close(con), add = TRUE)
    return(paste(readLines(con, warn = FALSE, encoding = "UTF-8"), collapse = "\n"))
  }
  geo <- hojas_ruta_geometria_compacta(ubigeo)
  json <- as.character(jsonlite::toJSON(geo, auto_unbox = TRUE, null = "null", digits = NA))
  if (isTRUE(geo$ok)) {
    tmp <- paste0(archivo, ".tmp")
    con <- gzfile(tmp, "wb")
    writeLines(json, con, useBytes = TRUE)
    close(con)
    file.rename(tmp, archivo)
  }
  json
}
