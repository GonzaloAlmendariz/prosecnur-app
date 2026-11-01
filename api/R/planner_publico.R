# =============================================================================
# Planner: qué ve el modo público (ADR 0122 §9)
# =============================================================================
#
# El modo público no expone el Planner: sus rutas no están en
# PUBLIC_MODE_WHITELIST y `mount_planner` sólo se monta fuera de él. Lo único
# del Planner que puede viajar en un artefacto publicado es la identidad del
# estudio (nombre, código, cliente). El equipo, los códigos, los insumos, la
# etapa y los perfiles nunca: el equipo trae nombres de personas y el resto es
# operación interna del estudio.

#' El estado de sesión tal como puede publicarse: la clave `planner` queda con
#' la identidad y nada más. Si el Planner no declaró la identidad, no queda
#' Planner (la del artefacto la pone quien publica).
#' @keywords internal
.planner_para_publicar <- function(s) {
  if (!is.list(s) || is.null(s[["planner"]])) return(s)
  p <- .planner_leer(s)
  estudio <- p$secciones$estudio
  if (is.null(estudio)) {
    s["planner"] <- list(NULL)
    return(s)
  }
  s["planner"] <- list(list(
    schema = PLANNER_SCHEMA,
    revision = p$revision,
    declarado_en = list(estudio = estudio$declarado_en),
    estudio = estudio$valor
  ))
  s
}
