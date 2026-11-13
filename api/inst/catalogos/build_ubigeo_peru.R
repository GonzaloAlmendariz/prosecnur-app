#!/usr/bin/env Rscript
# Catálogo nacional de ubigeos del Perú: los 1,890 distritos con su provincia y
# su departamento, para el motor compartido `api/R/catalogo_ubigeo.R`
# (Validación, Hojas de ruta, ponderación).
#
# Fuente oficial: servicio WFS de la Infraestructura de Datos Espaciales del INEI
# (https://ide.inei.gob.pe, sección "Servicios"), espacio "Interoperabilidad":
#   - ig_distrito     ubigeo, ccdd, ccpp, ccdi, nombdist
#   - ig_provincia    ccdd, ccpp, nombprov
#   - ig_departamento ccdd, nombdep
# Las tres capas declaran `fuente = "V Censo Nacional Economico"` y fecha de
# registro 2022-07 (versión que se anota en el metadato). Se pide solo la tabla
# de atributos (`propertyName`), sin la geometría.
#
# Los nombres se guardan como los publica el INEI: en mayúsculas, sin tildes y
# con Ñ. La normalización para comparar vive en el motor, no en el archivo.
#
# Salidas (gzip -n, filas ordenadas por ubigeo, sin marca de tiempo en los bytes):
#   ubigeo_peru.csv.gz      ubigeo, departamento, provincia, distrito
#   ubigeo_peru.meta.json   fuente, url de cada capa, fecha de consulta, versión, conteos
#
# Uso:
#   Rscript api/inst/catalogos/build_ubigeo_peru.R
# Variables:
#   CATALOGO_UBIGEO_OUT         carpeta de salida (por defecto, la del script)
#   CATALOGO_UBIGEO_CONSULTADO  fecha de consulta a registrar (por defecto, hoy)
#
# El script falla si la fuente no responde o si las tres capas no calzan entre sí
# (distrito sin provincia, provincia sin departamento, ubigeo distinto de
# ccdd+ccpp+ccdi, ubigeos repetidos). No completa filas por su cuenta.

options(stringsAsFactors = FALSE, warn = 1)
if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Package 'jsonlite' is required.", call. = FALSE)
`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

script_path <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1] %||% ".")
script_dir <- dirname(normalizePath(script_path, mustWork = FALSE))
out_dir <- Sys.getenv("CATALOGO_UBIGEO_OUT", script_dir)
consultado <- Sys.getenv("CATALOGO_UBIGEO_CONSULTADO", format(Sys.Date()))

WFS <- "https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows"
FUENTE <- "INEI, Infraestructura de Datos Espaciales (ide.inei.gob.pe), WFS Interoperabilidad"
CAPAS <- list(
  distrito = list(capa = "Interoperabilidad:ig_distrito", campos = "ccdd,ccpp,ccdi,ubigeo,nombdist,fuente,fec_reg"),
  provincia = list(capa = "Interoperabilidad:ig_provincia", campos = "ccdd,ccpp,nombprov,fuente,fec_reg"),
  departamento = list(capa = "Interoperabilidad:ig_departamento", campos = "ccdd,nombdep,fuente,fec_reg")
)

url_capa <- function(c) {
  sprintf("%s?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%%2Fjson&typeName=%s&propertyName=%s",
          WFS, c$capa, c$campos)
}

leer_capa <- function(c) {
  f <- tempfile(fileext = ".json")
  on.exit(unlink(f))
  utils::download.file(url_capa(c), f, quiet = TRUE, mode = "wb")
  js <- jsonlite::fromJSON(f, simplifyVector = TRUE)
  props <- js$features$properties
  if (is.null(props) || !nrow(props)) stop("La capa ", c$capa, " llegó vacía.", call. = FALSE)
  props
}

dist <- leer_capa(CAPAS$distrito)
prov <- leer_capa(CAPAS$provincia)
dep <- leer_capa(CAPAS$departamento)

chk <- function(ok, msg) if (!isTRUE(ok)) stop(msg, call. = FALSE)
chk(!anyDuplicated(dist$ubigeo), "Hay ubigeos repetidos en ig_distrito.")
chk(all(dist$ubigeo == paste0(dist$ccdd, dist$ccpp, dist$ccdi)), "Un ubigeo no es ccdd+ccpp+ccdi.")
chk(all(grepl("^[0-9]{6}$", dist$ubigeo)), "Un ubigeo no tiene 6 dígitos.")
prov$clave <- paste0(prov$ccdd, prov$ccpp)
chk(!anyDuplicated(prov$clave), "Hay provincias repetidas.")
chk(!anyDuplicated(dep$ccdd), "Hay departamentos repetidos.")
sin_prov <- setdiff(substr(dist$ubigeo, 1L, 4L), prov$clave)
chk(!length(sin_prov), paste("Distritos sin provincia:", paste(sin_prov, collapse = ", ")))
sin_dep <- setdiff(prov$ccdd, dep$ccdd)
chk(!length(sin_dep), paste("Provincias sin departamento:", paste(sin_dep, collapse = ", ")))

limpio <- function(x) gsub("\\s+", " ", trimws(enc2utf8(as.character(x))))
tabla <- data.frame(
  ubigeo = dist$ubigeo,
  departamento = limpio(dep$nombdep[match(dist$ccdd, dep$ccdd)]),
  provincia = limpio(prov$nombprov[match(substr(dist$ubigeo, 1L, 4L), prov$clave)]),
  distrito = limpio(dist$nombdist)
)
chk(!anyNA(tabla) && all(nzchar(as.matrix(tabla))), "Hay nombres vacíos tras unir las capas.")
tabla <- tabla[order(tabla$ubigeo), , drop = FALSE]

dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
csv <- tempfile(fileext = ".csv")
utils::write.csv(tabla, csv, row.names = FALSE, fileEncoding = "UTF-8")
destino <- file.path(out_dir, "ubigeo_peru.csv.gz")
status <- system2("gzip", c("-n", "-9", "-c", shQuote(csv)), stdout = destino)
chk(identical(as.integer(status), 0L), "gzip falló.")

version <- sort(unique(substr(c(dist$fec_reg, prov$fec_reg, dep$fec_reg), 1L, 10L)))
meta <- list(
  fuente = FUENTE,
  fuente_capas = unique(c(dist$fuente, prov$fuente, dep$fuente)),
  urls = lapply(CAPAS, url_capa),
  consultado = consultado,
  version = sprintf("Registro de las capas: %s", paste(version, collapse = ", ")),
  columnas = names(tabla),
  n_distritos = nrow(tabla),
  n_provincias = length(unique(substr(tabla$ubigeo, 1L, 4L))),
  n_departamentos = length(unique(substr(tabla$ubigeo, 1L, 2L))),
  nombres = "Como los publica el INEI: mayúsculas, sin tildes, con Ñ."
)
jsonlite::write_json(meta, file.path(out_dir, "ubigeo_peru.meta.json"),
                     auto_unbox = TRUE, pretty = TRUE)
message(sprintf("ubigeo_peru.csv.gz: %d distritos, %d provincias, %d departamentos.",
                meta$n_distritos, meta$n_provincias, meta$n_departamentos))
