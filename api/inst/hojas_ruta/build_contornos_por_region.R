#!/usr/bin/env Rscript
# Contornos del lienzo de Hojas de ruta partidos por región (paquete
# docs/qa/plan-territorio-por-regiones-2026-10-29.md, R1). El lienzo deja de
# cargar 1,67 MB de geometría de golpe: sólo el país y sus departamentos van en el
# bundle, y cada región marcada pide su archivo.
#
# Entradas (generadas por sus propios scripts):
#   - frontend/src/features/hojasRuta/limaDistrictCoverage.json   (Lima y Callao, IMP)
#   - frontend/src/features/hojasRuta/ciudadesDistrictCoverage.json (build_contornos_ciudades.R)
#   - frontend/src/features/hojasRuta/limitesPeru.json            (build_limites_peru.R)
# Salidas:
#   - api/inst/hojas_ruta/contornos/<región>.json.gz: distritos de las ciudades de la
#     región (mismo esquema de propiedades que las entradas) y sus provincias.
#   - frontend/src/features/hojasRuta/peruDepartamentos.json: país y departamentos con
#     su código, simplificados para leerse a escala nacional (presupuesto 60 KB).
#
# Uso: Rscript api/inst/hojas_ruta/build_contornos_por_region.R
# Determinista: regiones y distritos ordenados por código, gzip sin marca de tiempo.

options(stringsAsFactors = FALSE, warn = 1)
for (pkg in c("sf", "jsonlite")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
}
`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
front <- file.path(repo_root, "frontend", "src", "features", "hojasRuta")
out_dir <- file.path(script_dir, "contornos")
out_peru <- file.path(front, "peruDepartamentos.json")

# Códigos de departamento del INEI (dos primeros dígitos del ubigeo).
DEPARTAMENTOS <- c(
  "01" = "Amazonas", "02" = "Áncash", "03" = "Apurímac", "04" = "Arequipa", "05" = "Ayacucho",
  "06" = "Cajamarca", "07" = "Callao", "08" = "Cusco", "09" = "Huancavelica", "10" = "Huánuco",
  "11" = "Ica", "12" = "Junín", "13" = "La Libertad", "14" = "Lambayeque", "15" = "Lima",
  "16" = "Loreto", "17" = "Madre de Dios", "18" = "Moquegua", "19" = "Pasco", "20" = "Piura",
  "21" = "Puno", "22" = "San Martín", "23" = "Tacna", "24" = "Tumbes", "25" = "Ucayali"
)
# Sin tildes a mano: iconv //TRANSLIT de macOS deja «'A» en vez de «A».
clave <- function(s) toupper(gsub("^EL\\s+", "", chartr("ÁÉÍÓÚÜÑáéíóúüñ", "AEIOUUNaeiouun", trimws(s))))
codigo_de <- function(nombre) {
  hit <- names(DEPARTAMENTOS)[clave(DEPARTAMENTOS) == clave(nombre)]
  if (!length(hit)) stop("Departamento sin código: ", nombre, call. = FALSE)
  hit[[1]]
}

leer <- function(f) jsonlite::read_json(f, simplifyVector = FALSE)
lima <- leer(file.path(front, "limaDistrictCoverage.json"))
ciudades <- leer(file.path(front, "ciudadesDistrictCoverage.json"))
limites <- leer(file.path(front, "limitesPeru.json"))

# Distritos: sólo las propiedades que el lienzo y el PDF usan.
PROPS <- c("ubigeo", "distrito", "provincia", "departamento", "fuente", "label_lon", "label_lat")
distrito <- function(f, fuente_defecto) {
  p <- f$properties
  p$fuente <- p$fuente %||% fuente_defecto
  p <- p[intersect(PROPS, names(p))]
  p$ubigeo <- sprintf("%06s", as.character(p$ubigeo))
  list(type = "Feature", properties = p, geometry = f$geometry)
}
distritos <- c(
  lapply(lima$features, distrito, fuente_defecto = "IMP PlanMet 2040"),
  lapply(ciudades$features, distrito, fuente_defecto = "Huella urbana: unión de manzanas INEI CPV 2017")
)
region_de <- vapply(distritos, function(f) substr(f$properties$ubigeo, 1, 2), "")

provincias <- limites$provincias
prov_region <- vapply(provincias, function(p) codigo_de(p$departamento), "")

dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
old <- list.files(out_dir, pattern = "\\.json\\.gz$", full.names = TRUE)
regiones <- sort(unique(region_de))
for (r in regiones) {
  ds <- distritos[region_de == r]
  ds <- ds[order(vapply(ds, function(f) f$properties$ubigeo, ""))]
  salida <- list(
    region = r,
    nombre = unname(DEPARTAMENTOS[[r]]),
    fuente_provincias = limites$fuente,
    distritos = list(type = "FeatureCollection", features = ds),
    provincias = lapply(provincias[prov_region == r], function(p) list(nombre = p$nombre, anillos = p$anillos))
  )
  txt <- jsonlite::toJSON(salida, auto_unbox = TRUE, digits = NA)
  tmp <- tempfile(fileext = ".json")
  writeLines(txt, tmp, useBytes = TRUE)
  dest <- file.path(out_dir, paste0(r, ".json.gz"))
  # gzip -n: sin nombre ni fecha en la cabecera, para que el archivo no cambie si los datos no cambian.
  status <- system2("gzip", c("-n", "-9", "-c", shQuote(tmp)), stdout = dest)
  if (!identical(status, 0L)) stop("gzip falló para la región ", r, call. = FALSE)
}
sobran <- setdiff(basename(old), paste0(regiones, ".json.gz"))
if (length(sobran)) unlink(file.path(out_dir, sobran))

# País y departamentos para el bundle: simplificados para escala nacional.
sf::sf_use_s2(FALSE)
CRS_PLANO <- 32718
poligono <- function(anillos) {
  rings <- lapply(anillos, function(r) { m <- do.call(rbind, lapply(r, function(p) as.numeric(unlist(p)))); if (!all(m[1, ] == m[nrow(m), ])) m <- rbind(m, m[1, ]); m })
  sf::st_multipolygon(lapply(rings, function(r) list(r)))
}
simplificar <- function(anillos, tol) {
  g <- sf::st_transform(sf::st_sfc(poligono(anillos), crs = 4326), CRS_PLANO)
  g <- sf::st_simplify(sf::st_buffer(g, 0), dTolerance = tol, preserveTopology = TRUE)
  g <- sf::st_transform(g, 4326)
  partes <- sf::st_cast(sf::st_cast(g, "MULTIPOLYGON"), "POLYGON")
  area <- as.numeric(sf::st_area(sf::st_transform(partes, CRS_PLANO)))
  partes <- partes[area >= 2e7 | area == max(area)]  # islas de menos de 20 km² no se leen a escala país
  lapply(partes, function(p) round(unclass(p)[[1]][, 1:2], 2))
}
peru <- list(
  fuente = limites$fuente,
  pais = simplificar(limites$pais, 3000),
  departamentos = lapply(limites$departamentos, function(d) {
    list(codigo = codigo_de(d$nombre), nombre = d$nombre, rotulo = d$rotulo, anillos = simplificar(d$anillos, 3000))
  })
)
peru$departamentos <- peru$departamentos[order(vapply(peru$departamentos, `[[`, "", "codigo"))]
writeLines(jsonlite::toJSON(peru, auto_unbox = TRUE, digits = NA), out_peru, useBytes = TRUE)

pesos <- file.size(file.path(out_dir, paste0(regiones, ".json.gz")))
cat(sprintf("%d regiones -> %s (%.0f KB gzip en total, máx %.0f KB)\n", length(regiones), out_dir, sum(pesos) / 1024, max(pesos) / 1024))
cat(sprintf("país + %d departamentos -> %s (%.0f KB)\n", length(peru$departamentos), out_peru, file.size(out_peru) / 1024))
