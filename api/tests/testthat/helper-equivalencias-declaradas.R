# =============================================================================
# Matriz de equivalencias declarada para los fixtures del contraste entre públicos (ADR 0138 §5)
# =============================================================================
#
# El contraste entre públicos con `base$*` o `bases = c(A, B)` empareja por la matriz de equivalencias, nunca por
# nombre (graficos_dumbbell_equivalencia.R). Los fixtures que comparten instrumento entre bases declaran aquí, de forma
# explícita, que cada pregunta del mismo nombre es la misma pregunta: sin esta declaración la lámina no compara.
# Prefijo `.heq_`: testthat carga los helper-*.R para todos los archivos.

#' Matriz que declara equivalentes las preguntas del mismo nombre en todas las bases (o en `bases`)
.heq_matriz_por_nombre <- function(sources, bases = names(sources$inst_sources)) {
  vs <- Reduce(intersect, lapply(bases, function(b) as.character(sources$inst_sources[[b]]$survey$name)))
  vs <- vs[!is.na(vs) & nzchar(vs)]
  list(filas = lapply(seq_along(vs), function(i) list(id = paste0("heq", i), etiqueta_estandar = "",
                                                      variables = stats::setNames(as.list(rep(vs[i], length(bases))), bases))))
}

#' Las fuentes con la matriz por nombre declarada (para el conteo y las cifras, que la leen de las fuentes)
.heq_con_matriz <- function(sources, equiv = .heq_matriz_por_nombre(sources)) {
  sources["equivalencias_publicos"] <- list(equiv)
  sources
}

#' La matriz en el contexto del informe mientras dura el test (para el render, que la lee de `prosecnur.sig_informe`)
.heq_local_render <- function(equiv, envir = parent.frame()) {
  previa <- options(prosecnur.sig_informe = utils::modifyList(getOption("prosecnur.sig_informe") %||% list(),
                                                              list(equivalencias_publicos = equiv)))
  withr::defer(options(previa), envir = envir)
  invisible(equiv)
}
