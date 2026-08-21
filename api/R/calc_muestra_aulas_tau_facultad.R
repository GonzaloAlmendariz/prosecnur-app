# τ diferenciado por facultad (EF8b, era EFECTIVIDAD).
#
# Gonzalo, textual (2026-08-19, SUPERSEDE «referencial, no redimensionar»):
# «¿por qué estamos utilizando un indicador de efectividad del 53% en todas
# las facultades cuando cada facultad tiene su propia efectividad
# diferenciada? (…) podemos calcularla por facultad — eso de primeras.»
#
# ESPEJO EXACTO de tauPropioPorFacultad del sustento (frontend,
# sustentoDimensionamientoModel.ts): sobre los escalones APLICADOS de las
# cadenas 2025, Σefectivas/Σelegibles por facultad — la misma clase de tasa
# que el τ del diseño, no la asistencia bruta (otro denominador). Publica
# solo k ≥ 12 aulas aplicadas; con menos, el τ propio es ruido y el
# dimensionamiento cae al global DECLARÁNDOLO por fila.
#
# Paridad verificada sobre el payload vivo HSVG2026 (2026-08-19): DERECHO
# 0.562 (k=16) — MEJOR que el global 0.53; EGC 0.4279 (k=26) y EGL 0.4435
# (k=23) muy por debajo; C&I 0.538 (k=40) ≈ global. Seis facultades
# publicables; nueve con k<12 caen al global.

# POR QUÉ 12 Y POR QUÉ UN CORTE DURO, evaluado el 2026-08-21 sobre HSVG2026
# a pedido de Gonzalo. Se midió la alternativa —encogimiento parcial, que en vez
# de saltar de 1 al valor crudo acerca la razón O/E a 1 cuanto menos respaldo
# tiene— con Bayes empírico sobre las 194 aulas aplicadas de 2025:
#
#   varianza observada entre facultades  0,0301
#   error medio de estimación            0,0203
#   varianza REAL entre facultades (τ²)  0,0099   -> sd ≈ 0,10
#
# Es decir: DOS TERCIOS de las diferencias que hoy se ven entre facultades son
# ruido de estimación, no diferencia verdadera. Eso es un argumento A FAVOR de
# encoger, y el corte duro tiene además una incoherencia demostrada: ARTES
# ESCÉNICAS (k=11) se estima con MENOS error que ARTE Y DISEÑO (k=12) —se 0,067
# contra 0,086— y sin embargo recibe razón neutra mientras la otra recibe la
# suya entera. El umbral corta por el CONTEO, no por la precisión.
#
# Aun así NO se aplica, por dos razones medidas:
#
#  1. El beneficio es chico: 190 titulares contra 192, y sólo 5 facultades se
#     mueven (ARQ -1, C&I +1, DERECHO +2, EGL +1, GASTRONOMÍA -1).
#  2. La fórmula ingenua premia la casualidad. GASTRONOMÍA, con k=3, recibiría
#     peso 0,93 —más que C&I con k=40— porque sus tres aulas rindieron parecido
#     y la varianza muestral de tres observaciones no mide nada. Su tasa saltaría
#     de 0,6464 a 0,8518 y perdería un aula.
#
# Aplicarlo exige una salvaguarda explícita para k pequeño (encoger también la
# estimación del error, o capar el peso por k). Mientras no exista, el corte duro
# es peor en teoría y más seguro en campo, y esa es la decisión vigente.
#
# Guion para retomarlo: scratchpad `encogimiento.R` e `impacto.R` de la sesión
# del 2026-08-21 reproducen las tres tablas sobre el .pulso de trabajo.
.cm_tau_k_minimo <- 12L

#' τ propio por facultad desde las filas de cadenas de la referencia
#' (`referencia_asistencia$cadenas_reemplazo$filas`). Devuelve una lista
#' nombrada por clave de facultad: list(tau=, k=) solo para k >= k_minimo.
.cm_tau_por_facultad <- function(cadenas_filas, k_minimo = .cm_tau_k_minimo) {
  out <- list()
  if (!is.list(cadenas_filas) || !length(cadenas_filas)) return(out)
  acc <- list()
  for (cadena in cadenas_filas) {
    if (!is.list(cadena)) next
    clave <- .cm_criterios_fac_key(cadena$facultad %||% "")
    if (!nzchar(clave)) next
    for (escalon in (cadena$escalones %||% list())) {
      if (!is.list(escalon) || !identical(escalon$estado, "aplicado")) next
      efectivas <- .cm_aulas_num(escalon$efectivas, NA_real_)
      elegibles <- .cm_aulas_num(escalon$elegibles, NA_real_)
      if (!is.finite(efectivas) || !is.finite(elegibles) || elegibles <= 0) next
      previo <- acc[[clave]] %||% list(efectivas = 0, elegibles = 0, k = 0L)
      previo$efectivas <- previo$efectivas + efectivas
      previo$elegibles <- previo$elegibles + elegibles
      previo$k <- previo$k + 1L
      acc[[clave]] <- previo
    }
  }
  for (clave in names(acc)) {
    d <- acc[[clave]]
    if (d$k >= k_minimo && d$elegibles > 0) {
      out[[clave]] <- list(tau = d$efectivas / d$elegibles, k = d$k)
    }
  }
  out
}

# `.cm_tau_para_dimensionar()` vivía acá y se retiró el 2026-08-21. Resolvía
# «usa el τ propio de la facultad si es publicable, el global si no», y NUNCA
# tuvo consumidor en producción: sólo la llamaban sus propios tests.
#
# No se reconecta, se retira, porque describe un dimensionamiento que NO es el
# que hace el motor y que además sería peor. El motor no elige entre dos tasas:
# compone una sola por estandarización, τ = composición por tamaño × razón
# observado/esperado, y con k < 12 la razón se fija en 1 (la facultad conserva
# su composición, que es propia). El τ global sólo entra cuando el estudio
# ENTERO no declara histórico, y entonces rige para las quince.
#
# La firma retirada decía lo contrario —que una facultad con pocas aulas cae a
# una tasa general— y ése es exactamente el malentendido que Gonzalo reportó al
# leer la pantalla ese día. Un camino descartado que sigue escrito se lee como
# el camino vigente.
