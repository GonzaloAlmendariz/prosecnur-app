# =============================================================================
# graficos_significancia_ranuras.R — diferencias por ranura de una lámina (ADR 0128 «Familia por base»)
# =============================================================================
#
# Desde 9402997b4 toda ranura con cruce de una lámina entra en la familia de BH de SU base (`.sig_slots_del_plan`,
# `.sig_base_de_slot`) y el PPT la marca. El inspector y el informe probaban sólo la primera: en una p_slide_4_graficos
# las ranuras 2..n no aparecían. Aquí se prueba cada una con la misma `.sig_lamina_json`, sobre la base de la ranura y
# contra la familia de esa base. Una ranura de base ambigua o desconocida es una entrada con error; las demás se prueban.

#' Una entrada por ranura con cruce de la lámina, en el orden del payload
#'
#' @param slide Lámina del plan.
#' @param contexto_de Función `(slide, g) -> list(fuente, ctx, base)` (`.sig_contexto_por_lamina`).
#' @return Lista de entradas: los campos de `.sig_lamina_json` más `ranura` (nombre de la ranura en el payload, o su
#'   posición), `indice` (posición 1-based en el payload), `graficador` y `base` (`NA` si no se pudo resolver).
#' @keywords internal
.sig_ranuras_json <- function(slide, contexto_de) {
  payload <- slide$payload %||% list()
  nombres <- names(payload) %||% rep("", length(payload))
  out <- list()
  for (i in seq_along(payload)) {
    g <- payload[[i]]
    l <- .sig_slot_de_graficador(g)
    if (is.null(l)) next
    sl <- tryCatch(contexto_de(slide, g), api_error = function(e) e)
    entrada <- if (inherits(sl, "api_error")) .sig_lamina_sin_base_json(slide, sl, l) else
      .sig_lamina_json(slide, sl$fuente, sl$ctx, l)
    nombre <- if (!is.na(nombres[i]) && nzchar(nombres[i])) nombres[i] else as.character(i)
    out[[length(out) + 1L]] <- c(list(ranura = nombre, indice = i, graficador = as.character(l$graficador)[1],
                                      base = if (inherits(sl, "api_error")) NA else as.character(sl$base %||% NA)[1]),
                                 entrada)
  }
  out
}
