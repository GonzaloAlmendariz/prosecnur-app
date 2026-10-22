# =============================================================================
# Monitoreo › Correo: del snapshot de Mailchimp a lo que se reporta
#
# Funciones puras (sin red ni sesión). Toman el snapshot que deja la lectura
# (`monitoreo_mailchimp_lectura.R`) y el universo de Monitoreo —el
# `case_rollup` del cruce, una fila por persona del universo con su actor y si
# cuenta como efectiva— y arman:
#
#   - por público: universo, invitados, correos inválidos, base alcanzable,
#     efectivas y tasas sobre las dos bases, bajas, quejas y el ritmo sugerido
#     para los recordatorios;
#   - por envío: el embudo entregados → aperturas → clics → respuestas, con sus
#     bajas y quejas, también abierto por público;
#   - la lista de correos inválidos (por token) para la DAA.
#
# El público de cada destinatario es el actor de su token en el universo, no la
# etiqueta del envío. Un correo inválido (rebote duro o `cleaned`) no es un «no
# respondió»: sale del denominador. Contrato:
# `docs/qa/checklist-monitoreo-mailchimp-t3-2026-10-22.md`.
# =============================================================================

# Umbrales propuestos para el ritmo de recordatorios (decisión D4 pendiente).
# La queja de 0.1 % y el tope de 0.3 % son los de Google y Yahoo para
# remitentes masivos; la baja de 0.5 % es una cota prudente para un estudio.
.MCM_UMBRALES <- list(baja_espaciar = 0.005, queja_espaciar = 0.001, queja_detener = 0.003)
.MCM_FUERA <- "Fuera del universo"

.mcm_llave <- function(token) {
  # La primera llave de `.monitoreo_code_keys`, vectorizada: con 45 mil tokens,
  # llamarla uno por uno costaba decenas de segundos en el hilo de la API.
  code <- toupper(gsub("[^A-Za-z0-9]+", "", as.character(token %||% character(0))))
  ifelse(!is.na(code) & nzchar(code), paste0("codigo:", code), "")
}

.mcm_tasa <- function(n, base) if (is.finite(base) && base > 0) n / base else NA_real_

# Una fila por persona del universo: llave, actor, efectiva y fecha de respuesta.
.mcm_universo <- function(case_rollup) {
  filas <- Filter(is.list, case_rollup %||% list())
  campo <- function(nombre) vapply(filas, function(r) .mcm_chr(r[[nombre]]), character(1))
  if (!length(filas)) {
    return(.mcm_df(list(llave = character(0), actor = character(0), efectiva = logical(0), respuesta_at = character(0))))
  }
  llave <- campo("case_key")
  llave[!grepl("^codigo:", llave)] <- ""
  respuesta_at <- campo("response_datetime")
  sin_hora <- !nzchar(respuesta_at)
  respuesta_at[sin_hora] <- campo("date")[sin_hora]
  efectiva <- vapply(filas, function(r) isTRUE(.monitoreo_bool(r$counts_in_advance, FALSE)), logical(1))
  respuesta_at[!efectiva] <- ""
  .mcm_df(list(llave = llave, actor = campo("actor"), efectiva = efectiva, respuesta_at = respuesta_at))
}

# Envío de cada efectiva: donde hizo clic por primera vez o, sin clic
# registrado, el último envío recibido antes de responder.
.mcm_atribuir <- function(personas, universo, envios) {
  efectivas <- universo[universo$efectiva & nzchar(universo$llave), , drop = FALSE]
  if (!nrow(efectivas) || !nrow(personas)) return(character(0))
  enviado_at <- vapply(envios, function(e) .mcm_chr(e$enviado_at), character(1))
  p <- personas[personas$llave %in% efectivas$llave, , drop = FALSE]
  if (!nrow(p)) return(character(0))
  p$enviado_at <- unname(enviado_at[p$campaign_id])
  out <- character(0)
  por_llave <- split(seq_len(nrow(p)), p$llave)
  for (llave in names(por_llave)) {
    suyos <- p[por_llave[[llave]], , drop = FALSE]
    suyos <- suyos[order(suyos$enviado_at), , drop = FALSE]
    con_clic <- suyos[suyos$clic, , drop = FALSE]
    if (nrow(con_clic)) {
      con_clic <- con_clic[order(con_clic$clic_at, con_clic$enviado_at), , drop = FALSE]
      out[[llave]] <- con_clic$campaign_id[[1L]]
      next
    }
    respondio <- efectivas$respuesta_at[match(llave, efectivas$llave)]
    # Una respuesta con sólo fecha («2026-10-27») se compara por día: si no, un
    # envío de esa misma mañana quedaría «después» de la respuesta.
    envio_cmp <- if (nchar(respondio) == 10L) substr(suyos$enviado_at, 1L, 10L) else suyos$enviado_at
    previos <- if (nzchar(respondio)) suyos[envio_cmp <= respondio, , drop = FALSE] else suyos[0, , drop = FALSE]
    if (nrow(previos)) out[[llave]] <- previos$campaign_id[[nrow(previos)]]
  }
  out
}

.mcm_cifras <- function(p, bajas, quejas, atribuidas) {
  enviados <- nrow(p)
  rebotes_duros <- sum(p$entrega == "hard")
  rebotes_blandos <- sum(p$entrega == "soft")
  entregados <- enviados - rebotes_duros - rebotes_blandos
  n_bajas <- sum(bajas$llave %in% p$llave)
  n_quejas <- sum(quejas$llave %in% p$llave)
  respuestas <- sum(atribuidas %in% p$llave)
  list(
    enviados = enviados, entregados = entregados,
    rebotes_duros = rebotes_duros, rebotes_blandos = rebotes_blandos,
    aperturas = sum(p$abrio), clics = sum(p$clic),
    bajas = n_bajas, quejas = n_quejas, respuestas = respuestas,
    tasa_apertura = .mcm_tasa(sum(p$abrio), entregados), tasa_clic = .mcm_tasa(sum(p$clic), entregados),
    tasa_baja = .mcm_tasa(n_bajas, entregados), tasa_queja = .mcm_tasa(n_quejas, entregados)
  )
}

.mcm_ritmo <- function(ultimo, umbrales = .MCM_UMBRALES) {
  if (is.null(ultimo)) return(list(ritmo = "sin_envios", motivo = "El público todavía no recibe envíos."))
  pct <- function(x) if (is.na(x)) "s/d" else paste0(formatC(100 * x, format = "f", digits = 2), " %")
  baja <- ultimo$tasa_baja
  queja <- ultimo$tasa_queja
  detalle <- sprintf("Último envío: bajas %s (%d) y quejas %s (%d) sobre %s entregados; %d respuestas atribuidas.",
                     pct(baja), ultimo$bajas, pct(queja), ultimo$quejas,
                     format(ultimo$entregados, big.mark = ","), ultimo$respuestas)
  if (!is.na(queja) && queja >= umbrales$queja_detener) {
    return(list(ritmo = "detener", motivo = paste("Las quejas pasan el tope de", pct(umbrales$queja_detener), "—", detalle)))
  }
  razones <- character(0)
  if (!is.na(baja) && baja >= umbrales$baja_espaciar) razones <- c(razones, paste("bajas sobre", pct(umbrales$baja_espaciar)))
  if (!is.na(queja) && queja >= umbrales$queja_espaciar) razones <- c(razones, paste("quejas sobre", pct(umbrales$queja_espaciar)))
  if (ultimo$bajas > 0L && ultimo$respuestas < ultimo$bajas) razones <- c(razones, "más bajas que respuestas")
  if (length(razones)) return(list(ritmo = "espaciar", motivo = paste0("Conviene espaciar: ", paste(razones, collapse = ", "), ". ", detalle)))
  list(ritmo = "seguir", motivo = detalle)
}

#' Modelo de la pestaña Correo a partir del snapshot de Mailchimp y del
#' `case_rollup` de Monitoreo. Puro.
#' @keywords internal
monitoreo_mailchimp_modelo <- function(snapshot = list(), case_rollup = list(), umbrales = .MCM_UMBRALES) {
  universo <- .mcm_universo(case_rollup)
  envios <- snapshot$envios %||% list()
  # Sólo las personas del universo con token: una fila sin `codigo:` deja la
  # llave vacía, y un destinatario sin token no puede heredar su actor.
  con_token <- universo[nzchar(universo$llave), , drop = FALSE]
  actor_de <- function(llave) {
    a <- con_token$actor[match(llave, con_token$llave)]
    a[is.na(a) | !nzchar(a) | !nzchar(llave)] <- .MCM_FUERA
    a
  }
  con_llave <- function(df, cols) {
    df <- if (is.data.frame(df)) df else .mcm_df(stats::setNames(rep(list(character(0)), length(cols)), cols))
    df$llave <- .mcm_llave(df$token)
    df$actor <- if (nrow(df)) actor_de(df$llave) else character(0)
    df
  }
  personas <- con_llave(snapshot$personas, c("campaign_id", "token", "entrega", "abrio", "clic", "clic_at"))
  if (!nrow(personas)) {
    personas$abrio <- logical(0); personas$clic <- logical(0); personas$clic_at <- character(0); personas$entrega <- character(0)
  }
  bajas <- con_llave(snapshot$bajas, c("campaign_id", "token", "fecha", "motivo"))
  quejas <- con_llave(snapshot$quejas, c("campaign_id", "token", "fecha"))
  limpiados <- con_llave(snapshot$limpiados, c("token", "fecha", "motivo"))
  atribucion <- .mcm_atribuir(personas, universo, envios)
  atribuidas_a <- function(id) names(atribucion)[atribucion == id]

  # Orden de cada envío dentro de su público (1 = invitación).
  enviado_at <- vapply(envios, function(e) .mcm_chr(e$enviado_at), character(1))
  envios_out <- list()
  for (id in names(envios)[order(enviado_at)]) {
    e <- envios[[id]]
    p <- personas[personas$campaign_id == id, , drop = FALSE]
    b <- bajas[bajas$campaign_id == id, , drop = FALSE]
    q <- quejas[quejas$campaign_id == id, , drop = FALSE]
    atr <- atribuidas_a(id)
    actores <- sort(table(p$actor), decreasing = TRUE)
    actor <- if (length(actores)) names(actores)[[1L]] else ""
    por_actor <- if (length(actores) > 1L) {
      lapply(names(actores), function(a) {
        pa <- p[p$actor == a, , drop = FALSE]
        c(list(actor = a), .mcm_cifras(pa, b, q, atr), list(aperturas_sin_proxy = NA_integer_))
      })
    } else list()
    cifras <- .mcm_cifras(p, b, q, atr)
    # Sin destinatarios leídos (la lectura aún no bajó el detalle), el reporte
    # agregado de Mailchimp manda.
    if (!nrow(p)) {
      cifras$enviados <- .mcm_int(e$enviados)
      cifras$rebotes_duros <- .mcm_int(e$rebotes_duros)
      cifras$rebotes_blandos <- .mcm_int(e$rebotes_blandos)
      cifras$entregados <- cifras$enviados - cifras$rebotes_duros - cifras$rebotes_blandos
      cifras$bajas <- .mcm_int(e$bajas)
      cifras$quejas <- .mcm_int(e$quejas)
      cifras$clics <- .mcm_int(e$clics_unicos)
    }
    envios_out[[length(envios_out) + 1L]] <- c(
      list(campaign_id = id, titulo = .mcm_chr(e$titulo), asunto = .mcm_chr(e$asunto), enviado_at = .mcm_chr(e$enviado_at),
           etiqueta = .mcm_chr(e$etiqueta), tipo = .mcm_chr(e$tipo, "invitacion"), orden = 0L, actor = actor),
      utils::modifyList(cifras, list(tasa_apertura = .mcm_tasa(.mcm_int(e$aperturas_sin_proxy), cifras$entregados))),
      list(aperturas_sin_proxy = .mcm_int(e$aperturas_sin_proxy), por_actor = por_actor)
    )
  }
  # Orden por público: invitación, recordatorio 1, 2… El tipo sale del orden y
  # no del segmento: un recordatorio armado a mano en Mailchimp puede no excluir
  # «Respondió» (así pasó en el piloto del 21/10).
  vistos <- list()
  for (i in seq_along(envios_out)) {
    # Prefijo en la llave: un envío sin destinatarios leídos tiene actor vacío y
    # `vistos[[""]]` no se puede leer.
    a <- paste0("actor:", envios_out[[i]]$actor)
    vistos[[a]] <- (vistos[[a]] %||% 0L) + 1L
    envios_out[[i]]$orden <- vistos[[a]]
    envios_out[[i]]$tipo <- if (vistos[[a]] == 1L) "invitacion" else "recordatorio"
  }

  # Correos inválidos: rebote duro en algún envío o `cleaned` en la audiencia.
  duros <- personas[personas$entrega == "hard" & nzchar(personas$llave), , drop = FALSE]
  duros <- duros[!duplicated(duros$llave), , drop = FALSE]
  fecha_envio <- unname(enviado_at[duros$campaign_id])
  invalidos <- .mcm_df(list(
    token = duros$token, llave = duros$llave, actor = duros$actor, motivo = rep("rebote_duro", nrow(duros)),
    campaign_id = duros$campaign_id, fecha = ifelse(is.na(fecha_envio), "", fecha_envio)
  ))
  limp <- limpiados[nzchar(limpiados$llave) & !limpiados$llave %in% invalidos$llave, , drop = FALSE]
  limp <- limp[!duplicated(limp$llave), , drop = FALSE]
  if (nrow(limp)) {
    invalidos <- rbind(invalidos, .mcm_df(list(
      token = limp$token, llave = limp$llave, actor = limp$actor, motivo = rep("limpiado", nrow(limp)),
      campaign_id = rep("", nrow(limp)), fecha = limp$fecha
    )))
  }

  actores <- unique(c(universo$actor[nzchar(universo$actor)], personas$actor[personas$actor != .MCM_FUERA]))
  publicos <- lapply(actores, function(a) {
    u <- universo[universo$actor == a, , drop = FALSE]
    pa <- personas[personas$actor == a, , drop = FALSE]
    n_invalidos <- sum(invalidos$actor == a & invalidos$llave %in% u$llave)
    # Un correo inválido que igual respondió (por otro enlace o antes del
    # rebote) fue alcanzado: sale del denominador sólo quien no respondió, así
    # la tasa sobre la base alcanzable nunca pasa de 100 %.
    inval_sin_respuesta <- sum(invalidos$actor == a & invalidos$llave %in% u$llave[!u$efectiva])
    alcanzable <- nrow(u) - inval_sin_respuesta
    efectivas <- sum(u$efectiva)
    suyos <- Filter(function(e) identical(e$actor, a) || any(vapply(e$por_actor, function(x) identical(x$actor, a), logical(1))), envios_out)
    ultimo <- if (length(suyos)) {
      e <- suyos[[length(suyos)]]
      pe <- pa[pa$campaign_id == e$campaign_id, , drop = FALSE]
      cif <- .mcm_cifras(pe, bajas[bajas$campaign_id == e$campaign_id, , drop = FALSE],
                         quejas[quejas$campaign_id == e$campaign_id, , drop = FALSE], atribuidas_a(e$campaign_id))
      c(list(campaign_id = e$campaign_id), cif[c("entregados", "bajas", "quejas", "respuestas", "tasa_baja", "tasa_queja")])
    } else NULL
    ritmo <- .mcm_ritmo(ultimo, umbrales)
    list(
      actor = a, universo = nrow(u), invitados = length(unique(pa$llave[nzchar(pa$llave)])),
      invalidos = n_invalidos, alcanzable = alcanzable, efectivas = efectivas,
      tasa_universo = .mcm_tasa(efectivas, nrow(u)), tasa_alcanzable = .mcm_tasa(efectivas, alcanzable),
      bajas = sum(bajas$actor == a), quejas = sum(quejas$actor == a), envios = length(suyos),
      ultimo = ultimo, ritmo = ritmo$ritmo, ritmo_motivo = ritmo$motivo
    )
  })

  avisos <- character(0)
  fuera <- unique(personas$llave[personas$actor == .MCM_FUERA & nzchar(personas$llave)])
  if (length(fuera)) {
    avisos <- c(avisos, sprintf("%s destinatario%s de Mailchimp no está%s en el universo de Monitoreo: se cuentan en sus envíos pero no en ningún público.",
                                format(length(fuera), big.mark = ","), if (length(fuera) == 1L) "" else "s", if (length(fuera) == 1L) "" else "n"))
  }
  sin_token <- sum(!nzchar(personas$llave))
  if (sin_token) {
    avisos <- c(avisos, sprintf("%s destinatario%s sin enlace personal (?t=) en sus campos: no se pueden cruzar con el universo.",
                                format(sin_token, big.mark = ","), if (sin_token == 1L) "" else "s"))
  }
  if (!nrow(universo)) avisos <- c(avisos, "Monitoreo todavía no tiene el universo cruzado: sincroniza las fuentes para ver los públicos.")

  list(
    publicos = publicos,
    envios = envios_out,
    invalidos = list(
      total = nrow(invalidos),
      por_actor = lapply(unique(invalidos$actor), function(a) list(actor = a, n = sum(invalidos$actor == a))),
      filas = lapply(seq_len(nrow(invalidos)), function(i) as.list(invalidos[i, c("token", "actor", "motivo", "campaign_id", "fecha")]))
    ),
    umbrales = umbrales,
    avisos = as.list(avisos)
  )
}
