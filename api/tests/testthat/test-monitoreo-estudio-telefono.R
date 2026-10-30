# El arranque de Acreditación sin canal telefónico no prepara phone_summary.

fuente <- function(role, kind, canal = "") list(role = role, kind = kind, dimensions = list(canal = canal))

test_that("un estudio sólo de correo no usa teléfono", {
  fuentes <- list(fuente("respuestas", "surveymonkey", "Correo (Mailchimp)"), fuente("universo", "google_sheets"))
  expect_false(.monitoreo_estudio_usa_telefono(list(), fuentes))
  expect_identical(.project_warmup_monitoreo_compact_scopes("acreditacion", FALSE), c("source", "advance_summary", "queries_summary"))
})

test_that("un público con teléfono o una fuente telefónica o de barrido sí lo usa", {
  cfg <- list(monitoreo_profile = list(units = list(list(actor = "Egresados", phone = list(enabled = TRUE)))))
  expect_true(.monitoreo_estudio_usa_telefono(cfg, list()))
  expect_true(.monitoreo_estudio_usa_telefono(list(), list(fuente("respuestas", "kobo", "Teléfono"))))
  expect_true(.monitoreo_estudio_usa_telefono(list(), list(fuente("barrido", "google_sheets"))))
})

test_that("sin públicos ni fuentes se prepara como antes, y el perfil telefónico siempre lo prepara", {
  expect_true(.monitoreo_estudio_usa_telefono(list(), list()))
  expect_true("phone_summary" %in% .project_warmup_monitoreo_compact_scopes("telefonico", FALSE))
  expect_true("phone_summary" %in% .project_warmup_monitoreo_compact_scopes("acreditacion", TRUE))
})
