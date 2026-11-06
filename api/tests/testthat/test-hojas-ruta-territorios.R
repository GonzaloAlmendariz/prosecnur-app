# ADR 0119 §2: el registro territorios.json es la única fuente de cobertura de Hojas de ruta.
# En rojo hasta la oleada B del plan (hojas_ruta_territorios() y el registro empaquetado).

registro_territorios <- function() {
  path <- .hojas_ruta_inst_path("hojas_ruta", "territorios.json")
  expect_true(file.exists(path), info = "falta api/inst/hojas_ruta/territorios.json")
  jsonlite::read_json(path, simplifyVector = FALSE)
}

test_that("el registro cumple el esquema v1 y cubre Lima, Callao y las ciudades", {
  reg <- registro_territorios()
  expect_identical(as.integer(reg$schema_version), 1L)
  codigos <- vapply(reg$provincias, function(p) p$codigo, character(1))
  expect_false(anyDuplicated(codigos) > 0L)
  expect_true(all(c("1501", "0701", "0401", "1301", "2001") %in% codigos))
  expect_true(all(c("1401", "1201", "0218", "0801", "1601", "2501", "2301", "2209") %in% codigos))

  distritos <- unlist(lapply(reg$provincias, function(p) unlist(p$distritos)))
  expect_false(anyDuplicated(distritos) > 0L, info = "un distrito pertenece a una sola provincia")
})

test_that("cada capa obligatoria declara fuente, año del dato y checksums que coinciden", {
  reg <- registro_territorios()
  base <- .hojas_ruta_inst_path("hojas_ruta")
  for (prov in reg$provincias) {
    for (nombre in c("manzanas", "marco", "nse")) {
      capa <- prov$capas[[nombre]]
      info <- paste(prov$codigo, nombre)
      expect_false(is.null(capa), info = info)
      expect_true(all(c("ruta", "fuente", "anio_dato", "descargado", "version", "checksums") %in% names(capa)), info = info)
      expect_true(is.numeric(capa$anio_dato) && capa$anio_dato >= 2007 && capa$anio_dato <= 2025, info = info)
      expect_match(capa$descargado, "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", info = info)
      dir <- if (!is.null(capa$patron)) file.path(base, capa$ruta) else dirname(file.path(base, capa$ruta))
      for (archivo in names(capa$checksums)) {
        path <- file.path(dir, archivo)
        expect_true(file.exists(path), info = paste(info, archivo))
        expect_identical(unname(tools::md5sum(path)), capa$checksums[[archivo]], info = paste(info, archivo))
      }
    }
  }
})

test_that("cada provincia y cada distrito informa su cobertura antes de elegirse (ADR 0119 §7)", {
  reg <- registro_territorios()
  for (prov in reg$provincias) {
    cob <- prov$cobertura
    expect_false(is.null(cob), info = prov$codigo)
    expect_true(cob$nivel %in% c("1", "2", "fuera"), info = prov$codigo)
    expect_true(all(c("cobertura_cartografica", "captacion") %in% names(cob$provincia)), info = prov$codigo)
    expect_setequal(names(cob$distritos), unlist(prov$distritos))
    for (ub in names(cob$distritos)) {
      expect_true(is.numeric(cob$distritos[[ub]]$captacion), info = ub)
    }
  }
})

test_that("todo distrito del registro resuelve perfil de cartografía", {
  reg <- registro_territorios()
  for (prov in reg$provincias) {
    ub <- prov$distritos[[1]]
    expect_false(is.null(.hojas_ruta_cartografia_profile_for_ubigeo(ub)), info = ub)
  }
})

test_that("la cobertura no se decide con regex de ubigeo fuera del registro", {
  files <- list.files(test_path("..", "..", "R"), pattern = "^hojas_ruta.*[.]R$", full.names = TRUE)
  hits <- unlist(lapply(files, function(f) {
    idx <- grep("\\^(1501|0701)", readLines(f, warn = FALSE))
    if (length(idx)) paste0(basename(f), ":", idx) else character(0)
  }))
  expect_identical(hits, character(0))
})
