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

test_that("GET /api/hojas-ruta/contornos sirve la región; código mal formado 400, sin cartografía 404", {
  pr <- mount_hojas_ruta_contornos(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  ok <- .hre_call(pr, "", "GET", "/api/hojas-ruta/contornos", query = "region=04")
  expect_identical(ok$status, 200L)
  expect_identical(ok$body$region, "04")
  expect_true(length(ok$body$distritos$features) >= 17L)
  mal <- .hre_call(pr, "", "GET", "/api/hojas-ruta/contornos", query = "region=x")
  expect_identical(mal$status, 400L)
  expect_identical(mal$body$error$code, "E_HOJAS_RUTA_REGION")
  nada <- .hre_call(pr, "", "GET", "/api/hojas-ruta/contornos", query = "region=99")
  expect_identical(nada$status, 404L)
  expect_identical(nada$body$error$code, "E_HOJAS_RUTA_REGION_SIN_CONTORNOS")
})

test_that("el contexto distrital del PDF trae vecinos también en una ciudad", {
  d <- .hojas_ruta_pdf_district_context_features("040103")  # Cayma, Arequipa
  expect_gt(length(d), 1L)
  expect_identical(d[[1]]$ubigeo, "040103")
  expect_true(all(vapply(d, function(f) startsWith(f$ubigeo, "04"), logical(1))))
})

test_that("Lima y el Callao se ven como vecinos en el contexto distrital", {
  d <- .hojas_ruta_pdf_district_context_features("150101")
  expect_true(any(vapply(d, function(f) startsWith(f$ubigeo, "07"), logical(1))))
})
