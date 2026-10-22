# Correo E1n (ADR 0110): estilo «campaña» (fondo a todo el ancho, sin tarjeta,
# texto por contraste, botón píldora, onda PNG opcional), justificado por
# defecto en los dos estilos y cursiva *…* en el render y en el importador.
# Fixtures sintéticos (helper-collection-mail.R).

.cmc_err <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)
.cmc_rev <- function(sid) collection_mail_campaigns_get(sid)$state_revision
.cmc_codes <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "code")
.cmc_paths <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "path")
.cmc_by <- function(r) setNames(r$checks, vapply(r$checks, `[[`, "", "code"))

.cmc_campana <- function(..., builder = .cmail_preset_recuperacion) {
  t <- .cmail_template_normalize(builder())
  t$theme <- utils::modifyList(list(accent = "#0b1f54", estilo = "campana"), list(...))
  t
}

# Campaña guardada con el tema pedido.
.cmc_saved <- function(sid, theme, name = "Uno", platform = NULL) {
  c <- collection_mail_campaign_create(sid, .cmc_rev(sid), name = name, platform = platform)
  t <- c$campaign$template
  t$theme <- theme
  p <- collection_mail_template_put(sid, t, .cmc_rev(sid), campaign_id = c$campaign$campaign_id)
  list(id = c$campaign$campaign_id, template = p$template)
}

# ---- tema --------------------------------------------------------------------

test_that("tema: claves cerradas y valores del registro; sin estilo es sobrio", {
  t <- .cmc_campana(page_bg = "#6b3fa0", button_bg = "#f9d53e", button_text = "#0b1f3a",
                    text_align = "center", onda = "pie", onda_color = "#f28c28")
  expect_true(collection_mail_template_validate(.cmail_template_normalize(t))$ok)
  bad <- .cmc_campana(estilo = "vistoso", page_bg = "morado", button_bg = "#fff", button_text = "#12345g",
                      text_align = "right", onda = "arriba", onda_color = "naranja")
  bad$theme$fondo <- "#000000"
  expect_setequal(.cmc_codes(bad), c("bad_estilo", "bad_color", "bad_color", "bad_color", "bad_color",
                                     "bad_text_align", "bad_onda", "unknown_key"))
  expect_setequal(.cmc_paths(bad), paste0("template.theme.", c("estilo", "page_bg", "button_bg", "button_text",
                                                               "onda_color", "text_align", "onda", "fondo")))
  # Las claves de campaña se aceptan con estilo sobrio (cambiar de estilo no las borra) y no pintan nada;
  # page_bg sí pinta en sobrio desde E1p (test-collection-mail-ajustes.R).
  sobrio <- .cmail_template_normalize(.cmail_preset_recuperacion())
  con <- sobrio; con$theme$onda <- "pie"; con$theme$button_bg <- "#f28c28"; con$theme$onda_color <- "#f28c28"
  expect_true(collection_mail_template_validate(con)$ok)
  expect_identical(collection_mail_render(con, "export")$html, collection_mail_render(sobrio, "export")$html)
  expl <- sobrio; expl$theme$estilo <- "sobrio"
  expect_identical(collection_mail_render(expl, "export")$html, collection_mail_render(sobrio, "export")$html)
})

# ---- campaña -------------------------------------------------------------------

test_that("campaña: fondo a todo el ancho, sin tarjeta, texto por contraste, botón píldora y enlaces del color del texto", {
  t <- .cmc_campana(page_bg = "#6b3fa0")
  html <- collection_mail_render(t, "export")$html
  expect_match(html, '<body style="margin:0;padding:0;background-color:#6b3fa0;">', fixed = TRUE)
  expect_match(html, 'width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#6b3fa0" style="background-color:#6b3fa0;"', fixed = TRUE)
  # La columna lleva el fondo; la tarjeta blanca, su borde y su franja de cierre no existen.
  expect_match(html, 'width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#6b3fa0" style="width:100%;max-width:600px;background-color:#6b3fa0;"', fixed = TRUE)
  expect_false(grepl("border-radius:8px", html, fixed = TRUE))
  expect_false(grepl("background-color:#ffffff;\">", html, fixed = TRUE))
  expect_false(grepl("height:4px;line-height:4px", html, fixed = TRUE))
  # Texto blanco (7,38:1 sobre #6b3fa0; el grafito daría menos).
  p <- .cmail_theme_palette(t, "#0b1f54", "#0b1f54")
  expect_identical(p$text, "#ffffff")
  expect_equal(round(.cmail_contrast("#ffffff", "#6b3fa0"), 2), 7.38)
  expect_match(html, "font-size:16px;line-height:26px;color:#ffffff;text-align:justify;", fixed = TRUE)
  # Botón: relleno de la casa, texto automático #0b1f3a (11,5:1), píldora bulletproof.
  expect_identical(p$button_bg, "#f9d53e"); expect_identical(p$button_fg, "#0b1f3a")
  expect_match(html, '<td align="center" bgcolor="#f9d53e" style="background-color:#f9d53e;border-radius:999px;mso-padding-alt:15px 40px;">', fixed = TRUE)
  expect_match(html, 'border:1px solid #f9d53e;border-radius:999px;', fixed = TRUE)
  expect_match(html, "color:#0b1f3a;text-decoration:none;", fixed = TRUE)
  # Atenuado legible: el pie y la firma, #d3c5e2 (4,52:1), y el enlace de baja también.
  expect_identical(p$footer, "#d3c5e2")
  expect_equal(round(.cmail_contrast("#d3c5e2", "#6b3fa0"), 2), 4.52)
  expect_match(html, "font-size:12px;line-height:19px;color:#d3c5e2;", fixed = TRUE)
  expect_match(html, '<a href="*|UNSUB|*" target="_blank" style="color:#d3c5e2;text-decoration:underline;">', fixed = TRUE)
  expect_false(grepl("#555555", html, fixed = TRUE))
  # Recuadro: tono sólido mezclado (#7a52aa), barra del color del botón, título del color del texto.
  expect_identical(p$panel_box, "#7a52aa")
  expect_match(html, 'bgcolor="#7a52aa" style="background-color:#7a52aa;border-left:3px solid #f9d53e;', fixed = TRUE)
  # Firma centrada; saludo a la izquierda (text_align justify).
  expect_match(html, '<td align="center" style="border-top:1px solid #9779bc;', fixed = TRUE)
  expect_match(html, 'padding:36px 48px 20px 48px;font-family:', fixed = TRUE)
  expect_match(html, "color:#ffffff;text-align:left;\"><p style=\"margin:0;\">*|IF:FNAME|*", fixed = TRUE)
  # Enlaces del cuerpo: color del texto, subrayados.
  tl <- t; tl$blocks[[2]]$text <- "Mira [la guía](https://ejemplo.org/guia)."
  expect_match(collection_mail_render(tl, "export")$html,
               '<a href="https://ejemplo.org/guia" target="_blank" style="color:#ffffff;text-decoration:underline;">la guía</a>', fixed = TRUE)
  # Fondo claro: el texto pasa a grafito y el botón amarillo se distingue poco (aviso).
  claro <- .cmail_theme_palette(.cmc_campana(page_bg = "#f3efe6"), "#0b1f54", "#0b1f54")
  expect_identical(claro$text, "#22262e")
  # Sin page_bg: el acento. text_align center: saludo y títulos centrados.
  c2 <- .cmail_theme_palette(.cmc_campana(text_align = "center"), "#0b1f54", "#0b1f54")
  expect_identical(c2$page_bg, "#0b1f54")
  expect_identical(c2$greeting_align, "center")
  expect_identical(c2$heading_align, "center")
  # Botón con texto declarado: se respeta.
  expect_identical(.cmail_theme_palette(.cmc_campana(button_bg = "#1d2f66", button_text = "#ffffff"), "#0b1f54", "#0b1f54")$button_fg, "#ffffff")
})

test_that("campaña: la onda es un PNG 1200 × 80 dentro del ZIP importable; sin onda, nada", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  s <- .cmc_saved(sid, list(accent = "#0b1f54", estilo = "campana", page_bg = "#6b3fa0", onda = "pie", onda_color = "#f28c28"))
  images <- .cmail_images_resolve(session_get(sid), s$template)
  onda <- images[["onda-pie"]]
  expect_true(isTRUE(onda$generated))
  expect_identical(onda$export_name, "onda-pie.png")
  px <- png::readPNG(onda$path)
  expect_identical(dim(px), c(80L, 1200L, 3L))
  hex <- function(v) sprintf("#%02x%02x%02x", round(v[1] * 255), round(v[2] * 255), round(v[3] * 255))
  expect_identical(hex(px[1, 1, ]), "#6b3fa0")    # arriba, el fondo de la página
  expect_identical(hex(px[80, 600, ]), "#f28c28") # abajo, la onda
  # Determinista: la misma pareja de colores reutiliza el mismo archivo.
  expect_identical(.cmail_onda_png("#6b3fa0", "#f28c28"), onda$path)

  html <- collection_mail_render(s$template, "export", images = images)$html
  expect_match(html, '</td></tr><tr><td style="padding:0;line-height:0;font-size:0;"><img src="onda-pie.png" width="600" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:100%;height:auto;"></td></tr></table></body>', fixed = TRUE)
  pv <- collection_mail_render(s$template, "preview", values = list(nombre = "Ana"), images = images)$html
  expect_match(pv, '<img src="data:image/png;base64,', fixed = TRUE)

  .cmail_fx_completar(sid, s$id)
  ex <- collection_mail_export(sid, .cmc_rev(sid), s$id, scope = "plantilla")
  path <- session_get(sid)$files[[ex$zip$file_id]]$path
  entries <- zip::zip_list(path)$filename
  expect_identical(sum(grepl("\\.html$", entries)), 1L)
  expect_setequal(entries[!grepl("\\.html$", entries)], c("logo-cliente.png", "pulso.png", "onda-pie.png"))
  expect_true(.cmail_import_zip_verify(path)$ok)

  # Sin onda: ni imagen ni banda, ni en el ZIP.
  s2 <- .cmc_saved(sid, list(accent = "#0b1f54", estilo = "campana", page_bg = "#6b3fa0"), name = "Dos")
  expect_null(.cmail_images_resolve(session_get(sid), s2$template)[["onda-pie"]])
  .cmail_fx_completar(sid, s2$id)
  ex2 <- collection_mail_export(sid, .cmc_rev(sid), s2$id, scope = "plantilla")
  entries2 <- zip::zip_list(session_get(sid)$files[[ex2$zip$file_id]]$path)$filename
  expect_false("onda-pie.png" %in% entries2)
  expect_length(entries2, 3L)
  h2 <- collection_mail_render(s2$template, "export", images = .cmail_images_resolve(session_get(sid), s2$template))$html
  expect_false(grepl("onda-pie", h2, fixed = TRUE))
  expect_false(grepl("height:24px;line-height:24px", h2, fixed = TRUE))
})

test_that("campaña en SurveyMonkey: la onda sale como banda sólida de 24 px y no exige URL", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  t <- .cmc_campana(page_bg = "#6b3fa0", onda = "pie")
  for (i in seq_along(t$fields)) if (t$fields[[i]]$key == "carrera") t$fields[[i]]$sm <- "CustomData1"
  t$images$`logo-cliente`$url <- "https://pulsopucp.github.io/correo-/logo-cliente.png"
  t$images$pulso$url <- "https://pulsopucp.github.io/correo-/pulso.png"
  images <- .cmail_images_resolve(session_get(sid), t)
  html <- collection_mail_render(t, "export", "surveymonkey", images = images)$html
  expect_match(html, '<tr><td bgcolor="#f9d53e" style="background-color:#f9d53e;height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr></table></body>', fixed = TRUE)
  expect_false(grepl("onda-pie", html, fixed = TRUE))
  expect_true(.cmail_sm_html_verify(html)$ok)
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_image_checks(t, images, html, nchar(html, "bytes"), push, "surveymonkey")
  url <- Filter(function(c) c$code == "images_public_url", checks)[[1]]
  expect_identical(url$status, "ok")
})

# ---- revisión ------------------------------------------------------------------

test_that("revisión: contraste del texto, del botón y del pie, con targets a la Identidad", {
  run <- function(...) {
    checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
    .cmail_campana_checks(.cmc_campana(...), push)
    setNames(checks, vapply(checks, `[[`, "", "code"))
  }
  ok <- run(page_bg = "#6b3fa0")
  expect_identical(names(ok), c("campana_text_contrast", "campana_button_contrast", "campana_footer_contrast"))
  expect_identical(vapply(ok, `[[`, "", "status"), c(campana_text_contrast = "ok", campana_button_contrast = "ok", campana_footer_contrast = "ok"))
  expect_identical(ok$campana_text_contrast$value, 5.81)  # el recuadro (#7a52aa) es el peor caso
  expect_identical(ok$campana_button_contrast$value, 11.5)
  expect_identical(ok$campana_footer_contrast$value, 4.52)

  # Tono medio: ni blanco (4,48:1) ni grafito llegan a 4,5:1 -> error en el texto y en el pie.
  gris <- run(page_bg = "#777777")
  expect_identical(gris$campana_text_contrast$status, "error")
  expect_identical(gris$campana_text_contrast$value, 3.69)
  expect_identical(gris$campana_text_contrast$targets, list(list(block_id = "__identidad", prop = "page_bg")))
  expect_match(gris$campana_text_contrast$detail, "Identidad", fixed = TRUE)
  expect_identical(gris$campana_footer_contrast$status, "error")
  expect_identical(gris$campana_footer_contrast$value, 4.48)
  expect_identical(gris$campana_footer_contrast$targets, list(list(block_id = "__identidad", prop = "page_bg")))

  # Botón ilegible: texto blanco sobre amarillo, 1,44:1 -> error; targets Identidad + el bloque.
  ink <- run(page_bg = "#6b3fa0", button_text = "#ffffff")
  expect_identical(ink$campana_button_contrast$status, "error")
  expect_identical(ink$campana_button_contrast$value, 1.44)
  expect_identical(ink$campana_button_contrast$targets[[1]], list(block_id = "__identidad", prop = "button_bg"))
  expect_identical(ink$campana_button_contrast$targets[[2]]$block_id, "accion")
  # Botón que no resalta: amarillo sobre crema, 1,25:1 -> aviso.
  edge <- run(page_bg = "#f3efe6")
  expect_identical(edge$campana_button_contrast$status, "warning")
  expect_identical(edge$campana_button_contrast$value, 1.25)

  # Sobrio: ninguno de los tres; y en campaña el accent_contrast ya no mira el botón.
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_campana_checks(.cmail_template_normalize(.cmail_preset_recuperacion()), push)
  expect_length(checks, 0L)
  # (la cabecera oscura de logos sí sigue siendo texto blanco sobre el acento).
  claro <- .cmc_campana(page_bg = "#6b3fa0"); claro$theme$accent <- "#f9d53e"
  expect_identical(.cmail_accent_check(claro)$targets, list(list(block_id = "__cabecera")))
  claro$theme$estilo <- "sobrio"
  expect_identical(.cmail_accent_check(claro)$targets, list(list(block_id = "__cabecera"), list(block_id = "accion")))

  # En la revisión real, con el resto de chequeos.
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  s <- .cmc_saved(sid, list(accent = "#0b1f54", estilo = "campana", page_bg = "#777777"))
  by <- .cmc_by(collection_mail_review(sid, campaign_id = s$id, scope = "plantilla"))
  expect_identical(by$campana_text_contrast$status, "error")
  expect_identical(.cmc_err(collection_mail_export(sid, .cmc_rev(sid), s$id, scope = "plantilla"))$code, "E_COLLECTION_MAIL_REVIEW_BLOCKING")
})

# ---- justificado ---------------------------------------------------------------

test_that("justificado por defecto en párrafos, recuadros y listas; a la izquierda en teléfono; nunca saludo, botón, firma ni pie", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- c(t$blocks, list(list(block_id = "lista", type = "list", items = list("Uno", "Dos"))))
  html <- collection_mail_render(t, "export")$html
  style <- '<style type="text/css">@media only screen and (max-width:480px){.cmail-justify{text-align:left !important;}}</style>'
  expect_match(html, style, fixed = TRUE)
  just <- "text-align:justify;text-justify:inter-word;"
  cells <- regmatches(html, gregexpr('<td class="cmail-justify[" ][^>]*>', html))[[1]]
  # 4 párrafos + 1 recuadro + 1 lista.
  expect_length(cells, 6L)
  expect_true(all(grepl(just, cells, fixed = TRUE)))
  expect_identical(lengths(regmatches(html, gregexpr(just, html, fixed = TRUE))), 6L)
  # El saludo, el botón, la firma y el pie no.
  expect_match(html, 'padding:36px 48px 20px 48px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#22262e;text-align:left;', fixed = TRUE)
  expect_false(grepl('class="cmail-justify[^"]*" style="padding:14px 48px 30px', html))
  expect_match(html, '<td align="center" style="padding:20px 30px 32px 30px;', fixed = TRUE)
  # Un párrafo con align propio manda.
  t2 <- t; t2$blocks[[2]]$align <- "left"
  expect_length(regmatches(collection_mail_render(t2, "export")$html, gregexpr('<td class="cmail-justify[" ]', collection_mail_render(t2, "export")$html))[[1]], 5L)
  # text_align left: nada justificado y sin regla en el <head>.
  izq <- t; izq$theme$text_align <- "left"
  h <- collection_mail_render(izq, "export")$html
  expect_false(grepl("cmail-justify", h, fixed = TRUE))
  # Solo la regla de márgenes en teléfono (E1p), que se emite siempre, y la de
  # los logos de la cabecera (E1p logos), que se emite si hay logos.
  expect_identical(lengths(regmatches(h, gregexpr("<style", h, fixed = TRUE))), 2L)
  expect_match(h, .cmail_pad_style(), fixed = TRUE)
  expect_match(h, .cmail_logo_style(h), fixed = TRUE)
  # center: párrafos centrados, listas a la izquierda.
  cen <- t; cen$theme$text_align <- "center"
  hc <- collection_mail_render(cen, "export")$html
  expect_identical(lengths(regmatches(hc, gregexpr("color:#22262e;text-align:center;", hc, fixed = TRUE))), 4L)
  expect_false(grepl("cmail-justify", hc, fixed = TRUE))
})

# ---- cursiva -------------------------------------------------------------------

test_that("cursiva: *…*, **…** y ***…*** en el render; \\* es literal; el texto plano sale sin marcas", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks[[2]]$text <- "Un *estudio de opinión*, **confidencial** y ***breve***; 5\\*3 y 4\\*2 son literales."
  t$subject <- "Encuesta *breve* de **opinión**"
  r <- collection_mail_render(t, "export")
  em <- '<em style="font-style:italic;">'
  expect_match(r$html, sprintf("Un %sestudio de opinión</em>, <strong>confidencial</strong> y %s<strong>breve</strong></em>; 5*3 y 4*2 son literales.", em, em), fixed = TRUE)
  expect_identical(r$subject, "Encuesta breve de opinión")
  expect_match(r$html, "<title>Encuesta breve de opinión</title>", fixed = TRUE)
  # Anidado mixto: el HTML siempre anida.
  expect_identical(.cmail_marks_html("***a** b*"), sprintf("%s<strong>a</strong> b</em>", em))
  expect_identical(.cmail_marks_html("*a **b***"), sprintf("%sa <strong>b</strong></em>", em))
  # Sin pareja o con espacio adentro: literal.
  expect_identical(.cmail_marks_html("a ** b y * c *"), "a ** b y * c *")
  expect_identical(.cmail_marks_html("5*3"), "5*3")
  # No cruza líneas.
  expect_identical(.cmail_marks_html("*uno\ndos*"), "*uno\ndos*")
  # Un * en la URL de un enlace no empareja con el texto.
  tl <- t; tl$blocks[[2]]$text <- "Ver *[guía](https://ejemplo.org/a*b)* y nota*"
  expect_match(collection_mail_render(tl, "export")$html,
               sprintf('Ver %s<a href="https://ejemplo.org/a*b" target="_blank" style="color:#0b1f54;text-decoration:underline;">guía</a></em> y nota*', em), fixed = TRUE)
  # SurveyMonkey: el mismo HTML de marcas, nada de asteriscos sueltos.
  for (i in seq_along(t$fields)) if (t$fields[[i]]$key == "carrera") t$fields[[i]]$sm <- "CustomData1"
  sm <- collection_mail_render(t, "export", "surveymonkey")$html
  expect_match(sm, sprintf("Un %sestudio de opinión</em>", em), fixed = TRUE)
  expect_false(grepl("*estudio", sm, fixed = TRUE))
  # La cursiva no rompe la validación.
  expect_true(collection_mail_template_validate(t)$ok)
})

test_that("cursiva en el importador: <em>, <i> y font-style:italic pasan a *…*; los asteriscos literales se escapan; ida y vuelta", {
  r <- .cmail_import_html_parse(charToRaw(enc2utf8(paste0(
    '<html><body><p>Hola,</p>',
    '<p>Un <em>estudio</em>, una <i>encuesta</i> y <span style="font-style: italic">otra</span>; ',
    '<strong><i>ambas</i></strong> y <i><b>al revés</b></i>.</p>',
    '<p>Cuenta 5*3 y 4*2 sin cursiva.</p>',
    '<p><em>Dos</em> <em>seguidas</em> y <em> </em>vacía.</p></body></html>'))))
  texts <- vapply(Filter(function(b) identical(b$type, "paragraph"), r$template$blocks), `[[`, "", "text")
  expect_true("Un *estudio*, una *encuesta* y *otra*; ***ambas*** y ***al revés***." %in% texts)
  expect_true("Cuenta 5\\*3 y 4\\*2 sin cursiva." %in% texts)
  expect_true("*Dos seguidas* y vacía." %in% texts)
  expect_false("italic_plain" %in% vapply(r$report, `[[`, "", "code"))
  # Renderizado: la cursiva vuelve, el literal se lee igual que en el origen.
  html <- collection_mail_render(r$template, "export")$html
  expect_match(html, "Cuenta 5*3 y 4*2 sin cursiva.", fixed = TRUE)
  expect_match(html, 'Un <em style="font-style:italic;">estudio</em>', fixed = TRUE)
  # Ida y vuelta: exportar e importar de nuevo da los mismos textos.
  again <- .cmail_import_html_parse(charToRaw(enc2utf8(html)))
  texts2 <- vapply(Filter(function(b) identical(b$type, "paragraph"), again$template$blocks), `[[`, "", "text")
  expect_identical(intersect(texts, texts2), texts)
})

test_that("vista previa en campaña: el dato de la persona se marca con subrayado, no con el tinte claro que no se lee sobre fondo oscuro", {
  t <- .cmc_campana(page_bg = "#0b1f54")
  pv <- collection_mail_render(t, "preview", values = list(nombre = "Ana"))$html
  expect_match(pv, 'data-pulso-field="nombre" style="border-bottom:1px dashed currentColor;">Ana', fixed = TRUE)
  expect_false(grepl(sprintf('data-pulso-field="nombre" style="background:%s', .CMAIL_FIELD_TINT), pv, fixed = TRUE))
  sobrio <- t; sobrio$theme$estilo <- "sobrio"
  pvs <- collection_mail_render(sobrio, "preview", values = list(nombre = "Ana"))$html
  expect_match(pvs, sprintf('data-pulso-field="nombre" style="background:%s;', .CMAIL_FIELD_TINT), fixed = TRUE)
})
