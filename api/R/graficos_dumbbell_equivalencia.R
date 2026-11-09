# =============================================================================
# graficos_dumbbell_equivalencia.R — el contraste entre públicos empareja por equivalencia declarada (ADR 0138 §5)
# =============================================================================
#
# Prueba con Arte (2026-11-09): la regla «comunes» del contraste y `bases = c(A, B)` emparejaban las preguntas por
# NOMBRE de variable. En Arte la misma pregunta es `p13_6` en docentes y `p12_3` en estudiantes, y `p24_1` es una
# pregunta distinta en cada base: por nombre, la lámina comparaba preguntas distintas (77 % frente a 77 % bajo un rótulo
# que sólo describía una de las dos).
#
# Regla: `base$*` entre públicos (lo que escriben `bases` y la regla sin `vars`) toma los temas de la equivalencia
# declarada, la misma fuente de las tarjetas entre públicos: las filas confirmadas de la matriz de equivalencias
# (`s$equivalencias_publicos`, sin `sugerida`) con su variable en cada público del contraste. Un par confirmado en
# «Revisar emparejado» llega ya escrito en `vars` como refs explícitas y no pasa por aquí. Sin equivalencia declarada no
# hay temas: la lámina lo dice y no compara.
#
# De dónde sale la matriz: las fuentes del pedido la llevan en `equivalencias_publicos` (conteo y cifras, que tienen
# sesión); el render, del contexto del informe (`prosecnur.sig_informe`), que fijan el worker del export y la vista
# previa con `.sig_arg_job` / `.sig_opciones_preview`.

#' Lo que dice la lámina y el conteo cuando los públicos no tienen equivalencia declarada
#' @keywords internal
.DUMBBELL_MSG_SIN_EQUIV <- "Sin equivalencia declarada entre estos públicos: no se compara."

#' Lo que dicen cuando la matriz declara preguntas pero ninguna se puede comparar (escalas distintas, compuestos, …)
#' @keywords internal
.DUMBBELL_MSG_SIN_COMPARABLES <- "Ninguna pregunta declarada entre estos públicos es comparable: no se compara."

#' Matriz de equivalencias para el contraste: la de las fuentes del pedido o la del contexto del informe
#' @keywords internal
.dumbbell_equivalencias <- function(sources) {
  if (is.list(sources) && "equivalencias_publicos" %in% names(sources)) return(sources$equivalencias_publicos)
  ctx <- getOption("prosecnur.sig_informe", NULL)
  if (is.list(ctx)) ctx$equivalencias_publicos else NULL
}

#' Variable de una fila de la matriz en una base (texto vacío si no la declara)
#' @keywords internal
.dumbbell_equiv_var <- function(fila, base) {
  x <- as.character(unlist((fila$variables %||% list())[[base]] %||% ""))[1]
  if (is.na(x)) "" else trimws(x)
}

#' Temas de `base$*` entre públicos: las filas confirmadas de la matriz con su pregunta de escala en cada público
#'
#' @param fuentes Bases del contraste, en su orden. @param codigos Códigos del indicador (el corte).
#' @param equiv Matriz de equivalencias (`s$equivalencias_publicos`).
#' @return Lista nombrada `tema -> refs` (el tema es la etiqueta estándar de la fila o, sin ella, el rótulo de la
#'   pregunta en el primer público), en el orden de la matriz, con `attr(, "motivos")`: por qué quedó fuera cada fila
#'   que cubre a todos los públicos, y `attr(, "sin_equivalencia")` = TRUE si ninguna fila los cubre.
#' @keywords internal
.regla_preguntas_pares_declarados <- function(fuentes, codigos, sources, equiv = .dumbbell_equivalencias(sources)) {
  vacio <- function(sin_eq, motivos = list()) structure(list(), motivos = motivos, sin_equivalencia = sin_eq)
  vs <- stats::setNames(lapply(fuentes, .regla_preguntas_de_base, codigos = codigos, sources = sources), fuentes)
  if (any(vapply(vs, is.null, TRUE))) return(vacio(FALSE))
  pares <- list(); motivos <- list(); cubre <- 0L
  for (f in (equiv %||% list())$filas %||% list()) {
    if (!is.list(f) || isTRUE(f$sugerida)) next
    x <- vapply(fuentes, function(b) .dumbbell_equiv_var(f, b), "")
    if (any(!nzchar(x))) next   # la fila no declara la pregunta en todos los públicos del contraste
    cubre <- cubre + 1L
    if (any(vapply(fuentes, function(b) !is.null(.equiv_deriv_entrada(f, b)), TRUE))) {
      motivos[[length(motivos) + 1L]] <- "son indicadores compuestos en la matriz"; next
    }
    if (!all(vapply(seq_along(fuentes), function(i) x[[i]] %in% vs[[fuentes[i]]], TRUE))) {
      motivos[[length(motivos) + 1L]] <- "no son de escala con el indicador"; next
    }
    firmas <- vapply(seq_along(fuentes), function(i) .equiv_firma_escala(sources$inst_sources[[fuentes[i]]], x[[i]]) %||% "", "")
    if (length(unique(firmas)) != 1L) { motivos[[length(motivos) + 1L]] <- "tienen escalas distintas entre públicos"; next }
    tema <- trimws(as.character(f$etiqueta_estandar %||% "")[1])
    if (is.na(tema) || !nzchar(tema)) tema <- .regla_preguntas_rotulo(sources$inst_sources[[fuentes[1]]], x[[1]])
    pares[[length(pares) + 1L]] <- list(rotulo = tema, refs = paste0(fuentes, "$", unname(x)))
  }
  if (!length(pares)) return(vacio(cubre == 0L, motivos))
  nm <- make.unique(vapply(pares, `[[`, "", "rotulo"), sep = " ")
  structure(stats::setNames(lapply(pares, `[[`, "refs"), nm), motivos = motivos, sin_equivalencia = FALSE)
}

#' ¿El contraste quedó sin temas que comparar? El motivo para la lámina, o NULL si tiene temas
#'
#' Sólo el contraste entre públicos que arma sus temas con `base$*` (o con `bases`); con refs explícitas o con cruce,
#' NULL. El motivo es `.DUMBBELL_MSG_SIN_EQUIV` si la matriz no cubre a esos públicos y `.DUMBBELL_MSG_SIN_COMPARABLES` si
#' los cubre pero ninguna fila se puede comparar.
#' @keywords internal
.dumbbell_sin_equivalencia <- function(el, sources) {
  if (!identical(as.character(el$.element_type %||% "")[1], "dumbbell") || !is.null(el$cruce)) return(NULL)
  vars <- el$vars
  if (.dumbbell_sin_temas(vars)) vars <- tryCatch(.dumbbell_vars_desde_fuentes(el, sources), error = function(e) NULL)
  if (!length(vars)) return(NULL)
  codigos <- .radar_mb_codigos(el$corte)
  sin_eq <- TRUE
  for (refs in vars) {
    partes <- lapply(as.character(unlist(refs)), .graficos_ref_parts)
    if (!length(partes) || !all(vapply(partes, function(p) identical(p$name, "*"), TRUE))) return(NULL)   # hay temas explícitos
    pd <- .regla_preguntas_pares_declarados(vapply(partes, `[[`, "", "source"), codigos, sources)
    if (length(pd)) return(NULL)
    if (!isTRUE(attr(pd, "sin_equivalencia"))) sin_eq <- FALSE
  }
  if (sin_eq) .DUMBBELL_MSG_SIN_EQUIV else .DUMBBELL_MSG_SIN_COMPARABLES
}

#' La lámina del contraste sin temas comparables: el aviso al analista y el lienzo que lo dice, sin comparar
#' @keywords internal
.dumbbell_lamina_sin_equivalencia <- function(motivo = .DUMBBELL_MSG_SIN_EQUIV) {
  .pulso_aviso(.aviso_en_lamina(paste(motivo, "Declara las preguntas equivalentes en la matriz de equivalencias",
                                      "o confirma el emparejado; el nombre de la variable no basta.")))
  .plan_canvas_sin_datos(motivo)
}

#' La regla de un contraste sin equivalencia declarada: ninguna pregunta, el aviso como nota y sin evaluar
#'
#' `.regla_preguntas_evaluar` exige dos públicos con datos y respondería «la lámina no tiene públicos»; la causa real es
#' que nada los empareja, y eso es lo que se dice.
#' @keywords internal
.regla_preguntas_sin_equivalencia <- function(ind, regla) {
  cand <- data.frame(tema = character(0), etiqueta = character(0), metrica = numeric(0), seleccionada = logical(0),
                     stringsAsFactors = FALSE)
  ev <- list(temas = character(0), total = 0L, metrica = numeric(0), texto = ind$sin_temas_texto %||% .DUMBBELL_MSG_SIN_EQUIV, candidatas = cand,
             avisos = character(0), universo = ind$universo, regla = regla)
  list(evaluacion = ev, vars = list(), avisos = unique(ind$avisos), indicadores = ind$indicadores, firma_leyenda = NULL,
       motivos_imagen = NULL, sin_equivalencia = ev$texto)
}
