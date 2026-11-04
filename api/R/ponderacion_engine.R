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
#
# Cadena del peso del ADR 0131 §6 (todo opcional; sin estas opciones el peso es
# el de siempre):
#   - `design$peso_columna`: el peso base es una columna de la base (el peso de
#     diseno 1/pi de cada caso) y el raking parte de el;
#   - `escala = "expansion"`: el peso final suma N̂ (las metas de poblacion) en
#     vez de tener media 1;
#   - `trim$recalibrar = TRUE`: recorte y raking alternan en ciclo hasta que el
#     tope y los margenes se cumplen a la vez.
# Lo que antes pasaba en silencio (categoria sin casos, estrato ausente de
# `pop_sizes`, casos fuera de las metas, raking que no converge, recorte que
# rompe margenes) sale en `avisos`, que Analitica publica.
# =============================================================================

# --- utilidades internas -----------------------------------------------------

.ponderacion_num <- function(x) {
  out <- suppressWarnings(as.numeric(x))
  out[!is.finite(out)] <- NA_real_
  out
}

# Un aviso del motor: misma forma que .analitica_ponderacion_warnings
# (level/code/message) mas campos de detalle para la UI.
.ponderacion_aviso <- function(level, code, message, ...) {
  c(list(level = level, code = code, message = message), list(...))
}

# Rotulo legible de una categoria observada (NA -> "(sin dato)").
.ponderacion_rotulo <- function(x) {
  x <- as.character(x)
  x[is.na(x) | !nzchar(x)] <- "(sin dato)"
  x
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
# recortar y re-normalizar puede reintroducir extremos. Ojo: re-normalizar NO
# recalibra, asi que tras un raking los margenes dejan de cumplirse. El ciclo
# que si los conserva es `.ponderacion_trim_recalibrar`.
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
  avisos <- list()
  fuera <- is.na(stratum) | !stratum %in% names(targets)
  if (any(fuera)) {
    cats <- sort(unique(.ponderacion_rotulo(stratum[fuera])))
    avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
      "warn", "estrato_sin_poblacion",
      sprintf("%d casos están en estratos sin tamaño de población (%s): reciben factor 1 en el diseño (no se reequilibran) y luego solo los mueve la normalización o el raking.",
              sum(fuera), paste(cats, collapse = ", ")),
      categorias = cats, casos = as.integer(sum(fuera))
    )
  }
  vacios <- setdiff(names(targets)[targets > 0], unique(stratum[!is.na(stratum)]))
  if (length(vacios)) {
    avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
      "warn", "estrato_sin_casos",
      sprintf("Estratos con población y sin casos en la muestra (%s): su población no queda representada.",
              paste(vacios, collapse = ", ")),
      categorias = vacios
    )
  }
  if (length(avisos)) attr(w, "avisos") <- avisos
  w
}

# --- raking / IPF ------------------------------------------------------------

# Raking (iterative proportional fitting) a margenes marginales.
# `data`: data.frame. `margins`: lista de listas con $var (nombre de columna) y
# $targets (vector nombrado de proporciones/conteos por categoria). `base`: peso
# inicial (p.ej. de diseno); por defecto 1. Devuelve el peso final (media 1) y,
# como atributos, la convergencia.
.ponderacion_rake <- function(data, margins, base = NULL,
                              max_iter = 50L, tol = 1e-7,
                              codigos_faltantes = c("98", "99")) {
  n <- nrow(data)
  w <- if (is.null(base)) rep(1, n) else .ponderacion_num(base)
  w[is.na(w) | w < 0] <- 0
  margins <- Filter(function(m) is.list(m) && nzchar(.ponderacion_scalar(m$var, "")), margins %||% list())
  # Precalcula niveles observados y objetivos normalizados por margen.
  prepared <- lapply(margins, function(m) {
    v <- as.character(data[[m$var]])
    tgt <- .ponderacion_normalize_targets(m$targets)
    # Casos con categoria valida en este margen: los unicos que el paso ajusta.
    dentro <- !is.na(v) & v %in% names(tgt)
    list(var = m$var, values = v, targets = tgt, dentro = dentro)
  })
  prepared <- Filter(function(p) !is.null(p$targets), prepared)
  attr_avisos <- .ponderacion_rake_avisos(prepared, w, codigos_faltantes)
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
      # «Dejar fuera del margen» (ipf `exclude`; Battaglia, Hoaglin y Frankel
      # 2009): la meta se escala a la parte del total que representan los casos
      # con categoria valida, y los NA/98/99 conservan el peso que traen en este
      # paso. Antes el total incluia a los sin dato: el margen no podia cerrar,
      # el raking no convergia y esos casos perdian peso en cada iteracion. Sin
      # sin-dato, `w[p$dentro]` es `w` entero y el calculo es el de siempre.
      total_w <- sum(w[p$dentro])
      if (total_w <= 0) next
      cur <- tapply(w, p$values, sum)
      # Una categoria sin casos (o sin peso) no se puede ajustar: su meta se
      # reparte entre las presentes. Sin renormalizar, el factor de las demas
      # quedaba en Σmetas != 1 para siempre y el raking nunca convergia. Solo
      # se renormaliza cuando falta alguna: si estan todas el calculo es el de
      # siempre, bit a bit.
      presentes <- vapply(names(p$targets), function(l) {
        isTRUE(l %in% names(cur) && is.finite(cur[[l]]) && cur[[l]] > 0)
      }, logical(1))
      tgt <- p$targets
      if (!all(presentes) && any(presentes) && sum(tgt[presentes]) > 0) {
        tgt <- tgt / sum(tgt[presentes])
      }
      for (lvl in names(p$targets)) {
        # tapply no trae la categoria sin casos: `cur[[lvl]]` cortaba el calculo.
        cur_w <- if (lvl %in% names(cur)) as.numeric(cur[[lvl]]) else 0
        if (!is.finite(cur_w)) cur_w <- 0
        cur_share <- cur_w / total_w
        if (cur_share <= 0) next
        factor <- tgt[[lvl]] / cur_share
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
  if (length(attr_avisos)) attr(w, "avisos") <- attr_avisos
  w
}

# Lo que el raking deja sin ajustar, dicho antes de iterar:
#   - una categoria con meta > 0 y sin casos (o sin peso) en la muestra: el bucle
#     la salta y el margen queda incumplido (el resto se reparte su meta);
#   - casos cuya categoria no esta en las metas (NA, 98/99, otra): ningun factor
#     los toca en ese margen y conservan el peso que traian.
.ponderacion_rake_avisos <- function(prepared, w, codigos_faltantes = c("98", "99")) {
  avisos <- list()
  for (p in prepared) {
    observed <- tapply(w, p$values, sum)
    sin_casos <- names(p$targets)[p$targets > 0 &
      vapply(names(p$targets), function(l) !isTRUE(as.numeric(observed[l]) > 0), logical(1))]
    if (length(sin_casos)) {
      avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
        "warn", "categoria_sin_casos",
        sprintf("El margen «%s» tiene categorías sin casos en la muestra (%s): su meta (%.1f%%) no se puede cumplir y el margen queda incumplido.",
                p$var, paste(sin_casos, collapse = ", "), 100 * sum(p$targets[sin_casos])),
        var = p$var, categorias = sin_casos
      )
    }
    fuera <- !p$dentro
    if (any(fuera)) {
      cats <- sort(unique(.ponderacion_rotulo(p$values[fuera])))
      sin_dato <- all(.ponderacion_es_faltante(p$values[fuera], names(p$targets), codigos_faltantes))
      que <- if (sin_dato) sprintf("sin dato en «%s»", p$var) else sprintf("de «%s» sin dato o sin meta", p$var)
      avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
        "info", "categoria_fuera_de_margen",
        sprintf("%d casos %s (%s) conservan su peso en ese margen: el ajuste se aplica sólo a los casos con categoría válida, con la meta escalada a la parte del total que representan.",
                sum(fuera), que, paste(cats, collapse = ", ")),
        var = p$var, categorias = cats, casos = as.integer(sum(fuera))
      )
    }
  }
  avisos
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
    # Las proporciones se leen entre los casos con categoria valida, que es
    # sobre lo que el raking calibra («dejar fuera del margen»). Contra el total
    # con NA, un margen que cierra se veia incumplido. Sin NA es lo de siempre.
    dentro <- !is.na(v) & v %in% names(tgt)
    v <- v[dentro]
    wd <- w[dentro]
    n <- length(v)
    unw <- if (n > 0) table(v) / n else table(v)
    wt <- tapply(wd, v, sum)
    tot_w <- sum(wd)
    rows <- lapply(names(tgt), function(lvl) {
      list(
        categoria = lvl,
        objetivo = unname(tgt[[lvl]]),
        muestra = if (lvl %in% names(unw)) as.numeric(unw[[lvl]]) else 0,
        ponderado = if (tot_w > 0 && lvl %in% names(wt)) as.numeric(wt[[lvl]] / tot_w) else 0
      )
    })
    out[[var]] <- rows
  }
  out
}

# --- cadena del peso (ADR 0131 §6) ---------------------------------------------

# Peso base desde una columna de la base: el peso de diseno de cada caso. Tiene
# que ser numerico, finito y > 0 en TODOS los casos: un caso sin peso de diseno
# no es un caso de peso 0, es un error del marco que el analista debe ver.
.ponderacion_peso_base <- function(data, col) {
  if (!col %in% names(data)) {
    stop_api(422, "E_PONDERACION_PESO_BASE_INEXISTENTE",
             sprintf("La columna de peso base '%s' no existe en la base.", col),
             details = list(peso_columna = col))
  }
  x <- data[[col]]
  if (is.factor(x)) x <- as.character(x)
  w <- suppressWarnings(as.numeric(unclass(x)))
  bad <- !is.finite(w) | w <= 0
  if (any(bad)) {
    stop_api(422, "E_PONDERACION_PESO_BASE_INVALIDO",
             sprintf("La columna de peso base '%s' tiene %d casos sin un peso válido (vacío, no numérico, 0 o negativo). El peso de diseño debe ser un número mayor que 0 en todos los casos.",
                     col, sum(bad)),
             details = list(peso_columna = col, casos_invalidos = as.integer(sum(bad)),
                            filas = utils::head(which(bad), 20L)))
  }
  w
}

# Mayor desvio absoluto (en proporcion) entre margen ponderado y meta, sobre las
# categorias con casos y con la meta renormalizada a ellas: es lo alcanzable. Una
# categoria sin casos ya tiene su propio aviso (categoria_sin_casos).
.ponderacion_max_desvio <- function(data, margins, w) {
  w <- .ponderacion_num(w)
  w[is.na(w) | w < 0] <- 0
  tot <- sum(w)
  if (tot <= 0) return(Inf)
  out <- 0
  for (m in margins %||% list()) {
    tgt <- .ponderacion_normalize_targets(m$targets)
    if (is.null(tgt)) next
    v <- as.character(data[[m$var]])
    dentro <- !is.na(v) & v %in% names(tgt)
    sw <- tapply(w[dentro], v[dentro], sum)
    obs <- intersect(names(tgt), names(sw)[sw > 0])
    if (!length(obs) || sum(tgt[obs]) <= 0) next
    t_obs <- tgt[obs] / sum(tgt[obs])
    sh <- as.numeric(sw[obs]) / sum(sw)
    out <- max(out, max(abs(sh - as.numeric(t_obs))))
  }
  out
}

# Recorte seguido de recalibracion, en ciclo: recortar a [m/cap, cap*m] y volver
# a rakear partiendo del peso recortado, hasta que el tope y los margenes se
# cumplen a la vez o se agotan los ciclos. Los pesos 0 (meta 0) no se tocan.
.ponderacion_trim_recalibrar <- function(data, margins, w, cap, max_ciclos = 20L,
                                         tol_margen = 1e-3, max_iter = 50L, tol = 1e-7,
                                         codigos_faltantes = c("98", "99")) {
  # El tope se cumple con 0,1% de holgura relativa: cuando la solucion cae justo
  # en el borde, el ciclo se acerca a el de forma asintotica y no lo toca nunca.
  holgura <- 1e-3
  cumple <- function(x) {
    pos <- x[x > 0]
    if (!length(pos)) return(TRUE)
    m <- mean(x)
    max(pos) <= cap * m * (1 + holgura) &&
      min(pos) >= (m / cap) * (1 - holgura) &&
      .ponderacion_max_desvio(data, margins, x) <= tol_margen
  }
  ok <- cumple(w)
  ciclos <- 0L
  converged <- TRUE
  iterations <- 0L
  while (!ok && ciclos < max_ciclos) {
    ciclos <- ciclos + 1L
    m <- mean(w)
    pos <- w > 0
    w[pos] <- pmin(pmax(w[pos], m / cap), cap * m)
    w <- .ponderacion_rake(data, margins, base = w, max_iter = max_iter, tol = tol,
                           codigos_faltantes = codigos_faltantes)
    converged <- isTRUE(attr(w, "converged"))
    iterations <- as.integer(attr(w, "iterations") %||% 0L)
    ok <- cumple(w)
  }
  w <- as.numeric(w)
  attr(w, "ciclos") <- ciclos
  attr(w, "convergio") <- ok
  attr(w, "rake_converged") <- converged
  attr(w, "rake_iterations") <- iterations
  w
}

# N̂ para el peso de expansion. Orden: total explicito > metas de los margenes en
# conteos > pop_sizes del diseno > suma del peso base (Horvitz-Thompson).
.ponderacion_total_expansion <- function(config, margins, design_applied, base_raw) {
  avisos <- list()
  total <- suppressWarnings(as.numeric(config$total_poblacion %||% NA_real_)[1])
  if (is.finite(total) && total > 0) return(list(total = total, avisos = avisos))
  conteos <- integer(0)
  if (length(margins)) {
    sums <- vapply(margins, function(m) {
      v <- .ponderacion_num(m$targets)
      sum(v[is.finite(v) & v >= 0])
    }, numeric(1))
    conteos <- which(sums > 1 + 1e-9)
  }
  # Metas en proporciones no dicen N̂: se sigue con pop_sizes y el peso base.
  if (length(margins) && length(conteos)) {
    total <- sums[[conteos[[1]]]]
    otros <- sums[conteos]
    if (any(abs(otros - total) / total > 0.005)) {
      vars <- vapply(margins[conteos], function(m) .ponderacion_scalar(m$var, ""), character(1))
      avisos[[1]] <- .ponderacion_aviso(
        "warn", "totales_inconsistentes",
        sprintf("Las metas de los márgenes no suman lo mismo (%s). El peso de expansión usa el total de «%s» (%s).",
                paste(sprintf("%s = %s", vars, format(otros, big.mark = ",", trim = TRUE)), collapse = "; "),
                vars[[1]], format(total, big.mark = ",", trim = TRUE)),
        totales = stats::setNames(as.list(otros), vars)
      )
    }
    return(list(total = total, avisos = avisos))
  }
  pop <- .ponderacion_num((config$design %||% list())$pop_sizes)
  pop <- pop[is.finite(pop) & pop >= 0]
  if (design_applied && length(pop) && sum(pop) > 0 && is.null(base_raw)) {
    return(list(total = sum(pop), avisos = avisos))
  }
  if (!is.null(base_raw)) return(list(total = sum(base_raw), avisos = avisos))
  stop_api(422, "E_PONDERACION_EXPANSION_SIN_TOTAL",
           "El peso de expansión necesita la población total: las metas están en proporciones y no hay tamaños de estrato ni peso base. Declara 'total_poblacion' o escribe las metas como conteos.")
}

.ponderacion_diag_corto <- function(w) {
  d <- .ponderacion_diagnostics(w)
  m <- d$mean
  list(deff = d$deff, n_eff = d$n_eff,
       max_sobre_media = if (is.finite(m) && m > 0) d$max / m else NA_real_)
}

# --- orquestador -------------------------------------------------------------

# Calcula el peso final a partir de una config declarativa y devuelve peso +
# diagnosticos. Config:
#   list(
#     enabled = TRUE/FALSE,
#     design = list(var = "distrito", pop_sizes = c(A = 1000, B = 2000)) |
#              list(peso_columna = "peso_diseno") | NULL,
#     rake   = list(
#       margins = list(list(var = "sexo", targets = c(H = 0.49, M = 0.51)), ...),
#       max_iter = 50, tol = 1e-7,
#       faltantes = "excluir" | "imputar",   # NA/98/99 (ponderacion_faltantes.R)
#       imputacion = list(umbral = 0.05, semilla = 20261104L),
#       codigos_faltantes = c("98", "99")
#     ) | NULL,
#     trim = list(cap = 5,                 # cap = multiplicador sobre la media
#                 recalibrar = FALSE,      # TRUE: recorte + raking en ciclo
#                 max_ciclos = 20, tol_margen = 1e-3) | NULL,
#     escala = "media1" | "expansion",     # expansion: sum(peso) = N̂
#     total_poblacion = NULL               # N̂ explicito (si las metas son proporciones)
#   )
# `design$peso_columna` manda sobre `design$var`: el peso de diseno por caso ya
# incorpora la estratificacion.
# Devuelve list(peso, diagnostics, margins, design_applied, rake_applied,
# converged, iterations, avisos, escala, total_poblacion, peso_base, recorte).
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
      iterations = 0L,
      avisos = list(),
      escala = "media1"
    )
  }
  if (!n) return(empty("no_data"))
  config <- config %||% list()
  if (isFALSE(config$enabled %||% FALSE) && !is.null(config$enabled)) return(empty("disabled"))

  avisos <- list()
  add_avisos <- function(x) if (length(x)) avisos <<- c(avisos, x)

  base <- rep(1, n)
  base_raw <- NULL
  peso_base <- NULL
  design_applied <- FALSE
  design <- config$design
  col_base <- if (is.list(design)) trimws(.ponderacion_scalar(design$peso_columna, "")) else ""
  if (nzchar(col_base)) {
    base_raw <- .ponderacion_peso_base(data, col_base)
    base <- base_raw * n / sum(base_raw)
    peso_base <- col_base
    design_applied <- TRUE
  } else if (is.list(design) && nzchar(.ponderacion_scalar(design$var, "")) &&
             design$var %in% names(data)) {
    base <- .ponderacion_design_weights(data[[design$var]], design$pop_sizes)
    add_avisos(attr(base, "avisos"))
    attr(base, "avisos") <- NULL
    design_applied <- TRUE
  }

  rake_applied <- FALSE
  converged <- TRUE
  iterations <- 0L
  margins <- list()
  w <- base
  rake <- config$rake
  max_iter <- as.integer(rake$max_iter %||% 50L)
  tol <- as.numeric(rake$tol %||% 1e-7)
  faltantes <- NULL
  imputacion <- NULL
  data_cal <- data
  codigos <- as.character(unlist((rake %||% list())$codigos_faltantes %||% c("98", "99")))
  if (is.list(rake) && length(rake$margins %||% list())) {
    margins <- Filter(function(m) is.list(m) && .ponderacion_scalar(m$var, "") %in% names(data),
                      rake$margins)
    if (length(margins)) {
      faltantes <- if (identical(.ponderacion_scalar(rake$faltantes, ""), "imputar")) "imputar" else "excluir"
      if (identical(faltantes, "imputar")) {
        # Se imputa una copia (data_cal) solo para calibrar: `data` no se toca.
        imp <- .ponderacion_imputar(data, margins, rake$imputacion, codigos)
        data_cal <- imp$data
        imputacion <- imp$resumen
        add_avisos(imp$avisos)
      }
      w <- .ponderacion_rake(data_cal, margins, base = base, max_iter = max_iter, tol = tol,
                             codigos_faltantes = codigos)
      rake_applied <- TRUE
      converged <- isTRUE(attr(w, "converged"))
      iterations <- as.integer(attr(w, "iterations") %||% 0L)
      add_avisos(attr(w, "avisos"))
      attr(w, "avisos") <- NULL
    }
  }

  recorte <- NULL
  trim <- config$trim
  cap <- if (is.list(trim)) suppressWarnings(as.numeric(trim$cap %||% NA)[1]) else NA_real_
  if (is.finite(cap) && cap > 1) {
    tol_margen <- suppressWarnings(as.numeric(trim$tol_margen %||% 1e-3)[1])
    if (!is.finite(tol_margen) || tol_margen <= 0) tol_margen <- 1e-3
    antes <- .ponderacion_diag_corto(w)
    if (isTRUE(trim$recalibrar) && rake_applied) {
      max_ciclos <- suppressWarnings(as.integer(trim$max_ciclos %||% 20L)[1])
      if (is.na(max_ciclos) || max_ciclos < 1L) max_ciclos <- 20L
      w <- .ponderacion_trim_recalibrar(data_cal, margins, as.numeric(w), cap = cap,
                                        max_ciclos = max_ciclos, tol_margen = tol_margen,
                                        max_iter = max_iter, tol = tol,
                                        codigos_faltantes = codigos)
      ciclos <- attr(w, "ciclos")
      convergio <- isTRUE(attr(w, "convergio"))
      if (ciclos > 0L) {
        converged <- isTRUE(attr(w, "rake_converged"))
        iterations <- attr(w, "rake_iterations")
      }
      w <- if (sum(w) > 0) as.numeric(w) * n / sum(w) else rep(1, n)
      desvio <- .ponderacion_max_desvio(data_cal, margins, w)
      if (!convergio) {
        avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
          "warn", "recorte_no_converge",
          sprintf("El recorte a %s veces la media no se pudo conciliar con los márgenes en %d ciclos: el peso mayor queda en %.2f veces la media y el desvío máximo de margen en %.2f puntos.",
                  format(cap), ciclos, max(w) / mean(w), 100 * desvio),
          ciclos = ciclos, max_sobre_media = max(w) / mean(w), max_desvio_margen = desvio
        )
      }
      modo <- "recalibrar"
    } else {
      w <- .ponderacion_trim(w, cap = cap, target_sum = n)
      ciclos <- 0L
      desvio <- if (rake_applied) .ponderacion_max_desvio(data_cal, margins, w) else 0
      convergio <- TRUE
      if (rake_applied && desvio > tol_margen) {
        avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
          "info", "recorte_rompe_margenes",
          sprintf("El recorte desplazó los márgenes calibrados hasta %.2f puntos. Para conservarlos, activa la recalibración después del recorte.",
                  100 * desvio),
          max_desvio_margen = desvio
        )
      }
      modo <- "renormalizar"
    }
    recorte <- list(
      cap = cap, modo = modo, ciclos = as.integer(ciclos), convergio = convergio,
      tol_margen = tol_margen, max_desvio_margen = desvio,
      antes = antes, despues = .ponderacion_diag_corto(w)
    )
  } else {
    w <- if (sum(w) > 0) w * n / sum(w) else rep(1, n)
  }
  w <- as.numeric(w)

  if (rake_applied && !converged) {
    avisos[[length(avisos) + 1L]] <- .ponderacion_aviso(
      "warn", "no_converge",
      sprintf("El raking no convergió en %d iteraciones: los márgenes pueden quedar lejos de sus metas. Suele deberse a metas incompatibles o a categorías sin casos en la muestra.",
              iterations),
      iteraciones = iterations
    )
  }

  escala <- if (identical(tolower(.ponderacion_scalar(config$escala, "")), "expansion")) "expansion" else "media1"
  total_poblacion <- NULL
  if (identical(escala, "expansion")) {
    tot <- .ponderacion_total_expansion(config, margins, design_applied, base_raw)
    add_avisos(tot$avisos)
    total_poblacion <- tot$total
    if (sum(w) > 0) w <- w * total_poblacion / sum(w)
  }

  list(
    ok = TRUE,
    reason = NULL,
    peso = w,
    diagnostics = .ponderacion_diagnostics(w),
    margins = .ponderacion_margin_compare(data_cal, margins, w),
    design_applied = design_applied,
    rake_applied = rake_applied,
    converged = converged,
    iterations = iterations,
    avisos = avisos,
    escala = escala,
    total_poblacion = total_poblacion,
    peso_base = peso_base,
    recorte = recorte,
    faltantes = faltantes,
    imputacion = imputacion
  )
}
