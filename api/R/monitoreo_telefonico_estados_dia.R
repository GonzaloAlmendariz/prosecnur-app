# Estados telefónicos por día, desglosados por cuota.
#
# `estatus_dia` publica la composición del barrido día a día para el estudio
# entero, y con eso alcanza mientras la pregunta sea «cómo va el campo». No
# alcanza en la vista de cuotas, donde cada fila habla de un segmento: pintar
# ahí el apilado global bajo el rótulo de una cuota afirmaría que ese es el
# barrido de esa cuota, y no lo es.
#
# La partición es la misma que la del bloque global —cada caso aparece una sola
# vez, en el día de su última actualización y con su estado final—, así que la
# suma de las cuotas reproduce el total. Lo único que cambia es que la fila
# lleva el actor con el que se agrupa.
#
# Sale en un bloque propio y no como columna extra del existente para que nadie
# tenga que sumar filas para recuperar el total del estudio: el consumidor de
# «cómo va el campo» sigue leyendo `estatus_dia` sin enterarse de esto.

#' Filas de `Actor × Estado × fecha` para el apilado por cuota.
#'
#' `dates_sorted` fija el orden y el juego de columnas, que son las mismas para
#' todos los actores: un actor sin casos un día trae cero y no se salta la
#' columna, o las series quedarían desalineadas entre cuotas.
.monitoreo_phone_status_actor_day <- function(actors, status, dates, status_labels, dates_sorted) {
  vacio <- data.frame(Actor = character(0), Estado = character(0), Total = integer(0), check.names = FALSE)
  if (!length(status_labels) || !length(dates_sorted)) return(vacio)

  actores <- sort(unique(actors[nzchar(actors) & !is.na(actors)]))
  if (!length(actores)) return(vacio)

  filas <- list()
  for (actor in actores) {
    actor_mask <- actors == actor
    for (label in status_labels) {
      label_mask <- actor_mask & status == label
      counts <- as.integer(vapply(
        dates_sorted,
        function(day) sum(label_mask & dates == day, na.rm = TRUE),
        integer(1)
      ))
      total <- as.integer(sum(counts, na.rm = TRUE))
      # Un estado que ese actor no registró nunca no aporta una fila de ceros:
      # el consumidor pinta lo que hay y una leyenda llena de familias en cero
      # sería ruido en la tarjeta más pequeña de la vista.
      if (!is.finite(total) || total <= 0L) next
      filas[[length(filas) + 1L]] <- data.frame(
        Actor = actor,
        Estado = label,
        as.data.frame(as.list(stats::setNames(counts, dates_sorted)), check.names = FALSE),
        Total = total,
        check.names = FALSE,
        stringsAsFactors = FALSE
      )
    }
  }

  if (!length(filas)) return(vacio)
  out <- do.call(rbind, filas)
  rownames(out) <- NULL
  out
}
