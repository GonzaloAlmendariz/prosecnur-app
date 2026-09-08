# A14 — La vista de aulas que viaja en `config` dentro del estado de Monitoreo.
#
# El plan NO viaja dentro de `config`. Medido sobre 196 aulas: 333 KB de un
# payload de 934, y `dashboard$aulas_universitarias_reports$agenda` es un
# SUPERCONJUNTO estricto de esa copia —las mismas 196 filas con los mismos 80
# campos, mas `respuestas_validas` y `brecha`—, asi que no se pierde nada.
#
# Y esta siempre: el tablero de aulas se reconstruye en cada peticion desde
# `s$monitoreo_aulas_plan`, no depende de que exista snapshot, asi que el
# registro de campo lo tiene desde antes de la primera respuesta.
#
# Queda `plan_rows` porque hay una pregunta que sigue siendo del payload:
# cuantas unidades hay, que es lo que decide si se puede generar el libro.
# Mandar 333 KB para contar 196 filas es el intercambio que se deshace aqui.
#
# **Y ese conteo se hace desde la fuente veraz, que es la sesion.** El handoff
# de Recopiladores escribe `s$monitoreo_aulas_plan` (collection_engine.R:149) y
# JAMAS `cfg$aulas_universitarias`: un `.pulso` restaurado con el plan llegado
# por esa via traia 1.512 filas en sesion y la config con su default —plan
# vacio, enabled FALSE—. Contar `au$plan` aqui publicaba `plan_rows = 0` y el
# frontend (`aulasHayPlan`) escondia «Publicar/Generar libro» con el dato
# entero en sesion; el endpoint de publicar funcionaba perfecto con esa misma
# sesion. Sonda real: corrida_a6_ui.pulso, 2026-08-31.

#' La config de aulas convertida en payload de estado: conteo veraz, sin plan.
#'
#' Es DERIVACION de payload, no escritura de estado: la config almacenada no se
#' muta. `enabled` se deriva —un plan operable en sesion enciende el modulo
#' aunque la config nunca lo declarara (el handoff no la escribe)—, pero sin
#' unidades en ningun lado el gate sigue cerrado: el CTA correcto de un
#' proyecto recien abierto es «importar del calculo», no publicar.
#'
#' Las lecturas van con `[[`: `au$plan` con `plan` ausente y `plan_rows`
#' presente parcial-matchea el entero (la trampa ya mordida en
#' test-monitoreo-aulas-config-exacto.R).
#'
#' @param au `cfg$aulas_universitarias` (puede venir NULL o no-lista).
#' @param plan_sesion `s$monitoreo_aulas_plan` (lista de filas o NULL).
#' @return `au` con `plan_rows` y `enabled` derivados y SIN la clave `plan`
#'   (ausente, no NULL-presente).
#' @keywords internal
monitoreo_aulas_estado_payload <- function(au, plan_sesion = NULL) {
  if (!is.list(au)) au <- list()
  # La sesion manda cuando trae contenido; si no, el plan de la config (el
  # camino del import-from-calc, que escribe las dos). `%||%` no distingue
  # «viene vacio» de «no viene», por eso se compara por length().
  fuente <- if (length(plan_sesion)) plan_sesion else au[["plan"]] %||% list()
  plan_rows <- as.integer(length(fuente))
  au[["plan_rows"]] <- plan_rows
  au[["enabled"]] <- isTRUE(au[["enabled"]]) || plan_rows > 0L
  au[["plan"]] <- NULL
  .monitoreo_aulas_payload_sin_marco(au)
}

# A6 (loop estética-aulas-sheets, 2026-09-08): el estado no carga el marco
# entero. Medido con HSVG2026 (1.392 unidades): `/api/monitoreo/state` pesaba
# 61 MB y tardaba de 8 a 17 s aun en caliente —el «Preparando vista» de
# Avance—. ~54 MB eran las distribuciones del marco que Cálculo de muestra pega
# en la config (`quotas$profile_distributions` 22.312 filas,
# `quotas$sex_by_faculty` 22.062, `quotas$category_profiles` 22.317, y
# `profile_distributions` repetida en `methodology$representativity` y en
# `representativity`), y todo viajaba dos veces (en `config` y en el bloque
# `aulas_universitarias`). Ningún consumidor de Monitoreo las lee; Cálculo de
# muestra las lee de sus endpoints. Aquí se resumen en conteos (`*_n`); la
# sesión, el `.pulso` y los motores conservan las listas enteras.
.MONITOREO_AULAS_LISTAS_DEL_MARCO <- c("profile_distributions", "sex_by_faculty", "category_profiles")

.monitoreo_aulas_payload_sin_marco <- function(au) {
  recortar <- function(bloque) {
    if (!is.list(bloque)) return(bloque)
    for (k in intersect(.MONITOREO_AULAS_LISTAS_DEL_MARCO, names(bloque))) {
      bloque[[paste0(k, "_n")]] <- as.integer(length(bloque[[k]] %||% list()))
      bloque[[k]] <- NULL
    }
    bloque
  }
  au[["quotas"]] <- recortar(au[["quotas"]])
  au[["representativity"]] <- recortar(au[["representativity"]])
  if (is.list(au[["methodology"]])) {
    au[["methodology"]][["representativity"]] <- recortar(au[["methodology"]][["representativity"]])
  }
  au
}
