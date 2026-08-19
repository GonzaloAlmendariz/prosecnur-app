# Layout `poster_qr`: careta de logos + QR grande (ADR 0046).
#
# PNG sintetico de color plano: alcanza para probar aspecto y presencia de
# tinta sin versionar logos de cliente en el repo.
.afiche_fixture_logo <- function(path, w = 120L, h = 40L, col = "#112244") {
  grDevices::png(path, width = w, height = h, res = 72, type = "cairo-png", bg = "white")
  grid::grid.rect(gp = grid::gpar(fill = col, col = NA))
  grDevices::dev.off()
  path
}

.afiche_compiled <- function(url, assets = c("logo-uno", "logo-dos")) {
  template <- collection_material_poster_template(assets = assets)
  unit <- list(
    unit_id = "u1", label = "Piloto", role = "piloto", group = "PILOTO",
    dimensions = list(course_name = "Encuesta para estudiantes de pregrado")
  )
  plan <- list(plan_id = "plan-afiche", units = list(unit))
  binding <- list(
    access_id = "a1", logical_collector_id = "PILOTO", unit_id = "u1",
    access_kind = "manual_handoff", access_ref = url, status = "ready"
  )
  deployment <- list(
    deployment_id = "d1", target = list(provider = "kobo"),
    bindings = list(binding), sensitivity = list(access_urls = "operational"),
    status = "prepared"
  )
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = "material-afiche",
    template_ref = list(
      template_id = template$template_id, revision = 1L, sha256 = template$template_sha256
    ),
    deployment_id = "d1",
    deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)),
    instance_fingerprint = fp("afiche"),
    unit_refs = list("u1"), access_refs = list("a1"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  collection_material_compile(
    template, instance,
    project = list(name = "Hostigamiento sexual UNSA 2026", period = "Piloto 2026"),
    plan = plan, deployment = deployment
  )
}

test_that("el preset del afiche valida y no hereda el vocabulario de la ficha", {
  template <- collection_material_poster_template(assets = c("logo-unsa", "logo-pulso"))
  expect_true(collection_material_template_validate(template)$ok)

  # field_grid y application_log son de la ficha; el afiche no los dibuja, asi
  # que aceptarlos seria prometer una superficie que nadie renderiza.
  intruso <- template
  intruso$pages[[1]]$blocks <- c(
    intruso$pages[[1]]$blocks,
    list(list(block_id = "extra", type = "field_grid", fields = list(
      list(label = "Horario", binding = "unit.schedule")
    )))
  )
  intruso$template_sha256 <- NULL
  intruso$template_sha256 <- collection_fingerprint(intruso)
  result <- collection_material_template_validate(intruso)
  expect_false(result$ok)
  expect_true("block_not_in_preset" %in% vapply(result$problems, function(p) p$code, character(1)))
})

test_that("la careta nombra ids, nunca rutas ni URLs", {
  for (malo in list("../../etc/passwd", "/Users/yo/logo.png", "https://x.test/l.png", "Logo UNSA")) {
    template <- collection_material_poster_template(assets = malo)
    template$template_sha256 <- NULL
    template$template_sha256 <- collection_fingerprint(template)
    result <- collection_material_template_validate(template)
    expect_false(result$ok, info = malo)
    expect_true(
      "bad_brand_asset_id" %in% vapply(result$problems, function(p) p$code, character(1)),
      info = malo
    )
  }
})

test_that("el QR del afiche se relee del PNG y exige la geometria de su preset", {
  url <- "https://ee-eu.kobotoolbox.org/x/5rbcghMb?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=PILOTO_2026"
  compiled <- .afiche_compiled(url)
  expect_identical(compiled$pages[[1]]$layout_preset, "poster_qr")

  dir <- tempfile("afiche-qr-"); dir.create(dir)
  png_path <- file.path(dir, "afiche.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  esperada <- collection_qr_matrix(url, correction = "M", quiet_zone = 4L)
  leida <- collection_qr_matrix_from_png(
    png_path, n = nrow(esperada), dpi = 150, layout_preset = "poster_qr"
  )
  expect_identical(leida, esperada)

  # La misma pagina leida con la geometria de la ficha no puede coincidir: es
  # lo que prueba que el lector mira donde el afiche dibuja de verdad.
  con_geo_ficha <- collection_qr_matrix_from_png(
    png_path, n = nrow(esperada), dpi = 150, layout_preset = "single_sheet"
  )
  expect_false(identical(con_geo_ficha, esperada))
})

test_that("el enlace impreso del afiche sale clicable en el PDF", {
  url <- "https://ee-eu.kobotoolbox.org/x/5rbcghMb?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=PILOTO_2026"
  compiled <- .afiche_compiled(url)
  dir <- tempfile("afiche-link-"); dir.create(dir)
  pdf_path <- file.path(dir, "afiche.pdf")
  collection_material_render_compiled(compiled, pdf_path, device = "pdf")

  raw <- readBin(pdf_path, "raw", n = file.info(pdf_path)$size)
  expect_true(length(grepRaw("/Subtype /Link", raw, fixed = TRUE)) > 0L)
  expect_true(length(grepRaw(url, raw, fixed = TRUE)) > 0L)
  expect_identical(qpdf::pdf_length(pdf_path), 1L)

  # El PNG no admite anotaciones: la inyeccion es exclusiva del device PDF y no
  # debe intentarse sobre el raster.
  png_path <- file.path(dir, "afiche.png")
  expect_silent(collection_material_render_compiled(
    compiled, png_path, device = "png", page = 1L, dpi = 72
  ))
  expect_true(file.exists(png_path))
})

test_that("un logo que no resuelve avisa en vez de dibujar una careta a medias", {
  compiled <- .afiche_compiled("https://x.test/enc", assets = c("logo-uno", "logo-dos"))
  dir <- tempfile("afiche-brand-"); dir.create(dir)
  presente <- .afiche_fixture_logo(file.path(dir, "uno.png"))

  rendered <- collection_material_render_compiled(
    compiled, file.path(dir, "parcial.pdf"), device = "pdf",
    brand_assets = list(`logo-uno` = presente)
  )
  codes <- vapply(rendered$warnings, function(w) as.character(w$code %||% ""), character(1))
  faltantes <- vapply(
    Filter(function(w) identical(w$code, "brand_asset_missing"), rendered$warnings),
    function(w) w$asset_id, character(1)
  )
  expect_true("brand_asset_missing" %in% codes)
  expect_identical(faltantes, "logo-dos")

  completo <- collection_material_render_compiled(
    compiled, file.path(dir, "completo.pdf"), device = "pdf",
    brand_assets = list(
      `logo-uno` = presente,
      `logo-dos` = .afiche_fixture_logo(file.path(dir, "dos.png"), w = 40L, h = 40L)
    )
  )
  expect_false("brand_asset_missing" %in% vapply(
    completo$warnings, function(w) as.character(w$code %||% ""), character(1)
  ))
})

test_that("un afiche sin acceso resuelto avisa access_missing, igual que ficha y ficha_campo", {
  # El afiche dibuja su QR a mano -no pasa por el helper compartido que
  # ficha.R y ficha_campo.R usan para cualquier bloque access_qr- y se habia
  # quedado sin este aviso pese a mostrar "Sin enlace" en el PDF: el PDF se
  # veia bien, pero nada programatico distinguia un afiche completo de uno
  # sin QR.
  compiled <- .afiche_compiled("")
  dir <- tempfile("afiche-sin-acceso-"); dir.create(dir)
  rendered <- collection_material_render_compiled(
    compiled, file.path(dir, "sin_acceso.pdf"), device = "pdf"
  )
  codes <- vapply(rendered$warnings, function(w) as.character(w$code %||% ""), character(1))
  expect_true("access_missing" %in% codes)

  con_acceso <- .afiche_compiled("https://x.test/enc")
  completo <- collection_material_render_compiled(
    con_acceso, file.path(dir, "con_acceso.pdf"), device = "pdf"
  )
  expect_false("access_missing" %in% vapply(
    completo$warnings, function(w) as.character(w$code %||% ""), character(1)
  ))
})

test_that("la careta deja tinta en su banda y respeta el aspecto de cada logo", {
  skip_if_not_installed("png")
  compiled <- .afiche_compiled("https://x.test/enc", assets = c("logo-ancho", "logo-cuadrado"))
  dir <- tempfile("afiche-tinta-"); dir.create(dir)
  assets <- list(
    `logo-ancho` = .afiche_fixture_logo(file.path(dir, "ancho.png"), w = 300L, h = 50L),
    `logo-cuadrado` = .afiche_fixture_logo(file.path(dir, "cuadrado.png"), w = 80L, h = 80L)
  )
  png_path <- file.path(dir, "afiche.png")
  collection_material_render_compiled(
    compiled, png_path, device = "png", page = 1L, dpi = 150, brand_assets = assets
  )

  img <- png::readPNG(png_path)
  grey <- if (length(dim(img)) == 3L) img[, , 1] else img
  L <- prosecnurapp:::.cra_layout()
  fila <- round((1 - L$y_brand) * nrow(grey))
  banda <- grey[max(1L, fila - 4L):min(nrow(grey), fila + 4L), , drop = FALSE]
  expect_true(any(banda < 0.5))

  # El logo apaisado debe ocupar mas ancho que el cuadrado al mismo alto; si el
  # renderer ignorara el aspecto, ambos medirian igual.
  oscuro_por_col <- apply(banda < 0.5, 2, any)
  tramos <- rle(oscuro_por_col)
  anchos <- tramos$lengths[tramos$values]
  expect_length(anchos, 2L)
  expect_gt(anchos[[1]], anchos[[2]])
})

test_that("el layout_fingerprint no depende de donde viven los logos", {
  compiled <- .afiche_compiled("https://x.test/enc")
  dir <- tempfile("afiche-fp-"); dir.create(dir)
  uno <- .afiche_fixture_logo(file.path(dir, "a.png"))
  otro <- .afiche_fixture_logo(file.path(dir, "b.png"))

  a <- collection_material_render_compiled(
    compiled, file.path(dir, "a.pdf"), device = "pdf",
    brand_assets = list(`logo-uno` = uno, `logo-dos` = otro)
  )
  b <- collection_material_render_compiled(
    compiled, file.path(dir, "b.pdf"), device = "pdf",
    brand_assets = list(`logo-uno` = otro, `logo-dos` = uno)
  )
  expect_identical(a$layout_fingerprint, b$layout_fingerprint)
  expect_identical(a$layout_fingerprint, compiled$layout_fingerprint)
})

test_that("los logos se resuelven desde los archivos del proyecto por slug", {
  dir <- tempfile("afiche-files-"); dir.create(dir)
  ruta <- .afiche_fixture_logo(file.path(dir, "LOGO_UNSA.png"))
  session <- list(files = list(
    f1 = list(kind = "brand_logo", original_name = "LOGO_UNSA.png", path = ruta),
    f2 = list(kind = "data", original_name = "base.xlsx", path = ruta),
    f3 = list(kind = "brand_logo", original_name = "otro.png", path = file.path(dir, "no-existe.png"))
  ))
  template <- collection_material_poster_template(assets = c("logo-unsa", "otro"))
  ids <- prosecnurapp:::.cm_template_brand_ids(template)
  expect_identical(ids, c("logo-unsa", "otro"))

  mapa <- prosecnurapp:::.cm_brand_assets_map(session, ids)
  expect_identical(names(mapa), "logo-unsa")
  expect_identical(mapa[["logo-unsa"]], ruta)
})
