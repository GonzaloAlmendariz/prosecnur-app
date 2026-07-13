# Router del override permanente de etiquetas por proyecto (label_overrides)
# ===========================================================================
# Delgado: valida input, delega en label_overrides.R (engine) y serializa.
# Gemelo del endpoint del override de orden ordinal (POST /api/analitica/config).

mount_label_overrides <- function(pr) {
  pr |>
    plumber::pr_get("/api/label-overrides", wrap_endpoint(function(req, res) {
      # Devuelve el override persistido del proyecto activo (forma de
      # almacenamiento jsonlite-friendly: {values, titles}).
      sid <- session_header(req)
      s <- session_get(sid)
      storage <- .label_overrides_to_storage(s$label_overrides)
      ov <- .label_overrides_normalize(storage)
      list(
        ok = TRUE,
        label_overrides = storage,
        n_values = sum(vapply(ov$values, length, integer(1))),
        n_titles = length(ov$titles)
      )
    })) |>
    plumber::pr_post("/api/label-overrides", wrap_endpoint(function(req, res, ...) {
      # Recibe {label_overrides: {values, titles}} y lo persiste. El backend es
      # un kv store para esta sub-clave del proyecto; el override se aplica en la
      # capa de instrumento en la próxima construcción de fuentes.
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      raw <- parsed$label_overrides
      if (is.null(raw)) {
        stop_api(400, "E_LABEL_OVERRIDES_FALTANTE",
                 "Body debe incluir 'label_overrides'.")
      }
      if (!is.list(raw)) {
        stop_api(400, "E_LABEL_OVERRIDES_INVALIDAS",
                 "label_overrides debe ser un objeto con 'values' y/o 'titles'.")
      }
      storage <- label_overrides_set(sid, raw)
      ov <- .label_overrides_normalize(storage)
      list(
        ok = TRUE,
        label_overrides = storage,
        n_values = sum(vapply(ov$values, length, integer(1))),
        n_titles = length(ov$titles)
      )
    }))
}
