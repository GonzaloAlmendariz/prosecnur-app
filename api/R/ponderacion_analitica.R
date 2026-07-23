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
# intacta. Nunca rompe la generacion del reporte, pero el fallback a base SIN
# ponderar ya no es silencioso (unidad 1.2): emite warning() con el motivo y
# registra el estado en attr(data, "ponderacion_estado") para que el sello de
# los entregables lo declare (reporte_ponderacion_sello.R).
.analitica_ponderacion_apply <- function(data, cfg) {
  pond <- (cfg %||% list())$ponderacion
  if (!is.list(pond) || !isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE))) return(data)
  if (!is.data.frame(data) || !nrow(data)) return(data)

  fallback <- function(motivo) {
    warning(sprintf(
      "Ponderación configurada pero no aplicada: %s; el reporte sale SIN ponderar.",
      motivo
    ), call. = FALSE)
    attr(data, "ponderacion_estado") <-
      reporte_ponderacion_estado("no_aplicada", motivo = motivo)
    data
  }

  norm <- .analitica_ponderacion_normalize(pond)
  if (!isTRUE(norm$enabled) || (is.null(norm$design) && is.null(norm$rake))) {
    return(fallback("configuración incompleta (sin diseño ni márgenes utilizables)"))
  }
  res <- tryCatch(ponderacion_compute(data, norm), error = function(e) e)
  if (inherits(res, "error")) {
    return(fallback(sprintf("el cálculo de pesos falló (%s)", conditionMessage(res))))
  }
  if (is.null(res) || !isTRUE(res$ok)) {
    motivo_res <- as.character((res %||% list())$reason %||% "motivo desconocido")[1]
    return(fallback(sprintf("el motor no produjo pesos (%s)", motivo_res)))
  }
  if (!isTRUE(res$design_applied) && !isTRUE(res$rake_applied)) {
    # ponderacion_compute devuelve ok=TRUE con peso constante 1 cuando ninguna
    # variable de calibracion existe en la base: eso ES un fallback disfrazado.
    return(fallback("ninguna variable de calibración existe en la base"))
  }
  data[["peso"]] <- as.numeric(res$peso)
  attr(data, "ponderacion_estado") <- reporte_ponderacion_estado(
    "aplicada",
    diagnostics = res$diagnostics,
    design_applied = res$design_applied,
    rake_applied = res$rake_applied,
    converged = res$converged
  )
  data
}

# Aplica ponderacion respetando la unidad de calibracion. Las bases hijas repeat
# no se recalibran a grano de instancia: heredan el peso ya calculado en la madre
# mediante la misma llave relacional usada por validacion y analitica.
.analitica_ponderacion_apply_sources <- function(sid, data_sources, inst_sources, cfg) {
  if (!length(data_sources)) {
    return(list(
      data_sources = data_sources, inst_sources = inst_sources,
      repeat_design_by_base = list()
    ))
  }

  repeat_meta <- lapply(names(data_sources), function(nombre) {
    tryCatch(.analitica_repeat_child_meta(sid, nombre), error = function(e) NULL)
  })
  names(repeat_meta) <- names(data_sources)
  child_names <- names(Filter(Negate(is.null), repeat_meta))

  # Bases normales y madres: contrato legacy, calculado sobre sus propias filas.
  for (nombre in setdiff(names(data_sources), child_names)) {
    data_sources[[nombre]] <- .analitica_ponderacion_apply(data_sources[[nombre]], cfg)
  }

  designs <- list()
  for (nombre in child_names) {
    meta <- repeat_meta[[nombre]]
    child <- data_sources[[nombre]]
    inst <- inst_sources[[nombre]] %||% list()
    grain <- attr(inst, "repeat_grain", exact = TRUE) %||%
      .analitica_repeat_grain(child, meta)
    attr(inst, "repeat_grain") <- grain

    parent_name <- as.character(meta$parent_base %||% "")
    parent <- data_sources[[parent_name]]
    if (is.data.frame(parent) && "peso" %in% names(parent)) {
      link_key <- as.character(meta$link_key %||% "_parent_index")
      parent_key <- as.character(meta$parent_index_key %||% "_index")
      child_fb <- as.character(meta$link_key_fallback %||% "_submission__id")
      pos <- tryCatch(
        .dn_repeat_parent_row_positions(
          child, parent,
          link_key = link_key, parent_index_key = parent_key,
          fallback_child_key = child_fb, fallback_parent_key = "_id"
        ),
        error = function(e) integer(0)
      )
      if (length(pos) == nrow(child)) {
        inherited <- rep(NA_real_, nrow(child))
        ok <- !is.na(pos) & pos >= 1L & pos <= nrow(parent)
        inherited[ok] <- as.numeric(parent$peso[pos[ok]])
        child[["peso"]] <- inherited
      }
    }

    design <- .analitica_repeat_design(child, inst)
    if (!is.null(design)) {
      attr(child, "repeat_design") <- design
      attr(inst, "repeat_design") <- design
      designs[[nombre]] <- design
    }
    data_sources[[nombre]] <- child
    inst_sources[[nombre]] <- inst
  }

  list(
    data_sources = data_sources,
    inst_sources = inst_sources,
    repeat_design_by_base = designs
  )
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
