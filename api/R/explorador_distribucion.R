# =============================================================================
# Explorador de variables — distribución univariada por tipo (E6, `uni.dist`)
# =============================================================================
# Contrato congelado (docs/qa/checklist-explorador-variables-2026-11-02.md):
#   dist: { tipo, ordinal, base_n, filas?, cuantas_marca?, num?, fecha?, texto? }
# Base (`base_n`): los casos de la base ya filtrada que responden la variable (so: código no vacío; sm: marca al menos
# una opción; num: valor finito; fecha: fecha legible; texto: no vacío). Todo `pct` está en escala 0–100 y se calcula
# sobre `base_n`; en sm suma más de 100 porque cada caso marca varias.
# `filas` lleva todas las opciones de la lista (también las de n = 0, que la escala ordinal necesita ver) y al final
# los códigos observados que no están en la lista.

#' ¿La lista de la variable es ordinal? Manda lo que Analítica declaró; sin marca, la heurística compartida
#' `.is_ordinal_choice_list` sobre el catálogo de la variable
#' @keywords internal
.explorador_es_ordinal <- function(var, instrumento) {
  ln <- .explorar_list_name_for_var(var, instrumento)
  if (is.na(ln) || !nzchar(ln)) return(FALSE)
  if (ln %in% as.character(instrumento$listas_nominales %||% character())) return(FALSE)
  if (!is.null(instrumento$listas_ordinales)) return(ln %in% as.character(instrumento$listas_ordinales))
  map <- .explorar_map_choices(var, instrumento)
  if (is.null(map) || !length(map)) return(FALSE)
  # La heurística sólo lee `attr(, "labels")`: un catálogo que no parsea como pares código/etiqueta no es ordinal.
  isTRUE(tryCatch(.is_ordinal_choice_list(structure(logical(0), labels = map)), error = function(e) FALSE))
}

.explorador_pct <- function(n, base) if (base > 0) 100 * n / base else 0

#' Filas {codigo, etiqueta, n, pct} de una so/sm
#' @keywords internal
.explorador_dist_filas <- function(niveles, n, base_n) {
  lapply(seq_len(nrow(niveles)), function(i) list(
    codigo = niveles$codigo[i], etiqueta = niveles$etiqueta[i],
    n = as.integer(n[i]), pct = .explorador_pct(n[i], base_n)
  ))
}

#' Histograma Freedman–Diaconis acotado a 8–30 tramos (un solo tramo si no hay variación)
#' @keywords internal
.explorador_bins <- function(x) {
  if (!length(x)) return(list())
  lo <- min(x); hi <- max(x)
  if (lo == hi) return(list(list(desde = lo, hasta = hi, n = length(x))))
  iqr <- stats::IQR(x)
  h <- 2 * iqr / length(x)^(1 / 3)
  k <- if (is.finite(h) && h > 0) ceiling((hi - lo) / h) else 8L
  k <- as.integer(max(8L, min(30L, k)))
  cortes <- seq(lo, hi, length.out = k + 1L)
  tramo <- findInterval(x, cortes, rightmost.closed = TRUE, all.inside = TRUE)
  cuenta <- tabulate(tramo, nbins = k)
  lapply(seq_len(k), function(i) list(desde = cortes[i], hasta = cortes[i + 1L], n = as.integer(cuenta[i])))
}

#' Resumen numérico del contrato (`dist.num`)
#' @keywords internal
.explorador_dist_num <- function(x) {
  x <- x[is.finite(x)]
  if (!length(x)) {
    return(list(bins = list(), min = NA, p25 = NA, mediana = NA, p75 = NA, max = NA, media = NA, n_atipicos = 0L))
  }
  caja <- .explorador_caja(x, "")
  list(bins = .explorador_bins(x), min = caja$min, p25 = caja$p25, mediana = caja$mediana, p75 = caja$p75,
       max = caja$max, media = mean(x), n_atipicos = caja$n_atipicos)
}

#' Casos por día (fecha ISO), en orden cronológico
#' @keywords internal
.explorador_dias <- function(fechas) {
  fechas <- fechas[!is.na(fechas)]
  if (!length(fechas)) return(list())
  tb <- table(format(fechas, "%Y-%m-%d"))
  dias <- sort(names(tb))
  lapply(dias, function(d) list(fecha = d, n = as.integer(tb[[d]])))
}

#' Distribución univariada de una variable sobre una base ya filtrada (contrato `dist`)
#' @param df Base ya filtrada por fuente y filtros.
#' @param tipo Tipo del explorador; si falta, se detecta como en el resto del explorador.
#' @keywords internal
explorador_distribucion <- function(df, var, instrumento, tipo = NULL) {
  lec <- .explorador_leer(df, var, instrumento, tipo)
  base_n <- as.integer(sum(lec$valido))
  out <- list(tipo = lec$tipo, ordinal = FALSE, base_n = base_n)
  if (identical(lec$tipo, "so")) {
    n <- vapply(lec$niveles$codigo, function(cd) sum(lec$codigo == cd, na.rm = TRUE), numeric(1))
    out$ordinal <- .explorador_es_ordinal(var, instrumento)
    out$filas <- .explorador_dist_filas(lec$niveles, n, base_n)
  } else if (identical(lec$tipo, "sm")) {
    m <- lec$mat[lec$valido, , drop = FALSE]
    out$filas <- .explorador_dist_filas(lec$niveles, colSums(m), base_n)
    k <- rowSums(m)
    cuenta <- c(`1` = sum(k == 1), `2` = sum(k == 2), `3+` = sum(k >= 3))
    out$cuantas_marca <- lapply(names(cuenta), function(nm) list(
      k = nm, n = as.integer(cuenta[[nm]]), pct = .explorador_pct(cuenta[[nm]], base_n)
    ))
  } else if (identical(lec$tipo, "num")) {
    out$num <- .explorador_dist_num(lec$valor[lec$valido])
  } else if (identical(lec$tipo, "fecha")) {
    out$fecha <- list(dias = .explorador_dias(lec$valor[lec$valido]))
  } else {
    out$texto <- list(grupos = .explorador_textos_json(.explorador_agrupar_textos(lec$valor[lec$valido], top = 50L)))
  }
  out
}
