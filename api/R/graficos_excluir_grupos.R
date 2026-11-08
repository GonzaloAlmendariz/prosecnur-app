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
# Columna del cruce: la que agrupa el render. Si la base trae `<cruce>_recod`, el render agrupa por ella
# (`.reporte_plan_resolve_recod_var`, el mismo resolutor de `.resolve_ref`), así que los grupos se buscan en sus
# categorías y la regla cae sobre ella; un código de la columna original que la recodificación fundió no se excluye.
#
# La lámina lo dice: «Excluye el grupo Otro» se anexa al pie del gráfico renderizado (`note_outside`, que leen la lámina
# nativa, el respaldo y el Word; `.excluir_grupos_nota_al_grafico`, enganchado en `.plan_render_element_degradable`).
# Sólo se nombran los grupos con casos en la base ya filtrada por el analista; un grupo pedido que no existe, que es
# ambiguo o que dejaría el gráfico sin grupos se avisa y no se excluye.
#
# Significancia (decisión del lead, 2026-11-08): excluir es ocultar, pero el render compara los grupos que recibe, así
# que con Bonferroni por fila excluir un grupo baja la corrección y puede aparecer una marca que la tabla de cruces no
# da (paridad del ADR 0128). Pasarle al motor el número de comparaciones del cruce completo exige tocar el motor de
# significancia (`.sig_veredictos`) y el render congelado; se toma el respaldo: la nota de significancia dice
# «Diferencias entre los grupos mostrados.» y se avisa al analista.
#
# Supuestos:
#   - Los pesos no se recalibran: cada caso conserva su peso y los grupos que quedan suman lo que sumaban.
#   - Las categorías especiales (90-99, SIN INF) del grupo excluido salen con él.
#   - El pie «Base:» cuenta casos de los grupos que quedan (con valor en el cruce), no la suma de pesos.
#   - Un cruce con algún valor que lleva coma: `.base_filtros_con_cruce` no agrega su regla «cruce con valor» y la base
#     sin exclusión cuenta también las filas sin cruce; con la exclusión, el `notin` las deja fuera. Se deja así: es un
#     caso de borde y la base con exclusión es la correcta.

.EXCLUIR_GRUPOS_TIPOS <- c("barras_apiladas", "barras_agrupadas", "barras_multiapiladas")

#' La referencia del cruce de un elemento que admite `excluir_grupos`, o `NULL`
#' @keywords internal
#'
#' @param presets Presets del motor: la agrupada hereda el cruce de `presets$barras_agrupadas$args$cruces`, como su
#'   render (`overrides$cruces %||% el$cruces %||% preset_args$cruces`).
.excluir_grupos_cruce_ref <- function(el, presets = NULL) {
  tipo <- el$.element_type %||% ""
  ov <- el$overrides %||% list()
  if (!is.list(presets)) presets <- NULL
  ref <- switch(tipo,
                barras_multiapiladas = if ((el$modo %||% "") %in% c("cruce", "var_cruce")) el$cruce else NULL,
                barras_agrupadas = ov$cruces %||% el$cruces %||% ((presets %||% list())$barras_agrupadas %||% list())$args$cruces,
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

#' Clave de comparación de un rótulo: sin tildes, mayúsculas ni signos
#'
#' `stringi` (Latin-ASCII) y no `iconv(ASCII//TRANSLIT)`: en macOS el segundo escribe «Educación» como «educaci'on».
#' @keywords internal
.excluir_grupos_clave <- function(x) {
  x <- stringi::stri_trans_general(enc2utf8(as.character(x)), "Latin-ASCII")
  x <- gsub("[^a-z0-9]+", "_", tolower(trimws(x)))
  gsub("^_+|_+$", "", x)
}

#' Traduce los grupos pedidos a códigos de la columna del cruce
#'
#' Un pedido casa por código, luego por rótulo (`.excluir_grupos_clave`) y, si la base guarda rótulos o la columna no
#' tiene lista, por el valor tal cual en la columna. Es ambiguo, y no se excluye, si casa con más de un código por rótulo
#' o como código y a la vez como rótulo de OTRO código: se pide el código.
#' @param pedidos Rótulos o códigos pedidos.
#' @param cats `data.frame(codigo, etiqueta)` de la lista del cruce (`.goc_categorias`).
#' @param presentes Valores (recortados) presentes en la columna del cruce, con los filtros del gráfico.
#' @return `list(codigos, rotulos, ausentes, ambiguos)`: los códigos con casos y su rótulo, los pedidos sin casos y los
#'   ambiguos.
#' @keywords internal
.excluir_grupos_resolver <- function(pedidos, cats, presentes) {
  codigos <- character(0); rotulos <- character(0); ausentes <- character(0); ambiguos <- character(0)
  cod_cat <- as.character(cats$codigo); eti_cat <- as.character(cats$etiqueta)
  clave_eti <- .excluir_grupos_clave(eti_cat)
  for (p in pedidos) {
    clave_p <- .excluir_grupos_clave(p)
    por_rotulo <- unique(cod_cat[nzchar(clave_eti) & nzchar(clave_p) & clave_eti == clave_p])
    if (p %in% cod_cat) {
      if (any(por_rotulo != p)) { ambiguos <- c(ambiguos, p); next }
      cand <- p
    } else if (length(por_rotulo) > 1L) {
      ambiguos <- c(ambiguos, p); next
    } else if (length(por_rotulo) == 1L) {
      cand <- por_rotulo
    } else {
      cand <- if (p %in% presentes) p else character(0)
    }
    cand <- cand[cand %in% presentes]
    if (!length(cand)) { ausentes <- c(ausentes, p); next }
    codigos <- c(codigos, cand)
    rot <- eti_cat[match(cand, cod_cat)]
    rotulos <- c(rotulos, ifelse(is.na(rot) | !nzchar(rot), cand, rot))
  }
  keep <- !duplicated(codigos)
  list(codigos = codigos[keep], rotulos = rotulos[keep], ausentes = unique(ausentes), ambiguos = unique(ambiguos))
}

#' Los pedidos sin casos en la columna recodificada que sí son grupos de la original: la recodificación los fundió
#'
#' Sólo con `<cruce>_recod`: el pedido se busca en la columna original, con los mismos filtros, por código o rótulo.
#' @param ausentes Pedidos que no casaron con ningún grupo de `col`.
#' @param var_original,col Columna del cruce declarada y la que agrupa el render.
#' @param filtrados Base con los filtros del analista. @param inst Instrumento de la base.
#' @return Los pedidos fundidos (subconjunto de `ausentes`).
#' @keywords internal
.excluir_grupos_fundidos <- function(ausentes, var_original, col, filtrados, inst) {
  if (!length(ausentes) || identical(var_original, col) || !var_original %in% names(filtrados)) return(character(0))
  orig <- trimws(as.character(filtrados[[var_original]])); orig <- unique(orig[!is.na(orig) & nzchar(orig)])
  r <- .excluir_grupos_resolver(ausentes, .goc_categorias(inst, var_original), orig)
  setdiff(ausentes, c(r$ausentes, r$ambiguos))
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

#' Aplica `excluir_grupos` a un elemento: la regla `notin` en sus filtros y la marca para la nota de la lámina
#'
#' @param el Elemento del plan.
#' @param data_sources,inst_sources Bases y sus instrumentos.
#' @param default_source Base de las referencias sin calificar.
#' @param presets Presets del motor (el cruce heredado de la agrupada).
#' @return El elemento, con `filtros` y `.excluir_grupos_aplicado` ajustados, o intacto si no hay nada que excluir.
#' @keywords internal
.excluir_grupos_elemento <- function(el, data_sources, inst_sources, default_source = NULL, presets = NULL) {
  pedidos <- trimws(as.character(unlist(el$excluir_grupos, use.names = FALSE)))
  pedidos <- unique(pedidos[!is.na(pedidos) & nzchar(pedidos)])
  el$excluir_grupos <- NULL   # se consume aquí: un segundo paso no la aplica dos veces
  if (!length(pedidos)) return(el)
  cruce_ref <- .excluir_grupos_cruce_ref(el, presets)
  if (is.null(cruce_ref)) {
    .pulso_aviso(sprintf("Los grupos a excluir %s no se aplican: el gráfico no tiene \"Dividir por\".", .excluir_grupos_citar(pedidos)))
    return(el)
  }

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
  col <- if (is.data.frame(datos)) .reporte_plan_resolve_recod_var(cr$var, datos) else cr$var   # la columna que agrupa el render
  if (!is.data.frame(datos) || !col %in% names(datos)) {
    .pulso_aviso(sprintf("\"%s\": la base no trae la columna del cruce; los grupos a excluir no se aplican.", cr$var))
    return(el)
  }
  reglas <- .excluir_grupos_filtros_reglas(el$filtros)
  if (is.null(reglas)) {
    .pulso_aviso(sprintf("\"%s\": los filtros de este gráfico no admiten excluir grupos; sale con todos los grupos.", cr$var))
    return(el)
  }
  # Los grupos presentes con los filtros del analista: un grupo que su filtro ya vació no se nombra en el pie.
  filtrados <- tryCatch(suppressWarnings(.apply_named_filters_safe(datos, el$filtros %||% list())), error = function(e) datos)
  presentes <- trimws(as.character(filtrados[[col]])); presentes <- unique(presentes[!is.na(presentes) & nzchar(presentes)])
  res <- .excluir_grupos_resolver(pedidos, .goc_categorias(inst_sources[[cr$base]], col), presentes)
  if (length(res$ambiguos)) {
    .pulso_aviso(sprintf("\"%s\": %s nombra a más de un grupo y no se excluye; indica el código del grupo.", col, .excluir_grupos_citar(res$ambiguos)))
  }
  fundidos <- .excluir_grupos_fundidos(res$ausentes, cr$var, col, filtrados, inst_sources[[cr$base]])
  if (length(fundidos)) {
    .pulso_aviso(sprintf("\"%s\": la recodificación juntó %s con otro grupo y no se puede excluir por separado; excluye el grupo recodificado.",
                         col, .excluir_grupos_citar(fundidos)))
  }
  ausentes <- setdiff(res$ausentes, fundidos)
  if (length(ausentes)) {
    .pulso_aviso(sprintf("\"%s\": no hay casos en los grupos a excluir %s.", col, .excluir_grupos_citar(ausentes)))
  }
  con_coma <- grepl(",", res$codigos, fixed = TRUE)
  if (any(con_coma)) {
    .pulso_aviso(sprintf("\"%s\": el grupo %s lleva coma en su código y no se puede excluir.", col, .excluir_grupos_citar(res$codigos[con_coma])))
    res$codigos <- res$codigos[!con_coma]; res$rotulos <- res$rotulos[!con_coma]
  }
  if (!length(res$codigos)) return(el)
  if (!length(setdiff(presentes, res$codigos))) {
    .pulso_aviso(sprintf("\"%s\": excluir %s deja el gráfico sin grupos; sale con todos.", col, .excluir_grupos_citar(res$rotulos)))
    return(el)
  }
  el$filtros <- c(reglas, list(list(variable = col, op = "notin", value = paste(res$codigos, collapse = ","))))
  el$.excluir_grupos_aplicado <- list(variable = col, codigos = res$codigos, rotulos = res$rotulos)
  el
}

.EXCLUIR_GRUPOS_NOTA_SIG <- "Diferencias entre los grupos mostrados."

#' Con grupos excluidos, la nota de significancia dice que compara sólo los grupos mostrados (respaldo de la decisión 4)
#'
#' La lámina nativa escribe la nota de `attr(p, "pulso_sig_nota")` (lamina_nota_significancia.R). El caption que el
#' graficador dibuja dentro de la imagen de respaldo no se reescribe.
#' @keywords internal
.excluir_grupos_nota_sig <- function(p, variable = "") {
  sig <- trimws(as.character(attr(p, "pulso_sig_nota", exact = TRUE) %||% "")[1])
  if (is.na(sig) || !nzchar(sig) || grepl(.EXCLUIR_GRUPOS_NOTA_SIG, sig, fixed = TRUE)) return(p)
  attr(p, "pulso_sig_nota") <- paste(sub("([^.])$", "\\1.", sig), .EXCLUIR_GRUPOS_NOTA_SIG)
  .pulso_aviso(sprintf("\"%s\": con grupos excluidos, las diferencias se marcan entre los grupos mostrados; la tabla de cruces compara todos los grupos.", variable))
  p
}

#' ¿La frase «Diferencias entre los grupos mostrados.» va también en el pie del gráfico?
#'
#' Sí cuando el gráfico marca diferencias y nadie escribe su nota de significancia aparte: en los paneles de 2 y 4
#' gráficos (y en el render sin plantilla estándar) la nota viaja como caption dentro de la imagen, que no se reescribe,
#' así que la frase sólo llega por `note_outside`. La lámina de un gráfico y el Word fijan
#' `prosecnur.sig_nota_en_lamina` y escriben `pulso_sig_nota`, que ya la lleva (`.excluir_grupos_nota_sig`): repetirla
#' en el pie la duplicaría.
#' @keywords internal
.excluir_grupos_sig_al_pie <- function(p) {
  sig <- trimws(as.character(attr(p, "pulso_sig_nota", exact = TRUE) %||% "")[1])
  !is.na(sig) && nzchar(sig) && !isTRUE(getOption("prosecnur.sig_nota_en_lamina"))
}

#' Pone la nota de los grupos excluidos en el pie del gráfico renderizado
#'
#' La lámina nativa, el respaldo y el Word leen el pie de `attr(p, "note_outside")` y, sin él, de la nota del elemento
#' (`.plot_note_from`). Se anexa a lo que haya; no se toca `overrides$nota_pie`, porque su presencia apaga la nota de
#' significancia que el render de la multiapilada pone de pie. Con diferencias marcadas fuera de la lámina de un gráfico,
#' el pie termina en «Diferencias entre los grupos mostrados.» (`.excluir_grupos_sig_al_pie`).
#' @param el Elemento ya preparado por `.plan_excluir_grupos`. @param p Gráfico que devolvió el render.
#' @keywords internal
.excluir_grupos_nota_al_grafico <- function(el, p) {
  ap <- if (is.list(el)) el$.excluir_grupos_aplicado else NULL
  if (is.null(p) || is.null(ap) || !length(ap$rotulos)) return(p)
  sig_al_pie <- .excluir_grupos_sig_al_pie(p)
  p <- .excluir_grupos_nota_sig(p, ap$variable)
  nota <- .excluir_grupos_nota(ap$rotulos)
  if (sig_al_pie) nota <- paste(nota, .EXCLUIR_GRUPOS_NOTA_SIG)
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
#' @param presets Presets del motor; por defecto, los de `reporte_ppt_plan`, que llama.
#' @return El plan con cada gráfico ajustado; las demás láminas intactas.
#' @keywords internal
.plan_excluir_grupos <- function(plan, data_sources, inst_sources, default_source = NULL, presets = NULL) {
  if (!length(plan)) return(plan)
  if (is.null(presets)) presets <- get0("presets", envir = parent.frame(), inherits = FALSE)   # los de `reporte_ppt_plan`
  visitar <- function(x) {
    if (inherits(x, "ppt_element")) {
      if (is.null(x$excluir_grupos)) return(x)
      return(.excluir_grupos_elemento(x, data_sources, inst_sources, default_source, presets))
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
