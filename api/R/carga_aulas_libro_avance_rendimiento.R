# carga_aulas_libro_avance_rendimiento.R — la tabla «RENDIMIENTO POR FACULTAD».
#
# Dictado de Gonzalo (2026-09-08): «Luego es necesario una tabla de RENDIMIENTO
# POR FACULTAD, la cual tendrá las siguientes columnas: Facultad, Aulas
# aplicadas, Aulas planificadas, Tasa de rendimiento de facultad esperado, Tasa
# obtenida hasta el momento, Diferencia, Aulas adicionales solicitadas hasta el
# momento». Y, sobre los rótulos: «la "tasa de facultad" es en realidad la
# "Tasa de rendimiento de la facultad" y debe tener ese nombre».
#
# **Qué pregunta contesta que ninguna otra tabla contestaba.** «Avance por
# facultad» dice cuánto falta para la cuota; ésta dice POR QUÉ. Una facultad
# puede ir corta porque no se ha ido a sus aulas todavía (aplicadas ≪
# planificadas) o porque sus aulas rinden por debajo de lo que el diseño supuso
# (tasa obtenida < esperada), y las dos situaciones piden cosas distintas: ir, o
# pedir aulas adicionales. La última columna es justo cuántas se pidieron ya.
#
# LOS DOS DENOMINADORES, QUE NO SON EL MISMO
#
# La tasa de rendimiento es efectivas por ELEGIBLE, y su denominador son los
# elegibles de las aulas YA APLICADAS —no los del plan entero—. Con el plan
# entero la tasa obtenida del día 1 saldría cerca de cero en las quince
# facultades y no diría nada sobre cómo rinden las aulas a las que sí se fue:
# diría que todavía no se ha ido, que es lo que ya dicen las dos primeras
# columnas.

#' La tasa de rendimiento ESPERADA de una facultad, ponderada por elegibles.
#'
#' **No es el promedio de las tasas de sus aulas.** `rendimiento_ref` viaja por
#' AULA —sale de los tramos de elegibles del cálculo— y dentro de una misma
#' facultad va de 44 % a 80 %. Promediar esas tasas da un número que no es la
#' tasa de nadie y que además depende de cuántas aulas chicas tenga el plan.
#'
#' Se vio publicado el 2026-09-08: en «Producción por aplicador» la columna
#' «Tasa de rendimiento esperada EN FACULTAD» enseñaba 69,0 % para una persona y
#' 55,0 % para la de al lado, en la misma facultad — la columna prometía una
#' vara de facultad y entregaba la media de las aulas de cada quien.
#'
#' Lo correcto es la razón de los agregados: cuántas efectivas espera el diseño
#' de esa facultad entre cuántos elegibles pone. Sale UNA por facultad, y es la
#' misma en las tres tablas que la citan.
#'
#' @param esperadas,elegibles vectores por aula de la facultad.
#' @return la tasa, o `NA_real_` sin elegibles con que dividir.
#' @keywords internal
.calar_tasa_esperada <- function(esperadas, elegibles) {
  ok <- is.finite(esperadas) & is.finite(elegibles) & elegibles > 0
  if (!any(ok)) return(NA_real_)
  den <- sum(elegibles[ok])
  if (!is.finite(den) || den <= 0) return(NA_real_)
  sum(esperadas[ok]) / den
}

#' Rendimiento por facultad: lo aplicado, lo esperado y la brecha de tasa.
#'
#' @param unidades filas del plan que entran al libro (titulares + reservas
#'   activadas). Es el mismo insumo que la tabla por facultad.
#' @param efectivas vector con nombre por código operativo (PLATAFORMA).
#' @param partes partes de campo, para el eje de aplicación.
#' @param extras banco de extras SIN activar (`aulas_libro_extras_banco()`).
#' @return `data.frame` con las columnas de `AULAS_AVANCE_CABECERAS$rendimiento`,
#'   o `NULL` si el plan no trae facultades.
#' @keywords internal
.calar_rendimiento_por_facultad <- function(unidades, efectivas = NULL, partes = list(),
                                            extras = list()) {
  unidades <- unidades %||% list()
  if (!length(unidades)) return(NULL)

  fac <- vapply(unidades, function(u) .cai_txt(u$faculty), character(1))
  if (!any(nzchar(fac))) return(NULL)
  cod <- vapply(unidades, function(u) .cai_txt(u$operational_code), character(1))
  rol <- vapply(unidades, function(u) tolower(.cai_txt(u$sample_role)), character(1))
  eleg <- vapply(unidades, function(u) .cai_num(u$eligible_n), numeric(1))
  esperadas <- vapply(unidades, function(u) .cai_num(u$expected_valid), numeric(1))

  # UNA sola definición de «aplicada» para todo el operativo.
  apl <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)

  ef_fila <- vapply(cod, function(k) {
    if (is.null(efectivas)) return(NA_real_)
    i <- match(k, names(efectivas))
    if (is.na(i)) 0 else suppressWarnings(as.numeric(efectivas[[i]]))
  }, numeric(1))

  # **«Aulas adicionales solicitadas» son LAS DOS FAMILIAS SUMADAS** (Gonzalo,
  # 2026-09-08): «cualquier aula pedida de más sobre el plan original, venga del
  # banco o la haya conseguido el equipo por su cuenta».
  #
  #   · las reservas del banco YA ACTIVADAS, que viven en `unidades` porque
  #     tienen parte o control;
  #   · las del banco que el equipo ya AGENDÓ en las hojas «(Extra)» del Sheets
  #     y todavía no aplicó — llegan por `extras`, que es el banco sin activar.
  #
  # Las dos listas son disjuntas por construcción (`.calg_unidades_del_libro()`
  # y `aulas_libro_extras_banco()` se reparten el plan), así que sumarlas no
  # duplica. Una fila del banco que nadie tocó NO cuenta: está disponible, no
  # solicitada, y contarla diría que se pidieron cuarenta y cinco aulas el día
  # que no se pidió ninguna.
  agendadas_extra <- list()
  for (u in (extras %||% list())) {
    if (!nzchar(.cai_txt(u$scheduled_date))) next
    k <- .cai_txt(u$faculty)
    if (!nzchar(k)) next
    agendadas_extra[[k]] <- (agendadas_extra[[k]] %||% 0L) + 1L
  }

  facultades <- unique(c(fac[nzchar(fac)], names(agendadas_extra)))
  filas <- lapply(facultades, function(f) {
    idx <- fac == f
    aplicadas <- idx & apl
    # El denominador de la tasa obtenida: los elegibles de las aulas aplicadas.
    eleg_apl <- sum(eleg[aplicadas & is.finite(eleg)], na.rm = TRUE)
    ef_apl <- if (is.null(efectivas)) NA_real_ else sum(ef_fila[aplicadas], na.rm = TRUE)
    # La vara de la facultad: lo que el diseño espera de TODAS sus aulas entre
    # los elegibles que pone. Constante a lo largo del operativo, y la misma
    # cifra que citan las otras dos tablas.
    esperada <- .calar_tasa_esperada(esperadas[idx], eleg[idx])
    obtenida <- if (is.finite(ef_apl) && eleg_apl > 0) ef_apl / eleg_apl else NA_real_
    # **Lo mismo en ENCUESTAS.** «Esperadas hasta ahora» son los elegibles de las
    # aulas YA APLICADAS por la tasa que el diseño le puso a la facultad: cuántas
    # fichas deberían haber salido de las aulas a las que se fue. Una tasa dice
    # si el aula rinde; esto dice cuántas encuestas son, que es lo que se recoge
    # y lo que falta para la cuota.
    esp_ahora <- if (is.finite(esperada) && eleg_apl > 0) esperada * eleg_apl else NA_real_
    out <- data.frame(
      f,
      sum(aplicadas),
      sum(idx & rol == "titular"),
      if (is.finite(esp_ahora)) round(esp_ahora) else NA_real_,
      if (is.finite(ef_apl)) ef_apl else NA_real_,
      if (is.finite(esp_ahora) && is.finite(ef_apl)) ef_apl - round(esp_ahora) else NA_real_,
      esperada,
      obtenida,
      if (is.finite(esperada) && is.finite(obtenida)) obtenida - esperada else NA_real_,
      # Una reserva de CADENA reemplaza a un titular que cayó: no es un aula de
      # más y no cuenta aquí. Sí cuentan la extra activada y la extra que el
      # equipo ya agendó en las hojas «(Extra)».
      sum(idx & rol == "extra_reserve_pool") + (agendadas_extra[[f]] %||% 0L),
      stringsAsFactors = FALSE
    )
    names(out) <- AULAS_AVANCE_CABECERAS$rendimiento
    out
  })
  out <- do.call(rbind, filas)
  # Por la brecha de tasa y de peor a mejor: la facultad que más rinde por
  # debajo de lo previsto abre la tabla. Sin brecha computable, al final.
  dif <- out[["Diferencia de tasa"]]
  out[order(ifelse(is.finite(dif), dif, Inf), out$Facultad), , drop = FALSE]
}
