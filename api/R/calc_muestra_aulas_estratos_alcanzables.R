# =============================================================================
# Estratos que no pueden recibir ninguna aula
# =============================================================================
#
# Cuando el diseno declara mas estratos que aulas titulares, una parte de ellos
# se queda en cero por ARITMETICA: no hay sorteo, ni balanceo, ni semilla que lo
# evite. Medido en el estudio real de 2025-2, el diseno declaraba 84 estratos y
# sorteaba 30 titulares: 54 estratos no podian recibir ninguna aula.
#
# El objetivo de representatividad ya avisaba —"Balance fuera de tolerancia
# severa en: Facultad, Programa, Tamano de aula"—, pero eso nombra el HECHO y no
# la CAUSA, y las dos llevan a decisiones distintas: un balance malo se corrige
# reponderando el objetivo o repitiendo el sorteo, mientras que un estrato
# inalcanzable solo se corrige subiendo el numero de aulas o agrupando los
# estratos. Sin decir la causa, el aviso invita a girar la perilla equivocada.
#
# Vive aparte porque calc_muestra_aulas.R esta congelado a crecimiento.

# Quien es titular. La seleccion cambia de forma segun la etapa: la que se
# publica trae `sample_role`, pero la que llega al objetivo de representatividad
# —antes de asignar roles— solo trae `wave`, y ahi los titulares son la ola M1.
# Empezar por `sample_role` y no contemplar el otro caso es lo que dejo el aviso
# mudo sobre el estudio real: la funcion caia en la rama de "sin titulares" y
# devolvia vacio en el unico escenario que existia para detectar.
.cm_aulas_estratos_titulares <- function(selection_df, roles = NULL) {
  n <- nrow(selection_df)
  if (length(roles) == n) return(roles %in% "titular")
  if ("sample_role" %in% names(selection_df)) return(selection_df$sample_role %in% "titular")
  if ("wave" %in% names(selection_df)) return(selection_df$wave %in% "M1")
  rep(FALSE, n)
}

# Cuenta estratos del MARCO y titulares de la seleccion.
#
# El universo de estratos sale de `aula_frame`, no de la seleccion, y esa es la
# parte que no se puede tomar a la ligera: antes de calcular representatividad,
# la seleccion se filtra de la bolsa extra, y ese filtro se lleva por delante
# justo a los estratos que no recibieron nada. Medido en el estudio real: de 84
# estratos y 2.468 filas quedan 360 filas con 30 estratos —exactamente los 30
# que tienen titular—, asi que contarlos ahi da siempre "ninguno inalcanzable"
# y el aviso nunca se emite en el unico caso que existe para detectar.
.cm_aulas_estratos_alcance <- function(aula_frame, selection_df, roles = NULL) {
  vacio <- list(estratos = 0L, titulares = 0L, inalcanzables = 0L, sin_titular = 0L)
  if (!is.data.frame(selection_df) || !nrow(selection_df)) return(vacio)
  universo <- if (is.data.frame(aula_frame) && "stratum" %in% names(aula_frame)) aula_frame else selection_df
  if (!("stratum" %in% names(universo))) return(vacio)
  estratos <- unique(universo$stratum[!is.na(universo$stratum) & nzchar(universo$stratum)])
  tit <- selection_df[.cm_aulas_estratos_titulares(selection_df, roles), , drop = FALSE]
  con_titular <- unique(tit$stratum[!is.na(tit$stratum) & nzchar(tit$stratum)])
  list(
    estratos = length(estratos),
    titulares = nrow(tit),
    # Los que la aritmetica deja fuera pase lo que pase con el sorteo.
    inalcanzables = max(0L, length(estratos) - nrow(tit)),
    # Los que efectivamente quedaron sin ninguna: incluye a los inalcanzables y
    # ademas a los que perdio el sorteo por concentrar dos titulares en otro.
    sin_titular = length(setdiff(estratos, con_titular))
  )
}

# Devuelve el aviso, o character(0) si cada estrato tiene plaza posible. Se
# concatena con el resto de warnings de representatividad.
.cm_aulas_aviso_estratos_inalcanzables <- function(aula_frame, selection_df, roles = NULL) {
  a <- .cm_aulas_estratos_alcance(aula_frame, selection_df, roles)
  if (a$titulares <= 0L || a$inalcanzables <= 0L) return(character(0))
  sprintf(
    paste0(
      "El diseno declara %d estratos y sortea %d aulas titulares: al menos %d ",
      "estratos no pueden recibir ninguna, y eso no lo corrige el balanceo. ",
      "Para cubrirlos hay que subir el numero de aulas o agrupar los estratos."
    ),
    a$estratos, a$titulares, a$inalcanzables
  )
}

# =============================================================================
# Celdas que se quedan por debajo del objetivo de reservas
# =============================================================================
#
# El aviso de profundidad compara la MEDIA de `depth_ratio` contra el objetivo,
# y una media tapa un agujero: con 29 celdas a 11 reservas por titular y una a
# 0, el promedio da 10,6 y el motor calla, aunque haya una celda cuyo titular no
# tiene a quién llamar si se cae.
#
# No es hipotético. Medido en el marco real de 2025-2: de sus 84 estratos, 44
# tienen menos de 12 cursos-horario y no pueden llenar una cadena de 11; uno de
# ellos —GASTRONOMÍA, HOTELERÍA Y TURISMO / F / G3— tiene UNO solo, así que si
# el sorteo lo toca su titular se queda sin ninguna reserva posible. En el
# sorteo medido no le tocó, y por eso el defecto seguía invisible.
#
# La pantalla ya miraba el mínimo; el motor no. Las dos preguntas valen —«¿el
# plan tiene colchón?» y «¿hay alguna celda descubierta?»— pero sólo la segunda
# se puede responder con la media si TODAS las celdas están igual, y en cuanto
# dejan de estarlo la media deja de ser una respuesta.
.cm_aulas_celdas_bajo_objetivo <- function(reserve_depth, objetivo) {
  if (!is.data.frame(reserve_depth) || !nrow(reserve_depth)) return(NULL)
  if (!("depth_ratio" %in% names(reserve_depth))) return(NULL)
  meta <- if (is.finite(objetivo) && objetivo > 0) objetivo else 1
  ratio <- suppressWarnings(as.numeric(reserve_depth$depth_ratio))
  bajo <- which(is.finite(ratio) & ratio < meta)
  if (!length(bajo)) return(NULL)
  peor <- bajo[which.min(ratio[bajo])]
  list(
    celdas = length(bajo), total = nrow(reserve_depth), objetivo = meta,
    peor_ratio = ratio[peor],
    peor_celda = as.character((reserve_depth$stratum %||% rep("", nrow(reserve_depth)))[peor]),
    # Sin ninguna reserva el titular no tiene a quién llamar: es otra cosa que
    # ir justo de colchón, y merece decirse aparte.
    sin_ninguna = sum(is.finite(ratio) & ratio <= 0)
  )
}

.cm_aulas_aviso_celdas_sin_reserva <- function(reserve_depth, objetivo) {
  d <- .cm_aulas_celdas_bajo_objetivo(reserve_depth, objetivo)
  if (is.null(d)) return(character(0))
  detalle <- if (d$sin_ninguna > 0) {
    sprintf("%d de ellas se quedaron SIN ninguna reserva", d$sin_ninguna)
  } else {
    sprintf("la mas ajustada es %s con %.2f", d$peor_celda %||% "?", d$peor_ratio)
  }
  sprintf(
    paste0(
      "%d de %d celdas quedan por debajo del objetivo de %.2f reservas por ",
      "titular (%s). El promedio no lo dice: una celda descubierta se compensa ",
      "en la media con las que van sobradas, y en campo no se compensa."
    ),
    d$celdas, d$total, d$objetivo, detalle
  )
}
