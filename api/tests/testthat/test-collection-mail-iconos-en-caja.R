# Íconos de Beneficios dentro de una caja (estilo propio del bloque): el render
# los pinta con la paleta de la caja (blancos sobre el acento) y el ZIP debe
# llevar ESOS archivos. En Acreditación 2026 la exportación a Mailchimp fallaba:
# «src sin archivo en el ZIP: icono-reloj-ffffff.png, icono-candado-ffffff.png». Sin red.

.cmic_tpl <- function(box = list(bg = "acento", corners = "suaves", spacing = "compacto")) {
  t <- .cmail_template_normalize(.cmail_preset_invitacion_encuesta())
  t$theme$accent <- "#004dac"
  t$blocks <- append(t$blocks, list(list(block_id = "datos", type = "benefits", box = box,
    entries = list(list(title = "Duración aproximada", text = "10 minutos", icon = "reloj"),
                   list(title = "Confidencialidad", text = "Sus respuestas son confidenciales", icon = "candado")))), after = 1L)
  .cmail_template_normalize(t)
}

.cmic_srcs <- function(html) unique(sub('.*src="([^"]+)".*', "\\1", regmatches(html, gregexpr('src="icono-[^"]+"', html))[[1]]))

test_that("cada ícono que el HTML pide dentro de una caja acento está entre las imágenes del ZIP", {
  t <- .cmic_tpl()
  imgs <- .cmail_piezas_images(t)
  html <- collection_mail_render(t, mode = "export", dialect = "mailchimp", images = imgs)$html
  pedidos <- .cmic_srcs(html)
  expect_true(length(pedidos) >= 2L)
  expect_setequal(pedidos, paste0(names(imgs)[grepl("^icono-", names(imgs))], ".png"))
  expect_true(all(grepl("ffffff", pedidos)))
})

test_that("sin caja, los íconos siguen en el color del acento", {
  t <- .cmic_tpl(box = NULL)
  t$blocks[[2]]$box <- NULL
  imgs <- .cmail_piezas_images(t)
  html <- collection_mail_render(t, mode = "export", dialect = "mailchimp", images = imgs)$html
  expect_setequal(.cmic_srcs(html), paste0(names(imgs)[grepl("^icono-", names(imgs))], ".png"))
  expect_false(any(grepl("ffffff", names(imgs))))
})
