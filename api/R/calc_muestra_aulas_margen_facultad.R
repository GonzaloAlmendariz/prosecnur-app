#' Cuánto margen de aulas le queda a cada facultad
#'
#' El motor calcula cuántas aulas necesita cada facultad —`aulas_base`— pero no
#' dice cuántas HAY. Medido en HSVG2026: LETRAS Y CIENCIAS HUMANAS requiere 16 y
#' tiene exactamente 16, así que sus dieciséis aulas son titulares y no queda
#' ninguna para reemplazar a la que se caiga; CIENCIAS CONTABLES y EDUCACION
#' requieren 14 de 19; en el otro extremo CIENCIAS E INGENIERIA usa el 8 % de
#' las suyas. Ninguna de esas tres situaciones se mencionaba en el resultado.
#'
#' Es el mismo silencio que en la cadena de reemplazos: al sortear 190 titulares,
#' 110 recibían menos de las once reservas pedidas —alguno una sola— y el motor
#' entregaba la selección sin decirlo. La causa está aquí arriba: una facultad no
#' puede dar reservas que no tiene, y eso se sabe ANTES de sortear.
#'
#' El bloque es aditivo y no toca ninguna cifra que el motor haya aplicado.
#'
#' @keywords internal
NULL

#' Reservas por titular que una facultad puede sostener
#'
#' Con `disponibles` aulas y `requeridas` titulares, las sobrantes se reparten
#' entre los titulares: `(disponibles - requeridas) %/% requeridas`. Es el techo
#' real de la cadena en esa facultad, cualquiera que sea la profundidad pedida.
#'
#' @keywords internal
.cm_aulas_reservas_sostenibles <- function(disponibles, requeridas) {
  d <- suppressWarnings(as.numeric(disponibles))
  r <- suppressWarnings(as.numeric(requeridas))
  if (!is.finite(d) || !is.finite(r) || r <= 0) return(NA_integer_)
  as.integer(max(0, floor((d - r) / r)))
}

#' Estado del margen de una facultad
#'
#' `insuficiente` es peor que `sin_reservas`: no hay aulas ni para los titulares.
#'
#' @keywords internal
.cm_aulas_estado_margen <- function(disponibles, requeridas, profundidad) {
  d <- suppressWarnings(as.numeric(disponibles))
  r <- suppressWarnings(as.numeric(requeridas))
  if (!is.finite(d) || !is.finite(r) || r <= 0) return("desconocido")
  if (d < r) return("insuficiente")
  # `sin_reservas` es literal: no sobra NI UNA aula. Que sobren pero no lleguen a
  # una por titular es otra cosa —`reservas_cortas`— y decir «todas son
  # titulares» ahi seria falso: a Arquitectura le sobran 20 de 56.
  if (d == r) return("sin_reservas")
  sostenibles <- .cm_aulas_reservas_sostenibles(d, r)
  # Gonzalo (2026-08-18, textual): «nunca ha habido un requerimiento de que
  # todas tengan 11 reservas a más, no es un requerimiento». La profundidad
  # de la cadena (R1-R11) es su CAPACIDAD MAXIMA operativa, no una meta:
  # compararla contra las sostenibles fabricaba un estado de alerta
  # (reservas_cortas) para casi toda facultad sana. El unico corto real es
  # sostener CERO: sobran aulas pero ni una reserva por titular.
  if (identical(sostenibles, 0L)) return("reservas_cortas")
  "holgado"
}

#' Aviso legible del margen, con las dos cifras que lo justifican
#'
#' Sin cifras un aviso es una impresión; con ellas el analista decide.
#'
#' @keywords internal
.cm_aulas_aviso_margen <- function(estado, facultad, disponibles, requeridas,
                                   sostenibles, profundidad) {
  switch(
    estado,
    insuficiente = sprintf(
      paste("%s necesita %s aulas y solo tiene %s: la cuota de esta facultad no",
            "se puede cubrir con el marco actual."),
      facultad, format(requeridas), format(disponibles)
    ),
    sin_reservas = sprintf(
      paste("%s necesita %s de sus %s aulas: todas son titulares y no queda",
            "ninguna para reemplazar a la que se caiga en campo."),
      facultad, format(requeridas), format(disponibles)
    ),
    reservas_cortas = sprintf(
      paste("%s usa %s de sus %s aulas: las %s que sobran no alcanzan para dar",
            "ni una reserva a cada titular."),
      facultad, format(requeridas), format(disponibles),
      format(as.integer(disponibles) - as.integer(requeridas))
    ),
    ""
  )
}

#' Añade el margen por facultad a `aulas_por_estrato`
#'
#' @param estudio Estudio ya calculado.
#' @param frame Marco de aulas; de ahí salen las aulas incluidas por facultad.
#' @param profundidad Capacidad maxima de la cadena (`bolsas_reemplazo`, R1-Rn). NO es una meta: viaja como referencia (`reservas_pedidas`) y no fabrica estados de alerta.
#' @return El estudio con `margen` en cada fila de `aulas_por_estrato`.
#' @keywords internal
calc_muestra_aulas_adjuntar_margen <- function(estudio, frame = NULL, profundidad = NA) {
  if (!is.list(estudio) || !is.list(estudio$componentes)) return(estudio)
  disponibles <- .cm_aulas_disponibles_por_facultad(frame)
  for (i in seq_along(estudio$componentes)) {
    aulas <- estudio$componentes[[i]]$resultado$aulas_por_estrato
    if (!is.list(aulas) || !length(aulas)) next
    estudio$componentes[[i]]$resultado$aulas_por_estrato <- lapply(aulas, function(row) {
      if (!is.list(row)) return(row)
      clave <- .cm_aulas_scalar(.cm_criterios_fac_key(.cm_aulas_scalar(row$estrato, "")), "")
      disp <- if (!is.null(disponibles[[clave]])) disponibles[[clave]] else NA_integer_
      req <- suppressWarnings(as.integer(row$aulas_base))
      estado <- .cm_aulas_estado_margen(disp, req, profundidad)
      sostenibles <- .cm_aulas_reservas_sostenibles(disp, req)
      row$margen <- list(
        aulas_disponibles = disp,
        aulas_requeridas = req,
        aulas_sobrantes = if (is.na(disp) || is.na(req)) NA_integer_ else as.integer(max(0, disp - req)),
        reservas_sostenibles = sostenibles,
        reservas_pedidas = suppressWarnings(as.integer(profundidad)),
        estado = estado,
        aviso = .cm_aulas_aviso_margen(
          estado, .cm_aulas_scalar(row$estrato, ""), disp, req, sostenibles, profundidad
        )
      )
      row
    })
  }
  estudio
}

#' Aulas INCLUIDAS por facultad, con la clave normalizada del motor
#'
#' Se cuentan las incluidas, no todas: una facultad con 149 aulas de las que sólo
#' 16 pasan los criterios tiene 16 disponibles para sortear, no 149.
#'
#' @keywords internal
.cm_aulas_disponibles_por_facultad <- function(frame) {
  out <- list()
  if (!is.list(frame)) return(out)
  af <- frame$aula_frame
  if (!is.data.frame(af) || !nrow(af)) return(out)
  if (!all(c("faculty", "included") %in% names(af))) return(out)
  inc <- af[af$included %in% TRUE, , drop = FALSE]
  if (!nrow(inc)) return(out)
  claves <- vapply(
    as.character(inc$faculty),
    function(x) .cm_aulas_scalar(.cm_criterios_fac_key(x), ""),
    character(1), USE.NAMES = FALSE
  )
  tab <- table(claves[nzchar(claves)])
  for (k in names(tab)) out[[k]] <- as.integer(tab[[k]])
  out
}
