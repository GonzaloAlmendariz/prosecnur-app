#!/usr/bin/env Rscript
# Builds the INEI 2017 block layers for the main cities outside Lima/Callao
# (ADR 0119): block polygons + NSE from the GeoPeru national layer, and
# dwellings/population per block from REDATAM CPV 2017.
#
# Uso:
#   Rscript api/inst/hojas_ruta/build_inei2017_ciudades.R
# Variables:
#   HOJAS_RUTA_GEOPERU_ESTRATO   carpeta o .zip de peru_estrato_nacional_ (si falta, se descarga)
#   HOJAS_RUTA_CIUDADES_OUT      carpeta de salida (por defecto tmp/hojas_ruta_ciudades del repo)
#   HOJAS_RUTA_REDDATAM_MANZANA_CACHE  cache de tablas REDATAM (por defecto tmp/redatam_manzana_cache)
#   HOJAS_RUTA_CIUDADES_PROVINCIAS  códigos de provincia separados por coma; por defecto los niveles 1 y 2
#                                   del ADR 0119 §1; «todas» construye las 71 provincias de la capa
#   HOJAS_RUTA_CIUDADES_DISTRITOS  lista de ubigeos separados por coma, para correr un subconjunto
#
# La salida es determinista: filas ordenadas por id, 6 decimales y gzip sin marca de tiempo.
#
# La edad simple 2017 de las ciudades (capa `edad`) se extrae aparte, porque son 114 consultas
# REDATAM más; el registro la incluye si el archivo existe en la salida:
#   HOJAS_RUTA_INEI_FRAME=<salida>/inei2017_ciudades_manzanas.csv.gz \
#   HOJAS_RUTA_INEI_AGE_OUT=<tmp>/edad.csv Rscript api/inst/hojas_ruta/extract_inei2017_age_simple.R
# y luego, sin `fetched_at` ni `redatam_table_url` (cambian en cada corrida), ordenado por
# ubigeo, sexo y edad, a <salida>/inei2017_ciudades_edad_simple_distrito.csv.gz con `gzip -n`.

options(stringsAsFactors = FALSE, warn = 1)

for (pkg in c("sf", "jsonlite", "curl", "xml2")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
}

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)

GEOPERU_URL <- "https://descargas.geoperu.gob.pe/peru_estrato_nacional_.zip"
FUENTE_NSE <- "GeoPeru/IDEP - INEI, Ingreso per capita del Hogar (peru_estrato_nacional_)"
FUENTE_MARCO <- "INEI REDATAM CPV 2017, base de manzana (Vivienda.C2P2, Poblacio.SEXO)"
ANIO_DATO <- 2017L
CPV2025_URL <- "https://redatamcpv2025.inei.gob.pe"
FUENTE_REFERENCIA <- "INEI CPV 2025, REDATAM base CPV2025DI (población censada por distrito)"
VERSION_MANZANAS <- "inei2017-ciudades-manzanas-v1"
VERSION_MARCO <- "inei2017-ciudades-marco-v1"
VERSION_NSE <- "nse-geoperu-inei-ciudades-manzanas-v1"
DIR_MANZANAS <- "manzanas_inei2017_ciudades"
ARCHIVO_MARCO <- "inei2017_ciudades_manzanas.csv.gz"
ARCHIVO_NSE <- "nse_geoperu_inei_ciudades_manzanas.csv.gz"
ARCHIVO_EDAD <- "inei2017_ciudades_edad_simple_distrito.csv.gz"
FUENTE_EDAD <- "INEI REDATAM CPV 2017 (Poblacio.C5P41 x Poblacio.SEXO, edad simple por distrito)"
# Fecha en que se extrajo la edad de las ciudades; se actualiza al volver a extraerla.
EDAD_CIUDADES_DESCARGADO <- "2026-10-29"
# ADR 0119 §1 y §7. Sobre los distritos que la capa cubre:
#   cobertura cartográfica = pob REDATAM 2017 en manzanas de la capa / pob REDATAM 2017 en manzanas del distrito
#   captación              = pob REDATAM 2017 en manzanas de la capa / pob censada CPV 2025
# Nivel 1: pob 2025 >= 300 mil, captación >= 65 %, cobertura cartográfica >= 75 %.
# Nivel 2: pob 2025 >= 100 mil, captación >= 55 %, cobertura cartográfica >= 65 %.
NIVELES <- list(
  "1" = list(pob25 = 300000, captacion = 65, cobertura_cartografica = 75),
  "2" = list(pob25 = 100000, captacion = 55, cobertura_cartografica = 65)
)
PROVINCIAS_NIVEL_1 <- c("0401", "1301", "1401", "1201", "0218", "0801", "1601", "2301")
PROVINCIAS_NIVEL_2 <- c(
  "2001", "1101", "2501", "2006", "1001", "0501", "1102", "2111", "1508",
  "2209", "0201", "1105", "1502", "2101", "2401", "0608", "2005"
)

out_dir <- Sys.getenv("HOJAS_RUTA_CIUDADES_OUT", file.path(repo_root, "tmp", "hojas_ruta_ciudades"))
cache_dir <- Sys.getenv("HOJAS_RUTA_REDDATAM_MANZANA_CACHE", file.path(repo_root, "tmp", "redatam_manzana_cache"))
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)

source(file.path(script_dir, "redatam2017_manzana.R"), local = TRUE)

# --- Insumo GeoPeru -----------------------------------------------------------

resolve_estrato_shp <- function() {
  src <- Sys.getenv("HOJAS_RUTA_GEOPERU_ESTRATO", "")
  if (!nzchar(src)) {
    src <- file.path(cache_dir, "peru_estrato_nacional_.zip")
    if (!file.exists(src)) {
      message("Descargando ", GEOPERU_URL)
      curl::curl_download(GEOPERU_URL, src, quiet = TRUE)
    }
  }
  if (grepl("[.]zip$", src, ignore.case = TRUE)) {
    unz_dir <- file.path(cache_dir, "peru_estrato_nacional_unzip")
    if (!dir.exists(unz_dir)) utils::unzip(src, exdir = unz_dir)
    src <- unz_dir
  }
  shp <- list.files(src, pattern = "peru_estrato_nacional_[.]shp$", full.names = TRUE, recursive = TRUE)
  if (!length(shp)) stop("No se encontró peru_estrato_nacional_.shp en ", src, call. = FALSE)
  shp[[1]]
}

# IDMZ18 = ubigeo(6) + ccpp(4) + zona(5) + manzana(3) + sufijo(1, "0" si no hay).
# El id normalizado de la app es ubigeo + zona + manzana (+ sufijo si es letra).
idmz18_to_cartografia <- function(id) paste0(substr(id, 1L, 6L), substr(id, 11L, 19L))
cartografia_to_norm <- function(id) ifelse(substr(id, 15L, 15L) == "0", substr(id, 1L, 14L), id)

# --- Construcción ---------------------------------------------------------------

# CPV 2025 por distrito. En la base 2025, el 27 es Lima Metropolitana y el 26 Lima provincias:
# ambos se traducen a 15 (ADR 0119 §6).
fetch_cpv2025_distritos <- function() {
  cache <- file.path(cache_dir, "cpv2025_distritos.csv")
  if (file.exists(cache)) return(utils::read.csv(cache, colClasses = c(cod = "character", ubigeo = "character")))
  body <- paste0(
    "MAIN=WebServerMain.inl&BASE=CPV2025DI&LANG=esp&CODIGO=XXUSUARIOXX&ITEM=COUNTS&MODE=RUN&inputTitle=",
    "&VARIABLE=VIVIENDA&VARIABLE=POBLACION&OUTPUT=DISTRITO&SELECTION=ALL&INLINESELECTION=",
    "&FORMAT=HTML&TOTCOL=on&UNIVERSE=&FILTER=&TEXT_FILTER="
  )
  h <- curl::new_handle(post = TRUE, postfields = body, timeout = 180)
  curl::handle_setheaders(h, "Content-Type" = "application/x-www-form-urlencoded")
  html <- rawToChar(curl::curl_fetch_memory(paste0(CPV2025_URL, "/bininei/RpWebStats.exe/AreaList?"), h)$content)
  src <- xml2::xml_attr(xml2::xml_find_first(xml2::read_html(html), ".//iframe|.//frame"), "src")
  if (!grepl("^http", src)) src <- paste0(CPV2025_URL, src)
  doc <- xml2::read_html(rawToChar(curl::curl_fetch_memory(src)$content))
  rows <- lapply(xml2::xml_find_all(doc, ".//tr"), function(r) trimws(xml2::xml_text(xml2::xml_find_all(r, "./td|./th"))))
  rows <- Filter(function(r) length(r) >= 5L && grepl("^[0-9]{6}$", r[[2]]), rows)
  out <- data.frame(
    cod = vapply(rows, `[[`, character(1), 2L),
    viv25 = as.integer(gsub("[^0-9]", "", vapply(rows, `[[`, character(1), 4L))),
    pob25 = as.integer(gsub("[^0-9]", "", vapply(rows, `[[`, character(1), 5L)))
  )
  dep <- substr(out$cod, 1L, 2L)
  out$ubigeo <- ifelse(dep == "27", paste0("1501", substr(out$cod, 5L, 6L)),
                ifelse(dep == "26", paste0("15", substr(out$cod, 3L, 6L)), out$cod))
  if (nrow(out) < 1800L) stop("CPV 2025 devolvió ", nrow(out), " distritos; se esperaban ~1 890.", call. = FALSE)
  utils::write.csv(out, cache, row.names = FALSE)
  out
}

shp <- resolve_estrato_shp()
# La fecha de obtención es la del archivo fuente, no la de la corrida: así dos corridas
# sobre el mismo insumo producen el mismo registro.
DESCARGADO <- Sys.getenv("HOJAS_RUTA_DESCARGADO", format(as.Date(file.mtime(shp)), "%Y-%m-%d"))
message("Leyendo ", shp)
# La capa trae anillos con orientación inválida que el motor esférico (s2) rechaza
# al unir; se trabaja en plano y el área se mide en una cónica equivalente para Perú.
sf::sf_use_s2(FALSE)
CRS_AREA <- "+proj=aea +lat_1=-2 +lat_2=-16 +lat_0=-9 +lon_0=-75 +datum=WGS84 +units=m +no_defs"
x <- suppressWarnings(sf::st_read(shp, quiet = TRUE))
x <- x[!is.na(x$IDMZ18) & nzchar(x$IDMZ18), ]
x <- sf::st_make_valid(sf::st_transform(x, 4326))
x$ubigeo <- substr(x$IDMZ18, 1L, 6L)
x <- x[!grepl("^(1501|0701)", x$ubigeo), ]

provincias_pedidas <- trimws(strsplit(Sys.getenv("HOJAS_RUTA_CIUDADES_PROVINCIAS", paste(c(PROVINCIAS_NIVEL_1, PROVINCIAS_NIVEL_2), collapse = ",")), ",")[[1]])
if (!identical(provincias_pedidas, "todas")) x <- x[substr(x$ubigeo, 1L, 4L) %in% provincias_pedidas, ]
solo <- trimws(strsplit(Sys.getenv("HOJAS_RUTA_CIUDADES_DISTRITOS", ""), ",")[[1]])
if (length(solo) && any(nzchar(solo))) x <- x[x$ubigeo %in% solo, ]
if (!nrow(x)) stop("No quedan manzanas para construir.", call. = FALSE)

x$cartografia_id <- idmz18_to_cartografia(x$IDMZ18)
x$id_manzana_norm <- cartografia_to_norm(x$cartografia_id)

# Una manzana puede venir partida en varias filas: se unen sus polígonos y se
# conserva el primer registro de NSE (todas sus filas traen el mismo estrato).
x <- x[order(x$id_manzana_norm, -x$PERSON), ]
dup <- duplicated(x$id_manzana_norm)
if (any(dup)) {
  ids <- unique(x$id_manzana_norm[dup])
  merged <- lapply(ids, function(id) sf::st_make_valid(sf::st_union(sf::st_geometry(x[x$id_manzana_norm == id, ]))))
  first <- x[!dup, ]
  sf::st_geometry(first)[match(ids, first$id_manzana_norm)] <- do.call(c, merged)
  x <- first
}
message(sprintf("%d manzanas en %d distritos", nrow(x), length(unique(x$ubigeo))))

suppressWarnings({
  centro <- sf::st_coordinates(sf::st_point_on_surface(x))
  area <- as.numeric(sf::st_area(sf::st_transform(x, CRS_AREA)))
})

marco <- data.frame(
  ubigeo = x$ubigeo,
  departamento = x$NOM_DPTO,
  provincia = x$NOM_PROV,
  distrito = x$NOM_DIST,
  zona = substr(x$cartografia_id, 7L, 11L),
  manzana = sub("0$", "", substr(x$cartografia_id, 12L, 15L)),
  id_manzana = x$id_manzana_norm,
  id_manzana_norm = x$id_manzana_norm,
  cartografia_id = x$cartografia_id,
  viviendas = NA_integer_,
  viviendas0 = NA_integer_,
  poblacion = NA_integer_,
  poblacion_h = NA_integer_,
  poblacion_m = NA_integer_,
  lat = round(centro[, "Y"], 6),
  lon = round(centro[, "X"], 6),
  area_m2 = round(area, 1),
  cartografia_fuente = "INEI - CENSO 2017 (GeoPeru)",
  cartografia_anio = ANIO_DATO,
  conteo_fuente = FUENTE_MARCO,
  match_level = "sin_conteo_redatam"
)

fallidos <- character(0)
cobertura_dist <- data.frame(ubigeo = character(0), pob17_redatam = integer(0), pob17_en_capa = integer(0))
for (ub in sort(unique(marco$ubigeo))) {
  res <- tryCatch({
    viv <- parse_housing(fetch_redatam_table(ub, "Manzana.NMANZ", "Vivienda.C2P2"), ub)
    pob <- parse_population(fetch_redatam_table(ub, "Manzana.NMANZ", "Poblacio.SEXO"), ub)
    list(viv = viv, pob = pob)
  }, error = function(e) {
    message("REDATAM falló en ", ub, ": ", conditionMessage(e))
    NULL
  })
  if (is.null(res)) {
    fallidos <- c(fallidos, ub)
    next
  }
  idx <- which(marco$ubigeo == ub)
  iv <- match(marco$cartografia_id[idx], res$viv$cartografia_id_redatam)
  ip <- match(marco$cartografia_id[idx], res$pob$cartografia_id_redatam)
  marco$viviendas[idx] <- res$viv$viviendas[iv]
  marco$poblacion[idx] <- res$pob$poblacion[ip]
  marco$poblacion_h[idx] <- res$pob$poblacion_h[ip]
  marco$poblacion_m[idx] <- res$pob$poblacion_m[ip]
  marco$match_level[idx[!is.na(iv) | !is.na(ip)]] <- "id_manzana_norm"
  cobertura_dist <- rbind(cobertura_dist, data.frame(
    ubigeo = ub,
    pob17_redatam = sum(res$pob$poblacion, na.rm = TRUE),
    pob17_en_capa = sum(res$pob$poblacion[res$pob$cartografia_id_redatam %in% marco$cartografia_id[idx]], na.rm = TRUE)
  ))
}
marco$viviendas0 <- marco$viviendas
marco$viviendas[is.na(marco$viviendas)] <- 0L
marco$poblacion[is.na(marco$poblacion)] <- 0L

nivel <- toupper(trimws(x$DESC_INGPE))
nse <- data.frame(
  id_manzana = x$id_manzana_norm,
  id_manzana_norm = x$id_manzana_norm,
  ubigeo = x$ubigeo,
  distrito = x$NOM_DIST,
  nse_codigo = as.integer(x$ESTR_N1),
  nse_nivel = ifelse(is.na(nivel) | nivel == "", "SIN DATA", nivel),
  nse_match_method = "id_manzana_norm",
  nse_distance_m = 0,
  nse_income_per_capita = as.numeric(gsub(",", "", x$INGR_PER, fixed = TRUE)),
  nse_personas = as.integer(x$PERSON),
  nse_hogares = as.integer(x$HOG),
  nse_idmz18 = x$IDMZ18
)

# --- Escritura determinista -------------------------------------------------------

gzip_n <- function(path) {
  status <- system2("gzip", c("-n", "-9", "-f", shQuote(path)))
  if (!identical(status, 0L)) stop("gzip falló en ", path, call. = FALSE)
  paste0(path, ".gz")
}

write_csv_gz <- function(df, name) {
  path <- file.path(out_dir, sub("[.]gz$", "", name))
  df <- df[order(df$ubigeo, df$id_manzana_norm), ]
  utils::write.csv(df, path, row.names = FALSE, fileEncoding = "UTF-8", na = "")
  gzip_n(path)
}

marco_path <- write_csv_gz(marco, ARCHIVO_MARCO)
nse_path <- write_csv_gz(nse, ARCHIVO_NSE)

carto_dir <- file.path(out_dir, "cartografia", DIR_MANZANAS)
dir.create(carto_dir, recursive = TRUE, showWarnings = FALSE)
# Mismo esquema de propiedades que la cartografía de Lima (PlanMet): el engine lee ID_MANZANA,
# NOMBDIST, NOMBPROV, NOMBDEP, FTE_MZNA y AREA_M2, y enriquece por ID_MANZANA = id del marco.
props <- data.frame(
  ID_MANZANA = x$id_manzana_norm,
  UBIGEO = x$ubigeo,
  NOMBDEP = x$NOM_DPTO,
  NOMBPROV = x$NOM_PROV,
  NOMBDIST = x$NOM_DIST,
  FTE_MZNA = "INEI - CENSO 2017",
  AREA_M2 = round(area, 1),
  CODZONA = substr(x$cartografia_id, 7L, 9L),
  SUFZONA = substr(x$cartografia_id, 10L, 11L),
  CODMZNA = substr(x$cartografia_id, 12L, 14L),
  SUFMZNA = ifelse(substr(x$cartografia_id, 15L, 15L) == "0", NA_character_, substr(x$cartografia_id, 15L, 15L)),
  CODCCPP = substr(x$IDMZ18, 7L, 10L),
  NOMCCPP = x$NOM_CCPP,
  fuente_anio = ANIO_DATO
)
capa <- sf::st_sf(props, geometry = sf::st_geometry(x))
carto_files <- character(0)
for (ub in sort(unique(capa$UBIGEO))) {
  part <- capa[capa$UBIGEO == ub, ]
  part <- part[order(part$ID_MANZANA), ]
  path <- file.path(carto_dir, paste0(ub, ".geojson"))
  sf::st_write(part, path, quiet = TRUE, delete_dsn = TRUE,
               layer_options = c("COORDINATE_PRECISION=6", "RFC7946=NO", "WRITE_NAME=NO"))
  carto_files <- c(carto_files, gzip_n(path))
}

# --- Cobertura (ADR 0119 §7) ------------------------------------------------------

pct <- function(a, b) if (is.na(b) || b <= 0) NA_real_ else round(100 * a / b, 1)

cpv25 <- fetch_cpv2025_distritos()
cobertura_dist <- merge(cobertura_dist, cpv25[, c("ubigeo", "pob25", "viv25")], by = "ubigeo", all.x = TRUE)

indicadores <- function(pob17_redatam, pob17_en_capa, pob25) {
  list(
    pob17_redatam = as.integer(pob17_redatam),
    pob17_en_capa = as.integer(pob17_en_capa),
    pob25 = if (is.na(pob25)) NULL else as.integer(pob25),
    cobertura_cartografica = pct(pob17_en_capa, pob17_redatam),
    captacion = pct(pob17_en_capa, pob25),
    crecimiento = if (is.na(pob25) || pob17_redatam <= 0) NULL else round(100 * (pob25 / pob17_redatam - 1), 1)
  )
}

nivel_de <- function(ind) {
  for (n in names(NIVELES)) {
    u <- NIVELES[[n]]
    if (!is.null(ind$pob25) && ind$pob25 >= u$pob25 &&
        isTRUE(ind$captacion >= u$captacion) && isTRUE(ind$cobertura_cartografica >= u$cobertura_cartografica)) {
      return(n)
    }
  }
  "fuera"
}

cobertura_provincia <- function(pc, dist) {
  d <- cobertura_dist[cobertura_dist$ubigeo %in% dist, ]
  d <- d[order(d$ubigeo), ]
  prov <- indicadores(sum(d$pob17_redatam), sum(d$pob17_en_capa), sum(d$pob25))
  pob25_prov <- sum(cpv25$pob25[substr(cpv25$ubigeo, 1L, 4L) == pc], na.rm = TRUE)
  prov$peso_en_provincia <- pct(sum(d$pob25, na.rm = TRUE), pob25_prov)
  por_distrito <- lapply(seq_len(nrow(d)), function(i) indicadores(d$pob17_redatam[i], d$pob17_en_capa[i], d$pob25[i]))
  names(por_distrito) <- d$ubigeo
  list(
    nivel = nivel_de(prov),
    referencia = FUENTE_REFERENCIA,
    anio_referencia = 2025L,
    provincia = prov,
    distritos = por_distrito
  )
}

# --- Registro (ADR 0119 §2) -------------------------------------------------------

md5s <- function(paths) {
  out <- as.list(unname(tools::md5sum(paths)))
  names(out) <- basename(paths)
  out
}

capa_meta <- function(ruta, fuente, version, checksums, patron = NULL, filtro = NULL) {
  out <- list(ruta = ruta)
  if (!is.null(patron)) out$patron <- patron
  if (!is.null(filtro)) out$filtro <- filtro
  c(out, list(fuente = fuente, anio_dato = ANIO_DATO, descargado = DESCARGADO, version = version, checksums = checksums))
}

carto_md5 <- md5s(carto_files)
marco_md5 <- md5s(marco_path)
nse_md5 <- md5s(nse_path)
edad_path <- file.path(out_dir, ARCHIVO_EDAD)
edad_md5 <- if (file.exists(edad_path)) md5s(edad_path) else NULL
prov_cod <- substr(marco$ubigeo, 1L, 4L)
provincias <- lapply(sort(unique(prov_cod)), function(pc) {
  rows <- marco[prov_cod == pc, ]
  dist <- sort(unique(rows$ubigeo))
  list(
    codigo = pc,
    departamento = rows$departamento[[1]],
    provincia = rows$provincia[[1]],
    distritos = as.list(dist),
    cobertura = cobertura_provincia(pc, dist),
    capas = list(
      manzanas = c(list(perfil = "ciudades"),
                   capa_meta(file.path("cartografia", DIR_MANZANAS), "INEI - CENSO 2017 (GeoPeru/IDEP)", VERSION_MANZANAS,
                             carto_md5[paste0(dist, ".geojson.gz")], patron = "<ubigeo>.geojson.gz")),
      marco = capa_meta(ARCHIVO_MARCO, FUENTE_MARCO, VERSION_MARCO, marco_md5, filtro = "ubigeo"),
      nse = capa_meta(ARCHIVO_NSE, FUENTE_NSE, VERSION_NSE, nse_md5, filtro = "ubigeo"),
      edad = if (!is.null(edad_md5)) {
        utils::modifyList(capa_meta(ARCHIVO_EDAD, FUENTE_EDAD, "inei2017-ciudades-edad-simple-v1", edad_md5, filtro = "ubigeo"),
                          list(descargado = EDAD_CIUDADES_DESCARGADO))
      }
    )
  )
})

# Lima y Callao ya están empaquetados (ADR 0114/0115): el registro los describe sin tocar sus
# archivos. `perfil` dice qué perfil de cartografía del engine usa cada provincia; las ciudades
# usan `ciudades`. La cobertura se mide igual que en las ciudades: población REDATAM 2017 del
# marco oficial frente a la población REDATAM 2017 del distrito y la censada CPV 2025.
registro_lima_callao <- function() {
  base <- script_dir
  oficial <- utils::read.csv(file.path(base, "inei2017_lima_callao_manzanas_oficial.csv.gz"),
                             colClasses = c(ubigeo = "character"))
  nse_manifest <- jsonlite::read_json(file.path(base, "nse_geoperu_inei_lima_callao_manzanas.json"))
  marco_manifest <- jsonlite::read_json(file.path(base, "cartografia_manzanas_inei2017_lima_callao.json"))
  defs <- list(
    list(codigo = "1501", departamento = "LIMA", provincia = "LIMA", perfil = "lima",
         dir = "manzanas_lima_2017", manifest = "cartografia_manzanas_lima_2017.json", anio = 2017L),
    list(codigo = "0701", departamento = "CALLAO", provincia = "CALLAO", perfil = "callao",
         dir = "manzanas_callao_2019", manifest = "cartografia_manzanas_callao_2019.json", anio = 2019L)
  )
  marco_md5 <- md5s(file.path(base, "inei2017_lima_callao_manzanas_oficial.csv.gz"))
  nse_md5 <- md5s(file.path(base, "nse_geoperu_inei_lima_callao_manzanas.csv.gz"))
  lapply(defs, function(def) {
    dist <- sort(unique(oficial$ubigeo[substr(oficial$ubigeo, 1L, 4L) == def$codigo]))
    for (ub in dist) {
      pob <- tryCatch(parse_population(fetch_redatam_table(ub, "Manzana.NMANZ", "Poblacio.SEXO"), ub),
                      error = function(e) stop("REDATAM falló en ", ub, ": ", conditionMessage(e), call. = FALSE))
      cobertura_dist <<- rbind(cobertura_dist, data.frame(
        ubigeo = ub,
        pob17_redatam = sum(pob$poblacion, na.rm = TRUE),
        pob17_en_capa = sum(oficial$poblacion[oficial$ubigeo == ub], na.rm = TRUE),
        pob25 = cpv25$pob25[match(ub, cpv25$ubigeo)],
        viv25 = cpv25$viv25[match(ub, cpv25$ubigeo)]
      ))
    }
    carto_manifest <- jsonlite::read_json(file.path(base, def$manifest))
    carto_dir <- file.path(base, "cartografia", def$dir)
    carto <- file.path(carto_dir, paste0(dist, ".geojson.gz"))
    carto <- carto[file.exists(carto)]
    list(
      codigo = def$codigo,
      departamento = def$departamento,
      provincia = def$provincia,
      distritos = as.list(dist),
      cobertura = cobertura_provincia(def$codigo, dist),
      capas = list(
        manzanas = c(list(ruta = file.path("cartografia", def$dir), patron = "<ubigeo>.geojson.gz", perfil = def$perfil,
                          fuente = carto_manifest$source, anio_dato = def$anio,
                          descargado = substr(carto_manifest$packaged_at, 1L, 10L),
                          version = carto_manifest$version %||% def$dir),
                     list(checksums = md5s(carto))),
        marco = list(ruta = "inei2017_lima_callao_manzanas_oficial.csv.gz", filtro = "ubigeo",
                     fuente = "INEI CPV 2017 (Informacion Digital Urbano Censal)", anio_dato = 2017L,
                     descargado = substr(marco_manifest$packaged_at, 1L, 10L),
                     version = marco_manifest$version, checksums = marco_md5),
        nse = list(ruta = "nse_geoperu_inei_lima_callao_manzanas.csv.gz", filtro = "ubigeo",
                   fuente = nse_manifest$source, anio_dato = as.integer(nse_manifest$anio_dato),
                   descargado = nse_manifest$descargado, version = nse_manifest$version, checksums = nse_md5),
        edad = list(ruta = "inei2017_lima_callao_edad_simple_distrito.csv", filtro = "ubigeo",
                    fuente = FUENTE_EDAD, anio_dato = 2017L, descargado = "2026-05-03",
                    version = "inei2017-lima-callao-edad-simple-v1",
                    checksums = md5s(file.path(base, "inei2017_lima_callao_edad_simple_distrito.csv")))
      )
    )
  })
}

provincias <- c(registro_lima_callao(), provincias)
provincias <- provincias[order(vapply(provincias, function(p) p$codigo, character(1)))]

# Manifiesto de la cartografía de ciudades, con el mismo esquema que los de Lima: el engine lee
# de aquí cuántos distritos y manzanas hay sin abrir cada GeoJSON.
conteo_carto <- table(capa$UBIGEO)
jsonlite::write_json(list(
  id = "inei2017-blocks-ciudades",
  version = VERSION_MANZANAS,
  schema_version = 1L,
  provider = "Instituto Nacional de Estadistica e Informatica (INEI)",
  source = "INEI - CENSO 2017, capa peru_estrato_nacional_ (GeoPeru/IDEP)",
  year = ANIO_DATO,
  anio_dato = ANIO_DATO,
  descargado = DESCARGADO,
  coverage = "Ciudades principales (ADR 0119, niveles 1 y 2)",
  geometry = "poligono_manzana",
  spatial_reference = "EPSG:4326 / WGS84",
  compression = "gzip_por_distrito",
  packaged_districts = length(conteo_carto),
  packaged_blocks = as.integer(sum(conteo_carto)),
  packaged_at = DESCARGADO,
  counts_by_district = as.list(stats::setNames(as.integer(conteo_carto), names(conteo_carto)))
), file.path(out_dir, "cartografia_manzanas_inei2017_ciudades.json"), auto_unbox = TRUE, pretty = TRUE)

registro <- list(
  schema_version = 1L,
  id = "hojas-ruta-territorios",
  version = "hojas-ruta-territorios-v1",
  generado = DESCARGADO,
  umbrales = NIVELES,
  provincias = provincias
)
jsonlite::write_json(registro, file.path(out_dir, "territorios.json"),
                     auto_unbox = TRUE, pretty = TRUE)

resumen <- list(
  manzanas = nrow(marco),
  distritos = length(unique(marco$ubigeo)),
  provincias = sum(vapply(provincias, function(p) p$capas$manzanas$perfil == "ciudades", logical(1))),
  con_conteo = sum(marco$match_level == "id_manzana_norm"),
  sin_conteo = sum(marco$match_level != "id_manzana_norm"),
  viviendas = sum(marco$viviendas),
  poblacion = sum(marco$poblacion),
  nse_sin_data = sum(nse$nse_nivel == "SIN DATA"),
  niveles = as.list(table(vapply(provincias, function(p) p$cobertura$nivel, character(1)))),
  distritos_redatam_fallidos = as.list(fallidos)
)
# El resumen es diagnóstico de la corrida: va a la caché, no al paquete.
jsonlite::write_json(resumen, file.path(cache_dir, "resumen_build_ciudades.json"), auto_unbox = TRUE, pretty = TRUE)
print(utils::str(resumen))
if (length(fallidos)) quit(status = 2L)
