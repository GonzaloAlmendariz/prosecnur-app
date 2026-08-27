# Rerandomizacion: aceptar o rechazar contra un criterio fijado ANTES de sortear.
#
# ADR 0082, aceptado por Gonzalo el 2026-08-27. Su nucleo es una distincion que
# el motor no hacia: `pool_controlado` sortea N candidatas y devuelve el argmax
# de un score —optimizacion, con probabilidades de inclusion no calculables, y
# el motor ya lo advierte—. Rerandomizar es otra cosa: el criterio se fija antes
# de mirar los resultados, asi que el conjunto de muestras aceptables no depende
# del sorteo y lo que resulta sigue siendo un diseño, la condicional dado el
# criterio. En muestreo el nombre clasico es muestreo rechazativo.
#
# Lo que motiva esto, medido en HSVG 2026: la muestra final NO fue el primer
# sorteo. De 50 sorteos, 25 cerraban las 30 celdas de facultad x sexo; la
# mediana de cobertura minima fue 0,998 y se uso la semilla 202 con 1,079. Esa
# decision no estaba declarada en ninguna parte del `.pulso`.

.CM_RERANDOM_TOPE_DEFAULT <- 50L
.CM_RERANDOM_TOPE_MAX <- 1000L

#' Normaliza el criterio de aceptacion
#'
#' El criterio es DATO y no codigo (ADR 0082) para que el `.pulso` lo persista y
#' el sustento pueda citarlo. Hoy hay un tipo: `cobertura_celdas`, que exige que
#' toda celda facultad x sexo alcance su cuota. Sus cuotas viajan dentro porque
#' no estan en el `objective` —que gobierna balance, no cuotas— ni se pueden
#' deducir del marco.
#'
#' @keywords internal
.cm_rerandom_normalize_criterio <- function(x) {
  if (!is.list(x)) return(NULL)
  tipo <- .cm_aulas_scalar(x$tipo, "")
  if (!identical(tipo, "cobertura_celdas")) return(NULL)
  celdas <- .cm_aulas_as_df(x$celdas, "rerandomizacion.criterio.celdas")
  if (!nrow(celdas)) return(NULL)
  req <- c("faculty_key", "cuota_f", "cuota_m", "tau")
  if (!all(req %in% names(celdas))) return(NULL)
  celdas$faculty_key <- as.character(celdas$faculty_key)
  for (col in c("cuota_f", "cuota_m", "tau")) {
    celdas[[col]] <- suppressWarnings(as.numeric(celdas[[col]]))
  }
  celdas <- celdas[nzchar(celdas$faculty_key) & is.finite(celdas$tau) & celdas$tau > 0, , drop = FALSE]
  if (!nrow(celdas)) return(NULL)
  umbral <- .cm_aulas_num(x$umbral, 1)
  if (!is.finite(umbral) || umbral <= 0) umbral <- 1
  list(
    schema = "calc_muestra_aulas_rerandomizacion_criterio_v1",
    tipo = tipo,
    umbral = umbral,
    celdas = celdas
  )
}

#' Cobertura minima de un sorteo: el minimo sobre celdas de `logrado / cuota`
#'
#' Devuelve `NA` cuando no hay ninguna celda evaluable. Un `NA` NO se acepta:
#' aceptar por no poder medir es exactamente lo que este mecanismo existe para
#' no hacer.
#'
#' Una celda con cuota 0 no se evalua —dividir por cero no produce una cobertura
#' sino un infinito que taparia el minimo real de las demas.
#'
#' @keywords internal
.cm_rerandom_cobertura_minima <- function(rows, criterio) {
  if (!is.data.frame(rows) || !nrow(rows)) return(NA_real_)
  cuentas <- .cm_aulas_sexo_conteos(rows)
  if (!length(cuentas$f)) return(NA_real_)
  claves <- vapply(
    as.character(rows$faculty),
    function(x) .cm_aulas_scalar(.cm_criterios_fac_key(x), ""),
    character(1), USE.NAMES = FALSE
  )
  peor <- NA_real_
  for (i in seq_len(nrow(criterio$celdas))) {
    fila <- criterio$celdas[i, , drop = FALSE]
    idx <- claves == fila$faculty_key
    if (!any(idx)) {
      # La facultad no recibio ninguna aula: su cobertura es 0, no un NA. Que
      # una celda quede sin aulas es justo lo que el criterio debe rechazar.
      if (isTRUE(fila$cuota_f > 0) || isTRUE(fila$cuota_m > 0)) peor <- min(peor, 0, na.rm = TRUE)
      next
    }
    logrado_f <- sum(cuentas$f[idx], na.rm = TRUE) * fila$tau
    logrado_m <- sum(cuentas$m[idx], na.rm = TRUE) * fila$tau
    if (isTRUE(fila$cuota_f > 0)) peor <- min(peor, logrado_f / fila$cuota_f, na.rm = TRUE)
    if (isTRUE(fila$cuota_m > 0)) peor <- min(peor, logrado_m / fila$cuota_m, na.rm = TRUE)
  }
  peor
}

#' Sortea hasta que un sorteo pase el criterio, o hasta agotar el tope
#'
#' Devuelve el sorteo aceptado con un atributo `rerandomizacion` que declara el
#' criterio, cuantos sorteos se hicieron, cuantos pasaron y con que cobertura.
#'
#' Si el presupuesto se agota sin aceptar ninguno, DEVUELVE EL MEJOR Y LO
#' DECLARA (`agotado = TRUE`). El ADR lo hace obligatorio: entregar el mejor
#' fingiendo que paso es el modo de fallo que convierte esto en optimizacion
#' disfrazada.
#'
#' La tasa de aceptacion es informacion del diseño, no telemetria: un 50 % avisa
#' de que el criterio esta al filo de lo que el marco puede dar y un 2 % de que
#' el criterio es irreal y hay que revisar el diseño, no seguir sorteando.
#'
#' @keywords internal
.cm_aulas_rerandomizar <- function(aula_frame, selector, engine, criterio,
                                   seed = NULL, objective = NULL,
                                   tope = .CM_RERANDOM_TOPE_DEFAULT,
                                   sortear = NULL) {
  criterio <- .cm_rerandom_normalize_criterio(criterio)
  tope <- .cm_aulas_int(tope, .CM_RERANDOM_TOPE_DEFAULT)
  tope <- max(1L, min(.CM_RERANDOM_TOPE_MAX, tope))
  # Sin criterio no hay rerandomizacion posible: se sortea una vez y se DICE que
  # no la hubo, en vez de fingir una aceptacion que nadie evaluo.
  # `%||%` NO sirve aqui: hace `is.na()` sobre el argumento y con una funcion
  # eso advierte en cada llamada («is.na() applied to non-(list or vector) of
  # type 'closure'»). El inyector existe para poder testear el bucle sin motor.
  if (is.null(sortear)) {
    sortear <- function(s) .cm_aulas_select_once_dispatch(
      aula_frame, selector, engine, seed = s, objective = objective
    )
  }
  if (is.null(criterio)) {
    out <- sortear(seed)
    attr(out, "rerandomizacion") <- list(
      schema = "calc_muestra_aulas_rerandomizacion_v1",
      aplicada = FALSE, motivo = "sin_criterio",
      sorteos = 1L, aceptados = 0L
    )
    return(out)
  }

  mejor <- NULL
  mejor_cob <- -Inf
  mejor_i <- NA_integer_
  aceptados <- 0L
  hechos <- 0L
  aceptada <- NULL
  aceptada_i <- NA_integer_
  for (i in seq_len(tope)) {
    s <- if (is.null(seed)) NULL else seed + i * 7919L
    cand <- sortear(s)
    hechos <- i
    cob <- .cm_rerandom_cobertura_minima(cand, criterio)
    pasa <- is.finite(cob) && cob >= criterio$umbral
    if (pasa) aceptados <- aceptados + 1L
    if (is.finite(cob) && cob > mejor_cob) {
      mejor <- cand; mejor_cob <- cob; mejor_i <- i
    }
    if (pasa && is.null(aceptada)) {
      aceptada <- cand; aceptada_i <- i
      break
    }
  }

  agotado <- is.null(aceptada)
  out <- if (agotado) (mejor %||% cand) else aceptada
  attr(out, "rerandomizacion") <- list(
    schema = "calc_muestra_aulas_rerandomizacion_v1",
    aplicada = TRUE,
    criterio = list(tipo = criterio$tipo, umbral = criterio$umbral,
                    celdas_n = nrow(criterio$celdas)),
    sorteos = hechos,
    tope = tope,
    aceptados = aceptados,
    tasa_aceptacion = if (hechos > 0L) aceptados / hechos else NA_real_,
    cobertura_minima = if (agotado) mejor_cob else .cm_rerandom_cobertura_minima(out, criterio),
    sorteo_elegido = if (agotado) mejor_i else aceptada_i,
    agotado = agotado,
    # Sin esto el consumidor no puede distinguir «el primero que paso» de «el
    # mejor de los que no pasaron», y las dos muestras se ven iguales.
    motivo = if (agotado) "presupuesto_agotado_sin_aceptar" else "aceptada_por_criterio"
  )
  out
}

#' Normaliza el bloque de rerandomizacion de la config
#'
#' Devuelve siempre una lista con `activa`, `tope` y `criterio`. `activa` es
#' FALSE cuando no hay criterio utilizable: pedir rerandomizacion sin decir
#' contra que aceptar no es rerandomizar, y encenderla igual dejaria el sorteo
#' declarando una propiedad que nadie evaluo.
#'
#' @keywords internal
.cm_rerandom_normalize_config <- function(x) {
  vacio <- list(
    schema = "calc_muestra_aulas_rerandomizacion_config_v1",
    activa = FALSE, tope = .CM_RERANDOM_TOPE_DEFAULT, criterio = NULL
  )
  if (!is.list(x) || !length(x)) return(vacio)
  criterio <- .cm_rerandom_normalize_criterio(x$criterio %||% x$criterion)
  pedida <- .cm_aulas_bool(x$activa %||% x$activo %||% x$enabled, !is.null(criterio))
  tope <- .cm_aulas_int(x$tope %||% x$max_sorteos %||% x$max_draws, .CM_RERANDOM_TOPE_DEFAULT)
  tope <- max(1L, min(.CM_RERANDOM_TOPE_MAX, tope))
  list(
    schema = vacio$schema,
    activa = isTRUE(pedida) && !is.null(criterio),
    tope = tope,
    criterio = criterio
  )
}
