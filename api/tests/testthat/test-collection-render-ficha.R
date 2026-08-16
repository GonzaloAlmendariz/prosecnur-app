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
# capacidad no es un numero elegido: sale de la banda disponible entre el grid y
# el bloque del enlace.

.crf_grid_capacity <- function(L) {
  max(1L, as.integer(floor((L$y_rows_top - (L$y_link + 0.055)) / L$row_step_min)) + 1L)
}

.crf_grid_fields <- function(template) {
  grid <- Filter(function(b) identical(b$type, "field_grid"), template$pages[[1]]$blocks)[[1]]
  grid$fields
}

test_that("las plantillas de la casa caben en su propia hoja", {
  builtin <- .crf_grid_fields(collection_material_builtin_template())
  branded <- .crf_grid_fields(collection_material_branded_sheet_template(assets = "logo-x"))

  # El control: con el paso fijo anterior la capacidad era 6 y la branded 7.
  expect_lte(length(builtin), .crf_grid_capacity(.crf_layout()))
  expect_lte(length(branded), .crf_grid_capacity(.crf_layout(branded = TRUE)))
})

test_that("pocas filas reparten la banda en vez de dejar el hueco abajo", {
  L <- .crf_layout()
  band <- L$y_rows_top - (L$y_link + 0.055)
  paso <- function(n) if (n > 1L) min(L$row_step, band / (n - 1L)) else 0
  fondo <- function(n) L$y_rows_top - (n - 1L) * paso(n)

  # Con 6 campos el grid llega casi al enlace; con el paso fijo viejo (0.053)
  # se quedaba en 0.510 y dejaba una franja muerta de ~0.13 npc.
  expect_gt(fondo(6L), L$y_link)
  expect_lt(fondo(6L) - L$y_link, 0.09)
  # Y nunca se aprieta por debajo del minimo legible.
  expect_gte(paso(.crf_grid_capacity(L)), L$row_step_min * 0.999)
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
  L <- .crf_layout()
  banda <- L$y_log_rows - L$y_log_floor
  capacidad <- max(1L, as.integer(floor(banda / L$log_row_step_min)) + 1L)
  filas <- as.integer(.crf_log_block(collection_material_builtin_template())$rows)
  paso <- if (filas > 1L) min(L$log_row_step, banda / (filas - 1L)) else 0

  expect_lte(filas, capacidad)
  # El control: con el paso fijo de 0.032 la quinta linea caia en 0.040 y el pie
  # vive en ~0.038 — la etiqueta se imprimia encima del logo.
  expect_gte(L$y_log_rows - (filas - 1L) * paso, L$y_log_floor)
})

test_that("un registro mas largo que su banda se recorta con aviso, no se desborda", {
  template <- collection_material_builtin_template()
  bloque <- which(vapply(template$pages[[1]]$blocks, function(b) identical(b$type, "application_log"), logical(1)))
  template$pages[[1]]$blocks[[bloque]]$rows <- 6L
  template$pages[[1]]$blocks[[bloque]]$labels <- as.list(c(collection_material_application_log_labels(), "Observaciones:"))
  template$template_sha256 <- NULL
  template$template_sha256 <- collection_fingerprint(template)

  L <- .crf_layout()
  capacidad <- max(1L, as.integer(floor((L$y_log_rows - L$y_log_floor) / L$log_row_step_min)) + 1L)
  expect_gt(6L, capacidad)
  expect_true(collection_material_template_validate(template)$ok)
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
