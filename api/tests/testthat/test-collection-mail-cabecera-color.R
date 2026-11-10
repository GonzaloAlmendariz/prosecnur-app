# Color propio de la franja de logos oscura (GOAL editor de correos profesional,
# L15): en Acreditación 2026 la franja era #022051 y el acento #004dac, y la
# cabecera se tuvo que componer fuera como una sola imagen. Sin red.

.cmcc_tpl <- function(header) {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$theme$accent <- "#004dac"
  t$header <- utils::modifyList(list(kind = "logos", logo_ids = list("logo-cliente", "pulso"), background = "dark"), header)
  .cmail_template_normalize(t)
}

test_that("la franja oscura toma su color propio, y la línea entre logos sale de ese color", {
  html <- collection_mail_render(.cmcc_tpl(list(color = "#022051")), "export", "mailchimp")$html
  expect_match(html, '<td bgcolor="#022051" align="left" class="cmail-pad" style="background-color:#022051;', fixed = TRUE)
  expect_false(grepl('bgcolor="#004dac" align="left"', html, fixed = TRUE))
  expect_match(html, sprintf("background-color:%s;line-height:46px", .cmail_mix("#ffffff", "#022051", 0.35)), fixed = TRUE)
  # Mayúsculas en el color: el render lo escribe en minúsculas.
  up <- collection_mail_render(.cmcc_tpl(list(color = "#02205A")), "export")$html
  expect_match(up, 'bgcolor="#02205a"', fixed = TRUE)
})

test_that("sin color propio la franja es el acento, con el HTML de siempre", {
  sin <- collection_mail_render(.cmcc_tpl(list()), "export", "mailchimp")$html
  expect_match(sin, '<td bgcolor="#004dac" align="left"', fixed = TRUE)
  expect_match(sin, "background-color:#5a6a94;line-height:46px", fixed = TRUE)
})

test_that("con fondo claro el color no se usa (la franja clara es blanca)", {
  claro <- collection_mail_render(.cmcc_tpl(list(background = "light", color = "#022051")), "export", "mailchimp")$html
  expect_false(grepl("#022051", claro, fixed = TRUE))
  expect_match(claro, '<td bgcolor="#ffffff" align="center"', fixed = TRUE)
})

test_that("el color se valida como #rrggbb", {
  ok <- collection_mail_template_validate(.cmcc_tpl(list(color = "#022051")))
  expect_true(ok$ok, info = paste(vapply(ok$problems, `[[`, "", "detail"), collapse = "; "))
  mal <- collection_mail_template_validate(.cmcc_tpl(list(color = "azul marino")))
  expect_true("bad_color" %in% vapply(mal$problems, `[[`, "", "code"))
  expect_true(any(vapply(mal$problems, function(p) identical(p$path, "template.header.color"), NA)))
})
