# =============================================================================
# graficos_escala_comodin.R — la escala del resumen con `base$*` y sin regla (P5)
# =============================================================================
#
# Prueba con Arte (2026-11-09): `p_barras_divergentes(vars = "docentes$*", estilo = "resumen")` sin regla no llegaba a
# dibujarse («`*` no se encuentra en `data`») y, si hubiera llegado, el recorte por espacio no lo veía: buscaba la
# referencia literal `base$*`. `base$*` dice lo mismo con o sin regla: las preguntas de escala de esa base, alineadas con
# la escala más frecuente (las mismas que la regla «todas» evalúa, graficos_regla_indicadores.R). Aquí se expanden antes
# del recorte, en el orden del instrumento, sin nota de regla: si no caben, el pie dice «Por espacio, se muestran las
# primeras 20 de 40; el resto en otra lámina.».

#' ¿Alguna referencia es `base$*`?
#' @keywords internal
.divergentes_hay_comodin <- function(vars) any(grepl("\\$\\*$", as.character(unlist(vars))))

#' Expande `base$*` de la escala del resumen sin regla a sus preguntas de escala
#'
#' @param el Elemento (sin regla). @param args Args efectivos (preset + overrides). @param preset Preset del tipo.
#' @return El elemento con `vars` expandidas, `.firma_leyenda` y `.comodin_expandido = TRUE`; intacto si no aplica.
#' @keywords internal
.divergentes_expandir_comodin <- function(el, args, preset = NULL) {
  if (!is.null(el$regla) || !identical(args$estilo, "resumen") || !.divergentes_hay_comodin(el$vars)) return(el)
  sources <- .regla_preguntas_fuentes_render("barras divergentes")
  r <- .regla_preguntas_de_elemento(utils::modifyList(el, list(.sin_recorte = TRUE)), sources, regla = list(tipo = "todas"), preset = preset)
  for (av in r$avisos[!grepl("^La regla elige", r$avisos)]) .pulso_aviso(av)
  if (!length(r$vars)) stop("La escala no deja ninguna pregunta que se pueda dibujar.", call. = FALSE)
  el$vars <- r$vars
  el$var <- if (length(r$vars) == 1L) r$vars else NULL
  el$.firma_leyenda <- r$firma_leyenda
  el$.comodin_expandido <- TRUE
  el
}
