# N del sorteo con la lógica «Calculado» (revisión del 10 nov 2026, diseño nacional TCD: 25 distritos en 6
# ciudades). El cálculo del tamaño devolvía N = 2,412 (402 rutas de 6), pero `n_objetivo` seguía en el 120 que
# traía la config: el endpoint de tamaño guarda la config ANTES de calcular y el N calculado nunca volvía a ella.
# Las cuotas y el sorteo leen `n_objetivo`, así que sortearon 20 UMP y dejaron distritos sin ruta mientras el botón
# «Diseño» y Muestra decían 2,412. Con la lógica «Calculado» el N es, por definición, el que sale del cálculo.

#' Config con el N del cálculo cuando la lógica del N es «Calculado».
#'
#' Con `sample_size_mode` distinto de "calculator" (N total o por distrito) devuelve la config intacta: ahí el N
#' lo escribe el usuario. Si el cálculo falla o no da un N positivo, también la deja como está.
#'
#' @param cfg Config ya normalizada (`hojas_ruta_integrada_normalize_config`).
#' @return La config, con `n_objetivo` = `n_used` del cálculo del tamaño en modo "calculator".
#' @noRd
hojas_ruta_n_calculado <- function(cfg) {
  if (!identical(cfg$sample_size_mode, "calculator") || !length(unlist(cfg$territorios))) return(cfg)
  # Igual que el endpoint de tamaño: un ICC aplicado recalcula el DEFF con el k vigente (ADR 0116 §2).
  calc <- cfg
  calc$sample_size <- hojas_ruta_icc_reconciliar(calc$sample_size, .hojas_ruta_route_size(calc))
  tam <- tryCatch(hojas_ruta_sample_size_preview(calc), error = function(e) NULL)
  n <- suppressWarnings(as.integer(tam$n_used %||% NA_integer_))
  if (length(n) != 1L || is.na(n) || n <= 0L) return(cfg)
  cfg$n_objetivo <- n
  cfg
}
