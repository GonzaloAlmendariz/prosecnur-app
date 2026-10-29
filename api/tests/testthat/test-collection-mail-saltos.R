# Un salto de línea en el texto de un bloque sale como <br> (Acreditación 2026:
# el saludo «Estimado(a) profesor(a)» y el nombre debajo salían en una línea). Sin red.

test_that("el saludo en dos líneas sale con <br> y sin &#10; en el export y en la vista previa", {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  g <- which(vapply(t$blocks, function(b) identical(b$type, "greeting"), NA))
  t$blocks[[g]]$text <- "**Estimado(a) profesor(a)**\n**{{nombre}}**"
  t$blocks[[g]]$fallback <- "**Estimado(a) profesor(a)**"
  t$blocks[[g]]$trato <- NULL
  t <- .cmail_template_normalize(t)
  for (mode in c("export", "preview")) {
    html <- collection_mail_render(t, mode = mode, dialect = "mailchimp", values = list(nombre = "Ana"))$html
    expect_match(html, "<strong>Estimado(a) profesor(a)</strong><br><strong>", fixed = TRUE, label = mode)
    expect_false(grepl("&#10;<strong>", html, fixed = TRUE), label = mode)
  }
  expect_identical(.cmail_inline("a\r\nb", list(link = "#000")), "a<br>b")
})
