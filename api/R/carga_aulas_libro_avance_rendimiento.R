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

#' Rendimiento por facultad: lo aplicado, lo esperado y la brecha de tasa.
#'
#' @param unidades filas del plan que entran al libro (titulares + reservas
#'   activadas). Es el mismo insumo que la tabla por facultad.
#' @param efectivas vector con nombre por código operativo (PLATAFORMA).
#' @param partes partes de campo, para el eje de aplicación.
#' @return `data.frame` con las columnas de `AULAS_AVANCE_CABECERAS$rendimiento`,
#'   o `NULL` si el plan no trae facultades.
#' @keywords internal
.calar_rendimiento_por_facultad <- function(unidades, efectivas = NULL, partes = list()) {
  unidades <- unidades %||% list()
  if (!length(unidades)) return(NULL)

  fac <- vapply(unidades, function(u) .cai_txt(u$faculty), character(1))
  if (!any(nzchar(fac))) return(NULL)
  cod <- vapply(unidades, function(u) .cai_txt(u$operational_code), character(1))
  rol <- vapply(unidades, function(u) tolower(.cai_txt(u$sample_role)), character(1))
  eleg <- vapply(unidades, function(u) .cai_num(u$eligible_n), numeric(1))
  # La tasa que el diseño le puso a la facultad. Viaja repetida en cada aula de
  # la facultad (`rendimiento_ref`, que el anotador de Cálculo de muestra
  # escribe por facultad); se lee de sus aulas, no se recalcula.
  tasa_ref <- vapply(unidades, function(u) .cai_num(u$rendimiento_ref), numeric(1))

  # UNA sola definición de «aplicada» para todo el operativo.
  apl <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)

  ef_fila <- vapply(cod, function(k) {
    if (is.null(efectivas)) return(NA_real_)
    i <- match(k, names(efectivas))
    if (is.na(i)) 0 else suppressWarnings(as.numeric(efectivas[[i]]))
  }, numeric(1))

  facultades <- unique(fac[nzchar(fac)])
  filas <- lapply(facultades, function(f) {
    idx <- fac == f
    aplicadas <- idx & apl
    # El denominador de la tasa obtenida: los elegibles de las aulas aplicadas.
    eleg_apl <- sum(eleg[aplicadas & is.finite(eleg)], na.rm = TRUE)
    ef_apl <- if (is.null(efectivas)) NA_real_ else sum(ef_fila[aplicadas], na.rm = TRUE)
    esperada <- {
      v <- tasa_ref[idx]
      v <- v[is.finite(v)]
      # Todas las aulas de la facultad traen la misma; la media protege de un
      # plan mixto sin inventar una tasa que nadie declaró.
      if (length(v)) mean(v) else NA_real_
    }
    obtenida <- if (is.finite(ef_apl) && eleg_apl > 0) ef_apl / eleg_apl else NA_real_
    out <- data.frame(
      f,
      sum(aplicadas),
      sum(idx & rol == "titular"),
      esperada,
      obtenida,
      if (is.finite(esperada) && is.finite(obtenida)) obtenida - esperada else NA_real_,
      # Una reserva de CADENA reemplaza a un titular que cayó: no es un aula de
      # más. La adicional es la del banco de extras que se activó, que es
      # exactamente lo que se le pide a la facultad cuando no alcanza.
      sum(idx & rol == "extra_reserve_pool"),
      stringsAsFactors = FALSE
    )
    names(out) <- AULAS_AVANCE_CABECERAS$rendimiento
    out
  })
  out <- do.call(rbind, filas)
  # Por la brecha de tasa y de peor a mejor: la facultad que más rinde por
  # debajo de lo previsto abre la tabla. Sin brecha computable, al final.
  dif <- out[["Diferencia"]]
  out[order(ifelse(is.finite(dif), dif, Inf), out$Facultad), , drop = FALSE]
}
