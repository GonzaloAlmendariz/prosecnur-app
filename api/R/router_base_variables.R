# Router delgado de las variables propias de cada base (ADR 0106). La lógica
# vive en base_variables_servicio.R (sesión), base_variables_detector.R,
# base_variables_calculadas.R y base_variables_instrumento.R.
mount_base_variables <- function(pr) {
  pr |>
    plumber::pr_get("/api/carga/base-variables", wrap_endpoint(function(req, res, base = "") {
      c(list(ok = TRUE), base_variables_consultar(session_header(req), base))
    })) |>
    plumber::pr_post("/api/carga/base-variables/declarar", wrap_endpoint(function(req, res, ...) {
      body <- .analitica_json_body(req)
      declarar <- body$declarar %||% list()
      quitar <- body$quitar %||% list()
      if (!is.list(declarar) || (length(declarar) && !is.null(names(declarar)))) {
        stop_api(400, "E_BAD_REQUEST", "'declarar' debe ser una lista de { name, label, tipo, opciones? }.")
      }
      if (!length(declarar) && !length(quitar)) {
        stop_api(400, "E_BAD_REQUEST", "Nada que declarar: envía 'declarar' o 'quitar'.")
      }
      c(list(ok = TRUE), base_variables_declarar(session_header(req), body$base, declarar, quitar))
    })) |>
    plumber::pr_post("/api/carga/base-variables/calculada", wrap_endpoint(function(req, res, ...) {
      body <- .analitica_json_body(req)
      if (!is.null(body$mapa) && (!is.list(body$mapa) || is.null(names(body$mapa)))) {
        stop_api(400, "E_BAD_REQUEST", "'mapa' debe ser un objeto { código de origen: código de la escala }.")
      }
      c(list(ok = TRUE), base_variables_guardar_calculada(session_header(req), body$base, body))
    })) |>
    plumber::pr_delete("/api/carga/base-variables/calculada",
                       wrap_endpoint(function(req, res, base = "", nombre = "") {
      c(list(ok = TRUE), base_variables_quitar_calculada(session_header(req), base, nombre))
    })) |>
    plumber::pr_post("/api/carga/base-variables/codificada", wrap_endpoint(function(req, res, ...) {
      body <- .analitica_json_body(req)
      c(list(ok = TRUE), base_variables_marcar_codificada(session_header(req), body$base,
                                                         body$ya_codificada %||% NA))
    }))
}
