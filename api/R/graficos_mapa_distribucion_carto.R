# =============================================================================
# graficos_mapa_distribucion_carto.R — la cartografía del mapa de distribución: áreas, contexto y cómo casar respuestas
# =============================================================================
#
# Dos mapas (diseño aprobado por Gonzalo, 2026-11-02, lienzo «Maqueta de mapas territoriales»):
#   - `lima_callao`: los 50 distritos de Lima Metropolitana y el Callao (`hojas_ruta/cartografia/lima_district_coverage.json`,
#     con su población del Censo 2017 para la tasa); de contexto, Lima provincias de `cartografia/lima_zona.geojson`.
#   - `peru`: los departamentos (`cartografia/peru_departamentos.geojson`) con Lima partida en TRES áreas, porque así las
#     separa la pregunta (A5: «Lima Metropolitana», «Callao» y «Lima provincias»), recortadas de la misma forma para que
#     encajen (`cartografia/lima_zona.geojson`, precalculada por `build_lima_zona.R`). De contexto, los países vecinos
#     (`cartografia/peru_vecinos.geojson`).
# Se lee con `sf` (Imports) una vez por sesión de R.

.MAPA_DIST_CARTO <- new.env(parent = emptyenv())

#' Ruta de un archivo de cartografía del paquete (instalado o en el árbol de fuentes)
#' @keywords internal
.mapa_dist_archivo <- function(...) {
  rel <- c(...)
  cand <- c(do.call(system.file, c(as.list(rel), package = "prosecnurapp")),
            do.call(file.path, as.list(c(.app_api_dir(), "inst", rel))),
            do.call(file.path, as.list(c(getwd(), "api", "inst", rel))),
            do.call(file.path, as.list(c(getwd(), "inst", rel))))
  cand <- cand[nzchar(cand) & file.exists(cand)]
  if (length(cand)) cand[[1]] else NA_character_
}

#' Lee un GeoJSON del paquete como `sf` en WGS84, o `NULL`
#' @keywords internal
.mapa_dist_leer <- function(...) {
  p <- .mapa_dist_archivo(...)
  if (is.na(p)) return(NULL)
  x <- tryCatch(sf::st_read(p, quiet = TRUE), error = function(e) NULL)
  if (is.null(x)) return(NULL)
  sf::st_make_valid(sf::st_set_crs(sf::st_zm(x), 4326))
}

#' Un punto dentro de cada geometría (lon, lat): dónde apunta su rótulo
#' @keywords internal
.mapa_dist_centro <- function(g) {
  cc <- sf::st_coordinates(suppressWarnings(sf::st_point_on_surface(g)))
  data.frame(cx = cc[, "X"], cy = cc[, "Y"])
}

#' Cartografía de un área: `areas` (sf con `clave`, `nombre`, `cx`, `cy`, `pob`), `contexto` (sf con `nombre`, `rot_x`,
#' `rot_y`), `unidad` y, en el Perú, las claves de la zona de Lima
#' @return La lista, o `NULL` si el paquete no trae la cartografía.
#' @keywords internal
.mapa_distribucion_cartografia <- function(area) {
  if (!requireNamespace("sf", quietly = TRUE)) return(NULL)
  if (!is.null(.MAPA_DIST_CARTO[[area]])) return(.MAPA_DIST_CARTO[[area]])
  s2 <- suppressMessages(sf::sf_use_s2(FALSE)); on.exit(suppressMessages(sf::sf_use_s2(s2)), add = TRUE)
  suppressMessages(.mapa_distribucion_cartografia_armar(area))
}

#' @rdname dot-mapa_distribucion_cartografia
#' @keywords internal
.mapa_distribucion_cartografia_armar <- function(area) {
  dist <- .mapa_dist_leer("hojas_ruta", "cartografia", "lima_district_coverage.json")
  dep <- .mapa_dist_leer("cartografia", "peru_departamentos.geojson")
  zona <- .mapa_dist_leer("cartografia", "lima_zona.geojson")   # precalculada por build_lima_zona.R
  if (is.null(dist) || is.null(dep) || is.null(zona)) return(NULL)
  dist$ubigeo <- vapply(dist$ubigeo, .graficos_ubigeo6, "")
  lima <- dist[startsWith(dist$ubigeo, "1501") | startsWith(dist$ubigeo, "0701"), ]
  prov <- zona[zona$clave == "15P", ]
  out <- if (identical(area, "lima_callao")) {
    a <- sf::st_sf(clave = lima$ubigeo, nombre = .mapa_nombre_distrito(lima$distrito),
                   pob = suppressWarnings(as.numeric(lima$poblacion_2017)), geometry = sf::st_geometry(lima))
    # La tierra de contexto es Lima provincias recortada a la costa de los distritos: el departamento de Natural Earth
    # sobresalía de esa costa (Gonzalo, 2026-11-02: «que se recorten de la misma forma para que encajen bien»).
    list(areas = cbind(a, .mapa_dist_centro(a)),
         contexto = sf::st_sf(nombre = "", rot_x = NA_real_, rot_y = NA_real_, geometry = sf::st_geometry(prov)),
         unidad = "distrito", unidad_plural = "distritos", zona = NULL)
  } else {
    resto <- dep[!dep$ubigeo %in% c("15", "07"), ]
    a <- sf::st_sf(clave = c(resto$ubigeo, zona$clave), nombre = c(as.character(resto$departamento), as.character(zona$nombre)),
                   pob = NA_real_, geometry = c(sf::st_geometry(resto), sf::st_geometry(zona)))
    vec <- .mapa_dist_leer("cartografia", "peru_vecinos.geojson")
    ctx <- if (is.null(vec)) NULL else sf::st_sf(nombre = toupper(as.character(vec$pais)), rot_x = vec$rotulo_lon, rot_y = vec$rotulo_lat,
                                                geometry = sf::st_geometry(vec))
    list(areas = cbind(a, .mapa_dist_centro(a)), contexto = ctx, unidad = "departamento", unidad_plural = "departamentos",
         zona = c("15M", "07", "15P"))
  }
  .MAPA_DIST_CARTO[[area]] <- out
  out
}

#' Casa cada respuesta con su área: por nombre sin tildes y, si la etiqueta no nombra un área, por UBIGEO
#'
#' En el Perú, «Lima Metropolitana» (también «Provincia de Lima» y «Lima» a secas), «Callao» y «Lima provincias» son tres
#' áreas: el UBIGEO 1501… y el 15 de dos dígitos van a Lima Metropolitana, el resto del 15… a Lima provincias.
#' @return `filas` con la columna `clave` (NA si no casa).
#' @keywords internal
.mapa_distribucion_casar <- function(filas, carto, area) {
  clave_txt <- function(x) trimws(gsub("\\s+", " ", gsub("[^a-z ]", " ", .lam_clave(x))))
  cod <- trimws(as.character(filas$codigo))
  nombre <- clave_txt(filas$etiqueta)
  claves <- carto$areas$clave
  por_cod <- if (identical(area, "peru")) {
    vapply(cod, function(k) {
      if (!grepl("^[0-9]+$", k)) return(NA_character_)
      if (nchar(k) == 5L) k <- paste0("0", k)
      if (nchar(k) %in% c(4L, 6L)) return(if (startsWith(k, "1501")) "15M" else if (startsWith(k, "15")) "15P" else substr(k, 1, 2))
      if (nchar(k) == 2L) return(if (k == "15") "15M" else k)
      NA_character_
    }, "", USE.NAMES = FALSE)
  } else ifelse(grepl("^[0-9]{5,6}$", cod), sprintf("%06d", suppressWarnings(as.integer(cod))), NA_character_)
  if (identical(area, "peru")) {
    nombre[nombre %in% c("lima metropolitana", "provincia de lima", "lima", "lima metropolitana y callao")] <- "lima metropolitana"
    nombre[nombre %in% c("lima provincias", "provincias de lima", "lima region", "region lima")] <- "lima provincias"
    nombre[nombre %in% c("provincia constitucional del callao", "region callao")] <- "callao"
    nombre <- sub("^departamento de ", "", nombre)
  }
  por_nombre <- claves[match(nombre, clave_txt(carto$areas$nombre))]
  # El NOMBRE manda: el código de la lista no siempre es un UBIGEO. En el Perfil CCSS 2026 «16 = Lima provincias» se leía
  # como el departamento 16 (Loreto) y sus 6 casos se sumaban a Loreto; Lima provincias salía en 0. El código sólo decide
  # cuando la etiqueta no nombra ningún área.
  filas$clave <- ifelse(!is.na(por_nombre), por_nombre, ifelse(!is.na(por_cod) & por_cod %in% claves, por_cod, NA_character_))
  filas
}
