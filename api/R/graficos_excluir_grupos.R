# =============================================================================
# graficos_excluir_grupos.R — «Excluir grupos» en los gráficos con «Dividir por»
# =============================================================================
#
# El inspector de la tarjeta muestra cada grupo del cruce con su n y marca «pocos casos» bajo 30 (I2, ítem 7). El
# analista decide qué grupos entran: `excluir_grupos` (rótulos o códigos del cruce) en p_barras_apiladas,
# p_barras_agrupadas y p_barras_multiapiladas (modos `cruce` y `var_cruce`). p_histograma tiene su propio
# `excluir_grupos`, que filtra dentro del graficador (graficador_barras_numericas.R).
#
# Se aplica UNA vez, antes de renderizar (`.plan_excluir_grupos`, enganchado en `reporte_ppt_plan` junto al orden de
# categorías): los grupos pedidos se traducen a los códigos de la columna del cruce y se agregan a los filtros del
# elemento como una regla `notin`. Así lo respetan, sin tocar cada camino, el render (ggplot y lámina nativa), la
# significancia, el pie «Base:» (reporte_plan_base_cruce.R), el Word y la ruta de cifras con `detalle`
# (graficos_cifras_clave.R), que renderiza con el mismo motor.
#
# Grano y denominador: la unidad es la fila de la base de la variable; un grupo excluido sale de las barras y de la
# base. Un `notin` también deja fuera las filas sin valor en el cruce, que ya no entraban en ninguna barra ni en la base
# de un cruce (CCSS-16, reporte_plan_base_cruce.R), así que el denominador de los grupos que quedan no cambia.
#
# Base de lectura: la del gráfico. El cruce sin calificar se resuelve en la base de su variable, como en el render
# (`.resolve_ref(cruce, source = ctx_var$source)`); un cruce calificado con otra base, o preguntas de varias bases, no se
# filtran (la regla caería sobre una columna ajena) y se avisa.
#
# La lámina lo dice: «Excluye el grupo Otro» se anexa al pie del gráfico renderizado (`note_outside`, que leen la lámina
# nativa, el respaldo y el Word; `.excluir_grupos_nota_al_grafico`, enganchado en `.plan_render_element_degradable`).
# Sólo se nombran los grupos que tienen casos en la base; un grupo pedido que no existe se avisa y no se nombra.

.EXCLUIR_GRUPOS_TIPOS <- c("barras_apiladas", "barras_agrupadas", "barras_multiapiladas")

#' La referencia del cruce de un elemento que admite `excluir_grupos`, o `NULL`
#' @keywords internal
.excluir_grupos_cruce_ref <- function(el) {
  tipo <- el$.element_type %||% ""
  ov <- el$overrides %||% list()
  ref <- switch(tipo,
                barras_multiapiladas = if ((el$modo %||% "") %in% c("cruce", "var_cruce")) el$cruce else NULL,
                barras_agrupadas = ov$cruces %||% el$cruces,   # el orden de `.render_barras_agrupadas`
                barras_apiladas = el$cruces %||% ov$cruces,    # el de `.render_barras_apiladas`
                NULL)
  ref <- trimws(as.character(unlist(ref, use.names = FALSE)))
  ref <- ref[!is.na(ref) & nzchar(ref)]
  if (length(ref)) ref[[1]] else NULL
}

#' Separa `base$var` en base y variable; sin calificar, la base es `base_defecto`
#' @keywords internal
.excluir_grupos_partir_ref <- function(ref, base_defecto) {
  m <- regmatches(ref, regexec("^([^$]+)\\$(.+)$", ref))[[1]]
  if (length(m) == 3L) list(base = trimws(m[2]), var = trimws(m[3])) else list(base = base_defecto, var = trimws(ref))
}

#' Lista «A», «A y B», «A, B y C» (sin comillas: son los rótulos de la lámina)
#' @keywords internal
.excluir_grupos_enumerar <- function(x) {
  x <- as.character(x)
  if (length(x) <= 1L) return(paste(x, collapse = ""))
  paste(paste(utils::head(x, -1L), collapse = ", "), "y", utils::tail(x, 1L))
}

#' Los pedidos entre comillas rectas, para un aviso: "A", "B" y "C"
#' @keywords internal
.excluir_grupos_citar <- function(x) .excluir_grupos_enumerar(sprintf('"%s"', as.character(x)))

#' La nota de la lámina: «Excluye el grupo Otro.» / «Excluye los grupos Otro y No sabe.»
#' @keywords internal
.excluir_grupos_nota <- function(rotulos) {
  rotulos <- unique(as.character(rotulos))
  if (!length(rotulos)) return("")
  sprintf("Excluye %s %s.", if (length(rotulos) == 1L) "el grupo" else "los grupos", .excluir_grupos_enumerar(rotulos))
}

#' Traduce los grupos pedidos a códigos de la columna del cruce
#'
#' Un pedido casa por código, luego por rótulo (sin tildes, mayúsculas ni signos) y, si la base guarda rótulos, por el
#' valor tal cual en la columna.
#' @param pedidos Rótulos o códigos pedidos.
#' @param cats `data.frame(codigo, etiqueta)` de la lista del cruce (`.goc_categorias`).
#' @param presentes Valores (recortados) presentes en la columna del cruce.
#' @return `list(codigos, rotulos, ausentes)`: los códigos con casos y su rótulo, y los pedidos sin casos.
#' @keywords internal
.excluir_grupos_resolver <- function(pedidos, cats, presentes) {
  codigos <- character(0); rotulos <- character(0); ausentes <- character(0)
  cod_cat <- as.character(cats$codigo); eti_cat <- as.character(cats$etiqueta)
  clave_eti <- .graficos_norm_text_key(eti_cat)
  for (p in pedidos) {
    cand <- if (p %in% cod_cat) p else cod_cat[clave_eti == .graficos_norm_text_key(p) & nzchar(clave_eti)]
    if (!length(cand) && p %in% presentes) cand <- p
    cand <- cand[cand %in% presentes]
    if (!length(cand)) { ausentes <- c(ausentes, p); next }
    codigos <- c(codigos, cand)
    rot <- eti_cat[match(cand, cod_cat)]
    rotulos <- c(rotulos, ifelse(is.na(rot) | !nzchar(rot), cand, rot))
  }
  keep <- !duplicated(codigos)
  list(codigos = codigos[keep], rotulos = rotulos[keep], ausentes = unique(ausentes))
}

#' Filtros de un elemento como lista de reglas, o `NULL` si no se pueden convertir sin cambiar su sentido
#'
#' La lista nombrada (`list(sexo = "2")`) se convierte a reglas `in`; sus valores vacíos o `NA` no restringen nada y se
#' quitan (en la lista nombrada ya eran un no-op). Un valor con coma no se convierte: la regla separa por comas.
#' @keywords internal
.excluir_grupos_filtros_reglas <- function(filtros) {
  if (is.null(filtros) || !length(filtros)) return(list())
  nm <- names(filtros)
  if (is.list(filtros) && !is.data.frame(filtros) && !is.null(nm) && all(nzchar(trimws(nm))) &&
      all(vapply(filtros, is.atomic, logical(1)))) {
    out <- list()
    for (k in nm) {
      v <- trimws(as.character(filtros[[k]])); v <- v[!is.na(v) & nzchar(v)]
      if (!length(v)) next
      if (any(grepl(",", v, fixed = TRUE))) return(NULL)
      out[[length(out) + 1L]] <- list(variable = trimws(k), op = "in", value = paste(v, collapse = ","))
    }
    return(out)
  }
  .base_filtros_como_reglas(filtros)
}

#' Aplica `excluir_grupos` a un elemento: la regla `notin` en sus filtros y la nota de la lámina
#'
#' @param el Elemento del plan.
#' @param data_sources,inst_sources Bases y sus instrumentos.
#' @param default_source Base de las referencias sin calificar.
#' @return El elemento, con `filtros` y `overrides$nota_pie` ajustados, o intacto si no hay nada que excluir.
#' @keywords internal
.excluir_grupos_elemento <- function(el, data_sources, inst_sources, default_source = NULL) {
  pedidos <- trimws(as.character(unlist(el$excluir_grupos, use.names = FALSE)))
  pedidos <- unique(pedidos[!is.na(pedidos) & nzchar(pedidos)])
  el$excluir_grupos <- NULL   # se consume aquí: un segundo paso no la aplica dos veces
  cruce_ref <- .excluir_grupos_cruce_ref(el)
  if (!length(pedidos) || is.null(cruce_ref)) return(el)

  base_def <- el$source %||% default_source
  if (length(base_def) != 1L || is.na(base_def) || !nzchar(base_def)) base_def <- NA_character_
  refs <- trimws(as.character(unlist(c(el$var, el$vars), use.names = FALSE)))
  refs <- refs[!is.na(refs) & nzchar(refs)]
  bases <- unique(vapply(refs, function(r) .excluir_grupos_partir_ref(r, base_def)$base, character(1)))
  cr <- .excluir_grupos_partir_ref(cruce_ref, if (length(bases) == 1L) bases[[1]] else base_def)
  if (length(bases) != 1L || is.na(bases[[1]]) || !identical(cr$base, bases[[1]])) {
    .pulso_aviso(sprintf("\"%s\": los grupos a excluir sólo se aplican cuando el gráfico y su cruce leen una misma base; sale con todos los grupos.", cr$var))
    return(el)
  }
  datos <- data_sources[[cr$base]]
  if (!is.data.frame(datos) || !cr$var %in% names(datos)) return(el)   # el render ya avisa del cruce ausente
  presentes <- trimws(as.character(datos[[cr$var]])); presentes <- unique(presentes[!is.na(presentes) & nzchar(presentes)])
  res <- .excluir_grupos_resolver(pedidos, .goc_categorias(inst_sources[[cr$base]], cr$var), presentes)
  if (length(res$ausentes)) {
    .pulso_aviso(sprintf("\"%s\": no hay casos en los grupos a excluir %s.", cr$var, .excluir_grupos_citar(res$ausentes)))
  }
  con_coma <- grepl(",", res$codigos, fixed = TRUE)
  if (any(con_coma)) {
    .pulso_aviso(sprintf("\"%s\": el grupo %s lleva coma en su código y no se puede excluir.", cr$var, .excluir_grupos_citar(res$codigos[con_coma])))
    res$codigos <- res$codigos[!con_coma]; res$rotulos <- res$rotulos[!con_coma]
  }
  if (!length(res$codigos)) return(el)
  reglas <- .excluir_grupos_filtros_reglas(el$filtros)
  if (is.null(reglas)) {
    .pulso_aviso(sprintf("\"%s\": los filtros de este gráfico no admiten excluir grupos; sale con todos los grupos.", cr$var))
    return(el)
  }
  el$filtros <- c(reglas, list(list(variable = cr$var, op = "notin", value = paste(res$codigos, collapse = ","))))
  el$.excluir_grupos_aplicado <- list(variable = cr$var, codigos = res$codigos, rotulos = res$rotulos)
  el
}

#' Pone la nota de los grupos excluidos en el pie del gráfico renderizado
#'
#' La lámina nativa, el respaldo y el Word leen el pie de `attr(p, "note_outside")` y, sin él, de la nota del elemento
#' (`.plot_note_from`). Se anexa a lo que haya; no se toca `overrides$nota_pie`, porque su presencia apaga la nota de
#' significancia que el render de la multiapilada pone de pie.
#' @param el Elemento ya preparado por `.plan_excluir_grupos`. @param p Gráfico que devolvió el render.
#' @keywords internal
.excluir_grupos_nota_al_grafico <- function(el, p) {
  ap <- if (is.list(el)) el$.excluir_grupos_aplicado else NULL
  if (is.null(p) || is.null(ap) || !length(ap$rotulos)) return(p)
  nota <- .excluir_grupos_nota(ap$rotulos)
  previa <- attr(p, "note_outside", exact = TRUE) %||% (el$overrides %||% list())$nota_pie %||% el$nota_pie
  previa <- trimws(as.character(previa %||% "")[1])
  if (!is.na(previa) && grepl(sub("[.]$", "", nota), previa, fixed = TRUE)) return(p)
  attr(p, "note_outside") <- .lam_unir_base(if (is.na(previa)) NULL else previa, nota)
  p
}

#' Aplica `excluir_grupos` a todos los gráficos del plan (enganche de `reporte_ppt_plan`)
#'
#' Recorre las ranuras de cada lámina, también anidadas. Los bloques de una multiapilada `multilista` no lo declaran: el
#' pie «Base:» de esa lámina se calcula con los filtros de la lámina, no con los de cada bloque.
#' @param plan Plan (`ppt_plan`).
#' @param data_sources,inst_sources Bases y sus instrumentos.
#' @param default_source Base de las referencias sin calificar.
#' @return El plan con cada gráfico ajustado; las demás láminas intactas.
#' @keywords internal
.plan_excluir_grupos <- function(plan, data_sources, inst_sources, default_source = NULL) {
  if (!length(plan)) return(plan)
  visitar <- function(x) {
    if (inherits(x, "ppt_element")) {
      if (is.null(x$excluir_grupos)) return(x)
      return(.excluir_grupos_elemento(x, data_sources, inst_sources, default_source))
    }
    if (is.list(x) && !is.data.frame(x) && length(x)) {
      atr <- attributes(x)
      x <- lapply(x, visitar)
      attributes(x) <- atr
    }
    x
  }
  atr <- attributes(plan)
  out <- lapply(plan, function(slide) {
    if (!is.list(slide) || !is.list(slide$slots)) return(slide)
    slide$slots <- visitar(slide$slots)
    slide
  })
  attributes(out) <- atr
  out
}
