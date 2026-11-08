# =============================================================================
# graficos_resumenes_motor.R — fuentes y presets del motor para los endpoints de resúmenes (ADR 0135)
# =============================================================================
#
# El conteo de la regla (`POST /api/graficos/resumenes/regla`) y las cifras del cierre (`POST .../cifras`) miden lo que
# dibuja la lámina, así que preparan las fuentes y los presets como la vista previa (`.graficos_preview_comun`): la
# regla inclusiva y los rótulos cortos de la base activa, y los presets del estudio. Antes el conteo leía las fuentes
# crudas y sin presets: con un preset `excluir_opciones = "9"` el Top Two Box daba 42 en el conteo y 51 en la lámina
# (revisión metodológica de la regla, H3).

#' Fuentes y presets del motor para un pedido de resúmenes
#'
#' @param sid Sesión. @param parsed Cuerpo del pedido (`scope`, `config`).
#' @return `list(fuentes = list(data_sources, inst_sources), presets)`; `presets` es `NULL` si el estudio no declara.
#' @keywords internal
.graficos_resumenes_motor <- function(sid, parsed) {
  fuentes <- .graficos_preview_fuentes(sid, parsed)
  comun <- .graficos_preview_comun(sid, parsed, fuentes)
  list(fuentes = list(data_sources = comun$data_sources, inst_sources = comun$inst_sources),
       presets = if (length(comun$presets_json)) .build_presets(comun$presets_json) else NULL)
}
