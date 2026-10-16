# Router delgado de los códigos observados de una variable de una base. La
# lógica vive en codigos_observados.R; sólo lee (no cambia la base activa).
mount_codigos_observados <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/codigos-observados",
                    wrap_endpoint(function(req, res, base = "", variable = "") {
      c(list(ok = TRUE), codigos_observados_consultar(session_header(req), base, variable))
    }))
}
