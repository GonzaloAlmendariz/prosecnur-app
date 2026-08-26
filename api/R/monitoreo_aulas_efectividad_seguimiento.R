# =============================================================================
# Seguimiento de τ en campo (monitoreo de aulas universitarias)
# =============================================================================
#
# ADR 0082. El dimensionamiento compra aforo con `⌈cuota / (p25 × τ)⌉`, y esa τ
# —compuesta por facultad como `mix_de_tamaños × factor_residual`— sale del
# campo 2025 y de ningún otro sitio. El módulo de certeza declara literalmente
# que NO cubre su incertidumbre («Su intervalo lo publica la referencia
# histórica de asistencia») y hasta hoy esa exención no tenía destinatario:
# ninguna superficie contrastaba la τ prevista contra la que el campo rinde.
#
# Lo que este bloque contesta —y lo que NO—:
#
# - SÍ dice, por facultad, qué τ se supuso, qué τ está rindiendo el campo, con
#   cuántas aulas se sostiene esa medición y cuántos alumnos de diferencia
#   implica contra lo previsto.
# - NO mide cumplimiento contra la cuota: eso es `avance_cuota` (ADR 0079) y
#   tiene otro denominador. El déficit de aquí es el ATRIBUIBLE A τ —lo que se
#   pierde porque las aulas rinden distinto de lo supuesto—, no la brecha
#   contra la cuota, que además incluye aulas aún no aplicadas.
# - NO reescribe τ ni redimensiona. La π publicada es la del sorteo ejecutado
#   (ADR 0066): medir en campo informa la ACTIVACIÓN DE RESERVAS, que opera
#   sobre aulas que el diseño ya sorteó y dotó.
# - NO explica una caída. Si el rendimiento baja no dirá si fue el horario, el
#   tipo de curso o el agotamiento del campo: 2025 dejó las tres señales sin
#   base usable (`calc_muestra_aulas_efectividad.R`).
#
# **El numerador es la efectiva de PLATAFORMA** (respuesta que llegó y pasó los
# filtros declarados), decisión de Gonzalo del 2026-08-26. Es la misma clase de
# tasa que dimensionó y la que ADR 0079 ya usa para medir cumplimiento. En el
# perfil conviven hoy otras dos tasas de la misma forma con numeradores
# distintos —`effective_surveys` del parte y `sent_total` de la Base de
# control—, y ninguna de las dos es τ: son cuadres, y llevan su propio rótulo.
#
# Cálculo puro sobre estado ya validado: degrada declarando, nunca lanza. Por
# eso aquí no hay `stop_api()` ni `stop()`.

MONITOREO_AULAS_EFECTIVIDAD_SCHEMA <- "monitoreo_aulas_efectividad_seguimiento_v1"

# z de una normal al 95 %. Declarado y no parametrizado: un nivel configurable
# invita a moverlo hasta que la facultad incómoda deje de señalarse.
.maes_Z <- 1.959964

# --- la banda ----------------------------------------------------------------

#' Error estándar de τ̂ = Σy/Σx con las AULAS como conglomerados.
#'
#' τ no es una proporción de ensayos independientes: los elegibles de un aula
#' comparten profesor, hora y sala, y responden juntos o no responden. Tratarla
#' como binomial sobre Σelegibles daría una banda varias veces más angosta que
#' la real y señalaría facultades por ruido de agrupamiento.
#'
#' Es el estimador de razón linealizado de toda la vida: sobre los residuos
#' `e_i = y_i − τ̂·x_i` de cada aula,
#'
#'     SE(τ̂) ≈ sqrt( k/(k−1) · Σe_i² ) / Σx
#'
#' **Con menos de dos aulas no hay banda.** Una sola observación no tiene
#' dispersión que medir, y devolver un intervalo cualquiera —o peor, un punto
#' sin intervalo que se lea como certeza— es exactamente el verde por ausencia
#' que el Contrato de Superficie prohíbe. Se devuelve `NA` y el estado lo dice.
#'
#' @param y efectivas por aula.
#' @param x elegibles por aula.
#' @return lista con `tau`, `se`, `bajo`, `alto`, `k`; `NA` donde no se puede.
#' @keywords internal
.maes_banda_razon <- function(y, x) {
  y <- suppressWarnings(as.numeric(y)); x <- suppressWarnings(as.numeric(x))
  ok <- is.finite(y) & is.finite(x) & x > 0
  y <- y[ok]; x <- x[ok]
  k <- length(y)
  vacio <- list(tau = NA_real_, se = NA_real_, bajo = NA_real_, alto = NA_real_, k = as.integer(k))
  if (!k || sum(x) <= 0) return(vacio)
  tau <- sum(y) / sum(x)
  if (k < 2L) return(list(tau = tau, se = NA_real_, bajo = NA_real_, alto = NA_real_, k = 1L))
  e <- y - tau * x
  se <- sqrt((k / (k - 1)) * sum(e^2)) / sum(x)
  if (!is.finite(se)) return(list(tau = tau, se = NA_real_, bajo = NA_real_, alto = NA_real_, k = as.integer(k)))
  list(
    tau = tau, se = se,
    # Acotada a [0,1]: τ es una fracción de elegibles y una banda que asome
    # fuera prometería un rendimiento imposible.
    bajo = max(0, tau - .maes_Z * se),
    alto = min(1, tau + .maes_Z * se),
    k = as.integer(k)
  )
}

#' El veredicto de una facultad: `sin_banda`, `conforme`, `bajo` o `sobre`.
#'
#' **La señal la dispara la banda, nunca el punto** (ADR 0082, cláusula 5). Con
#' k pequeño la τ de una facultad es ruido: está medido en este repo que dos
#' tercios de la varianza entre facultades del histórico es error de estimación
#' (τ² ≈ 0,0099 contra 0,0301 observada), y de ahí salen el corte `k ≥ 12` de
#' `.cm_tau_k_minimo` y el prior declarado de cinco aulas del ranking. Señalar
#' por el punto reproduciría el ruido que esos dos mecanismos ya descartaron.
#' @keywords internal
.maes_senal <- function(banda, tau_previsto) {
  if (!is.finite(tau_previsto)) return("sin_previsto")
  if (!is.finite(banda$bajo) || !is.finite(banda$alto)) return("sin_banda")
  if (banda$alto < tau_previsto) return("bajo")
  if (banda$bajo > tau_previsto) return("sobre")
  "conforme"
}

# --- reservas ----------------------------------------------------------------

# Una reserva de cadena que todavía NO entró al operativo: es la que se puede
# activar. Las gastadas ya están contadas en lo aplicado y el banco extra va
# aparte porque no reemplaza a nadie —son aulas adicionales para cerrar cuota
# por sexo— y activarlo es otra decisión.
.maes_reservas_libres <- function(plan_df) {
  n <- if (is.data.frame(plan_df)) nrow(plan_df) else 0L
  if (!n) return(rep(FALSE, 0))
  rol <- .maac_chr_col(plan_df, "sample_role")
  est <- .maac_chr_col(plan_df, "sample_status")
  apl <- .maac_chr_col(plan_df, "application_status")
  rol == "chain_reserve" & .maej_dormido(est) & apl != "aplicada"
}

#' Cuántas de esas reservas cierran un déficit, y cuánto queda si no alcanzan.
#'
#' Se proyecta cada reserva con la τ **observada** de su facultad, no con la
#' prevista: si el campo está rindiendo por debajo, sus reservas también lo
#' harán, y proyectarlas al supuesto que ya falló diría que el hueco se cierra
#' con menos aulas de las que hacen falta. Es la misma cuenta de
#' `alcanceDelBanco` —ningún alumno de una reserva es una encuesta— aplicada
#' por facultad.
#'
#' Las mayores primero: cierran el hueco con menos visitas, que es lo que el
#' operativo puede permitirse.
#' @keywords internal
.maes_reservas_que_cierran <- function(elegibles_libres, deficit, tau) {
  n <- length(elegibles_libres)
  if (!is.finite(deficit) || deficit <= 0) {
    return(list(necesarias = 0L, alcanzan = TRUE, sobrante = NA_real_))
  }
  if (!n || !is.finite(tau) || tau <= 0) {
    return(list(necesarias = NA_integer_, alcanzan = FALSE, sobrante = deficit))
  }
  rinde <- sort(elegibles_libres * tau, decreasing = TRUE)
  acumulado <- cumsum(rinde)
  hit <- which(acumulado >= deficit)
  if (!length(hit)) {
    return(list(necesarias = NA_integer_, alcanzan = FALSE,
                sobrante = deficit - acumulado[[length(acumulado)]]))
  }
  list(necesarias = as.integer(hit[[1]]), alcanzan = TRUE, sobrante = 0)
}

# --- el bloque ---------------------------------------------------------------

#' Seguimiento de τ: prevista contra observada, por facultad y en el tiempo.
#'
#' SIEMPRE presente en el payload (marco estable, C2): sin diseño, sin plan o
#' sin campo publica su estado declarado, no desaparece.
#'
#' @param plan_df plan NORMALIZADO entero (titulares, reservas y banco).
#' @param tracked_df el eslabón en juego de cada cadena, sin banco: de ahí
#'   salen los elegibles que faltan por aplicar.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias (lleva `design_targets`).
#' @param valid_response vector lógico por respuesta: si pasa los filtros.
#' @param response_classroom identificador de aula de cada respuesta.
#' @keywords internal
.monitoreo_aulas_efectividad_seguimiento <- function(plan_df, tracked_df, responses, cfg,
                                                    valid_response = logical(0),
                                                    response_classroom = character(0)) {
  vig <- .monitoreo_aulas_avance_vigencia(cfg)
  atr <- .maac_atribucion(plan_df, valid_response, response_classroom)

  n_plan <- if (is.data.frame(plan_df)) nrow(plan_df) else 0L
  aplicada <- if (n_plan) .maac_chr_col(plan_df, "application_status") == "aplicada" else logical(0)
  elegibles <- if (n_plan) .maac_num_col(plan_df, "eligible_n") else numeric(0)
  elegibles[!is.finite(elegibles) | elegibles < 0] <- 0
  fk_plan <- if (n_plan) .maac_fac_key(.maac_chr_col(plan_df, "faculty")) else character(0)
  fac_plan <- if (n_plan) .maac_chr_col(plan_df, "faculty") else character(0)

  # Efectivas de PLATAFORMA por fila del plan. Solo cuentan las atribuidas a
  # una fila y dentro del universo: las de un aula que no existía o resultó
  # virtual no miden el rendimiento de nadie (mismas exclusiones que ADR 0079).
  efectivas_fila <- rep(0, n_plan)
  cuenta <- atr$valid & atr$matched & !atr$fuera
  if (n_plan && any(cuenta)) {
    tb <- table(atr$fila[cuenta])
    idx <- suppressWarnings(as.integer(names(tb)))
    ok <- is.finite(idx) & idx >= 1L & idx <= n_plan
    efectivas_fila[idx[ok]] <- as.numeric(tb)[ok]
  }

  # El DENOMINADOR son las aulas APLICADAS. Un aula sin aplicar no rinde cero:
  # todavía no rinde, y meterla hundiría la tasa los primeros días — una alarma
  # que sólo diría que el campo empezó.
  mide <- aplicada & elegibles > 0
  # Lo que falta por aplicar sale del eslabón EN JUEGO (sin banco): es el aforo
  # que todavía puede rendir dentro del plan vigente.
  fk_track <- .maac_fac_key(.maac_chr_col(tracked_df, "faculty"))
  el_track <- .maac_num_col(tracked_df, "eligible_n")
  el_track[!is.finite(el_track) | el_track < 0] <- 0
  apl_track <- .maac_chr_col(tracked_df, "application_status") == "aplicada"
  pend <- !apl_track & el_track > 0
  pendientes_k <- if (any(pend)) tapply(el_track[pend], fk_track[pend], sum) else numeric(0)

  libres <- .maes_reservas_libres(plan_df)

  # El residual del diseño viaja POR FILA (`factor_facultad` / `facultad_k`):
  # un factor de 1 con `facultad_k` ausente no es «esta facultad rinde según su
  # mix», es «el histórico no pudo darle base propia» —nueve de quince en
  # HSVG2026— y las dos cosas se leían igual.
  factor_fila <- if (n_plan) .maac_num_col(plan_df, "factor_facultad") else numeric(0)
  k_hist_fila <- if (n_plan) .maac_num_col(plan_df, "facultad_k") else numeric(0)

  # Etiqueta de display: como la escriba el plan; el diseño rellena.
  primeras <- !duplicated(fk_plan)
  labels_plan <- stats::setNames(fac_plan[primeras], fk_plan[primeras])

  previstos <- list()
  for (f in vig$facultades) {
    if (!is.list(f)) next
    k <- .monitoreo_scalar(f$faculty_key, "")
    if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
    if (!nzchar(k) || !is.null(previstos[[k]])) next
    previstos[[k]] <- list(
      etiqueta = .monitoreo_scalar(f$facultad, k),
      tau = .monitoreo_num(f$tau, NA_real_)
    )
  }

  claves <- unique(c(names(previstos), fk_plan[primeras]))
  claves <- claves[nzchar(claves)]

  filas <- list()
  for (k in claves) {
    en_plan <- n_plan > 0L & fk_plan == k
    mide_k <- mide & en_plan
    banda <- .maes_banda_razon(efectivas_fila[mide_k], elegibles[mide_k])
    prev <- previstos[[k]]
    tau_prev <- if (is.list(prev)) prev$tau else NA_real_
    el_aplicados <- sum(elegibles[mide_k])
    el_pendientes <- .maac_toma_num(pendientes_k, k, 0)

    # Alumnos de diferencia ATRIBUIBLES A τ. No es la brecha contra la cuota:
    # esa vive en `avance_cuota` y tiene otro denominador.
    delta <- if (is.finite(banda$tau) && is.finite(tau_prev)) banda$tau - tau_prev else NA_real_
    alumnos_corte <- if (is.finite(delta)) delta * el_aplicados else NA_real_
    alumnos_cierre <- if (is.finite(delta)) delta * (el_aplicados + el_pendientes) else NA_real_

    senal <- .maes_senal(banda, tau_prev)
    # Sólo se buscan reservas cuando la BANDA dice que rinde por debajo. Con
    # `conforme` la diferencia puntual no es prueba de nada y activar reservas
    # por ella gastaría colchón contra ruido.
    deficit <- if (identical(senal, "bajo") && is.finite(alumnos_cierre)) -alumnos_cierre else 0
    libres_k <- libres & en_plan
    cierre <- .maes_reservas_que_cierran(elegibles[libres_k], deficit, banda$tau)

    # ¿El residual de esta facultad tiene base propia en el histórico? Se lee
    # de sus filas del plan, no se infiere del valor: un factor 1 medido y un
    # factor 1 por ausencia de base son indistinguibles mirando el número.
    k_hist <- k_hist_fila[en_plan]
    k_hist <- k_hist[is.finite(k_hist) & k_hist > 0]
    fac_res <- factor_fila[en_plan]
    fac_res <- fac_res[is.finite(fac_res)]

    filas[[length(filas) + 1L]] <- list(
      facultad = {
        lbl <- .maac_toma_chr(labels_plan, k)
        if (nzchar(lbl)) lbl else if (is.list(prev)) prev$etiqueta else k
      },
      faculty_key = k,
      tau_previsto = if (is.finite(tau_prev)) round(tau_prev, 4) else NA_real_,
      tau_observado = if (is.finite(banda$tau)) round(banda$tau, 4) else NA_real_,
      banda_bajo = if (is.finite(banda$bajo)) round(banda$bajo, 4) else NA_real_,
      banda_alto = if (is.finite(banda$alto)) round(banda$alto, 4) else NA_real_,
      aulas_aplicadas = as.integer(banda$k),
      elegibles_aplicados = as.integer(round(el_aplicados)),
      elegibles_pendientes = as.integer(round(el_pendientes)),
      efectivas = as.integer(round(sum(efectivas_fila[mide_k]))),
      alumnos_corte = if (is.finite(alumnos_corte)) round(alumnos_corte, 1) else NA_real_,
      alumnos_cierre = if (is.finite(alumnos_cierre)) round(alumnos_cierre, 1) else NA_real_,
      senal = senal,
      # El residual, y si tiene base. `residual_base` en {"propia","sin_base",
      # "sin_dato"}: sin_dato es que el plan no trae la columna, que NO es lo
      # mismo que un histórico que no alcanzó.
      residual = if (length(fac_res)) round(stats::median(fac_res), 3) else NA_real_,
      residual_k = if (length(k_hist)) as.integer(max(k_hist)) else NA_integer_,
      residual_base = if (!length(fac_res)) "sin_dato" else if (length(k_hist)) "propia" else "sin_base",
      reservas_libres = as.integer(sum(libres_k)),
      reservas_necesarias = cierre$necesarias,
      reservas_alcanzan = isTRUE(cierre$alcanzan),
      # Alumnos que seguirían faltando si se activara TODA la reserva libre.
      sin_cubrir = if (is.finite(cierre$sobrante)) round(cierre$sobrante, 1) else NA_real_,
      estado = if (!is.finite(tau_prev)) "sin_previsto"
               else if (banda$k == 0L) "sin_campo"
               else "ok"
    )
  }

  # Orden de DECISIÓN: primero lo que hay que resolver. Señaladas por debajo
  # arriba, y dentro de ellas por alumnos que faltan.
  peso <- vapply(filas, function(x) {
    if (identical(x$senal, "bajo")) 3 else if (identical(x$senal, "sin_banda")) 1 else 0
  }, numeric(1))
  falta <- vapply(filas, function(x) {
    v <- x$alumnos_cierre
    if (is.finite(v) && v < 0) -v else 0
  }, numeric(1))
  filas <- filas[order(-peso, -falta)]

  # El AGREGADO del estudio, ponderado por elegibles aplicados y no promedio de
  # τ: promediar tasas le daría el mismo peso a una facultad de 2 aulas que a
  # una de 39, que es justo el sesgo que la banda existe para no cometer.
  banda_total <- .maes_banda_razon(efectivas_fila[mide], elegibles[mide])
  el_mide <- elegibles[mide]
  tau_prev_fila <- vapply(fk_plan, function(k) {
    p <- previstos[[k]]
    if (is.list(p) && is.finite(p$tau)) p$tau else NA_real_
  }, numeric(1), USE.NAMES = FALSE)
  tp <- tau_prev_fila[mide]
  usable <- is.finite(tp) & is.finite(el_mide)
  # La τ prevista AGREGADA es la del aforo realmente aplicado: ponderarla por
  # el plan entero compararía la mezcla de facultades del diseño contra la del
  # campo, y las dos difieren mientras el operativo no termine.
  tau_prev_total <- if (any(usable) && sum(el_mide[usable]) > 0) {
    sum(tp[usable] * el_mide[usable]) / sum(el_mide[usable])
  } else NA_real_

  senaladas <- vapply(filas, function(x) identical(x$senal, "bajo"), logical(1))

  list(
    schema = MONITOREO_AULAS_EFECTIVIDAD_SCHEMA,
    generado_en = .cm_aulas_now_iso(),
    fuente = vig$fuente,
    vigencia = vig$vigencia,
    motivo = vig$motivo,
    criterio = list(
      numerador = "efectiva de plataforma (respuesta que pasa los filtros declarados)",
      denominador = "elegibles de las aulas aplicadas al corte",
      senal = "la banda al 95 % excluye la τ prevista; el punto solo no señala",
      no_cubre = paste0(
        "Por qué cambió el rendimiento. El bloque horario, el tipo de curso y ",
        "el agotamiento del campo se midieron en 2025 y ninguno es derivable ",
        "del marco actual."
      )
    ),
    total = list(
      tau_previsto = if (is.finite(tau_prev_total)) round(tau_prev_total, 4) else NA_real_,
      tau_observado = if (is.finite(banda_total$tau)) round(banda_total$tau, 4) else NA_real_,
      banda_bajo = if (is.finite(banda_total$bajo)) round(banda_total$bajo, 4) else NA_real_,
      banda_alto = if (is.finite(banda_total$alto)) round(banda_total$alto, 4) else NA_real_,
      aulas_aplicadas = as.integer(banda_total$k),
      elegibles_aplicados = as.integer(round(sum(el_mide))),
      efectivas = as.integer(round(sum(efectivas_fila[mide]))),
      facultades_senaladas = as.integer(sum(senaladas)),
      # Los alumnos que faltan NO se compensan entre facultades: pasarse en
      # Derecho no cubre lo que falta en Letras (ADR 0079). Se suma solo el
      # déficit de las señaladas.
      alumnos_en_riesgo = round(sum(vapply(filas, function(x) {
        if (!identical(x$senal, "bajo")) return(0)
        v <- x$alumnos_cierre
        if (is.finite(v) && v < 0) -v else 0
      }, numeric(1))), 1)
    ),
    facultades = filas
  )
}
