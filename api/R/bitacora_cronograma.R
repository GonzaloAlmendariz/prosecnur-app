# =============================================================================
# Engine del cronograma de Bitácora (ADR 0047)
# =============================================================================
#
# Lo que el router de Bitácora llama para operar el cronograma: sembrar las
# fases del estudio, crear y editar rangos y entregables, archivar, duplicar y
# validar dependencias. `router_plan_trabajo.R` sigue siendo el dueño del
# formato del plan y del import/export de Excel; este engine trabaja sobre esa
# misma estructura (`plan$tasks`) sin duplicarla.

# --- Dependencias sin ciclos -------------------------------------------------
#
# DFS tricolor (blanco = sin visitar, gris = en la pila actual, negro = cerrado).
# Encontrar un gris es encontrar un ciclo, y el camino se reconstruye desde la
# pila para poder DECIRLE al usuario cuál es: "A bloquea a B, B bloquea a C, C
# bloquea a A" es accionable; "hay un ciclo" no lo es.
#
# Corre en el SERVIDOR y no solo en el formulario porque el import de Excel y el
# de JSON pueden introducir ciclos sin pasar por la UI.
.bit_cron_ciclo <- function(tasks) {
  ids <- vapply(tasks, function(t) calc_str(t$id, ""), character(1))
  bloqueadores <- lapply(tasks, function(t) {
    unlist(t$blocked_by %||% list(), recursive = TRUE, use.names = FALSE)
  })
  names(bloqueadores) <- ids

  color <- setNames(rep("blanco", length(ids)), ids)
  pila <- character(0)
  ciclo <- NULL

  visitar <- function(id) {
    if (!is.null(ciclo)) return(invisible(NULL))
    if (identical(color[[id]], "negro")) return(invisible(NULL))
    if (identical(color[[id]], "gris")) {
      # El ciclo es el tramo de la pila desde la aparición previa de este id.
      desde <- match(id, pila)
      ciclo <<- c(pila[desde:length(pila)], id)
      return(invisible(NULL))
    }
    color[[id]] <<- "gris"
    pila <<- c(pila, id)
    for (dep in bloqueadores[[id]] %||% character(0)) {
      # Una dependencia hacia una tarea que no existe no es un ciclo; la limpia
      # el garbage collector de vínculos, no la detección de ciclos.
      # `dep %in% names(color)` y no `color[[dep]]`: indexar por un nombre
      # ausente LANZA "subscript out of bounds" en vez de devolver NULL, así que
      # una guarda escrita como `if (!is.null(color[[dep]]))` nunca se evalúa.
      if (dep %in% names(color)) visitar(dep)
      if (!is.null(ciclo)) return(invisible(NULL))
    }
    pila <<- pila[-length(pila)]
    color[[id]] <<- "negro"
    invisible(NULL)
  }

  for (id in ids) {
    if (identical(color[[id]], "blanco")) visitar(id)
    if (!is.null(ciclo)) break
  }
  ciclo
}

# Nombra el ciclo con las actividades, no con los ids: el usuario no conoce
# `task_m_9f3c…`.
.bit_cron_exigir_sin_ciclos <- function(tasks) {
  ciclo <- .bit_cron_ciclo(tasks)
  if (is.null(ciclo)) return(invisible(TRUE))
  por_id <- setNames(
    vapply(tasks, function(t) calc_str(t$activity, calc_str(t$id, "?")), character(1)),
    vapply(tasks, function(t) calc_str(t$id, ""), character(1))
  )
  camino <- paste(vapply(ciclo, function(id) por_id[[id]] %||% id, character(1)), collapse = " → ")
  stop_api(
    409, "E_BITACORA_CICLO",
    sprintf("Esa dependencia crea un ciclo: %s. Quita uno de los bloqueos para cerrarla.", camino)
  )
}

# --- Buckets cronológicos ----------------------------------------------------
#
# El agrupado (vencidos / hoy / esta semana / más adelante) se calcula en el
# CLIENTE, no acá: "ahora" tiene que ser hora de pared local y `.plan_now_iso()`
# es UTC. Lo que sí aporta el servidor es la fecha de referencia de su propio
# reloj, para que el cliente pueda detectar un desfase grande y avisarlo en vez
# de mostrar datos silenciosamente corridos.
.bit_cron_hoy_servidor <- function() {
  format(Sys.Date(), "%Y-%m-%d")
}

# --- Siembra de fases --------------------------------------------------------
#
# Estado vacío útil: en vez de invitar a importar un Excel, se ofrece sembrar
# las fases del estudio con rangos vacíos para que el usuario solo ponga fechas.
# Idempotente: sembrar dos veces no duplica: se salta toda fase que ya exista.
.bit_cron_sembrar_fases <- function(plan, fases = BITACORA_FASES) {
  fases <- unique(vapply(as.character(fases), .bit_fase_valida, character(1), USE.NAMES = FALSE))
  fases <- fases[nzchar(fases)]
  if (!length(fases)) return(plan)

  tasks <- plan$tasks %||% list()
  existentes <- vapply(tasks, .bit_fase_de_tarea, character(1))
  # Solo cuentan como "ya existe" las que son la fase misma (rango declarado),
  # no cualquier actividad que caiga en esa fase: si el usuario ya tenía tareas
  # de campo sueltas, sembrar "Campo" sigue teniendo sentido.
  existentes <- existentes[vapply(tasks, function(t) isTRUE(t$fase_manual), logical(1))]

  for (fase in setdiff(fases, existentes)) {
    plan <- .bit_cron_crear(plan, list(
      activity = .bit_fase_label(fase),
      fase = fase,
      kind = if (identical(fase, "entregables")) "deliverable" else "activity",
      start_date = "",
      end_date = ""
    ))
  }
  plan
}

# --- Crear y editar ----------------------------------------------------------
#
# Envuelve a `.plan_create_task` para que la fase quede DECLARADA (y con ella
# los `sync_targets`), en vez de que la regex de `.plan_task_targets` la
# adivine desde el texto. Es el punto donde se materializa la inversión del
# ADR 0047.
.bit_cron_crear <- function(plan, patch) {
  if (is.null(patch) || !is.list(patch)) patch <- list()
  fase <- .bit_fase_valida(patch$fase)
  plan <- .plan_create_task(plan, patch)
  tasks <- plan$tasks %||% list()
  if (nzchar(fase) && length(tasks)) {
    idx <- length(tasks)
    tasks[[idx]]$fase <- fase
    tasks[[idx]]$fase_manual <- TRUE
    tasks[[idx]]$sync_targets <- as.list(.bit_targets_de_fase(fase))
    plan$tasks <- tasks
    plan <- .plan_rebuild_derived(plan)
  }
  .bit_cron_exigir_sin_ciclos(plan$tasks %||% list())
  plan
}

.bit_cron_editar <- function(plan, id, patch) {
  if (is.null(patch) || !is.list(patch)) patch <- list()
  fase <- .bit_fase_valida(patch$fase)
  plan <- .plan_update_task(plan, id, patch)

  tasks <- plan$tasks %||% list()
  idx <- which(vapply(tasks, function(t) identical(calc_str(t$id, ""), id), logical(1)))
  if (length(idx)) {
    i <- idx[[1L]]
    if (nzchar(fase)) {
      tasks[[i]]$fase <- fase
      tasks[[i]]$fase_manual <- TRUE
      tasks[[i]]$sync_targets <- as.list(.bit_targets_de_fase(fase))
    } else if (!isTRUE(tasks[[i]]$fase_manual)) {
      # Sin fase declarada, se re-deriva de los targets que la heurística acaba
      # de recalcular. Con fase declarada no se toca nada: es el freno.
      tasks[[i]]$fase <- .bit_fase_de_targets(tasks[[i]]$sync_targets)
    }
    if (!is.null(patch$blocked_by)) {
      tasks[[i]]$blocked_by <- .bit_bloqueadores(patch$blocked_by, propio = id)
    }
    if (!is.null(patch$priority)) tasks[[i]]$priority <- .bit_prioridad(patch$priority)
    if (!is.null(patch$tags)) tasks[[i]]$tags <- .bit_etiquetas(patch$tags)
    plan$tasks <- tasks
    plan <- .plan_rebuild_derived(plan)
  }

  .bit_cron_exigir_sin_ciclos(plan$tasks %||% list())
  plan
}

# --- Archivar, restaurar, duplicar, borrar -----------------------------------

.bit_cron_indice <- function(tasks, id) {
  idx <- which(vapply(tasks, function(t) identical(calc_str(t$id, ""), id), logical(1)))
  if (!length(idx)) {
    stop_api(404, "E_BITACORA_TAREA_NO_EXISTE", sprintf("La actividad '%s' ya no está en el cronograma.", id))
  }
  idx[[1L]]
}

.bit_cron_archivar <- function(plan, id, archivar = TRUE) {
  tasks <- plan$tasks %||% list()
  i <- .bit_cron_indice(tasks, id)
  tasks[[i]]$archived_at <- if (isTRUE(archivar)) .bit_now_iso() else ""
  plan$tasks <- tasks
  .plan_rebuild_derived(plan)
}

# Duplicar copia el contenido pero NO el rastro: ni el id, ni la provenencia de
# la grilla Excel, ni el estado de los recordatorios ya disparados. Un duplicado
# que heredara los avisos disparados nacería con su historial ya consumido.
.bit_cron_duplicar <- function(plan, id) {
  tasks <- plan$tasks %||% list()
  original <- tasks[[.bit_cron_indice(tasks, id)]]
  copia <- original
  copia$id <- paste0("task_m_", uuid::UUIDgenerate())
  copia$activity <- .bit_texto(paste0(calc_str(original$activity, ""), " (copia)"), 900L)
  copia$sheet <- ""
  copia$row <- NA_integer_
  copia$grid_start_col <- NA_integer_
  copia$grid_end_col <- NA_integer_
  copia$archived_at <- ""
  copia$reminders <- lapply(copia$reminders %||% list(), function(r) {
    r$id <- .bit_id("rem")
    r$state <- "programado"
    r$snoozed_until <- ""
    r$created_at <- .bit_now_iso()
    r
  })
  # Las dependencias no se copian: heredarlas es la forma más fácil de crear un
  # ciclo sin que el usuario lo haya pedido.
  copia$blocked_by <- list()
  copia$links <- list()
  tasks[[length(tasks) + 1L]] <- copia
  plan$tasks <- tasks
  .plan_rebuild_derived(plan)
}

.bit_cron_borrar <- function(plan, id) {
  tasks <- plan$tasks %||% list()
  .bit_cron_indice(tasks, id)
  plan$tasks <- Filter(function(t) !identical(calc_str(t$id, ""), id), tasks)
  # Sin esto quedarían dependencias apuntando a una tarea que ya no existe.
  plan$tasks <- lapply(plan$tasks, function(t) {
    t$blocked_by <- Filter(function(b) !identical(b, id), t$blocked_by %||% list())
    t
  })
  .plan_rebuild_derived(plan)
}

# --- Vista por fases ---------------------------------------------------------
#
# Lo que consume el compositor: una fila por fase con su rango agregado, cuántas
# actividades contiene y si el módulo correspondiente ya tiene evidencia. Se
# devuelven SIEMPRE las seis, tenga o no tareas: el compositor necesita mostrar
# las vacías para que el usuario pueda ponerles fechas.
.bit_cron_vista_fases <- function(s, plan) {
  tasks <- Filter(function(t) !nzchar(calc_str(t$archived_at, "")), plan$tasks %||% list())
  lapply(.bit_fases_catalogo(), function(f) {
    hits <- Filter(function(t) identical(.bit_fase_de_tarea(t), f$id), tasks)
    inicios <- vapply(hits, function(t) calc_str(t$start_date, ""), character(1))
    fines <- vapply(hits, function(t) calc_str(t$end_date, ""), character(1))
    inicios <- inicios[nzchar(inicios)]
    fines <- fines[nzchar(fines)]
    declarada <- Filter(function(t) isTRUE(t$fase_manual), hits)
    list(
      id = f$id,
      label = f$label,
      # Identidad: el frontend resuelve ícono y color desde el módulo.
      modulo = f$modulo,
      seccion = f$seccion,
      modulos = as.list(f$evidencia),
      task_count = length(hits),
      declarada = length(declarada) > 0L,
      start_date = if (length(inicios)) min(inicios) else "",
      end_date = if (length(fines)) max(fines) else "",
      evidence_state = if (isTRUE(.bit_fase_evidencia(s, f$id))) "evidence_available" else "planned_only",
      task_ids = as.list(vapply(hits, function(t) calc_str(t$id, ""), character(1)))
    )
  })
}
