# =============================================================================
# graficos_tarjetas_publicos_radar_panorama.R — tarjetas entre públicos del radar y del panorama (ADR 0138 §7)
# =============================================================================
#
# El motor de las tarjetas entre públicos (graficos_tarjetas_publicos.R) no cambia: estos ganchos sólo dicen, para el
# radar por públicos (`p_radar(modo = "publicos")`) y el panorama (`p_panorama`), qué temas dibuja la lámina, cuál es su
# equivalencia declarada y qué cifras dibuja el gráfico para conciliarlas con la prueba.
#
#   - radar: cada eje es un tema con una pregunta por público, declarada por el analista en `vars` (el par explícito, lo
#     mismo que el contraste con refs explícitas). Con tres o más públicos la tarjeta es la de líneas por par.
#     Concilia con la espec del radar (`valores`, eje × público), con la de líneas y puntos (`pesas`, menos de cinco
#     criterios con dos públicos) o con los datos de las barras comparativas (menos de cinco criterios con otro número de
#     públicos);
#   - panorama: cada fila de la lámina es un público y cada punto una pregunta. Sólo los temas emparejados llevan
#     tarjeta: una fila confirmada de la matriz (`s$equivalencias_publicos`) con su pregunta en dos o más de los públicos
#     del panorama. El panorama no declara pares explícitos y `base$*` empareja por nombre, que no cuenta: sin matriz, el
#     panorama va sin tarjetas. Concilia con la espec del panorama (`valores` e `items` por público).
#
# Una referencia que no se puede leer de la espec no apaga la conciliación: deja la lista sin ese tema y el tema se
# abstiene («las cifras de la prueba no cuadran con el gráfico»).

#' Tipos de elemento con tarjetas entre públicos
#' @keywords internal
.TPUB_ELEMENTOS <- c("dumbbell", "radar_publicos", "panorama")

#' Forma común del elemento del radar o del panorama
#' @keywords internal
.tpub_el_comun <- function(el) {
  list(vars = el$vars, corte = el$corte, filtros = el$filtros %||% list(), regla = el$regla, bases = NULL,
       .element_type = el$.element_type)
}

#' Elemento del radar por públicos o del panorama de una lámina (slots ya construidos o payload del plan guardado)
#'
#' El payload se pasa por el constructor (`p_radar_publicos`, `p_panorama`) para que los temas salgan como en el render
#' (títulos de grupo aplicados, regla normalizada). NULL si la lámina no tiene ninguno de los dos.
#' @keywords internal
.tpub_elemento_radar_panorama <- function(slide) {
  el <- (slide$slots %||% list())$plot
  if (is.list(el) && isTRUE(as.character(el$.element_type %||% "")[1] %in% c("radar_publicos", "panorama"))) return(.tpub_el_comun(el))
  grafs <- Filter(function(z) is.list(z) && isTRUE(as.character(z$graficador %||% "")[1] %in% c("p_radar", "p_panorama")),
                  slide$payload %||% list())
  if (!length(grafs)) return(NULL)
  g <- grafs[[1]]; a <- g$args %||% list()
  el <- tryCatch({
    if (identical(as.character(g$graficador)[1], "p_radar")) {
      if (!identical(as.character(unlist(a$modo %||% ""))[1], "publicos")) NULL else
        p_radar_publicos(vars = a$vars, corte = a$corte %||% "", titulos_grupo = a$titulos_grupo, filtros = a$filtros %||% list())
    } else {
      p_panorama(vars = a$vars, corte = a$corte, filtros = a$filtros %||% list(), regla = a$regla)
    }
  }, error = function(e) NULL)
  if (is.null(el)) NULL else .tpub_el_comun(el)
}

# --- Temas -------------------------------------------------------------------------------------------------------

#' Temas del radar: cada eje con sus refs, declaradas en `vars` (par explícito)
#' @return `list(vars_render, temas)`.
#' @keywords internal
.tpub_temas_radar <- function(el, equiv) {
  vars <- lapply(el$vars %||% list(), function(x) as.character(unlist(x)))
  list(vars_render = vars, temas = .tpub_temas_declarados(vars, vars, equiv))
}

#' Temas emparejados del panorama: las filas confirmadas de la matriz con su pregunta en dos o más públicos
#'
#' @param refs Preguntas que dibuja el panorama (`base$var`, ya expandidas y con la regla aplicada).
#' @return Lista nombrada `tema -> refs` (el tema es la etiqueta estándar de la fila), en el orden de la matriz y con los
#'   públicos en el orden del panorama.
#' @keywords internal
.tpub_panorama_temas_matriz <- function(refs, equiv) {
  partes <- lapply(refs, .graficos_ref_parts)
  base <- vapply(partes, `[[`, "", "source"); var <- vapply(partes, `[[`, "", "name")
  bases <- unique(base)
  out <- list()
  for (f in (equiv %||% list())$filas %||% list()) {
    if (isTRUE(f$sugerida)) next
    v <- f$variables %||% list()
    r <- character(0)
    for (b in bases) {
      x <- as.character(unlist(v[[b]] %||% ""))[1]
      if (!is.na(x) && nzchar(x) && any(base == b & var == x)) r <- c(r, paste0(b, "$", x))
    }
    if (length(r) < 2L) next
    tema <- trimws(as.character(f$etiqueta_estandar %||% "")[1])
    if (is.na(tema) || !nzchar(tema)) tema <- r[1]
    if (tema %in% names(out)) tema <- paste0(tema, " (", sum(startsWith(names(out), tema)) + 1L, ")")
    out[[tema]] <- r
  }
  out
}

#' Temas del panorama: regla de preguntas, `base$*` expandido y los temas que la matriz empareja
#'
#' Ningún tema del panorama es un par explícito (`vars_lamina` vacío): la equivalencia la confirma la matriz con
#' `.tpub_en_matriz`, que es la misma regla del contraste.
#' @return `list(vars_render, temas)`.
#' @keywords internal
.tpub_temas_panorama <- function(el, sources, equiv) {
  el_r <- list(.element_type = "panorama", vars = el$vars, corte = el$corte, filtros = el$filtros, regla = el$regla)
  if (!is.null(el$regla)) el_r <- .regla_preguntas_aplicar_render(el_r, "panorama", sources)$el
  refs <- .panorama_expandir(as.character(unlist(el_r$vars)), .radar_mb_codigos(el$corte), sources)
  vars_render <- .tpub_panorama_temas_matriz(refs, equiv)
  list(vars_render = vars_render, temas = .tpub_temas_declarados(vars_render, list(), equiv))
}

# --- Cifras del gráfico ------------------------------------------------------------------------------------------

#' Cifras que dibuja el radar por públicos, por tema: lista `tema -> c(base = valor)` (0-100)
#'
#' Radar (`radar`): `valores` es eje × público en 0-1, con los ejes en el orden de `vars` (recortados para dibujar, por
#' eso se casan por posición) y los públicos capitalizados. Líneas y puntos (`pesas`): `rotulos` con el criterio
#' completo, `a` y `b` para el primer y segundo público. Barras comparativas (sin espec): los datos del ggplot.
#' @keywords internal
.tpub_referencia_radar <- function(p, espec, vars_render) {
  temas <- names(vars_render)
  out <- list()
  leer <- function(i, bases) {
    if (is.list(espec) && identical(espec$tipo, "radar")) {
      V <- espec$valores
      if (!is.matrix(V) || nrow(V) != length(temas)) return(NULL)
      j <- match(.radar_mb_capitalizar(bases), colnames(V))
      return(ifelse(is.na(j), NA_real_, 100 * V[i, pmax(j, 1L)]))
    }
    if (is.list(espec) && identical(espec$tipo, "pesas")) {
      k <- match(.radar_mb_eje_completo(temas)[i], as.character(espec$rotulos))
      g <- match(.radar_mb_capitalizar(bases), as.character(espec$grupos))
      if (is.na(k)) return(NULL)
      return(vapply(g, function(x) if (is.na(x) || x > 2L) NA_real_ else as.numeric(if (x == 1L) espec$a[k] else espec$b[k]), 0))
    }
    d <- if (inherits(p, "ggplot")) p$data else NULL
    if (!is.data.frame(d) || !all(c("eje", "grupo", "valor") %in% names(d))) return(NULL)
    eje <- .radar_mb_recortar_eje(temas)[i]
    vapply(.radar_mb_capitalizar(bases), function(b) {
      k <- which(as.character(d$eje) == eje & as.character(d$grupo) == b)
      if (length(k) == 1L) as.numeric(d$valor[k]) else NA_real_
    }, 0)
  }
  for (i in seq_along(temas)) {
    bases <- names(.tpub_refs(vars_render[[i]]) %||% character(0))
    if (!length(bases)) next
    v <- leer(i, bases)
    if (!is.null(v)) out[[temas[i]]] <- stats::setNames(as.numeric(v), bases)
  }
  out
}

#' Cifras que dibuja el panorama, por tema: el valor de cada pregunta del tema en la fila de su público (0-100)
#' @keywords internal
.tpub_referencia_panorama <- function(espec, vars_render) {
  out <- list()
  if (!is.list(espec) || !identical(espec$tipo, "panorama") || is.null(espec$items)) return(out)
  for (tema in names(vars_render)) {
    refs <- .tpub_refs(vars_render[[tema]])
    if (is.null(refs)) next
    out[[tema]] <- vapply(names(refs), function(b) {
      i <- match(.radar_mb_capitalizar(b), espec$publicos)
      if (is.na(i)) return(NA_real_)
      k <- match(refs[[b]], as.character(espec$items[[i]]))
      if (is.na(k)) NA_real_ else as.numeric(espec$valores[[i]][k])
    }, 0)
  }
  out
}

#' Cifras del panorama por el camino del gráfico (`.panorama_datos`), para el inspector
#' @keywords internal
.tpub_referencia_panorama_datos <- function(vars_render, corte, sources, filtros = list()) {
  refs <- unique(unlist(vars_render, use.names = FALSE))
  d <- if (length(refs)) tryCatch(suppressWarnings(.panorama_datos(refs, corte, sources, filtros = filtros)), error = function(e) NULL)
  out <- list()
  if (is.null(d)) return(out)
  for (tema in names(vars_render)) {
    r <- .tpub_refs(vars_render[[tema]])
    if (is.null(r)) next
    out[[tema]] <- vapply(names(r), function(b) {
      k <- which(as.character(d$publico) == .radar_mb_capitalizar(b) & as.character(d$item) == r[[b]])
      if (length(k) == 1L) as.numeric(d$valor[k]) else NA_real_
    }, 0)
  }
  out
}

#' ¿La figura que salió es una de las que llevan tarjetas entre públicos para ese elemento?
#' @keywords internal
.tpub_figura_admite <- function(el, espec, p = NULL) {
  tipo <- as.character(el$.element_type %||% "")[1]
  e <- if (is.list(espec)) as.character(espec$tipo %||% "")[1] else ""
  switch(tipo,
         dumbbell = e %in% .TPUB_ESPECS,
         radar_publicos = e %in% c("radar", "pesas") || (!nzchar(e) && inherits(p, "ggplot")),
         panorama = identical(e, "panorama"),
         FALSE)
}

#' Cifras del gráfico ya dibujado, según el elemento
#' @keywords internal
.tpub_referencia_render <- function(el, p, espec, vars_render) {
  switch(as.character(el$.element_type %||% "")[1],
         radar_publicos = .tpub_referencia_radar(p, espec, vars_render),
         panorama = .tpub_referencia_panorama(espec, vars_render),
         .tpub_referencia_pesas(espec, vars_render))
}

#' Cifras del gráfico calculadas por su camino, para el inspector
#' @keywords internal
.tpub_referencia_inspector <- function(el, vars_render, sources) {
  if (identical(el$.element_type, "panorama")) {
    return(.tpub_referencia_panorama_datos(vars_render, el$corte, sources, el$filtros %||% list()))
  }
  .tpub_referencia_datos(vars_render, el$corte, sources, el$filtros %||% list())
}

#' El radar con tarjetas cede la tabla de su costado al panel: no caben las dos
#'
#' La lámina 90 pone la tabla a la derecha del radar; con el panel de tarjetas no queda ancho para ella. Las tarjetas
#' llevan las cifras de los pares marcados. Se avisa, nunca en silencio.
#' @keywords internal
.tpub_radar_sin_tabla <- function(p, t, titulo) {
  espec <- attr(p, "pulso_espec")
  if (!length(t$tarjetas) || !is.list(espec) || !identical(espec$tipo, "radar") || !isTRUE(espec$con_tabla)) return(p)
  espec$con_tabla <- FALSE
  attr(p, "pulso_espec") <- espec
  .tpub_aviso("en \"", titulo, "\", la tabla del radar deja su lugar al panel de tarjetas (no caben las dos).")
  p
}
