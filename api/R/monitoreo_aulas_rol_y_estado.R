# El estado de aplicacion repartido por ROL, que es la forma del libro.
#
# **De donde sale esta estructura.** No se inventa aqui: es la del Sheets. La
# hoja «Aulas Aplicadas (Campo)» esta partida en bloques —`TITULAR`,
# `REEMPLAZO 1`… `REEMPLAZO 11`— y cada bloque repite sus ~38 columnas con su
# propio `STATUS DE APLICACION`. Gonzalo lo pidio asi el 2026-09-10: «ahi en el
# Sheets te recomiendo que tambien te guies de los estados del Sheets, porque la
# idea es que ambos hablen el mismo idioma».
#
# Su vocabulario, textual del mismo dictado: «tenemos titulares sin agendar,
# titulares rechazados, titulares aplicados, reemplazos utilizados, reemplazos
# disponibles o reemplazos al aire —que son los que nunca se utilizaron—,
# reemplazos que estan en cadena —aquellos que todavia pueden ser factibles o se
# pueden utilizar—, y reemplazos complementarios, que son aulas extra».
#
# **Por que hacia falta.** El eje plano de siete tramos mezclaba tres cosas: el
# estado de agendamiento, el ROL en el sorteo y el desenlace. Por eso las 1 173
# reservas de HSVG2026 caian todas en un solo cajon —«En reserva»— que no dice
# si esa reserva todavia puede entrar o si ya no va a entrar nunca. Son dos
# situaciones distintas y solo una pide atencion.
#
# **La distincion cara: «en cadena» contra «al aire».** Una reserva sigue viva
# mientras su cadena no este resuelta; en cuanto el slot se aplico, todas las
# reservas que quedaban detras dejan de poder usarse. No es un estado que nadie
# escriba: se deduce de la cadena, y por eso se calcula aqui y no se pide al
# libro.

#' Reparte el plan por rol y, dentro de cada rol, por estado.
#'
#' @param df data.frame del plan seguido, con `sample_role`,
#'   `application_state`, `sample_status`, `operational_status`,
#'   `titular_operational_code` y `operational_code`.
#' @return lista con un elemento por rol; cada uno con sus estados y su total.
#' @export
monitoreo_aulas_rol_y_estado <- function(df) {
  vacio <- list(
    titulares = list(total = 0L, aplicado = 0L, agendado = 0L, sin_agendar = 0L,
                     rechazado = 0L, reemplazado = 0L),
    reemplazos = list(total = 0L, utilizado = 0L, en_cadena = 0L, al_aire = 0L),
    banco = list(total = 0L, utilizado = 0L, disponible = 0L)
  )
  if (!is.data.frame(df) || !nrow(df)) return(vacio)
  n <- nrow(df)

  rol <- tolower(trimws(as.character(df$sample_role %||% rep("", n))))
  estado_app <- as.character(df$application_state %||% rep("", n))
  muestra <- as.character(df$sample_status %||% rep("", n))
  cod <- as.character(df$operational_code %||% rep("", n))
  tit <- as.character(df$titular_operational_code %||% rep("", n))
  cadena <- ifelse(nzchar(tit), tit, cod)

  # «Aplicado» con el vocabulario del motor, y los DOS estados: al curso-horario
  # se va una sola vez, asi que `en_aplicacion` y `cerrando` son lo mismo
  # (dictado 2026-09-10: «aula que se aplica es un aula que se aplica, no es que
  # esta en proceso»).
  aplicado <- estado_app %in% c("en_aplicacion", "cerrando")
  rechazado <- .maej_caido(muestra)
  reemplazado <- estado_app %in% "reemplazada"
  agendado <- estado_app %in% "lista" & !rechazado

  es_titular <- rol %in% "titular"
  es_banco <- rol %in% "extra_reserve_pool"
  es_reserva <- !es_titular & !es_banco

  # Una cadena esta RESUELTA cuando alguno de sus eslabones ya se aplico: el
  # slot esta cubierto y nadie va a llamar a las reservas que quedaban detras.
  resueltas <- unique(cadena[aplicado])
  cadena_resuelta <- cadena %in% resueltas

  list(
    titulares = list(
      total = as.integer(sum(es_titular)),
      aplicado = as.integer(sum(es_titular & aplicado)),
      # El orden importa: un titular reemplazado o rechazado ya no esta
      # «agendado» ni «sin agendar», aunque su fila conserve la fecha.
      reemplazado = as.integer(sum(es_titular & !aplicado & reemplazado)),
      rechazado = as.integer(sum(es_titular & !aplicado & !reemplazado & rechazado)),
      agendado = as.integer(sum(es_titular & !aplicado & !reemplazado & agendado)),
      sin_agendar = as.integer(sum(es_titular & !aplicado & !reemplazado & !rechazado & !agendado))
    ),
    reemplazos = list(
      total = as.integer(sum(es_reserva)),
      # UTILIZADO es haber entrado, no haber terminado: una reserva agendada ya
      # gasto su turno en la cadena.
      utilizado = as.integer(sum(es_reserva & (aplicado | agendado))),
      # AL AIRE: nunca se va a usar porque su slot ya esta cubierto.
      al_aire = as.integer(sum(es_reserva & !(aplicado | agendado) & cadena_resuelta)),
      # EN CADENA: su titular sigue sin resolverse, asi que todavia puede entrar.
      en_cadena = as.integer(sum(es_reserva & !(aplicado | agendado) & !cadena_resuelta))
    ),
    banco = list(
      total = as.integer(sum(es_banco)),
      utilizado = as.integer(sum(es_banco & (aplicado | agendado))),
      disponible = as.integer(sum(es_banco & !(aplicado | agendado)))
    )
  )
}
