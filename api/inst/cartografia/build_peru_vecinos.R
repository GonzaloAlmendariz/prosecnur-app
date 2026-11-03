# Construye `peru_vecinos.geojson` desde Natural Earth admin-0 (1:50m, v5.1.2, dominio público). Ver LEEME.md.
#
# Uso (el archivo crudo NO se versiona):
#   curl -L -o /tmp/ne/ne_50m_admin_0_countries.geojson \
#     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
#   Rscript api/inst/cartografia/build_peru_vecinos.R /tmp/ne/ne_50m_admin_0_countries.geojson
#
# Qué hace: toma Ecuador, Colombia, Brasil, Bolivia y Chile, los recorta a una caja alrededor del Perú (lo que el mapa
# puede mostrar como tierra de contexto), simplifica a ~1 km en UTM 18S, redondea a 4 decimales y guarda su nombre en
# español y el punto donde va su rótulo.

args <- commandArgs(trailingOnly = TRUE)
origen <- if (length(args)) args[[1]] else stop("Falta la ruta de ne_50m_admin_0_countries.geojson.")
destino <- if (length(args) > 1) args[[2]] else file.path("api", "inst", "cartografia", "peru_vecinos.geojson")
suppressMessages(library(sf))
sf::sf_use_s2(FALSE)

vecinos <- c(ECU = "Ecuador", COL = "Colombia", BRA = "Brasil", BOL = "Bolivia", CHL = "Chile")
# Dónde va el rótulo de cada país, dentro de la caja del Perú (lon, lat): cerca de la frontera, sobre su tierra.
rotulo <- list(ECU = c(-78.6, -1.6), COL = c(-72.8, 1.3), BRA = c(-68.2, -8.2), BOL = c(-66.4, -15.6), CHL = c(-69.6, -19.6))
caja <- sf::st_as_sfc(sf::st_bbox(c(xmin = -83.5, ymin = -20.5, xmax = -66.0, ymax = 2.0), crs = 4326))

ne <- sf::st_read(origen, quiet = TRUE)
v <- ne[ne$ADM0_A3 %in% names(vecinos), c("ADM0_A3", "geometry")]
if (nrow(v) != length(vecinos)) stop("Natural Earth no trae los cinco vecinos.")
v <- suppressWarnings(sf::st_intersection(sf::st_make_valid(v), caja))
v <- sf::st_transform(v, 32718)
v$geometry <- sf::st_simplify(v$geometry, preserveTopology = TRUE, dTolerance = 1000)
v <- sf::st_transform(v, 4326)
v$pais <- unname(vecinos[v$ADM0_A3])
v$rotulo_lon <- vapply(v$ADM0_A3, function(k) rotulo[[k]][1], 0)
v$rotulo_lat <- vapply(v$ADM0_A3, function(k) rotulo[[k]][2], 0)
v <- v[order(v$pais), c("pais", "rotulo_lon", "rotulo_lat", "geometry")]
if (file.exists(destino)) file.remove(destino)
sf::st_write(v, destino, driver = "GeoJSON", quiet = TRUE, layer_options = c("COORDINATE_PRECISION=4", "RFC7946=YES"))
cat(sprintf("%s: %d países, %.0f KB\n", destino, nrow(v), file.size(destino) / 1024))
