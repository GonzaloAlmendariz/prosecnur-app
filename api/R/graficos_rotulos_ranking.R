# =============================================================================
# graficos_rotulos_ranking.R — ranking de rótulos largos para los nombres cortos del mazo (ADR 0141, ROT-2)
# =============================================================================
#
# Sólo lectura. Por base: las preguntas y las opciones de respuesta ordenadas del rótulo más largo al más corto, con el
# nombre corto que el analista guardó en `plan$rotulos_cortos` (graficos_rotulos_cortos_plan.R). Nada se acorta solo.
#
# `usos` cuenta láminas del plan: en cuántas aparece la pregunta (por sus refs declaradas) o alguna pregunta cuya lista
# trae esa opción. Una lámina con comodín (`base$*`) no suma: no declara preguntas una por una.

#' Refs declaradas por cada lámina del plan (una entrada por lámina)
#' @keywords internal
.rotulos_refs_por_lamina <- function(plan) {
  slides <- .normalize_plan(plan)$slides %||% list()
  lapply(slides, function(slide) {
    payload <- .as_json_list((slide %||% list())$payload) %||% list()
    refs <- unlist(lapply(payload, function(value) {
      graf <- .as_json_list(value)
      if (!is.list(graf) || is.null(graf$graficador)) return(character(0))
      .graficos_collect_refs_from_args(graf$args %||% list())
    }), use.names = FALSE)
    unique(refs[nzchar(refs) & !grepl("(^|\\$)\\*$", refs)])
  })
}

#' En cuántas láminas aparece alguna de las variables `vars` de la base `base`
#' @keywords internal
.rotulos_usos <- function(refs_laminas, base, vars) {
  sum(vapply(refs_laminas, function(refs) {
    if (!length(refs)) return(FALSE)
    p <- lapply(refs, .graficos_ref_parts)
    any(vapply(p, function(x) x$name %in% vars && (!nzchar(x$source %||% "") || identical(x$source, base)), logical(1)))
  }, logical(1)))
}

#' Ordena filas del rótulo más largo al más corto (empate: por ref y código)
#' @keywords internal
.rotulos_ordenar <- function(filas) {
  if (!length(filas)) return(list())
  largo <- vapply(filas, function(f) as.integer(f$largo), integer(1))
  clave <- vapply(filas, function(f) paste(f$ref, f$codigo %||% ""), "")
  filas[order(-largo, clave, method = "radix")]
}

#' Ranking de rótulos de Gráficos
#'
#' @param sources `sources` de `.graficos_variables_sources_payload`: por base, `variables` con `name`, `label`,
#'   `list_name` y `choices` (`name`, `label`).
#' @param plan Plan de Gráficos (con `rotulos_cortos`).
#' @return `list(ok, scope, bases = [{base, preguntas, opciones}])`.
#' @keywords internal
.graficos_rotulos_ranking <- function(sources, plan) {
  plan <- plan %||% list(slides = list())
  rc <- plan$rotulos_cortos
  cortos_preg <- .rotulos_cortos_preguntas(rc)
  cortos_opc <- .rotulos_cortos_opciones(rc)
  e4 <- tryCatch(.plan_nombres_cortos(plan), error = function(e) list())
  refs_laminas <- .rotulos_refs_por_lamina(plan)
  bases <- lapply(sources %||% list(), function(src) {
    base <- .graficos_scalar_chr(src$name, "default")
    vars <- src$variables %||% list()
    preguntas <- list()
    opciones <- list()   # por rótulo: una fila aunque la opción se repita en varias listas
    for (v in vars) {
      nm <- .graficos_scalar_chr(v$name, "")
      lab <- trimws(.graficos_scalar_chr(v$label, ""))
      if (!nzchar(nm)) next
      ref <- paste0(base, "$", nm)
      if (nzchar(lab) && !identical(lab, nm)) {
        fila <- list(ref = ref, etiqueta = lab, largo = nchar(lab), usos = .rotulos_usos(refs_laminas, base, nm))
        corto <- .rotulo_corto_buscar(cortos_preg, ref)
        if (!is.null(corto)) fila$corto <- corto
        de_grafico <- .rotulo_corto_buscar(e4, ref)
        if (!is.null(de_grafico)) fila$corto_en_grafico <- de_grafico
        preguntas[[length(preguntas) + 1L]] <- fila
      }
      for (ch in v$choices %||% list()) {
        et <- trimws(.graficos_scalar_chr(ch$label, ""))
        if (!nzchar(et)) next
        if (is.null(opciones[[et]])) {
          opciones[[et]] <- list(ref = paste0(base, "$", .graficos_scalar_chr(v$list_name, nm)),
                                 codigo = .graficos_scalar_chr(ch$name, ""), etiqueta = et, largo = nchar(et), vars = nm)
        } else {
          opciones[[et]]$vars <- unique(c(opciones[[et]]$vars, nm))
        }
      }
    }
    opciones <- lapply(unname(opciones), function(o) {
      i <- match(c(o$etiqueta, .inclusivo_parentesis(o$etiqueta)), names(cortos_opc))
      corto <- if (any(!is.na(i))) cortos_opc[[i[!is.na(i)][1]]] else NULL
      out <- list(ref = o$ref, codigo = o$codigo, etiqueta = o$etiqueta, largo = o$largo,
                  usos = .rotulos_usos(refs_laminas, base, o$vars))
      if (!is.null(corto) && nzchar(corto)) out$corto <- unname(corto)
      out
    })
    list(base = base, preguntas = .rotulos_ordenar(preguntas), opciones = .rotulos_ordenar(opciones))
  })
  list(ok = TRUE, scope = "graficos", bases = bases)
}

#' Scope del ranking: sólo `graficos` (o vacío). Analítica tiene su propia revisión de etiquetas (ADR 0141).
#' @keywords internal
.graficos_rotulos_scope <- function(query) {
  scope <- tolower(trimws(as.character((query %||% list())$scope %||% "")[1]))
  if (is.na(scope) || !nzchar(scope)) scope <- "graficos"
  if (!identical(scope, "graficos")) {
    stop_api(400, "E_GRAFICOS_ROTULOS_SCOPE",
             "El ranking de rótulos cortos es de Gráficos: scope debe ser `graficos`.", list(scope = scope))
  }
  scope
}

#' Enunciado de una ref `base$var` en las fuentes (NA si no existe); una ref suelta vale en un estudio de una base
#' @keywords internal
.rotulos_enunciado_de <- function(sources) {
  function(ref) {
    p <- .graficos_ref_parts(ref)
    cand <- Filter(function(s) {
      b <- .graficos_scalar_chr(s$name, "default")
      if (nzchar(p$source %||% "")) identical(b, p$source) else length(sources) == 1L
    }, sources %||% list())
    for (s in cand) for (v in s$variables %||% list()) {
      if (identical(.graficos_scalar_chr(v$name, ""), p$name)) {
        lab <- trimws(.graficos_scalar_chr(v$label, ""))
        return(if (nzchar(lab)) lab else p$name)
      }
    }
    NA_character_
  }
}
