# El enunciado de la escala se ensancha sólo en la lámina que lo necesita (Gonzalo, 2026-10-28).
#
# N10 ensanchaba la columna del enunciado +1,2 in en TODO el informe de Arte para que las escalas de cinco o seis barras
# no se partieran en «(cont.)»: las barras de todas las láminas quedaban 3 cm más cortas (12,2 cm frente a 15,7 cm del
# motor antiguo). Gonzalo: «no debería estar ese ensanche y aun así no aumentar el número de láminas». Aquí la columna
# conserva su ancho del estándar y, sólo cuando la escala se partiría, crece lo justo —en pasos de 0,1 in, hasta 1,2 in—
# para ahorrar las láminas que el ensanche máximo ahorraría. Rige con `evitar_cont` (piso de grosor declarado) y sin un
# ensanche del informe (`ancho_enunciado_extra_in`), que manda cuando existe.

.LAM_ENSANCHE_JUSTO_TOPE_IN <- 1.2
.LAM_ENSANCHE_JUSTO_PASO_IN <- 0.1

#' Opción del ensanche como está, para restaurarla con `options()` al terminar la lámina
#' @keywords internal
.lam_escala_ensanche_previa <- function() list(prosecnur.ancho_enunciado_extra_in = getOption("prosecnur.ancho_enunciado_extra_in"))

#' Partes de una escala con un ensanche dado (in)
#' @keywords internal
.lam_escala_partes_con <- function(premisas, espec, extra) {
  op <- options(prosecnur.ancho_enunciado_extra_in = extra); on.exit(options(op), add = TRUE)
  length(.lam_escala_partir(premisas, aire_min_fn = function(p) .lam_escala_aire_minimo(p, chica = .lam_escala_chica_por_premisa(espec, p))$alto))
}

#' Ensanche mínimo que ahorra las láminas que ahorraría el tope; 0 si no hace falta o no ahorra nada
#' @param contar Función del ensanche (in) que devuelve cuántas láminas salen.
#' @keywords internal
.lam_ensanche_justo_de <- function(contar) {
  if (!.std_evitar_cont() || .std_enunciado_extra_in() > 0) return(0)
  n0 <- contar(0)
  if (n0 <= 1L) return(0)
  n_tope <- contar(.LAM_ENSANCHE_JUSTO_TOPE_IN)
  if (n_tope >= n0) return(0)
  for (ex in seq(.LAM_ENSANCHE_JUSTO_PASO_IN, .LAM_ENSANCHE_JUSTO_TOPE_IN, by = .LAM_ENSANCHE_JUSTO_PASO_IN)) {
    if (contar(ex) <= n_tope) return(ex)
  }
  .LAM_ENSANCHE_JUSTO_TOPE_IN
}

#' Ensanche justo de una escala simple
#' @keywords internal
.lam_escala_ensanche_justo <- function(premisas, espec) {
  if (length(premisas) <= 1L) return(0)
  .lam_ensanche_justo_de(function(ex) .lam_escala_partes_con(premisas, espec, ex))
}

#' Ensanche justo de una multilista: el que deja sus bloques en las láminas que ahorraría el tope
#' @keywords internal
.lam_multilista_ensanche_fijar <- function(items, compartida) {
  ex <- .lam_ensanche_justo_de(function(e) {
    op <- options(prosecnur.ancho_enunciado_extra_in = e); on.exit(options(op), add = TRUE)
    length(.lam_multilista_planear(items, compartida))
  })
  if (ex > 0) options(prosecnur.ancho_enunciado_extra_in = ex)
  invisible(ex)
}

#' Fija el ensanche justo de esta lámina (lo restaura quien guardó `.lam_escala_ensanche_previa()`)
#' @keywords internal
.lam_escala_ensanche_fijar <- function(premisas, espec) {
  ex <- .lam_escala_ensanche_justo(premisas, espec)
  if (ex > 0) options(prosecnur.ancho_enunciado_extra_in = ex)
  invisible(ex)
}
