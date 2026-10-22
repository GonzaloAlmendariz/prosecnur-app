# Correo E1p «Ajustes del correo» (collection_mail_ajustes.R): ancho de la
# columna (560 | 600 | 640), fondo de la página en estilo sobrio con el pie por
# contraste, y márgenes del cuerpo a 20 px en teléfono. Decisión de Gonzalo
# (2026-10-21): «justificado por defecto, sin fondo suave y 600 px, pero puedes
# jugar con ello». Fixtures sintéticos (helper-collection-mail.R).

.cma_codes <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "code")
.cma_paths <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "path")
.cma_with <- function(t, ...) { t$theme <- utils::modifyList(t$theme %||% list(), list(...)); t }
.cma_checks <- function(t) {
  checks <- list(); push <- function(x) { checks[[length(checks) + 1L]] <<- x; invisible(push) }
  .cmail_campana_checks(t, push)
  setNames(checks, vapply(checks, `[[`, "", "code"))
}

# <img> de un HTML con src, width y height (atributos).
.cma_imgs <- function(html) {
  tags <- regmatches(html, gregexpr("<img [^>]*>", html))[[1]]
  attr <- function(tag, a) {
    m <- regmatches(tag, regexpr(sprintf(' %s="[^"]*"', a), tag))
    if (!length(m)) NA_character_ else sub(sprintf('^ %s="([^"]*)"$', a), "\\1", m)
  }
  lapply(tags, function(t) list(tag = t, src = attr(t, "src"), width = as.integer(attr(t, "width")),
                                height = as.integer(attr(t, "height"))))
}

# Quita SOLO lo que E1p agrega a todo correo: la clase cmail-pad y su regla, y la
# clase cmail-logo de los logos de la cabecera con su regla (test-collection-mail-logos.R).
.cma_strip_pad <- function(html) {
  html <- sub(.cmail_pad_style(), "", html, fixed = TRUE)
  logo_rule <- .cmail_logo_style(html)
  if (nzchar(logo_rule)) html <- sub(logo_rule, "", html, fixed = TRUE)
  html <- gsub('<img class="cmail-logo" ', "<img ", html, fixed = TRUE)
  html <- gsub(' class="cmail-pad"', "", html, fixed = TRUE)
  gsub(' cmail-pad"', '"', html, fixed = TRUE)
}

# Huellas de E1n (HEAD d4c55ddc0, antes de E1p): el HTML de hoy sin la clase ni
# la regla de teléfono debe ser exactamente ese. Las de preview con huecos
# (todas salvo banner) se recapturaron el 2026-10-22 (E1p huecos: el hueco de
# preview cede en teléfono, test-collection-mail-huecos.R); export no cambió.
.CMA_E1N_SHA <- list(
  export = c(recuperacion = "sha256:8efaab450453ee3279328d2557549c682351f1151b31b565af2b2371a47b39fb",
             invitacion = "sha256:d7517887493033ebeb52e3e978da2c214093721462f632659b4e57c668a64255",
             recuperacion_img = "sha256:ea09b75d145f9e8ed2baaa1c4aab1811c96449d92e0b66f92ce3569ce7cbd864",
             completo = "sha256:9403447e95ead91783c848c2881ceb8b38a8b000b922c24ca49305380b20cd02",
             banner = "sha256:433232c628c11adc45ed23a457123c15ef8926fdecd601d299d5cc8c706c3ea9"),
  preview = c(recuperacion = "sha256:a09f179ee366182a9f4791b28c7ba492b62e68c2db9f12c7ef252947a5433d83",
              invitacion = "sha256:1a1c97421db1f2ae3a1ee590b07bbe52b6c1a7a8ee820a52384dd4ce3081346d",
              recuperacion_img = "sha256:72eef917a63acd491bea760e6a3cd2f1caa81497c9aea6db495960bfceb8b7cf",
              completo = "sha256:012345cfd475a386b355f22479ce6c3001108fc5e2ce268beb97eb0fb97714ba",
              banner = "sha256:b2990072c4beb8e535bbfa2588006662591d12b326502ee83eecf05513e2ff1d")
)

# ---- validación -----------------------------------------------------------------

test_that("tema: width cerrado en 560 | 600 | 640; page_bg es #rrggbb; claves desconocidas con unknown_key", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  for (w in c(560L, 600L, 640L)) {
    expect_true(collection_mail_template_validate(.cma_with(t, width = w))$ok, info = w)
    expect_true(collection_mail_template_validate(.cma_with(t, width = as.numeric(w)))$ok, info = w)
  }
  expect_true(collection_mail_template_validate(.cma_with(t, page_bg = "#0B1F54"))$ok)
  for (bad in list(700L, 480L, 600.5, "600", TRUE, list(600L, 640L))) {
    b <- t; b$theme$width <- bad
    expect_identical(.cma_codes(b), "bad_width", info = paste(deparse(bad), collapse = ""))
    expect_identical(.cma_paths(b), "template.theme.width")
  }
  bad <- .cma_with(t, width = 720L, page_bg = "navy", ancho = 600L)
  expect_setequal(.cma_codes(bad), c("bad_width", "bad_color", "unknown_key"))
  expect_setequal(.cma_paths(bad), paste0("template.theme.", c("width", "page_bg", "ancho")))
})

test_that("el ancho viaja guardado en la campaña (sin cambio de esquema)", {
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- function() collection_mail_campaigns_get(sid)$state_revision
  c <- collection_mail_campaign_create(sid, rev(), name = "Ancho")
  t <- c$campaign$template
  t$theme$width <- 640L; t$theme$page_bg <- "#0b1f54"
  p <- collection_mail_template_put(sid, t, rev(), campaign_id = c$campaign$campaign_id)
  expect_identical(as.integer(p$template$theme$width), 640L)
  expect_identical(p$template$theme$page_bg, "#0b1f54")
  t$theme$width <- 700L
  e <- tryCatch(collection_mail_template_put(sid, t, rev(), campaign_id = c$campaign$campaign_id), api_error = function(e) e)
  expect_s3_class(e, "api_error")
  expect_match(paste(unlist(e$details), collapse = " "), "bad_width", fixed = TRUE)
})

# ---- 600: paridad salvo la regla de teléfono --------------------------------------

test_that("600 (declarado o por defecto) conserva el HTML de E1n salvo la clase cmail-pad y su regla", {
  fx <- jsonlite::fromJSON(.cmail_fx_mail_import_path("paridad-mailchimp-sha256.json"), simplifyVector = FALSE)
  cases <- .cmail_fx_parity_cases()
  for (n in names(cases)) {
    c <- cases[[n]]
    mc <- collection_mail_render(c$t, "export", "mailchimp", images = c$images)$html
    expect_identical(collection_mail_render(.cma_with(c$t, width = 600L), "export", "mailchimp", images = c$images)$html, mc, info = n)
    expect_identical(.cmail_fx_sha(.cma_strip_pad(mc)), .CMA_E1N_SHA$export[[n]], info = n)
    pv <- collection_mail_render(c$t, "preview", values = fx$preview_values, images = c$images)$html
    expect_identical(.cmail_fx_sha(.cma_strip_pad(pv)), .CMA_E1N_SHA$preview[[n]], info = n)
  }
})

# ---- 560 / 640 ----------------------------------------------------------------------

test_that("560 y 640 cambian el ancho de la columna, del pie y del banner (sobrio y campaña)", {
  ban <- .cmail_fx_parity_cases()$banner
  for (w in c(560L, 640L)) {
    for (estilo in c("sobrio", "campana")) {
      t <- .cma_with(ban$t, width = w, estilo = estilo)
      html <- collection_mail_render(t, "export", images = ban$images)$html
      info <- paste(w, estilo)
      expect_identical(lengths(regmatches(html, gregexpr(sprintf('role="presentation" width="%d"', w), html, fixed = TRUE))), 2L, info = info)
      expect_identical(lengths(regmatches(html, gregexpr(sprintf("max-width:%dpx;", w), html, fixed = TRUE))), 2L, info = info)
      expect_false(grepl('width="600"', html, fixed = TRUE), info = info)
      expect_false(grepl("max-width:600px", html, fixed = TRUE), info = info)
      banner <- Filter(function(i) grepl("Arte1-960", i$src), .cma_imgs(html))[[1]]
      expect_identical(banner$width, w, info = info)
      expect_match(banner$tag, "width:100%;height:auto;", fixed = TRUE)
    }
  }
  # Imagen a sangre y onda del pie: también al ancho de la columna.
  full <- .cmail_fx_parity_cases()$completo
  html <- collection_mail_render(.cma_with(full$t, width = 560L), "export", images = full$images)$html
  bleed <- Filter(function(i) identical(i$src, "linea-cierre.jpg") && grepl('style="display:block;width:100%', i$tag, fixed = TRUE), .cma_imgs(html))
  expect_length(bleed, 1L); expect_identical(bleed[[1]]$width, 560L)
  onda <- .cmail_template_normalize(.cmail_preset_recuperacion())
  onda$theme <- list(accent = "#0b1f54", estilo = "campana", page_bg = "#6b3fa0", onda = "pie", width = 640L)
  imgs <- list(); imgs[[.CMAIL_ONDA_ID]] <- .cmail_onda_image(onda)
  html <- collection_mail_render(onda, "export", images = imgs)$html
  expect_match(html, '<img src="onda-pie.png" width="640" alt=""', fixed = TRUE)
  # Una imagen del cuerpo de 600 declarados no pasa la columna de 560.
  img <- list(size = list(width = 1200L, height = 400L))
  expect_identical(.cmail_image_width(list(width = 600L), img, 560L), 560L)
  expect_identical(.cmail_image_width(list(width = 600L), img, 640L), 600L)
  expect_identical(.cmail_image_width(list(bleed = TRUE), img, 640L), 640L)
})

test_that("nada se deforma con 560 y 640: banner, logos, two_images, imagen con tope y ornamento (±1 px)", {
  ratio_ok <- function(i, size, info) {
    if (is.na(i$height)) return(expect_true(TRUE))  # height:auto, la proporción la pone el navegador
    expect_lte(abs(i$height - i$width * size$height / size$width), 1, label = info)
  }
  sizes <- list(ancha = list(width = 1000L, height = 100L), alta = list(width = 100L, height = 1000L),
                `logo-cliente` = list(width = 320L, height = 92L), pulso = list(width = 300L, height = 92L))
  imgs <- list()
  for (id in names(sizes)) {
    imgs[[id]] <- list(id = id, path = NULL, type = "png", size = sizes[[id]], url = NULL, alt = id, export_name = paste0(id, ".png"))
  }
  for (w in c(560L, 640L)) {
    for (estilo in c("sobrio", "campana")) {
      t <- .cmail_preset_invitacion_encuesta()
      t$blocks <- append(t$blocks, list(
        list(block_id = "par", type = "two_images", left = "ancha", right = "alta", alt_left = "A", alt_right = "B"),
        list(block_id = "i-alta", type = "image", image_ref = "alta", alt = "B", width = 300L),
        list(block_id = "orn", type = "ornament", style = "onda")
      ), after = 4L)
      t$theme <- list(accent = "#0b1f54", estilo = estilo, width = w)
      if (identical(estilo, "campana")) t$theme$page_bg <- "#6b3fa0"
      t <- .cmail_template_normalize(t)
      html <- collection_mail_render(t, "export", images = imgs)$html
      info <- paste(w, estilo)
      all <- .cma_imgs(html)
      for (i in all) {
        id <- sub("\\.png$", "", i$src)
        if (!is.null(sizes[[id]])) ratio_ok(i, sizes[[id]], paste(info, i$src))
      }
      pair_max <- (w - 96L) %/% 2L - 8L
      wide <- Filter(function(i) identical(i$src, "ancha.png"), all)[[1]]
      expect_identical(c(wide$width, wide$height), c(pair_max, as.integer(round(pair_max / 10))), info = info)
      expect_match(html, sprintf('<td class="cmail-stack" width="%d"', (w - 96L) %/% 2L), fixed = TRUE)
      tall <- Filter(function(i) identical(i$src, "alta.png"), all)
      expect_identical(c(tall[[1]]$width, tall[[1]]$height), c(60L, 600L), info = info)  # tope de alto, no del ancho
      orn <- Filter(function(i) grepl("^ornamento-onda-", i$src), all)[[1]]
      expect_identical(orn$width, w - 96L, info = info)
      png_size <- .cmail_image_info(.cmail_ornament_png(.cmail_theme_palette(t, "#0b1f54", NULL)$bar))
      ratio_ok(orn, png_size, paste(info, "ornamento"))
      # Ninguna imagen fija un alto en CSS salvo íconos y logos (que lo declaran por su proporción).
      for (i in all) {
        if (!grepl("^icono-", i$src) && !(i$src %in% c("logo-cliente.png", "pulso.png"))) {
          expect_false(grepl("[^-]height:[0-9]+px", i$tag), label = paste(info, i$src))
        }
      }
    }
  }
  # Nitidez a la columna del tema: el chequeo mide lo mismo que se muestra.
  expect_identical(.cmail_pair_shown_width(list(size = sizes$ancha), 640L), 264L)
  expect_identical(.cmail_pair_shown_width(list(size = sizes$ancha), 560L), 224L)
  expect_identical(.cmail_pair_shown_width(list(size = sizes$ancha)), 244L)
})

# ---- page_bg en sobrio --------------------------------------------------------------

test_that("page_bg en sobrio pinta la página fuera de la tarjeta y el pie conserva su contraste", {
  t <- .cma_with(.cmail_template_normalize(.cmail_preset_recuperacion()), page_bg = "#0b1f54")
  html <- collection_mail_render(t, "export")$html
  expect_match(html, '<body style="margin:0;padding:0;background-color:#0b1f54;">', fixed = TRUE)
  expect_match(html, 'width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b1f54" style="background-color:#0b1f54;"', fixed = TRUE)
  # La tarjeta sigue blanca, con su borde y su franja de cierre (es sobrio, no campaña).
  expect_match(html, "border-radius:8px;border-collapse:separate;overflow:hidden;background-color:#ffffff;", fixed = TRUE)
  expect_match(html, "height:4px;line-height:4px", fixed = TRUE)
  expect_false(grepl(.CMAIL_PAGE_BG, html, fixed = TRUE))
  # El pie: tono calculado sobre el navy (no el gris #8a909c) y enlaces de la plataforma del mismo tono.
  pal <- .cmail_theme_palette(t, "#0b1f54", "#0b1f54")
  expect_false(identical(pal$footer, .CMAIL_FOOTER_TEXT))
  expect_gte(.cmail_contrast(pal$footer, "#0b1f54"), 4.5)
  foot <- regmatches(html, regexpr('<td align="center" style="padding:20px 30px 32px 30px;[^"]*">.*?</td>', html, perl = TRUE))
  expect_match(foot, sprintf("color:%s;", pal$footer), fixed = TRUE)
  expect_false(grepl("color:#555555;", foot, fixed = TRUE))
  expect_false(grepl("color:#0b1f54;", foot, fixed = TRUE))
  # SurveyMonkey igual: su pie también va fuera de la tarjeta.
  sm <- collection_mail_render(t, "export", "surveymonkey")$html
  expect_false(grepl("color:#555555;", sm, fixed = TRUE))
  # La revisión mide el pie (reusa campana_footer_contrast, el código que el front ya conoce).
  ok <- .cma_checks(t)
  expect_identical(names(ok), "campana_footer_contrast")
  expect_identical(ok$campana_footer_contrast$status, "ok")
  expect_gte(ok$campana_footer_contrast$value, 4.5)
  # Por defecto (sin page_bg, o el gris de siempre): ni pinta otra cosa ni chequea.
  base <- .cmail_template_normalize(.cmail_preset_recuperacion())
  expect_length(.cma_checks(base), 0L)
  expect_length(.cma_checks(.cma_with(base, page_bg = .CMAIL_PAGE_BG)), 0L)
  expect_identical(collection_mail_render(.cma_with(base, page_bg = toupper(.CMAIL_PAGE_BG)), "export")$html,
                   collection_mail_render(base, "export")$html)
})

test_that("el contraste del pie da error en sobrio cuando no alcanza 4,5:1, con target a la Identidad", {
  t <- .cma_with(.cmail_template_normalize(.cmail_preset_recuperacion()), page_bg = "#777777")
  gris <- .cma_checks(t)
  expect_identical(gris$campana_footer_contrast$status, "error")
  expect_identical(gris$campana_footer_contrast$value, 4.48)
  expect_identical(gris$campana_footer_contrast$targets, list(list(block_id = "__identidad", prop = "page_bg")))
  expect_match(gris$campana_footer_contrast$detail, "#777777", fixed = TRUE)
  # En la revisión real bloquea la exportación, como en campaña.
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  rev <- function() collection_mail_campaigns_get(sid)$state_revision
  c <- collection_mail_campaign_create(sid, rev(), name = "Gris")
  tt <- c$campaign$template; tt$theme$page_bg <- "#777777"
  collection_mail_template_put(sid, tt, rev(), campaign_id = c$campaign$campaign_id)
  r <- collection_mail_review(sid, campaign_id = c$campaign$campaign_id, scope = "plantilla")
  by <- setNames(r$checks, vapply(r$checks, `[[`, "", "code"))
  expect_identical(by$campana_footer_contrast$status, "error")
  e <- tryCatch(collection_mail_export(sid, rev(), c$campaign$campaign_id, scope = "plantilla"), api_error = function(e) e)
  expect_identical(e$code, "E_COLLECTION_MAIL_REVIEW_BLOCKING")
})

# ---- teléfono -------------------------------------------------------------------------

test_that("teléfono: la regla de 20 px va siempre en el <head> y toda celda con margen de 48/46 px lleva cmail-pad", {
  expect_identical(.cmail_pad_style(),
                   '<style type="text/css">@media only screen and (max-width:480px){.cmail-pad{padding-left:20px !important;padding-right:20px !important;}}</style>')
  pieces <- list(
    list(block_id = "orn", type = "ornament", style = "puntos"),
    list(block_id = "fecha", type = "icon_text", icon = "calendario", text = "Hasta el 30."),
    list(block_id = "sep", type = "divider", style = "linea")
  )
  for (estilo in c("sobrio", "campana")) {
    for (al in c("justify", "left")) {
      full <- .cmail_fx_parity_cases()$completo
      t <- full$t
      t$blocks <- append(t$blocks, pieces, after = 3L)
      t$theme$estilo <- estilo; t$theme$text_align <- al
      t <- .cmail_template_normalize(t)
      html <- collection_mail_render(t, "export", images = full$images)$html
      info <- paste(estilo, al)
      head <- sub("</head>.*$", "", html)
      expect_identical(lengths(regmatches(head, gregexpr(.cmail_pad_style(), head, fixed = TRUE))), 1L, info = info)
      # Cada <td> con margen lateral de 48 o 46 px lleva la clase; ninguna otra la lleva.
      tds <- regmatches(html, gregexpr("<td[^>]*>", html))[[1]]
      side <- grepl("padding:[0-9]+px 4[68]px [0-9]+px 4[68]px;", tds) | grepl("padding:0 4[68]px", tds)
      padded <- grepl('class="([a-z-]+ )?cmail-pad"', tds)
      expect_gt(sum(side), 10L)
      expect_identical(padded, side, info = info)
      # El cuerpo se queda en 16 px de letra.
      expect_match(html, "font-size:16px;line-height:26px;", fixed = TRUE)
      expect_false(grepl("@media[^}]*font-size", head))
    }
  }
  # También sin nada que justificar ni apilar.
  izq <- .cma_with(.cmail_template_normalize(.cmail_preset_recuperacion()), text_align = "left")
  expect_match(collection_mail_render(izq, "export", "surveymonkey")$html, .cmail_pad_style(), fixed = TRUE)
})
