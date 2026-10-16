# Router delgado de los segmentos de cruce del estudio (ADR 0107). La lógica
# vive en segmentos_cruce.R; las variables que materializa, en
# base_variables_servicio.R (ADR 0106), y su fila, en la matriz de equivalencias.
mount_segmentos <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/segmentos", wrap_endpoint(function(req, res) {
      c(list(ok = TRUE), segmentos_consultar(session_header(req)))
    })) |>
    plumber::pr_post("/api/carga/segmentos", wrap_endpoint(function(req, res, ...) {
      body <- .analitica_json_body(req)
      if (!is.list(body) || !length(body)) {
        stop_api(400, "E_BAD_REQUEST", "Body debe ser { clave, etiqueta, escala, por_base }.")
      }
      c(list(ok = TRUE), segmentos_guardar(session_header(req), body))
    })) |>
    plumber::pr_delete("/api/carga/segmentos", wrap_endpoint(function(req, res, clave = "") {
      c(list(ok = TRUE), segmentos_quitar(session_header(req), clave))
    }))
}
