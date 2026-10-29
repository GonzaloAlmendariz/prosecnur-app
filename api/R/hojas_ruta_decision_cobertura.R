# Decisión de cobertura del marco elegible (ADR 0115 §4, revisión metodológica de U17).
#
# Con 10 % o más de la población de un distrito excluida por el marco elegible (por
# área o por mínimo de viviendas; lo que excluye la piloto no cuenta), el equipo
# tiene que registrar una decisión antes de EMITIR A CAMPO: el sorteo sigue libre
# para explorar. La decisión queda atada a la huella del marco: cambiar el mínimo
# o un área la invalida; cambiar semilla, N o cuotas no.

HOJAS_RUTA_COBERTURA_UMBRAL <- 0.10

#' Distritos que exigen decisión, a partir de `por_distrito` del marco elegible.
#' Devuelve una lista de {ubigeo, distrito, excluida} (proporción de población
#' excluida por área + mínimo). Población 0 no exige: no hay a quién perder.
hojas_ruta_marco_elegible_requiere_decision <- function(por_distrito) {
  filas <- Filter(is.list, por_distrito %||% list())
  out <- lapply(filas, function(f) {
    total <- suppressWarnings(as.numeric(f$total$poblacion %||% 0)[1])
    if (is.na(total) || total <= 0) return(NULL)
    excl <- sum(suppressWarnings(as.numeric(c(f$excluida_area$poblacion %||% 0, f$excluida_minimo$poblacion %||% 0))), na.rm = TRUE)
    p <- excl / total
    if (p < HOJAS_RUTA_COBERTURA_UMBRAL - 1e-9) return(NULL)
    list(ubigeo = as.character(f$ubigeo), distrito = as.character(f$distrito %||% ""), excluida = p)
  })
  Filter(Negate(is.null), out)
}

#' Huella del marco elegible: JSON canónico del marco normalizado, para que un ida
#' y vuelta por JSON o por state.rds (entero contra doble) no invalide una decisión.
hojas_ruta_marco_elegible_huella <- function(me) {
  me <- hojas_ruta_marco_elegible_normalizar(me)
  attr(me, "alertas") <- NULL
  json <- jsonlite::toJSON(me, auto_unbox = TRUE, digits = NA, null = "null", na = "null")
  digest::digest(as.character(json), algo = "xxhash64", serialize = FALSE)
}

#' La decisión vigente para un marco: la `decision_cobertura` más reciente (de
#' cualquier fase) con la misma huella y que cubra todos los distritos que hoy la
#' exigen. NULL si no hay.
hojas_ruta_decision_cobertura_vigente <- function(bitacora, huella, ubigeos) {
  ubigeos <- as.character(unlist(ubigeos, use.names = FALSE))
  for (e in rev(Filter(is.list, bitacora %||% list()))) {
    if (!identical(e$accion, "decision_cobertura")) next
    d <- e$detalle %||% list()
    if (!identical(as.character(d$marco_hash %||% ""), huella)) next
    if (all(ubigeos %in% as.character(unlist(d$ubigeos, use.names = FALSE)))) return(e)
  }
  NULL
}
