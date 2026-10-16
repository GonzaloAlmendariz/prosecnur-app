# GET /api/analitica/ponderacion/bases — ponderación declarada de TODAS las
# bases del estudio, sin cambiar la activa ni mutar la sesión. La lógica vive
# en ponderacion_bases.R; aquí solo sesión + llamada.
mount_ponderacion_bases <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/ponderacion/bases", wrap_endpoint(function(req, res, ...) {
      ponderacion_bases_estado(session_header(req))
    }))
}
