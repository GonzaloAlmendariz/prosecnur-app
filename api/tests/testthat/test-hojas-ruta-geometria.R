# Geometría compacta para el lienzo de Hojas de ruta (ADR 0114 §7).
# Ver api/R/hojas_ruta_geometria.R.

test_that("geometría: un anillo cerrado no colapsa al simplificarse", {
  # Cuadrado de 100 m con puntos intermedios alineados y primer = último punto.
  # Douglas-Peucker sobre el anillo entero lo dejaba en dos puntos (largo 0
  # entre extremos iguales); partido en su punto más lejano conserva las cuatro
  # esquinas.
  anillo <- rbind(c(0, 0), c(50, 0), c(100, 0), c(100, 50), c(100, 100), c(50, 100), c(0, 100), c(0, 50), c(0, 0))
  plano <- .hojas_ruta_geometria_simplificar(anillo, tol = 1)
  pts <- matrix(plano, ncol = 2, byrow = TRUE)
  expect_true(nrow(pts) >= 5L)
  expect_true(all(c(0, 100) %in% pts[, 1]) && all(c(0, 100) %in% pts[, 2]))
  expect_equal(pts[1, ], pts[nrow(pts), ])
})

test_that("geometría: una línea abierta pierde solo los puntos alineados", {
  linea <- rbind(c(0, 0), c(10, 0.2), c(20, 0), c(20, 30))
  pts <- matrix(.hojas_ruta_geometria_simplificar(linea, tol = 1), ncol = 2, byrow = TRUE)
  expect_equal(pts, rbind(c(0, 0), c(20, 0), c(20, 30)))
})

test_that("geometría: el NSE sale del nivel en texto, no del código numérico", {
  expect_equal(.hojas_ruta_geometria_nivel_nse("ALTO"), 1L)
  expect_equal(.hojas_ruta_geometria_nivel_nse("medio alto"), 2L)
  expect_equal(.hojas_ruta_geometria_nivel_nse(" BAJO "), 5L)
  expect_equal(.hojas_ruta_geometria_nivel_nse(NULL), 0L)
  expect_equal(.hojas_ruta_geometria_nivel_nse(NA), 0L)
  expect_equal(.hojas_ruta_geometria_nivel_nse("SIN DATA"), 0L)
})

test_that("geometría: la proyección pone el origen común en (0, 0) y crece hacia el sur", {
  p <- .hojas_ruta_geometria_proyectar(rbind(c(-76.99, -12.03), c(-76.98, -12.04)))
  expect_equal(p[1, ], c(0, 0))
  expect_true(p[2, 1] > 1000 && p[2, 1] < 1200)
  expect_true(p[2, 2] > 1000 && p[2, 2] < 1200)
})

test_that("geometría: un distrito empaquetado sale completo, sin anillos colapsados y se cachea", {
  ubigeo <- "070106" # La Punta: el distrito más chico del marco
  perfil <- .hojas_ruta_cartografia_profile_for_ubigeo(ubigeo)
  skip_if(is.null(perfil) || !file.exists(.hojas_ruta_block_map_packaged_file(perfil, ubigeo)), "sin cartografía empaquetada de La Punta")
  cache <- withr::local_tempdir()
  withr::local_envvar(PROSECNUR_CARTOGRAFIA_CACHE = cache)
  rm(list = ls(.hojas_ruta_geometria_cache), envir = .hojas_ruta_geometria_cache)

  geo <- hojas_ruta_geometria_compacta(ubigeo)
  expect_true(geo$ok)
  expect_identical(geo$version, "hojas_ruta_geometria/v1")
  expect_gt(length(geo$manz), 0L)
  # Cada manzana: id, viviendas, zona, NSE 0–5 y al menos un anillo con tres puntos
  expect_true(all(vapply(geo$manz, function(m) is.character(m[[1]]) && nzchar(m[[1]]), logical(1))))
  expect_true(all(vapply(geo$manz, function(m) m[[4]] %in% 0:5, logical(1))))
  expect_true(all(vapply(geo$manz, function(m) all(vapply(m[[5]], length, 1L) >= 6L), logical(1))))
  expect_length(geo$bbox, 4L)
  expect_true(geo$bbox[[3]] > geo$bbox[[1]] && geo$bbox[[4]] > geo$bbox[[2]])

  json <- hojas_ruta_geometria_compacta_json(ubigeo)
  archivo <- .hojas_ruta_geometria_archivo(ubigeo)
  expect_true(file.exists(archivo))
  expect_identical(hojas_ruta_geometria_compacta_json(ubigeo), json)
  leido <- jsonlite::fromJSON(json, simplifyVector = FALSE)
  expect_identical(length(leido$manz), length(geo$manz))
})
