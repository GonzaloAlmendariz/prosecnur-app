# Ajustes del bloque (checklist-ajustes-bloque-2026-10-23, ítems 1–3):
# alineación clásica (con derecha), tamaño y tono del párrafo con más pasos y el
# respaldo del tono acento cuando el acento no se lee sobre la tarjeta. Sin red.

.cmab_codes <- function(template) {
  v <- collection_mail_template_validate(.cmail_template_normalize(template))
  vapply(v$problems, function(p) p$code, "")
}

.cmab_with <- function(blocks, accent = NULL, estilo = NULL, page_bg = NULL) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, blocks, after = 2L)
  if (!is.null(accent)) t$theme$accent <- accent
  if (!is.null(estilo)) t$theme$estilo <- estilo
  if (!is.null(page_bg)) t$theme$page_bg <- page_bg
  .cmail_template_normalize(t)
}

.cmab_par <- function(id, ...) c(list(block_id = id, type = "paragraph", text = paste("MARCA", id)), list(...))

# Estilo inline de la celda que contiene el texto «MARCA <id>».
.cmab_td_style <- function(html, id) {
  re <- sprintf('<td[^>]*style="([^"]*)"[^>]*>(?:(?!<td).)*?MARCA %s<', id)
  m <- regmatches(html, regexec(re, html, perl = TRUE))[[1]]
  expect_length(m, 2L)
  m[[2]]
}

.cmab_html <- function(t) collection_mail_render(t, "export", "mailchimp")$html

.cmab_checks <- function(t) {
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_paragraph_tone_checks(t, push)
  Filter(function(c) identical(c$code, "paragraph_accent_contrast"), checks)
}

# ---- validación ------------------------------------------------------------------

test_that("los valores nuevos de align, size y tone validan; los inválidos se rechazan", {
  ok <- .cmab_with(list(
    .cmab_par("p-der", align = "right"), .cmab_par("p-cen", align = "center"),
    .cmab_par("p-jus", align = "justify"), .cmab_par("p-izq", align = "left"),
    .cmab_par("p-gra", size = "grande"), .cmab_par("p-mgr", size = "muy_grande"),
    .cmab_par("p-peq", size = "pequeno"), .cmab_par("p-acc", tone = "acento"),
    .cmab_par("p-sua", tone = "suave"),
    list(block_id = "t-der", type = "heading", text = "Título", align = "right"),
    list(block_id = "b-der", type = "button", text = "Ir", url = "https://pulso.pucp.edu.pe/", align = "right")
  ))
  v <- collection_mail_template_validate(ok)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))

  expect_true("bad_size" %in% .cmab_codes(.cmab_with(list(.cmab_par("x", size = "enorme")))))
  expect_true("bad_tone" %in% .cmab_codes(.cmab_with(list(.cmab_par("x", tone = "rojo")))))
  expect_true("bad_align" %in% .cmab_codes(.cmab_with(list(.cmab_par("x", align = "inherit")))))
  # Justificado sigue siendo solo del párrafo.
  expect_true("bad_align" %in% .cmab_codes(.cmab_with(list(list(block_id = "t", type = "heading", text = "T", align = "justify")))))
  expect_true("bad_align" %in% .cmab_codes(.cmab_with(list(list(block_id = "b", type = "button", text = "Ir",
                                                                 url = "https://pulso.pucp.edu.pe/", align = "justify")))))
  # El tono acento es del párrafo, no del botón (que no tiene `tone`).
  expect_true("bad_size" %in% .cmab_codes(.cmab_with(list(list(block_id = "b", type = "button", text = "Ir",
                                                                url = "https://pulso.pucp.edu.pe/", size = "muy_grande")))))
})

# ---- render ------------------------------------------------------------------------

test_that("el tamaño del párrafo se traduce a font-size/line-height inline", {
  html <- .cmab_html(.cmab_with(list(
    .cmab_par("peq", size = "pequeno"), .cmab_par("nor"), .cmab_par("nor2", size = "normal"),
    .cmab_par("gra", size = "grande"), .cmab_par("mgr", size = "muy_grande")
  )))
  expect_match(.cmab_td_style(html, "peq"), "font-size:13px;line-height:20px;", fixed = TRUE)
  expect_match(.cmab_td_style(html, "nor"), "font-size:16px;line-height:26px;", fixed = TRUE)
  expect_match(.cmab_td_style(html, "nor2"), "font-size:16px;line-height:26px;", fixed = TRUE)
  expect_match(.cmab_td_style(html, "gra"), "font-size:18px;line-height:28px;", fixed = TRUE)
  expect_match(.cmab_td_style(html, "mgr"), "font-size:21px;line-height:32px;", fixed = TRUE)
})

test_that("align right sale como text-align:right en párrafo y título, y alinea la tabla del botón", {
  html <- .cmab_html(.cmab_with(list(
    .cmab_par("der", align = "right"),
    list(block_id = "t-der", type = "heading", text = "MARCA tit", align = "right"),
    list(block_id = "b-der", type = "button", text = "MARCA btn", url = "https://pulso.pucp.edu.pe/",
         note = list("MARCA nota"), align = "right")
  )))
  expect_match(.cmab_td_style(html, "der"), "text-align:right;", fixed = TRUE)
  expect_match(.cmab_td_style(html, "tit"), "text-align:right;", fixed = TRUE)
  expect_match(html, '<td align="right" class="cmail-pad" style="padding:14px 48px 30px 48px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">', fixed = TRUE)
  expect_match(html, "text-align:right;\"><span>MARCA nota", fixed = TRUE)
})

test_that("tono acento: el color del acento si se lee sobre la tarjeta blanca", {
  t <- .cmab_with(list(.cmab_par("acc", tone = "acento"), .cmab_par("sua", tone = "suave"), .cmab_par("nor")),
                  accent = "#0B1F54")
  html <- .cmab_html(t)
  expect_match(.cmab_td_style(html, "acc"), "color:#0b1f54;", fixed = TRUE)
  expect_match(.cmab_td_style(html, "sua"), sprintf("color:%s;", .CMAIL_MUTED), fixed = TRUE)
  expect_match(.cmab_td_style(html, "nor"), sprintf("color:%s;", .CMAIL_TEXT_COLOR), fixed = TRUE)
  chk <- .cmab_checks(t)
  expect_length(chk, 1L)
  expect_identical(chk[[1]]$status, "ok")
})

test_that("tono acento sin contraste: texto normal y aviso paragraph_accent_contrast", {
  t <- .cmab_with(list(.cmab_par("acc", tone = "acento")), accent = "#f9d53e")
  expect_lt(.cmail_contrast("#f9d53e", "#ffffff"), .CMAIL_CONTRAST_MIN)
  html <- .cmab_html(t)
  st <- .cmab_td_style(html, "acc")
  expect_match(st, sprintf("color:%s;", .CMAIL_TEXT_COLOR), fixed = TRUE)
  expect_false(grepl("color:#f9d53e;", st, fixed = TRUE))
  chk <- .cmab_checks(t)
  expect_length(chk, 1L)
  expect_identical(chk[[1]]$status, "warning")
  expect_identical(chk[[1]]$targets[[1]]$block_id, "acc")
  expect_match(chk[[1]]$detail, "#f9d53e", fixed = TRUE)

  # Campaña: el fondo es la página (por defecto, el acento): el acento no se lee.
  tc <- .cmab_with(list(.cmab_par("acc", tone = "acento")), accent = "#0b1f54", estilo = "campana")
  pal <- .cmail_theme_palette(tc, "#0b1f54", "#0b1f54")
  expect_match(.cmab_td_style(.cmab_html(tc), "acc"), sprintf("color:%s;", pal$text), fixed = TRUE)
  expect_identical(.cmab_checks(tc)[[1]]$status, "warning")
  # Campaña sobre página clara: el acento oscuro sí se lee.
  tl <- .cmab_with(list(.cmab_par("acc", tone = "acento")), accent = "#0b1f54", estilo = "campana", page_bg = "#ffffff")
  expect_match(.cmab_td_style(.cmab_html(tl), "acc"), "color:#0b1f54;", fixed = TRUE)
  expect_identical(.cmab_checks(tl)[[1]]$status, "ok")
})

test_that("sin párrafos en acento no aparece el chequeo; la revisión lo incluye cuando los hay", {
  expect_length(.cmab_checks(.cmab_with(list(.cmab_par("x")))), 0L)
  t <- .cmab_with(list(.cmab_par("acc", tone = "acento")), accent = "#f9d53e")
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  html <- .cmab_html(t)
  .cmail_image_checks(t, list(), html, nchar(html, "bytes"), push)
  expect_true("paragraph_accent_contrast" %in% vapply(checks, `[[`, "", "code"))
})

# ---- importador ---------------------------------------------------------------------

test_that("el importador lee text-align:right en párrafos y títulos", {
  html <- paste0('<html><body><table><tr><td>',
                 '<h2 style="text-align:right">Un título a la derecha</h2>',
                 '<p style="text-align: right;">Un párrafo a la derecha con texto suficiente.</p>',
                 '<p>Otro párrafo sin alineación propia.</p>',
                 '</td></tr></table></body></html>')
  blocks <- .cmail_import_html_parse(charToRaw(enc2utf8(html)))$template$blocks
  h <- Filter(function(b) identical(b$type, "heading"), blocks)[[1]]
  expect_identical(h$align, "right")
  ps <- Filter(function(b) identical(b$type, "paragraph"), blocks)
  der <- Filter(function(b) grepl("a la derecha con", b$text, fixed = TRUE), ps)[[1]]
  expect_identical(der$align, "right")
  otro <- Filter(function(b) grepl("sin alineación", b$text, fixed = TRUE), ps)[[1]]
  expect_null(otro$align)
})
