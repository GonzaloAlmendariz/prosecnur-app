# =============================================================================
# Material de campo › Correo › Seguimiento › Correo personal (opcional).
#
# Un segundo correo por persona (el personal, en una columna de la lista de
# contactos) para quienes aún no responden. Se prueba con un sorteo:
#   - entran las personas efectivas, con enlace, que no respondieron y que
#     tienen en esa columna un correo válido, distinto del suyo y que no es el
#     correo de otra persona del estudio (el primero si la celda trae varios);
#   - dentro de cada público y de cada grupo de horario (si hay prueba de
#     horarios), con semilla, el 80 % recibe también en su correo personal y el
#     20 % queda de control (sólo su correo de la lista). La proporción se puede
#     cambiar.
# Cargar sube el correo personal del 80 % a Mailchimp con los mismos campos que
# su correo de la lista (el mismo enlace personal) y las etiquetas del público,
# de su grupo de horario y "Correo personal". Un correo que Mailchimp rechaza
# queda "rechazado" y no se vuelve a intentar. Al archivar a quien responde se
# archivan sus dos correos (collection_mail_mailchimp_archivo.R).
#
# El efecto se lee por intención de tratar: completas desde el primer envío
# con correo personal, 80 % contra 20 %, por público y grupo (CMH). Los
# rechazados siguen en el 80 %: excluirlos sesgaría a favor del correo personal.
#
# Store de cada campaña: `store$segundo_correo` = data.frame(clave (correo de
# la lista), correo, brazo "personal"/"control", estado "por_cargar" /
# "cargado" / "rechazado" / "control", estrato). Configuración en
# `s$mail_seguimiento$correo_personal` (sin correos).
# =============================================================================

.MCP_ETIQUETA <- "Correo personal"

.mcp_default <- function() {
  list(semilla = NA_integer_, proporcion = 0.8, columnas = list(), etiqueta = .MCP_ETIQUETA,
       desde = "", sorteado_en = "", cargado_en = "")
}

.mcp_cfg <- function(cfg) {
  x <- cfg$correo_personal
  base <- .mcp_default()
  if (!is.list(x)) return(base)
  for (k in names(base)) if (is.null(x[[k]])) x[[k]] <- base[[k]]
  x
}

.mcp_put <- function(sid, x) {
  cfg <- .mseg_get(sid)
  cfg$correo_personal <- x
  .mseg_put(sid, cfg)
}

# Primer correo válido de cada celda (puede traer varios separados por coma,
# punto y coma o espacio).
.mcp_primer_correo <- function(v) {
  v <- .cmail_value(v)
  vapply(v, function(x) {
    if (!nzchar(x)) return("")
    partes <- .cmail_email_normalize(unlist(strsplit(x, "[,; ]+")))
    ok <- partes[nzchar(partes) & .cmail_email_valid(partes)]
    if (length(ok)) tolower(ok[[1]]) else ""
  }, "", USE.NAMES = FALSE)
}

# Columnas que parecen correos: al menos la mitad de sus celdas con dato
# traen un correo válido. Sin la columna del correo de la lista.
.mcp_columnas_candidatas <- function(store) {
  cols <- setdiff(.cmail_contact_columns(store), .CMAIL_ENLACE_COLUMN)
  Filter(function(c) {
    v <- .cmail_value(store$rows[[c]])
    con <- nzchar(v)
    sum(con) > 0 && mean(nzchar(.mcp_primer_correo(v[con]))) >= 0.5
  }, cols)
}

.mcp_estado <- function(cfg, session) {
  x <- .mcp_cfg(cfg)
  campanas <- lapply(.mseg_campanas_mc(session), function(c) {
    store <- .cmail_recipients_load(session, c$campaign_id)
    cands <- if (is.null(store)) character(0) else .mcp_columnas_candidatas(store)
    labels <- if (length(cands)) .cmail_column_labels(store, .cmail_contactos_template(c), cands) else list()
    list(campaign_id = c$campaign_id, publico = .mseg_publico(c),
         columna = .mseg_chr(x$columnas[[c$campaign_id]]),
         candidatas = lapply(cands, function(k) list(key = k, label = labels[[k]] %||% k)))
  })
  list(semilla = if (is.na(x$semilla)) NULL else as.integer(x$semilla), proporcion = x$proporcion,
       etiqueta = x$etiqueta, desde = x$desde, sorteado_en = x$sorteado_en, cargado_en = x$cargado_en,
       campanas = campanas)
}

#' `PUT /api/recopiladores/mail-seguimiento/correo-personal`.
#' @keywords internal
collection_mail_correo_personal_config <- function(sid, columnas = NULL, proporcion = NULL, etiqueta = NULL, desde = NULL) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  x <- .mcp_cfg(.mseg_get(sid))
  bad <- function(msg) stop_api(422, "E_COLLECTION_MAIL_CORREO_PERSONAL_INPUT", msg)
  if (is.list(columnas)) {
    for (id in names(columnas)) {
      store <- .cmail_recipients_load(session, id)
      v <- .mseg_chr(columnas[[id]])
      if (nzchar(v) && (is.null(store) || !(v %in% .mcp_columnas_candidatas(store)))) {
        bad("Esa columna no trae correos en la lista de la campaña.")
      }
      x$columnas[[id]] <- if (nzchar(v)) v else NULL
    }
  }
  if (!is.null(proporcion)) {
    p <- suppressWarnings(as.numeric(unlist(proporcion)[1]))
    if (is.na(p) || p < 0.5 || p > 0.95) bad("La parte que recibe en el correo personal va de 50 % a 95 %.")
    x$proporcion <- p
  }
  if (!is.null(etiqueta)) {
    v <- .mseg_chr(etiqueta)
    if (!nzchar(v) || nchar(v) > 60L) bad("La etiqueta va de 1 a 60 caracteres.")
    x$etiqueta <- v
  }
  if (!is.null(desde)) {
    v <- .mseg_chr(desde)
    if (nzchar(v) && !grepl(.MPH_PROGRAMADO_RE, v)) bad("El primer envío al correo personal se escribe como 2026-11-16T09:30.")
    x$desde <- v
  }
  .mcp_put(sid, x)
  collection_mail_seguimiento_estado(sid)
}

#' `POST /api/recopiladores/mail-seguimiento/correo-personal/sortear`.
#' @keywords internal
collection_mail_correo_personal_sortear <- function(sid, semilla = NULL, rehacer = FALSE) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  x <- .mcp_cfg(.mseg_get(sid))
  if (!length(x$columnas)) stop_api(422, "E_COLLECTION_MAIL_CORREO_PERSONAL_INPUT", "Elige en qué columna está el correo personal.")
  if (nzchar(x$cargado_en) && !isTRUE(rehacer)) {
    stop_api(409, "E_COLLECTION_MAIL_CORREO_PERSONAL_CARGADO",
             "Los correos personales ya se cargaron en Mailchimp: la asignación queda fija para poder medir su efecto.")
  }
  semilla <- suppressWarnings(as.integer(unlist(semilla %||% format(Sys.Date(), "%Y%m%d"))[1]))
  if (is.na(semilla) || semilla < 1L) stop_api(422, "E_COLLECTION_MAIL_CORREO_PERSONAL_INPUT", "La semilla es un número entero positivo.")
  # Correos de la lista de todas las campañas: un correo personal que es el de
  # otra persona del estudio no se usa.
  todos <- unlist(lapply(.mseg_campanas_mc(session), function(c) {
    s <- .cmail_recipients_load(session, c$campaign_id); if (is.null(s)) character(0) else .cmail_contact_frame(s)$key
  }))
  usados <- character(0)
  conteo <- list()
  for (id in names(x$columnas)) {
    store <- .cmail_recipients_load(session, id)
    if (is.null(store)) next
    fr <- .cmail_contact_frame(store)
    tokens <- store$tokens %||% character(0)
    personal <- .mcp_primer_correo(store$rows[[x$columnas[[id]]]])
    ok <- fr$efectivo & fr$key %in% names(tokens) & !(fr$respondio %in% TRUE) &
      nzchar(personal) & personal != fr$key & !(personal %in% todos)
    idx <- which(ok)
    idx <- idx[!duplicated(personal[idx]) & !(personal[idx] %in% usados)]
    usados <- c(usados, personal[idx])
    if (!length(idx)) { store$segundo_correo <- NULL; .cmail_recipients_save(session, id, store); next }
    gh <- store$grupo_horario %||% character(0)
    grupo <- ifelse(fr$key[idx] %in% names(gh), gh[fr$key[idx]], "")
    brazo <- character(length(idx))
    for (g in unique(grupo)) {
      sel <- which(grupo == g)
      brazo[sel] <- .mph_sortear(unname(tokens[fr$key[idx[sel]]]), semilla, paste(id, g, sep = "|"),
                                 grupos = c("personal", "control"), proporcion = c(x$proporcion, 1 - x$proporcion))
    }
    store$segundo_correo <- data.frame(clave = fr$key[idx], correo = personal[idx], brazo = brazo,
                                       estado = ifelse(brazo == "personal", "por_cargar", "control"),
                                       grupo = unname(grupo), stringsAsFactors = FALSE)
    .cmail_recipients_save(session, id, store)
    conteo[[id]] <- list(personal = sum(brazo == "personal"), control = sum(brazo == "control"))
  }
  .cmail_contactos_touch(sid)
  x$semilla <- semilla
  x$sorteado_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  x$cargado_en <- ""
  .mcp_put(sid, x)
  list(ok = TRUE, semilla = semilla, campanas = conteo)
}

# ---- carga en Mailchimp ----------------------------------------------------------------

.mcp_cargar_prepare <- function(sid) {
  session <- session_get(sid)
  cfg <- .mseg_get(sid)
  x <- .mcp_cfg(cfg)
  h <- .mph_cfg(cfg)
  list_id <- .mseg_chr(cfg$list_id)
  if (!nzchar(list_id)) stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "Elige la audiencia de Mailchimp del estudio.")
  if (!nzchar(x$sorteado_en)) stop_api(409, "E_COLLECTION_MAIL_CORREO_PERSONAL_SIN_SORTEO", "Asigna primero al azar quién recibe en el correo personal.")
  campanas <- list()
  for (c in .mseg_campanas_mc(session)) {
    store <- .cmail_recipients_load(session, c$campaign_id)
    sc <- store$segundo_correo
    if (!is.data.frame(sc)) next
    pend <- sc[sc$brazo == "personal" & sc$estado == "por_cargar", , drop = FALSE]
    if (!nrow(pend)) next
    aud <- .mc_audience_build(session, c)
    fila <- match(pend$clave, tolower(aud$emails))
    pend <- pend[!is.na(fila), , drop = FALSE]; fila <- fila[!is.na(fila)]
    if (!nrow(pend)) next
    merge <- lapply(aud$merge, function(v) v[fila])
    campanas[[length(campanas) + 1L]] <- list(
      campaign_id = c$campaign_id, emails = pend$correo, merge = merge, merge_names = aud$merge_names,
      tag_publico = .mc_audience_tag(c), grupos = pend$grupo
    )
  }
  if (!length(campanas)) {
    stop_api(409, "E_COLLECTION_MAIL_CORREO_PERSONAL_SIN_SORTEO", "No queda ningún correo personal por cargar.")
  }
  list(list_id = list_id, etiqueta = x$etiqueta, etiquetas_grupo = h$etiquetas, campanas = campanas,
       mc_key = .connections_token_require("mailchimp", sid))
}

# Sube contactos y devuelve los correos que Mailchimp rechazó (para no
# reintentarlos). Sólo el hook los ve; a la vista van conteos.
.mcp_upload <- function(key, list_id, emails, merge) {
  rechazados <- character(0); motivos <- list()
  tags <- names(merge)
  for (idx in split(seq_along(emails), ceiling(seq_along(emails) / .MC_BATCH))) {
    members <- lapply(idx, function(i) list(
      email_address = emails[[i]], status_if_new = "subscribed",
      merge_fields = stats::setNames(lapply(tags, function(t) merge[[t]][[i]]), tags)))
    body <- .mc_call("POST", sprintf("/lists/%s", list_id), key, body = list(members = members, update_existing = TRUE))
    for (e in body$errors %||% list()) {
      rechazados <- c(rechazados, tolower(as.character(e$email_address %||% "")[1]))
      code <- as.character(e$error_code %||% "desconocido")[1]
      motivos[[code]] <- as.integer(motivos[[code]] %||% 0L) + 1L
    }
  }
  list(rechazados = unique(rechazados[nzchar(rechazados)]), motivos = motivos)
}

.mcp_cargar_run <- function(input, report = function(...) invisible(NULL)) {
  key <- input$mc_key
  out <- list(ok = TRUE, campanas = list())
  n <- length(input$campanas)
  for (i in seq_len(n)) {
    c <- input$campanas[[i]]
    report("upload", percent = round(100 * (i - 1) / n), message = sprintf("Campaña %d de %d: subiendo correos personales...", i, n))
    .mc_merge_fields_ensure(key, input$list_id, names(c$merge), c$merge_names)
    up <- .mcp_upload(key, input$list_id, c$emails, c$merge)
    ok <- setdiff(tolower(c$emails), up$rechazados)
    etiquetar <- function(tag, emails) if (length(emails)) .mc_tag_emails(key, input$list_id, .mc_tag_id(key, input$list_id, tag), emails)
    etiquetar(c$tag_publico, ok)
    etiquetar(input$etiqueta, ok)
    for (g in c("A", "B")) etiquetar(input$etiquetas_grupo[[g]], intersect(ok, tolower(c$emails[c$grupos == g])))
    out$campanas[[i]] <- list(campaign_id = c$campaign_id, cargados = length(ok), rechazados = length(up$rechazados),
                              motivos = up$motivos, correos_ok = ok, correos_rechazados = up$rechazados)
  }
  out
}

#' Worker del job "Cargar correos personales" (callr). @keywords internal
collection_mail_correo_personal_cargar_job <- function(sid, input_path, progress_path = NULL) {
  .mc_job_run(input_path, progress_path, .mcp_cargar_run)
}

.mcp_cargar_hook <- function(sid) {
  function(j) {
    res <- j$result_data
    if (!is.list(res) || !isTRUE(res$ok)) return(res)
    session <- session_get(sid, required = FALSE)
    if (!is.null(session)) {
      for (r in res$campanas) {
        store <- .cmail_recipients_load(session, r$campaign_id)
        sc <- store$segundo_correo
        if (!is.data.frame(sc)) next
        sc$estado[tolower(sc$correo) %in% r$correos_ok & sc$brazo == "personal"] <- "cargado"
        sc$estado[tolower(sc$correo) %in% r$correos_rechazados & sc$brazo == "personal"] <- "rechazado"
        store$segundo_correo <- sc
        .cmail_recipients_save(session, r$campaign_id, store)
      }
      .cmail_contactos_touch(sid)
      x <- .mcp_cfg(.mseg_get(sid))
      x$cargado_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      .mcp_put(sid, x)
    }
    res$campanas <- lapply(res$campanas, function(r) { r$correos_ok <- NULL; r$correos_rechazados <- NULL; r })
    res
  }
}

#' `POST /api/recopiladores/mail-seguimiento/correo-personal/cargar`. @keywords internal
collection_mail_correo_personal_cargar_submit <- function(sid) {
  .cmail_contactos_assert_local()
  input <- .mcp_cargar_prepare(sid)
  .mc_job_submit(sid, "recopiladores.mail_correo_personal", "collection_mail_correo_personal_cargar_job", input,
                 on_complete = .mcp_cargar_hook(sid))
}

# ---- efecto 80 contra 20 ------------------------------------------------------------------

#' Efecto del correo personal. Puro.
#' @param personas data.frame(publico, grupo, brazo, completo_en POSIXct o NA, rechazado lógico).
#' @param desde inicio de la medición (primer envío al correo personal).
#' @keywords internal
.mcp_efecto <- function(personas, desde, ahora = Sys.time()) {
  desde <- as.POSIXct(desde, tz = "UTC"); ahora <- as.POSIXct(ahora, tz = "UTC")
  base <- is.na(personas$completo_en) | personas$completo_en >= desde
  p <- personas[base, , drop = FALSE]
  hit <- !is.na(p$completo_en) & p$completo_en >= desde & p$completo_en < ahora
  p$estrato <- paste(p$publico, p$grupo, sep = "|")
  filas <- list(); est <- data.frame(xA = numeric(0), nA = numeric(0), xB = numeric(0), nB = numeric(0))
  for (pub in unique(p$publico)) {
    s <- p$publico == pub
    f <- .prueba_fila(sum(hit & s & p$brazo == "personal"), sum(s & p$brazo == "personal"),
                      sum(hit & s & p$brazo == "control"), sum(s & p$brazo == "control"))
    f$publico <- pub
    filas[[length(filas) + 1L]] <- f
  }
  for (e in unique(p$estrato)) {
    s <- p$estrato == e
    est[nrow(est) + 1L, ] <- c(sum(hit & s & p$brazo == "personal"), sum(s & p$brazo == "personal"),
                               sum(hit & s & p$brazo == "control"), sum(s & p$brazo == "control"))
  }
  total <- .prueba_fila(sum(est$xA), sum(est$nA), sum(est$xB), sum(est$nB))
  cmh <- .prueba_cmh(est)
  dias <- round((as.numeric(ahora) - as.numeric(desde)) / 86400, 1)
  p_par <- if (nzchar(.mph_p_txt(cmh$p))) sprintf(" (%s)", .mph_p_txt(cmh$p)) else ""
  lectura <- if (!nrow(p)) "Todavía no hay personas en la medición."
    else if (!any(hit)) sprintf("Todavía no hay completas desde el primer envío al correo personal (%s personas en la medición).",
                                formatC(nrow(p), format = "d", big.mark = ","))
    else if (!is.na(cmh$p) && cmh$p < 0.05 && cmh$or > 1) sprintf(
      "En %s días, quienes recibieron también en su correo personal completaron %s contra %s del control (%s): el correo personal suma completas.",
      formatC(dias, format = "fg"), .mph_pct_txt(total$pctA), .mph_pct_txt(total$pctB), .mph_p_txt(cmh$p))
    else if (!is.na(cmh$p) && cmh$p < 0.05) sprintf(
      "En %s días, el control completó más que quienes recibieron en su correo personal (%s contra %s, %s).",
      formatC(dias, format = "fg"), .mph_pct_txt(total$pctB), .mph_pct_txt(total$pctA), .mph_p_txt(cmh$p))
    else sprintf("En %s días no hay diferencia clara: %s con correo personal y %s en el control%s.",
                 formatC(dias, format = "fg"), .mph_pct_txt(total$pctA), .mph_pct_txt(total$pctB), p_par)
  list(publicos = filas, total = total, dias = dias, rechazados = sum(personas$rechazado %in% TRUE),
       cmh = list(or = round(cmh$or, 3), or_li = round(cmh$or_li, 3), or_ls = round(cmh$or_ls, 3), p = signif(cmh$p, 3),
                  p_txt = .mph_p_txt(cmh$p)),
       lectura = lectura)
}

#' `GET /api/recopiladores/mail-seguimiento/correo-personal/efecto`. @keywords internal
collection_mail_correo_personal_efecto <- function(sid, ahora = Sys.time()) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  x <- .mcp_cfg(.mseg_get(sid))
  if (!nzchar(x$sorteado_en)) stop_api(409, "E_COLLECTION_MAIL_CORREO_PERSONAL_SIN_SORTEO", "Asigna primero al azar quién recibe en el correo personal.")
  desde <- .mph_programado_time(x$desde)
  if (is.na(desde)) {
    stop_api(409, "E_COLLECTION_MAIL_CORREO_PERSONAL_SIN_INICIO", "Indica cuándo salió el primer envío al correo personal: desde ahí se mide.")
  }
  publicos <- .mph_publicos(session)
  filas <- lapply(.mseg_campanas_mc(session), function(c) {
    store <- .cmail_recipients_load(session, c$campaign_id)
    sc <- store$segundo_correo
    if (!is.data.frame(sc) || !nrow(sc)) return(NULL)
    ce <- store$completo_en %||% character(0)
    t <- vapply(sc$clave, function(k) { v <- ce[k]; if (is.na(v)) NA_real_ else as.numeric(.mc_parse_time(v)) }, 0)
    data.frame(publico = publicos[[c$campaign_id]], grupo = sc$grupo, brazo = sc$brazo,
               completo_en = as.POSIXct(t, origin = "1970-01-01", tz = "UTC"), rechazado = sc$estado == "rechazado",
               stringsAsFactors = FALSE)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) stop_api(409, "E_COLLECTION_MAIL_CORREO_PERSONAL_SIN_SORTEO", "Ninguna campaña tiene la asignación del correo personal.")
  out <- .mcp_efecto(do.call(rbind, filas), desde, ahora)
  out$ok <- TRUE
  out$desde <- x$desde
  out
}
