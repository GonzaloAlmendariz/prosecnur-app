# De que facultad es cada fila de «Base de control».
#
# La hoja del equipo NO trae facultad: sus 26 columnas van del curso-horario a
# los rangos de horario, y la facultad vive en el plan. Sin ella, la unica cola
# de trabajo que la app puede ofrecer es por aula suelta —«CH 52 necesita 1»—,
# cuando el equipo se organiza por facultad: cerrar ocho aulas de una misma
# facultad es UNA salida y ocho aulas repartidas son ocho. La instruccion de
# Gonzalo es literal: «siempre todo es por facultad».
#
# El cruce va en archivo propio y no dentro de `monitoreo_aulas_control.R`
# porque no es parte del veredicto: es un dato que se le adosa.
#
# **La coincidencia de nombre ya nos engaño una vez**: de los 14 campos de la
# hoja de control que parecian llegar al payload, los 14 eran coincidencia de
# nombre y ninguno estaba conectado. Por eso este cruce no se declara hecho: se
# cuenta, y quien lo consuma sabe cuantas filas cruzaron de cuantas.

.macf_clave <- function(valor) toupper(trimws(as.character(valor %||% "")))

#' Adosa la facultad del plan a las filas de «Base de control».
#'
#' @param filas filas ya publicadas del control.
#' @param plan unidades del plan, con `operational_code` y `faculty`.
#' @return lista con `filas` (cada una con `faculty`) y `cruzadas` / `sin_cruce`.
#' @export
monitoreo_aulas_control_con_facultad <- function(filas = list(), plan = list()) {
  if (!length(filas)) return(list(filas = list(), cruzadas = 0L, sin_cruce = 0L))
  mapa <- list()
  for (u in plan) {
    if (!is.list(u)) next
    # El plan identifica el aula por `operational_code` y, en algunos estudios,
    # solo por `classroom_id`. Se aceptan las dos, igual que el cruce de hojas.
    for (campo in c("operational_code", "classroom_id")) {
      code <- .macf_clave(u[[campo]])
      if (!nzchar(code) || !is.null(mapa[[code]])) next
      fac <- trimws(as.character(u$faculty %||% ""))
      if (nzchar(fac)) mapa[[code]] <- fac
    }
  }
  cruzadas <- 0L
  out <- lapply(filas, function(f) {
    code <- .macf_clave(f$operational_code %||% f$classroom_id)
    fac <- if (nzchar(code)) mapa[[code]] else NULL
    if (!is.null(fac)) {
      cruzadas <<- cruzadas + 1L
      f$faculty <- fac
    } else {
      # Vacia y no «Sin facultad»: la etiqueta la pone la vista, que es donde se
      # sabe si el hueco se dice o se calla.
      f$faculty <- ""
    }
    f
  })
  list(filas = out, cruzadas = cruzadas, sin_cruce = length(filas) - cruzadas)
}
