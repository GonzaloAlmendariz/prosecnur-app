# =============================================================================
# graficos_base_elegible.R — cada gráfico se denomina sobre quien pudo responder
# =============================================================================
#
# El pie decía "N = 4 de 101 (4.0%)" para "¿En qué sector trabajaba antes del
# programa?". Los 4 eran ciertos; el 101 no. PDM MedVida 2026 tiene un solo
# formulario con dos rutas —Homologación Laboral (85) y Vinculación Laboral
# (16)— y esa pregunta solo se le hace a la segunda, y dentro de ella solo a
# quien trabajaba antes. 107 de las 112 variables graficadas pertenecen a UNA
# ruta y todas se denominaban sobre la muestra entera.
#
# El instrumento ya lo dice: el `relevant` acumulado de la pregunta es
# `${Consent}='Yes' and ${proyecto_ppl}='Vinculación Laboral' AND ${PastWorking}
# ='1' or ...`. Y Prosecnur ya sabe leerlo y evaluarlo —Validación deriva de ahí
# sus 265 reglas `skip`—, con `build_group_gate_map()`, `odk_parse_to_ast()` y
# `ast_to_r()`. Gráficos no lo consultaba: ponía `total <- nrow(data)` y
# calculaba un `eligible_known` que no usaba nadie.
#
# Aquí se cierra ese hueco. Ver
# `docs/qa/checklist-acnur-v3-preguntas-ausentes-2026-08-19.md`.

#' Gate acumulativo (relevant propio + el de sus grupos) por variable.
#' @keywords internal
.graficos_gate_map <- function(inst) {
  survey <- (inst %||% list())$survey %||% NULL
  if (!is.data.frame(survey) || !nrow(survey)) return(list())
  if (!exists("build_group_gate_map", mode = "function")) return(list())
  gm <- tryCatch(build_group_gate_map(survey, return_mode = "full")$entries,
                 error = function(e) NULL)
  if (!length(gm)) return(list())
  nombres <- vapply(gm, function(e) .graficos_scalar_chr((e %||% list())$name, ""), character(1))
  gm <- gm[nzchar(nombres)]
  nombres <- nombres[nzchar(nombres)]
  # El relevant PROPIO no viaja en el gate de grupo; se anexa aqui para que el
  # universo sea el real (`sector` = ruta de Vinculacion Y trabajaba antes).
  rel <- if ("relevant" %in% names(survey)) as.character(survey$relevant) else rep("", nrow(survey))
  nm_survey <- if ("name" %in% names(survey)) as.character(survey$name) else rep("", nrow(survey))
  gm <- lapply(seq_along(gm), function(i) {
    e <- gm[[i]]
    j <- which(nm_survey == nombres[[i]])[1]
    e$own_relevant <- if (!is.na(j)) .graficos_scalar_chr(rel[[j]], "") else ""
    e
  })
  stats::setNames(gm, nombres)
}

.graficos_gate_para <- function(gate_map, var) {
  if (!length(gate_map) || !nzchar(var)) return(NULL)
  gate_map[[var]] %||% NULL
}

#' Entorno de evaluacion con las primitivas del compilador a mano.
#'
#' `ast_to_r()` emite `get('.vd_cmp_const_eq', envir = globalenv())`. Bajo
#' `pkgload::load_all()` esa funcion vive en el global; en el paquete instalado
#' no tiene por que. Se inyecta desde el namespace para que la evaluacion se
#' comporte igual en los dos modos —y en el worker `callr`, que corre contra el
#' paquete instalado.
#' @keywords internal
.graficos_eval_env <- function(data, inst = NULL) {
  env <- new.env(parent = globalenv())
  for (nm in names(data)) assign(nm, data[[nm]], envir = env)
  assign(".__eval_data__", data, envir = env)
  assign(".__choices_map__", list(), envir = env)
  ns <- tryCatch(asNamespace("prosecnurapp"), error = function(e) NULL)
  if (!is.null(ns)) {
    for (fn in c(".vd_cmp_const_eq", ".vd_odk_number", ".vd_odk_int")) {
      if (exists(fn, envir = ns, inherits = FALSE)) {
        assign(fn, get(fn, envir = ns), envir = globalenv())
      }
    }
  }
  env
}

#' Máscara de casos que DEBÍAN responder la variable.
#'
#' Devuelve `NULL` cuando no se puede afirmar el universo —sin gate, sin
#' parser, expresión que el AST no cubre o variable ausente de la data—. En ese
#' caso el llamador conserva el comportamiento anterior: mejor un denominador
#' viejo que uno inventado.
#' @keywords internal
.graficos_mascara_de_ast <- function(ast, env, n) {
  if (is.null(ast) || !exists("ast_to_r", mode = "function")) return(NULL)
  code <- tryCatch(as.character(ast_to_r(ast))[1], error = function(e) NULL)
  if (is.null(code) || is.na(code) || !nzchar(code)) return(NULL)
  mask <- tryCatch(eval(parse(text = code), envir = env),
                   error = function(e) NULL, warning = function(w) NULL)
  if (is.null(mask) || !is.logical(mask) || length(mask) != n) return(NULL)
  mask[is.na(mask)] <- FALSE
  mask
}

.graficos_mascara_elegible <- function(data, gate_entry, env = NULL) {
  if (!is.data.frame(data) || !nrow(data)) return(NULL)
  gate <- (gate_entry %||% list())$gate %||% NULL
  own <- .graficos_scalar_chr((gate_entry %||% list())$own_relevant, "")
  if (is.null(gate) && !nzchar(own)) return(NULL)
  env <- env %||% .graficos_eval_env(data)
  n <- nrow(data)

  mask <- if (!is.null(gate)) .graficos_mascara_de_ast(gate, env, n) else rep(TRUE, n)
  if (is.null(mask)) return(NULL)

  if (nzchar(own) && exists("odk_parse_to_ast", mode = "function")) {
    # `odk_parse_to_ast()` devuelve {ast, degraded_to_raw, ...}. Una expresion
    # degradada a `ast_odk_raw` no se evalua: el parser no la entendio y una
    # mascara inventada es peor que ninguna.
    parsed <- tryCatch(odk_parse_to_ast(own, context = "relevant"), error = function(e) NULL)
    ast_own <- if (!is.null(parsed) && !isTRUE(parsed$degraded_to_raw)) parsed$ast else NULL
    m2 <- .graficos_mascara_de_ast(ast_own, env, n)
    # Un `relevant` propio que el AST no cubre no invalida el universo del
    # grupo: se conserva el del publico, que ya es mucho mejor que nrow(data).
    if (!is.null(m2)) mask <- mask & m2
  }
  mask
}

#' El público al que pertenece la pregunta, leído de su gate de GRUPO.
#'
#' Solo cuentan las igualdades contra literal del gate heredado —la ruta del
#' estudio vive ahí, no en el `relevant` propio de la pregunta— y se descartan
#' las de control operativo (`Consent`), que no describen un público sino un
#' requisito de participación.
#' @keywords internal
.graficos_publico_de_gate <- function(gate_entry, inst = NULL) {
  gate <- (gate_entry %||% list())$gate %||% NULL
  if (is.null(gate)) return("")
  raw <- tryCatch(as.character(ast_to_r(gate))[1], error = function(e) "")
  if (is.na(raw) || !nzchar(raw)) return("")
  # El codigo compilado trae `.vd_cmp_const_eq('VAR', VAR, '==', 'valor', ...)`.
  pares <- regmatches(raw, gregexpr("'[^']+',\\s*[^,]+,\\s*'=='\\s*,\\s*'[^']*'", raw, perl = TRUE))[[1]]
  if (!length(pares)) return("")
  valores <- character(0)
  for (p in pares) {
    trozos <- regmatches(p, gregexpr("'[^']*'", p))[[1]]
    if (length(trozos) < 3L) next
    var <- gsub("'", "", trozos[[1]])
    val <- gsub("'", "", trozos[[length(trozos)]])
    if (!nzchar(val)) next
    if (.graficos_is_operational_metadata(var, "")) next
    valores <- c(valores, val)
  }
  valores <- unique(valores[nzchar(valores)])
  if (!length(valores)) return("")
  paste(valores, collapse = " · ")
}

#' Redacción del pie.
#'
#' El porcentaje ahora es tasa de respuesta ENTRE ELEGIBLES, que informa; el
#' anterior era la fracción de la muestra total, que engañaba. Cuando todos los
#' elegibles respondieron no se escribe: un "(100%)" solo agrega ruido.
#' @keywords internal
.graficos_base_texto_elegible <- function(n, elegibles, publico = "", total = NULL) {
  n <- as.integer(n %||% 0L)
  fmt <- function(x) format(as.integer(x), big.mark = " ", trim = TRUE)

  if (is.null(elegibles) || !is.finite(elegibles) || elegibles <= 0L) {
    if (is.null(total) || !is.finite(total) || total <= 0L) return(sprintf("Base: %s", fmt(n)))
    return(sprintf("Base: %s respuestas, toda la muestra", fmt(n)))
  }
  elegibles <- as.integer(elegibles)
  de_quien <- if (nzchar(publico)) sprintf(" de %s", publico) else ""

  if (n >= elegibles) {
    return(sprintf("Base: %s respuestas%s", fmt(n), de_quien))
  }
  sprintf("Base: %s de %s elegibles%s (%s%%)",
          fmt(n), fmt(elegibles), de_quien,
          format(round(100 * n / elegibles, 1), trim = TRUE))
}

#' Denominador de una variable: elegibles, público y texto listo.
#' @keywords internal
.graficos_base_de_variable <- function(data, inst, var, n_respuestas, gate_map = NULL) {
  total <- if (is.data.frame(data)) nrow(data) else NA_integer_
  gate_map <- gate_map %||% .graficos_gate_map(inst)
  entry <- .graficos_gate_para(gate_map, var)
  mask <- .graficos_mascara_elegible(data, entry)

  if (is.null(mask)) {
    return(list(elegibles = NA_integer_, publico = "", derivado = FALSE,
                texto = .graficos_base_texto_elegible(n_respuestas, NULL, "", total)))
  }
  elegibles <- sum(mask)
  publico <- .graficos_publico_de_gate(entry, inst)
  list(
    elegibles = as.integer(elegibles),
    publico = publico,
    derivado = TRUE,
    texto = .graficos_base_texto_elegible(n_respuestas, elegibles, publico, total)
  )
}
