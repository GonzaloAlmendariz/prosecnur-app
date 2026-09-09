# monitoreo_aulas_proyeccion_metas.R — «con lo que ya tengo agendado, ¿llego?»
#
# El artefacto 4 del boceto «Metas por facultad y sexo» (Gonzalo, 2026-09-09).
# Una barra por sexo donde se apilan lo YA APLICADO y lo que cabe esperar de las
# aulas YA AGENDADAS, con la meta marcada encima.
#
# **Por qué hace falta.** Hoy el avance dice cuánto llevas y cuánto falta, y eso
# se lee como si el resto dependiera de seguir yendo. No siempre: una facultad
# puede tener toda su agenda cerrada y aun así no alcanzar, y eso no se descubre
# sumando de cabeza quince filas. Medido el 2026-09-09 sobre el operativo real,
# CINCO de quince facultades no llegan ni aplicando todo lo agendado; Derecho se
# queda en 233 de 363.
#
# **De qué se compone cada barra.**
#
#   |=== aplicado ===|~~~ proyectado de lo agendado ~~~|      | meta
#
# - APLICADO: efectivas de plataforma de las aulas que ya se aplicaron. Es un
#   dato medido, y por sexo también (`monitoreo_aulas_efectivas_por_sexo`).
# - PROYECTADO: los elegibles de las aulas agendadas que aún no se aplicaron,
#   por una tasa de rendimiento. Cuál tasa lo elige quien mira: la del DISEÑO
#   (la tau de la facultad) o la OBTENIDA hasta ahora en esa facultad.
#
# **El supuesto que hay que declarar, y por eso viaja en la salida.** El plan
# NO trae elegibles por sexo: sabe que un aula tiene 40 elegibles, no cuántos
# son hombres. La proyección se parte con la MISMA proporción con la que el
# diseño repartió la cuota de esa facultad. Es la única proporción defendible
# que existe —no inventa un cincuenta por ciento— pero es un supuesto, no una
# medición, y el artefacto tiene que decirlo al pie. Lo ya aplicado NO usa ese
# supuesto: ahí el sexo se cuenta de las respuestas.
#
# **Sobre la tasa obtenida: se enseña con lo que descansa, no se sustituye.**
#
# La primera versión caía a la del diseño cuando la facultad tenía pocas aulas
# aplicadas, con la idea de que un umbral la volvería fiable. Se midió sobre el
# operativo del 2026-09-09 y el umbral no existe: con 6 aulas y 266 elegibles,
# Estudios Generales Letras se apartaba un +54 % de su tau; con 12 aulas y 379
# elegibles, Ciencias e Ingeniería un +0,6 %; y con 8 aulas y 400 elegibles,
# Estudios Generales Ciencias un +18 %. Ni el número de aulas ni el de elegibles
# ordenan el desvío: no es ruido de muestreo que se encoja con el tamaño, es
# heterogeneidad real entre aulas.
#
# Un umbral, entonces, no protege: da confianza falsa y además esconde el dato
# que el usuario pidió ver. Así que la tasa obtenida se usa cuando se pide y la
# salida lleva SOBRE QUÉ descansa —aulas aplicadas, elegibles y su distancia a
# la del diseño— para que quien mire juzgue. Sólo se cae al diseño cuando la
# obtenida NO EXISTE, que no es una decisión sino la única opción.

#' La tasa de rendimiento del diseño para una facultad.
#' @keywords internal
.mapm_tau <- function(cuotas, facultad) {
  for (q in (cuotas %||% list())$facultades %||% list()) {
    if (identical(trimws(as.character(q$facultad %||% "")), facultad)) {
      v <- suppressWarnings(as.numeric(q$tau %||% NA))
      if (is.finite(v) && v > 0) return(v)
    }
  }
  NA_real_
}

#' El factor con el que se dimensiona una cuota contra la meta elegida.
#'
#' **La sobremuestra NO está repartida por facultad.** El diseño la declara
#' global —2 500 de muestra y 3 750 con sobremuestra en HSVG2026— y las cuotas
#' por facultad suman la muestra. Dimensionar una facultad contra la
#' sobremuestra es, por tanto, escalar su cuota por el mismo factor que el
#' total: es la única regla defendible con lo que el diseño dice, y es un
#' SUPUESTO, no un reparto que alguien haya decidido. Por eso el factor viaja en
#' la salida y el artefacto lo declara al pie.
#'
#' @param cuotas bloque `design_targets`.
#' @param meta `"muestra"` o `"sobremuestra"`.
#' @return el factor (1 para la muestra), o 1 si el diseño no lo permite saber.
#' @keywords internal
.mapm_factor_meta <- function(cuotas, meta) {
  if (!identical(meta, "sobremuestra")) return(1)
  q <- cuotas %||% list()
  base <- suppressWarnings(as.numeric(q$meta_diseno %||% q$total_cuota %||% NA))
  operativa <- suppressWarnings(as.numeric(q$meta_operativa %||% NA))
  if (!is.finite(operativa)) {
    sobre <- suppressWarnings(as.numeric(q$sobremuestra %||% NA))
    if (is.finite(base) && is.finite(sobre)) operativa <- base + sobre
  }
  if (!is.finite(base) || !is.finite(operativa) || base <= 0) return(1)
  operativa / base
}

#' La cuota de una facultad y su reparto por sexo.
#' @keywords internal
.mapm_cuota <- function(cuotas, facultad) {
  for (q in (cuotas %||% list())$facultades %||% list()) {
    if (identical(trimws(as.character(q$facultad %||% "")), facultad)) {
      cs <- q$cuota_sexo %||% list()
      return(list(
        total = suppressWarnings(as.numeric(q$cuota %||% NA)),
        M = suppressWarnings(as.numeric(cs$M %||% cs$hombres %||% NA)),
        F = suppressWarnings(as.numeric(cs$F %||% cs$mujeres %||% NA))
      ))
    }
  }
  list(total = NA_real_, M = NA_real_, F = NA_real_)
}

#' ¿Se llega a la meta con lo que ya está agendado?
#'
#' @param unidades filas del plan que entran al libro.
#' @param efectivas efectivas por código operativo (plataforma).
#' @param efectivas_sexo efectivas por código y sexo, si se conocen.
#' @param partes partes de campo, para el eje de aplicación.
#' @param cuotas bloque `design_targets` de la config.
#' @param cfg config de aulas, para traducir los códigos de sexo del formulario.
#' @param tasa `"diseno"` o `"obtenida"`: con qué rendimiento se proyecta lo
#'   agendado.
#'   La obtenida cae a la del diseño sólo cuando no existe.
#' @param meta `"muestra"` o `"sobremuestra"`: contra cuál de las dos metas del
#'   diseño se mide. La sobremuestra no está repartida por facultad, así que se
#'   escala la cuota por el mismo factor que el total.
#' @return lista de `{facultad, meta, meta_M, meta_F, obtenidas, obtenidas_M,
#'   obtenidas_F, aulas_agendadas, elegibles_agendados, tasa_usada,
#'   tasa_es_del_diseno, proyectadas, proyectadas_M, proyectadas_F, total,
#'   total_M, total_F, brecha, llega}`, una por facultad con cuota.
#' @export
monitoreo_aulas_proyeccion_metas <- function(unidades, efectivas = NULL,
                                             efectivas_sexo = NULL, partes = list(),
                                             cuotas = list(), cfg = list(),
                                             tasa = c("diseno", "obtenida"),
                                             meta = c("muestra", "sobremuestra")) {
  tasa <- match.arg(tasa)
  meta <- match.arg(meta)
  factor_meta <- .mapm_factor_meta(cuotas, meta)
  unidades <- unidades %||% list()
  if (!length(unidades)) return(list())
  txt <- function(x) trimws(as.character(x %||% ""))
  num <- function(x) suppressWarnings(as.numeric(x %||% NA))

  fac <- vapply(unidades, function(u) txt(u$faculty), character(1))
  cod <- vapply(unidades, function(u) txt(u$operational_code), character(1))
  eleg <- vapply(unidades, function(u) num(u$eligible_n), numeric(1))
  est <- vapply(unidades, function(u) monitoreo_aulas_estado_muestra(u$sample_status), character(1))
  fecha <- vapply(unidades, function(u) .mav_fecha(u$scheduled_date), character(1))
  apl <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)
  ef1 <- vapply(cod, function(k) {
    if (is.null(efectivas)) return(0)
    i <- match(k, names(efectivas)); if (is.na(i)) 0 else num(efectivas[[i]])
  }, numeric(1), USE.NAMES = FALSE)
  # **El código de sexo no se interpreta a mano.** `efectivas_sexo` viene con las
  # claves CRUDAS del formulario —«1» y «2» en HSVG2026— y cuál es cuál lo
  # resuelve `monitoreo_aulas_sexo_key()` con la config. Suponer que 1 es
  # hombre es el error que ya costó un estudio: ver
  # [[project_sub_a_es_el_mas_frecuente_no_mujeres]].
  sexo_de <- function(k, s) {
    v <- (efectivas_sexo %||% list())[[k]]
    if (!length(v)) return(0)
    et <- tryCatch(monitoreo_aulas_sexo_key(names(v), cfg), error = function(e) character(0))
    if (!length(et) || !any(et == s)) return(0)
    sum(suppressWarnings(as.numeric(v[et == s])), na.rm = TRUE)
  }

  salida <- list()
  for (f in sort(unique(fac[nzchar(fac)]))) {
    q <- .mapm_cuota(cuotas, f)
    if (!is.finite(q$total)) next
    # La meta elegida escala la cuota y su reparto por sexo con el mismo factor:
    # partirla de otra forma inventaría un reparto que el diseño no hizo.
    q$total <- q$total * factor_meta
    q$M <- q$M * factor_meta
    q$F <- q$F * factor_meta
    i <- fac == f
    aplicadas <- i & apl
    obt <- sum(ef1[aplicadas], na.rm = TRUE)
    obt_m <- sum(vapply(cod[aplicadas], sexo_de, numeric(1), "M"), na.rm = TRUE)
    obt_f <- sum(vapply(cod[aplicadas], sexo_de, numeric(1), "F"), na.rm = TRUE)
    # **Agendado y todavía sin aplicar**: lo que queda por delante y ya tiene
    # día. Lo que no está agendado NO entra: la pregunta es si llegas con lo que
    # ya tienes cerrado, no con lo que podrías llegar a cerrar.
    pend <- i & !apl & est %in% .madm_AGENDADOS & nzchar(fecha)
    el_pend <- sum(eleg[pend], na.rm = TRUE)

    tau_diseno <- .mapm_tau(cuotas, f)
    el_apl <- sum(eleg[aplicadas], na.rm = TRUE)
    tau_real <- if (el_apl > 0) obt / el_apl else NA_real_
    # Se cae al diseño sólo cuando la obtenida no existe: sin aulas aplicadas no
    # hay nada que medir. Con pocas SÍ se usa, porque el umbral que la volvería
    # fiable no existe (ver la nota de arriba) y esconderla sería peor.
    usar_diseno <- identical(tasa, "diseno") || !is.finite(tau_real)
    tau <- if (usar_diseno) tau_diseno else tau_real
    if (!is.finite(tau)) tau <- tau_real

    proy <- if (is.finite(tau)) el_pend * tau else NA_real_
    # El reparto por sexo de lo PROYECTADO usa la proporción de la cuota: el
    # plan no trae elegibles por sexo. Declarado en la salida, no escondido.
    rep <- .calar_reparto_esperado(proy, q$M, q$F)
    total <- obt + (if (is.finite(proy)) proy else 0)

    salida[[length(salida) + 1L]] <- list(
      facultad = f,
      meta = q$total, meta_M = q$M, meta_F = q$F,
      obtenidas = obt, obtenidas_M = obt_m, obtenidas_F = obt_f,
      aulas_aplicadas = sum(aplicadas),
      aulas_agendadas = sum(pend), elegibles_agendados = el_pend,
      tasa_usada = tau, tasa_es_del_diseno = isTRUE(usar_diseno),
      # **Sobre qué descansa la tasa obtenida.** No hay umbral que la vuelva
      # fiable, así que en vez de un booleano que mienta va el material para
      # juzgarla: cuántas aulas, cuántos elegibles y a qué distancia queda de la
      # del diseño. El artefacto lo enseña junto al toggle.
      tasa_diseno = tau_diseno, tasa_obtenida = tau_real,
      elegibles_aplicados = el_apl,
      desvio_de_la_del_diseno = if (is.finite(tau_real) && is.finite(tau_diseno) && tau_diseno > 0)
        (tau_real - tau_diseno) / tau_diseno else NA_real_,
      proyectadas = proy, proyectadas_M = rep$M, proyectadas_F = rep$F,
      total = total, brecha = total - q$total, llega = is.finite(total) && total >= q$total,
      # El supuesto viaja con el dato: quien dibuje la barra tiene que poder
      # escribirlo al pie sin ir a buscarlo.
      meta_elegida = meta, factor_meta = factor_meta,
      supuesto_meta = if (identical(meta, "sobremuestra")) paste(
        "La sobremuestra no está repartida por facultad: el diseño la declara",
        "global, así que la cuota de cada una se escala por el mismo factor que",
        "el total."
      ) else "",
      supuesto_sexo = paste(
        "El reparto por sexo de lo proyectado usa la proporción de la cuota del",
        "diseño: el plan no trae elegibles por sexo. Lo ya aplicado sí se cuenta",
        "de las respuestas."
      )
    )
  }
  salida[order(vapply(salida, function(x) x$brecha, numeric(1)))]
}
