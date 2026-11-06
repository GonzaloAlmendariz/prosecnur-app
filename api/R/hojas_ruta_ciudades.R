# Ciudades del estudio en Hojas de ruta (paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md,
# R3; dirección A · Atlas). `integrated_config$ciudades` dice en qué ciudades se hace el estudio,
# aunque todavía no tengan distritos elegidos: «lima» (Lima Metropolitana y Callao) o el código de
# provincia del registro (`inst/hojas_ruta/territorios.json`, ADR 0119 §2). Todo sale del registro,
# nunca de prefijos de ubigeo.
#
# Invariante: ciudades ⊇ ciudad(territorios). Quitar una ciudad es una decisión de la UI, que manda
# `ciudades` y `territorios` juntos al confirmar (el borrador vive en `ui_state$draft_ciudades`).

.HOJAS_RUTA_PERFILES_LIMA <- c("lima", "callao")

.hojas_ruta_ciudad_de_provincia <- function(prov) {
  if (is.null(prov)) return(NA_character_)
  perfil <- as.character(prov$capas$manzanas$perfil %||% "")
  if (perfil %in% .HOJAS_RUTA_PERFILES_LIMA) "lima" else as.character(prov$codigo %||% NA_character_)
}

#' Ciudad de un distrito según el registro; NA si el distrito no está empaquetado.
#' @keywords internal
.hojas_ruta_ciudad_de_ubigeo <- function(ub) {
  .hojas_ruta_ciudad_de_provincia(.hojas_ruta_territorio_de_ubigeo(ub))
}

#' Códigos de ciudad válidos: «lima» más las provincias del registro que no son Lima ni Callao.
#' @keywords internal
.hojas_ruta_ciudades_validas <- function() {
  codigos <- vapply(hojas_ruta_territorios()$provincias %||% list(), .hojas_ruta_ciudad_de_provincia, "")
  sort(unique(c("lima", codigos[!is.na(codigos)])), method = "radix")
}

# Lo pedido, llevado a códigos de ciudad: el código de provincia de Lima o del Callao es «lima».
.hojas_ruta_ciudades_pedidas <- function(raw) {
  pedidas <- unique(as.character(unlist(raw %||% list(), use.names = FALSE)))
  pedidas <- pedidas[!is.na(pedidas) & nzchar(pedidas)]
  if (!length(pedidas)) return(character(0))
  provs <- hojas_ruta_territorios()$provincias %||% list()
  lima <- vapply(Filter(function(p) identical(.hojas_ruta_ciudad_de_provincia(p), "lima"), provs), function(p) as.character(p$codigo), "")
  pedidas[pedidas %in% lima] <- "lima"
  unique(pedidas)
}

#' Normaliza `ciudades`. Ausente (NULL) se deriva de `territorios`; vacía explícita se respeta y
#' se une con las ciudades de los distritos. Sale como lista (un solo código debe viajar como
#' arreglo en el JSON) ordenada con radix para que la huella sea determinista.
#' @keywords internal
.hojas_ruta_ciudades_normalizar <- function(raw, territorios) {
  pedidas <- intersect(.hojas_ruta_ciudades_pedidas(raw), .hojas_ruta_ciudades_validas())
  de_distritos <- vapply(as.character(unlist(territorios %||% list(), use.names = FALSE)), .hojas_ruta_ciudad_de_ubigeo, "")
  as.list(sort(unique(c(pedidas, de_distritos[!is.na(de_distritos)])), method = "radix"))
}

#' Códigos pedidos que la normalización descartó (no existen en el registro), para avisar.
#' @keywords internal
.hojas_ruta_ciudades_descartadas <- function(raw, cfg) {
  setdiff(.hojas_ruta_ciudades_pedidas(raw), as.character(unlist(cfg$ciudades %||% list(), use.names = FALSE)))
}
