# =============================================================================
# Motor de ponderacion (survey weighting) para Analitica.
#
# Produce la columna `peso` que los reportes (reporte_frecuencias, reporte_cruces,
# dimensiones, ficha tecnica) ya consumen. El peso se calcula de forma
# determinista a partir de la configuracion guardada, no se persiste como dato.
#
# Cubre los dos usos profesionales estandar, que conviene no mezclar:
#   1. Pesos de diseno: corrigen una asignacion muestral desigual respecto de la
#      poblacion (p.ej. n igual por distrito con distritos de tamano distinto).
#      w_diseno = share_poblacion / share_muestra del estrato.
#   2. Post-estratificacion / raking (IPF): corrige la no-respuesta ajustando las
#      distribuciones MARGINALES de la muestra a las de la poblacion (sexo, edad,
#      distrito, ...). Es lo habitual porque casi nunca se conoce la distribucion
#      conjunta, solo los margenes. Se puede aplicar sobre el peso de diseno.
#
# Diagnosticos: efecto de diseno de Kish (DEFF = 1 + CV^2), tamano de muestra
# efectivo (n_eff = (sum w)^2 / sum w^2), y comparacion de margenes antes/despues.
# Sin dependencias externas (no usa el paquete survey): IPF a mano, trazable.
# =============================================================================

# --- utilidades internas -----------------------------------------------------

.ponderacion_num <- function(x) {
  out <- suppressWarnings(as.numeric(x))
  out[!is.finite(out)] <- NA_real_
  out
}

# Normaliza un vector de objetivos (proporciones o conteos) a proporciones que
# sumen 1, descartando entradas no finitas o negativas. Devuelve NULL si no hay
# nada utilizable.
.ponderacion_normalize_targets <- function(targets) {
  if (is.null(targets) || !length(targets)) return(NULL)
  vals <- .ponderacion_num(targets)
  nms <- names(targets)
  if (is.null(nms)) return(NULL)
  keep <- is.finite(vals) & vals >= 0 & nzchar(nms)
  vals <- vals[keep]
  nms <- nms[keep]
  total <- sum(vals, na.rm = TRUE)
  if (!length(vals) || total <= 0) return(NULL)
  stats::setNames(vals / total, nms)
}

# Recorta pesos extremos a [1/cap, cap] veces la media y re-normaliza para
# conservar la media (o el total objetivo). `cap` es un multiplicador (p.ej. 3
# = ningun caso pesa mas de 3x ni menos de 1/3x el promedio). Iterativo porque
# recortar y re-normalizar puede reintroducir extremos.
.ponderacion_trim <- function(w, cap = NULL, target_sum = NULL, max_iter = 20L) {
  w <- .ponderacion_num(w)
  w[is.na(w) | w < 0] <- 0
  if (is.null(target_sum)) target_sum <- length(w)
  renorm <- function(x) if (sum(x) > 0) x * target_sum / sum(x) else x
  w <- renorm(w)
  if (is.null(cap) || !is.finite(cap) || cap <= 1) return(w)
  for (i in seq_len(max_iter)) {
    m <- mean(w)
    hi <- cap * m
    lo <- m / cap
    clipped <- pmin(pmax(w, lo), hi)
    if (max(abs(clipped - w)) < 1e-9) {
      w <- renorm(clipped)
      break
    }
    w <- renorm(clipped)
  }
  w
}

# --- pesos de diseno ---------------------------------------------------------

# Peso de diseno por estrato: w propto share_poblacion / share_muestra.
# `pop_sizes` es un vector nombrado (tamano poblacional por categoria del estrato).
# Los casos cuyo estrato no aparece en `pop_sizes` reciben peso segun el promedio
# (factor 1) para no descartarlos. Devuelve un vector con media 1.
.ponderacion_design_weights <- function(stratum, pop_sizes) {
  stratum <- as.character(stratum)
  n <- length(stratum)
  targets <- .ponderacion_normalize_targets(pop_sizes)
  if (is.null(targets)) return(rep(1, n))
  sample_counts <- table(stratum)
  sample_share <- sample_counts / sum(sample_counts)
  w <- rep(1, n)
  for (lvl in names(targets)) {
    idx <- which(stratum == lvl)
    if (!length(idx)) next
    s_share <- as.numeric(sample_share[[lvl]] %||% NA_real_)
    if (!is.finite(s_share) || s_share <= 0) next
    w[idx] <- targets[[lvl]] / s_share
  }
  # media 1
  if (sum(w) > 0) w <- w * n / sum(w)
  w
}

# --- raking / IPF ------------------------------------------------------------

# Raking (iterative proportional fitting) a margenes marginales.
# `data`: data.frame. `margins`: lista de listas con $var (nombre de columna) y
# $targets (vector nombrado de proporciones/conteos por categoria). `base`: peso
# inicial (p.ej. de diseno); por defecto 1. Devuelve el peso final (media 1) y,
# como atributos, la convergencia.
.ponderacion_rake <- function(data, margins, base = NULL,
                              max_iter = 50L, tol = 1e-7) {
  n <- nrow(data)
  w <- if (is.null(base)) rep(1, n) else .ponderacion_num(base)
  w[is.na(w) | w < 0] <- 0
  margins <- Filter(function(m) is.list(m) && nzchar(.ponderacion_scalar(m$var, "")), margins %||% list())
  # Precalcula niveles observados y objetivos normalizados por margen.
  prepared <- lapply(margins, function(m) {
    v <- as.character(data[[m$var]])
    tgt <- .ponderacion_normalize_targets(m$targets)
    list(var = m$var, values = v, targets = tgt)
  })
  prepared <- Filter(function(p) !is.null(p$targets), prepared)
  if (!length(prepared)) {
    w <- if (sum(w) > 0) w * n / sum(w) else rep(1, n)
    attr(w, "iterations") <- 0L
    attr(w, "converged") <- TRUE
    return(w)
  }
  converged <- FALSE
  iter_used <- 0L
  for (it in seq_len(max_iter)) {
    iter_used <- it
    max_change <- 0
    for (p in prepared) {
      total_w <- sum(w)
      if (total_w <= 0) next
      cur <- tapply(w, p$values, sum)
      for (lvl in names(p$targets)) {
        cur_w <- as.numeric(cur[[lvl]] %||% 0)
        cur_share <- cur_w / total_w
        if (cur_share <= 0) next
        factor <- p$targets[[lvl]] / cur_share
        idx <- which(p$values == lvl)
        w[idx] <- w[idx] * factor
        max_change <- max(max_change, abs(log(factor)))
      }
    }
    if (is.finite(max_change) && max_change < tol) {
      converged <- TRUE
      break
    }
  }
  w <- if (sum(w) > 0) w * n / sum(w) else rep(1, n)
  attr(w, "iterations") <- as.integer(iter_used)
  attr(w, "converged") <- isTRUE(converged)
  w
}

.ponderacion_scalar <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  x <- x[[1]]
  if (is.null(x) || is.na(x)) return(default)
  as.character(x)
}

# --- diagnosticos ------------------------------------------------------------

# Efecto de diseno de Kish y tamano de muestra efectivo, mas resumen de la
# distribucion de pesos. `w` con media ~1 (no es obligatorio).
.ponderacion_diagnostics <- function(w) {
  w <- .ponderacion_num(w)
  w <- w[is.finite(w) & w >= 0]
  n <- length(w)
  if (!n || sum(w) <= 0) {
    return(list(n = n, n_eff = 0, deff = NA_real_, cv = NA_real_,
                min = NA_real_, max = NA_real_, mean = NA_real_,
                ratio_max_min = NA_real_))
  }
  sw <- sum(w)
  sw2 <- sum(w^2)
  n_eff <- sw^2 / sw2
  deff <- n / n_eff
  m <- mean(w)
  cv <- if (m > 0) stats::sd(w) / m else NA_real_
  wpos <- w[w > 0]
  list(
    n = n,
    n_eff = n_eff,
    deff = deff,
    cv = cv,
    loss_pct = 100 * (1 - n_eff / n),
    min = min(w),
    max = max(w),
    mean = m,
    median = stats::median(w),
    ratio_max_min = if (length(wpos)) max(wpos) / min(wpos) else NA_real_,
    quantiles = stats::quantile(w, c(0.01, 0.05, 0.5, 0.95, 0.99), names = TRUE)
  )
}

# Compara la distribucion muestral de cada variable de calibracion contra su
# objetivo poblacional, sin ponderar y ponderada. Devuelve, por variable y
# categoria, share_muestra / share_objetivo / share_ponderado.
.ponderacion_margin_compare <- function(data, margins, w) {
  w <- .ponderacion_num(w)
  w[is.na(w) | w < 0] <- 0
  out <- list()
  for (m in margins %||% list()) {
    var <- .ponderacion_scalar(m$var, "")
    if (!nzchar(var) || !var %in% names(data)) next
    tgt <- .ponderacion_normalize_targets(m$targets)
    if (is.null(tgt)) next
    v <- as.character(data[[var]])
    n <- length(v)
    unw <- table(v) / n
    wt <- tapply(w, v, sum)
    tot_w <- sum(w)
    rows <- lapply(names(tgt), function(lvl) {
      list(
        categoria = lvl,
        objetivo = unname(tgt[[lvl]]),
        muestra = as.numeric(unw[[lvl]] %||% 0),
        ponderado = if (tot_w > 0) as.numeric((wt[[lvl]] %||% 0) / tot_w) else 0
      )
    })
    out[[var]] <- rows
  }
  out
}

# --- orquestador -------------------------------------------------------------

# Calcula el peso final a partir de una config declarativa y devuelve peso +
# diagnosticos. Config:
#   list(
#     enabled = TRUE/FALSE,
#     design = list(var = "distrito", pop_sizes = c(A = 1000, B = 2000)) | NULL,
#     rake   = list(
#       margins = list(list(var = "sexo", targets = c(H = 0.49, M = 0.51)), ...),
#       max_iter = 50, tol = 1e-7
#     ) | NULL,
#     trim = list(cap = 5) | NULL   # cap = multiplicador sobre la media
#   )
# Devuelve list(peso, diagnostics, margins, design_applied, rake_applied, ...).
ponderacion_compute <- function(data, config = list()) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  empty <- function(reason = NULL) {
    list(
      ok = FALSE,
      reason = reason,
      peso = rep(1, n),
      diagnostics = .ponderacion_diagnostics(rep(1, n)),
      margins = list(),
      design_applied = FALSE,
      rake_applied = FALSE,
      converged = TRUE,
      iterations = 0L
    )
  }
  if (!n) return(empty("no_data"))
  config <- config %||% list()
  if (isFALSE(config$enabled %||% FALSE) && !is.null(config$enabled)) return(empty("disabled"))

  base <- rep(1, n)
  design_applied <- FALSE
  design <- config$design
  if (is.list(design) && nzchar(.ponderacion_scalar(design$var, "")) &&
      design$var %in% names(data)) {
    base <- .ponderacion_design_weights(data[[design$var]], design$pop_sizes)
    design_applied <- TRUE
  }

  rake_applied <- FALSE
  converged <- TRUE
  iterations <- 0L
  margins <- list()
  w <- base
  rake <- config$rake
  if (is.list(rake) && length(rake$margins %||% list())) {
    margins <- Filter(function(m) is.list(m) && .ponderacion_scalar(m$var, "") %in% names(data),
                      rake$margins)
    if (length(margins)) {
      w <- .ponderacion_rake(
        data, margins, base = base,
        max_iter = as.integer(rake$max_iter %||% 50L),
        tol = as.numeric(rake$tol %||% 1e-7)
      )
      rake_applied <- TRUE
      converged <- isTRUE(attr(w, "converged"))
      iterations <- as.integer(attr(w, "iterations") %||% 0L)
    }
  }

  trim <- config$trim
  if (is.list(trim) && is.finite(as.numeric(trim$cap %||% NA)) && as.numeric(trim$cap) > 1) {
    w <- .ponderacion_trim(w, cap = as.numeric(trim$cap), target_sum = n)
  } else {
    w <- if (sum(w) > 0) w * n / sum(w) else rep(1, n)
  }
  w <- as.numeric(w)

  list(
    ok = TRUE,
    reason = NULL,
    peso = w,
    diagnostics = .ponderacion_diagnostics(w),
    margins = .ponderacion_margin_compare(data, margins, w),
    design_applied = design_applied,
    rake_applied = rake_applied,
    converged = converged,
    iterations = iterations
  )
}
