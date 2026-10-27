# La variable del token no depende de que se llame `t`
# (docs/qa/checklist-variable-token-surveymonkey-2026-10-27.md).
#
# SurveyMonkey guarda un parámetro del enlace solo si se llama igual que una
# variable personalizada declarada en la encuesta. La campaña declara el
# nombre (`t` por defecto), los enlaces se generan con él, la sincronización
# reconoce el token por su valor y se niega, con causa y arreglo, si la
# encuesta no recibe la variable. Datos SINTÉTICOS; sin red.

.vt_csv <- function() {
  paste(
    "Apellidos y nombres,Correo,Carrera",
    "\"QUISPE, ANA\",ana@ejemplo.org,Sociología",
    "\"ROJAS, CARLOS\",carlos@ejemplo.org,Economía",
    "\"TORRES, LUZ\",luz@ejemplo.org,Derecho",
    sep = "\n"
  )
}

.vt_session <- function() {
  sid <- .cmail_fx_session(logos = FALSE)
  collection_mail_campaign_create(sid, 0L, name = "Egresados")
  collection_mail_recipients_import(sid, file_name = "contactos.csv", campaign_id = "egresados",
                                    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.vt_csv()))))
  sid
}

.vt_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
.vt_store <- function(sid) .cmail_recipients_load(session_get(sid), "egresados")

.vt_mocks <- function(survey_variables, responses, env = parent.frame()) {
  read <- new.env(); read$responses <- FALSE
  local_mocked_bindings(
    .connections_token_require = function(provider, ...) {
      if (identical(provider, "mailchimp")) stop("no debía pedir la clave de Mailchimp")
      "sm-token"
    },
    sm_api_fetch_survey_details = function(survey_id, token, ...) {
      list(custom_variables = stats::setNames(as.list(rep("", length(survey_variables))), survey_variables))
    },
    sm_api_fetch_all_responses_bulk = function(...) { read$responses <- TRUE; list(data = responses) },
    .mc_http = function(...) stop("no debía llamar a Mailchimp"),
    .env = env
  )
  read
}

.vt_resp <- function(status, ...) list(response_status = status, custom_variables = list(...))

test_that("enlace: la campaña declara la variable y los enlaces salen con ella; regenerar la conserva", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  e <- collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC", variable = "id")
  expect_identical(e$variable, "id")
  store <- .vt_store(sid)
  tok <- store$tokens
  expect_identical(store$rows$enlace_encuesta[[1]], paste0("https://es.surveymonkey.com/r/ABC?id=", tok[["ana@ejemplo.org"]]))
  expect_false(any(grepl("[?&]t=", store$rows$enlace_encuesta)))
  expect_identical(store$enlace$variable, "id")
  expect_identical(.mc_token_of(store$rows$enlace_encuesta[[2]], "id"), tok[["carlos@ejemplo.org"]])
  expect_true(is.na(.mc_token_of(store$rows$enlace_encuesta[[2]])))   # con `t` no lo encuentra

  # Sin variable en el pedido (cambiar solo la url, o reimportar) se conserva `id`.
  e2 <- collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC?lang=es")
  expect_identical(e2$variable, "id")
  expect_identical(.vt_store(sid)$rows$enlace_encuesta[[1]],
                   paste0("https://es.surveymonkey.com/r/ABC?lang=es&id=", tok[["ana@ejemplo.org"]]))
  collection_mail_recipients_import(sid, file_name = "contactos.csv", campaign_id = "egresados",
                                    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(.vt_csv()))))
  expect_identical(.vt_store(sid)$rows$enlace_encuesta[[3]],
                   paste0("https://es.surveymonkey.com/r/ABC?lang=es&id=", tok[["luz@ejemplo.org"]]))

  # Volver a `t` regenera todos los enlaces con los mismos tokens.
  e3 <- collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC", variable = "t")
  expect_identical(e3[c("variable", "generados", "conservados")], list(variable = "t", generados = 0L, conservados = 3L))
  expect_identical(.vt_store(sid)$rows$enlace_encuesta[[1]], paste0("https://es.surveymonkey.com/r/ABC?t=", tok[["ana@ejemplo.org"]]))
})

test_that("enlace: la variable se publica en el resumen y el perfil, y es null sin enlaces", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  expect_true(is.na(collection_mail_contacts_list(sid, "egresados")$resumen$enlace_variable))
  expect_true(is.na(collection_mail_contacts_perfil(sid, "egresados")$enlace_variable))
  expect_true(is.na(.cmail_no_store_resumen()$enlace_variable))
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC", variable = "id")
  expect_identical(collection_mail_contacts_list(sid, "egresados")$resumen$enlace_variable, "id")
  expect_identical(collection_mail_contacts_perfil(sid, "egresados")$enlace_variable, "id")
})

test_that("enlace: una variable mal escrita o repetida en el enlace se rechaza con su código", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  for (bad in c("1t", "mi variable", "t=", "id&x", strrep("a", 31))) {
    expect_identical(.vt_code(collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC", variable = bad)),
                     "E_COLLECTION_MAIL_ENLACE_VARIABLE", info = bad)
  }
  expect_identical(.cmail_enlace_variable_check(""), "t")
  expect_identical(.cmail_enlace_variable_check(" id "), "id")
  # El enlace ya trae la variable que la app va a poner: se pide sin token.
  expect_identical(.vt_code(collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC?id=x", variable = "id")),
                   "E_COLLECTION_MAIL_ENLACE_URL")
  # Una `t` ajena no estorba cuando la variable es otra.
  expect_identical(collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC?t=1", variable = "id")$variable, "id")
})

test_that("veredicto: dice la causa y el arreglo en cada dirección", {
  expect_true(.mc_variable_verdict("t", c("t", "id"))$ok)
  ninguna <- .mc_variable_verdict("t", character(0))
  expect_false(ninguna$ok)
  expect_match(ninguna$mensaje, "no tiene la variable «t»", fixed = TRUE)
  expect_match(ninguna$mensaje, "agrégale una variable con el nombre «t»", fixed = TRUE)
  otra <- .mc_variable_verdict("t", "id")
  expect_false(otra$ok)
  expect_match(otra$mensaje, "usa la variable «id», no «t»", fixed = TRUE)
  expect_match(otra$mensaje, "Escribe «id» en Contactos", fixed = TRUE)
  expect_match(.mc_variable_verdict("t", c("id", "ref"))$mensaje, "las variables «id» y «ref»", fixed = TRUE)
})

test_that("chequeo: la encuesta recibe (o no) la variable de la campaña, sin leer respuestas", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC", variable = "id")
  read <- .vt_mocks("id", list())
  ok <- collection_mail_mailchimp_check(sid, "egresados", survey_id = "423872156")
  expect_identical(ok[c("variable", "coincide")], list(variable = "id", coincide = TRUE))
  expect_identical(unclass(ok$variables_encuesta), "id")
  expect_false(read$responses)
  expect_identical(.vt_code(collection_mail_mailchimp_check(sid, "egresados", survey_id = "")), "E_COLLECTION_MAIL_SYNC_INPUT")
})

test_that("chequeo: sin enlaces generados, la variable de la campaña es `t`", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  .vt_mocks("id", list())
  no <- collection_mail_mailchimp_check(sid, "egresados", survey_id = "1")
  expect_identical(no$variable, "t")
  expect_false(no$coincide)
  expect_match(no$mensaje, "usa la variable «id», no «t»", fixed = TRUE)
})

test_that("sincronizar: si la encuesta no recibe la variable, se niega antes de leer respuestas", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")
  read <- .vt_mocks("id", list())
  e <- tryCatch(collection_mail_mailchimp_sync(sid, "egresados", survey_id = "1", list_id = "", dry_run = TRUE),
                error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_SYNC_VARIABLE")
  expect_match(conditionMessage(e), "Escribe «id» en Contactos", fixed = TRUE)
  expect_false(read$responses)
})

test_that("sincronizar: con la variable `id` cruza el token y marca a quien completó", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC", variable = "id")
  tok <- .vt_store(sid)$tokens
  .vt_mocks("id", list(
    .vt_resp("completed", id = tok[["ana@ejemplo.org"]]),
    .vt_resp("partial", id = tok[["luz@ejemplo.org"]]),
    .vt_resp("completed", id = "otrotok9"),
    .vt_resp("completed")
  ))
  out <- collection_mail_mailchimp_sync(sid, "egresados", survey_id = "1", list_id = "", dry_run = TRUE)
  expect_identical(out[c("respondents", "from_other_campaign", "without_token", "marcados")],
                   list(respondents = 1L, from_other_campaign = 1L, without_token = 1L, marcados = 1L))
  expect_setequal(names(.vt_store(sid)$respondio_en), "ana@ejemplo.org")
})

test_that("sincronizar: el token se reconoce por su valor aunque llegue en otra variable de la encuesta", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")
  tok <- .vt_store(sid)$tokens
  # La encuesta declara `t` e `id`; una respuesta trae el token en `id` (p. ej.,
  # enlaces generados antes con otra variable) y otra en `t`.
  .vt_mocks(c("t", "id"), list(
    .vt_resp("completed", t = "", id = tok[["ana@ejemplo.org"]]),
    .vt_resp("completed", t = tok[["carlos@ejemplo.org"]], id = "ajeno123")
  ))
  out <- collection_mail_mailchimp_sync(sid, "egresados", survey_id = "1", list_id = "", dry_run = TRUE)
  expect_identical(out$respondents, 2L)
  expect_identical(out$from_other_campaign, 0L)
  expect_setequal(names(.vt_store(sid)$respondio_en), c("ana@ejemplo.org", "carlos@ejemplo.org"))
})

test_that("sin tokens generados, el de la columna del enlace se lee con la variable de la campaña", {
  store <- list(
    rows = data.frame(correo = c("ana@ejemplo.org", "luz@ejemplo.org"),
                      enlace = c("https://es.surveymonkey.com/r/ABC?id=tokana0001", "https://es.surveymonkey.com/r/ABC?t=tokluz0003")),
    mapping = list(email_column = "correo", fields = list(enlace = "enlace")),
    enlace = list(url = "https://es.surveymonkey.com/r/ABC", variable = "id")
  )
  local_mocked_bindings(.cmail_recipients_resolve = function(store, template) {
    list(rows = seq_len(nrow(store$rows)), email = store$rows$correo)
  })
  ti <- .mc_token_index(store, NULL)
  expect_identical(unname(ti$index), "ana@ejemplo.org")
  expect_identical(names(ti$index), "tokana0001")
})

test_that(".mc_response_token: la variable propia manda; sin token conocido devuelve el propio o NA", {
  known <- c("tokaaa1", "tokbbb2")
  expect_identical(.mc_response_token(list(t = "tokaaa1", id = "tokbbb2"), "t", known), "tokaaa1")
  expect_identical(.mc_response_token(list(t = "", id = "tokbbb2"), "t", known), "tokbbb2")
  expect_identical(.mc_response_token(list(t = "ajeno99"), "t", known), "ajeno99")
  expect_true(is.na(.mc_response_token(list(), "t", known)))
  expect_true(is.na(.mc_response_token(NULL, "t", known)))
})

test_that("contrato HTTP: GET mail-sync/check responde el veredicto sin correos", {
  sid <- .vt_session(); on.exit(session_delete(sid), add = TRUE)
  .vt_mocks("t", list())
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  req <- as.environment(list(
    REQUEST_METHOD = "GET", PATH_INFO = "/api/recopiladores/mail-sync/check",
    QUERY_STRING = "campaign_id=egresados&survey_id=1",
    HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
    rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) "")
  ))
  r <- pr$call(req)
  expect_identical(as.integer(r$status), 200L)
  body <- jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE)
  expect_true(body$coincide)
  expect_identical(body$variable, "t")
  expect_identical(body$variables_encuesta, list("t"))
  expect_false(grepl("@", as.character(r$body), fixed = TRUE))
})
