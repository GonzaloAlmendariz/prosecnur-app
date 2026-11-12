# Carga › Actualizar una fuente: qué cambia en las respuestas, caso por caso.
#
# Plan del revamp de Procesamiento, fila "Motor de Carga", punto 1: antes de
# aplicar una versión nueva de las respuestas, la pantalla dice qué cambia.
# Esta comparación no escribe nada en la sesión.
#
# Regla de la casa: se cruza por identificador de caso, nunca por posición.
# Un caso que cambia de fila pero conserva su id no es un cambio. Las columnas
# cuyo valor depende de la posición (el número de fila de Kobo `_index`, la
# fila de origen interna) no se comparan y se declaran.
#
# Base de las cifras: filas del archivo de respuestas recibido (la versión
# vigente, antes de la limpieza) contra las del archivo nuevo. Nivel: caso
# (una fila de la tabla principal).

# Columnas cuyo valor es la posición de la fila: compararlas marcaría como
# editado un caso que solo cambió de lugar.
.carga_actualizar_columnas_de_posicion <- function() {
  c("_index", .LIMPIEZA_COL_FILA_ORIGEN)
}

# Candidatas a identificador, en orden: las de Limpieza (mismo método con que
# se congelan las decisiones) y luego las de Codificación, sin `_index`, que es
# un número de fila.
.carga_actualizar_candidatas_id <- function() {
  unique(c(.limpieza_uuid_candidates(),
           setdiff(.codif_key_candidates, .carga_actualizar_columnas_de_posicion())))
}

.carga_actualizar_ids <- function(df, columnas) {
  partes <- lapply(columnas, function(v) trimws(as.character(df[[v]])))
  vacio <- Reduce(`|`, lapply(partes, function(x) is.na(x) | !nzchar(x)))
  ids <- do.call(paste, c(partes, sep = "|"))
  ids[vacio] <- NA_character_
  ids
}

.carga_actualizar_ids_unicos <- function(df, columnas) {
  ids <- .carga_actualizar_ids(df, columnas)
  length(ids) > 0L && !anyNA(ids) && !anyDuplicated(ids)
}

#' Qué identifica a los casos para comparar dos versiones.
#'
#' La llave declarada (`identidad_declarada`, que solo llega si Limpieza la
#' tiene activa) se usa si viene en ambas versiones, no es una columna de
#' posición y es única y sin vacíos en las DOS; si no, la primera columna
#' candidata común que sea única en la versión vigente. Que la nueva repita la
#' candidata se dice después, con su propio error. Sin candidata usable,
#' `columnas` es NULL y `causa` dice cuál versión tiene el defecto.
#' @keywords internal
carga_actualizar_identificador <- function(previa, nueva, identidad_declarada = character(0)) {
  previa <- previa %||% data.frame()
  comunes <- intersect(names(previa), names(nueva))
  declarada <- as.character(identidad_declarada %||% character(0))
  declarada <- declarada[!is.na(declarada) & nzchar(declarada)]
  if (length(declarada) && all(declarada %in% comunes) &&
      !any(declarada %in% .carga_actualizar_columnas_de_posicion()) &&
      .carga_actualizar_ids_unicos(previa, declarada) && .carga_actualizar_ids_unicos(nueva, declarada)) {
    return(list(columnas = declarada, metodo = "llave_declarada", causa = NA_character_))
  }
  repetida_en_vigente <- character(0)
  for (cand in .carga_actualizar_candidatas_id()) {
    if (!(cand %in% comunes)) next
    if (!any(!is.na(nueva[[cand]]) & nzchar(trimws(as.character(nueva[[cand]]))))) next
    if (!.carga_actualizar_ids_unicos(previa, cand)) {
      repetida_en_vigente <- c(repetida_en_vigente, cand)
      next
    }
    return(list(columnas = cand, metodo = "columna_candidata", causa = NA_character_))
  }
  causa <- if (length(repetida_en_vigente)) {
    sprintf("La versión vigente repite o deja vacío el identificador en \"%s\"; los casos no se pueden emparejar uno a uno.",
            repetida_en_vigente[[1]])
  } else {
    "Las dos versiones no comparten una columna que identifique a los casos."
  }
  list(columnas = NULL, metodo = NA_character_, causa = causa)
}

# La versión nueva no puede repetir ni dejar vacío su identificador: los
# cambios, las decisiones congeladas y la copia para volver se cruzan por él.
.carga_actualizar_exigir_ids_unicos <- function(ids, columnas) {
  etiqueta <- paste(columnas, collapse = " + ")
  vacios <- sum(is.na(ids))
  if (vacios > 0L) {
    stop_api(422, "E_CARGA_ACTUALIZAR_IDENTIFICADOR",
             sprintf("La versión nueva tiene %d %s sin identificador en \"%s\"; sin él no se puede saber qué caso es cada fila.",
                     vacios, if (vacios == 1L) "fila" else "filas", etiqueta),
             details = list(motivo = "vacio", columnas = as.list(columnas), n_filas = vacios))
  }
  dup <- unique(ids[duplicated(ids)])
  if (length(dup)) {
    stop_api(422, "E_CARGA_ACTUALIZAR_IDENTIFICADOR",
             sprintf("La versión nueva repite %d %s en \"%s\" (por ejemplo \"%s\"); cada caso tiene que tener uno distinto.",
                     length(dup), if (length(dup) == 1L) "identificador" else "identificadores",
                     etiqueta, dup[[1]]),
             details = list(motivo = "repetido", columnas = as.list(columnas),
                            n_repetidos = length(dup), ejemplos = as.list(utils::head(dup, 5L))))
  }
  invisible(TRUE)
}

.carga_actualizar_valor <- function(x) {
  v <- trimws(as.character(x))
  v[is.na(v)] <- ""
  v
}

.carga_actualizar_muestra <- function(x, n = 20L) as.list(utils::head(as.character(x), n))

#' Compara la versión vigente de las respuestas con la nueva.
#'
#' Devuelve casos (nuevos, que ya no vienen, editados, sin cambios), celdas
#' cambiadas y columnas que llegan o dejan de venir. Sin identificador común,
#' o con identificadores repetidos en la versión vigente, los conteos por caso
#' van NA y `causa` dice por qué; los totales de filas siempre van. Falla con
#' `E_CARGA_ACTUALIZAR_IDENTIFICADOR` si la versión nueva repite o deja vacío
#' su identificador.
#' @keywords internal
carga_actualizar_comparar <- function(previa, nueva, identidad_declarada = character(0)) {
  previa <- previa %||% data.frame()
  posicion <- .carga_actualizar_columnas_de_posicion()
  cols_prev <- setdiff(names(previa), .LIMPIEZA_COL_FILA_ORIGEN)
  cols_new <- setdiff(names(nueva), .LIMPIEZA_COL_FILA_ORIGEN)
  idf <- carga_actualizar_identificador(previa, nueva, identidad_declarada)

  casos <- list(antes = nrow(previa), despues = nrow(nueva),
                nuevos = NA_integer_, ya_no_vienen = NA_integer_,
                editados = NA_integer_, sin_cambios = NA_integer_,
                celdas_cambiadas = NA_integer_, causa = idf$causa,
                ejemplos = list(nuevos = list(), ya_no_vienen = list(), editados = list()))
  columnas_cambiadas <- list()

  if (!is.null(idf$columnas)) {
    ids_new <- .carga_actualizar_ids(nueva, idf$columnas)
    .carga_actualizar_exigir_ids_unicos(ids_new, idf$columnas)
    ids_prev <- .carga_actualizar_ids(previa, idf$columnas)
    if (anyDuplicated(ids_prev[!is.na(ids_prev)]) || anyNA(ids_prev)) {
      casos$causa <- "La versión vigente repite o deja vacío el identificador; los casos no se pueden emparejar uno a uno."
    } else {
      comunes <- intersect(ids_prev, ids_new)
      nuevos <- setdiff(ids_new, ids_prev)
      ya_no <- setdiff(ids_prev, ids_new)
      a_comparar <- setdiff(intersect(cols_prev, cols_new), c(idf$columnas, posicion))
      ip <- match(comunes, ids_prev)
      inn <- match(comunes, ids_new)
      cambios_por_caso <- integer(length(comunes))
      for (col in a_comparar) {
        dif <- .carga_actualizar_valor(previa[[col]][ip]) != .carga_actualizar_valor(nueva[[col]][inn])
        if (any(dif)) {
          cambios_por_caso <- cambios_por_caso + as.integer(dif)
          columnas_cambiadas[[length(columnas_cambiadas) + 1L]] <-
            list(columna = col, n_casos = as.integer(sum(dif)))
        }
      }
      editados <- comunes[cambios_por_caso > 0L]
      casos$nuevos <- length(nuevos)
      casos$ya_no_vienen <- length(ya_no)
      casos$editados <- length(editados)
      casos$sin_cambios <- length(comunes) - length(editados)
      casos$celdas_cambiadas <- as.integer(sum(cambios_por_caso))
      casos$causa <- NA_character_
      casos$ejemplos <- list(nuevos = .carga_actualizar_muestra(nuevos),
                             ya_no_vienen = .carga_actualizar_muestra(ya_no),
                             editados = .carga_actualizar_muestra(editados))
    }
  }

  orden <- order(-vapply(columnas_cambiadas, function(x) x$n_casos, integer(1)))
  list(
    identificador = list(columnas = as.list(idf$columnas %||% character(0)),
                         metodo = idf$metodo),
    casos = casos,
    columnas = list(
      nuevas = as.list(setdiff(cols_new, cols_prev)),
      ya_no_vienen = as.list(setdiff(cols_prev, cols_new)),
      con_cambios = columnas_cambiadas[orden],
      no_comparadas = lapply(intersect(posicion, intersect(cols_prev, cols_new)), function(col) {
        list(columna = col, causa = "Su valor es el número de fila; un caso que cambia de lugar no es un cambio.")
      })
    )
  )
}
