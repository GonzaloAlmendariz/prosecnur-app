# Estilo propio del bloque, la «caja» (GOAL editor de correos profesional, L2;
# collection_mail_box.R): fondo, borde, esquinas, espaciado y color de texto,
# cada uno traducido a CSS inline; sin caja, el HTML de siempre. Sin red.

.cmbx_tpl <- function(blocks = list(), accent = NULL, estilo = NULL) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- append(t$blocks, blocks, after = 2L)
  if (!is.null(accent)) t$theme$accent <- accent
  if (!is.null(estilo)) t$theme$estilo <- estilo
  .cmail_template_normalize(t)
}

.cmbx_par <- function(id, box = NULL, ...) {
  b <- c(list(block_id = id, type = "paragraph", text = paste("MARCA", id)), list(...))
  if (!is.null(box)) b$box <- box
  b
}

.cmbx_html <- function(t) collection_mail_render(t, "export", "mailchimp")$html

.cmbx_codes <- function(t) {
  v <- collection_mail_template_validate(t)
  vapply(v$problems, function(p) p$code, "")
}

# La celda de la caja que envuelve el texto «MARCA <id>»: su estilo inline.
.cmbx_box_style <- function(html, id) {
  re <- sprintf('<td bgcolor="[^"]*" style="([^"]*)"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">(?:(?!</table>).)*?MARCA %s<', id)
  m <- regmatches(html, regexec(re, html, perl = TRUE))[[1]]
  expect_length(m, 2L)
  m[[2]]
}

# El estilo de la celda de texto que contiene «MARCA <id>».
.cmbx_text_style <- function(html, id) {
  re <- sprintf('<td[^>]*style="([^"]*)"[^>]*><p style="margin:0;">MARCA %s<', id)
  m <- regmatches(html, regexec(re, html, perl = TRUE))[[1]]
  expect_length(m, 2L)
  m[[2]]
}

# ---- paridad --------------------------------------------------------------------

# La paridad con el render anterior a la caja se midió contra el código previo
# (252 renders: 3 presets × sobrio/campaña × 3 anchos × modos × dialectos,
# 0 distintos; verificador del 2026-10-23). Este test cuida lo que sigue: que la
# caja no deje huella fuera de su bloque.
test_that("sin caja no hay regla de teléfono de la caja, y una caja no deja huella en los demás bloques", {
  t <- .cmbx_tpl(list(.cmbx_par("p1")))
  html <- .cmbx_html(t)
  expect_false(grepl("cmail-box", html, fixed = TRUE))
  # Un bloque con caja no cambia los demás: quitarla devuelve el HTML de antes.
  con <- .cmbx_tpl(list(.cmbx_par("p1", box = list(bg = "tinte"))))
  sin <- con
  sin$blocks <- lapply(sin$blocks, function(b) { b$box <- NULL; b })
  expect_identical(.cmbx_html(.cmail_template_normalize(sin)), html)
  expect_true(grepl("cmail-box", .cmbx_html(con), fixed = TRUE))
})

# ---- un control por test ---------------------------------------------------------

test_that("fondo: los nombres de la paleta se resuelven y el color libre pasa tal cual", {
  t <- .cmbx_tpl(list(
    .cmbx_par("bt", box = list(bg = "tinte")), .cmbx_par("ba", box = list(bg = "acento")),
    .cmbx_par("bp", box = list(bg = "papel")), .cmbx_par("bl", box = list(bg = "#F3E9D2"))
  ), accent = "#0b1f54")
  html <- .cmbx_html(t)
  expect_match(.cmbx_box_style(html, "bt"), sprintf("background-color:%s;", .cmail_tint("#0b1f54")), fixed = TRUE)
  expect_match(.cmbx_box_style(html, "ba"), "background-color:#0b1f54;", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "bp"), "background-color:#ffffff;", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "bl"), "background-color:#f3e9d2;", fixed = TRUE)
  # bgcolor también, para Outlook.
  expect_match(html, sprintf('<td bgcolor="%s"', .cmail_tint("#0b1f54")), fixed = TRUE)
})

test_that("el fondo «tinte» sigue al acento: cambiar el acento re-viste la caja", {
  a <- .cmbx_html(.cmbx_tpl(list(.cmbx_par("x", box = list(bg = "tinte"))), accent = "#0b1f54"))
  b <- .cmbx_html(.cmbx_tpl(list(.cmbx_par("x", box = list(bg = "tinte"))), accent = "#2f5d34"))
  expect_match(.cmbx_box_style(a, "x"), .cmail_tint("#0b1f54"), fixed = TRUE)
  expect_match(.cmbx_box_style(b, "x"), .cmail_tint("#2f5d34"), fixed = TRUE)
})

test_that("borde: ninguno, fino y acento", {
  html <- .cmbx_html(.cmbx_tpl(list(
    .cmbx_par("n", box = list(border = "ninguno")), .cmbx_par("f", box = list(border = "fino")),
    .cmbx_par("a", box = list(border = "acento"))
  ), accent = "#0b1f54"))
  expect_false(grepl("border", sub("border-radius:[0-9]+px;", "", .cmbx_box_style(html, "n"))))
  expect_match(.cmbx_box_style(html, "f"), "border:1px solid #", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "a"), "border-left:4px solid #0b1f54;", fixed = TRUE)
})

test_that("esquinas: rectas 0, suaves 8 y redondas 16", {
  html <- .cmbx_html(.cmbx_tpl(list(
    .cmbx_par("r", box = list(corners = "rectas")), .cmbx_par("s", box = list(corners = "suaves")),
    .cmbx_par("o", box = list(corners = "redondas"))
  )))
  expect_match(.cmbx_box_style(html, "r"), "border-radius:0px;", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "s"), "border-radius:8px;", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "o"), "border-radius:16px;", fixed = TRUE)
})

test_that("espaciado: compacto, normal y amplio cambian el margen de arriba y abajo", {
  html <- .cmbx_html(.cmbx_tpl(list(
    .cmbx_par("c", box = list(spacing = "compacto")), .cmbx_par("n", box = list(spacing = "normal")),
    .cmbx_par("a", box = list(spacing = "amplio"))
  )))
  expect_match(.cmbx_box_style(html, "c"), "padding:12px 0 0px 0;", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "n"), "padding:20px 0 4px 0;", fixed = TRUE)
  expect_match(.cmbx_box_style(html, "a"), "padding:36px 0 20px 0;", fixed = TRUE)
})

test_that("color de texto: automático elige la tinta que se lee; los fijos se respetan", {
  html <- .cmbx_html(.cmbx_tpl(list(
    .cmbx_par("auto-oscuro", box = list(bg = "acento", text = "auto")),
    .cmbx_par("auto-claro", box = list(bg = "tinte", text = "auto")),
    .cmbx_par("blanco", box = list(bg = "#1d2433", text = "blanco")),
    .cmbx_par("acento", box = list(bg = "papel", text = "acento"))
  ), accent = "#0b1f54"))
  expect_match(.cmbx_text_style(html, "auto-oscuro"), "color:#ffffff;", fixed = TRUE)
  expect_match(.cmbx_text_style(html, "auto-claro"), sprintf("color:%s;", .CMAIL_TEXT_COLOR), fixed = TRUE)
  expect_match(.cmbx_text_style(html, "blanco"), "color:#ffffff;", fixed = TRUE)
  expect_match(.cmbx_text_style(html, "acento"), "color:#0b1f54;", fixed = TRUE)
  # La tinta automática siempre llega al mínimo de contraste.
  for (bg in c("#0b1f54", "#e3a72f", "#7a1f35", "#f3e9d2", "#c9a24a")) {
    ctx <- .cmail_box_ctx(.cmail_box_of(list(type = "paragraph", box = list(bg = bg))),
                          list(pal = .cmail_theme_palette(list(theme = list()), "#0b1f54", "#0b1f54"), accent = "#0b1f54"))
    expect_gte(.cmail_contrast(ctx$pal$text, bg), .CMAIL_CONTRAST_MIN)
  }
})

test_that("dentro de la caja el texto queda a 48 px del borde, como fuera, y a 24 en teléfono", {
  html <- .cmbx_html(.cmbx_tpl(list(.cmbx_par("p", box = list(bg = "tinte")))))
  # Caja a 24 px del borde + celda a 24 px = 48.
  expect_match(html, 'class="cmail-box" style="padding:0 24px 16px 24px;"', fixed = TRUE)
  expect_match(.cmbx_text_style(html, "p"), "padding:0 24px 18px 24px;", fixed = TRUE)
  expect_match(html, "\\.cmail-box\\{padding-left:12px !important;padding-right:12px !important;\\}")
  expect_match(html, ".cmail-box .cmail-pad{padding-left:12px !important;padding-right:12px !important;}", fixed = TRUE)
})

test_that("un botón sobre una caja de su mismo color invierte sus colores", {
  t <- .cmbx_tpl(list(list(block_id = "btn", type = "button", text = "MARCA btn", url = "https://pulso.pucp.edu.pe/",
                           box = list(bg = "acento"))), accent = "#0b1f54")
  html <- .cmbx_html(t)
  cell <- regmatches(html, regexpr('<td align="center" bgcolor="[^"]*"', html))
  expect_match(cell, 'bgcolor="#ffffff"', fixed = TRUE)
})

test_that("dentro de la caja una imagen con margen conserva su ancho; la de sangre llena la caja", {
  t <- .cmbx_tpl()
  t$images$foto <- list(alt = "Foto")
  img <- list(foto = list(size = list(width = 1600L, height = 900L), url = "https://pulso.pucp.edu.pe/foto.png"))
  con <- function(box, bleed) {
    b <- list(block_id = "im", type = "image", image_ref = "foto", alt = "Foto")
    if (bleed) b$bleed <- TRUE
    if (!is.null(box)) b$box <- box
    ctx <- list(pal = .cmail_theme_palette(t, "#0b1f54", "#0b1f54"), accent = "#0b1f54", width = 600L,
                images = img, export = FALSE)
    html <- .cmail_block_html(b, ctx)
    expect_match(html, "<img ", fixed = TRUE)
    as.integer(sub('.*<img [^>]*width="([0-9]+)".*', "\\1", html))
  }
  expect_identical(con(NULL, FALSE), 600L)
  expect_identical(con(list(bg = "tinte"), FALSE), con(NULL, FALSE))
  expect_identical(con(NULL, TRUE), 600L)
  expect_identical(con(list(bg = "tinte"), TRUE), 552L)
})

test_that("en la vista previa, un campo dentro de una caja oscura se marca con subrayado, no con el tinte claro", {
  t <- .cmbx_tpl(list(
    list(block_id = "osc", type = "paragraph", text = "Hola {{nombre}} MARCA osc", box = list(bg = "acento")),
    list(block_id = "cla", type = "paragraph", text = "Hola {{nombre}} MARCA cla", box = list(bg = "tinte"))
  ), accent = "#0b1f54")
  html <- collection_mail_render(t, "preview", "mailchimp", values = list(nombre = "Ana"))$html
  osc <- regmatches(html, regexpr('<span data-pulso-field="nombre" style="[^"]*">Ana</span> MARCA osc', html))
  cla <- regmatches(html, regexpr('<span data-pulso-field="nombre" style="[^"]*">Ana</span> MARCA cla', html))
  expect_match(osc, "border-bottom:1px dashed currentColor;", fixed = TRUE)
  expect_match(cla, sprintf("background:%s;", .CMAIL_FIELD_TINT), fixed = TRUE)
})

# ---- validación -------------------------------------------------------------------

test_that("la caja valida sus cinco controles y rechaza lo demás", {
  ok <- .cmbx_tpl(list(.cmbx_par("p", box = list(bg = "#a1b2c3", border = "fino", corners = "redondas",
                                                   spacing = "amplio", text = "blanco"))))
  v <- collection_mail_template_validate(ok)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))

  expect_true("bad_box_bg" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(bg = "rojo"))))))
  expect_true("bad_box_bg" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(bg = "#abc"))))))
  expect_true("bad_box_border" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(border = "doble"))))))
  expect_true("bad_box_corners" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(corners = "12px"))))))
  expect_true("bad_box_spacing" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(spacing = "enorme"))))))
  expect_true("bad_box_text" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(text = "rojo"))))))
  # Nada de CSS libre.
  expect_true("unknown_key" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = list(css = "color:red"))))))
  expect_true("bad_box" %in% .cmbx_codes(.cmbx_tpl(list(.cmbx_par("p", box = "tinte")))))
  # El pie legal no admite caja.
  t <- .cmbx_tpl()
  i <- which(vapply(t$blocks, function(b) identical(b$type, "footer_legal"), logical(1)))[1]
  t$blocks[[i]]$box <- list(bg = "tinte")
  expect_true("unknown_key" %in% .cmbx_codes(t))
})

test_that("todo tipo de bloque salvo el pie legal admite caja", {
  tipos <- setdiff(names(.CMAIL_BLOCK_KEYS), .CMAIL_BOX_EXCLUDED)
  expect_true(all(vapply(tipos, function(k) "box" %in% .CMAIL_BLOCK_KEYS[[k]], logical(1))))
  expect_false("box" %in% .CMAIL_BLOCK_KEYS$footer_legal)
})

test_that("la caja no se lee como texto del usuario ni como campo", {
  t <- .cmbx_tpl(list(.cmbx_par("p", box = list(bg = "tinte", text = "auto"))))
  expect_true("box" %in% .CMAIL_NON_TEXT_KEYS)
  expect_false(any(vapply(.cmail_key_targets(t, c("tinte", "auto")), function(x) identical(x$prop, "box"), logical(1))))
})
