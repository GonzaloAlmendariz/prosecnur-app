#!/usr/bin/env Rscript
# Contornos de los distritos de las ciudades principales (ADR 0119) para el
# lienzo de Hojas de ruta. Fuera de Lima y Callao no hay capa de límites
# distritales: el contorno es la HUELLA URBANA censada de cada distrito, la
# unión de sus manzanas INEI 2017 (cartografia/manzanas_inei2017_ciudades),
# cerrada y simplificada. Encierra justo el marco del que se sortea, no el
# límite político, y así se rotula (`fuente`).
#
# Uso:
#   Rscript api/inst/hojas_ruta/build_contornos_ciudades.R
# Variables:
#   HOJAS_RUTA_CONTORNOS_OUT  archivo de salida (por defecto
#                             frontend/src/features/hojasRuta/ciudadesDistrictCoverage.json)
#
# Mismo esquema que limaDistrictCoverage.json (ubigeo, distrito, provincia,
# departamento, label_lon, label_lat). Determinista: distritos por ubigeo y 4
# decimales (~11 m, de sobra para el lienzo).

options(stringsAsFactors = FALSE, warn = 1)
for (pkg in c("sf", "jsonlite")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
}
`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
src_dir <- file.path(script_dir, "cartografia", "manzanas_inei2017_ciudades")
out <- Sys.getenv("HOJAS_RUTA_CONTORNOS_OUT",
                  file.path(repo_root, "frontend", "src", "features", "hojasRuta", "ciudadesDistrictCoverage.json"))

CIERRE_M <- 90     # une manzanas separadas por una calle o una avenida
SIMPLIFICA_M <- 25
PARTE_MIN_M2 <- 30000   # caseríos sueltos de una o dos manzanas: ensucian el contorno, no orientan
HUECO_MIN_M2 <- 250000  # parques o cerros dentro de la huella: sólo se conservan los grandes

sf::sf_use_s2(FALSE)
utm_de <- function(lon, lat) (if (lat < 0) 32700L else 32600L) + as.integer(floor((lon + 180) / 6) + 1)

sin_huecos_chicos <- function(g) {
  polis <- sf::st_cast(sf::st_sfc(g, crs = sf::st_crs(g)), "POLYGON")
  area <- as.numeric(sf::st_area(polis))
  # Siempre queda al menos la parte mayor.
  polis <- polis[area >= PARTE_MIN_M2 | area == max(area)]
  partes <- lapply(polis, function(p) {
    anillos <- unclass(p)
    if (length(anillos) > 1L) {
      area <- vapply(anillos[-1], function(r) abs(sf::st_area(sf::st_polygon(list(r)))), numeric(1))
      anillos <- c(anillos[1], anillos[-1][area >= HUECO_MIN_M2])
    }
    sf::st_polygon(anillos)
  })
  sf::st_multipolygon(lapply(partes, unclass))
}

archivos <- sort(list.files(src_dir, pattern = "\\.geojson\\.gz$", full.names = TRUE))
features <- lapply(archivos, function(f) {
  mz <- sf::st_read(paste0("/vsigzip/", f), quiet = TRUE)
  mz <- sf::st_make_valid(mz)
  props <- sf::st_drop_geometry(mz)[1, , drop = FALSE]
  bb <- sf::st_bbox(mz)
  crs <- utm_de(mean(bb[c("xmin", "xmax")]), mean(bb[c("ymin", "ymax")]))
  g <- sf::st_transform(sf::st_geometry(mz), crs)
  g <- sf::st_union(sf::st_buffer(g, CIERRE_M / 2))
  g <- sf::st_buffer(g, -CIERRE_M / 2)
  g <- sf::st_simplify(g, dTolerance = SIMPLIFICA_M, preserveTopology = TRUE)
  g <- sin_huecos_chicos(g[[1]])
  g <- sf::st_sfc(g, crs = crs)
  # El rótulo cae dentro de la parte mayor, no en el centroide de un distrito partido.
  mayor <- sf::st_cast(g, "POLYGON")
  mayor <- mayor[which.max(as.numeric(sf::st_area(mayor)))]
  rotulo <- sf::st_coordinates(sf::st_transform(sf::st_point_on_surface(mayor), 4326))
  g <- sf::st_transform(g, 4326)
  coords <- lapply(sf::st_cast(g, "POLYGON"), function(p) lapply(unclass(p), function(r) round(r[, 1:2], 4)))
  list(
    type = "Feature",
    properties = list(
      ubigeo = as.character(props$UBIGEO),
      distrito = as.character(props$NOMBDIST),
      provincia = as.character(props$NOMBPROV),
      departamento = as.character(props$NOMBDEP),
      fuente = "Huella urbana: unión de manzanas INEI CPV 2017",
      label_lon = round(rotulo[1, 1], 5),
      label_lat = round(rotulo[1, 2], 5)
    ),
    geometry = if (length(coords) == 1L) list(type = "Polygon", coordinates = coords[[1]])
               else list(type = "MultiPolygon", coordinates = coords)
  )
})
features <- features[order(vapply(features, function(x) x$properties$ubigeo, ""))]
fc <- list(type = "FeatureCollection", features = features)
writeLines(jsonlite::toJSON(fc, auto_unbox = TRUE, digits = NA), out, useBytes = TRUE)
cat(sprintf("%d distritos -> %s (%.0f KB)\n", length(features), out, file.size(out) / 1024))
