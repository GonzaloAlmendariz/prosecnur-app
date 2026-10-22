# Pestaña Contactos y persistencia de la lista en el .pulso (ADR 0112).
# Datos SINTÉTICOS (helper-collection-mail.R y abajo): ningún correo real.

.cct_csv <- function() {
  paste(
    "Apellidos y nombres,Correo,Carrera,Sexo,Sede",
    "\"QUISPE, ANA\",ana@ejemplo.org,Sociología,F,Lima",
    "\"ROJAS, CARLOS\",carlos@ejemplo.org,Economía,M,Lima",
    "\"TORRES, LUZ\",luz@ejemplo.org,Sociología,F,",
    "\"PAREDES, MARIA\",maria@ejemplo.org,Derecho,F,Arequipa",
    "\"VEGA, JOSE\",jose@ejemplo.org,Economía,M,NA",
    "\"SIN, CORREO\",,Derecho,M,Lima",
    "\"MAL, CORREO\",no-es-correo,Derecho,F,Lima",
    "\"QUISPE, ANA\",ANA@ejemplo.org,Sociología,F,Lima",
    sep = "\n"
  )
}

.cct_session <- function(name = "Egresados") {
  sid <- .cmail_fx_session(logos = FALSE)
  collection_mail_campaign_create(sid, 0L, name = name)
  sid
}

.cct_import <- function(sid, csv = .cct_csv(), campaign_id = "egresados") {
  collection_mail_recipients_import(sid, file_name = "contactos.csv", campaign_id = campaign_id,
                                    content_base64 = jsonlite::base64_enc(charToRaw(enc2utf8(csv))))
}

.cct_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.cct_tokens <- function(sid, id = "egresados") .cmail_recipients_load(session_get(sid), id)$tokens

.cct_srev <- function(sid) collection_mail_template_get(sid, campaign_id = "egresados")$state_revision

test_that("lista: partición por estado, correos visibles, búsqueda, filtros y página", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  l <- collection_mail_contacts_list(sid, "egresados")
  expect_identical(l$total, 8L)
  expect_identical(l$resumen[c("importados", "efectivos", "sin_correo", "correo_invalido", "repetidos")],
                   list(importados = 8L, efectivos = 5L, sin_correo = 1L, correo_invalido = 1L, repetidos = 1L))
  expect_true(is.na(l$resumen$respondieron))
  expect_identical(l$rows[[1]]$email, "ana@ejemplo.org")
  expect_identical(l$rows[[1]]$nombre, "QUISPE, ANA")
  expect_identical(l$rows[[1]]$fila, 2L)
  expect_identical(vapply(l$columnas, `[[`, "", "key"), c("Carrera", "Sexo", "Sede"))
  expect_identical(vapply(l$rows, `[[`, "", "estado"),
                   c(rep("efectivo", 5), "sin_correo", "correo_invalido", "repetido"))
  # «NA» y vacío son sin dato (null).
  expect_true(is.na(l$rows[[3]]$valores$Sede))
  expect_true(is.na(l$rows[[5]]$valores$Sede))

  expect_identical(collection_mail_contacts_list(sid, "egresados", estado = "repetido")$total, 1L)
  expect_identical(collection_mail_contacts_list(sid, "egresados", q = "sociologia")$total, 3L)
  expect_identical(collection_mail_contacts_list(sid, "egresados", q = "CARLOS@")$total, 1L)
  f <- collection_mail_contacts_list(sid, "egresados", estado = "efectivo",
                                     filtros = '{"Carrera":["Economía"],"Sede":["Lima"]}')
  expect_identical(f$total, 1L)
  expect_identical(f$rows[[1]]$email, "carlos@ejemplo.org")
  # Sin dato se pide con "" o null.
  expect_identical(collection_mail_contacts_list(sid, "egresados", filtros = '{"Sede":[null]}')$total, 2L)
  p2 <- collection_mail_contacts_list(sid, "egresados", page = "2", per_page = "3")
  expect_identical(length(p2$rows), 3L)
  expect_identical(p2$rows[[1]]$fila, 5L)
  expect_length(collection_mail_contacts_list(sid, "egresados", page = 9)$rows, 0L)

  expect_identical(.cct_code(collection_mail_contacts_list(sid, "egresados", estado = "raro")),
                   "E_COLLECTION_MAIL_CONTACTS_QUERY")
  expect_identical(.cct_code(collection_mail_contacts_list(sid, "egresados", filtros = "{no json")),
                   "E_COLLECTION_MAIL_CONTACTS_QUERY")
  expect_identical(.cct_code(collection_mail_contacts_list(sid, "egresados", filtros = '{"Correo":["x"]}')),
                   "E_COLLECTION_MAIL_CONTACTS_QUERY")
  expect_identical(.cct_code(collection_mail_contacts_list(sid, "egresados", per_page = 501)),
                   "E_COLLECTION_MAIL_CONTACTS_QUERY")
})

test_that("sin lista: la lista y el tablero vienen vacíos, sin error", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  l <- collection_mail_contacts_list(sid, "egresados")
  expect_false(l$cargados)
  expect_identical(l$total, 0L)
  expect_identical(l$resumen$importados, 0L)
  p <- collection_mail_contacts_perfil(sid, "egresados")
  expect_identical(p$base, 0L)
  expect_false(p$respuestas_leidas)
  expect_identical(.cct_code(collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")),
                   "E_COLLECTION_MAIL_NO_RECIPIENTS")
})

test_that("enlace: token de 10 [A-Za-z0-9] por persona, ?t vs &t, reimport y cambio de url conservan", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  e <- collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")
  expect_identical(e[c("generados", "conservados", "total", "campo")],
                   list(generados = 5L, conservados = 0L, total = 5L, campo = "enlace_encuesta"))
  expect_null(e$aviso)
  expect_identical(unclass(e$mapeado), "enlace")
  tok <- .cct_tokens(sid)
  expect_length(tok, 5L)
  expect_true(all(grepl("^[A-Za-z0-9]{10}$", tok)))
  expect_false(anyDuplicated(tok) > 0L)
  # El correo repetido (ANA@…) es la misma persona: comparte token y no genera otro.
  expect_setequal(names(tok), c("ana@ejemplo.org", "carlos@ejemplo.org", "luz@ejemplo.org",
                                "maria@ejemplo.org", "jose@ejemplo.org"))
  store <- .cmail_recipients_load(session_get(sid), "egresados")
  expect_identical(store$rows$enlace_encuesta[[1]], paste0("https://es.surveymonkey.com/r/ABC?t=", tok[["ana@ejemplo.org"]]))
  expect_identical(store$rows$enlace_encuesta[[6]], "")     # sin correo: sin enlace
  expect_identical(store$mapping$fields$enlace, "enlace_encuesta")
  expect_identical(.mc_token_of(store$rows$enlace_encuesta[[2]]), tok[["carlos@ejemplo.org"]])

  # Cambiar la url conserva tokens; con consulta propia va &t=.
  e2 <- collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC?lang=es")
  expect_identical(e2[c("generados", "conservados")], list(generados = 0L, conservados = 5L))
  expect_identical(.cct_tokens(sid), tok)
  store <- .cmail_recipients_load(session_get(sid), "egresados")
  expect_identical(store$rows$enlace_encuesta[[1]],
                   paste0("https://es.surveymonkey.com/r/ABC?lang=es&t=", tok[["ana@ejemplo.org"]]))

  # Reimportar: quien estaba conserva su token, quien entra recibe uno nuevo y
  # quien sale lo guarda (si vuelve, vuelve con él). Ninguno se repite.
  csv2 <- paste("Apellidos y nombres,Correo,Carrera,Sexo,Sede",
                "\"QUISPE, ANA\",Ana@Ejemplo.org,Sociología,F,Lima",
                "\"NUEVO, PEDRO\",pedro@ejemplo.org,Derecho,M,Lima", sep = "\n")
  .cct_import(sid, csv2)
  tok2 <- .cct_tokens(sid)
  expect_identical(tok2[names(tok)], tok)
  expect_true("pedro@ejemplo.org" %in% names(tok2))
  expect_false(anyDuplicated(unname(tok2)) > 0L)
  store <- .cmail_recipients_load(session_get(sid), "egresados")
  expect_identical(store$rows$enlace_encuesta,
                   paste0("https://es.surveymonkey.com/r/ABC?lang=es&t=", unname(tok2[c("ana@ejemplo.org", "pedro@ejemplo.org")])))
  expect_identical(store$mapping$fields$enlace, "enlace_encuesta")
  # El enlace sale en la audiencia como cualquier campo mapeado.
  res <- .cmail_recipients_resolve(store, NULL)
  tab <- .cmail_audience_table(store, res, .cmail_mapped_keys(store$mapping), NULL)
  expect_true("ENLACE" %in% tab$header)
  expect_identical(tab$cols[[match("ENLACE", tab$header)]][[2]], store$rows$enlace_encuesta[[2]])
})

test_that("enlace: valida https y forma; fuera de SurveyMonkey avisa pero genera", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  for (bad in list(NULL, "", "http://es.surveymonkey.com/r/ABC", "https://es.surveymonkey.com/r/ABC?t=xx",
                   "https://x.org/r/ A", "https://x.org/r/A#frag", "ftp://x.org", "https://localhost/")) {
    expect_identical(.cct_code(collection_mail_enlace_put(sid, "egresados", bad)), "E_COLLECTION_MAIL_ENLACE_URL",
                     info = paste(bad))
  }
  e <- collection_mail_enlace_put(sid, "egresados", "https://forms.ejemplo.org/encuesta")
  expect_identical(e$generados, 5L)
  expect_match(e$aviso, "SurveyMonkey")
  expect_identical(.cmail_enlace_join("https://x.org/r/A?", "abc"), "https://x.org/r/A?t=abc")
})

test_that("enlace: el aviso fuera de SurveyMonkey dice causa y arreglo, sin jerga", {
  aviso <- .cmail_enlace_url_check("https://forms.ejemplo.org/encuesta")$aviso
  expect_identical(aviso, paste("Este enlace no es de SurveyMonkey: los enlaces se generaron, pero la app no",
                                "podrá saber quién respondió. Para eso, usa el enlace del recopilador web de SurveyMonkey."))
  expect_false(grepl("variable t|«t»|/r/", aviso))
  expect_null(.cmail_enlace_url_check("https://es.surveymonkey.com/r/ABC")$aviso)
})

test_that("rótulos: clave humanizada con tildes; el label de la plantilla manda; la clave no cambia", {
  expect_identical(.cmail_rotulo_de_clave(c("anio_egreso", "carrera", "SITUACION_LABORAL", "region-origen",
                                            "ano", "numero_de_telefono", "Pais", "__", "Sede")),
                   c("Año egreso", "Carrera", "Situación laboral", "Región origen",
                     "Ano", "Número de teléfono", "País", "__", "Sede"))
  store <- list(rows = data.frame(prog = "x", genero = "F", enlace_encuesta = "u"),
                mapping = list(fields = list(carrera = "prog")))
  tpl <- list(fields = list(list(key = "carrera", label = "Carrera profesional"),
                            list(key = "genero", label = "Sexo declarado"),
                            list(key = "otro", label = "")))
  expect_identical(.cmail_column_labels(store, tpl, c("prog", "genero", "enlace_encuesta", "anio")),
                   c(prog = "Carrera profesional", genero = "Sexo declarado",
                     enlace_encuesta = "Enlace a la encuesta", anio = "Año"))
  # Plantilla sin campos o con basura: se humaniza.
  expect_identical(.cmail_column_labels(store, list(fields = "x"), "genero"), c(genero = "Género"))

  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  csv <- paste("Nombre,Correo,anio_egreso,carrera,condicion",
               "A,a@ejemplo.org,2020,Derecho,Titulado",
               "B,b@ejemplo.org,2021,Economía,Bachiller", sep = "\n")
  .cct_import(sid, csv)
  l <- collection_mail_contacts_list(sid, "egresados")
  expect_identical(vapply(l$columnas, `[[`, "", "key"), c("anio_egreso", "carrera", "condicion"))
  expect_identical(vapply(l$columnas, `[[`, "", "label"), c("Año egreso", "Carrera", "Condición"))
  # Los filtros siguen por clave.
  expect_identical(collection_mail_contacts_list(sid, "egresados", filtros = '{"anio_egreso":["2021"]}')$total, 1L)
  collection_mail_contacts_control_put(sid, "egresados", list("anio_egreso", "condicion"))
  p <- collection_mail_contacts_perfil(sid, "egresados", cruce = "anio_egreso,condicion")
  cand <- stats::setNames(vapply(p$candidatas, `[[`, "", "label"), vapply(p$candidatas, `[[`, "", "key"))
  expect_identical(cand[["anio_egreso"]], "Año egreso")
  expect_identical(cand[["condicion"]], "Condición")
  expect_identical(vapply(p$variables, `[[`, "", "key"), c("anio_egreso", "condicion"))
  expect_identical(vapply(p$variables, `[[`, "", "label"), c("Año egreso", "Condición"))
  expect_identical(p$cruce[c("a", "b", "a_label", "b_label")],
                   list(a = "anio_egreso", b = "condicion", a_label = "Año egreso", b_label = "Condición"))
})

test_that("lista: el enlace generado no es columna visible y el resumen trae enlace_url al recargar", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  l0 <- collection_mail_contacts_list(sid, "egresados")
  expect_true(is.na(l0$resumen$enlace_url))
  expect_true(is.na(collection_mail_contacts_perfil(sid, "egresados")$enlace_url))
  expect_true(is.na(.cmail_no_store_resumen()$enlace_url))
  url <- "https://es.surveymonkey.com/r/ABC?lang=es"
  collection_mail_enlace_put(sid, "egresados", url)
  l <- collection_mail_contacts_list(sid, "egresados")
  expect_identical(l$resumen$enlace_url, url)
  expect_identical(collection_mail_contacts_perfil(sid, "egresados")$enlace_url, url)
  expect_false("enlace_encuesta" %in% vapply(l$columnas, `[[`, "", "key"))
  expect_false("enlace_encuesta" %in% names(l$rows[[1]]$valores))
  expect_true(l$rows[[1]]$tiene_enlace)
  # La URL cruda no aparece en la lista fuera del resumen.
  expect_false(any(grepl("t=", unlist(l$rows), fixed = TRUE)))
  # Buscar por el token no encuentra a nadie: la URL no es un valor de la lista.
  tok <- .cct_tokens(sid)[["ana@ejemplo.org"]]
  expect_identical(collection_mail_contacts_list(sid, "egresados", q = tok)$total, 0L)
  # Serializado: enlace_url sale como cadena y, sin enlace, como null.
  js <- jsonlite::toJSON(l$resumen, auto_unbox = TRUE, na = "null")
  expect_match(as.character(js), '"enlace_url":"https://es.surveymonkey.com/r/ABC?lang=es"', fixed = TRUE)
  expect_match(as.character(jsonlite::toJSON(l0$resumen, auto_unbox = TRUE, na = "null")), '"enlace_url":null', fixed = TRUE)
})

test_that("tokens: fuente aleatoria sin colisiones contra los ya emitidos", {
  taken <- .cmail_token_new(2000L)
  more <- .cmail_token_new(2000L, taken = taken)
  expect_length(unique(c(taken, more)), 4000L)
  expect_true(all(grepl("^[A-Za-z0-9]{10}$", more)))
})

test_that("tablero: agregados cuadran con la base del corte, orden por n, cruce y control guardado", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  rev0 <- .cct_srev(sid)
  ctl <- collection_mail_contacts_control_put(sid, "egresados", list("Carrera", "Sede"))
  expect_identical(ctl$control, list("Carrera", "Sede"))
  # Clave de servidor: no sube state_revision; solo nombres de columna.
  expect_identical(.cct_srev(sid), rev0)
  expect_identical(session_get(sid)$collection_state$mail_campaigns$campaigns[[1]]$contact_control,
                   list("Carrera", "Sede"))
  p <- collection_mail_contacts_perfil(sid, "egresados")
  expect_identical(p$base, 5L)
  expect_identical(p$control, list("Carrera", "Sede"))
  expect_setequal(vapply(p$candidatas, `[[`, "", "key"), c("Carrera", "Sexo", "Sede"))
  for (v in p$variables) {
    expect_identical(sum(vapply(v$categorias, `[[`, 0L, "n")) + v$sin_dato$n, p$base, info = v$key)
  }
  car <- p$variables[[1]]
  expect_identical(vapply(car$categorias, `[[`, "", "valor"), c("Economía", "Sociología", "Derecho"))
  expect_identical(vapply(car$categorias, `[[`, 0L, "n"), c(2L, 2L, 1L))
  expect_equal(car$categorias[[1]]$pct, 40)
  sede <- p$variables[[2]]
  expect_identical(sede$sin_dato$n, 2L)   # vacío y «NA»

  # Filtros aplican a todo el tablero.
  pf <- collection_mail_contacts_perfil(sid, "egresados", filtros = '{"Sexo":["F"]}', cruce = "Carrera,Sexo")
  expect_identical(pf$base, 3L)
  for (v in pf$variables) expect_identical(sum(vapply(v$categorias, `[[`, 0L, "n")) + v$sin_dato$n, 3L)
  expect_identical(sum(unlist(pf$cruce$celdas)), 3L)
  pc <- collection_mail_contacts_perfil(sid, "egresados", cruce = "Carrera,Sede")
  expect_identical(sum(unlist(pc$cruce$celdas)), 5L)
  expect_true(is.na(pc$cruce$columnas[[length(pc$cruce$columnas)]]))   # sin dato al final, como null
  expect_identical(.cct_code(collection_mail_contacts_perfil(sid, "egresados", cruce = "Carrera")),
                   "E_COLLECTION_MAIL_CONTACTS_QUERY")
  expect_identical(.cct_code(collection_mail_contacts_perfil(sid, "egresados", cruce = "Carrera,Correo")),
                   "E_COLLECTION_MAIL_CONTACTS_QUERY")
  expect_identical(.cct_code(collection_mail_contacts_control_put(sid, "egresados", list("Correo"))),
                   "E_COLLECTION_MAIL_CONTACTS_CONTROL")
  expect_identical(.cct_code(collection_mail_contacts_control_put(sid, "egresados", list(1L))),
                   "E_COLLECTION_MAIL_CONTACTS_CONTROL")
})

test_that("tablero: más de 30 valores es «muchas»; elegida, top 30 + Otros y sigue cuadrando", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  n <- 40L
  csv <- paste(c("Nombre,Correo,Colegio",
                 sprintf("P%d,p%d@ejemplo.org,C%02d", seq_len(n), seq_len(n), c(1L, 1L, seq_len(n - 2L)))),
               collapse = "\n")
  .cct_import(sid, csv)
  p <- collection_mail_contacts_perfil(sid, "egresados")
  expect_identical(p$candidatas[[1]]$tipo, "muchas")
  expect_identical(p$candidatas[[1]]$distintos, 38L)
  collection_mail_contacts_control_put(sid, "egresados", list("Colegio"))
  v <- collection_mail_contacts_perfil(sid, "egresados")$variables[[1]]
  expect_length(v$categorias, 31L)
  expect_identical(v$categorias[[1]]$valor, "C01")
  expect_identical(v$categorias[[1]]$n, 3L)
  expect_true(isTRUE(v$categorias[[31]]$otros))
  expect_identical(v$categorias[[31]]$valor, "Otros")
  expect_identical(sum(vapply(v$categorias, `[[`, 0L, "n")) + v$sin_dato$n, n)
})

.cct_responses <- function(tokens_completed, tokens_partial = character(0)) {
  r <- function(status, t) list(response_status = status, custom_variables = list(t = t))
  list(data = c(lapply(tokens_completed, function(t) r("completed", t)),
                lapply(tokens_partial, function(t) r("partial", t))))
}

test_that("quién respondió: solo marcar sin Mailchimp guarda la marca y el tablero da la tasa por categoría", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")
  tok <- .cct_tokens(sid)
  local_mocked_bindings(
    .connections_token_require = function(provider, ...) {
      if (identical(provider, "mailchimp")) stop("no debía pedir la clave de Mailchimp")
      "sm-token"
    },
    sm_api_fetch_all_responses_bulk = function(...) .cct_responses(tok[c("ana@ejemplo.org", "carlos@ejemplo.org")],
                                                                   tok[["luz@ejemplo.org"]]),
    .mc_http = function(...) stop("no debía llamar a Mailchimp")
  )
  out <- collection_mail_mailchimp_sync(sid, "egresados", survey_id = "1", list_id = "", dry_run = TRUE)
  expect_identical(out$marcados, 2L)
  expect_null(out$respondent_tokens)
  expect_false(any(grepl("@", unlist(out))))
  store <- .cmail_recipients_load(session_get(sid), "egresados")
  expect_identical(sum(store$respondio), 2L)
  expect_setequal(names(store$respondio_en), c("ana@ejemplo.org", "carlos@ejemplo.org"))
  expect_false(is.null(store$lectura$leido_en))

  l <- collection_mail_contacts_list(sid, "egresados")
  expect_identical(l$resumen$respondieron, 2L)
  expect_false(is.na(l$resumen$leido_en))
  expect_identical(l$rows[[1]]$respondio, TRUE)
  expect_identical(l$rows[[3]]$respondio, FALSE)   # parcial no cuenta
  expect_true(is.na(l$rows[[6]]$respondio))        # sin correo: sin token, no se cruza
  expect_identical(collection_mail_contacts_list(sid, "egresados", respondio = "si")$total, 2L)
  expect_identical(collection_mail_contacts_list(sid, "egresados", respondio = "no")$total, 3L)

  collection_mail_contacts_control_put(sid, "egresados", list("Carrera"))
  p <- collection_mail_contacts_perfil(sid, "egresados")
  expect_true(p$respuestas_leidas)
  car <- stats::setNames(p$variables[[1]]$categorias, vapply(p$variables[[1]]$categorias, `[[`, "", "valor"))
  expect_identical(car$Sociología$respondieron, 1L)
  expect_equal(car$Sociología$tasa, 50)
  expect_identical(car$Economía$respondieron, 1L)
  expect_identical(car$Derecho$respondieron, 0L)
  expect_equal(car$Derecho$tasa, 0)

  # Una segunda lectura es una foto nueva y conserva cuándo se vio la primera respuesta.
  first <- store$respondio_en[["ana@ejemplo.org"]]
  .cmail_respuestas_apply(sid, "egresados", tok[["ana@ejemplo.org"]], leido_en = "2026-11-01T00:00:00Z")
  store <- .cmail_recipients_load(session_get(sid), "egresados")
  expect_identical(sum(store$respondio), 1L)
  expect_identical(store$respondio_en[["ana@ejemplo.org"]], first)
  expect_identical(store$lectura$leido_en, "2026-11-01T00:00:00Z")
})

test_that("job: on_complete aplica la marca en el proceso de la API y quita los tokens del resultado", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")
  tok <- .cct_tokens(sid)
  hook <- .mc_sync_mark_hook(sid, "egresados", "528")
  # El closure no arrastra claves ni el índice de correos.
  expect_setequal(ls(environment(hook)), c("sid", "campaign_id", "survey_id", "ctx"))
  pub <- hook(list(result_data = list(ok = TRUE, respondents = 1L, respondent_tokens = tok[["maria@ejemplo.org"]])))
  expect_identical(pub$marcados, 1L)
  expect_null(pub$respondent_tokens)
  expect_true(.cmail_recipients_load(session_get(sid), "egresados")$respondio[["maria@ejemplo.org"]])
  err <- list(ok = FALSE, error = list(code = "E_INTERNAL"))
  expect_identical(hook(list(result_data = err)), err)
})

test_that("ida y vuelta: guardar → abrir devuelve filas, mapeo, tokens, marcas y control; state.rds sin correos", {
  skip_if_not_installed("zip")
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/ABC")
  tok <- .cct_tokens(sid)
  .cmail_respuestas_apply(sid, "egresados", tok[["luz@ejemplo.org"]], survey_id = "528")
  collection_mail_contacts_control_put(sid, "egresados", list("Sexo"))
  before <- .cmail_recipients_load(session_get(sid), "egresados")
  expect_identical(project_status(sid)$contactos_campanas, 1L)

  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  saved <- build_pulso(sid, tmp, project_name = "Contactos")
  expect_identical(saved$contactos_campanas, 1L)
  entries <- zip::zip_list(tmp)$filename
  expect_true("files/contactos/egresados.rds" %in% entries)

  ex <- tempfile("pulso-scan-"); on.exit(unlink(ex, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(tmp, exdir = ex)
  manifest <- jsonlite::fromJSON(file.path(ex, "manifest.json"), simplifyVector = FALSE)
  expect_identical(manifest$contactos[[1]]$sensitivity, "personal_data")
  expect_identical(manifest$contactos[[1]]$path, "files/contactos/egresados.rds")
  expect_identical(manifest$contactos[[1]]$rows, 8L)
  # Correos SOLO en files/contactos/: ni state.rds ni manifest.
  scan <- function(f) {
    if (grepl("\\.rds$", f)) paste(utils::capture.output(str(readRDS(f), list.len = 1e5, nchar.max = 1e5)), collapse = "\n")
    else { b <- readBin(f, "raw", file.info(f)$size); rawToChar(b[b != as.raw(0)]) }
  }
  with_mail <- character(0)
  for (f in list.files(ex, recursive = TRUE, full.names = TRUE)) {
    if (grepl("ejemplo.org|QUISPE|PAREDES", scan(f), useBytes = TRUE)) with_mail <- c(with_mail, sub(paste0(ex, "/"), "", f, fixed = TRUE))
  }
  expect_identical(with_mail, "files/contactos/egresados.rds")
  expect_false(grepl("@", paste(readLines(file.path(ex, "manifest.json")), collapse = "")))

  loaded <- load_pulso(tmp); on.exit(session_delete(loaded$session_id), add = TRUE)
  lsid <- loaded$session_id
  after <- .cmail_recipients_load(session_get(lsid), "egresados")
  for (k in c("rows", "mapping", "tokens", "enlace", "respondio", "respondio_en", "lectura", "source_row",
              "source_sha256", "file_name")) {
    expect_identical(after[[k]], before[[k]], info = k)
  }
  expect_false(isTRUE(session_get(lsid)$project_dirty))
  expect_true(collection_mail_campaigns_get(lsid)$campaigns[[1]]$recipients_loaded)
  expect_identical(collection_mail_contacts_perfil(lsid, "egresados")$control, list("Sexo"))
  expect_identical(collection_mail_contacts_list(lsid, "egresados")$resumen$respondieron, 1L)

  # Toda mutación en un proyecto abierto marca dirty, sin subir state_revision.
  rev <- .cct_srev(lsid)
  collection_mail_contacts_control_put(lsid, "egresados", list("Sexo", "Sede"))
  expect_true(isTRUE(session_get(lsid)$project_dirty))
  expect_identical(.cct_srev(lsid), rev)
  for (mutate in list(
    function() collection_mail_enlace_put(lsid, "egresados", "https://es.surveymonkey.com/r/XYZ"),
    function() .cct_import(lsid),
    function() collection_mail_recipients_mapping_put(lsid, after$mapping, "egresados"),
    function() .cmail_respuestas_apply(lsid, "egresados", character(0)),
    function() collection_mail_recipients_delete(lsid, "egresados")
  )) {
    s <- session_get(lsid); s$project_dirty <- FALSE; .session_env[[lsid]] <- s
    mutate()
    expect_true(isTRUE(session_get(lsid)$project_dirty))
  }
  # Quitar los contactos los saca del próximo .pulso.
  tmp2 <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp2, force = TRUE), add = TRUE)
  expect_identical(build_pulso(lsid, tmp2)$contactos_campanas, 0L)
  expect_false(any(grepl("^files/contactos/", zip::zip_list(tmp2)$filename)))
})

test_that("pasar a SurveyMonkey ya no purga la lista; borrar la campaña sí", {
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  m <- collection_mail_campaign_meta_put(sid, .cct_srev(sid), "egresados", platform = "surveymonkey")
  expect_false(m$recipients_purged)
  expect_true(collection_mail_recipients_get(sid, "egresados")$loaded)
  d <- collection_mail_campaign_delete(sid, .cct_srev(sid), "egresados", confirm_name = "Egresados")
  expect_true(d$recipients_purged)
})

test_that("anonimizador vacía files/contactos/ y el detector lo exige", {
  skip_if_not_installed("zip")
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  tmp <- tempfile(fileext = ".pulso"); on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp, project_name = "Anon")
  h <- pulso_detectar_pii(tmp)
  expect_true("contactos" %in% h$tipo)
  out <- tempfile(fileext = ".pulso"); on.exit(unlink(out, force = TRUE), add = TRUE)
  rep <- pulso_anonimizar_archivo(tmp, out, sal = "sal-de-prueba", slug = "anon")
  expect_identical(rep$contactos_retirados, 1L)
  expect_false(any(grepl("contactos", zip::zip_list(out)$filename)))
  expect_false("contactos" %in% pulso_detectar_pii(out)$tipo)
  ex <- tempfile("anon-"); on.exit(unlink(ex, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(out, exdir = ex)
  expect_null(jsonlite::fromJSON(file.path(ex, "manifest.json"), simplifyVector = FALSE)$contactos)
})

test_that("HTTP: contrato de las cuatro rutas con el serializador de producción", {
  testthat::skip_if_not_installed("plumber")
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  call_q <- function(path, query) {
    req <- as.environment(list(
      REQUEST_METHOD = "GET", PATH_INFO = path, QUERY_STRING = query, CONTENT_TYPE = "application/json",
      HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
      rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) "")
    ))
    r <- pr$call(req)
    list(status = as.integer(r$status), raw = as.character(r$body),
         body = jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE))
  }
  e <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-contacts/enlace",
                      .cmail_fx_json(list(campaign_id = "egresados", url = "https://es.surveymonkey.com/r/ABC")))
  expect_identical(e$status, 200L, info = e$raw)
  expect_identical(e$body$generados, 5L)
  expect_identical(e$body$campo, "enlace_encuesta")
  bad <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-contacts/enlace",
                        .cmail_fx_json(list(campaign_id = "egresados", url = "http://x.org")))
  expect_identical(bad$status, 422L)
  expect_identical(unlist(bad$body$error$code), "E_COLLECTION_MAIL_ENLACE_URL")

  c1 <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-contacts/control",
                       .cmail_fx_json(list(campaign_id = "egresados", variables = list("Carrera"))))
  expect_identical(c1$status, 200L, info = c1$raw)
  expect_identical(c1$body$control, list("Carrera"))

  filtros <- utils::URLencode('{"Sexo":["F"]}', reserved = TRUE)
  l <- call_q("/api/recopiladores/mail-contacts",
              paste0("campaign_id=egresados&estado=efectivo&per_page=2&page=1&filtros=", filtros))
  expect_identical(l$status, 200L, info = l$raw)
  expect_identical(l$body$total, 3L)
  expect_length(l$body$rows, 2L)
  expect_identical(l$body$rows[[1]]$email, "ana@ejemplo.org")
  expect_null(l$body$rows[[1]]$respondio)
  expect_true(isTRUE(l$body$rows[[1]]$tiene_enlace))
  expect_setequal(names(l$body$resumen), c("importados", "efectivos", "sin_correo", "correo_invalido", "repetidos",
                                           "con_enlace", "respondieron", "leido_en", "enlace_url"))
  expect_null(l$body$resumen$respondieron)
  expect_identical(l$body$resumen$enlace_url, "https://es.surveymonkey.com/r/ABC")
  expect_false("enlace_encuesta" %in% vapply(l$body$columnas, function(c) c$key, ""))
  expect_identical(vapply(l$body$columnas, function(c) c$label, ""), c("Carrera", "Sexo", "Sede"))
  q <- call_q("/api/recopiladores/mail-contacts", "campaign_id=egresados&estado=nada")
  expect_identical(q$status, 422L)

  p <- call_q("/api/recopiladores/mail-contacts/perfil",
              paste0("campaign_id=egresados&cruce=", utils::URLencode("Carrera,Sexo", reserved = TRUE)))
  expect_identical(p$status, 200L, info = p$raw)
  expect_identical(p$body$base, 5L)
  expect_identical(p$body$control, list("Carrera"))
  expect_identical(p$body$variables[[1]]$sin_dato$n, 0L)
  expect_identical(sum(unlist(p$body$cruce$celdas)), 5L)
  expect_false(p$body$respuestas_leidas)
  expect_identical(p$body$enlace_url, "https://es.surveymonkey.com/r/ABC")
  expect_identical(p$body$cruce$a_label, "Carrera")
  p0 <- call_q("/api/recopiladores/mail-contacts/perfil", "campaign_id=egresados")
  expect_null(p0$body$cruce)
})

test_that("modo público: ninguna ruta de contactos responde y el engine también se niega", {
  testthat::skip_if_not_installed("plumber")
  sid <- .cct_session(); on.exit(session_delete(sid), add = TRUE)
  .cct_import(sid)
  withr::local_envvar(PULSO_PUBLIC_MODE = "1")
  pr <- suppressMessages(apply_public_mode_filter(
    mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  ))
  for (rt in list(c("GET", "/api/recopiladores/mail-contacts"), c("GET", "/api/recopiladores/mail-contacts/perfil"),
                  c("PUT", "/api/recopiladores/mail-contacts/control"), c("PUT", "/api/recopiladores/mail-contacts/enlace"))) {
    r <- .cmail_fx_call(pr, sid, rt[[1]], rt[[2]], .cmail_fx_json(list(campaign_id = "egresados")))
    expect_identical(r$status, 403L, info = rt[[2]])
    expect_identical(unlist(r$body$error$code), "E_FORBIDDEN_PUBLIC")
  }
  expect_identical(.cct_code(collection_mail_contacts_list(sid, "egresados")), "E_PUBLIC_MODE")
  expect_identical(.cct_code(collection_mail_contacts_perfil(sid, "egresados")), "E_PUBLIC_MODE")
  expect_identical(.cct_code(collection_mail_enlace_put(sid, "egresados", "https://es.surveymonkey.com/r/A")),
                   "E_PUBLIC_MODE")
  expect_identical(.cct_code(collection_mail_contacts_control_put(sid, "egresados", list())), "E_PUBLIC_MODE")
})
