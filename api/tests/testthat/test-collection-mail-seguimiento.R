# Material de campo › Correo › Seguimiento: archivar a quien respondió, prueba
# de horarios y correo personal (docs/qa/checklist-material-campo-correos-ab-2026-11-11.md).
# Datos SINTÉTICOS; sin red: SurveyMonkey y Mailchimp se reemplazan.

KEY_SEG <- paste0(strrep("b", 32), "-us21")
.seg_tokens <- function(provider, sid = NULL, ...) if (identical(provider, "mailchimp")) KEY_SEG else "sm-token"
.seg_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

# Lista de n personas con correo de la lista y correo personal.
.seg_csv <- function(prefijo, n) {
  paste(c("Apellidos y nombres,Correo,Correo personal",
          sprintf("\"P, %s%02d\",%s%02d@uni.edu.pe,%s%02d@gmail.com", prefijo, seq_len(n), prefijo, seq_len(n), prefijo, seq_len(n))),
        collapse = "\n")
}

# Dos campañas de Mailchimp (Profesores y Administrativos), 20 personas cada
# una, con enlace personal y dos recordatorios.
.seg_session <- function(n = 20L) {
  sid <- .cmail_fx_session(logos = FALSE)
  rev <- 0L
  for (c in list(list(id = "profesores", name = "Profesores", pre = "prof"), list(id = "administrativos", name = "Administrativos", pre = "adm"))) {
    out <- collection_mail_campaign_create(sid, rev, name = c$name, actor = c$name, platform = "mailchimp")
    rev <- out$state_revision
    collection_mail_recipients_import(sid, file_name = "contactos.csv", campaign_id = c$id,
                                      content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.seg_csv(c$pre, n)))))
    collection_mail_enlace_put(sid, c$id, "https://es.surveymonkey.com/r/ABC")
    g <- collection_mail_template_get(sid, campaign_id = c$id)
    w <- collection_mail_template_put(sid, g$template, g$state_revision, campaign_id = c$id,
                                      sends = list(list(send_id = "invitacion"), list(label = "Recordatorio 1"), list(label = "Recordatorio 2")))
    rev <- w$state_revision
  }
  sid
}

.seg_store <- function(sid, id) .cmail_recipients_load(session_get(sid), id)
.seg_token <- function(sid, id, email) .seg_store(sid, id)$tokens[[email]]

# ---- estadística ----------------------------------------------------------------------

test_that("CMH a mano coincide con stats::mantelhaen.test y admite un solo estrato", {
  est <- data.frame(xA = c(55, 541, 82), nA = c(1239, 10912, 941), xB = c(58, 528, 72), nB = c(1245, 10942, 923))
  arr <- array(unlist(lapply(seq_len(nrow(est)), function(i) c(est$xA[i], est$nA[i] - est$xA[i], est$xB[i], est$nB[i] - est$xB[i]))),
               dim = c(2, 2, nrow(est)))
  ref <- stats::mantelhaen.test(arr)
  got <- .prueba_cmh(est)
  expect_equal(got$p, ref$p.value, tolerance = 1e-8)
  expect_equal(got$or, unname(ref$estimate), tolerance = 1e-8)
  expect_equal(c(got$or_li, got$or_ls), as.numeric(ref$conf.int), tolerance = 1e-6)
  uno <- .prueba_cmh(est[1, ])
  expect_false(is.na(uno$p))
  # Con públicos de 20 mil, la varianza no desborda.
  grande <- .prueba_cmh(data.frame(xA = 3000L, nA = 25000L, xB = 2900L, nB = 25000L))
  expect_false(is.na(grande$p))
})

test_that("Wilson y Newcombe dan intervalos dentro de [0, 1] y que contienen la estimación", {
  w <- .prueba_wilson(0, 50)
  expect_equal(w[1], 0); expect_gt(w[2], 0)
  d <- .prueba_newcombe(30, 1000, 20, 1000)
  expect_lt(d$li, d$dif); expect_gt(d$ls, d$dif)
  expect_identical(.prueba_veredicto(d$li, d$ls), "empate")
  expect_identical(.prueba_veredicto(0.1, 0.5), "A")
  expect_identical(.prueba_veredicto(-0.5, -0.1), "B")
})

# ---- sorteo ---------------------------------------------------------------------------------

test_that("sorteo 50/50 reproducible, independiente del orden de entrada y de los otros públicos", {
  tk <- sprintf("tok%03d", 1:101)
  g1 <- .mph_sortear(tk, 20261103L, "profesores")
  expect_equal(sum(g1 == "A"), 51L); expect_equal(sum(g1 == "B"), 50L)
  g2 <- .mph_sortear(rev(tk), 20261103L, "profesores")
  expect_identical(stats::setNames(g1, tk)[tk], stats::setNames(g2, rev(tk))[tk])
  expect_false(identical(g1, .mph_sortear(tk, 20261103L, "administrativos")))
  expect_false(identical(g1, .mph_sortear(tk, 1L, "profesores")))
  # 80/20.
  b <- .mph_sortear(tk[1:50], 7L, "x", grupos = c("personal", "control"), proporcion = c(0.8, 0.2))
  expect_equal(sum(b == "personal"), 40L)
  # No toca la semilla global de la sesión.
  set.seed(1); a1 <- runif(1); set.seed(1); invisible(.mph_sortear(tk, 3L, "y")); a2 <- runif(1)
  expect_identical(a1, a2)
})

# ---- análisis ---------------------------------------------------------------------------------

test_that("análisis: base = quienes no habían completado antes del envío; misma ventana para los dos grupos", {
  L <- function(x) as.POSIXct(x, tz = "America/Lima")
  tA <- L("2026-11-03 10:00"); tB <- L("2026-11-03 20:00")
  personas <- data.frame(
    publico = "Estudiantes", grupo = c(rep("A", 100), rep("B", 100)),
    completo_en = as.POSIXct(NA), stringsAsFactors = FALSE)
  personas$completo_en[1:5] <- tA - 3600          # completaron antes del envío: fuera de la base
  personas$completo_en[6:15] <- tA + 2 * 3600       # 10 en la ventana
  personas$completo_en[16] <- tA + 30 * 3600        # fuera de la ventana de 24 h
  personas$completo_en[101:120] <- tB + 3600        # 20 en la ventana del B
  envios <- data.frame(ronda = 1L, etiqueta = "Recordatorio 1", publico = "Estudiantes", grupo = c("A", "B"), hora = c(tA, tB))
  r <- .mph_analizar(personas, envios, 24, ahora = L("2026-11-10 00:00"))$rondas[[1]]
  f <- r$publicos[[1]]
  expect_identical(c(f$nA, f$xA, f$nB, f$xB), c(95L, 10L, 100L, 20L))
  expect_identical(r$horaA, "10:00 a. m."); expect_identical(r$horaB, "8:00 p. m.")
  expect_false(r$en_curso)
  expect_identical(r$ganador, "empate")  # 10/95 vs 20/100 con n chico: sin diferencia clara
  # En curso: la ventana se recorta a lo que alcanzó el grupo que salió último.
  r2 <- .mph_analizar(personas, envios, 24, ahora = tB + 2.5 * 3600)$rondas[[1]]
  expect_true(r2$en_curso); expect_equal(r2$horizonte_h, 2.5)
})

test_that("análisis: un público con la misma hora en los dos grupos no entra y se dice por qué", {
  L <- function(x) as.POSIXct(x, tz = "America/Lima")
  personas <- data.frame(publico = rep(c("Admin", "Est"), each = 10), grupo = rep(c("A", "B"), 10), completo_en = as.POSIXct(NA))
  envios <- data.frame(ronda = 1L, etiqueta = "R3", publico = rep(c("Admin", "Est"), each = 2), grupo = rep(c("A", "B"), 2),
                       hora = c(L("2026-11-09 09:30"), L("2026-11-09 09:30"), L("2026-11-09 09:30"), L("2026-11-09 20:00")))
  r <- .mph_analizar(personas, envios, 24, ahora = L("2026-11-12 00:00"))$rondas[[1]]
  expect_identical(vapply(r$publicos, function(f) f$publico, ""), "Est")
  expect_identical(r$excluidos[[1]]$motivo, "los dos grupos tuvieron la misma hora")
})

test_that("cruce: la misma franja gana con los grupos cruzados", {
  rondas <- list(list(comparable = TRUE, ganador = "B", franjaA = "mediodía", franjaB = "noche", etiqueta = "R2"),
                 list(comparable = TRUE, ganador = "A", franjaA = "noche", franjaB = "mañana", etiqueta = "R4"))
  c <- .mph_lectura_cruce(rondas)
  expect_true(c$confirmado); expect_match(c$texto, "^La noche ganó en R2 y R4")
})

# ---- plan ------------------------------------------------------------------------------------

test_that("plan: cruza los grupos de un recordatorio al siguiente y respeta el horario de oficina", {
  horas <- list(manana = "09:30", noche = "20:00", oficina_temprano = "08:30", oficina_media = "10:00")
  plan <- .mph_plan_proponer(list(list(ronda = 1L, fecha = "2026-11-09"), list(ronda = 2L, fecha = "2026-11-11")),
                             c("est", "adm"), "adm", horas)
  hora <- function(k, id, g) Filter(function(f) f$ronda == k && f$campaign_id == id && f$grupo == g, plan)[[1]]$programado
  expect_identical(hora(1, "est", "A"), "2026-11-09T09:30"); expect_identical(hora(1, "est", "B"), "2026-11-09T20:00")
  expect_identical(hora(2, "est", "A"), "2026-11-11T20:00"); expect_identical(hora(2, "est", "B"), "2026-11-11T09:30")
  expect_identical(hora(1, "adm", "A"), "2026-11-09T10:00"); expect_identical(hora(2, "adm", "A"), "2026-11-11T08:30")
  expect_length(.mph_plan_avisos(plan, c("est", "adm"), "adm", "08:30", "17:00"), 0L)
  # Administrativos a las 8:00 p. m.: fuera de oficina. Misma hora: no se compara.
  plan[[which(vapply(plan, function(f) f$ronda == 1 && f$campaign_id == "adm" && f$grupo == "B", NA))]]$programado <- "2026-11-09T20:00"
  plan[[which(vapply(plan, function(f) f$ronda == 2 && f$campaign_id == "est" && f$grupo == "B", NA))]]$programado <- "2026-11-11T20:00"
  av <- .mph_plan_avisos(plan, c("est", "adm"), "adm", "08:30", "17:00", list(adm = "Administrativos", est = "Estudiantes"))
  expect_setequal(vapply(av, function(a) a$tipo, ""), c("fuera_de_oficina", "misma_hora"))
  expect_match(av[[1]]$texto, "Administrativos, grupo B: las 8:00 p. m. quedan fuera del horario de oficina")
})

# ---- antes de cada envío --------------------------------------------------------------------

test_that("antes de cada envío: lanza una vez por hora de envío y sólo dentro de la anticipación", {
  prog <- list(list(id = "c1", titulo = "R4 tarde", send_time = "2026-11-11T14:30:00+00:00", destinatarios = 100L),
               list(id = "c2", titulo = "R4 noche", send_time = "2026-11-12T01:00:00+00:00", destinatarios = 90L))
  ahora <- as.POSIXct("2026-11-11 14:05", tz = "UTC")
  d <- .mc_antes_de_envio_decidir(prog, ahora, 30L)
  expect_true(d$lanzar); expect_identical(d$para, "2026-11-11T14:30:00+00:00")
  expect_false(.mc_antes_de_envio_decidir(prog, ahora, 30L, ultima_para = d$para)$lanzar)
  expect_false(.mc_antes_de_envio_decidir(prog, as.POSIXct("2026-11-11 13:00", tz = "UTC"), 30L)$lanzar)
  expect_false(.mc_antes_de_envio_decidir(list(), ahora, 30L)$lanzar)
})

test_that("antes de cada envío: lee el total de destinatarios del GET de cada campaña, no del listado", {
  calls <- character()
  local_mocked_bindings(.mc_http = function(method, url, key, body = NULL) {
    calls <<- c(calls, url)
    if (grepl("/campaigns\\?", url)) return(list(status = 200L, body = list(campaigns = list(
      list(id = "c1", settings = list(title = "R4"), send_time = "2026-11-11T14:30:00+00:00",
           recipients = list(list_id = "L1", recipient_count = 0L))))))
    list(status = 200L, body = list(recipients = list(recipient_count = 812L)))
  })
  p <- .mc_scheduled_campaigns(KEY_SEG, "L1")
  expect_identical(p[[1]]$destinatarios, 812L)
  expect_true(any(grepl("/campaigns/c1\\?", calls)))
})

# ---- archivar --------------------------------------------------------------------------------

test_that("quién respondió: etiqueta sólo a activos, archiva a quien respondió y guarda hora y a medias", {
  sid <- .seg_session(); on.exit(session_delete(sid), add = TRUE)
  tk <- function(e) .seg_token(sid, "profesores", e)
  responses <- list(
    list(response_status = "completed", date_modified = "2026-11-03T16:10:00+00:00", custom_variables = list(t = tk("prof01@uni.edu.pe"))),
    list(response_status = "completed", date_modified = "2026-11-04T01:00:00+00:00", custom_variables = list(t = tk("prof02@uni.edu.pe"))),
    list(response_status = "partial", date_modified = "2026-11-03T17:00:00+00:00", custom_variables = list(t = tk("prof03@uni.edu.pe"))))
  calls <- list()
  local_mocked_bindings(
    .connections_token_require = .seg_tokens,
    .mc_survey_variables = function(...) "t",
    sm_api_fetch_all_responses_bulk = function(...) list(data = responses),
    .mc_sleep = function(...) NULL,
    .mc_http = function(method, url, key, body = NULL) {
      calls[[length(calls) + 1L]] <<- list(method = method, url = url, body = body)
      # prof02 ya estaba archivado: no está entre los activos.
      if (.mc_fx_es_activos(url)) return(.mc_fx_activos(sprintf("prof%02d@uni.edu.pe", setdiff(1:20, 2))))
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list(list(id = 9L, name = "Respondió")))))
      if (grepl("/segments/9$", url)) return(list(status = 200L, body = list(total_added = length(body$members_to_add))))
      if (identical(method, "POST") && grepl("/batches$", url)) return(list(status = 200L, body = list(id = "b1")))
      if (grepl("/batches/b1", url)) return(list(status = 200L, body = list(status = "finished", finished_operations = 1L, errored_operations = 0L)))
      stop("llamada inesperada: ", url)
    })
  out <- collection_mail_mailchimp_sync(sid, "profesores", survey_id = "1", list_id = "L1", archive = TRUE)
  expect_identical(out$respondents, 2L)
  expect_identical(out$tagged, 1L)
  expect_identical(out$inactive, 1L)
  expect_identical(out$archived, 1L)
  tag <- Filter(function(c) grepl("/segments/9$", c$url), calls)[[1]]
  expect_identical(unlist(tag$body$members_to_add), "prof01@uni.edu.pe")
  ops <- Filter(function(c) grepl("/batches$", c$url), calls)[[1]]$body$operations
  expect_identical(ops[[1]]$method, "DELETE")
  expect_identical(ops[[1]]$path, paste0("/lists/L1/members/", digest::digest("prof01@uni.edu.pe", algo = "md5", serialize = FALSE)))
  expect_false(any(grepl("@", unlist(out))))
  store <- .seg_store(sid, "profesores")
  expect_identical(store$completo_en[["prof01@uni.edu.pe"]], "2026-11-03T16:10:00+00:00")
  expect_identical(store$parcial, "prof03@uni.edu.pe")
  # Contactos muestra a quien la dejó a medias.
  l <- collection_mail_contacts_list(sid, "profesores", respondio = "parcial")
  expect_identical(l$total, 1L); expect_true(l$rows[[1]]$a_medias)
  expect_identical(l$resumen$a_medias, 1L)
})

test_that("sin archivar no hay /batches; un lote que no termina falla con E_MAILCHIMP_BATCH", {
  local_mocked_bindings(.mc_sleep = function(...) NULL,
                        .mc_http = function(method, url, key, body = NULL) {
                          if (grepl("/batches$", url)) return(list(status = 200L, body = list(id = "b2")))
                          list(status = 200L, body = list(status = "started"))
                        })
  expect_identical(.seg_code(.mc_archive_emails(KEY_SEG, "L1", "a@b.org")), "E_MAILCHIMP_BATCH")
})

# ---- Seguimiento: varias campañas, prueba de horarios y correo personal -----------------

test_that("prueba de horarios de punta a punta: grupos, etiquetas, plan, resultados e informe", {
  sid <- .seg_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_seguimiento_config(sid, list_id = "L1", encuestas = list(profesores = "111", administrativos = "222"))
  expect_identical(.seg_code(collection_mail_prueba_horario_sortear(sid, 20261103L)), "E_COLLECTION_MAIL_PRUEBA_INPUT")
  collection_mail_prueba_horario_config(sid, campanas = list("profesores", "administrativos"), oficina = list("administrativos"))
  s <- collection_mail_prueba_horario_sortear(sid, 20261103L)
  expect_identical(s$grupos$profesores, list(A = 10L, B = 10L))
  g1 <- .seg_store(sid, "profesores")$grupo_horario
  expect_length(g1, 20L)
  # Grupos fijos: no se vuelve a sortear sin pedirlo; con rehacer y la misma semilla salen iguales.
  expect_identical(.seg_code(collection_mail_prueba_horario_sortear(sid, 20261103L)), "E_COLLECTION_MAIL_PRUEBA_SORTEADA")
  collection_mail_prueba_horario_sortear(sid, 20261103L, rehacer = TRUE)
  expect_identical(.seg_store(sid, "profesores")$grupo_horario, g1)

  # Etiquetas en Mailchimp: sólo activos, cada grupo a su etiqueta.
  added <- list()
  local_mocked_bindings(
    .connections_token_require = .seg_tokens, .mc_sleep = function(...) NULL,
    .mc_http = function(method, url, key, body = NULL) {
      if (.mc_fx_es_activos(url)) return(.mc_fx_activos(c(sprintf("prof%02d@uni.edu.pe", 1:20), sprintf("adm%02d@uni.edu.pe", 1:19))))
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list(list(id = 1L, name = "Envío mañana"), list(id = 2L, name = "Envío tarde")))))
      if (grepl("/segments/[12]$", url)) { added[[sub(".*/", "", url)]] <<- c(added[[sub(".*/", "", url)]], unlist(body$members_to_add)); return(list(status = 200L, body = list(total_added = length(body$members_to_add)))) }
      stop("llamada inesperada: ", url)
    })
  out <- .mph_etiquetar_run(.mph_etiquetar_prepare(sid))
  expect_identical(out$A$etiquetados + out$B$etiquetados, 39L)
  expect_identical(out$A$inactivos + out$B$inactivos, 1L)
  ga <- c(.seg_store(sid, "profesores")$grupo_horario, .seg_store(sid, "administrativos")$grupo_horario)
  expect_setequal(added[["1"]], intersect(names(ga)[ga == "A"], c(sprintf("prof%02d@uni.edu.pe", 1:20), sprintf("adm%02d@uni.edu.pe", 1:19))))

  # Plan cruzado con oficina, propuesto desde las fechas.
  e <- collection_mail_prueba_horario_plan(sid, proponer = list(rondas = list(list(ronda = 1, fecha = "2026-11-03"), list(ronda = 2, fecha = "2026-11-05")),
                                                                manana = "10:00", noche = "17:30"))
  expect_length(e$horario$plan, 8L)
  expect_length(e$horario$avisos, 0L)
  expect_identical(vapply(e$horario$rondas, function(r) r$etiqueta, ""), c("Recordatorio 1", "Recordatorio 2"))

  # Respuestas: en profesores completan 4 del grupo A y 1 del B dentro de 24 h del R1.
  st <- .seg_store(sid, "profesores"); gh <- st$grupo_horario
  A <- names(gh)[gh == "A"]; B <- names(gh)[gh == "B"]
  st$completo_en <- c(stats::setNames(rep("2026-11-03T17:00:00+00:00", 4), A[1:4]), stats::setNames("2026-11-04T01:00:00+00:00", B[1]))
  .cmail_recipients_save(session_get(sid), "profesores", st)
  res <- collection_mail_prueba_horario_resultados(sid, ahora = as.POSIXct("2026-11-10 12:00", tz = "UTC"))
  r1 <- res$rondas[[1]]
  prof <- Filter(function(f) f$publico == "Profesores", r1$publicos)[[1]]
  expect_identical(c(prof$xA, prof$nA, prof$xB, prof$nB), c(4L, 10L, 1L, 10L))
  expect_identical(r1$horaA, "10:00 a. m.")
  expect_identical(res$horas_del_plan, 8L)
  expect_false(any(grepl("@", unlist(res))))

  # Informe PDF real.
  pdf <- collection_mail_prueba_horario_informe(sid, ahora = as.POSIXct("2026-11-10 12:00", tz = "UTC"))
  path <- session_get(sid)$files[[pdf$file_id]]$path
  expect_true(file.exists(path))
  expect_identical(rawToChar(readBin(path, "raw", 4L)), "%PDF")
})

test_that("correo personal: 80/20 por público y grupo, archivado de los dos correos, rechazados no se reintentan", {
  sid <- .seg_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_seguimiento_config(sid, list_id = "L1")
  collection_mail_prueba_horario_config(sid, campanas = list("profesores"))
  collection_mail_prueba_horario_sortear(sid, 1L)
  e <- collection_mail_seguimiento_estado(sid)
  cand <- Filter(function(c) c$campaign_id == "profesores", e$correo_personal$campanas)[[1]]$candidatas
  expect_identical(vapply(cand, function(c) c$key, ""), "Correo personal")
  expect_identical(.seg_code(collection_mail_correo_personal_config(sid, columnas = list(profesores = "Apellidos y nombres"))),
                   "E_COLLECTION_MAIL_CORREO_PERSONAL_INPUT")
  collection_mail_correo_personal_config(sid, columnas = list(profesores = "Correo personal"))
  s <- collection_mail_correo_personal_sortear(sid, 20261110L)
  expect_identical(s$campanas$profesores, list(personal = 16L, control = 4L))
  sc <- .seg_store(sid, "profesores")$segundo_correo
  expect_identical(as.integer(table(sc$grupo, sc$brazo)["A", "personal"]), 8L)

  # Cargar: Mailchimp rechaza uno; queda rechazado y no vuelve a la carga.
  rechazado <- sc$correo[sc$brazo == "personal"][1]
  local_mocked_bindings(
    .connections_token_require = .seg_tokens,
    .mc_audience_build = function(session, campaign) {
      st <- .cmail_recipients_load(session, campaign$campaign_id); em <- .cmail_contact_frame(st)$key
      list(emails = em, merge = list(FNAME = rep("X", length(em))), merge_names = "First Name", n = length(em))
    },
    .mc_http = function(method, url, key, body = NULL) {
      if (grepl("/merge-fields", url)) return(list(status = 200L, body = list(merge_fields = list(list(tag = "FNAME")))))
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list(list(id = 3L, name = "Correo personal"), list(id = 4L, name = "Profesores"), list(id = 1L, name = "Envío mañana"), list(id = 2L, name = "Envío tarde")))))
      if (grepl("/segments/[0-9]+$", url)) return(list(status = 200L, body = list(total_added = length(body$members_to_add))))
      if (identical(method, "POST") && grepl("/lists/L1$", url)) return(list(status = 200L, body = list(errors = list(list(email_address = rechazado, error_code = "ERROR_CONTACT_EXISTS")))))
      stop("llamada inesperada: ", url)
    })
  inp <- .mcp_cargar_prepare(sid)
  expect_length(inp$campanas[[1]]$emails, 16L)
  res <- .mcp_cargar_run(inp)
  out <- .mcp_cargar_hook(sid)(list(result_data = res))
  expect_identical(out$campanas[[1]]$cargados, 15L)
  expect_false(any(grepl("@", unlist(out))))
  sc <- .seg_store(sid, "profesores")$segundo_correo
  expect_identical(sc$estado[sc$correo == rechazado], "rechazado")
  expect_identical(.seg_code(.mcp_cargar_prepare(sid)), "E_COLLECTION_MAIL_CORREO_PERSONAL_SIN_SORTEO")
  expect_identical(.seg_code(collection_mail_correo_personal_sortear(sid, 1L)), "E_COLLECTION_MAIL_CORREO_PERSONAL_CARGADO")

  # Archivar a quien responde se lleva sus dos correos.
  store <- .seg_store(sid, "profesores")
  quien <- sc$clave[sc$estado == "cargado"][1]
  personal <- sc$correo[sc$clave == quien]
  linked <- .mc_linked_emails(store)
  expect_identical(unname(linked[store$tokens[[quien]]]), personal)
  expect_false(rechazado %in% linked)
})

test_that("efecto del correo personal: intención de tratar desde el primer envío, con CMH por público y grupo", {
  desde <- as.POSIXct("2026-11-16 14:30", tz = "UTC")
  p <- data.frame(publico = "Egresados", grupo = rep(c("A", "B"), each = 500),
                  brazo = rep(c(rep("personal", 400), rep("control", 100)), 2), completo_en = as.POSIXct(NA),
                  rechazado = FALSE, stringsAsFactors = FALSE)
  pers <- which(p$brazo == "personal"); ctrl <- which(p$brazo == "control")
  p$completo_en[pers[1:80]] <- desde + 3600      # 10 % del 80 %
  p$completo_en[ctrl[1:6]] <- desde + 3600       # 3 % del control
  p$completo_en[pers[81:90]] <- desde - 3600     # antes de empezar: fuera de la base
  e <- .mcp_efecto(p, desde, ahora = desde + 5 * 86400)
  expect_identical(e$total$nA, 790L); expect_identical(e$total$xA, 80L); expect_identical(e$total$nB, 200L)
  expect_lt(e$cmh$p, 0.05)
  expect_match(e$lectura, "el correo personal suma completas")
})

test_that("borrador por grupo: el segmento exige público y grupo y excluye Respondió", {
  s <- .mc_segment_opts(41L, exclude_id = "9", group_id = "7")
  expect_identical(vapply(s$conditions, function(c) c$op, ""), c("static_is", "static_is", "static_not"))
  expect_identical(s$conditions[[2]]$value, 7L)
})

test_that("efecto sin completas desde el inicio: no anuncia empate ni deja paréntesis vacíos", {
  desde <- as.POSIXct("2026-11-16 14:30", tz = "UTC")
  p <- data.frame(publico = "Egresados", grupo = "A", brazo = rep(c("personal", "control"), c(8, 2)),
                  completo_en = as.POSIXct(NA), rechazado = FALSE, stringsAsFactors = FALSE)
  e <- .mcp_efecto(p, desde, ahora = desde + 86400)
  expect_match(e$lectura, "^Todavía no hay completas desde el primer envío")
  expect_false(grepl("()", e$lectura, fixed = TRUE))
})

test_that("todas las campañas: lee los activos una vez, salta las que no están listas y no devuelve correos ni tokens", {
  sid <- .seg_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_seguimiento_config(sid, list_id = "L1", archivar = FALSE, encuestas = list(profesores = "111"))
  tk <- .seg_token(sid, "profesores", "prof05@uni.edu.pe")
  activos_leidos <- 0L
  local_mocked_bindings(
    .connections_token_require = .seg_tokens,
    .mc_survey_variables = function(...) "t",
    sm_api_fetch_all_responses_bulk = function(...) list(data = list(
      list(response_status = "completed", date_modified = "2026-11-03T16:10:00+00:00", custom_variables = list(t = tk)))),
    .mc_http = function(method, url, key, body = NULL) {
      if (.mc_fx_es_activos(url)) { activos_leidos <<- activos_leidos + 1L; return(.mc_fx_activos(sprintf("prof%02d@uni.edu.pe", 1:20))) }
      if (grepl("/segments\\?", url)) return(list(status = 200L, body = list(segments = list(list(id = 9L, name = "Respondió")))))
      if (grepl("/segments/9$", url)) return(list(status = 200L, body = list(total_added = length(body$members_to_add))))
      stop("llamada inesperada: ", url)
    })
  input <- .mseg_sync_prepare(sid)
  expect_identical(vapply(input$saltadas, function(x) x$campaign_id, ""), "administrativos")
  ctx <- lapply(stats::setNames(input$campanas, vapply(input$campanas, function(x) x$campaign_id, "")),
                function(x) list(campaign_id = x$campaign_id, survey_id = x$survey_id))
  res <- .mseg_sync_hook(sid, ctx)(list(result_data = .mseg_sync_run(input)))
  expect_identical(activos_leidos, 1L)
  expect_identical(res$totales$respondieron, 1L)
  expect_identical(res$totales$etiquetados, 1L)
  expect_false(any(grepl("@", unlist(res))))
  expect_null(res$campanas[[1]]$respondent_tokens)
  expect_identical(.seg_store(sid, "profesores")$completo_en[["prof05@uni.edu.pe"]], "2026-11-03T16:10:00+00:00")
})
