# Construye `lima_zona.geojson`: Lima Metropolitana, el Callao y Lima provincias recortados de la misma forma, para que
# encajen en el mapa del Perú y como tierra de contexto en el de Lima. Ver LEEME.md.
#
# Uso (desde la raíz del repositorio; no descarga nada):
#   Rscript api/inst/cartografia/build_lima_zona.R
#
# La costa de Natural Earth (departamentos) y la de los distritos del IMP no coinciden. Por eso:
#   - Lima Metropolitana = unión de los distritos de la provincia de Lima (`lima_district_coverage.json`);
#   - Callao = unión de los distritos del Callao;
#   - Lima provincias = departamento de Lima (Natural Earth) menos la unión de los dos, quedándose sólo con las piezas de
#     más de 20 km²: la diferencia deja cientos de astillas costeras y sólo una pieza es real.
# Todo en plano (sin s2) y simplificado a 60 m en UTM 18S; coordenadas a 5 decimales.

suppressMessages(library(sf))
sf::sf_use_s2(FALSE)
raiz <- file.path("api", "inst")
dist <- sf::st_read(file.path(raiz, "hojas_ruta", "cartografia", "lima_district_coverage.json"), quiet = TRUE)
dep <- sf::st_read(file.path(raiz, "cartografia", "peru_departamentos.geojson"), quiet = TRUE)
destino <- file.path(raiz, "cartografia", "lima_zona.geojson")

utm <- function(x) sf::st_transform(sf::st_make_valid(x), 32718)
dist <- utm(dist); dep <- utm(dep)
callao_d <- toupper(dist$provincia) == "CALLAO"
metro <- sf::st_union(sf::st_geometry(dist[!callao_d, ]))
callao <- sf::st_union(sf::st_geometry(dist[callao_d, ]))
lima_dep <- sf::st_union(sf::st_geometry(dep[dep$ubigeo == "15", ]))
prov <- sf::st_difference(lima_dep, sf::st_union(metro, callao))
piezas <- sf::st_cast(sf::st_collection_extract(prov, "POLYGON"), "POLYGON")
area_km2 <- as.numeric(sf::st_area(piezas)) / 1e6
cat(sprintf("Lima provincias: %d piezas, %d de más de 20 km²\n", length(piezas), sum(area_km2 > 20)))
prov <- sf::st_union(piezas[area_km2 > 20])

zona <- sf::st_sf(clave = c("15M", "07", "15P"), nombre = c("Lima Metropolitana", "Callao", "Lima provincias"),
                  geometry = sf::st_simplify(c(metro, callao, prov), preserveTopology = TRUE, dTolerance = 60))
zona <- sf::st_transform(zona, 4326)
if (file.exists(destino)) file.remove(destino)
sf::st_write(zona, destino, driver = "GeoJSON", quiet = TRUE, layer_options = c("COORDINATE_PRECISION=5", "RFC7946=YES"))
cat(sprintf("%s: %d áreas, %.0f KB\n", destino, nrow(zona), file.size(destino) / 1024))
