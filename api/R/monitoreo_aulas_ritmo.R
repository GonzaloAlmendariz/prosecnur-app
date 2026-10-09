# Ritmo diario de la recoleccion en aulas.
#
# Acreditacion y telefonico llevan su ritmo diario desde hace tiempo
# (`profiles/*/avance/ritmoDiario.ts`) y aulas no tenia ninguna serie temporal:
# el tablero decia cuanto se lleva y cuanto falta, pero en ninguna pantalla se
# veia COMO se llego ahi. Un tablero de monitoreo sin eje de tiempo no puede
# contestar la pregunta con la que se abre cada manana —¿vamos al ritmo que hace
# falta?— y es lo que hacia que Avance se leyera crudo aun teniendo graficos.
#
# El material ya estaba: las respuestas traen su marca de envio. Lo que faltaba
# era agregarla.
#
# Que NO hace este modulo:
#
# - No proyecta ni estima. La linea de lo que falta se dibuja desde la meta y
#   los dias que quedan, y eso es una division, no un pronostico; se calcula en
#   la vista y no aqui.
# - No inventa dias. Si el operativo no trabajo un dia, ese dia sale con cero y
#   no se salta: un hueco en la serie se lee como que no hubo campo, que es
#   justo lo que paso, mientras que saltarlo comprime el calendario y hace
#   parecer continuo lo que fue intermitente.

# Los nombres con los que puede llegar la marca de envio.
#
# **La que trae su HUSO va primero.** Estaba encabezada por `_submission_time`,
# que Kobo publica en UTC, y este operativo agenda hasta las 19:30 de Lima: esas
# respuestas se anotaban en el ritmo del día SIGUIENTE. `start`/`end` los escribe
# el dispositivo con su desfase. Ver `monitoreo_aulas_hora_local.R`.
MONITOREO_AULAS_COLUMNAS_FECHA <- c(
  MONITOREO_AULAS_COLUMNAS_TIEMPO, "fecha_envio"
)

# Un dia en formato ISO, o "" si el valor no es una fecha legible. Se corta por
# los diez primeros caracteres antes de convertir: las marcas llegan como
# `2026-08-14T10:00:00` y `as.Date()` sobre el texto entero avisa por cada fila.
.mar_dia <- function(valores) {
  txt <- trimws(as.character(valores %||% character(0)))
  txt[is.na(txt)] <- ""
  corto <- substr(txt, 1L, 10L)
  fecha <- suppressWarnings(as.Date(corto, format = "%Y-%m-%d"))
  out <- format(fecha, "%Y-%m-%d")
  out[is.na(fecha)] <- ""
  out
}

#' Respuestas validas por dia, con su acumulado.
#'
#' @param responses data.frame de respuestas.
#' @param valid_response vector logico, una entrada por fila: si cuenta.
#' @param meta meta total del estudio, para el acumulado contra ella.
#' @return lista con `dias` (fecha, validas, acumulado) y el resumen del ritmo.
#' @export
# `brecha` viaja aparte de `meta` porque NO es `meta - acumulado`: es la suma de
# lo que le falta a cada grupo de facultad y sexo (ADR 0079). Un estudio puede
# llevar 2.668 sobre una cuota de 2.500 y deber 170 personas donde la cuota no
# cierra, y la resta da cero justo en ese caso.
#' @param desde,hasta Extremos del calendario, `YYYY-MM-DD`. Por defecto los
#'   pone la propia serie. Se pasan cuando varias series tienen que compartir
#'   eje: el ritmo de una facultad que solo aplico dos dias dibujaria un eje de
#'   dos dias y, puesto al lado del de otra, mentiria sobre el calendario del
#'   operativo. Un dia FUERA de los extremos no se descarta: los extremos se
#'   ensanchan hasta contenerlo, porque perder una respuesta para que el eje
#'   quede bonito es peor que un eje mas ancho.
monitoreo_aulas_ritmo_diario <- function(responses = data.frame(),
                                         valid_response = logical(0),
                                         meta = 0,
                                         brecha = NULL,
                                         desde = NULL,
                                         hasta = NULL) {
  .brecha <- suppressWarnings(as.numeric(brecha %||% NA_real_))
  .brecha <- if (length(.brecha) == 1L && is.finite(.brecha)) max(0, .brecha) else NA_real_
  vacio <- list(dias = list(), dias_con_campo = 0L, mejor_dia = NULL,
                media_diaria = 0, meta = as.numeric(meta %||% 0), brecha = .brecha)
  if (!is.data.frame(responses) || !nrow(responses)) return(vacio)

  col <- .monitoreo_aulas_col(responses, MONITOREO_AULAS_COLUMNAS_FECHA)
  # Sin columna de fecha no hay serie. Devolver una plana con todo en el primer
  # dia seria inventarse el calendario del operativo.
  if (!nzchar(col)) return(vacio)

  dia <- .mar_dia(responses[[col]])
  cuenta <- if (length(valid_response) == nrow(responses)) valid_response %in% TRUE else rep(TRUE, nrow(responses))
  keep <- nzchar(dia) & cuenta
  if (!any(keep)) return(vacio)

  tabla <- table(dia[keep])
  fechas <- names(tabla)
  validas <- as.integer(tabla)
  orden <- order(fechas)
  fechas <- fechas[orden]
  validas <- validas[orden]

  # El calendario COMPLETO entre el primer y el ultimo dia con campo, con ceros
  # donde no se trabajo. Saltar esos dias comprimiria el eje y haria parecer
  # continuo un operativo que tuvo fines de semana y pausas.
  primero <- as.Date(fechas[[1]])
  ultimo <- as.Date(fechas[[length(fechas)]])
  .borde <- function(valor) {
    if (is.null(valor)) return(NULL)
    d <- suppressWarnings(as.Date(substr(trimws(as.character(valor)), 1L, 10L), format = "%Y-%m-%d"))
    if (length(d) != 1L || is.na(d)) NULL else d
  }
  d0 <- .borde(desde)
  d1 <- .borde(hasta)
  if (!is.null(d0)) primero <- min(primero, d0)
  if (!is.null(d1)) ultimo <- max(ultimo, d1)
  todos <- format(seq(primero, ultimo, by = "day"), "%Y-%m-%d")
  por_dia <- stats::setNames(rep(0L, length(todos)), todos)
  por_dia[fechas] <- validas

  acumulado <- cumsum(as.integer(por_dia))
  dias <- lapply(seq_along(todos), function(i) list(
    fecha = todos[[i]],
    validas = as.integer(por_dia[[i]]),
    acumulado = as.integer(acumulado[[i]])
  ))

  con_campo <- sum(as.integer(por_dia) > 0L)
  mejor <- which.max(as.integer(por_dia))
  list(
    dias = dias,
    dias_con_campo = as.integer(con_campo),
    # El mejor dia es la vara con la que se juzga si el ritmo alcanza: sin el,
    # «faltan 1 651» no dice si eso son dos dias buenos o veinte.
    mejor_dia = list(fecha = todos[[mejor]], validas = as.integer(por_dia[[mejor]])),
    # Media sobre los dias CON campo, no sobre el calendario: dividir entre los
    # dias muertos daria un ritmo que ningun dia se parecio al real.
    media_diaria = if (con_campo > 0L) round(sum(as.integer(por_dia)) / con_campo, 1) else 0,
    meta = as.numeric(meta %||% 0),
    brecha = .brecha
  )
}
