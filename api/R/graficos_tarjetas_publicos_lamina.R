# =============================================================================
# graficos_tarjetas_publicos_lamina.R — las tarjetas entre públicos en la lámina y en el inspector (ADR 0138 §7)
# =============================================================================
#
# Cubre el contraste de públicos (`p_dumbbell` con dos bases, sin cruce), el radar por públicos
# (`p_radar(modo = "publicos")`) y el panorama en sus temas emparejados; los ganchos del radar y del panorama viven en
# graficos_tarjetas_publicos_radar_panorama.R.
#
# Gancho de render: `.tarjetas_adjuntar` (graficos_tarjetas_diferencias.R) desvía aquí la lámina cuya meta pide
# `entre_publicos`. La prueba concilia contra las cifras que dibuja el contraste (`pulso_espec` de las pesas); si no
# cuadran, el tema se abstiene. Las tarjetas viajan en `attr(p, "pulso_tarjetas")` con la misma forma que las del ADR
# 0129, así que el panel del PPT (lamina_tarjetas_diferencias.R) y el Word (reporte_word_tarjetas.R) las dibujan igual.

#' Tipos de espec del contraste de dos públicos: el de estilo resumen («CONTRASTE DE PÚBLICOS», ADR 0134) y las pesas
#' @keywords internal
.TPUB_ESPECS <- c("contraste", "pesas")

#' Cifras que dibuja el contraste, por tema: lista `tema -> c(base = valor)` (0-100), o NULL si no se pueden leer
#'
#' El contraste rotula el tema con su nombre corto (`.resumen_temas_cortos`). El de estilo resumen guarda la matriz
#' `valores` (tema × público); las pesas, `a` (primer público) y `b` (segundo). Los públicos van en el orden de las refs
#' del primer tema.
#' @keywords internal
.tpub_referencia_pesas <- function(espec, vars_render) {
  if (!is.list(espec) || !espec$tipo %in% .TPUB_ESPECS || !length(vars_render)) return(NULL)
  cortos <- names(.resumen_temas_cortos(vars_render))
  bases <- names(.tpub_refs(vars_render[[1]]) %||% character(0))
  if (length(bases) != 2L) return(NULL)
  out <- list()
  for (i in seq_along(vars_render)) {
    k <- match(cortos[i], as.character(espec$rotulos))
    v <- if (is.na(k)) c(NA_real_, NA_real_) else if (identical(espec$tipo, "contraste")) espec$valores[k, 1:2] else c(espec$a[k], espec$b[k])
    out[[names(vars_render)[i]]] <- stats::setNames(as.numeric(v), bases)
  }
  out
}

#' Cifras del contraste calculadas por el mismo camino que el gráfico (`.radar_mb_datos`), para el inspector
#' @keywords internal
.tpub_referencia_datos <- function(vars_render, corte, sources, filtros = list()) {
  d <- tryCatch(suppressWarnings(.radar_mb_datos(vars_render, corte, sources, filtros = filtros)), error = function(e) NULL)
  if (is.null(d)) return(NULL)
  out <- list()
  for (tema in names(vars_render)) {
    k <- as.character(d$eje) == tema
    out[[tema]] <- stats::setNames(d$valor[k], as.character(d$grupo[k]))
  }
  out
}

#' Aviso de la lámina (no tumba el render)
#' @keywords internal
.tpub_aviso <- function(...) {
  if (exists(".pulso_aviso", mode = "function")) .pulso_aviso(paste0("Tarjetas entre públicos: ", ...))
  invisible(NULL)
}

#' Adjunta las tarjetas entre públicos al contraste, al radar o al panorama de una lámina (gancho de `.tarjetas_adjuntar`)
#'
#' Lee del entorno del motor la lámina en curso y las fuentes del estudio (`data_sources`, `instrument_sources`). La
#' regla, la familia entre públicos y la matriz de equivalencias vienen del contexto del informe; sin él, la regla
#' propuesta sobre todas las bases (`.tpub_regla_de_contexto`) y la familia de la propia lámina.
#' @keywords internal
.tpub_adjuntar <- function(p, env) {
  slide <- get0("slide", envir = env, inherits = FALSE)
  titulo <- as.character(unlist(slide$title %||% ""))[1] %||% ""
  if (inherits(slide$title, "ppt_element_text")) titulo <- as.character(slide$title$text %||% "")[1]
  el <- .tpub_elemento_de_lamina(slide)
  espec <- attr(p, "pulso_espec")
  if (is.null(el) || !.tpub_figura_admite(el, espec, p)) {
    .tpub_aviso("la lámina \"", titulo, "\" no es un contraste, un radar ni un panorama entre públicos; va sin tarjetas.")
    return(p)
  }
  sources <- list(data_sources = get0("data_sources", envir = env, inherits = FALSE),
                  inst_sources = get0("instrument_sources", envir = env, inherits = FALSE))
  if (!length(sources$data_sources)) return(p)
  ctx <- .sig_informe_vigente()
  regla <- .tpub_regla_de_contexto(ctx, sources$data_sources)
  opt <- .tpub_opcion(slide$meta)
  t <- tryCatch({
    tt <- .tpub_temas_de_elemento(el, sources, ctx$equivalencias_publicos)
    .tpub_calcular(tt$temas, el$corte, sources, regla, opt, familia = ctx$familia_publicos,
                   filtros = el$filtros %||% list(), referencia = .tpub_referencia_render(el, p, espec, tt$vars_render),
                   titulo = titulo)
  }, error = function(e) {
    .tpub_aviso("no se pudieron calcular en \"", titulo, "\" (", conditionMessage(e), ").")
    NULL
  })
  if (is.null(t)) return(p)
  sin_eq <- sum(vapply(t$temas, function(te) identical(te$estado, "sin_equivalencia"), logical(1)))
  if (sin_eq) .tpub_aviso("en \"", titulo, "\", ", sin_eq, " de ", length(t$temas), " temas no tienen equivalencia declarada ",
                          "(matriz o emparejado confirmado) y no se comparan.")
  fuera <- sum(vapply(t$temas, function(te) as.integer(te$fuera_de_familia %||% 0L), integer(1)))
  if (fuera) .tpub_aviso("en \"", titulo, "\", ", fuera, " comparación(es) no están en la familia entre públicos del informe ",
                         "y no se marcan.")
  if (identical(el$.element_type, "radar_publicos")) p <- .tpub_radar_sin_tabla(p, t, titulo)
  attr(p, "pulso_tarjetas") <- t
  if (!is.null(t$nota)) attr(p, "pulso_sig_nota") <- t$nota
  .tarjetas_registrar(p, t)
  p
}

#' La lámina del inspector (`GET /api/graficos/diferencias?slide=`) con `modo_letras = "entre_publicos"`
#'
#' Misma evaluación que el render: temas declarados, regla del estudio, familia entre públicos y conciliación con las
#' cifras del gráfico calculadas por su camino (`.radar_mb_datos` en el contraste y el radar, `.panorama_datos` en el
#' panorama).
#' @param familia Tabla de BH entre públicos del plan (NULL: la de la lámina).
#' @keywords internal
.tpub_lamina_json <- function(slide, sources, regla, equiv = NULL, familia = NULL) {
  titulo <- as.character(slide$payload$titulo %||% slide$title %||% "")[1]
  base <- list(slide_id = as.character(slide$id %||% "")[1], titulo = titulo, estado = "ninguna", activo = TRUE,
               motivo = NA, error = NA, variable = NA, cruce = NA, modo_letras = .TPUB_CRUCE, grupos = list(),
               pares = list(), nota = NA, revisar = list(), temas = list(), tarjetas = list(),
               familia = list(m = 0L, local = TRUE))
  el <- .tpub_elemento_de_lamina(slide)
  opt <- .tpub_opcion(slide$meta %||% (slide$payload %||% list())$meta)
  res <- tryCatch({
    tt <- .tpub_temas_de_elemento(el, sources, equiv)
    ref <- .tpub_referencia_inspector(el, tt$vars_render, sources)
    .tpub_calcular(tt$temas, el$corte, sources, regla, opt, familia = familia, filtros = el$filtros %||% list(),
                   referencia = ref, titulo = titulo)
  }, error = function(e) e)
  if (inherits(res, "error")) {
    error_id <- substr(digest::digest(list(Sys.time(), base$slide_id), algo = "xxhash32"), 1, 8)
    message(sprintf("[E_SIG_PRUEBA_FALLO] error_id=%s lámina=%s (entre públicos): %s", error_id, base$slide_id,
                    conditionMessage(res)))
    base$estado <- "error"
    base$error <- list(code = "E_SIG_PRUEBA_FALLO", message = "La prueba no pudo ejecutarse en esta lámina.", error_id = error_id)
    base$revisar <- list("sin_prueba")
    return(base)
  }
  temas <- lapply(res$temas, .tpub_tema_json, regla = regla, nota = res$nota, indicador = opt$indicador)
  base$temas <- temas
  con_tarjeta <- vapply(res$tarjetas, `[[`, "", "fila")
  base$tarjetas <- Filter(function(x) x$fila %in% con_tarjeta, temas)
  base$tarjetas <- base$tarjetas[order(match(vapply(base$tarjetas, `[[`, "", "fila"), con_tarjeta))]
  evaluables <- Filter(function(x) identical(x$estado, "evaluable"), temas)
  base$estado <- if (length(base$tarjetas)) "con_marcas" else if (length(evaluables)) "ninguna" else "abstencion"
  if (identical(base$estado, "abstencion")) base$motivo <- temas[[1]]$motivo %||% NA
  base$grupos <- if (length(evaluables)) evaluables[[1]]$grupos else list()
  base$pares <- unlist(lapply(temas, function(x) lapply(x$pares, function(pp) c(list(fila = x$fila), pp))), recursive = FALSE) %||% list()
  base$nota <- res$nota %||% NA
  base$familia <- list(m = as.integer(res$familia$m %||% 0L), local = isTRUE(res$familia$local))
  ver <- unlist(lapply(temas, function(x) vapply(x$pares, `[[`, "", "veredicto")))
  base$revisar <- as.list(c(if (!any(ver %in% c("marcada", "fragil"))) "sin_diferencias",
                            if (any(ver == "bajo_umbral")) "bajo_umbral",
                            if (any(vapply(temas, function(x) any(!vapply(x$grupos, function(g) isTRUE(g$comparable), logical(1))), logical(1)))) "base_chica",
                            if (any(ver %in% c("sin_equivalencia", "escalas_distintas"))) "sin_equivalencia"))
  base
}

#' La lámina entre públicos del inspector con las fuentes de la sesión (todas las bases), su matriz y su familia
#' @param sc Contexto de `.sig_contexto_sesion()` (regla y plan).
#' @keywords internal
.tpub_lamina_json_sesion <- function(sid, slide, sc) {
  sources <- .graficos_processing_sources(sid)
  equiv <- .tpub_equivalencias_sesion(sid)
  regla <- .tpub_regla_de_contexto(sc$ctx, sources$data_sources)   # la propuesta se resuelve sobre todas las bases
  familia <- if (identical(regla$correccion, "bh_informe")) .tpub_familia_plan(sc$cfg$plan, sources, equiv, regla)$tabla else NULL
  .tpub_lamina_json(slide, sources, regla, equiv = equiv, familia = familia)
}
