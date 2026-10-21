# Los elementos gráficos del correo no se deforman: un logo muy ancho conserva
# su proporción cuando su ancho llega al tope de la cabecera (200 px).

test_that("un logo de 10:1 baja la altura en vez de aplastarse; uno común no cambia", {
  tpl <- .cmail_template_normalize(.cmail_preset_recuperacion())
  imgs <- .cmail_fx_parity_images()
  imgs[["logo-cliente"]]$size <- list(width = 1000L, height = 100L)
  imgs[["logo-cliente"]]$url <- "https://pulsopucp.github.io/correo-/ancho.png"
  html <- collection_mail_render(tpl, "export", images = imgs)$html
  # 1000:100 a tope de 200 px → 20 px de alto (antes: 200 × 46, aplastado a 4,3:1).
  expect_match(html, 'src="https://pulsopucp.github.io/correo-/ancho.png" width="200" height="20"', fixed = TRUE)
  expect_false(grepl('ancho.png" width="200" height="46"', html, fixed = TRUE))
  # El logo de Pulso (300:92) cabe a 46 px de alto (cabecera oscura): sigue igual que antes (paridad).
  expect_match(html, 'pulso.png" width="150" height="46"', fixed = TRUE)
})
