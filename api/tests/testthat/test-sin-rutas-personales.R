# El repo es público: el código de producto no nombra carpetas de una persona.
#
# Hasta el 4 nov 2026 la hoja de ruta buscaba su logo en el Documents de una
# persona (con la ruta absoluta escrita) y `exportar_manuales_qmd()` tenía por
# destino por defecto otra carpeta personal. Ahora los assets salen del paquete o
# de PROSECNUR_HOJAS_RUTA_ASSETS_DIR, y los manuales piden su destino.

.srp_sin_comentarios <- function(lineas, comentario) sub(paste0(comentario, ".*$"), "", lineas)

# Una ruta de usuario concreta: «/Users/<nombre>/», no el «/Users/.../» de un ejemplo.
.SRP_RUTA_PERSONAL <- "(^|[^A-Za-z]:?)/Users/[A-Za-z0-9_-]+/|/home/[a-z][a-z0-9_-]+/"

.srp_hallazgos <- function(archivos, comentario) {
  unlist(lapply(archivos, function(f) {
    codigo <- .srp_sin_comentarios(readLines(f, warn = FALSE, encoding = "UTF-8"), comentario)
    hits <- grep(.SRP_RUTA_PERSONAL, codigo, perl = TRUE)
    if (length(hits)) sprintf("%s:%d", basename(f), hits) else character(0)
  }))
}

test_that("el backend no escribe rutas de usuario en su código", {
  archivos <- list.files(testthat::test_path("..", "..", "R"), pattern = "[.]R$", full.names = TRUE)
  expect_gt(length(archivos), 100L)
  expect_identical(.srp_hallazgos(archivos, "#"), character(0))
})

test_that("el frontend no escribe rutas de usuario en su código", {
  src <- testthat::test_path("..", "..", "..", "frontend", "src")
  skip_if_not(dir.exists(src), "sin el árbol del frontend")
  archivos <- list.files(src, pattern = "[.]tsx?$", full.names = TRUE, recursive = TRUE)
  archivos <- archivos[!grepl("[.]test[.]tsx?$|__tests__", archivos)]
  expect_gt(length(archivos), 100L)
  expect_identical(.srp_hallazgos(archivos, "//"), character(0))
})

test_that("el detector ve una ruta de usuario y no un ejemplo ni un comentario", {
  f <- withr::local_tempfile(fileext = ".R")
  writeLines(c(
    'x <- file.path("/Users/alguien/Documents/Pulso", f)',
    '# ejemplo: /Users/alguien/Proyecto.pulso',
    'y <- "/Users/.../Proyecto.pulso"',
    'z <- "/home/otra/datos"'
  ), f)
  expect_identical(.srp_hallazgos(f, "#"), sprintf("%s:%d", basename(f), c(1L, 4L)))
})

test_that("el logo de la hoja de ruta sale del paquete", {
  path <- .hojas_ruta_legacy_asset_path("logo_pulso.png")
  expect_true(file.exists(path))
  expect_match(path, "hojas_ruta/assets/logo_pulso.png$")
})

test_that("un asset que no existe da NA, y la carpeta declarada se usa", {
  withr::local_envvar(PROSECNUR_HOJAS_RUTA_ASSETS_DIR = "")
  expect_identical(.hojas_ruta_legacy_asset_path("no-existe.png"), NA_character_)
  dir <- withr::local_tempdir()
  file.create(file.path(dir, "propio.png"))
  withr::local_envvar(PROSECNUR_HOJAS_RUTA_ASSETS_DIR = dir)
  expect_identical(.hojas_ruta_legacy_asset_path("propio.png"), normalizePath(file.path(dir, "propio.png")))
})

test_that("exportar los manuales pide su destino", {
  withr::local_envvar(PROSECNUR_MANUALES_DESTINO = "")
  expect_error(exportar_manuales_qmd(render_pdf = FALSE), "PROSECNUR_MANUALES_DESTINO", fixed = TRUE)
  expect_identical(formals(exportar_manuales_qmd)$dir_destino, quote(Sys.getenv("PROSECNUR_MANUALES_DESTINO", "")))
})
