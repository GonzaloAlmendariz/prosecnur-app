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

#' El reparto por sexo de lo ESPERADO, con la proporción del propio diseño.
#'
#' **Es una derivación declarada, no un dato.** El plan trae `expected_valid` y
#' `eligible_n` por aula, y ninguno de los dos viene partido por sexo: nadie
#' sabe cuántos hombres y cuántas mujeres se sientan en un aula concreta antes
#' de ir. Lo que sí existe es el reparto que el DISEÑO hizo de la cuota de esa
#' facultad (`cuota_sexo`), y es el único reparto defendible: es el mismo con el
#' que se juzgará si la facultad cumplió.
#'
#' Se reparte el total y la mujer se lleva el residuo, para que las dos celdas
#' sumen exactamente la esperada y no se abra una tercera cifra por redondeo.
#'
#' Sin cuota por sexo devuelve `NA` en las dos: la columna calla en vez de
#' inventar un cincuenta por ciento.
#'
#' @param total esperada de la facultad (ya redondeada).
#' @param cuota_m,cuota_f cuota por sexo del diseño.
#' @return lista `{M, F}`.
#' @keywords internal
.calar_reparto_esperado <- function(total, cuota_m, cuota_f) {
  vacio <- list(M = NA_real_, F = NA_real_)
  if (!is.finite(total)) return(vacio)
  if (!is.finite(cuota_m) || !is.finite(cuota_f)) return(vacio)
  den <- cuota_m + cuota_f
  if (!is.finite(den) || den <= 0) return(vacio)
  m <- round(total * cuota_m / den)
  list(M = m, F = total - m)
}

#' Rendimiento por facultad: lo aplicado, lo esperado y la brecha de tasa.
#'
#' @param unidades filas del plan que entran al libro (titulares + reservas
#'   activadas). Es el mismo insumo que la tabla por facultad.
#' @param efectivas vector con nombre por código operativo (PLATAFORMA).
#' @param partes partes de campo, para el eje de aplicación.
#' @param extras banco de extras SIN activar (`aulas_libro_extras_banco()`).
#' @param cuotas bloque `design_targets` de la config, para las metas y su
#'   reparto por sexo.
#' @param responses respuestas, para el reparto por sexo de lo obtenido.
#' @param cfg config de aulas, para localizar la columna de sexo.
#' @return `data.frame` con las columnas de `AULAS_AVANCE_CABECERAS$rendimiento`,
#'   o `NULL` si el plan no trae facultades.
#' @keywords internal
.calar_rendimiento_por_facultad <- function(unidades, efectivas = NULL, partes = list(),
                                            extras = list(), cuotas = NULL,
                                            responses = NULL, cfg = list()) {
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

  # **Las metas y el reparto por sexo, del MISMO sitio que la tabla por
  # facultad.** Gonzalo, 2026-09-08: «le falta lo mismo pero desglosado por sexo
  # y la meta y meta por sexo». La meta es la cuota del diseño —no la suma de
  # metas por aula, que es otro denominador (ADR 0079)— y se localiza por la
  # clave de facultad, no por el nombre escrito.
  clave <- .cm_criterios_fac_key(fac)
  metas <- list()
  for (f in (if (is.list(cuotas)) (cuotas$facultades %||% list()) else list())) {
    k <- .cai_txt(f$faculty_key %||% .cm_criterios_fac_key(.cai_txt(f$facultad)))
    if (!nzchar(k)) next
    cs <- f$cuota_sexo %||% list()
    metas[[k]] <- list(total = .cai_num(f$cuota), M = .cai_num(cs$M), F = .cai_num(cs$F))
  }

  # Lo OBTENIDO por sexo, del mismo cruce que usa la tabla por facultad: dos
  # cruces del mismo dato se separan en cuanto uno cambia.
  sexo_aula <- tryCatch(
    monitoreo_aulas_efectivas_por_sexo(unidades, responses, cfg),
    error = function(e) NULL
  )
  con_reparto <- length(sexo_aula) > 0L
  sexo_fila <- lapply(cod, function(k) {
    v <- if (con_reparto) (sexo_aula[[k]] %||% NULL) else NULL
    if (!length(v)) return(c(M = if (con_reparto) 0 else NA_real_,
                             F = if (con_reparto) 0 else NA_real_))
    et <- monitoreo_aulas_sexo_key(names(v), cfg)
    c(M = sum(as.numeric(v[et == "M"])), F = sum(as.numeric(v[et == "F"])))
  })


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
    # **Lo mismo en ENCUESTAS: la suma de las metas de las aulas ya aplicadas.**
    #
    # La primera versión lo calculaba como `tasa de la facultad × elegibles de
    # las aulas aplicadas`, que es la otra lectura de lo que pidió Gonzalo («las
    # esperadas hasta ahora en base a las aulas aplicadas hasta hoy y la tasa de
    # rendimiento de facultad»). Medido sobre el operativo, las dos dan casi lo
    # mismo en ocho de nueve facultades y se separan en Artes Escénicas (−4,5
    # contra −12,3). Manda ésta por dos razones:
    #
    #   · es la MISMA cifra que ya publica la Base de control aula por aula
    #     («EFECTIVAS ESPERADAS»), así que sumar esa columna sobre las aulas
    #     aplicadas de una facultad da exactamente esta celda. Con la otra, dos
    #     hojas del mismo libro darían dos números para lo mismo;
    #   · es la que usa el AVANCE DIARIO para su propia columna «Efectivas
    #     esperadas». Dos tablas con la misma cabecera y dos definiciones es la
    #     avería que este libro ya pagó con «Diferencia».
    #
    # La tasa de la facultad no se pierde: vive en su propia columna, al lado.
    esp_ahora <- {
      v <- esperadas[aplicadas]
      v <- v[is.finite(v)]
      if (length(v)) sum(v) else NA_real_
    }
    meta <- metas[[clave[idx][[1]] %||% ""]] %||%
      metas[[.cm_criterios_fac_key(f)]] %||%
      list(total = NA_real_, M = NA_real_, F = NA_real_)
    esp_ent <- if (is.finite(esp_ahora)) round(esp_ahora) else NA_real_
    esp_sx <- .calar_reparto_esperado(esp_ent, meta$M, meta$F)
    # Lo obtenido por sexo SOBRE LAS AULAS APLICADAS, que es el universo de esta
    # tabla entera: la tabla por facultad cuenta sobre todo el plan y contesta
    # otra pregunta.
    obt_sx <- if (!con_reparto) c(M = NA_real_, F = NA_real_) else {
      v <- sexo_fila[aplicadas]
      c(M = sum(vapply(v, function(x) x[["M"]], numeric(1)), na.rm = TRUE),
        F = sum(vapply(v, function(x) x[["F"]], numeric(1)), na.rm = TRUE))
    }
    dif_sexo <- function(obt, esp) {
      if (is.finite(obt) && is.finite(esp)) obt - esp else NA_real_
    }
    out <- data.frame(
      f,
      sum(aplicadas),
      sum(idx & rol == "titular"),
      meta$total,
      # Sin una sola aula aplicada las tres callan. Un «0 obtenidas de —» se lee
      # como si la facultad hubiera ido y no hubiera sacado nada, y lo que pasa
      # es que todavía no ha ido: eso ya lo dice «Aulas aplicadas 0».
      esp_ent,
      if (is.finite(esp_ahora) && is.finite(ef_apl)) ef_apl else NA_real_,
      if (is.finite(esp_ahora) && is.finite(ef_apl)) ef_apl - round(esp_ahora) else NA_real_,
      meta$M,
      esp_sx$M,
      if (is.finite(esp_ahora)) obt_sx[["M"]] else NA_real_,
      if (is.finite(esp_ahora)) dif_sexo(obt_sx[["M"]], esp_sx$M) else NA_real_,
      meta$F,
      esp_sx$F,
      if (is.finite(esp_ahora)) obt_sx[["F"]] else NA_real_,
      if (is.finite(esp_ahora)) dif_sexo(obt_sx[["F"]], esp_sx$F) else NA_real_,
      esperada,
      obtenida,
      if (is.finite(esperada) && is.finite(obtenida)) obtenida - esperada else NA_real_,
      # Una reserva de CADENA reemplaza a un titular que cayó: no es un aula de
      # más y no cuenta aquí. Sí cuentan la extra activada y la extra que el
      # equipo ya agendó en las hojas «(Extra)».
      sum(idx & rol == "extra_reserve_pool") + (agendadas_extra[[f]] %||% 0L),
      stringsAsFactors = FALSE
    )
    if (length(out) != length(AULAS_AVANCE_CABECERAS$rendimiento)) {
      # El contrato es el vocabulario, no esta lista literal. Sin esta guarda,
      # añadir una columna aquí y olvidarla allá renombra en silencio y la hoja
      # sale con una cabecera pintando otra cifra.
      stop(sprintf(
        ".calar_rendimiento_por_facultad(): %d columnas contra %d en AULAS_AVANCE_CABECERAS$rendimiento.",
        length(out), length(AULAS_AVANCE_CABECERAS$rendimiento)))
    }
    names(out) <- AULAS_AVANCE_CABECERAS$rendimiento
    out
  })
  out <- do.call(rbind, filas)
  # Por la brecha de tasa y de peor a mejor: la facultad que más rinde por
  # debajo de lo previsto abre la tabla. Sin brecha computable, al final.
  dif <- out[["Diferencia de tasa"]]
  out[order(ifelse(is.finite(dif), dif, Inf), out$Facultad), , drop = FALSE]
}
