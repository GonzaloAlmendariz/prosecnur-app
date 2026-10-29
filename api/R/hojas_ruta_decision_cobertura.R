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

#' Estado de la decisión para un marco: qué distritos la exigen, la huella y la
#' entrada vigente (o NULL).
hojas_ruta_decision_cobertura_estado <- function(por_distrito, me, bitacora) {
  exigida <- hojas_ruta_marco_elegible_requiere_decision(por_distrito)
  huella <- hojas_ruta_marco_elegible_huella(me)
  ubigeos <- vapply(exigida, `[[`, character(1), "ubigeo")
  vigente <- if (length(exigida)) hojas_ruta_decision_cobertura_vigente(bitacora, huella, ubigeos) else NULL
  list(exigida = exigida, huella = huella, vigente = if (is.null(vigente)) NULL else as.integer(vigente$id %||% NA_integer_))
}

.hojas_ruta_cobertura_frase <- function(exigida) {
  paste(vapply(exigida, function(d) sprintf("%s pierde el %s %% de su población", if (nzchar(d$distrito)) d$distrito else d$ubigeo,
                                             formatC(100 * d$excluida, format = "f", digits = 1, decimal.mark = ",")), character(1)), collapse = "; ")
}

#' Anota el estado de la decisión en la muestra (`marco_elegible$decision_cobertura`)
#' y, si falta, el aviso W_COVERAGE_DECISION_MISSING. El sorteo no se bloquea.
hojas_ruta_decision_cobertura_en_muestra <- function(resultado, me, bitacora) {
  if (!is.list(resultado$marco_elegible)) return(resultado)
  est <- hojas_ruta_decision_cobertura_estado(resultado$marco_elegible$por_distrito, me, bitacora)
  resultado$marco_elegible$decision_cobertura <- est
  if (length(est$exigida) && is.null(est$vigente)) {
    aviso <- list(
      code = "W_COVERAGE_DECISION_MISSING", severity = "warning",
      message = sprintf("%s con el marco elegible y no hay una decisión registrada para este marco. Sin ella no se generan las hojas de campo.", .hojas_ruta_cobertura_frase(est$exigida)),
      ubigeos = as.list(vapply(est$exigida, `[[`, character(1), "ubigeo"))
    )
    resultado$alerts <- c(Filter(function(a) !identical(a$code, "W_COVERAGE_DECISION_MISSING"), resultado$alerts %||% list()), list(aviso))
  }
  resultado
}

#' Estado de la decisión para el run activo de la sesión (desde la muestra guardada).
.hojas_ruta_decision_cobertura_sesion <- function(sid) {
  active <- .hojas_ruta_active_run(sid)
  por_distrito <- active$run$workspace_outputs$sample$marco_elegible$por_distrito %||% list()
  me <- hojas_ruta_integrada_normalize_config(active$run$config %||% list())$marco_elegible
  c(list(fase = active$phase), hojas_ruta_decision_cobertura_estado(por_distrito, me, session_get(sid)$hojas_ruta_bitacora))
}

#' Antes de emitir a campo (ADR 0115 §4, enmienda U17): con distritos que exigen
#' decisión y ninguna vigente para este marco, 409. La piloto queda exenta.
.hojas_ruta_exigir_decision_cobertura <- function(sid) {
  est <- .hojas_ruta_decision_cobertura_sesion(sid)
  if (identical(est$fase, "pilot") || !length(est$exigida) || !is.null(est$vigente)) return(invisible(est))
  stop_api(409, "E_COVERAGE_DECISION_REQUIRED",
           sprintf("%s con el marco elegible. Registra la decisión de cobertura (redefinir la población o aceptar con justificación) antes de generar las hojas de campo.", .hojas_ruta_cobertura_frase(est$exigida)),
           details = list(ubigeos = as.list(vapply(est$exigida, `[[`, character(1), "ubigeo")), marco_hash = est$huella))
}
