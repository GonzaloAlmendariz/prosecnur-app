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

# Archivos compartidos (capas con `filtro`) que el registro suma a los de Lima y Callao.
# Lima y Callao se siguen leyendo por sus rutas históricas, así que aquí no se repiten.
.hojas_ruta_registro_archivos <- function(capa) {
  rutas <- unlist(lapply(hojas_ruta_territorios()$provincias %||% list(), function(prov) {
    if ((prov$capas$manzanas$perfil %||% "ciudades") %in% c("lima", "callao")) return(NULL)
    def <- prov$capas[[capa]]
    if (is.null(def) || is.null(def$filtro)) return(NULL)
    def$ruta
  }))
  paths <- vapply(unique(rutas), function(r) .hojas_ruta_inst_path("hojas_ruta", r), character(1))
  unname(paths[file.exists(paths)])
}

.hojas_ruta_rbind_fill <- function(dfs) {
  dfs <- Filter(function(d) is.data.frame(d) && nrow(d), dfs)
  if (!length(dfs)) return(data.frame())
  cols <- unique(unlist(lapply(dfs, names)))
  dfs <- lapply(dfs, function(d) {
    for (nm in setdiff(cols, names(d))) d[[nm]] <- NA
    d[cols]
  })
  out <- do.call(rbind, dfs)
  rownames(out) <- NULL
  out
}

# Lee el CSV histórico de Lima y Callao y le suma las ciudades del registro (ADR 0119).
# En las ciudades los códigos se leen como texto: con ceros a la izquierda no hay ambigüedad.
.hojas_ruta_leer_csv_con_registro <- function(path, capa, colClasses = NA) {
  base <- utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE,
                          fileEncoding = "UTF-8", colClasses = colClasses)
  codigos <- c("ubigeo", "zona", "manzana", "id_manzana", "id_manzana_norm", "cartografia_id", "nse_idmz18")
  extras <- lapply(.hojas_ruta_registro_archivos(capa), function(p) {
    head <- names(utils::read.csv(p, nrows = 1L, check.names = FALSE))
    clases <- stats::setNames(rep("character", length(intersect(codigos, head))), intersect(codigos, head))
    d <- utils::read.csv(p, stringsAsFactors = FALSE, check.names = FALSE, fileEncoding = "UTF-8", colClasses = clases)
    # El esquema lo pone el archivo histórico: una columna que solo traen las ciudades
    # (p. ej. id_manzana_norm, que el engine deriva cuando falta) quedaría en NA para Lima.
    d[intersect(names(d), names(base))]
  })
  .hojas_ruta_rbind_fill(c(list(base), extras))
}

# Suma a la lista de territorios su provincia y su cobertura (ADR 0119 §7).
.hojas_ruta_territorios_con_cobertura <- function(agg) {
  if (!is.data.frame(agg) || !nrow(agg)) return(agg)
  cob <- lapply(agg$ubigeo, hojas_ruta_territorio_cobertura)
  campo <- function(nm) vapply(cob, function(c) {
    v <- c[[nm]]
    if (is.null(v)) NA_character_ else as.character(v)
  }, character(1))
  agg$provincia_codigo <- campo("provincia")
  agg$cobertura_nivel <- campo("nivel")
  agg$cobertura_cartografica <- suppressWarnings(as.numeric(campo("cobertura_cartografica")))
  agg$captacion <- suppressWarnings(as.numeric(campo("captacion")))
  cbind(agg, hojas_ruta_reparto_base_columnas(agg$ubigeo))  # ADR 0131 §2: la UI reparte con P̂25
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
