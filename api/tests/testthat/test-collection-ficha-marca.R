# Ficha de aplicacion con careta de co-marca, etiqueta de estado y campos que
# se llenan a mano (ADR 0046).
#
# La ficha con careta usa el MISMO layout `single_sheet` que la ficha clasica:
# lo que cambia es que la cabecera baja para dejarle su banda a los logos. Por
# eso las pruebas miran geometria real sobre el PNG, no solo el contrato.

.cfm_logo <- function(path, w = 120L, h = 40L) {
  grDevices::png(path, width = w, height = h, res = 72, type = "cairo-png", bg = "white")
  grid::grid.rect(gp = grid::gpar(fill = "#112244", col = NA))
  grDevices::dev.off()
  path
}

.cfm_compiled <- function(template, url = "https://x.test/enc") {
  unit <- list(
    unit_id = "u1", label = "Prueba piloto", role = "piloto", group = "PILOTO",
    dimensions = list(
      faculty = "Universidad de prueba", course_name = "Encuesta de prueba",
      sample_label = "PILOTO"
    )
  )
  binding <- list(
    access_id = "a1", logical_collector_id = "PILOTO", unit_id = "u1",
    access_kind = "manual_handoff", access_ref = url, status = "ready"
  )
  deployment <- list(
    deployment_id = "d1", target = list(provider = "kobo"), bindings = list(binding),
    sensitivity = list(access_urls = "operational"), status = "prepared"
  )
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m1",
    template_ref = list(
      template_id = template$template_id, revision = 1L, sha256 = template$template_sha256
    ),
    deployment_id = "d1", deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)), instance_fingerprint = fp("m1"),
    unit_refs = list("u1"), access_refs = list("a1"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  collection_material_compile(
    template, instance, project = list(name = "Estudio", period = "Piloto"),
    plan = list(plan_id = "p1", units = list(unit)), deployment = deployment
  )
}

.cfm_grey <- function(path) {
  img <- png::readPNG(path)
  if (length(dim(img)) == 3L) img[, , 1] else img
}

test_that("la ficha con careta valida y sigue siendo del preset de la ficha", {
  template <- collection_material_branded_sheet_template(
    assets = c("logo-unsa", "logo-pulso"), status_tag = "PILOTO"
  )
  expect_true(collection_material_template_validate(template)$ok)
  expect_identical(template$preset_id, "ficha_aplicacion_a4_v1")
  expect_identical(template$material_kind, "application_sheet")

  types <- vapply(template$pages[[1]]$blocks, `[[`, character(1), "type")
  expect_true(all(c("brand_strip", "status_tag", "field_grid", "application_log") %in% types))
})

test_that("la etiqueta de estado exige un texto corto", {
  base <- collection_material_branded_sheet_template(assets = "logo-uno")
  for (malo in list("", "   ", strrep("X", 25L))) {
    t <- base
    t$pages[[1]]$blocks <- append(
      t$pages[[1]]$blocks, list(list(block_id = "estado", type = "status_tag", text = malo)), after = 1L
    )
    t$template_sha256 <- NULL
    t$template_sha256 <- collection_fingerprint(t)
    result <- collection_material_template_validate(t)
    expect_false(result$ok)
    expect_true("bad_status_tag" %in% vapply(result$problems, function(p) p$code, character(1)))
  }
})

test_that("un campo se llena a mano o resuelve un dato, nunca las dos cosas", {
  build <- function(field) {
    t <- collection_material_branded_sheet_template(assets = "logo-uno", fields = list(field))
    t$template_sha256 <- NULL
    t$template_sha256 <- collection_fingerprint(t)
    collection_material_template_validate(t)
  }
  codes <- function(r) vapply(r$problems, function(p) p$code, character(1))

  expect_true(build(list(label = "Fecha", blank = TRUE))$ok)
  expect_true("blank_with_binding" %in% codes(
    build(list(label = "Fecha", blank = TRUE, binding = "unit.schedule"))
  ))
  expect_true("missing_blank_label" %in% codes(build(list(blank = TRUE))))
  expect_true("bad_blank" %in% codes(build(list(label = "Fecha", blank = "si"))))
})

test_that("la careta baja la cabecera y deja tinta en su banda", {
  dir <- tempfile("cfm-"); dir.create(dir)
  assets <- list(
    `logo-uno` = .cfm_logo(file.path(dir, "uno.png")),
    `logo-dos` = .cfm_logo(file.path(dir, "dos.png"), w = 40L, h = 40L)
  )
  con_careta <- .cfm_compiled(collection_material_branded_sheet_template(
    assets = names(assets), status_tag = "PILOTO"
  ))
  sin_careta <- .cfm_compiled(collection_material_builtin_template())

  a <- file.path(dir, "con.png"); b <- file.path(dir, "sin.png")
  collection_material_render_compiled(con_careta, a, device = "png", page = 1L, dpi = 150,
                                      brand_assets = assets)
  collection_material_render_compiled(sin_careta, b, device = "png", page = 1L, dpi = 150)

  ga <- .cfm_grey(a); gb <- .cfm_grey(b)
  L <- prosecnurapp:::.crf_layout(branded = TRUE)
  fila <- round((1 - L$y_brand) * nrow(ga))
  banda <- ga[max(1L, fila - 4L):min(nrow(ga), fila + 4L), , drop = FALSE]
  expect_true(any(banda < 0.5))

  # La regla navy de la cabecera baja para dejarle sitio a los logos. Se mide
  # por indice de fila: en una imagen, mas abajo es indice mayor.
  regla <- function(g) {
    desde <- round(0.01 * nrow(g)); hasta <- round(0.20 * nrow(g))
    tramo <- g[desde:hasta, , drop = FALSE]
    hit <- which(apply(tramo < 0.4, 1, sum) > ncol(g) * 0.6)
    expect_gt(length(hit), 0L)
    hit[[1]] + desde - 1L
  }
  expect_gt(regla(ga), regla(gb))
})

test_that("las lineas para llenar a mano no invaden la columna del QR", {
  skip_if_not_installed("png")
  dir <- tempfile("cfm-blank-"); dir.create(dir)
  assets <- list(`logo-uno` = .cfm_logo(file.path(dir, "uno.png")))
  compiled <- .cfm_compiled(collection_material_branded_sheet_template(
    assets = "logo-uno",
    fields = list(list(label = "Fecha", blank = TRUE), list(label = "Muestra", binding = "unit.sample_label"))
  ))
  path <- file.path(dir, "blank.png")
  collection_material_render_compiled(compiled, path, device = "png", page = 1L, dpi = 150,
                                      brand_assets = assets)

  g <- .cfm_grey(path)
  L <- prosecnurapp:::.crf_layout(branded = TRUE)
  # El grid ya no vive en una `y` fija: su banda sale del plan de flujo, que
  # depende de cuanto ocupen los bloques que lo preceden en el orden real.
  plan <- prosecnurapp:::.crf_flow_plan(
    compiled$pages[[1]]$blocks, L, prosecnurapp:::pulso_pdf_type(), prosecnurapp:::pulso_pdf_geo("portrait")
  )
  grid_item <- Find(function(it) identical(it$type, "field_grid"), plan$items)
  fila <- round((1 - (grid_item$y_top - 0.004)) * nrow(g))
  tramo <- g[max(1L, fila - 2L):min(nrow(g), fila + 2L), , drop = FALSE]

  # Umbral claro a proposito: la linea es un hairline #d0d5dd (~0.82 de gris).
  # Con un umbral de tinta negra esta prueba mediria los modulos del QR, que a
  # esta altura tambien caen en la fila, y pasaria sin mirar la linea.
  con_tinta <- which(apply(tramo < 0.93, 2, any))
  inicio <- round((L$x_left + L$label_w) * ncol(g))
  expect_true(any(abs(con_tinta - inicio) <= 3L))

  # Tramo contiguo que arranca en la etiqueta: es la linea. Tiene que morir
  # antes del recuadro del QR, que empieza aqui.
  linea <- con_tinta[con_tinta >= inicio - 3L]
  corte <- which(diff(linea) > 5L)
  if (length(corte)) linea <- linea[seq_len(corte[[1]])]
  qr_izq <- (L$qr_x - L$qr_side * 1.20 / 2) * ncol(g)
  expect_gt(length(linea), 50L)
  expect_lt(max(linea), qr_izq)
})

test_that("mas filas de las que caben se recortan con aviso en vez de pisar el enlace", {
  # La capacidad ya no sale de una banda fija: la reparte el plan de flujo
  # contra los demas bloques presentes. 30 campos en blanco es mas de lo que
  # cabe en cualquier reparto razonable de la hoja -no es un numero elegido
  # para acertarle a la banda vieja, es "imposible" a proposito.
  dir <- tempfile("cfm-over-"); dir.create(dir)
  n_campos <- 30L
  campos <- lapply(seq_len(n_campos), function(i) list(label = sprintf("Campo %d", i), blank = TRUE))
  compiled <- .cfm_compiled(collection_material_branded_sheet_template(
    assets = "logo-uno", fields = campos
  ))
  rendered <- collection_material_render_compiled(
    compiled, file.path(dir, "over.pdf"), device = "pdf",
    brand_assets = list(`logo-uno` = .cfm_logo(file.path(dir, "uno.png")))
  )
  overflow <- Filter(function(w) identical(w$code, "field_grid_overflow"), rendered$warnings)
  expect_length(overflow, 1L)
  expect_identical(overflow[[1]]$rows, n_campos)
  expect_lt(overflow[[1]]$visible_rows, n_campos)
})

test_that("la ficha con careta conserva el QR releible y el enlace clicable", {
  url <- "https://ee-eu.kobotoolbox.org/x/5rbcghMb?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=PILOTO_2026"
  dir <- tempfile("cfm-qr-"); dir.create(dir)
  assets <- list(`logo-uno` = .cfm_logo(file.path(dir, "uno.png")))
  compiled <- .cfm_compiled(
    collection_material_branded_sheet_template(assets = "logo-uno", status_tag = "PILOTO"), url
  )
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150,
                                      brand_assets = assets)
  esperada <- collection_qr_matrix(url, correction = "M", quiet_zone = 4L)
  expect_identical(
    # Con careta: el lector necesita la geometria de la variante que dibujo la
    # hoja, no la de la ficha sin logos.
    collection_qr_matrix_from_png(png_path, n = nrow(esperada), dpi = 150,
                                  layout_preset = "single_sheet", branded = TRUE),
    esperada
  )

  pdf_path <- file.path(dir, "ficha.pdf")
  collection_material_render_compiled(compiled, pdf_path, device = "pdf", brand_assets = assets)
  raw <- readBin(pdf_path, "raw", n = file.info(pdf_path)$size)
  expect_true(length(grepRaw("/Subtype /Link", raw, fixed = TRUE)) > 0L)
  expect_identical(qpdf::pdf_length(pdf_path), 1L)
})
