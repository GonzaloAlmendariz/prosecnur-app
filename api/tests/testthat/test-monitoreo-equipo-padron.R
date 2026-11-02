# El padrón del equipo (contrato con Hojas/Material, 2026-11-02): una sola lista,
# la de Monitoreo; `activo` siempre viene; nunca sale un DNI.

sesion_de <- function(familia, extra = list()) {
  cfg <- utils::modifyList(list(monitoreo_profile = list(family = familia)), extra$cfg %||% list())
  c(list(monitoreo_config = cfg), extra$s %||% list())
}

test_that("territorial lee la lista de códigos P, con activo siempre", {
  s <- sesion_de("territorial", list(cfg = list(territorial = list(enumerator_roster = list(
    code_format = "PXXX",
    assignments = list(list(codigo_pulso = "P101", nombre = "Ana Uno"), list(codigo_pulso = "P102", nombre = "Beto Dos"))
  )))))
  out <- monitoreo_equipo_padron(s)
  expect_identical(out$familia, "territorial")
  expect_identical(out$origen, "lista_de_codigos")
  expect_identical(vapply(out$personas, `[[`, "", "codigo"), c("P101", "P102"))
  expect_true(all(vapply(out$personas, function(p) isTRUE(p$activo), logical(1))))
  expect_setequal(names(out$personas[[1]]), c("codigo", "nombre", "rol", "activo"))
  expect_identical(out$personas[[1]]$rol, "encuestador")
})

test_that("con DNI no sale nadie: personas vacío y code_format DNI", {
  s <- sesion_de("territorial", list(cfg = list(territorial = list(enumerator_roster = list(
    code_format = "DNI", assignments = list(list(codigo_pulso = "40404040", nombre = "Ana Uno"))
  )))))
  out <- monitoreo_equipo_padron(s)
  expect_identical(out$code_format, "DNI")
  expect_length(out$personas, 0L)
  expect_false(grepl("40404040", paste(unlist(out), collapse = " ")))
})

test_that("telefónico lee los enumeradores confirmados en las equivalencias", {
  s <- sesion_de("telefonico", list(cfg = list(monitoreo_profile = list(family = "telefonico",
    enumerator_equivalences = list(list(kobo = "ana.k", hoja = "Ana Uno"), list(kobo = "beto", hoja = "Beto Dos"))))))
  out <- monitoreo_equipo_padron(s)
  expect_identical(out$origen, "equivalencias")
  expect_identical(vapply(out$personas, `[[`, "", "nombre"), c("Ana Uno", "Beto Dos"))
})

test_that("sin nadie en la familia, el padrón va vacío con su origen", {
  out <- monitoreo_equipo_padron(sesion_de("acreditacion"))
  expect_length(out$personas, 0L)
  expect_true(nzchar(out$code_format))
})
