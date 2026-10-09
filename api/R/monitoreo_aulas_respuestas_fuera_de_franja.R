# monitoreo_aulas_respuestas_fuera_de_franja.R — el aula cuyas respuestas
# llegaron a una hora que no es la suya.
#
# **De dónde sale.** El 2026-09-09, con campo activo, CH 117 (8:50-9:20,
# Arquitectura, 40 elegibles) figuraba sin una sola encuesta y CH 121
# (10:30-11:00, Arte y Diseño, 21 elegibles) tenía 26 recibidas entre las 08:58
# y las 09:16 — hora y media antes de existir. Los dos códigos eran del mismo
# aplicador y estaban CRUZADOS: cada uno llevaba las respuestas del otro. Lo
# confirmó que una persona no puede estar en dos aulas a la vez, y lo corroboró
# el tamaño: 26 encuestas no caben en un aula de 21 elegibles.
#
# Nadie lo habría visto. El cruce aula-respuesta funcionaba, ninguna respuesta
# quedó huérfana y los totales del día cuadraban; sólo estaban en la columna
# equivocada, con 26 encuestas de una facultad contando para otra.
#
# **La zona horaria NO se cablea: se deduce.** La plataforma sella en UTC y la
# agenda está en hora local, y hacer que el motor sepa de husos añadiría una
# config que alguien tendría que acertar. En vez de eso se mide el DESFASE de
# cada aula (mediana de sus respuestas menos su hora agendada) y se toma la
# MEDIANA de todos: en un operativo sano ese número es el huso, y lo que sobra
# es la anomalía. Así el detector vale en cualquier ciudad sin preguntarle nada
# a nadie, y sobrevive a que el operativo cambie de país o de horario de verano.

#' Los minutos de una marca de tiempo de la plataforma, en UTC.
#' @keywords internal
.marff_minutos_utc <- function(x) {
  v <- trimws(as.character(x %||% ""))
  v[!nzchar(v)] <- NA_character_
  t <- suppressWarnings(as.POSIXct(sub("Z$", "", v), format = "%Y-%m-%dT%H:%M:%S", tz = "UTC"))
  faltan <- is.na(t) & !is.na(v)
  if (any(faltan)) {
    t[faltan] <- suppressWarnings(as.POSIXct(v[faltan], format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
  }
  as.numeric(t) / 60
}

#' La columna de fecha-hora que la plataforma usa, entre las candidatas.
#' @keywords internal
.marff_col_tiempo <- function(responses) {
  if (!is.data.frame(responses) || !ncol(responses)) return("")
  cand <- c("_submission_time", "submission_time", "end", "start", "_submission_date")
  hay <- intersect(cand, names(responses))
  for (k in hay) if (any(is.finite(.marff_minutos_utc(responses[[k]])))) return(k)
  ""
}

#' Aulas cuyas respuestas llegaron fuera de su franja.
#'
#' @param unidades filas del plan, con `scheduled_date` y `scheduled_time`.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas, para resolver el cruce aula-respuesta.
#' @param tolerancia_min cuánto puede desviarse un aula del desfase común antes
#'   de declararse anómala. 90 minutos por defecto: una clase dura entre 50 y
#'   180, y aplicar al principio o al final de una de tres horas ya mueve la
#'   mediana casi una hora sin que pase nada raro.
#' @param minimo cuántas respuestas hace falta para opinar de un aula. Con dos o
#'   tres la mediana es ruido y el aviso sería una moneda al aire.
#' @return lista `{codigo, fecha, hora, n, desfase_min, desde_min, hasta_min}`,
#'   con los minutos SIEMPRE relativos al inicio de su franja (negativo = antes),
#'   vacía cuando no hay con qué comparar.
#' @export
monitoreo_aulas_respuestas_fuera_de_franja <- function(unidades, responses, cfg = list(),
                                                       tolerancia_min = 90, minimo = 5L) {
  unidades <- unidades %||% list()
  if (!length(unidades) || !is.data.frame(responses) || !nrow(responses)) return(list())
  col_t <- .marff_col_tiempo(responses)
  if (!nzchar(col_t)) return(list())
  # **Mira los códigos YA CORREGIDOS, no los crudos.** Su pregunta es «¿queda
  # algo por atender?», y una anomalía reatribuida ya no lo es: seguir gritando
  # después de arreglarla es la forma más rápida de que el aviso deje de
  # mirarse. Y tiene un efecto que se quiere: si alguien reatribuye MAL, las
  # respuestas caen en una franja que no es la suya y el detector lo dice.
  cod <- tryCatch(trimws(as.character(.monitoreo_aulas_response_classroom(responses, cfg))),
                  error = function(e) NULL)
  if (is.null(cod) || !length(cod)) return(list())
  minutos <- .marff_minutos_utc(responses[[col_t]])

  # La agenda de cada aula, en minutos desde época LOCAL (naíf: se compara
  # contra UTC y la diferencia es justo lo que se quiere medir).
  agenda <- list()
  for (u in unidades) {
    k <- trimws(as.character(u[["operational_code"]] %||% ""))
    if (!nzchar(k) || !is.null(agenda[[k]])) next
    f <- .mav_fecha(u[["scheduled_date"]])
    ini <- suppressWarnings(monitoreo_aulas_hora_parse(
      trimws(as.character(u[["scheduled_time"]] %||% "")))[[1L]])
    if (!nzchar(f) || !is.finite(ini)) next
    dia <- suppressWarnings(as.numeric(as.POSIXct(f, tz = "UTC"))) / 60
    if (!is.finite(dia)) next
    agenda[[k]] <- list(cuando = dia + ini, fecha = f,
                        hora = trimws(as.character(u[["scheduled_time"]] %||% "")))
  }
  if (!length(agenda)) return(list())

  medibles <- list()
  for (k in names(agenda)) {
    i <- which(cod == k & is.finite(minutos))
    if (length(i) < minimo) next
    medibles[[k]] <- list(n = length(i), mediana = stats::median(minutos[i]),
                          desde = min(minutos[i]), hasta = max(minutos[i]),
                          desfase = stats::median(minutos[i]) - agenda[[k]]$cuando)
  }
  # **Hacen falta al menos tres aulas para tener un desfase común.** Con una o
  # dos, «lo normal» sería lo que diga la propia anomalía y el detector se
  # acusaría a sí mismo.
  if (length(medibles) < 3L) return(list())
  desfases <- vapply(medibles, function(x) x$desfase, numeric(1))
  # **La mediana sola se contamina con la propia anomalía.** Con cuatro aulas y
  # dos cruzadas, los dos valores centrales son uno sano y uno anómalo, y el
  # desfase «común» sale a medio camino: en el ensayo del caso real desplazaba
  # las horas diez minutos y las habría enseñado mal. Una pasada de refinamiento
  # lo arregla: se estima, se descartan las que se salen, y se vuelve a estimar
  # SÓLO con las que quedaron. Si al descartar no queda ninguna —todas raras,
  # que es lo que pasa cuando el reloj de la plataforma cambia de huso— se
  # conserva la primera estimación en vez de inventar otra.
  comun <- stats::median(desfases)
  cerca <- desfases[abs(desfases - comun) <= tolerancia_min]
  if (length(cerca)) comun <- stats::median(cerca)
  # **Las horas se dicen RELATIVAS a la franja del aula, no en un reloj.**
  #
  # Traducirlas a hora local pedía separar el huso del retraso típico con el que
  # se aplica dentro de la clase, y el desfase medido los trae mezclados. Se
  # intentó redondear a cuarto de hora —todos los husos lo son— y el retraso
  # empujaba por encima del punto medio: el aviso enseñaba una hora que no era
  # la del reloj de nadie. Eso es inventar precisión.
  #
  # Lo que hace falta saber no es «a qué hora entraron» sino cuánto se salieron
  # de SU franja, que es timezone-free por construcción y es la frase con la que
  # se llama por teléfono: «llegaron hora y media antes de su hora».
  salida <- list()
  for (k in names(medibles)) {
    m <- medibles[[k]]
    fuera <- m$desfase - comun
    if (abs(fuera) <= tolerancia_min) next
    salida[[length(salida) + 1L]] <- list(
      codigo = k, fecha = agenda[[k]]$fecha, hora = agenda[[k]]$hora, n = m$n,
      desfase_min = as.integer(round(fuera)),
      # Minutos respecto al inicio de SU franja: negativo = antes de existir.
      desde_min = as.integer(round(m$desde - agenda[[k]]$cuando - comun)),
      hasta_min = as.integer(round(m$hasta - agenda[[k]]$cuando - comun))
    )
  }
  salida[order(vapply(salida, function(x) -abs(x$desfase_min), numeric(1)))]
}
