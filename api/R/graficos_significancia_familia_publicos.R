# =============================================================================
# graficos_significancia_familia_publicos.R — la familia de BH entre públicos (ADR 0138 §4)
# =============================================================================
#
# Con `correccion = "bh_informe"`, las comparaciones entre públicos forman SU PROPIA familia: todos los temas emparejados
# con escala comparable de las láminas que piden tarjetas entre públicos. Nunca se mezclan con la familia de una base
# (`.sig_familia_estudio`): no comparten objeto, ni la caché `.sig_cache`, ni se interpolan una contra la otra. Agregar
# las comparaciones entre públicos no cambia ninguna letra ya generada en una base.
#
# La familia viaja al render en el contexto del informe (`prosecnur.sig_informe`) como `familia_publicos`, junto a la
# matriz de equivalencias (`equivalencias_publicos`) que decide qué temas están declarados.

#' Elemento entre públicos de una lámina del plan con su meta entre públicos: `p_dumbbell` sin cruce, el radar por
#' públicos o el panorama (graficos_tarjetas_publicos_radar_panorama.R)
#'
#' Lee la forma del plan guardado (`payload` con `graficador` y `args`) o la ya construida (`slots$plot`).
#' @return `list(vars, corte, filtros, regla, bases, .element_type)` o NULL si la lámina no aplica.
#' @keywords internal
.tpub_elemento_de_lamina <- function(slide) {
  meta <- slide$meta %||% (slide$payload %||% list())$meta %||% list()
  if (is.null(.tpub_opcion(meta))) return(NULL)
  rp <- .tpub_elemento_radar_panorama(slide)
  if (!is.null(rp)) return(rp)
  el <- (slide$slots %||% list())$plot
  if (is.list(el) && identical(el$.element_type, "dumbbell")) {
    if (!is.null(el$cruce)) return(NULL)
    return(list(vars = el$vars, corte = el$corte, filtros = el$filtros %||% list(), regla = el$regla, bases = el$bases,
                .element_type = "dumbbell"))
  }
  grafs <- Filter(function(z) is.list(z) && identical(as.character(z$graficador %||% "")[1], "p_dumbbell"), slide$payload %||% list())
  if (!length(grafs)) return(NULL)
  a <- grafs[[1]]$args %||% list()
  if (!is.null(a$cruce) && nzchar(trimws(as.character(a$cruce)[1]))) return(NULL)
  list(vars = a$vars, corte = a$corte, filtros = a$filtros %||% list(), regla = a$regla, bases = a$bases,
       .element_type = "dumbbell")
}

#' Temas que dibuja la lámina (regla de preguntas aplicada) y su declaración
#' @return `list(vars_render, temas)`.
#' @keywords internal
.tpub_temas_de_elemento <- function(el, sources, equiv) {
  if (identical(el$.element_type, "radar_publicos")) return(.tpub_temas_radar(el, equiv))
  if (identical(el$.element_type, "panorama")) return(.tpub_temas_panorama(el, sources, equiv))
  vars_lamina <- el$vars
  if (.dumbbell_sin_temas(vars_lamina) && !is.null(el$bases)) vars_lamina <- .dumbbell_vars_de_bases(.dumbbell_bases_contraste(el$bases))
  el_r <- el; el_r$vars <- vars_lamina
  if (!is.null(el$regla)) el_r <- .regla_preguntas_aplicar_render(el_r, "dumbbell", sources)$el
  vars_render <- lapply(el_r$vars %||% list(), function(x) as.character(unlist(x)))
  list(vars_render = vars_render, temas = .tpub_temas_declarados(vars_render, vars_lamina, equiv))
}

#' Láminas del plan con tarjetas entre públicos
#' @keywords internal
.tpub_laminas_del_plan <- function(plan) {
  slides <- if (is.list(plan)) plan$slides %||% plan else list()
  Filter(function(s) is.list(s) && !is.null(.tpub_elemento_de_lamina(s)), slides)
}

#' Familia de BH entre públicos de un plan (primera pasada)
#'
#' Cada tema declarado y de escala comparable entra una sola vez (clave: refs, corte y filtros). Los temas sin
#' equivalencia, con escalas distintas o sin dos públicos comparables no entran.
#' @return `list(tabla, m)`; `tabla` de `.sig_bh_tabla()`.
#' @keywords internal
.tpub_familia_plan <- function(plan, sources, equiv, regla) {
  p <- list()
  for (s in .tpub_laminas_del_plan(plan)) {
    el <- .tpub_elemento_de_lamina(s)
    tt <- tryCatch(.tpub_temas_de_elemento(el, sources, equiv)$temas, error = function(e) list())
    for (x in tt) {
      if (is.null(x$refs) || is.na(x$equivalencia)) next
      clave <- paste(c(sort(paste(names(x$refs), x$refs, sep = "$")), .radar_mb_codigos(el$corte),
                       digest::digest(el$filtros %||% list(), algo = "xxhash32")), collapse = "\r")
      if (!is.null(p[[clave]])) next
      te <- tryCatch(.tpub_evaluar_tema(x$tema, x$refs, el$corte, sources, regla, filtros = el$filtros %||% list(),
                                        equivalencia = x$equivalencia), error = function(e) NULL)
      p[[clave]] <- if (is.null(te)) numeric(0) else .tpub_p_familia(te)
    }
  }
  todos <- unlist(p, use.names = FALSE)
  tabla <- .sig_bh_tabla(todos)
  list(tabla = tabla, m = tabla$m)
}

#' Agrega al contexto del informe la matriz de equivalencias y la familia entre públicos (sólo con `bh_informe`)
#'
#' @param ctx Contexto liviano (`.sig_contexto_liviano`); NULL lo deja como está.
#' @param plan Plan del pedido. @param sources `list(data_sources, inst_sources)` de TODAS las bases, o una función que
#'   las devuelve (la vista previa sólo las pide si el plan tiene láminas entre públicos).
#' @keywords internal
.tpub_en_contexto <- function(ctx, plan, sources, equiv = NULL) {
  if (!is.list(ctx)) return(ctx)
  ctx$equivalencias_publicos <- equiv
  ctx$familia_publicos <- NULL
  if (identical((ctx$regla %||% list())$correccion, "bh_informe") && length(.tpub_laminas_del_plan(plan))) {
    fam <- tryCatch(.tpub_familia_plan(plan, if (is.function(sources)) sources() else sources, equiv, ctx$regla), error = function(e) {
      message("[diferencias] no se pudo calcular la familia entre públicos: ", conditionMessage(e))
      NULL
    })
    ctx$familia_publicos <- fam$tabla
  }
  ctx
}

#' Matriz de equivalencias de la sesión (o NULL), para el worker y la vista previa
#' @keywords internal
.tpub_equivalencias_sesion <- function(sid) {
  tryCatch((session_get(sid, required = FALSE) %||% list())$equivalencias_publicos, error = function(e) NULL)
}
