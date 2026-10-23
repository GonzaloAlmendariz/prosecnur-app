# P3 de procedimientos-respondidos.md (revamp Monitoreo › Telefónico, T9): la
# hoja dice «Efectivo» y Kobo no tiene envío → Avisos, agrupado por
# responsable, desde las mismas filas de `discrepancias_telefonicas`
# (`Destino = "avisos"`). Fixture sintético: códigos AVS-0xx y proGres
# «XYZ-26-8xxxxx» inventados; sin red ni rutas.

avs_discrepancias <- function() {
  data.frame(
    Sentido = c("hoja_sin_kobo", "hoja_sin_kobo", "kobo_sin_hoja", "hoja_sin_kobo", "hoja_sin_kobo"),
    CodPulso = c("AVS-003", "AVS-001", "AVS-009", "AVS-005", "AVS-007"),
    proGres = c("XYZ-26-800003", "XYZ-26-800001", "XYZ-26-800009", "", "XYZ-26-800007"),
    Responsable = c("Op-02", "Op-02", "Op-01", "Sin responsable", "Op-03"),
    `La hoja dice` = "Efectivo",
    `Fecha hoja` = c("21/10/2026", "20/10/2026", "", "22/10/2026", "22/10/2026"),
    Destino = c("avisos", "avisos", "decision", "avisos", "avisos"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

avs_filas <- function(bloque) {
  if (!length(bloque$rows)) return(data.frame())
  do.call(rbind, lapply(bloque$rows, function(r) as.data.frame(r, check.names = FALSE, stringsAsFactors = FALSE)))
}

avs_bloques <- function(d) {
  b <- .monitoreo_avisos_hoja_sin_kobo_blocks(d)
  stats::setNames(b, vapply(b, function(x) x$id, ""))
}

test_that("solo las filas con Destino «avisos», agrupadas por responsable y con sus códigos", {
  b <- avs_bloques(avs_discrepancias())
  expect_identical(unlist(b$avisos_hoja_sin_kobo$columns),
                   c("Responsable", "CodPulso", "proGres", "La hoja dice", "Fecha hoja", "Casos del responsable"))
  casos <- avs_filas(b$avisos_hoja_sin_kobo)
  expect_false("AVS-009" %in% casos$CodPulso)
  # Más casos primero, «Sin responsable» al final; dentro del grupo, por CodPulso.
  expect_identical(casos$CodPulso, c("AVS-001", "AVS-003", "AVS-007", "AVS-005"))
  expect_identical(casos$Responsable, c("Op-02", "Op-02", "Op-03", "Sin responsable"))
  expect_identical(as.integer(casos$`Casos del responsable`), c(2L, 2L, 1L, 1L))
  expect_identical(casos$proGres[casos$CodPulso == "AVS-001"], "XYZ-26-800001")
  expect_identical(casos$`Fecha hoja`[casos$CodPulso == "AVS-003"], "21/10/2026")
  grupos <- avs_filas(b$avisos_hoja_sin_kobo_responsable)
  expect_identical(names(grupos), c("Responsable", "Casos", "CodPulso"))
  expect_identical(grupos$Responsable, c("Op-02", "Op-03", "Sin responsable"))
  expect_identical(grupos$CodPulso[[1]], "AVS-001, AVS-003")
})

test_that("sin casos los dos bloques salen vacíos, con columnas y su nota", {
  b <- avs_bloques(avs_discrepancias()[3, ])
  expect_length(b$avisos_hoja_sin_kobo$rows, 0L)
  expect_length(unlist(b$avisos_hoja_sin_kobo$columns), 6L)
  expect_length(b$avisos_hoja_sin_kobo_responsable$rows, 0L)
  expect_match(b$avisos_hoja_sin_kobo$note, "Ningún caso")
  expect_length(avs_bloques(data.frame())$avisos_hoja_sin_kobo$rows, 0L)
})

test_that("en el reporte telefónico salen de la misma fuente que Discrepancias (acnur_pdm)", {
  pulso <- testthat::test_path("..", "..", "inst", "reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  if (!file.exists(pulso)) skip("acnur_pdm.pulso no esta en inst/reference_projects")
  destino <- tempfile("pdm_")
  dir.create(destino)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  utils::unzip(pulso, files = "state.rds", exdir = destino)
  snap <- readRDS(file.path(destino, "state.rds"))$monitoreo_snapshot
  skip_if(is.null(snap$data) || is.null(snap$config), "el state no trae monitoreo_snapshot")
  b <- .monitoreo_report_phone_blocks(snap$data, snap$config$monitoreo_profile, snap$config)
  b <- stats::setNames(b, vapply(b, function(x) x$id, ""))
  disc <- avs_filas(b$discrepancias_telefonicas)
  avisos <- avs_filas(b$avisos_hoja_sin_kobo)
  expect_setequal(avisos$CodPulso, disc$CodPulso[disc$Destino == "avisos"])
  expect_identical(nrow(avisos), 3L)
  expect_identical(sum(vapply(b$avance_efectivo_dia$rows, function(r) as.integer(r$Efectivas), 1L)), 423L)
})
