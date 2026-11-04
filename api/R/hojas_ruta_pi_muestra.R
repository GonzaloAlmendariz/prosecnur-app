# =============================================================================
# hojas_ruta_pi_muestra.R — π de titulares y reemplazos en la muestra (ADR 0131 §5, paso 3)
# =============================================================================
#
# Hasta aquí la π de la manzana sólo vivía en `resultado$marco_elegible` (estado
# de la sesión) y los reemplazos, sorteados con `sample(prob = M)` secuencial, no
# tenían π. La muestra publica ahora, por manzana:
#
#   - `estrato`: el estrato explícito del sorteo (el ubigeo con estrato distrito;
#     la provincia o el área de Lima en el modo estrato, ADR 0131 §1);
#   - `pi`: la probabilidad de inclusión de la manzana, con la misma fórmula y la
#     misma medida del sorteo (`.hojas_ruta_sorteo_medida`):
#       · estrato distrito: n_d · MOS_i / MOS_d con certezas por iteración;
#       · cuota por zona: lo mismo dentro de la zona, CONDICIONAL a las rutas que
#         recibió la zona (regla `..._zona_condicional`);
#       · estrato provincia: la mezcla exacta de π(⌊e_d⌋) y π(⌈e_d⌉)
#         (`hojas_ruta_estrato_pi`), que suma n_h en el estrato;
#   - `pi_regla`: cuál de las tres.
#
# El reemplazo pareado de la MISMA zona hereda la π y el estrato de su titular
# (`pi_fuente = "hereda_titular"`): sustituye a la titular en su segmento y el
# peso de diseño sigue siendo el de ella. El de otra zona cambia la π y no la
# tiene: queda en NA con `pi_fuente = "otra_zona_sin_pi"` y un aviso, nunca con
# la π de la titular en silencio.
# =============================================================================

.hojas_ruta_pim_regla <- function(cfg, ambito) {
  pre <- if (identical(cfg$sampling_method, "sistematico")) "igual_probabilidad_" else if (.hojas_ruta_sorteo_es_tope(cfg)) "pps_tope_" else "pps_sistematico_"
  paste0(pre, ambito)
}

#' Agrega `estrato`, `pi` y `pi_regla` a las titulares y `estrato`, `pi`,
#' `pi_fuente` a los reemplazos.
#'
#' @param blocks_df,replacement_blocks_df Titulares y reemplazos sorteados.
#' @param frame Marco sobre el que se sorteó (ya filtrado al marco elegible).
#' @return list(blocks, replacements, alerts).
hojas_ruta_pi_muestra <- function(blocks_df, replacement_blocks_df, frame, cfg) {
  alerts <- list()
  if (!is.data.frame(blocks_df) || !nrow(blocks_df)) {
    return(list(blocks = blocks_df, replacements = replacement_blocks_df, alerts = alerts))
  }
  params <- cfg$sample_size %||% list()
  modo_estrato <- hojas_ruta_estrato_activo(params)
  route_size <- .hojas_ruta_route_size(cfg)
  asignacion <- if (modo_estrato) {
    hojas_ruta_estrato_asignacion(unlist(cfg$territorios, use.names = FALSE), as.integer(cfg$n_objetivo) %/% route_size, cfg)$distritos
  } else NULL
  por_zona <- identical(cfg$row_var, "zona") && !modo_estrato

  ub <- as.character(blocks_df$ubigeo)
  ids <- as.character(blocks_df$id_manzana)
  blocks_df$estrato <- if (modo_estrato) asignacion$estrato[match(ub, asignacion$ubigeo)] else ub
  blocks_df$pi <- NA_real_
  blocks_df$pi_regla <- .hojas_ruta_pim_regla(cfg, if (modo_estrato) "estrato" else if (por_zona) "zona_condicional" else "distrito")

  for (u in unique(ub)) {
    district_frame <- frame[as.character(frame$ubigeo) == u, , drop = FALSE]
    if (!nrow(district_frame)) next
    cfg_d <- .hojas_ruta_sorteo_cfg_distrito(cfg, district_frame)
    ambitos <- if (por_zona) split(seq_len(nrow(district_frame)), as.character(district_frame$zona)) else list(seq_len(nrow(district_frame)))
    for (filas in ambitos) {
      df <- district_frame[filas, , drop = FALSE]
      en_muestra <- which(ub == u & ids %in% as.character(df$id_manzana))
      if (!length(en_muestra)) next
      m <- .hojas_ruta_sorteo_medida(df, cfg_d)
      pi <- if (modo_estrato) {
        hojas_ruta_estrato_pi(m, asignacion$esperado[match(u, asignacion$ubigeo)])
      } else {
        .hojas_ruta_sorteo_pi(m, length(en_muestra))
      }
      blocks_df$pi[en_muestra] <- pi[match(ids[en_muestra], as.character(df$id_manzana))]
    }
  }

  if (is.data.frame(replacement_blocks_df) && nrow(replacement_blocks_df)) {
    tit <- match(as.character(replacement_blocks_df$titular_id_manzana), ids)
    misma_zona <- !is.na(tit) & as.character(replacement_blocks_df$zona) == as.character(blocks_df$zona[tit]) &
      as.character(replacement_blocks_df$ubigeo) == ub[tit]
    misma_zona[is.na(misma_zona)] <- FALSE  # sin zona no se puede afirmar que es la misma: no hereda
    replacement_blocks_df$estrato <- blocks_df$estrato[tit]
    replacement_blocks_df$pi <- ifelse(misma_zona, blocks_df$pi[tit], NA_real_)
    replacement_blocks_df$pi_fuente <- ifelse(misma_zona, "hereda_titular", "otra_zona_sin_pi")
    fuera <- sum(!misma_zona)
    if (fuera > 0L) {
      alerts[[length(alerts) + 1L]] <- list(
        level = "warn", code = "W_REPLACEMENT_PI_OTRA_ZONA",
        message = sprintf("%d reemplazo(s) están en otra zona que su titular: no heredan su probabilidad de inclusión y quedan sin π publicada. Con reemplazos de la misma zona (política pareada) la heredan.", fuera),
        reemplazos = as.integer(fuera)
      )
    }
  }
  list(blocks = blocks_df, replacements = replacement_blocks_df, alerts = alerts)
}
