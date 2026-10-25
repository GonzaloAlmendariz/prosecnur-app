# Grillas de gráficos en nativo (frente C, CCSS Perfil 2026).
#
# Dos cosas que vivían en ramas congeladas de `reporte_plan_ppt.R` y aquí tienen su lugar:
#
# - La base de la lámina de cuatro y de dos gráficos. El pie reunía la nota de cada panel y salía «Base: 397 respuestas.
#   Base: 56 respuestas. Base: 396 respuestas…». Con la misma base en todos los paneles va una sola «Base:» (la regla G9
#   ya quita el «397 respuestas» de cada panel); si difieren, cada panel lleva la suya bajo su enunciado y el pie no las
#   junta. La base es la de respuestas válidas de cada pregunta, sin ponderar (`.espec_n_base`): no cambia ninguna cifra.
# - `p_slide_2_graficos` con gráficos que no son escalas (donas, columnas) iba entera a la plantilla anterior: título sin
#   barra ni antetítulo, donas y columnas como imagen ggplot. Ahora va por la disposición `graficos_2` de las mixtas, como
#   la de dos gráficos con narrativa; las escalas siguen por su lámina de paneles (`.lam_slide_paneles_nativa`).

#' ¿Los paneles de la lámina tienen bases distintas? (respuestas válidas de cada pregunta, sin contar cifras sueltas)
#' @keywords internal
.lam_grilla_bases_difieren <- function(especs) {
  ns <- vapply(especs, function(e) {
    if (is.null(e) || .lam_es_cifra(e)) return(NA_real_)
    suppressWarnings(as.numeric(.espec_n_base(e))[1])
  }, 0)
  ns <- ns[is.finite(ns) & ns > 0]
  length(unique(round(ns))) > 1L
}

#' Base de una grilla: la declarada manda; si no, una sola cuando los paneles comparten base, ninguna (cada panel la suya)
#' cuando difieren
#' @param base_auto Función de la lista de elementos que arma la base automática del motor.
#' @return `list(base, solo)`: `solo = TRUE` le dice a `.lam_composicion_mixta` que no junte las notas de los paneles.
#' @keywords internal
.lam_grilla_base <- function(declarada, els, rendered, migrada, base_auto) {
  if (!is.null(declarada)) return(list(base = declarada, solo = isTRUE(migrada)))
  especs <- lapply(rendered, .lam_espec_de)
  if (isTRUE(migrada) || .lam_grilla_bases_difieren(especs)) return(list(base = NULL, solo = TRUE))
  # L10-12 (lámina 48 de CCSS): cada cifra lleva su base debajo («10 de 20»); el pie dice sólo la base común de los
  # gráficos. Juntar las notas de todas las piezas daba «Base: 136. Base: 397 respuestas».
  cifras <- vapply(especs, function(e) !is.null(e) && .lam_es_cifra(e), TRUE)
  if (any(cifras)) return(list(base = .lam_grilla_base_graficos(els[!cifras], especs[!cifras]), solo = TRUE))
  list(base = base_auto(els), solo = FALSE)
}

#' Base común de los gráficos de una lámina con cifras: sus notas, sin repetir la misma (`.lam_bases_sin_repetir`)
#' @keywords internal
.lam_grilla_base_graficos <- function(els, especs) {
  texto <- function(x) if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  notas <- unique(unlist(c(lapply(els, function(el) texto((el$overrides %||% list())$nota_pie)), lapply(especs, function(e) texto(e$nota)))))
  notas <- .lam_bases_sin_repetir(notas)
  if (length(notas)) paste(notas, collapse = ". ") else NULL
}

#' La lámina mixta de una grilla con su base resuelta (enganche de la rama `paneles_4`)
#' @keywords internal
.lam_grilla_mixta <- function(doc, tipo, rendered, els, slide, titulo_de_var, declarada, migrada, base_auto) {
  b <- .lam_grilla_base(declarada, els, rendered, migrada, base_auto)
  .lam_composicion_mixta(doc, tipo, rendered, els, slide, titulo_de_var, base = b$base, solo_base_declarada = b$solo)
}

#' ¿`p_slide_2_graficos` va en nativo? Por la lámina de paneles si son escalas; si no, por la mixta de dos gráficos
#' @keywords internal
.lam_slide_2_aplica <- function(ps, els, slide, titulo_de_var = NULL) {
  isTRUE(.lam_compositor_aplica_paneles(ps, slide)) ||
    isTRUE(.lam_compositor_aplica_mixta(ps, slide, "graficos_2", els, titulo_de_var))
}

#' La rama `slide_2` del motor, en nativo (enganche de `reporte_ppt_plan`; mismos argumentos que
#' `.lam_slide_paneles_nativa`)
#' @keywords internal
.lam_slide_2_despacho <- function(doc, ps, els, slide, titulo, presets, layout, master, antetitulo, base_auto, nota_de,
                                  por_lamina = function(doc) doc, titulo_de_var = NULL) {
  if (isTRUE(.lam_compositor_aplica_paneles(ps, slide))) {
    return(.lam_slide_paneles_nativa(doc, ps, els, slide, titulo, presets, layout, master, antetitulo, base_auto, nota_de,
                                     por_lamina, titulo_de_var))
  }
  slots <- slide$slots %||% list()
  texto <- function(x) {
    x <- if (inherits(x, "ppt_element_text")) x$text else x
    if (is.null(x) || !length(x) || is.na(x[1]) || !nzchar(trimws(as.character(x)[1]))) NULL else trimws(as.character(x)[1])
  }
  s2 <- .lam_con_antetitulo(slide, antetitulo)
  s2$slots$title <- titulo %||% s2$slots$title
  auto <- function(e) base_auto(els = e, sufijo_auto = presets$base$args$sufijo_auto %||% NULL,
                                formato = presets$base$args$formato %||% "Base: %s")
  b <- .lam_grilla_base(texto(slots$base), els, ps, .base_por_grafico_migrada(slide), auto)
  # La nota que declaró el analista (`right_text` de la plantilla) va tras la base, como en la lámina de paneles.
  nota <- texto(slots$right_text)
  base <- if (is.null(nota)) b$base else paste(c(texto(b$base), nota), collapse = ". ")
  doc <- .lam_composicion_mixta(doc, "graficos_2", ps, els, s2, titulo_de_var, base = base, solo_base_declarada = b$solo || !is.null(nota))
  por_lamina(doc)
}
