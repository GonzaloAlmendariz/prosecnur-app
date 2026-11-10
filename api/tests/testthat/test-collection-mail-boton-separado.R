# El botón separado del premio (Acreditación 2026, R4): un bloque Botón suelto
# después de los párrafos y, debajo, el Destacado del sorteo sin botón propio.
# El HTML de Mailchimp respeta ese orden y el premio no emite un segundo botón.

.cmbs_tpl <- function(con_boton_en_el_premio = FALSE) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  premio <- list(block_id = "sorteo", type = "feature", title = "Al responder podrá entrar al sorteo de una tablet",
                 align = "center")
  if (con_boton_en_el_premio) premio <- c(premio, list(button_text = "Responda y participe", url = "{{enlace}}"))
  boton <- list(block_id = "responder", type = "button", text = "Responda la encuesta aquí", url = "{{enlace}}")
  tipos <- vapply(t$blocks, `[[`, "", "type")
  # Sin el botón del preset: el único es el que se prueba.
  t$blocks <- t$blocks[tipos != "button"]
  despues <- max(which(vapply(t$blocks, `[[`, "", "type") == "paragraph"))
  t$blocks <- append(t$blocks, list(boton, premio), after = despues)
  .cmail_template_normalize(t)
}

.cmbs_html <- function(t) collection_mail_render(.cmail_template_for_send(t, NULL), mode = "export", dialect = "mailchimp")$html

test_that("el botón suelto va antes del premio y el premio sin botón no emite otro", {
  t <- .cmbs_tpl()
  v <- collection_mail_template_validate(t)
  expect_true(v$ok, info = paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; "))
  html <- .cmbs_html(t)
  boton <- regexpr("Responda la encuesta aquí", html, fixed = TRUE)
  premio <- regexpr("sorteo de una tablet", html, fixed = TRUE)
  expect_gt(boton, 0)
  expect_gt(premio, boton)
  # Un solo enlace a la encuesta: el del botón suelto.
  expect_identical(lengths(regmatches(html, gregexpr("*|ENLACE|*", html, fixed = TRUE))), 1L)
  expect_false(grepl("Responda y participe", html, fixed = TRUE))
})

test_that("con el botón en el premio salen dos enlaces, en el orden de los bloques", {
  html <- .cmbs_html(.cmbs_tpl(con_boton_en_el_premio = TRUE))
  expect_identical(lengths(regmatches(html, gregexpr("*|ENLACE|*", html, fixed = TRUE))), 2L)
  expect_gt(regexpr("Responda y participe", html, fixed = TRUE), regexpr("Responda la encuesta aquí", html, fixed = TRUE))
})
