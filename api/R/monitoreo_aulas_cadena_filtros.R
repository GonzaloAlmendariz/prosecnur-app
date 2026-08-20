# Cuantas respuestas cae en cada filtro declarado.
#
# `.monitoreo_aulas_valid_response()` contesta si una respuesta vale, y ya esta:
# su bucle hace `ok <- ok & (...)` y ahi se pierde **cual** filtro la tumbo. Esta
# funcion reconstruye ese detalle **sin tocar su veredicto** — el total que
# sobrevive a la cadena tiene que ser exactamente el mismo, y hay un test que lo
# ata.
#
# **Dos lecturas que no son la misma, y por eso van con nombres distintos.**
# «Caen 120 por sexo» significa cosas diferentes segun como se cuente:
#   · `caen` es en CASCADA —de las que llegaron vivas a ese filtro, cuantas
#     tumba—. Depende del orden, que es justo lo que la palabra «cadena» promete.
#   · `caen_solo_aqui` son las que **unicamente** este filtro descarta: es lo que
#     se recuperaria si se quitara. No depende del orden.
# Publicar solo la primera invita a sumar columnas que no suman; publicar solo la
# segunda esconde el efecto del orden. Van las dos.

#' Cadena de filtros de validez, paso a paso
#'
#' @param data Respuestas de la base.
#' @param cfg Config normalizada del perfil.
#' @return Lista con `declarados`, `aplicados`, `pasos`, `entran` y `quedan`.
monitoreo_aulas_cadena_filtros <- function(data = data.frame(), cfg = list()) {
  vacia <- list(
    declarados = 0L, aplicados = 0L, sin_columna = list(),
    entran = 0L, quedan = 0L, pasos = list()
  )
  if (!is.data.frame(data) || !nrow(data)) return(vacia)
  filtros <- monitoreo_aulas_filtros_de_validez(cfg)
  declarados <- (cfg$source_mapping %||% list())$valid_filters
  # Sin filtros declarados manda el camino de `status_var`, que no es una cadena
  # y no se puede desglosar: se dice que no hay cadena en vez de inventar pasos.
  if (!length(filtros) || !length(declarados)) return(vacia)

  n <- nrow(data)
  # Una matriz de «esta respuesta pasa este filtro», que es lo que permite
  # separar la cascada de lo exclusivo sin recorrer los datos dos veces.
  pasa <- lapply(filtros, function(f) {
    if (!f$var %in% names(data)) return(NULL)
    .monitoreo_text_key(data[[f$var]]) %in% .monitoreo_text_key(f$values)
  })
  sin_columna <- Filter(Negate(is.null), lapply(seq_along(filtros), function(i) {
    if (is.null(pasa[[i]])) list(variable = filtros[[i]]$var) else NULL
  }))
  aplicables <- which(!vapply(pasa, is.null, logical(1)))

  vivas <- rep(TRUE, n)
  pasos <- list()
  for (i in aplicables) {
    entran <- sum(vivas)
    tras <- vivas & pasa[[i]]
    # Exclusivas: las que este filtro tumba y **ningun otro** tumbaria.
    otros <- rep(TRUE, n)
    for (j in aplicables) if (!identical(j, i)) otros <- otros & pasa[[j]]
    pasos[[length(pasos) + 1L]] <- list(
      orden = length(pasos) + 1L,
      variable = filtros[[i]]$var,
      valores = as.list(filtros[[i]]$values),
      entran = entran,
      caen = entran - sum(tras),
      quedan = sum(tras),
      caen_solo_aqui = sum(!pasa[[i]] & otros)
    )
    vivas <- tras
  }
  list(
    declarados = length(filtros),
    aplicados = length(aplicables),
    sin_columna = sin_columna,
    entran = n,
    quedan = sum(vivas),
    pasos = pasos
  )
}
