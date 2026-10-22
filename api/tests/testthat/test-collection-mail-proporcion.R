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

test_that("los logos de 12:1, 20:1 y 40:1 conservan su proporción a ±1 px (sin piso de alto que los estire)", {
  tpl <- .cmail_template_normalize(.cmail_preset_recuperacion())
  for (r in c(12L, 20L, 40L)) {
    imgs <- .cmail_fx_parity_images()
    imgs[["logo-cliente"]]$size <- list(width = r * 100L, height = 100L)
    imgs[["logo-cliente"]]$url <- "https://pulsopucp.github.io/correo-/ancho.png"
    html <- collection_mail_render(tpl, "export", images = imgs)$html
    m <- regmatches(html, regexec('ancho.png" width="([0-9]+)" height="([0-9]+)"', html))[[1]]
    w <- as.integer(m[[2]]); h <- as.integer(m[[3]])
    expect_lte(abs(h - w / r), 1, label = sprintf("logo %d:1 sale %dx%d", r, w, h))
  }
})

test_that("en teléfono la proporción de los logos queda a ±1 px, en fila y apilados (10:1 + 160)", {
  tpl <- .cmail_template_normalize(.cmail_preset_recuperacion())
  imgs <- .cmail_fx_parity_images()
  imgs[["logo-cliente"]]$size <- list(width = 1000L, height = 100L)
  imgs[["logo-cliente"]]$url <- "https://pulsopucp.github.io/correo-/ancho.png"
  for (r in c(4L, 5L, 6L, 10L)) {
    imgs[["logo-cliente"]]$size <- list(width = r * 100L, height = 100L)
    html <- collection_mail_render(tpl, "export", images = imgs)$html
    tags <- regmatches(html, gregexpr('<img class="cmail-logo"[^>]*>', html))[[1]]
    wh <- t(vapply(tags, function(tg) as.numeric(regmatches(tg, regexec(' width="([0-9]+)" height="([0-9]+)"', tg))[[1]][2:3]), numeric(2)))
    nat <- ifelse(grepl("ancho.png", tags, fixed = TRUE), r, 300 / 92)   # proporción del archivo
    expect_identical(sum(nat == r), 1L, info = as.character(r))
    stacked <- grepl("cmail-logo-cell", html, fixed = TRUE)
    expect_identical(stacked, .cmail_logos_stack(wh[, 1], wh[, 2]), info = as.character(r))
    # Junto al de Pulso (150 × 46) a 360: 6:1 (200 × 33) queda en 24,2 px y sigue en fila; 10:1 en 14,7 y se apila.
    expect_identical(stacked, r == 10L, info = as.character(r))
    expect_true(all(abs(wh[, 2] - wh[, 1] / nat) <= 1), label = sprintf("%d:1 escritorio", r))
    for (phone in c(320, 360, 390)) {
      room <- phone - 66 - if (stacked) 0 else 37 * (nrow(wh) - 1L)
      # En fila se achican todos en la misma escala; apilados, cada uno hasta la columna.
      scale <- if (stacked) pmin(1, room / wh[, 1]) else rep(min(1, room / sum(wh[, 1])), nrow(wh))
      w <- wh[, 1] * scale
      expect_true(all(w <= room + 1e-9), label = sprintf("%d:1 cabe a %d", r, phone))
      expect_true(all(abs(wh[, 2] * scale - w / nat) <= 1), label = sprintf("%d:1 a %d", r, phone))
    }
  }
})
