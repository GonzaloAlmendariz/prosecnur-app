# =============================================================================
# Afijación por facultad en la selección de aulas
# =============================================================================
#
# El cálculo publica `aulas_base` POR FACULTAD (la afijación del diseño), pero
# el reparto de la selección (`.cm_aulas_quota_by_stratum`) ponderaba los
# estratos SOLO por su masa de elegibles, y la afijación nunca llegaba al
# sorteo. Medido en HSVG2026 (2026-08-18, checklist R8): el diseño pedía
# DERECHO 18 y el sorteo le dio 36; ARQUITECTURA 15 y le dio 7 — desvío
# absoluto 68 de 202 (34 %). En campo eso es sobrar aulas donde la cuota ya
# está cubierta y no llegar donde falta. Es además la explicación del
# histórico «ARQ pide 15 y 2025 aplicó 7»: 2025 también siguió la masa.
#
# `selector$faculty_targets` es un mapa etiqueta→n (claves comparadas por
# `.cm_criterios_fac_key`, así que aceptan la etiqueta del marco o el slug).
# Con targets declarados el reparto es en DOS NIVELES: el nivel facultad
# respeta su target (capado a las aulas disponibles de esa facultad), y
# DENTRO de la facultad los estratos (sexo × tamaño) se reparten por masa de
# elegibles con la regla de siempre. Las facultades del marco sin target se
# reparten el remanente de `n_total` proporcionalmente, como antes. SIN
# targets, el dispatcher delega intacto en `.cm_aulas_quota_by_stratum`:
# byte-idéntico al comportamiento histórico.
#
# Un target mayor que las aulas disponibles se capa y NO se redistribuye: el
# faltante es información de diseño (esa facultad no puede sostener su
# afijación), no un sobrante que repartir en silencio.

.cm_afijacion_normalize_targets <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(list())
  nms <- names(x)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(x)) {
    fac <- .cm_aulas_scalar(.cm_criterios_fac_key(nms[[i]]), "")
    if (!nzchar(fac)) next
    n <- suppressWarnings(as.numeric(.cm_aulas_scalar(x[[i]], NA)))
    if (!length(n) || !is.finite(n) || n < 0) next
    out[[fac]] <- as.integer(round(n))
  }
  out
}

# Dispatcher del reparto por estrato. Todos los call sites del engine pasan
# por aquí; la firma agrega `selector` para leer los targets sin cambiar la
# semántica de los que no los declaran.
.cm_aulas_quota_estratos <- function(aula_frame, n_total, selector = list()) {
  targets <- .cm_afijacion_normalize_targets(selector$faculty_targets)
  if (!length(targets)) return(.cm_aulas_quota_by_stratum(aula_frame, n_total))
  fac_keys <- .cm_criterios_fac_key(aula_frame$faculty %||% rep("", nrow(aula_frame)))
  # Las cuotas se devuelven POR NOMBRE de estrato y el sorteo las consume por
  # ese nombre sobre el marco entero: si un estrato cruza facultades (p. ej.
  # strata_cols sin `faculty` colapsando todo a "global"), dos cuotas
  # colisionarían en el mismo nombre y la afijación se aplicaría al azar.
  # Config contradictoria -> se falla FUERTE, no se traga en silencio.
  cruce <- tapply(fac_keys, aula_frame$stratum, function(f) length(unique(f)))
  if (any(cruce > 1L)) {
    stop(
      "faculty_targets requiere que cada estrato pertenezca a UNA facultad: ",
      "incluye `faculty` en selector$strata_cols.",
      call. = FALSE
    )
  }
  quotas <- stats::setNames(integer(0), character(0))
  # Nivel 1 — facultades con target: su n manda, capado a lo disponible.
  for (fac in names(targets)) {
    idx <- which(fac_keys == fac)
    if (!length(idx)) next
    n_fac <- min(length(idx), targets[[fac]])
    if (n_fac <= 0L) next
    # Nivel 2 — dentro de la facultad, la regla de siempre (masa de elegibles
    # sobre los estratos sexo × tamaño de ESA facultad).
    quotas <- c(quotas, .cm_aulas_quota_by_stratum(aula_frame[idx, , drop = FALSE], n_fac))
  }
  # Facultades del marco SIN target: el remanente, proporcional como antes.
  restantes <- !(fac_keys %in% names(targets))
  resto_n <- max(0L, .cm_aulas_int(n_total, 0L) - sum(quotas))
  if (any(restantes) && resto_n > 0L) {
    quotas <- c(quotas, .cm_aulas_quota_by_stratum(aula_frame[restantes, , drop = FALSE], resto_n))
  }
  quotas
}
