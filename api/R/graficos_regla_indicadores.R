# =============================================================================
# graficos_regla_indicadores.R — la tabla de indicadores de la regla de preguntas (ADR 0135)
# =============================================================================
#
# De las fuentes del estudio a `data.frame(tema, etiqueta, grupo, valor, sin_info, n, orden)`, la entrada de
# `.regla_preguntas_evaluar()` (graficos_regla_preguntas.R). Una pregunta no apta no detiene nada: sale de las
# candidatas y se cuenta en los avisos.
#
# Universo de candidatas por tipo (ADR 0135, punto 5):
#   - Panorama, fortalezas y escala del resumen: las preguntas de escala de cada base (`select_one` de diseño independiente con el
#     corte, al menos cuatro opciones sustantivas y una lista de batería o declarada ordinal: graficos_regla_escala.R).
#   - Contraste entre públicos: los temas que el payload declara (el render no tiene sesión, así que los pares de la
#     matriz de equivalencias llegan ya escritos en `vars`); un tema con `base$*` en las dos bases toma los pares del
#     mismo nombre y la misma firma de escala (bases que comparten instrumento).
#   - Contraste entre grupos de una base: las preguntas declaradas (o `base$*`) abiertas por el cruce.
# El valor de cada celda sale de las mismas funciones que el render (`.radar_mb_datos`, `.dumbbell_grupos_datos`,
# `.radar_mb_pct` con `.radar_mb_pesos`), con los filtros y la ponderación de la lámina.

#' Opciones de la escala de una pregunta y cuáles no son sustantivas (único detector: `.graficos_no_sustantivos`)
#' @return `list(codigos, etiquetas, no_sustantivo)`; vectores vacíos si la pregunta no tiene lista.
#' @keywords internal
.regla_preguntas_escala <- function(inst, var) {
  ops <- .equiv_escala_opciones(inst, var)
  cods <- vapply(ops, function(o) as.character(o$codigo %||% "")[1], character(1))
  etq <- vapply(ops, function(o) as.character(o$etiqueta %||% "")[1], character(1))
  if (!length(cods)) return(list(codigos = character(0), etiquetas = character(0), no_sustantivo = logical(0)))
  lista <- .equiv_lista_de(inst, var)$lista
  ch <- inst$choices
  ns <- .graficos_no_sustantivos_escala(cods, etq, especiales = .graficos_no_sustantivos_especiales_meta(lista, ch),
                                        sustantivos = .graficos_no_sustantivos_especiales_meta(lista, ch, .NO_SUSTANTIVOS_META_NO))   # el detector de la escala divergente
  list(codigos = cods, etiquetas = etq, no_sustantivo = as.logical(ns))
}

#' Rótulo de la pregunta en su instrumento (la variable si no tiene)
#' @keywords internal
.regla_preguntas_rotulo <- function(inst, var) {
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv) || !"label" %in% names(sv)) return(var)
  i <- which(as.character(sv$name) == var)[1]
  lab <- if (is.na(i)) NA_character_ else trimws(as.character(sv$label[[i]]))
  if (is.na(lab) || !nzchar(lab)) var else lab
}

#' Califica una referencia pelada con la única base del estudio; en multibase una pelada no se adivina
#' @keywords internal
.regla_preguntas_calificar <- function(ref, sources) {
  if (grepl("$", ref, fixed = TRUE)) return(ref)
  bases <- names(sources$data_sources %||% list())
  if (length(bases) == 1L) paste0(bases, "$", ref) else NA_character_
}

#' Resumen de exclusiones como avisos: «3 preguntas quedan fuera: no son de escala con el indicador.»
#' @keywords internal
.regla_preguntas_avisos <- function(motivos) {
  if (!length(motivos)) return(character(0))
  tab <- table(factor(unlist(motivos), levels = unique(unlist(motivos))))
  vapply(names(tab), function(mo) {
    n <- as.integer(tab[[mo]])
    sprintf("%s %s fuera: %s.", if (n == 1L) "1 pregunta" else paste(.regla_preguntas_cifra(n), "preguntas"),
            if (n == 1L) "queda" else "quedan", mo)
  }, character(1), USE.NAMES = FALSE)
}

#' Porcentaje en «Sin información» de una pregunta, con el mismo denominador que el indicador
#' @keywords internal
.regla_preguntas_sin_info <- function(valores, esc, pesos = NULL) {
  ns <- esc$codigos[esc$no_sustantivo]
  if (!length(ns)) return(0)
  m <- .radar_mb_pct(valores, ns, pesos = pesos)
  if (is.finite(m$valor)) m$valor else NA_real_
}

#' Fila de indicadores de una pregunta en una base (todos sus casos, con filtros y ponderación)
#' @keywords internal
.regla_preguntas_medir <- function(datos, var, esc, codigos) {
  pesos <- .radar_mb_pesos(datos)
  m <- .radar_mb_pct(datos[[var]], codigos, pesos = pesos)
  list(valor = m$valor, n = .dumbbell_casos(datos[[var]], pesos), sin_info = .regla_preguntas_sin_info(datos[[var]], esc, pesos))
}

#' ¿Pregunta de escala para una lámina de resumen? `select_one` plana con el corte, 4+ opciones sustantivas y una lista
#' que forma batería o que el estudio declara ordinal (graficos_regla_escala.R)
#' @param baterias `.regla_escala_baterias(inst)`, si ya se calculó para la base.
#' @keywords internal
.regla_preguntas_es_escala <- function(inst, var, codigos = character(0), baterias = NULL) {
  sv <- (inst %||% list())$survey
  if (!is.data.frame(sv)) return(FALSE)
  fila <- which(as.character(sv$name) == var)[1]
  if (is.na(fila) || !grepl("^select_one(?:\\s|$)", trimws(as.character(sv$type[[fila]])), perl = TRUE)) return(FALSE)
  if (!identical(.graficos_sig_diseno_de_fuente(inst, var), "independiente")) return(FALSE)
  esc <- .regla_preguntas_escala(inst, var)
  sum(!esc$no_sustantivo) >= 4L && all(codigos %in% esc$codigos) && .regla_escala_por_lista(inst, var, baterias)
}

#' Las preguntas de escala de una base (lo que significa `base$*`)
#' @keywords internal
.regla_preguntas_de_base <- function(base, codigos, sources) {
  inst <- (sources$inst_sources %||% list())[[base]]
  datos <- (sources$data_sources %||% list())[[base]]
  if (is.null(inst) || !is.data.frame(inst$survey) || !is.data.frame(datos)) return(NULL)
  vs <- as.character(inst$survey$name)
  vs <- vs[!is.na(vs) & vs %in% names(datos)]
  bat <- .regla_escala_baterias(inst)
  vs[vapply(vs, function(v) isTRUE(tryCatch(.regla_preguntas_es_escala(inst, v, codigos, bat), error = function(e) FALSE)), TRUE)]
}

#' Datos filtrados de una base (los filtros de la lámina, en modo estricto como el render)
#' @keywords internal
.regla_preguntas_datos_base <- function(base, sources, filtros) {
  .apply_named_filters_safe(sources$data_sources[[base]], filters = filtros %||% list(), arg_name = "filtros de la lámina", mode = "strict")
}

#' Indicadores del panorama: una fila por pregunta de cada público
#'
#' Por pregunta (`tema` = `base$variable`) en las reglas de un grupo; por nombre de variable (pares del mismo nombre
#' entre bases) en las que comparan grupos.
#' @keywords internal
.regla_preguntas_ind_panorama <- function(el, sources, tipo) {
  codigos <- .radar_mb_codigos(el$corte)
  refs <- character(0); motivos <- list()
  for (r in as.character(el$vars)) {
    part <- .graficos_ref_parts(r)
    if (!nzchar(part$source) || is.null(sources$data_sources[[part$source]])) { motivos[[length(motivos) + 1L]] <- "su base no está en el estudio"; next }
    if (identical(part$name, "*")) refs <- c(refs, paste0(part$source, "$", .regla_preguntas_de_base(part$source, codigos, sources)))
    else refs <- c(refs, r)
  }
  refs <- unique(refs)
  por_nombre <- tipo %in% .REGLA_PREGUNTAS_ENTRE_GRUPOS
  filas <- list(); refs_tema <- list(); datos_cache <- list()
  for (i in seq_along(refs)) {
    ref <- refs[i]
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) { motivos[[length(motivos) + 1L]] <- "no existen en su base"; next }
    if (!isTRUE(tryCatch(.regla_preguntas_es_escala(ctx$inst, ctx$resolved_variable, codigos), error = function(e) FALSE))) {
      motivos[[length(motivos) + 1L]] <- "no son de escala con el indicador"; next
    }
    if (is.null(datos_cache[[ctx$source]])) datos_cache[[ctx$source]] <- .regla_preguntas_datos_base(ctx$source, sources, el$filtros)
    m <- .regla_preguntas_medir(datos_cache[[ctx$source]], ctx$resolved_variable, .regla_preguntas_escala(ctx$inst, ctx$resolved_variable), codigos)
    if (!is.finite(m$valor)) { motivos[[length(motivos) + 1L]] <- "no tienen respuestas con los filtros"; next }
    tema <- if (por_nombre) ctx$resolved_variable else ref
    etiqueta <- .regla_preguntas_rotulo(ctx$inst, ctx$resolved_variable)
    if (!por_nombre) etiqueta <- sprintf("%s (%s)", etiqueta, .radar_mb_capitalizar(ctx$source))
    filas[[length(filas) + 1L]] <- data.frame(tema = tema, etiqueta = etiqueta, grupo = ctx$source, valor = m$valor,
                                              sin_info = m$sin_info, n = m$n, orden = i, stringsAsFactors = FALSE)
    refs_tema[[tema]] <- c(refs_tema[[tema]], ref)
  }
  list(indicadores = .regla_preguntas_rbind(filas), refs_por_tema = refs_tema, avisos = .regla_preguntas_avisos(motivos),
       universo = "preguntas de escala", grupos_unidad = "públicos")
}

#' Une filas de indicadores; sin filas, la tabla vacía con sus columnas
#' @keywords internal
.regla_preguntas_rbind <- function(filas) {
  if (length(filas)) { out <- do.call(rbind, filas); rownames(out) <- NULL; return(out) }
  data.frame(tema = character(0), etiqueta = character(0), grupo = character(0), valor = numeric(0), sin_info = numeric(0),
             n = numeric(0), orden = integer(0), stringsAsFactors = FALSE)
}

#' Pares de `base$*` entre dos bases: las preguntas de escala con el mismo nombre y la misma firma
#' @keywords internal
.regla_preguntas_pares_por_nombre <- function(fuentes, codigos, sources) {
  vs <- lapply(fuentes, .regla_preguntas_de_base, codigos = codigos, sources = sources)
  if (any(vapply(vs, is.null, TRUE))) return(list())
  comunes <- Reduce(intersect, vs)
  inst1 <- sources$inst_sources[[fuentes[1]]]
  pares <- list()
  for (v in comunes) {
    firmas <- vapply(fuentes, function(b) .equiv_firma_escala(sources$inst_sources[[b]], v), character(1))
    if (length(unique(firmas)) != 1L) next
    pares[[length(pares) + 1L]] <- list(rotulo = .regla_preguntas_rotulo(inst1, v), refs = paste0(fuentes, "$", v))
  }
  if (!length(pares)) return(list())
  nm <- make.unique(vapply(pares, `[[`, "", "rotulo"), sep = " ")
  stats::setNames(lapply(pares, `[[`, "refs"), nm)
}

#' Indicadores del contraste entre dos bases: los temas declarados (y `base$*` por nombre)
#' @keywords internal
.regla_preguntas_ind_dumbbell_bases <- function(el, sources) {
  codigos <- .radar_mb_codigos(el$corte)
  if (.dumbbell_sin_temas(el$vars)) el$vars <- .dumbbell_vars_desde_fuentes(el, sources)   # graficos_dumbbell_auto.R
  temas <- list(); motivos <- list()
  for (t in names(el$vars)) {
    refs <- as.character(el$vars[[t]])
    partes <- lapply(refs, .graficos_ref_parts)
    if (all(vapply(partes, function(p) identical(p$name, "*"), TRUE))) {
      temas <- c(temas, .regla_preguntas_pares_por_nombre(vapply(partes, `[[`, "", "source"), codigos, sources))
    } else temas[[t]] <- refs
  }
  if (length(temas)) names(temas) <- make.unique(names(temas), sep = " ")
  filas <- list(); refs_tema <- list()
  for (i in seq_along(temas)) {
    t <- names(temas)[i]
    d <- tryCatch(.radar_mb_datos(stats::setNames(list(temas[[t]]), t), el$corte, sources, filtros = el$filtros %||% list()),
                  error = function(e) NULL)
    if (is.null(d) || nrow(d) != 2L || any(!is.finite(d$valor))) { motivos[[length(motivos) + 1L]] <- "no forman un par comparable en las dos bases"; next }
    for (j in seq_len(nrow(d))) {
      ctx <- .graficos_consolidado_ref_context(temas[[t]][j], sources)
      esc <- .regla_preguntas_escala(ctx$inst, ctx$resolved_variable)
      datos <- .regla_preguntas_datos_base(ctx$source, sources, el$filtros)
      si <- .regla_preguntas_sin_info(datos[[ctx$resolved_variable]], esc, .radar_mb_pesos(datos))
      filas[[length(filas) + 1L]] <- data.frame(tema = t, etiqueta = t, grupo = as.character(d$grupo[j]), valor = d$valor[j],
                                                sin_info = si, n = d$n_casos[j], orden = i, stringsAsFactors = FALSE)
    }
    refs_tema[[t]] <- temas[[t]]
  }
  ind <- .regla_preguntas_rbind(filas)
  if (nrow(ind)) ind$grupo <- factor(ind$grupo, levels = unique(ind$grupo))
  list(indicadores = ind, refs_por_tema = refs_tema, avisos = .regla_preguntas_avisos(motivos),
       universo = "preguntas comunes", grupos_unidad = "públicos")
}

#' Indicadores del contraste entre grupos de una base (`cruce`)
#' @keywords internal
.regla_preguntas_ind_dumbbell_cruce <- function(el, sources) {
  codigos <- .radar_mb_codigos(el$corte)
  refs <- if (is.list(el$vars)) vapply(el$vars, function(x) as.character(unlist(x))[1], character(1)) else as.character(el$vars)
  nombres <- names(el$vars) %||% rep("", length(refs))
  motivos <- list(); vars <- list()
  cx <- .graficos_consolidado_ref_context(el$cruce, sources)
  for (i in seq_along(refs)) {
    part <- .graficos_ref_parts(refs[i])
    if (identical(part$name, "*")) {
      vs <- .regla_preguntas_de_base(part$source, codigos, sources)
      if (is.null(vs)) { motivos[[length(motivos) + 1L]] <- "su base no está en el estudio"; next }
      # La pregunta que define los grupos no se compara consigo misma.
      if (isTRUE(cx$exists) && identical(part$source, cx$source)) vs <- setdiff(vs, cx$resolved_variable)
      vars <- c(vars, as.list(paste0(part$source, "$", vs)))
    } else vars <- c(vars, stats::setNames(list(refs[i]), nombres[i]))
  }
  temas <- if (length(vars)) .dumbbell_grupos_temas(vars, sources) else list()
  filas <- list(); refs_tema <- list()
  for (i in seq_along(temas)) {
    t <- names(temas)[i]
    ctx <- .graficos_consolidado_ref_context(temas[[t]], sources)
    apta <- isTRUE(ctx$exists) && isTRUE(tryCatch(.regla_preguntas_es_escala(ctx$inst, ctx$resolved_variable, codigos), error = function(e) FALSE))
    d <- if (apta) tryCatch(.dumbbell_grupos_datos(stats::setNames(list(temas[[t]]), t), el$corte, el$cruce, el$grupos, sources,
                                                   filtros = el$filtros %||% list()), error = function(e) NULL) else NULL
    if (is.null(d)) { motivos[[length(motivos) + 1L]] <- if (apta) "no se pueden abrir por los grupos del cruce" else "no son de escala con el indicador"; next }
    esc <- .regla_preguntas_escala(ctx$inst, ctx$resolved_variable)
    datos <- .regla_preguntas_datos_base(cx$source, sources, el$filtros)
    g <- trimws(as.character(datos[[cx$resolved_variable]])); pesos <- .radar_mb_pesos(datos)
    gr <- as.character(unlist(el$grupos))
    for (j in seq_len(nrow(d))) {
      dentro <- !is.na(g) & g == gr[j]
      si <- .regla_preguntas_sin_info(datos[[ctx$resolved_variable]][dentro], esc, pesos[dentro])
      filas[[length(filas) + 1L]] <- data.frame(tema = t, etiqueta = t, grupo = as.character(d$grupo[j]), valor = d$valor[j],
                                                sin_info = si, n = d$n_casos[j], orden = i, stringsAsFactors = FALSE)
    }
    refs_tema[[t]] <- temas[[t]]
  }
  ind <- .regla_preguntas_rbind(filas)
  if (nrow(ind)) ind$grupo <- factor(ind$grupo, levels = unique(ind$grupo))
  list(indicadores = ind, refs_por_tema = refs_tema, avisos = .regla_preguntas_avisos(motivos),
       universo = "preguntas de escala", grupos_unidad = "grupos")
}

#' Indicadores de la escala con «Sin información» aparte: el lado de acuerdo y el «Sin información» de cada pregunta
#'
#' Las candidatas son las de la firma más frecuente y las de otra escala que se alinean con ella por posición (mismo
#' número de opciones sustantivas, mismo sentido y mismo reparto: graficos_escala_armonizada.R); las demás salen con aviso.
#' Las cifras salen de la tabla de la lámina (`.regla_div_medidas`, graficos_regla_divergentes.R): el Top Two Box y el
#' «Sin información» que la lámina rotula, con sus exclusiones y su detector de la columna especial.
#' @keywords internal
.regla_preguntas_ind_divergentes <- function(el, sources, preset = NULL) {
  refs <- character(0); motivos <- list(); original <- character(0)
  for (r in as.character(el$vars)) {
    q <- .regla_preguntas_calificar(r, sources)
    if (is.na(q)) { motivos[[length(motivos) + 1L]] <- "les falta la base (base$variable)"; next }
    part <- .graficos_ref_parts(q)
    if (identical(part$name, "*")) {
      vs <- .regla_preguntas_de_base(part$source, character(0), sources)
      if (is.null(vs)) { motivos[[length(motivos) + 1L]] <- "su base no está en el estudio"; next }
      refs <- c(refs, paste0(part$source, "$", vs)); original <- c(original, paste0(part$source, "$", vs))
    } else { refs <- c(refs, q); original <- c(original, r) }
  }
  keep <- !duplicated(refs); refs <- refs[keep]; original <- original[keep]
  info <- lapply(refs, function(ref) {
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) return(list(motivo = "no existen en su base"))
    if (!isTRUE(tryCatch(.regla_preguntas_es_escala(ctx$inst, ctx$resolved_variable), error = function(e) FALSE))) return(list(motivo = "no son de escala"))
    list(ctx = ctx, firma = .equiv_firma_escala(ctx$inst, ctx$resolved_variable))
  })
  firmas <- vapply(info, function(x) x$firma %||% NA_character_, character(1))
  cands <- firmas[!is.na(firmas)]
  firma_tab <- table(cands)
  # La firma más frecuente; con empate, la que aparece primero.
  firma <- if (length(cands)) cands[cands %in% names(firma_tab)[firma_tab == max(firma_tab)]][1] else NA_character_
  a <- .regla_div_args(el, preset)
  forma_de <- function(x) {
    esc <- .regla_preguntas_escala(x$ctx$inst, x$ctx$resolved_variable)
    .escala_arm_forma(esc$etiquetas, esc$no_sustantivo, a$n_negativas, a$incluir_neutro)
  }
  forma_mayoria <- if (!is.na(firma)) forma_de(info[[match(firma, firmas)]]) else NULL
  aptas <- integer(0)
  for (i in seq_along(refs)) {
    x <- info[[i]]
    if (!is.null(x$motivo)) { motivos[[length(motivos) + 1L]] <- x$motivo; next }
    if (!identical(x$firma, firma)) {
      motivo <- .escala_arm_motivo(forma_mayoria, forma_de(x))
      if (!is.null(motivo)) { motivos[[length(motivos) + 1L]] <- motivo; next }
    }
    aptas <- c(aptas, i)
  }
  el$.firma_leyenda <- firma   # la leyenda es la escala más frecuente del universo, no de las elegidas
  med <- .regla_div_medidas(refs[aptas], el, sources, preset = preset)
  motivos <- c(motivos, med$motivos)
  filas <- list(); refs_tema <- list(); datos_cache <- list()
  # Con varios públicos, el rótulo lleva su abreviatura, como la fila de la lámina (graficos_divergentes_publicos.R).
  etq_publico <- stats::setNames(.divergentes_rotulos_publicos(
    vapply(refs[aptas], function(r) { cx <- info[[match(r, refs)]]$ctx; .regla_preguntas_rotulo(cx$inst, cx$resolved_variable) }, ""),
    refs[aptas], el$abreviaturas), refs[aptas])
  for (i in aptas) {
    j <- match(refs[i], med$medidas$ref)
    if (is.na(j)) next
    ctx <- info[[i]]$ctx
    if (is.null(datos_cache[[ctx$source]])) datos_cache[[ctx$source]] <- .regla_preguntas_datos_base(ctx$source, sources, el$filtros)
    datos <- datos_cache[[ctx$source]]
    tema <- original[i]
    filas[[length(filas) + 1L]] <- data.frame(tema = tema, etiqueta = unname(etq_publico[refs[i]]),
                                              grupo = ctx$source, valor = med$medidas$valor[j], sin_info = med$medidas$sin_info[j],
                                              n = .dumbbell_casos(datos[[ctx$resolved_variable]], .radar_mb_pesos(datos)), orden = i,
                                              stringsAsFactors = FALSE)
    refs_tema[[tema]] <- tema
  }
  list(indicadores = .regla_preguntas_rbind(filas), refs_por_tema = refs_tema,
       avisos = c(.regla_preguntas_avisos(motivos), med$avisos), universo = "preguntas de escala", grupos_unidad = "públicos",
       firma_leyenda = firma)
}

#' Tabla de indicadores de un elemento ya construido (`p_panorama`, `p_dumbbell`, `p_barras_divergentes`, `p_fortalezas`)
#'
#' @param el Elemento `ppt_element` del constructor.
#' @param sources `list(data_sources, inst_sources)`.
#' @param tipo Tipo de regla (decide si el panorama empareja por nombre).
#' @param preset Args del preset del tipo; sólo la escala los usa (sus exclusiones y su reparto).
#' @return `list(indicadores, refs_por_tema, avisos, universo, grupos_unidad)`.
#' @keywords internal
.regla_preguntas_indicadores <- function(el, sources, tipo = "todas", preset = NULL) {
  et <- as.character(el$.element_type %||% "")[1]
  switch(et,
    panorama = .regla_preguntas_ind_panorama(el, sources, tipo),
    fortalezas = .regla_preguntas_ind_panorama(el, sources, tipo),   # un público: las preguntas de escala de su base
    dumbbell = if (!is.null(el$cruce)) .regla_preguntas_ind_dumbbell_cruce(el, sources) else .regla_preguntas_ind_dumbbell_bases(el, sources),
    barras_divergentes = .regla_preguntas_ind_divergentes(el, sources, preset = preset),
    .regla_preguntas_falla("Este gráfico no elige sus preguntas con una regla.")
  )
}

