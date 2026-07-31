# Selección de las variables con las que se arman las cuotas telefónicas.
#
# El bloque `cuotas_variable` emitía cada cuota DOS veces en PDM MedVida 2026:
# una fila con `Variable = "Actor"` y otra idéntica con `Variable = "dim_actor"`,
# mismo universo (156), misma meta (80), mismas efectivas (55). La causa está en
# cómo se juntaban las candidatas:
#
#   unique(c(configured, goal_vars, fallback))
#
# `unique()` deduplica por NOMBRE de columna. `Actor` la declara el usuario en
# `control_vars` y `dim_actor` es la columna canónica que el normalizador deriva
# de esa misma dimensión, así que las dos sobreviven y el bucle de
# `.monitoreo_report_phone_quota_df` recorre la misma partición dos veces.
#
# No es un defecto cosmético: el mínimo total se duplica (100 → 200) y el avance
# se parte a la mitad (70% → 35%). Lo consumen el resumen operativo, el avance
# diario, las cuotas y el PDF telefónico, así que la cifra falsa llega también
# al entregable del cliente.
#
# El criterio de deduplicación es deliberadamente estricto: **mismo texto en
# todas las filas**, no «misma partición». Dos columnas que agrupan igual pueden
# ser dimensiones distintas que coinciden por el tamaño del corte —si todos los
# casos de un actor caen en un distrito, `Actor` y `distrito` particionan igual
# sin ser lo mismo— y descartar una de ellas perdería una cuota real. Si el
# texto es idéntico fila a fila, en cambio, son la misma dimensión con dos
# nombres y no hay caso en que convenga emitir las dos.

#' Descarta variables de cuota que repiten los valores de otra ya elegida.
#'
#' Gana la primera del orden recibido, que es el de prioridad con el que se
#' construye la lista: lo declarado en `control_vars` antes que lo inferido de
#' las metas, y eso antes que el fallback por nombre de columna conocido. Así la
#' que sobrevive es la que el usuario nombró.
#'
#' Las variables que no existen en la base se conservan tal cual: quien consume
#' esta lista ya las saltea, y filtrarlas aquí escondería el hueco.
.monitoreo_phone_quota_vars_unicas <- function(phone, variables) {
  variables <- variables[nzchar(variables)]
  if (!length(variables)) return(character(0))
  if (is.null(phone) || !is.data.frame(phone) || !nrow(phone)) return(variables)

  vistos <- list()
  elegidas <- character(0)
  for (variable in variables) {
    if (!variable %in% names(phone)) {
      elegidas <- c(elegidas, variable)
      next
    }
    valores <- .monitoreo_text_key(.monitoreo_report_control_value(phone[[variable]], "texto"))
    repetida <- FALSE
    for (previo in vistos) {
      if (identical(previo, valores)) {
        repetida <- TRUE
        break
      }
    }
    if (repetida) next
    vistos[[length(vistos) + 1L]] <- valores
    elegidas <- c(elegidas, variable)
  }
  elegidas
}
