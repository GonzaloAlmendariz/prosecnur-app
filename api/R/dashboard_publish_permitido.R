# =============================================================================
# Lo que viaja al publicar un dashboard: LISTA PERMITIDA (ADR 0122 §9)
# =============================================================================
#
# Publicar sube un .pulso al Space público. Antes subía el .pulso ENTERO: la
# lista de encuestadores con nombres y DNI, la disponibilidad de aplicadores,
# la asignación de UMP, el Planner con su equipo, los archivos de files/... Un
# dashboard no lee nada de eso. Aquí se arma el estado a publicar con lo que el
# artefacto público SÍ lee, y nada más: lo que no está en la lista no viaja,
# aunque mañana alguien agregue una clave nueva con datos personales.
#
# Qué lee el dashboard público (router_dashboard.R, dashboard_*.R, el
# descriptor /api/public/artifact y /api/session/state), verificado con la
# paridad de respuestas de test-dashboard-publish-permitido.R:
# - la fuente del dashboard (`dashboard_source`) y SUS DOS archivos en files/
#   (instrumento y base): los cachés `dashboard_rp_*` se reconstruyen de ahí;
# - su configuración y curación (`dashboard_config`, `dashboard_curacion`) y
#   las dimensiones si las hay (`dimensiones_config`, `analitica_dim_ok`);
# - las etiquetas del proyecto (`label_overrides`);
# - los grupos de recodificación de Codificación, y sólo eso de cada base
#   (`codif_por_base[[base]]$grupos_recod`);
# - el descriptor y el payload del artefacto (`public_artifact*`);
# - la identidad del estudio (`estudio$nombre` y la del Planner).

.PUBLICACION_CLAVES_DASHBOARD <- c(
  "dashboard_source", "dashboard_config", "dashboard_curacion",
  "dimensiones_config", "analitica_dim_ok", "label_overrides",
  "public_artifact", "public_artifact_payload"
)

# Lo que la propia sesión necesita para existir y guardarse (no es del estudio).
.PUBLICACION_CLAVES_SESION <- c("id", "created_at", "dir", "project_path", "project_dirty", "project_last_saved_at")

.publicacion_archivos_dashboard <- function(s) {
  fuente <- s[["dashboard_source"]] %||% list()
  ids <- unique(c(.planner_chr1(fuente$xlsform_file_id), .planner_chr1(fuente$data_file_id)))
  ids <- ids[nzchar(ids)]
  archivos <- s[["files"]] %||% list()
  archivos[intersect(names(archivos), ids)]
}

#' El estado de sesión que se publica con un dashboard: sólo lo que el
#' artefacto público lee (lista permitida). Lectura pura: devuelve una copia.
#' @keywords internal
.publicacion_estado_dashboard <- function(s) {
  claves <- intersect(c(.PUBLICACION_CLAVES_SESION, .PUBLICACION_CLAVES_DASHBOARD), names(s))
  out <- s[claves]
  out$files <- .publicacion_archivos_dashboard(s)
  estudio <- s[["estudio"]] %||% list()
  out$estudio <- list(
    nombre = estudio$nombre %||% NULL,
    processing_mode = estudio$processing_mode %||% "multibase",
    bases = list()
  )
  cpb <- s[["codif_por_base"]]
  if (is.list(cpb) && length(cpb)) {
    out$codif_por_base <- lapply(cpb, function(b) list(grupos_recod = if (is.list(b)) b$grupos_recod else NULL))
  }
  if (!is.null(s[["planner"]])) out$planner <- s[["planner"]]
  .planner_para_publicar(out)
}
