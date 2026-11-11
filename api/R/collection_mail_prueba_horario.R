# =============================================================================
# Material de campo › Correo › Seguimiento › Prueba de horarios (A/B).
#
# 1. Grupos. Dentro de cada público (una campaña de Mailchimp) las personas con
#    enlace personal se sortean 50/50 en el grupo A y el grupo B, con una
#    semilla. El sorteo es reproducible: las personas se ordenan por su token y
#    cada público usa una semilla propia derivada de la semilla y del id de la
#    campaña, así agregar o quitar un público no cambia los grupos de los demás.
#    Cada persona conserva su grupo durante toda la prueba; volver a sortear
#    exige pedirlo explícitamente. El grupo vive en el store de contactos
#    (`store$grupo_horario`, correo -> "A"/"B").
# 2. Etiquetas. En Mailchimp, el grupo A lleva la etiqueta "Envío mañana" y el
#    grupo B "Envío tarde" (nombres editables), sólo en suscriptores activos.
# 3. Plan. Para cada recordatorio, la hora de cada grupo en cada público. Los
#    grupos se cruzan de un recordatorio al siguiente (el que recibió en la
#    mañana recibe en la noche), así una diferencia que se repite con los grupos
#    cruzados es de la hora y no del grupo. Los públicos con horario de oficina
#    (por desconexión digital, de 8:30 a 17:00 por defecto) sólo reciben dentro
#    de ese horario: se compara el inicio de la jornada con media mañana.
# 4. Borradores. Cada recordatorio sale como dos borradores por público, uno por
#    grupo (segmento: público + grupo, sin "Respondió"). La app no envía ni
#    programa: la hora se pone en Mailchimp.
# 5. Envíos y análisis: la hora real de cada borrador se lee de Mailchimp
#    (`send_time`) y el análisis vive en collection_mail_prueba_horario_analisis.R.
#
# Configuración en `s$mail_seguimiento$horario` (sin correos).
# =============================================================================

.MPH_ETIQUETAS <- list(A = "Envío mañana", B = "Envío tarde")
.MPH_HORA_RE <- "^([01][0-9]|2[0-3]):[0-5][0-9]$"
.MPH_PROGRAMADO_RE <- "^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]$"

.mph_default <- function() {
  list(semilla = NA_integer_, campanas = character(0), oficina = character(0),
       oficina_desde = "08:30", oficina_hasta = "17:00", etiquetas = .MPH_ETIQUETAS,
       horizonte_h = 24, sorteado_en = "", etiquetado_en = "", plan = list())
}

.mph_cfg <- function(cfg) {
  h <- cfg$horario
  base <- .mph_default()
  if (!is.list(h)) return(base)
  for (k in names(base)) if (is.null(h[[k]])) h[[k]] <- base[[k]]
  h$campanas <- as.character(unlist(h$campanas))
  h$oficina <- as.character(unlist(h$oficina))
  h
}

.mph_put <- function(sid, h) {
  cfg <- .mseg_get(sid)
  cfg$horario <- h
  .mseg_put(sid, cfg)
}

.mph_minutos <- function(hhmm) {
  p <- as.integer(strsplit(hhmm, ":", fixed = TRUE)[[1]])
  p[[1]] * 60L + p[[2]]
}

# "2026-11-11T20:00" en hora de Lima -> POSIXct.
.mph_programado_time <- function(x) {
  x <- .mseg_chr(x)
  if (!grepl(.MPH_PROGRAMADO_RE, x)) return(as.POSIXct(NA))
  as.POSIXct(x, format = "%Y-%m-%dT%H:%M", tz = .MPH_TZ)
}

# ---- sorteo -------------------------------------------------------------------------

# Semilla de un público: estable ante otros públicos.
.mph_semilla_estrato <- function(semilla, estrato) {
  h <- digest::digest(paste(semilla, estrato, sep = "|"), algo = "md5", serialize = FALSE)
  strtoi(substr(h, 1L, 7L), 16L)
}

#' Sorteo 50/50 de un estrato. Puro y reproducible.
#' @param claves identificadores ordenables (tokens).
#' @return chr "A"/"B" en el orden de `claves`.
#' @keywords internal
.mph_sortear <- function(claves, semilla, estrato, grupos = c("A", "B"), proporcion = c(0.5, 0.5)) {
  n <- length(claves)
  if (!n) return(character(0))
  ord <- order(claves, method = "radix")
  cuantos <- round(n * proporcion[[1]])
  if (identical(proporcion, c(0.5, 0.5)) && n %% 2L == 1L) cuantos <- n %/% 2L + 1L
  old <- if (exists(".Random.seed", envir = globalenv())) get(".Random.seed", envir = globalenv()) else NULL
  on.exit(if (is.null(old)) rm(".Random.seed", envir = globalenv()) else assign(".Random.seed", old, envir = globalenv()))
  set.seed(.mph_semilla_estrato(semilla, estrato), kind = "Mersenne-Twister", normal.kind = "Inversion", sample.kind = "Rejection")
  etiqueta <- sample(c(rep(grupos[[1]], cuantos), rep(grupos[[2]], n - cuantos)))
  out <- character(n)
  out[ord] <- etiqueta
  out
}

# Personas de una campaña que entran a la prueba: efectivas y con enlace.
.mph_personas_campana <- function(store) {
  fr <- .cmail_contact_frame(store)
  tokens <- store$tokens %||% character(0)
  key <- unique(fr$key[fr$efectivo & fr$key %in% names(tokens)])
  list(key = key, token = unname(tokens[key]))
}

#' `PUT /api/recopiladores/mail-seguimiento/horario`: públicos, horario de
#' oficina, etiquetas y horas de lectura.
#' @keywords internal
collection_mail_prueba_horario_config <- function(sid, campanas = NULL, oficina = NULL, etiquetas = NULL,
                                                 horizonte_h = NULL, oficina_desde = NULL, oficina_hasta = NULL) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  h <- .mph_cfg(.mseg_get(sid))
  ids <- vapply(.mseg_campanas_mc(session), function(c) c$campaign_id, "")
  bad <- function(msg) stop_api(422, "E_COLLECTION_MAIL_PRUEBA_INPUT", msg)
  pick_ids <- function(x) {
    v <- unique(as.character(unlist(x %||% list())))
    fuera <- setdiff(v, ids)
    if (length(fuera)) bad(sprintf("No hay una campaña de Mailchimp \"%s\".", fuera[[1]]))
    v
  }
  if (!is.null(campanas)) {
    v <- pick_ids(campanas)
    if (nzchar(h$sorteado_en) && !setequal(v, h$campanas)) {
      stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SORTEADA",
               "Los grupos ya se sortearon: para cambiar los públicos de la prueba, vuelve a sortear.")
    }
    h$campanas <- v
  }
  if (!is.null(oficina)) h$oficina <- pick_ids(oficina)
  for (nm in c("oficina_desde", "oficina_hasta")) {
    v <- get(nm)
    if (!is.null(v)) {
      v <- .mseg_chr(v)
      if (!grepl(.MPH_HORA_RE, v)) bad("La hora se escribe como 08:30.")
      h[[nm]] <- v
    }
  }
  if (.mph_minutos(h$oficina_desde) >= .mph_minutos(h$oficina_hasta)) bad("El horario de oficina termina después de empezar.")
  if (is.list(etiquetas)) {
    for (g in c("A", "B")) if (!is.null(etiquetas[[g]])) {
      v <- .mseg_chr(etiquetas[[g]])
      if (!nzchar(v) || nchar(v) > 60L) bad("Cada etiqueta va de 1 a 60 caracteres.")
      h$etiquetas[[g]] <- v
    }
    if (identical(h$etiquetas$A, h$etiquetas$B)) bad("Los dos grupos necesitan etiquetas distintas.")
  }
  if (!is.null(horizonte_h)) {
    v <- suppressWarnings(as.numeric(unlist(horizonte_h)[1]))
    if (is.na(v) || v < 1 || v > 168) bad("Las horas desde el envío van de 1 a 168.")
    h$horizonte_h <- v
  }
  .mph_put(sid, h)
  collection_mail_seguimiento_estado(sid)
}

#' `POST /api/recopiladores/mail-seguimiento/horario/sortear`.
#' @keywords internal
collection_mail_prueba_horario_sortear <- function(sid, semilla = NULL, rehacer = FALSE) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  h <- .mph_cfg(.mseg_get(sid))
  if (!length(h$campanas)) {
    stop_api(422, "E_COLLECTION_MAIL_PRUEBA_INPUT", "Marca primero los públicos que entran a la prueba.")
  }
  if (nzchar(h$sorteado_en) && !isTRUE(rehacer)) {
    stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SORTEADA",
             "Los grupos ya se sortearon y cada persona conserva el suyo durante la prueba.")
  }
  semilla <- suppressWarnings(as.integer(unlist(semilla %||% format(Sys.Date(), "%Y%m%d"))[1]))
  if (is.na(semilla) || semilla < 1L) stop_api(422, "E_COLLECTION_MAIL_PRUEBA_INPUT", "La semilla es un número entero positivo.")
  conteo <- list()
  for (id in h$campanas) {
    store <- .cmail_recipients_load(session, id)
    p <- if (is.null(store)) list(key = character(0)) else .mph_personas_campana(store)
    if (!length(p$key)) {
      stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SIN_PERSONAS",
               sprintf("La campaña \"%s\" no tiene contactos con enlace personal: genera los enlaces en Contactos.", id))
    }
    g <- .mph_sortear(p$token, semilla, id)
    store$grupo_horario <- stats::setNames(g, p$key)
    .cmail_recipients_save(session, id, store)
    conteo[[id]] <- list(A = sum(g == "A"), B = sum(g == "B"))
  }
  # Un público que sale de la prueba pierde su grupo.
  for (c in .mseg_campanas_mc(session)) if (!(c$campaign_id %in% h$campanas)) {
    store <- .cmail_recipients_load(session, c$campaign_id)
    if (!is.null(store) && length(store$grupo_horario)) { store$grupo_horario <- NULL; .cmail_recipients_save(session, c$campaign_id, store) }
  }
  .cmail_contactos_touch(sid)
  h$semilla <- semilla
  h$sorteado_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  h$etiquetado_en <- ""
  .mph_put(sid, h)
  list(ok = TRUE, semilla = semilla, grupos = conteo)
}

# ---- etiquetas en Mailchimp -----------------------------------------------------------

.mph_etiquetar_prepare <- function(sid) {
  session <- session_get(sid)
  cfg <- .mseg_get(sid)
  h <- .mph_cfg(cfg)
  if (!nzchar(h$sorteado_en)) stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SIN_GRUPOS", "Asigna primero los grupos al azar.")
  list_id <- .mseg_chr(cfg$list_id)
  if (!nzchar(list_id)) stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "Elige la audiencia de Mailchimp del estudio.")
  A <- character(0); B <- character(0)
  for (id in h$campanas) {
    store <- .cmail_recipients_load(session, id)
    gh <- store$grupo_horario %||% character(0)
    A <- c(A, names(gh)[gh == "A"]); B <- c(B, names(gh)[gh == "B"])
    # El segundo correo de la persona va con su grupo.
    sc <- store$segundo_correo
    if (is.data.frame(sc) && nrow(sc)) {
      ok <- sc$brazo == "personal" & sc$estado == "cargado"
      A <- c(A, tolower(sc$correo[ok & sc$clave %in% names(gh)[gh == "A"]]))
      B <- c(B, tolower(sc$correo[ok & sc$clave %in% names(gh)[gh == "B"]]))
    }
  }
  list(list_id = list_id, etiquetas = h$etiquetas, A = unique(A), B = unique(B),
       mc_key = .connections_token_require("mailchimp", sid))
}

.mph_etiquetar_run <- function(input, report = function(...) invisible(NULL)) {
  report("mailchimp", percent = 2, message = "Mailchimp: leyendo los contactos activos...")
  activos <- .mc_active_emails(input$mc_key, input$list_id)
  out <- list(ok = TRUE)
  for (g in c("A", "B")) {
    emails <- intersect(input[[g]], activos)
    tag <- input$etiquetas[[g]]
    tag_id <- .mc_tag_id(input$mc_key, input$list_id, tag)
    r <- .mc_tag_emails(input$mc_key, input$list_id, tag_id, emails, report = function(done, total)
      report("mailchimp", current = done, total = total, message = sprintf("Etiqueta \"%s\": %s", tag, .mc_progress_label(done, total))))
    out[[g]] <- list(etiqueta = tag, etiquetados = r$added, inactivos = length(setdiff(input[[g]], activos)))
  }
  out
}

#' Worker del job "Etiquetar los grupos" (callr). @keywords internal
collection_mail_prueba_horario_etiquetar_job <- function(sid, input_path, progress_path = NULL) {
  .mc_job_run(input_path, progress_path, .mph_etiquetar_run)
}

#' `POST /api/recopiladores/mail-seguimiento/horario/etiquetar`. @keywords internal
collection_mail_prueba_horario_etiquetar_submit <- function(sid) {
  .cmail_contactos_assert_local()
  input <- .mph_etiquetar_prepare(sid)
  hook <- function(j) {
    res <- j$result_data
    if (is.list(res) && isTRUE(res$ok)) {
      h <- .mph_cfg(.mseg_get(sid))
      h$etiquetado_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      .mph_put(sid, h)
    }
    res
  }
  .mc_job_submit(sid, "recopiladores.mail_prueba_etiquetar", "collection_mail_prueba_horario_etiquetar_job", input,
                 on_complete = hook)
}

# ---- plan de recordatorios ---------------------------------------------------------------

#' Propone el plan cruzado. Puro.
#' @param rondas list de list(ronda, fecha "YYYY-MM-DD").
#' @param campanas ids de los públicos en la prueba.
#' @param oficina ids con horario de oficina.
#' @param horas list(manana, noche, oficina_temprano, oficina_media) en "HH:MM".
#' @return list de filas list(ronda, campaign_id, grupo, programado).
#' @keywords internal
.mph_plan_proponer <- function(rondas, campanas, oficina, horas) {
  filas <- list()
  for (i in seq_along(rondas)) {
    r <- rondas[[i]]
    cruzado <- i %% 2L == 0L
    for (id in campanas) {
      if (id %in% oficina) { h1 <- horas$oficina_media; h2 <- horas$oficina_temprano }
      else { h1 <- horas$manana; h2 <- horas$noche }
      hA <- if (cruzado) h2 else h1; hB <- if (cruzado) h1 else h2
      filas[[length(filas) + 1L]] <- list(ronda = as.integer(r$ronda), campaign_id = id, grupo = "A", programado = paste0(r$fecha, "T", hA))
      filas[[length(filas) + 1L]] <- list(ronda = as.integer(r$ronda), campaign_id = id, grupo = "B", programado = paste0(r$fecha, "T", hB))
    }
  }
  filas
}

#' Avisos del plan. Puro. Cada aviso dice la causa.
#' @keywords internal
.mph_plan_avisos <- function(plan, campanas, oficina, desde, hasta, publicos = NULL) {
  nombre <- function(id) (publicos %||% list())[[id]] %||% id
  avisos <- list()
  add <- function(tipo, ronda, id, texto) avisos[[length(avisos) + 1L]] <<- list(tipo = tipo, ronda = ronda, campaign_id = id, texto = texto)
  for (f in plan) {
    t <- .mph_programado_time(f$programado)
    if (is.na(t)) next
    if (f$campaign_id %in% oficina) {
      m <- as.POSIXlt(t, tz = .MPH_TZ)$hour * 60L + as.POSIXlt(t, tz = .MPH_TZ)$min
      if (m < .mph_minutos(desde) || m > .mph_minutos(hasta)) {
        add("fuera_de_oficina", f$ronda, f$campaign_id,
            sprintf("Recordatorio %d, %s, grupo %s: las %s quedan fuera del horario de oficina (%s a %s).",
                    f$ronda, nombre(f$campaign_id), f$grupo, .mph_hora_txt(t), desde, hasta))
      }
    }
  }
  rondas <- sort(unique(vapply(plan, function(f) as.integer(f$ronda), 0L)))
  for (k in rondas) for (id in campanas) {
    fs <- Filter(function(f) f$ronda == k && identical(f$campaign_id, id), plan)
    hs <- lapply(c("A", "B"), function(g) { x <- Filter(function(f) identical(f$grupo, g), fs); if (length(x)) .mph_programado_time(x[[1]]$programado) else as.POSIXct(NA) })
    if (any(vapply(hs, is.na, NA))) {
      add("falta_hora", k, id, sprintf("Recordatorio %d, %s: falta la hora de un grupo.", k, nombre(id)))
    } else if (abs(as.numeric(hs[[1]]) - as.numeric(hs[[2]])) < 60) {
      add("misma_hora", k, id, sprintf("Recordatorio %d, %s: los dos grupos tienen la misma hora, así que este público no entra a la comparación.", k, nombre(id)))
    }
  }
  avisos
}

.mph_plan_normalizar <- function(plan, campanas) {
  bad <- function(msg) stop_api(422, "E_COLLECTION_MAIL_PRUEBA_PLAN", msg)
  if (!is.list(plan)) bad("El plan es una lista de filas.")
  lapply(plan, function(f) {
    ronda <- suppressWarnings(as.integer(unlist(f$ronda)[1]))
    id <- .mseg_chr(f$campaign_id); g <- .mseg_chr(f$grupo); prog <- .mseg_chr(f$programado)
    if (is.na(ronda) || ronda < 1L) bad("Cada fila del plan necesita su recordatorio.")
    if (!(id %in% campanas)) bad(sprintf("\"%s\" no está en la prueba.", id))
    if (!(g %in% c("A", "B"))) bad("El grupo es A o B.")
    if (nzchar(prog) && !grepl(.MPH_PROGRAMADO_RE, prog)) bad("La hora programada se escribe como 2026-11-11T20:00.")
    mc <- .mseg_chr(f$mailchimp_id)
    if (nzchar(mc) && !grepl("^[a-z0-9]{6,20}$", mc)) bad("El id de la campaña de Mailchimp tiene letras minúsculas y números.")
    list(ronda = ronda, campaign_id = id, grupo = g, programado = prog, mailchimp_id = mc,
         enviado = .mseg_chr(f$enviado), enviados = suppressWarnings(as.integer(unlist(f$enviados %||% NA)[1])))
  })
}

#' `PUT /api/recopiladores/mail-seguimiento/horario/plan`: guarda el plan o,
#' con `proponer`, lo arma cruzado desde las fechas y horas dadas.
#' @keywords internal
collection_mail_prueba_horario_plan <- function(sid, plan = NULL, proponer = NULL) {
  .cmail_contactos_assert_local()
  h <- .mph_cfg(.mseg_get(sid))
  if (!length(h$campanas)) stop_api(422, "E_COLLECTION_MAIL_PRUEBA_INPUT", "Marca primero los públicos que entran a la prueba.")
  if (is.list(proponer)) {
    horas <- list(manana = .mseg_chr(proponer$manana, "09:30"), noche = .mseg_chr(proponer$noche, "20:00"),
                  oficina_temprano = .mseg_chr(proponer$oficina_temprano, h$oficina_desde),
                  oficina_media = .mseg_chr(proponer$oficina_media, "10:00"))
    for (v in horas) if (!grepl(.MPH_HORA_RE, v)) stop_api(422, "E_COLLECTION_MAIL_PRUEBA_PLAN", "La hora se escribe como 08:30.")
    rondas <- lapply(proponer$rondas %||% list(), function(r) list(ronda = as.integer(unlist(r$ronda)[1]), fecha = .mseg_chr(r$fecha)))
    if (!length(rondas)) stop_api(422, "E_COLLECTION_MAIL_PRUEBA_PLAN", "Indica la fecha de cada recordatorio.")
    for (r in rondas) if (is.na(r$ronda) || !grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", r$fecha)) {
      stop_api(422, "E_COLLECTION_MAIL_PRUEBA_PLAN", "Cada recordatorio necesita su fecha (2026-11-11).")
    }
    nuevo <- .mph_plan_proponer(rondas, h$campanas, h$oficina, horas)
    # Lo ya creado en Mailchimp no se pierde al proponer de nuevo.
    previo <- h$plan %||% list()
    llave <- function(f) paste(f$ronda, f$campaign_id, f$grupo)
    pk <- vapply(previo, llave, "")
    plan <- lapply(nuevo, function(f) {
      i <- match(llave(f), pk)
      if (!is.na(i) && nzchar(.mseg_chr(previo[[i]]$mailchimp_id))) previo[[i]] else f
    })
    h$plan <- .mph_plan_normalizar(plan, h$campanas)
  } else {
    h$plan <- .mph_plan_normalizar(plan %||% list(), h$campanas)
  }
  .mph_put(sid, h)
  collection_mail_seguimiento_estado(sid)
}

# ---- borradores por grupo y lectura de los envíos --------------------------------------

#' `POST /api/recopiladores/mail-seguimiento/horario/borrador`: el borrador de
#' un grupo para un recordatorio de un público. No envía ni programa.
#' @keywords internal
collection_mail_prueba_horario_borrador <- function(sid, campaign_id, ronda, grupo, from_name, reply_to) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  cfg <- .mseg_get(sid)
  h <- .mph_cfg(cfg)
  ronda <- suppressWarnings(as.integer(unlist(ronda)[1])); grupo <- .mseg_chr(grupo); campaign_id <- .mseg_chr(campaign_id)
  if (!(campaign_id %in% h$campanas) || !(grupo %in% c("A", "B")) || is.na(ronda)) {
    stop_api(422, "E_COLLECTION_MAIL_PRUEBA_INPUT", "Elige el público, el recordatorio y el grupo.")
  }
  if (!nzchar(h$etiquetado_en)) {
    stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SIN_GRUPOS", "Pon primero las etiquetas de los grupos en Mailchimp.")
  }
  campaign <- Filter(function(c) identical(c$campaign_id, campaign_id), .mseg_campanas_mc(session))[[1]]
  recs <- .mseg_recordatorios(campaign)
  if (ronda > length(recs)) {
    stop_api(422, "E_COLLECTION_MAIL_PRUEBA_INPUT", sprintf("La campaña tiene %d recordatorios.", length(recs)))
  }
  fila <- Filter(function(f) f$ronda == ronda && identical(f$campaign_id, campaign_id) && identical(f$grupo, grupo), h$plan)
  t <- if (length(fila)) .mph_programado_time(fila[[1]]$programado) else as.POSIXct(NA)
  sufijo <- sprintf(", grupo %s%s", grupo, if (is.na(t)) "" else sprintf(" (%s)", .mph_hora_txt(t)))
  out <- collection_mail_mailchimp_campaign_draft(sid, campaign_id, recs[[ronda]]$send_id, cfg$list_id, from_name, reply_to,
                                                  exclude_tag = cfg$tag, group_tag = h$etiquetas[[grupo]],
                                                  title_suffix = sufijo)
  # Se guarda el id en el plan para leer después la hora real del envío.
  h <- .mph_cfg(.mseg_get(sid))
  hit <- FALSE
  h$plan <- lapply(h$plan, function(f) {
    if (f$ronda == ronda && identical(f$campaign_id, campaign_id) && identical(f$grupo, grupo)) { f$mailchimp_id <- out$mailchimp_campaign_id; hit <<- TRUE }
    f
  })
  if (!hit) h$plan[[length(h$plan) + 1L]] <- list(ronda = ronda, campaign_id = campaign_id, grupo = grupo, programado = "",
                                                  mailchimp_id = out$mailchimp_campaign_id, enviado = "", enviados = NA_integer_)
  .mph_put(sid, h)
  out
}

#' `POST /api/recopiladores/mail-seguimiento/horario/leer-envios`: hora real y
#' entregas de cada borrador del plan, desde Mailchimp (sólo GET).
#' @keywords internal
collection_mail_prueba_horario_leer_envios <- function(sid) {
  .cmail_contactos_assert_local()
  h <- .mph_cfg(.mseg_get(sid))
  con_id <- Filter(function(f) nzchar(.mseg_chr(f$mailchimp_id)), h$plan)
  if (!length(con_id)) {
    stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SIN_ENVIOS",
             "Ninguna fila del plan tiene su campaña de Mailchimp: crea los borradores desde aquí o pega su id.")
  }
  key <- .connections_token_require("mailchimp", sid)
  leidas <- 0L
  h$plan <- lapply(h$plan, function(f) {
    id <- .mseg_chr(f$mailchimp_id)
    if (!nzchar(id)) return(f)
    info <- .mc_call("GET", sprintf("/campaigns/%s", id), key, query = list(fields = "status,send_time,emails_sent"))
    if (identical(.mseg_chr(info$status), "sent")) {
      f$enviado <- .mseg_chr(info$send_time)
      f$enviados <- as.integer(info$emails_sent %||% NA_integer_)
      leidas <<- leidas + 1L
    }
    f
  })
  .mph_put(sid, h)
  list(ok = TRUE, leidas = leidas, con_campana = length(con_id))
}

# ---- estado y resultados ---------------------------------------------------------------

.mph_publicos <- function(session) {
  cs <- .mseg_campanas_mc(session)
  stats::setNames(lapply(cs, .mseg_publico), vapply(cs, function(c) c$campaign_id, ""))
}

# Recordatorios de la prueba: el k-ésimo recordatorio de cada público, con el
# rótulo del primer público.
.mph_rondas <- function(session, h) {
  cs <- Filter(function(c) c$campaign_id %in% h$campanas, .mseg_campanas_mc(session))
  if (!length(cs)) return(list())
  n <- max(vapply(cs, function(c) length(.mseg_recordatorios(c)), 0L))
  lapply(seq_len(n), function(k) {
    lab <- NULL
    for (c in cs) { r <- .mseg_recordatorios(c); if (length(r) >= k) { lab <- .mseg_chr(r[[k]]$label); break } }
    list(ronda = k, etiqueta = lab %||% sprintf("Recordatorio %d", k))
  })
}

.mph_estado <- function(sid, cfg, session) {
  h <- .mph_cfg(cfg)
  publicos <- .mph_publicos(session)
  plan <- lapply(h$plan, function(f) { t <- .mph_programado_time(f$programado); f$hora_txt <- .mph_hora_txt(t); f })
  list(
    semilla = if (is.na(h$semilla)) NULL else as.integer(h$semilla),
    campanas = I(h$campanas), oficina = I(h$oficina),
    oficina_desde = h$oficina_desde, oficina_hasta = h$oficina_hasta,
    etiquetas = h$etiquetas, horizonte_h = h$horizonte_h,
    sorteado_en = h$sorteado_en, etiquetado_en = h$etiquetado_en,
    rondas = .mph_rondas(session, h),
    plan = plan,
    avisos = .mph_plan_avisos(h$plan, h$campanas, h$oficina, h$oficina_desde, h$oficina_hasta, publicos)
  )
}

# Hora de cada envío para el análisis: la real si se leyó de Mailchimp; si no,
# la programada, siempre que ya haya pasado.
.mph_envios_tabla <- function(session, h, ahora) {
  publicos <- .mph_publicos(session)
  rondas <- .mph_rondas(session, h)
  etq <- vapply(rondas, function(r) r$etiqueta, "")
  filas <- lapply(h$plan, function(f) {
    real <- .mc_parse_time(f$enviado)
    t <- if (!is.na(real)) real else .mph_programado_time(f$programado)
    data.frame(ronda = f$ronda, etiqueta = if (f$ronda <= length(etq)) etq[[f$ronda]] else sprintf("Recordatorio %d", f$ronda),
               publico = publicos[[f$campaign_id]] %||% f$campaign_id, grupo = f$grupo,
               hora = as.POSIXct(t, tz = "UTC"), fuente = if (!is.na(real)) "mailchimp" else "plan",
               stringsAsFactors = FALSE)
  })
  if (!length(filas)) return(data.frame(ronda = integer(0), etiqueta = character(0), publico = character(0),
                                        grupo = character(0), hora = as.POSIXct(character(0)), fuente = character(0)))
  do.call(rbind, filas)
}

.mph_personas_tabla <- function(session, h) {
  publicos <- .mph_publicos(session)
  filas <- lapply(h$campanas, function(id) {
    store <- .cmail_recipients_load(session, id)
    gh <- store$grupo_horario %||% character(0)
    if (!length(gh)) return(NULL)
    ce <- store$completo_en %||% character(0)
    t <- vapply(names(gh), function(k) { v <- ce[k]; if (is.na(v)) NA_real_ else as.numeric(.mc_parse_time(v)) }, 0)
    data.frame(publico = publicos[[id]] %||% id, grupo = unname(gh),
               completo_en = as.POSIXct(t, origin = "1970-01-01", tz = "UTC"), stringsAsFactors = FALSE)
  })
  filas <- Filter(Negate(is.null), filas)
  if (!length(filas)) return(data.frame(publico = character(0), grupo = character(0), completo_en = as.POSIXct(character(0))))
  do.call(rbind, filas)
}

#' `GET /api/recopiladores/mail-seguimiento/horario/resultados`.
#' @keywords internal
collection_mail_prueba_horario_resultados <- function(sid, horizonte_h = NULL, ahora = Sys.time()) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  h <- .mph_cfg(.mseg_get(sid))
  if (!nzchar(h$sorteado_en)) stop_api(409, "E_COLLECTION_MAIL_PRUEBA_SIN_GRUPOS", "Asigna primero los grupos al azar.")
  H <- suppressWarnings(as.numeric(unlist(horizonte_h %||% h$horizonte_h)[1]))
  if (is.na(H) || H < 1 || H > 168) H <- h$horizonte_h
  personas <- .mph_personas_tabla(session, h)
  envios <- .mph_envios_tabla(session, h, ahora)
  leidas <- vapply(.mseg_campanas_mc(session), function(c) {
    s <- .cmail_recipients_load(session, c$campaign_id); .mseg_chr(s$lectura$leido_en)
  }, "")
  leidas <- leidas[nzchar(leidas)]
  res <- if (nrow(envios)) .mph_analizar(personas, envios, H, ahora)
         else list(rondas = list(), horizonte_h = H, cruce = list(confirmado = FALSE, texto = ""))
  res$ok <- TRUE
  res$semilla <- as.integer(h$semilla)
  res$personas <- nrow(personas)
  res$con_completa <- sum(!is.na(personas$completo_en))
  res$respuestas_leidas_en <- if (length(leidas)) min(leidas) else ""
  res$horas_de_mailchimp <- sum(envios$fuente == "mailchimp")
  # Sólo las que entran al análisis: un recordatorio que aún no sale no cuenta.
  res$horas_del_plan <- sum(envios$fuente == "plan" & !is.na(envios$hora) & envios$hora <= as.POSIXct(ahora, tz = "UTC"))
  res
}
