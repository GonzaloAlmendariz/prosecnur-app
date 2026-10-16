# GET /api/analitica/codigos-especiales → { ok, codigos: [{codigo, etiqueta, etiquetas, n_listas,
#   por_base?: [{base, n_preguntas, n_con_casos}]}] }
# Sugerencias para el panel «Códigos especiales» del libro de códigos
# (analitica_codigos_especiales.R).
mount_analitica_codigos_especiales <- function(pr) {
  pr |>
    plumber::pr_get("/api/analitica/codigos-especiales", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      cods <- analitica_codigos_especiales(.analitica_insts_del_estudio(sid))
      # Uso por base (preguntas que lo ofrecen y en cuántas alguien lo eligió).
      # Sin data legible se informa sin conteo, nunca se cae.
      src <- tryCatch(.load_rp_sources(sid), error = function(e) NULL)
      if (!is.null(src) && length(cods)) {
        uso <- analitica_codigos_especiales_uso(src$inst_sources, src$data_sources,
                                                vapply(cods, `[[`, "", "codigo"))
        cods <- lapply(cods, function(c) {
          c$por_base <- lapply(names(uso[[c$codigo]]), function(b) c(list(base = b), uso[[c$codigo]][[b]]))
          c
        })
      }
      list(ok = TRUE, codigos = cods)
    }))
}
