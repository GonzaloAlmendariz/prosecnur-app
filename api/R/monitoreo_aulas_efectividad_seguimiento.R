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
# EL DISPARADOR ES EL CONSUMO DEL MARGEN, NO EL TEST SOBRE tau (decision de
# Gonzalo del 2026-08-26, opcion «d», tras el backtest E1).
#
# La primera version disparaba cuando la banda al 95 % excluia la tau prevista.
# Medido sobre el campo 2025: esa regla detecta caidas de 13,6 pp de mediana y
# el escenario que motivo el trabajo —tau un 5 % por debajo— vale 2 a 4 pp.
# CERO de quince facultades lo habrian detectado, y la unica senal que produjo
# fue falsa (EE.GG. Ciencias en la semana 1, conforme desde la 2).
#
# La banda NO se retira: cumple bien su otra mitad —mantuvo callada a 13 de 15
# facultades y evito actuar sobre ruido— y se queda como GUARDA. Lo que cambia
# es quien dispara: el margen que el diseno compro.
#
#   proyectado     = conseguido + aforo_pendiente x tau_observada
#   margen_restante = proyectado - cuota
#
# Porque el diseno NO compra la cuota justa: compra `ceil(cuota / (p25 x tau))`
# aulas, y las sorteadas tienen mas elegibles que el p25. Medido sobre la
# seleccion 2026 (193 titulares): margen mediano **+49,2 %** de la cuota, minimo
# +25,8 % (Derecho), maximo +205 % (Letras), NINGUNA facultad en negativo. Hay
# colchon real que gastar, asi que medir cuanto queda no dispara siempre.
#
# La banda entra aqui como incertidumbre de la PROYECCION, que es donde sirve:
# el aforo pendiente se proyecta tambien a los dos extremos de la banda. Si ni
# el extremo optimista cierra la cuota, el riesgo es FIRME; si solo el
# pesimista no cierra, esta AJUSTADO. Backtest de esta regla sobre 2025, donde
# solo Derecho cerro por debajo (98,6 % de su cuota):
#
#   tras la semana 1: senala 2 — 1 acierto, 1 falsa alarma, 0 perdidas
#   tras la semana 2: senala 1 — 1 acierto, 0 FALSAS ALARMAS, 0 perdidas
#   tras la semana 3: senala 1 — 1 acierto, 0 falsas alarmas, 0 perdidas
#
# y la semana 2 es la ultima con margen para agendar (7 dias de anticipacion).
#
# DOS VEREDICTOS CON DOS NOMBRES, nunca uno solo: `senal` es el de la banda
# —si tau difiere de lo supuesto— y `riesgo` es el del margen —si la cuota va a
# cerrar—. Son preguntas distintas y una facultad puede rendir por debajo de su
# tau y cerrar igual porque compro colchon de sobra.
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

# Lookup escalar en una lista nombrada: una clave ausente da el default, nunca
# NULL propagandose como cero.
.maes_toma_num_lista <- function(lst, k, default = NA_real_) {
  v <- suppressWarnings(as.numeric(lst[[k]] %||% NA))
  if (length(v) != 1L || !is.finite(v)) default else v
}

# --- el margen ----------------------------------------------------------------

#' El margen que le queda a una facultad, proyectando el aforo pendiente.
#'
#' `conseguido` son las validas de plataforma de esa facultad —TODAS, incluidas
#' las de reservas ya activadas: es el numerador del ADR 0079 y no se
#' recalcula aqui—. El aforo pendiente se proyecta a la tau OBSERVADA, no a la
#' prevista: si el campo rinde por debajo, lo que falta tambien.
#'
#' Los tres estados salen de proyectar tambien a los extremos de la banda:
#'
#' - `riesgo_firme`: ni proyectando al extremo OPTIMISTA se cierra la cuota.
#' - `riesgo`: la proyeccion central no cierra, pero el optimista si.
#' - `ajustado`: cierra, pero el extremo pesimista no.
#' - `holgado`: cierra incluso en el extremo pesimista.
#'
#' Sin cuota no hay margen que medir y se declara `sin_cuota`: un cero aqui se
#' leeria como «no le falta nada».
#' @keywords internal
.maes_margen <- function(conseguido, pendiente, banda, cuota) {
  vacio <- list(proyectado = NA_real_, optimista = NA_real_, pesimista = NA_real_,
                restante = NA_real_, estado = "sin_cuota")
  if (!is.finite(cuota) || cuota <= 0) return(vacio)
  tau <- banda$tau
  if (!is.finite(tau)) {
    # Sin campo todavia no hay tasa observada con la que proyectar. NO se cae a
    # la prevista: eso publicaria el supuesto como si fuera medicion, que es
    # justo lo que el ADR 0082 existe para impedir.
    return(list(proyectado = NA_real_, optimista = NA_real_, pesimista = NA_real_,
                restante = NA_real_, estado = "sin_campo"))
  }
  pend <- if (is.finite(pendiente) && pendiente > 0) pendiente else 0
  proy <- conseguido + pend * tau
  opt  <- conseguido + pend * (if (is.finite(banda$alto)) banda$alto else tau)
  pes  <- conseguido + pend * (if (is.finite(banda$bajo)) banda$bajo else tau)
  estado <- if (opt < cuota) "riesgo_firme"
            else if (proy < cuota) "riesgo"
            else if (pes < cuota) "ajustado"
            else "holgado"
  list(proyectado = proy, optimista = opt, pesimista = pes,
       restante = proy - cuota, estado = estado)
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
  apl <- .maac_chr_col(plan_df, "operational_status")
  rol == "chain_reserve" & .maej_dormido(est) & !(apl %in% MONITOREO_AULAS_ESTADOS_APLICADOS)
}

#' El BANCO de extras disponible de cada facultad.
#'
#' Va aparte de las reservas de cadena porque son dos recursos distintos: la
#' reserva reemplaza a un titular caído, el banco son aulas adicionales que el
#' diseño dotó para cerrar cuota por facultad y sexo. Pero para tapar un hueco
#' de margen SIRVEN LAS DOS, y contar sólo la cadena fue un defecto medido:
#' sobre la fixture del operativo completo las veinte facultades salían con
#' «0 reservas libres» teniendo 73 aulas de banco delante.
#' @keywords internal
.maes_banco_disponible <- function(plan_df) {
  n <- if (is.data.frame(plan_df)) nrow(plan_df) else 0L
  if (!n) return(rep(FALSE, 0))
  rol <- .maac_chr_col(plan_df, "sample_role")
  apl <- .maac_chr_col(plan_df, "operational_status")
  rol == "extra_reserve_pool" & !(apl %in% MONITOREO_AULAS_ESTADOS_APLICADOS)
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
#' La CADENA primero y el BANCO después, y se declara cuántas salen de cada uno:
#' activar una reserva de cadena es seguir el plan, y echar mano del banco es
#' una decisión distinta que el operativo tiene que ver por separado.
#'
#' Dentro de cada fuente, las mayores primero: cierran el hueco con menos
#' visitas, que es lo que el operativo puede permitirse.
#' @keywords internal
.maes_reservas_que_cierran <- function(elegibles_cadena, elegibles_banco, deficit, tau) {
  if (!is.finite(deficit) || deficit <= 0) {
    return(list(necesarias = 0L, de_cadena = 0L, de_banco = 0L,
                alcanzan = TRUE, sobrante = NA_real_))
  }
  disponible <- c(sort(elegibles_cadena, decreasing = TRUE),
                  sort(elegibles_banco, decreasing = TRUE))
  n_cadena <- length(elegibles_cadena)
  if (!length(disponible) || !is.finite(tau) || tau <= 0) {
    return(list(necesarias = NA_integer_, de_cadena = 0L, de_banco = 0L,
                alcanzan = FALSE, sobrante = deficit))
  }
  acumulado <- cumsum(disponible * tau)
  hit <- which(acumulado >= deficit)
  if (!length(hit)) {
    return(list(necesarias = NA_integer_, de_cadena = as.integer(n_cadena),
                de_banco = as.integer(length(disponible) - n_cadena),
                alcanzan = FALSE,
                sobrante = deficit - acumulado[[length(acumulado)]]))
  }
  k <- as.integer(hit[[1]])
  list(necesarias = k,
       de_cadena = as.integer(min(k, n_cadena)),
       de_banco = as.integer(max(0L, k - n_cadena)),
       alcanzan = TRUE, sobrante = 0)
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
                                                    response_classroom = character(0),
                                                    avance_cuota = NULL) {
  vig <- .monitoreo_aulas_avance_vigencia(cfg)
  atr <- .maac_atribucion(plan_df, valid_response, response_classroom)

  n_plan <- if (is.data.frame(plan_df)) nrow(plan_df) else 0L
  # QUE UN AULA ESTE APLICADA LO DICE `operational_status`, NO `application_status`.
  #
  # Son dos ejes distintos y el normalizador lo dice en su propio comentario:
  # `application_status` viene del PARTE (`status_de_aplicacion`, lo que anota
  # el aplicador) y `operational_status` es «el eje de la aplicacion», el que
  # cuenta el KPI del tablero (`sum(operational_status %in% c("aplicada",
  # "cerrada"))`).
  #
  # Medido sobre la fixture del operativo completo (`qa_pulso_aulas_campo.R
  # --escala 2025`): **152 aulas aplicadas por `operational_status` y CERO por
  # `application_status`**, que llega `pendiente` en las 269 filas. Leyendo la
  # columna equivocada esta pantalla salia vacia entera —«todavia no hay aulas
  # aplicadas»— al lado de un KPI que decia 152, y ninguno de los tests del
  # motor lo cazo porque sus fixtures escribian `application_status` a mano.
  #
  # Se usa el MISMO predicado que el KPI, no uno propio: dos superficies
  # vecinas que cuentan lo mismo de dos maneras acaban discrepando.
  #
  # **Y esa frase estaba escrita aquí sin ser código compartido**, así que el
  # 2026-09-07, cuando el KPI pasó a contar también el aula con respuestas, éste
  # se quedó atrás: la tabla de la app decía «0 de 37 cursos-horario aplicados»
  # en Ciencias e Ingeniería con uno produciendo encuestas. Ahora el predicado se
  # calcula abajo, después de `efectivas_fila`, porque necesita esa tercera vía.
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

  # Las tres vías del predicado compartido, resueltas sobre las columnas del
  # frame: el estado del circuito, el veredicto del parte y —la que faltaba— que
  # ya estén llegando respuestas de esa aula.
  aplicada <- if (n_plan) {
    .maac_chr_col(plan_df, "operational_status") %in% MONITOREO_AULAS_ESTADOS_APLICADOS |
      .maac_chr_col(plan_df, "application_status") %in% "aplicada" |
      efectivas_fila > 0
  } else logical(0)

  # El DENOMINADOR son las aulas APLICADAS. Un aula sin aplicar no rinde cero:
  # todavía no rinde, y meterla hundiría la tasa los primeros días — una alarma
  # que sólo diría que el campo empezó.
  mide <- aplicada & elegibles > 0
  # Lo que falta por aplicar sale del eslabón EN JUEGO (sin banco): es el aforo
  # que todavía puede rendir dentro del plan vigente.
  fk_track <- .maac_fac_key(.maac_chr_col(tracked_df, "faculty"))
  el_track <- .maac_num_col(tracked_df, "eligible_n")
  el_track[!is.finite(el_track) | el_track < 0] <- 0
  apl_track <- .maac_chr_col(tracked_df, "operational_status") %in% MONITOREO_AULAS_ESTADOS_APLICADOS
  pend <- !apl_track & el_track > 0
  pendientes_k <- if (any(pend)) tapply(el_track[pend], fk_track[pend], sum) else numeric(0)

  libres <- .maes_reservas_libres(plan_df)
  banco <- .maes_banco_disponible(plan_df)

  # El CONSEGUIDO de cada facultad lo publica `avance_cuota` (ADR 0079) y aqui
  # NO se recalcula: su numerador incluye reservas activadas y excluye
  # huerfanas, duplicados y fuera de universo, y dos sumas del mismo numero
  # acaban divergiendo. Sin bloque, el margen no se puede afirmar y se declara.
  conseguido_k <- list(); cuota_k <- list()
  if (is.list(avance_cuota)) {
    for (f in (avance_cuota$facultades %||% list())) {
      if (!is.list(f)) next
      k <- .monitoreo_scalar(f$faculty_key, "")
      if (!nzchar(k)) next
      conseguido_k[[k]] <- .monitoreo_num(f$respuestas_validas, 0)
      cuota_k[[k]] <- .monitoreo_num(f$cuota, NA_real_)
    }
  }

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

    # EL DISPARADOR: el margen. `senal` (la banda) queda como guarda de ruido y
    # entra aqui solo como incertidumbre de la proyeccion.
    conseguido <- .maes_toma_num_lista(conseguido_k, k, NA_real_)
    cuota <- .maes_toma_num_lista(cuota_k, k, NA_real_)
    margen <- if (is.finite(conseguido)) {
      .maes_margen(conseguido, el_pendientes, banda, cuota)
    } else {
      list(proyectado = NA_real_, optimista = NA_real_, pesimista = NA_real_,
           restante = NA_real_, estado = "sin_cumplimiento")
    }
    # Las reservas cierran el hueco DEL MARGEN, no la diferencia de tau: una
    # facultad puede rendir por debajo de su tau y cerrar igual porque compro
    # colchon de sobra —medido en la seleccion 2026: margen mediano +49,2 % de
    # la cuota, ninguna en negativo—. Activar reservas por la diferencia de tau
    # gastaria colchon que no hacia falta.
    deficit <- if (margen$estado %in% c("riesgo", "riesgo_firme") &&
                   is.finite(margen$restante)) -margen$restante else 0
    libres_k <- libres & en_plan
    banco_k <- banco & en_plan
    cierre <- .maes_reservas_que_cierran(elegibles[libres_k], elegibles[banco_k],
                                         deficit, banda$tau)

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
      # Los DOS veredictos, con dos nombres. `senal` = la banda (¿tau difiere de
      # lo supuesto?). `riesgo` = el margen (¿va a cerrar la cuota?). Publicar
      # uno solo obligaria a la vista a inferir el otro.
      senal = senal,
      cuota = if (is.finite(cuota)) cuota else NA_real_,
      conseguido = if (is.finite(conseguido)) round(conseguido) else NA_real_,
      proyectado = if (is.finite(margen$proyectado)) round(margen$proyectado, 1) else NA_real_,
      proyectado_optimista = if (is.finite(margen$optimista)) round(margen$optimista, 1) else NA_real_,
      proyectado_pesimista = if (is.finite(margen$pesimista)) round(margen$pesimista, 1) else NA_real_,
      margen_restante = if (is.finite(margen$restante)) round(margen$restante, 1) else NA_real_,
      riesgo = margen$estado,
      # El residual, y si tiene base. `residual_base` en {"propia","sin_base",
      # "sin_dato"}: sin_dato es que el plan no trae la columna, que NO es lo
      # mismo que un histórico que no alcanzó.
      residual = if (length(fac_res)) round(stats::median(fac_res), 3) else NA_real_,
      residual_k = if (length(k_hist)) as.integer(max(k_hist)) else NA_integer_,
      residual_base = if (!length(fac_res)) "sin_dato" else if (length(k_hist)) "propia" else "sin_base",
      reservas_libres = as.integer(sum(libres_k)),
      # El banco va con nombre propio: es otro recurso y activarlo es otra
      # decisión. Sumarlo a las reservas de cadena escondería cuál se gasta.
      banco_disponible = as.integer(sum(banco_k)),
      reservas_necesarias = cierre$necesarias,
      reservas_de_cadena = cierre$de_cadena,
      reservas_de_banco = cierre$de_banco,
      reservas_alcanzan = isTRUE(cierre$alcanzan),
      # Alumnos que seguirían faltando si se activara TODA la reserva libre.
      sin_cubrir = if (is.finite(cierre$sobrante)) round(cierre$sobrante, 1) else NA_real_,
      estado = if (!is.finite(tau_prev)) "sin_previsto"
               else if (banda$k == 0L) "sin_campo"
               else "ok"
    )
  }

  # Orden de DECISIÓN: manda el RIESGO del margen, que es lo que hay que
  # resolver, no la señal de la banda —una facultad puede rendir bajo su τ y
  # cerrar igual—. Dentro de cada nivel, por alumnos que faltan.
  peso <- vapply(filas, function(x) {
    switch(x$riesgo %||% "", riesgo_firme = 4, riesgo = 3, ajustado = 2,
           sin_campo = 1, sin_cuota = 1, sin_cumplimiento = 1, 0)
  }, numeric(1))
  falta <- vapply(filas, function(x) {
    v <- x$margen_restante
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

  # Dos conteos con dos nombres: las que rinden bajo su τ (la banda) y las que
  # NO van a cerrar su cuota (el margen). No son el mismo conjunto y publicarlo
  # como uno solo fue lo que el backtest E1 mostró que engaña.
  bajo_su_tau <- vapply(filas, function(x) identical(x$senal, "bajo"), logical(1))
  en_riesgo <- vapply(filas, function(x) (x$riesgo %||% "") %in% c("riesgo", "riesgo_firme"), logical(1))

  list(
    schema = MONITOREO_AULAS_EFECTIVIDAD_SCHEMA,
    generado_en = .cm_aulas_now_iso(),
    fuente = vig$fuente,
    vigencia = vig$vigencia,
    motivo = vig$motivo,
    criterio = list(
      numerador = "efectiva de plataforma (respuesta que pasa los filtros declarados)",
      denominador = "elegibles de los cursos-horario aplicados al corte",
      disparador = paste0(
        "el margen restante: conseguido + aforo pendiente x tau observada, ",
        "contra la cuota del diseno"
      ),
      guarda = paste0(
        "la banda al 95 % acota la proyeccion; riesgo firme es que ni su ",
        "extremo optimista cierre la cuota"
      ),
      senal = "la banda también dice si tau difiere de lo supuesto, que es otra pregunta",
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
      # Rinden por debajo de su τ con evidencia que lo sostiene. NO es lo mismo
      # que estar en riesgo de no cerrar: en la selección 2026 el margen mediano
      # es +49,2 % de la cuota, así que se puede rendir bajo y cerrar igual.
      facultades_bajo_su_tau = as.integer(sum(bajo_su_tau)),
      # Las que su proyección NO cierra la cuota. Éste es el número que decide.
      facultades_en_riesgo = as.integer(sum(en_riesgo)),
      # Los alumnos que faltan NO se compensan entre facultades: pasarse en
      # Derecho no cubre lo que falta en Letras (ADR 0079). Se suma sólo el
      # déficit de las que están en riesgo.
      alumnos_en_riesgo = round(sum(vapply(filas, function(x) {
        if (!((x$riesgo %||% "") %in% c("riesgo", "riesgo_firme"))) return(0)
        v <- x$margen_restante
        if (is.finite(v) && v < 0) -v else 0
      }, numeric(1))), 1)
    ),
    facultades = filas
  )
}
