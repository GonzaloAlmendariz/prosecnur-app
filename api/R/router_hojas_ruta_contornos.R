# Contornos de una región para el lienzo de Hojas de ruta (paquete por regiones, R2).
# Router delgado: valida el código de región y sirve el JSON empaquetado tal cual
# (`hojas_ruta_contornos_region_json()`, hojas_ruta_contornos.R). No depende de la
# sesión: los contornos son del registro, no del estudio.

mount_hojas_ruta_contornos <- function(pr) {
  pr |>
    plumber::pr_get("/api/hojas-ruta/contornos", wrap_endpoint(function(req, res, region = NULL) {
      region <- trimws(as.character(region %||% ""))
      if (!grepl("^[0-9]{2}$", region)) {
        stop_api(400, "E_HOJAS_RUTA_REGION", "La región es un código de departamento de dos dígitos.")
      }
      body <- hojas_ruta_contornos_region_json(region)
      if (!nzchar(body)) {
        stop_api(404, "E_HOJAS_RUTA_REGION_SIN_CONTORNOS", "Esa región no tiene cartografía empaquetada.")
      }
      res$setHeader("Content-Type", "application/json; charset=utf-8")
      res$setHeader("Content-Length", as.character(nchar(body, type = "bytes")))
      res$body <- body
      res
    })) |>
    # Año y fuente de la cartografía de manzanas por provincia (hojas_ruta_cartografia_ciudad.R): el inspector
    # la pide para la ciudad abierta. Tampoco depende de la sesión.
    plumber::pr_get("/api/hojas-ruta/cartografia", wrap_endpoint(function(req, res, ubigeos = NULL) {
      list(ok = TRUE, provincias = hojas_ruta_cartografia_de_ciudad(strsplit(as.character(ubigeos %||% ""), ",", fixed = TRUE)[[1]]))
    }))
}
