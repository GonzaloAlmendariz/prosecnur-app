# =============================================================================
# graficos_dumbbell_grupos.R — la brecha entre dos grupos de una misma base
# =============================================================================
#
# G17 (Gonzalo, 2026-10-13: «el lollipop de brechas también era un gráfico bastante interesante»; elegido: «dos grupos
# de una base», como la lámina 250 del diseño, trabajadores frente a directivos). `p_dumbbell` comparaba sólo dos
# bases; con `cruce` y `grupos` compara dos grupos de una pregunta de la misma base, tema por tema. Los datos salen con
# la misma forma que los del radar entre públicos (`eje`, `grupo`, `valor`, `n`), así que el dibujo y la lámina nativa
# (88) son los mismos.

#' Datos de la brecha entre dos grupos
#'
#' @param temas Lista nombrada `etiqueta del tema -> ref` (una por tema, todas de la base del cruce).
#' @param corte Códigos de la escala que suman el indicador («3,4»).
#' @param cruce Ref `base$variable` de la pregunta que define los grupos.
#' @param grupos Los dos códigos del cruce, en orden: la brecha es el primero menos el segundo.
#' @param sources `list(data_sources, inst_sources)`.
#' @return `data.frame(eje, grupo, valor, n)`, una fila por (tema, grupo); `valor` en 0–100.
#' @keywords internal
.dumbbell_grupos_datos <- function(temas, corte, cruce, grupos, sources, filtros = list()) {
  codigos <- .radar_mb_codigos(corte)
  if (!length(codigos)) stop_api(400, "E_RADAR_SIN_CORTE", "La brecha necesita un indicador: al menos un código de la escala.")
  grupos <- as.character(unlist(grupos))
  if (length(grupos) != 2L || anyDuplicated(grupos)) {
    stop("dumbbell: `grupos` debe traer exactamente dos códigos distintos del cruce.", call. = FALSE)
  }
  cx <- .graficos_consolidado_ref_context(cruce, sources)
  if (!isTRUE(cx$exists)) stop("dumbbell: la pregunta de cruce `", cruce, "` no existe en la base.", call. = FALSE)
  opciones <- .equiv_escala_opciones(cx$inst, cx$resolved_variable)
  cod_cruce <- vapply(opciones, function(o) as.character(o$codigo %||% "")[1], character(1))
  etq_cruce <- vapply(opciones, function(o) as.character(o$etiqueta %||% "")[1], character(1))
  faltan <- setdiff(grupos, cod_cruce)
  if (length(faltan)) stop("dumbbell: el cruce `", cruce, "` no tiene los grupos ", paste(faltan, collapse = ", "), ".", call. = FALSE)
  etiquetas <- etq_cruce[match(grupos, cod_cruce)]
  etiquetas[!nzchar(etiquetas)] <- grupos[!nzchar(etiquetas)]

  datos <- (sources$data_sources %||% list())[[cx$source]]
  datos <- .apply_named_filters_safe(datos, filters = filtros, arg_name = "filtros de la brecha", mode = "strict")
  g <- trimws(as.character(datos[[cx$resolved_variable]]))
  pesos <- .radar_mb_pesos(datos)

  filas <- list()
  for (tema in names(temas)) {
    ref <- as.character(unlist(temas[[tema]]))[1]
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) stop("dumbbell: el tema `", tema, "` declara `", ref, "`, que no existe en la base.", call. = FALSE)
    if (!identical(ctx$source, cx$source)) {
      stop("dumbbell: el tema `", tema, "` está en la base `", ctx$source, "` y el cruce en `", cx$source,
           "`: los dos grupos se comparan dentro de una misma base.", call. = FALSE)
    }
    for (k in 1:2) {
      dentro <- !is.na(g) & g == grupos[k]
      m <- .radar_mb_pct(datos[[ctx$resolved_variable]][dentro], codigos, pesos = pesos[dentro])
      filas[[length(filas) + 1L]] <- data.frame(eje = tema, grupo = etiquetas[k], valor = m$valor, n = m$n, stringsAsFactors = FALSE)
    }
  }
  out <- do.call(rbind, filas)
  out$eje <- factor(out$eje, levels = names(temas))
  out$grupo <- factor(out$grupo, levels = etiquetas)
  rownames(out) <- NULL
  out
}

#' Temas de la brecha entre grupos: refs sueltas o lista nombrada de una ref por tema; sin nombre, la etiqueta de la
#' pregunta en el instrumento
#' @keywords internal
.dumbbell_grupos_temas <- function(vars, sources = NULL) {
  refs <- if (is.list(vars)) lapply(vars, function(x) as.character(unlist(x))[1]) else as.list(as.character(vars))
  nm <- names(refs) %||% rep("", length(refs))
  for (i in seq_along(refs)) {
    if (nzchar(trimws(nm[i]))) next
    lab <- if (!is.null(sources)) {
      ctx <- .graficos_consolidado_ref_context(refs[[i]], sources)
      sv <- ctx$survey
      if (isTRUE(ctx$exists) && is.data.frame(sv) && "label" %in% names(sv)) as.character(sv$label[[ctx$row_idx]]) else ""
    } else ""
    nm[i] <- if (!is.na(lab) && nzchar(trimws(lab))) trimws(lab) else sub("^.*\\$", "", refs[[i]])
  }
  stats::setNames(refs, make.unique(nm, sep = " "))
}

#' `p_dumbbell()` con `cruce`: una ref por tema, todas de una base, y los dos códigos de grupo
#' @keywords internal
.p_dumbbell_grupos <- function(vars, corte, corte_etiqueta, orden, mostrar_brecha, umbral_brecha_pct, titulo,
                               overrides, base, filtros, etiqueta_brecha, cruce, grupos) {
  if (!nzchar(trimws(as.character(cruce)[1] %||% ""))) .plan_spec_abort("p_dumbbell(): elige la pregunta que define los grupos.")
  refs <- if (is.list(vars)) vapply(vars, function(x) as.character(unlist(x))[1], character(1)) else as.character(vars)
  if (!length(refs) || any(is.na(refs) | !nzchar(trimws(refs)))) {
    .plan_spec_abort("p_dumbbell(): con `cruce`, `vars` debe traer al menos una pregunta.")
  }
  if (!length(.radar_mb_codigos(corte))) .plan_spec_abort("p_dumbbell(): `corte` debe traer al menos un codigo de la escala.")
  grupos <- trimws(as.character(unlist(grupos)))
  if (length(grupos) != 2L || anyDuplicated(grupos) || any(!nzchar(grupos))) {
    .plan_spec_abort("p_dumbbell(): `grupos` debe traer los dos grupos del cruce que se comparan.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  ov <- overrides
  ov$orden <- orden
  ov$mostrar_brecha <- isTRUE(mostrar_brecha)
  ov$umbral_brecha_pct <- suppressWarnings(as.numeric(umbral_brecha_pct)[1])
  ov <- .ppt_slot_override(ov, "etiqueta_brecha", etiqueta_brecha, "texto")
  el <- list(
    .element_type = "dumbbell",
    var = NULL,
    vars = if (is.list(vars) && !is.null(names(vars))) vars else as.list(refs),
    cruce = trimws(as.character(cruce)[1]),
    grupos = grupos,
    corte = paste(as.character(unlist(corte)), collapse = ","),
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide = titulo,
    overrides = ov,
    base = base,
    filtros = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}
