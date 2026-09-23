# =============================================================================
# «Con lo que ya tengo agendado, ¿llego?», por celda del EJE (nivel)
# =============================================================================
#
# Gonzalo, 2026-09-23, sobre la pestaña Metas de CCSS Perfil 2026-II: «no tengo
# forma de saber cuántas vamos y cuántas faltan […] la única diferencia es que
# esas eran por facultad y por sexo, aquí sólo serían por nivel».
#
# `monitoreo_aulas_proyeccion_metas()` arma una fila por FACULTAD con la cuota
# por sexo. Con la cuota por nivel atribuida a la persona ninguna facultad casa
# con las celdas del diseño («6»…«9») y salía vacía: el bloque de Metas —la
# cinta, el avance, las barras de escala común y «Metas y aulas»— no se montó
# nunca en CCSS.
#
# Aquí la fila es la CELDA del eje, con el mismo contrato de campos:
#
# - OBTENIDAS: lo que ya cuenta para esa celda, de `avance_cuota` (su dueño,
#   ADR 0079): efectivas de la población del diseño, por persona.
# - PROYECTADAS: los elegibles DE ESE NIVEL de las aulas agendadas y aún no
#   aplicadas (`level_composition`) por la tasa elegida.
# - La tasa del DISEÑO es la τ de la celda; la OBTENIDA, lo que la celda lleva
#   sobre los elegibles de ese nivel de las aulas ya aplicadas.
# - Sin sexo: la cuota no lo pide. Los campos `_M`/`_F` viajan en NA y la fila
#   se marca `sin_sexo`, para que la pantalla pinte un solo carril.
#
# Un aula sin composición no puede repartirse entre niveles: no aporta, y la
# fila dice cuántas hay (`aulas_sin_composicion`) en vez de callarlo.

#' Proyección de metas por celda del eje, en el contrato de
#' `monitoreo_aulas_proyeccion_metas()`.
#'
#' @param unidades filas del plan.
#' @param avance_cuota el bloque del tablero (lleva lo logrado por celda).
#' @param efectivas efectivas de plataforma por aula (sólo para saber cuáles se
#'   aplicaron, como hace el motor por facultad).
#' @inheritParams monitoreo_aulas_proyeccion_metas
#' @keywords internal
monitoreo_aulas_proyeccion_metas_eje <- function(unidades, avance_cuota = NULL, efectivas = NULL,
                                                 partes = list(), cuotas = list(), cfg = list(),
                                                 tasa = c("diseno", "obtenida"),
                                                 meta = c("muestra", "sobremuestra")) {
  tasa <- match.arg(tasa)
  meta <- match.arg(meta)
  unidades <- unidades %||% list()
  celdas <- (cuotas %||% list())$facultades %||% list()
  if (!length(unidades) || !length(celdas)) return(list())
  factor_meta <- .mapm_factor_meta(cuotas, meta)
  eje <- monitoreo_aulas_eje(cfg)
  txt <- function(x) trimws(as.character(x %||% ""))

  est <- vapply(unidades, function(u) monitoreo_aulas_estado_muestra(u$sample_status), character(1))
  fecha <- vapply(unidades, function(u) .mav_fecha(u$scheduled_date), character(1))
  apl <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)
  pend <- !apl & est %in% .madm_AGENDADOS & nzchar(fecha)
  comp <- lapply(unidades, function(u) .cm_aulas_composicion_leer(u$level_composition))
  claves_comp <- lapply(comp, function(v) if (length(v)) .maac_eje_key(names(v), eje) else character(0))
  sin_comp <- vapply(comp, function(v) !length(v), logical(1))

  logrado <- list()
  for (f in (avance_cuota %||% list())$facultades %||% list()) {
    k <- txt(f$faculty_key)
    if (nzchar(k)) logrado[[k]] <- suppressWarnings(as.numeric(f$respuestas_validas %||% 0))
  }

  del_nivel <- function(clave, mascara) {
    vapply(which(mascara), function(i) {
      v <- comp[[i]]
      if (!length(v)) 0 else sum(v[claves_comp[[i]] %in% clave])
    }, numeric(1))
  }

  salida <- list()
  for (celda in celdas) {
    valor <- txt(celda$facultad)
    clave <- txt(celda$faculty_key)
    if (!nzchar(clave)) clave <- .maac_eje_key(valor, eje)
    cuota <- suppressWarnings(as.numeric(celda$cuota %||% NA)) * factor_meta
    if (!is.finite(cuota)) next
    obt <- .monitoreo_num(logrado[[clave]], 0)
    en_apl <- del_nivel(clave, apl)
    en_pend <- del_nivel(clave, pend)
    el_apl <- sum(en_apl)
    el_pend <- sum(en_pend)
    tau_diseno <- suppressWarnings(as.numeric(celda$tau %||% NA))
    tau_real <- if (el_apl > 0) obt / el_apl else NA_real_
    usar_diseno <- identical(tasa, "diseno") || !is.finite(tau_real)
    tau <- if (usar_diseno) tau_diseno else tau_real
    if (!is.finite(tau)) tau <- tau_real
    proy <- if (is.finite(tau)) el_pend * tau else NA_real_
    total <- obt + (if (is.finite(proy)) proy else 0)
    salida[[length(salida) + 1L]] <- list(
      # El valor CRUDO, como las celdas de `avance_cuota`: la pantalla lo rotula
      # con el eje («Nivel 6»); rotularlo aquí daría «Nivel Nivel 6».
      facultad = valor,
      faculty_key = clave,
      sin_sexo = TRUE,
      meta = cuota, meta_M = NA_real_, meta_F = NA_real_,
      obtenidas = obt, obtenidas_M = NA_real_, obtenidas_F = NA_real_,
      aulas_aplicadas = sum(en_apl > 0),
      aulas_agendadas = sum(en_pend > 0), elegibles_agendados = el_pend,
      tasa_usada = tau, tasa_es_del_diseno = isTRUE(usar_diseno),
      tasa_diseno = tau_diseno, tasa_obtenida = tau_real,
      elegibles_aplicados = el_apl,
      desvio_de_la_del_diseno = if (is.finite(tau_real) && is.finite(tau_diseno) && tau_diseno > 0)
        (tau_real - tau_diseno) / tau_diseno else NA_real_,
      proyectadas = proy, proyectadas_M = NA_real_, proyectadas_F = NA_real_,
      total = total, brecha = total - cuota, llega = is.finite(total) && total >= cuota,
      meta_elegida = meta, factor_meta = factor_meta,
      aulas_sin_composicion = as.integer(sum(sin_comp & (apl | pend))),
      supuesto_meta = if (identical(meta, "sobremuestra")) paste(
        "La sobremuestra no está repartida por celda: el diseño la declara",
        "global, así que la cuota de cada una se escala por el mismo factor que",
        "el total."
      ) else "",
      supuesto_sexo = "",
      supuesto_nivel = paste(
        "Lo proyectado cuenta los elegibles de ese nivel en cada aula agendada",
        "(la composición del marco) por la tasa elegida; lo ya obtenido es lo que",
        "cuenta para la cuota, por persona."
      )
    )
  }
  salida[order(vapply(salida, function(x) x$brecha, numeric(1)))]
}
