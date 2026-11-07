#!/usr/bin/env Rscript
# Límites del Perú para el lienzo de Hojas de ruta: el contorno del país, los 25
# departamentos y las 196 provincias, para ubicar una ciudad en el mapa nacional
# (ADR 0119).
#
# Fuentes (geoBoundaries, versiones fijadas por commit):
#   - Provincias (ADM2, resolución completa): Instituto Geográfico Nacional - IGN,
#     vía OCHA ROLAC, licencia CC BY 3.0 IGO (exige citar la fuente; va en `fuente`).
#   - Departamentos (ADM1): Wikimedia Commons, dominio público. Sólo se usa para
#     saber a qué departamento pertenece cada provincia; el trazo de los
#     departamentos y del país sale de unir provincias.
#
# Simplificación con topología compartida (mapshaper): cada frontera se simplifica
# UNA vez y la usan los dos lados, y departamentos y país salen de disolver las
# provincias ya simplificadas. Simplificar cada polígono por su cuenta (sf::st_simplify)
# deja la frontera de Ayacucho distinta de la de Apurímac: dos líneas que no calzan.
#
# Dos niveles, del mismo pipeline:
#   - fino (INTERVALO_FINO): país, departamentos y provincias; se dibuja con una
#     región o un departamento en pantalla.
#   - nacional (INTERVALO_NACIONAL): país y departamentos para ver el Perú entero.
#
# Requiere node y descarga mapshaper fijado por versión (npx).
#
# Uso:
#   Rscript api/inst/hojas_ruta/build_limites_peru.R
#   Rscript api/inst/hojas_ruta/build_contornos_por_region.R   # reparte y escribe los JSON del bundle
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

URL_ADM2 <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PER/ADM2/geoBoundaries-PER-ADM2.geojson"
URL_ADM1 <- "https://github.com/wmgeolab/geoBoundaries/raw/90a1d52/releaseData/gbOpen/PER/ADM1/geoBoundaries-PER-ADM1_simplified.geojson"
FUENTE <- "Provincias: Instituto Geográfico Nacional (IGN) vía OCHA ROLAC, CC BY 3.0 IGO · geoBoundaries"
MAPSHAPER <- "mapshaper@0.6.102"
# Metros. Con un departamento en pantalla (~500 m por píxel) 400 m no se ven; a escala país, 3 km tampoco.
INTERVALO_FINO <- 400
INTERVALO_NACIONAL <- 3000
CRS_PLANO <- "EPSG:32718"  # UTM 18S: deforma poco en todo el Perú para simplificar

sf::sf_use_s2(FALSE)
leer <- function(url) {
  f <- tempfile(fileext = ".geojson")
  utils::download.file(url, f, quiet = TRUE, mode = "wb")
  sf::st_make_valid(sf::st_read(f, quiet = TRUE))
}
prov <- leer(URL_ADM2)
dep <- leer(URL_ADM1)

# Departamento de cada provincia: el que contiene un punto interior de ella.
pto <- suppressWarnings(sf::st_point_on_surface(sf::st_geometry(prov)))
idx <- vapply(suppressMessages(sf::st_intersects(pto, dep)), function(i) if (length(i)) i[[1]] else NA_integer_, integer(1))
if (anyNA(idx)) stop("Provincias sin departamento: ", paste(prov$shapeName[is.na(idx)], collapse = ", "), call. = FALSE)
prov$departamento <- dep$shapeName[idx]
# La fuente trae nombres con doble codificación («CaÃ±ete»): se reparan.
mal <- grepl("Ã", prov$shapeName)
prov$shapeName[mal] <- vapply(prov$shapeName[mal], function(x) { y <- iconv(x, "UTF-8", "latin1"); Encoding(y) <- "UTF-8"; y }, "")
# Departamentos como se usan en campo: Lima Metropolitana es parte de Lima, y el
# punto interior del Callao cae del lado de Lima en la capa ADM1, más gruesa.
prov$departamento[prov$departamento == "Municipalidad Metropolitana de Lima"] <- "Lima"
prov$departamento[prov$shapeName == "Callao"] <- "Callao"
prov <- prov[, c("shapeName", "departamento")]
names(prov)[names(prov) == "shapeName"] <- "nombre"

entrada <- tempfile(fileext = ".geojson")
sf::st_write(prov, entrada, quiet = TRUE)

# Provincias simplificadas con topología compartida y, de ellas, departamentos y país disueltos.
simplificar <- function(intervalo, islas_km2) {
  dir <- tempfile("limites_")
  dir.create(dir)
  args <- c(
    "--yes", MAPSHAPER,
    "-i", shQuote(entrada), "name=provincias",
    "-clean",
    "-proj", CRS_PLANO,
    "-simplify", paste0("interval=", intervalo), "keep-shapes",
    "-filter-islands", paste0("min-area=", islas_km2, "km2"), "remove-empty",
    "-proj", "wgs84",
    "-dissolve", "departamento", "+", "name=departamentos",
    "-dissolve", "target=provincias", "+", "name=pais",
    "-o", shQuote(paste0(dir, "/")), shQuote("target=*"), "format=geojson", "precision=0.001"
  )
  status <- system2("npx", args, stdout = FALSE, stderr = FALSE)
  if (!identical(status, 0L)) stop("mapshaper falló (", MAPSHAPER, "); ¿hay node y red?", call. = FALSE)
  lapply(c(provincias = "provincias", departamentos = "departamentos", pais = "pais"), function(capa) {
    sf::st_read(file.path(dir, paste0(capa, ".json")), quiet = TRUE)
  })
}

anillos <- function(g) {
  partes <- sf::st_cast(sf::st_cast(sf::st_geometry(g), "MULTIPOLYGON"), "POLYGON")
  # Sólo el anillo exterior: el lienzo traza contornos, no rellena huecos.
  lapply(partes, function(p) round(unclass(p)[[1]][, 1:2], 3))
}
rotulo <- function(g) {
  partes <- sf::st_transform(sf::st_cast(sf::st_cast(sf::st_geometry(g), "MULTIPOLYGON"), "POLYGON"), CRS_PLANO)
  mayor <- partes[which.max(as.numeric(sf::st_area(partes)))]
  round(as.numeric(sf::st_coordinates(sf::st_transform(sf::st_point_on_surface(mayor), 4326))), 3)
}
departamentos <- function(capa, con_rotulo = TRUE) {
  capa <- capa[order(capa$departamento), ]
  lapply(seq_len(nrow(capa)), function(i) {
    g <- capa[i, ]
    c(list(nombre = capa$departamento[[i]]), if (con_rotulo) list(rotulo = rotulo(g)), list(anillos = anillos(g)))
  })
}

fino <- simplificar(INTERVALO_FINO, 1)
nacional <- simplificar(INTERVALO_NACIONAL, 20)  # islas de menos de 20 km² no se leen a escala país

orden_p <- order(fino$provincias$departamento, fino$provincias$nombre)
salida <- list(
  fuente = FUENTE,
  pais = anillos(fino$pais),
  departamentos = departamentos(fino$departamentos),
  provincias = lapply(orden_p, function(i) {
    list(nombre = fino$provincias$nombre[[i]], departamento = fino$provincias$departamento[[i]], anillos = anillos(fino$provincias[i, ]))
  }),
  # El rótulo de cada departamento es el del nivel fino: el nombre no salta al cambiar de nivel.
  nacional = list(pais = anillos(nacional$pais), departamentos = departamentos(nacional$departamentos, con_rotulo = FALSE))
)
writeLines(jsonlite::toJSON(salida, auto_unbox = TRUE, digits = NA), out, useBytes = TRUE)
cat(sprintf("%d departamentos, %d provincias -> %s (%.0f KB)\n", length(salida$departamentos), length(salida$provincias), out, file.size(out) / 1024))
