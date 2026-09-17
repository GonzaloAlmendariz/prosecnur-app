# monitoreo_aulas_padron_purga.R — cómo desaparece el padrón, y qué deja.
#
# El padrón es la única clave del proyecto que guarda códigos de alumno reales.
# Eso revierte el F114 en su alcance, y la contrapartida de esa reversión es
# esta: el padrón **se puede purgar a mano** cuando el campo cierra, y **se
# purga solo** en toda copia que sale del equipo.
#
# **Por qué la purga tiene que ser explícita.** El anonimizador de proyectos
# recorre `data.frame`s (`.pulso_anon_walk_dataframes`) y el padrón es una lista
# de listas: pasaría de largo sin tocarlo. Y `.pulso_strip_caches()` tampoco
# sirve, porque ése corre en el guardado normal y ahí el padrón SÍ debe
# sobrevivir. Así que la purga se engancha donde vive la sanitización de salida,
# y el detector de PII la vigila: sin el detector la purga es una intención, con
# él es un gate.
#
# **Qué deja al purgar.** Los conteos, sin códigos. Y hay que decir en voz alta
# lo que eso cuesta: sin padrón, una respuesta nueva no resuelve a ningún nivel,
# así que el avance por eje **no se puede continuar**. Purgar es cerrar la
# medición por ese eje, no bajarle la resolución. Por eso el corte se publica
# declarado como congelado, con su fecha y su motivo, y no disfrazado de cifra
# viva.

.MAPP_SCHEMA <- "monitoreo_aulas_padron_corte_v1"

#' El corte congelado que queda cuando el padrón se purga.
#'
#' Conteos y fechas, sin un solo código. Es lo que el avance publica cuando ya
#' no hay padrón con el que resolver.
#'
#' @param padron el padrón que se está purgando.
#' @param motivo por qué se purga (texto libre; los dos casos previstos son
#'   `"purga manual"` y `"purga al exportar"`).
#' @param diagnostico último diagnóstico del cruce, si se tiene
#'   ([monitoreo_aulas_nivel_diagnostico()]).
#' @return lista `monitoreo_aulas_padron_corte_v1`.
#' @export
monitoreo_aulas_padron_corte <- function(padron = list(), motivo = "",
                                         diagnostico = NULL) {
  resumen <- monitoreo_aulas_padron_resumen(padron)
  list(
    schema = .MAPP_SCHEMA,
    corte_iso = .monitoreo_now_iso(),
    motivo = .monitoreo_scalar(motivo, ""),
    # La vigencia del padrón que se va: sin ella, el corte no dice de qué
    # extracción salían sus cifras.
    vigencia = .monitoreo_scalar(if (is.list(padron)) padron[["vigencia"]] else "", ""),
    poblacion = resumen,
    # El último corte medido del cruce, si lo hay. Puede faltar —se purga un
    # padrón que nunca llegó a cruzarse— y entonces el corte dice sólo cuál era
    # la población.
    ultimo_diagnostico = if (is.list(diagnostico)) diagnostico else NULL
  )
}

#' Purga el padrón del estado, dejando su corte.
#'
#' Opera sobre una lista de estado (la del `.pulso` o la de la sesión) y
#' devuelve la misma lista sin el padrón y con su corte puesto. Idempotente: un
#' estado sin padrón se devuelve tal cual, sin sobrescribir un corte anterior
#' con uno vacío.
#'
#' @param estado lista de estado.
#' @param motivo por qué se purga.
#' @param diagnostico último diagnóstico del cruce, si se tiene.
#' @return lista con `estado` y `purgado` (lógico).
#' @export
monitoreo_aulas_padron_purgar <- function(estado = list(), motivo = "",
                                          diagnostico = NULL) {
  if (!is.list(estado)) return(list(estado = estado, purgado = FALSE))
  padron <- estado[["monitoreo_aulas_padron"]]
  tiene <- is.list(padron) && length(padron[["filas"]] %||% list())
  if (!tiene) {
    # Sin padrón no hay nada que purgar, y NO se pisa un corte anterior: un
    # corte vacío borraría la única cifra que quedaba de la medición.
    estado[["monitoreo_aulas_padron"]] <- NULL
    return(list(estado = estado, purgado = FALSE))
  }
  estado[["monitoreo_aulas_padron_corte"]] <-
    monitoreo_aulas_padron_corte(padron, motivo, diagnostico)
  estado[["monitoreo_aulas_padron"]] <- NULL
  list(estado = estado, purgado = TRUE)
}

#' ¿Este estado lleva un padrón con códigos dentro?
#'
#' La usa el detector de PII de proyectos. Es lo que convierte la purga en un
#' gate: si una copia sale con padrón, `pulso_detectar_pii()` lo dice y
#' `make reference-project-verify` se pone rojo.
#'
#' @param estado lista de estado.
#' @return `NULL` si no hay padrón; si lo hay, una lista con su tamaño y un
#'   ejemplo **truncado** del código (los cuatro primeros caracteres), que es lo
#'   suficiente para reconocer el formato y no para identificar a nadie.
#' @export
monitoreo_aulas_padron_hallazgo_pii <- function(estado = list()) {
  if (!is.list(estado)) return(NULL)
  padron <- estado[["monitoreo_aulas_padron"]]
  filas <- if (is.list(padron)) padron[["filas"]] %||% list() else list()
  if (!length(filas)) return(NULL)
  codigos <- vapply(filas, function(f) as.character(f[["codigo"]] %||% ""), character(1))
  codigos <- codigos[nzchar(codigos)]
  if (!length(codigos)) return(NULL)
  list(
    clave = "monitoreo_aulas_padron",
    tipo = "documento",
    personas = length(codigos),
    # Truncado a cuatro: identifica el FORMATO del código, no a la persona. El
    # detector existe para avisar de que hay PII, no para mostrarla.
    ejemplo = paste0(substr(codigos[[1]], 1, 4), "…")
  )
}
