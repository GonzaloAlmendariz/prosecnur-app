# Correo E1p: la fila de logos de la cabecera en teléfono (collection_mail_ajustes.R).
# Defecto medido (2026-10-21): a 390 px dos logos de 160 px y el divisor (357 px)
# no cabían en la tarjeta y la página se desplazaba 33 px en horizontal. Pedido de
# Gonzalo: «Ten cuidado que los elementos no se vean deformes». En ≤480 px los
# logos se achican en proporción (max-width:100%, height:auto) o, si alguno
# quedaría por debajo de 90 px, se apilan con el divisor oculto. En escritorio
# (y en Outlook, que ignora las media queries) la fila es la de siempre.
# La geometría en navegador (scrollWidth y proporción a 390 y 1280) se mide con
# Playwright fuera de testthat; aquí se fija el contrato del HTML y la aritmética.

.cml_png <- function(w, h) {
  p <- tempfile("cml-", fileext = ".png")
  grDevices::png(p, w, h); graphics::par(mar = c(0, 0, 0, 0)); graphics::plot.new(); grDevices::dev.off()
  p
}
.cml_img <- function(id, w, h) {
  list(id = id, path = .cml_png(w, h), type = "png", size = list(width = w, height = h), url = NULL,
       alt = id, export_name = paste0(id, ".png"))
}
.cml_images <- function() list(a = .cml_img("a", 320L, 92L), b = .cml_img("b", 300L, 92L),
                               c = .cml_img("c", 360L, 120L), diez = .cml_img("diez", 1000L, 100L))
.cml_tpl <- function(ids, bg = "dark") {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$header <- list(kind = "logos", logo_ids = as.list(ids), background = bg)
  .cmail_template_normalize(t)
}
.cml_render <- function(ids, bg = "dark", mode = "export", images = .cml_images()) {
  collection_mail_render(.cml_tpl(ids, bg), mode, "mailchimp", images = images)$html
}
# <img> de logo: width/height de atributo y de estilo.
.cml_logos <- function(html) {
  tags <- regmatches(html, gregexpr('<img class="cmail-logo"[^>]*>', html))[[1]]
  num <- function(tag, re) as.integer(sub(re, "\\1", regmatches(tag, regexpr(re, tag))))
  lapply(tags, function(t) list(
    tag = t, aw = num(t, ' width="([0-9]+)"'), ah = num(t, ' height="([0-9]+)"'),
    sw = num(t, "width:([0-9]+)px"), sh = num(t, "height:([0-9]+)px")
  ))
}
.cml_head <- function(html) sub("</head>.*$", "", html)
.cml_body <- function(html) sub("^.*</head>", "", html)

test_that("1, 2 y 3 logos: clase en cada <img>, regla de teléfono en el head y apilado solo con 3", {
  for (n in 1:3) {
    ids <- c("a", "b", "c")[seq_len(n)]
    for (bg in c("dark", "light")) {
      html <- .cml_render(ids, bg)
      info <- paste(n, bg)
      expect_length(.cml_logos(html), n)
      head <- .cml_head(html)
      expect_match(head, "@media only screen and (max-width:480px){.cmail-logo{max-width:100% !important;height:auto !important;}", fixed = TRUE, info = info)
      stacked <- n == 3L
      expect_identical(grepl("cmail-logo-cell", .cml_body(html), fixed = TRUE), stacked, info = info)
      expect_identical(grepl(".cmail-logo-div{display:none !important;}", head, fixed = TRUE), stacked, info = info)
      if (stacked) {
        expect_identical(lengths(regmatches(html, gregexpr('<td class="cmail-logo-div" valign="middle"', html, fixed = TRUE))), 2L, info = info)
        expect_identical(lengths(regmatches(html, gregexpr('<td class="cmail-logo-cell" valign="middle">', html, fixed = TRUE))), 1L, info = info)
        expect_identical(lengths(regmatches(html, gregexpr('<td class="cmail-logo-cell cmail-logo-next" valign="middle">', html, fixed = TRUE))), 2L, info = info)
      }
    }
  }
})

test_that("la regla nunca fija ancho ni alto: solo tope relativo y altura automática (no deforma)", {
  head <- .cml_head(.cml_render(c("a", "b", "c")))
  rule <- regmatches(head, regexpr("\\.cmail-logo\\{[^}]*\\}", head))
  expect_identical(rule, ".cmail-logo{max-width:100% !important;height:auto !important;}")
  expect_false(grepl("\\.cmail-logo\\{[^}]*(^|[^-])width:", head))
})

test_that("proporción de cada logo ±1 px en escritorio y achicado en teléfono (390 px), incluido un 10:1", {
  imgs <- .cml_images()
  for (ids in list("a", c("a", "b"), c("a", "b", "c"), "diez", c("diez", "a"), c("diez", "diez"))) {
    logos <- .cml_logos(.cml_render(ids, images = imgs))
    widths <- vapply(logos, `[[`, 0L, "aw")
    stacked <- .cmail_logos_stack(widths, vapply(logos, `[[`, 0L, "ah"))
    expect_identical(grepl("cmail-logo-cell", .cml_body(.cml_render(ids, images = imgs)), fixed = TRUE), stacked)
    # 390 px: 390 − 24 (página) − 2 (borde) − 40 (márgenes en teléfono).
    room <- 390 - 24 - 2 - 40 - if (stacked) 0 else 37 * (length(ids) - 1L)
    scale <- if (stacked) 1 else min(1, room / sum(widths))
    for (i in seq_along(ids)) {
      l <- logos[[i]]; nat <- imgs[[ids[[i]]]]$size
      info <- paste(paste(ids, collapse = "+"), i)
      expect_identical(c(l$aw, l$ah), c(l$sw, l$sh), info = info)
      ratio <- nat$width / nat$height
      expect_lte(abs(l$ah - l$aw / ratio), 1, label = paste("escritorio", info))
      w390 <- l$aw * scale
      expect_lte(w390, room, label = paste("cabe", info))
      expect_lte(abs(l$ah * scale - w390 / ratio), 1, label = paste("390", info))
    }
    if (!stacked) expect_lte(sum(widths * scale) + 37 * (length(ids) - 1L), 390 - 66 + 1e-9)
  }
  # 10:1: tope de 200 px de ancho y la altura se reduce, nunca el ancho se corta.
  diez <- .cml_logos(.cml_render("diez"))[[1]]
  expect_identical(c(diez$aw, diez$ah), c(200L, 20L))
})

test_that(".cmail_logos_stack: apila solo si al achicarse alguno quedaría bajo 90 px", {
  expect_false(.cmail_logos_stack(160L))
  expect_false(.cmail_logos_stack(c(160L, 150L)))
  expect_false(.cmail_logos_stack(c(200L, 200L)))        # 128,5 px cada uno a 360
  expect_false(.cmail_logos_stack(c(200L, 160L)))        # 10:1 con uno de 160
  expect_false(.cmail_logos_stack(c(46L, 46L, 46L)))     # caben sin achicarse
  expect_true(.cmail_logos_stack(c(160L, 150L, 138L)))
  expect_false(.cmail_logos_stack(c(200L, 40L)))         # caben sin achicarse (240 + 37 ≤ 294)
  expect_true(.cmail_logos_stack(c(200L, 100L)))         # dos logos: el de 100 bajaría a 86 px
  expect_identical(.CMAIL_LOGO_PHONE_PX, 294L)
})

# Gonzalo (2026-10-22): «apílalo si queda muy chico». El ancho no basta: un 10:1
# junto a uno de 160 quedaba de 120,5 × 12 px a 320 (ancho de sobra, alto ilegible).
# Umbral de alto medido con Playwright a 320/360/390: ver collection_mail_ajustes.R.
test_that(".cmail_logos_stack: también apila si al achicarse alguno quedaría bajo 24 px de alto", {
  expect_identical(.CMAIL_LOGO_MIN_H_PX, 24L)
  expect_true(.cmail_logos_stack(c(200L, 160L), c(20L, 46L)))    # 10:1 + 160: 14,3 px de alto a 360
  expect_true(.cmail_logos_stack(c(200L, 139L), c(20L, 40L)))    # ídem en cabecera clara
  expect_true(.cmail_logos_stack(c(200L, 160L), c(33L, 46L)))    # 6:1 + 160: 23,6 px a 360
  expect_false(.cmail_logos_stack(c(200L, 160L), c(40L, 46L)))   # 5:1 + 160: 28,6 px a 360
  expect_false(.cmail_logos_stack(c(160L, 150L), c(46L, 46L)))   # dos típicos: 38,1 px a 360
  expect_false(.cmail_logos_stack(c(139L, 130L), c(40L, 40L)))   # dos típicos en clara
  expect_false(.cmail_logos_stack(c(200L, 40L), c(20L, 46L)))    # caben sin achicarse: alto de escritorio
  expect_false(.cmail_logos_stack(200L, 20L))                     # un solo logo nunca se apila
})

test_that("10:1 + 160 se apilan en el HTML; dos típicos (160 + 150) siguen en fila", {
  html <- .cml_render(c("diez", "a"))
  expect_match(.cml_head(html), ".cmail-logo-cell{display:block !important;}", fixed = TRUE)
  expect_match(.cml_head(html), ".cmail-logo-div{display:none !important;}", fixed = TRUE)
  expect_match(.cml_body(html), '<td class="cmail-logo-cell cmail-logo-next" valign="middle">', fixed = TRUE)
  expect_match(.cml_body(html), '<td class="cmail-logo-div" valign="middle"', fixed = TRUE)
  for (bg in c("dark", "light")) {
    typ <- .cml_render(c("a", "b"), bg)
    expect_false(grepl("cmail-logo-cell", .cml_body(typ), fixed = TRUE), info = bg)
    expect_false(grepl(".cmail-logo-div{", .cml_head(typ), fixed = TRUE), info = bg)
  }
})

test_that("apilado a 320 px cada logo vuelve a su ancho de escritorio sin pasar la columna ni deformarse", {
  # 320 − 24 (página) − 2 (borde) − 40 (márgenes en teléfono) = 254 px de columna.
  col320 <- 320 - 24 - 2 - 40
  imgs <- .cml_images()
  for (ids in list("diez", c("diez", "a"))) {
    logos <- .cml_logos(.cml_render(ids, images = imgs))
    for (i in seq_along(ids)) {
      l <- logos[[i]]; ratio <- imgs[[ids[[i]]]]$size$width / imgs[[ids[[i]]]]$size$height
      info <- paste(paste(ids, collapse = "+"), i)
      w <- min(l$aw, col320); h <- w / ratio      # max-width:100% + height:auto
      expect_identical(w, as.numeric(l$aw), info = info)   # recupera el ancho de escritorio
      expect_lte(abs(l$ah - h), 1, label = paste("proporción", info))
    }
  }
  # El 10:1 solo queda en 200 × 20: bajo 24 px, pero es el máximo que da su proporción
  # con el tope de 200 px de ancho; no se estira para ganar alto.
  diez <- .cml_logos(.cml_render("diez", images = imgs))[[1]]
  expect_identical(c(diez$aw, diez$ah, diez$sw, diez$sh), c(200L, 20L, 200L, 20L))
  expect_false(grepl("cmail-logo-cell", .cml_body(.cml_render("diez", images = imgs)), fixed = TRUE))
})

test_that("sin logos con archivo (preview de los presets) o con banner no se emite la regla", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  expect_false(grepl("cmail-logo", collection_mail_render(t, "preview")$html, fixed = TRUE))
  ban <- t; ban$header <- list(kind = "banner", image_ref = "banner")
  ban$images <- list(banner = list(alt = "B", url = "https://pulsopucp.github.io/correo-/Arte1-960.png"))
  ban <- .cmail_template_normalize(ban)
  expect_false(grepl("cmail-logo", collection_mail_render(ban, "export")$html, fixed = TRUE))
})

test_that("escritorio: quitar la clase y la regla devuelve la fila de siempre (sin estilos nuevos)", {
  html <- .cml_render(c("a", "b"))
  plain <- sub(.cmail_logo_style(html), "", html, fixed = TRUE)
  plain <- gsub('<img class="cmail-logo" ', "<img ", plain, fixed = TRUE)
  expect_false(grepl("cmail-logo", plain, fixed = TRUE))
  # Los logos conservan width/height fijos en atributo y estilo (Outlook).
  expect_match(plain, '<td valign="middle"><img src="a.png" width="160" height="46"', fixed = TRUE, all = FALSE)
})
