# Profundidad de la cadena de reemplazos, POR FACULTAD.
#
# El motor pedía 11 reemplazos por titular. Es un default hardcodeado sin
# criterio documentado, y la evidencia del estudio anterior dice que sobra por
# mucho: de 170 titulares de 2025, 146 no necesitaron ningún reemplazo, 21
# necesitaron uno y 2 necesitaron dos. NUNCA se usó un tercero.
#
# El costo de pedir 11 no es teórico: 190 titulares x 11 son 2.090 aulas
# comprometidas sobre un marco de 2.616 elegibles, el 80 %. Medido en HSVG2026,
# eso agota ESTUDIOS GENERALES CIENCIAS —314 aulas incluidas para 330 pedidas—
# y deja 64 de 190 cadenas incompletas.
#
# Criterio, decidido por Gonzalo el 2026-08-21: la profundidad de cada facultad
# es la que garantiza una COBERTURA del 99 %, con un PISO de 2 para las que no
# tienen caídas propias. Si un aula cae con probabilidad p, la cadena de k
# reemplazos se agota con probabilidad p^k, así que k = ceil(log(0.01)/log(p)).
#
# Dos salvaguardas, ambas por la misma razón que el umbral del tau propio (una
# facultad con pocos titulares no sostiene una estimación):
#
#  · La tasa se encoge hacia la global con pseudo-conteos. Sin esto, EDUCACION
#    —3 caídas en 4 titulares, p = 0,75— pediría 16 reemplazos por titular, más
#    que con el default que estamos corrigiendo.
#  · El resultado se capa: ninguna facultad pide más de `.cm_prof_max`. Un
#    número mayor no describe el riesgo, describe la falta de datos.

#' Cobertura objetivo de la cadena: la probabilidad de que NO se agote.
.cm_prof_cobertura <- 0.99
#' Piso para facultades sin caídas propias (Gonzalo: «mínimo de 2»). Cero caídas
#' en 16 aulas no prueba que nunca caiga ninguna.
.cm_prof_min <- 2L
#' Techo. Por encima de esto la cifra ya no describe riesgo sino ruido.
.cm_prof_max <- 6L
#' Pseudo-conteos del encogimiento hacia la tasa global.
.cm_prof_k0 <- 10

#' Tasa de caída por facultad desde las cadenas del estudio anterior.
#'
#' Cae un titular cuando su cadena registra más de un escalón aplicado: el
#' titular más al menos un reemplazo. Devuelve lista nombrada por clave de
#' facultad con `caidas` y `titulares`, más el agregado global.
#' @keywords internal
.cm_prof_caidas_por_facultad <- function(cadenas_filas) {
  acc <- list(); glob <- list(caidas = 0L, titulares = 0L)
  if (!is.list(cadenas_filas) || !length(cadenas_filas)) {
    return(list(por_facultad = acc, global = glob))
  }
  for (cadena in cadenas_filas) {
    if (!is.list(cadena)) next
    clave <- .cm_criterios_fac_key(cadena$facultad %||% "")
    if (!nzchar(clave)) next
    aplicados <- 0L
    for (escalon in (cadena$escalones %||% list())) {
      if (is.list(escalon) && identical(escalon$estado, "aplicado")) aplicados <- aplicados + 1L
    }
    if (aplicados <= 0L) next          # cadena sin ningún escalón aplicado: no informa
    cayo <- if (aplicados > 1L) 1L else 0L
    previo <- acc[[clave]] %||% list(caidas = 0L, titulares = 0L)
    acc[[clave]] <- list(caidas = previo$caidas + cayo, titulares = previo$titulares + 1L)
    glob$caidas <- glob$caidas + cayo
    glob$titulares <- glob$titulares + 1L
  }
  list(por_facultad = acc, global = glob)
}

#' Profundidad que garantiza la cobertura para una tasa de caída dada.
#' @keywords internal
.cm_prof_desde_tasa <- function(p, cobertura = .cm_prof_cobertura,
                                minimo = .cm_prof_min, maximo = .cm_prof_max) {
  if (!is.finite(p) || p <= 0) return(minimo)
  if (p >= 1) return(maximo)
  k <- ceiling(log(1 - cobertura) / log(p))
  if (!is.finite(k)) return(maximo)
  as.integer(min(maximo, max(minimo, k)))
}

#' Profundidad de cadena por facultad.
#'
#' @param cadenas_filas Filas de `referencia_asistencia$cadenas_reemplazo`.
#' @param default Profundidad para cuando no hay histórico del que estimar.
#' @return Lista con `por_facultad` (clave -> lista con profundidad, tasa cruda,
#'   tasa encogida y n de titulares), `global` y `fuente`.
#' @keywords internal
calc_muestra_aulas_profundidad_por_facultad <- function(cadenas_filas, default = .cm_prof_min) {
  d <- .cm_prof_caidas_por_facultad(cadenas_filas)
  if (d$global$titulares <= 0L) {
    return(list(por_facultad = list(), global = as.integer(default), fuente = "sin_historico"))
  }
  p_global <- d$global$caidas / d$global$titulares
  out <- list()
  for (clave in names(d$por_facultad)) {
    x <- d$por_facultad[[clave]]
    # Encogimiento hacia la global: sin esto una facultad con 4 titulares manda
    # sobre su propia profundidad con una tasa que no sostiene.
    p_enc <- (x$caidas + p_global * .cm_prof_k0) / (x$titulares + .cm_prof_k0)
    out[[clave]] <- list(
      profundidad = .cm_prof_desde_tasa(p_enc),
      tasa_cruda = if (x$titulares > 0) x$caidas / x$titulares else NA_real_,
      tasa_usada = p_enc,
      titulares = x$titulares
    )
  }
  list(
    por_facultad = out,
    global = .cm_prof_desde_tasa(p_global),
    fuente = "historico"
  )
}
