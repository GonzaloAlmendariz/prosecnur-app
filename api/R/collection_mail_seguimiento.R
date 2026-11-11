# =============================================================================
# Material de campo › Correo › Seguimiento: operaciones del estudio entero
# sobre todas sus campañas de Mailchimp a la vez (una campaña por público).
#
#   - "Quién respondió" en todas las campañas, en un solo trabajo: lee
#     SurveyMonkey por campaña, etiqueta "Respondió" a los activos y, si está
#     marcado, archiva a quien respondió con sus dos correos.
#   - "Antes de cada envío": mientras la app está abierta, la vista consulta
#     cada pocos minutos (`.../antes-de-envio`) y el backend decide si falta
#     poco para la próxima campaña programada en Mailchimp; si es así, lanza la
#     actualización una vez por hora de envío. La app no programa ni envía.
#
# Configuración en `s$mail_seguimiento` (schema mail_seguimiento_v1, viaja en
# el .pulso, sin correos): audiencia, etiqueta, archivar, minutos de
# anticipación, encuesta de SurveyMonkey por campaña, y las secciones de la
# prueba de horarios (collection_mail_prueba_horario.R) y del correo personal
# (collection_mail_correo_personal.R). Los datos por persona (grupo, hora de
# la completa, segundo correo) viven en el store de contactos de cada campaña.
# =============================================================================

.MSEG_SCHEMA <- "mail_seguimiento_v1"
.MSEG_MINUTOS_DEFAULT <- 30L

.mseg_chr <- function(x, default = "") {
  v <- as.character(unlist(x %||% default))[1]
  if (is.na(v)) default else trimws(v)
}

.mseg_default <- function() {
  list(schema = .MSEG_SCHEMA, list_id = "", tag = .MC_TAG_DEFAULT, archivar = TRUE,
       antes_de_envio = list(activo = FALSE, minutos = .MSEG_MINUTOS_DEFAULT),
       encuestas = list(), ultima_para = "", ultima_job = "", ultima_at = "",
       horario = NULL, correo_personal = NULL)
}

#' Configuración de Seguimiento de la sesión, con valores por defecto.
#' @keywords internal
.mseg_get <- function(sid) {
  cfg <- session_get(sid)$mail_seguimiento
  base <- .mseg_default()
  if (!is.list(cfg) || !identical(cfg$schema, .MSEG_SCHEMA)) return(base)
  for (k in names(base)) if (is.null(cfg[[k]]) && !is.null(base[[k]])) cfg[[k]] <- base[[k]]
  cfg
}

.mseg_put <- function(sid, cfg) {
  cfg$schema <- .MSEG_SCHEMA
  session_set(sid, "mail_seguimiento", cfg)
  invisible(cfg)
}

# Campañas de Mailchimp del proyecto, en su orden.
.mseg_campanas_mc <- function(session) {
  state <- .collection_current(session)
  Filter(function(c) identical(.cmail_platform_of(c), "mailchimp"), .cmail_campaigns_of(state)$campaigns)
}

# Público de una campaña: su actor o, sin él, su nombre.
.mseg_publico <- function(campaign) {
  a <- .mseg_chr(campaign$actor)
  if (nzchar(a)) a else .mseg_chr(campaign$name, campaign$campaign_id)
}

# Recordatorios de una campaña, en orden.
.mseg_recordatorios <- function(campaign) {
  Filter(function(s) identical(s$kind, "recordatorio"), .cmail_sends_of(campaign))
}

# Resumen de una campaña para la vista (sin correos).
.mseg_resumen_campana <- function(session, campaign, cfg) {
  store <- .cmail_recipients_load(session, campaign$campaign_id)
  base <- list(campaign_id = campaign$campaign_id, nombre = .mseg_chr(campaign$name), publico = .mseg_publico(campaign),
               recordatorios = lapply(.mseg_recordatorios(campaign), function(s) list(send_id = s$send_id, etiqueta = .mseg_chr(s$label))),
               encuesta = .mseg_chr(cfg$encuestas[[campaign$campaign_id]] %||% (store$lectura$survey_id %||% "")),
               contactos = FALSE, personas = 0L, con_enlace = 0L, respondieron = NA_integer_, a_medias = NA_integer_,
               leido_en = "", archivados = FALSE, grupos = list(A = 0L, B = 0L),
               segundo_correo = list(personal = 0L, control = 0L, cargados = 0L, rechazados = 0L))
  if (is.null(store)) return(base)
  fr <- .cmail_contact_frame(store)
  res <- .cmail_contact_resumen(store, fr)
  gh <- store$grupo_horario %||% character(0)
  sc <- store$segundo_correo
  base$contactos <- TRUE
  base$personas <- res$efectivos
  base$con_enlace <- res$con_enlace
  base$respondieron <- res$respondieron
  base$a_medias <- res$a_medias
  base$leido_en <- .mseg_chr(res$leido_en)
  base$archivados <- isTRUE(store$lectura$archivados)
  base$grupos <- list(A = sum(gh == "A"), B = sum(gh == "B"))
  if (is.data.frame(sc) && nrow(sc)) {
    base$segundo_correo <- list(personal = sum(sc$brazo == "personal"), control = sum(sc$brazo == "control"),
                                cargados = sum(sc$estado == "cargado"), rechazados = sum(sc$estado == "rechazado"))
  }
  base
}

#' `GET /api/recopiladores/mail-seguimiento`: configuración y campañas.
#' @keywords internal
collection_mail_seguimiento_estado <- function(sid) {
  .cmail_contactos_assert_local()
  session <- session_get(sid)
  cfg <- .mseg_get(sid)
  campanas <- lapply(.mseg_campanas_mc(session), .mseg_resumen_campana, session = session, cfg = cfg)
  list(
    ok = TRUE,
    config = list(list_id = .mseg_chr(cfg$list_id), tag = .mseg_chr(cfg$tag, .MC_TAG_DEFAULT),
                  archivar = isTRUE(cfg$archivar),
                  antes_de_envio = list(activo = isTRUE(cfg$antes_de_envio$activo),
                                        minutos = as.integer(cfg$antes_de_envio$minutos %||% .MSEG_MINUTOS_DEFAULT)),
                  ultima_para = .mseg_chr(cfg$ultima_para), ultima_at = .mseg_chr(cfg$ultima_at)),
    campanas = campanas,
    horario = .mph_estado(sid, cfg, session),
    correo_personal = .mcp_estado(cfg, session)
  )
}

#' `PUT /api/recopiladores/mail-seguimiento/config`: audiencia, etiqueta,
#' archivar, antes de cada envío y la encuesta de cada campaña.
#' @keywords internal
collection_mail_seguimiento_config <- function(sid, list_id = NULL, tag = NULL, archivar = NULL,
                                               antes_de_envio = NULL, encuestas = NULL) {
  .cmail_contactos_assert_local()
  cfg <- .mseg_get(sid)
  if (!is.null(list_id)) {
    v <- .mseg_chr(list_id)
    if (nzchar(v) && !grepl("^[A-Za-z0-9]{2,32}$", v)) {
      stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "Elige una audiencia de Mailchimp válida.")
    }
    cfg$list_id <- v
  }
  if (!is.null(tag)) {
    v <- .mseg_chr(tag, .MC_TAG_DEFAULT)
    if (!nzchar(v) || nchar(v) > 60L) stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "La etiqueta va de 1 a 60 caracteres.")
    cfg$tag <- v
  }
  if (!is.null(archivar)) cfg$archivar <- isTRUE(archivar)
  if (is.list(antes_de_envio)) {
    if (!is.null(antes_de_envio$activo)) cfg$antes_de_envio$activo <- isTRUE(antes_de_envio$activo)
    if (!is.null(antes_de_envio$minutos)) {
      m <- suppressWarnings(as.integer(unlist(antes_de_envio$minutos)[1]))
      if (is.na(m) || m < 5L || m > 180L) {
        stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "La anticipación va de 5 a 180 minutos.")
      }
      cfg$antes_de_envio$minutos <- m
    }
  }
  if (is.list(encuestas)) {
    ids <- vapply(.mseg_campanas_mc(session_get(sid)), function(c) c$campaign_id, "")
    for (k in names(encuestas)) {
      if (!(k %in% ids)) stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", sprintf("No hay una campaña de Mailchimp \"%s\".", k))
      v <- .mseg_chr(encuestas[[k]])
      if (nzchar(v) && !grepl("^[0-9]{3,20}$", v)) {
        stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "El id de la encuesta de SurveyMonkey es un número.")
      }
      cfg$encuestas[[k]] <- if (nzchar(v)) v else NULL
    }
  }
  .mseg_put(sid, cfg)
  collection_mail_seguimiento_estado(sid)
}

# ---- Quién respondió, en todas las campañas -----------------------------------

# Insumos de cada campaña lista para leer (contactos con enlace y encuesta).
# Las campañas sin contactos, sin enlaces o sin encuesta se informan y se saltan.
.mseg_sync_prepare <- function(sid, archivar = NULL) {
  session <- session_get(sid)
  cfg <- .mseg_get(sid)
  list_id <- .mseg_chr(cfg$list_id)
  if (!nzchar(list_id)) stop_api(422, "E_COLLECTION_MAIL_SEGUIMIENTO_INPUT", "Elige la audiencia de Mailchimp del estudio.")
  archivar <- if (is.null(archivar)) isTRUE(cfg$archivar) else isTRUE(archivar)
  entradas <- list(); saltadas <- list()
  for (c in .mseg_campanas_mc(session)) {
    store <- .cmail_recipients_load(session, c$campaign_id)
    survey <- .mseg_chr(cfg$encuestas[[c$campaign_id]] %||% (store$lectura$survey_id %||% ""))
    motivo <- if (is.null(store)) "no tiene contactos"
              else if (!nzchar(survey)) "falta elegir su encuesta de SurveyMonkey"
              else NULL
    if (is.null(motivo)) {
      inp <- tryCatch(.mc_sync_prepare(sid, c$campaign_id, survey, list_id, cfg$tag, archive = archivar, mc_key = FALSE),
                      api_error = function(e) e)
      if (inherits(inp, "api_error")) motivo <- conditionMessage(inp)
      else entradas[[length(entradas) + 1L]] <- inp
    }
    if (!is.null(motivo)) saltadas[[length(saltadas) + 1L]] <- list(campaign_id = c$campaign_id, publico = .mseg_publico(c), motivo = motivo)
  }
  if (!length(entradas)) {
    stop_api(409, "E_COLLECTION_MAIL_SEGUIMIENTO_SIN_CAMPANAS",
             "Ninguna campaña está lista: cada una necesita contactos con su enlace personal y su encuesta de SurveyMonkey.",
             details = list(saltadas = saltadas))
  }
  list(list_id = list_id, tag = cfg$tag, archive = archivar, campanas = entradas, saltadas = saltadas,
       mc_key = .connections_token_require("mailchimp", sid))
}

#' Worker: todas las campañas sobre la misma audiencia (los activos se leen una vez).
#' @keywords internal
.mseg_sync_run <- function(input, report = function(...) invisible(NULL)) {
  report("mailchimp", percent = 2, message = "Mailchimp: leyendo los contactos activos...")
  activos <- .mc_active_emails(input$mc_key, input$list_id)
  n <- length(input$campanas)
  resultados <- list()
  for (i in seq_len(n)) {
    inp <- input$campanas[[i]]
    inp$mc_key <- input$mc_key
    paso <- function(stage, ...) {
      args <- list(...)
      args$message <- sprintf("Campaña %d de %d. %s", i, n, args$message %||% "")
      args$percent <- round(100 * (i - 1) / n + (args$percent %||% 50) / n)
      do.call(report, c(list(stage), args))
    }
    r <- tryCatch(.mc_sync_run(inp, paso, activos = activos), error = .mc_job_error)
    r$campaign_id <- inp$campaign_id
    resultados[[length(resultados) + 1L]] <- r
  }
  list(ok = TRUE, campanas = resultados, saltadas = input$saltadas, archive = isTRUE(input$archive),
       synced_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))
}

#' Worker del job "Quién respondió en todas las campañas" (corre en callr).
#' @keywords internal
collection_mail_seguimiento_sync_job <- function(sid, input_path, progress_path = NULL) {
  .mc_job_run(input_path, progress_path, .mseg_sync_run)
}

# Al cosechar: marca cada campaña en sus contactos y deja sólo conteos.
.mseg_sync_hook <- function(sid, ctx) {
  function(j) {
    res <- j$result_data
    if (!is.list(res) || !isTRUE(res$ok)) return(res)
    res$campanas <- lapply(res$campanas, function(r) {
      c <- ctx[[r$campaign_id]]
      if (is.null(c)) { r$respondent_tokens <- NULL; r$respondent_times <- NULL; r$partial_tokens <- NULL; return(r) }
      .mc_sync_mark(sid, c, r)
    })
    res$totales <- list(
      respondieron = sum(vapply(res$campanas, function(r) as.integer(r$respondents %||% 0L), 0L)),
      etiquetados = sum(vapply(res$campanas, function(r) as.integer(r$tagged %||% 0L), 0L)),
      archivados = sum(vapply(res$campanas, function(r) as.integer(r$archived %||% 0L), 0L)),
      a_medias = sum(vapply(res$campanas, function(r) as.integer(r$partial_people %||% 0L), 0L))
    )
    res
  }
}

#' `POST /api/recopiladores/mail-seguimiento/sync`: lanza el job.
#' @keywords internal
collection_mail_seguimiento_sync_submit <- function(sid, archivar = NULL, motivo = "manual") {
  .cmail_contactos_assert_local()
  input <- .mseg_sync_prepare(sid, archivar)
  ctx <- lapply(stats::setNames(input$campanas, vapply(input$campanas, function(x) x$campaign_id, "")),
                function(x) list(campaign_id = x$campaign_id, survey_id = x$survey_id))
  out <- .mc_job_submit(sid, "recopiladores.mail_seguimiento_sync", "collection_mail_seguimiento_sync_job", input,
                        on_complete = .mseg_sync_hook(sid, ctx))
  out$campanas <- length(input$campanas)
  out$saltadas <- input$saltadas
  out$motivo <- motivo
  out
}

# ---- antes de cada envío ------------------------------------------------------------

#' `GET /api/recopiladores/mail-seguimiento/programadas`: campañas programadas
#' en Mailchimp para la audiencia del estudio (sin correos).
#' @keywords internal
collection_mail_seguimiento_programadas <- function(sid) {
  .cmail_contactos_assert_local()
  cfg <- .mseg_get(sid)
  key <- .connections_token_require("mailchimp", sid)
  list(ok = TRUE, programadas = .mc_scheduled_campaigns(key, .mseg_chr(cfg$list_id)))
}

#' `POST /api/recopiladores/mail-seguimiento/antes-de-envio`: la vista lo llama
#' cada pocos minutos con la opción activa. Si falta poco para la próxima
#' campaña programada y no se corrió para esa hora, lanza la actualización.
#' @return list(ok, activo, lanzado, job_id?, proximo).
#' @keywords internal
collection_mail_seguimiento_antes_de_envio <- function(sid, ahora = Sys.time()) {
  .cmail_contactos_assert_local()
  cfg <- .mseg_get(sid)
  if (!isTRUE(cfg$antes_de_envio$activo)) return(list(ok = TRUE, activo = FALSE, lanzado = FALSE, proximo = NULL))
  key <- .connections_token_require("mailchimp", sid)
  prog <- .mc_scheduled_campaigns(key, .mseg_chr(cfg$list_id))
  minutos <- as.integer(cfg$antes_de_envio$minutos %||% .MSEG_MINUTOS_DEFAULT)
  d <- .mc_antes_de_envio_decidir(prog, ahora, minutos, cfg$ultima_para)
  out <- list(ok = TRUE, activo = TRUE, lanzado = FALSE, proximo = d$proximo, minutos = minutos)
  if (!isTRUE(d$lanzar)) return(out)
  job <- collection_mail_seguimiento_sync_submit(sid, motivo = "antes_de_envio")
  cfg <- .mseg_get(sid)
  cfg$ultima_para <- d$para
  cfg$ultima_job <- job$job_id
  cfg$ultima_at <- format(as.POSIXct(ahora, tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  .mseg_put(sid, cfg)
  out$lanzado <- TRUE
  out$job_id <- job$job_id
  out
}
