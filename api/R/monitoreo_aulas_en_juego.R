# Cual eslabon de cada cadena esta EN JUEGO.
#
# Un slot de la muestra es una cadena entera —`CH 5` -> `R 5.1` -> `R 5.2`…— y
# en cada momento solo UNO de sus eslabones es el aula que hay que ir a aplicar.
# Dicho por quien dirige el estudio: «si el curso-horario cinco no se pudo, su
# reemplazo R 5 pasa a reemplazar al curso-horario cinco; la idea es completar
# esa aula».
#
# Contarlos todos es contar el mismo slot tantas veces como respaldos tenga. En
# HSVG2026 son 202 titulares con 1 774 reservas encadenadas: el tablero decia
# 1 976 «cursos-horario por debajo de su meta» cuando los slots son 203, y la
# meta salia 84 110 donde el estudio pide 6 901.
#
# Las reservas EXTRA no entran aqui: no reemplazan a nadie —son aulas
# adicionales para cerrar la cuota de hombres y mujeres por facultad— y por eso
# no forman cadena con ningun titular.

# Estados en los que un eslabon todavia NO entro al operativo. El «-» esta
# porque es como el equipo escribe «todavia nada aqui» en el Excel: 1 810 de
# 2 040 celdas de STATUS MUESTRA en el estudio de 2025.
MONITOREO_AULAS_ESTADOS_DORMIDOS <- c("", "-", "sin_contactar", "en_reserva", "planificada")

# Estados en los que el aula YA SE APLICO, y por tanto su cadena esta resuelta.
#
# «parcial» esta dentro por decision de quien dirige el estudio: «en principio
# una aplicacion en un aula que te cataloga como parcial si cuenta». Se aplico,
# se recogieron respuestas, y esa cadena no tiene que pedir otro reemplazo.
#
# Hasta ahora la regla vivia repetida como `c("aplicada", "cerrada")` literal en
# ocho sitios de R y siete del frontend, y ya habia DIVERGIDO: la linea 1704 de
# `monitoreo_aulas_universitarias.R` —el reparto por estrato— si contaba la
# parcial y las demas no. Ese es el sintoma exacto de una regla sin nombre: no
# se corrige en un sitio, se corrige en el que alguien recuerda.
#
# **Donde NO se usa, y por que.** La calibracion de rendimiento
# (`monitoreo_aulas_calibracion.R`) sigue con `c("aplicada", "cerrada")` a
# proposito: mide cuantas respuestas rinde un aula para PREDECIR las que faltan,
# y una parcial rindio menos por definicion. Meterla ahi arrastraria la
# prediccion hacia abajo con un caso que no representa a los que vienen. Contar
# y predecir son dos preguntas distintas sobre el mismo estado.
MONITOREO_AULAS_ESTADOS_APLICADOS <- c("aplicada", "cerrada", "parcial")

.maej_dormido <- function(estado) {
  v <- tolower(trimws(as.character(estado %||% "")))
  # `en reserva 3` es el vocabulario del Excel para la reserva que aun espera.
  v <- sub("^en reserva.*$", "en_reserva", v)
  # «SIN CONTACTAR» es la forma que el desplegable ofrece desde B13a y la que
  # la siembra escribe en todas las filas: mismo estado, con espacio.
  v <- gsub(" ", "_", v, fixed = TRUE)
  v %in% MONITOREO_AULAS_ESTADOS_DORMIDOS
}

# B13b: CAIDO no es DORMIDO. Un eslabon dormido aun no entro al operativo y
# puede entrar; uno con RECHAZO entro y se cayo — no puede ser el aula que hay
# que ir a aplicar, pero tampoco borra el slot del tablero. Se pregunta al
# normalizador real (acepta «RECHAZO» del libro y `rechazo` del plan), no a
# una copia de su lista. `reemplazada` NO esta aqui a proposito: su cadena ya
# tiene una reserva activada que toma el eslabon por la via de siempre.
.maej_caido <- function(estado) {
  vapply(as.character(estado %||% ""), function(v) {
    identical(monitoreo_aulas_estado_muestra(v), "rechazo")
  }, logical(1), USE.NAMES = FALSE)
}

#' Marca, por fila, si es el eslabon en juego de su cadena.
#'
#' @param df data.frame del plan seguido, con `sample_role`,
#'   `titular_operational_code`, `operational_code`, `sample_status` y
#'   `replacement_order`.
#' @return vector logico de `nrow(df)`.
#' @export
monitoreo_aulas_en_juego <- function(df) {
  if (!is.data.frame(df) || !nrow(df)) return(logical(0))
  n <- nrow(df)
  rol <- as.character(df$sample_role %||% rep("", n))
  cod <- as.character(df$operational_code %||% rep("", n))
  tit <- as.character(df$titular_operational_code %||% rep("", n))
  est <- as.character(df$sample_status %||% rep("", n))
  ord <- suppressWarnings(as.numeric(df$replacement_order %||% rep(NA_real_, n)))
  ord[!is.finite(ord)] <- 0

  # La cadena se identifica por el TITULAR en codigo operativo. `replacement_for`
  # no sirve: lleva el `classroom_id` y sobre HSVG2026 ninguno de sus 202
  # valores coincidia con un titular.
  cadena <- ifelse(nzchar(tit), tit, cod)
  despierto <- !.maej_dormido(est)
  caido <- .maej_caido(est)
  es_reserva <- rol == "chain_reserve"

  out <- rep(FALSE, n)
  for (clave in unique(cadena)) {
    idx <- which(cadena == clave)
    # La reserva mas profunda que YA entro —y no se cayo— manda: es la que
    # esta cubriendo el slot ahora mismo. Una reserva con RECHAZO entro y se
    # cayo: no cubre nada (B13b).
    activas <- idx[es_reserva[idx] & despierto[idx] & !caido[idx]]
    if (length(activas)) {
      out[activas[[which.max(ord[activas])]]] <- TRUE
      next
    }
    titulares <- idx[!es_reserva[idx]]
    # B13b: RECHAZO en el titular pasa el eslabon a la PRIMERA reserva no
    # caida aunque nadie la haya contactado todavia — es a la que hay que
    # salir a llamar. Sigue siendo exactamente UNA fila en juego por cadena.
    if (length(titulares) && caido[titulares[[1]]]) {
      relevo <- idx[es_reserva[idx] & !caido[idx]]
      if (length(relevo)) {
        out[relevo[[which.min(ord[relevo])]]] <- TRUE
        next
      }
    }
    # Si ninguna reserva entro ni puede relevar, el slot lo representa su
    # titular —aunque este caido—: el hueco es del slot y tiene que verse en
    # alguna fila, nunca en cero.
    out[if (length(titulares)) titulares[[1]] else idx[[1]]] <- TRUE
  }
  out
}
