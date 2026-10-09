# El ritmo diario, repartido por facultad.
#
# Gonzalo, mirando Resumen con Psicologia puesta en el selector del encabezado:
# «Ritmo de la recoleccion no lo esta haciendo». Y tenia razon: el panel leia
# `ritmo_diario`, que es la serie GLOBAL, y con una facultad en foco seguia
# diciendo «1 131 en 4 dias» —el total del operativo— debajo de un tablero que
# ya solo hablaba de Psicologia.
#
# Por que en el motor y no en la vista, que es donde se filtra todo lo demas:
# la serie se construye sobre `responses`, y `responses` NO viaja al frontend.
# Lo que viaja es `course_status` —recortado a 500 filas de 1 392— y los
# bloques ya agregados. Repartir la serie en la vista exigiria mandar las
# respuestas enteras con su marca de envio y su facultad, o reconstruir el dia
# de cada respuesta desde un bloque que no lo trae. Aqui estan los insumos.
#
# **Una sola implementacion del ritmo.** Este modulo NO recalcula dias,
# acumulados ni medias: subconjunta las respuestas y llama a
# `monitoreo_aulas_ritmo_diario()`, que es la misma funcion que produce la serie
# global. Dos calculos del mismo eje temporal terminan discrepando el dia que
# uno de los dos aprenda algo —el desfase de huso de `_submission_time` se
# arreglo una vez, en un sitio, y esa correccion la hereda tambien cada
# facultad.
#
# La meta y la brecha NO se calculan aqui: se toman de `avance_cuota$facultades`
# (ADR 0079), que es su dueño. La brecha de una facultad es la suma de sus
# celdas de sexo, no la resta de su total, y recalcularla con una resta aqui
# publicaria cero justo donde faltan mujeres.

#' Ritmo diario por facultad.
#'
#' @param responses data.frame de respuestas.
#' @param valid_response vector logico, una entrada por fila de `responses`.
#' @param faculty_values facultad atribuida a cada respuesta, una por fila
#'   (la que produce `.monitoreo_aulas_response_faculty_values()`).
#' @param avance_cuota bloque de avance contra cuota; de el salen la etiqueta,
#'   la meta y la brecha de cada facultad.
#' @param desde,hasta extremos del calendario comun, para que todas las series
#'   compartan eje con la global.
#' @return lista de facultades con su serie; cada una con `facultad`,
#'   `faculty_key`, `dias`, `dias_con_campo`, `mejor_dia`, `media_diaria`,
#'   `meta` y `brecha`.
#' @export
monitoreo_aulas_ritmo_por_facultad <- function(responses = data.frame(),
                                               valid_response = logical(0),
                                               faculty_values = character(0),
                                               avance_cuota = NULL,
                                               desde = NULL,
                                               hasta = NULL) {
  if (!is.data.frame(responses) || !nrow(responses)) return(list())
  if (length(faculty_values) != nrow(responses)) return(list())

  claves <- vapply(as.character(faculty_values), .cm_criterios_fac_key, character(1), USE.NAMES = FALSE)
  cuenta <- if (length(valid_response) == nrow(responses)) valid_response %in% TRUE else rep(TRUE, nrow(responses))

  # El ORDEN y las etiquetas los pone `avance_cuota`: la misma facultad tiene
  # que llamarse igual en los dos bloques o el panel que busca «PSICOLOGIA»
  # encuentra la serie en uno y no en el otro.
  filas <- if (is.list(avance_cuota)) (avance_cuota$facultades %||% list()) else list()

  desde_bloque <- list()
  for (f in filas) {
    k <- .monitoreo_scalar(f$faculty_key, "")
    if (!nzchar(k)) k <- .cm_criterios_fac_key(.monitoreo_scalar(f$facultad, ""))
    if (!nzchar(k)) next
    desde_bloque[[k]] <- list(
      facultad = .monitoreo_scalar(f$facultad, k),
      meta = .monitoreo_num(f$cuota, NA_real_),
      brecha = .monitoreo_num(f$brecha, NA_real_)
    )
  }

  # Una facultad con respuestas que `avance_cuota` no lista NO se pierde: se
  # publica con su etiqueta cruda y sin meta. Es justo la que interesa mirar
  # —respuestas atribuidas a algo que el diseño no traza— y descartarla la
  # dejaria fuera del panel sin dejar rastro.
  vistas <- names(desde_bloque)
  extra <- unique(claves[nzchar(claves) & cuenta])
  orden <- c(vistas[vistas %in% claves], setdiff(extra, vistas))

  salida <- list()
  for (k in orden) {
    fila <- claves == k
    if (!any(fila & cuenta)) next
    meta_k <- desde_bloque[[k]]
    serie <- monitoreo_aulas_ritmo_diario(
      responses[fila, , drop = FALSE],
      valid_response = cuenta[fila],
      meta = {
        m <- if (is.null(meta_k)) NA_real_ else meta_k$meta
        if (is.finite(m)) m else 0
      },
      brecha = if (is.null(meta_k) || !is.finite(meta_k$brecha)) NULL else meta_k$brecha,
      desde = desde, hasta = hasta
    )
    serie$faculty_key <- k
    serie$facultad <- if (is.null(meta_k)) {
      # La etiqueta cruda de la primera respuesta de ese grupo; la clave es
      # normalizada y no se puede mostrar tal cual.
      etq <- trimws(as.character(faculty_values[fila])[[1]])
      if (nzchar(etq)) etq else k
    } else meta_k$facultad
    salida[[length(salida) + 1L]] <- serie
  }
  salida
}
