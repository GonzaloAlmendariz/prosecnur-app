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
