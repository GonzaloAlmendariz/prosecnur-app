# Saludo por sexo (pedido 2026-10-20: «¿Podemos hacer que este estimado pase a
# estimado o estimada?»; decisión: «columna de sexo, la app traduce»).
# collection_mail_trato.R. Fixtures sintéticos: nombres y correos inventados.

.cmt_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmt_code <- function(expr) { e <- .cmt_err(expr); if (is.null(e)) NA_character_ else e$code }
.cmt_by <- function(r) setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
.cmt_rev <- function(sid) collection_mail_campaigns_get(sid)$state_revision
.cmt_problems <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "code")

# Lista guardada por Excel en Windows (CP1252): 3 M, 2 F y 1 vacío.
.cmt_csv_mf <- function() paste(
  "Nombre;Correo;Sexo;Carrera;Código;Enlace",
  "Ana Muñoz;ana@ejemplo.org;F;Sociología;1;https://ejemplo.org/e/1",
  "Luis Peña;luis@ejemplo.org;M;Economía;2;https://ejemplo.org/e/2",
  "José Ríos;jose@ejemplo.org;m;Derecho;3;https://ejemplo.org/e/3",
  "Carlos Díaz;carlos@ejemplo.org;M;Historia;4;https://ejemplo.org/e/4",
  "Lucía Soto;lucia@ejemplo.org;f;Física;5;https://ejemplo.org/e/5",
  "Noel Quispe;noel@ejemplo.org;;Química;6;https://ejemplo.org/e/6",
  sep = "\r\n"
)
.cmt_cp1252 <- function(txt) iconv(txt, from = "UTF-8", to = "windows-1252", toRaw = TRUE)[[1]]

.cmt_import <- function(sid, csv = .cmt_csv_mf(), campaign_id = NULL) {
  collection_mail_recipients_import(sid, file_raw = .cmt_cp1252(csv), file_name = "lista.csv", campaign_id = campaign_id)
}

# Plantilla de la campaña con el trato por sexo leyendo `columna`.
.cmt_with_column <- function(t, columna = "Sexo") {
  t$blocks[[1]]$trato$columna <- columna
  t
}

.cmt_unzip <- function(sid, ex) {
  dir <- tempfile("cmt-")
  zip::unzip(session_get(sid)$files[[ex$zip$file_id]]$path, exdir = dir)
  dir
}
.cmt_read <- function(path) paste(readLines(path, encoding = "UTF-8", warn = FALSE), collapse = "\n")

test_that("lectura del sexo: mapa cerrado y «M» decidida por el conjunto de la columna", {
  # M/F: M es masculino.
  mf <- .cmail_sexo_classify(c("M", "F", "m", "M", "f", ""))
  expect_identical(mf$lectura, "m_f")
  expect_identical(mf$sexo, c("masculino", "femenino", "masculino", "masculino", "femenino", "sin_dato"))
  # H/M: M es mujer.
  hm <- .cmail_sexo_classify(c("H", "M", "M", "h", "Mujer"))
  expect_identical(hm$lectura, "h_m")
  expect_identical(hm$sexo, c("masculino", "femenino", "femenino", "masculino", "femenino"))
  # H, M y F a la vez: M no se puede leer.
  amb <- .cmail_sexo_classify(c("H", "F", "M"))
  expect_identical(amb$lectura, "m_ambigua")
  expect_identical(amb$sexo, c("masculino", "femenino", "no_reconocido"))
  # Valores raros: palabras completas, tildes, mayúsculas, espacios, inglés y marcadores de vacío.
  raros <- .cmail_sexo_classify(c("Masculino", "FEMENINO", " varón ", "Female", "Male", "X", "Otro", "M", "N/A", "Hombre", "M."))
  expect_identical(raros$lectura, "m_ambigua")
  expect_identical(raros$sexo, c("masculino", "femenino", "masculino", "femenino", "masculino", "no_reconocido",
                                 "no_reconocido", "no_reconocido", "sin_dato", "masculino", "no_reconocido"))
  expect_identical(.cmail_sexo_classify(c("Hombre", "Mujer"))$lectura, "sin_m")
})

test_that("contrato: trato válido en el preset, problemas cerrados y etiqueta SALUDO reservada", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  expect_identical(t$blocks[[1]]$trato, list(modo = "por_sexo", masculino = "Estimado", femenino = "Estimada", respaldo = "Estimado(a)"))
  expect_true(collection_mail_template_validate(t)$ok)
  # Las palabras que faltan se completan al normalizar.
  t2 <- t; t2$blocks[[1]]$trato <- list(modo = "por_sexo", columna = " Sexo ")
  n2 <- .cmail_template_normalize(t2)$blocks[[1]]$trato
  expect_identical(n2, list(modo = "por_sexo", columna = "Sexo", masculino = "Estimado", femenino = "Estimada", respaldo = "Estimado(a)"))
  bad <- t; bad$blocks[[1]]$trato <- list(modo = "otro", masculino = "{{nombre}}", femenino = "<b>x</b>", sm = "CustomData1", extra = "y")
  bad$fields[[1]]$sm <- "CustomData1"
  expect_setequal(.cmt_problems(bad), c("unknown_key", "bad_trato_mode", "trato_has_field", "html_not_allowed", "duplicate_sm"))
  taken <- t; taken$fields[[2]]$tag <- "SALUDO"
  expect_identical(.cmt_problems(taken), "trato_tag_taken")
  fijo <- t; fijo$blocks[[1]]$trato$modo <- "fijo"; fijo$fields[[2]]$tag <- "SALUDO"
  expect_true(collection_mail_template_validate(.cmail_template_normalize(fijo))$ok)
})

test_that("paridad: sin columna (o en fijo) el HTML de Mailchimp es el de siempre, byte a byte", {
  fx <- jsonlite::fromJSON(.cmail_fx_mail_import_path("paridad-mailchimp-sha256.json"), simplifyVector = FALSE)
  for (id in c("recuperacion", "invitacion")) {
    t <- .cmail_template_normalize(if (id == "recuperacion") .cmail_preset_recuperacion() else .cmail_preset_invitacion())
    expect_identical(t$blocks[[1]]$trato$modo, "por_sexo")
    expect_identical(.cmail_fx_sha(collection_mail_render(t, "export")$html), fx$sha256[[id]], label = id)
    sin <- t; sin$blocks[[1]]$trato <- NULL
    expect_identical(collection_mail_render(sin, "export")$html, collection_mail_render(t, "export")$html)
    fijo <- .cmt_with_column(t); fijo$blocks[[1]]$trato$modo <- "fijo"
    expect_identical(.cmail_fx_sha(collection_mail_render(fijo, "export")$html), fx$sha256[[id]], label = paste(id, "fijo"))
    expect_identical(.cmail_fx_sha(collection_mail_render(t, "preview", values = fx$preview_values)$html), fx$preview_sha256[[id]])
  }
})

test_that("render: Mailchimp *|IF:SALUDO|* con respaldo; SurveyMonkey [CustomDataN] primero libre; preview por persona", {
  t <- .cmt_with_column(.cmail_template_normalize(.cmail_preset_recuperacion()))
  mc <- collection_mail_render(t, "export", "mailchimp")$html
  cond <- "*|IF:SALUDO|**|SALUDO|**|ELSE:|*Estimado(a)*|END:IF|*"
  expect_match(mc, sprintf("*|IF:FNAME|*%s *|FNAME|*:*|ELSE:|*%s estudiante:*|END:IF|*", cond, cond), fixed = TRUE)
  t$fields[[1]]$sm <- "CustomData1"; t$fields[[2]]$sm <- "CustomData2"
  sm <- collection_mail_render(t, "export", "surveymonkey")$html
  expect_match(sm, "[CustomData3] [FirstName]:", fixed = TRUE)
  t$blocks[[1]]$trato$sm <- "CustomData5"
  expect_match(collection_mail_render(t, "export", "surveymonkey")$html, "[CustomData5] [FirstName]:", fixed = TRUE)
  pv <- .cmail_fx_unmark(collection_mail_render(t, "preview", values = list(nombre = "Ana", trato = "Estimada"))$html)
  expect_match(pv, "Estimada Ana:", fixed = TRUE)
  pv0 <- .cmail_fx_unmark(collection_mail_render(t, "preview", values = list(nombre = "Ana"))$html)
  expect_match(pv0, "Estimado(a) Ana:", fixed = TRUE)
})

test_that("Mailchimp: lista CP1252 M/F -> revisión con cifras, audiencia.csv con SALUDO, LEEME, manifest y «Ver como»", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_mail_template_get(sid)$template
  # Sin columna declarada: aviso, no error.
  r0 <- .cmt_by(collection_mail_review(sid, scope = "plantilla"))
  expect_identical(r0$greeting_trato$status, "warning")
  expect_identical(r0$greeting_trato$detail, "El saludo dirá «Estimado(a)» a todos: declara la columna de sexo.")
  expect_identical(r0$greeting_trato$targets[[1]], list(block_id = "saludo", prop = "trato"))

  p <- collection_mail_template_put(sid, .cmt_with_column(t), .cmail_fx_rev(sid))
  imp <- .cmt_import(sid)
  expect_identical(imp$encoding, "windows-1252")
  expect_identical(imp$counts$valid, 6L)
  expect_identical(imp$trato$lectura, "m_f")
  expect_identical(imp$trato$counts, list(efectivos = 6L, masculino = 3L, femenino = 2L, sin_dato = 1L, no_reconocido = 0L))
  expect_identical(vapply(imp$sample, function(s) s$trato, ""), c("Estimada", "Estimado", "Estimado", "Estimado", "Estimada"))

  r <- .cmt_by(collection_mail_review(sid))
  expect_identical(r$greeting_trato$status, "warning")
  expect_identical(r$greeting_trato$value, 1L)
  expect_identical(r$greeting_trato$detail, paste0(
    "1 de 6 destinatarios recibirán «Estimado(a)»: 1 sin dato y 0 con un valor que no se reconoce. ",
    "«Estimado» a 3 y «Estimada» a 2 (la columna trae M y F: M se lee como masculino)."))

  # «Ver como»: la persona 2 (Luis, M) y la 6 (Noel, sin dato).
  v2 <- collection_mail_preview(sid, recipient_index = 2L)
  expect_identical(v2$recipient$trato, "Estimado")
  expect_match(.cmail_fx_unmark(v2$html), "Estimado Luis Peña:", fixed = TRUE)
  v6 <- collection_mail_preview(sid, recipient_index = 6L)
  expect_identical(v6$recipient$trato, "Estimado(a)")
  expect_match(.cmail_fx_unmark(collection_mail_preview(sid, recipient_index = 1L)$html), "Estimada Ana Muñoz:", fixed = TRUE)
  # La persona de ejemplo (sin lista elegida) lleva el respaldo.
  expect_match(.cmail_fx_unmark(collection_mail_preview(sid)$html), "Estimado(a) Ana:", fixed = TRUE)

  ex <- collection_mail_export(sid, .cmail_fx_rev(sid))
  dir <- .cmt_unzip(sid, ex); on.exit(unlink(dir, recursive = TRUE), add = TRUE)
  aud <- utils::read.csv(file.path(dir, "audiencia.csv"), colClasses = "character", check.names = FALSE, encoding = "UTF-8")
  expect_identical(names(aud), c("Email Address", "First Name", "CARRERA", "ENLACE", "SALUDO"))
  expect_identical(aud$SALUDO, c("Estimada", "Estimado", "Estimado", "Estimado", "Estimada", "Estimado(a)"))
  expect_identical(aud$`First Name`, c("Ana Muñoz", "Luis Peña", "José Ríos", "Carlos Díaz", "Lucía Soto", "Noel Quispe"))
  leeme <- .cmt_read(file.path(dir, "LEEME.txt"))
  expect_match(leeme, "La columna SALUDO trae el saludo de cada persona según la columna «Sexo»: «Estimado» 3, «Estimada» 2 y «Estimado(a)» 1 (1 sin dato, 0 con un valor que no se reconoce)", fixed = TRUE)
  man <- jsonlite::fromJSON(file.path(dir, "manifest.json"), simplifyVector = FALSE)
  expect_identical(man$trato$emitido, "merge_tag")
  expect_identical(man$trato$etiqueta, "*|SALUDO|*")
  expect_identical(man$trato$counts$masculino, 3L)
  expect_identical(unlist(man$audience_columns), names(aud))
  # La audiencia trae SALUDO y nombre de pila para los seis: el saludo del HTML
  # importable sale plano, sin condicionales que el editor de Mailchimp muestra
  # crudas (prueba real 2026-10-21). El estado no lleva el sexo de nadie.
  zip::unzip(file.path(dir, "plantilla-mailchimp.zip"), exdir = file.path(dir, "imp"))
  html <- .cmt_read(list.files(file.path(dir, "imp"), pattern = "\\.html$", full.names = TRUE)[[1]])
  expect_match(html, "*|SALUDO|* *|FNAME|*:", fixed = TRUE)
  expect_false(grepl("*|IF:", html, fixed = TRUE))
  expect_match(leeme, "MMERGE", fixed = TRUE)
  expect_match(leeme, "etiqueta *|SALUDO|*", fixed = TRUE)
  # Del trato solo persiste el nombre de la columna; ningún correo, nombre ni sexo de una persona.
  state <- unlist(session_get(sid)$collection_state, use.names = FALSE)
  expect_false(any(c("ana@ejemplo.org", "Ana Muñoz", "Noel Quispe") %in% state))
  expect_identical(collection_mail_template_get(sid)$template$blocks[[1]]$trato$columna, "Sexo")
  expect_false(any(vapply(session_get(sid)$collection_state, function(x) any(grepl("ejemplo.org", unlist(x), fixed = TRUE)), NA)))
})

test_that("H/M: M se lee mujer; columna que no está en la lista -> error con destino al saludo", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_mail_template_get(sid)$template
  collection_mail_template_put(sid, .cmt_with_column(t, "Género"), .cmail_fx_rev(sid))
  hm <- paste("Nombre;Correo;Género;Carrera;Código;Enlace",
              "Ana;ana@ejemplo.org;M;S;1;https://e.org/1", "Luis;luis@ejemplo.org;H;S;2;https://e.org/2",
              "Rosa;rosa@ejemplo.org;M;S;3;https://e.org/3", "Iván;ivan@ejemplo.org;Otro;S;4;https://e.org/4", sep = "\n")
  imp <- .cmt_import(sid, hm)
  expect_identical(imp$trato$lectura, "h_m")
  expect_identical(imp$trato$counts, list(efectivos = 4L, masculino = 1L, femenino = 2L, sin_dato = 0L, no_reconocido = 1L))
  expect_identical(unlist(imp$trato$no_reconocidos), "Otro")
  r <- .cmt_by(collection_mail_review(sid))
  expect_identical(r$greeting_trato$value, 1L)
  expect_match(r$greeting_trato$detail, "(la columna trae H y M: M se lee como mujer)", fixed = TRUE)

  t2 <- collection_mail_template_get(sid)$template
  collection_mail_template_put(sid, .cmt_with_column(t2, "Sexo"), .cmail_fx_rev(sid))
  r2 <- collection_mail_review(sid)
  by <- .cmt_by(r2)
  expect_identical(by$greeting_trato$status, "error")
  expect_identical(by$greeting_trato$detail, "La columna «Sexo» del saludo no está en la lista importada: elige la columna de sexo de esta lista.")
  expect_identical(by$greeting_trato$targets[[1]], list(block_id = "saludo", prop = "trato"))
  expect_false(r2$ready)
  expect_identical(.cmt_code(collection_mail_export(sid, .cmail_fx_rev(sid))), "E_COLLECTION_MAIL_REVIEW_BLOCKING")
  # Sin la lista (scope plantilla) la columna no se contrasta.
  expect_identical(.cmt_by(collection_mail_review(sid, scope = "plantilla"))$greeting_trato$status, "ok")
})

test_that("SurveyMonkey: con la lista, contactos_surveymonkey.csv con CustomDataN; sin lista, el LEEME dice qué llenar", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  c <- collection_mail_campaign_create(sid, .cmt_rev(sid), name = "Conta", platform = "surveymonkey")
  t <- c$campaign$template
  t$images$`logo-cliente`$url <- "https://pulsopucp.github.io/correo-/logo-cliente.png"
  t$images$pulso$url <- "https://pulsopucp.github.io/correo-/pulso.png"
  t$fields[[1]]$sm <- "CustomData1"; t$fields[[2]]$sm <- "CustomData2"
  collection_mail_template_put(sid, .cmt_with_column(t), .cmt_rev(sid), campaign_id = "conta")

  # Sin lista: alcance plantilla, aviso sm_trato_blank y LEEME con los valores.
  r0 <- collection_mail_review(sid, campaign_id = "conta")
  expect_identical(r0$scope, "plantilla")
  b0 <- .cmt_by(r0)
  expect_identical(b0$sm_trato_blank$status, "warning")
  expect_identical(unlist(b0$sm_trato_blank$items), c(sm = "CustomData3"))
  expect_identical(b0$greeting_trato$status, "ok")
  e0 <- collection_mail_export(sid, .cmt_rev(sid), "conta")
  expect_identical(e0$scope, "plantilla")
  d0 <- .cmt_unzip(sid, e0); on.exit(unlink(d0, recursive = TRUE), add = TRUE)
  expect_setequal(list.files(d0), c("conta-invitacion.html", "LEEME.txt", "manifest.json"))
  expect_match(.cmt_read(file.path(d0, "conta-invitacion.html")), "[CustomData3] [FirstName]:", fixed = TRUE)
  expect_match(.cmt_read(file.path(d0, "LEEME.txt")),
               "Llena [CustomData3] en cada contacto del recopilador con «Estimado» o «Estimada» (y «Estimado(a)» si no se sabe).", fixed = TRUE)
  expect_identical(.cmt_code(collection_mail_export(sid, .cmt_rev(sid), "conta", scope = "completo")), "E_COLLECTION_MAIL_PLATFORM")

  # Con lista: alcance completo por defecto y el CSV listo para el recopilador.
  .cmt_import(sid, campaign_id = "conta")
  r1 <- collection_mail_review(sid, campaign_id = "conta")
  expect_identical(r1$scope, "completo")
  b1 <- .cmt_by(r1)
  expect_identical(b1$recipients$status, "ok")
  expect_identical(b1$greeting_trato$value, 1L)
  ex <- collection_mail_export(sid, .cmt_rev(sid), "conta")
  expect_identical(ex$scope, "completo")
  expect_identical(unique(vapply(ex$artifacts, `[[`, "", "sensitivity")), "personal_data")
  d1 <- .cmt_unzip(sid, ex); on.exit(unlink(d1, recursive = TRUE), add = TRUE)
  expect_setequal(list.files(d1), c("conta-invitacion.html", "LEEME.txt", "manifest.json", "contactos_surveymonkey.csv"))
  raw <- readBin(file.path(d1, "contactos_surveymonkey.csv"), "raw", 4096L)
  csv <- utils::read.csv(text = rawToChar(raw), colClasses = "character", check.names = FALSE, encoding = "UTF-8")
  expect_identical(names(csv), c("Email", "FirstName", "CustomData1", "CustomData2", "CustomData3"))
  expect_identical(csv$CustomData3, c("Estimada", "Estimado", "Estimado", "Estimado", "Estimada", "Estimado(a)"))
  expect_identical(csv$Email[[1]], "ana@ejemplo.org")
  leeme <- .cmt_read(file.path(d1, "LEEME.txt"))
  expect_match(leeme, "Contactos: contactos_surveymonkey.csv trae a los 6 destinatarios de la lista (Email, FirstName, CustomData1, CustomData2, CustomData3).", fixed = TRUE)
  expect_match(leeme, "«Estimado» 3, «Estimada» 2 y «Estimado(a)» 1", fixed = TRUE)
  man <- jsonlite::fromJSON(file.path(d1, "manifest.json"), simplifyVector = FALSE)
  expect_identical(man$sensitivity, "personal_data")
  expect_identical(man$trato$etiqueta, "[CustomData3]")
  expect_false(grepl("@", jsonlite::toJSON(man), fixed = TRUE))
  # Plantilla explícita: sin datos personales, sin CSV.
  pl <- collection_mail_export(sid, .cmt_rev(sid), "conta", scope = "plantilla")
  expect_identical(unique(vapply(pl$artifacts, `[[`, "", "sensitivity")), "none")
})

test_that("SurveyMonkey: el trato cuenta para el límite de CustomData del plan", {
  t <- .cmt_with_column(.cmail_template_normalize(.cmail_preset_recuperacion()))
  t$fields[[1]]$sm <- "CustomData1"; t$fields[[2]]$sm <- "CustomData2"
  t$blocks[[1]]$trato$sm <- "CustomData9"
  checks <- list(); push <- function(x) checks[[length(checks) + 1L]] <<- x
  .cmail_sm_checks(t, collection_mail_render(t, "export", "surveymonkey")$html, push)
  lim <- Filter(function(x) x$code == "sm_custom_limit", checks)[[1]]
  expect_identical(lim$status, "warning")
  expect_identical(unlist(lim$items), "trato")
  expect_match(lim$detail, "(CustomData9)", fixed = TRUE)
  expect_identical(lim$targets[[1]], list(block_id = "saludo", prop = "trato"))
})

test_that("importador: «Estimado(a) [FirstName]» y «Estimado/a» pasan a trato por sexo sin columna, informado", {
  r <- .cmail_import_html_parse(charToRaw(enc2utf8(.cmail_fx_read_text(.cmail_fx_mail_import_path("contabilidad-reacreditacion.html")))))
  g <- r$template$blocks[[1]]
  expect_identical(g$text, "**Estimado(a) {{nombre}},**")
  expect_identical(g$trato, list(modo = "por_sexo", masculino = "Estimado", femenino = "Estimada", respaldo = "Estimado(a)"))
  rep <- Filter(function(x) x$code == "greeting_trato_detected", r$report)
  expect_length(rep, 1L)
  expect_identical(rep[[1]]$excerpt, "Estimado(a)")
  expect_identical(rep[[1]]$block_id, "saludo")
  # Guardado y con la columna declarada, en SurveyMonkey sale su CustomData (el enlace es SurveyLink: queda CustomData1).
  t <- .cmt_with_column(r$template)
  expect_true(collection_mail_template_validate(.cmail_template_normalize(t))$ok)
  expect_match(collection_mail_render(t, "export", "surveymonkey")$html, "<strong>[CustomData1] [FirstName],</strong>", fixed = TRUE)

  q <- .cmail_import_html_parse(charToRaw("<html><body><p>Querida/o [FirstName]:</p><p>Texto.</p></body></html>"))
  expect_identical(q$template$blocks[[1]]$trato, list(modo = "por_sexo", masculino = "Querido", femenino = "Querida", respaldo = "Querida/o"))
  # Sin palabra inclusiva no hay trato.
  h <- .cmail_import_html_parse(charToRaw("<html><body><p>Hola [FirstName]:</p><p>Texto.</p></body></html>"))
  expect_null(h$template$blocks[[1]]$trato)
  # Ida y vuelta: el condicional SALUDO que escribe la app se lee como el trato.
  mc <- collection_mail_render(.cmt_with_column(.cmail_template_normalize(.cmail_preset_recuperacion())), "export", "mailchimp")$html
  back <- .cmail_import_html_parse(charToRaw(mc))
  expect_identical(back$template$blocks[[1]]$text, "Estimado(a) {{nombre}}:")
  expect_identical(back$template$blocks[[1]]$trato$respaldo, "Estimado(a)")
  expect_null(back$template$blocks[[1]]$trato$columna)
})

test_that("revisión: un saludo sin la palabra del respaldo avisa que el trato no cambia nada", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_mail_template_get(sid)$template
  t$blocks[[1]]$text <- "Hola {{nombre}}:"
  t$blocks[[1]]$fallback <- "Hola:"
  w <- .cmt_by(collection_mail_review(sid, template = t, scope = "plantilla"))$greeting_trato_word
  expect_identical(w$status, "warning")
  expect_match(w$detail, "El saludo no contiene «Estimado(a)»", fixed = TRUE)
})

test_that("HTTP: PUT mail-template conserva el trato y la revisión lo lee", {
  testthat::skip_if_not_installed("plumber")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  t <- .cmt_with_column(collection_mail_template_get(sid)$template)
  t$blocks[[1]]$trato$femenino <- "Querida"
  put <- .cmail_fx_call(pr, sid, "PUT", "/api/recopiladores/mail-template",
                        .cmail_fx_json(list(template = t, expected_revision = .cmail_fx_rev(sid))))
  expect_identical(put$status, 200L, info = substr(put$raw, 1, 500))
  expect_identical(put$body$template$blocks[[1]]$trato,
                   list(modo = "por_sexo", masculino = "Estimado", femenino = "Querida", respaldo = "Estimado(a)", columna = "Sexo"))
  stored <- collection_mail_template_get(sid)$template$blocks[[1]]$trato
  expect_identical(stored$columna, "Sexo")
  rv <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/review", .cmail_fx_json(list(scope = "plantilla")))
  gt <- Filter(function(c) identical(c$code, "greeting_trato"), rv$body$checks)[[1]]
  expect_identical(gt$status, "ok")
  expect_match(gt$detail, "«Estimado» o «Querida» según la columna «Sexo»", fixed = TRUE)
})


test_that("Mailchimp: con alguien sin nombre de pila, el respaldo del nombre sigue y el saludo no se anida", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_mail_template_get(sid)$template
  collection_mail_template_put(sid, .cmt_with_column(t), .cmail_fx_rev(sid))
  sin_nombre <- paste("Nombre;Correo;Sexo;Carrera;Código;Enlace",
                      "Ana Muñoz;ana@ejemplo.org;F;Sociología;1;https://ejemplo.org/e/1",
                      ";nn@ejemplo.org;M;Economía;2;https://ejemplo.org/e/2", sep = "\r\n")
  .cmt_import(sid, sin_nombre)
  ex <- collection_mail_export(sid, .cmail_fx_rev(sid))
  dir <- .cmt_unzip(sid, ex); on.exit(unlink(dir, recursive = TRUE), add = TRUE)
  zip::unzip(file.path(dir, "plantilla-mailchimp.zip"), exdir = file.path(dir, "imp"))
  html <- .cmt_read(list.files(file.path(dir, "imp"), pattern = "\\.html$", full.names = TRUE)[[1]])
  # SALUDO garantizado (va sola), el nombre no: un solo nivel de condicional.
  expect_match(html, "*|IF:FNAME|**|SALUDO|* *|FNAME|*:*|ELSE:|**|SALUDO|* estudiante:*|END:IF|*", fixed = TRUE)
  expect_false(grepl("*|IF:SALUDO|*", html, fixed = TRUE))
})

test_that("Mailchimp con scope plantilla: aunque haya lista, el saludo conserva sus respaldos", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- collection_mail_template_get(sid)$template
  collection_mail_template_put(sid, .cmt_with_column(t), .cmail_fx_rev(sid))
  .cmt_import(sid)
  ex <- collection_mail_export(sid, .cmail_fx_rev(sid), scope = "plantilla")
  dir <- tempfile("cmt-"); on.exit(unlink(dir, recursive = TRUE), add = TRUE)
  zip::unzip(session_get(sid)$files[[ex$zip$file_id]]$path, exdir = dir)
  html <- .cmt_read(list.files(dir, pattern = "\\.html$", full.names = TRUE, recursive = TRUE)[[1]])
  # Sin audiencia.csv nada garantiza SALUDO ni FNAME: los respaldos siguen en el HTML.
  expect_match(html, "*|IF:SALUDO|**|SALUDO|**|ELSE:|*Estimado(a)*|END:IF|*", fixed = TRUE)
  expect_match(html, "*|IF:FNAME|*", fixed = TRUE)
})
