# Router delgado de «Usar un formulario publicado» (ADR 0102). La lógica vive en
# carga_formulario_publicado.R y carga_formulario_publicado_fuentes.R.
mount_carga_formulario_publicado <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/formularios-publicados", wrap_endpoint(function(req, res) {
      carga_formularios_publicados(session_header(req))
    })) |>
    plumber::pr_post("/api/carga/formulario-publicado/vista-previa", wrap_endpoint(function(req, res, ...) {
      carga_formulario_publicado_vista_previa(session_header(req), .carga_parse_json_body(req))
    })) |>
    plumber::pr_post("/api/carga/formulario-publicado/importar", wrap_endpoint(function(req, res, ...) {
      carga_formulario_publicado_importar_endpoint(session_header(req), .carga_parse_json_body(req))
    }))
}
