# Correo E1l (ADR 0110): importar un HTML existente y convertirlo en bloques.
# Golden del ejemplo real de PULSO en SurveyMonkey (fixtures/mail-import, sin
# datos de destinatarios), detección de plataforma, ida y vuelta con los dos
# presets en los dos dialectos, seguridad, límites, «no se pierde texto» y
# que importar no escribe nada.

.cmi_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmi_code <- function(expr) { e <- .cmi_err(expr); if (is.null(e)) NA_character_ else e$code }
.cmi_golden_html <- function() .cmail_fx_read_text(.cmail_fx_mail_import_path("arte-diseno-invitacion.html"))
.cmi_parse <- function(html, ...) .cmail_import_html_parse(charToRaw(enc2utf8(html)), ...)
.cmi_codes <- function(r) vapply(r$report, `[[`, "", "code")
.cmi_types <- function(t) vapply(t$blocks, `[[`, "", "type")
# Textos de cada bloque con los campos normalizados ({{x}} -> {{}}): la clave
# de un campo no se recupera de SurveyMonkey ([CustomData1] -> dato_1).
.cmi_texts <- function(t) lapply(t$blocks, function(b) {
  v <- unname(unlist(b[intersect(names(b), c("text", "title", "items", "closing", "name", "lines", "note"))]))
  gsub("\\{\\{[a-z0-9_]+\\}\\}", "{{}}", v)
})
.cmi_mapped <- function(t) {
  keys <- c(carrera = "CustomData1", codigo = "CustomData2", enlace = "SurveyLink")
  for (i in seq_along(t$fields)) t$fields[[i]]$sm <- keys[[t$fields[[i]]$key]]
  t
}

test_that("golden: el ejemplo de PULSO en SurveyMonkey da la plantilla esperada", {
  r <- .cmi_parse(.cmi_golden_html(), file_name = "arte-diseno-invitacion.html")
  expected <- jsonlite::fromJSON(.cmail_fx_mail_import_path("arte-diseno-invitacion.expected.json"), simplifyVector = FALSE)
  got <- jsonlite::fromJSON(jsonlite::toJSON(list(
    platform_detected = r$platform_detected, platform_evidence = r$platform_evidence,
    template = r$template, report_codes = as.list(.cmi_codes(r)), images = r$images, stats = r$stats
  ), auto_unbox = TRUE, null = "null"), simplifyVector = FALSE)
  expect_identical(got, expected)
  t <- r$template
  expect_true(collection_mail_template_validate(t)$ok)
  expect_identical(r$platform_detected, "surveymonkey")
  expect_identical(r$platform_evidence$surveymonkey, 4L)
  expect_identical(t$header, list(kind = "banner", image_ref = "arte1-960"))
  expect_identical(t$images$`arte1-960`$url, "https://pulsopucp.github.io/correo-/Arte1-960.png")
  expect_identical(t$theme, list(accent = "#001f60", band = "acento"))
  expect_identical(t$fields, list(list(key = "enlace", tag = "ENLACE", label = "Enlace a la encuesta", sm = "SurveyLink",
                                       destino = "encuesta")))
  expect_identical(.cmi_types(t), c("greeting", "paragraph", "paragraph", "paragraph", "button", "callout", "signature", "footer_legal"))
  expect_identical(t$blocks[[1]]$text, "**Estimado(a) {{nombre}},**")
  expect_identical(t$blocks[[1]]$fallback, "**Estimado(a),**")
  expect_true(all(vapply(t$blocks[2:4], function(b) identical(b$align, "justify"), NA)))
  expect_match(t$blocks[[4]]$text, "**viernes 18 de setiembre**", fixed = TRUE)
  expect_identical(t$blocks[[5]][c("block_id", "text", "url")], list(block_id = "boton", text = "Empezar aquí", url = "{{enlace}}"))
  expect_identical(t$blocks[[6]]$block_id, "importante")
  expect_length(t$blocks[[6]]$items, 2L)
  expect_identical(t$blocks[[7]][c("closing", "name")], list(closing = "Saludos cordiales,", name = "PULSO PUCP"))
  expect_identical(t$blocks[[7]]$lines, list("**Instituto de Analítica Social e Inteligencia Estratégica**"))
  expect_identical(t$blocks[[8]]$block_id, "pie")
  expect_true(all(c("style_discarded", "hover_ignored", "subject_missing", "platform_link_removed",
                    "platform_footer_removed") %in% .cmi_codes(r)))
  expect_identical(r$report[[1]]$selector, "head > style")
})

test_that("golden en SurveyMonkey: el render trae las etiquetas y la revisión solo pide el asunto", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  imp <- collection_mail_import_html(sid, html = .cmi_golden_html(), file_name = "arte.html")
  html <- collection_mail_render(imp$template, "export", "surveymonkey",
                                 images = .cmail_images_resolve(session_get(sid), imp$template))$html
  for (tag in c('href="[SurveyLink]"', "[FirstName]", "[PrivacyLink]", "[OptOutLink]")) expect_true(grepl(tag, html, fixed = TRUE), label = tag)
  expect_true(.cmail_sm_html_verify(html)$ok)
  c <- collection_mail_campaign_create(sid, 0L, name = "Arte FG", platform = "surveymonkey",
                                       template = imp$template, import_id = imp$import_id)
  r <- collection_mail_review(sid, campaign_id = c$campaign$campaign_id)
  errors <- vapply(Filter(function(x) identical(x$status, "error"), r$checks), `[[`, "", "code")
  expect_identical(errors, "subject")
  # Con el asunto, la revisión pasa.
  imp2 <- collection_mail_import_html(sid, html = .cmi_golden_html(), file_name = "arte.html",
    subject = "Invitación para participar en el estudio de la Facultad de Arte y Diseño PUCP sobre la percepción de la Formación General")
  expect_false("subject_missing" %in% .cmi_codes(imp2))
  r2 <- collection_mail_review(sid, template = imp2$template, campaign_id = c$campaign$campaign_id)
  expect_true(r2$ready)
})

test_that("detección de plataforma: SurveyMonkey, Mailchimp y mezcla", {
  sm <- .cmi_parse('<html><body><p>Hola [FirstName],</p><a class="button" href="[SurveyLink]">Ir</a><p><a href="[OptOutLink]">baja</a></p></body></html>')
  expect_identical(sm$platform_detected, "surveymonkey")
  expect_identical(sm$platform_evidence, list(surveymonkey = 3L, mailchimp = 0L))
  mc <- .cmi_parse('<html><body><p>Hola *|FNAME|*,</p><p>Carrera: *|CARRERA|*</p><a href="*|UNSUB|*">baja</a></body></html>')
  expect_identical(mc$platform_detected, "mailchimp")
  expect_identical(vapply(mc$template$fields, `[[`, "", "key"), "carrera")
  expect_null(mc$template$fields[[1]]$sm)
  mix <- .cmi_parse('<html><body><p>Hola [FirstName] *|FNAME|*,</p><p>Uno [CustomData3] y *|DOS|*</p><p>[LastName]</p></body></html>')
  expect_identical(mix$platform_detected, "surveymonkey")
  expect_true("platform_mixed" %in% .cmi_codes(mix))
  expect_setequal(vapply(mix$template$fields, `[[`, "", "key"), c("dato_3", "dos", "apellido"))
  none <- .cmi_parse("<html><body><p>Texto.</p></body></html>")
  expect_null(none$platform_detected)
  # [Email] se quita y se informa; *|EMAIL|* también.
  em <- .cmi_parse("<html><body><p>Su correo [Email] y *|EMAIL|*.</p></body></html>")
  expect_identical(sum(.cmi_codes(em) == "email_tag_removed"), 2L)
  expect_false(any(grepl("Email|EMAIL", unlist(em$template$blocks))))
})

test_that("ida y vuelta: render(export, d) -> import da los mismos tipos y textos (2 presets x 2 dialectos)", {
  for (pid in c("recuperacion", "invitacion")) for (d in c("mailchimp", "surveymonkey")) {
    t <- .cmail_template_normalize(.cmail_presets()[[if (pid == "recuperacion") "recuperacion_estudiantes_v1" else "invitacion_capacitacion_v1"]]())
    if (identical(d, "surveymonkey")) t <- .cmi_mapped(t)
    html <- collection_mail_render(t, "export", d)$html
    r <- .cmi_parse(html)
    label <- paste(pid, d)
    expect_identical(r$platform_detected, d, label = label)
    expect_identical(.cmi_types(r$template), .cmi_types(t), label = label)
    expect_identical(.cmi_texts(r$template), .cmi_texts(t), label = label)
    expect_identical(r$template$preheader, t$preheader, label = label)
    expect_true(collection_mail_template_validate(r$template)$ok, label = label)
    # En Mailchimp el respaldo del saludo y del campo vuelven.
    if (identical(d, "mailchimp")) {
      expect_identical(r$template$blocks[[1]]$fallback, t$blocks[[1]]$fallback, label = label)
      if (identical(pid, "recuperacion")) {
        expect_identical(Filter(function(f) f$key == "carrera", r$template$fields)[[1]]$fallback, "su carrera")
      }
    }
  }
})

test_that("seguridad: script, style, iframe, onclick, javascript: y data: se descartan y se informan", {
  html <- paste0(
    '<html><head><script>alert(1)</script><style>.x{color:red}</style></head><body>',
    '<iframe src="https://evil.example/"></iframe><form><input value="x"></form>',
    '<p onclick="steal()">Hola mundo</p>',
    '<p><a href="javascript:alert(1)">clic</a> y <a href="data:text/html;base64,AA">otro</a> y <a href="vbscript:x">más</a></p>',
    '<img src="data:image/png;base64,iVBORw0KGgo=" alt="Incrustada"><p>Texto final.</p>',
    '<!--[if mso]><p>Outlook</p><![endif]--><div style="display:none">Secreto</div></body></html>'
  )
  r <- .cmi_parse(html)
  codes <- .cmi_codes(r)
  expect_true(all(c("element_discarded", "style_discarded", "event_handler_discarded", "unsafe_link_discarded",
                    "image_needs_upload", "comments_discarded") %in% codes))
  expect_identical(sum(codes == "unsafe_link_discarded"), 3L)
  all_text <- paste(unlist(r$template), collapse = " ")
  for (bad in c("alert", "javascript:", "data:", "vbscript", "steal", "evil.example", "<", "Outlook")) {
    expect_false(grepl(bad, all_text, fixed = TRUE), label = bad)
  }
  # <input> va dentro del <form> descartado (y en su extracto del informe).
  expect_true(all(c("script", "style", "iframe", "form") %in% unlist(r$stats$discarded)))
  expect_true("Incrustada" %in% vapply(Filter(function(i) i$status == "needs_upload", r$images), `[[`, "", "alt"))
  expect_true(collection_mail_template_validate(r$template)$ok)
  # Texto con forma de HTML o entidades: se separa y se informa, no rompe la plantilla.
  lit <- .cmi_parse("<html><body><p>Use &lt;b&gt; y &amp;nbsp; y {{campo}} y *|X:Y|*.</p></body></html>")
  expect_true("text_escaped" %in% .cmi_codes(lit))
  expect_true(collection_mail_template_validate(lit$template)$ok)
})

test_that("límites: más de 512 KB -> 413; más de 5.000 elementos -> 422; HTML vacío -> 422", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  big <- paste0("<html><body><p>", strrep("a", 513L * 1024L), "</p></body></html>")
  e <- .cmi_err(collection_mail_import_html(sid, html = big))
  expect_identical(e$code, "E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE")
  expect_equal(e$status, 413)
  many <- paste0("<html><body>", strrep("<span>x</span>", 5100L), "</body></html>")
  e2 <- .cmi_err(collection_mail_import_html(sid, html = many))
  expect_identical(e2$code, "E_COLLECTION_MAIL_IMPORT_HTML_INVALID")
  expect_equal(e2$status, 422)
  deep <- paste0("<html><body>", strrep("<div>", 70L), "x", strrep("</div>", 70L), "</body></html>")
  expect_identical(.cmi_code(collection_mail_import_html(sid, html = deep)), "E_COLLECTION_MAIL_IMPORT_HTML_INVALID")
  expect_identical(.cmi_code(collection_mail_import_html(sid, html = "   ")), "E_COLLECTION_MAIL_IMPORT_HTML_INVALID")
  # Más de 40 bloques: se juntan párrafos y sigue siendo válida.
  long <- paste0("<html><body>", paste(sprintf("<p>Párrafo número %d.</p>", 1:60), collapse = ""), "</body></html>")
  r <- .cmi_parse(long)
  expect_lte(length(r$template$blocks), 40L)
  expect_true(collection_mail_template_validate(r$template)$ok)
})

test_that("no se pierde texto: toda palabra visible del cuerpo está en un bloque, en el informe o en el pie", {
  html <- paste0(
    '<html><body><div style="display:none">Vista previa del correo</div>',
    '<table><tr><td>Columna izquierda única</td><td>Columna derecha distinta</td></tr></table>',
    '<p>Estimado(a) [FirstName],</p><h2>Título del aviso</h2><p>Un párrafo <em>con cursiva</em> y <b>negrita</b>.</p>',
    '<video>Vídeo alternativo</video><blockquote>Cita textual</blockquote>',
    '<ol><li>Primero</li><li>Segundo</li></ol><p>Atentamente,</p><p><b>Equipo</b><br>Línea dos</p>',
    '<hr><p><a href="[OptOutLink]">Opt out</a> | Dirección postal ficticia</p></body></html>'
  )
  r <- .cmi_parse(html)
  doc <- xml2::read_html(charToRaw(html))
  xml2::xml_remove(xml2::xml_find_all(doc, "//script | //style"))
  visible <- paste(xml2::xml_text(xml2::xml_find_all(doc, "//body//text()")), collapse = " ")
  words <- unique(tolower(regmatches(visible, gregexpr("[[:alpha:]]{3,}", visible))[[1]]))
  have <- tolower(paste(c(unlist(r$template), unlist(lapply(r$report, `[[`, "excerpt"))), collapse = " "))
  vocab <- tolower(c("Opt", "out", "FirstName", "OptOutLink"))
  lost <- words[!vapply(words, function(w) grepl(w, have, fixed = TRUE) || w %in% vocab, NA)]
  expect_identical(lost, character(0))
  expect_true("unrecognized" %in% .cmi_codes(r))
  unrec <- Filter(function(x) identical(x$code, "unrecognized"), r$report)
  expect_true(all(vapply(unrec, function(x) !is.null(x$block_id), NA)))
  expect_identical(r$template$preheader, "Vista previa del correo")
  expect_identical(Filter(function(b) b$type == "footer_legal", r$template$blocks)[[1]]$text, "Dirección postal ficticia")
})

test_that("informe enmascarado y acotado; windows-1252; importar no cambia el estado ni guarda el HTML", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  collection_mail_campaign_create(sid, 0L, name = "Uno")
  before <- session_get(sid)$collection_state
  files_before <- names(session_get(sid)$files)
  html <- paste0('<html><body><p>Hola,</p><video>Escriba a ana.quispe@ejemplo.org ', strrep("palabra ", 60), '</video></body></html>')
  imp <- collection_mail_import_html(sid, html = html, file_name = "x.html")
  ex <- Filter(function(x) identical(x$code, "unrecognized"), imp$report)[[1]]$excerpt
  expect_match(ex, "[correo oculto]", fixed = TRUE)
  expect_lte(nchar(ex), 160L)
  expect_false(grepl("@", paste(unlist(imp$report), collapse = " "), fixed = TRUE))
  expect_identical(session_get(sid)$collection_state, before)
  expect_identical(names(session_get(sid)$files), files_before)
  expect_match(imp$import_id, "^imp-[0-9a-f]{12}$")
  expect_match(imp$sha256, "^sha256:[0-9a-f]{64}$")
  # Se recuerda la huella, no el HTML; hasta 5 importaciones por sesión.
  cached <- get(sid, envir = .cmail_imports_env)
  expect_false(any(grepl("palabra palabra palabra palabra palabra palabra palabra palabra", unlist(cached), fixed = TRUE)))
  ids <- vapply(1:6, function(i) collection_mail_import_html(sid, html = sprintf("<html><body><p>Uno %d.</p></body></html>", i))$import_id, "")
  expect_length(get(sid, envir = .cmail_imports_env), 5L)
  expect_identical(.cmi_code(.cmail_import_lookup(sid, ids[[1]])), "E_COLLECTION_MAIL_IMPORT_HTML_INVALID")
  expect_identical(.cmail_import_lookup(sid, ids[[6]])$platform_detected, "desconocida")
  # windows-1252 se reintenta y se informa.
  raw <- iconv("<html><body><p>Educación y señal.</p></body></html>", from = "UTF-8", to = "windows-1252", toRaw = TRUE)[[1]]
  r <- collection_mail_import_html(sid, raw = raw, file_name = "w.html")
  expect_true("encoding_windows1252" %in% .cmi_codes(r))
  expect_match(r$template$blocks[[1]]$text, "Educación y señal.", fixed = TRUE)
})

test_that("escribir con import_id: POST mail-campaigns y PUT mail-template guardan imported_from sin el HTML", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  imp <- collection_mail_import_html(sid, html = .cmi_golden_html(), file_name = "arte.html")
  c <- collection_mail_campaign_create(sid, 0L, name = "Arte", platform = "surveymonkey",
                                       template = imp$template, import_id = imp$import_id)
  from <- c$campaign$imported_from
  expect_identical(from$sha256, imp$sha256)
  expect_identical(from$platform_detected, "surveymonkey")
  expect_identical(vapply(from$report, `[[`, "", "code"), vapply(imp$report, `[[`, "", "code"))
  stored <- session_get(sid)$collection_state$mail_campaigns
  expect_false(grepl("<div", paste(unlist(stored), collapse = " "), fixed = TRUE))
  expect_identical(c$campaign$template$template_id, "arte")
  expect_identical(.cmi_code(collection_mail_campaign_create(sid, 1L, name = "Otra", template = imp$template, import_id = "imp-000000000000")),
                   "E_COLLECTION_MAIL_IMPORT_HTML_INVALID")
  expect_identical(.cmi_code(collection_mail_campaign_create(sid, 1L, name = "Otra", template = imp$template,
                                                             preset_id = "invitacion_capacitacion_v1")),
                   "E_COLLECTION_MAIL_TEMPLATE_INVALID")
  # Reemplazar la plantilla de una campaña existente con otro import.
  imp2 <- collection_mail_import_html(sid, html = "<html><body><p>Hola [FirstName],</p><p>Texto.</p><a class='button' href='[SurveyLink]'>Ir</a></body></html>")
  p <- collection_mail_template_put(sid, imp2$template, 1L, campaign_id = "arte", import_id = imp2$import_id)
  expect_false(p$noop)
  expect_identical(collection_mail_campaigns_get(sid)$state_revision, 2L)
  expect_identical(session_get(sid)$collection_state$mail_campaigns$campaigns[[1]]$imported_from$sha256, imp2$sha256)
})

test_that("HTTP: import-html por JSON y por multipart; no escribe", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  rev0 <- collection_mail_campaigns_get(sid)$state_revision
  j <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/import-html",
                      .cmail_fx_json(list(html = .cmi_golden_html(), file_name = "arte.html", subject = "Invitación")))
  expect_identical(j$status, 200L, info = substr(j$raw, 1, 400))
  expect_identical(j$body$platform_detected, "surveymonkey")
  expect_identical(j$body$template$blocks[[5]]$type, "button")
  expect_identical(j$body$template$subject, "Invitación")
  b <- "----cmiBoundary"
  raw <- c(
    charToRaw(paste0("--", b, "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"arte.html\"\r\nContent-Type: text/html\r\n\r\n")),
    charToRaw(enc2utf8(.cmi_golden_html())), charToRaw("\r\n"),
    charToRaw(enc2utf8(paste0("--", b, "\r\nContent-Disposition: form-data; name=\"subject\"\r\n\r\nAsunto multipart\r\n"))),
    charToRaw(paste0("--", b, "--\r\n"))
  )
  m <- .cmail_fx_call_raw(pr, sid, "POST", "/api/recopiladores/mail-template/import-html", raw,
                          paste0("multipart/form-data; boundary=", b))
  expect_identical(m$status, 200L, info = substr(m$raw, 1, 400))
  expect_identical(m$body$template$subject, "Asunto multipart")
  expect_identical(m$body$sha256, j$body$sha256)
  expect_identical(collection_mail_campaigns_get(sid)$state_revision, rev0)
  big <- .cmail_fx_call(pr, sid, "POST", "/api/recopiladores/mail-template/import-html",
                        .cmail_fx_json(list(html = strrep("a", 600L * 1024L))))
  expect_identical(big$status, 413L)
  expect_identical(big$body$error$code, "E_COLLECTION_MAIL_IMPORT_HTML_TOO_LARGE")
})


# ---- revisión metodológica E1jkl: corpus A-F y propiedad reforzada -----------

.cmi_words <- function(x) {
  w <- stringi::stri_extract_all_regex(tolower(paste(x, collapse = " ")), "\\p{L}{2,}")[[1]]
  w[!is.na(w)]
}
.cmi_is_subseq <- function(needle, hay) {
  j <- 1L
  for (w in needle) {
    while (j <= length(hay) && !identical(hay[[j]], w)) j <- j + 1L
    if (j > length(hay)) return(FALSE)
    j <- j + 1L
  }
  TRUE
}
.cmi_block_texts <- function(t) {
  c(t$preheader %||% "", unlist(lapply(t$blocks, function(b) {
    unlist(b[intersect(names(b), c("text", "fallback", "title", "items", "closing", "name", "lines", "note", "alt", "url"))])
  }), use.names = FALSE))
}
# Toda palabra visible (2+ letras) está en un bloque o en el informe; las que
# quedan en los bloques y no se informan conservan su orden; todo enlace https
# de la entrada está en la plantilla o en el informe.
.cmi_expect_no_loss <- function(html, r, label) {
  doc <- xml2::read_html(charToRaw(enc2utf8(html)))
  xml2::xml_remove(xml2::xml_find_all(doc, paste0("//", .CMAIL_IH_DROP, collapse = " | ")))
  visible <- paste(xml2::xml_text(xml2::xml_find_all(doc, "//body//text()")), collapse = " ")
  # El respaldo de un campo de Mailchimp (*|IF:T|**|T|**|ELSE:|*Y*|END:IF|*)
  # vive en la definición del campo, no en el bloque: se mira aparte.
  visible <- gsub("\\*\\|IF:([A-Z0-9_]+)\\|\\*\\*\\|\\1\\|\\*\\*\\|ELSE:\\|\\*.*?\\*\\|END:IF\\|\\*", " ", visible, perl = TRUE)
  # Las etiquetas de plataforma son vocabulario, no texto del autor.
  visible <- gsub(paste0(.CMAIL_IH_SM_TAG_RE, "|", .CMAIL_IH_MC_TAG_RE), " ", visible, perl = TRUE)
  input <- .cmi_words(visible)
  out <- .cmi_words(gsub(.CMAIL_LINK_RE, "\\1", .cmi_block_texts(r$template), perl = TRUE))
  rep_words <- .cmi_words(vapply(r$report, function(x) x$excerpt %||% "", ""))
  lost <- setdiff(input, c(out, rep_words))
  expect_identical(lost, character(0), label = paste(label, "palabras perdidas"))
  ordered <- input[input %in% out & !(input %in% rep_words)]
  expect_true(.cmi_is_subseq(ordered, out), label = paste(label, "orden"))
  hrefs <- c(xml2::xml_attr(xml2::xml_find_all(doc, "//a[starts-with(@href, 'https://')]"), "href"),
             xml2::xml_attr(xml2::xml_find_all(doc, "//img[starts-with(@src, 'https://')]"), "src"))
  t <- r$template
  have <- paste(c(unlist(t$blocks), unlist(t$images), vapply(r$report, function(x) x$excerpt %||% "", "")), collapse = " ")
  for (h in hrefs) expect_true(grepl(h, have, fixed = TRUE), label = paste(label, "enlace", h))
}

.cmi_case <- function(name) .cmail_fx_read_text(.cmail_fx_mail_import_path(name))

test_that("corpus A-F: cada cambio de sentido se informa con su código", {
  expect_code <- function(name, code, n = 1L) {
    r <- .cmi_parse(.cmi_case(name))
    expect_true(collection_mail_template_validate(r$template)$ok, label = name)
    expect_gte(sum(.cmi_codes(r) == code), n, label = paste(name, code))
    r
  }
  # A: la política propia pasa al pie CON su enlace y se informa.
  a <- expect_code("caso-a-privacidad-propia.html", "moved_to_footer")
  pie <- Filter(function(b) b$type == "footer_legal", a$template$blocks)[[1]]$text
  expect_identical(pie, "Sus datos se tratan según la [Política de Privacidad de la PUCP](https://www.pucp.edu.pe/privacidad). Para consultas escriba aquí.")
  # B: IF/ELSE -> una rama para todos, las dos en el informe.
  b <- expect_code("caso-b-if-else.html", "conditional_flattened")
  ex <- Filter(function(x) x$code == "conditional_flattened", b$report)[[1]]$excerpt
  expect_match(ex, "Ya empezó la encuesta", fixed = TRUE)
  expect_match(ex, "No ha empezado la encuesta", fixed = TRUE)
  expect_false("button" %in% .cmi_types(b$template))
  # C: IFNOT sin concatenar las ramas contradictorias.
  c <- expect_code("caso-c-ifnot.html", "conditional_flattened")
  body <- paste(unlist(c$template$blocks), collapse = " ")
  expect_match(body, "Aún no recibimos su respuesta.", fixed = TRUE)
  expect_false(grepl("Gracias por responder", body, fixed = TRUE))
  # D: [PrivacyLink] en el cuerpo.
  d <- expect_code("caso-d-privacylink-cuerpo.html", "platform_link_removed", 2L)
  expect_true(any(grepl("política de privacidad -> [PrivacyLink]", vapply(d$report, `[[`, "", "excerpt"), fixed = TRUE)))
  # E: tachado.
  expect_code("caso-e-tachado.html", "strike_plain", 2L)
  # F: un párrafo con «darse de baja» pasa al pie, se conserva y se informa.
  f <- expect_code("caso-f-baja-al-final.html", "moved_to_footer")
  expect_identical(Filter(function(x) x$type == "footer_legal", f$template$blocks)[[1]]$text,
                   "Si no desea participar, puede darse de baja aquí.")
  # Una frase estándar solo se quita como línea o tramo entero, no como subcadena.
  expect_identical(as.character(.cmail_ih_footer_clean("Privacidad | Si desea darse de baja de esta encuesta, haga clic aquí.")), "")
  expect_identical(as.character(.cmail_ih_footer_clean("Lea la Política de Privacidad institucional.")), "Lea la Política de Privacidad institucional.")
  # Un enlace que el bloque no admite se informa con su URL.
  h <- .cmi_parse('<html><body><p>Hola [FirstName], <a href="https://x.org/y">vea</a>:</p><p>Texto.</p></body></html>')
  expect_true("link_discarded" %in% .cmi_codes(h))
})

test_that("propiedad reforzada: sin pérdida, en orden y con sus enlaces en el corpus, el golden y los presets", {
  for (name in c(sprintf("caso-%s", c("a-privacidad-propia", "b-if-else", "c-ifnot", "d-privacylink-cuerpo",
                                     "e-tachado", "f-baja-al-final")), "arte-diseno-invitacion", "contabilidad-reacreditacion")) {
    html <- .cmi_case(paste0(name, ".html"))
    .cmi_expect_no_loss(html, .cmi_parse(html), name)
  }
  for (d in c("mailchimp", "surveymonkey")) {
    t <- .cmi_mapped(.cmail_template_normalize(.cmail_preset_recuperacion()))
    html <- collection_mail_render(t, "export", d)$html
    .cmi_expect_no_loss(html, .cmi_parse(html), paste("recuperacion", d))
  }
})


test_that("golden 2 (Contabilidad, SurveyMonkey real): alt ausente informado, negrita y cursiva, espacios y firma", {
  html <- .cmi_case("contabilidad-reacreditacion.html")
  r <- .cmi_parse(html, file_name = "contabilidad-reacreditacion.html")
  expected <- jsonlite::fromJSON(.cmail_fx_mail_import_path("contabilidad-reacreditacion.expected.json"), simplifyVector = FALSE)
  got <- jsonlite::fromJSON(jsonlite::toJSON(list(
    platform_detected = r$platform_detected, platform_evidence = r$platform_evidence,
    template = r$template, report_codes = as.list(.cmi_codes(r)), images = r$images, stats = r$stats
  ), auto_unbox = TRUE, null = "null"), simplifyVector = FALSE)
  expect_identical(got, expected)
  t <- r$template
  # (a) La cabecera sin alt: vacío, informado con block_id; la revisión lo marca.
  expect_identical(t$header, list(kind = "banner", image_ref = "bannerc"))
  expect_identical(t$images$bannerc$alt, "")
  alt <- Filter(function(x) x$code == "image_alt_missing", r$report)
  expect_length(alt, 1L)
  expect_identical(alt[[1]]$block_id, "__cabecera")
  # (b) negrita conservada y cursiva informada; (c) sin «** » roto; (d) espacios; (e) y/o.
  p1 <- t$blocks[[2]]$text
  expect_true(startsWith(p1, "La **Facultad de Ciencias Contables de la Pontificia Universidad Católica del Perú** y el **Instituto"))
  expect_match(p1, "realizando un **estudio de opinión** en el marco", fixed = TRUE)
  # Ninguna negrita abre con espacio («** Facultad»).
  expect_false(any(grepl("(^|\\s)\\*\\*\\s", vapply(t$blocks, function(b) b$text %||% "", ""))))
  expect_true("italic_plain" %in% .cmi_codes(r))
  expect_identical(t$blocks[[4]]$text, "Puede participar hasta el 05 de junio")
  expect_match(t$blocks[[6]]$items[[1]], "no la reenvíe y/o comparta.", fixed = TRUE)
  # (f) firma tal cual se escribió; (g) sin espacios basura en ningún texto.
  expect_identical(t$blocks[[7]]$name, "Pulso PUCP")
  texts <- unlist(lapply(t$blocks, function(b) b[intersect(names(b), c("text", "items", "lines", "closing", "name", "title"))]))
  expect_false(any(grepl("  |^\\s|\\s$", texts)))
  # Revisión SurveyMonkey: el alt vacío lo marca images_alt sobre la cabecera.
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  imp <- collection_mail_import_html(sid, html = html, file_name = "conta.html", subject = "Encuesta de Reacreditación")
  collection_mail_campaign_create(sid, 0L, name = "Conta", platform = "surveymonkey", template = imp$template, import_id = imp$import_id)
  by <- setNames(collection_mail_review(sid, campaign_id = "conta")$checks, NULL)
  ia <- Filter(function(x) x$code == "images_alt", by)[[1]]
  expect_identical(ia$status, "error")
  expect_identical(ia$targets[[1]]$block_id, "__cabecera")
  out <- collection_mail_render(imp$template, "export", "surveymonkey", images = .cmail_images_resolve(session_get(sid), imp$template))$html
  expect_true(.cmail_sm_html_verify(out)$ok)
})

test_that("un bloque imagen sin alt lleva el marcador visible y se informa con su block_id", {
  r <- .cmi_parse('<html><body><img src="https://x.org/logo.png" width="120" alt="Logo"><p>Hola,</p><p>Texto.</p><img src="https://x.org/foto.png" width="300"><p>Fin.</p></body></html>')
  img <- Filter(function(b) b$type == "image", r$template$blocks)[[1]]
  expect_identical(img$alt, .CMAIL_ALT_MARKER)
  alt <- Filter(function(x) x$code == "image_alt_missing", r$report)
  expect_identical(alt[[1]]$block_id, img$block_id)
})

test_that("images_alt: el marcador del importador cuenta como alt vacío (error con targets), pero se puede guardar", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  imp <- collection_mail_import_html(sid, html = '<html><body><img src="https://x.org/logo.png" width="120" alt="Logo"><p>Hola,</p><p>Texto.</p><img src="https://x.org/foto.png" width="300"><p>Fin.</p><a class="button" href="https://x.org/e">Ir</a></body></html>',
                                     file_name = "x.html", subject = "Asunto")
  img <- Filter(function(b) b$type == "image", imp$template$blocks)[[1]]
  expect_identical(img$alt, .CMAIL_ALT_MARKER)
  expect_true(collection_mail_template_validate(imp$template)$ok)
  c <- collection_mail_campaign_create(sid, 0L, name = "Uno", template = imp$template, import_id = imp$import_id)
  by <- setNames(collection_mail_review(sid, campaign_id = "uno", scope = "plantilla")$checks, NULL)
  ia <- Filter(function(x) x$code == "images_alt", by)[[1]]
  expect_identical(ia$status, "error")
  expect_identical(ia$targets[[1]]$block_id, img$block_id)
  expect_identical(.cmi_code(collection_mail_export(sid, collection_mail_campaigns_get(sid)$state_revision, "uno", scope = "plantilla")),
                   "E_COLLECTION_MAIL_REVIEW_BLOCKING")
  # Con un alt real, pasa.
  t <- c$campaign$template
  for (i in seq_along(t$blocks)) if (identical(t$blocks[[i]]$type, "image")) t$blocks[[i]]$alt <- "Estudiantes en el campus"
  by2 <- setNames(collection_mail_review(sid, template = t, campaign_id = "uno", scope = "plantilla")$checks, NULL)
  expect_identical(Filter(function(x) x$code == "images_alt", by2)[[1]]$status, "ok")
})
