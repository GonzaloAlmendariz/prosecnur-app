# Contornos por región del lienzo (docs/qa/plan-territorio-por-regiones-2026-10-29.md, R1):
# cada región marcable trae los contornos de todos sus distritos del registro.

contornos_dir <- function() .hojas_ruta_inst_path("hojas_ruta", "contornos")

leer_region <- function(region) {
  con <- gzfile(file.path(contornos_dir(), paste0(region, ".json.gz")), "rt", encoding = "UTF-8")
  on.exit(close(con))
  jsonlite::fromJSON(paste(readLines(con, warn = FALSE), collapse = "\n"), simplifyVector = FALSE)
}

test_that("cada distrito del registro tiene contorno en el archivo de su región", {
  reg <- hojas_ruta_territorios()
  ubigeos <- unlist(lapply(reg$provincias, function(p) unlist(p$distritos)))
  expect_gt(length(ubigeos), 100L)
  regiones <- unique(substr(ubigeos, 1, 2))
  for (r in regiones) {
    x <- leer_region(r)
    tiene <- vapply(x$distritos$features, function(f) f$properties$ubigeo, "")
    faltan <- setdiff(ubigeos[substr(ubigeos, 1, 2) == r], tiene)
    expect(length(faltan) == 0L, sprintf("región %s sin contorno para %s", r, paste(faltan, collapse = ", ")))
  }
})

test_that("un archivo de región sólo trae distritos de esa región, con su nombre y sus provincias", {
  for (f in list.files(contornos_dir(), pattern = "\\.json\\.gz$")) {
    r <- sub("\\.json\\.gz$", "", f)
    x <- leer_region(r)
    expect_identical(x$region, r)
    expect_true(nzchar(x$nombre))
    ub <- vapply(x$distritos$features, function(f) f$properties$ubigeo, "")
    expect_true(all(substr(ub, 1, 2) == r), info = r)
    expect_gt(length(x$provincias), 0L)
    expect_true(all(vapply(x$distritos$features, function(f) f$geometry$type %in% c("Polygon", "MultiPolygon"), logical(1))), info = r)
  }
})

test_that("Lima Metropolitana y el Callao viven en dos regiones distintas", {
  expect_true(all(c("15", "07") %in% sub("\\.json\\.gz$", "", list.files(contornos_dir()))))
  callao <- vapply(leer_region("07")$distritos$features, function(f) f$properties$provincia, "")
  expect_true(all(callao == "CALLAO"))
})
