# =============================================================================
# graficos_serie_plan.R — ¿el mazo ya trae la lámina que continúa la serie? (O4)
# =============================================================================
#
# Gonzalo, 2026-11-09 (resumen de Arte): la lámina con `hasta = 11` avisaba "Para las siguientes, agrega una lámina que
# continúe desde la 12" aunque el plan ya tenía esa lámina, con `continuar_desde = 12`. El aviso sólo tiene sentido si
# falta. La continuación es otro elemento del plan del mismo tipo, con las mismas bases declaradas, la misma regla, el
# mismo cruce y `continuar_desde = hasta + 1`.

#' Elementos (`ppt_element`) de un plan, a cualquier profundidad
#' @keywords internal
.serie_elementos_plan <- function(x) {
  if (inherits(x, "ppt_element")) return(list(x))
  if (!is.list(x)) return(list())
  unlist(lapply(x, .serie_elementos_plan), recursive = FALSE)
}

#' Bases declaradas de un elemento (`estudiantes$*`, `docentes$p5` -> estudiantes, docentes)
#' @keywords internal
.serie_bases <- function(el) {
  v <- as.character(unlist(el$.vars_declaradas %||% el$vars %||% el$var))
  sort(unique(sub("\\$.*$", "", v[!is.na(v) & nzchar(v)])))
}

#' ¿El plan del render trae la lámina que continúa a `el` (misma serie, `continuar_desde = hasta + 1`)?
#' @param el Elemento con `hasta`. @param diapos Plan (lista de `ppt_slide`); por defecto, el del render (`dynGet("plan")`:
#'   el argumento no se llama `plan` para que `dynGet` no se encuentre a sí mismo).
#' @keywords internal
.serie_continuacion_en_plan <- function(el, diapos = .dif_plan_render()) {
  hasta <- suppressWarnings(as.integer(el$hasta)[1])
  if (is.na(hasta) || !length(diapos)) return(FALSE)
  regla <- .regla_preguntas_normalizar(el$regla); bases <- .serie_bases(el); cruce <- as.character(el$cruce %||% "")[1]
  for (o in .serie_elementos_plan(diapos)) {
    if (!identical(o$.element_type, el$.element_type)) next
    if (.tope_espacio_desde(o$continuar_desde) != hasta + 1L) next
    if (!identical(.regla_preguntas_normalizar(o$regla), regla) || !identical(.serie_bases(o), bases)) next
    if (!identical(as.character(o$cruce %||% "")[1], cruce)) next
    return(TRUE)
  }
  FALSE
}
