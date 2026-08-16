#' Profundidad de la ruta operativa segun la cadena construida
#'
#' La hoja «Rutas operativas aulas» del workbook exportaba seis reemplazos por
#' titular porque su `max_depth` estaba fijado en 6, mientras la seleccion trae
#' once: en el proyecto de referencia, 30 titulares con 330 reservas encadenadas,
#' exactamente 11 cada uno. Esa hoja es la que viaja a campo, asi que el recorte
#' entregaba al equipo una ruta mas corta que la planificada.
#'
#' La profundidad se deduce de las reservas que cada titular tiene atadas, que es
#' el mismo criterio que usa la pantalla de rutas. El techo de 12 lo aplica quien
#' llama; aqui solo se cuenta.
#'
#' @param reserves data.frame de reservas encadenadas.
#' @param titulars data.frame de titulares.
#' @return Entero: reservas del titular mejor servido, o 6 si no hay con que contar.
#' @keywords internal
.cm_aulas_reservas_por_titular <- function(reserves, titulars = NULL) {
  if (is.null(reserves) || !is.data.frame(reserves) || !nrow(reserves)) return(6L)
  clave <- NULL
  for (columna in c("replacement_for", "selection_slot_id")) {
    if (columna %in% names(reserves)) {
      candidata <- as.character(reserves[[columna]])
      # Una columna presente pero vacia no agrupa nada: seguir buscando.
      if (any(nzchar(candidata) & !is.na(candidata))) {
        clave <- candidata
        break
      }
    }
  }
  if (is.null(clave)) return(6L)
  clave <- clave[nzchar(clave) & !is.na(clave)]
  if (!length(clave)) return(6L)
  max(1L, as.integer(max(table(clave))))
}
