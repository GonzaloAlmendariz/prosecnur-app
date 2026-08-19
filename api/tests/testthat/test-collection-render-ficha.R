# Spike de render de la ficha (unidad 10 del plan de Recopiladores).
#
# El gate del plan pide dos cosas: que la página PNG y la PDF sean equivalentes,
# y que el QR sea legible. Se verifican de forma distinta porque son riesgos
# distintos: la equivalencia es que no haya dos dibujos, y la legibilidad es que
# el dibujo no destruya los módulos.

ficha_demo <- function(...) {
  base <- list(
    unit_label = "AULA 1",
    course_name = "Cálculo 1",
    schedule = "0404",
    venue = "Pabellón A - 201",
    teacher = "Docente de prueba",
    faculty = "Facultad A",
    sample_label = "M1",
    eligible_n = 32,
    link = "https://kf.kobotoolbox.org/x/aXbYcZ?d%5BcollectorID%5D=AULA1",
    period = "Julio 2026"
  )
  utils::modifyList(base, list(...))
}

test_that("el QR se genera en R y no depende del navegador", {
  # ADR 0046 §13: el QR autoritativo es del backend.
  m <- collection_qr_matrix("https://kf/x?d=A-1")
  expect_true(is.matrix(m))
  expect_type(m, "logical")
  expect_identical(nrow(m), ncol(m))
  expect_true(any(m))   # hay módulos oscuros
  expect_true(any(!m))  # y claros
})

test_that("el QR es determinista para el mismo enlace y distinto para otro", {
  a <- collection_qr_matrix("https://kf/x?d=A-1")
  expect_identical(a, collection_qr_matrix("https://kf/x?d=A-1"))
  expect_false(identical(dim(a), dim(collection_qr_matrix(paste(rep("x", 300), collapse = "")))))
})

test_that("un enlace vacio no produce un QR falso", {
  # Un cuadro que parece QR y no lleva a ninguna parte es peor que un hueco.
  expect_error(collection_qr_matrix(""), "sin enlace")
  expect_error(collection_qr_matrix(NULL), "sin enlace")
})

test_that("renderiza PDF y PNG con el mismo cuerpo de dibujo", {
  dir <- withr::local_tempdir()
  pdf_path <- file.path(dir, "ficha.pdf")
  png_path <- file.path(dir, "ficha.png")

  r_pdf <- collection_render_ficha_receipt(ficha_demo(), pdf_path, device = "pdf")
  r_png <- collection_render_ficha_receipt(ficha_demo(), png_path, device = "png", dpi = 150)

  expect_true(file.exists(pdf_path))
  expect_true(file.exists(png_path))
  expect_gt(r_pdf$bytes, 1000)
  expect_gt(r_png$bytes, 1000)
  expect_match(r_pdf$sha256, "^[0-9a-f]{64}$")
  expect_match(r_png$sha256, "^[0-9a-f]{64}$")

  # Es un PDF de una sola página: una ficha es una hoja.
  expect_identical(qpdf::pdf_length(pdf_path), 1L)
})

test_that("el mismo render dos veces da el mismo PNG", {
  # Si el dibujo tuviera aleatoriedad o dependiera del reloj, el spike no
  # serviría como base para comparar preview contra final.
  dir <- withr::local_tempdir()
  a <- collection_render_ficha_receipt(ficha_demo(), file.path(dir, "a.png"), device = "png")
  b <- collection_render_ficha_receipt(ficha_demo(), file.path(dir, "b.png"), device = "png")
  expect_identical(a$sha256, b$sha256)
})

test_that("el QR dibujado conserva sus modulos en el PNG", {
  # No es un decodificador de terceros —eso exigiría zbar/OpenCV, que el ADR
  # evita— sino fidelidad de modulos, que es donde falla el dibujo: escala mal
  # calculada, antialiasing que come un modulo, colores invertidos.
  dir <- withr::local_tempdir()
  png_path <- file.path(dir, "ficha.png")
  link <- ficha_demo()$link

  esperada <- collection_qr_matrix(link)
  collection_render_ficha(ficha_demo(), png_path, device = "png", dpi = 300)
  leida <- collection_qr_matrix_from_png(png_path, nrow(esperada), dpi = 300)

  expect_identical(dim(leida), dim(esperada))
  iguales <- sum(leida == esperada)
  total <- length(esperada)
  # Se exige identidad total: un solo modulo mal ya puede romper la lectura, y
  # aceptar "casi" convertiría el test en un termometro sin umbral.
  expect_identical(
    iguales, total,
    info = sprintf("%d de %d modulos coinciden", iguales, total)
  )
})

test_that("la quiet zone del QR queda blanca en el PNG", {
  # La quiet zone es parte del QR, no un margen decorativo: sin ella el lector
  # no encuentra el patron de posicion.
  dir <- withr::local_tempdir()
  png_path <- file.path(dir, "ficha.png")
  esperada <- collection_qr_matrix(ficha_demo()$link)
  collection_render_ficha(ficha_demo(), png_path, device = "png", dpi = 300)
  leida <- collection_qr_matrix_from_png(png_path, nrow(esperada), dpi = 300)

  # `qr_code` incluye la quiet zone en la matriz: los bordes son claros.
  expect_false(any(leida[1, ]))
  expect_false(any(leida[nrow(leida), ]))
  expect_false(any(leida[, 1]))
  expect_false(any(leida[, ncol(leida)]))
})

test_that("una ficha sin enlace se dibuja y lo dice", {
  # El caso real: la agenda existe pero los enlaces todavia no. La ficha no debe
  # reventar ni fingir un QR.
  dir <- withr::local_tempdir()
  png_path <- file.path(dir, "sin-enlace.png")
  expect_no_error(collection_render_ficha(ficha_demo(link = ""), png_path, device = "png"))
  expect_true(file.exists(png_path))

  esperada_n <- nrow(collection_qr_matrix("https://kf/x?d=A-1"))
  leida <- collection_qr_matrix_from_png(png_path, esperada_n, dpi = 150)
  # Sin enlace no hay modulos: el area del QR queda clara salvo el texto.
  expect_lt(sum(leida) / length(leida), 0.15)
})

test_that("los campos ausentes no rompen el dibujo", {
  dir <- withr::local_tempdir()
  pelada <- list(link = "https://kf/x?d=A-1")
  expect_no_error(collection_render_ficha(pelada, file.path(dir, "pelada.pdf"), device = "pdf"))
  expect_no_error(collection_render_ficha(list(), file.path(dir, "vacia.pdf"), device = "pdf"))
})

test_that("un enlace largo sigue siendo dibujable", {
  # Un Web Link con variables puede ser largo; el QR crece en modulos y el
  # dibujo tiene que aguantar sin desbordar la caja.
  dir <- withr::local_tempdir()
  largo <- paste0("https://kf.kobotoolbox.org/x/aXbYcZ?", paste0("v", 1:40, "=valor", 1:40, collapse = "&"))
  png_path <- file.path(dir, "largo.png")

  esperada <- collection_qr_matrix(largo)
  expect_gt(nrow(esperada), 31)  # de verdad creció
  collection_render_ficha(ficha_demo(link = largo), png_path, device = "png", dpi = 300)
  leida <- collection_qr_matrix_from_png(png_path, nrow(esperada), dpi = 300)
  expect_identical(sum(leida == esperada), length(esperada))
})

# --- El rol impreso ----------------------------------------------------------
# Titular y reemplazo salian identicos salvo el nombre del aula: el unico
# indicio era "Muestra: M1" vs "R1", que solo entiende quien conoce la
# nomenclatura. Entregar la ficha de un reemplazo como si fuera titular cuesta
# una aplicacion entera.

test_that("el rol se imprime en espanol y dice a quien reemplaza", {
  expect_identical(.crf_role_label("titular"), "Titular")
  expect_identical(.crf_role_label("chain_reserve", "CH 3"), "Reemplazo de CH 3")
  expect_identical(.crf_role_label("chain_reserve"), "Reemplazo")
  expect_identical(.crf_role_label("extra_reserve_pool"), "Reserva adicional")
})

test_that("la jerga del motor nunca llega al papel", {
  # El control: con `unit.role` en crudo esto valia "chain_reserve".
  for (role in c("titular", "chain_reserve", "extra_reserve_pool")) {
    expect_false(grepl("_", .crf_role_label(role), fixed = TRUE), info = role)
  }
  # Un rol desconocido se imprime tal cual en vez de inventarle una etiqueta.
  expect_identical(.crf_role_label("piloto_2026"), "piloto_2026")
})

test_that("una ficha de titular y una de reemplazo no se confunden", {
  titular <- .crf_unit_context(list(
    unit_id = "u1", label = "Aula 1", role = "titular",
    dimensions = list(course_name = "Curso 1")
  ))
  reserva <- .crf_unit_context(list(
    unit_id = "u5", label = "Aula 5", role = "chain_reserve",
    dimensions = list(course_name = "Curso 5", replacement_for = "CH 1")
  ))

  expect_identical(titular$role, "Titular")
  expect_identical(reserva$role, "Reemplazo de CH 1")
  expect_false(identical(titular$role, reserva$role))
  expect_identical(reserva$replacement_for, "CH 1")
})

test_that("la ficha built-in imprime el rol", {
  # El registro de bindings puede permitir `unit.role` y la plantilla no usarlo:
  # permitir no es dibujar.
  fields <- collection_material_builtin_template()$pages[[1]]$blocks
  grid <- Filter(function(b) identical(b$type, "field_grid"), fields)[[1]]
  bindings <- vapply(grid$fields, function(f) as.character(f$binding %||% ""), character(1))

  expect_true("unit.role" %in% bindings)
  expect_identical(grid$fields[[which(bindings == "unit.role")]]$label, "Rol")
})

# --- Capacidad y reparto del grid --------------------------------------------
# Anadir un campo a la ficha con careta la desbordo en silencio: 7 campos contra
# 6 de capacidad, y "Estudiantes" se caia con un warning que nadie lee. La
# capacidad no es un numero elegido: sale del plan de flujo real (orden +
# tamano de los demas bloques presentes), no de una banda fija entre dos
# anclajes -eso era justo lo que volvia cosmetico el orden de los bloques.

.crf_grid_fields <- function(template) {
  grid <- Filter(function(b) identical(b$type, "field_grid"), template$pages[[1]]$blocks)[[1]]
  grid$fields
}

# Compilado minimo para poder llamarle al plan de flujo real -sin esto los
# bloques del template no traen `$lines`/`$rows` y la medicion de altura
# subestima todo a "vacio".
.crf_render_test_compiled <- function(template) {
  unit <- list(
    unit_id = "u1", label = "Prueba", role = "titular", group = "M1",
    dimensions = list(course_name = "Curso de prueba", faculty = "Facultad de prueba")
  )
  binding <- list(
    access_id = "a1", logical_collector_id = "u1", unit_id = "u1",
    access_kind = "manual_handoff", access_ref = "https://x.test/enc", status = "ready"
  )
  deployment <- list(
    deployment_id = "d1", target = list(provider = "kobo"), bindings = list(binding),
    sensitivity = list(access_urls = "operational"), status = "prepared"
  )
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m1",
    template_ref = list(template_id = template$template_id, revision = 1L, sha256 = template$template_sha256),
    deployment_id = "d1", deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)), instance_fingerprint = fp("m1"),
    unit_refs = list("u1"), access_refs = list("a1"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  collection_material_compile(
    template, instance, project = list(name = "Proyecto de prueba", period = "Prueba"),
    plan = list(plan_id = "p1", units = list(unit)), deployment = deployment
  )
}

.crf_grid_plan_item <- function(template) {
  compiled <- .crf_render_test_compiled(template)
  page <- compiled$pages[[1]]
  L <- .crf_layout(branded = !is.null(.crf_block(page, "brand_strip")))
  plan <- .crf_flow_plan(page$blocks, L, pulso_pdf_type(), pulso_pdf_geo("portrait"))
  list(L = L, item = Find(function(it) identical(it$type, "field_grid"), plan$items))
}

test_that("las plantillas de la casa caben en su propia hoja", {
  builtin <- .crf_grid_fields(collection_material_builtin_template())
  branded <- .crf_grid_fields(collection_material_branded_sheet_template(assets = "logo-x"))

  cap_builtin <- .crf_grid_plan_item(collection_material_builtin_template())
  cap_branded <- .crf_grid_plan_item(collection_material_branded_sheet_template(assets = "logo-x"))
  capacidad <- function(res) max(1L, as.integer(floor(res$item$height / res$L$row_step_min)) + 1L)

  expect_lte(length(builtin), capacidad(cap_builtin))
  expect_lte(length(branded), capacidad(cap_branded))
})

test_that("pocas filas reparten la banda en vez de dejar el hueco abajo", {
  res <- .crf_grid_plan_item(collection_material_builtin_template())
  L <- res$L
  band <- res$item$height
  banda_floor <- res$item$y_top - band
  paso <- function(n) if (n > 1L) min(L$row_step, band / (n - 1L)) else 0
  fondo <- function(n) res$item$y_top - (n - 1L) * paso(n)
  capacidad <- max(1L, as.integer(floor(band / L$row_step_min)) + 1L)

  # Con 6 campos el grid llega casi al piso de su banda: no deja un hueco
  # muerto abajo antes del siguiente bloque.
  expect_gt(fondo(6L), banda_floor)
  expect_lt(fondo(6L) - banda_floor, band * 0.5)
  # Y nunca se aprieta por debajo del minimo legible.
  expect_gte(paso(capacidad), L$row_step_min * 0.999)
})

test_that("el lector de QR usa la geometria de la variante que dibujo la hoja", {
  # Ceguera de la cadena de QA: pedia siempre la geometria sin careta, y solo
  # funcionaba porque ambas variantes coincidian en `qr_y`.
  expect_false(identical(.crf_layout()$qr_y, .crf_layout(branded = TRUE)$qr_y))
  expect_true("branded" %in% names(formals(collection_qr_matrix_from_png)))
})

# --- El registro de aplicacion tiene vocabulario -----------------------------
# Tres renglones con un "1", un "2" y un "3" delante no le dicen a nadie que
# anotar: cada aplicador escribia otra cosa, o abria su propia planilla, que es
# justo lo que la ficha existe para evitar.

.crf_log_block <- function(template) {
  Filter(function(b) identical(b$type, "application_log"), template$pages[[1]]$blocks)[[1]]
}

.crf_log_plan_item <- function(template) {
  compiled <- .crf_render_test_compiled(template)
  page <- compiled$pages[[1]]
  L <- .crf_layout(branded = !is.null(.crf_block(page, "brand_strip")))
  plan <- .crf_flow_plan(page$blocks, L, pulso_pdf_type(), pulso_pdf_geo("portrait"))
  list(L = L, item = Find(function(it) identical(it$type, "application_log"), plan$items))
}

test_that("las dos plantillas de la casa comparten un solo vocabulario de registro", {
  builtin <- .crf_log_block(collection_material_builtin_template())
  branded <- .crf_log_block(collection_material_branded_sheet_template(assets = "logo-x"))
  canon <- collection_material_application_log_labels()

  # El control: antes no habia `labels` y el bloque salia numerado.
  expect_identical(as.character(unlist(builtin$labels)), canon)
  # La branded toma su prefijo del mismo juego, no una lista propia que derive.
  expect_identical(
    as.character(unlist(branded$labels)),
    utils::head(canon, length(unlist(branded$labels)))
  )
})

test_that("el registro cabe encima del pie y avisa si no", {
  res <- .crf_log_plan_item(collection_material_builtin_template())
  L <- res$L
  banda <- res$item$height
  banda_floor <- res$item$y_top - 0.028 - banda
  capacidad <- max(1L, as.integer(floor(banda / L$log_row_step_min)) + 1L)
  filas <- as.integer(.crf_log_block(collection_material_builtin_template())$rows)
  paso <- if (filas > 1L) min(L$log_row_step, banda / (filas - 1L)) else 0

  expect_lte(filas, capacidad)
  # El control: con el paso fijo de 0.032 la quinta linea caia en 0.040 y el pie
  # vive en ~0.038 — la etiqueta se imprimia encima del logo.
  expect_gte(res$item$y_top - 0.028 - (filas - 1L) * paso, banda_floor)
})

test_that("un registro mas largo que su banda se recorta con aviso, no se desborda", {
  template <- collection_material_builtin_template()
  bloque <- which(vapply(template$pages[[1]]$blocks, function(b) identical(b$type, "application_log"), logical(1)))
  template$pages[[1]]$blocks[[bloque]]$rows <- 6L
  template$pages[[1]]$blocks[[bloque]]$labels <- as.list(c(collection_material_application_log_labels(), "Observaciones:"))
  template$template_sha256 <- NULL
  template$template_sha256 <- collection_fingerprint(template)
  expect_true(collection_material_template_validate(template)$ok)

  # 6 filas contra la banda real que le toca en el plan de flujo (compite con
  # el field_grid de la misma hoja, no una banda propia fija).
  res <- .crf_log_plan_item(template)
  capacidad <- max(1L, as.integer(floor(max(0, res$item$height - 0.028) / res$L$log_row_step_min)) + 1L)
  rendered <- collection_material_render_compiled(
    .crf_render_test_compiled(template), tempfile(fileext = ".pdf"), device = "pdf"
  )
  overflow <- Filter(function(w) identical(w$code, "application_log_overflow"), rendered$warnings)
  if (6L > capacidad) {
    expect_length(overflow, 1L)
    expect_lt(overflow[[1]]$visible_rows, 6L)
  } else {
    expect_length(overflow, 0L)
  }
})

test_that("labels de mas que renglones no pasa la validacion", {
  template <- collection_material_builtin_template()
  bloque <- which(vapply(template$pages[[1]]$blocks, function(b) identical(b$type, "application_log"), logical(1)))
  template$pages[[1]]$blocks[[bloque]]$rows <- 2L
  template$template_sha256 <- NULL
  template$template_sha256 <- collection_fingerprint(template)

  resultado <- collection_material_template_validate(template)
  expect_false(resultado$ok)
  expect_true("log_labels_overflow" %in% vapply(resultado$problems, function(p) p$code, character(1)))
})

# --- Legibilidad fisica del QR -----------------------------------------------
# Lo que decide si una camara mala lee el simbolo en un aula mal iluminada no es
# el numero de caracteres sino los MILIMETROS QUE MIDE CADA MODULO impreso. Un
# payload mas largo sube la version del simbolo, mete mas modulos en el mismo
# lado y encoge cada uno.
#
# Los tests de QR usaban "https://kf/x?d=A-1": 18 caracteres, 33 modulos. El
# payload que este sistema genera de verdad ronda los 86 y da 49. Se probaba un
# simbolo que la app no produce — el mismo sesgo de fixture que escondia el bug
# del cruce por `collectorID`.

.crf_mm_por_modulo <- function(payload, branded = FALSE) {
  L <- .crf_layout(branded = branded)
  lado_mm <- L$qr_side * pulso_pdf_geo("portrait")$page_w * 25.4
  lado_mm / nrow(collection_qr_matrix(payload))
}

# El enlace mas largo que el sistema llega a producir: servidor europeo, campo
# de prefill con ruta de grupo, y un identificador holgado.
.crf_payload_realista <- function() {
  paste0(
    "https://ee-eu.kobotoolbox.org/x/5rbcghMb",
    "?d%5B/afWqShr22MB4436VTsw32p/collectorID%5D=unit-aulas-aula-01-fd6e0ab1ee"
  )
}

test_that("el QR impreso deja modulos comodos incluso con el enlace mas largo", {
  mm <- .crf_mm_por_modulo(.crf_payload_realista())

  # 0,4 mm es el minimo para un lector decente; 0,6 es la zona comoda para la
  # camara de un telefono a medio metro. Hoy sobra: el simbolo mide ~71 mm.
  expect_gt(mm, 0.6)
  # Y con careta el QR no cambia de tamano, solo de sitio.
  expect_equal(.crf_mm_por_modulo(.crf_payload_realista(), branded = TRUE), mm)
})

test_that("el fixture de QR representa el enlace que el sistema produce", {
  real <- .crf_payload_realista()
  juguete <- "https://kf/x?d=A-1"

  # El control: si alguien vuelve a probar solo con el juguete, esto lo delata.
  expect_gt(nrow(collection_qr_matrix(real)), nrow(collection_qr_matrix(juguete)))
  expect_match(real, "d%5B", fixed = TRUE)
  expect_gt(nchar(real), 60L)
})

test_that("un enlace que encogiera el modulo por debajo del umbral se detecta", {
  # Control del control: un payload absurdo SI baja de 0.6 mm, asi que el
  # aserto de arriba no esta pasando por vacio.
  gigante <- paste0("https://ee.example.test/x/aB3xY9kQ?d%5BcollectorID%5D=", strrep("x", 1200L))
  expect_lt(.crf_mm_por_modulo(gigante), 0.6)
})

# --- El orden de los bloques es funcional, no cosmetico ----------------------
# Antes cada tipo de bloque tenia una `y` fija en `.crf_layout()`: reordenar en
# el editor de Materiales no cambiaba nada en el PDF. Esto prueba que mover un
# bloque en el array de la plantilla mueve de verdad su posicion en la hoja.

.crf_reorder_blocks <- function(template, before_id, after_id) {
  blocks <- template$pages[[1]]$blocks
  ids <- vapply(blocks, function(b) b$block_id, character(1))
  bloque <- blocks[[which(ids == before_id)]]
  sin_bloque <- blocks[ids != before_id]
  ids_sin <- vapply(sin_bloque, function(b) b$block_id, character(1))
  destino <- which(ids_sin == after_id)
  template$pages[[1]]$blocks <- append(sin_bloque, list(bloque), after = destino)
  template$template_sha256 <- NULL
  template$template_sha256 <- collection_fingerprint(template)
  template
}

test_that("subir 'Instrucciones' antes del grid en el array lo sube de verdad en la hoja", {
  original <- collection_material_builtin_template()
  ids_original <- vapply(original$pages[[1]]$blocks, function(b) b$block_id, character(1))
  expect_lt(which(ids_original == "details"), which(ids_original == "instructions"))

  reordenada <- .crf_reorder_blocks(original, before_id = "instructions", after_id = "unit")
  ids_nuevo <- vapply(reordenada$pages[[1]]$blocks, function(b) b$block_id, character(1))
  expect_lt(which(ids_nuevo == "instructions"), which(ids_nuevo == "details"))

  plan_original <- .crf_grid_plan_item(original)
  instr_original <- Find(
    function(it) identical(it$block_id, "instructions"),
    .crf_flow_plan(
      .crf_render_test_compiled(original)$pages[[1]]$blocks, plan_original$L,
      pulso_pdf_type(), pulso_pdf_geo("portrait")
    )$items
  )
  # En el orden original el grid ("details") va arriba de las instrucciones.
  expect_gt(plan_original$item$y_top, instr_original$y_top)

  plan_reordenada <- .crf_grid_plan_item(reordenada)
  instr_reordenada <- Find(
    function(it) identical(it$block_id, "instructions"),
    .crf_flow_plan(
      .crf_render_test_compiled(reordenada)$pages[[1]]$blocks, plan_reordenada$L,
      pulso_pdf_type(), pulso_pdf_geo("portrait")
    )$items
  )
  # Reordenado, las instrucciones deben quedar ARRIBA del grid: el mismo
  # cambio en el array invierte la posicion real en la pagina.
  expect_gt(instr_reordenada$y_top, plan_reordenada$item$y_top)

  # Y el render real no truena con el nuevo orden.
  rendered <- collection_material_render_compiled(
    .crf_render_test_compiled(reordenada), tempfile(fileext = ".pdf"), device = "pdf"
  )
  expect_type(rendered$warnings, "list")
})

# --- El bloque "Separador" dibuja algo, no es un tipo inerte -----------------

.crf_greyscale <- function(path) {
  img <- png::readPNG(path)
  if (length(dim(img)) == 3L) img[, , 1] else img
}

test_that("el bloque divider deja una linea de tinta en su banda", {
  skip_if_not_installed("png")
  template <- collection_material_builtin_template()
  compiled <- .crf_render_test_compiled(template)
  page <- compiled$pages[[1]]
  L <- .crf_layout(branded = FALSE)
  plan <- .crf_flow_plan(page$blocks, L, pulso_pdf_type(), pulso_pdf_geo("portrait"))
  divider_item <- Find(function(it) identical(it$type, "divider"), plan$items)
  expect_false(is.null(divider_item))

  dir <- tempfile("crf-divider-"); dir.create(dir)
  png_path <- file.path(dir, "divider.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 1L, dpi = 150)

  g <- .crf_greyscale(png_path)
  y <- divider_item$y_top - divider_item$height * 0.5
  fila <- round((1 - y) * nrow(g))
  banda <- g[max(1L, fila - 3L):min(nrow(g), fila + 3L), , drop = FALSE]
  # El hairline es #d0d5dd (~0.82 de gris): un umbral claro basta para
  # distinguirlo del blanco de fondo sin confundirse con texto negro cercano.
  expect_true(any(banda < 0.93))
})

test_that("quitar el divider del array no deja una linea fantasma en su lugar", {
  skip_if_not_installed("png")
  template <- collection_material_builtin_template()
  blocks <- template$pages[[1]]$blocks
  ids <- vapply(blocks, function(b) b$block_id, character(1))
  template$pages[[1]]$blocks <- blocks[ids != "rule"]
  template$template_sha256 <- NULL
  template$template_sha256 <- collection_fingerprint(template)

  compiled <- .crf_render_test_compiled(template)
  page <- compiled$pages[[1]]
  L <- .crf_layout(branded = FALSE)
  plan <- .crf_flow_plan(page$blocks, L, pulso_pdf_type(), pulso_pdf_geo("portrait"))
  expect_null(Find(function(it) identical(it$type, "divider"), plan$items))

  rendered <- collection_material_render_compiled(
    compiled, tempfile(fileext = ".pdf"), device = "pdf"
  )
  expect_type(rendered$warnings, "list")
})
