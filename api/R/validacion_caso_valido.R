# =============================================================================
# Criterio de caso válido
# =============================================================================
# Qué hace que un caso cuente. En la práctica todo estudio ya lo tiene —
# consentimiento, entrevista real y no prueba, titular disponible— pero escrito
# dentro del `relevant` de cada pregunta. En un estudio real medido, una misma
# variable de consentimiento aparecía en el gate de 403 de 425 reglas.
#
# La consecuencia de que esté disperso: la app hereda el criterio y nunca lo
# sabe. No puede decir cuál es el universo analizable porque nadie se lo
# declaró, y un caso que no debía contar —una prueba que quedó en la base—
# genera inconsistencias que nadie va a corregir.
#
# Nada acá nombra una variable de un proyecto. El criterio se declara en
# `operational_config$caso_valido` y el sugeridor lo descubre midiendo.
# =============================================================================

# Un gate que gobierna casi todas las reglas del instrumento ES el criterio de
# validez del estudio, escrito por quien armó el formulario. Se propone a partir
# de esa proporción y no de una lista de nombres conocidos.
.CASO_VALIDO_UMBRAL_GATE <- 0.80

.cv_valores_utiles <- function(x) {
  v <- trimws(as.character(x))
  v[!is.na(v) & nzchar(v) & v != "NA"]
}

#' Sugerir el criterio de caso válido a partir de los gates del instrumento
#'
#' Recorre `variable_roles$gate` de las reglas evaluadas y propone como criterio
#' las variables que gobiernan una proporción dominante de ellas. Para cada una
#' propone el valor que concentra los casos: si el 100 % de la base tiene el
#' mismo valor en la variable que gobierna 403 reglas, ese valor es la condición
#' que el estudio ya venía aplicando sin declararla.
#'
#' @param resumen `evaluacion$resumen`, con la columna `variable_roles`.
#' @param data data.frame de la base.
#' @param umbral proporción mínima de reglas gobernadas para proponer.
#' @return lista de condiciones candidatas con su evidencia.
#' @family validacion
#' @export
caso_valido_candidatas <- function(resumen, data, umbral = .CASO_VALIDO_UMBRAL_GATE) {
  if (!is.data.frame(resumen) || !nrow(resumen)) return(list())
  if (!("variable_roles" %in% names(resumen))) return(list())
  if (!is.data.frame(data) || !nrow(data)) return(list())

  gates <- unlist(lapply(resumen$variable_roles, function(r) {
    as.character(unlist((r %||% list())$gate %||% list()))
  }), use.names = FALSE)
  if (!length(gates)) return(list())

  frec <- table(gates[!is.na(gates) & nzchar(gates)])
  n_reglas <- nrow(resumen)
  dominantes <- names(frec)[as.integer(frec) / n_reglas >= umbral]
  dominantes <- intersect(dominantes, names(data))
  if (!length(dominantes)) return(list())

  out <- list()
  for (v in dominantes) {
    vals <- .cv_valores_utiles(data[[v]])
    if (!length(vals)) next
    t <- sort(table(vals), decreasing = TRUE)
    dominante <- names(t)[1]
    cobertura <- as.integer(t[1]) / length(vals)
    # Si el valor dominante no concentra la base, la variable gobierna las
    # reglas pero no separa universo: proponerla como criterio dejaría fuera a
    # una parte grande del estudio sin que nadie lo haya decidido.
    if (cobertura <= 0.5) next
    excluiria <- length(vals) - as.integer(t[1])
    out[[length(out) + 1L]] <- list(
      variable = v,
      operador = "==",
      valores = list(dominante),
      n_reglas_gobernadas = as.integer(frec[[v]]),
      n_reglas_total = as.integer(n_reglas),
      n_casos_cumplen = as.integer(t[1]),
      n_casos = length(vals),
      n_casos_excluiria = as.integer(excluiria),
      # Una variable de ruta o estrato también gobierna casi todas las reglas
      # —las preguntas son específicas de cada rama— y no es un criterio de
      # validez: adoptarla dejaría fuera a media muestra perfectamente buena.
      # No se puede distinguir por su semántica sin nombrarla, pero sí por su
      # efecto: se mide cuántos casos sacaría y se advierte.
      probable_rama = excluiria > 0L,
      porque = sprintf(
        paste("Gobierna %d de las %d reglas del instrumento: quien armó el formulario",
              "ya la usaba como condición para que una pregunta aplique.",
              "%d de %d casos tienen «%s»%s"),
        as.integer(frec[[v]]), n_reglas, as.integer(t[1]), length(vals), dominante,
        if (excluiria > 0L) sprintf(
          paste(" — adoptarla dejaría fuera a %d. Revisa que sea un criterio de validez",
                "y no una ruta del estudio: las preguntas de cada rama también",
                "dependen de su variable de ruta."), excluiria) else "."
      )
    )
  }
  # Primero las que no sacan a nadie: son las que con más probabilidad son un
  # criterio de validez y no una partición del estudio.
  out[order(vapply(out, function(x) x$n_casos_excluiria, numeric(1)),
            -vapply(out, function(x) x$n_reglas_gobernadas, numeric(1)))]
}

#' Marcar qué casos cumplen el criterio declarado
#'
#' Todas las condiciones deben cumplirse: un caso es válido si pasa cada una.
#' Sin criterio declarado devuelve todo TRUE — la base entera es el universo,
#' que es exactamente lo que pasaba antes de que esto existiera.
#'
#' @param data data.frame de la base.
#' @param config `operational_config` normalizado.
#' @return vector lógico del largo de la base.
#' @family validacion
#' @export
caso_valido_marcar <- function(data, config = NULL) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  if (!n) return(logical(0))
  cv <- config$caso_valido %||% list()
  if (!isTRUE(cv$enabled) || !length(cv$condiciones %||% list())) return(rep(TRUE, n))

  ok <- rep(TRUE, n)
  for (c1 in cv$condiciones) {
    v <- as.character(c1$variable)[1]
    if (!(v %in% names(data))) next          # variable ausente: no descarta
    x <- trimws(as.character(data[[v]]))
    vals <- as.character(unlist(c1$valores))
    cumple <- switch(as.character(c1$operador)[1],
      "=="     = x %in% vals[1],
      "!="     = !(x %in% vals[1]),
      "in"     = x %in% vals,
      "not_in" = !(x %in% vals),
      rep(TRUE, n)
    )
    cumple[is.na(cumple)] <- FALSE
    ok <- ok & cumple
  }
  ok
}

#' Resumen del universo analizable
#'
#' @param data data.frame de la base.
#' @param config `operational_config` normalizado.
#' @return lista con `declarado`, `n_total`, `n_validos` y `n_excluidos`.
#' @family validacion
#' @export
caso_valido_resumen <- function(data, config = NULL) {
  n <- if (is.data.frame(data)) nrow(data) else 0L
  ok <- caso_valido_marcar(data, config)
  list(
    declarado = isTRUE((config$caso_valido %||% list())$enabled),
    n_total = as.integer(n),
    n_validos = as.integer(sum(ok)),
    n_excluidos = as.integer(n - sum(ok))
  )
}

#' Excluir de la evaluación los casos que no cumplen el criterio
#'
#' Un caso que el estudio no cuenta no debe generar inconsistencias: si una
#' prueba quedó en la base, sus saltos violados son ruido que nadie va a
#' corregir, y peor, inflan el contador que gobierna el gate de avance.
#'
#' Sigue el mismo contrato que `.validation_filter_sm_partial_rows()`: devuelve
#' la data filtrada y un `filter` con la traza, para que la exclusión quede
#' declarada y no sea una pérdida silenciosa de filas.
#'
#' Salvaguarda: si el criterio dejaría la base en cero, **no se aplica**. Un
#' criterio que descarta todo casi siempre es una variable mal declarada, y
#' evaluar cero filas no le sirve a nadie — es preferible evaluar de más y que
#' se vea, a devolver una base vacía sin explicación.
#'
#' @param df data.frame de la base.
#' @param config `operational_config` normalizado.
#' @return lista con `data` y `filter`.
#' @family validacion
#' @export
caso_valido_filtrar_evaluacion <- function(df, config = NULL) {
  if (!is.data.frame(df) || !nrow(df)) return(list(data = df, filter = NULL))
  cv <- config$caso_valido %||% list()
  if (!isTRUE(cv$enabled) || !length(cv$condiciones %||% list())) {
    return(list(data = df, filter = NULL))
  }

  ok <- caso_valido_marcar(df, config)
  info <- list(
    kind = "caso_valido_declarado",
    applied = FALSE,
    original_rows = as.integer(nrow(df)),
    kept_rows = as.integer(nrow(df)),
    excluded_rows = 0L,
    condiciones = lapply(cv$condiciones, function(c1) {
      list(variable = c1$variable, operador = c1$operador,
           valores = as.list(as.character(unlist(c1$valores))))
    })
  )
  n_ok <- sum(ok)
  if (n_ok == nrow(df)) return(list(data = df, filter = info))
  if (n_ok == 0L) {
    info$motivo_no_aplicado <- "el criterio declarado dejaría la base sin casos"
    return(list(data = df, filter = info))
  }

  out <- df[ok, , drop = FALSE]
  info$applied <- TRUE
  info$kept_rows <- as.integer(nrow(out))
  info$excluded_rows <- as.integer(nrow(df) - nrow(out))
  list(data = out, filter = info)
}
