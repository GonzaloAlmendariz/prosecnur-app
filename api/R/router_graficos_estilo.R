# router_graficos_estilo.R — Estilo del cliente: subir logos propios y el catálogo de opciones (A6 R3).
# Router delgado: lee el body, valida la sesión y delega en graficos_estilo_cliente.R. Contrato:
# docs/qa/contrato-word-estilo-f6-2026-10-11.md §2 R3.
#
#   POST /api/graficos/estilo/logos     → {nombre, data_base64, lugar?}; sólo PNG (firma de 8 bytes), hasta 5 MB.
#                                         Registra el archivo (`graficos_logo`) y devuelve su file_id; NO toca la config:
#                                         el editor lo pone en `estilo_cliente.logos.<lugar>` y lo guarda con el autosave.
#   GET  /api/graficos/estilo/opciones  → lugares de logo, pasos y roles de letra con su tamaño del recetario.
# Ninguno entra en la whitelist del modo público (forbid_mutations.R): allí responden 403.

mount_graficos_estilo <- function(pr) {
  pr |>
    plumber::pr_post("/api/graficos/estilo/logos", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                         error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
      .graficos_estilo_cliente_subir_logo(sid, parsed)
    })) |>
    plumber::pr_get("/api/graficos/estilo/opciones", wrap_endpoint(function(req, res) {
      session_get(session_header(req))
      c(list(ok = TRUE), .graficos_estilo_cliente_opciones())
    }))
}
