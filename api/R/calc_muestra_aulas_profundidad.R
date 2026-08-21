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

# ---------------------------------------------------------------------------
# Garantía: ningún titular sin al menos un reemplazo
# ---------------------------------------------------------------------------
# Gonzalo, 2026-08-21: «lo primordial es asegurar efectividad, pero que todas
# las aulas tengan por lo menos un reemplazo».
#
# Medido sobre HSVG2026: 9 de 190 titulares salen de la selección con la cadena
# VACÍA, y sus 22 filas de reemplazo quedan colgando de un `classroom_id` que ya
# no figura como titular. Sea cual sea el mecanismo que cambia esos titulares
# entre el sorteo y el resultado —no está diagnosticado— la consecuencia es la
# misma: nueve aulas irían a campo sin plan B teniendo cientos de candidatas de
# su facultad libres.
#
# Esta pasada NO intenta explicar la causa: la cubre. Es deliberado, porque una
# garantía que depende de haber enumerado todas las causas se rompe la próxima
# vez que aparezca una nueva.
#
# ESTADO MEDIDO 2026-08-21, y es la pista que faltaba: conectada aquí NO
# DISPARA. En el momento en que se construyen las cadenas, los 190 titulares
# tienen todos su reemplazo; los 9 se quedan sin él MÁS ABAJO en el pipeline.
# Eso descarta el sorteo y el encadenado como causa, y acota la búsqueda a lo
# que ocurre entre este punto y el ensamblado del resultado.
#
# Se deja conectada igualmente: cubre el caso de que el builder sí deje a
# alguien en cero (celda agotada, marco chico), que es real aunque hoy no se dé
# en este proyecto. Cuando se encuentre el mecanismo de aguas abajo habrá que
# invocarla TAMBIÉN allí, sobre los titulares definitivos.
#
# No toca los titulares, así que el balance del cube queda intacto y las
# probabilidades de inclusión no cambian: un reemplazo es plan de contingencia,
# no muestra. Respeta la jerarquía de siempre —mismo estrato primero, misma
# facultad después— y NUNCA cruza de facultad, aunque eso implique dejar a un
# titular sin cubrir: antes eso que reponer una cuota que no es la suya.

#' Asigna un reemplazo a los titulares que se quedaron sin ninguno.
#'
#' @param titulars Titulares finales, con `classroom_id`, `faculty`, `stratum`.
#' @param reserves Reservas ya construidas (puede venir vacío).
#' @param aula_frame Marco del que salen los candidatos.
#' @return Las reservas, más una fila por cada titular que estaba en cero y pudo
#'   cubrirse. Marcadas `equivalence_level = "garantia_minima"` para que la
#'   pantalla y el reporte puedan distinguirlas de las sorteadas en cadena.
#' @keywords internal
.cm_aulas_garantizar_reemplazo_minimo <- function(titulars, reserves, aula_frame) {
  if (!is.data.frame(titulars) || !nrow(titulars)) return(reserves)
  ids_tit <- as.character(titulars$classroom_id)
  con_cadena <- if (is.data.frame(reserves) && nrow(reserves)) {
    unique(as.character(reserves$replacement_for))
  } else character(0)
  faltan <- which(!(ids_tit %in% con_cadena))
  if (!length(faltan)) return(reserves)

  usados <- unique(c(ids_tit,
                     if (is.data.frame(reserves) && nrow(reserves)) as.character(reserves$classroom_id) else character(0)))
  libres <- aula_frame[!(as.character(aula_frame$classroom_id) %in% usados), , drop = FALSE]
  if (!nrow(libres)) return(reserves)
  if ("included" %in% names(libres)) libres <- libres[libres$included %in% TRUE, , drop = FALSE]
  if (!nrow(libres)) return(reserves)

  nuevas <- list()
  for (i in faltan) {
    tit <- titulars[i, , drop = FALSE]
    fac <- as.character(tit$faculty[[1]] %||% "")
    est <- as.character(tit$stratum[[1]] %||% "")
    # Estrato primero; si no hay, la facultad. Fuera de la facultad, nunca.
    cand <- libres[as.character(libres$stratum) == est, , drop = FALSE]
    if (!nrow(cand)) cand <- libres[as.character(libres$faculty) == fac, , drop = FALSE]
    if (!nrow(cand)) next
    # La más parecida en tamaño: es lo que decide cuánto repone de la cuota.
    obj <- .cm_aulas_num(tit$eligible_n[[1]], 0)
    dif <- abs(suppressWarnings(as.numeric(cand$eligible_n)) - obj)
    dif[!is.finite(dif)] <- Inf
    elegida <- cand[which.min(dif), , drop = FALSE]
    elegida$wave <- "M2"
    elegida$sample_role <- "chain_reserve"
    elegida$replacement_order <- 1L
    elegida$replacement_for <- tit$classroom_id[[1]]
    elegida$selection_slot_id <- tit$selection_slot_id[[1]]
    elegida$chain_score <- NA_real_
    elegida$equivalence_level <- "garantia_minima"
    elegida$replacement_impact_score <- NA_real_
    elegida$chain_depth <- 1L
    elegida$activation_weight_status <- "reserve_conditional"
    elegida$analysis_weight_warning <- "Reserva condicional: usar peso analitico final solo si se activa en campo y se ajusta no respuesta."
    elegida$active_overlap <- NA_real_
    elegida$titular_overlap <- NA_real_
    elegida$eligible_delta_vs_titular <- .cm_aulas_num(elegida$eligible_n[[1]], 0) - obj
    nuevas[[length(nuevas) + 1L]] <- elegida
    libres <- libres[as.character(libres$classroom_id) != as.character(elegida$classroom_id[[1]]), , drop = FALSE]
  }
  if (!length(nuevas)) return(reserves)
  extra <- .cm_aulas_bind_rows_fill(nuevas)
  if (!is.data.frame(reserves) || !nrow(reserves)) return(extra)
  .cm_aulas_bind_rows_fill(list(reserves, extra))
}

# ---------------------------------------------------------------------------
# Integridad: `replacement_for` se re-deriva del slot
# ---------------------------------------------------------------------------
# El vínculo reserva -> titular viaja DOS VECES: en `selection_slot_id` (la
# posición del titular en la selección) y en `replacement_for` (su
# `classroom_id`). Cuando el titular de un slot cambia después de construir las
# cadenas, el slot se actualiza y `replacement_for` NO: queda apuntando al aula
# anterior, que acaba en el pool extra o como reserva de otro.
#
# Medido en HSVG2026 el 2026-08-21: 9 de 190 titulares aparecían «sin ningún
# reemplazo» y 9 cadenas apuntaban a aulas que no eran titulares. Los
# `selection_slot_id` de unos y otras COINCIDEN uno a uno —slot_043, slot_045,
# slot_069, slot_127…—, que es la prueba de que la cadena existe y está bien
# asignada: lo único roto era el campo que la nombra.
#
# Por eso se re-deriva en vez de reconstruirse: el slot es el vínculo fiable y
# `replacement_for` es su copia, así que la copia se recalcula del original.
# Reconstruir las cadenas habría sorteado reemplazos nuevos para aulas que ya
# los tenían.

#' Re-deriva `replacement_for` y `titular_operational_code` desde el slot.
#' @keywords internal
.cm_aulas_reparar_vinculo_titular <- function(selection_df) {
  if (!is.data.frame(selection_df) || !nrow(selection_df)) return(selection_df)
  if (!all(c("selection_slot_id", "sample_role") %in% names(selection_df))) return(selection_df)
  roles <- as.character(selection_df$sample_role)
  es_titular <- roles == "titular"
  if (!any(es_titular)) return(selection_df)
  slots <- as.character(selection_df$selection_slot_id)
  # Mapa slot -> aula titular vigente.
  id_por_slot <- stats::setNames(
    as.character(selection_df$classroom_id[es_titular]),
    slots[es_titular]
  )
  cod_por_slot <- if ("operational_code" %in% names(selection_df)) {
    stats::setNames(as.character(selection_df$operational_code[es_titular]), slots[es_titular])
  } else NULL

  # Sólo las reservas ENCADENADAS: el pool extra no cuelga de ningún titular y
  # su `replacement_for` vacío es correcto, no un vínculo perdido.
  encadenada <- roles == "chain_reserve" & nzchar(slots)
  if (!any(encadenada)) return(selection_df)
  nuevo <- unname(id_por_slot[slots[encadenada]])
  tiene <- !is.na(nuevo) & nzchar(nuevo)
  if (!any(tiene)) return(selection_df)
  idx <- which(encadenada)[tiene]
  if (!"replacement_for" %in% names(selection_df)) selection_df$replacement_for <- ""
  selection_df$replacement_for[idx] <- nuevo[tiene]
  if (!is.null(cod_por_slot) && "titular_operational_code" %in% names(selection_df)) {
    cod <- unname(cod_por_slot[slots[encadenada]])[tiene]
    ok <- !is.na(cod) & nzchar(cod)
    if (any(ok)) selection_df$titular_operational_code[idx[ok]] <- cod[ok]
  }
  selection_df
}
