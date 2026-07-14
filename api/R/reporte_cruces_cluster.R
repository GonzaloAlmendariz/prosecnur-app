# =============================================================================
# Contrastes de cruces para bases repeat (cluster = persona)
# =============================================================================

.repeat_sig_empty <- function(codes_row, estratos, method = "descriptivo",
                              reason = "", n_clusters = 0L) {
  letras <- matrix(
    "", nrow = length(codes_row), ncol = length(estratos),
    dimnames = list(as.character(codes_row), as.character(estratos))
  )
  list(
    letras = letras,
    sig = matrix(FALSE, nrow = nrow(letras), ncol = ncol(letras), dimnames = dimnames(letras)),
    method = method,
    reason = as.character(reason %||% ""),
    n_clusters = as.integer(n_clusters)
  )
}

.repeat_cluster_cr1_factor <- function(n_clusters) {
  g <- suppressWarnings(as.integer(n_clusters[[1]] %||% NA_integer_))
  if (!is.finite(g) || g < 2L) return(NA_real_)
  g / (g - 1)
}

.repeat_outcome_for_code <- function(data, var, code, codes_row, tp) {
  if (identical(tp, "sm")) {
    compact <- col_sm_compact(data, var)
    if (!is.na(compact)) {
      tokens <- strsplit(as.character(data[[compact]]), "[;[:space:]]+")
      return(vapply(tokens, function(z) {
        valid <- any(z %in% as.character(codes_row))
        if (!valid) NA_real_ else as.numeric(as.character(code) %in% z)
      }, numeric(1)))
    }
    subs <- grep(paste0("^", stringr::fixed(var), "[/\\.]"), names(data), value = TRUE)
    if (!length(subs)) return(rep(NA_real_, nrow(data)))
    codes_dummy <- sub(paste0("^", var, "[/\\.]"), "", subs)
    cols_valid <- subs[codes_dummy %in% as.character(codes_row)]
    col_code <- subs[codes_dummy == as.character(code)]
    if (!length(cols_valid)) return(rep(NA_real_, nrow(data)))
    valid_mat <- sapply(cols_valid, function(nm) {
      suppressWarnings(as.numeric(as.character(data[[nm]]))) == 1
    })
    if (!is.matrix(valid_mat)) valid_mat <- matrix(valid_mat, ncol = 1L)
    valid <- rowSums(valid_mat, na.rm = TRUE) > 0
    selected <- if (length(col_code)) {
      selected_mat <- sapply(col_code, function(nm) {
        suppressWarnings(as.numeric(as.character(data[[nm]]))) == 1
      })
      if (!is.matrix(selected_mat)) selected_mat <- matrix(selected_mat, ncol = 1L)
      rowSums(selected_mat, na.rm = TRUE) > 0
    } else rep(FALSE, nrow(data))
    return(ifelse(valid, as.numeric(selected), NA_real_))
  }
  if (!var %in% names(data)) return(rep(NA_real_, nrow(data)))
  x <- as.character(data[[var]])
  valid <- !is.na(x) & x %in% as.character(codes_row)
  ifelse(valid, as.numeric(x == as.character(code)), NA_real_)
}

#' Comparaciones de proporciones con varianza sandwich por persona.
#'
#' Ajusta un modelo lineal de probabilidad saturado por estrato y calcula la
#' matriz sandwich agrupando los scores por persona. No aplica correcciones que
#' dependan del numero de filas: duplicar instancias no crea evidencia nueva.
#' @keywords internal
.repeat_compare_columns_cluster <- function(data, var, codes_row, estratos,
                                            var_estrato, tp,
                                            weight_col = "peso",
                                            repeat_design, alpha = 0.05) {
  codes_row <- as.character(codes_row)
  estratos <- as.character(estratos)
  n_clusters <- as.integer((repeat_design %||% list())$n_personas %||% 0L)
  if (!is.list(repeat_design) || !isTRUE(repeat_design$inference_ok)) {
    return(.repeat_sig_empty(
      codes_row, estratos, reason = (repeat_design %||% list())$reason %||%
        "No hay diseño repeat inferencial disponible.", n_clusters = n_clusters
    ))
  }

  cluster_col <- as.character(repeat_design$cluster_col %||% "")
  if (!nzchar(cluster_col) || !cluster_col %in% names(data) ||
      !var_estrato %in% names(data)) {
    return(.repeat_sig_empty(
      codes_row, estratos,
      reason = "Falta la llave de cluster o la variable de estrato; resultados descriptivos sin letras.",
      n_clusters = n_clusters
    ))
  }

  cluster <- as.character(data[[cluster_col]])
  strata <- as.character(data[[var_estrato]])
  w <- if (weight_col %in% names(data)) suppressWarnings(as.numeric(data[[weight_col]])) else rep(1, nrow(data))
  base_ok <- !is.na(cluster) & nzchar(cluster) & !is.na(strata) & strata %in% estratos &
    is.finite(w) & w > 0
  effective_clusters <- length(unique(cluster[base_ok]))
  min_clusters <- as.integer(repeat_design$min_clusters %||% 8L)
  if (effective_clusters < min_clusters) {
    return(.repeat_sig_empty(
      codes_row, estratos,
      reason = sprintf(
        "El cruce conserva %d clusters de persona; se requieren al menos %d. Resultados descriptivos sin letras.",
        effective_clusters, min_clusters
      ),
      n_clusters = effective_clusters
    ))
  }
  K <- length(estratos)
  out <- .repeat_sig_empty(
    codes_row, estratos, method = "cluster_robust", n_clusters = effective_clusters
  )
  p_by_row <- matrix(NA_real_, nrow = length(codes_row), ncol = K)
  pvals_by_row <- vector("list", length(codes_row))
  pairs_by_row <- vector("list", length(codes_row))
  valid_clusters_by_row <- rep(0L, length(codes_row))
  any_eligible_pair <- FALSE

  for (i in seq_along(codes_row)) {
    y <- .repeat_outcome_for_code(data, var, codes_row[[i]], codes_row, tp)
    ok <- base_ok & is.finite(y)
    if (!any(ok)) next
    valid_clusters_by_row[[i]] <- length(unique(cluster[ok]))
    if (valid_clusters_by_row[[i]] < min_clusters) next
    X <- stats::model.matrix(~ 0 + factor(strata[ok], levels = estratos))
    ww <- w[ok]
    yy <- y[ok]
    bread_diag <- colSums(X * ww)
    estimable <- which(is.finite(bread_diag) & bread_diag > 0)
    if (length(estimable) < 2L) next
    beta <- colSums(X * (ww * yy)) / bread_diag
    p_by_row[i, ] <- beta
    resid <- yy - as.numeric(X %*% beta)
    scores <- X * (ww * resid)
    score_by_cluster <- rowsum(scores, group = cluster[ok], reorder = FALSE)
    meat <- crossprod(score_by_cluster)
    inv_bread <- diag(ifelse(bread_diag > 0, 1 / bread_diag, 0), nrow = K)
    vcov <- inv_bread %*% meat %*% inv_bread

    pairs <- utils::combn(estimable, 2L, simplify = TRUE)
    pvals <- apply(pairs, 2L, function(ab) {
      pair_rows <- strata[ok] %in% estratos[ab]
      g_pair <- length(unique(cluster[ok][pair_rows]))
      if (g_pair < min_clusters) return(NA_real_)
      contrast <- rep(0, K)
      contrast[ab[[1]]] <- 1
      contrast[ab[[2]]] <- -1
      cr1 <- .repeat_cluster_cr1_factor(g_pair)
      se <- sqrt(cr1 * as.numeric(t(contrast) %*% vcov %*% contrast))
      if (!is.finite(se) || se <= 0) return(NA_real_)
      any_eligible_pair <<- TRUE
      stat <- as.numeric((beta[ab[[1]]] - beta[ab[[2]]]) / se)
      2 * stats::pt(-abs(stat), df = g_pair - 1L)
    })
    pvals_by_row[[i]] <- stats::p.adjust(pvals, method = "bonferroni")
    pairs_by_row[[i]] <- pairs
  }

  positive_counts <- valid_clusters_by_row[valid_clusters_by_row > 0L]
  n_effective <- if (length(positive_counts)) min(positive_counts) else 0L
  if (!any_eligible_pair) {
    return(.repeat_sig_empty(
      codes_row, estratos,
      reason = sprintf(
        "El contraste conserva %d clusters con respuesta valida; se requieren al menos %d. Resultados descriptivos sin letras.",
        n_effective, min_clusters
      ),
      n_clusters = n_effective
    ))
  }
  out$n_clusters <- as.integer(n_effective)

  for (i in seq_along(codes_row)) {
    padj <- pvals_by_row[[i]]
    pairs <- pairs_by_row[[i]]
    if (is.null(padj) || is.null(pairs)) next
    locked <- !is.finite(p_by_row[i, ]) | p_by_row[i, ] <= 0 | p_by_row[i, ] >= 1
    out$letras[i, locked] <- ".a"
    for (k in seq_along(padj)) {
      if (!is.finite(padj[[k]]) || padj[[k]] >= alpha) next
      a <- pairs[1L, k]
      b <- pairs[2L, k]
      if (p_by_row[i, a] > p_by_row[i, b]) {
        out$letras[i, a] <- trimws(paste(out$letras[i, a], LETTERS[b]))
        out$sig[i, a] <- TRUE
      } else if (p_by_row[i, b] > p_by_row[i, a]) {
        out$letras[i, b] <- trimws(paste(out$letras[i, b], LETTERS[a]))
        out$sig[i, b] <- TRUE
      }
    }
  }
  out
}
