# Monitoreo › Avance › Correo (T3): lectura de Mailchimp sin red y modelo por
# público y por envío. Contrato: docs/qa/checklist-monitoreo-mailchimp-t3-2026-10-22.md.

.mcmt_key <- "0123456789abcdef0123456789abcdef-us21"

# Mailchimp simulado: dos envíos al público «Estudiantes de pregrado» (una
# invitación y un recordatorio que excluye «Respondió»), cinco destinatarios.
.mcmt_destinatario <- function(id, token, status = "sent", opens = 0L) {
  list(email_id = id, status = status, open_count = opens,
       merge_fields = list(FNAME = "x", ENLACE = paste0("https://es.surveymonkey.com/r/ABC?t=", token)))
}

.mcmt_respuestas <- list(
  "/campaigns" = list(total_items = 2L, campaigns = list(
    list(id = "c1", status = "sent", send_time = "2026-10-27T13:00:00+00:00", emails_sent = 5L,
         settings = list(title = "Invitación · Pregrado", subject_line = "Asunto"),
         recipients = list(list_id = "L1", segment_opts = list(conditions = list(
           list(condition_type = "StaticSegment", op = "static_is", value = 11L))))),
    list(id = "c2", status = "sent", send_time = "2026-10-30T13:00:00+00:00", emails_sent = 3L,
         settings = list(title = "Recordatorio · Pregrado", subject_line = "Asunto"),
         recipients = list(list_id = "L1", segment_opts = list(conditions = list(
           list(condition_type = "StaticSegment", op = "static_is", value = 11L),
           list(condition_type = "StaticSegment", op = "static_not", value = 12L)))))
  )),
  "/lists/L1/segments" = list(total_items = 2L, segments = list(list(id = 11L, name = "Estudiantes de pregrado"), list(id = 12L, name = "Respondió"))),
  "/reports/c1" = list(emails_sent = 5L, bounces = list(hard_bounces = 1L, soft_bounces = 0L), unsubscribed = 1L, abuse_reports = 0L,
                       opens = list(opens_total = 6L, unique_opens = 3L, proxy_excluded_unique_opens = 2L), clicks = list(clicks_total = 2L, unique_subscriber_clicks = 2L)),
  "/reports/c2" = list(emails_sent = 3L, bounces = list(hard_bounces = 0L, soft_bounces = 0L), unsubscribed = 0L, abuse_reports = 1L,
                       opens = list(opens_total = 1L, unique_opens = 1L, proxy_excluded_unique_opens = 1L), clicks = list(clicks_total = 1L, unique_subscriber_clicks = 1L)),
  "/reports/c1/sent-to" = list(total_items = 5L, sent_to = list(
    .mcmt_destinatario("e1", "tk0001", opens = 2L), .mcmt_destinatario("e2", "tk0002", opens = 1L),
    .mcmt_destinatario("e3", "tk0003", status = "hard"), .mcmt_destinatario("e4", "tk0004"), .mcmt_destinatario("e5", "ajeno99"))),
  "/reports/c1/email-activity" = list(total_items = 2L, emails = list(
    list(email_id = "e1", activity = list(list(action = "open", timestamp = "2026-10-27T14:00:00+00:00"),
                                          list(action = "click", timestamp = "2026-10-27T14:01:00+00:00", url = "*|HTML:ENLACE|*"))),
    list(email_id = "e2", activity = list(list(action = "click", timestamp = "2026-10-27T15:00:00+00:00", url = "https://vicerrectorado.academico.pucp.edu.pe/"))))),
  "/reports/c1/unsubscribed" = list(total_items = 1L, unsubscribes = list(
    list(timestamp = "2026-10-27T16:00:00+00:00", reason = "No me interesa", merge_fields = list(ENLACE = "https://x?t=tk0004")))),
  "/reports/c2/sent-to" = list(total_items = 3L, sent_to = list(
    .mcmt_destinatario("e2", "tk0002", opens = 1L), .mcmt_destinatario("e4", "tk0004"), .mcmt_destinatario("e5", "ajeno99"))),
  "/reports/c2/email-activity" = list(total_items = 1L, emails = list(
    list(email_id = "e2", activity = list(list(action = "click", timestamp = "2026-10-30T14:00:00+00:00", url = "*|HTML:ENLACE|*"))))),
  "/reports/c2/abuse-reports" = list(total_items = 1L, abuse_reports = list(
    list(date = "2026-10-30T18:00:00+00:00", merge_fields = list(ENLACE = "https://x?t=tk0004")))),
  "/lists/L1/members" = list(total_items = 1L, members = list(
    list(last_changed = "2026-10-29T00:00:00+00:00", merge_fields = list(ENLACE = "https://x?t=tk0005"))))
)

.mcmt_http <- function(llamadas) {
  function(method, url, key, body = NULL) {
    expect_identical(method, "GET")
    path <- sub("^https://[^/]+/3\\.0", "", sub("\\?.*$", "", url))
    llamadas$paths <- c(llamadas$paths, path)
    body <- .mcmt_respuestas[[path]]
    if (is.null(body)) stop("ruta no simulada: ", path)
    list(status = 200L, body = body, headers = list())
  }
}

# Universo de Monitoreo: cinco estudiantes de pregrado; tk0001 y tk0002 efectivas.
.mcmt_rollup <- function() {
  persona <- function(tk, efectiva = FALSE, at = "") {
    list(actor = "Estudiantes de pregrado", case_key = paste0("codigo:", toupper(tk)),
         counts_in_advance = efectiva, response_datetime = at, date = substr(at, 1, 10))
  }
  list(persona("tk0001", TRUE, "2026-10-27T14:05:00Z"), persona("tk0002", TRUE, "2026-10-31T09:00:00Z"),
       persona("tk0003"), persona("tk0004"), persona("tk0005"))
}

test_that("el token sale del enlace personal y sólo cuenta el clic en la encuesta", {
  expect_identical(.mcm_token("https://es.surveymonkey.com/r/GWB65HY?t=7ewf3g1ram"), "7ewf3g1ram")
  expect_identical(.mcm_token("https://x/r?a=1&t=AB-12_cd&b=2"), "AB-12_cd")
  expect_identical(.mcm_token("sin enlace"), "")
  # Campaña con la variable `id`: vale el token con la forma de los de la app,
  # no otro parámetro del enlace del recopilador.
  expect_identical(.mcm_token("https://es.surveymonkey.com/r/GWB65HY?id=7ewf3g1ram"), "7ewf3g1ram")
  expect_identical(.mcm_token("https://es.surveymonkey.com/r/GWB65HY?lang=es&id=7ewf3g1ram"), "7ewf3g1ram")
  expect_identical(.mcm_token("https://es.surveymonkey.com/r/GWB65HY?lang=es"), "")
  # El recopilador trae una `t` ajena y la campaña usa `id`: manda el token.
  expect_identical(.mcm_token("https://es.surveymonkey.com/r/ABC?t=1&id=Ab3dE5gH9k"), "Ab3dE5gH9k")
  expect_identical(.mcm_token_de_campos(list(FNAME = "Ana", ENLACE = "https://x?t=abc123")), "abc123")
  expect_true(.mcm_clic_en_encuesta("*|HTML:ENLACE|*"))
  expect_true(.mcm_clic_en_encuesta("https://es.surveymonkey.com/r/ABC?t=x1"))
  expect_false(.mcm_clic_en_encuesta("https://vicerrectorado.academico.pucp.edu.pe/"))
})

test_that("la lectura usa sólo GET, guarda tokens y no correos, y reutiliza los envíos que no cambiaron", {
  llamadas <- new.env(); llamadas$paths <- character(0)
  local_mocked_bindings(.mc_http = .mcmt_http(llamadas), .mc_sleep = function(...) invisible(NULL))
  snap <- .mcm_leer(.mcmt_key, "L1")

  expect_identical(names(snap$envios), c("c1", "c2"))
  expect_identical(snap$envios$c1$tipo, "invitacion")
  expect_identical(snap$envios$c2$tipo, "recordatorio")
  expect_identical(snap$envios$c2$excluye, "Respondió")
  expect_identical(snap$envios$c1$etiqueta, "Estudiantes de pregrado")
  c1 <- snap$personas[snap$personas$campaign_id == "c1", ]
  expect_identical(c1$token, c("tk0001", "tk0002", "tk0003", "tk0004", "ajeno99"))
  expect_identical(c1$entrega[[3]], "hard")
  # Clic en la encuesta sí; clic en otro enlace del correo, no.
  expect_identical(c1$clic, c(TRUE, FALSE, FALSE, FALSE, FALSE))
  expect_identical(snap$bajas$token, "tk0004")
  expect_identical(snap$quejas$token, "tk0004")
  expect_identical(snap$limpiados$token, "tk0005")
  # Ningún correo ni email_id en lo que se guarda.
  guardado <- paste(capture.output(str(snap)), collapse = "\n")
  expect_false(grepl("@|\\be[1-5]\\b", guardado))

  # Segunda lectura con los mismos reportes: no vuelve a bajar destinatarios.
  llamadas$paths <- character(0)
  snap2 <- .mcm_leer(.mcmt_key, "L1", previo = snap)
  expect_false(any(grepl("sent-to|email-activity", llamadas$paths)))
  expect_equal(snap2$personas, snap$personas)
})

test_that("el modelo cuenta por público, saca a los inválidos del denominador y atribuye respuestas al envío", {
  llamadas <- new.env(); llamadas$paths <- character(0)
  local_mocked_bindings(.mc_http = .mcmt_http(llamadas), .mc_sleep = function(...) invisible(NULL))
  m <- monitoreo_mailchimp_modelo(.mcm_leer(.mcmt_key, "L1"), .mcmt_rollup())

  expect_length(m$publicos, 1L)
  p <- m$publicos[[1]]
  expect_identical(p$actor, "Estudiantes de pregrado")
  expect_identical(p$universo, 5L)
  # tk0003 rebotó (duro) y tk0005 está `cleaned`: dos inválidos.
  expect_identical(p$invalidos, 2L)
  expect_identical(p$alcanzable, 3L)
  expect_identical(p$efectivas, 2L)
  expect_equal(p$tasa_alcanzable, 2 / 3)
  expect_equal(p$tasa_universo, 2 / 5)
  expect_identical(m$invalidos$total, 2L)
  expect_setequal(vapply(m$invalidos$filas, function(f) f$motivo, ""), c("rebote_duro", "limpiado"))

  c1 <- m$envios[[1]]; c2 <- m$envios[[2]]
  expect_identical(c(c1$orden, c2$orden), c(1L, 2L))
  expect_identical(c1$enviados, 5L)
  expect_identical(c1$entregados, 4L)
  # tk0001 hizo clic en la invitación; tk0002, en el recordatorio.
  expect_identical(c(c1$respuestas, c2$respuestas), c(1L, 1L))
  expect_identical(c1$bajas, 1L)
  expect_identical(c2$quejas, 1L)
  expect_identical(c1$aperturas_sin_proxy, 2L)
  # El destinatario ajeno se avisa, no se cuenta en ningún público.
  expect_true(any(grepl("no está en el universo", unlist(m$avisos))))
  # Último envío: 1 queja sobre 3 entregados pasa el tope → detener.
  expect_identical(p$ritmo, "detener")
})

test_that("el ritmo sigue, se espacia o se detiene según el último envío", {
  base <- list(entregados = 1000L, bajas = 0L, quejas = 0L, respuestas = 50L, tasa_baja = 0, tasa_queja = 0)
  expect_identical(.mcm_ritmo(NULL)$ritmo, "sin_envios")
  expect_identical(.mcm_ritmo(base)$ritmo, "seguir")
  expect_identical(.mcm_ritmo(modifyList(base, list(bajas = 6L, tasa_baja = 0.006)))$ritmo, "espaciar")
  expect_identical(.mcm_ritmo(modifyList(base, list(quejas = 1L, tasa_queja = 0.001)))$ritmo, "espaciar")
  expect_identical(.mcm_ritmo(modifyList(base, list(bajas = 3L, tasa_baja = 0.003, respuestas = 2L)))$ritmo, "espaciar")
  expect_identical(.mcm_ritmo(modifyList(base, list(quejas = 3L, tasa_queja = 0.003)))$ritmo, "detener")
})

test_that("las rutas guardan la audiencia, fusionan la lectura y responden sin correos", {
  sid <- session_create()
  local_mocked_bindings(
    .connections_token_state = function(provider, sid = NULL, ...) list(token = .mcmt_key, status = list()),
    .mcm_case_rollup = function(sid) .mcmt_rollup()
  )
  expect_error(monitoreo_mailchimp_config(sid, "no válida!"), "audiencia")
  estado <- monitoreo_mailchimp_config(sid, "L1")
  expect_true(estado$conectado)
  expect_identical(estado$list_id, "L1")
  expect_identical(estado$publicos[[1]]$ritmo, "sin_envios")

  llamadas <- new.env(); llamadas$paths <- character(0)
  local_mocked_bindings(.mc_http = .mcmt_http(llamadas), .mc_sleep = function(...) invisible(NULL))
  res <- .mcm_leer(.mcmt_key, "L1")
  .mcm_sync_hook(sid, "L1")(list(result_data = c(list(ok = TRUE), res[setdiff(names(res), "ok")])))
  estado <- monitoreo_mailchimp_estado(sid)
  expect_length(estado$envios, 2L)
  expect_false(grepl("@", jsonlite::toJSON(estado, auto_unbox = TRUE)))

  # Cambiar de audiencia descarta lo leído de la anterior.
  estado <- monitoreo_mailchimp_config(sid, "L2")
  expect_length(estado$envios, 0L)
})

# Bordes que encontró el verificador (2026-10-22).
.mcmt_snap <- function(personas = NULL, envios = NULL, bajas = NULL) {
  list(
    envios = envios %||% list(c1 = list(enviado_at = "2026-10-27T13:00:00+00:00", titulo = "c1", aperturas_sin_proxy = 0L)),
    personas = personas %||% .mcm_personas_vacias(),
    bajas = bajas, quejas = NULL, limpiados = NULL
  )
}
.mcmt_persona <- function(id, token, entrega = "sent", clic = FALSE) {
  data.frame(campaign_id = id, token = token, entrega = entrega, abrio = FALSE, clic = clic, clic_at = "", stringsAsFactors = FALSE)
}

test_that("un envío sin destinatarios leídos no tumba el estado: manda el reporte agregado", {
  snap <- .mcmt_snap(envios = list(
    c1 = list(enviado_at = "2026-10-27T13:00:00+00:00", titulo = "Recién enviado", enviados = 40L,
              rebotes_duros = 1L, rebotes_blandos = 0L, bajas = 0L, quejas = 0L, clics_unicos = 3L, aperturas_sin_proxy = 10L)))
  m <- monitoreo_mailchimp_modelo(snap, .mcmt_rollup())
  expect_length(m$envios, 1L)
  expect_identical(m$envios[[1]]$enviados, 40L)
  expect_identical(m$envios[[1]]$entregados, 39L)
  expect_identical(m$envios[[1]]$orden, 1L)
})

test_that("un destinatario sin token no hereda el público de una fila del universo sin token", {
  rollup <- c(.mcmt_rollup(), list(list(actor = "Egresados", case_key = "base-row:9", counts_in_advance = FALSE)))
  snap <- .mcmt_snap(
    personas = rbind(.mcmt_persona("c1", c("", "", "")), .mcmt_persona("c1", "tk0001")),
    bajas = data.frame(campaign_id = "c1", token = "", fecha = "", motivo = "", stringsAsFactors = FALSE)
  )
  m <- monitoreo_mailchimp_modelo(snap, rollup)
  egresados <- Filter(function(p) identical(p$actor, "Egresados"), m$publicos)[[1]]
  expect_identical(egresados$envios, 0L)
  expect_identical(egresados$bajas, 0L)
  expect_identical(egresados$ritmo, "sin_envios")
  expect_identical(m$envios[[1]]$actor, "Fuera del universo")
  expect_true(any(grepl("sin enlace personal", unlist(m$avisos))))
})

test_that("un correo inválido que igual respondió no se descuenta: la tasa no pasa de 100 %", {
  # tk0001 es efectiva y su correo rebotó (duro) en el envío.
  snap <- .mcmt_snap(personas = .mcmt_persona("c1", c("tk0001", "tk0003"), entrega = c("hard", "hard")))
  m <- monitoreo_mailchimp_modelo(snap, .mcmt_rollup())
  p <- m$publicos[[1]]
  expect_identical(p$invalidos, 2L)
  expect_identical(p$alcanzable, 4L)
  expect_lte(p$tasa_alcanzable, 1)
})

test_that("una respuesta con sólo fecha se atribuye al envío de ese mismo día", {
  rollup <- list(list(actor = "Pregrado", case_key = "codigo:TK0001", counts_in_advance = TRUE, response_datetime = "", date = "2026-10-27"))
  snap <- .mcmt_snap(personas = .mcmt_persona("c1", "tk0001"))
  m <- monitoreo_mailchimp_modelo(snap, rollup)
  expect_identical(m$envios[[1]]$respuestas, 1L)
})

test_that("al terminar la lectura, el job publica un resumen y no pisa otra audiencia", {
  sid <- session_create()
  session_set(sid, "monitoreo_mailchimp", .mcm_snapshot_vacio("L1"))
  res <- c(list(ok = TRUE), .mcmt_snap(personas = .mcmt_persona("c1", "tk0001")), list(schema = "monitoreo_mailchimp_v1", list_id = "L1", leido_at = "x"))
  publico <- .mcm_sync_hook(sid, "L1")(list(result_data = res))
  expect_identical(publico, list(ok = TRUE, envios = 1L, leido_at = "x"))
  expect_identical(nrow(session_get(sid)$monitoreo_mailchimp$personas), 1L)
  # Mientras leía, se cambió de audiencia: la lectura vieja no se guarda.
  session_set(sid, "monitoreo_mailchimp", .mcm_snapshot_vacio("L2"))
  publico <- .mcm_sync_hook(sid, "L1")(list(result_data = res))
  expect_false(publico$ok)
  expect_null(publico$personas)
  expect_identical(session_get(sid)$monitoreo_mailchimp$list_id, "L2")
  expect_identical(nrow(session_get(sid)$monitoreo_mailchimp$personas), 0L)
})

# Páginas en paralelo (.mcm_paginas): la primera dice el total, el resto llega por
# lotes y se junta en el orden de su offset; una página que no vuelve con 200 se
# repite por el camino de siempre (`.mc_call`).
test_that("las páginas se piden por lotes, se juntan en orden y una fallida se repite", {
  pagina <- 1000L
  total <- 4500L
  item <- function(offset) lapply(seq_len(min(pagina, total - offset)), function(k) list(email_id = sprintf("e%05d", offset + k)))
  llamadas_simples <- new.env(); llamadas_simples$offsets <- integer(0)
  lotes <- new.env(); lotes$tamanos <- integer(0)
  local_mocked_bindings(
    .mc_call = function(method, path, key, body = NULL, query = list()) {
      expect_identical(method, "GET")
      llamadas_simples$offsets <- c(llamadas_simples$offsets, as.integer(query$offset))
      list(total_items = total, sent_to = item(as.integer(query$offset)))
    },
    .mcm_http_varias = function(urls, key) {
      lotes$tamanos <- c(lotes$tamanos, length(urls))
      lapply(urls, function(url) {
        offset <- as.integer(sub(".*offset=([0-9]+).*", "\\1", url))
        if (offset == 3000L) return(list(status = 429L, body = list()))
        list(status = 200L, body = list(total_items = total, sent_to = item(offset)))
      })
    }
  )
  avances <- integer(0)
  out <- .mcm_paginas(.mcmt_key, "/reports/c1/sent-to", "sent_to", avance = function(hecho, total) avances <<- c(avances, hecho))
  ids <- vapply(out, function(x) x$email_id, character(1))
  expect_identical(ids, sprintf("e%05d", seq_len(total)))
  # Primera página sola; las otras 4 en un lote de 4; la de offset 3000 volvió con 429 y se repitió.
  expect_identical(lotes$tamanos, 4L)
  expect_identical(llamadas_simples$offsets, c(0L, 3000L))
  expect_identical(avances, c(1000L, 4500L))
})

test_that("con una sola página no hay lote en paralelo", {
  local_mocked_bindings(
    .mc_call = function(method, path, key, body = NULL, query = list()) list(total_items = 2L, sent_to = list(list(email_id = "a"), list(email_id = "b"))),
    .mcm_http_varias = function(urls, key) stop("no debía pedirse en paralelo")
  )
  expect_length(.mcm_paginas(.mcmt_key, "/reports/c1/sent-to", "sent_to"), 2L)
})

test_that("una página corta en el lote hace releer el recurso en serie, sin huecos", {
  total <- 2500L
  item <- function(offset, n = 1000L) lapply(seq_len(min(n, total - offset)), function(k) list(email_id = sprintf("e%05d", offset + k)))
  local_mocked_bindings(
    .mc_call = function(method, path, key, body = NULL, query = list()) {
      list(total_items = total, sent_to = item(as.integer(query$offset)))
    },
    .mcm_http_varias = function(urls, key) {
      lapply(urls, function(url) {
        offset <- as.integer(sub(".*offset=([0-9]+).*", "\\1", url))
        # La página de offset 1000 llega corta.
        list(status = 200L, body = list(total_items = total, sent_to = item(offset, if (offset == 1000L) 900L else 1000L)))
      })
    }
  )
  ids <- vapply(.mcm_paginas(.mcmt_key, "/reports/c1/sent-to", "sent_to"), function(x) x$email_id, character(1))
  expect_identical(ids, sprintf("e%05d", seq_len(total)))
})

test_that("las peticiones simultáneas dejan cada respuesta en su lugar y un fallo como NULL", {
  dir <- withr::local_tempdir()
  ok <- file.path(dir, "ok.json"); writeLines('{"total_items": 1, "x": "ñandú"}', ok, useBytes = TRUE)
  malo <- file.path(dir, "malo.json"); writeLines("{no es json", malo)
  urls <- c(paste0("file://", ok), paste0("file://", malo), paste0("file://", file.path(dir, "no-existe.json")), paste0("file://", ok))
  res <- .mcm_http_varias(urls, .mcmt_key)
  expect_length(res, 4L)
  expect_identical(res[[1]]$body$x, "ñandú")
  expect_null(res[[2]])
  expect_null(res[[3]])
  expect_identical(res[[4]]$body$total_items, 1L)
})

test_that("si la entrega no cambió, sólo se pide la actividad nueva y se suma a los destinatarios guardados", {
  llamadas <- new.env(); llamadas$paths <- character(0); llamadas$urls <- character(0)
  local_mocked_bindings(.mc_http = .mcmt_http(llamadas), .mc_sleep = function(...) invisible(NULL))
  snap <- .mcm_leer(.mcmt_key, "L1")
  snap$leido_at <- "2026-10-30T12:25:38-0500"

  # Más aperturas y clics en c1, la misma entrega: tk0004 hizo clic en la encuesta.
  respuestas <- .mcmt_respuestas
  respuestas[["/reports/c1"]]$opens$opens_total <- 9L
  respuestas[["/reports/c1"]]$clicks$clicks_total <- 3L
  respuestas[["/reports/c1/email-activity"]] <- list(total_items = 1L, emails = list(
    list(email_id = "e4", activity = list(list(action = "open", timestamp = "2026-10-30T17:40:00+00:00"),
                                          list(action = "click", timestamp = "2026-10-30T17:41:00+00:00", url = "*|HTML:ENLACE|*")))))
  respuestas[["/lists/L1/members/e4"]] <- list(merge_fields = list(ENLACE = "https://es.surveymonkey.com/r/ABC?t=tk0004"))
  llamadas$paths <- character(0)
  local_mocked_bindings(.mc_http = function(method, url, key, body = NULL) {
    path <- sub("^https://[^/]+/3\\.0", "", sub("\\?.*$", "", url))
    llamadas$paths <- c(llamadas$paths, path); llamadas$urls <- c(llamadas$urls, url)
    cuerpo <- respuestas[[path]]
    if (is.null(cuerpo)) stop("ruta no simulada: ", path)
    list(status = 200L, body = cuerpo, headers = list())
  })
  snap2 <- .mcm_leer(.mcmt_key, "L1", previo = snap)

  expect_false(any(grepl("/sent-to", llamadas$paths)))
  expect_true(any(grepl("email-activity.*since=2026-10-30T17%3A10%3A38", llamadas$urls)))
  c1 <- snap2$personas[snap2$personas$campaign_id == "c1", ]
  expect_identical(c1$clic, c(TRUE, FALSE, FALSE, TRUE, FALSE))
  expect_identical(c1$abrio[[4]], TRUE)
  expect_identical(c1$clic_at[[4]], "2026-10-30T17:41:00+00:00")
  expect_identical(snap2$envios$c1$aperturas_unicas, snap$envios$c1$aperturas_unicas)
})
