# Sello de efectividad por facultad, derivado del histórico.
#
# EL HUECO QUE CIERRA. `cfg$efectividad$por_facultad` lo lee el motor desde que
# se escribió (calc_muestra_aulas_efectividad.R:290-327) y de ahí sale
# `factor_facultad`, la F de `τ = E × R(tamaño) × F(facultad)` que
# docs/qa/criterios-dimensionamiento-aulas-2026-08-21.md declara como veredicto
# vigente. Pero NADIE lo escribía: medido el 2026-08-25 sobre los seis `.pulso`
# del repo —acnur_acg, acnur_pdm, acrconta, acrconta_mazo, hsvg2026 y el de
# auditoría—, `efectividad` era NULL en los seis, así que `factor_facultad`
# valía 1 en las 5.269 filas del marco y las quince facultades dimensionaban
# con la misma tasa. La UI incluso afirmaba lo contrario: «su factor de
# facultad, que YA está dentro de la tasa que dimensiona».
#
# QUÉ ES EL MULTIPLICADOR, en palabras de Gonzalo (2026-08-25): «un multiplicador
# que se basa en el rendimiento del año pasado, en donde si un aula rindió un
# poco más o un poco menos se aplica, y tiene que ver con k, el número de aulas
# aplicadas. A partir de doce aulas en adelante podemos predecir; si tenemos
# once o menos, usamos simplemente el multiplicador neutro que es uno.»
#
# NO ES `.cm_tau_para_dimensionar()`, que se retiró el 2026-08-21 y NO se
# reconecta: aquella elegía ENTRE dos tasas (la propia o la global) y eso no es
# lo que hace el motor. Esto compone: el motor sigue calculando su τ por tamaño
# y este factor lo corrige por lo que esa facultad rindió de más o de menos.
#
# EL DENOMINADOR LO DECIDIÓ GONZALO (2026-08-25): **esperado ponderado por
# elegibles**. Se midieron cuatro variantes sobre DERECHO y ninguna reproduce el
# 1,115 que cita el comentario de un sello viejo (ponderado 1,015 · media simple
# 1,006 · con tasa de aplicación 1,197 · mediana 1,022), señal de que aquel
# sello se armó con curvas distintas de las embebidas hoy. Se deja constancia
# para que nadie lo lea como una regresión.
.cm_sello_k_minimo <- 12L

#' Multiplicador de facultad desde las cadenas del histórico.
#'
#' @param cadenas_filas `referencia_asistencia$cadenas_reemplazo$filas`.
#' @param k_minimo aulas aplicadas mínimas para publicar (12 por decisión).
#' @return lista nombrada por clave de facultad con `tau` (el multiplicador),
#'   `k` y `suficiencia`. Sólo las que llegan al mínimo; el resto no lleva
#'   entrada y el motor las deja en 1, que es el neutro declarado.
#' @export
calc_muestra_aulas_sello_por_facultad <- function(cadenas_filas,
                                                  k_minimo = .cm_sello_k_minimo) {
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
      previo <- acc[[clave]] %||% list(efectivas = 0, elegibles = 0,
                                       esperadas = 0, k = 0L,
                                       etiqueta = as.character(cadena$facultad %||% ""))
      previo$efectivas <- previo$efectivas + efectivas
      previo$elegibles <- previo$elegibles + elegibles
      # El esperado de ESE aula según la curva de rendimiento por tamaño, en
      # efectivas. Sumarlo aquí y dividir al final por los elegibles totales es
      # exactamente el ponderado por elegibles que se decidió: las aulas
      # grandes pesan lo que aportan, no una por una.
      previo$esperadas <- previo$esperadas +
        .cm_efectividad_rendimiento(elegibles) * elegibles
      previo$k <- previo$k + 1L
      acc[[clave]] <- previo
    }
  }
  for (clave in names(acc)) {
    d <- acc[[clave]]
    if (d$k < k_minimo || d$elegibles <= 0 || d$esperadas <= 0) next
    observado <- d$efectivas / d$elegibles
    esperado <- d$esperadas / d$elegibles
    if (!is.finite(observado) || !is.finite(esperado) || esperado <= 0) next
    multiplicador <- observado / esperado
    # El mismo tope que acepta el normalizador del sello: un factor mayor a 2
    # no describe una facultad, describe un error de datos.
    if (!is.finite(multiplicador) || multiplicador <= 0 || multiplicador > 2) next
    out[[clave]] <- list(
      facultad = d$etiqueta,
      tau = multiplicador,
      k = d$k,
      suficiencia = if (d$k >= 30L) "solida" else "delgada",
      aplicar = TRUE,
      observado = observado,
      esperado = esperado
    )
  }
  out
}

#' Sella la calibración por facultad dentro de la config del marco.
#'
#' Aditivo y conservador: si el estudio YA declara `efectividad$por_facultad`
#' —alguien lo selló a mano o vino en el `.pulso`— no se toca. Una declaración
#' explícita manda sobre una derivada, que es la regla de la casa en todo el
#' módulo.
#'
#' @param config config del marco ya normalizada.
#' @param referencia `s$calc_muestra_referencia_asistencia` de la sesión.
#' @return la config, con `efectividad` sellada cuando hubo con qué.
#' @export
calc_muestra_aulas_sellar_efectividad <- function(config, referencia = NULL) {
  if (!is.list(config)) return(config)
  ya <- config$efectividad
  if (is.list(ya) && length(ya$por_facultad %||% list())) return(config)
  filas <- referencia$cadenas_reemplazo$filas %||% NULL
  sello <- calc_muestra_aulas_sello_por_facultad(filas)
  if (!length(sello)) return(config)
  ef <- if (is.list(ya)) ya else list()
  ef$fuente <- "historico"
  ef$periodo <- as.character(referencia$periodo %||% ef$periodo %||% "")
  # `tau_base = 1` porque lo que se guarda en cada entrada YA es el
  # multiplicador, no una tasa: el motor calcula `factor = tau / tau_base` y con
  # base 1 el factor ES el multiplicador. La cabecera de
  # calc_muestra_aulas_efectividad.R lo contempla explícitamente.
  ef$tau_base <- 1
  ef$por_facultad <- unname(lapply(sello, function(e) {
    list(facultad = e$facultad, tau = e$tau, k = e$k,
         suficiencia = e$suficiencia, aplicar = TRUE)
  }))
  config$efectividad <- ef
  config
}

# EL SEGUNDO ESLABÓN, DIAGNOSTICADO Y NO CABLEADO (2026-08-25).
#
# Sellar el multiplicador mueve `factor_facultad` dentro del marco —medido: de
# un único valor a siete distintos, 0,861 a 1,015— pero el DIMENSIONAMIENTO
# sigue sin verlos: la tabla por facultad publica «TASA DE EFECTIVIDAD 53,0 %»
# idéntica en las quince y el total se queda en 184 en vez de ~190.
#
# La cadena, hasta donde llegó el rastreo: `.cm_dist_ch_required_one(quota,
# divisor, tau)` toma su τ de `aulas_result$rows[[faculty_key]]$tau`
# (calc_muestra_distribucion.R:469), que sale de `result$aulas_por_estrato`,
# que `calc_muestra_engine.R:1365` calcula con
# `tau_e <- if (e$tau > 0) e$tau else par$tau` sobre los estratos del
# componente. **Y esos estratos están vacíos**: medido sobre el `.pulso` real,
# los dos componentes traen `estratos: 0`, también DESPUÉS de
# `calc_muestra_alumnos_por_ch_resolver_estudio()`. Las quince filas por
# facultad se arman en un punto que este rastreo no localizó.
#
# Se escribió una función que bajaba `frame$tasas_efectividad_facultad` a
# `comp$estratos[[j]]$tau` y SE RETIRÓ: sin estratos no hacía nada, y dejar
# código que no se ejecuta es exactamente lo que el ADR 0080 prohíbe («un
# camino descartado que sigue escrito se lee como el camino vigente»).
#
# QUÉ FALTA, concreto: encontrar quién construye las filas por facultad del
# cálculo y darles el τ del marco allí. La aritmética ya está comprobada: con
# el multiplicador 0,861 de EEGG Ciencias su τ pasa de 0,506 a 0,436 y sus
# aulas de 25 a 30, que es justo lo que dice el documento metodológico.
