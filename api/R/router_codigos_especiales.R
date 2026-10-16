# GET /api/analitica/codigos-especiales → { ok, codigos: [{codigo, etiqueta, etiquetas, n_listas}] }
# Sugerencias para el panel «Códigos especiales» del libro de códigos
# (analitica_codigos_especiales.R).
mount_analitica_codigos_especiales <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/codigos-especiales", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      list(ok = TRUE, codigos = analitica_codigos_especiales(.analitica_insts_del_estudio(sid)))
    }))
}
