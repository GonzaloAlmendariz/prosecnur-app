# Correo E1p «huecos»: en la vista previa, una imagen o logo sin archivo ni URL
# se dibuja como un hueco punteado con su alt (`.cmail_preview_hole`,
# collection_mail_render.R). Defecto medido (Playwright, 2026-10-22): el hueco
# era un span de ancho fijo en px y, en teléfono, desbordaba la página de 347 a
# 628 px a 320 px. Ahora cede (ancho 100% con tope max-width) y conserva su
# proporción (una imagen SVG vacía de ancho × alto da el alto). El export no
# cambia: los huecos solo existen en preview. Fixtures sintéticos.

.cmh_ph <- function(id, alt, w, h) {
  list(id = id, path = NULL, type = "png", size = list(width = w, height = h), url = NULL, alt = alt,
       export_name = paste0(id, ".png"))
}

# Casos de paridad (par_*) más cabeceras de 2 logos sin archivo y un banner sin archivo.
.cmh_cases <- function() {
  cases <- .cmail_fx_parity_cases()
  names(cases) <- paste0("par_", names(cases))
  rec <- cases$par_recuperacion$t
  two <- rec; two$header <- list(kind = "logos", logo_ids = list("a", "b"), background = "light")
  two <- .cmail_template_normalize(two)
  cases$logos2_claro <- list(t = two, images = list(a = .cmh_ph("a", "Facultad de Ciencias Sociales", 320L, 92L),
                                                    b = .cmh_ph("b", "Pulso PUCP", 300L, 92L)))
  dark <- two; dark$header$background <- "dark"
  cases$logos2_oscuro <- list(t = dark, images = list(a = .cmh_ph("a", "Facultad", 160L, 46L), b = .cmh_ph("b", "Pulso PUCP", 150L, 46L)))
  ban <- cases$par_banner$t
  cases$banner_sin_archivo <- list(t = ban, images = list())
  cases
}

.cmh_preview <- function(c) collection_mail_render(c$t, "preview", values = list(nombre = "Ana"), images = c$images)$html

# Huecos de un HTML: ancho tope, ancho y alto de la imagen que da la proporción, y texto.
.cmh_holes <- function(html) {
  re <- '<span style="display:block;position:relative;width:100%;max-width:([0-9]+)px;[^"]*"><img src="data:image/svg\\+xml,[^"]*width=%27([0-9]+)%27 height=%27([0-9]+)%27[^"]*" width="([0-9]+)" height="([0-9]+)" alt="" style="display:block;width:100%;height:auto;border:0;"><span style="[^"]*border:1px dashed #9aa3b5;[^"]*">([^<]*)</span></span>'
  m <- regmatches(html, gregexpr(re, html, perl = TRUE))[[1]]
  lapply(m, function(x) {
    g <- regmatches(x, regexec(re, x, perl = TRUE))[[1]]
    list(max = as.integer(g[2]), svg_w = as.integer(g[3]), svg_h = as.integer(g[4]), w = as.integer(g[5]),
         h = as.integer(g[6]), label = g[7])
  })
}

test_that("en preview ningún hueco lleva un ancho fijo sin max-width, y todo punteado es un hueco que cede", {
  cases <- .cmh_cases()
  expected <- c(par_recuperacion = 2L, par_invitacion = 2L, par_recuperacion_img = 1L, par_completo = 3L,
                par_banner = 0L, logos2_claro = 2L, logos2_oscuro = 2L, banner_sin_archivo = 1L)
  for (n in names(cases)) {
    html <- .cmh_preview(cases[[n]])
    dashed <- lengths(regmatches(html, gregexpr("border:1px dashed #9aa3b5;", html, fixed = TRUE)))
    holes <- .cmh_holes(html)
    expect_identical(dashed, expected[[n]], info = n)
    expect_length(holes, expected[[n]])
    # Ningún span del correo declara `width:Npx` (sin `max-`): el viejo hueco era `display:inline-block;width:Npx`.
    spans <- regmatches(html, gregexpr('<span style="[^"]*"', html))[[1]]
    expect_false(any(grepl('(["; ])width:[0-9]+px', spans)), info = n)
    expect_false(grepl("display:inline-block;width:", html, fixed = TRUE), info = n)
    # El tope y la medida declarada son la misma: el hueco nunca pasa del ancho que reemplaza.
    for (h in holes) {
      expect_identical(h$max, h$w, info = n); expect_identical(h$svg_w, h$w, info = n); expect_identical(h$svg_h, h$h, info = n)
    }
  }
})

test_that("el hueco conserva la medida declarada: logos, banner (ancho x mitad) e imagen del cuerpo (40 px de piso)", {
  cases <- .cmh_cases()
  dims <- function(n) t(vapply(.cmh_holes(.cmh_preview(cases[[n]])), function(h) c(h$w, h$h), integer(2)))
  expect_identical(dims("logos2_oscuro"), rbind(c(160L, 46L), c(150L, 46L)))
  # 320 × 92 a 40 px de alto: 139 × 40; 300 × 92: 130 × 40.
  expect_identical(dims("logos2_claro"), rbind(c(139L, 40L), c(130L, 40L)))
  expect_identical(dims("banner_sin_archivo"), rbind(c(600L, 300L)))
  # completo: logo de 160 × 46, imagen de 300 (alto 150) y a sangre de 600 (alto 300).
  expect_identical(dims("par_completo"), rbind(c(160L, 46L), c(300L, 150L), c(600L, 300L)))
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  t$blocks <- list(list(block_id = "chica", type = "image", image_ref = "x", alt = "Chica", width = 60L))
  h <- .cmail_preview_hole(60L, 40L, "Chica", "margin:0 auto;")
  expect_match(collection_mail_render(t, "preview")$html, h, fixed = TRUE)
  # El alt se escapa; un ancho de 560 tope la columna.
  expect_match(.cmail_preview_hole(10L, 5L, "<b>&"), "&lt;b&gt;&amp;</span></span>$")
  w560 <- cases$par_completo$t; w560$theme$width <- 560L
  expect_identical(.cmh_holes(collection_mail_render(w560, "preview", images = cases$par_completo$images)$html)[[3]]$w, 560L)
})

test_that("la imagen alineada a la derecha o al centro conserva su lugar (margin), la de la izquierda no lleva", {
  t <- .cmail_template_normalize(.cmail_preset_recuperacion())
  mk <- function(align) { t$blocks <- list(list(block_id = "i", type = "image", image_ref = "x", alt = "I", width = 200L, align = align)); collection_mail_render(t, "preview")$html }
  expect_match(mk("right"), "max-width:200px;margin:0 0 0 auto;", fixed = TRUE)
  expect_match(mk("center"), "max-width:200px;margin:0 auto;", fixed = TRUE)
  expect_match(mk("left"), 'max-width:200px;">', fixed = TRUE)
})

test_that("el front sigue reconociendo los huecos de la cabecera: la celda empieza por <span", {
  html <- .cmh_preview(.cmh_cases()$logos2_oscuro)
  cells <- regmatches(html, gregexpr('<td valign="middle">\\s*(<img\\b|<span\\b)', html, perl = TRUE))[[1]]
  expect_identical(cells, rep('<td valign="middle"><span', 2L))
})

test_that("el export no cambia: ningún hueco, ningún SVG vacío, el HTML de siempre", {
  cases <- .cmh_cases()
  for (n in names(cases)) {
    for (d in c("mailchimp", "surveymonkey")) {
      ex <- collection_mail_render(cases[[n]]$t, "export", d, images = cases[[n]]$images)$html
      expect_false(grepl("dashed #9aa3b5", ex, fixed = TRUE), info = paste(n, d))
      expect_false(grepl("data:image/svg+xml", ex, fixed = TRUE), info = paste(n, d))
    }
  }
})

# ---- Playwright: el hueco cede en teléfono y no se deforma --------------------------
#
# Necesita node y el Playwright del front (frontend/node_modules); sin ellos se salta.

.cmh_playwright <- function() {
  pw <- normalizePath(test_path("..", "..", "..", "frontend", "node_modules", "playwright"), mustWork = FALSE)
  node <- Sys.which("node")
  if (!nzchar(node) || !dir.exists(pw)) return(NULL)
  list(node = node, pw = pw)
}

.CMH_MEASURE_JS <- '
const path = require("path"), fs = require("fs");
const { chromium } = require(process.argv[2]);
(async () => {
  const dir = process.argv[3], out = [];
  const browser = await chromium.launch();
  for (const w of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".html")).sort()) {
      await page.goto("file://" + path.join(dir, f));
      out.push(await page.evaluate(([w, f]) => {
        const de = document.documentElement;
        const holes = [...document.querySelectorAll("span > img[src^=\'data:image/svg+xml\']")].map(img => {
          const b = img.parentElement.getBoundingClientRect();
          return { w: b.width, h: b.height, dw: +img.getAttribute("width"), dh: +img.getAttribute("height") };
        });
        return { viewport: w, file: f, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, holes };
      }, [w, f]));
    }
    await page.close();
  }
  await browser.close();
  process.stdout.write(JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
'

test_that("Playwright: a 320 y 390 la página no se desplaza; el hueco conserva su proporción (±1 px) y en escritorio su medida", {
  pw <- .cmh_playwright()
  skip_if(is.null(pw), "sin node o sin Playwright del front")
  dir <- withr::local_tempdir()
  cases <- .cmh_cases()
  for (n in names(cases)) writeLines(.cmh_preview(cases[[n]]), file.path(dir, paste0(n, ".html")), useBytes = TRUE)
  js <- file.path(withr::local_tempdir(), "measure.cjs"); writeLines(.CMH_MEASURE_JS, js)
  raw <- suppressWarnings(system2(pw$node, c(shQuote(js), shQuote(pw$pw), shQuote(dir)), stdout = TRUE, stderr = FALSE))
  skip_if(!length(raw) || !is.null(attr(raw, "status")), "Playwright no pudo lanzar Chromium")
  res <- jsonlite::fromJSON(paste(raw, collapse = ""), simplifyVector = FALSE)
  expect_length(res, 3L * length(cases))
  n_holes <- 0L
  for (r in res) {
    info <- sprintf("%s a %d", r$file, r$viewport)
    if (r$viewport < 1000) expect_lte(r$scrollWidth, r$clientWidth, label = info)
    for (h in r$holes) {
      n_holes <- n_holes + 1L
      expect_lte(abs(h$h - h$w * h$dh / h$dw), 1, label = paste(info, "proporción"))
      expect_lte(h$w, h$dw + 1e-6, label = paste(info, "tope"))
      # En escritorio, la medida declarada (la imagen a sangre pierde el borde de 1 px de la tarjeta a cada lado).
      if (r$viewport >= 1000) expect_lte(abs(h$w - h$dw), 2, label = paste(info, "ancho de escritorio"))
    }
  }
  expect_identical(n_holes, 3L * 13L)
})
