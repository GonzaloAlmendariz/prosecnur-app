# =============================================================================
# Vinculación transversal (ADR 0047)
# =============================================================================
#
# El corazón del subsistema: cualquier entidad puede señalar a cualquier otra, y
# la relación se lee desde AMBOS lados.
#
# Dos decisiones que sostienen todo lo demás:
#
#   1. El enlace se guarda en UN SOLO sentido. Guardarlo en los dos obligaría a
#      mantenerlos sincronizados y bastaría un borrado a medias para que
#      quedaran contradiciéndose.
#
#   2. La vista inversa es un ÍNDICE DERIVADO por request, no una clave de
#      sesión. Persistirlo sería garantizar que se desincronice del grafo que
#      describe: cada mutación de tarea, entrada o nodo tendría que acordarse de
#      actualizarlo.
#
# Los identificadores son `"<tipo>:<id>"`. Un nodo de lienzo necesita saber en
# qué lienzo vive, así que su id viaja como `"<canvas_id>/<node_id>"`.

# --- Universo de destinos vivos ----------------------------------------------
#
# Qué existe AHORA. Es contra esto que se limpian los enlaces colgantes.
.bit_link_ids_vivos <- function(s) {
  ids <- character(0)

  plan <- s$plan_trabajo %||% NULL
  if (is.list(plan)) {
    tareas <- plan$tasks %||% list()
    ids <- c(ids, vapply(tareas, function(t) .bit_vinculo_clave("tarea", calc_str(t$id, "")), character(1)))
  }

  entradas <- s$diseno_estudio_bitacora %||% list()
  if (length(entradas)) {
    ids <- c(ids, vapply(entradas, function(e) .bit_vinculo_clave("entrada", calc_str(e$id, "")), character(1)))
  }

  canvas <- s$bitacora_canvas %||% NULL
  if (is.list(canvas)) {
    for (lienzo in canvas$canvases %||% list()) {
      lid <- calc_str(lienzo$id, "")
      if (!nzchar(lid)) next
      ids <- c(ids, .bit_vinculo_clave("lienzo", lid))
      for (nodo in lienzo$nodes %||% list()) {
        nid <- calc_str(nodo$id, "")
        if (nzchar(nid)) ids <- c(ids, .bit_vinculo_clave("nodo", paste0(lid, "/", nid)))
      }
    }
  }

  unique(ids[nzchar(ids)])
}

# --- Índice de retroenlaces --------------------------------------------------
#
# PURO y por request. Recorre todo el grafo una vez; con los topes del módulo
# (500 tareas, 300 entradas, 500 nodos por lienzo) es despreciable.
#
# Devuelve, para cada destino, quién lo apunta. Es lo que permite que un hito
# muestre las entradas que lo documentan sin que esas entradas estén duplicadas
# dentro del hito.
.bit_link_indice <- function(s) {
  por_destino <- list()

  agregar <- function(origen_tipo, origen_id, origen_label, vinculos) {
    for (v in vinculos %||% list()) {
      destino <- .bit_vinculo_clave(v$target_type, v$target_id)
      if (!nzchar(destino)) next
      entrada <- list(
        source_type = origen_tipo,
        source_id = origen_id,
        source_label = origen_label,
        relation = calc_str(v$relation, "menciona")
      )
      previas <- por_destino[[destino]] %||% list()
      por_destino[[destino]] <<- c(previas, list(entrada))
    }
  }

  plan <- s$plan_trabajo %||% NULL
  if (is.list(plan)) {
    for (t in plan$tasks %||% list()) {
      agregar("tarea", calc_str(t$id, ""), calc_str(t$activity, ""), t$links)
    }
  }

  for (e in s$diseno_estudio_bitacora %||% list()) {
    agregar("entrada", calc_str(e$id, ""), calc_str(e$title, ""), e$links)
  }

  canvas <- s$bitacora_canvas %||% NULL
  if (is.list(canvas)) {
    for (lienzo in canvas$canvases %||% list()) {
      lid <- calc_str(lienzo$id, "")
      for (nodo in lienzo$nodes %||% list()) {
        agregar("nodo", paste0(lid, "/", calc_str(nodo$id, "")),
                calc_str(nodo$text, ""), nodo$links)
      }
    }
  }

  por_destino
}

# --- Limpieza de enlaces colgantes -------------------------------------------
#
# Se invoca desde TODAS las rutas de borrado. Sin esto, borrar un hito dejaría
# entradas apuntando a un id que ya no existe: el spec pide explícitamente que
# no queden referencias rotas silenciosas.
.bit_link_gc <- function(s) {
  vivos <- .bit_link_ids_vivos(s)
  limpiar <- function(vinculos) {
    Filter(function(v) .bit_vinculo_clave(v$target_type, v$target_id) %in% vivos, vinculos %||% list())
  }

  plan <- s$plan_trabajo %||% NULL
  if (is.list(plan)) {
    plan$tasks <- lapply(plan$tasks %||% list(), function(t) {
      t$links <- limpiar(t$links)
      t
    })
    s$plan_trabajo <- plan
  }

  entradas <- s$diseno_estudio_bitacora %||% list()
  if (length(entradas)) {
    s$diseno_estudio_bitacora <- lapply(entradas, function(e) {
      e$links <- limpiar(e$links)
      e
    })
  }

  canvas <- s$bitacora_canvas %||% NULL
  if (is.list(canvas)) {
    canvas$canvases <- lapply(canvas$canvases %||% list(), function(lienzo) {
      lienzo$nodes <- lapply(lienzo$nodes %||% list(), function(nodo) {
        nodo$links <- limpiar(nodo$links)
        nodo
      })
      lienzo
    })
    s$bitacora_canvas <- canvas
  }

  s
}

# --- Resumen vivo de un destino ----------------------------------------------
#
# Lo que un nodo de referencia del lienzo muestra. Se calcula en cada lectura a
# propósito: un nodo que guardara una copia del título mostraría el título viejo
# después de editar el hito, y el spec pide que el cambio se refleje.
.bit_link_resumen <- function(s, tipo, id) {
  vacio <- list(existe = FALSE, tipo = tipo, id = id, titulo = "", detalle = "",
                estado = "", fase = "", fecha = "")

  if (identical(tipo, "tarea")) {
    plan <- s$plan_trabajo %||% NULL
    if (!is.list(plan)) return(vacio)
    hit <- Filter(function(t) identical(calc_str(t$id, ""), id), plan$tasks %||% list())
    if (!length(hit)) return(vacio)
    t <- hit[[1]]
    return(list(
      existe = TRUE, tipo = tipo, id = id,
      titulo = calc_str(t$activity, ""),
      detalle = calc_str(t$responsible, ""),
      estado = calc_str(t$status, ""),
      fase = calc_str(t$fase, ""),
      fecha = calc_str(t$start_date, "")
    ))
  }

  if (identical(tipo, "entrada")) {
    hit <- Filter(function(e) identical(calc_str(e$id, ""), id), s$diseno_estudio_bitacora %||% list())
    if (!length(hit)) return(vacio)
    e <- hit[[1]]
    return(list(
      existe = TRUE, tipo = tipo, id = id,
      titulo = calc_str(e$title, ""),
      detalle = .bit_texto(e$body, 160L),
      estado = calc_str(e$tone, ""),
      fase = calc_str(e$module_id, ""),
      fecha = substr(calc_str(e$occurred_at, ""), 1L, 10L)
    ))
  }

  if (identical(tipo, "lienzo")) {
    canvas <- s$bitacora_canvas %||% NULL
    if (!is.list(canvas)) return(vacio)
    hit <- Filter(function(l) identical(calc_str(l$id, ""), id), canvas$canvases %||% list())
    if (!length(hit)) return(vacio)
    l <- hit[[1]]
    return(list(
      existe = TRUE, tipo = tipo, id = id,
      titulo = calc_str(l$title, "Lienzo"),
      detalle = sprintf("%d nodos", length(l$nodes %||% list())),
      estado = "", fase = "", fecha = ""
    ))
  }

  vacio
}

# Resúmenes de todo lo referenciado desde algún lado. Viaja en el payload para
# que el lienzo no tenga que pedir uno por nodo.
.bit_link_resumenes <- function(s) {
  indice <- .bit_link_indice(s)
  destinos <- names(indice)
  if (!length(destinos)) return(list())
  out <- lapply(destinos, function(clave) {
    partes <- strsplit(clave, ":", fixed = TRUE)[[1]]
    tipo <- partes[[1]]
    id <- paste(partes[-1], collapse = ":")
    .bit_link_resumen(s, tipo, id)
  })
  stats::setNames(out, destinos)
}

# --- Escritura ---------------------------------------------------------------

.bit_link_origen_valido <- function(tipo) {
  calc_enum(tipo, c("tarea", "entrada", "nodo"), "")
}

# Agrega un enlace desde una entidad hacia otra. Idempotente: enlazar dos veces
# lo mismo no duplica.
.bit_link_agregar <- function(s, origen_tipo, origen_id, vinculo) {
  origen_tipo <- .bit_link_origen_valido(origen_tipo)
  if (!nzchar(origen_tipo)) {
    stop_api(400, "E_BITACORA_VINCULO_ORIGEN", "El origen del vínculo no es una entidad enlazable.")
  }
  v <- .bit_vinculo(vinculo)
  if (is.null(v)) {
    stop_api(400, "E_BITACORA_VINCULO_DESTINO", "El destino del vínculo no es válido.")
  }
  if (identical(.bit_vinculo_clave(origen_tipo, origen_id), .bit_vinculo_clave(v$target_type, v$target_id))) {
    stop_api(400, "E_BITACORA_VINCULO_PROPIO", "Una entidad no puede enlazarse consigo misma.")
  }
  if (!(.bit_vinculo_clave(v$target_type, v$target_id) %in% .bit_link_ids_vivos(s))) {
    stop_api(404, "E_BITACORA_VINCULO_DESTINO", "Ese destino ya no existe en el proyecto.")
  }

  aplicar <- function(actuales) {
    .bit_vinculos(c(actuales %||% list(), list(v)),
                  origen = .bit_vinculo_clave(origen_tipo, origen_id))
  }
  .bit_link_mutar(s, origen_tipo, origen_id, aplicar)
}

.bit_link_quitar <- function(s, origen_tipo, origen_id, destino_tipo, destino_id) {
  clave <- .bit_vinculo_clave(destino_tipo, destino_id)
  aplicar <- function(actuales) {
    Filter(function(v) !identical(.bit_vinculo_clave(v$target_type, v$target_id), clave),
           actuales %||% list())
  }
  .bit_link_mutar(s, .bit_link_origen_valido(origen_tipo), origen_id, aplicar)
}

# Aplica una transformación a los `links` de la entidad de origen, sea del tipo
# que sea. Un solo lugar para las tres entidades evita tres copias que puedan
# divergir.
.bit_link_mutar <- function(s, origen_tipo, origen_id, aplicar) {
  if (identical(origen_tipo, "tarea")) {
    plan <- s$plan_trabajo %||% NULL
    if (!is.list(plan)) stop_api(404, "E_BITACORA_VINCULO_ORIGEN", "El cronograma no tiene esa actividad.")
    idx <- which(vapply(plan$tasks %||% list(), function(t) identical(calc_str(t$id, ""), origen_id), logical(1)))
    if (!length(idx)) stop_api(404, "E_BITACORA_VINCULO_ORIGEN", "Esa actividad ya no existe.")
    plan$tasks[[idx[[1L]]]]$links <- aplicar(plan$tasks[[idx[[1L]]]]$links)
    s$plan_trabajo <- plan
    return(s)
  }

  if (identical(origen_tipo, "entrada")) {
    entradas <- s$diseno_estudio_bitacora %||% list()
    idx <- which(vapply(entradas, function(e) identical(calc_str(e$id, ""), origen_id), logical(1)))
    if (!length(idx)) stop_api(404, "E_BITACORA_VINCULO_ORIGEN", "Esa entrada ya no existe.")
    entradas[[idx[[1L]]]]$links <- aplicar(entradas[[idx[[1L]]]]$links)
    s$diseno_estudio_bitacora <- entradas
    return(s)
  }

  if (identical(origen_tipo, "nodo")) {
    partes <- strsplit(origen_id, "/", fixed = TRUE)[[1]]
    if (length(partes) < 2L) stop_api(400, "E_BITACORA_VINCULO_ORIGEN", "El nodo debe indicarse como <lienzo>/<nodo>.")
    lienzo_id <- partes[[1]]
    nodo_id <- paste(partes[-1], collapse = "/")
    canvas <- s$bitacora_canvas %||% NULL
    if (!is.list(canvas)) stop_api(404, "E_BITACORA_VINCULO_ORIGEN", "Ese lienzo ya no existe.")
    li <- which(vapply(canvas$canvases %||% list(), function(l) identical(calc_str(l$id, ""), lienzo_id), logical(1)))
    if (!length(li)) stop_api(404, "E_BITACORA_VINCULO_ORIGEN", "Ese lienzo ya no existe.")
    nodos <- canvas$canvases[[li[[1L]]]]$nodes %||% list()
    ni <- which(vapply(nodos, function(n) identical(calc_str(n$id, ""), nodo_id), logical(1)))
    if (!length(ni)) stop_api(404, "E_BITACORA_VINCULO_ORIGEN", "Ese nodo ya no existe.")
    nodos[[ni[[1L]]]]$links <- aplicar(nodos[[ni[[1L]]]]$links)
    canvas$canvases[[li[[1L]]]]$nodes <- nodos
    s$bitacora_canvas <- canvas
    return(s)
  }

  stop_api(400, "E_BITACORA_VINCULO_ORIGEN", "El origen del vínculo no es una entidad enlazable.")
}

# --- Payload -----------------------------------------------------------------

.bit_vinculos_payload <- function(s) {
  indice <- .bit_link_indice(s)
  list(
    schema = "bitacora_vinculos_v1",
    total = sum(vapply(indice, length, integer(1)), 0L),
    por_destino = indice,
    resumenes = .bit_link_resumenes(s)
  )
}
