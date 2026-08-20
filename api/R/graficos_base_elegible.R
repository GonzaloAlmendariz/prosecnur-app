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
#' Formato único, sin prefijo: `<n> respuestas de <público> (<pct>%)`. Una sola
#' forma para todas las láminas —que unas traigan porcentaje y otras no obliga
#' al lector a preguntarse por qué—.
#'
#' El porcentaje es **tasa de respuesta entre elegibles**, no fracción de la
#' muestra: quién pudo responder sale del `relevant` del instrumento. El
#' anterior, «4 de 101 (4.0%)», medía contra un universo que nunca vio esa
#' pregunta.
#' @keywords internal
.graficos_base_texto_elegible <- function(n, elegibles, publico = "", total = NULL,
                                          universo_label = "la muestra total") {
  n <- as.integer(n %||% 0L)
  fmt <- function(x) format(as.integer(x), big.mark = " ", trim = TRUE)
  unidad <- if (n == 1L) "respuesta" else "respuestas"
  pct <- function(a, b) {
    v <- if (is.finite(b) && b > 0) 100 * a / b else NA_real_
    format(round(v, 1), trim = TRUE)
  }

  # Sin universo derivable no se inventa un denominador ni un porcentaje.
  if (is.null(elegibles) || !length(elegibles) || is.na(elegibles) ||
      !is.finite(elegibles) || elegibles <= 0L) {
    return(sprintf("%s %s", fmt(n), unidad))
  }
  elegibles <- as.integer(elegibles)

  etiqueta <- if (nzchar(publico)) publico else .graficos_scalar_chr(universo_label, "")
  if (!nzchar(etiqueta)) {
    # Repeats: el universo son instancias del propio grupo, no personas de la
    # muestra; nombrarlo "muestra total" mezclaría dos granos.
    return(sprintf("%s %s (%s%%)", fmt(n), unidad, pct(n, elegibles)))
  }
  sprintf("%s %s de %s (%s%%)", fmt(n), unidad, etiqueta, pct(n, elegibles))
}

#' Denominador de una variable: universo, público y texto listo.
#'
#' **El porcentaje se calcula sobre el universo que se nombra.** El pie decía
#' «15 respuestas de Vinculación Laboral (100%)» para una pregunta que solo ven
#' quienes entraron al grupo de WhatsApp: 15 de 15 elegibles es 100%, pero el
#' texto nombra a Vinculación Laboral, que son 16, y 15 de 16 no es 100%. El
#' lector no puede verificar un pie que mide contra un universo distinto del que
#' declara.
#'
#' Así que el denominador es el del público nombrado. En una pregunta con filtro
#' interno el porcentaje deja de ser tasa de no-respuesta y pasa a ser la
#' fracción del público que llegó a la pregunta —«4 respuestas de Vinculación
#' Laboral (25%)»: de las 16, cuatro trabajaban antes del programa—. Es lo que
#' el lector puede comprobar con los dos números que tiene delante.
#' @keywords internal
.graficos_base_de_variable <- function(data, inst, var, n_respuestas, gate_map = NULL) {
  total <- if (is.data.frame(data)) nrow(data) else NA_integer_
  gate_map <- gate_map %||% .graficos_gate_map(inst)
  entry <- .graficos_gate_para(gate_map, var)
  publico <- .graficos_publico_de_gate(entry, inst)

  universo <- NULL
  if (nzchar(publico)) {
    # El universo del público es el gate de GRUPO, sin el relevant propio de la
    # pregunta: ese restringe dentro del público, no lo redefine.
    env <- .graficos_eval_env(data)
    mask <- .graficos_mascara_de_ast((entry %||% list())$gate, env, nrow(data))
    if (!is.null(mask)) universo <- sum(mask) else publico <- ""
  }
  if (is.null(universo) && is.finite(total) && total > 0L) universo <- as.integer(total)

  list(
    elegibles = if (is.null(universo)) NA_integer_ else as.integer(universo),
    publico = publico,
    derivado = !is.null(universo),
    texto = .graficos_base_texto_elegible(n_respuestas, universo, publico, total)
  )
}
