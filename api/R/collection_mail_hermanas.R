# collection_mail_hermanas.R — «Aplicar a las campañas hermanas» (GOAL editor de
# correos profesional, L16; Acreditación Institucional 2026: seis públicos con
# el mismo correo, cuyos cambios —asuntos, saludo, pie, alineación— se llevaron
# de uno a otro por script).
#
# Es una acción explícita, no una sincronización: copia lo que la campaña de
# origen tiene hoy a las campañas elegidas, que después siguen siendo suyas
# (el benchmark descarta las filas sincronizadas por reproducibilidad: lo que se
# envió tiene que poder rehacerse tal cual).
#
# Partes:
# - `cuerpo`: asunto, vista previa, estilo (`theme`), cabecera, imágenes y bloques,
#   menos el Saludo: el vocativo y su trato por sexo son de cada público.
# - `envios`: por posición (la invitación con la invitación, el k-ésimo
#   recordatorio con el k-ésimo), su rótulo, a quién va, su asunto, su vista
#   previa y su apertura. La fecha, el recopilador y el registro de exportación
#   quedan de cada campaña. Los envíos que sobran en el origen se agregan (con
#   id nuevo); los que sobran en la hermana quedan.
#
# Cada hermana CONSERVA lo que la hace suya: su saludo, su trato (`registro`), sus campos
# (el campo de enlace de cada público: ENLPROF, ENLPRE…), el valor de sus datos
# de campaña, sus destinatarios, su plataforma y su nombre. Un campo o un dato
# que el origen usa y la hermana no tiene se agrega con lo del origen, y se dice.
#
# `dry_run = TRUE` devuelve lo que cambiaría en cada hermana sin escribir. Si
# alguna quedaría inválida no se escribe ninguna (todo o nada) y la revisión
# global sube una sola vez.

.CMAIL_HERMANAS_PARTES <- c("cuerpo", "envios")
.CMAIL_HERMANAS_CUERPO <- c(subject = "Asunto", preheader = "Vista previa", theme = "Estilo",
                            header = "Cabecera", images = "Imágenes", blocks = "Bloques")
.CMAIL_HERMANAS_ENVIO <- c(label = "rótulo", audience = "a quién va", subject = "asunto",
                           preheader = "vista previa", opening = "apertura")

.cmail_hermanas_partes <- function(partes) {
  p <- if (is.null(partes)) .CMAIL_HERMANAS_PARTES else unique(as.character(unlist(partes)))
  if (!length(p) || anyNA(p) || !all(p %in% .CMAIL_HERMANAS_PARTES)) {
    stop_api(422, "E_COLLECTION_MAIL_HERMANAS_PARTES", "Las partes a aplicar son «cuerpo» y/o «envios».")
  }
  p
}

.cmail_hermanas_key <- function(xs, prop) vapply(xs %||% list(), function(x) .cmail_one(x[[prop]]) %||% "", "")

# La plantilla de la hermana con el cuerpo del origen.
.cmail_hermana_cuerpo <- function(origen, destino) {
  t <- destino
  for (k in names(.CMAIL_HERMANAS_CUERPO)) t[[k]] <- origen[[k]]
  # El saludo es de cada público (el vocativo y su trato por sexo): el de la
  # hermana reemplaza al del origen en su lugar, si las dos lo tienen.
  es_saludo <- function(b) identical(.cmail_one(b$type), "greeting")
  saludo <- Filter(es_saludo, destino$blocks %||% list())
  donde <- which(vapply(t$blocks %||% list(), es_saludo, NA))
  if (length(saludo) && length(donde)) {
    t$blocks[[donde[[1]]]] <- saludo[[1]]
  } else if (length(saludo)) {
    # El origen no tiene saludo: el de la hermana vuelve al lugar que tenía.
    at <- which(vapply(destino$blocks, es_saludo, NA))[[1]]
    t$blocks <- append(t$blocks %||% list(), list(saludo[[1]]), after = min(at - 1L, length(t$blocks %||% list())))
  }
  # Campos: los de la hermana se quedan (su enlace, su etiqueta); se agregan los que faltan.
  propias <- .cmail_hermanas_key(destino$fields, "key")
  nuevos <- Filter(function(f) !(.cmail_one(f$key) %||% "") %in% propias, origen$fields %||% list())
  t$fields <- c(unname(destino$fields %||% list()), unname(nuevos))
  # Datos de campaña: el valor de la hermana se queda; se agregan los que faltan.
  propios <- .cmail_hermanas_key(destino$constants, "key")
  datos <- Filter(function(c) !(.cmail_one(c$key) %||% "") %in% propios, origen$constants %||% list())
  if (length(datos) || length(destino$constants)) t$constants <- c(unname(destino$constants %||% list()), unname(datos))
  list(template = t,
       campos = as.list(.cmail_hermanas_key(nuevos, "key")),
       datos = as.list(.cmail_hermanas_key(datos, "key")),
       cambios = as.list(unname(.CMAIL_HERMANAS_CUERPO[vapply(names(.CMAIL_HERMANAS_CUERPO), function(k) {
         !identical(.cmc_drop_nulls_deep(list(x = t[[k]])), .cmc_drop_nulls_deep(list(x = destino[[k]])))
       }, NA)])))
}

# Los envíos de la hermana con los textos del origen, por posición.
.cmail_hermana_envios <- function(origen_sends, destino_sends) {
  out <- destino_sends
  cambios <- character(0)
  for (i in seq_along(origen_sends)) {
    o <- origen_sends[[i]]
    if (i <= length(out)) {
      d <- out[[i]]
      dif <- character(0)
      for (k in names(.CMAIL_HERMANAS_ENVIO)) {
        if (i == 1L && identical(k, "audience")) next   # la invitación va a todos
        if (!identical(o[[k]], d[[k]])) dif <- c(dif, .CMAIL_HERMANAS_ENVIO[[k]])
        d[k] <- list(o[[k]])
      }
      out[[i]] <- .cmc_drop_nulls_deep(d)
      if (length(dif)) cambios <- c(cambios, sprintf("%s: %s", .cmail_one(d$label) %||% d$send_id, paste(dif, collapse = ", ")))
    } else {
      nuevo <- o[intersect(c("kind", "label", "audience", "subject", "preheader", "opening"), names(o))]
      out[[length(out) + 1L]] <- nuevo
      cambios <- c(cambios, sprintf("%s: se agrega", .cmail_one(o$label) %||% "Recordatorio"))
    }
  }
  list(sends = out, cambios = as.list(cambios),
       sobran = as.list(vapply(destino_sends[-seq_len(min(length(origen_sends), length(destino_sends)))],
                               function(s) .cmail_one(s$label) %||% s$send_id, "")))
}

# Lo que se conserva de la hermana, dicho para la persona.
.cmail_hermana_conserva <- function(destino) {
  enlaces <- Filter(function(f) !is.null(f$destino) || identical(.cmail_one(f$sm), "SurveyLink"), destino$fields %||% list())
  .cmc_drop_nulls_deep(list(
    registro = .cmail_registro_of(destino),
    saludo = any(vapply(destino$blocks %||% list(), function(b) identical(.cmail_one(b$type), "greeting"), NA)),
    enlaces = as.list(vapply(enlaces, function(f) .cmail_one(f$tag) %||% "", "")),
    datos = length(destino$constants %||% list())
  ))
}

#' Aplica la campaña `campaign_id` a sus hermanas `target_ids` (o lo simula).
#' @keywords internal
collection_mail_campaigns_apply_siblings <- function(sid, expected_revision, campaign_id, target_ids,
                                                     partes = NULL, dry_run = FALSE) {
  session <- session_get(sid)
  current <- .collection_current(session)
  .collection_assert_revision(current, expected_revision)
  if (is.null(.cmail_campaign_arg(campaign_id))) {
    stop_api(422, "E_COLLECTION_MAIL_CAMPAIGN_REQUIRED", "Indica la campaña de origen (campaign_id).")
  }
  partes <- .cmail_hermanas_partes(partes)
  pick <- .cmail_campaign_pick(current, campaign_id)
  if (isTRUE(pick$virtual)) {
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "La campaña de correo no existe en este proyecto.")
  }
  origen <- pick$campaign
  campaigns <- pick$set$campaigns
  ids <- vapply(campaigns, function(c) as.character(c$campaign_id), "")
  targets <- setdiff(unique(as.character(unlist(target_ids %||% list()))), origen$campaign_id)
  if (!length(targets)) {
    stop_api(422, "E_COLLECTION_MAIL_HERMANAS_SIN_DESTINO", "Elige al menos una campaña hermana a la que aplicar.")
  }
  faltan <- setdiff(targets, ids)
  if (length(faltan)) {
    stop_api(404, "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND", "Una de las campañas hermanas no existe en este proyecto.",
             details = list(campaign_ids = as.list(faltan[vapply(faltan, .cmail_campaign_id_ok, NA)])))
  }

  resultados <- list()
  for (tid in targets) {
    hermana <- campaigns[[match(tid, ids)]]
    t <- hermana$template
    r <- list(campaign_id = tid, name = hermana$name, cambios = list(), campos_agregados = list(),
              datos_agregados = list(), envios_que_quedan = list(), conserva = .cmail_hermana_conserva(t),
              problemas = list())
    if ("cuerpo" %in% partes) {
      c <- .cmail_hermana_cuerpo(origen$template, t)
      t <- c$template
      r$cambios <- c(r$cambios, c$cambios)
      r$campos_agregados <- c$campos
      r$datos_agregados <- c$datos
    }
    t <- .cmail_campaign_template(t, tid, revision = as.integer(hermana$template$revision %||% 1L) + 1L)
    valid <- collection_mail_template_validate(t)
    if (!isTRUE(valid$ok)) r$problemas <- c(r$problemas, valid$problems)
    sends <- .cmail_sends_of(hermana)
    seq <- .cmail_send_seq(hermana)
    candidatos <- sends
    if ("envios" %in% partes) {
      e <- .cmail_hermana_envios(.cmail_sends_of(origen), sends)
      r$cambios <- c(r$cambios, e$cambios)
      r$envios_que_quedan <- e$sobran
      candidatos <- e$sends
    }
    # Los envíos se validan siempre contra la plantilla nueva: un campo que el
    # cuerpo deja de declarar o una variante rota en un envío de la hermana también cuentan.
    v <- .cmail_sends_validate(candidatos, t, previous = sends, seq = seq)
    if (!isTRUE(v$ok)) r$problemas <- c(r$problemas, v$problems)
    sends <- v$sends
    seq <- v$seq
    hermana$template <- t
    hermana$sends <- sends
    if (seq > 0L) hermana$send_seq <- seq
    r$campaign <- hermana
    resultados[[length(resultados) + 1L]] <- r
  }

  publico <- lapply(resultados, function(r) { r$campaign <- NULL; .cmc_drop_nulls_deep(r) })
  # Sin variantes `[[tú|usted]]` en el origen, una hermana que tutea recibe el texto
  # tal cual: la UI lo avisa antes de aplicar (Acreditación 2026 tenía el tú escrito a mano).
  envios_txt <- lapply(.cmail_sends_of(origen), function(s) s[intersect(c("subject", "preheader", "opening"), names(s))])
  variantes <- .cmail_registro_variantes(origen$template) +
    .cmail_registro_variantes(list(blocks = envios_txt))
  invalidas <- Filter(function(r) length(r$problemas) > 0L, resultados)
  if (isTRUE(dry_run)) {
    return(list(ok = TRUE, dry_run = TRUE, state_revision = as.integer(current$state_revision),
                origen = origen$campaign_id, partes = as.list(partes), variantes_origen = variantes, hermanas = publico))
  }
  if (length(invalidas)) {
    stop_api(422, "E_COLLECTION_MAIL_TEMPLATE_INVALID",
             "Una campaña hermana quedaría inválida: no se aplicó a ninguna.",
             details = list(hermanas = lapply(invalidas, function(r) list(campaign_id = r$campaign_id, problems = r$problemas))))
  }
  for (r in resultados) {
    if (!length(r$cambios) && !length(r$campos_agregados) && !length(r$datos_agregados)) next
    campaigns <- .cmail_campaigns_upsert(campaigns, r$campaign)
  }
  next_state <- .cmail_campaigns_commit(sid, current, campaigns)
  list(ok = TRUE, dry_run = FALSE, state_revision = next_state$state_revision,
       origen = origen$campaign_id, partes = as.list(partes), variantes_origen = variantes, hermanas = publico)
}
