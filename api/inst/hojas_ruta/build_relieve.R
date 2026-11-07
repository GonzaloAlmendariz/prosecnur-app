#!/usr/bin/env Rscript
# Relieve sombreado para el lienzo de Hojas de ruta (revisión del 7 nov 2026, H10): da contexto
# al mapa —cerros, valles, costa— sin competir con los datos. Una imagen del Perú entero y una
# por cada ciudad del índice (ciudadesIndice.json); el lienzo dibuja la del Perú de fondo y,
# encima, la de la ciudad abierta.
#
# Fuente: Copernicus DEM GLO-90 (ESA, © DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH
# 2014-2018, distribuido por la ESA bajo licencia del programa Copernicus; uso libre citando la
# fuente). Se lee de su copia pública en AWS sin descargar hojas enteras: cada ciudad pide sólo
# su recorte y el Perú pide la versión reducida que cada archivo trae dentro (COG).
#
# Salidas:
#   frontend/public/relieve/<clave>.webp   gris = sombra (255 = luz plena), alfa 0 = mar.
#   frontend/src/features/hojasRuta/relieveIndice.json   caja lon/lat de cada imagen.
#
# Uso: Rscript api/inst/hojas_ruta/build_relieve.R   (necesita red; unos minutos)

options(stringsAsFactors = FALSE, warn = 1)
for (pkg in c("terra", "sf", "jsonlite", "magick")) {
  if (!requireNamespace(pkg, quietly = TRUE)) stop(sprintf("Package '%s' is required.", pkg), call. = FALSE)
}
`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
repo_root <- normalizePath(file.path(script_dir, "..", "..", ".."), mustWork = FALSE)
front <- file.path(repo_root, "frontend", "src", "features", "hojasRuta")
out_dir <- file.path(repo_root, "frontend", "public", "relieve")
out_indice <- file.path(front, "relieveIndice.json")

FUENTE <- "Relieve: Copernicus DEM, ESA"  # corta: a 1024 px la cita cruzaba todo el mapa
BASE <- "https://copernicus-dem-90m.s3.amazonaws.com"
NATIVO <- 1 / 1200       # 3 segundos de arco, unos 90 m
LADO_MAX <- 1600          # píxeles: Lima sale a ~130 m por píxel
CFG <- c(GDAL_DISABLE_READDIR_ON_OPEN = "EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS = ".tif")

# Hoja de 1 grado por su esquina suroeste (lat, lon en grados enteros): «S13_00_W077_00» cubre -13 a -12 y -77 a
# -76; al norte del ecuador la hoja es «N00», «N01»…
hoja_url <- function(lat, lon) {
  n <- sprintf("Copernicus_DSM_COG_30_%s%02d_00_%s%03d_00_DEM", if (lat < 0) "S" else "N", abs(lat), if (lon < 0) "W" else "E", abs(lon))
  sprintf("/vsicurl/%s/%s/%s.tif", BASE, n, n)
}

# Elevación de una caja [oeste, este, sur, norte] a la resolución `res` (grados). Las hojas que no
# existen son mar: quedan en NA y se leen como agua.
elevacion <- function(caja, res) {
  lats <- seq(floor(caja[3]), ceiling(caja[4]) - 1)
  lons <- seq(floor(caja[1]), ceiling(caja[2]) - 1)
  grilla <- terra::rast(terra::ext(caja[1], caja[2], caja[3], caja[4]), resolution = res, crs = "EPSG:4326")
  piezas <- list()
  reducida <- res > 4 * NATIVO
  for (la in lats) for (lo in lons) {
    url <- hoja_url(la, lo)
    if (reducida) {
      # Con un tamaño de salida menor al nativo, GDAL toma la versión reducida del COG y baja pocos KB.
      tmp <- tempfile(fileext = ".tif")
      lado <- max(2L, round(1 / res))
      ok <- tryCatch({
        sf::gdal_utils("translate", url, tmp, options = c("-outsize", lado, lado, "-r", "average"), config_options = CFG, quiet = TRUE)
        TRUE
      }, error = function(e) FALSE)
      # Una hoja que no existe (mar) no lanza error: sólo no deja archivo.
      if (ok && file.exists(tmp)) piezas[[length(piezas) + 1L]] <- terra::rast(tmp)
    } else {
      # A resolución de ciudad, sólo los bloques del recorte (unos segundos por hoja).
      hoja <- tryCatch(terra::rast(url), error = function(e) NULL)
      if (is.null(hoja)) next
      corte <- terra::intersect(terra::ext(hoja), terra::ext(grilla))
      if (is.null(corte)) next
      piezas[[length(piezas) + 1L]] <- terra::crop(hoja, corte)
    }
  }
  if (!length(piezas)) return(terra::init(grilla, NA_real_))
  mosaico <- if (length(piezas) == 1L) piezas[[1]] else do.call(terra::merge, piezas)
  terra::resample(mosaico, grilla, method = "bilinear")
}

# Sombreado multidireccional (como los mapas base de relieve): la luz principal del noroeste. Se devuelve
# relativo al llano: 1 en terreno plano o en ladera iluminada, menos de 1 sólo en la ladera en sombra. Así el llano
# queda del color del fondo y la imagen no se lee como un rectángulo gris (revisión del 7 nov 2026).
sombreado <- function(z, exagera) {
  zz <- z * exagera
  pend <- terra::terrain(zz, "slope", unit = "radians")
  asp <- terra::terrain(z, "aspect", unit = "radians")
  luces <- list(c(45, 315, 2), c(45, 225, 1), c(45, 45, 1), c(60, 0, 1))
  hs <- Reduce(`+`, lapply(luces, function(l) l[3] * terra::shade(pend, asp, l[1], l[2]))) / 5
  llano <- sum(vapply(luces, function(l) l[3] * sin(l[1] * pi / 180), 0)) / 5
  hs <- terra::ifel(is.na(hs), llano, hs)
  terra::clamp(hs / llano, 0, 1)
}

escribir <- function(clave, caja, res, exagera) {
  z <- elevacion(caja, res)
  hs <- sombreado(z, exagera)
  agua <- is.na(z) | z <= 0.5
  luz <- terra::clamp((hs - 0.35) / 0.65, 0, 1)  # 0 = sombra profunda, 1 = ladera iluminada o llano
  gris <- round(1 + 254 * terra::values(luz)[, 1])
  gris[is.na(gris)] <- 255
  alfa <- ifelse(terra::values(agua)[, 1] %in% TRUE, 0, 255)
  # Los valores de terra van fila por fila desde el norte: la misma lectura que una imagen.
  pix <- matrix(grDevices::rgb(gris, gris, gris, alfa, maxColorValue = 255), nrow = terra::nrow(z), byrow = TRUE)
  img <- magick::image_read(grDevices::as.raster(pix))
  archivo <- file.path(out_dir, paste0(clave, ".webp"))
  magick::image_write(img, archivo, format = "webp", quality = 78)
  # La huella va en la URL: al regenerar, el navegador no sirve la imagen vieja de su caché.
  list(clave = clave, oeste = caja[1], este = caja[2], sur = caja[3], norte = caja[4],
       ancho = terra::ncol(z), alto = terra::nrow(z), huella = substr(unname(tools::md5sum(archivo)), 1, 10))
}

dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
sf::sf_use_s2(FALSE)
terra::setGDALconfig(paste0(names(CFG), "=", CFG))

# Perú: ~1,6 km por píxel, con el relieve exagerado (a esa escala los Andes se aplanan).
# La caja excede al país por todos lados: el borde de la imagen se difumina en el lienzo y no debe comerse la costa.
indice <- list(escribir("pe", c(-84, -66, -20.5, 2), 0.015, 6))

# Ciudades: un cuadrado alrededor de su silueta, de 2,2 veces su lado mayor (cabe la vista más
# alejada que permite la ciudad abierta) y no menos de 30 km.
ciudades <- jsonlite::read_json(file.path(front, "ciudadesIndice.json"))$ciudades
for (c in ciudades) {
  pts <- do.call(rbind, lapply(c$silueta, function(r) do.call(rbind, lapply(r, unlist))))
  lat0 <- mean(range(pts[, 2]))
  km_lon <- 111.32 * cos(lat0 * pi / 180)
  lado_km <- max(30, 2.2 * max(diff(range(pts[, 1])) * km_lon, diff(range(pts[, 2])) * 110.54))
  cx <- mean(range(pts[, 1])); cy <- lat0
  caja <- c(cx - lado_km / 2 / km_lon, cx + lado_km / 2 / km_lon, cy - lado_km / 2 / 110.54, cy + lado_km / 2 / 110.54)
  res <- max(NATIVO, (caja[4] - caja[3]) / LADO_MAX)
  indice[[length(indice) + 1L]] <- escribir(c$codigo, caja, res, 1.6)
  cat(c$codigo, "\n")
}

writeLines(jsonlite::toJSON(list(fuente = FUENTE, imagenes = indice), auto_unbox = TRUE, digits = 6), out_indice, useBytes = TRUE)
pesos <- file.size(list.files(out_dir, full.names = TRUE))
cat(sprintf("%d imágenes -> %s (%.1f MB en total, máx %.0f KB)\n", length(pesos), out_dir, sum(pesos) / 1e6, max(pesos) / 1024))
