source("setup-load-all.R")

# F4 (P5, P11, P13, P10): los públicos («actor») y el subtítulo de la lámina tienen su propio rol de negrita.
# P8: un título de dos líneas no tapa el subtítulo de público.

.bold_de <- function(nombre, bold) {
  lz <- .lam_txt(.lam_lienzo(), "x", 0, 0, 1, 0.3, bold = bold, nombre = nombre)
  as.integer(sub('.* b="([01])".*', "\\1", lz$formas[[1]]))
}

test_that("sin opción, todo igual que hoy (regresión)", {
  withr::local_options(prosecnur.negrita = NULL)
  expect_identical(.bold_de("actor", TRUE), 1L)
  expect_identical(.bold_de("Subtitulo lamina", FALSE), 0L)
  expect_identical(.bold_de("premisa", TRUE), 1L)
  withr::local_options(prosecnur.negrita = .NEGRITA_DEFECTO)
  expect_identical(.bold_de("actor", TRUE), 1L)
  expect_identical(.bold_de("Subtitulo lamina", FALSE), 0L)
  expect_identical(.NEGRITA_DEFECTO$publicos, TRUE)
  expect_identical(.NEGRITA_DEFECTO$subtitulos, FALSE)
})

test_that("publicos=FALSE y subtitulos=TRUE; la premisa sigue en negrita", {
  withr::local_options(prosecnur.negrita = list(publicos = FALSE, subtitulos = TRUE))
  expect_identical(.lam_rol_negrita("actor"), "publicos")
  expect_identical(.lam_rol_negrita("Subtitulo lamina"), "subtitulos")
  expect_identical(.bold_de("actor", TRUE), 0L)
  expect_identical(.bold_de("Subtitulo lamina", FALSE), 1L)
  expect_identical(.bold_de("premisa", TRUE), 1L)
})

test_that("el validador acepta los roles nuevos y rechaza no lógicos", {
  expect_no_error(.negrita_validar_letra(list(negrita = list(publicos = FALSE, subtitulos = TRUE))))
  expect_error(.negrita_validar_letra(list(negrita = list(publicos = "si"))))
  expect_identical(.negrita_resolver(list(negrita = list(publicos = FALSE, subtitulos = TRUE, titulos = TRUE)))$negrita,
                   list(publicos = FALSE, subtitulos = TRUE))
})

.cajas_titulo <- function(titulo, sub) {
  cap <- NULL
  local_mocked_bindings(.lam_agrupar = function(doc, lz, ...) { cap <<- lz; doc })
  .lam_titulo(NULL, titulo, sub = sub, avisar = FALSE)
  cap$cajas
}

test_that("P8: el subtítulo baja bajo un título de dos líneas y no se mueve con una", {
  largo <- "Mi Facultad fomenta la participación de los estudiantes en proyectos profesionales"
  corto <- "¿Cuál es su género?"
  pt <- .std_pt("titulo"); yt <- .std_geom("titulo_y")
  n <- .lam_lineas_tinta(largo, 10.4, pt, TRUE)
  expect_gte(n, 2L)
  cl <- .cajas_titulo(largo, "ADMINISTRATIVOS")
  fondo_titulo <- yt + 0.06 + 0.05 + n * pt * 1.2 / 72
  expect_gte(cl[[length(cl)]][2], fondo_titulo)   # el subtítulo arranca bajo la última línea del título
  expect_equal(cl[[length(cl)]][2], yt + 0.55 + (n - 1) * pt * 1.2 / 72)
  cc <- .cajas_titulo(corto, "ADMINISTRATIVOS")
  expect_equal(cc[[length(cc)]][2], yt + 0.55)
})
