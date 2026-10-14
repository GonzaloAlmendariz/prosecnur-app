# Router delgado de la armonización de bases del formulario publicado
# (ADR 0102). La lógica vive en carga_armonizacion.R.
mount_carga_armonizacion <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/bases/<base>/armonizacion", wrap_endpoint(function(req, res, base = "", ...) {
      carga_armonizacion(session_header(req), utils::URLdecode(as.character(base)))
    })) |>
    plumber::pr_post("/api/carga/comparar-fuentes", wrap_endpoint(function(req, res, ...) {
      carga_comparar_fuentes(session_header(req), .carga_parse_json_body(req))
    }))
}
