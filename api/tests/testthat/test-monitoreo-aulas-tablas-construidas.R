# Monitoreo comprueba que las tablas que Material construyó en el Sheets existen
# (Gonzalo, 2026-11-02; ADR 0125). Se lee por nombre de pestaña, con un lector
# inyectado: nunca se toca un Sheets real.

cfg_con <- function(libro = "", dist = "") {
  aulas <- list()
  if (nzchar(libro)) aulas$libro_sheets <- list(spreadsheet_id = libro)
  if (nzchar(dist)) aulas$distribucion_sheets <- list(spreadsheet_id = dist)
  list(aulas_universitarias = aulas)
}

lector <- function(por_id) function(id) {
  if (!id %in% names(por_id)) return(list(titulos = NULL, error = "sin acceso"))
  list(titulos = por_id[[id]], error = "")
}

test_that("sin destinos, ninguna tabla existe y el libro dice qué le falta", {
  out <- monitoreo_aulas_tablas_construidas(cfg_con(), titulos_de = lector(list()))
  expect_identical(out$libro$existe, FALSE)
  expect_identical(out$libro$destino, "")
  expect_true("Base de control" %in% unlist(out$libro$faltan))
  expect_identical(out$distribucion$existe, FALSE)
})

test_that("el libro completo existe; uno a medias dice qué pestañas faltan", {
  completo <- c(.malp_hojas_equipo(), .malp_hojas_app(), "Asignación de aplicadores")
  out <- monitoreo_aulas_tablas_construidas(
    cfg_con(libro = "LIBRO1"),
    titulos_de = lector(list(LIBRO1 = completo))
  )
  expect_identical(out$libro$existe, TRUE)
  expect_length(out$libro$faltan, 0L)
  expect_match(out$libro$url, "LIBRO1")

  a_medias <- monitoreo_aulas_tablas_construidas(
    cfg_con(libro = "LIBRO2"),
    titulos_de = lector(list(LIBRO2 = .malp_hojas_equipo()))
  )
  expect_identical(a_medias$libro$existe, FALSE)
  expect_setequal(unlist(a_medias$libro$faltan), .malp_hojas_app())
})

test_that("la distribución existe con sus semanas; un documento ilegible no se da por vacío", {
  out <- monitoreo_aulas_tablas_construidas(
    cfg_con(libro = "ROTO", dist = "DIST1"),
    titulos_de = lector(list(DIST1 = c("Semana 1", "Semana 2", "Notas")))
  )
  expect_identical(out$distribucion$existe, TRUE)
  expect_identical(unlist(out$distribucion$semanas), c("Semana 1", "Semana 2"))
  # Sin poder leer el libro no se afirma que falten pestañas.
  expect_true(is.na(out$libro$existe))
  expect_length(out$libro$faltan, 0L)
  expect_identical(out$libro$error, "sin acceso")
})

test_that("un documento de distribución sin pestañas de semana no cuenta como construido", {
  out <- monitoreo_aulas_tablas_construidas(
    cfg_con(dist = "DIST2"),
    titulos_de = lector(list(DIST2 = c("Hoja 1")))
  )
  expect_identical(out$distribucion$existe, FALSE)
})
