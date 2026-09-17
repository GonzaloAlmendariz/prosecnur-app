# monitoreo_aulas_nivel.R — el nivel de una RESPUESTA, resuelto por su persona.
#
# **El cambio de modelo que esto trae, dicho en voz alta.** El ADR 0079 dejó
# escrito como supuesto que «la atribución es por aula del plan y no por
# auto-reporte». Con el eje de cuotas en «nivel» eso deja de valer: el numerador
# de una celda ya no es «respuestas atribuidas a aulas del eje X», es
# «respuestas cuya PERSONA resuelve al nivel Y». Una persona tiene un solo
# nivel, y el aula donde respondió no lo determina.
#
# Lo que NO cambia: el paso del aula. Se conserva íntegro y va PRIMERO, así que
# `huerfanas` y `fuera_universo` siguen siendo hechos del aula y no cambian de
# significado. El orden es normativo:
#
#   1. exclusiones del AULA   (¿tiene fila del plan? ¿está en el universo?)
#   2. asignación por PERSONA (¿su código resuelve en el padrón?)
#   3. deduplicación          (¿esa persona ya acreditó esta celda?)
#
# Sin ese orden, una huérfana con código resoluble se contaría dos veces.
#
# **Sin cruce no hay nivel**, y no hay respaldo. La encuesta pregunta el ciclo,
# pero esa respuesta NO se usa para acreditar: es control (ver la hoja de
# consistencia). Es una decisión tomada, no una carencia — una celda alimentada
# por auto-reporte sin verificar es peor que una bolsa declarada.
#
# **La celda cuenta PERSONAS, no respuestas.** El marco tiene 1,55 aulas por
# alumno, así que la misma persona puede responder en dos aulas distintas. Hasta
# ahora eso se diluía entre facultades y el ADR 0079 lo asumió despreciable
# «porque las respuestas son anónimas y no se pueden deduplicar». Con el código
# sí se puede — y con el eje en nivel las dos respuestas caen en la MISMA celda,
# porque la persona tiene un solo nivel. Contarla dos veces es exactamente el
# fallo que una cuota existe para impedir, así que se deduplica y el duplicado
# se PUBLICA: verlo es lo que permite corregirlo.

# Los tres motivos por los que una respuesta se queda sin nivel. Son tres
# problemas distintos y se separan a propósito: los dos primeros son de campo
# —alguien no puso su código, o lo puso ilegible— y el tercero puede significar
# que el padrón está incompleto, que es un arreglo de oficina.
.MAN_MOTIVOS <- c("sin_codigo_declarado", "codigo_ilegible", "codigo_no_en_padron")

#' La columna donde el alumno declaró su código, según el estudio.
#'
#' Se exige declarada. A diferencia del sexo, aquí NO hay búsqueda por nombre de
#' respaldo: una columna adivinada que resulte ser otra cosa no falla, resuelve
#' a cero y deja el eje midiendo vacío. Es el modo de fallo que el cruce de
#' facultad declarada ya documentó, y su lección es no adivinar la llave.
#'
#' @param responses `data.frame` de respuestas.
#' @param cfg config de aulas universitarias.
#' @return el nombre de la columna, o `""` si el estudio no la declaró.
#' @export
monitoreo_aulas_columna_codigo <- function(responses, cfg = list()) {
  if (!is.data.frame(responses) || !ncol(responses)) return("")
  declarada <- .monitoreo_scalar(
    ((cfg %||% list())[["source_mapping"]] %||% list())[["student_code_var"]] %||% "", "")
  if (nzchar(declarada) && declarada %in% names(responses)) return(declarada)
  # Tolerancia mínima: el nombre declarado con otra caja o con espacios. No es
  # adivinar la columna, es reconocer la que el estudio ya nombró.
  if (nzchar(declarada)) {
    idx <- match(.monitoreo_text_key(declarada), .monitoreo_text_key(names(responses)),
                 nomatch = 0L)
    if (idx > 0L) return(names(responses)[[idx]])
  }
  ""
}

# El padrón como tabla de búsqueda: código normalizado -> fila. Se construye una
# vez por corrida; con 822 personas es instantáneo y evita un `match` por
# respuesta.
.man_indice <- function(padron = list()) {
  filas <- if (is.list(padron)) padron[["filas"]] %||% list() else list()
  if (!length(filas)) return(NULL)
  codigos <- vapply(filas, function(f) as.character(f[["codigo"]] %||% ""), character(1))
  niveles <- vapply(filas, function(f) {
    v <- suppressWarnings(as.integer(f[["nivel"]] %||% NA_integer_))
    if (is.finite(v)) v else NA_integer_
  }, integer(1))
  carreras <- vapply(filas, function(f) as.character(f[["carrera"]] %||% ""), character(1))
  sexos <- vapply(filas, function(f) as.character(f[["sexo"]] %||% ""), character(1))
  ok <- nzchar(codigos)
  list(codigo = codigos[ok], nivel = niveles[ok],
       carrera = carreras[ok], sexo = sexos[ok])
}

#' El nivel, la carrera y el sexo de cada respuesta, resueltos por su persona.
#'
#' Cruza el código que cada respuesta declara contra el padrón. No imputa nada:
#' una respuesta que no resuelve queda con `nivel = NA` y su motivo, para que el
#' avance la publique en la bolsa «sin nivel» en vez de acreditarla a una celda
#' inventada.
#'
#' @param responses `data.frame` de respuestas.
#' @param padron el padrón cargado (`monitoreo_aulas_padron_v1`).
#' @param cfg config de aulas universitarias.
#' @return `data.frame` con una fila por respuesta: `codigo` (normalizado),
#'   `nivel`, `carrera`, `sexo`, `resuelto` y `motivo`.
#' @export
monitoreo_aulas_nivel_por_respuesta <- function(responses, padron = list(), cfg = list()) {
  n <- if (is.data.frame(responses)) nrow(responses) else 0L
  vacio <- data.frame(
    codigo = character(n), nivel = rep(NA_integer_, n),
    carrera = character(n), sexo = character(n),
    resuelto = rep(FALSE, n), motivo = rep("sin_codigo_declarado", n),
    stringsAsFactors = FALSE
  )
  if (!n) return(vacio)

  col <- monitoreo_aulas_columna_codigo(responses, cfg)
  # Sin columna declarada NINGUNA respuesta resuelve, y el motivo lo dice. No se
  # busca la columna por nombre: ver la cabecera de `columna_codigo`.
  if (!nzchar(col)) return(vacio)

  crudo <- as.character(responses[[col]])
  codigos <- monitoreo_aulas_codigo_key(crudo)
  out <- vacio
  out$codigo <- codigos

  # Un código en blanco y un código ilegible son dos cosas: la primera es que
  # la persona no lo puso, la segunda que puso algo que no es un código. El
  # criterio de «ilegible» es deliberadamente laxo —al menos seis caracteres
  # alfanuméricos— porque el que decide de verdad es el padrón; esto sólo
  # separa «no contestó» de «contestó cualquier cosa».
  declarado <- nzchar(trimws(crudo)) & !is.na(crudo)
  legible <- nzchar(codigos) & nchar(codigos) >= 6L
  out$motivo[declarado & !legible] <- "codigo_ilegible"

  idx_tabla <- .man_indice(padron)
  if (is.null(idx_tabla)) {
    # Sin padrón, todo lo legible queda en «no está en el padrón»: es cierto, y
    # el diagnóstico de arriba dirá que el padrón falta. Decir «ilegible» aquí
    # mandaría a revisar los códigos cuando lo que falta es la tabla.
    out$motivo[declarado & legible] <- "codigo_no_en_padron"
    return(out)
  }

  pos <- match(codigos, idx_tabla$codigo)
  hit <- declarado & legible & !is.na(pos)
  out$nivel[hit] <- idx_tabla$nivel[pos[hit]]
  out$carrera[hit] <- idx_tabla$carrera[pos[hit]]
  out$sexo[hit] <- idx_tabla$sexo[pos[hit]]
  # Una persona del padrón cuyo nivel quedó ilegible al cargarlo está EN el
  # padrón pero no acredita celda. Se distingue del que no está.
  out$resuelto <- hit & is.finite(out$nivel)
  out$motivo[out$resuelto] <- ""
  out$motivo[hit & !is.finite(out$nivel)] <- "codigo_no_en_padron"
  out$motivo[declarado & legible & is.na(pos)] <- "codigo_no_en_padron"
  out
}

#' Marca qué respuestas resueltas son repetición de una persona ya contada.
#'
#' La celda cuenta personas. Con el marco a 1,55 aulas por alumno, la misma
#' persona puede responder en dos aulas y —con el eje en nivel— las dos caen en
#' la misma celda. Se conserva la PRIMERA en el orden que entra (que es el de
#' llegada de la plataforma) y las siguientes se marcan.
#'
#' Se marca, no se borra: el duplicado se publica, porque verlo es lo que
#' permite corregirlo, y porque una cifra que baja sin explicación es peor que
#' una cifra con su nota.
#'
#' @param resueltas `data.frame` de [monitoreo_aulas_nivel_por_respuesta()].
#' @param elegible vector lógico opcional: qué respuestas pasaron el paso del
#'   AULA. Sólo se deduplica entre las que van a acreditar; una huérfana con
#'   código resoluble no debe consumir la primera aparición de su persona.
#' @return vector lógico: `TRUE` en las repeticiones.
#' @export
monitoreo_aulas_nivel_duplicado <- function(resueltas, elegible = NULL) {
  if (!is.data.frame(resueltas) || !nrow(resueltas)) return(logical(0))
  n <- nrow(resueltas)
  ok <- resueltas$resuelto %in% TRUE
  if (is.logical(elegible) && length(elegible) == n) ok <- ok & (elegible %in% TRUE)
  out <- rep(FALSE, n)
  # `duplicated` sobre el subconjunto que acredita: fuera de él, un código
  # repetido no es un duplicado de cuota.
  if (any(ok)) out[ok] <- duplicated(resueltas$codigo[ok])
  out
}

#' Cómo fue el cruce, en cifras publicables.
#'
#' Es la devolución que hace posible confiar en el padrón: un código bien
#' declarado resuelve casi todo, y uno mal declarado resuelve cero. Sin esta
#' cifra, declarar la columna del código es un acto de fe.
#'
#' @param resueltas `data.frame` de [monitoreo_aulas_nivel_por_respuesta()].
#' @param elegible vector lógico opcional: qué respuestas pasaron el paso del aula.
#' @return lista con los conteos y la tasa de resolución.
#' @export
monitoreo_aulas_nivel_diagnostico <- function(resueltas, elegible = NULL) {
  base <- list(
    schema = "monitoreo_aulas_nivel_diagnostico_v1",
    consideradas = 0L, resueltas = 0L, duplicadas = 0L,
    sin_nivel = 0L, tasa = NA_real_, por_motivo = list()
  )
  if (!is.data.frame(resueltas) || !nrow(resueltas)) return(base)
  n <- nrow(resueltas)
  mask <- if (is.logical(elegible) && length(elegible) == n) elegible %in% TRUE else rep(TRUE, n)
  sub <- resueltas[mask, , drop = FALSE]
  if (!nrow(sub)) return(base)
  dup <- monitoreo_aulas_nivel_duplicado(sub)
  res <- sub$resuelto %in% TRUE
  motivos <- sub$motivo[!res]
  motivos <- motivos[nzchar(motivos)]
  conteo <- if (length(motivos)) {
    t <- table(factor(motivos, levels = .MAN_MOTIVOS))
    # Sólo los motivos con casos: un cero declarado por cada motivo es ruido.
    as.list(as.integer(t)[as.integer(t) > 0L]) |>
      stats::setNames(names(t)[as.integer(t) > 0L])
  } else {
    list()
  }
  list(
    schema = "monitoreo_aulas_nivel_diagnostico_v1",
    consideradas = nrow(sub),
    # Las que acreditan: resueltas y no repetidas.
    resueltas = sum(res & !dup),
    duplicadas = sum(res & dup),
    sin_nivel = sum(!res),
    tasa = if (nrow(sub)) round(sum(res) / nrow(sub), 4) else NA_real_,
    por_motivo = conteo
  )
}
