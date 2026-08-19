# Layout `field_form`: QR grande + formulario de lineas para llenar a mano.
#
# Reproduce la hoja de papel que el equipo ya usaba. Las pruebas miran el PNG
# porque lo que define esta ficha es geometria: que el QR domine la pagina y
# que cada linea tenga sitio real donde escribir.

.cfx_logo <- function(path, w = 120L, h = 40L) {
  grDevices::png(path, width = w, height = h, res = 72, type = "cairo-png", bg = "white")
  grid::grid.rect(gp = grid::gpar(fill = "#112244", col = NA))
  grDevices::dev.off()
  path
}

.cfx_compiled <- function(template, url = "https://x.test/enc", collector = "PILOTO_2026") {
  unit <- list(unit_id = "u1", label = "Rotulo de la unidad", role = "piloto", group = "PILOTO")
  binding <- list(
    access_id = "a1", logical_collector_id = collector, unit_id = "u1",
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

.cfx_grey <- function(path) {
  img <- png::readPNG(path)
  if (length(dim(img)) == 3L) img[, , 1] else img
}

.cfx_codes <- function(result) vapply(result$problems, function(p) p$code, character(1))

.cfx_validate_rows <- function(rows) {
  t <- collection_material_field_sheet_template(rows = rows)
  t$template_sha256 <- NULL
  t$template_sha256 <- collection_fingerprint(t)
  collection_material_template_validate(t)
}

test_that("la ficha de campo declara su propio preset y no el de la ficha de plan", {
  template <- collection_material_field_sheet_template(assets = c("logo-unsa", "logo-pulso"))
  expect_true(collection_material_template_validate(template)$ok)
  expect_identical(template$preset_id, "ficha_campo_qr_a4_v1")
  expect_identical(template$pages[[1]]$layout_preset, "field_form")
  expect_identical(template$material_kind, "application_sheet")

  bloque <- function(id) {
    hit <- Filter(function(b) identical(b$block_id, id), template$pages[[1]]$blocks)
    if (length(hit)) hit[[1]] else NULL
  }
  # El titulo es la etiqueta legible de la unidad (no el id logico del
  # colector: ese cae en un hash para el origen de aulas, ver V7) y el pie
  # nombra el estudio. La careta va centrada, no arrimada al margen.
  expect_identical(bloque("titulo")$binding, "unit.label")
  expect_identical(bloque("footer")$binding, "project.name")
  expect_identical(bloque("careta")$align, "center")

  # La pildora de estado no pertenece a este layout: diria dos veces lo mismo
  # que el titulo, o algo distinto.
  expect_false("status_tag" %in% COLLECTION_MATERIAL_PRESETS$ficha_campo_qr_a4_v1$blocks)
  con_pildora <- template
  con_pildora$pages[[1]]$blocks <- c(con_pildora$pages[[1]]$blocks, list(
    list(block_id = "estado", type = "status_tag", text = "PILOTO")
  ))
  con_pildora$template_sha256 <- NULL
  con_pildora$template_sha256 <- collection_fingerprint(con_pildora)
  expect_true("block_not_in_preset" %in% .cfx_codes(
    collection_material_template_validate(con_pildora)
  ))

  # Los bloques de la ficha de plan no pertenecen aqui: esta hoja no imprime
  # datos ni el enlace, solo QR y lineas.
  intruso <- template
  intruso$pages[[1]]$blocks <- c(intruso$pages[[1]]$blocks, list(
    list(block_id = "log", type = "application_log", rows = 3L)
  ))
  intruso$template_sha256 <- NULL
  intruso$template_sha256 <- collection_fingerprint(intruso)
  expect_true("block_not_in_preset" %in% .cfx_codes(collection_material_template_validate(intruso)))
})

test_that("V7 el titulo de la ficha de campo es legible, no el hash del origen legacy", {
  # Los tests de arriba usan .cfx_compiled(), cuyo fixture SIEMPRE pone un
  # logical_collector_id legible a mano ("PILOTO_2026") -asi nunca vieron el
  # caso real-. Este test reproduce el origen legacy de aulas de punta a
  # punta (igual que sim_aulas_qr_campo.R), donde nadie llena
  # logical_collector_id y el motor cae en .collection_stable_id(), un hash
  # opaco. Confirma que el titulo IMPRESO usa la etiqueta legible de la
  # unidad, no ese hash.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_aulas_plan", list(list(
    selection_run_id = "sel-v7", operational_code = "AULA-09", classroom_id = "AULA-09",
    label = "AULA-09", wave = "M1", faculty = "Ingeniería",
    link = "https://kf.kobotoolbox.org/x/asset1?d%5BcollectorID%5D=AULA-09"
  )))
  seeded <- collection_state_seed(sid)
  unit_id <- seeded$plan$units[[1]]$unit_id
  binding <- seeded$deployment$bindings[[1]]
  # El hallazgo en una linea: el id logico NO es "AULA-09", es un hash.
  expect_false(identical(binding$logical_collector_id, "AULA-09"))
  expect_match(binding$logical_collector_id, "^logical-")

  template <- collection_material_field_sheet_template()
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m-v7",
    template_ref = list(template_id = template$template_id, revision = 1L, sha256 = template$template_sha256),
    deployment_id = seeded$deployment$deployment_id,
    deployment_fingerprint = collection_fingerprint(seeded$deployment),
    access_fingerprint = collection_fingerprint(seeded$deployment$bindings),
    instance_fingerprint = collection_fingerprint("m-v7"),
    unit_refs = list(unit_id), access_refs = list(binding$access_id),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  compiled <- collection_material_compile(
    template, instance, project = list(name = "Estudio V7", period = "Piloto"),
    plan = seeded$plan, deployment = seeded$deployment
  )
  titulo <- .crf_block(compiled$pages[[1]], "heading")
  # El VALOR compilado de verdad -lo que el PDF va a imprimir- es la
  # etiqueta legible, no el hash del id logico.
  expect_identical(titulo$value, "AULA-09")
  expect_false(grepl("^logical-", titulo$value, fixed = FALSE))
})

test_that("los renglones del formulario tienen que caber en su propio ancho", {
  fila <- function(...) list(fields = list(...))
  campo <- function(label, span) list(label = label, span = span)

  expect_true(.cfx_validate_rows(list(fila(campo("Fecha:", 0.5), campo("Hora:", 0.5))))$ok)
  expect_true("form_row_overflow" %in% .cfx_codes(
    .cfx_validate_rows(list(fila(campo("Fecha:", 0.7), campo("Hora:", 0.7))))
  ))
  expect_true("bad_form_span" %in% .cfx_codes(
    .cfx_validate_rows(list(fila(campo("Fecha:", 0.02))))
  ))
  expect_true("missing_form_label" %in% .cfx_codes(
    .cfx_validate_rows(list(fila(list(span = 0.5))))
  ))
  expect_true("bad_form_fields" %in% .cfx_codes(
    .cfx_validate_rows(list(fila(
      campo("A", 0.2), campo("B", 0.2), campo("C", 0.2), campo("D", 0.2), campo("E", 0.2)
    )))
  ))
  expect_true("bad_form_rows" %in% .cfx_codes(
    .cfx_validate_rows(rep(list(fila(campo("X", 1))), 13L))
  ))
})

test_that("los renglones por defecto son los de la hoja en uso", {
  rows <- collection_material_field_form_rows()
  etiquetas <- unlist(lapply(rows, function(r) vapply(r$fields, function(f) f$label, character(1))))
  expect_true(all(c(
    "Facultad", "Pabellón y aula:", "Curso:", "Horario del curso:", "Docente:",
    "N° de alumnos en aula", "Hombres:", "Mujeres:", "N° de encuestas aplicadas:",
    "Rechazos:", "Aplicador/a", "Fecha:", "Hora de aplicación:",
    # Los dos numeros que el cuadre del parte comprueba y que el papel no pedia.
    # Van en la fila de aplicadas porque el formulario esta lleno: su capacidad
    # es 7 renglones y ya usaba 7.
    "Ya respondieron:", "Efectivas:"
  ) %in% etiquetas))

  # La hoja no desdobla la aplicacion en fisico y virtual: es una sola cifra.
  expect_false(any(grepl("virtual|físico|fisico", etiquetas, ignore.case = TRUE)))
})

test_that("el QR domina la pagina y se relee con la geometria de este layout", {
  url <- "https://ee-eu.kobotoolbox.org/x/5rbcghMb?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=PILOTO_2026"
  compiled <- .cfx_compiled(collection_material_field_sheet_template(), url)
  dir <- tempfile("cfx-qr-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  L <- prosecnurapp:::.cfc_layout()
  expect_gt(L$qr_side * 8.27 * 25.4, 130)

  esperada <- collection_qr_matrix(url, correction = "M", quiet_zone = 4L)
  expect_identical(
    collection_qr_matrix_from_png(png_path, n = nrow(esperada), dpi = 150,
                                  layout_preset = "field_form"),
    esperada
  )
  expect_false(identical(
    collection_qr_matrix_from_png(png_path, n = nrow(esperada), dpi = 150,
                                  layout_preset = "single_sheet"),
    esperada
  ))
})

test_that("el titulo es la etiqueta de la unidad, centrado y debajo del QR", {
  skip_if_not_installed("png")
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  expect_identical(
    Filter(function(b) identical(b$block_id, "titulo"), compiled$pages[[1]]$blocks)[[1]]$value,
    "Rotulo de la unidad"
  )

  dir <- tempfile("cfx-title-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .cfx_grey(png_path)
  L <- prosecnurapp:::.cfc_layout()
  fila <- round((1 - L$y_title + 0.008) * nrow(g))
  tramo <- g[max(1L, fila - 6L):min(nrow(g), fila + 6L), , drop = FALSE]
  con_tinta <- which(apply(tramo < 0.5, 2, any))
  expect_gt(length(con_tinta), 20L)

  # Centrado: el punto medio de la tinta cae sobre el eje de la pagina.
  centro <- (min(con_tinta) + max(con_tinta)) / 2
  expect_equal(centro / ncol(g), 0.5, tolerance = 0.03)

  # Debajo del QR, no encima: en indices de fila, mas abajo es mayor.
  qr_abajo <- (1 - (L$qr_y - L$qr_side * (8.27 / 11.69) / 2)) * nrow(g)
  expect_gt(fila, qr_abajo)
})

test_that("con el binding avanzado al id de colector, si sale vacio se cae al rotulo y avisa", {
  # unit.label (el default desde V7) siempre viene lleno -es obligatorio en
  # collection_plan/v1-, asi que este fallback ya no se ejercita con el
  # default. Sigue vivo para quien elija el binding avanzado
  # access.logical_collector_id a proposito y ese campo llegue vacio.
  template <- collection_material_field_sheet_template(title_binding = "access.logical_collector_id")
  compiled <- .cfx_compiled(template, collector = "")
  dir <- tempfile("cfx-notitle-"); dir.create(dir)
  pdf_path <- file.path(dir, "sin.pdf")
  rendered <- collection_material_render_compiled(compiled, pdf_path, device = "pdf")
  expect_true("sheet_title_missing" %in% vapply(
    rendered$warnings, function(w) as.character(w$code %||% ""), character(1)
  ))
  # El titulo falta, pero el QR sigue siendo el mismo enlace clicable de
  # siempre: un titulo vacio no debe arrastrarse al link.
  expect_collection_material_pdf_valid(pdf_path, rendered)
})

test_that("cada renglon deja una linea real donde escribir, dentro de los margenes", {
  skip_if_not_installed("png")
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  dir <- tempfile("cfx-form-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .cfx_grey(png_path)
  L <- prosecnurapp:::.cfc_layout()
  # Se mide la franja completa del renglon, no una rebanada de pocos pixeles:
  # la etiqueta y su raya no comparten linea de base, y una franja angosta cae
  # entre las dos y reporta cero tinta con el renglon perfectamente dibujado.
  media_franja <- L$form_step / 3
  for (i in seq_along(collection_material_field_form_rows())) {
    y <- L$form_top - (i - 1L) * L$form_step
    desde <- round((1 - (y + media_franja)) * nrow(g))
    hasta <- round((1 - (y - media_franja)) * nrow(g))
    tramo <- g[max(1L, desde):min(nrow(g), hasta), , drop = FALSE]
    con_tinta <- which(apply(tramo < 0.5, 2, any))
    expect_gt(length(con_tinta), 100L)
    expect_gte(min(con_tinta), round(L$x_left * ncol(g)) - 4L)
    expect_lte(max(con_tinta), round(L$x_right * ncol(g)) + 4L)
  }
})

test_that("mas renglones de los que caben se recortan con aviso", {
  fila <- function(label) list(fields = list(list(label = label, span = 1)))
  rows <- lapply(sprintf("Campo %d", seq_len(11L)), fila)
  compiled <- .cfx_compiled(collection_material_field_sheet_template(rows = rows))
  dir <- tempfile("cfx-over-"); dir.create(dir)
  pdf_path <- file.path(dir, "over.pdf")
  rendered <- collection_material_render_compiled(compiled, pdf_path, device = "pdf")
  hit <- Filter(function(w) identical(w$code, "form_lines_overflow"), rendered$warnings)
  expect_length(hit, 1L)
  expect_identical(hit[[1]]$rows, 11L)
  expect_lt(hit[[1]]$visible_rows, 11L)
  # El recorte de renglones no debe recortar tambien el QR ni su enlace.
  expect_collection_material_pdf_valid(pdf_path, rendered)
})

test_that("una etiqueta que se come su renglon avisa en vez de dibujar una raya inutil", {
  rows <- list(list(fields = list(list(
    label = strrep("Etiqueta larguisima ", 6L), span = 0.15
  ))))
  compiled <- .cfx_compiled(collection_material_field_sheet_template(rows = rows))
  dir <- tempfile("cfx-room-"); dir.create(dir)
  pdf_path <- file.path(dir, "room.pdf")
  rendered <- collection_material_render_compiled(compiled, pdf_path, device = "pdf")
  expect_true("form_field_no_room" %in% vapply(
    rendered$warnings, function(w) as.character(w$code %||% ""), character(1)
  ))
  expect_collection_material_pdf_valid(pdf_path, rendered)
})

test_that("los cuatro numeros del cuadre no se pisan entre si", {
  skip_if_not_installed("png")
  # La fila de aplicadas paso de dos campos a cuatro —el cuadre del parte
  # necesita duplicados y efectivas— y el formulario esta lleno, asi que no
  # habia sitio para una fila mas. El riesgo de meter cuatro donde habia dos es
  # que las etiquetas se solapen: aqui se comprueba que siguen siendo bloques
  # de tinta SEPARADOS.
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  dir <- tempfile("cfx-cuatro-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .cfx_grey(png_path)
  L <- prosecnurapp:::.cfc_layout()
  filas <- collection_material_field_form_rows()
  idx <- which(vapply(filas, function(f) length(f$fields) == 4L, logical(1)))
  expect_length(idx, 1L)

  y <- L$form_top - (idx[[1]] - 1L) * L$form_step
  media <- L$form_step / 3
  tramo <- g[max(1L, round((1 - (y + media)) * nrow(g))):min(nrow(g), round((1 - (y - media)) * nrow(g))), , drop = FALSE]
  columnas <- which(apply(tramo < 0.5, 2, any))
  expect_gt(length(columnas), 100L)

  # Cuatro etiquetas separadas dejan al menos cuatro bloques de tinta. Si se
  # pisaran, los bloques se fundirian en menos.
  bloques <- length(which(diff(columnas) > 3L)) + 1L
  expect_gte(bloques, 4L)
  expect_gte(min(columnas), round(L$x_left * ncol(g)) - 4L)
  expect_lte(max(columnas), round(L$x_right * ncol(g)) + 4L)
})
