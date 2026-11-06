#!/usr/bin/env Rscript
# Límites del Perú para el lienzo de Hojas de ruta: el contorno del país, los 26
# departamentos (25 más Lima Metropolitana como en la fuente) y las 196
# provincias, para ubicar una ciudad en el mapa nacional (ADR 0119).
#
# Fuentes (geoBoundaries, versiones fijadas por commit):
#   - Provincias (ADM2): Instituto Geográfico Nacional - IGN, vía OCHA ROLAC,
#     licencia CC BY 3.0 IGO (exige citar la fuente; va en `fuente`).
#   - Departamentos (ADM1): Wikimedia Commons, dominio público. Sólo se usa para
#     saber a qué departamento pertenece cada provincia; el trazo de los
#     departamentos y del país sale de unir provincias, para que las tres capas
#     calcen línea con línea.
#
# Uso:
#   Rscript api/inst/hojas_ruta/build_limites_peru.R
# Variables:
#   HOJAS_RUTA_LIMITES_OUT  archivo de salida (por defecto
#                           frontend/src/features/hojasRuta/limitesPeru.json)

options(stringsAsFactors = FALSE, warn = 1)
for (pkg in c("sf", "jsonlite")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
}
`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
out <- Sys.getenv("HOJAS_RUTA_LIMITES_OUT", file.path(repo_root, "frontend", "src", "features", "hojasRuta", "limitesPeru.json"))

URL_ADM2 <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PER/ADM2/geoBoundaries-PER-ADM2_simplified.geojson"
URL_ADM1 <- "https://github.com/wmgeolab/geoBoundaries/raw/90a1d52/releaseData/gbOpen/PER/ADM1/geoBoundaries-PER-ADM1_simplified.geojson"
FUENTE <- "Provincias: Instituto Geográfico Nacional (IGN) vía OCHA ROLAC, CC BY 3.0 IGO · geoBoundaries"
SIMPLIFICA_M <- 1200  # a escala de país o de departamento no se lee menos
CRS_PLANO <- 32718    # UTM 18S: deforma poco en todo el Perú para simplificar

sf::sf_use_s2(FALSE)
leer <- function(url) {
  f <- tempfile(fileext = ".geojson")
  utils::download.file(url, f, quiet = TRUE, mode = "wb")
  sf::st_make_valid(sf::st_read(f, quiet = TRUE))
}
prov <- leer(URL_ADM2)
dep <- leer(URL_ADM1)

# Departamento de cada provincia: el que contiene un punto interior de ella.
pto <- sf::st_point_on_surface(sf::st_geometry(prov))
idx <- vapply(sf::st_intersects(pto, dep), function(i) if (length(i)) i[[1]] else NA_integer_, integer(1))
if (anyNA(idx)) stop("Provincias sin departamento: ", paste(prov$shapeName[is.na(idx)], collapse = ", "), call. = FALSE)
prov$departamento <- dep$shapeName[idx]
# La fuente trae nombres con doble codificación («CaÃ±ete»): se reparan.
mal <- grepl("\u00c3", prov$shapeName)
prov$shapeName[mal] <- vapply(prov$shapeName[mal], function(x) { y <- iconv(x, "UTF-8", "latin1"); Encoding(y) <- "UTF-8"; y }, "")
# Departamentos como se usan en campo: Lima Metropolitana es parte de Lima, y el
# punto interior del Callao cae del lado de Lima en la capa ADM1, más gruesa.
prov$departamento[prov$departamento == "Municipalidad Metropolitana de Lima"] <- "Lima"
prov$departamento[prov$shapeName == "Callao"] <- "Callao"

plano <- sf::st_transform(prov, CRS_PLANO)
plano <- sf::st_simplify(plano, dTolerance = SIMPLIFICA_M, preserveTopology = TRUE)
nombres_dep <- sort(unique(plano$departamento))
geo_dep <- do.call(c, lapply(nombres_dep, function(d) sf::st_union(sf::st_buffer(sf::st_geometry(plano)[plano$departamento == d], 1))))
deps <- sf::st_sf(departamento = nombres_dep, geometry = sf::st_simplify(geo_dep, dTolerance = SIMPLIFICA_M / 2))
pais <- sf::st_simplify(sf::st_union(sf::st_buffer(sf::st_geometry(plano), 1)), dTolerance = SIMPLIFICA_M / 2)

anillos <- function(g) {
  g <- sf::st_transform(g, 4326)
  lapply(sf::st_cast(sf::st_cast(g, "MULTIPOLYGON"), "POLYGON"), function(p) round(unclass(p)[[1]][, 1:2], 3))
}
rotulo <- function(g) {
  partes <- sf::st_cast(sf::st_cast(g, "MULTIPOLYGON"), "POLYGON")
  mayor <- partes[which.max(as.numeric(sf::st_area(partes)))]
  round(as.numeric(sf::st_coordinates(sf::st_transform(sf::st_point_on_surface(mayor), 4326))), 3)
}

orden_p <- order(plano$departamento, plano$shapeName)
salida <- list(
  fuente = FUENTE,
  pais = anillos(pais),
  departamentos = lapply(order(deps$departamento), function(i) {
    g <- sf::st_geometry(deps)[i]
    list(nombre = deps$departamento[[i]], rotulo = rotulo(g), anillos = anillos(g))
  }),
  provincias = lapply(orden_p, function(i) {
    g <- sf::st_geometry(plano)[i]
    list(nombre = plano$shapeName[[i]], departamento = plano$departamento[[i]], anillos = anillos(g))
  })
)
writeLines(jsonlite::toJSON(salida, auto_unbox = TRUE, digits = NA), out, useBytes = TRUE)
cat(sprintf("%d departamentos, %d provincias -> %s (%.0f KB)\n", length(salida$departamentos), length(salida$provincias), out, file.size(out) / 1024))
