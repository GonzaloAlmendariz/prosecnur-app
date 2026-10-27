# «Textos en Word» (loop editor de correos, L13; collection_mail_textos_word.R). Sin red.

.cmtw_campana <- function(sid, rev, name) {
  a <- collection_mail_campaign_create(sid, rev, name = name, preset_id = "invitacion_encuesta_v1")
  t <- a$campaign$template
  t$constants <- list(list(key = "premios", label = "Premios", value = "**una tablet Samsung**"))
  t$blocks[[1]] <- list(block_id = t$blocks[[1]]$block_id, type = "greeting", text = "Estimado(a) {{nombre}}:",
                        fallback = "Estimado(a):", trato = list(modo = "por_sexo", columna = "Sexo",
                        masculino = "Estimado", femenino = "Estimada", respaldo = "Estimado(a)"))
  t$blocks <- append(t$blocks, list(list(block_id = "sorteo", type = "paragraph", text = "Podrá entrar al sorteo de {{premios}}.")), after = 1L)
  envios <- list(list(send_id = "invitacion", kind = "invitacion", label = "Invitación", audience = "todos"),
                 list(kind = "recordatorio", label = "R uno", audience = "ambos", subject = "Recordatorio: aún puede responder", opening = "Le recordamos la invitación."),
                 list(kind = "recordatorio", label = "R dos", audience = "ambos", subject = "Recordatorio: su opinión cuenta", opening = "Le escribimos de nuevo."),
                 list(kind = "recordatorio", label = "R tres", audience = "ambos", subject = "Recordatorio: última semana", opening = "Es la última semana."))
  put <- collection_mail_template_put(sid, t, a$state_revision, campaign_id = a$campaign$campaign_id, sends = envios)
  list(id = a$campaign$campaign_id, rev = put$state_revision)
}

test_that("un .docx con las tres partes por campaña, los datos escritos y los recordatorios sin numerar", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- .cmtw_campana(sid, rev, "Profesores")
  r <- collection_mail_textos_word(sid, list(a$id), titulo = "Acreditación 2028")
  expect_true(r$ok)
  f <- session_get(sid)$files[[r$file$file_id]]
  expect_identical(r$file$sensitivity, "internal")
  expect_identical(r$file$filename, "acreditacion-2028.docx")
  s <- officer::docx_summary(officer::read_docx(f$path))
  txt <- s$text[nzchar(s$text %||% "")]
  expect_true(all(c("Profesores", "Primer correo", "Recordatorios", "Último recordatorio") %in% s$text[grepl("heading", s$style_name %||% "")]))
  # Saludo por sexo, el dato de la campaña escrito y sin marcas.
  expect_true("Estimado/Estimada [nombre]:" %in% txt)
  expect_true("Podrá entrar al sorteo de una tablet Samsung." %in% txt)
  expect_false(any(grepl("{{", txt, fixed = TRUE) | grepl("**", txt, fixed = TRUE)))
  # Los dos intermedios en la tabla de Recordatorios, el último aparte con su apertura en el cuerpo.
  celdas <- s$text[s$content_type == "table cell"]
  expect_true(all(c("Recordatorio: aún puede responder", "Le recordamos la invitación.", "Recordatorio: su opinión cuenta",
                    "Recordatorio: última semana", "Es la última semana.") %in% celdas))
  expect_true("[Apertura del recordatorio]" %in% txt)
  expect_true("Es la última semana." %in% txt)
  expect_false(any(grepl("Recordatorio [0-9]", c(txt, celdas))))
})

test_that("sin recordatorios queda sólo el primer correo; pide de 1 a 10 campañas que existan", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- as.integer(session_get(sid)$collection_state$state_revision %||% 0L)
  a <- collection_mail_campaign_create(sid, rev, name = "Sola", preset_id = "invitacion_encuesta_v1")
  r <- collection_mail_textos_word(sid, list(a$campaign$campaign_id))
  h <- officer::docx_summary(officer::read_docx(session_get(sid)$files[[r$file$file_id]]$path))
  heads <- h$text[grepl("heading", h$style_name %||% "")]
  expect_true("Primer correo" %in% heads)
  expect_false(any(c("Recordatorios", "Último recordatorio") %in% heads))
  code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
  expect_identical(code(collection_mail_textos_word(sid, list())), "E_COLLECTION_MAIL_TEXTOS")
  expect_identical(code(collection_mail_textos_word(sid, list("no-existe"))), "E_COLLECTION_MAIL_TEXTOS")
})
