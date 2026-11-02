# Construye `peru_departamentos.geojson` desde Natural Earth admin-1 (1:10m, v5.1.2, dominio público). Ver LEEME.md.
#
# Uso (el archivo crudo NO se versiona; pesa ~40 MB):
#   curl -L -o /tmp/ne/ne_10m_admin_1_states_provinces.geojson \
#     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson
#   Rscript api/inst/cartografia/build_peru_departamentos.R /tmp/ne/ne_10m_admin_1_states_provinces.geojson
#
# Qué hace: toma las 26 unidades del Perú, funde «Lima» y «Lima Province» en el departamento de Lima, asigna el UBIGEO
# de departamento del INEI (2 dígitos), simplifica a ~1.5 km en UTM 18S y redondea a 4 decimales (~11 m).

args <- commandArgs(trailingOnly = TRUE)
origen <- if (length(args)) args[[1]] else stop("Falta la ruta de ne_10m_admin_1_states_provinces.geojson.")
destino <- if (length(args) > 1) args[[2]] else file.path("api", "inst", "cartografia", "peru_departamentos.geojson")
suppressMessages(library(sf))
sf::sf_use_s2(FALSE)

ubigeo <- c(Amazonas = "01", "Áncash" = "02", "Apurímac" = "03", Arequipa = "04", Ayacucho = "05", Cajamarca = "06",
            Callao = "07", Cusco = "08", Huancavelica = "09", "Huánuco" = "10", Ica = "11", "Junín" = "12",
            "La Libertad" = "13", Lambayeque = "14", Lima = "15", Loreto = "16", "Madre de Dios" = "17", Moquegua = "18",
            Pasco = "19", Piura = "20", Puno = "21", "San Martín" = "22", Tacna = "23", Tumbes = "24", Ucayali = "25")

ne <- sf::st_read(origen, quiet = TRUE)
pe <- ne[ne$adm0_a3 == "PER", c("name_es", "geometry")]
pe$departamento <- enc2utf8(as.character(pe$name_es))   # «Lima Province» también se llama «Lima» en name_es
faltan <- setdiff(names(ubigeo), pe$departamento)
if (length(faltan)) stop("Natural Earth no trae: ", paste(faltan, collapse = ", "))
pe <- stats::aggregate(pe["geometry"], by = list(departamento = pe$departamento), FUN = function(x) x[1])
pe <- sf::st_transform(pe, 32718)
pe$geometry <- sf::st_simplify(sf::st_make_valid(pe$geometry), preserveTopology = TRUE, dTolerance = 1500)
pe <- sf::st_transform(pe, 4326)
pe$ubigeo <- unname(ubigeo[pe$departamento])
pe <- pe[order(pe$ubigeo), c("ubigeo", "departamento", "geometry")]
stopifnot(nrow(pe) == 25L, !anyNA(pe$ubigeo))
if (file.exists(destino)) file.remove(destino)
sf::st_write(pe, destino, driver = "GeoJSON", quiet = TRUE, layer_options = c("COORDINATE_PRECISION=4", "RFC7946=YES"))
cat(sprintf("%s: %d departamentos, %.0f KB\n", destino, nrow(pe), file.size(destino) / 1024))
