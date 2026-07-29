# =============================================================================
# Modelo del lienzo espacial (ADR 0047)
# =============================================================================
#
# El lienzo es la cuarta vista del subsistema y la que aporta la RAMIFICACIÓN:
# el cronograma es lineal por naturaleza —seis etapas, una detrás de otra— pero
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

.bit_canvas_viewport <- function(x) {
  if (is.null(x) || !is.list(x)) x <- list()
  list(
    x = calc_num(x$x, 0),
    y = calc_num(x$y, 0),
    # El zoom se acota acá y no solo en el cliente: un `.pulso` importado con
    # zoom 0 dejaría el lienzo invisible sin forma de recuperarlo.
    zoom = calc_num(x$zoom, 1, min = 0.2, max = 3)
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
    w = calc_num(x$w, 220, min = 40, max = 4000),
    h = calc_num(x$h, 120, min = 32, max = 4000),
    z = calc_int(x$z, 0L, min = 0L, max = 100000L),
    color = calc_enum(x$color, BITACORA_COLORES_NODO, "neutro"),
    text = .bit_texto(x$text, 4000L),
    ref = ref,
    links = .bit_vinculos(x$links)
  )
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
