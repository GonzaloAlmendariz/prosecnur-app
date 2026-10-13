# Router delgado de la base de partida declarada (ADR 0100, P2). La lógica vive
# en carga_origen_externo.R.
mount_origen_externo <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/origen-externo", wrap_endpoint(function(req, res, base_nombre = NULL) {
      c(list(ok = TRUE), origen_externo_consultar(session_header(req), base_nombre))
    })) |>
    plumber::pr_post("/api/carga/origen-externo", wrap_endpoint(function(req, res, ...) {
      body <- .analitica_json_body(req)
      file_id <- .origen_externo_chr(body$file_id)
      if (!nzchar(file_id)) {
        stop_api(400, "E_BAD_REQUEST", "Falta 'file_id' con la lista de exclusiones.")
      }
      c(list(ok = TRUE), origen_externo_declarar(
        session_header(req), body$base_nombre,
        file_id = file_id,
        n_recibidas = body$n_recibidas %||% NA_integer_,
        script = body$script %||% "", version = body$version %||% ""
      ))
    }))
}
