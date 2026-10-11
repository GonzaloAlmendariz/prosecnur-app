# Router de las fuentes de una base que junta encuestas (ítem 15, ADR 0094)
# =========================================================================
#
# Delgado: lee el input, delega en `carga_fuentes_emparejamiento.R` (motor
# puro) y serializa. Archivo propio porque `router_carga.R` ya pasa de 2.000
# líneas.

mount_carga_fuentes <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/fuentes/emparejamiento", wrap_endpoint(function(req, res, base_nombre = NULL) {
      c(list(ok = TRUE), .carga_fuentes_emparejamiento(session_header(req), base_nombre = base_nombre))
    }))
}
