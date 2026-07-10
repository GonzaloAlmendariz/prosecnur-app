# =============================================================================
# Puente entre el motor de ponderacion (ponderacion_engine.R) y Analitica.
#
#   - Normaliza la config JSON del frontend a la forma que espera el motor.
#   - Adjunta la columna `peso` a la base de reporte (frecuencias/cruces la
#     consumen automaticamente via .peso_vec / get_pesos).
#   - Preview: calcula pesos + diagnosticos + comparacion de margenes sobre la
#     base real, sin persistir, para la UI.
#
# Config esperada en analitica_config$ponderacion:
#   { enabled, design:{var, pop_sizes:{cat:n}}, rake:{margins:[{var, targets:{cat:p}}]},
#     trim:{cap} }
# =============================================================================

.analitica_ponderacion_scalar <- function(x, default = NULL) {
  if (is.null(x) || !length(x)) return(default)
  x <- x[[1]]
  if (is.null(x)) return(default)
  x
}

# Named list de escalares (forma jsonlite simplifyVector=FALSE) -> vector numerico
# nombrado. Robusto a vectores ya nombrados.
.analitica_ponderacion_named_num <- function(x) {
  if (is.null(x) || !length(x)) return(NULL)
  nms <- names(x)
  if (is.null(nms) || !any(nzchar(nms))) return(NULL)
  vals <- suppressWarnings(as.numeric(vapply(x, function(v) {
    v <- v[[1]]
    if (is.null(v)) NA_real_ else as.numeric(v)
  }, numeric(1))))
  keep <- nzchar(nms) & is.finite(vals)
  if (!any(keep)) return(NULL)
  stats::setNames(vals[keep], nms[keep])
}

# Config JSON del frontend -> config del motor (ponderacion_compute).
.analitica_ponderacion_normalize <- function(pond) {
  if (!is.list(pond)) return(list(enabled = FALSE))
  out <- list(enabled = isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE)))

  d <- pond$design
  if (is.list(d)) {
    var <- as.character(.analitica_ponderacion_scalar(d$var, ""))
    pop <- .analitica_ponderacion_named_num(d$pop_sizes)
    if (nzchar(var) && !is.null(pop)) out$design <- list(var = var, pop_sizes = pop)
  }

  rk <- pond$rake %||% list()
  margins_raw <- rk$margins %||% pond$margins
  if (length(margins_raw)) {
    margins <- Filter(Negate(is.null), lapply(margins_raw, function(m) {
      if (!is.list(m)) return(NULL)
      var <- as.character(.analitica_ponderacion_scalar(m$var, ""))
      tgt <- .analitica_ponderacion_named_num(m$targets)
      if (!nzchar(var) || is.null(tgt)) return(NULL)
      list(var = var, targets = tgt)
    }))
    if (length(margins)) {
      out$rake <- list(
        margins = margins,
        max_iter = as.integer(.analitica_ponderacion_scalar(rk$max_iter, 50L)),
        tol = as.numeric(.analitica_ponderacion_scalar(rk$tol, 1e-7))
      )
    }
  }

  tr <- pond$trim
  cap <- .analitica_ponderacion_scalar(if (is.list(tr)) tr$cap else tr, NA)
  cap <- suppressWarnings(as.numeric(cap))
  if (is.finite(cap) && cap > 1) out$trim <- list(cap = cap)
  out
}

# Adjunta la columna `peso` si la ponderacion esta activa; si no, deja `data`
# intacta. Silencioso ante errores (nunca rompe la generacion del reporte).
.analitica_ponderacion_apply <- function(data, cfg) {
  pond <- (cfg %||% list())$ponderacion
  if (!is.list(pond) || !isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE))) return(data)
  if (!is.data.frame(data) || !nrow(data)) return(data)
  norm <- .analitica_ponderacion_normalize(pond)
  if (!isTRUE(norm$enabled) || (is.null(norm$design) && is.null(norm$rake))) return(data)
  res <- tryCatch(ponderacion_compute(data, norm), error = function(e) NULL)
  if (is.null(res) || !isTRUE(res$ok)) return(data)
  data[["peso"]] <- as.numeric(res$peso)
  data
}

# Avisos didacticos a partir de los diagnosticos (para la UI).
.analitica_ponderacion_warnings <- function(res) {
  out <- list()
  add <- function(level, code, message) out[[length(out) + 1L]] <<- list(level = level, code = code, message = message)
  d <- res$diagnostics
  if (isTRUE(res$rake_applied) && !isTRUE(res$converged)) {
    add("warn", "no_converge",
        "El raking no convergio. Suele deberse a objetivos incompatibles o categorias sin casos en la muestra.")
  }
  if (is.finite(d$deff)) {
    if (d$deff >= 2) {
      add("warn", "deff_alto", sprintf(
        "Efecto de diseno alto (DEFF=%.2f): la muestra efectiva baja a %.0f de %.0f (pierde %.0f%% de precision). Calibra menos variables o revisa si esta ponderacion vale la pena.",
        d$deff, d$n_eff, d$n, d$loss_pct))
    } else if (d$deff >= 1.5) {
      add("info", "deff_medio", sprintf(
        "La ponderacion cuesta ~%.0f%% de precision (DEFF=%.2f, n efectivo %.0f).",
        d$loss_pct, d$deff, d$n_eff))
    }
  }
  if (is.finite(d$ratio_max_min) && d$ratio_max_min >= 10) {
    add("warn", "pesos_extremos", sprintf(
      "Pesos muy dispersos (max/min=%.0f). Aplica un recorte (trim) para estabilizar la varianza.",
      d$ratio_max_min))
  }
  out
}

# Preview sin persistir: calcula sobre la base real del reporte. `pond` opcional
# permite a la UI previsualizar una config candidata antes de guardarla.
.analitica_ponderacion_preview <- function(sid, pond = NULL) {
  ctx <- tryCatch(.load_rp_data(sid), error = function(e) NULL)
  if (is.null(ctx) || !is.data.frame(ctx$rp_data) || !nrow(ctx$rp_data)) {
    return(list(ok = FALSE, reason = "no_data"))
  }
  cfg <- .analitica_get_config(sid)
  data <- ctx$rp_data
  reviewed <- tryCatch(.analitica_apply_data_review(data, ctx$rp_inst, cfg), error = function(e) NULL)
  if (!is.null(reviewed) && is.data.frame(reviewed$data)) data <- reviewed$data

  pond_cfg <- pond %||% cfg$ponderacion %||% list()
  norm <- .analitica_ponderacion_normalize(pond_cfg)
  res <- tryCatch(ponderacion_compute(data, norm), error = function(e) NULL)
  if (is.null(res)) return(list(ok = FALSE, reason = "compute_error"))

  list(
    ok = TRUE,
    n = res$diagnostics$n,
    enabled = isTRUE(norm$enabled),
    design_applied = res$design_applied,
    rake_applied = res$rake_applied,
    converged = res$converged,
    iterations = res$iterations,
    diagnostics = res$diagnostics,
    margins = res$margins,
    warnings = .analitica_ponderacion_warnings(res)
  )
}
