# Contornos por región de Hojas de ruta (paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md,
# R2). Una sola fuente para el lienzo y para el contexto distrital de los PDF:
# `inst/hojas_ruta/contornos/<región>.json.gz` (build_contornos_por_region.R). Antes el PDF
# leía el JSON de Lima del frontend y en una ciudad el recuadro quedaba sin vecinos.

.hojas_ruta_contornos_cache <- new.env(parent = emptyenv())

hojas_ruta_contornos_dir <- function() {
  .hojas_ruta_inst_path("hojas_ruta", "contornos")
}

.hojas_ruta_contornos_archivo <- function(region) {
  region <- as.character(region %||% "")
  if (!grepl("^[0-9]{2}$", region)) return("")
  f <- file.path(hojas_ruta_contornos_dir(), paste0(region, ".json.gz"))
  if (file.exists(f)) f else ""
}

#' Regiones con contornos empaquetados (códigos de departamento de dos dígitos).
#' @keywords internal
hojas_ruta_contornos_regiones <- function() {
  sort(sub("\\.json\\.gz$", "", list.files(hojas_ruta_contornos_dir(), pattern = "^[0-9]{2}\\.json\\.gz$")))
}

#' El JSON de una región tal como se sirve al lienzo; "" si la región no existe.
#' @keywords internal
hojas_ruta_contornos_region_json <- function(region) {
  f <- .hojas_ruta_contornos_archivo(region)
  if (!nzchar(f)) return("")
  con <- gzfile(f, "rt", encoding = "UTF-8")
  on.exit(close(con), add = TRUE)
  paste(readLines(con, warn = FALSE), collapse = "\n")
}

# Distritos de una región como los usa el PDF (ubigeo, distrito, rótulo, caja, anillos),
# leídos una vez por versión del archivo.
.hojas_ruta_contornos_region_distritos <- function(region) {
  f <- .hojas_ruta_contornos_archivo(region)
  if (!nzchar(f)) return(list())
  key <- paste(f, file.info(f)$size, as.numeric(file.info(f)$mtime), sep = "|")
  cached <- .hojas_ruta_contornos_cache[[key]]
  if (!is.null(cached)) return(cached)
  geo <- tryCatch(jsonlite::fromJSON(hojas_ruta_contornos_region_json(region), simplifyVector = FALSE), error = function(e) NULL)
  out <- lapply(geo$distritos$features %||% list(), function(feature) {
    props <- feature$properties %||% list()
    rings <- .hojas_ruta_geometry_rings(feature$geometry)
    if (!length(rings)) return(NULL)
    bbox <- .hojas_ruta_bbox_from_rings(rings)
    if (is.null(bbox)) return(NULL)
    list(
      ubigeo = .pulso_ceros_izq(6L, as.character(props$ubigeo %||% "")),
      distrito = as.character(props$distrito %||% ""),
      label_lon = suppressWarnings(as.numeric(props$label_lon %||% NA_real_)),
      label_lat = suppressWarnings(as.numeric(props$label_lat %||% NA_real_)),
      bbox = bbox,
      rings = rings
    )
  })
  out <- out[!vapply(out, is.null, logical(1))]
  .hojas_ruta_contornos_cache[[key]] <- out
  out
}

#' Distritos que rodean a uno: los de su región y, para Lima Metropolitana y el Callao, los
#' de ambas (son un solo continuo urbano en dos departamentos).
#' @keywords internal
hojas_ruta_contornos_contexto <- function(ubigeo) {
  region <- substr(.pulso_ceros_izq(6L, as.character(ubigeo %||% "")), 1, 2)
  regiones <- if (region %in% c("15", "07")) c("15", "07") else region
  unlist(lapply(regiones, .hojas_ruta_contornos_region_distritos), recursive = FALSE) %||% list()
}
