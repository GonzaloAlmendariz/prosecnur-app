# =============================================================================
# Traducir las decisiones guardadas al vocabulario anonimizado
# =============================================================================
#
# El anonimizador reescribe los VALORES de las tablas, pero el estado del
# proyecto guarda además DECISIONES que nombran esos valores: la suite de
# criterios de Cálculo de muestra lista las categorías que dejan pasar una fila.
# Si los valores cambian y las decisiones no, el `.pulso` queda inconsistente
# consigo mismo: el criterio pide categorías que su propia base ya no tiene y no
# deja pasar a nadie.
#
# Medido en `hsvg2026` (2026-08-15): el criterio `faculty` pedía 15 facultades
# reales, la base traía nombres de persona, y reconstruir el marco daba 0
# elegibles de 136.284 filas. Se diagnosticó dos veces como bug del motor antes
# de llegar hasta aquí — el motor acierta: si el criterio exige 15 categorías y
# ninguna existe, no pasa nadie.
#
# Por qué vive aparte del recorrido de tablas: `.pulso_anon_map_dataframes` sólo
# ve data.frames, y una suite de criterios es una lista anidada. Son dos
# recorridos distintos sobre el mismo estado.

# El criterio guarda `text_key` (`ciencias_e_ingenieria`), no el valor crudo
# (`CIENCIAS E INGENIERIA`), mientras que el diccionario del anonimizador mapea
# valores crudos. La traducción se hace por text_key en los dos lados.
.pulso_anon_text_key <- function(x) {
  v <- tolower(trimws(as.character(x)))
  v <- gsub("[áàäâ]", "a", v); v <- gsub("[éèëê]", "e", v)
  v <- gsub("[íìïî]", "i", v); v <- gsub("[óòöô]", "o", v)
  v <- gsub("[úùüû]", "u", v); v <- gsub("ñ", "n", v)
  v <- gsub("[^a-z0-9]+", "_", v)
  gsub("^_+|_+$", "", v)
}

#' Mapa text_key(original) -> text_key(seudónimo) desde el diccionario.
#'
#' Descarta las entradas cuya clave y valor colapsan al mismo text_key: no
#' aportan traducción y sólo harían ruido en el reporte.
.pulso_anon_mapa_categorias <- function(diccionario) {
  if (!length(diccionario)) return(character(0))
  origen <- .pulso_anon_text_key(names(diccionario))
  destino <- .pulso_anon_text_key(unlist(diccionario, use.names = FALSE))
  ok <- nzchar(origen) & nzchar(destino) & origen != destino
  if (!any(ok)) return(character(0))
  mapa <- destino[ok]
  names(mapa) <- origen[ok]
  mapa[!duplicated(names(mapa))]
}

#' Reescribe las categorías de una suite de criterios con el mapa.
#'
#' Devuelve la suite y cuántas categorías se tradujeron. Una categoría que el
#' mapa no conoce se deja intacta a propósito: puede ser una dimensión que el
#' anonimizador no tocó, y sustituirla por nada la convertiría en un criterio
#' que no filtra —peor que dejarla, porque cambia el marco en silencio—.
.pulso_anon_traducir_seleccion <- function(seleccion, mapa) {
  if (!is.list(seleccion) || !length(mapa)) return(list(seleccion = seleccion, n = 0L))
  by <- seleccion$byVariable
  if (!is.list(by) || !length(by)) return(list(seleccion = seleccion, n = 0L))
  n <- 0L
  for (id in names(by)) {
    cats <- by[[id]]$categories
    if (!length(cats)) next
    viejas <- as.character(unlist(cats, use.names = FALSE))
    nuevas <- ifelse(viejas %in% names(mapa), mapa[viejas], viejas)
    n <- n + sum(nuevas != viejas)
    by[[id]]$categories <- as.list(unname(nuevas))
  }
  seleccion$byVariable <- by
  list(seleccion = seleccion, n = n)
}

#' Recorre el estado traduciendo toda suite de criterios que encuentre.
#'
#' Busca por FORMA (una lista con `byVariable`) y no por ruta conocida, igual
#' que el recorrido de tablas: el estado guarda la suite en más de un sitio —el
#' marco construido y la config del workspace— y una lista de rutas quedaría
#' desactualizada al primer módulo que persista la suya.
.pulso_anon_traducir_criterios <- function(estado, diccionario,
                                           profundidad = 0L, max_profundidad = 12L) {
  mapa <- .pulso_anon_mapa_categorias(diccionario)
  total <- 0L
  recorrer <- function(x, prof) {
    if (prof > max_profundidad || !is.list(x) || !length(x)) return(x)
    if (is.data.frame(x)) return(x)
    if (is.list(x$byVariable) && length(x$byVariable)) {
      res <- .pulso_anon_traducir_seleccion(x, mapa)
      total <<- total + res$n
      return(res$seleccion)
    }
    for (i in seq_along(x)) {
      hijo <- x[[i]]
      if (is.list(hijo)) x[[i]] <- recorrer(hijo, prof + 1L)
    }
    x
  }
  if (!length(mapa)) return(list(estado = estado, traducidas = 0L))
  list(estado = recorrer(estado, profundidad), traducidas = total)
}
