# La conversación app↔Sheets del libro de aulas en un solo gesto — unidad B7.
#
# Dictado textual de Gonzalo (2026-08-31): «sigue con el sheets, la idea es que
# se hablen entre sí y cumpla con todos los estandares ya establecidos y pueda
# comunicarse bien con la app». El gesto único: el sync de aulas, con
# `libro_sheets` recordado, LEE del Sheets las hojas del equipo y RE-PUBLICA
# las de la app.
#
# Orden pineado: LEER antes de PUBLICAR. Leer primero es lo que hace el ciclo
# idempotente —lo que se publica ya incorpora lo que el equipo escribió— y lo
# que impide publicar un control desactualizado como verdad del día.
#
# La función es TOTAL a propósito: ninguna rama lanza. El sync de aulas la
# invoca en su payload y un fallo del Sheets no puede tumbar el sync entero;
# el resultado declara `conversado` y, cuando no, el `motivo` con su `mensaje`
# (el aviso dice la causa, no solo el hecho).
#
# Presupuesto de llamadas (pineado en test-monitoreo-aulas-conversar.R): el
# segundo ciclo sin cambios cuesta ≤ 6 requests — 3 lecturas de pestaña + las
# 3 del ciclo sin cambios del publicador — SIN holgura. Por eso el camino
# normal no añade ni un GET propio: la sonda de metadata solo corre en la rama
# de fallo de lectura, para distinguir el documento virgen.
#
# Lecturas con `[[` de punta a punta: el `$` de R parcial-matchea (la lección
# de `config$plan` pescando `plan_rows`).

# Las hojas que el libro publica; si CUALQUIERA existe en el remoto, el
# documento no es virgen. Reúne las del equipo y las de la app del publicador
# (única fuente de esos nombres: dos listas que nadie ata es el patrón que se
# tragaba pestañas).
.macv_hojas_libro <- function() {
  c(.malp_hojas_equipo(), .malp_hojas_app())
}

# La mitad `leido` del resultado: el resumen de la importación SIN las listas
# pesadas (plan/partes/control ya quedaron en la sesión; repetirlas en el
# payload del sync duplicaría el estado que `state` ya transporta).
.macv_resumen_leido <- function(out) {
  out <- out %||% list()
  list(
    # Un libro que llega solo con la hoja de campo no trae plan y la fusión no
    # corre: se declara en cero, no se omite (el consumidor no adivina).
    fusion = out[["fusion"]] %||% list(actualizadas = 0L, nuevas = 0L, intactas = 0L),
    hojas_ausentes = out[["hojas_ausentes"]] %||% list(),
    control_sin_nombre = out[["control_sin_nombre"]] %||% list(),
    agenda_campos_ausentes = out[["agenda_campos_ausentes"]] %||% list(),
    resumen = out[["resumen"]] %||% list()
  )
}

#' Conversa con el Google Sheets del operativo: lee lo del equipo y re-publica
#' lo de la app.
#'
#' Sin destino recordado no hace NADA (ni una llamada a la API) y lo declara
#' con `motivo = "sin_destino"`: el sync sigue como si esta unidad no
#' existiera.
#'
#' Con destino, en este orden: (1) LEE vía
#' `aulas_libro_importar_sheets_en_sesion()` —su fusión ya aplica dueño, alias
#' castellano, cero-es-dato, nada-se-blanquea y partes→plan de A10—; (2)
#' PUBLICA las hojas de la app por el núcleo de publicar-libro
#' (`monitoreo_aulas_publicar_libro_en_sesion()`), que respeta las hojas del
#' equipo por la regla de dueño.
#'
#' Fallos, cada mitad con su motivo:
#'   - `lectura_fallo`: el remoto no se pudo leer → la publicación NO corre
#'     (jamás publicar un control desactualizado como verdad del día).
#'   - `documento_virgen` (DECISIÓN DEL LEAD, 2026-08-31): si la lectura vuelve
#'     vacía pero el documento RESPONDE y no tiene NINGUNA pestaña del libro,
#'     no es un fallo — es «nada que leer aún». El gesto publica igual (la
#'     siembra crea las hojas del equipo y las de la app) y devuelve
#'     `conversado = TRUE` con `motivo_lectura = "documento_virgen"` y
#'     `leido = NULL`. La sonda es UN GET de metadata que solo corre en esta
#'     rama; una pestaña del libro presente pero ilegible sigue siendo
#'     `lectura_fallo` (desde fuera no se distingue de un GET caído, y ante la
#'     duda no se escribe).
#'   - `publicacion_fallo`: la lectura fue y la escritura no → lo leído SE
#'     CONSERVA en sesión (la mitad buena no se revierte) y viaja en `leido`.
#'
#' @param sid sesión.
#' @param cfg config de monitoreo completa (de donde sale el destino).
#' @return lista con `conversado` y, según la rama: `motivo`, `mensaje`,
#'   `motivo_lectura`, `leido` (resumen de la importación) y `publicado`
#'   (resumen por hoja de publicar-libro).
#' @keywords internal
monitoreo_aulas_conversar_libro <- function(sid, cfg = list()) {
  destino <- monitoreo_aulas_libro_destino(cfg)
  if (!nzchar(destino)) {
    return(list(conversado = FALSE, motivo = "sin_destino"))
  }

  # (1) LEER. Los errores por pestaña se tragan dentro de
  # `aulas_libro_leer_de_sheets()`; cuando NINGUNA respondió, la importación
  # lanza E_AULAS_SHEETS_SIN_PESTANAS (422) y es aquí donde se traduce.
  lectura <- tryCatch(
    list(ok = TRUE, out = aulas_libro_importar_sheets_en_sesion(sid, destino)),
    api_error = function(e) list(
      ok = FALSE,
      codigo = as.character(e$code %||% ""),
      mensaje = conditionMessage(e)
    ),
    error = function(e) list(ok = FALSE, codigo = "", mensaje = conditionMessage(e))
  )

  leido <- NULL
  motivo_lectura <- ""
  if (isTRUE(lectura[["ok"]])) {
    leido <- .macv_resumen_leido(lectura[["out"]])
  } else if (identical(lectura[["codigo"]], "E_AULAS_SHEETS_SIN_PESTANAS")) {
    # ¿Fallo o documento virgen? UN GET de metadata lo distingue.
    meta <- tryCatch(.monitoreo_sheets_metadata(destino), error = function(e) NULL)
    if (is.null(meta)) {
      # El documento ni responde: fallo real, y sin publicar.
      return(list(conversado = FALSE, motivo = "lectura_fallo", mensaje = lectura[["mensaje"]]))
    }
    remotas <- names(.monitoreo_sheets_tab_map(meta))
    if (any(.macv_hojas_libro() %in% remotas)) {
      # Hay pestañas del libro que no se pudieron leer: fallo real.
      return(list(conversado = FALSE, motivo = "lectura_fallo", mensaje = lectura[["mensaje"]]))
    }
    motivo_lectura <- "documento_virgen"
  } else {
    return(list(conversado = FALSE, motivo = "lectura_fallo", mensaje = lectura[["mensaje"]]))
  }

  # (2) PUBLICAR, sobre el estado FRESCO de la sesión (la importación de
  # arriba ya fusionó plan, partes y control). El destino va pineado: es el
  # mismo con el que se acaba de leer.
  publicacion <- tryCatch(
    # `leer_primero = FALSE`: esta conversación YA importó arriba, en su primer
    # paso. Publicar lee por su cuenta para quien llama al publicador a secas
    # —el equipo escribe en las hojas y publicar sin leer las contradice— pero
    # aquí sería pedir las cinco pestañas dos veces en el mismo ciclo.
    list(ok = TRUE, out = monitoreo_aulas_publicar_libro_en_sesion(
      sid, destino = destino, leer_primero = FALSE)),
    error = function(e) list(ok = FALSE, mensaje = conditionMessage(e))
  )
  if (!isTRUE(publicacion[["ok"]])) {
    return(list(
      conversado = FALSE,
      motivo = "publicacion_fallo",
      mensaje = publicacion[["mensaje"]],
      # Lo leído no se revierte: quedó en sesión y su resumen viaja igual.
      leido = leido
    ))
  }

  out <- list(conversado = TRUE, leido = leido, publicado = publicacion[["out"]])
  if (nzchar(motivo_lectura)) out[["motivo_lectura"]] <- motivo_lectura
  out
}

#' El payload del sync de aulas, con la conversación del libro incorporada.
#'
#' Es el gancho de neto cero de `/api/monitoreo/aulas/sync`
#' (router_monitoreo.R está congelado a crecimiento): una línea del router
#' llama aquí y esta función arma EXACTAMENTE el payload de siempre más, si
#' hay destino recordado, el bloque `libro_conversacion`.
#'
#' Decisión documentada: SIN destino el bloque va AUSENTE, no como no-op — el
#' payload queda byte a byte como hoy y el frontend distingue «no participa»
#' de «conversó y esto pasó» por presencia. La conversación corre ANTES de
#' armar `state`, para que el estado que viaja ya incluya lo importado; el
#' `dashboard` del sync se construyó antes y no se rehace aquí (mismo trato
#' que hoy: se refresca en el siguiente rebuild).
#'
#' @param sid sesión.
#' @param snapshot el snapshot recién guardado por el sync.
#' @param dashboard el dashboard recién construido por el sync.
#' @param saved_project el booleano que el sync ya calculaba.
#' @return el payload del endpoint.
#' @keywords internal
monitoreo_aulas_sync_payload <- function(sid, snapshot, dashboard, saved_project = FALSE) {
  cfg <- session_get(sid)$monitoreo_config %||% list()
  conversacion <- monitoreo_aulas_conversar_libro(sid, cfg)
  con_destino <- !identical(as.character(conversacion[["motivo"]] %||% ""), "sin_destino")
  if (con_destino) {
    # La conversación pudo mutar la sesión (plan/partes/control importados):
    # el proyecto abierto vuelve a marcarse sucio, igual que hizo el sync con
    # sus propias mutaciones.
    .monitoreo_mark_project_dirty_if_open(sid)
  }
  payload <- list(
    ok = TRUE,
    synced_at = snapshot$synced_at,
    dashboard = dashboard$aulas_universitarias_reports,
    state = .monitoreo_state_payload(sid),
    saved_project = isTRUE(saved_project)
  )
  if (con_destino) payload[["libro_conversacion"]] <- conversacion
  payload
}
