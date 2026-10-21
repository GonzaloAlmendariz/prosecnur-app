# Correo E1o «Piezas gráficas» (collection_mail_piezas.R): band, ornament,
# icon_text, two_images e image decorativa. Regla de Gonzalo (2026-10-21):
# «Ten cuidado que los elementos no se vean deformes».
# Fixtures sintéticos (helper-collection-mail.R).

.cmp_pieces <- function() list(
  list(block_id = "banda", type = "band", height = "m", color = "#f28c28"),
  list(block_id = "orn-onda", type = "ornament", style = "onda", color = "#f28c28"),
  list(block_id = "orn-puntos", type = "ornament", style = "puntos"),
  list(block_id = "orn-doble", type = "ornament", style = "linea_doble"),
  list(block_id = "fecha", type = "icon_text", icon = "calendario", text = "Puede participar hasta el **30 de octubre**."),
  list(block_id = "par", type = "two_images", left = "ancha", right = "alta", alt_left = "Campus", alt_right = "Torre"),
  list(block_id = "deco", type = "image", image_ref = "ancha", decorative = TRUE)
)

.cmp_template <- function(estilo = "sobrio", pieces = .cmp_pieces()) {
  t <- .cmail_preset_invitacion_encuesta()
  t$blocks <- append(t$blocks, pieces, after = 4L)
  if (identical(estilo, "campana")) t$theme <- list(accent = "#0b1f54", estilo = "campana", page_bg = "#6b3fa0")
  .cmail_template_normalize(t)
}

.cmp_codes <- function(t) vapply(collection_mail_template_validate(.cmail_template_normalize(t))$problems, `[[`, "", "code")

# Imágenes resueltas a mano (sin archivo): 10:1 y 1:10.
.cmp_images <- function(url = FALSE) {
  u <- function(id) if (url) sprintf("https://pulsopucp.github.io/correo-/%s.png", id)
  list(
    ancha = list(id = "ancha", path = NULL, type = "png", size = list(width = 1000L, height = 100L),
                 url = u("ancha"), alt = "", export_name = "ancha.png"),
    alta = list(id = "alta", path = NULL, type = "png", size = list(width = 100L, height = 1000L),
                url = u("alta"), alt = "", export_name = "alta.png"),
    `logo-cliente` = list(id = "logo-cliente", path = NULL, type = "png", size = list(width = 320L, height = 92L),
                          url = u("logo-cliente"), alt = "Unidad", export_name = "logo-cliente.png"),
    pulso = list(id = "pulso", path = NULL, type = "png", size = list(width = 300L, height = 92L),
                 url = u("pulso"), alt = "Pulso", export_name = "pulso.png")
  )
}

# <img> de un HTML con su src, width y height.
.cmp_imgs <- function(html) {
  tags <- regmatches(html, gregexpr("<img [^>]*>", html))[[1]]
  attr <- function(tag, a) {
    m <- regmatches(tag, regexpr(sprintf(' %s="[^"]*"', a), tag))
    if (!length(m)) NA_character_ else sub(sprintf('^ %s="([^"]*)"$', a), "\\1", m)
  }
  lapply(tags, function(t) list(tag = t, src = attr(t, "src"), width = as.integer(attr(t, "width")),
                                height = as.integer(attr(t, "height"))))
}

.cmp_block_html <- function(html, block_id) {
  i <- regexpr(sprintf('data-pulso-block="%s"', block_id), html, fixed = TRUE)
  if (i < 0) return(NA_character_)
  rest <- substring(html, i)
  j <- regexpr('data-pulso-block="', substring(rest, 2), fixed = TRUE)
  if (j < 0) rest else substring(rest, 1, j)
}

# ---- validación -----------------------------------------------------------

test_that("cada pieza valida en el registro cerrado; los valores fuera de él tienen code", {
  for (estilo in c("sobrio", "campana")) {
    v <- collection_mail_template_validate(.cmp_template(estilo))
    expect_true(v$ok, info = paste(estilo, paste(vapply(v$problems, `[[`, "", "detail"), collapse = "; ")))
  }
  bad <- .cmail_preset_invitacion_encuesta()
  bad$blocks <- append(bad$blocks, list(
    list(block_id = "b1", type = "band", height = "xl", color = "naranja"),
    list(block_id = "b2", type = "ornament", style = "zigzag", color = "#fff"),
    list(block_id = "b3", type = "icon_text", icon = "cohete", text = "Hola"),
    list(block_id = "b4", type = "icon_text", text = ""),
    list(block_id = "b5", type = "two_images", left = "con_guion_bajo", right = "ok", alt_left = "", alt_right = "Hola {{enlace}}"),
    list(block_id = "b6", type = "band", x = 1)
  ), after = 1L)
  expect_setequal(.cmp_codes(bad), c("bad_height", "bad_color", "bad_style", "bad_color", "bad_icon",
                                     "missing_icon", "missing_text", "bad_image_ref", "missing_alt",
                                     "alt_has_field", "unknown_field", "unknown_key"))
  # El registro anuncia los tipos nuevos.
  expect_true(all(c("band", "ornament", "icon_text", "two_images") %in% names(.CMAIL_BLOCK_KEYS)))
  # Enlaces [texto](url) se admiten en el texto de icon_text.
  ok <- .cmail_preset_invitacion_encuesta()
  ok$blocks[[2]] <- list(block_id = "web", type = "icon_text", icon = "enlace", text = "Ver [la web](https://pulso.pucp.edu.pe/)")
  expect_false(any(c("link_not_allowed", "bad_url") %in% .cmp_codes(ok)))
})

test_that("image decorative: alt vacío solo con decorative; el chequeo de alt lo respeta; bleed y align siguen", {
  base <- .cmail_preset_invitacion_encuesta()
  base$blocks[[2]] <- list(block_id = "img", type = "image", image_ref = "ancha", alt = "")
  expect_true("missing_alt" %in% .cmp_codes(base))
  deco <- base; deco$blocks[[2]]$decorative <- TRUE
  expect_false("missing_alt" %in% .cmp_codes(deco))
  flag <- base; flag$blocks[[2]]$decorative <- "si"
  expect_true("bad_flag" %in% .cmp_codes(flag))
  # Decorativa con alt guardado: sale alt="" igual.
  d2 <- deco; d2$blocks[[2]]$alt <- "Texto que no se lee"
  html <- collection_mail_render(.cmail_template_normalize(d2), "export", images = .cmp_images())$html
  expect_match(html, 'src="ancha.png" width="500" alt=""', fixed = TRUE)

  checks <- list(); push <- function(x) checks[[length(checks) + 1L]] <<- x
  tpl <- .cmail_template_normalize(deco); tpl$images <- list()
  uses <- .cmail_image_uses(tpl)
  .cmail_image_checks_common(tpl, .cmp_images(), Filter(function(u) !identical(u$target$block_id, "__cabecera"), uses), push)
  expect_identical(checks[[1]]$code, "images_alt"); expect_identical(checks[[1]]$status, "ok")
  checks <- list()
  nodeco <- .cmail_template_normalize(base)
  .cmail_image_checks_common(nodeco, .cmp_images(), Filter(function(u) !identical(u$target$block_id, "__cabecera"), .cmail_image_uses(nodeco)), push)
  expect_identical(checks[[1]]$status, "error")

  # bleed y align: a sangre llena la tarjeta; align derecha empuja la imagen.
  b <- base; b$blocks[[2]] <- list(block_id = "img", type = "image", image_ref = "ancha", alt = "A", bleed = TRUE)
  expect_match(collection_mail_render(.cmail_template_normalize(b), "export", images = .cmp_images())$html,
               'src="ancha.png" width="600" alt="A" style="display:block;width:100%;height:auto;', fixed = TRUE)
  r <- base; r$blocks[[2]] <- list(block_id = "img", type = "image", image_ref = "ancha", alt = "A", width = 300L, align = "right")
  html <- collection_mail_render(.cmail_template_normalize(r), "export", images = .cmp_images())$html
  expect_match(html, '<td align="right"', fixed = TRUE)
  expect_match(html, "margin:0 0 0 auto;", fixed = TRUE)
})

# ---- render en dos dialectos y dos estilos ----------------------------------

test_that("cada pieza se renderiza en mailchimp y surveymonkey, sobrio y campaña", {
  for (estilo in c("sobrio", "campana")) {
    t <- .cmp_template(estilo)
    pv <- collection_mail_render(t, "preview", values = list(nombre = "Ana"), images = .cmp_images())$html
    for (id in c("banda", "orn-onda", "orn-puntos", "orn-doble", "fecha", "par", "deco")) {
      expect_match(pv, sprintf('data-pulso-block="%s"', id), fixed = TRUE, info = paste(estilo, id))
    }
    expect_match(.cmp_block_html(pv, "fecha"), 'data-pulso-prop="text"', fixed = TRUE)
    expect_match(pv, "30 de octubre", fixed = TRUE)
    for (d in c("mailchimp", "surveymonkey")) {
      html <- collection_mail_render(t, "export", d, images = .cmp_images(url = identical(d, "surveymonkey")))$html
      info <- paste(estilo, d)
      expect_false(grepl("data-pulso", html, fixed = TRUE), info = info)
      expect_false(grepl("<svg|position:absolute", html), info = info)
      # Banda 16 px, puntos y línea doble: tablas con bgcolor, en los dos dialectos.
      expect_match(html, 'bgcolor="#f28c28" style="background-color:#f28c28;height:16px;', fixed = TRUE, info = info)
      expect_match(html, 'style="width:8px;height:8px;line-height:8px;font-size:0;', fixed = TRUE, info = info)
      expect_identical(lengths(regmatches(html, gregexpr("height:1px;line-height:1px;", html, fixed = TRUE))), 2L, info = info)
      if (identical(d, "mailchimp")) {
        expect_match(html, 'src="ornamento-onda-f28c28.png"', fixed = TRUE, info = info)
        expect_match(html, 'src="icono-calendario-', fixed = TRUE, info = info)
      } else {
        # SurveyMonkey: la onda es banda sólida; el ícono sin URL se omite.
        expect_false(grepl("ornamento-onda", html, fixed = TRUE), info = info)
        expect_match(html, 'bgcolor="#f28c28" style="background-color:#f28c28;height:4px;', fixed = TRUE, info = info)
        expect_false(grepl("icono-", html, fixed = TRUE), info = info)
        expect_match(html, "30 de octubre", fixed = TRUE, info = info)
        expect_true(.cmail_sm_html_verify(html)$ok, info = paste(info, unlist(.cmail_sm_html_verify(html)$problems)))
      }
    }
  }
  # Color por defecto: sobrio, el acento; campaña, el del botón.
  t <- .cmp_template("sobrio", list(list(block_id = "b", type = "band")))
  expect_match(collection_mail_render(t, "export")$html, 'bgcolor="#0b1f54" style="background-color:#0b1f54;height:16px;', fixed = TRUE)
  t <- .cmp_template("campana", list(list(block_id = "b", type = "band", height = "l")))
  expect_match(collection_mail_render(t, "export")$html, 'bgcolor="#f9d53e" style="background-color:#f9d53e;height:32px;', fixed = TRUE)
})

test_that("surveymonkey: icono con URL declarada se muestra; sin URL, aviso icon_text_sm_icon", {
  t <- .cmp_template("sobrio", list(list(block_id = "fecha", type = "icon_text", icon = "reloj", text = "Diez minutos.")))
  checks <- list(); push <- function(x) checks[[length(checks) + 1L]] <<- x
  .cmail_piezas_checks(t, list(), push, "surveymonkey")
  by <- setNames(checks, vapply(checks, `[[`, "", "code"))
  expect_identical(by$icon_text_sm_icon$status, "warning")
  expect_identical(by$icon_text_sm_icon$targets[[1]]$block_id, "fecha")
  t$images[["icono-reloj-0b1f54"]] <- list(url = "https://pulsopucp.github.io/correo-/reloj.png")
  imgs <- .cmail_piezas_images(t)
  html <- collection_mail_render(t, "export", "surveymonkey", images = imgs)$html
  expect_match(html, 'src="https://pulsopucp.github.io/correo-/reloj.png" width="24" height="24"', fixed = TRUE)
  checks <- list()
  .cmail_piezas_checks(t, imgs, push, "surveymonkey")
  expect_false("icon_text_sm_icon" %in% vapply(checks, `[[`, "", "code"))
  # Mailchimp no avisa (el ícono va en el ZIP); el contraste sí se mide.
  checks <- list()
  .cmail_piezas_checks(t, imgs, push, "mailchimp")
  expect_identical(vapply(checks, `[[`, "", "code"), "piezas_contrast")
  # Una banda del color del fondo casi no se ve: aviso.
  faint <- .cmp_template("campana", list(list(block_id = "b", type = "band", color = "#6b3fa0")))
  checks <- list()
  .cmail_piezas_checks(faint, list(), push)
  expect_identical(checks[[1]]$status, "warning")
  # Sin piezas, ningún chequeo nuevo.
  checks <- list()
  .cmail_piezas_checks(.cmail_template_normalize(.cmail_preset_invitacion_encuesta()), list(), push)
  expect_length(checks, 0L)
})

# ---- nada se deforma ----------------------------------------------------------

# La proporción declarada (width/height del <img>) es la del archivo, ±1 px.
.cmp_expect_ratio <- function(img, size, info = "") {
  expect_false(is.na(img$width), info = info); expect_false(is.na(img$height), info = info)
  expected_h <- img$width * size$height / size$width
  expect_lte(abs(img$height - expected_h), 1, label = paste(info, img$src))
}

test_that("proporción: image, two_images y ornamento con imágenes 10:1 y 1:10 (±1 px)", {
  sizes <- list(ancha = list(width = 1000L, height = 100L), alta = list(width = 100L, height = 1000L))
  for (estilo in c("sobrio", "campana")) {
    t <- .cmp_template(estilo, list(
      list(block_id = "par", type = "two_images", left = "ancha", right = "alta", alt_left = "A", alt_right = "B"),
      list(block_id = "i-ancha", type = "image", image_ref = "ancha", alt = "A", width = 600L),
      list(block_id = "i-alta", type = "image", image_ref = "alta", alt = "B", width = 300L),
      list(block_id = "orn", type = "ornament", style = "onda")
    ))
    html <- collection_mail_render(t, "export", images = .cmp_images())$html
    imgs <- .cmp_imgs(html)
    by_src <- function(s) Filter(function(i) identical(i$src, s), imgs)
    # two_images: la ancha a 244 × 24; la alta topa 600 de alto y recalcula el ancho (60).
    pair_wide <- by_src("ancha.png")[[1]]; pair_tall <- by_src("alta.png")[[1]]
    expect_identical(c(pair_wide$width, pair_wide$height), c(244L, 24L))
    expect_identical(c(pair_tall$width, pair_tall$height), c(60L, 600L))
    .cmp_expect_ratio(pair_wide, sizes$ancha, estilo); .cmp_expect_ratio(pair_tall, sizes$alta, estilo)
    # image 1:10 a 300 px de ancho serían 3000 de alto: el tope deja 600 y el ancho baja a 60.
    tall <- by_src("alta.png")[[2]]
    expect_identical(c(tall$width, tall$height), c(60L, 600L))
    expect_match(tall$tag, "width:60px;max-width:100%;height:auto;", fixed = TRUE)
    # image 10:1 sin tope: solo ancho y height:auto (la proporción la pone el navegador).
    wide <- by_src("ancha.png")[[2]]
    expect_identical(wide$width, 600L); expect_true(is.na(wide$height))
    expect_match(wide$tag, "height:auto", fixed = TRUE)
    # Ornamento: 504 × 24 del PNG de 1008 × 48.
    orn <- Filter(function(i) grepl("^ornamento-onda-", i$src), imgs)[[1]]
    expect_identical(c(orn$width, orn$height), c(504L, 24L))
    png_size <- .cmail_image_info(.cmail_ornament_png(.cmail_theme_palette(t, "#0b1f54", NULL)$bar))
    .cmp_expect_ratio(orn, png_size, "ornamento")
    # Ninguna imagen fuerza un alto en el CSS salvo el ícono, que es cuadrado.
    for (i in imgs) {
      if (!grepl("^icono-", i$src) && !(i$src %in% c("logo-cliente.png", "pulso.png"))) {
        expect_false(grepl("[^-]height:[0-9]+px", i$tag), label = i$src)
      }
    }
  }
  # Sin tope (la paridad): una imagen común no cambia su HTML.
  expect_null(.cmail_image_capped(list(width = 300L), list(size = list(width = 1200L, height = 400L))))
  expect_identical(.cmail_image_width(list(width = 300L), list(size = list(width = 100L, height = 1000L))), 60L)
})

test_that("íconos: los 12 son PNG cuadrados 48 × 48, distintos, y se muestran cuadrados", {
  hashes <- character(0)
  for (icon in .CMAIL_ICONS) {
    path <- .cmail_icon_png(icon, "#0b1f54")
    px <- png::readPNG(path)
    expect_identical(dim(px), c(48L, 48L, 4L), info = icon)
    alpha <- px[, , 4]
    expect_gt(mean(alpha), 0.08, label = icon); expect_lt(mean(alpha), 0.75, label = icon)
    expect_identical(alpha[1, 1], 0, info = icon) # esquina transparente
    hashes <- c(hashes, digest::digest(alpha))
  }
  expect_length(unique(hashes), 12L)
  expect_identical(.cmail_icon_png("calendario", "#0b1f54"), .cmail_icon_png("calendario", "#0b1f54"))
  expect_null(.cmail_icon_png("cohete", "#0b1f54"))
  for (estilo in c("sobrio", "campana")) {
    px <- if (identical(estilo, "campana")) 32L else 24L
    for (icon in .CMAIL_ICONS) {
      t <- .cmp_template(estilo, list(list(block_id = "it", type = "icon_text", icon = icon, text = "Texto")))
      img <- Filter(function(i) grepl("^icono-", i$src), .cmp_imgs(collection_mail_render(t, "export")$html))[[1]]
      expect_identical(c(img$width, img$height), c(px, px), info = paste(estilo, icon))
      expect_match(img$tag, sprintf("width:%dpx;height:%dpx;", px, px), fixed = TRUE)
    }
  }
})

test_that("two_images: dos celdas alineadas arriba, height:auto, y se apilan en teléfono (max-width:480px)", {
  t <- .cmp_template("sobrio", list(list(block_id = "par", type = "two_images", left = "ancha", right = "alta",
                                         alt_left = "A", alt_right = "B")))
  html <- collection_mail_render(t, "export", images = .cmp_images())$html
  head <- sub("</head>.*$", "", html)
  expect_match(head, "@media only screen and (max-width:480px){.cmail-stack{display:block !important;width:100% !important;",
               fixed = TRUE)
  cells <- regmatches(html, gregexpr('<td class="cmail-stack"[^>]*>', html))[[1]]
  expect_length(cells, 2L)
  for (c in cells) {
    expect_match(c, 'valign="top"', fixed = TRUE)
    expect_match(c, "vertical-align:top;", fixed = TRUE)
  }
  for (i in Filter(function(i) i$src %in% c("ancha.png", "alta.png"), .cmp_imgs(html))) {
    expect_match(i$tag, "height:auto;", fixed = TRUE)
  }
  # Sin two_images, la regla no se escribe (la paridad de siempre).
  plain <- collection_mail_render(.cmail_template_normalize(.cmail_preset_invitacion_encuesta()), "export")$html
  expect_false(grepl("cmail-stack", plain, fixed = TRUE))
})

# ---- ZIP importable -----------------------------------------------------------

test_that("la onda del ornamento y los íconos van en el ZIP importable con ruta relativa", {
  skip_if_not_installed("zip")
  sid <- .cmail_fx_session(); on.exit(session_delete(sid), add = TRUE)
  .cmail_fx_mail_image(sid, "ancha.png", width = 1000L, height = 100L)
  .cmail_fx_mail_image(sid, "alta.png", width = 100L, height = 1000L)
  c <- collection_mail_campaign_create(sid, collection_mail_campaigns_get(sid)$state_revision, name = "Piezas")
  t <- c$campaign$template
  t$blocks <- append(t$blocks, .cmp_pieces(), after = 4L)
  t$images$ancha <- list(alt = "Campus"); t$images$alta <- list(alt = "Torre")
  p <- collection_mail_template_put(sid, t, collection_mail_campaigns_get(sid)$state_revision, campaign_id = c$campaign$campaign_id)
  .cmail_fx_completar(sid, c$campaign$campaign_id)
  tpl <- collection_mail_template_get(sid, c$campaign$campaign_id)$template

  images <- .cmail_images_resolve(session_get(sid), tpl)
  onda <- images[["ornamento-onda-f28c28"]]
  expect_true(isTRUE(onda$generated))
  expect_equal(onda$size, list(width = 1008, height = 48))
  icon <- images[[grep("^icono-calendario-", names(images), value = TRUE)]]
  expect_equal(icon$size, list(width = 48, height = 48))

  rev <- collection_mail_campaigns_get(sid)$state_revision
  ex <- collection_mail_export(sid, rev, c$campaign$campaign_id, scope = "plantilla")
  path <- session_get(sid)$files[[ex$zip$file_id]]$path
  entries <- zip::zip_list(path)$filename
  expect_true("ornamento-onda-f28c28.png" %in% entries)
  expect_true(any(grepl("^icono-calendario-[0-9a-f]{6}\\.png$", entries)))
  expect_true(all(c("ancha.png", "alta.png") %in% entries))
  expect_true(.cmail_import_zip_verify(path)$ok)
  html_name <- entries[grepl("\\.html$", entries)]
  tmp <- tempfile(); on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  zip::unzip(path, files = html_name, exdir = tmp)
  html <- paste(readLines(file.path(tmp, html_name), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  expect_match(html, 'src="ornamento-onda-f28c28.png" width="504" height="24"', fixed = TRUE)
  # Las imágenes reales también conservan su proporción en el HTML exportado.
  for (i in Filter(function(i) i$src %in% c("ancha.png", "alta.png") && !is.na(i$height), .cmp_imgs(html))) {
    size <- images[[sub("\\.png$", "", i$src)]]$size
    .cmp_expect_ratio(i, size, "zip")
  }
})
