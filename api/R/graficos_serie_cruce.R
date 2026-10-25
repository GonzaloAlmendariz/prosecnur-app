# =============================================================================
# graficos_serie_cruce.R — evolución por los niveles de un cruce ordinal dentro de una base (L10-7, bandeja CCSS)
# =============================================================================
#
# `p_serie_temporal()` sólo comparaba olas: un punto por BASE. En CCSS Perfil 2026, con una sola base, la lámina salía
# con un punto suelto rotulado «Default». Lo que se quería era la evolución por nivel curricular (VI → IX) dentro de la
# misma base: una línea con un punto por nivel y el porcentaje en cada punto.
#
# Con `cruce`, cada tema declara UNA pregunta de la base del cruce y el eje X son los niveles del cruce en el orden del
# instrumento (o el de `grupos`, si se declara). El porcentaje de cada punto es el mismo cálculo que el de la brecha
# entre grupos (`.radar_mb_pct`: códigos del indicador sobre los que respondieron, con el peso de la base) y el dibujo es
# el de siempre (`graficar_serie_temporal()`, recetario). La base se declara: casos sin ponderar de cada nivel en el pie.

#' `p_serie_temporal()` con `cruce`: una pregunta por tema y los niveles del cruce como eje X
#' @keywords internal
.p_serie_cruce <- function(vars, corte, corte_etiqueta, cruce, grupos, titulo, overrides, base, filtros, ...) {
  if (!is.list(vars) || !length(vars) || is.null(names(vars)) || any(!nzchar(trimws(names(vars))))) {
    .plan_spec_abort("p_serie_temporal(): `vars` debe ser una lista nombrada no vacia; cada nombre es la etiqueta de la linea.")
  }
  refs <- vapply(vars, function(x) as.character(unlist(x))[1], character(1))
  if (any(is.na(refs) | !nzchar(trimws(refs)))) .plan_spec_abort("p_serie_temporal(): con `cruce`, cada tema declara una pregunta.")
  if (!length(.radar_mb_codigos(corte))) .plan_spec_abort("p_serie_temporal(): `corte` debe traer al menos un codigo de la escala.")
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")
  k <- list(...)
  ov <- overrides
  if (!is.null(k$colores_series)) ov$colores_series <- k$colores_series
  if (!is.null(k$limite_y)) ov$limite_y <- k$limite_y
  for (nm in c("mostrar_valores", "destacar_ultimo", "mostrar_puntos", "mostrar_grid_y", "mostrar_leyenda")) {
    ov <- .ppt_slot_override(ov, nm, k[[nm]], "bool")
  }
  if (!is.null(k$max_series_con_cifras) && is.null(ov$max_series_con_cifras)) ov$max_series_con_cifras <- suppressWarnings(as.integer(k$max_series_con_cifras)[1])
  if (!is.null(k$valores_decimales) && is.null(ov$valores_decimales)) ov$valores_decimales <- .radar_mb_decimales(k$valores_decimales)
  ov <- .ppt_slot_override(ov, "mostrar_significancia", k$mostrar_significancia, "bool")      # L10-9
  ov <- .ppt_slot_override(ov, "significancia_alpha", k$significancia_alpha, "numero", min = 0)
  g <- if (is.null(grupos)) NULL else trimws(as.character(unlist(grupos)))
  el <- list(
    .element_type  = "serie_temporal",
    var            = NULL,   # `$` hace match parcial: sin este campo `el$var` devolvería `vars`
    vars           = as.list(stats::setNames(refs, names(vars))),
    cruce          = trimws(as.character(cruce)[1]),
    grupos         = if (length(g)) g else NULL,
    corte          = .graf_corte_unido(corte),
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    title_slide    = titulo,
    overrides      = ov,
    base           = base,
    filtros        = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

#' Datos de la serie por niveles del cruce
#'
#' @param temas Lista nombrada `etiqueta -> ref`, todas de la base del cruce.
#' @param grupos Códigos del cruce a mostrar, en orden; `NULL` = todos los del instrumento con respuestas.
#' @return `data.frame(eje, grupo, valor, n, n_casos)` con `grupo` (el nivel) como factor en el orden del eje X.
#' @keywords internal
.serie_cruce_datos <- function(temas, corte, cruce, sources, filtros = list(), grupos = NULL) {
  codigos <- .radar_mb_codigos(corte)
  if (!length(codigos)) stop_api(400, "E_RADAR_SIN_CORTE", "La serie necesita un indicador: al menos un código de la escala.")
  cruce <- .serie_cruce_ref(cruce, sources)
  cx <- .graficos_consolidado_ref_context(cruce, sources)
  if (!isTRUE(cx$exists)) stop("serie: la pregunta de cruce `", cruce, "` no existe en la base.", call. = FALSE)
  opciones <- .equiv_escala_opciones(cx$inst, cx$resolved_variable)
  cod <- vapply(opciones, function(o) as.character(o$codigo %||% "")[1], character(1))
  etq <- vapply(opciones, function(o) as.character(o$etiqueta %||% "")[1], character(1))
  etq[!nzchar(etq)] <- cod[!nzchar(etq)]
  if (!is.null(grupos)) {
    faltan <- setdiff(grupos, cod)
    if (length(faltan)) stop("serie: el cruce `", cruce, "` no tiene los niveles ", paste(faltan, collapse = ", "), ".", call. = FALSE)
    etq <- etq[match(grupos, cod)]; cod <- grupos
  }
  datos <- (sources$data_sources %||% list())[[cx$source]]
  datos <- .apply_named_filters_safe(datos, filters = filtros, arg_name = "filtros de la serie", mode = "strict")
  g <- trimws(as.character(datos[[cx$resolved_variable]]))
  pesos <- .radar_mb_pesos(datos)
  filas <- list()
  for (tema in names(temas)) {
    ref <- .serie_cruce_ref(as.character(unlist(temas[[tema]]))[1], sources, cx$source)
    ctx <- .graficos_consolidado_ref_context(ref, sources)
    if (!isTRUE(ctx$exists)) stop("serie: el tema `", tema, "` declara `", ref, "`, que no existe en la base.", call. = FALSE)
    if (!identical(ctx$source, cx$source)) {
      stop("serie: el tema `", tema, "` está en la base `", ctx$source, "` y el cruce en `", cx$source,
           "`: la evolución por niveles se mide dentro de una misma base.", call. = FALSE)
    }
    for (k in seq_along(cod)) {
      dentro <- !is.na(g) & g == cod[k]
      v <- datos[[ctx$resolved_variable]][dentro]
      m <- .radar_mb_pct(v, codigos, pesos = pesos[dentro])
      filas[[length(filas) + 1L]] <- data.frame(eje = tema, grupo = etq[k], valor = m$valor, n = m$n,
                                                n_casos = .dumbbell_casos(v, pesos[dentro]), stringsAsFactors = FALSE)
    }
  }
  out <- do.call(rbind, filas)
  # Un nivel sin ninguna respuesta en ningún tema no es un punto de la serie (no se inventa un cero).
  vivos <- unique(out$grupo[out$n_casos > 0])
  out <- out[out$grupo %in% vivos, , drop = FALSE]
  if (!nrow(out)) stop("serie: ningún nivel del cruce `", cruce, "` tiene respuestas.", call. = FALSE)
  out$eje <- factor(out$eje, levels = names(temas))
  out$grupo <- factor(out$grupo, levels = etq[etq %in% vivos])
  rownames(out) <- NULL
  out
}

#' Ref completa `base$variable`: una pregunta sin base se busca en la base indicada o en la primera que la tenga
#' @keywords internal
.serie_cruce_ref <- function(ref, sources, preferida = NULL) {
  ref <- trimws(as.character(ref)[1])
  if (grepl("$", ref, fixed = TRUE)) return(ref)
  ds <- sources$data_sources %||% list()
  bases <- unique(c(preferida, names(ds)))
  hit <- bases[vapply(bases, function(b) is.data.frame(ds[[b]]) && ref %in% names(ds[[b]]), TRUE)]
  if (length(hit)) paste0(hit[1], "$", ref) else ref
}

#' Pie de la serie por niveles: los casos (sin ponderar) de cada nivel, «Casos por nivel: VI 119 · VII 122»
#' @keywords internal
.serie_cruce_nota <- function(datos) {
  niv <- levels(datos$grupo)
  n <- vapply(niv, function(x) max(datos$n_casos[datos$grupo == x], na.rm = TRUE), 0)
  paste0("Casos que respondieron, por nivel: ", paste(sprintf("%s: %s", niv, .dumbbell_fmt_casos(n)), collapse = " · "), ".")
}

#' Render de la serie por niveles del cruce
#' @keywords internal
.render_serie_cruce <- function(el, sources, preset_args = list()) {
  base_preset <- if (length(preset_args)) preset_args else .serie_temporal_preset()
  args_usuario <- utils::modifyList(as.list(base_preset %||% list()), as.list(el$overrides %||% list()))
  datos <- .serie_cruce_datos(el$vars, el$corte, el$cruce, sources, filtros = el$filtros %||% list(), grupos = el$grupos)
  args_usuario$orden_periodos <- levels(datos$grupo)
  # L10-9: con una sola serie la leyenda repite el título; se apaga salvo que la lámina la pida.
  if (nlevels(datos$eje) == 1L && is.null((el$overrides %||% list())$mostrar_leyenda)) args_usuario$mostrar_leyenda <- FALSE
  # L10-9: letras de significancia entre niveles, con la prueba de las tablas de cruces (graficos_serie_significancia.R).
  sig <- .serie_sig_config(args_usuario)
  args_usuario$mostrar_significancia <- NULL; args_usuario$significancia_alpha <- NULL
  letras <- if (sig$activo) .serie_sig_letras(datos, el$vars, sources, el$cruce, alpha = sig$alpha) else NULL
  if (!is.null(letras)) {
    datos$sufijo <- letras$sufijo
    if (is.null(args_usuario$nota_pie)) args_usuario$nota_pie <- .sig_nota_pie_del_grafico(letras$nota)
  }
  base_args <- list(
    data = datos, var_eje = "eje", var_grupo = "grupo", var_valor = "valor", escala_valor = "proporcion_100",
    titulo = el$title_slide %||% NULL, subtitulo = el$corte_etiqueta %||% NULL,
    orden_periodos = levels(datos$grupo), orden_series = levels(datos$eje),
    var_sufijo = if (!is.null(letras)) "sufijo" else NULL
  )
  args <- utils::modifyList(base_args, args_usuario)
  args <- .keep_formals(graficar_serie_temporal, args, contexto = "graficar_serie_temporal")
  p <- do.call(graficar_serie_temporal, args)
  # Los casos por nivel van al pie de la lámina (canal de notas del motor), junto a la base.
  attr(p, "note_outside") <- .serie_cruce_nota(datos)
  if (!is.null(letras)) p <- .sig_nota_a_lamina(p, letras$nota, args$nota_pie)   # la nota, sobre «Base:»
  p
}
