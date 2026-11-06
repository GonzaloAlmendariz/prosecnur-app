# Lotes de supervisión del telefónico: lo que Monitoreo le pasa a Material
# (ADR 0125, anexo A3: «Monitoreo → Material → Monitoreo»).
#
# Decisión de Gonzalo (2026-11-02): «monitoreo sabe el avance entonces al querer
# armar la base de supervisión calcula a quiénes se les supervisa y cuándo de su
# producción por lote de avance y eso lo manda a Material». Monitoreo decide a
# quién y cuándo; Material arma la base y no recalcula.
#
# Un lote es una ronda GUARDADA (`monitoreo_supervision_rondas.R`): sus casos ya
# están escritos y no cambian. La ronda virtual de un proyecto sin rondas no es
# un lote: nadie la decidió todavía.
#
# Forma congelada (A3):
#   list(list(lote_id, creado_en, campana_origen = "telefonica.principal",
#             criterio, casos = list(list(llave, responsable, fecha_llamada))))
# `llave` es la del barrido: el código Pulso del caso (`CodPulso`), que es la
# columna «Código» que Material pone como llave de la campaña telefónica.

.MONITOREO_SUPERVISION_CAMPANA_ORIGEN <- "telefonica.principal"

#' Cómo se eligió un lote, en una línea que Material muestra tal cual.
#' @keywords internal
.monitoreo_supervision_lote_criterio <- function(r) {
  casos <- r$casos
  manuales <- if (is.data.frame(casos) && "Origen" %in% names(casos)) sum(casos$Origen %in% "analista") else 0L
  sorteados <- (if (is.data.frame(casos)) nrow(casos) else 0L) - manuales
  base <- if (is.finite(r$porcentaje %||% NA_real_)) {
    sprintf("%s %% de %d efectivas nuevas, por enumerador con mínimo 1",
            format(r$porcentaje, trim = TRUE, decimal.mark = "."), as.integer(r$universo %||% 0L))
  } else {
    sprintf("%d casos sorteados sobre %d efectivas, por enumerador con mínimo 1",
            as.integer(sorteados), as.integer(r$universo %||% 0L))
  }
  if (manuales > 0L) base <- sprintf("%s, más %d %s por el analista", base, as.integer(manuales),
                                    if (manuales == 1L) "agregado" else "agregados")
  base
}

#' Los lotes de supervisión, uno por ronda guardada, en la forma del anexo A3.
#'
#' @param rondas rondas normalizadas (`.monitoreo_supervision_rondas_normalizar`).
#' @return lista de lotes; vacía sin rondas guardadas.
#' @keywords internal
monitoreo_supervision_lotes <- function(rondas = list()) {
  rondas <- Filter(function(r) isTRUE(r$guardada), rondas %||% list())
  lapply(rondas, function(r) {
    casos <- r$casos
    filas <- if (is.data.frame(casos) && nrow(casos)) {
      lapply(seq_len(nrow(casos)), function(i) list(
        llave = .monitoreo_scalar(casos$CodPulso[[i]], ""),
        responsable = .monitoreo_scalar(casos$Enumerador[[i]], ""),
        fecha_llamada = .monitoreo_scalar(casos$`Fecha Kobo`[[i]], "")
      ))
    } else list()
    list(
      lote_id = paste0("ronda-", r$numero),
      creado_en = .monitoreo_scalar(r$generada_el, ""),
      campana_origen = .MONITOREO_SUPERVISION_CAMPANA_ORIGEN,
      criterio = .monitoreo_supervision_lote_criterio(r),
      casos = Filter(function(f) nzchar(f$llave), filas)
    )
  })
}

mount_monitoreo_supervision_lotes <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/telefonico/supervision/lotes", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      rondas <- .monitoreo_supervision_rondas_normalizar(session_get(sid)[["monitoreo_supervision_rondas"]])
      list(ok = TRUE, lotes = monitoreo_supervision_lotes(rondas))
    }))
}
