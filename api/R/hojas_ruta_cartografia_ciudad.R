# hojas_ruta_cartografia_ciudad.R — de qué año y de qué fuente es la cartografía de manzanas de una ciudad.
#
# El `frame_meta` del estado publica la cartografía del paquete de Lima y Callao para todo estudio, y con otra
# ciudad abierta el inspector seguía diciendo «Lima 2017 · Callao 2019». La cobertura de cada provincia sale del
# registro territorios.json (ADR 0119 §2, `.hojas_ruta_cartografia_profile_for_ubigeo()`); aquí se lee por
# provincia, sin tocar el motor.

#' Cartografía de manzanas por provincia de los ubigeos pedidos, sin repetir provincia. Pura.
#' @keywords internal
hojas_ruta_cartografia_de_ciudad <- function(ubigeos = character(0)) {
  u <- unique(.pulso_ceros_izq(6L, trimws(as.character(unlist(ubigeos %||% character(0))))))
  u <- u[grepl("^[0-9]{6}$", u)]
  por_provincia <- u[!duplicated(substr(u, 1L, 4L))]
  lapply(por_provincia, function(x) {
    p <- tryCatch(.hojas_ruta_cartografia_profile_for_ubigeo(x), error = function(e) NULL)
    if (is.null(p)) return(list(provincia = substr(x, 1L, 4L), disponible = FALSE))
    list(provincia = substr(x, 1L, 4L), disponible = TRUE, cobertura = as.character(p$coverage %||% ""),
         anio = as.integer(p$year %||% NA_integer_), fuente = as.character(p$source %||% ""),
         proveedor = as.character(p$provider %||% ""))
  })
}
