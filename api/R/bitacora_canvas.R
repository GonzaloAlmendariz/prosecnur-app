# =============================================================================
# Modelo del lienzo espacial (ADR 0047)
# =============================================================================
#
# El lienzo es la cuarta vista del subsistema y la que aporta la RAMIFICACIÓN:
# el cronograma es lineal por naturaleza —una etapa detrás de otra— pero
# un estudio real se bifurca, y esa forma no entra en una línea de tiempo.
#
# Referencia conceptual: Obsidian Canvas. Se replica el modelo de interacción,
# no la interfaz: lienzo infinito, nodos que se conectan a mano, y nodos que son
# VENTANAS a otra cosa en vez de copias de ella.
#
# Decisiones de forma:
#
#   - Los grupos son nodos de tipo `grupo` con caja, no una tercera colección.
#     La pertenencia es geométrica, igual que en Obsidian: así no hay listas de
#     miembros que puedan quedar con ids colgantes.
#
#   - El color guarda el NOMBRE de un token semántico, nunca un hexadecimal. Un
#     color literal congelaría el modo claro y rompería el oscuro.
#
#   - Un nodo de referencia guarda solo `{target_type, target_id}`. El título y
#     el estado se resuelven en cada lectura (`.bit_link_resumen`), que es lo
#     que hace que editar un hito se refleje en su nodo.

BITACORA_CANVAS_SCHEMA <- "bitacora_canvas_v1"

# Topes por lienzo. El objetivo de rendimiento del ADR son 200 nodos y 300
# aristas; el tope deja margen y a la vez impide que un import haga crecer el
# .pulso sin techo.
BITACORA_MAX_NODOS <- 500L
BITACORA_MAX_ARISTAS <- 800L
BITACORA_MAX_LIENZOS <- 20L

BITACORA_TIPOS_NODO <- c("texto", "referencia", "grupo")
BITACORA_COLORES_NODO <- c("neutro", "acento", "exito", "riesgo", "info", "aviso")
BITACORA_ANCLAS_ARISTA <- c("t", "r", "b", "l")

.bit_canvas_vacio <- function() {
  list(
    schema = BITACORA_CANVAS_SCHEMA,
    updated_at = "",
    active_canvas_id = "",
    canvases = list()
  )
}

# Numérico acotado al rango, con default solo si el valor es ilegible.
#
# Es lo que `calc_num` NO hace: ahí un valor fuera de rango devuelve el default,
# que para una geometría significa perder la posición o el tamaño en vez de
# corregirlos.
.bit_acotar <- function(x, default, minimo, maximo) {
  v <- suppressWarnings(as.numeric(if (is.list(x)) (x[[1]] %||% NA) else x))
  if (length(v) != 1L || !is.finite(v)) return(default)
  min(maximo, max(minimo, v))
}

.bit_canvas_viewport <- function(x) {
  if (is.null(x) || !is.list(x)) x <- list()
  list(
    x = calc_num(x$x, 0),
    y = calc_num(x$y, 0),
    # El zoom se acota acá y no solo en el cliente: un `.pulso` importado con
    # zoom 0 dejaría el lienzo invisible sin forma de recuperarlo.
    zoom = .bit_acotar(x$zoom, 1, 0.25, 2.5)
  )
}

.bit_canvas_nodo <- function(x = list()) {
  if (is.null(x) || !is.list(x)) return(NULL)
  id <- .bit_texto(x$id, 80L)
  if (!nzchar(id)) id <- .bit_id("nodo")
  tipo <- calc_enum(x$type %||% x$tipo, BITACORA_TIPOS_NODO, "texto")

  ref <- NULL
  if (identical(tipo, "referencia")) {
    destino_tipo <- calc_enum((x$ref %||% list())$target_type, BITACORA_TIPOS_DESTINO, "")
    destino_id <- .bit_texto((x$ref %||% list())$target_id, 160L)
    # Un nodo de referencia sin destino no es una referencia: degrada a texto en
    # vez de quedar como una ventana a la nada.
    if (nzchar(destino_tipo) && nzchar(destino_id)) {
      ref <- list(target_type = destino_tipo, target_id = destino_id)
    } else {
      tipo <- "texto"
    }
  }

  list(
    id = id,
    type = tipo,
    x = calc_num(x$x, 0),
    y = calc_num(x$y, 0),
    # `.bit_acotar` y no `calc_num(min=, max=)`: ese helper devuelve el DEFAULT
    # cuando el valor cae fuera de rango, así que un nodo guardado a 5000px
    # saltaría a 220 en vez de recortarse a 4000 — perdería su tamaño en vez de
    # ajustarlo.
    w = .bit_acotar(x$w, 220, 40, 4000),
    h = .bit_acotar(x$h, 120, 32, 4000),
    z = calc_int(x$z, 0L, min = 0L, max = 100000L),
    color = calc_enum(x$color, BITACORA_COLORES_NODO, "neutro"),
    text = .bit_texto(x$text, 4000L),
    items = .bit_canvas_items(x$items),
    ref = ref,
    links = .bit_vinculos(x$links)
  )
}

# Tope de anotaciones dentro de un cuadro. Una tarjeta con 40 viñetas dejó de
# ser un nodo de un mapa: es un documento, y para eso está la bitácora.
BITACORA_MAX_ITEMS_NODO <- 12L

#' Anotaciones propias de un nodo.
#'
#' Conviven con el resumen vivo sin mezclarse: el resumen dice qué ES el destino
#' y lo resuelve la app; los items dicen qué anotó el usuario SOBRE él y no los
#' toca nadie más. Por eso viven en el nodo y no en el destino — anotar «faltó
#' el criterio de edad» sobre Validación en ESTE mapa no puede reescribir la
#' sección Validación para todo el proyecto.
.bit_canvas_items <- function(x) {
  if (is.null(x) || !is.list(x)) return(list())
  fuera <- lapply(x, function(item) {
    texto <- .bit_texto(if (is.list(item)) item$text else item, 240L)
    if (!nzchar(texto)) return(NULL)
    list(
      id = { i <- .bit_texto(if (is.list(item)) item$id else "", 80L); if (nzchar(i)) i else .bit_id("item") },
      text = texto,
      done = calc_bool(if (is.list(item)) item$done else FALSE, FALSE)
    )
  })
  fuera <- Filter(Negate(is.null), fuera)
  if (length(fuera) > BITACORA_MAX_ITEMS_NODO) fuera <- fuera[seq_len(BITACORA_MAX_ITEMS_NODO)]
  unname(fuera)
}

.bit_canvas_arista <- function(x = list(), ids_nodos = character(0)) {
  if (is.null(x) || !is.list(x)) return(NULL)
  desde <- .bit_texto(x$from_node %||% x$fromNode, 80L)
  hasta <- .bit_texto(x$to_node %||% x$toNode, 80L)
  if (!nzchar(desde) || !nzchar(hasta)) return(NULL)
  # Una arista hacia un nodo que no existe no se dibuja: se descarta al leer,
  # que es más barato y más honesto que arrastrarla rota.
  if (length(ids_nodos) && (!(desde %in% ids_nodos) || !(hasta %in% ids_nodos))) return(NULL)
  # Un bucle sobre el mismo nodo no aporta y complica el trazado.
  if (identical(desde, hasta)) return(NULL)

  id <- .bit_texto(x$id, 80L)
  if (!nzchar(id)) id <- .bit_id("arista")
  list(
    id = id,
    from_node = desde,
    from_anchor = calc_enum(x$from_anchor %||% x$fromAnchor, BITACORA_ANCLAS_ARISTA, "r"),
    to_node = hasta,
    to_anchor = calc_enum(x$to_anchor %||% x$toAnchor, BITACORA_ANCLAS_ARISTA, "l"),
    label = .bit_texto(x$label, 120L),
    relation = calc_enum(x$relation, BITACORA_RELACIONES, "menciona")
  )
}

.bit_canvas_lienzo <- function(x = list()) {
  if (is.null(x) || !is.list(x)) return(NULL)
  id <- .bit_texto(x$id, 80L)
  if (!nzchar(id)) id <- .bit_id("lienzo")

  nodos <- Filter(Negate(is.null), lapply(x$nodes %||% list(), .bit_canvas_nodo))
  # Ids duplicados romperían el mapa de aristas: gana el primero.
  ids <- vapply(nodos, function(n) n$id, character(1))
  nodos <- nodos[!duplicated(ids)]
  nodos <- utils::head(nodos, BITACORA_MAX_NODOS)
  ids <- vapply(nodos, function(n) n$id, character(1))

  aristas <- Filter(Negate(is.null), lapply(x$edges %||% list(), .bit_canvas_arista, ids_nodos = ids))
  claves <- vapply(aristas, function(a) paste0(a$from_node, ">", a$to_node), character(1))
  aristas <- aristas[!duplicated(claves)]
  aristas <- utils::head(aristas, BITACORA_MAX_ARISTAS)

  list(
    id = id,
    title = .bit_texto(x$title, 120L) %|na|% "Lienzo",
    created_at = .bit_marca(x$created_at) %|na|% .bit_now_iso(),
    updated_at = .bit_marca(x$updated_at),
    archived_at = .bit_marca(x$archived_at),
    viewport = .bit_canvas_viewport(x$viewport),
    nodes = nodos,
    edges = aristas
  )
}

# Default cuando el texto normalizado quedó vacío. `%||%` no sirve: el valor no
# es NULL sino "".
`%|na|%` <- function(a, b) if (is.null(a) || !nzchar(a)) b else a

.bit_canvas_leer <- function(s) {
  crudo <- s$bitacora_canvas %||% NULL
  if (is.null(crudo) || !is.list(crudo)) return(.bit_canvas_vacio())
  lienzos <- Filter(Negate(is.null), lapply(crudo$canvases %||% list(), .bit_canvas_lienzo))
  lienzos <- utils::head(lienzos, BITACORA_MAX_LIENZOS)
  activo <- .bit_texto(crudo$active_canvas_id, 80L)
  ids <- vapply(lienzos, function(l) l$id, character(1))
  if (!(activo %in% ids)) activo <- if (length(ids)) ids[[1L]] else ""
  list(
    schema = BITACORA_CANVAS_SCHEMA,
    updated_at = .bit_marca(crudo$updated_at),
    active_canvas_id = activo,
    canvases = lienzos
  )
}

.bit_canvas_guardar <- function(sid, canvas) {
  canvas$schema <- BITACORA_CANVAS_SCHEMA
  canvas$updated_at <- .bit_now_iso()
  session_set(sid, "bitacora_canvas", canvas)
  canvas
}

# --- Operaciones -------------------------------------------------------------

.bit_canvas_indice <- function(canvas, id) {
  idx <- which(vapply(canvas$canvases %||% list(),
                      function(l) identical(calc_str(l$id, ""), id), logical(1)))
  if (!length(idx)) {
    stop_api(404, "E_BITACORA_LIENZO_NO_EXISTE", sprintf("El lienzo '%s' ya no existe.", id))
  }
  idx[[1L]]
}

.bit_canvas_crear <- function(canvas, title = NULL) {
  if (length(canvas$canvases %||% list()) >= BITACORA_MAX_LIENZOS) {
    stop_api(409, "E_BITACORA_LIENZO_TOPE",
             sprintf("Un proyecto admite hasta %d lienzos. Archiva alguno antes de crear otro.",
                     BITACORA_MAX_LIENZOS))
  }
  nombre <- .bit_texto(title, 120L)
  if (!nzchar(nombre)) {
    nombre <- sprintf("Lienzo %d", length(canvas$canvases %||% list()) + 1L)
  }
  nuevo <- .bit_canvas_lienzo(list(id = .bit_id("lienzo"), title = nombre))
  canvas$canvases <- c(canvas$canvases %||% list(), list(nuevo))
  # El lienzo recién creado pasa a ser el activo: crearlo y no aterrizar en él
  # obligaría a un segundo clic para ver lo que se acaba de pedir.
  canvas$active_canvas_id <- nuevo$id
  canvas
}

# Reemplaza el lienzo completo con lo que manda el cliente, normalizado.
#
# El id de la ruta manda sobre el del cuerpo: si no, un cliente con estado
# viejo podría sobrescribir un lienzo distinto del que cree estar editando.
.bit_canvas_reemplazar <- function(canvas, id, entrante) {
  i <- .bit_canvas_indice(canvas, id)
  previo <- canvas$canvases[[i]]
  if (is.null(entrante) || !is.list(entrante)) entrante <- list()
  entrante$id <- id
  # `created_at` es del lienzo, no del cliente: dejarlo viajar permitiría
  # reescribir cuándo se creó.
  entrante$created_at <- previo$created_at
  siguiente <- .bit_canvas_lienzo(entrante)
  siguiente$updated_at <- .bit_now_iso()
  canvas$canvases[[i]] <- siguiente
  canvas$active_canvas_id <- id
  canvas
}

.bit_canvas_borrar <- function(canvas, id) {
  .bit_canvas_indice(canvas, id)
  canvas$canvases <- Filter(function(l) !identical(calc_str(l$id, ""), id),
                            canvas$canvases %||% list())
  ids <- vapply(canvas$canvases %||% list(), function(l) l$id, character(1))
  if (!(calc_str(canvas$active_canvas_id, "") %in% ids)) {
    canvas$active_canvas_id <- if (length(ids)) ids[[1L]] else ""
  }
  canvas
}

# Quita las aristas cuyos extremos ya no existen. `.bit_canvas_lienzo` ya lo
# hace al leer; esto existe para poder llamarlo explícitamente tras borrar
# nodos, sin depender del round-trip de lectura.
.bit_canvas_gc_aristas <- function(lienzo) {
  ids <- vapply(lienzo$nodes %||% list(), function(n) calc_str(n$id, ""), character(1))
  lienzo$edges <- Filter(function(a) {
    a$from_node %in% ids && a$to_node %in% ids
  }, lienzo$edges %||% list())
  lienzo
}
