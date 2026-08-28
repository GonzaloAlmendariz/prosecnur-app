# El objetivo contra el que Monitoreo mide el avance, leido del calculo de muestra.
#
# Hasta ahora la vista de Avance sumaba la meta de cada aula en juego —el
# `expected_valid` de cada curso-horario— y llamaba a esa suma «lo que pide el
# plan». Es una cifra legitima, pero contesta otra pregunta: dice cuanto se
# espera COSECHAR de las aulas sorteadas, no cuanto NECESITA el estudio. En
# HSVG2026 son 3 158 contra 2 500, y la diferencia no es ruido: es la holgura
# del diseno, un 26 %.
#
# Decidido por Gonzalo el 2026-08-28: **la meta es el `n_objetivo` del escenario
# ACTIVO del calculo de muestra**. No es un numero que este modulo elija; es el
# que el estudio ya declaro. Sigue la regla de la casa —«lo que declare el
# calculo de muestra es finalmente lo que el monitoreo y la generacion de
# recopiladores utiliza»— que hasta hoy no se cumplia aqui: **ningun archivo de
# monitoreo leia `calc_muestra_estudio`**.
#
# Por que el escenario ACTIVO y no el componente mas grande, ni el primero: un
# estudio puede declarar varios (HSVG2026 tiene «Nivel universidad» y «Nivel
# facultad») y solo uno esta activo e incluido en el reporte. Elegir por tamano
# o por orden seria inventar una politica que el estudio ya tomo.
#
# Y NO se lee `aulas_base_total` del componente para nada relacionado con el
# numero de aulas: ese campo se queda viejo cuando el sorteo se vuelve a correr
# —el componente activo de HSVG2026 dice 165 y el sorteo tiene 174, en ULT1 y en
# ULT2—. El numero de aulas se cuenta de la seleccion que corrio.

#' El escenario activo del estudio, o NULL.
#'
#' `activo` es el campo con el que el workspace marca cual rige. Si ninguno lo
#' esta —estudio a medio configurar— no se elige uno por descarte: se devuelve
#' NULL y quien llama decide, porque un objetivo equivocado es peor que ninguno.
#' @keywords internal
.maoe_escenario_activo <- function(estudio) {
  # Delega en la capa que posee el estudio. Tener aqui una segunda copia de
  # «cual es el activo» fue lo que dejo a los selectores de certificacion
  # acertando por orden en vez de por regla.
  .cm_estudio_escenario_activo(estudio)
}

#' El componente al que apunta un escenario, o NULL.
#' @keywords internal
.maoe_componente <- function(estudio, component_id) {
  id <- trimws(as.character(component_id %||% ""))
  if (!nzchar(id)) return(NULL)
  for (cmp in (estudio$componentes %||% list())) {
    if (!is.list(cmp)) next
    if (identical(trimws(as.character(cmp$id %||% "")), id)) return(cmp)
  }
  NULL
}

.maoe_num <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% NA_real_))
  if (length(v) != 1L || !is.finite(v) || v <= 0) NA_real_ else v
}

#' Objetivo de respuestas declarado por el escenario activo del estudio.
#'
#' @param estudio Contenido de `calc_muestra_estudio` en la sesion.
#' @return Lista con `objetivo` (el `n_objetivo`, respuestas que el estudio
#'   necesita), `operativo` (el `n_operativo`, con sobremuestra), `escenario`,
#'   `component_id` y `origen`. Cuando no se puede determinar, `objetivo` es
#'   `NA_real_` y `origen` dice por que: **el campo nunca se rellena con un
#'   sustituto**, porque una meta inventada se lee igual que una declarada y
#'   nadie podria distinguirlas en pantalla.
#' @export
monitoreo_aulas_objetivo_estudio <- function(estudio) {
  vacio <- function(motivo) list(
    objetivo = NA_real_, operativo = NA_real_,
    escenario = NA_character_, component_id = NA_character_, origen = motivo
  )
  if (!is.list(estudio) || !length(estudio)) return(vacio("sin_estudio"))
  esc <- .maoe_escenario_activo(estudio)
  if (is.null(esc)) return(vacio("sin_escenario_activo"))
  cmp <- .maoe_componente(estudio, esc$component_id)
  if (is.null(cmp)) return(vacio("componente_no_encontrado"))

  res <- cmp$resultado %||% list()
  # `n_objetivo` es la cifra redondeada al multiplo que el escenario declara;
  # `meta$valor` es la que el usuario tecleo. Coinciden cuando el estudio esta
  # bien formado, y si solo hay una se toma esa.
  objetivo <- .maoe_num(res$n_objetivo)
  if (is.na(objetivo)) objetivo <- .maoe_num((cmp$meta %||% list())$valor)
  if (is.na(objetivo)) return(vacio("escenario_sin_objetivo"))

  list(
    objetivo = objetivo,
    operativo = .maoe_num(res$n_operativo),
    escenario = as.character(esc$label %||% esc$id %||% ""),
    component_id = as.character(cmp$id %||% ""),
    origen = "escenario_activo"
  )
}
