# El público de una respuesta sale de su fila en el padrón (Gonzalo, 30/10).
#
# Una sola encuesta de Profesores alimenta a dos públicos —Docentes CENTRUM y
# Docentes Campus— que salen del mismo padrón repartido por «Modalidad docente»
# (`actor_map`, monitoreo_source_dimension_vars.R). La respuesta no sabe a cuál
# pertenece; su fila en el padrón sí. Como el cruce por llave se hace dentro del
# público (`.monitoreo_report_base_index_lookup`), una respuesta etiquetada
# «Profesores» quedaría «Sin cruce» frente a los dos.
#
# Esta pasada, a la entrada del cruce (consultas internas, resumen por público y
# tablero; es idempotente y no cuesta nada sin la marca), reescribe el `dim_actor` de las respuestas de
# las fuentes que lo declaran (`actor_por_padron`, marca `.actor_por_padron` en
# sus filas) con el público de la fila del universo que comparte su llave. Es el
# mismo criterio de Cuotas: «la categoría de cada persona sale de SU FILA EN LA
# BASE». Si la llave casa con filas de dos públicos, o con ninguna, la respuesta
# conserva el suyo y el cruce decide como siempre.
monitoreo_heredar_actor_del_padron <- function(data, profile = list()) {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data)
  if (!all(c(".actor_por_padron", "dim_actor") %in% names(data))) return(data)
  marca <- as.logical(data$.actor_por_padron)
  marca[is.na(marca)] <- FALSE
  respuestas <- which(.monitoreo_report_role_mask(data, "respuestas") & marca)
  universo <- which(.monitoreo_report_role_mask(data, "universo"))
  if (!length(respuestas) || !length(universo)) return(data)
  perfil <- profile %||% list()

  llaves_universo <- .monitoreo_report_key_list(data[universo, , drop = FALSE], perfil, "universo")
  actores_universo <- trimws(as.character(data$dim_actor[universo]))
  actores_universo[is.na(actores_universo)] <- ""
  # Entorno con hash: el padrón trae decenas de miles de filas.
  indice <- new.env(hash = TRUE, parent = emptyenv())
  for (i in seq_along(llaves_universo)) {
    actor <- actores_universo[[i]]
    if (!nzchar(actor)) next
    for (llave in llaves_universo[[i]]) {
      if (!nzchar(llave)) next
      previo <- indice[[llave]]
      if (is.null(previo) || !actor %in% previo) assign(llave, c(previo, actor), envir = indice)
    }
  }
  if (!length(ls(indice))) return(data)

  llaves_respuesta <- .monitoreo_report_key_list(data[respuestas, , drop = FALSE], perfil, "respuesta")
  actores <- as.character(data$dim_actor)
  # Primero las llaves de código (la persona) y después las demás (correo,
  # teléfono): un correo puede estar compartido. Decide la primera llave que casa
  # con un solo público; una que casa con dos no decide y se prueba la siguiente.
  # Exigir que todas coincidieran dejaba en el público de la encuesta una
  # respuesta con el código de una persona de CENTRUM y un correo compartido con
  # alguien de Campus, y el cruce la acreditaba a la persona equivocada (revisión
  # metodológica 30/10).
  for (i in seq_along(llaves_respuesta)) {
    llaves <- llaves_respuesta[[i]]
    llaves <- c(llaves[startsWith(llaves, "codigo:")], llaves[!startsWith(llaves, "codigo:")])
    for (llave in llaves) {
      if (!nzchar(llave)) next
      candidatos <- get0(llave, envir = indice, inherits = FALSE)
      if (length(candidatos) == 1L) {
        actores[[respuestas[[i]]]] <- candidatos[[1L]]
        break
      }
    }
  }
  data$dim_actor <- actores
  data
}
