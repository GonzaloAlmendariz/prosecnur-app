# Mailchimp por API (checklist-mailchimp-api-2026-10-22, ítems 1.1, 1.2, 1.3 y
# 2.1): reintentos, jobs con avance, carga de la audiencia y borrador de la
# campaña. Sin red: Mailchimp (.mc_http), las pausas (.mc_sleep), las claves y
# SurveyMonkey se reemplazan. Fixtures sintéticos (helper-collection-mail.R).

.mca_key <- paste0(strrep("b", 32), "-us21")
.mca_tokens <- function(provider, sid = NULL, ...) if (identical(provider, "mailchimp")) .mca_key else "sm-token"
.mca_ok <- function(body = list()) list(status = 200L, body = body, headers = list())
.mca_code <- function(expr) {
  e <- tryCatch({ force(expr); NULL }, api_error = function(e) e)
  if (is.null(e)) NA_character_ else e$code
}
.mca_no_emails <- function(x) expect_false(any(grepl("@", unlist(x), fixed = TRUE)))

# Lista con tokens `?t=` en el enlace, con las columnas del helper.
.mc_fx_csv_tokens <- function() {
  paste("N°,Código,Apellidos y nombres,Correo institucional,Carrera,Enlace",
        "1,20260001,\"QUISPE MAMANI, ANA LUCIA\",ana.quispe@ejemplo.org,Sociología,https://ejemplo.org/r/A?t=tokana01",
        "2,20260002,\"ROJAS VEGA, CARLOS\",carlos.rojas@ejemplo.org,Economía,https://ejemplo.org/r/A?t=tokcar02",
        sep = "\n")
}

# Sesión con logos locales, plantilla completa y la lista del helper (3 efectivos).
.mca_session <- function(csv = .cmail_fx_recipients_csv()) {
  sid <- .cmail_fx_session()
  .cmail_fx_import(sid, csv = csv)
  invisible(utils::capture.output(.cmail_fx_completar(sid)))
  sid
}

# Agrega un recordatorio a la campaña única.
.mca_add_reminder <- function(sid) {
  g <- collection_mail_template_get(sid)
  collection_mail_template_put(sid, g$template, g$state_revision, campaign_id = g$campaign_id,
                               sends = list(list(send_id = "invitacion"), list(label = "Recordatorio 1")))
}

# Mailchimp falso: registra las llamadas y responde según la ruta.
.mca_server <- function(segments = list(list(id = 41L, name = "Recuperación de estudiantes")),
                        merge_fields = list(list(tag = "FNAME", name = "First Name"))) {
  env <- new.env()
  env$calls <- list()
  env$segments <- segments
  env$http <- function(method, url, key, body = NULL) {
    env$calls[[length(env$calls) + 1L]] <- list(method = method, url = url, body = body)
    path <- sub("^https://us21\\.api\\.mailchimp\\.com/3\\.0", "", sub("\\?.*$", "", url))
    if (method == "GET" && grepl("/segments$", path)) return(.mca_ok(list(segments = env$segments)))
    if (method == "POST" && grepl("/segments$", path)) {
      id <- 900L + length(env$segments)
      env$segments[[length(env$segments) + 1L]] <- list(id = id, name = body$name)
      return(.mca_ok(list(id = id)))
    }
    if (method == "POST" && grepl("/segments/[0-9]+$", path)) return(.mca_ok(list(total_added = length(body$members_to_add), errors = list())))
    if (method == "GET" && grepl("/merge-fields$", path)) return(.mca_ok(list(merge_fields = merge_fields)))
    if (method == "POST" && grepl("/merge-fields$", path)) return(.mca_ok(list(tag = body$tag)))
    if (method == "POST" && grepl("^/lists/[^/]+$", path)) {
      return(.mca_ok(list(new_members = lapply(body$members, function(m) list(email_address = m$email_address)),
                          updated_members = list(), errors = list(), total_created = length(body$members),
                          total_updated = 0L, error_count = 0L)))
    }
    if (method == "POST" && path == "/file-manager/files") {
      return(.mca_ok(list(full_size_url = sprintf("https://mcusercontent.com/abc/images/%s", body$name))))
    }
    if (method == "POST" && path == "/campaigns") return(.mca_ok(list(id = "c0ffee", web_id = 123456L)))
    if (method == "PUT" && grepl("^/campaigns/[^/]+/content$", path)) return(.mca_ok(list()))
    if (method == "GET" && grepl("^/campaigns/[^/]+$", path)) return(.mca_ok(list(recipients = list(recipient_count = 3L))))
    stop("llamada inesperada: ", method, " ", url)
  }
  env$of <- function(method, pattern) Filter(function(x) identical(x$method, method) && grepl(pattern, x$url), env$calls)
  env
}

# ---- 1.1 reintentos ---------------------------------------------------------

test_that("429 con retry-after: espera lo que dice Mailchimp y reintenta", {
  n <- 0L; waits <- numeric()
  local_mocked_bindings(
    .mc_sleep = function(seconds) waits <<- c(waits, seconds),
    .mc_http = function(...) {
      n <<- n + 1L
      if (n == 1L) list(status = 429L, body = list(title = "Too Many Requests"), headers = list(`retry-after` = "7"))
      else .mca_ok(list(health_status = "ok"))
    }
  )
  expect_identical(mailchimp_api_ping(.mca_key)$ok, TRUE)
  expect_identical(n, 2L)
  expect_identical(waits, 7)
})

test_that("503 y error de curl: 1 s, 2 s, 4 s y a los 4 intentos se rinde", {
  n <- 0L; waits <- numeric()
  local_mocked_bindings(
    .mc_sleep = function(seconds) waits <<- c(waits, seconds),
    .mc_http = function(...) { n <<- n + 1L; if (n < 3L) list(status = 503L, body = list(), headers = list()) else .mca_ok() }
  )
  mailchimp_api_ping(.mca_key)
  expect_identical(n, 3L)
  expect_identical(waits, c(1, 2))

  n <- 0L; waits <- numeric()
  local_mocked_bindings(
    .mc_sleep = function(seconds) waits <<- c(waits, seconds),
    .mc_http = function(...) { n <<- n + 1L; if (n < 3L) stop("Could not resolve host: us21.api.mailchimp.com") else .mca_ok() }
  )
  mailchimp_api_ping(.mca_key)
  expect_identical(n, 3L)
  expect_identical(waits, c(1, 2))

  n <- 0L; waits <- numeric()
  local_mocked_bindings(
    .mc_sleep = function(seconds) waits <<- c(waits, seconds),
    .mc_http = function(...) { n <<- n + 1L; list(status = 502L, body = list(detail = "Bad gateway"), headers = list()) }
  )
  expect_identical(.mca_code(mailchimp_api_ping(.mca_key)), "E_MAILCHIMP_API")
  expect_identical(n, 4L)
  expect_identical(waits, c(1, 2, 4))

  n <- 0L; waits <- numeric()
  local_mocked_bindings(
    .mc_sleep = function(seconds) waits <<- c(waits, seconds),
    .mc_http = function(...) { n <<- n + 1L; stop("Timeout was reached") }
  )
  e <- tryCatch(mailchimp_api_ping(.mca_key), api_error = function(e) e)
  expect_identical(e$code, "E_MAILCHIMP_API")
  expect_match(conditionMessage(e), "No se pudo conectar")
  expect_identical(n, 4L)
})

test_that("400, 401, 404 y 422 no se reintentan; el detalle no lleva correos", {
  for (st in c(400L, 401L, 403L, 404L, 422L)) {
    n <- 0L
    local_mocked_bindings(
      .mc_sleep = function(seconds) stop("no debía esperar"),
      .mc_http = function(...) { n <<- n + 1L; list(status = st, body = list(detail = "ana@ejemplo.org looks fake"), headers = list()) }
    )
    e <- tryCatch(mailchimp_api_ping(.mca_key), api_error = function(e) e)
    expect_identical(n, 1L)
    expect_identical(e$code, if (st %in% c(401L, 403L)) "E_MAILCHIMP_TOKEN" else "E_MAILCHIMP_API")
    expect_false(grepl("@", conditionMessage(e), fixed = TRUE))
  }
})

# ---- 1.3 audiencia ----------------------------------------------------------

test_that("audiencia: crea los merge fields que faltan y sube lo mismo que audiencia.csv", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  srv <- .mca_server()
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = srv$http, .mc_sleep = function(...) NULL)
  input <- .mc_audience_prepare(sid, list_id = "lst1")
  out <- .mc_audience_run(input)

  expect_true(out$ok)
  expect_identical(out$tag, "Recuperación de estudiantes")  # sin actor, el nombre de la campaña
  expect_identical(out$recipients, 3L)
  expect_identical(out$created, 3L)
  expect_identical(out$failed, 0L)
  expect_identical(out$tagged, 3L)
  # FNAME ya existía: se crean las demás, como texto, con su nombre legible.
  expect_identical(unlist(out$merge_fields_created), c("CARRERA", "ENLACE"))
  mf <- srv$of("POST", "/merge-fields$")
  expect_identical(vapply(mf, function(x) x$body$type, ""), c("text", "text"))
  expect_identical(vapply(mf, function(x) x$body$name, ""), c("Carrera", "Enlace a la encuesta"))
  .mca_no_emails(out)

  # Paridad con el CSV del ZIP: mismas personas, mismos valores, mismo orden.
  s <- session_get(sid)
  camp <- .cmail_campaign_for(s, .collection_current(s), NULL)$campaign
  tpl <- .cmail_campaign_template_checked(camp)
  r <- .cmail_review_checks(s, tpl, camp, "completo", NULL)
  csv <- tempfile(fileext = ".csv"); on.exit(unlink(csv), add = TRUE)
  .cmail_write_audience(csv, r$store, r$resolved, r$tag_rows, .cmail_trato_resolve(r$store, tpl, r$resolved))
  aud <- utils::read.csv(csv, check.names = FALSE, colClasses = "character", encoding = "UTF-8")
  members <- srv$of("POST", "/lists/lst1$")[[1]]$body$members
  expect_identical(vapply(members, `[[`, "", "email_address"), aud[["Email Address"]])
  expect_identical(vapply(members, function(m) m$merge_fields$FNAME, ""), aud[["First Name"]])
  expect_identical(vapply(members, function(m) m$merge_fields$CARRERA, ""), aud[["CARRERA"]])
  expect_identical(vapply(members, function(m) m$merge_fields$ENLACE, ""), aud[["ENLACE"]])
  expect_true(all(vapply(members, function(m) identical(m$status_if_new, "subscribed"), NA)))
  expect_true(isTRUE(srv$of("POST", "/lists/lst1$")[[1]]$body$update_existing))
  # La etiqueta del público se aplica a todos.
  tag_post <- srv$of("POST", "/segments/41$")
  expect_setequal(unlist(tag_post[[1]]$body$members_to_add), aud[["Email Address"]])
})

test_that("audiencia: lotes de 500 y errores contados por código, sin correos", {
  n <- 1203L
  csv <- paste(c("Apellidos y nombres,Correo institucional,Carrera,Enlace",
                 sprintf("\"P, N%d\",p%d@ejemplo.org,Sociología,https://x.org/r/A?t=tok%05d", seq_len(n), seq_len(n), seq_len(n))),
               collapse = "\n")
  sid <- .mca_session(csv); on.exit(session_delete(sid), add = TRUE)
  srv <- .mca_server(merge_fields = list(list(tag = "FNAME"), list(tag = "CARRERA"), list(tag = "ENLACE")))
  lotes <- integer()
  http <- function(method, url, key, body = NULL) {
    if (method == "POST" && grepl("/lists/lst1$", url)) {
      k <- length(body$members); lotes[[length(lotes) + 1L]] <<- k
      errs <- list(list(email_address = body$members[[1]]$email_address, error = "x", error_code = "ERROR_CONTACT_EXISTS"),
                   list(email_address = body$members[[2]]$email_address, error = "y", error_code = "ERROR_GENERIC"))
      if (k < 500L) errs <- errs[1]
      return(.mca_ok(list(new_members = list(), updated_members = list(), errors = errs,
                          total_created = k - length(errs) - 10L, total_updated = 10L, error_count = length(errs))))
    }
    srv$http(method, url, key, body)
  }
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = http, .mc_sleep = function(...) NULL)
  out <- .mc_audience_run(.mc_audience_prepare(sid, list_id = "lst1", tag = "Estudiantes 2026"))
  expect_identical(lotes, c(500L, 500L, 203L))
  expect_identical(out$recipients, n)
  expect_identical(out$failed, 5L)
  expect_identical(out$failed_by_reason, list(ERROR_CONTACT_EXISTS = 3L, ERROR_GENERIC = 2L))
  expect_identical(out$updated, 30L)
  expect_identical(out$created, n - 5L - 30L)
  expect_identical(out$merge_fields_created, list())
  expect_identical(out$tag, "Estudiantes 2026")
  .mca_no_emails(out)
  # Sin errores, failed_by_reason es un objeto vacío en JSON, no una lista.
  expect_identical(as.character(jsonlite::toJSON(.mc_members_upload(.mca_key, "l", character(0), list())$by_reason,
                                                 auto_unbox = TRUE)), "{}")
})

test_that("audiencia: sin destinatarios, de SurveyMonkey o con etiquetas sin columna no se carga", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = function(...) stop("sin red"))
  expect_identical(.mca_code(.mc_audience_prepare(sid, list_id = "l")), "E_COLLECTION_MAIL_SYNC_NO_RECIPIENTS")
  expect_identical(.mca_code(.mc_audience_prepare(sid, list_id = "")), "E_COLLECTION_MAIL_SYNC_INPUT")
  .cmail_fx_import(sid)
  collection_mail_recipients_mapping_put(sid, list(email_column = "Correo institucional", name_column = "Apellidos y nombres",
                                                   fields = list(carrera = "Carrera")))
  e <- tryCatch(.mc_audience_prepare(sid, list_id = "l"), api_error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_REVIEW_BLOCKING")
  expect_true("tags_have_columns" %in% vapply(e$details$checks, `[[`, "", "code"))

  sid2 <- session_create(); on.exit(session_delete(sid2), add = TRUE)
  collection_mail_campaign_create(sid2, 0L, name = "Por SM", platform = "surveymonkey")
  expect_identical(.mca_code(.mc_audience_prepare(sid2, list_id = "l")), "E_COLLECTION_MAIL_SYNC_PLATFORM")
})

# ---- 2.1 borrador -----------------------------------------------------------

test_that("borrador de la invitación: imágenes alojadas, solo static_is y edit_url bien formada", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  srv <- .mca_server()
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = srv$http, .mc_sleep = function(...) NULL)
  out <- collection_mail_mailchimp_campaign_draft(sid, list_id = "lst1", from_name = "PULSO PUCP",
                                                  reply_to = "pulso@ejemplo.org")
  expect_true(out$ok)
  expect_identical(out$mailchimp_campaign_id, "c0ffee")
  expect_identical(out$web_id, "123456")
  expect_identical(out$edit_url, "https://us21.admin.mailchimp.com/campaigns/edit?id=123456")
  expect_identical(out$recipient_count, 3L)
  expect_identical(out$images_uploaded, 2L)
  expect_identical(out$title, "Recuperación de estudiantes · Invitación")
  .mca_no_emails(out)

  files <- srv$of("POST", "/file-manager/files$")
  expect_setequal(vapply(files, function(x) x$body$name, ""), c("correo-1-logo-cliente.png", "correo-1-pulso.png"))
  expect_true(all(vapply(files, function(x) nzchar(x$body$file_data), NA)))
  html <- srv$of("PUT", "/campaigns/c0ffee/content$")[[1]]$body$html
  expect_false(grepl('src="logo-cliente.png"', html, fixed = TRUE))
  expect_false(grepl('src="pulso.png"', html, fixed = TRUE))
  expect_match(html, "https://mcusercontent.com/abc/images/correo-1-logo-cliente.png", fixed = TRUE)

  camp <- srv$of("POST", "/campaigns$")[[1]]$body
  expect_identical(camp$type, "regular")
  expect_identical(camp$recipients$list_id, "lst1")
  conds <- camp$recipients$segment_opts$conditions
  expect_length(conds, 1L)
  expect_identical(conds[[1]], list(condition_type = "StaticSegment", field = "static_segment", op = "static_is", value = 41L))
  expect_identical(camp$recipients$segment_opts$match, "all")
  expect_identical(camp$settings$from_name, "PULSO PUCP")
  expect_identical(camp$settings$reply_to, "pulso@ejemplo.org")
  expect_true(nzchar(camp$settings$subject_line))
  # Ninguna llamada envía ni programa.
  expect_length(Filter(function(x) grepl("/actions/(send|schedule)", x$url), srv$calls), 0L)
})

test_that("borrador del recordatorio: static_is del público y static_not de «Respondió» (se crea si falta)", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  invisible(utils::capture.output(.mca_add_reminder(sid)))
  srv <- .mca_server()
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = srv$http, .mc_sleep = function(...) NULL)
  out <- collection_mail_mailchimp_campaign_draft(sid, send_id = "recordatorio-1", list_id = "lst1",
                                                  from_name = "PULSO", reply_to = "pulso@ejemplo.org")
  expect_identical(out$title, "Recuperación de estudiantes · Recordatorio 1")
  conds <- srv$of("POST", "/campaigns$")[[1]]$body$recipients$segment_opts$conditions
  expect_identical(vapply(conds, `[[`, "", "op"), c("static_is", "static_not"))
  created <- srv$of("POST", "/segments$")
  expect_identical(created[[1]]$body$name, "Respondió")
  expect_identical(conds[[2]]$value, 901L)

  # Con exclude_tag explícito en la invitación, también excluye.
  srv2 <- .mca_server(segments = list(list(id = 41L, name = "Recuperación de estudiantes"), list(id = 7L, name = "Baja")))
  local_mocked_bindings(.mc_http = srv2$http)
  collection_mail_mailchimp_campaign_draft(sid, list_id = "lst1", from_name = "PULSO", reply_to = "pulso@ejemplo.org",
                                           exclude_tag = "Baja")
  conds2 <- srv2$of("POST", "/campaigns$")[[1]]$body$recipients$segment_opts$conditions
  expect_identical(vapply(conds2, `[[`, 1L, "value"), c(41L, 7L))
})

test_that("borrador: revisión con errores, entrada inválida o público sin cargar bloquean antes de crear", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  srv <- .mca_server(segments = list())
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = srv$http, .mc_sleep = function(...) NULL)
  expect_identical(.mca_code(collection_mail_mailchimp_campaign_draft(sid, list_id = "", from_name = "P", reply_to = "a@b.org")),
                   "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT")
  expect_identical(.mca_code(collection_mail_mailchimp_campaign_draft(sid, list_id = "l", from_name = "P", reply_to = "sin-arroba")),
                   "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT")
  expect_identical(.mca_code(collection_mail_mailchimp_campaign_draft(sid, list_id = "l", from_name = "", reply_to = "a@b.org")),
                   "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT")
  # El público no existe en la audiencia: no se crea vacío, se pide cargarlo.
  expect_identical(.mca_code(collection_mail_mailchimp_campaign_draft(sid, list_id = "l", from_name = "P", reply_to = "a@b.org")),
                   "E_COLLECTION_MAIL_SYNC_NO_AUDIENCE_TAG")
  expect_length(srv$of("POST", "/segments$"), 0L)

  # Revisión con un error (el mismo render que el export): no se toca Mailchimp.
  local_mocked_bindings(.cmail_review_checks = function(...) list(
    checks = list(.cmail_check("subject", "error", 0L, "Falta el asunto.")), rendered = list(html = "", subject = ""), images = list()
  ))
  n0 <- length(srv$calls)
  e <- tryCatch(collection_mail_mailchimp_campaign_draft(sid, list_id = "l", from_name = "P", reply_to = "a@b.org"),
                api_error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_REVIEW_BLOCKING")
  expect_identical(e$details$checks[[1]]$code, "subject")
  expect_identical(length(srv$calls), n0)
})

# ---- 1.2 / 1.3 jobs ---------------------------------------------------------

test_that("worker de «quién respondió»: se llama directo, escribe el avance por lotes y devuelve el payload", {
  sid <- .cmail_fx_session(logos = FALSE); on.exit(session_delete(sid), add = TRUE)
  n <- 1203L
  .cmail_fx_import(sid, csv = paste(c("Apellidos y nombres,Correo,Enlace",
                                      sprintf("\"P, N%d\",p%d@ejemplo.org,https://x.org/r/A?t=tok%05d", seq_len(n), seq_len(n), seq_len(n))),
                                    collapse = "\n"))
  progress <- character()
  local_mocked_bindings(
    .connections_token_require = .mca_tokens,
    sm_api_fetch_all_responses_bulk = function(...) list(data = lapply(seq_len(n), function(i)
      list(response_status = "completed", custom_variables = list(t = sprintf("tok%05d", i))))),
    .mc_http = function(method, url, key, body = NULL) {
      if (grepl("/segments\\?", url)) return(.mca_ok(list(segments = list(list(id = 1L, name = "Respondió")))))
      .mca_ok(list(total_added = length(body$members_to_add), errors = list()))
    },
    .mc_sleep = function(...) NULL,
    job_progress_writer = function(path) function(phase = "running", current = NULL, total = NULL, percent = NULL, message = NULL) {
      progress <<- c(progress, message %||% "")
    }
  )
  input_path <- job_save_rds(sid, "mail_sync", .mc_sync_prepare(sid, survey_id = "1", list_id = "abc"))
  out <- collection_mail_mailchimp_sync_job(sid, input_path, progress_path = "p.progress")
  expect_true(out$ok)
  expect_identical(out$tagged, n)
  expect_true(all(c("recipients", "responses", "completed", "respondents", "pending", "tagged", "synced_at") %in% names(out)))
  expect_true(all(c("Mailchimp: 500 de 1,203", "Mailchimp: 1,000 de 1,203", "Mailchimp: 1,203 de 1,203") %in% progress))
  .mca_no_emails(out)
})

test_that("worker: un error de Mailchimp viaja como error de dominio y uno técnico como E_INTERNAL sin mensaje", {
  sid <- .cmail_fx_session(logos = FALSE); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_import(sid, csv = paste("Apellidos y nombres,Correo,Enlace", "\"A, B\",a@ejemplo.org,https://x.org/r/A?t=tokaaa1", sep = "\n"))
  local_mocked_bindings(
    .connections_token_require = .mca_tokens,
    sm_api_fetch_all_responses_bulk = function(...) list(data = list(list(response_status = "completed", custom_variables = list(t = "tokaaa1")))),
    .mc_http = function(...) list(status = 404L, body = list(detail = "The requested resource could not be found."), headers = list()),
    .mc_sleep = function(...) NULL
  )
  input_path <- job_save_rds(sid, "mail_sync", .mc_sync_prepare(sid, survey_id = "1", list_id = "abc"))
  out <- collection_mail_mailchimp_sync_job(sid, input_path)
  expect_false(out$ok)
  expect_identical(out$error$code, "E_MAILCHIMP_API")
  expect_identical(out$error$status, 502L)

  local_mocked_bindings(.mc_sync_run = function(...) stop("/Users/x/secreto.rds no existe"))
  out2 <- suppressMessages(collection_mail_mailchimp_sync_job(sid, input_path))
  expect_identical(out2$error$code, "E_INTERNAL")
  expect_false(grepl("secreto", out2$error$message, fixed = TRUE))
  expect_true(nzchar(out2$error$details$error_id))
})

test_that("worker de la audiencia: se llama directo y devuelve el resultado del contrato", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  srv <- .mca_server()
  local_mocked_bindings(.connections_token_require = .mca_tokens, .mc_http = srv$http, .mc_sleep = function(...) NULL)
  input_path <- job_save_rds(sid, "mail_audience", .mc_audience_prepare(sid, list_id = "lst1"))
  prog <- tempfile(fileext = ".progress"); on.exit(unlink(prog), add = TRUE)
  out <- collection_mail_mailchimp_audience_job(sid, input_path, progress_path = prog)
  expect_identical(names(out), c("ok", "campaign_id", "list_id", "tag", "recipients", "created", "updated", "failed",
                                 "failed_by_reason", "tagged", "merge_fields_created", "uploaded_at"))
  expect_identical(jsonlite::fromJSON(prog)$phase, "done")
  .mca_no_emails(out)
})

test_that("submit: valida en el acto, lanza el job con el worker por nombre y borra el insumo al terminar", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  seen <- list()
  local_mocked_bindings(
    .connections_token_require = .mca_tokens,
    job_submit = function(sid, kind, func, args = list(), on_cleanup = NULL, ...) {
      seen[[kind]] <<- list(name = attr(func, "prosecnur_job_function_name"), args = args, on_cleanup = on_cleanup)
      "job-123"
    }
  )
  a <- collection_mail_mailchimp_audience_submit(sid, list_id = "lst1")
  expect_identical(a, list(ok = TRUE, job_id = "job-123"))
  j <- seen[["recopiladores.mail_audience"]]
  expect_identical(j$name, "collection_mail_mailchimp_audience_job")
  expect_identical(sort(names(j$args)), c("input_path", "sid"))
  expect_true(file.exists(j$args$input_path))
  j$on_cleanup(list())
  expect_false(file.exists(j$args$input_path))

  # Sin tokens en la lista: el error sale en la petición, no dentro del job.
  expect_identical(.mca_code(collection_mail_mailchimp_sync_submit(sid, survey_id = "1", list_id = "l")),
                   "E_COLLECTION_MAIL_SYNC_NO_TOKENS")
  expect_null(seen[["recopiladores.mail_sync"]])
})

test_that("contrato HTTP: las tres rutas responden sin correos y la de sync es un job", {
  sid <- .mca_session(); on.exit(session_delete(sid), add = TRUE)
  invisible(utils::capture.output(.cmail_fx_import(sid, csv = .mc_fx_csv_tokens())))
  srv <- .mca_server()
  local_mocked_bindings(
    .connections_token_require = .mca_tokens, .mc_http = srv$http, .mc_sleep = function(...) NULL,
    job_submit = function(...) "job-xyz"
  )
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  s1 <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sync",
                       .cmail_fx_json(list(survey_id = "1", list_id = "lst1", tag = "Respondió", dry_run = FALSE)))
  expect_identical(s1$status, 200L)
  expect_identical(s1$body, list(ok = TRUE, job_id = "job-xyz"))
  s2 <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sync/audience", .cmail_fx_json(list(list_id = "lst1")))
  expect_identical(s2$body, list(ok = TRUE, job_id = "job-xyz"))
  s3 <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sync/campaign",
                       .cmail_fx_json(list(list_id = "lst1", from_name = "PULSO", reply_to = "pulso@ejemplo.org")))
  expect_identical(s3$status, 200L)
  expect_identical(s3$body$edit_url, "https://us21.admin.mailchimp.com/campaigns/edit?id=123456")
  expect_false(grepl("@", paste(s1$raw, s2$raw, s3$raw), fixed = TRUE))
  bad <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-sync/campaign", .cmail_fx_json(list(list_id = "lst1")))
  expect_identical(bad$status, 422L)
  expect_identical(bad$body$error$code, "E_COLLECTION_MAIL_SYNC_CAMPAIGN_INPUT")
})
