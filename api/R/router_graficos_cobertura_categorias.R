# =============================================================================
# router_graficos_cobertura_categorias.R — categorías de una variable por base, para el universo (ADR 0140)
# =============================================================================
#
# Sólo lectura. La tabla del universo de la cobertura por categorías se prellena con las categorías de la variable en
# cada base: código, etiqueta y n de la muestra (respuestas válidas, sin especiales, sin ponderar, tras los filtros de
# la lámina). El cálculo es el mismo que dibuja la lámina (graficos_cobertura_categorias.R).
#
#   POST /api/graficos/resumenes/cobertura-categorias   {variable, bases?: [base], filtros?: {var: [codigos]}, scope?}
#     -> {ok, variable, bases: [{base, variable_usada, recodificada, n_encuestados, n_validos,
#                                categorias: [{codigo, etiqueta, n}], especiales: [{codigo, etiqueta, n}]}]}
#   `bases` vacío toma todas las del estudio. `variable_usada` es la `_recod` si existe (la UI la guarda en el universo
#   como `variable`). Trae las categorías del instrumento aunque nadie las haya marcado (n = 0). Errores: 400
#   E_COBERTURA_CAT_VARIABLE (falta la variable o no está en una base) y 400 E_COBERTURA_CAT_BASE (base que no existe).

mount_graficos_cobertura_categorias <- function(pr) {
  pr |>
    plumber::pr_post("/api/graficos/resumenes/cobertura-categorias", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      parsed <- .graficos_preview_leer_body(req)
      fuentes <- .graficos_preview_fuentes(sid, parsed)
      filtros <- parsed[["filtros"]] %||% list()
      if (!is.list(filtros)) stop_api(400, "E_COBERTURA_CAT_FILTROS", "`filtros` debe ser un objeto {variable: [códigos]}.")
      bases <- .cobcat_categorias_por_base(fuentes$data_sources, fuentes$inst_sources, parsed[["variable"]],
                                           bases = parsed[["bases"]], filtros = filtros)
      list(ok = TRUE, variable = .cobcat_variable(parsed[["variable"]]), bases = bases)
    }))
}
