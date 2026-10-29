# Registro de territorios de Hojas de ruta (ADR 0119 §2).
#
# `api/inst/hojas_ruta/territorios.json` es la única fuente de qué provincias y distritos
# tienen cartografía, marco y NSE empaquetados, con qué año del dato y con qué cobertura.
# Lo genera `api/inst/hojas_ruta/build_inei2017_ciudades.R`; aquí solo se lee.

.hojas_ruta_territorios_cache <- new.env(parent = emptyenv())

hojas_ruta_territorios_path <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "territorios.json")
}

# Registro completo, leído una vez por sesión de R (se invalida si cambia el archivo).
hojas_ruta_territorios <- function() {
  path <- hojas_ruta_territorios_path()
  if (!file.exists(path)) return(list(schema_version = 1L, provincias = list()))
  key <- paste(normalizePath(path, mustWork = FALSE), file.info(path)$mtime, sep = "|")
  cached <- .hojas_ruta_territorios_cache[[key]]
  if (!is.null(cached)) return(cached)
  reg <- jsonlite::read_json(path, simplifyVector = FALSE)
  .hojas_ruta_territorios_cache[[key]] <- reg
  reg
}

# Provincia del registro a la que pertenece un distrito; NULL si no está empaquetado.
.hojas_ruta_territorio_de_ubigeo <- function(ubigeo) {
  ubigeo <- sprintf("%06s", as.character(ubigeo %||% ""))
  if (!grepl("^[0-9]{6}$", ubigeo)) return(NULL)
  for (prov in hojas_ruta_territorios()$provincias %||% list()) {
    if (ubigeo %in% unlist(prov$distritos)) return(prov)
  }
  NULL
}

# Perfil de cartografía de manzanas para un distrito, resuelto desde el registro.
# Lima y Callao conservan sus perfiles históricos; las ciudades comparten uno.
.hojas_ruta_perfil_cartografia_registro <- function(ubigeo) {
  prov <- .hojas_ruta_territorio_de_ubigeo(ubigeo)
  capa <- prov$capas$manzanas
  if (is.null(capa)) return(NULL)
  perfil <- as.character(capa$perfil %||% "ciudades")
  if (perfil %in% c("lima", "callao")) return(.hojas_ruta_cartografia_profile(perfil))
  list(
    id = "inei2017_ciudades",
    source = capa$fuente,
    source_url = "https://descargas.geoperu.gob.pe/peru_estrato_nacional_.zip",
    layer_url = "",
    query_url = "",
    year = as.integer(capa$anio_dato),
    provider = "Instituto Nacional de Estadistica e Informatica",
    version = capa$version,
    coverage = paste(prov$provincia, prov$departamento, sep = ", "),
    dir_name = basename(capa$ruta),
    manifest = .hojas_ruta_inst_path("hojas_ruta", "cartografia_manzanas_inei2017_ciudades.json"),
    id_field = "ID_MANZANA",
    district_field = "NOMBDIST",
    source_field = "FTE_MZNA",
    area_field = "AREA_M2",
    out_fields = ""
  )
}

# Cobertura de un distrito (ADR 0119 §7): nivel de su provincia más las cifras del distrito.
hojas_ruta_territorio_cobertura <- function(ubigeo) {
  prov <- .hojas_ruta_territorio_de_ubigeo(ubigeo)
  if (is.null(prov)) return(NULL)
  ubigeo <- sprintf("%06s", as.character(ubigeo))
  c(
    list(
      ubigeo = ubigeo,
      provincia = prov$codigo,
      nivel = prov$cobertura$nivel,
      referencia = prov$cobertura$referencia,
      anio_referencia = prov$cobertura$anio_referencia
    ),
    prov$cobertura$distritos[[ubigeo]] %||% list()
  )
}
