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

.cfx_compiled <- function(template, url = "https://x.test/enc", collector = "PILOTO_2026",
                          dimensions = NULL) {
  unit <- list(unit_id = "u1", label = "Rotulo de la unidad", role = "piloto", group = "PILOTO")
  if (!is.null(dimensions)) unit$dimensions <- dimensions
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
  # Los DOS codigos: «CH 1 MAT202_0591». El academico solo identifica el curso
  # pero no el operativo; «CH 1» solo vivia en el nombre del archivo, que
  # desaparece al imprimir la hoja.
  expect_identical(bloque("titulo")$binding, "unit.codigo_ficha")
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
    "Ya respondieron:", "Efectivas:",
    # Matriculados (impreso, viene del plan) y observaciones (en blanco).
    "N° de alumnos matriculados:", "Observaciones:"
  ) %in% etiquetas))

  # «Menores de edad» salio de la hoja (Gonzalo, 2026-09-01): no participa del
  # cuadre del parte y el libro no tiene columna para el. Su ancho paso al
  # conteo de asistencia.
  expect_false("Menores de edad:" %in% etiquetas)

  # La hoja no desdobla la aplicacion en fisico y virtual: es una sola cifra.
  expect_false(any(grepl("virtual|físico|fisico", etiquetas, ignore.case = TRUE)))

  # Que un campo se imprima o se deje en blanco lo decide UNA pregunta: si el
  # plan conoce el dato antes de imprimir. Este bloque sella las dos listas.
  #
  # Hasta el 2026-08-27 el unico con dato era matriculados, y los otros cinco que
  # el plan tambien sabe salian en blanco: el aplicador tenia que copiarlos de
  # otra hoja, que es el paso que la ficha existe para ahorrar. El pabellon y el
  # horario venian en `SESIONES` del catalogo y el nombre del docente en
  # `NOMBREDOCENTE`; ver calc_muestra_aulas_sesiones.R.
  bindings <- list()
  for (r in rows) for (f in r$fields) {
    if (!is.null(f$binding)) bindings[[f$label]] <- f$binding
  }
  expect_identical(bindings[["Facultad"]], "unit.faculty")
  expect_identical(bindings[["Pabellón y aula:"]], "unit.venue")
  expect_identical(bindings[["Curso:"]], "unit.course_name")
  expect_identical(bindings[["Horario del curso:"]], "unit.schedule")
  expect_identical(bindings[["Docente:"]], "unit.teacher")
  expect_identical(bindings[["N° de alumnos matriculados:"]], "unit.eligible_n")

  # Y lo que NO se sabe hasta entrar al aula sigue siendo raya en blanco. Sin
  # esta mitad, un binding de mas -«efectivas», «rechazos»- pasaria sin ruido.
  sin_dato <- c(
    "N° de alumnos en aula", "Hombres:", "Mujeres:",
    "N° de encuestas aplicadas:", "Rechazos:", "Ya respondieron:", "Efectivas:",
    "Aplicador/a", "Fecha:", "Hora de aplicación:", "Observaciones:"
  )
  expect_true(all(vapply(sin_dato, function(l) is.null(bindings[[l]]), logical(1))))
})

test_that("un valor mas largo que su celda se recorta y no invade la de al lado", {
  # Medido sobre el libro de HSVG2026: el horario llega a 141 caracteres con
  # cuatro sesiones y el nombre del curso a 128, contra un p99 de 51 y 65. El
  # renderer dibujaba el valor donde terminaba la etiqueta sin medir nada, asi
  # que esos pocos se comian la celda vecina o el margen de la hoja — un defecto
  # que se descubre en la impresora.
  gp <- grid::gpar(fontsize = 8.6)
  largo <- paste(rep("DETECCION OPORTUNA Y DERIVACION", 6), collapse = " ")

  grDevices::pdf(NULL)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()

  recortado <- .cfc_recortar(largo, 0.2, gp)
  expect_lt(nchar(recortado), nchar(largo))
  expect_match(recortado, "…$")
  expect_lte(.cfc_text_width(recortado, gp), 0.2)

  # Lo que ya cabe se imprime entero, sin elipsis de adorno.
  expect_identical(.cfc_recortar("A506", 0.5, gp), "A506")
  # Vacio y sin sitio no inventan nada. Sin hueco NO se imprime: dejar pasar el
  # valor entero «porque no cabe igual» es lo que deformaba la hoja.
  expect_identical(.cfc_recortar("", 0.5, gp), "")
  expect_identical(.cfc_recortar("A506", 0, gp), "")
})

test_that("matriculados se imprime desde el plan, no se deja en blanco para copiar a mano", {
  skip_if_not_installed("png")
  # Pedido de Gonzalo (2026-08-19), comparado contra un prototipo previo en
  # Python: el total de alumnos matriculados ya lo conoce el plan antes de
  # imprimir, asi que se imprime en vez de dejarse como una raya para llenar.
  compiled <- .cfx_compiled(
    collection_material_field_sheet_template(), dimensions = list(eligible_n = 42)
  )
  filas <- Filter(function(f) identical(f$binding, "unit.eligible_n"), unlist(
    lapply(
      Filter(function(b) identical(b$type, "form_lines"), compiled$pages[[1]]$blocks)[[1]]$rows,
      function(r) r$fields
    ),
    recursive = FALSE
  ))
  expect_length(filas, 1L)
  # El VALOR compilado -lo que el PDF va a imprimir- es el dato real, no un
  # texto generico ni el binding crudo.
  expect_identical(filas[[1]]$value, "42")

  dir <- tempfile("cfx-matriculados-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  # El renglon impreso deja tinta (el numero) donde un renglon en blanco
  # dejaria una sola raya angosta: se comprueba que hay tinta bien mas alla de
  # donde termina la etiqueta, señal de que el valor SI se dibujo.
  g <- .cfx_grey(png_path)
  L <- prosecnurapp:::.cfc_layout()
  idx <- which(vapply(
    collection_material_field_form_rows(),
    function(r) identical(r$fields[[1]]$binding %||% "", "unit.eligible_n"), logical(1)
  ))
  expect_length(idx, 1L)
  y <- L$form_top - (idx[[1]] - 1L) * L$form_step
  media <- L$form_step / 3
  tramo <- g[max(1L, round((1 - (y + media)) * nrow(g))):min(nrow(g), round((1 - (y - media)) * nrow(g))), , drop = FALSE]
  con_tinta <- which(apply(tramo < 0.5, 2, any))
  expect_gt(length(con_tinta), 100L)
})

test_that("sin dato de matriculados, el renglon dice 'Sin dato' en vez de un vacio silencioso", {
  # `.crf_txt(..., "Sin dato")` es el fallback existente de `eligible_n` -no
  # se toca-, pero conviene confirmar que sigue vivo para este binding nuevo:
  # una ficha sin ese dato imprime la palabra "SIN DATO", no deja el renglon
  # en blanco sin explicar por que (que se leeria como un campo mas para
  # llenar a mano, cuando en realidad es un dato que deberia venir del plan).
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  bloque <- Filter(function(b) identical(b$type, "form_lines"), compiled$pages[[1]]$blocks)[[1]]
  fila <- Filter(function(r) {
    any(vapply(r$fields, function(f) identical(f$binding %||% "", "unit.eligible_n"), logical(1)))
  }, bloque$rows)
  expect_length(fila, 1L)
  expect_identical(fila[[1]]$fields[[1]]$value, "Sin dato")
})

test_that("el QR domina la pagina y se relee con la geometria de este layout", {
  url <- "https://ee-eu.kobotoolbox.org/x/5rbcghMb?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=PILOTO_2026"
  compiled <- .cfx_compiled(collection_material_field_sheet_template(), url)
  dir <- tempfile("cfx-qr-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  L <- prosecnurapp:::.cfc_layout()
  # **El umbral mide el simbolo, no su caja.** Decia `> 130` sobre un `qr_side`
  # de 0.68 y parecia holgadisimo, pero ese 0.68 era la matriz CON su zona de
  # silencio dentro: el simbolo real medi­a 0.68 * 25/33 = 108 mm con un enlace
  # corto. Ahora `qr_side` es el simbolo y vale 115 mm garantizados —mas QR con
  # un numero mas bajo—. Un umbral sobre la caja da por buena una hoja cuyo
  # codigo encogio, que es exactamente lo que este aserto existe para impedir.
  expect_gt(L$qr_side * 8.27 * 25.4, 110)

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

test_that("el titulo son los codigos de la unidad, centrado y debajo del QR", {
  skip_if_not_installed("png")
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  # Sin codigo operativo en las dimensiones, el fixture solo tiene la etiqueta:
  # media identidad en caja alta, que es mejor que una cadena con un hueco.
  expect_identical(
    Filter(function(b) identical(b$block_id, "titulo"), compiled$pages[[1]]$blocks)[[1]]$value,
    "ROTULO DE LA UNIDAD"
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

test_that("los numeros de cada fila densa no se pisan entre si", {
  skip_if_not_installed("png")
  # Dos filas llevan varios campos: el cuadre del parte (aplicadas/rechazos/
  # ya respondieron/efectivas, cuatro) y el conteo de asistencia (alumnos en
  # aula/hombres/mujeres, tres desde que «Menores de edad» salio el
  # 2026-09-01). El riesgo de apretar campos es que las etiquetas se solapen:
  # aqui se comprueba que cada fila densa deja tantos bloques de tinta
  # SEPARADOS como campos tiene.
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  dir <- tempfile("cfx-cuatro-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .cfx_grey(png_path)
  L <- prosecnurapp:::.cfc_layout()
  filas <- collection_material_field_form_rows()
  n_campos <- vapply(filas, function(f) length(f$fields), integer(1))
  idx <- which(n_campos >= 3L)
  expect_length(idx, 2L)

  for (fila_idx in idx) {
    y <- L$form_top - (fila_idx - 1L) * L$form_step
    media <- L$form_step / 3
    tramo <- g[max(1L, round((1 - (y + media)) * nrow(g))):min(nrow(g), round((1 - (y - media)) * nrow(g))), , drop = FALSE]
    columnas <- which(apply(tramo < 0.5, 2, any))
    expect_gt(length(columnas), 100L, label = sprintf("fila %d", fila_idx))

    # N etiquetas separadas dejan al menos N bloques de tinta. Si se
    # pisaran, los bloques se fundirian en menos.
    bloques <- length(which(diff(columnas) > 3L)) + 1L
    expect_gte(bloques, n_campos[[fila_idx]], label = sprintf("fila %d", fila_idx))
    expect_gte(min(columnas), round(L$x_left * ncol(g)) - 4L, label = sprintf("fila %d", fila_idx))
    expect_lte(max(columnas), round(L$x_right * ncol(g)) + 4L, label = sprintf("fila %d", fila_idx))
  }
})

test_that("el aire de la hoja no se acumula en el margen de arriba", {
  skip_if_not_installed("png")
  # Pedido de Gonzalo (2026-08-27): «hay mucho margen entre la parte inferior y
  # superior del QR». Medido sobre el PNG a 150 dpi antes de tocarlo: 239 px de
  # blanco por encima del QR contra 43 por debajo del pie —13,6 % del alto
  # arriba y 2,5 % abajo—, y otros 144 px entre el QR y su título.
  #
  # Este test mide TINTA sobre la página, no el layout contra sí mismo: los
  # otros calculan la posición de cada renglón con `L$form_top` y `L$form_step`,
  # así que se mueven con la geometría y nunca habrían visto el margen. Por eso
  # el defecto llegó a una hoja que ya se había mirado varias veces.
  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  dir <- tempfile("cfx-aire-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .cfx_grey(png_path)
  con_tinta <- which(apply(g < 0.5, 1, any))
  arriba <- min(con_tinta) - 1L
  abajo <- nrow(g) - max(con_tinta)

  # El margen de arriba no puede ser un múltiplo del de abajo: la hoja se lee
  # como una sola pieza o como un QR flotando sobre un formulario.
  expect_lt(arriba / nrow(g), 0.06)
  expect_lt(arriba, abajo * 2L)
})

test_that("observaciones deja DOS renglones para escribir, no medio", {
  skip_if_not_installed("png")
  # La casilla existe justo para lo que ninguna otra previó, y con una sola
  # línea lo que quedaba después de la etiqueta era media. `lines = 2` en el
  # campo, no una fila extra sin etiqueta: el contrato de plantilla exige que
  # toda línea diga a quien la llena lo que va en ella.
  rows <- collection_material_field_form_rows()
  obs <- rows[[length(rows)]]$fields[[1]]
  expect_identical(obs$label, "Observaciones:")
  expect_identical(as.integer(obs$lines), 2L)

  compiled <- .cfx_compiled(collection_material_field_sheet_template())
  dir <- tempfile("cfx-obs-"); dir.create(dir)
  png_path <- file.path(dir, "ficha.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .cfx_grey(png_path)
  L <- prosecnurapp:::.cfc_layout()
  # Observaciones es la última fila; con las anteriores de una línea, su primer
  # renglón cae en el índice length(rows)-1 contando desde 0.
  y1 <- L$form_top - (length(rows) - 1L) * L$form_step
  y2 <- y1 - L$form_step
  franja <- L$form_step / 3
  tinta_en <- function(y) {
    desde <- round((1 - (y + franja)) * nrow(g))
    hasta <- round((1 - (y - franja)) * nrow(g))
    tramo <- g[max(1L, desde):min(nrow(g), hasta), , drop = FALSE]
    which(apply(tramo < 0.5, 2, any))
  }
  # Las dos con línea real, y la segunda arrancando en el margen izquierdo
  # —sangrarla bajo la etiqueta sólo robaría sitio para escribir—.
  expect_gt(length(tinta_en(y1)), 100L)
  segunda <- tinta_en(y2)
  expect_gt(length(segunda), 100L)
  expect_lte(min(segunda), round(L$x_left * ncol(g)) + 6L)
})

test_that("la capacidad se cuenta en renglones dibujados, no en filas", {
  # Un campo con `lines = 2` ocupa dos renglones de papel. Contando filas, una
  # hoja que no cabe pasaba el control y se dibujaba por debajo del suelo.
  L <- prosecnurapp:::.cfc_layout()
  capacity <- as.integer(floor((L$form_top - L$form_floor) / L$form_step)) + 1L
  fila <- function(...) list(fields = list(...))
  campo <- function(label, span, lines = NULL) list(label = label, span = span, lines = lines)

  # Justo `capacity` filas de una línea: cabe entera, sin aviso.
  justas <- lapply(seq_len(capacity), function(i) fila(campo(paste("Campo", i), 1)))
  r <- collection_material_render_compiled(
    .cfx_compiled(collection_material_field_sheet_template(rows = justas)),
    file.path(tempdir(), "cap-ok.pdf"), device = "pdf"
  )
  expect_length(Filter(function(w) identical(w$code, "form_lines_overflow"), r$warnings), 0L)

  # Las mismas filas pero con la última pidiendo dos líneas: ya no cabe.
  con_extra <- justas
  con_extra[[capacity]] <- fila(campo("Observaciones:", 1, lines = 2L))
  r2 <- collection_material_render_compiled(
    .cfx_compiled(collection_material_field_sheet_template(rows = con_extra)),
    file.path(tempdir(), "cap-overflow.pdf"), device = "pdf"
  )
  expect_length(Filter(function(w) identical(w$code, "form_lines_overflow"), r2$warnings), 1L)
})

test_that("lines fuera de rango lo rechaza el contrato de plantilla", {
  expect_true("bad_form_lines_count" %in% .cfx_codes(.cfx_validate_rows(
    list(list(fields = list(list(label = "Observaciones:", span = 1, lines = 9L))))
  )))
  expect_true("bad_form_lines_count" %in% .cfx_codes(.cfx_validate_rows(
    list(list(fields = list(list(label = "Observaciones:", span = 1, lines = 0L))))
  )))
  expect_false("bad_form_lines_count" %in% .cfx_codes(.cfx_validate_rows(
    list(list(fields = list(list(label = "Observaciones:", span = 1, lines = 2L))))
  )))
})

test_that("el titulo lleva los DOS codigos: operativo y curso-horario", {
  # Pedido de Gonzalo (2026-08-27): «el titulo debe decir CH X COD-COD».
  # Por separado ninguno basta. El académico solo —«mat202_0591»— identifica el
  # curso pero no el operativo, y «CH 1» vivía sólo en el nombre del archivo,
  # que desaparece en cuanto la hoja se imprime.
  expect_identical(.crf_codigo_ficha("CH 1", "mat202_0591"), "CH 1 MAT202_0591")
  expect_identical(.crf_codigo_ficha("R 1.2", "1mat37_0521"), "R 1.2 1MAT37_0521")
  expect_identical(.crf_codigo_ficha("EXTRA 79", "1cce17_0506"), "EXTRA 79 1CCE17_0506")

  # Media identidad es mejor que una cadena con un hueco.
  expect_identical(.crf_codigo_ficha("", "mat202_0591"), "MAT202_0591")
  expect_identical(.crf_codigo_ficha("CH 1", ""), "CH 1")
  expect_identical(.crf_codigo_ficha("", ""), "")
  # Hay marcos donde el código operativo ES el curso-horario: no se repite.
  expect_identical(.crf_codigo_ficha("MAT202_0591", "mat202_0591"), "MAT202_0591")
  # El guion bajo se conserva: es la forma del marco, la del nombre del PDF y la
  # del identificador que viaja en el QR. Traducirlo daria dos escrituras del
  # mismo codigo en la misma hoja.
  expect_false(grepl("-", .crf_codigo_ficha("CH 1", "mat202_0591"), fixed = TRUE))

  # Y llega compilado al bloque de título, no sólo calculado.
  template <- collection_material_field_sheet_template()
  compiled <- .cfx_compiled(template, dimensions = list(legacy_ref = "CH 1"))
  expect_identical(.crf_block(compiled$pages[[1]], "heading")$value, "CH 1 ROTULO DE LA UNIDAD")
})
