# Cuadre entre lo que el equipo DECLARO y lo que la plataforma RECIBIO.
#
# Es el tercer cruce del modulo y el que faltaba. Ya existian:
#
#   1. `monitoreo_aulas_reconciliacion.R` — la aritmetica INTERNA del parte:
#      asistentes menos rechazos menos duplicados tiene que dar las efectivas.
#   2. `monitoreo_aulas_cruce_hojas.R` — el parte contra la Base de control:
#      dos hojas que cuentan la misma aula en dos momentos.
#
# Y faltaba el que compara las dos fuentes que NO son la misma persona: lo que
# el aplicador anoto al salir del aula y lo que llego al servidor. Un aula donde
# el equipo declara 49 encuestas y llegaron 3 no es un descuadre de aritmetica
# ni una discrepancia entre revisores: es un enlace mal puesto, un QR que apunta
# a otra aula, o envios que nunca se sincronizaron. Nadie lo estaba mirando, y
# las dos cifras llevaban en la sesion desde el principio.
#
# **El emparejamiento NO se reimplementa aqui.** Las respuestas se cuentan por
# `classroom_id` —con `collection_unit_id` de respaldo— y de eso ya se encarga
# `.monitoreo_aulas_contar_por_fila()`. Una segunda copia se separaria de la
# primera en cuanto una de las dos cambie, que es exactamente lo que paso con
# los tramos de la agenda cuando tenian su propia copia.
#
# Este control no decide quien tiene razon. Dice que aula no cuadra, en que
# sentido y por cuanto.

#' Aulas donde lo declarado y lo recibido no coinciden.
#'
#' @param partes lista de partes de campo, con `operational_code` y
#'   `effective_surveys`.
#' @param recibidas vector con nombre: cuantas respuestas llegaron por aula,
#'   indexado por el codigo operativo. Lo produce quien ya sabe emparejar.
#' @param tolerancia diferencia absoluta que se considera cuadrada. Cero por
#'   defecto: aqui no hay redondeo del que fiarse, son cuentas de encuestas.
#' @return lista de hallazgos `list(operational_code, declaradas, recibidas,
#'   diferencia, sentido)`, ordenada por la diferencia mas grande primero.
#' @export
monitoreo_aulas_cruce_plataforma <- function(partes, recibidas,
                                             tolerancia = 0) {
  if (!length(partes)) return(list())
  num <- function(x) {
    v <- suppressWarnings(as.numeric(x %||% NA))
    if (length(v) != 1L || !is.finite(v)) NA_real_ else v
  }
  hallazgos <- list()
  for (pt in partes) {
    if (!is.list(pt)) next
    cod <- .monitoreo_scalar(pt$operational_code %||% pt$classroom_id, "")
    dec <- num(pt$effective_surveys)
    # Sin efectivas declaradas no hay nada que comparar. Suponer cero
    # inventaria un faltante en toda aula que aun no llena su parte.
    if (!nzchar(cod) || !is.finite(dec)) next
    i <- match(cod, names(recibidas))
    # Un aula que no aparece en el conteo tiene CERO respuestas, y eso si es
    # comparable: es justo el caso grave —el equipo aplico y no llego nada—.
    rec <- if (is.na(i)) 0 else suppressWarnings(as.numeric(recibidas[[i]]))
    if (!is.finite(rec)) rec <- 0
    dif <- dec - rec
    if (abs(dif) <= tolerancia) next
    hallazgos[[length(hallazgos) + 1L]] <- list(
      operational_code = cod,
      declaradas = dec,
      recibidas = rec,
      diferencia = dif,
      # El sentido importa y no se deduce del signo a ojo: «faltan» es que el
      # equipo aplico mas de lo que llego —encuestas perdidas—; «sobran» es que
      # llego mas de lo que el equipo anoto —el enlace lo uso otra aula, o el
      # parte se quedo corto—. Son dos problemas distintos.
      sentido = if (dif > 0) "faltan" else "sobran"
    )
  }
  if (!length(hallazgos)) return(list())
  orden <- order(-vapply(hallazgos, function(h) abs(h$diferencia), numeric(1)))
  hallazgos[orden]
}

#' Resumen del cruce, para una cabecera.
#'
#' @param hallazgos salida de `monitoreo_aulas_cruce_plataforma()`.
#' @param comparables cuantas aulas se pudieron comparar.
#' @return lista con los conteos y el peor caso.
#' @export
monitoreo_aulas_cruce_plataforma_resumen <- function(hallazgos, comparables) {
  comparables <- max(0L, as.integer(comparables %||% 0L))
  faltan <- Filter(function(h) identical(h$sentido, "faltan"), hallazgos)
  sobran <- Filter(function(h) identical(h$sentido, "sobran"), hallazgos)
  list(
    comparables = comparables,
    # Cuadran las que se pudieron comparar y no salieron en los hallazgos. Sin
    # el denominador, «1 aula cuadra» no dice si es de 2 o de 152.
    cuadran = max(0L, comparables - length(hallazgos)),
    faltan = length(faltan),
    sobran = length(sobran),
    encuestas_sin_llegar = sum(vapply(faltan, function(h) h$diferencia, numeric(1))),
    encuestas_de_mas = abs(sum(vapply(sobran, function(h) h$diferencia, numeric(1)))),
    peor = if (length(hallazgos)) hallazgos[[1]] else NULL
  )
}
