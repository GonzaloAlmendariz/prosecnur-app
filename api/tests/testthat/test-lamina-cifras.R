source("setup-load-all.R")

# F6.0b.6: la pieza «Cifra» del motor nativo (inventario F6, A19).

.cinco <- list(list(valor = "98%", rotulo = "de los docentes conoce la misión", detalle = "Estudiantes 77%, egresados 78%", icono = "landmark"),
               list(valor = "53%", rotulo = "de los estudiantes reconoce la tutoría académica que ofrece la Unidad", detalle = "Entre los docentes, 83%", icono = "users"),
               list(valor = "95%", rotulo = "valora las competencias técnicas", detalle = "Top Two Box de los estudiantes", icono = "award"),
               list(valor = "31%", rotulo = "de los egresados tiene el título", detalle = "Aunque el 98% trabaja", icono = "graduation-cap"),
               list(valor = "417", rotulo = "personas encuestadas", detalle = "En cuatro públicos", icono = "users"))

test_that("la espec admite de una a cinco cifras con valor y rótulo, y nunca seis", {
  e <- pulso_cifras(.cinco[1:3])
  expect_identical(e$forma, "cifras/1"); expect_length(e$items, 3L); expect_true(.lam_cifras_cabe(e))
  expect_error(pulso_cifras(c(.cinco, .cinco[1])), "hasta cinco")
  expect_error(pulso_cifras(list(list(valor = "12%"))), "valor` y `rotulo")
})

test_that("el tamaño sigue al recetario: 54 pt con una cifra, 44 con tres, 34 con cinco", {
  expect_equal(.lam_cifras_size(1), 54); expect_equal(.lam_cifras_size(3), 44); expect_equal(.lam_cifras_size(5), 34)
})

test_that("la banda dibuja valor, rótulo, detalle e ícono de cada cifra y un separador entre cifras", {
  lz <- .lam_lienzo()
  b <- .lam_cifras_banda(lz, pulso_cifras(.cinco), 0.6, 1.6, 12.1)
  xml <- paste(unlist(lz$formas), collapse = "")
  for (nm in c("cifra:valor", "cifra:rotulo", "cifra:detalle")) expect_equal(lengths(regmatches(xml, gregexpr(paste0('name="', nm, '"'), xml))), 5L)
  expect_equal(lengths(regmatches(xml, gregexpr('name="cifra:separador"', xml))), 4L)
  expect_length(b$iconos, 5L)
  expect_match(xml, 'sz="3400"', fixed = TRUE)                                   # cinco cifras: 34 pt
  # Todos los detalles a la misma altura aunque un rótulo ocupe dos líneas
  tops <- as.numeric(regmatches(xml, gregexpr('(?<=name="cifra:detalle"/>).{0,600}?<a:off x="[0-9]+" y="\\K[0-9]+', xml, perl = TRUE))[[1]])
  expect_length(unique(tops), 1L)
})

test_that("la lámina de cifras sale nativa, con título, banda e íconos", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  r <- .lam_laminas_cifras(doc, pulso_cifras(.cinco[1:3]), "Tres cifras con rótulos de largo distinto", ante = "Resumen",
                           base = "Base: 52 docentes, 172 estudiantes y 178 egresados", folio = 7L,
                           lectura = "La cifra queda arriba y el detalle siempre cae a la misma altura.")
  f <- tempfile(fileext = ".pptx"); print(r$doc, target = f)
  p <- .preview_partes(f)
  expect_identical(p$partes[[length(p$partes)]]$estado, "nativa")
  x <- .pptx_leer_parte(f, utils::tail(.pptx_slide_paths(f), 1))
  expect_match(x, 'name="prosecnur:grafico:cifras"', fixed = TRUE)
  expect_equal(lengths(regmatches(x, gregexpr('name="cifra:icono"', x))), 3L)
})
