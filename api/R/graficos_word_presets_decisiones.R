# =============================================================================
# graficos_word_presets_decisiones.R — los presets del Word guardan decisiones, no defaults (ADR 0094)
# =============================================================================
#
# Extiende el ADR 0074 a `config.w_presets`. «El recetario siempre manda; si algo va a cambiar en el recetario, cambia en
# los defaults por defecto de la app» (Gonzalo, 2026-10-11; decisión 1a): el `.pulso` guarda sólo lo que difiere de
# `.WORD_PRESETS_DEFAULT_PULSO` y lo no tocado hereda cuando el default cambia.
#
# Medido sobre COPIAS de los proyectos de referencia con estado (2026-10-11): los cuatro guardan
# `w_presets.chart_presets.barras_apiladas` entero, con la leyenda de 6 pt y sin el Top Two Box. No son decisiones: son
# fotos de dos defaults anteriores, y un diff ingenuo las guardaría como si lo fueran. De ahí la tabla de fósiles.
#
# - Al guardar: `.graficos_w_presets_solo_decisiones()` (migra fósiles y quita lo igual al default).
# - Al leer: `.graficos_w_presets_con_defaults()` (migra fósiles y repone el default debajo); es el embudo del
#   normalizador de la config y de `.build_w_presets()`, así que el job de Word también lo atraviesa.
# - `strip(merge(default, strip(x))) == strip(x)`: la migración exige el bloque COMPLETO de su generación, y un diff
#   nunca lo trae (ya quitó las claves iguales al default), así que limpiar dos veces no cambia nada.

#' Fósiles del default Word, por generación
#'
#' Cada generación es la foto completa de un default anterior tal como quedó guardada en proyectos reales. Un bloque se
#' migra sólo si trae TODAS las claves de una generación con esos valores: un valor aislado distinto del default (un
#' `mostrar_barra_extra = FALSE` suelto, una leyenda de 6 pt sola) es una decisión y se respeta.
#'
#' - **G1** (25 claves): el espejo del frontend previo a f1b7034, que el editor guardaba entero — sin
#'   `size_texto_barras_peq`, `size_barra_extra` ni `size_titulo_extra`; leyenda de 6 pt y clave de 0.15 cm; columna
#'   extra apagada. Medido en `acnur_acg`, `acnur_pdm` y `acrconta`.
#' - **G2** (28 claves): G1 mezclado sobre el default de R de entonces por el normalizador de la config, que le sumó las
#'   tres claves de tipografía que el front no tenía. Medido en `acrconta_mazo`.
#'
#' Se prueban en orden; la primera que coincide gana. Migrar = poner el default vigente en esas claves (y el diff las
#' quita al guardar).
#' @keywords internal
.WORD_MIGRACIONES_DEFAULTS <- local({
  g1 <- list(
    mostrar_barra_extra = FALSE, barra_extra_preset = "ninguno", prefijo_barra_extra = "", titulo_barra_extra = "",
    canvas_w_etiquetas = 0.18, canvas_w_buf_etq_bars = 0, canvas_w_bars = 0.82, canvas_w_buf_bars_extra = 0,
    canvas_w_extra = 0, canvas_h_toprow_in = 0, canvas_h_legend_in = 0.42, canvas_h_caption_in = 0.45,
    canvas_h_panel_in_min = 1.1, alto_por_categoria = 0.55, grosor_barras_mult = 1.5, ancho_max_eje_y = 36,
    size_ejes = 7, size_texto_barras = 2.8, leyenda_posicion = "abajo", mostrar_leyenda = TRUE,
    legend_key_cm = 0.15, legend_espaciado = 0, legend_n_por_fila = 10, size_leyenda = 6, centro_cowplot = 0.5
  )
  g2 <- c(g1, list(size_texto_barras_peq = 2.8, size_barra_extra = 9, size_titulo_extra = 9))
  list(
    list(id = "G2", familia = "barras_apiladas", claves = g2),
    list(id = "G1", familia = "barras_apiladas", claves = g1)
  )
})

#' Default Word vigente de la app (la autoridad contra la que se calcula el diff)
#'
#' Función y no la constante suelta para que los tests puedan simular «llega una versión con otro default».
#' @keywords internal
.graficos_w_presets_default <- function() .WORD_PRESETS_DEFAULT_PULSO

# Un valor guardado coincide con su default: tolerancia numérica, sin atributos, y sin confundir FALSE con 0.
.word_dec_igual <- function(valor, default) {
  if (is.null(default)) return(FALSE)
  if (is.logical(valor) != is.logical(default)) return(FALSE)
  isTRUE(all.equal(valor, default, check.attributes = FALSE))
}

# `chart_presets.<familia>` llega plano o como `list(args = ...)` (forma del PPT); el motor lo aplana igual
# (`.word_chart_presets_merge_defaults`), y aquí también, para poder compararlo clave por clave.
.word_dec_aplanar <- function(w) {
  cp <- w$chart_presets
  if (!is.list(cp) || !length(cp) || is.null(names(cp))) return(w)
  for (fam in names(cp)) {
    blk <- cp[[fam]]
    if (is.list(blk) && identical(names(blk), "args") && is.list(blk$args)) cp[[fam]] <- blk$args
  }
  w$chart_presets <- cp
  w
}

#' Migra los bloques que son la foto completa de un default anterior
#'
#' @param w `w_presets` tal como lo trae el proyecto (o el body).
#' @param defaults Default vigente.
#' @return `w` con las claves de cada bloque fósil puestas al default vigente; lo demás, intacto.
#' @keywords internal
.graficos_w_presets_migrar_fosiles <- function(w, defaults = NULL) {
  if (!is.list(w) || !is.list(w$chart_presets)) return(w)
  defaults <- defaults %||% .graficos_w_presets_default()
  w <- .word_dec_aplanar(w)
  for (gen in .WORD_MIGRACIONES_DEFAULTS) {
    blk <- w$chart_presets[[gen$familia]]
    if (!is.list(blk) || !length(blk)) next
    claves <- names(gen$claves)
    if (!all(claves %in% names(blk))) next
    if (!all(vapply(claves, function(k) .word_dec_igual(blk[[k]], gen$claves[[k]]), logical(1)))) next
    vigente <- (defaults$chart_presets %||% list())[[gen$familia]] %||% list()
    for (k in claves) blk[[k]] <- vigente[[k]]   # sin default vigente, la clave sale (NULL la quita)
    w$chart_presets[[gen$familia]] <- blk
  }
  w
}

# Diff recursivo: fuera las hojas iguales a su default y los contenedores vacíos; lo que no tiene default se conserva.
.word_dec_diff <- function(x, d) {
  out <- list()
  for (k in names(x)) {
    v <- x[[k]]
    if (is.null(v) || (is.list(v) && !length(v))) next
    dk <- if (is.list(d)) d[[k]] else NULL
    if (.graficos_is_obj(v) && .graficos_is_obj(dk) && length(dk)) {
      sub <- .word_dec_diff(v, dk)
      if (length(sub)) out[[k]] <- sub
      next
    }
    if (.word_dec_igual(v, dk)) next
    out[[k]] <- v
  }
  out
}

#' Quita de `w_presets` todo lo que coincide con el default vigente (ADR 0094)
#'
#' Se aplica al guardar (`.graficos_config_set`, `graficos_consolidado_draft_set`) y al leer (`limpio()` de
#' `.graficos_config_get`). Antes de comparar migra los fósiles G1/G2.
#'
#' @param w `w_presets` del proyecto o del editor.
#' @param defaults Default vigente; por defecto el de la app.
#' @return Lista con sólo las decisiones (`list()` si no queda ninguna). Lo que no es lista se devuelve tal cual.
#' @keywords internal
.graficos_w_presets_solo_decisiones <- function(w, defaults = NULL) {
  if (!is.list(w)) return(w)
  defaults <- defaults %||% .graficos_w_presets_default()
  .word_dec_diff(.graficos_w_presets_migrar_fosiles(w, defaults), defaults)
}

#' Repone el default vigente debajo de las decisiones de `w_presets`
#'
#' El reverso de `.graficos_w_presets_solo_decisiones()`, con la misma migración de fósiles: lo usan el normalizador de
#' la config (GET y export) y `.build_w_presets()` (el job de Word).
#' @keywords internal
.graficos_w_presets_con_defaults <- function(w, defaults = NULL) {
  defaults <- defaults %||% .graficos_w_presets_default()
  if (!is.list(w) || !length(w)) return(defaults)
  .graficos_deep_merge(defaults, .graficos_w_presets_migrar_fosiles(w, defaults))
}

# Sublistas de `w_presets()` que se mezclan sobre su formal en vez de reemplazarlo: `title_style = list(size = 14)` no
# pierde la fuente ni el color. `image` queda fuera a propósito: `w_presets()` ya le repone campo por campo sus propios
# valores (6.6 x 3.9 in), y cambiarlos aquí movería el lienzo de proyectos que sólo guardaron el ancho.
.WORD_PRESETS_SUBLISTAS_MEZCLADAS <- c("title_style", "base_style", "intro_style", "subsection_style", "section_style",
                                       "figure_numbering", "toc", "chart_options")

#' Argumentos para `w_presets()` a partir de una config: default repuesto, sublistas mezcladas, desconocidas filtradas
#'
#' Una clave que `w_presets()` no acepta ya no aborta el export: se ignora con aviso (y sigue en disco, por si una
#' versión posterior la entiende).
#' @param w_json `w_presets` de la config o del body.
#' @return Lista nombrada lista para `do.call(w_presets, .)`.
#' @keywords internal
.graficos_w_presets_args <- function(w_json) {
  w <- .graficos_w_presets_con_defaults(if (is.list(w_json)) w_json else NULL)
  fmls <- formals(get("w_presets", mode = "function", inherits = TRUE))
  desconocidas <- setdiff(names(w), names(fmls))
  if (length(desconocidas)) {
    warning("Se ignoraron presets Word no soportados: ", paste(desconocidas, collapse = ", "), call. = FALSE)
  }
  w <- w[intersect(names(w), names(fmls))]
  for (k in intersect(names(w), .WORD_PRESETS_SUBLISTAS_MEZCLADAS)) {
    base <- eval(fmls[[k]], envir = baseenv())
    if (.graficos_is_obj(base) && .graficos_is_obj(w[[k]])) w[[k]] <- .graficos_deep_merge(base, w[[k]])
  }
  w
}

#' Aplica el diff de ADR 0094 a los campos Word de una config
#'
#' `w_presets` y `documento_word` quedan sólo con decisiones; si no queda ninguna, la clave desaparece (nunca `list()`).
#' Lo comparten los cuatro portadores de config: `graficos_config`, `graficos_config_por_base[[base]]` y el borrador del
#' consolidado (al guardar), y `limpio()` al leer.
#' @param cfg Config de Gráficos.
#' @return La config con los dos campos limpios.
#' @keywords internal
.graficos_config_word_solo_decisiones <- function(cfg) {
  if (!is.list(cfg)) return(cfg)
  if (!is.null(cfg[["w_presets"]])) {
    w <- .graficos_w_presets_solo_decisiones(cfg[["w_presets"]])
    cfg[["w_presets"]] <- if (is.list(w) && !length(w)) NULL else w
  }
  if (!is.null(cfg[["documento_word"]])) {
    d <- .graficos_documento_word_solo_decisiones(cfg[["documento_word"]])
    cfg[["documento_word"]] <- if (length(d)) d else NULL
  }
  cfg
}

#' Defaults que el GET de la config entrega junto a ella (aditivo, no persistido)
#'
#' Para que «Modificado» (decisión 5a) compare contra la autoridad del backend y no contra un espejo del frontend.
#' @keywords internal
.graficos_config_defaults_publicos <- function() {
  list(w_presets = .graficos_w_presets_default(), documento_word = .graficos_documento_word_defaults_publicos())
}
