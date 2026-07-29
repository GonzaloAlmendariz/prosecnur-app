# =============================================================================
# Libro de disparos de avisos (ADR 0047)
# =============================================================================
#
# Lo único del subsistema de avisos que vive en el backend. La EVALUACIÓN corre
# en el cliente —Plumber no tiene planificador y "ahora" debe ser hora de pared
# local— y acá solo se conserva lo que debe sobrevivir a cerrar la app: qué
# avisos ya sonaron.
#
# Por qué un LIBRO y no un campo dentro de cada recordatorio: si el estado
# viviera en `task$reminders[[i]]$state`, editar los recordatorios de un hito
# —agregar uno, cambiar un offset— reescribiría la lista y reviviría avisos ya
# mostrados. El libro es independiente de la tarea y sobrevive a sus ediciones.
#
# La clave es `<task_id>|<reminder_id>|<ocurrencia_iso>`. Incluye la ocurrencia
# para que cada instancia de un hito recurrente tenga su propio disparo: cumplir
# la del martes no silencia la del miércoles.

BITACORA_AVISOS_SCHEMA <- "bitacora_avisos_v1"

# Tope del libro. Un estudio largo con recordatorios diarios podría acumular
# miles de entradas y el .pulso las cargaría todas en cada apertura.
BITACORA_MAX_AVISOS <- 500L

BITACORA_ESTADOS_AVISO <- c("disparado", "pospuesto", "descartado")

.bit_avisos_vacio <- function() {
  list(
    schema = BITACORA_AVISOS_SCHEMA,
    updated_at = "",
    last_evaluated_at = "",
    fired = list()
  )
}

.bit_aviso_clave <- function(task_id, reminder_id, ocurrencia) {
  paste0(
    .bit_texto(task_id, 160L), "|",
    .bit_texto(reminder_id, 160L), "|",
    .bit_texto(ocurrencia, 40L)
  )
}

.bit_aviso_entrada <- function(x = list()) {
  if (is.null(x) || !is.list(x)) x <- list()
  clave <- .bit_texto(x$clave %||% x$key, 400L)
  if (!nzchar(clave)) return(NULL)
  partes <- strsplit(clave, "|", fixed = TRUE)[[1]]
  list(
    clave = clave,
    task_id = .bit_texto(x$task_id %||% partes[1] %||% "", 160L),
    reminder_id = .bit_texto(x$reminder_id %||% partes[2] %||% "", 160L),
    occurrence = .bit_texto(x$occurrence %||% partes[3] %||% "", 40L),
    state = calc_enum(x$state, BITACORA_ESTADOS_AVISO, "disparado"),
    fired_at = .bit_marca(x$fired_at),
    snoozed_until = .bit_marca(x$snoozed_until),
    acknowledged_at = .bit_marca(x$acknowledged_at)
  )
}

.bit_avisos_leer <- function(s) {
  crudo <- s$bitacora_avisos %||% NULL
  if (is.null(crudo) || !is.list(crudo)) return(.bit_avisos_vacio())
  entradas <- Filter(Negate(is.null), lapply(crudo$fired %||% list(), .bit_aviso_entrada))
  # Una clave repetida es un bug de escritura; gana la primera, que es la más
  # antigua y por lo tanto la que registró el disparo original.
  claves <- vapply(entradas, function(e) e$clave, character(1))
  entradas <- entradas[!duplicated(claves)]
  list(
    schema = BITACORA_AVISOS_SCHEMA,
    updated_at = .bit_marca(crudo$updated_at),
    last_evaluated_at = .bit_marca(crudo$last_evaluated_at),
    fired = entradas
  )
}

# Recorta el libro conservando lo más reciente. Se llama en cada escritura para
# que el tope no dependa de que alguien se acuerde de limpiar.
.bit_avisos_gc <- function(libro, max_items = BITACORA_MAX_AVISOS) {
  entradas <- libro$fired %||% list()
  if (length(entradas) <= max_items) return(libro)
  orden <- order(vapply(entradas, function(e) e$fired_at, character(1)), decreasing = TRUE)
  libro$fired <- entradas[orden][seq_len(max_items)]
  libro
}

.bit_avisos_guardar <- function(sid, libro) {
  libro$schema <- BITACORA_AVISOS_SCHEMA
  libro$updated_at <- .bit_now_iso()
  libro <- .bit_avisos_gc(libro)
  session_set(sid, "bitacora_avisos", libro)
  libro
}

.bit_avisos_indice <- function(libro) {
  entradas <- libro$fired %||% list()
  if (!length(entradas)) return(list())
  stats::setNames(entradas, vapply(entradas, function(e) e$clave, character(1)))
}

# --- Reclamar ----------------------------------------------------------------
#
# IDEMPOTENTE por contrato: reclamar una clave ya disparada no la vuelve a
# marcar ni actualiza su marca de tiempo. Es lo que permite al cliente reclamar
# antes de presentar sin miedo a duplicar, y lo que hace inofensivo un reintento
# tras un error de red.
#
# Devuelve el libro más la lista de claves REALMENTE reclamadas en esta llamada,
# para que el cliente sepa cuáles le corresponde mostrar: si dos pestañas
# reclaman a la vez, solo una recibe la clave y solo esa la muestra.
.bit_aviso_reclamar <- function(sid, claves) {
  s <- session_get(sid)
  libro <- .bit_avisos_leer(s)
  indice <- .bit_avisos_indice(libro)

  claves <- unique(vapply(as.character(unlist(claves %||% list(), use.names = FALSE)),
                          function(k) .bit_texto(k, 400L), character(1), USE.NAMES = FALSE))
  claves <- claves[nzchar(claves)]

  ahora <- .bit_now_iso()
  nuevas <- character(0)
  for (clave in claves) {
    previa <- indice[[clave]]
    # Un `descartado` no se revive: el usuario ya dijo que no le interesa.
    if (!is.null(previa) && identical(previa$state, "descartado")) next
    if (!is.null(previa) && identical(previa$state, "disparado")) next
    entrada <- .bit_aviso_entrada(list(clave = clave, state = "disparado", fired_at = ahora))
    if (is.null(entrada)) next
    libro$fired <- c(libro$fired, list(entrada))
    indice[[clave]] <- entrada
    nuevas <- c(nuevas, clave)
  }

  libro$last_evaluated_at <- ahora
  libro <- .bit_avisos_guardar(sid, libro)
  list(libro = libro, reclamadas = as.list(nuevas))
}

# --- Posponer y descartar ----------------------------------------------------

.bit_aviso_posponer <- function(sid, clave, hasta) {
  clave <- .bit_texto(clave, 400L)
  if (!nzchar(clave)) stop_api(400, "E_BITACORA_AVISO_CLAVE", "Falta la clave del aviso.")
  hasta <- .bit_marca(hasta)
  if (!nzchar(hasta)) {
    stop_api(400, "E_BITACORA_AVISO_SNOOZE", "Posponer necesita hasta cuándo; sin eso el aviso no volvería nunca.")
  }
  s <- session_get(sid)
  libro <- .bit_avisos_leer(s)
  entradas <- libro$fired %||% list()
  idx <- which(vapply(entradas, function(e) identical(e$clave, clave), logical(1)))
  if (length(idx)) {
    entradas[[idx[[1L]]]]$state <- "pospuesto"
    entradas[[idx[[1L]]]]$snoozed_until <- hasta
  } else {
    entradas <- c(entradas, list(.bit_aviso_entrada(list(
      clave = clave, state = "pospuesto", fired_at = .bit_now_iso(), snoozed_until = hasta
    ))))
  }
  libro$fired <- entradas
  .bit_avisos_guardar(sid, libro)
}

.bit_aviso_descartar <- function(sid, clave) {
  clave <- .bit_texto(clave, 400L)
  if (!nzchar(clave)) stop_api(400, "E_BITACORA_AVISO_CLAVE", "Falta la clave del aviso.")
  s <- session_get(sid)
  libro <- .bit_avisos_leer(s)
  entradas <- libro$fired %||% list()
  idx <- which(vapply(entradas, function(e) identical(e$clave, clave), logical(1)))
  ahora <- .bit_now_iso()
  if (length(idx)) {
    entradas[[idx[[1L]]]]$state <- "descartado"
    entradas[[idx[[1L]]]]$snoozed_until <- ""
    entradas[[idx[[1L]]]]$acknowledged_at <- ahora
  } else {
    entradas <- c(entradas, list(.bit_aviso_entrada(list(
      clave = clave, state = "descartado", fired_at = ahora, acknowledged_at = ahora
    ))))
  }
  libro$fired <- entradas
  .bit_avisos_guardar(sid, libro)
}

# --- Payload -----------------------------------------------------------------
#
# El cliente necesita dos cosas distintas: qué claves NO debe volver a mostrar
# (disparadas y descartadas) y cuáles reaparecen a una hora (pospuestas). Se
# entregan separadas para que el motor no tenga que interpretar estados.
.bit_avisos_payload <- function(s) {
  libro <- .bit_avisos_leer(s)
  entradas <- libro$fired %||% list()

  silenciadas <- Filter(function(e) e$state %in% c("disparado", "descartado"), entradas)
  pospuestas <- Filter(function(e) identical(e$state, "pospuesto"), entradas)
  # Disparados que el usuario todavía no atendió. Es lo que el centro de avisos
  # y la campana muestran: sobrevive a recargar, porque un aviso que sonó sigue
  # pendiente hasta que alguien lo posponga o lo descarte.
  pendientes <- Filter(function(e) {
    identical(e$state, "disparado") && !nzchar(e$acknowledged_at)
  }, entradas)

  list(
    schema = BITACORA_AVISOS_SCHEMA,
    last_evaluated_at = libro$last_evaluated_at,
    total = length(entradas),
    silenciadas = as.list(vapply(silenciadas, function(e) e$clave, character(1))),
    pospuestas = lapply(pospuestas, function(e) list(clave = e$clave, hasta = e$snoozed_until)),
    pendientes = lapply(pendientes, function(e) {
      list(clave = e$clave, task_id = e$task_id, reminder_id = e$reminder_id,
           occurrence = e$occurrence, fired_at = e$fired_at)
    }),
    historial = lapply(utils::head(
      entradas[order(vapply(entradas, function(e) e$fired_at, character(1)), decreasing = TRUE)],
      50L
    ), function(e) {
      list(clave = e$clave, task_id = e$task_id, occurrence = e$occurrence,
           state = e$state, fired_at = e$fired_at, snoozed_until = e$snoozed_until)
    })
  )
}
